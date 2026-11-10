'use strict';
// The alchemist: walk a moonlit forest, listen to flowers, and bring each creature the flower whose
// voice matches its hum. Looks never decide. Hold left/right (or arrows, A/D) to walk, tap to listen,
// hold a flower (or tap "pick") to pick it. R starts a new night, M mutes. #demo, #demo=1..5, #demo=end.
const cv = document.getElementById('c'), KEY = 'small-hours-alchemist', A = G.S.A;
const small = Math.min(screen.width, screen.height) < 500, touch = matchMedia('(pointer:coarse)').matches;
G.init(cv, { rows: small ? 92 : 124, cols: 200, portraitRows: 230, origin: [0.5, 0.85] });
const clamp = G.clamp, h3 = G.h3, smooth = x => x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k, sign = Math.sign;
const C0 = 150, ZONE = 270, END = C0 + 5 * ZONE, centre = k => C0 + k * ZONE, BAR = M.STEP * 16;
const SPV = { bell: 'bell', daisy: 'glass', lily: 'flute', iris: 'harp', peony: 'hum', anemone: 'wood' };
const SPC = { peony: '#ff86b8', anemone: '#7f9bff', lily: '#cfeadb', iris: '#ffd47f', daisy: '#e6f0ff', bell: '#a59cff' };
const SCALE = { peony: 0.7, anemone: 0.75, lily: 0.68, iris: 0.68, daisy: 1, bell: 0.88 };
const CR = [
  { kind: 'moth', name: 'moth spirit', a: 'something pale hums in the dark.', b: 'it wants one flower. tap it to hear again.' },
  { kind: 'toad', name: 'toad', a: 'two notes from the wet grass.', b: 'one flower sings them in that order.' },
  { kind: 'fox', name: 'fox', a: 'a small tune of three notes.', b: 'one flower knows it.' },
  { kind: 'owl', name: 'owl', a: 'a call from the branch.', b: 'the note is the same. listen for the rhythm.' },
  { kind: 'stag', name: 'stag', a: 'three notes, then all at once.', b: 'it wants three flowers.' }];
const LOOKS = [['bell', 'bell', 'daisy'], ['iris', 'iris', 'anemone', 'anemone'], ['lily', 'lily', 'lily', 'peony'], ['anemone', 'daisy', 'anemone', 'daisy'], ['peony', 'peony', 'lily', 'iris', 'bell', 'anemone']];
const OFF = { 3: [-34, 32, 64], 4: [-66, -34, 34, 66], 6: [-98, -66, -34, 34, 66, 98] }, CLEAR = [-104, 42, -72, 72, -42, 104, 0];
// where each gathered voice sits in the two-bar loop: [period in bars, which bar, first 16th]
const LAYER = [[[2, 0, 0], [2, 1, 14]], [[2, 0, 10]], [[2, 1, 8]], [[2, 1, 0]], [[2, 0, 2]], [[2, 0, 5]], [[2, 0, 8]]];
const COL = { ground: G.col('#7d8f88'), far: G.col('#2a3a48'), fly: G.col('#d9ff8a'), water: G.col('#5f8fd0'), white: G.col('#ffffff') };

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── the night: five puzzles, their flowers, the forest ─────────────────────────────────────────
function puzzles(rnd) {
  const P = V.P, ri = n => (rnd() * n) | 0, pick = a => a[ri(a.length)], shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const seq = (...ix) => ix.map((i, n) => ({ d: n * 2, m: P[i] })), out = [];
  { const set = shuf(pick([[0, 3, 6], [1, 4, 7], [0, 4, 8], [2, 5, 8], [1, 3, 7]]).slice()); out.push({ req: seq(set[0]), opts: set.map(i => seq(i)), right: 1 }); }
  { const i = 1 + ri(6); let j, k, e, f;
    do { j = i + (ri(2) ? 1 : -1) * (1 + ri(3)); } while (j < 0 || j > 8);
    do { k = ri(9); } while (k === i || k === j || Math.abs(P[k] - P[j]) < 3);
    do { e = ri(9); f = ri(9); } while (e === f || e === i || e === j);
    out.push({ req: seq(i, j), opts: [seq(i, j), seq(j, i), seq(i, k), seq(e, f)], right: 1 }); }
  { let a, b, c, x;
    do { a = ri(9); b = ri(9); c = ri(9); } while (a === b || b === c || a === c || Math.max(a, b, c) - Math.min(a, b, c) > 5);
    do { x = ri(9); } while (x === a || x === b || x === c || Math.abs(P[x] - P[c]) < 3);
    out.push({ req: seq(a, b, c), opts: [seq(a, b, c), seq(c, b, a), seq(a, b, x), seq(b, a, c)], right: 1 }); }
  { const pool = shuf([[0, 4, 6], [0, 2, 4], [0, 2, 6], [0, 1, 2, 6], [0, 4, 5, 6], [0, 6], [0, 2, 3, 4, 6]]).slice(0, 4), m = pick([66, 69, 71, 74]), opts = pool.map(r => r.map(d => ({ d, m })));
    out.push({ req: opts[0], opts, right: 1, short: true }); }
  { const ch = pick([[62, 66, 69], [66, 69, 74], [69, 74, 78], [71, 74, 78], [62, 69, 78]]), pcs = ch.map(m => m % 12), rest = shuf(P.filter(m => !pcs.includes(m % 12))).slice(0, 3);
    out.push({ req: [0, 3, 6, 11, 11, 11].map((d, i) => ({ d, m: ch[i % 3] })), opts: [...ch, ...rest].map(m => [{ d: 0, m }]), right: 3 }); }
  out.forEach((p, k) => { p.looks = shuf(LOOKS[k].slice()); p.order = shuf(p.opts.map((_, i) => i)); });
  return out;
}
let st, W, walker, voices, cam, camQ, lastCam, T = 0, last = 0, events = [], cap = null, focus = null, focusT = -99, goal = null, press = null, fin = 0, gateFade = null, said = {};
const keys = {}, mouse = { u: 0, v: -999, on: false }, lights = [], demo = location.hash.match(/^#demo(?:=(\w+))?/);
function build() {
  const rnd = rng(st.seed), flowers = [], clear = [];
  puzzles(rnd).forEach((p, k) => p.opts.forEach((motif, i) => {
    const species = p.looks[i], pos = p.order[i], id = flowers.length, wx = centre(k) + OFF[p.opts.length][pos], f = { id, ch: k, wx, species, motif, right: i < p.right, short: !!p.short, heard: false, picked: false, sleep: 0, wk: 0, tg: 0.42 };
    f.p = Flora.make(species, { x: 0, y: 0, z: (rnd() - 0.5) * 8, scale: SCALE[species], id, yaw: (rnd() - 0.5) * 0.8, turn: 0.3, ph: rnd() * 6, seed: rnd() * 9, g: 0.42 });
    f.top = f.p.sp.H * f.p.scale; flowers.push(f);
    if (f.right) { f.clear = clear.length; const cx = END + CLEAR[clear.length], back = CLEAR[clear.length] === 0; clear.push({ wx: cx, tg: 0, p: Flora.make(species, { x: 0, y: 0, z: back ? -34 : (rnd() - 0.5) * 8, scale: back ? 0.95 : SCALE[species] * 1.05, id: 40 + clear.length, yaw: (rnd() - 0.5) * 0.8, ph: rnd() * 6, seed: rnd() * 9 }) }); }
  }));
  const cr = CR.map((c, k) => Object.assign({ k, wx: centre(k), x: centre(k), own: (100 + k) << 8, req: null, met: false, glad: false, sp: 0, joy: 0, no: 0, mouth: { u: 0, v: 20, r: 14 } }, c));
  puzzles(rng(st.seed)).forEach((p, k) => { cr[k].req = p.req; });
  const trees = [{ x: centre(3) + 12, r: 4.4, seed: 3.3, leaves: Sh.leaves(rnd, 150) }];
  for (let x = -70; x < END - 125; x += 46 + rnd() * 40) if (Math.abs(x - trees[0].x) > 30 && !cr.some(c => Math.abs(c.wx - x) < 13)) trees.push({ x, r: 2.6 + rnd() * 2.6, seed: rnd() * 9, leaves: Sh.leaves(rnd, 150) });
  const mush = []; for (let x = 40; x < END - 60; x += 50 + rnd() * 70) mush.push({ wx: x, n: 2 + ((rnd() * 3) | 0), fl: 0 });
  const flies = []; for (let i = 0; i < 12; i++) flies.push({ x: (rnd() - 0.5) * 300, y: 6 + rnd() * 34, ph: rnd() * 9, fl: 0 });
  W = { flowers, cr, trees, mush, flies, clear }; voices = []; events = []; goal = null; focus = null; fin = 0; gateFade = null; said = {}; cap = null;
  for (let k = 0; k < st.ch; k++) { cr[k].met = cr[k].glad = true; }
  st.picked.forEach(id => { const f = flowers[id]; f.picked = f.heard = true; f.p.g = 1; addVoice(f); });
  walker = { x: st.x, d: 1, ph: 0, moving: 0 }; cam = walker.x + 6; camQ = lastCam = Math.round(cam / A) * A;
  if (st.ch > 0) cr[0].x = walker.x - 26;
  if (st.fin) { fin = 2; voices.forEach(v => { v.in = true; W.clear[v.f.clear].tg = W.clear[v.f.clear].p.g = 1; }); }
}
function addVoice(f) { const v = { f, kind: SPV[f.species], motif: f.motif, short: f.short, col: G.col(SPC[f.species]), li: voices.length, x: f.wx, y: f.top, fl: 1, in: false, fly: null }; voices.push(v); return v; }
function save() { if (demo) return; st.x = Math.round(walker.x); st.fin = fin === 2 ? 1 : 0; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }
function fresh() { st = { seed: (Math.random() * 1e9) | 0, ch: 0, picked: [], x: 0, fin: 0 }; build(); say('small hours.', touch ? 'hold the left or the right side to walk' : 'arrow keys, or hold either side, to walk', 9); save(); }
function load() {
  if (demo) {
    const d = demo[1] || '3', k = d === 'end' ? 5 : d === 'start' ? 0 : clamp(+d || 3, 1, 5) - 1;
    st = { seed: 20261110, ch: k, picked: [], x: 0, fin: d === 'end' ? 1 : 0 }; build();
    st.picked = W.flowers.filter(f => f.right && f.ch < k).map(f => f.id); st.x = d === 'end' ? END - 22 : d === 'start' ? 0 : centre(k) - 30; build();
    if (k < 5 && d !== 'start') { W.cr[k].met = true; W.flowers.filter(f => f.ch === k).forEach((f, i) => { if (i !== 1) { f.heard = true; f.p.g = 0.74; f.wk = 0.85; } }); focus = W.flowers.find(f => f.ch === k && f.heard && f.wx > st.x); focusT = 0; }
    return;
  }
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; }
  if (st && st.seed && Array.isArray(st.picked)) build(); else fresh();
}
const clock = () => performance.now() / 1000; // presses are timed in real time, so a slow frame never stretches a long press
const after = (sec, fn) => events.push({ t: T + sec, fn });
const say = (a, b, dur) => { cap = { a, b: b || '', t0: T, dur: dur || 6 }; };
const once = (key, a, b, dur) => { if (!said[key]) { said[key] = 1; say(a, b, dur); } };
const pan = wx => clamp((wx - camQ) / G.S.halfU * 0.7, -0.8, 0.8);
const headOf = f => ({ u: f.wx - camQ + f.p.sp.lean * f.p.scale, v: f.top * (0.55 + 0.45 * smooth(clamp(f.p.g / 0.35, 0, 1))) });

// ── what the player can do ─────────────────────────────────────────────────────────────────────
function listen(f, vel) {
  const h = headOf(f), asleep = f.sleep > T;
  if (!asleep) f.heard = true;
  focus = f; focusT = T; Flora.kick(f.p, h.u > walker.x - camQ ? -1 : 1, T);
  V.speak(V.tone, SPV[f.species], f.motif, (vel || 0.9) * (asleep ? 0.35 : 1), pan(f.wx), () => { const q = headOf(f); f.p.g = Math.min(1, f.p.g + 0.02); G.wave(q.u, q.v, { obj: f.id + 1, life: 1.6, sp: 26, a: asleep ? 0.4 : 1 }); }, f.short);
  if (f.ch === st.ch && !f.picked) once('voice', 'every flower has a voice.', touch ? 'hold a flower to pick it' : 'hold the click on a flower to pick it', 7);
}
function request(c, vel) {
  if (!c.req) return 0;
  return V.speak(V.cry, c.kind, c.req, vel || 0.9, pan(c.x), () => { c.sp = 1; G.wave(c.mouth.u, c.mouth.v, { obj: c.own >> 8, life: 1.3, sp: 22, a: 0.8 }); });
}
function recall() { const c = W.cr[st.ch]; if (c && c.met) V.speak(V.cry, 'self', c.req, 0.8, pan(walker.x), () => { walker.hum = 1; }); else if (M.on) M.sing('star', M.pent(8), 0.5, 0); }
function pickFlower(f) {
  if (f.picked || f.ch !== st.ch || f.sleep > T) { listen(f); return; }
  const side = walker.x < f.wx ? -1 : 1, x = f.wx + side * 15;
  if (Math.abs(walker.x - f.wx) < 20) resolve(f); else goal = { x, act: () => resolve(f) };
}
function resolve(f) {
  const c = W.cr[f.ch]; if (f.picked || f.ch !== st.ch) return;
  walker.d = f.wx > walker.x ? 1 : -1; focus = null;
  if (!f.right) {
    listen(f, 0.5); focus = null; f.sleep = T + 11; c.no = 1; after(1.9, () => request(c));
    once('wrong', 'not that one.', 'it closes, and opens again later.', 6); return;
  }
  f.picked = f.heard = true; st.picked.push(f.id); const v = addVoice(f), left = W.flowers.filter(o => o.ch === f.ch && o.right && !o.picked).length;
  const dur = listen(f, 1) || 0, h = headOf(f); G.wave(h.u, h.v, { life: 2.6, a: 0.7 });
  if (M.on) M.swell(M.now, pan(f.wx));
  if (left) { say(f.p.name.toLowerCase() + '.', left === 2 ? 'one of three.' : 'two of three.', 5); save(); return; }
  c.glad = true; c.joy = 1; gateFade = { x: centre(st.ch) + 126, t0: T }; st.ch++; save();
  say(f.p.name.toLowerCase() + '.', `the ${c.name} is glad.`, 6);
  after(1.4 + f.motif[f.motif.length - 1].d * M.STEP, () => { request(c, 0.8); if (M.on) M.CHT[M.chAt(M.now + 1)].forEach((n, i) => M.play('tent', M.quant(M.now + 0.9 + i * M.STEP * 2), n + 12, 0.4, pan(c.x))); });
  after(7, () => once('stay', 'its voice stays with you.', st.ch < 5 ? 'the dark ahead opens.' : 'the trees open. the moon is close.', 6));
}
function pour() {
  if (fin || st.ch < 5) { if (M.on) M.sing('tent', 50, 0.6, pan(END)); return; }
  fin = 1; walker.d = 1; say('the voices go in, one by one.', '', 6);
  voices.forEach((v, i) => after(1 + i * BAR, () => { v.fly = { t0: T, x0: v.x, y0: v.y }; }));
  after(1 + voices.length * BAR + 3, () => { fin = 2; save(); say('the small hours.', touch ? 'hold the moon to walk a new night' : 'r to walk a new night', 14); });
}
function plink(m) { m.fl = 1; if (M.on) M.sing('drip', M.pent(7 + ((m.wx * 7) | 0) % 6), 0.7, pan(m.wx)); G.wave(m.wx - camQ, 3, { life: 1, sp: 18, a: 0.6, obj: 120 }); }
function hitTest(u, v) {
  if (focus && T - focusT < 9 && !focus.picked && focus.ch === st.ch && focus.sleep < T) { const h = headOf(focus); if (Math.abs(u - (focus.wx - camQ)) < 9 && Math.abs(v + 6) < 4) return { type: 'tag', f: focus }; }
  const id = G.pick(u, v) >> 8, wx = u + camQ; let best = null, bd = 1e9;
  for (const f of W.flowers) { const h = headOf(f), d = Math.hypot(u - h.u, v - h.v * 0.9); if (d < f.top * 0.36 + 5 && d < bd) { bd = d; best = f; } }
  if (id >= 1 && id <= W.flowers.length) return { type: 'flower', f: W.flowers[id - 1] };
  if (id >= 100 && id < 105) { // a creature never hides a flower: near a bloom, the nearer of the two wins
    const c = W.cr[id - 100]; if (!best || (!(c.k === 0 && c.glad) && Math.hypot(u - c.mouth.u, v - c.mouth.v) < bd)) return { type: 'creature', c };
  }
  if (id === 90) return { type: 'self' }; if (id === 95) return { type: 'cauldron' }; if (id === 96) return { type: 'moon' };
  if (best) return { type: 'flower', f: best };
  for (const c of W.cr) if (Math.hypot(u - c.mouth.u, v - c.mouth.v) < c.mouth.r * 0.8 && Math.abs(c.x - camQ - c.mouth.u) < 40) return { type: 'creature', c };
  if (Math.abs(wx - walker.x) < 9 && v > -2 && v < 36) return { type: 'self' };
  if (Math.abs(wx - END) < 13 && v > -2 && v < 20) return { type: 'cauldron' };
  for (const m of W.mush) if (Math.abs(wx - m.wx) < 6 && v > -3 && v < 9) return { type: 'mush', m };
  for (const f of W.flies) if (Math.hypot(wx - f.px, v - f.py) < 3.5) return { type: 'fly', f };
  return null;
}
function act(h, held) {
  if (h.type === 'tag') pickFlower(h.f);
  else if (h.type === 'flower') listen(h.f);
  else if (h.type === 'creature') { const c = h.c; if (c.glad) c.joy = Math.max(c.joy, 0.6); else if (!c.met) return; request(c); }
  else if (h.type === 'self') recall();
  else if (h.type === 'cauldron') { if (Math.abs(walker.x - (END - 22)) < 4) pour(); else goal = { x: END - 22, act: pour }; }
  else if (h.type === 'moon') { if (M.on) M.sing('moon', 74, 0.8, 0.3); }
  else if (h.type === 'mush') plink(h.m);
  else if (h.type === 'fly') { h.f.fl = 1; if (M.on) M.sing('star', M.pent(10 + ((h.f.ph * 3) | 0) % 5), 0.6, pan(h.f.px)); }
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); M.init(); const p = G.toUV(e), hit = hitTest(p.u, p.v);
  press = { u: p.u, v: p.v, t0: clock(), hit, done: false }; if (!hit) goal = null;
});
addEventListener('pointerup', e => {
  M.init(); if (!press) return; const held = clock() - press.t0, p = press; press = null;
  if (p.hit) { if (!p.done) act(p.hit, held); } else if (held < 0.28) goal = { x: clamp(p.u + camQ, -30, END + 60) };
});
addEventListener('pointercancel', () => { press = null; });
cv.addEventListener('pointermove', e => { const p = G.toUV(e); mouse.u = p.u; mouse.v = p.v; mouse.on = e.pointerType === 'mouse'; if (press) { press.u = p.u; press.v = p.v; } });
cv.addEventListener('pointerleave', () => { mouse.on = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); if (e.repeat || e.metaKey || e.ctrlKey) return; keys[k] = true; M.init();
  if (k === 'r') fresh();
  if (k === 'm') M.mute();
  if (k === ' ' || k === 'e' || k === 'enter' || k === 'f') { // keyboard: space listens to what is nearest, enter picks it
    e.preventDefault(); const c = W.cr[st.ch]; let f = null, bd = 18;
    for (const o of W.flowers) { const d = Math.abs(o.wx - walker.x); if (d < bd) { bd = d; f = o; } }
    if (f) (k === 'enter' || k === 'f') ? pickFlower(f) : listen(f);
    else if (Math.abs(END - walker.x) < 24) pour(); else if (c && c.met) request(c);
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; press = null; });

// ── the band: every gathered voice keeps playing its own motif on the shared clock ──────────────
M.onStep((step, bar, s, ch, t) => {
  if (!voices || !voices.length) return;
  const c = W.cr[st.ch], near = c && Math.abs(walker.x - c.wx) < 135, lvl = fin === 2 ? 0.6 : fin === 1 ? 0.3 : near ? 0.15 : 0.36;
  if (fin !== 2 && t < V.hush) return;
  for (const v of voices) {
    if (fin === 1 && !v.in) continue;
    for (const L of LAYER[v.li]) if (bar % L[0] === L[1]) for (const n of v.motif) if (L[2] + n.d === s) { V.tone(v.kind, t, n.m, lvl, v.in ? (v.li % 2 ? 0.45 : -0.45) : pan(v.x), true); M.vis(t, () => { v.fl = 1; }); }
  }
  if (voices.length >= 2 && s === 0 && bar % 2 === 0) M.play('sub', t, M.ROOT[ch], fin === 2 ? 0.7 : 0.32);
  if (fin === 2) {
    if (s === 0 && bar % 2 === 0) { M.play('moon', t, M.CHT[ch][1] + 12, 0.7, 0.3); V.cry('stag', t, M.CHT[ch][2], 0.35, -0.4); }
    if (s % 2 === 0 && Math.random() < 0.2) M.play('glass', t, M.pent(5 + ((Math.random() * 8) | 0)), 0.3, Math.random() - 0.5);
    if (s === 12 && bar % 4 === 3) V.cry('owl', t, M.CHT[ch][0] + 12, 0.3, 0.5);
  }
});

// ── one frame ──────────────────────────────────────────────────────────────────────────────────
function update(dt) {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].t <= T) { const e = events.splice(i, 1)[0]; e.fn(); }
  // walking
  let dir = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  if (press && !press.hit && clock() - press.t0 > 0.28) { const du = press.u - (walker.x - camQ); dir = Math.abs(du) > 2.5 ? sign(du) : 0; }
  if (dir) goal = null; else if (goal) { const du = goal.x - walker.x; if (Math.abs(du) < 0.6) { const g = goal; goal = null; if (g.act) g.act(); } else dir = sign(du); }
  if (fin === 1) dir = 0;
  const gate = st.ch < 5 ? centre(st.ch) + 126 : 1e9, nx = walker.x + dir * 16 * dt;
  if (dir) {
    walker.d = dir;
    if (nx > gate - 14) { dir = 0; goal = null; if (W.cr[st.ch].met && !(cap && cap.a === 'too dark to go on.')) say('too dark to go on.', 'something here still waits for its flower.', 4); }
    else if (nx < -30 || nx > END + 60) { dir = 0; goal = null; } else walker.x = nx;
  }
  walker.moving += ((dir ? 1 : 0) - walker.moving) * (1 - Math.exp(-dt * 9));
  if (dir) { const p0 = walker.ph; walker.ph += dt * 4.6; if (Math.floor(p0 / Math.PI) !== Math.floor(walker.ph / Math.PI) && M.on) M.burst(M.now, 0.035, 0, 420, 0.07, 0.15, 'lowpass'); }
  walker.hum = Math.max(0, (walker.hum || 0) - dt * 2);
  cam += (walker.x + walker.d * 6 - cam) * (1 - Math.exp(-dt * 2.2)); camQ = Math.round(cam / A) * A;
  // creatures
  const c = W.cr[st.ch];
  if (c && !c.met && Math.abs(walker.x - c.wx) < 84) { c.met = true; say(c.a, c.b, 9); after(0.5, () => request(c)); }
  for (const o of W.cr) { o.sp = Math.max(0, o.sp - dt * 2.2); o.joy = Math.max(0, o.joy - dt * 0.3); o.no = Math.max(0, o.no - dt * 1.4); }
  const moth = W.cr[0]; if (moth.glad) moth.x += (walker.x - walker.d * 26 - moth.x) * (1 - Math.exp(-dt * 1.3));
  // flowers
  for (const f of W.flowers) {
    const lit = Math.abs(f.wx - walker.x) < 38;
    f.tg = f.sleep > T ? 0.33 : f.picked ? 1 : f.heard ? 0.74 : lit ? 0.5 : 0.42;
    f.p.g += (f.tg - f.p.g) * (1 - Math.exp(-dt * 1.4));
    f.wk += ((f.sleep > T ? 0.15 : f.picked ? 1 : f.heard ? 0.85 : 0) - f.wk) * (1 - Math.exp(-dt * 2));
  }
  for (const o of W.clear) o.p.g += (o.tg - o.p.g) * (1 - Math.exp(-dt * 0.5));
  // the gathered voices drift behind the lantern, or fly into the cauldron
  voices.forEach((v, i) => {
    v.fl = Math.max(0, v.fl - dt * 1.6);
    if (v.in) return;
    if (v.fly) {
      const k = (T - v.fly.t0) / 1.7;
      if (k >= 1) { v.in = true; v.fly = null; W.clear[v.f.clear].tg = 1; G.wave(END - camQ, 16, { life: 2.4, a: 0.8 }); if (M.on) { M.swell(M.now, 0, 0.05); V.speak(V.tone, v.kind, v.motif, 1, 0, null, v.short); } return; }
      const e = smooth(k); v.x = lerp(v.fly.x0, END, e); v.y = lerp(v.fly.y0, 17, e) + Math.sin(k * Math.PI) * 16; return;
    }
    const tx = walker.x - walker.d * (10 + i * 3.6), ty = 20 + 2.4 * Math.sin(T * 1.4 + i * 1.1) + (i % 2) * 3.5, e = 1 - Math.exp(-dt * (3.2 - i * 0.3));
    v.x += (tx - v.x) * e; v.y += (ty - v.y) * e;
  });
  for (const m of W.mush) m.fl = Math.max(0, m.fl - dt * 0.5);
  const hu = G.S.halfU;
  for (const f of W.flies) { f.fl = Math.max(0, f.fl - dt); if (Math.abs(f.x - walker.x) > hu + 60) f.x = walker.x + (f.x < walker.x ? 1 : -1) * (hu + 30 + Math.random() * 20); f.px = f.x + 9 * Math.sin(T * 0.21 + f.ph); f.py = f.y + 4 * Math.sin(T * 0.37 + f.ph * 2); }
  // long press on a flower picks it
  if (press && press.hit && press.hit.type === 'flower' && !press.done && clock() - press.t0 > 0.95) { press.done = true; pickFlower(press.hit.f); }
  if (press && press.hit && press.hit.type === 'moon' && !press.done && fin === 2 && clock() - press.t0 > 1.2) { press.done = true; fresh(); }
  if (st.ch === 5 && !fin && walker.x > END - 75) once('pot', 'a cauldron under the moon.', touch ? 'tap it' : 'click it', 8);
  const tx = centre(1), near = clamp(1 - Math.abs(walker.x - tx) / 90, 0, 1);
  M.bed.pad = fin === 2 ? 1 : 0.22 + 0.09 * voices.length; M.bed.air = fin === 2 ? 1 : 0; M.bed.water = near * 0.8;
  if (Math.floor(T) !== Math.floor(T - dt) && Math.floor(T) % 5 === 0 && !fin) save();
}
function draw() {
  const S = G.S, hu = S.halfU, top = S.oy - 1, wu = walker.x - camQ, open = smooth(clamp((walker.x - (END - 200)) / 140, 0, 1));
  G.begin(T); G.tickWaves(lastCam - camQ); lastCam = camQ; lights.length = 0;
  const mu = hu * (S.portrait ? 0.42 : 0.56), mv = top * 0.8, mR = (S.portrait ? 7 : 9) * (1 + 0.8 * open);
  Sh.moon(mu, mv, mR, 96 << 8); lights.push({ u: mu, v: mv, r: mR * 3.4, k: 1 });
  // far trunks drift at half speed, the near trees carry the canopy
  const fo = camQ * 0.5, fa = 0.9 * (1 - open);
  if (fa > 0.02) for (let i = Math.floor((fo - hu) / 21) - 1; i <= Math.ceil((fo + hu) / 21); i++) {
    const u = i * 21 + h3(i, 1, 1) * 13 - fo, w = 1 + ((h3(i, 2, 1) * 3) | 0), a = fa * (0.45 + 0.55 * h3(i, 3, 1));
    for (let v = 0; v <= top; v++) for (let j = 0; j < w; j++) if (h3(i, v, j) > 0.12) G.plot(u + j * A, v, -2000, COL.far, j === 0 ? '|' : h3(i, v, 9) < 0.5 ? ':' : '|', a, 0);
  }
  W.trees.forEach((t, i) => { const u = t.x - camQ; if (Math.abs(u) < hu + 48) Sh.tree(u, t, T, top, -60, (200 + i) << 8); });
  // ground
  const c0 = Math.round(camQ / A), lan = wu + walker.d * 14.4;
  for (let c = 0; c < S.COLS; c++) {
    const u = (c - S.ox) * A, wc = c - S.ox + c0, r = h3(wc, 0, 7), wm = 0.5 * Math.pow(Math.max(0, 1 - Math.abs(u - lan) / 30), 2), wet = Math.abs(wc * A - (centre(1) - 2)) < 17;
    if (r < 0.8) G.plot(u, 0, -30, COL.ground, r < 0.66 ? '_' : '.', 0.55, 0, 0, wm);
    if (wet) { for (let v = -1; v >= -3; v--) if (h3(wc, v, Math.floor(T * 2)) < 0.6) G.plot(u, v, -30, COL.water, (wc + v + Math.floor(T * 1.3)) % 3 ? '~' : '-', 0.7 + 0.2 * Math.sin(T * 2 + wc), 0.1); continue; }
    if (h3(wc, 1, 7) < 0.16) G.plot(u, -1, -30, COL.ground, '.', 0.35, 0, 0, wm); if (h3(wc, 2, 7) < 0.07) G.plot(u, -2, -30, COL.ground, '.', 0.25, 0);
    const gr = h3(wc, 3, 7);
    if (gr < 0.12) { const n = 1 + ((h3(wc, 4, 7) * 3.4) | 0), lean = Flora.wind(u, T) + (h3(wc, 5, 7) - 0.5) * 2; for (let v = 1; v <= n; v++) G.plot(u + (v > 1 ? sign(lean) * A * (v - 1) * (Math.abs(lean) > 0.7 ? 1 : 0) : 0), v, gr < 0.04 ? 66 : -25, Sh.C.leaf[1 + (v > 1 ? 1 : 0)], Math.abs(lean) < 0.7 ? '|' : lean > 0 ? '/' : '\\', 0.6, 0, 0, wm); }
  }
  for (const m of W.mush) { const u = m.wx - camQ; if (Math.abs(u) < hu + 8) { Sh.mushroom(u, m.n, m.fl, T, 120 << 8); lights.push({ u, v: 3, r: 8 + 10 * m.fl, k: 0.6 + 0.4 * m.fl }); } }
  for (const f of W.flowers) { const u = f.wx - camQ; if (Math.abs(u) > hu + 30) continue; f.p.x = u; Flora.draw(f.p, T); if (f.wk > 0.02) lights.push({ u, v: f.top * 0.7, r: f.top * 1.05, k: f.wk }); }
  for (const o of W.clear) { const u = o.wx - camQ; if (o.p.g < 0.01 || Math.abs(u) > hu + 40) continue; o.p.x = u; Flora.draw(o.p, T); lights.push({ u, v: o.p.sp.H * o.p.scale * 0.7, r: o.p.sp.H * o.p.scale * 1.1, k: o.p.g }); }
  for (const c of W.cr) { const u = c.x - camQ; if (Math.abs(u) > hu + 30) continue; c.mouth = Sh.creature(c.kind, u, c, T, c.own); lights.push({ u, v: c.mouth.v - 2, r: c.mouth.r * 2.1, k: c.glad ? 0.95 : c.met ? 0.8 + 0.2 * c.sp : 0.3 }); }
  if (Math.abs(END - camQ) < hu + 30) { Sh.cauldron(END - camQ, T, voices.filter(v => v.in).map(v => v.col), fin ? 1 : 0.35, 95 << 8); lights.push({ u: END - camQ, v: 12, r: fin ? 60 + 70 * (voices.filter(v => v.in).length / 7) : 24, k: 0.9 }); }
  if (fin) voices.forEach((v, i) => { if (!v.in) return; for (let j = 0; j < 5; j++) { const k = (T * 0.16 + h3(i, j, 1)) % 1, x = END - camQ + (h3(i, j, 2) - 0.5) * 14 + Math.sin(T * 0.8 + i + j * 2) * (2 + 9 * k); G.plot(x, 17 + k * (top - 22), 28, v.col, k < 0.3 ? 'o' : k < 0.6 ? '*' : "'", (1 - k) * (0.6 + 0.4 * v.fl), 0.2 * v.fl); } });
  const lan2 = Sh.alchemist(wu, walker, T, 90 << 8);
  G.warm = { u: lan2.u, v: lan2.v - 4, r: 44, k: 0.4 }; lights.push({ u: lan2.u - walker.d * 3, v: lan2.v - 6, r: 66, k: 0.96 });
  if (walker.hum > 0.05) G.plot(wu + walker.d * 6, 29 + (1 - walker.hum) * 3, 70, Sh.C.eye, '~', walker.hum, 0);
  for (const v of voices) { if (v.in) continue; const u = v.x - camQ; G.plot(u, v.y, 72, v.col, v.fl > 0.3 ? '0' : 'o', 0.9, 0.25 + 0.75 * v.fl); if (v.fl > 0.2) for (const [a, b] of [[-A, 0], [A, 0], [0, 1], [0, -1]]) G.plot(u + a, v.y + b, 71, v.col, '.', v.fl, v.fl * 0.4); lights.push({ u, v: v.y, r: 5 + 5 * v.fl, k: 0.9 }); }
  for (const f of W.flies) { const a = Math.pow(Math.max(0, Math.sin(T * 1.3 + f.ph)), 2) * 0.9 + f.fl, u = f.px - camQ; if (a > 0.05) { G.plot(u, f.py, 50, COL.fly, a > 0.6 ? '*' : '.', Math.min(1, a), 0.3 * a); lights.push({ u, v: f.py, r: 5, k: Math.min(1, a) * 0.8 }); } }
  G.shade();
  const ctx = G.end(); darkness(ctx, open);
  // stars sit above the dark
  for (let i = 0; i < 80; i++) { const u = (h3(i, 1, 5) - 0.5) * 2 * hu, v = top * (0.34 + 0.66 * h3(i, 2, 5)); if (G.pick(u, v)) continue; const [x, y] = G.px(u, v); ctx.textAlign = 'center'; ctx.fillStyle = `rgba(223,232,255,${(0.16 + 0.34 * open) * (0.55 + 0.45 * Math.sin(T * (0.6 + h3(i, 3, 5)) + i))})`; ctx.fillText(h3(i, 4, 5) < 0.75 ? '.' : '+', x, y); }
  ui(ctx);
}
// the dark: everything is dim until a light reaches it (the lantern, a woken flower, a creature, the moon)
const mk = document.createElement('canvas'), mx = mk.getContext('2d');
function darkness(ctx, open) {
  const S = G.S, q = 1 / 6, w = Math.ceil(S.W * q), h = Math.ceil(S.H * q); if (mk.width !== w || mk.height !== h) { mk.width = w; mk.height = h; }
  mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, w, h); mx.fillStyle = `rgba(0,0,0,${0.8 - 0.3 * open})`; mx.fillRect(0, 0, w, h);
  mx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const p = G.px(L.u, L.v), x = p[0] * q, y = p[1] * q, r = L.r * S.cellH * q; if (x < -r || x > w + r) continue;
    const g = mx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${L.k})`); g.addColorStop(0.45, `rgba(0,0,0,${L.k * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = g; mx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const sky = mx.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, 'rgba(0,0,0,.5)'); sky.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = sky; mx.fillRect(0, 0, w, h * 0.5); // moonlight in the canopy
  mx.globalCompositeOperation = 'source-over';
  const wall = (gx, a) => { const x0 = G.px(gx - camQ - 8, 0)[0] * q, x1 = G.px(gx - camQ + 20, 0)[0] * q; if (x0 > w) return; const g = mx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); mx.fillStyle = g; mx.fillRect(x0, 0, w - x0 + 1, h); };
  if (st.ch < 5) wall(centre(st.ch) + 126, 1);
  if (gateFade) { const a = 1 - (T - gateFade.t0) / 5; if (a <= 0) gateFade = null; else wall(gateFade.x, a); }
  ctx.imageSmoothingEnabled = true; ctx.drawImage(mk, 0, 0, S.W, S.H);
}
function ui(ctx) {
  const S = G.S, ch = S.cellH, fs = Math.max(ch * 1.25, 11 * S.DPR), brackets =(px, py, bw, bh, al) => {
    const k = ch * 0.7; ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = Math.max(1, S.DPR * 0.75); ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const X = px + sx * bw, Y = py + sy * bh; ctx.moveTo(X - sx * k, Y); ctx.lineTo(X, Y); ctx.lineTo(X, Y - sy * k); }); ctx.stroke();
  };
  // the pick mark over the flower that sang last
  if (focus && !focus.picked && focus.ch === st.ch && focus.sleep < T && focus.heard) {
    const age = Math.max(0.3, T - focusT), al = demo ? 1 : age > 9 ? 0 : age > 7 ? (9 - age) / 2 : Math.min(1, age / 0.3);
    if (al > 0) { const [px, py] = G.px(focus.wx - camQ, -6); brackets(px, py, ch * 4.2, ch * 1.6, 0.55 * al); ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${0.8 * al})`; ctx.fillText('pick', px, py); }
  }
  if (press && press.hit && press.hit.type === 'flower' && !press.done) { // the long press fills a ring
    const k = clamp((clock() - press.t0 - 0.3) / 0.65, 0, 1); if (k > 0) { const [px, py] = G.px(press.u, press.v); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(2, S.DPR * 1.5); ctx.beginPath(); ctx.arc(px, py, ch * 3.4, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
  }
  if (mouse.on && !press) { // hover readout: names stay hidden until they are earned
    const h = hitTest(mouse.u, mouse.v), [px, py] = G.px(mouse.u, mouse.v); let a = null, b = '';
    if (h && h.type === 'flower') { const f = h.f; a = f.picked ? f.p.name.toLowerCase() : '· · · ·'; b = f.picked ? 'its voice is with you' : f.sleep > T ? 'closed for a while' : f.heard ? 'hold to pick' : 'click to listen'; }
    else if (h && h.type === 'creature' && h.c.met) { a = h.c.glad ? h.c.name : '· · · ·'; b = h.c.glad ? 'glad' : 'click to hear it again'; }
    else if (h && h.type === 'cauldron' && st.ch === 5 && !fin) { a = 'cauldron'; b = 'click'; }
    if (a) { brackets(px, py, ch * 3, ch * 2.2, 0.7); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText(a, px + ch * 4, py - fs * 0.65); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText(b, px + ch * 4, py + fs * 0.65); }
  }
  if (cap) {
    const k = T - cap.t0, al = k < 0.6 ? k / 0.6 : k > cap.dur ? 1 - (k - cap.dur) / 1.5 : 1;
    if (al <= 0 && k > 1) cap = null; else if (al > 0) { const x = ch * (S.portrait ? 2.5 : 4); ctx.textAlign = 'left'; ctx.fillStyle = `rgba(255,255,255,${0.72 * al})`; ctx.fillText(cap.a, x, S.H - fs * 3.6); ctx.fillStyle = `rgba(255,255,255,${0.4 * al})`; ctx.fillText(touch ? cap.b : cap.b.replace('tap it', 'click it'), x, S.H - fs * 2.1); }
  }
}
function frame(ms) {
  const now = ms / 1000, dt = Math.min(0.05, now - last || 0.016); last = now; T += dt;
  M.flush(); update(dt); draw(); requestAnimationFrame(frame);
}
load(); requestAnimationFrame(frame);
