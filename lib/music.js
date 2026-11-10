'use strict';
// Shared music: one clock, one slow chord loop, a lush reverb and delay. Everything the player
// touches is put on the next grid line and fitted to the chord that is sounding, then the band answers it.
//
//   M.init()                         call inside a pointer event (starts audio once)
//   M.sing(type, midi, vel, pan)     a player note → returns its start time
//   M.play(type, t, midi, vel, pan)  a scheduled note. types: flower oak tuft tent fire moon star sub glass drip reed
//   M.onStep(fn(step,bar,s,ch,t))    band layers, called for each 16th ahead of time
//   M.onTick(fn(now))                every ~60 ms (set bed levels, crackle)
//   M.vis(t, fn) + M.flush()         run fn when audio time t is reached (call flush each frame)
//   M.echo(type, midi, pan)          let the band answer a note in the next bars
//   M.pent(i) scale note, M.fit(m,ch), M.chAt(t), M.quant(t), M.CHT, M.ROOT, M.STEP, M.NOTE(m)
//   M.bed = {pad, air, rumble, water} target levels 0..1 (set them from your game)
const M = (() => {
  const rnd = Math.random, clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const BPM = 63, STEP = 60 / BPM / 4, PENT = [0, 2, 4, 7, 9];
  const ROOT = [38, 35, 31, 33], SH = [0, -1, 1, -2], CHT = [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 59]];
  const A = { ac: null, voices: 0, pend: [], echo: [], steps: [], ticks: [], step: 0, next: 0, t0: 0, muted: false };
  const bed = { pad: 0.1, air: 0, rumble: 0, water: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const pent = (i, base) => { const oc = Math.floor(i / 5), d = ((i % 5) + 5) % 5; return (base || 50) + 12 * oc + PENT[d]; };
  const NOTE = m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);
  const quant = t => A.t0 + Math.ceil((t - A.t0) / (STEP / 2)) * (STEP / 2);
  const chAt = t => Math.floor(Math.floor(Math.max(0, Math.floor((t - A.t0) / STEP)) / 16) / 2) % 4;
  function fit(m, ch) {
    const pcs = CHT[ch].map(x => x % 12); let best = m, bd = 9;
    for (let d = -3; d <= 3; d++) if (pcs.includes(((m + d) % 12 + 12) % 12) && Math.abs(d) < bd) { bd = Math.abs(d); best = m + d; }
    return best;
  }
  function makeIR(ac, len) {
    const sr = ac.sampleRate, n = Math.floor(sr * len), buf = ac.createBuffer(2, n, sr), pre = Math.floor(sr * 0.018);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = pre; i < n; i++) { const t = (i - pre) / (n - pre), a = 0.55 - 0.47 * Math.sqrt(t); lp += ((rnd() * 2 - 1) - lp) * a; d[i] = lp * Math.pow(1 - t, 3.4) * (i - pre < 400 ? (i - pre) / 400 : 1) * 1.6; }
    }
    return buf;
  }
  function noiseBuf(ac, sec, brown) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let l = 0;
    for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; }
    return b;
  }
  function init() {
    if (A.ac) { if (A.ac.state !== 'running') A.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = A.ac = new AC(), now = ac.currentTime;
    const master = A.master = ac.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(0.85, now + 2.5);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.012; comp.release.value = 0.35;
    master.connect(comp); comp.connect(ac.destination);
    A.dry = ac.createGain(); A.dry.connect(master);
    const rev = ac.createConvolver(); rev.buffer = makeIR(ac, 6.5);
    A.revIn = ac.createGain(); const revOut = ac.createGain(); revOut.gain.value = 0.9; A.revIn.connect(rev); rev.connect(revOut); revOut.connect(master);
    const dl = ac.createDelay(2), dr = ac.createDelay(2), fb = ac.createGain(), lp = ac.createBiquadFilter(), pl = ac.createStereoPanner(), pr = ac.createStereoPanner(), dOut = ac.createGain();
    A.dIn = ac.createGain(); dl.delayTime.value = dr.delayTime.value = STEP * 3; fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2200;
    pl.pan.value = -0.65; pr.pan.value = 0.65; dOut.gain.value = 0.8;
    A.dIn.connect(dl); dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(lp); lp.connect(fb); fb.connect(dl);
    pl.connect(dOut); pr.connect(dOut); dOut.connect(master); const d2r = ac.createGain(); d2r.gain.value = 0.35; dOut.connect(d2r); d2r.connect(A.revIn);
    A.noise = noiseBuf(ac, 2, false);
    const pf = A.padF = ac.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 520; pf.Q.value = 0.6;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 190; lfo.connect(lg); lg.connect(pf.frequency); lfo.start();
    A.pad = ac.createGain(); A.pad.gain.value = 0.0001; pf.connect(A.pad); A.pad.connect(A.dry);
    const pr2 = ac.createGain(); pr2.gain.value = 0.8; A.pad.connect(pr2); pr2.connect(A.revIn);
    A.padOsc = [];
    CHT[0].forEach(m => [-7, 7].forEach(dt => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.detune.value = dt; o.frequency.value = mtof(m); g.gain.value = 0.11; o.connect(g); g.connect(pf); o.start(); A.padOsc.push(o); }));
    A.air = ac.createGain(); A.air.gain.value = 0.0001; A.air.connect(A.revIn); A.airOsc = [];
    [12, 19].forEach((iv, i) => { const o = ac.createOscillator(); o.frequency.value = mtof(CHT[0][3] + iv); o.detune.value = i ? 5 : -5; o.connect(A.air); o.start(); A.airOsc.push([o, iv]); });
    const loop = (buf, type, f, q) => { const s = ac.createBufferSource(), bq = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = buf; s.loop = true; bq.type = type; bq.frequency.value = f; bq.Q.value = q; g.gain.value = 0.0001; s.connect(bq); bq.connect(g); g.connect(A.dry); s.start(); return { g, bq }; };
    const wnd = loop(noiseBuf(ac, 4, true), 'bandpass', 420, 0.5); wnd.g.gain.setTargetAtTime(0.05, now, 3); wnd.g.connect(A.revIn);
    const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = 0.05; wg.gain.value = 200; wl.connect(wg); wg.connect(wnd.bq.frequency); wl.start();
    A.rumble = loop(noiseBuf(ac, 4, true), 'lowpass', 240, 0.4).g;
    const wat = loop(noiseBuf(ac, 5, false), 'bandpass', 1500, 0.7); A.water = wat.g; wat.g.connect(A.revIn);
    const w2 = ac.createOscillator(), w2g = ac.createGain(); w2.frequency.value = 0.13; w2g.gain.value = 500; w2.connect(w2g); w2g.connect(wat.bq.frequency); w2.start();
    A.t0 = A.next = now + 0.15; A.step = 0;
    setInterval(tick, 60);
  }
  function out(node, pan, rv, dv) {
    const ac = A.ac, p = ac.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); node.connect(p); p.connect(A.dry);
    if (rv) { const g = ac.createGain(); g.gain.value = rv; p.connect(g); g.connect(A.revIn); }
    if (dv) { const g = ac.createGain(); g.gain.value = dv; p.connect(g); g.connect(A.dIn); }
    return p;
  }
  function fm(t, midi, o) {
    const ac = A.ac; if (!ac || A.voices > 56) return;
    const f = mtof(midi), c = ac.createOscillator(), a = ac.createGain(), att = o.att || 0.005;
    t = Math.max(t, ac.currentTime); c.frequency.value = f; if (o.wave) c.type = o.wave; let m = null;
    if (o.glide) { c.frequency.setValueAtTime(f * o.glide, t); c.frequency.exponentialRampToValueAtTime(f, t + (o.glideT || 0.08)); }
    if (o.idx) { m = ac.createOscillator(); const mg = ac.createGain(); m.frequency.value = f * o.ratio; mg.gain.setValueAtTime(f * o.idx, t); mg.gain.exponentialRampToValueAtTime(f * o.idx * 0.03 + 0.001, t + o.dec * (o.idxDec || 0.35)); m.connect(mg); mg.connect(c.frequency); }
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(o.g, t + att); a.gain.exponentialRampToValueAtTime(0.0001, t + att + o.dec);
    c.connect(a); const p = out(a, o.pan, o.rv, o.dv), e = t + att + o.dec + 0.05;
    c.start(t); c.stop(e); if (m) { m.start(t); m.stop(e); }
    A.voices++; c.onended = () => { A.voices--; p.disconnect(); };
  }
  function burst(t, g, pan, hp, dur, rv, type) {
    const ac = A.ac; if (!ac) return; t = Math.max(t, ac.currentTime);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain(); s.buffer = A.noise; f.type = type || 'highpass'; f.frequency.value = hp;
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(a); const p = out(a, pan, rv == null ? 0.2 : rv, 0); s.start(t, rnd() * 1.8, dur + 0.02); s.onended = () => p.disconnect();
  }
  function swell(t, pan, g, lo, hi, len) {
    const ac = A.ac; if (!ac) return; t = Math.max(t, ac.currentTime); len = len || 1.7;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain(); s.buffer = A.noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(lo || 300, t); f.frequency.exponentialRampToValueAtTime(hi || 2800, t + len * 0.9);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.045, t + len * 0.55); a.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(a); const p = out(a, pan, 0.9, 0.2); s.start(t); s.stop(t + len + 0.1); s.onended = () => p.disconnect();
  }
  function kick(t, g) {
    const ac = A.ac, o = ac.createOscillator(), a = ac.createGain();
    o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(41, t + 0.14);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(a); a.connect(A.dry); o.start(t); o.stop(t + 0.45);
  }
  function play(type, t, midi, vel, pan) {
    if (!A.ac) return; if (midi > 78) vel *= 0.75;
    switch (type) {
      case 'flower': fm(t, midi, { g: 0.2 * vel, pan, dec: 2.6, ratio: 3, idx: 1.3, rv: 0.55, dv: 0.3 }); fm(t, midi + 12, { g: 0.045 * vel, pan, dec: 1.5, rv: 0.6, dv: 0.2 }); break;
      case 'oak': case 'tuft': fm(t, midi, { g: 0.3 * vel, pan, dec: 1.5, ratio: 1, idx: 2.3, idxDec: 0.1, rv: 0.4, dv: 0.25 }); break;
      case 'reed': fm(t, midi, { g: 0.22 * vel, pan, dec: 0.9, ratio: 2, idx: 1.1, idxDec: 0.08, rv: 0.45, dv: 0.3 }); break;
      case 'tent': fm(t, midi, { g: 0.24 * vel, pan, dec: 3, ratio: 1, idx: 0.9, idxDec: 0.5, att: 0.008, rv: 0.5, dv: 0.2 }); break;
      case 'fire': fm(t, midi, { g: 0.3 * vel, pan, dec: 1.8, ratio: 0.5, idx: 1.6, idxDec: 0.15, rv: 0.35, dv: 0.1 });
        for (let i = 0; i < 7; i++) burst(t + rnd() * 0.35, 0.1 * rnd() * vel, pan + (rnd() - 0.5) * 0.3, 1200 + rnd() * 4500, 0.012 + rnd() * 0.04); break;
      case 'moon': fm(t, midi, { g: 0.12 * vel, pan, dec: 6, att: 0.6, ratio: 2, idx: 0.3, rv: 0.9, dv: 0.2 }); fm(t, midi + 7, { g: 0.05 * vel, pan, dec: 6, att: 0.9, rv: 0.9 }); break;
      case 'star': fm(t, midi, { g: 0.1 * vel, pan, dec: 3.6, ratio: 2, idx: 0.25, rv: 0.85, dv: 0.4 }); fm(t, midi + 12.08, { g: 0.03 * vel, pan, dec: 2.4, rv: 0.9 }); break;
      case 'glass': fm(t, midi, { g: 0.13 * vel, pan, dec: 4.5, ratio: 4.01, idx: 0.5, idxDec: 0.2, rv: 0.8, dv: 0.35 }); fm(t, midi + 0.07, { g: 0.07 * vel, pan: -pan, dec: 4, rv: 0.8 }); break;
      case 'drip': fm(t, midi, { g: 0.2 * vel, pan, dec: 0.5, glide: 0.5, glideT: 0.05, rv: 0.7, dv: 0.45 }); break;
      case 'sub': fm(t, midi, { g: 0.26 * vel, pan: 0, dec: 3.4, att: 0.04, rv: 0.1 }); fm(t, midi + 12, { g: 0.07 * vel, pan: 0, dec: 2.6, att: 0.03, ratio: 1, idx: 1.2, idxDec: 0.2, rv: 0.3 }); break;
    }
  }
  function sing(type, midi, vel, pan) { const ac = A.ac; if (!ac) return 0; const t = quant(ac.currentTime + 0.005); play(type, t, fit(midi, chAt(t)), vel, pan); return t; }
  function echo(type, midi, pan) { A.echo.push({ type, midi, pan, n: 2 }); if (A.echo.length > 3) A.echo.shift(); }
  function tick() {
    const ac = A.ac, now = ac.currentTime;
    if (A.next < now) { const k = Math.ceil((now + 0.05 - A.next) / STEP); A.next += k * STEP; A.step += k; }
    while (A.next < now + 0.25) {
      const step = A.step, t = A.next, bar = Math.floor(step / 16), s = step % 16, ch = Math.floor(bar / 2) % 4;
      if (s === 0 && bar % 2 === 0) { A.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(mtof(CHT[ch][i >> 1]), t, 0.5)); A.airOsc.forEach(([o, iv]) => o.frequency.setTargetAtTime(mtof(CHT[ch][3] + iv), t, 0.8)); }
      if ((s === 4 || s === 12) && A.echo.length) { const e = A.echo[0]; play(e.type, t + rnd() * 0.012, fit(e.midi + (s === 12 ? 12 : 0), ch), 0.26, -e.pan); if (--e.n <= 0) A.echo.shift(); }
      for (const fn of A.steps) fn(step, bar, s, ch, t);
      A.next += STEP; A.step++;
    }
    for (const fn of A.ticks) fn(now);
    A.pad.gain.setTargetAtTime(0.0001 + 0.075 * bed.pad, now, 1.5); A.air.gain.setTargetAtTime(0.0001 + bed.air * 0.016, now, 2);
    A.rumble.gain.setTargetAtTime(bed.rumble * 0.3, now, 0.8); A.water.gain.setTargetAtTime(bed.water * 0.02, now, 1.5);
  }
  function flush() { if (!A.ac) return; const t = A.ac.currentTime; A.pend = A.pend.filter(p => p[0] > t ? true : (p[1](), false)); }
  function mute() { if (!A.ac) return; A.muted = !A.muted; A.master.gain.setTargetAtTime(A.muted ? 0.0001 : 0.85, A.ac.currentTime, 0.2); }
  return { A, bed, BPM, STEP, CHT, ROOT, SH, init, play, sing, echo, fm, burst, swell, kick, pent, fit, chAt, quant, NOTE, mtof, mute, flush,
    get now() { return A.ac ? A.ac.currentTime : 0; }, get on() { return !!A.ac; },
    onStep: fn => A.steps.push(fn), onTick: fn => A.ticks.push(fn), vis: (t, fn) => A.pend.push([t, fn]) };
})();
