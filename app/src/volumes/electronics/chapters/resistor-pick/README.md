# Chapter `electronics/resistor-pick` — «Як підібрати резистор?»

Script: `docs/volumes/electronics/chapters/resistor-pick.md` (all reader text from
`content/generated/resistor-pick.json`, captions by position — `__tests__/manifest.test.ts` pins all 52). World: the
volume's bench (`@electronics/shared/**`: the room, the board, the parts, the hand, the multimeter, the model of the
circuit, the magnifier's dive). First frame: the shot `board`, the red LED's loop of `resistor` with its 330 Ω, the
switch open, the slider «Глибина» at «стенд»; last frame: the shot `meter`, the amplifier on the board, the multimeter
on «V» on the LED «on»'s 2,2 kΩ.

## Files

| File | What |
| --- | --- |
| `scene.ts` · `chapter.ts` | orchestrator: the stand → six step modules → `stage.define` + `stepUi.define`; the param `meter` (the multimeter slides in, 0.6 s); the magnifier's door stays open between `bands` and `series` (`DIVE_STEPS`, the rail's end `DIVE_END` 0.75) and flies home before any other step's shot; the dock's switch toggle follows `bench.closed` |
| `stand.ts` | the step stand of `@electronics/shared/steps` (`createStepStand` with `keepDoor`): `mountBench` once, the magnifier's door into a part (one for both dive steps: the door of the step before is kept when it leads into the same part) with its lens keeper and the ladder «де ми» (`benchLadder`), the names under the pointer (`naming`, set by each step) |
| `parts/boards.ts` | every step's board as data (`LOOP`, `loopWith`, `CALC`, `POWER`, `BURN`, `ON` = `AMPLIFIER_PRESET`), the probes the steps put (`METER_PROBES`), the rows of the goals (`ROWS`, `ON_ROWS` — the amplifier's ground and supply through its jumpers, `joinedRows`) and their windows (`WINDOWS`) |
| `parts/bands.ts` | what each band of the 330 Ω says (the table's rows), the 25 values of E24 from 100 Ω to 1 kΩ, the span a value's 5 % allows (`toleranceSpan`) |
| `parts/readouts.ts` | the panel's readouts of the resistor in a gap: |u| with four significant digits, p in watts with three decimals, the state by the model's condition; «—» when there is nothing to read |
| `parts/picker.ts` | a touch on the resistor's body picks the band nearest along it (`bandAt`): an invisible twin of the part's `hit` box with the step's own click (the hand's own target is that box) |
| `parts/marker.ts` | the mark of the band picked last: a small `yellow` cone beside the body, past its upper edge on the screen, its tip toward the band's middle |
| `parts/goals.ts` | how long each goal's state holds (`HOLD`, the script's «Ціль») |
| `@electronics/shared/steps` | shared with `resistor` (shared/README.md, «steps»): rows and the tally of held readings, the hand's policy, the names under the pointer, a phone's dock (the tray's buttons, the battery's switch), the multimeter's dial and readout, the depth slider of `bands` (`depthSlider`) |
| `steps/01-bands.ts` … `06-on.ts` | the steps |
| `qa/interactions.mjs` · `qa/helpers.mjs` | every goal by real pointer input (mouse or touch), the readers, the closing card; helpers copied from the bench's sandbox (`REUSE.md`) |

## Steps

| Step | Reader does → goal | Notes |
| --- | --- | --- |
| `bands` | drags «Глибина» to its end (the lens onto R1, the camera down to the floor `part`), picks the four bands by a touch on the body or by the dock's four buttons → every band picked once on the floor `part` | the table fills in («помаранчева · 3», «коричнева · 1», «золота · 5 %»), the row picked last is lit, the yellow mark points at that band; off the floor `part` the buttons are grey and a touch does nothing |
| `series` | the camera stays on the floor `part` (from `bands`: the same door; a deep link: at once); drags «Номінал» to 100 Ω and 1 kΩ, stops on 360 Ω and 330 Ω → both ends seen, 1 s on each of 330 and 360 Ω (on entry it stands on 330 Ω) | every new value is a new resistor under the id R1 in `b5` … `b9`; «Допуск» «від 313,5 Ω до 346,5 Ω», «від 342 Ω до 378 Ω» |
| `calc` | 330 Ω and 360 Ω from the tray, one at a time, into the gap 5ae–9ae → «21,24 mA» and «19,51 mA» each 1 s, the LED whole | the meter on «A» with its probes put by the step (e10, −10) once it stands in its place; the tray also has 390 and 470 Ω (outside both windows) and the red LED (two resistors side by side burn it in 2,6 … 3,8 s); the formula card `R = (U − U_LED) / I` with the takeaway |
| `power` | keeps the 330 Ω 2 s, swaps it for a 1 kΩ from the tray, 2 s → «21,24 mA · 7,008 V · 0,149 W · теплий» and «7,169 mA · 7,169 V · 0,051 W · холодний» | three readouts of the model for the one resistor in the gap («—» with none or two); the formula card `P = U × I` |
| `burn` | the 100 Ω from the tray between the jumpers' ends (9ae/13ae), closes the switch → it burns (the model's event), 1 s after | «0,786 W · гарячий» at once, burnt on the frame at ≈ 3,83 s, one wisp (the bench's), then «0,000 W · згорів» |
| `on` | «V» (dock), the probes on the LED «on» (5fj and the − rail or a row tied to it) and on its 2,2 kΩ (5ae or 2ae, and 5fj) → «1,750 V» and «6,587 V» each 1 s | the board is `AMPLIFIER_PRESET` as it stands; the dial has no «A»; two callouts, each point on its own part |

Every step puts its own board on entry with fresh parts (`stand.board`: the bench cleared, then `bench.preset`: what it
takes off is forgotten), sets the switch, the tray, the meter's dial and probes, the hand's policy and the names; a deep
link (`?freeze`) lands on that state. `burn` starts with no resistor and the switch open, so nothing burns before the
reader acts.

Measured on the floor `part` at `DIVE_END` 0.75 (the interaction script's probes `dive:end0`, `dive:end1`): at
1280 × 720 the body is 394 px wide (36 % of the 3 : 2 safe frame), a band ≈ 38 px; on a 390 × 844 phone 179 px
(46 %), the zone of the nearest band ≈ 25 px.

## Simplified / differs from the script

- **The mark of the picked band** (the script left it to E3-7): a `yellow` cone beside the resistor, beyond its upper
  edge as the camera sees it, the tip toward the band's middle — it covers no band and is never taken for one. It has a
  faint glow of its own colour (0.35, as the grips' `cyan` has 0.18): in the dark room a plain yellow reads olive, next
  to the gold band.
- **The way back from `series` to `bands`**: the door is kept, and `bands` flies the camera home to its shot
  (`door.home()`): the step starts again, as its slider does (reset to «стенд»). Forward, from `bands` to `series`, the
  camera stays where it is and `series` glides to `DIVE_END` if the reader stopped short of it.
- **`series` without `parts/value.ts`** (the script's «попередньо»): each value puts the step's board again with a new
  R1 of that value (the same mechanism as `resistor/inside`); the door follows the part under the id.
- **`on`: each callout's point on its own part, the tags apart** — on the screen R1 stands just behind LED1, so a
  point over the LED's dome (as in `resistor/share`) lands on R1 in the oblique shot `meter`. The points are on the
  parts' bodies instead: the middle of the part's hit box moved toward the camera by half its thickness (LED1's dome,
  R1's lacquer). «світлодіод „увімкнено“» stands to the left of LED1 — on a phone, where the left has no room, below
  it, between the dome and the − rail, so that it never covers R1 —, «резистор 2,2 kΩ» to the right of R1. Like
  `resistor/share`, both step aside while a probe is in the hand. The interaction script checks that the first part a
  ray from the eye through each point meets is that point's part, and that the LED's tag covers none of R1's body.
- **The band buttons on a phone** are the dock's row of buttons, which a phone's sheet puts at the end of the
  «Керування» tab's scroll: the reader scrolls the panel to them (the interaction script scrolls the control into
  view). A touch on the body works on a phone too (the zone of a band ≈ 25 px).
- **The red LED of the loop on the floor `part`**: in `bands` and `series` the dark LED stands close in front of the
  resistor's leg 1 and fills the right edge of the close-up (on a desk mostly behind the panel). The script keeps the
  loop of `resistor/limit` on the board; the deep-link frame of `series` has two hue families (blue, magenta).
- Names under the pointer of the things a step keeps in place (jumpers, the LED in `calc`/`power`, the amplifier's
  parts in `on`, the multimeter): invisible twins of the parts' `hit` boxes (`shared/steps/names.ts`), desktop (hover)
  only, as in `resistor`.

## QA

```bash
node app/src/volumes/electronics/chapters/resistor-pick/qa/interactions.mjs --base <url> --out <dir>             # 1280x720
node app/src/volumes/electronics/chapters/resistor-pick/qa/interactions.mjs --base <url> --touch --size 390x844 --out <dir>
```

Frozen clock; starts on `electronics/resistor-pick/bands`; last line `PASS electronics/resistor-pick — <n> checks
(<size>)` (127 checks on a desk, 135 on a phone) or `FAIL … — <k> of <n> checks (…)`, exit 1. Goal snapshots
`<step>-goal-<size>.jpg` and the callouts of `on` on entry, `on-entry-<size>.jpg`, in `--out`.
