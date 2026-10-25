# Gucky

A duckling named Gucky lives a human coming of age, from the egg onward: born last, learning to
stand, outwitting his siblings, getting lost, growing up. Wordless, warm comedy, about 30 seconds
an episode, for Instagram Reels. Up to about 200 episodes in seasons; Season 1 first.

Read this before any episode. It overrides repo defaults; the user's words override it.

## Format

| | |
|---|---|
| Frame | vertical, designed at 1080×1920, rendered at 1440×2560 (`--res 1440`), 30 fps |
| Length | about 30 s; let the story set it within 25–35 s |
| Hook | something already happening in frame 0, a question by 3 s, a sound in the first 0.5 s |
| Safe area | eyes and key action in y ≈ 250–1500 of the design frame, off the right 120 px |
| Words | none on screen; the name lives in the caption; any drawn sign or title is paths |
| Ending | the payoff, then a cliffhanger in the last 2–3 s that the next episode opens on (below) |
| Sound | procedural score that sells each beat's feeling ([docs/sound.md](../../docs/sound.md#scoring-for-feeling)), foley on every contact, Gucky's motif |

```
node new-film.mjs --kind film --duration 30 --series gucky --res 1440 --out ../films/gucky-NN-<title>/index.html
```

## The look (approved)

The user approved Gucky as drawn on `stills/gucky-model-sheet` (rendered PNG sha256
`b00996ef71fcaa76266e2d91e198c1e30149bd6a364021edf28620b81634abe3`, Chromium; the approval was
of `0de95049…`, which differed only in a front-view brow bug that drew the worried and determined
faces swapped): a round head on a round
body, softly scalloped fluffy outline, an oval wing, a three-stroke curl tuft, stick legs and small
orange feet, marker-yellow down, an orange bill. A simpler variant (merged head, smooth outline,
stroke wing, big feet) was tried and rejected in favour of this one.

- The rig is `series/gucky/kit.js`. Never change how Gucky or his siblings look without the
  user's sign-off; after any rig change, re-render the model sheet and compare its hash.
- Simplicity with completeness: every stroke earns its place. Add detail to the scene's story,
  not to the character.
- One drawing language for everything. Any new character, animal or prop is built from the
  ducklings' parts and marks: the same outline weights, the softly scalloped edge for anything
  soft, stick legs, rounded orange pads with two toe lines, marker fills that miss the line,
  shells and objects with smooth outlines and ink dots. Draw it on a sheet beside Gucky at the
  same scale before it goes in an episode, and check it against `stills/gucky-model-sheet`.
- Palette: down `SPOT.yellow` (`GUCKY.wet` while wet), bill and feet `SPOT.orange`, shell
  `GUCKY.shell` with ink speckles, nest `SPOT.sand`. Sky and water in `SPOT.sky`/`SPOT.blue`
  when a scene needs them. Colour goes where the eye should.
- Sizes: `s` .3 for a wide shot (still reads: tuft, eye, bill), 1–1.2 for a close shot. The
  sheets show both.

## Cast

| Who | Look | Resting face and posture | Character |
|---|---|---|---|
| Gucky | curl tuft, speckled egg, the shell cap he wears like a helmet | neutral; his character shows in what he does | last to hatch, curious, stubborn, small but finds a way |
| Pip | biggest (1.1), spike tuft, longer bill | chin up, leaning back, a slight determined brow | first at everything, bossy, not mean |
| Dot | sand spot on the head, two-strand tuft | head tilted, soft eyes, looking at something | watches, notices, kind to Gucky |
| Bean | smallest (.86), roundest, no tuft | half asleep, bill a little open, a round slouch | hungry, sleepy, the comic beat |
| Mom | a white Pekin duck; in Season 1 a white belly, short orange legs and big webbed feet seen from duckling height | calm, always there, never in close-up |

The resting look is each duckling's default (`DUCKLINGS[who].rest`); anything a scene passes
overrides it, so all four can still act. Posture reads at sizes where faces don't.

`duckling(g, pose)` draws any of the four: view `side | front | back`, `facing`, `step` (walk
phase from `walkPhase`), `lean`, `waddle`, `squash`, `look`, `blink`, `happy`, `brow`, `bill`,
`wing`, `wet`, `cap`, `headTilt`, `tap` (lifts the near foot: impatience). `egg` (`crack`, `pip`,
`peek` for the bill tip in the pip, `rock`, `squash`, `top`, and `part: 'top'` for a cap in
flight), `nest` (`part: 'back'` before what sits in it, `'front'` after), `momFeet` and the voices
are in the same kit. `stills/gucky-cast-sheet` shows them.

Kit changes since the approval, each re-checked against the model sheet hash (unchanged): Film 1
added `tap`, `egg` `peek`/`squash`/`part`, specks on a lifted cap, and the `quack` voice; an egg's
bottom half now keeps the whole egg's specks (it used to redraw them elsewhere at the opening).

## Voices and motif

- `peep(s, at, { who })`: each duckling has its own pitch; Gucky sits in the middle. `peepRun`
  strings them. Peeps are the dialogue: a question rises, alarm is bright and fast, content is
  soft and low.
- Mom's call (`quack(s, at, { far })`): a nasal waak; `far: 1` while she is up the field. Keep it
  well under the foreground: measured alone, a quack at the same level as a peep is far louder.
- The orchestra: pizzicato (`pizz`), a string section (`strings`, tremolo for tension), marimba
  (`mallet`), glockenspiel (`glock`) and harp runs (bright `pizz`), mickey-mousing the action, in
  D major. Foley on every contact. Outdoors the room is nearly dry (`ROOM`, see episode 1): the
  user heard the kit's default room as echoes. Synth pads, drones and slide whistles were rejected;
  this palette was approved on episode 1's hatch.
- Gucky's motif (`motif(s, at, 'ask' | 'answer')`): plucked, D major. 'ask' (four notes) leaves
  the question open; 'answer' (five) resolves on the octave. State it incomplete when he is
  trying, complete when he gets there. Keep the notes; change instrument and mode with mood.

## Episode shape

Hook (0–3 s) → what Gucky wants → he tries and it goes comically wrong → a turn caused by
something in his world → payoff → cliffhanger. Plant something early that returns changed.

## Cliffhangers

Every episode ends on a question the next one opens on, so a viewer who finished one wants the
next.

- Pay off the episode first. The cliffhanger arrives after the win (about the last 2–3 s); it
  must never cheat the episode's own arc.
- It is something new that interrupts: a thing arrives, falls, appears or is noticed, and Gucky
  reacts (eyes first, then head). Hold the last frame about half a second on his reaction.
- Sound: Gucky's motif 'ask', unresolved, or a short sting; never the resolved 'answer'.
- The next episode's hook picks it up in frame 0, but must still work cold for a new viewer.
- Point to the next part in the post caption (for example "Part 2 →"), not on screen.

## Season map

| Season | Gucky's stage | Ideas |
|---|---|---|
| 1 Hatchling | birth, first days at the nest and pond | below |
| 2 Childhood | learning the pond | school of the pond, a bully, sharing, sick day, first friend |
| 3 Teen | awkward feathers | voice crack (peep → quack), failed first flight, a crush, leaving the pond |
| 4 Adult | independence | migration, his own territory, a partner, building a nest |
| 5 Parent and elder | full circle | his own last egg (episode 1 mirrored, the shell cap passed on), teaching first steps |

### Season 1 (approved)

| # | Title | Premise | Cliffhanger into the next |
|---|---|---|---|
| 1 | The Last Egg | Three siblings hatch; the speckled egg won't. Gucky breaks out wearing his shell cap, wobbles through his first steps and joins the end of the line. | A huge rubber boot stamps down between Gucky and the line. He looks all the way up it. |
| 2 | Who's Mom? | Gucky decides the boot is Mom and follows it until her call turns him round. | Mom slides into the pond and the others follow; Gucky stops at the edge and looks down at the water. |
| 3 | First Swim | Everyone glides; Gucky bobs like a cork, spins, and finds his paddle. | A worm wriggles on the bank; four heads turn at once. |
| 4 | The Worm | Four ducklings, one worm. Pip pulls hardest; Gucky wins by thinking. | The first raindrop hits his cap: *tink*. |
| 5 | Rain | The first rain is huge. Gucky shelters under his shell cap, then under Mom. | The rain stops and a huge shadow slides over the pond. |
| 6 | The Hawk's Shadow | A shadow crosses the pond; everyone freezes but Bean, who is asleep. | A butterfly lands on Gucky's bill. |
| 7 | Lost and Found | Gucky follows the butterfly too far and finds his way back by Mom's call. | Home at dusk, everyone asleep, and Gucky's eyes snap open. |
| 8 | Night | He can't sleep, sneaks out, and meets the stars and a firefly. | At dawn something hops onto his cap: a frog. |
| 9 | First Friend | A frog who jumps when Gucky jumps. | The frog dives; in the still water Gucky sees another duckling looking back. |
| 10 | The Mirror | Gucky meets his reflection and challenges it. | Pip scrapes a start line in the mud with his foot. |
| 11 | The Race | Siblings race to the pond; Gucky is last until he finds the slope. | He wins, dips his head, and his cap floats away on the current. |
| 12 | The Cap | Gucky loses his shell cap; the season ends with him growing past it. | Season 2 tease, to be decided with the user. |

## Continuity log

| Episode | State at the end | Status |
|---|---|---|
| — | Gucky has his shell cap; four hatchlings; Mom seen only from below | design approved |

## References

Viewed for study, never embedded (Wikimedia Commons, via thumbnails in `out/refs/`, not kept):

| File | License | What it settled |
|---|---|---|
| Fuzzy Pekin ducklings.jpg | CC0 | Pekin duckling: round head sitting straight on the body, broad flat bill, small black eyes on the side, visible orange legs, large webbed feet. The approved design keeps its smaller feet on purpose. |
| Mother Muscovy duck with ducklings - 02.jpg | CC BY-SA 4.0 | Ducklings follow Mom in a tight single file, close to her tail. |
| Black skimmer (Rynchops niger) chicks pipping in eggs.jpg | Public domain | A pip is a small star of cracks with a hole, near the top third, flakes lifted. Ducks pip, rest for hours, then "zip" round the shell and push the cap off (from knowledge; no duck hatching photo was found on Commons in this session). |
