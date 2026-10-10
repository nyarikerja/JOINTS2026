/* ---------- Batu basah dan berlumut di dekat air (dipakai gerbang dan jembatan) ----------
   Teknik diadaptasi dari utsuroi (src/garden/terrain.js, structures.js; MIT, (c) 2026 Bill Chan):
   permukaan menggelap dan mengilap mendekati garis air, lumut tumbuh di bidang yang menghadap ke atas. */
function weatherMat(mat, key, o) {
  o = o || {};
  const wetH = (o.wet != null ? o.wet : 1.2).toFixed(2), moss = (o.moss != null ? o.moss : 0.8).toFixed(2);
  mat.customProgramCacheKey = () => 'wm_' + key;
  mat.onBeforeCompile = (s) => {
    s.vertexShader = 'varying vec3 vWmP;\nvarying vec3 vWmN;\n' + s.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
 { vec4 wq = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
 wq = instanceMatrix * wq;
#endif
 vWmP = (modelMatrix * wq).xyz; vWmN = normalize(mat3(modelMatrix) * objectNormal); }`);
    s.fragmentShader = 'varying vec3 vWmP;\nvarying vec3 vWmN;\n' + GLSL_NOISE + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
 float wmWet = 1.0 - smoothstep(-0.1, ${wetH}, vWmP.y);
 float wmN = fbm(vWmP.xz * 1.7 + vWmP.y * 0.9);
 float wmMoss = smoothstep(0.35, 0.85, vWmN.y) * smoothstep(0.42, 0.7, wmN) * ${moss};
 wmMoss = max(wmMoss, (1.0 - smoothstep(0.2, 1.6, vWmP.y)) * smoothstep(0.5, 0.75, wmN) * ${moss} * 0.85);
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.08) * (0.7 + 0.6 * wmN), clamp(wmMoss, 0.0, 0.9));
 diffuseColor.rgb *= mix(1.0, 0.52, wmWet);
 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.9, 0.8), smoothstep(0.25, -0.05, vWmP.y) * 0.6);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
 roughnessFactor = mix(roughnessFactor, 0.28, wmWet * 0.85);`);
  };
  return mat;
}

/* ---------- Gerbang candi bentar + kabut ----------
   Bangunan gerbang terbelah khas Bali/Majapahit dari bata merah dan batu andesit, berdiri di kedua tepi sungai.
   Di celah dan di baliknya menggantung kabut tebal; perahu yang lewat lenyap di dalamnya saat aplikasi dibuka. */
function buildGate() {
  const GZ = GATE.z, ox = cx(GZ), th = Math.atan(cxd(GZ));
  const root = new THREE.Group(); root.position.set(ox, 0, GZ); root.rotation.y = th;
  const r = mulberry32(141);

  const brickTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#6e3a26'; c.fillRect(0, 0, w, h);
    const bh = 16, bw = 46;
    for (let y = 0, row = 0; y < h; y += bh, row++) {
      for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
        const k = 0.78 + r() * 0.42, hue = r();
        c.fillStyle = `rgb(${(168 + hue * 24) * k | 0},${(84 + hue * 18) * k | 0},${(52 + hue * 10) * k | 0})`;
        c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '40,20,10' : '230,190,150'},${0.08 + r() * 0.1})`; c.fillRect(x + 2 + r() * (bw - 8), y + 2 + r() * (bh - 6), 2 + r() * 5, 1 + r() * 2); }
      }
    }
  }, true);
  const stoneTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5d5c57'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const k = r(); c.fillStyle = `rgba(${k < 0.5 ? '30,30,28' : '160,158,150'},${0.05 + r() * 0.12})`; c.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3); }
    c.strokeStyle = 'rgba(25,25,22,0.55)'; c.lineWidth = 2;
    for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 64 % 2) * 48; x < w; x += 96) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); } }
  }, true);
  const carveTex = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#55544f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(20,20,18,0.8)'; c.lineWidth = 3;
    for (let y = 18; y < h; y += 44) {      // sulur kala-makara yang disederhanakan
      c.beginPath(); c.moveTo(w / 2, y); c.bezierCurveTo(w * 0.1, y - 10, w * 0.1, y + 24, w / 2, y + 22); c.bezierCurveTo(w * 0.9, y + 24, w * 0.9, y - 10, w / 2, y); c.stroke();
      c.beginPath(); c.arc(w / 2, y + 11, 5, 0, 6.283); c.stroke();
    }
    c.strokeStyle = 'rgba(190,188,178,0.35)'; c.lineWidth = 1.5; c.strokeRect(6, 6, w - 12, h - 12);
  }, true);
  const std = (o, key, wm) => weatherMat(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o)), key, wm);
  const brick = std({ map: brickTex, bumpMap: brickTex, bumpScale: 0.9, roughness: 0.92 }, 'gBrick', { moss: 0.65 });
  const stone = std({ map: stoneTex, bumpMap: stoneTex, bumpScale: 1.1, roughness: 0.95 }, 'gStone', { moss: 1 });
  const carve = std({ map: carveTex, bumpMap: carveTex, bumpScale: 2.2, roughness: 0.95 }, 'gCarve', { moss: 0.5 });
  brickTex.repeat.set(1.4, 1.4); stoneTex.repeat.set(1, 1);

  const meshes = [];
  const box = (w, h, d, x, y, z, m, rep) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rep) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / rep, uv.getY(i) * h / rep); }
    const b = new THREE.Mesh(g, m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; root.add(b); meshes.push(b); return b;
  };
  const TIERS = [[4.8, 2.6, 3.2], [4.3, 1.9, 2.9], [3.7, 1.5, 2.6], [3.1, 1.25, 2.3], [2.5, 1.05, 2.0], [1.9, 0.9, 1.7], [1.3, 0.75, 1.4]].map(t => t.map(v => v * GATE.s));
  let topY = 0;
  [-1, 1].forEach(s => {
    const xin = s * GATE.gap, out = (w) => xin + s * w / 2;
    box(5.6, 2.2, 3.9, out(5.6), -0.7, 0, stone, 1.6);                 // alas batu yang terendam
    box(5.9, 0.28, 4.2, out(5.9), 0.52, 0, stone, 1.6);
    let y = 0.66;
    TIERS.forEach((t, i) => {
      const [w, h, d] = t;
      box(w, h, d, out(w), y + h / 2, 0, brick, 1.1);
      // panel ukiran andesit di muka depan dan belakang
      if (i < 5) [-1, 1].forEach(f => box(w * 0.34, h * 0.72, 0.08, out(w) + s * w * 0.08, y + h / 2, f * (d / 2 + 0.03), carve, 0));
      // bidang dalam yang "terbelah": pita batu tegak
      box(0.1, h * 0.92, d * 0.5, xin + s * 0.04, y + h / 2, 0, stone, 1.2);
      y += h;
      const cw = w + 0.32, cd = d + 0.32;
      box(cw, 0.24, cd, out(cw) - s * 0.0, y + 0.12, 0, stone, 1.4);
      // antefiks di sudut cornice
      [-1, 1].forEach(f => {
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), stone);
        a.position.set(xin + s * (cw - 0.12), y + 0.44, f * (cd / 2 - 0.12)); a.rotation.y = Math.PI / 4; a.castShadow = true; root.add(a); meshes.push(a);
      });
      y += 0.24;
    });
    box(0.9, 0.7, 1.0, out(0.9), y + 0.35, 0, stone, 0.8);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 8), stone); fin.position.set(out(0.9), y + 1.35, 0); fin.castShadow = true; root.add(fin); meshes.push(fin);
    topY = Math.max(topY, y + 2);
  });

  /* obor di kaki gerbang (cahaya hangat tanpa lampu sungguhan: sprite aditif) */
  const glowTex = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(0.3, 'rgba(255,150,60,0.45)'); g.addColorStop(1, 'rgba(255,110,30,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 });
  const flames = [];
  [-1, 1].forEach(s => {
    const x = s * (GATE.gap + 0.55), z = -2.25;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), darkWood); pole.position.set(x, 0.66 + 1.1, z); root.add(pole); meshes.push(pole);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.22, 8), darkWood); cup.position.set(x, 2.86, z); root.add(cup); meshes.push(cup);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    fl.position.set(x, 3.15, z); fl.scale.set(1.6, 2.1, 1); root.add(fl); flames.push(fl);
  });

  /* kabut gerbang (pengganti portal): lapisan kabut lembut memenuhi celah dan ruang di balik gerbang.
     Perahu yang melewati celah perlahan lenyap ditelan kabut. Sprite biasa, ikut kabut adegan, murah digambar. */
  const fogTex = canvasTex(128, 128, (c, w, h) => {
    const rr = mulberry32(19);
    for (let i = 0; i < 26; i++) {
      const rad = 14 + rr() * 24, x = rad + 4 + rr() * (w - 2 * rad - 8), y = rad + 4 + rr() * (h - 2 * rad - 8), g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    /* pudarkan ke tepi tekstur supaya sprite tidak punya garis tepi yang tegas */
    c.globalCompositeOperation = 'destination-in';
    const v = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); v.addColorStop(0.6, '#000'); v.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = v; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  });
  const veil = [], fogCol = new THREE.Color();
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0.6, fog: false }));
    const z = 0.8 + i * 1.6 + r() * 0.8, sc = 10 + i * 1.4 + r() * 4;
    sp.position.set((r() - 0.5) * 3, 1.6 + r() * 2.6, z); sp.scale.set(sc, sc * 0.62, 1);
    sp.userData = { x: sp.position.x, ph: r() * 6.28, base: 0.5 + 0.35 * (i / 13) };
    root.add(sp); veil.push(sp);
  }
  const center = new THREE.Vector3(0, 0.66 + 4.3, 0);
  /* k: kepekatan kabut gerbang (0..1); dibuat lebih pekat saat perahu masuk */
  function update(t, dt, k, camP) {
    fogCol.copy(U.fogCol.value).multiplyScalar(1.04);
    const d = camP ? camP.distanceTo(root.position) : 0, vis = sstep(90, 30, d);
    veil.forEach((s, i) => {
      s.position.x = s.userData.x + Math.sin(t * 0.12 + s.userData.ph) * 1.4;
      s.material.color.copy(fogCol); s.material.opacity = Math.min(1, s.userData.base * (0.55 + 0.6 * k)) * vis;
    });
    flames.forEach((f, i) => { const fl = 0.85 + 0.15 * Math.sin(t * 13 + i * 2) * Math.sin(t * 7.3 + i); f.scale.set(1.5 * fl, 2.1 * fl, 1); f.material.opacity = 0.9 * fl * vis; });
  }
  function gateCenter() { root.updateMatrixWorld(); return gc.copy(center).applyMatrix4(root.matrixWorld); }
  const gc = new THREE.Vector3();
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  bakeStatic(root);
  return { group: root, update, gateCenter, height: topY };
}
