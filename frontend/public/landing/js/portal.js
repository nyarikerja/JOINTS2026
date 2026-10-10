/* HelaLoka: gerbang dimensi dari landing page ke aplikasi.
   Klik "Jalankan simulasi" -> lingkaran portal terbuka dari titik klik (tepi pelangi berputar, percik cahaya tersedot ke pusat),
   lanskap di belakang memudar dan sedikit membesar, lalu halaman berpindah ke /app/. Isi portal memakai warna yang sama dengan
   latar loader sungai di aplikasi, jadi perpindahan halaman tidak berkedip. Browser yang mendukung View Transitions
   (Chrome/Edge 126+, Safari 18.2+) juga mendapat cross-fade antar dokumen. */
(function () {
  var APP = '/app/';
  var root = document.documentElement, busy = false;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ambil lebih dulu saat kursor mendekat: dokumen aplikasi, gaya dan skrip loader */
  var warmed = false;
  function warm() {
    if (warmed) return; warmed = true;
    [[APP, 'document'], ['/loader/river-loader.css', 'style'], ['/loader/river-loader.js', 'script']].forEach(function (r) {
      var l = document.createElement('link'); l.rel = 'prefetch'; l.href = r[0]; l.as = r[1]; document.head.appendChild(l);
    });
  }

  function isAppLink(a) {
    if (!a || a.target === '_blank') return false;
    var h = a.getAttribute('href') || '';
    return h === APP || h.indexOf('/app/') === 0 || h.indexOf('/loader') === 0 || a.hasAttribute('data-portal');
  }

  /* desir portal (Web Audio): hanya jika pengguna menyalakan suara (default aktif) */
  function whoosh() {
    var on = false;
    try { on = (window.HLAudio && window.HLAudio.isPlaying()) || localStorage.getItem('hl-sound') !== 'off'; } catch (e) { }
    if (!on) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext, c = new AC(), t = c.currentTime, n = c.sampleRate * 1.6;
      var b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = c.createBufferSource(); s.buffer = b;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.4; f.frequency.setValueAtTime(160, t); f.frequency.exponentialRampToValueAtTime(3800, t + 1.15);
      var g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .9); g.gain.exponentialRampToValueAtTime(.001, t + 1.5);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 1.6);
      [523, 659, 784, 1046].forEach(function (fq, k) {
        var o = c.createOscillator(), og = c.createGain(); o.frequency.value = fq; og.gain.setValueAtTime(0, t + .2 + k * .08);
        og.gain.linearRampToValueAtTime(.05, t + .22 + k * .08); og.gain.exponentialRampToValueAtTime(.0005, t + 1.6);
        o.connect(og); og.connect(c.destination); o.start(t + .2 + k * .08); o.stop(t + 1.7);
      });
    } catch (e) { }
  }

  function open(href, x, y) {
    if (busy) return; busy = true;
    try { sessionStorage.setItem('hl-portal', '1'); } catch (e) { }
    try { if (window.HLAudio && window.HLAudio.isPlaying()) { localStorage.setItem('hl-sound', 'on'); window.HLAudio.stop(); } } catch (e) { }
    whoosh();
    var go = function () { location.assign(href); };
    if (reduce) {
      var f = document.createElement('div'); f.className = 'portal-ov portal-fade'; document.body.appendChild(f);
      requestAnimationFrame(function () { f.classList.add('on'); }); setTimeout(go, 320); return;
    }
    var W = innerWidth, H = innerHeight, maxR = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 40;
    var ov = document.createElement('div'); ov.className = 'portal-ov'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="portal-disc"><div class="portal-swirl"></div></div><div class="portal-rim"></div><canvas class="portal-sparks"></canvas>' +
      '<p class="portal-cap">Membuka gerbang ke ruang simulasi</p>';
    ov.style.setProperty('--x', x + 'px'); ov.style.setProperty('--y', y + 'px');
    document.body.appendChild(ov);
    root.style.setProperty('--px', x + 'px'); root.style.setProperty('--py', y + 'px');
    root.classList.add('portaling');
    var cv = ov.querySelector('canvas'), g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
    var P = [], N = W < 700 ? 70 : 150;
    for (var i = 0; i < N; i++) { var a = Math.random() * 6.283, r = 80 + Math.random() * Math.max(W, H) * .7; P.push({ a: a, r: r, s: .6 + Math.random() * 1.8, h: Math.random() }); }
    var t0 = performance.now(), DUR = 1250;
    function frame(now) {
      var k = Math.min(1, (now - t0) / DUR), e = k * k * k * (k * (k * 6 - 15) + 10);          // smootherstep
      var R = 6 + e * maxR;
      ov.style.setProperty('--r', R.toFixed(1) + 'px'); ov.style.setProperty('--rot', (now * .18 % 360).toFixed(1) + 'deg');
      g.clearRect(0, 0, W, H);
      for (var j = 0; j < P.length; j++) {
        var p = P[j]; p.a += .035 + .02 / (p.r / 200 + .3); p.r *= 1 - .022 * (1 + k * 2);
        var rr = Math.max(p.r, R * .96), px = x + Math.cos(p.a) * rr, py = y + Math.sin(p.a) * rr * .92;
        g.fillStyle = 'hsla(' + (30 + p.h * 300) + ',95%,82%,' + (.9 - k * .5) + ')';
        g.beginPath(); g.arc(px, py, p.s, 0, 6.283); g.fill();
      }
      if (k < 1) requestAnimationFrame(frame); else { ov.classList.add('full'); setTimeout(go, 60); }
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('pointerover', function (e) { var a = e.target.closest && e.target.closest('a'); if (isAppLink(a)) warm(); }, { passive: true });
  document.addEventListener('focusin', function (e) { if (isAppLink(e.target.closest && e.target.closest('a'))) warm(); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!isAppLink(a) || e.defaultPrevented) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var r = a.getBoundingClientRect(), x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
    if (!e.clientX && !e.clientY) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    open(APP, x, y);
  }, true);

  /* kembali dengan tombol Back (bfcache): bersihkan portal dan pulihkan audio */
  addEventListener('pageshow', function (e) {
    busy = false; root.classList.remove('portaling');
    [].slice.call(document.querySelectorAll('.portal-ov')).forEach(function (n) { n.remove(); });
    var sp = null;
    try { sp = localStorage.getItem('hl-sound'); } catch (err) { }
    if (sp !== 'off' && window.HLAudio) {
      window.HLAudio.resume();
      var ab = document.getElementById('audioBtn');
      if (ab) { ab.classList.add('playing'); ab.setAttribute('aria-pressed', 'true'); }
    }
  });

  window.HLPortal = { open: open };
})();
