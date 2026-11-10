'use strict';
// Living plants as real 3D surfaces: curved, ruffled petals in whorls that open one after another,
// on a stem that sways. Drawn through G (engine.js).
//
//   const p = Flora.make('peony', {x, y, z, scale, id})   id = object index used in G ownership
//   p.g = 0..1 growth (seed → stem → leaves → bud → layers open → side blooms)
//   Flora.draw(p, t)                                       call between G.begin and G.shade
//   Flora.node(own) → part number;  Flora.SPECIES;  Flora.kick(p, dir, t)
const Flora = (() => {
  const TAU = Math.PI * 2, clamp = (x, a, b) => x < a ? a : x > b ? b : x, smooth = x => x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k;
  const MAXV = 40 * 24, VB = new Float32Array(MAXV * 8), PU = new Float32Array(MAXV), PV = new Float32Array(MAXV), PZ = new Float32Array(MAXV), NN = new Float32Array(MAXV * 3);
  const wind = (x, T) => Math.sin(T * 0.6 + x * 0.04) * 0.9 + Math.sin(T * 1.7 + x * 0.09) * 0.35 + Math.sin(T * 0.23) * 0.5;
  const GREEN = ['#173a2c', '#3f8a68', '#9fd6b4', '#e3f7ea'];
  const SP = {
    peony: { name: 'PAEONIA', H: 62, lean: -5, stemW: 1.7, reg: 5, pat: [0, -1, -1, 2, -1, -1, 4, -1, -1, -1, 3, -1, 2, -1, -1, -1],
      mats: { a: { ramp: ['#3a0a24', '#a3225f', '#f0569a', '#ffc4dd'], alt: '#6a1640', vein: 0.1 }, b: { ramp: ['#4a1030', '#c93a7c', '#ff86b8', '#ffe6f0'], alt: '#7a1c4c', vein: 0.1 } },
      whorls: [
        { n: 5, L: 25, W: 17, c0: 1.45, c1: 1.9, o0: 0.5, o1: 0.0, bow: 1.2, cup: 0.3, ruf: 0.13, rf: 9, az: 0, dl: 0, m: 'a' },
        { n: 5, L: 22, W: 15, c0: 1.47, c1: 1.92, o0: 0.82, o1: 0.4, bow: 1.2, cup: 0.4, ruf: 0.16, rf: 10, az: 0.63, dl: 0.12, m: 'a' },
        { n: 6, L: 18, W: 12, c0: 1.5, c1: 1.95, o0: 1.08, o1: 0.78, cup: 0.5, ruf: 0.18, rf: 11, az: 0.3, dl: 0.26, m: 'b' },
        { n: 5, L: 14, W: 9, c0: 1.52, c1: 1.98, o0: 1.3, o1: 1.12, cup: 0.55, ruf: 0.2, rf: 12, az: 0.9, dl: 0.4, m: 'b' },
        { n: 4, L: 10, W: 7, c0: 1.55, c1: 2.0, o0: 1.45, o1: 1.5, cup: 0.6, ruf: 0.2, rf: 12, az: 0.2, dl: 0.55, m: 'b' }],
      leaves: [{ k: 0.18, az: 0.4, L: 24, W: 8 }, { k: 0.34, az: 3.3, L: 22, W: 7.5 }, { k: 0.5, az: 1.6, L: 18, W: 6.5 }, { k: 0.66, az: 4.6, L: 14, W: 5 }],
      heads: [{ scale: 1, tilt: 1.0, start: 0.3, end: 0.8 }, { br: { k: 0.56, len: 20, ang: 0.95, az: 0.25 }, scale: 0.62, tilt: 0.7, start: 0.52, end: 1 }, { br: { k: 0.4, len: 14, ang: 1.0, az: 3.0 }, scale: 0.42, tilt: 0.4, start: 0.62, end: 1, max: 0.1 }] },
    anemone: { name: 'ANEMONE', H: 56, lean: 4, stemW: 1.4, reg: 8, pat: [-1, -1, 4, -1, -1, -1, -1, 2, -1, -1, -1, 3, -1, -1, 5, -1],
      mats: { a: { ramp: ['#081a66', '#2447e8', '#7f9bff', '#e3eaff'], alt: '#1a2c9a', vein: 0.14, mark: { col: '#e6ecff', s: 0.24, w: 1.3 } }, d: { ramp: ['#0a0c22', '#1b1e4a', '#3b3f8a', '#8087d6'], ao: 0, rim: 0.5 } },
      whorls: [
        { n: 4, L: 15, W: 7.6, wp: 0.95, tip: 0.6, claw: 0.25, c0: 1.3, c1: 2.0, o0: 0.26, o1: 0.1, cup: 0.18, ruf: 0.05, rf: 8, az: 0.2, dl: 0, m: 'a', r0: 2.4 },
        { n: 4, L: 14, W: 7, wp: 0.95, tip: 0.6, claw: 0.25, c0: 1.35, c1: 2.05, o0: 0.42, o1: 0.24, cup: 0.2, ruf: 0.05, rf: 9, az: 0.985, dl: 0.2, m: 'a', r0: 2.2 }],
      disc: { r: 3.7, m: 'd' }, stam: { n: 28, len: 3.4, spread: 1.15, dl: 0.6, col: '#5a66d8', tip: '#dfe5ff' },
      leaves: [{ k: 0.08, az: 0.6, L: 17, W: 5.5 }, { k: 0.1, az: 2.7, L: 18, W: 6 }, { k: 0.12, az: 4.8, L: 16, W: 5.5 }, { k: 0.76, az: 0.3, L: 7, W: 2.4, e0: 0.5, e1: 0.1 }, { k: 0.76, az: 2.4, L: 7, W: 2.4, e0: 0.5, e1: 0.1 }, { k: 0.76, az: 4.5, L: 7, W: 2.4, e0: 0.5, e1: 0.1 }],
      heads: [{ scale: 1, tilt: 1.38, start: 0.3, end: 0.82 }, { br: { k: 0.4, len: 26, ang: 0.7, az: 2.9 }, scale: 0.55, tilt: 0.8, start: 0.55, end: 1, max: 0.3 }] },
    lily: { name: 'LILIUM', H: 70, lean: 5, stemW: 1.6, reg: 10, pat: [-1, -1, -1, -1, 2, -1, -1, -1, -1, 0, -1, -1, -1, 4, -1, -1],
      mats: { a: { ramp: ['#1f3b30', '#6fa58a', '#cfeadb', '#ffffff'], alt: '#5f8f78', vein: 0.1, mark: { col: '#b6e36a', s: 0.34, w: 0.6 } } },
      whorls: [
        { n: 3, L: 34, W: 9, wp: 0.62, tip: 0.85, c0: 1.5, c1: 1.62, o0: 1.15, o1: -0.95, bow: 1.7, cup: 0.3, ruf: 0.06, rf: 8, az: 0.2, dl: 0, m: 'a' },
        { n: 3, L: 32, W: 8, wp: 0.62, tip: 0.85, c0: 1.52, c1: 1.66, o0: 1.2, o1: -0.65, bow: 1.7, cup: 0.3, ruf: 0.06, rf: 8, az: 1.247, dl: 0.15, m: 'a' }],
      stam: { n: 6, len: 22, spread: 0.3, col: '#cfe9d8', tip: '#ff9a3c' },
      leaves: [0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64].map((k, i) => ({ k, az: i * 2.4, L: 17 - i, W: 2.6, e0: 0.9, e1: 0.1 })),
      heads: [{ scale: 1, tilt: 0.9, start: 0.3, end: 0.8 }, { br: { k: 0.72, len: 16, ang: 1.0, az: 2.6 }, scale: 0.7, tilt: 1.1, start: 0.52, end: 1 }, { br: { k: 0.62, len: 12, ang: 0.9, az: 0.3 }, scale: 0.45, tilt: 0.5, start: 0.64, end: 1, max: 0.06 }] },
    iris: { name: 'IRIS', H: 68, lean: -3, stemW: 1.7, reg: 6, pat: [-1, 1, -1, -1, -1, 3, -1, -1, 0, -1, -1, -1, -1, -1, -1, 2],
      mats: { a: { ramp: ['#4a2600', '#d58a22', '#ffd47f', '#fff5dc'], alt: '#8a5210', vein: 0.14 }, b: { ramp: ['#2a0718', '#7a1f4a', '#c24a86', '#ffb3d8'], alt: '#4a1030', vein: 0.16, mark: { col: '#ffc45e', s: 0.45, w: 0.24 } } },
      whorls: [
        { n: 3, L: 30, W: 18, claw: 0.3, c0: 1.5, c1: 1.7, o0: 0.55, o1: -1.3, bow: 1.5, cup: -0.22, ruf: 0.2, rf: 10, az: 1.047, dl: 0, m: 'b' },
        { n: 3, L: 26, W: 16, claw: 0.25, c0: 1.5, c1: 1.9, o0: 1.35, o1: 1.95, bow: 1.4, cup: 0.5, ruf: 0.2, rf: 10, az: 0, dl: 0.2, m: 'a' },
        { n: 3, L: 10, W: 5, c0: 1.5, c1: 1.6, o0: 0.5, o1: 0.2, cup: 0.5, az: 1.047, dl: 0.3, m: 'a' }],
      leaves: [{ k: 0, az: 0.3, L: 50, W: 3.4, e0: 1.42, e1: 1.0 }, { k: 0, az: 2.4, L: 44, W: 3.2, e0: 1.4, e1: 0.9 }, { k: 0, az: 4.4, L: 38, W: 3, e0: 1.38, e1: 0.85 }, { k: 0, az: 3.4, L: 30, W: 2.8, e0: 1.36, e1: 0.9 }],
      heads: [{ scale: 1, tilt: 0.3, start: 0.3, end: 0.8 }, { br: { k: 0.6, len: 18, ang: 0.75, az: 0.1 }, scale: 0.66, tilt: 0.35, start: 0.52, end: 1 }] },
    daisy: { name: 'BELLIS', H: 34, lean: 2, stemW: 1.2, reg: 9, pat: [-1, -1, 4, -1, -1, 2, -1, -1, -1, -1, -1, 3, -1, -1, 5, -1],
      mats: { a: { ramp: ['#3a4a6a', '#9ab4de', '#e6f0ff', '#ffffff'], alt: '#7f9fd6' }, d: { ramp: ['#5a3a00', '#c98a1e', '#ffc45e', '#fff0c0'], ao: 0 } },
      whorls: [
        { n: 13, L: 13, W: 2.6, tip: 0.5, c0: 1.45, c1: 1.75, o0: 0.3, o1: 0, cup: 0.2, az: 0, dl: 0, m: 'a', ns: 7, nw: 2 },
        { n: 13, L: 11.5, W: 2.4, tip: 0.5, c0: 1.5, c1: 1.8, o0: 0.55, o1: 0.25, cup: 0.2, az: 0.24, dl: 0.25, m: 'a', ns: 7, nw: 2 }],
      disc: { r: 3.6, m: 'd' }, leaves: [{ k: 0.05, az: 0.5, L: 14, W: 3.5 }, { k: 0.05, az: 2.6, L: 13, W: 3.5 }, { k: 0.05, az: 4.6, L: 12, W: 3.2 }],
      heads: [{ scale: 1, tilt: 1.3, start: 0.3, end: 0.9 }] },
    bell: { name: 'CAMPANULA', H: 44, lean: -6, stemW: 1.2, reg: 7, pat: [2, -1, -1, -1, 0, -1, -1, 3, -1, -1, 1, -1, -1, -1, 4, -1],
      mats: { a: { ramp: ['#1d1a6b', '#5a50e6', '#a59cff', '#ece9ff'], alt: '#3a2fa8', vein: 0.12 } },
      whorls: [{ n: 5, L: 15, W: 8, tip: 0.75, c0: 1.5, c1: 1.75, o0: 1.35, o1: 0.2, bow: 2.6, cup: 0.55, az: 0, dl: 0, m: 'a', ns: 9, nw: 4 }],
      stam: { n: 3, len: 9, spread: 0.12, col: '#cfc9ff', tip: '#ffe9a8' },
      leaves: [{ k: 0.08, az: 0.8, L: 16, W: 4 }, { k: 0.2, az: 3.6, L: 14, W: 3.6 }, { k: 0.36, az: 2.0, L: 11, W: 3 }],
      heads: [{ scale: 1, tilt: 2.3, start: 0.3, end: 0.85 }, { br: { k: 0.7, len: 10, ang: 1.25, az: 0.2 }, scale: 0.85, tilt: 2.2, start: 0.45, end: 0.95 }, { br: { k: 0.52, len: 11, ang: 1.25, az: 3.2 }, scale: 0.75, tilt: 2.2, start: 0.55, end: 1 }] }
  };
  let stemM = -1, leafM = -1;
  function prep(sp) {
    if (stemM < 0) { stemM = G.material({ ramp: GREEN, mode: 'hatch', ao: 0, amb: 0.3, rim: 0.2, spec: 0.2, edge: 0.1 }); leafM = G.material({ ramp: GREEN, alt: '#24553f', mode: 'hatch', ao: 0.5, amb: 0.14, rim: 0.25, spec: 0.3, edge: 0.18, back: 0.6 }); }
    if (sp.mid) return; sp.mid = {};
    for (const k in sp.mats) sp.mid[k] = G.material(sp.mats[k]);
    if (sp.stam) { sp.stam.ci = G.col(sp.stam.tip); sp.stam.mat = G.material({ ramp: [sp.stam.col, sp.stam.col, sp.stam.col, '#ffffff'], mode: 'hatch', ao: 0, amb: 0.45, edge: 0 }); }
  }
  function make(species, o) {
    const sp = SP[species]; prep(sp);
    return Object.assign({ species, sp, name: sp.name, x: 0, y: 0, z: 0, scale: 1, id: 0, g: 0, tg: 0, yaw: 0, turn: 0.3, sway: 1, ph: Math.random() * 6, imp: 0, tk: 0, seed: Math.random() * 9 }, o);
  }
  const shape = (s, wh) => Math.pow(Math.sin(Math.PI * Math.pow(s, wh.wp || 0.75)), wh.tip || 0.6) * (wh.claw ? 0.22 + 0.78 * smooth(clamp(s / wh.claw, 0, 1)) : 1);
  // frame for the surface being built: plant → view, and head → plant
  let cP, ct, st, sc, ox, oy, oz, cT, sT, cY, sY, cD = 1, sD = 0, TX = 0, TY = 0, TZ = 0, OU = 0, OV = 0, OZ = 0;
  function headToView(X, Y, Z) { // head frame → view
    const x1 = X * cY + Z * sY, z1 = -X * sY + Z * cY, y2 = Y * cT - z1 * sT, z2 = Y * sT + z1 * cT;
    plantToView(ox + x1 * cD + z2 * sD, oy + y2, oz - x1 * sD + z2 * cD);
  }
  function plantToView(X, Y, Z) { OU = cP.x + (X * ct + Z * st) * sc; OV = cP.y + Y * sc; OZ = cP.z + (-X * st + Z * ct) * sc; }
  // Flora.cam = { proj(x,y,z) → false if behind the eye, else sets .u .v .z .s (scale); rot(nx,ny,nz) sets .nx .ny .nz }
  // With a camera set, plant x,y,z are world coordinates and everything is drawn in perspective. Without, as before.
  function L3(u0, v0, z0, u1, v1, z1, w, mat, own) { const c = api.cam; if (!c) return G.line(u0, v0, z0, u1, v1, z1, w, mat, own); if (!c.proj(u0, v0, z0)) return; const a = c.u, b = c.v, d = c.z, s0 = c.s; if (!c.proj(u1, v1, z1)) return; G.line(a, b, d, c.u, c.v, c.z, w * (s0 + c.s) / 2, mat, own); }
  function P3(u, v, z, ci, ch, al, wh, own) { const c = api.cam; if (!c) return G.plot(u, v, z, ci, ch, al, wh, own); if (c.proj(u, v, z)) G.plot(c.u, c.v, c.z, ci, ch, al, wh, own); }
  function grid(NS, NW, fn, mat, own, inHead, wfn) {
    const row = NW + 1, cm = api.cam;
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NW; j++) {
      fn(i, j); if (inHead) headToView(TX, TY, TZ); else plantToView(TX, TY, TZ);
      const k = i * row + j; PU[k] = OU; PV[k] = OV; PZ[k] = OZ;
    }
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NW; j++) {
      const k = i * row + j, a = (i < NS ? i + 1 : i) * row + j, b = (i > 0 ? i - 1 : i) * row + j, c = i * row + (j < NW ? j + 1 : j), d = i * row + (j > 0 ? j - 1 : j);
      const sx = PU[a] - PU[b], sy = PV[a] - PV[b], sz = PZ[a] - PZ[b], wx = PU[c] - PU[d], wy = PV[c] - PV[d], wz = PZ[c] - PZ[d];
      let nx = wy * sz - wz * sy, ny = wz * sx - wx * sz, nz = wx * sy - wy * sx; const l = Math.hypot(nx, ny, nz);
      if (l < 1e-7) { const q = (i > 0 ? k - row : k + row) * 3; nx = NN[q]; ny = NN[q + 1]; nz = NN[q + 2]; } else { nx /= l; ny /= l; nz /= l; }
      NN[k * 3] = nx; NN[k * 3 + 1] = ny; NN[k * 3 + 2] = nz;
    }
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NW; j++) {
      const k = i * row + j, q = k * 8;
      if (cm) { // a perspective camera is set: project the point, turn the normal to face it
        if (!cm.proj(PU[k], PV[k], PZ[k])) return; VB[q] = cm.u; VB[q + 1] = cm.v; VB[q + 2] = cm.z; cm.rot(NN[k * 3], NN[k * 3 + 1], NN[k * 3 + 2]); VB[q + 3] = cm.nx; VB[q + 4] = cm.ny; VB[q + 5] = cm.nz;
      } else { VB[q] = PU[k]; VB[q + 1] = PV[k]; VB[q + 2] = PZ[k]; VB[q + 3] = NN[k * 3]; VB[q + 4] = NN[k * 3 + 1]; VB[q + 5] = NN[k * 3 + 2]; }
      VB[q + 6] = i / NS; VB[q + 7] = wfn ? wfn(j) : j / NW * 2 - 1;
    }
    G.mesh(VB, NS, NW, mat, own);
  }
  const RR = new Float32Array(40), HH = new Float32Array(40), CE = new Float32Array(40), SE = new Float32Array(40), WD = new Float32Array(40);
  function petal(wh, j, lo, hs, mat, own, inHead, lod) {
    const fz = wh.fuse, nw0 = wh.nw || (fz ? 20 : 8), NS = Math.min(38, lod ? Math.max(5, (wh.ns || 16) >> 1) : (wh.ns || 16)), NW = Math.min(23, lod ? Math.max(2, nw0 >> 1) : nw0);
    const e0 = lerp(wh.c0, wh.o0, lo), e1 = lerp(wh.c1, wh.o1, lo), L = wh.L * hs * (0.6 + 0.4 * lo), Wd = wh.W * hs * (0.45 + 0.55 * lo), cup = wh.cup * (1 + 0.9 * (1 - lo));
    const az = wh.az + j * TAU / wh.n, ca = Math.cos(az), sa = Math.sin(az), dl = L / NS, ruf = wh.ruf || 0, rf = wh.rf || 9;
    let r = (wh.r0 == null ? 1.2 : wh.r0) * hs, h = 0;
    for (let i = 0; i <= NS; i++) { const s = i / NS, e = e0 + (e1 - e0) * (wh.kn ? smooth(clamp((s - wh.kn[0]) / (wh.kn[1] - wh.kn[0]), 0, 1)) : Math.pow(s, wh.bow || 1)); CE[i] = Math.cos(e); SE[i] = Math.sin(e); if (i) { r += CE[i] * dl; h += SE[i] * dl; } RR[i] = r; HH[i] = h; WD[i] = Wd * shape(s, wh); }
    if (fz) { // optional: one fused corolla (trumpet, bell, round leaf) with n rim lobes. lobe = notch depth, tw = spiral twist while closed, pl = pleat depth
      const n = wh.n, lobe = wh.lobe || 0, tw = (wh.tw || 0) * (1 - lo), pl = wh.pl || 0, rw = ruf * L;
      grid(NS, NW, (i, k) => {
        const b0 = k / NW * TAU, c = Math.cos(n * b0), s = i / NS * (1 - lobe * (0.5 - 0.5 * c)), f = s * NS, i0 = Math.min(NS - 1, f | 0), q = f - i0, b = az + b0 + tw * s;
        const rr = Math.max(0.05, (RR[i0] + (RR[i0 + 1] - RR[i0]) * q) * (1 + pl * c * s)), wv = rw * s * s * Math.sin(rf * b0);
        TX = Math.cos(b) * rr; TY = HH[i0] + (HH[i0 + 1] - HH[i0]) * q + wv; TZ = Math.sin(b) * rr;
      }, mat, own, inHead, k => Math.abs((k * n / NW + 0.5) % 1 - 0.5) * 2);
      return;
    }
    grid(NS, NW, (i, k) => {
      const s = i / NS, w = k / NW * 2 - 1, wd = WD[i], lift = cup * wd * w * w + ruf * wd * Math.sin(s * rf + j * 1.3 + w * 2.2) * w * w;
      const rr = RR[i] - SE[i] * lift, lat = w * wd; TX = ca * rr - sa * lat; TY = HH[i] + CE[i] * lift; TZ = sa * rr + ca * lat;
    }, mat, own, inHead);
  }
  function kick(p, dir, t) { p.imp = dir * 1.6; p.tk = t; }
  const LEAF = { c0: 1.4, c1: 1.5, cup: 0.45, ruf: 0.08, rf: 7, n: 1, dl: 0, wp: 0.7, tip: 0.7, r0: 0.3, ns: 12, nw: 4, bow: 1.3 };
  function draw(p, T) {
    const sp = p.sp, g = p.g; if (g <= 0) return; cP = p; sc = p.scale; const lod = sc < 0.55 || p.lod, own0 = (p.id + 1) << 8;
    const kk = p.imp ? p.imp * Math.sin((T - p.tk) * 5.5) * Math.exp(-(T - p.tk) * 1.3) : 0;
    const wn = (wind(p.x, T) * 1.3 + kk * 2.2) * p.sway, wz = wind(p.x + 40, T) * 0.7 * p.sway, H = sp.H;
    const th = p.yaw + p.turn * Math.sin(T * 0.17 + p.ph) + wn * 0.025; ct = Math.cos(th); st = Math.sin(th);
    const kTop = smooth(clamp(g / 0.35, 0, 1)), bend = sp.lean + wn * 2.2;
    // stem
    const nseg = Math.max(2, Math.ceil(H * kTop / 3));
    plantToView(0, 0, 0); let pu = OU, pv = OV, pz = OZ;
    for (let i = 1; i <= nseg; i++) { const k = kTop * i / nseg; plantToView(bend * k * k, H * k, wz * 2 * k * k); L3(pu, pv, pz, OU, OV, OZ, sp.stemW * sc, stemM, own0); pu = OU; pv = OV; pz = OZ; }
    // leaves
    sp.leaves.forEach((lv, i) => {
      const lf = smooth(clamp((g - 0.05 - 0.3 * lv.k) / 0.32, 0, 1)); if (lf < 0.03 || lv.k > kTop) return;
      ox = bend * lv.k * lv.k; oy = H * lv.k; oz = wz * 2 * lv.k * lv.k; cT = 1; sT = 0; cY = 1; sY = 0; cD = 1; sD = 0;
      if (lv.pet) { // optional leaf stalk: pet = length, pe = elevation, sag = droop of the stalk
        const pe = lv.pe == null ? 0.7 : lv.pe, pl = lv.pet * lf, dx = Math.cos(lv.az) * Math.cos(pe), dz = Math.sin(lv.az) * Math.cos(pe), dy = Math.sin(pe), sg = lv.sag || 0, x0 = ox, y0 = oy, z0 = oz;
        plantToView(x0, y0, z0); let qu = OU, qv = OV, qz = OZ;
        for (let q = 1; q <= 4; q++) { const k = q / 4; ox = x0 + dx * pl * k; oy = y0 + dy * pl * k - sg * pl * k * k; oz = z0 + dz * pl * k; plantToView(ox, oy, oz); L3(qu, qv, qz, OU, OV, OZ, sp.stemW * sc * 0.6, stemM, own0); qu = OU; qv = OV; qz = OZ; }
      }
      LEAF.wp = lv.wp || 0.7; LEAF.tip = lv.tip || 0.7; LEAF.cup = lv.cup == null ? 0.45 : lv.cup; LEAF.ruf = lv.ruf == null ? 0.08 : lv.ruf; LEAF.rf = lv.rf || 7; LEAF.bow = lv.bow || 1.3; LEAF.claw = lv.claw; LEAF.r0 = lv.r0 == null ? 0.3 : lv.r0;
      LEAF.fuse = lv.fuse; LEAF.lobe = lv.lobe; LEAF.ns = lv.ns || 12; LEAF.nw = lv.nw || 4;
      const e0 = (lv.e0 == null ? 1.15 : lv.e0) + wn * 0.02, e1 = (lv.e1 == null ? 0.15 : lv.e1) + wn * 0.05;
      LEAF.L = lv.L; LEAF.W = lv.W; LEAF.az = lv.az; LEAF.c0 = e0 + 0.25; LEAF.c1 = e0 + 0.35; LEAF.o0 = e0; LEAF.o1 = e1;
      petal(LEAF, i, lf, 1, leafM, own0 | 1, true, lod);
    });
    // heads
    sp.heads.forEach((hd, hi) => {
      if (g <= hd.start) return;
      let hx, hy, hz;
      if (hd.br) {
        const b = hd.br; if (kTop < b.k) return; const bl = b.len * smooth(clamp((g - hd.start + 0.1) / 0.2, 0, 1));
        const bx = bend * b.k * b.k, by = H * b.k, bz = wz * 2 * b.k * b.k, dx = Math.cos(b.az) * Math.sin(b.ang), dz = Math.sin(b.az) * Math.sin(b.ang), dy = Math.cos(b.ang);
        plantToView(bx, by, bz); let qu = OU, qv = OV, qz = OZ;
        for (let i = 1; i <= 4; i++) { const q = i / 4; hx = bx + dx * bl * q + wn * 0.4 * q; hy = by + dy * bl * q + 0.3 * bl * q * q; hz = bz + dz * bl * q; plantToView(hx, hy, hz); L3(qu, qv, qz, OU, OV, OZ, sp.stemW * sc * 0.8, stemM, own0); qu = OU; qv = OV; qz = OZ; }
      } else { if (kTop < 0.9) return; hx = bend; hy = H * kTop; hz = wz * 2; }
      ox = hx; oy = hy; oz = hz;
      const hs = hd.scale * (0.22 + 0.78 * smooth(clamp((g - hd.start) / 0.25, 0, 1)));
      const open = smooth(clamp((g - hd.start - 0.1) / (hd.end - hd.start - 0.1), 0, 1)) * (hd.max == null ? 1 : hd.max) * (0.97 + 0.03 * Math.sin(T * 0.5 + hi * 2));
      const tl = (hd.tilt0 == null ? hd.tilt * (0.3 + 0.7 * open) : lerp(hd.tilt0, hd.tilt, open)) + wn * 0.03, hyw = (hd.yaw || 0) + (hd.fix ? 0 : hi * 1.1); cD = Math.cos(hd.dir || 0); sD = Math.sin(hd.dir || 0); cT = Math.cos(tl); sT = Math.sin(tl); cY = Math.cos(hyw); sY = Math.sin(hyw);
      let node = 2 + hi * (sp.nstep || 40);
      for (const wh of sp.whorls) {
        const lo = smooth(clamp((open - wh.dl) / (1 - wh.dl), 0, 1)), mat = sp.mid[wh.m];
        for (let j = 0, np = wh.fuse ? 1 : wh.n; j < np; j++, node++) petal(wh, j, lo, hs, mat, own0 | node, true, lod);
      }
      if (sp.disc) { const R = sp.disc.r * hs, dn = sp.disc.nw || 10, dh = sp.disc.h == null ? 0.7 : sp.disc.h, dy = (sp.disc.y == null ? 0.4 : sp.disc.y) * hs; grid(4, dn, (i, k) => { const a = i / 4 * 1.45, b = k / dn * TAU; TX = R * Math.sin(a) * Math.cos(b); TY = R * Math.cos(a) * dh + dy; TZ = R * Math.sin(a) * Math.sin(b); }, sp.mid[sp.disc.m], own0 | node, true); }
      if (sp.stam && open > (sp.stam.dl || 0.3)) {
        const q = sp.stam, len = q.len * hs * smooth(clamp((open - (q.dl || 0.3)) / 0.5, 0, 1));
        for (let j = 0; j < q.n; j++) {
          const b = j * TAU / q.n + 0.4, spd = q.spread * (0.8 + 0.4 * G.h3(j, hi, 7)), r0 = (sp.disc ? sp.disc.r * hs * 0.8 : 0.5);
          headToView(Math.cos(b) * r0, 0.5 * hs, Math.sin(b) * r0); const au = OU, av = OV, az = OZ;
          headToView(Math.cos(b) * (r0 + Math.sin(spd) * len), 0.5 * hs + Math.cos(spd) * len, Math.sin(b) * (r0 + Math.sin(spd) * len));
          L3(au, av, az, OU, OV, OZ, 0.5, q.mat, own0 | node); P3(OU, OV, OZ + 0.6, q.ci, 'o', 1, 0.25, own0 | node);
        }
      }
    });
  }
  const api = { SPECIES: SP, make, draw, kick, wind, node: own => own & 255 };
  api.cam = null; return api;
})();
