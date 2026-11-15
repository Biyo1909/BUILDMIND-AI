/* ============================================================
   BuildMind AI — interior staging: furniture library + room layouts
   Every piece faces +Z (its "front"); layouts rotate as needed.
   ============================================================ */

function createFurnitureFactory(spec) {
  const lux = spec.lux;
  const M = MatLib;
  let PAL = lux <= 2
    ? { fabric: 0x9c968c, fabric2: 0xdcd6cc, accent: 0x7f8f78, wood: 0xc29a6b, rug: 0xbfb6a6, frame: 0x2a2a2a, leather: 0x8a6a4a }
    : lux === 3
      ? { fabric: 0xcdbfa9, fabric2: 0xebe4d8, accent: 0xb4653f, wood: 0xa67a4e, rug: 0x9a8a74, frame: 0x1e1e1e, leather: 0x8b5a36 }
      : { fabric: 0x2f4a3e, fabric2: 0xede5d7, accent: 0xc8a45a, wood: 0x5d3c26, rug: 0x6e5d4b, frame: 0xb8954f, leather: 0x7a3f22 };
  if (spec.style === 'scandinavian') PAL = { ...PAL, wood: 0xd2b48c, fabric: lux >= 4 ? 0x5d6b5f : 0xd9d4cb };
  if (spec.style === 'futuristic') PAL = { ...PAL, fabric: lux >= 4 ? 0x2a2d33 : 0xbfc3c8, accent: 0x6fb7c9 };

  const mat = {
    fabric: M.get('fabric', PAL.fabric, [2, 2]),
    fabric2: M.get('fabric', PAL.fabric2, [2, 2]),
    accent: M.get('fabric', PAL.accent, [2, 2]),
    linen: M.get('fabric', 0xf3efe8, [2, 2]),
    leather: M.plain(PAL.leather, { roughness: 0.45 }),
    wood: M.get('woodPlank', PAL.wood, [0.6, 0.6], { noBump: true, roughness: 0.5 }),
    woodDark: M.get('woodPlank', 0x4a3020, [0.6, 0.6], { noBump: true, roughness: 0.45 }),
    frame: M.plain(PAL.frame, lux >= 4 ? { roughness: 0.3, metalness: 1 } : { roughness: 0.45, metalness: 0.4 }),
    brass: M.plain(0xc8a45a, { roughness: 0.28, metalness: 1 }),
    black: M.plain(0x1c1c1d, { roughness: 0.5 }),
    steel: M.plain(0xc9cdd1, { roughness: 0.25, metalness: 1 }),
    white: M.plain(0xf3f1ec, { roughness: 0.4 }),
    lacquer: M.plain(lux >= 4 ? 0x2b2a29 : 0xf1eee8, { roughness: 0.3 }),
    ceramic: M.plain(0xfbfbfa, { roughness: 0.12 }),
    marble: M.get('marble', 0xf2f0ec, [1, 1]),
    stoneDark: M.get('marble', 0x3a3836, [1, 1]),
    screen: M.plain(0x07080a, { roughness: 0.12, metalness: 0.5 }),
    leaf: M.plain(0x3d6a34, { roughness: 0.75, flatShading: true }),
    leaf2: M.plain(0x5b8a3f, { roughness: 0.75, flatShading: true }),
    potTerracotta: M.plain(0xb9704a, { roughness: 0.9 }),
    potStone: M.plain(0xd7d0c4, { roughness: 0.9 }),
    glass: M.glass(0xd6e6ec, 'clear'),
    mirror: M.plain(0xe7edf0, { roughness: 0.02, metalness: 1 }),
    shade: M.lampGlow(0xffcf8f),
    bulb: M.lampGlow(0xffe2b0),
    rug: M.get('rug', PAL.rug, [1, 1]),
    books: [0x8a3b2b, 0x2f4a5f, 0xc9a96e, 0x5b6c5d, 0xe4ddd0, 0x3a3836].map(c => M.plain(c, { roughness: 0.8 })),
    rack: M.plain(0xd9762b, { roughness: 0.5, metalness: 0.3 }),
    rackBlue: M.plain(0x24518a, { roughness: 0.5, metalness: 0.3 }),
    cardboard: M.plain(0xb88d5c, { roughness: 0.95 }),
    pallet: M.plain(0xc8a878, { roughness: 0.95 }),
  };

  /* ---------- geometry helpers ---------- */
  const rbox = (w, h, d, r, m) => {
    const rr = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 3, rr), m);
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (rt, rb, h, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  const sph = (r, m, seg = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6)), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const G = (...ch) => { const g = new THREE.Group(); ch.forEach(c => g.add(c)); return g; };
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const legs4 = (g, w, d, h, m, inset = 0.06, r = 0.022) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(r, r * 0.8, h, m, 10), sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)));
  };

  /* ---------- pieces ---------- */
  const mk = {
    sofa(len = 2.5, m = mat.fabric) {
      const g = new THREE.Group();
      legs4(g, len - 0.1, 0.85, 0.1, mat.frame, 0.08, 0.02);
      g.add(at(rbox(len, 0.24, 0.95, 0.05, m), 0, 0.22, 0));
      const n = len > 2.1 ? 3 : 2, cw = (len - 0.38) / n;
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + 0.19 + cw * (i + 0.5);
        g.add(at(rbox(cw - 0.02, 0.17, 0.72, 0.07, m), x, 0.42, 0.08));
        const back = at(rbox(cw - 0.03, 0.44, 0.2, 0.09, m), x, 0.68, -0.28);
        back.rotation.x = -0.14; g.add(back);
      }
      g.add(at(rbox(len, 0.5, 0.16, 0.05, m), 0, 0.5, -0.4));
      for (const sx of [-1, 1]) g.add(at(rbox(0.19, 0.56, 0.95, 0.07, m), sx * (len / 2 - 0.095), 0.38, 0));
      for (const sx of [-1, 1]) {
        const p = at(rbox(0.44, 0.42, 0.13, 0.07, sx < 0 ? mat.accent : mat.fabric2), sx * (len / 2 - 0.48), 0.68, -0.13);
        p.rotation.set(-0.25, sx * 0.22, sx * 0.08); g.add(p);
      }
      return g;
    },
    armchair(m = mat.fabric2) {
      const g = new THREE.Group();
      legs4(g, 0.72, 0.72, 0.14, mat.wood, 0.06, 0.018);
      g.add(at(rbox(0.82, 0.22, 0.8, 0.06, m), 0, 0.25, 0));
      g.add(at(rbox(0.56, 0.14, 0.62, 0.06, m), 0, 0.42, 0.06));
      const back = at(rbox(0.82, 0.55, 0.16, 0.07, m), 0, 0.62, -0.32); back.rotation.x = -0.12; g.add(back);
      for (const sx of [-1, 1]) g.add(at(rbox(0.14, 0.42, 0.78, 0.06, m), sx * 0.34, 0.45, 0));
      return g;
    },
    loungeChair() {
      const g = new THREE.Group();
      const seat = at(rbox(0.78, 0.16, 0.85, 0.07, mat.leather), 0, 0.34, 0.05); seat.rotation.x = -0.08; g.add(seat);
      const back = at(rbox(0.78, 0.72, 0.15, 0.07, mat.leather), 0, 0.68, -0.38); back.rotation.x = -0.3; g.add(back);
      for (const sx of [-1, 1]) {
        const rail = at(box(0.04, 0.04, 0.95, mat.frame), sx * 0.38, 0.22, 0);
        g.add(rail);
        g.add(at(cyl(0.015, 0.015, 0.24, mat.frame, 8), sx * 0.38, 0.11, 0.4));
        g.add(at(cyl(0.015, 0.015, 0.24, mat.frame, 8), sx * 0.38, 0.11, -0.4));
      }
      return g;
    },
    coffeeTable() {
      if (lux >= 4) {
        const g = new THREE.Group();
        const top = at(cyl(0.62, 0.62, 0.05, mat.marble, 40), 0, 0.38, 0); top.scale.z = 0.62; g.add(top);
        const base = at(cyl(0.3, 0.34, 0.35, mat.brass, 32), 0, 0.18, 0); base.scale.z = 0.6; g.add(base);
        return g;
      }
      const g = new THREE.Group();
      g.add(at(rbox(1.2, 0.05, 0.62, 0.02, mat.wood), 0, 0.4, 0));
      g.add(at(rbox(1.08, 0.03, 0.5, 0.01, mat.wood), 0, 0.14, 0));
      legs4(g, 1.16, 0.58, 0.38, mat.frame, 0.04, 0.016);
      g.add(at(box(0.3, 0.04, 0.22, mat.books[1]), -0.25, 0.44, 0.05));
      g.add(at(cyl(0.06, 0.05, 0.14, mat.ceramic, 16), 0.3, 0.5, -0.05));
      return g;
    },
    sideTable() {
      return G(at(cyl(0.25, 0.25, 0.03, lux >= 4 ? mat.marble : mat.wood, 28), 0, 0.55, 0),
        at(cyl(0.02, 0.02, 0.53, mat.frame, 8), 0, 0.27, 0),
        at(cyl(0.16, 0.18, 0.02, mat.frame, 24), 0, 0.01, 0));
    },
    rug(w, d) { return at(box(w, 0.012, d, mat.rug), 0, 0.006, 0); },
    mediaWall(len = 2.6) {
      const g = new THREE.Group();
      const panel = at(box(len + 0.6, 2.5, 0.08, mat.wood), 0, 1.25, -0.28);
      g.add(panel);
      for (let i = 0; i < 14; i++) g.add(at(box(0.012, 2.5, 0.012, mat.black), -len / 2 - 0.3 + (i + 0.5) * (len + 0.6) / 14, 1.25, -0.235));
      g.add(at(rbox(len, 0.42, 0.42, 0.02, mat.lacquer), 0, 0.36, -0.02));
      g.add(at(box(1.75, 1.0, 0.04, mat.screen), 0, 1.38, -0.21));
      g.add(at(box(1.1, 0.07, 0.09, mat.black), 0, 0.62, 0.05));
      return g;
    },
    diningTable(len = 2.2) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 0.05, 1.0, 0.02, lux >= 4 ? mat.stoneDark : mat.wood), 0, 0.75, 0));
      for (const sx of [-1, 1]) g.add(at(box(0.08, 0.72, 0.74, lux >= 4 ? mat.brass : mat.wood), sx * (len / 2 - 0.28), 0.36, 0));
      g.add(at(cyl(0.09, 0.07, 0.22, mat.ceramic, 16), 0, 0.89, 0));
      g.add(at(sph(0.12, mat.leaf, 6), 0, 1.04, 0));
      return g;
    },
    chair() {
      const g = new THREE.Group();
      const seatM = lux >= 4 ? mat.fabric : mat.fabric2;
      g.add(at(rbox(0.47, 0.07, 0.47, 0.03, seatM), 0, 0.47, 0));
      const back = at(rbox(0.47, 0.42, 0.06, 0.03, seatM), 0, 0.76, -0.21); back.rotation.x = -0.08; g.add(back);
      legs4(g, 0.44, 0.44, 0.45, lux >= 4 ? mat.brass : mat.wood, 0.03, 0.016);
      return g;
    },
    pendant(drop = 0.8, globe = 0.17) {
      const top = FLOOR_H - 0.22;
      return G(at(cyl(0.005, 0.005, drop, mat.black, 6), 0, top - drop / 2, 0),
        at(cyl(0.05, 0.05, 0.03, mat.black, 12), 0, top - 0.01, 0),
        at(sph(globe, mat.bulb, 24), 0, top - drop - globe * 0.8, 0));
    },
    linearPendant(len = 1.6) {
      const top = FLOOR_H - 0.22, y = top - 0.9;
      const g = G(at(box(len, 0.05, 0.08, lux >= 4 ? mat.brass : mat.black), 0, y, 0),
        at(box(len - 0.1, 0.012, 0.06, mat.bulb), 0, y - 0.03, 0));
      for (const sx of [-1, 1]) g.add(at(cyl(0.004, 0.004, 0.9, mat.black, 6), sx * (len / 2 - 0.1), top - 0.45, 0));
      return g;
    },
    chandelier() {
      const top = FLOOR_H - 0.22, y = top - 0.95;
      const g = G(at(cyl(0.006, 0.006, 0.95, mat.brass, 6), 0, top - 0.47, 0));
      const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 8, 48), mat.brass), 0, y, 0);
      ring.rotation.x = Math.PI / 2; g.add(ring);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2;
        g.add(at(sph(0.06, mat.bulb, 12), Math.cos(a) * 0.5, y - 0.07, Math.sin(a) * 0.5));
      }
      return g;
    },
    floorLamp() {
      return G(at(cyl(0.16, 0.17, 0.03, mat.frame, 24), 0, 0.015, 0),
        at(cyl(0.014, 0.014, 1.45, mat.frame, 8), 0, 0.74, 0),
        at(cyl(0.17, 0.23, 0.32, mat.shade, 28), 0, 1.55, 0));
    },
    tableLamp() {
      return G(at(sph(0.1, mat.ceramic, 18), 0, 0.1, 0),
        at(cyl(0.01, 0.01, 0.14, mat.brass, 6), 0, 0.25, 0),
        at(cyl(0.11, 0.15, 0.2, mat.shade, 24), 0, 0.4, 0));
    },
    bed(w = 1.8) {
      const g = new THREE.Group();
      g.add(at(rbox(w + 0.16, 0.3, 2.18, 0.05, mat.fabric), 0, 0.2, 0.02));
      g.add(at(rbox(w, 0.24, 2.02, 0.07, mat.white), 0, 0.46, 0.04));
      g.add(at(rbox(w + 0.06, 0.07, 1.5, 0.035, mat.fabric2), 0, 0.6, 0.3));
      g.add(at(rbox(w + 0.1, 0.05, 0.5, 0.025, mat.accent), 0, 0.64, 0.78));
      const pillowCount = w > 1.7 ? 2 : 1;
      for (let i = 0; i < pillowCount; i++) {
        const x = pillowCount === 1 ? 0 : (i ? 1 : -1) * w * 0.25;
        const p = at(rbox(w / pillowCount - 0.12, 0.16, 0.42, 0.07, mat.linen), x, 0.66, -0.7); p.rotation.x = -0.35; g.add(p);
      }
      const cushion = at(rbox(0.5, 0.28, 0.12, 0.06, mat.accent), 0, 0.72, -0.48); cushion.rotation.x = -0.2; g.add(cushion);
      g.add(at(rbox(w + 0.34, 1.2, 0.14, 0.05, mat.fabric), 0, 0.62, -1.08));
      if (lux >= 4) g.add(at(box(w + 1.9, 1.55, 0.06, mat.wood), 0, 0.78, -1.16));
      return g;
    },
    nightstand() {
      const g = new THREE.Group();
      g.add(at(rbox(0.5, 0.42, 0.42, 0.02, lux >= 4 ? mat.lacquer : mat.wood), 0, 0.33, 0));
      g.add(at(box(0.42, 0.006, 0.01, mat.black), 0, 0.33, 0.212));
      legs4(g, 0.46, 0.38, 0.12, mat.frame, 0.03, 0.012);
      g.add(at(mk.tableLamp(), 0, 0.54, -0.05));
      return g;
    },
    wardrobe(len = 1.8) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 2.3, 0.6, 0.015, lux >= 4 ? mat.woodDark : mat.lacquer), 0, 1.17, 0));
      const doors = Math.max(2, Math.round(len / 0.6));
      for (let i = 1; i < doors; i++) g.add(at(box(0.008, 2.2, 0.01, mat.black), -len / 2 + i * len / doors, 1.17, 0.3));
      for (let i = 0; i < doors; i++) g.add(at(box(0.02, 0.5, 0.025, mat.brass), -len / 2 + (i + (i % 2 ? 0.12 : 0.88)) * len / doors, 1.15, 0.315));
      g.add(at(box(len, 0.02, 0.58, mat.black), 0, 0.01, 0));
      return g;
    },
    dresser() {
      const g = new THREE.Group();
      g.add(at(rbox(1.3, 0.7, 0.46, 0.02, mat.wood), 0, 0.5, 0));
      for (let i = 1; i < 3; i++) g.add(at(box(1.24, 0.006, 0.01, mat.black), 0, 0.15 + i * 0.233, 0.232));
      legs4(g, 1.24, 0.4, 0.15, mat.frame, 0.04, 0.014);
      g.add(at(cyl(0.07, 0.05, 0.2, mat.ceramic, 16), -0.4, 0.95, 0));
      g.add(at(box(0.28, 0.05, 0.2, mat.books[2]), 0.3, 0.88, 0));
      return g;
    },
    bench(len = 1.5) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 0.12, 0.44, 0.04, mat.fabric2), 0, 0.44, 0));
      legs4(g, len - 0.05, 0.4, 0.38, mat.frame, 0.04, 0.014);
      return g;
    },
    desk() {
      const g = new THREE.Group();
      g.add(at(rbox(1.45, 0.04, 0.7, 0.01, mat.wood), 0, 0.74, 0));
      for (const sx of [-1, 1]) g.add(at(box(0.04, 0.72, 0.62, mat.frame), sx * 0.68, 0.36, 0));
      g.add(at(box(0.6, 0.36, 0.025, mat.screen), 0, 1.06, -0.22));
      g.add(at(box(0.05, 0.2, 0.05, mat.black), 0, 0.86, -0.22));
      g.add(at(box(0.42, 0.015, 0.14, mat.white), 0, 0.77, 0.08));
      g.add(at(mk.tableLamp(), 0.55, 0.76, -0.18));
      return g;
    },
    officeChair() {
      const g = new THREE.Group();
      g.add(at(rbox(0.5, 0.08, 0.5, 0.035, mat.black), 0, 0.48, 0));
      const back = at(rbox(0.48, 0.58, 0.06, 0.03, mat.black), 0, 0.82, -0.25); back.rotation.x = -0.1; g.add(back);
      g.add(at(cyl(0.025, 0.025, 0.38, mat.steel, 8), 0, 0.26, 0));
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const leg = at(box(0.3, 0.025, 0.04, mat.black), Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14);
        leg.rotation.y = -a; g.add(leg);
      }
      return g;
    },
    bookshelf(len = 1.2) {
      const g = new THREE.Group();
      const H = 2.1, shelves = 5;
      for (const sx of [-1, 1]) g.add(at(box(0.03, H, 0.34, mat.wood), sx * (len / 2 - 0.015), H / 2, 0));
      g.add(at(box(len, H, 0.02, mat.wood), 0, H / 2, -0.16));
      for (let s = 0; s <= shelves; s++) {
        const y = 0.04 + s * (H - 0.06) / shelves;
        g.add(at(box(len - 0.04, 0.025, 0.32, mat.wood), 0, y, 0));
        if (s === shelves) break;
        let x = -len / 2 + 0.06;
        while (x < len / 2 - 0.25) {
          const bw = 0.03 + rnd() * 0.04, bh = 0.2 + rnd() * 0.1;
          if (rnd() < 0.12) { x += 0.12; continue; }
          g.add(at(box(bw, bh, 0.22, mat.books[Math.floor(rnd() * mat.books.length)]), x + bw / 2, y + 0.0125 + bh / 2, 0.02));
          x += bw + 0.004;
        }
      }
      return g;
    },
    plant(size = 1) {
      const g = new THREE.Group();
      const potM = rnd() > 0.5 ? mat.potStone : mat.potTerracotta;
      g.add(at(cyl(0.2 * size, 0.15 * size, 0.38 * size, potM, 20), 0, 0.19 * size, 0));
      const tall = rnd() > 0.45;
      if (tall) g.add(at(cyl(0.018, 0.022, 1.0 * size, mat.woodDark, 6), 0, 0.85 * size, 0));
      const n = tall ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + rnd();
        const r = (tall ? 0.18 : 0.12) * size;
        const y = (tall ? 1.15 + rnd() * 0.45 : 0.5 + rnd() * 0.2) * size;
        const leaf = at(new THREE.Mesh(new THREE.IcosahedronGeometry((0.2 + rnd() * 0.12) * size, 0), i % 2 ? mat.leaf : mat.leaf2),
          Math.cos(a) * r, y, Math.sin(a) * r);
        leaf.scale.y = 1.2; leaf.rotation.set(rnd(), rnd(), rnd()); g.add(leaf);
      }
      return g;
    },
    art(w = 0.9, h = 1.15) {
      seed++;
      return G(at(box(w + 0.06, h + 0.06, 0.035, lux >= 4 ? mat.brass : mat.black), 0, 1.62, 0),
        at(box(w, h, 0.02, M.art(seed + Math.floor(spec.W * 10))), 0, 1.62, 0.016));
    },
    kitchenRun(len = 4) {
      const g = new THREE.Group();
      const front = lux >= 4 ? mat.woodDark : mat.lacquer;
      g.add(at(box(len, 0.1, 0.56, mat.black), 0, 0.05, -0.02));
      g.add(at(box(len, 0.78, 0.6, front), 0, 0.49, 0));
      const units = Math.max(2, Math.round(len / 0.6));
      for (let i = 1; i < units; i++) g.add(at(box(0.006, 0.76, 0.01, mat.black), -len / 2 + i * len / units, 0.49, 0.301));
      g.add(at(box(len + 0.02, 0.04, 0.64, mat.marble), 0, 0.9, 0.01));
      g.add(at(box(0.7, 0.012, 0.48, mat.black), len * 0.22, 0.925, 0.02));
      g.add(at(box(0.55, 0.03, 0.4, mat.steel), -len * 0.2, 0.905, 0.02));
      g.add(at(cyl(0.012, 0.012, 0.3, mat.steel, 8), -len * 0.2, 1.06, -0.2));
      g.add(at(box(len, 0.72, 0.36, front), 0, 1.95, -0.12));
      g.add(at(box(0.75, 0.5, 0.45, mat.steel), len * 0.22, 1.85, -0.04));
      g.add(at(box(len, 1.08, 0.02, mat.marble), 0, 1.38, -0.29));
      return g;
    },
    fridge() {
      const g = new THREE.Group();
      g.add(at(rbox(0.9, 2.05, 0.7, 0.02, mat.steel), 0, 1.03, 0));
      g.add(at(box(0.006, 2.0, 0.01, mat.black), 0, 1.03, 0.351));
      for (const sx of [-1, 1]) g.add(at(box(0.02, 0.8, 0.03, mat.black), sx * 0.06, 1.2, 0.37));
      return g;
    },
    island(len = 2.4) {
      const g = new THREE.Group();
      g.add(at(box(len, 0.86, 0.9, lux >= 4 ? mat.woodDark : mat.wood), 0, 0.45, 0));
      g.add(at(box(len + 0.2, 0.05, 1.0, mat.marble), 0, 0.92, 0));
      if (lux >= 4) for (const sx of [-1, 1]) g.add(at(box(0.05, 0.9, 1.0, mat.marble), sx * (len / 2 + 0.075), 0.45, 0));
      g.add(at(cyl(0.12, 0.1, 0.12, mat.ceramic, 16), -len * 0.25, 1.0, 0));
      return g;
    },
    barStool() {
      const g = new THREE.Group();
      g.add(at(cyl(0.2, 0.19, 0.07, lux >= 4 ? mat.leather : mat.fabric, 24), 0, 0.76, 0));
      g.add(at(cyl(0.022, 0.022, 0.72, mat.frame, 8), 0, 0.38, 0));
      const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 6, 24), mat.frame), 0, 0.3, 0);
      ring.rotation.x = Math.PI / 2; g.add(ring);
      g.add(at(cyl(0.2, 0.22, 0.02, mat.frame, 24), 0, 0.01, 0));
      return g;
    },
    barCounter(len = 2.6) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 1.02, 0.6, 0.03, mat.woodDark), 0, 0.51, 0));
      g.add(at(box(len + 0.1, 0.04, 0.72, mat.stoneDark), 0, 1.06, 0.04));
      g.add(at(box(len - 0.1, 0.012, 0.02, mat.bulb), 0, 0.98, 0.31));
      g.add(at(box(len, 1.7, 0.3, mat.woodDark), 0, 1.25, -1.0));
      for (let s = 0; s < 3; s++) {
        g.add(at(box(len - 0.1, 0.02, 0.26, mat.glass), 0, 1.0 + s * 0.42, -0.95));
        for (let i = 0; i < 7; i++) {
          const bm = M.plain([0x3d1a12, 0x1f4a2a, 0xc9a96e, 0x6b2a1f][(i + s) % 4], { roughness: 0.08, metalness: 0.2 });
          g.add(at(cyl(0.035, 0.035, 0.3, bm, 10), -len / 2 + 0.25 + i * (len - 0.5) / 6, 1.17 + s * 0.42, -0.93));
        }
      }
      return g;
    },
    vanity(len = 1.2) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 0.48, 0.5, 0.015, lux >= 4 ? mat.woodDark : mat.wood), 0, 0.62, 0));
      g.add(at(box(len + 0.02, 0.04, 0.52, mat.marble), 0, 0.88, 0));
      const basins = len >= 1.5 ? 2 : 1;
      for (let i = 0; i < basins; i++) {
        const x = basins === 1 ? 0 : (i ? 1 : -1) * len * 0.25;
        g.add(at(cyl(0.2, 0.16, 0.13, mat.ceramic, 28), x, 0.965, 0.02));
        g.add(at(cyl(0.012, 0.012, 0.28, mat.brass, 8), x, 1.04, -0.2));
        g.add(at(box(0.02, 0.02, 0.14, mat.brass), x, 1.17, -0.14));
        g.add(at(box(Math.min(0.75, len / basins - 0.15), 0.95, 0.02, mat.mirror), x, 1.65, -0.24));
      }
      return g;
    },
    toilet() {
      const g = new THREE.Group();
      g.add(at(box(0.48, 1.12, 0.14, lux >= 4 ? mat.stoneDark : mat.white), 0, 0.56, -0.28));
      g.add(at(rbox(0.38, 0.3, 0.56, 0.13, mat.ceramic), 0, 0.42, 0.02));
      g.add(at(rbox(0.38, 0.03, 0.5, 0.012, mat.ceramic), 0, 0.585, 0.04));
      g.add(at(box(0.16, 0.08, 0.01, mat.steel), 0, 0.98, -0.21));
      return g;
    },
    shower() {
      const g = new THREE.Group();
      g.add(at(box(1.0, 0.04, 1.0, mat.ceramic), 0, 0.02, 0));
      g.add(at(box(1.0, 2.0, 0.012, mat.glass), 0, 1.04, 0.5));
      g.add(at(box(0.012, 2.0, 0.6, mat.glass), 0.5, 1.04, 0.2));
      g.add(at(box(0.02, 0.02, 0.98, mat.brass), 0.5, 2.05, 0));
      g.add(at(cyl(0.15, 0.15, 0.015, mat.brass, 24), 0, 2.15, -0.2));
      g.add(at(cyl(0.01, 0.01, 0.3, mat.brass, 6), 0, 2.2, -0.42));
      return g;
    },
    tub() {
      const g = new THREE.Group();
      g.add(at(rbox(1.7, 0.58, 0.82, 0.26, mat.ceramic), 0, 0.29, 0));
      g.add(at(rbox(1.5, 0.02, 0.62, 0.008, M.water()), 0, 0.52, 0));
      g.add(at(cyl(0.015, 0.015, 0.95, mat.brass, 8), 0.98, 0.48, 0));
      g.add(at(box(0.2, 0.025, 0.025, mat.brass), 0.89, 0.95, 0));
      return g;
    },
    towelRail() {
      return G(at(box(0.6, 0.9, 0.03, mat.brass), 0, 1.1, 0), at(rbox(0.5, 0.6, 0.05, 0.02, mat.linen), 0, 1.05, 0.04));
    },
    workstationPod() {
      const g = new THREE.Group();
      g.add(at(rbox(2.9, 0.04, 1.5, 0.01, mat.white), 0, 0.74, 0));
      g.add(at(box(2.9, 0.4, 0.03, mat.fabric), 0, 0.95, 0));
      for (const sx of [-1, 1]) g.add(at(box(0.05, 0.72, 1.4, mat.steel), sx * 1.42, 0.36, 0));
      for (const sx of [-0.72, 0.72]) for (const sz of [-1, 1]) {
        g.add(at(box(0.6, 0.36, 0.025, mat.screen), sx, 1.06, sz * 0.35));
        const ch = at(mk.officeChair(), sx, 0, sz * 1.05); ch.rotation.y = sz > 0 ? Math.PI : 0; g.add(ch);
      }
      return g;
    },
    meetingTable(len = 3.4) {
      const g = new THREE.Group();
      g.add(at(rbox(len, 0.05, 1.3, 0.25, mat.wood), 0, 0.75, 0));
      g.add(at(box(len * 0.6, 0.72, 0.3, mat.black), 0, 0.37, 0));
      const n = Math.floor(len / 0.8);
      for (let i = 0; i < n; i++) for (const sz of [-1, 1]) {
        const ch = at(mk.officeChair(), -len / 2 + 0.4 + i * (len - 0.8) / Math.max(1, n - 1), 0, sz * 0.95);
        ch.rotation.y = sz > 0 ? Math.PI : 0; g.add(ch);
      }
      return g;
    },
    rack(len = 2.7) {
      const g = new THREE.Group();
      const H = 3.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.08, H, 0.08, mat.rackBlue), sx * (len / 2 - 0.04), H / 2, sz * 0.5));
      for (let l = 0; l < 3; l++) {
        const y = 0.15 + l * 1.2;
        for (const sz of [-1, 1]) g.add(at(box(len, 0.1, 0.06, mat.rack), 0, y, sz * 0.5));
        for (let p = 0; p < 2; p++) {
          const px = (p ? 1 : -1) * len / 4;
          g.add(at(box(1.1, 0.14, 1.0, mat.pallet), px, y + 0.12, 0));
          const bh = 0.5 + rnd() * 0.4;
          g.add(at(box(1.0, bh, 0.92, mat.cardboard), px, y + 0.19 + bh / 2, 0));
        }
      }
      return g;
    },
  };

  /* ---------- layout solver ---------- */
  function makeLayout(hw, hd, avoid) {
    const taken = avoid.map(a => ({ ...a }));
    const hit = (x0, x1, z0, z1) => taken.some(t => x0 < t.x1 && x1 > t.x0 && z0 < t.z1 && z1 > t.z0);
    const range = (a, b, step) => { const out = []; if (b - a < 0.001) return [a]; for (let v = a; v <= b + 0.001; v += step) out.push(v); return out; };
    function find(w, d, px, pz, anchor) {
      const m = 0.04;
      const xmin = -hw + w / 2 + m, xmax = hw - w / 2 - m, zmin = -hd + d / 2 + m, zmax = hd - d / 2 - m;
      if (xmin > xmax + 0.001 || zmin > zmax + 0.001) return null;
      const xs = anchor === 'left' ? [xmin] : anchor === 'right' ? [xmax] : range(xmin, xmax, 0.3);
      const zs = anchor === 'front' ? [zmin] : anchor === 'back' ? [zmax] : range(zmin, zmax, 0.3);
      const cands = [];
      xs.forEach(x => zs.forEach(z => cands.push([x, z, (x - px) ** 2 + (z - pz) ** 2])));
      cands.sort((a, b) => a[2] - b[2]);
      for (const [x, z] of cands) {
        if (!hit(x - w / 2, x + w / 2, z - d / 2, z + d / 2)) {
          taken.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
          return { x, z };
        }
      }
      return null;
    }
    return { find };
  }

  /* ---------- room programmes ---------- */
  const theme = spec.isOffice || spec.isHotel ? 'office' : spec.isWarehouse ? 'warehouse' : 'home';

  function furnishRoom(r, avoidWorld) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const hw = (r.x1 - r.x0) / 2 - 0.2, hd = (r.z1 - r.z0) / 2 - 0.22;
    if (hw < 0.7 || hd < 0.7) return [];
    seed = Math.floor(Math.abs(r.x0 * 97 + r.z0 * 31 + r.floor * 13)) + 7;
    const avoid = avoidWorld.map(a => ({ x0: a.x0 - cx, x1: a.x1 - cx, z0: a.z0 - cz, z1: a.z1 - cz }));
    const L = makeLayout(hw, hd, avoid);
    const items = [];
    const put = (obj, x, z, rot, label) => { obj.position.x = x; obj.position.z = z; obj.rotation.y = rot || 0; items.push({ obj, label }); return obj; };
    // rotate a local offset (ox, oz) by rot around Y
    const off = (p, ox, oz, rot) => [p.x + ox * Math.cos(rot) + oz * Math.sin(rot), p.z - ox * Math.sin(rot) + oz * Math.cos(rot)];
    const putIn = (p, rot, obj, ox, oz, prot, label) => { const [x, z] = off(p, ox, oz, rot); return put(obj, x, z, rot + (prot || 0), label); };
    const W2 = hw * 2, D2 = hd * 2;
    const wide = W2 >= 8.5;

    const addPlants = n => {
      const corners = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]];
      for (let i = 0; i < n; i++) {
        const [px, pz] = corners[i % 4];
        const p = L.find(0.6, 0.6, px, pz);
        if (p) put(mk.plant(0.85 + rnd() * 0.5), p.x, p.z, rnd() * 6, 'Indoor plant');
      }
    };
    const addArt = n => {
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 'right' : 'left';
        const pz = -hd + (i + 1) * D2 / (n + 1);
        const p = L.find(0.12, 1.2, side === 'left' ? -hw : hw, pz, side);
        if (p) put(mk.art(0.85, 1.1), p.x + (side === 'left' ? -0.03 : 0.03), p.z, side === 'left' ? Math.PI / 2 : -Math.PI / 2, 'Artwork');
      }
    };

    if (r.isBathroom) {
      const vLen = W2 >= 2.6 ? 1.6 : 1.1;
      let p = L.find(vLen, 0.55, -hw * 0.3, hd, 'back');
      if (p) put(mk.vanity(vLen), p.x, p.z, Math.PI, 'Vanity unit');
      p = L.find(0.52, 0.72, hw, hd, 'back');
      if (p) put(mk.toilet(), p.x, p.z, Math.PI, 'WC suite');
      p = L.find(1.02, 1.02, -hw, -hd, 'left');
      if (p) put(mk.shower(), p.x, p.z, 0, 'Walk-in shower');
      if (lux >= 3) { p = L.find(1.8, 0.9, 0.4, -hd * 0.1); if (p) put(mk.tub(), p.x, p.z, 0, 'Freestanding bath'); }
      p = L.find(0.62, 0.12, hw, 0, 'right'); if (p) put(mk.towelRail(), p.x, p.z, -Math.PI / 2, 'Towel rail');
      addPlants(1);
      return finish();
    }

    if (theme === 'warehouse') {
      for (let i = 0; i < 24; i++) {
        const p = L.find(2.8, 1.5, -hw + 1.4, -hd + (i % 6) * 2.2);
        if (!p) break;
        put(mk.rack(2.7), p.x, p.z, 0, 'Pallet racking');
      }
      return finish();
    }

    if (theme === 'office') {
      if (r.type === 'living') {
        const p = L.find(5.2, 3.4, 0, -hd + 2);
        if (p) put(mk.meetingTable(3.6), p.x, p.z, 0, 'Meeting table');
        const s = L.find(2.7, 1.1, -hw, hd, 'back');
        if (s) put(mk.sofa(2.5, mat.fabric), s.x, s.z, Math.PI, 'Reception sofa');
      }
      for (let i = 0; i < 12; i++) {
        const p = L.find(3.0, 3.1, -hw, -hd + i * 3);
        if (!p) break;
        put(mk.workstationPod(), p.x, p.z, 0, 'Workstation pod');
      }
      addPlants(3);
      addArt(2);
      ceiling(Math.max(1, Math.floor(D2 / 5)), 'linear');
      return finish();
    }

    if (r.type === 'living') {
      // lounge set: media wall at front, sofa facing it
      const sofaLen = clamp(W2 * 0.42, 2.0, 2.8);
      const setW = Math.min(sofaLen + 2.6, W2 - 0.2), setD = 5.0;
      let p = L.find(setW, setD, wide ? -hw / 2 : 0, -hd + setD / 2);
      if (p) {
        putIn(p, 0, mk.rug(Math.min(setW - 0.4, 3.8), 2.9), 0, 0.35, 0, 'Area rug');
        putIn(p, 0, mk.mediaWall(Math.min(2.6, setW - 0.8)), 0, -setD / 2 + 0.32, 0, 'Media wall');
        putIn(p, 0, mk.sofa(sofaLen), 0, 1.75, Math.PI, 'Sofa');
        putIn(p, 0, mk.coffeeTable(), 0, 0.35, 0, 'Coffee table');
        if (setW > sofaLen + 1.8) {
          putIn(p, 0, mk.armchair(), -(setW / 2 - 0.5), 0.35, Math.PI / 2, 'Armchair');
          putIn(p, 0, mk.armchair(), setW / 2 - 0.5, 0.35, -Math.PI / 2, 'Armchair');
        }
        putIn(p, 0, mk.floorLamp(), sofaLen / 2 + 0.35, 2.0, 0, 'Floor lamp');
        putIn(p, 0, mk.sideTable(), -sofaLen / 2 - 0.35, 1.8, 0, 'Side table');
        putIn(p, 0, lux >= 4 ? mk.chandelier() : mk.pendant(0.6, 0.22), 0, 0.35, 0, 'Feature light');
      }
      // dining
      const tLen = clamp(W2 - 2.4, 1.6, lux >= 4 ? 2.8 : 2.2);
      p = L.find(tLen + 1.2, 2.5, wide ? hw / 2 : 0, wide ? -hd + 2 : 0);
      if (p) {
        putIn(p, 0, mk.diningTable(tLen), 0, 0, 0, 'Dining table');
        const n = Math.max(2, Math.floor(tLen / 0.65));
        for (let i = 0; i < n; i++) {
          const x = -tLen / 2 + 0.35 + i * (tLen - 0.7) / Math.max(1, n - 1);
          putIn(p, 0, mk.chair(), x, -0.72, 0, 'Dining chair');
          putIn(p, 0, mk.chair(), x, 0.72, Math.PI, 'Dining chair');
        }
        putIn(p, 0, mk.linearPendant(Math.min(1.8, tLen - 0.2)), 0, 0, 0, 'Pendant light');
      }
      if (lux >= 3) {
        p = L.find(3.0, 1.9, wide ? hw / 2 : 0, hd - 1);
        if (p) {
          putIn(p, 0, mk.barCounter(2.6), 0, -0.25, 0, 'Bar counter');
          for (let i = 0; i < 3; i++) putIn(p, 0, mk.barStool(), -0.8 + i * 0.8, 0.42, 0, 'Bar stool');
        }
      }
      p = L.find(2.4, 2.2, wide ? -hw / 2 : 0, hd - 1.1);
      if (p) {
        putIn(p, 0, mk.bookshelf(1.4), 0, -0.9, 0, 'Bookshelf');
        putIn(p, 0, mk.loungeChair(), -0.35, 0.3, 0.5, 'Lounge chair');
        putIn(p, 0, mk.floorLamp(), 0.65, 0.2, 0, 'Reading lamp');
      }
      addPlants(3);
      addArt(2);
      return finish();
    }

    if (r.type === 'kitchen') {
      const runLen = clamp(D2 - 2.4, 2.4, 5.2);
      let p = L.find(0.66, runLen, -hw, -hd + runLen / 2 + 0.2, 'left');
      if (p) put(mk.kitchenRun(runLen), p.x, p.z, Math.PI / 2, 'Kitchen run');
      p = L.find(0.75, 0.92, -hw, -hd + runLen + 0.8, 'left');
      if (p) put(mk.fridge(), p.x, p.z, Math.PI / 2, 'Refrigerator');
      if (W2 >= 3.6) {
        const iLen = clamp(D2 * 0.35, 1.6, 2.8);
        p = L.find(1.0 + 0.9, iLen + 0.3, 0.6, -hd + runLen / 2 + 0.2);
        if (p) {
          putIn(p, 0, mk.island(iLen), -0.4, 0, Math.PI / 2, 'Kitchen island');
          const n = Math.max(2, Math.floor(iLen / 0.6));
          for (let i = 0; i < n; i++) putIn(p, 0, mk.barStool(), 0.5, -iLen / 2 + 0.3 + i * (iLen - 0.6) / Math.max(1, n - 1), 0, 'Counter stool');
          for (let i = 0; i < 2; i++) putIn(p, 0, mk.pendant(0.7, 0.14), -0.4, (i ? 1 : -1) * iLen * 0.25, 0, 'Pendant light');
        }
      }
      p = L.find(2.6, 2.4, 0, hd - 1.3);
      if (p) {
        putIn(p, 0, mk.diningTable(1.5), 0, 0, 0, 'Breakfast table');
        for (const sx of [-0.4, 0.4]) {
          putIn(p, 0, mk.chair(), sx, -0.72, 0, 'Dining chair');
          putIn(p, 0, mk.chair(), sx, 0.72, Math.PI, 'Dining chair');
        }
        putIn(p, 0, mk.pendant(0.75, 0.2), 0, 0, 0, 'Pendant light');
      }
      addPlants(2);
      addArt(1);
      return finish();
    }

    if (r.type === 'closet') {
      for (const side of ['left', 'right']) {
        const len = clamp(D2 - 0.6, 1.2, 3.6);
        const p = L.find(0.62, len, side === 'left' ? -hw : hw, 0, side);
        if (p) put(mk.wardrobe(len), p.x, p.z, side === 'left' ? Math.PI / 2 : -Math.PI / 2, 'Fitted wardrobe');
      }
      const p = L.find(0.8, 0.8, 0, 0);
      if (p) put(mk.bench(0.7), p.x, p.z, Math.PI / 2, 'Dressing ottoman');
      ceiling(1);
      return finish();
    }

    if (r.type === 'bedroom' || r.type === 'study') {
      const isBed = r.type === 'bedroom';
      if (isBed) {
        const master = r.label === 'Master suite' || lux >= 4;
        const bw = master ? 2.0 : 1.7;
        const setW = Math.min(bw + 1.4, W2 - 0.1), setD = 3.0;
        const headToFront = r.band === 'back';
        let p = L.find(setW, setD, 0, headToFront ? -hd : hd, headToFront ? 'front' : 'back');
        if (!p) p = L.find(setW, setD, 0, 0);
        if (p) {
          const rot = headToFront ? 0 : Math.PI;
          putIn(p, rot, mk.rug(Math.min(setW + 0.4, 3.6), 2.4), 0, 0.5, 0, 'Area rug');
          putIn(p, rot, mk.bed(bw), 0, -0.3, 0, master ? 'King bed' : 'Double bed');
          if (setW >= bw + 1.2) {
            putIn(p, rot, mk.nightstand(), -(bw / 2 + 0.36), -1.0, 0, 'Nightstand');
            putIn(p, rot, mk.nightstand(), bw / 2 + 0.36, -1.0, 0, 'Nightstand');
          }
          putIn(p, rot, mk.bench(Math.min(1.5, bw - 0.2)), 0, 1.15, 0, 'Bed bench');
          putIn(p, rot, mk.art(Math.min(1.4, bw - 0.3), 0.8), 0, -1.42, 0, 'Artwork');
          putIn(p, rot, mk.pendant(0.5, 0.2), 0, 0.2, 0, 'Ceiling light');
        }
        const wLen = clamp(D2 * 0.35, 1.2, 2.6);
        p = L.find(0.62, wLen, hw, 0, 'right');
        if (p) put(mk.wardrobe(wLen), p.x, p.z, -Math.PI / 2, 'Wardrobe');
        p = L.find(0.5, 1.3, -hw, 0, 'left');
        if (p) { put(mk.dresser(), p.x, p.z, Math.PI / 2, 'Dresser'); }
        p = L.find(1.7, 1.4, -hw, headToFront ? hd : -hd);
        if (p) {
          putIn(p, 0, mk.armchair(), -0.35, 0, 0.4, 'Armchair');
          putIn(p, 0, mk.floorLamp(), 0.5, -0.3, 0, 'Floor lamp');
          putIn(p, 0, mk.sideTable(), 0.45, 0.35, 0, 'Side table');
        }
      }
      if (!isBed || D2 > 6) {
        const p = L.find(0.8, 1.6, hw, headToFrontSafe(r) ? hd - 1 : -hd + 1, 'right');
        if (p) {
          put(mk.desk(), p.x, p.z, -Math.PI / 2, 'Desk');
          put(mk.officeChair(), p.x - 0.75, p.z, -Math.PI / 2, 'Desk chair');
        }
        const b = L.find(0.36, 1.3, -hw, 0, 'left');
        if (b) put(mk.bookshelf(1.2), b.x, b.z, Math.PI / 2, 'Bookshelf');
        if (!isBed) ceiling(1);
      }
      addPlants(isBed ? 2 : 1);
      addArt(1);
      return finish();
    }

    addPlants(2);
    return finish();

    function headToFrontSafe(room) { return room.band === 'back'; }
    function ceiling(n, kind) {
      for (let i = 0; i < n; i++) {
        const z = -hd + (i + 0.5) * D2 / n;
        put(kind === 'linear' ? mk.linearPendant(Math.min(2.4, W2 - 1)) : mk.pendant(0.5, 0.2), 0, z, 0, 'Ceiling light');
      }
    }
    function finish() { return items; }
  }

  return { furnishRoom };
}
