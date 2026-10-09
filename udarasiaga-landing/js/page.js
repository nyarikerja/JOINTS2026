/* HelaLoka: halaman (gulir halus, status suasana, parallax, animasi masuk, navigasi).
   Satu loop requestAnimationFrame: Lenis -> pilih suasana -> parallax -> scene 3D (US.frame) -> anotasi. */
(function(){
  var root=document.documentElement;
  var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fmt=function(n,d){return n.toLocaleString('id-ID',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});};
  var $=function(s,c){return (c||document).querySelector(s);},$$=function(s,c){return [].slice.call((c||document).querySelectorAll(s));};

  /* status bersama untuk scene 3D. Jam > 24 berarti hari berikutnya, jadi langit berputar menerus */
  var HOUR={sunrise:6.9,noon:12,autumn:15.2,sunset:17.2,night:23,rain:32.5,storm:38,snow:40.5,sakura:55.8};
  var WEATHER=['rain','storm','snow','autumn','sakura'],HAZ=['ash','smoke','fire','lava','ext','mud'];
  var T={ash:.12,smoke:0,fire:0,lava:.5,ext:.35,mud:0,km:5,wind:1,out:0,hour:6.9,rain:0,storm:0,snow:0,autumn:0,sakura:0,scene:'sunrise'};
  var US=window.US={reduce:reduce,T:T,HOUR:HOUR,anchors:{},frame:null,vel:0,prog:0,dirty:true,snap:false,hour:T.hour};

  /* ---------- kontrol erupsi dan karhutla ---------- */
  var kmEl=$('#km'),kmOut=$('#kmOut'),merOut=$('#merOut'),coKm=$('#coKm');
  var windBtn=$('#windBtn'),fireBtn=$('#fireBtn'),fireOut=$('#fireOut');
  function mer(){var t=140.85*Math.pow(T.km,4.15)/1000;return t<10?fmt(t,1):fmt(Math.round(t));}
  function renderMer(){kmOut.textContent=fmt(T.km,1)+' km';merOut.innerHTML='Laju erupsi massa sekitar <strong>'+mer()+' ton per detik</strong> untuk kolom setinggi '+fmt(T.km,1)+' km.';if(coKm)coKm.textContent='sekitar '+fmt(T.km,1)+' km di atas kawah';US.dirty=true;}
  kmEl.addEventListener('input',function(){T.km=parseFloat(kmEl.value);renderMer();});
  windBtn.addEventListener('click',function(){T.wind=-T.wind;windBtn.textContent='Angin bertiup ke '+(T.wind>0?'timur':'barat');US.dirty=true;});
  function renderFire(){fireOut.innerHTML=T.out
    ?'Perkiraan paparan penduduk turun <strong>41%</strong>, dan <strong>6 sekolah</strong> keluar dari zona terdampak.'
    :'<strong>42 titik api</strong> dengan total FRP <strong>1.340 MW</strong> melepas sekitar <strong>480 ton</strong> PM2.5 per hari.';}
  fireBtn.addEventListener('click',function(){T.out=T.out?0:1;fireBtn.setAttribute('aria-pressed',T.out?'true':'false');fireBtn.textContent=T.out?'Nyalakan kembali titik api':'Padamkan 5 titik api terbesar';renderFire();US.dirty=true;});
  renderMer();renderFire();

  /* ---------- mode lihat lanskap ---------- */
  var vbtn=$('#viewBtn');
  function setFocus(on){document.body.classList.toggle('focus',on);vbtn.setAttribute('aria-pressed',on?'true':'false');vbtn.querySelector('span').textContent=on?'Tampilkan konten':'Lihat lanskap';}
  vbtn.addEventListener('click',function(){if(window.HLAudio)window.HLAudio.playClick();setFocus(!document.body.classList.contains('focus'));});
  addEventListener('keydown',function(e){if(e.key==='Escape')setFocus(false);});

  /* ---------- kontrol audio suasana ---------- */
  var aBtn=$('#audioBtn');
  if(aBtn){
    aBtn.addEventListener('click',function(){
      if(!window.HLAudio)return;
      var on=window.HLAudio.toggle();
      aBtn.setAttribute('aria-pressed',on?'true':'false');
      aBtn.classList.toggle('playing',on);
      aBtn.setAttribute('aria-label',on?'Matikan suara suasana alam':'Nyalakan suara suasana alam');
      aBtn.title=on?'Matikan suara alam':'Nyalakan suara alam';
    });
  }

  /* ---------- menu HP ---------- */
  var mBtn=$('#menuBtn'),mNav=$('#navLinks');
  function menu(o){mNav.classList.toggle('open',o);mBtn.setAttribute('aria-expanded',o?'true':'false');mBtn.setAttribute('aria-label',o?'Tutup menu':'Buka menu');}
  mBtn.addEventListener('click',function(e){e.stopPropagation();menu(!mNav.classList.contains('open'));});
  document.addEventListener('click',function(e){if(!mNav.contains(e.target))menu(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mNav.classList.contains('open')){menu(false);mBtn.focus();}});

  /* tautan luar: isi LINKS, tombolnya otomatis tampil */
  var LINKS={app:'',repo:'',email:''};
  $$('[data-link]').forEach(function(a){var k=a.getAttribute('data-link'),v=LINKS[k];if(v){a.href=(k==='email'?'mailto:':'')+v;a.hidden=false;}});

  /* ---------- gulir halus (Lenis). Lompatan lewat menu jadi time-lapse sinematik ---------- */
  var lenis=null;
  if(!reduce&&window.Lenis){
    var isTrackpad=false,tpTimer=null;
    try{
      lenis=new Lenis({
        lerp:.12,
        smoothWheel:true,
        wheelMultiplier:1,
        touchMultiplier:1,
        virtualScroll:function(e){
          var ev=e&&e.event;
          if(!ev)return true;
          /* jika sentuhan di layar sentuh, biarkan native gesture */
          if(ev.type&&ev.type.indexOf('touch')!==-1)return false;
          /* deteksi gestur trackpad/touchpad 2 jari: deltaMode 0 dengan desimal atau delta kecil */
          if(ev.deltaMode===0){
            var dy=Math.abs(ev.deltaY||0),dx=Math.abs(ev.deltaX||0);
            if(dy<60||(dy%1!==0)||dx>0){
              isTrackpad=true;
              clearTimeout(tpTimer);
              tpTimer=setTimeout(function(){isTrackpad=false;},300);
            }
          }
          if(isTrackpad){
            clearTimeout(tpTimer);
            tpTimer=setTimeout(function(){isTrackpad=false;},300);
            return false; /* native scroll untuk trackpad: instan, responsif, tidak macet */
          }
          return true; /* mouse wheel biasa tetap dihaluskan oleh Lenis */
        }
      });
      root.classList.add('has-lenis');
      US.lenis=lenis;
    }catch(e){lenis=null;}
  }
  var easeSnap=function(t){return 1-Math.pow(1-t,4);};
  function goTo(t,instant){
    var y=t.getBoundingClientRect().top+scrollY-(t.id==='beranda'?0:72);
    if(instant||reduce){if(lenis)lenis.scrollTo(y,{immediate:true});else scrollTo(0,y);US.snap=true;return;}
    if(lenis){var d=Math.abs(y-scrollY);lenis.scrollTo(y,{duration:Math.min(1.15,Math.max(0.65,d/3600)),easing:easeSnap});}
    else scrollTo({top:y,behavior:'smooth'});
  }
  document.addEventListener('click',function(ev){
    var a=ev.target.closest&&ev.target.closest('a[href^="#"]');if(!a)return;
    var id=a.getAttribute('href').slice(1),t=id&&document.getElementById(id);if(!t)return;
    if(a.closest('#rail')){
      if(window.HLAudio)window.HLAudio.playClick();
      a.classList.remove('clicked');
      void a.offsetWidth;
      a.classList.add('clicked');
      setTimeout(function(){a.classList.remove('clicked');},700);
    }
    ev.preventDefault();menu(false);goTo(t);
    if(history.replaceState)history.replaceState(null,'','#'+id);
    if(id==='konten'){t.setAttribute('tabindex','-1');t.focus({preventScroll:true});}
  });

  /* ---------- posisi bagian (di-cache; dihitung ulang saat ukuran berubah) ---------- */
  var items=$$('main [data-scene]'),centers=[],par=$$('[data-speed]'),parTop=[],band=$('[data-band]'),bandTop=0;
  function docTop(el){var y=0;while(el){y+=el.offsetTop;el=el.offsetParent;}return y;}
  function measure(){
    centers=items.map(function(el){return docTop(el)+el.offsetHeight*.5;});
    parTop=par.map(function(el){return docTop(el)+el.offsetHeight*.5;});
    if(band)bandTop=docTop(band.parentNode);
    if(typeof railSecs!=='undefined')railTop=railSecs.map(docTop);
    US.dirty=true;
  }
  measure();
  addEventListener('resize',measure);
  addEventListener('load',measure);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
  if(window.ResizeObserver)new ResizeObserver(function(){measure();}).observe(document.querySelector('main'));

  /* suasana mengikuti posisi gulir. Semua nilai bergeser menerus, tidak ada lompatan di tengah jalan */
  var curIdx=-1;
  function pick(){
    var mid=scrollY+innerHeight*.5,n=items.length,i,idx=0;
    for(i=0;i<n;i++){if(centers[i]<=mid)idx=i;}
    var j=Math.min(n-1,idx+1),f=j===idx?0:Math.max(0,Math.min(1,(mid-centers[idx])/(centers[j]-centers[idx])));
    var e=f*f*(3-2*f),A=items[idx].dataset,B=items[j].dataset;
    T.hour=HOUR[A.scene]+(HOUR[B.scene]-HOUR[A.scene])*e;
    WEATHER.forEach(function(k){T[k]=(A.scene===k?1:0)*(1-e)+(B.scene===k?1:0)*e;});
    HAZ.forEach(function(k){T[k]=+A[k]+((+B[k])-(+A[k]))*e;});
    T.scene=e<.5?A.scene:B.scene;
    var near=e<.5?idx:j;if(near!==curIdx){curIdx=near;onScene(items[near]);}
    var max=document.documentElement.scrollHeight-innerHeight;US.prog=max>0?Math.min(1,scrollY/max):0;
    if(window.HLAudio&&window.HLAudio.isPlaying())window.HLAudio.update(T);
  }

  /* ---------- rail ikon suasana + chip jam ---------- */
  var HALF='<path d="M6 16a6 6 0 0 1 12 0z"/>',RAYS='<path d="M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6L17 11M3 16h2M19 16h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',HZ='<path d="M3 19h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',CLOUD='<path d="M6.5 15a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1A3.6 3.6 0 0 1 17 15z"/>';
  var ICON={
    sunrise:'<svg viewBox="0 0 24 24" fill="currentColor">'+HALF+RAYS+HZ+'<path d="M9.5 4.5L12 2l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    noon:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    autumn:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8 L13.5 5 L15.6 4.2 L15 8.2 L18.2 6.6 L17.6 9.8 L21.6 10.4 L19.6 13 L20.8 15.4 L16.2 14.4 L15.4 16.6 L12.9 15.6 L12.9 22.2 L11.1 22.2 L11.1 15.6 L8.6 16.6 L7.8 14.4 L3.2 15.4 L4.4 13 L2.4 10.4 L6.4 9.8 L5.8 6.6 L9 8.2 L8.4 4.2 L10.5 5Z"/></svg>',
    sunset:'<svg viewBox="0 0 24 24" fill="currentColor">'+HALF+RAYS+HZ+'<path d="M9.5 2.5L12 5l2.5-2.5M6 21.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    night:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 14.6A8.4 8.4 0 1 1 9.4 4.5a6.7 6.7 0 0 0 10.1 10.1z"/><path d="M18.2 3.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
    rain:'<svg viewBox="0 0 24 24" fill="currentColor">'+CLOUD+'<path d="M8 18l-1.2 3M12.5 18l-1.2 3M17 18l-1.2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    storm:'<svg viewBox="0 0 24 24" fill="currentColor">'+CLOUD+'<path d="M12.8 14.5l-3.4 4.6h2.6l-1.2 4.2 4.4-5.8h-2.7l1.1-3z"/></svg>',
    snow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.6 4.2L12 6.5l2.4-2.3M9.6 19.8L12 17.5l2.4 2.3"/></svg>',
    sakura:'<svg viewBox="0 0 24 24" fill="currentColor"><g transform="translate(12 12)"><path id="pt" d="M0-1.2C-2.6-3.4-3.4-7.4-1.4-9.6L0-8.2l1.4-1.4C3.4-7.4 2.6-3.4 0-1.2z"/><use href="#pt" transform="rotate(72)"/><use href="#pt" transform="rotate(144)"/><use href="#pt" transform="rotate(216)"/><use href="#pt" transform="rotate(288)"/><circle r="1.6" fill="#7a2e45"/></g></svg>'
  };
  var ICON_COLOR={sunrise:'#FDB773',noon:'#FFF0C5',autumn:'#EB895B',sunset:'#FF8C52',night:'#8AD6D1',rain:'#359FA0',storm:'#DA6556',snow:'#8AD6D1',sakura:'#FDB773'};
  var bar=$('#progress'),rail=$('#rail'),chip=$('#sceneChip'),navA=$$('.nav-links a');
  var railSecs=$$('main section:not([data-norail]), main .vista[data-rail]');
  function hhmm(h){h=((h%24)+24)%24;var a=Math.floor(h),m=Math.floor((h-a)*60);return (a<10?'0':'')+a+'.'+(m<10?'0':'')+m;}
  railSecs.forEach(function(s,i){
    var a=document.createElement('a');
    a.href='#'+s.id;
    a.setAttribute('aria-label',s.dataset.label+', '+(s.dataset.sl||''));
    var sc=s.dataset.scene,col=ICON_COLOR[sc]||'#FDB773',nx=railSecs[i+1];
    a.style.setProperty('--ic',col);if(nx)a.style.setProperty('--ic2',ICON_COLOR[nx.dataset.scene]||col);
    a.innerHTML=ICON[sc]+(nx?'<span class="rail-seg"><i></i></span>':'')+'<span class="rail-tip"><time>'+hhmm(HOUR[sc])+'</time><span><em>'+(s.dataset.sl||sc)+'</em><b>'+s.dataset.label+'</b></span></span>';
    rail.appendChild(a);
  });
  var dots=[].slice.call(rail.children),segs=dots.map(function(d){return d.querySelector('.rail-seg i');}),railTop=[],railOn=-1,peekT=null;
  /* ruas garis rail terisi sebanding posisi gulir di antara dua suasana */
  function railFill(){
    if(railOn<0||!railTop.length)return;var mid=scrollY+innerHeight*.5,i=railOn,sg=segs[i];if(!sg)return;
    var f=Math.max(0,Math.min(1,(mid-railTop[i])/Math.max(1,railTop[i+1]-railTop[i])));sg.style.setProperty('--f',f.toFixed(3));
  }
  /* pil di menu atas meluncur ke tautan yang ditunjuk, kembali ke tautan aktif */
  var pill=$('.nav-pill'),pillOn=null;
  function placePill(a){
    if(!pill||innerWidth<=1100)return;
    if(!a){pill.style.opacity='0';return;}
    pill.style.width=a.offsetWidth+'px';pill.style.transform='translateX('+a.offsetLeft+'px)';pill.style.opacity='1';
  }
  navA.forEach(function(a){a.addEventListener('mouseenter',function(){placePill(a);});a.addEventListener('focus',function(){placePill(a);});});
  if(mNav){mNav.addEventListener('mouseleave',function(){placePill(pillOn);});}
  addEventListener('resize',function(){placePill(pillOn);});
  function onScene(el){
    if(chip){chip.querySelector('span').textContent=el.dataset.sl||'';chip.querySelector('.sc-ic').innerHTML=ICON[el.dataset.scene]||'';}
    var ri=-1,y=docTop(el);railSecs.forEach(function(s,i){if(docTop(s)<=y+10)ri=i;});ri=Math.max(0,ri);
    dots.forEach(function(d,i){var on=i===ri;d.classList.toggle('on',on);d.classList.toggle('past',i<ri);if(on)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');
      if(i>=ri&&segs[i])segs[i].style.setProperty('--f','0');});
    /* label suasana baru muncul sebentar di samping rail */
    if(ri!==railOn){railOn=ri;var d0=dots[ri];if(railTop.length&&d0){dots.forEach(function(d){d.classList.remove('peek');});d0.classList.add('peek');clearTimeout(peekT);peekT=setTimeout(function(){d0.classList.remove('peek');},1800);}}
    root.style.setProperty('--acc',ICON_COLOR[el.dataset.scene]||'#FDB773');
    var sec=el.closest('section')||el.nextElementSibling;pillOn=null;
    navA.forEach(function(a){var on=sec&&a.getAttribute('href')==='#'+sec.id;a.classList.toggle('on',on);if(on)pillOn=a;});
    placePill(pillOn);
  }

  /* jam dinding bertema tanaman merambat: sulur melingkari bingkai, daun dan bunga berganti warna mengikuti musim,
     embun saat hujan, salju menumpuk di atas bingkai. Jarum ikut jam langit */
  var wclock=$('#wclock'),wcH=$('#wcH'),wcM=$('#wcM'),wcL=$('#wcL'),wcT=$('#wcT'),wcV=$('#wcV'),lastClock='',lastSeason='';
  (function(){
    var NS='http://www.w3.org/2000/svg',RAD=Math.PI/180;
    function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);(p||wcV).appendChild(e);return e;}
    function at(t,r){return [r*Math.sin(t*RAD),-r*Math.cos(t*RAD)];}
    function rv(t){return 49+2.2*Math.sin(t*RAD*7);}
    /* penanda: bunga kecil di 12-3-6-9, kuncup daun di jam lainnya */
    for(var i=0;i<12;i++){
      if(i%3===0){var g=el('g',{transform:'rotate('+i*30+') translate(0 -37.5)'},wcT);
        for(var k=0;k<5;k++)el('ellipse',{'class':'wc-pt',rx:1.6,ry:2.7,transform:'rotate('+k*72+') translate(0 -2.3)'},g);el('circle',{'class':'wc-ctr',r:1.3},g);}
      else el('use',{href:'#wcLeaf','class':'wc-tk',transform:'rotate('+i*30+') translate(0 -34.5) scale(.3)'},wcT);
    }
    /* salju menumpuk di atas bingkai */
    var sd='',t;for(t=-58;t<=58;t+=4){var p=at(t,52.4+(1-Math.abs(t)/58)*1.6);sd+=(t===-58?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1);}
    for(t=58;t>=-58;t-=3){var q=at(t,46.6+1.1*Math.sin(t*.7));sd+='L'+q[0].toFixed(1)+' '+q[1].toFixed(1);}
    el('path',{d:sd+'Z','class':'wc-snow'});
    /* batang sulur bergelombang, ~300 derajat */
    var A0=205,A1=505,d='';
    for(t=A0;t<=A1;t+=3){var s=at(t,rv(t));d+=(t===A0?'M':'L')+s[0].toFixed(2)+' '+s[1].toFixed(2);}
    el('path',{d:d,'class':'wc-stem'});
    el('path',{d:d,'class':'wc-stem2'});
    /* sulur pilin kecil */
    [236,322,398,472].forEach(function(t,j){var s=at(t,rv(t)),g=el('g',{transform:'translate('+s[0].toFixed(2)+' '+s[1].toFixed(2)+') rotate('+(t+(j%2?-30:30))+') scale('+(j%2?-1:1)+' 1)'});
      el('path',{d:'M0 0C0-4 1.5-7.5 4.6-8.2 7.4-8.8 8.4-5.6 6.4-4.2 4.8-3.1 3.6-4.6 4.7-5.6','class':'wc-tendril'},g);});
    /* daun berselang-seling keluar dan ke dalam bingkai */
    var n=0;
    for(t=A0+5;t<A1-2;t+=11.5){var side=n%2?1:-1,s2=at(t,rv(t)),sc=(.72+.2*Math.sin(n*1.7)+(side<0?-.12:0)).toFixed(2),rot=t+(side>0?40:140)+Math.sin(n*2.3)*14;
      var lg=el('g',{transform:'translate('+s2[0].toFixed(2)+' '+s2[1].toFixed(2)+') rotate('+rot.toFixed(1)+') scale('+sc+')'});
      el('use',{href:'#wcLeaf','class':'wc-leaf'+(n%3===0?' b':''),style:'--d:'+((n*.73)%4).toFixed(2)+'s'},lg);
      el('path',{d:'M0-1.5L0-12.5M0-5L-2.4-8M0-8L2.2-10.6','class':'wc-vein'},lg);
      if(n%3===1)el('circle',{cx:1.8,cy:-8.5,r:1.6,'class':'wc-drop'},lg);
      n++;}
    /* bunga di sepanjang sulur */
    [258,346,428,494].forEach(function(t,j){var s=at(t,rv(t)+1),g=el('g',{'class':'wc-fl',transform:'translate('+s[0].toFixed(2)+' '+s[1].toFixed(2)+') rotate('+(t*2)+') scale('+(j%2?.85:1)+')'});
      for(var k=0;k<5;k++)el('ellipse',{rx:2.1,ry:3.3,transform:'rotate('+k*72+') translate(0 -2.8)'},g);el('circle',{r:1.5,'class':'wc-ctr'},g);});
  })();
  /* bingkai sulur untuk kapsul navigasi atas dan rail, senada dengan jam: batang bergelombang menyusuri tepi kapsul,
     daun mencuat ke luar, bunga, embun saat hujan, salju menumpuk di tepi atas. Dibangun ulang saat ukuran kapsul berubah */
  var LEAF='M0 0C-3.6-2.2-6.4-6.6-4.6-10.6-3.4-13.2-1.2-13.4 0-15.6 1.2-13.4 3.4-13.2 4.6-10.6 6.4-6.6 3.6-2.2 0 0Z';
  function vineFrame(host,R,runs,seed){
    if(!host)return;
    var NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),lw=0,lh=0,P=12;
    svg.setAttribute('class','vframe');svg.setAttribute('aria-hidden','true');host.appendChild(svg);
    function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e;}
    function f2(v){return v.toFixed(1);}
    function build(){
      var w=host.offsetWidth,h=host.offsetHeight;if(!w||!h||(Math.abs(w-lw)<2&&Math.abs(h-lh)<2))return;lw=w;lh=h;
      svg.setAttribute('viewBox','0 0 '+(w+2*P)+' '+(h+2*P));while(svg.firstChild)svg.removeChild(svg.firstChild);
      var r=R.map(function(v){return Math.min(v,h/2,w/2);}),x0=P,y0=P,x1=P+w,y1=P+h;
      var d='M'+(x0+r[0])+' '+y0+'H'+(x1-r[1])+'A'+r[1]+' '+r[1]+' 0 0 1 '+x1+' '+(y0+r[1])+'V'+(y1-r[2])+'A'+r[2]+' '+r[2]+' 0 0 1 '+(x1-r[2])+' '+y1+
        'H'+(x0+r[3])+'A'+r[3]+' '+r[3]+' 0 0 1 '+x0+' '+(y1-r[3])+'V'+(y0+r[0])+'A'+r[0]+' '+r[0]+' 0 0 1 '+(x0+r[0])+' '+y0+'Z';
      var guide=el('path',{d:d,fill:'none',stroke:'none'}),L=guide.getTotalLength(),n=0;
      runs.forEach(function(run,ri){
        var pts=[],a=run[0]*L,b=run[1]*L,s,i;
        for(s=a;s<=b;s+=4){var q=guide.getPointAtLength(((s%L)+L)%L);pts.push([q.x,q.y]);}
        if(pts.length<3)return;
        var N=pts.map(function(p,i){var A=pts[Math.max(0,i-1)],B=pts[Math.min(pts.length-1,i+1)],tx=B[0]-A[0],ty=B[1]-A[1],l=Math.hypot(tx,ty)||1;return [tx/l,ty/l,ty/l,-tx/l];});
        var S=pts.map(function(p,i){var o=1.5*Math.sin(i*.55+seed+ri*2);return [p[0]+N[i][2]*o,p[1]+N[i][3]*o];});
        var sd='';S.forEach(function(p,i){sd+=(i?'L':'M')+f2(p[0])+' '+f2(p[1]);});
        el('path',{d:sd,'class':'wc-stem'});
        for(i=2;i<S.length-2;i+=3){
          var t=N[i],side=n%2?1:-1,ang=(side>0?.6:-.6)+Math.sin(n*1.9+seed)*.25,out=n%5===4?-.35:1;
          var vx=(t[2]*Math.cos(ang)+t[0]*Math.sin(ang))*out,vy=(t[3]*Math.cos(ang)+t[1]*Math.sin(ang))*out;
          if(out<0){vx=t[0]*side*.8-t[2]*.3;vy=t[1]*side*.8-t[3]*.3;}
          var rot=Math.atan2(vx,-vy)*180/Math.PI,sc=(out<0?.42:.6+.18*Math.sin(n*1.3+seed)).toFixed(2);
          var g=el('g',{transform:'translate('+f2(S[i][0])+' '+f2(S[i][1])+') rotate('+rot.toFixed(0)+') scale('+sc+')'});
          el('path',{d:LEAF,'class':'wc-leaf'+(n%3===0?' b':''),style:'--d:'+((n*.71)%4).toFixed(2)+'s'},g);
          el('path',{d:'M0-1.5L0-12.5M0-5L-2.4-8M0-8L2.2-10.6','class':'wc-vein'},g);
          if(n%4===1)el('circle',{cx:1.8,cy:-8.5,r:1.7,'class':'wc-drop'},g);
          if(n%7===3){var fg=el('g',{'class':'wc-fl',transform:'translate('+f2(S[i+1][0])+' '+f2(S[i+1][1])+') rotate('+(n*37%360)+') scale(.8)'});
            for(var k=0;k<5;k++)el('ellipse',{rx:2.1,ry:3.2,transform:'rotate('+k*72+') translate(0 -2.7)'},fg);el('circle',{r:1.4,'class':'wc-ctr'},fg);}
          if(n%9===5)el('path',{d:'M0 0C0-4 1.5-7.5 4.6-8.2 7.4-8.8 8.4-5.6 6.4-4.2 4.8-3.1 3.6-4.6 4.7-5.6','class':'wc-tendril',
            transform:'translate('+f2(S[i][0])+' '+f2(S[i][1])+') rotate('+(rot+180*(side<0)).toFixed(0)+') scale(.9)'});
          n++;
        }
        /* salju di tepi yang menghadap ke atas */
        for(i=1;i<S.length-1;i+=2)if(N[i][3]<-.75)el('ellipse',{cx:f2(S[i][0]),cy:f2(S[i][1]-1.6),rx:(4+2*Math.abs(Math.sin(i*.9))).toFixed(1),ry:'2.4','class':'wc-snow'});
      });
      svg.removeChild(guide);
    }
    build();
    if(window.ResizeObserver)new ResizeObserver(function(){requestAnimationFrame(build);}).observe(host);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(build);
  }
  vineFrame($('.nav-in'),[20,56,20,56],[[.9,1.07],[.445,.585]],1.3);
  vineFrame(rail,[24,24,24,24],[[-.05,.1],[.58,.97]],4.1);
  function clock(h){
    var sea=T.scene;if(sea!==lastSeason){lastSeason=sea;root.setAttribute('data-s',sea);}
    var hr=((h%24)+24)%24,hh=Math.floor(hr),mm=Math.floor((hr-hh)*60),s=(hh<10?'0':'')+hh+'.'+(mm<10?'0':'')+mm;
    if(s===lastClock)return;lastClock=s;
    wcH.setAttribute('transform','rotate('+((hr%12)*30).toFixed(1)+')');wcM.setAttribute('transform','rotate('+((hr%1)*360).toFixed(1)+')');wcL.textContent=s;
  }

  /* ---------- parallax DOM (properti translate, terpisah dari transform animasi masuk) ---------- */
  var lastPY=[];
  function parallax(){
    if(reduce)return;
    var c=scrollY+innerHeight*.5,k=innerWidth<700?.5:1;
    for(var i=0;i<par.length;i++){
      var y=(parTop[i]-c)*-(+par[i].dataset.speed)*k;y=Math.round(y*10)/10;
      if(lastPY[i]!==y){lastPY[i]=y;par[i].style.translate='0 '+y+'px';}
    }
    if(band){var x=(bandTop-scrollY)*.45-innerWidth*.15;band.style.transform='translate3d('+x.toFixed(1)+'px,0,0)';}
  }

  /* ---------- anotasi pada objek 3D ---------- */
  var cos=$$('.co').map(function(el){return {el:el,k:el.dataset.a,on:false};});
  function annotate(){
    if(innerWidth<1000)return;
    var A=US.anchors,focus=document.body.classList.contains('focus');
    cos.forEach(function(c){
      var a=A[c.k],on=!!(a&&a.on)&&!focus;
      if(on){c.el.style.transform='translate3d('+a.x.toFixed(1)+'px,'+a.y.toFixed(1)+'px,0)';var left=a.x>innerWidth-420;if(left!==c.left){c.left=left;c.el.classList.toggle('l',left);}}
      if(on!==c.on){c.on=on;c.el.classList.toggle('on',on);}
    });
  }

  /* ---------- animasi masuk ---------- */
  function splitWords(el){
    var wi=0;
    [].slice.call(el.childNodes).forEach(function(n){
      if(n.nodeType===3){
        var frag=document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function(w){
          if(!w)return;if(/^\s+$/.test(w)){frag.appendChild(document.createTextNode(' '));return;}
          var o=document.createElement('span'),i=document.createElement('span');o.className='w';i.textContent=w;i.style.setProperty('--wi',wi++);o.appendChild(i);frag.appendChild(o);
        });
        el.replaceChild(frag,n);
      }else if(n.nodeType===1){
        var words=n.textContent.split(/\s+/).filter(Boolean);n.textContent='';
        words.forEach(function(w,ix){var o=document.createElement('span'),i=document.createElement('span');o.className='w';i.textContent=w;i.style.setProperty('--wi',wi++);o.appendChild(i);n.appendChild(o);if(ix<words.length-1)n.appendChild(document.createTextNode(' '));});
      }
    });
  }
  var rvs=$$('.rv'),splits=$$('.split'),vines=$$('.vine-wrap'),ranges=$$('.range');
  vines.forEach(function(v){var p=v.querySelector('path');if(p&&p.getTotalLength)v.style.setProperty('--len',Math.ceil(p.getTotalLength()*1.2));});
  if(reduce||!('IntersectionObserver' in window)){
    rvs.concat(splits,vines,ranges).forEach(function(el){el.classList.add('in');});
  }else{
    splits.forEach(splitWords);
    /* stagger: anggota satu induk muncul berurutan */
    var groups=new Map();rvs.forEach(function(el){var p=el.parentNode,g=groups.get(p)||0;el.style.setProperty('--i',g);groups.set(p,g+1);});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    rvs.concat(splits,vines,ranges).forEach(function(el){io.observe(el);});
  }

  /* angka statistik menghitung naik saat hero tampil */
  if(!reduce){
    $$('[data-count]').forEach(function(el){
      var to=+el.dataset.count,suf=el.dataset.suffix||'',t0=null;
      function step(t){if(t0===null)t0=t;var k=Math.min(1,(t-t0-500)/1600);if(k<0){requestAnimationFrame(step);return;}var e=1-Math.pow(1-k,4);el.textContent=Math.round(to*e)+suf;if(k<1)requestAnimationFrame(step);}
      el.textContent='0'+suf;requestAnimationFrame(step);
    });
  }

  /* navigasi bersembunyi saat menggulir ke bawah, muncul saat ke atas */
  var nav=$('#nav'),navHidden=false,navSc=null,lastY=scrollY;
  function navAuto(y){var sc=y>40;if(sc!==navSc){navSc=sc;nav.classList.toggle('scrolled',sc);}var dy=y-lastY;if(Math.abs(dy)<4)return;var hide=dy>0&&y>innerHeight*.6&&!mNav.classList.contains('open');if(hide!==navHidden){navHidden=hide;nav.classList.toggle('hide',hide);}lastY=y;}

  /* di layar sempit jam disembunyikan selama menggulir, muncul lagi 0,7 detik setelah berhenti */
  var awayT=null,isAway=false;
  function clockAway(){if(innerWidth>700||prevY<0)return;if(!isAway){isAway=true;wclock.classList.add('away');}
    clearTimeout(awayT);awayT=setTimeout(function(){isAway=false;wclock.classList.remove('away');},700);}

  /* ---------- loop tunggal ---------- */
  var prevY=-1;
  function loop(t){
    if(lenis)lenis.raf(t);
    var y=scrollY;
    if(y!==prevY){US.dirty=true;clockAway();bar.style.transform='scaleX('+US.prog.toFixed(4)+')';navAuto(y);railFill();}
    US.vel=lenis?lenis.velocity:(prevY<0?0:y-prevY);prevY=y;
    pick();parallax();
    if(US.frame)US.frame(t);else US.hour=T.hour;
    clock(US.hour);annotate();
    requestAnimationFrame(loop);
  }

  /* tautan langsung (#hasil dsb.): langsung ke bagian itu dengan suasananya, tanpa animasi dari fajar */
  function initHash(){var id=location.hash&&decodeURIComponent(location.hash.slice(1)),t=id&&document.getElementById(id);if(t){measure();goTo(t,true);}}
  if(document.readyState==='complete')initHash();else addEventListener('load',initHash);
  pick();
  requestAnimationFrame(loop);
})();
