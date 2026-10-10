/* ---------- Koi di kolam depan gerbang ----------
   Diadaptasi dari utsuroi src/garden/koi.js (MIT, (c) 2026 Bill Chan) dan halcyon src/life/fish.js:
   - satu model koi (CC0, ffish.asia / floraZia.com, versi ringan koi_lo.glb) dipakai ulang lewat InstancedMesh;
   - corak kohaku, sanke, showa, ogon, chagoi, asagi dilukis di fragment shader dari derau (atribut instance aKoi);
   - berenang = gelombang yang merambat kepala -> ekor (amplitudo membesar ke ekor), sirip mengepak;
   - perilaku: target acak, menjauhi tepi dan perairan dangkal, berkelompok longgar, menghindari perahu,
     sesekali naik ke permukaan dan meninggalkan cincin riak di shader air (uRise).
   Ikan digambar di atas air dengan blending: makin dalam dan makin miring sudut pandang, makin tertutup air (Fresnel). */
const KOI_KINDS = [0, 0, 1, 2, 0, 3, 4, 1, 5, 2, 6, 0, 3];
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('gagal memuat ' + src)); document.head.appendChild(s);
  });
}
async function loadKoi(waterU) {
  if (!THREE.GLTFLoader) await loadScript(CFG.vendor + 'GLTFLoader.js');
  if (typeof MeshoptDecoder === 'undefined') await loadScript(CFG.vendor + 'meshopt_decoder.js');
  await MeshoptDecoder.ready;
  const gl = new THREE.GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => gl.load(CFG.koiUrl, res, undefined, rej));
  let src = null; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse(o => { if (o.isMesh && !src) src = o; });
  if (!src) throw new Error('model koi kosong');
  /* atribut terkuantisasi (KHR_mesh_quantization) diubah ke float lalu transformasi node dipanggang */
  const g0 = src.geometry, geo = new THREE.BufferGeometry();
  ['position', 'normal', '_aux'].forEach(n => {
    const a = g0.getAttribute(n); if (!a) return;
    const out = new Float32Array(a.count * a.itemSize);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = get[k].call(a, i);
    geo.setAttribute(n === '_aux' ? 'aAux' : n, new THREE.BufferAttribute(out, a.itemSize));
  });
  if (g0.index) geo.setIndex(Array.from(g0.index.array));
  geo.applyMatrix4(src.matrixWorld);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  g0.dispose(); src.material && src.material.dispose && src.material.dispose();

  const N = CFG.koi, R = mulberry32(808);
  const kind = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) kind.set([KOI_KINDS[i % KOI_KINDS.length], R() * 100, 0.48 + R() * 0.3, R() * 6.283], i * 4);
  geo.setAttribute('aKoi', new THREE.InstancedBufferAttribute(kind, 4));

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  mat.customProgramCacheKey = () => 'koi';
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.time; s.uniforms.uWaterCol = waterU.uDeep; s.uniforms.uSkyAmb = waterU.uSkyAmb;
    s.vertexShader = 'uniform float uTime;\nattribute vec2 aAux;\nattribute vec4 aKoi;\nvarying vec3 vKoiP;\nvarying vec4 vKoi;\nvarying float vPart;\nvarying vec3 vKw;\n' + s.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
 vKoiP = position; vKoi = aKoi; vPart = aAux.y;
 { float t = aAux.x; float speed = 5.0 + aKoi.w;
   float amp = 0.075 * pow(1.0 - t, 1.6) + 0.006;
   float ph = uTime * speed - t * 5.0 + aKoi.y;
   transformed.x += sin(ph) * amp;
   if (aAux.y > 0.5 && aAux.y < 1.5 && abs(position.x) > 0.06) transformed.y += sin(uTime * 3.0 + aKoi.y) * 0.12 * abs(position.x);
   if (aAux.y > 1.5) transformed.x += sin(ph - 1.2) * 0.04; }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
 vKw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    s.fragmentShader = 'uniform float uTime;\nuniform vec3 uWaterCol;\nuniform vec3 uSkyAmb;\nvarying vec3 vKoiP;\nvarying vec4 vKoi;\nvarying float vPart;\nvarying vec3 vKw;\n' + GLSL_NOISE + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
 {
  vec3 p = vKoiP; float k = vKoi.x, sd = vKoi.y;
  vec3 white = vec3(0.92, 0.9, 0.86), red = vec3(0.82, 0.13, 0.035), black = vec3(0.025, 0.025, 0.03);
  vec3 gold = vec3(0.95, 0.62, 0.12), plat = vec3(0.86, 0.86, 0.84), brown = vec3(0.32, 0.2, 0.1), blue = vec3(0.33, 0.42, 0.55);
  float n1 = vn(vec2(p.z * 7.0 + sd, p.x * 9.0 + p.y * 6.0 + sd * 1.3)) * 0.65 + vn(vec2(p.z * 15.0 - sd, p.x * 11.0)) * 0.35;
  float n2 = vn(vec2(p.z * 11.0 - sd, p.y * 8.0 + p.x * 4.0 + sd * 0.7));
  float back = smoothstep(-0.02, 0.06, p.y);
  vec3 c = white;
  if (k < 0.5) c = mix(white, red, smoothstep(0.48, 0.55, n1) * back);
  else if (k < 1.5) { c = mix(white, red, smoothstep(0.5, 0.56, n1) * back); c = mix(c, black, smoothstep(0.7, 0.74, n2) * back); }
  else if (k < 2.5) { c = mix(black, red, smoothstep(0.5, 0.56, n1) * back); c = mix(c, white, smoothstep(0.62, 0.68, n2)); }
  else if (k < 3.5) c = gold * (0.9 + 0.2 * n2);
  else if (k < 4.5) c = plat;
  else if (k < 5.5) c = brown * (0.85 + 0.3 * n2);
  else c = mix(red * 0.9, blue, back);
  /* sisik: jaring halus di punggung */
  vec2 sc = vec2(p.z * 60.0, p.x * 60.0 + p.y * 40.0); vec2 sf = fract(sc + vec2(0.0, floor(sc.x) * 0.5)) - 0.5;
  c *= 1.0 - 0.12 * smoothstep(0.18, 0.32, length(sf)) * back * (1.0 - smoothstep(0.5, 0.9, vPart));
  float fin = smoothstep(0.5, 0.9, vPart);
  c = mix(c, white * 0.95, 0.8 * fin);
  diffuseColor.rgb = c; diffuseColor.a = mix(1.0, 0.75, fin);
 }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
 metalnessFactor = (vKoi.x > 2.5 && vKoi.x < 4.5) ? 0.55 : 0.0;`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
 { /* dilihat menembus air: serapan sepanjang lintasan di bawah permukaan + Fresnel */
  vec3 Vd = normalize(cameraPosition - vKw);
  float under = max(0.0, -vKw.y);
  float path = under / max(Vd.y, 0.12);
  float fres = 0.02 + 0.98 * pow(1.0 - clamp(Vd.y, 0.0, 1.0), 5.0);
  vec3 wc = uWaterCol * uSkyAmb * 1.6;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, wc, 1.0 - exp(-path * 1.15));
  gl_FragColor.a *= (1.0 - fres) * exp(-path * 0.28) * smoothstep(0.0, 0.03, under + 0.02);
 }`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'koi';

  /* agen */
  const pondCX = z => cx(z), deepW = z => rw(z) * 0.55;
  const inPond = (x, z) => z > POND.z0 && z < POND.z1 && Math.abs(x - pondCX(z)) < deepW(z);
  const randomTarget = () => {
    for (let k = 0; k < 40; k++) { const z = POND.z0 + 2 + R() * (POND.z1 - POND.z0 - 4), x = pondCX(z) + (R() * 2 - 1) * deepW(z) * 0.85; if (inPond(x, z)) return new THREE.Vector2(x, z); }
    return new THREE.Vector2(pondCX(125), 125);
  };
  const fish = [];
  for (let i = 0; i < N; i++) fish.push({ p: randomTarget(), v: new THREE.Vector2(R() - 0.5, R() - 0.5).normalize().multiplyScalar(0.2), target: randomTarget(), depth: 0.22 + R() * 0.4, len: kind[i * 4 + 2], yaw: 0, rise: 0, riseT: 3 + R() * 18 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const desire = new THREE.Vector2(), o = new THREE.Vector2(), push = new THREE.Vector2(), boatP = new THREE.Vector2();
  let riseSlot = 0;
  function update(dt, t, bx, bz) {
    boatP.set(bx, bz);
    for (let i = 0; i < N; i++) {
      const f = fish[i];
      if (f.p.distanceTo(f.target) < 0.8 || R() < dt * 0.05) f.target = randomTarget();
      desire.copy(f.target).sub(f.p).normalize().multiplyScalar(0.32);
      /* menjauhi tepi: dorong ke tengah alur dan ke dalam ruas kolam */
      const d = f.p.x - pondCX(f.p.y), lim = deepW(f.p.y);
      if (Math.abs(d) > lim * 0.7) desire.x -= Math.sign(d) * (Math.abs(d) - lim * 0.7) * 1.4;
      if (f.p.y < POND.z0 + 2) desire.y += (POND.z0 + 2 - f.p.y) * 0.8;
      if (f.p.y > POND.z1 - 2) desire.y -= (f.p.y - POND.z1 + 2) * 0.8;
      /* menghindari lambung perahu */
      o.copy(f.p).sub(boatP); const bd = o.length();
      if (bd < 3.2) desire.add(o.multiplyScalar((3.2 - bd) * 0.6 / Math.max(bd, 0.3)));
      /* berkelompok longgar */
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        o.copy(fish[j].p).sub(f.p); const l = o.length();
        if (l < 0.7) desire.add(o.multiplyScalar(-0.35 / Math.max(l, 0.1)));
        else if (l < 3.5) desire.add(o.multiplyScalar(0.015));
      }
      f.v.lerp(desire, clamp(dt * 0.8, 0, 1));
      const sp = f.v.length(); if (sp > 0.55) f.v.multiplyScalar(0.55 / sp);
      f.p.addScaledVector(f.v, dt);
      const yaw = Math.atan2(f.v.x, f.v.y);
      let dy = yaw - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      f.yaw += dy * clamp(dt * 2.5, 0, 1);
      f.riseT -= dt;
      if (f.riseT < 0) { f.rise = 1; f.riseT = 9 + R() * 22; }
      if (f.rise > 0) {
        const before = f.rise; f.rise -= dt * 0.28;
        if (before >= 0.55 && f.rise < 0.55 && waterU.uRise) { waterU.uRise.value[riseSlot++ % 4].set(f.p.x, f.p.y, t, 1); if (window.__riverSound) window.__riverSound.plip(); }
      }
      const depth = f.depth * (1 - Math.sin(Math.max(0, f.rise) * Math.PI) * 0.9);
      e.set(0, f.yaw, -dy * 0.6); q.setFromEuler(e);
      pos.set(f.p.x, -Math.max(0.05, depth), f.p.y);
      mesh.setMatrixAt(i, m.compose(pos, q, s.setScalar(f.len)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0.016, 0, 0, 0);
  return { mesh, update };
}
