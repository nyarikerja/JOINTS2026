/* ---------- Suara loader: prosedural (Web Audio), tanpa file ----------
   Lapisan: aliran sungai (brown noise + gemericik), angin, kicau burung, denting metalofon bernada slendro
   dengan ombak (pelayangan) khas gamelan, cebur galah perahu, "plip" koi, dan desir portal saat masuk.
   Preferensi disimpan di localStorage 'hl-sound' (on/off), sama dengan landing page. */
function createRiverSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx = null, master = null, bus = null, verb = null, on = false, built = false, timers = [], progress = 0, closing = false;
  const L = { river: null, wind: null };
  const pref = () => { try { return localStorage.getItem('hl-sound'); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem('hl-sound', v); } catch (e) { } };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function noiseBuf(type, sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
      }
      const f = Math.floor(sr * 0.2); for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
    }
    return b;
  }
  function impulse(sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  function loop(buf, gain) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); s.start(); return { s, g }; }

  function build() {
    built = true;
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(3.2); const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
    /* sungai: brown noise lewat lowpass yang bernapas + bandpass untuk gemericik */
    const brown = noiseBuf('brown', 6), pink = noiseBuf('pink', 5);
    const r = loop(brown, 0.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    r.g.connect(lp); lp.connect(bus); L.river = r;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const bub = loop(pink, 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2.5; bub.g.connect(bp); bp.connect(bus);
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.31; lg2.gain.value = 700; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
    /* angin */
    const w = loop(pink, 0.06), wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.6; w.g.connect(wf); wf.connect(bus); L.wind = w;
    const lfo3 = ctx.createOscillator(), lg3 = ctx.createGain(); lfo3.frequency.value = 0.05; lg3.gain.value = 300; lfo3.connect(lg3); lg3.connect(wf.frequency); lfo3.start();
    schedule();
  }

  /* metalofon: parsial tak harmonis + dua bilah sedikit berbeda nada (ombak) */
  const SLENDRO = [0, 240, 480, 720, 960, 1200, 1440];
  function bell(freq, t, vel, dur) {
    const parts = [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]];
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (pan) { pan.pan.value = rnd(-0.5, 0.5); g.connect(pan); pan.connect(bus); pan.connect(verb); } else { g.connect(bus); g.connect(verb); }
    parts.forEach(([m, a], i) => [0, 1].forEach(j => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
      o.frequency.value = freq * m * (j ? 1.0 + 4.5 / (freq * m) : 1); og.gain.value = a * 0.5 / (1 + i * 0.3);
      og.gain.setValueAtTime(a * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0005, t + dur / (1 + i * 1.4));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }));
  }
  function gong(t, vel) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 68; o2.frequency.value = 70.4; o.type = o2.type = 'sine';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0008, t + 7);
    o.connect(g); o2.connect(g); g.connect(bus); g.connect(verb); o.start(t); o2.start(t); o.stop(t + 7.2); o2.stop(t + 7.2);
  }
  function chirp(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), base = rnd(2600, 4200), n = 2 + (Math.random() * 4 | 0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.value = 0; o.type = 'sine';
    for (let i = 0; i < n; i++) {
      const s = t + i * rnd(0.09, 0.16); o.frequency.setValueAtTime(base * rnd(0.85, 1.1), s); o.frequency.exponentialRampToValueAtTime(base * rnd(1.25, 1.6), s + 0.06);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.022, s + 0.012); g.gain.linearRampToValueAtTime(0, s + 0.075);
    }
    if (pan) { pan.pan.value = rnd(-0.9, 0.9); o.connect(g); g.connect(pan); pan.connect(bus); pan.connect(verb); } else { o.connect(g); g.connect(bus); }
    o.start(t); o.stop(t + n * 0.17 + 0.1);
  }
  function splash(t, k) {
    const b = ctx.createBufferSource(); b.buffer = noiseBuf('pink', 0.5);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.35); f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * k, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    b.connect(f); f.connect(g); g.connect(bus); g.connect(verb); b.start(t); b.stop(t + 0.5);
  }

  let phrase = 0, step = 0;
  function schedule() {
    const tick = () => {
      if (!ctx || closing) return;
      const t = ctx.currentTime + 0.05;
      if (on) {
        /* melodi pelan; makin dekat selesai, makin rapat dan cerah */
        const base = 196, n = SLENDRO[(phrase * 3 + step * 2 + (Math.random() < 0.3 ? 1 : 0)) % SLENDRO.length];
        bell(base * Math.pow(2, n / 1200), t, 0.05 + progress * 0.03, 3.2);
        if (step % 4 === 2) bell(base * 2 * Math.pow(2, SLENDRO[(step + phrase) % 5] / 1200), t + 0.42, 0.025, 2.2);
        if (step % 16 === 0) gong(t, 0.12);
        step++; if (step % 16 === 0) phrase++;
        if (Math.random() < 0.35) chirp(t + rnd(0, 0.8));
      }
      timers.push(setTimeout(tick, (1150 - progress * 350) * (0.92 + Math.random() * 0.16)));
      if (timers.length > 8) timers.shift();
    };
    tick();
  }

  function ensure() {
    if (closing) return false;                                  // sudah ditutup: jangan pernah hidup lagi di aplikasi
    if (!ctx) {
      try {
        ctx = new AC();
        ctx.onstatechange = () => {
          if (ctx && ctx.state === 'running' && on && !closing) {
            fadeTo(0.8, 1.2);
          }
        };
      } catch (e) { return false; }
    }
    if (!built) build();
    return true;
  }
  function fadeTo(v, sec) { if (!master || !ctx) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }

  const api = {
    /* coba mulai otomatis; berhasil jika browser mengizinkan (mis. setelah klik di landing page) */
    autostart() {
      if (pref() === 'off') return Promise.resolve(false);
      if (!ensure()) return Promise.resolve(false);
      on = true;
      fadeTo(0.8, 2.5);
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => { });
      }
      return ctx.resume().catch(() => { }).then(() => { if (!closing && ctx.state === 'running') { fadeTo(0.8, 2.5); return true; } return false; });
    },
    resume() {
      if (pref() === 'off') return;
      if (!ensure()) return;
      on = true;
      fadeTo(0.8, 1.2);
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => { });
      }
    },
    set(v) {
      if (v) { if (!ensure()) return false; on = true; ctx.resume().catch(() => { }); fadeTo(0.8, 1.2); save('on'); }
      else { on = false; fadeTo(0, 0.5); save('off'); }
      return on;
    },
    get on() { return on && pref() !== 'off'; },
    progress(p) { progress = p; },
    speed(k) { if (L.river && ctx) L.river.g.gain.setTargetAtTime(0.42 + k * 0.25, ctx.currentTime, 0.4); },
    stroke(k) { if (on && ctx && k > 0.08) splash(ctx.currentTime + 0.02, Math.min(1, k)); },
    plip() { if (on && ctx) { const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1700, t + 0.05); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(bus); g.connect(verb); o.start(t); o.stop(t + 0.15); } },
    ready() { if (on && ctx) { const t = ctx.currentTime; [0, 480, 960].forEach((c, i) => bell(392 * Math.pow(2, c / 1200), t + i * 0.12, 0.05, 4)); } },
    portal() {
      if (!on || !ctx) return;
      const t = ctx.currentTime, b = ctx.createBufferSource(); b.buffer = noiseBuf('pink', 3);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(5200, t + 2.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 1.5); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      b.connect(f); f.connect(g); g.connect(bus); g.connect(verb); b.start(t); b.stop(t + 3);
      [0, 240, 720, 960, 1440].forEach((c, i) => bell(523 * Math.pow(2, c / 1200), t + 0.3 + i * 0.09, 0.04, 3.5));
      gong(t + 0.2, 0.16);
    },
    /* memudar lalu menutup konteks audio; setelah ini tidak ada yang bisa menyalakannya lagi */
    close(sec) {
      if (closing) return; closing = true; on = false; timers.forEach(clearTimeout); timers = [];
      if (!ctx) return;
      fadeTo(0, sec || 1.6);
      setTimeout(() => { api.kill(); }, (sec || 1.6) * 1000 + 120);
    },
    /* berhenti seketika (dipanggil saat loader dihancurkan dan saat halaman ditinggalkan) */
    kill() {
      closing = true; on = false; timers.forEach(clearTimeout); timers = [];
      if (!ctx) return; const c = ctx; ctx = null;
      try { if (master) master.disconnect(); } catch (e) { }
      try { c.onstatechange = null; if (c.state !== 'closed') c.close(); } catch (e) { }
    },
    get prefOff() { return pref() === 'off'; }
  };
  addEventListener('pagehide', () => api.kill());
  return api;
}
