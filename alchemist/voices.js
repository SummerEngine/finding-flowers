'use strict';
// Voices for the alchemist game, built on M.fm. Every puzzle note is an exact pitch of D pentatonic
// (it is never bent to the chord), so a creature's hum and a flower's answer can be compared by ear.
//
//   V.tone(kind, t, midi, vel, pan, short)   a flower voice: bell glass flute harp hum wood
//   V.cry(kind, t, midi, vel, pan)           a creature voice: moth toad fox owl stag self
//   V.speak(fn, kind, motif, vel, pan, onNote, short) → seconds until the last note
//   V.P  the nine pitches;  V.hush  audio time until which the band layers stay silent
const V = (() => {
  const P = [62, 64, 66, 69, 71, 74, 76, 78, 81];
  let hush = 0;
  function tone(kind, t, m, v, pan, short) {
    const k = short ? 0.55 : 1, hi = G.clamp(1 - (m - 62) / 44, 0.55, 1); if (m > 76) v *= 0.82;
    switch (kind) {
      case 'bell': M.fm(t, m, { g: 0.17 * v, pan, dec: 3 * k, ratio: 3.5, idx: 1.4 * hi, idxDec: 0.3, rv: 0.6, dv: 0.25 }); M.fm(t, m + 12, { g: 0.03 * v, pan, dec: 1.2 * k, rv: 0.6 }); break;
      case 'glass': M.fm(t, m, { g: 0.14 * v, pan, dec: 3.6 * k, ratio: 4.01, idx: 0.5 * hi, idxDec: 0.2, rv: 0.8, dv: 0.3 }); M.fm(t, m + 0.07, { g: 0.07 * v, pan: -pan, dec: 3.2 * k, rv: 0.8 }); break;
      case 'flute': M.fm(t, m, { g: 0.19 * v, pan, att: 0.06, dec: 1.5 * k, ratio: 1, idx: 0.4, idxDec: 1, rv: 0.6, dv: 0.18 }); M.fm(t, m + 12, { g: 0.02 * v, pan, att: 0.09, dec: k, rv: 0.6 });
        M.burst(t, 0.03 * v, pan, M.mtof(m) * 2, 0.16, 0.5, 'bandpass'); break;
      case 'harp': M.fm(t, m, { g: 0.21 * v, pan, dec: 1.6 * k, ratio: 2, idx: 1.1 * hi, idxDec: 0.08, rv: 0.45, dv: 0.3 }); M.fm(t, m + 0.05, { g: 0.06 * v, pan: -pan, dec: 1.8 * k, rv: 0.5 }); break;
      case 'hum': M.fm(t, m, { g: 0.19 * v, pan, att: 0.035, dec: 2.6 * k, ratio: 1, idx: 0.8, idxDec: 0.5, rv: 0.5, dv: 0.15 }); M.fm(t, m - 12, { g: 0.08 * v, pan, att: 0.05, dec: 2.2 * k, rv: 0.3 }); break;
      case 'wood': M.fm(t, m, { g: 0.25 * v, pan, dec: 1.1 * k, ratio: 1, idx: 2.2 * hi, idxDec: 0.08, rv: 0.4, dv: 0.25 }); M.fm(t, m + 12, { g: 0.03 * v, pan, dec: 0.5, rv: 0.4 }); break;
    }
  }
  function cry(kind, t, m, v, pan) {
    switch (kind) {
      case 'moth': M.fm(t, m, { g: 0.15 * v, pan, att: 0.12, dec: 1.5, rv: 0.8, dv: 0.1 }); M.fm(t, m + 0.1, { g: 0.08 * v, pan: -pan, att: 0.15, dec: 1.3, rv: 0.8 });
        M.burst(t, 0.02 * v, pan, M.mtof(m) * 2, 0.5, 0.7, 'bandpass'); break;
      case 'toad': M.fm(t, m, { g: 0.2 * v, pan, att: 0.02, dec: 0.6, ratio: 0.5, idx: 1.3, idxDec: 0.4, glide: 0.92, glideT: 0.05, rv: 0.35 }); M.fm(t, m - 12, { g: 0.1 * v, pan, att: 0.02, dec: 0.5, rv: 0.2 }); break;
      case 'fox': M.fm(t, m, { g: 0.18 * v, pan, att: 0.05, dec: 0.95, ratio: 2, idx: 0.7, idxDec: 0.7, glide: 0.97, glideT: 0.06, rv: 0.5, dv: 0.1 }); break;
      case 'owl': M.fm(t, m, { g: 0.24 * v, pan, att: 0.05, dec: 0.5, glide: 0.94, glideT: 0.09, rv: 0.6 }); M.fm(t, m, { g: 0.04 * v, pan, att: 0.05, dec: 0.4, ratio: 1, idx: 0.6, rv: 0.6 }); break;
      case 'stag': M.fm(t, m, { g: 0.15 * v, pan, att: 0.22, dec: 2.8, ratio: 2, idx: 0.3, rv: 0.9, dv: 0.1 }); M.fm(t, m + 12.05, { g: 0.03 * v, pan, att: 0.4, dec: 2.2, rv: 0.9 }); break;
      case 'self': M.fm(t, m, { g: 0.12 * v, pan, att: 0.05, dec: 0.9, ratio: 1, idx: 0.3, rv: 0.55 }); break;
    }
  }
  function speak(fn, kind, motif, vel, pan, onNote, short) {
    if (!M.on) { motif.forEach(n => setTimeout(() => onNote && onNote(n), n.d * M.STEP * 1000)); return motif[motif.length - 1].d * M.STEP; }
    const t0 = M.quant(M.now + 0.01); let end = t0;
    motif.forEach(n => { const t = t0 + n.d * M.STEP; fn(kind, t, n.m, vel, pan, short); if (onNote) M.vis(t, () => onNote(n)); if (t > end) end = t; });
    hush = Math.max(hush, end + 1.3);
    return end - M.now;
  }
  return { P, tone, cry, speak, get hush() { return hush; } };
})();
