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
  assert.ok(s.cost<=base.budget);
  assert.ok(Math.abs(s.baseCost+s.outdoorCost+s.contingency-s.cost)<.01);
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
        assert.ok(s.cost<=10000000);
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
test('outdoor selection has an explicit allowance and can be empty',()=>{
  const none=buildHouseSpec({...base,outdoor:[]});
  assert.equal(none.outdoorCost,0);assert.equal(none.outdoor.length,0);
  assert.equal(buildHouseSpec(base).outdoorCost,35000);
});
