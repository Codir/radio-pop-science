# Chapter `electronics/prologue` — «Музика з плеєра ледь чути. Що поставити між ним і динаміком?»

Script: `docs/volumes/electronics/chapters/prologue.md` (all reader text from `content/generated/prologue.json`,
captions by position — `__tests__/manifest.test.ts`). World: the volume's bench (`@electronics/shared/**`) with its
speaker in sound: the room, the board with the volume's amplifier (`AMPLIFIER_PRESET`), the hand, the oscilloscope,
the model of the circuit and the model in time, the speaker playing what the model gives it. First frame: the shot
`stand`, the amplifier dark and cold (the switch open), the player's and the speaker's plugs past it, the player
pulsing; last frame: the journey map on a board, the stand pulled back behind it, out of focus (a phone or a tablet:
the map in the sheet's tab «Графіки», the stand as sharp as in every step beside it), the amplifier playing on. Five steps, no new terms
(a prologue).

## Files

| File | What |
| --- | --- |
| `scene.ts` · `chapter.ts` | orchestrator: the stand → five step modules → `stage.define` + `stepUi.define`; the params `meter` (always 0 here) and `scope` (the oscilloscope slides in and out, 0.6 s); the dock's toggle follows the switch |
| `stand.ts` | `mountBench(ctx, { sound: true })` once; a step's board (`board`: cleared, then `bench.preset`; the step's call ends; the first sample of the step's board noted — `live.begun` once `live.starts` has passed the step's mark); the player — its level is the model's setting of `PLAYER` (`playing`, `play`), a tap on its box in `quiet`; the names under the pointer of the player, the speaker and the scope's case (`naming`); the bar's number (`crest`) and whether the sound is off (`soundOff`); the step's call (`call`) |
| `parts/boards.ts` | the boards (`AMP`, `QUIET`), the rows of the goals, the parts the hand may take in `stand` (`TAKE`), the player's level, the knob, the windows and the times of the goals, `riddle`'s rows and the sockets its words stand over |
| `parts/goals.ts` | a row of a socket, a run of time, a tally of states held for a while (copies of `meter`'s), the run of `quiet` with its crest (`createRun`), the visits of `stand` (`createVisits`) |
| `parts/dock.ts` | the bar «Хвиля на динаміку» (`gauge`, linear, 0 … 4 V, two decimals), the step's crest from the first whole chunk of its board (`stepCrest`: `speaker.peak(seconds, from)`), the line «Звук вимкнено…» and when it shows (`soundOff`), the slider «Гучність», the battery's switch as a phone's toggle |
| `parts/policy.ts` | what the hand may take in a step and the names it shows (`HandPolicy`), with `place` and `done` (the shape of `meter`'s) |
| `parts/marks.ts` | where the callouts stand (over a socket, over the board) and the step's call: a `cyan` pulse of glow (VISUAL §6) on a part (`bench.parts.glow`) or on the player's box (its body's materials) |
| `parts/scope.ts` | `riddle`'s scale and display (2,5 V and 5 ms a division, sweeps on channel 1) and its board (the chart, axes named by their units) |
| `parts/shots.ts` | `quiet`'s phone shot (the field, the player and the speaker), `map`'s shot and post by where its board is (`boardOnCanvas`: the desktop shell — pulled back with its depth of field, `MAP_SHOT`, `MAP_POST`; a phone or a tablet, the board in the sheet — the bench's `phone` or `stand` with the bench's own post: `mapShot`, `mapPost`) and its flight |
| `steps/01-quiet.ts` … `05-map.ts` | the steps |
| `qa/interactions.mjs` · `qa/helpers.mjs` | every goal by real pointer input (mouse or touch), the readers, the recalls, the closing card, and a live page: the model in its thread, the sound by a tap; helpers copied from the bench's sandbox (`REUSE.md`) |

## Steps

| Step | Reader does → goal | Notes |
| --- | --- | --- |
| `quiet` | a tap on the player's box → the melody straight on the speaker 3 s, the crest 0,05 … 0,06 V | the plugs `pl+` e16 and `spk+` d16 in the free row 16ae, the commons in 17ae (J1 to the − rail); the switch open (the amplifier dark); the player pulses until the first tap; the bar reads «0,05 V», 1,3 % of its length; the tap is the engine's first gesture (a phone: the chapter's own shot holds the player, a press on the dock would be no gesture) |
| `loud` | the switch closed (a phone: the dock's toggle), «Гучність» to 0,8 or more → 1 s with the battery above 10 mA | the plugs on the amplifier (`pl+` c13, `spk+` c10); the knob at 0,1 on entry; the closing's knock on the bar (3,51 V for a moment, the model's: C2 charging through the speaker); at 0,1 up to 0,30 V, at 0,85 ≈ 1,8 V; «підсилювач» over the board with the takeaway |
| `stand` | the LED «on» out 1,5 s and back; a part without which the speaker fell silent (under 5 mV 1 s) out and back; the board the entry's 1 s after each | fourteen parts whole (not D2, D3, no jumper); only into their own sockets; let go off the board the step puts it straight back (its knob at 0,5); after a first visit the LED, then the knob P1, pulses |
| `riddle` | the scope's probe 2 s in the + rail, the player's row 13ae and the speaker's row 10ae (any order) | the scope slides in (a phone: out of the shot `phone`; the chart in the sheet's «Графіки», where the text sends a phone); 2,5 V and 5 ms a division; «батарейка», «плеєр», «динамік» over `+3`, `e13`, `e10`, each gone once its row is counted; the rail 8,90 … 8,98 V, the player ±0,29 V, the speaker reaching 0,79 … 0,98 V |
| `map` | three stops of the journey map opened (not the prologue's) | `journeyInset` on a board titled «Мапа тому»; on a desk the stand pulled back behind the board, out of focus, the board covering it but a blur at its right edge; on a phone or a tablet the board in the sheet's «Графіки» (the text says so), the stand as sharp as in every step (`phone`, `stand`; the bench's own post); the flight 2,4 s |

Every step puts the amplifier on the board on entry with fresh parts (`bench.preset`: what it takes off is forgotten,
the model in time starts again from the board's operating point), sets the plugs, the switch, the player, the knob,
the hand's policy and the names; a deep link (`?freeze`) lands on that state. The goals read the bench's numbers: the
board as data (plugs, parts, the netlist's key), the model's currents (`BAT`), the speaker's crest (`speaker.peak`) and
the scope's probe.

## Simplified / differs from the script

- **Shared additions (E3-9), small and tested:** the speaker's crest (`Speaker.peak(seconds, start?)`,
  `shared/instruments/speaker.ts`): the largest |I| × 8 Ω of the model's current over the last seconds heard, per
  chunk of 10 ms, with `start` from the first chunk wholly at or after that sample. The script asked for «the same
  blocks that play», and the output's own levels are quantized, held to full scale (5,66 V) and kept per block of
  64 ms: the knock of 6,5 V would read 5,66 V and the window would be off by a block. `__tests__/speaker.test.ts`
  holds the window, a start mid-chunk after a loud board, the silence of a speaker out of the circuit and of the knob
  at 0. And where the board of the model's last start begins (`Live.starts`, `Live.begun`, `shared/model/live.ts`;
  `model/__tests__/live.test.ts`, on the main thread and on a thread whose reply of the board before comes between a
  step's preset and the start).
- **The bar is the step's own**: it counts from the first sample of the step's own board — the first block after the
  model started again with it (`live.begun` once `live.starts` has passed the step's mark: a block of the board
  before that still arrives between the preset and that start moves `live.since`, never `begun`) — and only whole
  chunks of 10 ms from there (`speaker.peak(seconds, from)`): a block is 1536 samples, so four of five boards start
  mid-chunk, and the chunk that holds the last samples of the board before would show its tail for 0,5 s (`loud` at
  0,85 → back to `quiet`: ≈ 1,8 V instead of 0,00 V). `__tests__/goals.test.ts` plays the two boards on the bench's
  speaker.
- **The commons of `quiet` are in the ground row 17ae**, not on the − rail (the script said «у шині «−»»): the
  speaker's lead does not reach the rail (4,1 to the nearest socket, the lead is 4,0); the amplifier's own J1 ties
  17ae to the rail. The script's goal and «Бачимо» say so now.
- **A part let go off the board in `stand` comes back at once**, not in a glide of ≈ 0,4 s: with no tray the bench
  takes it off the board at once (`hands.ts` `toTray`), and the step's `done` puts it back on its own sockets in the
  same frame (`sim/board` `put`; the knob's setting 0,5 again). Let go over the board, the hand's own way back takes it
  (0,28 s). The jumpers are not taken (the script named the sixteen parts only).
- **The call** of the player (`quiet`) and of the LED / the knob (`stand`) is the hand's pulse of glow, `cyan` 0,25 +
  0,12 · sin(2,4 t) (VISUAL §6): on a part through `bench.parts.glow`, on the player through its body's materials
  (`setEmissive`, as the hand's glow does). The bench has no call for a fixed thing, and this needs no shared change.
- **`riddle`'s chart names its axes by their units alone** («V», «ms»): the script gives the prologue no words about
  the instrument (no axis captions), and a unit symbol may stand in code. The words over the rows stand over `+3`,
  `e13`, `e10` (spread so that they do not cover one another in the shot `scope`).
- **`map`'s stand** is pulled back and out of focus only where the board is drawn over the scene — the desktop shell
  (after `circuit/shared/world/away.ts`, REUSE row): there the board (`fill`) covers the stand but a blur at its right
  edge, as in the circuit's prologue, and the script says so. On a phone or a tablet the board is in the sheet's tab
  «Графіки», so the scene beside the sheet keeps the bench's shot (`phone`, a tablet's `stand`) and the bench's own
  post, no blur of the step's (`mapPost` on entry and on a resize: the stage's `post` is fixed at `define`); the text
  tells a phone and
  a tablet where the map is. The flight into `map` takes 2,4 s (1,8 s gave 0,33 a frame on a desk, at the QA's limit
  0,35; a flight to the far shot jumped 0,63 a frame on a phone).
- **No step switches the sheet's tab**: `stepUi` has no way to choose it (`hud.touch.sheet` is the platform's). So
  `riddle` and `map` say in their text where a phone (and for the map, a tablet) finds the board.
- **The knock on closing the switch** (`loud`) shows on the bar (3,51 V, held 0,5 s): the model's (the script's
  «Бачимо»), not smoothed.
- On a touch screen, as with a mouse, a grip shows only on an end the step lets the hand take (the shared hand since
  E3-6, here since the merge of E3-10): the amplifier's jumpers show none where a step takes nothing of the board.

## QA

```bash
node app/src/volumes/electronics/chapters/prologue/qa/interactions.mjs --base <url> --out <dir>             # 1280x720
node app/src/volumes/electronics/chapters/prologue/qa/interactions.mjs --base <url> --touch --size 390x844 --out <dir>
```

Frozen clock; starts on `electronics/prologue/quiet`; then a live page (the real clock, no `?freeze`, no `?noaudio`):
the model in time in its background thread (`mode` `worker`, plan decision 12 of batch E3), the worker's script from
under the base, every request below 400, a tap on the player starting the sound on the audio clock. Last line
`PASS electronics/prologue — <n> checks (<size>)` or `FAIL … — <k> of <n> checks (…)`, exit 1. Goal snapshots
`<step>-goal-<size>.jpg` in `--out`.
