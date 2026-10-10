/* ---------- Langit ---------- */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTime: U.time, uSun: U.sun, uGlow: U.sunCol,
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uMtn: { value: new THREE.Color() }
    },
    vertexShader: `varying vec3 vDir;
void main(){vDir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=p.xyww;}`,
    fragmentShader: `uniform float uTime;uniform vec3 uSun;uniform vec3 uTop;uniform vec3 uHor;uniform vec3 uGlow;uniform vec3 uMtn;
varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d=normalize(vDir);float y=d.y;float mu=max(dot(d,uSun),0.0);
  vec3 col=mix(uHor,uTop,pow(clamp(y,0.0,1.0),0.45));
  col=mix(col,uHor*1.05,smoothstep(0.0,-0.25,y));
  col+=uGlow*(pow(mu,5.0)*0.55+pow(mu,48.0)*1.1);
  col+=uGlow*pow(mu,1800.0)*60.0;
  vec2 cp=d.xz/(y+0.14)*0.55+vec2(uTime*0.006,0.0);
  float f=fbm(cp*vec2(1.0,2.4));
  float dens=smoothstep(0.5,0.84,f)*smoothstep(0.01,0.18,y)*(1.0-smoothstep(0.55,0.95,y));
  vec3 cc=mix(uHor*1.1,uGlow*1.3+vec3(0.2),pow(mu,2.5));
  col=mix(col,cc,dens*0.6);
  float az=atan(d.x,d.z);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float r=0.035+fi*0.022+0.05*vn(vec2(az*(2.0+fi),fi*7.3))+0.025*vn(vec2(az*(6.0+fi*2.0),fi*3.1));
    float m=smoothstep(r+0.004,r-0.004,y);
    vec3 mc=mix(uMtn*(0.8+0.1*fi),uHor,0.75-0.25*fi);
    col=mix(col,mc,m);
  }
  col+=(h21(gl_FragCoord.xy)-0.5)/255.0;
  gl_FragColor=vec4(col,1.0);
}`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -100;
  return m;
}

/* ---------- Terrain ---------- */
function buildTerrain() {
  const NX = 140, NZ = 220, Z0 = -70, Z1 = 360;
  const n = (NX + 1) * (NZ + 1);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let k = 0;
  for (let j = 0; j <= NZ; j++) {
    const z = Z0 + (Z1 - Z0) * j / NZ;
    for (let i = 0; i <= NX; i++) {
      const u = -1 + 2 * i / NX;
      const x = cx(z) + Math.sign(u) * Math.pow(Math.abs(u), 2.3) * 190;
      const h = terrainH(x, z);
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      const sl = Math.hypot(terrainH(x + 1.2, z) - h, terrainH(x, z + 1.2) - h) / 1.2;
      const c = terrainColor(x, z, h, sl);
      col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
      k += 3;
    }
  }
  const idx = new Uint32Array(NX * NZ * 6); let q = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, fxMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'terrain', { mode: 'terrain' }));
  m.receiveShadow = true; m.frustumCulled = false;
  return m;
}
function terrainColor(x, z, h, slope) {
  const n = fbm(x * 0.15, z * 0.15, 3), n2 = fbm(x * 0.9, z * 0.9, 2);
  let c = [0.27 + 0.12 * n, 0.36 + 0.14 * n, 0.17 + 0.06 * n];
  c = mix3(c, [0.45, 0.42, 0.22], sstep(0.5, 0.75, fbm(x * 0.04 + 8, z * 0.04, 3)) * 0.5);
  c = mix3(c, [0.15, 0.12, 0.085], 1 - sstep(0.0, 0.9, h));
  c = mix3(c, [0.1, 0.19, 0.13], sstep(6, 40, h) * 0.8);
  c = mix3(c, [0.38, 0.37, 0.35], sstep(0.55, 0.95, slope) * 0.8);
  const v = 0.88 + 0.24 * n2;
  return [c[0] * v, c[1] * v, c[2] * v];
}

function inst(geo, mat, list) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((o, i) => {
    m.compose(o.p, o.q, o.s); im.setMatrixAt(i, m);
    if (o.c) { col.setRGB(o.c[0], o.c[1], o.c[2]); im.setColorAt(i, col); }
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}
const QI = new THREE.Quaternion();
function qy(a) { return new THREE.Quaternion().setFromAxisAngle(UP, a); }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- Tekstur pohon ---------- */
function barkTexture() {
  return canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#4b3b33'; c.fillRect(0, 0, w, h); const r = mulberry32(31);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '30,22,18' : '120,100,86'},${0.04 + 0.08 * r()})`; c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 3); }
    for (let i = 0; i < 80; i++) {
      let x = r() * w; c.strokeStyle = `rgba(18,10,8,${0.3 + 0.35 * r()})`; c.lineWidth = 1 + r() * 2.4; c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y < h; y += 16) { x += (r() - 0.5) * 5; c.lineTo(x, y); } c.stroke();
    }
    for (let i = 0; i < 130; i++) { c.fillStyle = `rgba(196,180,164,${0.25 + 0.3 * r()})`; c.fillRect(r() * w, r() * h, 8 + r() * 14, 1.6 + r() * 1.4); }
  }, true);
}
function blossomTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); const r = mulberry32(7);
    const flower = (x, y, s, rot) => {
      c.fillStyle = 'rgba(120,40,70,0.2)'; c.beginPath(); c.arc(x + 2, y + 3, s * 1.0, 0, 6.3); c.fill();
      for (let k = 0; k < 5; k++) {
        c.save(); c.translate(x, y); c.rotate(rot + k * 1.2566);
        const g = c.createRadialGradient(0, -s * 0.55, 0, 0, -s * 0.55, s * 0.7);
        g.addColorStop(0, 'rgba(255,250,252,1)'); g.addColorStop(0.6, 'rgba(255,214,228,1)'); g.addColorStop(1, 'rgba(244,166,196,1)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, -s * 0.55, s * 0.36, s * 0.55, 0, 0, 6.3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.0)'; c.restore();
      }
      c.fillStyle = 'rgba(190,60,110,0.95)'; c.beginPath(); c.arc(x, y, s * 0.14, 0, 6.3); c.fill();
      c.strokeStyle = 'rgba(214,170,60,0.9)'; c.lineWidth = 0.8;
      for (let k = 0; k < 8; k++) { const a = k * 0.785; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4); c.stroke(); }
    };
    for (let i = 0; i < 54; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 108; flower(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 9 + r() * 10, r() * 6.283);
    }
  });
}
function leafTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); const r = mulberry32(19);
    for (let i = 0; i < 52; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 106, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      const L = 18 + r() * 20, Wd = 7 + r() * 6, l = 130 + r() * 110 | 0;
      c.save(); c.translate(x, y); c.rotate(r() * 6.283);
      c.fillStyle = `rgb(${l},${l},${l})`; c.beginPath(); c.moveTo(0, -L); c.quadraticCurveTo(Wd * 1.6, 0, 0, L); c.quadraticCurveTo(-Wd * 1.6, 0, 0, -L); c.fill();
      c.strokeStyle = `rgba(30,30,30,0.45)`; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -L); c.lineTo(0, L); c.stroke();
      c.strokeStyle = 'rgba(30,30,30,0.22)';
      for (let k = -2; k <= 2; k++) { if (!k) continue; c.beginPath(); c.moveTo(0, k * L * 0.28); c.lineTo(Wd * 0.9 * Math.sign(k) * 0.8, k * L * 0.28 - L * 0.22); c.stroke(); c.beginPath(); c.moveTo(0, k * L * 0.28); c.lineTo(-Wd * 0.9 * Math.sign(k) * 0.8, k * L * 0.28 - L * 0.22); c.stroke(); }
      c.restore();
    }
  });
}
function needleTexture() {
  const t = canvasTex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); const r = mulberry32(41);
    c.fillStyle = '#26432d'; c.fillRect(0, 0, w, h * 0.3);
    const cols = ['#1d3524', '#2c4d33', '#3a5e3c', '#223d2a'];
    for (let i = 0; i < 1100; i++) {
      const x = r() * w, len = 22 + r() * (h - 26), ang = (r() - 0.5) * 0.5;
      c.strokeStyle = cols[(r() * 4) | 0]; c.lineWidth = 1.2 + r() * 1.6; c.beginPath(); c.moveTo(x, r() * h * 0.2); c.lineTo(x + Math.sin(ang) * len, len); c.stroke();
    }
  }, true);
  t.repeat.set(5, 1); return t;
}

/* ---------- Pohon dekiduus: sakura, maple, zelkova (batang melengkung, cabang meruncing) ---------- */
class TubeAcc {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  tube(pts, r0, r1, radial, segs) {
    const cur = new THREE.CatmullRomCurve3(pts), base = this.p.length / 3, total = cur.getLength();
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, P = cur.getPointAt(t), T = cur.getTangentAt(t).normalize();
      let nr;
      if (!prev) nr = (Math.abs(T.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0)).cross(T).normalize();
      else nr = prev.clone().addScaledVector(T, -prev.dot(T)).normalize();
      prev = nr; const bin = T.clone().cross(nr), rad = lerp(r0, r1, t);
      for (let k = 0; k <= radial; k++) {
        const a = k / radial * 6.2832, d = nr.clone().multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
        this.p.push(P.x + d.x * rad, P.y + d.y * rad, P.z + d.z * rad); this.n.push(d.x, d.y, d.z);
        this.u.push(k / radial * Math.max(1, Math.round(r0 * 9)), t * total / 1.1);
      }
    }
    for (let s = 0; s < segs; s++) for (let k = 0; k < radial; k++) {
      const a = base + s * (radial + 1) + k, b = a + 1, c = a + radial + 1, d = c + 1; this.i.push(a, b, c, b, d, c);
    }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i); return g;
  }
}
const KINDS = {
  sakura: { wig: 0.5, taper: 0.6, len: [1.9, 1.5, 1.1, 0.8, 0.55], spread: [0.45, 0.85], lift: 0.1, blos: 3, leaf: 3, rad: 0.2, seeds: [11, 23, 37] },
  maple: { wig: 0.35, taper: 0.62, len: [2.2, 1.6, 1.15, 0.8, 0.55], spread: [0.3, 0.6], lift: 0.2, blos: 0, leaf: 5, rad: 0.19, seeds: [41, 53] },
  zelkova: { wig: 0.28, taper: 0.6, len: [3.0, 2.0, 1.35, 0.9, 0.6], spread: [0.22, 0.5], lift: 0.32, blos: 0, leaf: 5, rad: 0.2, seeds: [67, 79] }
};
function makeTreeVariant(kind, seed) {
  const K = KINDS[kind], r = mulberry32(seed), acc = new TubeAcc(), tips = [];
  function br(p0, dir, depth, rad) {
    const len = K.len[4 - depth] * (0.85 + r() * 0.3), pts = [p0.clone()], d = dir.clone();
    let p = p0.clone();
    for (let i = 1; i <= 3; i++) {
      d.x += (r() - 0.5) * K.wig; d.z += (r() - 0.5) * K.wig; d.y += (r() - 0.5) * K.wig * 0.5; d.normalize();
      p = p.clone().addScaledVector(d, len / 3); pts.push(p);
    }
    const big = depth >= 3;
    acc.tube(pts, rad, rad * K.taper, big ? 8 : (depth >= 2 ? 5 : 4), big ? 6 : (depth >= 2 ? 3 : 2));
    const e = pts[3];
    if (depth <= 1 || (depth === 2 && r() < 0.5)) tips.push(e.clone());
    if (depth === 0) return;
    const n = depth >= 3 ? 3 : (r() < 0.55 ? 2 : 3);
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + r() * 1.2, sp = K.spread[0] + (K.spread[1] - K.spread[0]) * r();
      const nd = d.clone().multiplyScalar(1 - sp * 0.35).addScaledVector(V3(Math.cos(a), 0, Math.sin(a)), sp);
      nd.y += K.lift + (r() - 0.5) * 0.2 - (depth <= 1 ? 0.05 : 0); nd.normalize();
      br(e, nd, depth - 1, rad * 0.6);
    }
    if (depth >= 2 && r() < 0.6) {
      const a = r() * 6.283, nd = d.clone().addScaledVector(V3(Math.cos(a), 0, Math.sin(a)), 0.7); nd.y += K.lift * 0.5; nd.normalize();
      br(pts[2], nd, depth - 1, rad * 0.5);
    }
  }
  acc.tube([V3(0, -0.45, 0), V3(0, 0.05, 0), V3(0, 0.5, 0)], K.rad * 1.75, K.rad * 1.05, 8, 3);
  br(V3(0, 0.4, 0), V3(0.1 * (r() - 0.5), 1, 0.1 * (r() - 0.5)).normalize(), 4, K.rad);
  return { kind, geo: acc.geo(), tips };
}
function buildTrees() {
  const out = new THREE.Group(), r = mulberry32(21);
  const variants = []; Object.keys(KINDS).forEach(k => KINDS[k].seeds.forEach(s => variants.push(makeTreeVariant(k, s))));
  const byKind = k => variants.map((v, i) => v.kind === k ? i : -1).filter(i => i >= 0);
  const list = variants.map(() => []);
  const total = CFG.sakura;
  for (let i = 0; i < total; i++) {
    const roll = r(), kind = roll < 0.6 ? 'sakura' : (roll < 0.8 ? 'maple' : 'zelkova'), pick = byKind(kind);
    const z = -25 + r() * 285, s = r() < 0.5 ? -1 : 1;
    if (Math.abs(z - BRIDGE.z) < BRIDGE.hw || Math.abs(z - GATE.z) < GATE.hw) continue;
    const ad = shoreAd(z) + (kind === 'sakura' ? 1.6 + Math.pow(r(), 1.7) * 22 : 4 + Math.pow(r(), 1.4) * 40);
    const x = cx(z) + s * ad, h = terrainH(x, z);
    if (h < 0.3) continue;
    const sc = (kind === 'zelkova' ? 1.3 : 1) + r() * 0.6, lean = (kind === 'sakura' ? 0.1 : 0.03) + r() * 0.1;
    const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), s > 0 ? lean : -lean).multiply(qy(r() * 6.28));
    list[pick[(r() * pick.length) | 0]].push({ p: V3(x, h, z), q, s: V3(sc, sc, sc), c: [1, 1, 1] });
  }
  const bark = barkTexture(); bark.repeat.set(1, 1);
  const trunkMat = fxMat(new THREE.MeshLambertMaterial({ map: bark, side: THREE.DoubleSide }), 'trunk', { mode: 'rock' });
  const leafCards = [], blosCards = [], cm = new THREE.Matrix4();
  variants.forEach((v, vi) => {
    if (!list[vi].length) return;
    const im = inst(v.geo, trunkMat, list[vi]); im.castShadow = true; im.receiveShadow = true; out.add(im);
    const K = KINDS[v.kind];
    list[vi].forEach(o => {
      cm.compose(o.p, o.q, o.s);
      v.tips.forEach(t => {
        const mk = (arr, n, sMin, sMax) => {
          for (let k = 0; k < n; k++) {
            const p = t.clone().add(V3((r() - 0.5) * 1.2, (r() - 0.35) * 0.9, (r() - 0.5) * 1.2)).applyMatrix4(cm);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
            const s = (sMin + r() * (sMax - sMin)) * o.s.x; arr.push({ p, q, s: V3(s, s, s), c: [1, 1, 1] });
          }
        };
        mk(leafCards, K.leaf, 1.0, 1.7); if (K.blos) mk(blosCards, K.blos, 1.2, 2.0);
      });
    });
  });
  const lt = leafTexture(), bt = blossomTexture();
  const leafMat = fxMat(new THREE.MeshLambertMaterial({ map: lt, alphaTest: 0.38, side: THREE.DoubleSide, emissive: new THREE.Color(0.03, 0.04, 0.02) }),
    'leafM', { sway: { amp: 0.05, speed: 1.3, wexpr: '(position.y+0.5)' }, backlight: 0.55, mode: 'leaf' });
  const blosMat = fxMat(new THREE.MeshLambertMaterial({ map: bt, alphaTest: 0.38, side: THREE.DoubleSide, emissive: new THREE.Color(0.12, 0.05, 0.07) }),
    'blosM', { sway: { amp: 0.05, speed: 1.3, wexpr: '(position.y+0.5)' }, backlight: 0.65, mode: 'blossom' });
  const card = new THREE.PlaneGeometry(1.5, 1.5);
  const li = inst(card, leafMat, leafCards); li.castShadow = true;
  li.customDepthMaterial = fxMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lt, alphaTest: 0.38 }), 'leafDepth', { depth: 'uLeafD' });
  out.add(li);
  if (blosCards.length) {
    const bi = inst(card, blosMat, blosCards); bi.castShadow = true;
    bi.customDepthMaterial = fxMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: bt, alphaTest: 0.38 }), 'blosDepth', { depth: 'uBlosD' });
    out.add(bi);
  }
  return out;
}

/* ---------- Cemara: detail dekat (lapisan jarum menjuntai), kerucut untuk jauh ---------- */
function makeConiferCone() {
  const items = [], m = new THREE.Matrix4();
  const cone = new THREE.ConeGeometry(1, 1, 7, 1); cone.translate(0, 0.5, 0);
  [[1.7, 2.4, 0.5], [1.4, 2.2, 1.5], [1.1, 2.0, 2.5], [0.75, 1.8, 3.5]].forEach((t, i) => {
    m.compose(V3(0, t[2], 0), QI, V3(t[0], t[1], t[0]));
    const f = i / 3; items.push({ g: cone, m: m.clone(), c: [0.055 + 0.04 * f, 0.15 + 0.08 * f, 0.105 + 0.05 * f] });
  });
  const tr = new THREE.CylinderGeometry(0.14, 0.2, 1.2, 5); tr.translate(0, 0.6, 0);
  items.push({ g: tr, m: new THREE.Matrix4(), c: [0.16, 0.11, 0.08] });
  return mergeG(items);
}
function makeConiferDetail() {
  const items = [], m = new THREE.Matrix4(), N = 12, r = mulberry32(5);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), R = lerp(1.95, 0.3, Math.pow(t, 0.9)), H = lerp(1.2, 0.5, t), top = 1.7 + t * 5.4;
    const g = new THREE.CylinderGeometry(0.1, R, H, 14, 1, true); g.translate(0, -H / 2, 0);
    m.compose(V3(0, top, 0), qy(r() * 6.28), V3(1, 1, 1));
    const k = 0.85 + 0.25 * t + (r() - 0.5) * 0.1; items.push({ g, m: m.clone(), c: [k, k, k] });
  }
  return mergeG(items);
}
function buildConifers() {
  const out = new THREE.Group(), r = mulberry32(55);
  const cone = makeConiferCone(), det = makeConiferDetail();
  const nt = needleTexture();
  const detMat = fxMat(new THREE.MeshLambertMaterial({ map: nt, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide }), 'coniferD', { mode: 'conifer' });
  const trGeo = new THREE.CylinderGeometry(0.1, 0.2, 6.5, 7); trGeo.translate(0, 3.0, 0);
  const bk = barkTexture();
  const trMat = fxMat(new THREE.MeshLambertMaterial({ map: bk }), 'coniferT', { mode: 'rock' });
  const gen = (count, adMin, adMax, sMin, sMax) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const z = -40 + r() * 330, s = r() < 0.5 ? -1 : 1;
      if (Math.abs(z - BRIDGE.z) < BRIDGE.hw || Math.abs(z - GATE.z) < GATE.hw) continue;
      const ad = shoreAd(z) + adMin + Math.pow(r(), 1.3) * (adMax - adMin);
      const x = cx(z) + s * ad, h = terrainH(x, z);
      if (h < 0.4) continue;
      const sc = sMin + r() * (sMax - sMin), t = 0.8 + r() * 0.4;
      list.push({ p: V3(x, h - 0.2, z), q: qy(r() * 6.28), s: V3(sc * 0.85, sc, sc * 0.85), c: [t, t, t] });
    }
    return list;
  };
  const near = gen(MOBILE ? 80 : 200, 7, 45, 0.9, 1.7);
  const di = inst(det, detMat, near); di.castShadow = true; di.receiveShadow = true;
  di.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: nt, alphaTest: 0.4 });
  out.add(di);
  const ti = inst(trGeo, trMat, near); ti.castShadow = true; out.add(ti);
  const coneMat = () => fxMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'conifer', { mode: 'conifer' });
  const mid = inst(cone, coneMat(), gen(Math.round(CFG.conifer * 0.6), 40, 85, 1.1, 2.4)); mid.castShadow = true; mid.receiveShadow = true; out.add(mid);
  out.add(inst(cone, coneMat(), gen(CFG.far, 55, 190, 2.2, 4.4)));
  return out;
}

/* ---------- Rumput, alang-alang, batu ---------- */
function buildBank() {
  const out = new THREE.Group(), r = mulberry32(88);
  const blade = new THREE.PlaneGeometry(0.12, 1, 1, 4); blade.translate(0, 0.5, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.85)); }
  blade.computeVertexNormals();
  const scatterBlades = (count, lo, hi, hMin, hMax, hLo, hHi, col, key, amp) => {
    const list = [];
    for (let t = 0; t < count * 4 && list.length < count; t++) {
      const z = -30 + r() * 290, s = r() < 0.5 ? -1 : 1, sa = shoreAd(z);
      if (Math.abs(z - BRIDGE.z) < BRIDGE.hws || Math.abs(z - GATE.z) < 3.4) continue;
      const x = cx(z) + s * (sa + lo + r() * (hi - lo)), h = terrainH(x, z);
      if (h < hLo || h > hHi) continue;
      const sc = hMin + r() * (hMax - hMin), k = 0.75 + r() * 0.5;
      list.push({ p: V3(x, h - 0.05, z), q: qy(r() * 6.28), s: V3(1, sc, 1), c: [col[0] * k, col[1] * k, col[2] * k] });
    }
    const mat = fxMat(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), key, { sway: { amp, speed: 1.6, wexpr: 'position.y*position.y' }, mode: 'grass' });
    const im = inst(blade, mat, list); im.receiveShadow = false; return im;
  };
  out.add(scatterBlades(CFG.reeds, -1.4, 1.4, 1.3, 2.4, -0.6, 0.9, [0.36, 0.42, 0.2], 'reed', 0.22));
  out.add(scatterBlades(CFG.grass, 0.6, 16, 0.35, 0.8, 0.3, 3, [0.3, 0.42, 0.18], 'grass', 0.1));
  // batu tepi sungai
  const rg = new THREE.IcosahedronGeometry(1, 1), p = rg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + 0.28 * (vnoise(p.getX(i) * 2 + 3, p.getY(i) * 2 + p.getZ(i) * 2) - 0.5);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  rg.computeVertexNormals();
  const list = [];
  for (let i = 0; i < CFG.rocks; i++) {
    const z = -20 + r() * 270, s = r() < 0.5 ? -1 : 1, x = cx(z) + s * (shoreAd(z) - 1.2 + r() * 4.2), h = terrainH(x, z);
    if (Math.abs(z - BRIDGE.z) < BRIDGE.hws || Math.abs(z - GATE.z) < 3.4) continue;
    const sc = 0.2 + Math.pow(r(), 2.5) * 0.9, t = 0.7 + r() * 0.5;
    list.push({ p: V3(x, h - sc * 0.15, z), q: qy(r() * 6.28), s: V3(sc * 1.2, sc * 0.7, sc), c: [0.36 * t, 0.37 * t, 0.34 * t] });
  }
  const rocks = inst(rg, fxMat(new THREE.MeshLambertMaterial(), 'rock', { mode: 'rock' }), list); rocks.castShadow = true; rocks.receiveShadow = true;
  out.add(rocks);
  return out;
}

/* ---------- Kabut tipis di atas sungai ---------- */
function buildMist() {
  const tex = canvasTex(256, 64, (c, w, h) => {
    const r = mulberry32(3);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = h * (0.3 + r() * 0.4), rad = 16 + r() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  });
  const out = new THREE.Group(), r = mulberry32(9);
  for (let i = 0; i < CFG.mist; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 }));
    const z = 10 + i * 20 + r() * 10;
    sp.position.set(cx(z) + (r() - 0.5) * 8, 0.8 + r() * 1.2, z);
    sp.scale.set(46 + r() * 20, 6 + r() * 4, 1);
    sp.userData.z = z; sp.userData.ph = r() * 6.28;
    out.add(sp);
  }
  return out;
}

/* ---------- Partikel musiman: salju, serbuk sari, daun gugur, kelopak sakura ---------- */
function petalSystem(count, floating) {
  const g = new THREE.BufferGeometry(), seed = new Float32Array(count * 3), r = mulberry32(floating ? 4 : 5);
  for (let i = 0; i < seed.length; i++) seed[i] = r();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.time, uC: { value: new THREE.Vector3() }, uPx: { value: 800 }, uFloat: { value: floating ? 1 : 0 },
      uSunCol: U.sunCol, uFog: U.fogCol, uFogD: U.fogD, uPa: SU.uPa, uPb: SU.uPb, uPRound: SU.uPRound, uPAmt: SU.uPAmt, uPSize: SU.uPSize, uPAlpha: SU.uPAlpha },
    vertexShader: `attribute vec3 aSeed;uniform float uTime;uniform float uPx;uniform float uFloat;uniform vec3 uC;uniform float uFogD;
uniform float uPAmt;uniform float uPSize;
varying float vA;varying float vSpin;varying float vFog;varying float vS;
${GLSL_RIVER}
void main(){
  float t=uTime;vec3 s=aSeed;vec3 p;
  if(uFloat>0.5){
    float R=110.0;
    float wz=uC.z+mod(s.x*R+t*0.35-uC.z+R*0.5,R)-R*0.5;
    float wx=cx(wz)+(s.y*2.0-1.0)*rw(wz)*0.85+sin(t*0.5+s.z*20.0)*0.12;
    p=vec3(wx,0.035,wz);
  } else {
    float R=70.0;
    vec2 q=s.xz*R+vec2(sin(t*0.3+s.y*9.0)*1.2,t*(0.5+0.6*s.z));
    float wx=uC.x+mod(q.x-uC.x+R*0.5,R)-R*0.5;
    float wz=uC.z+mod(q.y-uC.z+R*0.5,R)-R*0.5;
    float y=mod(s.y*14.0-t*(0.3+0.4*s.z),14.0);
    p=vec3(wx+sin(t*0.9+s.z*30.0)*0.8,y+0.15,wz+cos(t*0.7+s.y*20.0)*0.8);
  }
  float amt=uPAmt;
  float k=fract(s.x*91.7+s.y*53.1);
  vec4 mv=viewMatrix*vec4(p,1.0);
  float d=-mv.z;
  if(k>amt){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;vA=0.0;return;}
  gl_Position=projectionMatrix*mv;
  float sz=uPSize;
  gl_PointSize=clamp(uPx*(uFloat>0.5?0.05:0.06)*sz*(0.6+0.8*s.z)/max(d,0.5),1.0,34.0);
  vA=(1.0-smoothstep(45.0,75.0,d))*smoothstep(0.3,1.5,d);
  vSpin=s.z*6.28+t*(0.5+s.y);
  vFog=1.0-exp(-uFogD*uFogD*d*d);
  vS=s.z;
}`,
    fragmentShader: `uniform vec3 uSunCol;uniform vec3 uFog;uniform float uFloat;uniform vec3 uPa;uniform vec3 uPb;uniform float uPRound;uniform float uPAlpha;
varying float vA;varying float vSpin;varying float vFog;varying float vS;
void main(){
  vec2 uv=gl_PointCoord-0.5;
  float c=cos(vSpin),sn=sin(vSpin);uv=mat2(c,-sn,sn,c)*uv;
  float rd=smoothstep(0.5,0.12,length(uv));
  float ell=smoothstep(0.5,0.3,length(uv*vec2(1.0,1.9)));
  float shape=mix(ell,rd,uPRound);
  float a=shape*vA*uPAlpha;
  if(a<0.02)discard;
  vec3 col=mix(uPa,uPb,vS);
  col+=uSunCol*0.2;
  col=mix(col,uFog,vFog*0.8);
  gl_FragColor=vec4(col*1.15,a);
}`
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return pts;
}
