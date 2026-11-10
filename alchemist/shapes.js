'use strict';
// Glyph figures on top of G's public API: lit swept surfaces and ellipsoids, then the alchemist,
// the five creatures, trees, the moon and the cauldron. Everything is drawn in view units.
//
//   Sh.surf(NS, NW, fn(s,w,q), mat, own)      q[0..2] = u,v,z of the surface point
//   Sh.ell(u,v,z, rx,ry,rz, rot, mat, own, long)   half ellipsoid facing the eye
//   Sh.alchemist(u, a, T, own) → lantern {u,v}
//   Sh.creature[kind](u, c, T, own) → {u,v,r} mouth and size   (c = {sp, joy, no})
//   Sh.tree, Sh.moon, Sh.cauldron, Sh.mushroom
const Sh = (() => {
  const N = 41 * 21, VB = new Float32Array(N * 8), PU = new Float32Array(N), PV = new Float32Array(N), PZ = new Float32Array(N), NN = new Float32Array(N * 3), q = [0, 0, 0];
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, h3 = G.h3;
  // figures are modelled small and drawn larger: K scales them about their foot point (OX, 0)
  let K = 1, OX = 0;
  const tx = u => OX + (u - OX) * K;
  const ln = (u0, v0, z0, u1, v1, z1, w, m, own) => G.line(tx(u0), v0 * K, z0, tx(u1), v1 * K, z1, w * K, m, own);
  const pt = (u, v, z, ci, ch, al, wh, own, warm) => G.plot(tx(u), v * K, z, ci, ch, al, wh, own, warm);
  function fig(u, k, fn) { K = k; OX = u; const r = fn(); if (r) { r.u = tx(r.u); r.v *= k; if (r.r) r.r *= k; } K = 1; return r; }
  function surf(NS, NW, fn, mat, own) {
    const row = NW + 1;
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NW; j++) { fn(i / NS, j / NW, q); const k = i * row + j; PU[k] = tx(q[0]); PV[k] = q[1] * K; PZ[k] = q[2]; }
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NW; j++) {
      const k = i * row + j, a = (i < NS ? i + 1 : i) * row + j, b = (i > 0 ? i - 1 : i) * row + j, c = i * row + (j < NW ? j + 1 : j), d = i * row + (j > 0 ? j - 1 : j);
      const sx = PU[a] - PU[b], sy = PV[a] - PV[b], sz = PZ[a] - PZ[b], wx = PU[c] - PU[d], wy = PV[c] - PV[d], wz = PZ[c] - PZ[d];
      let nx = wy * sz - wz * sy, ny = wz * sx - wx * sz, nz = wx * sy - wy * sx; const l = Math.hypot(nx, ny, nz) || 1;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const o = k * 8; VB[o] = PU[k]; VB[o + 1] = PV[k]; VB[o + 2] = PZ[k]; VB[o + 3] = nx / l; VB[o + 4] = ny / l; VB[o + 5] = nz / l; VB[o + 6] = i / NS; VB[o + 7] = j / NW * 2 - 1;
    }
    G.mesh(VB, NS, NW, mat, own);
  }
  function ell(u, v, z, rx, ry, rz, rot, mat, own, long) {
    const cr = cos(rot || 0), sr = sin(rot || 0);
    surf(7, 9, (s, w, o) => {
      const a = ((long ? w : s) - 0.5) * PI * 0.97, b = ((long ? s : w) - 0.5) * PI * 0.97, x = rx * cos(a) * sin(b), y = ry * sin(a);
      o[0] = u + x * cr - y * sr; o[1] = v + x * sr + y * cr; o[2] = z + rz * cos(a) * cos(b);
    }, mat, own);
  }
  const mat = (ramp, o) => G.material(Object.assign({ ramp, ao: 0, amb: 0.16, rim: 0.22, spec: 0.35, edge: 0.1 }, o));
  const MT = {
    cloak: mat(['#2a1a10', '#6e4a2a', '#b8885a', '#f2dcb4']), dark: mat(['#140e0a', '#3a2a1c', '#6a5038', '#a88a64'], { mode: 'hatch' }),
    face: mat(['#030306', '#07070e', '#0c0c18', '#141426'], { amb: 0.05, dif: 0.2, rim: 0, spec: 0, edge: 0 }), wood: mat(['#2a1c10', '#6a4a2c', '#a8845a', '#e6cfa8'], { mode: 'hatch', amb: 0.3 }),
    bark: mat(['#0a0e14', '#1e2832', '#465668', '#93a8bf'], { mode: 'hatch', amb: 0.1, rim: 0.3, warm: 0.5 }), moon: mat(['#59648c', '#aab4d8', '#e6ebff', '#ffffff'], { amb: 0.3, dif: 0.75, rim: 0, warm: 0, spec: 0, flat: 2, edge: 0.3 }),
    moth: mat(['#1a2a4a', '#4f7fd0', '#a9d0ff', '#f4fbff'], { amb: 0.34, rim: 0.3, mode: 'hatch', warm: 0.3 }), mothB: mat(['#3a4466', '#8fa0d8', '#dfe8ff', '#ffffff'], { amb: 0.4, warm: 0.3 }),
    toad: mat(['#0f2a1c', '#2f6b4a', '#7fbf8f', '#dcf7d6'], { amb: 0.2 }), toadB: mat(['#3a4a2a', '#8fae6a', '#d9eeb0', '#fbffe6'], { amb: 0.3 }),
    fox: mat(['#3a1408', '#a8441c', '#f08a4a', '#ffe0c4'], { amb: 0.2 }), pale: mat(['#3a3a48', '#9a9ab0', '#e6e6f5', '#ffffff'], { amb: 0.3 }),
    owl: mat(['#1d1a2e', '#57507a', '#a79fd0', '#f0ecff'], { amb: 0.2 }), owlD: mat(['#14121f', '#3a3556', '#756c9e', '#c4bce6'], { amb: 0.16, mode: 'hatch' }), eye: mat(['#6a4a00', '#d59a1e', '#ffd45e', '#fff6d0'], { amb: 0.6, flat: 2, warm: 0 }),
    stag: mat(['#101a2a', '#3a5a7a', '#9cc6e0', '#f2fbff'], { amb: 0.1, dif: 0.66, rim: 0.3, warm: 0.5 }), horn: mat(['#4a5a5a', '#9fc8c0', '#e3fff6', '#ffffff'], { mode: 'hatch', amb: 0.6, warm: 0.3 }),
    iron: mat(['#0c0c12', '#2a2a3a', '#5a5a78', '#b8b8e0'], { amb: 0.14, rim: 0.3 }), shroom: mat(['#0f3a3a', '#2fa39a', '#8ff5e6', '#eafffb'], { amb: 0.3, dif: 0.4, warm: 0.2, edge: 0 }), stone: mat(['#0e1014', '#2a3038', '#5a6470', '#a4b0bf'], { amb: 0.12 })
  };
  const C = { eye: G.col('#ffe2a0'), amber: G.col('#ffc45e'), flame: G.col('#ffb45e'), core: G.col('#fff2c8'), black: G.col('#000000'), white: G.col('#ffffff'), dust: G.col('#cfe2ff'), leaf: ['#1c4435', '#2c6a50', '#4c9070', '#7fbf9a'].map(G.col), tip: G.col('#e3fff6') };

  // a = {d: facing ±1, ph: walk phase, moving: 0..1}
  const alchemist = (u, a, T, own) => fig(u, 1.5, () => alchemist0(u, a, T, own));
  function alchemist0(u, a, T, own) {
    const d = a.d, mv = a.moving, y = mv * Math.abs(sin(a.ph)) * 0.9 + (1 - mv) * sin(T * 1.3) * 0.2, st = mv * sin(a.ph) * 2.6, z = 60;
    ln(u - 0.7, y + 4, z - 2, u - 0.7 + st, 0, z - 2, 1.3, MT.dark, own | 1); ln(u + 0.7, y + 4, z + 1, u + 0.7 - st, 0, z + 1, 1.3, MT.dark, own | 2);
    surf(8, 8, (s, w, o) => { const b = (w - 0.5) * PI, r = 5.3 - 2.8 * Math.pow(s, 0.8) + 0.45 * sin(s * 5 + a.ph) * (1 - s) * mv; o[0] = u + r * sin(b) + d * 0.9 * s - d * st * 0.12 * (1 - s); o[1] = y + 2.6 + s * 11.6; o[2] = z + r * cos(b) * 0.8; }, MT.cloak, own | 3);
    ell(u + d * 0.8, y + 16.8, z + 1, 3.7, 3.8, 3.2, 0, MT.cloak, own | 4);
    ell(u - d * 2.6, y + 19.6, z, 2.6, 1.3, 1.2, d * 0.5, MT.cloak, own | 5);
    ell(u + d * 2.3, y + 16.3, z + 3.4, 1.8, 2.2, 1, 0, MT.face, own | 6);
    const bl = sin(T * 0.7) > 0.985 ? '-' : 'o';
    pt(u + d * 1.9, y + 16.7, z + 8, C.eye, bl, 0.95, 0.3, own | 6); pt(u + d * 3.3, y + 16.7, z + 8, C.eye, bl, 0.95, 0.3, own | 6);
    ln(u - d * 2.2, y + 9.6, z + 5, u + d * 1.2, y + 14, z + 5, 0.6, MT.dark, own | 7);
    ell(u - d * 2.9, y + 7.4, z + 5, 2.2, 1.9, 1.5, 0, MT.dark, own | 8);
    // staff with the lantern
    const hx = u + d * 5.4, sw = sin(T * 1.7) * 0.5 + st * 0.25, lu = u + d * 9.6 + sw, lv = y + 18.2;
    ln(u + d * 1.6, y + 12.6, z + 4, hx, y + 11.6, z + 6, 1.2, MT.cloak, own | 9);
    ln(u + d * 4.6, y + 0.5, z + 6, u + d * 6.4, y + 23, z + 6, 0.8, MT.wood, own | 10); ln(u + d * 6.4, y + 23, z + 6, u + d * 9.6, y + 24, z + 6, 0.8, MT.wood, own | 10);
    pt(u + d * 9.6 + sw * 0.3, y + 23, z + 6, C.amber, '|', 0.7, 0, own | 11); pt(u + d * 9.6 + sw * 0.6, y + 22, z + 6, C.amber, '|', 0.7, 0, own | 11);
    const fl = 0.85 + 0.15 * sin(T * 9) * sin(T * 5.3), X = tx(lu), Y = Math.round(lv * K), o = own | 11, K0 = K; K = 1; OX = X;
    pt(X, Y + 4, z + 7, C.amber, '^', 0.9, 0.1, o); pt(X - 0.6, Y, z + 7, C.amber, '\\', 0.8, 0, o); pt(X, Y, z + 7, C.amber, '_', 0.8, 0, o); pt(X + 0.6, Y, z + 7, C.amber, '/', 0.8, 0, o);
    for (let r = 1; r <= 3; r++) { pt(X - 1.2, Y + r, z + 7, C.flame, '(', 0.9, 0.2, o); pt(X + 1.2, Y + r, z + 7, C.flame, ')', 0.9, 0.2, o); for (const dx of [-0.6, 0, 0.6]) pt(X + dx, Y + r, z + 8, C.core, r === 2 && !dx ? '0' : r === 2 || !dx ? 'o' : '*', 1, fl * (r === 2 && !dx ? 1 : 0.6), o); }
    K = K0; OX = u;
    return { u: lu, v: lv + 1.5 };
  }

  // one wing: a leaf-shaped sheet that leaves the body at angle `up`, folded toward the eye by `flap`
  function wing(u, v, z, side, up, L, Wd, flap, own) {
    const cf = cos(flap), sf = sin(flap), cu = cos(up), su = sin(up);
    surf(9, 5, (s, w, o) => {
      const wd = Wd * Math.pow(sin(PI * Math.pow(s, 0.62)), 0.8), al = s * L, ac = (w - 0.5) * 2 * wd, hx = al * cu - ac * su, hy = al * su + ac * cu;
      o[0] = u + side * hx * cf; o[1] = v + hy; o[2] = z + hx * sf + 0.6 * sin(s * 6) * ac / (Wd || 1);
    }, MT.moth, own);
  }
  const SIZE = { moth: 1.15, toad: 1.5, fox: 1.45, owl: 1.35, stag: 1.2 };
  const creature = (kind, u, c, T, own) => fig(u, SIZE[kind], () => beast[kind](u, c, T, own));
  const beast = {
    moth(u, c, T, own) {
      const v = 25 + (c.glad ? 10 : 0) + 2.2 * sin(T * 0.8) + c.joy * 3 * Math.abs(sin(T * 5)), z = 30, fl = 0.55 + 0.5 * sin(T * (5 + c.joy * 6 + c.sp * 3)), x = u + c.no * sin(T * 14);
      for (const sd of [-1, 1]) { wing(x, v + 1, z, sd, 0.55, 13, 5.4, fl, own | (sd > 0 ? 1 : 2)); wing(x, v - 0.5, z - 1, sd, -0.7, 9, 4, fl * 0.9, own | (sd > 0 ? 3 : 4)); }
      ell(x, v - 0.6, z + 3, 1.3, 3.3, 1.3, 0, MT.mothB, own | 5); ell(x, v + 3.3, z + 3, 1.5, 1.4, 1.3, 0, MT.mothB, own | 6);
      pt(x - 0.6, v + 3.5, z + 6, C.eye, '.', 1, 0.5, own | 6); pt(x + 0.6, v + 3.5, z + 6, C.eye, '.', 1, 0.5, own | 6);
      for (const sd of [-1, 1]) { ln(x + sd * 0.6, v + 4.4, z + 3, x + sd * 2.4, v + 7.4, z + 3, 0.4, MT.mothB, own | 7); pt(x + sd * 3, v + 8, z + 3, C.tip, "'", 0.9, 0.3, own | 7); }
      for (let i = 0; i < 7; i++) { const k = (T * 0.25 + h3(i, 3, 1)) % 1; pt(x + (h3(i, 1, 2) - 0.5) * 16, v - 3 - k * 16, z - 2, C.dust, k < 0.5 ? '.' : ',', (1 - k) * 0.6, 0.2 * (1 - k)); }
      return { u: x, v: v + 2, r: 16 };
    },
    toad(u, c, T, own) {
      const z = 25, y = c.joy * 2.5 * Math.abs(sin(T * 6)), x = u + c.no * sin(T * 14) * 0.8, br = 0.25 * sin(T * 1.6);
      ell(x + 4.6, y + 2.3, z + 3, 3.8, 2.3, 2.2, 0.2, MT.toad, own | 1);
      ell(x, y + 4.4 + br * 0.3, z, 7.6, 4.6 + br, 5, -0.12, MT.toad, own | 2);
      ell(x - 5.4, y + 6.6, z + 1.5, 4.1, 3, 3.4, 0, MT.toad, own | 3);
      const th = 1.7 + 2.6 * c.sp; ell(x - 6.6, y + 3.6, z + 3, th * 1.1, th, th, 0, MT.toadB, own | 4);
      ell(x - 6.6, y + 9.3, z + 4, 2, 1.9, 1.3, 0, MT.toad, own | 5); ell(x - 3.2, y + 9.6, z + 1, 1.8, 1.7, 1.1, 0, MT.toad, own | 6);
      if (sin(T * 0.9 + 1) < 0.98) { pt(x - 6.8, y + 9.5, z + 7, C.black, 'o', 1, 0, own | 5); pt(x - 3.4, y + 9.8, z + 4, C.black, 'o', 1, 0, own | 6); }
      ln(x - 3.2, y + 3.4, z + 5, x - 5.2, 0.4, z + 6, 1.5, MT.toad, own | 7); ln(x - 5.2, 0.4, z + 6, x - 7.4, 0.2, z + 6, 1.2, MT.toad, own | 7);
      return { u: x - 7.5, v: y + 5, r: 13 };
    },
    fox(u, c, T, own) {
      const z = 25, y = c.joy * 2 * Math.abs(sin(T * 6)), x = u + c.no * sin(T * 14) * 0.8, wag = 0.3 + (0.08 + 0.4 * c.joy) * sin(T * (2 + c.joy * 8)), tilt = c.sp * 0.25;
      ell(x + 7.4, 3.2 + y * 0.3, z - 2, 6.4, 2.7, 2.4, wag, MT.fox, own | 1, true); ell(x + 7.4 + 5.6 * cos(wag), 3.2 + 5.6 * sin(wag), z - 1.5, 2.6, 2, 1.8, wag, MT.pale, own | 2);
      ell(x + 1.2, y + 6.6, z, 5.2, 6.6, 4, -0.22, MT.fox, own | 3);
      ell(x - 2.6, y + 8.4, z + 1.5, 2.9, 5.2, 2.6, 0.05, MT.pale, own | 4);
      ln(x - 2.2, y + 6, z + 4, x - 2.8, 0.3, z + 4, 1.5, MT.fox, own | 5); ln(x - 4, y + 6, z + 2, x - 4.6, 0.3, z + 2, 1.4, MT.fox, own | 6);
      const hx = x - 3.6, hy = y + 15.6 + tilt * 2;
      ell(hx - 1.4, hy + 3.9, z + 1, 1.1, 2.4, 0.8, 0.25, MT.fox, own | 7); ell(hx + 1.6, hy + 4.1, z + 2, 1.1, 2.4, 0.8, -0.2, MT.fox, own | 8);
      ell(hx, hy, z + 2, 3.7, 3.1, 3, 0, MT.fox, own | 9);
      ell(hx - 3.7, hy - 1 + tilt * 2, z + 3, 2.7, 1.3, 1.3, -0.2 - tilt, MT.pale, own | 10, true);
      pt(hx - 6.2, hy - 0.4 + tilt * 3, z + 6, C.white, 'o', 0.9, 0.2, own | 10);
      pt(hx - 1.6, hy + 0.8, z + 7, C.amber, c.joy > 0.3 || sin(T * 0.8 + 2) > 0.98 ? '^' : 'o', 1, 0.5, own | 9);
      return { u: hx - 6.5, v: hy - 0.5, r: 17 };
    },
    owl(u, c, T, own) {
      const z = 25, by = 31, y = by + c.joy * 1.5 * Math.abs(sin(T * 6)), x = u + c.no * sin(T * 14) * 0.6, tl = 0.18 * sin(T * 0.5) + c.sp * 0.2, bk = sin(T * 0.6 + 1) > 0.975;
      ln(u + 12, by - 4.4, z - 6, u - 3, by - 1, z - 4, 2, MT.bark, own | 1); ln(u - 3, by - 1, z - 4, u - 12, by + 1.5, z - 4, 1.2, MT.bark, own | 1);
      ell(x, y + 6.4, z, 5.2, 7, 4.2, 0, MT.owl, own | 2);
      ell(x - 4, y + 5.6, z + 2, 2.2, 5.6, 2, -0.12, MT.owlD, own | 3); ell(x + 4, y + 5.6, z + 2, 2.2, 5.6, 2, 0.12, MT.owlD, own | 4);
      const hx = x + tl * 3, hy = y + 14.6;
      ell(hx, hy, z + 2, 4.9, 3.9, 3.8, tl, MT.owl, own | 5);
      ln(hx - 3.4, hy + 2.6, z + 2, hx - 4.8, hy + 5.4, z + 2, 0.9, MT.owlD, own | 6); ln(hx + 3.4, hy + 2.6, z + 2, hx + 4.8, hy + 5.4, z + 2, 0.9, MT.owlD, own | 6);
      for (const sd of [-1, 1]) { ell(hx + sd * 2.1, hy + 0.5, z + 5, 1.7, bk ? 0.5 : 1.7, 1, 0, MT.eye, own | (sd > 0 ? 7 : 8)); if (!bk) pt(hx + sd * 2.1, hy + 0.5, z + 9, C.black, 'o', 1, 0, own | 9); }
      pt(hx, hy - 1.2, z + 9, C.amber, 'v', 1, 0.3, own | 9);
      pt(x - 1.5, by - 0.4, z + 4, C.amber, 'v', 0.9, 0, own | 2); pt(x + 1.5, by - 0.4, z + 4, C.amber, 'v', 0.9, 0, own | 2);
      return { u: hx, v: hy - 1.5, r: 15 };
    },
    stag(u, c, T, own) {
      const z = -26, x = u + c.no * sin(T * 14) * 0.6, bow = c.joy * 0.35 * (0.5 + 0.5 * sin(T * 3)) + c.sp * 0.08, br = 0.2 * sin(T * 1.1);
      const leg = (lx, lz, k, o) => { ln(x + lx, 23, z + lz, x + lx + k, 10.5, z + lz, 2.3, MT.stag, o); ln(x + lx + k, 10.5, z + lz, x + lx - k * 0.4, 0.3, z + lz, 1.1, MT.stag, o); };
      leg(8.6, -3, 1.2, own | 1); leg(-7.4, -3, -0.6, own | 2);
      ell(x + 1, 26, z, 11, 5 + br, 4.4, 0.04, MT.stag, own | 3, true); ell(x + 8.4, 25.6, z + 0.6, 5, 6.6, 4.2, -0.1, MT.stag, own | 3); ell(x - 7, 27, z + 0.6, 4.6, 7, 4.2, 0.2, MT.stag, own | 3);
      leg(6.2, 3, 1.4, own | 4); leg(-5.2, 3, -0.8, own | 5);
      ell(x + 12, 27.6, z - 1, 1.6, 1.2, 1, 0.6, MT.pale, own | 6);
      ell(x - 9, 32.6, z + 1, 3.1, 7.6, 2.7, 0.42 + bow, MT.stag, own | 7);
      const hx = x - 12.6 - bow * 9, hy = 40.6 - bow * 7;
      ell(hx, hy, z + 2, 3.2, 2.7, 2.5, 0, MT.stag, own | 8); ell(hx - 3.6, hy - 1.5, z + 2.5, 3, 1.5, 1.4, 0.35, MT.stag, own | 9, true);
      ln(hx + 1.8, hy + 1.8, z + 1, hx + 5, hy + 3.2, z + 1, 1, MT.stag, own | 10);
      pt(hx - 6.2, hy - 2.4, z + 6, C.white, 'o', 0.8, 0.2, own | 9); pt(hx - 1.2, hy + 0.6, z + 7, C.core, 'o', 1, 0.6, own | 8);
      // antlers: two beams, each with tines, each tine with a small light
      for (const sd of [0, 1]) {
        let au = hx + 0.6 + sd * 1.6, av = hy + 2.4, ang = 1.75 - sd * 0.5, len = 6.2; const az = z + 1 - sd * 2;
        for (let i = 0; i < 4; i++) {
          const nu = au + cos(ang) * len, nv = av + sin(ang) * len; ln(au, av, az, nu, nv, az, 0.9, MT.horn, own | 11);
          const ta = ang + (sd ? -0.9 : 0.9) * (i % 2 ? -1 : 1), tu = nu + cos(ta) * len * 0.7, tv = nv + sin(ta) * len * 0.7;
          ln(nu, nv, az, tu, tv, az, 0.6, MT.horn, own | 11);
          pt(tu, tv + 1, az + 2, C.tip, '*', 0.45 + 0.4 * sin(T * 2 + i * 1.7 + sd) + c.sp * 0.5 + c.joy * 0.5, 0.2 + c.sp * 0.6, own | 11);
          au = nu; av = nv; ang += sd ? -0.12 : 0.2; len *= 0.84;
        }
      }
      return { u: hx - 6, v: hy - 2, r: 26 };
    }
  };

  // t = {r, seed, leaves:[dx,dy,glyph,colour,phase]}
  function tree(u, t, T, top, z, own) {
    const H = top + 6, sd = t.seed;
    surf(Math.min(38, Math.ceil(H / 4)), 6, (s, w, o) => { const y = -1 + s * H, b = (w - 0.5) * PI, r = t.r * (1 + 0.9 * Math.exp(-y / 5) + 0.1 * sin(y * 0.23 + sd * 5)); o[0] = u + r * sin(b) + 2.2 * sin(y * 0.045 + sd * 7); o[1] = y; o[2] = z + r * cos(b); }, MT.bark, own);
    for (let i = 0; i < 2; i++) {
      const by = top * (0.42 + 0.2 * i + 0.1 * h3(sd, i, 3)), dr = h3(sd, i, 5) < 0.5 ? -1 : 1, bx = u + 2.2 * sin(by * 0.045 + sd * 7), L = 12 + 12 * h3(sd, i, 9);
      ln(bx, by, z, bx + dr * L, by + L * 0.55, z, 1.3, MT.bark, own | 1); ln(bx + dr * L, by + L * 0.55, z, bx + dr * L * 1.5, by + L * 1.1, z, 0.7, MT.bark, own | 1);
    }
    const base = top * 0.62, w = Flora.wind(u, T);
    for (const l of t.leaves) { const v = base + l[1] * (top + 8 - base); pt(u + l[0] + w * 0.5 * l[1], v, z + 6, C.leaf[l[3]], l[2], 0.35 + 0.35 * l[1] + 0.12 * sin(T * 0.9 + l[4]), 0); }
  }
  function leaves(rnd, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const y = Math.pow(rnd(), 0.6), sp = 12 + 30 * y; out.push([(rnd() + rnd() + rnd() - 1.5) * sp, y, "*+^'x*%"[(rnd() * 7) | 0], (rnd() * 4) | 0, rnd() * 6]); }
    return out;
  }
  const moon = (u, v, R, own) => ell(u, v, -5000, R, R, R * 0.55, 0, MT.moon, own);
  function mushroom(u, n, glow, T, own) {
    for (let i = 0; i < n; i++) {
      const x = u + (i - (n - 1) / 2) * 3.4 + h3(u, i, 1), h = 2.2 + 2.6 * h3(u, i, 2);
      ln(x, 0, 12, x, h, 12, 0.7, MT.pale, own); ell(x, h + 0.6, 13, 1.7 + 0.5 * h3(u, i, 3), 1.7, 1.2, 0, MT.shroom, own | (i + 1));
      if (glow > 0.05) pt(x, h + 3 + glow * 3, 14, C.tip, '.', glow, glow);
    }
  }
  // fill = list of colour ids of the voices inside, heat 0..1
  function cauldron(u, T, fill, heat, own) {
    const z = 20;
    for (const sd of [-1, 0, 1]) ln(u + sd * 6, 3.4, z - 2 + (sd ? 0 : 5), u + sd * 8, 0.2, z - 2 + (sd ? 0 : 5), 1.3, MT.iron, own | 1);
    ell(u, 8.6, z, 10.4, 7.2, 8, 0, MT.iron, own | 2, true);
    ln(u - 9.6, 14.6, z + 6, u + 9.6, 14.6, z + 6, 1.7, MT.iron, own | 3);
    for (let i = -14; i <= 14; i++) { // the brew: a glowing line that takes the colour of each voice
      const k = fill.length ? fill[(Math.abs(i * 7 + Math.floor(T * 1.5)) % fill.length)] : C.dust, a = fill.length ? 0.75 + 0.25 * sin(T * 3 + i) : 0.18;
      pt(u + i * 0.6, 15.6 + (fill.length && h3(i, Math.floor(T * 4), 1) > 0.8 ? 1 : 0), z + 7, k, i % 3 ? 'o' : '0', a, fill.length ? 0.25 : 0, own | 4);
    }
    for (let i = 0; i < 26; i++) { // fire under the pot
      const k = (T * (0.7 + h3(i, 1, 1)) + h3(i, 2, 2)) % 1, x = u + (h3(i, 3, 3) - 0.5) * 13 * (1 - k * 0.6);
      pt(x, 0.4 + k * (2.6 + 2 * heat), z + 9, k < 0.4 ? C.core : C.flame, k < 0.3 ? '0' : k < 0.6 ? '*' : "'", (1 - k) * (0.5 + 0.5 * heat), (1 - k) * 0.5 * heat, own | 5, 0.6);
    }
    return { u, v: 16, r: 14 };
  }
  return { surf, ell, alchemist, creature, tree, leaves, moon, mushroom, cauldron, MT, C };
})();
