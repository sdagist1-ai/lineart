---
paths:
  - "films/**/*.html"
  - "stills/**/*.html"
  - "studies/**/*.html"
  - "series/**"
---

# Line and ink traps

The look and its controls are in `docs/line.md`; these are the mistakes that cost a revision.

- Fills go under lines: `tint()` a shape before you `ink()` it. A fill drawn after its outline
  buries the line.
- Key persistent things by name (`'gucky:wingL'`), not by array index: inserting an element shifts
  every index-built key after it and redraws their imperfections differently.
- Pass `t` only to what should boil. A boiling background behind a held character reads nervous;
  a character on twos over a background on ones reads right.
- Imperfection changes over time only through boil. Varying wobble, miss or pressure with `t`
  directly makes lines crawl.
- `outline()` starts its seam somewhere along the shape and overruns or stops short. For shapes
  that must read sealed (an eye, a hole), pass `join: 2`.
- Lines under about 2 px at 1080 wide break up on phones; hatching at 1.5–2 px is the floor.
- Black is ink only. Shadow is hatching or scribble, never a grey fill; colour is spot.
- Angles sweep clockwise on screen because y grows downward.
- Scaling a drawn bitmap blurs every line. Redraw at size; keep geometry in frame pixels.
- Never `Math.random()`, never fonts: draw glyphs as paths.
- Keep eyes and key action out of the Reels overlays (roughly the top 250 px, bottom 420 px and
  right 120 px of a 1080×1920 frame).
