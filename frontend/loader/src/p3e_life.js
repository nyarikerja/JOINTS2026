/* ---------- Kehidupan di sepanjang sungai ----------
   Vegetasi tropis (kelapa, pisang, rumpun bambu), rumah panggung beratap rumbia, sampan tertambat, teratai, bebek,
   kawanan kuntul, kupu-kupu dan capung, warga di tepian (pemancing, ibu mencuci, anak bermain) dan penjor di depan gerbang. */
const bankPt = (z, side, off) => { const x = cx(z) + side * (shoreAd(z) + off); return V3(x, terrainH(x, z), z); };
const freeZ = (z, m) => Math.abs(z - BRIDGE.z) > BRIDGE.hw + (m || 0) && Math.abs(z - GATE.z) > GATE.hw + (m || 0);

/* ====== Vegetasi tropis ====== */
function buildTropics() {
  const out = new THREE.Group(), r = mulberry32(303);
  /* tekstur */
  const frondTex = canvasTex(64, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); const rr = mulberry32(8);
    for (let y = 6; y < h - 4; y += 3.2) {
      const t = y / h, len = (w / 2 - 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)), 0.7), g = 90 + rr() * 60 | 0;
      [-1, 1].forEach(s => { c.strokeStyle = `rgb(${40 + rr() * 30 | 0},${g},${30 + rr() * 20 | 0})`; c.lineWidth = 1.8; c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.6, y + 4, w / 2 + s * len, y + 12 + rr() * 4); c.stroke(); });
    }
    c.strokeStyle = '#7d7a3a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  });
  const bananaTex = canvasTex(128, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); const rr = mulberry32(12);
    c.fillStyle = '#4f8a2e'; c.beginPath(); c.moveTo(w / 2, 0);
    c.bezierCurveTo(w * 1.02, h * 0.1, w * 1.02, h * 0.85, w / 2, h); c.bezierCurveTo(-w * 0.02, h * 0.85, -w * 0.02, h * 0.1, w / 2, 0); c.fill();
    for (let y = 0; y < h; y += 3) { c.strokeStyle = `rgba(${rr() < 0.5 ? '30,60,20' : '140,190,90'},0.25)`; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2, y); c.lineTo(rr() < 0.5 ? 0 : w, y - 22); c.stroke(); }
    c.globalCompositeOperation = 'destination-out';                                       // robekan khas daun pisang
    for (let i = 0; i < 9; i++) { const y = 20 + rr() * (h - 40), s = rr() < 0.5 ? -1 : 1; c.lineWidth = 2 + rr() * 2; c.beginPath(); c.moveTo(w / 2 + s * 8, y); c.lineTo(w / 2 + s * w * 0.6, y - 18); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(160,140,60,0.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    c.strokeStyle = 'rgba(120,90,40,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.bezierCurveTo(w * 1.0, h * 0.1, w * 1.0, h * 0.85, w / 2, h); c.stroke();
  });
  const bambooLeafTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); const rr = mulberry32(14);
    for (let i = 0; i < 46; i++) {
      const x = w / 2 + (rr() - 0.5) * w * 0.8, y = h / 2 + (rr() - 0.5) * h * 0.8, L = 16 + rr() * 14, g = 100 + rr() * 70 | 0;
      c.save(); c.translate(x, y); c.rotate(rr() * 6.283); c.fillStyle = `rgb(${60 + rr() * 30 | 0},${g},${35 + rr() * 20 | 0})`;
      c.beginPath(); c.moveTo(0, -L); c.quadraticCurveTo(4, 0, 0, L * 0.4); c.quadraticCurveTo(-4, 0, 0, -L); c.fill(); c.restore();
    }
  });
  const ringTex = (base, line) => canvasTex(64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[0]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 7) { c.fillStyle = line; c.fillRect(0, y, w, 2); }
  }, true);
  const palmBark = ringTex(['#5d5144', '#8a7a66'], 'rgba(40,32,24,0.55)'); palmBark.repeat.set(2, 8);
  const swayM = (amp, sp, key, map, alpha) => fxMat(new THREE.MeshLambertMaterial({ map, alphaTest: alpha ? 0.45 : 0, side: THREE.DoubleSide, vertexColors: false }), key,
    { sway: { amp, speed: sp, wexpr: 'max(position.y-1.5,0.0)*0.12' }, backlight: alpha ? 0.5 : 0, mode: 'conifer' });
  const frondMat = swayM(0.08, 1.1, 'palmF', frondTex, true);
  const trunkMat = fxMat(new THREE.MeshLambertMaterial({ map: palmBark }), 'palmT', { mode: 'rock' });
  const banMat = fxMat(new THREE.MeshLambertMaterial({ map: bananaTex, alphaTest: 0.45, side: THREE.DoubleSide }), 'banL', { sway: { amp: 0.06, speed: 1.4, wexpr: 'max(position.y-0.8,0.0)*0.4' }, backlight: 0.6, mode: 'conifer' });
  const bamMat = fxMat(new THREE.MeshLambertMaterial({ map: bambooLeafTex, alphaTest: 0.4, side: THREE.DoubleSide }), 'bamL', { sway: { amp: 0.09, speed: 1.2, wexpr: 'max(position.y-2.0,0.0)*0.1' }, backlight: 0.5, mode: 'conifer' });
  const culmTex = canvasTex(32, 256, (c, w, h) => { c.fillStyle = '#7f8a3a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 40) { c.fillStyle = 'rgba(50,50,20,0.6)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(220,220,160,0.4)'; c.fillRect(0, y + 3, w, 2); } }, true);
  culmTex.repeat.set(1, 6);
  const culmMat = fxMat(new THREE.MeshLambertMaterial({ map: culmTex }), 'culm', { sway: { amp: 0.06, speed: 1.2, wexpr: 'max(position.y-2.0,0.0)*0.1' }, mode: 'conifer' });

  /* kelapa: batang melengkung, 14 pelepah melengkung turun, buah di ketiak pelepah */
  const palmVar = seed => {
    const rr = mulberry32(seed), lean = 0.6 + rr() * 1.6, H = 7 + rr() * 3, acc = new TubeAcc();
    const pts = [V3(0, -0.3, 0), V3(lean * 0.15, H * 0.35, 0), V3(lean * 0.55, H * 0.72, 0), V3(lean, H, 0)];
    acc.tube(pts, 0.2, 0.13, 8, 10);
    const top = pts[3], fr = [];
    for (let k = 0; k < 14; k++) {
      const yaw = k / 14 * 6.283 + rr() * 0.3, pitch = 0.75 - (k % 3) * 0.35 - rr() * 0.25, Lf = 3.2 + rr() * 1.2, droop = 0.9 + rr() * 0.6;
      const g = grid(12, 2, (s, v) => {
        const wd = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.03)), 0.6), side = (v - 0.5) * 2;
        const along = s * Lf, x = along * Math.cos(pitch), y = along * Math.sin(pitch) - droop * s * s * Lf * 0.55 + Math.abs(side) * -0.08 * wd;
        return [x, y, side * wd];
      });
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)); g.translate(top.x, top.y, top.z); fr.push({ g, m: new THREE.Matrix4(), c: [1, 1, 1] });
    }
    const nuts = [];
    for (let k = 0; k < 6; k++) { const a = k * 1.1, m = new THREE.Matrix4().compose(V3(top.x + Math.cos(a) * 0.22, top.y - 0.25 - (k % 2) * 0.12, Math.sin(a) * 0.22), QI, V3(0.15, 0.17, 0.15)); nuts.push({ g: new THREE.IcosahedronGeometry(1, 1), m, c: [0.42, 0.45, 0.16] }); }
    return { trunk: acc.geo(), fr: mergeG(fr), nuts: mergeG(nuts) };
  };
  /* pisang: batang semu dan 7 daun lebar */
  const bananaVar = seed => {
    const rr = mulberry32(seed), H = 1.8 + rr() * 0.8, items = [];
    for (let k = 0; k < 7; k++) {
      const yaw = k * 2.4 + rr() * 0.4, pitch = 0.9 - rr() * 0.5, Lf = 1.8 + rr() * 0.8;
      const g = grid(8, 2, (s, v) => { const along = s * Lf, side = (v - 0.5) * 2; return [along * Math.cos(pitch) * 0.9, along * Math.sin(pitch) - s * s * Lf * 0.7 + Math.abs(side) * 0.05, side * 0.36]; });
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)); g.translate(0, H - 0.1 * k * 0.3, 0); items.push({ g, m: new THREE.Matrix4(), c: [1, 1, 1] });
    }
    const stem = new THREE.CylinderGeometry(0.1, 0.16, H, 8); stem.translate(0, H / 2, 0);
    return { leaves: mergeG(items), stem };
  };
  /* rumpun bambu: 14 batang melengkung keluar + kartu daun di bagian atas */
  const bambooVar = seed => {
    const rr = mulberry32(seed), acc = new TubeAcc(), cards = [];
    for (let k = 0; k < 14; k++) {
      const a = rr() * 6.283, out = 1 + rr() * 2.4, H = 6 + rr() * 4, b = V3(Math.cos(a) * 0.4 * rr(), 0, Math.sin(a) * 0.4 * rr());
      const pts = [b.clone().setY(-0.2), V3(b.x + Math.cos(a) * out * 0.15, H * 0.45, b.z + Math.sin(a) * out * 0.15), V3(b.x + Math.cos(a) * out * 0.55, H * 0.85, b.z + Math.sin(a) * out * 0.55), V3(b.x + Math.cos(a) * out, H, b.z + Math.sin(a) * out)];
      acc.tube(pts, 0.05, 0.02, 5, 6);
      const cur = new THREE.CatmullRomCurve3(pts);
      for (let j = 0; j < 7; j++) { const p = cur.getPoint(0.5 + j * 0.075), s = 0.9 + rr() * 0.8; cards.push({ g: new THREE.PlaneGeometry(1.4, 1.4), m: new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 6, rr() * 6, rr() * 6)), V3(s, s, s)), c: [1, 1, 1] }); }
    }
    return { culms: acc.geo(), leaves: mergeG(cards) };
  };
  const place = (n, adMin, adMax, minH, list) => {
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const z = -20 + r() * 270, s = r() < 0.5 ? -1 : 1;
      if (!freeZ(z, 2)) continue;
      const p = bankPt(z, s, adMin + Math.pow(r(), 1.4) * (adMax - adMin));
      if (p.y < minH) continue;
      const sc = 0.85 + r() * 0.35; list.push({ p: p.setY(p.y - 0.1), q: qy(r() * 6.283), s: V3(sc, sc, sc), c: [1, 1, 1] }); i++;
    }
    return list;
  };
  const NP = LITE ? 26 : 56, NB = LITE ? 30 : 70, NBm = LITE ? 14 : 30;
  [0, 1, 2].forEach(v => {
    const pv = palmVar(400 + v * 7), list = place(Math.round(NP / 3), 0.6, 18, 0.15, []);
    /* kelapa condong ke arah sungai */
    list.forEach(o => { o.q = qy(o.p.x < cx(o.p.z) ? 0 : Math.PI).multiply(qy((r() - 0.5) * 0.8)); });
    const t = inst(pv.trunk, trunkMat, list); t.castShadow = true; t.receiveShadow = true; out.add(t);
    const f = inst(pv.fr, frondMat, list); f.castShadow = true; out.add(f);
    f.customDepthMaterial = fxMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frondTex, alphaTest: 0.45 }), 'palmFD', {});
    out.add(inst(pv.nuts, fxMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'nut', {}), list));
  });
  [0, 1].forEach(v => {
    const bv = bananaVar(500 + v * 11), list = place(Math.round(NB / 2), 1.2, 14, 0.2, []);
    const st = inst(bv.stem, fxMat(new THREE.MeshLambertMaterial({ color: 0x6f8a3c }), 'banS', { mode: 'conifer' }), list); st.castShadow = true; out.add(st);
    const lv = inst(bv.leaves, banMat, list); lv.castShadow = true; out.add(lv);
    lv.customDepthMaterial = fxMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: bananaTex, alphaTest: 0.45 }), 'banLD', {});
  });
  [0, 1].forEach(v => {
    const bv = bambooVar(600 + v * 13), list = place(Math.round(NBm / 2), 1.5, 26, 0.2, []);
    const c = inst(bv.culms, culmMat, list); c.castShadow = true; out.add(c);
    const l = inst(bv.leaves, bamMat, list); l.castShadow = true; out.add(l);
    l.customDepthMaterial = fxMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: bambooLeafTex, alphaTest: 0.4 }), 'bamLD', {});
  });
  return out;
}

/* ====== Rumah panggung, sampan tertambat, penjor ====== */
function buildVillage() {
  const out = new THREE.Group(), r = mulberry32(707);
  const plankTex = canvasTex(128, 128, (c, w, h) => {
    const rr = mulberry32(3); for (let x = 0; x < w; x += 16) { const k = 0.75 + rr() * 0.4; c.fillStyle = `rgb(${120 * k | 0},${84 * k | 0},${52 * k | 0})`; c.fillRect(x, 0, 16, h); c.fillStyle = 'rgba(20,10,4,0.6)'; c.fillRect(x, 0, 2, h);
      for (let i = 0; i < 8; i++) { c.strokeStyle = 'rgba(40,20,8,0.25)'; const xx = x + 3 + rr() * 11; c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx + (rr() - 0.5) * 3, h); c.stroke(); } }
  }, true);
  const thatchTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#6b5530'; c.fillRect(0, 0, w, h); const rr = mulberry32(5);
    for (let y = 0; y < h; y += 10) for (let i = 0; i < 60; i++) { const x = rr() * w; c.strokeStyle = `rgba(${rr() < 0.5 ? '50,38,18' : '190,160,100'},${0.3 + rr() * 0.4})`; c.lineWidth = 1 + rr(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rr() - 0.5) * 2, y + 14); c.stroke(); }
  }, true);
  const wallM = weatherMat(new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }), 'vWall', { wet: 0.4, moss: 0.3 });
  const thatchM = new THREE.MeshStandardMaterial({ map: thatchTex, bumpMap: thatchTex, bumpScale: 2, roughness: 1, side: THREE.DoubleSide });
  const postM = weatherMat(new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }), 'vPost', { wet: 1.0, moss: 0.6 });
  const box = (g, w, h, d, x, y, z, m, ry) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (ry) b.rotation.y = ry; g.add(b); return b; };
  const glowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,210,140,1)'); g.addColorStop(0.35, 'rgba(255,150,60,0.35)'); g.addColorStop(1, 'rgba(255,110,30,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const hut = (z, side, off) => {
    const p = bankPt(z, side, off), g = new THREE.Group(); g.position.copy(p); g.position.y = Math.max(p.y, 0) ; g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; out.add(g);
    const W = 4.2, D = 3.4, F = 1.5, Hh = 2.2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, F + 1.2, 6), postM); s.position.set(-W / 2 + 0.2 + i * (W - 0.4) / 2, F / 2 - 0.6, -D / 2 + 0.2 + j * (D - 0.4)); g.add(s); }
    box(g, W + 1.2, 0.12, D + 0.2, 0.6, F, 0, wallM);
    const walls = box(g, W, Hh, D, 0, F + Hh / 2, 0, wallM);
    box(g, 0.9, 1.5, 0.06, 0.6, F + 0.75, D / 2 + 0.01, new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 }));          // pintu
    [-1.3, 1.6].forEach(x => { box(g, 0.7, 0.55, 0.06, x, F + 1.35, D / 2 + 0.01, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.85, 0.45) })); });   // jendela berlampu
    const roof = new THREE.Shape(); roof.moveTo(-D / 2 - 0.8, 0); roof.lineTo(0, 1.9); roof.lineTo(D / 2 + 0.8, 0);
    [-1, 1].forEach(s => {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.4, Math.hypot(D / 2 + 0.8, 1.9)), thatchM);
      const ang = Math.atan2(1.9, D / 2 + 0.8); pl.position.set(0, F + Hh + 0.95, s * (D / 2 + 0.8) / 2); pl.rotation.set(-s * (Math.PI / 2 - ang), 0, 0); g.add(pl);
    });
    [-1, 1].forEach(s => { const gab = new THREE.Mesh(new THREE.ShapeGeometry(roof), wallM); gab.position.set(s * W / 2, F + Hh, 0); gab.rotation.y = Math.PI / 2; g.add(gab); });
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, W + 1.6, 6), postM); ridge.rotation.z = Math.PI / 2; ridge.position.set(0, F + Hh + 1.92, 0); g.add(ridge);
    for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.18), wallM); st.position.set(W / 2 + 0.75, F - k * 0.26, D / 2 - 0.4 - k * 0.0); g.add(st); }   // tangga
    const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); lg.position.set(-1.3, F + 1.35, D / 2 + 0.5); lg.scale.set(1.4, 1.4, 1); g.add(lg);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    void walls;
  };
  [[104, -1, 4.5], [122, 1, 5], [84, 1, 6], [60, -1, 5], [162, -1, 5], [176, 1, 6]].forEach(h => { if (freeZ(h[0], 1)) hut(h[0], h[1], h[2]); });

  /* sampan kecil tertambat di tepian */
  const hullTex = canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a6a9a'; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5); c.fillStyle = '#b3261e'; c.fillRect(0, 5, w, 3); c.fillRect(0, h - 8, w, 3); }, false);
  const sampanG = grid(24, 12, (u, v) => {
    const a = Math.abs(2 * u - 1), t = v * 2 - 1, bg = 0.38 * Math.sqrt(Math.max(1 - Math.pow(a, 2.2), 0)) + 0.015, yb = -0.12 + 0.2 * Math.pow(a, 2), gy = 0.2 + 0.18 * Math.pow(a, 3), s = Math.abs(t);
    return [t * bg * (0.7 + 0.3 * s), yb + (gy - yb) * Math.pow(s, 3), (u - 0.5) * 3.4];
  });
  const sampanM = new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.7, side: THREE.DoubleSide });
  const ropeM = new THREE.MeshStandardMaterial({ color: 0x9c8a60, roughness: 1 });
  const sampans = [];
  [[70, 1], [100, -1], [113, 1], [128, -1], [56, -1]].forEach((q, i) => {
    if (!freeZ(q[0], 1)) return;
    const z = q[0], s = q[1], x = cx(z) + s * (shoreAd(z) - 1.1), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = cxd(z) + (r() - 0.5) * 0.5; out.add(g);
    g.add(new THREE.Mesh(sampanG, sampanM));
    const paddle = new Seg(0.02, 0.02, ropeM, 5); paddle.set(V3(-0.15, 0.15, -0.8), V3(0.2, 0.25, 0.8)); g.add(paddle.m);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), postM); post.position.set(x + s * 1.3, 0.3, z + 1.4); out.add(post);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(x, 0.25, z + 1.6), V3(x + s * 0.7, 0.05, z + 1.6), V3(x + s * 1.3, 0.8, z + 1.4)]), 12, 0.012, 4), ropeM); out.add(rope);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    sampans.push({ g, ph: i * 1.7 });
  });

  /* penjor: bambu melengkung berhias janur di kedua sisi jalan menuju gerbang */
  const janur = new THREE.MeshStandardMaterial({ color: 0xe9d27a, roughness: 0.7, side: THREE.DoubleSide });
  const bambooM = new THREE.MeshStandardMaterial({ color: 0x9a9046, roughness: 0.6 });
  [GATE.z - 12, GATE.z - 21, GATE.z - 30].forEach(z => [-1, 1].forEach(s => {
    const b = bankPt(z, s, 1.2), acc = new TubeAcc(), tipOut = -s * 3.2, H = 7.5;
    const pts = [V3(b.x, b.y - 0.3, z), V3(b.x, b.y + H * 0.55, z), V3(b.x + tipOut * 0.45, b.y + H * 0.95, z), V3(b.x + tipOut, b.y + H * 0.82, z)];
    acc.tube(pts, 0.08, 0.025, 6, 16);
    const m = new THREE.Mesh(acc.geo(), bambooM); m.castShadow = true; out.add(m);
    const cur = new THREE.CatmullRomCurve3(pts);
    for (let k = 0; k < 9; k++) {                                                         // rumbai janur sepanjang lengkung
      const p = cur.getPoint(0.4 + k * 0.065), len = 0.6 + (k % 3) * 0.25;
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), janur); fr.position.set(p.x, p.y - len / 2, p.z); fr.rotation.y = r() * 3; out.add(fr);
    }
    const tip = cur.getPoint(1), sam = new THREE.Group(); sam.position.set(tip.x, tip.y - 0.1, tip.z); out.add(sam);   // sampian di ujung
    for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.9 + (k % 2) * 0.3), janur); f.position.y = -0.5; f.rotation.y = k * 0.4; f.rotation.z = (k - 4) * 0.08; sam.add(f); }
    const orn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xc9402c, roughness: 0.6 })); orn.position.y = 0.05; orn.rotation.x = Math.PI; sam.add(orn);
  }));
  bakeStatic(out, sampans.map(s => s.g));
  function update(t) {
    sampans.forEach(s => { s.g.position.y = 0.025 * Math.sin(t * 1.3 + s.ph); s.g.rotation.z = 0.03 * Math.sin(t * 0.9 + s.ph); });
  }
  return { group: out, update };
}

/* ====== Makhluk hidup: kuntul, kupu-kupu, capung, bebek, teratai, warga tepian ====== */
function buildLife() {
  const out = new THREE.Group(), r = mulberry32(909), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sv = new THREE.Vector3();
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));

  /* teratai: daun bulat bertakik dan bunga merah muda di dekat tepian */
  const padTex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#3f6b2a'; c.beginPath(); c.moveTo(32, 32); c.arc(32, 32, 30, 0.25, Math.PI * 2 - 0.05); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(150,190,90,0.5)'; c.lineWidth = 1; for (let k = 0; k < 12; k++) { const a = 0.25 + k * 0.5; c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); c.stroke(); }
  });
  const pads = [], flowers = [];
  for (let i = 0; i < (LITE ? 110 : 240); i++) {
    const z = -10 + r() * 230, s = r() < 0.5 ? -1 : 1; if (!freeZ(z, 0)) continue;
    const ad = shoreAd(z) - 0.6 - Math.pow(r(), 1.5) * 3.2, x = cx(z) + s * ad, sc = 0.3 + r() * 0.35;
    pads.push({ p: V3(x, 0.025 + r() * 0.01, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, r() * 6.28)), s: V3(sc, sc, sc) });
    if (r() < 0.2) flowers.push({ p: V3(x + 0.1, 0.03, z + 0.1), q: qy(r() * 6.28), s: V3(1, 1, 1).multiplyScalar(0.8 + r() * 0.5) });
  }
  out.add(inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: padTex, alphaTest: 0.5, side: THREE.DoubleSide }), pads));
  const lotus = []; for (let k = 0; k < 10; k++) {
    const a = k / 10 * 6.283, inner = k % 2, g = new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(0.45, 1.3, 0.25);
    lotus.push({ g, m: new THREE.Matrix4().compose(V3(Math.cos(a) * 0.05, 0.02, Math.sin(a) * 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, inner ? 0.25 : 0.6, 'YXZ')), V3(1, 1, 1)), c: inner ? [0.98, 0.78, 0.84] : [0.95, 0.55, 0.68] });
  }
  lotus.push({ g: new THREE.SphereGeometry(0.03, 8, 6), m: new THREE.Matrix4().makeTranslation(0, 0.06, 0), c: [0.95, 0.8, 0.3] });
  out.add(inst(mergeG(lotus), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new THREE.Color(0.08, 0.03, 0.04) }), flowers));

  /* bebek berenang berkelompok di dekat tepian */
  const ducks = [];
  for (let gI = 0; gI < (LITE ? 4 : 7); gI++) {
    let z = 30 + r() * 170; if (!freeZ(z, 2)) z += 16; const s = r() < 0.5 ? -1 : 1, n = 3 + (r() * 3 | 0);
    for (let k = 0; k < n; k++) ducks.push({ z0: z, s, off: 1.2 + r() * 2.2, ph: r() * 6.28, k, sp: 0.25 + r() * 0.15, dz: -k * 0.9 - r() * 0.4 });
  }
  const duckBody = new THREE.SphereGeometry(1, 12, 8); duckBody.scale(0.17, 0.12, 0.28);
  const duckHead = new THREE.SphereGeometry(0.075, 10, 8), duckBill = new THREE.ConeGeometry(0.03, 0.09, 6); duckBill.rotateX(Math.PI / 2);
  const dB = new THREE.InstancedMesh(duckBody, std(0xf3efe6), ducks.length), dH = new THREE.InstancedMesh(duckHead, std(0xf3efe6), ducks.length), dK = new THREE.InstancedMesh(duckBill, std(0xe39a2a), ducks.length);
  [dB, dH, dK].forEach(m => { m.castShadow = true; m.frustumCulled = false; out.add(m); });

  /* kawanan kuntul putih melayang tinggi di atas sungai di depan perahu */
  const birds = [];
  for (let i = 0; i < (LITE ? 9 : 16); i++) birds.push({ i, ph: r() * 6.28, off: V3((r() - 0.5) * 10, (r() - 0.5) * 3, (r() - 0.5) * 12), fl: 3 + r() * 2 });
  const bBody = new THREE.SphereGeometry(1, 8, 6); bBody.scale(0.08, 0.08, 0.32);
  const wingG = new THREE.PlaneGeometry(0.62, 0.2); wingG.translate(0.31, 0, 0); wingG.rotateX(-Math.PI / 2);
  const wmat = std(0xf6f4ee, { side: THREE.DoubleSide, roughness: 0.9 });
  const bb = new THREE.InstancedMesh(bBody, wmat, birds.length), bwL = new THREE.InstancedMesh(wingG, wmat, birds.length), bwR = new THREE.InstancedMesh(wingG, wmat, birds.length);
  [bb, bwL, bwR].forEach(m => { m.frustumCulled = false; out.add(m); });

  /* kupu-kupu (bersayap warna-warni) di atas rerumputan tepian, capung di atas air */
  const NBF = LITE ? 18 : 36, bfl = [];
  const bfTex = canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(36, 22, 26, 18, -0.3, 0, 6.283); c.fill(); c.beginPath(); c.ellipse(30, 46, 16, 14, 0.4, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.beginPath(); c.ellipse(36, 22, 26, 18, -0.3, 0, 6.283); c.stroke();
    c.beginPath(); c.arc(46, 18, 4, 0, 6.283); c.fill(); c.beginPath(); c.arc(34, 48, 3, 0, 6.283); c.fill();
  });
  const bfG = new THREE.PlaneGeometry(0.16, 0.16); bfG.translate(0.08, 0, 0); bfG.rotateX(-Math.PI / 2);
  const bfMat = new THREE.MeshLambertMaterial({ map: bfTex, alphaTest: 0.5, side: THREE.DoubleSide });
  const bL = new THREE.InstancedMesh(bfG, bfMat, NBF), bR = new THREE.InstancedMesh(bfG, bfMat, NBF);
  const palette = [[1, 0.75, 0.15], [0.95, 0.95, 0.9], [0.3, 0.55, 1], [1, 0.45, 0.2], [0.9, 0.35, 0.6]], cc = new THREE.Color();
  for (let i = 0; i < NBF; i++) {
    const c = palette[i % palette.length]; cc.setRGB(c[0], c[1], c[2]); bL.setColorAt(i, cc); bR.setColorAt(i, cc);
    bfl.push({ s: r() < 0.5 ? -1 : 1, zo: r() * 60 - 10, off: 0.5 + r() * 6, ph: r() * 6.28, sp: 0.6 + r() * 0.8, h: 0.5 + r() * 1.2, dragon: i % 4 === 0 });
  }
  [bL, bR].forEach(m => { m.frustumCulled = false; out.add(m); });

  /* warga di tepian: pemancing duduk, ibu mencuci di batu, anak-anak melambai */
  const folks = [];
  const C = PK.cloth, PL = PK.plain;
  const folk = (z, side, off, o, kind) => {
    if (!freeZ(z, 0)) return;
    const p = PK.body(o), b = bankPt(z, side, off); p.g.position.set(b.x, Math.max(b.y, 0.02), z);
    p.g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; p.g.rotation.y += (r() - 0.5) * 0.4; out.add(p.g);
    Object.assign(p, { kind, ph: r() * 6.28, side }); folks.push(p);
    if (kind === 'fish') {
      const rod = new Seg(0.012, 0.005, PL([0.55, 0.45, 0.25], 0.6), 5); rod.set(V3(0.15, 0.62, 0.3), V3(0.3, 2.3, 3.2)); p.g.add(rod.m); p.rod = rod;
      const line = new Seg(0.002, 0.002, PL([0.9, 0.9, 0.9]), 3); line.set(V3(0.3, 2.3, 3.2), V3(0.3, -0.2, 3.7)); p.g.add(line.m);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), PL([0.4, 0.4, 0.37], 0.95)); rock.scale.set(1.2, 0.6, 1); rock.position.set(0, 0.1, 0); p.g.add(rock);
      const bucket = PK.lath([[0.12, 0], [0.15, 0.25], [0.16, 0.26]], PK.std({ map: PK.rep(PK.weave('#8a6a38', 4), 3, 1), side: THREE.DoubleSide }), 12); bucket.position.set(-0.45, 0.02, 0.15); p.g.add(bucket);
    }
    if (kind === 'wash') {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), PL([0.38, 0.38, 0.36], 0.6)); rock.scale.set(1.3, 0.35, 1); rock.position.set(0, 0.0, 0.6); p.g.add(rock);
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35, 4, 2), PK.cloth('kawung', '#2a4a8a', '#e8d090', '#10204a', 1, 1)); cl.rotation.x = -Math.PI / 2 + 0.2; cl.position.set(0, 0.2, 0.65); p.g.add(cl); p.cloth = cl;
      const basket = PK.lath([[0.18, 0], [0.24, 0.18], [0.25, 0.19]], PK.std({ map: PK.rep(PK.weave('#a08048', 6), 4, 1), side: THREE.DoubleSide }), 14); basket.position.set(0.55, 0.02, 0.0); p.g.add(basket);
    }
    return p;
  };
  folk(78, 1, 0.3, { skin: PK.SKIN.gelap, top: C('lurik', '#5a4a30', '#2a2010', '#c0a060', 2, 2), low: PL([0.1, 0.1, 0.1]), sarung: C('kotak', '#1f4a3a', '#7a2a20', '#d8c890', 2, 1), hat: 'caping', iket: true }, 'fish');
  folk(108, -1, 0.2, { female: true, skin: PK.SKIN.sawo, top: C('kawung', '#8a3a2a', '#e8c890', '#3a1a10', 2, 2), low: PL([0.2, 0.12, 0.08]), sarung: C('parang', '#3a2414', '#d8b07a', '#120a06', 3, 1), hat: 'tanggui' }, 'wash');
  folk(116, 1, 1.4, { skin: PK.SKIN.sawo, top: PL([0.95, 0.75, 0.2]), low: PL([0.2, 0.3, 0.6]) }, 'kid');
  folk(117.2, 1, 2.1, { skin: PK.SKIN.sawo, top: PL([0.9, 0.3, 0.35]), low: PL([0.2, 0.2, 0.25]), female: false }, 'kid');
  folk(132, -1, 0.4, { skin: PK.SKIN.sawo, top: C('parang', '#e8d6b0', '#2a3a6a', '#7a2a18', 2, 2), low: PL([0.1, 0.1, 0.12]), longPants: true, hat: 'caping' }, 'fish');
  folk(58, 1, 0.5, { skin: PK.SKIN.gelap, top: PL([0.3, 0.45, 0.35]), low: PL([0.1, 0.1, 0.1]), sarung: C('kotak', '#6a2a2a', '#2a3a5a', '#e0d090', 2, 1), hat: 'caping' }, 'fish');
  folks.forEach(f => { if (f.kind === 'kid') f.g.scale.setScalar(0.62); });

  const HL = V3(), HR = V3(), FL = V3(), FR = V3(), sitHint = [V3(0, 0.6, 1), V3(0, 0.6, 1)];
  function update(t, dt, bx, bz) {
    /* bebek */
    ducks.forEach((d, i) => {
      const z = d.z0 + d.dz + Math.sin(t * 0.06 * d.sp + d.ph) * 6, x = cx(z) + d.s * (shoreAd(z) - d.off - 0.4 * Math.sin(t * 0.2 + d.k)), dir = Math.cos(t * 0.06 * d.sp + d.ph) >= 0 ? 0 : Math.PI;
      const yaw = Math.atan(cxd(z)) + dir + 0.3 * Math.sin(t * 0.5 + d.ph), bob = 0.012 * Math.sin(t * 2.4 + d.ph);
      Q.setFromEuler(E.set(0, yaw, 0)); P.set(x, 0.06 + bob, z); M.compose(P, Q, Sv.set(1, 1, 1)); dB.setMatrixAt(i, M);
      const fx = Math.sin(yaw), fz = Math.cos(yaw), dip = Math.max(0, Math.sin(t * 0.7 + d.ph * 3)) > 0.97 ? 0.1 : 0;
      P.set(x + fx * 0.22, 0.2 + bob - dip, z + fz * 0.22); M.compose(P, Q, Sv.set(1, 1, 1)); dH.setMatrixAt(i, M);
      P.set(x + fx * 0.31, 0.19 + bob - dip, z + fz * 0.31); M.compose(P, Q, Sv.set(1, 1, 1)); dK.setMatrixAt(i, M);
    });
    dB.instanceMatrix.needsUpdate = dH.instanceMatrix.needsUpdate = dK.instanceMatrix.needsUpdate = true;
    /* kuntul: berputar pelan di depan perahu, mengepak lalu melayang */
    const cz = bz + 34, cxz = cx(cz);
    birds.forEach((b, i) => {
      const a = t * 0.12 + i * 0.05, rad = 14, px = cxz + Math.cos(a) * rad + b.off.x, pz = cz + Math.sin(a) * rad * 0.7 + b.off.z, py = 13 + b.off.y + Math.sin(t * 0.4 + b.ph) * 0.6;
      const yaw = Math.atan2(-Math.sin(a), Math.cos(a) * 0.7);
      const flapOn = Math.sin(t * 0.35 + b.ph) > -0.2, wa = flapOn ? Math.sin(t * b.fl * 2 + b.ph) * 0.65 : 0.08;
      Q.setFromEuler(E.set(0, yaw, -0.25 * Math.cos(a))); P.set(px, py, pz); M.compose(P, Q, Sv.set(1, 1, 1)); bb.setMatrixAt(i, M);
      const qL = new THREE.Quaternion().setFromEuler(E.set(0, 0, wa)), qR = new THREE.Quaternion().setFromEuler(E.set(0, Math.PI, wa));
      M.compose(P, Q.clone().multiply(qL), Sv.set(1, 1, 1)); bwL.setMatrixAt(i, M); M.compose(P, Q.clone().multiply(qR), Sv); bwR.setMatrixAt(i, M);
    });
    bb.instanceMatrix.needsUpdate = bwL.instanceMatrix.needsUpdate = bwR.instanceMatrix.needsUpdate = true;
    /* kupu-kupu dan capung bergerak di sekitar perahu (dibungkus ulang ke depan seperti partikel kelopak) */
    bfl.forEach((f, i) => {
      const R = 70, z0 = bz - 18, z = z0 + (((f.zo + t * f.sp * 0.4 - z0) % R) + R) % R + Math.sin(t * 0.7 + f.ph) * 1.5;
      const x = cx(z) + f.s * (shoreAd(z) + (f.dragon ? -1.5 - f.off * 0.3 : f.off)) + Math.sin(t * 1.3 + f.ph) * 0.8;
      const y = (f.dragon ? 0.5 + 0.15 * Math.sin(t * 3 + f.ph) : Math.max(terrainH(x, z), 0) + f.h + 0.3 * Math.sin(t * 2.1 + f.ph));
      const yaw = Math.sin(t * 0.9 + f.ph) * 2 + f.ph, wa = f.dragon ? 0.15 * Math.sin(t * 60 + i) : 0.2 + 1.1 * Math.abs(Math.sin(t * 9 + f.ph));
      P.set(x, y, z); const qb = new THREE.Quaternion().setFromEuler(E.set(0, yaw, 0));
      const sc = f.dragon ? 0.8 : 1;
      M.compose(P, qb.clone().multiply(new THREE.Quaternion().setFromEuler(E.set(0, 0, wa))), Sv.set(sc, sc, f.dragon ? 0.35 : sc)); bL.setMatrixAt(i, M);
      M.compose(P, qb.clone().multiply(new THREE.Quaternion().setFromEuler(E.set(0, Math.PI, wa))), Sv); bR.setMatrixAt(i, M);
    });
    bL.instanceMatrix.needsUpdate = bR.instanceMatrix.needsUpdate = true;
    /* warga */
    folks.forEach((p, n) => {
      const near = sstep(26, 10, Math.hypot(bx - p.g.position.x, bz - p.g.position.z));
      FL.set(-0.12, 0, 0.05); FR.set(0.12, 0, 0.05); HL.set(-0.24, 0.84, 0.06); HR.set(0.24, 0.84, 0.06);
      p.torso.rotation.set(0, 0, 0); p.torso.position.y = p.HIP;
      let hint = null;
      if (p.kind === 'fish') {                                // duduk di batu, memegang joran
        p.torso.position.y = 0.42; p.torso.rotation.x = 0.15;
        FL.set(-0.14, 0, 0.42); FR.set(0.14, 0, 0.45); hint = sitHint;
        HL.set(-0.05, 0.62, 0.32); HR.set(0.15, 0.62, 0.3);
        p.rod.set(V3(0.15, 0.62, 0.3), V3(0.3, 2.3 + 0.05 * Math.sin(t * 1.2 + n), 3.2));
        if (near > 0.5) { HL.set(-0.3, 1.25 + 0.08 * Math.sin(t * 6), 0.1); }
      } else if (p.kind === 'wash') {                         // jongkok, menggosok kain di batu
        p.torso.position.y = 0.38; p.torso.rotation.x = 0.55; hint = sitHint;
        FL.set(-0.16, 0, 0.12); FR.set(0.16, 0, 0.14);
        const rub = Math.sin(t * 3.2 + n) * 0.1; HL.set(-0.12, 0.25, 0.6 + rub); HR.set(0.12, 0.25, 0.6 - rub);
        if (p.cloth) p.cloth.position.z = 0.65 + rub * 0.5;
      } else if (p.kind === 'kid') {                          // melompat dan melambai saat perahu lewat
        const j = Math.abs(Math.sin(t * 4.5 + n)) * 0.18 * near;
        p.g.position.y = Math.max(terrainH(p.g.position.x, p.g.position.z), 0.02) + j;
        HR.lerp(V3(0.3, 1.62 + 0.1 * Math.sin(t * 8 + n), 0.12), Math.max(near, 0.15)); HL.lerp(V3(-0.3, 1.55 + 0.1 * Math.sin(t * 8 + 2), 0.1), near);
        const want = Math.atan2(bx - p.g.position.x, bz - p.g.position.z); let df = want - p.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); p.g.rotation.y += df * (1 - Math.exp(-dt * 1.5));
      }
      p.head.rotation.y = 0.15 * Math.sin(t * 0.5 + n);
      p.pose([HL, HR], [FL, FR], null, hint);
    });
  }
  out.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: out, update };
}
