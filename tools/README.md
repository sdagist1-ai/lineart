# tools

Scaffolding, inspection, verification and export harness, carried over from
[riso-windowseat](https://github.com/sevenevesai/riso-windowseat). Every tool drives a work through `window.__film`
and seeks exact frames, so a still is the frame the renderer produces at `t`, not a realtime
sample that may have drifted.

## Setup

```
npm install        # playwright-core, ffmpeg-static
npm run setup      # downloads the Chromium and Firefox builds this playwright-core expects
npm test           # geometry kit, workflow and render self-tests
                   # TEST_ENGINE=chromium npm test where Firefox is not installed
```

Set `FFMPEG=<path>` to use your own ffmpeg; it needs libx264. Playwright's bundled ffmpeg is
webm-only and cannot write MP4. Commands in the docs call `ffmpeg`; without one on PATH,
`node -p "require('ffmpeg-static')"` in `tools/` prints the bundled binary's path.

## The contract

`tools/fixture/index.html` is a minimal working implementation. A work declares its frame near the
top of its source, `<meta name="frame" content="1080x1920@405x720">` (backing store @ CSS size);
without one, tools assume 1080 square shown at 720. `new-film.mjs` writes it.

```js
window.__film = {
  duration,          // seconds
  ready,             // false until pre-rendering finishes, then true
  seek(t),           // render exactly the frame at t, synchronously
  renderAudio(),     // optional: Promise<base64 WAV>, 48 kHz stereo, exactly `duration` long
  marks,             // optional: visible event times for audio.mjs to check sync against
  shots,             // optional: [{id,start,end,readAt,action,transition}] for review.mjs
};
```

`seek(t)` must be pure in `t`: the same `t` twice gives identical pixels, and a cold jump to `t`
matches arriving there by playback. That is what makes a film inspectable and the MP4 exact.

## Tools

| Command | Does | Success signal |
|---|---|---|
| `new-film.mjs --kind film\|still [--format vertical\|square] [--res 1440] [--series name] --out <path>` | Blank work with the line, geometry and sound kits, a player that plays the score, and the contract; `--series` copies `series/<name>/kit.js` in. No inherited art. | Refuses to overwrite existing files. |
| `verify.mjs <html> [--times a,b] [--engine e]` | Repeated seeks and cold jumps give identical pixels in both engines (run at once), across the real duration and shot boundaries; a fresh page drawing the times in reverse must agree, which is the only pass that catches a cache filled by whichever frame was drawn first. | Exit 0. On failure a `DIAGNOSIS` line names per-seek state or the earlier time whose drawing changes the failing one. Time-seeded noise can still pass; inspect adjacent frames. |
| `review.mjs <html> [--mp4 render.mp4 [--from s] [--hold 0.5] [--floor 0.1]]` | Shot sheet and JSON timing report from `__film.shots`, else twelve samples. `--mp4` adds stillness: each shot's median changed area per frame, and every run of at least `--hold` s where frames stay within `--floor` % of the run's first frame (descreened), labelled with the shots' actions. `--from` offsets a range render. | Repeated-transition and stillness notes call for judgement at playback speed, not errors; a slow camera creep passes unflagged. |
| `shoot.mjs <html> --times\|--range\|--around t --window w [--sheet] [--workers n]` | Numbered stills and a labelled contact sheet, drawn by several browsers at once (one per core, at most one per four stills). It never clears `--out`, so give each run its own directory before globbing it. | Read the sheet around every transition. |
| `still.mjs <html> --at t --out x.png` | Native canvas PNG, checked for repeatability. | Prints native dimensions. `--size` on screenshot tools scales capture, not art. |
| `render.mjs <html> [--from a --to b] [--draft] [--patch a:b,c:d] [--workers n] --fps 30 --size 1080 --engine firefox` | Seeks every frame (no dropped or duplicated frames), drawn by `--workers` browsers at once (default: one per core), and muxes `renderAudio()`, cut to the range for a section. `--draft`: 15 fps and a fast encode to `<name>.draft.mp4`, for pace and sync. Video is encoded in 2 s segments kept in `.render-cache/<name>/` beside the output with every frame's hash, so an interrupted render resumes. `--patch a:b` redraws only the segments its ranges touch: it first redraws the middle frame of every other segment and refuses if any changed, then grows past an edge whose frame changed. `--patch` alone redraws nothing and remuxes a new score. | Prints muxed loudness and true peak and how many frames it drew; fails if the MP4's frame count is wrong. |
| `audio.mjs <html> [--twice] [--marks a,b] [--around t --window w] [--ffmpeg]` | Renders the score alone in seconds: WAV, JSON report and sheet (waveform, log spectrogram, BS.1770 loudness, per-mark sync). | No `FAIL` lines; `--twice` proves determinism; `--around` lists every discontinuity in its window. |

Every tool opens works through `lib/browser.mjs`, which aborts any request that is not `file:`,
`data:`, `blob:` or `about:` and reports it as a page error: a deliverable that reaches the
network fails `verify`, `still` and `review`, and warns in `shoot`, `render` and `audio`. A work that
throws before it sets `__film.ready` (a syntax error, a failed bake) stops every tool 5 s after
the error, with the error, instead of after the 3-minute timeout.

Frames are read straight from the canvas (about 80 ms against 530 ms for a screenshot) when, once
per film, viewport and engine, the decoded screenshot matches the canvas pixel for pixel: the canvas
fills the viewport 1:1 with nothing over it. Otherwise, as with `--size` other than the canvas's
own, the tools screenshot. `render.mjs` says when it falls back.

Both browsers draw Canvas 2D in software here (`launch` in `lib/browser.mjs`). On a Mac they draw
it on the GPU by default, and many workers holding large canvases ran graphics memory out: a 1440
render with 16 workers came back with 13 black frames and 8 drawn over black with an earlier frame
showing through. As a second guard, a frame read back with unpainted pixels is drawn again (three
tries); `render.mjs` reports how many it redrew.

Add `--engine firefox` to check the primary browser. Outputs land in `out/` at the repo root.
Run `npm test` after changing anything in `tools/lib/`. No tool certifies artistic quality.
