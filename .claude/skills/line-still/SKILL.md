---
name: line-still
description: Create or improve a single line-art image in this repo (black pen line on white with spot colour): illustrations, posters, model sheets, covers and thumbnails. Delivers a native PNG and self-contained Canvas 2D source. Use line-film for anything that moves.
---

# Line still

Deliver `stills/<name>/index.html` and a native PNG in `out/`. Same medium as the films: Canvas 2D
only, no libraries, fonts, images or network calls. Commands run in `tools/`.

Read `.claude/rules/line-ink.md`, `docs/line.md` and `docs/visual-development.md`; add
`docs/characters.md` for characters and `docs/scene-space.md` for perspective. Skip timelines and
sound. For a series still (a model sheet, a cover), read `series/<name>/SERIES.md` and generate
with `--series <name>` so it draws from the same rig as the episodes.

```
node new-film.mjs --kind still --format square --out ../stills/<name>/index.html
node new-film.mjs --kind still --series gucky --out ../stills/gucky-model-sheet/index.html
node still.mjs ../stills/<name>/index.html --at 0 --out ../out/<name>.png
```

`--format vertical` (the default) suits phone covers; `square` suits posts and sheets. Look at real
references first for an unfamiliar subject. Solve silhouette, proportion, support and contact
before hatching or colour. Keep spot colour to where the eye should go. Judge the PNG at 1:1 and
at phone size. Record decisions, references and remaining weaknesses in `STILL.md` beside the
source.
