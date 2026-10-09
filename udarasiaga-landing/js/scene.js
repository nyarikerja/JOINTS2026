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

  /* ---------- pohon: tajuk berumpun, transparan dengan tepi halus (tanpa alphaToCoverage yang menimbulkan garis) ---------- */
  var treeMeshes=[];
  function rnd(seed){var s=seed;return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}
  var treeV='attribute vec2 aUV;attribute vec3 aI;uniform float uTime,uWind,uGust;varying vec2 vUv;varying vec3 vI;varying float vWX;void main(){vUv=aUV;vI=aI;vec3 q=position;float sw=sin(uTime*1.4+position.x*.7+aI.y*9.)+.5*sin(uTime*2.7+aI.y*17.);q.x+=(sw*(.05+.07*uGust)+uWind*.06*uGust)*aUV.y*aUV.y;vWX=q.x;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(q,1.);}';
  var treeF=[
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
    'float tw=(vI.x<.5?.05:.07+.02*(1.-y));float tr=smoothstep(aa,-aa,abs(x)-tw)*step(y,vI.x<.5?.2:.42);float trunkOnly=tr*(1.-a);',
    'float al=max(a,trunkOnly);if(al<.01)discard;',
    'float s=sign(uSunX+1e-4);vec2 Ld=normalize(vec2(s*.55,.75));float nl=dot(normalize(nrm+1e-4),Ld)*.5+.5;',
    'float cl=mix(.5,tn(q*11.+sd*5.),FD(11.));float clump=tf(q*2.);float l=nl*.62+clump*.35+(cl-.5)*.5*(.4+.6*FD(11.))-.12;',
    'l*=.62+.38*smoothstep(.12,.7,y);if(vI.x<.5)l-=.2*(1.-smoothstep(0.,.5,tier));',
    'l-=smoothstep(.0,-.35,sdf)*.18*(1.-nl);l+=step(.8,cl)*.18*nl;l=clamp(l,0.,1.);',
    'vec3 c=mix(uDark,uLit,l);c*=vec3(.88+.24*sd,.94+.12*fract(sd*7.),.82+.26*fract(sd*3.));c+=vec3(.1,.09,0.)*smoothstep(.65,1.,l);',
    'float ak=th(vec2(sd*7.1,3.3));vec3 rd1=c*vec3(1.15,.55,.4)+vec3(.1,0.,0.);vec3 yl=c*vec3(1.2,1.05,.55)+vec3(.06,.05,0.);c=mix(c,rd1,uAut*step(.62,ak));c=mix(c,yl,uAut*step(ak,.28));',
    'if(vI.x<.5)c=mix(c,vec3(.1,.28,.14)*(.5+l),uAut*.85);',
    /* sakura: tajuk bulat jadi merah jambu bergradasi, sebagian hampir putih */
    'if(vI.x>=.5&&uSak>.001){float bk=th(vec2(sd*3.7,1.1));vec3 pd=mix(vec3(.74,.36,.5),vec3(.66,.42,.46),bk);vec3 pl=mix(vec3(1.,.82,.88),vec3(1.,.95,.96),bk*bk);',
    'vec3 bl=mix(pd,pl,smoothstep(.05,.9,l));bl=mix(bl,vec3(1.,.97,.98),step(.78,cl)*.55*nl);c=mix(c,bl,uSak);}',
    'c*=.84+.09*lay;',
    'c=mix(c,vec3(.93,.95,.98),uSnowK*smoothstep(.4,.8,nl+(cl-.5)*.6)*smoothstep(.15,.5,y)*.8);',
    'float bark=.5+.7*tn(vec2(x*20.,y*4.));c=mix(c,uTrunk*bark*(.6+.5*nl),trunkOnly);',
    /* cahaya tembus di tepi tajuk saat matahari rendah (backlight) */
    'c+=uSunCol*smoothstep(-.1,0.,sdf)*uBack*.5*(.4+.6*nl)*(1.-trunkOnly);c+=uSunCol*uBack*.05;',
    'c*=1.-cloudShadow(vec2(vWX,uZ*2.))*.3*(1.-uFogK);',
    'c+=vec3(.55,.6,.75)*uFlash*.2;',
    'c=mix(c,uFog,uFogK);gl_FragColor=vec4(c,al);}'
  ].join('\n');
  function buildTrees(L,idx,count,hmin,hmax,xr,roundK,seed,skipC){
    var R=rnd(seed),quads=[],cl=[],nc=Math.max(3,Math.round(count/14));
    for(var c=0;c<nc;c++)cl.push((R()*2-1)*xr);
    for(var n=0;n<count;n++){
      var x=R()<.75?cl[Math.floor(R()*nc)]+(R()+R()+R()-1.5)*xr*.16:(R()*2-1)*xr;
      if(skipC&&Math.abs(x)<skipC)x+=(x<0?-1:1)*skipC;
      var y0=heightJS(L,x)-.18,rd=R()<roundK,hh=hmin+Math.pow(R(),1.6)*(hmax-hmin),w=hh*(rd?.95:.46),sd=R();
      for(var ly=0;ly<(rd?3:1);ly++){var sc=[1,.86,.7][ly],ww=w*sc,h2=hh*sc,z=sd*.35+(ly-1)*.12;
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
    var m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:treeV,fragmentShader:treeF,transparent:true,depthWrite:true,extensions:{derivatives:true}}));
    m.position.z=L.z+.5;m.frustumCulled=false;m.renderOrder=idx;scene.add(m);
    treeMeshes.push({u:u,t:L.t,L:L});
  }
  buildTrees(ridges[2],2,260,1.0,2.0,60,.1,11,0);
  buildTrees(ridges[3],3,170,1.4,2.8,50,.3,23,0);
  buildTrees(ridges[4],4,80,2.0,3.8,34,.35,37,6);
  buildTrees(ridges[5],5,14,3.2,5.2,19,.4,51,8);

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

  /* ---------- warga di padang (js/folk.js): satu adegan per musim, hanya keluar saat cuaca dan udara aman ---------- */
  var FG=window.FOLK?window.FOLK.build():{},folk=[],folkG={},folkTint=new THREE.Color(),folkFogK={value:0},folkRim={value:0},folkGY=heightJS(R5,0),FS=mobile?1.25:1.5;
  var folkU={uTint:{value:folkTint},uFog:{value:new THREE.Color()},uFogK:folkFogK,uRim:folkRim,uZ:{value:R5.z},uSunCol:shared.uSunCol,uFlash:shared.uFlash,uCS:shared.uCS,uTime:shared.uTime,uWind:shared.uWind};
  var folkV='varying vec2 vUv;varying float vWX;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWX=w.x;gl_Position=projectionMatrix*viewMatrix*w;}';
  /* tekstur premultiplied; tepi yang menghadap matahari diberi cahaya tembus (rim) */
  var folkF=['uniform sampler2D tA,tB;uniform float uMix,uA,uFogK,uRim,uFlash,uZ,uTime,uWind;uniform vec3 uTint,uFog,uSunCol;uniform vec2 uRimD;varying vec2 vUv;varying float vWX;',CSH,
    'void main(){vec4 c=mix(texture2D(tA,vUv),texture2D(tB,vUv),uMix);if(c.a<.004)discard;',
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
        e.mesh=new THREE.Line(lg,e.mat);e.mesh.frustumCulled=false;e.mesh.renderOrder=5.9;e.mesh.visible=false;scene.add(e.mesh);folk.push(e);return;
      }
      var fr=Array.isArray(e.c)?e.c:[e.c],c0=fr[0];
      var geo=new THREE.PlaneGeometry(c0.w,c0.h);geo.translate(c0.w/2-c0.ax,c0.h/2-c0.ay,0);
      var u=Object.assign({tA:{value:folkTex(c0)},tB:{value:folkTex(c0)},uMix:{value:0},uA:{value:0},uRimD:{value:new THREE.Vector2()}},folkU);
      var m=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:folkV,fragmentShader:folkF,transparent:true,depthWrite:false,premultipliedAlpha:true,
        blending:e.add?THREE.AdditiveBlending:THREE.NormalBlending,side:THREE.DoubleSide}));
      m.frustumCulled=false;m.renderOrder=5.6+e.z*.1;m.visible=false;scene.add(m);
      e.mesh=m;e.u=u;e.rk=[2.5/c0.width,1.5/c0.height];folk.push(e);
    });
  });
  var folkVis={sunrise:0,autumn:0,snow:0,sakura:0,rain:0};
  function folkFrame(t){
    for(var i=0;i<folk.length;i++){var e=folk[i],v=folkVis[e.key];
      if(v<.004){e.mesh.visible=false;continue;}
      if(e.upd)e.upd(t,e,folkW);
      var a=v*(e.a==null?1:e.a)*(e.vis==null?1:e.vis);
      if(e.line){
        var p=e.pos,a0=e.a0,a1=e.a1,mx=(a0[0]+a1[0])/2,my=(a0[1]+a1[1])/2-(e.sag||0);
        for(var k=0;k<24;k++){var s=k/23,s1=1-s;p[k*3]=s1*s1*a0[0]+2*s1*s*mx+s*s*a1[0];p[k*3+1]=s1*s1*a0[1]+2*s1*s*my+s*s*a1[1];p[k*3+2]=R5.z+.28;}
        e.mesh.geometry.attributes.position.needsUpdate=true;e.mat.opacity=a;e.mesh.visible=a>.004;continue;
      }
      var fr=Array.isArray(e.c)?e.c:[e.c],n=fr.length,f=e.f||0,ia=(Math.floor(f)%n+n)%n,ib=e.fade?(ia+1)%n:ia;
      e.u.tA.value=folkTex(fr[ia]);e.u.tB.value=folkTex(fr[ib]);e.u.uMix.value=e.fade?f-Math.floor(f):0;e.u.uA.value=a;
      var fl=e.flip||1,ss=e.s*FS,wx=e.x*FS,gy=e.follow?heightJS(R5,wx):folkGY;
      e.wx=wx+(e.ox||0)*ss;e.wy=gy-e.dy+(e.oy||0)*ss;
      e.mesh.position.set(e.wx,e.wy,R5.z+e.z);e.mesh.rotation.z=e.rot||0;
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
  var tmpC=new THREE.Color(),hazeCol=new THREE.Color(),colA=new THREE.Color(),colB=new THREE.Color(),sunWarm=C(0xFF8A3A),sunWhite=C(0xFFF6E0),inkC=C(0x1d2a2e);
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
    treeMeshes.forEach(function(tm){var u=tm.u;mixc(u.uDark.value,cur.darkFar,cur.darkNear,tm.t);u.uDark.value.multiplyScalar(.8);mixc(u.uLit.value,cur.litFar,cur.litNear,tm.t);u.uLit.value.lerp(cur.darkNear,.25).multiplyScalar(1.05);
      u.uFog.value.copy(fog);u.uFogK.value=Math.pow(1-tm.t,1.35)*.88*(1+cur.over*.12);u.uSunX.value=Lv.x;u.uAut.value=S.autumn;u.uSak.value=S.sakura;u.uSnowK.value=S.snow;});
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
    lakeU.uGlint.value=dl*sunVis*(1-hz);lakeU.uShore.value.copy(cur.darkNear).lerp(cur.litNear,.35);
    pn.copy(lake.position).project(camera);var lsx=pn.x*.5+.5;pv.set(lake.position.x+4.5,lake.position.y,lake.position.z).project(camera);
    lakeU.uSunX.value=.5+(suv.x-lsx)/Math.max(.01,(pv.x*.5+.5-lsx)*2)*.5;
    tintC.copy(cur.litNear).lerp(WHITE,.55);props.forEach(function(m){m.material.color.copy(tintC);});
    /* warga: hanya saat terang, abu dan asap tipis, tanpa titik api. Saat hujan muncul adegan berpayung; badai dan lahar mengosongkan padang */
    var safe=(1-smoothstep01(.3,.6,S.ash))*(1-smoothstep01(.12,.4,S.smoke))*(1-smoothstep01(.2,.45,S.fire*(1-S.out)))*(1-nightK)*smoothstep01(.2,.6,dl)*(1-smoothstep01(.1,.4,S.storm));
    var calm=safe*(1-smoothstep01(.04,.3,S.rain))*(1-smoothstep01(.15,.4,S.mud));
    folkVis.rain=safe*smoothstep01(.4,.9,S.rain);
    folkVis.snow=calm*smoothstep01(.4,.9,S.snow);folkVis.autumn=calm*smoothstep01(.4,.9,S.autumn);folkVis.sakura=calm*smoothstep01(.4,.9,S.sakura);
    folkVis.sunrise=calm*smoothstep01(.4,.9,1-S.snow-S.autumn-S.sakura);
    folkTint.copy(cur.lightCol).multiplyScalar(cur.lI*.7).add(colB.copy(cur.amb).multiplyScalar(cur.aI*.5)).multiplyScalar(1.05);
    folkU.uFog.value.copy(fog);folkFogK.value=ridges[5].u.uFogK.value+.05+cur.over*.1;folkRim.value=shared.uBack.value*.8;
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
    var dt=Math.min(.05,(now-last)/1000);last=now;
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
      if(time>nextFlash){flash=1;nextFlash=time+1.4+Math.random()*3.6;strike();}
      flash*=Math.exp(-dt*6);fv=flash*(.65+.35*Math.sin(time*90));
    }else{flash*=Math.exp(-dt*10);fv=flash*.6;}
    skyU.uFlash.value=fv;boltM.opacity=Math.min(1,fv*1.4);shared.uFlash.value=fv*S.storm;
    if(!reduce&&S.ash>.7&&time>nextVl){vlT=1;nextVl=time+.8+Math.random()*3.5;var H=plumeU.uH.value;vlPos.set(coneX+(Math.random()-.5)*H*.2,crY+H*(.25+Math.random()*.5),VZ+2);vlight.position.copy(vlPos);}
    vlT*=Math.exp(-dt*9);vlU.uI.value=vlT*(.6+.4*Math.sin(time*80))*smoothstep01(.6,.9,S.ash);
    apply(time);folkFrame(Math.max(0,time));
    var H2=plumeU.uH.value;
    anchor('plume',aV.set(coneX+S.wind*H2*.16,crY+H2*.62,VZ+1),S.ash>.6);
    anchor('lava',lavaPt,volU.uLava.value>.5&&S.mud<.3&&S.ash<.6);
    anchor('mud',mudPt,S.mud>.55);
    anchor('lake',lake.position,S.ash>.6);
    anchor('fire',aV.set(fireSpot.x,fireSpot.y+1.2,fireSpot.z),S.fire>.6&&S.out<.5);
    if(post)post.render();else{renderer.setRenderTarget(null);renderer.render(scene,camera);}
  };
  KEYS.forEach(function(n){S[n]=T[n];});S.hour=T.hour;
})();
