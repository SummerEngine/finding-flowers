'use strict';
// Finding Flowers: fourteen flower voices, their two-bar motifs, and the small sounds of walking and noting.
// Built on M (lib/music.js). The fourteen motifs are one piece split into parts: low voices hold few long
// notes, middle voices carry the tune, high voices add sparse sparkle, and voices that share a register do not start on the same 16th.
//
//   VOICES[species] = { reg, motif: [{s, d, len?}], play(t, midi, vel, pan, len?) }
//     s = 16th step 0..31 over two bars, d = scale degree for M.pent(reg + d), len = held length in 16ths
//   playMotif(species, t0, vel, pan) → length in seconds (one pass, each note fitted to the sounding chord)
//   STEPS.walk(t, foot, pan)  .touch(t, pan)  .page(t)  .found(t, pan)  .star(t, midi, pan)
const VOICES = (() => {
  const fm = (t, m, o) => M.fm(t, m, o), clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const hi = m => clamp(1 - (m - 62) / 44, 0.5, 1);        // FM gets gentler as the pitch rises, so high notes never bite
  const top = (m, v) => m > 78 ? v * 0.75 : v;             // and a little quieter
  const hold = (len, lo, up) => len ? clamp(len / 6, lo || 0.6, up || 2) : 1; // a held note decays slower
  return {
    // lotus: a deep singing bowl under everything; a sine an octave down with a soft struck overtone.
    lotus: { reg: -5, motif: [{ s: 0, d: 0, len: 12 }, { s: 16, d: 3, len: 8 }, { s: 28, d: 2, len: 4 }],
      play(t, m, v, pan, len) { const q = hold(len, 0.7, 1.6); fm(t, m, { g: 0.17 * v, pan: 0, att: 0.05, dec: 3.4 * q, rv: 0.25 }); fm(t, m + 12, { g: 0.05 * v, pan, att: 0.03, dec: 2.4 * q, ratio: 1, idx: 1.2, idxDec: 0.2, rv: 0.45 }); } },
    // sunflower: a soft horn; bright for an instant at the start, then round and warm, with a slow shimmer from a detuned twin.
    sunflower: { reg: 0, motif: [{ s: 4, d: 0, len: 6 }, { s: 12, d: 2, len: 4 }, { s: 20, d: 3, len: 4 }, { s: 24, d: 2, len: 6 }],
      play(t, m, v, pan, len) { const q = hold(len); fm(t, m, { g: 0.15 * v, pan, att: 0.06, dec: 1.9 * q, ratio: 1, idx: 1.5, idxDec: 0.25, rv: 0.5, dv: 0.1 }); fm(t, m + 0.08, { g: 0.05 * v, pan: -pan, att: 0.08, dec: 1.7 * q, rv: 0.5 }); } },
    // peony: a closed-mouth hum, round and close, with a breath of lower octave.
    peony: { reg: 2, motif: [{ s: 2, d: 0, len: 8 }, { s: 10, d: 1, len: 6 }, { s: 18, d: 3, len: 10 }],
      play(t, m, v, pan, len) { const q = hold(len); fm(t, m, { g: 0.15 * v, pan, att: 0.04, dec: 2.4 * q, ratio: 1, idx: 0.8, idxDec: 0.5, rv: 0.5, dv: 0.12 }); fm(t, m - 12, { g: 0.05 * v, pan, att: 0.06, dec: 2 * q, rv: 0.3 }); } },
    // dahlia: a slow bowed string; it swells in, stays rich, and a detuned twin gives it a gentle vibrato.
    dahlia: { reg: 3, motif: [{ s: 6, d: 2, len: 3 }, { s: 9, d: 3, len: 5 }, { s: 14, d: 1, len: 6 }, { s: 21, d: 0, len: 8 }],
      play(t, m, v, pan, len) { const q = hold(len); fm(t, m, { g: 0.11 * v, pan, att: 0.12, dec: 1.6 * q, wave: 'triangle', ratio: 1, idx: 1.1, idxDec: 1, rv: 0.55, dv: 0.1 }); fm(t, m + 0.1, { g: 0.06 * v, pan: -pan, att: 0.15, dec: 1.5 * q, wave: 'triangle', rv: 0.55 }); } },
    // tulip: a hollow reed like a low clarinet (odd harmonics only), plain and steady.
    tulip: { reg: 5, motif: [{ s: 8, d: 0, len: 4 }, { s: 13, d: 2, len: 6 }, { s: 24, d: 1, len: 4 }, { s: 28, d: 3, len: 4 }],
      play(t, m, v, pan, len) { fm(t, m, { g: 0.15 * v, pan, att: 0.05, dec: 1.4 * hold(len), ratio: 2, idx: 0.9 * hi(m), idxDec: 1, rv: 0.5, dv: 0.12 }); } },
    // iris: a harp; a clear pluck that rolls upward, with a faint second string beside it.
    iris: { reg: 5, motif: [{ s: 0, d: 0 }, { s: 1, d: 2 }, { s: 2, d: 3 }, { s: 3, d: 5 }, { s: 16, d: 4 }],
      play(t, m, v, pan) { v = top(m, v); fm(t, m, { g: 0.17 * v, pan, dec: 1.6, ratio: 2, idx: 1.0 * hi(m), idxDec: 0.08, rv: 0.45, dv: 0.28 }); fm(t, m + 0.06, { g: 0.05 * v, pan: -pan, dec: 1.8, rv: 0.5 }); } },
    // poppy: a short dry pluck on the off-beats, a little nasal like a koto, gone almost at once.
    poppy: { reg: 6, motif: [{ s: 3, d: 0 }, { s: 11, d: 2 }, { s: 19, d: 0 }, { s: 27, d: 3 }],
      play(t, m, v, pan) { fm(t, m, { g: 0.18 * top(m, v), pan, dec: 0.55, ratio: 3, idx: 0.8 * hi(m), idxDec: 0.12, rv: 0.3, dv: 0.3 }); } },
    // lily: a breathy flute; a small puff of air, then a pure tone that carries the tune.
    lily: { reg: 7, motif: [{ s: 4, d: 1, len: 3 }, { s: 7, d: 3, len: 1 }, { s: 8, d: 5, len: 8 }, { s: 20, d: 4, len: 2 }, { s: 22, d: 2, len: 8 }],
      play(t, m, v, pan, len) { v = top(m, v); fm(t, m, { g: 0.16 * v, pan, att: 0.07, dec: 1.4 * hold(len), ratio: 1, idx: 0.35, idxDec: 1, rv: 0.6, dv: 0.15 }); M.burst(t, 0.025 * v, pan, M.mtof(m) * 2, 0.16, 0.5, 'bandpass'); } },
    // anemone: a small wooden mallet; quick double knocks, dry and woody.
    anemone: { reg: 8, motif: [{ s: 6, d: 0 }, { s: 7, d: 0 }, { s: 9, d: 2 }, { s: 22, d: 0 }, { s: 23, d: 0 }, { s: 25, d: 3 }],
      play(t, m, v, pan) { fm(t, m, { g: 0.19 * top(m, v), pan, dec: 0.9, ratio: 1, idx: 2 * hi(m), idxDec: 0.08, rv: 0.35, dv: 0.2 }); } },
    // foxglove: a music box walking down a stair of bells, each note small and exact.
    foxglove: { reg: 9, motif: [{ s: 12, d: 4 }, { s: 13, d: 3 }, { s: 14, d: 2 }, { s: 15, d: 1 }, { s: 30, d: 2 }],
      play(t, m, v, pan) { v = top(m, v); fm(t, m, { g: 0.14 * v, pan, dec: 1.5, ratio: 5, idx: 0.5 * hi(m), idxDec: 0.15, rv: 0.6, dv: 0.3 }); fm(t, m + 12, { g: 0.025 * v, pan, dec: 0.7, rv: 0.6 }); } },
    // bell: a small bronze bell; a soft clang that settles into a long clear ring.
    bell: { reg: 10, motif: [{ s: 10, d: 0 }, { s: 26, d: 2 }, { s: 29, d: 1 }],
      play(t, m, v, pan) { v = top(m, v); fm(t, m, { g: 0.14 * v, pan, dec: 2.6, ratio: 3.5, idx: 1.2 * hi(m), idxDec: 0.3, rv: 0.6, dv: 0.22 }); fm(t, m + 12, { g: 0.025 * v, pan, dec: 1, rv: 0.6 }); } },
    // daisy: a wet finger on a glass rim; thin, pure, long, slowly beating against its twin.
    daisy: { reg: 11, motif: [{ s: 5, d: 2 }, { s: 17, d: 3 }, { s: 21, d: 0 }],
      play(t, m, v, pan) { v = top(m, v); fm(t, m, { g: 0.12 * v, pan, dec: 3, ratio: 4.01, idx: 0.45 * hi(m), idxDec: 0.2, rv: 0.8, dv: 0.3 }); fm(t, m + 0.07, { g: 0.06 * v, pan: -pan, dec: 2.8, rv: 0.8 }); } },
    // snowdrop: one drop of water; a tiny upward blip with a long wet echo.
    snowdrop: { reg: 12, motif: [{ s: 15, d: 3 }, { s: 23, d: 0 }, { s: 31, d: 1 }],
      play(t, m, v, pan) { fm(t, m, { g: 0.15 * top(m, v), pan, dec: 0.45, glide: 0.5, glideT: 0.05, rv: 0.7, dv: 0.45 }); } },
    // moonflower: slow night air; it fades in over most of a second and hangs, two close tones drifting apart.
    moonflower: { reg: 7, motif: [{ s: 1, d: 3, len: 12 }, { s: 17, d: 2, len: 8 }, { s: 25, d: 0, len: 6 }],
      play(t, m, v, pan, len) { const q = hold(len, 0.8, 1.4); fm(t, m, { g: 0.09 * v, pan, att: 0.7, dec: 4.6 * q, ratio: 2, idx: 0.25, rv: 0.9, dv: 0.15 }); fm(t, m + 0.1, { g: 0.05 * v, pan: -pan, att: 0.9, dec: 4.2 * q, rv: 0.9 }); M.burst(t, 0.012 * v, pan, M.mtof(m) * 2, 1.2, 0.9, 'bandpass'); } }
  };
})();

// one pass of a flower's motif from audio time t0; every note is fitted to the chord sounding at its own time
function playMotif(species, t0, vel, pan) {
  const V = VOICES[species]; if (!V || !M.on) return 32 * M.STEP;
  for (const n of V.motif) { const t = t0 + n.s * M.STEP; V.play(t, M.fit(M.pent(V.reg + n.d), M.chAt(t)), vel == null ? 1 : vel, pan || 0, n.len); }
  return 32 * M.STEP;
}

// small sounds. t may be left out: the sound then lands on the next grid line (walk and touch land at once)
const STEPS = {
  // a footfall on soft ground: a low thud of filtered noise, the two feet slightly apart in pitch and place
  walk(t, foot, pan) { if (M.on) M.burst(t || M.now, 0.016 + 0.01 * Math.random(), pan || 0, (foot ? 360 : 290) + 50 * Math.random(), 0.055, 0.1, "lowpass"); }, // each step a little different, so the 8th-note walk never drones
  // a fingertip on a leaf: a faint high tick with a breath of air
  touch(t, pan) { if (!M.on) return; t = t || M.now; M.fm(t, 81, { g: 0.045, pan: pan || 0, dec: 0.25, rv: 0.5 }); M.burst(t, 0.012, pan || 0, 3000, 0.03, 0.3); },
  // a page turning: a short soft sweep of paper noise from low to high
  page(t) { if (!M.on) return; t = t || M.quant(M.now + 0.005); M.swell(t, 0, 0.03, 900, 3400, 0.36); M.burst(t + 0.3, 0.012, 0.2, 2400, 0.05, 0.2); },
  // a flower found: the four tones of the sounding chord, rising one 16th apart, an octave up
  found(t, pan) { if (!M.on) return; t = t || M.quant(M.now + 0.005); M.CHT[M.chAt(t)].forEach((n, i) => M.play('tent', t + i * M.STEP, n + 12, 0.45, pan || 0)); },
  // a new star: one clear ping
  star(t, midi, pan) { if (!M.on) return; t = t || M.quant(M.now + 0.005); M.play('star', t, M.fit(midi, M.chAt(t)), 0.8, pan || 0); }
};
