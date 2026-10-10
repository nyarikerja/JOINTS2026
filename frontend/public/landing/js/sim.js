/* HelaLoka: simulasi ensemble di peta ilustrasi (canvas 2D).
   24 anggota ensemble, angin diganggu acak, partikel diintegrasikan dengan RK2. Skenario bisa dibagikan lewat ?sim=... */
(function(){
  var cv=document.getElementById('sim');if(!cv||!cv.getContext)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx=cv.getContext('2d'),base=document.createElement('canvas'),bx=base.getContext('2d');
  var GW=96,GH=60,KMW=240,KMH=KMW*GH/GW,M=24,NPART=200;
  var st={dir:80,spd:18,H:5,seed:7},src={x:.26,y:.58};
  var prob=new Float32Array(GW*GH);
  var INK='#16302A',PAPER='#F6F0E2';
  var fmt=function(n,d){return n.toLocaleString('id-ID',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});};
  function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function gauss(r){var u=1-r(),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);}
  var el=function(i){return document.getElementById(i);};

  /* skenario dari tautan bersama */
  (function(){
    var q=(location.search.match(/[?&]sim=([^&#]+)/)||[])[1];if(!q)return;
    var v=decodeURIComponent(q).split(',').map(Number);if(v.length<6||v.some(isNaN))return;
    st.dir=Math.round(v[0])%360;st.spd=Math.min(40,Math.max(5,v[1]));st.H=Math.min(15,Math.max(1,v[2]));st.seed=v[3]|0;
    src.x=Math.min(.96,Math.max(.04,v[4]));src.y=Math.min(.94,Math.max(.06,v[5]));
    el('sDir').value=st.dir;el('sSpd').value=st.spd;el('sH').value=st.H;
  })();

  /* fasilitas contoh */
  var fr=mul(42),schools=[],hosp=[];
  for(var i=0;i<14;i++)schools.push({x:.06+.88*fr(),y:.1+.8*fr(),p:0,id:String.fromCharCode(65+i)});
  [[.14,.2],[.52,.86],[.9,.18]].forEach(function(h){hosp.push({x:h[0],y:h[1],p:0});});

  function compute(){
    var r=mul(st.seed),NC=GW*GH,cnt=new Uint8Array(NC),seen=new Int16Array(NC).fill(-1);
    /* waktu tiba abu pertama (jam) per anggota per sel, untuk tabel prioritas sekolah */
    var arr=new Float32Array(M*NC).fill(Infinity);
    var sx=src.x*KMW,sy=(1-src.y)*KMH,tmax=2+st.H*.75,sig0=2+st.H*.6;
    for(var m=0;m<M;m++){
      var th=(st.dir+gauss(r)*14)*Math.PI/180,sp=Math.max(2,st.spd*(1+gauss(r)*.2)),ph=r()*6.283;
      for(var p=0;p<NPART;p++){
        var tau=.3+r()*tmax,n=14,dt=tau/n,sg=sig0*Math.sqrt(dt),x=sx,y=sy;
        for(var s=0;s<n;s++){
          var a1=th+.25*Math.sin(x*.035+y*.028+ph),mx=x+sp*Math.sin(a1)*dt*.5,my=y+sp*Math.cos(a1)*dt*.5;
          var a2=th+.25*Math.sin(mx*.035+my*.028+ph);
          x+=sp*Math.sin(a2)*dt+gauss(r)*sg;y+=sp*Math.cos(a2)*dt+gauss(r)*sg;
          var cx=(x/KMW*GW)|0,cy=((KMH-y)/KMH*GH)|0;
          if(x>=0&&y>=0&&cx<GW&&cy>=0&&cy<GH){var c=cy*GW+cx,ai=m*NC+c,tt=(s+1)*dt;if(seen[c]!==m){seen[c]=m;cnt[c]++;}if(tt<arr[ai])arr[ai]=tt;}
        }
      }
    }
    for(var q=0;q<prob.length;q++)prob[q]=cnt[q]/M;
    function cell(f){return Math.min(GH-1,(f.y*GH)|0)*GW+Math.min(GW-1,(f.x*GW)|0);}
    schools.forEach(function(f){
      var c=cell(f),ts=[];for(var mm=0;mm<M;mm++){var v=arr[mm*NC+c];if(v<Infinity)ts.push(v);}
      ts.sort(function(a,b){return a-b;});
      f.p=prob[c];f.t50=ts.length?ts[(ts.length-1)>>1]:null;f.tmin=ts.length?ts[0]:null;
    });
    hosp.forEach(function(f){f.p=prob[cell(f)];});
  }

  var W=0,H=0,DPR=1;
  function drawBase(){
    var cw=W/GW,ch=H/GH;
    var g=bx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#F4EEDC');g.addColorStop(1,'#D6E8D8');
    bx.fillStyle=g;bx.fillRect(0,0,W,H);
    /* kontur dekoratif ala peta topografi */
    bx.strokeStyle='rgba(22,48,42,.07)';bx.lineWidth=1*DPR;
    for(var k=0;k<9;k++){bx.beginPath();for(var xx=0;xx<=W;xx+=8*DPR){var yy=H*(.12+k*.11)+Math.sin(xx/W*6.2+k*1.7)*H*.04+Math.sin(xx/W*13+k)*H*.015;if(xx===0)bx.moveTo(xx,yy);else bx.lineTo(xx,yy);}bx.stroke();}
    bx.strokeStyle='rgba(22,48,42,.1)';bx.lineWidth=1;bx.beginPath();
    for(var k1=0;k1<=KMW;k1+=20){var gx=Math.round(k1/KMW*W)+.5;bx.moveTo(gx,0);bx.lineTo(gx,H);}
    for(var k2=0;k2<=KMH;k2+=20){var gy=Math.round(k2/KMH*H)+.5;bx.moveTo(0,gy);bx.lineTo(W,gy);}
    bx.stroke();
    var tiers=[[.05,'rgba(231,181,102,.62)'],[.5,'rgba(201,88,74,.74)'],[.9,'rgba(147,64,58,.9)']];
    tiers.forEach(function(t,ti){
      bx.fillStyle=t[1];
      for(var cy=0;cy<GH;cy++)for(var cx=0;cx<GW;cx++){
        var pv=prob[cy*GW+cx];var tier=pv>=.9?2:(pv>=.5?1:(pv>=.05?0:-1));
        if(tier===ti)bx.fillRect(cx*cw-.4,cy*ch-.4,cw+.8,ch+.8);
      }
    });
    /* rute dari sekolah paling terpapar ke rumah sakit aman terdekat */
    var worst=null,safe=hosp.filter(function(h){return h.p<.05;});
    schools.forEach(function(f){if(f.p>=.5&&(!worst||f.p>worst.p))worst=f;});
    var route=null;
    if(worst&&safe.length){
      var bd=1e9,bh=null;safe.forEach(function(h){var d=Math.hypot((h.x-worst.x)*KMW,(h.y-worst.y)*KMH);if(d<bd){bd=d;bh=h;}});
      route={a:worst,b:bh,km:bd};
      bx.save();bx.setLineDash([7*DPR,6*DPR]);bx.strokeStyle=INK;bx.lineWidth=2*DPR;bx.beginPath();bx.moveTo(worst.x*W,worst.y*H);bx.lineTo(bh.x*W,bh.y*H);bx.stroke();bx.restore();
      var mx=(worst.x+bh.x)/2*W,my=(worst.y+bh.y)/2*H,tx=fmt(bd,1)+' km';
      bx.font='500 '+(11*DPR)+'px DM Mono,monospace';var tw=bx.measureText(tx).width;
      bx.fillStyle=INK;bx.fillRect(mx-tw/2-6*DPR,my-9*DPR,tw+12*DPR,18*DPR);bx.fillStyle=PAPER;bx.textBaseline='middle';bx.textAlign='center';bx.fillText(tx,mx,my+.5);
    }
    schools.forEach(function(f){
      var s=9*DPR;bx.fillStyle=f.p>=.9?'#261D19':(f.p>=.5?'#93403A':PAPER);bx.strokeStyle=INK;bx.lineWidth=1.6*DPR;
      bx.fillRect(f.x*W-s/2,f.y*H-s/2,s,s);bx.strokeRect(f.x*W-s/2,f.y*H-s/2,s,s);
      bx.font='500 '+(10*DPR)+'px DM Mono,monospace';bx.textAlign='left';bx.textBaseline='middle';
      bx.lineWidth=3*DPR;bx.strokeStyle='rgba(246,240,226,.9)';bx.strokeText(f.id,f.x*W+s*.75,f.y*H-s*.6);
      bx.fillStyle=INK;bx.fillText(f.id,f.x*W+s*.75,f.y*H-s*.6);
    });
    hosp.forEach(function(h){
      var ok=h.p<.05,rr=9*DPR;bx.beginPath();bx.arc(h.x*W,h.y*H,rr,0,6.283);bx.fillStyle=ok?'#2F7F7C':PAPER;bx.fill();bx.lineWidth=2*DPR;bx.strokeStyle=ok?INK:'#93403A';bx.stroke();
      bx.strokeStyle=ok?PAPER:'#93403A';bx.lineWidth=2.2*DPR;bx.beginPath();bx.moveTo(h.x*W-4*DPR,h.y*H);bx.lineTo(h.x*W+4*DPR,h.y*H);bx.moveTo(h.x*W,h.y*H-4*DPR);bx.lineTo(h.x*W,h.y*H+4*DPR);bx.stroke();
    });
    var X=src.x*W,Y=src.y*H,t=13*DPR;
    bx.beginPath();bx.moveTo(X,Y-t);bx.lineTo(X+t*.9,Y+t*.7);bx.lineTo(X-t*.9,Y+t*.7);bx.closePath();bx.fillStyle='#E0612B';bx.fill();bx.lineWidth=2.2*DPR;bx.strokeStyle=INK;bx.stroke();
    var sb=50/KMW*W;bx.fillStyle=INK;bx.fillRect(12*DPR,H-16*DPR,sb,3*DPR);bx.font='500 '+(10.5*DPR)+'px DM Mono,monospace';bx.textAlign='left';bx.textBaseline='bottom';bx.fillText('50 km',12*DPR,H-20*DPR);
    /* mata angin */
    var nx=W-22*DPR,ny=26*DPR;bx.beginPath();bx.moveTo(nx,ny-12*DPR);bx.lineTo(nx+5*DPR,ny+4*DPR);bx.lineTo(nx,ny);bx.lineTo(nx-5*DPR,ny+4*DPR);bx.closePath();bx.fillStyle=INK;bx.fill();
    bx.textAlign='center';bx.textBaseline='top';bx.fillText('U',nx,ny+7*DPR);
    return route;
  }
  var CARD=['Utara','Timur Laut','Timur','Tenggara','Selatan','Barat Daya','Barat','Barat Laut'];
  function readout(route){
    var hi=0,pjj=0;schools.forEach(function(f){if(f.p>=.9)hi++;if(f.p>=.4)pjj++;});
    var safe=hosp.filter(function(h){return h.p<.05;}).length;
    el('simRead').innerHTML='<span><strong>'+pjj+' dari '+schools.length+'</strong> sekolah contoh berpeluang 40% atau lebih terkena abu; '+hi+' di antaranya berada di inti zona 90%. Kegiatan belajar di sekolah tersebut disarankan beralih ke daring.</span><span><strong>'+safe+' dari '+hosp.length+'</strong> rumah sakit contoh berada di luar zona 5%.'+(route?' Rute rujukan terdekat dari sekolah paling terpapar sepanjang <strong>'+fmt(route.km,1)+' km</strong>.':'')+'</span>';
    var top=schools.slice().sort(function(a,b){return (b.p-a.p)||((a.tmin||99)-(b.tmin||99));}).slice(0,3);
    el('simTable').tBodies[0].innerHTML=top.map(function(f){
      var a=f.p>=.4?['hi','Alihkan ke daring']:(f.p>=.05?['md','Siaga, siapkan N95']:['lo','Kegiatan normal']);
      return '<tr><td><span class="sl">'+f.id+'</span>Sekolah '+f.id+'</td><td><span class="meter"><i style="width:'+Math.round(f.p*100)+'%"></i></span>'+Math.round(f.p*100)+'%</td><td>'+fmtT(f.t50)+'</td><td>'+fmtT(f.tmin)+'</td><td><span class="act '+a[0]+'">'+a[1]+'</span></td></tr>';
    }).join('');
  }
  /* jam desimal menjadi teks: "45 menit", "2 jam 15 menit" */
  function fmtT(t){if(t==null)return '–';var m=Math.max(5,Math.round(t*12)*5);return m<60?m+' menit':Math.floor(m/60)+' jam'+(m%60?' '+(m%60)+' menit':'');}
  function rebuild(){compute();var rt=drawBase();readout(rt);}
  var pending=false;function queue(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;rebuild();if(reduce)paint(0);});}

  function size(){
    DPR=Math.min(window.devicePixelRatio||1,2);
    var w=cv.clientWidth||600;W=Math.round(w*DPR);H=Math.round(W/1.6);
    cv.width=base.width=W;cv.height=base.height=H;rebuild();if(reduce)paint(0);
  }
  if(window.ResizeObserver)new ResizeObserver(size).observe(cv);else addEventListener('resize',size);

  /* partikel hidup dari satu run tengah */
  var live=[],NL=150;
  function spawn(p,warm){
    p.x=src.x*KMW;p.y=(1-src.y)*KMH;p.age=0;p.life=1+Math.random()*(2+st.H*.75);
    if(warm){var a=Math.random()*p.life;while(p.age<a)adv(p,.1);}
  }
  function adv(p,dh){
    var th=st.dir*Math.PI/180,a1=th+.25*Math.sin(p.x*.035+p.y*.028),mx=p.x+st.spd*Math.sin(a1)*dh*.5,my=p.y+st.spd*Math.cos(a1)*dh*.5;
    var a2=th+.25*Math.sin(mx*.035+my*.028),sg=(2+st.H*.6)*Math.sqrt(dh);
    p.x+=st.spd*Math.sin(a2)*dh+(Math.random()-.5)*1.7*sg;p.y+=st.spd*Math.cos(a2)*dh+(Math.random()-.5)*1.7*sg;p.age+=dh;
  }
  for(var li=0;li<NL;li++){var lp={};spawn(lp,true);live.push(lp);}
  var lastT=0,visible=true;
  function paint(t){
    var dt=lastT?Math.min(.05,(t-lastT)/1000):0;lastT=t;
    ctx.drawImage(base,0,0);
    for(var i=0;i<live.length;i++){
      var p=live[i];if(!reduce&&dt)adv(p,dt*1.1);
      if(p.age>p.life)spawn(p,false);
      var al=Math.max(0,1-p.age/p.life);
      ctx.fillStyle='rgba(38,29,25,'+(.15+.6*al).toFixed(2)+')';
      ctx.beginPath();ctx.arc(p.x/KMW*W,(KMH-p.y)/KMH*H,(1.2+1.1*al)*DPR,0,6.283);ctx.fill();
    }
  }
  function loop(t){if(visible&&!document.hidden)paint(t);requestAnimationFrame(loop);}
  if(!reduce){if('IntersectionObserver' in window)new IntersectionObserver(function(e){visible=e[0].isIntersecting;}).observe(cv);requestAnimationFrame(loop);}

  /* kontrol */
  function dirLabel(d){return CARD[Math.round(d/45)%8];}
  function labels(){el('sDirO').textContent=dirLabel(st.dir)+' ('+st.dir+'°)';el('sSpdO').textContent=st.spd+' km/jam';el('sHO').textContent=fmt(st.H,1)+' km';}
  el('sDir').addEventListener('input',function(e){st.dir=+e.target.value;labels();queue();});
  el('sSpd').addEventListener('input',function(e){st.spd=+e.target.value;labels();queue();});
  el('sH').addEventListener('input',function(e){st.H=+e.target.value;labels();queue();});
  el('sSeed').addEventListener('click',function(){st.seed=(st.seed*7+13)%9973;queue();});
  labels();
  function moveSrc(x,y){src.x=Math.min(.96,Math.max(.04,x));src.y=Math.min(.94,Math.max(.06,y));for(var i=0;i<live.length;i++)spawn(live[i],true);queue();}
  cv.addEventListener('click',function(e){var b=cv.getBoundingClientRect();moveSrc((e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);});
  var KEYS={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  cv.addEventListener('keydown',function(e){var k=KEYS[e.key];if(!k)return;e.preventDefault();var s=e.shiftKey?.08:.03;moveSrc(src.x+k[0]*s,src.y+k[1]*s);});

  /* salin tautan skenario */
  var msg=el('sShareMsg'),msgT=0;
  function say(t){msg.textContent=t;clearTimeout(msgT);msgT=setTimeout(function(){msg.textContent='';},3500);}
  el('sShare').addEventListener('click',function(){
    var v=[st.dir,st.spd,st.H,st.seed,src.x.toFixed(3),src.y.toFixed(3)].join(',');
    var url=location.origin+location.pathname+'?sim='+v+'#coba';
    if(location.protocol==='file:')url=location.href.split(/[?#]/)[0]+'?sim='+v+'#coba';
    function fallback(){var ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);say(ok?'Tautan skenario disalin.':'Salin manual: '+url);}
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(url).then(function(){say('Tautan skenario disalin.');},fallback);else fallback();
  });
  size();
})();
