/* ---------- Kit tokoh: tekstur kain Nusantara (batik parang, kawung, sarung kotak, brokat kebaya), kepala, tubuh ber-IK ----------
   Dipakai oleh perahu (p3_boat), jembatan (p3b_bridge) dan warga di tepian (p3e_life). Satu meter = satu unit, tinggi dewasa ~1.65. */
const PK = (() => {
  const cache = {};
  const memo = (k, f) => cache[k] || (cache[k] = f());
  const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
  const std = (o, key) => rimMat(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o)), key || 'rim');
  const col = c => new THREE.Color(c[0], c[1], c[2]);
  const hex = c => '#' + c.map(v => ('0' + Math.round(clamp(v, 0, 1) * 255).toString(16)).slice(-2)).join('');

  /* batik: motif digambar prosedural, warna sogan/indigo/pesisiran */
  function batik(kind, c1, c2, c3) {
    return memo('b' + kind + c1 + c2 + c3, () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = c1; g.fillRect(0, 0, w, h);
      if (kind === 'parang') {                                  // pita diagonal berisi bilah "S" berulang
        g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
        for (let b = -6; b <= 6; b++) {
          const y = b * 45.25;
          g.fillStyle = c2; g.fillRect(-w, y - 3, 2 * w, 6);
          for (let x = -w; x < w; x += 22.6) {
            g.fillStyle = c2; g.beginPath(); g.ellipse(x, y + 14, 9, 13, 0.5, 0, 6.283); g.fill();
            g.fillStyle = c1; g.beginPath(); g.ellipse(x + 1, y + 14, 4, 8, 0.5, 0, 6.283); g.fill();
            g.fillStyle = c3; g.beginPath(); g.arc(x + 11, y - 13, 2.6, 0, 6.283); g.fill();
          }
          g.strokeStyle = c3; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w, y + 30); g.lineTo(w, y + 30); g.stroke();
        }
        g.restore();
      } else if (kind === 'kawung') {                           // empat elips mengelilingi titik
        for (let y = 0; y <= h; y += 32) for (let x = 0; x <= w; x += 32) {
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2 + Math.PI / 4, px = x + Math.cos(a) * 9, py = y + Math.sin(a) * 9;
            g.fillStyle = c2; g.beginPath(); g.ellipse(px, py, 10, 6, a, 0, 6.283); g.fill();
            g.fillStyle = c3; g.beginPath(); g.ellipse(px, py, 4, 2, a, 0, 6.283); g.fill();
          }
          g.fillStyle = c3; g.beginPath(); g.arc(x, y, 2.5, 0, 6.283); g.fill();
        }
      } else if (kind === 'kotak') {                            // sarung kotak-kotak
        const s = [[0, 40, c2, 0.85], [40, 10, c3, 0.9], [62, 6, c3, 0.6], [90, 34, c2, 0.6], [150, 8, c3, 0.85], [190, 46, c2, 0.75]];
        s.forEach(q => { g.globalAlpha = q[3] * 0.6; g.fillStyle = q[2]; g.fillRect(q[0], 0, q[1], h); g.fillRect(0, q[0], w, q[1]); });
        g.globalAlpha = 1;
        for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, y, w, 1); }
      } else if (kind === 'brokat') {                           // renda kebaya: bunga kecil berlubang
        const r = mulberry32(3);
        for (let i = 0; i < 70; i++) {
          const x = r() * w, y = r() * h, s = 6 + r() * 6;
          g.strokeStyle = c2; g.lineWidth = 1.4;
          for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.45, s * 0.28, a, 0, 6.283); g.stroke(); }
          g.fillStyle = c3; g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fill();
        }
        g.strokeStyle = c2; g.globalAlpha = 0.35; g.lineWidth = 1;
        for (let i = 0; i < 40; i++) { g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.bezierCurveTo(x + 10, y - 10, x + 20, y + 10, x + 30, y); g.stroke(); }
        g.globalAlpha = 1;
      } else if (kind === 'lurik') {                            // tenun lurik: garis rapat
        const r = mulberry32(5);
        for (let x = 0; x < w; x += 4) { g.fillStyle = r() < 0.3 ? c2 : (r() < 0.2 ? c3 : c1); g.fillRect(x, 0, 2 + (r() * 2 | 0), h); }
      }
      g.globalAlpha = 0.08; const r2 = mulberry32(9);
      for (let i = 0; i < 900; i++) { g.fillStyle = r2() < 0.5 ? '#000' : '#fff'; g.fillRect(r2() * w, r2() * h, 2, 1); }
      g.globalAlpha = 1;
    }, true));
  }
  const cloth = (kind, c1, c2, c3, rx, ry, rough) => memo(`m${kind}${c1}${c2}${c3}${rx}${ry}`, () => std({ map: rep(batik(kind, c1, c2, c3), rx || 2, ry || 2), roughness: rough || 0.9, side: THREE.DoubleSide }));
  const plain = (c, rough, metal) => memo('p' + c + rough + metal, () => std({ color: col(c), roughness: rough == null ? 0.85 : rough, metalness: metal || 0 }));
  const skinMat = tone => memo('s' + tone, () => {
    const t = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#e8cdb8'; g.fillRect(0, 0, w, h); const r = mulberry32(2);
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${120 + r() * 40 | 0},${70 + r() * 30 | 0},50,${0.04 + 0.05 * r()})`; g.fillRect(r() * w, r() * h, 2, 2); }
    }, true);
    return std({ color: col(tone), map: t, roughness: 0.62 });
  });
  const SKIN = { sawo: [0.66, 0.45, 0.31], kuning: [0.8, 0.6, 0.45], gelap: [0.5, 0.33, 0.22], terang: [0.86, 0.68, 0.55] };
  const weave = (base, seed) => memo('w' + base + seed, () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = mulberry32(seed || 13), s = 8;
    for (let i = 0; i < w / s; i++) for (let j = 0; j < h / s; j++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '70,50,22' : '250,230,180'},${0.12 + r() * 0.18})`;
      if ((i + j) % 2) g.fillRect(i * s, j * s + 1, s, s - 2); else g.fillRect(i * s + 1, j * s, s - 2, s);
    }
  }, true));
  const ell = (r, sx, sy, sz, m, seg) => { const q = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 16, Math.max(8, (seg || 16) * 0.6 | 0)), m); q.scale.set(sx, sy, sz); return q; };
  const lath = (pts, m, seg, sx, sz) => {
    const g = new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), seg || 24);
    if (sx || sz) g.scale(sx || 1, 1, sz || 1); g.computeVertexNormals(); return new THREE.Mesh(g, m);
  };

  /* Kepala: tengkorak, rahang, hidung, telinga, mata (putih + iris), alis, bibir, rambut dan tutup kepala */
  function head(o) {
    const h = new THREE.Group(), sk = skinMat(o.skin || SKIN.sawo), hair = plain([0.03, 0.025, 0.03], 0.42), dark = plain([0.03, 0.02, 0.02], 0.25);
    const white = plain([0.93, 0.91, 0.88], 0.3), lip = plain(o.female ? [0.62, 0.22, 0.24] : [0.48, 0.28, 0.24], 0.5);
    h.add(ell(0.1, 0.88, 1.06, 0.98, sk, 22));
    const jaw = ell(0.074, o.female ? 0.9 : 1, 0.74, 1, sk, 16); jaw.position.set(0, -0.052, 0.024); h.add(jaw);
    const nose = ell(0.017, 0.85, 1, 1.25, sk, 10); nose.position.set(0, -0.014, 0.097); h.add(nose);
    [-1, 1].forEach(s => {
      const e = ell(0.024, 0.45, 1, 0.8, sk, 10); e.position.set(s * 0.09, -0.004, -0.004); h.add(e);
      const w = ell(0.0135, 1.25, 0.72, 0.5, white, 10); w.position.set(s * 0.034, 0.016, 0.086); h.add(w);
      const i = ell(0.0075, 1, 1, 0.55, dark, 8); i.position.set(s * 0.034, 0.016, 0.092); h.add(i);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.0075, 0.008), hair); b.position.set(s * 0.035, 0.039, 0.092); b.rotation.z = s * -0.12; h.add(b);
      if (o.female) { const c = ell(0.016, 1.2, 0.7, 0.4, plain([0.86, 0.5, 0.48], 0.8), 8); c.position.set(s * 0.054, -0.022, 0.076); h.add(c); }
      if (o.earring) { const er = ell(0.008, 1, 1.4, 1, plain([0.85, 0.68, 0.3], 0.3, 0.7), 8); er.position.set(s * 0.093, -0.035, 0); h.add(er); }
    });
    const lips = ell(0.0115, 1.6, 0.52, 0.6, lip, 10); lips.position.set(0, -0.05, 0.089); h.add(lips);
    if (o.mustache) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.008, 0.01), hair); m.position.set(0, -0.036, 0.094); h.add(m); }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI * (o.female ? 0.64 : 0.56)), hair);
    cap.position.set(0, 0.012, -0.014); cap.scale.set(0.96, 1.08, 1.06); h.add(cap);
    if (o.female) {
      [-1, 1].forEach(s => { const w = ell(0.06, 0.55, 1.05, 1.25, hair, 12); w.position.set(s * 0.085, 0.005, -0.03); h.add(w); });
      const bun = ell(0.068, 1.05, 0.82, 0.8, hair, 16); bun.position.set(0, -0.01, -0.13); h.add(bun);   // sanggul konde
      if (o.melati) for (let k = 0; k < 14; k++) {                                                      // untaian melati
        const a = k / 14 * Math.PI * 2, m = ell(0.011, 1, 1, 1, plain([0.98, 0.97, 0.92], 0.6), 6);
        m.position.set(Math.cos(a) * 0.072, -0.01 + Math.sin(a) * 0.058, -0.13 - 0.02 * Math.abs(Math.sin(a))); h.add(m);
      }
      if (o.pin) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 5), plain([0.85, 0.68, 0.3], 0.3, 0.7)); p.position.set(0.02, 0.02, -0.14); p.rotation.z = 1.1; h.add(p); }
    }
    if (o.hat === 'caping' || o.hat === 'tanggui') {
      const wide = o.hat === 'tanggui', R = wide ? 0.42 : 0.33, Hh = wide ? 0.11 : 0.17;
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.001 + R * t, Hh * (1 - Math.pow(t, wide ? 0.7 : 1.15))]); }
      pts.push([R + 0.012, -0.012]);
      const ht = lath(pts, memo('hat' + wide, () => std({ map: rep(weave(wide ? '#b29a62' : '#c4a96c', wide ? 21 : 14), 6, 2), roughness: 0.95, side: THREE.DoubleSide })), 40);
      ht.position.set(0, 0.075, 0.01); ht.rotation.x = 0.06; h.add(ht);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.008, 5, 40), plain([0.42, 0.3, 0.14], 0.9)); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.063, 0.01); h.add(rim);
      const knob = ell(0.018, 1, 0.8, 1, plain([0.4, 0.28, 0.12], 0.8), 8); knob.position.set(0, 0.075 + Hh, 0.01); h.add(knob);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 4, 20, Math.PI), plain([0.3, 0.2, 0.1])); strap.position.set(0, -0.01, 0.02); strap.rotation.set(-0.3, 0, Math.PI); h.add(strap);
    }
    if (o.hat === 'iket' || o.iket) {                         // ikat kepala batik + simpul di belakang
      const im = cloth('parang', '#5b3a1e', '#2a1a0e', '#c9a46a', 3, 1);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.1, 0.05, 22, 1, true), im); band.position.set(0, 0.045, -0.012); band.scale.set(0.97, 1, 1.07); h.add(band);
      const kn = ell(0.03, 1.3, 0.8, 0.8, im, 8); kn.position.set(0, 0.05, -0.122); h.add(kn);
      [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.006), im); t.position.set(s * 0.024, 0.02, -0.126); t.rotation.z = s * 0.4; h.add(t); });
    }
    if (o.hat === 'peci') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.104, 0.085, 24), plain([0.05, 0.05, 0.06], 0.6)); p.position.set(0, 0.075, -0.01); p.scale.set(0.94, 1, 1.1); p.rotation.x = -0.12; h.add(p);
    }
    return h;
  }

  /* Tubuh berdiri: torso (grup di pinggul), tungkai dan lengan IK. Titik asal di telapak kaki. */
  function body(o) {
    const g = new THREE.Group(), sk = skinMat(o.skin || SKIN.sawo), HIP = 0.86;
    const top = o.top, low = o.low || plain([0.08, 0.07, 0.08], 0.9);
    const torso = new THREE.Group(); torso.position.y = HIP; g.add(torso);
    const prof = o.female
      ? [[0.001, -0.12], [0.18, -0.12], [0.165, 0.0], [0.132, 0.14], [0.142, 0.28], [0.165, 0.41], [0.165, 0.49], [0.115, 0.545], [0.05, 0.57], [0.001, 0.575]]
      : [[0.001, -0.08], [0.172, -0.08], [0.172, 0.05], [0.158, 0.18], [0.163, 0.32], [0.185, 0.44], [0.18, 0.5], [0.125, 0.55], [0.05, 0.572], [0.001, 0.575]];
    torso.add(lath(prof, top, 28, 1.1, 0.72));
    if (o.female && o.selendang) {                            // selendang menyilang dari bahu kanan ke pinggang kiri
      const sm = o.selendang, pts = [V3(0.15, 0.53, -0.03), V3(0.1, 0.4, 0.13), V3(-0.02, 0.22, 0.15), V3(-0.16, 0.04, 0.1), V3(-0.2, -0.1, 0.0)];
      torso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.032, 5), sm));
      const back = [V3(0.15, 0.53, -0.03), V3(0.14, 0.4, -0.13), V3(0.17, 0.1, -0.15), V3(0.2, -0.2, -0.12)];
      torso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(back), 16, 0.03, 5), sm));
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.12, 12), sk); neck.position.y = 0.6; torso.add(neck);
    if (o.collar) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 18), o.collar); c.rotation.x = Math.PI / 2 - 0.25; c.position.set(0, 0.565, 0.01); torso.add(c); }
    const hd = head(o); hd.position.y = 0.705; torso.add(hd);
    /* bawahan: sarung pendek di atas celana, kain panjang (perempuan), atau celana */
    let skirt = null;
    if (o.sarung) { skirt = lath([[0.185, 0.0], [0.215, -0.06], [0.225, -0.3], [0.215, -0.34]], o.sarung, 26, 1.08, 0.8); torso.add(skirt);
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 6, 24), o.sarung); roll.rotation.x = Math.PI / 2; roll.scale.set(1.08, 0.8, 1); roll.position.y = -0.005; torso.add(roll); }
    if (o.kain) { skirt = lath([[0.001, -0.82], [0.17, -0.82], [0.18, -0.6], [0.2, -0.3], [0.2, -0.05], [0.175, 0.02]], o.kain, 26, 1.0, 0.82); torso.add(skirt); }
    const Seg8 = (a, b, m) => new Seg(a, b, m, 12);
    const legs = [-1, 1].map(s => {
      const l = { s, th: Seg8(0.078, 0.06, low), sh: Seg8(0.052, 0.038, o.longPants ? low : sk), kn: ell(0.058, 1, 1, 1, o.longPants ? low : sk, 10),
        ft: ell(0.046, 0.92, 0.48, 2.0, o.sandal ? plain([0.2, 0.12, 0.08]) : sk, 12) };
      if (o.kain) { l.th.m.visible = false; l.kn.visible = false; l.sh.m.visible = false; }
      g.add(l.th.m, l.sh.m, l.kn, l.ft); return l;
    });
    const sleeveM = o.longSleeve ? top : sk;
    const arms = [-1, 1].map(s => {
      const a = { s, up: Seg8(0.05, 0.042, top), lo: Seg8(0.04, 0.03, sleeveM), sh: ell(0.056, 1, 1, 1, top, 12), el: ell(0.042, 1, 1, 1, o.longSleeve ? top : sk, 10),
        hd: ell(0.036, 0.9, 0.85, 1.35, sk, 10), th: ell(0.014, 1, 1, 2.4, sk, 6) };
      g.add(a.up.m, a.lo.m, a.sh, a.el, a.hd, a.th); return a;
    });
    const S = new THREE.Vector3(), Hp = new THREE.Vector3(), HINTA = new THREE.Vector3(), HINTL = new THREE.Vector3(), d = new THREE.Vector3();
    /* H: dua target tangan, F: dua target telapak (koordinat g). hintA/hintL opsional */
    function pose(H, F, hintA, hintL) {
      torso.updateMatrix();
      arms.forEach((a, i) => {
        S.set(a.s * 0.19, 0.5, -0.01).applyMatrix4(torso.matrix);
        const k = ik(S, H[i], 0.29, 0.27, hintA ? hintA[i] : HINTA.set(a.s * 0.6, -0.8, -0.4));
        a.sh.position.copy(S); a.up.set(S, k.elbow); a.lo.set(k.elbow, k.hand); a.el.position.copy(k.elbow);
        d.subVectors(k.hand, k.elbow).normalize(); a.hd.position.copy(k.hand).addScaledVector(d, 0.03);
        a.hd.quaternion.setFromUnitVectors(UP, d); a.hd.rotateX(Math.PI / 2);
        a.th.position.copy(k.hand).addScaledVector(d, 0.02).add(HINTA.set(-a.s * 0.025, 0, 0.02)); a.th.quaternion.copy(a.hd.quaternion);
      });
      legs.forEach((l, i) => {
        Hp.set(l.s * 0.092, -0.02, 0).applyMatrix4(torso.matrix); const A = F[i];
        const k = ik(Hp, d.set(A.x, A.y + 0.07, A.z), 0.43, 0.42, hintL ? hintL[i] : HINTL.set(0, 0.2, 1));
        l.th.set(Hp, k.elbow); l.sh.set(k.elbow, k.hand); l.kn.position.copy(k.elbow); l.ft.position.set(A.x, A.y + 0.024, A.z + 0.05);
      });
    }
    return { g, torso, head: hd, pose, arms, legs, HIP, skirt };
  }
  return { batik, cloth, plain, skinMat, SKIN, weave, ell, lath, head, body, std, rep, hex };
})();

/* ---------- Perahu: jukung bercadik khas Nusantara ----------
   Lambung ramping dicat cerah dengan mata di haluan, haluan berukir gajah mina, ekor ikan di buritan, dua cadik bambu.
   Juru galah berbaju batik, bersarung dan bercaping; penumpang berkebaya dengan payung geulis; anak kecil dan bakul buah. */
function buildBoat() {
  const boat = new THREE.Group(), body = new THREE.Group(); boat.add(body);
  const LEN = 5.6, HL = LEN / 2, TH = 0.03, std = PK.std, plain = PK.plain, ell = PK.ell;

  /* ====== Lambung. a: 0 di tengah, 1 di ujung. Garis air di y=0. ====== */
  const Bg = a => 0.5 * Math.sqrt(Math.max(1 - Math.pow(a, 2.4), 0)) + 0.022;
  const Gy = a => 0.3 + 0.3 * Math.pow(a, 3);
  const Yb = a => -0.17 + 0.27 * Math.pow(a, 2.2);
  const aOf = z => Math.min(Math.abs(z) / HL, 1);
  const sec = (a, t, k) => {
    const o = k ? TH : 0, bg = Math.max(Bg(a) - o, 0.004), yb = Yb(a) + o, gy = Gy(a) - (k ? 0.012 : 0), s = Math.abs(t);
    return [t * bg * (0.7 + 0.3 * Math.pow(s, 1.4)), yb + (gy - yb) * Math.pow(s, 4)];
  };
  const xAt = (z, y) => {
    const a = aOf(z), bg = Math.max(Bg(a) - TH, 0.004), yb = Yb(a) + TH, gy = Gy(a) - 0.012;
    const s = Math.pow(clamp((y - yb) / (gy - yb), 0, 1), 0.25);
    return s * bg * (0.7 + 0.3 * Math.pow(s, 1.4));
  };
  const flT = z => Math.max(-0.11, Yb(aOf(z)) + 0.07);

  /* cat lambung: badan putih gading, pita merah-kuning-biru di bibir, motif tumpal, mata di haluan, lunas hijau tua */
  const paintTex = canvasTex(1024, 256, (c, w, h) => {
    const r = mulberry32(5);
    c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(${r() < 0.5 ? '120,100,70' : '255,255,255'},${0.05 + r() * 0.08})`; c.lineWidth = 1 + r() * 2; const y = r() * h; c.beginPath(); c.moveTo(r() * w, y); c.lineTo(r() * w, y + (r() - 0.5) * 4); c.stroke(); }
    const band = (y0, y1, col) => { c.fillStyle = col; c.fillRect(0, y0 * h, w, (y1 - y0) * h); c.fillRect(0, (1 - y1) * h, w, (y1 - y0) * h); };
    band(0, 0.045, '#b3261e'); band(0.045, 0.07, '#f2c230'); band(0.07, 0.1, '#1f5fa8'); band(0.1, 0.112, '#f2c230');
    c.fillStyle = '#b3261e';                                                            // tumpal (segitiga) di bawah pita
    for (let x = 0; x < w; x += 24) for (const yy of [0.112, 0.888]) {
      const y = yy * h, dir = yy < 0.5 ? 1 : -1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + dir * 16); c.lineTo(x + 24, y); c.fill();
    }
    const kg = c.createLinearGradient(0, 0.3 * h, 0, 0.5 * h); kg.addColorStop(0, 'rgba(24,70,60,0)'); kg.addColorStop(0.35, '#1f4a40'); kg.addColorStop(1, '#173a32');
    c.fillStyle = kg; c.fillRect(0, 0.3 * h, w, 0.2 * h);
    const kg2 = c.createLinearGradient(0, 0.7 * h, 0, 0.5 * h); kg2.addColorStop(0, 'rgba(24,70,60,0)'); kg2.addColorStop(0.35, '#1f4a40'); kg2.addColorStop(1, '#173a32');
    c.fillStyle = kg2; c.fillRect(0, 0.5 * h, w, 0.2 * h);
    [0.2, 0.8].forEach(v => {                                                           // mata penjaga di haluan
      const x = 0.9 * w, y = v * h;
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, 34, 17, 0, 0, 6.283); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#d83a22'; c.beginPath(); c.arc(x, y, 12, 0, 6.283); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 44, y + (v < 0.5 ? -14 : 14)); c.quadraticCurveTo(x, y + (v < 0.5 ? -34 : 34), x + 46, y + (v < 0.5 ? -10 : 10)); c.stroke();
    });
    c.fillStyle = '#1f5fa8'; c.font = 'bold 30px serif'; c.textAlign = 'center';            // nama perahu di buritan
    c.save(); c.translate(0.2 * w, 0.24 * h); c.scale(-1, 1); c.fillText('SEKAR LOKA', 0, 0); c.restore();   // sisi kanan: dicerminkan agar terbaca
    c.save(); c.translate(0.2 * w, 0.8 * h); c.scale(1, -1); c.fillText('SEKAR LOKA', 0, 10); c.restore();
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(70,50,30,${0.05 + r() * 0.1})`; c.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 2); }  // cat terkelupas
  });
  paintTex.anisotropy = 4;
  const woodTex = canvasTex(512, 128, (c, w, h) => {
    const r = mulberry32(9); c.fillStyle = '#8a5a34'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(40,20,8,0.25)' : 'rgba(200,150,100,0.15)'; c.lineWidth = 0.6 + r() * 1.4; const y = r() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.6, y + (r() - 0.5) * 6, w, y + (r() - 0.5) * 4); c.stroke(); }
  }, true);
  woodTex.repeat.set(3, 1);
  const hullMat = std({ map: paintTex, bumpMap: paintTex, bumpScale: 0.6, roughness: 0.55, side: THREE.DoubleSide });
  const inMat = std({ map: woodTex, bumpMap: woodTex, bumpScale: 1.2, roughness: 0.82, side: THREE.DoubleSide });
  const teak = std({ map: woodTex, roughness: 0.75 });
  const red = plain([0.6, 0.1, 0.07], 0.5), yellow = plain([0.92, 0.7, 0.16], 0.5), blue = plain([0.1, 0.3, 0.6], 0.5);
  const gold = plain([0.85, 0.66, 0.26], 0.35, 0.6), ivory = plain([0.95, 0.92, 0.84], 0.4), black = plain([0.03, 0.03, 0.03], 0.3);
  const bambooTex = canvasTex(64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#8f8540'); g.addColorStop(0.5, '#c4b462'); g.addColorStop(1, '#8f8540');
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(70,60,20,0.7)'; c.fillRect(0, 0, w, 5); c.fillStyle = 'rgba(240,230,170,0.5)'; c.fillRect(0, 5, w, 2);
    const r = mulberry32(4); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(90,80,30,${0.1 + r() * 0.15})`; c.fillRect(r() * w, r() * h, 1, 10 + r() * 30); }
  }, true);
  const bamboo = std({ map: bambooTex, roughness: 0.55 });

  body.add(new THREE.Mesh(grid(80, 32, (u, v) => { const p = sec(Math.abs(2 * u - 1), v * 2 - 1, 0); return [p[0], p[1], (u - 0.5) * LEN]; }), hullMat));
  body.add(new THREE.Mesh(grid(80, 32, (u, v) => { const p = sec(Math.abs(2 * u - 1), v * 2 - 1, 1); return [p[0], p[1], (u - 0.5) * LEN]; }), inMat));
  const rail = (off, y0, r, mat) => [-1, 1].forEach(sd => {
    const pts = []; for (let i = 0; i <= 44; i++) { const u = i / 44, a = Math.abs(2 * u - 1); pts.push(V3(sd * Math.max(Bg(a) - off, 0.004), Gy(a) + y0, (u - 0.5) * LEN)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, r, 8), mat));
  });
  rail(0, 0.004, 0.03, red); rail(0.04, -0.01, 0.012, yellow);
  for (let z = -1.6; z < 1.7; z += 0.14) {                                                // papan lantai di tengah
    const zc = z + 0.07, y = flT(zc), w = xAt(zc, y) * 2 - 0.02; if (w < 0.12) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.024, 0.13), teak); b.position.set(0, y - 0.012, zc); body.add(b);
  }
  [-1.2, 0.35, 1.55].forEach(z => {                                                       // bangku pelintang
    const a = aOf(z), b = new THREE.Mesh(new THREE.BoxGeometry(2 * 0.95 * (Bg(a) - TH), 0.04, 0.16), teak); b.position.set(0, Gy(a) - 0.09, z); body.add(b);
  });

  /* ====== Haluan gajah mina (kepala gajah, belalai menggulung, mahkota emas) dan ekor ikan di buritan ====== */
  const acc = new TubeAcc();
  acc.tube([V3(0, Gy(1) - 0.08, HL - 0.08), V3(0, Gy(1) + 0.1, HL + 0.12), V3(0, Gy(1) + 0.34, HL + 0.26), V3(0, Gy(1) + 0.56, HL + 0.34)], 0.085, 0.06, 10, 14);
  acc.tube([V3(0, Gy(1) - 0.08, -HL + 0.08), V3(0, Gy(1) + 0.12, -HL - 0.12), V3(0, Gy(1) + 0.36, -HL - 0.22), V3(0, Gy(1) + 0.58, -HL - 0.2)], 0.08, 0.035, 10, 14);
  const neckTex = canvasTex(64, 256, (c, w, h) => {
    c.fillStyle = '#b3261e'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { c.fillStyle = '#f2c230'; c.fillRect(0, y, w, 6); c.fillStyle = '#1f5fa8'; c.fillRect(0, y + 6, w, 4); c.fillStyle = '#f2c230'; for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x + 8, y + 22); c.lineTo(x + 16, y + 10); c.fill(); } }
  }, true);
  const neckMat = std({ map: neckTex, roughness: 0.5 });
  body.add(new THREE.Mesh(acc.geo(), neckMat));
  const hz = HL + 0.42, hy = Gy(1) + 0.64;
  const gh = ell(0.15, 0.82, 0.86, 1.15, red, 20); gh.position.set(0, hy, hz); body.add(gh);
  const fore = ell(0.11, 0.9, 0.8, 0.8, gold, 14); fore.position.set(0, hy + 0.06, hz + 0.08); body.add(fore);
  const trunk = new TubeAcc();
  trunk.tube([V3(0, hy - 0.02, hz + 0.14), V3(0, hy - 0.12, hz + 0.26), V3(0, hy - 0.3, hz + 0.27), V3(0, hy - 0.38, hz + 0.18), V3(0, hy - 0.3, hz + 0.1)], 0.06, 0.022, 8, 18);
  body.add(new THREE.Mesh(trunk.geo(), red));
  [-1, 1].forEach(s => {
    const ear = ell(0.15, 0.18, 1, 0.75, gold, 12); ear.position.set(s * 0.13, hy + 0.02, hz - 0.04); ear.rotation.y = s * 0.5; body.add(ear);
    const ein = ell(0.11, 0.12, 0.85, 0.6, blue, 10); ein.position.set(s * 0.15, hy + 0.02, hz - 0.03); ein.rotation.y = s * 0.5; body.add(ein);
    const ew = ell(0.022, 1, 0.8, 0.6, ivory, 10); ew.position.set(s * 0.075, hy + 0.06, hz + 0.135); body.add(ew);
    const ep = ell(0.011, 1, 1, 0.6, black, 8); ep.position.set(s * 0.077, hy + 0.06, hz + 0.152); body.add(ep);
    const tk = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.16, 8), ivory); tk.position.set(s * 0.06, hy - 0.1, hz + 0.18); tk.rotation.x = 2.2; body.add(tk);
  });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 8), gold); crown.position.set(0, hy + 0.2, hz - 0.02); body.add(crown);
  const crownB = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 16), gold); crownB.rotation.x = Math.PI / 2; crownB.position.set(0, hy + 0.11, hz - 0.02); body.add(crownB);
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.bezierCurveTo(0.1, 0.12, 0.28, 0.2, 0.36, 0.42); tail.bezierCurveTo(0.18, 0.3, 0.05, 0.26, 0, 0.22);
  tail.bezierCurveTo(-0.05, 0.26, -0.18, 0.3, -0.36, 0.42); tail.bezierCurveTo(-0.28, 0.2, -0.1, 0.12, 0, 0);
  const tailM = new THREE.Mesh(new THREE.ShapeGeometry(tail, 12), std({ color: new THREE.Color(0.95, 0.72, 0.18), roughness: 0.5, side: THREE.DoubleSide }));
  tailM.position.set(0, Gy(1) + 0.56, -HL - 0.2); tailM.rotation.y = Math.PI / 2; body.add(tailM);

  /* ====== Cadik: dua lengan bambu melengkung (iwa) dan dua pelampung bambu (katir) ====== */
  const OX = 2.0;
  [1.55, 0.05].forEach(z => [-1, 1].forEach(s => {
    const a = aOf(z), pts = [V3(s * 0.05, Gy(a) + 0.05, z), V3(s * 0.7, Gy(a) + 0.2, z), V3(s * 1.4, 0.58, z), V3(s * 1.85, 0.36, z), V3(s * OX, 0.1, z)];
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.032, 8), bamboo));
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 12), plain([0.5, 0.4, 0.25], 1)); lash.position.set(s * OX, 0.1, z); lash.rotation.y = Math.PI / 2; body.add(lash);
  }));
  [-1, 1].forEach(s => {
    const f = new TubeAcc();
    f.tube([V3(s * OX, 0.2, -1.55), V3(s * OX, 0.05, -1.15), V3(s * OX, 0.02, 0.8), V3(s * OX, 0.05, 2.6), V3(s * OX, 0.22, 3.0)], 0.07, 0.05, 10, 30);
    body.add(new THREE.Mesh(f.geo(), bamboo));
    for (let z = -1.0; z < 2.6; z += 0.55) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.008, 5, 14), plain([0.45, 0.4, 0.18], 0.7)); n.position.set(s * OX, 0.03, z); body.add(n); }
  });

  /* ====== Lampu gantung di tiang bambu haluan + bendera merah putih ====== */
  const LZ = 2.05, py0 = flT(LZ);
  const pole = new Seg(0.022, 0.017, bamboo); pole.set(V3(0, py0, LZ), V3(0, 1.62, LZ)); body.add(pole.m);
  const arm = new Seg(0.013, 0.013, bamboo, 6); arm.set(V3(0, 1.32, LZ), V3(0, 1.36, LZ + 0.3)); body.add(arm.m);
  const LY = 1.08, LP = V3(0, LY, LZ + 0.3);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.8) })); glass.position.copy(LP); body.add(glass);
  [0.12, -0.11].forEach((dy, i) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(i ? 0.05 : 0.03, i ? 0.07 : 0.09, 0.05, 6), gold); cap.position.set(0, LY + dy, LZ + 0.3); body.add(cap); });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), gold); b.position.set(Math.cos(a) * 0.072, LY, LZ + 0.3 + Math.sin(a) * 0.072); body.add(b); }
  const cord = new Seg(0.004, 0.004, black, 4); cord.set(V3(0, 1.35, LZ + 0.3), V3(0, LY + 0.14, LZ + 0.3)); body.add(cord.m);
  const glowTex = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,205,135,0.9)'); g.addColorStop(0.35, 'rgba(255,150,70,0.3)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.copy(LP); glow.scale.set(1.4, 1.4, 1); body.add(glow);
  const lamp = new THREE.PointLight(0xffa060, 0.9, 8, 2); lamp.position.copy(LP); body.add(lamp);
  const flagTex = canvasTex(32, 32, (c, w, h) => { c.fillStyle = '#d1201b'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f7f4ee'; c.fillRect(0, h / 2, w, h / 2); });
  const flagG = new THREE.PlaneGeometry(0.42, 0.28, 10, 2); flagG.translate(-0.21, 0, 0);
  const flag = new THREE.Mesh(flagG, std({ map: flagTex, roughness: 0.9, side: THREE.DoubleSide })); flag.position.set(0, 1.5, LZ); flag.rotation.y = -Math.PI / 2; body.add(flag);
  const flagBase = Float32Array.from(flagG.attributes.position.array);

  /* ====== Bakul buah dan bunga (jeruk, rambutan, manggis, pisang, kamboja) ====== */
  const basketMat = std({ map: PK.rep(PK.weave('#9a7740', 31), 6, 1), roughness: 0.95, side: THREE.DoubleSide });
  const fruit = [], fm = new THREE.Matrix4(), rr = mulberry32(61);
  const basket = (x, z, r0, kinds) => {
    const y0 = flT(z), b = PK.lath([[r0 * 0.7, 0], [r0, 0.12], [r0 * 1.05, 0.16], [r0 * 1.0, 0.17]], basketMat, 20); b.position.set(x, y0, z); body.add(b);
    for (let i = 0; i < 16; i++) {
      const k = kinds[(rr() * kinds.length) | 0], a = rr() * 6.283, d = Math.sqrt(rr()) * r0 * 0.75, y = y0 + 0.13 + rr() * 0.06 * (1 - d / r0);
      const p = V3(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
      if (k === 'pisang') { for (let j = 0; j < 4; j++) { fm.compose(V3(p.x + j * 0.022, p.y + 0.02, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, a, 1.4 + j * 0.08)), V3(0.022, 0.13, 0.022)); fruit.push({ g: new THREE.CylinderGeometry(0.8, 1, 1, 6), m: fm.clone(), c: [0.92, 0.78, 0.2] }); } continue; }
      const col = { jeruk: [0.95, 0.52, 0.1], rambutan: [0.75, 0.1, 0.08], manggis: [0.28, 0.06, 0.16], salak: [0.42, 0.22, 0.12], kamboja: [0.98, 0.95, 0.85] }[k];
      const s = k === 'kamboja' ? 0.035 : (k === 'jeruk' ? 0.045 : 0.035);
      fm.compose(p, QI, V3(s, k === 'kamboja' ? s * 0.4 : s, s)); fruit.push({ g: new THREE.IcosahedronGeometry(1, 1), m: fm.clone(), c: col });
    }
  };
  basket(0.12, 1.32, 0.2, ['jeruk', 'jeruk', 'rambutan', 'pisang']); basket(-0.14, 1.0, 0.17, ['manggis', 'salak', 'rambutan']);
  basket(0.15, -0.55, 0.18, ['kamboja', 'kamboja', 'jeruk']); basket(-0.15, -0.85, 0.16, ['pisang', 'salak']);
  body.add(new THREE.Mesh(mergeG(fruit), std({ vertexColors: true, roughness: 0.55 })));

  /* ====== Juru galah: kemeja batik parang, sarung kotak, celana komprang hitam, caping di atas ikat kepala ====== */
  const ZB = -1.95, fy = z => flT(z) + 0.022;
  const rower = PK.body({
    skin: PK.SKIN.sawo, top: PK.cloth('parang', '#e8d6b0', '#6b3a1a', '#24304a', 2, 2), low: PK.plain([0.06, 0.06, 0.07], 0.95),
    sarung: PK.cloth('kotak', '#7a1f24', '#2a3f6a', '#e8c65a', 2, 1), hat: 'caping', iket: true, mustache: true
  });
  body.add(rower.g);
  const footT = [V3(-0.15, fy(ZB - 0.2), ZB - 0.2), V3(0.14, fy(ZB + 0.15), ZB + 0.15)];
  const HIP0 = (footT[0].y + footT[1].y) / 2 + rower.HIP + 0.02;
  const pl = new Seg(0.024, 0.017, bamboo); body.add(pl.m);

  /* ====== Penumpang: kebaya brokat, kain batik sogan, selendang, sanggul berhias melati, payung geulis ====== */
  const PZ = 0.72, pf = flT(PZ);
  const pg = new THREE.Group(); pg.position.set(-0.02, pf, PZ); pg.rotation.y = 0.55; body.add(pg);
  const tikar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), std({ map: PK.rep(PK.weave('#c8a86a', 77), 3, 3), roughness: 0.95 })); tikar.position.y = 0.01; pg.add(tikar);
  const kainM = PK.cloth('parang', '#5a3418', '#e2c792', '#1b1410', 3, 2);
  const kebM = PK.cloth('brokat', '#f4e7ea', '#d9a6b6', '#c07d93', 2, 2, 0.8);
  const seat = PK.lath([[0.001, 0.0], [0.32, 0.02], [0.35, 0.08], [0.32, 0.16], [0.24, 0.24], [0.18, 0.3], [0.001, 0.31]], kainM, 26, 1.0, 0.92); seat.position.y = 0.02; pg.add(seat);
  [-1, 1].forEach(s => { const kn = ell(0.11, 1, 0.75, 1.3, kainM, 12); kn.position.set(s * 0.11, 0.12, 0.2); pg.add(kn); });
  const feet = ell(0.04, 1.6, 0.5, 0.9, PK.skinMat(PK.SKIN.kuning), 10); feet.position.set(0.24, 0.04, -0.14); pg.add(feet);
  const ptorso = new THREE.Group(); ptorso.position.y = 0.27; pg.add(ptorso);
  ptorso.add(PK.lath([[0.001, -0.02], [0.2, -0.02], [0.2, 0.05], [0.165, 0.12], [0.13, 0.22], [0.142, 0.34], [0.162, 0.46], [0.16, 0.53], [0.11, 0.575], [0.05, 0.595], [0.001, 0.6]], kebM, 28, 1.05, 0.76));
  const selM = PK.plain([0.78, 0.18, 0.42], 0.75);
  ptorso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.16, 0.56, -0.02), V3(-0.12, 0.44, 0.13), V3(0.02, 0.28, 0.15), V3(0.17, 0.12, 0.12), V3(0.24, 0.0, 0.02)]), 20, 0.03, 5), selM));
  ptorso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.16, 0.56, -0.02), V3(-0.18, 0.4, -0.13), V3(-0.22, 0.15, -0.16), V3(-0.27, -0.12, -0.1)]), 16, 0.028, 5), selM));
  const brooch = ell(0.02, 1, 1, 0.5, gold, 8); brooch.position.set(0, 0.5, 0.12); ptorso.add(brooch);
  const pneck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 12), PK.skinMat(PK.SKIN.kuning)); pneck.position.y = 0.63; ptorso.add(pneck);
  const phead = PK.head({ skin: PK.SKIN.kuning, female: true, melati: true, earring: true, pin: true }); phead.position.y = 0.74; ptorso.add(phead);
  const psk = PK.skinMat(PK.SKIN.kuning);
  const pArms = [-1, 1].map(s => {
    const o = { s, up: new Seg(0.048, 0.04, kebM, 12), lo: new Seg(0.04, 0.032, kebM, 12), sh: ell(0.054, 1, 1, 1, kebM, 10), el: ell(0.041, 1, 1, 1, kebM, 8), hd: ell(0.033, 0.9, 0.85, 1.3, psk, 8) };
    pg.add(o.up.m, o.lo.m, o.sh, o.el, o.hd); return o;
  });
  /* payung geulis: kanopi bercorak bunga dengan pinggiran rumbai, rusuk bambu tipis di bawahnya */
  const geulis = canvasTex(256, 512, (c, w, h) => {
    const bands = [[0, 0.1, '#f1c232'], [0.1, 0.48, '#c6282b'], [0.48, 0.54, '#f1c232'], [0.54, 0.88, '#1e7a5a'], [0.88, 0.94, '#f1c232'], [0.94, 1, '#c6282b']];
    bands.forEach(b => { c.fillStyle = b[2]; c.fillRect(b[0] * w, 0, (b[1] - b[0]) * w, h); });
    const flower = (x, y, s, pc, cc) => { for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.fillStyle = pc; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.45, s * 0.3, a, 0, 6.283); c.fill(); } c.fillStyle = cc; c.beginPath(); c.arc(x, y, s * 0.25, 0, 6.283); c.fill(); };
    for (let i = 0; i < 12; i++) {
      const y = (i + 0.5) / 12 * h;
      flower(0.3 * w, y, 26, '#fbe3e8', '#f1c232'); c.strokeStyle = '#2f7d4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0.18 * w, y - 18); c.quadraticCurveTo(0.24 * w, y, 0.18 * w, y + 18); c.stroke();
      flower(0.72 * w, y + h / 24, 20, '#f6d27a', '#c6282b'); flower(0.82 * w, y + h / 48, 9, '#fff', '#c6282b');
    }
    for (let y = 0; y < h; y += h / 24) { c.fillStyle = 'rgba(40,20,10,0.35)'; c.fillRect(0, y, w, 1.5); }
  }, true);
  const umb = new THREE.Group(), UR = 0.6;
  umb.add(new THREE.Mesh(grid(14, 48, (u, v) => { const a = v * Math.PI * 2, r = UR * u; return [Math.cos(a) * r, 0.24 * (1 - Math.pow(u, 1.6)), Math.sin(a) * r]; }),
    new THREE.MeshLambertMaterial({ map: geulis, side: THREE.DoubleSide, emissive: new THREE.Color(0.08, 0.03, 0.03) })));
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, rb = new Seg(0.004, 0.004, bamboo, 4); rb.set(V3(0, -0.28, 0), V3(Math.cos(a) * UR * 0.55, 0.13, Math.sin(a) * UR * 0.55)); umb.add(rb.m);
    const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.07, 4), yellow); fr.position.set(Math.cos(a + 0.13) * UR, -0.035, Math.sin(a + 0.13) * UR); umb.add(fr);
  }
  const ushaft = new Seg(0.013, 0.011, teak); ushaft.set(V3(0, -1.0, 0), V3(0, 0.26, 0)); umb.add(ushaft.m);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 8), gold); fin.position.y = 0.3; umb.add(fin);
  const G = V3(0.24, 0.62, 0.25), dU = V3(-0.12, 1, -0.2).normalize();
  umb.quaternion.setFromUnitVectors(UP, dU); umb.position.copy(G).addScaledVector(dU, 0.82); pg.add(umb);
  const PS = [V3(-0.17, 0.27 + 0.51, -0.01), V3(0.17, 0.27 + 0.51, -0.01)], PT = [V3(-0.08, 0.3, 0.26), G], PH = [V3(-0.6, -0.7, -0.3), V3(0.7, -0.5, -0.6)];
  pArms.forEach((a, i) => { const k = ik(PS[i], PT[i], 0.29, 0.27, PH[i]); a.sh.position.copy(PS[i]); a.up.set(PS[i], k.elbow); a.lo.set(k.elbow, k.hand); a.el.position.copy(k.elbow); a.hd.position.copy(k.hand); });

  /* ====== Anak kecil duduk di bangku haluan, sesekali melambai ====== */
  const kid = PK.body({ skin: PK.SKIN.sawo, top: PK.plain([0.85, 0.2, 0.15], 0.85), low: PK.plain([0.15, 0.25, 0.5], 0.9), hat: 'peci' });
  kid.g.scale.setScalar(0.6); kid.g.position.set(0.0, Gy(aOf(1.55)) - 0.09 + 0.02 - 0.6 * 0.86, 1.55); kid.g.rotation.y = 1.15; body.add(kid.g);
  const KH = [V3(-0.2, 0.75, 0.25), V3(0.2, 0.75, 0.25)], KF = [V3(-0.1, 0.3, 0.45), V3(0.1, 0.3, 0.45)], KHint = [V3(0, 0.6, 1), V3(0, 0.6, 1)];

  /* ====== Animasi: galah mengayuh, napas, goyangan perahu, bendera berkibar ====== */
  const state = { phase: 0 };
  const TT = new THREE.Vector3(), UU = new THREE.Vector3(), lowH = new THREE.Vector3();
  const rArmHint = [V3(-0.7, -0.8, -0.2), V3(0.7, -0.8, -0.2)], rLegHint = [V3(-0.1, 0.1, 1), V3(0.1, 0.1, 1)];
  function update(t, dt, speed01) {
    state.phase = (state.phase + dt * (0.12 + speed01 * 0.33)) % 1;
    const ph = state.phase, push = ph < 0.6, s = push ? ph / 0.6 : 0, e = push ? 0 : (ph - 0.6) / 0.4;
    const es = s * s * (3 - 2 * s), ee = e * e * (3 - 2 * e);
    const amp = 0.35 + 0.65 * clamp(speed01 * 1.4, 0, 1);
    const tz = push ? lerp(-0.4, -2.4, es) : lerp(-2.4, -0.4, ee);
    const ty = push ? -0.9 : -0.9 + 1.3 * Math.sin(Math.PI * ee);
    TT.set(1.0, ty, tz);
    const uz = push ? lerp(-1.55, -2.05, es) : lerp(-2.05, -1.55, ee);
    UU.set(0.4, HIP0 + 0.62 - 0.15 * Math.sin(Math.PI * (push ? s : e)), uz);
    const pushK = push ? Math.sin(Math.PI * s) : 0, bend = 0.07 * amp * pushK;
    rower.torso.position.set(0, HIP0 - bend, ZB - 0.02 + 0.06 * amp * pushK);
    rower.torso.rotation.set(0.05 + 0.22 * amp * pushK + 0.006 * Math.sin(t * 1.6), -0.12 * amp * pushK + 0.03 * Math.sin(t * 0.5), 0.02 * Math.sin(t * 0.9));
    rower.head.rotation.set(0.05 - 0.12 * amp * pushK, 0.18 * Math.sin(t * 0.37) - 0.06, 0);
    const dn = UU.clone().sub(TT).normalize();
    pl.set(TT, TT.clone().addScaledVector(dn, 3.4));
    lowH.copy(TT).addScaledVector(dn, UU.distanceTo(TT) - 0.55);
    rower.pose([lowH, UU], footT, rArmHint, rLegHint);
    ptorso.scale.y = 1 + 0.006 * Math.sin(t * 1.5); phead.rotation.y = 0.15 * Math.sin(t * 0.3 + 1) - 0.1;
    umb.quaternion.setFromUnitVectors(UP, dU); umb.rotateY(t * 0.25);
    const wave = sstep(0.55, 0.9, Math.sin(t * 0.45));
    KH[1].set(0.22, lerp(0.75, 1.35 + 0.06 * Math.sin(t * 9), wave), lerp(0.25, 0.12, wave));
    kid.head.rotation.y = 0.3 * Math.sin(t * 0.5);
    kid.pose(KH, KF, null, KHint);
    const fp = flagG.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3], k = -x / 0.42; fp.setZ(i, Math.sin(t * 7 + x * 14) * 0.035 * k); }
    fp.needsUpdate = true;
    body.position.y = 0.012 * Math.sin(t * 1.7);
    body.rotation.z = 0.012 * Math.sin(t * 1.1) + 0.008 * Math.sin(t * 0.7 + 1);
    body.rotation.x = 0.008 * Math.sin(t * 1.4 + 2) - 0.012 * speed01;
    lamp.intensity = 0.8 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    glow.scale.setScalar(1.35 + 0.1 * Math.sin(t * 5.1));
  }
  boat.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  /* gabungkan bagian statis (lambung, cadik, haluan, bakul, tikar...) menjadi satu mesh per material */
  bakeStatic(body, [rower.g, kid.g, pl.m, flag, umb, ptorso]);
  return { group: boat, update, state };
}
