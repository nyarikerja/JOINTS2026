/* ---------- Jembatan lengkung (taiko-bashi) dengan orang-orang di atasnya ---------- */
function buildBridge() {
  const BZ = BRIDGE.z, ox = cx(BZ), th = Math.atan(cxd(BZ)), L = BRIDGE.half, HW = 1.6, ct = Math.cos(th), st = Math.sin(th);
  const root = new THREE.Group(); root.position.set(ox, 0, BZ); root.rotation.y = th;
  const gh = u => terrainH(ox + u * ct, BZ - u * st);
  const yEnd = Math.max(gh(-L), gh(L)) + 0.45, yPk = 4.7;
  const Y = u => yPk - (yPk - yEnd) * Math.pow(Math.abs(u) / L, 2);
  const dY = u => -2 * (yPk - yEnd) * u / (L * L);
  const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, side: THREE.DoubleSide }, o));
  const M = c => std({ color: new THREE.Color(c[0], c[1], c[2]), roughness: 0.82 });

  const deckTex = canvasTex(128, 64, (c, w, h) => {
    const r = mulberry32(77);
    for (let i = 0; i < 8; i++) {
      const k = 0.8 + 0.4 * r(); c.fillStyle = `rgb(${150 * k | 0},${108 * k | 0},${70 * k | 0})`; c.fillRect(i * 16, 0, 16, h);
      c.fillStyle = 'rgba(20,10,5,0.7)'; c.fillRect(i * 16, 0, 2, h);
      for (let j = 0; j < 6; j++) { c.strokeStyle = 'rgba(40,22,10,0.25)'; const x = i * 16 + 3 + r() * 11; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 2, h); c.stroke(); }
    }
  }, true);
  deckTex.repeat.set(2 * L / 1.28, 1);
  const stoneTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#6f6e69'; c.fillRect(0, 0, w, h); const r = mulberry32(5);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 20; x < w; x += 40) { const k = 0.8 + 0.35 * r(); c.fillStyle = `rgb(${139 * k | 0},${137 * k | 0},${130 * k | 0})`; c.fillRect(x + 1, y + 1, 38, 30); }
  }, true);
  stoneTex.repeat.set(2, 2);
  const deckM = std({ map: deckTex, bumpMap: deckTex, bumpScale: 1.2 }), red = std({ color: new THREE.Color(0.55, 0.09, 0.09), roughness: 0.4 });
  /* kayu gelap dan batu pangkal jembatan basah dan berlumut dekat air (weatherMat di p3c_gate.js) */
  const dark = weatherMat(std({ color: new THREE.Color(0.2, 0.13, 0.09) }), 'bDark', { wet: 0.9, moss: 0.5 }), gold = std({ color: new THREE.Color(0.85, 0.7, 0.3), roughness: 0.4, metalness: 0.5 });
  const stone = weatherMat(std({ map: stoneTex, roughness: 0.95 }), 'bStone', { wet: 1.4, moss: 1 });
  const add = m => { root.add(m); return m; };
  const arcPts = (dy, w) => { const p = []; for (let i = 0; i <= 40; i++) { const u = -L + 2 * L * i / 40; p.push(V3(u, Y(u) + dy, w)); } return p; };
  const tube = (pts, r, m) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 8), m));

  add(new THREE.Mesh(grid(80, 2, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u), (b - 0.5) * 2 * HW]; }), deckM));
  add(new THREE.Mesh(grid(80, 2, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u) - 0.22, (b - 0.5) * 2 * HW]; }), dark));
  [-1, 1].forEach(sd => {
    add(new THREE.Mesh(grid(80, 1, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u) - 0.22 + b * 0.22, sd * HW]; }), dark));
    tube(arcPts(-0.34, sd * 0.95), 0.13, dark);
    tube(arcPts(1.02, sd * (HW - 0.08)), 0.05, red); tube(arcPts(0.55, sd * (HW - 0.08)), 0.035, red);
    for (let i = 0, u = -L; u <= L + 0.01; u += 1.55, i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.11), red); p.position.set(u, Y(u) + 0.52, sd * (HW - 0.08)); add(p);
      if (i % 4 === 0) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gold); c.position.set(u, Y(u) + 1.1, sd * (HW - 0.08)); c.scale.y = 1.3; add(c); }
    }
    const ab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4, 3.6), stone); ab.position.set(sd * (L + 0.4), yEnd - 0.4 - 2, 0); add(ab);
  });
  for (let u = -L + 1; u < L; u += 0.9) {                                              // pijakan melintang di tanjakan
    if (Math.abs(u) < 3) continue;
    const cl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2 * HW - 0.1), dark); cl.position.set(u, Y(u) + 0.03, 0); cl.rotation.z = Math.atan(dY(u)); add(cl);
  }
  const glowTex = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,200,130,0.9)'); g.addColorStop(0.35, 'rgba(255,150,70,0.3)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const lanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.7) });
  [-3.1, 3.1].forEach(u => [-1, 1].forEach(sd => {
    const x = u, y = Y(u) + 1.1, z = sd * (HW - 0.08);
    const pole = new Seg(0.012, 0.012, dark, 5); pole.set(V3(x, y, z), V3(x, y + 0.22, z)); add(pole.m);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 10), lanMat); l.position.set(x, y + 0.34, z); add(l);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); gl.position.copy(l.position); gl.scale.set(1.1, 1.1, 1); add(gl);
  }));

  /* ====== Orang ====== */
  const ell = (r, sx, sy, sz, m) => { const q = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); q.scale.set(sx, sy, sz); return q; };
  function person(o) {
    const g = new THREE.Group(); g.scale.setScalar(o.s || 1);
    const skin = M(o.skin || [0.82, 0.63, 0.5]), cl = M(o.cloth), cl2 = M(o.cloth2 || o.cloth), hair = M(o.hair || [0.04, 0.03, 0.04]), dk = M([0.04, 0.03, 0.03]);
    const prof = o.robe ? [[0.001, 0], [0.3, 0.02], [0.27, 0.3], [0.22, 0.7], [0.18, 1.0], [0.17, 1.15], [0.15, 1.3], [0.17, 1.4], [0.12, 1.47], [0.001, 1.5]]
      : [[0.001, 0.82], [0.16, 0.84], [0.15, 1.0], [0.14, 1.2], [0.17, 1.38], [0.12, 1.46], [0.001, 1.5]];
    const lg = new THREE.LatheGeometry(prof.map(q => new THREE.Vector2(q[0], q[1])), 20); lg.scale(1, 1, 0.78); lg.computeVertexNormals(); g.add(new THREE.Mesh(lg, cl));
    if (o.robe) {
      const ob = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 20), cl2); ob.rotation.x = Math.PI / 2; ob.position.y = 1.12; ob.scale.set(1, 0.78, 1); g.add(ob);
      const bw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.1), cl2); bw.position.set(0, 1.14, -0.17); g.add(bw);
    }
    const head = new THREE.Group(); head.position.y = 1.6; g.add(head);
    head.add(ell(0.1, 0.92, 1.12, 1, skin));
    const hc = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hair); hc.position.set(0, 0.015, -0.012); hc.scale.set(0.97, 1.1, 1.04); head.add(hc);
    [-1, 1].forEach(s => { const e = ell(0.012, 1.3, 0.55, 0.6, dk); e.position.set(s * 0.036, 0.018, 0.09); head.add(e); });
    if (o.bun) { const b = ell(0.07, 1, 0.8, 0.9, hair); b.position.set(0, 0.07, -0.11); head.add(b); }
    if (o.hat) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.12, 24, 1, true), M([0.75, 0.65, 0.4])); h.position.set(0, 0.13, 0.01); head.add(h); }
    const sg = (a, b, m) => new Seg(a, b, m, 8);
    const arms = [-1, 1].map(s => { const a = { s, up: sg(0.05, 0.04, cl), lo: sg(0.04, 0.03, o.robe ? cl : skin), sh: ell(0.052, 1, 1, 1, cl), hd: ell(0.035, 1, 0.9, 1.3, skin) }; g.add(a.up.m, a.lo.m, a.sh, a.hd); return a; });
    const legs = o.robe ? [] : [-1, 1].map(s => { const l = { s, th: sg(0.075, 0.058, cl2), sh: sg(0.055, 0.04, o.longPants ? cl2 : skin), ft: ell(0.045, 0.9, 0.45, 1.9, dk) }; g.add(l.th.m, l.sh.m, l.ft); return l; });
    let grip = null;
    if (o.parasol) {
      grip = V3(0.27, 1.02, 0.3); const dir = V3(-0.05, 1, -0.14).normalize(), um = new THREE.Group();
      const pap = canvasTex(64, 8, (c, w, h) => { c.fillStyle = '#e9e1d0'; c.fillRect(0, 0, w, h); c.fillStyle = '#3b5a8c'; c.fillRect(w * 0.15, 0, w * 0.2, h); c.fillRect(w * 0.6, 0, w * 0.2, h); }, true);
      um.add(new THREE.Mesh(grid(8, 32, (u, v) => { const a = v * 6.283, r = 0.5 * u; return [Math.cos(a) * r, 0.18 * (1 - Math.pow(u, 2.2)), Math.sin(a) * r]; }), new THREE.MeshLambertMaterial({ map: pap, side: THREE.DoubleSide })));
      const pole = new Seg(0.012, 0.01, M([0.6, 0.5, 0.25]), 5); pole.set(V3(0, -0.7, 0), V3(0, 0.18, 0)); um.add(pole.m);
      um.quaternion.setFromUnitVectors(UP, dir); um.position.copy(grip).addScaledVector(dir, 0.7); g.add(um);
    }
    const pose = (H, F) => {
      arms.forEach((a, i) => { const S = V3(a.s * 0.19, 1.4, 0), k = ik(S, H[i], 0.29, 0.27, V3(a.s * 0.6, -0.8, -0.4)); a.sh.position.copy(S); a.up.set(S, k.elbow); a.lo.set(k.elbow, k.hand); a.hd.position.copy(k.hand); });
      legs.forEach((l, i) => { const hip = V3(l.s * 0.09, 0.88, 0), A = F[i], k = ik(hip, V3(A.x, A.y + 0.06, A.z), 0.43, 0.43, V3(0, 0.2, 1)); l.th.set(hip, k.elbow); l.sh.set(k.elbow, k.hand); l.ft.position.set(A.x, A.y + 0.025, A.z + 0.05); });
    };
    return { g, head, pose, grip, robe: !!o.robe, yaw: 0 };
  }
  const people = [], P = (o, u, w, kind) => { const p = person(o); Object.assign(p, { u, w, kind, dir: 1, dist: 0, ph: Math.random() * 6 }); root.add(p.g); people.push(p); return p; };
  P({ robe: 1, cloth: [0.82, 0.45, 0.6], cloth2: [0.45, 0.1, 0.2], bun: 1, parasol: 1 }, -1.8, -1.25, 'lean');
  P({ cloth: [0.18, 0.4, 0.45], skin: [0.8, 0.6, 0.47], hat: 1 }, 0.7, -1.25, 'wave');
  P({ robe: 1, cloth: [0.2, 0.3, 0.6], cloth2: [0.9, 0.5, 0.5], s: 0.62 }, 2.1, -1.2, 'kid');
  P({ cloth: [0.1, 0.12, 0.2], cloth2: [0.25, 0.25, 0.3], longPants: 1 }, -9, 0.4, 'walk');
  P({ robe: 1, cloth: [0.35, 0.55, 0.4], cloth2: [0.8, 0.7, 0.35], bun: 1 }, -3.9, 1.25, 'lean');
  P({ cloth: [0.5, 0.35, 0.25], cloth2: [0.3, 0.25, 0.2], longPants: 1, hat: 1 }, 3.4, 1.25, 'wave');

  const idle = [V3(-0.23, 0.88, 0.05), V3(0.23, 0.88, 0.05)], HL = V3(), HR = V3(), FL = V3(), FR = V3();
  function update(t, dt, bx, bz) {
    const dx = bx - ox, dz = bz - BZ, bu = dx * ct - dz * st, bw = dx * st + dz * ct;
    people.forEach((p, n) => {
      if (p.kind === 'walk') { p.u += p.dir * 0.95 * dt; p.dist += 0.95 * dt; if (Math.abs(p.u) > L - 3) p.dir *= -1; }
      const u = p.u, w = p.w, d = Math.hypot(bu - u, bw - w), near = sstep(26, 12, d);
      const want = p.kind === 'walk' ? p.dir * Math.PI / 2 : Math.atan2(bu - u, bw - w);
      let df = want - p.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); p.yaw += df * (1 - Math.exp(-dt * (p.kind === 'walk' ? 6 : 1.6)));
      p.g.rotation.y = p.yaw;
      HL.copy(idle[0]); HR.copy(idle[1]); FL.set(-0.1, 0, 0.02); FR.set(0.1, 0, 0.02);
      let y = Y(u);
      const br = Math.sin(t * 1.4 + n);
      HL.y += 0.01 * br; HR.y += 0.01 * br;
      if (p.kind === 'walk') {
        const ph = p.dist * 1.15, sw = Math.sin(ph);
        HL.z += 0.22 * sw; HR.z -= 0.22 * sw;
        FL.set(-0.1, Math.max(0, Math.cos(ph)) * 0.1, 0.26 * sw); FR.set(0.1, Math.max(0, -Math.cos(ph)) * 0.1, -0.26 * sw);
        y += Math.abs(Math.cos(ph)) * 0.025;
      } else if (p.kind === 'lean') {
        HL.lerp(V3(-0.2, 1.02, 0.36), near * 0.9); if (!p.grip) HR.lerp(V3(0.2, 1.02, 0.36), near * 0.9);
      } else if (p.kind === 'wave') {
        HR.lerp(V3(0.28, 1.78 + 0.08 * Math.sin(t * 6 + n), 0.1 + 0.08 * Math.sin(t * 6 + n)), near);
      } else if (p.kind === 'kid') {
        HR.lerp(V3(0.3, 1.8 + 0.1 * Math.sin(t * 7), 0.1), near); HL.lerp(V3(-0.3, 1.8 + 0.1 * Math.sin(t * 7 + 1.5), 0.1), near);
        y += Math.abs(Math.sin(t * 5)) * 0.14 * near;
      }
      if (p.grip) HR.copy(p.grip);
      p.head.rotation.y = 0.1 * Math.sin(t * 0.6 + n * 2);
      p.g.position.set(u, y, w);
      p.pose([HL, HR], [FL, FR]);
    });
  }
  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: root, update };
}
