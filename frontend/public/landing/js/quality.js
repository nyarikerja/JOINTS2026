/* HelaLoka: pilihan kualitas grafis (dipakai landing page dan loader sungai di aplikasi).
   Disimpan di localStorage 'hl-quality': auto | high | lite | static. Mengubah pilihan memuat ulang halaman
   di posisi gulir yang sama, karena jumlah objek 3D ditentukan saat adegan dibangun. */
(function () {
  var KEY = 'hl-quality', cur = 'auto';
  try { cur = localStorage.getItem(KEY) || 'auto'; } catch (e) { }
  var OPTS = [
    ['auto', 'Otomatis', 'Menyesuaikan resolusi dengan kemampuan perangkat'],
    ['high', 'Tinggi', 'Resolusi penuh untuk laptop/PC dengan GPU kuat'],
    ['lite', 'Hemat', 'Resolusi rendah dan 30 fps, cocok untuk HP dan baterai'],
    ['static', 'Statis', 'Tanpa animasi menerus; lanskap digambar ulang hanya saat digulir']
  ];
  var anchor = document.getElementById('audioBtn');
  if (!anchor) return;
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'audio-btn q-btn'; btn.id = 'qBtn';
  btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'qPop');
  btn.setAttribute('aria-label', 'Kualitas grafis: ' + label(cur)); btn.title = 'Kualitas grafis';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  anchor.parentNode.insertBefore(btn, anchor);
  var pop = document.createElement('div');
  pop.className = 'q-pop'; pop.id = 'qPop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Kualitas grafis');
  pop.innerHTML = '<p class="q-h">Kualitas grafis</p><div role="radiogroup" aria-label="Kualitas grafis">' + OPTS.map(function (o) {
    return '<label class="q-opt"><input type="radio" name="hlq" value="' + o[0] + '"' + (o[0] === cur ? ' checked' : '') + '><span><b>' + o[1] + '</b><i>' + o[2] + '</i></span></label>';
  }).join('') + '</div><p class="q-note">Berlaku juga untuk layar pemuatan aplikasi.</p>';
  document.body.appendChild(pop);
  function label(v) { for (var i = 0; i < OPTS.length; i++) if (OPTS[i][0] === v) return OPTS[i][1]; return 'Otomatis'; }
  function place() { var r = btn.getBoundingClientRect(); pop.style.top = (r.bottom + 10) + 'px'; pop.style.right = Math.max(12, innerWidth - r.right - 40) + 'px'; }
  function show(on) {
    pop.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { place(); var c = pop.querySelector('input:checked') || pop.querySelector('input'); c.focus(); }
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); show(pop.hidden); });
  document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) show(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { show(false); btn.focus(); } });
  addEventListener('resize', function () { if (!pop.hidden) place(); });
  pop.addEventListener('change', function (e) {
    var v = e.target && e.target.value; if (!v || v === cur) return;
    try { localStorage.setItem(KEY, v); sessionStorage.setItem('hl-scroll', String(scrollY)); } catch (err) { }
    pop.querySelector('.q-note').textContent = 'Menerapkan ' + label(v) + '…';
    setTimeout(function () { location.reload(); }, 250);
  });
  /* kembali ke posisi gulir sebelum muat ulang */
  try {
    var y = sessionStorage.getItem('hl-scroll');
    if (y != null) { sessionStorage.removeItem('hl-scroll'); addEventListener('load', function () { setTimeout(function () { if (window.US && window.US.lenis) window.US.lenis.scrollTo(+y, { immediate: true }); else scrollTo(0, +y); if (window.US) window.US.snap = true; }, 60); }); }
  } catch (e) { }
  document.documentElement.setAttribute('data-q', cur);
})();
