const _box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
const _at = (o,x,y,z) => { o.position.set(x,y,z); return o; };
const _grp = (...children) => { const g=new THREE.Group(); g.add(...children); return g; };
function clearHouse() {
  if(scene3d.groups) Object.values(scene3d.groups).forEach(g=>{ scene3d.scene.remove(g); disposeObject(g); });
  scene3d.extras.forEach(g=>{ scene3d.scene.remove(g); disposeObject(g); });
  scene3d.interiorLights.forEach(l=>scene3d.scene.remove(l));
  scene3d.groups=null; scene3d.extras=[]; scene3d.interiorLights=[];
}
function buildHouse(spec) {
  clearHouse();
  const M=MatLib, T=spec.theme, units=[], groups={}, colliders=[], lights=[];
  PHASE_KEYS.forEach(k=>{ groups[k]=new THREE.Group(); scene3d.scene.add(groups[k]); });
  const add=(phase,obj,floor=0,role='solid',label='')=>{
    obj.traverse(m=>{ if(m.isMesh){ m.castShadow=role!=='glass'; m.receiveShadow=true; } });
    groups[phase].add(obj);
    units.push({obj,phase,floor,role,label,base:obj.position.clone(),scale:obj.scale.clone()});
    return obj;
  };
  const wall=M.get(T.wall.kind,T.wall.color,[2,1]), timber=M.get(T.wing.kind,T.wing.color,[2,1]);
  const concrete=M.get('concrete',0xb7b3a5,[2,2]), trim=M.plain(T.trim,{roughness:.5,metalness:.25});
  const roofMat=M.get('gravel',T.roof,[2,2]), plaster=M.get('plaster',0xf1eee4,[2,1]);
  const wood=M.get('woodPlank',spec.style==='scandinavian'?0xc6aa7e:0xa17d54,[2,2]);
  const stone=M.get('marble',0xe9e3d5,[2,2]);
  const glass=M.plain(0xadc9c4,{transparent:true,opacity:.24,roughness:.15,metalness:.2,depthWrite:false,side:THREE.DoubleSide});
  const metal=M.plain(T.frame,{roughness:.35,metalness:.6}), glow=M.lampGlow();
  const floorY=f=>PLINTH+f*FLOOR_H;
  const neighbor=(r,dx,dz,f=r.floor)=>spec.roomPlan[f]?.find(n=>n.gx===r.gx+dx&&n.gz===r.gz+dz);
  const slab=(r,phase,y,mat,thickness=.18,over=0,role='slab')=>add(phase,_at(_box(spec.cw+over,thickness,spec.cd+over,mat),r.cx,y,r.cz),r.floor,role);
  function wallRun(r,side,shared) {
    const horizontal=side==='front'||side==='back', len=horizontal?spec.cw:spec.cd;
    const x=side==='left'?r.x0:side==='right'?r.x1:r.cx;
    const z=side==='front'?r.z0:side==='back'?r.z1:r.cz;
    const y=floorY(r.floor), entry=r===spec.entry&&side==='front';
    const opening=shared||entry?1.55:len*.64;
    const bottom=shared||entry?0:.55, top=shared||entry?2.55:2.85;
    const mat=shared?plaster:(r.gx+r.gz)%3===0?timber:wall;
    const phase=shared?'interior':'walls', role=shared?'partition':'exterior';
    const g=new THREE.Group(); g.position.set(x,y,z); if(!horizontal) g.rotation.y=Math.PI/2;
    const pier=(len-opening)/2;
    g.add(_at(_box(pier,FLOOR_H,.2,mat),-len/2+pier/2,FLOOR_H/2,0),_at(_box(pier,FLOOR_H,.2,mat),len/2-pier/2,FLOOR_H/2,0));
    g.add(_at(_box(opening,FLOOR_H-top,.2,mat),0,top+(FLOOR_H-top)/2,0));
    if(bottom) g.add(_at(_box(opening,bottom,.2,mat),0,bottom/2,0));
    add(phase,g,r.floor,role);
    if(!shared&&!entry) {
      const w=new THREE.Group(); w.position.copy(g.position); w.rotation.copy(g.rotation);
      const h=top-bottom;
      w.add(_at(_box(opening,h,.025,glass),0,bottom+h/2,0));
      for(const xx of [-opening/2,0,opening/2]) w.add(_at(_box(.045,h,.085,metal),xx,bottom+h/2,0));
      for(const yy of [bottom,top]) w.add(_at(_box(opening+.08,.05,.085,metal),0,yy,0));
      add('fixtures',w,r.floor,'glazing');
      if((spec.style==='luxury'||spec.style==='futuristic')&&side==='front') {
        for(let i=0;i<4;i++) add('fixtures',_at(_box(.045,2.8,.35,metal),x-len*.45+i*.16,y+1.5,z-.2),r.floor,'exterior');
      }
    }
    if(shared) {
      const frame=new THREE.Group(); frame.position.copy(g.position); frame.rotation.copy(g.rotation);
      for(const xx of [-opening/2,opening/2]) frame.add(_at(_box(.055,2.55,.24,timber),xx,1.275,0));
      frame.add(_at(_box(opening+.1,.06,.24,timber),0,2.57,0));
      add('interior',frame,r.floor,'partition');
    }
  }
  spec.rooms.forEach(r=>{
    const y=floorY(r.floor);
    slab(r,r.floor?'frame':'foundation',y-.09,concrete);
    slab(r,'interior',y+.012,r.isBathroom||r.type==='kitchen'?stone:wood,.025,-.15,'finish');
    for(const [dx,dz,side] of [[0,-1,'front'],[0,1,'back'],[-1,0,'left'],[1,0,'right']]) {
      const n=neighbor(r,dx,dz);
      if(!n||r.id<n.id) wallRun(r,side,!!n);
      if(!n) {
        const horizontal=!dx;
        add('frame',_at(_box(horizontal?spec.cw:.16,.18,horizontal?.16:spec.cd,trim),r.cx+dx*spec.cw/2,y+FLOOR_H-.08,r.cz+dz*spec.cd/2),r.floor,'exterior');
      }
    }
    for(const [sx,sz] of [[-1,-1],[1,1]]) add('frame',_at(_box(.16,FLOOR_H,.16,concrete),r.cx+sx*(spec.cw/2-.12),y+FLOOR_H/2,r.cz+sz*(spec.cd/2-.12)),r.floor,'exterior');
    const above=neighbor(r,0,0,r.floor+1);
    if(!above) {
      const pitched=spec.style==='scandinavian'||spec.formType==='pavilion'||spec.formType==='sawtooth';
      const ry=y+FLOOR_H;
      slab(r,'roof',ry+.06,plaster,.12,.25,'roof');
      if(pitched) {
        const angle=spec.formType==='sawtooth'?.22:.43;
        const half=spec.cw/2+.22, height=Math.tan(angle)*half;
        const material=M.get('metal',T.roof,[2,2],{side:THREE.DoubleSide});
        for(const s of [-1,1]) {
          const p=_at(_box(half/Math.cos(angle),.12,spec.cd+.55,material),r.cx+s*half/2,ry+.1+height/2,r.cz);
          p.rotation.z=-s*angle; add('roof',p,r.floor,'roof');
        }
        const shape=new THREE.Shape(); shape.moveTo(-spec.cw/2,0);shape.lineTo(spec.cw/2,0);shape.lineTo(0,height);shape.closePath();
        for(const zz of [r.z0,r.z1]) add('roof',_at(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),timber),r.cx,ry+.1,zz),r.floor,'roof');
      } else {
        slab(r,'roof',ry+.15,roofMat,.16,.4,'roof');
        for(const [dx,dz] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          if(neighbor(r,dx,dz)&&!neighbor(r,dx,dz,r.floor+1)) continue;
          const horizontal=!dx;
          add('roof',_at(_box(horizontal?spec.cw+.4:.12,.34,horizontal?.12:spec.cd+.4,wall),r.cx+dx*(spec.cw/2+.13),ry+.35,r.cz+dz*(spec.cd/2+.13)),r.floor,'roof');
        }
        if(spec.style==='futuristic') {
          const canopy=_at(_box(spec.cw+.8,.14,spec.cd*.6,wall),r.cx,ry+.85,r.cz);
          canopy.rotation.z=(r.gx%2?1:-1)*.12; add('roof',canopy,r.floor,'roof');
        }
      }
      if(r.floor<spec.floors-1) {
        slab(r,'roof',ry+.25,wood,.06,-.4,'roof');
        for(const side of [-1,1]) add('roof',_at(_box(spec.cw, .95,.035,glass),r.cx,ry+.78,r.cz+side*spec.cd/2),r.floor,'roof');
      }
    }
  });
  const e=spec.entry;
  add('fixtures',_at(_box(2.6,.14,1.7,timber),e.cx,PLINTH+2.95,e.z0-.65),0,'exterior');
  for(const x of [-1,1]) add('fixtures',_at(_box(.12,.5,.12,glow),e.cx+x*1.03,PLINTH+1.9,e.z0-.18),0,'exterior');
  add('foundation',_at(_box(2.5,.14,1.2,concrete),e.cx,.07,e.z0-.65),0,'site');

  const factory=createFurnitureFactory(spec), mk=factory.make;
  function staged(r,obj,qx,qz,label) {
    const bb=new THREE.Box3().setFromObject(obj), size=bb.getSize(new THREE.Vector3());
    const zw=spec.cw/2-.85, zd=spec.cd/2-.85;
    const scale=Math.min(1,zw/Math.max(.1,size.x),zd/Math.max(.1,size.z));
    obj.scale.setScalar(scale); bb.setFromObject(obj); const center=bb.getCenter(new THREE.Vector3());
    obj.position.set(r.cx+qx*(spec.cw/4+.28)-center.x,floorY(r.floor)+.028-bb.min.y,r.cz+qz*(spec.cd/4+.28)-center.z);
    add('furniture',obj,r.floor,'furniture',label);
    obj.updateMatrixWorld(true);
    obj.traverse(m=>{
      if(!m.isMesh) return;
      const b=new THREE.Box3().setFromObject(m);
      if(b.max.y>floorY(r.floor)+.25&&b.min.y<floorY(r.floor)+1.8) colliders.push({floor:r.floor,box:b});
    });
  }
  spec.rooms.forEach(r=>{
    if(r.type==='living') {
      staged(r,mk.sofa(2.5),-1,1,'Upholstered sofa');
      staged(r,_grp(mk.coffeeTable(),_at(mk.armchair(),1.25,0,.2)),1,1,'Lounge seating');
      staged(r,mk.mediaWall(2.3),-1,-1,'Media wall');
      staged(r,_grp(mk.diningTable(1.5),_at(mk.chair(),0,0,.9),_at(mk.chair(),0,0,-.9)),1,-1,'Dining setting');
    } else if(r.type==='bedroom') {
      staged(r,_grp(mk.bed(1.8),_at(mk.nightstand(),1.28,0,-.8)),1,1,'Bed & bedside lamp');
      staged(r,mk.wardrobe(2.2),-1,1,'Wardrobe');
      staged(r,_grp(mk.armchair(),_at(mk.floorLamp(),.8,0,0)),1,-1,'Reading corner');
      staged(r,mk.dresser(),-1,-1,'Dresser');
    } else if(r.type==='kitchen') {
      staged(r,mk.kitchenRun(2.7),-1,1,'Kitchen cabinetry');
      staged(r,_grp(mk.island(1.8),_at(mk.barStool(),0,0,.8)),1,1,'Island & stool');
      staged(r,mk.fridge(),-1,-1,'Refrigerator');
      staged(r,_grp(mk.diningTable(1.5),_at(mk.chair(),0,0,.85)),1,-1,'Breakfast table');
    } else if(r.isBathroom) {
      staged(r,mk.vanity(1.4),-1,1,'Vanity'); staged(r,mk.tub(),1,1,'Freestanding bath');
      staged(r,mk.shower(),-1,-1,'Shower'); staged(r,mk.toilet(),1,-1,'WC');
    } else if(r.type==='warehouse') {
      for(const x of [-1,1]) for(const z of [-1,1]) staged(r,mk.rack(2.7),x,z,'Storage racks');
    } else {
      for(const x of [-1,1]) staged(r,_grp(mk.desk(),_at(mk.officeChair(),0,0,.75)),x,1,'Desk & task chair');
      staged(r,mk.bookshelf(1.5),-1,-1,'Bookshelf'); staged(r,mk.armchair(),1,-1,'Lounge chair');
    }
    const pendant=mk.pendant(.35,.18); pendant.position.set(r.cx,floorY(r.floor),r.cz);
    add('furniture',pendant,r.floor,'light');
    const plant=mk.plant(.85); plant.position.set(r.x0+.4,floorY(r.floor),r.z1-.4); add('furniture',plant,r.floor,'decor');
    const light=new THREE.PointLight(0xffe1b3,.75,Math.max(spec.cw,spec.cd)*1.6,2);
    light.position.set(r.cx,floorY(r.floor)+2.8,r.cz); light.userData={base:.65,floor:r.floor};
    scene3d.scene.add(light); lights.push(light);
  });

  const B=spec.bounds, plotW=B.maxX-B.minX, plotD=B.maxZ-B.minZ;
  const landscape=M.get('grass',0x7b8660,[10,10]), paving=M.get('travertine',0xd5cdb7,[4,3]);
  add('site',_at(_box(plotW,.12,plotD,landscape),0,-.1,(B.minZ+B.maxZ)/2),0,'landscape');
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) add('site',_at(_box(dx?.12:plotW,.1,dz?.12:plotD,concrete),dx*plotW/2,-.01,(B.minZ+B.maxZ)/2+dz*plotD/2),0,'landscape');
  const pathD=e.z0-B.minZ;
  add('site',_at(_box(2.2,.04,pathD,paving),e.cx,.015,B.minZ+pathD/2),0,'landscape');
  const occupied=new Set(spec.roomPlan[0].map(r=>`${r.gx},${r.gz}`));
  for(let x=0;x<3;x++) for(let z=0;z<3;z++) if(!occupied.has(`${x},${z}`)) {
    add('site',_at(_box(spec.cw-.3,.04,spec.cd-.3,paving),(x-1)*spec.cw,.012,(z-1)*spec.cd),0,'landscape');
    if(spec.outdoor.includes('garden')) {
      add('site',_at(_box(1.6,.3,1.6,concrete),(x-1)*spec.cw,.15,(z-1)*spec.cd),0,'landscape');
      add('site',_at(makeTree(3.6),(x-1)*spec.cw,.3,(z-1)*spec.cd),0,'landscape');
    }
  }
  if(spec.outdoor.includes('pool')) {
    const w=Math.min(8,plotW*.4), d=3.1, z=spec.D/2+3.8;
    add('site',_at(_box(w+1.5,.08,d+1.5,paving),0,.04,z),0,'landscape');
    add('site',_at(_box(w,.04,d,M.water()),0,.09,z),0,'water');
    for(const x of [-w/3,w/3]) {
      const chair=mk.loungeChair();chair.rotation.y=Math.PI;chair.position.set(x,.08,z+d/2+1);
      add('site',chair,0,'landscape');
    }
  }
  if(spec.outdoor.includes('terrace')) {
    add('site',_at(_box(spec.cw,.13,2.3,wood),0,.04,spec.D/2+1.3),0,'landscape');
    const dining=mk.diningTable(1.8);dining.position.set(0,.11,spec.D/2+1.3);add('site',dining,0,'landscape');
  }
  if(spec.outdoor.includes('garden')) {
    for(const side of [-1,1]) for(let i=0;i<3;i++) {
      add('site',_at(makeTree(3.2+i*.4),side*(plotW/2-1.1),0,B.minZ+3+i*(plotD-6)/3),0,'landscape');
    }
  }
  scene3d.groups=groups; scene3d.spec=spec;scene3d.interiorLights=lights;
  scene3d.scene.updateMatrixWorld(true);
  units.sort((a,b)=>PHASE_KEYS.indexOf(a.phase)-PHASE_KEYS.indexOf(b.phase)||a.floor-b.floor);
  setLighting(scene3d.lighting);
  return {units,groups,colliders,lights};
}
function makeTree(h) {
  const trunk=MatLib.plain(0x716049),leaf=MatLib.plain(0x6f7e4f,{roughness:.95});
  const g=new THREE.Group();
  g.add(_at(new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,h*.7,8),trunk),0,h*.35,0));
  for(let i=0;i<5;i++) {
    const a=i*2.4;
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.23,2),leaf);
    crown.scale.set(1,.85,1);crown.position.set(Math.cos(a)*h*.13,h*.65+(i%2)*h*.14,Math.sin(a)*h*.13);g.add(crown);
  }
  return g;
}
