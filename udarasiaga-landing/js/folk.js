/* HelaLoka: warga di padang rumput depan. Semua figur dan properti dilukis prosedural di canvas (tanpa aset gambar),
   lalu dipasang js/scene.js sebagai sprite yang ikut cahaya, bayangan awan, dan cuaca.
   Tiap musim punya adegan sendiri: Fajar (piknik keluarga), Kemarau (musim layangan), Salju, Mekar (hanami), Hujan (berpayung),
   ditambah kijang yang merumput di tepi padang.
   Satuan: 1 = kira-kira 1,3 m. Sumbu y ke atas, titik (0,0) = tanah di bawah titik jangkar sprite. */
(function(){
  var mobile=window.innerWidth<700||/Mobi|Android/i.test(navigator.userAgent);
  var PX=mobile?150:220,TAU=Math.PI*2;

  /* ---------- warna ---------- */
  function hx(h){if(typeof h!=='string')return h;h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function sh(c,k){c=hx(c);return c.map(function(v){return k>0?v+(255-v)*k:v*(1+k);});}
  function css(c,a){c=hx(c);return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+(a==null?1:a)+')';}
  function lp(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}

  /* kanvas dengan sumbu y ke atas; (ax,ay) = titik asal dari kiri bawah, dalam satuan dunia */
  function cv(w,h,ax,ay,fn){
    var c=document.createElement('canvas');c.width=Math.ceil(w*PX);c.height=Math.ceil(h*PX);
    var g=c.getContext('2d');g.translate(ax*PX,c.height-ay*PX);g.scale(PX,-PX);g.lineJoin=g.lineCap='round';
    fn(g);c.w=w;c.h=h;c.ax=ax;c.ay=ay;return c;
  }

  /* ---------- primitif berbayang (cahaya dari kiri atas) ---------- */
  var LD=[-.55,.83];
  function grad(g,cx,cy,nx,ny,r,c,k){
    var gr=g.createLinearGradient(cx+nx*r,cy+ny*r,cx-nx*r,cy-ny*r);k=k||1;
    gr.addColorStop(0,css(sh(c,.26*k)));gr.addColorStop(.38,css(sh(c,.05*k)));gr.addColorStop(.78,css(sh(c,-.17*k)));gr.addColorStop(1,css(sh(c,-.34*k)));return gr;
  }
  /* anggota tubuh: kapsul meruncing dari a ke b */
  function limb(g,a,b,ra,rb,c,k){
    var dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1e-4,px=-dy/L,py=dx/L,nx=px,ny=py;
    if(nx*LD[0]+ny*LD[1]<0){nx=-nx;ny=-ny;}
    var m=lp(a,b,.5);g.fillStyle=grad(g,m[0],m[1],nx,ny,Math.max(ra,rb),c,k);
    g.beginPath();g.moveTo(a[0]+px*ra,a[1]+py*ra);g.lineTo(b[0]+px*rb,b[1]+py*rb);g.lineTo(b[0]-px*rb,b[1]-py*rb);g.lineTo(a[0]-px*ra,a[1]-py*ra);g.closePath();g.fill();
    g.beginPath();g.arc(a[0],a[1],ra,0,TAU);g.fill();g.beginPath();g.arc(b[0],b[1],rb,0,TAU);g.fill();
  }
  /* bola/elips dengan gradien radial (volume) */
  function ball(g,x,y,rx,ry,c,rot,k){
    ry=ry||rx;k=k||1;g.save();g.translate(x,y);if(rot)g.rotate(rot);g.scale(1,ry/rx);
    var gr=g.createRadialGradient(-rx*.38,rx*.42,rx*.05,0,0,rx*1.05);
    gr.addColorStop(0,css(sh(c,.3*k)));gr.addColorStop(.45,css(sh(c,.02)));gr.addColorStop(1,css(sh(c,-.32*k)));
    g.fillStyle=gr;g.beginPath();g.arc(0,0,rx,0,TAU);g.fill();g.restore();
  }
  function poly(g,pts,fill,smooth){
    g.beginPath();
    if(smooth){var n=pts.length,m0=lp(pts[n-1],pts[0],.5);g.moveTo(m0[0],m0[1]);
      for(var i=0;i<n;i++){var p=pts[i],m=lp(p,pts[(i+1)%n],.5);g.quadraticCurveTo(p[0],p[1],m[0],m[1]);}}
    else{g.moveTo(pts[0][0],pts[0][1]);for(var j=1;j<pts.length;j++)g.lineTo(pts[j][0],pts[j][1]);}
    g.closePath();if(fill){g.fillStyle=fill;g.fill();}
  }
  function line(g,pts,col,w){g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.stroke();}
  /* bayangan kontak di tanah */
  function shadow(g,x,y,rx,ry,a,col){
    g.save();g.translate(x,y);g.scale(1,ry/rx);var c=col||[22,30,18];
    var r=g.createRadialGradient(0,0,0,0,0,rx);r.addColorStop(0,css(c,a));r.addColorStop(.6,css(c,a*.55));r.addColorStop(1,css(c,0));
    g.fillStyle=r;g.beginPath();g.arc(0,0,rx,0,TAU);g.fill();g.restore();
  }
  function rng(seed){var s=seed;return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}

  /* ---------- manusia ----------
     P: sendi 2D (hd kepala, nk leher, pe panggul, sh/el/hn bahu-siku-tangan, hp/kn/an/to pinggul-lutut-mata kaki-ujung kaki; [jauh, dekat]).
     o: kulit, rambut, gaya rambut, atasan, bawahan, sepatu, topi, syal, arah hadap (d). Semua pose digambar menghadap kanan, d=-1 dicerminkan. */
  function mirror(P){var Q={},c2=P.pe[0]*2;for(var k in P){var v=P[k];Q[k]=typeof v[0]==='number'?[c2-v[0],v[1]]:v.map(function(p){return typeof p[0]==='number'?[c2-p[0],p[1]]:p;});}return Q;}
  var SKIN=['#C68A5E','#A86F48','#D9A47C','#8A5A3C','#E2B58F'];
  function fig(g,P,o){
    var d=o.d||1;if(d<0)P=mirror(P);
    var s=o.s||1,pf=o.tk==='puffer'?1.32:(o.tk==='coat'||o.tk==='sweater'?1.12:1);
    var R={hd:(o.hr||.078)*(o.kid?1.12:1),ua:.041*s*pf,fa:.033*s*pf,hn:.027*s,th:.061*s*(o.tk==='puffer'?1.08:1),sn:.045*s,sh:.104*s*pf,hp:.09*s};
    var skin=hx(o.skin||SKIN[0]),top=hx(o.top),bot=hx(o.bot||'#3A4250'),shoe=hx(o.shoe||'#2B2622'),far=-.17;
    var hd=P.hd,nk=P.nk,pe=P.pe,wa=lp(nk,pe,.84);
    if(o.pre)o.pre(g,P,d);
    /* rambut panjang di belakang punggung */
    if(o.hs==='long'||o.hs==='curlylong'){var hb=lp(hd,nk,.6);ball(g,hb[0]-d*R.hd*.45,hb[1]-R.hd*.55,R.hd*1.0,R.hd*1.85,o.hair,-d*.12,.6);}
    if(o.hs==='hijab'&&o.long){poly(g,[[hd[0]-d*R.hd*1.15,hd[1]],[hd[0]-d*R.hd*1.6,nk[1]-R.sh*1.6],[hd[0]+d*R.hd*.2,nk[1]-R.sh*1.9],[hd[0]+d*R.hd*.9,hd[1]-R.hd]],css(sh(o.hijab,-.12)),true);}
    function arm(i){
      var k=i?0:far,S=P.sh[i],E=P.el[i],Hd=P.hn[i],tc=sh(top,k),sk=sh(skin,k);
      limb(g,S,E,R.ua/pf,R.fa/pf*1.02,sk);limb(g,E,Hd,R.fa/pf,R.hn*.9,sk);
      if(o.mit)ball(g,Hd[0],Hd[1],R.hn*1.35,R.hn*1.25,sh(o.mit,k));else ball(g,Hd[0],Hd[1],R.hn,R.hn*1.08,sk);
      var tk=o.tk||'tee';
      if(tk==='tee'||tk==='dress'){limb(g,S,lp(S,E,.5),R.ua*1.18,R.ua*1.12,tc);}
      else if(tk!=='tank'){limb(g,S,E,R.ua*1.08,R.fa*1.12,tc);var cf=lp(E,Hd,tk==='puffer'?.78:.84);limb(g,E,cf,R.fa*1.1,R.fa*(tk==='puffer'?1.12:.98),tc);
        if(tk==='puffer'){g.strokeStyle=css(sh(tc,-.28),.55);g.lineWidth=.006;[.33,.66].forEach(function(t){var q=lp(S,E,t);g.beginPath();g.arc(q[0],q[1],R.ua*.95,0,TAU);g.stroke();});}
        if(o.cuff)limb(g,lp(E,Hd,.74),cf,R.fa*1.12,R.fa*1.05,sh(o.cuff,k));}
      if(o.hold&&o.hold[i])o.hold[i](g,Hd,d);
    }
    function leg(i){
      var k=i?0:far,Hp=P.hp[i],K=P.kn[i],A=P.an[i],To=P.to[i],sk=sh(skin,k),bc=sh(bot,k),bk=o.bk||'pants';
      var lc=bk==='pants'?bc:(o.tights?sh(o.tights,k):sk);
      limb(g,Hp,K,R.th,R.sn*1.06,bk==='pants'||bk==='shorts'?bc:lc);limb(g,K,A,R.sn,R.sn*.74,lc);
      if(bk==='shorts')limb(g,K,lp(K,A,.08),R.sn*1.0,R.sn*.92,sk);
      if(bk==='shorts'){var e=lp(Hp,K,.78);limb(g,e,K,R.th*.88,R.sn*1.02,sk);}
      if(o.boots){limb(g,lp(K,A,.55),A,R.sn*.98,R.sn*.9,sh(o.boots,k));}
      limb(g,A,To,R.sn*.78,R.sn*.68,sh(shoe,k),.8);
      g.fillStyle=css(sh(shoe,k-.35));g.beginPath();var dx=To[0]-A[0],dy=To[1]-A[1],L=Math.hypot(dx,dy)||1;g.ellipse((A[0]+To[0])/2,(A[1]+To[1])/2-R.sn*.5*dx/L,L*.62,R.sn*.22,Math.atan2(dy,dx),0,TAU);g.fill();
    }
    ball(g,pe[0],pe[1],R.hp*1.04,R.hp*.9,o.bk==='dress'||o.bk==='skirt'?sh(top,-.05):bot);
    if(o.legsFirst!==false){leg(0);leg(1);}
    if(o.bk==='skirt'||o.bk==='dress'){var sc=o.bk==='dress'?top:hx(o.skirt||o.bot);var sk2=P.sk||(o.maxi?[[wa[0]-R.hp*1.05,wa[1]],[wa[0]+R.hp*1.05,wa[1]],[Math.max(P.an[0][0],P.an[1][0])+R.th*1.5,Math.min(P.an[0][1],P.an[1][1])+.03],[Math.min(P.an[0][0],P.an[1][0])-R.th*1.5,Math.min(P.an[0][1],P.an[1][1])+.03]]:[[wa[0]-R.hp*1.05,wa[1]],[wa[0]+R.hp*1.05,wa[1]],[P.kn[1][0]+R.th*1.4,P.kn[1][1]-.06],[P.kn[0][0]-R.th*1.4,P.kn[0][1]-.06]]);
      poly(g,sk2,grad(g,wa[0],(wa[1]+P.kn[1][1])/2,LD[0],LD[1],.3,sc),true);
      g.strokeStyle=css(sh(sc,-.3),.45);g.lineWidth=.007;for(var f=1;f<4;f++){var t=f/4,a=lp(sk2[0],sk2[1],t),b=lp(sk2[3],sk2[2],t);g.beginPath();g.moveTo(a[0],a[1]);g.quadraticCurveTo((a[0]+b[0])/2+.02,(a[1]+b[1])/2,b[0],b[1]);g.stroke();}
      if(o.skirtPat)o.skirtPat(g,sk2);}
    arm(0);
    /* leher dan badan */
    limb(g,lp(hd,nk,.45),nk,R.hd*.36,R.hd*.4,skin);
    var tA=[nk[0]+(pe[0]-nk[0])*.1,nk[1]-R.sh*.5];
    limb(g,tA,wa,R.sh,R.hp*.98,top,.9);
    g.save();g.beginPath();g.arc(tA[0],tA[1],R.sh,0,TAU);g.arc(wa[0],wa[1],R.hp*.98,0,TAU);
    var dxT=wa[0]-tA[0],dyT=wa[1]-tA[1],LT=Math.hypot(dxT,dyT),pxT=-dyT/LT*1,pyT=dxT/LT;
    g.moveTo(tA[0]+pxT*R.sh,tA[1]+pyT*R.sh);g.lineTo(wa[0]+pxT*R.hp,wa[1]+pyT*R.hp);g.lineTo(wa[0]-pxT*R.hp,wa[1]-pyT*R.hp);g.lineTo(tA[0]-pxT*R.sh,tA[1]-pyT*R.sh);g.closePath();g.clip();
    /* motif dan detail pakaian, dipotong mengikuti badan */
    if(o.stripe){g.strokeStyle=css(o.stripe,.85);g.lineWidth=.022;for(var y=-.3;y<.4;y+=.055){g.beginPath();g.moveTo(nk[0]-.3,wa[1]+y);g.lineTo(nk[0]+.3,wa[1]+y+(pe[0]-nk[0])*.1);g.stroke();}}
    if(o.batik){g.strokeStyle=css(o.batik,.75);g.lineWidth=.008;for(var by=-.1;by<.5;by+=.06)for(var bx=-.2;bx<.2;bx+=.06){g.beginPath();g.ellipse(nk[0]+bx+((by*16|0)%2)*.03,wa[1]+by,.018,.012,0,0,TAU);g.stroke();}}
    if(o.tk==='puffer'){g.strokeStyle=css(sh(top,-.32),.6);g.lineWidth=.007;for(var q=0;q<6;q++){var yq=wa[1]+q*.07+.02;g.beginPath();g.moveTo(nk[0]-.25,yq);g.quadraticCurveTo(nk[0],yq-.018,nk[0]+.25,yq);g.stroke();}
      g.strokeStyle=css(sh(top,-.45),.8);g.lineWidth=.006;g.beginPath();g.moveTo(nk[0]+d*.045,nk[1]-.02);g.lineTo(wa[0]+d*.05,wa[1]-.04);g.stroke();}
    if(o.tk==='coat'){g.strokeStyle=css(sh(top,-.4),.8);g.lineWidth=.007;g.beginPath();g.moveTo(nk[0]+d*.05,nk[1]-.03);g.lineTo(wa[0]+d*.06,wa[1]-.1);g.stroke();
      g.fillStyle=css(sh(top,-.5));[0,1,2].forEach(function(i){var b=lp([nk[0]+d*.065,nk[1]-.06],[wa[0]+d*.075,wa[1]],i/2.4);g.beginPath();g.arc(b[0],b[1],.008,0,TAU);g.fill();});}
    if(o.tk==='sweater'){g.strokeStyle=css(sh(top,-.22),.5);g.lineWidth=.005;for(var ry=0;ry<10;ry++){g.beginPath();g.moveTo(nk[0]-.25,wa[1]+ry*.035);g.lineTo(nk[0]+.25,wa[1]+ry*.035);g.stroke();}}
    /* kerutan kain di pinggang dan bawah ketiak */
    g.fillStyle=css([0,0,0],.12);g.beginPath();g.ellipse(wa[0],wa[1]-.01,R.hp*1.1,.03,0,0,TAU);g.fill();
    if(o.tk!=='puffer'&&o.tk!=='coat'){g.fillStyle=css(skin);g.beginPath();g.moveTo(nk[0]-d*.035,nk[1]+.01);g.lineTo(nk[0]+d*.045,nk[1]+.01);g.lineTo(nk[0]+d*.012,nk[1]-.045);g.closePath();g.fill();}
    g.restore();
    if(o.bk==='dress'&&o.belt){g.fillStyle=css(o.belt);g.beginPath();g.ellipse(wa[0],wa[1]+.01,R.hp*1.02,.014,0,0,TAU);g.fill();}
    if(o.mid)o.mid(g,P,d);
    if(o.scarf){var sc2=hx(o.scarf);limb(g,[nk[0]-d*.05,nk[1]+.01],[nk[0]+d*.05,nk[1]+.005],.04,.04,sc2);
      limb(g,[nk[0]+d*.03,nk[1]-.01],[nk[0]+d*.06,nk[1]-.17],.026,.022,sh(sc2,-.08));
      g.strokeStyle=css(sh(sc2,-.35),.7);g.lineWidth=.006;for(var fr=0;fr<4;fr++){g.beginPath();g.moveTo(nk[0]+d*(.045+fr*.009),nk[1]-.185);g.lineTo(nk[0]+d*(.045+fr*.009),nk[1]-.21);g.stroke();}}
    if(o.hs==='hijab'){var hj=hx(o.hijab);
      poly(g,[[hd[0]-d*R.hd*1.12,hd[1]+R.hd*.2],[hd[0]-d*R.hd*1.15,nk[1]-R.sh*.5],[nk[0]-d*R.sh*.9,nk[1]-R.sh*1.0],[nk[0]+d*R.sh*1.0,nk[1]-R.sh*1.05],[hd[0]+d*R.hd*1.15,nk[1]-R.sh*.15],[hd[0]+d*R.hd*1.0,hd[1]-R.hd*.2]],grad(g,nk[0],nk[1],LD[0],LD[1],.16,hj,.8),true);
      g.strokeStyle=css(sh(hj,-.3),.5);g.lineWidth=.006;g.beginPath();g.moveTo(nk[0]-d*.02,nk[1]+.02);g.quadraticCurveTo(nk[0]+d*.06,nk[1]-.06,nk[0]+d*.05,nk[1]-.13);g.stroke();}
    arm(1);
    head(g,hd,R.hd,d,skin,o);
    if(o.post)o.post(g,P,d);
  }
  function head(g,hd,r,d,skin,o){
    var x=hd[0],y=hd[1],hair=hx(o.hair||'#1E1714'),hs=o.hs||'short';
    if(hs==='hijab'){var hj=hx(o.hijab);ball(g,x-d*r*.08,y+r*.06,r*1.2,r*1.22,hj,0,.8);}
    else if(hs!=='bald'){
      if(hs==='bun')ball(g,x-d*r*.55,y+r*.75,r*.42,r*.38,hair,0,.7);
      if(hs==='pony'){limb(g,[x-d*r*.85,y+r*.35],[x-d*r*1.45,y-r*.55],r*.3,r*.16,hair,.6);}
      ball(g,x-d*r*.12,y+r*.1,r*1.06,r*1.04,hair,0,.75);
      if(hs==='curly'||hs==='curlylong'){for(var c=0;c<9;c++){var a=c/9*TAU;ball(g,x-d*r*.12+Math.cos(a)*r*.95,y+r*.12+Math.sin(a)*r*.9,r*.28,r*.28,hair,0,.6);}}
    }
    /* wajah 3/4: elips kulit bergeser ke arah hadap */
    var fx=x+d*r*(hs==='hijab'?.2:.14),fy=y-r*.1,fr=hs==='hijab'?r*.7:r*.9;
    g.save();g.translate(fx,fy);g.scale(1,1.08);
    var gr=g.createRadialGradient(-fr*.3+d*fr*.2,fr*.35,fr*.05,0,0,fr*1.05);gr.addColorStop(0,css(sh(skin,.2)));gr.addColorStop(.55,css(skin));gr.addColorStop(1,css(sh(skin,-.22)));
    g.fillStyle=gr;g.beginPath();g.arc(0,0,fr,0,TAU);g.fill();g.restore();
    /* hidung dan telinga */
    ball(g,fx+d*fr*.93,fy-fr*.05,fr*.15,fr*.17,skin);
    if(hs!=='hijab'&&!o.hat)ball(g,x-d*r*.05,y-r*.12,r*.17,r*.23,sh(skin,-.1));
    /* poni / garis rambut */
    if(hs!=='hijab'&&hs!=='bald'){g.save();g.beginPath();g.arc(fx,fy,fr*1.02,0,TAU);g.clip();
      g.fillStyle=css(hair);g.beginPath();g.ellipse(x+d*r*.05,y+r*.78,r*1.0,r*.52,-d*.25,0,TAU);g.fill();
      if(hs==='long'||hs==='curlylong'){g.beginPath();g.ellipse(x-d*r*.55,y-r*.2,r*.32,r*.85,0,0,TAU);g.fill();}
      g.restore();}
    /* mata, alis, pipi, mulut */
    var ex=fx+d*fr*.48,ey=fy+fr*.18;
    g.fillStyle=css([28,20,18]);g.beginPath();g.ellipse(ex,ey,fr*.085,fr*.12,0,0,TAU);g.fill();
    g.beginPath();g.ellipse(fx+d*fr*.02,ey,fr*.07,fr*.11,0,0,TAU);g.fill();
    if(o.closed){g.fillStyle=css(skin);g.fillRect(ex-fr*.12,ey-fr*.02,fr*.24,fr*.16);g.fillRect(fx+d*fr*.02-fr*.1,ey-fr*.02,fr*.2,fr*.16);}
    g.strokeStyle=css(sh(o.hair||'#1E1714',-.1),.85);g.lineWidth=fr*.07;g.beginPath();g.moveTo(ex-fr*.14,ey+fr*.24);g.lineTo(ex+fr*.12,ey+fr*.27);g.stroke();
    g.fillStyle=css([230,110,110],.28);g.beginPath();g.arc(fx+d*fr*.45,fy-fr*.22,fr*.2,0,TAU);g.fill();
    g.strokeStyle=css(sh(skin,-.45),.9);g.lineWidth=fr*.06;g.beginPath();
    if(o.smile!==false){g.arc(fx+d*fr*.55,fy-fr*.35,fr*.15,Math.PI*1.1,Math.PI*1.9,false);}
    if(o.blow){g.fillStyle=css([120,50,50]);g.beginPath();g.arc(fx+d*fr*.82,fy-fr*.38,fr*.1,0,TAU);g.fill();}
    else g.stroke();
    if(o.glasses){g.strokeStyle=css([40,34,30]);g.lineWidth=fr*.06;g.beginPath();g.arc(ex,ey,fr*.18,0,TAU);g.stroke();g.beginPath();g.moveTo(ex-fr*.18,ey);g.lineTo(x-d*r*.1,ey+fr*.05);g.stroke();}
    if(o.beard){g.fillStyle=css(sh(o.hair||'#2a2420',.0),.85);g.beginPath();g.ellipse(fx+d*fr*.35,fy-fr*.6,fr*.55,fr*.32,-d*.3,0,TAU);g.fill();}
    if(o.grey){g.fillStyle=css([215,212,205]);g.beginPath();g.ellipse(x-d*r*.25,y+r*.3,r*.85,r*.6,0,0,TAU);g.fill();ball(g,fx,fy,fr*.0001,0,skin);}
    hat(g,x,y,r,d,o);
  }
  function hat(g,x,y,r,d,o){
    var h=o.hat;if(!h)return;var c=hx(o.hatc||'#C23B33');
    if(h==='beanie'){
      g.save();g.beginPath();g.ellipse(x-d*r*.05,y+r*.25,r*1.12,r*1.05,0,Math.PI*0,Math.PI);g.closePath();g.fillStyle=grad(g,x,y+r*.5,LD[0],LD[1],r,c);g.fill();
      g.strokeStyle=css(sh(c,-.25),.55);g.lineWidth=r*.07;for(var i=-3;i<=3;i++){g.beginPath();g.moveTo(x+i*r*.27,y+r*.3);g.lineTo(x+i*r*.24,y+r*1.1);g.stroke();}
      g.restore();limb(g,[x-d*r*1.12,y+r*.28],[x+d*r*1.08,y+r*.22],r*.24,r*.24,sh(c,o.hatb?0:-.1));
      if(o.hatb){g.fillStyle=css(o.hatb);g.fillRect(x-r*1.1,y+r*.2,r*2.2,r*.09);}
      ball(g,x-d*r*.15,y+r*1.42,r*.34,r*.32,o.pom||'#F4EFE6');
    }else if(h==='straw'){
      ball(g,x-d*r*.05,y+r*.7,r*1.85,r*.34,'#D8B46A',-d*.08);
      ball(g,x-d*r*.08,y+r*.95,r*.88,r*.55,'#E2C27A');
      limb(g,[x-d*r*.92,y+r*.72],[x+d*r*.8,y+r*.68],r*.13,r*.13,c);
      g.strokeStyle=css([150,110,50],.4);g.lineWidth=r*.04;for(var k=1;k<4;k++){g.beginPath();g.ellipse(x-d*r*.05,y+r*.7,r*1.85*k/4,r*.34*k/4,-d*.08,0,TAU);g.stroke();}
    }else if(h==='cap'){
      ball(g,x-d*r*.05,y+r*.4,r*1.05,r*.8,c);g.fillStyle=css(sh(c,-.3));g.beginPath();g.ellipse(x+d*r*1.05,y+r*.35,r*.75,r*.14,-d*.08,0,TAU);g.fill();
      g.fillStyle=css([255,255,255],.85);g.beginPath();g.arc(x+d*r*.25,y+r*.7,r*.16,0,TAU);g.fill();
    }else if(h==='crown'){
      var cols=['#F7B6C8','#FFFFFF','#F9D262','#E98AA8','#C6E2A2'];
      for(var j=0;j<9;j++){var a=Math.PI*(.05+.9*j/8),px=x-d*r*.1+Math.cos(a)*r*1.05*(j%2?.98:1),py=y+r*.45+Math.sin(a)*r*.42;
        g.fillStyle=css('#5E8F46');g.beginPath();g.ellipse(px+.01,py-.004,r*.2,r*.09,.6,0,TAU);g.fill();ball(g,px,py,r*.22,r*.2,cols[j%5]);
        g.fillStyle=css('#F7D046');g.beginPath();g.arc(px,py,r*.07,0,TAU);g.fill();}
    }else if(h==='phones'){
      g.strokeStyle=css([30,30,34]);g.lineWidth=r*.16;g.beginPath();g.arc(x-d*r*.05,y+r*.15,r*1.05,Math.PI*.15,Math.PI*.95);g.stroke();
      ball(g,x-d*r*.1,y-r*.08,r*.3,r*.36,'#E8513A');
    }else if(h==='band'){
      limb(g,[x-d*r*1.0,y+r*.42],[x+d*r*.95,y+r*.36],r*.14,r*.14,c);
    }else if(h==='top'){
      g.fillStyle=css([28,26,30]);g.beginPath();g.ellipse(x,y+r*.65,r*1.25,r*.2,0,0,TAU);g.fill();poly(g,[[x-r*.75,y+r*.68],[x+r*.75,y+r*.68],[x+r*.68,y+r*1.75],[x-r*.68,y+r*1.75]],css([36,34,40]));
      g.fillStyle=css(c);g.fillRect(x-r*.74,y+r*.78,r*1.48,r*.2);
    }
  }

  /* ---------- pose dasar (menghadap kanan, tinggi dewasa ~1,35) ---------- */
  function stand(o){o=o||{};var k=o.k||1,ax=o.ax||0;
    return sc({hd:[.02,1.24],nk:[0,1.1],pe:[0,.72],sh:[[-.05,1.07],[.05,1.06]],el:o.el||[[-.06,.86],[.07,.85]],hn:o.hn||[[-.05,.66],[.09,.65]],
      hp:[[-.035,.71],[.04,.7]],kn:o.kn||[[-.03,.38],[.05,.38]],an:o.an||[[-.04,.06],[.04,.06]],to:o.to||[[.04,.03],[.13,.03]]},k,ax);}
  function sc(P,k,ax,ay){ay=ay||0;var Q={};for(var n in P){var v=P[n];Q[n]=typeof v[0]==='number'?[v[0]*k+ax,v[1]*k+ay]:v.map(function(p){return [p[0]*k+ax,p[1]*k+ay];});}return Q;}
  /* siklus lari/jalan: ph 0..1; amp besar = lari */
  function gait(ph,run,k){
    var a=ph*TAU,amp=run?.62:.36,hipY=(run?.66:.71)+(run?.035:.015)*Math.abs(Math.cos(a)),lean=run?.12:.03;
    var pe=[0,hipY],nk=[Math.sin(lean)*.38,hipY+.38],hd=[nk[0]+.03,nk[1]+.14],P={pe:pe,nk:nk,hd:hd,sh:[],el:[],hn:[],hp:[],kn:[],an:[],to:[]};
    for(var i=0;i<2;i++){var s=i?1:-1,t=Math.sin(a)*amp*s;
      var sw=Math.cos(a)*s,bend=run?(.25+1.25*Math.max(0,-sw)):(.15+.55*Math.max(0,-sw));
      var hp=[pe[0]+(i?.03:-.03),pe[1]],kn=[hp[0]+Math.sin(t)*.33,hp[1]-Math.cos(t)*.33],sa=t-bend,an=[kn[0]+Math.sin(sa)*.31,kn[1]-Math.cos(sa)*.31];
      var fa=sa+1.45+(run?.1:0)*Math.max(0,sw);var to=[an[0]+Math.sin(fa)*.1,an[1]-Math.cos(fa)*.1];
      if(!run){var gy=Math.min(an[1],to[1]);if(gy<.03){an[1]+=.03-gy;to[1]+=.03-gy;}}
      P.hp.push(hp);P.kn.push(kn);P.an.push(an);P.to.push(to);
      var at=-t*(run?1.05:.85),sh2=[nk[0]+(i?.045:-.05),nk[1]-.03],el=[sh2[0]+Math.sin(at)*.24,sh2[1]-Math.cos(at)*.24],fb=at+(run?1.55:.35),hn=[el[0]+Math.sin(fb)*.2,el[1]-Math.cos(fb)*.2];
      P.sh.push(sh2);P.el.push(el);P.hn.push(hn);}
    return sc(P,k||1,0);
  }

  /* ---------- properti ---------- */
  function blanket(g,w,dp,kind){
    /* kain di tanah dilihat agak dari atas: trapesium dengan lipatan */
    var pts=[[-w/2,0],[w/2,0],[w/2-.1,dp],[-w/2+.12,dp]];
    var base=kind==='gingham'?[248,244,236]:kind==='tikar'?[214,184,124]:[150,196,226];
    g.save();poly(g,pts,css(base));g.clip();
    if(kind==='gingham'){g.fillStyle=css([196,48,46],.55);for(var i=-12;i<13;i++){var x0=i*.09;g.beginPath();g.moveTo(x0,0);g.lineTo(x0+.045,0);g.lineTo(x0*.88+.04,dp);g.lineTo(x0*.88,dp);g.fill();}
      for(var j=0;j<6;j++){g.fillRect(-w,j*dp/5.5,w*2,dp/11);}}
    else if(kind==='tikar'){g.strokeStyle=css([160,124,70],.55);g.lineWidth=.008;for(var a=-w;a<w;a+=.03){g.beginPath();g.moveTo(a,0);g.lineTo(a*.9,dp);g.stroke();}
      g.strokeStyle=css([236,210,150],.6);for(var b=0;b<dp;b+=.022){g.beginPath();g.moveTo(-w,b);g.lineTo(w,b);g.stroke();}
      g.strokeStyle=css([180,60,50],.8);g.lineWidth=.02;g.strokeRect(-w/2+.08,.03,w-.18,dp-.07);g.strokeStyle=css([60,90,70],.8);g.lineWidth=.012;g.strokeRect(-w/2+.12,.055,w-.26,dp-.12);}
    else{g.strokeStyle=css([110,160,200],.6);g.lineWidth=.006;for(var c=-w;c<w;c+=.12){g.beginPath();g.moveTo(c,0);g.lineTo(c*.9,dp);g.stroke();}
      g.fillStyle=css([255,255,255],.25);g.fillRect(-w,dp*.45,w*2,.012);}
    /* lipatan dan bayangan lembut */
    var gr=g.createLinearGradient(0,0,0,dp);gr.addColorStop(0,css([0,0,0],.22));gr.addColorStop(.3,css([0,0,0],0));gr.addColorStop(1,css([255,255,255],.12));g.fillStyle=gr;g.fillRect(-w,0,w*2,dp);
    g.strokeStyle=css([0,0,0],.08);g.lineWidth=.02;g.beginPath();g.moveTo(-w*.3,.02);g.quadraticCurveTo(-w*.25,dp*.5,-w*.32,dp);g.stroke();g.beginPath();g.moveTo(w*.18,.0);g.quadraticCurveTo(w*.24,dp*.6,w*.2,dp);g.stroke();
    g.restore();
    g.fillStyle=css(sh(base,-.35));g.beginPath();g.moveTo(-w/2,0);g.lineTo(w/2,0);g.lineTo(w/2+.005,-.018);g.lineTo(-w/2+.01,-.02);g.fill();
  }
  function basket(g,x,y,s){
    s=s||1;var W=.2*s,H=.13*s,c=[176,128,70];
    g.strokeStyle=css(sh(c,-.15));g.lineWidth=.022*s;g.beginPath();g.ellipse(x,y+H,W*.78,H*1.15,0,0,Math.PI);g.stroke();
    ball(g,x,y+H*.5,W,H*.6,c);g.save();g.beginPath();g.rect(x-W,y,W*2,H*1.1);g.clip();
    poly(g,[[x-W,y+H],[x+W,y+H],[x+W*.9,y],[x-W*.9,y]],grad(g,x,y+H/2,LD[0],LD[1],W,c));
    for(var r=0;r<5;r++)for(var k=0;k<9;k++){g.strokeStyle=css(sh(c,(r+k)%2?-.3:.18),.7);g.lineWidth=.008*s;g.beginPath();var xx=x-W+k*W/4.5+(r%2)*W/9,yy=y+r*H/4.6+.01;g.moveTo(xx,yy);g.quadraticCurveTo(xx+W/9,yy+.012*s,xx+W/4.5,yy);g.stroke();}
    g.restore();ball(g,x,y+H,W*1.02,.03*s,sh(c,-.05));
    /* isi: roti panjang dan apel */
    limb(g,[x-W*.3,y+H],[x+W*.25,y+H+.12*s],.028*s,.026*s,[214,160,90]);ball(g,x+W*.5,y+H+.02*s,.04*s,.04*s,[200,40,40]);
    g.fillStyle=css(sh(c,-.25));g.beginPath();g.ellipse(x-W*.45,y+H+.01,W*.4,.02*s,.1,0,TAU);g.fill();
  }
  function cup(g,x,y,c,s){s=s||1;poly(g,[[x-.03*s,y+.065*s],[x+.03*s,y+.065*s],[x+.024*s,y],[x-.024*s,y]],grad(g,x,y+.03,LD[0],LD[1],.03*s,c));g.fillStyle=css(sh(c,-.4));g.beginPath();g.ellipse(x,y+.065*s,.03*s,.008*s,0,0,TAU);g.fill();}
  function thermos(g,x,y,c){limb(g,[x,y+.02],[x,y+.2],.034,.032,c);limb(g,[x,y+.2],[x,y+.24],.026,.026,[220,220,220]);g.fillStyle=css([255,255,255],.25);g.fillRect(x-.02,y+.04,.008,.14);}
  function plate(g,x,y,fn,s){s=s||1;g.fillStyle=css([250,250,246]);g.beginPath();g.ellipse(x,y,.11*s,.03*s,0,0,TAU);g.fill();g.strokeStyle=css([200,200,195]);g.lineWidth=.005;g.stroke();if(fn)fn(g,x,y+.012,s);}
  function melon(g,x,y,s){for(var i=0;i<3;i++){var cx=x-.05*s+i*.045*s;g.fillStyle=css([60,140,60]);g.beginPath();g.moveTo(cx-.03*s,y);g.lineTo(cx+.03*s,y);g.lineTo(cx,y+.07*s);g.closePath();g.fill();
    g.fillStyle=css([235,70,80]);g.beginPath();g.moveTo(cx-.024*s,y+.008*s);g.lineTo(cx+.024*s,y+.008*s);g.lineTo(cx,y+.064*s);g.closePath();g.fill();g.fillStyle=css([30,20,20]);g.fillRect(cx-.006*s,y+.025*s,.005*s,.008*s);g.fillRect(cx+.004*s,y+.035*s,.005*s,.008*s);}}
  function sandwich(g,x,y,s){for(var i=0;i<2;i++){var cx=x-.03*s+i*.06*s;poly(g,[[cx-.035*s,y],[cx+.035*s,y],[cx,y+.06*s]],css([236,206,150]));g.fillStyle=css([110,170,70]);g.fillRect(cx-.03*s,y+.012*s,.06*s,.008*s);g.fillStyle=css([230,120,110]);g.fillRect(cx-.025*s,y+.022*s,.05*s,.007*s);}}
  function steamTex(ph){return cv(.3,.55,.15,0,function(g){
    for(var i=0;i<3;i++){var o=i*.3+ph;g.strokeStyle=css([255,255,255],.5-i*.1);g.lineWidth=.022-i*.004;g.beginPath();
      for(var y=0;y<.5;y+=.02){var x=Math.sin(y*14+o*TAU)*.035*(y*2+.3)+(i-1)*.03;y?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
    var gr=g.createLinearGradient(0,0,0,.5);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');g.globalCompositeOperation='destination-out';g.fillStyle=gr;g.fillRect(-.2,0,.4,.55);});}

  /* anjing golden: siklus lari 4 bingkai (+ bingkai duduk) */
  function dogTex(ph,sit,mouthBall){return cv(.95,.65,.42,.02,function(g){
    var c=[214,160,82],a=ph*TAU,by=sit?.3:.34+.025*Math.abs(Math.sin(a)),bt=sit?-.35:0;
    shadow(g,0,0,.4,.05,.3);
    function lg(x,y,ang,ang2,k){var kn=[x+Math.sin(ang)*.13,y-Math.cos(ang)*.13],ft=[kn[0]+Math.sin(ang2)*.14,Math.max(.025,kn[1]-Math.cos(ang2)*.14)];limb(g,[x,y],kn,.045,.03,sh(c,k));limb(g,kn,ft,.03,.024,sh(c,k));ball(g,ft[0]+.02,ft[1],.03,.02,sh(c,k-.1));}
    if(sit){lg(-.2,.22,.4,-.4,-.2);lg(.14,.25,.05,.05,-.2);}else{lg(-.18,by,Math.sin(a)*.7,Math.sin(a)*.7+.5,-.22);lg(.18,by,-Math.sin(a+1)*.75,-Math.sin(a+1)*.75-.35,-.22);}
    /* ekor berbulu */
    limb(g,[-.27,by+.04],[-.42,by+.16+.05*Math.sin(a*2)],.03,.02,sh(c,-.05));
    for(var t=0;t<4;t++){var q=lp([-.3,by+.06],[-.42,by+.16],t/3);ball(g,q[0],q[1]-.015,.035,.022,sh(c,.05),.4);}
    ball(g,0,by+.02,.3,.12,c,bt*.3);g.fillStyle=css([245,228,190],.6);g.beginPath();g.ellipse(.12,by-.06,.14,.04,0,0,TAU);g.fill();
    if(sit){lg(-.12,.2,.35,-.5,0);lg(.2,.26,.0,.0,0);}else{lg(-.13,by,-Math.sin(a+.3)*.7,-Math.sin(a+.3)*.7+.55,0);lg(.22,by,Math.sin(a+1.2)*.75,Math.sin(a+1.2)*.75-.35,0);}
    var hx0=sit?.27:.31,hy=sit?.52:by+.13;limb(g,[.18,by+.04],[hx0,hy-.04],.075,.055,c);
    ball(g,hx0,hy,.085,.075,c);limb(g,[hx0+.04,hy-.015],[hx0+.13,hy-.035],.04,.032,sh(c,.08));
    ball(g,hx0+.155,hy-.03,.018,.016,[30,24,22]);
    ball(g,hx0-.04,hy-.01,.035,.07,sh(c,-.25),-.3);
    g.fillStyle=css([25,18,15]);g.beginPath();g.arc(hx0+.04,hy+.025,.012,0,TAU);g.fill();
    if(!mouthBall&&!sit){g.fillStyle=css([220,90,100]);g.beginPath();g.ellipse(hx0+.1,hy-.07,.022,.012,.3,0,TAU);g.fill();}
    if(mouthBall)ball(g,hx0+.12,hy-.05,.035,.035,[214,232,74]);
    limb(g,[.2,by+.07],[.25,by+.0],.02,.02,[200,50,50]);
  });}

  /* layangan wajik dengan kerangka bambu dan ekor; 3 bingkai ekor berkibar */
  function kiteTex(ph,c1,c2){return cv(.8,1.5,.4,1.05,function(g){
    var top=[0,.38],rt=[.27,.05],bt=[0,-.38],lf=[-.27,.05];
    g.save();poly(g,[top,rt,bt,lf],css(c1));g.clip();poly(g,[top,rt,[0,0.05]],css(c2));poly(g,[bt,lf,[0,0.05]],css(c2));
    var gr=g.createLinearGradient(-.3,.3,.3,-.3);gr.addColorStop(0,'rgba(255,255,255,.25)');gr.addColorStop(1,'rgba(0,0,0,.2)');g.fillStyle=gr;g.fillRect(-.3,-.4,.6,.8);g.restore();
    line(g,[top,bt],css([110,80,40]),.012);g.strokeStyle=css([110,80,40]);g.lineWidth=.01;g.beginPath();g.moveTo(lf[0],lf[1]);g.quadraticCurveTo(0,.17,rt[0],rt[1]);g.stroke();
    /* ekor pita */
    g.strokeStyle=css(c2);g.lineWidth=.018;g.beginPath();g.moveTo(0,-.38);
    for(var y=0;y<1;y+=.04){g.lineTo(Math.sin(y*7-ph*TAU)*.1*y,-.38-y);}g.stroke();
    for(var b=1;b<4;b++){var yb=b*.24,xb=Math.sin(yb*7-ph*TAU)*.1*yb;g.fillStyle=css(b%2?c1:c2);g.beginPath();g.moveTo(xb,-.38-yb);g.lineTo(xb-.05,-.38-yb+.03);g.lineTo(xb-.05,-.38-yb-.03);g.fill();g.beginPath();g.moveTo(xb,-.38-yb);g.lineTo(xb+.05,-.38-yb+.03);g.lineTo(xb+.05,-.38-yb-.03);g.fill();}
  });}
  function bubbleTex(){return cv(.2,.2,.1,.1,function(g){
    var r=.09,gr=g.createRadialGradient(0,0,r*.6,0,0,r);gr.addColorStop(0,'rgba(255,255,255,0.03)');gr.addColorStop(.8,'rgba(200,240,255,.25)');gr.addColorStop(.93,'rgba(255,190,240,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.strokeStyle='rgba(170,255,220,.45)';g.lineWidth=.006;g.beginPath();g.arc(0,0,r*.9,Math.PI*1.1,Math.PI*1.6);g.stroke();
    g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.ellipse(-r*.38,r*.4,r*.18,r*.1,-.7,0,TAU);g.fill();});}
  function butterflyTex(open,c){return cv(.2,.16,.1,.08,function(g){
    var k=open?1:.35;[[1,1],[-1,1]].forEach(function(s){g.save();g.scale(s[0]*k,1);ball(g,.04,.03,.045,.035,c,.5);ball(g,.035,-.025,.03,.025,sh(c,-.1),-.4);
      g.fillStyle=css([40,30,30],.8);g.beginPath();g.arc(.06,.04,.01,0,TAU);g.fill();g.restore();});
    limb(g,[0,-.04],[0,.04],.008,.006,[40,30,30]);});}
  function snowball(g,x,y,r){ball(g,x,y,r,r,[246,250,252]);g.fillStyle='rgba(160,185,210,.35)';g.beginPath();g.arc(x+r*.25,y-r*.3,r*.6,0,TAU);g.fill();}
  function snowMound(w,h,seed){return cv(w+.1,h+.06,w/2+.05,.03,function(g){var R=rng(seed);
    shadow(g,0,0,w*.55,.05,.18,[90,110,150]);
    var pts=[];for(var i=0;i<=10;i++){var t=i/10,x=-w/2+w*t;pts.push([x,Math.sin(t*Math.PI)*h*(.75+R()*.3)]);}pts.push([w/2,0],[-w/2,0]);
    poly(g,pts,grad(g,0,h/2,LD[0],LD[1],h,[240,245,250],.6),true);
    g.fillStyle='rgba(140,165,205,.25)';g.beginPath();g.ellipse(w*.15,h*.25,w*.35,h*.3,0,0,TAU);g.fill();
    g.fillStyle='rgba(255,255,255,.7)';for(var s=0;s<8;s++){g.beginPath();g.arc(-w/2+R()*w,R()*h*.8,.006,0,TAU);g.fill();}});}

  /* ---------- tekstur dan entitas per adegan ----------
     Entitas: {c: kanvas atau daftar bingkai, x, dy (jarak di bawah punggung bukit; makin besar makin "dekat"), z, s (skala),
     fade (boolean, bingkai disilangkan halus), upd(t,e,W): animasi tiap bingkai}. */
  function ent(c,x,dy,o){o=o||{};o.c=c;o.x=x;o.dy=dy;o.z=o.z==null?.1+dy*.04:o.z;o.s=o.s||1+dy*.1;return o;}
  var frames=function(n,fn){var a=[];for(var i=0;i<n;i++)a.push(fn(i/n,i));return a;};

  /* ===== FAJAR: piknik keluarga, anak melempar bola untuk anjing, pelari pagi, kakek senam ===== */
  function sceneSunrise(){
    var E=[];
    var famO={skin:'#B97F55',hair:'#1A1412'};
    var picnic=cv(2.3,1.25,1.15,.08,function(g){
      shadow(g,0,.06,1.1,.12,.22);blanket(g,1.9,.36,'gingham');
      basket(g,-.85,.2,1.15);thermos(g,.78,.2,[60,120,110]);cup(g,.9,.17,[240,240,235]);
      plate(g,-.18,.07,melon);plate(g,.62,.08,sandwich);
      /* ayah: duduk santai, lutut ditekuk, satu tangan bertumpu di belakang */
      fig(g,sc({hd:[-.07,.67],nk:[-.1,.55],pe:[0,.1],sh:[[-.16,.52],[-.04,.51]],el:[[-.27,.33],[.08,.38]],hn:[[-.36,.1],[.2,.4]],
        hp:[[-.03,.11],[.03,.1]],kn:[[.2,.36],[.25,.33]],an:[[.36,.06],[.42,.05]],to:[[.45,.05],[.51,.04]]},1,-.62,.1),
        {skin:famO.skin,hair:famO.hair,top:'#3E6E8E',tk:'tee',bot:'#C8B48A',bk:'pants',shoe:'#F2F0EA',d:1,hat:'cap',hatc:'#2E4A60',beard:true});
      /* ibu berhijab dan bergamis: bersimpuh, menuang teh dari termos ke cangkir */
      fig(g,sc({hd:[.07,.71],nk:[.04,.6],pe:[0,.2],sh:[[-.02,.57],[.09,.56]],el:[[.14,.42],[.17,.45]],hn:[[.27,.38],[.27,.5]],
        hp:[[-.03,.2],[.03,.19]],kn:[[.2,.07],[.22,.05]],an:[[-.12,.04],[-.08,.03]],to:[[-.19,.03],[-.16,.02]],
        sk:[[-.1,.36],[.1,.36],[.3,.12],[.29,0],[-.2,0],[-.15,.12]]},1,.42,.08),
        {skin:'#D7A27A',hs:'hijab',hijab:'#C9798B',long:true,top:'#F3E3C8',tk:'long',bk:'skirt',skirt:'#5C4A6E',shoe:'#5C4A6E',d:-1,
         hold:[function(g,h){cup(g,h[0]-.01,h[1]-.04,[240,240,235],.9);},function(g,h){limb(g,[h[0]+.03,h[1]-.04],[h[0]-.05,h[1]+.08],.022,.02,[60,120,110]);limb(g,[h[0]-.05,h[1]+.08],[h[0]-.065,h[1]+.1],.016,.016,[220,220,220]);}]});
      /* balita di depan: duduk makan semangka */
      fig(g,sc({hd:[.03,.43],nk:[.02,.35],pe:[0,.08],sh:[[-.04,.33],[.06,.33]],el:[[-.03,.22],[.11,.24]],hn:[[.03,.17],[.13,.33]],
        hp:[[-.02,.08],[.03,.08]],kn:[[.15,.11],[.17,.07]],an:[[.27,.04],[.3,.03]],to:[[.31,.08],[.34,.07]]},1,.05,-.05),
        {skin:'#C99068',hair:'#2a1d18',top:'#F6C445',tk:'tee',bot:'#E1735A',bk:'shorts',shoe:'#F5F5F2',s:.66,hr:.068,kid:true,d:1,
         hold:[null,function(g,h){g.fillStyle=css([60,140,60]);g.beginPath();g.moveTo(h[0]-.03,h[1]);g.lineTo(h[0]+.04,h[1]);g.lineTo(h[0],h[1]+.07);g.fill();g.fillStyle=css([235,70,80]);g.beginPath();g.moveTo(h[0]-.022,h[1]+.008);g.lineTo(h[0]+.032,h[1]+.008);g.lineTo(h[0],h[1]+.062);g.fill();}]});
    });
    E.push(ent(picnic,-2.0,1.25,{id:'picnic',breath:.004}));
    var steam=frames(3,function(p){return steamTex(p);});
    E.push(ent(steam,-2.0,1.25,{fade:1,s:1.12,z:.18,upd:function(t,e){e.f=t*.9;e.ox=.15;e.oy=.5;e.a=.5+.2*Math.sin(t*1.3);}}));
    /* anak melempar bola: 2 bingkai (siap & lempar) */
    var kidO={skin:'#B47A50',hair:'#1b1310',top:'#E85D3F',tk:'tee',stripe:'#F7E6C8',bot:'#2F4F6F',bk:'shorts',shoe:'#F2F2F2',s:.8,hr:.072,kid:true,d:1};
    var kid=[cv(.8,1.2,.4,.02,function(g){shadow(g,0,.02,.22,.04,.3);fig(g,stand({k:.78,el:[[-.06,.85],[-.17,1.0]],hn:[[-.02,.66],[-.22,1.18]]}),kidO);}),
             cv(.8,1.2,.4,.02,function(g){shadow(g,0,.02,.22,.04,.3);fig(g,stand({k:.78,el:[[-.1,.88],[.16,1.08]],hn:[[-.16,.72],[.32,1.15]],kn:[[-.08,.38],[.08,.38]],an:[[-.12,.06],[.1,.06]],to:[[-.04,.03],[.19,.03]]}),kidO);})];
    var ballC=cv(.1,.1,.05,.05,function(g){ball(g,0,0,.04,.04,[214,232,74]);g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=.006;g.beginPath();g.arc(-.03,0,.035,-1,1);g.stroke();});
    var dogR=frames(4,function(p){return dogTex(p,false,false);}),dogB=frames(4,function(p){return dogTex(p,false,true);}),dogS=dogTex(0,true,false);
    var KX=1.7,FX=6.2,CY=7.2;
    /* koreografi: lempar (0-.6s), bola melambung, anjing lari mengejar, kembali membawa bola, duduk menunggu */
    function fetch(t){var c=t%CY;return c;}
    E.push(ent(kid,KX,1.2,{id:'kid',upd:function(t,e){var c=fetch(t);e.f=c>.35&&c<1.0?1:0;}}));
    E.push(ent(ballC,KX,1.2,{s:1.1,z:.2,upd:function(t,e,W){var c=fetch(t);
      if(c<.45){e.a=1;e.x=KX-.18;e.oy=1.0;}
      else if(c<2.0){var u=(c-.45)/1.55;e.a=1;e.x=KX+(FX-KX)*u;e.oy=.95+2.2*u*(1-u)*1.6-u*.9;}
      else if(c<2.2){e.a=1;e.x=FX;e.oy=.06;}
      else e.a=0;}}));
    E.push(ent(dogS,KX+.9,1.28,{id:'dog',upd:function(t,e){var c=fetch(t);
      if(c<.8){e.c=dogS;e.x=KX+.75;e.flip=1;}
      else if(c<2.3){var u=(c-.8)/1.5;u=u*u*(3-2*u);e.c=dogR[(t*10|0)%4];e.x=KX+.75+(FX-.25-KX-.75)*u;e.flip=1;}
      else if(c<4.2){var v=(c-2.3)/1.9;v=v*v*(3-2*v);e.c=dogB[(t*10|0)%4];e.x=FX-.25+(KX+.75-FX+.25)*v;e.flip=-1;}
      else{e.c=dogS;e.x=KX+.75;e.flip=-1;}}}));
    /* pelari pagi melintas di kejauhan dengan earphone */
    var runO={skin:'#9C6A45',hair:'#141010',top:'#2F8F83',tk:'tank',bot:'#24282E',bk:'shorts',shoe:'#F25C3B',hat:'phones',d:1};
    var runner=frames(8,function(p){return cv(1,1.5,.5,.03,function(g){shadow(g,0,.02,.22,.04,.22);fig(g,gait(p,true,1),runO);});});
    E.push(ent(runner,-16,.42,{s:.86,z:.06,upd:function(t,e,W){var c=(t+6)%26;e.x=-17+c*1.45;e.f=Math.floor(t*12)%8;e.follow=1;e.a=e.x>17?0:1;}}));
    /* kakek senam pagi: 3 bingkai disilangkan halus */
    var gpO={skin:'#A9774F',hair:'#d9d6d0',top:'#F2EEE4',tk:'tee',bot:'#556070',bk:'pants',shoe:'#3A3530',glasses:true,hs:'short',grey:true,d:1};
    var gp=[cv(.9,1.6,.45,.02,function(g){shadow(g,0,.02,.25,.04,.28);fig(g,stand({el:[[-.12,.86],[.14,.86]],hn:[[-.18,.68],[.2,.68]]}),gpO);}),
            cv(.9,1.6,.45,.02,function(g){shadow(g,0,.02,.25,.04,.28);fig(g,stand({el:[[-.26,1.05],[.27,1.04]],hn:[[-.42,1.07],[.44,1.06]]}),gpO);}),
            cv(.9,1.6,.45,.02,function(g){shadow(g,0,.02,.25,.04,.28);fig(g,stand({el:[[-.12,1.3],[.13,1.3]],hn:[[-.05,1.48],[.06,1.48]]}),gpO);})];
    E.push(ent(gp,-5.6,1.15,{fade:1,upd:function(t,e){var p=(Math.sin(t*.9)*.5+.5)*2;e.f=p;}}));
    return E;
  }

  /* ===== KEMARAU: musim layangan, main gitar di atas tikar, membaca buku ===== */
  function sceneAutumn(){
    var E=[];
    var mat=cv(2.4,1.25,1.2,.08,function(g){
      shadow(g,0,.06,1.12,.12,.2);blanket(g,1.9,.34,'tikar');
      /* tumpukan daun kering di tepi */
      var R=rng(7);for(var i=0;i<40;i++){var x=-1.05+R()*.3,y=R()*.08;g.fillStyle=css([[196,110,40],[170,70,30],[220,160,60]][i%3]);g.beginPath();g.ellipse(x,y,.03,.014,R()*3,0,TAU);g.fill();}
      thermos(g,.62,.2,[190,70,50]);cup(g,.72,.18,[230,190,120]);cup(g,.5,.14,[230,190,120]);
      /* piring gorengan */
      plate(g,.18,.14,function(g,x,y){for(var k=0;k<5;k++)ball(g,x-.05+k*.025,y+.01+(k%2)*.012,.026,.016,[200,140,60]);});
    });
    E.push(ent(mat,-1.6,1.25,{id:'mat'}));
    /* pemain gitar bersila: 3 bingkai petikan */
    var gtO={skin:'#9E6B45',hair:'#1A1210',hs:'curly',top:'#F1E7D2',tk:'long',batik:'#8A4B2A',bot:'#3A3F4A',bk:'pants',shoe:'#5a3d2a',d:1};
    function guitar(g,P){var c=[150,86,40],cx=P.pe[0]+.1,cy=P.pe[1]+.2;g.save();g.translate(cx,cy);g.rotate(.5);
      ball(g,0,0,.13,.1,c);ball(g,.12,0,.1,.08,c);g.fillStyle=css([40,25,15]);g.beginPath();g.arc(.06,0,.032,0,TAU);g.fill();
      limb(g,[.2,0],[.55,0],.022,.018,[60,36,20]);limb(g,[.55,0],[.62,0],.026,.022,[40,26,16]);g.strokeStyle='rgba(240,230,200,.7)';g.lineWidth=.003;g.beginPath();g.moveTo(-.06,0);g.lineTo(.6,0);g.stroke();g.restore();}
    var gt=frames(3,function(p,i){return cv(1.1,1.0,.5,.03,function(g){
      var sy=i*.025;fig(g,sc({hd:[.06,.67],nk:[.03,.55],pe:[0,.12],sh:[[-.04,.52],[.09,.51]],el:[[.2,.4],[.0,.32]],hn:[[.44,.43],[.12-.0,.27+sy]],
        hp:[[-.05,.13],[.05,.12]],kn:[[-.2,.16],[.24,.14]],an:[[.12,.06],[-.02,.05]],to:[[.18,.04],[.04,.03]]},1,0),
        Object.assign({mid:function(g,P){guitar(g,P);}},gtO));});});
    E.push(ent(gt,-2.35,1.18,{fade:1,z:.17,upd:function(t,e){e.f=(Math.sin(t*5)*.5+.5)*2;e.oy=Math.sin(t*2.5)*.004;}}));
    /* gadis berhijab duduk miring memegang es teh, kepala mengangguk mengikuti lagu */
    var hjO={skin:'#D49C74',hs:'hijab',hijab:'#4E8C7A',long:true,top:'#F0C27A',tk:'long',bk:'skirt',skirt:'#7B5B44',shoe:'#7B5B44',d:-1};
    var girl=frames(2,function(p,i){return cv(1,1.0,.5,.03,function(g){
      fig(g,sc({hd:[.05+i*.012,.68-i*.006],nk:[.03,.57],pe:[0,.14],sh:[[-.03,.54],[.08,.53]],el:[[-.06,.36],[.14,.38]],hn:[[-.14,.17],[.22,.42]],
        hp:[[-.03,.14],[.04,.13]],kn:[[.24,.1],[.26,.07]],an:[[.06,.04],[.1,.03]],to:[[-.02,.03],[.02,.02]],sk:[[-.12,.3],[.12,.3],[.36,.06],[-.06,.02]]},1,0),
        Object.assign({hold:[null,function(g,h){poly(g,[[h[0]-.03,h[1]+.06],[h[0]+.03,h[1]+.06],[h[0]+.024,h[1]-.04],[h[0]-.024,h[1]-.04]],'rgba(170,90,30,.85)');g.fillStyle='rgba(255,255,255,.4)';g.fillRect(h[0]-.022,h[1]-.03,.008,.08);limb(g,[h[0]+.01,h[1]+.05],[h[0]+.03,h[1]+.13],.005,.005,[240,240,240]);}]},hjO));});});
    E.push(ent(girl,-.75,1.2,{fade:1,z:.16,upd:function(t,e){e.f=Math.sin(t*2.5)*.5+.5;}}));
    /* pembaca tengkurap, kaki berayun (3 bingkai) */
    var rdO={skin:'#C38D63',hair:'#3a2618',hs:'pony',top:'#7DA3C8',tk:'long',bot:'#2F3A4A',bk:'pants',shoe:'#E9E4DA',d:1};
    var rd=frames(4,function(p,i){var a=Math.sin(p*TAU),b=Math.sin(p*TAU+1.6);return cv(1.5,.8,.75,.03,function(g){
      shadow(g,0,.03,.65,.06,.25);
      fig(g,{hd:[.45,.2],nk:[.33,.15],pe:[-.12,.1],sh:[[.32,.13],[.36,.11]],el:[[.36,.04],[.45,.03]],hn:[[.5,.12],[.56,.1]],
        hp:[[-.12,.11],[-.14,.09]],kn:[[-.42,.08],[-.44,.06]],an:[[-.44+.2*Math.sin(.6+a*.5),.08+.24*Math.cos(.6+a*.5)],[-.46+.2*Math.sin(.9+b*.5),.06+.24*Math.cos(.9+b*.5)]],
        to:[[-.44+.3*Math.sin(.6+a*.5),.1+.28*Math.cos(.6+a*.5)],[-.46+.3*Math.sin(.9+b*.5),.08+.28*Math.cos(.9+b*.5)]]},
        Object.assign({post:function(g){poly(g,[[.5,.02],[.66,.04],[.64,.2],[.5,.17]],css([245,240,228]));poly(g,[[.5,.02],[.36,.06],[.38,.2],[.5,.17]],css([232,226,212]));line(g,[[.5,.02],[.5,.17]],css([120,60,50]),.008);
          g.fillStyle=css([180,60,50]);g.fillRect(.6,.04,.012,.14);}},rdO));});});
    E.push(ent(rd,-4.6,1.55,{fade:0,upd:function(t,e){e.f=Math.floor(t*4)%4;}}));
    /* bocah menerbangkan layangan, tangan terangkat memegang benang */
    var kO={skin:'#9A6644',hair:'#120d0b',top:'#F2C14E',tk:'tee',bot:'#B04A3A',bk:'shorts',shoe:'#2F2A26',hat:'straw',hatc:'#C0392B',s:.82,hr:.072,kid:true,d:1};
    var kiteKid=frames(2,function(p,i){return cv(.9,1.25,.45,.02,function(g){shadow(g,0,.02,.24,.04,.3);
      fig(g,stand({k:.8,el:[[-.1,.9],[.14,1.1-i*.03]],hn:[[-.04,.75],[.26,1.3-i*.05]],kn:[[-.06,.38],[.07,.38]],an:[[-.09,.06],[.1,.06]],to:[[-.01,.03],[.19,.03]]}),kO);});});
    var KK=2.3;
    E.push(ent(kiteKid,KK,1.0,{id:'kk',fade:1,upd:function(t,e){e.f=Math.sin(t*1.7)*.5+.5;}}));
    var kt=frames(4,function(p){return kiteTex(p,[214,58,52],[250,240,220]);});
    E.push(ent(kt,KK+3.6,-5.2,{id:'kite',s:1.0,z:.3,fade:1,upd:function(t,e){e.f=(t*2.4)%4;e.x=KK+3.6+Math.sin(t*.43)*.7+Math.sin(t*1.3)*.12;e.oy=Math.sin(t*.61)*.35+Math.sin(t*1.7)*.06;e.rot=Math.sin(t*.9)*.18+Math.sin(t*2.3)*.05;}}));
    E.push({line:1,col:[250,250,245],a:.75,upd:function(t,e,W){var h=W.pt('kk',(.26*.8),(1.3*.8)-.03*(1-(Math.sin(t*1.7)*.5+.5))),k=W.pt('kite',0,-.0);e.a0=h;e.a1=k;e.sag=.35;}});
    /* layangan kedua lebih jauh, benangnya turun ke luar layar */
    var kt2=frames(4,function(p){return kiteTex(p,[40,110,170],[250,214,80]);});
    E.push(ent(kt2,9.5,-7.4,{id:'kite2',s:.62,z:.05,fade:1,upd:function(t,e){e.f=(t*2.1+1)%4;e.x=9.5+Math.sin(t*.37+2)*.6;e.oy=Math.sin(t*.5+1)*.3;e.rot=Math.sin(t*.8+1)*.2;}}));
    E.push({line:1,col:[250,250,245],a:.5,upd:function(t,e,W){e.a0=[24,W.ground(16)-1.5];e.a1=W.pt('kite2',0,0);e.sag=.5;}});
    return E;
  }

  /* ===== SALJU: membuat manusia salju, perang bola salju, minum cokelat panas, kereta luncur ===== */
  function sceneSnow(){
    var E=[],shC=[80,100,140];
    E.push(ent(snowMound(1.4,.16,3),-3.8,1.42,{z:.12}));E.push(ent(snowMound(1.1,.12,5),2.6,1.3,{z:.12}));E.push(ent(snowMound(.9,.1,9),-.9,1.55,{z:.2}));
    /* manusia salju dengan syal merah, topi, wortel, ranting */
    var sm=cv(1.3,1.6,.65,.03,function(g){shadow(g,0,.03,.42,.06,.25,shC);
      limb(g,[-.12,.72],[-.42,.92],.012,.008,[90,60,40]);limb(g,[-.38,.88],[-.46,.86],.007,.005,[90,60,40]);
      snowball(g,0,.24,.26);snowball(g,0,.62,.19);snowball(g,.01,.93,.14);
      limb(g,[.12,.7],[.42,.86],.012,.008,[90,60,40]);limb(g,[.37,.83],[.42,.94],.007,.005,[90,60,40]);
      for(var i=0;i<3;i++){g.fillStyle=css([30,30,34]);g.beginPath();g.arc(.03,.52+i*.08,.016,0,TAU);g.fill();}
      g.fillStyle=css([25,25,28]);g.beginPath();g.arc(-.02,.97,.016,0,TAU);g.arc(.06,.97,.016,0,TAU);g.fill();
      for(var m=0;m<5;m++){g.beginPath();g.arc(-.03+m*.025,.875-Math.sin(m/4*Math.PI)*.02,.008,0,TAU);g.fill();}
      g.fillStyle=css([235,120,40]);g.beginPath();g.moveTo(.07,.94);g.lineTo(.22,.915);g.lineTo(.07,.91);g.fill();
      limb(g,[-.15,.79],[.16,.79],.04,.04,[200,40,45]);limb(g,[.1,.78],[.14,.6],.03,.026,[185,35,40]);
      g.fillStyle=css([28,26,30]);g.beginPath();g.ellipse(0,1.05,.17,.03,0,0,TAU);g.fill();poly(g,[[-.1,1.06],[.1,1.06],[.09,1.24],[-.09,1.24]],css([36,34,40]));g.fillStyle=css([200,40,45]);g.fillRect(-.1,1.08,.2,.035);});
    E.push(ent(sm,-3.7,1.3,{z:.14}));
    /* anak bermantel mengeratkan topi manusia salju (2 bingkai) */
    var c1={skin:'#D9A47C',hair:'#2a1b14',top:'#2F7FBF',tk:'puffer',bot:'#3D3A48',bk:'pants',boots:'#6B4A32',shoe:'#4A3424',hat:'beanie',hatc:'#F2C14E',pom:'#FFFFFF',scarf:'#E2543E',mit:'#E2543E',s:.82,hr:.072,kid:true,d:1};
    var sk=frames(2,function(p,i){return cv(.9,1.3,.45,.02,function(g){shadow(g,0,.02,.24,.04,.25,shC);
      fig(g,stand({k:.8,el:[[-.02,.95],[.16,1.04+i*.04]],hn:[[.14,1.05],[.3,1.18+i*.05]]}),c1);});});
    E.push(ent(sk,-4.45,1.36,{fade:1,z:.16,upd:function(t,e){e.f=Math.sin(t*2.2)*.5+.5;}}));
    /* orang tua dengan cokelat panas */
    var pO={skin:'#B07A52',hair:'#16100d',top:'#7A2F3A',tk:'coat',bot:'#2A2D36',bk:'pants',boots:'#3E2C22',shoe:'#2c201a',hat:'beanie',hatc:'#3E4E5E',pom:'#C9D3DA',scarf:'#E8DCC4',mit:'#3E4E5E',d:1,glasses:true};
    var par=cv(.9,1.6,.45,.02,function(g){shadow(g,0,.02,.26,.04,.26,shC);fig(g,stand({el:[[-.08,.85],[.12,.86]],hn:[[-.06,.66],[.15,1.02]]}),Object.assign({hold:[null,function(g,h){cup(g,h[0]+.02,h[1]-.03,[245,245,240],1.1);}]},pO));});
    E.push(ent(par,-1.8,1.08,{breath:.006}));
    var steam=frames(3,function(p){return steamTex(p);});
    E.push(ent(steam,-1.8,1.08,{fade:1,s:.9,z:.2,upd:function(t,e){e.f=t*.9;e.ox=.19;e.oy=1.18;e.a=.55+.2*Math.sin(t*1.1);}}));
    /* perang bola salju: pelempar dan sasaran yang merunduk */
    var aO={skin:'#C48E64',hair:'#1a1210',hs:'pony',top:'#D94F70',tk:'puffer',bot:'#2E3440',bk:'pants',boots:'#F2EEE8',shoe:'#d0ccc4',hat:'beanie',hatc:'#F4F1EA',pom:'#D94F70',mit:'#F4F1EA',s:.82,hr:.072,kid:true,d:1};
    var bO={skin:'#9A6644',hair:'#120d0b',top:'#3FA07A',tk:'puffer',bot:'#3A3550',bk:'pants',boots:'#5A3E2A',shoe:'#3a2a1e',hat:'beanie',hatc:'#E8A33C',pom:'#E8A33C',scarf:'#2F5F8F',mit:'#2F5F8F',s:.82,hr:.072,kid:true,d:-1};
    var thr=[cv(.9,1.3,.45,.02,function(g){shadow(g,0,.02,.24,.04,.25,shC);fig(g,stand({k:.8,el:[[-.06,.85],[-.18,1.0]],hn:[[0,.7],[-.24,1.16]]}),Object.assign({hold:[null,function(g,h){snowball(g,h[0],h[1]+.03,.04);}]},aO));}),
             cv(.9,1.3,.45,.02,function(g){shadow(g,0,.02,.24,.04,.25,shC);fig(g,stand({k:.8,el:[[-.12,.86],[.17,1.05]],hn:[[-.2,.72],[.33,1.1]],kn:[[-.08,.38],[.08,.38]],an:[[-.12,.06],[.1,.06]],to:[[-.04,.03],[.19,.03]]}),aO);})];
    var duck=[cv(.9,1.3,.45,.02,function(g){shadow(g,0,.02,.24,.04,.25,shC);fig(g,stand({k:.8,el:[[-.1,.88],[.14,.86]],hn:[[-.06,.7],[.2,.7]]}),Object.assign({hold:[null,function(g,h){snowball(g,h[0],h[1],.04);}]},bO));}),
              cv(.9,1.3,.45,.02,function(g){shadow(g,0,.02,.24,.04,.25,shC);
                fig(g,sc({hd:[.1,.72],nk:[.06,.6],pe:[0,.36],sh:[[.02,.58],[.1,.57]],el:[[.12,.62],[.2,.6]],hn:[[.16,.78],[.22,.76]],hp:[[-.03,.36],[.03,.35]],kn:[[.14,.24],[.2,.22]],an:[[.02,.05],[.08,.05]],to:[[.1,.03],[.16,.03]]},.8,0),bO);})];
    var AX=.9,BX=4.0,CYS=4.2;
    E.push(ent(thr,AX,1.12,{upd:function(t,e){var c=t%CYS;e.f=c>1.2&&c<1.9?1:0;}}));
    E.push(ent(duck,BX,1.0,{upd:function(t,e){var c=t%CYS;e.f=c>1.7&&c<2.9?1:0;}}));
    var sbC=cv(.12,.12,.06,.06,function(g){snowball(g,0,0,.045);});
    E.push(ent(sbC,AX,1.1,{s:1.1,z:.22,upd:function(t,e){var c=t%CYS;if(c<1.3||c>2.35){e.a=0;return;}var u=(c-1.3)/1.05;e.a=1;e.x=AX+.25+(BX-AX-.2)*u;e.oy=.95+u*(1-u)*1.6-u*.25;e.rot=u*6;}}));
    var puff=frames(3,function(p){return cv(.5,.4,.25,.05,function(g){var R=rng(11);for(var i=0;i<14;i++){var a=R()*Math.PI,r=.05+p*.16*R();g.fillStyle='rgba(255,255,255,'+(.85-p*.6)+')';g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r*.8,.018+.02*(1-p),0,TAU);g.fill();}});});
    E.push(ent(puff,BX-.1,1.0,{fade:1,s:1.1,z:.22,upd:function(t,e){var c=t%CYS;if(c<2.35||c>2.95){e.a=0;return;}var u=(c-2.35)/.6;e.a=1-u;e.f=u*2;e.oy=.95;}}));
    /* ayah menarik kereta luncur berisi balita, melintas pelan */
    var wO={skin:'#A06E48',hair:'#100c0a',top:'#3D5A40',tk:'puffer',bot:'#2A2B30',bk:'pants',boots:'#4B3527',shoe:'#2c201a',hat:'beanie',hatc:'#B33A3A',pom:'#F0EBE2',scarf:'#D9C38C',mit:'#2A2B30',d:1};
    var walk=frames(8,function(p){return cv(1,1.6,.5,.03,function(g){shadow(g,0,.02,.24,.04,.24,shC);
      var P=gait(p,false,1);P.el[0]=[P.sh[0][0]-.1,P.sh[0][1]-.22];P.hn[0]=[P.sh[0][0]-.22,P.sh[0][1]-.36];fig(g,P,wO);});});
    var tO={skin:'#D6A07A',hair:'#2a1d18',top:'#F2A33C',tk:'puffer',bot:'#5A4A8A',bk:'pants',shoe:'#5A4A8A',hat:'beanie',hatc:'#5A4A8A',pom:'#F2A33C',mit:'#5A4A8A',s:.66,hr:.068,kid:true,d:1};
    var sled=cv(1,.75,.6,.03,function(g){shadow(g,-.05,.03,.42,.05,.22,shC);
      fig(g,sc({hd:[.03,.43],nk:[.02,.35],pe:[0,.12],sh:[[-.04,.33],[.06,.33]],el:[[-.03,.22],[.12,.25]],hn:[[.04,.2],[.18,.22]],hp:[[-.02,.12],[.03,.12]],kn:[[.15,.16],[.17,.14]],an:[[.25,.1],[.28,.09]],to:[[.29,.14],[.32,.13]]},1,-.1),tO);
      poly(g,[[-.42,.12],[.28,.12],[.3,.06],[-.4,.06]],grad(g,0,.09,LD[0],LD[1],.05,[176,52,44]));
      g.strokeStyle=css([60,60,66]);g.lineWidth=.016;g.beginPath();g.moveTo(-.44,.03);g.lineTo(.3,.03);g.quadraticCurveTo(.42,.03,.38,.12);g.stroke();
      line(g,[[-.3,.06],[-.3,.03]],css([60,60,66]),.012);line(g,[[.15,.06],[.15,.03]],css([60,60,66]),.012);});
    var SL=40;
    E.push(ent(walk,-15,.6,{id:'walker',s:.92,z:.08,upd:function(t,e){var c=(t+12)%SL;e.x=-16+c*.85;e.f=Math.floor(t*7)%8;e.follow=1;e.a=e.x>17?0:1;}}));
    E.push(ent(sled,-15,.6,{id:'sled',s:.92,z:.07,upd:function(t,e){var c=(t+12)%SL;e.x=-16+c*.85-1.15;e.follow=1;e.oy=.0;e.a=e.x>17?0:1;}}));
    E.push({line:1,col:[60,50,40],a:.8,upd:function(t,e,W){e.a0=W.pt('walker',-.22,1.1-.36);e.a1=W.pt('sled',.4,.1);e.sag=.06;e.vis=W.get('walker').a;}});
    return E;
  }

  /* ===== MEKAR: hanami di atas terpal biru, gelembung sabun, fotografer, sepeda berkeranjang bunga, kupu-kupu ===== */
  function sceneSakura(){
    var E=[];
    var hanami=cv(2.5,1.3,1.25,.08,function(g){
      shadow(g,0,.06,1.15,.12,.2);blanket(g,2.0,.36,'blue');
      /* bento bertingkat, onigiri, dango, set teh */
      function bento(x,y,c){poly(g,[[x-.1,y],[x+.1,y],[x+.1,y+.06],[x-.1,y+.06]],grad(g,x,y,LD[0],LD[1],.08,c));g.fillStyle=css([250,250,246]);g.fillRect(x-.085,y+.06,.08,.022);g.fillStyle=css([248,206,70]);g.fillRect(x+.005,y+.06,.04,.022);g.fillStyle=css([220,70,60]);g.fillRect(x+.05,y+.06,.035,.022);
        g.fillStyle=css([110,170,80]);g.beginPath();g.arc(x-.04,y+.075,.012,0,TAU);g.fill();}
      bento(-.02,.1,[30,26,28]);bento(.2,.17,[150,30,34]);
      for(var i=0;i<3;i++){var ox=-.4+i*.07;poly(g,[[ox-.035,.04],[ox+.035,.04],[ox,.11]],css([250,250,246]),true);g.fillStyle=css([30,40,30]);g.fillRect(ox-.02,.04,.04,.025);}
      for(var d=0;d<2;d++){var dx=.08+d*.05;line(g,[[dx,.0],[dx+.06,.2]],css([200,170,110]),.007);[[244,170,190],[250,250,246],[150,200,110]].forEach(function(cc,k){ball(g,dx+.015+k*.015,.05+k*.04,.022,.022,cc);});}
      cup(g,.88,.1,[240,240,232],.8);cup(g,.98,.06,[240,240,232],.8);
      /* wanita bermahkota bunga: duduk miring, memegang onigiri */
      fig(g,sc({hd:[.06,.68],nk:[.03,.57],pe:[0,.14],sh:[[-.03,.54],[.08,.53]],el:[[-.06,.36],[.14,.4]],hn:[[-.12,.18],[.2,.5]],
        hp:[[-.03,.14],[.04,.13]],kn:[[.24,.1],[.26,.07]],an:[[.06,.04],[.1,.03]],to:[[-.02,.03],[.02,.02]],sk:[[-.12,.3],[.12,.3],[.38,.05],[-.08,.02]]},1,-.72,.06),
        {skin:'#E0B08C',hair:'#2c1a12',hs:'long',hat:'crown',top:'#FBF3E8',tk:'dress',bk:'dress',belt:'#E98AA8',skirtPat:function(g,p){g.fillStyle='rgba(233,138,168,.55)';var R=rng(4);for(var i=0;i<22;i++){var q=lp(lp(p[0],p[3],R()),lp(p[1],p[2],R()),R());g.beginPath();g.arc(q[0],q[1],.012,0,TAU);g.fill();}},shoe:'#E7C6A8',d:1,
         hold:[null,function(g,h){poly(g,[[h[0]-.03,h[1]-.01],[h[0]+.035,h[1]-.01],[h[0]+.002,h[1]+.055]],css([250,250,246]),true);g.fillStyle=css([30,40,30]);g.fillRect(h[0]-.02,h[1]-.01,.04,.02);}]});
      /* pria bersila menuang teh dari teko */
      fig(g,sc({hd:[.06,.67],nk:[.03,.55],pe:[0,.12],sh:[[-.04,.52],[.09,.51]],el:[[.0,.34],[.17,.4]],hn:[[.08,.22],[.27,.33]],
        hp:[[-.05,.13],[.05,.12]],kn:[[-.2,.16],[.24,.14]],an:[[.12,.06],[-.02,.05]],to:[[.18,.04],[.04,.03]]},1,.62,.06),
        {skin:'#C99368',hair:'#15100e',top:'#5F7FA3',tk:'sweater',bot:'#E8E1D2',bk:'pants',shoe:'#3a3530',d:-1,
         hold:[function(g,h){cup(g,h[0],h[1]-.04,[240,240,232],.9);},function(g,h){ball(g,h[0]-.02,h[1]-.02,.06,.05,[120,150,110]);limb(g,[h[0]-.07,h[1]],[h[0]-.13,h[1]-.04],.01,.007,[120,150,110]);}]});
    });
    E.push(ent(hanami,-1.5,1.25,{breath:.004}));
    /* gadis peniup gelembung */
    var bbO={skin:'#D49C74',hair:'#20140f',hs:'bun',top:'#F7B6C8',tk:'dress',bk:'dress',belt:'#FFFFFF',shoe:'#F2F2F2',s:.8,hr:.072,kid:true,d:1,blow:true};
    var bb=cv(.9,1.25,.45,.02,function(g){shadow(g,0,.02,.22,.04,.28);
      fig(g,stand({k:.8,el:[[-.08,.86],[.16,.93]],hn:[[-.04,.68],[.2,1.08]]}),Object.assign({hold:[function(g,h){limb(g,[h[0],h[1]],[h[0],h[1]-.06],.03,.034,[120,200,230]);},function(g,h){line(g,[[h[0],h[1]],[h[0]+.1,h[1]+.04]],css([240,90,140]),.008);g.strokeStyle=css([240,90,140]);g.lineWidth=.008;g.beginPath();g.arc(h[0]+.125,h[1]+.05,.028,0,TAU);g.stroke();}]},bbO));});
    var BX=1.4;
    E.push(ent(bb,BX,1.05,{id:'bub',breath:.006}));
    var bt=bubbleTex();
    for(var i=0;i<9;i++)(function(i){var ph=i/9,sp=.22+((i*37)%10)/40,sz=.55+((i*53)%10)/14;
      E.push(ent(bt,BX,1.05,{s:sz,z:.24,upd:function(t,e){var c=(t*sp+ph)%1;e.x=BX+.25+c*3.6+Math.sin(t*1.3+i)*.15*c;e.oy=.92+c*2.2+Math.sin(t*2+i*2)*.12;e.a=c<.06?c/.06:(c>.85?(1-c)/.15:1);e.rot=t*.3;}}));})(i);
    /* fotografer berlutut mengarahkan kamera ke keluarga */
    var phO={skin:'#9E6B45',hair:'#16100d',top:'#E9DFC9',tk:'long',bot:'#5C6B4E',bk:'pants',shoe:'#3a3026',hat:'cap',hatc:'#5C6B4E',d:-1};
    var ph=cv(1,1.25,.5,.02,function(g){shadow(g,0,.02,.28,.04,.25);
      fig(g,sc({hd:[.05,.95],nk:[.01,.83],pe:[-.06,.46],sh:[[-.03,.8],[.07,.8]],el:[[.12,.7],[.16,.66]],hn:[[.2,.92],[.24,.9]],hp:[[-.08,.46],[-.04,.45]],kn:[[.18,.42],[-.12,.06]],an:[[.2,.05],[-.38,.06]],to:[[.29,.04],[-.44,.03]]},1,0),
        Object.assign({post:function(g,P){var h=P.hn[1];poly(g,[[h[0]-.07,h[1]-.04],[h[0]+.06,h[1]-.04],[h[0]+.06,h[1]+.05],[h[0]-.07,h[1]+.05]],grad(g,h[0],h[1],LD[0],LD[1],.06,[34,34,38]));ball(g,h[0]-.1,h[1],.035,.035,[20,20,24]);g.fillStyle='rgba(140,170,220,.8)';g.beginPath();g.arc(h[0]-.11,h[1],.015,0,TAU);g.fill();}},phO));});
    E.push(ent(ph,3.6,1.12,{breath:.005}));
    var flash=cv(.4,.4,.2,.2,function(g){var r=g.createRadialGradient(0,0,0,0,0,.2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,250,240,.6)');r.addColorStop(1,'rgba(255,250,240,0)');g.fillStyle=r;g.fillRect(-.2,-.2,.4,.4);});
    E.push(ent(flash,3.6,1.12,{z:.26,s:1.3,add:1,upd:function(t,e){var c=t%5.5;e.a=c<.18?1-c/.18:0;e.ox=-.38;e.oy=.92;}}));
    /* sepeda onthel dengan keranjang bunga */
    var bike=cv(1.4,1.0,.7,.03,function(g){shadow(g,0,.03,.6,.05,.22);var fc=[46,96,88];
      function wheel(x){g.strokeStyle=css([30,30,32]);g.lineWidth=.022;g.beginPath();g.arc(x,.27,.25,0,TAU);g.stroke();g.strokeStyle='rgba(200,200,200,.6)';g.lineWidth=.004;for(var k=0;k<12;k++){var a=k/12*TAU;g.beginPath();g.moveTo(x,.27);g.lineTo(x+Math.cos(a)*.24,.27+Math.sin(a)*.24);g.stroke();}ball(g,x,.27,.02,.02,[180,180,180]);}
      wheel(-.42);wheel(.42);
      line(g,[[-.42,.27],[-.08,.27],[.28,.58],[-.14,.58],[-.42,.27]],css(fc),.024);line(g,[[-.08,.27],[-.18,.66]],css(fc),.024);line(g,[[.42,.27],[.3,.72]],css(fc),.024);
      limb(g,[-.24,.68],[-.1,.69],.022,.02,[60,40,30]);line(g,[[.3,.72],[.22,.8],[.12,.8]],css([40,40,42]),.016);
      g.strokeStyle=css(fc);g.lineWidth=.03;g.beginPath();g.arc(-.42,.27,.29,Math.PI*.15,Math.PI*.9);g.stroke();
      /* keranjang rotan + bunga */
      poly(g,[[.3,.62],[.6,.62],[.57,.8],[.33,.8]],grad(g,.45,.7,LD[0],LD[1],.15,[176,128,70]));
      g.strokeStyle='rgba(110,70,30,.6)';g.lineWidth=.006;for(var y=.64;y<.8;y+=.035){g.beginPath();g.moveTo(.31,y);g.lineTo(.59,y);g.stroke();}
      var R=rng(21),cols=[[244,160,190],[255,255,255],[250,210,80],[230,110,150],[190,150,230]];
      for(var f=0;f<14;f++){var fx=.34+R()*.22,fy=.8+R()*.12;line(g,[[fx,.78],[fx,fy]],css([80,130,60]),.006);ball(g,fx,fy,.03,.028,cols[f%5]);g.fillStyle=css([250,210,80]);g.beginPath();g.arc(fx,fy,.01,0,TAU);g.fill();}});
    E.push(ent(bike,-5.3,.85,{}));
    /* kupu-kupu berkeliaran */
    [[250,190,60],[255,255,255],[240,140,170]].forEach(function(c,i){var fr=[butterflyTex(true,c),butterflyTex(false,c)];
      E.push(ent(fr,-2+i*2.5,.8,{s:.9,z:.25,upd:function(t,e){var u=t*.35+i*2.1;e.f=Math.floor(t*14+i)%2;e.x=-2+i*2.6+Math.sin(u)*1.6+Math.sin(u*2.3)*.4;e.oy=1.0+Math.sin(u*1.7)*.35+Math.sin(t*3+i)*.05;e.flip=Math.cos(u)>0?1:-1;}}));});
    return E;
  }

  /* ---------- kijang (muntjak): tubuh mungil cokelat kemerahan, tanduk pendek, ekor berbulu putih di bawah ----------
     h: 0 = merumput (kepala di tanah), 1 = waspada (kepala tegak). o: {coat, fawn (anak bertotol), antler, winter} */
  function deerTex(h,o){return cv(1.25,1.2,.6,.03,function(g){
    var c=hx(o.coat||'#A85E34'),bel=sh(c,.45),k=o.fawn?.72:1,dk=sh(c,-.35);
    g.save();g.scale(k,k);
    shadow(g,0,0,.42,.05,.28,o.winter?[90,110,150]:null);
    var by=.5;
    function lg(x,y,kx,ky,fx,col){limb(g,[x,y],[kx,ky],.042,.026,col);limb(g,[kx,ky],[fx,.06],.024,.017,col);limb(g,[fx,.06],[fx+.02,.025],.017,.016,[40,30,26]);}
    /* kaki sisi jauh */
    lg(-.22,by-.02,-.27,.3,-.24,sh(c,-.25));lg(.18,by-.02,.19,.28,.2,sh(c,-.25));
    /* ekor */
    limb(g,[-.3,by+.06],[-.37,by+.02],.03,.024,c);ball(g,-.37,by+.0,.022,.03,[248,246,240]);
    /* badan */
    ball(g,0,by,.3,.13,c,-.04);
    g.fillStyle=css(bel,.85);g.beginPath();g.ellipse(.0,by-.08,.22,.045,0,0,TAU);g.fill();
    g.fillStyle=css(dk,.35);g.beginPath();g.ellipse(-.02,by+.1,.24,.03,0,0,TAU);g.fill();
    if(o.fawn){g.fillStyle='rgba(255,250,236,.85)';var R=rng(5);for(var i=0;i<16;i++){g.beginPath();g.arc(-.22+R()*.42,by-.02+R()*.1,.013,0,TAU);g.fill();}}
    if(o.winter){g.fillStyle='rgba(235,232,226,.35)';g.beginPath();g.ellipse(-.02,by+.06,.26,.06,0,0,TAU);g.fill();}
    /* leher dan kepala: tegak waspada atau menunduk merumput */
    var nb=[.2,by+.06],hd=[.26+.2*(1-h),.12+.73*h],hdir=[.12,(1-h)*-.08+h*.02];
    limb(g,nb,lp(nb,hd,.92),.075,.045,c);
    g.save();g.translate(hd[0],hd[1]);g.rotate(Math.atan2(hdir[1],hdir[0])-(1-h)*1.2);
    ball(g,0,0,.07,.05,c);limb(g,[.03,-.01],[.12,-.03],.04,.024,sh(c,.06));ball(g,.13,-.03,.016,.014,[30,22,20]);
    g.strokeStyle=css(dk);g.lineWidth=.01;g.beginPath();g.moveTo(.0,.03);g.lineTo(.08,-.005);g.stroke();
    ball(g,.02,.012,.012,.012,[20,16,14]);
    /* telinga dan tanduk pendek */
    ball(g,-.04,.06,.022,.05,sh(c,-.1),-.5);ball(g,-.01,.065,.02,.045,sh(c,.05),-.3);
    if(o.antler){limb(g,[-.01,.05],[-.03,.12],.008,.007,[110,80,55]);limb(g,[-.03,.12],[-.06,.17],.007,.005,[150,120,90]);limb(g,[-.025,.1],[.01,.13],.005,.004,[150,120,90]);}
    g.restore();
    /* kaki sisi dekat */
    lg(-.18,by-.03,-.24,.29,-.2,c);lg(.22,by-.03,.23,.28,.25,c);
    g.restore();
  });}
  /* kijang sebagai entitas: merumput, sesekali menegakkan kepala dan bergeser sedikit */
  function deer(x,dy,o,seed){
    var fr=[deerTex(0,o),deerTex(.5,o),deerTex(1,o)];
    return ent(fr,x,dy,{s:o.fawn?.95:.9,z:.05,fade:1,flip:o.flip||1,upd:function(t,e){
      var c=(t+seed)%9;e.f=c<5?0:(c<6?(c-5)*2:(c<8?2:2-(c-8)*2));
      e.x=x+Math.sin((t+seed)*.11)*.35*(o.fawn?1.4:1);}});
  }
  function herds(){
    return {
      sunrise:[deer(-10.2,.55,{coat:'#A85E34',antler:1},0),deer(-9.3,.6,{coat:'#B9733F',fawn:1},3)],
      autumn:[deer(8.4,.5,{coat:'#9C5530',antler:1,flip:-1},1)],
      snow:[deer(-9.6,.55,{coat:'#8A6A55',winter:1,antler:1},2),deer(-8.8,.6,{coat:'#93725B',winter:1,fawn:1},6)],
      sakura:[deer(8.2,.55,{coat:'#B0643A',flip:-1},4),deer(9.0,.6,{coat:'#BD7745',fawn:1,flip:-1},1)]
    };
  }

  /* ---------- payung ---------- */
  function umbrella(g,cx,cy,r,col,col2,hand){
    if(hand)line(g,[[hand[0],hand[1]],[cx,cy]],css([60,48,40]),.012);
    var c=hx(col),c2=hx(col2||col),n=8;
    g.save();g.translate(cx,cy);
    /* kanopi: setengah elips dengan tepi bawah bergelombang dan panel berselang warna */
    for(var i=0;i<n;i++){var a0=Math.PI*(i/n),a1=Math.PI*((i+1)/n);
      var p0=[-Math.cos(a0)*r,0],p1=[-Math.cos(a1)*r,0],tp=[0,r*.55];
      g.beginPath();g.moveTo(tp[0],tp[1]);g.lineTo(p0[0],p0[1]);g.quadraticCurveTo((p0[0]+p1[0])/2,r*.08,p1[0],p1[1]);g.closePath();
      var cc=i%2?c:c2,gr=g.createLinearGradient(-r,r*.5,r,0);gr.addColorStop(0,css(sh(cc,.2)));gr.addColorStop(1,css(sh(cc,-.25)));g.fillStyle=gr;g.fill();}
    g.strokeStyle=css(sh(c,-.45),.6);g.lineWidth=.006;for(var j=0;j<=n;j++){var a=Math.PI*j/n;g.beginPath();g.moveTo(0,r*.55);g.lineTo(-Math.cos(a)*r,0);g.stroke();}
    g.fillStyle=css([255,255,255],.18);g.beginPath();g.ellipse(-r*.35,r*.32,r*.3,r*.08,-.4,0,TAU);g.fill();
    line(g,[[0,r*.55],[0,r*.66]],css([60,48,40]),.012);
    g.restore();
  }
  function puddleTex(w,ph){return cv(w+.1,.16,w/2+.05,.06,function(g){
    g.save();g.scale(1,.18);var gr=g.createRadialGradient(0,0,0,0,0,w/2);gr.addColorStop(0,'rgba(150,170,180,.85)');gr.addColorStop(.85,'rgba(120,140,150,.75)');gr.addColorStop(1,'rgba(90,100,90,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,w/2,0,TAU);g.fill();
    /* cincin riak dari tetes hujan */
    var R=rng(13);for(var i=0;i<5;i++){var x=(R()-.5)*w*.6,y=(R()-.5)*w*.25,t=(ph+R())%1;g.strokeStyle='rgba(235,245,250,'+(.7*(1-t))+')';g.lineWidth=.012/.18*.5;g.beginPath();g.arc(x,y,.02+t*.09,0,TAU);g.stroke();}
    g.restore();});}

  /* ===== HUJAN: berpayung berdua, anak berjas hujan melompat di genangan, ibu menunggu, pelari berpayung daun pisang ===== */
  function sceneRain(){
    var E=[],shR=[30,40,45];
    var pw=frames(3,function(p){return puddleTex(1.3,p);});
    E.push(ent(pw,-1.4,1.3,{fade:1,z:.08,upd:function(t,e){e.f=t*1.6;}}));
    var pw2=frames(3,function(p){return puddleTex(.8,p+.4);});
    E.push(ent(pw2,3.4,1.0,{fade:1,z:.07,upd:function(t,e){e.f=t*1.6+1;}}));
    E.push(ent(pw2,-6.2,.9,{fade:1,z:.07,s:1.2,upd:function(t,e){e.f=t*1.6+2;}}));
    /* anak berjas hujan kuning dan sepatu bot merah: jongkok lalu melompat */
    var kO={skin:'#C48E64',hs:'hijab',hijab:'#F2C230',top:'#F2C230',tk:'coat',bot:'#3A5A8A',bk:'pants',boots:'#D83A34',shoe:'#B52E2A',s:.8,hr:.072,kid:true,d:1};
    var kid=[cv(.9,1.25,.45,.02,function(g){fig(g,sc({hd:[.06,.95],nk:[.03,.83],pe:[0,.48],sh:[[-.03,.8],[.07,.8]],el:[[-.12,.66],[.16,.66]],hn:[[-.2,.56],[.24,.56]],hp:[[-.03,.48],[.03,.47]],kn:[[.12,.3],[.17,.28]],an:[[-.02,.06],[.04,.06]],to:[[.06,.04],[.12,.04]]},.82,0),kO);}),
             cv(.9,1.25,.45,.02,function(g){fig(g,sc({hd:[.03,1.24],nk:[.01,1.1],pe:[0,.72],sh:[[-.05,1.07],[.06,1.06]],el:[[-.2,1.18],[.2,1.18]],hn:[[-.3,1.34],[.3,1.34]],hp:[[-.035,.71],[.04,.7]],kn:[[-.02,.42],[.06,.44]],an:[[-.06,.14],[.03,.16]],to:[[.02,.1],[.11,.12]]},.82,0),Object.assign({},kO,{smile:true}));})];
    var JC=2.2;
    E.push(ent(cv(.5,.1,.25,.05,function(g){shadow(g,0,0,.2,.035,.3,shR);}),-1.4,1.32,{z:.09,upd:function(t,e){var c=t%JC,u=c>.6&&c<1.4?(c-.6)/.8:-1;e.s=u<0?1.2:1.2*(1-.4*Math.sin(u*Math.PI));}}));
    E.push(ent(kid,-1.4,1.32,{z:.14,upd:function(t,e){var c=t%JC;if(c>.6&&c<1.4){var u=(c-.6)/.8;e.f=1;e.oy=Math.sin(u*Math.PI)*.42;}else{e.f=0;e.oy=0;}}}));
    var spl=frames(4,function(p){return cv(.9,.5,.45,.05,function(g){var R=rng(9);for(var i=0;i<18;i++){var a=Math.PI*(.08+.84*R()),v=.15+R()*.3,x=Math.cos(a)*v*(p+.15)*1.6,y=Math.sin(a)*v*(p+.15)*1.4-p*p*.25;
      g.fillStyle='rgba(225,238,245,'+(.9-p*.75)+')';g.beginPath();g.ellipse(x,Math.max(0,y),.018+.01*R(),.024,a,0,TAU);g.fill();}
      g.strokeStyle='rgba(225,238,245,'+(.7-p*.6)+')';g.lineWidth=.012;g.beginPath();g.ellipse(0,0,.12+p*.3,.03+p*.06,0,0,TAU);g.stroke();});});
    E.push(ent(spl,-1.4,1.32,{fade:1,z:.16,upd:function(t,e){var c=t%JC;if(c<1.38||c>1.9){e.a=0;return;}var u=(c-1.38)/.52;e.a=1;e.f=u*3;}}));
    /* ibu berpayung batik menunggu, memegang jas hujan cadangan */
    var mO={skin:'#D49C74',hs:'hijab',hijab:'#5A7A9A',long:true,maxi:true,top:'#7A8F6A',tk:'long',bk:'skirt',skirt:'#3E4A5E',shoe:'#2a2a2e',d:1};
    var mom=cv(1.3,1.95,.6,.02,function(g){shadow(g,0,.02,.26,.04,.3,shR);
      fig(g,stand({el:[[-.08,.86],[.12,.95]],hn:[[-.04,.68],[.1,1.14]]}),Object.assign({post:function(g,P){umbrella(g,P.hn[1][0]-.02,1.52,.5,'#8C3B2E','#D9A441',P.hn[1]);
        /* motif batik kawung tipis di kanopi */
        g.strokeStyle='rgba(60,30,20,.35)';g.lineWidth=.006;for(var i=0;i<6;i++){var a=Math.PI*(.12+.76*i/5);g.beginPath();g.ellipse(P.hn[1][0]-.02-Math.cos(a)*.3,1.52+Math.sin(a)*.14,.03,.018,a,0,TAU);g.stroke();}}},mO));});
    E.push(ent(mom,-2.9,1.2,{breath:.004}));
    /* pasangan berbagi satu payung, berjalan pelan menyusuri padang */
    var aO={skin:'#B07A52',hair:'#14100d',top:'#3D5A73',tk:'coat',bot:'#2A2D36',bk:'pants',shoe:'#2c201a',d:1};
    var bO={skin:'#D9A47C',hair:'#2a1a12',hs:'long',top:'#C85A5A',tk:'coat',bot:'#2E2A36',bk:'pants',shoe:'#3a2a26',d:1};
    var couple=frames(8,function(p){return cv(1.6,2.0,.8,.03,function(g){shadow(g,.1,.02,.42,.05,.25,shR);
      var A=gait((p+.5)%1,false,.94),B=gait(p,false,1);
      A=sc(A,1,-.12);B=sc(B,1,.16);
      A.el[1]=[A.sh[1][0]+.12,A.sh[1][1]-.1];A.hn[1]=[A.sh[1][0]+.2,A.sh[1][1]+.06];
      B.el[1]=[B.sh[1][0]+.04,B.sh[1][1]-.16];B.hn[1]=[B.sh[1][0]+.02,B.sh[1][1]+.04];
      fig(g,A,bO);fig(g,B,Object.assign({},aO,{post:function(g,P){var hb=.02*Math.sin(p*TAU*2);umbrella(g,.08,1.6+hb,.58,'#1F2B3A','#1F2B3A',[P.hn[1][0],P.hn[1][1]]);}}));});});
    var CW=46;
    E.push(ent(couple,-15,.62,{s:.95,z:.07,upd:function(t,e){var c=(t+20)%CW;e.x=-16+c*.75;e.f=Math.floor(t*6.5)%8;e.follow=1;e.a=e.x>17?0:1;}}));
    /* pelari berpayung daun pisang, berlari dari kanan ke kiri */
    var lO={skin:'#9A6644',hair:'#120d0b',top:'#E9E2D0',tk:'tee',bot:'#5A4A3A',bk:'shorts',shoe:'#2F2A26',d:1};
    var leafRun=frames(8,function(p){return cv(1.5,1.8,.75,.03,function(g){shadow(g,0,.02,.22,.04,.22,shR);
      var P=gait(p,true,1);P.el=[[P.sh[0][0]-.06,P.sh[0][1]+.18],[P.sh[1][0]+.1,P.sh[1][1]+.17]];P.hn=[[P.sh[0][0]+.0,P.sh[0][1]+.34],[P.sh[1][0]+.14,P.sh[1][1]+.33]];
      fig(g,P,Object.assign({},lO,{post:function(g){
        /* daun pisang: lebar, tulang daun tengah, sobekan khas di tepi */
        var cx=.05,cy=1.62+.02*Math.sin(p*TAU*2);g.save();g.translate(cx,cy);g.rotate(-.12);
        var gr=g.createLinearGradient(0,.12,0,-.1);gr.addColorStop(0,'#7DB84A');gr.addColorStop(1,'#3C7A2C');
        g.fillStyle=gr;g.beginPath();g.moveTo(-.55,-.02);g.quadraticCurveTo(-.1,.2,.5,.04);g.quadraticCurveTo(.1,-.06,-.55,-.02);g.fill();
        g.strokeStyle='rgba(230,240,190,.7)';g.lineWidth=.012;g.beginPath();g.moveTo(-.55,-.02);g.quadraticCurveTo(-.05,.08,.5,.04);g.stroke();
        g.strokeStyle='rgba(40,70,30,.7)';g.lineWidth=.006;for(var i=0;i<6;i++){var x=-.4+i*.14;g.beginPath();g.moveTo(x,.05+.02*Math.sin(i));g.lineTo(x+.05,.14-.03*i/6);g.stroke();}
        line(g,[[.5,.04],[.62,.0]],css([90,120,50]),.02);g.restore();}}));});});
    E.push(ent(leafRun,16,.48,{s:.86,z:.06,flip:-1,upd:function(t,e){var c=(t+3)%24;e.x=17-c*1.5;e.f=Math.floor(t*12)%8;e.follow=1;e.a=e.x<-17?0:1;}}));
    /* katak kecil di tepi genangan, sesekali melompat */
    var frog=[cv(.2,.14,.1,.02,function(g){ball(g,0,.045,.07,.045,[90,140,60]);ball(g,.05,.07,.025,.025,[100,150,66]);ball(g,.055,.085,.012,.012,[20,20,20]);limb(g,[-.05,.03],[-.08,.01],.02,.015,[80,125,52]);}),
              cv(.2,.14,.1,.02,function(g){ball(g,0,.06,.07,.035,[90,140,60],.3);ball(g,.06,.085,.022,.022,[100,150,66]);limb(g,[-.05,.05],[-.1,.0],.016,.012,[80,125,52]);})];
    E.push(ent(frog,-.5,1.38,{s:1.2,z:.15,upd:function(t,e){var c=t%5.3;if(c<.5){var u=c/.5;e.f=1;e.oy=Math.sin(u*Math.PI)*.1;}else{e.f=0;e.oy=0;}}}));
    return E;
  }

  window.FOLK={PX:PX,build:function(){var H=herds();
    return {sunrise:sceneSunrise().concat(H.sunrise),autumn:sceneAutumn().concat(H.autumn),snow:sceneSnow().concat(H.snow),sakura:sceneSakura().concat(H.sakura),rain:sceneRain()};}};
})();
