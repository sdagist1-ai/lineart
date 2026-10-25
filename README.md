# lineart

Line-art animation made with Claude Code: black pen line on warm white paper with the odd spot of
colour, imperfect on purpose, scored to sell the feeling of each moment. Vertical 1080×1920 for
Reels by default, square on request. Every work is a single `index.html` of Canvas 2D and Web
Audio: open it in a browser and press play, or render it to an exact MP4.

## Set up

```
git clone https://github.com/sdagist1-ai/lineart
cd lineart/tools
npm install && npm run setup && npm test
```

Then open Claude Code in the repo root and ask, for example:

- "Make a 30 second film of a paper boat in a rain gutter."
- "Make episode 2 of Gucky."
- "Score this film" or "the fall at 12 s needs to be funnier".

## How it works

- `kit/line.js` draws lines that swell and taper like a nib, drift like a hand, and overrun or miss
  their own start; colour goes down like a marker that misses the line. Lines can "boil" a few
  times a second like drawn animation. Everything is exact for any frame, so the tools can seek,
  check and render it frame-perfect.
- `studies/sound.html` holds the sound kit: synthesised instruments, foley and a seeded room,
  rendered offline so the score is identical every time.
- `tools/` creates works, shoots contact sheets, verifies determinism in Chromium and Firefox, and
  renders MP4s in parallel with the score (drafts, sections and patches in seconds).
- `.claude/` carries the skills (`line-film`, `line-score`, `line-still`), the ink rules and an
  edit hook that catches syntax errors and nondeterminism the moment they are written.
- `series/` holds recurring characters: a series bible and the rig every episode copies.

## Credits

The tooling, the sound kit and the inherited craft docs come from
[riso-windowseat](https://github.com/sevenevesai/riso-windowseat) by sevenevesai (MIT). The line
kit, the vertical frame and this repo's docs and skills are new. MIT, see [LICENSE](LICENSE).
