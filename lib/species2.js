'use strict';
// More species for Flora. Each entry has the same shape as the ones in flora.js (see `SP` there).
// Add with Object.assign(Flora.SPECIES, { key: {...} }). Materials are created on first use.
// Optional fields used here (all default to the old behaviour in flora.js):
//   whorl: fuse (one fused corolla with n rim lobes), lobe, tw, pl, kn [a,b] (bend between a and b of the length)
//   head:  tilt0 (tilt while in bud), dir (compass direction of the tilt), fix (no automatic yaw per head)
//   leaf:  pet/pe/sag (leaf stalk), wp, tip, cup, ruf, rf, bow, claw, r0, fuse, lobe, ns, nw
//   disc:  h, y, nw      species: nstep (part numbers per head, default 40)
(() => {
  const HALF = Math.PI / 2;
  // foxglove: bells hang on one side of the spike, largest and first to open at the bottom
  const FOX = 15, foxHeads = [];
  for (let i = 0; i < FOX; i++) {
    const q = i / (FOX - 1), az = HALF + 0.55 + [-0.8, 0.1, 0.9, -0.35, 0.5][i % 5];
    foxHeads.push({ br: { k: 0.4 + 0.57 * Math.pow(q, 0.9), len: 4.5 - 2.5 * q, ang: 1.25, az }, scale: 1 - 0.62 * q, tilt0: 1.75, tilt: 2.15 - 0.35 * q, dir: HALF - az, fix: 1, yaw: 0.31,
      start: 0.3 + 0.36 * q, end: 0.56 + 0.44 * q, max: q < 0.6 ? 1 : q < 0.7 ? 0.5 : q < 0.8 ? 0.15 : 0 });
  }
  foxHeads.push({ scale: 0.3, tilt: 0.2, start: 0.66, end: 1, max: 0 });

  Object.assign(Flora.SPECIES, {
    tulip: { name: 'TULIPA', H: 54, lean: 3, stemW: 1.9, reg: 6, pat: [0, -1, -1, -1, 3, -1, -1, 2, -1, -1, -1, 4, -1, -1, 1, -1],
      mats: { a: { ramp: ['#4a0812', '#c81e3a', '#ff5a5a', '#ffd9c8'], alt: '#d0283c', vein: 0.12, back: 0.95, ao: 0.3 }, b: { ramp: ['#5a0a14', '#dc2a40', '#ff7468', '#ffe6d8'], alt: '#e0343f', vein: 0.12, back: 0.95, ao: 0.3 } },
      whorls: [
        { n: 3, L: 25, W: 11.5, wp: 0.8, tip: 0.62, c0: 1.05, c1: 1.9, o0: 0.8, o1: 1.52, bow: 0.75, cup: 0.6, ruf: 0.03, rf: 6, az: 0, dl: 0, m: 'a', ns: 16, nw: 8 },
        { n: 3, L: 24, W: 11, wp: 0.8, tip: 0.62, c0: 1.1, c1: 1.92, o0: 0.9, o1: 1.6, bow: 0.75, cup: 0.6, ruf: 0.03, rf: 6, az: 1.047, dl: 0.15, m: 'b', r0: 0.9, ns: 16, nw: 8 }],
      stam: { n: 6, len: 8, spread: 0.25, col: '#3a2030', tip: '#ffd24a' },
      leaves: [{ k: 0.02, az: 0.5, L: 40, W: 7.5, e0: 1.25, e1: 0.75, wp: 0.6, tip: 0.8, cup: 0.6, ns: 16, nw: 6 }, { k: 0.05, az: 3.5, L: 35, W: 7, e0: 1.2, e1: 0.6, wp: 0.6, tip: 0.8, cup: 0.6, ns: 16, nw: 6 }, { k: 0.16, az: 2.0, L: 26, W: 5, e0: 1.3, e1: 0.9, wp: 0.6, tip: 0.8, cup: 0.6, ns: 14, nw: 6 }],
      heads: [{ scale: 1, tilt: 0.22, tilt0: 0.1, start: 0.3, end: 0.9 }] },

    poppy: { name: 'PAPAVER', H: 60, lean: -6, stemW: 1.0, reg: 7, pat: [-1, 3, -1, -1, -1, -1, 0, -1, -1, 5, -1, -1, 2, -1, -1, -1],
      mats: { a: { ramp: ['#571400', '#e8440c', '#ff8038', '#ffe0c4'], alt: '#c23a0a', vein: 0.22, mark: { col: '#2a1030', s: 0.3, w: 0.85 } }, b: { ramp: ['#6a1c00', '#f2560f', '#ff9a4c', '#ffecd4'], alt: '#d04410', vein: 0.22, mark: { col: '#2a1030', s: 0.3, w: 0.85 } }, d: { ramp: ['#16301c', '#3f7a44', '#9bd08a', '#e9ffd8'], ao: 0, rim: 0.4 } },
      whorls: [
        { n: 2, L: 17, W: 14.5, wp: 1.0, tip: 0.42, claw: 0.22, c0: 1.0, c1: 2.3, o0: 0.85, o1: 0.38, bow: 1.2, cup: 0.14, ruf: 0.09, rf: 15, az: 0.3, dl: 0, m: 'a', ns: 16, nw: 10 },
        { n: 2, L: 15.5, W: 13, wp: 1.0, tip: 0.42, claw: 0.22, c0: 1.05, c1: 2.3, o0: 1.05, o1: 0.62, bow: 1.2, cup: 0.16, ruf: 0.09, rf: 16, az: 1.87, dl: 0.2, m: 'b', ns: 16, nw: 10 }],
      disc: { r: 3.1, m: 'd', h: 1.1, y: 0.6 }, stam: { n: 30, len: 3.8, spread: 1.0, dl: 0.55, col: '#6a5a8c', tip: '#f2e2a0' },
      leaves: [{ k: 0.06, az: 0.4, L: 17, W: 5, ruf: 0.6, rf: 17, e0: 0.9, e1: 0.1 }, { k: 0.1, az: 2.6, L: 18, W: 5, ruf: 0.6, rf: 17, e0: 0.9, e1: 0.1 }, { k: 0.15, az: 4.6, L: 15, W: 4.5, ruf: 0.6, rf: 17, e0: 0.9, e1: 0.1 }, { k: 0.3, az: 1.5, L: 11, W: 3.5, ruf: 0.6, rf: 17 }],
      heads: [{ scale: 1, tilt0: 2.4, tilt: 1.15, start: 0.3, end: 0.85 }, { br: { k: 0.3, len: 26, ang: 0.5, az: 3.3 }, scale: 0.6, tilt0: 2.6, tilt: 2.4, dir: -1.2, start: 0.55, end: 1, max: 0.04 }] },

    dahlia: { name: 'DAHLIA', H: 60, lean: 2, stemW: 1.9, reg: 5, pat: [1, -1, 3, -1, -1, 0, -1, -1, 4, -1, 2, -1, -1, -1, 3, -1], nstep: 70,
      mats: { a: { ramp: ['#2c0a44', '#8a2cc4', '#c680ff', '#f4e2ff'], alt: '#6a1c9c', back: 0.8, ao: 0.8 }, b: { ramp: ['#3a0f58', '#a040dc', '#d99cff', '#fbf0ff'], alt: '#7a24b0', back: 0.8, ao: 0.8 } },
      whorls: [
        { n: 12, L: 14.5, W: 3.9, wp: 1.5, tip: 0.55, c0: 0.85, c1: 2.4, o0: -0.8, o1: -0.8, cup: 0.75, az: 0, dl: 0, m: 'a', ns: 6, nw: 3, r0: 0.6 },
        { n: 12, L: 14.5, W: 3.9, wp: 1.5, tip: 0.55, c0: 0.9, c1: 2.4, o0: -0.36, o1: -0.36, cup: 0.75, az: 0.26, dl: 0.1, m: 'b', ns: 6, nw: 3, r0: 0.6 },
        { n: 11, L: 14.5, W: 3.9, wp: 1.5, tip: 0.55, c0: 1.0, c1: 2.4, o0: 0.08, o1: 0.08, cup: 0.75, az: 0.05, dl: 0.22, m: 'a', ns: 6, nw: 3, r0: 0.6 },
        { n: 9, L: 14, W: 3.9, wp: 1.5, tip: 0.55, c0: 1.1, c1: 2.4, o0: 0.52, o1: 0.52, cup: 0.75, az: 0.3, dl: 0.34, m: 'b', ns: 6, nw: 3, r0: 0.6 },
        { n: 7, L: 13.5, W: 3.8, wp: 1.5, tip: 0.55, c0: 1.2, c1: 2.4, o0: 0.95, o1: 0.95, cup: 0.75, az: 0.1, dl: 0.46, m: 'a', ns: 6, nw: 3, r0: 0.6 },
        { n: 5, L: 12.5, W: 3.6, wp: 1.5, tip: 0.55, c0: 1.3, c1: 2.4, o0: 1.32, o1: 1.4, cup: 0.8, az: 0.4, dl: 0.6, m: 'b', ns: 6, nw: 3, r0: 0.6 }],
      leaves: [{ k: 0.2, az: 0.3, L: 20, W: 7, tip: 0.85, ruf: 0.2, rf: 12 }, { k: 0.2, az: 3.4, L: 20, W: 7, tip: 0.85, ruf: 0.2, rf: 12 }, { k: 0.44, az: 1.8, L: 16, W: 6, tip: 0.85, ruf: 0.2, rf: 12 }, { k: 0.44, az: 4.9, L: 16, W: 6, tip: 0.85, ruf: 0.2, rf: 12 }],
      heads: [{ scale: 1, tilt: 0.75, start: 0.3, end: 0.88 }] },

    lotus: { name: 'NELUMBO', H: 74, lean: -3, stemW: 1.6, reg: 9, pat: [-1, -1, 0, -1, -1, -1, 4, -1, -1, -1, -1, 2, -1, -1, -1, 5],
      mats: { a: { ramp: ['#6a1f58', '#ea6cb4', '#ffbcdc', '#ffffff'], alt: '#d058a0', vein: 0.14, back: 0.85 }, b: { ramp: ['#70306a', '#f090c8', '#ffd6ea', '#ffffff'], alt: '#e078b8', vein: 0.14, back: 0.85 }, d: { ramp: ['#4a4a08', '#a8a81e', '#e8e45a', '#ffffc8'], ao: 0, rim: 0.3 } },
      whorls: [
        { n: 6, L: 21, W: 7, wp: 0.9, tip: 0.85, c0: 1.0, c1: 2.0, o0: 0.45, o1: 0.1, bow: 1.3, cup: 0.5, az: 0, dl: 0, m: 'a', ns: 14, nw: 6 },
        { n: 6, L: 19, W: 6.8, wp: 0.9, tip: 0.85, c0: 1.1, c1: 2.0, o0: 0.9, o1: 0.65, bow: 1.2, cup: 0.55, az: 0.52, dl: 0.2, m: 'b', ns: 14, nw: 6 },
        { n: 5, L: 16, W: 6, wp: 0.9, tip: 0.85, c0: 1.4, c1: 2.0, o0: 1.1, o1: 0.95, bow: 1.2, cup: 0.6, az: 0.2, dl: 0.42, m: 'b', ns: 12, nw: 6 }],
      disc: { r: 4.4, m: 'd', h: 0.4, y: 3.2, nw: 12 }, stam: { n: 34, len: 5, spread: 0.75, dl: 0.55, col: '#e8c84a', tip: '#fff6c0' },
      leaves: [{ k: 0, az: 0.15, pet: 30, pe: 1.05, sag: 0.1, fuse: 1, lobe: 0, L: 19, W: 1, e0: 0.25, e1: 0.5, ruf: 0.05, rf: 7, r0: 0.4, ns: 8, nw: 20 }, { k: 0, az: 3.0, pet: 20, pe: 0.85, sag: 0.1, fuse: 1, lobe: 0, L: 15, W: 1, e0: 0.25, e1: 0.5, ruf: 0.05, rf: 7, r0: 0.4, ns: 8, nw: 20 }],
      heads: [{ scale: 1, tilt: 1.05, start: 0.3, end: 0.9 }] },

    sunflower: { name: 'HELIANTHUS', H: 84, lean: 4, stemW: 2.5, reg: 4, pat: [0, -1, -1, 2, -1, -1, 0, -1, 3, -1, -1, 2, -1, -1, 4, -1],
      mats: { a: { ramp: ['#5a3200', '#e89a00', '#ffcf2e', '#fff6c2'], alt: '#c88400', vein: 0.1, ao: 0.5 }, b: { ramp: ['#6a3c00', '#f0aa0a', '#ffdc50', '#fffbd8'], alt: '#d89400', vein: 0.1, ao: 0.5 }, d: { ramp: ['#2a1405', '#57300c', '#8a531a', '#c8923c'], ao: 0, rim: 0.25, spec: 0.1, dif: 0.5 } },
      whorls: [
        { n: 19, L: 16, W: 2.9, wp: 0.85, tip: 0.8, r0: 7.6, c0: 1.2, c1: 2.5, o0: 0.12, o1: -0.12, cup: 0.3, az: 0, dl: 0, m: 'a', ns: 7, nw: 2 },
        { n: 19, L: 14, W: 2.7, wp: 0.85, tip: 0.8, r0: 7.4, c0: 1.25, c1: 2.6, o0: 0.4, o1: 0.15, cup: 0.3, az: 0.165, dl: 0.25, m: 'b', ns: 7, nw: 2 }],
      disc: { r: 9.2, m: 'd', h: 0.28, y: 0.6, nw: 18 },
      leaves: [{ k: 0.22, az: 0.8, pet: 5, pe: 0.5, L: 24, W: 11, wp: 0.42, tip: 0.95, e0: 0.3, e1: -0.9, cup: 0.25, ns: 12, nw: 6 }, { k: 0.38, az: 2.5, pet: 5, pe: 0.5, L: 22, W: 10, wp: 0.42, tip: 0.95, e0: 0.3, e1: -0.9, cup: 0.25, ns: 12, nw: 6 }, { k: 0.54, az: 4.3, pet: 4, pe: 0.5, L: 19, W: 9, wp: 0.42, tip: 0.95, e0: 0.3, e1: -0.9, cup: 0.25, ns: 12, nw: 6 }, { k: 0.7, az: 1.5, pet: 4, pe: 0.5, L: 16, W: 7.5, wp: 0.42, tip: 0.95, e0: 0.3, e1: -0.9, cup: 0.25, ns: 12, nw: 6 }],
      heads: [{ scale: 1, tilt0: 0.5, tilt: 1.42, start: 0.3, end: 0.9 }] },

    snowdrop: { name: 'GALANTHUS', H: 38, lean: 3, stemW: 1.0, reg: 11, pat: [-1, -1, -1, 4, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 5, -1],
      mats: { a: { ramp: ['#33405e', '#a9b8dc', '#eef3ff', '#ffffff'], alt: '#c4d0ee', back: 0.92, ao: 0.4 }, b: { ramp: ['#17541f', '#3fae4a', '#a6f0a8', '#ffffff'], alt: '#3fae4a', back: 0.9, ao: 0 }, d: { ramp: ['#1c4a22', '#3f9a4a', '#8fe08f', '#e3ffe0'], ao: 0 } },
      whorls: [
        { n: 3, L: 16, W: 3.9, wp: 0.95, tip: 0.6, claw: 0.3, c0: 1.3, c1: 1.85, o0: 0.8, o1: 1.4, bow: 1.3, cup: 0.9, az: 0.5, dl: 0, m: 'a', ns: 12, nw: 6 },
        { n: 3, L: 7.5, W: 3.8, wp: 1.1, tip: 0.3, c0: 1.4, c1: 1.6, o0: 1.3, o1: 1.5, cup: 0.7, az: 1.547, dl: 0.3, m: 'b', ns: 6, nw: 4 }],
      disc: { r: 1.7, m: 'd', h: 1.6, y: -3.2 },
      leaves: [{ k: 0, az: 0.2, L: 27, W: 1.9, e0: 1.42, e1: 1.05, cup: 0.5 }, { k: 0, az: 3.2, L: 24, W: 1.9, e0: 1.4, e1: 0.95, cup: 0.5 }, { k: 0.97, az: 1.2, L: 7, W: 1.1, e0: 1.5, e1: 1.2 }],
      heads: [{ br: { k: 1, len: 7, ang: 1.75, az: 0.9 }, scale: 1, tilt0: 2.5, tilt: 2.75, dir: HALF - 0.9, start: 0.3, end: 0.9 }] },

    foxglove: { name: 'DIGITALIS', H: 86, lean: -3, stemW: 1.8, reg: 3, pat: [0, -1, 2, -1, 4, -1, -1, 3, -1, -1, 1, -1, 5, -1, -1, -1], nstep: 3,
      mats: { a: { ramp: ['#4a0a3c', '#b8308e', '#f07cc8', '#ffe4f6'], alt: '#a02a80', vein: 0.2, back: 0.9, mark: { col: '#fff2fb', s: 0.95, w: 0.3 } } },
      whorls: [{ fuse: 1, n: 5, lobe: 0.14, L: 15, W: 1, r0: 1.3, c0: 1.4, c1: 1.75, o0: 1.42, o1: 0.85, bow: 3, cup: 0, az: 0, dl: 0, m: 'a', ns: 12, nw: 20 }],
      leaves: [{ k: 0.03, az: 0.4, L: 25, W: 8, e0: 0.7, e1: -0.1, tip: 0.85 }, { k: 0.06, az: 2.5, L: 26, W: 8, e0: 0.7, e1: -0.1, tip: 0.85 }, { k: 0.09, az: 4.5, L: 23, W: 7.5, e0: 0.75, e1: 0, tip: 0.85 }, { k: 0.17, az: 1.4, L: 18, W: 6, e0: 0.9, e1: 0.2, tip: 0.85 }, { k: 0.27, az: 3.6, L: 13, W: 4.5, e0: 1.0, e1: 0.3, tip: 0.85 }],
      heads: foxHeads },

    moonflower: { name: 'IPOMOEA', H: 56, lean: 9, stemW: 1.3, reg: 12, pat: [-1, -1, -1, -1, 0, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, 2],
      mats: { a: { ramp: ['#2f3f6e', '#a9bcf0', '#eaf0ff', '#ffffff'], alt: '#b4c4f0', vein: 0.2, back: 0.9, ao: 1, dif: 0.56, spec: 0.3, mode: 'hatch', mark: { col: '#bfeeb0', s: 1.6, w: 0.34 } } },
      whorls: [{ fuse: 1, n: 5, lobe: 0.035, tw: 3.2, pl: 0.05, L: 22, W: 1, r0: 1.0, kn: [0.22, 0.5], c0: 1.25, c1: 1.9, o0: 1.5, o1: 0.16, cup: 0, ruf: 0, rf: 10, az: 0.3142, dl: 0, m: 'a', ns: 18, nw: 20 }],
      stam: { n: 5, len: 6, spread: 0.1, col: '#f4f8ff', tip: '#fff2b0' },
      leaves: [{ k: 0.2, az: 2.4, pet: 8, pe: 0.5, L: 17, W: 9.5, wp: 0.42, tip: 0.95, e0: 0.2, e1: -0.9, cup: 0.3, ns: 12, nw: 6 }, { k: 0.42, az: 0.8, pet: 8, pe: 0.5, L: 16, W: 9, wp: 0.42, tip: 0.95, e0: 0.2, e1: -0.9, cup: 0.3, ns: 12, nw: 6 }, { k: 0.66, az: 3.9, pet: 6, pe: 0.5, L: 13, W: 7.5, wp: 0.42, tip: 0.95, e0: 0.2, e1: -0.9, cup: 0.3, ns: 12, nw: 6 }],
      heads: [{ scale: 1, tilt0: 0.25, tilt: 1.05, fix: 1, start: 0.3, end: 0.92 }, { br: { k: 0.6, len: 15, ang: 0.8, az: 0.4 }, scale: 0.7, tilt: 0.3, start: 0.55, end: 1, max: 0 }] }
  });
})();
