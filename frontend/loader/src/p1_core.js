/* Sakuragawa river loader. Semua visual prosedural dan original, tanpa aset berlisensi. */
'use strict';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 720;
/* Pilihan kualitas dibagi dengan landing page (localStorage 'hl-quality'): auto | high | lite | static.
   lite = jumlah objek dan resolusi ala HP, static = versi 2D (SVG) tanpa WebGL. */
const QUALITY = (() => { try { return localStorage.getItem('hl-quality') || 'auto'; } catch (e) { return 'auto'; } })();
const WEAK = (() => {
  try { if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true; } catch (e) { }
  try { if (navigator.connection && navigator.connection.saveData) return true; } catch (e) { }
  return (navigator.hardwareConcurrency || 8) <= 4;
})();
let LITE = QUALITY === 'lite' || (QUALITY === 'auto' && (MOBILE || WEAK));
const CFG = {
  journey: 52, zStart: 76, maxSpeed: 4.2, nextUrl: null,
  sakura: LITE ? 46 : 86, conifer: LITE ? 260 : 520, far: LITE ? 260 : 620,
  reeds: LITE ? 2200 : 5200, grass: LITE ? 3500 : 9000, rocks: LITE ? 70 : 150,
  petals: LITE ? 260 : 700, floating: LITE ? 120 : 320, mist: 12, koi: LITE ? 7 : 11,
  reflScale: LITE ? 0.28 : 0.4, bloomLevels: LITE ? 2 : 3, shadow: LITE ? 1024 : 2048,
  dpr: Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 2 : (LITE ? 1 : 1.4)),
  /* durasi minimum adegan (detik) agar perahu tidak "melompat" saat data dimuat sangat cepat */
  minShow: RM ? 0.6 : 3.2,
  /* aset bersama dengan landing page (sudah ada di cache jika pengguna datang dari landing) */
  vendor: '/landing/vendor/', koiUrl: '/landing/assets/glb/koi_lo.glb'
};

/* mode hemat: dipanggil saat laptop tidak sedang diisi daya (kualitas 'auto'). Objek yang dibangun setelahnya ikut ringan. */
function applyLite() {
  if (LITE) return false; LITE = true;
  Object.assign(CFG, { sakura: 46, conifer: 260, far: 260, reeds: 2200, grass: 3500, rocks: 70, petals: 260, floating: 120, koi: 7, reflScale: 0.28, bloomLevels: 2, shadow: 1024,
    dpr: Math.min(window.devicePixelRatio || 1, 1) });
  return true;
}

const BRIDGE = { z: 94, half: 15.5, hw: 7, hws: 2.8 };  /* jembatan di tengah perjalanan; hw/hws: zona bebas pohon/rumput */
/* Gerbang candi bentar di ujung perjalanan: perahu berhenti di depannya, portal di celahnya membuka ke aplikasi. */
const GATE = { z: 142, gap: 5.2, hw: 6, s: 0.82 };
/* Kolam koi: ruas sungai di depan gerbang tempat ikan berenang */
const POND = { z0: 112, z1: 138 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function fbm(x, y, o) {
  o = o || 4; let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; }
  return s / (1 - Math.pow(0.5, o));
}

/* Geometri sungai: harus identik dengan versi GLSL di bawah. */
const cx = z => 5.5 * Math.sin(z * 0.028) + 3.2 * Math.sin(z * 0.067 + 1.3);
const cxd = z => 5.5 * 0.028 * Math.cos(z * 0.028) + 3.2 * 0.067 * Math.cos(z * 0.067 + 1.3);
const rw = z => 8.5 + 2.2 * Math.sin(z * 0.045 + 0.7);
const shoreAd = z => 0.8506 * rw(z) + 1.069;

function terrainH(x, z) {
  const d = x - cx(z), ad = Math.abs(d), w = rw(z);
  const t = sstep(w * 0.55, w + 1.6, ad);
  let h = lerp(-1.6, 0.55, t);
  const far = Math.max(0, ad - (w + 1.6));
  const n = fbm(x * 0.022 + 3.1, z * 0.022, 4);
  h += Math.pow(far, 1.25) * 0.085 * (0.35 + 1.3 * n);
  const rim = fbm(x * 0.11, z * 0.11, 3);
  h += (rim - 0.5) * 0.55 * sstep(0.75, 1, t) * (0.3 + Math.min(far * 0.2, 1));
  h += sstep(290, 350, z) * (25 + far * 0.4) + sstep(-25, -70, z) * (22 + far * 0.4);
  return Math.min(h, 80);
}

const GLSL_RIVER = `
float cx(float z){return 5.5*sin(z*0.028)+3.2*sin(z*0.067+1.3);}
float rw(float z){return 8.5+2.2*sin(z*0.045+0.7);}
`;
const GLSL_NOISE = `
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float a=0.5;float s=0.0;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(17.0,9.0);a*=0.5;}return s/0.9375;}
`;

/* Keadaan lingkungan: fajar berkabut (0) sampai pagi cerah (1). */
const ENV = {
  topA: [0.30, 0.36, 0.56], topB: [0.34, 0.56, 0.86],
  horA: [0.96, 0.73, 0.63], horB: [0.82, 0.89, 0.93],
  sunA: [1.0, 0.58, 0.30], sunB: [1.0, 0.86, 0.66],
  mtnA: [0.40, 0.42, 0.55], mtnB: [0.45, 0.55, 0.68],
  fogA: 0.0165, fogB: 0.0085, elevA: 0.075, elevB: 0.34
};

const U = {
  time: { value: 0 },
  sun: { value: new THREE.Vector3(-0.28, 0.1, 0.95).normalize() },
  sunCol: { value: new THREE.Color(1, 0.6, 0.3) },
  fogCol: { value: new THREE.Color(0.9, 0.75, 0.68) },
  fogD: { value: 0.0165 },
  warm: { value: 0 }
};

/* Helper geometri */
const UP = new THREE.Vector3(0, 1, 0);
function grid(nu, nv, fn) {
  const P = [], I = [], UV = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const p = fn(i / nu, j / nv); P.push(p[0], p[1], p[2]); UV.push(i / nu, j / nv);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; I.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}
function mergeG(items) {
  const pos = [], nor = [], col = [], uvs = []; let allUv = true;
  for (const it of items) {
    const g = it.g.index ? it.g.toNonIndexed() : it.g.clone();
    g.applyMatrix4(it.m);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(it.c[0], it.c[1], it.c[2]);
    if (g.attributes.uv) { const u = g.attributes.uv.array; for (let i = 0; i < u.length; i++) uvs.push(u[i]); } else allUv = false;
    g.dispose();
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  r.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (allUv) r.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return r;
}
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
class Seg {
  constructor(r0, r1, mat, sides) {
    const g = new THREE.CylinderGeometry(r1, r0, 1, sides || 7, 1);
    g.translate(0, 0.5, 0);
    this.m = new THREE.Mesh(g, mat); this._d = new THREE.Vector3();
  }
  set(a, b) {
    const d = this._d.subVectors(b, a), l = d.length();
    this.m.position.copy(a); this.m.scale.set(1, Math.max(l, 1e-4), 1);
    this.m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / (l || 1)));
  }
}
/* Dua tulang IK: kembalikan siku dan tangan. */
function ik(S, H, l1, l2, hint) {
  const d = H.clone().sub(S); let L = d.length();
  const mx = l1 + l2 - 1e-3;
  if (L > mx) { d.multiplyScalar(mx / L); L = mx; }
  if (L < 1e-3) L = 1e-3;
  const dir = d.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const hn = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  const elbow = S.clone().addScaledVector(dir, a).addScaledVector(hn, h);
  return { elbow, hand: S.clone().add(d) };
}
/* Optimasi draw call: gabungkan semua mesh statis di bawah root (kecuali yang ada di `keep` beserta turunannya)
   menjadi satu mesh per material. Mesh beranimasi, sprite, lampu, dan instanced mesh dibiarkan. */
function bakeStatic(root, keep) {
  keep = new Set(keep || []);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
  const walk = o => {
    if (keep.has(o)) return;
    if (o !== root && o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.geometry.attributes.position && o.geometry.attributes.normal) {
      const m = o.material; if (!groups.has(m)) groups.set(m, []);
      groups.get(m).push({ o, mat: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
    }
    o.children.slice().forEach(walk);
  };
  walk(root);
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  groups.forEach((list, mat) => {
    if (list.length < 2) return;
    let nv = 0, ni = 0; const useC = !!mat.vertexColors;
    list.forEach(it => { const g = it.o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), C = useC ? new Float32Array(nv * 3) : null;
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0, cast = false, recv = false;
    list.forEach(it => {
      const g = it.o.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color;
      nm.getNormalMatrix(it.mat);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(it.mat); P.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], (vo + i) * 3);
        if (ua) { UV[(vo + i) * 2] = ua.getX(i); UV[(vo + i) * 2 + 1] = ua.getY(i); }
        if (C) { if (ca) C.set([ca.getX(i), ca.getY(i), ca.getZ(i)], (vo + i) * 3); else C.set([1, 1, 1], (vo + i) * 3); }
      }
      if (g.index) for (let k = 0; k < g.index.count; k++) I[io++] = g.index.getX(k) + vo;
      else for (let k = 0; k < pa.count; k++) I[io++] = k + vo;
      vo += pa.count; cast = cast || it.o.castShadow; recv = recv || it.o.receiveShadow;
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(N, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    if (C) bg.setAttribute('color', new THREE.BufferAttribute(C, 3));
    bg.setIndex(new THREE.BufferAttribute(I, 1)); bg.computeBoundingSphere();
    const mesh = new THREE.Mesh(bg, mat); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.renderOrder = list[0].o.renderOrder; root.add(mesh);
    list.forEach(it => { it.o.parent.remove(it.o); it.o.geometry.dispose(); });
  });
  return root;
}
function tint(mat, col) { mat.color = new THREE.Color(col[0], col[1], col[2]); return mat; }

/* ---------- Musim: lima, bergantian dengan memudar (crossfade) bersama seluruh pemandangan ---------- */
/* urutan: fajar berkabut (tropis, tanpa salju), kemarau, hijau lebat, gugur keemasan, mekar */
const SEAS = {
  top: [[0.50, 0.58, 0.66], [0.52, 0.60, 0.74], [0.20, 0.46, 0.92], [0.36, 0.44, 0.64], [0.40, 0.56, 0.86]],
  hor: [[0.86, 0.89, 0.93], [0.97, 0.92, 0.80], [0.78, 0.88, 0.97], [0.98, 0.74, 0.52], [0.97, 0.80, 0.78]],
  sun: [[0.90, 0.93, 1.0], [1.0, 0.97, 0.86], [1.0, 0.94, 0.80], [1.0, 0.62, 0.30], [1.0, 0.80, 0.62]],
  mtn: [[0.62, 0.68, 0.78], [0.60, 0.58, 0.55], [0.40, 0.55, 0.72], [0.50, 0.42, 0.42], [0.46, 0.54, 0.68]],
  deep: [[0.05, 0.09, 0.12], [0.05, 0.10, 0.09], [0.02, 0.12, 0.12], [0.04, 0.08, 0.07], [0.03, 0.09, 0.09]],
  shallow: [[0.20, 0.22, 0.22], [0.22, 0.20, 0.12], [0.15, 0.24, 0.14], [0.20, 0.16, 0.09], [0.17, 0.20, 0.13]],
  fog: [0.0145, 0.0085, 0.0062, 0.0105, 0.0088], elev: [0.12, 0.52, 0.44, 0.15, 0.27],
  hemi: [1.15, 1.0, 1.0, 0.95, 1.05], sunI: [1.3, 2.1, 1.9, 1.9, 1.9], warm: [0, 0.5, 0.4, 1, 0.6], expo: [1.6, 1.3, 1.35, 1.5, 1.5]
};
const SP = {
  tt: [[0.9, 1.0, 0.92], [1, 1, 1], [0.82, 1.12, 0.62], [1, 1, 1], [1.08, 1.2, 0.9]],
  tl: [0, 0.7, 0, 0.75, 0], tlc: [[1, 1, 1], [1.85, 1.5, 0.78], [1, 1, 1], [1.95, 1.15, 0.5], [1, 1, 1]], snow: [0, 0, 0, 0, 0],
  spk: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.5, 0.18, 0.07], [0.96, 0.66, 0.78]], spkA: [0, 0, 0, 0.45, 0.6],
  ct: [[0.85, 1.0, 0.85], [1.1, 1.0, 0.65], [0.75, 1.15, 0.7], [1.2, 1.05, 0.65], [1.1, 1.3, 0.9]], csnow: [0, 0, 0, 0, 0],
  gt: [[0.85, 1.05, 0.8], [1, 1, 1], [0.8, 1.1, 0.65], [1.75, 1.1, 0.4], [1.1, 1.2, 0.9]],
  gb: [[0.62, 0.58, 0.46], [0.74, 0.62, 0.34], [0, 0, 0], [0, 0, 0], [0, 0, 0]], gbm: [0, 0.8, 0, 0, 0],
  leaf: [[0.26, 0.48, 0.2], [0.46, 0.46, 0.14], [0.17, 0.42, 0.10], [0.92, 0.58, 0.10], [0.35, 0.50, 0.14]],
  leaf2: [[0.16, 0.38, 0.16], [0.62, 0.50, 0.14], [0.10, 0.34, 0.12], [0.75, 0.15, 0.06], [0.55, 0.50, 0.15]],
  leafD: [1, 0.8, 1, 0.75, 0.5], blosD: [0, 0, 0, 0, 1],
  pa: [[1, 0.97, 0.9], [1, 0.92, 0.62], [1, 0.96, 0.78], [0.88, 0.42, 0.10], [0.95, 0.60, 0.72]],
  pb: [[1, 0.9, 0.72], [1, 0.92, 0.62], [0.9, 1, 0.8], [0.72, 0.20, 0.07], [1, 0.86, 0.90]],
  pRound: [0, 1, 1, 0, 0], pAmt: [0.35, 0.25, 0.3, 0.9, 1], pSize: [0.8, 0.4, 0.45, 1, 1], pAlpha: [0.8, 0.3, 0.35, 0.9, 0.85]
};
const mkV = () => ({ value: new THREE.Vector3() }), mkF = () => ({ value: 0 });
const SU = {
  uTT: mkV(), uTL: mkF(), uTLc: mkV(), uSnow: mkF(), uSpk: mkV(), uSpkA: mkF(), uCT: mkV(), uCSnow: mkF(),
  uGT: mkV(), uGB: mkV(), uGBm: mkF(), uLeaf: mkV(), uLeaf2: mkV(), uLeafD: mkF(), uBlosD: mkF(),
  uPa: mkV(), uPb: mkV(), uPRound: mkF(), uPAmt: mkF(), uPSize: mkF(), uPAlpha: mkF()
};
function seasonWP(p) {
  const s = clamp(p, 0, 1) * 5, i = Math.min(4, Math.floor(s)), f = s - i, t = i < 4 ? sstep(0.72, 1, f) : 0;
  const w = [0, 0, 0, 0, 0]; w[i] = 1 - t; if (i < 4) w[i + 1] = t; return w;
}
function sw3(arr, w) { const o = [0, 0, 0]; for (let k = 0; k < arr.length; k++) for (let c = 0; c < 3; c++) o[c] += arr[k][c] * w[k]; return o; }
function sw1(arr, w) { let o = 0; for (let k = 0; k < arr.length; k++) o += arr[k] * w[k]; return o; }
function blendSeason(w) {
  const v = (u, a) => { const o = sw3(SP[a], w); SU[u].value.set(o[0], o[1], o[2]); };
  const f = (u, a) => { SU[u].value = sw1(SP[a], w); };
  v('uTT', 'tt'); f('uTL', 'tl'); v('uTLc', 'tlc'); f('uSnow', 'snow'); v('uSpk', 'spk'); f('uSpkA', 'spkA');
  v('uCT', 'ct'); f('uCSnow', 'csnow'); v('uGT', 'gt'); v('uGB', 'gb'); f('uGBm', 'gbm');
  v('uLeaf', 'leaf'); v('uLeaf2', 'leaf2'); f('uLeafD', 'leafD'); f('uBlosD', 'blosD');
  v('uPa', 'pa'); v('uPb', 'pb'); f('uPRound', 'pRound'); f('uPAmt', 'pAmt'); f('uPSize', 'pSize'); f('uPAlpha', 'pAlpha');
}
const SEASON_UNIFORMS = `uniform vec3 uTT;uniform float uTL;uniform vec3 uTLc;uniform float uSnow;uniform vec3 uSpk;uniform float uSpkA;
uniform vec3 uCT;uniform float uCSnow;uniform vec3 uGT;uniform vec3 uGB;uniform float uGBm;
uniform vec3 uLeaf;uniform vec3 uLeaf2;uniform float uLeafD;uniform float uBlosD;
`;
const SEASON_MODES = {
  terrain: `{ vec3 c=diffuseColor.rgb; float lu=dot(c,vec3(0.299,0.587,0.114));
 float hs=fract(sin(dot(floor(vW.xz*2.0),vec2(12.9898,78.233)))*43758.5453); float spk=step(0.93,hs); float dry=smoothstep(0.0,0.6,vW.y);
 c*=uTT; c=mix(c,vec3(lu)*uTLc,uTL); c=mix(c,uSpk,spk*uSpkA*dry);
 c=mix(c,vec3(0.92,0.94,0.99),uSnow*smoothstep(0.5,0.85,vUpN)*smoothstep(0.05,0.45,vW.y)*0.95);
 diffuseColor.rgb=c; }`,
  conifer: `{ vec3 c=diffuseColor.rgb*uCT; float up=smoothstep(0.0,0.55,vUpN);
 c=mix(c,vec3(0.9,0.93,0.98),clamp(up*0.9+0.12,0.0,1.0)*uCSnow); diffuseColor.rgb=c; }`,
  grass: `{ vec3 c=diffuseColor.rgb*uGT; c=mix(c,uGB*(0.8+0.5*diffuseColor.g),uGBm); diffuseColor.rgb=c; }`,
  rock: `{ diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.92,0.94,0.98),smoothstep(0.35,0.8,vUpN)*uSnow*0.9); }`,
  leaf: `{ float vis=smoothstep(0.0,0.12,uLeafD-vKeep); diffuseColor.a*=vis;
 float lm=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114)); vec3 lc=mix(uLeaf,uLeaf2,vKeep);
 diffuseColor.rgb=lc*(0.5+lm*0.65); }`,
  blossom: `{ float vis=smoothstep(0.0,0.12,uBlosD-vKeep); diffuseColor.a*=vis; }`
};
function fxMat(mat, key, o) {
  o = o || {};
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.time; s.uniforms.uSun = U.sun; s.uniforms.uSunCol = U.sunCol;
    Object.assign(s.uniforms, SU);
    const sway = o.sway ? `
 transformed.x += sin(uTime*${o.sway.speed.toFixed(2)} + ip.x*0.7 + ip.z*0.5 + position.y*2.0)*${o.sway.amp.toFixed(3)}*(${o.sway.wexpr});
 transformed.z += cos(uTime*${(o.sway.speed * 0.83).toFixed(2)} + ip.z*0.6 + position.y*1.7)*${(o.sway.amp * 0.8).toFixed(3)}*(${o.sway.wexpr});` : '';
    s.vertexShader = 'uniform float uTime;\nvarying vec3 vW;\nvarying float vUpN;\nvarying float vKeep;\n' + s.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vUpN = objectNormal.y;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 vec3 ip = instanceMatrix[3].xyz;
 vKeep = fract(sin(dot(ip.xz + vec2(ip.y), vec2(12.9898, 78.233)))*43758.5453);
 ${sway}
#else
 vKeep = 0.0;
#endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
 vec4 wp4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
 wp4 = instanceMatrix * wp4;
#endif
 vW = (modelMatrix * wp4).xyz;`);
    let fs = 'uniform vec3 uSun;\nuniform vec3 uSunCol;\nvarying vec3 vW;\nvarying float vUpN;\nvarying float vKeep;\n' + SEASON_UNIFORMS + s.fragmentShader;
    if (o.depth) fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n if(vKeep >= ${o.depth}) discard;`);
    if (o.mode) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + SEASON_MODES[o.mode]);
    if (o.backlight) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { vec3 vd = normalize(cameraPosition - vW);
 float bk = pow(max(dot(-vd, uSun), 0.0), 2.5);
 totalEmissiveRadiance += uSunCol * diffuseColor.rgb * bk * ${o.backlight.toFixed(2)}; }`);
    s.fragmentShader = fs;
  };
  return mat;
}
/* Cahaya tepi dari matahari untuk figur manusia (material standar). */
function rimMat(mat, key) {
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uSunV = U.sun; s.uniforms.uSunCol = U.sunCol;
    s.fragmentShader = 'uniform vec3 uSunV;\nuniform vec3 uSunCol;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { vec3 sv = normalize((viewMatrix * vec4(uSunV, 0.0)).xyz);
 float ndv = max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
 float rim = pow(1.0 - ndv, 2.5) * smoothstep(-0.2, 0.6, dot(normalize(normal), sv));
 totalEmissiveRadiance += uSunCol * diffuseColor.rgb * rim * 0.9; }`);
  };
  return mat;
}
