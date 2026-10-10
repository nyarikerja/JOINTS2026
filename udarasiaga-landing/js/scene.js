/* HelaLoka: lanskap 3D (Three.js r149, tanpa build step).
   Urutan: langit -> bukit berlapis -> pohon & rumput -> gunung api -> partikel bahaya -> cuaca -> pascaproses (bloom, sinar matahari, grading).
   Status (jam, cuaca, bahaya) dibaca dari window.US yang diisi js/page.js. */
(function(){
  var US=window.US;if(!US)return;
  var root=document.documentElement,reduce=US.reduce,T=US.T;
  var THREE=window.THREE,canvas=document.getElementById('gl'),renderer;
  if(!THREE){root.classList.add('nogl');return;}
  try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:false,alpha:false,stencil:false,powerPreference:'high-performance'});}
  catch(e){root.classList.add('nogl');return;}
  if(!renderer.getContext()){root.classList.add('nogl');return;}
  var GL2=renderer.capabilities.isWebGL2,ext=renderer.extensions;
  var mobile=window.innerWidth<700||/Mobi|Android/i.test(navigator.userAgent);
  var HDR=GL2&&(ext.has('EXT_color_buffer_float')||ext.has('EXT_color_buffer_half_float'));

  var KEYS=['ash','smoke','fire','lava','ext','mud','out','rain','storm','snow','autumn','sakura'];
  var S={hour:T.hour,hv:0,km:T.km,wind:T.wind};KEYS.forEach(function(k){S[k]=T[k];});

  var C=function(h){return new THREE.Color(h);};
  var P={aqua:C(0x8AD6D1),teal:C(0x359FA0),cream:C(0xFFF0C5),orange:C(0xFF8C52),maroon:C(0xA14646),red:C(0xDA6556),amber:C(0xEB895B),gold:C(0xFDB773)};
  function smoothstep01(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}

  /* ---------- spesifikasi suasana: jam sehari + cuaca/musim ---------- */
  function sp(o){o.over=o.over||0;o.rain=o.rain||0;o.snow=o.snow||0;o.wet=o.wet||0;o.stars=o.stars||0;o.snowLine=o.snowLine||24;o.cov=o.cov==null?.5:o.cov;
    var r={};for(var k in o){var v=o[k];r[k]=typeof v==='string'?C(v):v;}return r;}
  var SCN={
    night:sp({top:'#040A18',mid:'#0A1730',bot:'#1A2B47',fog:'#15253B',litFar:'#1D3550',litNear:'#17301F',darkFar:'#0F2034',darkNear:'#07120B',lI:.38,lightCol:'#8FA8D8',aI:.34,amb:'#3A5080',
      c1:'#3B4F72',c2:'#0E1A2E',cA:.55,cov:.35,stars:1,overCol:'#0A1730',volFog:.16,plumeShade:'#0A0E14',plumeLit:'#52607A',glow:0}),
    sunrise:sp({top:'#3B68A2',mid:'#9DB9D2',bot:'#F6B27A',fog:'#EBC4A0',litFar:'#8FA9B0',litNear:'#5E9046',darkFar:'#5F7C8E',darkNear:'#1E4023',lI:1.0,lightCol:'#FFC590',aI:.55,amb:'#9DB4D0',
      c1:'#FFD9B8',c2:'#8A97B3',cA:.75,cov:.5,overCol:'#9DB9D2',volFog:.12,plumeShade:'#6D6A70',plumeLit:'#FFE2C4',glow:1}),
    noon:sp({top:'#2A67B2',mid:'#6FA6D8',bot:'#C7DEEC',fog:'#BFD6E0',litFar:'#7FA3A8',litNear:'#4F9235',darkFar:'#587F85',darkNear:'#16401E',lI:1.15,lightCol:'#FFF4DC',aI:.66,amb:'#9CC3E6',
      c1:'#FFFFFF',c2:'#A3B6CC',cA:.9,cov:.52,overCol:'#6FA6D8',volFog:.07,plumeShade:'#1D1918',plumeLit:'#9C8F80',glow:1}),
    sunset:sp({top:'#2F3E78',mid:'#D58A80',bot:'#FFAE5E',fog:'#EAA67C',litFar:'#9A7F8C',litNear:'#76843A',darkFar:'#5A4E6A',darkNear:'#26301C',lI:1.05,lightCol:'#FF9A5A',aI:.45,amb:'#C98E9A',
      c1:'#FFB88A',c2:'#6F587F',cA:.8,cov:.55,overCol:'#B9708A',volFog:.12,plumeShade:'#3C2C34',plumeLit:'#FFB27C',glow:1.2}),
    rain:sp({top:'#46565F',mid:'#788A93',bot:'#A9B6B8',fog:'#9AA9AB',litFar:'#6E8584',litNear:'#3E6B3A',darkFar:'#485F60',darkNear:'#17301B',lI:.5,lightCol:'#CBD8D6',aI:.75,amb:'#9DB0B4',
      c1:'#8A9AA3',c2:'#55656E',cA:.95,cov:1,rain:1,over:.6,overCol:'#6D7E86',wet:1,volFog:.34,plumeShade:'#4A5558',plumeLit:'#A9B6B8',glow:0}),
    storm:sp({top:'#1A2126',mid:'#3B454A',bot:'#6A6560',fog:'#5C605F',litFar:'#4C5A5A',litNear:'#2E4A2C',darkFar:'#2E3A3C',darkNear:'#0F1E12',lI:.35,lightCol:'#B9B3A8',aI:.5,amb:'#6A7478',
      c1:'#30393E',c2:'#161B1F',cA:.97,cov:1,rain:1.3,over:.75,overCol:'#2A3034',wet:1,volFog:.4,plumeShade:'#22272A',plumeLit:'#7D7774',glow:0}),
    autumn:sp({top:'#4B79B2',mid:'#E5BC8E',bot:'#FFD79B',fog:'#EBCB9F',litFar:'#B8905E',litNear:'#C28A2E',darkFar:'#6E4C3A',darkNear:'#5A2A12',lI:1.0,lightCol:'#FFC57E',aI:.58,amb:'#D9B896',
      c1:'#FFE7C6',c2:'#9C7C6C',cA:.8,cov:.55,overCol:'#CDA77E',volFog:.1,plumeShade:'#3A2C28',plumeLit:'#E6C59C',glow:1.1}),
    snow:sp({top:'#8FA9BC',mid:'#C3D2DC',bot:'#E7ECEA',fog:'#E2E8E6',litFar:'#D5DEDC',litNear:'#B9C9C0',darkFar:'#9FB0B2',darkNear:'#6F8A82',lI:.8,lightCol:'#FFF4E0',aI:.85,amb:'#C8D5DC',
      c1:'#FFFFFF',c2:'#C4D0D8',cA:.85,cov:.9,snow:1,over:.25,snowLine:7,overCol:'#D9E4EA',volFog:.22,plumeShade:'#9AA6AA',plumeLit:'#FFFFFF',glow:.4}),
    /* musim semi: langit pastel, rumput hijau muda, kabut merah jambu tipis */
    sakura:sp({top:'#5F93CF',mid:'#BCD3EC',bot:'#FBE1E3',fog:'#F1D9DF',litFar:'#A8B8C8',litNear:'#7DB25A',darkFar:'#7A8EA2',darkNear:'#2C5A2E',lI:1.0,lightCol:'#FFE6D2',aI:.62,amb:'#D9C8DC',
      c1:'#FFF6F8',c2:'#B9A6C2',cA:.82,cov:.42,overCol:'#E9D6E0',volFog:.13,plumeShade:'#8C8088',plumeLit:'#FFF1F4',glow:1.0})
  };
  function cloneSpec(o){var r={};for(var k in o){var v=o[k];r[k]=v&&v.isColor?v.clone():v;}return r;}
  function copySpec(d,s){for(var k in s){var v=s[k];if(v&&v.isColor)d[k].copy(v);else d[k]=v;}}
  function lerpSpec(a,b,kc,kn){for(var k in b){var x=a[k],y=b[k];if(x&&x.isColor)x.lerp(y,kc);else a[k]+=(y-x)*kn;}}
  var TOD=[[0,'night'],[4.8,'night'],[6.4,'sunrise'],[9.5,'noon'],[14.5,'noon'],[17.2,'sunset'],[19.0,'night'],[24,'night']];
  var cur=cloneSpec(SCN.night);
  function todSpec(h,out){
    var hd=((h%24)+24)%24,i=0;
    while(i<TOD.length-2&&hd>TOD[i+1][0])i++;
    var a=TOD[i],b=TOD[i+1],f=Math.max(0,Math.min(1,(hd-a[0])/(b[0]-a[0])));f=f*f*(3-2*f);
    copySpec(out,SCN[a[1]]);lerpSpec(out,SCN[b[1]],f,f);return out;
  }
  /* matahari dan bulan menyusuri busur: terbit di kiri, terbenam di kanan */
  function skyBody(h,phase){var ang=Math.PI*2*(h-6)/24+phase,e=Math.sin(ang);return {e:e,cx:-Math.cos(ang)};}

  var scene=new THREE.Scene();
  var camera=new THREE.PerspectiveCamera(38,1,.5,500);
  camera.position.set(0,3,22);
  var PR=Math.min(window.devicePixelRatio||1,mobile?1.25:1.75),Q=1,emaDt=.016,fc=0,noAdapt=/[?&]hq/.test(location.search);
  renderer.setPixelRatio(PR);
  var shared={uTime:{value:0},uWind:{value:1},uGust:{value:.5},uPR:{value:PR},uPointer:{value:new THREE.Vector2(9,9)},uRes:{value:new THREE.Vector2(1,1)},
    uFlash:{value:0},uCS:{value:0},uSunCol:{value:new THREE.Color(1,.9,.7)},uBack:{value:0}};

  /* bayangan awan yang berarak di atas lanskap (koordinat dunia) */
  var CSH=[
    'uniform float uCS;',
    'float csH(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}',
    'float csN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(csH(i),csH(i+vec2(1.,0.)),f.x),mix(csH(i+vec2(0.,1.)),csH(i+vec2(1.,1.)),f.x),f.y);}',
    'float cloudShadow(vec2 w){vec2 p=w*.05+vec2(-uTime*.02*uWind,0.);float n=csN(p)*.62+csN(p*2.3+5.1)*.38;return smoothstep(.48,.7,n)*uCS;}'
  ].join('\n');

  /* ---------- langit: gradasi, matahari, bulan, bintang, Bima Sakti, awan fbm ---------- */
  var skyU={uTop:{value:new THREE.Color()},uMid:{value:new THREE.Color()},uBot:{value:new THREE.Color()},uSunCol:{value:new THREE.Color()},uSun:{value:new THREE.Vector2(.2,.52)},uSunR:{value:.03},uGlowK:{value:1},uHorGlow:{value:0},uAspect:{value:1.6},uHaze:{value:0},uFlash:{value:0},uFlashPos:{value:new THREE.Vector2(.7,.5)},uHazeCol:{value:new THREE.Color()},
    uMoon:{value:new THREE.Vector3(.3,.2,0)},uMoonCol:{value:C(0xEEF2E6)},uStars:{value:0},uOver:{value:0},uOverCol:{value:new THREE.Color()},
    uCov:{value:.5},uCLit:{value:new THREE.Color()},uCShade:{value:new THREE.Color()},uCA:{value:.8},uAsh:{value:0},uTime:shared.uTime,uWind:shared.uWind};
  var sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    uniforms:skyU,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.9999,1.);}',
    fragmentShader:[
      'varying vec2 vUv;uniform vec3 uTop,uMid,uBot,uSunCol,uHazeCol,uMoonCol,uOverCol,uCLit,uCShade;uniform vec2 uSun,uFlashPos;uniform vec3 uMoon;',
      'uniform float uSunR,uAspect,uHaze,uFlash,uGlowK,uHorGlow,uStars,uOver,uTime,uCov,uCA,uAsh,uWind;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
      'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
      'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return s;}',
      'vec3 starL(vec2 p,float dens,float sz){vec2 id=floor(p),f=fract(p)-.5;float hh=hash(id);vec2 o=(vec2(hash(id+3.1),hash(id+7.7))-.5)*.6;float m=step(1.-dens,hh);float d=length(f-o);float mag=pow(hash(id+11.3),2.6);float tw=.72+.28*sin(uTime*(1.4+hash(id)*3.5)+hh*60.);',
      'float core=smoothstep(sz,0.,d)+.4*smoothstep(sz*3.2,0.,d)*mag+.25*mag*smoothstep(sz*.5,0.,min(abs(f.x-o.x),abs(f.y-o.y)))*smoothstep(sz*6.,0.,d);',
      'vec3 tint=mix(vec3(.72,.82,1.),vec3(1.,.84,.62),hash(id+5.5));return tint*m*mag*tw*core;}',
      'float cloud(vec2 q){float d=fbm(q+vec2(0.,fbm(q*.6)*.8));return smoothstep(1.02-uCov*.62,1.12-uCov*.5,d+.34*uCov);}',
      'void main(){float y=vUv.y;',
      'vec3 c=mix(uBot,uMid,smoothstep(.47,.74,y));c=mix(c,uTop,smoothstep(.64,1.,y));',
      'vec2 d=(vUv-uSun)*vec2(uAspect,1.);float r=length(d);',
      /* hamburan Mie di sekitar matahari + pita terang di cakrawala */
      'c+=uSunCol*exp(-r*2.4)*.1*uGlowK;c+=uSunCol*exp(-r*r*10.)*.2*uGlowK;c+=uSunCol*exp(-r*r*70.)*.45*uGlowK;',
      'c+=uSunCol*uHorGlow*exp(-d.x*d.x*1.6)*exp(-pow((y-.5)*6.5,2.))*.6;',
      'c=mix(c,c*vec3(1.04,1.02,.98)+.03,exp(-pow((y-.49)*14.,2.))*.6);',
      'if(uStars>.002){vec2 sg=(vUv-vec2(.5,.35))*vec2(uAspect,1.);float rt=uTime*.004;sg=mat2(cos(rt),-sin(rt),sin(rt),cos(rt))*sg;',
      'vec3 sc=starL(sg*110.,.07,.14)*.8+starL(sg*52.+7.,.06,.17)+starL(sg*21.+3.,.05,.12)*1.6;',
      'float mn=dot(sg,normalize(vec2(.78,.62)));float band=exp(-mn*mn*7.);float grain=fbm(sg*6.+3.)*.7+fbm(sg*17.)*.3;float dust=smoothstep(.45,.68,fbm(sg*9.+11.));',
      'float mw=band*(.2+.8*grain)*(1.-.65*dust);vec3 mwc=mix(vec3(.5,.58,.85),vec3(.95,.82,.7),band*grain);',
      'c+=(sc+mwc*mw*.28)*smoothstep(.5,.8,y)*uStars;}',
      'float sunD=(1.-smoothstep(uSunR*.9,uSunR,r))*step(.002,uSunR);c=mix(c,uSunCol*1.6+.25,sunD);',
      'vec2 dm=(vUv-uMoon.xy)*vec2(uAspect,1.);float rm=length(dm);float mo=smoothstep(0.,.01,uMoon.z);',
      'float crat=.86+.14*vn(dm*70.)*vn(dm*23.+4.);c+=uMoonCol*exp(-rm*rm*55.)*.25*mo;c=mix(c,uMoonCol*crat*1.15,(1.-smoothstep(uMoon.z*.94,uMoon.z,rm))*mo);',
      /* awan perspektif: makin dekat horizon makin rapat dan kecil */
      'float hz=max(y-.47,.0);float pz=1./(hz*2.6+.16);',
      'vec2 q=vec2((vUv.x-.5)*uAspect*pz*1.5+uTime*.012*uWind,pz*1.1);',
      'float dn=cloud(q);float dl=cloud(q+normalize((uSun-vUv)*vec2(uAspect,1.)+1e-4)*.35);',
      'float lit=clamp(.55+(dn-dl)*2.2+.2*(1.-dn),0.,1.);vec3 cc=mix(uCShade,uCLit,lit);',
      'cc+=uSunCol*exp(-r*r*14.)*.3*(1.-dn)*uGlowK;',
      'cc=mix(cc,uCShade*.55,uAsh*.5);',
      'float ca=dn*uCA*smoothstep(.0,.07,hz);c=mix(c,cc,ca);',
      'vec2 cq=vec2((vUv.x-.5)*uAspect*pz*.8+uTime*.008*uWind,pz*.75)+vec2(5.,2.);vec2 sd=normalize((uSun-vUv)*vec2(uAspect,1.)+1e-4)*.22;',
      'float cu=smoothstep(.45,.85,cloud(cq*.55));float cu2=smoothstep(.45,.85,cloud(cq*.55+sd));',
      /* tepi awan kumulus yang tembus cahaya (silver lining) */
      'float cl=clamp(.62+(cu-cu2)*2.6+.25*(1.-cu)*cu*4.,0.,1.);vec3 cuc=mix(mix(uCShade,uCLit,.4),vec3(1.,.99,.96)*mix(uCLit,vec3(1.),.5),cl);',
      'cuc+=uSunCol*exp(-r*r*10.)*(.25+.6*(1.-cu)*cu*4.)*uGlowK;cuc=mix(cuc,uCShade*.55,uAsh*.5);',
      'c=mix(c,cuc,cu*uCA*(1.-uOver)*.9*smoothstep(.03,.1,hz)*(1.-smoothstep(.86,1.,y)));',
      'c=mix(c,uOverCol,uOver*(.35+.65*smoothstep(.2,.9,y)));',
      'vec2 dc=(vUv-uFlashPos)*vec2(uAspect,1.);c+=vec3(1.,.9,.72)*uFlash*.7*exp(-dot(dc,dc)*7.)+vec3(.8,.85,.9)*uFlash*.14;',
      'c=mix(c,uHazeCol,uHaze*.55*(.35+.65*(1.-y)));',
      'c+=(hash(gl_FragCoord.xy)-.5)/200.;gl_FragColor=vec4(c,1.);}'
    ].join('\n')
  }));
  sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);

  /* ---------- bukit berlapis (pita) ---------- */
  var NO=6,FREQ=[1,2.13,4.37,8.9,17.3,33.7],AMPW=[.42,.26,.16,.09,.05,.02];
  var layerDefs=[
    {z:-100,base:7,amp:9,f:.03,seed:1.3,can:0,tex:0,seg:1200,sm:0,mead:0,fs:6},
    {z:-80,base:3,amp:8,f:.045,seed:4.1,can:.05,tex:.2,seg:1600,sm:0,mead:0,fs:6},
    {z:-42,base:-7,amp:7,f:.06,seed:2.9,can:.2,tex:.55,seg:2600,sm:.2,mead:0,fs:6},
    {z:-27,base:-6.4,amp:4.6,f:.07,seed:5.6,can:.1,tex:.6,seg:3000,sm:.8,mead:.9,fs:7},
    {z:-14,base:-4.8,amp:3.4,f:.075,seed:9.2,can:.05,tex:1,seg:3600,sm:1,mead:1,fs:3.6},
    {z:-7,base:-2.6,amp:3,f:.09,seed:3.3,can:.1,tex:1,seg:3600,sm:1,mead:1,fs:1.8}
  ];
  function heightJS(L,x){var s=0;for(var i=0;i<NO;i++){var v=Math.sin(x*L.F[i]+L.Pp[i]);s+=AMPW[i]*((i%2===0)?(1-Math.abs(v))*(1-L.sm)+(.5+.5*v)*L.sm:.5+.5*v);}return L.base+L.amp*s;}
  var ridgeV=[
    'uniform float uA[6],uF[6],uP[6];uniform float uAmp,uBase,uCan,uSm;',
    'varying float vH,vWY,vX,vSlope;',
    'float hs1(float n){return fract(sin(n*127.1)*43758.5453);}',
    'float vn1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(hs1(i),hs1(i+1.),f);}',
    'float height(float x){float s=0.;for(int i=0;i<6;i++){float v=sin(x*uF[i]+uP[i]);s+=uA[i]*mix(.5+.5*v,mix(1.-abs(v),.5+.5*v,uSm),step(mod(float(i),2.),.5));}return uBase+uAmp*s;}',
    'void main(){float x=position.x;float top=step(0.,position.y);float h0=height(x);',
    'float cn=uCan*(vn1(x*2.4)*.55+vn1(x*6.3)*.3+vn1(x*15.)*.18);float h=h0+cn;float wy=mix(-45.,h,top);',
    'vSlope=(height(x+.12)-height(x-.12))/.24;vH=h;vWY=wy;vX=x;',
    'gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(x,wy,0.,1.);}'
  ].join('\n');
  var ridgeF=[
    'uniform vec3 uLit,uDark,uFog,uHazeCol,uLightDir,uLightCol;uniform vec3 uGrassA,uGrassB;uniform float uFogK,uHaze,uTex,uSnowK,uNight,uMead,uFS,uTime,uWind,uZ,uWet,uSak,uFlash;',
    'varying float vH,vWY,vX,vSlope;',CSH,
    'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);}',
    'void main(){vec3 n=normalize(vec3(-vSlope,1.,.35));float lit=clamp(dot(n,normalize(uLightDir))*.55+.48,0.,1.);',
    'float below=vH-vWY;float nz=vn2(vec2(vX*1.1,vWY*.45))*.55+vn2(vec2(vX*3.4,vWY*1.2))*.45;',
    'float can=vn2(vec2(vX*6.,vWY*3.2))*.5+vn2(vec2(vX*15.,vWY*8.))*.3+vn2(vec2(vX*34.,vWY*18.))*.2;',
    'lit=mix(lit,.5,smoothstep(1.5,9.,below)*.8);lit=clamp(lit+(nz-.5)*.16,0.,1.);',
    'vec3 col=mix(uDark,uLit,lit);col*=1.+uTex*(can-.5)*.9;',
    'if(uMead>.01){float gz=vn2(vec2(vX*9.,vWY*5.))*.5+vn2(vec2(vX*26.,vWY*14.))*.3+vn2(vec2(vX*70.,vWY*38.))*.2;',
    'float pt=vn2(vec2(vX*.55,vWY*.3));float k=clamp(lit*.8+(gz-.5)*.9+(pt-.5)*.7+.1,0.,1.);',
    'vec3 gr=mix(uGrassA,uGrassB,k);',
    /* bunga liar tersebar di padang */
    'vec2 g=vec2(vX,vWY)*uFS;vec2 id=floor(g);float hh=h2(id);vec2 jt=vec2(h2(id+3.3),h2(id+8.1))-.5;vec2 f=fract(g)-.5-jt*.5;float rr=length(f*vec2(1.,1.25));',
    'float fl=step(.8-uSak*.12,hh)*smoothstep(.22,.1,rr)*smoothstep(.5,1.8,below);',
    'float cs=h2(id+.37);vec3 fc=cs<.3?vec3(1.,.55,.2):(cs<.55?vec3(1.,.82,.2):(cs<.85?vec3(1.,.96,.9):vec3(.92,.3,.22)));fc=mix(fc,cs<.5?vec3(1.,.78,.85):vec3(.97,.6,.74),uSak*.85);',
    'gr=mix(gr,fc*(.7+.4*lit),fl*.95);',
    /* hamparan kelopak sakura yang gugur */
    'float pk=step(.74,vn2(vec2(vX*34.,vWY*19.)))*smoothstep(.4,2.,below);gr=mix(gr,vec3(.99,.83,.88)*(.78+.3*lit),pk*uSak*.6);',
    'col=mix(col,gr,uMead);}',
    'col+=uLightCol*.14*smoothstep(1.4,0.,below)*lit;',
    'col*=1.-cloudShadow(vec2(vX,uZ*2.+vWY*.4))*.34*(1.-uFogK);',
    'col*=1.-.16*uWet;',
    'col=mix(col,vec3(.93,.96,.97)*(1.-.5*uNight),uSnowK*smoothstep(.2,.6,nz+.15*lit));',
    'col+=vec3(.55,.6,.75)*uFlash*.22*(1.-uFogK*.6);',
    'col=mix(col,uFog,smoothstep(2.,18.,below)*.55);',
    'col=mix(col,uFog,uFogK);col=mix(col,uHazeCol,uHaze*.3);gl_FragColor=vec4(col,1.);}'
  ].join('\n');
  var ridges=[];
  layerDefs.forEach(function(L,idx){
    L.t=idx/(layerDefs.length-1);
    L.F=FREQ.map(function(m){return m*L.f;});
    L.Pp=FREQ.map(function(_,i){return L.seed*(i+1.7)+i*2.1;});
    var u=Object.assign({uA:{value:AMPW},uF:{value:L.F},uP:{value:L.Pp},uAmp:{value:L.amp},uBase:{value:L.base},uCan:{value:L.can},uSm:{value:L.sm},uTex:{value:L.tex},uMead:{value:L.mead},uFS:{value:L.fs},uZ:{value:L.z},
      uGrassA:{value:new THREE.Color()},uGrassB:{value:new THREE.Color()},uLit:{value:new THREE.Color()},uDark:{value:new THREE.Color()},uFog:{value:new THREE.Color()},uHazeCol:{value:new THREE.Color()},uLightCol:{value:new THREE.Color()},
      uLightDir:{value:new THREE.Vector3(.6,.5,.4)},uFogK:{value:.5},uHaze:{value:0},uSnowK:{value:0},uNight:{value:0},uWet:{value:0},uSak:{value:0}},
      {uTime:shared.uTime,uWind:shared.uWind,uCS:shared.uCS,uFlash:shared.uFlash});
    var m=new THREE.Mesh(new THREE.PlaneGeometry(340,1,L.seg,1),new THREE.ShaderMaterial({uniforms:u,vertexShader:ridgeV,fragmentShader:ridgeF}));
    /* opak: digambar dari depan ke belakang agar piksel tertutup dibuang lebih awal (early-z) */
    m.position.z=L.z;m.frustumCulled=false;m.renderOrder=6-idx;scene.add(m);
    L.u=u;L.mesh=m;ridges.push(L);
  });

  /* ---------- pohon: atlas lukisan prosedural 16 sel (256x512) berisi spesies khas Indonesia ----------
     Tiap pohon dilukis sekali dari ribuan sapuan daun berbayang (cahaya dari kiri atas), batang berkulit kayu, dan gumpalan tajuk berlapis.
     Di shader: goyang angin, daun meranggas saat kemarau, mekar merah jambu saat musim bunga, salju di tepi atas tajuk, cahaya tembus di tepi. */
  var treeMeshes=[];
  function rnd(seed){var s=seed;return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}
  /* sel: [nama, tinggi isi (fraksi sel), meranggas?] */
  var TREE_SP=[['mahoni',.96,1],['mahoni2',.9,1],['beringin',.86,0],['flamboyan',.8,1],['pinus',.99,0],['cemara',.97,0],['randu',.96,1],['jati',.92,1],
    ['pisang',.62,0],['bambu',.98,0],['semak',.36,1],['semakBunga',.32,1],['jambu',.7,1],['cemaraKipas',.95,0],['pinus2',.96,0],['trembesi',.78,1]];
  var treeTex=(function(){
    var K=mobile?.5:1,cv=document.createElement('canvas');cv.width=2048*K;cv.height=1024*K;var g=cv.getContext('2d');g.scale(K,K);g.lineCap='round';g.lineJoin='round';
    var R=rnd(7331);
    function cl(v){return Math.max(0,Math.min(255,Math.round(v)));}
    function rgb(c,a){return 'rgba('+cl(c[0])+','+cl(c[1])+','+cl(c[2])+','+(a==null?1:a)+')';}
    function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
    function gauss(){return (R()+R()+R()-1.5)/1.5;}
    /* batang meruncing di sepanjang kurva kuadrat, bulat dengan gradasi terang-kiri dan alur kulit kayu */
    function trunk(x0,y0,x1,y1,w0,w1,bend,bark){
      var N=18,L=[],Rr=[],mx=(x0+x1)/2+bend,my=(y0+y1)/2;
      for(var i=0;i<=N;i++){var t=i/N,a=1-t,x=a*a*x0+2*a*t*mx+t*t*x1,y=a*a*y0+2*a*t*my+t*t*y1,dx=2*a*(mx-x0)+2*t*(x1-mx),dy=2*a*(my-y0)+2*t*(y1-my),l=Math.hypot(dx,dy)||1,w=(w0+(w1-w0)*t)/2;
        L.push([x-dy/l*w,y+dx/l*w]);Rr.push([x+dy/l*w,y-dx/l*w]);}
      g.beginPath();g.moveTo(L[0][0],L[0][1]);L.forEach(function(p){g.lineTo(p[0],p[1]);});for(var j=N;j>=0;j--)g.lineTo(Rr[j][0],Rr[j][1]);g.closePath();
      var gr=g.createLinearGradient(Math.min(x0,x1)-w0/2,0,Math.max(x0,x1)+w0/2,0);bark=bark||[96,74,56];
      gr.addColorStop(0,rgb(mix(bark,[255,240,220],.18)));gr.addColorStop(.45,rgb(bark));gr.addColorStop(1,rgb(mix(bark,[10,8,6],.55)));g.fillStyle=gr;g.fill();
      g.save();g.clip();g.strokeStyle=rgb(mix(bark,[0,0,0],.45),.45);g.lineWidth=.8;
      for(var k=0;k<Math.max(3,w0/2);k++){var o=(R()-.5)*w0*.8,ty=R();g.beginPath();g.moveTo(x0+o,y0);g.quadraticCurveTo(mx+o*.8,my,x1+o*(w1/w0),y1+(y0-y1)*ty*.2);g.stroke();}
      g.restore();
    }
    /* gumpalan daun: isian gelap, sapuan daun berbayang mengikuti arah cahaya, lalu kilau di tepi yang tersinari */
    function clump(cx,cy,rx,ry,P,dens,leafS,flower){
      var n=Math.round(rx*ry*dens*.06);
      /* siluet padat bertepi bergerigi lebih dulu, agar tajuk tetap rapat saat mengecil (mipmap) */
      g.fillStyle=rgb(mix(P[0],P[1],.35));g.beginPath();for(var e=0;e<=24;e++){var ea=e/24*6.283,er=.78+R()*.16;g[e?'lineTo':'moveTo'](cx+Math.cos(ea)*rx*er,cy+Math.sin(ea)*ry*er);}g.closePath();g.fill();
      for(var i=0;i<n*.35;i++){var a=R()*6.283,r=Math.sqrt(R())*.8;g.fillStyle=rgb(mix(P[0],P[1],R()*.4),.9);g.beginPath();g.ellipse(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,leafS*1.8,leafS*1.3,R()*3,0,6.283);g.fill();}
      for(var j=0;j<n;j++){var a2=R()*6.283,r2=Math.pow(R(),.6),ox=Math.cos(a2)*r2,oy=Math.sin(a2)*r2,x=cx+ox*rx*(1+(R()-.5)*.25),y=cy+oy*ry*(1+(R()-.5)*.25);
        var lit=Math.max(0,Math.min(1,.5+(-ox*.55-oy*.85)*.6*r2+(R()-.5)*.35)),c=lit<.5?mix(P[0],P[1],lit*2):mix(P[1],P[2],(lit-.5)*2);
        if(flower&&R()<flower[1]*(.4+lit))c=mix(flower[0],[255,250,240],lit*.3*R());
        g.fillStyle=rgb(c);g.beginPath();g.ellipse(x,y,leafS*(.7+R()*.6),leafS*(.4+R()*.35),R()*3.14,0,6.283);g.fill();}
      for(var h=0;h<n*.06;h++){var a3=-2.2+(R()-.5)*1.6,r3=.55+R()*.4;g.fillStyle=rgb(mix(P[2],P[3],R()),.85);g.beginPath();g.ellipse(cx+Math.cos(a3)*rx*r3,cy+Math.sin(a3)*ry*r3,leafS*.6,leafS*.35,R()*3,0,6.283);g.fill();}
    }
    function canopy(cx,cy,rx,ry,nC,P,dens,leafS,flower,flat){
      var C=[];for(var i=0;i<nC;i++){var a=R()*6.283,r=Math.sqrt(R())*.62;C.push([cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r*(flat?.6:1),rx*(.32+R()*.22),ry*(.3+R()*.2)]);}
      C.sort(function(a,b){return (a[1]-cy)/ry-(b[1]-cy)/ry;});
      /* gumpalan bawah/belakang lebih gelap: bayangan diri tajuk */
      C.forEach(function(c){var sh=Math.max(0,(c[1]-cy)/ry);var Q=[mix(P[0],[0,0,0],sh*.25),mix(P[1],P[0],sh*.4),mix(P[2],P[1],sh*.5),P[3]];clump(c[0],c[1],c[2],c[3],Q,dens,leafS,flower);});
    }
    function branches(x,y,top,n,spread,w){for(var i=0;i<n;i++){var t=.45+R()*.4,by=y+(top-y)*t,ex=x+(R()-.5)*spread,ey=top+(R()-.3)*30;trunk(x,by,ex,ey,w*(.5-t*.25),w*.12,(ex-x)*.2,[88,68,52]);}}
    var GREEN=[[22,46,24],[52,92,40],[104,146,62],[188,210,120]],GREEN2=[[28,52,30],[66,108,50],[128,166,76],[206,222,140]],DARKC=[[16,34,30],[34,66,52],[70,108,78],[150,178,130]];
    var PAINT={
      mahoni:function(){trunk(0,0,-6,-200,30,11,-10);branches(-4,-120,-330,5,150,16);canopy(-4,-330,108,150,11,GREEN,1,4.2);},
      mahoni2:function(){trunk(0,0,8,-170,18,8,12);branches(4,-110,-300,4,140,14);canopy(6,-300,100,130,10,GREEN2,1,4);},
      beringin:function(){
        trunk(-30,0,-12,-150,22,12,-14);trunk(26,0,10,-150,22,12,16);trunk(0,0,0,-170,50,20,0);
        g.strokeStyle='rgba(60,50,40,.45)';g.lineWidth=.9;for(var i=0;i<12;i++){var x=(R()-.5)*190,y0=-190-R()*30;g.beginPath();g.moveTo(x,y0);g.quadraticCurveTo(x+(R()-.5)*8,y0*.5,x+(R()-.5)*6,-R()*40);g.stroke();}
        branches(0,-140,-250,7,220,22);canopy(0,-290,122,110,16,DARKC,1.05,4.3,null,1);},
      flamboyan:function(){trunk(0,0,-4,-170,26,12,-6);for(var i=0;i<6;i++){var ex=(i/5-.5)*230;trunk(-2,-160,ex,-260-R()*25,11,3,ex*.15,[90,70,54]);}
        canopy(0,-280,122,62,13,[[30,58,28],[64,108,44],[118,156,66],[196,214,130]],1,3.8,[[224,72,34],.42],1);},
      pinus:function(){trunk(0,0,4,-480,13,4,6,[120,82,56]);
        for(var i=0;i<9;i++){var y=-260-i*26,s=(i%2?1:-1),ex=s*(30+R()*55)*(1-i/12);trunk(2,y+18,ex,y,6,2,0,[110,76,52]);canopy(ex*.7,y-6,62*(1-i/16),24,4,[[16,40,34],[36,74,56],[82,120,82],[160,186,130]],1.2,3.2,null,1);}},
      pinus2:function(){trunk(0,0,-8,-460,12,4,-14,[124,86,58]);
        for(var i=0;i<7;i++){var y=-300-i*24,s=(i%2?-1:1),ex=-8+s*(26+R()*50);trunk(-6,y+16,ex,y,6,2,0,[110,76,52]);canopy(ex*.7,y-5,58,22,4,[[18,44,36],[40,80,58],[90,128,86],[168,192,136]],1.2,3.2,null,1);}},
      cemara:function(){trunk(0,0,0,-470,10,3,4,[92,72,58]);
        /* tirai daun jarum cemara gunung yang menjuntai */
        for(var i=0;i<46;i++){var t=i/45,y=-150-t*320,w=(1-t)*68+10,x=(R()-.5)*w*1.6,len=26+R()*30;
          for(var k=0;k<14;k++){var sx=x+(R()-.5)*16,lit=.5-(sx/(w+1))*.4+(R()-.5)*.3;g.strokeStyle=rgb(mix([20,40,32],[84,118,80],Math.max(0,Math.min(1,lit))),.9);g.lineWidth=1.4;
            g.beginPath();g.moveTo(sx,y);g.quadraticCurveTo(sx+(R()-.5)*8,y+len*.4,sx+(R()-.5)*10,y+len);g.stroke();}}},
      cemaraKipas:function(){trunk(0,0,0,-120,10,6,0);
        for(var i=0;i<24;i++){var t=i/23,y=-80-t*390,w=(1-Math.pow(t,1.3))*52+6;canopy(0,y,w,26,2,[[16,40,30],[32,74,48],[76,122,74],[150,184,120]],1.3,3.2);}},
      /* randu: batang gendut berbanir, dahan mendatar bertingkat; jati: batang lurus tebal, tajuk lonjong berdaun lebar */
      randu:function(){trunk(0,0,0,-420,40,12,0,[118,108,92]);for(var i=0;i<5;i++){var y=-200-i*52,s=i%2?1:-1,len=(90-i*12);trunk(0,y+8,s*len,y-14,12-i,3,0,[110,100,86]);
          trunk(0,y+8,-s*len*.7,y-8,9-i,3,0,[110,100,86]);canopy(s*len*.8,y-18,40-i*4,16,3,GREEN2,1.2,3.4,null,1);canopy(-s*len*.6,y-12,32-i*3,14,2,GREEN2,1.2,3.4,null,1);}
        canopy(0,-450,46,30,4,GREEN2,1.2,3.4);},
      jati:function(){trunk(0,0,4,-260,36,16,6,[104,86,66]);branches(3,-200,-360,5,170,22);canopy(4,-350,112,140,12,[[30,52,22],[74,106,40],[136,164,72],[206,214,140]],.95,5.2);},
      pisang:function(){
        for(var s=0;s<3;s++){var bx=(s-1)*26,h=150+R()*90;trunk(bx,0,bx*1.2,-h,16,11,(s-1)*6,[112,128,70]);
          for(var l=0;l<5;l++){var a=-Math.PI/2+(l-2)*.55+(R()-.5)*.3,len=90+R()*40;bananaLeaf(bx*1.2,-h,a,len,l===4&&s===0);}}},
      bambu:function(){
        for(var i=0;i<18;i++){var bx=(R()-.5)*40,ex=bx+(R()-.5)*210,ey=-380-R()*110,w=4+R()*3,col=R()<.3?[150,160,70]:[96,134,58];
          var mx=(bx+ex)/2+(ex-bx)*.25,my=(ey)*.55;
          g.strokeStyle=rgb(col);g.lineWidth=w;g.beginPath();g.moveTo(bx,0);g.quadraticCurveTo(mx,my,ex,ey);g.stroke();
          g.strokeStyle=rgb(mix(col,[255,255,220],.3),.5);g.lineWidth=w*.3;g.beginPath();g.moveTo(bx-w*.25,0);g.quadraticCurveTo(mx-w*.25,my,ex-w*.25,ey);g.stroke();
          for(var t=.08;t<1;t+=.075){var a=1-t,x=a*a*bx+2*a*t*mx+t*t*ex,y=a*a*0+2*a*t*my+t*t*ey;g.fillStyle=rgb(mix(col,[30,40,20],.5));g.fillRect(x-w*.7,y-1,w*1.4,2);
            if(t>.35)for(var k=0;k<3;k++){var la=(R()-.5)*2.4+(ex>bx?.4:-.4),ll=12+R()*8,lc=mix([40,84,34],[150,186,90],R());g.fillStyle=rgb(lc);g.save();g.translate(x,y);g.rotate(la+Math.PI/2*.2);
              g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(ll*.5,-2.6,ll,1.5);g.quadraticCurveTo(ll*.5,2.6,0,0);g.fill();g.restore();}}}},
      semak:function(){canopy(0,-80,110,70,12,GREEN2,1.2,3.6,null,1);},
      semakBunga:function(){canopy(0,-70,105,62,11,GREEN,1.2,3.4,[[236,120,170],.25],1);canopy(0,-70,90,50,4,GREEN,.5,3,[[250,248,240],.35],1);},
      jambu:function(){trunk(0,0,3,-120,22,10,4);branches(2,-80,-230,5,140,12);canopy(2,-240,100,98,11,[[26,52,26],[62,104,44],[120,160,70],[200,220,140]],1,4);
        for(var i=0;i<16;i++){var a=R()*6.283,r=Math.sqrt(R())*.8;g.fillStyle=rgb(mix([200,40,60],[255,140,150],R()));g.beginPath();g.arc(2+Math.cos(a)*90*r,-240+Math.sin(a)*85*r,3,0,6.283);g.fill();}},
      trembesi:function(){trunk(0,0,0,-130,44,18,0);for(var i=0;i<7;i++){var ex=(i/6-.5)*240;trunk(0,-120,ex,-250-R()*30,13,3,ex*.2);}
        canopy(0,-300,124,70,17,[[20,46,26],[50,94,42],[104,146,62],[184,206,118]],1,3.8,null,1);}
    };
    function bananaLeaf(x,y,a,len,dry){
      g.save();g.translate(x,y);g.rotate(a);var droop=len*.18;
      var gr=g.createLinearGradient(0,-14,0,14);gr.addColorStop(0,dry?'#9C8A50':'#9CCB5A');gr.addColorStop(.5,dry?'#7A6436':'#5E9A36');gr.addColorStop(1,dry?'#5C4A28':'#2F6224');g.fillStyle=gr;
      g.beginPath();g.moveTo(0,0);g.bezierCurveTo(len*.3,-16,len*.8,-14+droop,len,droop);g.bezierCurveTo(len*.8,14+droop,len*.3,15,0,0);g.fill();
      g.strokeStyle=dry?'rgba(220,200,140,.6)':'rgba(220,240,170,.65)';g.lineWidth=1.4;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(len*.6,droop*.3,len,droop);g.stroke();
      /* sobekan khas daun pisang */
      g.globalCompositeOperation='destination-out';g.lineWidth=1.2;for(var k=0;k<6;k++){var t=.25+R()*.7,sx=len*t,side=R()<.5?-1:1;g.beginPath();g.moveTo(sx,droop*t*t+side*2);g.lineTo(sx+3,droop*t*t+side*16);g.stroke();}
      g.globalCompositeOperation='source-over';g.restore();
    }
    function grassBase(w){var sg=g.createRadialGradient(0,0,0,0,0,w);sg.addColorStop(0,'rgba(20,24,14,.55)');sg.addColorStop(1,'rgba(20,24,14,0)');g.fillStyle=sg;g.save();g.scale(1,.25);g.beginPath();g.arc(0,0,w,0,6.283);g.fill();g.restore();
      for(var k=0;k<w*1.6;k++){var x=(R()-.5)*w*1.7,h=5+R()*12;g.strokeStyle=rgb(mix([46,80,30],[130,168,70],R()));g.lineWidth=1.3;g.beginPath();g.moveTo(x,1);g.quadraticCurveTo(x+(R()-.5)*4,-h*.5,x+(R()-.5)*6,-h);g.stroke();}}
    var FLARE={mahoni:30,mahoni2:20,beringin:60,flamboyan:26,jambu:22,trembesi:44,randu:46,jati:36};
    TREE_SP.forEach(function(sp,i){var col=i%8,row=i>>3;g.save();g.beginPath();g.rect(col*256+4,row*512+4,248,504);g.clip();g.translate(col*256+128,row*512+506);
      var fw=FLARE[sp[0]];if(fw){g.fillStyle='#4A3A2C';g.beginPath();g.moveTo(-fw*.95,1);g.quadraticCurveTo(-fw*.45,-4,-fw*.4,-fw*.7);g.lineTo(fw*.4,-fw*.7);g.quadraticCurveTo(fw*.45,-4,fw*.95,1);g.closePath();g.fill();}
      PAINT[sp[0]]();grassBase(fw?fw*1.3:30);g.restore();});
    var t=new THREE.CanvasTexture(cv);t.premultiplyAlpha=true;t.anisotropy=4;return t;
  })();
  var treeV=['attribute vec2 aC;attribute vec4 aI;attribute float aD;uniform float uTime,uWind,uGust;varying vec2 vUv;varying float vSd,vDec,vWX;',
    'void main(){float cell=aI.x,col=mod(cell,8.),row=floor(cell/8.);vec3 q=position;float h=aI.w;',
    'q.x+=aC.x*aI.z*.5;q.y+=aC.y*h;',
    'float k=aC.y*aC.y;float sw=sin(uTime*(1.1+aI.y*.6)+q.x*.4+aI.y*20.)*(.035+.06*uGust)+sin(uTime*2.6+aI.y*31.)*.012+uWind*.045*uGust;q.x+=sw*h*k;',
    'vUv=vec2((col*256.+128.+aC.x*124.)/2048.,1.-(row*512.+506.-aC.y*502.)/1024.);vSd=aI.y;vDec=aD;vWX=q.x;',
    'gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(q,1.);}'].join('\n');
  var treeF=['uniform sampler2D uMap;uniform vec3 uTint,uFog,uSunCol;uniform float uFogK,uSunX,uAut,uSak,uSnowK,uBack,uFlash,uTime,uWind,uZ;varying vec2 vUv;varying float vSd,vDec,vWX;',CSH,
    'void main(){vec4 t=texture2D(uMap,vUv);if(t.a<.2)discard;vec3 c=t.rgb/t.a;',
    'float leaf=smoothstep(.0,.07,c.g-max(c.r,c.b)*.9);float lum=dot(c,vec3(.3,.59,.11));',
    /* kemarau: tajuk meranggas kuning-jingga-cokelat per pohon */
    'float ak=fract(vSd*7.31);vec3 aut=ak<.35?vec3(lum*1.9+.08,lum*1.15,lum*.35):(ak<.7?vec3(lum*2.1+.1,lum*.8,lum*.3):vec3(lum*1.5+.05,lum*1.0,lum*.4));',
    'c=mix(c,aut,uAut*leaf*mix(.35,.9,vDec));',
    /* musim bunga: sebagian pohon meranggas mekar merah jambu */
    'float bk=step(.4,fract(vSd*3.7))*vDec;c=mix(c,mix(vec3(.82,.5,.62),vec3(1.,.9,.93),smoothstep(.1,.5,lum)),uSak*leaf*bk*.9);',
    /* salju menempel di tepi atas tajuk (piksel di atasnya kosong) */
    'float up=texture2D(uMap,vUv+vec2(0.,.0045)).a;float up2=texture2D(uMap,vUv+vec2(0.,.012)).a;',
    'c=mix(c,vec3(dot(c,vec3(.3,.59,.11)))*vec3(.85,.92,1.),uSnowK*.45);',
    'float sn=uSnowK*(clamp(1.-up,0.,1.)*.95+clamp(1.-up2,0.,1.)*.45+leaf*(.3+.55*smoothstep(.18,.5,lum)));c=mix(c,vec3(.93,.95,.98),clamp(sn,0.,1.));',
    'c*=uTint;',
    'float side=texture2D(uMap,vUv+vec2(sign(uSunX)*.004,.002)).a;c+=uSunCol*(1.-side)*uBack*.55+uSunCol*uBack*.05;',
    'c*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3;c+=vec3(.55,.6,.75)*uFlash*.2;',
    'c=mix(c,uFog,uFogK);gl_FragColor=vec4(c*t.a,t.a);}'].join('\n');
  /* bobot spesies: lapis jauh = hutan pegunungan, lapis dekat = kebun dan tepi padang yang lebih beragam */
  var W_FAR=[.18,.16,.07,.02,.09,.08,.07,.07,0,.01,.04,0,.1,.05,.05,.01],W_NEAR=[.1,.08,.09,.06,.05,.05,.08,.08,.08,.06,.06,.05,.06,.02,.02,.02];
  var SPH=[1,1,1.05,.85,1.3,1.25,1.25,1.2,.55,1.2,.4,.35,.75,1.15,1.25,.95];
  function buildTrees(L,idx,count,hmin,hmax,xr,roundK,seed,skipC,skipFn){
    var R=rnd(seed),W=idx>=4?W_NEAR:W_FAR,T=[],nc=Math.max(3,Math.round(count/14)),cl=[];
    for(var c=0;c<nc;c++)cl.push((R()*2-1)*xr);
    for(var n=0;n<count;n++){
      var x=R()<.75?cl[Math.floor(R()*nc)]+(R()+R()+R()-1.5)*xr*.16:(R()*2-1)*xr;
      if(skipC&&Math.abs(x)<skipC)x+=(x<0?-1:1)*skipC;
      if(skipFn&&skipFn(x))continue;
      var r=R(),s=0,sp=0;for(var i=0;i<16;i++){s+=W[i];if(r<s){sp=i;break;}}
      var hh=(hmin+Math.pow(R(),1.6)*(hmax-hmin))*SPH[sp],hq=hh/TREE_SP[sp][1];
      T.push({x:x,y:heightJS(L,x)-.15-R()*.25,z:R()*.17,sp:sp,sd:R(),w:hq*.5*(R()<.5?-1:1),h:hq,dec:TREE_SP[sp][2]});
    }
    T.sort(function(a,b){return a.z-b.z;});
    var n2=T.length,P=new Float32Array(n2*18),Cc=new Float32Array(n2*12),I=new Float32Array(n2*24),D=new Float32Array(n2*6),cr=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
    T.forEach(function(f,i){for(var v=0;v<6;v++){var o=i*6+v;P[o*3]=f.x;P[o*3+1]=f.y;P[o*3+2]=f.z;Cc[o*2]=cr[v][0];Cc[o*2+1]=cr[v][1];I[o*4]=f.sp;I[o*4+1]=f.sd;I[o*4+2]=f.w;I[o*4+3]=f.h;D[o]=f.dec;}});
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aC',new THREE.BufferAttribute(Cc,2));g.setAttribute('aI',new THREE.BufferAttribute(I,4));g.setAttribute('aD',new THREE.BufferAttribute(D,1));
    var u=Object.assign({uMap:{value:treeTex},uTint:{value:new THREE.Color(1,1,1)},uFog:{value:new THREE.Color()},uFogK:{value:0},uSunX:{value:-1},uAut:{value:0},uSak:{value:0},uSnowK:{value:0},uZ:{value:L.z}},
      {uTime:shared.uTime,uWind:shared.uWind,uGust:shared.uGust,uCS:shared.uCS,uFlash:shared.uFlash,uSunCol:shared.uSunCol,uBack:shared.uBack});
    var m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:treeV,fragmentShader:treeF,transparent:true,depthWrite:true,premultipliedAlpha:true}));
    /* di punggung bukit, di belakang warga (.31+), danau (.4) dan lumba-lumba (.2) yang berdiri lebih dekat di lereng */
    m.position.z=L.z;m.frustumCulled=false;m.renderOrder=idx;scene.add(m);
    treeMeshes.push({u:u,t:L.t,L:L});
  }
  /* pohon desain awal (tajuk berumpun & cemara bertingkat) dipertahankan, kini dengan batang beragam dan warna per pohon */
  var sdfV='attribute vec2 aUV;attribute vec3 aI;uniform float uTime,uWind,uGust;varying vec2 vUv;varying vec3 vI;varying float vWX;void main(){vUv=aUV;vI=aI;vec3 q=position;float sw=sin(uTime*1.4+position.x*.7+aI.y*9.)+.5*sin(uTime*2.7+aI.y*17.);q.x+=(sw*(.05+.07*uGust)+uWind*.06*uGust)*aUV.y*aUV.y;vWX=q.x;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(q,1.);}';
  var sdfF=[
    'uniform vec3 uDark,uLit,uFog,uTrunk,uSunCol;uniform float uFogK,uSunX,uAut,uSak,uSnowK,uBack,uFlash,uTime,uWind,uZ;varying vec2 vUv;varying vec3 vI;varying float vWX;',CSH,
    'float th(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float tn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(th(i),th(i+vec2(1.,0.)),f.x),mix(th(i+vec2(0.,1.)),th(i+vec2(1.,1.)),f.x),f.y);}',
    'float tf(vec2 p){return tn(p)*.5+tn(p*2.07+3.1)*.3+tn(p*4.3+7.7)*.2;}',
    'void main(){float x=(vUv.x-.5)*2.,y=vUv.y;float sd=vI.y;vec2 q=vec2(vUv.x*vI.z,y)*7.+sd*23.;',
    /* redam derau yang lebih halus dari satu piksel (penyebab tekstur bergaris/berbintik) */
    'vec2 fq=fwidth(q);float fpx=max(fq.x,fq.y);',
    '#define FD(k) (1.-smoothstep(.18,.5,fpx*(k)))',
    'float rag=(tf(q*5.)-.5)*.16*FD(9.)+(tn(q*13.)-.5)*.07*FD(13.);float sdf=1.;vec2 nrm=vec2(0.,1.);float tier=.5;',
    'if(vI.x<.5){tier=fract(y*6.+sd*3.);float hw=(1.-y)*.95*(.5+.5*(1.-tier*.85));sdf=(abs(x)-hw)*.9+rag*(1.-y*.5);sdf=max(sdf,.12-y);nrm=vec2(x/max(hw,.05),.5);}',
    'else{sdf=9.;for(int k=0;k<5;k++){float fk=float(k);vec2 c=vec2((th(vec2(fk,sd))-.5)*.95,.5+(th(vec2(fk+9.,sd))-.35)*.42);float r=.3+th(vec2(fk+4.,sd))*.16;float dd=length(vec2(x,y*1.6-.18)-c)-r;if(dd<sdf){sdf=dd;nrm=(vec2(x,y*1.6-.18)-c)/r;}}sdf+=rag;sdf=max(sdf,.1-y);}',
    'float aa=clamp(fwidth(sdf)*.75,.002,.03);float lay=floor(fract(vI.x)*10.+.5);float a=smoothstep(aa,-aa,sdf);',
    'float rim=smoothstep(.0,-.3,sdf);float hole=smoothstep(.78,.88,tn(q*9.+3.))*(1.-rim)*.75*FD(9.);a*=1.-hole;',
    'float tw=(vI.x<.5?.05:.07+.02*(1.-y))*(.6+1.3*th(vec2(sd*9.1,2.)))*(1.+.5*smoothstep(.12,0.,y));float tr=smoothstep(aa,-aa,abs(x)-tw)*step(y,vI.x<.5?.2:.42);float trunkOnly=tr*(1.-a);',
    'float al=max(a,trunkOnly);if(al<.01)discard;',
    'float s=sign(uSunX+1e-4);vec2 Ld=normalize(vec2(s*.55,.75));float nl=dot(normalize(nrm+1e-4),Ld)*.5+.5;',
    'float cl=mix(.5,tn(q*11.+sd*5.),FD(11.));float clump=tf(q*2.);float l=nl*.62+clump*.35+(cl-.5)*.5*(.4+.6*FD(11.))-.12;',
    'l*=.62+.38*smoothstep(.12,.7,y);if(vI.x<.5)l-=.2*(1.-smoothstep(0.,.5,tier));',
    'l-=smoothstep(.0,-.35,sdf)*.18*(1.-nl);l+=step(.8,cl)*.18*nl;l+=(tn(q*23.+sd*9.)-.5)*.2*FD(23.);l=clamp(l,0.,1.);',
    'vec3 c=mix(uDark,uLit,l);c*=vec3(.88+.24*sd,.94+.12*fract(sd*7.),.82+.26*fract(sd*3.));c+=vec3(.1,.09,0.)*smoothstep(.65,1.,l);',
    'float ak=th(vec2(sd*7.1,3.3));vec3 rd1=c*vec3(1.15,.55,.4)+vec3(.1,0.,0.);vec3 yl=c*vec3(1.2,1.05,.55)+vec3(.06,.05,0.);c=mix(c,rd1,uAut*step(.62,ak));c=mix(c,yl,uAut*step(ak,.28));',
    'if(vI.x<.5)c=mix(c,vec3(.1,.28,.14)*(.5+l),uAut*.85);',
    /* sakura: tajuk bulat jadi merah jambu bergradasi, sebagian hampir putih */
    'if(vI.x>=.5&&uSak>.001){float bk=th(vec2(sd*3.7,1.1));vec3 pd=mix(vec3(.74,.36,.5),vec3(.66,.42,.46),bk);vec3 pl=mix(vec3(1.,.82,.88),vec3(1.,.95,.96),bk*bk);',
    'vec3 bl=mix(pd,pl,smoothstep(.05,.9,l));bl=mix(bl,vec3(1.,.97,.98),step(.78,cl)*.55*nl);c=mix(c,bl,uSak);}',
    'c*=.84+.09*lay;c*=mix(vec3(1.06,1.03,.84),vec3(.84,.97,1.04),fract(sd*13.7));',
    'c=mix(c,vec3(.93,.95,.98),uSnowK*smoothstep(.4,.8,nl+(cl-.5)*.6)*smoothstep(.15,.5,y)*.8);',
    'float bark=.5+.7*tn(vec2(x*20.,y*4.));c=mix(c,uTrunk*bark*(.6+.5*nl),trunkOnly);',
    /* cahaya tembus di tepi tajuk saat matahari rendah (backlight) */
    'c+=uSunCol*smoothstep(-.1,0.,sdf)*uBack*.5*(.4+.6*nl)*(1.-trunkOnly);c+=uSunCol*uBack*.05;',
    'c*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3*(1.-uFogK);',
    'c+=vec3(.55,.6,.75)*uFlash*.2;',
    'c=mix(c,uFog,uFogK);gl_FragColor=vec4(c,al);}'
  ].join('\n');
  function buildTreesS(L,idx,count,hmin,hmax,xr,roundK,seed,skipC,skipFn){
    var R=rnd(seed),quads=[],cl=[],nc=Math.max(3,Math.round(count/14));
    for(var c=0;c<nc;c++)cl.push((R()*2-1)*xr);
    for(var n=0;n<count;n++){
      var x=R()<.75?cl[Math.floor(R()*nc)]+(R()+R()+R()-1.5)*xr*.16:(R()*2-1)*xr;
      if(skipC&&Math.abs(x)<skipC)x+=(x<0?-1:1)*skipC;
      if(skipFn&&skipFn(x))continue;
      var y0=heightJS(L,x)-.18,rd=R()<roundK,hh=hmin+Math.pow(R(),1.6)*(hmax-hmin),w=hh*(rd?.95:.46),sd=R();
      for(var ly=0;ly<(rd?3:1);ly++){var sc=[1,.86,.7][ly],ww=w*sc,h2=hh*sc,z=sd*.12+(ly-1)*.04;
        quads.push({z:z,x:x,y0:y0,ww:ww,h2:h2,i:[(rd?1:0)+ly*.1,sd+ly*.37,ww/h2]});}
    }
    /* urutkan dari belakang ke depan supaya pencampuran alfa benar di dalam satu mesh */
    quads.sort(function(a,b){return a.z-b.z;});
    var P=[],U=[],I=[];
    quads.forEach(function(Qd){var q2=[[Qd.x-Qd.ww/2,Qd.y0,0,0],[Qd.x+Qd.ww/2,Qd.y0,1,0],[Qd.x+Qd.ww/2,Qd.y0+Qd.h2,1,1],[Qd.x-Qd.ww/2,Qd.y0+Qd.h2,0,1]];
      [0,1,2,0,2,3].forEach(function(k){P.push(q2[k][0],q2[k][1],Qd.z);U.push(q2[k][2],q2[k][3]);I.push(Qd.i[0],Qd.i[1],Qd.i[2]);});});
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(P),3));
    g.setAttribute('aUV',new THREE.BufferAttribute(new Float32Array(U),2));g.setAttribute('aI',new THREE.BufferAttribute(new Float32Array(I),3));
    var u=Object.assign({uDark:{value:new THREE.Color()},uLit:{value:new THREE.Color()},uFog:{value:new THREE.Color()},uFogK:{value:0},uSunX:{value:-1},uAut:{value:0},uSak:{value:0},uSnowK:{value:0},uZ:{value:L.z},uTrunk:{value:C(0x3A2C22)}},
      {uTime:shared.uTime,uWind:shared.uWind,uGust:shared.uGust,uCS:shared.uCS,uFlash:shared.uFlash,uSunCol:shared.uSunCol,uBack:shared.uBack});
    var m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:sdfV,fragmentShader:sdfF,transparent:true,depthWrite:true,extensions:{derivatives:true}}));
    m.position.z=L.z+.04;m.frustumCulled=false;m.renderOrder=idx;scene.add(m);
    treeMeshes.push({u:u,t:L.t,L:L,sdf:1});
  }
  /* menara pandang di kiri bukit R4: kosongkan pohon di sekitarnya (posisi awal mengikuti lebar layar saat dimuat) */
  var towerX0=-Math.max(5.5,Math.min(15,36*Math.tan(19*Math.PI/180)*(window.innerWidth/window.innerHeight)*.66));
  var nearTower=function(k){return function(x){return Math.abs(x-towerX0*k)<(k<1?6.4:5.4);};};
  buildTreesS(ridges[2],2,mobile?220:320,1.3,2.6,60,.15,11,0);
  buildTreesS(ridges[3],3,mobile?140:200,1.8,3.6,50,.35,23,0);
  buildTreesS(ridges[4],4,mobile?60:80,2.6,4.8,34,.4,37,6,nearTower(1));
  buildTreesS(ridges[5],5,12,4.0,6.4,19,.45,51,8,nearTower(29/36));
  buildTrees(ridges[2],2,mobile?240:360,1.3,2.7,60,0,13,0);
  buildTrees(ridges[3],3,mobile?150:220,1.9,3.7,50,0,29,0);
  buildTrees(ridges[4],4,mobile?60:90,2.6,5.0,34,0,41,6,nearTower(1));
  buildTrees(ridges[5],5,12,4.0,6.6,19,0,57,8,nearTower(29/36));

  /* ---------- rumput: helai tipis yang bergoyang tertiup angin dan hembusan ---------- */
  var grassV='attribute vec4 aB;attribute float aV;uniform float uTime,uWind,uGust;varying float vV,vK,vWX;void main(){vec3 p=position;float h=aB.x,w=aB.y;float tip=step(1.5,aV);float side=aV<.5?-1.:1.;'+
    'float ph=aB.z*6.283;float sw=sin(uTime*(1.5+aB.z)+p.x*.35+ph)*(.12+.24*uGust)+sin(uTime*3.9+p.x*1.3+ph)*.04+uWind*(.14+.38*uGust);'+
    'p.x+=side*w*.5*(1.-tip);p.x+=tip*(sw*h+aB.w*.35*h);p.y+=tip*h*(1.-.2*sw*sw);vV=tip;vK=aB.z;vWX=p.x;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(p,1.);}';
  var grassF=['uniform vec3 uGrassA,uGrassB,uFog,uSunCol;uniform float uFogK,uSnowK,uAut,uSak,uBack,uFlash,uNight,uTime,uWind,uZ;varying float vV,vK,vWX;',CSH,
    'void main(){vec3 c=mix(uGrassA*.5,uGrassB*1.06,vV*.85+.15)*(.8+.4*vK);',
    'c=mix(c,c*vec3(1.3,1.02,.5)+vec3(.08,.05,0.),uAut*step(.45,fract(vK*7.))*.7);',
    'c=mix(c,c*vec3(1.04,1.1,.92),uSak*.3);',
    'c+=uSunCol*uBack*vV*vV*.45;',
    'c=mix(c,vec3(.93,.95,.97)*(1.-.5*uNight),uSnowK*(.5+.45*vV));',
    'c*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3;c+=vec3(.55,.6,.75)*uFlash*.2;',
    'c=mix(c,uFog,uFogK);gl_FragColor=vec4(c,1.);}'].join('\n');
  function buildGrass(L,count,xr,hk,seed){
    var R=rnd(seed),P=new Float32Array(count*9),B=new Float32Array(count*12),V=new Float32Array(count*3);
    for(var n=0;n<count;n++){
      var x=(R()*2-1)*xr,u=R(),dy=u<.6?R()*.22:.22+Math.pow(R(),1.5)*3.2;
      var y=heightJS(L,x)-dy-.04,z=.02+R()*.28,h=(.16+R()*.34)*hk*(1-.4*Math.min(dy/3,1)),w=h*(.12+R()*.09),k=R(),lean=R()-.5;
      for(var v=0;v<3;v++){var o=n*3+v;P[o*3]=x;P[o*3+1]=y;P[o*3+2]=z;B[o*4]=h;B[o*4+1]=w;B[o*4+2]=k;B[o*4+3]=lean;V[o]=v;}
    }
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aB',new THREE.BufferAttribute(B,4));g.setAttribute('aV',new THREE.BufferAttribute(V,1));
    var u=Object.assign({uGrassA:L.u.uGrassA,uGrassB:L.u.uGrassB,uFog:L.u.uFog,uFogK:L.u.uFogK,uSnowK:L.u.uSnowK,uNight:L.u.uNight,uSak:L.u.uSak,uZ:{value:L.z},uAut:{value:0}},
      {uTime:shared.uTime,uWind:shared.uWind,uGust:shared.uGust,uCS:shared.uCS,uFlash:shared.uFlash,uSunCol:shared.uSunCol,uBack:shared.uBack});
    var m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:grassV,fragmentShader:grassF,side:THREE.DoubleSide}));
    m.position.z=L.z;m.frustumCulled=false;m.renderOrder=6-ridges.indexOf(L);scene.add(m);return u;
  }
  var grassU=[buildGrass(ridges[5],mobile?2400:4200,36,1,71),buildGrass(ridges[4],mobile?1600:2800,46,.8,83)];

  /* ---------- properti padang ---------- */
  var WHITE=new THREE.Color(1,1,1);
  function CV(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);var t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;}
  function blob(g,pts,fill){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fillStyle=fill;g.fill();}
  var TX={
    rock:CV(64,40,function(g){blob(g,[[2,38],[8,18],[22,6],[42,8],[58,22],[62,38]],'#6d6a66');blob(g,[[8,18],[22,6],[42,8],[34,18],[16,26]],'#9b978f');blob(g,[[42,8],[58,22],[62,38],[48,38],[44,20]],'#55524e');}),
    fence:CV(160,40,function(g){g.fillStyle='#8b6a45';for(var i=0;i<7;i++)g.fillRect(6+i*25,4,6,34);g.fillStyle='#a07c52';g.fillRect(0,11,160,5);g.fillRect(0,24,160,5);})
  };
  var props=[];
  function bestX(L,a,b){var bx=a,bh=-99;for(var x=a;x<=b;x+=.25){var h=heightJS(L,x);if(h>bh){bh=h;bx=x;}}return bx;}
  function spr(k,w,h,L,x,dy,zo){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:TX[k],transparent:true,depthWrite:false,fog:false}));
    m.position.set(x,heightJS(L,x)+dy+h/2,L.z+zo);m.renderOrder=ridges.indexOf(L)+.5;scene.add(m);props.push(m);return m;}
  var R4=ridges[4],R5=ridges[5],lakeX=bestX(R4,2,12);
  [[-1.5,1],[7,.8],[12.5,1.1]].forEach(function(r){spr('rock',r[1],r[1]*.62,R5,r[0],-.12,.45);});
  [[13,0],[16.4,0]].forEach(function(f){spr('fence',3.4,.85,R5,f[0],-.15,.8);});

  /* danau: memantulkan langit, riak tertiup angin, kilau matahari, cincin hujan */
  var lakeU=Object.assign({uTop:{value:new THREE.Color()},uMid:{value:new THREE.Color()},uBot:{value:new THREE.Color()},uTint:{value:C(0x2F5E66)},uFog:{value:new THREE.Color()},uFogK:{value:0},uRain:{value:0},uGlint:{value:0},uSunX:{value:.5},uShore:{value:new THREE.Color()}},
    {uTime:shared.uTime,uWind:shared.uWind,uSunCol:shared.uSunCol,uFlash:shared.uFlash});
  var lake=new THREE.Mesh(new THREE.PlaneGeometry(9,1.5),new THREE.ShaderMaterial({uniforms:lakeU,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
      'varying vec2 vUv;uniform vec3 uTop,uMid,uBot,uTint,uFog,uSunCol,uShore;uniform float uFogK,uRain,uGlint,uSunX,uTime,uWind,uFlash;',
      'float lh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float ln(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lh(i),lh(i+vec2(1.,0.)),f.x),mix(lh(i+vec2(0.,1.)),lh(i+vec2(1.,1.)),f.x),f.y);}',
      'void main(){vec2 p=(vUv-vec2(.5,.55))/vec2(.49,.4);float r=length(p);if(r>1.)discard;',
      'float far=clamp(p.y*.5+.5,0.,1.);',
      'float rip=ln(vec2(vUv.x*22.+uTime*.25*uWind,vUv.y*120.+uTime*.7))*.6+ln(vec2(vUv.x*60.-uTime*.4,vUv.y*260.))*.4;',
      'vec3 refl=mix(mix(uTop,uMid,smoothstep(0.,.6,far)),uBot,smoothstep(.55,1.,far+(rip-.5)*.12));',
      'vec3 c=mix(uTint*(.55+.45*refl),refl,.35+.45*far);c*=.92+.16*(rip-.5);',
      'float gl=smoothstep(.7,.95,rip)*exp(-pow((vUv.x-uSunX)*2.6,2.))*(.4+.6*far);c+=uSunCol*gl*uGlint*1.8;',
      'if(uRain>.01){vec2 g=vUv*vec2(26.,7.);vec2 id=floor(g);vec2 f=fract(g)-.5;float t=fract(uTime*.8+lh(id)*7.);float rr=length(f*vec2(1.,2.6));c+=smoothstep(.05,0.,abs(rr-t*.42))*(1.-t)*uRain*.3;}',
      'c+=vec3(.5,.55,.7)*uFlash*.3;',
      'float sh=smoothstep(.86,.99,r);c=mix(c,uShore,sh*.85);',
      'c=mix(c,uFog,uFogK);gl_FragColor=vec4(c,smoothstep(1.,.95,r));}'
    ].join('\n')}));
  lake.position.set(lakeX,heightJS(R4,lakeX)-1.25+.75,R4.z+.4);lake.renderOrder=4.6;scene.add(lake);

  /* ---------- bunga liar: rumpun lukisan per spesies, bergoyang tertiup angin ----------
     Atlas 8 sel (128x256): lupin merah muda, lupin ungu, poppy, aster putih, buttercup, violet, kosmos, calendula.
     Ditanam berumpun seperti hamparan alami; makin ke bawah lereng (makin dekat) makin besar. Layu saat kemarau, tertutup saat salju. */
  var flowerTex=(function(){
    var cv=document.createElement('canvas');cv.width=1024;cv.height=256;var g=cv.getContext('2d');g.lineCap='round';g.lineJoin='round';
    var R=rnd(97);
    function rgb(c,a){return 'rgba('+Math.round(Math.max(0,Math.min(255,c[0])))+','+Math.round(Math.max(0,Math.min(255,c[1])))+','+Math.round(Math.max(0,Math.min(255,c[2])))+','+(a==null?1:a)+')';}
    function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
    function jit(c,k){var j=(R()-.5)*k;return [c[0]+j,c[1]+j*.9,c[2]+j*.8];}
    function stem(x0,y0,x1,y1,bend,w,c){g.strokeStyle=c||'#4F7B36';g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo((x0+x1)/2+bend,(y0+y1)/2,x1,y1);g.stroke();
      g.strokeStyle='rgba(190,220,140,.25)';g.lineWidth=w*.35;g.beginPath();g.moveTo(x0-w*.2,y0);g.quadraticCurveTo((x0+x1)/2+bend-w*.2,(y0+y1)/2,x1-w*.2,y1);g.stroke();}
    function leaf(x,y,l,w,ang,dark){g.save();g.translate(x,y);g.rotate(ang);var gr=g.createLinearGradient(0,-w,0,w);
      gr.addColorStop(0,dark?'#5E8C3E':'#7FAE55');gr.addColorStop(1,dark?'#2F5424':'#456F2E');g.fillStyle=gr;
      g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(l*.45,-w,l,0);g.quadraticCurveTo(l*.45,w,0,0);g.fill();
      g.strokeStyle='rgba(225,240,190,.25)';g.lineWidth=.6;g.beginPath();g.moveTo(1,0);g.lineTo(l*.88,0);g.stroke();g.restore();}
    function ell(x,y,rx,ry,rot,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,rot,0,6.283);g.fill();}
    /* lupin: tandan bunga kupu-kupu bertumpuk, gelap di pangkal dan pucat di pucuk */
    function lupin(lo,hi,h,bend,x){
      for(var k=0;k<2;k++){var by=-14-k*20,bx=x+bend*(-by/h)*.2;for(var i=0;i<7;i++)leaf(bx,by,15-k*3,3,-Math.PI*(.08+.84*i/6),k===0);}
      stem(x,0,x+bend,-h+8,bend*.35,2.4);
      var yb=-h*.42,N=40;
      for(var pass=0;pass<2;pass++)for(var j=0;j<N;j++){var t=j/(N-1),y=yb+(-h-yb)*t,cx=x+bend*(-y/h)*.9,r=10*(1-.6*t)+2;
        for(var s=-1;s<=1;s+=2){var xx=cx+s*r*(.45+.45*R()),c=jit(mix(lo,hi,Math.min(1,t*1.05+R()*.08)),26);
          if(pass===0){ell(xx-s*1.5,y+1.5,5.6*(1-.35*t),4.2,s*.5,rgb(mix(c,[40,20,40],.35)));}
          else{ell(xx,y,5.2*(1-.35*t),3.8,s*.45,rgb(c));ell(xx-s*.8,y-2.2,3.4*(1-.3*t),2.3,s*.3,rgb(mix(c,[255,255,255],.35)));}}}
      for(var b=0;b<5;b++)ell(x+bend*.9+(R()-.5)*3,-h-2-b*3.2,2.4,2,0,rgb(mix(hi,[150,190,110],.4+b*.1)));
    }
    /* poppy: mangkuk empat kelopak tipis berkerut, pusat gelap */
    function poppy(x,h,bend,col){
      stem(x,0,x+bend,-h,bend*.6,1.7,'#5F8C42');
      var hx=x+bend,hy=-h,c=jit(col,20);g.save();g.translate(hx,hy);g.scale(1.75,1.75);g.translate(-hx,-hy);
      ell(hx-7,hy-3,10,8,-.4,rgb(mix(c,[60,10,10],.35)));ell(hx+7,hy-3,10,8,.4,rgb(mix(c,[60,10,10],.3)));
      ell(hx,hy-6,9,7,0,rgb(mix(c,[70,10,10],.25)));
      ell(hx-5,hy+1,10,7.5,-.25,rgb(c));ell(hx+5,hy+1,10,7.5,.25,rgb(mix(c,[255,230,200],.08)));
      g.strokeStyle=rgb(mix(c,[60,0,0],.5),.45);g.lineWidth=.7;for(var i=0;i<7;i++){var a=-.4+i*.33;g.beginPath();g.moveTo(hx,hy);g.lineTo(hx+Math.sin(a)*12,hy+3+Math.cos(a)*4);g.stroke();}
      ell(hx-6,hy-1,4,2.5,-.3,'rgba(255,240,220,.28)');
      ell(hx,hy-3,4.2,2.6,0,'#24161E');for(var d=0;d<8;d++){var a2=d/8*6.283;ell(hx+Math.cos(a2)*4.6,hy-3+Math.sin(a2)*2.6,.8,.8,0,'#1A1014');}
      ell(hx,hy-3.6,2,1.1,0,'rgba(140,150,110,.8)');g.restore();
    }
    function bud(x,h,bend){stem(x,0,x+bend,-h,bend*.8,1.4,'#5F8C42');ell(x+bend+1.5,-h+3,3.2,4.6,.5,'#6E9A4A');ell(x+bend+2.4,-h+1.5,1.2,2,.5,'rgba(220,60,40,.8)');}
    /* aster putih: kelopak pita memancar, dilihat sedikit miring */
    function daisy(x,h,bend,sz){sz*=1.7;
      stem(x,0,x+bend,-h,bend*.5,1.5,'#58853C');leaf(x+bend*.3,-h*.35,12,2.6,-2.4,true);
      g.save();g.translate(x+bend,-h);g.scale(sz,sz*.6);
      for(var i=0;i<18;i++){var a=i/18*6.283+R()*.1,lo=Math.sin(a)>0;g.save();g.rotate(a);
        ell(8.5,0,7.6,2.4,0,rgb(lo?[206,210,214]:[250,250,246]));ell(8,-.6,6,1,0,'rgba(255,255,255,.55)');g.restore();}
      var cg=g.createRadialGradient(-1.2,-1.4,0,0,0,5);cg.addColorStop(0,'#FFE36A');cg.addColorStop(.6,'#F0B428');cg.addColorStop(1,'#B97614');g.fillStyle=cg;g.beginPath();g.arc(0,0,4.6,0,6.283);g.fill();
      g.restore();
    }
    /* buttercup: mangkuk kuning mengilap di ujung tangkai bercabang */
    function cupF(x,y,r){for(var i=0;i<5;i++){var a=-Math.PI/2+(i-2)*.62;ell(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.4+r*.2,r*.62,r*.5,a,rgb(jit([246,200,30],20)));}
      ell(x,y+r*.15,r*.5,r*.32,0,'#C98A10');ell(x-r*.3,y-r*.15,r*.22,r*.14,-.4,'rgba(255,255,230,.8)');}
    function buttercup(x,h){
      for(var i=0;i<5;i++)leaf(x,-6,12,3,-Math.PI*(.15+.7*i/4),true);
      var heads=[[0,1],[-12,.78],[11,.84],[-6,.62],[7,.58],[-15,.5],[15,.45]];
      heads.forEach(function(hd){var hx=x+hd[0],hy=-h*hd[1];stem(x,0,hx,hy,hd[0]*.3,1.1,'#5B8A3D');});
      heads.forEach(function(hd){cupF(x+hd[0],-h*hd[1],7.5+R()*2);});
    }
    /* violet: daun hati gelap, bunga lima kelopak dengan mata kuning dan garis madu */
    function violet(x,h){
      for(var i=0;i<6;i++){var a=-Math.PI*(.1+.8*i/5),l=12+R()*5;g.save();g.translate(x,-2);g.rotate(a);ell(l*.6,0,l*.55,l*.42,0,i%2?'#2F5A2A':'#3E6E34');g.restore();}
      var pts=[[0,1],[-10,.8],[10,.75],[-4,.55],[6,.5]];
      pts.forEach(function(p){var fx=x+p[0],fy=-h*p[1];stem(x,-4,fx,fy+4,p[0]*.2,1,'#4F7A36');
        var c=jit([104,62,176],24),cl=mix(c,[235,220,255],.35);g.save();g.translate(fx,fy);g.scale(1.5,1.5);g.translate(-fx,-fy);
        ell(fx-3.2,fy-4,3.6,4.4,-.3,rgb(mix(c,[30,10,60],.25)));ell(fx+3.2,fy-4,3.6,4.4,.3,rgb(mix(c,[30,10,60],.25)));
        ell(fx-4.4,fy,3.4,3,-.6,rgb(c));ell(fx+4.4,fy,3.4,3,.6,rgb(c));ell(fx,fy+2.6,4,3.4,0,rgb(cl));
        g.strokeStyle='rgba(40,10,70,.7)';g.lineWidth=.5;for(var k=-1;k<=1;k++){g.beginPath();g.moveTo(fx,fy+.6);g.lineTo(fx+k*1.6,fy+4.4);g.stroke();}
        ell(fx,fy+.4,1.3,1.1,0,'#F6D040');g.restore();});
    }
    /* kosmos: delapan kelopak lebar bertakik, daun halus berbulu */
    function cosmos(x,h,bend){
      stem(x,0,x+bend,-h,bend*.5,1.3,'#5E8E40');
      g.strokeStyle='rgba(90,140,60,.85)';g.lineWidth=.7;for(var i=0;i<10;i++){var y=-h*(.15+.06*i),s=i%2?1:-1;g.beginPath();g.moveTo(x+bend*(-y/h)*.5,y);g.quadraticCurveTo(x+s*8,y-4,x+s*13,y-1);g.stroke();}
      var c=jit([238,128,178],26),hx=x+bend,hy=-h;g.save();g.translate(hx,hy);g.scale(1.6,1.2);
      for(var p=0;p<8;p++){var a=p/8*6.283+.2;g.save();g.rotate(a);var pc=Math.sin(a)>0?mix(c,[120,30,70],.18):c;
        g.fillStyle=rgb(pc);g.beginPath();g.moveTo(1.5,-1.8);g.lineTo(11,-3.4);g.lineTo(12,-1.2);g.lineTo(11,.2);g.lineTo(12,1.6);g.lineTo(11,3.4);g.lineTo(1.5,1.8);g.closePath();g.fill();
        g.strokeStyle=rgb(mix(pc,[90,20,50],.4),.5);g.lineWidth=.4;g.beginPath();g.moveTo(2,0);g.lineTo(10,0);g.stroke();g.restore();}
      ell(0,0,3,3,0,'#E9B52C');ell(-.8,-.8,1.2,1.2,0,'#FFE38A');g.restore();
    }
    /* calendula: kepala bunga padat berlapis jingga */
    function calendula(x,h,bend){
      stem(x,0,x+bend,-h,bend*.5,1.8,'#55833A');leaf(x,-h*.3,13,3.6,-2.6,false);leaf(x,-h*.45,12,3.2,-.5,true);
      var hx=x+bend,hy=-h;g.save();g.translate(hx,hy);g.scale(1.6,1.12);
      for(var ring=0;ring<3;ring++){var n=14-ring*3,rr=10-ring*3;for(var i=0;i<n;i++){var a=i/n*6.283+ring*.3;g.save();g.rotate(a);
        ell(rr*.6,0,rr*.55,2.2,0,rgb(jit(mix([232,108,18],[252,178,40],ring/2+(Math.sin(a)<0?.15:0)),22)));g.restore();}}
      ell(0,0,2.6,2.6,0,'#8A3E0A');g.restore();
    }
    var cells=[
      function(){lupin([196,52,118],[252,182,214],196,4,-14);lupin([206,66,132],[250,196,222],160,-5,14);lupin([190,48,110],[246,170,206],120,3,-1);},
      function(){lupin([92,62,170],[196,170,244],186,-4,-12);lupin([104,72,184],[210,190,250],150,5,15);lupin([86,56,160],[184,156,236],110,-2,2);},
      function(){bud(-18,90,-6);poppy(-8,150,-8,[222,44,30]);poppy(16,118,6,[238,96,28]);poppy(-22,70,-4,[214,38,34]);bud(24,64,5);},
      function(){daisy(-14,150,-6,1);daisy(14,118,5,.9);daisy(-2,86,1,.85);daisy(22,64,4,.75);daisy(-24,52,-3,.7);},
      function(){buttercup(-6,140);buttercup(18,96);},
      function(){violet(-10,64);violet(16,52);},
      function(){cosmos(-12,190,-8);cosmos(14,150,7);cosmos(0,110,2);},
      function(){calendula(-12,120,-5);calendula(14,96,5);calendula(0,66,1);}
    ];
    cells.forEach(function(fn,i){g.save();g.translate(i*128+64,252);fn();g.restore();});
    var t=new THREE.CanvasTexture(cv);t.premultiplyAlpha=true;t.anisotropy=4;return t;
  })();
  var flowerTint={value:new THREE.Color(1,1,1)};
  var flowerV=['attribute vec2 aC;attribute vec4 aI;uniform float uTime,uWind,uGust,uAut,uSnowK;varying vec2 vUv;varying float vA,vWX;',
    'void main(){float sp=aI.x;float vis=1.-uSnowK;',
    /* kemarau: lupin, violet, kosmos mengering; calendula, aster, poppy bertahan */
    'if(sp<1.5||abs(sp-5.)<.5||abs(sp-6.)<.5)vis*=1.-.8*uAut;',
    'float h=aI.w*(.2+.8*vis);vec3 p=position;float ph=aI.y*6.283;',
    'float sw=sin(uTime*(1.1+aI.y*.9)+p.x*.3+ph)*(.07+.15*uGust)+sin(uTime*3.3+p.x*1.1+ph)*.018+uWind*(.08+.22*uGust);',
    'p.x+=aC.x*aI.z*.5;p.y+=aC.y*h;p.x+=sw*h*aC.y*aC.y*.9;',
    'vUv=vec2((sp+.05+(aC.x*.5+.5)*.9)/8.,aC.y);vA=vis;vWX=p.x;',
    'gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(p,1.);}'].join('\n');
  var flowerF=['uniform sampler2D uMap;uniform vec3 uTint,uFog,uSunCol;uniform float uFogK,uBack,uFlash,uZ,uTime,uWind;varying vec2 vUv;varying float vA,vWX;',CSH,
    'void main(){vec4 t=texture2D(uMap,vUv);float a=t.a*vA;if(a<.015)discard;',
    'vec3 c=t.rgb*uTint;c+=uSunCol*uBack*.22*t.a*smoothstep(.25,1.,vUv.y);',
    'c*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3;c+=vec3(.55,.6,.75)*uFlash*.2*t.a;',
    'c=mix(c,uFog*t.a,uFogK);gl_FragColor=vec4(c*vA,a);}'].join('\n');
  var FW=[.2,.11,.16,.18,.12,.08,.09,.06];
  function pickSp(R){var r=R(),s=0;for(var i=0;i<8;i++){s+=FW[i];if(r<s)return i;}return 3;}
  function buildFlowers(L,clumps,xr,dyMax,hk,seed,ro,skip){
    var R=rnd(seed),F=[];
    for(var c=0;c<clumps;c++){var cx=(R()*2-1)*xr,cdy=.12+Math.pow(R(),.8)*dyMax,sp=pickSp(R),n=8+Math.floor(R()*26),sx=.4+R()*1.3;
      for(var k=0;k<n;k++){var x=cx+(R()+R()+R()-1.5)*sx,dy=Math.max(.04,cdy+(R()+R()-1)*.35),s2=R()<.18?pickSp(R):sp;
        if(skip&&skip(x,dy))continue;
        var h=hk*(.55+R()*.55)*(.75+.45*Math.min(1,dy/dyMax))*(s2===5?.55:(s2===4||s2===7?.8:1));
        F.push({x:x,y:heightJS(L,x)-dy-.03,z:.04+R()*.26,dy:dy,sp:s2,sd:R(),w:h*.45*(R()<.5?-1:1),h:h});}}
    F.sort(function(a,b){return a.dy-b.dy;});
    var n=F.length,P=new Float32Array(n*18),Cc=new Float32Array(n*12),I=new Float32Array(n*24),cr=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
    F.forEach(function(f,i){for(var v=0;v<6;v++){var o=i*6+v;P[o*3]=f.x;P[o*3+1]=f.y;P[o*3+2]=f.z;Cc[o*2]=cr[v][0];Cc[o*2+1]=cr[v][1];I[o*4]=f.sp;I[o*4+1]=f.sd;I[o*4+2]=f.w;I[o*4+3]=f.h;}});
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aC',new THREE.BufferAttribute(Cc,2));g.setAttribute('aI',new THREE.BufferAttribute(I,4));
    var u=Object.assign({uMap:{value:flowerTex},uTint:flowerTint,uFog:L.u.uFog,uFogK:L.u.uFogK,uSnowK:L.u.uSnowK,uZ:{value:L.z},uAut:{value:0}},
      {uTime:shared.uTime,uWind:shared.uWind,uGust:shared.uGust,uCS:shared.uCS,uFlash:shared.uFlash,uSunCol:shared.uSunCol,uBack:shared.uBack});
    var m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:flowerV,fragmentShader:flowerF,transparent:true,depthWrite:false,premultipliedAlpha:true}));
    m.position.z=L.z;m.frustumCulled=false;m.renderOrder=ro;scene.add(m);return u;
  }
  var flowerU=[buildFlowers(ridges[5],mobile?90:160,34,2.9,.85,131,5.55),buildFlowers(ridges[4],mobile?60:110,44,2.2,.5,149,4.55,function(x,dy){return Math.abs(x-lakeX)<5.2&&dy<1.6;})];

  /* lumba-lumba hidung botol: melompat berpasangan dari danau. Dilukis sekali ke kanvas 512x256 (menghadap kanan) dengan pola warna
     aslinya (punggung gelap, sisi abu, perut pucat) dan kilap basah. Badan melengkung sepanjang lompatan dan ekor mengayun saat keluar air;
     bagian di bawah permukaan dipotong, ada pantulan bergelombang di air, riak melingkar, dan cipratan saat keluar & masuk. */
  var dolTex=(function(){var c=document.createElement('canvas');c.width=512;c.height=256;var g=c.getContext('2d');g.scale(2,2);
    function body(){g.beginPath();g.moveTo(247,71);g.bezierCurveTo(242,66,234,64,226,63);g.bezierCurveTo(222,56,212,50,196,47);g.bezierCurveTo(170,42,140,41,118,44);
      g.bezierCurveTo(90,48,62,56,40,63);g.bezierCurveTo(32,65,26,66,21,66);g.bezierCurveTo(16,60,10,52,2,48);g.bezierCurveTo(6,56,9,63,13,68);
      g.bezierCurveTo(9,74,5,82,1,89);g.bezierCurveTo(10,84,17,76,22,71);g.bezierCurveTo(40,76,70,84,110,88);g.bezierCurveTo(150,92,195,88,220,80);g.bezierCurveTo(232,77,240,75,247,71);g.closePath();}
    function soft(fn,col,n,dy){for(var i=0;i<n;i++){g.save();g.translate(0,i*dy);g.fillStyle=col;fn();g.fill();g.restore();}}
    /* sirip punggung (di belakang badan) */
    var gf=g.createLinearGradient(110,10,150,46);gf.addColorStop(0,'#2A3843');gf.addColorStop(1,'#465C6C');g.fillStyle=gf;
    g.beginPath();g.moveTo(153,44);g.bezierCurveTo(147,31,135,18,111,11);g.bezierCurveTo(119,22,121,34,113,46);g.closePath();g.fill();
    g.strokeStyle='rgba(215,232,242,.35)';g.lineWidth=1.1;g.beginPath();g.moveTo(151,42);g.bezierCurveTo(145,31,134,19,114,12.5);g.stroke();
    var gb=g.createLinearGradient(0,42,0,92);gb.addColorStop(0,'#394D5C');gb.addColorStop(.33,'#677D8D');gb.addColorStop(.6,'#A6B3BC');gb.addColorStop(.8,'#DCE1E2');gb.addColorStop(1,'#EEF0EE');
    g.fillStyle=gb;body();g.fill();
    g.save();body();g.clip();
    /* jubah gelap di punggung, tepinya dilunakkan berlapis */
    soft(function(){g.beginPath();g.moveTo(236,58);g.bezierCurveTo(214,52,186,60,160,60);g.bezierCurveTo(120,60,70,62,10,70);g.lineTo(10,30);g.lineTo(240,30);g.closePath();},'rgba(32,45,56,.13)',5,-1.6);
    /* sapuan terang di sisi (blaze) dari belakang mata ke arah sirip */
    soft(function(){g.beginPath();g.ellipse(168,70,40,7,-.12,0,6.283);},'rgba(205,216,224,.09)',4,.8);
    /* garis mata ke sirip dada, sudut mulut, mata */
    g.strokeStyle='rgba(40,54,64,.28)';g.lineWidth=3;g.beginPath();g.moveTo(222,68);g.quadraticCurveTo(206,76,192,83);g.stroke();
    g.strokeStyle='rgba(28,36,44,.6)';g.lineWidth=1.3;g.beginPath();g.moveTo(247,72);g.quadraticCurveTo(234,74.5,224,73);g.quadraticCurveTo(221,72,220,70.5);g.stroke();
    g.fillStyle='#141C22';g.beginPath();g.ellipse(224,66.5,2.6,2.1,0,0,6.283);g.fill();g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(224.8,65.8,.7,0,6.283);g.fill();
    /* kilap basah: melon kepala, garis punggung, pangkal ekor */
    var mh=g.createRadialGradient(213,54,0,213,54,12);mh.addColorStop(0,'rgba(255,255,255,.55)');mh.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=mh;g.fillRect(195,40,40,30);
    g.strokeStyle='rgba(240,248,255,.16)';g.lineWidth=6;g.beginPath();g.moveTo(224,57);g.bezierCurveTo(206,48,170,45,140,46.5);g.stroke();
    g.strokeStyle='rgba(250,253,255,.55)';g.lineWidth=1.6;g.beginPath();g.moveTo(220,55);g.bezierCurveTo(204,48.5,172,46,146,47);g.stroke();
    g.strokeStyle='rgba(250,253,255,.3)';g.lineWidth=1.2;g.beginPath();g.moveTo(100,49);g.bezierCurveTo(80,53,58,59,40,64);g.stroke();
    for(var i=0;i<14;i++){var x=60+((i*53)%150),y=52+((i*29)%14);g.fillStyle='rgba(255,255,255,'+(.25+(i%3)*.15)+')';g.beginPath();g.arc(x,y,.6+(i%2)*.5,0,6.283);g.fill();}
    /* tepi badan sedikit gelap agar siluet terbaca di atas air terang */
    g.strokeStyle='rgba(20,30,38,.35)';g.lineWidth=2;body();g.stroke();
    g.restore();
    /* sirip dada */
    var gp=g.createLinearGradient(160,84,190,108);gp.addColorStop(0,'#4D6374');gp.addColorStop(1,'#2E3E4A');g.fillStyle=gp;
    g.beginPath();g.moveTo(193,84);g.bezierCurveTo(187,96,177,104,162,109);g.bezierCurveTo(169,99,172,91,178,85);g.closePath();g.fill();
    var t=new THREE.CanvasTexture(c);t.premultiplyAlpha=true;t.anisotropy=4;return t;})();
  var dolY=lake.position.y+.07,dolZ=lake.position.z+.2,DOL_P=5.2,DOL_D=1.35,DOL_N=2,DROPS=26;
  var dolU={uMap:{value:dolTex},uTint:{value:new THREE.Color()},uWater:{value:new THREE.Color()},uFog:lakeU.uFog,uFogK:lakeU.uFogK,uA:{value:0},uClipY:{value:dolY},
    uSunCol:shared.uSunCol,uBack:shared.uBack,uTime:shared.uTime};
  var dolV='uniform float uBend,uBeat;varying vec2 vUv;varying float vWY;void main(){vUv=uv;vec3 p=position;float u=p.x/.75;'+
    'p.y-=uBend*u*u*.2;float tl=smoothstep(-.15,-1.,u);p.y+=uBeat*tl*tl*.14;vec4 w=modelMatrix*vec4(p,1.);vWY=w.y;gl_Position=projectionMatrix*viewMatrix*w;}';
  var dolF=['uniform sampler2D uMap;uniform vec3 uTint,uFog,uSunCol,uWater;uniform float uFogK,uA,uClipY,uBack,uRefl,uTime;varying vec2 vUv;varying float vWY;',
    'void main(){float dw=uClipY-vWY;vec2 uv=vUv;',
    'if(uRefl<.5){if(dw>0.)discard;}else{if(dw<0.||dw>.6)discard;uv.x+=sin(vWY*55.+uTime*5.)*.012;}',
    'vec4 t=texture2D(uMap,uv);if(t.a<.01)discard;',
    'vec3 c=t.rgb*uTint;float lum=dot(t.rgb,vec3(.3,.59,.11))/max(t.a,.001);',
    'c+=uSunCol*t.a*(smoothstep(.8,.98,lum)*.4+uBack*.2*smoothstep(.55,.95,vUv.y));',
    /* bagian yang baru keluar dari air masih berselaput air terang */
    'c=mix(c,uWater*t.a*1.35,smoothstep(.16,0.,-dw)*.4*(1.-uRefl));',
    'float k=uA;if(uRefl>.5){c=mix(c,uWater*t.a,.5)*.8;k*=.34*exp(-dw*3.5);}',
    'c=mix(c,uFog*t.a,uFogK);gl_FragColor=vec4(c*k,t.a*k);}'].join('\n');
  var dols=[],dolGeo=new THREE.PlaneGeometry(1.5,.75,20,1);
  function dolMesh(refl,ro){var u=Object.assign({uBend:{value:0},uBeat:{value:0},uRefl:{value:refl}},dolU);
    var m=new THREE.Mesh(dolGeo,new THREE.ShaderMaterial({uniforms:u,vertexShader:dolV,fragmentShader:dolF,transparent:true,depthWrite:false,premultipliedAlpha:true}));
    m.frustumCulled=false;m.renderOrder=ro;m.visible=false;scene.add(m);return m;}
  /* riak: dua cincin elips yang melebar dan buih di tengah, satu per kejadian keluar/masuk */
  var ripU={uTint:dolU.uTint,uWater:dolU.uWater,uFog:lakeU.uFog,uFogK:lakeU.uFogK,uA:dolU.uA};
  function ripMesh(){var u=Object.assign({uAge:{value:9},uBig:{value:1}},ripU);
    var m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.62),new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 uTint,uWater,uFog;uniform float uFogK,uA,uAge,uBig;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*vec2(2.6,.62*4.2);float e=length(p);float L=1.7;if(uAge>L)discard;float f=1.-uAge/L;'+
        'float r1=.12+uAge*.95*uBig,r2=.05+uAge*.6*uBig;float ring=exp(-pow((e-r1)/.045,2.))*.8+exp(-pow((e-r2)/.035,2.))*.55;float foam=exp(-e*e/(.03+.05*uBig))*smoothstep(.7,0.,uAge);'+
        'float a=(ring*f*f+foam)*uA*smoothstep(1.3,.9,e);if(a<.004)discard;vec3 c=mix(uWater*1.25+.08,vec3(.95,.98,1.),foam)*(uTint*.6+.45);c=mix(c,uFog,uFogK);gl_FragColor=vec4(c,a*.75);}'}));
    m.frustumCulled=false;m.renderOrder=4.61;m.visible=false;scene.add(m);return m;}
  for(var di=0;di<DOL_N;di++)dols.push({m:dolMesh(0,4.65),r:dolMesh(1,4.62),rp:[ripMesh(),ripMesh()]});
  var dropPos=new Float32Array(DOL_N*2*DROPS*3),dropR=new Float32Array(DOL_N*2*DROPS*4);
  for(var dq=0;dq<DOL_N*2*DROPS;dq++){dropR[dq*4]=Math.random()*2-1;dropR[dq*4+1]=Math.random();dropR[dq*4+2]=Math.random();dropR[dq*4+3]=0;}
  var dropG=new THREE.BufferGeometry();dropG.setAttribute('position',new THREE.BufferAttribute(dropPos,3));dropG.setAttribute('aR',new THREE.BufferAttribute(dropR,4));
  var drops=new THREE.Points(dropG,new THREE.ShaderMaterial({uniforms:{uPR:shared.uPR,uA:dolU.uA,uTint:dolU.uTint,uFog:lakeU.uFog,uFogK:lakeU.uFogK},transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uPR;varying float vA;void main(){vec4 mv=viewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.1+aR.z*2.2)*uPR*(78./-mv.z)*(.6+.6*aR.w);vA=aR.w;}',
    fragmentShader:'uniform vec3 uFog,uTint;uniform float uFogK,uA;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float d=length(q)*2.;if(d>1.||vA<.01)discard;'+
      'vec3 c=vec3(.92,.96,1.)*(uTint*.5+.55);c+=.25*smoothstep(.5,0.,length(q+vec2(.15,.15))*2.);gl_FragColor=vec4(mix(c,uFog,uFogK*.8),smoothstep(1.,.35,d)*vA*uA*.9);}'}));
  drops.frustumCulled=false;drops.renderOrder=4.7;drops.visible=false;scene.add(drops);
  function dolHash(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
  function dolFrame(t){
    var on=dolU.uA.value>.01;drops.visible=on;
    for(var i=0;i<DOL_N;i++){
      var D=dols[i],m=D.m,lt=t+i*.38,cyc=Math.floor(lt/DOL_P),tt=lt-cyc*DOL_P,f=tt/DOL_D,sd=cyc*7.3+1.7;
      var dir=dolHash(sd)<.5?-1:1,span=2.8+dolHash(sd+2)*.8,hgt=.6+dolHash(sd+3)*.35,x0=lake.position.x+(dolHash(sd+1)-.5)*2.4+i*.6*dir;
      m.visible=D.r.visible=on&&f<1;
      if(m.visible){var y=dolY-.45+(hgt+.45)*4*f*(1-f),vy=(hgt+.45)*4*(1-2*f),x=x0+dir*(f-.5)*span,rot=dir*Math.atan2(vy,span);
        var bend=.35+.65*Math.sin(Math.PI*f),beat=Math.sin(t*15+i)*Math.max(0,1-f/.2);
        m.position.set(x,y,dolZ+i*.02);m.scale.set(dir,1,1);m.rotation.z=rot;
        D.r.position.set(x,2*dolY-y,dolZ+i*.02-.01);D.r.scale.set(dir,-1,1);D.r.rotation.z=-rot;
        m.material.uniforms.uBend.value=D.r.material.uniforms.uBend.value=bend;m.material.uniforms.uBeat.value=D.r.material.uniforms.uBeat.value=beat;}
      for(var ev=0;ev<2;ev++){var age=tt-ev*DOL_D,ex=x0+dir*(ev-.5)*span*.92,rp=D.rp[ev];
        rp.visible=on&&age>=0&&age<1.7;if(rp.visible){rp.position.set(ex,dolY-.04,dolZ-.03);rp.material.uniforms.uAge.value=age;rp.material.uniforms.uBig.value=ev?1.15:.8;}
        /* keluar: selaput air terangkat searah lompatan; masuk: mahkota cipratan lebih tinggi dan melebar */
        for(var k=0;k<DROPS;k++){var q=(i*2+ev)*DROPS+k,a=dropR[q*4],b=dropR[q*4+1];
          var vx=ev?a*1.0+dir*.25:a*.35+dir*(.35+.55*b),vy0=ev?1.3+b*2.1:1.0+b*1.6,life=.6+.4*b;
          if(age>=0&&age<life){var px=ex+vx*age,py=dolY+vy0*age-4.9*age*age;dropPos[q*3]=px;dropPos[q*3+1]=py;dropPos[q*3+2]=dolZ+.03;dropR[q*4+3]=(1-age/life)*(py>dolY-.04?1:0);}
          else dropR[q*4+3]=0;}}
    }
    dropG.attributes.position.needsUpdate=true;dropG.attributes.aR.needsUpdate=true;
  }

  /* ---------- warga di padang (js/folk.js): satu adegan per musim, hanya keluar saat cuaca dan udara aman ---------- */
  var FG=window.FOLK?window.FOLK.build():{},folk=[],folkG={},folkTint=new THREE.Color(),folkFogK={value:0},folkRim={value:0},folkGY=heightJS(R5,0),FS=mobile?1.25:1.5;
  var folkU={uTint:{value:folkTint},uFog:{value:new THREE.Color()},uFogK:folkFogK,uRim:folkRim,uZ:{value:R5.z},uSunCol:shared.uSunCol,uFlash:shared.uFlash,uCS:shared.uCS,uTime:shared.uTime,uWind:shared.uWind};
  var folkV='varying vec2 vUv;varying float vWX;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWX=w.x;gl_Position=projectionMatrix*viewMatrix*w;}';
  /* tekstur premultiplied; tepi yang menghadap matahari diberi cahaya tembus (rim) */
  var folkF=['uniform sampler2D tA,tB;uniform float uCut,uMix,uA,uFogK,uRim,uFlash,uZ,uTime,uWind;uniform vec3 uTint,uFog,uSunCol;uniform vec2 uRimD;varying vec2 vUv;varying float vWX;',CSH,
    'void main(){vec4 c=mix(texture2D(tA,vUv),texture2D(tB,vUv),uMix);if(c.a<uCut)discard;',
    'float an=mix(texture2D(tA,vUv+uRimD).a,texture2D(tB,vUv+uRimD).a,uMix);',
    'vec3 col=c.rgb*uTint+uSunCol*c.a*(1.-an)*uRim;',
    'col*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3;col+=vec3(.55,.6,.75)*uFlash*.2*c.a;col=mix(col,uFog*c.a,uFogK);',
    'gl_FragColor=vec4(col,c.a)*uA;}'].join('\n');
  function folkTex(c){if(c._t)return c._t;var t=new THREE.CanvasTexture(c);t.premultiplyAlpha=true;t.anisotropy=4;
    if(!GL2){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;}c._t=t;return t;}
  var folkW={ground:function(x){return heightJS(R5,x);},get:function(id){return folkG[id];},
    pt:function(id,lx,ly){var e=folkG[id];return [e.wx+lx*e.s*FS*(e.flip||1),e.wy+ly*e.s*FS];}};
  Object.keys(FG).forEach(function(key){
    FG[key].forEach(function(e){
      e.key=key;if(e.id)folkG[e.id]=e;
      if(e.line){
        e.pos=new Float32Array(24*3);var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(e.pos,3));
        e.mat=new THREE.LineBasicMaterial({color:new THREE.Color(e.col[0]/255,e.col[1]/255,e.col[2]/255),transparent:true,opacity:0,depthWrite:false});
        e.mesh=new THREE.Line(lg,e.mat);e.mesh.frustumCulled=false;e.mesh.renderOrder=e.L!=null?5.47:5.9;e.mesh.visible=false;scene.add(e.mesh);folk.push(e);return;
      }
      var fr=Array.isArray(e.c)?e.c:[e.c],c0=fr[0];
      var geo=new THREE.PlaneGeometry(c0.w,c0.h);geo.translate(c0.w/2-c0.ax,c0.h/2-c0.ay,0);
      var u=Object.assign({tA:{value:folkTex(c0)},tB:{value:folkTex(c0)},uMix:{value:0},uA:{value:0},uCut:{value:e.solid?.4:.004},uRimD:{value:new THREE.Vector2()}},folkU);
      /* sprite di lapis bukit lain (menara di R4) memakai kabut dan bayangan awan lapis itu */
      if(e.L!=null){u.uFogK={value:0};u.uZ={value:ridges[e.L].z};}
      /* cahaya lampu memancar sendiri, tidak ikut diredupkan pencahayaan malam */
      if(e.glow)u.uTint={value:new THREE.Color(1.5,1.32,1.15)};
      /* bangunan (solid) menulis kedalaman agar api dan asap di bukit belakang tertutup olehnya */
      var m=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:folkV,fragmentShader:folkF,transparent:true,depthWrite:!!e.solid,premultipliedAlpha:true,
        blending:e.add?THREE.AdditiveBlending:THREE.NormalBlending,side:THREE.DoubleSide}));
      m.frustumCulled=false;m.renderOrder=e.ro!=null?e.ro:5.6+e.z*.1;m.visible=false;scene.add(m);
      e.mesh=m;e.u=u;e.rk=[2.5/c0.width,1.5/c0.height];folk.push(e);
    });
  });
  var folkVis={sunrise:0,autumn:0,snow:0,sakura:0,rain:0,tower:1,snowT:0,night:0},towerX=-16;
  function folkFrame(t){
    for(var i=0;i<folk.length;i++){var e=folk[i],v=folkVis[e.key];
      if(v<.004){e.mesh.visible=false;continue;}
      if(e.upd)e.upd(t,e,folkW);
      var a=v*(e.a==null?1:e.a)*(e.vis==null?1:e.vis);
      if(e.line){
        var p=e.pos,a0=e.a0,a1=e.a1,mx=(a0[0]+a1[0])/2,my=(a0[1]+a1[1])/2-(e.sag||0);
        for(var k=0;k<24;k++){var s=k/23,s1=1-s;p[k*3]=s1*s1*a0[0]+2*s1*s*mx+s*s*a1[0];p[k*3+1]=s1*s1*a0[1]+2*s1*s*my+s*s*a1[1];p[k*3+2]=e.L!=null?ridges[e.L].z+.62:R5.z+.36;}
        e.mesh.geometry.attributes.position.needsUpdate=true;e.mat.opacity=a;e.mesh.visible=a>.004;continue;
      }
      var fr=Array.isArray(e.c)?e.c:[e.c],n=fr.length,f=e.f||0,ia=(Math.floor(f)%n+n)%n,ib=e.fade?(ia+1)%n:ia;
      e.u.tA.value=folkTex(fr[ia]);e.u.tB.value=folkTex(fr[ib]);e.u.uMix.value=e.fade?f-Math.floor(f):0;e.u.uA.value=a;
      var fl=e.flip||1,ss=e.s*FS,wx=e.tw?towerX+e.x*ss:e.x*FS,LR=e.L!=null?ridges[e.L]:R5,gy=e.tw?heightJS(LR,towerX):(e.follow?heightJS(R5,wx):folkGY);
      if(e.L!=null)e.u.uFogK.value=LR.u.uFogK.value+.04+cur.over*.1;
      e.wx=wx+(e.ox||0)*ss;e.wy=gy-e.dy+(e.oy||0)*ss;
      e.mesh.position.set(e.wx,e.wy,LR.z+(e.L!=null?e.z:.31+Math.min(e.z,.3)*.2));e.mesh.rotation.z=e.rot||0;
      e.mesh.scale.set(ss*fl,ss*(1+(e.breath||0)*Math.sin(t*1.7+e.x*3)),1);
      e.u.uRimD.value.set((Lv.x<0?-1:1)*fl*e.rk[0],e.rk[1]);
      e.mesh.visible=a>.004;
    }
  }

  var tintC=new THREE.Color(),AUT_D=new THREE.Color('#6A2E12'),AUT_L=new THREE.Color('#D08A32'),SAK_D=new THREE.Color('#3E6A33'),SAK_L=new THREE.Color('#7FB55A');

  /* ---------- gunung api 3D ---------- */
  var VR=26,VH=29,VGY=-10,VZ=-60,VSZ=.55,coneX=14;
  var GULLY=[[7,.3,1],[11,2.1,.7],[19,4.0,.45],[31,1.2,.28],[53,5.1,.15]];
  function volH(r,th){
    var asym=1+.09*Math.sin(th*2+1)+.05*Math.sin(th*3+2.2);
    var Rt=VR*asym,q=Math.max(1-r/Rt,0),h=VH*Math.pow(q,1.55);
    h=Math.min(h,VH*.955);
    if(q>0){
      var g=0,ws=0;
      for(var i=0;i<GULLY.length;i++){var G=GULLY[i];g+=G[2]*(1-Math.abs(Math.sin(th*G[0]+G[1]+r*.05*(i+1))));ws+=G[2];}
      g/=ws;
      var env=Math.sin(Math.PI*Math.min(1,r/(Rt*.85)))*(.4+.6*Math.min(1,r/9));
      h+=(g-.5)*3.4*env*Math.min(1,h/6)+Math.sin(r*.9+th*5)*.18*env;
    }
    var rc=2.5;
    h+=.9*Math.exp(-Math.pow((r-rc)/.8,2));
    h-=3.1*Math.exp(-Math.pow(r/(rc*.8),2));
    return h;
  }
  var NR=110,NA=180,vPos=new Float32Array((NR+1)*(NA+1)*3),vPol=new Float32Array((NR+1)*(NA+1)*2),vIdx=[];
  (function(){
    var k=0,kp=0;
    for(var i=0;i<=NR;i++){var u=i/NR,r=VR*1.12*Math.pow(u,1.5);
      for(var j=0;j<=NA;j++){var th=-Math.PI/2+j/NA*Math.PI*2;
        vPos[k++]=r*Math.cos(th);vPos[k++]=volH(r,th);vPos[k++]=r*Math.sin(th)*VSZ;
        vPol[kp++]=r;vPol[kp++]=th;}}
    for(var a=0;a<NR;a++)for(var b=0;b<NA;b++){var p0=a*(NA+1)+b,p1=p0+1,p2=p0+NA+1,p3=p2+1;vIdx.push(p0,p1,p2,p1,p3,p2);}
  })();
  var volG=new THREE.BufferGeometry();
  volG.setAttribute('position',new THREE.BufferAttribute(vPos,3));
  volG.setAttribute('aPolar',new THREE.BufferAttribute(vPol,2));
  volG.setIndex(vIdx);volG.computeVertexNormals();
  var chans=[[1.30,17,.75,.4],[1.62,22,.95,1.9],[1.95,12,.7,3.1],[1.08,9,.55,4.4],[2.25,15,.8,5.3],[1.45,10,.5,2.4],[1.80,19,.6,6.0],[2.10,8,.45,1.1]];
  var volU=Object.assign({},shared,{
    uLightDir:{value:new THREE.Vector3(.5,.5,.5)},uLightCol:{value:new THREE.Color()},uAmb:{value:new THREE.Color()},
    uForestD:{value:C(0x1B4720)},uForestL:{value:C(0x4E8236)},uScrub:{value:C(0x7A8040)},uRock:{value:C(0x54483F)},uRockHi:{value:C(0x2F2A28)},uSnowCol:{value:C(0xFFF0C5)},uFog:{value:new THREE.Color()},uHazeCol:{value:new THREE.Color()},
    uLavaHot:{value:P.gold.clone().lerp(P.cream,.55)},uLavaMid:{value:P.orange.clone()},uMudCol:{value:C(0x4A3430)},
    uLava:{value:.5},uExt:{value:.35},uMud:{value:0},uSnowLine:{value:22},uFogK:{value:.1},uWet:{value:0},uHaze:{value:0},uSak:{value:0},uAshD:{value:0},
    uCh:{value:chans.map(function(c){return new THREE.Vector4(c[0],c[1],c[2],c[3]);})}
  });
  var FOREST_D0=volU.uForestD.value.clone(),FOREST_L0=volU.uForestL.value.clone();
  var volMat=new THREE.ShaderMaterial({uniforms:volU,
    vertexShader:'attribute vec2 aPolar;varying vec3 vN,vP;varying vec2 vPolar;varying float vHn;void main(){vN=normal;vec4 wp=modelMatrix*vec4(position,1.);vP=position;vPolar=aPolar;vHn=position.y;gl_Position=projectionMatrix*viewMatrix*wp;}',
    fragmentShader:[
      'uniform vec3 uLightDir,uLightCol,uAmb,uForestD,uForestL,uScrub,uRockHi,uRock,uSnowCol,uFog,uHazeCol,uLavaHot,uLavaMid,uMudCol,uSunCol;',
      'uniform float uTime,uWind,uLava,uExt,uMud,uSnowLine,uFogK,uWet,uHaze,uSak,uAshD,uFlash,uBack;uniform vec4 uCh[8];',
      'varying vec3 vN,vP;varying vec2 vPolar;varying float vHn;',CSH,
      'float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
      'float vn3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
      'return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}',
      'void main(){',
      'vec3 N=normalize(vN);float nA=vn3(vP*.9),nB=vn3(vP*3.1+7.),nC=vn3(vP*9.+3.);',
      'N=normalize(N+(vec3(nB,nC,nA)-.5)*.2);',
      'float diff=max(dot(N,normalize(uLightDir)),0.);float h=vHn;',
      'float hh2=h+nA*5.+(nB-.5)*2.;float stp=smoothstep(.3,.65,normalize(vN).y);',
      'float forest=(1.-smoothstep(11.,18.,hh2))*mix(.25,1.,stp);float scrub=smoothstep(8.,12.,hh2)*(1.-smoothstep(15.,21.,hh2));',
      'float can=clamp((vn3(vP*2.7+1.7)*.55+vn3(vP*7.3)*.3+vn3(vP*19.)*.2)*1.25,0.,1.);',
      'vec3 fol=mix(uForestD,uForestL,can);fol=mix(fol,uScrub*(.8+.4*nB),scrub*.85);',
      'fol=mix(fol,mix(vec3(.86,.55,.66),vec3(.99,.84,.9),nC),uSak*smoothstep(.55,.72,can)*.85);',
      'vec3 rock=uRock*(.8+.4*nB);rock=mix(rock,uRockHi,smoothstep(16.,27.,h+nA*3.));',
      'float gul=.5+.5*sin(vPolar.y*34.+nA*2.+vPolar.x*.15);rock*=1.-.3*gul;',
      'vec3 alb=mix(rock,fol,forest);alb*=.92+.16*nC;',
      /* endapan abu abu-abu di lereng atas saat erupsi */
      'alb=mix(alb,vec3(.42,.4,.39)*(.8+.35*nB),uAshD*smoothstep(7.,17.,h+nA*4.)*.55);',
      'float sn=smoothstep(uSnowLine-1.4,uSnowLine+1.4,h+(nA-.5)*7.)*smoothstep(.15,.65,N.y);',
      'alb=mix(alb,uSnowCol*(.85+.15*nC),clamp(sn,0.,1.)*.96);',
      'alb*=1.-.28*uWet*(1.-sn);',
      /* rongga lembah lebih gelap (oklusi ambien kasar) */
      'float ao=.78+.22*smoothstep(.2,.8,gul+N.y*.4);',
      'vec3 col=alb*(uAmb*(.72+.28*N.y)*ao+uLightCol*diff*(1.-cloudShadow(vP.xz+vec2(0.,40.))*.85));',
      'col+=uSunCol*uBack*.12*pow(1.-max(N.z,0.),3.)*(1.-uFogK);',
      /* lahar dan lava */
      'float core=0.,halo=0.,rad=0.;',
      'for(int i=0;i<8;i++){vec4 c=uCh[i];float d=vPolar.y-(c.x+.1*sin(vPolar.x*.45+c.w));float dist=abs(d)*vPolar.x;float w=c.z*.5*(1.+vPolar.x*.025)*(1.+uMud*1.8);',
      'float along=smoothstep(2.,3.4,vPolar.x)*(1.-smoothstep(c.y*.85,c.y,vPolar.x));',
      'float edge=w*(1.+.5*(vn3(vec3(vP.xy*1.7,float(i)*3.))-.5));',
      'float cc=exp(-(dist*dist)/(edge*edge))*along;float hh=exp(-(dist*dist)/(w*w*10.))*along*.6;',
      'if(cc>core){core=cc;rad=vPolar.x/c.y;}halo=max(halo,hh);}',
      'float lake=1.-smoothstep(1.7,2.2,vPolar.x);core=smoothstep(.3,.7,core);core=max(core,lake);halo=max(halo,lake);rad*=1.-lake;',
      'float ext=1.-smoothstep(uExt+uMud*.3-.12,uExt+uMud*.3,rad);',
      'float flowN=vn3(vec3(vP.x*.8,vP.y*.8-uTime*.9,vP.z*.8));',
      'float pulse=.55+.45*sin(rad*18.-uTime*1.6+flowN*6.);',
      'float temp=clamp(1.-rad*.9,0.,1.)*(.5+.5*pulse);',
      'float boil=lake*(.6+.4*sin(uTime*3.+nB*12.));',
      'float crust=smoothstep(.3,.8,vn3(vP*vec3(2.2,1.4,2.2)+vec3(0.,-uTime*.2,0.)));',
      'float lm=core*ext*uLava;',
      'vec3 lcol=mix(uLavaMid,uLavaHot,temp);lcol*=mix(.4,1.9,temp*(1.-.55*crust));lcol=mix(lcol,uLavaHot*1.6,boil*lake);',
      'float cr=1.-smoothstep(0.,.1,abs(vn3(vP*3.1+vec3(0.,-uTime*.05,0.))-.5));float cr2=1.-smoothstep(0.,.08,abs(vn3(vP*6.1+7.)-.5));',
      'float glowAmt=clamp(.15+clamp(cr*.9+cr2*.6,0.,1.)*(.7+.8*temp)+smoothstep(uExt-.2,uExt,rad)*1.1,0.,1.6);vec3 emis=lcol*glowAmt*lm*1.6;',
      'col=mix(col,col*.25+vec3(.03,.012,.012),lm*.85*(1.-uMud)*(1.-lake));',
      'vec3 mudc=uMudCol*(.6+.7*flowN);mudc+=vec3(.28,.2,.12)*smoothstep(.55,.9,vn3(vec3(vP.x*3.,vP.y*1.2-uTime*1.6,vP.z*3.)));',
      'emis=mix(emis,mudc*lm*.5,uMud*(1.-lake));col=mix(col,mudc*(uAmb+uLightCol*diff*.6),lm*uMud*.85*(1.-lake));',
      'col+=emis;col+=uLavaMid*halo*ext*uLava*(1.-uMud)*.5*(1.-.5*diff);',
      'col+=vec3(.5,.55,.7)*uFlash*.16;',
      'col=mix(col,uFog,clamp(uFogK+(1.-smoothstep(0.,11.,h))*.22,0.,1.));col=mix(col,uHazeCol,uHaze*.3);',
      'gl_FragColor=vec4(col,1.);}'
    ].join('\n')});
  var volcano=new THREE.Mesh(volG,volMat);
  volcano.position.set(coneX,VGY,VZ);volcano.frustumCulled=false;volcano.renderOrder=2.5;scene.add(volcano);

  /* ---------- hamparan awan di lereng ---------- */
  var bankU=[],banks=[];
  var bankV='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}';
  var bankF=[
    'varying vec2 vUv;uniform vec3 uLit,uShade;uniform float uTime,uWind,uW,uH,uSeed,uSpd,uAlpha,uLX,uLY,uCov;',
    'float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*vn(p);p=p*2.04+vec2(11.7,5.3);a*=.5;}return s;}',
    'float dens(vec2 p){float w=fbm(p*.55+3.1);float b=fbm(p+vec2(w*1.6,w*.9));',
    'float prof=smoothstep(.0,.22,vUv.y)*(1.-smoothstep(.38,.95,vUv.y+(b-.5)*.7));return smoothstep(.26-uCov*.1,.68,b)*prof;}',
    'void main(){vec2 p=vec2(vUv.x*uW*.05+uTime*.018*uWind*uSpd+uSeed,vUv.y*uH*.1);',
    'float d=dens(p);float d2=dens(p+vec2(uLX,uLY)*.22);',
    'float lit=clamp(.62+(d-d2)*1.9+(vUv.y-.45)*.7,0.,1.);',
    'vec3 col=mix(uShade,uLit,lit);',
    'float a=d*uAlpha*smoothstep(0.,.07,vUv.x)*(1.-smoothstep(.93,1.,vUv.x));if(a<.004)discard;gl_FragColor=vec4(col,a);}'
  ].join('\n');
  [[-52,-1.5,22,300,1.0,.0,.92],[-69,-3,24,300,.6,7.3,.85],[-35,-7,13,260,1.5,3.7,.62],[-86,2.5,22,320,.4,11.9,.8]].forEach(function(b){
    var u={uLit:{value:new THREE.Color()},uShade:{value:new THREE.Color()},uTime:shared.uTime,uWind:shared.uWind,uW:{value:b[3]},uH:{value:b[2]},uSeed:{value:b[5]},uSpd:{value:b[4]},uAlpha:{value:b[6]},uLX:{value:.5},uLY:{value:.3},uCov:{value:.5},uBase:{value:b[6]}};
    var m=new THREE.Mesh(new THREE.PlaneGeometry(b[3],b[2]),new THREE.ShaderMaterial({uniforms:u,vertexShader:bankV,fragmentShader:bankF,transparent:true,depthWrite:false}));
    m.position.set(0,b[1],b[0]);m.frustumCulled=false;m.renderOrder=3;scene.add(m);bankU.push(u);banks.push(m);
  });

  /* ---------- pelangi: bidang di antara gunung jauh dan bukit hutan, jadi busurnya menimpa gunung api tetapi tertutup bukit dekat.
     Warna dihitung per panjang gelombang (400-700 nm) dengan sudut hamburan nyata: busur utama 40,6-42,3 derajat (merah di luar),
     busur sekunder 50,4-53,5 derajat (urutan terbalik, lebih redup), langit di dalam busur lebih terang dan pita Alexander di antaranya lebih gelap. ---------- */
  var bowU={uBow:{value:0},uBowC:{value:new THREE.Vector2(.7,.3)},uBowR:{value:.6},uAspect:skyU.uAspect,uRes:shared.uRes,uTime:shared.uTime};
  var bow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:bowU,transparent:true,depthWrite:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
      'uniform vec2 uBowC,uRes;uniform float uBow,uBowR,uAspect,uTime;',
      'float bh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float bn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bh(i),bh(i+vec2(1.,0.)),f.x),mix(bh(i+vec2(0.,1.)),bh(i+vec2(1.,1.)),f.x),f.y);}',
      /* panjang gelombang (nm) ke RGB linear, dengan peredupan di ujung spektrum */
      'vec3 wl(float l){vec3 c;if(l<440.)c=vec3((440.-l)/60.*.6,0.,1.);else if(l<490.)c=vec3(0.,(l-440.)/50.,1.);else if(l<510.)c=vec3(0.,1.,(510.-l)/20.);',
      'else if(l<580.)c=vec3((l-510.)/70.,1.,0.);else if(l<645.)c=vec3(1.,(645.-l)/65.,0.);else c=vec3(1.,0.,0.);',
      'return c*(l<420.?.35+.65*(l-400.)/20.:(l>680.?.35+.65*(700.-l)/20.:1.));}',
      'void main(){vec2 uv=gl_FragCoord.xy/uRes;vec2 d=(uv-uBowC)*vec2(uAspect,1.);float r=length(d)/uBowR;',
      'if(r<.62||r>1.36||uBow<.002)discard;',
      'float ang=atan(d.y,d.x);',
      /* tirai hujan tidak rata: busur menebal dan menipis perlahan di sepanjang lengkungnya */
      'float m=.45+.55*smoothstep(.2,.75,bn(vec2(ang*3.2+uTime*.015,1.7))*.65+bn(vec2(ang*9.-uTime*.02,5.3))*.35);',
      'm*=(1.-.35*smoothstep(.55,1.,d.y/uBowR))*(.12+.88*smoothstep(.04,.5,d.y/uBowR));',
      'vec3 p1=vec3(0.),p2=vec3(0.),nw=vec3(0.);',
      'for(int i=0;i<14;i++){float l=400.+float(i)*23.;vec3 w=wl(l);nw+=w;',
      /* profil Airy sederhana: tepi luar tajam, ekor dalam melebar (sumber pita pastel di sisi dalam) */
      'float x1=r-(40.6+(l-400.)/300.*1.7)/42.3;p1+=w*(x1>0.?exp(-x1*x1/.00007):exp(-x1*x1/.00016)*.85+exp(-x1*x1/.0012)*.08);',
      'float x2=r-(50.4+(700.-l)/300.*3.1)/42.3;p2+=w*(x2<0.?exp(-x2*x2/.00012):exp(-x2*x2/.0004)*.8);}',
      'vec3 bowc=(p1+p2*.3)/nw*2.3;',
      'float inner=smoothstep(.7,.96,r)*(1.-smoothstep(.955,.975,r))*.022;',
      'float alex=smoothstep(.995,1.02,r)*(1.-smoothstep(1.17,1.195,r));',
      'gl_FragColor=vec4((bowc+inner)*m*uBow,alex*.07*m*uBow);}'
    ].join('\n')}));
  bow.frustumCulled=false;bow.renderOrder=3.5;bow.visible=false;bow.position.z=-50;bow.scale.set(420,220,1);scene.add(bow);
  var bowA=0,bowCx=.7,bowCy=.3,fdt=.016;

  /* ---------- kolom abu erupsi: bergolak, lalu menjamur di puncak ---------- */
  var puffNoise=[
    'float ph(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float pn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(ph(i),ph(i+vec2(1.,0.)),f.x),mix(ph(i+vec2(0.,1.)),ph(i+vec2(1.,1.)),f.x),f.y);}',
    'float pf(vec2 p){return pn(p)*.5+pn(p*2.1+4.7)*.3+pn(p*4.3+9.1)*.2;}'
  ].join('\n');
  var puffF=[
    'uniform vec3 uShade,uLitC,uGlowC;uniform vec2 uSunDir;uniform float uGlowK,uDark;varying float vA,vT,vR,vH;',puffNoise,
    'void main(){vec2 uv=(gl_PointCoord-.5)*2.;float d=length(uv);float n=pf(uv*2.4+vR*37.);',
    'float e=d+(n-.5)*.95;float a=smoothstep(1.,.4,e)*vA;if(a<.004)discard;',
    'vec3 nr=vec3(uv.x,-uv.y,sqrt(max(1.-d*d,0.)));float l=dot(nr,normalize(vec3(uSunDir,.55)))*.5+.5;l=clamp(l+(n-.5)*.7,0.,1.);',
    /* tepi gumpalan yang menghadap matahari lebih terang (hamburan tepi) */
    'float edgeLit=smoothstep(.45,.95,e)*clamp(dot(uv,uSunDir*vec2(1.,-1.)),0.,1.);',
    'vec3 col=mix(uShade,uLitC,l*(1.-.4*uDark));col*=.78+.22*smoothstep(0.,.5,vH);col+=uLitC*edgeLit*.35;',
    'col+=uGlowC*uGlowK*(1.-smoothstep(0.,.3,vH))*(1.-l*.6)*(.4+.6*n)*1.4;',
    'gl_FragColor=vec4(col,a);}'
  ].join('\n');
  var NP=mobile?800:1100,pSeed=new Float32Array(NP),pR=new Float32Array(NP*4);
  for(var i=0;i<NP;i++){pSeed[i]=i/NP;pR[i*4]=Math.random();pR[i*4+1]=Math.random();pR[i*4+2]=Math.random();pR[i*4+3]=Math.random();}
  var plumeG=new THREE.BufferGeometry();
  plumeG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NP*3),3));
  plumeG.setAttribute('aSeed',new THREE.BufferAttribute(pSeed,1));
  plumeG.setAttribute('aR',new THREE.BufferAttribute(pR,4));
  var plumeU=Object.assign({},shared,{uAsh:{value:.1},uH:{value:3},uOrigin:{value:new THREE.Vector3()},uShade:{value:new THREE.Color()},uLitC:{value:new THREE.Color()},uGlowC:{value:new THREE.Color(1,.45,.15)},uGlowK:{value:0},uDark:{value:0},uSunDir:{value:new THREE.Vector2(.5,.7)},uPulse:{value:1}});
  var plume=new THREE.Points(plumeG,new THREE.ShaderMaterial({uniforms:plumeU,transparent:true,depthWrite:false,
    vertexShader:[
      'attribute float aSeed;attribute vec4 aR;uniform float uTime,uAsh,uH,uWind,uPR,uPulse;uniform vec3 uOrigin;varying float vA,vT,vR,vH;',
      'void main(){float t=fract(aSeed+uTime*.042);float ph=pow(t,.6);',
      'float rad=.7+ph*uH*.25*(.7+.3*uPulse)+smoothstep(.62,1.,ph)*uH*.2*(.6+.4*uPulse);float ang=aR.y*6.2832;float rr=sqrt(aR.z)*rad;',
      'vec3 p=uOrigin;p.y+=ph*uH*(.85+.15*uPulse);',
      'p.x+=cos(ang)*rr;p.z+=sin(ang)*rr*.7;',
      'float tb=sin(uTime*.9+aR.w*40.+ph*11.)*ph*uH*.028+sin(uTime*.37+aR.x*30.)*ph*uH*.02;p.x+=tb;p.y+=cos(uTime*.8+aR.w*31.)*ph*uH*.014;',
      'float um=smoothstep(.7,1.,t)*smoothstep(.25,.8,uAsh);p.x+=(aR.x-.5)*2.*um*uH*.5;p.z+=(aR.y-.5)*um*uH*.3;p.y-=um*aR.z*uH*.07;',
      'p.x+=uWind*pow(ph,2.1)*uH*.5;',
      'vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;',
      'gl_PointSize=(20.+aR.w*26.)*(.6+ph*2.4)*(.6+uH*.05)*uPR*(78./-mv.z);',
      'vA=uAsh*smoothstep(0.,.05,t)*(1.-smoothstep(.72,1.,t))*(.55+.45*aR.z)*(.8+.55*uAsh);vT=t;vR=aR.w;vH=ph;}'
    ].join('\n'),
    fragmentShader:puffF}));
  plume.frustumCulled=false;plume.renderOrder=20;scene.add(plume);

  /* hujan abu halus yang jatuh searah angin */
  var NF=260,fS=new Float32Array(NF),fR=new Float32Array(NF*4);
  for(var af=0;af<NF;af++){fS[af]=af/NF;fR[af*4]=Math.random();fR[af*4+1]=Math.random();fR[af*4+2]=Math.random();fR[af*4+3]=Math.random();}
  var fallG=new THREE.BufferGeometry();
  fallG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NF*3),3));
  fallG.setAttribute('aSeed',new THREE.BufferAttribute(fS,1));fallG.setAttribute('aR',new THREE.BufferAttribute(fR,4));
  var fallU=Object.assign({},shared,{uAsh:{value:0},uH:{value:3},uOrigin:{value:new THREE.Vector3()},uCol:{value:new THREE.Color(.25,.22,.2)}});
  var ashfall=new THREE.Points(fallG,new THREE.ShaderMaterial({uniforms:fallU,transparent:true,depthWrite:false,
    vertexShader:'attribute float aSeed;attribute vec4 aR;uniform float uTime,uAsh,uH,uWind,uPR;uniform vec3 uOrigin;varying float vA;void main(){float t=fract(aSeed+uTime*.05);vec3 p=uOrigin;p.x+=uWind*(2.5+aR.x*uH*.9+t*7.)+(aR.y-.5)*9.;p.y+=uH*.65-t*(uH*.65+24.);p.z+=(aR.z-.5)*8.;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(40.+aR.w*44.)*uPR*(78./-mv.z);vA=smoothstep(.45,.95,uAsh)*smoothstep(0.,.1,t)*(1.-smoothstep(.75,1.,t))*.07*(.4+.6*aR.w);}',
    fragmentShader:'uniform vec3 uCol;varying float vA;void main(){vec2 q=(gl_PointCoord-.5)*vec2(2.,.9);float d=length(q);float a=smoothstep(1.,0.,d);a*=a*vA;if(a<.003)discard;gl_FragColor=vec4(uCol,a);}'}));
  ashfall.frustumCulled=false;ashfall.renderOrder=19;scene.add(ashfall);

  /* awan panas menyusuri lereng; posisinya dihitung di CPU dari bentuk gunung */
  var NPY=220,pyPos=new Float32Array(NPY*3),pyA=new Float32Array(NPY*2),pyS=new Float32Array(NPY);
  var pyCh=[],pyPh=[];
  for(var py=0;py<NPY;py++){pyCh.push([.45,.7,.95,1.2,1.45,1.7,1.95,2.2,2.45,2.7][py%10]+(Math.random()-.5)*.14);pyPh.push(Math.random());pyS[py]=Math.random();}
  var pyG=new THREE.BufferGeometry();
  pyG.setAttribute('position',new THREE.BufferAttribute(pyPos,3));pyG.setAttribute('aA',new THREE.BufferAttribute(pyA,2));pyG.setAttribute('aSeed',new THREE.BufferAttribute(pyS,1));
  var pyU=Object.assign({},shared,{uShade:plumeU.uShade,uLitC:plumeU.uLitC,uGlowC:plumeU.uGlowC,uGlowK:{value:0},uDark:plumeU.uDark,uSunDir:plumeU.uSunDir});
  var pyro=new THREE.Points(pyG,new THREE.ShaderMaterial({uniforms:pyU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec2 aA;attribute float aSeed;uniform float uPR;varying float vA,vT,vR,vH;void main(){vec4 mv=viewMatrix*modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aA.x*uPR*(78./-mv.z);vA=aA.y;vT=.5;vR=aSeed;vH=1.;}',
    fragmentShader:puffF}));
  pyro.frustumCulled=false;pyro.renderOrder=17;scene.add(pyro);
  function updatePyro(time,act){
    for(var i=0;i<NPY;i++){
      var t=(pyPh[i]+time*(.13+pyS[i]*.06))%1,th=pyCh[i];
      var r=2.6+Math.pow(t,.85)*23,h=volH(r,th);
      var lift=.6+t*3.2*(.6+pyS[i]*.8);
      pyPos[i*3]=coneX+r*Math.cos(th);pyPos[i*3+1]=VGY+h+lift;pyPos[i*3+2]=VZ+r*Math.sin(th)*VSZ+1.6;
      pyA[i*2]=(26+t*92)*(.7+pyS[i]*.6);
      pyA[i*2+1]=act*smoothstep01(0,.08,t)*(1-smoothstep01(.45,1,t))*.8;
    }
    pyG.attributes.position.needsUpdate=true;pyG.attributes.aA.needsUpdate=true;
  }
  /* kilau kawah */
  var glowU=Object.assign({},shared,{uGlow:{value:0},uCol:{value:new THREE.Color()},uSize:{value:70}});
  var glowG=new THREE.BufferGeometry();glowG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3));
  var glow=new THREE.Points(glowG,new THREE.ShaderMaterial({uniforms:glowU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'uniform float uSize,uPR;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*uPR*(78./-mv.z)*4.;}',
    fragmentShader:'uniform vec3 uCol;uniform float uGlow,uTime;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.)*uGlow*(.85+.15*sin(uTime*3.1));if(d>1.)discard;gl_FragColor=vec4(uCol*a,a);}'}));
  glow.frustumCulled=false;glow.renderOrder=21;scene.add(glow);

  /* lontaran material pijar (bom vulkanik) */
  var NB=150,bR=new Float32Array(NB*4);
  for(var bi=0;bi<NB*4;bi++)bR[bi]=Math.random();
  var bombG=new THREE.BufferGeometry();
  bombG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NB*3),3));
  bombG.setAttribute('aR',new THREE.BufferAttribute(bR,4));
  var bombU=Object.assign({},shared,{uAct:{value:0},uOrigin:{value:new THREE.Vector3()},uC1:{value:P.gold.clone().multiplyScalar(1.6)},uC2:{value:P.orange.clone()}});
  var bombs=new THREE.Points(bombG,new THREE.ShaderMaterial({uniforms:bombU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uAct;uniform vec3 uOrigin;varying float vA,vK;void main(){float t=fract(aR.x+uTime*(.3+aR.y*.18));vec3 v=vec3((aR.y-.5)*10.,14.+aR.z*11.,(aR.w-.5)*3.);vec3 p=uOrigin+v*t;p.y-=17.*t*t;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(3.5+aR.z*5.)*uPR*(78./-mv.z)*(1.-.4*t);vA=uAct*(1.-t)*smoothstep(0.,.04,t);vK=t;}',
    fragmentShader:'uniform vec3 uC1,uC2;varying float vA,vK;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=exp(-d*d*3.)*vA;gl_FragColor=vec4(mix(uC1,uC2,vK)*a,a);}'}));
  bombs.frustumCulled=false;bombs.renderOrder=23;scene.add(bombs);

  /* petir vulkanik di dalam kolom abu */
  var vlU=Object.assign({},shared,{uI:{value:0}});
  var vlG=new THREE.BufferGeometry();vlG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3));
  var vlight=new THREE.Points(vlG,new THREE.ShaderMaterial({uniforms:vlU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'uniform float uPR;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=150.*uPR*(78./-mv.z);}',
    fragmentShader:'uniform float uI;void main(){vec2 q=(gl_PointCoord-.5)*2.;float d=length(q);float a=exp(-d*d*7.)*uI+exp(-abs(q.x)*40.-q.y*q.y*2.)*uI*.7;if(d>1.)discard;gl_FragColor=vec4(vec3(.8,.85,1.)*a*1.5,a);}'}));
  vlight.frustumCulled=false;vlight.renderOrder=26;scene.add(vlight);

  /* ---------- kebakaran lahan: api, asap, bara ---------- */
  var sites=[],frng=function(){return Math.random();};
  var fireL=[ridges[2],ridges[3]];
  for(var fi=0;fi<22;fi++){var FL=fireL[fi%2],fx=-52+frng()*104;sites.push({L:FL,x:fx,s:.7+frng()*.9});}
  sites.sort(function(a,b){return b.s-a.s;});
  /* titik api terbesar ditempatkan di sisi kanan agar tidak tertutup kartu */
  sites.forEach(function(s,i){s.big=i<5?1:0;if(i<8)s.x=4+i*6.5+(frng()-.5)*3;s.y=heightJS(s.L,s.x)-frng()*1.6;s.z=s.L.z+.6;});
  var FPF=5,SPF=8,EPF=6;
  var fPos=new Float32Array(sites.length*FPF*3),fA=new Float32Array(sites.length*FPF*4);
  var gPos=new Float32Array(sites.length*3),gA=new Float32Array(sites.length*4);
  var kPos=new Float32Array(sites.length*SPF*3),kR=new Float32Array(sites.length*SPF*4);
  var ePos=new Float32Array(sites.length*EPF*3),eR=new Float32Array(sites.length*EPF*4);
  sites.forEach(function(s,i){
    for(var a=0;a<FPF;a++){var o=(i*FPF+a);fPos[o*3]=s.x+(frng()-.5)*s.s*3;fPos[o*3+1]=s.y+frng()*.4;fPos[o*3+2]=s.z+(frng()-.5)*.4;
      fA[o*4]=s.s*(.7+frng()*.6);fA[o*4+1]=frng();fA[o*4+2]=s.big;fA[o*4+3]=frng();}
    gPos[i*3]=s.x;gPos[i*3+1]=s.y+.3;gPos[i*3+2]=s.z-.1;gA[i*4]=s.s;gA[i*4+1]=s.big;gA[i*4+2]=frng();gA[i*4+3]=frng();
    for(var b=0;b<SPF;b++){var q=(i*SPF+b);kPos[q*3]=s.x+(frng()-.5)*s.s;kPos[q*3+1]=s.y+.6;kPos[q*3+2]=s.z+(frng()-.5)*.6;
      kR[q*4]=frng();kR[q*4+1]=frng();kR[q*4+2]=s.s*(.6+frng()*.5);kR[q*4+3]=s.big;}
    for(var c=0;c<EPF;c++){var e=(i*EPF+c);ePos[e*3]=s.x+(frng()-.5)*s.s*2;ePos[e*3+1]=s.y+.3;ePos[e*3+2]=s.z+(frng()-.5)*.6;
      eR[e*4]=frng();eR[e*4+1]=frng();eR[e*4+2]=frng();eR[e*4+3]=s.big;}
  });
  var fireSpot=sites[0];
  function ptsGeo(pos,attr,name){var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute(name,new THREE.BufferAttribute(attr,4));return g;}
  var fireU=Object.assign({},shared,{uFire:{value:0},uOut:{value:0},uSmokeShade:{value:new THREE.Color()},uSmokeLit:{value:new THREE.Color()}});
  var fglow=new THREE.Points(ptsGeo(gPos,gA,'aA'),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec4 aA;uniform float uTime,uPR,uFire,uOut;varying float vI;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float k=aA.y>.5?(1.-uOut):(1.-uOut*.15);float fl=.85+.15*sin(uTime*3.+aA.z*30.);gl_PointSize=aA.x*120.*uPR*(78./-mv.z)*k*fl;vI=uFire*k*.55;}',
    fragmentShader:'varying float vI;void main(){vec2 q=(gl_PointCoord-.5)*vec2(2.,2.6);float d=length(q);float a=exp(-d*d*3.2)*vI;if(d>1.)discard;gl_FragColor=vec4(vec3(1.,.42,.14)*a,a);}'}));
  fglow.frustumCulled=false;fglow.renderOrder=22;scene.add(fglow);
  var flames=new THREE.Points(ptsGeo(fPos,fA,'aA'),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec4 aA;uniform float uTime,uPR,uFire,uOut;uniform vec2 uRes;varying vec4 vA;varying float vI;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float k=aA.z>.5?(1.-uOut):(1.-uOut*.15);float fl=.75+.25*sin(uTime*(5.+aA.y*6.)+aA.w*30.)+.1*sin(uTime*13.+aA.w*9.);float sz=aA.x*30.*fl*uPR*(78./-mv.z)*k;gl_PointSize=sz;gl_Position.y+=gl_Position.w*sz/uRes.y*.8;vA=aA;vI=uFire*k;}',
    fragmentShader:[
      'varying vec4 vA;varying float vI;uniform float uTime;',
      'void main(){vec2 p=vec2(gl_PointCoord.x,1.-gl_PointCoord.y);float h=p.y;float x=(p.x-.5)*2.;',
      'float sw=sin(h*7.-uTime*8.+vA.w*20.)*.16*h+sin(h*15.-uTime*13.+vA.y*9.)*.07*h;',
      'float w=mix(.6,.03,pow(h,.75));float d=abs(x-sw)/w;',
      'float body=smoothstep(1.,.15,d)*smoothstep(0.,.06,h)*(1.-smoothstep(.82,1.,h));if(body<.01)discard;',
      'float core=smoothstep(.55,0.,d)*(1.-h*.9);',
      'vec3 c=mix(vec3(.85,.3,.1),vec3(1.,.55,.2),h*.9+.1);c=mix(c,vec3(1.3,.85,.45),core*.85);c=mix(c,vec3(1.6,1.3,.9),core*core*.4);',
      'gl_FragColor=vec4(c,body*vI);}'
    ].join('\n')}));
  flames.frustumCulled=false;flames.renderOrder=24;scene.add(flames);
  var fsmoke=new THREE.Points(ptsGeo(kPos,kR,'aR'),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uFire,uOut,uWind;varying float vA,vT;void main(){float t=fract(aR.x+uTime*(.07+aR.y*.03));float k=aR.w>.5?(1.-uOut*.9):(1.-uOut*.3);vec3 p=position;p.y+=t*(10.+aR.z*9.)*k;p.x+=uWind*t*t*(16.+aR.z*6.)+sin(uTime*.7+aR.y*6.+t*5.)*t*1.4;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(18.+aR.z*24.)*(.35+t*2.8)*uPR*(78./-mv.z)*k;vA=uFire*smoothstep(0.,.06,t)*(1.-smoothstep(.55,1.,t))*.62*k;vT=t;}',
    fragmentShader:puffNoise+'uniform vec3 uSmokeShade,uSmokeLit;varying float vA,vT;void main(){vec2 uv=(gl_PointCoord-.5)*2.;float d=length(uv)+(pf(uv*2.2+vT*9.)-.5)*.7;float a=smoothstep(1.,.1,d);a*=a*vA;if(a<.003)discard;vec3 c=mix(uSmokeShade,uSmokeLit,vT*.55+(pf(uv*3.)-.5)*.3);c=mix(vec3(.92,.42,.24),c,smoothstep(.02,.3,vT));gl_FragColor=vec4(c,a);}'}));
  fsmoke.frustumCulled=false;fsmoke.renderOrder=19;scene.add(fsmoke);
  var embers=new THREE.Points(ptsGeo(ePos,eR,'aR'),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uFire,uOut,uWind;varying float vA;void main(){float t=fract(aR.x+uTime*(.18+aR.y*.2));float k=aR.w>.5?(1.-uOut):(1.-uOut*.2);vec3 p=position;p.y+=t*(6.+aR.z*10.);p.x+=uWind*t*(5.+aR.y*5.)+sin(uTime*2.+aR.y*30.)*.4*t;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(2.2+aR.z*3.)*uPR*(78./-mv.z)*k;vA=uFire*k*(1.-t)*smoothstep(0.,.05,t)*(.6+.4*sin(uTime*14.+aR.y*40.));}',
    fragmentShader:'varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=exp(-d*d*3.)*vA;gl_FragColor=vec4(vec3(1.4,.8,.35)*a,a);}'}));
  embers.frustumCulled=false;embers.renderOrder=25;scene.add(embers);

  /* ---------- kabut asap lebar ---------- */
  var NS=34,sPos=new Float32Array(NS*3),sR=new Float32Array(NS*4);
  for(var q=0;q<NS;q++){sPos[q*3]=Math.random();sPos[q*3+1]=-10+Math.random()*14;sPos[q*3+2]=-40+Math.random()*34;sR[q*4]=Math.random();sR[q*4+1]=Math.random();sR[q*4+2]=Math.random();sR[q*4+3]=Math.random();}
  var smokeU=Object.assign({},shared,{uSmoke:{value:0},uC1:{value:P.red.clone()},uC2:{value:P.maroon.clone()}});
  var smoke=new THREE.Points(ptsGeo(sPos,sR,'aR'),new THREE.ShaderMaterial({uniforms:smokeU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uSmoke,uWind;varying float vA,vR;void main(){vec3 p=position;p.x=mod(aR.x*140.+uWind*uTime*(1.4+aR.y)+70.,140.)-70.;p.y+=sin(uTime*.2+aR.z*6.28)*1.2;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(70.+aR.w*110.)*uPR*(78./-mv.z);float e=smoothstep(0.,14.,p.x+70.)*smoothstep(0.,14.,70.-p.x);vA=uSmoke*e*(.34+.3*aR.y);vR=aR.z;}',
    fragmentShader:puffNoise+'uniform vec3 uC1,uC2;varying float vA,vR;void main(){vec2 uv=(gl_PointCoord-.5)*2.;float d=length(uv)+(pf(uv*2.+vR*40.)-.5)*.9;float a=smoothstep(1.,.05,d);a*=a*vA;if(a<.003)discard;gl_FragColor=vec4(mix(uC1,uC2,vR),a);}'}));
  smoke.frustumCulled=false;smoke.renderOrder=18;scene.add(smoke);

  /* ---------- burung: kawanan berformasi V yang mengepakkan sayap ---------- */
  var NBD=18,bdR=new Float32Array(NBD*4);
  for(var bd=0;bd<NBD;bd++){bdR[bd*4]=bd<11?0:1;bdR[bd*4+1]=(bd<11?bd/10:(bd-11)/6);bdR[bd*4+2]=Math.random();bdR[bd*4+3]=Math.random();}
  var birdU=Object.assign({},shared,{uBird:{value:0},uCol:{value:new THREE.Color()}});
  var birds=new THREE.Points(ptsGeo(new Float32Array(NBD*3),bdR,'aR'),new THREE.ShaderMaterial({uniforms:birdU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uBird;varying float vA,vFl;void main(){float fk=aR.x;float id=aR.y;float sp=1.5+fk*.4;float lead=mod(uTime*sp+fk*80.,170.)-85.;float k=abs(id-.5)*2.;'+
      'vec3 p=vec3(lead-k*7.+sin(uTime*.7+id*20.)*.5,15.5+fk*3.5-k*2.2*(id<.5?1.:.85)+(id-.5)*1.2+sin(uTime*.5+id*9.)*.4,-36.-fk*12.);'+
      'vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(22.+aR.z*8.)*uPR*(78./-mv.z);vFl=sin(uTime*(6.5+aR.z*3.)+aR.w*30.);vA=uBird;}',
    fragmentShader:'uniform vec3 uCol;varying float vA,vFl;void main(){if(vA<.01)discard;vec2 q=(gl_PointCoord-.5)*2.;q.y=-q.y;float ax=abs(q.x);float yc=vFl*.45*ax*(1.-ax*.35)-.04;float th=.1*(1.-ax)+.025;float a=smoothstep(th,th*.3,abs(q.y-yc))*step(ax,.95);a=max(a,smoothstep(.13,.05,length(q*vec2(.9,1.8))));gl_FragColor=vec4(uCol,a*vA);}'}));
  birds.frustumCulled=false;birds.renderOrder=8;scene.add(birds);

  /* ---------- kunang-kunang di padang saat malam ---------- */
  var NFF=mobile?50:80,ffPos=new Float32Array(NFF*3),ffR=new Float32Array(NFF*4);
  for(var ff=0;ff<NFF;ff++){ffPos[ff*3]=-30+Math.random()*60;ffPos[ff*3+1]=-3+Math.random()*5;ffPos[ff*3+2]=-12+Math.random()*16;ffR[ff*4]=Math.random();ffR[ff*4+1]=Math.random();ffR[ff*4+2]=Math.random();ffR[ff*4+3]=Math.random();}
  var ffU=Object.assign({},shared,{uFF:{value:0}});
  var fireflies=new THREE.Points(ptsGeo(ffPos,ffR,'aR'),new THREE.ShaderMaterial({uniforms:ffU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uFF;varying float vA;void main(){vec3 p=position;p.x+=sin(uTime*.35+aR.x*20.)*1.4;p.y+=sin(uTime*.55+aR.y*17.)*.6;p.z+=cos(uTime*.3+aR.z*11.)*.9;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(10.+aR.w*10.)*uPR*(30./-mv.z);vA=uFF*pow(max(0.,sin(uTime*(.9+aR.x*1.4)+aR.y*40.)),3.);}',
    fragmentShader:'varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=(exp(-d*d*16.)*1.4+exp(-d*d*3.)*.35)*vA;gl_FragColor=vec4(vec3(.9,1.,.5)*a,a);}'}));
  fireflies.frustumCulled=false;fireflies.renderOrder=29;scene.add(fireflies);

  /* ---------- partikel udara, hujan, salju, daun, kelopak ---------- */
  var NM=170,mPos=new Float32Array(NM*3),mR=new Float32Array(NM*4);
  for(var w=0;w<NM;w++){mPos[w*3]=-48+Math.random()*96;mPos[w*3+1]=-4+Math.random()*26;mPos[w*3+2]=-6+Math.random()*16;mR[w*4]=Math.random();mR[w*4+1]=Math.random();mR[w*4+2]=Math.random();mR[w*4+3]=Math.random();}
  var moteU=Object.assign({},shared,{uC1:{value:new THREE.Color()},uC2:{value:new THREE.Color()},uMood:{value:0},uK:{value:1}});
  var motes=new THREE.Points(ptsGeo(mPos,mR,'aR'),new THREE.ShaderMaterial({uniforms:moteU,transparent:true,depthWrite:false,
    vertexShader:[
      'attribute vec4 aR;uniform float uTime,uPR,uWind,uMood,uK;uniform vec2 uPointer;varying float vA,vR;',
      'void main(){vec3 p=position;',
      'p.x=mod(position.x+48.+uWind*uTime*(.25+aR.x*.5)*(.5+uMood*2.)+sin(uTime*.3+aR.y*6.)*.8,96.)-48.;',
      'p.y=mod(position.y+4.+uTime*(.15+aR.y*.35)*(.4+uMood*2.2),26.)-4.;',
      'vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;',
      'vec2 nd=gl_Position.xy/gl_Position.w;vec2 dd=nd-uPointer;float f=exp(-dot(dd,dd)*10.);gl_Position.xy+=gl_Position.w*normalize(dd+1e-4)*f*.2;',
      'gl_PointSize=(.5+aR.z*1.3)*uPR*(150./-mv.z);',
      'vA=uK*(.35+.5*aR.w)*smoothstep(-4.,-1.,p.y)*(1.-smoothstep(19.,22.,p.y));vR=aR.w;}'
    ].join('\n'),
    fragmentShader:'uniform vec3 uC1,uC2;varying float vA,vR;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=smoothstep(1.,.3,d)*vA;gl_FragColor=vec4(mix(uC1,uC2,step(.5,vR)),a);}'}));
  motes.frustumCulled=false;motes.renderOrder=30;scene.add(motes);

  var NRN=mobile?1000:1500,rainPos=new Float32Array(NRN*2*3),rainR=new Float32Array(NRN*2*4),rainE=new Float32Array(NRN*2);
  for(var rn=0;rn<NRN;rn++){var rx=-35+Math.random()*70,ry=-8+Math.random()*40,rz=-12+Math.random()*28,r0=Math.random(),r1=Math.random(),r2=Math.random(),r3=Math.random();
    for(var e2=0;e2<2;e2++){var id=rn*2+e2;rainPos[id*3]=rx;rainPos[id*3+1]=ry;rainPos[id*3+2]=rz;rainR[id*4]=r0;rainR[id*4+1]=r1;rainR[id*4+2]=r2;rainR[id*4+3]=r3;rainE[id]=e2;}}
  var rainG=new THREE.BufferGeometry();
  rainG.setAttribute('position',new THREE.BufferAttribute(rainPos,3));rainG.setAttribute('aR',new THREE.BufferAttribute(rainR,4));rainG.setAttribute('aEnd',new THREE.BufferAttribute(rainE,1));
  var rainU=Object.assign({},shared,{uRain:{value:0},uC:{value:C(0xE6F5EE)}});
  var rain=new THREE.LineSegments(rainG,new THREE.ShaderMaterial({uniforms:rainU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;attribute float aEnd;uniform float uTime,uRain,uWind,uGust;varying float vA;void main(){vec3 p=position;float spd=24.+aR.x*10.;p.y=mod(position.y-uTime*spd+8.,40.)-8.;float sl=.14+.1*max(uRain-1.,0.)*2.+uWind*(.04+.08*uGust);p.x+=(p.y*sl);vec3 q=p+vec3(sl,1.,0.)*(.35+aR.y*.4)*aEnd;vec4 mv=viewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;vA=min(uRain,1.)*(.16+.3*aR.z)*(1.-smoothstep(22.,36.,-mv.z))*(.4+.6*aEnd);}',
    fragmentShader:'uniform vec3 uC;varying float vA;void main(){gl_FragColor=vec4(uC,vA);}'}));
  rain.frustumCulled=false;rain.renderOrder=31;scene.add(rain);

  var NSN=700,snPos=new Float32Array(NSN*3),snR=new Float32Array(NSN*4);
  for(var sn=0;sn<NSN;sn++){snPos[sn*3]=-35+Math.random()*70;snPos[sn*3+1]=-8+Math.random()*40;snPos[sn*3+2]=-12+Math.random()*28;snR[sn*4]=Math.random();snR[sn*4+1]=Math.random();snR[sn*4+2]=Math.random();snR[sn*4+3]=Math.random();}
  var snowU=Object.assign({},shared,{uSnow:{value:0},uC:{value:C(0xFFFAEA)}});
  var snow=new THREE.Points(ptsGeo(snPos,snR,'aR'),new THREE.ShaderMaterial({uniforms:snowU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uSnow,uWind,uGust;varying float vA;void main(){vec3 p=position;p.y=mod(position.y-uTime*(1.2+aR.x*1.4)+8.,40.)-8.;p.x+=sin(uTime*.6+aR.y*20.+p.y*.3)*.9+uWind*(.4+.6*uGust)*p.y*.05;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.2+aR.z*2.6)*uPR*(150./-mv.z);vA=uSnow*(.5+.4*aR.w);}',
    fragmentShader:'uniform vec3 uC;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(uC,smoothstep(1.,.2,d)*vA);}'}));
  snow.frustumCulled=false;snow.renderOrder=32;scene.add(snow);

  /* daun maple: bentuk digambar sekali ke tekstur 128px (alpha = bentuk, merah = urat) */
  var mapleTex=(function(){var cv=document.createElement('canvas');cv.width=cv.height=128;var g=cv.getContext('2d');
    var Pm=[[64,13],[71.5,29],[82,25],[79,45],[95,37],[92,53],[112,56],[102,69],[108,81],[85,76],[81,87],[68.5,82],[68.5,115],[59.5,115],[59.5,82],[47,87],[43,76],[20,81],[26,69],[16,56],[36,53],[33,37],[49,45],[46,25],[56.5,29]],
      V=[[[64,84],[64,13]],[[64,79],[95,37]],[[64,79],[33,37]],[[64,76.5],[110,56]],[[64,76.5],[18,56]],[[64,84],[104,80]],[[64,84],[24,80]],[[64,84],[64,114]]];
    g.beginPath();Pm.forEach(function(q,i){i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.closePath();g.fillStyle='#c8c8c8';g.fill();
    g.strokeStyle='#ffffff';g.lineCap='round';V.forEach(function(l,i){g.lineWidth=i?2.6:4;g.beginPath();g.moveTo(l[0][0],l[0][1]);g.lineTo(l[1][0],l[1][1]);g.stroke();});
    var t=new THREE.CanvasTexture(cv);t.needsUpdate=true;return t;})();
  var leafU=Object.assign({},shared,{uLeaf:{value:0},uMap:{value:mapleTex}});
  var leaves=new THREE.Points(ptsGeo(snPos,snR,'aR'),new THREE.ShaderMaterial({uniforms:leafU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uLeaf,uWind,uGust;varying float vA,vC,vAng,vF,vK;void main(){vec3 p=position;float sp=.55+aR.x*.7;p.y=mod(position.y-uTime*sp+8.,40.)-8.;float ph=aR.y*20.;p.x+=sin(uTime*.5+ph+p.y*.25)*2.2+sin(uTime*1.7+ph*1.3)*.35+uWind*(.4+.6*uGust)*(p.y+8.)*.1;p.z+=cos(uTime*.4+aR.y*9.)*1.2;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min((2.+aR.z*2.2)*(1.+.3*step(.18,aR.w))*uPR*(150./-mv.z),34.*uPR);vA=uLeaf*step(aR.w,.45)*.95;vC=aR.x;vK=step(.18,aR.w);vAng=sin(uTime*.9+ph)*1.1+aR.y*6.283+uTime*(aR.z-.5)*.8;vF=cos(uTime*(1.2+aR.z*1.6)+ph);}',
    fragmentShader:'varying float vA,vC,vAng,vF,vK;uniform sampler2D uMap;void main(){if(vA<.01)discard;vec2 p=(gl_PointCoord-.5)*2.;float s=sin(vAng),c=cos(vAng);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);p.x/=max(abs(vF),.14);float e,vein=0.,sh=1.;if(vK<.5){float y=p.y*1.05;float w=.5*pow(max(1.-y*y,0.),.75)*(1.-.3*y);e=w-abs(p.x);float mid=smoothstep(.05,.0,abs(p.x));float sd=smoothstep(.44,.5,abs(fract(y*3.+abs(p.x)*2.5)-.5))*step(abs(p.x),w);vein=max(mid,sd*.8);}else{if(abs(p.x)>1.||abs(p.y)>1.)discard;vec4 t=texture2D(uMap,p*.5+.5);e=(t.a-.5)*.3;sh=t.r;}if(e<-.02)discard;vec3 col=vC<.28?vec3(.75,.16,.07):(vC<.55?vec3(.93,.48,.1):(vC<.82?vec3(.93,.72,.16):vec3(.55,.3,.1)));col*=.72+.3*smoothstep(0.,.25,e);col*=mix(1.,.55+.6*sh,vK);col=mix(col,col*1.3+vec3(.05,.04,0.),vein*.55);col=mix(col,col*vec3(.8,.75,.65),step(vF,0.));gl_FragColor=vec4(col,vA*smoothstep(-.02,.05,e));}'}));
  leaves.frustumCulled=false;leaves.renderOrder=31;scene.add(leaves);

  /* kelopak sakura: lonjong bertakik di ujung, melayang miring, berputar dan terbalik */
  var petalU=Object.assign({},shared,{uPet:{value:0}});
  var petals=new THREE.Points(ptsGeo(snPos,snR,'aR'),new THREE.ShaderMaterial({uniforms:petalU,transparent:true,depthWrite:false,
    vertexShader:'attribute vec4 aR;uniform float uTime,uPR,uPet,uWind,uGust;varying float vA,vC,vAng,vF;void main(){vec3 p=position;float sp=.35+aR.x*.45;p.y=mod(position.y-uTime*sp+8.,40.)-8.;float ph=aR.y*20.;p.x+=sin(uTime*.45+ph+p.y*.22)*2.6+sin(uTime*1.9+ph*1.3)*.3+uWind*(.6+1.3*uGust)*(p.y+8.)*.12;p.z+=cos(uTime*.38+aR.y*9.)*1.3;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min((1.5+aR.z*1.7)*uPR*(150./-mv.z),26.*uPR);vA=uPet*step(aR.w,.85)*.95;vC=aR.x;vAng=sin(uTime*1.1+ph)*1.3+aR.y*6.283+uTime*(aR.z-.5)*1.4;vF=cos(uTime*(1.6+aR.z*2.)+ph);}',
    fragmentShader:'varying float vA,vC,vAng,vF;void main(){if(vA<.01)discard;vec2 p=(gl_PointCoord-.5)*2.;float s=sin(vAng),c=cos(vAng);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);p.x/=max(abs(vF),.18);float e=1.-length((p-vec2(0.,-.08))*vec2(1.55,1.05));e=min(e,length(p-vec2(0.,1.))-.3);if(e<-.02)discard;vec3 col=mix(vec3(.93,.58,.7),vec3(1.,.9,.93),smoothstep(-.7,.6,p.y));col=mix(col,vec3(1.,.97,.98),step(.7,vC)*.5);col*=mix(.82,1.,step(0.,vF));gl_FragColor=vec4(col,vA*smoothstep(-.02,.06,e));}'}));
  petals.frustumCulled=false;petals.renderOrder=31;scene.add(petals);

  /* ---------- petir ---------- */
  var BOLT_N=48,boltPos=new Float32Array(BOLT_N*2*3),boltG=new THREE.BufferGeometry();
  boltG.setAttribute('position',new THREE.BufferAttribute(boltPos,3));boltG.setDrawRange(0,0);
  var boltM=new THREE.LineBasicMaterial({color:new THREE.Color(2.2,2.1,1.9),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  var bolt=new THREE.LineSegments(boltG,boltM);bolt.frustumCulled=false;bolt.renderOrder=2;scene.add(bolt);
  function strike(){
    var x=(Math.random()-.5)*70,y=44,z=-88,n=0,bx=x,by=y;
    function seg(x1,y1,x2,y2){boltPos[n*6]=x1;boltPos[n*6+1]=y1;boltPos[n*6+2]=z;boltPos[n*6+3]=x2;boltPos[n*6+4]=y2;boltPos[n*6+5]=z;n++;}
    var steps=18,dy=(y-6)/steps,branchAt=5+Math.floor(Math.random()*6);
    for(var i=0;i<steps&&n<BOLT_N-8;i++){var nx=bx+(Math.random()-.5)*5,ny=by-dy*(.7+Math.random()*.6);seg(bx,by,nx,ny);
      if(i===branchAt){var cx=nx,cy=ny,dir=Math.random()<.5?-1:1;for(var j=0;j<6&&n<BOLT_N;j++){var mx=cx+dir*(1+Math.random()*3),my=cy-dy*(.5+Math.random()*.5);seg(cx,cy,mx,my);cx=mx;cy=my;}}
      bx=nx;by=ny;}
    boltG.attributes.position.needsUpdate=true;boltG.setDrawRange(0,n*2);
    var p=new THREE.Vector3(x,28,z).project(camera);skyU.uFlashPos.value.set(p.x*.5+.5,p.y*.5+.5);
  }

  /* ---------- pascaproses: bloom 2 tingkat, sinar matahari, grading, vinyet, butiran film ---------- */
  var post=null;
  try{post=(function(){
    var type=HDR?THREE.HalfFloatType:THREE.UnsignedByteType;
    var rtS=new THREE.WebGLRenderTarget(1,1,{type:type,samples:(GL2&&!mobile)?4:0,depthBuffer:true});
    function mk(){return new THREE.WebGLRenderTarget(1,1,{type:type,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false});}
    var b1=mk(),b1t=mk(),b2=mk(),b2t=mk(),ray=mk();
    var cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scn=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;scn.add(quad);
    var VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    function M(fs,u){return new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:fs,depthTest:false,depthWrite:false});}
    var bright=M('uniform sampler2D tIn;uniform float uTh;uniform vec2 uTx;varying vec2 vUv;void main(){vec3 c=texture2D(tIn,vUv+uTx*vec2(-1.,-1.)).rgb+texture2D(tIn,vUv+uTx*vec2(1.,-1.)).rgb+texture2D(tIn,vUv+uTx*vec2(-1.,1.)).rgb+texture2D(tIn,vUv+uTx*vec2(1.,1.)).rgb;c*=.25;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uTh,uTh+.5,l),1.);}',
      {tIn:{value:null},uTh:{value:.78},uTx:{value:new THREE.Vector2()}});
    var blur=M('uniform sampler2D tIn;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(tIn,vUv).rgb*.227027;c+=(texture2D(tIn,vUv+uDir*1.3846).rgb+texture2D(tIn,vUv-uDir*1.3846).rgb)*.316216;c+=(texture2D(tIn,vUv+uDir*3.2308).rgb+texture2D(tIn,vUv-uDir*3.2308).rgb)*.07027;gl_FragColor=vec4(c,1.);}',
      {tIn:{value:null},uDir:{value:new THREE.Vector2()}});
    var rays=M('uniform sampler2D tIn;uniform vec2 uSun;uniform float uTime;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec2 d=(uSun-vUv)*(1./30.)*.9;vec2 uv=vUv+d*h(vUv*1000.+uTime);float w=1.;vec3 acc=vec3(0.);for(int i=0;i<30;i++){acc+=texture2D(tIn,uv).rgb*w;w*=.94;uv+=d;}gl_FragColor=vec4(acc*(1./9.),1.);}',
      {tIn:{value:null},uSun:{value:new THREE.Vector2(.5,.5)},uTime:shared.uTime});
    var comp=M([
      'uniform sampler2D tS,tB1,tB2,tR;uniform float uBloom,uRays,uVig,uGrain,uTime,uSat,uExp;uniform vec3 uRayCol,uLift,uGain;uniform vec2 uRes;varying vec2 vUv;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
      /* bahu lembut: warna di bawah 0,78 tidak diubah, sorotan dikompresi (palet tetap seperti aslinya) */
      'vec3 sh(vec3 x){vec3 k=vec3(.78);vec3 o=k+(1.-k)*(1.-exp(-(x-k)/(1.-k)));return mix(x,o,step(k,x));}',
      'void main(){vec3 c=texture2D(tS,vUv).rgb*uExp;',
      'c+=(texture2D(tB1,vUv).rgb*.5+texture2D(tB2,vUv).rgb*.8)*uBloom;',
      'c+=texture2D(tR,vUv).rgb*uRays*uRayCol;',
      'c=sh(c);float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);',
      'c=c*uGain+uLift*(1.-c);',
      'vec2 q=(vUv-.5)*vec2(uRes.x/uRes.y,1.);c*=mix(1.,smoothstep(1.2,.3,length(q)),uVig);',
      'c+=(h(vUv*uRes+fract(uTime*7.)*91.)-.5)*uGrain;',
      'gl_FragColor=vec4(clamp(c,0.,1.),1.);}'
    ].join('\n'),{tS:{value:null},tB1:{value:null},tB2:{value:null},tR:{value:null},uBloom:{value:.6},uRays:{value:0},uVig:{value:.32},uGrain:{value:.03},uTime:shared.uTime,uSat:{value:1.04},uExp:{value:1},
      uRayCol:{value:new THREE.Color()},uLift:{value:new THREE.Color(0,0,0)},uGain:{value:new THREE.Color(1,1,1)},uRes:{value:new THREE.Vector2(1,1)}});
    var W=1,H=1;
    function pass(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(scn,cam);}
    return {comp:comp,rays:rays,
      setSize:function(w,h){W=Math.max(1,w);H=Math.max(1,h);rtS.setSize(W,H);var w4=Math.max(1,W>>2),h4=Math.max(1,H>>2),w8=Math.max(1,W>>3),h8=Math.max(1,H>>3);
        b1.setSize(w4,h4);b1t.setSize(w4,h4);ray.setSize(w4,h4);b2.setSize(w8,h8);b2t.setSize(w8,h8);comp.uniforms.uRes.value.set(W,H);},
      render:function(){
        renderer.setRenderTarget(rtS);renderer.render(scene,camera);
        bright.uniforms.tIn.value=rtS.texture;bright.uniforms.uTh.value=.92;bright.uniforms.uTx.value.set(1/W,1/H);pass(bright,b1);
        var rOn=comp.uniforms.uRays.value>.003;
        if(rOn){rays.uniforms.tIn.value=b1.texture;pass(rays,ray);}
        var w4=Math.max(1,W>>2),h4=Math.max(1,H>>2),w8=Math.max(1,W>>3),h8=Math.max(1,H>>3);
        blur.uniforms.tIn.value=b1.texture;blur.uniforms.uDir.value.set(1/w4,0);pass(blur,b1t);
        blur.uniforms.tIn.value=b1t.texture;blur.uniforms.uDir.value.set(0,1/h4);pass(blur,b1);
        bright.uniforms.tIn.value=b1.texture;bright.uniforms.uTh.value=-1;bright.uniforms.uTx.value.set(.5/w4,.5/h4);pass(bright,b2);
        blur.uniforms.tIn.value=b2.texture;blur.uniforms.uDir.value.set(1.6/w8,0);pass(blur,b2t);
        blur.uniforms.tIn.value=b2t.texture;blur.uniforms.uDir.value.set(0,1.6/h8);pass(blur,b2);
        comp.uniforms.tS.value=rtS.texture;comp.uniforms.tB1.value=b1.texture;comp.uniforms.tB2.value=b2.texture;comp.uniforms.tR.value=rOn?ray.texture:b2t.texture;
        if(!rOn)comp.uniforms.uRays.value=0;
        pass(comp,null);
      }};
  })();}catch(err){post=null;}

  /* ---------- ukuran dan tata letak ---------- */
  var aspect=1.6,crY=0,lavaPt=new THREE.Vector3(),mudPt=new THREE.Vector3();
  function resize(){
    var w=window.innerWidth,h=window.innerHeight;
    renderer.setPixelRatio(PR*Q);renderer.setSize(w,h,false);aspect=w/h;
    shared.uRes.value.set(w*PR*Q,h*PR*Q);shared.uPR.value=PR*Q;
    if(post)post.setSize(Math.round(w*PR*Q),Math.round(h*PR*Q));
    camera.aspect=aspect;camera.fov=aspect<1.2?38+(1.2-aspect)*34:38;camera.updateProjectionMatrix();
    coneX=aspect>=1.5?21:(aspect>=1.3?16:(aspect>=.9?8:0));
    towerX=-Math.max(5.5,Math.min(15,(22-R4.z)*Math.tan(camera.fov*Math.PI/360)*aspect*.66));
    volcano.position.x=coneX;
    skyU.uAspect.value=aspect;
    crY=VGY+volH(0,0)+.6;
    plumeU.uOrigin.value.set(coneX,crY,VZ+1);fallU.uOrigin.value.set(coneX,crY,VZ+1);bombU.uOrigin.value.set(coneX,crY,VZ+1);glow.position.set(coneX,crY,VZ+1);
    var th=chans[1][0],r=9;lavaPt.set(coneX+r*Math.cos(th),VGY+volH(r,th)+.3,VZ+r*Math.sin(th)*VSZ);
    th=chans[4][0];r=12;mudPt.set(coneX+r*Math.cos(th),VGY+volH(r,th)+.3,VZ+r*Math.sin(th)*VSZ);
    US.dirty=true;
  }
  window.addEventListener('resize',resize);resize();

  /* ---------- pointer ---------- */
  var ptr={x:0,y:0,sx:0,sy:0,on:false};
  window.addEventListener('pointermove',function(e){ptr.x=e.clientX/window.innerWidth*2-1;ptr.y=1-e.clientY/window.innerHeight*2;ptr.on=true;},{passive:true});
  window.addEventListener('pointerleave',function(){ptr.on=false;});
  window.addEventListener('blur',function(){ptr.on=false;});
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();});
  canvas.addEventListener('webglcontextrestored',function(){location.reload();});

  /* ---------- pembaruan uniform per frame ---------- */
  var treeTint=new THREE.Color(),tmpC=new THREE.Color(),hazeCol=new THREE.Color(),colA=new THREE.Color(),colB=new THREE.Color(),sunWarm=C(0xFF8A3A),sunWhite=C(0xFFF6E0),inkC=C(0x1d2a2e);
  var Ls=new THREE.Vector3(),Lm=new THREE.Vector3(),Lv=new THREE.Vector3(),pn=new THREE.Vector3(),pv=new THREE.Vector3();
  var mixc=function(out,a,b,t){return out.copy(a).lerp(b,t);};
  var suv=new THREE.Vector2(),muv=new THREE.Vector2();
  /* posisi benda langit di layar: arah dunia diproyeksikan lewat kamera, jadi ikut bergeser bersama bukit saat menggulir */
  function bodyUV(b,out){
    var halfH=Math.atan(Math.tan(camera.fov*Math.PI/360)*aspect),xa=b.cx*Math.min(.45,.85*halfH);
    var alt=b.e>=0?.3*Math.pow(b.e,.75):.17*b.e;
    pv.set(Math.tan(xa)*400,Math.tan(alt)*400,-400).add(camera.position).project(camera);
    out.set(pv.x*.5+.5,pv.y*.5+.5);
  }
  var WEATHER=[['rain','rain'],['storm','storm'],['snow','snow'],['autumn','autumn'],['sakura','sakura']];
  var pulse=1,vlT=0,nextVl=3,vlPos=new THREE.Vector3(),nightK=0,dl=1;
  function apply(time){
    var hz=Math.min(1,S.smoke*.9);
    hazeCol.copy(P.red).lerp(P.maroon,.5);
    var sb=skyBody(S.hour,0),mb=skyBody(S.hour,Math.PI),e=sb.e;dl=smoothstep01(-.12,.18,e);
    camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();bodyUV(sb,suv);bodyUV(mb,muv);
    todSpec(S.hour,cur);
    for(var wi=0;wi<WEATHER.length;wi++){var wv=S[WEATHER[wi][0]];if(wv>.002)lerpSpec(cur,SCN[WEATHER[wi][1]],Math.min(1,wv*dl),Math.min(1,wv));}
    var wth=Math.min(1,S.rain*.95+S.storm+S.snow*.6),sunVis=1-wth;nightK=smoothstep01(.08,-.15,e);
    mixc(colA,sunWhite,sunWarm,1-smoothstep01(0,.45,e));colA.multiplyScalar(.7+.3*smoothstep01(0,.3,e));
    skyU.uSunCol.value.copy(colA);skyU.uSun.value.copy(suv);shared.uSunCol.value.copy(colA);
    skyU.uSunR.value=(.024+.02*(1-smoothstep01(0,.4,e)))*sunVis*smoothstep01(-.1,0,e);
    skyU.uGlowK.value=cur.glow*(.15+.85*sunVis)*(e>-.3?1:0);
    skyU.uHorGlow.value=smoothstep01(.5,0,e)*smoothstep01(-.3,-.02,e)*(1-.85*wth);
    skyU.uMoon.value.set(muv.x,muv.y,.027*smoothstep01(-.04,.1,mb.e)*smoothstep01(.15,-.1,e)*(1-wth));
    skyU.uTop.value.copy(cur.top);skyU.uMid.value.copy(cur.mid);skyU.uBot.value.copy(cur.bot);
    skyU.uStars.value=cur.stars*(1-wth);skyU.uOver.value=cur.over;skyU.uOverCol.value.copy(cur.overCol);
    skyU.uCov.value=cur.cov;skyU.uCLit.value.copy(cur.c1);skyU.uCShade.value.copy(cur.c2);skyU.uCA.value=cur.cA;skyU.uAsh.value=S.ash*dl;
    skyU.uHazeCol.value.copy(hazeCol);skyU.uHaze.value=hz;
    /* pelangi di seberang matahari, hanya saat cuaca cerah (tanpa hujan, badai, salju, abu, asap) dan matahari tidak terlalu tinggi.
       Intensitas dan posisinya diredam eksponensial agar muncul, hilang, dan bergesernya mengalir pelan */
    /* gerbang matahari mengikuti jam secara langsung (jam sudah dihaluskan pegas), faktor cuaca diredam terpisah */
    var bowGate=dl*(1-nightK)*(1-smoothstep01(.7,1,e));
    var bowT=(1-smoothstep01(.05,.3,S.smoke))*(1-smoothstep01(.1,.4,S.ash))*(1-smoothstep01(.05,.35,S.snow))*(1-smoothstep01(.02,.25,S.storm))*(1-smoothstep01(.03,.3,S.rain))*(1-smoothstep01(.15,.45,S.fire*(1-S.out)));
    var bcxT=Math.max(.15,Math.min(.85,1-suv.x)),bcyT=.36-.3*Math.max(0,e);
    if(US.snapBow){bowA=bowT;bowCx=bcxT;bowCy=bcyT;US.snapBow=false;}
    bowA+=(bowT-bowA)*(1-Math.exp(-fdt*(bowT>bowA?.55:1.6)));bowCx+=(bcxT-bowCx)*(1-Math.exp(-fdt*.8));bowCy+=(bcyT-bowCy)*(1-Math.exp(-fdt*.8));
    bowU.uBow.value=bowA*bowA*(3-2*Math.min(1,bowA))*bowGate*.75;bowU.uBowC.value.set(bowCx,bowCy);bowU.uBowR.value=.62;
    bow.visible=bowU.uBow.value>.003;bow.position.x=camera.position.x;bow.position.y=camera.position.y;
    /* bayangan awan hanya saat cerah; cahaya tembus saat matahari rendah */
    shared.uCS.value=dl*sunVis*(1-hz)*smoothstep01(.2,.6,cur.cov+.1)*(1-S.ash*.5);
    shared.uBack.value=dl*sunVis*(1-hz*.7)*(.35+.65*(1-smoothstep01(.15,.6,e)));
    var fog=tmpC.copy(cur.fog).lerp(hazeCol,hz*.5);
    Ls.set(sb.cx*.9,Math.max(.12,e*.9+.1),.5);Lm.set(mb.cx*.9,Math.max(.2,mb.e*.8+.1),.5);Lv.copy(Ls).lerp(Lm,nightK).normalize();
    ridges.forEach(function(L){
      var t=L.t,u=L.u;
      mixc(u.uLit.value,cur.litFar,cur.litNear,Math.pow(t,.8));mixc(u.uDark.value,cur.darkFar,cur.darkNear,t);
      u.uFogK.value=Math.pow(1-t,1.35)*.88*(1+cur.over*.12);
      u.uFog.value.copy(fog);u.uHazeCol.value.copy(hazeCol);u.uHaze.value=hz;
      u.uLightDir.value.copy(Lv);u.uLightCol.value.copy(cur.lightCol).multiplyScalar(cur.lI*.6);mixc(u.uGrassA.value,cur.darkNear,cur.litNear,.5);u.uGrassA.value.multiplyScalar(1.05);mixc(u.uGrassB.value,cur.litNear,cur.lightCol,.34);u.uGrassB.value.multiplyScalar(1.12);
      u.uSnowK.value=S.snow;u.uNight.value=nightK;u.uWet.value=cur.wet;u.uSak.value=S.sakura;
    });
    grassU.forEach(function(g){g.uAut.value=S.autumn;});
    /* pohon: cahaya kunci + langit seperti warga, kabut makin tebal di lapis jauh */
    treeTint.copy(cur.lightCol).multiplyScalar(cur.lI*.72).add(colB.copy(cur.amb).multiplyScalar(cur.aI*.5));
    treeMeshes.forEach(function(tm){var u=tm.u;
      if(tm.sdf){mixc(u.uDark.value,cur.darkFar,cur.darkNear,tm.t);u.uDark.value.multiplyScalar(.8);mixc(u.uLit.value,cur.litFar,cur.litNear,tm.t);u.uLit.value.lerp(cur.darkNear,.25).multiplyScalar(1.05);
        u.uFog.value.copy(fog);u.uFogK.value=Math.pow(1-tm.t,1.35)*.88*(1+cur.over*.12);u.uSunX.value=Lv.x;u.uAut.value=S.autumn;u.uSak.value=S.sakura;u.uSnowK.value=S.snow;return;}
      u.uTint.value.copy(treeTint);u.uFog.value.copy(fog);u.uFogK.value=Math.pow(1-tm.t,1.35)*.88*(1+cur.over*.12);
      u.uSunX.value=Lv.x;u.uAut.value=S.autumn;u.uSak.value=S.sakura;u.uSnowK.value=S.snow;});
    volU.uLightDir.value.copy(Lv);
    volU.uLightCol.value.copy(cur.lightCol).multiplyScalar(cur.lI);volU.uAmb.value.copy(cur.amb).multiplyScalar(cur.aI);
    volU.uFog.value.copy(fog);volU.uHazeCol.value.copy(hazeCol);volU.uHaze.value=hz;volU.uFogK.value=cur.volFog;
    volU.uSnowLine.value=cur.snowLine;volU.uWet.value=cur.wet;volU.uSak.value=S.sakura;volU.uAshD.value=smoothstep01(.4,1,S.ash);
    volU.uLava.value=S.lava*(.38+.62*nightK);volU.uExt.value=S.ext;volU.uMud.value=S.mud;
    volU.uForestD.value.copy(FOREST_D0).lerp(AUT_D,S.autumn).lerp(SAK_D,S.sakura*.6);volU.uForestL.value.copy(FOREST_L0).lerp(AUT_L,S.autumn).lerp(SAK_L,S.sakura*.4);
    banks.forEach(function(m,i){var u=bankU[i];
      u.uLit.value.copy(cur.c1).lerp(fog,.12);u.uShade.value.copy(cur.c2).lerp(fog,.25);
      u.uAlpha.value=u.uBase.value*(.5+.5*cur.cov)*(1-.25*S.snow);u.uCov.value=cur.cov;u.uLX.value=-Lv.x*1.6;u.uLY.value=-.5;});
    /* kolom abu: uap putih saat tenang, abu gelap saat erupsi */
    var dk=smoothstep01(.25,.9,S.ash);
    mixc(plumeU.uShade.value,colB.copy(cur.c2).lerp(cur.c1,.35),cur.plumeShade,dk);
    mixc(plumeU.uLitC.value,cur.c1,cur.plumeLit,dk*.85);
    plumeU.uAsh.value=S.ash*(.45+.55*dk);plumeU.uH.value=2.8+(3.3*S.km-2.8)*S.ash;plumeU.uPulse.value=pulse;plumeU.uDark.value=dk;
    plumeU.uGlowK.value=Math.min(1,S.lava*(.12+.9*nightK))*Math.min(1,S.ash*1.4+.2);pyU.uGlowK.value=plumeU.uGlowK.value*.6;
    fallU.uAsh.value=S.ash;fallU.uH.value=plumeU.uH.value;fallU.uCol.value.copy(cur.plumeShade).multiplyScalar(1.2);
    glowU.uGlow.value=Math.min(1,S.lava*.7+S.ash*.2);glowU.uCol.value.copy(P.orange).lerp(P.gold,.25).multiplyScalar(1.3);
    bombU.uAct.value=Math.max(0,(S.ash-.5)*2)*Math.min(1,S.lava);
    fireU.uFire.value=S.fire;fireU.uOut.value=S.out;
    mixc(fireU.uSmokeShade.value,cur.plumeShade,P.maroon,.25);fireU.uSmokeLit.value.copy(cur.plumeLit);
    smokeU.uSmoke.value=S.smoke*(1-.55*S.out);
    moteU.uC1.value.copy(cur.litFar).lerp(cur.fog,.5);moteU.uC2.value.copy(P.orange).lerp(cur.litNear,1-Math.min(1,S.lava+S.fire));
    moteU.uMood.value=Math.min(1,S.lava*.5+S.fire*.6+S.ash*.4);moteU.uK.value=(1-Math.min(1,Math.max(cur.rain,cur.snow)))*(.25+.3*dl+.25*nightK)*(1-S.sakura*.6);
    rainU.uRain.value=cur.rain;snowU.uSnow.value=cur.snow;leafU.uLeaf.value=S.autumn;petalU.uPet.value=S.sakura;
    rain.visible=cur.rain>.01;snow.visible=cur.snow>.01;leaves.visible=S.autumn>.01;petals.visible=S.sakura>.01;
    birdU.uBird.value=dl*sunVis*(1-S.ash*.9)*(1-hz)*(1-S.snow)*(1-nightK);birds.visible=birdU.uBird.value>.01;
    birdU.uCol.value.copy(inkC).lerp(fog,.3);
    ffU.uFF.value=nightK*(1-Math.min(1,cur.rain+S.snow))*(1-S.ash*.6);fireflies.visible=ffU.uFF.value>.01;
    /* danau memantulkan langit saat ini */
    lakeU.uTop.value.copy(cur.mid).lerp(cur.top,.4);lakeU.uMid.value.copy(cur.mid);lakeU.uBot.value.copy(cur.bot).lerp(cur.fog,.3);
    lakeU.uFog.value.copy(fog);lakeU.uFogK.value=Math.pow(1-ridges[4].t,1.35)*.88;lakeU.uRain.value=Math.min(1,cur.rain);
    lakeU.uGlint.value=dl*sunVis*(1-hz);
    dolU.uA.value=dl*(1-nightK)*(1-hz)*(1-smoothstep01(.2,.5,S.ash))*(1-S.snow)*(1-smoothstep01(.1,.5,S.storm))*(1-smoothstep01(.15,.5,S.mud));
    dolU.uTint.value.copy(cur.lightCol).multiplyScalar(cur.lI*.75).add(colB.copy(cur.amb).multiplyScalar(cur.aI*.45));dolU.uWater.value.copy(cur.mid).lerp(lakeU.uTint.value,.45);lakeU.uShore.value.copy(cur.darkNear).lerp(cur.litNear,.35);
    pn.copy(lake.position).project(camera);var lsx=pn.x*.5+.5;pv.set(lake.position.x+4.5,lake.position.y,lake.position.z).project(camera);
    lakeU.uSunX.value=.5+(suv.x-lsx)/Math.max(.01,(pv.x*.5+.5-lsx)*2)*.5;
    tintC.copy(cur.litNear).lerp(WHITE,.55);props.forEach(function(m){m.material.color.copy(tintC);});
    /* warga: hanya saat terang, abu dan asap tipis, tanpa titik api. Saat hujan muncul adegan berpayung; badai dan lahar mengosongkan padang */
    var safe=(1-smoothstep01(.3,.6,S.ash))*(1-smoothstep01(.12,.4,S.smoke))*(1-smoothstep01(.2,.45,S.fire*(1-S.out)))*(1-nightK)*smoothstep01(.2,.6,dl)*(1-smoothstep01(.1,.4,S.storm));
    var calm=safe*(1-smoothstep01(.04,.3,S.rain))*(1-smoothstep01(.15,.4,S.mud));
    folkVis.rain=safe*smoothstep01(.4,.9,S.rain);
    folkVis.snow=calm*smoothstep01(.4,.9,S.snow);folkVis.autumn=calm*smoothstep01(.4,.9,S.autumn);folkVis.sakura=calm*smoothstep01(.4,.9,S.sakura);
    folkVis.sunrise=calm*smoothstep01(.4,.9,1-S.snow-S.autumn-S.sakura);
    folkVis.snowT=smoothstep01(.2,.8,S.snow);folkVis.night=nightK*(1-.6*S.ash)*(1-.5*cur.rain);
    folkTint.copy(cur.lightCol).multiplyScalar(cur.lI*.7).add(colB.copy(cur.amb).multiplyScalar(cur.aI*.5)).multiplyScalar(1.05);
    flowerTint.value.copy(folkTint);flowerU.forEach(function(u){u.uAut.value=S.autumn;});folkU.uFog.value.copy(fog);folkFogK.value=ridges[5].u.uFogK.value+.05+cur.over*.1;folkRim.value=shared.uBack.value*.8;
    /* arah sinar di layar untuk membentuk bayangan gumpalan abu */
    pn.set(coneX,crY+plumeU.uH.value*.4,VZ+1).project(camera);
    var tb=nightK>.5?muv:suv,dx=(tb.x-(pn.x*.5+.5))*aspect,dy=tb.y-(pn.y*.5+.5),ln=Math.sqrt(dx*dx+dy*dy)||1;
    plumeU.uSunDir.value.set(dx/ln,dy/ln);
    /* pascaproses mengikuti suasana */
    if(post){var cu=post.comp.uniforms;
      cu.uRays.value=dl*sunVis*(1-hz*.6)*cur.glow*(.25+.75*(1-smoothstep01(.15,.65,e)))*(suv.y>-.2&&suv.y<1.3?1:0)*.55;
      post.rays.uniforms.uSun.value.copy(suv);cu.uRayCol.value.copy(colA);
      cu.uBloom.value=.42+.35*nightK+.25*S.fire;
      cu.uSat.value=1.06-.12*wth-.06*S.snow+.04*S.sakura;
      cu.uGain.value.setRGB(1,1,1).lerp(cur.lightCol,.06);
      cu.uLift.value.copy(cur.fog).multiplyScalar(.035+.03*S.sakura);
      cu.uVig.value=.3+.15*nightK+.12*S.storm;cu.uGrain.value=mobile?.022:.032;
    }
  }

  /* titik jangkar anotasi (koordinat layar) */
  function anchor(k,v,on){pv.copy(v).project(camera);var a=US.anchors[k]||(US.anchors[k]={});a.x=(pv.x*.5+.5)*innerWidth;a.y=(-pv.y*.5+.5)*innerHeight;
    a.on=on&&pv.z<1&&pv.x>-.2&&pv.x<.96&&pv.y>-.9&&pv.y<.85;}
  var aV=new THREE.Vector3();

  /* ---------- loop (dipanggil dari js/page.js) ---------- */
  var last=performance.now(),time=reduce?7:0,flash=0,nextFlash=1.5,roll=0,lastDraw=0;
  US.frame=function(now){
    var dt=Math.min(.05,(now-last)/1000);last=now;fdt=reduce?1:dt;
    if(document.hidden)return;
    /* mode gerak dikurangi: gambar ulang hanya saat ada perubahan */
    if(reduce&&!US.dirty&&now-lastDraw<1000)return;
    US.dirty=false;lastDraw=now;
    emaDt+=(dt-emaDt)*.05;
    if(++fc%90===0&&!noAdapt){if(emaDt>.034&&Q>.5){Q=Math.max(.5,Q-.15);resize();}else if(emaDt<.018&&Q<1&&fc%360===0){Q=Math.min(1,Q+.1);resize();}}
    var k=1-Math.exp(-dt*2.2),kf=1-Math.exp(-dt*5);
    for(var ki=0;ki<KEYS.length;ki++){var n=KEYS[ki];S[n]+=(T[n]-S[n])*k;}
    if(US.snap){US.snap=false;S.hv=0;S.hour=T.hour;KEYS.forEach(function(n){S[n]=T[n];});}
    /* jam langit memakai pegas teredam agar perpindahan siang-malam mengalir */
    S.hv+=((T.hour-S.hour)*22-S.hv*9.4)*dt;S.hour+=S.hv*dt;US.hour=S.hour;
    S.km+=(T.km-S.km)*kf;S.wind+=(T.wind-S.wind)*kf;
    if(!reduce)time+=dt;
    pulse=.55+.45*Math.sin(time*.55)*Math.sin(time*.23+1.3);
    var flow=smoothstep01(.55,.95,S.ash)*Math.pow(Math.max(0,Math.sin(time*.31)*Math.sin(time*.17+2.1)+.6),.7);
    updatePyro(time,Math.min(1,flow*1.4));
    shared.uTime.value=time;shared.uWind.value=S.wind;
    /* hembusan angin: pelan saat cerah, kuat saat badai */
    shared.uGust.value=Math.min(1.6,(.35+.35*Math.sin(time*.37)*Math.sin(time*.13+1.7)+.3*Math.pow(Math.max(0,Math.sin(time*.21+.6)),6))*(1+S.storm*1.2+S.rain*.5));
    var tx=ptr.on?ptr.x:9,ty=ptr.on?ptr.y:9;
    shared.uPointer.value.x+=(tx-shared.uPointer.value.x)*(ptr.on?.25:.05);
    shared.uPointer.value.y+=(ty-shared.uPointer.value.y)*(ptr.on?.25:.05);
    if(!ptr.on&&Math.abs(shared.uPointer.value.x)>8)shared.uPointer.value.set(9,9);
    ptr.sx+=((ptr.on?ptr.x:0)-ptr.sx)*.035;ptr.sy+=((ptr.on?ptr.y:0)-ptr.sy)*.035;
    /* kamera: bergeser menyamping & maju sepanjang gulir (parallax antar lapisan bukit) + miring halus mengikuti kecepatan gulir */
    var sc=US.prog,drift=Math.sin(sc*Math.PI*3.5)*1.6;
    var vr=reduce?0:Math.max(-.025,Math.min(.025,-(US.vel||0)*.0004));roll+=(vr-roll)*.06;
    camera.position.set(ptr.sx*2.4+drift,3.2-sc*1.5+ptr.sy*.8,22-sc*4);
    camera.lookAt(ptr.sx*.5+drift*.45,4.8+S.ash*1.5-sc*.5-S.smoke*3.2+(aspect<1?(1-aspect)*10:0),0);
    camera.rotateZ(roll);
    var fv=0;
    if(!reduce&&S.storm>.5){
      if(time>nextFlash){flash=1;nextFlash=time+1.4+Math.random()*3.6;strike();if(window.HLAudio)window.HLAudio.thunder(S.storm);}
      flash*=Math.exp(-dt*6);fv=flash*(.65+.35*Math.sin(time*90));
    }else{flash*=Math.exp(-dt*10);fv=flash*.6;}
    skyU.uFlash.value=fv;boltM.opacity=Math.min(1,fv*1.4);shared.uFlash.value=fv*S.storm;
    if(!reduce&&S.ash>.7&&time>nextVl){vlT=1;nextVl=time+.8+Math.random()*3.5;var H=plumeU.uH.value;vlPos.set(coneX+(Math.random()-.5)*H*.2,crY+H*(.25+Math.random()*.5),VZ+2);vlight.position.copy(vlPos);}
    vlT*=Math.exp(-dt*9);vlU.uI.value=vlT*(.6+.4*Math.sin(time*80))*smoothstep01(.6,.9,S.ash);
    apply(time);folkFrame(Math.max(0,time));dolFrame(time);
    var H2=plumeU.uH.value;
    anchor('plume',aV.set(coneX+S.wind*H2*.16,crY+H2*.62,VZ+1),S.ash>.6);
    anchor('lava',lavaPt,volU.uLava.value>.5&&S.mud<.3&&S.ash<.6);
    anchor('mud',mudPt,S.mud>.55);
    anchor('lake',lake.position,S.ash>.6);
    anchor('fire',aV.set(fireSpot.x,fireSpot.y+1.2,fireSpot.z),S.fire>.6&&S.out<.5);
    if(post)post.render();else{renderer.setRenderTarget(null);renderer.render(scene,camera);}
  };
  KEYS.forEach(function(n){S[n]=T[n];});S.hour=T.hour;US.snapBow=true;
})();
