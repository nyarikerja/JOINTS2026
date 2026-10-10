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
