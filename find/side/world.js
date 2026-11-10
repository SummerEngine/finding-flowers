'use strict';
// Finding Flowers · the forest itself: scenery you can touch (trees, reeds, creatures, lanterns, camp, moon),
// the ground, the creek and the sky. Flowers to find live in game.js.
const A = G.S.A, clamp = G.clamp, rnd = Math.random;
const K = n => G.col(n), COL = {
  star: K('#dfe8ff'), water: K('#6f8fb0'), waterHi: K('#cfe2ff'), wood: K('#b9a58a'), cloak: K('#aab6e8'), amber: K('#ffc45e'), warm: K('#ff8a2a'),
  stem: K('#9fd6b4'), leafLo: K('#2f6b4f'), leaf: K('#5fae7c'), leafHi: K('#b9e6a0'), bark: K('#9a8770'), stone: K('#8b93a0'), ground: K('#7d8f88'),
  far: K('#3a4d5c'), fly: K('#d9ff8a'), blush: K('#ffb3d4'), white: K('#ffffff'), bird: K('#dfe6f5'), moon: K('#e6ebff'), moonLo: K('#6f7896'),
  sand: K('#cdbfa6'), fireW: K('#fff3c9'), fireY: K('#ffc24a'), fireO: K('#ff7a1f'), fireR: K('#c9341a'), rope: K('#7a705f'), paper: K('#ffd9a0'), reedTop: K('#a8794e'), glass: K('#9fb4c8')
};
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
let seed = 11; const sr = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const WEST = -250, EAST = 1320, SHORE = -40; // world ends; west of SHORE the path runs beside the creek
const PLACES = [[WEST, 'the creek'], [SHORE, 'camp'], [60, 'the glade'], [420, 'under the willows'], [760, 'the lantern path'], [980, 'the hill']];
const placeAt = x => { let p = PLACES[0][1]; for (const q of PLACES) if (x >= q[0]) p = q[1]; return p; };
// shared view state, set by game.js every frame
const V = { pu: 0, pv: 0, met: {}, cam: 0, T: 0, lampU: 0, lampV: 4, lampK: 1, calm: 0, ML: 0, moonF: 0.1, moonAwake: false, night: 1, homeLit: false, cut: [] };
let items = [], ripples = [], embers = [];

function add(type, wx, o) { const it = Object.assign({ type, wx, v: 0, lit: 0, lf: 0, awake: false, flash: 0, t0: 0, z: -100, reg: 4, idx: items.length }, o); items.push(it); return it; }
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
function buildWorld() {
  items = []; ripples = []; embers = []; seed = 11;
  const reed = (wx, z) => { const n = 4 + ((sr() * 6) | 0), st = []; for (let i = 0; i < n; i++) st.push({ dx: (i - n / 2) * 1.1 + sr(), h: 5 + sr() * 10, lean: (sr() - 0.5) * 4, top: sr() < 0.45 }); add('reed', wx, { st, z: z || -60, reg: 2 + ((sr() * 5) | 0) }); };
  for (let x = WEST + 6; x < EAST; x += 8 + sr() * 15) add('tuft', x, { n: 2 + ((sr() * 4) | 0), z: -90 });
  for (let x = WEST + 20; x < EAST; x += 50 + sr() * 60) if (sr() < 0.55) add('stone', x, { w: 3 + ((sr() * 4) | 0), z: -70 });
  // the creek
  for (let x = WEST + 4; x < SHORE - 4; x += 12 + sr() * 16) if (sr() < 0.8) reed(x, sr() < 0.5 ? 30 : -60);
  for (let x = WEST + 10; x < SHORE - 6; x += 16 + sr() * 20) add('pad', x, { v: -4 - sr() * 12, z: 20, reg: 6 + ((sr() * 6) | 0) });
  add('frog', -92, {}); add('frog', -188, {}); add('heron', -158, { z: 40 }); add('boat', -52, { z: 35 });
  // camp
  add('camp', 0, { z: -100, reg: 0 });
  // the glade
  add('tree', 132, { pts: roundTree(0.9), z: -140, reg: -3 }); add('tree', 288, { pts: roundTree(1.05), z: -140, reg: -3 }); add('tree', 398, { pts: roundTree(0.85), z: -140, reg: -3 });
  add('flies', 262, { n: 10, v: 10 }); add('frog', 180, {});
  // under the willows
  for (const x of [452, 566, 690]) add('tree', x, { pts: willow(), z: -140, reg: -3, will: true });
  add('owl', 569, { v: 22, z: -110 }); add('flies', 606, { n: 12, v: 9 }); reed(480); reed(612); reed(730);
  // the lantern path
  add('line', 868, { n: 9, span: 150, z: -80 }); add('tree', 968, { pts: roundTree(1), z: -140, reg: -3 });
  for (const x of [800, 826, 934]) add('stone', x, { w: 5, z: -70, old: true });
  // small secrets
  for (const x of [206, 342, 498, 657, 1052, -22]) add('shroom', x, { n: 3 + ((sr() * 3) | 0), z: -65, reg: -1 + ((sr() * 4) | 0) });
  add('menhir', 846, { z: -120, reg: -6 });
  // the hill
  add('deer', 1092, { z: -110 }); add('flies', 1124, { n: 14, v: 9 }); add('tree', 1212, { pts: roundTree(1.15), z: -140, reg: -3 });
  add('moon', 0, { sky: true, v: 70, z: -9e5, reg: 12 });
}

// ───────── drawing
const lampFall = u => Math.pow(clamp(1 - Math.abs(u - V.lampU) / (62 + 24 * V.calm), 0, 1), 1.5) * V.lampK;
function P(it, u, v, z, ci, ch, al) { const a = al * it.lit; if (a < 0.015) return; G.plot(u, v, z, ci, ch, Math.min(1, a + it.flash * 0.4), it.flash * 0.7, (it.idx + 1) << 8, a * it.lf * 0.55); }
function sprite(it, rows, u, v, z, ci, al) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') P(it, u + i * A, v - j, z, ci, r[i], al); }); }
const pan = u => clamp(u / 90, -0.8, 0.8);
function ripple(wx, v, a) { ripples.push({ wx, v, t0: V.T, a: a || 1 }); }
const DRAW = {
  reed(it, u) { const T = V.T, w = Flora.wind(u, T) * 0.9 + it.flash * Math.sin(T * 14) * 1.2; for (const s of it.st) { for (let y = 0; y <= s.h; y++) { const k = y / s.h, x = s.dx + (s.lean + w) * k * k, sl = (s.lean + w) * k; P(it, u + x, y, it.z, COL.stem, Math.abs(sl) < 1.2 ? '|' : sl > 0 ? '/' : '\\', 0.5 + 0.3 * k); } if (s.top) { const x = s.dx + s.lean + w; P(it, u + x, s.h + 1, it.z, COL.reedTop, 'I', 0.9); P(it, u + x, s.h + 2, it.z, COL.reedTop, 'I', 0.9); } } },
  tuft(it, u) { const w = Flora.wind(u, V.T) * 0.4 + Math.max(0, 1 - Math.abs(u - V.pu) / 3.5) * V.pv * 0.12; for (let i = 0; i < it.n; i++) P(it, u + i * A + w * (i & 1), 1 + (i & 1), it.z, COL.leaf, "|/\\'"[(i + it.idx) & 3], 0.45); },
  stone(it, u) { for (let i = 0; i < it.w; i++) { P(it, u + i * A, 1, it.z, COL.stone, i === 0 ? '(' : i === it.w - 1 ? ')' : it.old ? '#' : 'O', 0.6); if (i > 0 && i < it.w - 1) P(it, u + i * A, 2, it.z, COL.stone, it.old ? '=' : '_', 0.5); } },
  tree(it, u) { const w = Flora.wind(u, V.T); for (const p of it.pts) { let x = p.x; if (p.sw) x += w * p.sw * (it.will ? 1.3 : 0.7) + Math.sin(V.T * 1.1 + p.ph) * 0.3 * p.sw; P(it, u + x, p.y, it.z, p.ci, p.ch, p.b); } },
  shroom(it, u) { // little caps; touched, they glow and breathe spores
    for (let i = 0; i < it.n; i++) { const x = u + (i - it.n / 2) * 1.9, h = 1 + (i * 7 + it.idx) % 3, ci = it.awake ? COL.waterHi : COL.sand; for (let y = 1; y <= h; y++) P(it, x, y, it.z, COL.sand, '|', 0.5); P(it, x - A, h + 1, it.z, ci, '(', 0.8); P(it, x, h + 1, it.z, ci, '_', 0.8); P(it, x + A, h + 1, it.z, ci, ')', 0.8);
      if (it.awake) { const k = (V.T * 0.25 + i * 0.37) % 1; G.plot(x + Math.sin(V.T + i * 2) * 1.5 * k, h + 2 + k * 9, it.z, COL.waterHi, '.', (1 - k) * 0.7); } }
  },
  menhir(it, u) { // an old standing stone with marks that light when it is touched
    for (let y = 0; y <= 13; y++) { const w = y > 11 ? 1 : 2; for (let i = -w; i <= w; i++) { const mark = it.awake && Math.abs(i) < 2 && y > 2 && y < 11 && h2(i + 9, y) < 0.4; P(it, u + i * A, y, it.z, mark ? COL.amber : COL.stone, mark ? '=:*'[(h2(i, y) * 3) | 0] : Math.abs(i) === w ? (i < 0 ? '(' : ')') : '#%'[(h2(i, y * 3) * 2) | 0], mark ? 0.7 + 0.3 * Math.sin(V.T * 1.3 + y) : 0.5); } }
  },
  frog(it, u) {
    if (it.gone) return; let v = 1, x = u;
    if (it.awake) { const k = (V.T - it.t0) / 0.7; if (k >= 1) { it.gone = true; if (it.wx < SHORE) { ripple(it.wx - 7, -3, 1); M.sing('drip', M.pent(-3), 0.9, pan(u)); } return; } x -= 7 * k; v += Math.sin(k * Math.PI) * 6 - (it.wx < SHORE ? 4 : 0) * k; }
    sprite(it, ['oo', '()'], x, v + 1, it.z + 5, COL.leafHi, 0.9);
  },
  flies(it, u) {
    const T = V.T; it.fu = it.awake ? u + (V.lampU - u) * clamp((T - it.t0) / 4, 0, 1) * (T - it.t0 < 40 ? 1 : Math.max(0, 1 - (T - it.t0 - 40) / 6)) : u;
    for (let i = 0; i < it.n; i++) { const a = i * 2.4 + it.idx, x = it.fu + Math.sin(T * (0.3 + i * 0.05) + a) * (8 + i) + Math.sin(T * 0.9 + a * 2) * 2, y = it.v + Math.sin(T * (0.4 + i * 0.04) + a * 1.7) * 5 + (i % 3) * 2; G.plot(x, y, 50, COL.fly, '.', Math.max(0, Math.sin(T * 1.1 + a * 3)) * (it.awake ? 1 : 0.2 + 0.3 * it.lf + 0.3 * V.calm), it.flash, (it.idx + 1) << 8); }
  },
  pad(it, u) {
    sprite(it, ['(___)'], u, it.v, it.z, COL.leaf, 0.6); const k = it.awake ? clamp((V.T - it.t0) / 1.2, 0, 1) : 0;
    if (k < 0.3) P(it, u + 2 * A, it.v + 1, it.z, COL.blush, '.', 0.8); else if (k < 0.7) sprite(it, ['\\o/'], u + A, it.v + 1, it.z, COL.blush, 0.9); else { sprite(it, [" ' ", '\\@/'], u + A, it.v + 2, it.z, COL.blush, 1); P(it, u + 2 * A, it.v + 1, it.z + 1, COL.amber, '@', 1); }
  },
  heron(it, u) {
    if (it.awake) { const k = V.T - it.t0, x = u - k * 10, y = 8 + k * 7; if (y > 110) return; sprite(it, Math.sin(V.T * 9) > 0 ? ['\\_ _/', '  v  '] : [' _ _ ', '/ v \\'], x, y, 60, COL.bird, 1); return; }
    sprite(it, [' _ ', '<o\\', '  \\ ', '  |\\', '  |/', '  | ', '  | '], u, 5, it.z, COL.bird, 0.8);
  },
  boat(it, u) { const b = Math.sin(V.T * 1.1) * 0.3; sprite(it, ['\\_________/', ' \\_______/'], u, -1 + b, it.z, COL.wood, 0.8); for (let v = -1; v <= 3; v++) P(it, u + 8, v, it.z - 1, COL.wood, '|', 0.6); },
  owl(it, u) { const blink = Math.sin(V.T * 0.7 + it.idx) > 0.96; sprite(it, [blink ? '(--)' : '(oo)', ' vv '], u, it.v, it.z, it.awake ? COL.amber : COL.bird, it.awake ? 1 : 0.7); },
  deer(it, u) { sprite(it, it.awake ? [' \\/     ', ' (o     ', '  \\____ ', '  |/  |\\', '  ||  ||'] : ['        ', '   ____ ', ' \\/   |\\', ' (o/  ||', '  |   ||'], u, 5, it.z, COL.sand, 0.85); },
  line(it, u) {
    const hs = it.span / 2, T = V.T; for (let y = 0; y <= 15; y++) { P(it, u - hs, y, it.z, COL.rope, '|', 0.6); P(it, u + hs, y, it.z, COL.rope, '|', 0.6); }
    for (let x = -hs; x <= hs; x += A) { const k = x / hs, y0 = Math.round(15 - 5 * (1 - k * k)), k1 = (x + A) / hs, y1 = Math.round(15 - 5 * (1 - k1 * k1)); P(it, u + x, y0, it.z, COL.rope, y1 < y0 ? '\\' : y1 > y0 ? '/' : '_', 0.45); }
    for (let i = 0; i < it.n; i++) {
      const k = (i + 0.5) / it.n * 2 - 1, x = u + k * hs, y = 13 - 5 * (1 - k * k) + Math.sin(T * 1.3 + i) * 0.3, on = it.on && it.on[i], own = ((it.idx + 1) << 8) | (i + 1), lf = lampFall(x);
      G.plot(x, y + 1, it.z + 1, COL.rope, "'", 0.6 * it.lit, 0, own);
      if (on) { const f = 0.8 + 0.2 * vnoise(T * 5 + i, 1); G.plot(x, y, it.z + 2, COL.amber, '@', f, 0.3, own); G.plot(x - A, y, it.z + 2, COL.paper, '(', f * 0.8, 0, own); G.plot(x + A, y, it.z + 2, COL.paper, ')', f * 0.8, 0, own); G.plot(x, y - 1, it.z + 2, COL.warm, ':', f * 0.5, 0, own); }
      else G.plot(x, y, it.z + 2, COL.paper, 'O', 0.14 + 0.6 * lf + 0.2 * V.ML, it.flash, own);
    }
  },
  moon(it, u) {
    const f = V.moonF, r = 8; it.lit = it.awake ? 1 : 0.55; V.ML += ((it.awake ? f : f * 0.45) - V.ML) * 0.03;
    for (let v = -r; v <= r; v++) for (let i = -14; i <= 14; i++) {
      const x = i * A, d = Math.hypot(x, v) / r; if (d > 1) continue;
      const lit = x > r * Math.cos(Math.PI * f) * Math.sqrt(Math.max(0, 1 - (v / r) * (v / r)));
      if (lit) P(it, u + x, it.v + v, it.z, COL.moon, '0O@#8'[(h2(i, v) * 5) | 0], 0.6 + 0.4 * vnoise(x * 0.6, v * 0.6)); else if (h2(i, v) < 0.22) P(it, u + x, it.v + v, it.z, COL.moonLo, '.', 0.5);
    }
  },
  camp(it, u) {
    const T = V.T, B = 11, H = 14, tx = u + 16;
    for (let v = 0; v <= H; v++) for (let i = -20; i <= 20; i++) { const x = i * A, hw = B * (1 - v / H), ax = Math.abs(x); if (ax > hw + 0.2) continue; const edge = ax > hw - 0.8, door = v < 8 && ax < 3 * (1 - v / 8); if (edge) P(it, tx + x, v, it.z, COL.sand, x < 0 ? '/' : '\\', 0.9); else if (door) { if (V.homeLit && h2(i, v) < 0.5) P(it, tx + x, v, it.z, COL.amber, v < 3 && ax < 1 ? '@' : ':', 0.9); } else if (h2(i * 3, v * 7) < 0.4) P(it, tx + x, v, it.z, COL.sand, x < 0 ? '/' : '.', 0.35); }
    for (let v = H; v <= H + 3; v++) P(it, tx, v, it.z, COL.sand, '|', 0.6); P(it, tx + 0.9, H + 3, it.z, COL.blush, '>', 0.9);
    // the jar of cut flowers
    sprite(it, ['\\___/'], u + 1, 1, it.z + 4, COL.glass, 0.8);
    V.cut.forEach((ci, i) => { const x = u + 1.6 + (i % 4) * A * 1.2, h = 3 + (i % 3); for (let v = 2; v < h; v++) P(it, x, v, it.z + 3, COL.stem, '|', 0.7); G.plot(x, h, it.z + 5, ci, i & 1 ? '*' : '@', 0.95 * Math.max(0.35, it.lit), 0, (it.idx + 1) << 8); });
    // the fire
    const fx = u - 14; for (let i = -4; i <= 4; i++) P(it, fx + i * A * 1.6, 0, it.z + 5, COL.stone, 'o', 0.6);
    P(it, fx - 2, 1, it.z + 5, COL.wood, '/', 0.7); P(it, fx + 2, 1, it.z + 5, COL.wood, '\\', 0.7); P(it, fx, 1, it.z + 5, COL.wood, '=', 0.7);
    if (!V.homeLit) return; const fs = clamp((T - it.t0) / 3, 0, 1), own = ((it.idx + 1) << 8) | 1;
    for (let v = 1; v <= 12 * fs + 2; v++) for (let i = -9; i <= 9; i++) {
      const x = i * A, yy = v / (12 * fs + 1), wd = 4.6 * Math.pow(Math.max(0, 1 - yy), 0.7), nx = x + (vnoise(v * 0.3 - T * 2.2, 3.3) - 0.5) * 2.6 * yy, e = 1 - Math.abs(nx) / wd; if (!(e > 0)) continue;
      const I = e * (1.15 - yy) * (0.5 + 0.95 * vnoise(x * 0.55 + 9, v * 0.38 - T * 3.1)); if (I < 0.17) continue;
      G.plot(fx + x, v, it.z + 6, I > 0.8 ? COL.fireW : I > 0.55 ? COL.fireY : I > 0.34 ? COL.fireO : COL.fireR, '.:^*x#%@'[Math.min(7, (I * 8.5) | 0)], Math.min(1, I * 1.5), 0, own);
    }
    if (rnd() < fs * 0.25) embers.push({ wx: it.wx - 14 + (rnd() - 0.5) * 4, v: 4 + rnd() * 5, vx: (rnd() - 0.5) * 2, vy: 4 + rnd() * 6, age: 0, life: 1.5 + rnd() * 2, sd: rnd() * 9 });
  }
};
// draw every scenery item in view; returns the ones that are awake (they play in the band)
function drawItems(dt, L0, R0) {
  const band = [];
  for (const it of items) {
    const u = it.sky ? G.S.halfU * 0.62 + (G.S.ox * A - G.S.halfU) * 0 : it.wx - V.cam; if (!it.sky && (u < L0 - 70 || u > R0 + 70)) continue;
    it.su = u; it.lf = lampFall(u); it.flash = Math.max(0, it.flash - dt * 1.4);
    if (it.type !== 'moon') it.lit += ((it.awake ? 1 : Math.max(it.lf * 0.6, V.ML * 0.3, it.type === 'camp' ? 0.32 : 0.13)) - it.lit) * (1 - Math.exp(-dt * 2.2));
    DRAW[it.type](it, u);
    if (it.awake && !it.gone && u > L0 - 5 && u < R0 + 5 && 'tree reed pad line owl flies moon camp shroom menhir'.includes(it.type)) band.push(it);
  }
  for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.age += dt; if (e.age > e.life) { embers.splice(i, 1); continue; } e.wx += (e.vx + Math.sin(V.T * 2.6 + e.sd) * 1.5) * dt; e.v += e.vy * dt; const k = e.age / e.life; G.plot(e.wx - V.cam, e.v, 10, k < 0.3 ? COL.fireY : k < 0.65 ? COL.fireO : COL.fireR, k < 0.3 ? '*' : k < 0.6 ? "'" : '.', 1 - k); }
  return band;
}
function drawSky(stars, dt, L0, R0) {
  const S = G.S, T = V.T;
  for (const s of stars) { s.su = s.wx - V.cam * 0.06; if (s.su < L0 || s.su > R0) continue; s.fl = Math.max(0, s.fl - dt * 0.9); G.plot(s.su, s.v, -1e6, COL.star, s.ch, Math.min(1, 0.3 + 0.28 * Math.sin(T * s.sp + s.ph) + s.fl), s.fl); if (s.fl > 0.05) { G.plot(s.su - A, s.v, -1e6, COL.white, '-', s.fl * 0.7); G.plot(s.su + A, s.v, -1e6, COL.white, '-', s.fl * 0.7); G.plot(s.su, s.v + 1, -1e6, COL.white, "'", s.fl * 0.7); } }
  for (let c = 0; c < S.COLS; c++) { const u = (c - S.ox) * A, wx = V.cam * 0.25 + u, h = 12 + vnoise(wx * 0.045, 1) * 13 + vnoise(wx * 0.3, 5) * 3; if (h2(c + Math.floor(V.cam * 0.25 / A), 3) < 0.4) G.plot(u, h, -2e5, COL.far, ".:'^"[(h2(c, 9) * 4) | 0], 0.26 + 0.3 * V.ML); }
}
// ground line, earth below it, and west of the shore: water with rings, glints and the moon's road
function drawGround(L0, R0) {
  const S = G.S, T = V.T, depth = S.ROWS - S.oy;
  for (let c = 0; c < S.COLS; c++) {
    const u = (c - S.ox) * A, wx = V.cam + u, wc = Math.round(wx / A), hv = h2(wc, 4.2), lf = lampFall(u);
    if (wx < WEST - 30 || wx > EAST + 30) continue;
    if (hv < 0.5) G.plot(u, 0, -150, COL.ground, hv < 0.2 ? '_' : hv < 0.36 ? '.' : ',', 0.1 + 0.42 * lf + 0.14 * V.ML, 0, 0, lf * 0.3);
    if (wx > SHORE) { for (let d = 1; d < Math.min(depth, 7); d++) if (h2(wc, d * 7.7) < 0.12 - d * 0.012) G.plot(u, -d, -150, COL.ground, d < 3 ? '.' : ',', (0.08 + 0.3 * lf + 0.08 * V.ML) * (1 - d / 8), 0, 0, lf * 0.25); continue; }
    const n = vnoise(wx * 0.16 + T * 0.25, 1.3); if (n > 0.42) G.plot(u, -1, -6e5, COL.water, n > 0.7 ? '~' : '-', 0.16 + 0.3 * lf + 0.14 * V.ML);
    for (let d = 2; d < depth; d++) {
      const g = vnoise(wx * 0.07 + d * 0.31, d * 0.6 - T * 0.22); if (g < 0.72) continue;
      const lr = Math.max(0, 1 - Math.abs(u - V.lampU - Math.sin(d * 0.7 + T * 1.5) * 1.2) / (2 + d * 0.5)) * Math.max(0, 1 - d / 22) * V.lampK, mu = S.halfU * 0.62, mr = V.ML * Math.max(0, 1 - Math.abs(u - mu - Math.sin(d * 0.5 + T) * 1.5) / (3 + d * 0.4));
      G.plot(u, -d, -6e5, lr > 0.15 ? COL.amber : mr > 0.2 ? COL.moon : COL.water, d % 3 ? '-' : '~', 0.09 + 0.6 * lr + 0.5 * mr);
    }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], age = T - r.t0; if (age > 3.2) { ripples.splice(i, 1); continue; }
    for (let k = 0; k < 2; k++) { const rad = (age - k * 0.5) * 7; if (rad <= 0) continue; const n = Math.ceil(rad * 4); for (let j = 0; j < n; j++) { const a = j / n * 6.283; G.plot(r.wx - V.cam + Math.cos(a) * rad, r.v + Math.sin(a) * rad * 0.28, -4e5, COL.waterHi, Math.abs(Math.sin(a)) > 0.7 ? '-' : '~', r.a * 0.7 * (1 - age / 3.2)); } }
  }
}
