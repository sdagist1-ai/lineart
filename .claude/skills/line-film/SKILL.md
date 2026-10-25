---
name: line-film
description: Design, build or improve line-art animations in this repo (black pen line on white with spot colour, vertical 1080x1920 by default), including series episodes, shorts, motion and visual inspection. Delivers self-contained Canvas 2D HTML and a verified MP4 with its score. For a single image use line-still; for sound alone use line-score. Not for editing tools/.
---

# Line film

Deliver `films/<name>/index.html` plus a verified MP4 in `out/`. Every pixel is drawn in Canvas 2D;
the deliverable has no libraries, fonts, images or network calls. External references may be
studied, never embedded. Paths are relative to the repo root; commands run in `tools/`.

## 1. Direction

Read `.claude/rules/line-ink.md`, `docs/brief.md`, `docs/line.md` and `docs/visual-development.md`
first. Add `docs/characters.md` for any character, `docs/motion.md` for what moves,
`docs/scene-space.md` for perspective, framing or precise speed, `docs/quality-bar.md` for playback
defects, and `docs/sound.md` when scoring. For a series episode, read `series/<name>/SERIES.md`
first: its cast, rules, continuity log and episode list override defaults here.

Extract subject, feeling, length, format and constraints. Asked for ideas, propose; asked to make
it, choose and build. Write `FILM.md` early: beats with times, the question the hook poses, the
feeling of each beat and what carries it in sound, framing and spot colours, user constraints,
risks and remaining work.

Plan actions and consequences, not illustrated nouns: per shot, the camera and shot size, what
changes, a readable arrival or hold, and where the eye goes next. Keep subject motion, camera
motion and transition distinct. One continuous take or a fixed frame is as valid as cutting.

## 2. Prove the hard part first

Before filling a timeline, look at real references for the subject and draw one representative
hard frame at full size: the hardest pose, contact or interaction, not the opening. A character
that recurs goes on one sheet at its smallest and largest screen size and in its key poses first.
Fix silhouette, proportions and contact before adding hatching or detail.

Then build a short sample of the hardest action (the character doing something) and encode it as
soon as it exists (`render.mjs --from a --to b`, which carries its slice of the score). Watch it
at speed. For a long film make a full-duration `--draft` before polishing. Set holds and cut
lengths from information and action. These are working checks, not extra approval steps.

## 3. Build from a clean scaffold

```
node new-film.mjs --kind film --duration 30 --out ../films/<name>/index.html
node new-film.mjs --kind film --duration 30 --series gucky --out ../films/gucky-02-<title>/index.html
```

Vertical 1080×1920 is the default; `--format square` for 1080×1080. `--series` copies the series
kit (rigs, voices, sets) in. The scaffold has a blank `drawArt(t)`, a blank `buildScore(s)`, the
contract, and a player that plays the score. Edit the generated HTML directly; copy routines from
other works or `studies/`, never their scenes.

- Fills under lines; key persistent things by name; pass `t` only to what boils
  (`.claude/rules/line-ink.md`).
- One authoritative timeline: event times as data that `drawArt`, `buildScore`, `SHOTS` and
  `MARKS` all read. No second set of timing constants.
- Keep `SHOTS = [{id,start,end,readAt,action,transition}]` derived from that timeline.
- Build in small batches and look at each at its real duration.

## 4. Review picture and motion

```
node shoot.mjs ../films/<name>/index.html --range 6.6:6.9:0.0333333333 --sheet
node review.mjs ../films/<name>/index.html
node verify.mjs ../films/<name>/index.html
```

Use this film's event times. Read every sheet you generate. `verify.mjs` proves seek purity in
both browsers (`--engine` checks one while iterating); it proves repeatability, not beauty. Inspect
frame-spaced strips around contacts, handoffs and loop points, both sides of each. Boil and comic
timing only read at speed: watch a range render with sound.

## 5. Score, export and finish

Score with `line-score` (the film's feeling is half sound). Then:

```
node render.mjs ../films/<name>/index.html --draft
node render.mjs ../films/<name>/index.html
node review.mjs ../films/<name>/index.html --mp4 ../out/<name>.mp4
```

`--draft` (15 fps, fast encode) judges pace and sync; the full render is the delivery. `review.mjs
--mp4` lists every held stretch; confirm each is intended. Decode the final MP4 and check duration,
1080×1920, frame count and audio. Record evidence, remaining weaknesses and anything not watched or
heard in `FILM.md`; for a series, add the episode to the continuity log in `SERIES.md`. Technical
validity is not the user's approval.

For revisions, read `FILM.md`, edit the authoritative HTML, and preserve approved pacing and score.
After a local fix, `render.mjs --patch a:b` redraws only that range; `--patch` with no range
remuxes a new score. Copy the delivered MP4 aside first. When handing a revision to a fresh
session, write `HANDOVER.md` in the film folder: the path, the user's words quoted, what is
approved by time range, suspected causes labelled unconfirmed with the check that would confirm
each.
