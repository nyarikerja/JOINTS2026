/* ---------- Jembatan lengkung batu (andesit + bata merah, selaras dengan gerbang candi bentar) dengan warga di atasnya ----------
   Busur segmental dari batu baji (voussoir) melintasi sungai; perahu lewat di bawahnya. Dinding pengisi dari bata merah,
   pagar tembok dengan pelipit andesit, pilar bergaya candi dengan obor, tanaman rambat menjuntai, lumut dan basah dekat air. */
function buildBridge() {
  const BZ = BRIDGE.z, ox = cx(BZ), th = Math.atan(cxd(BZ)), L = BRIDGE.half, ct = Math.cos(th), st = Math.sin(th);
  const root = new THREE.Group(); root.position.set(ox, 0, BZ); root.rotation.y = th;
  const gh = u => terrainH(ox + u * ct, BZ - u * st);
  /* busur: setengah bentang S, tinggi R, tebal cincin T; pusat lingkaran di bawah air */
  const S = 7.6, R = 5.0, T = 0.62, Rc = (S * S + R * R) / (2 * R), cyA = R - Rc;
  const HW = 1.8, PIN = 0.3, PH = 0.82;                                    // setengah lebar luar, tebal pagar, tinggi pagar
  const yEnd = Math.max(gh(-L), gh(L)) + 0.35, yPk = R + T + 0.42;
  const Y = u => yPk - (yPk - yEnd) * Math.pow(Math.min(Math.abs(u) / L, 1), 2);
  const intr = u => cyA + Math.sqrt(Math.max(Rc * Rc - u * u, 0));
  const extr = u => Math.abs(u) < Rc + T ? cyA + Math.sqrt(Math.max((Rc + T) * (Rc + T) - u * u, 0)) : -9;
  const r = mulberry32(94);

  /* ====== Tekstur ====== */
  const brickTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5a3324'; c.fillRect(0, 0, w, h);
    const bh = 16, bw = 46;
    for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
      const k = 0.74 + r() * 0.44, hue = r();
      c.fillStyle = `rgb(${(164 + hue * 26) * k | 0},${(82 + hue * 18) * k | 0},${(52 + hue * 10) * k | 0})`; c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '40,20,10' : '230,190,150'},${0.07 + r() * 0.1})`; c.fillRect(x + 2 + r() * (bw - 8), y + 2 + r() * (bh - 6), 2 + r() * 5, 1 + r() * 2); }
      if (r() < 0.08) { c.fillStyle = 'rgba(20,12,8,0.35)'; c.fillRect(x + 3, y + 3, bw - 6, bh - 6); }               // bata gompal
    }
    for (let i = 0; i < 30; i++) { const x = r() * w; c.fillStyle = 'rgba(30,26,20,0.12)'; c.fillRect(x, 0, 2 + r() * 6, h); }  // noda air hujan
  }, true);
  const ashlar = (seed, base, rows, cols) => canvasTex(256, 256, (c, w, h) => {
    const rr = mulberry32(seed); c.fillStyle = '#2c2b28'; c.fillRect(0, 0, w, h);
    const bh = h / rows;
    for (let j = 0; j < rows; j++) {
      const bw = w / cols, off = (j % 2) * bw / 2;
      for (let x = -off; x < w; x += bw) {
        const k = 0.75 + rr() * 0.4; c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
        c.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4);
        for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${rr() < 0.5 ? '25,25,22' : '190,188,178'},${0.05 + rr() * 0.1})`; c.fillRect(x + 2 + rr() * (bw - 6), j * bh + 2 + rr() * (bh - 6), 1 + rr() * 3, 1 + rr() * 2); }
        c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + 2, j * bh + 2, bw - 4, 2);
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 2, j * bh + bh - 5, bw - 4, 3);
      }
    }
  }, true);
  const stoneTex = ashlar(5, [128, 126, 118], 4, 3), vousTex = ashlar(7, [120, 118, 110], 1, 1), paveTex = ashlar(11, [112, 108, 100], 6, 5);
  const std = (o, key, wm) => weatherMat(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.92, side: THREE.DoubleSide }, o)), key, wm);
  const brick = std({ map: brickTex, bumpMap: brickTex, bumpScale: 1.0 }, 'bBrick', { wet: 1.3, moss: 0.7 });
  const stone = std({ map: stoneTex, bumpMap: stoneTex, bumpScale: 1.2 }, 'bStone', { wet: 1.4, moss: 1 });
  const vous = std({ map: vousTex, bumpMap: vousTex, bumpScale: 1.4 }, 'bVous', { wet: 1.2, moss: 0.9 });
  const pave = std({ map: paveTex, bumpMap: paveTex, bumpScale: 1.0, roughness: 0.85 }, 'bPave', { wet: 0, moss: 0.35 });
  const add = m => { root.add(m); return m; };
  /* UV planar: koordinat dunia (meter) dibagi skala supaya ukuran bata dan batu tetap */
  const planar = (g, fu, fv, s) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, fu(p, i) / s, fv(p, i) / s); return g; };
  const byUY = (g, s) => planar(g, (p, i) => p.getX(i), (p, i) => p.getY(i), s);

  /* ====== Busur: bidang bawah (intrados) dan muka cincin batu baji ====== */
  const NV = 34;
  const soffit = grid(90, 4, (a, b) => { const u = (a - 0.5) * 2 * S; return [u, intr(u), (b - 0.5) * 2 * HW]; });
  planar(soffit, (p, i) => Math.asin(clamp(p.getX(i) / Rc, -1, 1)) * Rc, (p, i) => p.getZ(i), 0.9); add(new THREE.Mesh(soffit, vous));
  [-1, 1].forEach(sd => {
    const ring = grid(NV * 4, 1, (a, b) => {
      const u = (a - 0.5) * 2 * S, y = intr(u), dx = u, dy = y - cyA, l = Math.hypot(dx, dy), rr2 = lerp(Rc, Rc + T, b);
      return [dx / l * rr2, cyA + dy / l * rr2, sd * (HW + 0.06)];
    });
    const uv = ring.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * NV, uv.getY(i));
    add(new THREE.Mesh(ring, vous));
    /* kepala kala di batu kunci puncak busur */
    const kala = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#6c6a62'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(20,20,18,0.85)'; c.lineWidth = 4;
      c.beginPath(); c.arc(64, 70, 44, Math.PI * 1.05, Math.PI * 1.95); c.stroke();                      // alis
      [44, 84].forEach(x => { c.beginPath(); c.arc(x, 64, 11, 0, 6.283); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(x, 64, 4, 0, 6.283); c.fill(); });
      c.beginPath(); c.moveTo(30, 92); c.quadraticCurveTo(64, 120, 98, 92); c.stroke();                 // mulut
      for (let x = 38; x <= 90; x += 10) { c.beginPath(); c.moveTo(x, 96); c.lineTo(x + 4, 104); c.lineTo(x + 8, 96); c.stroke(); }
      c.lineWidth = 3; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(64, 70, 54 + k * 2, Math.PI * (1.1 + k * 0.02), Math.PI * (1.2 + k * 0.02)); c.stroke(); }
    });
    const km = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.16), weatherMat(new THREE.MeshStandardMaterial({ map: kala, bumpMap: kala, bumpScale: 3, roughness: 0.95 }), 'bKala', { moss: 0.6 }));
    km.position.set(0, R + T * 0.5 + 0.1, sd * (HW + 0.12)); if (sd < 0) km.rotation.y = Math.PI; add(km);
  });

  /* ====== Dinding pengisi (spandrel) + muka luar pagar: dari busur/air sampai puncak pagar ====== */
  const bot = u => Math.max(-1.3, extr(u));
  [-1, 1].forEach(sd => {
    const g = grid(200, 8, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, lerp(bot(u), Y(u) + PH - 0.02, b), sd * HW]; });
    add(new THREE.Mesh(byUY(g, 1.3), brick));
    const inner = grid(160, 2, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u) - 0.05 + b * (PH + 0.03), sd * (HW - PIN)]; });
    add(new THREE.Mesh(byUY(inner, 1.3), brick));
    /* pelipit andesit di puncak pagar dan di garis lantai bagian luar */
    const coping = (y0, wIn, wOut, hgt) => {
      const top = grid(160, 1, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u) + y0 + hgt, sd * lerp(wIn, wOut, b)]; });
      planar(top, (p, i) => p.getX(i), (p, i) => p.getZ(i), 1.2); add(new THREE.Mesh(top, stone));
      [wIn, wOut].forEach(ww => { const f = grid(160, 1, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u) + y0 + b * hgt, sd * ww]; }); add(new THREE.Mesh(byUY(f, 1.2), stone)); });
    };
    coping(PH - 0.04, HW - PIN - 0.05, HW + 0.07, 0.12);
    coping(-0.32, HW - 0.01, HW + 0.1, 0.18);
  });
  /* lantai batu andesit */
  const deck = grid(160, 2, (a, b) => { const u = (a - 0.5) * 2 * L; return [u, Y(u), (b - 0.5) * 2 * (HW - PIN)]; });
  planar(deck, (p, i) => p.getX(i), (p, i) => p.getZ(i), 1.6); add(new THREE.Mesh(deck, pave));
  /* kaki busur (pangkal) dan pangkal jembatan di tepi */
  const box = (w, h, d, x, y, z, m, s) => {
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / (s || 1.2), uv.getY(i) * h / (s || 1.2));
    const b = new THREE.Mesh(g, m); b.position.set(x, y, z); add(b); return b;
  };
  [-1, 1].forEach(s => {
    box(2.4, 2.4, 2 * HW + 0.5, s * (S + 0.7), -0.7, 0, stone);
    box(2.6, 3.2, 2 * HW + 0.6, s * (L + 0.6), yEnd - 1.9, 0, stone);
  });

  /* ====== Pilar bergaya candi (alas, badan berpanel, atap bertingkat, kemuncak) + obor ====== */
  const glowTex = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,215,145,1)'); g.addColorStop(0.3, 'rgba(255,150,60,0.45)'); g.addColorStop(1, 'rgba(255,110,30,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const flames = [];
  const pillar = (u, sd, lamp) => {
    const y0 = Y(u) - 0.05, z = sd * (HW - PIN / 2);
    box(0.62, 0.3, 0.62, u, y0 + 0.15, z, stone, 0.6);
    box(0.5, 0.9, 0.5, u, y0 + 0.75, z, brick, 0.9);
    let y = y0 + 1.2;
    [[0.66, 0.1], [0.5, 0.16], [0.4, 0.12], [0.28, 0.12]].forEach(t => { box(t[0], t[1], t[0], u, y + t[1] / 2, z, stone, 0.6); y += t[1]; });
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 8), stone); fin.position.set(u, y + 0.18, z); add(fin);
    if (lamp) {
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      fl.position.set(u, y + 0.5, z); fl.scale.set(1.1, 1.4, 1); add(fl); flames.push(fl);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.12, 8), weatherMat(new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }), 'bCup', { moss: 0 }));
      cup.position.set(u, y + 0.38, z); add(cup);
    }
  };
  [-1, 1].forEach(sd => { pillar(-S, sd, true); pillar(S, sd, true); pillar(-(L - 0.4), sd, false); pillar(L - 0.4, sd, false); });

  /* ====== Tanaman rambat menjuntai dari pagar ====== */
  const vineTex = canvasTex(128, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); const rr = mulberry32(17);
    for (let s = 0; s < 9; s++) {
      let x = 8 + rr() * (w - 16); const len = h * (0.35 + rr() * 0.65);
      c.strokeStyle = 'rgba(60,70,30,0.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y < len; y += 6) { x += (rr() - 0.5) * 3; c.lineTo(x, y); }
      c.stroke();
      for (let y = 4; y < len; y += 5 + rr() * 4) {
        const lx = x + (rr() - 0.5) * 10, g = 70 + rr() * 70 | 0;
        c.fillStyle = `rgb(${40 + rr() * 30 | 0},${g},${30 + rr() * 20 | 0})`;
        c.beginPath(); c.ellipse(lx, y, 3 + rr() * 3, 5 + rr() * 3, rr() * 3, 0, 6.283); c.fill();
      }
    }
  });
  const vineMat = fxMat(new THREE.MeshLambertMaterial({ map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide }), 'vine', { backlight: 0.4 });
  [-1, 1].forEach(sd => {
    for (let i = 0; i < 9; i++) {
      const u = -L + 2.5 + r() * (2 * L - 5), hh = 1.4 + r() * 2.4, ww = 0.8 + r() * 0.9;
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), vineMat);
      v.position.set(u, Y(u) + PH - hh / 2 + 0.05, sd * (HW + 0.12)); add(v);
    }
  });

  /* ====== Warga di atas jembatan ====== */
  const people = [];
  const payung = () => {                                    // payung kertas kecil
    const um = new THREE.Group(), pap = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#e7d9b8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5d8a'; c.fillRect(w * 0.15, 0, w * 0.18, h); c.fillRect(w * 0.62, 0, w * 0.18, h);
      c.fillStyle = '#c9402c'; c.fillRect(w * 0.9, 0, w * 0.1, h);
    }, true);
    um.add(new THREE.Mesh(grid(8, 32, (u, v) => { const a = v * 6.283, rr2 = 0.5 * u; return [Math.cos(a) * rr2, 0.18 * (1 - Math.pow(u, 1.8)), Math.sin(a) * rr2]; }), new THREE.MeshLambertMaterial({ map: pap, side: THREE.DoubleSide })));
    const pole = new Seg(0.011, 0.009, PK.plain([0.6, 0.5, 0.25]), 5); pole.set(V3(0, -0.72, 0), V3(0, 0.18, 0)); um.add(pole.m); return um;
  };
  const P = (o, u, w, kind) => {
    const p = PK.body(o); Object.assign(p, { u, w, kind, dir: 1, dist: 0, yaw: 0 }); root.add(p.g); people.push(p);
    if (o.parasol) { p.grip = V3(0.26, 1.0, 0.28); const um = payung(), dir = V3(-0.05, 1, -0.14).normalize(); um.quaternion.setFromUnitVectors(UP, dir); um.position.copy(p.grip).addScaledVector(dir, 0.72); p.g.add(um); }
    if (o.pikul) {                                          // pikulan: galah bambu di bahu dengan dua keranjang
      const bm = PK.plain([0.62, 0.55, 0.3], 0.6), pole = new Seg(0.022, 0.022, bm, 6); pole.set(V3(0.16, 0.56, -0.85), V3(0.16, 0.56, 0.85)); p.torso.add(pole.m);
      const bk = PK.std({ map: PK.rep(PK.weave('#9a7740', 8), 4, 1), roughness: 0.95, side: THREE.DoubleSide });
      [-0.75, 0.75].forEach(z => {
        const b = PK.lath([[0.12, 0], [0.18, 0.14], [0.19, 0.2]], bk, 14); b.position.set(0.16, -0.25, z); p.torso.add(b);
        const fill = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, 6.283, 0, 1.2), PK.plain(z < 0 ? [0.92, 0.55, 0.12] : [0.35, 0.6, 0.2], 0.7)); fill.position.set(0.16, -0.13, z); fill.scale.y = 0.5; p.torso.add(fill);
        [-1, 1].forEach(k => { const s2 = new Seg(0.004, 0.004, PK.plain([0.3, 0.25, 0.15]), 4); s2.set(V3(0.16 + k * 0.17, -0.06, z), V3(0.16, 0.56, z)); p.torso.add(s2.m); });
      });
    }
    return p;
  };
  const C = PK.cloth, PL = PK.plain;
  P({ female: true, skin: PK.SKIN.kuning, top: C('brokat', '#f6f0e4', '#c9b48a', '#a8865a', 2, 2), longSleeve: true, kain: C('parang', '#4a2c16', '#d9bb84', '#1a120c', 3, 2), parasol: true, melati: true, earring: true }, -2.2, -1.1, 'lean');
  P({ skin: PK.SKIN.sawo, top: C('kawung', '#d8c39a', '#5a3418', '#2a1a0c', 2, 2), low: PL([0.12, 0.12, 0.14]), longPants: true, hat: 'peci', mustache: true, sandal: true }, 0.8, -1.1, 'wave');
  P({ skin: PK.SKIN.sawo, top: PL([0.95, 0.95, 0.95], 0.8), low: PL([0.6, 0.12, 0.12]), sandal: true }, 2.0, -1.05, 'kid').g.scale.setScalar(0.62);
  P({ skin: PK.SKIN.gelap, top: C('lurik', '#3b4a3a', '#1c241c', '#a08850', 2, 2), low: PL([0.08, 0.08, 0.09]), sarung: C('kotak', '#2a4a6a', '#8a2a20', '#e6d6a0', 2, 1), hat: 'caping', iket: true, pikul: true }, -9, 0.4, 'walk');
  P({ female: true, skin: PK.SKIN.sawo, top: C('kawung', '#2a5a4a', '#e6d39a', '#14281f', 2, 2), longSleeve: true, kain: C('parang', '#3c2414', '#c89a5a', '#140c08', 3, 2), hat: 'tanggui' }, -3.7, 1.1, 'lean');
  P({ skin: PK.SKIN.sawo, top: C('lurik', '#6a4a2a', '#2a1a10', '#d0b070', 2, 2), low: PL([0.2, 0.18, 0.16]), longPants: true, iket: true, sandal: true }, 3.4, 1.1, 'wave');

  const HL = V3(), HR = V3(), FL = V3(), FR = V3(), idle = [V3(-0.24, 0.84, 0.06), V3(0.24, 0.84, 0.06)];
  const hintL = [V3(0, 0.2, 1), V3(0, 0.2, 1)];
  function update(t, dt, bx, bz) {
    const dx = bx - ox, dz = bz - BZ, bu = dx * ct - dz * st, bw = dx * st + dz * ct;
    people.forEach((p, n) => {
      if (p.kind === 'walk') { p.u += p.dir * 0.9 * dt; p.dist += 0.9 * dt; if (Math.abs(p.u) > L - 2.5) p.dir *= -1; }
      const u = p.u, w = p.w, d = Math.hypot(bu - u, bw - w), near = sstep(28, 12, d);
      const want = p.kind === 'walk' ? p.dir * Math.PI / 2 : Math.atan2(bu - u, bw - w);
      let df = want - p.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); p.yaw += df * (1 - Math.exp(-dt * (p.kind === 'walk' ? 6 : 1.6)));
      p.g.rotation.y = p.yaw;
      HL.copy(idle[0]); HR.copy(idle[1]); FL.set(-0.1, 0, 0.02); FR.set(0.1, 0, 0.02);
      let y = Y(u), hipBob = 0;
      const br = Math.sin(t * 1.4 + n); HL.y += 0.01 * br; HR.y += 0.01 * br;
      p.torso.rotation.set(0, 0, 0);
      if (p.kind === 'walk') {
        const ph = p.dist * 1.25, sw = Math.sin(ph);
        HL.z += 0.2 * sw; HR.z -= 0.2 * sw; HR.set(0.17, 1.4, 0.34);                     // tangan kanan memegang galah pikulan
        FL.set(-0.1, Math.max(0, Math.cos(ph)) * 0.09, 0.25 * sw); FR.set(0.1, Math.max(0, -Math.cos(ph)) * 0.09, -0.25 * sw);
        hipBob = Math.abs(Math.cos(ph)) * 0.025; p.torso.rotation.set(0.04, 0.06 * sw, 0);
        /* kemiringan lantai: badan condong ke arah tanjakan */
        const slope = (Y(u + 0.3 * p.dir) - Y(u)) / 0.3; p.torso.rotation.x += clamp(slope, -0.3, 0.3) * 0.25;
      } else if (p.kind === 'lean') {
        HL.lerp(V3(-0.2, 0.98, 0.36), near * 0.9); if (!p.grip) HR.lerp(V3(0.2, 0.98, 0.36), near * 0.9);
        p.torso.rotation.x = 0.12 * near;
      } else if (p.kind === 'wave') {
        HR.lerp(V3(0.3, 1.62 + 0.07 * Math.sin(t * 6 + n), 0.12 + 0.07 * Math.sin(t * 6 + n)), near);
      } else if (p.kind === 'kid') {
        HR.lerp(V3(0.3, 1.62 + 0.1 * Math.sin(t * 7), 0.1), near); HL.lerp(V3(-0.3, 1.62 + 0.1 * Math.sin(t * 7 + 1.5), 0.1), near);
        y += Math.abs(Math.sin(t * 5)) * 0.1 * near;
      }
      if (p.grip) HR.copy(p.grip);
      p.torso.position.y = p.HIP - 0.015 + hipBob;
      p.head.rotation.y = 0.12 * Math.sin(t * 0.6 + n * 2);
      p.g.position.set(u, y, w);
      p.pose([HL, HR], [FL, FR], null, hintL);
    });
    flames.forEach((f, i) => { const k = 0.85 + 0.15 * Math.sin(t * 12 + i * 2) * Math.sin(t * 7.1 + i); f.scale.set(1.05 * k, 1.4 * k, 1); });
  }
  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  bakeStatic(root, people.map(p => p.g));
  return { group: root, update };
}
