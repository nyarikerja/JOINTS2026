/* ---------- Perahu sungai (wasen/yakatabune): lambung berpapan, atap anyaman, lentera, juru dayung, penumpang ---------- */
function buildBoat() {
  const boat = new THREE.Group(), body = new THREE.Group(); boat.add(body);
  const LEN = 5.2, HL = LEN / 2, TH = 0.03;

  /* ====== Geometri lambung. a: 0 di tengah, 1 di ujung. Garis air di y=0. ====== */
  const Bg = a => 0.56 * Math.sqrt(Math.max(1 - Math.pow(a, 2.6), 0)) + 0.025;   // setengah lebar gunwale
  const Gy = a => 0.27 + 0.4 * Math.pow(a, 2.8);                                   // tinggi gunwale (ujung melengkung naik)
  const Yb = a => -0.2 + 0.3 * Math.pow(a, 2.2);                                   // dasar lambung (naik ke ujung)
  const aOf = z => Math.min(Math.abs(z) / HL, 1);
  const sec = (a, t, k) => {                                                       // penampang; k=1 sisi dalam
    const o = k ? TH : 0, bg = Math.max(Bg(a) - o, 0.004), yb = Yb(a) + o, gy = Gy(a) - (k ? 0.012 : 0), s = Math.abs(t);
    return [t * bg * (0.72 + 0.28 * Math.pow(s, 1.5)), yb + (gy - yb) * Math.pow(s, 5)];
  };
  const xAt = (z, y) => {                                                          // setengah lebar bagian dalam pada ketinggian y
    const a = aOf(z), bg = Math.max(Bg(a) - TH, 0.004), yb = Yb(a) + TH, gy = Gy(a) - 0.012;
    const s = Math.pow(clamp((y - yb) / (gy - yb), 0, 1), 0.2);
    return s * bg * (0.72 + 0.28 * Math.pow(s, 1.5));
  };
  const flT = z => Math.max(-0.125, Yb(aOf(z)) + 0.075);                           // permukaan lantai papan di z

  /* ====== Material ====== */
  const rep = (t, x, y) => { t.repeat.set(x, y); return t; };
  const std = o => rimMat(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide }, o)), 'rim');
  const plank = (base, seed, n) => canvasTex(512, 256, (c, w, h) => {
    const r = mulberry32(seed), bh = h / n;
    for (let i = 0; i < n; i++) {
      const k = 0.84 + 0.3 * r(); c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; c.fillRect(0, i * bh, w, bh);
      for (let j = 0; j < 16; j++) {
        c.strokeStyle = r() < 0.5 ? 'rgba(30,16,8,0.22)' : 'rgba(210,160,110,0.14)'; c.lineWidth = 0.6 + r() * 1.2;
        const y = i * bh + r() * bh; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 3, w * 0.6, y + (r() - 0.5) * 3, w, y + (r() - 0.5) * 2); c.stroke();
      }
      c.fillStyle = 'rgba(14,8,4,0.8)'; c.fillRect(0, i * bh, w, 2);
      c.fillStyle = 'rgba(14,8,4,0.55)'; for (let j = 0; j < 3; j++) c.fillRect(r() * w, i * bh + 2, 2, bh - 2);
    }
  }, true);
  const hullTex = rep(plank([138, 92, 56], 5, 12), 3, 1), inTex = rep(plank([172, 122, 78], 9, 12), 3, 1);
  const hullMat = std({ map: hullTex, bumpMap: hullTex, bumpScale: 1.5, vertexColors: true, roughness: 0.6 });
  const inMat = std({ map: inTex, bumpMap: inTex, bumpScale: 1.2, roughness: 0.8 });
  const floorTex = plank([196, 152, 102], 21, 1);
  const floorMat = std({ map: floorTex, bumpMap: floorTex, bumpScale: 1, roughness: 0.78 });
  const lacquer = std({ color: new THREE.Color(0.05, 0.04, 0.045), roughness: 0.28, metalness: 0.1 });
  const darkWood = std({ color: new THREE.Color(0.26, 0.17, 0.12), roughness: 0.8 });
  const bamboo = std({ color: new THREE.Color(0.62, 0.54, 0.28), roughness: 0.6 });

  const wetColor = (g, wet) => {                                                   // lambung bawah lebih gelap (basah)
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = sstep(-0.06, 0.06, p.getY(i)); for (let j = 0; j < 3; j++) c[i * 3 + j] = lerp(wet[j], 1, k); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  };
  body.add(new THREE.Mesh(wetColor(grid(72, 28, (u, v) => { const p = sec(Math.abs(2 * u - 1), v * 2 - 1, 0); return [p[0], p[1], (u - 0.5) * LEN]; }), [0.34, 0.3, 0.28]), hullMat));
  body.add(new THREE.Mesh(grid(72, 28, (u, v) => { const p = sec(Math.abs(2 * u - 1), v * 2 - 1, 1); return [p[0], p[1], (u - 0.5) * LEN]; }), inMat));

  const rail = (off, y0, r, mat) => [-1, 1].forEach(sd => {
    const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = Math.abs(2 * u - 1); pts.push(V3(sd * Math.max(Bg(a) - off, 0.004), Gy(a) + y0, (u - 0.5) * LEN)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 8), mat));
  });
  rail(0, 0, 0.034, lacquer); rail(0.05, -0.012, 0.014, darkWood);
  [-1, 1].forEach(e => {                                                            // tiang haluan/buritan melengkung
    const y0 = Gy(1), pts = [V3(0, y0 - 0.02, e * HL), V3(0, y0 + 0.09, e * (HL + 0.05)), V3(0, y0 + 0.22, e * (HL + 0.04)), V3(0, y0 + 0.34, e * (HL - 0.02))];
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 8), lacquer));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), lacquer); cap.position.copy(pts[3]); body.add(cap);
  });
  [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].forEach(z => {                                   // gading-gading
    const a = aOf(z), pts = []; for (let i = 0; i <= 16; i++) { const p = sec(a, i / 8 - 1, 1); pts.push(V3(p[0] * 0.995, p[1] + 0.004, z)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 6), darkWood));
  });
  for (let z = -2.3; z < 2.3; z += 0.15) {                                          // papan lantai mengikuti dasar
    const zc = z + 0.07, y = flT(zc), w = xAt(zc, y) * 2 - 0.012; if (w < 0.1) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.026, 0.138), floorMat); b.position.set(0, y - 0.013, zc); body.add(b);
  }
  [-1.25, 0.8, 1.6].forEach(z => {                                                  // balok pelintang
    const a = aOf(z), b = new THREE.Mesh(new THREE.BoxGeometry(2 * 0.92 * (Bg(a) - TH), 0.045, 0.09), darkWood); b.position.set(0, Gy(a) - 0.1, z); body.add(b);
  });

  /* ====== Atap anyaman ====== */
  const weave = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#6f562c'; c.fillRect(0, 0, w, h); const r = mulberry32(11), n = 16, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < 4; k++) {
      c.fillStyle = `rgb(${180 + r() * 45 | 0},${150 + r() * 40 | 0},${90 + r() * 30 | 0})`;
      if ((i + j) % 2) c.fillRect(i * s, j * s + k * s / 4 + 0.5, s - 1, s / 4 - 1); else c.fillRect(i * s + k * s / 4 + 0.5, j * s, s / 4 - 1, s - 1);
    }
  }, true);
  weave.repeat.set(6, 5);
  const CR = 0.6, CY = 0.5, CL = 1.8, CZ = -0.25, CB = 0.3;
  const canopy = new THREE.Mesh(grid(24, 28, (u, v) => { const a = v * Math.PI; return [Math.cos(a) * CR, Math.sin(a) * CY, (u - 0.5) * CL]; }),
    std({ map: weave, bumpMap: weave, bumpScale: 1.5, roughness: 0.9 }));
  canopy.position.set(0, CB, CZ); body.add(canopy);
  for (let i = 0; i < 7; i++) {
    const z = CZ + (i / 6 - 0.5) * CL, end = i === 0 || i === 6, pts = [];
    for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI; pts.push(V3(Math.cos(a) * (CR + 0.012), CB + Math.sin(a) * (CY + 0.012), z)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, end ? 0.03 : 0.02, 6), end ? lacquer : bamboo));
  }
  const ridge = new Seg(0.018, 0.018, bamboo, 6); ridge.set(V3(0, CB + CY + 0.012, CZ - CL / 2), V3(0, CB + CY + 0.012, CZ + CL / 2)); body.add(ridge.m);
  [-1, 1].forEach(sd => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, CL + 0.04), lacquer); r.position.set(sd * CR, CB - 0.01, CZ); body.add(r); });

  /* ====== Lentera haluan (chōchin) ====== */
  const LZ = 1.95, py0 = flT(LZ);
  const pole = new Seg(0.022, 0.016, darkWood); pole.set(V3(0, py0, LZ), V3(0, 1.32, LZ)); body.add(pole.m);
  const arm = new Seg(0.014, 0.014, darkWood, 6); arm.set(V3(0, 1.3, LZ), V3(0, 1.3, LZ + 0.2)); body.add(arm.m);
  const ribTex = canvasTex(64, 128, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(90,30,10,0.55)';
    for (let y = 6; y < h; y += 11) c.fillRect(0, y, w, 2);
    c.fillStyle = 'rgba(160,30,20,0.5)'; c.fillRect(0, h * 0.42, w, h * 0.16);
  }, true);
  const lanternMat = new THREE.MeshBasicMaterial({ map: ribTex, color: new THREE.Color(2.6, 1.6, 0.75) });
  const LY = 1.08, lp = [[0.001, -0.16], [0.07, -0.15], [0.11, -0.08], [0.125, 0], [0.11, 0.08], [0.07, 0.15], [0.001, 0.16]];
  const lantern = new THREE.Mesh(new THREE.LatheGeometry(lp.map(q => new THREE.Vector2(q[0], q[1])), 16), lanternMat); lantern.position.set(0, LY, LZ + 0.2); body.add(lantern);
  [-1, 1].forEach(s => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12), lacquer); cap.position.set(0, LY + s * 0.17, LZ + 0.2); body.add(cap); });
  const cord = new Seg(0.004, 0.004, darkWood, 4); cord.set(V3(0, 1.3, LZ + 0.2), V3(0, LY + 0.19, LZ + 0.2)); body.add(cord.m);
  const glowTex = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,200,130,0.9)'); g.addColorStop(0.35, 'rgba(255,150,70,0.3)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(0, LY, LZ + 0.2); glow.scale.set(1.5, 1.5, 1); body.add(glow);
  const lamp = new THREE.PointLight(0xffa060, 0.9, 8, 2); lamp.position.set(0, LY, LZ + 0.2); body.add(lamp);

  /* ====== Orang: tekstur dan helper ====== */
  const skinTex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#ecd6c6'; c.fillRect(0, 0, w, h); const r = mulberry32(2);
    for (let i = 0; i < 380; i++) { c.fillStyle = `rgba(${120 + r() * 40 | 0},${80 + r() * 30 | 0},60,${0.04 + 0.05 * r()})`; c.fillRect(r() * w, r() * h, 2, 2); }
  }, true);
  const skin = std({ color: new THREE.Color(0.8, 0.6, 0.48), map: skinTex, roughness: 0.7 });
  const skinPale = std({ color: new THREE.Color(0.95, 0.8, 0.72), map: skinTex, roughness: 0.65 });
  const indigoTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#1d2a4a'; c.fillRect(0, 0, w, h); const r = mulberry32(8);
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(200,210,230,${0.15 + r() * 0.3})`; const x = r() * w, y = r() * h; c.fillRect(x, y, 1.5, 4); c.fillRect(x - 1.5, y + 1.2, 4.5, 1.5); }
    for (let x = 0; x < w; x += 3) { c.fillStyle = 'rgba(8,12,30,0.18)'; c.fillRect(x, 0, 1, h); }
    c.strokeStyle = 'rgba(210,220,240,0.22)'; c.lineWidth = 1;                       // seigaiha di bagian bawah
    for (let rr = 4; rr <= 12; rr += 4) for (let x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + (rr % 8 ? 8 : 0), h - 6, rr, Math.PI, 0); c.stroke(); }
  }, true);
  const indigo = std({ map: rep(indigoTex, 3, 1), roughness: 0.92 });
  const strawTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#8a7240'; c.fillRect(0, 0, w, h); const r = mulberry32(13);
    for (let i = 0; i < 260; i++) { const x = r() * w; c.strokeStyle = `rgba(${r() < 0.5 ? '60,45,20' : '210,185,120'},${0.25 + r() * 0.4})`; c.lineWidth = 0.8 + r() * 1.4; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 6, h); c.stroke(); }
  }, true);
  const straw = std({ map: rep(strawTex, 4, 1), roughness: 1 });
  const hatTex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#cdb67c'; c.fillRect(0, 0, w, h); const r = mulberry32(14);
    for (let y = 0; y < h; y += 4) { c.fillStyle = `rgba(${r() < 0.5 ? '95,70,34' : '245,225,170'},${0.18 + 0.2 * r()})`; c.fillRect(0, y, w, 2); }
    for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(90,64,30,0.28)'; c.fillRect(x, 0, 1.5, h); }
  }, true);
  const hatMat = std({ map: hatTex, bumpMap: hatTex, bumpScale: 1, roughness: 0.9 });
  const hairMat = std({ color: new THREE.Color(0.035, 0.028, 0.04), roughness: 0.38 });
  const ropeMat = std({ color: new THREE.Color(0.72, 0.62, 0.42), roughness: 1 });
  const towelMat = std({ color: new THREE.Color(0.86, 0.9, 0.95), roughness: 0.95 });
  const darkMat = std({ color: new THREE.Color(0.04, 0.03, 0.03), roughness: 0.3 });
  const lipMat = std({ color: new THREE.Color(0.62, 0.16, 0.2), roughness: 0.5 });
  const kimTex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e6a3b8'); g.addColorStop(0.7, '#d27c95'); g.addColorStop(1, '#8c3a56');
    c.fillStyle = g; c.fillRect(0, 0, w, h); const r = mulberry32(17);
    for (let i = 0; i < 30; i++) {
      const x = r() * w, y = r() * h * 0.85, s = 5 + r() * 5; c.fillStyle = 'rgba(255,246,248,0.85)';
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.55, 0, 6.3); c.fill(); }
      c.fillStyle = '#d9a441'; c.beginPath(); c.arc(x, y, s * 0.28, 0, 6.3); c.fill();
    }
    c.fillStyle = 'rgba(214,170,76,0.55)'; c.fillRect(0, h * 0.93, w, 3);
  }, true);
  const kimono = std({ map: rep(kimTex, 2, 1), roughness: 0.75 });
  const obiTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#6b1624'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(214,170,76,0.75)'; c.lineWidth = 2;
    for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
  }, true);
  const obi = std({ map: rep(obiTex, 3, 1), roughness: 0.5 });
  const gold = std({ color: new THREE.Color(0.85, 0.7, 0.3), roughness: 0.4, metalness: 0.5 });
  const cushionMat = std({ color: new THREE.Color(0.42, 0.1, 0.18), roughness: 0.95 });

  const lath = (pts, seg, fold, sx, sz) => {
    const g = new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), seg || 18);
    if (fold) {
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), a = Math.atan2(z, x), k = 1 + fold * Math.sin(a * 7 + y * 11) * (0.5 + 0.5 * Math.sin(a * 3 + y * 5));
        pa.setXYZ(i, x * k, y, z * k);
      }
    }
    if (sx || sz) g.scale(sx || 1, 1, sz || 1);
    g.computeVertexNormals(); return g;
  };
  const ell = (r, sx, sy, sz, mat, seg) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 14, 10), mat); m.scale.set(sx, sy, sz); return m; };
  const tube = (pts, r, mat, n) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n || 16, r, 6), mat);
  const sleeve = mat => new THREE.Mesh(grid(10, 14, (u, v) => {                     // lengan furisode menjuntai
    const th = u * Math.PI * 2, e = v > 0.88 ? Math.sqrt(Math.max(1 - Math.pow((v - 0.88) / 0.12, 2), 0)) : 1, f = 1 + 0.25 * v;
    return [Math.cos(th) * 0.045 * f * e, -0.46 * v, Math.sin(th) * 0.115 * (0.45 + 0.55 * v) * e];
  }), mat);

  /* ====== Juru dayung: hanten indigo, mino jerami, kasa, kaki IK, berdiri di lantai buritan ====== */
  const ZB = -1.78, fy = z => flT(z) + 0.024, HIP = (fy(ZB - 0.2) + fy(ZB + 0.14)) / 2 + 0.92;
  const torso = new THREE.Group(); body.add(torso);
  torso.add(new THREE.Mesh(lath([[0.001, -0.1], [0.19, -0.1], [0.178, -0.02], [0.158, 0.06], [0.15, 0.17], [0.142, 0.28], [0.165, 0.4], [0.185, 0.49], [0.168, 0.57], [0.095, 0.6], [0.001, 0.61]], 28, 0.012, 1.12, 0.78), indigo));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.017, 6, 24), ropeMat); belt.rotation.x = Math.PI / 2; belt.position.y = 0.07; belt.scale.set(1.12, 0.78, 1); torso.add(belt);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.16 + 0.02 * i, 0.235 + 0.045 * i, 0.15, 24, 1, true), straw);
    ring.position.y = 0.52 - 0.1 * i; ring.position.z = -0.03; ring.scale.z = 0.85; ring.rotation.x = 0.08; torso.add(ring);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.15, 10), skin); neck.position.y = 0.66; torso.add(neck);
  const towel = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.02, 6, 16), towelMat); towel.rotation.x = Math.PI / 2; towel.position.y = 0.62; torso.add(towel);
  const head = new THREE.Group(); head.position.y = 0.8; torso.add(head);
  head.add(ell(0.1, 0.92, 1.12, 1.0, skin, 20));
  const jaw = ell(0.07, 1, 0.8, 1, skin, 14); jaw.position.set(0, -0.055, 0.025); head.add(jaw);
  [-1, 1].forEach(s => {
    const e = ell(0.026, 0.5, 1, 0.8, skin, 8); e.position.set(s * 0.093, -0.005, -0.008); head.add(e);
    const ey = ell(0.012, 1.3, 0.55, 0.6, darkMat, 8); ey.position.set(s * 0.036, 0.018, 0.09); head.add(ey);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.007, 0.006), hairMat); br.position.set(s * 0.036, 0.04, 0.094); br.rotation.z = s * -0.15; head.add(br);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 6), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.015, 0.105); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), lipMat); mouth.position.set(0, -0.055, 0.1); head.add(mouth);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.106, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.64), hairMat); hair.position.set(0, 0.012, -0.012); hair.scale.set(0.97, 1.12, 1.04); head.add(hair);
  const hat = new THREE.Mesh(lath([[0.001, 0.145], [0.05, 0.13], [0.13, 0.098], [0.24, 0.045], [0.335, 0.0], [0.345, -0.01], [0.33, -0.016]], 40, 0, 1, 1), hatMat);
  hat.position.set(0, 0.07, 0.012); hat.rotation.x = 0.08; head.add(hat);
  head.add(tube([V3(-0.095, 0.05, 0.02), V3(-0.07, -0.07, 0.06), V3(0, -0.108, 0.085), V3(0.07, -0.07, 0.06), V3(0.095, 0.05, 0.02)], 0.004, ropeMat, 20));

  const tabi = std({ color: new THREE.Color(0.82, 0.8, 0.74), roughness: 0.9 });
  const legs = [-1, 1].map(s => {
    const o = { s, th: new Seg(0.078, 0.062, indigo, 10), sh: new Seg(0.056, 0.04, skin, 10), kn: ell(0.062, 1, 1, 1, indigo, 10), fo: ell(0.05, 0.9, 0.5, 1.9, tabi, 10), so: ell(0.052, 0.95, 0.22, 2.0, ropeMat, 10) };
    body.add(o.th.m, o.sh.m, o.kn, o.fo, o.so); return o;
  });
  const footT = [V3(-0.14, fy(ZB - 0.2), ZB - 0.2), V3(0.14, fy(ZB + 0.14), ZB + 0.14)];
  const pl = new Seg(0.024, 0.016, bamboo); body.add(pl.m);
  const arms = [-1, 1].map(s => {
    const o = { s, up: new Seg(0.052, 0.043, indigo, 10), lo: new Seg(0.042, 0.032, skin, 10), sh: ell(0.056, 1, 1, 1, indigo, 10), el: ell(0.043, 1, 1, 1, skin, 8), hd: ell(0.038, 1, 0.9, 1.35, skin, 8) };
    body.add(o.up.m, o.lo.m, o.sh, o.el, o.hd); return o;
  });

  /* ====== Penumpang: furisode, obi bersimpul, nihongami, wagasa; duduk seiza di atas zabuton ====== */
  const PZ = 0.95;
  const pg = new THREE.Group(); pg.position.set(0, flT(PZ), PZ); body.add(pg);
  const cush = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.56), cushionMat); cush.position.y = 0.035; pg.add(cush);
  const kg = new THREE.Mesh(lath([[0.001, 0.0], [0.33, 0.02], [0.37, 0.09], [0.34, 0.18], [0.27, 0.27], [0.205, 0.35], [0.175, 0.43], [0.19, 0.52], [0.2, 0.62], [0.175, 0.72], [0.09, 0.78], [0.001, 0.8]], 28, 0.02, 1.0, 0.9), kimono);
  kg.position.y = 0.07; pg.add(kg);
  [-1, 1].forEach(s => { const kn = ell(0.1, 1, 0.8, 1.3, kimono, 12); kn.position.set(s * 0.12, 0.16, 0.27); pg.add(kn); });
  const obiBand = new THREE.Mesh(lath([[0.21, 0.37], [0.225, 0.39], [0.225, 0.55], [0.21, 0.57]], 28, 0, 1.0, 0.9), obi); obiBand.position.y = 0.07; pg.add(obiBand);
  const bow = new THREE.Group(); bow.position.set(0, 0.58, -0.25); pg.add(bow);
  const bx = (w, h, d, m, x, y, z, rz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.z = rz || 0; bow.add(b); };
  bx(0.26, 0.2, 0.08, obi, 0, 0, 0);
  [-1, 1].forEach(s => { bx(0.22, 0.2, 0.05, obi, s * 0.18, 0.07, -0.02, s * -0.35); bx(0.2, 0.17, 0.045, obi, s * 0.16, -0.09, -0.03, s * 0.5); bx(0.075, 0.26, 0.03, obi, s * 0.05, -0.24, -0.05, s * 0.12); });
  bx(0.09, 0.13, 0.07, obi, 0, 0.0, -0.06);
  const cordR = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 5, 24), gold); cordR.rotation.x = Math.PI / 2; cordR.scale.set(1, 0.9, 1); cordR.position.y = 0.52 + 0.07; pg.add(cordR);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 16), std({ color: new THREE.Color(0.96, 0.93, 0.88), roughness: 0.8 })); collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.84, -0.01); pg.add(collar);
  const pneck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 10), skinPale); pneck.position.y = 0.92; pg.add(pneck);
  const phead = new THREE.Group(); phead.position.set(0, 1.07, 0.0); pg.add(phead);
  phead.add(ell(0.097, 0.9, 1.12, 1.0, skinPale, 20));
  [-1, 1].forEach(s => {
    const ey = ell(0.011, 1.3, 0.5, 0.6, darkMat, 8); ey.position.set(s * 0.035, 0.015, 0.087); phead.add(ey);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.005), hairMat); br.position.set(s * 0.035, 0.036, 0.09); br.rotation.z = s * -0.12; phead.add(br);
    const ch = ell(0.016, 1.2, 0.7, 0.4, std({ color: new THREE.Color(1, 0.62, 0.66), roughness: 0.8 }), 8); ch.position.set(s * 0.055, -0.02, 0.078); phead.add(ch);
  });
  const lips = ell(0.011, 1.4, 0.6, 0.6, lipMat, 8); lips.position.set(0, -0.045, 0.09); phead.add(lips);
  const pnose = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 6), skinPale); pnose.rotation.x = Math.PI / 2; pnose.position.set(0, -0.012, 0.098); phead.add(pnose);
  const phair = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat); phair.position.set(0, 0.012, -0.018); phair.scale.set(1.03, 1.08, 1.1); phead.add(phair);
  [-1, 1].forEach(s => { const w = ell(0.06, 0.6, 1.1, 1.3, hairMat, 10); w.position.set(s * 0.1, -0.005, -0.03); phead.add(w); });
  const tabo = ell(0.085, 1.0, 0.8, 0.5, hairMat, 12); tabo.position.set(0, -0.04, -0.14); phead.add(tabo);
  const mage = ell(0.08, 1.0, 0.55, 1.15, hairMat, 12); mage.position.set(0, 0.12, -0.05); phead.add(mage);
  const comb = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 5, 12, Math.PI), gold); comb.position.set(0, 0.095, -0.1); comb.rotation.x = 0.6; phead.add(comb);
  for (let k = 0; k < 6; k++) {
    const pet = ell(0.019, 1, 0.6, 1, std({ color: new THREE.Color(0.98, 0.7, 0.8), roughness: 0.7 }), 8);
    const a = k * 1.047; pet.position.set(0.075 + Math.cos(a) * 0.025, 0.095 + Math.sin(a) * 0.025, -0.06); phead.add(pet);
  }
  const pArms = [-1, 1].map(s => {
    const o = { s, up: new Seg(0.05, 0.043, kimono, 10), lo: new Seg(0.042, 0.032, skinPale, 10), sh: ell(0.054, 1, 1, 1, kimono, 10), el: ell(0.043, 1, 1, 1, kimono, 8), hd: ell(0.034, 1, 0.9, 1.3, skinPale, 8), sl: sleeve(kimono) };
    body.add(o.up.m, o.lo.m, o.sh, o.el, o.hd, o.sl); return o;
  });

  /* wagasa: payung kertas bermerek janome, rusuk bambu, gagang di depan bahu */
  const paper = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#a8272b'; c.fillRect(0, 0, w, h); const r = mulberry32(23);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '60,10,10' : '255,200,180'},0.05)`; c.fillRect(r() * w, r() * h, 8, 1); }
    c.fillStyle = '#f1e4cc'; c.fillRect(w * 0.54, 0, w * 0.13, h);
    c.fillStyle = '#3a1810'; c.fillRect(0, 0, w * 0.07, h); c.fillStyle = '#d9a441'; c.fillRect(w * 0.97, 0, w * 0.03, h);
    c.fillStyle = 'rgba(40,10,10,0.35)'; for (let k = 0; k < 24; k++) c.fillRect(0, k * h / 24, w, 1.5);
  }, true);
  const umb = new THREE.Group();
  umb.add(new THREE.Mesh(grid(12, 48, (u, v) => { const a = v * Math.PI * 2, r = 0.6 * u; return [Math.cos(a) * r, 0.22 * (1 - Math.pow(u, 2.2)), Math.sin(a) * r]; }),
    new THREE.MeshLambertMaterial({ map: paper, side: THREE.DoubleSide, emissive: new THREE.Color(0.1, 0.025, 0.025) })));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rb = new Seg(0.004, 0.004, bamboo, 4); rb.set(V3(0, 0.2, 0), V3(Math.cos(a) * 0.59, -0.01, Math.sin(a) * 0.59)); umb.add(rb.m); }
  const up = new Seg(0.016, 0.012, bamboo); up.set(V3(0, -1.0, 0), V3(0, 0.22, 0)); umb.add(up.m);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 10), darkWood); bob.position.y = -0.2; umb.add(bob);
  const G = V3(0.36, 1.02 - 0.0, PZ + 0.28), dU = V3(-0.1, 1, -0.16).normalize();
  umb.quaternion.setFromUnitVectors(UP, dU); umb.position.copy(G).addScaledVector(dU, 0.8); body.add(umb);
  const PS = [V3(-0.17, flT(PZ) + 0.84, PZ), V3(0.17, flT(PZ) + 0.84, PZ)];
  const PT = [V3(-0.1, flT(PZ) + 0.4, PZ + 0.24), V3(G.x, G.y + flT(PZ) - 0.02 + 0.0, G.z)];
  const PH = [V3(-0.6, -0.7, -0.3), V3(0.7, -0.5, -0.6)];
  umb.position.y += flT(PZ) - 0.02; PT[1].y = G.y + flT(PZ) - 0.02;
  pArms.forEach((a, i) => {
    const k = ik(PS[i], PT[i], 0.3, 0.3, PH[i]); a.sh.position.copy(PS[i]); a.up.set(PS[i], k.elbow); a.lo.set(k.elbow, k.hand);
    a.el.position.copy(k.elbow); a.hd.position.copy(k.hand); a.sl.position.copy(k.elbow).add(V3(a.s * 0.02, 0, 0)); a.sl.rotation.z = a.s * 0.07;
  });

  /* ====== Animasi: galah mengayuh, napas, goyangan perahu ====== */
  const state = { phase: 0 };
  const TT = new THREE.Vector3(), UU = new THREE.Vector3(), HINT = new THREE.Vector3();
  function update(t, dt, speed01) {
    state.phase = (state.phase + dt * (0.12 + speed01 * 0.33)) % 1;
    const ph = state.phase, push = ph < 0.6, s = push ? ph / 0.6 : 0, e = push ? 0 : (ph - 0.6) / 0.4;
    const es = s * s * (3 - 2 * s), ee = e * e * (3 - 2 * e);
    const amp = 0.35 + 0.65 * clamp(speed01 * 1.4, 0, 1);
    const tz = push ? lerp(-0.2, -2.3, es) : lerp(-2.3, -0.2, ee);
    const ty = push ? -0.9 : -0.9 + 1.3 * Math.sin(Math.PI * ee);
    TT.set(1.0, ty, tz);                                                               // galah di luar lambung dan atap
    const uz = push ? lerp(-1.42, -1.9, es) : lerp(-1.9, -1.42, ee);
    UU.set(0.4, 1.5 - 0.15 * Math.sin(Math.PI * (push ? s : e)) + HIP - 0.92 - 0.12, uz);
    const pushK = push ? Math.sin(Math.PI * s) : 0;
    const bend = 0.07 * amp * pushK;
    torso.position.set(0, HIP - bend, ZB - 0.02 + 0.06 * amp * pushK);
    torso.rotation.set(0.05 + 0.22 * amp * pushK + 0.006 * Math.sin(t * 1.6), -0.12 * amp * pushK + 0.03 * Math.sin(t * 0.5), 0.02 * Math.sin(t * 0.9));
    torso.updateMatrix();
    head.rotation.set(0.05 - 0.12 * amp * pushK, 0.18 * Math.sin(t * 0.37) - 0.06, 0);
    const dn = UU.clone().sub(TT).normalize();
    pl.set(TT, TT.clone().addScaledVector(dn, 3.35));
    const lowH = TT.clone().addScaledVector(dn, UU.distanceTo(TT) - 0.55);
    arms.forEach((a, i) => {
      const S = V3(a.s * 0.19, 0.55, 0).applyMatrix4(torso.matrix), H = i === 1 ? UU : lowH;
      const k = ik(S, H, 0.3, 0.3, HINT.set(a.s * 0.7, -0.8, -0.2));
      a.sh.position.copy(S); a.up.set(S, k.elbow); a.lo.set(k.elbow, k.hand); a.el.position.copy(k.elbow); a.hd.position.copy(k.hand);
    });
    legs.forEach((l, i) => {
      const hip = V3(l.s * 0.095, -0.03, 0).applyMatrix4(torso.matrix), F = footT[i];
      const k = ik(hip, V3(F.x, F.y + 0.05, F.z), 0.43, 0.43, HINT.set(l.s * 0.1, 0.1, 1));
      l.th.set(hip, k.elbow); l.sh.set(k.elbow, k.hand); l.kn.position.copy(k.elbow); l.fo.position.set(F.x, F.y, F.z + 0.04); l.so.position.set(F.x, F.y - 0.022, F.z + 0.04);
    });
    body.position.y = 0.012 * Math.sin(t * 1.7);
    body.rotation.z = 0.018 * Math.sin(t * 1.1) + 0.012 * Math.sin(t * 0.7 + 1);
    body.rotation.x = 0.008 * Math.sin(t * 1.4 + 2) - 0.012 * speed01;
    kg.scale.y = 1 + 0.005 * Math.sin(t * 1.5); phead.rotation.y = 0.12 * Math.sin(t * 0.3 + 1);
    lamp.intensity = 0.8 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    glow.scale.setScalar(1.45 + 0.1 * Math.sin(t * 5.1));
  }
  boat.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: boat, update, state };
}
