/* ============================================================
   BuildMind AI — house builder: turns a spec into phased 3D units
   ============================================================ */

const MAT_INFO = {
  footing:      { name: 'Reinforced concrete footing', unit: 'm³', unitCost: 165 },
  concrete:     { name: 'Ground-bearing slab', unit: 'm³', unitCost: 145 },
  column:       { name: 'RC column', unit: 'pcs', unitCost: 280 },
  floor_slab:   { name: 'Suspended floor slab', unit: 'pcs', unitCost: 1450 },
  brick:        { name: 'Blockwork wall panel', unit: 'pcs', unitCost: 210 },
  cladding:     { name: 'Façade cladding panel', unit: 'pcs', unitCost: 260 },
  trim:         { name: 'Floor-edge trim band', unit: 'pcs', unitCost: 120 },
  roof_deck:    { name: 'Roof deck & waterproofing', unit: 'pcs', unitCost: 1650 },
  roof_tile:    { name: 'Roof covering panel', unit: 'pcs', unitCost: 420 },
  roof_ridge:   { name: 'Ridge / coping', unit: 'pcs', unitCost: 95 },
  parapet:      { name: 'Parapet wall', unit: 'pcs', unitCost: 180 },
  solar:        { name: 'Solar PV module (410 W)', unit: 'pcs', unitCost: 190 },
  door:         { name: 'Entrance door set', unit: 'pcs', unitCost: 1850 },
  garage_door:  { name: 'Insulated sectional garage door', unit: 'pcs', unitCost: 1400 },
  window:       { name: 'Double-glazed window unit', unit: 'pcs', unitCost: 540 },
  balcony:      { name: 'Balcony slab & glass balustrade', unit: 'pcs', unitCost: 2100 },
  light:        { name: 'Exterior light fitting', unit: 'pcs', unitCost: 65 },
  partition:    { name: 'Interior partition wall', unit: 'pcs', unitCost: 160 },
  floor_finish: { name: 'Floor finish', unit: 'm²', unitCost: 48 },
  stair:        { name: 'Staircase flight', unit: 'pcs', unitCost: 3200 },
  furniture:    { name: 'Furniture & décor', unit: 'pcs', unitCost: 420 },
  paving:       { name: 'Paving / hardscape', unit: 'pcs', unitCost: 340 },
  boundary:     { name: 'Boundary wall panel', unit: 'pcs', unitCost: 260 },
  gate:         { name: 'Automated entrance gate', unit: 'pcs', unitCost: 2600 },
  pillar:       { name: 'Gate / boundary pillar', unit: 'pcs', unitCost: 140 },
  tree:         { name: 'Semi-mature tree', unit: 'pcs', unitCost: 180 },
  planting:     { name: 'Shrub & bed planting', unit: 'pcs', unitCost: 60 },
  pool:         { name: 'Swimming pool shell & finish', unit: 'pcs', unitCost: 14500 },
  outdoor:      { name: 'Outdoor furniture', unit: 'pcs', unitCost: 380 },
  playground:   { name: 'Play equipment', unit: 'pcs', unitCost: 380 },
  camera:       { name: 'Security camera', unit: 'pcs', unitCost: 120 },
  car:          { name: 'Vehicle (staging prop)', unit: 'pcs', unitCost: 0 },
  other:        { name: 'Misc component', unit: 'pcs', unitCost: 40 },
};

const _box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const _cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const _at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const _grp = (...ch) => { const g = new THREE.Group(); ch.forEach(c => g.add(c)); return g; };

function clearHouse() {
  const s = scene3d.scene;
  if (!s) return;
  if (scene3d.groups) Object.values(scene3d.groups).forEach(g => { s.remove(g); disposeObject(g); });
  scene3d.extras.forEach(o => { s.remove(o); disposeObject(o); });
  scene3d.interiorLights.forEach(l => s.remove(l));
  scene3d.groups = null; scene3d.extras = []; scene3d.interiorLights = [];
}

/* ---------------- trees & planting ---------------- */
function makePalm(h, M) {
  const g = new THREE.Group();
  const segs = 7;
  let x = 0, y = 0;
  const lean = (Math.random() - 0.5) * 0.08;
  for (let i = 0; i < segs; i++) {
    const sh = h / segs;
    const seg = _at(_cyl(0.14 - i * 0.008, 0.17 - i * 0.008, sh, M.trunkPalm, 8), x, y + sh / 2, 0);
    seg.rotation.z = lean * i;
    g.add(seg);
    x -= Math.sin(lean * i) * sh; y += sh * 0.99;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const frond = new THREE.Group();
    const len = 2.4 + Math.random() * 0.6;
    for (let k = 0; k < 5; k++) {
      const leaf = _at(_box(0.75 - k * 0.1, 0.02, len / 5 + 0.05, k % 2 ? M.palmLeaf : M.palmLeaf2), 0, -k * k * 0.06, k * len / 5);
      leaf.rotation.x = 0.1 + k * 0.16;
      frond.add(leaf);
    }
    frond.rotation.y = a;
    frond.rotation.x = 0.25;
    crown.add(frond);
  }
  crown.add(_at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M.trunkPalm), 0, 0, 0));
  g.add(crown);
  return g;
}

function makeTree(h, M, kind = 'broad') {
  const g = new THREE.Group();
  if (kind === 'conifer') {
    g.add(_at(_cyl(0.12, 0.18, h * 0.4, M.trunk, 8), 0, h * 0.2, 0));
    for (let i = 0; i < 4; i++) {
      const c = _at(new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * 0.3, h * 0.35, 9), M.conifer), 0, h * 0.35 + i * h * 0.17, 0);
      g.add(c);
    }
    return g;
  }
  const trunkH = h * 0.45;
  g.add(_at(_cyl(0.14, 0.24, trunkH, M.trunk, 8), 0, trunkH / 2, 0));
  const r = h * 0.28;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const rr = i === 0 ? 0 : r * 0.7;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.7 + Math.random() * 0.35), 1), i % 3 ? M.foliage : M.foliage2);
    blob.position.set(Math.cos(a) * rr, trunkH + r * 0.9 + (Math.random() - 0.3) * r * 0.6, Math.sin(a) * rr);
    blob.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(blob);
  }
  return g;
}

/* ---------------- tower crane ---------------- */
function buildCrane(spec, at) {
  const yellow = MatLib.plain(0xe7b217, { roughness: 0.45, metalness: 0.35 });
  const dark = MatLib.plain(0x2a2c30, { roughness: 0.6, metalness: 0.3 });
  const concreteM = MatLib.get('concrete', 0x9b978f, [1, 1]);
  const root = new THREE.Group();
  root.position.copy(at);
  const H = PLINTH + spec.wallH + spec.roofH + 8;
  const s = 1.6;
  root.add(_at(_box(4, 0.8, 4, concreteM), 0, 0.4, 0));
  const mast = new THREE.Group();
  root.add(mast);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mast.add(_at(_box(0.12, H, 0.12, yellow), sx * s / 2, H / 2, sz * s / 2));
  for (let y = 0.8; y < H; y += s) {
    for (const [w, d, x, z] of [[s, 0.07, 0, -s / 2], [s, 0.07, 0, s / 2], [0.07, s, -s / 2, 0], [0.07, s, s / 2, 0]]) mast.add(_at(_box(w, 0.07, d, yellow), x, y, z));
    for (const face of [0, 1, 2, 3]) {
      const diag = _box(0.06, s * 1.41, 0.06, yellow);
      const a = face * Math.PI / 2;
      diag.position.set(Math.sin(a) * s / 2, y + s / 2, Math.cos(a) * s / 2);
      diag.rotation.y = a;
      diag.rotateZ(Math.PI / 4);
      mast.add(diag);
    }
  }
  const slew = new THREE.Group();
  slew.position.y = H;
  root.add(slew);
  const far = Math.hypot(Math.abs(at.x) + spec.W / 2 + 4, Math.abs(at.z) + spec.D / 2 + 4);
  const jibLen = clamp(far, 22, 60);
  slew.add(_at(_box(2.2, 1.6, 2.2, yellow), 0, 0.8, 0));
  slew.add(_at(_box(1.4, 1.3, 1.6, dark), 0, 0.9, 1.6));
  const glassCab = MatLib.glass(0x29404c);
  slew.add(_at(_box(1.3, 0.8, 0.05, glassCab), 0, 1.05, 2.42));
  // jib (triangular lattice)
  const jh = 1.4, jw = 1.2;
  for (const sz of [-1, 1]) slew.add(_at(_box(jibLen, 0.1, 0.1, yellow), jibLen / 2, 1.7, sz * jw / 2));
  slew.add(_at(_box(jibLen, 0.1, 0.1, yellow), jibLen / 2, 1.7 + jh, 0));
  for (let x = 0; x < jibLen; x += 1.6) {
    for (const sz of [-1, 1]) {
      const d = _box(0.05, Math.hypot(jh, jw / 2) * 1.05, 0.05, yellow);
      d.position.set(x + 0.8, 1.7 + jh / 2, sz * jw / 4);
      d.rotation.x = sz * Math.atan2(jw / 2, jh);
      slew.add(d);
    }
    slew.add(_at(_box(0.05, 0.05, jw, yellow), x, 1.7, 0));
  }
  // counter-jib + weights
  const cj = 11;
  slew.add(_at(_box(cj, 0.5, 1.3, yellow), -cj / 2, 1.9, 0));
  for (let i = 0; i < 3; i++) slew.add(_at(_box(1.0, 1.6, 1.6, concreteM), -cj + 1 + i * 1.05, 1.2, 0));
  // apex + pendants
  slew.add(_at(_box(0.5, 5.5, 0.5, yellow), 0, 4.4, 0));
  const tie = (x2, y2) => {
    const len = Math.hypot(x2, y2 - 7);
    const t = _box(0.04, len, 0.04, dark);
    t.position.set(x2 / 2, (7 + y2) / 2, 0);
    t.rotation.z = Math.atan2(x2, 7 - y2);
    slew.add(t);
  };
  tie(jibLen * 0.55, 1.7 + jh); tie(-cj + 0.5, 2.1);
  const trolley = new THREE.Group();
  trolley.position.set(jibLen * 0.5, 1.6, 0);
  trolley.add(_box(1.2, 0.35, 1.3, dark));
  slew.add(trolley);
  const cable = _at(_box(0.035, 1, 0.035, dark), 0, -0.5, 0);
  trolley.add(cable);
  const hook = new THREE.Group();
  hook.add(_box(0.6, 0.7, 0.35, yellow));
  hook.add(_at(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 12, Math.PI * 1.4), dark), 0, -0.55, 0));
  trolley.add(hook);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, slew, trolley, cable, hook, H, jibLen, angle: 0, dist: jibLen * 0.5, drop: 8 };
}

/* ---------------- room label sprite ---------------- */
function makeLabelSprite(text, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12,13,16,0.82)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, 496, 134, 67); else ctx.rect(8, 8, 496, 134);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,169,110,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3efe7';
  ctx.font = '600 46px Manrope, Arial, sans-serif';
  ctx.fillText(text, 256, sub ? 70 : 90);
  if (sub) { ctx.fillStyle = '#c9a96e'; ctx.font = '500 30px Manrope, Arial, sans-serif'; ctx.fillText(sub, 256, 114); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(3.2, 0.94, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/* ============================================================ */
function buildHouse(spec) {
  clearHouse();
  const scene = scene3d.scene;
  const T = spec.theme, lux = spec.lux, W = spec.W, D = spec.D;
  const wallT = 0.34;
  const groups = {};
  PHASE_KEYS.forEach(k => { groups[k] = new THREE.Group(); groups[k].name = k; if (k !== 'site') groups[k].position.y = PLINTH; });
  const units = [];
  const matCounts = {};
  const labels = [];
  const lightsSpec = [];

  const add = (phase, obj, matKey, label, o = {}) => {
    obj.traverse(c => { if (c.isMesh) { c.castShadow = !o.noCast; c.receiveShadow = true; } });
    const info = MAT_INFO[matKey] || MAT_INFO.other;
    matCounts[matKey] = (matCounts[matKey] || 0) + 1;
    obj.userData.matInfo = { stageKey: phase, matKey, label: label || info.name, materialName: info.name, unit: info.unit, unitCostUsd: info.unitCost, index: matCounts[matKey] };
    (o.parent || groups[phase]).add(obj);
    units.push({ obj, phase, anim: o.anim, side: o.side, drive: o.drive, order: o.order });
    return obj;
  };

  /* ---------- materials ---------- */
  const M = MatLib;
  const wallM = (len, h = FLOOR_H, t = T.wall) => M.get(t.kind, t.color, [Math.max(0.25, len / 3), Math.max(0.25, h / FLOOR_H)]);
  const concreteM = (w = 4, d = 4) => M.get('concrete', 0x9d9991, [Math.max(0.5, w / 4), Math.max(0.5, d / 4)]);
  const trimM = M.plain(T.trim, { roughness: 0.55 });
  const frameM = M.plain(T.frame, { roughness: 0.35, metalness: 0.6 });
  const glassM = M.glass(0x1e2a32);
  const clearGlass = M.glass(0xcfe3ea, 'clear');
  const flatTop = (w, d) => M.get(T.roofFlat.kind, T.roofFlat.color, [w / 4, d / 4]);
  const pitchM = (rx, ry) => M.get(T.roofPitch.kind, T.roofPitch.color, [rx, ry], { side: THREE.DoubleSide });
  const doorM = M.get(T.door.kind, T.door.color, [0.6, 1]);
  const pavingM = (w, d) => M.get('paving', 0xbdb5a6, [w / 3, d / 3]);
  const travM = (w, d) => M.get('travertine', 0xe2d7c3, [w / 2.4, d / 2.4]);
  const deckM = (w, d) => M.get('woodPlank', 0x8a6040, [w / 2, d / 2]);
  const interiorM = len => M.get('plaster', 0xf3f0ea, [len / 3, 1]);
  const brass = M.plain(0xc8a45a, { roughness: 0.28, metalness: 1 });
  const black = M.plain(0x1c1d1f, { roughness: 0.45, metalness: 0.4 });
  const lampM = M.lampGlow(0xffd59a);
  const SITE = {
    trunk: M.plain(0x5a4331, { roughness: 0.95 }),
    trunkPalm: M.plain(0x8a7358, { roughness: 0.95 }),
    foliage: M.plain(0x3e6a2e, { roughness: 0.85, flatShading: true }),
    foliage2: M.plain(0x557d36, { roughness: 0.85, flatShading: true }),
    conifer: M.plain(0x2f5133, { roughness: 0.85, flatShading: true }),
    palmLeaf: M.plain(0x4f7a2f, { roughness: 0.7, side: THREE.DoubleSide }),
    palmLeaf2: M.plain(0x3f6a28, { roughness: 0.7, side: THREE.DoubleSide }),
    hedge: M.plain(0x3a5f2a, { roughness: 0.9, flatShading: true }),
  };
  const flatRoofMats = (w, d) => [trimM, trimM, flatTop(w, d), trimM, trimM, trimM];

  /* ================= FOUNDATION ================= */
  const colXs = []; for (let gx = 0; gx <= spec.gridX; gx += 2) colXs.push(gx); if (colXs[colXs.length - 1] !== spec.gridX) colXs.push(spec.gridX);
  const colZs = []; for (let gz = 0; gz <= spec.gridZ; gz += 2) colZs.push(gz); if (colZs[colZs.length - 1] !== spec.gridZ) colZs.push(spec.gridZ);
  const colPositions = [];
  const seen = new Set();
  const pushCol = (x, z) => { const k = x.toFixed(2) + ',' + z.toFixed(2); if (!seen.has(k)) { seen.add(k); colPositions.push({ x, z }); } };
  colXs.forEach(gx => { pushCol(gx * UNIT - W / 2, -D / 2); pushCol(gx * UNIT - W / 2, D / 2); });
  colZs.forEach(gz => { pushCol(-W / 2, gz * UNIT - D / 2); pushCol(W / 2, gz * UNIT - D / 2); });

  colPositions.forEach(c => add('foundation', _at(_box(1.1, PLINTH, 1.1, concreteM(1, 1)), c.x, -PLINTH / 2, c.z), 'footing', 'Pad footing'));
  add('foundation', _at(_box(W + 0.6, PLINTH, D + 0.6, concreteM(W, D)), 0, -PLINTH / 2, 0), 'concrete', 'Ground-bearing slab');
  const slabFor = (v, label) => add('foundation', _at(_box(v.w + 0.4, PLINTH, v.d + 0.4, concreteM(v.w, v.d)), v.x, -PLINTH / 2, v.z), 'concrete', label);
  if (spec.garage) slabFor(spec.garage, spec.garage.open ? 'Carport slab' : 'Garage slab');
  if (spec.wing) slabFor(spec.wing, 'Wing slab');
  if (spec.wing2) slabFor(spec.wing2, 'Wing slab');
  if (spec.podium) slabFor({ ...spec.podium, x: 0, z: 0 }, 'Podium slab');
  // entrance steps
  for (let i = 0; i < 2; i++) {
    const h = PLINTH * (i + 1) / 2;
    add('foundation', _at(_box(3.2 - i * 0.4, h, 0.42, travM(3, 0.4)), spec.door.x, -PLINTH + h / 2, -D / 2 - 0.3 - 0.42 * (1.5 - i)), 'paving', 'Entrance step');
  }

  /* ================= FRAME ================= */
  for (let f = 0; f < spec.floors; f++) {
    colPositions.forEach(c => add('frame', _at(_box(0.3, FLOOR_H, 0.3, concreteM(0.3, 3)), c.x, f * FLOOR_H + FLOOR_H / 2, c.z), 'column', 'RC column'));
    if (f > 0) add('frame', _at(_box(W - 0.06, 0.22, D - 0.06, concreteM(W, D)), 0, f * FLOOR_H, 0), 'floor_slab', `Level ${f + 1} slab`);
  }
  if (spec.wing) for (let f = 1; f < spec.wing.floors; f++) add('frame', _at(_box(spec.wing.w - 0.2, 0.22, spec.wing.d - 0.2, concreteM()), spec.wing.x, f * FLOOR_H, spec.wing.z), 'floor_slab', 'Wing slab');
  if (spec.cantilever) {
    const c = spec.cantilever;
    for (const sx of [-c.w * 0.38, c.w * 0.38]) add('frame', _at(_box(0.25, c.y, 0.25, black), c.x + sx, c.y / 2, c.z - c.d * 0.3), 'column', 'Steel support column');
  }
  if (spec.garage && spec.garage.open) {
    const g = spec.garage;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('frame', _at(_box(0.2, g.h, 0.2, M.get('timber', 0x8a6444, [0.2, 1])), g.x + sx * (g.w / 2 - 0.3), g.h / 2, g.z + sz * (g.d / 2 - 0.3)), 'column', 'Timber post');
  }

  /* ================= WALLS ================= */
  for (let f = 0; f < spec.floors; f++) {
    const wy = f * FLOOR_H + FLOOR_H / 2;
    for (let gx = 0; gx < spec.gridX; gx++) {
      let x0 = gx * UNIT - W / 2, x1 = x0 + UNIT;
      if (gx === 0) x0 -= wallT / 2;
      if (gx === spec.gridX - 1) x1 += wallT / 2;
      const len = x1 - x0, cx = (x0 + x1) / 2;
      add('walls', _at(_box(len, FLOOR_H, wallT, wallM(len)), cx, wy, -D / 2), T.wall.kind === 'plaster' ? 'brick' : 'cladding', 'Façade wall panel', { side: 'front' });
      add('walls', _at(_box(len, FLOOR_H, wallT, wallM(len)), cx, wy, D / 2), T.wall.kind === 'plaster' ? 'brick' : 'cladding', 'Façade wall panel', { side: 'back' });
    }
    for (let gz = 0; gz < spec.gridZ; gz++) {
      const cz = gz * UNIT - D / 2 + UNIT / 2;
      add('walls', _at(_box(wallT, FLOOR_H, UNIT, wallM(UNIT)), -W / 2, wy, cz), 'brick', 'Façade wall panel', { side: 'left' });
      add('walls', _at(_box(wallT, FLOOR_H, UNIT, wallM(UNIT)), W / 2, wy, cz), 'brick', 'Façade wall panel', { side: 'right' });
    }
    if (f > 0 && T.wall.kind !== 'timber') {
      const y = f * FLOOR_H, bh = 0.26, bt = 0.06;
      add('walls', _at(_box(W + wallT + bt * 2, bh, bt, trimM), 0, y, -D / 2 - wallT / 2 - bt / 2), 'trim', 'Floor-edge band', { side: 'front' });
      add('walls', _at(_box(W + wallT + bt * 2, bh, bt, trimM), 0, y, D / 2 + wallT / 2 + bt / 2), 'trim', 'Floor-edge band', { side: 'back' });
      add('walls', _at(_box(bt, bh, D + wallT, trimM), -W / 2 - wallT / 2 - bt / 2, y, 0), 'trim', 'Floor-edge band', { side: 'left' });
      add('walls', _at(_box(bt, bh, D + wallT, trimM), W / 2 + wallT / 2 + bt / 2, y, 0), 'trim', 'Floor-edge band', { side: 'right' });
    }
  }

  const volumeWalls = (v, h, t, label, openFront) => {
    const front = v.z - v.d / 2, back = v.z + v.d / 2;
    if (openFront) {
      const pier = Math.max(0.6, (v.w - openFront) / 2);
      for (const sx of [-1, 1]) add('walls', _at(_box(pier, h, 0.3, wallM(pier, h, t)), v.x + sx * (v.w / 2 - pier / 2), h / 2, front), 'cladding', label);
      add('walls', _at(_box(v.w - pier * 2, h - 2.45, 0.3, wallM(v.w, h - 2.45, t)), v.x, 2.45 + (h - 2.45) / 2, front), 'cladding', label);
    } else {
      add('walls', _at(_box(v.w, h, 0.3, wallM(v.w, h, t)), v.x, h / 2, front), 'cladding', label);
    }
    add('walls', _at(_box(v.w, h, 0.3, wallM(v.w, h, t)), v.x, h / 2, back), 'cladding', label);
    const outerX = v.x > 0 ? v.x + v.w / 2 : v.x - v.w / 2;
    add('walls', _at(_box(0.3, h, v.d, wallM(v.d, h, t)), outerX, h / 2, v.z), 'cladding', label);
  };
  if (spec.garage && !spec.garage.open) volumeWalls(spec.garage, spec.garage.h, T.wing, 'Garage wall', Math.min(spec.garage.w - 1.2, 5.2));
  if (spec.wing) volumeWalls(spec.wing, spec.wing.floors * FLOOR_H, T.wing, 'Wing façade');
  if (spec.wing2) volumeWalls(spec.wing2, spec.wing2.floors * FLOOR_H, T.wing, 'Wing façade');
  if (spec.podium) {
    const p = spec.podium;
    [[p.w, 0.3, 0, -p.d / 2], [p.w, 0.3, 0, p.d / 2], [0.3, p.d, -p.w / 2, 0], [0.3, p.d, p.w / 2, 0]].forEach(([ww, dd, ox, oz]) =>
      add('walls', _at(_box(ww, p.h, dd, wallM(Math.max(ww, dd), p.h, T.wing)), ox, p.h / 2, oz), 'cladding', 'Podium façade'));
  }
  if (spec.cantilever) {
    const c = spec.cantilever;
    add('walls', _at(_box(c.w, c.h, c.d, wallM(c.w, c.h, T.wing)), c.x, c.y + c.h / 2, c.z), 'cladding', 'Cantilevered volume', { side: 'front' });
  }

  /* ================= ROOF ================= */
  const roofY = spec.wallH;
  const roofType = spec.roofType;
  const isPitched = ['hip', 'gable'].includes(roofType);
  const over = isPitched ? 0.7 : 0.45;
  const deckT = 0.3;
  const deckTop = roofY + deckT;

  if (!isPitched) {
    add('roof', _at(new THREE.Mesh(new THREE.BoxGeometry(W + over * 2, deckT, D + over * 2), flatRoofMats(W, D)), 0, roofY + deckT / 2, 0), 'roof_deck', 'Roof deck & membrane');
    const ph = 0.6, pt = 0.22;
    [[W + over * 2, pt, 0, -D / 2 - over + pt / 2, 'front'], [W + over * 2, pt, 0, D / 2 + over - pt / 2, 'back'],
     [pt, D + over * 2 - pt * 2, -W / 2 - over + pt / 2, 0, 'left'], [pt, D + over * 2 - pt * 2, W / 2 + over - pt / 2, 0, 'right']].forEach(([ww, dd, ox, oz, side]) => {
      add('roof', _at(_box(ww, ph, dd, wallM(Math.max(ww, dd), ph)), ox, deckTop + ph / 2, oz), 'parapet', 'Parapet wall', { side });
      add('roof', _at(_box(ww + 0.04, 0.06, dd + 0.04, trimM), ox, deckTop + ph + 0.03, oz), 'roof_ridge', 'Parapet coping', { side });
    });
    if (roofType === 'flat-stepped') {
      const sw = W * 0.42, sd = D * 0.4, sx = W * 0.18, sz = D * 0.12;
      add('roof', _at(_box(sw, 1.2, sd, wallM(sw, 1.2, T.wing)), sx, deckTop + 0.6, sz), 'roof_deck', 'Plant room');
      add('roof', _at(new THREE.Mesh(new THREE.BoxGeometry(sw + 0.3, 0.2, sd + 0.3), flatRoofMats(sw, sd)), sx, deckTop + 1.3, sz), 'roof_deck', 'Plant room roof');
    }
  }

  if (roofType === 'gable') {
    const ang = spec.style === 'scandinavian' ? 0.62 : 0.4;
    const halfSpan = W / 2 + over;
    const slopeL = halfSpan / Math.cos(ang) + 0.1;
    const depth = D + over * 2;
    const ridgeH = halfSpan * Math.tan(ang);
    add('roof', _at(_box(W + 0.2, 0.2, D + 0.2, concreteM(W, D)), 0, roofY + 0.1, 0), 'roof_deck', 'Ceiling slab');
    for (const s of [-1, 1]) {
      const m = _box(slopeL, 0.18, depth, pitchM(slopeL / 2.5, depth / 2.5));
      m.position.set(s * halfSpan / 2, roofY + 0.2 + ridgeH / 2 - 0.05, 0);
      m.rotation.z = -s * ang;
      add('roof', m, 'roof_tile', 'Roof covering');
    }
    const tri = new THREE.Shape();
    const gw = W / 2 + wallT / 2, gh = gw * Math.tan(ang);
    tri.moveTo(-gw, 0); tri.lineTo(gw, 0); tri.lineTo(0, gh); tri.closePath();
    for (const z of [-D / 2 - wallT / 2, D / 2 - wallT / 2]) {
      const geo = new THREE.ExtrudeGeometry(tri, { depth: wallT, bevelEnabled: false });
      const tm = M.get(T.wall.kind, T.wall.color, [1 / 3, 1 / 3]);
      add('roof', _at(new THREE.Mesh(geo, tm), 0, roofY + 0.2, z), 'cladding', 'Gable end', { side: z < 0 ? 'front' : 'back' });
    }
    add('roof', _at(_box(0.3, 0.16, depth + 0.05, trimM), 0, roofY + 0.2 + ridgeH + 0.02, 0), 'roof_ridge', 'Ridge cap');
  }

  if (roofType === 'hip') {
    add('roof', _at(_box(W + 0.2, 0.2, D + 0.2, concreteM(W, D)), 0, roofY + 0.1, 0), 'roof_deck', 'Ceiling slab');
    const base = roofY + 0.2;
    const hw = W / 2 + over, hd = D / 2 + over;
    const ridgeH = Math.min(hw, hd) * 0.62;
    const ridgeY = base + ridgeH;
    const longIsX = W >= D;
    const ridgeHalf = longIsX ? Math.max(0.4, hw - hd) : Math.max(0.4, hd - hw);
    const faceMat = pitchM(1, 1);
    const makeFace = verts => {
      const pos = [], uv = [];
      const tris = verts.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
      const e1 = new THREE.Vector3().fromArray(verts[1]).sub(new THREE.Vector3().fromArray(verts[0]));
      const e2 = new THREE.Vector3().fromArray(verts[2]).sub(new THREE.Vector3().fromArray(verts[0]));
      const n = e1.clone().cross(e2).normalize();
      const alongX = Math.abs(n.z) > Math.abs(n.x);
      tris.forEach(t => t.forEach(i => {
        const [x, y, z] = verts[i];
        pos.push(x, y, z);
        uv.push((alongX ? x : z) / 2.5, (y - base) * 1.6 / 2.5);
      }));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      add('roof', new THREE.Mesh(geo, faceMat), 'roof_tile', 'Roof face');
    };
    const fl = [-hw, base, -hd], fr = [hw, base, -hd], br = [hw, base, hd], bl = [-hw, base, hd];
    if (longIsX) {
      const rL = [-ridgeHalf, ridgeY, 0], rR = [ridgeHalf, ridgeY, 0];
      makeFace([fl, fr, rR, rL]); makeFace([br, bl, rL, rR]); makeFace([bl, fl, rL]); makeFace([fr, br, rR]);
    } else {
      const rF = [0, ridgeY, -ridgeHalf], rB = [0, ridgeY, ridgeHalf];
      makeFace([bl, fl, rF, rB]); makeFace([fr, br, rB, rF]); makeFace([fl, fr, rF]); makeFace([br, bl, rB]);
    }
    add('roof', _at(_box(longIsX ? ridgeHalf * 2 + 0.2 : 0.22, 0.12, longIsX ? 0.22 : ridgeHalf * 2 + 0.2, trimM), 0, ridgeY + 0.04, 0), 'roof_ridge', 'Ridge cap');
    // fascia
    [[hw * 2, 0.22, 0.06, 0, -hd], [hw * 2, 0.22, 0.06, 0, hd], [0.06, 0.22, hd * 2, -hw, 0], [0.06, 0.22, hd * 2, hw, 0]].forEach(([w, h, d, x, z]) =>
      add('roof', _at(_box(w, h, d, trimM), x, base - 0.08, z), 'roof_ridge', 'Fascia board'));
  }

  if (roofType === 'angular') {
    add('roof', _at(new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, deckT, D + 0.6), flatRoofMats(W, D)), 0, roofY + deckT / 2, 0), 'roof_deck', 'Roof deck');
    const a1 = _box(W * 0.85, 0.24, D * 0.95, M.plain(T.trim, { roughness: 0.4, metalness: 0.2 }));
    a1.position.set(-W * 0.04, deckTop + 1.2, 0); a1.rotation.z = 0.13;
    add('roof', a1, 'roof_tile', 'Angled roof plane');
    const a2 = _box(W * 0.42, 0.22, D * 0.5, wallM(W * 0.42, 1, T.wing));
    a2.position.set(W * 0.22, deckTop + 2.0, -D * 0.06); a2.rotation.z = -0.18;
    add('roof', a2, 'roof_tile', 'Angled roof plane');
    for (const sx of [-0.35, 0.05, 0.4]) add('roof', _at(_box(0.18, 1.6, 0.18, black), W * sx, deckTop + 0.8, 0), 'column', 'Roof support');
  }

  const volumeRoof = (v, h, label) => add('roof', _at(new THREE.Mesh(new THREE.BoxGeometry(v.w + 0.5, 0.28, v.d + 0.5), flatRoofMats(v.w, v.d)), v.x, h + 0.14, v.z), 'roof_deck', label);
  if (spec.garage) volumeRoof(spec.garage, spec.garage.h, spec.garage.open ? 'Carport roof' : 'Garage roof');
  if (spec.wing) volumeRoof(spec.wing, spec.wing.floors * FLOOR_H, 'Wing roof');
  if (spec.wing2) volumeRoof(spec.wing2, spec.wing2.floors * FLOOR_H, 'Wing roof');
  if (spec.podium) volumeRoof({ ...spec.podium, x: 0, z: 0, w: spec.podium.w, d: spec.podium.d }, spec.podium.h, 'Podium roof terrace');

  const flatRoof = roofType === 'flat' || roofType === 'flat-stepped';
  if (flatRoof && lux >= 4) {
    const pw = W * 0.36, pd = D * 0.34, ph = FLOOR_H * 0.85;
    const px = -W * 0.18, pz = -D * 0.12, py = deckTop;
    add('roof', _at(_box(pw + 3, 0.08, pd + 3, deckM(pw + 3, pd + 3)), px, py + 0.04, pz), 'paving', 'Penthouse terrace deck');
    for (const [w, d, x, z, side] of [[pw, 0.06, 0, -pd / 2, 'front'], [pw, 0.06, 0, pd / 2, 'back'], [0.06, pd, -pw / 2, 0, 'left'], [0.06, pd, pw / 2, 0, 'right']])
      add('roof', _at(_box(w, ph, d, glassM), px + x, py + ph / 2 + 0.08, pz + z), 'window', 'Penthouse glazing', { side });
    for (const [x, z] of [[-pw / 2, -pd / 2], [pw / 2, -pd / 2], [-pw / 2, pd / 2], [pw / 2, pd / 2]])
      add('roof', _at(_box(0.12, ph, 0.12, frameM), px + x, py + ph / 2 + 0.08, pz + z), 'column', 'Penthouse frame');
    add('roof', _at(new THREE.Mesh(new THREE.BoxGeometry(pw + 1.2, 0.22, pd + 1.2), flatRoofMats(pw, pd)), px, py + ph + 0.2, pz), 'roof_deck', 'Penthouse roof');
  }
  if (flatRoof && (spec.fd.sustain >= 4 || lux >= 5)) {
    const panelM = M.plain(0x1b2a44, { roughness: 0.18, metalness: 0.6 });
    const rows = Math.max(1, Math.floor(D * 0.25 / 2.2)), cols = Math.max(2, Math.floor(W * 0.35 / 1.15));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = _grp(_box(1.05, 0.04, 1.75, panelM), _at(_box(1.07, 0.02, 1.77, M.plain(0xb9bec4, { metalness: 1, roughness: 0.3 })), 0, -0.03, 0));
      p.position.set(W * 0.12 + c * 1.15, deckTop + 0.55, D * 0.22 + r * 2.2);
      p.rotation.x = -0.32;
      add('roof', p, 'solar', 'Solar PV module');
    }
  }
  if (spec.outdoor.includes('rooftop') && flatRoof) {
    const rx = W * 0.2, rz = -D * 0.15;
    add('roof', _at(_box(5.5, 0.08, 4.5, deckM(5.5, 4.5)), rx, deckTop + 0.04, rz), 'paving', 'Roof terrace deck');
    const perg = new THREE.Group();
    for (const [x, z] of [[-2.6, -2.1], [2.6, -2.1], [-2.6, 2.1], [2.6, 2.1]]) perg.add(_at(_box(0.12, 2.5, 0.12, black), x, 1.25, z));
    for (let i = 0; i < 9; i++) perg.add(_at(_box(0.06, 0.16, 4.4, M.get('timber', 0x8a6444, [0.2, 1])), -2.4 + i * 0.6, 2.55, 0));
    add('roof', _at(perg, rx, deckTop + 0.08, rz), 'outdoor', 'Roof pergola');
  }

  /* ================= FIXTURES ================= */
  const win = spec.win;
  spec.windows.forEach(w => {
    const g = new THREE.Group();
    g.add(_box(win.w, win.h, 0.04, glassM));
    const ft = 0.07;
    g.add(_at(_box(win.w + ft * 2, ft, 0.1, frameM), 0, win.h / 2 + ft / 2, 0));
    g.add(_at(_box(win.w + ft * 2, ft, 0.1, frameM), 0, -win.h / 2 - ft / 2, 0));
    g.add(_at(_box(ft, win.h, 0.1, frameM), -win.w / 2 - ft / 2, 0, 0));
    g.add(_at(_box(ft, win.h, 0.1, frameM), win.w / 2 + ft / 2, 0, 0));
    if (spec.bigGlass) g.add(_at(_box(0.045, win.h, 0.08, frameM), win.w * 0.18, 0, 0));
    else {
      g.add(_at(_box(win.w, 0.04, 0.07, frameM), 0, win.h * 0.18, 0));
      g.add(_at(_box(win.w + 0.3, 0.06, 0.2, trimM), 0, -win.h / 2 - 0.1, -0.06));
    }
    const off = wallT / 2 + 0.03;
    const nx = w.side === 'left' ? -1 : w.side === 'right' ? 1 : 0;
    const nz = w.side === 'front' ? -1 : w.side === 'back' ? 1 : 0;
    g.position.set(w.x + nx * off, w.y, w.z + nz * off);
    g.rotation.y = w.rot;
    add('fixtures', g, 'window', spec.bigGlass ? 'Floor-to-ceiling glazing' : 'Double-glazed window', { side: w.side });
  });

  // entrance door
  {
    const dbl = lux >= 3;
    const dw = dbl ? 2.0 : 1.1, dh = lux >= 4 ? 2.75 : 2.4;
    const g = new THREE.Group();
    g.add(_at(_box(dw + 0.24, dh + 0.12, 0.14, frameM), 0, dh / 2 + 0.06, 0));
    const leaves = dbl ? 2 : 1, lw = dw / leaves;
    for (let i = 0; i < leaves; i++) {
      const x = -dw / 2 + lw * (i + 0.5);
      g.add(_at(_box(lw - 0.02, dh, 0.08, doorM), x, dh / 2, -0.06));
      g.add(_at(_box(0.03, dbl ? 1.1 : 0.4, 0.04, brass), x + (i === 0 && dbl ? lw / 2 - 0.12 : -lw / 2 + 0.12) * (dbl ? 1 : -1), dh * 0.48, -0.13));
    }
    if (spec.bigGlass) for (const sx of [-1, 1]) g.add(_at(_box(0.6, dh, 0.04, glassM), sx * (dw / 2 + 0.45), dh / 2, -0.02));
    g.add(_at(_box(dw + 2.6, 0.16, 1.7, trimM), 0, dh + 0.35, -0.8));
    g.add(_at(_box(0.25, 0.25, 0.04, lampM), -(dw / 2 + 0.95), dh * 0.62, -0.05));
    g.add(_at(_box(0.25, 0.25, 0.04, lampM), dw / 2 + 0.95, dh * 0.62, -0.05));
    g.position.set(spec.door.x, 0, -D / 2 - wallT / 2 - 0.01);
    add('fixtures', g, 'door', dbl ? 'Pivot entrance doors' : 'Entrance door', { side: 'front' });
    lightsSpec.push({ x: spec.door.x, y: PLINTH + dh + 0.1, z: -D / 2 - 1.2, color: 0xffd29a, base: 0.8, dist: 9, floor: 0 });
  }

  if (spec.garage && !spec.garage.open) {
    const g = spec.garage, ow = Math.min(g.w - 1.2, 5.2);
    const door = new THREE.Group();
    const gdM = M.get('metal', 0x3a3c3f, [1.5, 1]);
    door.add(_box(ow, 2.4, 0.06, gdM));
    for (let i = 1; i < 5; i++) door.add(_at(_box(ow, 0.02, 0.07, black), 0, -1.2 + i * 0.48, 0));
    door.position.set(g.x, 1.2, g.z - g.d / 2 + 0.05);
    add('fixtures', door, 'garage_door', 'Sectional garage door');
    add('fixtures', _at(_box(0.3, 0.12, 0.08, lampM), g.x, 2.7, g.z - g.d / 2 - 0.2), 'light', 'Garage downlight');
  }
  const volumeGlass = (v, h, label) => {
    const n = Math.max(1, Math.floor(v.w / 3.2));
    for (let i = 0; i < n; i++) {
      const x = v.x - v.w / 2 + (i + 0.5) * v.w / n;
      for (let f = 0; f < Math.round(h / FLOOR_H); f++) {
        add('fixtures', _at(_box(v.w / n - 0.6, 2.2, 0.05, glassM), x, f * FLOOR_H + 1.3, v.z - v.d / 2 - 0.18), 'window', label);
        add('fixtures', _at(_box(v.w / n - 0.6, 0.06, 0.1, frameM), x, f * FLOOR_H + 2.43, v.z - v.d / 2 - 0.18), 'window', 'Window head');
      }
    }
  };
  if (spec.wing) volumeGlass(spec.wing, spec.wing.floors * FLOOR_H, 'Wing glazing');
  if (spec.wing2) volumeGlass(spec.wing2, spec.wing2.floors * FLOOR_H, 'Wing glazing');
  if (spec.cantilever) {
    const c = spec.cantilever;
    add('fixtures', _at(_box(c.w * 0.92, c.h * 0.75, 0.05, glassM), c.x, c.y + c.h / 2, c.z - c.d / 2 - 0.03), 'window', 'Cantilever glazing', { side: 'front' });
  }
  if (spec.floors >= 2 && !spec.cantilever) {
    const bf = spec.floors - 1, bw = Math.min(W * 0.45, 9), bd = 1.8, by = bf * FLOOR_H;
    const bx = spec.door.x + (spec.door.x > 0 ? -bw / 2 : bw / 2) * 0.4, bz = -D / 2 - wallT / 2 - bd / 2;
    const g = new THREE.Group();
    g.add(_at(_box(bw, 0.2, bd, trimM), 0, 0.1, 0));
    g.add(_at(_box(bw - 0.1, 0.02, bd - 0.1, deckM(bw, bd)), 0, 0.21, 0));
    for (const [w, d, x, z] of [[bw, 0.03, 0, -bd / 2 + 0.03], [0.03, bd, -bw / 2 + 0.03, 0], [0.03, bd, bw / 2 - 0.03, 0]]) {
      g.add(_at(_box(w, 1.0, d, clearGlass), x, 0.72, z));
      g.add(_at(_box(w + 0.02, 0.04, d + 0.04, black), x, 1.23, z));
    }
    g.position.set(bx, by, bz);
    add('fixtures', g, 'balcony', 'Balcony with glass balustrade', { side: 'front' });
  }

  /* ================= INTERIOR ================= */
  const floorTop = f => (f === 0 ? 0.03 : f * FLOOR_H + 0.14);
  const zSplit = spec.roomPlan.zSplit;
  const floorKind = r => {
    if (spec.isWarehouse) return ['concrete', 0xb8b4ad];
    if (spec.isOffice || spec.isHotel) return r.type === 'bath' ? ['marble', 0xefedea] : ['floorTile', 0xcfcac2];
    if (r.type === 'bath') return ['marble', 0xf1efeb];
    if (r.type === 'kitchen') return ['floorTile', lux >= 4 ? 0x4a4744 : 0xe4ded4];
    if (r.type === 'living' && lux >= 4) return ['marble', 0xf0ebe3];
    return ['woodPlank', spec.style === 'scandinavian' ? 0xcfae84 : lux >= 4 ? 0x7a5536 : 0xb08a5f];
  };
  spec.roomPlan.forEach((rects, f) => {
    const y = floorTop(f) - 0.015;
    rects.forEach(r => {
      const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
      const [kind, col] = floorKind(r);
      add('interior', _at(_box(rw - 0.06, 0.03, rd - 0.06, M.get(kind, col, [rw / 2.4, rd / 2.4], { noBump: true })), (r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2), 'floor_finish', 'Floor finish: ' + r.label);
      if (!r.last && r.x1 < W / 2 - 0.3) add('interior', _at(_box(0.12, FLOOR_H - 0.16, rd, interiorM(rd)), r.x1, f * FLOOR_H + FLOOR_H / 2 + 0.06, (r.z0 + r.z1) / 2), 'partition', 'Partition wall');
      if (r.isBathroom && r.z0 > zSplit + 0.2) add('interior', _at(_box(rw, FLOOR_H - 0.16, 0.12, interiorM(rw)), (r.x0 + r.x1) / 2, f * FLOOR_H + FLOOR_H / 2 + 0.06, r.z0), 'partition', 'Bathroom wall');
      if (r.sub && r.x1 < W / 2 - 0.3) add('interior', _at(_box(0.12, FLOOR_H - 0.16, rd, interiorM(rd)), r.x1, f * FLOOR_H + FLOOR_H / 2 + 0.06, (r.z0 + r.z1) / 2), 'partition', 'Partition wall');
      const lab = makeLabelSprite(r.label, `${rw.toFixed(1)} × ${rd.toFixed(1)} m`);
      lab.position.set((r.x0 + r.x1) / 2, floorTop(f) + FLOOR_H * 0.82, (r.z0 + r.z1) / 2);
      lab.visible = false;
      groups.interior.add(lab);
      labels.push({ sprite: lab, floor: f, baseY: lab.position.y });
    });
    // band divider with door openings
    const divY = f * FLOOR_H + FLOOR_H / 2 + 0.06;
    const openings = rects.filter(r => r.band === 'back').map(r => (r.x0 + r.x1) / 2).sort((a, b) => a - b);
    let cursor = -W / 2 + wallT / 2;
    openings.forEach(ox => {
      const end = ox - 0.5;
      if (end - cursor > 0.2) add('interior', _at(_box(end - cursor, FLOOR_H - 0.16, 0.12, interiorM(end - cursor)), (cursor + end) / 2, divY, zSplit), 'partition', 'Corridor wall');
      cursor = ox + 0.5;
    });
    const end = W / 2 - wallT / 2;
    if (end - cursor > 0.2) add('interior', _at(_box(end - cursor, FLOOR_H - 0.16, 0.12, interiorM(end - cursor)), (cursor + end) / 2, divY, zSplit), 'partition', 'Corridor wall');
  });

  if (spec.stairs) {
    const s = spec.stairs;
    const steps = 17, rise = FLOOR_H / steps, run = (s.z1 - s.z0) / steps;
    const treadM = lux >= 4 ? M.get('marble', 0xefe9df, [0.5, 0.5]) : M.get('woodPlank', 0x9b7450, [0.5, 0.3], { noBump: true });
    for (let f = 0; f < spec.floors - 1; f++) {
      const g = new THREE.Group();
      for (let i = 0; i < steps; i++) g.add(_at(_box(s.w, 0.05, run + 0.02, treadM), 0, rise * (i + 1) - 0.025, -i * run - run / 2));
      const len = Math.hypot(FLOOR_H, s.z1 - s.z0);
      const stringer = _at(_box(0.08, 0.3, len, black), s.w / 2 + 0.04, FLOOR_H / 2, -(s.z1 - s.z0) / 2);
      stringer.rotation.x = Math.atan2(FLOOR_H, s.z1 - s.z0);
      g.add(stringer);
      const rail = _at(_box(0.02, 0.9, len, clearGlass), s.w / 2 + 0.04, FLOOR_H / 2 + 0.55, -(s.z1 - s.z0) / 2);
      rail.rotation.x = stringer.rotation.x; g.add(rail);
      g.position.set(s.x, f * FLOOR_H + (f === 0 ? 0 : 0.11), s.z1);
      add('interior', g, 'stair', 'Staircase flight');
    }
  }

  // interior lights (largest rooms first)
  const allRooms = spec.roomPlan.flat().filter(r => !r.isBathroom).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0));
  allRooms.slice(0, 6).forEach(r => lightsSpec.push({
    x: (r.x0 + r.x1) / 2, y: PLINTH + floorTop(r.floor) + FLOOR_H * 0.72, z: (r.z0 + r.z1) / 2,
    color: 0xffc98a, base: 1.15, dist: Math.max(r.x1 - r.x0, r.z1 - r.z0) * 1.5, floor: r.floor,
  }));

  /* ================= FURNITURE ================= */
  const factory = createFurnitureFactory(spec);
  const avoid = spec.stairs ? [{ x0: spec.stairs.x - spec.stairs.w / 2 - 0.6, x1: spec.stairs.x + spec.stairs.w / 2 + 0.6, z0: spec.stairs.z0 - 0.8, z1: spec.stairs.z1 + 0.6 }] : [];
  spec.roomPlan.forEach(rects => rects.forEach(r => {
    const room = new THREE.Group();
    room.position.set((r.x0 + r.x1) / 2, floorTop(r.floor), (r.z0 + r.z1) / 2);
    groups.furniture.add(room);
    factory.furnishRoom(r, spec.floors >= 2 ? avoid : []).forEach((it, i) => add('furniture', it.obj, 'furniture', it.label, { parent: room, order: r.floor * 1000 + i }));
  }));

  /* ================= SITE ================= */
  const driveLen = spec.driveLen, driveW = 5;
  const gateZ = -D / 2 - driveLen;
  const gx = spec.door.x;
  const B = spec.bounds;
  const cMinX = B.minX + 2, cMaxX = B.maxX - 2, cMinZ = gateZ, cMaxZ = B.maxZ - 1;

  // forecourt + driveway
  const fcW = (spec.garage && !spec.garage.open ? spec.garage.x + spec.garage.w / 2 : W / 2) - (-W / 2) + 2;
  const fcX = ((spec.garage && !spec.garage.open ? spec.garage.x + spec.garage.w / 2 : W / 2) + -W / 2) / 2;
  add('site', _at(_box(fcW, 0.08, 9, pavingM(fcW, 9)), fcX, 0.04, -D / 2 - 5.4), 'paving', 'Forecourt paving');
  const dLen = driveLen - 9.8;
  add('site', _at(_box(driveW, 0.08, dLen, pavingM(driveW, dLen)), gx, 0.04, gateZ + dLen / 2), 'paving', 'Driveway');
  for (const sd of [-1, 1]) add('site', _at(_box(0.25, 0.14, dLen, M.plain(0xd6d1c7, { roughness: 0.8 })), gx + sd * (driveW / 2 + 0.12), 0.07, gateZ + dLen / 2), 'paving', 'Kerb');

  // trees along drive
  const palms = ['modern', 'luxury', 'futuristic'].includes(spec.style);
  const treeKind = spec.style === 'scandinavian' ? 'conifer' : 'broad';
  for (let z = gateZ + 4, i = 0; z < -D / 2 - 11; z += 7, i++) {
    for (const sd of [-1, 1]) {
      const t = palms ? makePalm(6.5 + (i % 3) * 0.8, SITE) : makeTree(6 + (i % 2), SITE, treeKind);
      t.position.set(gx + sd * (driveW / 2 + 2.2), 0, z);
      t.rotation.y = i * 1.7 + sd;
      add('site', t, 'tree', palms ? 'Royal palm' : 'Avenue tree', { anim: 'grow' });
    }
    if (i % 2 === 0) for (const sd of [-1, 1]) {
      const b = _grp(_at(_cyl(0.07, 0.09, 0.8, black, 10), 0, 0.4, 0), _at(_cyl(0.1, 0.1, 0.12, lampM, 12), 0, 0.86, 0));
      b.position.set(gx + sd * (driveW / 2 + 0.7), 0, z + 3.5);
      add('site', b, 'light', 'Bollard light');
    }
  }
  // hedges & beds by the house
  for (const sd of [-1, 1]) {
    const hx = sd < 0 ? -W / 2 - (spec.wing ? spec.wing.w : 0) - 2.2 : (spec.garage ? spec.garage.x + spec.garage.w / 2 : W / 2) + 2.2;
    for (let i = 0; i < 5; i++) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + (i % 2) * 0.2, 1), SITE.hedge);
      bush.scale.y = 0.75;
      bush.position.set(hx, 0.45, -D / 2 + 1 + i * (D - 2) / 4);
      add('site', bush, 'planting', 'Shrub', { anim: 'grow' });
    }
  }
  if (spec.outdoor.includes('garden')) {
    const flowerCols = [0xd9534f, 0xf0ad4e, 0xf3e9dc, 0xb07cc6];
    for (const sd of [-1, 1]) {
      const bx = gx + sd * (driveW / 2 + 4.5);
      add('site', _at(_box(3, 0.18, 7, M.get('soil', 0x4a3a2c, [1, 2])), bx, 0.09, -D / 2 - 15), 'planting', 'Flower bed');
      for (let i = 0; i < 14; i++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), M.plain(flowerCols[i % 4], { roughness: 0.8, flatShading: true }));
        fl.position.set(bx - 1.1 + (i % 4) * 0.75, 0.35, -D / 2 - 18 + Math.floor(i / 4) * 1.9);
        add('site', fl, 'planting', 'Flowering shrub', { anim: 'grow' });
      }
    }
  }

  // pool
  {
    const p = spec.pool, pw = p.w, pd = p.d;
    add('site', _at(_box(pw, 0.04, pd, M.get('poolTile', 0x3fa9c9, [pw / 2, pd / 2])), p.x, 0.02, p.z), 'pool', 'Pool shell');
    add('site', _at(_box(pw, 0.05, pd, M.water()), p.x, 0.07, p.z), 'pool', 'Swimming pool', { noCast: true });
    const dk = 3.2;
    [[pw + dk * 2, dk, 0, -(pd / 2 + dk / 2)], [pw + dk * 2, dk, 0, pd / 2 + dk / 2], [dk, pd, -(pw / 2 + dk / 2), 0], [dk, pd, pw / 2 + dk / 2, 0]].forEach(([w, d, x, z]) =>
      add('site', _at(_box(w, 0.14, d, travM(w, d)), p.x + x, 0.07, p.z + z), 'paving', 'Travertine pool deck'));
    const lounger = () => {
      const g = new THREE.Group();
      g.add(_at(_box(0.7, 0.08, 1.9, M.get('timber', 0x8a6444, [0.3, 0.6])), 0, 0.32, 0));
      g.add(_at(_box(0.66, 0.08, 1.3, M.get('fabric', 0xf1ede6, [1, 1])), 0, 0.4, 0.25));
      const back = _at(_box(0.66, 0.08, 0.7, M.get('fabric', 0xf1ede6, [1, 1])), 0, 0.58, -0.68); back.rotation.x = 0.7; g.add(back);
      for (const sx of [-0.3, 0.3]) for (const sz of [-0.8, 0.8]) g.add(_at(_box(0.05, 0.3, 0.05, black), sx, 0.15, sz));
      return g;
    };
    const n = Math.min(5, Math.floor(pw / 2.2));
    for (let i = 0; i < n; i++) {
      const l = lounger();
      l.position.set(p.x - pw / 2 + 1.2 + i * 2.1, 0.14, p.z + pd / 2 + 1.6);
      l.rotation.y = Math.PI;
      add('site', l, 'outdoor', 'Sun lounger');
    }
    const umb = _grp(_at(_cyl(0.03, 0.03, 2.5, black, 8), 0, 1.25, 0), _at(new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 12), M.get('fabric', 0xe9e1d3, [1, 1])), 0, 2.5, 0));
    umb.position.set(p.x + pw / 2 - 1.2, 0.14, p.z + pd / 2 + 1.7);
    add('site', umb, 'outdoor', 'Parasol');
    lightsSpec.push({ x: p.x, y: 0.4, z: p.z, color: 0x7fd8ff, base: 1.2, dist: Math.max(pw, pd) * 0.9, floor: -1 });
  }
  if (spec.outdoor.includes('terrace')) {
    const tw = Math.min(W * 0.7, 14), td = 3;
    const tz = D / 2 + wallT / 2 + td / 2;
    add('site', _at(_box(tw, 0.3, td, deckM(tw, td)), -W * 0.1, PLINTH - 0.15, tz), 'paving', 'Timber terrace');
    const table = _grp(_at(_box(1.8, 0.05, 0.9, M.get('timber', 0x8a6444, [0.6, 0.3])), 0, 0.74, 0), _at(_box(0.08, 0.72, 0.7, black), -0.7, 0.36, 0), _at(_box(0.08, 0.72, 0.7, black), 0.7, 0.36, 0));
    table.position.set(-W * 0.1, PLINTH, tz);
    add('site', table, 'outdoor', 'Outdoor dining table');
  }
  if (spec.isHome && lux <= 3) {
    const px = spec.pool.x - spec.pool.w / 2 - 7, pz = spec.pool.z;
    add('site', _at(_box(6, 0.08, 5, M.plain(0x3d6b45, { roughness: 1 })), px, 0.04, pz), 'paving', 'Play surface');
    const fm = M.plain(0x2f3a45, { roughness: 0.5, metalness: 0.5 });
    const swing = _grp(_at(_box(0.1, 2.4, 0.1, fm), -1.2, 1.2, 0), _at(_box(0.1, 2.4, 0.1, fm), 1.2, 1.2, 0), _at(_box(2.5, 0.1, 0.1, fm), 0, 2.38, 0),
      _at(_box(0.5, 0.05, 0.2, M.plain(0xd9734a)), -0.5, 0.5, 0), _at(_box(0.5, 0.05, 0.2, M.plain(0xd9734a)), 0.5, 0.5, 0));
    swing.position.set(px, 0, pz);
    add('site', swing, 'playground', 'Swing set');
  }

  // boundary wall + gate
  const bwM = len => M.get('plaster', 0xe4ddd1, [len / 3, 0.7]);
  const fenceH = 2.2;
  const segWall = (x0, z0, x1, z1, side) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const horiz = Math.abs(z1 - z0) < 0.01;
    const n = Math.max(1, Math.round(len / 6));
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const sx = lerp(x0, x1, a), sz = lerp(z0, z1, a), ex = lerp(x0, x1, b), ez = lerp(z0, z1, b);
      const l = len / n;
      const m = _at(_box(horiz ? l : 0.25, fenceH, horiz ? 0.25 : l, bwM(l)), (sx + ex) / 2, fenceH / 2, (sz + ez) / 2);
      add('site', m, 'boundary', 'Boundary wall');
      add('site', _at(_box(horiz ? l + 0.02 : 0.35, 0.08, horiz ? 0.35 : l + 0.02, trimM), (sx + ex) / 2, fenceH + 0.04, (sz + ez) / 2), 'roof_ridge', 'Wall coping');
      add('site', _at(_box(0.45, fenceH + 0.3, 0.45, bwM(0.5)), ex, (fenceH + 0.3) / 2, ez), 'pillar', 'Boundary pillar');
    }
  };
  const gateHalf = driveW / 2 + 1.2;
  segWall(cMinX, cMinZ, gx - gateHalf, cMinZ);
  segWall(gx + gateHalf, cMinZ, cMaxX, cMinZ);
  segWall(cMinX, cMaxZ, cMaxX, cMaxZ);
  segWall(cMinX, cMinZ, cMinX, cMaxZ);
  segWall(cMaxX, cMinZ, cMaxX, cMaxZ);
  const stoneM = M.get('stone', 0x8f877b, [0.4, 1]);
  for (const sd of [-1, 1]) {
    add('site', _at(_box(0.9, 3.2, 0.9, stoneM), gx + sd * gateHalf, 1.6, cMinZ), 'pillar', 'Gate pillar');
    add('site', _at(_box(1.1, 0.14, 1.1, trimM), gx + sd * gateHalf, 3.27, cMinZ), 'roof_ridge', 'Pillar cap');
    add('site', _at(_box(0.3, 0.2, 0.12, lampM), gx + sd * gateHalf, 2.6, cMinZ - 0.5), 'light', 'Pillar light');
    const cam = _grp(_box(0.16, 0.12, 0.26, black), _at(_cyl(0.045, 0.045, 0.05, M.plain(0x0a0c10, { roughness: 0.1 }), 10), 0, 0, -0.15));
    cam.children[1].rotation.x = Math.PI / 2;
    cam.position.set(gx + sd * gateHalf, 3.0, cMinZ - 0.55);
    cam.rotation.y = sd * 0.5;
    add('site', cam, 'camera', 'Security camera');
    const leaf = new THREE.Group();
    const lw = gateHalf - 0.45;
    leaf.add(_at(_box(lw, 0.08, 0.08, black), 0, 2.3, 0));
    leaf.add(_at(_box(lw, 0.08, 0.08, black), 0, 0.15, 0));
    for (let i = 0; i <= 12; i++) leaf.add(_at(_box(0.035, 2.2, 0.035, black), -lw / 2 + i * lw / 12, 1.22, 0));
    leaf.add(_at(_box(lw, 0.5, 0.04, M.get('timber', 0x7a5434, [0.5, 0.2])), 0, 1.6, 0));
    leaf.position.set(gx + sd * (lw / 2 + 0.05), 0, cMinZ);
    add('site', leaf, 'gate', 'Automated gate leaf');
  }

  // cars arrive last
  const carColors = lux >= 4 ? [0x1c2430, 0x6b6e72] : [0xd8dadc, 0x3a4652];
  const mkCar = color => {
    const g = new THREE.Group();
    const paint = M.plain(color, { roughness: 0.22, metalness: 0.65 });
    const glassCar = M.glass(0x111820);
    const body = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.85, 0.62, 4.5, 3, 0.18), paint); body.position.y = 0.52; g.add(body);
    const cabin = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.6, 0.55, 2.3, 3, 0.2), glassCar); cabin.position.set(0, 1.05, 0.15); g.add(cabin);
    const roofC = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.5, 0.08, 1.8, 2, 0.04), paint); roofC.position.set(0, 1.33, 0.2); g.add(roofC);
    const tyre = M.plain(0x141414, { roughness: 0.9 });
    const rim = M.plain(0xb8bcc0, { roughness: 0.3, metalness: 1 });
    for (const [x, z] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.45], [0.85, -1.45]]) {
      const wh = _at(_cyl(0.34, 0.34, 0.24, tyre, 18), x, 0.34, z); wh.rotation.z = Math.PI / 2; g.add(wh);
      const rr = _at(_cyl(0.2, 0.2, 0.25, rim, 12), x * 1.01, 0.34, z); rr.rotation.z = Math.PI / 2; g.add(rr);
    }
    for (const sx of [-0.62, 0.62]) {
      g.add(_at(_box(0.35, 0.1, 0.04, M.lampGlow(0xffffff)), sx, 0.62, -2.25));
      g.add(_at(_box(0.4, 0.08, 0.04, M.plain(0x8a1010, { emissive: 0x6a0a0a, emissiveIntensity: 0.6 })), sx, 0.68, 2.25));
    }
    return g;
  };
  carColors.forEach((c, i) => {
    const car = mkCar(c);
    let tx, tz, ty;
    if (spec.garage) { tx = spec.garage.x + (i === 0 ? -1.4 : 1.4); tz = spec.garage.z + 0.3; ty = PLINTH; }
    else { tx = gx + (i === 0 ? -3.2 : 3.2); tz = -D / 2 - 6; ty = 0.08; }
    car.position.set(tx, ty, tz);
    car.rotation.y = Math.PI;
    add('site', car, 'car', 'Vehicle', { anim: 'drive', drive: { from: new THREE.Vector3(gx + (i ? 1.2 : -1.2), 0.08, gateZ - 6) } });
  });

  /* ---------- static context: street + neighbourhood ---------- */
  const extras = [];
  const roadZ = gateZ - 9;
  const road = _at(_box(600, 0.04, 9, M.get('asphalt', 0x3c3d3f, [150, 2.2])), 0, 0.02, roadZ);
  road.receiveShadow = true;
  extras.push(road);
  for (let x = -150; x < 150; x += 6) extras.push(_at(_box(3, 0.045, 0.14, M.plain(0xe8e4da, { roughness: 0.7 })), x, 0.025, roadZ));
  for (const sd of [-1, 1]) extras.push(_at(_box(600, 0.12, 2.4, M.get('paving', 0xc9c3b6, [200, 1])), 0, 0.06, roadZ + sd * 5.7));
  for (let x = -90; x <= 90; x += 22) {
    const pole = _grp(_at(_cyl(0.07, 0.1, 6.5, black, 8), 0, 3.25, 0), _at(_box(1.4, 0.1, 0.25, black), -0.6, 6.45, 0), _at(_box(0.5, 0.05, 0.2, lampM), -1.1, 6.38, 0));
    pole.position.set(x + gx, 0, roadZ + 5.2);
    extras.push(pole);
  }
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2;
    const rr = Math.max(B.maxX - B.minX, B.maxZ - B.minZ) * 0.75 + 20 + (i % 3) * 9;
    const tx = Math.cos(a) * rr, tz = (B.minZ + B.maxZ) / 2 + Math.sin(a) * rr;
    if (Math.abs(tz - roadZ) < 9) continue;
    const t = palms && i % 2 ? makePalm(7 + (i % 3), SITE) : makeTree(7 + (i % 4), SITE, treeKind);
    t.position.set(tx, 0, tz);
    extras.push(t);
  }
  extras.forEach(o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }));

  // construction soil (fades away at landscaping)
  const soilW = cMaxX - cMinX, soilD = cMaxZ - cMinZ;
  const soil = _at(new THREE.Mesh(new THREE.PlaneGeometry(soilW, soilD), M.get('soil', 0x7a5f45, [soilW / 8, soilD / 8], { transparent: true })), (cMinX + cMaxX) / 2, 0.012, (cMinZ + cMaxZ) / 2);
  soil.rotation.x = -Math.PI / 2;
  soil.receiveShadow = true;
  soil.renderOrder = -1;
  extras.push(soil);

  const crane = buildCrane(spec, new THREE.Vector3(W / 2 + 4, 0, D / 2 + 3.5));
  extras.push(crane.root);
  extras.forEach(o => scene.add(o));

  /* ---------- lights ---------- */
  const lights = lightsSpec.map(ls => {
    const l = new THREE.PointLight(ls.color, ls.base, ls.dist, 2);
    l.position.set(ls.x, ls.y, ls.z);
    l.userData = { base: ls.base, floor: ls.floor, baseY: ls.y };
    scene.add(l);
    return l;
  });

  Object.values(groups).forEach(g => scene.add(g));
  scene.updateMatrixWorld(true);

  // per-unit metrics for the timeline
  const bb = new THREE.Box3(), wp = new THREE.Vector3();
  units.forEach(u => {
    bb.setFromObject(u.obj);
    u.obj.getWorldPosition(wp);
    u.minY = bb.min.y - wp.y;
    u.height = Math.max(0.01, bb.max.y - bb.min.y);
    u.center = bb.getCenter(new THREE.Vector3());
    const ly = u.center.y - (u.phase === 'site' ? 0 : PLINTH);
    u.floor = u.phase === 'site' ? 0 : clamp(Math.floor((ly + 0.1) / FLOOR_H), 0, spec.floors);
    u.base = { x: u.obj.position.x, y: u.obj.position.y, z: u.obj.position.z, sx: u.obj.scale.x, sy: u.obj.scale.y, sz: u.obj.scale.z };
  });

  scene3d.groups = groups;
  scene3d.spec = spec;
  scene3d.extras = extras;
  scene3d.interiorLights = lights;
  scene3d.matCounts = matCounts;
  fitSunShadow();
  setLighting(scene3d.lighting);
  return { groups, units, labels, crane, soil, lights };
}
