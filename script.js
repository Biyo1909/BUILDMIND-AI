const app = {
  screen:'home', mode:'exterior', style:'modern', spec:null, model:null,
  progress:1, building:false, speed:1, floor:0, room:null,
  yaw:0, pitch:0, tour:false, route:[], dwell:0, tourVisited:new Set(),
  keys:new Set(), touch:new Set(), drag:null, transition:0, toastTimer:null,
  ready:false, busy:false, mapTime:0,
};
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function notify(message) {
  $('#toast').textContent=message; $('#toast').hidden=false;
  clearTimeout(app.toastTimer); app.toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);
}
function readBrief() {
  return {purpose:$('#purpose').value, budget:Number($('#budget').value), location:$('#location').value.trim(), style:app.style,
    luxury:Number($('#luxury').value),width:Number($('#plotWidth').value),depth:Number($('#plotDepth').value),floors:Number($('#floors').value),
    bedrooms:Number($('#bedrooms').value),bathrooms:Number($('#bathrooms').value),garage:$('#garage').checked,outdoor:$$('input[name=outdoor]:checked').map(i=>i.value)};
}
function validateBrief(fd) {
  for(const [key,min,max] of [['budget',100000,50000000],['width',20,120],['depth',24,120],['floors',1,4],['bedrooms',0,10],['bathrooms',0,10],['luxury',1,5]]) {
    if(!Number.isFinite(fd[key])||fd[key]<min||fd[key]>max||!Number.isInteger(fd[key])) throw new Error(`Enter a whole number for ${key} between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
  }
}
function setBusy(busy,message='Preparing your concept') {
  app.busy=busy;$('#generateBtn').disabled=busy;
  if(busy) { $('#loadState').hidden=false;$('#loadState strong').textContent=message; }
  else $('#loadState').hidden=true;
}
function clearInspection() {
  if(app.selection?.box){scene3d.scene.remove(app.selection.box);app.selection.box.geometry.dispose();app.selection.box.material.dispose();}
  app.selection=null;$('#itemInspector').hidden=true;delete document.body.dataset.inspect;
}
function objectVisible(obj) {
  for(let node=obj;node;node=node.parent)if(!node.visible)return false;
  return true;
}
function showInspection(id) {
  const line=app.model.estimate.lines.find(item=>item.id===id);
  if(!line)return;
  clearInspection();stopTour();app.keys.clear();app.touch.clear();app.building=false;updateTimeline();scene3d.controls.autoRotate=false;
  const obj=app.model.costObjects.get(id),visible=obj&&objectVisible(obj);
  const box=visible?new THREE.BoxHelper(obj,0xbb7958):null;
  if(box){box.material.depthTest=false;box.renderOrder=1000;scene3d.scene.add(box);}
  app.selection={line,obj,box};document.body.dataset.inspect='true';
  $('#inspectName').textContent=line.name;$('#inspectLocation').textContent=`${line.id.toUpperCase()} · ${line.location}`;
  $('#inspectTotal').textContent=costMoney(line.totalCents);
  $('#inspectMath').replaceChildren(...[
    ['Quantity',`${costQuantity(line.quantity)} ${line.unit}`],
    ['Supply / unit',costMoney(line.materialRateCents)],['Install / unit',costMoney(line.laborRateCents)],
    ['Materials & products',costMoney(line.materialCents)],['Installation & labor',costMoney(line.laborCents)],
  ].map(([label,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;}));
  $('#inspectNote').textContent=line.note;
  $('#inspectVisibility').textContent=!obj?'Allowance only · not separately modeled.':visible?'Highlighted in the model.':'This item is hidden in the current view or floor.';
  $('#itemInspector').hidden=false;
}
function pickCost(clientX,clientY) {
  if(!app.ready||app.busy||app.screen!=='studio'||$('#costBreakdown').open)return;
  const rect=scene3d.renderer.domElement.getBoundingClientRect();
  if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return;
  const pointer=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();scene3d.scene.updateMatrixWorld(true);scene3d.camera.updateMatrixWorld();ray.setFromCamera(pointer,scene3d.camera);
  const hits=ray.intersectObjects(app.model.units.filter(u=>u.obj.visible).map(u=>u.obj),true);
  const hit=hits.find(h=>objectVisible(h.object));
  if(!hit){clearInspection();return;}
  let node=hit.object;
  while(node&&!node.userData.costId)node=node.parent;
  if(node)showInspection(node.userData.costId);
}
function renderCostRows() {
  if(!app.model)return;
  const query=$('#costSearch').value.trim().toLowerCase(),category=$('#costCategory').value,location=$('#costRoom').value;
  const lines=app.model.estimate.lines.filter(line=>(category==='all'||line.group===category)&&(location==='all'||line.location===location)&&`${line.name} ${line.location} ${line.id}`.toLowerCase().includes(query));
  $('#costRows').replaceChildren(...lines.map(line=>{
    const row=document.createElement('tr'),name=document.createElement('td'),button=document.createElement('button'),meta=document.createElement('small');
    button.textContent=line.name;button.dataset.costId=line.id;button.addEventListener('click',()=>{$('#costBreakdown').close();showInspection(line.id);$('#closeInspector').focus({preventScroll:true});});
    meta.textContent=`${line.id.toUpperCase()} · ${line.location}${line.modeled?'':' · allowance only'}`;name.append(button,meta);row.append(name);
    for(const text of [`${costQuantity(line.quantity)} ${line.unit}`,costMoney(line.materialRateCents),costMoney(line.laborRateCents),costMoney(line.totalCents)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
    return row;
  }));
  $('#costEmpty').hidden=lines.length>0;
  const sum=lines.reduce((total,line)=>total+line.totalCents,0);
  $('#costFilterTotal').textContent=`${lines.length} of ${app.model.estimate.lines.length} items · Shown subtotal ${costMoney(sum)} · Project contingency is not included in this filtered subtotal.`;
}
function updateCostUI() {
  const bill=app.model.estimate;
  for(const [id,cents] of Object.entries({costValue:bill.totalCents,materialsCost:bill.materialCents,installationCost:bill.laborCents,contingencyCost:bill.contingencyCents,billMaterials:bill.materialCents,billLabor:bill.laborCents,billContingency:bill.contingencyCents,billTotal:bill.totalCents}))$('#'+id).textContent=costMoney(cents);
  const delta=Math.round(app.spec.fd.budget*100)-bill.totalCents;
  const balance=`${costMoney(Math.abs(delta))} ${delta<0?'over':'below'} your ${money(app.spec.fd.budget)} target. ${app.spec.garage?'Garage included.':'No garage selected.'}`;
  $('#remainingCost').textContent=balance;$('#budgetBalance').textContent=balance;$('#budgetBalance').classList.toggle('over-budget',delta<0);
  $('#costGroups').replaceChildren(...Object.entries(COST_GROUPS).map(([key,label])=>{const card=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('strong');name.textContent=label;amount.textContent=costMoney(bill.groups[key]);card.append(name,amount);return card;}));
  $('#costCategory').replaceChildren(new Option('All categories','all'),...Object.entries(COST_GROUPS).map(([key,label])=>new Option(label,key)));
  $('#costRoom').replaceChildren(new Option('All locations','all'),...[...new Set(bill.lines.map(line=>line.location))].map(location=>new Option(location,location)));
  $('#costSearch').value='';renderCostRows();
}
function openCostBreakdown() {
  if(!app.ready)return;
  clearInspection();stopTour();app.keys.clear();app.touch.clear();app.building=false;updateTimeline();scene3d.controls.autoRotate=false;
  $('#costDetails').hidden=true;$('#costToggle').setAttribute('aria-expanded','false');renderCostRows();$('#costBreakdown').showModal();
}
async function generate(initial=false) {
  if(app.busy) return;
  let spec;
  try { const fd=readBrief(); validateBrief(fd); spec=buildHouseSpec(fd); }
  catch(error) { $('#formError').textContent=error.message;$('#formError').hidden=false;return; }
  $('#formError').hidden=true;
  setBusy(true);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try {
    clearInspection();$('#costBreakdown').close();stopTour();app.keys.clear();app.touch.clear();app.building=false;
    app.transition++;$('#viewTransition').classList.remove('active');
    app.model=buildHouse(spec);app.spec=spec;app.floor=0;app.room=spec.entry;
    app.progress=1;
    $('#conceptName').textContent=spec.formName;
    $('#heroFormName').textContent=spec.formName;
    $('#conceptMeta').textContent=`${spec.theme.label} · ${spec.floors} ${spec.floors===1?'floor':'floors'}${spec.fd.location?' · '+spec.fd.location:''}`;
    $('#areaValue').textContent=`${Math.round(spec.area)} m²`;
    updateCostUI();
    $('#viewFloor').replaceChildren(...Array.from({length:spec.floors},(_,f)=>new Option(f===0?'Ground floor':`Level ${f+1}`,f)));
    $('#projectStatus').textContent='Concept updated · '+spec.formName;
    $('#briefHint').textContent='Your choices are reflected in this concept.';
    setMode('exterior');
    scene3d.controls.autoRotate=initial&&!reducedMotion;
    scene3d.controls.autoRotateSpeed=.35;
    app.ready=true;
    updateTimeline();
    if(!initial){$('#briefPanel').classList.remove('open');$('#briefToggle').setAttribute('aria-expanded','false');notify(`${spec.formName} · ${Math.round(spec.area)} m². Ready to explore.`);}
  } catch(error) {
    console.error(error);app.ready=false;
    $('#formError').textContent='The 3D scene could not be created. Try a smaller brief or reload the page.';$('#formError').hidden=false;
    $('#loadState strong').textContent='The scene could not be loaded';
    $('#loadState>span:last-child').textContent='Try reloading in a browser with WebGL enabled.';
    app.busy=false;$('#generateBtn').disabled=false;return;
  }
  setBusy(false);
}
function showStudio(tour=false) {
  if(!app.ready){notify('The 3D scene is still loading.');return;}
  app.screen='studio';document.body.dataset.screen='studio';
  $('#homeScreen').hidden=true;$('#studioScreen').hidden=false;
  $('#studioSlot').prepend($('#viewer'));
  scene3d.controls.autoRotate=false;
  window.scrollTo({top:0,behavior:'instant'});
  setMode(tour?'walk':'exterior');
  if(tour)startTour();
}
function showHome() {
  if(!app.ready)return;
  stopTour();setMode('exterior');app.building=false;app.progress=1;applyScene();
  app.screen='home';document.body.dataset.screen='home';
  $('#studioScreen').hidden=true;$('#homeScreen').hidden=false;
  $('#homeSlot').prepend($('#viewer'));scene3d.controls.autoRotate=!reducedMotion;
  $('#briefPanel').classList.remove('open');$('#briefToggle').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'instant'});
}
function setMode(mode) {
  if(!app.spec)return;
  clearInspection();stopTour();app.keys.clear();app.touch.clear();app.drag=null;app.transition++;
  $('#viewTransition').classList.remove('active');app.mode=mode;document.body.dataset.mode=mode;
  if(mode!=='exterior'){app.progress=1;app.building=false;}
  scene3d.controls.autoRotate=false;
  scene3d.controls.enabled=mode==='exterior';
  scene3d.camera.fov=mode==='walk'?70:36;scene3d.camera.updateProjectionMatrix();
  $$('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===mode);b.setAttribute('aria-pressed',String(b.dataset.view===mode));});
  for(const id of ['modelTitle','modelSummary','canvasTools','orbitHint','timelinePanel']) $('#'+id).hidden=mode!=='exterior';
  for(const id of ['floorControls','roomStrip']) $('#'+id).hidden=mode==='exterior';
  for(const id of ['walkHeading','walkMap','walkControls','touchPad']) $('#'+id).hidden=mode!=='walk';
  $('#costDetails').hidden=true;$('#costToggle').setAttribute('aria-expanded','false');
  if(mode==='exterior') { scene3d.camera.up.set(0,1,0);frameCamera(app.spec); }
  else if(mode==='plan')planCamera();
  else {app.room=app.spec.roomPlan[app.floor][0];placeInRoom(app.room);}
  updateRooms();updateLights();updateTimeline();applyScene();
}
function planCamera() {
  const {camera}=scene3d;
  camera.aspect=scene3d.mount.clientWidth/scene3d.mount.clientHeight;camera.updateProjectionMatrix();
  const garage=app.floor===0?app.spec.garage:null,minX=-app.spec.W/2,maxX=garage?Math.max(app.spec.W/2,garage.cx+garage.w/2+.15):app.spec.W/2;
  const cx=(minX+maxX)/2,height=Math.max((maxX-minX)/camera.aspect,app.spec.D)/Math.tan(THREE.MathUtils.degToRad(18))*.62;
  camera.position.set(cx,PLINTH+app.floor*FLOOR_H+height,0);
  camera.up.set(0,0,-1);camera.lookAt(cx,PLINTH+app.floor*FLOOR_H,0);
}
function updateLights() {
  if(!app.model)return;
  app.model.lights.forEach((l,i)=>{
    l.visible=app.mode==='walk'?l.userData.floor===app.floor:scene3d.lighting!=='day'&&i<4;
    l.intensity=app.mode==='walk'?.9:.6;
  });
}
function applyScene() {
  if(!app.model)return;
  const n=app.model.units.length;
  app.model.units.forEach((u,i)=>{
    const phase=PHASE_KEYS.indexOf(u.phase), amount=app.progress*8-phase;
    const siblings=app.phaseCounts?.[phase]||n;
    const p=app.progress>=1?1:clamp((amount-(u.phaseIndex||0)/siblings*.76)/.24,0,1);
    u.obj.visible=p>0;
    u.obj.position.copy(u.base);
    u.obj.scale.copy(u.scale);
    if(p>0&&p<1) {
      const t=ease.outCubic(p);u.obj.scale.multiplyScalar(Math.max(.01,t));
      u.obj.position.y+=reducedMotion?0:(1-t)*1.4;
    }
    if(app.mode==='plan') {
      u.obj.visible=u.floor===app.floor&&u.phase!=='roof'&&u.phase!=='site'&&(u.role!=='exterior'||u.phase==='walls')&&u.role!=='glazing'&&u.role!=='light';
      if(u.phase==='walls'||u.role==='partition')u.obj.scale.y*=.14;
    }
  });
}
function prepareTimeline() {
  app.phaseCounts=PHASES.map(()=>0);
  app.model.units.forEach(u=>{const p=PHASE_KEYS.indexOf(u.phase);u.phaseIndex=app.phaseCounts[p]++;});
}
function updateTimeline() {
  $('#timeline').value=Math.round(app.progress*1000);
  const phase=Math.min(7,Math.floor(app.progress*8));
  $('#phaseLabel').textContent=app.progress>=1?'Your concept, complete.':`${PHASES[phase].name} · ${Math.round(app.progress*100)}%`;
  $('#pauseBuild').hidden=app.progress>=1;
  $('#pauseBuild').textContent=app.building?'Pause':'Resume';
  $('#replay').hidden=app.progress<1;
  $$('#phaseMarkers button').forEach((b,i)=>b.classList.toggle('active',i<=phase));
}
function watchBuild() {
  setMode('exterior');prepareTimeline();app.progress=0;app.building=true;applyScene();updateTimeline();
}
function updateRooms() {
  $('#viewFloor').value=app.floor;
  $('#roomStrip').replaceChildren(...app.spec.roomPlan[app.floor].map((r,i)=>{
    const b=document.createElement('button'),n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');
    b.append(n,document.createTextNode(r.label));b.dataset.room=r.id;b.classList.toggle('selected',app.room?.id===r.id);
    b.addEventListener('click',()=>{
      if(app.mode==='plan'){setMode('walk');changeRoom(r,true);}
      else {stopTour();changeRoom(r);}
    });
    return b;
  }));
  renderMap();
}
function placeInRoom(r) {
  app.room=r;app.floor=r.floor;
  scene3d.camera.up.set(0,1,0);
  scene3d.camera.position.set(r.cx,PLINTH+r.floor*FLOOR_H+1.65,r.cz);
  app.yaw=-Math.PI*.72;app.pitch=-.06;lookAround();roomUI();
}
function roomUI() {
  $('#roomName').textContent=app.room.label;$('#viewFloor').value=app.floor;
  $$('#roomStrip button').forEach(b=>b.classList.toggle('selected',b.dataset.room===app.room.id));
}
function lookAround() {
  scene3d.camera.quaternion.setFromEuler(new THREE.Euler(app.pitch,app.yaw,0,'YXZ'));
}
function transitionRoom(r) {
  clearInspection();
  const token=++app.transition;
  $('#viewTransition').classList.add('active');app.route=[];
  setTimeout(()=>{
    if(token!==app.transition||app.mode!=='walk')return;
    placeInRoom(r);updateRooms();updateLights();applyScene();
    $('#viewTransition').classList.remove('active');
    app.dwell=0;
  },230);
}
function changeRoom(r,immediate=false) {
  if(r.floor!==app.floor||immediate) {transitionRoom(r);return;}
  const path=roomPath(app.spec,app.room.id,r.id);
  if(!path.length){notify('Use the floor selector to change levels.');return;}
  const pos=scene3d.camera.position;
  if(Math.hypot(pos.x-app.room.cx,pos.z-app.room.cz)>.15) {
    placeInRoom(app.room);
  }
  app.route=path.slice(1).map(room=>({room,point:new THREE.Vector3(room.cx,PLINTH+room.floor*FLOOR_H+1.65,room.cz)}));
  app.dwell=0;app.destination=r;
}
function nextRoom(direction=1) {
  const list=app.spec.rooms,idx=list.indexOf(app.room);
  changeRoom(list[(idx+direction+list.length)%list.length]);
}
function startTour() {
  clearInspection();
  if(app.mode!=='walk')setMode('walk');
  app.tour=true;app.tourVisited=new Set([app.room.id]);app.dwell=0;app.route=[];placeInRoom(app.room);
  $('#tourPlay span').textContent='Pause guided tour';$('#walkStatus').textContent='Guided tour · every room, every floor';
}
function stopTour() {
  app.tour=false;app.route=[];app.dwell=0;
  $('#tourPlay span').textContent='Start guided tour';$('#walkStatus').textContent='Drag to look · Click an item for cost';
}
function nextTourRoom() {
  const sameFloor=app.spec.roomPlan[app.floor].filter(r=>!app.tourVisited.has(r.id));
  const target=sameFloor.sort((a,b)=>roomPath(app.spec,app.room.id,a.id).length-roomPath(app.spec,app.room.id,b.id).length)[0]
    ||app.spec.rooms.find(r=>!app.tourVisited.has(r.id));
  if(!target){stopTour();notify('Tour complete. You’ve explored every room.');return;}
  app.tourVisited.add(target.id);changeRoom(target);
}
function walkable(x,z) {
  const radius=.18, rooms=app.spec.roomPlan[app.floor];
  const room=rooms.find(r=>x>r.x0+radius&&x<r.x1-radius&&z>r.z0+radius&&z<r.z1-radius);
  if(!room) {
    const opening=rooms.some(r=>r.neighbors.some(id=>{
      const n=findRoom(app.spec,id);
      if(r.gx===n.gx) return Math.abs(x-r.cx)<.57&&z>Math.min(r.cz,n.cz)&&z<Math.max(r.cz,n.cz);
      return Math.abs(z-r.cz)<.57&&x>Math.min(r.cx,n.cx)&&x<Math.max(r.cx,n.cx);
    }));
    if(!opening)return false;
  }
  return !app.model.colliders.some(c=>c.floor===app.floor&&x>c.box.min.x-radius&&x<c.box.max.x+radius&&z>c.box.min.z-radius&&z<c.box.max.z+radius);
}
function moveWalk(dx,dz) {
  const p=scene3d.camera.position;
  if(walkable(p.x+dx,p.z))p.x+=dx;
  if(walkable(p.x,p.z+dz))p.z+=dz;
  const r=app.spec.roomPlan[app.floor].find(r=>p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1);
  if(r&&r!==app.room){app.room=r;roomUI();}
}
function renderMap() {
  if(!app.spec)return;
  const scale=150/Math.max(app.spec.W,app.spec.D),p=scene3d.camera.position;
  const rects=app.spec.roomPlan[app.floor].map(r=>`<rect x="${90+r.x0*scale}" y="${90+r.z0*scale}" width="${app.spec.cw*scale-2}" height="${app.spec.cd*scale-2}" rx="2" fill="${r===app.room?'#bccaac':'#e1e5d7'}" stroke="#9eac8e" stroke-width="1"/>`).join('');
  const x=90+p.x*scale,y=90+p.z*scale;
  $('#miniPlan').innerHTML=rects+`<path d="M ${x} ${y} l ${-Math.sin(app.yaw)*10} ${-Math.cos(app.yaw)*10}" stroke="#a76947" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3.5" fill="#a76947" stroke="#fff" stroke-width="1.5"/>`;
}
function tick(dt) {
  if(!app.ready||app.busy||$('#costBreakdown').open)return;
  if(app.building){app.progress=Math.min(1,app.progress+dt/36*app.speed);if(app.progress===1)app.building=false;applyScene();updateTimeline();}
  if(app.mode!=='walk')return;
  if(app.route.length) {
    const target=app.route[0],p=scene3d.camera.position,delta=target.point.clone().sub(p),dist=delta.length();
    if(dist<.06){p.copy(target.point);app.room=target.room;roomUI();app.route.shift();app.dwell=0;}
    else {
      const desired=Math.atan2(-delta.x,-delta.z),difference=Math.atan2(Math.sin(desired-app.yaw),Math.cos(desired-app.yaw));
      app.yaw+=difference*Math.min(1,dt*3);app.pitch=lerp(app.pitch,-.02,dt*2);
      p.addScaledVector(delta.normalize(),Math.min(dist,dt*1.8));
      const r=app.spec.roomPlan[app.floor].find(r=>p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1);
      if(r&&r!==app.room){app.room=r;roomUI();}
    }
  } else if(app.tour) {
    app.dwell+=dt;app.yaw+=dt*.27;
    if(app.dwell>5.5)nextTourRoom();
  } else {
    const forward=Number(app.keys.has('w')||app.keys.has('arrowup')||app.touch.has('forward'))-Number(app.keys.has('s')||app.keys.has('arrowdown')||app.touch.has('back'));
    const side=Number(app.keys.has('d')||app.keys.has('arrowright')||app.touch.has('right'))-Number(app.keys.has('a')||app.keys.has('arrowleft')||app.touch.has('left'));
    if(forward||side){const speed=dt*2.3/(forward&&side?Math.SQRT2:1);moveWalk((-Math.sin(app.yaw)*forward+Math.cos(app.yaw)*side)*speed,(-Math.cos(app.yaw)*forward-Math.sin(app.yaw)*side)*speed);}
  }
  lookAround();app.mapTime+=dt;
  if(app.mapTime>.12){renderMap();app.mapTime=0;}
}

$('#briefForm').addEventListener('submit',e=>{e.preventDefault();generate();});
$('#briefForm').addEventListener('input',()=>{
  $('#briefHint').textContent='Unapplied changes · generate to update';
  $('#finishLabel').textContent=['','Essential','Refined','Considered','Premium','Exceptional'][$('#luxury').value];
  const home=['residential','vacation'].includes($('#purpose').value);$('#homeRooms').hidden=!home;
});
$$('[data-style]').forEach(b=>b.addEventListener('click',()=>{
  app.style=b.dataset.style;$$('[data-style]').forEach(t=>{t.classList.toggle('selected',t===b);t.setAttribute('aria-pressed',String(t===b));});
  $('#briefHint').textContent='Unapplied changes · generate to update';
}));
['navStart','heroStart','navExplore'].forEach(id=>$('#'+id).addEventListener('click',()=>showStudio()));
$('#heroTour').addEventListener('click',()=>showStudio(true));
['brandHome','backHome'].forEach(id=>$('#'+id).addEventListener('click',showHome));
$('#briefToggle').addEventListener('click',()=>{const open=$('#briefPanel').classList.toggle('open');$('#briefToggle').setAttribute('aria-expanded',String(open));});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.view)));
$('#lighting').addEventListener('change',()=>{setLighting($('#lighting').value);updateLights();});
$('#resetCamera').addEventListener('click',()=>{scene3d.controls.autoRotate=false;frameCamera(app.spec);});
['heroRotate','autoRotate'].forEach(id=>$('#'+id).addEventListener('click',()=>{scene3d.controls.autoRotate=!scene3d.controls.autoRotate;$('#autoRotate').classList.toggle('selected',scene3d.controls.autoRotate);}));
for(const [id,factor] of [['zoomIn',.85],['zoomOut',1.18]]) $('#'+id).addEventListener('click',()=>{
  const {camera,controls}=scene3d,delta=camera.position.clone().sub(controls.target),distance=clamp(delta.length()*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(delta.setLength(distance));controls.update();
});
$('#costToggle').addEventListener('click',()=>{const open=$('#costDetails').hidden;$('#costDetails').hidden=!open;$('#costToggle').setAttribute('aria-expanded',String(open));});
$('#viewFloor').addEventListener('change',()=>{
  clearInspection();
  const floor=Number($('#viewFloor').value);
  if(app.mode==='walk'){stopTour();transitionRoom(app.spec.roomPlan[floor][0]);}
  else {app.floor=floor;app.room=app.spec.roomPlan[floor][0];planCamera();applyScene();updateRooms();}
});
$('#tourPlay').addEventListener('click',()=>app.tour?stopTour():startTour());
$('#nextRoom').addEventListener('click',()=>{stopTour();nextRoom(1);});
$('#previousRoom').addEventListener('click',()=>{stopTour();nextRoom(-1);});
$('#exitWalk').addEventListener('click',()=>setMode('exterior'));
$('#replay').addEventListener('click',watchBuild);
$('#pauseBuild').addEventListener('click',()=>{app.building=!app.building;updateTimeline();});
$('#speed').addEventListener('change',()=>app.speed=Number($('#speed').value));
$('#timeline').addEventListener('input',()=>{clearInspection();prepareTimeline();app.progress=Number($('#timeline').value)/1000;app.building=false;applyScene();updateTimeline();});
$('#phaseMarkers').replaceChildren(...PHASES.map((p,i)=>{
  const b=document.createElement('button');b.textContent=p.name;b.title=p.desc;
  b.addEventListener('click',()=>{prepareTimeline();app.progress=(i+1)/8;app.building=false;applyScene();updateTimeline();});return b;
}));
for(const id of ['openCosts','fullCostOpen','inspectAllCosts'])$('#'+id).addEventListener('click',openCostBreakdown);
$('#closeCosts').addEventListener('click',()=>$('#costBreakdown').close());
$('#closeInspector').addEventListener('click',()=>{clearInspection();mount.focus({preventScroll:true});});
for(const id of ['costSearch','costCategory','costRoom'])$('#'+id).addEventListener('input',renderCostRows);
const mount=$('#renderMount'),pickPointers=new Set();
let pickGesture=null;
mount.addEventListener('pointerdown',e=>{
  pickPointers.add(e.pointerId);
  if(pickPointers.size===1&&e.button===0)pickGesture={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};
  else pickGesture=null;
  if(app.mode!=='walk')return;
  stopTour();mount.focus({preventScroll:true});app.drag={x:e.clientX,y:e.clientY,id:e.pointerId};mount.setPointerCapture(e.pointerId);
});
mount.addEventListener('pointermove',e=>{
  if(pickGesture&&Math.hypot(e.clientX-pickGesture.x,e.clientY-pickGesture.y)>7)pickGesture.moved=true;
  if(app.mode!=='walk'||!app.drag||app.drag.id!==e.pointerId)return;
  app.yaw-=(e.clientX-app.drag.x)*.004;app.pitch=clamp(app.pitch-(e.clientY-app.drag.y)*.003,-1.1,1.1);
  app.drag.x=e.clientX;app.drag.y=e.clientY;
});
mount.addEventListener('pointerup',e=>{
  if(pickGesture?.id===e.pointerId&&!pickGesture.moved&&pickPointers.size===1)pickCost(e.clientX,e.clientY);
  pickPointers.delete(e.pointerId);pickGesture=null;app.drag=null;
},true);
mount.addEventListener('pointercancel',e=>{pickPointers.delete(e.pointerId);pickGesture=null;app.drag=null;});
mount.addEventListener('lostpointercapture',e=>{pickPointers.delete(e.pointerId);app.drag=null;});
window.addEventListener('keydown',e=>{
  if(app.screen!=='studio')return;
  if($('#costBreakdown').open)return;
  if(e.key==='Escape'){
    if(app.selection){clearInspection();return;}
    if(app.mode==='walk')setMode('exterior');$('#briefPanel').classList.remove('open');$('#briefToggle').setAttribute('aria-expanded','false');return;
  }
  if(app.mode!=='walk'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();if(app.tour||app.route.length)stopTour();app.keys.add(key);}
});
window.addEventListener('keyup',e=>app.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{app.keys.clear();app.touch.clear();app.drag=null;});
document.addEventListener('visibilitychange',()=>{app.keys.clear();app.touch.clear();});
$$('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();stopTour();app.touch.add(b.dataset.move);b.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>app.touch.delete(b.dataset.move));
});
async function boot() {
  try {
    if(typeof THREE==='undefined')throw new Error('The rendering library did not load.');
    initRenderer(mount,{interactive:true,pixelRatio:Math.min(devicePixelRatio||1,1.5),onResize:()=>{
      if(!app.spec)return;
      if(app.mode==='exterior')frameCamera(app.spec);
      else if(app.mode==='plan')planCamera();
    }});
    scene3d.hooks.push(tick);
    scene3d.renderer.domElement.addEventListener('webglcontextlost',e=>{
      e.preventDefault();app.ready=false;app.building=false;stopTour();
      $('#loadState').hidden=false;$('#loadState strong').textContent='The 3D view was interrupted';
      $('#loadState>span:last-child').textContent='Reload this page to restore the scene.';
    });
    await generate(true);
  } catch(error) {
    console.error(error);$('#loadState strong').textContent='3D rendering is unavailable';
    $('#loadState>span:last-child').textContent='Enable hardware acceleration or try another WebGL-capable browser.';
  }
}
boot();
