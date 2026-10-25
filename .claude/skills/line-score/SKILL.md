---
name: line-score
description: Scores a line film or reworks its score so the sound sells each beat's feeling. Designs the cue list from FILM.md's beats and feelings, writes buildScore() with the sound kit, gates determinism, length, loudness and sync with tools/audio.mjs, and records results in FILM.md. Use for "score this", "add sound/music/foley", "make it funnier/sadder", "the fall needs a sound", "too loud at 12 s". Not for drawing or motion (line-film) or changing tools/.
---

# Line score

Fill the `SCORE BEGIN` block of `films/<name>/index.html`: `buildScore(s)` places sounds with the
kit, `MARKS` lists the visible events it lands on. The scaffold already renders it once, plays it
in the page and returns it from `renderAudio()`, exactly the film's length at 48 kHz, scaled to
−16 LUFS under −1 dBTP. Commands run in `tools/`.

## Before writing a note

1. Read `FILM.md` for beats, times and the intended feeling of each, and `docs/sound.md`, starting
   with "Scoring for feeling". For a series, read the motif, voices and recurring cues in
   `SERIES.md`; a character's voice comes from the series kit, never re-invented per episode.
2. Spot the film: list every visible event with its time and decide what the music does there:
   lands on it, anticipates it, goes silent before it or rides through. Choose three to five true
   sync points, plus the foley contacts (every landing, peck, splash, step that matters).
3. Read event times from the film's timeline data, never copied numbers, so a retime moves the
   sound with the picture.

## Stages

Each stage ends with `audio.mjs` output (seconds to run), not with reasoning about code.

1. **Skeleton.** `air` or a quiet bed across the film, the hook's first sound inside 0.5 s.
   `node audio.mjs ../films/<name>/index.html --twice` must show the right length and two equal
   renders.
2. **Feeling per beat.** Bed and harmony change with the feeling, not the cut. Bridge shots on
   purpose; a 200 ms hole 10 dB under its surroundings at a cut is a fade-to-silence failure.
3. **Comedy and foley.** Contacts on their frames (`contact`, `drop`, `paper`, `tick`), steps and
   hops mickey-moused where they are funny, a silence of 0.3–0.8 s before each gag. Check each with
   `--around <t> --window 1`: onset within about 40 ms after the mark, never 20 ms before.
4. **Motif and payoff.** The character's motif incomplete early, complete at the payoff; mode and
   instrument follow the mood. Decide the ending: button, tail or hard out.
5. **Mix.** Voices balanced against each other, panned by screen `x`, bass centred; `render` sets
   the level. If the true-peak ceiling pulled the mix under target, fix the peak.

## Gates

After every stage, and once more in Firefox before delivery:

```
node audio.mjs ../films/<name>/index.html --twice --marks <sync points>
node audio.mjs ../films/<name>/index.html --engine firefox --ffmpeg
```

`FAIL` breaks the contract (no `renderAudio()`, wrong length, clipping, renders differing beyond
16-bit jitter). `WARN` is a judgement to resolve or record. Read `out/<name>/_audio.png`.

## Delivery

```
node render.mjs ../films/<name>/index.html
```

Every render carries the score; a range render carries its span. When only the score changed,
`render.mjs --patch` (no range) checks the picture against the cached render and remuxes the new
score in seconds. Listen through every gag, contact and the payoff with the picture. If you cannot
listen, say so, leave perceptual quality unclaimed and name the moments the user should hear.

Record under `## Score` in `FILM.md`: the feeling per beat and what carries it, motif, tempo and
mode, each sync point and its sound, deliberate silences, the measured line (`I −16.0 LUFS, TP
−2.0 dBTP, firefox byte-identical`) and what was heard or that nothing was.
