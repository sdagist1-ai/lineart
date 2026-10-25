/* ── gucky kit ────────────────────────────────────────────────────────────────
   Gucky, his siblings, Mom's feet, eggs, the nest and their voices, drawn by
   one rig so every episode and sheet shows the same ducks. new-film.mjs
   --series gucky copies this block after the line and sound kits; it depends
   on them. Change the rig here, in one place; an episode's copy is frozen with
   that episode.

   Rig units: a hatchling stands 1 unit tall, origin on the ground between its
   feet, x forward (toward the bill in side view), y down. `s` scales a unit to
   UNIT px (s = 1 is a 320 px duckling; .4 a wide shot, 2+ a close-up).

   Top-level names: UNIT, GUCKY, DUCKLINGS, duckling, walkPhase, egg, nest,
   momFeet, peep, peepRun, motif.
   ───────────────────────────────────────────────────────────────────────── */

const UNIT = 320;
const GUCKY = {
  down: SPOT.yellow, wet: '#E9B941', bill: SPOT.orange, shell: '#E4EFE8',
  // The motif: incomplete it asks, complete it answers. D major, plucked.
  motif: { root: 69 + 5, mode: 'major', ask: [0, 2, 4, 2], answer: [0, 2, 4, 2, 7] },
};
/** The four hatchlings. Down colour is shared; silhouettes and tufts tell them apart. */
const DUCKLINGS = {
  gucky: { scale: 1, tuft: 'curl', bodyW: 1, bill: 1, voice: 0 },
  pip: { scale: 1.1, tuft: 'spike', bodyW: 1.04, bill: 1.12, voice: -2 },
  dot: { scale: .98, tuft: 'pair', bodyW: 1, bill: .95, voice: 3, spot: true },
  bean: { scale: .86, tuft: 'none', bodyW: 1.12, bill: .9, voice: 5 },
};

const rotAbout = (pts, cx, cy, a) => xf(pts.map(([x, y]) => [x - cx, y - cy]), cx, cy, a);
/** Jagged (wet) or softly scalloped (dry) edge in unit space, keyed so it holds still. */
function fluffy(pts, key, amp, period) {
  const { pts: P } = resample(pts, period, true), r = rngFor(key), n = P.length;
  let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sign = area > 0 ? -1 : 1;
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const d = amp * (i % 2 ? -.35 : 1) * (.6 + .4 * r());
    return [p[0] + sign * ty / l * d, p[1] - sign * tx / l * d];
  });
}
const knock = (g, pts) => { g.save(); g.fillStyle = PAPER; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.restore(); };
const dot = (g, x, y, r, color = INK) => { g.save(); g.fillStyle = color; g.beginPath(); g.arc(x, y, Math.max(.8, r), 0, TAU); g.fill(); g.restore(); };

/** Walk cycle phase for a duckling that has walked `dist` px at scale s: feet stay planted. */
const walkPhase = (dist, s, stride = .08) => dist / (4 * stride * UNIT * s);

/**
 * One duckling.
 *   who      'gucky' | 'pip' | 'dot' | 'bean'
 *   x, y     ground point between the feet, frame px      s  scale (1 = 320 px tall)
 *   view     'side' | 'front' | 'back'                    facing  1 right, -1 left (side view)
 *   step     walk phase (walkPhase); omit to stand       stride  foot travel, units (.08)
 *   lean     radians, forward +   waddle  radians of side-to-side roll   squash  1 normal, <1 squashed
 *   look     [-1..1, -1..1] where the eyes point         blink  0 open .. 1 shut
 *   happy    eyes closed as smiling arcs when shut        brow  -1 worried .. 1 determined (0 none)
 *   bill     0 shut .. 1 wide open                        wing  0 folded .. 1 raised
 *   wet      0 dry .. 1 just hatched                      cap   { tilt, dx, dy } shell cap on the head, or null
 *   headTilt radians                                       t, key  boil and imperfection
 */
function duckling(g, p) {
  const who = DUCKLINGS[p.who || 'gucky'], key = p.key || p.who || 'gucky', t = p.t;
  const s = (p.s ?? 1) * who.scale, S = UNIT * s, view = p.view || 'side', f = view === 'side' ? (p.facing ?? 1) : 1;
  const kw = clamp(Math.sqrt(s), .75, 1.6), wS = 5 * kw, wD = 2.8 * kw, wet = p.wet || 0;
  const squash = p.squash ?? 1, stretch = 1 / Math.sqrt(squash);
  const step = p.step, A = p.stride ?? .08;
  const bob = step === undefined ? 0 : -.025 * Math.abs(Math.sin(step * TAU));
  const rot = (p.lean || 0) * f + (p.waddle || 0);
  // Unit space -> frame: squash about the ground, bob, lean/waddle about the feet, then place.
  const W2 = (pts) => xf(pts.map(([x, y]) => [x * stretch, (y + bob) * squash]), p.x, p.y, rot, f * S, S);
  const down = wet > .5 ? GUCKY.wet : GUCKY.down;
  const look = p.look || [0, 0], blink = clamp(p.blink || 0, 0, 1), bw = who.bodyW;

  // Feet: stance slides back under the body at walking speed; swing arcs forward.
  const foot = (phase, side) => {
    if (phase === undefined) return { fx: side * .045, lift: 0 };
    const q = ((phase % 1) + 1) % 1;
    if (q < .5) return { fx: A - 4 * A * q, lift: 0 };
    const u = (q - .5) / .5;
    return { fx: -A + 2 * A * smooth(u), lift: Math.sin(u * Math.PI) * .07 };
  };
  const drawFoot = (fx, lift, hipX, k, front) => {
    const ax = fx, ay = -lift, hip = [hipX, -.17 - bob * 0];
    ink(g, W2([hip, [ax - .01, ay - .03], [ax, ay - .012]]), { key: `${key}:leg${k}`, t, w: wD * .9, taper: [2, 2], wobble: .4 });
    const pad = front
      ? [[ax - .07, ay], [ax + .07, ay], [ax + .05, ay - .03], [ax, ay - .015], [ax - .05, ay - .03]]
      : [[ax - .035, ay - .02], [ax + .15, ay - .01], [ax + .16, ay + .008], [ax - .02, ay + .01]];
    const P = W2(pad);
    tint(g, P, GUCKY.bill, { key: `${key}:foot${k}`, t, marker: false, miss: 2 * kw, grow: -1 });
    outline(g, P, { key: `${key}:foot${k}`, t, w: wD, join: 2 });
    if (!front) for (const tx of [.06, .11]) ink(g, W2([[ax + tx, ay - .012], [ax + tx + .02, ay + .004]]), { key: `${key}:toe${k}${tx}`, t, w: wD * .55, taper: [2, 3] });
  };

  if (view === 'side') {
    const near = foot(step, 1), far = foot(step === undefined ? undefined : step + .5, -1);
    drawFoot(far.fx - .03, far.lift, -.06, 'f', false);
    drawFoot(near.fx, near.lift, .02, 'n', false);
    // Body: an upturned bean with the tail tuft in its outline.
    let body = curve([[.22 * bw, -.42], [.21 * bw, -.25], [.05, -.13], [-.17 * bw, -.15], [-.30 * bw, -.27], [-.41 * bw, -.45], [-.25 * bw, -.49], [-.02, -.57], [.15, -.55]], { closed: true, per: .02 });
    body = fluffy(body, key + ':bodyfluff', wet ? .03 * wet : .006, wet ? .045 : .03);
    const B = W2(body);
    knock(g, B); tint(g, B, down, { key: `${key}:body`, t, miss: 3 * kw }); outline(g, B, { key: `${key}:body`, t, w: wS });
    for (const [i, c] of [[[.15, -.33], [.11, -.30]], [[.12, -.24], [.08, -.22]]].entries())
      ink(g, W2([c[0], c[1], [c[1][0] + .01, c[1][1] + .03]]), { key: `${key}:fluff${i}`, t, w: wD * .7, taper: [3, 4] });
    // Wing: a stub that lifts about the shoulder.
    const wing = rotAbout(curve([[.03, -.43], [-.08, -.46], [-.21, -.38], [-.13, -.33], [-.02, -.36]], { closed: true, per: .02 }), .03, -.42, -(p.wing || 0) * 1.1);
    const Wg = W2(wing); tint(g, Wg, down, { key: `${key}:wing`, t, miss: 2 * kw, marker: false, alpha: .6 }); outline(g, Wg, { key: `${key}:wing`, t, w: wD * 1.1 });
    // Head, turned about the neck.
    const hc = [.13, -.79], hr = .23, tilt = (p.headTilt || 0) + look[1] * .08;
    const H = (pts) => W2(rotAbout(pts, .08, -.58, tilt));
    let head = ellipse(hc[0], hc[1], hr * 1.02, hr, { n: 64 });
    head = fluffy(head, key + ':headfluff', wet ? .03 * wet : .005, wet ? .05 : .035);
    const Hd = H(head);
    knock(g, Hd); tint(g, Hd, down, { key: `${key}:head`, t, miss: 3 * kw }); outline(g, Hd, { key: `${key}:head`, t, w: wS });
    if (who.spot) { const sp = H(ellipse(.05, -.92, .05, .035)); tint(g, sp, SPOT.sand, { key: `${key}:spot`, t, marker: false }); }
    tuft(g, H, who.tuft, key, t, wD, wet);
    // Bill: upper mandible, lower hinged open.
    const bl = who.bill, hinge = [.33, -.745], open = (p.bill || 0) * .55;
    const upper = H([[.31, -.83], [.36, -.845], [.33 + .17 * bl, -.81], [.35 + .19 * bl, -.775], [.33 + .16 * bl, -.755], [.32, -.745]]);
    const lower = H(rotAbout([[.32, -.745], [.33 + .15 * bl, -.75], [.34 + .16 * bl, -.73], [.33 + .1 * bl, -.705], [.31, -.71]], hinge[0], hinge[1], open));
    for (const [nm, P] of [['lo', lower], ['up', upper]]) {
      const C = curve(P, { closed: true, per: 3 });
      tint(g, C, GUCKY.bill, { key: `${key}:bill${nm}`, t, marker: false, miss: 1.5 * kw, grow: -1 });
      outline(g, C, { key: `${key}:bill${nm}`, t, w: wD, join: 2 });
    }
    const nos = H([[.39, -.81]])[0]; dot(g, nos[0], nos[1], 1.6 * kw);
    eye(g, H, [.2 + look[0] * .012, -.845 + look[1] * .012], blink, p.happy, wD, key, t, s);
    if (p.brow) brow(g, H, [.2, -.925], p.brow, wD, key, t);
    if (p.cap) shellCap(g, H, [.1, -.94], p.cap, key, t, kw);
    return;
  }

  // Front and back: symmetric masses, posed asymmetrically by tilt and look.
  const front = view === 'front';
  const fL = foot(step, -1), fR = foot(step === undefined ? undefined : step + .5, 1);
  for (const [k, side, ft] of [['l', -1, fL], ['r', 1, fR]]) {
    const ax = side * .1, ay = -ft.lift;
    ink(g, W2([[side * .07, -.15], [ax, ay - .02]]), { key: `${key}:leg${k}`, t, w: wD * .9, taper: [2, 2], wobble: .4 });
    const pad = W2([[ax - side * .02, ay - .02], [ax + side * .1, ay - .005], [ax + side * .09, ay + .012], [ax - side * .05, ay + .012]]);
    tint(g, pad, GUCKY.bill, { key: `${key}:foot${k}`, t, marker: false, miss: 2 * kw, grow: -1 });
    outline(g, pad, { key: `${key}:foot${k}`, t, w: wD, join: 2 });
  }
  let body = ellipse(0, -.34, .28 * bw, .24, { n: 64 });
  body = fluffy(body, key + ':bodyfluffF', wet ? .03 * wet : .006, wet ? .045 : .03);
  const B = W2(body);
  knock(g, B); tint(g, B, down, { key: `${key}:bodyF`, t, miss: 3 * kw }); outline(g, B, { key: `${key}:bodyF`, t, w: wS });
  for (const side of [-1, 1]) {
    const wing = rotAbout([[side * .24, -.44], [side * .33, -.36], [side * .31, -.27], [side * .24, -.31]], side * .24, -.44, side * (p.wing || 0) * 1.1);
    const Wg = W2(curve(wing, { closed: true, per: .02 }));
    tint(g, Wg, down, { key: `${key}:wingF${side}`, t, marker: false, alpha: .6 }); outline(g, Wg, { key: `${key}:wingF${side}`, t, w: wD * 1.1 });
  }
  if (!front) {
    const tail = W2(curve([[-.07, -.5], [0, -.62], [.07, -.5], [0, -.53]], { closed: true, per: .02 }));
    tint(g, tail, down, { key: `${key}:tailB`, t, marker: false }); outline(g, tail, { key: `${key}:tailB`, t, w: wD });
  }
  const tilt = (p.headTilt || 0) + look[0] * .06, H = (pts) => W2(rotAbout(pts, 0, -.56, tilt));
  let head = ellipse(0, -.79, .235, .225, { n: 64 });
  head = fluffy(head, key + ':headfluffF', wet ? .03 * wet : .005, wet ? .05 : .035);
  const Hd = H(head);
  knock(g, Hd); tint(g, Hd, down, { key: `${key}:headF`, t, miss: 3 * kw }); outline(g, Hd, { key: `${key}:headF`, t, w: wS });
  if (who.spot) { const sp = H(ellipse(-.06, -.95, .05, .035)); tint(g, sp, SPOT.sand, { key: `${key}:spotF`, t, marker: false }); }
  tuft(g, H, who.tuft, key + 'F', t, wD, wet);
  if (!front) return;
  for (const side of [-1, 1]) {
    eye(g, H, [side * .085 + look[0] * .02, -.81 + look[1] * .015], blink, p.happy, wD, key + side, t, s, side);
    if (p.brow) brow(g, H, [side * .085, -.89], p.brow, wD, key + side, t, side);
  }
  const bl = who.bill, open = (p.bill || 0);
  const lowerB = H(ellipse(0, -.7 + open * .03, .1 * bl, .035 + open * .05, { n: 32 }));
  tint(g, lowerB, GUCKY.bill, { key: `${key}:billLoF`, t, marker: false, miss: 1.5 * kw }); outline(g, lowerB, { key: `${key}:billLoF`, t, w: wD, join: 2 });
  if (open > .05) { const m = H(ellipse(0, -.7 + open * .03, .07 * bl, .015 + open * .035, { n: 24 })); g.save(); g.fillStyle = '#7A2E22'; g.beginPath(); m.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.fill(); g.restore(); }
  const upperB = H(ellipse(0, -.735, .125 * bl, .045, { n: 32 }));
  tint(g, upperB, GUCKY.bill, { key: `${key}:billUpF`, t, marker: false, miss: 1.5 * kw, grow: -1 }); outline(g, upperB, { key: `${key}:billUpF`, t, w: wD, join: 2 });
  for (const side of [-1, 1]) { const n = H([[side * .035, -.75]])[0]; dot(g, n[0], n[1], 1.5 * kw); }
  if (p.cap) shellCap(g, H, [0, -.94], p.cap, key, t, kw);
}

/** The hair tuft that tells the ducklings apart: Gucky's curl, Pip's spike, Dot's pair. */
function tuft(g, H, kind, key, t, w, wet) {
  const strokes = {
    curl: [[[.07, -1.0], [.05, -1.08], [.11, -1.12], [.13, -1.07], [.09, -1.05]], [[.12, -1.0], [.15, -1.06], [.19, -1.05]], [[.02, -1.0], [-.01, -1.05]]],
    spike: [[[.06, -1.0], [.08, -1.13]], [[.11, -1.0], [.16, -1.09]]],
    pair: [[[.05, -1.0], [.03, -1.07], [.07, -1.09]], [[.1, -1.0], [.12, -1.07], [.16, -1.07]]],
    none: [],
  }[kind] || [];
  strokes.forEach((st, i) => ink(g, H(wet ? st.map(([x, y], j) => [x + (j % 2 ? .01 : -.01), y]) : (st.length > 2 ? curve(st, { per: .01 }) : st)),
    { key: `${key}:tuft${i}`, t, w: w * .85, taper: [2, 7], wobble: .6 }));
}

/** An eye: black with a highlight; shut it reads as a line, or as a smiling arc when happy. */
function eye(g, H, c, blink, happy, w, key, t, s, side = 1) {
  const r = .036, open = 1 - blink;
  if (open < .12) {
    const arc = happy ? [[c[0] - r, c[1] + .005], [c[0], c[1] - .022], [c[0] + r, c[1] + .005]] : [[c[0] - r, c[1]], [c[0], c[1] + .012], [c[0] + r, c[1]]];
    ink(g, H(curve(arc, { per: .005 })), { key: `${key}:shut`, t, w: w * 1.05, taper: [3, 3], wobble: .3 });
    return;
  }
  const E = H(ellipse(c[0], c[1], r * .85, r * 1.1 * open, { n: 28 }));
  g.save(); g.fillStyle = INK; g.beginPath(); E.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.restore();
  if (open > .4) { const hl = H([[c[0] + .01 * side, c[1] - .014]])[0]; dot(g, hl[0], hl[1], 4.2 * s, PAPER); }
}

/** A brow stroke above the eye: -1 worried (inner end up), 1 determined (inner end down). */
function brow(g, H, c, v, w, key, t, side = 1) {
  const d = .028 * v, inner = side;
  ink(g, H([[c[0] - .04 * inner, c[1] - d], [c[0] + .04 * inner, c[1] + d]]), { key: `${key}:brow`, t, w: w * .8, taper: [3, 3], wobble: .3 });
}

/** The top of Gucky's shell, worn like a helmet: a speckled dome with a cracked rim. */
function shellCap(g, H, at, cap, key, t, kw) {
  const tilt = cap.tilt || 0, cx = at[0] + (cap.dx || 0), cy = at[1] + (cap.dy || 0);
  const rim = [], n = 9;
  for (let i = 0; i <= n; i++) rim.push([cx - .17 + .34 * i / n, cy + (i % 2 ? .028 : -.004)]);
  const dome = ellipse(cx, cy, .17, .14, { a0: Math.PI, a1: TAU, n: 30 });
  const P = H(rotAbout([...dome, ...rim.reverse()], cx, cy, tilt));
  knock(g, P);
  tint(g, P, GUCKY.shell, { key: `${key}:cap`, t, marker: false, miss: 2 * kw });
  outline(g, P, { key: `${key}:cap`, t, w: 3.6 * kw, join: 3 });
  const r = rngFor(key + ':speck');
  for (let i = 0; i < 6; i++) { const q = H(rotAbout([[cx - .11 + r() * .22, cy - .1 + r() * .08]], cx, cy, tilt))[0]; dot(g, q[0], q[1], (1.4 + r() * 1.6) * kw); }
}

/**
 * A duck egg, standing on its blunt end at (x, y).
 *   rock     radians it tips about its base            crack  0..1 how far the zigzag has run round it
 *   pip      0..1 a hole punched where the bill comes   top    { dx, dy, tilt } the cap lifted off, or null
 *   speckled Gucky's egg                                 s, t, key
 */
function egg(g, x, y, o = {}) {
  const s = o.s ?? 1, S = UNIT * s, key = o.key || 'egg', t = o.t, kw = clamp(Math.sqrt(s), .75, 1.6);
  const W2 = (pts) => xf(pts, x, y, o.rock || 0, S, S);
  // Blunt end down: wider below the middle, narrower toward the top.
  const shape = (a) => { const yy = Math.sin(a); return [Math.cos(a) * .23 * (1 + .12 * yy), -.31 + yy * .31]; };
  const arc = (a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => shape(a0 + (a1 - a0) * i / n));
  const crackY = -.36, ca = Math.asin((crackY + .31) / .31), zig = [];
  for (let i = 0; i <= 12; i++) zig.push([-.22 + .44 * i / 12, crackY + (i % 2 ? .035 : -.02)]);
  const shell = (P, k) => { knock(g, P); tint(g, P, GUCKY.shell, { key: `${key}:${k}`, t, marker: false, miss: 2.5 * kw }); outline(g, P, { key: `${key}:${k}`, t, w: 4.6 * kw }); };
  if (!o.top) {
    shell(W2(arc(0, TAU, 72).slice(0, -1)), 'shell');
    if (o.crack) { const C = resample(W2(zig), 2); const n = Math.max(2, Math.round(C.pts.length * clamp(o.crack, 0, 1))); ink(g, C.pts.slice(0, n), { key: `${key}:crack`, t, w: 3 * kw, taper: [2, 6], wobble: .3 }); }
  } else {
    // The bottom stays with the zigzag as its rim; the cap lifts away with the other side of it.
    shell(W2([...arc(ca, Math.PI - ca), ...zig]), 'shell');
    const top = o.top, cap = rotAbout([...arc(Math.PI - ca, TAU + ca), ...zig.slice().reverse()], 0, crackY, top.tilt || 0).map(([a, b]) => [a + (top.dx || 0), b + (top.dy || 0)]);
    shell(W2(cap), 'top');
  }
  if (o.speckled) {
    const r = rngFor(key + ':speck');
    for (let i = 0; i < 16; i++) {
      const q = shape(r() * TAU), rr = Math.sqrt(r()) * .8, pt = [q[0] * rr, -.31 + (q[1] + .31) * rr];
      if (o.top && pt[1] < crackY) continue;
      const w = W2([pt])[0]; dot(g, w[0], w[1], (1.5 + r() * 2) * kw);
    }
  }
  // A pip is a small star of cracks round a hole, flakes lifted at the edge (a skimmer egg,
  // public domain, Commons "Black skimmer chicks pipping in eggs").
  if (o.pip) {
    const h = W2([[.06, -.42]])[0], rad = 11 * s * o.pip, r = rngFor(key + ':pip');
    const P = ellipse(h[0], h[1], rad, rad * .75);
    tint(g, P, INK, { key: `${key}:pip`, t, marker: false, miss: 0, grow: 0, alpha: .85 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + r() * .5, l = rad * (1.4 + r() * 1.3) * Math.min(1, o.pip * 1.5);
      ink(g, [[h[0] + Math.cos(a) * rad * .8, h[1] + Math.sin(a) * rad * .6], [h[0] + Math.cos(a) * (rad + l), h[1] + Math.sin(a) * (rad * .75 + l * .8)]], { key: `${key}:pipcrack${i}`, t, w: 2 * kw, taper: [2, 6], wobble: .3 });
    }
  }
}

/**
 * A nest of dry grass seen from low and in front: a shallow bowl whose straws follow the rim.
 * Draw part 'back' (bowl and far rim) before what sits in it, 'front' (near rim) after; omit
 * part for both at once.
 */
function nest(g, x, y, w, o = {}) {
  const key = o.key || 'nest', t = o.t, h = w * .26, cy = y - h * .45, part = o.part;
  const rim = (a0, a1, n, k) => {
    const r = rngFor(`${key}:${k}`);
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + r() * .6) / n, rr = .9 + r() * .14, len = .22 + r() * .18;
      const pts = ellipse(x, cy + (r() - .5) * h * .12, w * .5 * rr, h * .5 * rr, { a0: a, a1: a + len * (r() < .5 ? 1 : -1), n: 10 });
      ink(g, pts, { key: `${key}:${k}${i}`, t, w: 1.8 + r() * 1.2, taper: [8, 12], wobble: .7 });
    }
  };
  if (part !== 'front') {
    const bowl = ellipse(x, cy, w * .5, h * .5);
    tint(g, bowl, SPOT.sand, { key: `${key}:bowl`, t, alpha: .7 });
    hatch(g, ellipse(x, cy - h * .05, w * .4, h * .3), { key: `${key}:shade`, t, gap: 12, ang: -.15, w: 1.5, fade: (u) => 1 - u * .6 });
    rim(Math.PI, TAU, 16, 'back');
  }
  if (part !== 'back') {
    // The near rim stands up: a crescent between the outer lip and a higher inner edge hides what
    // sits in the bowl below about cy + .2h.
    const r = rngFor(`${key}:base`), outer = ellipse(x, cy, w * .5, h * .5, { a0: 0, a1: Math.PI, n: 40 });
    const band = [...outer, ...ellipse(x, cy - h * .1, w * .46, h * .3, { a0: Math.PI - .02, a1: .02, n: 40 })];
    knock(g, band); tint(g, band, SPOT.sand, { key: `${key}:band`, t, alpha: .85 });
    ink(g, outer, { key: `${key}:lip`, t, w: 3.2, taper: [20, 20] });
    ink(g, ellipse(x, cy - h * .1, w * .46, h * .3, { a0: .15, a1: Math.PI - .15, n: 40 }), { key: `${key}:inner`, t, w: 2.6, taper: [16, 16] });
    rim(.1, Math.PI - .1, 18, 'front');
    for (let i = 0; i < 5; i++) { const px = x - w * .38 + i * w * .19 + (r() - .5) * 20; ink(g, [[px, y - h * .02], [px + 14 + r() * 12, y - h * .12]], { key: `${key}:tuft${i}`, t, w: 1.8, taper: [2, 8] }); }
  }
}

/**
 * Mom, as a hatchling sees her: a white belly above, legs and feet below, drawn in the ducklings'
 * own vocabulary (scalloped down edge, stick legs, rounded orange pads with two toe lines), only
 * bigger. phase walks her; facing turns her feet.
 */
function momFeet(g, x, y, s, o = {}) {
  const key = o.key || 'mom', t = o.t, S = UNIT * s, kw = clamp(Math.sqrt(s), .75, 1.6), f = o.facing ?? 1;
  const wS = 5 * kw, wD = 2.8 * kw, k = 2.6;
  const X = (pts) => xf(pts, x, y, 0, f * S, S);
  const edge = fluffy(ellipse(-.05, -.74, .8, .34, { n: 96 }), key + ':belly', .006, .03).filter(([, py]) => py > -.72);
  ink(g, X(edge), { key: `${key}:belly`, t, w: wS, taper: [30, 30] });
  for (const [kk, side, off] of [['far', -1, .5], ['near', 1, 0]]) {
    let fx = side * .16, lift = 0;
    if (o.phase !== undefined) { const q = (((o.phase + off) % 1) + 1) % 1; if (q < .5) fx += .3 - 1.2 * q; else { const u = (q - .5) / .5; fx += -.3 + .6 * smooth(u); lift = Math.sin(u * Math.PI) * .12; } }
    const ax = fx, ay = -lift;
    ink(g, X([[side * .14, -.42], [ax - .01 * k, ay - .03 * k], [ax, ay - .012 * k]]), { key: `${key}:leg${kk}`, t, w: wD * .9, taper: [2, 2], wobble: .4 });
    const pad = X([[ax - .035 * k, ay - .02 * k], [ax + .15 * k, ay - .01 * k], [ax + .16 * k, ay + .008 * k], [ax - .02 * k, ay + .01 * k]]);
    tint(g, pad, GUCKY.bill, { key: `${key}:foot${kk}`, t, marker: false, miss: 2 * kw, grow: -1 });
    outline(g, pad, { key: `${key}:foot${kk}`, t, w: wD, join: 2 });
    for (const tx of [.06, .11]) ink(g, X([[ax + tx * k, ay - .012 * k], [ax + (tx + .02) * k, ay + .004 * k]]), { key: `${key}:toe${kk}${tx}`, t, w: wD * .55, taper: [2, 3] });
  }
}

/* ── voices and motif ─────────────────────────────────────────────────────── */

/** A duckling peep: a short upward chirp. who sets the voice; bright .. 1 for alarm or delight. */
function peep(s, at, o = {}) {
  const who = DUCKLINGS[o.who || 'gucky'], { level = .06, dur = .11, bright = .5, x = null, key = 'peep' } = o;
  const r = rngFor(`${s.key}:${key}:${at.toFixed(3)}`), base = 2900 * Math.pow(2, (who.voice + (r() - .5) * 1.2) / 12);
  const g = s.ac.createGain(), stop = s.env(g.gain, at, { attack: .008, hold: dur * .4, release: dur * .6, peak: level });
  const osc = s.osc('triangle', base, at, stop);
  osc.frequency.setValueAtTime(base * .82, at); osc.frequency.exponentialRampToValueAtTime(base * (1.12 + bright * .2), at + dur * .55);
  osc.frequency.exponentialRampToValueAtTime(base * .9, at + dur);
  const f = s.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5200 + bright * 2400;
  osc.connect(f).connect(g); s.place(g, { x, send: .2, bus: 'fx' });
}
/** n peeps from `at`, gap apart, a little uneven. */
function peepRun(s, at, n, gap = .16, o = {}) {
  const r = rngFor(`${s.key}:${o.key || 'run'}:${at.toFixed(3)}`);
  for (let i = 0; i < n; i++) peep(s, at + i * gap + (r() - .5) * gap * .25, { ...o, key: `${o.key || 'run'}${i}`, bright: (o.bright ?? .5) + (r() - .5) * .3 });
}
/** Gucky's motif: 'ask' (incomplete) or 'answer' (resolved), from `at`, one note per beat. */
function motif(s, at, which = 'answer', beat = .32, o = {}) {
  const m = GUCKY.motif;
  m[which].forEach((d, i) => pluck(s, at + i * beat, degree(m.root + (o.octave || 0) * 12, m.mode, d), { level: o.level ?? .1, key: `motif:${which}:${at.toFixed(2)}:${i}`, x: o.x ?? null }));
}
/* ── end gucky kit ── */
