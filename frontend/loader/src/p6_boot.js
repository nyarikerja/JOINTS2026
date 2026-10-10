/* ---------- Demo mandiri: simulasi unduhan (aplikasi memakai p6_embed.js dengan progres asli) ---------- */
function simulateLoading(Progress, speedRef) {
  const defs = [['font', 0.08, 0.2], ['shader', 0.17, 0.5], ['model', 0.35, 1.8], ['tekstur', 0.25, 1.2], ['halaman', 0.15, 0.8]];
  const st = defs.map(d => ({ name: d[0], dur: d[2] * 8, start: Math.random() * 2.5 + d[2], p: 0, stall: 0 }));
  defs.forEach(d => Progress.register(d[0], d[1], 'Memuat ' + d[0]));
  let t = 0, prev = performance.now();
  const id = setInterval(() => {
    const now = performance.now(), dt = (now - prev) / 1000; prev = now; t += dt * speedRef.v;
    let done = true;
    st.forEach(s => {
      if (t < s.start) { done = false; return; }
      if (s.p >= 1) return;
      if (s.stall > 0) { s.stall -= dt * speedRef.v; done = false; return; }
      s.p = Math.min(1, s.p + dt * speedRef.v / s.dur * (0.4 + Math.random() * 1.4));
      if (Math.random() < 0.01) s.stall = 0.3 + Math.random() * 0.9;
      Progress.report(s.name, s.p); if (s.p < 1) done = false;
    });
    if (done) clearInterval(id);
  }, 50);
  return id;
}

/* ---------- Mulai (demo) : ?speed=0.3 untuk unduhan lambat, ?speed=4 untuk cepat, ?next=/app/ untuk pindah ---------- */
(function () {
  const qs = new URLSearchParams(location.search);
  CFG.nextUrl = qs.get('next');
  const app = createApp({ quick: qs.has('quick') ? true : false });
  window.RiverLoader = app.loader;
  if (typeof __TEST__ !== 'undefined') { __TEST__({ app }); return; }
  app.boot();
  simulateLoading(app.Progress, { v: +(qs.get('speed') || 1) });
})();
