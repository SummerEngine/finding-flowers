'use strict';
// Finding Flowers. You walk a dark forest at night with a notebook, in first person, and try to find every
// flower. There is no body on screen and no lamp: it is dark, and things light up. Your steps send a soft
// wave of light over the ground, and whatever you touch wakes and stays lit.
//
// Desktop: click to enter (the mouse is captured), move the mouse to look, W A S D to walk, click to touch
// what is at the centre mark, Esc frees the mouse. Keys: space = the offered action, B book, F where?, Q stand up,
// M mute, shift+R start over. Touch: drag to look, hold still to walk, tap to touch, tap the ground to walk there.
// #demo=x,z,yaw jumps there with things awake; #dark=x,z,yaw the same in the dark.
const cv = document.getElementById('c');
G.init(cv, { rows: 124, cols: 190, portraitRows: 150, origin: [0.5, 0.5] });

// ───────── the flowers: where, which night they first open, and what they ask of you
const SPOTS = [
  { sp: 'peony', x: 0, z: 0, night: 1, home: 1 }, // the first flower: you open it yourself, and it is home
  { sp: 'daisy', x: 250, z: -420, night: 1 }, { sp: 'bell', x: -300, z: -1150, night: 1 }, { sp: 'anemone', x: -1740, z: -320, night: 1 },
  { sp: 'tulip', x: 360, z: -1450, night: 2 }, { sp: 'poppy', x: -980, z: -1820, night: 2, cond: 'still' }, { sp: 'iris', x: -1790, z: -1250, night: 2, cond: 'listen' },
  { sp: 'snowdrop', x: 1220, z: 430, night: 3, cond: 'sky' }, { sp: 'lily', x: -1770, z: 520, night: 3 },
  { sp: 'foxglove', x: 2280, z: 120, night: 4, cond: 'listen' }, { sp: 'dahlia', x: 1720, z: -170, night: 4, cond: 'still' },
  { sp: 'lotus', x: -1965, z: -720, night: 5 }, { sp: 'sunflower', x: 2720, z: -300, night: 5, cond: 'stars' }, { sp: 'moonflower', x: 2920, z: -920, night: 6, cond: 'moon' }
];
const FALL = { tulip: 'bell', poppy: 'anemone', dahlia: 'peony', lotus: 'lily', sunflower: 'daisy', snowdrop: 'bell', foxglove: 'bell', moonflower: 'lily' };
const modelOf = sp => Flora.SPECIES[sp] ? sp : FALL[sp];
const HINT = { still: 'it is shy. it comes out when you stand still.', sky: 'it opens when no one is looking. look up a while.', stars: 'it opens under stars. give it some.', moon: 'it waits for the moon to be woken.', listen: 'several buds look the same. one sings right.' };
const NEAR_HINT = { still: 'something here is shy. stand still a while.', sky: 'something here will not open while i watch the ground.', stars: 'something here is waiting for stars above it.', moon: 'something here is waiting for the moon.' };
const WHERE = { 'the creek': 'by the creek', camp: 'at home', 'the glade': 'in the glade', 'under the willows': 'under the willows', 'the lantern path': 'on the lantern path', 'the hill': 'on the hill' };
function pageOf(sp) {
  const d = SPOTS.find(s => s.sp === sp), pg = typeof PAGES !== 'undefined' && PAGES[sp] ? PAGES[sp] : { common: sp, latin: Flora.SPECIES[modelOf(sp)].name, lines: ['it was here the whole time.', 'you only had to come close.'] };
  return { common: pg.common, latin: pg.latin, lines: pg.lines, hint: [(pg.hint || 'it is open somewhere').replace(/\.$/, '') + '.', HINT[d.cond], 'it grows ' + WHERE[placeAt(d.x, d.z)] + '.'].filter(Boolean) };
}
// each flower's phrase. variants 1 and 2 are the look-alike buds: same notes, wrong shape
function motifOf(sp) {
  if (typeof VOICES !== 'undefined' && VOICES[sp]) return VOICES[sp].motif;
  const pat = Flora.SPECIES[modelOf(sp)].pat, out = []; pat.forEach((d, s) => { if (d >= 0) out.push({ s: s * 2, d }); }); return out;
}
function voicePlay(sp, t, midi, vel, pn, len) { if (typeof VOICES !== 'undefined' && VOICES[sp]) VOICES[sp].play(t, midi, vel, pn, len); else M.play('flower', t, midi, vel, pn); }
const regOf = sp => typeof VOICES !== 'undefined' && VOICES[sp] ? VOICES[sp].reg : Flora.SPECIES[modelOf(sp)].reg;
function motifPlay(sp, t0, vel, pn, variant, inScore) {
  if (!M.on) return 0; const mo = motifOf(sp), reg = regOf(sp), t1 = M.quant(t0 + 0.005), ds = mo.map(n => n.d), hi = Math.max(...ds), lo = Math.min(...ds), s0 = inScore ? 0 : Math.min(...mo.map(n => n.s)); let last = 0;
  mo.forEach((n, i) => {
    const d = variant === 1 ? ds[ds.length - 1 - i] : variant === 2 ? hi + lo - n.d : n.d, s = variant === 2 ? Math.round((n.s - s0) * 0.75) : n.s - s0, t = t1 + s * M.STEP;
    voicePlay(sp, t, M.fit(M.pent(reg + d), M.chAt(t)), vel * (i ? 0.85 : 1), pn, n.len); last = Math.max(last, s);
  });
  return (last + 4) * M.STEP;
}

// ───────── state
let met = {}, night = 1, found = {}, stars = [], spots = [], band = [], T = 0, last = 0, started = false, ended = false, fade = 1, fadeTo = 0, sleeping = false;
const player = { x: 0, z: 150, yaw: 0, vf: 0, still: 0, walking: false, phase: 0, eye: EYE };
const FID = 5000; // flower ids start here, above every scenery item
let mode = 'walk', kneel = null, goal = null, mark = null, idle = 0, moved = false;
const keys = {}, ptr = { down: false, x: 0, y: 0, lx: 0, ly: 0, t0: 0, sx: 0, sy: 0, btn: null, mode: null, mouse: !(window.matchMedia && matchMedia('(pointer: coarse)').matches) };
let stageLights = null, locked = false, skyT = 0, aim = 0, stepD = 0, tiltT = 0, intro = null, tut = 3, coach = null, lookSum = 0, walkSum = 0, guideFx = null, seenIntro = false;
let thought = null, thoughtCool = 0, lastHint = -99, visited = {};
const count = () => Object.keys(found).length, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const openTonight = () => SPOTS.filter(d => d.night <= night && !found[d.sp]).length;
function save() { if (location.hash.length > 1) return; try { localStorage.setItem('findingflowers.v2', JSON.stringify({ night, found, met, stars: stars.filter(s => s.mine).map(s => [s.az, s.el, s.gx, s.gz]) })); } catch (e) {} }
function load() { try { const d = JSON.parse(localStorage.getItem('findingflowers.v2')); if (d) { night = d.night || 1; found = d.found || {}; met = d.met || {}; (d.stars || []).forEach(s => stars.push(mkStar(s[0], s[1], s[2], s[3], 0, true))); } } catch (e) {} }
function mkStar(az, el, gx, gz, fl, mine) { return { az, el, gx, gz, mine, ph: rnd() * 6, sp: 0.5 + rnd() * 1.6, fl, ch: mine ? '+*'[(rnd() * 2) | 0] : '.', midi: M.pent(10 + clamp((el * 9) | 0, 0, 9)), su: 1e9, sv: 0 }; }
function say(text, force) { if (thought && !force && T - thought.t0 < 2) return; thought = { text, t0: T, note: !!force }; }
const bloomCol = sp => { const m = Flora.SPECIES[modelOf(sp)].mats; return G.col(m[Object.keys(m)[0]].ramp[2]); };
function mkPlant(s, k, x, z) { const model = modelOf(s.def.sp); return Flora.make(model, { scale: 1.15, id: FID + s.i * 4 + k, yaw: (rnd() - 0.5) * 0.5, turn: 0.3, x, y: 0, z }); }
function startNight(first) {
  buildWorld(SPOTS); V.night = night; V.moonF = clamp(0.1 + (night - 1) * 0.16, 0.1, 1); V.moonAwake = false; V.homeLit = false; V.fireK = 0; V.ML = 0; visited = {}; pulses = []; skyT = 0;
  V.cut = SPOTS.filter(d => found[d.sp] && found[d.sp].kept === 'cut').map(d => bloomCol(d.sp));
  items.forEach(it => { if (ARRIVES[it.type] > night) { it.hidden = true; if (it.solid) { const i = solids.indexOf(it.solid); if (i >= 0) solids.splice(i, 1); } } });
  if (NIGHT_NOTE[night] && (!first || started)) setTimeout(() => { if (!Book.on) say(NIGHT_NOTE[night], true); }, 9000);
  solids.push({ x: 0, z: 0, r: 42 });
  spots = SPOTS.map((def, i) => { const f = found[def.sp], s = { def, i, state: f ? (f.kept === 'cut' ? 'cut' : 'noted') : 'hidden', cal: false, plants: [], sel: -1, tru: 0, d: 9e9, su: 0, sv: 0, vis: false }; if (s.state === 'noted') { const p = mkPlant(s, 0, def.x, def.z); p.g = p.tg = 1; s.plants = [p]; } return s; });
  player.x = 0; player.z = 430; player.yaw = 0; player.vf = 0; player.eye = EYE; mode = 'walk'; kneel = null; goal = null; const k = openTonight();
  if (!first || started) say(count() === SPOTS.length ? `night ${night}. every page is full.` : `night ${night}. ${k} ${k === 1 ? 'flower is' : 'flowers are'} open tonight.`, true);
}
function keep(sp, k) { // after noting: cut it for the jar, or leave it growing
  found[sp].kept = k; const s = spots.find(s => s.def.sp === sp);
  if (k === 'cut') { s.state = 'cut'; s.plants.forEach(p => { p.tg = 0.1; }); V.cut.push(bloomCol(sp)); say('i cut it low and carry it. it will rest beside the first flower.', true); standUp(); }
  else say('i leave it. it will be here tomorrow night too.', true);
  save(); if (count() === SPOTS.length) say('that was the last empty page. home.', true); else setTimeout(() => { if (!Book.on) guide(true); }, 3500);
}

// each leaf mass of a waking tree opens with a low wooden note and a small ring of light
function treeNote(it, i) { pulse(it.x, it.z, 0.45, 480, 620); if (!M.on || it.d > 1700) return; const t = M.quant(M.now); M.play('oak', t, M.fit(M.pent(-3 + i * 2), M.chAt(t)), 0.42 * clamp(1.2 - it.d / 1700, 0.12, 1), pan(it.su)); }
// ───────── touching things
const MEET = { heron: 'a heron', owl: 'an owl', deer: 'a deer', frog: 'a frog', flies: 'fireflies', shroom: 'night mushrooms', menhir: 'the old stone', moon: 'the moon', boat: 'a boat nobody was in', lamp: 'paper lanterns' };
if (typeof CREATURE !== 'undefined') for (const k in CREATURE) MEET[k] = CREATURE[k].name;
function wake(it, u, v, node) {
  if (typeof CREATURE !== 'undefined' && CREATURE[it.type]) { if (!met[it.type]) { met[it.type] = night; save(); } it.flash = 1; pulse(it.x, it.z, 0.6, 620, 900); CREATURE[it.type].wake(it, clamp(1.25 - it.d / 2600, 0.35, 1), pan(u)); return; }
  const first = !it.awake, pn = pan(u), near = clamp(1.25 - it.d / 2600, 0.35, 1); if (MEET[it.type] && !met[it.type]) { met[it.type] = night; save(); }
  it.flash = 1; pulse(it.x, it.z, 0.6, 620, 900); let midi = M.pent(it.reg + ((v / 9) | 0)), voice = 'oak';
  switch (it.type) {
    case 'reed': it.awake = true; voice = 'reed'; for (let i = 1; i < 4; i++) M.play('reed', M.quant(M.now + i * M.STEP), M.fit(M.pent(it.reg + 5 + i * 2), M.chAt(M.now + i * M.STEP)), (0.5 - i * 0.1) * near, pn); break;
    case 'tree': it.awake = true; midi = M.pent(-3 + clamp((v / 8) | 0, 0, 6)); if (first) M.play('sub', M.quant(M.now), M.ROOT[M.chAt(M.now)], 0.9 * near); break;
    case 'frog': if (first) { it.awake = true; it.t0 = T; M.sing('reed', M.pent(1), 0.6 * near, pn); if (it.x < CR1 + 120) setTimeout(() => { ripple(it.x - 60, it.z, 1); M.sing('drip', M.pent(-3), 0.8 * near, pn); }, 650); } return;
    case 'flies': it.awake = true; it.t0 = T; voice = 'star'; midi = M.pent(14); for (let i = 1; i < 5; i++) M.play('star', M.quant(M.now + i * M.STEP / 2 * 3), M.pent(13 + i * 2), 0.4 * near, pn + (i & 1 ? 0.4 : -0.4)); break;
    case 'pad': if (first) it.t0 = T; it.awake = true; voice = 'drip'; midi = M.pent(it.reg); ripple(it.x, it.z, 0.8); break;
    case 'heron': if (first) { it.awake = true; it.t0 = T; M.swell(M.now, pn, 0.06, 500, 1800, 2.6); M.sing('moon', M.pent(9), 0.9 * near, pn); ripple(it.x, it.z, 1); say('it was standing there the whole time.'); } return;
    case 'owl': it.awake = true; M.sing('glass', M.CHT[M.chAt(M.now)][1] - 12, 0.9 * near, pn); M.play('glass', M.quant(M.now + M.STEP * 3), M.CHT[M.chAt(M.now)][0] - 12, 0.7 * near, pn); return;
    case 'deer': it.awake = true; voice = 'tent'; midi = M.pent(6); M.play('tent', M.quant(M.now + M.STEP * 2), M.pent(8), 0.6 * near, pn); break;
    case 'lamp': M.sing('tent', M.pent(it.reg), (it.awake ? 0.6 : 0.9) * near, pn); if (!it.awake) { it.awake = true; M.echo('tent', M.pent(it.reg), pn); } return;
    case 'moon': it.awake = true; V.moonAwake = true; voice = 'moon'; midi = M.pent(12); if (first) say(V.moonF > 0.8 ? 'the moon is awake. everything is a little clearer.' : 'the moon answers, thin as it is.'); break;
    case 'fire': { V.homeLit = !V.homeLit; it.awake = V.homeLit; it.t0 = T; M.sing('fire', M.pent(-4), 0.9 * near, pn); return; }
    case 'tent': M.sing('oak', M.pent(-2), 0.7 * near, pn); return;
    case 'jar': M.sing('glass', M.pent(8), 0.6, pn); return;
    case 'boat': M.sing('oak', M.pent(-1), 0.7 * near, pn); ripple(it.x + 30, it.z + 40, 0.8); return;
    case 'shroom': it.awake = true; voice = 'glass'; midi = M.pent(it.reg + 5); break;
    case 'menhir': it.awake = true; if (first) { it.t0 = T; for (let i = 0; i < 7; i++) M.play('glass', M.quant(M.now + 0.3 + i * M.STEP * 2), M.fit(M.pent(-4 + i * 2), M.chAt(M.now + 0.3 + i * M.STEP * 2)), 0.38 * near, pn); M.play('sub', M.quant(M.now), M.ROOT[M.chAt(M.now)], near); say('the stone is warm. someone stood here before me.'); } voice = 'moon'; midi = M.pent(2); break;
    case 'tuft': case 'stone': case 'fern': case 'bush': case 'log': voice = 'reed'; midi = M.pent(3 + (it.idx % 6)); break;
    default: it.awake = true;
  }
  M.sing(voice, midi, 0.9 * near, pn); M.echo(voice === 'sub' ? 'oak' : voice, midi, pn);
}
// come down to a flower: walk to a point in front of it, then lower the eye to its height
function kneelAt(s, then) {
  const def = s.def, buds = s.state === 'buds' || (s.state === 'glim' && def.cond === 'listen'), sp = Flora.SPECIES[modelOf(def.sp)], hgt = sp.H * 1.15;
  standUp(); let dx = player.x - def.x, dz = player.z - def.z, d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; if (def.x + dx * 200 < CR1 + 60) { dx = 1; dz = 0; }
  const D = buds ? 225 : 78 + 0.72 * hgt + (G.S.portrait ? 30 : 0);
  const sit = () => { mode = 'kneel'; const dd = Math.hypot(def.x - player.x, def.z - player.z), ey = clamp(buds ? 62 : hgt * 0.56, 40, 104); tiltT = buds ? 0 : clamp(-Math.atan2(hgt * 0.95 - ey, dd) * 0.85, -0.9, 0.3); kneel = { s, free: false, eye: clamp(buds ? 62 : hgt * 0.56, 40, 104), yaw: Math.atan2(def.x - player.x, -(def.z - player.z)) }; if (then) then(); };
  if (d > D * 0.62 && d < D + 30 && player.x > CR1 + 52) sit(); // close enough already: no walking, no turning about; the eyes lift to the bloom
  else goal = { x: Math.max(CR1 + 52, def.x + dx * D), z: def.z + dz * D, stop: 10, fn: sit };
}
function standUp() { if (mode === 'kneel') { kneel.s.left = T; mode = 'walk'; kneel = null; tiltT = 0; } goal = null; }
function touchSpot(s, k, u, v, node) {
  const def = s.def, pn = pan(u); pulse(def.x, def.z, 0.7, 560, 900);
  if (s.state === 'glim') {
    if (def.cond === 'listen') { // three buds side by side, across your line of sight
      s.state = 'buds'; s.tru = (rnd() * 3) | 0; const ya = kneel ? kneel.yaw : CAM.yaw, tx = Math.cos(ya), tz = Math.sin(ya);
      s.plants = [-66, 0, 66].map((o, j) => { const p = mkPlant(s, j, def.x + tx * o, def.z + tz * o); p.tg = 0.44; p.var = j === s.tru ? 0 : j === (s.tru + 1) % 3 ? 1 : 2; return p; });
      M.sing('flower', M.pent(6), 0.7, pn); say('three buds, all alike. i touch one to hear it. only one sings right.', true);
    } else { visited.glim = 1; s.state = 'grow'; s.stage = 1; const p = mkPlant(s, 0, def.x, def.z); p.tg = GROW[1]; s.plants = [p]; voicePlay(def.sp, M.quant(M.now), M.fit(M.pent(regOf(def.sp)), M.chAt(M.now)), 0.8, pn); if (!visited.grow) { visited.grow = 1; say('it opens a little each time i touch it.', true); } }
    return;
  }
  const p = s.plants[k]; if (!p) return;
  G.wave(u, v, { obj: p.id + 1, life: 2.2 }); Flora.kick(p, u > 0 ? -1 : 1, T);
  if (s.state === 'buds') { if (p.dead) return; s.sel = k; motifPlay(def.sp, M.now, 0.85, pn, p.var); return; }
  if (s.state === 'grow') { s.stage = Math.min(GROW.length - 1, (s.stage || 1) + 1); p.tg = GROW[s.stage]; if (M.on) { let t = M.quant(M.now), reg = regOf(def.sp); for (let i = 1; i <= 2 + Math.min(3, s.stage); i++) { t += M.STEP * (1 + (i & 1)); voicePlay(def.sp, t, M.fit(M.pent(reg + ((node + i) * 3) % 8), M.chAt(t)), 0.55 - i * 0.07, pn + (i & 1 ? 0.35 : -0.35)); } M.swell(M.now, pn, 0.03); } voicePlay(def.sp, M.quant(M.now), M.fit(M.pent(regOf(def.sp) + (node * 3) % 7), M.chAt(M.now)), 0.8, pn); return; }
  motifPlay(def.sp, M.now, 0.8, pn, 0);
}
function choose(s) { // "this one"
  const p = s.plants[s.sel]; if (!p) return;
  if (s.sel === s.tru) { setTimeout(() => { if (mode === 'kneel' && kneel.s === s) kneelAt(s); }, 900); s.plants.forEach((q, j) => { if (j !== s.tru) { q.tg = 0; q.dead = true; } }); s.state = 'grow'; s.stage = 3; p.tg = GROW[3]; s.main = s.tru; if (typeof STEPS !== 'undefined' && M.on) STEPS.found(M.now, 0); else M.sing('flower', M.pent(9), 0.9, 0); say('yes. that is the one.', true); }
  else { p.tg = 0; p.dead = true; M.sing('oak', M.pent(-4), 0.6, 0); say('not that one. listen again.', true); }
  s.sel = -1;
}
function note(s) { const def = s.def; found[def.sp] = { night, place: WHERE[placeAt(def.x, def.z)], kept: def.home ? 'left' : null }; s.state = 'noted'; save(); Book.open(s.i, true); motifPlay(def.sp, M.now + 1.2, 0.7, 0, 0); }
function sleep() { if (sleeping) return; sleeping = true; fadeTo = 1; standUp(); if (M.on) M.sing('moon', M.pent(7), 0.6, 0); setTimeout(() => { night++; save(); startNight(false); sleeping = false; fadeTo = 0; }, 2600); }
function tap(px, py) {
  const S = G.S, { u, v } = G.toUV({ clientX: px / S.DPR, clientY: py / S.DPR }), R0 = (S.COLS - S.ox) * A, bot = -(S.ROWS - S.oy);

  // flowers first: a light on the ground, or a plant
  let best = null, bd = 15; for (const s of spots) if (s.vis && s.state === 'glim') { const d = Math.abs(u - s.su) < 4 && v > s.sv - 2 ? Math.abs(u - s.su) : Math.hypot((u - s.su) * 0.8, v - s.sv - 3); if (d < bd) { bd = d; best = s; } } // anywhere along its column of light counts
  const own = G.pick(u, v), id = own ? (own >> 8) - 1 : -1;
  if (!best && id >= FID && id < TID) best = spots[((id - FID) / 4) | 0];
  if (mode === 'kneel' && kneel.s.state !== 'buds' && kneel.s.state !== 'cut' && !(id >= FID && id < TID)) { const s = kneel.s, fx = s.def.x - player.x, fz = s.def.z - player.z, fl = Math.hypot(fx, fz) || 1; if ((fx * CAM.sy - fz * CAM.cy) / fl > 0.75) return touchSpot(s, s.main || 0, s.vis ? s.su : u, s.vis ? s.sv : v, 3 + ((T * 7) | 0) % 9); }
  if (best) {
    const s = best, k = id >= FID && id < TID ? (id - FID) % 4 : 0;
    if (mode === 'kneel' && kneel.s === s) return touchSpot(s, k, u, v, own & 255);
    if (s.state === 'cut') return;
    return kneelAt(s, s.state === 'glim' ? () => touchSpot(s, 0, 0, 0, 0) : null);
  }
  if (id >= TID) { const it = items[(id - TID) >> 3]; if (it) return wake(it, u, v, 0); }
  if (id >= 0 && id < FID && items[id]) return wake(items[id], u, v, own & 255);
  const ry = v * CAM.tc - CAM.f * CAM.ts, rf = CAM.f * CAM.tc + v * CAM.ts, rl = Math.hypot(u, ry, rf); // the ray through that point of the screen
  if (ry / rl > 0.1) { // the sky: touch a star, or put a new one there
    for (const s of stars) if (Math.hypot(s.su - u, s.sv - v) < 3) { s.fl = 1; M.sing('star', s.midi, 0.9, pan(u)); return; }
    const s = mkStar(CAM.yaw + Math.atan2(u, rf), Math.asin(ry / rl), player.x, player.z, 1, true); stars.push(s); if (stars.filter(q => q.mine).length > 140) stars.splice(stars.findIndex(q => q.mine), 1);
    if (typeof STEPS !== 'undefined' && M.on) STEPS.star(M.quant(M.now), M.fit(s.midi, M.chAt(M.now)), pan(u)); else M.sing('star', s.midi, 0.9, pan(u)); save(); return;
  }
  if (ry / rl < -0.02) { // the ground: walk there. the water: a ring
    const t = Math.min(CAM.y / -ry, 1300 / Math.hypot(u, rf)), fw = rf * t, xr = u * t, x = CAM.x + CAM.sy * fw + CAM.cy * xr, z = CAM.z - CAM.cy * fw + CAM.sy * xr;
    if (x < CR1) { ripple(x, z, 1); M.sing('drip', M.pent(3 + ((u + 80) / 22 | 0)), 0.8, pan(u)); return; }
    pulse(x, z, 0.75, 640, 950); mark = { x, z, t0: T }; if (!locked && !ptr.mouse) { standUp(); goal = { x, z, stop: 14 }; }
  }
}
// input. mouse: click to capture it, then look with it and click what is at the centre mark.
// touch: drag to look, hold still to walk, tap to touch.
function lookBy(dyaw, dtilt) {
  if (mode === 'kneel') kneel.free = true; // sitting with a flower you can still look all the way round
  player.yaw += dyaw; tiltT = clamp(tiltT + dtilt, -1.2, 1.35); if (mode !== 'kneel') goal = null;
  lookSum += Math.abs(dyaw);
}
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; if (!locked) for (const k in keys) keys[k] = false; });
document.addEventListener('mousemove', e => { if (locked && started && !Book.on && !sleeping) lookBy(e.movementX * 0.0024, e.movementY * 0.0024); });
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); if (ptr.down && e.pointerId !== ptr.id) return; ptr.id = e.pointerId; M.init(); const x = e.clientX * G.S.DPR, y = e.clientY * G.S.DPR;
  ptr.down = true; ptr.mode = null; ptr.mouse = e.pointerType === 'mouse'; ptr.lx = x; ptr.ly = y; ptr.x = ptr.sx = x; ptr.y = ptr.sy = y; ptr.t0 = performance.now(); ptr.btn = locked ? null : UI.hit(x, y); ptr.grab = false;
  if (ptr.mouse && started && !Book.on && !locked && !ptr.btn) { ptr.grab = true; try { const pr = cv.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}); } catch (x) {} } else if (!locked) try { cv.setPointerCapture(e.pointerId); } catch (x) {}
});
cv.addEventListener('pointermove', e => { if (locked || (e.pointerId !== ptr.id && ptr.down)) return; ptr.x = e.clientX * G.S.DPR; ptr.y = e.clientY * G.S.DPR; });
function up() {
  if (!ptr.down) return; ptr.down = false; const moved = Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy), was = ptr.mode; ptr.mode = null;
  if (ptr.btn) { const b = ptr.btn; ptr.btn = null; if (moved < 24 * G.S.DPR) b.fn(); return; }
  if (intro) return introTap();
  if (!started) return openTap(ptr.sx, ptr.sy);
  if (Book.on || sleeping || was || (ptr.grab && locked)) return;
  if (locked) return tap(G.S.W / 2, G.S.H / 2);
  if (moved < 18 * G.S.DPR) tap(ptr.sx, ptr.sy);
}
cv.addEventListener('pointerup', e => { if (e.pointerId === ptr.id) up(); }); cv.addEventListener('pointercancel', () => { ptr.down = false; ptr.btn = null; ptr.mode = null; });
addEventListener('blur', () => { ptr.down = false; ptr.btn = null; ptr.mode = null; for (const k in keys) keys[k] = false; });
addEventListener('keydown', e => {
  if (e.key === 'R' && e.shiftKey) { try { localStorage.removeItem('findingflowers.v2'); } catch (x) {} location.hash = ''; location.reload(); return; }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (e.repeat) return;
  if (key === 'm') return M.mute(); M.init();
  if (UI.key(key)) { e.preventDefault(); return; }
  if (intro) { if (e.key === ' ' || e.key === 'Enter') introTap(); return; }
  if (!started) { if (e.key === ' ' || e.key === 'Enter') openTap(G.S.W / 2, G.S.H / 2); return; }
  if (Book.on) return;
  if (e.key === 'q' || e.key === 'Escape') standUp(); if (e.key === 'f') guide();
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
});
addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

// ───────── music: footsteps on the beat, and everything awake near you plays
M.onStep((step, bar, s, ch, t) => {
  if (Book.on) return;
  if (!started) { if (seedPlant && seedPlant.g > 0.2 && s === 0 && bar % 2 === 0) motifPlay('peony', t, 0.34 * seedPlant.g, 0, 0, true); return; } // the first flower already plays as it opens
  const hum = () => t + rnd() * 0.012;
  if (player.walking && s % 2 === 0) { const foot = (s >> 1) & 1; if (typeof STEPS !== 'undefined') STEPS.walk(t, foot, foot ? 0.15 : -0.15); else M.burst(t, 0.02, foot ? 0.12 : -0.12, 500, 0.05, 0.05, 'lowpass'); M.vis(t, () => pulse(player.x, player.z, 0.44, 760, 1050)); }
  else if (!player.walking && s === 0 && bar % 2 === 0 && started) M.vis(t, () => pulse(player.x, player.z, 0.3, 360, 900)); // standing still, the dark breathes
  if (s === 0 && bar % 2 === 0) { const near = new Set(band.filter(b => b.spot).map(b => b.spot.def.sp)); for (const d of SPOTS) if (found[d.sp] && !near.has(d.sp)) motifPlay(d.sp, t, 0.17, ((d.x > 0 ? 1 : -1) * 0.3), 0, true); }
  let tree = false, fl = 0;
  for (const b of band) {
    const pn = pan(b.su), near = clamp(1.2 - b.d / 2400, 0.12, 1);
    if (b.spot) { if (s === 0 && bar % 2 === 0 && fl < 4) { fl++; motifPlay(b.spot.def.sp, t, 0.36 * near * (b.lv || 1), pn, 0, true); const p = b.p; M.vis(t, () => { pulse(b.spot.def.x, b.spot.def.z, 0.34, 460, 640); if (b.spot.vis) G.wave(b.spot.su, b.spot.sv, { sp: 20, w: 2.5, a: 0.5, life: 0.9, obj: p.id + 1 }); Flora.kick(p, (rnd() - 0.5) * 0.4, T); }); } continue; }
    const it = b;
    if (typeof CREATURE !== 'undefined' && CREATURE[it.type]) { if (CREATURE[it.type].step) CREATURE[it.type].step(it, s, bar, ch, t, near, pn); continue; }
    if (it.type === 'tree' && !tree) { tree = true; if (s === 0) { M.play('sub', t, M.ROOT[ch], 0.8 * near); M.vis(t, () => { it.flash = 0.6; }); } else if ((s === 6 || s === 11 || s === 14) && rnd() < 0.35) M.play('oak', hum(), M.CHT[ch][(rnd() * 4) | 0], 0.36 * near, pn); }
    else if (it.type === 'reed') { if ((s + it.idx) % 8 === 3 && rnd() < 0.3) { M.play('reed', hum(), M.pent(it.reg + 5 + ((rnd() * 3) | 0) + M.SH[ch]), 0.28 * near, pn); M.vis(t, () => { it.flash = 0.5; }); } }
    else if (it.type === 'pad') { if ((s + it.idx * 5) % 16 === 9 && rnd() < 0.4) { M.play('drip', hum(), M.pent(it.reg + M.SH[ch]), 0.3 * near, pn); M.vis(t, () => ripple(it.x, it.z, 0.5)); } }
    else if (it.type === 'lamp') { if ((s === 0 && bar % 2 === it.n % 2) || (s === 10 && it.n % 3 === bar % 3)) M.play('tent', hum(), M.CHT[ch][it.n % 4] + 12, 0.2 * near, pn); }
    else if (it.type === 'owl') { if (s === 8 && bar % 4 === 1) { M.play('glass', t, M.CHT[ch][1] - 12, 0.45 * near, pn); M.play('glass', t + M.STEP * 3, M.CHT[ch][0] - 12, 0.36 * near, pn); } }
    else if (it.type === 'flies') { if (rnd() < 0.1) M.play('star', hum(), M.pent(13 + ((rnd() * 7) | 0)), 0.2 * near, pn + (rnd() - 0.5)); }
    else if (it.type === 'moon') { if (s === 0 && bar % 4 === 0) M.play('moon', t, M.CHT[ch][3] + 12, 0.5, 0.5); }
    else if (it.type === 'shroom') { if ((s + it.idx) % 16 === 4 && bar % 2 === 1 && rnd() < 0.6) M.play('glass', hum(), M.pent(it.reg + 5 + M.SH[ch]), 0.22 * near, pn); }
    else if (it.type === 'menhir') { if (s === 0 && bar % 4 === 2) M.play('moon', t, M.ROOT[ch] + 24, 0.4 * near, pn); }
    else if (it.type === 'fire' && V.homeLit) { if (s === 0 || s === 8) M.kick(t, 0.14 * near); }
  }
});
M.onTick(now => { const d = Math.hypot(player.x, player.z); if (V.homeLit && d < 1300) for (let i = 0; i < 3; i++) if (rnd() < 0.3) M.burst(now + rnd() * 0.06, 0.07 * rnd() * rnd() * clamp(1.2 - d / 1300, 0, 1), 0, 900 + rnd() * 5200, 0.008 + rnd() * 0.035, 0.12); });

// ───────── the flowers in the world
function condMet(s) {
  if (s.cal) return true; const c = s.def.cond, d = s.d; let ok = false;
  if (!c || c === 'listen') ok = true;
  else if (c === 'still') ok = player.still > 2.5 && d < 900;
  else if (c === 'sky') ok = skyT > 2.5 && d < 1100;
  else if (c === 'stars') ok = stars.filter(st => st.mine && Math.hypot(st.gx - s.def.x, st.gz - s.def.z) < 700).length >= 3;
  else if (c === 'moon') ok = V.moonAwake;
  if (ok) s.cal = true; return ok;
}
function drawSpots(dt) {
  let prompt = null;
  V.cut.forEach((ci, i) => { const a = i * 0.9 + T * 0.05; if (PR.proj(Math.cos(a) * 85, 8 + Math.sin(T + i) * 3, Math.sin(a) * 85)) G.plot(PR.u, PR.v, PR.z, ci, '*', 0.9, 0.2); }); // what you cut rests around the first flower
  for (const s of spots) {
    { const p0 = s.plants[s.main || 0]; if (p0 && s.state !== 'cut' && s.state !== 'buds') lightsN.push({ f: 1, x: s.def.x, z: s.def.z, r: (s.def.home ? 700 : 480) * (0.5 + 0.5 * p0.g), k: 0.2 + 0.6 * p0.g }); }
    const def = s.def, d = s.d = distTo(def.x, def.z), open = def.night <= night, lf = glow(def.x, def.z); s.vis = false; if (d > 3400) continue;
    if (s.state === 'hidden') {
      if (open && condMet(s)) { s.state = 'glim'; s.t0 = T; if (M.on && d < 1500) M.sing('star', M.pent(12), 0.5, 0); }
      else if (open && d < 520 && NEAR_HINT[def.cond] && T - lastHint > 16) { lastHint = T; say(NEAR_HINT[def.cond]); }
    }
    if (mode === 'walk' && !goal && d < 250 && open && player.still > 0.3 && s.state !== 'hidden' && s.state !== 'cut' && s.state !== 'noted' && T - (s.left || -9) > 4) kneelAt(s, s.state === 'glim' ? () => touchSpot(s, 0, 0, 0, 0) : null);
    if (s.state === 'glim') { // a small light near the ground, seen from far off
      if (!PR.proj(def.x, 9, def.z)) continue; s.vis = true; if (started && found.peony && tut > 2 && mode === 'walk' && !visited.glim && !thought && night === 1) { visited.glim = 1; say('something small is shining over there. touch it.'); } s.su = PR.u; s.sv = PR.v; const own = (FID + s.i * 4 + 1) << 8, a = (0.6 + 0.4 * Math.sin(T * 3 + s.i)) * clamp(1.25 - d / 3200, 0, 1), z = PR.z, sc = PR.s;
      G.plot(PR.u, PR.v, z, COL.white, '*', a, 0.6 * a, own); G.plot(PR.u - A, PR.v, z, COL.amber, '-', a, 0.3 * a, own); G.plot(PR.u + A, PR.v, z, COL.amber, '-', a, 0.3 * a, own); G.plot(PR.u, PR.v + 1, z, COL.amber, '|', a, 0.3 * a, own); G.plot(PR.u, PR.v - 1, z, COL.amber, '|', a * 0.8, 0.2 * a, own); if (sc > 0.3) { G.plot(PR.u - A, PR.v, z, COL.star, '.', a * 0.7, 0, own); G.plot(PR.u + A, PR.v, z, COL.star, '.', a * 0.7, 0, own); G.plot(PR.u, PR.v + 1, z, COL.star, "'", a * 0.6, 0, own); }
      for (let h = 30; h < 520; h += 13) if (PR.proj(def.x + Math.sin(h * 0.05 + T * 1.5) * 3, h, def.z)) G.plot(PR.u, PR.v, PR.z, h % 26 ? COL.amber : COL.white, h % 26 ? ':' : '*', a * (0.9 - h / 620), 0.2 * a, own);
      for (let i = 0; i < 6; i++) { const k = (T * 0.3 + i * 0.17) % 1; if (PR.proj(def.x + Math.sin(i * 2.1 + T) * 14 * k, 12 + k * 120, def.z + Math.cos(i * 1.3 + T) * 14 * k)) G.plot(PR.u, PR.v, PR.z, COL.star, '.', (1 - k) * a * 0.7, 0, own); }
      continue;
    }
    const main = s.plants[s.main || 0], here = mode === 'kneel' && kneel.s === s;
    for (const p of s.plants) {
      p.g += (p.tg - p.g) * (1 - Math.exp(-dt * 0.55)); if (p.g < 0.01) continue;
      const fx = p.x - CAM.x, fz = p.z - CAM.z, fw = fx * CAM.sy - fz * CAM.cy; if (fw < 30 || d > 1300) continue;
      p.yaw += wrap(Math.atan2(CAM.x - p.x, CAM.z - p.z) - p.yaw) * (1 - Math.exp(-dt * 1.2)); p.turn = 0.16; p.lod = fw > 480; (G.lit = G.lit || [])[p.id + 1] = s.state === 'noted' || s.state === 'bloom' ? 1 : s.state === 'buds' ? 0.62 + 0.35 * lf : clamp(0.55 + 0.45 * Math.max(lf, p.g), 0, 1);
      Flora.draw(p, T);
    }
    if (main && PR.proj(def.x, main.sp.H * 0.7, def.z)) { s.vis = true; s.su = PR.u; s.sv = PR.v; if (d > 1300 && (s.state === 'bloom' || s.state === 'noted')) { const own = (FID + s.i * 4 + 1) << 8, a = 0.85 * clamp(1.3 - d / 3400, 0, 1); G.plot(PR.u, PR.v, PR.z, bloomCol(def.sp), '*', a, 0.25, own); G.plot(PR.u, PR.v - 1, PR.z, COL.stem, '|', a * 0.5, 0, own); } }
    if (s.state === 'grow' && main && main.g > 0.985) { s.state = 'bloom'; for (let i = 0; i < 3; i++) setTimeout(() => pulse(def.x, def.z, 1 - i * 0.2, 520, 2600), i * 450); motifPlay(def.sp, M.now, 0.9, 0, 0); if (typeof STEPS !== 'undefined' && M.on) STEPS.found(M.now, 0); if (s.vis) G.wave(s.su, s.sv, { obj: main.id + 1, life: 3, sp: 26 }); say('it is open. i write it down before i forget how it looks.', true); }
    if (main && d < 2400 && (s.state === 'bloom' || s.state === 'noted' || (s.state === 'grow' && main.g > 0.18))) band.push({ spot: s, p: main, su: s.vis ? s.su : 0, d, lv: s.state === 'grow' ? 0.35 + 0.65 * main.g : 1 });
    if (here || d < 420) { if (s.state === 'bloom') prompt = { label: 'note it down', fn: () => note(s) }; else if (s.state === 'buds') prompt = s.sel >= 0 ? { label: 'this one', fn: () => choose(s), alt: { label: 'hum it', fn: () => motifPlay(def.sp, M.now, 0.8, 0, 0) } } : { label: 'hum it', fn: () => motifPlay(def.sp, M.now, 0.8, 0, 0) }; }
    if (s.state === 'buds' && s.sel >= 0) { const p = s.plants[s.sel]; if (PR.proj(p.x, 4, p.z)) G.plot(PR.u, PR.v, PR.z + 2, COL.white, '^', 0.6 + 0.3 * Math.sin(T * 4)); }
  }
  return prompt;
}

const GUIDE = { on: false, x: 0, z: 0, r: 26, until: 0 };
const ARRIVES = { owl: 2, heron: 3, deer: 4 }; // who joins the forest on which night
const NIGHT_NOTE = { 2: 'trees sleep too. i could touch one, and stay to watch.', 3: 'the sky is empty wherever i have not looked. i could touch it.', 4: 'i am not the only one awake tonight.', 5: 'the moon is nearly whole. it might answer.', 6: 'one flower only opens for a woken moon.' };
function nextSpot() { let t = null, bd = 1e9; for (const s of spots) if (s.def.night <= night && !found[s.def.sp]) { const d = distTo(s.def.x, s.def.z) + (s.state === 'hidden' ? 700 : 0); if (d < bd) { bd = d; t = s; } } return t; }
function placeGuide() {
  GUIDE.on = started && !intro && tut >= 2 && !!found.peony && T < GUIDE.until && mode !== 'kneel'; if (!GUIDE.on) return;
  const t = nextSpot(), tx = t ? t.def.x : 0, tz = t ? t.def.z : 0, dx = tx - player.x, dz = tz - player.z, d = Math.hypot(dx, dz) || 1;
  if (d < 380) { GUIDE.x = tx; GUIDE.z = tz; GUIDE.r = 60; GUIDE.until = Math.min(GUIDE.until, T + 7); } else { const a = Math.min(d - 120, 340); GUIDE.x = player.x + dx / d * a; GUIDE.z = player.z + dz / d * a; GUIDE.r = 24; }
}
// ───────── finding your way: a line of light that runs once along the ground toward the nearest open flower
function guide(auto) {
  const t = nextSpot(), tx = t ? t.def.x : 0, tz = t ? t.def.z : 0; if (!t && !auto) say('nothing more is open tonight. home is that way.', true);
  guideFx = { tx, tz, t0: T }; GUIDE.until = T + 80; const side = (tx - player.x) * CAM.cy + (tz - player.z) * CAM.sy > 0 ? 0.6 : -0.6;
  if (M.on) [0, 2, 4, 7].forEach((d, i) => M.play('star', M.quant(M.now + i * M.STEP), M.fit(M.pent(8 + d), M.chAt(M.now)), 0.3, side));
}
function drawGuide() {
  const g = guideFx; if (!g) return; const k = (T - g.t0) / 2.6; if (k > 1.3) { guideFx = null; return; }
  const dx = g.tx - player.x, dz = g.tz - player.z, d = Math.hypot(dx, dz) || 1, len = Math.min(d, 1700), n = 60;
  for (let i = 2; i <= n; i++) { const q = i / n, a = Math.exp(-Math.pow((q - k) / 0.1, 2)) + (q < k ? 0.16 * (1.3 - k) : 0); if (a < 0.03) continue; const wob = Math.sin(q * 9 + T * 2) * 12 * q; if (PR.proj(player.x + dx / d * len * q - dz / d * wob, 6, player.z + dz / d * len * q + dx / d * wob)) { G.plot(PR.u, PR.v, PR.z + 5, COL.amber, a > 0.55 ? '*' : '.', Math.min(1, a), a * 0.5); if (a > 0.55) G.plot(PR.u, PR.v + 1, PR.z + 5, COL.warm, "'", a * 0.5); } }
}
// ───────── the opening: black, and one seed. you open your first flower yourself; then her notebook speaks
const STORY = [['my grandmother kept a notebook of flowers.'], ['she found them in this forest, at night,', 'one at a time, for most of her life.'], ['fourteen pages are still empty.'], ['inside the cover she wrote:'],
  ['"they open in the dark,', 'only for someone who is not in a hurry."'], ['so i have come, with her notebook,', 'to find the ones she did not.'], ['she planted one where i would find it.', 'it is the first page.'], ['this is the first night.']];
const GROW = [0.03, 0.12, 0.26, 0.42, 0.58, 0.76, 1];
let seedPlant = null, seedStage = 0;
function nightLine() { if (count() === SPOTS.length) return say(`night ${night}. every page is full.`, true); const k = openTonight(); say(`night ${night}. ${k} ${k === 1 ? 'flower is' : 'flowers are'} open tonight.`, true); }
function enterForest(fresh) { // a new walker arrives kneeling at the flower they just opened
  started = true; fade = 1; fadeTo = 0; pulses = []; const s = spots[0];
  if (fresh && !found.peony) { s.state = 'bloom'; s.stage = GROW.length - 1; const p = mkPlant(s, 0, 0, 0); p.g = p.tg = 1; s.plants = [p]; player.x = 0; player.z = 300; kneelAt(s); const g = goal; player.x = g.x; player.z = g.z; goal = null; g.fn(); player.yaw = kneel.yaw; player.eye = kneel.eye; tut = -1; }
  else pulse(player.x, player.z, 0.9, 420, 1700);
}
function beginGame() { M.init(); if (!seenIntro && count() === 0 && night === 1) { intro = { i: 0, t0: T + 0.5, n: 0 }; tut = 0; } else { enterForest(!found.peony); if (found.peony) { nightLine(); setTimeout(() => guide(true), 3500); } } }
function openTap(px, py) { // the first flower answers a touch exactly as every flower in the forest does: a step of opening, its own voice, the wave, the answering notes
  const p = seedPlant; if (!p) return; M.init(); const { u, v } = G.toUV({ clientX: px / G.S.DPR, clientY: py / G.S.DPR }), pn = pan(u), reg = regOf('peony'), node = 3 + ((T * 7) | 0) % 9;
  G.wave(u, v, { obj: 1, life: 2.4 }); Flora.kick(p, u > 0 ? -1 : 1, T);
  if (p.tg >= 1) { motifPlay('peony', M.now, 0.8, pn, 0); return; } // open: it sings its whole phrase
  seedStage = Math.min(GROW.length - 1, seedStage + 1); p.tg = GROW[seedStage];
  if (M.on) { let t = M.quant(M.now); voicePlay('peony', t, M.fit(M.pent(reg + (node * 3) % 7), M.chAt(t)), 0.8, pn); for (let i = 1; i <= 2 + Math.min(3, seedStage); i++) { t += M.STEP * (1 + (i & 1)); voicePlay('peony', t, M.fit(M.pent(reg + ((node + i) * 3) % 8), M.chAt(t)), 0.55 - i * 0.07, pn + (i & 1 ? 0.35 : -0.35)); } M.swell(M.now, pn, 0.03);
    if (seedStage === GROW.length - 1) { motifPlay('peony', M.now + 1.6, 0.9, 0, 0); if (typeof STEPS !== 'undefined') STEPS.found(M.now + 1.2, 0); } }
}
function introTap() {
  const it = intro, full = STORY[it.i].join('').length; if ((T - it.t0) * 24 < full) { it.t0 = T - full / 24 - 0.01; return; }
  it.i++; it.t0 = T + 0.25; it.n = 0; if (M.on && typeof STEPS !== 'undefined') STEPS.page(M.now); if (it.i >= STORY.length) endIntro();
}
function endIntro() { intro = null; seenIntro = true; try { if (location.hash.length < 2) localStorage.setItem('findingflowers.intro', '1'); } catch (e) {} tut = 0; lookSum = 0; enterForest(true); }
function drawIntro(ctx, S) { // large type, one letter at a time, each with its small note
  const it = intro, lines = STORY[it.i], W = S.W, fs = Math.round(Math.min(UI.fs * 1.5, (W - UI.fs * 5) / (Math.max(...lines.map(l => l.length)) * 0.62))), H = S.H, lh = fs * 1.8, chars = Math.max(0, Math.floor((T - it.t0) * 24)), full = lines.join('').length, f0 = ctx.font;
  ctx.font = `${fs}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`;
  const w = Math.min(W - fs * 2, Math.max(...lines.map(l => UI.width(l))) + fs * 3), h = lines.length * lh + fs * 2.2, x = (W - w) / 2, y = H - h - fs * 2.2;
  UI.box(x, y, w, h, 1, 0.9); let used = 0;
  lines.forEach((l, j) => { const show = clamp(chars - used, 0, l.length); if (show > 0) UI.text(l.slice(0, show) + (show < l.length ? '_' : ''), x + fs * 1.5, y + fs * 1.75 + j * lh, it.i === 4 ? 1 : 0.9); used += l.length; });
  const now = Math.min(full, chars); if (now > it.n) { const c = lines.join('')[now - 1]; if (c && c !== ' ' && M.on) M.fm(M.now, M.pent(9 + (now * 5) % 4 + (it.i === 4 ? 3 : 0)), { g: 0.035, dec: 0.07, wave: 'triangle', rv: 0.25, pan: (now % 3 - 1) * 0.2 }); it.n = now; }
  ctx.font = f0; if (chars > full + 8) UI.text(ptr.mouse ? 'click' : 'tap', x + w - UI.fs * 1.2, y + h - UI.fs * 0.9, 0.3 + 0.25 * Math.sin(T * 4), 'right');
  UI.btn('skip', W - UI.fs * 1.3, UI.fs * 1.3, endIntro, 'r', 0.45, 'Escape');
}
// teaching, one thing at a time, in the world
function teach() {
  if (tut > 2 || intro) return;
  if (tut === -1) { coach = null; if (found.peony && !Book.on) { tut = 0; lookSum = 0; } return; }
  if (tut === 0 && lookSum > 0.9) { tut = 1; walkSum = 0; }
  else if (tut === 1 && walkSum > 200) { tut = 2; coach = { until: T + 9 }; guide(true); }
  else if (tut === 2 && (T > coach.until || mode === 'kneel')) { tut = 3; coach = null; if (mode !== 'kneel') nightLine(); }
  if (tut < 3) coach = Object.assign(coach || {}, { text: tut === 0 ? (ptr.mouse ? (locked ? 'move the mouse to look around.' : 'click to step into the dark.') : 'drag to look around.') : tut === 1 ? (ptr.mouse ? 'w a s d to walk.' : 'hold your thumb still to walk.') : 'the moth knows where they are. i follow it.' });
}
function titleFrame(dt, S) {
  const back = seenIntro || count() > 0;
  if (!seedPlant) { seedPlant = Flora.make('peony', { id: 0, yaw: 0.15, turn: 0.4, ph: 0, g: back ? 1 : 0.03, tg: back ? 1 : 0.03 }); seedStage = back ? GROW.length - 1 : 0; }
  const p = seedPlant, top = S.oy, availH = S.ROWS * 0.66; p.scale = Math.min(1.3, availH / (p.sp.H + 34), S.halfU * 1.7 / 70); p.x = 0; p.y = top - S.ROWS * 0.72; p.z = 0;
  p.g += (p.tg - p.g) * (1 - Math.exp(-dt * 1.5)); fade = 0; CAM.yaw = 0; CAM.tilt = 0; camSet();
  M.bed.pad = 0.15 + 0.7 * p.g; M.bed.water = 0.1; M.bed.air = 0; M.bed.rumble = 0;
  G.begin(T); G.tickWaves(0); G.lit = null; G.warm = null; Flora.cam = null; drawSky(stars, dt);
  if (seedStage === 0) { const a = 0.5 + 0.4 * Math.sin(T * 2.4); G.plot(0, p.y + 1, 1, COL.white, '.', a, 0.3); G.plot(0, p.y + 2, 1, COL.star, "'", a * 0.5); }
  Flora.draw(p, T); G.shade(); G.end(); hud(S, false);
}
// ───────── frame
function frame(ms) {
  const now = ms / 1000, dt = Math.min(0.05, now - last || 0.016); last = now; T = V.T = now; M.flush();
  fade += (fadeTo - fade) * (1 - Math.exp(-dt * 2.2));
  if (Book.on) { Flora.cam = null; Book.draw(T, dt); hud(G.S, true); requestAnimationFrame(frame); return; }
  const S = G.S;
  if (!started) { titleFrame(dt, S); requestAnimationFrame(frame); return; }
  // moving: w a s d (arrows turn), a held thumb, or a place you tapped. one pace only: this is a walk
  let fwd = 0, turn = 0, side = 0, manual = false; const pace = 1;
  if (started && !sleeping && !intro) {
    if (keys.w || keys.ArrowUp) fwd = 1; if (keys.s || keys.ArrowDown) fwd = -0.6; if (keys.a) side = -0.8; if (keys.d) side = 0.8; if (keys.ArrowLeft) turn = -1; if (keys.ArrowRight) turn = 1;
    if (ptr.down && !ptr.btn && !ptr.mouse) { // touch: drag = look; holding still = walk forward, and a drag then steers
      if (!ptr.mode) { if (Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) > 12 * S.DPR) ptr.mode = 'look'; else if (performance.now() - ptr.t0 > 320) ptr.mode = 'walk'; }
      if (ptr.mode) { const du = (ptr.x - ptr.lx) / S.cellW * A, dv = (ptr.y - ptr.ly) / S.cellH; if (du || dv) lookBy(-du / CAM.f * 1.15, -dv / CAM.f * 1.15); }
      if (ptr.mode === 'walk') fwd = 1; ptr.lx = ptr.x; ptr.ly = ptr.y;
    }
    manual = fwd !== 0 || turn !== 0 || side !== 0;
  }
  if (manual) standUp();
  if (goal && !manual) {
    const dx = goal.x - player.x, dz = goal.z - player.z, d = Math.hypot(dx, dz);
    if (goal.best === undefined || d < goal.best - 2) { goal.best = d; goal.tb = T; }
    if (d <= goal.stop || (T - goal.tb > 0.8 && d < 95)) { const g = goal; goal = null; if (g.fn) g.fn(); }
    else if (T - goal.tb > 0.8) goal = null;
    else { const dy = wrap(Math.atan2(dx, -dz) - player.yaw); player.yaw += clamp(dy, -2.6 * dt, 2.6 * dt); fwd = Math.abs(dy) < 0.5 ? Math.min(1, d / 70 + 0.25) : 0.12; }
  }
  if (mode === 'kneel') { if (!kneel.free) { const dy = wrap(kneel.yaw - player.yaw); player.yaw += dy * (1 - Math.exp(-dt * 2.5)); if (Math.abs(dy) < 0.02) kneel.free = true; } fwd = 0; }
  player.vyaw = (player.vyaw || 0) + (turn * 1.75 - (player.vyaw || 0)) * (1 - Math.exp(-dt * 9)); player.yaw += player.vyaw * dt; if (manual || goal) idle = 0; else idle += dt;
  player.vf += (fwd * 96 * pace - player.vf) * (1 - Math.exp(-dt * (fwd ? 3.5 : 7))); if (Math.abs(player.vf) < 0.5) player.vf = 0;
  player.vs = (player.vs || 0) + (side * 96 * pace - (player.vs || 0)) * (1 - Math.exp(-dt * (side ? 3.5 : 7)));
  let nx = player.x + (Math.sin(player.yaw) * player.vf + Math.cos(player.yaw) * player.vs) * dt, nz = player.z + (-Math.cos(player.yaw) * player.vf + Math.sin(player.yaw) * player.vs) * dt;
  for (const c of solids) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r && d > 0.01) { nx = c.x + dx / d * c.r; nz = c.z + dz / d * c.r; } }
  if (nx < CR1 + 46) { nx = CR1 + 46; if (!visited.water) { visited.water = 1; say('the water is cold and i have no reason to be in it.'); } }
  { const dx = nx - HOME.x, dz = nz - HOME.z, d = Math.hypot(dx, dz); if (d > HOME.r) { nx = HOME.x + dx / d * HOME.r; nz = HOME.z + dz / d * HOME.r; if (T - lastHint > 12) { lastHint = T; say('the dark is too thick this way. i turn back.'); } } }
  const sp = Math.hypot(player.vf, player.vs); player.x = nx; player.z = nz; player.walking = sp > 14; player.phase += sp * dt / 62;
  if (!M.on && player.walking) { stepD += sp * dt; if (stepD > 46) { stepD = 0; pulse(player.x, player.z, 0.44, 760, 1050); } }
  player.still = player.walking || turn ? 0 : player.still + dt; V.calm += ((player.still > 3 ? 1 : 0) - V.calm) * (1 - Math.exp(-dt * 0.5));
  skyT = CAM.tilt < -0.4 ? skyT + dt : 0; V.fireK += ((V.homeLit ? 1 : 0) - V.fireK) * (1 - Math.exp(-dt * 0.8));
  player.eye += ((mode === 'kneel' ? kneel.eye : EYE) - player.eye) * (1 - Math.exp(-dt * 2.6));
  CAM.x = player.x; CAM.z = player.z; CAM.yaw = player.yaw; CAM.y = player.eye + (player.walking ? Math.abs(Math.sin(player.phase * Math.PI)) * 2.4 : Math.sin(T * 1.1) * 0.5); CAM.tilt += (tiltT - CAM.tilt) * (1 - Math.exp(-dt * 14)); camSet();
  lookSum += Math.abs(player.vyaw || 0) * dt; walkSum += sp * dt; teach(); placeGuide();
  // thoughts
  thoughtCool -= dt; if (started && player.still > 5 && thoughtCool < 0 && !thought) { thoughtCool = 45; const pool = typeof THOUGHTS !== 'undefined' ? THOUGHTS : ['the dark is not empty. it is only quiet.', 'i breathe out, and the dark steadies.', 'nothing here is in a hurry.']; say(pool[(rnd() * pool.length) | 0]); }
  const pl = placeAt(player.x, player.z); if (started && !visited[pl]) { visited[pl] = 1; if (pl !== 'camp') say(pl + '.'); }

  V.dt = dt; lights = lightsN; lightsN = stageLights ? stageLights.slice() : [];
  G.begin(T); G.tickWaves(0); G.lit = []; G.warm = null; Flora.cam = PR;
  drawSky(stars, dt); drawGround(); band = drawItems(dt); const prompt = drawSpots(dt); Flora.cam = null;
  if (mark) { const k = (T - mark.t0) / 1.2; if (k > 1) mark = null; else for (let j = 0; j < 10; j++) { const a = j / 10 * 6.283; if (PR.proj(mark.x + Math.cos(a) * 26 * k, 0, mark.z + Math.sin(a) * 26 * k)) G.plot(PR.u, PR.v, PR.z, COL.white, '.', (1 - k) * 0.7); } }
  drawGuide(); drawMotes(); band.sort((a, b) => a.d - b.d);
  G.shade();
  M.bed.pad = clamp(0.22 + 0.4 * V.calm + band.length * 0.06 + count() * 0.015, 0, 1); M.bed.air = V.ML; M.bed.rumble = V.fireK * clamp(1.2 - Math.hypot(player.x, player.z) / 1300, 0, 0.7); M.bed.water = clamp(1 - (player.x - CR1) / 1700, 0.1, 1);
  G.end(); aim = 0; if (locked) { const c = G.toUV({ clientX: S.W / 2 / S.DPR, clientY: S.H / 2 / S.DPR }); aim = G.pick(c.u, c.v) ? 1 : 0; if (!aim) for (const q of spots) if (q.vis && q.state === 'glim' && ((Math.abs(c.u - q.su) < 4 && c.v > q.sv - 2) || Math.hypot((c.u - q.su) * 0.8, c.v - q.sv - 3) < 13)) aim = 1; }
  hud(S, false, prompt);
  requestAnimationFrame(frame);
}
function hud(S, inBook, prompt) {
  const ctx = cv.getContext('2d'); if (!inBook) UI.begin(ctx); const fs = UI.fs, m = fs * 1.3, W = S.W, H = S.H;
  if (!inBook && started && !intro) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, m + fs * 13, m + fs * 5.2);
    UI.text(`night ${night}`, m, m + fs * 0.6, 0.6); UI.text(`${String(count()).padStart(2, '0')} / ${SPOTS.length} found`, m, m + fs * 2.3, 0.4); { const k = openTonight(); UI.text(k ? `${k} open tonight` : 'nothing more tonight', m, m + fs * 4, 0.4); }
    { const pl = placeAt(player.x, player.z); UI.text(pl === 'camp' ? 'home' : pl, W / 2, m + fs * 0.6, 0.3, 'center'); }
    const kh = (label, k) => locked ? `${label}  [${k}]` : label;
    UI.btn(kh('book', 'b'), W - m, m, () => Book.open(Math.max(0, SPOTS.findIndex(d => !found[d.sp])), false), 'r', 0.8, 'b');
    // the one thing you can do here
    const atCamp = mode === 'walk' && tut > 2 && Math.hypot(player.x, player.z) < 330, tonight = Object.values(found).filter(f => f.night === night).length;
    if (!prompt && atCamp && !sleeping && (tonight > 0 || openTonight() === 0)) prompt = count() === SPOTS.length ? { label: 'play the whole book', fn: () => { Book.open(0, false); Book.whole(); } } : { label: 'rest here until the next night', fn: sleep };
    const y = H - m - UI.bh * 1.15 - (S.portrait ? UI.bh * 1.3 : 0); // the offered action sits low, clear of what you are looking at
    if (prompt) { if (prompt.alt) { UI.btn(kh(prompt.label, 'space'), W / 2 - fs * 0.4, y, prompt.fn, 'r', 1, ' '); UI.btn(kh(prompt.alt.label, 'h'), W / 2 + fs * 0.4, y, prompt.alt.fn, 'l', 1, 'h'); } else UI.btn(kh(prompt.label, 'space'), W / 2, y, prompt.fn, 'c', 1, ' '); }
    if (mode === 'kneel') UI.btn(kh('stand up', 'q'), m, y, standUp, 'l', 0.7, 'q');
    UI.btn(kh('where?', 'f'), W - m, H - m - UI.bh, () => guide(), 'r', 0.85, 'f');
    if (locked) { // the centre mark: a small cross, and corner ticks when it rests on something you can touch
      const cx = W / 2, cy = H / 2, r = fs * 0.35; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = UI.lw; ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      if (aim) { const bw = fs * 1.9, bh = fs * 1.5, k = fs * 0.5; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const X = cx + sx * bw, Y = cy + sy * bh; ctx.moveTo(X - sx * k, Y); ctx.lineTo(X, Y); ctx.lineTo(X, Y - sy * k); }); }
      ctx.stroke();
    }
    if (guideFx) { const g = guideFx, dx = g.tx - player.x, dz = g.tz - player.z, fw = dx * CAM.sy - dz * CAM.cy, rt = dx * CAM.cy + dz * CAM.sy, off = fw < 20 || Math.abs(rt / fw) > S.halfU / CAM.f; if (off) { const al = clamp(1.2 - (T - g.t0) / 2.6, 0, 1) * (0.5 + 0.5 * Math.sin(T * 9)); UI.text(rt < 0 ? '<<<' : '>>>', rt < 0 ? m * 2 : W - m * 2, H * 0.5, 0.9 * al, rt < 0 ? 'left' : 'right'); } }
    if (coach && coach.text) { const w = UI.width(coach.text) + fs * 2, cy = H * 0.7; UI.box((W - w) / 2, cy, w, UI.bh, 1); UI.text(coach.text, W / 2, cy + UI.bh / 2 + 1, 0.9, 'center'); }
    if (thought && !coach) { // a thought: plain words low in the middle, typed, then gone
      const k = T - thought.t0, n = Math.floor(k * 30), tx = thought.text, full = tx.length, hold = full / 30 + 4, al = k > hold ? 1 - (k - hold) / 1.5 : 1;
      if (thought.note && n > (thought.n || 0) && n <= full) { thought.n = n; if (n % 2 && tx[n - 1] !== ' ' && M.on) M.fm(M.now, M.pent(10 + n % 3), { g: 0.022, dec: 0.05, wave: 'triangle', rv: 0.2 }); } // her notes type themselves with a small sound per letter
      if (al <= 0) thought = null; else { let l1 = tx, l2 = ''; if (UI.width(tx) > W - m * 4) { let cut = tx.lastIndexOf(' ', Math.ceil(full * 0.55)); if (cut < 0) cut = full; l1 = tx.slice(0, cut); l2 = tx.slice(cut + 1); }
        const ty = H - m * 2.2 - (l2 ? fs * 1.6 : 0) - UI.bh * (S.portrait ? 2.7 : 1.5); UI.text(l1.slice(0, n), W / 2, ty, 0.6 * al, 'center'); if (l2 && n > l1.length) UI.text(l2.slice(0, n - l1.length - 1), W / 2, ty + fs * 1.6, 0.6 * al, 'center'); }
    } else if (thought && T - thought.t0 > 8) thought = null;
  }
  if (!started && !intro && seedPlant) { // the opening: a seed and one word, then the name once it has opened
    const g = seedPlant.g, yb = H - m * 2;
    if (seedStage === 0 && T > 2) UI.text(ptr.mouse ? 'click it' : 'tap it', W / 2, yb - fs * 2, 0.5 + 0.3 * Math.sin(T * 2.4), 'center');
    if (g > 0.8) { const al = clamp((g - 0.8) / 0.1, 0, 1); UI.text('F I N D I N G   F L O W E R S', W / 2, yb - UI.bh - fs * 3.2, 0.95 * al, 'center'); UI.btn(count() || seenIntro ? 'go on' : 'begin', W / 2, yb - UI.bh, beginGame, 'c', al, ' '); }
  }
  if (fade > 0.01) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); if (sleeping && fade > 0.7) { const al = (fade - 0.7) / 0.3, k = Object.values(found).filter(f => f.night === night).length; UI.text(`night ${night + 1}`, W / 2, H / 2 - fs, al * 0.85, 'center'); UI.text(k ? `${k} ${k === 1 ? 'page' : 'pages'} written tonight` : 'i slept. that is allowed.', W / 2, H / 2 + fs * 1.2, al * 0.45, 'center'); } }
  if (intro) drawIntro(ctx, S);
}
if (location.hash.length < 2) load();
{ seed = 5; for (let i = 0; i < 150; i++) stars.push(mkStar(sr() * 6.283, 0.08 + Math.pow(sr(), 1.6) * 1.2, 0, 0, 0, false)); try { seenIntro = location.hash.length < 2 && !!localStorage.getItem('findingflowers.intro'); } catch (e) {} }
{ const m = location.hash.match(/^#demo(?:=(-?\d+),(-?\d+),(-?[\d.]+))?(?:,(\w+))?/);
  if (m) { // a staged moment for a picture: later night, things awake, flowers grown; optional 4th value kneels at a species
    night = 5; SPOTS.slice(0, 9).forEach((d, i) => { found[d.sp] = { night: d.night, place: 'by the creek', kept: i % 3 ? 'left' : 'cut' }; }); started = true; startNight(true); fade = 0;
    if (m[1]) { player.x = +m[1]; player.z = +m[2]; player.yaw = +m[3]; } V.homeLit = true; V.fireK = 1; V.moonAwake = true;
    items.forEach(it => { if (it.type !== 'tuft' && it.type !== 'stone') { it.awake = true; it.lit = 1; } });
    spots.forEach(s => { if (s.state === 'hidden' && s.def.night <= night) { s.state = 'bloom'; const p = mkPlant(s, 0, s.def.x, s.def.z); p.g = p.tg = 1; s.plants = [p]; } });
    if (m[4]) { const s = spots.find(s => s.def.sp === m[4]); if (s) { if (s.state === 'cut') { s.state = 'bloom'; const p = mkPlant(s, 0, s.def.x, s.def.z); p.g = p.tg = 1; s.plants = [p]; } player.x = s.def.x; player.z = s.def.z + 300; kneelAt(s); const g = goal; player.x = g.x; player.z = g.z; goal = null; g.fn(); player.yaw = kneel.yaw; player.eye = kneel.eye; } }
  } else startNight(true); }
{ const m = location.hash.match(/^#dark=(-?\d+),(-?\d+),(-?[\d.]+)/); if (m) { started = true; fade = 0; player.x = +m[1]; player.z = +m[2]; player.yaw = +m[3]; } }
if (location.hash === '#arrive') { enterForest(true); fade = 0; } // staged: the moment after the story
{ const m = location.hash.match(/^#stand=(-?[\d.]+)/); if (m) { enterForest(true); fade = 0; standUp(); spots[0].left = 1e9; tiltT = CAM.tilt = +m[1]; } } // staged: standing by the first flower, looking down or up
{ const m = location.hash.match(/^#tree=([\d.]+)/); if (m) { started = true; fade = 0; player.x = 60; player.z = -600; player.yaw = 0; tiltT = CAM.tilt = -0.25; items.forEach(it => { if (it.type === 'tree' && Math.hypot(it.x - 60, it.z + 1100) < 900) { it.awake = true; it.g = +m[1]; it.lit = 0.9; } }); } } // staged: trees part-way open
{ const m = location.hash.match(/^#lit=(-?\d+),(-?\d+),(-?[\d.]+)(?:,(-?[\d.]+))?(,wake)?/); if (m) { // staged: stand at x,z facing yaw (and pitch) with a steady light there; ',wake' wakes everything within 700
  started = true; fade = 0; tut = 3; player.x = +m[1]; player.z = +m[2]; player.yaw = +m[3]; tiltT = CAM.tilt = +(m[4] || 0); const lx = player.x + Math.sin(player.yaw) * 260, lz = player.z - Math.cos(player.yaw) * 260;
  stageLights = [{ x: lx, z: lz, r: 900, k: 0.8 }]; if (m[5]) items.forEach(it => { if (!it.sky && Math.hypot(it.x - lx, it.z - lz) < 700) { it.awake = true; if (it.type === 'tree') it.g = 1; } }); } }
if (location.hash === '#book') { found.daisy = { night: 1, place: 'by the camp', kept: 'left' }; started = true; fade = 0; Book.open(0, false); }
requestAnimationFrame(frame);
