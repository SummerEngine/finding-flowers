'use strict';
// Finding Flowers · thin white frames with plain text (UI), and the notebook (Book):
// one page per flower with its portrait, typed lines and its voice; a last page for what else you met;
// the whole book plays as one piece.
const UI = {
  btns: [], fs: 12,
  // small = the notebook and its pages; otherwise the large type used out in the forest
  begin(ctx, small) { this.btns.length = 0; this.ctx = ctx; const S = G.S; this.fs = small ? Math.round(Math.max(S.cellH * 1.95, 16 * S.DPR)) : Math.round(Math.max(18 * S.DPR, Math.min(S.H / 20, S.W / 21))); ctx.font = `${this.fs}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`; ctx.textBaseline = 'middle'; this.bh = Math.max(this.fs * 2.3, 44 * G.S.DPR); this.lw = Math.max(1, G.S.DPR * 0.75); },
  box(x, y, w, h, al, fill) { const c = this.ctx; if (fill !== 0) { c.fillStyle = `rgba(0,0,0,${(fill == null ? 0.72 : fill) * al})`; c.fillRect(x, y, w, h); } c.strokeStyle = `rgba(255,255,255,${0.6 * al})`; c.lineWidth = this.lw; c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); },
  text(s, x, y, al, align) { const c = this.ctx; c.textAlign = align || 'left'; c.fillStyle = `rgba(255,255,255,${al == null ? 0.85 : al})`; c.fillText(s, x, y); },
  width(s) { return this.ctx.measureText(s).width; },
  wrap(s, maxW) { const out = []; let cur = ''; for (const w of s.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && this.width(t) > maxW) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; },
  // a button: thin frame, plain words. align: 'l' x is left edge, 'r' right edge, 'c' centre. returns its width
  btn(label, x, y, fn, align, al, key) {
    const w = this.width(label) + this.fs * 1.8, h = this.bh, bx = align === 'r' ? x - w : align === 'c' ? x - w / 2 : x; al = al == null ? 1 : al;
    this.box(bx, y, w, h, al); this.text(label, bx + w / 2, y + h / 2 + 1, 0.9 * al, 'center'); this.btns.push({ x: bx, y, w, h, fn, key }); return w;
  },
  hit(px, py) { const pad = 6 * G.S.DPR; for (let i = this.btns.length - 1; i >= 0; i--) { const b = this.btns[i]; if (px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad) return b; } return null; },
  key(k) { const b = this.btns.find(b => b.key === k); if (b) b.fn(); return !!b; } // k arrives lower-cased, so caps lock does not matter
};
const Book = {
  on: false, page: 0, plant: null, t0: 0, writing: false, choice: false, sym: null, typed: 0, cutT: -9, taps: 0,
  get pages() { return SPOTS.length + 1; },
  open(i, write) { if (typeof sleeping !== 'undefined' && sleeping) return; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (x) {} this.on = true; this.choice = false; this.show(i, write); if (M.on && typeof STEPS !== 'undefined') STEPS.page(M.now); },
  show(i, write, quiet) {
    const n = this.pages; this.page = ((i % n) + n) % n; this.writing = !!write; this.t0 = V.T; this.typed = 0;
    const def = SPOTS[this.page], f = def && found[def.sp];
    this.plant = f ? Flora.make(modelOf(def.sp), { id: 0, yaw: 0.15, turn: 0.35, ph: 0, g: write ? 0.02 : 1, tg: 1 }) : null;
    if (f && !write && f.kept == null) this.choice = true;
    if (f && !write && !quiet && M.on) motifPlay(def.sp, M.now, 0.7, 0, 0);
  },
  flip(d) { if (this.writing) return; this.choice = false; this.sym = null; this.show(this.page + d); if (M.on && typeof STEPS !== 'undefined') STEPS.page(M.now); },
  close() { if (this.writing) return; if (this.choice) this.decide('left'); this.on = false; this.sym = null; },
  play() { const def = SPOTS[this.page]; if (def && found[def.sp]) { M.init(); motifPlay(def.sp, M.now, 0.85, 0, 0); G.wave(this.plant.x, this.plant.y + 40 * this.plant.scale, { life: 2.4 }); } },
  hum() { M.init(); motifPlay(SPOTS[this.page].sp, M.now, 0.8, 0, 0); },
  whole() { // every found flower enters two bars after the one before, in page order
    if (this.sym) { this.sym = null; return; }
    M.init(); const order = SPOTS.map((d, i) => i).filter(i => found[SPOTS[i].sp]); if (order.length) this.sym = { order, bar0: -1 };
  },
  decide(k) { const def = SPOTS[this.page]; this.choice = false; keep(def.sp, k);
    if (k === 'cut') { this.cutT = V.T; if (M.on) { M.burst(M.now, 0.16, 0, 2400, 0.05, 0.25); M.burst(M.now + 0.03, 0.08, 0, 700, 0.09, 0.2, 'lowpass'); motifPlay(def.sp, M.now + 0.5, 0.8, 0, 0); } } // snip
    else if (M.on) M.sing('tent', M.pent(7), 0.7, 0); },
  tap(px, py) { // the flower on the page answers a touch the way it does in the forest
    const p = this.plant, S = G.S; if (!p || (S.portrait ? py > S.H * 0.5 : px > S.W * 0.5)) return; M.init();
    const { u, v } = G.toUV({ clientX: px / S.DPR, clientY: py / S.DPR }), def = SPOTS[this.page]; G.wave(u, v, { life: 2.4 }); if (V.T - (p.tk || -9) > 1.4) Flora.kick(p, u > p.x ? -1 : 1, V.T);
    this.taps++; if (this.taps % 4 === 0) motifPlay(def.sp, M.now, 0.8, 0, 0); else voicePlay(def.sp, M.quant(M.now), M.fit(M.pent(regOf(def.sp) + clamp(((v - p.y) / 9) | 0, 0, 9)), M.chAt(M.now)), 0.8, pan(u - p.x)); },
  draw(T, dt) {
    const S = G.S, def = SPOTS[this.page], f = def && found[def.sp], p = this.plant, port = S.portrait;
    G.begin(T); G.tickWaves(); G.warm = null; G.lit = null;
    const top = S.oy, bot = -(S.ROWS - S.oy), px0 = port ? 0 : -S.halfU * 0.5;
    if (p) {
      const availH = port ? S.ROWS * 0.5 - 8 : S.ROWS - 26, availW = port ? S.halfU * 1.8 : S.halfU * 0.9;
      const hw = 2 * Math.max(...p.sp.whorls.map(w => w.L)) + 12, tall = p.sp.H + 0.5 * hw; p.scale = Math.min(1.5, availH / tall, availW / hw);
      p.x = px0; p.y = (port ? top - S.ROWS * 0.5 : bot + 12) + Math.max(0, (availH - tall * p.scale) * 0.4); p.z = 0;
      p.g += (p.tg - p.g) * (1 - Math.exp(-dt * (this.writing ? 0.6 : 3)));
      const ck = T - this.cutT; if (ck < 1.2) { p.y += 7 * Math.sin(Math.min(1, ck / 0.45) * Math.PI) * (ck < 0.45 ? 1 : 0); if (ck < 0.3) for (let i = -9; i <= 9; i++) G.plot(p.x + i * 0.6, p.y - 7 * Math.sin(Math.min(1, ck / 0.45) * Math.PI) + 1, 5, COL.white, i % 3 ? '-' : '=', 1 - ck / 0.3, 0.6); } // the stem is cut: a flash at the base and the flower jumps free
      Flora.draw(p, T);
    } else for (let i = 0; i < 11; i++) G.plot(px0 + Math.sin(i * 2.4 + T * 0.2) * 16, (port ? top - S.ROWS * 0.28 : 34) + Math.cos(i * 1.7 + T * 0.15) * 13, 0, COL.star, i % 3 ? '.' : '+', 0.14 + 0.14 * Math.sin(T + i));
    G.shade(); const ctx = G.end(); UI.begin(ctx, true);
    const fs = UI.fs, m = fs * 1.2, W = S.W, H = S.H, lh = fs * 1.75;
    UI.box(m, m, W - m * 2, H - m * 2, 1, 0);
    const x = port ? m * 2.2 : W * 0.54; let y = port ? H * 0.53 : m * 3.2;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); if (port) { ctx.moveTo(m * 2, y - lh); ctx.lineTo(W - m * 2, y - lh); } else { ctx.moveTo(W * 0.5, m * 2); ctx.lineTo(W * 0.5, H - m * 2); } ctx.stroke();
    UI.text(`her notebook  ·  page ${String(this.page + 1).padStart(2, '0')} of ${this.pages}`, x, y, 0.45); y += lh * 1.5;
    if (!def) { // the last page: everything else you met
      UI.text('ALSO MET', x, y, 0.95); y += lh; UI.text('not flowers. still worth a line.', x, y, 0.5); y += lh * 1.6;
      const ks = Object.keys(met); if (!ks.length) UI.text('nothing yet. i could touch things in passing.', x, y, 0.6);
      ks.forEach(k => { UI.text(`${MEET[k]}`, x, y, 0.82); UI.text(`night ${met[k]}`, x + fs * 17, y, 0.4); y += lh; });
      y += lh * 0.6; { const n = stars.filter(s => s.mine).length; UI.text(`${n} ${n === 1 ? 'star' : 'stars'} put in the sky`, x, y, 0.5); }
    } else if (f) {
      const pg = pageOf(def.sp), cps = 24, t = T - this.t0 - 1.6, head = pg.latin.toUpperCase(), chars = this.writing ? Math.max(0, t * cps) : 1e9;
      // the first time, the name and the lines type themselves; afterwards they are simply there
      let used = 0; const type = (s, al) => { const show = Math.max(0, Math.min(s.length, Math.floor(chars - used))); if (show > 0) UI.text(s.slice(0, show) + (this.writing && show < s.length ? '_' : ''), x, y, al); used += s.length; };
      type(head, 0.95); y += lh; type(pg.common, 0.55); y += lh * 1.6;
      for (const ln of pg.lines) { type(ln, 0.82); y += lh; }
      if (this.writing) { const now = Math.min(used, Math.floor(chars)); if (now > this.typed && now % 2 === 0 && M.on) M.burst(M.now, 0.012, 0.2, 2600 + (now % 5) * 300, 0.012, 0.05); this.typed = now; if (chars > used + cps * 0.8 && p.g > 0.96) { this.writing = false; this.choice = f.kept == null; } }
      else {
        y += lh * 0.6; UI.text(`noted on night ${f.night}, ${f.place}`, x, y, 0.4); y += lh;
        if (f.kept) { UI.text(f.kept === 'cut' ? 'cut, and kept in the book' : 'left growing where it was', x, y, 0.4); y += lh; }
        y += lh * 0.4; const row = Array(32).fill('·'); motifOf(def.sp).forEach(n => { row[n.s % 32] = 'o'; }); UI.text(row.slice(0, 16).join('') + ' ' + row.slice(16).join(''), x, y, 0.55);
      }
    } else {
      const pg = pageOf(def.sp); UI.text('· · · ·', x, y, 0.7); y += lh * 1.6; UI.text('an empty page', x, y, 0.5); y += lh * 1.4;
      if (def.night > night) { UI.text('it is not open yet. another night.', x, y, 0.72); y += lh; } else for (const h of pg.hint) { UI.text(h, x, y, 0.72); y += lh; } y += lh * 0.6;
      if (def.cond === 'listen' && def.night <= night) { UI.text('it sounds like this:', x, y, 0.5); UI.btn('hum', x, y + lh * 0.6, () => this.hum()); }
    }
    // buttons along the bottom
    const by = H - m * 2 - UI.bh, gap = fs * 0.7; let bx = x;
    if (this.choice) { UI.text('what do i do with it?', bx, by - lh * 0.8, 0.6); bx += UI.btn(ptr.mouse ? 'cut it for the book  [1]' : 'cut it for the book', bx, by, () => this.decide('cut'), 'l', 1, '1') + gap; UI.btn(ptr.mouse ? 'leave it growing  [2]' : 'leave it growing', bx, by, () => this.decide('left'), 'l', 1, '2'); }
    else if (!this.writing) {
      bx += UI.btn('< page', bx, by, () => this.flip(-1), 'l', 1, 'ArrowLeft') + gap; bx += UI.btn('page >', bx, by, () => this.flip(1), 'l', 1, 'ArrowRight') + gap;
      if (f) bx += UI.btn('play', bx, by, () => this.play(), 'l', 1, ' ') + gap;
      if (count() > 1) UI.btn(this.sym ? 'stop' : 'whole book', bx, by, () => this.whole());
      UI.btn('close', W - m * 2.2, port ? m * 2.2 : by, () => this.close(), 'r', 1, 'Escape');
    }
  }
};
M.onStep((step, bar, s, ch, t) => {
  const y = Book.sym; if (!y || !Book.on) return; if (s !== 0 || bar % 2) return;
  if (y.bar0 < 0) y.bar0 = bar; const k = (bar - y.bar0) / 2, n = y.order.length;
  if (k > n + 2) { M.CHT[0].forEach((m, i) => M.play('tent', t + i * M.STEP * 2, m + 12, 0.6, (i - 1.5) * 0.4)); Book.sym = null; return; }
  for (let j = 0; j <= Math.min(k, n - 1); j++) motifPlay(SPOTS[y.order[j]].sp, t, j === k ? 0.8 : 0.42, ((j % 5) - 2) * 0.35, 0, true);
  if (k < n) M.vis(t, () => { if (Book.on && Book.sym) Book.show(y.order[k], false, true); });
});
