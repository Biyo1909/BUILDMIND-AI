/* ============================================================
   BuildMind AI — core data: state, pricing, style themes, house spec
   ============================================================ */

const state = {
  step: 1,
  outdoor: new Set(['pool', 'garden']),
  style: 'modern',
  formData: null,
  chosenOption: null,
  tiers: null,
  currency: { code: 'USD', symbol: '$', rate: 1, mult: 1 },
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inCubic: t => t * t * t,
};

/* ---------------- location → currency + cost level ---------------- */
const LOCATION_DB = [
  { keys: ['nigeria', 'lagos', 'abuja', 'port harcourt', 'kano', 'ibadan', 'lekki', 'ikoyi'], city: 'Lagos', code: 'NGN', symbol: '₦', rate: 1600, mult: 0.22 },
  { keys: ['ghana', 'accra', 'kumasi'], city: 'Accra', code: 'GHS', symbol: 'GH₵', rate: 15.5, mult: 0.28 },
  { keys: ['kenya', 'nairobi', 'mombasa'], city: 'Nairobi', code: 'KES', symbol: 'KSh', rate: 130, mult: 0.30 },
  { keys: ['south africa', 'johannesburg', 'cape town', 'durban', 'pretoria'], city: 'Johannesburg', code: 'ZAR', symbol: 'R', rate: 18.5, mult: 0.45 },
  { keys: ['united kingdom', 'uk', 'london', 'manchester', 'birmingham', 'england', 'scotland'], city: 'London', code: 'GBP', symbol: '£', rate: 0.79, mult: 1.35 },
  { keys: ['euro', 'germany', 'france', 'spain', 'italy', 'netherlands', 'portugal', 'ireland', 'belgium', 'austria', 'berlin', 'paris', 'madrid'], city: 'Europe', code: 'EUR', symbol: '€', rate: 0.92, mult: 1.25 },
  { keys: ['india', 'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai'], city: 'Mumbai', code: 'INR', symbol: '₹', rate: 83, mult: 0.18 },
  { keys: ['uae', 'dubai', 'abu dhabi', 'sharjah'], city: 'Dubai', code: 'AED', symbol: 'AED ', rate: 3.67, mult: 0.95 },
  { keys: ['saudi', 'riyadh', 'jeddah'], city: 'Riyadh', code: 'SAR', symbol: 'SAR ', rate: 3.75, mult: 0.85 },
  { keys: ['canada', 'toronto', 'vancouver', 'montreal'], city: 'Toronto', code: 'CAD', symbol: 'C$', rate: 1.37, mult: 1.05 },
  { keys: ['australia', 'sydney', 'melbourne', 'brisbane'], city: 'Sydney', code: 'AUD', symbol: 'A$', rate: 1.52, mult: 1.15 },
  { keys: ['china', 'beijing', 'shanghai', 'shenzhen'], city: 'Shanghai', code: 'CNY', symbol: '¥', rate: 7.2, mult: 0.55 },
  { keys: ['japan', 'tokyo', 'osaka'], city: 'Tokyo', code: 'JPY', symbol: '¥', rate: 150, mult: 1.40 },
  { keys: ['singapore'], city: 'Singapore', code: 'SGD', symbol: 'S$', rate: 1.35, mult: 1.30 },
  { keys: ['brazil', 'sao paulo', 'rio'], city: 'São Paulo', code: 'BRL', symbol: 'R$', rate: 5.1, mult: 0.40 },
  { keys: ['mexico', 'mexico city', 'guadalajara'], city: 'Mexico City', code: 'MXN', symbol: 'MX$', rate: 17, mult: 0.35 },
];

function resolveLocation(locStr) {
  const s = (locStr || '').toLowerCase().trim();
  for (const e of LOCATION_DB) {
    if (e.keys.some(k => s.includes(k))) return { code: e.code, symbol: e.symbol, rate: e.rate, mult: e.mult };
  }
  return { code: 'USD', symbol: '$', rate: 1, mult: 1.0 };
}

function formatMoney(amount, cur) {
  const n = Math.round(amount);
  const sym = cur.symbol;
  if (Math.abs(n) >= 1e9) return sym + (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return sym + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e4) return sym + (n / 1e3).toFixed(1) + 'K';
  return sym + n.toLocaleString();
}

function formatMoneyFull(amount, cur) {
  return cur.symbol + Math.round(amount).toLocaleString();
}

const PURPOSE_COST_USD = {
  residential: 280, vacation: 320, office: 380, commercial: 340,
  hotel: 520, warehouse: 160, mixed: 420,
};

function labelForPurpose(p) {
  return {
    residential: 'residence', vacation: 'vacation home', office: 'office',
    commercial: 'commercial building', hotel: 'hotel', warehouse: 'warehouse',
    mixed: 'mixed-use building',
  }[p] || 'building';
}

/* ---------------- construction phases ---------------- */
const PHASES = [
  { key: 'foundation', name: 'Foundation & groundworks', short: 'Foundation', desc: 'Setting out, reinforced footings and the ground-bearing slab.', weight: 0.12, dur: 4.5 },
  { key: 'frame', name: 'Structural frame', short: 'Frame', desc: 'Reinforced concrete columns and suspended slabs, floor by floor.', weight: 0.17, dur: 6 },
  { key: 'walls', name: 'Walls & envelope', short: 'Walls', desc: 'Blockwork and façade finishes enclose every storey.', weight: 0.15, dur: 7.5 },
  { key: 'roof', name: 'Roofing', short: 'Roof', desc: 'Roof deck, waterproofing and coverings make the shell weather-tight.', weight: 0.10, dur: 5 },
  { key: 'fixtures', name: 'Doors, windows & glazing', short: 'Glazing', desc: 'High-performance glazing, entrance doors and balconies go in.', weight: 0.10, dur: 5 },
  { key: 'interior', name: 'Interior fit-out', short: 'Fit-out', desc: 'Partitions, staircases, floor finishes and services first fix.', weight: 0.14, dur: 6 },
  { key: 'furniture', name: 'Interior styling', short: 'Styling', desc: 'Furniture, lighting and décor staged room by room.', weight: 0.08, dur: 7 },
  { key: 'site', name: 'Landscape & site works', short: 'Landscape', desc: 'Driveway, boundary wall, pool and planting complete the estate.', weight: 0.14, dur: 7 },
];
const PHASE_KEYS = PHASES.map(p => p.key);

/* ---------------- architectural style themes ---------------- */
// kind = procedural texture painter in materials.js
const STYLE_THEME = {
  modern: {
    label: 'Modern', blurb: 'Warm white render, timber accents, floor-to-ceiling glass.',
    wall: { kind: 'plaster', color: 0xebe6de }, wing: { kind: 'timber', color: 0x7a5434 },
    roofFlat: { kind: 'gravel', color: 0x8a8781 }, roofPitch: { kind: 'slate', color: 0x3a3d41 },
    trim: 0x2a2b2d, frame: 0x1b1c1e, door: { kind: 'woodPlank', color: 0x7a5232 },
    swatch: ['#EBE6DE', '#7A5434', '#2A2B2D'],
  },
  futuristic: {
    label: 'Futuristic', blurb: 'Bright monolithic forms, graphite volumes, cantilevers.',
    wall: { kind: 'plaster', color: 0xf3f4f5 }, wing: { kind: 'concrete', color: 0x55585d },
    roofFlat: { kind: 'gravel', color: 0x6d6f73 }, roofPitch: { kind: 'metal', color: 0x2d3034 },
    trim: 0x26292d, frame: 0x121315, door: { kind: 'metal', color: 0x2b2e33 },
    swatch: ['#F3F4F5', '#55585D', '#121315'],
  },
  minimalist: {
    label: 'Minimalist', blurb: 'Board-formed concrete, quiet lines, natural oak.',
    wall: { kind: 'concrete', color: 0xd0cbc2 }, wing: { kind: 'plaster', color: 0xf2efea },
    roofFlat: { kind: 'gravel', color: 0x8c8982 }, roofPitch: { kind: 'metal', color: 0x4a4a48 },
    trim: 0x2f2f2e, frame: 0x2b2b2b, door: { kind: 'woodPlank', color: 0xb58d62 },
    swatch: ['#D0CBC2', '#F2EFEA', '#2F2F2E'],
  },
  luxury: {
    label: 'Luxury', blurb: 'Limestone cladding, clay-tile hip roofs, bronze details.',
    wall: { kind: 'stone', color: 0xe2d3b8 }, wing: { kind: 'plaster', color: 0xf0e8d9 },
    roofFlat: { kind: 'gravel', color: 0x86817a }, roofPitch: { kind: 'tiles', color: 0x6a4535 },
    trim: 0xd8ccb4, frame: 0x2a221b, door: { kind: 'woodPlank', color: 0x4b2f1d },
    swatch: ['#E2D3B8', '#6A4535', '#C8A45A'],
  },
  scandinavian: {
    label: 'Scandinavian', blurb: 'Charred timber cladding, standing-seam roofs, white frames.',
    wall: { kind: 'timber', color: 0x35312d }, wing: { kind: 'timber', color: 0xb68b5e },
    roofFlat: { kind: 'gravel', color: 0x7b7975 }, roofPitch: { kind: 'metal', color: 0x2a2b2d },
    trim: 0xf1eee8, frame: 0xf1eee8, door: { kind: 'woodPlank', color: 0xb68b5e },
    swatch: ['#35312D', '#B68B5E', '#F1EEE8'],
  },
};

/* ---------------- pricing ---------------- */
const TIER_DEFS = [
  { key: 'economy', name: 'Essential', tagline: 'Value-engineered spec, local materials', mult: 0.78, luxDelta: -1 },
  { key: 'balanced', name: 'Signature', tagline: 'Balanced spec — our recommendation', mult: 1.0, luxDelta: 0 },
  { key: 'premium', name: 'Prestige', tagline: 'Premium finishes, statement architecture', mult: 1.48, luxDelta: 1 },
];

function estimateWeeks(area, floors) {
  return Math.round(clamp(14 + area / 38 + floors * 3.5, 16, 160));
}

function computeTiers(fd, cur) {
  const baseUsd = PURPOSE_COST_USD[fd.purpose] || 300;
  const area = fd.width * fd.depth;
  const floors = clamp(fd.floors || 1, 1, 12);
  const luxMult = [0, 0.72, 0.88, 1.0, 1.35, 1.85][clamp(fd.luxury, 1, 5)];
  const sustainMult = [0, 0.95, 0.98, 1.0, 1.12, 1.28][clamp(fd.sustain, 1, 5)];
  const styleMult = { modern: 1.0, futuristic: 1.25, minimalist: 0.95, luxury: 1.55, scandinavian: 1.05 }[fd.style] || 1;
  const totalArea = area * floors * 0.82;
  return TIER_DEFS.map(t => {
    const costPerSqmUsd = baseUsd * t.mult * luxMult * sustainMult * styleMult * cur.mult;
    const costUsd = costPerSqmUsd * totalArea;
    return {
      tier: t.key, name: t.name, tagline: t.tagline, floors, luxDelta: t.luxDelta,
      cost: Math.round(costUsd * cur.rate),
      costUsd: Math.round(costUsd),
      area: Math.round(totalArea),
      costPerSqm: Math.round(costPerSqmUsd * cur.rate),
      weeks: Math.round(estimateWeeks(totalArea, floors) * (t.key === 'premium' ? 1.15 : t.key === 'economy' ? 0.92 : 1)),
    };
  });
}

/* ---------------- house spec (pure data) ---------------- */
const UNIT = 3;
const FLOOR_H = 3.1;
const PLINTH = 0.45;

function distributeEvenly(total, buckets) {
  const base = Math.floor(total / buckets), rem = total % buckets;
  const arr = new Array(buckets).fill(base);
  for (let i = 0; i < rem; i++) arr[buckets - 1 - i]++;
  return arr;
}

// Two bands per floor: front (living / day rooms) and back (bedrooms, baths).
function planRooms(gridSpec) {
  const { W, D, floors, fd } = gridSpec;
  const homeLike = ['residential', 'vacation'].includes(fd.purpose);
  const totalBed = clamp(fd.bedrooms || 1, 0, 12);
  const totalBath = clamp(fd.bathrooms || 1, 0, 12);
  const bedPerFloor = distributeEvenly(totalBed, floors);
  const bathPerFloor = distributeEvenly(totalBath, floors);
  const zSplit = -D / 2 + D * 0.55;
  let bedNo = 0;
  const byFloor = [];
  for (let f = 0; f < floors; f++) {
    const front = [], back = [];
    if (f === 0) {
      front.push({ label: homeLike ? 'Living room' : 'Reception', type: 'living', weight: 2.4 });
      if (homeLike) front.push({ label: 'Kitchen & dining', type: 'kitchen', weight: 1.5 });
    }
    for (let i = 0; i < bedPerFloor[f]; i++) {
      bedNo++;
      const isMaster = f === floors - 1 && i === 0;
      const item = { label: isMaster ? 'Master suite' : `Bedroom ${bedNo}`, type: 'bedroom', weight: isMaster ? 1.9 : 1.5 };
      (f === 0 || i % 2 === 1 ? back : front).push(item);
    }
    for (let i = 0; i < bathPerFloor[f]; i++) back.push({ label: `Bathroom ${i + 1 + (f > 0 ? bathPerFloor.slice(0, f).reduce((a, b) => a + b, 0) : 0)}`, type: 'bath', weight: 0.75, isBathroom: true });
    if (!front.length) front.push({ label: f === floors - 1 && homeLike ? 'Family lounge' : 'Open-plan floor', type: 'living', weight: 1.6 });
    if (!back.length) back.push({ label: 'Study', type: 'study', weight: 1 });

    const rects = [];
    const layout = (items, z0, z1, band) => {
      const total = items.reduce((s, it) => s + it.weight, 0);
      let cursor = -W / 2;
      items.forEach((it, idx) => {
        const w = (it.weight / total) * W;
        const x0 = cursor, x1 = idx === items.length - 1 ? W / 2 : cursor + w;
        cursor += w;
        const common = { x0, x1, floor: f, band, last: idx === items.length - 1 };
        if (it.isBathroom && z1 - z0 > 5) {
          const bz = z1 - 3.4;
          rects.push({ ...common, z0: z0, z1: bz, label: 'Walk-in wardrobe', type: 'closet', isBathroom: false, last: true, sub: true });
          rects.push({ ...common, z0: bz, z1, label: it.label, type: 'bath', isBathroom: true });
        } else {
          rects.push({ ...common, z0, z1, label: it.label, type: it.type, isBathroom: !!it.isBathroom });
        }
      });
    };
    layout(front, -D / 2, zSplit, 'front');
    layout(back, zSplit, D / 2, 'back');
    byFloor.push(rects);
  }
  byFloor.zSplit = zSplit;
  return byFloor;
}

function buildHouseSpec(opt) {
  const fd = opt.fd;
  const theme = STYLE_THEME[fd.style] || STYLE_THEME.modern;
  const lux = clamp(fd.luxury || 3, 1, 5);
  const style = fd.style || 'modern';
  const purpose = fd.purpose || 'residential';
  const isHome = ['residential', 'vacation'].includes(purpose);
  const isHotel = purpose === 'hotel';
  const isOffice = ['office', 'commercial', 'mixed'].includes(purpose);
  const isWarehouse = purpose === 'warehouse';

  let formType = 'box';
  if (isWarehouse) formType = 'shed';
  else if (isOffice) formType = lux >= 4 ? 'tower' : 'office-bar';
  else if (isHotel) formType = 'hotel-bar';
  else if (isHome) {
    if (style === 'modern' && lux >= 5) formType = 'courtyard';
    else if (style === 'modern' && lux >= 3) formType = 'l-villa';
    else if (style === 'scandinavian') formType = 'long-bar';
    else if (style === 'minimalist') formType = 'box';
    else if (style === 'luxury') formType = lux >= 4 ? 'grand-villa' : 'l-villa';
    else if (style === 'futuristic') formType = 'cantilever';
    else formType = lux >= 3 ? 'l-villa' : 'box';
  }

  let gridScale = lux >= 4 ? 3.0 : lux >= 3 ? 3.4 : 3.8;
  if (formType === 'long-bar' || formType === 'hotel-bar') gridScale *= 0.85;
  if (formType === 'shed') gridScale *= 0.75;
  if (formType === 'tower') gridScale *= 1.15;

  let gridX = clamp(Math.round(fd.width / gridScale), 5, 14);
  let gridZ = clamp(Math.round(fd.depth / gridScale), 4, 12);
  if (formType === 'long-bar' || formType === 'hotel-bar') {
    gridX = clamp(Math.round(gridX * 1.25), 7, 16);
    gridZ = clamp(Math.round(gridZ * 0.75), 4, 9);
  }
  if (formType === 'tower') { gridX = clamp(gridX, 6, 9); gridZ = clamp(gridZ, 6, 9); }
  if (formType === 'shed') { gridX = clamp(Math.round(gridX * 1.4), 9, 18); gridZ = clamp(Math.round(gridZ * 0.7), 5, 10); }

  let floors = clamp(opt.floors, 1, 12);
  if (formType === 'tower' && floors < 4) floors = 4;
  if (formType === 'shed') floors = 1;

  const W = gridX * UNIT;
  const D = gridZ * UNIT;
  const wallH = floors * FLOOR_H;

  let doorGX;
  if (['l-villa', 'courtyard', 'grand-villa'].includes(formType)) doorGX = clamp(Math.floor(gridX * 0.32), 1, gridX - 3);
  else if (formType === 'long-bar') doorGX = clamp(Math.floor(gridX * 0.2), 1, gridX - 3);
  else doorGX = clamp(Math.floor(gridX / 2), 1, gridX - 2);
  const door = { x: doorGX * UNIT - W / 2, z: -D / 2, gx: doorGX };

  let garage = null, wing = null, wing2 = null, cantilever = null, podium = null;
  if (['l-villa', 'courtyard', 'grand-villa'].includes(formType)) {
    const gW = Math.max(6.5, W * 0.34), gD = Math.max(6.5, D * 0.42);
    garage = { w: gW, d: gD, x: W / 2 + gW / 2 - 0.1, z: -D / 2 + gD / 2 - 0.1, h: FLOOR_H * 0.95 };
  }
  if (formType === 'long-bar') {
    const gW = Math.max(5.5, W * 0.2), gD = Math.max(5.5, D * 0.55);
    garage = { w: gW, d: gD, x: -W / 2 - gW / 2 + 0.15, z: -D / 2 + gD / 2, h: FLOOR_H * 0.85, open: true };
  }
  if (['l-villa', 'courtyard', 'grand-villa'].includes(formType) && floors >= 2) {
    const ww = W * (formType === 'courtyard' ? 0.38 : 0.42);
    wing = {
      w: ww, d: D * (formType === 'courtyard' ? 0.55 : 0.4),
      x: -W / 2 - ww / 2 + 0.15, z: formType === 'courtyard' ? D * 0.12 : D * 0.08,
      floors: Math.min(floors, formType === 'grand-villa' ? floors : 1),
    };
  }
  if ((formType === 'courtyard' || formType === 'grand-villa') && lux >= 4 && floors >= 2) {
    wing2 = { w: W * 0.34, d: D * 0.5, x: W / 2 + (W * 0.34) / 2 - 0.15, z: D * 0.2, floors: 1 };
  }
  if (formType === 'cantilever' && floors >= 2) {
    cantilever = { w: W * 0.7, d: 3.4, x: 0, z: -D / 2 - 1.5, y: FLOOR_H, h: FLOOR_H * Math.min(floors - 1, 2) };
  }
  if (formType === 'tower' && floors >= 4) {
    podium = { w: W * 1.25, d: D * 1.2, h: FLOOR_H * Math.min(2, floors - 1) };
  }

  const bigGlass = isOffice || isHotel || (['modern', 'futuristic'].includes(style) && lux >= 3) || (style === 'luxury' && lux >= 4);
  const win = bigGlass ? { w: 2.35, h: 2.25, y: 1.25 } : { w: 1.4, h: 1.5, y: 1.6 };
  const winStep = lux <= 2 && !isOffice ? 2 : 1;

  const insideVolume = (x, z, f) => {
    const inV = (v, floorsV) => v && f < floorsV && Math.abs(x - v.x) < v.w / 2 + 0.3 && Math.abs(z - v.z) < v.d / 2 + 0.3;
    return inV(garage, 1) || inV(wing, wing && wing.floors) || inV(wing2, wing2 && wing2.floors) ||
      (podium && f < podium.h / FLOOR_H);
  };

  const windows = [];
  for (let f = 0; f < floors; f++) {
    const wy = f * FLOOR_H + win.y;
    for (let gx = 1; gx < gridX; gx += winStep) {
      const x = gx * UNIT - W / 2;
      if (!(f === 0 && gx === doorGX) && !insideVolume(x, -D / 2, f)) windows.push({ x, y: wy, z: -D / 2, rot: 0, side: 'front', floor: f });
      if (!insideVolume(x, D / 2, f)) windows.push({ x, y: wy, z: D / 2, rot: Math.PI, side: 'back', floor: f });
    }
    for (let gz = 1; gz < gridZ; gz += winStep) {
      const z = gz * UNIT - D / 2;
      if (!insideVolume(-W / 2, z, f)) windows.push({ x: -W / 2, y: wy, z, rot: -Math.PI / 2, side: 'left', floor: f });
      if (!insideVolume(W / 2, z, f)) windows.push({ x: W / 2, y: wy, z, rot: Math.PI / 2, side: 'right', floor: f });
    }
  }

  let roofType = 'flat';
  if (formType === 'shed' || formType === 'long-bar') roofType = 'gable';
  else if (['tower', 'office-bar', 'hotel-bar'].includes(formType)) roofType = 'flat-stepped';
  else if (formType === 'cantilever') roofType = 'angular';
  else if (formType === 'courtyard') roofType = 'flat-stepped';
  else if (formType === 'grand-villa') roofType = 'hip';
  else if (formType === 'l-villa') roofType = style === 'modern' ? (lux >= 4 ? 'flat-stepped' : 'flat') : 'hip';
  else if (style === 'scandinavian') roofType = 'gable';
  else if (style === 'futuristic') roofType = 'angular';

  const roofH = (roofType === 'flat' || roofType === 'flat-stepped') ? 0.9 : 3 + lux * 0.3;
  const outdoor = fd.outdoor || [];
  const driveLen = Math.max(24, D * 0.7 + 14);

  // site extents
  const poolW = Math.max(10, W * 0.7), poolD = Math.max(5, D * 0.32);
  const poolZ = D / 2 + poolD / 2 + 4;
  let minX = -W / 2 - 8, maxX = W / 2 + 12, minZ = -D / 2 - driveLen - 8, maxZ = poolZ + poolD / 2 + 6;
  if (garage) { maxX = Math.max(maxX, garage.x + garage.w / 2 + 3); minX = Math.min(minX, garage.x - garage.w / 2 - 3); }
  if (wing) minX = Math.min(minX, wing.x - wing.w / 2 - 3);
  if (wing2) maxX = Math.max(maxX, wing2.x + wing2.w / 2 + 3);
  if (podium) { maxX = Math.max(maxX, podium.w / 2 + 3); minX = Math.min(minX, -podium.w / 2 - 3); }
  minX = Math.min(minX, -poolW / 2 - 12);
  maxX = Math.max(maxX, poolW / 2 + 6);

  const spec = {
    fd, theme, gridX, gridZ, floors, W, D, wallH, roofH, roofType,
    door, windows, win, outdoor, driveLen, lux, bigGlass,
    pool: { w: poolW, d: poolD, x: 0, z: poolZ },
    bounds: { minX, maxX, minZ, maxZ },
    formType, garage, wing, wing2, cantilever, podium,
    isHome, isOffice, isHotel, isWarehouse, style, purpose,
  };
  spec.roomPlan = planRooms(spec);
  const stairs = floors >= 2 ? (() => {
    const first = spec.roomPlan[0][0];
    const x = clamp(first.x1 - 1.1, first.x0 + 0.9, first.x1 - 0.8);
    const z1 = spec.roomPlan.zSplit - 0.35;
    return { x, w: 1.2, z0: z1 - 3.9, z1 };
  })() : null;
  spec.stairs = stairs;
  return spec;
}
