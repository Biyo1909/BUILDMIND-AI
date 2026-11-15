const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({Intl});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core.js'),'utf8')+'\nglobalThis.api={buildHouseSpec,roomPath,chooseForm};',context);
const {buildHouseSpec,roomPath,chooseForm}=context.api;
const base={purpose:'residential',budget:750000,location:'',style:'modern',luxury:3,width:32,depth:42,floors:2,bedrooms:3,bathrooms:2,outdoor:['garden','pool']};

test('default brief stays in budget and respects the requested room counts',()=>{
  const s=buildHouseSpec(base);
  assert.equal(s.formType,'court');assert.equal(s.floors,2);
  assert.equal(s.rooms.filter(r=>r.type==='bedroom').length,3);
  assert.equal(s.rooms.filter(r=>r.isBathroom).length,2);
  assert.ok(s.sizingAllowance<=base.budget);
  assert.ok(s.W+4<=base.width);assert.ok(s.D+12<=base.depth);
});
test('zero bedrooms and bathrooms remain zero',()=>{
  const s=buildHouseSpec({...base,bedrooms:0,bathrooms:0});
  assert.equal(s.rooms.filter(r=>r.type==='bedroom'||r.isBathroom).length,0);
});
test('budget and architectural language change the shape and footprint',()=>{
  const low=buildHouseSpec({...base,budget:500000});
  const high=buildHouseSpec(base);
  const nordic=buildHouseSpec({...base,style:'scandinavian'});
  assert.notEqual(low.formType,high.formType);assert.ok(low.area<high.area);
  assert.notEqual(nordic.formType,high.formType);
  assert.equal(chooseForm({...base,purpose:'warehouse'}),'sawtooth');
  assert.equal(chooseForm({...base,purpose:'commercial'}),'gallery');
});
test('every room is reachable on every floor for all category/style combinations',()=>{
  for(const purpose of ['residential','vacation','office','commercial','hotel','warehouse','mixed']) {
    for(const style of ['modern','minimalist','luxury','scandinavian','futuristic']) {
      for(const floors of [1,2,3,4]) {
        const s=buildHouseSpec({...base,purpose,style,floors,budget:10000000,width:90,depth:100,bedrooms:1,bathrooms:1});
        assert.equal(s.floors,floors);
        assert.ok(s.roomPlan[0].length<9);
        assert.ok(s.sizingAllowance<=10000000);
        for(const list of s.roomPlan)for(const room of list){
          const route=roomPath(s,list[0].id,room.id);
          assert.ok(route.length,`${purpose}/${style}/${floors}: unreachable ${room.id}`);
          for(let i=1;i<route.length;i++)assert.ok(route[i-1].neighbors.includes(route[i].id));
          if(room.floor)assert.ok(s.roomPlan[room.floor-1].some(r=>r.gx===room.gx&&r.gz===room.gz));
        }
      }
    }
  }
});
test('infeasible briefs explain the constraint rather than silently changing floors',()=>{
  assert.throws(()=>buildHouseSpec({...base,budget:100000}),/Not enough space or budget/);
  assert.throws(()=>buildHouseSpec({...base,bedrooms:10,bathrooms:10}),/Reduce the bedroom/);
  assert.throws(()=>buildHouseSpec({...base,width:20,depth:24}),/Not enough space or budget/);
});
test('garage reserves plot space and can be deselected',()=>{
  const none=buildHouseSpec({...base,outdoor:[]});
  assert.equal(none.outdoor.length,0);assert.equal(none.garage,null);
  const s=buildHouseSpec({...base,garage:true}),g=s.garage;
  assert.ok(g.cx-g.w/2>s.W/2);assert.ok(g.cx+g.w/2<s.bounds.maxX);
  assert.ok(g.cz-g.d/2>=s.bounds.minZ);assert.ok(g.cz+g.d/2<s.bounds.maxZ);
  assert.ok(s.sizingAllowance<=base.budget);
  assert.throws(()=>buildHouseSpec({...base,width:20,garage:true}),/Not enough space/);
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/costs.js'),'utf8')+'\nglobalThis.costAPI={createCostLedger,COST_RATES};',context);
const {createCostLedger,COST_RATES}=context.costAPI;
test('itemized supply, labor, categories and contingency reconcile to the cent',()=>{
  const ledger=createCostLedger({lux:3});
  for(const code of Object.keys(COST_RATES))ledger.add(code,code==='window'?13.127:1);
  const bill=ledger.finish();
  assert.equal(new Set(bill.lines.map(line=>line.id)).size,bill.lines.length);
  for(const line of bill.lines){
    assert.ok(Number.isSafeInteger(line.totalCents));
    assert.equal(line.materialCents,Math.round(line.quantity*line.materialRateCents));
    assert.equal(line.laborCents,Math.round(line.quantity*line.laborRateCents));
    assert.equal(line.totalCents,line.materialCents+line.laborCents);
  }
  assert.equal(bill.lines.reduce((n,l)=>n+l.totalCents,0),bill.subtotalCents);
  assert.equal(Object.values(bill.groups).reduce((a,b)=>a+b,0),bill.subtotalCents);
  assert.equal(bill.contingencyCents,Math.round(bill.subtotalCents*.12));
  assert.equal(bill.subtotalCents+bill.contingencyCents,bill.totalCents);
});
test('finish affects products but never duplicates installation or garage scope',()=>{
  const basic=createCostLedger({lux:1}),premium=createCostLedger({lux:5});
  const a=basic.add('sofa'),b=premium.add('sofa');
  assert.ok(b.materialRateCents>a.materialRateCents);assert.equal(a.laborRateCents,b.laborRateCents);
  const garage=basic.add('foundation',22.32,{scope:'garage'});
  assert.equal(garage.group,'garage');assert.equal(garage.location,'Detached garage');
  const services=basic.add('electrical',100,{modeled:false});
  assert.equal(services.modeled,false);assert.equal(services.group,'services');
});
