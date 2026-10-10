/* HelaLoka: gulir otomatis landing page, dua mode:
   - "Tur + narasi": menggulir pelan, berhenti di awal tiap bagian, narator membacakan ringkasannya (Web Speech API, suara
     Bahasa Indonesia bawaan browser, utamakan suara pria) dengan teks keterangan beranimasi ketik, lalu lanjut.
     Di akhir halaman, setelah hitung mundur 3 detik, tur langsung membuka aplikasi lewat transisi kabut.
     Musik alam dikecilkan selama narasi; narasi bisa dimatikan lewat tombol speaker di sampingnya.
   - "Gulir saja": hanya menggulir pelan dari atas ke bawah, tanpa narasi, teks, atau berhenti.
   Bisa dimulai dari bagian mana pun. Jika layar tergeser (sengaja atau tidak), gerak dijeda sebentar lalu lanjut sendiri
   dari posisi baru. Tombol jeda atau Esc menghentikannya. */
(function () {
  'use strict';
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var TTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  /* naskah narasi per bagian (id elemen section).
     text = yang tampil di layar; say = yang diucapkan (opsional), dipakai bila angka/singkatan perlu dieja agar terbaca benar.
     Angka contoh diambil dari isi halaman ini dan bersifat ilustratif. */
  var NARR = {
    beranda: {
      text: 'Selamat datang di HelaLoka. Saat gunung api meletus atau lahan gambut terbakar, pertanyaan terpentingnya sebenarnya sederhana: abu dan asap akan bergerak ke mana, dan siapa yang perlu bersiap lebih dulu? HelaLoka membantu menjawabnya untuk 70 gunung api aktif dan 36 kawasan hutan dan gambut rawan terbakar di Indonesia.',
      say: 'Selamat datang di HelaLoka. Saat gunung api meletus atau lahan gambut terbakar, pertanyaan terpentingnya sebenarnya sederhana: abu dan asap akan bergerak ke mana, dan siapa yang perlu bersiap lebih dulu? HelaLoka membantu menjawabnya untuk tujuh puluh gunung api aktif, dan tiga puluh enam kawasan hutan dan gambut rawan terbakar di Indonesia.'
    },
    masalah: {
      text: 'Sebenarnya, data peringatan sudah tersedia. Buletin VONA memuat tinggi kolom abu, satelit NASA mencatat titik api, dan prakiraan cuaca memetakan arah angin. Masalahnya, data ini belum langsung menjawab kebutuhan di lapangan: apakah sekolah besok perlu belajar daring, rumah sakit mana yang aman sebagai rujukan, dan kapan warga perlu beralih ke respirator N95.',
      say: 'Sebenarnya, data peringatan sudah tersedia. Buletin VONA memuat tinggi kolom abu, satelit NASA mencatat titik api, dan prakiraan cuaca memetakan arah angin. Masalahnya, data ini belum langsung menjawab kebutuhan di lapangan: apakah sekolah besok perlu belajar daring, rumah sakit mana yang aman sebagai rujukan, dan kapan warga perlu beralih ke respirator N sembilan lima.'
    },
    erupsi: {
      text: 'Untuk erupsi, semuanya berawal dari tinggi kolom abu. Dengan rumus empiris Mastin dan rekan tahun 2009, tinggi kolom diubah menjadi laju erupsi massa, yaitu berapa kilogram abu yang dilepaskan setiap detik. Massa itu lalu dibagi ke ribuan paket partikel yang diterbangkan angin. Coba geser tinggi kolomnya: tinggi kolom naik dua kali lipat saja, massa abunya bisa belasan kali lebih besar.',
      say: 'Untuk erupsi, semuanya berawal dari tinggi kolom abu. Dengan rumus empiris Mastin dan rekan, tahun dua ribu sembilan, tinggi kolom diubah menjadi laju erupsi massa, yaitu berapa kilogram abu yang dilepaskan setiap detik. Massa itu lalu dibagi ke ribuan paket partikel yang diterbangkan angin. Coba geser tinggi kolomnya: tinggi kolom naik dua kali lipat saja, massa abunya bisa belasan kali lebih besar.'
    },
    karhutla: {
      text: 'Untuk kebakaran lahan, kami memakai titik panas satelit VIIRS dari NASA FIRMS. Setiap titik membawa nilai daya radiasi api atau FRP. Nilai itu dikonversi menjadi biomassa yang terbakar, lalu menjadi emisi partikel halus PM2,5. Khusus lahan gambut, emisinya dikalikan 2,34 karena api gambut cenderung membara lama dan menghasilkan lebih banyak asap.',
      say: 'Untuk kebakaran lahan, kami memakai titik panas satelit VIIRS dari NASA FIRMS. Setiap titik membawa nilai daya radiasi api, atau F R P. Nilai itu dikonversi menjadi biomassa yang terbakar, lalu menjadi emisi partikel halus, P M dua koma lima. Khusus lahan gambut, emisinya dikalikan dua koma tiga empat, karena api gambut cenderung membara lama dan menghasilkan lebih banyak asap.'
    },
    coba: {
      text: 'Sekarang Anda bisa mencoba modelnya. Klik peta untuk memindahkan sumber erupsi, lalu atur arah angin, kecepatan angin, dan tinggi kolom. Model menjalankan 24 skenario angin sekaligus. Merah tua berarti abu mengendap di hampir semua skenario, sedangkan kuning berarti hanya pada sebagian kecil skenario. Tabel di bawahnya mengurutkan sekolah yang paling perlu bersiap.',
      say: 'Sekarang Anda bisa mencoba modelnya. Klik peta untuk memindahkan sumber erupsi, lalu atur arah angin, kecepatan angin, dan tinggi kolom. Model menjalankan dua puluh empat skenario angin sekaligus. Merah tua berarti abu mengendap di hampir semua skenario, sedangkan kuning berarti hanya pada sebagian kecil skenario. Tabel di bawahnya mengurutkan sekolah yang paling perlu bersiap.'
    },
    'cara-kerja': {
      text: 'Di balik layar, HelaLoka bekerja dalam empat tahap. Pertama, data dari PVMBG, NASA, Open-Meteo, WorldPop, dan OpenStreetMap diperbarui otomatis. Kedua, aplikasi menjalankan 15 sampai 51 simulasi dengan variasi angin. Ketiga, zona sebaran ditumpangkan pada peta penduduk beresolusi 100 meter, lokasi sekolah, dan fasilitas kesehatan. Terakhir, sistem menyusun rekomendasi tindakan. Bila hujan lebat, sistem juga memberi peringatan lahar.',
      say: 'Di balik layar, HelaLoka bekerja dalam empat tahap. Pertama, data dari P V M B G, NASA, Open Meteo, World Pop, dan Open Street Map diperbarui otomatis. Kedua, aplikasi menjalankan lima belas sampai lima puluh satu simulasi dengan variasi angin. Ketiga, zona sebaran ditumpangkan pada peta penduduk beresolusi seratus meter, lokasi sekolah, dan fasilitas kesehatan. Terakhir, sistem menyusun rekomendasi tindakan. Bila hujan lebat, sistem juga memberi peringatan lahar.'
    },
    hasil: {
      text: 'Hasilnya tidak disajikan sebagai satu angka pasti, melainkan sebagai rentang. Contohnya, untuk kolom abu setinggi 5 kilometer, penduduk terpapar diperkirakan 18.500 hingga 49.000 jiwa, dengan enam sekolah di zona tinggi. Pada contoh kebakaran gambut, memadamkan lima titik api terbesar saja dapat menurunkan paparan hingga 41 persen. Angka-angka ini ilustrasi, bukan data kejadian.',
      say: 'Hasilnya tidak disajikan sebagai satu angka pasti, melainkan sebagai rentang. Contohnya, untuk kolom abu setinggi lima kilometer, penduduk terpapar diperkirakan delapan belas ribu lima ratus, hingga empat puluh sembilan ribu jiwa, dengan enam sekolah di zona tinggi. Pada contoh kebakaran gambut, memadamkan lima titik api terbesar saja dapat menurunkan paparan hingga empat puluh satu persen. Angka-angka ini ilustrasi, bukan data kejadian.'
    },
    sumber: {
      text: 'Semua data berasal dari sumber terbuka dan metode yang telah dipublikasikan, mulai dari PVMBG Badan Geologi, NASA FIRMS, Open-Meteo, WorldPop, hingga OpenStreetMap. Perlu diingat, HelaLoka adalah alat estimasi ilmiah, bukan peringatan resmi. Untuk status bahaya dan perintah evakuasi, selalu ikuti PVMBG, BMKG, BNPB, dan BPBD setempat.',
      say: 'Semua data berasal dari sumber terbuka dan metode yang telah dipublikasikan, mulai dari P V M B G Badan Geologi, NASA FIRMS, Open Meteo, World Pop, hingga Open Street Map. Perlu diingat, HelaLoka adalah alat estimasi ilmiah, bukan peringatan resmi. Untuk status bahaya dan perintah evakuasi, selalu ikuti P V M B G, B M K G, B N P B, dan B P B D setempat.'
    },
    mulai: {
      text: 'HelaLoka dirancang untuk BPBD dan relawan yang menyusun prioritas, sekolah dan fasilitas kesehatan yang perlu bersiap, serta peneliti dan pelajar yang ingin memahami cara kerjanya. Terima kasih sudah mengikuti tur ini. Sekarang, mari kita masuk ke ruang simulasi.',
      say: 'HelaLoka dirancang untuk B P B D dan relawan yang menyusun prioritas, sekolah dan fasilitas kesehatan yang perlu bersiap, serta peneliti dan pelajar yang ingin memahami cara kerjanya. Terima kasih sudah mengikuti tur ini. Sekarang, mari kita masuk ke ruang simulasi.'
    }
  };
  var plain = function (t) { return t; };

  /* pecah naskah ucapan per kalimat dengan nada dan tempo normal (Chrome memotong ucapan panjang setelah ~15 detik) */
  function prosody(n) {
    var text = n.say || n.text;
    var out = [];
    (text.match(/[^.!?]+[.!?]?/g) || [text]).forEach(function (t) {
      t = t.trim();
      /* kalimat panjang dipecah di koma/titik dua terakhir sebelum ~150 huruf */
      while (t.length > 170) {
        var cut = Math.max(t.lastIndexOf(', ', 150), t.lastIndexOf(': ', 150));
        if (cut < 40) break;
        out.push(t.slice(0, cut + 1)); t = t.slice(cut + 2);
      }
      if (t) out.push(t);
    });
    return out.map(function (t) { return { t: t, rate: 1, pitch: 1, gap: 0 }; });
  }

  /* ---------- tombol ---------- */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'view-btn auto-btn'; btn.id = 'autoBtn'; btn.setAttribute('aria-pressed', 'false');
  btn.title = 'Tur otomatis dengan narasi (tekan lagi untuk berhenti)';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v13m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 20h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  /* mode gulir saja: tombol kedua di kiri tombol tur */
  var sbtn = document.createElement('button');
  sbtn.type = 'button'; sbtn.className = 'view-btn auto-btn scroll-btn'; sbtn.id = 'scrollBtn'; sbtn.setAttribute('aria-pressed', 'false');
  sbtn.title = 'Gulir otomatis tanpa narasi (tekan lagi untuk berhenti)';
  function label(on) {
    var tour = on && mode === 'tour', scr = on && mode === 'scroll';
    btn.innerHTML = (tour ? ICON_PAUSE : ICON_PLAY) + '<span>' + (tour ? 'Jeda tur' : 'Tur + narasi') + '</span>';
    btn.setAttribute('aria-pressed', tour ? 'true' : 'false'); btn.setAttribute('aria-label', tour ? 'Hentikan tur' : 'Mulai tur otomatis dengan narasi');
    sbtn.innerHTML = (scr ? ICON_PAUSE : ICON_DOWN) + '<span>' + (scr ? 'Jeda gulir' : 'Gulir saja') + '</span>';
    sbtn.setAttribute('aria-pressed', scr ? 'true' : 'false'); sbtn.setAttribute('aria-label', scr ? 'Hentikan gulir otomatis' : 'Gulir otomatis tanpa narasi');
    btn.hidden = scr; sbtn.hidden = tour; nbtn.hidden = !tour;
    btn.classList.remove('wait'); sbtn.classList.remove('wait');
    place();
  }
  var nbtn = document.createElement('button');
  nbtn.type = 'button'; nbtn.className = 'view-btn nar-btn'; nbtn.hidden = true;
  var cap = document.createElement('p'); cap.className = 'tour-cap'; cap.setAttribute('aria-live', 'polite');
  document.body.appendChild(btn); document.body.appendChild(sbtn); document.body.appendChild(nbtn); document.body.appendChild(cap);

  var narrOn = true;
  try { narrOn = localStorage.getItem('hl-narasi') !== 'off'; } catch (e) { }
  function nlabel() {
    nbtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/>' +
      (narrOn ? '<path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') + '</svg>';
    nbtn.setAttribute('aria-pressed', narrOn ? 'true' : 'false');
    nbtn.setAttribute('aria-label', narrOn ? 'Matikan narasi' : 'Nyalakan narasi'); nbtn.title = narrOn ? 'Narasi menyala' : 'Narasi mati';
  }
  nlabel();
  /* susun tombol dari kanan: tombol yang sedang aktif paling kanan */
  function place() {
    var order = !on ? [btn, sbtn] : (mode === 'tour' ? [btn, nbtn] : [sbtn]), x = 20;
    order.forEach(function (b) { b.style.right = x + 'px'; x += b.offsetWidth + 8; });
  }

  /* ---------- narasi (Web Speech API) ---------- */
  var voice = null, basePitch = 1;
  function pickVoice() {
    if (!TTS) return;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^id([-_]|$)/i.test(v.lang); });
    /* utamakan suara pria (Microsoft Ardi di Edge, Microsoft Andika di Windows), lalu yang alami/online */
    var male = function (v) { return /ardi|andika|pria|laki-laki/i.test(v.name); };
    vs.sort(function (a, b) { var s = function (v) { return (male(v) ? 10 : 0) + (/natural|online/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1); }; return s(b) - s(a); });
    voice = vs[0] || null;
    /* browser tanpa suara pria Indonesia (mis. Chrome hanya punya suara wanita): nada diturunkan sedikit */
    basePitch = voice && !male(voice) ? 0.8 : 1;
  }
  if (TTS) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); }
  var talkId = 0, capT = 0, cur = null;

  /* ---------- teks keterangan dengan animasi ketik ----------
     Bagian yang belum terketik tetap ada tetapi transparan, jadi kotak keterangan tidak melompat-lompat ukurannya. */
  cap.innerHTML = '<span class="ty"></span><span class="tr"></span>';
  var tyEl = cap.firstChild, trEl = cap.lastChild;
  var ty = { text: '', n: 0, goal: 0, cps: 16, raf: 0, last: 0 };
  function renderTy() { var k = Math.floor(ty.n); tyEl.textContent = ty.text.slice(0, k); trEl.textContent = ty.text.slice(k); cap.classList.toggle('typing', k < ty.text.length); }
  function tick(now) {
    ty.raf = 0; var dt = Math.min(0.1, (now - ty.last) / 1000); ty.last = now;
    ty.n = Math.min(ty.goal, ty.n + ty.cps * dt); renderTy();
    if (ty.n < ty.goal) ty.raf = requestAnimationFrame(tick);
  }
  /* ketik sampai indeks goal dengan kecepatan cps (huruf per detik) */
  function typeTo(goal, cps) {
    ty.goal = Math.max(ty.goal, Math.min(goal, ty.text.length)); ty.cps = cps;
    if (reduce) { ty.n = ty.goal; renderTy(); return; }
    if (!ty.raf && ty.n < ty.goal) { ty.last = performance.now(); ty.raf = requestAnimationFrame(tick); }
  }
  function jumpTo(k) { if (k > ty.n) { ty.n = Math.min(k, Math.max(ty.goal, k)); ty.goal = Math.max(ty.goal, ty.n); renderTy(); } }
  function showCap(t) { clearTimeout(capT); cancelAnimationFrame(ty.raf); ty.raf = 0; ty.text = t; ty.n = 0; ty.goal = 0; renderTy(); cap.classList.add('on'); }
  function hideCap() { cap.classList.remove('on'); }
  function duck(on) { try { if (window.HLAudio && window.HLAudio.duck) window.HLAudio.duck(on); } catch (e) { } }
  function shutUp() { talkId++; cur = null; if (TTS) { try { speechSynthesis.cancel(); } catch (e) { } } duck(false); }

  /* bacakan naskah dengan intonasi; teks terketik mengikuti suara. done() dipanggil sekali setelah selesai.
     Tanpa suara (narasi mati / tidak ada suara Indonesia): teks terketik dengan kecepatan baca. */
  function narrate(n, done) {
    var id = ++talkId, finished = false, text = plain(n.text), parts = null, i = 0;
    var end = function () {
      if (finished || id !== talkId) return; finished = true; cur = null; duck(false);
      typeTo(text.length, 90); capT = setTimeout(hideCap, 1500); done();
    };
    /* mode teks saja (dipakai juga saat narasi dimatikan di tengah bacaan) */
    var timed = function () {
      typeTo(text.length, 17);
      setTimeout(end, ((text.length - ty.n) / 17 + 1.4) * 1000);
    };
    var me = cur = { muted: false, mute: function () { this.muted = true; try { speechSynthesis.cancel(); } catch (e) { } duck(false); timed(); } };
    showCap(text);
    if (!narrOn || !TTS || !voice) { timed(); return; }
    try { speechSynthesis.cancel(); } catch (e) { }
    parts = prosody(n);
    /* posisi ketikan = proporsi bagian ucapan yang sudah dibacakan (teks layar dan teks ucapan bisa berbeda) */
    var total = 0; parts.forEach(function (p) { total += p.t.length + 1; });
    var kf = text.length / Math.max(1, total), c = 0;
    parts.forEach(function (p) { p.s = Math.round(c * kf); c += p.t.length + 1; p.e = Math.round(c * kf); });
    duck(true);
    var next = function () {
      if (id !== talkId || me.muted) return;
      if (i >= parts.length) { end(); return; }
      var p = parts[i++], u = new SpeechSynthesisUtterance(p.t);
      u.voice = voice; u.lang = voice.lang; u.rate = p.rate; u.pitch = p.pitch * basePitch; u.volume = 1;
      u.onstart = function () { var est = Math.max(0.35, p.t.length / (14.5 * p.rate)); typeTo(p.e, (p.e - p.s) / est); };
      u.onboundary = function (e) { if (id === talkId && typeof e.charIndex === 'number') jumpTo(p.s + Math.round(e.charIndex * kf)); };
      u.onend = function () { if (id !== talkId || me.muted) return; typeTo(p.e, 240); next(); };
      u.onerror = function (e) { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; if (id === talkId && !me.muted) timed(); };
      speechSynthesis.speak(u);
    };
    next();
    setTimeout(end, (text.length / 10 + 15) * 1000);              // pengaman jika peristiwa onend tidak pernah datang
  }

  /* ---------- gulir ---------- */
  var on = false, mode = 'tour', raf = 0, last = 0, pos = 0, v = 0, hold = 0, waiting = false, seen = {}, paused = false, userT = 0, stepT = 0, stuck = 0, lastY = 0;
  var secs = function () { return [].slice.call(document.querySelectorAll('main .sec')); };
  var maxY = function () { var e = document.scrollingElement || document.documentElement; return Math.max(0, e.scrollHeight - e.clientHeight); };
  var lenis = function () { return window.US && window.US.lenis; };
  /* gulir dengan scroll bawaan secara instan. Lenis (page.js) otomatis menyesuaikan diri lewat peristiwa scroll-nya
     selama ia tidak sedang beranimasi, jadi tidak ada tarik-menarik posisi. */
  function go(y) {
    y = Math.max(0, Math.min(maxY(), Math.round(y)));
    var l = lenis(); if (l && l.isScrolling === 'smooth') l.stop && l.start && (l.stop(), l.start());
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  }
  function speed() { return Math.max(70, Math.min(150, innerHeight * 0.13)); }
  function topOf(s) { return s.getBoundingClientRect().top + scrollY - (s.id === 'beranda' ? 0 : 72); }
  /* bagian yang sedang dibaca = bagian terakhir yang bagian atasnya sudah melewati sepertiga layar */
  function current() { var c = null; secs().forEach(function (s) { if (s.getBoundingClientRect().top <= innerHeight * 0.33) c = s; }); return c || secs()[0]; }

  /* berhenti di sebuah bagian dan bacakan naskahnya */
  function visit(s) {
    seen[s.id] = 1; v = 0;
    var n = NARR[s.id];
    if (!n) { hold = 2.4; return; }
    waiting = true;
    narrate(n, function () { if (on) { waiting = false; hold = 0.7; } });
  }
  /* setelah pengguna menggeser layar: lanjutkan dari posisi baru. Bagian di atasnya dianggap sudah dilewati;
     jika posisi baru berada di bagian yang belum dibacakan, narasi lama dihentikan dan bagian itu yang dibacakan. */
  function resync() {
    pos = scrollY; v = 0; hold = 0.3; stuck = 0;
    if (mode === 'scroll') return;
    var c = current(), list = secs(), idx = list.indexOf(c);
    list.forEach(function (s, i) { if (i < idx) seen[s.id] = 1; });
    if (c && !seen[c.id]) { shutUp(); waiting = false; visit(c); }
  }

  function frame(now) {
    raf = 0; if (!on) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.documentElement.classList.contains('portaling')) { stop(); return; }
    if (paused) {                                                   /* menunggu pengguna selesai menggeser */
      if (now - userT < 2200) { raf = requestAnimationFrame(frame); return; }
      paused = false; btn.classList.remove('wait'); sbtn.classList.remove('wait'); resync();
    }
    if (waiting) { raf = requestAnimationFrame(frame); return; }
    if (hold > 0) { hold -= dt; raf = requestAnimationFrame(frame); return; }
    if (reduce) {                                                   /* gerak dikurangi: lompat langsung ke bagian berikutnya */
      if (mode === 'scroll') {
        if (now > stepT) {
          var nb = secs().filter(function (s) { return s.getBoundingClientRect().top > 90; })[0];
          if (!nb) { stop(); return; }
          go(topOf(nb)); stepT = now + 6000;
        }
        raf = requestAnimationFrame(frame); return;
      }
      var nx = secs().filter(function (s) { return !seen[s.id]; })[0];
      if (!nx) { stop(); return; }
      go(topOf(nx)); pos = scrollY; visit(nx);
      raf = requestAnimationFrame(frame); return;
    }
    v += (speed() - v) * Math.min(1, dt * 1.6);                     /* percepatan halus setelah jeda */
    pos += v * dt;
    var list = mode === 'tour' ? secs() : [];                      /* mode gulir saja: tidak berhenti di tiap bagian */
    for (var i = 0; i < list.length; i++) {
      var s = list[i], t = s.getBoundingClientRect().top;
      if (!seen[s.id] && t <= 80 && t > -200) { pos = Math.round(topOf(s)); go(pos); visit(s); raf = requestAnimationFrame(frame); return; }
    }
    var m = maxY();
    /* batas gulir sebenarnya bisa lebih pendek dari scrollHeight (elemen dekoratif di luar alur): jika gulir tidak lagi
       bergerak padahal target terus maju, anggap sudah di akhir halaman */
    if (pos > m) pos = m;
    /* jika posisi tidak lagi bergerak selama ~1,5 detik padahal target maju, anggap sudah di akhir halaman */
    if (pos > scrollY + 40 && Math.abs(scrollY - lastY) < 1) { stuck += dt; if (stuck > 1.5) pos = m; } else stuck = 0;
    lastY = scrollY;
    if (pos >= m) {
      go(m);
      /* tur bernarasi selesai: hitung mundur lalu masuk ke aplikasi (kabut -> loader sungai -> aplikasi) */
      if (mode === 'tour' && !leaving) {
        /* bagian terakhir yang tidak bisa digulir sampai ke atas layar tetap dibacakan dulu */
        var left = secs().filter(function (q) { return !seen[q.id] && q.getBoundingClientRect().top < innerHeight * 0.75; })[0];
        if (left) { visit(left); raf = requestAnimationFrame(frame); return; }
        finishTour(); raf = requestAnimationFrame(frame); return;
      }
      if (!leaving) stop();
      return;
    }
    go(pos);
    raf = requestAnimationFrame(frame);
  }
  /* akhir tur: tampilkan hitung mundur di teks keterangan, lalu buka gerbang ke aplikasi.
     Menggeser layar atau menekan Jeda/Esc selama hitung mundur membatalkannya. */
  var leaving = false, leaveT = 0;
  function finishTour() {
    leaving = true; var n = 3;
    var step = function () {
      if (!leaving) return;
      if (n === 0) {
        leaving = false; var y = innerHeight / 2, x = innerWidth / 2;
        stop();
        if (window.HLPortal) window.HLPortal.open('/app/', x, y); else location.assign('/app/');
        return;
      }
      showCap('Menuju ruang simulasi dalam ' + n + '\u2026'); typeTo(999, 60); n--;
      leaveT = setTimeout(step, 1000);
    };
    step();
  }
  function cancelLeave() { if (!leaving) return; leaving = false; clearTimeout(leaveT); hideCap(); }

  /* mulai dari mana saja: bagian yang sedang tampil langsung dibacakan, bagian di atasnya dilewati */
  function start(m) {
    if (on) return; mode = m === 'scroll' ? 'scroll' : 'tour'; on = true; label(true);
    if (scrollY >= maxY() - 4) go(0);                               /* di akhir halaman: mulai lagi dari atas */
    pos = scrollY; v = 0; hold = 0; waiting = false; paused = false; seen = {}; stepT = 0; stuck = 0;
    if (mode === 'scroll') { hold = 0.2; last = performance.now(); raf = requestAnimationFrame(frame); return; }
    var c = current(), list = secs(), idx = list.indexOf(c);
    list.forEach(function (s, i) { if (i < idx) seen[s.id] = 1; });
    if (c) visit(c);
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!on) return; on = false; label(false); cancelAnimationFrame(raf); raf = 0; cancelLeave();
    waiting = false; paused = false; shutUp(); hideCap();
  }
  btn.addEventListener('click', function () { if (on) stop(); else start('tour'); });
  sbtn.addEventListener('click', function () { if (on) stop(); else start('scroll'); });
  nbtn.addEventListener('click', function () {
    narrOn = !narrOn; nlabel();
    try { localStorage.setItem('hl-narasi', narrOn ? 'on' : 'off'); } catch (e) { }
    if (!narrOn && cur) cur.mute();                                 /* teks tetap terketik, tur lanjut sesuai waktu baca */
  });
  addEventListener('resize', place);

  /* pengguna menggeser layar: tur dijeda sebentar (narasi tetap jalan), lalu lanjut sendiri dari posisi baru */
  var userMove = function () { if (!on) return; if (leaving) { cancelLeave(); stop(); return; } paused = true; userT = performance.now(); (mode === 'scroll' ? sbtn : btn).classList.add('wait'); };
  var isTour = function (t) { return btn.contains(t) || nbtn.contains(t) || sbtn.contains(t); };
  addEventListener('wheel', userMove, { passive: true });
  addEventListener('touchstart', function (e) { if (!isTour(e.target)) userMove(); }, { passive: true });
  addEventListener('touchmove', function (e) { if (!isTour(e.target)) userMove(); }, { passive: true });
  addEventListener('keydown', function (e) {
    if (!on || isTour(e.target)) return;
    if (e.key === 'Escape') stop();
    else if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) userMove();
  });
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) userMove(); });
  addEventListener('pageshow', function () { stop(); });
  addEventListener('pagehide', function () { stop(); });
  label(false);
  window.HLAuto = { start: start, stop: stop, get on() { return on; }, get mode() { return mode; } };
})();
