window.addEventListener('error', e => {
  console.error('BuildMind script error:', e.message, 'at line', e.lineno);
});

const state = {
  step: 1,
  outdoor: new Set(),
  style: 'modern',
  formData: null,
  chosenOption: null,
  currency: { code: 'USD', symbol: '$', rate: 1 },
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

function goToStep(n) {
  state.step = n;
  $$('.wizard-step').forEach(s => s.classList.toggle('active', +s.dataset.step === n));
  $$('.wp-step').forEach(s => s.classList.toggle('active', +s.dataset.step <= n));
  $('#wpFill').style.width = (n / 3 * 100) + '%';
  $('#btnBack').disabled = n === 1;
  $('#btnNext').textContent = n === 3 ? 'Generate options →' : 'Continue →';
}

$('#btnNext').addEventListener('click', () => {
  if (state.step < 3) { goToStep(state.step + 1); return; }
  runGeneration();
});
$('#btnBack').addEventListener('click', () => goToStep(Math.max(1, state.step - 1)));
$('#btnBackToWizard').addEventListener('click', () => showScreen('screen-hero'));

$('#inpFloors').addEventListener('input', e => {
  $('#floorsReadout').textContent = e.target.value + ' floor' + (e.target.value > 1 ? 's' : '');
});
$('#inpLuxury').addEventListener('input', e => {
  const labels = ['', 'Essential', 'Efficient', 'Balanced', 'Elevated', 'Ultra-luxury'];
  $('#luxuryReadout').textContent = labels[e.target.value];
});
$('#inpSustain').addEventListener('input', e => {
  const labels = ['', 'Minimal', 'Standard-', 'Standard', 'Green+', 'Net-zero target'];
  $('#sustainReadout').textContent = labels[e.target.value];
});

$$('#outdoorChips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    chip.classList.contains('active') ? state.outdoor.add(chip.dataset.val) : state.outdoor.delete(chip.dataset.val);
  });
});
$$('#styleChips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('#styleChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.style = chip.dataset.val;
  });
});
$('#styleChips .chip[data-val="modern"]').classList.add('active');

/* ============================================================
   LOCATION → CURRENCY + COST MULTIPLIER
   ============================================================ */
const LOCATION_DB = [
  { keys: ['nigeria', 'lagos', 'abuja', 'port harcourt', 'kano', 'ibadan'], code: 'NGN', symbol: '₦', rate: 1600, mult: 0.22 },
  { keys: ['ghana', 'accra', 'kumasi'], code: 'GHS', symbol: 'GH₵', rate: 15.5, mult: 0.28 },
  { keys: ['kenya', 'nairobi', 'mombasa'], code: 'KES', symbol: 'KSh', rate: 130, mult: 0.30 },
  { keys: ['south africa', 'johannesburg', 'cape town', 'durban', 'pretoria'], code: 'ZAR', symbol: 'R', rate: 18.5, mult: 0.45 },
  { keys: ['united kingdom', 'uk', 'london', 'manchester', 'birmingham', 'england', 'scotland'], code: 'GBP', symbol: '£', rate: 0.79, mult: 1.35 },
  { keys: ['euro', 'germany', 'france', 'spain', 'italy', 'netherlands', 'portugal', 'ireland', 'belgium', 'austria'], code: 'EUR', symbol: '€', rate: 0.92, mult: 1.25 },
  { keys: ['india', 'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai'], code: 'INR', symbol: '₹', rate: 83, mult: 0.18 },
  { keys: ['uae', 'dubai', 'abu dhabi', 'sharjah'], code: 'AED', symbol: 'د.إ', rate: 3.67, mult: 0.95 },
  { keys: ['saudi', 'riyadh', 'jeddah'], code: 'SAR', symbol: '﷼', rate: 3.75, mult: 0.85 },
  { keys: ['canada', 'toronto', 'vancouver', 'montreal'], code: 'CAD', symbol: 'C$', rate: 1.37, mult: 1.05 },
  { keys: ['australia', 'sydney', 'melbourne', 'brisbane'], code: 'AUD', symbol: 'A$', rate: 1.52, mult: 1.15 },
  { keys: ['china', 'beijing', 'shanghai', 'shenzhen'], code: 'CNY', symbol: '¥', rate: 7.2, mult: 0.55 },
  { keys: ['japan', 'tokyo', 'osaka'], code: 'JPY', symbol: '¥', rate: 150, mult: 1.40 },
  { keys: ['singapore'], code: 'SGD', symbol: 'S$', rate: 1.35, mult: 1.30 },
  { keys: ['brazil', 'sao paulo', 'rio'], code: 'BRL', symbol: 'R$', rate: 5.1, mult: 0.40 },
  { keys: ['mexico', 'mexico city', 'guadalajara'], code: 'MXN', symbol: 'MX$', rate: 17, mult: 0.35 },
];

function resolveLocation(locStr) {
  const s = (locStr || '').toLowerCase().trim();
  for (const entry of LOCATION_DB) {
    if (entry.keys.some(k => s.includes(k))) {
      return { code: entry.code, symbol: entry.symbol, rate: entry.rate, mult: entry.mult };
    }
  }
  // default: USA / generic USD
  return { code: 'USD', symbol: '$', rate: 1, mult: 1.0 };
}

function formatMoney(amount, cur) {
  const n = Math.round(amount);
  if (n >= 1e9) return cur.symbol + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return cur.symbol + (n / 1e6).toFixed(2) + 'M';
  return cur.symbol + n.toLocaleString();
}

const PURPOSE_COST_USD = {
  residential: 280, vacation: 320, office: 380, commercial: 340,
  hotel: 520, warehouse: 160, mixed: 420
};

const STYLE_PALETTE = {
  modern: { a: '#cfd7e6', b: '#a9b4cc', c: '#eef2fb', roof: '#3a4460', accent: '#4ff0ff' },
  futuristic: { a: '#1f2a4a', b: '#141c33', c: '#4ff0ff', roof: '#9b6bff', accent: '#4ff0ff' },
  minimalist: { a: '#e9e9e6', b: '#cfcfc9', c: '#ffffff', roof: '#2b2b2b', accent: '#ffcf6b' },
  luxury: { a: '#2b2116', b: '#1c1610', c: '#ffcf6b', roof: '#0e0c09', accent: '#ffcf6b' },
  scandinavian: { a: '#e7d9c4', b: '#cbb794', c: '#f4ead9', roof: '#5b4636', accent: '#9b6bff' },
};

function computeTiers(fd, cur) {
  const baseUsd = PURPOSE_COST_USD[fd.purpose] || 300;
  const area = fd.width * fd.depth;
  const floors = clamp(fd.floors || 1, 1, 12);
  const luxMult = [0, 0.72, 0.88, 1.0, 1.35, 1.85][clamp(fd.luxury, 1, 5)];
  const sustainMult = [0, 0.95, 0.98, 1.0, 1.12, 1.28][clamp(fd.sustain, 1, 5)];
  const styleMult = { modern: 1.0, futuristic: 1.25, minimalist: 0.95, luxury: 1.55, scandinavian: 1.05 }[fd.style] || 1;
  const locMult = cur.mult;

  const tiers = [
    { key: 'economy', name: 'Economy Build', mult: 0.78 },
    { key: 'balanced', name: 'Balanced Build', mult: 1.0 },
    { key: 'premium', name: 'Premium Build', mult: 1.48 },
  ];
  return tiers.map(t => {
    const costPerSqmUsd = baseUsd * t.mult * luxMult * sustainMult * styleMult * locMult;
    const totalArea = area * floors * 0.82; // efficiency factor
    const costUsd = costPerSqmUsd * totalArea;
    const costLocal = costUsd * cur.rate;
    return {
      tier: t.key, name: t.name, floors,
      cost: Math.round(costLocal),
      costUsd: Math.round(costUsd),
      area: Math.round(totalArea),
      costPerSqm: Math.round(costPerSqmUsd * cur.rate),
    };
  });
}

function runGeneration() {
  const loc = $('#inpLocation').value || 'United States';
  state.currency = resolveLocation(loc);
  const cur = state.currency;

  const budgetLabel = $('#budgetLabel');
  if (budgetLabel) budgetLabel.textContent = `Budget (${cur.code} · ${cur.symbol})`;

  const fd = {
    budget: +$('#inpBudget').value || 250000,
    purpose: $('#inpPurpose').value,
    bedrooms: +$('#inpBed').value,
    bathrooms: +$('#inpBath').value,
    location: loc,
    width: +$('#inpWidth').value || 20,
    depth: +$('#inpDepth').value || 30,
    floors: +$('#inpFloors').value,
    outdoor: [...state.outdoor],
    style: state.style,
    luxury: +$('#inpLuxury').value,
    sustain: +$('#inpSustain').value,
  };
  state.formData = fd;

  const tiers = computeTiers(fd, cur);
  renderOptions(tiers, fd, cur);
  showScreen('screen-options');
}

function renderOptions(tiers, fd, cur) {
  const grid = $('#optionsGrid');
  grid.innerHTML = '';
  const palette = STYLE_PALETTE[fd.style];

  tiers.forEach(t => {
    const card = document.createElement('div');
    card.className = 'option-card glass';
    const vsBudget = Math.round(t.cost / Math.max(fd.budget, 1) * 100);
    card.innerHTML = `
      <span class="option-tier">${t.tier.toUpperCase()}</span>
      <span class="option-name">${fd.style[0].toUpperCase() + fd.style.slice(1)} · ${t.floors}-floor ${labelForPurpose(fd.purpose)}</span>
      <div class="option-visual" style="background:linear-gradient(160deg, ${palette.a}22, ${palette.roof}33);">
        ${t.floors} FLOOR${t.floors > 1 ? 'S' : ''} · ${fd.width}×${fd.depth}m PLOT · ${cur.code}
      </div>
      <div class="option-stats">
        <div><div class="stat-label">Est. cost</div><div class="stat-value">${formatMoney(t.cost, cur)}</div></div>
        <div><div class="stat-label">Built area</div><div class="stat-value">${t.area.toLocaleString()} m²</div></div>
        <div><div class="stat-label">${cur.symbol} / m²</div><div class="stat-value">${formatMoney(t.costPerSqm, cur)}</div></div>
        <div><div class="stat-label">vs budget</div><div class="stat-value">${vsBudget}%</div></div>
      </div>
      <button class="btn primary option-select-btn">Start construction →</button>
    `;
    card.querySelector('.option-select-btn').addEventListener('click', () => {
      state.chosenOption = { ...t, fd, currency: cur };
      try {
        launchSimulator(state.chosenOption);
      } catch (err) {
        console.error('launchSimulator failed:', err);
        alert('Construction failed to start — check the console (F12) for the error: ' + err.message);
      }
    });
    grid.appendChild(card);
  });
}

function labelForPurpose(p) {
  const map = {
    residential: 'home', vacation: 'vacation home', office: 'office',
    commercial: 'commercial building', hotel: 'hotel', warehouse: 'warehouse',
    mixed: 'mixed-use building'
  };
  return map[p] || 'building';
}

const UNIT = 3;
const FLOOR_H = 3.1;

/* ============================================================
   HOUSE SPEC — pure data
   ============================================================ */

function distributeEvenly(total, buckets) {
  const base = Math.floor(total / buckets), rem = total % buckets;
  const arr = new Array(buckets).fill(base);
  for (let i = 0; i < rem; i++) arr[buckets - 1 - i]++;
  return arr;
}

function planRooms(gridSpec) {
  const { W, D, floors, fd } = gridSpec;
  const totalBed = clamp(fd.bedrooms || 1, 1, 12);
  const totalBath = clamp(fd.bathrooms || 1, 1, 12);
  const bedPerFloor = distributeEvenly(totalBed, floors);
  const bathPerFloor = distributeEvenly(totalBath, floors);
  const bathDepth = Math.min(D * 0.38, 2.8);
  const byFloor = [];
  for (let f = 0; f < floors; f++) {
    const items = [];
    if (f === 0) {
      items.push({ label: 'Parlour', weight: 3.4, isBathroom: false });
      if (fd.purpose === 'residential' || fd.purpose === 'vacation') {
        items.push({ label: 'Kitchen', weight: 1.8, isBathroom: false });
      }
    }
    for (let i = 0; i < bedPerFloor[f]; i++) items.push({ label: `Bedroom ${i + 1}`, weight: 1.6, isBathroom: false });
    for (let i = 0; i < bathPerFloor[f]; i++) items.push({ label: `WC / Bathroom ${i + 1}`, weight: 0.75, isBathroom: true });
    if (items.length === 0) items.push({ label: 'Open floor', weight: 1, isBathroom: false });
    const totalWeight = items.reduce((s, it) => s + it.weight, 0);
    let cursor = -W / 2;
    const rects = items.map(it => {
      const w = (it.weight / totalWeight) * W;
      const z0 = it.isBathroom ? (D / 2 - bathDepth) : -D / 2;
      const rect = { x0: cursor, x1: cursor + w, z0, z1: D / 2, label: it.label, isBathroom: it.isBathroom, floor: f };
      cursor += w;
      return rect;
    });
    byFloor.push(rects);
  }
  return byFloor;
}

function buildHouseSpec(opt) {
  const fd = opt.fd;
  const palette = STYLE_PALETTE[fd.style];
  const lux = clamp(fd.luxury || 3, 1, 5);
  const style = fd.style || 'modern';
  const purpose = fd.purpose || 'residential';
  const isHome = ['residential', 'vacation'].includes(purpose);
  const isHotel = purpose === 'hotel';
  const isOffice = purpose === 'office' || purpose === 'commercial' || purpose === 'mixed';
  const isWarehouse = purpose === 'warehouse';

  /* ---------- DISTINCT MASSING BY STYLE + PURPOSE ----------
     modern (lux 5):  courtyard / U-plan villa + garage + glass upper
     modern (lower):  L-villa + garage
     scandinavian:    long horizontal bar, simple gable, open carport
     minimalist:      pure rectangular box, flat roof
     luxury:          grand hip-roof villa, wings both sides
     futuristic:      stacked / cantilevered volumes, angular roof
     office:          tall box tower or podium+tower, dense windows
     warehouse:       low wide shed
     hotel:           long multi-storey bar
  ---------------------------------------------------------- */
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

  // footprint proportions change with form
  let gridScale = lux >= 4 ? 3.0 : lux >= 3 ? 3.4 : 3.8;
  if (formType === 'long-bar' || formType === 'hotel-bar') gridScale *= 0.85; // wider cells → longer building
  if (formType === 'shed') gridScale *= 0.75;
  if (formType === 'tower') gridScale *= 1.15; // tighter plan, taller feel

  let gridX = clamp(Math.round(fd.width / gridScale), 6, 16);
  let gridZ = clamp(Math.round(fd.depth / gridScale), 6, 16);
  // Scandinavian / hotel: stretch width
  if (formType === 'long-bar' || formType === 'hotel-bar') {
    gridX = clamp(Math.round(gridX * 1.25), 8, 18);
    gridZ = clamp(Math.round(gridZ * 0.75), 5, 12);
  }
  // Office tower: more square / compact plan
  if (formType === 'tower') {
    gridX = clamp(gridX, 6, 10);
    gridZ = clamp(gridZ, 6, 10);
  }
  // Warehouse: very wide, shallow depth
  if (formType === 'shed') {
    gridX = clamp(Math.round(gridX * 1.4), 10, 20);
    gridZ = clamp(Math.round(gridZ * 0.7), 5, 12);
  }

  let floors = clamp(opt.floors, 1, 12);
  if (formType === 'tower' && floors < 4) floors = Math.max(floors, 4);
  if (formType === 'shed') floors = 1;

  const W = gridX * UNIT;
  const D = gridZ * UNIT;
  const wallH = floors * FLOOR_H;

  // door placement
  let doorGX;
  if (formType === 'l-villa' || formType === 'courtyard' || formType === 'grand-villa') {
    doorGX = clamp(Math.floor(gridX * 0.32), 1, gridX - 3);
  } else if (formType === 'long-bar') {
    doorGX = clamp(Math.floor(gridX * 0.2), 1, gridX - 3); // door near left of long facade
  } else {
    doorGX = clamp(Math.floor(gridX / 2), 1, gridX - 2);
  }
  const door = { x: doorGX * UNIT - W / 2, z: -D / 2, gx: doorGX };

  // --- secondary volumes ---
  let garage = null;
  let wing = null;
  let wing2 = null;
  let cantilever = null;
  let podium = null;

  // Garage for villa-like homes
  if (['l-villa', 'courtyard', 'grand-villa'].includes(formType)) {
    const gW = Math.max(5.5, W * 0.36);
    const gD = Math.max(5.5, D * 0.4);
    garage = {
      w: gW, d: gD,
      x: W / 2 + gW / 2 - 0.1,
      z: -D / 2 + gD / 2 - 0.1,
      h: FLOOR_H * 0.95,
    };
  }
  // Scandinavian open carport (lighter structure)
  if (formType === 'long-bar') {
    garage = {
      w: Math.max(5, W * 0.22),
      d: Math.max(4.5, D * 0.55),
      x: -W / 2 - Math.max(5, W * 0.22) / 2 + 0.15,
      z: -D / 2 + Math.max(4.5, D * 0.55) / 2,
      h: FLOOR_H * 0.85,
      open: true, // carport — no full walls
    };
  }

  // L-wing
  if (['l-villa', 'courtyard', 'grand-villa'].includes(formType) && floors >= 2) {
    wing = {
      w: W * (formType === 'courtyard' ? 0.38 : 0.42),
      d: D * (formType === 'courtyard' ? 0.55 : 0.36),
      x: -W / 2 - (W * 0.4) / 2 + 0.15,
      z: formType === 'courtyard' ? D * 0.12 : D * 0.08,
      floors: Math.min(floors, formType === 'grand-villa' ? floors : 2),
    };
  }
  // Courtyard / grand: second wing on the other side → U shape
  if ((formType === 'courtyard' || formType === 'grand-villa') && lux >= 4 && floors >= 2) {
    wing2 = {
      w: W * 0.36,
      d: D * 0.5,
      x: W / 2 + (W * 0.36) / 2 - 0.15,
      z: D * 0.15,
      floors: Math.min(floors, 2),
    };
  }

  // Futuristic cantilever: upper floor overhangs front
  if (formType === 'cantilever' && floors >= 2) {
    cantilever = {
      w: W * 0.7,
      d: 3.2,
      x: 0,
      z: -D / 2 - 1.4,
      y: FLOOR_H,
      h: FLOOR_H * Math.min(floors - 1, 2),
    };
  }

  // Office tower podium (wider ground floors)
  if (formType === 'tower' && floors >= 4) {
    podium = {
      w: W * 1.25,
      d: D * 1.2,
      h: FLOOR_H * Math.min(2, floors - 1),
    };
  }

  // denser windows for office / modern max
  const windows = [];
  const winStep = (isOffice || (style === 'modern' && lux >= 5)) ? 1 : (lux >= 4 ? 1 : 2);
  for (let f = 0; f < floors; f++) {
    const wy = f * FLOOR_H + FLOOR_H * 0.52;
    for (let gx = 1; gx < gridX; gx += winStep) {
      if (!(f === 0 && gx === doorGX)) windows.push({ x: gx * UNIT - W / 2, y: wy, z: -D / 2, rot: 0 });
      windows.push({ x: gx * UNIT - W / 2, y: wy, z: D / 2, rot: Math.PI });
    }
    for (let gz = 1; gz < gridZ; gz += winStep) {
      windows.push({ x: -W / 2, y: wy, z: gz * UNIT - D / 2, rot: -Math.PI / 2 });
      windows.push({ x: W / 2, y: wy, z: gz * UNIT - D / 2, rot: Math.PI / 2 });
    }
  }

  // roof type tied tightly to form + style
  let roofType = 'flat';
  if (formType === 'shed') roofType = 'gable';
  else if (formType === 'long-bar') roofType = 'gable';
  else if (formType === 'tower' || formType === 'office-bar' || formType === 'hotel-bar') roofType = 'flat-stepped';
  else if (formType === 'cantilever') roofType = 'angular';
  else if (formType === 'courtyard') roofType = lux >= 5 ? 'flat-stepped' : 'hip';
  else if (formType === 'grand-villa') roofType = 'hip';
  else if (formType === 'l-villa') {
    if (style === 'modern') roofType = lux >= 4 ? 'flat-stepped' : 'hip';
    else if (style === 'luxury') roofType = 'hip';
    else roofType = 'hip';
  } else if (style === 'minimalist') roofType = 'flat';
  else if (style === 'scandinavian') roofType = 'multi-gable';
  else if (style === 'futuristic') roofType = 'angular';
  else roofType = 'flat';

  const roofH = (roofType === 'flat' || roofType === 'flat-stepped') ? 0.7 : 2.6 + lux * 0.3;

  const outdoor = fd.outdoor || [];
  const site = {};
  const driveLen = Math.max(28, D * 0.9 + 18);
  let minX = -W / 2 - 8, maxX = W / 2 + 12, minZ = -D / 2 - driveLen - 8, maxZ = D / 2 + 8;
  if (garage) {
    maxX = Math.max(maxX, garage.x + garage.w / 2 + 2);
    minX = Math.min(minX, garage.x - garage.w / 2 - 2);
  }
  if (wing) minX = Math.min(minX, wing.x - wing.w / 2 - 2);
  if (wing2) maxX = Math.max(maxX, wing2.x + wing2.w / 2 + 2);
  if (cantilever) minZ = Math.min(minZ, cantilever.z - cantilever.d / 2 - 2);
  if (podium) {
    maxX = Math.max(maxX, podium.w / 2 + 2);
    minX = Math.min(minX, -podium.w / 2 - 2);
  }

  // large pool behind the house + compound padding
  {
    const poolW = Math.max(12, W * 0.85);
    const poolD = Math.max(7, D * 0.5);
    const poolZ = D / 2 + poolD / 2 + 3.5;
    site.pool = { poolW, poolD, poolX: 0, poolZ };
    maxZ = Math.max(maxZ, poolZ + poolD / 2 + 3);
    minX = Math.min(minX, -poolW / 2 - 8);
    maxX = Math.max(maxX, poolW / 2 + 8);
  }
  if (outdoor.includes('garden')) {
    site.garden = { bedX: -W / 2 - 3.5 };
    minX = Math.min(minX, -W / 2 - 6);
  }
  if (outdoor.includes('terrace')) {
    site.terrace = true;
    maxZ = Math.max(maxZ, D / 2 + 3.5);
  }
  const bounds = { minX, maxX, minZ, maxZ };

  const spec = {
    fd, palette, gridX, gridZ, floors, W, D, wallH, roofH, roofType,
    door, windows, outdoor, site, bounds, driveLen, lux,
    formType, garage, wing, wing2, cantilever, podium,
    isHome, isOffice, isHotel, isWarehouse, style, purpose,
  };
  spec.roomPlan = planRooms(spec);
  return spec;
}

/* ============================================================
   3D SCENE
   ============================================================ */

const scene3d = { renderer: null, scene: null, camera: null, controls: null, groups: null, spec: null, gen: 0 };

function initRenderer() {
  const mount = $('#stagePerspective');
  mount.innerHTML = '';
  scene3d.gen++;
  const myGen = scene3d.gen;

  const w = mount.clientWidth || 800, h = mount.clientHeight || 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0xeef1ec, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // soft atmospheric haze so distant fence/trees fall off gently
  scene.fog = new THREE.Fog(0xdde3d6, 55, 160);
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 800);

  // balanced ambient + hemisphere for natural outdoor fill
  scene.add(new THREE.AmbientLight(0xf0f2f5, 0.42));
  const hemi = new THREE.HemisphereLight(0xc8daf0, 0x8a9a6e, 0.45);
  scene.add(hemi);

  // main sun
  const sun = new THREE.DirectionalLight(0xfff5e6, 0.95);
  sun.position.set(22, 38, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // cool fill from opposite side
  const fill = new THREE.DirectionalLight(0xd0e4ff, 0.22);
  fill.position.set(-18, 14, 16);
  scene.add(fill);

  // warm rim light (late-afternoon bounce)
  const rim = new THREE.DirectionalLight(0xffd8b0, 0.18);
  rim.position.set(-8, 12, 30);
  scene.add(rim);

  // subtle ground bounce
  const bounce = new THREE.DirectionalLight(0xb8c9a0, 0.12);
  bounce.position.set(0, -5, 0);
  scene.add(bounce);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshToonMaterial({ color: 0xa9b98f })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // store light refs for later interior accent lights
  scene3d.lights = { sun, fill, hemi, rim, interior: [] };

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 4;
  controls.maxDistance = 220;

  scene3d.renderer = renderer;
  scene3d.scene = scene;
  scene3d.camera = camera;
  scene3d.controls = controls;

  if (scene3d.ro) scene3d.ro.disconnect();
  scene3d.ro = new ResizeObserver(() => {
    const nw = mount.clientWidth, nh = mount.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  scene3d.ro.observe(mount);

  (function loop() {
    if (myGen !== scene3d.gen) return;
    requestAnimationFrame(loop);
    controls.update();
    updateInspectCutaway();
    renderer.render(scene, camera);
  })();
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

function makeLabelSprite(text, isBathroom) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = isBathroom ? 'rgba(47,150,196,.92)' : 'rgba(13,17,23,.88)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(4, 4, 248, 64, 16); ctx.fill(); }
  else { ctx.fillRect(4, 4, 248, 64); }
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.68, 1);
  sprite.renderOrder = 999;
  return sprite;
}

const toonGradientMap = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 0, 2, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(2, 0, 2, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
})();

function toonMat(colorHex, opts) {
  opts = opts || {};
  return new THREE.MeshToonMaterial({
    color: colorHex,
    gradientMap: toonGradientMap,
    transparent: !!opts.transparent,
    opacity: opts.opacity != null ? opts.opacity : 1,
  });
}

function desaturate(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = hsl.s * (1 - amount);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * 1.05 + 0.02));
  return c.getHex();
}

/* ============================================================
   FURNITURE FACTORY — intentional luxury zones
   ============================================================ */
function createFurnitureFactory(spec, luxTier) {
  const lux = luxTier;
  const furnitureTheme = ['office', 'commercial', 'mixed'].includes(spec.fd.purpose) ? 'office'
    : spec.fd.purpose === 'warehouse' ? 'warehouse' : 'home';

  const luxPal = lux <= 2
    ? { fabric: 0x8a8a86, wood: 0x9c8060, accent: 0x5c6470, metal: 0xb9c2cc, gold: 0xc9a84c }
    : lux === 3
      ? { fabric: 0x7a6a56, wood: 0x8a6a45, accent: 0x3f5a75, metal: 0xc0c8d0, gold: 0xd4af37 }
      : { fabric: 0x1a1512, wood: 0x4a2f1a, accent: 0xb08d3e, metal: 0xd0d6dc, gold: 0xe8c547 };

  const fMatFabric = toonMat(desaturate(luxPal.fabric, 0.35));
  const fMatWood = toonMat(desaturate(luxPal.wood, 0.3));
  const fMatDark = toonMat(0x1c1f24);
  const fMatWhite = toonMat(0xeeeeec);
  // emissive screens / smart panels glow in the scene
  const fMatScreen = new THREE.MeshToonMaterial({
    color: 0x0a0c10, emissive: 0x1a4060, emissiveIntensity: 0.55, gradientMap: toonGradientMap
  });
  const fMatScreenBright = new THREE.MeshToonMaterial({
    color: 0x0c1828, emissive: 0x3a8cff, emissiveIntensity: 0.7, gradientMap: toonGradientMap
  });
  const fMatLed = new THREE.MeshToonMaterial({
    color: 0x4ff3ff, emissive: 0x4ff3ff, emissiveIntensity: 0.9, gradientMap: toonGradientMap
  });
  const fMatWarmGlow = new THREE.MeshToonMaterial({
    color: 0xffcf6b, emissive: 0xffaa40, emissiveIntensity: 0.65, gradientMap: toonGradientMap
  });
  const fMatMetal = toonMat(luxPal.metal);
  const fMatAccent = toonMat(desaturate(luxPal.accent, 0.3));
  const fMatPlant = toonMat(0x548a49);
  const fMatCushion = toonMat(desaturate(luxPal.fabric, 0.2));
  const fMatGold = toonMat(luxPal.gold);
  const fMatVelvet = toonMat(0x4a1528);
  const fMatBar = toonMat(0x2a1f14);

  function addEdgesLocal(mesh) {
    if (!mesh.geometry) return;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 18),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    mesh.add(edges);
  }

  const mk = {
    bed() {
      const g = new THREE.Group();
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 2.1), fMatFabric); mattress.position.y = 0.38; g.add(mattress);
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.95, 0.12), lux >= 4 ? fMatVelvet : fMatWood); headboard.position.set(0, 0.65, -1.05); g.add(headboard);
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.38), fMatWhite); p1.position.set(-0.42, 0.6, -0.78); g.add(p1);
      const p2 = p1.clone(); p2.position.x = 0.42; g.add(p2);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 2.2), fMatWood); frame.position.y = 0.14; g.add(frame);
      if (lux >= 4) {
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 2.25), fMatGold); canopy.position.y = 2.15; g.add(canopy);
        for (const [sx, sz] of [[-0.8, -1.0], [0.8, -1.0], [-0.8, 1.0], [0.8, 1.0]]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 8), fMatGold);
          post.position.set(sx, 1.05, sz); g.add(post);
        }
      }
      return g;
    },
    nightstand() {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.42), fMatWood); body.position.y = 0.28; return body;
    },
    wardrobe() {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.58), fMatWood); w.position.y = 1.05; return w;
    },
    dresser() {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.52), fMatWood); body.position.y = 0.45; return body;
    },
    sofa() {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.48, 0.95), lux >= 4 ? fMatVelvet : fMatFabric); base.position.y = 0.24; g.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.22), lux >= 4 ? fMatVelvet : fMatFabric); back.position.set(0, 0.58, -0.36); g.add(back);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.95), lux >= 4 ? fMatVelvet : fMatFabric); armL.position.set(-1.15, 0.42, 0); g.add(armL);
      const armR = armL.clone(); armR.position.x = 1.15; g.add(armR);
      return g;
    },
    armchair() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.75), lux >= 4 ? fMatVelvet : fMatFabric); seat.position.y = 0.28; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.16), lux >= 4 ? fMatVelvet : fMatFabric); back.position.set(0, 0.65, -0.3); g.add(back);
      return g;
    },
    coffeeTable() {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.3, 0.6), lux >= 4 ? fMatGold : fMatWood); t.position.y = 0.15; return t;
    },
    sideTable() {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.42), fMatWood); t.position.y = 0.21; return t;
    },
    // large cinema screen
    cinemaScreen() {
      const g = new THREE.Group();
      const screen = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.08), fMatScreen); screen.position.y = 1.3; g.add(screen);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.06), fMatDark); bezel.position.y = 1.3; bezel.position.z = 0.05; g.add(bezel);
      return g;
    },
    // row of cinema seats
    cinemaSeat() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), fMatVelvet); seat.position.y = 0.35; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.12), fMatVelvet); back.position.set(0, 0.7, -0.22); g.add(back);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.5), fMatDark); arm.position.set(0.3, 0.45, 0); g.add(arm);
      return g;
    },
    // bar counter for drinking lounge
    barCounter() {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.05, 0.7), fMatBar); base.position.y = 0.52; g.add(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.08, 0.8), fMatGold); top.position.y = 1.08; g.add(top);
      // bottles on shelf
      for (let i = 0; i < 5; i++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), toonMat(i % 2 ? 0x8b1a1a : 0x1a4a2a));
        bottle.position.set(-1.0 + i * 0.5, 1.35, -0.15); g.add(bottle);
      }
      return g;
    },
    barStool() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), fMatCushion); seat.position.y = 0.72; g.add(seat);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), fMatMetal); pole.position.y = 0.35; g.add(pole);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12), fMatMetal); base.position.y = 0.03; g.add(base);
      return g;
    },
    // gaming setup: triple monitors + racing seat + console
    gamingRig() {
      const g = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.7), fMatDark); desk.position.y = 0.72; g.add(desk);
      for (const sx of [-0.65, 0, 0.65]) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.04), fMatScreen);
        mon.position.set(sx, 1.05, -0.22); g.add(mon);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.6), fMatVelvet); seat.position.set(0, 0.4, 0.55); g.add(seat);
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.12), fMatVelvet); seatBack.position.set(0, 0.75, 0.8); g.add(seatBack);
      const console = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), fMatDark); console.position.set(0.7, 0.8, 0); g.add(console);
      return g;
    },
    // workstation: dual monitors, keyboard area, office chair
    workstation() {
      const g = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.75), lux >= 4 ? fMatDark : fMatWood); desk.position.y = 0.74; g.add(desk);
      for (const sx of [-0.4, 0.4]) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.04), fMatScreen);
        mon.position.set(sx, 1.08, -0.25); g.add(mon);
      }
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.18), fMatDark); kb.position.set(0, 0.8, 0.15); g.add(kb);
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), fMatDark); chairSeat.position.set(0, 0.5, 0.65); g.add(chairSeat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), fMatDark); chairBack.position.set(0, 0.8, 0.88); g.add(chairBack);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), fMatMetal); base.position.set(0, 0.08, 0.65); g.add(base);
      return g;
    },
    desk() {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.65), lux >= 4 ? fMatDark : fMatWood); top.position.y = 0.72; g.add(top);
      for (const sx of [-0.55, 0.55]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), fMatMetal); leg.position.set(sx, 0.36, 0); g.add(leg);
      }
      return g;
    },
    officeChair() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), fMatDark); seat.position.y = 0.5; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.08), fMatDark); back.position.set(0, 0.78, 0.26); g.add(back);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), fMatMetal); base.position.y = 0.08; g.add(base);
      return g;
    },
    monitor() {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.04), fMatScreen); m.position.y = 0.3; return m;
    },
    diningTable() {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.0), lux >= 4 ? fMatDark : fMatWood); t.position.y = 0.76; return t;
    },
    diningChair() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), lux >= 4 ? fMatVelvet : fMatWood); seat.position.y = 0.45; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), lux >= 4 ? fMatVelvet : fMatWood); back.position.set(0, 0.72, -0.2); g.add(back);
      return g;
    },
    bookshelf() {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.38), fMatWood); b.position.y = 1.0; return b;
    },
    plant() {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.32, 10), fMatDark); pot.position.y = 0.16; g.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.36, 9, 9), fMatPlant); leaves.position.y = 0.55; leaves.scale.y = 1.4; g.add(leaves);
      return g;
    },
    rug(w, d) {
      return new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.025, d * 0.6), toonMat(desaturate(luxPal.accent, 0.35)));
    },
    bathroomSet() {
      const g = new THREE.Group();
      const toiletBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.38, 12), fMatWhite); toiletBase.position.set(-0.4, 0.19, -0.5); g.add(toiletBase);
      const toiletTank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.35, 0.16), fMatWhite); toiletTank.position.set(-0.4, 0.45, -0.68); g.add(toiletTank);
      const sinkCounter = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.42), fMatWhite); sinkCounter.position.set(0.5, 0.78, -0.5); g.add(sinkCounter);
      const sinkLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), fMatMetal); sinkLeg.position.set(0.5, 0.39, -0.5); g.add(sinkLeg);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.04), fMatGold); mirror.position.set(0.5, 1.35, -0.7); g.add(mirror);
      if (lux >= 3) {
        const shower = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.08), toonMat(0xb0d0e0, { transparent: true, opacity: 0.35 }));
        shower.position.set(0, 1.05, 0.55); g.add(shower);
      }
      return g;
    },
    kitchenCounter() {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.92, 0.65), fMatWhite); base.position.y = 0.46; g.add(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 0.7), fMatDark); top.position.y = 0.95; g.add(top);
      return g;
    },
    fridge() {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.85, 0.7), fMatWhite); f.position.y = 0.92; return f;
    },
    stove() {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.65), fMatDark); s.position.y = 0.45; return s;
    },
    shelfUnit() {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.5), fMatMetal); s.position.y = 1.1; return s;
    },

    tvStand() {
      const g = new THREE.Group();
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.4), fMatDark); stand.position.y = 0.21; g.add(stand);
      const tv = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.82, 0.06), fMatScreen); tv.position.set(0, 0.95, 0); g.add(tv);
      return g;
    },
    consoleTable() {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.42), fMatWood); t.position.y = 0.4; return t;
    },
    ottoman() {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.65), fMatCushion); o.position.y = 0.21; return o;
    },
    // framed portrait / painting on wall
    portrait() {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.06), fMatGold); frame.position.y = 1.45; g.add(frame);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.03), toonMat(0x3a2a1a)); canvas.position.set(0, 1.45, 0.04); g.add(canvas);
      return g;
    },
    // smaller portrait
    portraitSm() {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.05), fMatGold); frame.position.y = 1.4; g.add(frame);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.025), toonMat(0x2a3a4a)); canvas.position.set(0, 1.4, 0.035); g.add(canvas);
      return g;
    },
    bench() {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.48), fMatWood); b.position.y = 0.22; return b;
    },
    chandelier() {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), fMatGold); stem.position.y = 2.4; g.add(stem);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), fMatWarmGlow); body.position.y = 2.1; g.add(body);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), fMatGold);
        arm.position.set(Math.cos(a) * 0.25, 2.05, Math.sin(a) * 0.25);
        arm.rotation.y = a;
        g.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), fMatWarmGlow);
        bulb.position.set(Math.cos(a) * 0.4, 2.0, Math.sin(a) * 0.4);
        g.add(bulb);
      }
      return g;
    },
    // ---- SMART HOME DEVICES ----
    smartPanel() {
      // wall-mounted home hub / tablet
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.05), fMatDark); frame.position.y = 1.35; g.add(frame);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.75, 0.03), fMatScreenBright); screen.position.set(0, 1.35, 0.03); g.add(screen);
      // status LED
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), fMatLed); led.position.set(0.2, 1.7, 0.04); g.add(led);
      return g;
    },
    smartSpeaker() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.35, 12), fMatDark); body.position.y = 0.18; g.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), fMatLed); ring.position.y = 0.36; ring.rotation.x = Math.PI / 2; g.add(ring);
      return g;
    },
    securityCam() {
      const g = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.25), fMatMetal); arm.position.set(0, 0, 0.1); g.add(arm);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), fMatDark); body.position.set(0, 0, 0.28); g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), fMatScreen); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, 0.4); g.add(lens);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), fMatLed); led.position.set(0.06, 0.05, 0.38); g.add(led);
      return g;
    },
    thermostat() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), fMatDark); body.rotation.x = Math.PI / 2; body.position.y = 1.3; g.add(body);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16), fMatScreenBright); face.rotation.x = Math.PI / 2; face.position.set(0, 1.3, 0.03); g.add(face);
      return g;
    },
    ledStrip(len) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len || 2.4, 0.03, 0.04), fMatLed);
      strip.position.y = 0.02;
      return strip;
    },
    floorLamp() {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), fMatMetal); pole.position.y = 0.8; g.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 10), fMatWarmGlow); shade.position.y = 1.6; g.add(shade);
      return g;
    },
    tableLamp() {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), fMatWood); base.position.y = 0.06; g.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), fMatMetal); pole.position.y = 0.27; g.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.15, 8), fMatWarmGlow); shade.position.y = 0.48; g.add(shade);
      return g;
    },
  };

  function place(piece, x, z, rotY, bounds) {
    const m = 0.5;
    let cx = x, cz = z;
    if (bounds) {
      cx = clamp(x, -bounds.hw + m, bounds.hw - m);
      cz = clamp(z, -bounds.hd + m, bounds.hd - m);
    }
    piece.position.set(cx, 0, cz);
    if (rotY) piece.rotation.y = rotY;
    piece.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; addEdgesLocal(o); }
    });
    return piece;
  }

  function furnishRoom(r, wy) {
    const roomW = r.x1 - r.x0;
    const roomD = r.z1 - r.z0;
    if (roomW < 1.5 || roomD < 1.4) return null;

    const g = new THREE.Group();
    const pieces = [];
    const hw = roomW / 2, hd = roomD / 2;
    const B = { hw, hd };
    const P = (piece, x, z, rotY) => place(piece, x, z, rotY || 0, B);

    if (r.isBathroom) {
      pieces.push(P(mk.bathroomSet(), 0, 0));
      if (lux >= 3) pieces.push(P(mk.plant(), hw * 0.5, hd * 0.35));
      if (lux >= 4) pieces.push(P(mk.portraitSm(), 0, -hd * 0.85));
      if (lux >= 3) pieces.push(P(mk.smartPanel(), hw * 0.4, -hd * 0.85));
    } else if (furnitureTheme === 'office') {
      const desks = clamp(Math.floor(roomW / 2.6), 1, 4);
      for (let i = 0; i < desks; i++) {
        const dx = -hw + (roomW / desks) * (i + 0.5);
        pieces.push(P(mk.workstation(), dx, -hd * 0.12));
      }
      pieces.push(P(mk.bookshelf(), hw * 0.55, hd * 0.4));
      pieces.push(P(mk.plant(), -hw * 0.55, hd * 0.4));
      pieces.push(P(mk.smartPanel(), 0, -hd * 0.85));
      pieces.push(P(mk.smartSpeaker(), hw * 0.4, hd * 0.35));
      if (lux >= 3) {
        pieces.push(P(mk.portrait(), -hw * 0.4, -hd * 0.85));
        pieces.push(P(mk.portraitSm(), hw * 0.35, -hd * 0.85));
        pieces.push(P(mk.thermostat(), hw * 0.55, -hd * 0.85));
      }
      if (lux >= 4) pieces.push(P(mk.floorLamp(), hw * 0.6, -hd * 0.4));
    } else if (furnitureTheme === 'warehouse') {
      const shelves = clamp(Math.floor(roomW / 2.4), 2, 5);
      for (let i = 0; i < shelves; i++) {
        pieces.push(P(mk.shelfUnit(), -hw + 1.3 + i * 2.4, hd * 0.2));
      }
    } else if (r.label.startsWith('Bedroom')) {
      const bedZ = -hd * 0.32;
      pieces.push(P(mk.bed(), 0, bedZ));
      pieces.push(P(mk.nightstand(), -1.0, bedZ - 0.5));
      pieces.push(P(mk.nightstand(), 1.0, bedZ - 0.5));
      pieces.push(P(mk.tableLamp(), -1.0, bedZ - 0.5));
      pieces.push(P(mk.tableLamp(), 1.0, bedZ - 0.5));
      pieces.push(P(mk.portrait(), 0, -hd * 0.88));
      pieces.push(P(mk.portraitSm(), -hw * 0.35, -hd * 0.88));
      pieces.push(P(mk.portraitSm(), hw * 0.35, -hd * 0.88));
      pieces.push(P(mk.ottoman(), 0, bedZ + 1.1));
      pieces.push(P(mk.rug(Math.min(roomW * 0.9, 4.5), Math.min(roomD * 0.75, 3.8)), 0, bedZ + 0.25));
      pieces.push(P(mk.wardrobe(), hw * 0.65, -hd * 0.1, Math.PI / 2));
      pieces.push(P(mk.wardrobe(), hw * 0.65, hd * 0.25, Math.PI / 2));
      pieces.push(P(mk.dresser(), -hw * 0.6, hd * 0.2, -Math.PI / 2));
      pieces.push(P(mk.consoleTable(), -hw * 0.55, -hd * 0.15, -Math.PI / 2));
      pieces.push(P(mk.smartPanel(), hw * 0.3, -hd * 0.88));
      pieces.push(P(mk.plant(), -hw * 0.55, -hd * 0.5));
      pieces.push(P(mk.plant(), hw * 0.45, hd * 0.4));
      pieces.push(P(mk.floorLamp(), -hw * 0.45, hd * 0.35));
      pieces.push(P(mk.floorLamp(), hw * 0.5, -hd * 0.2));
      pieces.push(P(mk.armchair(), -hw * 0.35, hd * 0.35));
      pieces.push(P(mk.sideTable(), -hw * 0.15, hd * 0.4));
      pieces.push(P(mk.smartSpeaker(), hw * 0.4, hd * 0.35));
      pieces.push(P(mk.thermostat(), -hw * 0.3, -hd * 0.88));
      if (lux >= 3) pieces.push(P(mk.chandelier()));
      if (lux >= 4) {
        pieces.push(P(mk.armchair(), hw * 0.25, hd * 0.4, -0.4));
        pieces.push(P(mk.bench(), 0, hd * 0.45));
      }
    } else if (r.label === 'Parlour' || r.label === 'Open floor') {
      const sofaZ = -hd * 0.52;
      pieces.push(P(mk.sofa(), 0, sofaZ, 0));
      pieces.push(P(mk.sofa(), -hw * 0.35, sofaZ + 0.05, 0.15));
      pieces.push(P(mk.coffeeTable(), 0, sofaZ + 1.1));
      pieces.push(P(mk.rug(Math.min(roomW * 0.85, 5.5), Math.min(roomD * 0.6, 3.8)), 0, sofaZ + 0.65));
      pieces.push(P(mk.armchair(), -hw * 0.55, sofaZ + 0.95, 0.55));
      pieces.push(P(mk.armchair(), hw * 0.55, sofaZ + 0.95, -0.55));
      pieces.push(P(mk.ottoman(), -hw * 0.35, sofaZ + 1.35));
      pieces.push(P(mk.ottoman(), hw * 0.35, sofaZ + 1.35));
      pieces.push(P(mk.floorLamp(), hw * 0.6, sofaZ + 0.3));
      pieces.push(P(mk.floorLamp(), -hw * 0.6, sofaZ + 0.3));
      pieces.push(P(mk.tvStand(), 0, hd * 0.55, Math.PI));
      pieces.push(P(mk.consoleTable(), hw * 0.65, 0, Math.PI / 2));
      pieces.push(P(mk.consoleTable(), -hw * 0.65, 0, -Math.PI / 2));
      pieces.push(P(mk.bookshelf(), -hw * 0.65, hd * 0.35));
      pieces.push(P(mk.bookshelf(), hw * 0.65, hd * 0.35));
      pieces.push(P(mk.portrait(), -hw * 0.2, -hd * 0.88));
      pieces.push(P(mk.portrait(), hw * 0.25, -hd * 0.88));
      pieces.push(P(mk.portraitSm(), 0, -hd * 0.88));
      pieces.push(P(mk.smartPanel(), hw * 0.5, -hd * 0.88));
      pieces.push(P(mk.smartSpeaker(), -hw * 0.5, hd * 0.4));
      pieces.push(P(mk.smartSpeaker(), hw * 0.5, hd * 0.4));
      pieces.push(P(mk.plant(), -hw * 0.6, -hd * 0.3));
      pieces.push(P(mk.plant(), hw * 0.6, -hd * 0.3));
      pieces.push(P(mk.plant(), 0, hd * 0.65));
      pieces.push(P(mk.sideTable(), hw * 0.35, sofaZ + 0.45));
      pieces.push(P(mk.sideTable(), -hw * 0.35, sofaZ + 0.45));
      pieces.push(P(mk.thermostat(), -hw * 0.45, -hd * 0.88));
      pieces.push(P(mk.chandelier()));
      // dining zone
      pieces.push(P(mk.diningTable(), hw * 0.15, hd * 0.15));
      for (const [dx, dz] of [[-0.55, 0.45], [0.55, 0.45], [-0.55, -0.45], [0.55, -0.45], [0, 0.7], [0, -0.7]]) {
        pieces.push(P(mk.diningChair(), hw * 0.15 + dx, hd * 0.15 + dz));
      }
      if (lux >= 3) {
        pieces.push(P(mk.gamingRig(), -hw * 0.45, hd * 0.25));
        pieces.push(P(mk.barCounter(), -hw * 0.1, hd * 0.55));
        pieces.push(P(mk.barStool(), -0.8, hd * 0.35));
        pieces.push(P(mk.barStool(), 0.2, hd * 0.35));
        pieces.push(P(mk.barStool(), -0.3, hd * 0.35));
      }
      if (lux >= 4) {
        pieces.push(P(mk.workstation(), hw * 0.45, -hd * 0.15, Math.PI));
        pieces.push(P(mk.bench(), 0, hd * 0.7));
      }
    } else if (r.label === 'Kitchen') {
      pieces.push(P(mk.kitchenCounter(), 0, -hd * 0.3));
      pieces.push(P(mk.fridge(), -hw * 0.5, hd * 0.2));
      pieces.push(P(mk.stove(), hw * 0.35, -hd * 0.3));
      pieces.push(P(mk.diningTable(), 0, hd * 0.22));
      for (const [dx, dz] of [[-0.55, 0.4], [0.55, 0.4], [-0.55, -0.4], [0.55, -0.4]]) {
        pieces.push(P(mk.diningChair(), dx, hd * 0.22 + dz));
      }
      pieces.push(P(mk.smartPanel(), hw * 0.4, -hd * 0.85));
      pieces.push(P(mk.smartSpeaker(), -hw * 0.4, hd * 0.35));
      if (lux >= 3) {
        pieces.push(P(mk.plant(), hw * 0.5, hd * 0.35));
        pieces.push(P(mk.portraitSm(), -hw * 0.25, -hd * 0.85));
        pieces.push(P(mk.thermostat(), -hw * 0.45, -hd * 0.85));
      }
      if (lux >= 4) {
        pieces.push(P(mk.bookshelf(), -hw * 0.55, -hd * 0.08));
        pieces.push(P(mk.chandelier()));
        pieces.push(P(mk.ledStrip(2.2), 0, -hd * 0.3));
      }
    } else {
      pieces.push(P(mk.diningTable(), 0, 0));
      for (const [dx, dz] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]]) {
        pieces.push(P(mk.diningChair(), dx, dz));
      }
      pieces.push(P(mk.portrait(), 0, -hd * 0.85));
      pieces.push(P(mk.smartSpeaker(), hw * 0.4, hd * 0.3));
      if (lux >= 3) pieces.push(P(mk.plant(), hw * 0.45, hd * 0.35));
    }

    pieces.forEach(p => g.add(p));
    g.position.set((r.x0 + r.x1) / 2, wy, (r.z0 + r.z1) / 2);
    return g;
  }

  return { furnishRoom };
}

/* ============================================================
   BUILD HOUSE GEOMETRY
   ============================================================ */
function buildHouse(spec) {
  const scene = scene3d.scene;
  if (scene3d.groups) {
    Object.values(scene3d.groups).forEach(g => { scene.remove(g); disposeGroup(g); });
  }

  const p = spec.palette;
  const lux = spec.lux;
  const matFoundation = toonMat(0x9099a3);
  const matFrame = toonMat(0xaab0bd);
  const matWall = toonMat(desaturate(p.a, 0.45));
  const matRoof = toonMat(desaturate(p.roof, 0.4));
  const matGlass = new THREE.MeshToonMaterial({ color: desaturate(p.accent, 0.3), transparent: true, opacity: 0.42, gradientMap: toonGradientMap });
  const matSill = toonMat(0xf2f2ef);
  const matDoor = toonMat(0x6b5847);
  const matDoorFrame = toonMat(desaturate(p.accent, 0.35));
  const matHandle = toonMat(0xd8c98a);
  const matPartition = toonMat(0xe9e9e4);
  const matPath = toonMat(0xc4beb0);
  const matFence = toonMat(0x4a5568);
  const matGate = toonMat(0x2c333f);
  const matPillar = toonMat(0x8a9099);

  const groups = {
    foundation: new THREE.Group(),
    frame: new THREE.Group(),
    walls: new THREE.Group(),
    fixtures: new THREE.Group(),
    roof: new THREE.Group(),
    interior: new THREE.Group(),
    furniture: new THREE.Group(),
    site: new THREE.Group(),
  };

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: false, linewidth: 2 });
  const addEdges = (mesh) => {
    if (mesh.userData && mesh.userData.noEdges) return;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 20),
      new THREE.LineBasicMaterial({ color: 0x111111 })
    );
    mesh.add(edges);
  };
  const units = [];
  // Individual materials — each item type has its own name, unit price, and running count
  const MAT_INFO = {
    concrete:     { name: 'Concrete (foundation / slab)', unit: 'm³', unitCost: 145 },
    steel_column: { name: 'Steel column', unit: 'pcs', unitCost: 280 },
    floor_slab:   { name: 'Floor slab panel', unit: 'pcs', unitCost: 120 },
    brick:        { name: 'Brick / block wall unit', unit: 'pcs', unitCost: 8.5 },
    timber_plank: { name: 'Timber plank / fascia', unit: 'pcs', unitCost: 22 },
    roof_tile:    { name: 'Roof tile / sheet panel', unit: 'pcs', unitCost: 18 },
    roof_ridge:   { name: 'Ridge beam / cap', unit: 'pcs', unitCost: 95 },
    door:         { name: 'Exterior door', unit: 'pcs', unitCost: 450 },
    door_frame:   { name: 'Door frame', unit: 'pcs', unitCost: 85 },
    window:       { name: 'Window unit', unit: 'pcs', unitCost: 320 },
    glass:        { name: 'Glazing panel', unit: 'pcs', unitCost: 95 },
    sill:         { name: 'Window sill', unit: 'pcs', unitCost: 35 },
    partition:    { name: 'Interior partition board', unit: 'pcs', unitCost: 55 },
    furniture:    { name: 'Furniture piece', unit: 'pcs', unitCost: 180 },
    paving:       { name: 'Paving / driveway slab', unit: 'pcs', unitCost: 28 },
    fence_panel:  { name: 'Fence panel', unit: 'pcs', unitCost: 75 },
    gate:         { name: 'Entrance gate leaf', unit: 'pcs', unitCost: 650 },
    pillar:       { name: 'Gate / fence pillar', unit: 'pcs', unitCost: 110 },
    tree:         { name: 'Landscape tree', unit: 'pcs', unitCost: 90 },
    pool:         { name: 'Pool structure / finish', unit: 'pcs', unitCost: 2400 },
    playground:   { name: 'Playground equipment', unit: 'pcs', unitCost: 380 },
    car:          { name: 'Vehicle (site prop)', unit: 'pcs', unitCost: 0 },
    light:        { name: 'Exterior light fitting', unit: 'pcs', unitCost: 65 },
    camera:       { name: 'Security camera', unit: 'pcs', unitCost: 120 },
    other:        { name: 'Misc component', unit: 'pcs', unitCost: 40 },
  };
  // map construction stage → default material key when not specified
  const STAGE_DEFAULT_MAT = {
    foundation: 'concrete', frame: 'steel_column', walls: 'brick',
    fixtures: 'other', roof: 'roof_tile', interior: 'partition',
    furniture: 'furniture', site: 'other',
  };
  const matCounts = {}; // keyed by material key
  const tagMesh = (mesh, stageKey, opts) => {
    opts = opts || {};
    const matKey = opts.matKey || STAGE_DEFAULT_MAT[stageKey] || 'other';
    const info = MAT_INFO[matKey] || MAT_INFO.other;
    matCounts[matKey] = (matCounts[matKey] || 0) + 1;
    const data = {
      stageKey,
      matKey,
      label: opts.label || info.name,
      materialName: info.name,
      unit: info.unit,
      unitCostUsd: info.unitCost,
      index: matCounts[matKey],
      qtyAll: () => matCounts[matKey],
    };
    mesh.userData.matInfo = data;
    mesh.traverse(c => { if (c.isMesh) c.userData.matInfo = data; });
  };
  const pushUnit = (group, mesh, stageKey, opts) => {
    opts = opts || {};
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (mesh.isMesh) addEdges(mesh);
    else if (mesh.isGroup) mesh.children.forEach(c => { if (c.isMesh) addEdges(c); });
    tagMesh(mesh, stageKey, opts);
    group.add(mesh);
    units.push({ mesh, stageKey, drop: !!opts.drop });
  };

  // ---- foundation ----
  const fH = 0.7;
  const fMesh = new THREE.Mesh(new THREE.BoxGeometry(spec.W + 1.4, fH, spec.D + 1.4), matFoundation);
  fMesh.position.y = -fH / 2;
  pushUnit(groups.foundation, fMesh, 'foundation', { matKey: 'concrete', label: 'Concrete foundation' });

  // short path from house to driveway
  const shortPath = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 2.8), matPath);
  shortPath.position.set(spec.door.x, 0.03, -spec.D / 2 - 1.6);
  pushUnit(groups.foundation, shortPath, 'foundation', { matKey: 'paving', label: 'Entrance paving' });

  // ---- structural frame ----
  const colXs = [0]; for (let gx = 2; gx < spec.gridX; gx += 2) colXs.push(gx); colXs.push(spec.gridX);
  const colZs = [0]; for (let gz = 2; gz < spec.gridZ; gz += 2) colZs.push(gz); colZs.push(spec.gridZ);
  const colPositions = [];
  const seen = new Set();
  colXs.forEach(gx => {
    [[-spec.D / 2], [spec.D / 2]].forEach(([z]) => {
      const x = gx * UNIT - spec.W / 2, k = x.toFixed(1) + ',' + z.toFixed(1);
      if (!seen.has(k)) { seen.add(k); colPositions.push({ x, z }); }
    });
  });
  colZs.forEach(gz => {
    [[-spec.W / 2], [spec.W / 2]].forEach(([x]) => {
      const z = gz * UNIT - spec.D / 2, k = x.toFixed(1) + ',' + z.toFixed(1);
      if (!seen.has(k)) { seen.add(k); colPositions.push({ x, z }); }
    });
  });

  for (let f = 0; f < spec.floors; f++) {
    colPositions.forEach(c => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, FLOOR_H, 0.35), matFrame);
      col.position.set(c.x, f * FLOOR_H + FLOOR_H / 2, c.z);
      pushUnit(groups.frame, col, 'frame', { matKey: 'steel_column', label: 'Steel column' });
    });
    if (f > 0) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(spec.W - 0.3, 0.2, spec.D - 0.3), matFrame);
      slab.position.y = f * FLOOR_H;
      pushUnit(groups.frame, slab, 'frame', { matKey: 'floor_slab', label: 'Floor slab' });
    }
  }

  // ---- walls ----
  const wallT = 0.25;
  for (let f = 0; f < spec.floors; f++) {
    const wy = f * FLOOR_H + FLOOR_H / 2;
    for (let gx = 0; gx < spec.gridX; gx++) {
      const cx = gx * UNIT - spec.W / 2 + UNIT / 2;
      const segF = new THREE.Mesh(new THREE.BoxGeometry(UNIT - 0.05, FLOOR_H - 0.06, wallT), matWall);
      segF.position.set(cx, wy, -spec.D / 2);
      segF.userData.side = 'front';
      pushUnit(groups.walls, segF, 'walls', { matKey: 'brick', label: 'Brick wall unit' });
      const segB = new THREE.Mesh(new THREE.BoxGeometry(UNIT - 0.05, FLOOR_H - 0.06, wallT), matWall);
      segB.position.set(cx, wy, spec.D / 2);
      segB.userData.side = 'back';
      pushUnit(groups.walls, segB, 'walls', { matKey: 'brick', label: 'Brick wall unit' });
    }
    for (let gz = 0; gz < spec.gridZ; gz++) {
      const cz = gz * UNIT - spec.D / 2 + UNIT / 2;
      const segL = new THREE.Mesh(new THREE.BoxGeometry(wallT, FLOOR_H - 0.06, UNIT - 0.05), matWall);
      segL.position.set(-spec.W / 2, wy, cz);
      segL.userData.side = 'left';
      pushUnit(groups.walls, segL, 'walls', { matKey: 'brick', label: 'Brick wall unit' });
      const segR = new THREE.Mesh(new THREE.BoxGeometry(wallT, FLOOR_H - 0.06, UNIT - 0.05), matWall);
      segR.position.set(spec.W / 2, wy, cz);
      segR.userData.side = 'right';
      pushUnit(groups.walls, segR, 'walls', { matKey: 'brick', label: 'Brick wall unit' });
    }
    if (f > 0) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(spec.W + 0.05, 0.08, spec.D + 0.05), matFrame);
      band.position.y = f * FLOOR_H;
      pushUnit(groups.walls, band, 'walls');
    }
  }

  // ---- ATTACHED GARAGE (solid) — skip if open carport ----
  if (spec.garage && !spec.garage.open) {
    const g = spec.garage;
    const gMat = toonMat(desaturate(p.a, 0.4));
    const gWalls = [
      [g.w, 0.22, 0, -g.d / 2], [g.w, 0.22, 0, g.d / 2],
      [0.22, g.d, -g.w / 2, 0], [0.22, g.d, g.w / 2, 0],
    ];
    gWalls.forEach(([ww, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, g.h, dd), gMat);
      m.position.set(g.x + ox, g.h / 2, g.z + oz);
      pushUnit(groups.walls, m, 'walls');
    });
    const gRoof = new THREE.Mesh(new THREE.BoxGeometry(g.w + 0.35, 0.18, g.d + 0.35), matRoof);
    gRoof.position.set(g.x, g.h + 0.1, g.z);
    pushUnit(groups.roof, gRoof, 'roof', { drop: true });
    const gDoor = new THREE.Mesh(new THREE.BoxGeometry(g.w * 0.72, g.h * 0.78, 0.1), toonMat(0x5a5048));
    gDoor.position.set(g.x, g.h * 0.42, g.z - g.d / 2 - 0.06);
    pushUnit(groups.fixtures, gDoor, 'fixtures');
    for (let i = 1; i <= 3; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(g.w * 0.7, 0.03, 0.02), toonMat(0x3a3530));
      line.position.set(g.x, g.h * 0.2 * i, g.z - g.d / 2 - 0.12);
      pushUnit(groups.fixtures, line, 'fixtures');
    }
  }

  // ---- SIDE WING volume (L-plan massing at high luxury) ----
  if (spec.wing) {
    const w = spec.wing;
    const wingH = w.floors * FLOOR_H;
    const wingMat = toonMat(desaturate(p.b || p.a, 0.4));
    [[w.w, 0.22, 0, -w.d / 2], [w.w, 0.22, 0, w.d / 2],
     [0.22, w.d, -w.w / 2, 0], [0.22, w.d, w.w / 2, 0]].forEach(([ww, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wingH, dd), wingMat);
      m.position.set(w.x + ox, wingH / 2, w.z + oz);
      pushUnit(groups.walls, m, 'walls');
    });
    // wing floors slabs
    for (let f = 1; f < w.floors; f++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w.w - 0.2, 0.18, w.d - 0.2), matFrame);
      slab.position.set(w.x, f * FLOOR_H, w.z);
      pushUnit(groups.frame, slab, 'frame', { matKey: 'floor_slab', label: 'Floor slab' });
    }
    // wing roof deck
    const wRoof = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.3, 0.18, w.d + 0.3), matRoof);
    wRoof.position.set(w.x, wingH + 0.1, w.z);
    pushUnit(groups.roof, wRoof, 'roof', { drop: true });
  }

  // ---- SECOND WING (courtyard / grand-villa U-plan) ----
  if (spec.wing2) {
    const w = spec.wing2;
    const wingH = w.floors * FLOOR_H;
    const wingMat = toonMat(desaturate(p.b || p.a, 0.35));
    [[w.w, 0.22, 0, -w.d / 2], [w.w, 0.22, 0, w.d / 2],
     [0.22, w.d, -w.w / 2, 0], [0.22, w.d, w.w / 2, 0]].forEach(([ww, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wingH, dd), wingMat);
      m.position.set(w.x + ox, wingH / 2, w.z + oz);
      pushUnit(groups.walls, m, 'walls');
    });
    for (let f = 1; f < w.floors; f++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w.w - 0.2, 0.18, w.d - 0.2), matFrame);
      slab.position.set(w.x, f * FLOOR_H, w.z);
      pushUnit(groups.frame, slab, 'frame');
    }
    const wRoof = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.3, 0.18, w.d + 0.3), matRoof);
    wRoof.position.set(w.x, wingH + 0.1, w.z);
    pushUnit(groups.roof, wRoof, 'roof', { drop: true });
  }

  // ---- FUTURISTIC CANTILEVER volume ----
  if (spec.cantilever) {
    const c = spec.cantilever;
    const cMat = toonMat(desaturate(p.accent || p.a, 0.25));
    // floating box
    const body = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), cMat);
    body.position.set(c.x, c.y + c.h / 2, c.z);
    pushUnit(groups.walls, body, 'walls');
    // glass strip under cantilever
    const glassStrip = new THREE.Mesh(
      new THREE.BoxGeometry(c.w * 0.9, 0.15, c.d * 0.9),
      matGlass
    );
    glassStrip.position.set(c.x, c.y + 0.05, c.z);
    pushUnit(groups.fixtures, glassStrip, 'fixtures');
    // thin support columns
    for (const sx of [-c.w * 0.35, c.w * 0.35]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.25, c.y, 0.25), matFrame);
      col.position.set(c.x + sx, c.y / 2, c.z + c.d * 0.2);
      pushUnit(groups.frame, col, 'frame');
    }
  }

  // ---- OFFICE TOWER PODIUM (wider base) ----
  if (spec.podium) {
    const pd = spec.podium;
    const pMat = toonMat(desaturate(p.b || p.a, 0.3));
    // four walls of podium
    [[pd.w, 0.25, 0, -pd.d / 2], [pd.w, 0.25, 0, pd.d / 2],
     [0.25, pd.d, -pd.w / 2, 0], [0.25, pd.d, pd.w / 2, 0]].forEach(([ww, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, pd.h, dd), pMat);
      m.position.set(ox, pd.h / 2, oz);
      pushUnit(groups.walls, m, 'walls');
    });
    // podium roof terrace ring
    const pRoof = new THREE.Mesh(new THREE.BoxGeometry(pd.w + 0.3, 0.2, pd.d + 0.3), matRoof);
    pRoof.position.set(0, pd.h + 0.1, 0);
    pushUnit(groups.roof, pRoof, 'roof', { drop: true });
  }

  // open carport (scandinavian) — posts + flat roof, no solid walls
  if (spec.garage && spec.garage.open) {
    const g = spec.garage;
    const postMat = toonMat(0x5c4030);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, g.h, 0.2), postMat);
        post.position.set(g.x + sx * (g.w / 2 - 0.3), g.h / 2, g.z + sz * (g.d / 2 - 0.3));
        pushUnit(groups.frame, post, 'frame');
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(g.w + 0.4, 0.16, g.d + 0.4), matRoof);
    roof.position.set(g.x, g.h + 0.08, g.z);
    pushUnit(groups.roof, roof, 'roof', { drop: true });
  }

  // ---- fixtures: door + windows ----
  const doorW = 1.15, doorH = 2.35;
  const doorGroup = new THREE.Group();
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.22, doorH + 0.2, 0.08), matDoorFrame);
  doorFrame.position.set(0, doorH / 2, -0.22);
  doorGroup.add(doorFrame);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), matDoor);
  doorMesh.position.set(0, doorH / 2, -0.26);
  doorGroup.add(doorMesh);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), matHandle);
  handle.position.set(doorW / 2 - 0.15, doorH * 0.5, -0.31);
  doorGroup.add(handle);
  const step = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.8, 0.16, 0.65), matFoundation);
  step.position.set(0, 0.08, -0.55);
  doorGroup.add(step);
  doorGroup.position.set(spec.door.x, 0, -spec.D / 2);
  pushUnit(groups.fixtures, doorGroup, 'fixtures');

  spec.windows.forEach(w => {
    const winGroup = new THREE.Group();
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.06), matGlass);
    winGroup.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.14), matSill);
    sill.position.y = -0.68;
    winGroup.add(sill);
    const clear = 0.16;
    let ox = 0, oz = 0;
    if (Math.abs(w.rot) < 0.01) oz = -clear;
    else if (Math.abs(w.rot - Math.PI) < 0.01) oz = clear;
    else if (w.rot < 0) ox = -clear;
    else ox = clear;
    winGroup.position.set(w.x + ox, w.y, w.z + oz);
    winGroup.rotation.y = w.rot;
    pushUnit(groups.fixtures, winGroup, 'fixtures');
  });

  // light outdoor garden/terrace only here — pool & playground placed WITH the cars later
  const outdoor = spec.outdoor;
  if (outdoor.includes('garden')) {
    const gMat = toonMat(0x6f9f5c);
    const bedX = -spec.W / 2 - 3.5;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, spec.D * 0.55), gMat);
    bed.position.set(bedX, 0.075, -spec.D * 0.15);
    pushUnit(groups.site, bed, 'site', { matKey: 'other', label: 'Garden bed' });
    const bushMat = toonMat(0x548a49);
    for (let i = 0; i < 4; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), bushMat);
      bush.position.set(bedX, 0.38, -spec.D * 0.35 + i * (spec.D * 0.45 / 3));
      pushUnit(groups.site, bush, 'site', { drop: true, matKey: 'other', label: 'Shrub' });
    }
  }
  if (outdoor.includes('terrace')) {
    const terr = new THREE.Mesh(new THREE.BoxGeometry(spec.W * 0.7, 0.06, 2.8), matPath);
    terr.position.set(0, 0.03, spec.D / 2 + 1.6);
    pushUnit(groups.site, terr, 'site', { matKey: 'paving', label: 'Terrace paving' });
  }

  // ---- ROOFS — sealed deck first; pitched forms sit FULLY above walls ----
  const roofY = spec.wallH; // top of walls
  const roofType = spec.roofType;
  const deckT = 0.32;       // thick sealed lid
  const over = 0.85;        // overhang past outer walls
  const deckTop = roofY + deckT; // absolute top of the sealed deck

  // 1) SOLID SEAL — thin ceiling lid so interior is closed.
  // For pitched roofs the hip/gable faces are the visible outer roof (no big flat "cut" plate on top).
  const isPitched = ['hip', 'hip-complex', 'gable', 'complex-pitch', 'multi-gable'].includes(roofType);
  const lidT = isPitched ? 0.18 : deckT;
  const baseSlab = new THREE.Mesh(
    new THREE.BoxGeometry(spec.W + (isPitched ? 0.2 : over * 2), lidT, spec.D + (isPitched ? 0.2 : over * 2)),
    matRoof
  );
  baseSlab.position.y = roofY + lidT / 2;
  pushUnit(groups.roof, baseSlab, 'roof', { drop: true, matKey: isPitched ? 'floor_slab' : 'roof_tile', label: isPitched ? 'Ceiling slab' : 'Roof deck' });

  // fascia / eave band — only on flat roofs (pitched roofs use triangular eaves)
  if (!isPitched) {
    const fasciaH = 0.22;
    const fasciaY = roofY + fasciaH / 2;
    [
      [spec.W + over * 2, fasciaH, 0.14, 0, -spec.D / 2 - over + 0.07],
      [spec.W + over * 2, fasciaH, 0.14, 0,  spec.D / 2 + over - 0.07],
      [0.14, fasciaH, spec.D + over * 2, -spec.W / 2 - over + 0.07, 0],
      [0.14, fasciaH, spec.D + over * 2,  spec.W / 2 + over - 0.07, 0],
    ].forEach(([ww, hh, dd, ox, oz]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), matRoof);
      f.position.set(ox, fasciaY, oz);
      pushUnit(groups.roof, f, 'roof', { drop: true, matKey: 'timber_plank', label: 'Fascia board' });
    });
  }

  // helper: place a rotated roof plane so its LOWEST point stays above deckTop
  // For rotation about Z by ang: lowestY = cy - |L/2*sin(ang)| - |t/2*cos(ang)|
  function placeSlope(L, t, Dlen, cx, cz, ang, axis) {
    const sinA = Math.abs(Math.sin(ang));
    const cosA = Math.abs(Math.cos(ang));
    // run axis depends on rotation: Z-rot pitches along X (use L), X-rot pitches along Z (use Dlen)
    const run = axis === 'x' ? Dlen : L;
    const drop = (run / 2) * sinA + (t / 2) * cosA;
    const cy = deckTop + drop + 0.06; // clearance so nothing clips into the deck/walls
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, t, Dlen), matRoof);
    m.position.set(cx, cy, cz);
    if (axis === 'z') m.rotation.z = ang;
    else if (axis === 'x') m.rotation.x = ang;
    pushUnit(groups.roof, m, 'roof', { drop: true });
    return m;
  }

  // 2) STYLE FORMS — purely decorative volumes ON TOP of the sealed deck
  if (roofType === 'flat' || roofType === 'flat-stepped') {
    // low parapet ring (modern flat roof)
    const ph = 0.55, pt = 0.2;
    const yP = deckTop + ph / 2;
    [
      [spec.W + over * 2 + 0.1, ph, pt, 0, -spec.D / 2 - over],
      [spec.W + over * 2 + 0.1, ph, pt, 0,  spec.D / 2 + over],
      [pt, ph, spec.D + over * 2 + 0.1, -spec.W / 2 - over, 0],
      [pt, ph, spec.D + over * 2 + 0.1,  spec.W / 2 + over, 0],
    ].forEach(([ww, hh, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), matRoof);
      m.position.set(ox, yP, oz);
      pushUnit(groups.roof, m, 'roof', { drop: true });
    });
    if (roofType === 'flat-stepped' || lux >= 4) {
      const sw = spec.W * 0.5, sd = spec.D * 0.45;
      const step = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.2, sd), matRoof);
      step.position.set(spec.W * 0.06, deckTop + 0.35, -spec.D * 0.04);
      pushUnit(groups.roof, step, 'roof', { drop: true });
      const sph = 0.4;
      [
        [sw + 0.1, sph, 0.12, 0, -sd / 2],
        [sw + 0.1, sph, 0.12, 0,  sd / 2],
        [0.12, sph, sd + 0.1, -sw / 2, 0],
        [0.12, sph, sd + 0.1,  sw / 2, 0],
      ].forEach(([ww, hh, dd, ox, oz]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), matRoof);
        m.position.set(spec.W * 0.06 + ox, deckTop + 0.45 + hh / 2, -spec.D * 0.04 + oz);
        pushUnit(groups.roof, m, 'roof', { drop: true });
      });
    }
  }

  if (roofType === 'gable' || roofType === 'complex-pitch' || roofType === 'multi-gable') {
    const ang = 0.34; // ~19.5°
    const halfSpan = spec.W / 2 + over;
    // slope length along the pitch direction must reach from eave to ridge
    const slopeL = halfSpan / Math.cos(ang) + 0.15;
    const thick = 0.2;
    const depth = spec.D + over * 2;
    placeSlope(slopeL, thick, depth, -halfSpan * 0.5, 0,  ang, 'z');
    placeSlope(slopeL, thick, depth,  halfSpan * 0.5, 0, -ang, 'z');
    // gable end walls sitting on the deck (fill the triangle visually)
    const ridgeH = halfSpan * Math.tan(ang);
    const gableMat = toonMat(desaturate(p.a, 0.4));
    for (const z of [-spec.D / 2 - over * 0.3, spec.D / 2 + over * 0.3]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(spec.W + over * 1.2, ridgeH * 0.95, 0.14), gableMat);
      g.position.set(0, deckTop + ridgeH * 0.48, z);
      pushUnit(groups.roof, g, 'roof', { drop: true });
    }
    // second ridge for multi-gable
    if (roofType === 'multi-gable' || roofType === 'complex-pitch') {
      const sHalf = spec.W * 0.22 + 0.3;
      const sLen = sHalf / Math.cos(ang) + 0.1;
      const sDepth = spec.D * 0.55 + over;
      const sx = -spec.W * 0.15;
      const sz = spec.D * 0.08;
      placeSlope(sLen, thick, sDepth, sx - sHalf * 0.5, sz,  ang, 'z');
      placeSlope(sLen, thick, sDepth, sx + sHalf * 0.5, sz, -ang, 'z');
    }
  }

  if (roofType === 'hip' || roofType === 'hip-complex') {
    // Classic hip roof: 2 trapezoid faces + 2 triangular ends (matches SketchUp ref)
    // No rotated boxes → no leftover "cuts" sticking out
    const hw = spec.W / 2 + over;
    const hd = spec.D / 2 + over;
    const ridgeH = 3.2 + lux * 0.3;
    const ridgeY = deckTop + ridgeH;
    // ridge length along the longer plan axis (short when nearly square)
    const longIsX = spec.W >= spec.D;
    const ridgeHalf = longIsX
      ? Math.max(0.6, (spec.W - spec.D) * 0.35 + 0.8)
      : Math.max(0.6, (spec.D - spec.W) * 0.35 + 0.8);

    // dedicated roof face material — DoubleSide so nothing disappears from any angle
    const matHipFace = matRoof.clone();
    matHipFace.side = THREE.DoubleSide;
    const makeFace = (verts) => {
      const geo = new THREE.BufferGeometry();
      const pos = [];
      if (verts.length === 3) {
        // both windings for solid look
        const [a, b, c] = verts;
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      } else {
        const [a, b, c, d] = verts;
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
        // reverse for backface
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
        pos.push(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2]);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, matHipFace);
      m.userData.noEdges = true;
      pushUnit(groups.roof, m, 'roof', { drop: true, matKey: 'roof_tile', label: 'Roof face panel' });
      const edgePts = [];
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i], b = verts[(i + 1) % verts.length];
        edgePts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
      const eGeo = new THREE.BufferGeometry();
      eGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
      const lines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ color: 0x111111 }));
      groups.roof.add(lines);
    };

    // eave corners (at deck top)
    const fl = [-hw, deckTop, -hd]; // front-left
    const fr = [ hw, deckTop, -hd]; // front-right
    const br = [ hw, deckTop,  hd]; // back-right
    const bl = [-hw, deckTop,  hd]; // back-left

    if (longIsX) {
      const rL = [-ridgeHalf, ridgeY, 0];
      const rR = [ ridgeHalf, ridgeY, 0];
      makeFace([fl, fr, rR, rL]); // front trapezoid
      makeFace([br, bl, rL, rR]); // back trapezoid
      makeFace([fl, bl, rL]);     // left triangle
      makeFace([fr, br, rR]);     // right triangle
    } else {
      const rF = [0, ridgeY, -ridgeHalf];
      const rB = [0, ridgeY,  ridgeHalf];
      makeFace([fl, bl, rB, rF]); // left trapezoid
      makeFace([br, fr, rF, rB]); // right trapezoid
      makeFace([fl, fr, rF]);     // front triangle
      makeFace([bl, br, rB]);     // back triangle
    }

    // ridge beam
    const ridgeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(longIsX ? ridgeHalf * 2 + 0.3 : 0.18, 0.12, longIsX ? 0.18 : ridgeHalf * 2 + 0.3),
      matRoof
    );
    ridgeBeam.position.set(0, ridgeY + 0.06, 0);
    pushUnit(groups.roof, ridgeBeam, 'roof', { drop: true });
  }

  if (roofType === 'angular') {
    // slabs lifted fully above deck — no dip into walls
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(spec.W * 0.8, 0.22, spec.D * 0.9), matRoof);
    a1.position.set(-spec.W * 0.05, deckTop + 1.15, 0);
    a1.rotation.z = 0.14;
    a1.rotation.x = -0.06;
    pushUnit(groups.roof, a1, 'roof', { drop: true });
    const a2 = new THREE.Mesh(
      new THREE.BoxGeometry(spec.W * 0.45, 0.2, spec.D * 0.5),
      toonMat(desaturate(p.accent, 0.25))
    );
    a2.position.set(spec.W * 0.2, deckTop + 1.85, -spec.D * 0.06);
    a2.rotation.z = -0.2;
    pushUnit(groups.roof, a2, 'roof', { drop: true });
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 1.4), matRoof);
    fin.position.set(spec.W * 0.36, deckTop + 1.5, 0);
    pushUnit(groups.roof, fin, 'roof', { drop: true });
  }

  // also seal garage roof if present (already built earlier, reinforce coverage)
  if (spec.garage) {
    const g = spec.garage;
    const gDeck = new THREE.Mesh(
      new THREE.BoxGeometry(g.w + 0.5, 0.28, g.d + 0.5),
      matRoof
    );
    gDeck.position.set(g.x, g.h + 0.14, g.z);
    pushUnit(groups.roof, gDeck, 'roof', { drop: true });
  }
  if (spec.wing) {
    const w = spec.wing;
    const wingH = w.floors * FLOOR_H;
    const wDeck = new THREE.Mesh(
      new THREE.BoxGeometry(w.w + 0.5, 0.28, w.d + 0.5),
      matRoof
    );
    wDeck.position.set(w.x, wingH + 0.14, w.z);
    pushUnit(groups.roof, wDeck, 'roof', { drop: true });
  }

  // rooftop lounge
  if (outdoor.includes('rooftop')) {
    const terraceMat = toonMat(0x7fa862);
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(spec.W * 0.5, 0.04, spec.D * 0.45), terraceMat);
    terrace.position.set(-spec.W * 0.08, roofY + 0.55, spec.D * 0.05);
    pushUnit(groups.roof, terrace, 'roof', { drop: true });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.55), toonMat(0xf2f2ee));
    bench.position.set(-spec.W * 0.08, roofY + 0.75, spec.D * 0.05 + 1.0);
    pushUnit(groups.roof, bench, 'roof', { drop: true });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.45, 12), toonMat(0xd9bd6e));
    canopy.position.set(-spec.W * 0.08, roofY + 2.6, spec.D * 0.05 - 0.5);
    pushUnit(groups.roof, canopy, 'roof', { drop: true });
  }

  // luxury glass penthouse volume
  if (lux >= 4) {
    const pw = spec.W * 0.42, pd = spec.D * 0.36, ph = FLOOR_H * 0.78;
    const px = spec.W * 0.05, pz = -spec.D * 0.05;
    const pBaseY = roofY + 0.55;
    const matPentWall = toonMat(desaturate(p.accent, 0.25), { transparent: true, opacity: 0.4 });
    const matPentFrame = toonMat(0x33383f);
    const pBase = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.3, 0.14, pd + 0.3), matRoof);
    pBase.position.set(px, pBaseY, pz);
    pushUnit(groups.roof, pBase, 'roof', { drop: true });
    const wallY = pBaseY + 0.14 + ph / 2;
    [[pw, 0.1, 0, -pd / 2], [pw, 0.1, 0, pd / 2], [0.1, pd, -pw / 2, 0], [0.1, pd, pw / 2, 0]].forEach(([ww, dd, ox, oz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, ph, dd), matPentWall);
      m.position.set(px + ox, wallY, pz + oz);
      pushUnit(groups.roof, m, 'roof', { drop: true });
    });
    [[-pw / 2, -pd / 2], [pw / 2, -pd / 2], [-pw / 2, pd / 2], [pw / 2, pd / 2]].forEach(([cx, cz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, ph, 0.12), matPentFrame);
      post.position.set(px + cx, wallY, pz + cz);
      pushUnit(groups.roof, post, 'roof', { drop: true });
    });
    const pRoof = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.4, 0.12, pd + 0.4), matRoof);
    pRoof.position.set(px, pBaseY + 0.14 + ph + 0.06, pz);
    pushUnit(groups.roof, pRoof, 'roof', { drop: true });
  }

  // staircase
  if (spec.floors >= 2) {
    const parlour = spec.roomPlan[0][0];
    const stairW = 1.15;
    const stairX = clamp(parlour.x1 - 1.6, parlour.x0 + 0.9, parlour.x1 - 0.9);
    const steps = 14;
    const runDepth = 3.5;
    const stepRun = runDepth / steps;
    const stairZStart = spec.D / 2 - 0.8;
    const matStair = toonMat(desaturate(p.roof, 0.4));
    const matRailPost = toonMat(0x3a4048);
    for (let f = 0; f < spec.floors - 1; f++) {
      const baseY = f * FLOOR_H;
      const stepH = FLOOR_H / steps;
      for (let s = 0; s < steps; s++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, stepH * 0.9, stepRun * 0.9), matStair);
        step.position.set(stairX, baseY + stepH * (s + 0.5), stairZStart - s * stepRun);
        pushUnit(groups.interior, step, 'interior');
      }
      for (let s = 0; s < steps; s += 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), matRailPost);
        post.position.set(stairX + stairW / 2 + 0.05, baseY + stepH * (s + 0.5) + 0.42, stairZStart - s * stepRun);
        pushUnit(groups.interior, post, 'interior');
      }
    }
  }

  // balcony on top floor
  if (spec.floors >= 2) {
    const balcF = spec.floors - 1;
    const balcW = spec.W * 0.48, balcD = 1.9;
    const balcY = balcF * FLOOR_H;
    const balcX = -spec.W * 0.12;
    const balcZ = -spec.D / 2 - balcD / 2 - 0.02;
    const matBalcSlab = toonMat(0xd8d5cc);
    const matBalcRail = toonMat(0xbfe4ea, { transparent: true, opacity: 0.35 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(balcW, 0.18, balcD), matBalcSlab);
    slab.position.set(balcX, balcY + 0.09, balcZ);
    pushUnit(groups.fixtures, slab, 'fixtures', { drop: true });
    const railH = 0.95;
    [[balcW, 0.05, 0, -balcD / 2], [0.05, balcD, -balcW / 2, 0], [0.05, balcD, balcW / 2, 0]].forEach(([ww, dd, ox, oz]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ww, railH, dd), matBalcRail);
      rail.position.set(balcX + ox, balcY + 0.18 + railH / 2, balcZ + oz);
      pushUnit(groups.fixtures, rail, 'fixtures', { drop: true });
    });
  }

  // ---- GATED COMPOUND + LONG DRIVEWAY ----
  const driveLen = spec.driveLen;
  const driveW = 4.2;
  const gateZ = -spec.D / 2 - driveLen;
  const compoundPad = 5.5;

  // long driveway
  const driveway = new THREE.Mesh(new THREE.BoxGeometry(driveW, 0.08, driveLen + 2), matPath);
  driveway.position.set(spec.door.x, 0.04, -spec.D / 2 - driveLen / 2 - 1);
  pushUnit(groups.site, driveway, 'foundation');

  // driveway edge strips
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, driveLen + 2), toonMat(0x9a9588));
    strip.position.set(spec.door.x + side * (driveW / 2 + 0.2), 0.06, -spec.D / 2 - driveLen / 2 - 1);
    pushUnit(groups.site, strip, 'foundation');
  }

  // tall trees lining both sides of the driveway
  const trunkMat = toonMat(0x5c4030);
  const canopyMat = toonMat(0x3d7a3a);
  const canopyMat2 = toonMat(0x4a8f42);
  const treeSpacing = 5.5;
  const treeCount = Math.max(4, Math.floor(driveLen / treeSpacing));
  for (let i = 0; i < treeCount; i++) {
    const tz = -spec.D / 2 - 3 - i * treeSpacing;
    for (const side of [-1, 1]) {
      const tree = new THREE.Group();
      const trunkH = 4.5 + (i % 3) * 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 8), trunkMat);
      trunk.position.y = trunkH / 2;
      tree.add(trunk);
      const canopyR = 1.4 + (i % 2) * 0.25;
      const c1 = new THREE.Mesh(new THREE.SphereGeometry(canopyR, 10, 10), canopyMat);
      c1.position.y = trunkH + 0.3;
      c1.scale.y = 1.15;
      tree.add(c1);
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(canopyR * 0.7, 8, 8), canopyMat2);
      c2.position.set(0.3, trunkH + 0.9, 0.2);
      tree.add(c2);
      const c3 = new THREE.Mesh(new THREE.SphereGeometry(canopyR * 0.55, 8, 8), canopyMat);
      c3.position.set(-0.25, trunkH + 0.7, -0.15);
      tree.add(c3);
      tree.position.set(spec.door.x + side * (driveW / 2 + 2.4), 0, tz);
      tree.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      pushUnit(groups.site, tree, 'fixtures', { drop: true });
    }
  }

  // entrance pillars + big gate
  const pillarH = 3.2, pillarW = 0.7;
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarW), matPillar);
    pillar.position.set(spec.door.x + side * (driveW / 2 + 1.1), pillarH / 2, gateZ);
    pushUnit(groups.site, pillar, 'fixtures', { drop: true });
    // decorative cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(pillarW + 0.2, 0.2, pillarW + 0.2), matGate);
    cap.position.set(spec.door.x + side * (driveW / 2 + 1.1), pillarH + 0.1, gateZ);
    pushUnit(groups.site, cap, 'fixtures', { drop: true });
  }
  // gate leaves
  const gateLeafW = driveW / 2 + 0.3;
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(gateLeafW, 2.4, 0.12), matGate);
    leaf.position.set(spec.door.x + side * (gateLeafW / 2 + 0.15), 1.2, gateZ + 0.15);
    pushUnit(groups.site, leaf, 'fixtures', { drop: true, matKey: 'gate', label: 'Gate leaf' });
  }
  // arch / header over gate
  const header = new THREE.Mesh(new THREE.BoxGeometry(driveW + 3.2, 0.35, 0.45), matPillar);
  header.position.set(spec.door.x, pillarH + 0.35, gateZ);
  pushUnit(groups.site, header, 'fixtures', { drop: true });

  // perimeter fence — FULL enclosure around house + garage + wing + back pool
  const fenceH = 2.2;
  const fenceT = 0.2;
  const pad = 4.5;
  let cMinX = -spec.W / 2 - pad;
  let cMaxX = spec.W / 2 + pad;
  let cMinZ = gateZ - 1.2;
  let cMaxZ = spec.D / 2 + pad;
  if (spec.garage) {
    cMaxX = Math.max(cMaxX, spec.garage.x + spec.garage.w / 2 + pad);
    cMinZ = Math.min(cMinZ, spec.garage.z - spec.garage.d / 2 - 1);
  }
  if (spec.wing) {
    cMinX = Math.min(cMinX, spec.wing.x - spec.wing.w / 2 - pad);
  }
  if (spec.wing2) {
    cMaxX = Math.max(cMaxX, spec.wing2.x + spec.wing2.w / 2 + pad);
  }
  if (spec.podium) {
    cMinX = Math.min(cMinX, -spec.podium.w / 2 - pad);
    cMaxX = Math.max(cMaxX, spec.podium.w / 2 + pad);
  }
  // reserve space for large BACK pool
  const poolW = Math.max(12, spec.W * 0.85);
  const poolD = Math.max(7, spec.D * 0.5);
  const poolX = 0;
  const poolZ = spec.D / 2 + poolD / 2 + 3.5; // BEHIND the house
  cMaxZ = Math.max(cMaxZ, poolZ + poolD / 2 + 2.5);
  cMinX = Math.min(cMinX, poolX - poolW / 2 - 2);
  cMaxX = Math.max(cMaxX, poolX + poolW / 2 + 2);

  // front wall (with gap for gate)
  const frontLeftLen = (spec.door.x - driveW / 2 - 1.5) - cMinX;
  const frontRightLen = cMaxX - (spec.door.x + driveW / 2 + 1.5);
  if (frontLeftLen > 1) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(frontLeftLen, fenceH, fenceT), matFence);
    fl.position.set(cMinX + frontLeftLen / 2, fenceH / 2, cMinZ);
    pushUnit(groups.site, fl, 'fixtures');
  }
  if (frontRightLen > 1) {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(frontRightLen, fenceH, fenceT), matFence);
    fr.position.set(cMaxX - frontRightLen / 2, fenceH / 2, cMinZ);
    pushUnit(groups.site, fr, 'fixtures');
  }
  // back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(cMaxX - cMinX, fenceH, fenceT), matFence);
  back.position.set((cMinX + cMaxX) / 2, fenceH / 2, cMaxZ);
  pushUnit(groups.site, back, 'fixtures');
  // left wall
  const left = new THREE.Mesh(new THREE.BoxGeometry(fenceT, fenceH, cMaxZ - cMinZ), matFence);
  left.position.set(cMinX, fenceH / 2, (cMinZ + cMaxZ) / 2);
  pushUnit(groups.site, left, 'fixtures');
  // right wall
  const right = new THREE.Mesh(new THREE.BoxGeometry(fenceT, fenceH, cMaxZ - cMinZ), matFence);
  right.position.set(cMaxX, fenceH / 2, (cMinZ + cMaxZ) / 2);
  pushUnit(groups.site, right, 'fixtures');

  // fence posts along perimeter
  const postSpacing = 5;
  for (let x = cMinX; x <= cMaxX + 0.01; x += postSpacing) {
    for (const z of [cMinZ, cMaxZ]) {
      if (Math.abs(x - spec.door.x) < driveW / 2 + 2 && z === cMinZ) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, fenceH + 0.35, 0.3), matPillar);
      post.position.set(x, (fenceH + 0.35) / 2, z);
      pushUnit(groups.site, post, 'fixtures');
    }
  }
  for (let z = cMinZ + postSpacing; z < cMaxZ; z += postSpacing) {
    for (const x of [cMinX, cMaxX]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, fenceH + 0.35, 0.3), matPillar);
      post.position.set(x, (fenceH + 0.35) / 2, z);
      pushUnit(groups.site, post, 'fixtures');
    }
  }

  // ---- CARS PARKED INSIDE THE GARAGE ----
  function mkCar(color) {
    const g = new THREE.Group();
    const bodyMat = toonMat(color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3.6), bodyMat);
    body.position.y = 0.42; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 1.7), bodyMat);
    cabin.position.set(0, 0.8, -0.1); g.add(cabin);
    const wheelMat = toonMat(0x24242a);
    [[-0.75, 1.15], [0.75, 1.15], [-0.75, -1.15], [0.75, -1.15]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.28, wz);
      g.add(wheel);
    });
    return g;
  }
  const carColors = lux >= 4 ? [0x2c3a52, 0x7a3038] : [0xb7bec7, 0x5a6068];
  if (spec.garage) {
    const g = spec.garage;
    carColors.forEach((color, i) => {
      const car = mkCar(color);
      // side-by-side inside garage, nose toward garage door (front / -Z)
      const cx = g.x + (i === 0 ? -1.4 : 1.4);
      const cz = g.z + 0.2;
      car.position.set(cx, 0.02, cz);
      car.rotation.y = 0; // facing garage door
      pushUnit(groups.site, car, 'fixtures', { drop: false, matKey: 'car', label: 'Car in garage' });
    });
  } else {
    // no garage — park near front door
    carColors.forEach((color, i) => {
      const car = mkCar(color);
      car.position.set(spec.door.x + (i === 0 ? -4 : 4), 0.02, -spec.D / 2 - 5);
      car.rotation.y = Math.PI / 2 * (i === 0 ? 1 : -1);
      pushUnit(groups.site, car, 'fixtures', { drop: false, matKey: 'car', label: 'Parked vehicle' });
    });
  }

  // ---- LARGE POOL AT THE BACK OF THE HOUSE (inside fence) ----
  {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(poolW + 3, 0.12, poolD + 3), toonMat(0xc8c2b4));
    deck.position.set(poolX, 0.06, poolZ);
    pushUnit(groups.site, deck, 'site', { matKey: 'paving', label: 'Pool deck' });
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(poolW, 0.6, poolD),
      toonMat(0x1a8fc8, { transparent: true, opacity: 0.9 })
    );
    water.position.set(poolX, -0.1, poolZ);
    pushUnit(groups.site, water, 'site', { matKey: 'pool', label: 'Swimming pool' });
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(poolW * 0.98, 0.04, poolD * 0.98),
      toonMat(0x4ec4f0, { transparent: true, opacity: 0.6 })
    );
    surface.position.set(poolX, 0.16, poolZ);
    pushUnit(groups.site, surface, 'site', { matKey: 'pool', label: 'Pool surface' });
    const rimMat = toonMat(0xf0ece4);
    [
      [poolW + 0.5, 0.14, 0.3, 0, -poolD / 2 - 0.08],
      [poolW + 0.5, 0.14, 0.3, 0,  poolD / 2 + 0.08],
      [0.3, 0.14, poolD + 0.5, -poolW / 2 - 0.08, 0],
      [0.3, 0.14, poolD + 0.5,  poolW / 2 + 0.08, 0],
    ].forEach(([ww, hh, dd, ox, oz]) => {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), rimMat);
      rim.position.set(poolX + ox, 0.15, poolZ + oz);
      pushUnit(groups.site, rim, 'site', { matKey: 'paving', label: 'Pool coping' });
    });
    // pool ladders
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.1), toonMat(0xb0b8c0));
    ladder.position.set(poolX - poolW / 2 + 0.6, 0.5, poolZ + poolD / 2 - 0.4);
    pushUnit(groups.site, ladder, 'site', { matKey: 'other', label: 'Pool ladder' });
  }

  // small playground to the side of the back pool
  {
    const playX = -poolW / 2 - 5;
    const playZ = poolZ;
    const padMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 5), toonMat(0x2a7a3a));
    padMesh.position.set(playX, 0.05, playZ);
    pushUnit(groups.site, padMesh, 'site', { matKey: 'paving', label: 'Playground' });
    const frameMat = toonMat(0x333a44);
    for (const sx of [-1.2, 1.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), frameMat);
      leg.position.set(playX + sx, 1.2, playZ);
      pushUnit(groups.site, leg, 'site', { matKey: 'playground', label: 'Swing frame' });
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.12), frameMat);
    topBar.position.set(playX, 2.35, playZ);
    pushUnit(groups.site, topBar, 'site', { matKey: 'playground', label: 'Swing bar' });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 2.2), toonMat(0xe85a3a));
    slide.position.set(playX + 2.2, 1.0, playZ);
    slide.rotation.x = -0.45;
    pushUnit(groups.site, slide, 'site', { matKey: 'playground', label: 'Slide' });
  }

  // interior partitions + furniture
  const furnitureFactory = createFurnitureFactory(spec, lux);
  const roomsByFloor = [];
  spec.roomPlan.forEach((rects, f) => {
    const floorGroup = new THREE.Group();
    groups.interior.add(floorGroup);
    roomsByFloor.push(floorGroup);
    const wy = f * FLOOR_H;
    rects.forEach((r, i) => {
      if (i < rects.length - 1) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, FLOOR_H - 0.1, spec.D - 0.1), matPartition);
        wall.position.set(r.x1, wy + FLOOR_H / 2, 0);
        wall.castShadow = true; wall.receiveShadow = true;
        addEdges(wall);
        floorGroup.add(wall);
        units.push({ mesh: wall, stageKey: 'interior', drop: false });
      }
      if (r.isBathroom) {
        const closeWall = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0 - 0.08, FLOOR_H - 0.1, 0.12), matPartition);
        closeWall.position.set((r.x0 + r.x1) / 2, wy + FLOOR_H / 2, r.z0);
        closeWall.castShadow = true; closeWall.receiveShadow = true;
        addEdges(closeWall);
        floorGroup.add(closeWall);
        units.push({ mesh: closeWall, stageKey: 'interior', drop: false });
      }
      const label = makeLabelSprite(r.label, r.isBathroom);
      label.position.set((r.x0 + r.x1) / 2, wy + FLOOR_H * 0.78, (r.z0 + r.z1) / 2);
      floorGroup.add(label);
      units.push({ mesh: label, stageKey: 'interior', drop: false });

      const furniture = furnitureFactory.furnishRoom(r, wy);
      if (furniture) {
        groups.furniture.add(furniture);
        units.push({ mesh: furniture, stageKey: 'furniture', drop: false });
      }
    });
  });

  // security cameras on gate pillars
  const camMatDark = toonMat(0x1c1f24);
  const camMatLens = new THREE.MeshToonMaterial({
    color: 0x0a0c10, emissive: 0x1a4060, emissiveIntensity: 0.5, gradientMap: toonGradientMap
  });
  const camLed = new THREE.MeshToonMaterial({
    color: 0x4ff3ff, emissive: 0x4ff3ff, emissiveIntensity: 0.9, gradientMap: toonGradientMap
  });
  for (const side of [-1, 1]) {
    const cam = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.22), toonMat(0xb9c2cc));
    arm.position.set(0, 0, 0.08); cam.add(arm);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.2), camMatDark);
    body.position.set(0, 0, 0.25); cam.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), camMatLens);
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, 0.36); cam.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), camLed);
    led.position.set(0.05, 0.04, 0.34); cam.add(led);
    cam.position.set(spec.door.x + side * (driveW / 2 + 1.1), pillarH - 0.3, gateZ + 0.4);
    cam.rotation.y = side > 0 ? -0.4 : 0.4;
    pushUnit(groups.site, cam, 'fixtures', { drop: true });
  }

  // gate pathway bollard lights
  const bollardMat = toonMat(0x3a4048);
  const bollardGlow = new THREE.MeshToonMaterial({
    color: 0xffe8c0, emissive: 0xffcc66, emissiveIntensity: 0.7, gradientMap: toonGradientMap
  });
  for (let i = 0; i < Math.min(6, Math.floor(driveLen / 8)); i++) {
    const bz = -spec.D / 2 - 5 - i * 8;
    for (const side of [-1, 1]) {
      const bollard = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 8), bollardMat);
      post.position.y = 0.45; bollard.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bollardGlow);
      cap.position.y = 0.95; bollard.add(cap);
      bollard.position.set(spec.door.x + side * (driveW / 2 + 1.0), 0, bz);
      pushUnit(groups.site, bollard, 'fixtures', { drop: true });
    }
  }

  // ---- INTERIOR AMBIENT POINT LIGHTS (warm room glow) ----
  if (scene3d.lights && scene3d.lights.interior) {
    scene3d.lights.interior.forEach(l => {
      scene3d.scene.remove(l);
      if (l.dispose) l.dispose();
    });
    scene3d.lights.interior = [];
  }
  const interiorLights = [];
  for (let f = 0; f < spec.floors; f++) {
    const ly = f * FLOOR_H + FLOOR_H * 0.85;
    // central warm fill per floor
    const pl = new THREE.PointLight(0xffe0b8, 0.55, Math.max(spec.W, spec.D) * 1.4, 2);
    pl.position.set(0, ly, 0);
    scene3d.scene.add(pl);
    interiorLights.push(pl);
    // secondary cooler accent near back of parlour
    if (f === 0) {
      const pl2 = new THREE.PointLight(0xb0d0ff, 0.28, Math.max(spec.W, spec.D) * 0.9, 2);
      pl2.position.set(-spec.W * 0.25, ly, -spec.D * 0.3);
      scene3d.scene.add(pl2);
      interiorLights.push(pl2);
      // warm bar / lounge glow
      const pl3 = new THREE.PointLight(0xffaa55, 0.35, 8, 2);
      pl3.position.set(0, ly * 0.7, spec.D * 0.25);
      scene3d.scene.add(pl3);
      interiorLights.push(pl3);
    }
  }
  // soft exterior porch light above door
  const porch = new THREE.PointLight(0xfff0d0, 0.5, 12, 2);
  porch.position.set(spec.door.x, FLOOR_H * 0.9, -spec.D / 2 - 0.8);
  scene3d.scene.add(porch);
  interiorLights.push(porch);
  // gate area light
  const gateLight = new THREE.PointLight(0xe8f0ff, 0.4, 14, 2);
  gateLight.position.set(spec.door.x, 3.5, gateZ);
  scene3d.scene.add(gateLight);
  interiorLights.push(gateLight);

  if (scene3d.lights) scene3d.lights.interior = interiorLights;

  Object.values(groups).forEach(g => { scene3d.scene.add(g); g.visible = true; });
  units.forEach(u => { u.mesh.scale.set(0.02, 0.02, 0.02); });

  scene3d.groups = groups;
  scene3d.spec = spec;
  scene3d.matCounts = matCounts;
  scene3d.matInfo = MAT_INFO;
  return { groups, units, roomsByFloor };
}

function boundsExtent(spec) {
  const b = spec.bounds;
  return Math.max(Math.abs(b.minX), Math.abs(b.maxX), Math.abs(b.minZ), Math.abs(b.maxZ)) * 2;
}

function frameCamera(spec) {
  const span = Math.max(boundsExtent(spec), spec.wallH + spec.roofH + 4);
  const dist = span * 0.7 + 12;
  scene3d.camera.position.set(dist * 0.5, dist * 0.42, -dist * 0.85);
  scene3d.controls.target.set(0, spec.wallH * 0.25, -spec.driveLen * 0.25);
  scene3d.controls.update();
}

function setInspectCamera(spec) {
  const span = Math.max(spec.W, spec.D, spec.wallH);
  const dist = span * 1.15 + 3;
  scene3d.camera.position.set(dist * 0.6, dist * 1.0, -dist * 0.55);
  scene3d.controls.target.set(0, spec.wallH * 0.4, 0);
  scene3d.controls.update();
}

/* ============================================================
   CONSTRUCTION TIMELINE
   ============================================================ */

const STAGE_LABELS = {
  foundation: 'Foundation', frame: 'Structural frame', walls: 'Wall assembly',
  fixtures: 'Doors & windows', roof: 'Roofing', interior: 'Interior partitions',
  furniture: 'Furnishing', site: 'Site & gate',
};
const LAYER_ORDER = ['foundation', 'frame', 'walls', 'fixtures', 'roof', 'interior', 'furniture', 'site'];
const LAYER_CUTOFF = { foundation: 0, structure: 1, walls: 2, roof: 4, interior: 6, full: 7 };

const sim = {
  spec: null, groups: null, units: [], unitIndex: 0, roomsByFloor: null,
  playing: true, speed: 1, timer: null,
  totalCost: 0, layerFilter: 'full', inspectMode: false, viewFloor: 0, prevLayerFilter: 'full',
  tourStops: [], tourIdx: 0, tourTimer: null, currency: { symbol: '$' },
};

function launchSimulator(opt) {
  const spec = buildHouseSpec(opt);
  initRenderer();
  const built = buildHouse(spec);
  frameCamera(spec);
  populateFloorSelect(spec);

  sim.spec = spec; sim.groups = built.groups; sim.units = built.units; sim.roomsByFloor = built.roomsByFloor;
  sim.unitIndex = 0; sim.playing = true; sim.speed = 1;
  sim.totalCost = opt.cost;
  sim.currency = opt.currency || state.currency;
  sim.layerFilter = $('#layerSelect').value || 'full';
  sim.inspectMode = false; sim.viewFloor = 0;
  clearInterval(sim.tourTimer); sim.tourTimer = null;
  $('#btnInspectToggle').classList.remove('active');

  applyLayerVisibility();
  updateRoomFloorVisibility();
  updateInspectCutaway();

  const cur = sim.currency;
  $('#hudProjectName').textContent = `${opt.fd.style[0].toUpperCase() + opt.fd.style.slice(1)} ${labelForPurpose(opt.fd.purpose)}`;
  $('#hudBlocks').textContent = `0 / ${sim.units.length}`;
  $('#hudProgress').textContent = '0%';
  $('#hudCost').textContent = cur.symbol + '0';
  $('#hudPhase').textContent = 'Foundation';
  $$('.speed-buttons button').forEach(b => b.classList.toggle('active', b.dataset.speed === '1'));
  $('#btnPlayPause').textContent = '⏸';

  showScreen('screen-sim');
  runConstruction();
}

function populateFloorSelect(spec) {
  const sel = $('#floorPlanSelect');
  sel.innerHTML = '';
  for (let f = 0; f < spec.floors; f++) {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f === 0 ? 'Ground floor' : `Floor ${f + 1}`;
    sel.appendChild(o);
  }
}

function updateRoomFloorVisibility() {
  if (!sim.roomsByFloor) return;
  sim.roomsByFloor.forEach((g, idx) => {
    g.children.forEach(child => { if (child.isSprite) child.visible = (idx === sim.viewFloor); });
  });
}

function applyLayerVisibility() {
  if (!sim.groups) return;
  const allowed = new Set(LAYER_ORDER.slice(0, (LAYER_CUTOFF[sim.layerFilter] ?? 7) + 1));
  Object.entries(sim.groups).forEach(([key, g]) => { g.visible = allowed.has(key); });
}

function updateInspectCutaway() {
  if (!sim.groups || !sim.groups.walls) return;
  if (!sim.inspectMode) {
    sim.groups.walls.children.forEach(m => { if (m.userData.side) m.visible = true; });
    return;
  }
  const cam = scene3d.camera.position;
  const dist = Math.hypot(cam.x, cam.z) || 1;
  const nx = cam.x / dist, nz = cam.z / dist;
  const hide = { right: nx > 0.25, left: nx < -0.25, back: nz > 0.25, front: nz < -0.25 };
  sim.groups.walls.children.forEach(m => {
    if (!m.userData.side) return;
    m.visible = !hide[m.userData.side];
  });
}

function revealUnit(u) {
  const duration = 260;
  const start = performance.now();
  const mesh = u.mesh;
  if (u.drop) {
    const dropFrom = 9;
    const baseY = mesh.position.y;
    mesh.scale.set(1, 1, 1);
    mesh.position.y = baseY + dropFrom;
    (function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      mesh.position.y = baseY + dropFrom * (1 - e);
      if (t < 1) requestAnimationFrame(tick); else mesh.position.y = baseY;
    })(start);
  } else {
    (function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const s = Math.max(0.02, e);
      mesh.scale.set(s, s, s);
      if (t < 1) requestAnimationFrame(tick); else mesh.scale.set(1, 1, 1);
    })(start);
  }
}

function runConstruction() {
  clearInterval(sim.timer);
  const perUnitMs = 28;
  sim.timer = setInterval(() => {
    if (!sim.playing) return;
    advanceConstruction();
  }, perUnitMs / sim.speed);
}

function advanceConstruction() {
  if (sim.unitIndex >= sim.units.length) {
    clearInterval(sim.timer);
    $('#hudPhase').textContent = 'Complete';
    return;
  }
  const u = sim.units[sim.unitIndex];
  revealUnit(u);
  sim.unitIndex++;

  const progress = sim.unitIndex / sim.units.length;
  const cur = sim.currency;
  $('#hudProgress').textContent = Math.round(progress * 100) + '%';
  $('#hudBlocks').textContent = `${sim.unitIndex} / ${sim.units.length}`;
  $('#hudCost').textContent = formatMoney(sim.totalCost * progress, cur);
  $('#hudPhase').textContent = STAGE_LABELS[u.stageKey] || u.stageKey;
}

$('#layerSelect').addEventListener('change', () => {
  sim.layerFilter = $('#layerSelect').value;
  if (!sim.inspectMode) applyLayerVisibility();
});

$$('.speed-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.speed-buttons button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sim.speed = +btn.dataset.speed;
    runConstruction();
  });
});

$('#btnPlayPause').addEventListener('click', () => {
  sim.playing = !sim.playing;
  $('#btnPlayPause').textContent = sim.playing ? '⏸' : '▶';
});

$('#btnRestart').addEventListener('click', () => {
  clearInterval(sim.timer);
  sim.unitIndex = 0; sim.playing = true;
  sim.units.forEach(u => u.mesh.scale.set(0.02, 0.02, 0.02));
  $('#btnPlayPause').textContent = '⏸';
  $('#hudProgress').textContent = '0%';
  $('#hudBlocks').textContent = `0 / ${sim.units.length}`;
  $('#hudCost').textContent = (sim.currency?.symbol || '$') + '0';
  runConstruction();
});

$('#btnExitSim').addEventListener('click', () => {
  clearInterval(sim.timer);
  stopTour();
  showScreen('screen-options');
});

function buildTourStops(spec) {
  const stops = [];
  spec.roomPlan.forEach(rects => rects.forEach(r => {
    stops.push({ x: (r.x0 + r.x1) / 2, y: r.floor * FLOOR_H + FLOOR_H * 0.5, z: 0, label: r.label });
  }));
  return stops;
}

function tweenControlsTarget(target, duration) {
  const c = scene3d.controls;
  if (!c) return;
  const start = performance.now();
  const from = { x: c.target.x, y: c.target.y, z: c.target.z };
  (function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    c.target.set(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e, from.z + (target.z - from.z) * e);
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function goToTourStop(i) {
  const s = sim.tourStops[i];
  if (!s) return;
  tweenControlsTarget(s, 1100);
  $('#hudPhase').textContent = 'Inspecting: ' + s.label;
}

function startTour() {
  sim.tourStops = buildTourStops(sim.spec);
  sim.tourIdx = 0;
  clearInterval(sim.tourTimer);
  if (!sim.tourStops.length) return;
  goToTourStop(0);
  sim.tourTimer = setInterval(() => {
    sim.tourIdx = (sim.tourIdx + 1) % sim.tourStops.length;
    goToTourStop(sim.tourIdx);
  }, 2600);
}

function stopTour() {
  clearInterval(sim.tourTimer);
  sim.tourTimer = null;
}

$('#btnInspectToggle').addEventListener('click', () => {
  sim.inspectMode = !sim.inspectMode;
  $('#btnInspectToggle').classList.toggle('active', sim.inspectMode);
  if (sim.inspectMode) {
    sim.prevLayerFilter = sim.layerFilter;
    const allowed = new Set(['foundation', 'frame', 'walls', 'interior', 'furniture']);
    Object.entries(sim.groups).forEach(([key, g]) => { g.visible = allowed.has(key); });
    setInspectCamera(sim.spec);
    startTour();
  } else {
    stopTour();
    sim.layerFilter = sim.prevLayerFilter;
    applyLayerVisibility();
    frameCamera(sim.spec);
  }
  updateInspectCutaway();
});

$('#floorPlanSelect').addEventListener('change', e => {
  sim.viewFloor = +e.target.value;
  updateRoomFloorVisibility();
});

$('#btnZoomIn').addEventListener('click', () => {
  if (!scene3d.controls) return;
  const c = scene3d.controls, cam = scene3d.camera;
  const dir = new THREE.Vector3().subVectors(cam.position, c.target).multiplyScalar(0.82);
  cam.position.copy(c.target).add(dir);
});
$('#btnZoomOut').addEventListener('click', () => {
  if (!scene3d.controls) return;
  const c = scene3d.controls, cam = scene3d.camera;
  const dir = new THREE.Vector3().subVectors(cam.position, c.target).multiplyScalar(1.22);
  cam.position.copy(c.target).add(dir);
});
$('#btnResetCam').addEventListener('click', () => {
  if (sim.spec) frameCamera(sim.spec);
});
$('#btnAutoRotate').addEventListener('click', () => {
  if (!scene3d.controls) return;
  scene3d.controls.autoRotate = !scene3d.controls.autoRotate;
  scene3d.controls.autoRotateSpeed = 1.6;
  $('#btnAutoRotate').classList.toggle('active', scene3d.controls.autoRotate);
});

/* ============================================================
   SYSTEMS — CCTV feeds · Energy dashboard · Home automation
   ============================================================ */

const PROTOCOLS = [
  { id: 'matter', name: 'Matter (CSA)', desc: 'IP-based, multi-admin, Thread/Wi-Fi/Ethernet', minLux: 3 },
  { id: 'thread', name: 'Thread', desc: 'Low-power mesh IPv6 for sensors & locks', minLux: 3 },
  { id: 'zigbee', name: 'Zigbee 3.0', desc: '2.4 GHz mesh — lights, plugs, sensors', minLux: 2 },
  { id: 'zwave', name: 'Z-Wave LR', desc: 'Sub-GHz mesh, strong wall penetration', minLux: 2 },
  { id: 'wifi', name: 'Wi-Fi 6', desc: 'High-bandwidth cameras & hubs', minLux: 1 },
  { id: 'mqtt', name: 'MQTT / Local', desc: 'Broker for local automation rules', minLux: 4 },
];

const AUTO_DEVICES = [
  { id: 'cams', label: 'Security cams', minLux: 1 },
  { id: 'locks', label: 'Smart locks', minLux: 2 },
  { id: 'lights', label: 'Smart lighting', minLux: 2 },
  { id: 'hvac', label: 'HVAC / thermostat', minLux: 2 },
  { id: 'speakers', label: 'Voice / speakers', minLux: 3 },
  { id: 'panels', label: 'Wall hubs', minLux: 3 },
  { id: 'solar', label: 'Solar inverter', minLux: 3 },
  { id: 'ev', label: 'EV charger', minLux: 4 },
];

const systems = {
  cctvOpen: false, energyOpen: false, autoOpen: false,
  camTimer: null, energyTimer: null, activeCam: 'gate-l', camViews: null,
};

function closeAllSysPanels() {
  ['cctvPanel', 'energyPanel', 'autoPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['btnCctv', 'btnEnergy', 'btnAuto'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  systems.cctvOpen = systems.energyOpen = systems.autoOpen = false;
  if (systems.camTimer) { clearInterval(systems.camTimer); systems.camTimer = null; }
  if (systems.energyTimer) { clearInterval(systems.energyTimer); systems.energyTimer = null; }
}

function getCamViewpoints(spec) {
  if (!spec) return [];
  const gateZ = -spec.D / 2 - spec.driveLen;
  const dx = spec.door.x;
  return [
    { id: 'gate-l', pos: [dx - 3.2, 3.0, gateZ + 1.2], target: [dx, 1.2, -spec.D / 2 - 8] },
    { id: 'gate-r', pos: [dx + 3.2, 3.0, gateZ + 1.2], target: [dx, 1.2, -spec.D / 2 - 8] },
    { id: 'drive', pos: [dx, 4.5, gateZ + spec.driveLen * 0.45], target: [dx, 1.5, -spec.D / 2] },
    { id: 'porch', pos: [dx, 2.8, -spec.D / 2 - 6], target: [dx, 1.4, -spec.D / 2 + 2] },
  ];
}

// Dedicated CCTV camera — NEVER touches the main renderer size (that caused the whiteout blur)
let _cctvCam = null;
function getCctvCam() {
  if (!_cctvCam) {
    _cctvCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
  }
  return _cctvCam;
}

function renderCamFeed(canvas, view) {
  if (!scene3d.renderer || !scene3d.scene || !view) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width || 320;
  const h = canvas.height || 180;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const cam = getCctvCam();
  cam.aspect = w / h;
  cam.position.set(view.pos[0], view.pos[1], view.pos[2]);
  cam.lookAt(view.target[0], view.target[1], view.target[2]);
  cam.updateProjectionMatrix();

  // Render into the main canvas temporarily via scissor OR use read-back from current frame
  // Safest approach: clone pixels from a one-shot render without changing display size
  const renderer = scene3d.renderer;
  const prevAutoClear = renderer.autoClear;
  const prevClear = renderer.getClearColor().getHex();
  const prevAlpha = renderer.getClearAlpha();
  const prevViewport = new THREE.Vector4();
  renderer.getViewport(prevViewport);

  // Render off the visible area using setViewport on a small region of the same buffer
  // Better: use an offscreen WebGLRenderTarget
  if (!systems._cctvRT || systems._cctvRT.width !== w || systems._cctvRT.height !== h) {
    if (systems._cctvRT) systems._cctvRT.dispose();
    systems._cctvRT = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
  }
  const rt = systems._cctvRT;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x0a1020, 1);
  renderer.clear();
  renderer.render(scene3d.scene, cam);
  renderer.setRenderTarget(null);

  // Read pixels from the render target
  const buffer = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buffer);

  // WebGL is bottom-up — flip when drawing
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = y * w * 4;
    for (let x = 0; x < w * 4; x++) img.data[dstRow + x] = buffer[srcRow + x];
  }
  ctx.putImageData(img, 0, 0);

  // CCTV overlay
  ctx.fillStyle = 'rgba(0,20,40,0.15)';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(200,220,255,0.9)';
  ctx.fillText(new Date().toISOString().replace('T', ' ').slice(0, 19), 8, 14);
  ctx.fillStyle = 'rgba(255,60,80,0.9)';
  ctx.fillText('● REC', w - 48, 14);

  renderer.autoClear = prevAutoClear;
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.setViewport(prevViewport);
}

function updateCctvFeeds() {
  if (!systems.cctvOpen || !sim.spec) return;
  const views = getCamViewpoints(sim.spec);
  systems.camViews = views;
  views.forEach((v, i) => {
    const canvas = document.getElementById('camCanvas' + i);
    if (canvas) renderCamFeed(canvas, v);
  });
  document.querySelectorAll('.cctv-time').forEach(el => {
    el.textContent = new Date().toLocaleTimeString();
  });
}

function jumpToCam(camId) {
  if (!sim.spec || !scene3d.controls) return;
  const views = getCamViewpoints(sim.spec);
  const v = views.find(x => x.id === camId) || views[0];
  if (!v) return;
  systems.activeCam = camId;
  document.querySelectorAll('.cctv-feed').forEach(f => f.classList.toggle('active', f.dataset.cam === camId));
  const cam = scene3d.camera;
  const c = scene3d.controls;
  const start = performance.now();
  const fromP = cam.position.clone();
  const fromT = c.target.clone();
  const toP = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
  const toT = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
  (function tick(now) {
    const t = Math.min(1, (now - start) / 900);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    cam.position.lerpVectors(fromP, toP, e);
    c.target.lerpVectors(fromT, toT, e);
    c.update();
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function openCctv() {
  const opening = !systems.cctvOpen;
  closeAllSysPanels();
  if (!opening) return;
  systems.cctvOpen = true;
  document.getElementById('cctvPanel').hidden = false;
  document.getElementById('btnCctv').classList.add('active');
  updateCctvFeeds();
  systems.camTimer = setInterval(updateCctvFeeds, 1200);
}

function computeEnergyModel() {
  const fd = sim.spec ? sim.spec.fd : state.formData;
  const lux = fd ? clamp(fd.luxury || 3, 1, 5) : 3;
  const sustain = fd ? clamp(fd.sustain || 3, 1, 5) : 3;
  const floors = fd ? (fd.floors || 2) : 2;
  const area = fd ? (fd.width || 20) * (fd.depth || 30) * floors * 0.82 : 500;
  const baseKwhDay = (area * (0.28 + lux * 0.06)) / 30;
  const hvac = baseKwhDay * (0.35 - sustain * 0.03);
  const lighting = baseKwhDay * 0.12;
  const appliances = baseKwhDay * (0.22 + lux * 0.02);
  const pool = (fd && fd.outdoor && fd.outdoor.includes('pool')) ? baseKwhDay * 0.08 : 0;
  const other = baseKwhDay * 0.15;
  const total = hvac + lighting + appliances + pool + other;
  const solarCapKw = sustain >= 4 ? area * 0.012 : sustain >= 3 ? area * 0.006 : 0;
  const solarDay = solarCapKw * (3.8 + sustain * 0.4);
  const net = total - solarDay;
  const cur = sim.currency || state.currency || { symbol: '$', rate: 1, mult: 1 };
  const tariffUsd = 0.14 * (cur.mult || 1);
  const monthCostLocal = Math.max(0, net) * 30 * tariffUsd * (cur.rate || 1);
  const liveKw = total / 24 * (0.7 + Math.random() * 0.6);
  return {
    liveKw, total, solarDay, net, monthCostLocal, cur,
    loads: [
      { name: 'HVAC', kwh: hvac, pct: hvac / total },
      { name: 'Lighting', kwh: lighting, pct: lighting / total },
      { name: 'Appliances', kwh: appliances, pct: appliances / total },
      { name: 'Pool / site', kwh: pool, pct: pool / total || 0 },
      { name: 'Other', kwh: other, pct: other / total },
    ],
  };
}

function refreshEnergyPanel() {
  if (!systems.energyOpen) return;
  const m = computeEnergyModel();
  document.getElementById('enLive').textContent = m.liveKw.toFixed(2) + ' kW';
  document.getElementById('enLiveBar').style.width = Math.min(100, (m.liveKw / 12) * 100) + '%';
  document.getElementById('enToday').textContent = m.total.toFixed(1) + ' kWh';
  document.getElementById('enSolar').textContent = m.solarDay > 0.1 ? m.solarDay.toFixed(1) + ' kWh' : '—';
  document.getElementById('enNet').textContent = (m.net >= 0 ? '+' : '') + m.net.toFixed(1) + ' kWh';
  document.getElementById('enCost').textContent = formatMoney(m.monthCostLocal, m.cur) + ' / mo';
  const loadsEl = document.getElementById('enLoads');
  loadsEl.innerHTML = m.loads.filter(l => l.kwh > 0.01).map(l =>
    '<div class="load-row"><span>' + l.name + '</span><div class="lb"><i style="width:' + Math.round(l.pct * 100) + '%"></i></div><span class="lv">' + Math.round(l.pct * 100) + '%</span></div>'
  ).join('');
  const chart = document.getElementById('energyChart');
  if (chart && !chart.dataset.ready) {
    chart.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const hourFactor = 0.45 + 0.55 * Math.pow(Math.sin((i - 6) / 24 * Math.PI * 2), 2);
      const h = Math.max(8, Math.round(hourFactor * 56));
      const s = document.createElement('span');
      s.style.height = h + 'px';
      chart.appendChild(s);
    }
    chart.dataset.ready = '1';
  } else if (chart) {
    chart.querySelectorAll('span').forEach((s, i) => {
      const jitter = 0.9 + Math.random() * 0.2;
      const hourFactor = 0.45 + 0.55 * Math.pow(Math.sin((i - 6) / 24 * Math.PI * 2), 2);
      s.style.height = Math.max(8, Math.round(hourFactor * 56 * jitter)) + 'px';
    });
  }
}

function openEnergy() {
  const opening = !systems.energyOpen;
  closeAllSysPanels();
  if (!opening) return;
  systems.energyOpen = true;
  document.getElementById('energyPanel').hidden = false;
  document.getElementById('btnEnergy').classList.add('active');
  const chart = document.getElementById('energyChart');
  if (chart) chart.dataset.ready = '';
  refreshEnergyPanel();
  systems.energyTimer = setInterval(refreshEnergyPanel, 2000);
}

function openAuto() {
  const opening = !systems.autoOpen;
  closeAllSysPanels();
  if (!opening) return;
  systems.autoOpen = true;
  document.getElementById('autoPanel').hidden = false;
  document.getElementById('btnAuto').classList.add('active');

  const lux = sim.spec ? sim.spec.lux : (state.formData ? state.formData.luxury : 3);
  const list = document.getElementById('protoList');
  list.innerHTML = PROTOCOLS.map(p => {
    const on = lux >= p.minLux;
    return '<div class="proto-card"><span class="proto-badge ' + (on ? '' : 'off') + '">' + p.id.toUpperCase() +
      '</span><div class="proto-info"><span class="proto-name">' + p.name + '</span><span class="proto-desc">' + p.desc +
      '</span></div><span class="proto-status ' + (on ? '' : 'down') + '">' + (on ? 'ONLINE' : 'N/A') + '</span></div>';
  }).join('');

  const devs = document.getElementById('autoDevices');
  devs.innerHTML = AUTO_DEVICES.map(d => {
    const on = lux >= d.minLux;
    return '<div class="dev-chip"><span class="dot ' + (on ? '' : 'off') + '"></span>' + d.label + '</div>';
  }).join('');
}

function applyScene(sceneId) {
  document.querySelectorAll('.scene-btn').forEach(b => b.classList.toggle('active', b.dataset.scene === sceneId));
  if (!scene3d.lights || !scene3d.lights.interior) return;
  const intens = { away: 0.15, home: 0.55, night: 0.25, cinema: 0.2, party: 0.85 }[sceneId] || 0.5;
  scene3d.lights.interior.forEach((l, i) => {
    if (l.isPointLight) l.intensity = i === 0 ? intens : intens * 0.6;
  });
  if (scene3d.lights.sun) {
    scene3d.lights.sun.intensity = sceneId === 'cinema' ? 0.55 : 0.95;
  }
  const phase = document.getElementById('hudPhase');
  if (phase) phase.textContent = 'Scene: ' + sceneId.charAt(0).toUpperCase() + sceneId.slice(1);
}

document.getElementById('btnCctv') && document.getElementById('btnCctv').addEventListener('click', openCctv);
document.getElementById('btnEnergy') && document.getElementById('btnEnergy').addEventListener('click', openEnergy);
document.getElementById('btnAuto') && document.getElementById('btnAuto').addEventListener('click', openAuto);
document.getElementById('btnCloseCctv') && document.getElementById('btnCloseCctv').addEventListener('click', closeAllSysPanels);
document.getElementById('btnCloseEnergy') && document.getElementById('btnCloseEnergy').addEventListener('click', closeAllSysPanels);
document.getElementById('btnCloseAuto') && document.getElementById('btnCloseAuto').addEventListener('click', closeAllSysPanels);

document.querySelectorAll('#cctvGrid .cctv-feed').forEach(feed => {
  feed.addEventListener('click', () => jumpToCam(feed.dataset.cam));
});
document.querySelectorAll('.scene-btn').forEach(btn => {
  btn.addEventListener('click', () => applyScene(btn.dataset.scene));
});

const _exitBtn = document.getElementById('btnExitSim');
if (_exitBtn) _exitBtn.addEventListener('click', () => closeAllSysPanels());


/* ============================================================
   MATERIAL CLICK-INSPECT
   ============================================================ */
const matRay = new THREE.Raycaster();
const matMouse = new THREE.Vector2();
let matHighlight = null;

function clearMatHighlight() {
  if (matHighlight && matHighlight.material) {
    if (matHighlight.userData._prevEmissive != null && matHighlight.material.emissive) {
      matHighlight.material.emissive.setHex(matHighlight.userData._prevEmissive);
    }
  }
  matHighlight = null;
}

function showMatPanel(info) {
  const panel = document.getElementById('matPanel');
  if (!panel || !info) return;
  // close other sys panels but keep mat open
  ['cctvPanel', 'energyPanel', 'autoPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['btnCctv', 'btnEnergy', 'btnAuto'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  systems.cctvOpen = systems.energyOpen = systems.autoOpen = false;

  const cur = sim.currency || state.currency || { symbol: '$', rate: 1 };
  const rate = cur.rate || 1;
  const unitLocal = (info.unitCostUsd || 0) * rate;
  const matKey = info.matKey || info.stageKey;
  const qty = (scene3d.matCounts && scene3d.matCounts[matKey]) || info.index || 1;
  const allLocal = unitLocal * qty;

  document.getElementById('matName').textContent = info.label || info.materialName;
  document.getElementById('matCat').textContent = (info.materialName || '') + (matKey ? ' · ' + matKey : '');
  document.getElementById('matIndex').textContent = '#' + (info.index || '—');
  document.getElementById('matQty').textContent = qty + ' ' + (info.unit || 'pcs') + ' used';
  document.getElementById('matUnit').textContent = info.unit || 'pcs';
  document.getElementById('matUnitCost').textContent = formatMoney(unitLocal, cur) + ' each';
  document.getElementById('matLine').textContent = formatMoney(unitLocal, cur) + ' (this one)';
  document.getElementById('matStageTotal').textContent = formatMoney(allLocal, cur) + ' (' + qty + ' total)';
  panel.hidden = false;
}

function hideMatPanel() {
  const panel = document.getElementById('matPanel');
  if (panel) panel.hidden = true;
  clearMatHighlight();
}

function onStageClick(event) {
  if (!scene3d.renderer || !scene3d.camera || !sim.spec) return;
  // ignore UI clicks
  if (event.target.closest && event.target.closest('.sys-panel, .sim-hud-top, .sim-hud-bottom, button, select')) return;

  const canvas = scene3d.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  matMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  matMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  matRay.setFromCamera(matMouse, scene3d.camera);
  const roots = [];
  if (scene3d.groups) {
    Object.values(scene3d.groups).forEach(g => { if (g && g.visible) roots.push(g); });
  }
  const hits = matRay.intersectObjects(roots, true);
  clearMatHighlight();
  if (!hits.length) {
    hideMatPanel();
    return;
  }
  // find first hit with matInfo
  let target = null;
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.matInfo && o.parent) o = o.parent;
    if (o && o.userData.matInfo) { target = o; break; }
  }
  if (!target) {
    hideMatPanel();
    return;
  }
  // highlight
  const mesh = target.isMesh ? target : target.children.find(c => c.isMesh) || target;
  if (mesh.isMesh && mesh.material && mesh.material.emissive) {
    matHighlight = mesh;
    mesh.userData._prevEmissive = mesh.material.emissive.getHex();
    mesh.material.emissive.setHex(0x1a4a60);
  }
  showMatPanel(target.userData.matInfo);
  const phase = document.getElementById('hudPhase');
  if (phase) phase.textContent = 'Inspect: ' + (target.userData.matInfo.label || target.userData.matInfo.materialName);
}

// bind after DOM ready (script is at end of body)
(function bindMatClick() {
  const stage = document.getElementById('stagePerspective');
  if (stage) {
    stage.addEventListener('click', onStageClick);
  }
  const closeBtn = document.getElementById('btnCloseMat');
  if (closeBtn) closeBtn.addEventListener('click', hideMatPanel);
  const exitBtn = document.getElementById('btnExitSim');
  if (exitBtn) exitBtn.addEventListener('click', hideMatPanel);
})();

goToStep(1);
console.log('BuildMind AI: script loaded — CCTV, energy, automation & material inspect online.');


