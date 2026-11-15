const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const FLOOR_H = 3.25;
const PLINTH = 0.28;
const ease = { outCubic: t => 1 - (1 - t) ** 3, inOutCubic: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2 };
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const STYLE_THEME = {
  modern: { label: 'Warm modern', wall: { kind: 'plaster', color: 0xe9e3d6 }, wing: { kind: 'timber', color: 0x815c3c }, trim: 0x383a35, frame: 0x333832, roof: 0x827f70, swatch: ['#e9e3d6', '#815c3c', '#383a35'] },
  minimalist: { label: 'Quiet minimal', wall: { kind: 'concrete', color: 0xc8c5bb }, wing: { kind: 'plaster', color: 0xf3efe4 }, trim: 0x4c4e49, frame: 0x3c3d39, roof: 0x98988d, swatch: ['#c8c5bb', '#f3efe4', '#4c4e49'] },
  luxury: { label: 'Sculpted luxury', wall: { kind: 'stone', color: 0xe0d3b6 }, wing: { kind: 'timber', color: 0x60432e }, trim: 0x8b704b, frame: 0x504131, roof: 0x766956, swatch: ['#e0d3b6', '#60432e', '#b29361'] },
  scandinavian: { label: 'Nordic retreat', wall: { kind: 'timber', color: 0x454942 }, wing: { kind: 'timber', color: 0xc29a6c }, trim: 0x292e2a, frame: 0xd4c9af, roof: 0x343c37, swatch: ['#454942', '#c29a6c', '#d4c9af'] },
  futuristic: { label: 'Future forms', wall: { kind: 'plaster', color: 0xf0eee7 }, wing: { kind: 'metal', color: 0x545f60 }, trim: 0x344447, frame: 0x283a3d, roof: 0x5a6b6b, swatch: ['#f0eee7', '#545f60', '#283a3d'] },
};
const PHASES = [
  { key: 'foundation', name: 'Groundwork', desc: 'Setting out the footprint and foundation.' },
  { key: 'frame', name: 'Structure', desc: 'Columns and floor plates rise into place.' },
  { key: 'walls', name: 'Envelope', desc: 'The architectural form takes shape.' },
  { key: 'roof', name: 'Roofscape', desc: 'Roof planes, terraces and parapets.' },
  { key: 'fixtures', name: 'Glazing', desc: 'Window frames and entrance details.' },
  { key: 'interior', name: 'Finishes', desc: 'Timber, stone and interior surfaces.' },
  { key: 'furniture', name: 'Interiors', desc: 'Rooms are furnished and styled.' },
  { key: 'site', name: 'Landscape', desc: 'Planting and selected outdoor spaces.' },
];
const PHASE_KEYS = PHASES.map(p => p.key);
const PURPOSES = { residential: 'Private residence', vacation: 'Vacation retreat', office: 'Creative workspace', commercial: 'Retail & commercial', hotel: 'Boutique hotel', warehouse: 'Industrial & logistics', mixed: 'Mixed-use development' };
const FORMS = {
  court: { name: 'Courtyard house', desc: 'Two wings embrace an open-air court. Recessed upper floors create sheltered terraces.', cells: [[0,0],[0,1],[0,2],[1,2],[2,2],[2,1],[2,0]] },
  elbow: { name: 'Garden-wing residence', desc: 'An asymmetric L-shaped plan separates quiet rooms from shared living spaces.', cells: [[0,0],[0,1],[0,2],[1,2],[2,2]] },
  pavilion: { name: 'Connected pavilions', desc: 'A cluster of pitched-roof volumes connected around a central gathering space.', cells: [[0,0],[0,1],[1,1],[2,1],[2,2]] },
  terrace: { name: 'Stepped terraces', desc: 'A staggered footprint with overlapping volumes and generous roof terraces.', cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] },
  atrium: { name: 'Atrium workspace', desc: 'Daylit wings wrap an open courtyard, with shared space linking the work areas.', cells: [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]] },
  gallery: { name: 'Gallery & courtyard', desc: 'A welcoming central gallery branches into distinct commercial pavilions.', cells: [[0,0],[1,0],[2,0],[1,1],[0,2],[1,2],[2,2]] },
  sawtooth: { name: 'Sawtooth works', desc: 'Repeated northlight-inspired roof bays and a projecting office wing break up the industrial form.', cells: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2],[2,2]] },
};
function chooseForm(fd) {
  if (fd.purpose === 'warehouse') return 'sawtooth';
  if (fd.purpose === 'hotel') return 'court';
  if (fd.purpose === 'office') return fd.budget / fd.floors > 350000 ? 'atrium' : 'terrace';
  if (fd.purpose === 'commercial') return 'gallery';
  if (fd.purpose === 'mixed') return 'atrium';
  if (fd.style === 'scandinavian' || fd.purpose === 'vacation') return 'pavilion';
  if (fd.style === 'futuristic' || fd.style === 'minimalist') return 'terrace';
  return fd.budget / fd.floors >= 300000 && fd.luxury >= 3 ? 'court' : 'elbow';
}
function buildHouseSpec(fd) {
  const form = chooseForm(fd), profile = FORMS[form], theme = STYLE_THEME[fd.style];
  const home = ['residential', 'vacation'].includes(fd.purpose);
  const upper = profile.cells.map(c => [...c]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < upper.length; i++) {
      const candidate = upper.filter((_, j) => j !== i), connected = [candidate[0]];
      for (let k = 0; k < connected.length; k++) {
        candidate.forEach(c => { if (!connected.includes(c) && Math.abs(c[0] - connected[k][0]) + Math.abs(c[1] - connected[k][1]) === 1) connected.push(c); });
      }
      if (connected.length === candidate.length) { upper.splice(i, 1); break; }
    }
  }
  const cellsByFloor = Array.from({ length: fd.floors }, (_, f) => f && fd.purpose !== 'warehouse' ? upper : profile.cells);
  const count = cellsByFloor.reduce((n, cells) => n + cells.length, 0);
  const requested = home ? fd.bedrooms + fd.bathrooms + 2 : 0;
  if (requested > count) throw new Error(`This form has ${count} rooms. Reduce the bedroom/bathroom count or add another floor.`);
  const rate = ({ residential: 950, vacation: 1050, office: 1100, commercial: 900, hotel: 1350, warehouse: 550, mixed: 1150 }[fd.purpose]) * [0, .8, .9, 1, 1.2, 1.45][fd.luxury] * ({ modern: 1, minimalist: .94, luxury: 1.18, scandinavian: 1.04, futuristic: 1.15 }[fd.style]);
  const outdoorCost = fd.outdoor.reduce((n, k) => n + ({ pool: 28000, garden: 7000, terrace: 9000 }[k] || 0), 0);
  const usable = fd.budget / 1.12 - outdoorCost;
  const aspect = form === 'sawtooth' ? 1.15 : form === 'pavilion' ? .86 : 1.03;
  const maxW = (fd.width - 4) / 3;
  const maxD = (fd.depth - (fd.outdoor.includes('pool') ? 12 : 7)) / 3;
  const cw = Math.floor(Math.min(Math.sqrt(Math.max(0, usable) / rate / count * aspect), maxW, maxD * aspect) * 100) / 100;
  const cd = Math.floor(cw / aspect * 100) / 100;
  if (Math.min(cw, cd) < 4.8) {
    const minBudget = Math.ceil((count * 4.8 * 4.8 * Math.max(aspect, 1 / aspect) * rate + outdoorCost) * 1.12 / 1000) * 1000;
    throw new Error(`Not enough space or budget for this brief. Try fewer floors, a larger plot, or a budget of about ${money(minBudget)} or more. Rooms need at least 4.8 m on each side.`);
  }
  const W = cw * 3, D = cd * 3;
  const rooms = [], byFloor = [];
  cellsByFloor.forEach((cells, floor) => {
    const list = cells.map(([gx, gz], i) => {
      const cx = (gx - 1) * cw, cz = (gz - 1) * cd;
      const r = { id: `f${floor}-${gx}-${gz}`, floor, gx, gz, cx, cz, x0: cx - cw/2, x1: cx + cw/2, z0: cz - cd/2, z1: cz + cd/2, band: 'front', type: 'study', label: 'Reading room', neighbors: [] };
      rooms.push(r); return r;
    });
    byFloor.push(list);
  });
  rooms.forEach(r => { r.neighbors = byFloor[r.floor].filter(n => Math.abs(n.gx-r.gx) + Math.abs(n.gz-r.gz) === 1).map(n => n.id); });
  const entry = byFloor[0].slice().sort((a,b) => a.gz-b.gz || Math.abs(a.gx-1)-Math.abs(b.gx-1))[0];
  if (home) {
    entry.type = 'living'; entry.label = 'Living & lounge';
    const kitchen = byFloor[0].find(r => r !== entry); kitchen.type = 'kitchen'; kitchen.label = 'Kitchen & dining';
    const available = rooms.filter(r => r !== entry && r !== kitchen).sort((a,b) => b.floor-a.floor);
    for (let i=0; i<fd.bedrooms; i++) { const r=available.shift(); r.type='bedroom'; r.label=i ? `Bedroom ${i+1}` : 'Primary suite'; }
    for (let i=0; i<fd.bathrooms; i++) { const r=available.shift(); r.type='bath'; r.isBathroom=true; r.label=`Bathroom ${i+1}`; }
    const extras=['Library','Home office','Family lounge','Creative studio','Guest lounge'];
    available.forEach((r,i)=>{r.label=extras[i%extras.length]+(i>=extras.length?' '+(Math.floor(i/extras.length)+1):'');r.type=i%3===2?'living':'study';});
  } else {
    rooms.forEach((r,i) => {
      r.type = fd.purpose === 'hotel' ? 'bedroom' : fd.purpose === 'warehouse' ? 'warehouse' : fd.purpose === 'commercial' || fd.purpose === 'mixed' && !r.floor ? 'retail' : 'office';
      r.label = fd.purpose === 'hotel' ? `Guest suite ${i+1}` : fd.purpose === 'warehouse' ? `Storage bay ${i+1}` : fd.purpose === 'commercial' ? `Showroom ${i+1}` : `Workspace ${i+1}`;
    });
    entry.type='living'; entry.label=fd.purpose === 'hotel' ? 'Reception lounge' : 'Welcome lounge';
    const last=rooms[rooms.length-1]; last.type='bath'; last.isBathroom=true; last.label='Washroom';
  }
  const area = count*cw*cd, baseCost=area*rate, contingency=(baseCost+outdoorCost)*.12;
  return { fd, theme, style:fd.style, purpose:fd.purpose, lux:fd.luxury, isHome:home, isOffice:['office','commercial','mixed'].includes(fd.purpose), isHotel:fd.purpose==='hotel', isWarehouse:fd.purpose==='warehouse', formType:form, formName:profile.name, description:profile.desc, floors:fd.floors, W,D,cw,cd, wallH:fd.floors*FLOOR_H, roofH:2.8, outdoor:fd.outdoor, rooms, roomPlan:byFloor, entry, area, rate, baseCost, outdoorCost, contingency, cost:baseCost+outdoorCost+contingency, bounds:{ minX:-fd.width/2, maxX:fd.width/2, minZ:-D/2-4, maxZ:-D/2-4+fd.depth } };
}
function findRoom(spec, id) { return spec.rooms.find(r => r.id === id); }
function roomPath(spec, startId, endId) {
  const queue = [[startId]], seen = new Set([startId]);
  while(queue.length) {
    const path=queue.shift(), id=path[path.length-1];
    if(id===endId) return path.map(k=>findRoom(spec,k));
    for(const next of findRoom(spec,id).neighbors) if(!seen.has(next)) { seen.add(next); queue.push([...path,next]); }
  }
  return [];
}
