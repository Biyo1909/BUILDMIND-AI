const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(file===root)file=path.join(root,'index.html');
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
async function verifyEstimate(page) {
  const errors=await page.evaluate(()=>{
    const bill=app.model.estimate,errors=[];
    if(bill.lines.reduce((n,l)=>n+l.totalCents,0)!==bill.subtotalCents)errors.push('line subtotal mismatch');
    if(Object.values(bill.groups).reduce((a,b)=>a+b,0)!==bill.subtotalCents)errors.push('group subtotal mismatch');
    if(bill.materialCents+bill.laborCents+bill.contingencyCents!==bill.totalCents)errors.push('receipt mismatch');
    if(document.querySelector('#costValue').textContent!==costMoney(bill.totalCents))errors.push('display mismatch');
    const ids=new Set(bill.lines.map(l=>l.id));
    for(const unit of app.model.units)unit.obj.traverse(mesh=>{
      if(!mesh.isMesh)return;
      let owner=mesh;while(owner&&!owner.userData.costId)owner=owner.parent;
      if(!owner||!ids.has(owner.userData.costId))errors.push('unpriced mesh');
    });
    for(const line of bill.lines)if(line.modeled&&!app.model.costObjects.has(line.id))errors.push('orphan cost line');
    return errors;
  });assert.deepEqual(errors,[]);
}
async function clickPricedItem(page,code,double=false) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const point=await page.evaluate(code=>{
    scene3d.scene.updateMatrixWorld(true);scene3d.camera.updateMatrixWorld();
    const rect=scene3d.renderer.domElement.getBoundingClientRect(),roots=app.model.units.filter(u=>u.obj.visible).map(u=>u.obj);
    const ray=new THREE.Raycaster(),candidates=[];
    for(const line of app.model.estimate.lines.filter(l=>l.code===code)){
      const obj=app.model.costObjects.get(line.id);if(!obj||!objectVisible(obj))continue;
      obj.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.geometry.computeBoundingBox();
        const p=mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(scene3d.camera);
        if(Math.abs(p.x)>.97||Math.abs(p.y)>.97||p.z>1||p.z< -1)return;
        const x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2;
        if(document.elementFromPoint(x,y)!==scene3d.renderer.domElement)return;
        ray.setFromCamera(new THREE.Vector2(p.x,p.y),scene3d.camera);
        const hit=ray.intersectObjects(roots,true).find(h=>objectVisible(h.object));
        let owner=hit?.object;while(owner&&!owner.userData.costId)owner=owner.parent;
        if(owner?.userData.costId===line.id)candidates.push({x,y,id:line.id});
      });
    }
    return candidates[0];
  },code);
  assert.ok(point,`visible clickable ${code} in ${await page.evaluate(()=>app.mode)}`);
  await page.mouse.click(point.x,point.y,{clickCount:double?2:1});
  await page.waitForFunction(id=>app.selection?.line.id===id,point.id);
  assert.equal(await page.locator('#itemInspector').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.querySelector('#inspectTotal').textContent===costMoney(app.selection.line.totalCents)));
  return point;
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chromium'),headless:true,args:['--enable-unsafe-swiftshader']});
  const errors=[];
  const track=page=>{page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});track(page);
    await page.goto(url);await page.waitForFunction(()=>app.ready,null,{timeout:120000});
    await page.evaluate(()=>scene3d.controls.autoRotate=false);
    await page.screenshot({path:path.join(out,'home.png'),fullPage:true});
    assert.equal(await page.title(),'BuildMind AI — Imagine better. Build smarter.');
    await page.click('#heroStart');assert.equal(await page.evaluate(()=>app.screen),'studio');
    await page.screenshot({path:path.join(out,'studio.png')});
    await verifyEstimate(page);
    await page.click('#costToggle');assert.equal(await page.locator('#costDetails').isVisible(),true);
    await page.click('#fullCostOpen');assert.equal(await page.locator('#costBreakdown').isVisible(),true);
    assert.equal(await page.locator('#costRows tr').count(),await page.evaluate(()=>app.model.estimate.lines.length));
    await page.screenshot({path:path.join(out,'itemized-costs.png')});
    await page.fill('#costSearch','sofa');assert.ok(await page.locator('#costRows tr').count()>0);
    await page.locator('#costRows button').first().click();assert.equal(await page.evaluate(()=>app.selection.line.code),'sofa');
    await page.click('#inspectAllCosts');await page.fill('#costSearch','no-such-item');assert.equal(await page.locator('#costEmpty').isVisible(),true);
    await page.fill('#costSearch','');await page.selectOption('#costCategory','services');
    assert.ok(await page.locator('#costRows tr').count()>0);await page.locator('#costRows button').first().click();
    assert.equal(await page.evaluate(()=>app.selection.line.modeled),false);await page.click('#closeInspector');
    await clickPricedItem(page,'plasterWall');await page.screenshot({path:path.join(out,'wall-cost.png')});await page.click('#closeInspector');
    await clickPricedItem(page,'window',true);await page.click('#closeInspector');
    const canvas=await page.locator('#renderMount').boundingBox();
    await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);await page.mouse.down();
    await page.mouse.move(canvas.x+canvas.width*.5+35,canvas.y+canvas.height*.5+15,{steps:5});await page.mouse.up();
    assert.equal(await page.evaluate(()=>app.selection),null);await page.click('#resetCamera');
    await page.click('#replay');await page.waitForFunction(()=>app.progress>.02);
    await page.click('#pauseBuild');assert.equal(await page.evaluate(()=>app.building),false);
    await page.locator('#timeline').evaluate(el=>{el.value='500';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>app.progress),.5);
    assert.ok(await page.evaluate(()=>app.model.units.some(u=>!u.obj.visible)));
    await page.screenshot({path:path.join(out,'construction.png')});
    await page.locator('#timeline').evaluate(el=>{el.value='1000';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.ok(await page.evaluate(()=>app.model.units.every(u=>u.obj.visible)));
    await page.click('[data-view=plan]');await page.screenshot({path:path.join(out,'floor-plan.png')});
    assert.ok(await page.evaluate(()=>app.model.units.filter(u=>u.phase==='roof').every(u=>!u.obj.visible)));
    await clickPricedItem(page,'sofa');await page.screenshot({path:path.join(out,'furniture-cost.png')});await page.click('#closeInspector');
    await clickPricedItem(page,'door',true);await page.click('#closeInspector');
    await clickPricedItem(page,'entryDoor');await page.click('#closeInspector');
    await page.selectOption('#viewFloor','1');assert.equal(await page.evaluate(()=>app.floor),1);
    await page.click('[data-view=walk]');
    assert.ok(await page.evaluate(()=>Math.abs(scene3d.camera.position.y-(PLINTH+FLOOR_H+1.65))<.001));
    await page.screenshot({path:path.join(out,'bedroom.png')});
    await page.selectOption('#viewFloor','0');await page.waitForFunction(()=>app.floor===0&&!document.querySelector('#viewTransition').classList.contains('active'));
    await page.screenshot({path:path.join(out,'walk.png')});
    await clickPricedItem(page,'coffeeTable');await page.screenshot({path:path.join(out,'walk-cost.png')});await page.click('#closeInspector');
    const walkability=await page.evaluate(()=>{
      const failures=[];
      for(const rooms of app.spec.roomPlan){app.floor=rooms[0].floor;for(const r of rooms){
        if(!walkable(r.cx,r.cz))failures.push(`Blocked center ${r.id}`);
        for(const id of r.neighbors){const n=findRoom(app.spec,id);for(let i=0;i<=20;i++){if(!walkable(lerp(r.cx,n.cx,i/20),lerp(r.cz,n.cz,i/20)))failures.push(`Blocked path ${r.id} to ${id}`);}}
      }}
      app.floor=0;placeInRoom(app.spec.entry);return failures;
    });assert.deepEqual(walkability,[]);
    const before=await page.evaluate(()=>scene3d.camera.position.toArray());
    await page.locator('#renderMount').focus();await page.keyboard.down('w');
    await page.waitForFunction(pos=>scene3d.camera.position.distanceTo(new THREE.Vector3(...pos))>.12,before);await page.keyboard.up('w');
    assert.equal(await page.evaluate(()=>app.keys.size),0);
    await page.click('#nextRoom');await page.waitForFunction(()=>app.route.length===0,null,{timeout:20000});
    assert.notEqual(await page.evaluate(()=>app.room.id),'f0-0-0');
    await page.click('#tourPlay');
    let complete=false;
    for(let round=0;round<6;round++){
      const state=await page.evaluate(()=>{for(let i=0;i<12000&&app.tour;i++){if(document.querySelector('#viewTransition').classList.contains('active'))break;tick(.1);}return {tour:app.tour,transition:document.querySelector('#viewTransition').classList.contains('active'),visited:app.tourVisited.size,total:app.spec.rooms.length};});
      if(!state.tour){assert.equal(state.visited,state.total);complete=true;break;}
      if(state.transition)await page.waitForFunction(()=>!document.querySelector('#viewTransition').classList.contains('active'));
    }
    assert.equal(complete,true,'guided tour visits every room and terminates');
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>app.mode),'exterior');
    await page.selectOption('#lighting','golden');assert.equal(await page.evaluate(()=>scene3d.lighting),'golden');
    await page.screenshot({path:path.join(out,'golden.png')});
    await page.selectOption('#lighting','night');await page.screenshot({path:path.join(out,'evening.png')});
    await page.selectOption('#lighting','day');
    await page.locator('details').nth(2).locator('summary').click();await page.check('#garage');await page.click('#generateBtn');
    await page.waitForFunction(()=>app.spec.garage&&!app.busy);await verifyEstimate(page);
    assert.ok(await page.evaluate(()=>app.model.estimate.groups.garage>0));
    await page.screenshot({path:path.join(out,'garage.png')});
    await clickPricedItem(page,'garageDoor');await page.screenshot({path:path.join(out,'garage-cost.png')});await page.click('#closeInspector');
    await page.click('[data-view=plan]');
    assert.ok(await page.evaluate(()=>{
      const g=app.spec.garage;scene3d.camera.updateMatrixWorld();
      return [-1,1].every(x=>[-1,1].every(z=>{const p=new THREE.Vector3(g.cx+x*g.w/2,.18,g.cz+z*g.d/2).project(scene3d.camera);return Math.abs(p.x)<.95&&Math.abs(p.y)<.95;}));
    }),'garage fits in floor-plan view');
    await page.screenshot({path:path.join(out,'garage-plan.png')});await page.click('[data-view=exterior]');
    await page.click('#openCosts');await page.selectOption('#costCategory','garage');
    assert.ok(await page.locator('#costRows tr').count()>5);await page.click('#closeCosts');
    await page.uncheck('#garage');await page.click('#generateBtn');await page.waitForFunction(()=>!app.spec.garage&&!app.busy);
    assert.equal(await page.evaluate(()=>app.model.estimate.groups.garage),0);await verifyEstimate(page);
    await page.locator('details').nth(2).locator('summary').click();
    const oldArea=await page.evaluate(()=>app.spec.area);
    await page.fill('#budget','100000');await page.click('#generateBtn');assert.equal(await page.locator('#formError').isVisible(),true);assert.equal(await page.evaluate(()=>app.spec.area),oldArea);
    await page.fill('#budget','500000');await page.click('#generateBtn');await page.waitForFunction(()=>app.spec.fd.budget===500000&&!app.busy);
    assert.equal(await page.evaluate(()=>app.spec.formType),'elbow');assert.ok(await page.evaluate(area=>app.spec.area<area,oldArea));
    await page.fill('#budget','900000');await page.click('[data-style=scandinavian]');await page.click('#generateBtn');await page.waitForFunction(()=>app.spec.style==='scandinavian'&&!app.busy);
    assert.equal(await page.evaluate(()=>app.spec.formType),'pavilion');await page.screenshot({path:path.join(out,'nordic.png')});
    await page.selectOption('#purpose','warehouse');await page.click('#generateBtn');await page.waitForFunction(()=>app.spec.purpose==='warehouse'&&!app.busy);
    assert.equal(await page.evaluate(()=>app.spec.formType),'sawtooth');await page.screenshot({path:path.join(out,'warehouse.png')});
    await page.selectOption('#purpose','commercial');await page.click('[data-style=modern]');await page.click('#generateBtn');await page.waitForFunction(()=>app.spec.purpose==='commercial'&&!app.busy);
    assert.equal(await page.evaluate(()=>app.spec.formType),'gallery');
    await page.locator('details').nth(2).locator('summary').click();
    await page.uncheck('input[value=pool]');await page.uncheck('input[value=garden]');
    await page.click('#generateBtn');await page.waitForFunction(()=>app.spec.outdoor.length===0&&!app.busy);
    assert.equal(await page.evaluate(()=>app.model.units.some(u=>u.role==='water')),false);
    await page.click('#backHome');assert.equal(await page.evaluate(()=>app.screen),'home');
    await page.click('#heroTour');assert.equal(await page.evaluate(()=>app.tour),true);await page.click('#exitWalk');
    assert.equal(await page.evaluate(()=>app.route.length),0);
    await page.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const phone=await mobile.newPage();track(phone);await phone.goto(url);await phone.waitForFunction(()=>app.ready,null,{timeout:120000});
    await phone.screenshot({path:path.join(out,'mobile-home.png'),fullPage:true});
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await phone.tap('#heroStart');await phone.screenshot({path:path.join(out,'mobile-studio.png')});
    const footprintFits=()=>{
      scene3d.camera.updateMatrixWorld();
      return app.spec.rooms.every(r=>[r.x0,r.x1].every(x=>[r.z0,r.z1].every(z=>{
        const p=new THREE.Vector3(x,PLINTH+r.floor*FLOOR_H,z).project(scene3d.camera);
        return Math.abs(p.x)<.95&&Math.abs(p.y)<.95;
      })));
    };
    assert.ok(await phone.evaluate(footprintFits),'mobile exterior frames the whole building');
    await phone.tap('[data-view=plan]');await phone.screenshot({path:path.join(out,'mobile-plan.png')});
    assert.ok(await phone.evaluate(footprintFits),'mobile floor plan frames the whole footprint');
    await phone.setViewportSize({width:844,height:390});
    await phone.waitForFunction(()=>Math.abs(scene3d.camera.aspect-scene3d.mount.clientWidth/scene3d.mount.clientHeight)<.001);
    assert.ok(await phone.evaluate(footprintFits),'floor plan reframes after viewport rotation');
    await phone.setViewportSize({width:390,height:844});
    await phone.tap('[data-view=exterior]');
    await phone.tap('#briefToggle');assert.equal(await phone.locator('#briefPanel').isVisible(),true);
    await phone.tap('#briefToggle');assert.equal(await phone.locator('#briefPanel').isVisible(),false);
    await phone.tap('#openCosts');await phone.screenshot({path:path.join(out,'mobile-costs.png')});
    assert.ok(await phone.evaluate(()=>document.querySelector('#costBreakdown').getBoundingClientRect().right<=innerWidth));
    await phone.fill('#costSearch','sofa');await phone.locator('#costRows button').first().tap();
    assert.equal(await phone.locator('#itemInspector').isVisible(),true);await phone.tap('#closeInspector');
    await phone.tap('[data-view=walk]');assert.equal(await phone.locator('#touchPad').isVisible(),true);
    await phone.screenshot({path:path.join(out,'mobile-walk.png')});
    const tapPoint=await clickPricedItem(phone,'coffeeTable');await phone.tap('#closeInspector');
    await phone.touchscreen.tap(tapPoint.x,tapPoint.y);assert.equal(await phone.evaluate(()=>app.selection?.line.id),tapPoint.id);
    await phone.screenshot({path:path.join(out,'mobile-item-cost.png')});await phone.tap('#closeInspector');
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const pos=await phone.evaluate(()=>scene3d.camera.position.toArray());
    const arrow=await phone.locator('[data-move=forward]').boundingBox();
    await phone.mouse.move(arrow.x+arrow.width/2,arrow.y+arrow.height/2);await phone.mouse.down();
    await phone.waitForFunction(p=>scene3d.camera.position.distanceTo(new THREE.Vector3(...p))>.1,pos);
    await phone.mouse.up();
    assert.equal(await phone.evaluate(()=>app.touch.size),0);
    await phone.tap('#exitWalk');assert.equal(await phone.evaluate(()=>app.mode),'exterior');
    assert.deepEqual(errors,[]);
    console.log('PASS: itemized reconciliation, model cost coverage, click/double-click/touch selection, drag suppression, cost filters, garage addition/removal, desktop/mobile navigation, construction, floor plans, manual walking, complete guided tour, styles, categories, budget validation, lighting and outdoor selection.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
