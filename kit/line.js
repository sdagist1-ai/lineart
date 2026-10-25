/* ── line kit ─────────────────────────────────────────────────────────────────
   Pen and ink on white paper with the odd spot of colour. A line is a filled
   outline that swells and tapers like a nib; its wobble, pressure and the way a
   closed shape misses itself come from its key, so a line draws the same every
   time unless it boils. A boiling line re-keys BOIL times a second: the shimmer
   of animation drawn on paper. Nothing reads a clock or Math.random, so seek(t)
   stays exact.

   Coordinates are frame pixels, W x H; points are [x, y]. Every drawing call
   takes the context first and options with a `key` last. Reuse a key and the
   line repeats exactly; pass `t` too and it boils.

   Top-level names: PAPER, INK, SPOT, BOIL, TAU, mulberry32, hash, rngFor,
   clamp, lerp, smooth, local, ease, onTwos, boilKey, h01, noise1, cv, bakePaper,
   ellipse, curve, bez, resample, xf, ink, outline, tint, spans, unrotate,
   hatch, scribble, speed, burst, puff.
   ───────────────────────────────────────────────────────────────────────── */

const PAPER = '#FFFDF8', INK = '#1C1A19';
/** Spot colours. One or two per scene; colour goes where the eye should. */
const SPOT = {
  yellow: '#FFD23F', orange: '#FF8A3D', red: '#E8504A', pink: '#FF9EB5', blue: '#4DA3E0',
  sky: '#C4E4F7', green: '#7CC05A', teal: '#3FB8A9', violet: '#9C84D6', sand: '#F2D7A0',
};
let BOIL = 8;                            // re-keys per second; 0 holds every line still
const TAU = Math.PI * 2;

/* ── deterministic randomness and timing ──────────────────────────────────── */

function mulberry32(a) {
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rngFor = (key) => mulberry32(hash(key));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
/** 0..1 across [a, b], clamped: a beat's own clock. */
const local = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = {
  in: (u) => u * u * u,
  out: (u) => 1 - (1 - u) ** 3,
  inOut: (u) => u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2,
  /** Past the target and back: cartoon arrivals. s ~1.7 is a firm overshoot. */
  back: (u, s = 1.70158) => 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2,
};
/** Hold time on a step, as drawn animation does: 12 is "on twos" at 24, 8 is loose. */
const onTwos = (t, rate = 12) => Math.floor(t * rate + 1e-6) / rate;
const boilKey = (key, t, rate) => (t === undefined || !rate) ? key : key + '~' + Math.floor(t * rate + 1e-6);

/** Smooth 1D value noise in -1..1, seeded by an integer. */
function h01(seed, i) {
  let h = Math.imul(seed ^ Math.imul(i, 0x27D4EB2D), 0x165667B1);
  h ^= h >>> 15; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function noise1(seed, x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (h01(seed, i) * (1 - u) + h01(seed, i + 1) * u) * 2 - 1;
}

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ── paper ────────────────────────────────────────────────────────────────────
   Warm white with a faint tooth, baked once. Kept quiet: video compression
   smears fine texture, and the line is the subject.                         */

function bakePaper() {
  const c = cv(W, H), x = c.getContext('2d'), r = rngFor('paper');
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  for (const [res, a] of [[24, .035], [70, .025]]) {
    const n = cv(res, Math.round(res * H / W)), nx = n.getContext('2d'), img = nx.createImageData(n.width, n.height);
    for (let i = 0; i < n.width * n.height; i++) {
      img.data[i * 4] = 0xC8; img.data[i * 4 + 1] = 0xBC; img.data[i * 4 + 2] = 0xA6;
      img.data[i * 4 + 3] = Math.pow(r(), 2) * 255 * a;
    }
    nx.putImageData(img, 0, 0);
    x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(n, 0, 0, W, H); x.restore();
  }
  for (let i = 0; i < 1600; i++) {
    x.globalAlpha = .02 + r() * .04; x.fillStyle = '#8f8676';
    x.beginPath(); x.arc(r() * W, r() * H, .4 + r() * .8, 0, TAU); x.fill();
  }
  x.globalAlpha = 1;
  return c;
}

/* ── shapes ───────────────────────────────────────────────────────────────── */

/** Points round an ellipse; o.rot turns it, o.a0..o.a1 draw an arc. Clockwise on screen. */
function ellipse(cx, cy, rx, ry, o = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, rot = o.rot || 0;
  const n = o.n || Math.max(12, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 6));
  const c = Math.cos(rot), s = Math.sin(rot), pts = [];
  const closed = Math.abs(a1 - a0) >= TAU - 1e-9;
  for (let i = 0; i < (closed ? n : n + 1); i++) {
    const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

/** A smooth curve through points (centripetal Catmull-Rom). o.closed loops it. */
function curve(points, o = {}) {
  const closed = !!o.closed, P = points, n = P.length, out = [], per = o.per || 10;
  if (n < 3) return P.map(p => p.slice());
  const at = (i) => closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const d = (a, b) => Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), .5), 1e-4);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / per));
    for (let k = 0; k < steps; k++) {
      const t = t1 + (t2 - t1) * k / steps, pt = [];
      for (let j = 0; j < 2; j++) {
        const A1 = (t1 - t) / (t1 - t0) * p0[j] + (t - t0) / (t1 - t0) * p1[j];
        const A2 = (t2 - t) / (t2 - t1) * p1[j] + (t - t1) / (t2 - t1) * p2[j];
        const A3 = (t3 - t) / (t3 - t2) * p2[j] + (t - t2) / (t3 - t2) * p3[j];
        const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        pt.push((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2);
      }
      out.push(pt);
    }
  }
  if (!closed) out.push(P[n - 1].slice());
  return out;
}

/** Cubic Bezier sampled at n+1 points. */
function bez(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    out.push([0, 1].map(j => v * v * v * p0[j] + 3 * v * v * u * p1[j] + 3 * v * u * u * p2[j] + u * u * u * p3[j]));
  }
  return out;
}

/** Points every `step` px along a polyline (closed adds the wrap). Returns {pts, s, length}. */
function resample(pts, step = 2, closed = false) {
  const P = closed ? [...pts, pts[0]] : pts, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const length = cum.at(-1), n = Math.max(1, Math.ceil(length / step)), out = [], s = [];
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const d = length * i / n;
    while (j < P.length - 1 && cum[j] < d) j++;
    const span = cum[j] - cum[j - 1] || 1, u = clamp((d - cum[j - 1]) / span, 0, 1);
    out.push([lerp(P[j - 1][0], P[j][0], u), lerp(P[j - 1][1], P[j][1], u)]); s.push(d);
  }
  if (closed) { out.pop(); s.pop(); }
  return { pts: out, s, length };
}

/** Move, turn and scale points about the origin: rigs build parts at 0,0 and place them. */
function xf(pts, x = 0, y = 0, rot = 0, sx = 1, sy = sx) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([px, py]) => [x + px * sx * c - py * sy * s, y + px * sx * s + py * sy * c]);
}

/* ── the pen ──────────────────────────────────────────────────────────────── */

/**
 * A pen line along pts.
 *   key      stable seed (required; reuse it and the line repeats)
 *   t        with BOIL (or o.boil per second), re-keys on that step
 *   w        nib width in px (4); silhouettes 4–6, interior 2–3, never under ~2 at 1080
 *   taper    [start, end] px over which the line thins to a fifth (w*3 each)
 *   press    0..1 slow swell and thinning along the line (.38)
 *   wobble   px of hand drift off the path (1.6); 0 for a ruled line
 *   closed   the line returns to its start, beginning somewhere along it
 *   join     px a closed line runs past its start (+) or stops short of it (-)
 *   over     px an open line overshoots both ends (0)
 *   skip     0..1 chance per 80 px of a dry break in the line (0)
 *   color, alpha
 */
function ink(g, pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const key = boilKey(o.key || 'ink', o.t, o.boil ?? BOIL), r = rngFor(key);
  const seedW = hash(key + ':w'), seedP = hash(key + ':p'), w = o.w ?? 4, wob = o.wobble ?? 1.6;
  let line;
  if (o.closed) {
    const loop = resample(pts, 2, true), L = loop.length, s0 = r() * L;
    const join = o.join ?? (r() < .6 ? 4 + r() * 10 : -(3 + r() * 7));
    const span = L + join, n = Math.max(2, Math.ceil(span / 2)), P = [];
    for (let i = 0; i <= n; i++) {
      const d = ((s0 + span * i / n) % L + L) % L, k = d / L * loop.pts.length;
      const a = loop.pts[Math.floor(k) % loop.pts.length], b = loop.pts[(Math.floor(k) + 1) % loop.pts.length], u = k - Math.floor(k);
      P.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
    }
    line = resample(P, 2);
  } else {
    let P = pts;
    if (o.over) {
      const ext = (a, b, d) => { const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / l * d, a[1] + (a[1] - b[1]) / l * d]; };
      P = [ext(pts[0], pts[1], o.over * (.5 + r())), ...pts, ext(pts.at(-1), pts.at(-2), o.over * (.5 + r()))];
    }
    line = resample(P, 2);
  }
  const { pts: C, s, length: L } = line;
  if (L < 1.5) { g.save(); g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.color || INK; g.beginPath(); g.arc(C[0][0], C[0][1], w / 2, 0, TAU); g.fill(); g.restore(); return; }
  const tp = o.taper || [w * 3, w * 3], press = o.press ?? .38;
  const ramp = (u) => .2 + .8 * smooth(u);
  // Each run between dry breaks is its own outline, with a lift at each end.
  const runs = [[0, C.length - 1]];
  if (o.skip) {
    runs.length = 0;
    let start = 0;
    for (let i = 1; i < C.length - 1; i++) {
      if (s[i] - s[start] > 40 && r() < o.skip * 2 / 80) { const gap = Math.ceil((3 + r() * 6) / 2); runs.push([start, i]); start = Math.min(C.length - 1, i + gap); i = start; }
    }
    runs.push([start, C.length - 1]);
  }
  const off = [], half = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    const d = wob * (noise1(seedW, s[i] / 90) + .55 * noise1(seedW + 7, s[i] / 23));
    off.push([C[i][0] + nx * d, C[i][1] + ny * d, nx, ny]);
    half.push(w / 2 * Math.max(.15, 1 + press * noise1(seedP, s[i] / 140)));
  }
  g.save();
  g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.color || INK;
  const path = new Path2D();
  for (const [i0, i1] of runs) {
    if (i1 - i0 < 1) continue;
    const sA = s[i0], sB = s[i1], left = [], right = [];
    for (let i = i0; i <= i1; i++) {
      const tw = Math.min(ramp((s[i] - sA) / Math.max(tp[0], 1)), ramp((sB - s[i]) / Math.max(tp[1], 1)));
      const hw = Math.max(.3, half[i] * tw), [x, y, nx, ny] = off[i];
      left.push([x + nx * hw, y + ny * hw]); right.push([x - nx * hw, y - ny * hw]);
    }
    const poly = [...left, ...right.reverse()];
    path.moveTo(poly[0][0], poly[0][1]);
    for (const p of poly) path.lineTo(p[0], p[1]);
    path.closePath();
    // Round nib ends, wound the same way as the outline so nonzero fill never cancels the overlap.
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    for (const i of [i0, i1]) {
      const hw = Math.max(.3, half[i] * ramp(0));
      path.moveTo(off[i][0] + hw, off[i][1]); path.arc(off[i][0], off[i][1], hw, 0, TAU, area < 0);
    }
  }
  g.fill(path, 'nonzero');
  g.restore();
}

/** ink() closed round a shape. */
const outline = (g, pts, o = {}) => ink(g, pts, { ...o, closed: true });

/**
 * Marker colour inside a closed shape, laid before the ink and missing it a little.
 *   key, t     as ink()
 *   miss       px the colour lands off the line, in a direction from the key (3)
 *   grow       px the edge sits outside (+) or inside (-) the shape (-1.5)
 *   wobble     px of edge drift (2)
 *   alpha      (.92)
 *   marker     overlapping felt-tip bands at o.ang (true); false for a flat fill
 *   band       band width px (34)
 */
function tint(g, pts, color, o = {}) {
  const key = boilKey((o.key || 'tint') + ':fill', o.t, o.boil ?? BOIL), r = rngFor(key);
  const seed = hash(key), miss = o.miss ?? 3, ang = r() * TAU, dx = Math.cos(ang) * miss, dy = Math.sin(ang) * miss;
  const { pts: C, s } = resample(pts, 5, true), grow = o.grow ?? -1.5, wob = o.wobble ?? 2;
  // Edge normals point out of the shape whichever way it winds.
  let area = 0; for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sign = area > 0 ? -1 : 1, edge = new Path2D();
  C.forEach((p, i) => {
    const a = C[(i - 1 + C.length) % C.length], b = C[(i + 1) % C.length], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const nx = sign * ty / l, ny = -sign * tx / l, d = grow + wob * noise1(seed, s[i] / 60);
    const x = p[0] + nx * d + dx, y = p[1] + ny * d + dy;
    i ? edge.lineTo(x, y) : edge.moveTo(x, y);
  });
  edge.closePath();
  g.save();
  g.fillStyle = color;
  if (o.marker === false) { g.globalAlpha = o.alpha ?? .92; g.fill(edge); g.restore(); return; }
  g.globalAlpha = (o.alpha ?? .92) * .78; g.fill(edge);
  // Felt-tip passes overlap: where two bands cross the colour doubles up.
  g.clip(edge);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = (o.alpha ?? .92) * .22;
  const xs = C.map(p => p[0]), ys = C.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 10, band = o.band || 34, ba = o.ang ?? -.5;
  g.translate(cx, cy); g.rotate(ba);
  for (let y = -R; y < R; y += band * (.82 + r() * .1)) {
    const wb = band * (.95 + r() * .2);
    g.fillRect(-R - r() * 20, y, R * 2 + r() * 20, wb);
  }
  g.restore();
}

/** Where lines at angle `ang` cross a closed shape: inside spans along each line, ordered. */
function spans(pts, ang, cx, cy, offs) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const R = pts.map(([x, y]) => [(x - cx) * c - (y - cy) * s, (x - cx) * s + (y - cy) * c]);
  return offs.map((off) => {
    const xs = [];
    for (let i = 0; i < R.length; i++) {
      const p = R[i], q = R[(i + 1) % R.length];
      if ((p[1] - off) * (q[1] - off) < 0) xs.push(p[0] + (off - p[1]) * (q[0] - p[0]) / (q[1] - p[1]));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
    return out;
  });
}
const unrotate = (x, y, ang, cx, cy) => [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)];

/**
 * Pen hatching inside a shape: shadow made of line. Strokes start and stop near the edge the
 * way a hand does, short of it or a little past, never on a ruled clip.
 *   key, t     as ink()
 *   gap        px between strokes (9)   ang  radians (-.6)   w  nib (1.8)
 *   cross      adds a second pass at ang + .9
 *   fade(u)    0..1 across the run thins and drops strokes, for a shaded edge
 *   ragged     px the ends wander off the edge (5)
 */
function hatch(g, pts, o = {}) {
  const key = boilKey((o.key || 'hatch'), o.t, o.boil ?? BOIL), r = rngFor(key + ':h');
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 6;
  const poly = resample(pts, 4, true).pts, rag = o.ragged ?? 5;
  const passes = o.cross ? [o.ang ?? -.6, (o.ang ?? -.6) + .9] : [o.ang ?? -.6];
  passes.forEach((ang, pi) => {
    const gap = o.gap || 9, n = Math.ceil(2 * R / gap), offs = [];
    for (let i = 0; i <= n; i++) offs.push(-R + i * gap + (r() - .5) * gap * .35);
    spans(poly, ang, cx, cy, offs).forEach((row, i) => row.forEach(([x0, x1], j) => {
      const u = i / n, f = o.fade ? clamp(o.fade(u), 0, 1) : 1;
      if (f < .05 || r() > .35 + .65 * f) return;
      const a = x0 + (r() - .3) * rag, b = x1 - (r() - .3) * rag;
      if (b - a < 6) return;
      const y = offs[i];
      ink(g, [unrotate(a, y + (r() - .5) * 2, ang, cx, cy), unrotate(b, y + (r() - .5) * 2, ang, cx, cy)],
        { key: `${key}:${pi}:${i}:${j}`, boil: 0, w: (o.w || 1.8) * (.6 + .4 * f), wobble: .6, press: .25, taper: [6, 12], color: o.color, alpha: o.alpha });
    }));
  });
}

/** Back-and-forth pen scribble filling a shape: quick shadow or a dark mass. o.gap, o.w, o.ang. */
function scribble(g, pts, o = {}) {
  const key = boilKey(o.key || 'scribble', o.t, o.boil ?? BOIL), r = rngFor(key + ':s'), ang = o.ang ?? -.15;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  const gap = o.gap || 8, offs = [];
  for (let y = -R; y <= R; y += gap * (.8 + r() * .4)) offs.push(y);
  const zig = [];
  spans(resample(pts, 4, true).pts, ang, cx, cy, offs).forEach((row, i) => {
    if (!row.length) return;
    const [a, b] = [row[0][0], row.at(-1)[1]], inset = Math.min(6, (b - a) * .1);
    const ends = i % 2 ? [b - inset + (r() - .5) * 6, a + inset + (r() - .5) * 6] : [a + inset + (r() - .5) * 6, b - inset + (r() - .5) * 6];
    for (const x of ends) zig.push(unrotate(x, offs[i] + (r() - .5) * gap * .5, ang, cx, cy));
  });
  if (zig.length > 1) ink(g, zig, { key: key + ':z', boil: 0, w: o.w || 2, wobble: 1.2, press: .45, taper: [8, 8], color: o.color, alpha: o.alpha });
}

/* ── action marks: the cartoon's sound effects, drawn ─────────────────────── */

/** Motion lines trailing a moving point: (x, y) now, (dx, dy) the direction it came from. */
function speed(g, x, y, dx, dy, o = {}) {
  const r = rngFor(boilKey(o.key || 'speed', o.t, o.boil ?? BOIL)), l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const n = o.n || 3, spread = o.spread || 24, len = o.len || 60;
  for (let i = 0; i < n; i++) {
    const side = (i - (n - 1) / 2) * spread / Math.max(1, n - 1) * 2, gap = 10 + r() * 14, ll = len * (.6 + r() * .6);
    const ax = x + ux * gap - uy * side, ay = y + uy * gap + ux * side;
    ink(g, [[ax, ay], [ax + ux * ll, ay + uy * ll]], { key: `${o.key || 'speed'}:${i}`, t: o.t, w: o.w || 2.4, taper: [4, ll * .7], wobble: .6 });
  }
}

/** Impact burst: short strokes radiating from a hit. o.r0 inner, o.r1 outer, o.n strokes. */
function burst(g, cx, cy, o = {}) {
  const key = o.key || 'burst', r = rngFor(boilKey(key, o.t, o.boil ?? BOIL)), n = o.n || 7, r0 = o.r0 || 26, r1 = o.r1 || 58;
  for (let i = 0; i < n; i++) {
    const a = (o.a0 ?? 0) + (o.span ?? TAU) * (i + .5 + (r() - .5) * .5) / n, a0 = r0 * (.85 + r() * .3), a1 = r1 * (.75 + r() * .4);
    ink(g, [[cx + Math.cos(a) * a0, cy + Math.sin(a) * a0], [cx + Math.cos(a) * a1, cy + Math.sin(a) * a1]],
      { key: `${key}:${i}`, t: o.t, w: o.w || 3, taper: [3, 12], wobble: .5 });
  }
}

/** A puff of dust or steam: a few overlapping loops. o.u 0..1 grows and thins it as it fades. */
function puff(g, cx, cy, rad, o = {}) {
  const key = o.key || 'puff', r = rngFor(key), u = o.u ?? 0, n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = rad * (.3 + r() * .5) * (1 + u * .6), rr = rad * (.45 + r() * .35) * (1 + u * .5);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .6 - u * rad * .8;
    if (o.fill) tint(g, ellipse(x, y, rr, rr * .85), o.fill, { key: `${key}:f${i}`, t: o.t, alpha: (o.alpha ?? .9) * (1 - u), marker: false });
    ink(g, ellipse(x, y, rr, rr * .85), { key: `${key}:${i}`, t: o.t, closed: true, w: (o.w || 2.6) * (1 - u * .7), alpha: 1 - u * .8 });
  }
}
/* ── end line kit ─────────────────────────────────────────────────────────── */
