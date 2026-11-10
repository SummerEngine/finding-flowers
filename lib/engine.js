'use strict';
// Glyph renderer: surfaces are rasterised into a cell grid with depth, then every cell is shaded
// and turned into one character that follows the surface (rings on lit flats, slashes on slopes,
// bars on silhouettes). Units: 1 unit = 1 row. u grows right, v grows up, z grows toward the eye.
//
//   G.init(canvas, {rows, cols, portraitRows, origin:[fx,fy], onResize})
//   G.begin(t)                          clear buffers for a new frame
//   G.plot(u,v,z,ci,ch,alpha,white,own,warm)   one fixed glyph (ci = G.col('#hex'), ch = 'x')
//   G.mesh(V,ns,nw,mat,own)             grid mesh, V = Float32Array stride 8: u,v,z,nx,ny,nz,s,w
//   G.line(u0,v0,z0,u1,v1,z1,width,mat,own)    lit 3D line (stems)
//   G.material({ramp:[4 hex dark→light], alt, mode:'ring'|'hatch', ...}) → id
//   G.shade()                           light the rasterised surfaces (uses G.L, G.waves, G.warm)
//   G.reflect(v, depth, strength)       mirror everything above water line v
//   G.end()                             draw with bloom; returns the 2D context for readouts
//   G.pick(u,v) → own id or 0;  G.toUV(event) → {u,v}
const G = (() => {
  const A = 0.6;
  const GL = " .,:;'^*+-=_~/\\|!<>ox0123456789OI&%#@$l()v";
  const gi = {}; for (let i = 0; i < GL.length; i++) gi[GL[i]] = i;
  const DG = [...'0123456789'].map(c => gi[c]);
  const pal = [], palIx = {};
  const col = hex => { let i = palIx[hex]; if (i === undefined) { i = pal.length; pal.push(hex); palIx[hex] = i; } return i; };
  const WHITE = col('#ffffff'), WARM = col('#ff8a2a');
  const S = { A, W: 0, H: 0, DPR: 1, cellW: 0, cellH: 0, COLS: 0, ROWS: 0, NB: 0, ox: 0, oy: 0, t: 0, halfU: 100 };
  let cv, ctx, layer, lctx, blurs, opt, atl = [];
  let Z, CI, GY, AL, WH, WM, OW, MID, NX, NY, NZ, SA, WA;
  const mats = [];
  const api = { S, col, gi, L: [0.36, 0.56, 0.75], waves: [], warm: null, glow: 1, lit: null };
  { const l = Math.hypot(...api.L); api.L = api.L.map(x => x / l); }
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const h3 = (a, b, c) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return n - Math.floor(n); };

  function init(canvas, o) {
    cv = canvas; ctx = cv.getContext('2d'); layer = document.createElement('canvas'); lctx = layer.getContext('2d');
    blurs = [0, 1, 2].map(() => document.createElement('canvas'));
    opt = Object.assign({ rows: 124, cols: 200, portraitRows: 150, origin: [0.5, 0.8] }, o);
    addEventListener('resize', resize); resize();
  }
  function resize() {
    const DPR = S.DPR = Math.min(window.devicePixelRatio || 1, 2), W = S.W = Math.floor((cv.clientWidth || innerWidth) * DPR), H = S.H = Math.floor((cv.clientHeight || innerHeight) * DPR);
    S.portrait = W < H * 0.9;
    const ch = S.portrait ? Math.max(H / opt.portraitRows, W / opt.cols) : Math.min(H / opt.rows, W / opt.cols);
    S.cellW = Math.max(3, Math.round(ch * A)); S.cellH = Math.round(S.cellW / A);
    S.COLS = Math.ceil(W / S.cellW); S.ROWS = Math.ceil(H / S.cellH); const NB = S.NB = S.COLS * S.ROWS;
    S.ox = Math.floor(S.COLS * opt.origin[0]); S.oy = Math.round(S.ROWS * opt.origin[1]); S.halfU = S.COLS * A / 2;
    cv.width = layer.width = W; cv.height = layer.height = H;
    blurs.forEach((b, i) => { b.width = Math.ceil(W / (2 << i)); b.height = Math.ceil(H / (2 << i)); });
    atl = [];
    Z = new Float32Array(NB); AL = new Float32Array(NB); WH = new Float32Array(NB); WM = new Float32Array(NB);
    NX = new Float32Array(NB); NY = new Float32Array(NB); NZ = new Float32Array(NB); SA = new Float32Array(NB); WA = new Float32Array(NB);
    CI = new Uint8Array(NB); GY = new Uint8Array(NB); OW = new Int32Array(NB); MID = new Int16Array(NB);
    if (opt.onResize) opt.onResize(S);
  }
  function atlas(ci) {
    let a = atl[ci]; if (a) return a;
    a = document.createElement('canvas'); a.width = GL.length * S.cellW; a.height = S.cellH;
    const x = a.getContext('2d'); x.font = `600 ${Math.round(S.cellH * 0.94)}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = pal[ci];
    for (let i = 0; i < GL.length; i++) x.fillText(GL[i], i * S.cellW + S.cellW / 2, S.cellH / 2 + S.cellH * 0.04);
    return atl[ci] = a;
  }
  function begin(t) { S.t = t; Z.fill(-1e30); OW.fill(0); MID.fill(-1); }
  function plot(u, v, z, ci, ch, al, wh, own, warm) {
    const c = S.ox + Math.round(u / A), r = S.oy - Math.round(v); if (c < 0 || c >= S.COLS || r < 0 || r >= S.ROWS || al < 0.015) return;
    const k = r * S.COLS + c; if (z <= Z[k]) return;
    Z[k] = z; CI[k] = ci; GY[k] = gi[ch] || 0; AL[k] = al; WH[k] = wh || 0; WM[k] = warm || 0; OW[k] = own || 0; MID[k] = -1;
  }
  function material(d) {
    const m = Object.assign({ mode: 'ring', amb: 0.08, dif: 0.64, rim: 0.16, spec: 0.5, ao: 1, edge: 0.07, flat: 0.34, warm: 1, back: 0.7, vein: 0 }, d);
    m.r = m.ramp.map(col); m.a = m.alt ? col(m.alt) : -1; m.mk = m.mark ? col(m.mark.col) : -1; m.hatch = m.mode === 'hatch';
    mats.push(m); return mats.length - 1;
  }
  function tri(V, a, b, c, mat, own) {
    const COLS = S.COLS, x0 = S.ox + V[a] / A, y0 = S.oy - V[a + 1], x1 = S.ox + V[b] / A, y1 = S.oy - V[b + 1], x2 = S.ox + V[c] / A, y2 = S.oy - V[c + 1];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (area > -1e-5 && area < 1e-5) return;
    const c0 = Math.max(0, Math.ceil(Math.min(x0, x1, x2))), c1 = Math.min(COLS - 1, Math.floor(Math.max(x0, x1, x2)));
    const r0 = Math.max(0, Math.ceil(Math.min(y0, y1, y2))), r1 = Math.min(S.ROWS - 1, Math.floor(Math.max(y0, y1, y2)));
    const inv = 1 / area;
    for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
      const w0 = ((x1 - cc) * (y2 - r) - (x2 - cc) * (y1 - r)) * inv, w1 = ((x2 - cc) * (y0 - r) - (x0 - cc) * (y2 - r)) * inv, w2 = 1 - w0 - w1;
      if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
      const z = w0 * V[a + 2] + w1 * V[b + 2] + w2 * V[c + 2], k = r * COLS + cc; if (z <= Z[k]) continue;
      Z[k] = z; MID[k] = mat; OW[k] = own;
      NX[k] = w0 * V[a + 3] + w1 * V[b + 3] + w2 * V[c + 3]; NY[k] = w0 * V[a + 4] + w1 * V[b + 4] + w2 * V[c + 4]; NZ[k] = w0 * V[a + 5] + w1 * V[b + 5] + w2 * V[c + 5];
      SA[k] = w0 * V[a + 6] + w1 * V[b + 6] + w2 * V[c + 6]; WA[k] = w0 * V[a + 7] + w1 * V[b + 7] + w2 * V[c + 7];
    }
  }
  function mesh(V, ns, nw, mat, own) {
    const row = (nw + 1) * 8;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nw; j++) {
      const a = i * row + j * 8, b = a + 8, c = a + row, d = c + 8;
      tri(V, a, b, c, mat, own); tri(V, b, d, c, mat, own);
    }
  }
  function cell(u, v, z, nx, ny, nz, s, w, mat, own) {
    const c = S.ox + Math.round(u / A), r = S.oy - Math.round(v); if (c < 0 || c >= S.COLS || r < 0 || r >= S.ROWS) return;
    const k = r * S.COLS + c; if (z <= Z[k]) return;
    Z[k] = z; MID[k] = mat; OW[k] = own; NX[k] = nx; NY[k] = ny; NZ[k] = nz; SA[k] = s; WA[k] = w;
  }
  function line(u0, v0, z0, u1, v1, z1, wid, mat, own) {
    const du = u1 - u0, dv = v1 - v0, len = Math.hypot(du / A, dv), n = Math.max(1, Math.ceil(len * 1.6)), il = 1 / (Math.hypot(du, dv) || 1);
    const nx = dv * il, ny = -du * il, hw = Math.max(0, Math.round(wid / A / 2 - 0.5));
    for (let i = 0; i <= n; i++) {
      const k = i / n, u = u0 + du * k, v = v0 + dv * k, z = z0 + (z1 - z0) * k;
      for (let j = -hw; j <= hw; j++) cell(u + j * A, v, z, nx * 0.8 + j * 0.25, ny * 0.8, 0.55, 0.6, 0, mat, own);
    }
  }
  function shade() {
    const COLS = S.COLS, ROWS = S.ROWS, NB = S.NB, T = S.t, L = api.L, Lx = L[0], Ly = L[1], Lz = L[2];
    let hx = Lx, hy = Ly, hz = Lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const so = [[Math.round(Lx * 2.6 / A), -Math.round(Ly * 2.6)], [Math.round(Lx * 5.5 / A), -Math.round(Ly * 5.5)]];
    const ws = api.waves, wm = api.warm, tk = Math.floor(T * 1.5);
    for (let k = 0; k < NB; k++) {
      const m = MID[k]; if (m < 0) continue;
      const M = mats[m], z = Z[k], own = OW[k], c = k % COLS, r = (k / COLS) | 0;
      if (M.holes && h3((SA[k] * M.hs) | 0, (WA[k] * M.hs) | 0, own & 255) < M.holes) { AL[k] = 0; WH[k] = 0; WM[k] = 0; continue; } // airy surfaces: gaps that stay put on the surface
      let nx = NX[k], ny = NY[k], nz = NZ[k]; const il = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= il; ny *= il; nz *= il;
      let back = false; if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; back = true; }
      let d = nx * Lx + ny * Ly + nz * Lz; if (d < 0) d = 0;
      // silhouette: a neighbour that is empty or clearly behind
      const zt = z - 1.3;
      const eL = c === 0 || (Z[k - 1] < zt && OW[k - 1] !== own), eR = c === COLS - 1 || (Z[k + 1] < zt && OW[k + 1] !== own), eU = r === 0 || (Z[k - COLS] < zt && OW[k - COLS] !== own), eD = r === ROWS - 1 || (Z[k + COLS] < zt && OW[k + COLS] !== own);
      // contact shadow from whatever sits between this cell and the light
      let sh = 1;
      for (let i = 0; i < 2; i++) { const cc = c + so[i][0], rr = r + so[i][1]; if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) { const n = rr * COLS + cc; if (Z[n] > z + 1.1 && OW[n] !== own) sh *= 0.6; } }
      const s = SA[k], ao = M.ao ? 1 - M.ao * 0.72 * (1 - clamp(s / 0.42, 0, 1)) * (1 - clamp(s / 0.42, 0, 1)) : 1;
      let lum = (M.amb + M.dif * d) * ao * sh + M.rim * Math.pow(1 - nz, 2.5) * (0.35 + 0.65 * d) * sh;
      if (M.ao) lum *= (0.7 + 0.3 * s) * (0.9 + 0.1 * Math.sin(WA[k] * 9 + s * 14));
      if (M.vein) lum *= 1 - M.vein * (0.5 + 0.5 * Math.cos(WA[k] * 17));
      if (back) lum *= M.back;
      const edge = eL || eR || eU || eD; if (edge) lum += M.edge;
      if (api.lit) { const lm = api.lit[own >> 8]; if (lm !== undefined) lum *= lm; }
      if (M.fade) lum *= Math.max(0, 1 - M.fade * s); // dims along its length (a trunk rising into the dark) // per-object dimmer: G.lit[objIndex + 1] = 0..1
      let wv = 0;
      for (let i = 0; i < ws.length; i++) { const w = ws[i]; if (w.obj >= 0 && w.obj !== (own >> 8)) continue; const ph = Math.abs(Math.hypot((c - w.c) * A, r - w.r) - w.rad); if (ph < w.w) wv += (1 - ph / w.w) * w.k; }
      lum += wv * 0.45;
      let ci = M.r[lum < 0.2 ? 0 : lum < 0.44 ? 1 : lum < 0.76 ? 2 : 3];
      if (back && M.a >= 0 && lum < 0.6) ci = M.a;
      if (M.mk >= 0 && s < M.mark.s && Math.abs(WA[k]) < M.mark.w * (1 - s / M.mark.s)) { ci = M.mk; lum = Math.max(lum, 0.5); }
      let g;
      if (M.gl) g = M.gl[Math.max(0, Math.min(M.gl.length - 1, (lum * M.gl.length) | 0))]; // its own glyphs, dark to light
      else if (edge) { const hz2 = eU || eD, vt = eL || eR; g = hz2 && !vt ? (lum > 0.45 ? '=' : '-') : vt && !hz2 ? '|' : ((eU && eL) || (eD && eR)) ? '/' : '\\'; }
      else if (M.hatch || nx * nx + ny * ny > M.flat) { // strokes run along the surface's length (its veins)
        let gx = c > 0 && c < COLS - 1 && OW[k - 1] === own && OW[k + 1] === own ? (SA[k + 1] - SA[k - 1]) / (2 * A) : 0, gy = r > 0 && r < ROWS - 1 && OW[k - COLS] === own && OW[k + COLS] === own ? (SA[k - COLS] - SA[k + COLS]) / 2 : 0;
        if (gx === 0 && gy === 0) { gx = -ny; gy = nx; }
        const ax = Math.abs(gx), ay = Math.abs(gy); g = ay > 2.3 * ax ? '|' : ax > 2.3 * ay ? (lum > 0.5 ? '=' : '-') : gx * gy > 0 ? '/' : '\\';
      }
      else g = lum > 0.5 ? '0' : lum > 0.3 ? 'o' : lum > 0.18 ? ':' : '.';
      let al = clamp(0.3 + lum * 0.95, 0, 1);
      if (lum < 0.17 && !edge && h3(c, r, 1) > lum / 0.17) al = 0; // deep shade breaks up into the dark
      GY[k] = g === '0' && h3(c, r, tk) < 0.07 ? DG[(h3(c, r, tk + 9) * 10) | 0] : gi[g];
      CI[k] = ci; AL[k] = al;
      WH[k] = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 40) * M.spec * 0.7 * sh + wv * 0.7 + Math.max(0, lum - 1) * 0.6;
      WM[k] = wm ? M.warm * wm.k * Math.pow(Math.max(0, 1 - Math.hypot((c - S.ox) * A - wm.u, (S.oy - r) - wm.v) / wm.r), 2) : 0;
    }
  }
  function reflect(v, depth, strength, u0, u1) { // u0,u1 optional: only mirror between these screen u
    const COLS = S.COLS, wr = S.oy - Math.round(v), T = S.t, ca = u0 == null ? 0 : Math.max(0, S.ox + Math.round(u0 / A)), cb = u1 == null ? COLS : Math.min(COLS, S.ox + Math.round(u1 / A));
    for (let d = 1; d <= depth; d++) {
      const r = wr + d, sr = wr - d; if (r >= S.ROWS || sr < 0) break;
      const f = strength * (1 - d / (depth + 1)), sx = Math.round(Math.sin(d * 0.9 + T * 1.7) * (0.4 + d * 0.06));
      for (let c = ca; c < cb; c++) {
        const sc = c + sx; if (sc < 0 || sc >= COLS) continue;
        const sk = sr * COLS + sc, k = r * COLS + c; if (Z[sk] < -1e29 || AL[sk] < 0.05 || Z[k] > -1e29) continue;
        if (h3(c, r, Math.floor(T * 3)) > 0.62) continue;
        Z[k] = -5e5; MID[k] = -1; OW[k] = 0; CI[k] = CI[sk]; GY[k] = h3(c, r, 3) < 0.5 ? GY[sk] : gi[d % 2 ? '~' : '-']; AL[k] = AL[sk] * f; WH[k] = WH[sk] * f * 0.6; WM[k] = WM[sk] * f;
      }
    }
  }
  function end() {
    const { W, H, COLS, NB, cellW, cellH } = S;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalAlpha = 1; lctx.clearRect(0, 0, W, H);
    const aw = atlas(WHITE), af = atlas(WARM);
    for (let k = 0; k < NB; k++) {
      if (Z[k] < -1e29) continue;
      const x = (k % COLS) * cellW, y = ((k / COLS) | 0) * cellH, sx = GY[k] * cellW; let a = AL[k];
      if (a > 0.012) { lctx.globalAlpha = a > 1 ? 1 : a; lctx.drawImage(atlas(CI[k]), sx, 0, cellW, cellH, x, y, cellW, cellH); }
      a = WH[k]; if (a > 0.03) { lctx.globalAlpha = a > 1 ? 1 : a; lctx.drawImage(aw, sx, 0, cellW, cellH, x, y, cellW, cellH); }
      a = WM[k]; if (a > 0.02) { lctx.globalAlpha = a > 1 ? 1 : a; lctx.drawImage(af, sx, 0, cellW, cellH, x, y, cellW, cellH); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let src = layer;
    blurs.forEach(b => { const x = b.getContext('2d'); x.clearRect(0, 0, b.width, b.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, b.width, b.height); src = b; });
    ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.62 * api.glow; ctx.drawImage(blurs[2], 0, 0, W, H);
    ctx.globalAlpha = 0.5 * api.glow; ctx.drawImage(blurs[1], 0, 0, W, H);
    ctx.globalAlpha = 0.3 * api.glow; ctx.drawImage(blurs[0], 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${Math.round(Math.max(cellH * 1.25, 11 * S.DPR))}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`; ctx.textBaseline = 'middle';
    return ctx;
  }
  function pick(u, v) {
    const c0 = S.ox + Math.round(u / A), r0 = S.oy - Math.round(v); let best = 0, bd = 9;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -3; dc <= 3; dc++) {
      const c = c0 + dc, r = r0 + dr; if (c < 0 || c >= S.COLS || r < 0 || r >= S.ROWS) continue;
      const ow = OW[r * S.COLS + c]; if (!ow) continue; const d = Math.hypot(dc * A, dr); if (d < bd) { bd = d; best = ow; }
    }
    return best;
  }
  const toUV = e => ({ u: (e.clientX * S.DPR / S.cellW - S.ox) * A, v: S.oy - e.clientY * S.DPR / S.cellH });
  const px = (u, v) => [(S.ox + u / A + 0.5) * S.cellW, (S.oy - v + 0.5) * S.cellH];
  // a wave of light: {u,v,sp,w,life,a,obj}; call G.wave(...) then G.tickWaves() each frame
  function wave(u, v, o) { api.waves.push(Object.assign({ c: S.ox + u / A, r: S.oy - v, u, v, t0: S.t, sp: 34, w: 4, a: 1, life: 2, obj: -1, rad: 0, k: 0 }, o)); }
  function tickWaves(du) {
    for (let i = api.waves.length - 1; i >= 0; i--) {
      const w = api.waves[i], age = S.t - w.t0; if (du) { w.u += du; w.c = S.ox + w.u / A; }
      w.rad = age * w.sp; w.k = w.a * Math.max(0, 1 - age / w.life); if (w.k <= 0) api.waves.splice(i, 1);
    }
  }
  return Object.assign(api, { init, resize, begin, plot, mesh, line, cell, material, shade, reflect, end, pick, toUV, px, wave, tickWaves, clamp, h3 });
})();
