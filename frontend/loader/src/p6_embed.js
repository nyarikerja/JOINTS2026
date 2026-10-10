
/* ---------- Mulai (tertanam di aplikasi /app/) ----------
   Bobot tugas dihitung seperti report() di sakura-fantasy/src/main.js. Aplikasi React melapor lewat
   window.RiverLoader.Progress.report(nama, 0..1) (lihat src/utils/bootProgress.ts). */
(function () {
  if (!document.getElementById('hlLoader')) return;
  const app = createApp({});
  window.RiverLoader = app.loader;
  const P = app.Progress;
  P.register('bundle', 0.15, 'Memuat aplikasi');
  P.register('fonts', 0.05, 'Menyiapkan huruf');
  P.register('data', 0.35, 'Mengambil data gunung api, hutan, dan titik panas');
  P.register('tiles', 0.25, 'Mengunduh citra satelit');
  P.register('peta', 0.15, 'Menyusun lapisan peta');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => P.done('fonts')); else P.done('fonts');
  app.boot();
})();
