'use strict';
// Finding Flowers · the forest as a place you stand in. First person, real scale (1 unit is about 1.2 cm,
// your eye is 130 units up).
//
// The rule of the picture: black first. Nothing is drawn outside a pool of light, except stars, the moon,
// the lights of flowers, and what you have woken. Inside the light, solid things are real lit surfaces
// (trunks, the tent, stones, the old stone) and thin things are fine strokes drawn in true perspective
// (grass, reeds, ferns, willow strands). Flowers to find live in game.js.
const A = G.S.A, clamp = G.clamp, rnd = Math.random;
const K = n => G.col(n), COL = {
  star: K('#dfe8ff'), water: K('#6f8fb0'), waterHi: K('#cfe2ff'), wood: K('#b9a58a'), amber: K('#ffc45e'), warm: K('#ff8a2a'),
  stem: K('#9fd6b4'), leafLo: K('#2f6b4f'), leaf: K('#5fae7c'), leafHi: K('#b9e6a0'), bark: K('#9a8770'), stone: K('#8b93a0'), ground: K('#8a9a8e'),
  far: K('#6483a0'), fly: K('#d9ff8a'), blush: K('#ffb3d4'), white: K('#ffffff'), bird: K('#dfe6f5'), moon: K('#e6ebff'), moonLo: K('#6f7896'),
  sand: K('#cdbfa6'), fireW: K('#fff3c9'), fireY: K('#ffc24a'), fireO: K('#ff7a1f'), fireR: K('#c9341a'), rope: K('#8a7f6c'), paper: K('#ffd9a0'), reedTop: K('#a8794e'), glass: K('#9fb4c8')
};
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
let seed = 11; const sr = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ───────── the eye
const EYE = 130, NEAR = 14, CR0 = -2700, CR1 = -1900, HOME = { x: 300, z: -500, r: 3400 }, TID = 8000; // tree part ids start at TID
const CAM = { x: 0, y: EYE, z: 150, yaw: 0, sy: 0, cy: 1, f: 88, tilt: 0, ts: 0, tc: 1 };
// north is -z, east is +x. yaw 0 looks north; turning right is positive.
const PR = { u: 0, v: 0, z: 0, s: 0, nx: 0, ny: 0, nz: 0,
  // a true camera: it turns (yaw) and it pitches. CAM.tilt is the pitch in radians, positive looks down
  proj(X, Y, Z) { const dx = X - CAM.x, dz = Z - CAM.z, f0 = dx * CAM.sy - dz * CAM.cy, y0 = Y - CAM.y, fw = f0 * CAM.tc - y0 * CAM.ts; if (fw < NEAR) return false; const s = CAM.f / fw; this.u = (dx * CAM.cy + dz * CAM.sy) * s; this.v = (y0 * CAM.tc + f0 * CAM.ts) * s; this.z = -fw; this.s = s; return true; },
  rot(nx, ny, nz) { const fn = nx * CAM.sy - nz * CAM.cy; this.nx = nx * CAM.cy + nz * CAM.sy; this.ny = ny * CAM.tc + fn * CAM.ts; this.nz = -(fn * CAM.tc - ny * CAM.ts); } };
function camSet() { CAM.sy = Math.sin(CAM.yaw); CAM.cy = Math.cos(CAM.yaw); CAM.ts = Math.sin(CAM.tilt); CAM.tc = Math.cos(CAM.tilt); CAM.f = G.S.portrait ? G.S.halfU / 0.5 : G.S.halfU / 0.74; }
const distTo = (x, z) => Math.hypot(x - CAM.x, z - CAM.z);
const PLACES = [['the creek', (x, z) => x < -1450], ['under the willows', (x, z) => z < -1500 && x < -500], ['the hill', (x, z) => x > 2050], ['the lantern path', (x, z) => x > 420 && z > -350], ['camp', (x, z) => Math.hypot(x, z) < 640], ['the glade', () => true]];
const placeAt = (x, z) => PLACES.find(p => p[1](x, z))[0];
// shared state, set by game.js
const V = { T: 0, lampK: 1, calm: 0, ML: 0, moonF: 0.1, moonAwake: false, night: 1, homeLit: false, fireK: 0, cut: [] };
let items = [], ripples = [], embers = [], solids = [], MAT = null;

// ───────── light: there is no lamp. waves of light run outward over the ground from your steps and from
// whatever you touch, and fade behind their front; the fire, once lit, holds a pool of its own
const firePool = (x, z) => { const k = clamp(1 - Math.hypot(x, z) / 560, 0, 1); return k * k * 0.8 * V.fireK * (0.9 + 0.1 * Math.sin(V.T * 7 + x * 0.02)); };
let pulses = [], lights = [], lightsN = []; // lights: every open flower holds a pool of light around itself
function pulse(x, z, a, sp, max) { pulses.push({ x, z, t0: V.T, a: a || 0.6, sp: sp || 720, max: max || 1150 }); if (pulses.length > 16) pulses.shift(); }
function glow(x, z) { let v = 0; const T = V.T; for (let i = 0; i < lights.length; i++) { const l = lights[i], k = 1 - Math.hypot(x - l.x, z - l.z) / l.r; if (k > 0) { const q = k * k * l.k; if (q > v) v = q; } } for (let i = 0; i < pulses.length; i++) { const p = pulses[i], r = (T - p.t0) * p.sp, d = Math.hypot(x - p.x, z - p.z); if (d > r || d > p.max) continue; const q = p.a * Math.min(1, (r - d) / 160) * Math.exp(-(r - d) / 520) * Math.pow(1 - d / p.max, 0.7); if (q > v) v = q; } return v; }
const glowL = (x, z) => { let v = 0; for (let i = 0; i < lights.length; i++) { const l = lights[i]; if (!l.f) continue; const k = 1 - Math.hypot(x - l.x, z - l.z) / l.r; if (k > 0 && k * k * l.k > v) v = k * k * l.k; } return v; }; // light from open flowers only
const lightAt = (x, y, z) => glow(x, z) * clamp(1.2 - y / 560, 0, 1);

// ───────── building the forest
function add(type, x, z, o) { const it = Object.assign({ type, x, z, y0: 0, k: 10, lit: 0, lf: 0, d: 0, su: 0, awake: false, flash: 0, t0: 0, reg: 4, idx: items.length }, o); items.push(it); return it; }
const rows = (r, ci, b) => { const pts = []; r.forEach((s, j) => { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') pts.push({ x: (i - s.length / 2) * A, y: r.length - 1 - j, ch: s[i], ci, b: b || 0.85 }); }); return pts; };
function buildWorld(spotList) {
  items = []; ripples = []; embers = []; solids = []; seed = 11;
  if (!MAT) MAT = {
    bark: G.material({ ramp: ['#3d2f23', '#8a735e', '#c9b49a', '#f6ead6'], mode: 'hatch', ao: 0, amb: 0.1, dif: 0.85, rim: 0.05, spec: 0.1, edge: 0.04, vein: 0.42, fade: 0.9 }),
    leaf: G.material({ ramp: ['#12301f', '#2a6348', '#4f9c70', '#9fd88a'], gl: '.:\'+*&%#', holes: 0.3, hs: 34, ao: 0, amb: 0.1, dif: 0.62, rim: 0.2, spec: 0.08, edge: 0 }),
    sand: G.material({ ramp: ['#2a241a', '#7a6c55', '#cdbfa6', '#fff4dc'], alt: '#5a4f3e', mode: 'hatch', ao: 0, amb: 0.08, dif: 0.75, rim: 0.08, spec: 0.1, edge: 0.1, back: 0.6 }),
    stone: G.material({ ramp: ['#20242a', '#566070', '#9aa4b2', '#e6ecf5'], ao: 0, amb: 0.06, dif: 0.8, rim: 0.1, spec: 0.25, edge: 0.05, flat: 0.5 }),
    cap: G.material({ ramp: ['#2a2018', '#6e5a48', '#b9a58a', '#f2e6d0'], ao: 0, amb: 0.1, dif: 0.8, rim: 0.2, spec: 0.3, edge: 0.06, vein: 0.25 }),
    capGlow: G.material({ ramp: ['#0e3a44', '#2f8a9a', '#7fe0e8', '#eaffff'], ao: 0, amb: 0.6, dif: 0.4, rim: 0.3, spec: 0.3, edge: 0.05, vein: 0.3 }),
    paper: G.material({ ramp: ['#2a2418', '#6a5c44', '#b8a888', '#efe2c4'], mode: 'hatch', ao: 0, amb: 0.12, dif: 0.75, rim: 0.2, spec: 0.1, edge: 0.08, vein: 0.3 }),
    menhir: G.material({ ramp: ['#14171b', '#3a424d', '#6f7a88', '#b9c2ce'], gl: ".,:;-=+x#", ao: 0, amb: 0.14, dif: 0.95, rim: 0.2, spec: 0.05, edge: 0, vein: 0.3, fade: 0.25 }),
    glow: G.material({ ramp: ['#7a3a08', '#ff8a2a', '#ffc45e', '#fff3c9'], ao: 0, amb: 0.7, dif: 0.3, rim: 0, spec: 0, edge: 0, warm: 0 })
  };
  const keepOut = (x, z, r) => Math.hypot(x, z) < 480 || (x < CR1 + 60) || spotList.some(s => Math.hypot(s.x - x, s.z - z) < (r || 240)) || (x > 420 && x < 2000 && Math.abs(z - 200) < 170);
  const tree = (x, z, will) => {
    const it = add('tree', x, z, { will, r: will ? 15 + sr() * 7 : 17 + sr() * 13, h: will ? 360 + sr() * 80 : 330 + sr() * 110, lean: (sr() - 0.5) * (will ? 90 : 40), la: sr() * 6.283, reg: -3, g: 0, tg: 0, pts: [], bl: [] });
    const n = will ? 4 : 5 + ((sr() * 2) | 0);
    for (let b = 0; b < n; b++) { const a = b / n * 6.283 + sr(), q = b ? 110 + sr() * 120 : 0; it.bl.push({ dx: Math.cos(a) * q, dz: Math.sin(a) * q, dy: b ? 60 + sr() * 120 : 170 + sr() * 60, R: (b ? 85 + sr() * 45 : 120 + sr() * 40) * (will ? 0.6 : 1), dl: b ? 0.15 + 0.7 * sr() : 0, ph: sr() * 6, sung: false }); }
    if (will) for (let i = 0; i < 40; i++) { const a = sr() * 6.283, q = 40 + sr() * 190; it.pts.push({ x: Math.cos(a) * q, z: Math.sin(a) * q, y: it.h + 30 + sr() * 150, l: 170 + sr() * 220, ph: sr() * 6 }); }
    solids.push({ x, z, r: 46 });
  };
  // the glade: a loose ring north of camp, and trees through the rest of the dark
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.3, r = 560 + sr() * 160, x = Math.sin(a) * r, z = -1150 - Math.cos(a) * r; if (!keepOut(x, z, 200)) tree(x, z); }
  for (let n = 0, tries = 0; n < 60 && tries < 1200; tries++) { const x = HOME.x + (sr() - 0.5) * 6200, z = HOME.z + (sr() - 0.5) * 6200; if (Math.hypot(x - HOME.x, z - HOME.z) > HOME.r + 500 || keepOut(x, z) || (x < -500 && z < -1500)) continue; tree(x, z); n++; }
  for (const [x, z] of [[-1050, -1650], [-1500, -1850], [-900, -2150], [-1350, -2450], [-1750, -2250], [-1650, -1500]]) tree(x, z, true);
  // the creek: reeds along the bank, pads on the water, a heron, a boat
  for (let z = -2900; z < 2300; z += 60 + sr() * 100) { const n = 5 + ((sr() * 7) | 0), st = []; for (let i = 0; i < n; i++) st.push({ dx: (sr() - 0.5) * 60, dz: (sr() - 0.5) * 40, h: 40 + sr() * 70, lean: (sr() - 0.5) * 34, top: sr() < 0.45 }); add('reed', CR1 - 20 + sr() * 110, z, { st, reg: 2 + ((sr() * 5) | 0) }); }
  for (let z = -2700; z < 2100; z += 130 + sr() * 170) add('pad', CR1 - 120 - sr() * 420, z, { k: 9, tiny: 1, reg: 6 + ((sr() * 6) | 0) });
  // camp: tent, fire, the jar

  // the lantern path east of camp
  for (let i = 0; i < 9; i++) add('lamp', 520 + i * 180, 200 + Math.sin(i * 0.9) * 90, { n: i, reg: 5 + i });
  // the hill to the east: the old stone, a deer
  add('menhir', 2400, -500, { reg: -6 }); solids.push({ x: 2400, z: -500, r: 60 });
  // the forest floor: grass, ferns, stones, night mushrooms
  const scatter = (n, w, ok, make) => { for (let c = 0, t = 0; c < n && t < n * 8; t++) { const x = HOME.x + (sr() - 0.5) * w, z = HOME.z + (sr() - 0.5) * w; if (x < CR1 + 30 || Math.hypot(x, z) < 60 || !ok(x, z)) continue; make(x, z); c++; } };
  scatter(300, 6400, () => true, (x, z) => { const n = 5 + ((sr() * 4) | 0), st = []; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 2.4 + (sr() - 0.5) * 0.3, l = 34 + sr() * 30; st.push({ a, l, rot: sr() * 6.283 }); } add('fern', x, z, { small: 1, st, rot: sr() * 3 }); });
  scatter(46, 5800, (x, z) => !keepOut(x, z, 120), (x, z) => add('stone', x, z, { small: 1, r: 12 + sr() * 22, sq: 0.5 + sr() * 0.4 }));
  for (const [x, z] of [[900, 420], [1500, -60], [1850, 380]]) add('stone', x, z, { small: 1, r: 34, sq: 0.8 });
  for (const [x, z] of [[-420, -700], [640, -1500], [-760, -1500], [-1250, -2050], [1250, -700], [2150, 150], [-900, 500]]) add('shroom', x, z, { small: 1, n: 3 + ((sr() * 3) | 0), reg: -1 + ((sr() * 4) | 0) });
  for (const [x, z] of [[-300, -1250], [-1150, -1950], [1500, 500], [2600, -400], [-1700, 100]]) add('flies', x, z, { n: 12, y0: 110 });
  if (typeof addCreatures === 'function') addCreatures(); // find/creatures.js
  add('moon', 0, 0, { sky: true, az: 1.15, el: 0.42, reg: 12 });
}

// ───────── drawing tools
// a lit surface in the world: fn(i, j) sets WX WY WZ and the normal NX NY NZ; it is projected through the eye
const VBW = new Float32Array(24 * 24 * 8); let WX = 0, WY = 0, WZ = 0, NX = 0, NY = 0, NZ = 1, WV = NaN;
function surf(ns, nw, fn, mat, own) {
  const row = nw + 1, r8 = row * 8; let any = false, run = -1;
  for (let i = 0; i <= ns + 1; i++) {
    let ok = i <= ns;
    if (ok) for (let j = 0; j <= nw; j++) { WV = NaN; fn(i, j); if (!PR.proj(WX, WY, WZ)) { ok = false; break; } const q = (i * row + j) * 8; VBW[q] = PR.u; VBW[q + 1] = PR.v; VBW[q + 2] = PR.z; PR.rot(NX, NY, NZ); VBW[q + 3] = PR.nx; VBW[q + 4] = PR.ny; VBW[q + 5] = PR.nz; VBW[q + 6] = i / ns; VBW[q + 7] = WV === WV ? WV : j / nw * 2 - 1; }
    if (ok) { if (run < 0) run = i; } else { if (run >= 0 && i - run >= 2) { G.mesh(VBW.subarray(run * r8), i - 1 - run, nw, mat, own); any = true; } run = -1; }
  }
  return any;
}
// a fine stroke between two points in the world, drawn in true perspective with the glyph that fits its slope
function stroke(x0, y0, z0, x1, y1, z1, ci, al, own, wh) {
  if (al < 0.03 || !PR.proj(x0, y0, z0)) return; const u0 = PR.u, v0 = PR.v, d0 = PR.z; if (!PR.proj(x1, y1, z1)) return;
  const du = PR.u - u0, dv = PR.v - v0, n = Math.max(1, Math.ceil(Math.max(Math.abs(du) / A, Math.abs(dv)))), sl = Math.abs(dv) < 1e-6 ? 9 : du / dv, ch = Math.abs(sl) < 0.33 ? '|' : Math.abs(sl) > 2.6 ? '-' : sl > 0 ? '/' : '\\', dz = PR.z - d0;
  for (let i = 0; i <= n; i++) { const k = i / n; G.plot(u0 + du * k, v0 + dv * k, d0 + dz * k, ci, n === 1 && i === 0 && Math.abs(dv) < 0.6 ? "'" : ch, al, wh || 0, own, 0); }
}
let cu0 = 0, cv0 = 0, cz = 0, cs = 0, cown = 0, cit = null;
function begin(it) { // small glyph pictures (creatures, the boat): kept at their own fine size, never blown up
  if (!PR.proj(it.x, it.y0, it.z)) return false; cs = Math.min(1, PR.s * it.k); cu0 = PR.u; cv0 = PR.v; cz = PR.z; cown = (it.idx + 1) << 8; cit = it; return Math.abs(cu0) < G.S.halfU * 2 + 20;
}
function pt(lx, ly, ci, ch, al, node) { const it = cit, a = Math.min(1, al * it.lit + it.flash * 0.4); if (a < 0.03) return; G.plot(cu0 + lx * cs, cv0 + ly * cs, cz, ci, ch, a, it.flash * 0.7, cown | (node || 0), 0); }
const sprite = pts => { for (const p of pts) pt(p.x, p.y, p.ci, p.ch, p.b); };
const pan = u => clamp(u / 90, -0.8, 0.8);
function ripple(x, z, a) { ripples.push({ x, z, t0: V.T, a: a || 1 }); }

// ───────── the things
// a tree. asleep it is a bare trunk that rises out of whatever light reaches it and fades into the dark.
// when it wakes (you touch it, or a flower blooms beside it) its boughs reach out and its leaf masses
// swell open one after another, each with a note, the way a flower opens its petals
const sm = x => x * x * (3 - 2 * x);
function drawTree(it) {
  const rx = CAM.cy, rz = CAM.sy, fx = -CAM.sy, fz = CAM.cy, H = it.h, T = V.T, dt = V.dt || 0.016, id = TID + it.idx * 8;
  { const dx = it.x - CAM.x, dz = it.z - CAM.z, fw = dx * CAM.sy - dz * CAM.cy, rt = Math.abs(dx * CAM.cy + dz * CAM.sy); if (fw > 0 && (rt - 330) * CAM.f / fw > G.S.halfU + 6) { it.tg = it.awake || glowL(it.x, it.z) > 0.04 ? 1 : 0; it.g = clamp(it.g + clamp(it.tg - it.g, -dt * 0.1, dt * 0.13), 0, 1); return false; } } // out of view: it keeps growing, but is not drawn
  it.tg = it.awake || glowL(it.x, it.z) > 0.04 ? 1 : 0; // a flower in bloom wakes the trees within about 370 of it
  it.g = clamp(it.g + clamp(it.tg - it.g, -dt * 0.1, dt * 0.13), 0, 1);
  const g = it.g, base = Math.max(it.lit, g * 0.9) + it.flash * 0.5; if (base < 0.03) return false;
  const w = Flora.wind(it.x * 0.05, T), lx = Math.cos(it.la) * it.lean, lz = Math.sin(it.la) * it.lean;
  G.lit[id + 1] = Math.min(1.25, base * 1.5);
  const th0 = Math.atan2(fz, fx), ownT = (id + 1) << 8;
  const any = surf(18, 16, (i, j) => { // the half of the trunk that faces you; ridges and furrows stay where they are on the tree
    const y = H * i / 18, t = y / H, th = th0 + (j / 16 - 0.5) * 2.8, rid = Math.sin(th * 9 + it.idx) + 0.5 * Math.sin(th * 23 + y * 0.03 + it.idx * 2), R = it.r * (1 + 1.3 * Math.exp(-y / 22)) * (1 - 0.3 * t) * (1 + 0.055 * rid), c = Math.cos(th), sn = Math.sin(th), d = -0.5 * Math.cos(th * 9 + it.idx) - 0.6 * Math.cos(th * 23 + y * 0.03 + it.idx * 2);
    WX = it.x + lx * t * t + c * R; WY = y; WZ = it.z + lz * t * t + sn * R; NX = c - sn * d; NY = 0.05; NZ = sn + c * d; WV = th * 0.8; }, MAT.bark, ownT);
  for (let q = 0; q < 5; q++) { // roots reach into the ground
    const a = it.la + q * 1.26 + 0.4 * Math.sin(it.idx + q), c = Math.cos(a), sn = Math.sin(a), L = it.r * (2.6 + 1.2 * Math.sin(it.idx * 3 + q * 2)); if (c * fx + sn * fz < -0.35) continue;
    let ok = PR.proj(it.x + c * it.r * 1.5, 30, it.z + sn * it.r * 1.5), pu = PR.u, pv = PR.v, pz = PR.z, ps = PR.s;
    for (let k = 1; k <= 3 && ok; k++) { const f = k / 3, rr = it.r * 1.5 + L * f; ok = PR.proj(it.x + c * rr, 30 * (1 - f) * (1 - f), it.z + sn * rr); if (ok) { G.line(pu, pv, pz + 1, PR.u, PR.v, PR.z + 1, Math.max(0.6, it.r * 0.7 * (1 - 0.7 * f) * (ps + PR.s)), MAT.bark, ownT); pu = PR.u; pv = PR.v; pz = PR.z; ps = PR.s; } }
  }
  if (g < 0.01) return any;
  // boughs reach out first
  const tx = it.x + lx, ty = H - 14, tz = it.z + lz, kb = sm(clamp(g / 0.45, 0, 1)), ownB = (id + 2) << 8, ownL = (id + 3) << 8; G.lit[id + 2] = Math.min(1.1, g * 1.2 + it.flash * 0.4); G.lit[id + 3] = Math.min(1.1, 0.5 + 0.4 * g + it.flash * 0.5);
  for (const b of it.bl) {
    const ex = tx + (b.dx + w * 5) * kb, ey = ty + b.dy * kb, ez = tz + b.dz * kb; let ok = PR.proj(tx, ty, tz), pu = PR.u, pv = PR.v, pz = PR.z, ps = PR.s;
    for (let q = 1; q <= 4 && ok; q++) { const k = q / 4; ok = PR.proj(tx + (ex - tx) * k, ty + (ey - ty) * Math.pow(k, 0.7), tz + (ez - tz) * k); if (ok) { G.line(pu, pv, pz, PR.u, PR.v, PR.z, Math.max(0.6, it.r * 0.5 * (1 - 0.6 * k) * (ps + PR.s)), MAT.bark, ownB); pu = PR.u; pv = PR.v; pz = PR.z; ps = PR.s; } }
    if (it.will) continue;
    // then each leaf mass swells open
    const lo = sm(clamp((g - 0.3 - b.dl * 0.45) / 0.28, 0, 1)); if (lo < 0.02) continue;
    if (!b.sung && lo > 0.12) { b.sung = true; if (typeof treeNote === 'function') treeNote(it, it.bl.indexOf(b)); }
    const R = b.R * (0.2 + 0.8 * lo), cy = ey + Math.sin(T * 0.9 + b.ph) * 3;
    const ns = it.d > 1100 ? 4 : 7, nw = it.d > 1100 ? 6 : 10;
    surf(ns, nw, (i, j) => { const e = (i / ns - 0.5) * 3.0, a = (j / nw - 0.5) * 3.05, se = Math.sin(e), ce = Math.cos(e), sa = Math.sin(a), ca = Math.cos(a), bump = 1 + 0.3 * Math.sin(e * 4 + b.ph) * Math.sin(a * 3.3 + b.ph * 2) + 0.12 * Math.sin(a * 9 + e * 7 + b.ph), q = R * bump * (0.75 + 0.25 * lo); WX = ex + (rx * sa + fx * ca) * ce * q; WY = cy + se * q * 0.82; WZ = ez + (rz * sa + fz * ca) * ce * q; NX = (rx * sa + fx * ca) * ce; NY = se + 0.25; NZ = (rz * sa + fz * ca) * ce; }, MAT.leaf, ownL);
  }
  // a willow lets its strands down instead
  if (it.will) { const ls = sm(clamp((g - 0.25) / 0.6, 0, 1)); if (ls > 0.02) for (const p of it.pts) { const x = tx + p.x, z = tz + p.z, sw = w * 14 + Math.sin(T * 1.1 + p.ph) * 6, L = p.l * ls; for (let i = 0; i < 4; i++) { const k0 = i / 4, k1 = (i + 1) / 4; stroke(x + sw * k0 * k0, p.y - L * k0, z, x + sw * k1 * k1, p.y - L * k1, z, k0 < 0.3 ? COL.leafHi : k0 < 0.6 ? COL.leaf : COL.leafLo, Math.min(1, g * 1.1) * (0.9 - 0.4 * k0), ownL); } } }
  return any;
}
function drawTent(it) { // a ridge tent drawn as line work: bright poles and edges, thin strokes for the cloth
  const c = Math.cos(it.yaw), sn = Math.sin(it.yaw), W2 = 125, Hh = 205, D = 130, own = (it.idx + 1) << 8, a = Math.min(1, it.lit * 1.25 + it.flash * 0.4), P = (lx, ly, lz) => [it.x + lx * c + lz * sn, ly, it.z - lx * sn + lz * c];
  const L = (p, q, ci, al) => stroke(p[0], p[1], p[2], q[0], q[1], q[2], ci, al, own);
  for (const zz of [D, -D]) { const k = zz > 0 ? 1 : 0.55; L(P(-W2, 0, zz), P(0, Hh, zz), COL.sand, a * k); L(P(W2, 0, zz), P(0, Hh, zz), COL.sand, a * k); }
  L(P(0, Hh, D), P(0, Hh, -D), COL.sand, a * 0.9); L(P(-W2, 0, D), P(-W2, 0, -D), COL.sand, a * 0.5); L(P(W2, 0, D), P(W2, 0, -D), COL.sand, a * 0.5);
  for (const sd of [-1, 1]) for (let i = 1; i < 9; i++) { const zz = -D + 2 * D * i / 9, q = 0.25 + 0.5 * h2(i, sd + it.idx); L(P(sd * W2 * (1 - q * 0.15), Hh * q * 0.15, zz), P(sd * W2 * (1 - q), Hh * q, zz), COL.sand, a * 0.28); }
  for (let i = 1; i < 7; i++) { const k = i / 7, w = W2 * (1 - k); if (k < 0.58) { L(P(-w, Hh * k, D), P(-36 * (1 - k / 0.58), Hh * k, D), COL.sand, a * 0.3); L(P(36 * (1 - k / 0.58), Hh * k, D), P(w, Hh * k, D), COL.sand, a * 0.3); } else L(P(-w, Hh * k, D), P(w, Hh * k, D), COL.sand, a * 0.3); }
  L(P(-36, 0, D + 1), P(0, 119, D + 1), COL.sand, a * 0.8); L(P(36, 0, D + 1), P(0, 119, D + 1), COL.sand, a * 0.8);
  if (V.homeLit) { const f = 0.8 + 0.2 * vnoise(V.T * 4, 7); for (let i = 0; i < 16; i++) { const q = P((h2(i, 3) - 0.5) * 40 * (1 - h2(i, 5)), 6 + h2(i, 5) * 80, D); if (PR.proj(q[0], q[1], q[2])) G.plot(PR.u, PR.v, PR.z + 1, h2(i, 5) < 0.25 ? COL.amber : COL.warm, h2(i, 5) < 0.2 ? '@' : ':', f * (1 - h2(i, 5) * 0.7), 0.1, own); } }
  L(P(0, Hh, D), P(0, Hh + 46, D), COL.sand, a * 0.7); const fl = P(8, Hh + 42, D); if (PR.proj(fl[0], fl[1], fl[2])) G.plot(PR.u, PR.v, PR.z, COL.blush, '>', a, 0, own);
}
function orb(cx, cy, cz, R, Ry, e0, e1, mat, own, ns, nw) {
  const rx = CAM.cy, rz = CAM.sy, fx = -CAM.sy, fz = CAM.cy; ns = ns || 5; nw = nw || 8;
  return surf(ns, nw, (i, j) => { const e = e0 + (e1 - e0) * i / ns, a = (j / nw - 0.5) * 3.0, se = Math.sin(e), ce = Math.cos(e), sa = Math.sin(a), ca = Math.cos(a); WX = cx + (rx * sa + fx * ca) * R * ce; WY = cy + Ry * se; WZ = cz + (rz * sa + fz * ca) * R * ce; NX = (rx * sa + fx * ca) * ce; NY = se; NZ = (rz * sa + fz * ca) * ce; }, mat, own);
}
function drawStone(it) { G.lit[it.idx + 1] = Math.min(1.1, it.lit * 1.1 + it.flash * 0.5); const rx = CAM.cy, rz = CAM.sy, fx = -CAM.sy, fz = CAM.cy; surf(4, 8, (i, j) => { const e = i / 4 * 1.5, a = (j / 8 - 0.5) * 3.0, se = Math.sin(e), ce = Math.cos(e), sa = Math.sin(a), ca = Math.cos(a), R = it.r * (1 + 0.15 * Math.sin(j * 2.1 + it.idx)); WX = it.x + (rx * sa + fx * ca) * R * ce; WY = R * it.sq * se; WZ = it.z + (rz * sa + fz * ca) * R * ce; NX = (rx * sa + fx * ca) * ce; NY = se; NZ = (rz * sa + fz * ca) * ce; }, MAT.stone, (it.idx + 1) << 8); }
function drawMenhir(it) { // the old stone: a tall weathered column with a spiral cut into it. touched, the spiral lights mark by mark from the foot up
  const wake = it.awake ? 1 : 0, own = (it.idx + 1) << 8, fx = -CAM.sy, fz = CAM.cy, th0 = Math.atan2(fz, fx), T = V.T, H = 260;
  const lv = G.lit[it.idx + 1] = Math.min(1.1, Math.max(it.lit * 1.25, wake * 0.8) + it.flash * 0.5);
  const R = (y, th) => 36 * (1 - 0.4 * Math.pow(y / H, 2.2)) * (1 + 0.07 * Math.sin(th * 3 + 1) + 0.05 * Math.sin(y * 0.05 + th * 5));
  surf(14, 12, (i, j) => { const y = H * i / 14, th = th0 + (j / 12 - 0.5) * 2.8, r = R(y, th), c = Math.cos(th), sn = Math.sin(th); const dd = 0.5 * Math.cos(th * 3 + 1) + 0.6 * Math.cos(y * 0.05 + th * 5); WX = it.x + c * r; WY = y; WZ = it.z + sn * r; NX = c - sn * dd * 0.5; NY = 0.2 + 0.5 * Math.pow(i / 14, 3); NZ = sn + c * dd * 0.5; WV = th * 0.6; }, MAT.menhir, own);
  const lit = wake ? (T - it.t0) * 7 : 0;
  for (let k = 0; k < 24; k++) { const th = k * 0.62 + 1, y = 36 + k * 8.5, c = Math.cos(th), sn = Math.sin(th); if (c * fx + sn * fz < 0.15) continue; const r = R(y, th) + 1.5; if (!PR.proj(it.x + c * r, y, it.z + sn * r)) continue; const on = k < lit;
    const al = on ? 0.8 + 0.2 * Math.sin(T * 1.3 + k) : 0.7 * Math.min(1, lv), n = PR.s > 0.3 ? 2 : PR.s > 0.15 ? 1 : 0, u = PR.u, v = PR.v, zz = PR.z + 1; for (let q = -n; q <= n; q++) G.plot(u + q * A, v, zz, on ? COL.amber : COL.white, on ? '=' : '_', al * (1 - Math.abs(q) * 0.2), on ? 0.25 : 0, own); }
}
const DRAW = {
  tree: drawTree, tent: drawTent, stone: drawStone, menhir: drawMenhir,
  fern(it) { const w = Flora.wind(it.x * 0.05, V.T) * 3, own = (it.idx + 1) << 8, a = it.lit; for (const s of it.st) { const dx = Math.sin(s.a) * Math.cos(it.rot), dz = Math.sin(s.a) * Math.sin(it.rot), up = Math.cos(s.a); stroke(it.x, 0, it.z, it.x + dx * s.l * 0.6 + w * 0.5, up * s.l * 0.75, it.z + dz * s.l * 0.6, COL.leaf, Math.min(1, a * 1.4), own, it.flash * 0.5); stroke(it.x + dx * s.l * 0.6 + w * 0.5, up * s.l * 0.75, it.z + dz * s.l * 0.6, it.x + dx * s.l + w, up * s.l * 0.72, it.z + dz * s.l, COL.leafHi, Math.min(1, a * 1.3), own); } },
  reed(it) { const T = V.T, w = Flora.wind(it.x * 0.05, T) * 9 + it.flash * Math.sin(T * 14) * 10, own = (it.idx + 1) << 8, a = it.lit; for (const s of it.st) { const x = it.x + s.dx, z = it.z + s.dz, tx = x + s.lean + w; stroke(x, 0, z, x + (tx - x) * 0.3, s.h * 0.55, z, COL.leaf, Math.min(1, a * 1.3), own, it.flash * 0.5); stroke(x + (tx - x) * 0.3, s.h * 0.55, z, tx, s.h, z, COL.stem, Math.min(1, a * 1.5), own); if (s.top) stroke(tx, s.h, z, tx, s.h + 14, z, COL.reedTop, a, own); } },
  shroom(it) { // night mushrooms: a domed cap on a pale stem; touched, the caps glow and breathe spores upward
    const own = (it.idx + 1) << 8, wake = it.awake ? 1 : 0, T = V.T; G.lit[it.idx + 1] = Math.min(1.15, Math.max(it.lit * 1.3, wake * (0.85 + 0.15 * Math.sin(T * 1.7 + it.idx))) + it.flash * 0.5);
    for (let i = 0; i < it.n; i++) { const x = it.x + (i - it.n / 2) * 15 + Math.sin(i * 5 + it.idx) * 5, z = it.z + Math.cos(i * 3 + it.idx) * 9, h = 10 + ((i * 7 + it.idx) % 3) * 6, r = 6 + ((i * 5 + it.idx) % 3) * 2.5;
      if (PR.proj(x, 0, z)) { const u = PR.u, v = PR.v, zz = PR.z, sc = PR.s; if (PR.proj(x + Math.sin(i) * 1.5, h, z)) G.line(u, v, zz, PR.u, PR.v, PR.z, Math.max(0.6, 5 * (sc + PR.s) * 0.5), wake ? MAT.capGlow : MAT.cap, own | (i + 1)); }
      orb(x + Math.sin(i) * 1.5, h, z, r, r * 0.75, 0, 1.5, wake ? MAT.capGlow : MAT.cap, own | (i + 1), 4, 8);
      if (wake) for (let q = 0; q < 3; q++) { const k = (T * 0.22 + i * 0.37 + q * 0.33) % 1; if (PR.proj(x + Math.sin(T + i * 2 + q) * 9 * k, h + 6 + k * 70, z + Math.cos(T * 0.7 + q) * 6 * k)) G.plot(PR.u, PR.v, PR.z, COL.waterHi, '.', (1 - k) * 0.8); } }
  },
  lamp(it) { // a paper lantern on a bent pole; lit, it holds a warm pool of light on the path
    const own = (it.idx + 1) << 8, a = Math.max(it.lit, 0.1), T = V.T, lx = it.x + 26, ly = 148 + Math.sin(T * 1.3 + it.n) * 2, on = it.awake;
    stroke(it.x, 0, it.z, it.x, 172, it.z, COL.rope, a * 0.9, own); stroke(it.x, 172, it.z, lx, 178, it.z, COL.rope, a * 0.9, own); stroke(lx, 178, it.z, lx, ly + 18, it.z, COL.rope, a * 0.8, own);
    G.lit[it.idx + 1] = on ? 0.9 + 0.1 * vnoise(T * 5 + it.n, 1) : Math.min(1, Math.max(it.lit * 1.2, 0.14) + it.flash * 0.6);
    orb(lx, ly, it.z, 12, 17, -1.35, 1.35, on ? MAT.glow : MAT.paper, own, 6, 8);
    if (on) { if (PR.proj(lx, ly - 22, it.z)) G.plot(PR.u, PR.v, PR.z, COL.warm, ':', 0.6, 0, own); }
  },
  pad(it) { for (let i = -2; i <= 2; i++) pt(i * A, 0, COL.leaf, i === -2 ? '(' : i === 2 ? ')' : '_', 0.7); const k = it.awake ? clamp((V.T - it.t0) / 1.2, 0, 1) : 0; if (k < 0.3) pt(0, 1, COL.blush, '.', 0.8); else if (k < 0.7) { pt(-A, 1, COL.blush, '\\', 0.9); pt(0, 1, COL.blush, 'o', 0.9); pt(A, 1, COL.blush, '/', 0.9); } else { pt(-A, 1, COL.blush, '\\', 1); pt(0, 1, COL.amber, '@', 1); pt(A, 1, COL.blush, '/', 1); pt(0, 2, COL.blush, "'", 1); } },
  jar(it) { ['\\', '_', '_', '_', '/'].forEach((c, i) => pt((i - 2) * A, 0, COL.glass, c, 0.8)); const l = it.lit; V.cut.forEach((ci, i) => { const x = (i % 4 - 1.5) * A * 1.2, h = 2 + (i % 3); for (let v = 1; v < h; v++) pt(x, v, COL.stem, '|', 0.7); it.lit = Math.max(l, 0.5); pt(x, h, ci, i & 1 ? '*' : '@', 0.95); it.lit = l; }); },
  fire(it) { // ring of stones and crossed wood in true perspective; the flame is drawn at its own fine grain
    const T = V.T, own = (it.idx + 1) << 8, a = Math.max(it.lit, 0.12);
    for (let i = 0; i < 12; i++) { const q = i / 12 * 6.283; if (PR.proj(it.x + Math.cos(q) * 42, 4, it.z + Math.sin(q) * 42)) G.plot(PR.u, PR.v, PR.z, COL.stone, PR.s > 0.3 ? 'O' : 'o', a * 0.9, 0, own); }
    stroke(it.x - 30, 2, it.z + 8, it.x + 22, 26, it.z - 6, COL.wood, a, own); stroke(it.x + 30, 2, it.z + 6, it.x - 22, 26, it.z - 8, COL.wood, a, own); stroke(it.x - 4, 2, it.z + 30, it.x + 4, 24, it.z - 20, COL.wood, a, own);
    if (!V.homeLit || !PR.proj(it.x, 8, it.z)) return; const fs = clamp((T - it.t0) / 3, 0, 1), u0 = PR.u, v0 = PR.v, z = PR.z + 2, sc = clamp(PR.s * 9, 0.35, 2.2), hgt = 13 * fs + 2;
    for (let v = 0; v <= hgt * sc; v++) for (let i = Math.floor(-6 * sc / A); i <= 6 * sc / A; i++) {
      const lx = i * A / sc, ly = v / sc + 1, yy = ly / (13 * fs + 1), wd = 4.8 * Math.pow(Math.max(0, 1 - yy), 0.7), nx = lx + (vnoise(ly * 0.3 - T * 2.2, 3.3) - 0.5) * 2.6 * yy, e = 1 - Math.abs(nx) / wd; if (!(e > 0)) continue;
      const I = e * (1.15 - yy) * (0.5 + 0.95 * vnoise(lx * 0.55 + 9, ly * 0.38 - T * 3.1)); if (I < 0.17) continue;
      G.plot(u0 + i * A, v0 + v, z, I > 0.8 ? COL.fireW : I > 0.55 ? COL.fireY : I > 0.34 ? COL.fireO : COL.fireR, '.:^*x#%@'[Math.min(7, (I * 8.5) | 0)], Math.min(1, I * 1.5), 0, own | 1);
    }
    if (rnd() < fs * 0.3) embers.push({ x: it.x + (rnd() - 0.5) * 30, y: 40 + rnd() * 40, z: it.z + (rnd() - 0.5) * 30, vx: (rnd() - 0.5) * 16, vy: 30 + rnd() * 50, age: 0, life: 1.5 + rnd() * 2, sd: rnd() * 9 });
  }
};
// draw what the light reaches (and what is awake); returns the awake things nearby, which play in the band
function drawItems(dt) {
  const band = [], T = V.T, moon = V.ML * 0.22; pulses = pulses.filter(p => (T - p.t0) * p.sp < p.max + 1900);
  for (const it of items) {
    if (it.hidden) continue; // not in the forest yet: the world fills in night by night
    if (it.sky) { drawMoon(it); if (it.awake) band.push(it); continue; }
    const d = distTo(it.x, it.z); it.d = d; if (it.small && d > 1400) { it.lit = 0; continue; }
    const lf = glow(it.x, it.z), fog = clamp(1.6 - d / 2200, 0, 1), tg = Math.max(lf, it.awake ? 0.85 : 0, moon * fog);
    it.lf = lf; it.flash = Math.max(0, it.flash - dt * 1.4);
    it.lit += (tg - it.lit) * (1 - Math.exp(-dt * (tg > it.lit ? 3 : 2)));
    if (it.type === 'tree') { if (it.g > 0.3) lightsN.push({ x: it.x, z: it.z, r: 340 * it.g, k: 0.42 * it.g }); } else if (it.awake) { if (it.type === 'lamp') lightsN.push({ x: it.x + 26, z: it.z, r: 330, k: 0.5 }); else if (it.type === 'menhir') lightsN.push({ x: it.x, z: it.z, r: 320, k: 0.45 }); else if (it.type === 'shroom') lightsN.push({ x: it.x, z: it.z, r: 200, k: 0.35 }); }
    const fw = (it.x - CAM.x) * CAM.sy - (it.z - CAM.z) * CAM.cy;
    if (it.type === 'flies') { drawFlies(it, d); if (it.awake && d < 2200) band.push(it); continue; }
    if (fw > -60 && (it.type === 'tree' || it.lit > 0.03 || it.flash > 0.02 || it.type === 'lamp' || it.type === 'fire')) {
      if (it.tiny) { if (begin(it)) { it.su = cu0; DRAW[it.type](it); } }
      else { DRAW[it.type](it); if (PR.proj(it.x, 60, it.z)) it.su = PR.u; }
    } else it.su = (it.x - CAM.x) * CAM.cy + (it.z - CAM.z) * CAM.sy > 0 ? 80 : -80;
    if (it.awake && !it.gone && d < 2400 && (it.band || 'tree reed pad lamp shroom menhir'.includes(it.type))) band.push(it);
  }
  for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.age += dt; if (e.age > e.life) { embers.splice(i, 1); continue; } e.x += (e.vx + Math.sin(T * 2.6 + e.sd) * 12) * dt; e.y += e.vy * dt; const k = e.age / e.life; if (PR.proj(e.x, e.y, e.z)) G.plot(PR.u, PR.v, PR.z, k < 0.3 ? COL.fireY : k < 0.65 ? COL.fireO : COL.fireR, k < 0.3 ? '*' : k < 0.6 ? "'" : '.', 1 - k); }
  return band;
}
function drawFlies(it, d) {
  const T = V.T, own = (it.idx + 1) << 8; let cx = it.x, czz = it.z;
  if (it.awake) { const k = clamp((T - it.t0) / 5, 0, 1) * (T - it.t0 < 45 ? 1 : Math.max(0, 1 - (T - it.t0 - 45) / 6)); cx += (CAM.x + CAM.sy * 260 - cx) * k; czz += (CAM.z - CAM.cy * 260 - czz) * k; }
  for (let i = 0; i < it.n; i++) { const a = i * 2.4 + it.idx; if (!PR.proj(cx + Math.sin(T * (0.3 + i * 0.05) + a) * (90 + i * 9), it.y0 + Math.sin(T * (0.4 + i * 0.04) + a * 1.7) * 55 + (i % 3) * 20, czz + Math.cos(T * (0.27 + i * 0.03) + a * 1.3) * (90 + i * 9))) continue; G.plot(PR.u, PR.v, PR.z, COL.fly, PR.s > 0.5 ? '*' : '.', Math.max(0, Math.sin(T * 1.1 + a * 3)) * (it.awake ? 1 : 0.35 + 0.3 * it.lf + 0.3 * V.calm) * clamp(1.4 - d / 2600, 0, 1), it.flash, own); }
  it.su = PR.proj(it.x, it.y0, it.z) ? PR.u : 0;
}
const skyDir = (az, el) => PR.proj(CAM.x + 1e5 * Math.sin(az) * Math.cos(el), CAM.y + 1e5 * Math.sin(el), CAM.z - 1e5 * Math.cos(az) * Math.cos(el));
function drawMoon(it) { // the moon: seas and bright highlands, a soft limb, the dark part just visible; a thin halo once it is awake
  const f = V.moonF, r = 9; V.ML += ((it.awake ? f : f * 0.4) - V.ML) * 0.03; it.flash = Math.max(0, it.flash - 0.02); if (!skyDir(it.az, it.el)) { it.su = 0; return; } const u0 = PR.u, v0 = PR.v, own = (it.idx + 1) << 8, k = it.awake ? 1 : 0.6; it.su = u0;
  for (let v = -r - 4; v <= r + 4; v++) for (let i = -22; i <= 22; i++) {
    const x = i * A, d = Math.hypot(x, v) / r;
    if (d > 1) { if (it.awake && d < 1.42 && h2(i * 3, v * 5) < 0.16) G.plot(u0 + x, v0 + v, -9e5, COL.moon, '.', 0.3 * (1.42 - d) / 0.42 * f, 0, own); continue; }
    const lit = x > r * Math.cos(Math.PI * f) * Math.sqrt(Math.max(0, 1 - (v / r) * (v / r)));
    if (!lit) { if (h2(i, v) < 0.2) G.plot(u0 + x, v0 + v, -9e5, COL.moonLo, '.', 0.28, 0, own); continue; }
    const sea = vnoise(x * 0.33 + 3, v * 0.33 + 1) < 0.44, b = (0.5 + 0.5 * Math.sqrt(1 - d * d)) * (sea ? 0.55 : 1) + 0.1 * (h2(i * 7, v * 3) - 0.5);
    G.plot(u0 + x, v0 + v, -9e5, sea ? COL.moonLo : COL.moon, b > 0.85 ? '@' : b > 0.7 ? '0' : b > 0.52 ? 'O' : b > 0.38 ? 'o' : ':', Math.min(1, (0.45 + 0.6 * b) * k), it.flash * 0.5, own);
  }
}
function drawSky(stars, dt) {
  const T = V.T;
  for (const s of stars) { s.fl = Math.max(0, s.fl - dt * 0.9); if (!skyDir(s.az, s.el)) { s.su = 1e9; continue; } s.su = PR.u; s.sv = PR.v; G.plot(PR.u, PR.v, -1e6, COL.star, s.ch, Math.min(1, (s.mine ? 0.5 : 0.16) + (s.mine ? 0.25 : 0.12) * Math.sin(T * s.sp + s.ph) + s.fl), s.fl); if (s.fl > 0.05) { G.plot(PR.u - A, PR.v, -1e6, COL.white, '-', s.fl * 0.7); G.plot(PR.u + A, PR.v, -1e6, COL.white, '-', s.fl * 0.7); G.plot(PR.u, PR.v + 1, -1e6, COL.white, "'", s.fl * 0.7); } }
}
// the ground exists only where light falls on it: short marks that stay put as you move. west of the bank
// it is water, which also catches the moon
function drawGround() {
  const T = V.T, layer = (g, R, sk, wetOnly) => {
    const x0 = Math.floor((CAM.x - R) / g), x1 = Math.floor((CAM.x + R) / g), z0 = Math.floor((CAM.z - R) / g), z1 = Math.floor((CAM.z + R) / g);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const hx = h2(ix + sk, iz * 1.7), x = (ix + hx) * g, z = (iz + h2(ix * 1.3, iz + sk)) * g, dx = x - CAM.x, dz = z - CAM.z; if (dx * CAM.sy - dz * CAM.cy < NEAR) continue;
      const d = Math.hypot(dx, dz); if (d > R) continue; const wet = x < CR1 && x > CR0; if (wetOnly && !wet) continue; const lf = glow(x, z);
      if (wet) { const sw = Math.sin(x * 0.021 + T * 0.7) * Math.sin(z * 0.034 - T * 0.45) + 0.5 * Math.sin(z * 0.011 + T * 0.3), a = (0.1 + 1.1 * lf + 0.5 * V.ML) * clamp(0.45 + 0.55 * sw, 0, 1) * (0.7 + 0.3 * Math.sin(T * 1.3 + hx * 40)) * Math.min(1, (1 - d / R) * 3); if (a > 0.03 && PR.proj(x, 0, z)) G.plot(PR.u, PR.v, PR.z - 2, lf > 0.35 ? COL.amber : lf > 0.15 || (V.ML > 0.3 && hx < 0.3) ? COL.waterHi : COL.water, sw > 0.5 ? '~' : hx < 0.5 ? '-' : '_', a); if (PR.s > 0.1) { const u = PR.u, v = PR.v, zz = PR.z - 2, ci = lf > 0.35 ? COL.amber : COL.water, n = PR.s > 0.3 ? 3 : 1; for (let q = 1; q <= n; q++) { G.plot(u + q * A, v, zz, ci, sw > 0.5 ? '~' : '-', a * (1 - q / (n + 1))); G.plot(u - q * A, v, zz, ci, sw > 0.5 ? '~' : '-', a * (1 - q / (n + 1))); } } continue; } // each glint is a short line of water
      if (x <= CR0 || lf < 0.03 || !PR.proj(x, 0, z)) continue;
      G.plot(PR.u, PR.v, PR.z - 2, hx < 0.6 ? COL.ground : COL.leafLo, hx < 0.3 ? '.' : hx < 0.6 ? ',' : hx < 0.8 ? "'" : ':', Math.min(1, lf * (0.9 + 1.1 * hx)), 0, 0, 0);
      if (PR.s > 0.3) { const al = Math.min(1, lf * (0.6 + hx)), u = PR.u, v = PR.v, zz = PR.z - 2, n = PR.s > 0.6 ? 5 : 3; for (let q = 1; q <= n; q++) G.plot(u + (h2(ix + q, iz) - 0.5) * 9 * PR.s * 2, v + (h2(ix, iz + q) - 0.5) * 3 * PR.s * 2, zz, q & 1 ? COL.leafLo : COL.ground, ".,'`:"[q % 5] === '`' ? ',' : ".,':"[q % 4], al * 0.8, 0, 0, 0); } // close to the eye, each mark becomes a small patch of earth and moss
    }
  };
  layer(13, 420, 0); layer(40, 1250, 7); if (CAM.x < CR1 + 1200) layer(21, 1100, 3, true); drawGrass();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], age = T - r.t0; if (age > 3.2) { ripples.splice(i, 1); continue; }
    for (let k = 0; k < 2; k++) { const rad = (age - k * 0.5) * 70; if (rad <= 0) continue; const n = Math.ceil(rad * 0.35) + 8; for (let j = 0; j < n; j++) { const a = j / n * 6.283; if (PR.proj(r.x + Math.cos(a) * rad, 0, r.z + Math.sin(a) * rad)) G.plot(PR.u, PR.v, PR.z, COL.waterHi, j & 1 ? '-' : '~', r.a * 0.7 * (1 - age / 3.2)); } }
  }
}
// grass grows wherever light falls: curved blades in true perspective that lean with the wind and part
// around you as you walk; here and there a small bloom the colour of a star
function drawGrass() {
  const T = V.T, g = 24, R = 560, x0 = Math.floor((CAM.x - R) / g), x1 = Math.floor((CAM.x + R) / g), z0 = Math.floor((CAM.z - R) / g), z1 = Math.floor((CAM.z + R) / g);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const h = h2(ix * 1.31 + 3, iz * 0.77), drift = vnoise(ix * 0.09 + 4, iz * 0.09); if (h < 0.3 || h < 1.5 - drift * 2.2) continue;
    const x = (ix + h2(ix, iz + 5)) * g, z = (iz + h2(ix + 9, iz)) * g, dx = x - CAM.x, dz = z - CAM.z; if (dx * CAM.sy - dz * CAM.cy < NEAR || x < CR1 + 14) continue;
    const d = Math.hypot(dx, dz); if (d > R || (d > 300 && h < 0.6)) continue; const l = glow(x, z); if (l < 0.04) continue;
    const a = Math.min(1, l * 1.5) * Math.min(1, (1 - d / R) * 4), wnd = Flora.wind(x * 0.05, T) * 4.5, pd = d < 85 ? (1 - d / 85) * 18 / (d + 1) : 0, n = 2 + ((h * 5) | 0);
    for (let b = 0; b < n; b++) {
      const bx = x + (h2(ix + b, iz) - 0.5) * 18, bz = z + (h2(ix, iz + b) - 0.5) * 18, hg = 9 + h2(ix + b * 3, iz + b) * 30, lean = (h2(ix - b, iz) - 0.5) * 15 + wnd, tx = bx + lean + dx * pd, tz = bz + dz * pd, mx = bx + (tx - bx) * 0.3, mz = bz + (tz - bz) * 0.3;
      stroke(bx, 0, bz, mx, hg * 0.55, mz, COL.leafLo, a * 0.8, 0); stroke(mx, hg * 0.55, mz, tx, hg, tz, hg > 26 ? COL.leafHi : COL.leaf, a, 0);
      if (b === 0 && h > 0.94 && PR.proj(tx, hg + 2, tz)) G.plot(PR.u, PR.v, PR.z, h > 0.98 ? COL.blush : h > 0.96 ? COL.amber : COL.star, PR.s > 0.3 ? '*' : '.', a, 0.15 * a);
    }
  }
}
// dust and small wings drifting through the light
function drawMotes() {
  const T = V.T; for (let i = 0; i < 26; i++) {
    const wx = h2(i, 1) * 900 + Math.sin(T * 0.17 + i) * 60, wz = h2(i, 2) * 900 + Math.cos(T * 0.13 + i * 1.7) * 60, rx = (((wx - CAM.x) % 900) + 1350) % 900 - 450, rz = (((wz - CAM.z) % 900) + 1350) % 900 - 450, lf = glow(CAM.x + rx, CAM.z + rz); if (lf < 0.05) continue;
    if (PR.proj(CAM.x + rx, 35 + h2(i, 3) * 190 + Math.sin(T * 0.5 + i) * 18, CAM.z + rz)) G.plot(PR.u, PR.v, PR.z, i % 5 ? COL.amber : COL.fly, '.', 0.7 * lf * (0.5 + 0.5 * Math.sin(T * 1.3 + i * 2)));
  }
}
