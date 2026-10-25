# Line film brief

The design and delivery contract for a new line film; read it before designing or building one.

Make an original film from the user's subject and intent. The kits and craft docs are the
reusable foundation; the story is new each time.

## Design before building a timeline

- Read the ask for subject, feeling, audience, length, format and exclusions. When choices are
  open, name the first idea anyone would pitch, weigh a few approaches that differ in viewpoint,
  action and ending, and pick the strongest without adding an approval step.
- Start from what the subject uniquely does or how it changes; let that set rhythm and ending.
- Test the plan with these questions; they are checks, not required beats:
  - Do the first 3 seconds show something happening and pose a question? (Reels are swiped past
    in about that long.)
  - What is the turn, and what in the film's world causes it?
  - What changes for the character in each shot? If only the drawing changes, cut or merge it.
  - Does something planted early return changed at the end?
  - Is there time after the last event to read it, and does the last frame invite a replay?
- Write `films/<name>/FILM.md`: premise and title; duration, beats with times and why the ending
  belongs to this subject; framing, palette and spot colours; actions, consequences and holds;
  the feeling of each beat and the sound that carries it; user constraints; risks with the
  fallback; assumptions made without asking. A series episode also follows its `SERIES.md`.

## Deliverable and contract

One self-contained `films/<name>/index.html` in Canvas 2D, plus a verified MP4. No libraries,
network, fonts, images or external assets. Vertical 1080×1920 by default (shown at 405×720),
square 1080×1080 on request; the `<meta name="frame">` line declares it. 30 fps. Animation is
time-based, never frame-counted.

- `window.__film = { duration, ready, seek(t), renderAudio?, marks?, shots? }`; every tool drives it
  ([tools/README.md](../tools/README.md#the-contract)).
- `seek(t)` is pure: repeated seeks and cold jumps give identical pixels. Honour `?t=12.5` on load.
- `renderAudio()` is pure too: seeded, exactly `duration` long, scaled once to −16 LUFS under
  −1 dBTP.

## Look, motion, sound, text

- The look: [line.md](line.md). Black line on warm white, spot colour, imperfect on purpose.
- Motion: take it from the subject's action (mass, anticipation, contact, follow-through,
  [motion.md](motion.md)); cartoon timing is allowed to exaggerate, not to be vague.
- Sound sells the feeling: every film is scored unless the user says otherwise. Decide the feeling
  of each beat, then the sound ([sound.md](sound.md#scoring-for-feeling)). The sound kit in
  `studies/sound.html` is the instrument set; the `line-score` skill runs that stage.
- Wordless by default. Any text is drawn as paths, never set in a font.

## Build and inspect

Use the `line-film` skill (`line-still` for a single image). `tools/new-film.mjs` makes a blank
source with the kits, a player that plays the score, and the contract; nothing from earlier films.

From `tools/` (adapt names and times):

```
node new-film.mjs --kind film --duration 30 --out ../films/<name>/index.html
node shoot.mjs ../films/<name>/index.html --range 6.6:6.9:0.0333333333 --sheet
node verify.mjs ../films/<name>/index.html
node render.mjs ../films/<name>/index.html --draft
node render.mjs ../films/<name>/index.html
```

Coarse sheets for pacing; frame-spaced strips at contacts, handoffs and loop points; verify in
Firefox and Chromium; watch the MP4 with sound. Record what was checked and what remains in
`FILM.md`.
