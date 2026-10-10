/* ---------- View cadangan 2D (tanpa WebGL2 atau mode statis) ---------- */
function createViewFallback(root) {
  root.hidden = false;
  root.innerHTML = `<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="ld-fb-svg">
<defs>
<linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1"><stop id="fs-s0" offset="0%" stop-color="#221832"/><stop offset="45%" stop-color="#462a4d"/><stop offset="75%" stop-color="#8c4756"/><stop id="fs-s1" offset="100%" stop-color="#f59e72"/></linearGradient>
<radialGradient id="fs-sun-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fffce8" stop-opacity="0.9"/><stop offset="25%" stop-color="#ffb875" stop-opacity="0.5"/><stop offset="65%" stop-color="#e86145" stop-opacity="0.15"/><stop offset="100%" stop-color="#e86145" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-pg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="20%" stop-color="#ffe6b0"/><stop offset="45%" stop-color="#ff87b2" stop-opacity="0.85"/><stop offset="75%" stop-color="#72d1ff" stop-opacity="0.5"/><stop offset="100%" stop-color="#aa85ff" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-portal-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="1"/><stop offset="50%" stop-color="#ffe396" stop-opacity="0.8"/><stop offset="100%" stop-color="#ff8ea8" stop-opacity="0"/></radialGradient>
<radialGradient id="fs-lantern-rad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#ffea9f"/><stop offset="60%" stop-color="#ff8e38" stop-opacity="0.7"/><stop offset="100%" stop-color="#ff4400" stop-opacity="0"/></radialGradient>
<filter id="fs-blur-sm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>
<rect width="1000" height="600" fill="url(#fs-sky)"/>
<circle id="fs-sunc" cx="720" cy="220" r="140" fill="url(#fs-sun-halo)"/>
<image href="/loader/static-river.jpg" x="0" y="0" width="1000" height="600" preserveAspectRatio="xMidYMid slice" />
<circle cx="760" cy="225" r="160" fill="url(#fs-sun-halo)" opacity="0.45" style="mix-blend-mode: screen;"/>
<g id="fs-gate-portal" transform="translate(328 368)">
<polygon points="-12,0 12,0 28,45 -28,45" fill="url(#fs-portal-core)" opacity="0.35" style="mix-blend-mode: screen;"/>
<ellipse id="fs-portal" cx="0" cy="-22" rx="19" ry="32" fill="url(#fs-pg)" opacity="0.5" filter="url(#fs-blur-sm)" style="mix-blend-mode: screen;"/>
<ellipse cx="0" cy="-22" rx="9" ry="18" fill="url(#fs-portal-core)" opacity="0.65" style="mix-blend-mode: screen;"/>
<circle cx="-18" cy="-8" r="14" fill="url(#fs-lantern-rad)" opacity="0.7" style="mix-blend-mode: screen;"/>
<circle cx="18" cy="-8" r="14" fill="url(#fs-lantern-rad)" opacity="0.7" style="mix-blend-mode: screen;"/>
</g>
<g opacity="0.5" style="mix-blend-mode: screen;">
<ellipse cx="500" cy="520" rx="65" ry="5" fill="#ffd59e" filter="url(#fs-blur-sm)" opacity="0.4"/>
<ellipse cx="440" cy="450" rx="40" ry="3.5" fill="#ffb076" filter="url(#fs-blur-sm)" opacity="0.35"/>
</g>
</svg>
<div class="fb-petals">
${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 7.1 + 3) % 100}%;--d:${7 + (i % 5)}s;--l:${-(i * 1.2)}s"></i>`).join('')}
${Array.from({ length: 8 }, (_, i) => `<i class="firefly" style="top:${35 + (i * 6)}%;left:${(i * 12 + 5) % 100}%;--d:${3.5 + (i % 3)}s;--l:${-(i * 0.8)}s"></i>`).join('')}
</div>`;
  const q = id => root.querySelector('#' + id);
  let pos = [32.8, 61.3];
  return {
    kind: 'fallback', stages: [], B: { speed: 0 },
    update(dt, ctl) {
      const p = ctl.mode === 'reveal' ? 1 : ctl.smooth;
      const sw = seasonWP(p), top = sw3(SEAS.top, sw), hor = sw3(SEAS.hor, sw);
      root.style.setProperty('--pc', ['#ffffff', '#fff1b0', '#e8f0c8', '#d9722a', '#f6b7c9'][sw.indexOf(Math.max(...sw))]);
      const hx = c => '#' + c.map(v => ('0' + Math.round(clamp(v, 0, 1) * 255).toString(16)).slice(-2)).join('');
      if (q('fs-s0')) q('fs-s0').setAttribute('stop-color', hx(top));
      if (q('fs-s1')) q('fs-s1').setAttribute('stop-color', hx(hor));
      if (q('fs-sunc')) q('fs-sunc').setAttribute('cy', (220 - 70 * p).toFixed(1));
      if (q('fs-portal')) q('fs-portal').setAttribute('opacity', (ctl.mode === 'reveal' ? 1 : ctl.ready ? 0.95 : 0.4 + 0.5 * p).toString());
      pos = [32.8, 61.3];
    },
    render() { }, governor() { }, setSize() { },
    screenPos() { return pos; },
    dispose() { root.innerHTML = ''; root.hidden = true; },
    get arrived() { return true; }
  };
}

/* ---------- Pengendali progres, UI, dan reveal ----------
   Pola dari sakura-fantasy (MIT, (c) 2026 Bill Chan): src/main.js report() (progres gabungan berbobot dari
   banyak pemuat paralel) dan src/ui/ui.js progress()/ready()/open() (nilai target dikejar perlahan, tombol masuk,
   lalu reveal dengan mask radial yang melebar). */
const PHASES = [
  [0, 'Menyiapkan ruang kendali'], [0.15, 'Memuat katalog gunung api dan kawasan hutan'], [0.35, 'Mengambil titik panas dan data angin'],
  [0.55, 'Menyusun lapisan peta'], [0.75, 'Memetakan fasilitas dan penduduk'], [0.9, 'Mengalibrasi zona bahaya'], [1, 'Ruang simulasi siap']
];
function createApp(opts) {
  opts = opts || {};
  const $ = id => document.getElementById(id);
  const els = {
    root: $('hlLoader'), loader: $('ldScene'), canvas: $('ldGl'), fb: $('ldFb'), skip: $('ldSkip'), sr: $('ldSr'), ring: $('ldRing'),
    pct: $('ldPct'), msg: $('ldMsg'), dot: $('ldDot'), path: $('ldPath'), enter: $('ldEnter'), sound: $('ldSound'), title: $('ldTitle'), hint: $('ldHint')
  };
  const ctl = { target: 0, smooth: 0, mode: 'loading', revealE: 0, ready: false, readyCbs: [], revealStart: 0, revealDur: 2600, lastPct: -1, lastSr: -1, lastMsg: '', t0: performance.now(), frames: 0 };
  let view = null, raf = 0, last = 0, destroyed = false, nextStageIdx = 0, hiddenTab = false, autoT = 0;
  let quick = false;
  try { quick = sessionStorage.getItem('hl-loader-seen') === '1'; sessionStorage.setItem('hl-loader-seen', '1'); } catch (e) { }
  if (opts.quick != null) quick = opts.quick;
  const sound = createRiverSound(); window.__riverSound = sound;

  /* progres gabungan berbobot */
  const tasks = {}, order = [];
  const Progress = {
    register(name, weight, label) { if (!tasks[name]) order.push(name); tasks[name] = { w: weight, v: tasks[name] ? tasks[name].v : 0, label: label || name }; Progress.report(name, tasks[name].v); },
    report(name, v) {
      if (!tasks[name]) return; tasks[name].v = Math.max(tasks[name].v, clamp(v, 0, 1));
      let sw = 0, s = 0; for (const k in tasks) { sw += tasks[k].w; s += tasks[k].w * tasks[k].v; }
      loader.setProgress(sw ? s / sw : 0);
    },
    done(name) { Progress.report(name, 1); },
    current() { for (const k of order) if (tasks[k].v < 1) return tasks[k].label; return null; },
    get tasks() { const o = {}; for (const k of order) o[k] = +tasks[k].v.toFixed(2); return o; }
  };

  function setMsg(t) { if (t !== ctl.lastMsg && els.msg) { ctl.lastMsg = t; els.msg.textContent = t; } }
  function showReady() {
    if (ctl.ready) return; ctl.ready = true;
    els.root.classList.add('ready');
    els.root.setAttribute('aria-busy', 'false');
    setMsg('Ruang simulasi siap'); if (els.pct) els.pct.textContent = '100%';
    els.sr.textContent = 'Selesai memuat. Membuka ruang simulasi.';
    if (sound) sound.ready();
    ctl.readyCbs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
    /* otomatis langsung masuk ke dimensi ruang simulasi saat loading bar 100% (statis langsung seketika) */
    const isStatic = view && view.kind === 'fallback';
    autoT = setTimeout(() => beginReveal(isStatic ? true : false), isStatic ? 0 : RM ? 50 : 200);
  }
  function updateUI() {
    const pct = Math.floor(ctl.smooth * 100);
    if (!ctl.ready) {
      const b = Math.floor(ctl.smooth * 5);
      if (b !== ctl.lastSr) { ctl.lastSr = b; els.sr.textContent = 'Memuat ' + pct + ' persen.'; }
      if (pct !== ctl.lastPct && els.pct) { ctl.lastPct = pct; els.pct.textContent = pct + '%'; }
      let m = Progress.current();
      if (!m) for (let i = PHASES.length - 1; i >= 0; i--) if (ctl.smooth >= PHASES[i][0]) { m = PHASES[i][1]; break; }
      setMsg(m || PHASES[0][1]);
    }
    if (els.dot && els.path && els.path.getTotalLength) {
      const L = els.path.getTotalLength(), pt = els.path.getPointAtLength(L * ctl.smooth);
      els.dot.setAttribute('cx', pt.x.toFixed(1)); els.dot.setAttribute('cy', pt.y.toFixed(1));
      els.path.parentNode.style.setProperty('--p', ctl.smooth.toFixed(3));
    }
  }

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function placeHole() {
    const sp = view ? view.screenPos() : [50, 50];
    const r = els.root.style; r.setProperty('--cx', sp[0].toFixed(1) + '%'); r.setProperty('--cy', sp[1].toFixed(1) + '%');
  }
  function beginReveal(fast) {
    if (ctl.mode !== 'loading' || destroyed) return;
    clearTimeout(autoT);
    ctl.mode = 'reveal'; ctl.revealStart = performance.now();
    const isStatic = view && view.kind === 'fallback';
    ctl.revealDur = RM || isStatic ? 450 : fast ? 1200 : 2700;
    placeHole(); els.root.style.setProperty('--hole', '-8%');
    els.root.classList.add('revealing');
    if (els.enter) els.enter.disabled = true;
    if (sound) { sound.portal(); sound.close(ctl.revealDur / 1000 + 0.6); }
    window.dispatchEvent(new CustomEvent('loader:reveal'));
  }
  function finish() { loader.destroy(); }

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!(dt > 0) || hiddenTab) return;
    U.time.value += dt;
    const isStatic = view && view.kind === 'fallback';
    ctl.smooth += (ctl.target - ctl.smooth) * (1 - Math.exp(-dt * (isStatic ? 8.0 : 2.8)));
    if (ctl.target - ctl.smooth < 0.0008) ctl.smooth = ctl.target;
    if (sound) sound.progress(ctl.smooth);
    if (ctl.mode === 'reveal') {
      const k = clamp((now - ctl.revealStart) / ctl.revealDur, 0, 1);
      ctl.revealE = RM ? 0 : ease(k);
      const h = ease(clamp((k - 0.16) / 0.84, 0, 1));
      placeHole();
      els.root.style.setProperty('--hole', (-8 + h * 135).toFixed(2) + '%');
      els.root.style.setProperty('--rot', (now * 0.12 % 360).toFixed(1) + 'deg');
      if (k >= 1) { finish(); return; }
    }
    updateUI();
    const elapsed = (now - ctl.t0) / 1000;
    if (ctl.mode === 'loading' && !ctl.ready && ctl.target >= 1 && ctl.smooth >= 0.999 && (isStatic || view.arrived || elapsed > 2.2)) showReady();
    /* pengaman: jangan pernah mengurung pengguna jika ada data yang macet */
    if (!ctl.ready && elapsed > (opts.watchdog || 22) && ctl.target < 1) { ctl.target = 1; els.sr.textContent = 'Sebagian data masih dimuat di latar.'; }
    view.update(dt, ctl);
    view.render();
    view.governor(dt);
    if (nextStageIdx < view.stages.length && ctl.frames > 1) {
      view.stages[nextStageIdx++]();
      Progress.report('dunia', nextStageIdx / view.stages.length);
    }
    ctl.frames++;
    if (ctl.frames === 2) els.root.classList.add('live');
  }

  function switchToFallback() {
    if (view && view.kind === 'fallback') return;
    try { view && view.dispose(); } catch (e) { }
    els.canvas.hidden = true; view = createViewFallback(els.fb); Progress.done('dunia');
  }

  function syncSoundBtn() {
    if (!els.sound) return;
    const on = !!(sound && sound.on);
    els.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.sound.setAttribute('aria-label', on ? 'Matikan suara' : 'Nyalakan suara');
    els.sound.classList.toggle('on', on);
    if (els.hint) els.hint.classList.toggle('on', !on && !!sound && !sound.prefOff && ctl.mode === 'loading');
  }
  function firstGesture(e) {
    if (e.target && e.target.closest && e.target.closest('#ldSound')) return;
    removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true);
    if (sound && !sound.on && !sound.prefOff && ctl.mode === 'loading') { sound.set(true); syncSoundBtn(); }
  }
  function onKey(e) {
    if (destroyed || ctl.mode !== 'loading') return;
    if (e.key === 'Escape') { loader.skip(); return; }
    if (!ctl.ready) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.key === 'Enter' || e.key === ' ') && (document.activeElement === els.enter || !/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(tag))) { e.preventDefault(); beginReveal(false); }
  }

  const loader = {
    setProgress(p) { ctl.target = Math.max(ctl.target, clamp(p, 0, 1)); },
    onReady(cb) { ctl.readyCbs.push(cb); if (ctl.ready) cb(); },
    start() { if (ctl.ready) beginReveal(false); else ctl.startWhenReady = true; },
    skip() { if (ctl.mode !== 'loading') return; ctl.target = 1; ctl.smooth = 1; beginReveal(true); },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); clearTimeout(autoT);
      try { view && view.dispose(); } catch (e) { console.error(e); }
      if (sound) sound.close(0.3);
      window.__riverSound = null;
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true);
      document.removeEventListener('visibilitychange', onVis);
      els.root.remove(); document.documentElement.classList.remove('hl-loading');
      window.RiverLoader = null;
      window.dispatchEvent(new CustomEvent('loader:done'));
      if (CFG.nextUrl) location.assign(CFG.nextUrl);
    },
    Progress, get progress() { return ctl.smooth; }, get active() { return !destroyed; }
  };
  loader.onReady(() => { if (ctl.startWhenReady) beginReveal(false); });

  let rt = 0; function onResize() { clearTimeout(rt); rt = setTimeout(() => view && view.setSize(), 120); }
  function onVis() { hiddenTab = document.hidden; last = performance.now(); }

  function boot() {
    if (RM) els.root.classList.add('rm');
    Progress.register('dunia', 0.05, 'Membangun lanskap sungai');
    /* kunjungan ulang: perjalanan dipersingkat, perahu mulai dekat jembatan */
    if (quick) { CFG.zStart += CFG.journey * 0.4; CFG.journey *= 0.6; }
    try {
      if (QUALITY === 'static') throw new Error('mode statis');
      /* cek dukungan WebGL2 lebih dulu supaya three.js tidak menulis galat ke konsol */
      const probe = document.createElement('canvas'); let gl2 = null; try { gl2 = probe.getContext('webgl2'); } catch (e) { }
      if (!gl2) throw new Error('WebGL2 tidak tersedia');
      const lose = gl2.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      view = createView3D(els.canvas);
      els.canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); switchToFallback(); });
    } catch (err) {
      if (QUALITY !== 'static') console.warn('Memakai versi 2D:', err && err.message);
      els.canvas.hidden = true; view = createViewFallback(els.fb); els.root.classList.add('live');
      Progress.done('dunia');
    }
    els.skip.addEventListener('click', () => loader.skip());
    if (els.enter) els.enter.addEventListener('click', () => beginReveal(false));
    if (els.sound) els.sound.addEventListener('click', () => { if (!sound) return; sound.set(!sound.on); syncSoundBtn(); });
    if (!sound && els.sound) els.sound.hidden = true;
    addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis);
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', firstGesture, true); addEventListener('keydown', firstGesture, true);
    if (sound) sound.autostart().then(syncSoundBtn); else syncSoundBtn();
    setTimeout(syncSoundBtn, 600);
    requestAnimationFrame(() => els.title && els.title.classList.add('in'));
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  return { loader, boot, ctl, Progress };
}
