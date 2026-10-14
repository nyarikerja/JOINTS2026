/* HelaLoka: kabut untuk perpindahan halaman (landing -> loader sungai -> aplikasi).
   Kabut berbentuk gumpalan bergulung (bukan bidang putih rata): dua tirai kabut datang dari kiri dan kanan lalu menutup,
   dan saat membuka keduanya tersibak kembali ke samping. Gumpalan diberi gelap-terang (atas terang, bawah teduh) dan
   terus bergeser pelan. Ringan: tekstur dibuat sekali di canvas (di-cache per warna), sisanya transform di compositor.
   API: HLFog.mount(parent, color) -> { el, set(a), color(c), remove() }   a = kepekatan 0 (terbuka) .. 1 (tertutup) */
(function () {
  'use strict';
  var cache = {};
  /* tekstur gumpalan kabut berwarna: tiap bola kabut diberi sisi terang (atas) dan teduh (bawah), digambar dari bawah
     ke atas supaya gumpalan atas menumpuk di depan, seperti awan kumulus. Hasilnya di-cache per warna. */
  function texture(col) {
    var sh = shades(col || '#d4dbe1'), key = 'hl-fogtex5-' + sh.key;
    if (cache[key]) return cache[key];
    try { var hit = sessionStorage.getItem(key); if (hit) return (cache[key] = hit); } catch (e) { }
    var c = document.createElement('canvas'), w = 1024, h = 512; c.width = w; c.height = h;
    var g = c.getContext('2d'), s = 11, puffs = [];
    if ('filter' in g) g.filter = 'blur(14px)';                                // tepi kabut dilembutkan
    var rnd = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    /* gumpalan memanjang mendatar seperti kabut lembah, bergerombol dalam beberapa pita */
    for (var band = 0; band < 4; band++) {
      var by = (band + 0.5) / 4 * h + (rnd() - 0.5) * 40;
      for (var k = 0; k < 14; k++) puffs.push([rnd() * w, by + (rnd() - 0.5) * 90, 50 + rnd() * 70, 1.8 + rnd() * 1.6]);
    }
    puffs.sort(function (p, q) { return q[1] - p[1]; });                 // bawah dulu, atas paling depan
    var rgba = function (v, a) { return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; };
    puffs.forEach(function (p) {
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var x = p[0] + ox * w, y = p[1] + oy * h, r = p[2], sx = p[3];
        if (x < -r * sx || x > w + r * sx || y < -r || y > h + r) continue;
        g.save(); g.translate(x, y); g.scale(sx, 1);
        var gr = g.createRadialGradient(0, -r * 0.3, r * 0.08, 0, 0, r);
        gr.addColorStop(0, rgba(sh.hiv, 0.62)); gr.addColorStop(0.45, rgba(sh.v, 0.5)); gr.addColorStop(0.75, rgba(sh.lov, 0.22)); gr.addColorStop(1, rgba(sh.lov, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
      }
    });
    var url = 'url(' + c.toDataURL('image/png') + ')';
    try { sessionStorage.setItem(key, url); } catch (e) { }
    return (cache[key] = url);
  }
  /* warna terang dan teduh dari warna kabut (dikuantisasi supaya cache tekstur efektif) */
  function shades(col) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col), r = /rgb\D*(\d+)\D+(\d+)\D+(\d+)/i.exec(col), v;
    v = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : (r ? [+r[1], +r[2], +r[3]] : [212, 219, 225]);
    v = v.map(function (x) { return Math.min(255, Math.round(x / 12) * 12); });
    var mix = function (t, k) { return v.map(function (x) { return Math.round(x + (t - x) * k); }); };
    var hiv = mix(255, 0.6), lov = mix(60, 0.26), str = function (a) { return 'rgb(' + a.join(',') + ')'; };
    return { key: v.join('-'), v: v, hiv: hiv, lov: lov, base: str(v), hi: str(hiv), lo: str(lov) };
  }
  var css = '.hlfog{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:10000;--c:0;--fa:0;--fb:0}' +
    '.hlfog>b{position:absolute;inset:0;opacity:var(--fb);background:radial-gradient(120% 90% at 50% 40%,var(--fhi) 0%,var(--fbase) 55%,var(--flo) 100%)}' +
    /* tirai kiri dan kanan: tepi dalam memudar, isinya gumpalan kabut yang bergeser */
    '.hlfog>.bk{position:absolute;top:-12%;bottom:-12%;width:78%;will-change:transform}' +
    '.hlfog>.bk.l{left:-6%;transform:translate3d(calc((var(--c) - 1) * 112%),0,0);-webkit-mask-image:linear-gradient(90deg,#000 55%,transparent);mask-image:linear-gradient(90deg,#000 55%,transparent)}' +
    '.hlfog>.bk.r{right:-6%;transform:translate3d(calc((1 - var(--c)) * 112%),0,0);-webkit-mask-image:linear-gradient(270deg,#000 55%,transparent);mask-image:linear-gradient(270deg,#000 55%,transparent)}' +
    '.hlfog .pf{position:absolute;inset:0 -100% 0 0;will-change:transform;background:var(--fogimg) 0 0/50% auto repeat;animation:hlfogDrift 46s linear infinite}' +
    '.hlfog .pf+.pf{opacity:.8;background-size:50% auto;background-position:0 35%;animation-duration:31s;animation-direction:reverse;top:10%}' +
    '.hlfog>.bk.r .pf{animation-direction:reverse}.hlfog>.bk.r .pf+.pf{animation-direction:normal}' +
    /* gumpalan tengah yang mengembang saat tirai bertemu */
    '.hlfog>.mid{position:absolute;inset:-20% -60% -20% -20%;opacity:var(--fa);transform:scale(calc(1.25 - var(--c) * .25));' +
    'background:var(--fogimg) 0 0/30% auto repeat;animation:hlfogDrift 36s linear infinite}' +
    '@keyframes hlfogDrift{to{transform:translate3d(-50%,0,0)}}' +
    '.hlfog>.mid{animation-name:hlfogMid}@keyframes hlfogMid{from{translate:0 0}to{translate:-30% 0}}' +
    '@media (prefers-reduced-motion:reduce){.hlfog .pf,.hlfog>.mid{animation:none}}';
  function mount(parent, color) {
    if (!document.getElementById('hlfog-css')) { var st = document.createElement('style'); st.id = 'hlfog-css'; st.textContent = css; document.head.appendChild(st); }
    var el = document.createElement('div'); el.className = 'hlfog'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b></b><div class="mid"></div><div class="bk l"><div class="pf"></div><div class="pf"></div></div><div class="bk r"><div class="pf"></div><div class="pf"></div></div>';
    var paint = function (c) {
      var sh = shades(c || '#d4dbe1'); el.style.setProperty('--fogimg', texture(c));
      el.style.setProperty('--fbase', sh.base); el.style.setProperty('--fhi', sh.hi); el.style.setProperty('--flo', sh.lo);
    };
    paint(color); (parent || document.body).appendChild(el);
    var last = '';
    return {
      el: el,
      /* a: 0 terbuka .. 1 tertutup. Tirai bergerak lebih dulu, gumpalan tengah menyusul, warna rata hanya di puncak */
      set: function (a) {
        a = Math.max(0, Math.min(1, a));
        var sm = function (e0, e1) { var t = Math.max(0, Math.min(1, (a - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
        el.style.setProperty('--c', sm(0, 0.75).toFixed(3));
        el.style.setProperty('--fa', sm(0.25, 0.85).toFixed(3));
        el.style.setProperty('--fb', sm(0.7, 1).toFixed(3));
      },
      color: function (c) { var k = shades(c).key; if (k !== last) { last = k; paint(c); } },
      remove: function () { el.remove(); }
    };
  }
  window.HLFog = { mount: mount, texture: texture, START: '#d4dbe1' };
})();
