'use strict';
// The creek. A small boat with a lantern drifts down a dark creek at night. You never steer.
// What the lantern passes shows dimly; what you touch wakes, blooms and joins the tune.
// Tap the boat to hold still or drift on. R starts over, M mutes. #demo or #demo=900 jumps ahead, all awake.
const cv = document.getElementById('c'), A = G.S.A, clamp = G.clamp, rnd = Math.random;
G.init(cv, { rows: 124, cols: 170, portraitRows: 140, origin: [0.36, 0.74] });
const K = n => G.col(n), COL = {
  star: K('#dfe8ff'), water: K('#6f8fb0'), waterHi: K('#cfe2ff'), wood: K('#b9a58a'), cloak: K('#aab6e8'), amber: K('#ffc45e'), warm: K('#ff8a2a'),
  stem: K('#9fd6b4'), leafLo: K('#2f6b4f'), leaf: K('#5fae7c'), leafHi: K('#b9e6a0'), bark: K('#9a8770'), stone: K('#8b93a0'), ground: K('#7d8f88'),
  far: K('#3a4d5c'), fly: K('#d9ff8a'), blush: K('#ffb3d4'), white: K('#ffffff'), bird: K('#dfe6f5'), moon: K('#e6ebff'), moonLo: K('#6f7896'),
  sand: K('#cdbfa6'), fireW: K('#fff3c9'), fireY: K('#ffc24a'), fireO: K('#ff7a1f'), fireR: K('#c9341a'), rope: K('#7a705f'), paper: K('#ffd9a0'), reedTop: K('#a8794e')
};
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
let seed = 7; const sr = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const SPEED = 4.6, END = 1935, BANK = 2;
const SECTIONS = [[0, 'the reeds'], [420, 'lily water'], [860, 'under the willows'], [1300, 'the lantern line'], [1470, 'moon meadow'], [1890, 'home']];
let items = [], stars = [], ripples = [], embers = [], cam = 0, moving = false, started = false, T = 0, last = 0, section = -1, caption = null, ML = 0, lampU = 7, lampV = 9, homeLit = false, ended = false;

// ───────── world
function add(type, wx, o) { const it = Object.assign({ type, wx, v: BANK, lit: 0, awake: false, flash: 0, t0: 0, par: 1, z: -100, reg: 4, idx: items.length }, o); items.push(it); return it; }
function roundTree(sc) {
  const pts = [], BL = [[0, 26, 7], [-7, 22, 6], [7, 23, 6], [-11, 18, 4.5], [11, 19, 4.5], [0, 19, 6], [-4, 30, 5], [5, 31, 5]];
  for (let y = 0; y <= 17; y++) { const w = 1 + 1.6 * Math.exp(-y / 1.5); for (let i = Math.ceil(-w / A); i <= w / A; i++) pts.push({ x: i * A, y, ch: '|!l1'[(sr() * 4) | 0], ci: COL.bark, b: 0.45 + 0.4 * sr(), sw: 0 }); }
  for (let y = 12; y <= 38; y++) for (let i = -30; i <= 30; i++) {
    const u = i * A, nz = (vnoise(u * 0.5 + 3, y * 0.5) - 0.5) * 0.5; let best = 9, bb = null;
    for (const b of BL) { const d = Math.hypot(u - b[0], y - b[1]) / b[2] + nz; if (d < best) { best = d; bb = b; } }
    if (best > 1 || sr() > 0.92 - 0.35 * best || vnoise(u * 0.3 + 7, y * 0.3) < 0.26) continue;
    const lt = clamp(0.5 + ((u - bb[0]) * 0.45 + (y - bb[1])) / bb[2] * 0.55, 0, 1);
    pts.push({ x: u, y, ch: best > 0.8 ? '*+:'[(sr() * 3) | 0] : '&%#@$8'[(sr() * 6) | 0], ci: lt > 0.72 ? COL.leafHi : lt > 0.4 ? COL.leaf : COL.leafLo, b: 0.4 + 0.6 * lt, sw: 0.25 + (y - 12) / 30, ph: sr() * 6 });
  }
  pts.forEach(p => { p.x *= sc; p.y *= sc; }); return pts;
}
function willow() {
  const pts = [], lean = (sr() - 0.5) * 8, H = 20 + sr() * 6;
  for (let y = 0; y <= H; y++) { const x = lean * (y / H) * (y / H), w = 1.5 - y / H; for (let i = Math.ceil(-w / A); i <= w / A; i++) pts.push({ x: x + i * A, y, ch: '|!l'[(sr() * 3) | 0], ci: COL.bark, b: 0.4 + 0.4 * sr(), sw: 0 }); }
  for (let b = 0; b < 7; b++) {
    const ang = -1.35 + b * 0.45 + (sr() - 0.5) * 0.2, len = 12 + sr() * 8;
    for (let k = 0; k <= 1; k += 0.07) {
      const x = lean + Math.sin(ang) * len * k, y = H + Math.cos(ang) * len * k * 0.7 - k * k * 4;
      pts.push({ x, y, ch: ang < 0 ? '\\' : '/', ci: COL.bark, b: 0.5, sw: 0.1 });
      if (k > 0.2 && sr() < 0.85) { const L = 9 + sr() * 16; for (let d = 1; d < L; d++) pts.push({ x, y: y - d, ch: "|:'!|"[(sr() * 5) | 0], ci: d / L < 0.35 ? COL.leafHi : d / L < 0.7 ? COL.leaf : COL.leafLo, b: 0.75 - 0.4 * d / L, sw: 0.2 + 1.6 * d / L, ph: b + k * 5 }); }
    }
  }
  return pts;
}
function build() {
  items = []; seed = (Math.random() * 1e9) | 0; const pick = a => a[(sr() * a.length) | 0];
  const flora = (wx, sp, sc, near) => add('flora', wx, { near, v: near ? -30 : BANK - 1, z: near ? 100 : -100 + sr() * 20, par: near ? 1.35 : 1, p: Flora.make(sp, { scale: sc, yaw: (sr() - 0.5) * 0.8, turn: 0.25, id: items.length }), reg: Flora.SPECIES[sp].reg });
  const reed = wx => { const n = 4 + ((sr() * 6) | 0), st = []; for (let i = 0; i < n; i++) st.push({ dx: (i - n / 2) * 1.1 + sr(), h: 5 + sr() * 10, lean: (sr() - 0.5) * 4, top: sr() < 0.45 }); add('reed', wx, { v: 0, st, z: -60, reg: 2 + ((sr() * 5) | 0) }); };
  for (let x = 40; x < 1880; x += 16 + sr() * 26) if (sr() < (x < 420 ? 0.85 : x < 860 ? 0.4 : 0.3)) reed(x);
  for (let x = 30; x < 1900; x += 9 + sr() * 16) add('tuft', x, { n: 2 + ((sr() * 4) | 0), z: -90 });
  for (let x = 90; x < 1900; x += 45 + sr() * 50) if (sr() < 0.5) add('stone', x, { v: 0, w: 3 + ((sr() * 4) | 0), z: -70 });
  // the reeds
  for (let x = 95; x < 420; x += 52 + sr() * 30) flora(x, pick(['bell', 'daisy', 'bell']), 0.5 + sr() * 0.2);
  add('tree', 170, { pts: roundTree(0.8), z: -140, reg: -3 }); add('tree', 345, { pts: roundTree(0.95), z: -140, reg: -3 });
  add('frog', 128, { v: 1 }); add('frog', 292, { v: 1 }); add('flies', 392, { n: 9, v: 9 });
  // lily water
  for (let x = 440; x < 860; x += 20 + sr() * 26) add('pad', x, { v: -3 - sr() * 15, z: 20, reg: 6 + ((sr() * 6) | 0) });
  for (let x = 470; x < 850; x += 62 + sr() * 30) flora(x, pick(['anemone', 'lily', 'anemone', 'daisy']), 0.48 + sr() * 0.2);
  add('heron', 610, { v: 0, z: -50 }); add('tree', 725, { pts: roundTree(1), z: -140, reg: -3 }); add('frog', 540, { v: 1 }); flora(690, 'lily', 0.62, true);
  // under the willows
  for (let x = 880; x < 1290; x += 78 + sr() * 40) add('tree', x, { pts: willow(), z: -140, reg: -3, will: true });
  add('owl', 1012, { v: 21, z: -130 }); add('flies', 950, { n: 10, v: 10 }); add('flies', 1180, { n: 12, v: 8 });
  for (let x = 905; x < 1290; x += 70 + sr() * 40) flora(x, pick(['iris', 'bell', 'iris']), 0.5 + sr() * 0.15);
  flora(1075, 'peony', 0.66, true); flora(1250, 'iris', 0.6, true);
  // the lantern line
  add('line', 1385, { n: 7, span: 110, z: -80 }); flora(1330, 'anemone', 0.55); flora(1445, 'peony', 0.55);
  // moon meadow
  add('moon', 0, { sky: true, v: 56, z: -9e5, reg: 12 });
  for (let x = 1490; x < 1880; x += 46 + sr() * 26) flora(x, pick(['peony', 'lily', 'anemone', 'iris', 'peony']), 0.58 + sr() * 0.22);
  add('deer', 1690, { v: BANK, z: -110 }); add('flies', 1600, { n: 14, v: 9 }); add('tree', 1800, { pts: roundTree(1.1), z: -140, reg: -3 }); flora(1640, 'lily', 0.7, true); flora(1840, 'peony', 0.7, true);
  // home
  add('camp', 1978, { z: -100, reg: 0 });
  stars = []; for (let i = 0; i < 70; i++) stars.push({ u: sr() * 400 - 120, v: 14 + sr() * 62, ph: sr() * 6, sp: 0.5 + sr() * 1.6, fl: 0, ch: '+*..'[(sr() * 4) | 0], midi: M.pent(10 + ((sr() * 9) | 0)) });
  cam = 0; moving = false; started = false; section = -1; ML = 0; homeLit = false; ended = false; ripples = []; embers = []; G.waves.length = 0;
}
build();
{ const m = location.hash.match(/^#demo(?:=(\d+))?/); if (m) { cam = +(m[1] || 520); started = moving = true; items.forEach(it => { it.awake = true; it.lit = 1; if (it.p) it.p.g = it.p.tg = 1; }); } }

// ───────── drawing helpers
const uOf = it => it.sky ? G.S.halfU * 0.7 : (it.wx - cam) * it.par;
const lampFall = u => Math.pow(clamp(1 - Math.abs(u - lampU) / 50, 0, 1), 1.5);
function P(it, u, v, z, ci, ch, al) { // a glyph that belongs to an item: dim until lit, flashes when touched, warmed by the lantern
  const a = al * it.lit; if (a < 0.015) return; G.plot(u, v, z, ci, ch, Math.min(1, a + it.flash * 0.4), it.flash * 0.7, (it.idx + 1) << 8, a * it.lf * 0.55);
}
function sprite(it, rows, u, v, z, ci, al) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') P(it, u + i * A, v - j, z, ci, r[i], al); }); }
const DRAW = {
  flora(it, u) {
    const p = it.p; p.x = u; p.y = it.near ? -(G.S.ROWS - G.S.oy) - 2 : it.v; p.z = it.z; G.lit[it.idx + 1] = 0.3 + 0.7 * it.lit;
    if (!it.awake && it.lf > 0.05) p.tg = Math.max(p.tg, 0.3 + 0.17 * it.lf);
    Flora.draw(p, T); if (p.g < 0.03) P(it, u, it.v + 1, it.z, COL.star, '.', 0.5);
  },
  reed(it, u) { const w = Flora.wind(u, T) * 0.9 + it.flash * Math.sin(T * 14) * 1.2; for (const s of it.st) { for (let y = 0; y <= s.h; y++) { const k = y / s.h, x = s.dx + (s.lean + w) * k * k, sl = (s.lean + w) * k; P(it, u + x, y, it.z, COL.stem, Math.abs(sl) < 1.2 ? '|' : sl > 0 ? '/' : '\\', 0.5 + 0.3 * k); } if (s.top) { const x = s.dx + s.lean + w; P(it, u + x, s.h + 1, it.z, COL.reedTop, 'I', 0.9); P(it, u + x, s.h + 2, it.z, COL.reedTop, 'I', 0.9); } } },
  tuft(it, u) { const w = Flora.wind(u, T) * 0.4; for (let i = 0; i < it.n; i++) P(it, u + i * A + w * (i & 1), BANK + (i & 1), it.z, COL.leaf, "|/\\'"[(i + it.idx) & 3], 0.45); },
  stone(it, u) { for (let i = 0; i < it.w; i++) { P(it, u + i * A, 1, it.z, COL.stone, i === 0 ? '(' : i === it.w - 1 ? ')' : 'O', 0.6); if (i > 0 && i < it.w - 1) P(it, u + i * A, 2, it.z, COL.stone, '_', 0.5); } },
  tree(it, u) {
    const w = Flora.wind(u, T); for (const p of it.pts) { let x = p.x, y = p.y; if (p.sw) { x += w * p.sw * (it.will ? 1.3 : 0.7) + Math.sin(T * 1.1 + p.ph) * 0.3 * p.sw; } P(it, u + x, BANK + y, it.z, p.ci, p.ch, p.b); }
  },
  frog(it, u) {
    if (it.gone) return; let v = it.v + 1, x = u;
    if (it.awake) { const k = (T - it.t0) / 0.7; if (k >= 1) { it.gone = true; ripple(it.wx + 7, -2, 1); M.sing('drip', M.pent(-3), 0.9, pan(u)); return; } x += 7 * k; v += Math.sin(k * Math.PI) * 6 - 3 * k; }
    sprite(it, ['oo', '()'], x, v + 1, it.z + 5, COL.leafHi, 0.9);
  },
  flies(it, u) {
    if (it.awake) { const k = clamp((T - it.t0) / 4, 0, 1); it.fu = u + (lampU + 6 - u) * k * (T - it.t0 < 50 ? 1 : Math.max(0, 1 - (T - it.t0 - 50) / 6)); } else it.fu = u;
    for (let i = 0; i < it.n; i++) { const a = i * 2.4 + it.idx, x = it.fu + Math.sin(T * (0.3 + i * 0.05) + a) * (8 + i) + Math.sin(T * 0.9 + a * 2) * 2, y = it.v + Math.sin(T * (0.4 + i * 0.04) + a * 1.7) * 5 + (i % 3) * 2; G.plot(x, y, 50, COL.fly, '.', Math.max(0, Math.sin(T * 1.1 + a * 3)) * (it.awake ? 1 : 0.22 + 0.3 * it.lf), it.flash, (it.idx + 1) << 8); }
  },
  pad(it, u) {
    sprite(it, ['(___)'], u, it.v, it.z, COL.leaf, 0.6);
    const k = it.awake ? clamp((T - it.t0) / 1.2, 0, 1) : 0;
    if (k < 0.3) P(it, u + 2 * A, it.v + 1, it.z, COL.blush, '.', 0.8); else if (k < 0.7) sprite(it, ['\\o/'], u + A, it.v + 1, it.z, COL.blush, 0.9); else { sprite(it, [" ' ", '\\@/'], u + A, it.v + 2, it.z, COL.blush, 1); P(it, u + 2 * A, it.v + 1, it.z + 1, COL.amber, '@', 1); }
  },
  heron(it, u) {
    if (it.awake) { const k = T - it.t0, x = u - k * 10, y = 8 + k * 7; if (y > 80) return; sprite(it, Math.sin(T * 9) > 0 ? ['\\_ _/', '  v  '] : [' _ _ ', '/ v \\'], x, y, 60, COL.bird, 1); return; }
    sprite(it, [' _ ', '<o\\', '  \\ ', '  |\\', '  |/', '  | ', '  | '], u, 7, it.z, COL.bird, 0.8);
  },
  owl(it, u) { const blink = Math.sin(T * 0.7 + it.idx) > 0.96; sprite(it, [blink ? '(--)' : '(oo)', ' vv '], u, it.v, it.z + 30, it.awake ? COL.amber : COL.bird, it.awake ? 1 : 0.7); },
  deer(it, u) { sprite(it, it.awake ? [' \\/     ', ' (o     ', '  \\____ ', '  |/  |\\', '  ||  ||'] : ['        ', '   ____ ', ' \\/   |\\', ' (o/  ||', '  |   ||'], u, BANK + 5, it.z, COL.sand, 0.85); },
  line(it, u) {
    const hs = it.span / 2; for (let y = 0; y <= 15; y++) { P(it, u - hs, BANK + y, it.z, COL.rope, '|', 0.6); P(it, u + hs, BANK + y, it.z, COL.rope, '|', 0.6); }
    for (let x = -hs; x <= hs; x += A) { const k = x / hs; P(it, u + x, BANK + 15 - 5 * (1 - k * k), it.z, COL.rope, k < -0.3 ? '\\' : k > 0.3 ? '/' : '_', 0.45); }
    for (let i = 0; i < it.n; i++) {
      const k = (i + 0.5) / it.n * 2 - 1, x = u + k * hs, y = BANK + 15 - 5 * (1 - k * k) - 2 + Math.sin(T * 1.3 + i) * 0.3, on = it.on && it.on[i], own = ((it.idx + 1) << 8) | (i + 1);
      G.plot(x, y + 1, it.z + 1, COL.rope, "'", 0.6 * it.lit, 0, own);
      if (on) { const f = 0.8 + 0.2 * vnoise(T * 5 + i, 1); G.plot(x, y, it.z + 2, COL.amber, '@', f, 0.3, own); G.plot(x - A, y, it.z + 2, COL.paper, '(', f * 0.8, 0, own); G.plot(x + A, y, it.z + 2, COL.paper, ')', f * 0.8, 0, own); G.plot(x, y - 1, it.z + 2, COL.warm, ':', f * 0.5, 0, own); }
      else { G.plot(x, y, it.z + 2, COL.paper, 'O', 0.25 + 0.5 * it.lit, it.flash, own); }
    }
  },
  moon(it, u) {
    const vis = clamp((cam - 1440) / 60, 0, 1); if (vis <= 0) return; it.lit = vis * (it.awake ? 1 : 0.35); ML += ((it.awake ? 1 : 0) - ML) * 0.02;
    for (let v = -7; v <= 7; v++) for (let i = -12; i <= 12; i++) { const x = i * A, d = Math.hypot(x, v) / 7; if (d > 1) continue; if (Math.hypot(x + 3.2, v - 1.5) / 7 < 0.98) { if (h2(i, v) < 0.25) P(it, u + x, it.v + v, it.z, COL.moonLo, '.', 0.5); } else P(it, u + x, it.v + v, it.z, COL.moon, '0O@#8'[(h2(i, v) * 5) | 0], 0.6 + 0.4 * vnoise(x * 0.6, v * 0.6)); }
  },
  camp(it, u) {
    for (let x = -34; x <= -16; x += A) P(it, u + x, 1, -40, COL.wood, '=', 0.7); for (const x of [-34, -25, -16]) for (let y = -2; y <= 2; y++) P(it, u + x, y, -39, COL.wood, '|', 0.7);
    const B = 11, H = 14; for (let v = 0; v <= H; v++) for (let i = -20; i <= 20; i++) { const x = i * A, hw = B * (1 - v / H), ax = Math.abs(x); if (ax > hw + 0.2) continue; const edge = ax > hw - 0.8, door = v < 8 && ax < 3 * (1 - v / 8); if (edge) P(it, u + 14 + x, BANK + v, it.z, COL.sand, x < 0 ? '/' : '\\', 0.9); else if (door) { if (homeLit && h2(i, v) < 0.5) P(it, u + 14 + x, BANK + v, it.z, COL.amber, v < 3 && ax < 1 ? '@' : ':', 0.9); } else if (h2(i * 3, v * 7) < 0.4) P(it, u + 14 + x, BANK + v, it.z, COL.sand, x < 0 ? '/' : '.', 0.35); }
    for (let i = -4; i <= 4; i++) P(it, u - 4 + i * A * 1.6, BANK, it.z + 5, COL.stone, 'o', 0.6);
    P(it, u - 6, BANK + 1, it.z + 5, COL.wood, '/', 0.7); P(it, u - 2, BANK + 1, it.z + 5, COL.wood, '\\', 0.7); P(it, u - 4, BANK + 1, it.z + 5, COL.wood, '=', 0.7);
    if (!homeLit) return; const fs = clamp((T - it.t0) / 3, 0, 1), own = (it.idx + 1) << 8;
    for (let v = 1; v <= 12 * fs + 2; v++) for (let i = -9; i <= 9; i++) {
      const x = i * A, yy = v / (12 * fs + 1), wd = 4.6 * Math.pow(Math.max(0, 1 - yy), 0.7), nx = x + (vnoise(v * 0.3 - T * 2.2, 3.3) - 0.5) * 2.6 * yy, e = 1 - Math.abs(nx) / wd; if (!(e > 0)) continue;
      const I = e * (1.15 - yy) * (0.5 + 0.95 * vnoise(x * 0.55 + 9, v * 0.38 - T * 3.1)); if (I < 0.17) continue;
      G.plot(u - 4 + x, BANK + v, it.z + 6, I > 0.8 ? COL.fireW : I > 0.55 ? COL.fireY : I > 0.34 ? COL.fireO : COL.fireR, '.:^*x#%@'[Math.min(7, (I * 8.5) | 0)], Math.min(1, I * 1.5), 0, own);
    }
    if (rnd() < fs * 0.25) embers.push({ wx: it.wx - 4 + (rnd() - 0.5) * 4, v: BANK + 4 + rnd() * 5, vx: (rnd() - 0.5) * 2, vy: 4 + rnd() * 6, age: 0, life: 1.5 + rnd() * 2, sd: rnd() * 9 });
  }
};
const pan = u => clamp(u / 90, -0.8, 0.8);
function ripple(wx, v, a) { ripples.push({ wx, v, t0: T, a: a || 1 }); }

// ───────── music: whatever is awake and in view plays
const VOICE = { peony: 'flower', anemone: 'star', lily: 'glass', iris: 'tent', bell: 'flower', daisy: 'reed' };
let band = [];
M.onStep((step, bar, s, ch, t) => {
  const hum = () => t + rnd() * 0.012; let fl = 0, tree = false;
  for (const it of band) {
    const u = it.su, pn = pan(u);
    if (it.type === 'flora' && fl < 5) { fl++; const sp = it.p.sp, d = sp.pat[(s + it.idx * 3) % 16]; if (d >= 0 && rnd() < 0.5) { M.play(VOICE[it.p.species], hum(), M.pent(sp.reg + d + M.SH[ch]), 0.3 + 0.2 * rnd(), pn); M.vis(t, () => { G.wave(it.su, it.v + sp.H * it.p.scale, { sp: 20, w: 2.5, a: 0.5, life: 0.9, obj: it.idx }); Flora.kick(it.p, (rnd() - 0.5) * 0.4, T); }); } }
    else if (it.type === 'tree' && !tree) { tree = true; if (s === 0) { M.play('sub', t, M.ROOT[ch], 0.85); M.vis(t, () => { it.flash = 0.6; }); } else if ((s === 6 || s === 11 || s === 14) && rnd() < 0.4) M.play('oak', hum(), M.CHT[ch][(rnd() * 4) | 0], 0.4, pn); }
    else if (it.type === 'reed') { if ((s + it.idx) % 8 === 3 && rnd() < 0.35) { M.play('reed', hum(), M.pent(it.reg + 5 + ((rnd() * 3) | 0) + M.SH[ch]), 0.3, pn); M.vis(t, () => { it.flash = 0.5; }); } }
    else if (it.type === 'pad') { if ((s + it.idx * 5) % 16 === 9 && rnd() < 0.45) { M.play('drip', hum(), M.pent(it.reg + M.SH[ch]), 0.35, pn); M.vis(t, () => ripple(it.wx, it.v, 0.5)); } }
    else if (it.type === 'line') { if (s === 0 || (s === 10 && bar % 2 === 0)) { const on = it.on ? it.on.filter(Boolean).length : 0; for (let i = 0; i < Math.min(3, on); i++) M.play('tent', hum() + i * 0.03, M.CHT[ch][(i + bar) % 4] + 12, 0.24, pn + (i - 1) * 0.3); } }
    else if (it.type === 'owl') { if (s === 8 && bar % 4 === 1) { M.play('glass', t, M.CHT[ch][1] - 12, 0.5, pn); M.play('glass', t + M.STEP * 3, M.CHT[ch][0] - 12, 0.4, pn); } }
    else if (it.type === 'flies') { if (rnd() < 0.12) M.play('star', hum(), M.pent(13 + ((rnd() * 7) | 0)), 0.22, pn + (rnd() - 0.5)); }
    else if (it.type === 'moon') { if (s === 0 && bar % 4 === 0) M.play('moon', t, M.CHT[ch][3] + 12, 0.6, 0.5); }
    else if (it.type === 'camp' && homeLit) { if (s === 0 || s === 8) M.kick(t, 0.18); }
  }
  if (band.length >= 6 && (s === 0 || s === 8)) M.kick(t, 0.13);
  if (band.length >= 6 && s % 4 === 2) M.burst(t, 0.012, 0.2, 7000, 0.03, 0.1);
  if (started && s === 4 && bar % 2 === 1 && rnd() < 0.6) M.play('drip', hum(), M.pent(5 + ((rnd() * 6) | 0) + M.SH[ch]), 0.2, (rnd() - 0.5) * 1.4);
});
M.onTick(now => { if (homeLit) for (let i = 0; i < 3; i++) if (rnd() < 0.3) M.burst(now + rnd() * 0.06, 0.08 * rnd() * rnd(), 0.4 + (rnd() - 0.5) * 0.2, 900 + rnd() * 5200, 0.008 + rnd() * 0.035, 0.12); });

// ───────── touch
function wake(it, u, v, node) {
  const first = !it.awake; it.flash = 1; let midi = M.pent(it.reg + ((v / 9) | 0)), voice = 'oak';
  switch (it.type) {
    case 'flora': { const p = it.p; it.awake = true; p.tg = 1; voice = VOICE[p.species]; midi = M.pent(p.sp.reg + (node * 3) % 7); G.wave(u, v, { obj: it.idx, life: 2.2 }); Flora.kick(p, u > p.x ? -1 : 1, T); if (first) { M.swell(M.now, pan(u)); caption = { a: '· · · ·', t0: T, it }; } break; }
    case 'reed': it.awake = true; voice = 'reed'; for (let i = 1; i < 4; i++) M.play('reed', M.quant(M.now + i * M.STEP), M.fit(M.pent(it.reg + 5 + i * 2), M.chAt(M.now + i * M.STEP)), 0.5 - i * 0.1, pan(u)); break;
    case 'tree': it.awake = true; voice = 'oak'; midi = M.pent(-3 + ((v / 8) | 0)); if (first) M.play('sub', M.quant(M.now), M.ROOT[M.chAt(M.now)], 0.9); break;
    case 'frog': if (first) { it.awake = true; it.t0 = T; } return;
    case 'flies': it.awake = true; it.t0 = T; voice = 'star'; midi = M.pent(14); for (let i = 1; i < 5; i++) M.play('star', M.quant(M.now + i * M.STEP / 2 * 3), M.pent(13 + i * 2), 0.4, pan(u) + (i & 1 ? 0.4 : -0.4)); break;
    case 'pad': if (first) it.t0 = T; it.awake = true; voice = 'drip'; midi = M.pent(it.reg); ripple(it.wx, it.v, 0.8); break;
    case 'heron': if (first) { it.awake = true; it.t0 = T; M.swell(M.now, pan(u), 0.06, 500, 1800, 2.6); M.sing('moon', M.pent(9), 0.9, pan(u)); ripple(it.wx, -1, 1); } return;
    case 'owl': it.awake = true; M.sing('glass', M.CHT[M.chAt(M.now)][1] - 12, 0.9, pan(u)); M.play('glass', M.quant(M.now + M.STEP * 3), M.CHT[M.chAt(M.now)][0] - 12, 0.7, pan(u)); return;
    case 'deer': it.awake = true; voice = 'tent'; midi = M.pent(6); M.play('tent', M.quant(M.now + M.STEP * 2), M.pent(8), 0.6, pan(u)); break;
    case 'line': { const i = node - 1; if (i < 0) return; it.on = it.on || []; it.awake = true; if (!it.on[i]) { it.on[i] = true; M.sing('tent', M.pent(5 + i), 0.9, pan(u)); M.echo('tent', M.pent(5 + i), pan(u)); } else M.sing('tent', M.pent(5 + i), 0.6, pan(u)); return; }
    case 'moon': it.awake = true; voice = 'moon'; midi = M.pent(12); break;
    case 'camp': if (!homeLit) { homeLit = true; it.awake = true; it.t0 = T; M.sing('fire', M.pent(-4), 1, 0.3); M.CHT[M.chAt(M.now + 1)].forEach((n, i) => M.play('tent', M.quant(M.now + 0.6 + i * M.STEP * 2), n + 12, 0.6, 0.3)); caption = { a: 'home', b: 'tap the water to drift again', t0: T, hold: true }; } else M.sing('fire', M.pent(-4), 0.8, 0.3); return;
    default: it.awake = true;
  }
  M.sing(voice, midi, 0.9, pan(u)); M.echo(voice === 'sub' ? 'oak' : voice, midi, pan(u));
}
function tap(e) {
  M.init(); const { u, v } = G.toUV(e);
  if (!started) { started = moving = true; M.sing('drip', M.pent(4), 0.8, 0); ripple(cam - 6, -1, 1); return; }
  if (Math.abs(u - 2) < 9 && v > -2 && v < 12) { if (!ended) { moving = !moving; M.sing('oak', M.pent(moving ? 2 : 0), 0.7, 0); ripple(cam - 6, -1, 0.8); } return; }
  const own = G.pick(u, v);
  if (own) { const it = items[(own >> 8) - 1]; if (it) return wake(it, u, v, own & 255); }
  if (v < 0) { if (ended && homeLit) { build(); started = moving = true; return; } ripple(cam + u, v, 1); M.sing('drip', M.pent(3 + ((u + 80) / 22 | 0)), 0.8, pan(u)); return; }
  for (const s of stars) if (Math.hypot(s.su - u, s.v - v) < 3) { s.fl = 1; M.sing('star', s.midi, 0.9, pan(u)); return; }
  const s = { u: u + cam * 0.03, v: Math.round(v), ph: rnd() * 6, sp: 1, fl: 1, ch: '+', midi: M.pent(10 + ((v / 9) | 0)), su: u }; stars.push(s); M.sing('star', s.midi, 0.9, pan(u));
}
let down = false;
cv.addEventListener('pointerdown', e => { e.preventDefault(); M.init(); down = true; });
cv.addEventListener('pointerup', e => { if (down) tap(e); down = false; });
addEventListener('keydown', e => { if (e.key === 'm') M.mute(); if (e.key === 'R' || e.key === 'r') build(); });

function box(ctx, a, b, al) { // words sit in a thin white frame, bottom left
  const S = G.S, fs = Math.round(Math.max(S.cellH * 1.25, 11 * S.DPR)), pad = fs * 0.9, w = Math.max(ctx.measureText(a).width, b ? ctx.measureText(b).width : 0) + pad * 2, h = (b ? fs * 2.9 : fs * 1.5) + pad, x = fs * 1.6, y = S.H - h - fs * 1.6;
  ctx.fillStyle = `rgba(0,0,0,${0.6 * al})`; ctx.fillRect(x, y, w, h); ctx.strokeStyle = `rgba(255,255,255,${0.55 * al})`; ctx.lineWidth = Math.max(1, S.DPR * 0.75); ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.textAlign = 'left'; ctx.fillStyle = `rgba(255,255,255,${0.85 * al})`; ctx.fillText(a, x + pad, y + pad * 0.5 + fs * 0.75); if (b) { ctx.fillStyle = `rgba(255,255,255,${0.5 * al})`; ctx.fillText(b, x + pad, y + pad * 0.5 + fs * 2.15); }
}
// ───────── frame
function frame(ms) {
  const now = ms / 1000, dt = Math.min(0.05, now - last || 0.016); last = now; T = now; M.flush();
  const S = G.S, L0 = -S.ox * A, R0 = (S.COLS - S.ox) * A, prev = cam;
  if (moving) { const left = END - cam; cam += SPEED * dt * clamp(left / 40, 0, 1); if (left < 0.5 && !ended) { ended = true; moving = false; } }
  const bob = Math.sin(T * 1.1) * 0.35; lampV = 9 + bob;
  G.begin(T); G.tickWaves(prev - cam); G.lit = G.lit || []; G.warm = { u: lampU, v: lampV, r: 58, k: 0.42 + 0.08 * vnoise(T * 5, 2) };
  // sky
  for (const s of stars) { s.su = s.u - cam * 0.03; if (s.su < L0 || s.su > R0) continue; s.fl = Math.max(0, s.fl - dt * 0.9); G.plot(s.su, s.v, -1e6, COL.star, s.ch, Math.min(1, 0.3 + 0.28 * Math.sin(T * s.sp + s.ph) + s.fl), s.fl); }
  // far trees, a breath of outline
  for (let c = 0; c < S.COLS; c += 1) { const u = (c - S.ox) * A, wx = cam * 0.22 + u, h = 10 + vnoise(wx * 0.045, 1) * 12 + vnoise(wx * 0.3, 5) * 3; if (h2(c + Math.floor(cam * 0.22 / A), 3) < 0.4) G.plot(u, BANK + h, -2e5, COL.far, ".:'^"[(h2(c, 9) * 4) | 0], 0.3 + 0.25 * ML); }
  // bank line
  for (let c = 0; c < S.COLS; c++) { const u = (c - S.ox) * A, wc = Math.round((cam + u) / A), hv = h2(wc, 4.2); if (hv > 0.45) continue; const lf = lampFall(u); G.plot(u, 1, -150, COL.ground, hv < 0.2 ? '_' : hv < 0.33 ? '.' : ',', 0.1 + 0.4 * lf + 0.12 * ML, 0, 0, lf * 0.3); }
  // things
  band = [];
  for (const it of items) {
    const u = uOf(it); if (u < L0 - 60 || u > R0 + 60) continue; it.su = u;
    it.lf = lampFall(u); it.flash = Math.max(0, it.flash - dt * 1.4);
    if (it.type !== 'moon') it.lit += ((it.awake ? 1 : Math.max(it.lf * 0.5, ML * 0.22)) - it.lit) * (1 - Math.exp(-dt * 2.2));
    if (it.p) { const p = it.p; p.g += (p.tg - p.g) * (1 - Math.exp(-dt * 0.9)); }
    DRAW[it.type](it, u);
    if (it.awake && u > L0 - 5 && u < R0 + 5 && !it.gone && it.type !== 'frog' && it.type !== 'heron' && it.type !== 'tuft' && it.type !== 'stone') band.push(it);
  }
  band.sort((a, b) => Math.abs(a.su) - Math.abs(b.su));
  // boat
  const bz = 0, bv = bob;
  [['', 0], ['\\___________/', 0], [' \\_________/', -1]].forEach(([r, dv]) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') G.plot(-4 + i * A, 1 + dv + bv, bz, COL.wood, r[i], 0.85, 0, 0, 0.35); });
  [['  o', 5], [' /|\\', 4], [' /_\\', 3], ['  l', 2]].forEach(([r, v]) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') G.plot(-2 + i * A, v + bv, bz + 1, COL.cloak, r[i], 0.8, 0, 0, 0.3); });
  for (let v = 2; v <= 8; v++) G.plot(lampU, v + bv, bz + 1, COL.wood, '|', 0.6, 0, 0, 0.3);
  const lk = 0.85 + 0.15 * vnoise(T * 6, 4); G.plot(lampU, lampV, bz + 2, COL.amber, '@', lk, 0.4); G.plot(lampU - A, lampV, bz + 2, COL.warm, '(', lk * 0.7); G.plot(lampU + A, lampV, bz + 2, COL.warm, ')', lk * 0.7); G.plot(lampU, lampV + 1, bz + 2, COL.warm, "'", lk * 0.6);
  if (moving) for (let i = 1; i < 9; i++) if (h2(i, Math.floor(T * 4)) < 0.6) G.plot(-5 - i * 1.4, -0.2, -1, COL.waterHi, '~', 0.35 * (1 - i / 9));
  for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.age += dt; if (e.age > e.life) { embers.splice(i, 1); continue; } e.wx += (e.vx + Math.sin(T * 2.6 + e.sd) * 1.5) * dt; e.v += e.vy * dt; const k = e.age / e.life; G.plot(e.wx - cam, e.v, 10, k < 0.3 ? COL.fireY : k < 0.65 ? COL.fireO : COL.fireR, k < 0.3 ? '*' : k < 0.6 ? "'" : '.', 1 - k); }
  G.shade(); G.reflect(0, Math.min(26, S.ROWS - S.oy - 1), 0.42);
  // water: the surface line, glints, moon road, lantern road, rings
  const depth = S.ROWS - S.oy;
  for (let c = 0; c < S.COLS; c++) {
    const u = (c - S.ox) * A, wx = cam + u, n = vnoise(wx * 0.16 + T * 0.25, 1.3);
    if (n > 0.42) G.plot(u, 0, -6e5, COL.water, n > 0.7 ? '~' : '-', 0.16 + 0.3 * lampFall(u) + 0.12 * ML);
    for (let d = 1; d < depth; d++) {
      const g = vnoise(wx * 0.07 + d * 0.31, d * 0.6 - T * 0.22); if (g < 0.74) continue;
      const lr = Math.max(0, 1 - Math.abs(u - lampU - Math.sin(d * 0.7 + T * 1.5) * 1.2) / (2 + d * 0.5)) * Math.max(0, 1 - d / 26), mr = ML * Math.max(0, 1 - Math.abs(u - S.halfU * 0.7 - Math.sin(d * 0.5 + T) * 1.5) / (3 + d * 0.4));
      G.plot(u, -d, -6e5, lr > 0.15 ? COL.amber : mr > 0.2 ? COL.moon : COL.water, d % 3 ? '-' : '~', 0.09 + 0.6 * lr + 0.5 * mr);
    }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], age = T - r.t0; if (age > 3.2) { ripples.splice(i, 1); continue; }
    for (let k = 0; k < 2; k++) { const rad = (age - k * 0.5) * 7; if (rad <= 0) continue; const n = Math.ceil(rad * 4); for (let j = 0; j < n; j++) { const a = j / n * 6.283; G.plot(r.wx - cam + Math.cos(a) * rad, r.v + Math.sin(a) * rad * 0.28, -4e5, COL.waterHi, Math.abs(Math.sin(a)) > 0.7 ? '-' : '~', r.a * 0.7 * (1 - age / 3.2)); } }
  }
  M.bed.water = started ? 1 : 0.4; M.bed.pad = clamp(0.3 + band.length * 0.09, 0, 1); M.bed.air = ML; M.bed.rumble = homeLit ? 0.6 : 0;
  const ctx = G.end();
  // words
  let sec = 0; SECTIONS.forEach((s, i) => { if (cam + 20 >= s[0]) sec = i; });
  if (started && sec !== section && !(caption && caption.hold)) { section = sec; caption = { a: SECTIONS[sec][1], t0: T }; }
  if (caption) {
    if (caption.it && caption.it.p.g > 0.97) { caption = { a: caption.it.p.name.toLowerCase(), t0: T }; }
    const k = T - caption.t0, al = k < 0.8 ? k / 0.8 : caption.hold || caption.it ? 1 : k > 5 ? 1 - (k - 5) / 2 : 1;
    if (al <= 0 || (caption.it && k > 9)) caption = null; else { box(ctx, caption.a, caption.b, al); }
  }
  if (!started && T > 1) { box(ctx, 'tap to push off', 'then touch what you pass', Math.min(1, (T - 1) / 2)); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
