# Line

How to draw with the line kit: weight, imperfection, colour, shadow, action marks, boil and the
vertical frame; read it before drawing any film or still in this repo.

The kit is `kit/line.js`, copied into every work by `tools/new-film.mjs`. The study
`studies/line/index.html` shows each call; render it with `node still.mjs ../studies/line/index.html
--at 0.5 --out ../out/line-study.png`.

## The look

- Warm white paper (`PAPER`), near-black ink (`INK`), colour as spot accents (`SPOT`). A frame is
  mostly paper and line; colour marks what matters. One or two spot colours per scene, three at
  most.
- Imperfect on purpose, and consistently: lines drift, closed shapes overrun or stop short of
  themselves, colour misses the line. That is the hand, not noise. It comes from each element's key,
  so it repeats; it changes over time only through boil.
- Imperfect is not careless. Silhouettes still read at phone size, contacts still touch, perspective
  still holds, the same character looks the same in every shot.

## Line weight

- At 1080 wide: silhouettes 4–6 px, interior detail 2–3 px, hatching 1.5–2 px, nothing under
  about 2 px except hatching. A 2.5 Mbps re-encode of the kit study (harsher than most phone
  playback) kept 1.8 px hatching whole; the paper's tooth was what vanished.
- Heavier on the shadow side and where a form turns away; thinner toward the light. Taper open ends;
  where a line meets another, let it lift rather than butt.
- A recurring character keeps one weight family for the whole series: set it on the model sheet and
  keep it in the series kit, never per episode.

## Imperfection controls

| `ink()` option | Default | Use |
|---|---|---|
| `wobble` | 1.6 px | 0.5 for hatching, 2–3 for loose or nervous lines, 0 for ruled |
| `press` | .38 | slow swell and thinning along the line |
| `taper` | `[w*3, w*3]` px | longer for flicked strokes, short for blunt ones |
| `join` | random overrun or gap | a closed shape's seam; `join: 2` for things that must read sealed (an eye) |
| `over` | 0 | overshoot at open ends: construction-line energy |
| `skip` | 0 | dry breaks; ground lines, water, old wood |

`tint()` has `miss` (3 px), `grow` (-1.5), `wobble` (2), `marker` (bands, default on) and `alpha`.
Keep one `miss` per series: bigger reads childlike, smaller reads tidy.

## Boil

- Pass `t` to anything that should boil: it re-keys `BOIL` times a second (8 by default), the
  shimmer of drawn animation. Omit `t` for things that should feel solid or printed.
- 6–12 per second reads as hand-drawn; above 12 it buzzes. Keep one rate per film.
- Characters can move on twos (`onTwos(t, 12)`) for drawn cadence. Keep camera moves and large pans
  on ones, or the whole frame judders.
- Boil is pure in `t`, so `verify.mjs` passes, but adjacent frames differ by design: judge it from
  an MP4 at speed, not from a sheet.

## Colour

- Fills go under lines: `tint()` before `ink()` for the same shape, always.
- Marker bands (the default) for bodies and props; flat fills (`marker: false`) for small parts
  and washes (bill, feet, sky, water).
- Colour can be a story beat: the thing that changes gets the colour, or colour arrives with the
  feeling (yellow when the sun comes out).

## Shadow

- `hatch()` for form shadow, `cross: true` for deep shadow or night, `scribble()` for quick dark
  masses. One hatch angle per scene, from the light; `fade` thins toward the light.
- No grey fills: shadow is line.

## Action marks

`speed()` trails a fast move, `burst()` marks an impact, `puff()` is dust or steam (its `u` grows and
fades it). They are the cartoon's sound effects, drawn: an impact burst lives about 3 frames,
speed lines only while the move is fast, a puff about half a second. Surprise lines, sweat drops,
hearts, a question mark or "zzz" are drawn as paths with `ink()`, never with fonts.

## The vertical frame

- `new-film.mjs` makes 1080×1920 shown at 405×720; `--format square` makes 1080×1080 at 720. The
  `<meta name="frame">` line tells every tool the size.
- `--res 1440` (or 2160) renders the same design larger: draw in 1080×1920 design pixels and the
  canvas holds `K` output pixels per design pixel, with widths, wobble and gaps scaled, so the look
  holds. Instagram shows 1080×1920 and downsizes larger uploads: 1440 buys cleaner edges after
  that and a master for other platforms, at about twice the render time.
- Reels cover roughly the top 250 px and bottom 420 px with captions and buttons, and the right
  120 px with the action column. Keep eyes, faces and the key action in the middle band (y about
  250–1500) and off the right edge. These are approximate; check one upload.
- The profile grid shows a centre crop (currently about 3:4), so the cover frame's subject belongs
  in the middle.
- Use the height: things fall, climb, rise and line up. A camera at the subject's eye level with the
  ground in the lower third suits a small character.
- The hook: something already happening in frame 0, and a question in the first 3 s that the rest
  answers. No title card, no fade up from white.

## Characters

- One rig per recurring character in `series/<name>/kit.js`, copied into each episode by
  `new-film.mjs --series <name>`. Proportions, weights, colours, eyes, blink and voice live there.
- Gesture, contact and acting rules are in [characters.md](characters.md): eyes lead, blink about
  0.11 s every 3.3 s, no symmetric poses.
- Model sheet before episodes: turnaround, smallest and largest screen size, expressions, key poses
  and a walk cycle, approved by the user.

## Cost

The kit study draws in about 6 ms a frame (23 ms at the 95th percentile, Chromium), so line films
play live in the page with sound. Hatching is the expensive call: every stroke is a polygon.
Profile `drawArt` before optimising.

## Kit reference

| Call | Does |
|---|---|
| `ink(g, pts, o)`, `outline(g, pts, o)` | pen line along points; `outline` closes it |
| `tint(g, pts, color, o)` | marker fill under a shape |
| `hatch(g, pts, o)`, `scribble(g, pts, o)` | shadow made of line inside a shape |
| `speed`, `burst`, `puff` | action marks |
| `ellipse`, `curve`, `bez`, `resample`, `xf` | shape points: ellipse or arc, smooth curve through points, Bezier, even spacing, move/turn/scale |
| `local(t, a, b)`, `ease.*`, `onTwos`, `smooth` | timing |
| `rngFor(key)`, `noise1(seed, x)`, `hash` | deterministic randomness |
| `Space.camera`, `Space.travel`, … | perspective and paths from `tools/lib/visual-kit.mjs` ([scene-space.md](scene-space.md)) |
| `Score`, `pluck`, `mallet`, `contact`, … | the sound kit ([sound.md](sound.md)) |
