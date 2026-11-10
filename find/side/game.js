'use strict';
// Finding Flowers. Walk the forest at night with a lantern and a notebook and find every flower.
// Hold left or right of the walker to walk (or arrows / A D). Tap things to touch them.
// B book, L lantern low/high, space = the offered action, M mute, shift+R start over.
// #demo=<x> jumps to a later night at world x for screenshots, #book opens the book.
const cv = document.getElementById('c');
G.init(cv, { rows: 124, cols: 190, portraitRows: 150, origin: [0.5, 0.8] });

// ───────── the flowers: where, which night they first open, and what they ask of you
const SPOTS = [
  { sp: 'daisy', x: 86, night: 1 }, { sp: 'bell', x: 232, night: 1 }, { sp: 'anemone', x: -126, night: 1 },
  { sp: 'tulip', x: 336, night: 2 }, { sp: 'poppy', x: 522, night: 2, cond: 'still' }, { sp: 'iris', x: -204, night: 2, cond: 'listen' },
  { sp: 'peony', x: 648, night: 3 }, { sp: 'snowdrop', x: 890, night: 3, cond: 'dark' }, { sp: 'lily', x: -74, night: 3 },
  { sp: 'foxglove', x: 1016, night: 4, cond: 'listen' }, { sp: 'dahlia', x: 772, night: 4, cond: 'still' },
  { sp: 'lotus', x: -236, night: 5, v: -7 }, { sp: 'sunflower', x: 1152, night: 5, cond: 'stars' }, { sp: 'moonflower', x: 1264, night: 6, cond: 'moon' }
];
const FALL = { tulip: 'bell', poppy: 'anemone', dahlia: 'peony', lotus: 'lily', sunflower: 'daisy', snowdrop: 'bell', foxglove: 'bell', moonflower: 'lily' };
const modelOf = sp => Flora.SPECIES[sp] ? sp : FALL[sp];
const HINT = { still: 'it is shy. it comes out when you stand still.', dark: 'it only shows when the lantern is low.', stars: 'it opens under stars. give it some.', moon: 'it waits for the moon to be woken.', listen: 'several buds look the same. one sings right.' };
const NEAR = { still: 'something here is shy. stand still a while.', dark: 'the lantern is too bright for something here.', stars: 'something here is waiting for stars above it.', moon: 'something here is waiting for the moon.' };
function pageOf(sp) {
  const d = SPOTS.find(s => s.sp === sp), pg = typeof PAGES !== 'undefined' && PAGES[sp] ? PAGES[sp] : { common: sp, latin: Flora.SPECIES[modelOf(sp)].name, lines: ['it was here the whole time.', 'you only had to come close.'] };
  return { common: pg.common, latin: pg.latin, lines: pg.lines, hint: HINT[d.cond] || pg.hint || 'it is open somewhere along the path.' };
}
// each flower's phrase. variant 1 and 2 are the look-alike buds: same notes, wrong shape
function motifOf(sp) {
  if (typeof VOICES !== 'undefined' && VOICES[sp]) return VOICES[sp].motif;
  const pat = Flora.SPECIES[modelOf(sp)].pat, out = []; pat.forEach((d, s) => { if (d >= 0) out.push({ s: s * 2, d }); }); return out;
}
function voicePlay(sp, t, midi, vel, pan) { if (typeof VOICES !== 'undefined' && VOICES[sp]) VOICES[sp].play(t, midi, vel, pan); else M.play('flower', t, midi, vel, pan); }
const regOf = sp => typeof VOICES !== 'undefined' && VOICES[sp] ? VOICES[sp].reg : Flora.SPECIES[modelOf(sp)].reg;
function motifPlay(sp, t0, vel, pn, variant) {
  if (!M.on) return 0; const mo = motifOf(sp), reg = regOf(sp), t1 = M.quant(t0 + 0.005), ds = mo.map(n => n.d), hi = Math.max(...ds), lo = Math.min(...ds); let last = 0;
  mo.forEach((n, i) => {
    const d = variant === 1 ? ds[ds.length - 1 - i] : variant === 2 ? hi + lo - n.d : n.d, s = variant === 2 ? Math.round(n.s * 0.75) : n.s, t = t1 + s * M.STEP;
    voicePlay(sp, t, M.fit(M.pent(reg + d), M.chAt(t)), vel * (i ? 0.85 : 1), pn); last = Math.max(last, s);
  });
  return (last + 4) * M.STEP;
}

// ───────── state
let met = {}, dust = [], night = 1, found = {}, stars = [], spots = [], band = [], T = 0, last = 0, started = false, ended = false, fade = 1, fadeTo = 0, sleeping = false;
const player = { x: 30, vx: 0, dir: 1, still: 0, frame: 0, walking: false, kneel: 0, look: 0 }, lantern = { dim: false };
const keys = {}, ptr = { down: false, x: 0, y: 0, t0: 0, sx: 0, sy: 0, btn: null };
let thought = null, thoughtCool = 0, lastHint = -99, visited = {};
const count = () => Object.keys(found).length;
const openTonight = () => SPOTS.filter(d => d.night <= night && !found[d.sp]).length;
function save() { if (location.hash.length > 1) return; try { localStorage.setItem('findingflowers.v1', JSON.stringify({ night, found, met, stars: stars.map(s => [s.wx, s.v, s.gx]) })); } catch (e) {} }
function load() { try { const d = JSON.parse(localStorage.getItem('findingflowers.v1')); if (d) { night = d.night || 1; found = d.found || {}; met = d.met || {}; stars = (d.stars || []).map(s => mkStar(s[0], s[1], s[2], 0)); } } catch (e) {} }
function mkStar(wx, v, gx, fl) { return { wx, v, gx, ph: rnd() * 6, sp: 0.5 + rnd() * 1.6, fl, ch: '+*.'[(rnd() * 3) | 0], midi: M.pent(10 + clamp((v / 9) | 0, 0, 9)) }; }
function say(text, force) { if (thought && !force && T - thought.t0 < 2) return; thought = { text, t0: T }; }
function scaleFor(model) { const sp = Flora.SPECIES[model]; return clamp(54 / (sp.H + 26), 0.45, 0.85) * (G.S.portrait ? 0.9 : 1); }
function mkPlant(s, k, dx) { const model = modelOf(s.def.sp); return Flora.make(model, { scale: scaleFor(model), id: 500 + s.i * 4 + k, yaw: (rnd() - 0.5) * 0.5, turn: 0.3, dx: dx || 0 }); }
function startNight(first) {
  buildWorld(); V.night = night; V.moonF = clamp(0.1 + (night - 1) * 0.16, 0.1, 1); V.moonAwake = false; V.homeLit = false; V.ML = 0; lantern.dim = false; visited = {};
  V.cut = SPOTS.filter(d => found[d.sp] && found[d.sp].kept === 'cut').map(d => bloomCol(d.sp));
  spots = SPOTS.map((def, i) => { const f = found[def.sp], s = { def, i, state: f ? (f.kept === 'cut' ? 'cut' : 'noted') : 'hidden', cal: false, plants: [], sel: -1, tru: 0 }; if (s.state === 'noted') { const p = mkPlant(s, 0); p.g = p.tg = 1; s.plants = [p]; } return s; });
  player.x = 30; player.vx = 0; player.dir = 1; V.cam = player.x; const k = openTonight();
  if (!first || started) say(count() === SPOTS.length ? `night ${night}. every page is full.` : `night ${night}. ${k} ${k === 1 ? 'flower is' : 'flowers are'} open tonight.`, true);
}
const bloomCol = sp => { const m = Flora.SPECIES[modelOf(sp)].mats; return G.col(m[Object.keys(m)[0]].ramp[2]); };
function keep(sp, k) { // after noting: cut it for the jar, or leave it growing
  found[sp].kept = k; const s = spots.find(s => s.def.sp === sp);
  if (k === 'cut') { s.state = 'cut'; s.plants.forEach(p => { p.tg = 0.12; }); V.cut.push(bloomCol(sp)); say('you cut it low and carry it. the jar at camp will hold it.', true); }
  else say('you leave it. it will be here tomorrow night too.', true);
  save(); if (count() === SPOTS.length) say('that was the last empty page. go back to the fire.', true);
}

// ───────── touching things
const MEET = { heron: 'a heron', owl: 'an owl', deer: 'a deer', frog: 'a frog', flies: 'fireflies', shroom: 'night mushrooms', menhir: 'the old stone', moon: 'the moon', boat: 'a boat nobody was in', line: 'paper lanterns' };
function wake(it, u, v, node) {
  const first = !it.awake; if (MEET[it.type] && !met[it.type]) { met[it.type] = night; save(); } it.flash = 1; let midi = M.pent(it.reg + ((v / 9) | 0)), voice = 'oak';
  switch (it.type) {
    case 'reed': it.awake = true; voice = 'reed'; for (let i = 1; i < 4; i++) M.play('reed', M.quant(M.now + i * M.STEP), M.fit(M.pent(it.reg + 5 + i * 2), M.chAt(M.now + i * M.STEP)), 0.5 - i * 0.1, pan(u)); break;
    case 'tree': it.awake = true; midi = M.pent(-3 + ((v / 8) | 0)); if (first) M.play('sub', M.quant(M.now), M.ROOT[M.chAt(M.now)], 0.9); break;
    case 'frog': if (first) { it.awake = true; it.t0 = T; M.sing('reed', M.pent(1), 0.6, pan(u)); } return;
    case 'flies': it.awake = true; it.t0 = T; voice = 'star'; midi = M.pent(14); for (let i = 1; i < 5; i++) M.play('star', M.quant(M.now + i * M.STEP / 2 * 3), M.pent(13 + i * 2), 0.4, pan(u) + (i & 1 ? 0.4 : -0.4)); break;
    case 'pad': if (first) it.t0 = T; it.awake = true; voice = 'drip'; midi = M.pent(it.reg); ripple(it.wx, it.v, 0.8); break;
    case 'heron': if (first) { it.awake = true; it.t0 = T; M.swell(M.now, pan(u), 0.06, 500, 1800, 2.6); M.sing('moon', M.pent(9), 0.9, pan(u)); ripple(it.wx, -2, 1); say('it was standing there the whole time.'); } return;
    case 'owl': it.awake = true; M.sing('glass', M.CHT[M.chAt(M.now)][1] - 12, 0.9, pan(u)); M.play('glass', M.quant(M.now + M.STEP * 3), M.CHT[M.chAt(M.now)][0] - 12, 0.7, pan(u)); return;
    case 'deer': it.awake = true; voice = 'tent'; midi = M.pent(6); M.play('tent', M.quant(M.now + M.STEP * 2), M.pent(8), 0.6, pan(u)); break;
    case 'line': { const i = node - 1; if (i < 0) return; it.on = it.on || []; it.awake = true; M.sing('tent', M.pent(5 + i), it.on[i] ? 0.6 : 0.9, pan(u)); if (!it.on[i]) { it.on[i] = true; M.echo('tent', M.pent(5 + i), pan(u)); } return; }
    case 'moon': it.awake = true; V.moonAwake = true; voice = 'moon'; midi = M.pent(12); if (first) say(V.moonF > 0.8 ? 'the moon is awake. everything is a little clearer.' : 'the moon answers, thin as it is.'); break;
    case 'camp': if (node === 1 || !V.homeLit) { if (!V.homeLit) { V.homeLit = true; it.awake = true; it.t0 = T; M.CHT[M.chAt(M.now + 1)].forEach((n, i) => M.play('tent', M.quant(M.now + 0.6 + i * M.STEP * 2), n + 12, 0.5, 0)); say('the fire takes. it is good to have somewhere to come back to.'); } M.sing('fire', M.pent(-4), 0.9, pan(u)); } return;
    case 'boat': M.sing('oak', M.pent(-1), 0.7, pan(u)); ripple(it.wx + 3, -3, 0.8); return;
    case 'shroom': it.awake = true; voice = 'glass'; midi = M.pent(it.reg + 5); break;
    case 'menhir': it.awake = true; if (first) { M.play('sub', M.quant(M.now), M.ROOT[M.chAt(M.now)], 1); say('the stone is warm. someone stood here before you.'); } voice = 'moon'; midi = M.pent(2); break;
    default: it.awake = true;
  }
  M.sing(voice, midi, 0.9, pan(u)); M.echo(voice === 'sub' ? 'oak' : voice, midi, pan(u));
}
function touchSpot(s, k, u, v, node) {
  const def = s.def, pn = pan(u);
  if (s.state === 'glim') {
    if (def.cond === 'listen') { s.state = 'buds'; s.tru = (rnd() * 3) | 0; s.plants = [-17, 0, 17].map((dx, j) => { const p = mkPlant(s, j, dx); p.tg = 0.44; p.var = j === s.tru ? 0 : j === (s.tru + 1) % 3 ? 1 : 2; return p; }); M.sing('flower', M.pent(6), 0.7, pn); say('three buds, all alike. tap one to hear it. only one sings right.', true); }
    else { s.state = 'grow'; const p = mkPlant(s, 0); p.tg = 0.07; s.plants = [p]; voicePlay(def.sp, M.quant(M.now), M.fit(M.pent(regOf(def.sp)), M.chAt(M.now)), 0.8, pn); if (!visited.grow) { visited.grow = 1; say('stay near. it grows while you are here.', true); } }
    return;
  }
  const p = s.plants[k]; if (!p) return;
  G.wave(u, v, { obj: p.id, life: 2.2 }); Flora.kick(p, u > p.x ? -1 : 1, T);
  if (s.state === 'buds') { if (p.dead) return; s.sel = k; motifPlay(def.sp, M.now, 0.85, pn, p.var); return; }
  if (s.state === 'grow') { p.tg = Math.min(1, p.tg + 0.09); voicePlay(def.sp, M.quant(M.now), M.fit(M.pent(regOf(def.sp) + (node * 3) % 7), M.chAt(M.now)), 0.8, pn); return; }
  motifPlay(def.sp, M.now, 0.8, pn, 0);
}
function choose(s) { // "this one"
  const p = s.plants[s.sel]; if (!p) return;
  if (s.sel === s.tru) { s.plants.forEach((q, j) => { if (j !== s.tru) { q.tg = 0; q.dead = true; } }); s.state = 'grow'; p.tg = 0.5; s.main = s.tru; if (typeof STEPS !== 'undefined') STEPS.found(M.now, pan(p.x)); else M.sing('flower', M.pent(9), 0.9, 0); say('yes. that is the one.', true); }
  else { p.tg = 0; p.dead = true; M.sing('oak', M.pent(-4), 0.6, pan(p.x)); say('not that one. listen again.', true); }
  s.sel = -1;
}
function note(s) { const def = s.def; found[def.sp] = { night, place: { 'the creek': 'by the creek', camp: 'by the camp', 'the glade': 'in the glade', 'under the willows': 'under the willows', 'the lantern path': 'on the lantern path', 'the hill': 'on the hill' }[placeAt(def.x)], kept: null }; s.state = 'noted'; save(); player.kneel = 3; Book.open(s.i, true); motifPlay(def.sp, M.now + 1.2, 0.7, 0, 0); }
function sleep() { if (sleeping) return; sleeping = true; fadeTo = 1; if (M.on) M.sing('moon', M.pent(7), 0.6, 0); setTimeout(() => { night++; save(); startNight(false); sleeping = false; fadeTo = 0; }, 2600); }
function tap(px, py) {
  const { u, v } = G.toUV({ clientX: px / G.S.DPR, clientY: py / G.S.DPR }), own = G.pick(u, v), wx = V.cam + u;
  for (const s of spots) if (s.state === 'glim' && Math.abs(s.def.x - wx) < 7 && v > (s.def.v || 0) - 4 && v < (s.def.v || 0) + 16) return touchSpot(s, 0, u, v, 0); // a generous target for small lights
  if (own) {
    const id = (own >> 8) - 1;
    if (id >= 500) { const s = spots[((id - 500) / 4) | 0]; if (s) return touchSpot(s, (id - 500) % 4, u, v, own & 255); }
    const it = items[id]; if (it) return wake(it, u, v, own & 255);
  }
  if (Math.abs(u - (player.x - V.cam)) < 5 && v > 0 && v < 9) { lantern.dim = !lantern.dim; M.sing('tent', M.pent(lantern.dim ? 2 : 5), 0.6, 0); return; }
  if (v < -1 && wx < SHORE) { ripple(wx, v, 1); M.sing('drip', M.pent(3 + ((u + 80) / 22 | 0)), 0.8, pan(u)); return; }
  if (v > 26) {
    for (const s of stars) if (Math.hypot(s.su - u, s.v - v) < 3) { s.fl = 1; M.sing('star', s.midi, 0.9, pan(u)); return; }
    const s = mkStar(u + V.cam * 0.06, Math.round(v), wx, 1); stars.push(s); if (stars.length > 160) stars.shift(); s.su = u;
    if (typeof STEPS !== 'undefined') STEPS.star(M.quant(M.now), M.fit(s.midi, M.chAt(M.now)), pan(u)); else M.sing('star', s.midi, 0.9, pan(u)); save();
  }
}
// pointer: a quick tap touches, a hold walks toward where you hold
cv.addEventListener('pointerdown', e => { e.preventDefault(); M.init(); const x = e.clientX * G.S.DPR, y = e.clientY * G.S.DPR; ptr.down = true; ptr.x = ptr.sx = x; ptr.y = ptr.sy = y; ptr.t0 = performance.now(); ptr.btn = UI.hit(x, y); });
cv.addEventListener('pointermove', e => { ptr.x = e.clientX * G.S.DPR; ptr.y = e.clientY * G.S.DPR; });
function up(e) {
  if (!ptr.down) return; ptr.down = false; const dt = performance.now() - ptr.t0, moved = Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy);
  if (ptr.btn) { const b = UI.hit(ptr.x, ptr.y); if (b === ptr.btn || (b && b.fn === ptr.btn.fn) || moved < 20 * G.S.DPR) ptr.btn.fn(); ptr.btn = null; return; }
  if (!started || Book.on || sleeping) return;
  if (dt < 320 && moved < 14 * G.S.DPR) tap(ptr.sx, ptr.sy);
}
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { ptr.down = false; ptr.btn = null; });
addEventListener('keydown', e => {
  if (e.key === 'R' && e.shiftKey) { try { localStorage.removeItem('findingflowers.v1'); } catch (x) {} location.hash = ''; location.reload(); return; }
  if (e.key === 'm') return M.mute(); M.init();
  if (UI.key(e.key)) { e.preventDefault(); return; }
  if (Book.on || !started) return;
  if (e.key === 'b') Book.open(Math.max(0, SPOTS.findIndex(d => !found[d.sp])), false);
  if (e.key === 'l') { lantern.dim = !lantern.dim; M.sing('tent', M.pent(lantern.dim ? 2 : 5), 0.6, 0); }
  keys[e.key] = true;
});
addEventListener('keyup', e => { keys[e.key] = false; });

// ───────── music: footsteps on the beat, and everything awake in view plays
M.onStep((step, bar, s, ch, t) => {
  if (Book.on) return; const hum = () => t + rnd() * 0.012;
  if (player.walking && s % 2 === 0) { const foot = (s >> 1) & 1; if (typeof STEPS !== 'undefined') STEPS.walk(t, foot, foot ? 0.12 : -0.12); else M.burst(t, 0.02, foot ? 0.1 : -0.1, 500, 0.05, 0.05, 'lowpass'); M.vis(t, () => { player.frame ^= 1; dust.push({ wx: player.x - player.dir, dir: player.dir, t0: T }); }); }
  let tree = false, fl = 0;
  for (const b of band) {
    const pn = pan(b.su);
    if (b.spot) { if (s === 0 && bar % 2 === 0 && fl < 4) { fl++; motifPlay(b.spot.def.sp, t, 0.34, pn, 0); const p = b.p; M.vis(t, () => { G.wave(p.x, p.y + p.sp.H * p.scale, { sp: 20, w: 2.5, a: 0.5, life: 0.9, obj: p.id }); Flora.kick(p, (rnd() - 0.5) * 0.4, T); }); } continue; }
    const it = b;
    if (it.type === 'tree' && !tree) { tree = true; if (s === 0) { M.play('sub', t, M.ROOT[ch], 0.8); M.vis(t, () => { it.flash = 0.6; }); } else if ((s === 6 || s === 11 || s === 14) && rnd() < 0.35) M.play('oak', hum(), M.CHT[ch][(rnd() * 4) | 0], 0.36, pn); }
    else if (it.type === 'reed') { if ((s + it.idx) % 8 === 3 && rnd() < 0.3) { M.play('reed', hum(), M.pent(it.reg + 5 + ((rnd() * 3) | 0) + M.SH[ch]), 0.28, pn); M.vis(t, () => { it.flash = 0.5; }); } }
    else if (it.type === 'pad') { if ((s + it.idx * 5) % 16 === 9 && rnd() < 0.4) { M.play('drip', hum(), M.pent(it.reg + M.SH[ch]), 0.3, pn); M.vis(t, () => ripple(it.wx, it.v, 0.5)); } }
    else if (it.type === 'line') { if (s === 0 || (s === 10 && bar % 2 === 0)) { const on = it.on ? it.on.filter(Boolean).length : 0; for (let i = 0; i < Math.min(3, on); i++) M.play('tent', hum() + i * 0.03, M.CHT[ch][(i + bar) % 4] + 12, 0.22, pn + (i - 1) * 0.3); } }
    else if (it.type === 'owl') { if (s === 8 && bar % 4 === 1) { M.play('glass', t, M.CHT[ch][1] - 12, 0.45, pn); M.play('glass', t + M.STEP * 3, M.CHT[ch][0] - 12, 0.36, pn); } }
    else if (it.type === 'flies') { if (rnd() < 0.1) M.play('star', hum(), M.pent(13 + ((rnd() * 7) | 0)), 0.2, pn + (rnd() - 0.5)); }
    else if (it.type === 'moon') { if (s === 0 && bar % 4 === 0) M.play('moon', t, M.CHT[ch][3] + 12, 0.5, 0.5); }
    else if (it.type === 'shroom') { if ((s + it.idx) % 16 === 4 && bar % 2 === 1 && rnd() < 0.6) M.play('glass', hum(), M.pent(it.reg + 5 + M.SH[ch]), 0.22, pn); }
    else if (it.type === 'menhir') { if (s === 0 && bar % 4 === 2) M.play('moon', t, M.ROOT[ch] + 24, 0.4, pn); }
    else if (it.type === 'camp' && V.homeLit) { if (s === 0 || s === 8) M.kick(t, 0.14); }
  }
});
M.onTick(now => { if (V.homeLit && Math.abs(player.x) < 120) for (let i = 0; i < 3; i++) if (rnd() < 0.3) M.burst(now + rnd() * 0.06, 0.07 * rnd() * rnd(), pan(-14 - V.cam) + (rnd() - 0.5) * 0.2, 900 + rnd() * 5200, 0.008 + rnd() * 0.035, 0.12); });

// ───────── the flowers in the world
function condMet(s, dist) {
  if (s.cal) return true; const c = s.def.cond; let ok = false;
  if (!c || c === 'listen') ok = true;
  else if (c === 'still') ok = player.still > 2.5 && dist < 75;
  else if (c === 'dark') ok = V.lampK < 0.4 && dist < 90;
  else if (c === 'stars') ok = stars.filter(st => Math.abs(st.gx - s.def.x) < 55).length >= 3;
  else if (c === 'moon') ok = V.moonAwake;
  if (ok) s.cal = true; return ok;
}
function drawSpots(dt, L0, R0) {
  let prompt = null;
  for (const s of spots) {
    const def = s.def, u = def.x - V.cam, dist = Math.abs(def.x - player.x), base = def.v || 0; if (u < L0 - 80 || u > R0 + 80) continue;
    const lf = lampFall(u), open = def.night <= night;
    if (s.state === 'hidden') {
      if (open && dist < 90 && condMet(s, dist)) { s.state = 'glim'; s.t0 = T; if (M.on) M.sing('star', M.pent(12), 0.5, pan(u)); if (!visited.glim && started) { visited.glim = 1; say('something small is shining on the ground. touch it.', true); } }
      else if (open && dist < 42 && NEAR[def.cond] && T - lastHint > 16) { lastHint = T; say(NEAR[def.cond]); }
    }
    if (s.state === 'glim') { // a breath of light on the ground, waiting to be touched
      const own = (500 + s.i * 4 + 1) << 8, a = 0.55 + 0.45 * Math.sin(T * 3);
      G.plot(u, base + 1, -40, COL.white, '*', a, 0.3, own); G.plot(u - A, base + 1, -40, COL.star, '.', a * 0.7, 0, own); G.plot(u + A, base + 1, -40, COL.star, '.', a * 0.7, 0, own); G.plot(u, base + 2, -40, COL.star, "'", a * 0.6, 0, own);
      for (let i = 0; i < 5; i++) { const k = ((T * 0.35 + i * 0.2) % 1); G.plot(u + Math.sin(i * 2.1 + T) * 3 * k, base + 2 + k * 12, -40, COL.star, '.', (1 - k) * 0.6, 0, own); }
      continue;
    }
    for (const p of s.plants) {
      if (s.state === 'grow' && !p.dead && dist < 85) p.tg = Math.min(1, p.tg + dt / 22);
      p.g += (p.tg - p.g) * (1 - Math.exp(-dt * 0.9)); if (p.g < 0.01) continue;
      p.x = u + p.dx; p.y = base; p.z = -50 - s.i; (G.lit = G.lit || [])[p.id + 1] = s.state === 'noted' || s.state === 'bloom' ? 1 : s.state === 'buds' ? 0.6 + 0.35 * lf : clamp(0.55 + 0.45 * Math.max(lf, p.g), 0, 1);
      Flora.draw(p, T);
    }
    const main = s.plants[s.main || 0];
    if (s.state === 'grow' && main && main.g > 0.985) { s.state = 'bloom'; motifPlay(def.sp, M.now, 0.9, pan(u), 0); if (typeof STEPS !== 'undefined' && M.on) STEPS.found(M.now, pan(u)); G.wave(u, base + 30, { obj: main.id, life: 3, sp: 26 }); say('it is open. write it down before you forget how it looks.', true); }
    if ((s.state === 'bloom' || s.state === 'noted') && main && u > L0 && u < R0) band.push({ spot: s, p: main, su: u });
    if (dist < 48) { if (s.state === 'bloom') prompt = { label: 'note it down', fn: () => note(s) }; else if (s.state === 'buds') prompt = s.sel >= 0 ? { label: 'this one', fn: () => choose(s), alt: { label: 'hum it', fn: () => motifPlay(def.sp, M.now, 0.8, 0, 0) } } : { label: 'hum it', fn: () => motifPlay(def.sp, M.now, 0.8, 0, 0) }; }
    if (s.state === 'buds' && s.sel >= 0) { const p = s.plants[s.sel]; G.plot(p.x, 0.5, 5, COL.white, '^', 0.6 + 0.3 * Math.sin(T * 4)); }
  }
  return prompt;
}
function drawPlayer(pu) {
  const bobv = player.walking ? (player.frame ? 0.3 : 0) : Math.sin(T * 1.6) * 0.12, kneel = player.kneel > 0, z = 10, w = 0.32 * V.lampK + 0.1;
  const rows = kneel ? [' _ ', '(o)', '/|\\', '/_\\'] : [' _ ', '(o)', '/|\\', '/_\\', player.walking ? (player.frame ? '/ \\' : ' | ') : '/ \\'];
  rows.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] !== ' ') G.plot(pu + (i - 1) * A, (kneel ? 4 : 5) - j + bobv, z, COL.cloak, r[i], 0.95, 0, 0, w); });
  for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i], k = (T - d.t0) / 0.9; if (k > 1) { dust.splice(i, 1); continue; } G.plot(d.wx - V.cam - d.dir * k * 1.5, 0.6 + k * 1.6, z - 1, COL.ground, '.', (1 - k) * 0.5); }
  const d = player.dir, sw = Math.sin(T * (player.walking ? 5.2 : 1.4)) * (player.walking ? 0.35 : 0.12), lu = pu + d * 2.6 + sw * d, lv = (kneel ? 3 : 4.6) + bobv - Math.abs(sw) * 0.4;
  G.plot(pu + d * 1.5, (kneel ? 3.4 : 4.6) + bobv, z, COL.wood, d > 0 ? '/' : '\\', 0.7, 0, 0, w);
  const k = V.lampK, fl = 0.85 + 0.15 * vnoise(T * 6, 4);
  G.plot(lu, lv, z + 1, COL.amber, k > 0.5 ? '@' : 'o', (0.35 + 0.65 * k) * fl, 0.4 * k); if (k > 0.5) { G.plot(lu - A, lv, z + 1, COL.warm, '(', fl * 0.7 * k); G.plot(lu + A, lv, z + 1, COL.warm, ')', fl * 0.7 * k); G.plot(lu, lv + 1, z + 1, COL.warm, "'", fl * 0.5 * k); }
  V.lampU = lu; V.lampV = lv;
}

// ───────── frame
function frame(ms) {
  const now = ms / 1000, dt = Math.min(0.05, now - last || 0.016); last = now; T = V.T = now; M.flush();
  fade += (fadeTo - fade) * (1 - Math.exp(-dt * 2.2));
  if (Book.on) { Book.draw(T, dt); hud(G.S, true); if (!SIM) requestAnimationFrame(frame); return; }
  const S = G.S, L0 = -S.ox * A, R0 = (S.COLS - S.ox) * A;
  // walking: keys, or hold the pointer to one side of the walker
  let want = 0, pace = 1; if (started && !sleeping) { if (keys.ArrowLeft || keys.a) want = -1; if (keys.ArrowRight || keys.d) want = 1; if (keys.Shift) pace = 1.35; if (ptr.down && !ptr.btn && performance.now() - ptr.t0 > 200) { const hu = (ptr.x / S.cellW - S.ox) * A - (player.x - V.cam); if (Math.abs(hu) > 4) { want = hu > 0 ? 1 : -1; pace = clamp(Math.abs(hu) / (S.halfU * 0.6), 0.6, 1.35); } } }
  if (player.kneel > 0) { player.kneel -= dt; want = 0; }
  V.pu = player.x - V.cam; V.pv = player.vx;
  player.vx += (want * 8.6 * pace - player.vx) * (1 - Math.exp(-dt * (want ? 4 : 7))); if (Math.abs(player.vx) < 0.05) player.vx = 0;
  player.x = clamp(player.x + player.vx * dt, WEST + 6, EAST - 8); if (want) player.dir = want; player.walking = Math.abs(player.vx) > 1.2;
  if (player.walking && !M.on) player.frame = ((player.x / 2.2) | 0) & 1;
  player.still = player.walking ? 0 : player.still + dt; V.calm += ((player.still > 3 ? 1 : 0) - V.calm) * (1 - Math.exp(-dt * 0.5));
  V.lampK += ((lantern.dim ? 0.14 : 1) - V.lampK) * (1 - Math.exp(-dt * 3));
  player.look += ((player.walking ? player.dir * 15 : 0) - player.look) * (1 - Math.exp(-dt * 0.9));
  let fx = player.x + player.look; { let bd = 60; for (const s of spots) if (s.plants.length && s.state !== 'cut' && s.state !== 'noted') { const d = Math.abs(s.def.x - player.x); if (d < bd) { bd = d; fx = player.x + (s.def.x - player.x) * 0.62; } } }
  V.cam += (fx - V.cam) * (1 - Math.exp(-dt * 2.2));
  // thoughts while standing still
  thoughtCool -= dt; if (started && player.still > 5 && thoughtCool < 0 && !thought) { thoughtCool = 26; const pool = typeof THOUGHTS !== 'undefined' ? THOUGHTS : ['the dark is not empty. it is only quiet.', 'you breathe out, and the lantern steadies.', 'nothing here is in a hurry.']; say(pool[(rnd() * pool.length) | 0]); }
  const pl = placeAt(player.x); if (started && !visited[pl]) { visited[pl] = 1; if (pl !== 'camp') say(pl + '.'); }

  G.begin(T); G.tickWaves(0); G.lit = []; G.warm = { u: V.lampU, v: V.lampV, r: 58 + 24 * V.calm, k: (0.4 + 0.08 * vnoise(T * 5, 2)) * V.lampK };
  drawSky(stars, dt, L0, R0); band = drawItems(dt, L0, R0); const prompt = drawSpots(dt, L0, R0); drawPlayer(player.x - V.cam);
  band.sort((a, b) => Math.abs(a.su - V.lampU) - Math.abs(b.su - V.lampU));
  G.shade(); if (V.cam + L0 < SHORE) G.reflect(-1, Math.min(24, S.ROWS - S.oy - 2), 0.42, L0, Math.min(R0, SHORE - V.cam)); drawGround(L0, R0);
  M.bed.pad = clamp(0.22 + 0.4 * V.calm + band.length * 0.07 + count() * 0.015, 0, 1); M.bed.air = V.ML; M.bed.rumble = V.homeLit && Math.abs(player.x) < 120 ? 0.6 : 0; M.bed.water = clamp(1 - (player.x - SHORE) / 160, 0.12, 1);
  G.end(); hud(S, false, prompt);
  if (!SIM) requestAnimationFrame(frame);
}
function hud(S, inBook, prompt) {
  const ctx = cv.getContext('2d'); if (!inBook) UI.begin(ctx); const fs = UI.fs, m = fs * 1.3, W = S.W, H = S.H;
  if (!inBook && started) {
    UI.text(`night ${night}`, m, m + fs * 0.6, 0.6); UI.text(`${String(count()).padStart(2, '0')} / ${SPOTS.length} found`, m, m + fs * 2.3, 0.4); { const k = openTonight(); UI.text(k ? `${k} open tonight` : 'nothing more tonight', m, m + fs * 4, 0.4); }
    UI.btn('book', W - m, m, () => Book.open(Math.max(0, SPOTS.findIndex(d => !found[d.sp])), false), 'r', 0.8, 'b');
    UI.btn(lantern.dim ? 'lantern up' : 'lantern low', W - m, m + UI.bh + fs * 0.6, () => { lantern.dim = !lantern.dim; M.init(); M.sing('tent', M.pent(lantern.dim ? 2 : 5), 0.6, 0); }, 'r', 0.55);
    // the one thing you can do here
    const atCamp = Math.abs(player.x - 14) < 26;
    const tonight = Object.values(found).filter(f => f.night === night).length;
    if (!prompt && atCamp && !sleeping && (tonight > 0 || openTonight() === 0)) prompt = count() === SPOTS.length && !ended ? { label: 'play the whole book', fn: () => { ended = true; Book.open(0, false); Book.whole(); } } : { label: 'sleep until the next night', fn: sleep };
    if (prompt) { const y = H - m - UI.bh * 2.4 - (S.portrait ? fs * 1.5 : 0); if (prompt.alt) { const w = UI.width(prompt.label) + fs * 1.8; UI.btn(prompt.label, W / 2 - fs * 0.4, y, prompt.fn, 'r', 1, ' '); UI.btn(prompt.alt.label, W / 2 + fs * 0.4, y, prompt.alt.fn, 'l', 1, 'h'); } else UI.btn(prompt.label, W / 2, y, prompt.fn, 'c', 1, ' '); }
    if (thought) { // thinking, typed out
      const k = T - thought.t0, n = Math.floor(k * 30), full = thought.text.length, hold = full / 30 + 4.5, al = k > hold ? 1 - (k - hold) / 1.2 : 1;
      if (al <= 0) thought = null; else { // one line, or two when the screen is narrow
        const tx = thought.text, wide = UI.width(tx) + fs * 1.8; let l1 = tx, l2 = '';
        if (wide > W - m * 2) { let cut = tx.lastIndexOf(' ', Math.ceil(full * 0.55)); if (cut < 0) cut = full; l1 = tx.slice(0, cut); l2 = tx.slice(cut + 1); }
        const w = Math.max(UI.width(l1), UI.width(l2)) + fs * 1.8, h = l2 ? UI.bh + fs * 1.5 : UI.bh, y = H - m - h; UI.box(m, y, w, h, al);
        UI.text(l1.slice(0, n) + (n < l1.length ? '_' : ''), m + fs * 0.9, y + UI.bh / 2 + 1, 0.85 * al); if (l2 && n > l1.length) UI.text(l2.slice(0, n - l1.length - 1) + (n < full ? '_' : ''), m + fs * 0.9, y + UI.bh / 2 + 1 + fs * 1.5, 0.85 * al);
      }
    }
  }
  if (!started) { // title
    const w = Math.min(W - m * 2, fs * 30), h = fs * 13, x = (W - w) / 2, y = (H - h) / 2; UI.box(x, y, w, h, 1, 0.82);
    UI.text('F I N D I N G   F L O W E R S', W / 2, y + fs * 2.6, 0.95, 'center'); UI.text('a night walk with a lantern and a notebook', W / 2, y + fs * 4.8, 0.5, 'center');
    UI.text('hold left or right to walk  ·  tap to touch', W / 2, y + fs * 7, 0.6, 'center');
    UI.btn(count() ? 'go on' : 'begin', W / 2, y + h - UI.bh - fs * 1.2, () => { M.init(); started = true; const k = openTonight(); say(`night ${night}. ${k} ${k === 1 ? 'flower is' : 'flowers are'} open tonight.`, true); }, 'c', 1, ' ');
  }
  if (fade > 0.01) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); if (sleeping && fade > 0.7) { const al = (fade - 0.7) / 0.3, k = Object.values(found).filter(f => f.night === night).length; UI.text(`night ${night + 1}`, W / 2, H / 2 - fs, al * 0.85, 'center'); UI.text(k ? `${k} ${k === 1 ? 'page' : 'pages'} written tonight` : 'you slept. that is allowed.', W / 2, H / 2 + fs * 1.2, al * 0.45, 'center'); } }
}
if (location.hash.length < 2) load();
{ const m = location.hash.match(/^#demo(?:=(-?\d+))?/); if (m) { night = 5; SPOTS.slice(0, 9).forEach((d, i) => { found[d.sp] = { night: d.night, place: 'by the creek', kept: i % 3 ? 'left' : 'cut' }; }); started = true; startNight(true); player.x = +(m[1] || 640); V.cam = player.x; V.homeLit = true; items.forEach(it => { it.awake = true; it.lit = 1; if (it.type === 'line') it.on = Array(9).fill(true); }); V.moonAwake = true; spots.forEach(s => { if (s.state === 'hidden' && s.def.night <= night) { s.state = 'grow'; const p = mkPlant(s, 0); p.g = p.tg = 0.9; s.plants = [p]; } }); fade = 0; } else startNight(true); }
{ const m = location.hash.match(/^#t=(\w+)/); if (m) { // staged moments for screenshots
  started = true; fade = 0; const at = (sp, st, g) => { const s = spots.find(s => s.def.sp === sp); night = Math.max(night, s.def.night); player.x = s.def.x - 16; V.cam = player.x; s.state = st; if (st === 'buds') { s.tru = 1; s.sel = 1; s.plants = [-17, 0, 17].map((dx, j) => { const p = mkPlant(s, j, dx); p.g = p.tg = 0.44; p.var = j; return p; }); } else if (st !== 'glim') { const p = mkPlant(s, 0); p.g = p.tg = g; s.plants = [p]; } };
  if (m[1] === 'grow') at('daisy', 'grow', 0.6); if (m[1] === 'bloom') at('bell', 'bloom', 1); if (m[1] === 'glim') at('anemone', 'glim'); if (m[1] === 'buds') at('iris', 'buds'); if (m[1] === 'peony') at('peony', 'bloom', 1); say('stay near. it grows while you are here.', true);
} }
// #auto plays the whole game by itself, stepping frames by hand, to prove every path runs (prints AUTO lines)
let SIM = false;
if (location.hash.startsWith('#auto')) {
  SIM = true; started = true; fade = 0; let bad = 0, ts = 1000; const step = k => { for (let i = 0; i < k; i++) frame(ts += 16.7); };
  try {
    step(3);
    for (let n = 1; n <= 7 && count() < SPOTS.length; n++) {
      for (const s of spots.filter(s => s.def.night <= night && !found[s.def.sp])) {
        player.x = s.def.x - 10; V.cam = player.x; s.cal = true; step(4);
        if (s.state !== 'glim') { console.log('AUTO no glimmer', s.def.sp, s.state); bad++; continue; }
        tap(((s.def.x - V.cam) / A + G.S.ox + 0.5) * G.S.cellW, (G.S.oy - 3 - (s.def.v || 0)) * G.S.cellH); step(3);
        if (s.state === 'buds') { touchSpot(s, (s.tru + 1) % 3, 0, 5, 3); s.sel = (s.tru + 1) % 3; choose(s); step(2); touchSpot(s, s.tru, 0, 5, 3); s.sel = s.tru; choose(s); }
        if (s.state !== 'grow') { console.log('AUTO not growing', s.def.sp, s.state); bad++; continue; }
        step(2); touchSpot(s, s.main || 0, 0, 5, 4); s.plants.forEach(p => { if (!p.dead) { p.tg = 1; p.g = 0.99; } }); step(3);
        if (s.state !== 'bloom') { console.log('AUTO no bloom', s.def.sp, s.state); bad++; continue; }
        touchSpot(s, s.main || 0, 0, 5, 4); note(s); step(3); Book.writing = false; Book.choice = true; step(1); Book.decide(n % 2 ? 'cut' : 'left'); Book.play(); Book.flip(1); step(1); Book.flip(-1); Book.close(); step(2);
      }
      items.forEach(it => wake(it, it.wx - V.cam, 5, 1)); lantern.dim = !lantern.dim; tap(G.S.W * 0.3, G.S.H * 0.1); tap(G.S.W * 0.1, G.S.H * 0.95); player.x = 14; keys.ArrowRight = true; step(20); keys.ArrowRight = false; step(4);
      night++; startNight(false); step(3);
    }
    Book.open(Book.pages - 1, false); step(2); Book.flip(1); Book.whole(); step(3); Book.close();
    console.log('AUTO done found=' + count() + ' night=' + night + ' bad=' + bad + ' met=' + Object.keys(met).length + ' cut=' + V.cut.length);
  } catch (e) { console.log('AUTO crash ' + e.stack); }
  SIM = false; last = 0;
}
if (location.hash === '#book') { found.daisy = { night: 1, place: 'by the camp', kept: 'left' }; started = true; fade = 0; Book.open(0, false); }
requestAnimationFrame(frame);
