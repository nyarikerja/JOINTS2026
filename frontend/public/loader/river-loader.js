/* HelaLoka river loader (dibangun oleh loader/build.mjs dari loader/src, jangan diedit langsung).
   Sebagian teknik diadaptasi dari sakura-fantasy, utsuroi, dan halcyon (MIT, (c) 2026 Bill Chan); lihat CREDITS.md. */
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
    for (let i = 0; i < 78; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 108, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      const L = 14 + r() * 16, Wd = 6 + r() * 5, l = (110 + r() * 130) * (0.75 + 0.25 * d / 108) | 0;
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
    /* pusat dan jari-jari tajuk: kartu daun didorong keluar dari pusat, kartu di dalam tajuk digelapkan (oklusi ambien) */
    const ctr = V3(0, 0, 0); v.tips.forEach(t => ctr.add(t)); ctr.multiplyScalar(1 / Math.max(1, v.tips.length));
    let rad = 0.1; v.tips.forEach(t => { rad = Math.max(rad, t.distanceTo(ctr)); });
    const lo = Math.min(...v.tips.map(t => t.y)), hi = Math.max(...v.tips.map(t => t.y));
    list[vi].forEach(o => {
      cm.compose(o.p, o.q, o.s);
      v.tips.forEach(t => {
        const mk = (arr, n, sMin, sMax) => {
          for (let k = 0; k < n; k++) {
            const lp = t.clone().add(V3((r() - 0.5) * 1.1, (r() - 0.3) * 0.8, (r() - 0.5) * 1.1));
            const outv = lp.clone().sub(ctr); const od = outv.length(); lp.addScaledVector(outv.normalize(), 0.25);
            const ao = clamp(0.5 + 0.55 * (od / rad) + 0.18 * (lp.y - lo) / Math.max(0.5, hi - lo), 0.45, 1.08) * (0.88 + 0.2 * r());
            const p = lp.applyMatrix4(cm);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
            const s = (sMin + r() * (sMax - sMin)) * o.s.x; arr.push({ p, q, s: V3(s, s, s), c: [ao, ao, ao * (0.95 + 0.1 * r())] });
          }
        };
        mk(leafCards, Math.round(K.leaf * (LITE ? 1 : 1.3)), 0.7, 1.25); if (K.blos) mk(blosCards, Math.round(K.blos * 1.2), 0.9, 1.5);
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
      const rad = 10 + r() * 18, x = rad + r() * (w - 2 * rad), y = h * 0.5 + (r() - 0.5) * (h - 2 * rad - 4);
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

/* ---------- Air: pantulan planar, riak, wake perahu, busa tepian ---------- */
function makeWater(reflTex) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tRefl: { value: reflTex }, uTexMat: { value: new THREE.Matrix4() }, uTime: U.time, uSpeed: { value: 0 },
      uFogD: U.fogD, uSun: U.sun, uSunCol: U.sunCol, uFog: U.fogCol,
      uDeep: { value: new THREE.Color(0.03, 0.075, 0.07) }, uShallow: { value: new THREE.Color(0.16, 0.17, 0.1) },
      uSkyAmb: { value: new THREE.Color(0.5, 0.45, 0.45) },
      uBoat: { value: new THREE.Vector2() }, uFwd: { value: new THREE.Vector2(0, 1) },
      uRise: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -99, 0)) }
    },
    depthWrite: false,
    vertexShader: `uniform mat4 uTexMat;varying vec3 vW;varying vec4 vR;
void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vR=uTexMat*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform sampler2D tRefl;uniform float uTime;uniform float uSpeed;uniform float uFogD;
uniform vec3 uSun;uniform vec3 uSunCol;uniform vec3 uFog;uniform vec3 uDeep;uniform vec3 uShallow;uniform vec3 uSkyAmb;
uniform vec2 uBoat;uniform vec2 uFwd;uniform vec4 uRise[4];
varying vec3 vW;varying vec4 vR;
${GLSL_RIVER}
${GLSL_NOISE}
float ripples(vec2 p,float t){
  vec2 f=vec2(0.0,0.4)*t;
  float a=vn((p-f)*vec2(1.4,2.0))*0.55;
  a+=vn(p*2.6+vec2(5.2,1.3)-f*1.4)*0.3;
  a+=vn(p*7.1+vec2(t*0.5,-t*0.35))*0.15;
  a*=0.6+0.8*vn(p*0.15+vec2(0.0,t*0.05));
  return a;
}
/* cincin riak dari koi yang naik ke permukaan (diadaptasi dari uRise di utsuroi water.js) */
float rings(vec2 p){
  float h=0.0;
  for(int i=0;i<4;i++){
    vec4 r=uRise[i];float age=uTime-r.z;
    if(age>0.0&&age<4.5){float d=length(p-r.xy);float fr=d-age*0.75;
      h+=r.w*0.035*sin(fr*16.0)*exp(-fr*fr*9.0)*exp(-age*0.7)/(1.0+d*1.5);}
  }
  return h;
}
float wake(vec2 p,out float foam){
  vec2 q=p-uBoat;float al=dot(q,uFwd);vec2 rt=vec2(uFwd.y,-uFwd.x);float sd=dot(q,rt);
  float bh=-al;float h=0.0;foam=0.0;float sp=uSpeed;float asd=abs(sd);
  if(bh>0.5){
    float env=smoothstep(0.5,3.0,bh)*exp(-bh*0.035)*sp;
    float arm=asd-bh*0.36-0.9;
    h+=env*0.07*exp(-arm*arm*0.5)*cos(bh*2.6+asd*0.8);
    h+=env*0.045*exp(-asd*asd/(1.0+bh*0.25))*cos(bh*4.2);
    foam+=exp(-sd*sd/(0.5+bh*0.12))*exp(-bh*0.1)*smoothstep(0.5,2.0,bh)*(0.4+0.6*sp);
  }
  float bw=al-2.3;
  if(bw>0.0){float a2=asd-bw*0.7;h+=sp*0.05*exp(-a2*a2*3.0)*exp(-bw*0.5);}
  float e=length(vec2(al/2.4,sd/0.62));
  foam+=smoothstep(1.35,1.0,e)*smoothstep(0.85,1.0,e)*0.5*(0.4+sp);
  return h;
}
void main(){
  vec2 p=vW.xz;
  float dist=length(vW-cameraPosition);
  float fade=1.0/(1.0+dist*0.025);
  float f0,fx,fz;
  vec2 e=vec2(0.07,0.0);
  float h0=ripples(p,uTime)*0.12*fade+wake(p,f0)+rings(p);
  float hx=ripples(p+e.xy,uTime)*0.12*fade+wake(p+e.xy,fx)+rings(p+e.xy);
  float hz=ripples(p+e.yx,uTime)*0.12*fade+wake(p+e.yx,fz)+rings(p+e.yx);
  vec3 n=normalize(vec3(-(hx-h0)/e.x*0.9,1.0,-(hz-h0)/e.x*0.9));
  float w=rw(vW.z);float d=abs(vW.x-cx(vW.z));
  float shoreD=(0.8506*w+1.069)-d;
  float depth=clamp(shoreD/(0.7*w),0.0,1.0);
  vec3 body=mix(uShallow,uDeep,smoothstep(0.0,0.75,depth))*uSkyAmb*1.6;
  vec3 V=normalize(cameraPosition-vW);
  float ndv=max(dot(n,V),0.0);
  float fres=clamp(0.025+0.975*pow(1.0-ndv,5.0),0.0,1.0);
  vec2 uv=vR.xy/vR.w+n.xz*(0.035*fade+0.01);
  vec3 refl=texture2D(tRefl,uv).rgb;
  vec3 col=mix(body,refl,fres);
  vec3 Hh=normalize(V+uSun);
  float nh=max(dot(n,Hh),0.0);
  col+=uSunCol*(pow(nh,500.0)*14.0+pow(nh,60.0)*0.35)*smoothstep(0.0,0.05,uSun.y);
  float sf=smoothstep(0.55,0.0,shoreD+(vn(p*3.0)-0.5)*0.5)*(0.5+0.5*vn(p*8.0+uTime*0.3));
  float foam=clamp(f0+sf*0.8,0.0,1.0)*(0.5+0.5*vn(p*5.0-vec2(0.0,uTime*0.4)));
  col=mix(col,vec3(0.92,0.94,0.92)*(uSkyAmb*1.3+uSunCol*0.25),foam*0.85);
  vec2 q=p-uBoat;float al=dot(q,uFwd);float sd=dot(q,vec2(uFwd.y,-uFwd.x));
  col*=1.0-0.45*exp(-(sd*sd)/0.5-(al*al)/6.0);
  float fg=1.0-exp(-uFogD*uFogD*dist*dist);
  col=mix(col,uFog,fg);
  gl_FragColor=vec4(col,1.0);
}`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 440).rotateX(-Math.PI / 2), mat);
  /* digambar paling akhir di antrean opak tanpa menulis kedalaman, supaya koi di bawahnya bisa dipadukan */
  m.position.set(0, 0, 140); m.frustumCulled = false; m.renderOrder = 10;
  return m;
}

/* ---------- Post: bloom, god rays, grading ---------- */
const FS_VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
function makePasses() {
  const bright = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThr: { value: 0.9 } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tSrc;uniform float uThr;varying vec2 vUv;
void main(){vec3 c=texture2D(tSrc,vUv).rgb;float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*max(l-uThr,0.0)/max(l,0.0001),1.0);}`
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tSrc;uniform vec2 uDir;varying vec2 vUv;
void main(){
  vec3 s=texture2D(tSrc,vUv).rgb*0.2270270270;
  s+=texture2D(tSrc,vUv+uDir*1.3846153846).rgb*0.3162162162;
  s+=texture2D(tSrc,vUv-uDir*1.3846153846).rgb*0.3162162162;
  s+=texture2D(tSrc,vUv+uDir*3.2307692308).rgb*0.0702702703;
  s+=texture2D(tSrc,vUv-uDir*3.2307692308).rgb*0.0702702703;
  gl_FragColor=vec4(s,1.0);}`
  });
  const comp = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, tBright: { value: null },
      uBW: { value: new THREE.Vector3(0.5, 0.35, 0.3) }, uSunUV: { value: new THREE.Vector2(0.5, 0.6) }, uSunVis: { value: 0 },
      uExposure: { value: 1.5 }, uBloom: { value: 0.9 }, uRay: { value: 0.5 }, uWarm: U.warm, uTime: U.time, uRes: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tScene;uniform sampler2D tB1;uniform sampler2D tB2;uniform sampler2D tB3;uniform sampler2D tBright;
uniform vec3 uBW;uniform vec2 uSunUV;uniform float uSunVis;uniform float uExposure;uniform float uBloom;uniform float uRay;
uniform float uWarm;uniform float uTime;uniform vec2 uRes;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
float hh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec3 c=texture2D(tScene,vUv).rgb;
  vec3 b=texture2D(tB1,vUv).rgb*uBW.x+texture2D(tB2,vUv).rgb*uBW.y+texture2D(tB3,vUv).rgb*uBW.z;
  c+=b*uBloom;
  if(uSunVis>0.01){
    vec2 dir=(uSunUV-vUv)/16.0*0.92;vec2 uv=vUv+dir*hh(vUv*uRes)*0.9;float wt=1.0;vec3 ray=vec3(0.0);
    for(int i=0;i<16;i++){uv+=dir;ray+=texture2D(tBright,uv).rgb*wt;wt*=0.93;}
    c+=ray/16.0*uRay*uSunVis*vec3(1.0,0.82,0.62)*2.6;
  }
  c*=uExposure;c=aces(c);
  float l=dot(c,vec3(0.299,0.587,0.114));c=mix(vec3(l),c,1.1);
  c*=mix(vec3(0.97,1.0,1.04),vec3(1.04,1.0,0.95),uWarm);
  vec2 q=vUv-0.5;c*=1.0-0.7*dot(q,q);
  c+=(hh(vUv*uRes+fract(uTime)*37.0)-0.5)*0.022;
  gl_FragColor=vec4(max(c,0.0),1.0);}`
  });
  return { bright, blur, comp };
}

/* ---------- View 3D ---------- */
function createView3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); throw new Error('webgl2 diperlukan'); }
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const hdr = !!(renderer.extensions.get('EXT_color_buffer_float') || renderer.extensions.get('EXT_color_buffer_half_float'));
  const TYPE = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const ropt = (depth) => ({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: TYPE, depthBuffer: depth });
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, Object.assign(ropt(true), { samples: LITE ? 0 : 2 }));
  const reflRT = new THREE.WebGLRenderTarget(4, 4, ropt(true));
  const NB = CFG.bloomLevels;
  const brightRT = new THREE.WebGLRenderTarget(4, 4, ropt(false));
  const blurA = [], blurB = [];
  for (let i = 0; i < NB; i++) { blurA.push(new THREE.WebGLRenderTarget(4, 4, ropt(false))); blurB.push(new THREE.WebGLRenderTarget(4, 4, ropt(false))); }
  const P = makePasses();
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.bright); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
  const pass = (mat, target) => { fsMesh.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe6bfae, 0.0165);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1500);
  const sky = makeSky(); scene.add(sky);
  const terrain = buildTerrain(); scene.add(terrain);
  const water = makeWater(reflRT.texture); scene.add(water);
  const boat = buildBoat(); scene.add(boat.group);
  const hemi = new THREE.HemisphereLight(0xaab8d8, 0x4a4030, 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa860, 1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(CFG.shadow, CFG.shadow);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  const petals = petalSystem(CFG.petals, false), floating = petalSystem(CFG.floating, true);
  scene.add(petals, floating);
  const extras = [], noRefl = [petals, floating]; let mist = null, bridge = null, gate = null, koi = null, village = null, life = null;

  /* sisa dunia dibangun bertahap supaya frame pertama cepat */
  const stages = [
    () => { const g = buildTrees(); scene.add(g); extras.push(g); },
    () => { const g = buildConifers(); scene.add(g); extras.push(g); },
    () => { const g = buildBank(); scene.add(g); extras.push(g); noRefl.push(g); },
    () => { const g = buildTropics(); scene.add(g); extras.push(g); },
    () => { village = buildVillage(); scene.add(village.group); extras.push(village.group); },
    () => { life = buildLife(); scene.add(life.group); extras.push(life.group); noRefl.push(life.group); },
    () => { bridge = buildBridge(); scene.add(bridge.group); extras.push(bridge.group); },
    () => { mist = buildMist(); scene.add(mist); extras.push(mist); },
    () => { gate = buildGate(); scene.add(gate.group); extras.push(gate.group); },
    () => {
      loadKoi(water.material.uniforms).then(k => { if (disposed) { k.mesh.geometry.dispose(); k.mesh.material.dispose(); return; } koi = k; scene.add(k.mesh); })
        .catch(err => console.warn('Koi tidak dimuat:', err && err.message));
    },
    /* kompilasi semua shader sekarang (saat masih memuat), bukan tersendat ketika objek pertama kali terlihat */
    () => { try { renderer.compile(scene, camera); } catch (e) { } }
  ];

  const B = { z: CFG.zStart, speed: 0, yaw: 0, x: 0 };
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false;
  const refl = { cam: new THREE.PerspectiveCamera(), clip: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05), tm: new THREE.Matrix4() };
  const tv = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), rot: new THREE.Matrix4() };
  let W = 4, H = 4, scale = LITE ? 0.85 : 1, disposed = false;

  function setSize() {
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    W = Math.max(2, Math.floor(cw * CFG.dpr * scale)); H = Math.max(2, Math.floor(ch * CFG.dpr * scale));
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    sceneRT.setSize(W, H);
    reflRT.setSize(Math.max(2, Math.floor(W * CFG.reflScale)), Math.max(2, Math.floor(H * CFG.reflScale)));
    brightRT.setSize(Math.max(2, W >> 1), Math.max(2, H >> 1));
    for (let i = 0; i < NB; i++) {
      const w = Math.max(2, W >> (i + 2)), h = Math.max(2, H >> (i + 2));
      blurA[i].setSize(w, h); blurB[i].setSize(w, h);
    }
    camera.aspect = W / H; camera.fov = camera.aspect < 0.9 ? 64 : 52; camera.updateProjectionMatrix();
    const px = H / (2 * Math.tan(camera.fov * Math.PI / 360));
    petals.material.uniforms.uPx.value = px; floating.material.uniforms.uPx.value = px;
    P.comp.uniforms.uRes.value.set(W, H);
    const bw = P.comp.uniforms.uBW.value;
    if (NB < 3) bw.set(0.6, 0.5, 0);
  }

  function applyEnv(p) {
    const w = seasonWP(p);
    blendSeason(w);
    const top = sw3(SEAS.top, w), hor = sw3(SEAS.hor, w), sc2 = sw3(SEAS.sun, w), mt = sw3(SEAS.mtn, w);
    /* matahari bergeser ke samping kiri di akhir perjalanan: gerbang tersinari dari samping, bukan silau dari depan */
    U.sun.value.set(lerp(-0.28, -0.85, sstep(0.55, 1, p)), sw1(SEAS.elev, w), lerp(0.95, 0.5, sstep(0.55, 1, p))).normalize();
    U.sunCol.value.setRGB(sc2[0], sc2[1], sc2[2]);
    U.fogCol.value.setRGB(hor[0] * 0.97, hor[1] * 0.97, hor[2] * 0.97);
    U.fogD.value = sw1(SEAS.fog, w);
    U.warm.value = sw1(SEAS.warm, w);
    P.comp.uniforms.uExposure.value = sw1(SEAS.expo, w);
    scene.fog.color.copy(U.fogCol.value); scene.fog.density = U.fogD.value;
    sky.material.uniforms.uTop.value.setRGB(top[0], top[1], top[2]);
    sky.material.uniforms.uHor.value.setRGB(hor[0], hor[1], hor[2]);
    sky.material.uniforms.uMtn.value.setRGB(mt[0], mt[1], mt[2]);
    sun.color.copy(U.sunCol.value); sun.intensity = sw1(SEAS.sunI, w);
    hemi.color.setRGB(top[0] * 0.9 + 0.1, top[1] * 0.9 + 0.1, top[2] * 0.95 + 0.1); hemi.intensity = sw1(SEAS.hemi, w);
    const wu = water.material.uniforms, dp = sw3(SEAS.deep, w), sh = sw3(SEAS.shallow, w);
    wu.uSkyAmb.value.setRGB(hor[0] * 0.55, hor[1] * 0.55, hor[2] * 0.55);
    wu.uDeep.value.setRGB(dp[0], dp[1], dp[2]); wu.uShallow.value.setRGB(sh[0], sh[1], sh[2]);
    if (mist) mist.children.forEach(s => { s.material.color.setRGB(hor[0], hor[1], hor[2]); });
  }

  const arrive = { k: 0 }, portalP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  let lastPhase = 0;
  function update(dt, ctl) {
    const t = U.time.value;
    const goal = CFG.zStart + ctl.smooth * CFG.journey;
    let v;
    if (ctl.mode === 'reveal') v = 4.4;                     // perahu terus berlayar menembus gerbang ke dalam kabut
    else {
      const rem = Math.max(goal - B.z, 0);
      /* setelah data selesai, perahu menyusul secepatnya tetapi tetap melambat mulus sebelum berhenti */
      const cap = ctl.target >= 1 ? 12 : CFG.maxSpeed;
      v = clamp(rem * 1.3, 0, cap);
    }
    B.speed += (v - B.speed) * (1 - Math.exp(-dt * 2.8));
    B.z += B.speed * dt;
    /* gerak dikurangi: perahu langsung berada di posisi progres, tanpa meluncur */
    if (RM && ctl.mode !== 'reveal') { B.z = Math.max(B.z, goal); B.speed = 0; }
    const m = 1.1 * Math.sin(B.z * 0.08 + 0.5), md = 1.1 * 0.08 * Math.cos(B.z * 0.08 + 0.5);
    const mk = 1 - sstep(CFG.zStart + CFG.journey - 22, CFG.zStart + CFG.journey - 2, B.z);   // lurus ke tengah alur saat mendekati gerbang
    B.x = cx(B.z) + m * mk;
    const slope = cxd(B.z) + md * mk, ln = Math.hypot(slope, 1);
    const f = tv.a.set(slope / ln, 0, 1 / ln);
    const yawT = Math.atan2(f.x, f.z);
    B.yaw += (yawT - B.yaw) * (1 - Math.exp(-dt * 4));
    boat.group.position.set(B.x, 0, B.z); boat.group.rotation.y = B.yaw;
    const speed01 = clamp(B.speed / CFG.maxSpeed, 0, 1.6);
    boat.update(t, dt, speed01);
    const ph = boat.state.phase;
    if (ph < lastPhase && window.__riverSound) window.__riverSound.stroke(speed01);
    lastPhase = ph;
    if (window.__riverSound) window.__riverSound.speed(clamp(speed01, 0, 1));
    if (bridge) bridge.update(t, dt, B.x, B.z);
    if (koi) koi.update(dt, t, B.x, B.z);
    if (village) village.update(t);
    if (life) life.update(t, dt, B.x, B.z);
    applyEnv(clamp((B.z - CFG.zStart) / CFG.journey, 0, 1));
    /* kabut tambahan: tebal saat datang dari landing (menipis), menebal lagi saat perahu masuk gerbang */
    const fm = ctl.fogMul || 1;
    if (fm !== 1) { U.fogD.value *= fm; scene.fog.density = U.fogD.value; }

    const e = ctl.mode === 'reveal' ? ctl.revealE : 0;
    const atEnd = ctl.ready || (ctl.target >= 1 && B.speed < 0.6 && B.z > CFG.zStart + CFG.journey - 3);
    arrive.k += ((atEnd ? 1 : 0) - arrive.k) * (1 - Math.exp(-dt * 0.9));
    const A = sstep(0, 1, arrive.k);
    if (gate) { gate.update(t, dt, ctl.mode === 'reveal' ? 1 : 0.35 + 0.4 * A, camera.position); portalP.copy(gate.gateCenter()); }
    else portalP.set(cx(GATE.z), 4.9, GATE.z);

    const wu = water.material.uniforms;
    wu.uBoat.value.set(B.x, B.z); wu.uFwd.value.set(Math.sin(B.yaw), Math.cos(B.yaw)); wu.uSpeed.value = clamp(speed01, 0, 1);
    const bp = tv.b.set(B.x, 0, B.z);
    sun.position.copy(bp).addScaledVector(U.sun.value, 90); sun.target.position.copy(bp); sun.target.updateMatrixWorld();
    petals.material.uniforms.uC.value.copy(bp); floating.material.uniforms.uC.value.copy(bp);
    if (mist) mist.children.forEach(s => { s.position.x = cx(s.userData.z) + Math.sin(t * 0.05 + s.userData.ph) * 4; s.material.opacity = 0.4; });

    /* kamera: mengikuti dari belakang-samping; saat tiba naik sedikit (kolam koi dan gerbang terlihat);
       saat masuk, kamera tertahan di depan gerbang sementara perahu terus berlayar dan lenyap di kabut */
    const back = lerp(8.2, 9.8, A), side = lerp(3.8, 1.4, A), up = lerp(2.3, 4.2, A);
    const fwd = tv.a.set(Math.sin(B.yaw), 0, Math.cos(B.yaw)), right = tv.c.set(fwd.z, 0, -fwd.x);
    const des = tv.d.set(B.x, 0, B.z).addScaledVector(fwd, -back).addScaledVector(right, side); des.y = up;
    const look = tv.b.set(B.x, 1.0, B.z).addScaledVector(fwd, 3.2);
    if (A > 0) look.lerp(tmpL.copy(portalP).setY(portalP.y * 0.55), A * 0.85);
    if (!RM) { des.x += Math.sin(t * 0.31) * 0.12; des.y += Math.sin(t * 0.23) * 0.06; }
    des.y = Math.max(des.y, 1.35);
    if (e > 0) {
      const lim = GATE.z - 9.5;                              // kamera berhenti sebelum gerbang
      if (des.z > lim) { des.z = lim; des.x = lerp(des.x, cx(lim) + 1.2, 0.6); }
      des.y = lerp(des.y, 2.6, e);
      look.copy(tmpL.set(B.x, 1.2, B.z)).lerp(tmpL.copy(portalP).setY(2.2), 0.4);
    }
    if (!camInit) { camPos.copy(des); camLook.copy(look); camInit = true; }
    else { camPos.lerp(des, 1 - Math.exp(-dt * 2.6)); camLook.lerp(look, 1 - Math.exp(-dt * 3)); }
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  function renderReflection() {
    camera.updateMatrixWorld();
    const cp = tv.a.setFromMatrixPosition(camera.matrixWorld), N = tv.b.set(0, 1, 0), O = tv.c.set(0, 0, 0);
    const view = tv.d.subVectors(O, cp);
    if (view.dot(N) > 0) return;
    view.reflect(N).negate().add(O);
    tv.rot.extractRotation(camera.matrixWorld);
    const la = new THREE.Vector3(0, 0, -1).applyMatrix4(tv.rot).add(cp);
    const target = new THREE.Vector3().subVectors(O, la).reflect(N).negate().add(O);
    const vc = refl.cam;
    vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(tv.rot).reflect(N); vc.lookAt(target);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    refl.tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    water.material.uniforms.uTexMat.value.copy(refl.tm);
    /* benda kecil (rumput, makhluk hidup, kelopak) tidak perlu ikut dipantulkan: hemat satu render penuh */
    water.visible = false; if (koi) koi.mesh.visible = false; noRefl.forEach(o => { o.visible = false; }); renderer.clippingPlanes = [refl.clip];
    renderer.setRenderTarget(reflRT); renderer.render(scene, vc);
    renderer.clippingPlanes = []; water.visible = true; if (koi) koi.mesh.visible = true; noRefl.forEach(o => { o.visible = true; });
  }

  let frameN = 0;
  function render() {
    /* peta bayangan diperbarui tiap dua frame (matahari mengikuti perahu yang bergerak pelan) */
    renderer.shadowMap.needsUpdate = (frameN++ & 1) === 0;
    renderReflection();
    renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
    P.bright.uniforms.tSrc.value = sceneRT.texture; pass(P.bright, brightRT);
    let src = brightRT.texture;
    for (let i = 0; i < NB; i++) {
      const a = blurA[i], b = blurB[i];
      P.blur.uniforms.tSrc.value = src; P.blur.uniforms.uDir.value.set(1 / a.width, 0); pass(P.blur, a);
      P.blur.uniforms.tSrc.value = a.texture; P.blur.uniforms.uDir.value.set(0, 1 / a.height); pass(P.blur, b);
      src = b.texture;
    }
    const cu = P.comp.uniforms;
    cu.tScene.value = sceneRT.texture; cu.tBright.value = brightRT.texture;
    cu.tB1.value = blurB[0].texture; cu.tB2.value = blurB[Math.min(1, NB - 1)].texture; cu.tB3.value = blurB[NB - 1].texture;
    const sp = tv.a.copy(camera.position).addScaledVector(U.sun.value, 1000).project(camera);
    const dirDot = camera.getWorldDirection(tv.b).dot(U.sun.value);
    cu.uSunUV.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    cu.uSunVis.value = sstep(0.0, 0.35, dirDot);
    pass(P.comp, null);
  }

  /* gubernur kualitas: turunkan skala render jika lambat */
  let acc = 0, n = 0, slow = 0, fast = 0, warm = 0;
  function governor(dt) {
    if (warm < stages.length + 90) { warm++; return; }       // abaikan frame pemanasan (membangun dunia, kompilasi shader)
    acc += dt; n++;
    if (acc < 1) return;
    const avg = acc / n; acc = 0; n = 0;
    if (avg > 0.021) { slow++; fast = 0; } else if (avg < 0.0145) { fast++; slow = 0; } else { slow = 0; fast = 0; }
    if (slow >= 1 && scale > 0.5) { scale = Math.max(0.5, scale - (avg > 0.033 ? 0.15 : 0.08)); setSize(); slow = 0; }
    else if (fast >= 4 && scale < 1) { scale = Math.min(1, scale + 0.05); setSize(); fast = 0; }
  }

  function dispose() {
    if (disposed) return; disposed = true;
    scene.traverse(o => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
      if (o.customDepthMaterial) o.customDepthMaterial.dispose();
    });
    [sceneRT, reflRT, brightRT, ...blurA, ...blurB].forEach(r => r.dispose());
    Object.values(P).forEach(m => m.dispose());
    fsMesh.geometry.dispose();
    sun.shadow.map && sun.shadow.map.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { }
  }

  setSize(); applyEnv(0);
  return {
    kind: '3d', renderer, scene, camera, boat, B, stages, update, render, governor, setSize, dispose,
    fogCss() { const c = U.fogCol.value; return `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`; },
    get arrived() { return B.speed < 0.6 && B.z > CFG.zStart + CFG.journey * 0.995 - 0.8; }, get koiReady() { return !!koi; }, get scale() { return scale; }
  };
}

/* ---------- View cadangan 2D (tanpa WebGL2 atau mode statis) ---------- */
function createViewFallback(root) {
  root.hidden = false;
  root.innerHTML = `<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="ld-fb-svg">
<defs>
<linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1"><stop id="fs-s0" offset="0%" stop-color="#221832"/><stop offset="45%" stop-color="#462a4d"/><stop offset="75%" stop-color="#8c4756"/><stop id="fs-s1" offset="100%" stop-color="#f59e72"/></linearGradient>
<radialGradient id="fs-sun-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fffce8" stop-opacity="0.9"/><stop offset="25%" stop-color="#ffb875" stop-opacity="0.5"/><stop offset="65%" stop-color="#e86145" stop-opacity="0.15"/><stop offset="100%" stop-color="#e86145" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-pg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="20%" stop-color="#ffe6b0"/><stop offset="45%" stop-color="#ff87b2" stop-opacity="0.85"/><stop offset="75%" stop-color="#72d1ff" stop-opacity="0.5"/><stop offset="100%" stop-color="#aa85ff" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-portal-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="1"/><stop offset="50%" stop-color="#ffe396" stop-opacity="0.8"/><stop offset="100%" stop-color="#ff8ea8" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-lantern-rad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#ffea9f"/><stop offset="60%" stop-color="#ff8e38" stop-opacity="0.7"/><stop offset="100%" stop-color="#ff4400" stop-opacity="0"/></radialGradient>
<filter id="fs-blur-sm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>
<rect width="1000" height="600" fill="url(#fs-sky)"/>
<circle id="fs-sunc" cx="720" cy="220" r="140" fill="url(#fs-sun-halo)"/>
<image href="/loader/static-river.jpg" x="0" y="0" width="1000" height="600" preserveAspectRatio="xMidYMid slice" />
<circle cx="760" cy="225" r="160" fill="url(#fs-sun-halo)" opacity="0.45" style="mix-blend-mode: screen;"/>
<g id="fs-gate-portal" transform="translate(328 368)">
<polygon points="-12,0 12,0 28,45 -28,45" fill="url(#fs-portal-core)" opacity="0.35" style="mix-blend-mode: screen;"/>
<ellipse id="fs-portal" cx="0" cy="-22" rx="19" ry="32" fill="url(#fs-pg)" opacity="0.5" filter="url(#fs-blur-sm)" style="mix-blend-mode: screen;"/>
<ellipse cx="0" cy="-22" rx="9" ry="18" fill="url(#fs-portal-core)" opacity="0.65" style="mix-blend-mode: screen;"/>
<circle cx="-18" cy="-8" r="14" fill="url(#fs-lantern-rad)" opacity="0.7" style="mix-blend-mode: screen;"/>
<circle cx="18" cy="-8" r="14" fill="url(#fs-lantern-rad)" opacity="0.7" style="mix-blend-mode: screen;"/>
</g>
<g opacity="0.5" style="mix-blend-mode: screen;">
<ellipse cx="500" cy="520" rx="65" ry="5" fill="#ffd59e" filter="url(#fs-blur-sm)" opacity="0.4"/>
<ellipse cx="440" cy="450" rx="40" ry="3.5" fill="#ffb076" filter="url(#fs-blur-sm)" opacity="0.35"/>
</g>
</svg>
<div class="fb-petals">
${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 7.1 + 3) % 100}%;--d:${7 + (i % 5)}s;--l:${-(i * 1.2)}s"></i>`).join('')}
${Array.from({ length: 8 }, (_, i) => `<i class="firefly" style="top:${35 + (i * 6)}%;left:${(i * 12 + 5) % 100}%;--d:${3.5 + (i % 3)}s;--l:${-(i * 0.8)}s"></i>`).join('')}
</div>`;
  const q = id => root.querySelector('#' + id);
  return {
    kind: 'fallback', stages: [], B: { speed: 0 },
    update(dt, ctl) {
      const p = ctl.mode === 'reveal' ? 1 : ctl.smooth;
      const sw = seasonWP(p), top = sw3(SEAS.top, sw), hor = sw3(SEAS.hor, sw);
      root.style.setProperty('--pc', ['#ffffff', '#fff1b0', '#e8f0c8', '#d9722a', '#f6b7c9'][sw.indexOf(Math.max(...sw))]);
      const hx = c => '#' + c.map(v => ('0' + Math.round(clamp(v, 0, 1) * 255).toString(16)).slice(-2)).join('');
      if (q('fs-s0')) q('fs-s0').setAttribute('stop-color', hx(top));
      if (q('fs-s1')) q('fs-s1').setAttribute('stop-color', hx(hor));
      if (q('fs-sunc')) q('fs-sunc').setAttribute('cy', (220 - 70 * p).toFixed(1));
      if (q('fs-portal')) q('fs-portal').setAttribute('opacity', (ctl.mode === 'reveal' ? 1 : ctl.ready ? 0.95 : 0.4 + 0.5 * p).toString());
    },
    render() { }, governor() { }, setSize() { },
    dispose() { root.innerHTML = ''; root.hidden = true; },
    get arrived() { return true; }
  };
}

/* ---------- Pengendali progres, UI, dan reveal ----------
   Pola dari sakura-fantasy (MIT, (c) 2026 Bill Chan): src/main.js report() (progres gabungan berbobot dari
   banyak pemuat paralel) dan src/ui/ui.js progress()/ready()/open() (nilai target dikejar perlahan, tombol masuk,
   lalu reveal dengan mask radial yang melebar). */
/* fakta singkat yang bergantian selama memuat */
const TIPS = [
  'Abu vulkanik bukan abu sisa pembakaran: isinya pecahan batuan dan kaca yang tajam dan tidak larut dalam air.',
  'Partikel PM2.5 kira-kira 30 kali lebih kecil dari lebar rambut, sehingga bisa masuk jauh ke dalam paru-paru.',
  'Respirator N95 menyaring setidaknya 95% partikel halus; masker kain jauh kurang efektif untuk abu dan asap.',
  'Hujan lebat dapat mengubah endapan abu di lereng menjadi lahar yang mengalir jauh ke hilir.',
  'Abu yang basah jauh lebih berat daripada abu kering dan bisa membuat atap runtuh. Bersihkan atap secara berkala.',
  'Api di lahan gambut dapat membara di bawah permukaan selama berminggu-minggu, sehingga asapnya sulit padam.',
  'Saat hujan abu, tutup bak penampungan air dan lindungi mata dengan kacamata.',
  'Arah angin menentukan ke mana abu pergi; karena itu HelaLoka menjalankan banyak skenario angin sekaligus.'
];
const PHASES = [
  [0, 'Menyiapkan ruang kendali'], [0.15, 'Memuat katalog gunung api dan kawasan hutan'], [0.35, 'Mengambil titik panas dan data angin'],
  [0.55, 'Menyusun lapisan peta'], [0.75, 'Memetakan fasilitas dan penduduk'], [0.9, 'Mengalibrasi zona bahaya'], [1, 'Ruang simulasi siap']
];
function createApp(opts) {
  opts = opts || {};
  const $ = id => document.getElementById(id);
  const els = {
    root: $('hlLoader'), loader: $('ldScene'), canvas: $('ldGl'), fb: $('ldFb'), skip: $('ldSkip'), sr: $('ldSr'),
    pct: $('ldPct'), msg: $('ldMsg'), dot: $('ldDot'), path: $('ldPath'), enter: $('ldEnter'), sound: $('ldSound'), title: $('ldTitle'), hint: $('ldHint')
  };
  const ctl = { target: 0, smooth: 0, mode: 'loading', revealE: 0, ready: false, readyCbs: [], revealStart: 0, revealDur: 2600, lastPct: -1, lastSr: -1, lastMsg: '', t0: performance.now(), frames: 0 };
  let view = null, raf = 0, last = 0, destroyed = false, nextStageIdx = 0, hiddenTab = false, autoT = 0;
  let quick = false;
  try { quick = sessionStorage.getItem('hl-loader-seen') === '1'; sessionStorage.setItem('hl-loader-seen', '1'); } catch (e) { }
  if (opts.quick != null) quick = opts.quick;
  const sound = createRiverSound(); window.__riverSound = sound;
  /* kabut (public/landing/js/fog.js): sambungan dari landing (menipis) dan tirai saat perahu lenyap di gerbang */
  let fog = null, fogA = 0, introT = 0;
  const fogUp = () => { if (!fog && window.HLFog && els.root) fog = window.HLFog.mount(els.root, window.HLFog.START); return fog; };

  /* progres gabungan berbobot */
  const tasks = {}, order = [];
  const Progress = {
    register(name, weight, label) { if (!tasks[name]) order.push(name); tasks[name] = { w: weight, v: tasks[name] ? tasks[name].v : 0, label: label || name }; Progress.report(name, tasks[name].v); },
    report(name, v) {
      if (!tasks[name]) return; tasks[name].v = Math.max(tasks[name].v, clamp(v, 0, 1));
      let sw = 0, s = 0; for (const k in tasks) { sw += tasks[k].w; s += tasks[k].w * tasks[k].v; }
      loader.setProgress(sw ? s / sw : 0);
    },
    done(name) { Progress.report(name, 1); },
    current() { for (const k of order) if (tasks[k].v < 1) return tasks[k].label; return null; },
    get tasks() { const o = {}; for (const k of order) o[k] = +tasks[k].v.toFixed(2); return o; }
  };

  function setMsg(t) { if (t !== ctl.lastMsg && els.msg) { ctl.lastMsg = t; els.msg.textContent = t; } }
  function showReady() {
    if (ctl.ready) return; ctl.ready = true;
    els.root.classList.add('ready');
    els.root.setAttribute('aria-busy', 'false');
    setMsg('Ruang simulasi siap'); if (els.pct) els.pct.textContent = '100%';
    els.sr.textContent = 'Selesai memuat. Membuka ruang simulasi.';
    if (sound) sound.ready();
    ctl.readyCbs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
    /* otomatis langsung masuk ke dimensi ruang simulasi saat loading bar 100% (statis langsung seketika) */
    const isStatic = view && view.kind === 'fallback';
    autoT = setTimeout(() => beginReveal(isStatic ? true : false), isStatic ? 0 : RM ? 50 : 200);
  }
  function updateUI() {
    const pct = Math.floor(ctl.smooth * 100);
    if (!ctl.ready) {
      const b = Math.floor(ctl.smooth * 5);
      if (b !== ctl.lastSr) { ctl.lastSr = b; els.sr.textContent = 'Memuat ' + pct + ' persen.'; }
      if (pct !== ctl.lastPct && els.pct) { ctl.lastPct = pct; els.pct.textContent = pct + '%'; }
      let m = Progress.current();
      if (!m) for (let i = PHASES.length - 1; i >= 0; i--) if (ctl.smooth >= PHASES[i][0]) { m = PHASES[i][1]; break; }
      setMsg(m || PHASES[0][1]);
    }
    if (els.dot && els.path && els.path.getTotalLength) {
      const L = els.path.getTotalLength(), pt = els.path.getPointAtLength(L * ctl.smooth);
      els.dot.setAttribute('cx', pt.x.toFixed(1)); els.dot.setAttribute('cy', pt.y.toFixed(1));
      els.path.parentNode.style.setProperty('--p', ctl.smooth.toFixed(3));
    }
  }

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function beginReveal(fast) {
    if (ctl.mode !== 'loading' || destroyed) return;
    clearTimeout(autoT);
    ctl.mode = 'reveal'; ctl.revealStart = performance.now();
    const isStatic = view && view.kind === 'fallback';
    ctl.revealDur = RM || isStatic ? 450 : fast ? 1700 : 4000;
    els.root.classList.add('revealing');
    fogUp(); introT = 0; if (fog && view && view.fogCss) fog.color(view.fogCss());   // warna kabut = warna kabut adegan di gerbang
    if (els.enter) els.enter.disabled = true;
    /* suara memudar bersama kabut dan benar-benar berhenti sebelum aplikasi tampil */
    if (sound) { sound.portal(); sound.close(ctl.revealDur / 1000 * 0.7); }
    window.dispatchEvent(new CustomEvent('loader:reveal'));
  }
  function finish() { loader.destroy(); }

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!(dt > 0) || hiddenTab) return;
    U.time.value += dt;
    const isStatic = view && view.kind === 'fallback';
    ctl.smooth += (ctl.target - ctl.smooth) * (1 - Math.exp(-dt * (isStatic ? 8.0 : 2.8)));
    if (ctl.target - ctl.smooth < 0.0008) ctl.smooth = ctl.target;
    if (sound) sound.progress(ctl.smooth);
    if (ctl.mode === 'reveal') {
      const k = clamp((now - ctl.revealStart) / ctl.revealDur, 0, 1);
      ctl.revealE = RM ? 0 : ease(k);
      /* perahu berlayar ke dalam kabut gerbang; kabut menebal, menutup layar, lalu menipis memperlihatkan aplikasi */
      ctl.fogMul = 1 + 7 * Math.pow(sstep(0.05, 0.62, k), 2);
      fogA = RM ? 1 - k : sstep(0.3, 0.6, k) * (1 - sstep(0.7, 1, k));
      if (fog) fog.set(fogA);
      if (k > 0.62 && !els.root.classList.contains('through')) els.root.classList.add('through');
      if (k >= 1) { finish(); return; }
    } else if (introT || fog) {
      /* datang dari landing: mulai di dalam kabut, lalu kabut menipis setelah adegan pertama tergambar */
      const ki = introT ? clamp((now - introT) / (RM ? 300 : 2600), 0, 1) : 0;
      fogA = 1 - sstep(0, 1, ki); ctl.fogMul = 1 + 5 * fogA;
      if (fog) fog.set(fogA);
      if (ki >= 1) { if (fog) { fog.remove(); fog = null; } introT = 0; ctl.fogMul = 1; }
    }
    updateUI();
    const elapsed = (now - ctl.t0) / 1000;
    if (ctl.mode === 'loading' && !ctl.ready && ctl.target >= 1 && ctl.smooth >= 0.999 && (isStatic || view.arrived || elapsed > 2.2)) showReady();
    /* pengaman: jangan pernah mengurung pengguna jika ada data yang macet */
    if (!ctl.ready && elapsed > (opts.watchdog || 22) && ctl.target < 1) { ctl.target = 1; els.sr.textContent = 'Sebagian data masih dimuat di latar.'; }
    view.update(dt, ctl);
    if (!els.root.classList.contains('through')) view.render();    // adegan sudah tertutup kabut: berhenti menggambar
    view.governor(dt);
    if (nextStageIdx < view.stages.length && ctl.frames > 1) {
      view.stages[nextStageIdx++]();
      Progress.report('dunia', nextStageIdx / view.stages.length);
    }
    ctl.frames++;
    if (ctl.frames === 2) { els.root.classList.add('live'); if (fog && !introT && ctl.mode === 'loading') introT = now + 300; }
  }

  function switchToFallback() {
    if (view && view.kind === 'fallback') return;
    try { view && view.dispose(); } catch (e) { }
    els.canvas.hidden = true; view = createViewFallback(els.fb); Progress.done('dunia');
  }

  function syncSoundBtn() {
    if (!els.sound) return;
    const isMuted = sound ? sound.prefOff : false;
    const on = !isMuted;
    els.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.sound.setAttribute('aria-label', on ? 'Matikan suara' : 'Nyalakan suara');
    els.sound.classList.toggle('on', on);
    if (els.hint) els.hint.classList.toggle('on', !on && !isMuted && ctl.mode === 'loading');
  }
  function firstGesture(e) {
    if (e.target && e.target.closest && e.target.closest('#ldSound')) return;
    if (sound && !sound.prefOff && ctl.mode === 'loading') { sound.resume(); syncSoundBtn(); }
  }
  function onKey(e) {
    if (destroyed || ctl.mode !== 'loading') return;
    if (e.key === 'Escape') { loader.skip(); return; }
    if (!ctl.ready) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.key === 'Enter' || e.key === ' ') && (document.activeElement === els.enter || !/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(tag))) { e.preventDefault(); beginReveal(false); }
  }

  const loader = {
    setProgress(p) { ctl.target = Math.max(ctl.target, clamp(p, 0, 1)); },
    onReady(cb) { ctl.readyCbs.push(cb); if (ctl.ready) cb(); },
    start() { if (ctl.ready) beginReveal(false); else ctl.startWhenReady = true; },
    skip() { if (ctl.mode !== 'loading') return; ctl.target = 1; ctl.smooth = 1; beginReveal(true); },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); clearTimeout(autoT);
      try { view && view.dispose(); } catch (e) { console.error(e); }
      if (sound) sound.kill();
      window.__riverSound = null;
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true);
      document.removeEventListener('visibilitychange', onVis);
      els.root.remove(); document.documentElement.classList.remove('hl-loading');
      window.RiverLoader = null;
      window.dispatchEvent(new CustomEvent('loader:done'));
      if (CFG.nextUrl) location.assign(CFG.nextUrl);
    },
    Progress, get progress() { return ctl.smooth; }, get active() { return !destroyed; }
  };
  loader.onReady(() => { if (ctl.startWhenReady) beginReveal(false); });

  let rt = 0; function onResize() { clearTimeout(rt); rt = setTimeout(() => view && view.setSize(), 120); }
  function onVis() { hiddenTab = document.hidden; last = performance.now(); }

  function boot() {
    if (RM) els.root.classList.add('rm');
    Progress.register('dunia', 0.05, 'Membangun lanskap sungai');
    /* kunjungan ulang: perjalanan dipersingkat, tetapi perahu tetap mulai SEBELUM jembatan supaya selalu lewat di bawahnya
       (dulu titik mulai dimajukan 40% sehingga perahu langsung muncul di bawah jembatan) */
    if (quick) { const end = CFG.zStart + CFG.journey; CFG.zStart = Math.max(CFG.zStart, BRIDGE.z - 13); CFG.journey = end - CFG.zStart; }
    /* datang dari landing: mulai di dalam kabut yang sama dengan akhir transisi landing */
    let fromPortal = false;
    try { fromPortal = sessionStorage.getItem('hl-portal') === '1'; sessionStorage.removeItem('hl-portal'); } catch (e) { }
    if (fromPortal && fogUp()) { fog.set(1); ctl.fogMul = 6; }
    try {
      if (QUALITY === 'static') throw new Error('mode statis');
      /* cek dukungan WebGL2 lebih dulu supaya three.js tidak menulis galat ke konsol */
      const probe = document.createElement('canvas'); let gl2 = null; try { gl2 = probe.getContext('webgl2'); } catch (e) { }
      if (!gl2) throw new Error('WebGL2 tidak tersedia');
      const lose = gl2.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      view = createView3D(els.canvas);
      els.canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); switchToFallback(); });
    } catch (err) {
      if (QUALITY !== 'static') console.warn('Memakai versi 2D:', err && err.message);
      els.canvas.hidden = true; view = createViewFallback(els.fb); els.root.classList.add('live');
      Progress.done('dunia');
    }
    els.skip.addEventListener('click', () => loader.skip());
    if (els.enter) els.enter.addEventListener('click', () => beginReveal(false));
    if (els.sound) els.sound.addEventListener('click', () => { if (!sound) return; sound.set(!sound.on); syncSoundBtn(); });
    if (!sound && els.sound) els.sound.hidden = true;
    addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis);
    addEventListener('keydown', onKey);
    ['pointerdown', 'click', 'keydown', 'touchstart', 'wheel'].forEach(ev => {
      addEventListener(ev, firstGesture, { capture: true, passive: true });
    });
    if (sound) sound.autostart().then(syncSoundBtn); else syncSoundBtn();
    setTimeout(syncSoundBtn, 600);
    requestAnimationFrame(() => els.title && els.title.classList.add('in'));
    /* fakta bergantian tiap 7 detik */
    const tip = $('ldTip'), tipT = $('ldTipT');
    if (tip && tipT) {
      let ti = Math.floor(Math.random() * TIPS.length);
      const show = () => { if (destroyed || ctl.mode !== 'loading') return; tip.classList.remove('on');
        setTimeout(() => { tipT.textContent = TIPS[ti++ % TIPS.length]; tip.classList.add('on'); }, 450); setTimeout(show, 7000); };
      setTimeout(show, 1400);
    }
    /* mode hemat otomatis: laptop tidak sedang diisi daya -> kualitas lite (hanya untuk pilihan kualitas 'auto') */
    if (QUALITY === 'auto' && navigator.getBattery) navigator.getBattery().then(b => {
      if (!b.charging && applyLite() && view && view.setSize) { view.setSize(); console.info('Loader: mode hemat baterai aktif'); }
    }).catch(() => { });
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  return { loader, boot, ctl, Progress, get view() { return view; } };
}

/* ---------- Suara loader: prosedural (Web Audio), tanpa file ----------
   Lapisan: aliran sungai (brown noise + gemericik), angin, kicau burung, denting metalofon bernada slendro
   dengan ombak (pelayangan) khas gamelan, cebur galah perahu, "plip" koi, dan desir portal saat masuk.
   Preferensi disimpan di localStorage 'hl-sound' (on/off), sama dengan landing page. */
function createRiverSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx = null, master = null, bus = null, verb = null, on = false, built = false, timers = [], progress = 0, closing = false;
  const L = { river: null, wind: null };
  const pref = () => { try { return localStorage.getItem('hl-sound'); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem('hl-sound', v); } catch (e) { } };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function noiseBuf(type, sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
      }
      const f = Math.floor(sr * 0.2); for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
    }
    return b;
  }
  function impulse(sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  function loop(buf, gain) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); s.start(); return { s, g }; }

  function build() {
    built = true;
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(3.2); const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
    /* sungai: brown noise lewat lowpass yang bernapas + bandpass untuk gemericik */
    const brown = noiseBuf('brown', 6), pink = noiseBuf('pink', 5);
    const r = loop(brown, 0.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    r.g.connect(lp); lp.connect(bus); L.river = r;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const bub = loop(pink, 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2.5; bub.g.connect(bp); bp.connect(bus);
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.31; lg2.gain.value = 700; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
    /* angin */
    const w = loop(pink, 0.06), wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.6; w.g.connect(wf); wf.connect(bus); L.wind = w;
    const lfo3 = ctx.createOscillator(), lg3 = ctx.createGain(); lfo3.frequency.value = 0.05; lg3.gain.value = 300; lfo3.connect(lg3); lg3.connect(wf.frequency); lfo3.start();
    schedule();
  }

  /* metalofon: parsial tak harmonis + dua bilah sedikit berbeda nada (ombak) */
  const SLENDRO = [0, 240, 480, 720, 960, 1200, 1440];
  function bell(freq, t, vel, dur) {
    const parts = [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]];
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (pan) { pan.pan.value = rnd(-0.5, 0.5); g.connect(pan); pan.connect(bus); pan.connect(verb); } else { g.connect(bus); g.connect(verb); }
    parts.forEach(([m, a], i) => [0, 1].forEach(j => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
      o.frequency.value = freq * m * (j ? 1.0 + 4.5 / (freq * m) : 1); og.gain.value = a * 0.5 / (1 + i * 0.3);
      og.gain.setValueAtTime(a * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0005, t + dur / (1 + i * 1.4));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }));
  }
  function gong(t, vel) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 68; o2.frequency.value = 70.4; o.type = o2.type = 'sine';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0008, t + 7);
    o.connect(g); o2.connect(g); g.connect(bus); g.connect(verb); o.start(t); o2.start(t); o.stop(t + 7.2); o2.stop(t + 7.2);
  }
  function chirp(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), base = rnd(2600, 4200), n = 2 + (Math.random() * 4 | 0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.value = 0; o.type = 'sine';
    for (let i = 0; i < n; i++) {
      const s = t + i * rnd(0.09, 0.16); o.frequency.setValueAtTime(base * rnd(0.85, 1.1), s); o.frequency.exponentialRampToValueAtTime(base * rnd(1.25, 1.6), s + 0.06);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.022, s + 0.012); g.gain.linearRampToValueAtTime(0, s + 0.075);
    }
    if (pan) { pan.pan.value = rnd(-0.9, 0.9); o.connect(g); g.connect(pan); pan.connect(bus); pan.connect(verb); } else { o.connect(g); g.connect(bus); }
    o.start(t); o.stop(t + n * 0.17 + 0.1);
  }
  function splash(t, k) {
    const b = ctx.createBufferSource(); b.buffer = noiseBuf('pink', 0.5);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.35); f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * k, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    b.connect(f); f.connect(g); g.connect(bus); g.connect(verb); b.start(t); b.stop(t + 0.5);
  }

  let phrase = 0, step = 0;
  function schedule() {
    const tick = () => {
      if (!ctx || closing) return;
      const t = ctx.currentTime + 0.05;
      if (on) {
        /* melodi pelan; makin dekat selesai, makin rapat dan cerah */
        const base = 196, n = SLENDRO[(phrase * 3 + step * 2 + (Math.random() < 0.3 ? 1 : 0)) % SLENDRO.length];
        bell(base * Math.pow(2, n / 1200), t, 0.05 + progress * 0.03, 3.2);
        if (step % 4 === 2) bell(base * 2 * Math.pow(2, SLENDRO[(step + phrase) % 5] / 1200), t + 0.42, 0.025, 2.2);
        if (step % 16 === 0) gong(t, 0.12);
        step++; if (step % 16 === 0) phrase++;
        if (Math.random() < 0.35) chirp(t + rnd(0, 0.8));
      }
      timers.push(setTimeout(tick, (1150 - progress * 350) * (0.92 + Math.random() * 0.16)));
      if (timers.length > 8) timers.shift();
    };
    tick();
  }

  function ensure() {
    if (closing) return false;                                  // sudah ditutup: jangan pernah hidup lagi di aplikasi
    if (!ctx) {
      try {
        ctx = new AC();
        ctx.onstatechange = () => {
          if (ctx && ctx.state === 'running' && on && !closing) {
            fadeTo(0.8, 1.2);
          }
        };
      } catch (e) { return false; }
    }
    if (!built) build();
    return true;
  }
  function fadeTo(v, sec) { if (!master || !ctx) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }

  const api = {
    /* coba mulai otomatis; berhasil jika browser mengizinkan (mis. setelah klik di landing page) */
    autostart() {
      if (pref() === 'off') return Promise.resolve(false);
      if (!ensure()) return Promise.resolve(false);
      on = true;
      fadeTo(0.8, 2.5);
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => { });
      }
      return ctx.resume().catch(() => { }).then(() => { if (!closing && ctx.state === 'running') { fadeTo(0.8, 2.5); return true; } return false; });
    },
    resume() {
      if (pref() === 'off') return;
      if (!ensure()) return;
      on = true;
      fadeTo(0.8, 1.2);
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => { });
      }
    },
    set(v) {
      if (v) { if (!ensure()) return false; on = true; ctx.resume().catch(() => { }); fadeTo(0.8, 1.2); save('on'); }
      else { on = false; fadeTo(0, 0.5); save('off'); }
      return on;
    },
    get on() { return on && pref() !== 'off'; },
    progress(p) { progress = p; },
    speed(k) { if (L.river && ctx) L.river.g.gain.setTargetAtTime(0.42 + k * 0.25, ctx.currentTime, 0.4); },
    stroke(k) { if (on && ctx && k > 0.08) splash(ctx.currentTime + 0.02, Math.min(1, k)); },
    plip() { if (on && ctx) { const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1700, t + 0.05); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(bus); g.connect(verb); o.start(t); o.stop(t + 0.15); } },
    ready() { if (on && ctx) { const t = ctx.currentTime; [0, 480, 960].forEach((c, i) => bell(392 * Math.pow(2, c / 1200), t + i * 0.12, 0.05, 4)); } },
    portal() {
      if (!on || !ctx) return;
      const t = ctx.currentTime, b = ctx.createBufferSource(); b.buffer = noiseBuf('pink', 3);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(5200, t + 2.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 1.5); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      b.connect(f); f.connect(g); g.connect(bus); g.connect(verb); b.start(t); b.stop(t + 3);
      [0, 240, 720, 960, 1440].forEach((c, i) => bell(523 * Math.pow(2, c / 1200), t + 0.3 + i * 0.09, 0.04, 3.5));
      gong(t + 0.2, 0.16);
    },
    /* memudar lalu menutup konteks audio; setelah ini tidak ada yang bisa menyalakannya lagi */
    close(sec) {
      if (closing) return; closing = true; on = false; timers.forEach(clearTimeout); timers = [];
      if (!ctx) return;
      fadeTo(0, sec || 1.6);
      setTimeout(() => { api.kill(); }, (sec || 1.6) * 1000 + 120);
    },
    /* berhenti seketika (dipanggil saat loader dihancurkan dan saat halaman ditinggalkan) */
    kill() {
      closing = true; on = false; timers.forEach(clearTimeout); timers = [];
      if (!ctx) return; const c = ctx; ctx = null;
      try { if (master) master.disconnect(); } catch (e) { }
      try { c.onstatechange = null; if (c.state !== 'closed') c.close(); } catch (e) { }
    },
    get prefOff() { return pref() === 'off'; }
  };
  addEventListener('pagehide', () => api.kill());
  return api;
}
