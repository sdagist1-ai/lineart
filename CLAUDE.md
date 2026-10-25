# lineart

Line-art animation: black pen line on warm white paper with the odd spot of colour, imperfect on
purpose, vertical 1080×1920 for Reels by default. Each work is one self-contained `index.html`
that draws every pixel in Canvas 2D and scores itself with Web Audio: no libraries, fonts, images
or network calls. External references may be viewed for research, never embedded.

Skills: `line-film` for animation, `line-still` for images, `line-score` for sound. Before
drawing, read `.claude/rules/line-ink.md` and `docs/line.md`. A series episode starts from its
`series/<name>/SERIES.md`. Technical checks do not certify artistic quality; say what was and
was not watched or heard.

## Setup and commands

`cd tools && npm install && npm run setup && npm test`, then run these in `tools/`:

```
node new-film.mjs --kind film --duration 30 --out ../films/<name>/index.html
node new-film.mjs --kind film --duration 30 --series gucky --out ../films/<name>/index.html
node shoot.mjs ../films/<name>/index.html --range 6.6:6.9:0.0333333333 --sheet
node review.mjs ../films/<name>/index.html [--mp4 ../out/<name>.mp4]
node verify.mjs ../films/<name>/index.html [--engine chromium]
node still.mjs ../stills/<name>/index.html --at 0 --out ../out/<name>.png
node render.mjs ../films/<name>/index.html --draft
node render.mjs ../films/<name>/index.html
node render.mjs ../films/<name>/index.html --patch 19.5:21
node audio.mjs ../films/<name>/index.html --twice --marks 6,13.9
```

Read every sheet you generate. Every render muxes the score; a range render gets its span.
`--draft` is 15 fps for pace and sync. After a local edit, `--patch a:b` redraws only that range.
Firefox is the primary engine; `verify --engine` checks one while iterating, delivery needs both.
`out/` is disposable and git-ignored.

## Invariants

- Expose `window.__film = { duration, ready, seek(t), renderAudio?, marks?, shots? }`; every tool
  drives it. The scaffold wires it, including the score.
- `seek(t)` is pure in time, independent of seek history. Never `Math.random()`; every line's
  imperfection comes from its key through `rngFor`, and changes over time only through boil.
  A hook flags `Math.random()`, a lost `__film` and syntax errors as soon as an edit lands.
- The score is pure too: seeded, exactly `duration` long, scaled once to −16 LUFS under −1 dBTP.
- Fills (`tint`) go under lines (`ink`). Black is line only; shadow is hatching; colour is spot.
- Draw at frame size; never scale a drawn bitmap. Keep eyes and key action out of the Reels
  overlays (roughly top 250, bottom 420 and right 120 px of 1080×1920).
- Changing an element's key or a `Score({ key })` redraws or reseeds it; freeze keys once approved.

## Map

| Path | Holds |
|---|---|
| `kit/line.js` | The line kit: pen line, marker fill, hatching, action marks, paper, timing. |
| `studies/line/` | The kit's study page: every call on one frame. |
| `studies/sound.html` | The sound kit and its A/B studies; `new-film.mjs` copies the kit from here. |
| `series/<name>/` | A series: `SERIES.md` bible and continuity log, `kit.js` rigs, voices and sets. |
| `films/`, `stills/` | Works, each with its `FILM.md` or `STILL.md`. |
| `docs/` | `brief.md` and `line.md` for this medium; craft docs inherited from riso-windowseat. |
| `tools/` | Scaffolding, inspection and export harness; `README.md` documents each tool. |
