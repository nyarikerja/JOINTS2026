/* HelaLoka: suara suasana alam prosedural (Web Audio API), tanpa file eksternal.
   Lapisan menerus: angin (pink noise + embusan acak), gemuruh kawah (brown noise), guyuran hujan, deru api.
   Lapisan peristiwa (dijadwalkan acak): tetes hujan, kretek bara, jangkrik, kicau burung, denting lonceng angin, petir.
   Semua lewat reverb buatan + kompresor agar tidak pecah. Takaran tiap lapisan diatur di MIX. */
(function(){
  /* takaran volume tiap lapisan pada level 1 */
  var MIX={wind:.55,rumble:.9,rain:.32,roar:.22,drop:.05,crackle:.11,cricket:.018,bird:.025,chime:.03,thunder:.85};

  /* level tiap suasana (0..1), dicampur sesuai bobot cuaca dari js/page.js */
  var SCENE={
    sunrise:{wind:.35,rumble:.35,bird:1},
    noon:   {wind:.3, rumble:.6, bird:.35},
    autumn: {wind:.5, fire:.45,  bird:.2},
    sunset: {wind:.3, fire:1,    rumble:.15},
    night:  {wind:.18,cricket:1},
    rain:   {wind:.45,rain:1},
    storm:  {wind:1,  rain:1,    thunder:1},
    snow:   {wind:.7, chime:.6},
    sakura: {wind:.25,chime:1,   bird:.55}
  };
  var KEYS=['wind','rumble','rain','fire','cricket','bird','chime','thunder'];

  var ctx=null,master=null,bus=null,verb=null,isPlaying=false,timer=0,sleepT=0;
  var buf={},node={},lv={},sent={};
  var next={drop:0,crackle:0,cricket:0,bird:0,chime:0,thunder:0,gust:0};
  KEYS.forEach(function(k){lv[k]=0;});

  function rnd(a,b){return a+Math.random()*(b-a);}

  /* buffer noise stereo yang loop-nya mulus: ekor dicampur ke kepala supaya tidak ada klik */
  function noise(type,sec){
    var sr=ctx.sampleRate,n=Math.floor(sr*sec),fade=Math.floor(sr*.25),b=ctx.createBuffer(2,n,sr);
    for(var c=0;c<2;c++){
      var tmp=new Float32Array(n+fade),b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0,peak=0,i,w;
      for(i=0;i<n+fade;i++){
        w=Math.random()*2-1;
        if(type==='pink'){
          b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;
          b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
          tmp[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926;
        }else if(type==='brown'){last=(last+.02*w)/1.02;tmp[i]=last;}
        else tmp[i]=w;
      }
      for(i=0;i<fade;i++){var f=i/fade;tmp[i]=tmp[i]*f+tmp[n+i]*(1-f);}
      for(i=0;i<n;i++)if(Math.abs(tmp[i])>peak)peak=Math.abs(tmp[i]);
      var d=b.getChannelData(c),g=.9/(peak||1);
      for(i=0;i<n;i++)d[i]=tmp[i]*g;
    }
    return b;
  }

  /* respons impuls reverb: noise stereo yang meluruh, kesan lembah terbuka */
  function impulse(sec){
    var sr=ctx.sampleRate,n=Math.floor(sr*sec),b=ctx.createBuffer(2,n,sr);
    for(var c=0;c<2;c++){var d=b.getChannelData(c);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2);}
    return b;
  }

  function loop(b){var s=ctx.createBufferSource();s.buffer=b;s.loop=true;s.loopStart=0;s.start(0,Math.random()*b.duration);return s;}
  function filt(type,f,q){var x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q!=null)x.Q.value=q;return x;}
  function gain(v){var g=ctx.createGain();g.gain.value=v;return g;}
  function chain(){for(var i=0;i<arguments.length-1;i++)arguments[i].connect(arguments[i+1]);return arguments[arguments.length-1];}
  function pan(p){if(ctx.createStereoPanner){var s=ctx.createStereoPanner();s.pan.value=p;return s;}return gain(1);}

  function init(){
    if(ctx)return;
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    try{
      ctx=new AC();
      ctx.onstatechange=function(){
        if(ctx.state==='running'&&isPlaying){
          var t=ctx.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(master.gain.value, t);
          master.gain.setTargetAtTime(.85,t,.35);
          sent={};
          if(window.US&&window.US.T)update(window.US.T);
          if(!timer)timer=setInterval(tick,50);
        }
        window.dispatchEvent(new CustomEvent('hlaudio:state', { detail: { state: ctx.state } }));
      };
    }catch(e){return;}

    var comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-18;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.01;comp.release.value=.3;
    master=gain(0);bus=gain(1);
    chain(bus,comp,master,ctx.destination);
    verb=ctx.createConvolver();verb.buffer=impulse(3.2);
    chain(verb,gain(.55),bus);

    buf.pink=noise('pink',6);buf.brown=noise('brown',8);buf.white=noise('white',2);

    /* angin: pink noise lewat bandpass yang digeser embusan acak */
    node.windF=filt('bandpass',420,.9);node.windGust=gain(.7);node.wind=gain(0);
    chain(loop(buf.pink),filt('lowpass',2200),node.windF,node.windGust,node.wind,bus);
    node.wind.connect(verb);

    /* gemuruh kawah: brown noise rendah, cukup tinggi agar masih terdengar di speaker laptop */
    node.rumbleF=filt('lowpass',180,.7);node.rumble=gain(0);
    chain(loop(buf.brown),node.rumbleF,filt('highpass',38),node.rumble,bus);

    /* guyuran hujan: pink noise terang tanpa dengung rendah */
    node.rain=gain(0);
    chain(loop(buf.pink),filt('highpass',650),filt('lowpass',7500),filt('peaking',3200,.8),node.rain,bus);

    /* deru api: desis hangat di bawah kretek bara */
    node.roar=gain(0);
    chain(loop(buf.brown),filt('bandpass',320,.6),node.roar,bus);

    document.addEventListener('visibilitychange',function(){
      if(!ctx||!isPlaying)return;
      if(document.hidden)ctx.suspend();else ctx.resume();
    });
  }

  /* ---------- peristiwa sesaat ---------- */
  function burst(t,dur,type,f,q,amp,p,wet){
    var s=ctx.createBufferSource();s.buffer=buf.white;
    var g=gain(0);g.gain.setValueAtTime(amp,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    var out=chain(s,filt(type,f,q),g,pan(p));out.connect(bus);if(wet)out.connect(verb);
    s.start(t,Math.random()*1.5,dur+.02);
  }
  function tone(t,f,dur,amp,p,wet,f2){
    var o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(f,t);
    if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
    var g=gain(0);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+Math.min(.006,dur*.2));
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    var out=chain(o,g,pan(p));out.connect(bus);if(wet)out.connect(verb);
    o.start(t);o.stop(t+dur+.02);
  }

  /* tetes hujan: ketukan noise pendek beresonansi di atap dan daun */
  function drop(t){burst(t,rnd(.008,.03),'bandpass',rnd(1800,6500),rnd(4,12),MIX.drop*lv.rain*rnd(.3,1),rnd(-.9,.9),false);}

  /* kretek bara: letupan sangat pendek, sering datang bergerombol */
  function crackle(t){
    var n=Math.random()<.3?Math.floor(rnd(2,6)):1;
    for(var i=0;i<n;i++){var a=Math.pow(Math.random(),2.2);
      burst(t+i*rnd(.006,.04),rnd(.003,.012),'highpass',rnd(1200,3500),.7,MIX.crackle*lv.fire*(.15+a),rnd(-.7,.7),false);}
  }

  /* jangkrik: 3-4 denyut cepat pada nada tinggi */
  function cricket(t){
    var f=rnd(4300,4900),p=rnd(-.8,.8),n=Math.random()<.5?3:4;
    for(var i=0;i<n;i++)tone(t+i*.032,f,.022,MIX.cricket*lv.cricket,p,true);
  }

  /* kicau burung: 2-5 siulan pendek yang naik-turun */
  function bird(t){
    var base=rnd(2400,3600),p=rnd(-.8,.8),n=Math.floor(rnd(2,6)),up=Math.random()<.5;
    for(var i=0;i<n;i++){var f=base*rnd(.9,1.15);
      tone(t+i*rnd(.09,.16),f,rnd(.05,.11),MIX.bird*lv.bird*rnd(.6,1),p,true,up?f*1.35:f*.72);}
  }

  /* lonceng angin pentatonik dengan partial inharmonik khas logam */
  var PENTA=[1174.66,1318.51,1479.98,1760,1975.53,2349.32,2637.02];
  function chime(t){
    var f=PENTA[Math.floor(Math.random()*PENTA.length)],p=rnd(-.6,.6),a=MIX.chime*lv.chime*rnd(.5,1);
    tone(t,f,rnd(2.2,3.6),a,p,true);
    tone(t,f*2.76,1.2,a*.25,p,true);
    tone(t,f*5.4,.5,a*.08,p,true);
  }

  /* petir: retakan (kalau dekat) lalu gemuruh bergulung beberapa gelombang */
  function thunder(t,near){
    if(near==null)near=Math.random()<.35;
    var dur=rnd(3,5.5),s=ctx.createBufferSource();s.buffer=buf.brown;
    var f=filt('lowpass',near?900:420,.5),g=gain(0);
    f.frequency.setValueAtTime(near?900:420,t);f.frequency.exponentialRampToValueAtTime(90,t+dur);
    var a=MIX.thunder*lv.thunder*(near?1:.6),k=t;
    g.gain.setValueAtTime(.0001,t);
    for(var i=0;i<3;i++){k+=rnd(.15,.6);g.gain.exponentialRampToValueAtTime(a*rnd(.5,1),k);k+=rnd(.3,.8);g.gain.exponentialRampToValueAtTime(a*rnd(.15,.35),k);}
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    var out=chain(s,f,g,pan(rnd(-.5,.5)));out.connect(bus);out.connect(verb);
    s.start(t,Math.random()*2,dur+.1);
    if(near)burst(t,.25,'lowpass',4000,.5,MIX.thunder*lv.thunder*.5,rnd(-.4,.4),true);
  }

  /* penjadwal: dicek tiap 50 ms, peristiwa dijadwalkan sedikit di depan currentTime */
  function tick(){
    if(!isPlaying||ctx.state!=='running')return;
    var now=ctx.currentTime,t=now+.05;

    if(now>=next.gust){
      next.gust=now+rnd(1.5,4.5);
      node.windGust.gain.setTargetAtTime(rnd(.35,1),now,rnd(.6,1.6));
      node.windF.frequency.setTargetAtTime(rnd(280,700)+lv.thunder*250,now,rnd(.8,2));
    }
    if(lv.rain>.02&&now>=next.drop){drop(t);next.drop=now+rnd(.01,.09)/lv.rain;}
    if(lv.fire>.02&&now>=next.crackle){crackle(t);next.crackle=now+rnd(.02,.35)/lv.fire;}
    if(lv.cricket>.05&&now>=next.cricket){cricket(t);next.cricket=now+rnd(.35,1.1);}
    if(lv.bird>.05&&now>=next.bird){bird(t);next.bird=now+rnd(1.2,4.5)/lv.bird;}
    if(lv.chime>.05&&now>=next.chime){chime(t);next.chime=now+rnd(.9,3.5)/lv.chime;}
    /* cadangan bila petir visual tidak jalan (mis. reduced motion): guntur dijadwalkan sendiri */
    if(lv.thunder>.3&&now>=next.thunder){thunder(t);next.thunder=now+rnd(7,18);}
  }

  /* ---------- level menerus mengikuti suasana ---------- */
  function setLevel(name,v,tc){
    if(sent[name]!=null&&Math.abs(sent[name]-v)<.004)return;
    sent[name]=v;node[name].gain.setTargetAtTime(v,ctx.currentTime,tc);
  }

  function update(T){
    if(!ctx||!isPlaying||!T)return;
    var w={},sc=T.scene||'sunrise',wsum=0;
    ['rain','storm','snow','autumn','sakura'].forEach(function(k){w[k]=T[k]||0;wsum+=w[k];});
    /* suasana tanpa bobot cuaca (fajar, siang, senja, malam) mengisi sisa bobotnya */
    if(!(sc in w))w[sc]=Math.max(0,1-wsum);
    KEYS.forEach(function(k){
      var v=0;for(var s in w){if(w[s]&&SCENE[s]&&SCENE[s][k])v+=SCENE[s][k]*w[s];}
      lv[k]=v;
    });
    lv.rumble=Math.min(1,lv.rumble+(T.ash||0)*.6+(T.lava||0)*.2);
    lv.fire=Math.min(1,lv.fire+(T.fire||0)*.5+(T.smoke||0)*.2);

    setLevel('wind',MIX.wind*lv.wind,.9);
    setLevel('rumble',MIX.rumble*lv.rumble,1.2);
    setLevel('rain',MIX.rain*lv.rain,1);
    setLevel('roar',MIX.roar*lv.fire,1);
  }

  function start(){
    init();
    if(!ctx)return false;
    isPlaying=true;
    clearTimeout(sleepT);
    sent={};
    function onStart(){
      if(ctx.state==='running'){
        var t=ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.setTargetAtTime(.85,t,.35);
        sent={};
        if(window.US&&window.US.T)update(window.US.T);
        if(!timer)timer=setInterval(tick,50);
      }
    }
    if(ctx.state!=='running'){
      ctx.resume().then(onStart).catch(function(){});
    }else{
      onStart();
    }
    return isPlaying;
  }

  function resume(){
    if(!ctx)init();
    if(!ctx)return;
    isPlaying=true;
    clearTimeout(sleepT);
    sent={};
    function onResume(){
      if(ctx.state==='running'){
        var t=ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.setTargetAtTime(.85,t,.35);
        sent={};
        if(window.US&&window.US.T)update(window.US.T);
        if(!timer)timer=setInterval(tick,50);
      }
    }
    if(ctx.state!=='running'){
      ctx.resume().then(onResume).catch(function(){});
    }else{
      onResume();
    }
  }

  function stop(){
    if(!ctx||!isPlaying)return false;
    isPlaying=false;
    clearTimeout(sleepT);
    var now=ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0,now,.25);
    clearInterval(timer);timer=0;
    sleepT=setTimeout(function(){if(!isPlaying&&ctx)ctx.suspend().catch(function(){});},1200);
    return false;
  }

  function toggle(){
    if(!isPlaying||!ctx||ctx.state!=='running'){
      return start();
    }
    return stop();
  }

  /* dipanggil js/scene.js tiap kali petir menyambar: guntur menyusul kilatan sesuai jarak.
     Sambaran rapat diperkecil agar gemuruh yang bertumpuk tidak menenggelamkan suara lain */
  var lastBolt=0;
  function strike(k){
    if(!ctx||!isPlaying||ctx.state!=='running')return;
    var now=ctx.currentTime,near=Math.random()<.35,gap=now-lastBolt;
    lastBolt=now;next.thunder=now+20;
    var save=lv.thunder;lv.thunder=Math.max(.4,Math.min(1,k||1))*(gap<2.5?.55:1);
    thunder(now+(near?rnd(.05,.25):rnd(.6,1.8)),near);
    lv.thunder=save;
  }

  /* klik UI: ketukan kayu kecil */
  function playClick(){
    if(!ctx||!isPlaying)return;
    var t=ctx.currentTime;
    tone(t,1250,.045,.05,0,false,700);
    burst(t,.012,'bandpass',2600,3,.04,0,false);
  }

  function isLive(){return isPlaying&&!!ctx&&ctx.state==='running';}
  function getState(){return ctx?ctx.state:'uninitialized';}
  window.HLAudio={init:init,start:start,resume:resume,stop:stop,toggle:toggle,update:update,playClick:playClick,thunder:strike,isPlaying:function(){return isPlaying;},isLive:isLive,getState:getState};
})();
