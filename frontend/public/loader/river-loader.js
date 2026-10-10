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
const LITE = QUALITY === 'lite' || (QUALITY === 'auto' && (MOBILE || WEAK));
const CFG = {
  journey: 52, zStart: 76, maxSpeed: 4.2, nextUrl: null,
  sakura: LITE ? 46 : 86, conifer: LITE ? 260 : 520, far: LITE ? 260 : 620,
  reeds: LITE ? 2200 : 5200, grass: LITE ? 3500 : 9000, rocks: LITE ? 70 : 150,
  petals: LITE ? 260 : 700, floating: LITE ? 120 : 320, mist: 12, koi: LITE ? 7 : 11,
  reflScale: LITE ? 0.35 : 0.5, bloomLevels: LITE ? 2 : 3, shadow: LITE ? 1024 : 2048,
  dpr: Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 2 : (LITE ? 1.25 : 1.75)),
  /* durasi minimum adegan (detik) agar perahu tidak "melompat" saat data dimuat sangat cepat */
  minShow: RM ? 0.6 : 3.2,
  /* aset bersama dengan landing page (sudah ada di cache jika pengguna datang dari landing) */
  vendor: '/landing/vendor/', koiUrl: '/landing/assets/glb/koi_lo.glb'
};

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
function tint(mat, col) { mat.color = new THREE.Color(col[0], col[1], col[2]); return mat; }

/* ---------- Musim: lima, bergantian dengan memudar (crossfade) bersama seluruh pemandangan ---------- */
/* urutan: dingin, panas (kemarau), summer (hijau lebat), gugur, sakura */
const SEAS = {
  top: [[0.46, 0.53, 0.66], [0.52, 0.60, 0.74], [0.20, 0.46, 0.92], [0.36, 0.44, 0.64], [0.40, 0.56, 0.86]],
  hor: [[0.86, 0.89, 0.93], [0.97, 0.92, 0.80], [0.78, 0.88, 0.97], [0.98, 0.74, 0.52], [0.97, 0.80, 0.78]],
  sun: [[0.90, 0.93, 1.0], [1.0, 0.97, 0.86], [1.0, 0.94, 0.80], [1.0, 0.62, 0.30], [1.0, 0.80, 0.62]],
  mtn: [[0.62, 0.68, 0.78], [0.60, 0.58, 0.55], [0.40, 0.55, 0.72], [0.50, 0.42, 0.42], [0.46, 0.54, 0.68]],
  deep: [[0.05, 0.09, 0.12], [0.05, 0.10, 0.09], [0.02, 0.12, 0.12], [0.04, 0.08, 0.07], [0.03, 0.09, 0.09]],
  shallow: [[0.20, 0.22, 0.22], [0.22, 0.20, 0.12], [0.15, 0.24, 0.14], [0.20, 0.16, 0.09], [0.17, 0.20, 0.13]],
  fog: [0.0145, 0.0085, 0.0062, 0.0105, 0.0088], elev: [0.12, 0.52, 0.44, 0.15, 0.27],
  hemi: [1.15, 1.0, 1.0, 0.95, 1.05], sunI: [1.3, 2.1, 1.9, 1.9, 1.9], warm: [0, 0.5, 0.4, 1, 0.6], expo: [1.6, 1.3, 1.35, 1.5, 1.5]
};
const SP = {
  tt: [[0.82, 0.88, 0.98], [1, 1, 1], [0.82, 1.12, 0.62], [1, 1, 1], [1.08, 1.2, 0.9]],
  tl: [0, 0.7, 0, 0.75, 0], tlc: [[1, 1, 1], [1.85, 1.5, 0.78], [1, 1, 1], [1.95, 1.15, 0.5], [1, 1, 1]], snow: [1, 0, 0, 0, 0],
  spk: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.5, 0.18, 0.07], [0.96, 0.66, 0.78]], spkA: [0, 0, 0, 0.45, 0.6],
  ct: [[0.9, 0.92, 0.95], [1.1, 1.0, 0.65], [0.75, 1.15, 0.7], [1.2, 1.05, 0.65], [1.1, 1.3, 0.9]], csnow: [0.9, 0, 0, 0, 0],
  gt: [[1, 1, 1], [1, 1, 1], [0.8, 1.1, 0.65], [1.75, 1.1, 0.4], [1.1, 1.2, 0.9]],
  gb: [[0.62, 0.58, 0.46], [0.74, 0.62, 0.34], [0, 0, 0], [0, 0, 0], [0, 0, 0]], gbm: [1, 0.8, 0, 0, 0],
  leaf: [[0.93, 0.96, 1.0], [0.46, 0.46, 0.14], [0.17, 0.42, 0.10], [0.92, 0.58, 0.10], [0.35, 0.50, 0.14]],
  leaf2: [[0.93, 0.96, 1.0], [0.62, 0.50, 0.14], [0.10, 0.34, 0.12], [0.75, 0.15, 0.06], [0.55, 0.50, 0.15]],
  leafD: [0.12, 0.8, 1, 0.75, 0.5], blosD: [0, 0, 0, 0, 1],
  pa: [[1, 1, 1], [1, 0.92, 0.62], [1, 0.96, 0.78], [0.88, 0.42, 0.10], [0.95, 0.60, 0.72]],
  pb: [[1, 1, 1], [1, 0.92, 0.62], [0.9, 1, 0.8], [0.72, 0.20, 0.07], [1, 0.86, 0.90]],
  pRound: [1, 1, 1, 0, 0], pAmt: [1, 0.25, 0.3, 0.9, 1], pSize: [0.5, 0.4, 0.45, 1, 1], pAlpha: [0.95, 0.3, 0.35, 0.9, 0.85]
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

/* ---------- Gerbang candi bentar + portal dimensi ----------
   Bangunan gerbang terbelah khas Bali/Majapahit dari bata merah dan batu andesit, berdiri di kedua tepi sungai.
   Di celahnya menggantung portal cahaya: redup selama memuat, menyala saat siap, membuka saat pengguna masuk. */
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

  /* portal: bidang di celah gerbang. Pusaran derau + cincin pelangi lembut di tepi elips. */
  const PW = GATE.gap * 2 - 0.3, PH = 8.6;
  const portalU = { uTime: U.time, uK: { value: 0.0 }, uFlash: { value: 0 }, uAsp: { value: PW / PH } };
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.ShaderMaterial({
    uniforms: portalU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform float uTime;uniform float uK;uniform float uFlash;uniform float uAsp;varying vec2 vUv;
${GLSL_NOISE}
vec3 irid(float t){return 0.5+0.5*cos(6.2832*(t+vec3(0.0,0.33,0.67)));}
void main(){
  vec2 p=(vUv-vec2(0.5,0.47))*2.0;p.x*=uAsp*0.62;
  float r=length(p*vec2(0.86,1.0));
  float a=atan(p.y,p.x);
  float sw=fbm(vec2(a*1.6+r*2.2-uTime*0.35,r*3.0-uTime*0.5));
  float sw2=fbm(vec2(a*3.0-r*4.0+uTime*0.6,r*6.0+uTime*0.2));
  float edge=exp(-pow((r-0.9+0.04*sw)*9.0,2.0));
  float halo=exp(-pow((r-0.9)*3.2,2.0))*0.25;
  float inner=smoothstep(0.92,0.2,r)*smoothstep(0.35,0.75,sw*sw2*1.6)*0.35;
  float lines=pow(0.5+0.5*sin(a*6.0+r*12.0-uTime*1.4+sw*6.0),10.0)*smoothstep(0.92,0.3,r)*0.45;
  vec3 col=irid(a*0.16+uTime*0.05+r*0.4)*vec3(1.0,0.92,1.05);
  vec3 c=col*(edge*1.3+halo)+mix(vec3(0.75,0.85,1.0),vec3(1.0,0.85,0.7),sw)*inner+col*lines;
  c+=vec3(1.0,0.95,0.88)*uFlash*smoothstep(0.95,0.1,r)*1.1;
  float m=smoothstep(1.12,0.95,r);
  gl_FragColor=vec4(c*uK*m,1.0);
}`
  }));
  portal.position.set(0, 0.66 + PH / 2, 0); portal.renderOrder = 5;
  root.add(portal);

  /* pantulan cahaya portal di permukaan air (sprite datar) */
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.1, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: glowTex, color: new THREE.Color(1, 0.85, 0.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0
  }));
  pool.material.fog = false; pool.position.set(0, 0.03, -3.5); root.add(pool);

  const center = new THREE.Vector3();
  /* benda aditif tidak ikut kabut bawaan three.js: redam manual menurut jarak kamera (kabut eksponensial kuadrat) */
  let kk = 0;
  function update(t, dt, k, flash, camP) {
    kk += (k - kk) * (1 - Math.exp(-dt * 1.6));
    const d = camP ? camP.distanceTo(root.position) : 0, fd = U.fogD.value * d, fogK = Math.exp(-fd * fd) * sstep(70, 32, d);
    portalU.uK.value = kk * fogK;
    portalU.uFlash.value = flash;
    pool.material.opacity = Math.min(1, kk * 0.45 + flash * 0.4) * fogK;
    flames.forEach((f, i) => { const fl = 0.85 + 0.15 * Math.sin(t * 13 + i * 2) * Math.sin(t * 7.3 + i); f.scale.set(1.5 * fl, 2.1 * fl, 1); f.material.opacity = 0.9 * fl * fogK; });
  }
  function portalCenter() { portal.updateMatrixWorld(); return center.setFromMatrixPosition(portal.matrixWorld); }
  root.traverse(o => { if (o.isMesh && o !== portal && o !== pool) o.castShadow = true; });
  return { group: root, update, portalCenter, portal, height: topY };
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
  vec2 dir=(uSunUV-vUv)/28.0*0.92;vec2 uv=vUv;float wt=1.0;vec3 ray=vec3(0.0);
  for(int i=0;i<28;i++){uv+=dir;ray+=texture2D(tBright,uv).rgb*wt;wt*=0.955;}
  c+=ray/28.0*uRay*uSunVis*vec3(1.0,0.82,0.62)*3.0;
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
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, Object.assign(ropt(true), { samples: LITE ? 2 : 4 }));
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
  const extras = []; let mist = null, bridge = null, gate = null, koi = null;

  /* sisa dunia dibangun bertahap supaya frame pertama cepat */
  const stages = [
    () => { const g = buildTrees(); scene.add(g); extras.push(g); },
    () => { const g = buildConifers(); scene.add(g); extras.push(g); },
    () => { const g = buildBank(); scene.add(g); extras.push(g); },
    () => { bridge = buildBridge(); scene.add(bridge.group); extras.push(bridge.group); },
    () => { mist = buildMist(); scene.add(mist); extras.push(mist); },
    () => { gate = buildGate(); scene.add(gate.group); extras.push(gate.group); },
    () => {
      loadKoi(water.material.uniforms).then(k => { if (disposed) { k.mesh.geometry.dispose(); k.mesh.material.dispose(); return; } koi = k; scene.add(k.mesh); })
        .catch(err => console.warn('Koi tidak dimuat:', err && err.message));
    }
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
    if (ctl.mode === 'reveal') v = 1.1;                     // perahu meluncur pelan ke arah gerbang
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
    applyEnv(clamp((B.z - CFG.zStart) / CFG.journey, 0, 1));

    const e = ctl.revealE;
    const atEnd = ctl.ready || (ctl.target >= 1 && B.speed < 0.6 && B.z > CFG.zStart + CFG.journey - 3);
    arrive.k += ((atEnd ? 1 : 0) - arrive.k) * (1 - Math.exp(-dt * 0.9));
    const A = sstep(0, 1, arrive.k);
    if (gate) {
      gate.update(t, dt, ctl.mode === 'reveal' ? 1.5 : (0.16 + 0.5 * A), e > 0 ? sstep(0.2, 0.6, e) * (1 - sstep(0.7, 1, e)) * 0.35 : 0, camera.position);
      gate.portalCenter(); portalP.copy(gate.portalCenter());
    } else portalP.set(cx(GATE.z), 5.9, GATE.z);

    const wu = water.material.uniforms;
    wu.uBoat.value.set(B.x, B.z); wu.uFwd.value.set(Math.sin(B.yaw), Math.cos(B.yaw)); wu.uSpeed.value = clamp(speed01, 0, 1);
    const bp = tv.b.set(B.x, 0, B.z);
    sun.position.copy(bp).addScaledVector(U.sun.value, 90); sun.target.position.copy(bp); sun.target.updateMatrixWorld();
    petals.material.uniforms.uC.value.copy(bp); floating.material.uniforms.uC.value.copy(bp);
    if (mist) mist.children.forEach(s => { s.position.x = cx(s.userData.z) + Math.sin(t * 0.05 + s.userData.ph) * 4; s.material.opacity = 0.4; });

    /* kamera: mengikuti dari belakang-samping; saat tiba naik sedikit (kolam koi dan gerbang terlihat);
       saat masuk, terbang menembus portal */
    const back = lerp(8.2, 9.8, A), side = lerp(3.8, 1.4, A), up = lerp(2.3, 4.2, A);
    const fwd = tv.a.set(Math.sin(B.yaw), 0, Math.cos(B.yaw)), right = tv.c.set(fwd.z, 0, -fwd.x);
    const des = tv.d.set(B.x, 0, B.z).addScaledVector(fwd, -back).addScaledVector(right, side); des.y = up;
    const look = tv.b.set(B.x, 1.0, B.z).addScaledVector(fwd, 3.2);
    if (A > 0) look.lerp(tmpL.copy(portalP).setY(portalP.y * 0.55), A * 0.85);
    if (!RM) { des.x += Math.sin(t * 0.31) * 0.12; des.y += Math.sin(t * 0.23) * 0.06; }
    des.y = Math.max(des.y, 1.35);
    if (e > 0) {
      const k = Math.pow(e, 1.5);
      tmpL.copy(portalP).addScaledVector(fwd, 3.5); tmpL.y = portalP.y - 1.2;
      des.lerp(tmpL, k); des.y += Math.sin(Math.PI * Math.min(1, k * 1.4)) * 1.6;
      look.lerp(tmpL.copy(portalP).addScaledVector(fwd, 40), Math.min(1, e * 1.6));
    }
    if (!camInit) { camPos.copy(des); camLook.copy(look); camInit = true; }
    else { const kk = e > 0 ? 1 - Math.exp(-dt * 7) : 1 - Math.exp(-dt * 2.6); camPos.lerp(des, kk); camLook.lerp(look, e > 0 ? kk : 1 - Math.exp(-dt * 3)); }
    camera.position.copy(camPos); camera.lookAt(camLook);
    const baseFov = camera.aspect < 0.9 ? 64 : 52, nf = baseFov + 16 * e * e;
    if (Math.abs(camera.fov - nf) > 0.01) { camera.fov = nf; camera.updateProjectionMatrix(); }
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
    water.visible = false; if (koi) koi.mesh.visible = false; renderer.clippingPlanes = [refl.clip];
    renderer.setRenderTarget(reflRT); renderer.render(scene, vc);
    renderer.clippingPlanes = []; water.visible = true; if (koi) koi.mesh.visible = true;
  }

  function render() {
    renderer.shadowMap.needsUpdate = true;
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
    if (avg > 0.024) { slow++; fast = 0; } else if (avg < 0.0155) { fast++; slow = 0; } else { slow = 0; fast = 0; }
    if (slow >= 1 && scale > 0.55) { scale = Math.max(0.55, scale - 0.1); setSize(); slow = 0; }
    else if (fast >= 4 && scale < 1) { scale = Math.min(1, scale + 0.05); setSize(); fast = 0; }
  }

  /* posisi layar (persen) tempat lubang reveal dibuka: pusat portal jika terlihat, kalau tidak perahu */
  function screenPos() {
    const v = (gate ? gate.portalCenter() : new THREE.Vector3(B.x, 0.9, B.z)).clone().project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) v.set(0, 0, 0);
    return [(v.x * 0.5 + 0.5) * 100, (1 - (v.y * 0.5 + 0.5)) * 100];
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
    kind: '3d', renderer, scene, camera, boat, B, stages, update, render, governor, setSize, screenPos, dispose,
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
  let pos = [32.8, 61.3];
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
      pos = [32.8, 61.3];
    },
    render() { }, governor() { }, setSize() { },
    screenPos() { return pos; },
    dispose() { root.innerHTML = ''; root.hidden = true; },
    get arrived() { return true; }
  };
}

/* ---------- Pengendali progres, UI, dan reveal ----------
   Pola dari sakura-fantasy (MIT, (c) 2026 Bill Chan): src/main.js report() (progres gabungan berbobot dari
   banyak pemuat paralel) dan src/ui/ui.js progress()/ready()/open() (nilai target dikejar perlahan, tombol masuk,
   lalu reveal dengan mask radial yang melebar). */
const PHASES = [
  [0, 'Menyiapkan ruang kendali'], [0.15, 'Memuat katalog gunung api dan kawasan hutan'], [0.35, 'Mengambil titik panas dan data angin'],
  [0.55, 'Menyusun lapisan peta'], [0.75, 'Memetakan fasilitas dan penduduk'], [0.9, 'Mengalibrasi zona bahaya'], [1, 'Ruang simulasi siap']
];
function createApp(opts) {
  opts = opts || {};
  const $ = id => document.getElementById(id);
  const els = {
    root: $('hlLoader'), loader: $('ldScene'), canvas: $('ldGl'), fb: $('ldFb'), skip: $('ldSkip'), sr: $('ldSr'), ring: $('ldRing'),
    pct: $('ldPct'), msg: $('ldMsg'), dot: $('ldDot'), path: $('ldPath'), enter: $('ldEnter'), sound: $('ldSound'), title: $('ldTitle'), hint: $('ldHint')
  };
  const ctl = { target: 0, smooth: 0, mode: 'loading', revealE: 0, ready: false, readyCbs: [], revealStart: 0, revealDur: 2600, lastPct: -1, lastSr: -1, lastMsg: '', t0: performance.now(), frames: 0 };
  let view = null, raf = 0, last = 0, destroyed = false, nextStageIdx = 0, hiddenTab = false, autoT = 0;
  let quick = false;
  try { quick = sessionStorage.getItem('hl-loader-seen') === '1'; sessionStorage.setItem('hl-loader-seen', '1'); } catch (e) { }
  if (opts.quick != null) quick = opts.quick;
  const sound = createRiverSound(); window.__riverSound = sound;

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
  function placeHole() {
    const sp = view ? view.screenPos() : [50, 50];
    const r = els.root.style; r.setProperty('--cx', sp[0].toFixed(1) + '%'); r.setProperty('--cy', sp[1].toFixed(1) + '%');
  }
  function beginReveal(fast) {
    if (ctl.mode !== 'loading' || destroyed) return;
    clearTimeout(autoT);
    ctl.mode = 'reveal'; ctl.revealStart = performance.now();
    const isStatic = view && view.kind === 'fallback';
    ctl.revealDur = RM || isStatic ? 450 : fast ? 1200 : 2700;
    placeHole(); els.root.style.setProperty('--hole', '-8%');
    els.root.classList.add('revealing');
    if (els.enter) els.enter.disabled = true;
    if (sound) { sound.portal(); sound.close(ctl.revealDur / 1000 + 0.6); }
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
      const h = ease(clamp((k - 0.16) / 0.84, 0, 1));
      placeHole();
      els.root.style.setProperty('--hole', (-8 + h * 135).toFixed(2) + '%');
      els.root.style.setProperty('--rot', (now * 0.12 % 360).toFixed(1) + 'deg');
      if (k >= 1) { finish(); return; }
    }
    updateUI();
    const elapsed = (now - ctl.t0) / 1000;
    if (ctl.mode === 'loading' && !ctl.ready && ctl.target >= 1 && ctl.smooth >= 0.999 && (isStatic || view.arrived || elapsed > 2.2)) showReady();
    /* pengaman: jangan pernah mengurung pengguna jika ada data yang macet */
    if (!ctl.ready && elapsed > (opts.watchdog || 22) && ctl.target < 1) { ctl.target = 1; els.sr.textContent = 'Sebagian data masih dimuat di latar.'; }
    view.update(dt, ctl);
    view.render();
    view.governor(dt);
    if (nextStageIdx < view.stages.length && ctl.frames > 1) {
      view.stages[nextStageIdx++]();
      Progress.report('dunia', nextStageIdx / view.stages.length);
    }
    ctl.frames++;
    if (ctl.frames === 2) els.root.classList.add('live');
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
      if (sound) sound.close(0.3);
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
    /* kunjungan ulang: perjalanan dipersingkat, perahu mulai dekat jembatan */
    if (quick) { CFG.zStart += CFG.journey * 0.4; CFG.journey *= 0.6; }
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
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  return { loader, boot, ctl, Progress };
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
    if (!ctx) {
      try {
        ctx = new AC();
        ctx.onstatechange = () => {
          if (ctx.state === 'running' && on) {
            fadeTo(0.8, 1.2);
          }
        };
      } catch (e) { return false; }
    }
    if (!built) build();
    return true;
  }
  function fadeTo(v, sec) { if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }

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
      return ctx.resume().catch(() => { }).then(() => { if (ctx.state === 'running') { fadeTo(0.8, 2.5); return true; } return false; });
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
    /* memudar lalu menutup konteks audio */
    close(sec) {
      if (!ctx || closing) return; closing = true; fadeTo(0, sec || 1.6);
      timers.forEach(clearTimeout); const c = ctx;
      setTimeout(() => { try { c.close(); } catch (e) { } }, (sec || 1.6) * 1000 + 200);
    },
    get prefOff() { return pref() === 'off'; }
  };
  return api;
}
