# Gucky 01: The Last Egg

Three eggs hatch on a quick rhythm; the fourth, speckled one doesn't. When it finally breaks,
Gucky tumbles out wet with the top of his shell stuck on his head. His siblings head off after
Mom, and he learns to walk by copying them, each copy going wrong its sibling's way, until Dot
turns him round and he takes three real steps. In the meadow he catches up and falls into step,
tries Pip's hero step again, topples, loses the line, and a huge rubber boot stamps down in front
of him. A series pilot; read `series/gucky/SERIES.md` first.

Status: draft 4, built from the user's notes on the draft 3 cut (`out/g01-d3.mp4`): "it's not
really noticeable that Mom called them. It just appears they all started walking"; "why is Bean
walking in a completely different direction than everyone else initially?"; "the walk should be
from left to right side of screen"; "Gucky's stumble and difficulties in the beginning is still
confusing and lacking fluidity. Is there any way to add more animal like motion flow?" The user
sent two reference clips (ducklings climbing out of a basket and tumbling over its rim; four
ducklings walking across grass, the camera tracking them) and pointed at procedural animation as
games use it. Cut: `out/g01-d4.mp4`, 42.5 s. Approved and unchanged: everything to Mom's call at
16.6 s, the room and the small orchestra, the motif.

Length: set by the story, not a clock. The approved hatch keeps its inner timing and starts at
11.25 s (`HATCH`).

## Form

Two scenes, vertical 1080×1920 design rendered at 1440×2560, 42.5 s. Everything leaves left to
right: Mom calls from off the right edge.

- Scene 1, the nest (0–30.8 s), one fixed take a little above the ducklings; grass back to a soft
  horizon (y 430) with far bushes and two clouds; no water. The way out is the nest's back rim:
  Pip and Bean get up onto it and walk along its top, behind everyone and drawn smaller (further
  off), and off the right edge. That keeps the middle of the nest clear for Gucky's gags.
- Scene 2, the meadow (30.8–42.5 s), at the ducklings' eye level, side on (horizon y 1215, feet y
  1420), the camera tracking the line walking right, with parallax; it eases to a stop with Gucky.

## Motion, from the references and from game-style procedural animation

- From the walking clip: ducklings walk with the body tipped forward and the head out front, in
  quick short steps, toes curling down as each foot swings forward (rig `curl`, opt-in so the
  model sheet is unchanged); a line of them is loose, bunching and drifting, each in its own step.
  The siblings lean about 0.14 rad into the walk, bob over each stance foot and drift ±12–18 px
  in the line (`gait`, `LOOSE`).
- From the basket clip: a duckling leaving goes up onto the rim, hesitates, peers down with its
  wings out, rocks, then tips over head first. Gucky's exit is exactly that (`teeter`, `tumble`).
- Follow-through (`follow`): the head, cap and wings trail the body, read from the pose a moment
  earlier, so it stays pure in t. Falls speed up like a falling stick, land, bounce and settle
  (`topple`); getting up has a push back and an overshoot. Turns pass through squeezed in-betweens
  (`turning`, rig `narrow`) instead of snapping between views.

## Beats as built

| Time | Picture | Sound |
|---|---|---|
| 0–16.6 s | approved: hook, siblings' hatches, stare, knock, hatch | approved |
| 16.6, 17.0 | Mom calls twice from off the right edge: arcs come in from the edge; everyone jumps (startle strokes) and turns to it, Gucky last, copying them | two clear quacks panned right; a plucked stab and four yelps; a held beat |
| 17.35–19.9 | Pip answers, hops up onto the back rim and struts along it, chest out, knees high, and off the right edge; Bean hops up after him and waddles along it half asleep; Gucky watches Pip pass behind him; Dot hops back to watch Gucky | Pip's peeps; plucks up for each hop; a proud note on each of Pip's footfalls; a sleepy marimba tick-tock for Bean |
| 19.2–20.75 | Gucky copies Pip's march on the spot: chest out, three high steps; the third foot stays up, he wobbles, and the cap's weight tips him onto his tail (a fall that speeds up, bounces and settles) | a two-note fanfare; rising plucks; a bowed note wobbling, then sliding down; a felt plop |
| 20.85–21.7 | Dot giggles; he blinks; he pushes himself up with his wings | giggle peeps; a plink; two notes up |
| 21.95–23.5 | He copies Bean's waddle: rolls onto each foot, each roll bigger, the last swings him round (in-betweens) to face left; dizzy | a marimba tick-tock swinging wider; a swish |
| 23.55–24.55 | Proud, eyes shut, he marches the wrong way and his foot goes into Pip's eggshell; Dot follows him | proud plucks; a clonk and his "oh" |
| 24.85–25.8 | Two clomps in the shell, a look down, a shake: it flies off the left edge | clonks; Dot laughing; a rattle, a whoosh, a clatter off screen |
| 26.05–26.85 | Dot boops his bottom: he jumps and turns round, nose to nose with her; she cheers him on | a high pluck and a soft cork; his "eek"; a harp swish; two peeps |
| 26.9–28.55 | She runs off right; he sets his brow; three careful steps; he looks at his feet; he beams | the motif's first three notes; a glockenspiel "oh"; a sparkle and his happy peep |
| 28.65–30.4 | He runs to the rim and brakes on it; teeters, peering down, rocking; tumbles over it head first, off the right edge | a harp run; a skid; a high note wavering; a run of plucks down; a thump and a happy peep off screen; Mom far off |
| 30.8–42.5 | The meadow, now walking right: as before, mirrored (Gucky scrambles in from the left and skips into step; the high step and the topple; the camera stops; he hurries; the boot, toe to the right, lands on the downbeat; eyes up, head up; the ask) | as before |

Measured: −18.6 LUFS, 2.6 LU under target, true peak −1.0 dBTP at the approved pop (14.37 s);
the shell's first clonk was a new peak and was turned down. `verify --engine chromium` passes;
the MP4 has no held stretch. Looked at: the call, the exits and every gag every 0.2–0.3 s on
sheets and at 1:1, the teeter and tumble, and the meadow every 0.5 s. Not watched at speed or
heard here.

## Assumptions made without asking

- Nest outdoors in grass on the way to the pond; morning light; no other animals.
- The siblings hatch in the order Pip, Dot, Bean.

## Decisions while proving the hard frame

- Mom off screen. A real duck is about five ducklings tall; behind the nest she would be fully in
  frame and needs her own design. Keeping her off screen also sets up the boot (he has never seen
  her) and makes her reveal episode 2's payoff.
- Camera above the ducklings in the nest scene, not at their eye level: everyone reads at about
  290 px. The meadow scene drops to their eye level for the march and the boot.
- The nest is a low mound of loose straw with a raised ring (kit `nest`, `depth: .3, rim: .13`),
  after a flat tray, a deep tub and a basket-like drum each read wrong.
- Hard frame at 15.15 s: Pip nose to nose with wet Gucky ("who are you?"), Bean peeking from
  behind, Dot watching, Gucky's shell behind him.

## The hook and the egg beat as built (0–11.25 s)

| Time | Picture | Sound |
|---|---|---|
| 0–0.25 | four eggs; Pip's (left) already cracking and shivering, then squeezing down | card cracks from the first frame; four pizzicato notes climbing over the squeeze |
| 0.25–1.1 | Pip's top launches high ahead of him, spinning twice, and falls back beside the egg; he rockets straight up after it, stretched thin with eyes shut, hangs at the top in a hero pose (wings up, chest out, a shine burst), drops straight down feet first, lands hard in two puffs of dust, then shakes himself dry in a spray of drops | a card pop and a whoosh; a harp run up; a pizzicato D major chord and a bright peep on the hero pose; a run down; a felt thud and a low note on the landing; a marimba trill and a brush for the shake, water drops; a tink as his top lands |
| 1.05–1.9 | Pip preens: wings up, chest out, looks round for applause, nods | two pizzicato notes on the nod |
| 2.1–3.0 | Dot's lid flips open on its hinge; a small Dot peeks out and looks at Pip, ducks back down shyly, peeks again, turns to look the other way, blinks | soft cracks, a creak and a light tock as the lid lands; a soft pizzicato note on each up, down, up and turn; a glockenspiel plink on each blink |
| 3.0–3.65 | she hops out light, lands soft, shimmies dry with sparkles and a smile | a gentle harp run, a soft landing, high glockenspiel sparkles, a content peep |
| 3.95–5.25 | Bean's egg wobbles, falls over with a thunk; Bean slides out still asleep (z's), sleeps a moment, then dries off in one huge yawn and stretch | marimba tocks on the wobble, a low thunk and pizzicato note, a slide, a plop, a small snore, the yawn |
| 5.55–6.95 | three heads turn to the speckled egg and hold; Pip blinks (6.35) | nothing comes: silence, but for a tiny glockenspiel plink on the blink |
| 6.95–7.4 | Pip and Dot exchange a look; Bean nods off again (6.4–7.4) | |
| 7.4–8.2 | Pip marches up to the egg, chest out | a pizzicato note per footfall, up the scale |
| 8.5, 8.75 | he leans in and knocks twice with his bill | two wood knocks |
| 8.9 | he puts his head to it and listens | silence |
| 9.1 | it leans back and swings into him; over he goes, onto his back at 9.4, legs kicking | a wood bonk, a yelp, a pizzicato run down as he falls, a felt thud and a low pizzicato note; Dot's "oh!" |
| 9.45–10.15 | the egg wobbles to rest | a marimba tock on each swing, dying away; Pip: "hey!" |
| 9.7–10.05 | a zigzag crack runs halfway across; Dot sees it first | a dry crack sweep, a glockenspiel note for Dot |
| 10.2–10.8 | Pip sits up, sees the crack, gets up | two pizzicato notes, up |

Decisions: the user found the first sibling hatches "bland compared to gucky". Now each hatches
in character and comes out wet like Gucky, drying off its own way: Pip the show-off (a launched
top, a rocket straight up, a hero pose, a hard landing, a shake; a somersault was tried first,
and the user preferred something that doesn't echo Gucky's tumble), Dot the watcher (she peeks out and looks around
before she comes out), Bean the sleeper (born asleep, dries in a yawn). Gucky keeps what is only
his: the tumble, the cap that stays on, staying wet. All four unfold from eggs smaller than they
are. Bean's egg now lies on its side behind Bean, hidden by Gucky in the hard frame.

The user also saw "inconsistency with frames around 7 sec": for 0.15 s after getting up (7.15–7.3)
Pip was drawn back at the end of his march (x 468), then snapped to 330. Fixed: he stays at 330.
Pip knocks with his bill from x 468, bending his head more than his body: leaning further tipped
his feet off the ground and pushed his bill into the shell. He lies on his back about x 372 and
stands up where the hatch starts him (330), in the hatch's opening pose.

Measured: the whole score is −16.6 LUFS, true peak −1.0 dBTP at the approved pop (10.72 s); the
0–13.5 s render muxes to −16.4 LUFS with an AAC peak of −0.8 dBFS (fix at the final master). The hook sits about −14 LUFS momentary, under the
pop's −12. Looked at: the hook every other frame (0–3.2), 0–7.5 every 0.25 s, the knock and shove
frame by frame, every frame of 6.7–7.7 (the join), and the 11.5 s hard frame against the approved
one (unchanged).
`verify.mjs --engine chromium` passes; `review.mjs` finds no held stretch. Not heard here.

## The hatch as built (11.25–17.25 s; approved at 7.5–13.5 s, moved whole by `HATCH`)

Every time lives in the film's one timeline, `T`; poses, marks, shots and the score read it.

| Time | Picture | Sound |
|---|---|---|
| 11.25, 11.65, 12.15 | Pip taps his near foot, impatient, slowing | a pizzicato bass note on each tap (D, B, A), lower and softer each time, with a soft foot tap |
| 12.35–12.65 | the egg shivers (flips every frame); Bean sleeps (z's) | a marimba roll on A, growing |
| 12.65 | the pip: a hole and a star of cracks on the zigzag's line, a burst, three chips fly and land; Pip flinches | a card crack, a flick and a high pizzicato plink; each chip ticks where the picture lands it |
| 12.71–13.01 | the bill tip shows in the hole and goes | (silence) |
| 13.15, 13.45, 13.75 | three pushes: the crack runs on, the egg rocks and dips, a small burst at the crack's tip; Pip and Dot lean in | a paper tear, a card knock and a pizzicato note per push, climbing a semitone each (A, B♭, B); tremolo strings swell under all three |
| 13.95–14.25 | the egg presses down and trembles | the strings cut: silence |
| 14.25 | pop: the cap flies spinning, Gucky comes out unfolding (.38 → .98) in a forward flip; Pip leaps back, Dot hops, Bean wakes with a jump; four chips | a card pop and a soft cork, a strummed pizzicato D major chord, a glockenspiel spark; three startled peeps; a harp run up with the cap to its apex and back down as it falls; a soft whoosh |
| 14.69 | he lands, squashes, sways dazed | a felt thud and straw, a low pizzicato D |
| 14.87 | the cap lands on his head: burst, squash, the cap rocks and settles | a wood bonk and a high glockenspiel ting |
| 15.05–15.15 | Pip leans in, bill open: who are you? (the hard frame, at 15.15 since the retime) | Pip's rising peep |
| 15.34–15.8 | Gucky blinks slowly, then looks up and around | warm strings under it all from the landing; a glockenspiel note on the blink and on each look |
| 15.9 | his first peep, small, chin up | Gucky's peep, quiet |
| 16.15 | Pip answers, bossy; Dot's eyes close in a smile | two Pip peeps; Dot's soft coo |
| 16.6 | Mom calls from off screen, left: every head turns | two far quacks (kit `quack`, `far: 1`), panned left |

The room is nearly dry (`ROOM`: wet .06, a 0.5 s tail): outdoors in the open, and the user heard
the kit's default room (a 2.2 s tail with early taps) as echoes on everything.

The user's review of the first version (synth drone, synth chord, woodblock, slide whistle): "a lot
of echoes", "sound effects don't match", the instrumental "is not it". The second version keeps the
same cue points and replaces the instruments with a small orchestra from the kit: pizzicato
(`pizz`), a string section (`strings`, tremolo for tension), marimba (`mallet`), glockenspiel
(`glock`) and harp runs (`pizz`, bright).

Measured (Chromium, `audio.mjs --twice`): −16.5 LUFS integrated, true peak −1.0 dBTP at the pop
(muxed: −16.3 LUFS, −1.1 dBFS), deterministic to 2 LSB (Chromium summation jitter; Firefox is
byte-identical by design, not run here). Each group measured alone: the pizzicato and the pop are
on top (about −21 LUFS momentary), glockenspiel −23, marimba roll −25.5, strings −25.6, Mom's
quack −25.8 (far). The build rises from −21 at the taps to −14 at the last push, falls to −33 in
the silence, and peaks at −12 on the pop. Flagged discontinuities at 9.47 and 9.78 s are the start
of the paper tears (noise grains by design); 10.60 s is the pop.

Not heard here: whether the synthesised strings and pizzicato sound good enough; that is the
user's call on `out/g01-hatch-v2.mp4`.

Looked at: every frame of 8.9–9.4 and 10.5–11.37 as 1:1 crops, sheets of 8.5–10.6 and 11.4–13.5,
the 11.5 s frame against the approved hard frame, the fastest frame of the encoded MP4 at 1:1
(clean at 6.2 Mbps). `verify.mjs --engine chromium` passes. Not done here: watching the clip at
speed (that is the user's review), Firefox (on the user's Mac).

Decisions while building it:

- The pip sits on the zigzag's line, so it splits with the shell at the pop: the cap on his head
  stays as approved (no hole), and the flying cap and the head cap read as one object.
- Gucky is bigger than his egg (as the hard frame has it), so he unfolds from .38 to full size in
  the first 0.2 s of the flip, the cartoon way.
- The flying cap shrinks from the egg's size to the head cap's while it flies, and lands tilted,
  then rocks to the approved tilt.
- Dot only leans in a little: further, her bill dipped into the egg.
- Pip waits at x 330 (knocked back there in the 3–8 s beat) and leaps back to the hard frame's
  165 at the pop.
- Bean sleeps through the pip and the zip, the comic beat, until the pop.

Risks to judge at speed: the forward flip (frames mid-flip are a tumble of spiky shapes; it should
read as a spin in motion), and whether the slide whistle is too cartoony for warm comedy.

## Remaining work

The user's review of `out/g01-d4.mp4` (renders now happen on the user's Mac). Then the final
sound pass (loudness, the AAC peak), Firefox verify, and the post caption ("Part 2 →").
