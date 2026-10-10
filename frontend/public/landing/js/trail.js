/* HelaLoka: tata letak yang lebih hidup.
   1) Jalur pendakian bertitik yang berkelok menghubungkan tiap bagian (seperti peta rute), tergambar mengikuti gulir,
      dengan penanda kecil di posisi pembaca dan titik singgah di tiap bagian.
   2) Kartu pertanyaan bergaya scrapbook: sedikit miring dan ditempel selotip.
   3) Kartu kecil miring halus mengikuti kursor (hanya perangkat dengan pointer presisi). */
(function () {
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  var main = document.querySelector('main'); if (!main) return;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- 2) selotip pada kartu pertanyaan ---------- */
  [].slice.call(document.querySelectorAll('.ask li')).forEach(function (li, i) {
    var t = document.createElement('i'); t.className = 'tape'; t.setAttribute('aria-hidden', 'true');
    t.style.setProperty('--tr', (i % 2 ? 4 : -5) + 'deg'); li.appendChild(t); li.classList.add('scrap');
  });

  /* ---------- 1) jalur pendakian ---------- */
  var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'trail'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<defs><clipPath id="trailClip"><rect id="trailRect" x="0" y="0" width="100%" height="0"/></clipPath></defs>' +
    '<path class="trail-bg"/><path class="trail-fg" clip-path="url(#trailClip)"/><g class="trail-pts"></g>' +
    '';
  /* pesawat kertas di lapisan sendiri di atas konten, supaya tidak tertutup kartu dan cahaya latar */
  var top = document.createElementNS(NS, 'svg'); top.setAttribute('class', 'trail trail-top'); top.setAttribute('aria-hidden', 'true');
  top.innerHTML = '<g class="trail-mk"><g class="pl-bob"><path class="pl-under" d="M16 0L-12 9-5 1z"/><path class="pl-top" d="M16 0L-14-10-6 0-5 1z"/>' +
    '<path class="pl-fold" d="M16 0L-6 0"/><path class="pl-edge" d="M16 0L-14-10-6 0-12 9z"/></g></g>';
  main.insertBefore(svg, main.firstChild); main.appendChild(top);
  var bg = svg.querySelector('.trail-bg'), fg = svg.querySelector('.trail-fg'), pts = svg.querySelector('.trail-pts'), rect = svg.querySelector('#trailRect'), mk = top.querySelector('.trail-mk');
  var table = [], mTop = 0, H = 0, on = false;
  function docTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function build() {
    on = innerWidth >= 900; svg.style.display = top.style.display = on ? '' : 'none'; if (!on) return;
    var secs = [].slice.call(main.querySelectorAll(':scope > section')).filter(function (s) { return s.querySelector('.num'); });
    mTop = docTop(main); H = main.offsetHeight; var W = main.clientWidth;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.height = H + 'px';
    top.setAttribute('viewBox', '0 0 ' + W + ' ' + H); top.style.height = H + 'px';
    /* titik singgah = angka besar tiap bagian; di antaranya jalur berayun ke ruang terbuka di kanan */
    var P = [], mr = main.getBoundingClientRect();
    secs.forEach(function (s, i) {
      var num = s.querySelector('.num'), x, y;
      if (num) { var r = num.getBoundingClientRect(); x = r.left - mr.left + r.width * .5; y = docTop(num) - mTop + r.height * .55; }
      else { x = W * .52; y = docTop(s) - mTop + s.offsetHeight * .5; }
      if (P.length) { var q = P[P.length - 1]; P.push([W * (i % 2 ? .84 : .74), (q[1] + y) / 2]); }
      P.push([x, Math.max(40, y)]);
    });
    P.push([W * .5, H - 40]);
    var d = 'M' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
    for (var i = 1; i < P.length; i++) { var a = P[i - 1], b = P[i], dy = (b[1] - a[1]) * .55; d += 'C' + a[0].toFixed(1) + ' ' + (a[1] + dy).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + (b[1] - dy).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1); }
    bg.setAttribute('d', d); fg.setAttribute('d', d);
    pts.innerHTML = P.filter(function (p, i) { return i % 2 === 0 && i < P.length - 1; }).map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/>'; }).join('');
    /* tabel panjang -> titik untuk menempatkan penanda di ketinggian pembaca */
    var L = fg.getTotalLength(), n = 400; table = [];
    for (var k = 0; k <= n; k++) { var q = fg.getPointAtLength(L * k / n); table.push([q.x, q.y]); }
    update();
  }
  function at(y) {
    if (!table.length) return [0, 0];
    var lo = 0, hi = table.length - 1;
    if (y <= table[0][1]) return table[0];
    for (var i = 1; i < table.length; i++) if (table[i][1] >= y) { lo = i - 1; hi = i; break; }
    var a = table[lo], b = table[hi], t = (y - a[1]) / Math.max(1e-3, b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  var lastY = -1, curAng = 90, tgtAng = 90, dir = 1;
  function update() {
    if (!on) return;
    var y = scrollY + innerHeight * .55 - mTop, moved = Math.abs(y - lastY) >= .5;
    if (!moved && Math.abs(tgtAng - curAng) < .3) return;
    if (moved) {
      if (lastY >= 0) dir = y > lastY ? 1 : -1;
      lastY = y;
      rect.setAttribute('height', Math.max(0, y).toFixed(0));
    }
    /* pesawat kertas menghadap arah jalur: turun saat digulir ke bawah, berbalik saat digulir ke atas */
    var yy = Math.max(0, Math.min(H, y)), p = at(yy), q = at(Math.min(H, yy + 24)), dx = q[0] - p[0], dy = q[1] - p[1];
    tgtAng = (dx || dy) ? Math.atan2(dy * dir, dx * dir) * 180 / Math.PI : 90 * dir;
    var d = ((tgtAng - curAng) % 360 + 540) % 360 - 180; tgtAng = curAng + d;
    curAng += d * .15;
    mk.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ') rotate(' + curAng.toFixed(1) + ') scale(' + (innerWidth < 1200 ? 1.5 : 1.9) + ')');
  }
  var rt = 0; function later() { clearTimeout(rt); rt = setTimeout(build, 200); }
  addEventListener('resize', later); addEventListener('load', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  if (window.ResizeObserver) new ResizeObserver(later).observe(main);
  (function tick() { update(); requestAnimationFrame(tick); })();
  build();

  /* ---------- 3) miring halus mengikuti kursor ---------- */
  if (fine && !reduce) {
    [].slice.call(document.querySelectorAll('.facts li,.ask li,.vine li,.aud li,.res>div,.modes li,#sumber li')).forEach(function (el) {
      el.classList.add('tilt');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.setProperty('--tx', (x * 7).toFixed(2) + 'deg'); el.style.setProperty('--ty', (-y * 6).toFixed(2) + 'deg');
        el.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg'); });
    });
  }
})();
