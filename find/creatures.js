'use strict';
// Finding Flowers · creatures. An owl, a deer, a heron, frogs and moths, each built the way the flowers are:
// several lit parametric surfaces (body, head, wings, legs, ears) with their own part numbers, fine strokes for
// beaks, tines and toes, and an eye that catches the light. They are hidden in the dark like everything else,
// notice the light when it first reaches them, and wake on touch with a small event on the shared clock.
//
//   addCreatures()                         called at the end of buildWorld (once per night)
//   CREATURE[type] = { name, wake(it, near, pan), step?(it, s, bar, ch, t, near, pan) }
//   DRAW.owl / deer / heron / frog / moth  drawn by world.js when light reaches them or they are awake
//
// Staging for pictures (added to a #lit=... hash): "cw=3.5" treats woken creatures as woken 3.5 s ago,
// "calm" stops them from noticing the light.
const CRT = (() => {
  const TAU = 6.283185307, PI = Math.PI, cl = (x, a, b) => x < a ? a : x > b ? b : x, sm = x => x * x * (3 - 2 * x), ss = (a, b, x) => sm(cl((x - a) / (b - a), 0, 1)), lerp = (a, b, k) => a + (b - a) * k;
  const hh = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), rnd = Math.random;
  const DBG = { cw: +((location.hash.match(/cw=([\d.]+)/) || [])[1] || 0), calm: /calm/.test(location.hash), log: /clog/.test(location.hash), mfix: /mfix/.test(location.hash), lk: +((location.hash.match(/lk=([\d.]+)/) || [])[1] || 0) };
  let list = [], MG = null, lastMs = 0;

  // ───────── frames: 12 numbers, the world vectors of a part's forward, up and right axes, and its origin
  const W0 = [0, 0, -1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
  function sub(P, pf, pu, pr, a, b, c, k) { // a child frame at (pf, pu, pr) in P, turned right by a, pitched up by b, rolled by c, scaled by k
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), cb = Math.cos(b || 0), sb = Math.sin(b || 0), cc = Math.cos(c || 0), sc = Math.sin(c || 0), q = k || 1;
    const ff = ca * cb, fu = sb, fr = sa * cb, u2f = -ca * sb, u2u = cb, u2r = -sa * sb, r1f = -sa, r1r = ca;
    const uf = u2f * cc + r1f * sc, uu = u2u * cc, ur = u2r * cc + r1r * sc, rf = -u2f * sc + r1f * cc, ru = -u2u * sc, rr = -u2r * sc + r1r * cc, F = new Array(12);
    for (let i = 0; i < 3; i++) { const x = P[i], y = P[3 + i], z = P[6 + i]; F[i] = (ff * x + fu * y + fr * z) * q; F[3 + i] = (uf * x + uu * y + ur * z) * q; F[6 + i] = (rf * x + ru * y + rr * z) * q; F[9 + i] = P[9 + i] + pf * x + pu * y + pr * z; }
    return F;
  }
  const rootF = (x, y, z, yaw, pitch, roll, k) => sub(W0, -z, y, x, yaw, pitch, roll, k);
  let QX = 0, QY = 0, QZ = 0;
  function wp(F, f, u, r) { QX = F[9] + f * F[0] + u * F[3] + r * F[6]; QY = F[10] + f * F[1] + u * F[4] + r * F[7]; QZ = F[11] + f * F[2] + u * F[5] + r * F[8]; }

  // ───────── surfaces. cmesh: fn(s, w, i, j) sets LF LU LR in the part's frame; normals come from the surface itself
  const PP = new Float32Array(24 * 24 * 3), PN = new Float32Array(24 * 24 * 3); let LF = 0, LU = 0, LR = 0;
  function cmesh(F, ns, nw, fn, mat, own) {
    const row = nw + 1;
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nw; j++) { fn(i / ns, j / nw, i, j); wp(F, LF, LU, LR); const k = (i * row + j) * 3; PP[k] = QX; PP[k + 1] = QY; PP[k + 2] = QZ; }
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nw; j++) {
      const k = (i * row + j) * 3, a = ((i < ns ? i + 1 : i) * row + j) * 3, b = ((i > 0 ? i - 1 : i) * row + j) * 3, c = (i * row + (j < nw ? j + 1 : j)) * 3, d = (i * row + (j > 0 ? j - 1 : j)) * 3;
      const sx = PP[a] - PP[b], sy = PP[a + 1] - PP[b + 1], sz = PP[a + 2] - PP[b + 2], wx = PP[c] - PP[d], wy = PP[c + 1] - PP[d + 1], wz = PP[c + 2] - PP[d + 2];
      let nx = wy * sz - wz * sy, ny = wz * sx - wx * sz, nz = wx * sy - wy * sx; const l = Math.hypot(nx, ny, nz);
      if (l < 1e-6) { nx = sx; ny = sy; nz = sz; const l2 = Math.hypot(nx, ny, nz) || 1; if (i === 0) { nx = -nx; ny = -ny; nz = -nz; } nx /= l2; ny /= l2; nz /= l2; } else { nx /= l; ny /= l; nz /= l; }
      PN[k] = nx; PN[k + 1] = ny; PN[k + 2] = nz;
    }
    return surf(ns, nw, (i, j) => { const k = (i * row + j) * 3; WX = PP[k]; WY = PP[k + 1]; WZ = PP[k + 2]; NX = PN[k]; NY = PN[k + 1]; NZ = PN[k + 2]; }, mat, own);
  }
  // tube: sp(s, i) sets the centre SF SU SR and the two radii RA (in the bending plane) and RB (sideways)
  const TC = new Float32Array(26 * 5), TT = new Float32Array(26 * 6); let SF = 0, SU = 0, SR = 0, RA = 1, RB = 1;
  function tube(F, ns, nw, sp, mat, own, a0, a1) {
    for (let i = 0; i <= ns; i++) { sp(i / ns, i); const q = i * 5; TC[q] = SF; TC[q + 1] = SU; TC[q + 2] = SR; TC[q + 3] = RA; TC[q + 4] = RB; }
    for (let i = 0; i <= ns; i++) {
      const a = Math.min(ns, i + 1) * 5, b = Math.max(0, i - 1) * 5; let tf = TC[a] - TC[b], tu = TC[a + 1] - TC[b + 1], tr = TC[a + 2] - TC[b + 2]; const l = Math.hypot(tf, tu, tr) || 1; tf /= l; tu /= l; tr /= l;
      let sf, su, sr; if (Math.abs(tr) < 0.85) { sf = -tf * tr; su = -tu * tr; sr = 1 - tr * tr; } else { sf = -tf * tu; su = 1 - tu * tu; sr = -tr * tu; }
      const sl = Math.hypot(sf, su, sr) || 1; sf /= sl; su /= sl; sr /= sl; const q = i * 6;
      TT[q] = sf; TT[q + 1] = su; TT[q + 2] = sr; TT[q + 3] = su * tr - sr * tu; TT[q + 4] = sr * tf - sf * tr; TT[q + 5] = sf * tu - su * tf;
    }
    const A0 = a0 == null ? 0 : a0, A1 = a1 == null ? TAU : a1;
    return cmesh(F, ns, nw, (s, w, i) => { const a = A0 + (A1 - A0) * w, q = i * 5, p = i * 6, rb = TC[q + 4] * Math.cos(a), ra = TC[q + 3] * Math.sin(a); LF = TC[q] + TT[p] * rb + TT[p + 3] * ra; LU = TC[q + 1] + TT[p + 1] * rb + TT[p + 4] * ra; LR = TC[q + 2] + TT[p + 2] * rb + TT[p + 5] * ra; }, mat, own);
  }
  // a smooth curve through evenly spaced values, and through joints stored as rows of `st` numbers
  function cr(v, s) { const n = v.length - 1, x = cl(s, 0, 1) * n, i = Math.min(n - 1, x | 0), t = x - i, p0 = v[Math.max(0, i - 1)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(n, i + 2)]; return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - 3 * p2 + p3 - p0) * t * t * t); }
  function along(P, st, k, s) { const n = P.length / st - 1, x = cl(s, 0, 1) * n, i = Math.min(n - 1, x | 0), t = x - i, p0 = P[Math.max(0, i - 1) * st + k], p1 = P[i * st + k], p2 = P[(i + 1) * st + k], p3 = P[Math.min(n, i + 2) * st + k]; return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - 3 * p2 + p3 - p0) * t * t * t); }
  const limb = P => s => { SF = along(P, 5, 0, s); SU = along(P, 5, 1, s); SR = along(P, 5, 2, s); RA = Math.max(0.02, along(P, 5, 3, s)); RB = Math.max(0.02, along(P, 5, 4, s)); };
  const capK = (s, a, b) => { const e = s < a ? 1 - s / a : s > 1 - b ? (s - 1 + b) / b : 0; return Math.sqrt(Math.max(0, 1 - e * e)); }; // rounds off both ends of a tube
  function blob(F, cf, cu, cr0, af, au, ar, mat, own, ns, nw) { return tube(F, ns || 8, nw || 10, s => { const q = Math.sin(PI * s); SF = cf - af * Math.cos(PI * s); SU = cu; SR = cr0; RA = au * q + 0.01; RB = ar * q + 0.01; }, mat, own); }
  // fine things: a lit line through joints (rows of 3), a stroke, one glyph
  function wire(F, P, w0, w1, mat, own, seg) {
    const n = seg || 8; wp(F, P[0], P[1], P[2]); let ok = PR.proj(QX, QY, QZ), pu = PR.u, pv = PR.v, pz = PR.z, ps = PR.s;
    for (let q = 1; q <= n && ok; q++) { const s = q / n; wp(F, along(P, 3, 0, s), along(P, 3, 1, s), along(P, 3, 2, s)); ok = PR.proj(QX, QY, QZ); if (ok) { G.line(pu, pv, pz, PR.u, PR.v, PR.z, Math.max(0.6, lerp(w0, w1, s) * (ps + PR.s) * 0.5), mat, own); pu = PR.u; pv = PR.v; pz = PR.z; ps = PR.s; } }
  }
  function ink(F, f0, u0, r0, f1, u1, r1, ci, al, own, wh) { wp(F, f0, u0, r0); const x = QX, y = QY, z = QZ; wp(F, f1, u1, r1); stroke(x, y, z, QX, QY, QZ, ci, al, own, wh); }
  function dot(F, f, u, r, ci, ch, al, wh, own, zb) { if (al < 0.03) return false; wp(F, f, u, r); if (!PR.proj(QX, QY, QZ)) return false; G.plot(PR.u, PR.v, PR.z + (zb == null ? 0.6 : zb), ci, ch, al, wh || 0, own); return true; }

  // ───────── materials (made once)
  function mats() {
    if (MG) return MG; const m = o => G.material(Object.assign({ ao: 0, amb: 0.1, dif: 0.8, rim: 0.12, spec: 0.12, edge: 0.05, back: 1 }, o));
    MG = {
      coat: m({ ramp: ['#2e2016', '#7d5a3c', '#c79f72', '#f6e6c8'], mode: 'hatch', vein: 0.1 }),
      hide: m({ ramp: ['#2e2016', '#7d5a3c', '#c79f72', '#f6e6c8'], flat: 0.3, spec: 0.08 }),
      belly: m({ ramp: ['#3a2c20', '#94775a', '#dcc09a', '#fff0d8'], mode: 'hatch' }),
      mane: m({ ramp: ['#241810', '#634630', '#a88560', '#e6d2b0'], mode: 'hatch', vein: 0.3 }),
      pale: m({ ramp: ['#4a3c2c', '#a8957a', '#e4d6bc', '#ffffff'], mode: 'hatch' }),
      ear: m({ ramp: ['#3a261c', '#8a6a50', '#d9b48e', '#ffe9d0'], mode: 'hatch', edge: 0.12 }),
      ant: m({ ramp: ['#3a3226', '#8f8266', '#d6c8a4', '#fff6dc'], mode: 'hatch', amb: 0.3, dif: 0.6 }),
      antG: m({ ramp: ['#7a3a08', '#ff9a2e', '#ffb347', '#ffd27a'], mode: 'hatch', amb: 0.85, dif: 0.3, rim: 0, spec: 0 })
    };
    Object.assign(MG, {
      bough: m({ ramp: ['#3d2f23', '#8a735e', '#c9b49a', '#f6ead6'], mode: 'hatch', vein: 0.3, dif: 0.85 }),
      obreast: m({ ramp: ['#3a2a18', '#9a7a50', '#dcc294', '#fff2d6'], gl: ".:;vvvvv", vein: 0.5, edge: 0 }),
      oback: m({ ramp: ['#1e150d', '#5a422a', '#96744a', '#d6b888'], mode: 'hatch', vein: 0.25 }),
      ohead: m({ ramp: ['#241a10', '#6a4e30', '#a8845a', '#e6cba0'], mode: 'hatch' }),
      odisc: m({ ramp: ['#4a3a26', '#b0926a', '#e6d2ac', '#fff6e2'], mode: 'hatch', amb: 0.22, edge: 0 }),
      hbody: m({ ramp: ['#1e2630', '#5a6c84', '#9fb2c8', '#e8f0fa'], mode: 'hatch' }),
      hcov: m({ ramp: ['#1e2630', '#5a6c84', '#9fb2c8', '#e8f0fa'], mode: 'hatch', vein: 0.3, edge: 0.1 }),
      hrem: m({ ramp: ['#141a24', '#36435c', '#62749a', '#aab9d2'], mode: 'hatch', vein: 0.45, edge: 0.1 }),
      hneck: m({ ramp: ['#3a4048', '#98a2ae', '#dfe6ee', '#ffffff'], mode: 'hatch', vein: 0.3 }),
      hbill: m({ ramp: ['#6a4a10', '#d89a2a', '#ffc85a', '#fff0c0'], mode: 'hatch', amb: 0.3 }),
      hleg: m({ ramp: ['#2a2a1c', '#6a6a48', '#a8a878', '#e0e0b8'], mode: 'hatch', amb: 0.45 }),
      hplume: m({ ramp: ['#1a2030', '#3a4866', '#6a7c9e', '#aabbd6'], mode: 'hatch', amb: 0.3 }),
      fback: m({ ramp: ['#0f2a16', '#3f7a3a', '#8fc05a', '#e2f5a0'], flat: 0.5, spec: 0.55, rim: 0.2 }),
      fbelly: m({ ramp: ['#3a3a22', '#9a9a62', '#e0dca8', '#ffffee'], flat: 0.5, spec: 0.3 }),
      mwing: m({ ramp: ['#1c3a2a', '#6fae84', '#c9f0b4', '#f6ffe6'], mode: 'hatch', vein: 0.3, amb: 0.3, dif: 0.65, edge: 0.1 }),
      mbody: m({ ramp: ['#4a4a40', '#a8a890', '#e8e6d0', '#ffffff'], mode: 'hatch', amb: 0.3 })
    });
    MG.c = { mtail: G.col('#c9f0b4'), beak: G.col('#e0d090'), gold: G.col('#ffd866'), slate: G.col('#7f93b4'), plume: G.col('#e6edf6'), toe: G.col('#b8b888'), frog: G.col('#a8d070'), maroon: G.col('#c05a7a'), spot: G.col('#fff2a0'), mant: G.col('#e8e6c0'), dust: G.col('#d9ff8a'), bone: G.col('#e8dcc0'), eye: G.col('#f4e8b0'), amber: G.col('#ffc45e'), warm: G.col('#ff8a2a'), white: G.col('#ffffff'), dark: G.col('#3a2a1e'), nose: G.col('#4a3a30') };
    return MG;
  }
  // how lit a creature is: sets the dimmer for its surfaces, returns the alpha for its strokes and glyphs
  function lightOf(it, boost) { G.lit[it.idx + 1] = Math.min(1.15, (it.lit * 1.15 + it.flash * 0.5) * (it.fadeK == null ? 1 : it.fadeK) + (boost || 0)); return Math.min(1, (it.lit * 1.4 + it.flash * 0.4) * (it.fadeK == null ? 1 : it.fadeK)); }
  // has the light just reached it? (each creature reacts once, and forgets after a while in the dark)
  function notice(it, T, dt) {
    if (DBG.calm) return; if (it.lit > 0.2) { it.dark = 0; if (!it.seen) { it.seen = true; it.nt = T; } } else { it.dark = (it.dark || 0) + dt; if (it.dark > 14 && !it.awake) it.seen = false; }
  }
  const toEye = it => wrapA(Math.atan2(CAM.x - it.x, -(CAM.z - it.z)) - it.h); // the angle from its heading to you
  const ease = (v, tg, rate, dt) => v + (tg - v) * (1 - Math.exp(-dt * rate));
  const audioAt = (T, t) => M.on ? T + (t - M.now) : T; // the frame time at which audio time t sounds

  // ═════════ the deer: a red stag grazing on the hill
  const D_TOP = [94, 105, 103, 101.5, 103.5, 109, 101], D_BOT = [86, 80, 74, 68, 62, 57, 72], D_WID = [9, 17.5, 16.5, 16, 17, 16, 9];
  const D_FORE = [31, 88, 9, 10, 7.5, 33, 68, 8.5, 8, 6, 34.5, 50, 8, 5.4, 4.4, 35, 37, 7.6, 4.3, 3.9, 35, 23, 7.5, 2.9, 2.7, 35, 10, 7.5, 3.4, 3.1, 36.5, 3.5, 7.5, 3.2, 3.4, 37.5, 0, 7.5, 3.5, 3.5];
  const D_HIND = [-40, 88, 9, 13, 8.5, -36, 70, 9.5, 11, 7.5, -43, 56, 9, 6.4, 5, -52, 45, 8.5, 4.3, 3.7, -50, 28, 8.2, 3, 2.8, -48, 10, 8, 3.4, 3.1, -46.5, 3.5, 8, 3.2, 3.4, -45.5, 0, 8, 3.5, 3.5];
  // antlers, right side, in the head's frame: the beam, then five tines (brow, bez, trez, and a crown of two with the beam tip)
  const D_BEAM = [1, 7.5, 4, -3, 16, 9, -10, 29, 16, -14, 43, 21, -13, 55, 22, -8, 66, 19];
  const D_TINE = [[0, 10.5, 6, 9, 13, 9, 15, 19.5, 10.5], [-4.5, 18, 10.5, 5, 21.5, 14, 10, 28, 15.5], [-13, 39, 20, -5, 43, 24.5, -1, 50, 25.5], [-13.5, 53, 22, -18, 60, 25.5, -19, 68, 26], [-11, 60, 21, -12, 68, 18, -11, 76, 14.5]];
  const D_DEG = [3, 5, 6, 8, 7, 9, 10, 12, 11, 13, 12, 15], D_STEP = 2;
  function deerWake(it, T, near, pn, silent) {
    it.awake = true; it.wt = T; it.tine = []; const t0 = M.on && !silent ? M.quant(M.now + 1.1) : 0;
    for (let i = 0; i < 12; i++) {
      if (M.on && !silent) { const t = t0 + i * D_STEP * M.STEP; M.fm(t, M.fit(M.pent(D_DEG[i]), M.chAt(t)), { g: 0.085 * near, dec: 2.4, ratio: 3.01, idx: 0.55, idxDec: 0.25, att: 0.006, rv: 0.75, dv: 0.3, pan: pn + (i & 1 ? 0.12 : -0.12) }); it.tine[i] = audioAt(T, t); }
      else it.tine[i] = T + 1.1 + i * D_STEP * M.STEP;
    }
    it.w0 = it.tine[11] + 1.6; // then it walks
    if (M.on && !silent) for (let i = 0; i < 6; i++) { const t = M.quant(M.now + (it.w0 - T)) + (i * 4 + 2) * M.STEP; M.fm(t, M.fit(M.pent(-5 + (i & 1)), M.chAt(t)), { g: 0.06 * near, dec: 0.45, att: 0.012, ratio: 1, idx: 0.8, idxDec: 0.1, rv: 0.4, pan: pn }); }
  }
  function tickDeer(it, T, dt) {
    notice(it, T, dt); if (it.awake && it.wt == null) deerWake(it, T - DBG.cw, 1, 0, true);
    const per = 8 * M.STEP, walkLen = per * 3; let walking = 0;
    if (it.awake) { const k = T - it.w0; if (k > 0 && k < walkLen) { walking = ss(0, 0.7, k) * (1 - ss(walkLen - 0.9, walkLen, k)); it.gait += walking * dt / per; const d = walking * 26 / (0.65 * per) * dt; it.x += Math.sin(it.h) * d; it.z -= Math.cos(it.h) * d; if (it.solid) { it.solid.x = it.x; it.solid.z = it.z; } } }
    it.walking = walking;
    const alert = it.awake || (it.seen && T - it.nt > 0.25), tgUp = it.awake ? (walking > 0.1 ? 0.8 : 1) : alert ? 0.93 : 0;
    it.up = ease(it.up, tgUp, tgUp > it.up ? 3.4 : 0.7, dt);
    const tgLook = walking > 0.1 ? 0 : alert ? cl(toEye(it), -1.45, 1.45) : Math.sin(T * 0.21 + it.ph) * 0.12;
    it.look = ease(it.look, tgLook, 2.6, dt);
    if (T > it.efN) { it.ef = T; it.efS = rnd() < 0.5 ? -1 : 1; it.efN = T + 1.5 + rnd() * 5; }
    if (T > it.blN) { it.bl = T; it.blN = T + 2.5 + rnd() * 5; }
    if (it.awake && T > it.tine[0]) { const n = it.tine.filter(t => T > t).length; lightsN.push({ x: it.x, z: it.z, r: 240 + 22 * n, k: 0.2 + 0.035 * n }); } // the lit antlers hold a pool of light
  }
  function drawDeer(it) {
    mats(); const T = V.T, own = (it.idx + 1) << 8, al = lightOf(it), C = MG.c, br = Math.sin(T * 1.25 + it.ph), wk = it.walking || 0, g = it.gait * TAU;
    const bob = wk * 0.9 * Math.sin(g * 2), F = rootF(it.x, 0, it.z, it.h, 0, 0, 0.95);
    // barrel, from the rump to the chest
    const barrel = s => { const cap = capK(s, 0.2, 0.14), t = cr(D_TOP, s), b = cr(D_BOT, s); SF = -58 + 106 * s; SU = (t + b) / 2 + bob; SR = 0; RA = (t - b) / 2 * cap + 0.02; RB = cr(D_WID, s) * cap * (1 + 0.02 * br) + 0.02; };
    tube(F, 16, 12, barrel, MG.hide, own | 1, -0.75, PI + 0.75); tube(F, 16, 6, barrel, MG.belly, own | 1, PI + 0.75, TAU - 0.75);
    for (const sd of [-1, 1]) { blob(F, -40, 80 + bob, sd * 8.5, 19, 22, 10, MG.hide, own | 1, 6, 8); blob(F, 32, 80 + bob, sd * 8.5, 13, 24, 9, MG.hide, own | 1, 6, 8); }
    // tail
    { const fl = Math.max(0, 1 - (T - it.ef) * 3) * it.efS; tube(F, 5, 6, s => { SF = -57 - 4 * s - 2 * s * s; SU = 96 - 15 * s + bob; SR = fl * 4 * s; RA = 2.6 * capK(s, 0.2, 0.3) + 0.02; RB = 3.4 * capK(s, 0.2, 0.3) + 0.02; }, MG.pale, own | 8); }
    // legs: a slow walk moves each foot back along the ground and then lifts it forward
    const LEG = [[D_HIND, -1, 0, -9], [D_FORE, -1, 0.25, 6], [D_HIND, 1, 0.5, 0], [D_FORE, 1, 0.75, 0]], J = drawDeer.J || (drawDeer.J = new Array(40));
    LEG.forEach((lg, n) => {
      const P = lg[0], p = ((it.gait + lg[2]) % 1 + 1) % 1, st = 26; let df = 0, lift = 0;
      if (wk > 0.001) { if (p < 0.65) df = st * (0.5 - p / 0.65); else { const q = (p - 0.65) / 0.35; df = st * (sm(q) - 0.5); lift = Math.sin(PI * q) * 9; } df *= wk; lift *= wk; }
      for (let k = 0; k < 8; k++) { const q = k / 7, o = k * 5; J[o] = P[o] + (df + lg[3] * (1 - wk)) * Math.pow(q, 1.4) + lift * 0.9 * Math.sin(PI * q) * (P === D_FORE ? 1 : -0.6); J[o + 1] = P[o + 1] + lift * q + (k < 2 ? bob : 0); J[o + 2] = P[o + 2] * lg[1]; J[o + 3] = P[o + 3]; J[o + 4] = P[o + 4]; }
      tube(F, 14, 6, limb(J), MG.coat, own | (2 + n));
    });
    // neck and head: down in the grass, or up and turned toward you
    const up = it.up, lk = it.look, th = lerp(-1.02, 1.1, up) + 0.02 * br + wk * 0.05 * Math.sin(g * 2 + 1), bow = lerp(0.55, -0.35, up), Ln = 60;
    const NF = sub(F, 43, 92 + bob, 0, lk * 0.3, 0, 0); let nf = 0, nu = 0;
    tube(NF, 10, 10, (s, i) => { const a = th + bow * (s - 0.5); if (i) { nf += Math.cos(a) * Ln / 10; nu += Math.sin(a) * Ln / 10; } SF = nf; SU = nu; SR = 0; const q = Math.pow(s, 0.75); RA = lerp(18, 8.4, q); RB = lerp(11.5, 6.5, q); }, MG.mane, own | 6);
    const chew = up < 0.3 ? Math.sin(T * 5.2) * 0.02 : 0, HF = sub(NF, nf, nu, 0, lk * 0.7, lerp(-1.3, -0.3, up) + chew, lk * 0.12 * up, 1.1);
    tube(HF, 12, 10, s => { const cap = capK(s, 0.1, 0.07); SF = -6 + 34 * s; SU = cr([1, 1.6, 1.2, -0.3, -1.8, -2.6, -3.2], s); SR = 0; RA = cr([6.6, 8.2, 7.6, 6, 4.7, 4.1, 3.6], s) * cap + 0.02; RB = cr([5.6, 7.2, 6.5, 5, 4, 3.6, 3.3], s) * cap + 0.02; }, MG.hide, own | 7);
    const blink = T - it.bl < 0.16;
    for (const sd of [-1, 1]) {
      if (!blink) dot(HF, 9.5, 3, sd * 5.2, C.eye, PR.s > 0.45 ? '0' : 'o', al, 0.35 * al, own | 7, 0.8);
      // ears: cupped leaves that flick
      const fl = it.efS === sd ? Math.max(0, 1 - (T - it.ef) * 4) * Math.sin((T - it.ef) * 30) * 0.5 : 0, EF = sub(HF, -3, 5, sd * 5.2, sd * (1.45 + fl - 0.2 * up), 0.55 + 0.15 * up, -sd * 1.15);
      cmesh(EF, 7, 4, (s, w) => { const x = w * 2 - 1, wd = 4.2 * Math.pow(Math.sin(PI * Math.pow(s, 0.62)), 0.7) + 0.05; LF = s * 15; LR = x * wd; LU = 2.6 * x * x * (1 - 0.6 * s) - 1.2 * s * s; }, MG.ear, own | 9);
      // antlers: the beam and its tines, each lit in turn once it is awake
      const lit = k => it.awake && it.tine && T > it.tine[k * 2 + (sd > 0 ? 1 : 0)], tip = (P, k) => { const a = it.awake && it.tine ? T - it.tine[k * 2 + (sd > 0 ? 1 : 0)] : -1; if (a > 0) dot(HF, P[P.length - 3], P[P.length - 2] + 1, P[P.length - 1] * sd, a < 1.4 ? C.white : C.amber, '*', a < 1.4 ? 1 : 0.55 + 0.25 * Math.sin(T * 1.7 + k), a < 1.4 ? 1 - a / 1.4 : 0.15, own | 10, 1); };
      const Tn = drawDeer.T || (drawDeer.T = new Array(9));
      for (let k = 0; k < 5; k++) { // the beam in five lengths; each lights with the tine that leaves it
        for (let q = 0; q < 3; q++) { const s = (k + q / 2) / 5; Tn[q * 3] = along(D_BEAM, 3, 0, s); Tn[q * 3 + 1] = along(D_BEAM, 3, 1, s); Tn[q * 3 + 2] = along(D_BEAM, 3, 2, s) * sd; }
        wire(HF, Tn, lerp(3, 1.5, k / 5), lerp(3, 1.5, (k + 1) / 5), lit(Math.min(4, k)) ? MG.antG : MG.ant, own | 10, 3);
      }
      tip(D_BEAM, 4);
      for (let k = 0; k < 5; k++) { const P = D_TINE[k]; for (let q = 0; q < 9; q++) Tn[q] = P[q] * (q % 3 === 2 ? sd : 1); wire(HF, Tn, 2, 0.8, lit(k === 4 ? 5 : k) ? MG.antG : MG.ant, own | 10, 5); tip(P, k === 4 ? 5 : k); }
    }
  }

  // ═════════ the owl: an eagle owl asleep on a willow bough
  function owlCall(it, t, g, pn) { // two low notes, the second lower and longer; it puffs with each
    const ch = M.chAt(t), hoot = (tt, m, gg, dec) => M.fm(tt, m, { g: gg, att: 0.08, dec, ratio: 1, idx: 0.35, idxDec: 0.6, glide: 0.93, glideT: 0.11, rv: 0.75, dv: 0.1, pan: pn });
    hoot(t, M.fit(M.pent(4), ch), g, 0.5); hoot(t + 3 * M.STEP, M.fit(M.pent(2), ch), g * 0.85, 0.85);
    M.vis(t, () => { it.hoot = [V.T, V.T + 3 * M.STEP]; });
  }
  function owlWake(it, T, near, pn, silent) {
    const first = !it.awake; it.awake = true; it.band = true; it.wt = T;
    if (M.on && !silent) owlCall(it, M.quant(M.now + 0.03), (first ? 0.17 : 0.12) * near, pn); else it.hoot = [T + 0.1, T + 0.1 + 3 * M.STEP];
  }
  function tickOwl(it, T, dt) {
    notice(it, T, dt); if (it.awake && it.wt == null) owlWake(it, T - DBG.cw, 1, 0, true);
    const alert = it.awake || it.seen; it.open = ease(it.open, alert ? 1 : 0, alert ? 6 : 1, dt);
    if (it.seen && !it.saw) { it.saw = true; it.hdT = cl(toEye(it), -2.3, 2.3); it.hdN = T + 4; it.tl = T; } if (!it.seen) it.saw = false;
    if (T > it.hdN) { it.hdT = alert ? cl(toEye(it) + (rnd() < 0.35 ? (rnd() - 0.5) * 2.2 : 0), -2.3, 2.3) : (rnd() - 0.5) * 0.5; it.hdN = T + (alert ? 2.5 + rnd() * 4 : 6 + rnd() * 7); }
    it.hd = ease(it.hd, it.hdT, 6.5, dt); // owls turn their heads in quick steps
    if (T > it.blN) { it.bl = T; it.blN = T + 3 + rnd() * 5; }
  }
  function drawOwl(it) {
    mats(); const T = V.T, own = (it.idx + 1) << 8, al = lightOf(it), C = MG.c, br = Math.sin(T * 1.5 + it.ph), A = G.S.A;
    let puff = 0; if (it.hoot) for (const h of it.hoot) { const a = T - h; if (a > 0 && a < 0.7) puff = Math.max(puff, Math.sin(PI * a / 0.7)); }
    const BF = rootF(it.bx, it.by, it.bz, it.bh);
    tube(BF, 10, 6, s => { SF = -6 + 106 * s; SU = 14 * s - 9 * s * s; SR = 0; RA = RB = lerp(4.6, 1.3, Math.pow(s, 0.8)); }, MG.bough, own | 1);
    for (let i = 0; i < 3; i++) { const q = 0.78 + i * 0.07; ink(BF, -6 + 106 * q, 14 * q - 9 * q * q, 0, 4 + 106 * q, 14 * q - 9 * q * q - 26 - i * 9, (i - 1) * 7, COL.leaf, al * 0.6, own | 1); }
    const OF = rootF(it.x, it.py, it.z, it.h, 0, 0, 1.1), k = 1 + 0.025 * br + 0.07 * puff;
    const DEP = [5, 10.5, 12.5, 12.5, 11, 9.5, 8], WID = [5.5, 12, 14.5, 15, 13.5, 11.5, 9.5];
    const body = s => { const c = capK(s, 0.16, 0.12); SF = lerp(-3.5, 1.5, s); SU = 1 + 40 * s; SR = 0; RA = cr(DEP, s) * c * k + 0.02; RB = cr(WID, s) * c * k + 0.02; };
    tube(OF, 12, 8, body, MG.oback, own | 2, -0.6, PI + 0.6); tube(OF, 12, 8, body, MG.obreast, own | 3, PI + 0.6, TAU - 0.6);
    // folded wings: shields over the sides and back, shingled in rows
    const wing = s => { const sc = 1 + 0.04 * Math.abs(Math.sin(s * PI * 6)); SF = lerp(-1, -6.5, s); SU = 37 - 44 * s; SR = 0; RA = cr([9, 13.5, 14.5, 14, 11.5, 7.5, 2.5], s) * sc * k; RB = cr([10.5, 15.5, 17, 16.5, 13, 8, 2.5], s) * sc * k; };
    tube(OF, 14, 6, wing, MG.oback, own | 4, -0.5, 1.3); tube(OF, 14, 6, wing, MG.oback, own | 5, PI - 1.3, PI + 0.5);
    cmesh(OF, 4, 4, (s, w) => { LF = -8 - 3 * s; LU = 4 - 18 * s; LR = (w * 2 - 1) * (5 + 2.5 * s); }, MG.oback, own | 9);
    // feathered feet and talons on the bough
    for (const sd of [-1, 1]) { blob(OF, 1, 2.6, sd * 5, 3, 3.2, 3, MG.obreast, own | 3, 4, 6); for (let j = -1; j <= 1; j++) ink(OF, 3, 1.6, sd * 5 + j * 1.5, 6, -2.6, sd * 5 + j * 2.3, C.beak, al * 0.9, own | 3); }
    // the head turns on its own
    const tilt = it.tl ? 0.3 * Math.sin(Math.min(PI, (T - it.tl) * 1.1)) * (it.hd > 0 ? 1 : -1) : 0, HF = sub(OF, 1.5, 44.5, 0, it.hd, -0.08 + 0.06 * puff, tilt);
    tube(HF, 10, 12, s => { const q = Math.sin(PI * s); SF = 0; SU = -10.5 * Math.cos(PI * s); SR = 0; RA = 10.5 * q + 0.02; RB = 13 * Math.pow(q, 0.85) + 0.02; }, MG.ohead, own | 6);
    const blink = T - it.bl < 0.17, op = it.open;
    for (const sd of [-1, 1]) {
      // facial disc: a shallow dish of fine feathers that run out from the eye
      cmesh(HF, 5, 14, (s, w) => { const ro = 6.7 * s, ph = w * TAU, r = sd * 5.5 + ro * Math.cos(ph) * 0.95, u = 1 + ro * Math.sin(ph) * 1.12; LR = r; LU = u; LF = 10.5 * Math.sqrt(Math.max(0.04, 1 - u * u / 110 - r * r / 169)) + 0.35 + 0.9 * s * s; }, MG.odisc, own | 6);
      const glow = it.awake ? 0.55 + 0.25 * Math.sin(T * 2.1) + 0.3 * puff : 0.2;
      if (op < 0.4 || blink) { if (dot(HF, 10.9, 1, sd * 5.5, C.dark, '-', al, 0, own | 6, 0.9)) { G.plot(PR.u - A, PR.v, PR.z + 0.9, C.dark, '-', al, 0, own | 6); G.plot(PR.u + A, PR.v, PR.z + 0.9, C.dark, '-', al, 0, own | 6); } }
      else if (dot(HF, 10.9, 1, sd * 5.5, it.awake ? C.amber : C.gold, PR.s > 0.4 ? 'O' : 'o', al, glow * al, own | 6, 0.9)) { const rc = it.awake ? C.warm : C.dark; G.plot(PR.u - A, PR.v, PR.z + 0.9, rc, '(', al, 0, own | 6); G.plot(PR.u + A, PR.v, PR.z + 0.9, rc, ')', al, 0, own | 6); }
      // ear tufts lift when it is alert
      const EF = sub(HF, 1.5, 7.5, sd * 8, sd * 1.15, lerp(0.75, 1.15, op), PI / 2);
      cmesh(EF, 5, 2, (s, w) => { const x = w * 2 - 1; LF = s * 11.5; LR = x * 2.8 * Math.pow(Math.sin(PI * Math.pow(s, 0.5)), 0.8); LU = 0.7 * x * x; }, MG.ohead, own | 8);
    }
    dot(HF, 11.4, -2.6, 0, C.beak, 'v', al, 0.1, own | 6, 1);
  }

  // ═════════ the heron: grey, tall, standing in the shallows; touched, it opens its wings and leaves
  const H_REL = [0, 0, 5, 8, -2, 17, -1, 25, 5, 31], H_TALL = [0, 0, 5, 12, 2, 25, 2, 37, 6, 46], H_FLY = [0, 0, 10, -1, 12, 6, 2, 8, 8, 9];
  const H_LEG = [0, 0, -4, -23, -0.5, -48, 0, -54], H_TRAIL = [0, 0, -22, -2, -46, -3, -53, -3.5];
  function heronWake(it, T, near, pn, silent) {
    if (it.awake && it.wt != null) return; it.awake = true; it.wt = T; it.per = 2 * M.STEP; it.fn = -1;
    if (M.on && !silent) {
      const t0 = M.quant(M.now + 1.45); it.f0 = audioAt(T, t0);
      M.swell(M.now + 0.2, pn, 0.05 * near, 300, 1500, 2.6); M.play('moon', M.quant(M.now + 0.05), M.fit(M.pent(9), M.chAt(M.now)), 0.7 * near, pn);
      for (let i = 0; i < 6; i++) { const t = t0 + i * it.per; M.burst(t, 0.035 * near * (1 - i / 7), pn - i * 0.08, 420, 0.17, 0.5, 'lowpass'); if (i < 3) M.play('drip', t + M.STEP, M.fit(M.pent(-3 + i * 2), M.chAt(t)), (0.5 - i * 0.12) * near, pn - i * 0.08); }
    } else it.f0 = T + 1.45;
    if (!silent && typeof say === 'function') say('it was standing there the whole time.');
  }
  function tickHeron(it, T, dt) {
    notice(it, T, dt); if (it.awake && it.wt == null) heronWake(it, T - DBG.cw, 1, 0, true);
    if (!it.awake) {
      it.e = ease(it.e, it.seen ? 1 : 0.3 + 0.25 * Math.sin(T * 0.3 + it.ph), it.seen ? 1.3 : 0.6, dt);
      it.look = ease(it.look, it.seen ? cl(toEye(it) * 0.85, -1.3, 1.3) : 0.4 * Math.sin(T * 0.17 + it.ph), 1.1, dt);
      if (T > it.rpN) { if (it.lit > 0.1) ripple(it.x + 3, it.z, 0.3); it.rpN = T + 7 + rnd() * 9; } return;
    }
    it.e = ease(it.e, 1, 3, dt); it.look = ease(it.look, 0, 2, dt); const tau = T - it.f0;
    if (tau > 0) {
      const k = ss(0, 5, tau), sp = lerp(22, 175, k); it.h += dt * 0.42 * ss(0.3, 1.2, tau) * (1 - ss(3.2, 5.5, tau)); it.x += Math.sin(it.h) * sp * dt; it.z -= Math.cos(it.h) * sp * dt; it.alt += dt * lerp(13, 30, k); it.trav += sp * dt;
      const n = Math.floor(tau / it.per + 0.5); if (n !== it.fn) { it.fn = n; if (it.alt < 70 && n < 4) ripple(it.x, it.z, 0.9 - n * 0.2); }
      it.fadeK = 1 - ss(800, 1600, it.trav); if (it.trav > 1600) it.gone = true;
    }
  }
  function heronWing(B, sd, o1, o2, o3, p1, p2, p3, own) {
    const th = [lerp(1.2, 0.25, o1), lerp(-1.35, -0.15, o2), lerp(1.45, 0.2, o3)], ps = [p1, p2, p3], LEN = [20, 22, 26], J = heronWing.J, Av = heronWing.A, open = (o1 + o2 + o3) / 3;
    J[0] = 12; J[1] = 6; J[2] = sd * 7;
    for (let k = 0; k < 3; k++) { const au = Math.sin(ps[k]), ar = sd * Math.cos(ps[k]), c = Math.cos(th[k]), sn = Math.sin(th[k]); Av[k * 3] = -sn; Av[k * 3 + 1] = au * c; Av[k * 3 + 2] = ar * c; J[k * 3 + 3] = J[k * 3] + Av[k * 3] * LEN[k]; J[k * 3 + 4] = J[k * 3 + 1] + Av[k * 3 + 1] * LEN[k]; J[k * 3 + 5] = J[k * 3 + 2] + Av[k * 3 + 2] * LEN[k]; }
    const CH = [13, 19, 21, 20, 17, 9];
    const at = (v, ch, off) => { // a point of the wing: span v, distance ch along the feather, lifted off by `off`
      const x = v < 0.3 ? v / 0.3 : v < 0.62 ? 1 + (v - 0.3) / 0.32 : 2 + (v - 0.62) / 0.38, k = Math.min(2, x | 0), t = x - k, psi = lerp(ps[k], ps[Math.min(2, k + 1)], t * t);
      const fan = ss(0.58, 1, v) * 0.92, df = -1 * (1 - fan) + Av[6] * fan, du = Av[7] * fan, dr = Av[8] * fan, dl = Math.hypot(df, du, dr) || 1;
      const c = cr(CH, v) * (0.72 + 0.28 * open) * (1 - 0.08 * Math.abs(Math.sin(17 * (2 * v - 1) / 2))) * ch;
      LF = lerp(J[k * 3], J[k * 3 + 3], t) + df / dl * c; LU = lerp(J[k * 3 + 1], J[k * 3 + 4], t) + du / dl * c + Math.cos(psi) * off; LR = lerp(J[k * 3 + 2], J[k * 3 + 5], t) + dr / dl * c - sd * Math.sin(psi) * off;
    };
    cmesh(B, 5, 20, (s, w) => at(w, 0.3 + 0.7 * s, -0.5), MG.hrem, own | (sd > 0 ? 3 : 13));
    cmesh(B, 4, 20, (s, w) => at(w, 0.5 * s - 0.03, 0.7 + 0.5 * Math.sin(PI * s)), MG.hcov, own | (sd > 0 ? 4 : 14));
  }
  heronWing.J = new Array(12); heronWing.A = new Array(9);
  function drawHeron(it) {
    if (it.gone) return; mats(); const T = V.T, own = (it.idx + 1) << 8, al = lightOf(it), C = MG.c, br = Math.sin(T * 1.1 + it.ph);
    const t = it.awake && it.wt != null ? T - it.wt : -1, tau = t >= 0 ? T - it.f0 : -1, fly = tau > 0, flK = fly ? ss(0, 1.7, tau) : 0, ph = fly ? tau / it.per : 0;
    const o1 = t < 0 ? 0 : ss(0.12, 0.85, t), o2 = t < 0 ? 0 : ss(0.4, 1.1, t), o3 = t < 0 ? 0 : ss(0.65, 1.38, t);
    const amp = lerp(0.68, 0.5, flK), flap = d => fly ? 0.12 + amp * Math.cos(TAU * ph - d) : lerp(-1.25, 0.78, o1) - d * 0.25 * o1;
    const crouch = t < 0 ? 0 : 6 * ss(it.f0 - it.wt - 0.6, it.f0 - it.wt - 0.05, t) * (1 - ss(0, 0.25, tau)), pitch = lerp(0.62, 0.1, flK) + 0.015 * br, bob = fly ? 3 * Math.sin(TAU * ph - 0.6) * (0.4 + 0.6 * flK) : 0;
    const R = rootF(it.x, it.alt + bob, it.z, it.h), B = sub(R, 0, 54 - crouch, 0, 0, pitch, fly ? 0.14 * ss(0.3, 1.5, tau) * (1 - ss(3.2, 5.5, tau)) : 0);
    // body
    tube(B, 10, 8, s => { const c = capK(s, 0.18, 0.2); SF = -20 + 40 * s; SU = 1.5 * Math.sin(PI * s); SR = 0; RA = cr([3, 7, 8.6, 9, 8, 5.5], s) * c * (1 + 0.02 * br) + 0.02; RB = cr([2.6, 6, 7.4, 7.4, 6.5, 4.5], s) * c + 0.02; }, MG.hbody, own | 1);
    // legs: thin, with the joint that bends backward; in the air they trail behind
    const lt = fly ? ss(0.2, 2.4, tau) : 0, cp = Math.cos(pitch), sp = Math.sin(pitch), P = drawHeron.P;
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 4; k++) { const df = H_LEG[k * 2] + (k === 1 ? sd * 1.5 : 0), du = H_LEG[k * 2 + 1] + (k > 0 ? crouch : 0) * (k / 3); P[k * 3] = -3 + lerp(cp * df + sp * du, H_TRAIL[k * 2], lt); P[k * 3 + 1] = -5 + lerp(-sp * df + cp * du, H_TRAIL[k * 2 + 1] + sd * 0.8, lt); P[k * 3 + 2] = sd * 3; }
      wire(B, P, 1.9, 1.3, MG.hleg, own | 5, 9);
      if (lt > 0.3) for (let j = -1; j <= 1; j++) ink(B, P[9], P[10], P[11], P[9] - 6, P[10] - 0.5 + j * 1.6, P[11] + j * 1.2, C.toe, al * 0.8, own | 5);
    }
    heronWing(B, 1, o1, o2, o3, flap(0), flap(0.55), flap(1.15), own); heronWing(B, -1, o1, o2, o3, flap(0), flap(0.55), flap(1.15), own);
    // neck: an S that lengthens when it is alert and folds back in flight
    const N = sub(B, 17, 4, 0, 0, -pitch + 0.1 * flK, 0), NP = drawHeron.N, e = it.e, nf = fly ? ss(0.5, 2.8, tau) : 0;
    for (let k = 0; k < 10; k++) NP[k] = lerp(lerp(H_REL[k], H_TALL[k], e), H_FLY[k], nf);
    tube(N, 14, 6, s => { SF = along(NP, 2, 0, s); SU = along(NP, 2, 1, s); SR = 0; RA = RB = lerp(3.8, 2.1, Math.pow(s, 0.7)); }, MG.hneck, own | 6);
    for (let j = 0; j < 4; j++) ink(N, 2 + j * 0.6, 3 - j, (j - 1.5) * 1.6, 5 + j * 0.5, -9 - j * 2.2, (j - 1.5) * 2.2, C.plume, al * 0.7, own | 6); // breast plumes
    const H = sub(N, NP[8], NP[9], 0, it.look * (1 - nf), lerp(-0.14, -0.02, e) * (1 - nf), 0);
    tube(H, 7, 6, s => { const c = capK(s, 0.3, 0.02); SF = -4.5 + 11 * s; SU = 0.4; SR = 0; RA = cr([2.2, 3.4, 3.3, 2.5, 1.9], s) * c + 0.02; RB = cr([2, 3, 2.9, 2.1, 1.5], s) * c + 0.02; }, MG.hneck, own | 7);
    tube(H, 6, 4, s => { SF = 5.5 + 15 * s; SU = 0.2 - 0.5 * s; SR = 0; RA = lerp(1.9, 0.25, Math.pow(s, 0.8)); RB = lerp(1.4, 0.2, Math.pow(s, 0.8)); }, MG.hbill, own | 8);
    ink(H, 6, 0.9, 0, 20.5, -0.2, 0, C.gold, al, own | 8, 0.15);
    for (const sd of [-1, 1]) { dot(H, 3.4, 1, sd * 3.1, C.gold, 'o', al, 0.3 * al, own | 7, 0.6); ink(H, -1, 2.8, sd * 1.2, -15 - 2 * br, -2.5 - 3 * (1 - e), sd * 2, C.slate, al * 0.85, own | 9); }
  }
  drawHeron.P = new Array(12); drawHeron.N = new Array(10);

  // ═════════ frogs: on the bank and one in the glade. they freeze in the light, and leap when touched
  function frogWake(it, T, near, pn, silent) {
    if (it.leap || it.gone) return; const wet0 = it.x < CR1 + 170, h = wet0 ? -PI / 2 + (rnd() - 0.5) * 0.5 : Math.atan2(it.x - CAM.x, -(it.z - CAM.z)) + (rnd() - 0.5) * 1.4, dist = wet0 ? Math.max(70, it.x - (CR1 - 50)) : 65 + rnd() * 30, wet = it.x + Math.sin(h) * dist < CR1; let dur = 0.62;
    if (M.on && !silent) { const t0 = M.quant(M.now + 0.02), tl = M.quant(M.now + 0.58); dur = tl - M.now; M.play('reed', t0, M.fit(M.pent(1), M.chAt(t0)), 0.55 * near, pn); if (wet) M.play('drip', tl, M.fit(M.pent(-3), M.chAt(tl)), 0.75 * near, pn); else M.fm(tl, M.fit(M.pent(-4), M.chAt(tl)), { g: 0.07 * near, dec: 0.3, att: 0.008, ratio: 1, idx: 1, idxDec: 0.1, rv: 0.3, pan: pn }); }
    it.awake = true; it.wt = T; it.leap = { t0: T, dur, x0: it.x, z0: it.z, h0: it.h, h, dist, H: 20 + dist * 0.14 };
  }
  function tickFrog(it, T, dt) {
    if (it.gone) { if (it.bub && T > it.bub) { ripple(it.x, it.z, 0.45); it.bub = 0; } return; }
    notice(it, T, dt); if (it.awake && it.wt == null && !it.leap) frogWake(it, T - DBG.cw, 1, 0, true);
    const lp = it.leap; if (lp && DBG.lk) lp.t0 = T - DBG.lk * lp.dur;
    if (lp) { const k = (T - lp.t0) / lp.dur, q = cl(k, 0, 1); it.x = lp.x0 + Math.sin(lp.h) * lp.dist * q; it.z = lp.z0 - Math.cos(lp.h) * lp.dist * q; it.y = 4 * lp.H * q * (1 - q); it.h = lp.h0 + wrapA(lp.h - lp.h0) * ss(0, 0.3, q);
      if (k >= 1) { it.leap = null; it.y = 0; it.land = T; if (it.x < CR1) { ripple(it.x, it.z, 1); it.gone = true; it.bub = T + 0.8; } else { it.awake = false; it.wt = null; it.nt = T; } } }
    const still = lp || (it.seen && T - it.nt < 10); it.calm = ease(it.calm, still ? 0 : 1, still ? 9 : 0.5, dt);
    if (T > it.blN) { it.bl = T; it.blN = T + 3 + rnd() * 6; }
  }
  function frogSeg(F, a, b, r0, r1, mat, own) { tube(F, 4, 5, s => { const c = capK(s, 0.3, 0.3); SF = lerp(a[0], b[0], s); SU = lerp(a[1], b[1], s); SR = lerp(a[2], b[2], s); RA = RB = lerp(r0, r1, s) * c + 0.02; }, mat, own); }
  function drawFrog(it) {
    if (it.gone) return; mats(); const T = V.T, own = (it.idx + 1) << 8, al = lightOf(it), C = MG.c, lp = it.leap, k = lp ? cl((T - lp.t0) / lp.dur, 0, 1) : 0;
    const ext = lp ? ss(0, 0.22, k) * (1 - ss(0.72, 1, k)) : 0, pitch = lp ? 0.95 * (1 - 2 * k) * ss(0, 0.12, k) : 0, sq = it.land ? Math.max(0, 1 - (T - it.land) * 4) : 0;
    const rise = 7.6 - 4 * ext, hu = rise - 5; const cm = it.calm, bre = 0.3 * cm * Math.sin(T * 2.3 + it.ph), thr = cm * (0.5 + 0.5 * Math.sin(T * 8.5 + it.ph)), FF = rootF(it.x, (it.y || 0) + 0.3 - sq * 1.2, it.z, it.h, pitch, 0, it.sc);
    const spine = s => { const c = capK(s, 0.22, 0.2); SF = -8.5 + 17.5 * s + 1.5 * ext * s; SU = 3.4 + rise * s; SR = 0; RA = cr([2.2, 4.3, 4.9, 4.6, 4.2, 3.2], s) * c + 0.02; RB = (cr([2.6, 6, 6.8, 6.3, 6, 4], s) + bre * Math.sin(PI * s)) * c + 0.02; };
    tube(FF, 10, 8, spine, MG.fback, own | 1, -0.3, PI + 0.3); tube(FF, 10, 5, spine, MG.fbelly, own | 2, PI + 0.3, TAU - 0.3);
    blob(FF, 6, 5.6 + hu * 0.7 - 0.4 * thr, 0, 3.2, 2 + 0.9 * thr, 4.2, MG.fbelly, own | 2, 5, 6); // the throat
    const blink = T - it.bl < 0.2, L3 = (a, b, q) => [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)];
    for (const sd of [-1, 1]) {
      blob(FF, 4.8, 10.6 + hu - (blink ? 1 : 0), sd * 3.5, 2.4, 2.2, 2.1, MG.fback, own | 3, 4, 6);
      if (!blink) dot(FF, 5.6, 11.1 + hu, sd * 5.5, C.gold, PR.s > 0.7 ? '0' : 'o', al, 0.3 * al, own | 3, 0.5);
      const hip = [-6.5, 3.6, sd * 3.6], knee = L3([2.5, 3.6, sd * 10.5], [-13, 2.6, sd * 5], ext), ank = L3([-8.5, 1.8, sd * 9.6], [-23, 2.2, sd * 4.2], ext), toe = L3([0, 0.7, sd * 13], [-32, 1.6, sd * 4.6], ext), td = lerp(4, -4, ext);
      frogSeg(FF, hip, knee, 3.4, 2.7, MG.fback, own | 4); frogSeg(FF, knee, ank, 2.4, 1.5, MG.fback, own | 5); frogSeg(FF, ank, toe, 1.3, 0.7, MG.fback, own | 4);
      ink(FF, -6, 7.2, sd * 3.4, 0, 9 + hu * 0.5, sd * 4.3, C.frog, al * 0.9, own | 1); ink(FF, 0, 9 + hu * 0.5, sd * 4.3, 4, 10.6 + hu * 0.9, sd * 3.9, C.frog, al * 0.9, own | 1); // the folds along its back
      for (let j = -1; j <= 1; j++) ink(FF, toe[0], toe[1], toe[2], toe[0] + td, toe[1] - 0.3, toe[2] + sd * (j + 0.4) * 2.4, C.frog, al * 0.85, own | 4);
      const sh = [4.6, 4.6 + hu * 0.75, sd * 4.8], el = L3([6, 3.4, sd * 7], [3, 3.4, sd * 6.6], ext), hd = L3([8, 0.6, sd * 5.2], [-1.5, 3, sd * 6.2], ext);
      frogSeg(FF, sh, el, 1.6, 1.2, MG.fback, own | 6); frogSeg(FF, el, hd, 1.1, 0.7, MG.fback, own | 6);
      for (let j = 0; j < 3; j++) ink(FF, hd[0], hd[1], hd[2], hd[0] + 2.6, hd[1] - 0.3, hd[2] - sd * (j - 0.6) * 1.5, C.frog, al * 0.8, own | 6);
    }
  }

  // ═════════ moths: pale green, long-tailed, drifting where a flower is open. touched, one glows and keeps you company
  function mothWake(it, T, near, pn, silent) {
    it.awake = true; it.band = true; it.wt = T; it.ping = T;
    if (M.on && !silent) for (let i = 0; i < 3; i++) { const t = M.quant(M.now + 0.02) + i * M.STEP; M.fm(t, M.fit(M.pent(12 + i * 2), M.chAt(t)), { g: 0.05 * near, dec: 0.5, att: 0.004, ratio: 2, idx: 0.2, rv: 0.7, dv: 0.35, pan: pn }); }
  }
  function tickMoth(it, T, dt) {
    if (it.awake && it.wt == null) mothWake(it, T - DBG.cw, 1, 0, true);
    // the moth is the guide: it never comes to your face. the game says where it should be (GUIDE), ahead of you on the way to a flower
    const fol = typeof GUIDE !== 'undefined' && GUIDE.on; it.awake = fol; it.band = false; if (!fol) it.wt = null;
    if (fol) { it.ax = GUIDE.x; it.az = GUIDE.z; it.ah = 100; it.aR = GUIDE.r || 26; }
    else if (T > it.tgN) { const fl = lights.filter(l => l.f && Math.hypot(l.x - it.x, l.z - it.z) < 2600), l = fl.length ? fl[(rnd() * fl.length) | 0] : null; it.ax = l ? l.x : it.hx; it.az = l ? l.z : it.hz; it.ah = 80 + rnd() * 40; it.aR = 75 + rnd() * 50; it.tgN = T + 14 + rnd() * 16; }
    if (DBG.mfix) { it.ax = it.hx; it.az = it.hz; it.ah = 105; it.aR = 6; it.cR = 6; it.cx = it.hx; it.cz = it.hz; it.ch = 105; }
    { const r = fol ? 1.4 : 0.22, dx = it.ax - it.cx, dz = it.az - it.cz, d = Math.hypot(dx, dz) || 1, st = Math.min(d * (1 - Math.exp(-dt * r)), 230 * dt); it.cx += dx / d * st; it.cz += dz / d * st; } it.ch = ease(it.ch, it.ah, 0.8, dt); it.cR = ease(it.cR, it.aR, 0.8, dt);
    const nx = it.cx + it.cR * Math.sin(T * it.w1 + it.p1), nz = it.cz + it.cR * Math.sin(T * it.w2 + it.p2), ny = it.ch + 20 * Math.sin(T * it.w3 + it.p1 * 2) + 2.5 * Math.sin(T * 6.3 + it.p2);
    const vx = (nx - it.x) / dt, vz = (nz - it.z) / dt; if (Math.hypot(vx, vz) > 2) { const dh = wrapA(Math.atan2(vx, -vz) - it.h); it.h += dh * (1 - Math.exp(-dt * 5)); it.bank = ease(it.bank, cl(dh * 0.8, -0.5, 0.5), 4, dt); }
    it.x = nx; it.z = nz; it.y = ny;
    if (fol) { lightsN.push({ x: it.x, z: it.z, r: 190, k: 0.3 }); if (T > it.trN) { it.trN = T + 0.09; it.tr.push(it.x, it.y, it.z, T); if (it.tr.length > 56) it.tr.splice(0, 4); } }
  }
  function drawMoth(it) {
    mats(); const T = V.T, own = (it.idx + 1) << 8, pg = it.awake ? Math.max(0, 1 - (T - it.ping) * 3.5) : 0, al = lightOf(it, it.awake ? 0.15 + 0.3 * pg : 0), C = MG.c;
    const fp = T * it.wf + it.ph, phi = 0.35 + 1.05 * Math.sin(fp), ph2 = phi * 0.8 - 0.12, MF = rootF(it.x, it.y - 1.3 * Math.sin(fp), it.z, it.h, 0.95, it.bank, it.sc);
    tube(MF, 7, 6, s => { const c = capK(s, 0.3, 0.25); SF = -5 + 8.5 * s; SU = -1.2 * (1 - s) * (1 - s); SR = 0; RA = RB = cr([0.7, 1.1, 1.25, 1.5, 1.2], s) * c + 0.02; }, MG.mbody, own | 1);
    const sa = Math.sin(phi), ca = Math.cos(phi), sa2 = Math.sin(ph2), ca2 = Math.cos(ph2), lead = s => 1.6 + 2.6 * s * s - 0.6 * s;
    for (const sd of [-1, 1]) {
      ink(MF, 3.2, 0.5, sd * 0.5, 5, 2, sd * 2, C.mant, al * 0.8, own | 1); ink(MF, 5, 2, sd * 2, 6.2, 3.3, sd * 4.6, C.mant, al * 0.8, own | 1);
      cmesh(MF, 8, 4, (s, w) => { const a = 10 * s, ch = 7.2 * Math.pow(Math.sin(PI * Math.pow(s, 0.85)), 0.75) + 0.05, b = lead(s) - ch * w, cam = 0.6 * Math.sin(PI * w) * s; LF = 0.6 + b; LU = a * sa + cam * ca; LR = sd * (a * ca - cam * sa); }, MG.mwing, own | 2);
      cmesh(MF, 7, 4, (s, w) => { const a = 6.6 * s, ch = 6.5 * Math.pow(Math.sin(PI * Math.pow(s, 0.8)), 0.75) + 0.05, b = -1 - 1.2 * s - ch * w; LF = 0.6 + b; LU = a * sa2; LR = sd * a * ca2; }, MG.mwing, own | 2);
      for (let q = 0; q < 3; q++) { const s0 = q / 3, s1 = (q + 1) / 3, a0 = 3.4 + 1.8 * s0, a1 = 3.4 + 1.8 * s1; ink(MF, -5.4 - 9.5 * s0, a0 * sa2 - 1.6 * s0 * s0, sd * a0 * ca2, -5.4 - 9.5 * s1, a1 * sa2 - 1.6 * s1 * s1 + 0.6 * Math.sin(s1 * 5 + fp * 0.3) * s1, sd * a1 * ca2, C.mtail, al * (1 - 0.25 * q), own | 2); } // the long tails
      for (let q = 0; q < 2; q++) ink(MF, 0.6 + lead(q * 0.5), 5 * q * sa, sd * 5 * q * ca, 0.6 + lead(q * 0.5 + 0.5), (5 * q + 5) * sa, sd * (5 * q + 5) * ca, C.maroon, al * 0.9, own | 2);
      dot(MF, 1.4, 4.6 * sa + 0.3, sd * 4.6 * ca, C.spot, 'o', al, 0.25 * al, own | 2, 0.4); dot(MF, -3.4, 3.2 * sa2 + 0.3, sd * 3.2 * ca2, C.spot, 'o', al * 0.9, 0.2 * al, own | 2, 0.4);
    }
    if (it.awake) for (let i = 0; i < it.tr.length; i += 4) { const a = T - it.tr[i + 3]; if (a < 1.3 && PR.proj(it.tr[i] + Math.sin(i + T) * 2, it.tr[i + 1] - a * 9, it.tr[i + 2])) G.plot(PR.u, PR.v, PR.z, i % 8 ? C.dust : C.white, a < 0.4 ? '*' : '.', (1 - a / 1.3) * 0.8, 0.2 * (1 - a / 1.3), own); }
  }

  // ═════════ placing them
  function clearSpot(x, z, r) { // the nearest point to (x, z) with no tree or flower within r
    const bad = (px, pz) => items.some(t => t.type === 'tree' && Math.hypot(t.x - px, t.z - pz) < r) || (typeof SPOTS !== 'undefined' && SPOTS.some(s => Math.hypot(s.x - px, s.z - pz) < Math.max(r, 230)));
    for (let q = 0; q < 60; q++) { const a = q * 2.4, d = q * 14, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!bad(px, pz)) return [px, pz]; } return [x, z];
  }
  function addAll() {
    mats(); list = [];
    { const [x, z] = clearSpot(2550, -1050, 190); let h = -1.75; // it will walk west along the hill; keep that way clear
      for (const c of [-1.75, -1.2, -2.3, 1.6, 0.4, 2.6]) { const ex = x + Math.sin(c) * 150, ez = z - Math.cos(c) * 150, [qx, qz] = clearSpot(ex, ez, 120); if (qx === ex && qz === ez) { h = c; break; } }
      const it = add('deer', x, z, { h, up: 0, look: 0, gait: 0, ph: 1.3, ef: -9, efS: 1, efN: 3, bl: -9, blN: 2 }); it.solid = { x, z, r: 58 }; solids.push(it.solid); list.push(it); }
    { let tr = null, bd = 1e9; for (const t of items) if (t.type === 'tree' && t.will) { const d = Math.hypot(t.x + 1050, t.z + 1650); if (d < bd) { bd = d; tr = t; } } // the owl's willow, and a bough for it
      if (tr) { const by = 258, q = by / tr.h, bx = tr.x + Math.cos(tr.la) * tr.lean * q * q, bz = tr.z + Math.sin(tr.la) * tr.lean * q * q, bh = 1.1;
        list.push(add('owl', bx + Math.sin(bh) * 55, bz - Math.cos(bh) * 55, { bx, by, bz, bh, py: by + 7.2, h: bh + PI / 2, hd: 0, hdT: 0, hdN: 0, open: 0, ph: 2, bl: -9, blN: 4 })); } }
    list.push(add('heron', -1962, -150, { h: PI + 0.45, e: 0.3, look: 0, alt: 0, trav: 0, ph: 0.7, rpN: 5 }));
    for (const [x, z, h] of [[-1838, -520, 3.0], [-1846, 60, -0.25], [-1836, 800, 3.4]]) list.push(add('frog', x, z, { h, sc: 1.3, calm: 1, ph: x * 0.01, bl: -9, blN: 3, y: 0 }));
    { const [x, z] = clearSpot(380, -900, 110); list.push(add('frog', x, z, { h: 2.4, sc: 1.3, calm: 1, ph: 4, bl: -9, blN: 5, y: 0 })); }
    [[30, -40]].forEach(([x, z], i) => list.push(add('moth', x, z, { hx: x, hz: z, ax: x, az: z, cx: x, cz: z, ah: 95, ch: 95, aR: 90, cR: 90, y: 70, h: 0, bank: 0, sc: 1.15, w1: 0.43 + i * 0.07, w2: 0.31 + i * 0.05, w3: 0.5 + i * 0.1, p1: i * 2.1, p2: i * 1.3 + 1, wf: 38 + i * 3, ph: i, tgN: 6 + i * 5, trN: 0, tr: [], ping: -9 })));
  }
  const TICK = { deer: tickDeer, owl: tickOwl, heron: tickHeron, frog: tickFrog, moth: tickMoth };
  function tick(ms) {
    requestAnimationFrame(tick); const T = ms / 1000, dt = Math.min(0.05, T - lastMs || 0.016); lastMs = T; if (typeof V === 'undefined' || !G.lit) return;
    for (const it of list) TICK[it.type](it, T, dt);
  }
  requestAnimationFrame(tick);
  DRAW.deer = drawDeer; DRAW.owl = drawOwl; DRAW.heron = drawHeron; DRAW.frog = drawFrog; DRAW.moth = drawMoth;
  const CREATURE = {
    owl: { name: 'an owl', wake(it, near, pn) { owlWake(it, V.T, near, pn); },
      step(it, s, bar, ch, t, near, pn) { if (s === 8 && bar % 4 === 1) owlCall(it, t, 0.085 * near, pn); } },
    deer: { name: 'a deer', wake(it, near, pn) { if (!it.awake) deerWake(it, V.T, near, pn); else { it.ef = V.T; it.efS = rnd() < 0.5 ? -1 : 1; if (M.on) M.fm(M.quant(M.now), M.fit(M.pent(8 + ((rnd() * 5) | 0)), M.chAt(M.now)), { g: 0.07 * near, dec: 2, ratio: 3.01, idx: 0.5, idxDec: 0.25, rv: 0.75, dv: 0.3, pan: pn }); } } },
    heron: { name: 'a heron', wake(it, near, pn) { heronWake(it, V.T, near, pn); } },
    frog: { name: 'a frog', wake(it, near, pn) { frogWake(it, V.T, near, pn); } },
    moth: { name: 'the moth', wake(it, near, pn) { it.ping = V.T; if (M.on) for (let i = 0; i < 3; i++) { const t = M.quant(M.now + 0.02) + i * M.STEP; M.fm(t, M.fit(M.pent(12 + i * 2), M.chAt(t)), { g: 0.05 * near, dec: 0.5, att: 0.004, ratio: 2, idx: 0.2, rv: 0.7, dv: 0.35, pan: pn }); } if (typeof guide === 'function') guide(); },
      step(it, s, bar, ch, t, near, pn) { if (s % 2 === 0 && rnd() < 0.55) { M.fm(t + rnd() * 0.01, M.fit(M.pent(14 + ((rnd() * 5) | 0)), ch), { g: 0.032 * near, dec: 0.22, att: 0.004, ratio: 2, idx: 0.2, rv: 0.7, dv: 0.35, pan: pn }); M.vis(t, () => { it.ping = V.T; }); } } }
  };
  return { CREATURE, addAll };
})();
const CREATURE = CRT.CREATURE;
function addCreatures() { CRT.addAll(); }
