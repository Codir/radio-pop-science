# Chapter `electronics/resistor` — «Навіщо схемі деталь, яка лише заважає струму?»

Script: `docs/volumes/electronics/chapters/resistor.md` (all reader text from `content/generated/resistor.json`,
captions by position — `__tests__/manifest.test.ts`). World: the volume's bench (`@electronics/shared/**`: the room,
the board, the parts, the hand, the multimeter, the model of the circuit, the magnifier's dive, the resistor's carbon
film inside). First frame: the shot `stand`, three jumpers on the board, the red LED in the tray, the switch open;
last frame: the step's own steep shot (`amp`), the amplifier on the board with the meter in the gap of its jumper J8,
which feeds the 470 Ω.

## Files

| File | What |
| --- | --- |
| `scene.ts` · `chapter.ts` | orchestrator: the stand → seven step modules → `stage.define` + `stepUi.define`; the param `meter` (the multimeter slides in, 0.6 s); the door of `inside` flies home before the next step's shot; the dock's switch toggle follows `bench.closed` |
| `stand.ts` | the step stand of `@electronics/shared/steps` (`createStepStand`): `mountBench` once, the magnifier's door into a part (new on every visit of `inside`) with its lens keeper and the ladder «де ми» (`benchLadder`), the names under the pointer (`naming`, set by each step) |
| `parts/boards.ts` | every step's board as data (`FLASH`, `LIMIT`, `OHM`, `loopWith`, `LAW`, `AMP`), the rows of the goals and their windows (`WINDOWS`) |
| `parts/goals.ts` | how long each goal's state holds (`HOLD`, the script's «Ціль») |
| `@electronics/shared/steps` | shared with `resistor-pick` (shared/README.md, «steps»): rows of sockets and the tally of held readings, what the hand may take in a step and the names it shows (`handPolicy`), the names under the pointer of what a step keeps in place (an invisible twin of the part's `hit`, only where a pointer hovers), a phone's dock (the tray's buttons, the battery's switch), the multimeter's dial switch and readout, the depth slider of `inside` (`depthSlider`) |
| `steps/01-flash.ts` … `07-amp.ts` | the steps |
| `qa/interactions.mjs` · `qa/helpers.mjs` | every goal by real pointer input (mouse or touch), the readers, the closing card; helpers copied from the bench's sandbox (`REUSE.md`) |

## Steps

| Step | Reader does → goal | Notes |
| --- | --- | --- |
| `flash` | the LED from the tray (phone: the dock's «червоний») anode into 9ae, cathode into 10ae, closes the switch (phone: the dock's toggle) → the LED burnt in place with the switch closed, 1 s after | the model gives 0,929 A, burnt on the 4th frame of 1/60 s; the bench's one wisp; no flip (from the tray the LED comes anode to the left) |
| `limit` | the 330 Ω from the tray into the gap 5ae–9ae, closes the switch → LED 21,0 … 21,5 mA, whole, 2 s | a new LED1 every entry (`bench.preset`) |
| `ohm` | «Ω» (dock), probes on the live loop read «—»; R1 whole out of the loop onto free sockets; probes on each resistor's rows → «330,0 Ω», «1,000 kΩ», «4,700 kΩ» each 1 s | the «—» on a live circuit is the bench meter's rule (`BenchModel.powered`, task E3-6, plan E3 decision 5) |
| `inside` | drags «Глибина» to its end (the lens onto R1, the camera through the ring: floor `inside`), switches «Резистор» 330 Ω / 10 kΩ → 1 s with each value down inside | the film (`shared/inside`): turns 3,54 → 6,5, the electrons' speed from the model's current (29 × slower); three callouts at `film.anchor` points; the switch puts a new R1 under the same id (`bench.preset`), the door follows it |
| `law` | three resistors from the tray, one at a time, into the gap → «8,986 mA», «4,497 mA», «2,998 mA» each 1 s | the meter on «A» with its probes put by the step (e9, −9) once it stands in its place; the formula card `I = U / R` (a dock note) with the takeaway |
| `share` | «V» (dock), the probes on the LED, the resistor, the rails → «1,960 V», «7,008 V», «8,968 V» each 1 s | three callouts name the places and go when their reading counted |
| `amp` | (a) «V» on R5 (470 Ω) → 3,926 … 3,936 V 1 s; (b) the amplifier's own J8 out, «A» in its rows → 8,370 … 8,377 mA 1 s and the meter's current R5's and C3's together | the board is `AMPLIFIER_PRESET` as it stands; «Нові деталі» (a dock button) while a part is burnt or bulged puts it back; callout «резистор 470 Ω» over R5 until both halves |

Every step puts its own board on entry with fresh parts (`bench.preset`: what it takes off is forgotten), sets the
switch, the tray, the meter's dial and probes, the hand's policy and the names; a deep link (`?freeze`) lands on that
state, and `flash` starts with no LED and the switch open, so nothing burns before the reader acts.

## Simplified / differs from the script

- **`amp`: the gap is the amplifier's own J8, not a jumper for R5 alone.** The script of E3-3 planned R5's (470 Ω)
  top leg in a free row X and a new jumper from X to `top`, provisional on the layout of `AMPLIFIER_PRESET`. On the
  bench no such place exists: a search (fix round 2 of E3-6) over all 644 layouts of R5 with one leg on its node
  (the supply's 2ae or 5ae, or the top's 6ae), the other in a free row and one jumper from there to the other node
  found none clear of the bodies and legs of C2, C3, D1, D2, Q2, J7 and J8; the three that met one part only stayed
  blocked in all seven places of that part within its own nodes. So the board is the amplifier as it stands, and the
  gap is J8 (`d2` … `d5`), the violet jumper from the supply's row to the row of R5's leg — the script's «його струм
  іде крізь фіолетову перемичку поруч». J8 also feeds the reservoir C3, whose leak (9,4 μA) passes through it: in
  the gap the meter reads 8,373 mA, Ohm's law on R5 gives 3,931 V / 470 Ω = 8,364 mA (0,11 % less). The takeaway says
  «≈ 8,4 mA … майже стільки ж, 8,37 mA» and «Докладніше» says where the 0,009 mA go; the goal's window is the meter's
  8,370 … 8,377 mA. An earlier build (E3-6 before its fix round 2) measured the LED's resistor R1 2,2 kΩ in a gap of
  its own; that took the measurement of `resistor-pick/on` one chapter early (review of E3-6), so the step is back on
  the script's 470 Ω and `resistor-pick/on` keeps R1 to itself.
- **`amp` has its own shot on a desk and a tablet** (`steps/07-amp.ts` `AMP_SHOT`, registered under the name `amp` and
  kept the bench's `phone` on a phone, as the bench re-registers its shots on a resize): the `stand` shot seen steeper,
  ≈ 56° to the table. In `stand` and in the script's `meter` the reservoir's tall can by column 2 stands in front of
  R5's leg in `a2`, the row 2ae and J8's left half; the hand could not take J8 where it shows (review of E3-6, fix
  round 2). The shot has a `fit` for tablets (desktops ignore it): a sphere just around the multimeter with its probes
  at rest, R5's legs, J8's ends and the tray's left slot (`__tests__/shot.test.ts`). Without it the engine cropped the
  shot around its target, and the multimeter was cut by the frame's left edge on 820 × 1180 and out of the frame on
  1180 × 820; with it both tablets frame the step at ×0.85, the multimeter and both probes in view (review of E3-6, fix
  round 3).
- **Names under the pointer of things the step keeps in place** (the script's «назви за наведенням» of jumpers, the
  LED in `limit`, the amplifier's parts, the multimeter): the bench's hand names only what it may take, so the chapter
  adds invisible twins of those parts' `hit` boxes (`shared/steps/names.ts`). Only where a pointer hovers: on a touch
  screen a twin would take the taps meant for a grip beside it; there the names are the dock's and the panel's.
- **Ω on a live circuit shows «—»**: built in the bench's meter (`readMeter` asks `BenchModel.powered`, a small shared
  change with tests, plan E3 decision 5 as the controller ruled), since the merged E2-6 measured with the sources out.
- `inside`: the value switch is in the step (`bench.preset` of the loop with another R1 under the same id), not a
  `parts/value.ts`; the slider's marks are «стенд» and «усередині резистора» only (the script's captions).
- `amp` (b) reads the meter's current against R5's and the reservoir C3's together: with J8 out the meter is all that
  feeds the row 2ae, so that sum is exact, while R5's alone is 0,11 % less.
- `ohm`: the 330 Ω let go off the board (a phone: anywhere off it) would go to a tray the step does not have and be
  gone, the only 330 Ω with it; the step puts it back into the loop (`b5` … `b9`, new and whole: the step's board
  again, the other parts never move), so «330,0 Ω» stays within reach (review of E3-6; the script's «Бачимо» says so).
- `share`: the three callouts step aside while a probe is in the hand — on a phone «світлодіод» has room only below
  the LED, over the sockets of its rows the probe is aimed at.
- `inside`: the callouts' sides are fixed bands that cannot meet on a phone — «вугільна плівка» up, «канавка» left,
  «керамічний стрижень» down; `film.anchor` keeps the film's point a whole strip between the caps and a turn or so
  toward leg 1 from the groove's (`shared/inside/film.ts` `anchorX`).
- The hand (shared): a grip shows only on an end the step lets the hand take (on a touch screen too), and a finger
  leaves no glow on the body it touched (the engine keeps the last touched thing «under» the lifted finger).

## QA

```bash
node app/src/volumes/electronics/chapters/resistor/qa/interactions.mjs --base <url> --out <dir>             # 1280x720
node app/src/volumes/electronics/chapters/resistor/qa/interactions.mjs --base <url> --touch --size 390x844 --out <dir>
```

Frozen clock; starts on `electronics/resistor/flash`; last line `PASS electronics/resistor — <n> checks (<size>)`
(122 checks on a desk, 133 on a phone) or `FAIL … — <k> of <n> checks (…)`, exit 1. Goal snapshots
`<step>-goal-<size>.jpg` in `--out`.
