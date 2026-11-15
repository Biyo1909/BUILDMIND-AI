/* ============================================================
   BuildMind AI — procedural PBR material library
   Canvas-painted textures (no external assets) → MeshStandardMaterial
   ============================================================ */

const MatLib = (() => {
  const SIZE = 512;
  const texCache = new Map();
  const matCache = new Map();
  const glowMats = { window: [], lamp: [] };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 1000000; };
  }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const css = c => '#' + new THREE.Color(c).getHexString();
  const shade = (c, l, s = 0) => { const col = new THREE.Color(c); col.offsetHSL(0, s, l); return '#' + col.getHexString(); };

  function grain(ctx, size, amount, r) {
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  function blotches(ctx, s, n, alpha, r, minR = 20, maxR = 110) {
    for (let i = 0; i < n; i++) {
      const x = r() * s, y = r() * s, rad = minR + r() * (maxR - minR);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = alpha * r();
      g.addColorStop(0, r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  const painters = {
    plaster(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, 70, 0.035, r);
      grain(ctx, s, 8, r);
    },
    concrete(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, 90, 0.06, r);
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 2;
      for (let y = s / 3; y < s; y += s / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
      for (let i = 0; i < 6; i++) {
        const x = (i % 3 + 0.5) * s / 3, y = (Math.floor(i / 3) + 0.5) * s / 3 + s / 6;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x, y % s, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.12})`;
        ctx.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5);
      }
      grain(ctx, s, 22, r);
    },
    stone(ctx, s, c, r) {
      ctx.fillStyle = shade(c, -0.12); ctx.fillRect(0, 0, s, s);
      const rows = 8, rh = s / rows;
      for (let row = 0; row < rows; row++) {
        let x = row % 2 ? -r() * 60 : 0;
        while (x < s) {
          const bw = s / 5 * (0.7 + r() * 0.7);
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.07, (r() - 0.5) * 0.05);
          ctx.fillRect(x + 2, row * rh + 2, bw - 4, rh - 4);
          x += bw;
        }
      }
      blotches(ctx, s, 60, 0.05, r, 10, 60);
      grain(ctx, s, 18, r);
    },
    brick(ctx, s, c, r) {
      ctx.fillStyle = '#cfc8bd'; ctx.fillRect(0, 0, s, s);
      const rows = 24, cols = 8, rh = s / rows, bw = s / cols;
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = -1; col < cols + 1; col++) {
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.12, (r() - 0.5) * 0.1);
          ctx.fillRect(col * bw + off + 1.5, row * rh + 1.5, bw - 3, rh - 3);
        }
      }
      grain(ctx, s, 20, r);
    },
    timber(ctx, s, c, r) {
      const boards = 16, bw = s / boards;
      for (let i = 0; i < boards; i++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.08); ctx.fillRect(i * bw, 0, bw, s);
        for (let j = 0; j < 7; j++) {
          ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`; ctx.lineWidth = 0.8 + r();
          ctx.beginPath();
          const x0 = i * bw + r() * bw;
          ctx.moveTo(x0, 0);
          for (let y = 0; y <= s; y += 32) ctx.lineTo(x0 + Math.sin(y * 0.02 + j) * 2.2, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(i * bw, 0, 2.5, s);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(i * bw + 2.5, 0, 1.5, s);
      }
      grain(ctx, s, 10, r);
    },
    woodPlank(ctx, s, c, r) {
      const rows = 8, rh = s / rows;
      for (let row = 0; row < rows; row++) {
        let x = -r() * s * 0.5;
        while (x < s) {
          const len = s * (0.45 + r() * 0.5);
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.09, (r() - 0.5) * 0.05);
          ctx.fillRect(x, row * rh, len, rh);
          for (let j = 0; j < 6; j++) {
            ctx.strokeStyle = `rgba(40,20,5,${0.05 + r() * 0.08})`; ctx.lineWidth = 0.6 + r() * 0.9;
            ctx.beginPath();
            const y0 = row * rh + r() * rh;
            ctx.moveTo(x, y0);
            for (let xx = x; xx <= x + len; xx += 24) ctx.lineTo(xx, y0 + Math.sin(xx * 0.03 + j * 2) * 1.6);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, row * rh, 1.5, rh);
          x += len;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(0, row * rh, s, 1.6);
      }
      grain(ctx, s, 9, r);
    },
    tiles(ctx, s, c, r) {
      const rows = 12, cols = 10, rh = s / rows, cw = s / cols;
      ctx.fillStyle = shade(c, -0.18); ctx.fillRect(0, 0, s, s);
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? cw / 2 : 0;
        for (let col = -1; col <= cols; col++) {
          const x = col * cw + off, y = row * rh;
          const g = ctx.createLinearGradient(0, y, 0, y + rh);
          const base = shade(c, (r() - 0.5) * 0.08, (r() - 0.5) * 0.06);
          g.addColorStop(0, shade(base, 0.05)); g.addColorStop(0.75, base); g.addColorStop(1, shade(base, -0.14));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x + 1, y);
          ctx.lineTo(x + cw - 1, y);
          ctx.lineTo(x + cw - 1, y + rh - 4);
          ctx.quadraticCurveTo(x + cw / 2, y + rh + 3, x + 1, y + rh - 4);
          ctx.closePath(); ctx.fill();
        }
      }
      grain(ctx, s, 14, r);
    },
    slate(ctx, s, c, r) {
      const rows = 14, cols = 7, rh = s / rows, cw = s / cols;
      ctx.fillStyle = shade(c, -0.08); ctx.fillRect(0, 0, s, s);
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? cw / 2 : 0;
        for (let col = -1; col <= cols; col++) {
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.06);
          ctx.fillRect(col * cw + off + 1, row * rh + 1, cw - 2, rh - 1);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(col * cw + off, row * rh + rh - 2, cw, 2);
        }
      }
      grain(ctx, s, 12, r);
    },
    metal(ctx, s, c, r) {
      const seams = 10, sw = s / seams;
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, shade(c, 0.03)); g.addColorStop(1, shade(c, -0.03));
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < seams; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(i * sw, 0, 2, s);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(i * sw + 2, 0, 2, s);
      }
      grain(ctx, s, 5, r);
    },
    gravel(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) {
        const l = (r() - 0.5) * 0.25;
        ctx.fillStyle = shade(c, l);
        const rad = 0.8 + r() * 2.2;
        ctx.beginPath(); ctx.arc(r() * s, r() * s, rad, 0, Math.PI * 2); ctx.fill();
      }
      grain(ctx, s, 16, r);
    },
    paving(ctx, s, c, r) {
      ctx.fillStyle = shade(c, -0.2); ctx.fillRect(0, 0, s, s);
      const rows = 8, rh = s / rows, pw = s / 4;
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? pw / 2 : 0;
        for (let col = -1; col < 5; col++) {
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06);
          ctx.fillRect(col * pw + off + 2, row * rh + 2, pw - 4, rh - 4);
        }
      }
      blotches(ctx, s, 40, 0.05, r, 10, 50);
      grain(ctx, s, 16, r);
    },
    travertine(ctx, s, c, r) {
      ctx.fillStyle = shade(c, -0.1); ctx.fillRect(0, 0, s, s);
      const n = 4, t = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.05);
        ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = 'rgba(120,90,60,0.08)';
          ctx.fillRect(i * t + 4, j * t + r() * t, t - 8, 1 + r() * 2);
        }
      }
      grain(ctx, s, 12, r);
    },
    grass(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, 80, 0.09, r, 20, 90);
      for (let i = 0; i < 14000; i++) {
        const x = r() * s, y = r() * s, len = 2 + r() * 6;
        ctx.strokeStyle = shade(c, (r() - 0.45) * 0.22, (r() - 0.5) * 0.15);
        ctx.lineWidth = 0.8 + r() * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2.5, y - len); ctx.stroke();
      }
      grain(ctx, s, 12, r);
    },
    soil(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, 120, 0.12, r, 15, 100);
      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.3);
        ctx.beginPath(); ctx.arc(r() * s, r() * s, 0.6 + r() * 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 9;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath(); const y0 = s * (0.3 + k * 0.35);
        ctx.moveTo(0, y0); ctx.bezierCurveTo(s * 0.3, y0 - 40, s * 0.7, y0 + 40, s, y0); ctx.stroke();
      }
      grain(ctx, s, 24, r);
    },
    asphalt(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.18);
        ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
      }
      blotches(ctx, s, 30, 0.08, r);
      grain(ctx, s, 14, r);
    },
    floorTile(ctx, s, c, r) {
      const n = 4, t = s / n;
      ctx.fillStyle = shade(c, -0.12); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.035);
        ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      grain(ctx, s, 6, r);
    },
    marble(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, 40, 0.04, r);
      ctx.filter = 'blur(0.8px)';
      for (let v = 0; v < 16; v++) {
        ctx.strokeStyle = `rgba(90,90,95,${0.08 + r() * 0.22})`;
        ctx.lineWidth = 0.6 + r() * 1.8;
        ctx.beginPath();
        let x = r() * s, y = 0;
        ctx.moveTo(x, y);
        while (y < s) { x += (r() - 0.5) * 34; y += 8 + r() * 18; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.filter = 'none';
      const n = 2, t = s / n;
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 1; i < n; i++) { ctx.fillRect(i * t, 0, 1.5, s); ctx.fillRect(0, i * t, s, 1.5); }
    },
    fabric(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.03})`; ctx.fillRect(0, y, s, 1); }
      for (let x = 0; x < s; x += 3) { ctx.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`; ctx.fillRect(x, 0, 1, s); }
      grain(ctx, s, 14, r);
    },
    rug(ctx, s, c, r) {
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = shade(c, 0.16); ctx.lineWidth = 10; ctx.strokeRect(26, 26, s - 52, s - 52);
      ctx.strokeStyle = shade(c, -0.12); ctx.lineWidth = 3; ctx.strokeRect(48, 48, s - 96, s - 96);
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.04})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(60, 60 + i * 44); ctx.lineTo(s - 60, 60 + i * 44 + (r() - 0.5) * 20); ctx.stroke();
      }
      grain(ctx, s, 26, r);
    },
    water(ctx, s, c, r) {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, shade(c, 0.06)); g.addColorStop(1, shade(c, -0.05));
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      ctx.lineWidth = 2;
      for (let i = 0; i < 140; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`;
        const x = r() * s, y = r() * s, w = 20 + r() * 50;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + w * 0.3, y - 10, x + w * 0.7, y + 10, x + w, y); ctx.stroke();
      }
    },
    poolTile(ctx, s, c, r) {
      const n = 16, t = s / n;
      ctx.fillStyle = '#e8f3f5'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.1);
        ctx.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
    },
  };

  function texture(kind, color) {
    const key = kind + '|' + color;
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    (painters[kind] || painters.plaster)(ctx, SIZE, color, rng(hashStr(key)));
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    texCache.set(key, tex);
    return tex;
  }

  const KIND_PROPS = {
    plaster: { roughness: 0.92, bump: 0.012 },
    concrete: { roughness: 0.88, bump: 0.02 },
    stone: { roughness: 0.82, bump: 0.03 },
    brick: { roughness: 0.9, bump: 0.03 },
    timber: { roughness: 0.78, bump: 0.025 },
    woodPlank: { roughness: 0.55, bump: 0.01 },
    tiles: { roughness: 0.7, bump: 0.05 },
    slate: { roughness: 0.65, bump: 0.03 },
    metal: { roughness: 0.42, metalness: 0.55, bump: 0.015 },
    gravel: { roughness: 0.96, bump: 0.03 },
    paving: { roughness: 0.85, bump: 0.025 },
    travertine: { roughness: 0.6, bump: 0.01 },
    grass: { roughness: 0.98, bump: 0.02 },
    soil: { roughness: 1, bump: 0.04 },
    asphalt: { roughness: 0.93, bump: 0.015 },
    floorTile: { roughness: 0.22, bump: 0.004 },
    marble: { roughness: 0.14, bump: 0.002 },
    fabric: { roughness: 0.97, bump: 0.01 },
    rug: { roughness: 1, bump: 0.02 },
    water: { roughness: 0.04, metalness: 0.1 },
    poolTile: { roughness: 0.3, bump: 0.004 },
  };

  // textured material with repeat (cached)
  function get(kind, color, repeat = [1, 1], extra = {}) {
    const rx = Math.round(repeat[0] * 20) / 20, ry = Math.round(repeat[1] * 20) / 20;
    const key = [kind, color, rx, ry, JSON.stringify(extra)].join('|');
    if (matCache.has(key)) return matCache.get(key);
    const base = texture(kind, color);
    const map = base.clone();
    map.needsUpdate = true;
    map.repeat.set(rx, ry);
    const props = KIND_PROPS[kind] || {};
    const mat = new THREE.MeshStandardMaterial({
      map,
      roughness: extra.roughness ?? props.roughness ?? 0.8,
      metalness: extra.metalness ?? props.metalness ?? 0,
      envMapIntensity: extra.envMapIntensity ?? 0.8,
    });
    if (props.bump && !extra.noBump) { mat.bumpMap = map; mat.bumpScale = props.bump; }
    if (extra.transparent) { mat.transparent = true; mat.opacity = extra.opacity ?? 1; }
    if (extra.side) mat.side = extra.side;
    matCache.set(key, mat);
    return mat;
  }

  function plain(color, o = {}) {
    const key = 'plain|' + color + '|' + JSON.stringify(o);
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).convertSRGBToLinear(),
      roughness: o.roughness ?? 0.7,
      metalness: o.metalness ?? 0,
      envMapIntensity: o.envMapIntensity ?? 0.9,
    });
    if (o.emissive != null) { mat.emissive = new THREE.Color(o.emissive); mat.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.transparent) { mat.transparent = true; mat.opacity = o.opacity ?? 1; mat.depthWrite = o.depthWrite ?? true; }
    if (o.side) mat.side = o.side;
    if (o.flatShading) mat.flatShading = true;
    matCache.set(key, mat);
    return mat;
  }

  function glass(tint = 0x22303a, kind = 'window') {
    const key = 'glass|' + tint + '|' + kind;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: tint, roughness: 0.04, metalness: 0.92, envMapIntensity: 1.35,
      transparent: kind !== 'window', opacity: kind === 'window' ? 1 : 0.28,
      emissive: new THREE.Color(0xffb46a), emissiveIntensity: 0,
    });
    if (kind !== 'window') { mat.depthWrite = false; mat.metalness = 0.4; }
    matCache.set(key, mat);
    if (kind === 'window') glowMats.window.push(mat);
    return mat;
  }

  function lampGlow(color = 0xffd29a) {
    const key = 'lamp|' + color;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff4e2, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: 0.4 });
    matCache.set(key, mat);
    glowMats.lamp.push(mat);
    return mat;
  }

  function water() {
    const key = 'water';
    if (matCache.has(key)) return matCache.get(key);
    const map = texture('water', 0x1f93b8).clone(); map.needsUpdate = true; map.repeat.set(2, 2);
    const mat = new THREE.MeshStandardMaterial({
      map, color: 0xffffff, roughness: 0.05, metalness: 0.15, envMapIntensity: 1.4,
      transparent: true, opacity: 0.9,
    });
    matCache.set(key, mat);
    return mat;
  }

  // abstract artwork canvases for walls
  const ART_PALETTES = [
    ['#e9dfcf', '#b5653f', '#2f3e46', '#d6a64f', '#1d1d1f'],
    ['#efe9e1', '#7d8f7a', '#c9a96e', '#3b3a36', '#a1452f'],
    ['#f2ede6', '#24415b', '#d9b58a', '#8a3b2b', '#5b6c5d'],
  ];
  function art(seed) {
    const key = 'art|' + seed;
    if (matCache.has(key)) return matCache.get(key);
    const c = document.createElement('canvas'); c.width = 256; c.height = 320;
    const ctx = c.getContext('2d');
    const r = rng(seed * 7919 + 13);
    const pal = ART_PALETTES[seed % ART_PALETTES.length];
    ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, 256, 320);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = pal[1 + Math.floor(r() * (pal.length - 1))];
      ctx.globalAlpha = 0.75 + r() * 0.25;
      const t = r();
      if (t < 0.4) { ctx.beginPath(); ctx.arc(r() * 256, r() * 320, 30 + r() * 80, 0, Math.PI * 2); ctx.fill(); }
      else if (t < 0.7) { ctx.fillRect(r() * 200, r() * 260, 40 + r() * 120, 20 + r() * 90); }
      else { ctx.beginPath(); ctx.arc(r() * 256, 320, 60 + r() * 90, Math.PI, 0); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    matCache.set(key, mat);
    return mat;
  }

  function setGlow(windowIntensity, lampIntensity) {
    glowMats.window.forEach(m => { m.emissiveIntensity = windowIntensity; });
    glowMats.lamp.forEach(m => { m.emissiveIntensity = lampIntensity; });
  }

  return { get, plain, glass, lampGlow, water, art, texture, setGlow };
})();
