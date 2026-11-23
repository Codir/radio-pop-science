# Recon E4 · `capacitor` — «Як запасти заряд і віддати його потім?»

Read-only reconnaissance for the chapter `capacitor` (PATH.md:459-541; six steps, floor `inside`, 10 min,
`volume.json:40`). Trees and their abbreviations, as in `recon-E4/bench.md`:

- `M/` = `/home/pilot/tmp/radio-science-pop/app/src/volumes/electronics/` at `4e6b986` (`resistor`, `resistor-pick`,
  `shared/steps`);
- `C/` = `/home/pilot/tmp/rsp-e2/app/src/volumes/electronics/` at `7ad47b1` plus its uncommitted E3-8 fix (scope,
  `live`, `still`, sound, `meter`).

A file identical in both trees is cited under `M/`. «Derived» numbers are arithmetic from the documented formulas
and the catalog; each says «to confirm by a model run» and names the run (§3.2). The bench gaps shared with other
chapters are numbered as in `recon-E4/bench.md` §12 («bench bug N»).

## 0. Verdict

1. **Three of six steps cannot be built honestly on today's bench.** `store`, `capacity` and `inside` show what
   happens after the switch opens: the LED fed by the capacitor, and the charge on the plates. Everything on the
   bench but the scope and the speaker reads the DC operating point, where a capacitor is open
   (`C/shared/bench/index.ts:471-476`, `:521-530`; `M/shared/dive/door.ts:233-239`). With DC the LED goes dark in
   the frame the switch opens, and the plates empty at once. This is the «конденсатор, що заряджається миттєво»
   anti-goal (design §3.4, spec line 109).
2. **The stream (`live`) is the model in time, but it lags the bench by 0.06–0.25 s.** A board change reaches the
   stream at its last computed moment, up to `PLAN_CAPACITY` 3 blocks of 64 ms ahead of the sample shown
   (`C/shared/sound/plan.ts:30`; `C/shared/model/live.ts:192`, `:212-219`). Driving the LED from stream taps
   (`bench.md` §4.4) would make «без деталі гасне миттєво» a visible 0.1–0.2 s delay. I recommend a frame-locked
   transient for the looks, opt-in per step (§2, item N1; §5, Q1).
3. **The inside of a capacitor is new work.** It needs a `Cutaway` for the kind `capacitor`, a wedge about a vertical
   axis, and `volts` in `InsideState` (bench bug 9; §2, item N2).
4. **`slow`, `time` and `reservoir` are buildable on the merged tree** with small shared additions (scope probe names,
   sound in `createStepStand`, a scope offset for the supply). Every scope number must be re-derived with the
   probe's 1 MΩ (`SCOPE_INPUT`, `C/shared/instruments/scope.ts:73`).
5. **Model surprises the script must absorb:**
   - with the bench's cube-root brightness, the LED fed by 470 μF still glows faintly for tens of seconds;
   - the capacitor keeps about 1.4–1.6 V after the LED stops conducting;
   - with the probe attached, the RC curve reaches 62.8 % of 9 V at R × C, not 63.2 %;
   - PATH's `reservoir` numbers are for the 1 kHz tone, but the bench plays the melody.

   Details in §3.

## 1. Step table

Shared boards (proposals; the builder seats them through `stand.board()`, `M/shared/steps/stand.ts:72-75`):

- **STORE** (`store`, `capacity`, `inside`): `LED_LOOP` (`M/sim/board/presets.ts:112-120`: J1 `+5`→`a5`, R1 330 Ω
  `b5`…`b9`, LED1 `c9`/`c10`, J2 `e10`→`-10`), plus J3 `+12`→`a12` (row 12ae = the + rail) and J4 `e13`→`-13` (row
  13ae = ground). The slot is any line `b`/`c`/`d` of columns 12/13.
  - Plus goes in 12ae, on the left. From the tray a can comes at `o` 0, leg 0 (plus) left (VISUAL §4, table at
    C/VISUAL.md:243).
  - On a phone a radial part can only be carried whole at its 1 P span (C/VISUAL.md:932-935), so the slot must be
    two adjacent columns on one line.
  - With flip off, no placement on this board puts a can the wrong way round. A test should enumerate it, as E3-6
    did for `amp`.
  - The can (470 μF: Ø 0.92, top 1.63 above the board; `M/shared/parts/capacitors.ts:35-42`, `part.ts:36`) stands to
    the right of the LED and hides only rows 12–15 behind it.
- **RC** (`slow`, `time`): the sandbox's `rc` board (`C/_dev/chapters/_sandbox-electronics-bench/scene.ts:207-212`):
  J1 `+3`→`a3`, R1 10 kΩ `b3`…`b7`, C1 100 μF `c7`/`c8` (plus 7ae), J2 `e8`→`-8`. The probe goes in `d7`/`e7`, in
  front of the can.
- **AMP** (`reservoir`): `AMPLIFIER_PRESET` as it stands (`M/sim/board/presets.ts:145-175`). C3 is at `e2`/`f2`
  across the channel (`:148`), fed by J8 `d2`→`d5` (`:170`), with its minus through J9 `j2`→`-2` (`:171`).

| Step (PATH lines) | Reader does on the bench | What moves, glows, draws (model) | «Ціль» predicate (proposal) | Term · formula |
|---|---|---|---|---|
| `store` (:471-480) | Shot `stand`. STORE without a can; the switch is closed and the LED lit (21.235 mA, PATH-ledger.md:376-380). (a) Opens the switch: the LED is dark at once. (b) Takes the 470 μF from the tray (phone: the dock button «470 μF 16 V») into the slot, closes the switch, then opens it. | (a) The LED current is 0 in the frame of opening. (b) The LED fades: 18.1 / 11.3 / 4.5 / 1.03 mA at 0.025 / 0.1 / 0.25 / 0.5 s; brightness `b` = (I/20 mA)^(1/3) (VISUAL §4.4, C/VISUAL.md:342-345) goes 0.97 → 0.83 → 0.61 → 0.37, then 0.18 at 1 s and 0.11 at 2 s (§3.1). Needs the model in time on the bench (N1). | (a) No capacitor on the board; `SW` goes 1→0 and the timed LED current is < 0.1 mA in that frame; counted once. (b) A `electrolytic-470u-16v`, found by kind (the hand's ids are counters: `C1`, `C2`…), has leg 0 in 12ae and leg 1 in 13ae. `SW` was 1 for ≥ 0.2 s, then 0. The LED's timed current stays ≥ 1 mA for ≥ 0.40 s and is < 1 mA by 0.60 s after the opening (model 0.506 s). Nothing bulged. | конденсатор · — |
| `inside` (:481-490) | STORE with C1 470 μF preset in the slot; the switch closed. Lead shot `stand` (or `board`). The dock slider «Глибина» to its end (`depthSlider`, end 1): the lens lies on C1 and the camera dives into the opened can. Then the reader flips the switch with a dock toggle that works inside, on every device. | Two plates and the insulator between them. Electrons (`cyan`) on the minus plate and «+» (`coral`) on the plus plate; their count ∝ the capacitance's volts (`PartMemory.volts`, sim/core README:171). Closing fills the plates within ≈ 1 ms (battery 1.5 Ω + ESR 0.56 Ω, τ ≈ 0.97 ms). Opening drains them with the LED: 2.02 V at 0.5 s, 1.61 V at 1 s, then ≈ 1.4 V that stays (§3.1). Electrons in the legs move at a speed ∝ the current. Needs N1 and N2. | On the floor `inside` (rail ≥ 1 − 1e-3, the view open), both of: (1) `SW` 1 for ≥ 1 s with the can's volts ≥ 8.9 V (model 8.968 V); (2) `SW` 0 for ≥ 1 s after a closing, with the volts ≤ 2.1 V (model 1.61 V at 1 s). A tally of two keys, as in `resistor/inside` (`M/chapters/resistor/steps/04-inside.ts:29`, `:116-117`). | обкладка · — |
| `capacity` (:491-500) | Shot `stand`. STORE without a can; the tray holds 10, 100 and 470 μF, all 16 V. The reader puts each can in the slot in turn, closes the switch and opens it. A panel readout «… після вимикача: N s» shows the time from the opening until the LED falls below 1 mA. | The LED fade per can. Time to 1 mA: 0.011 / 0.108 / 0.506 s (PATH-ledger.md:289-290). Brightness: 10 μF 0.17 at 25 ms and 0.07 at 0.1 s; 100 μF 0.40 at 0.1 s and 0.10 at 0.5 s; 470 μF as in `store`. | Each of the three keys has one opening, with that can alone in the slot, whose measured time is in its window: 10 μF ≤ 0.03 s; 100 μF 0.09…0.13 s; 470 μF 0.45…0.56 s. | ємність, фарад · — (`Q = C × U` in «Д», not new; PATH-ledger.md:156) |
| `slow` (:501-510) | Shot `scope`; the scope slides in (`bench.scope` 1). RC with the switch open and the can empty. Roll at 1 s/div, 2 V/div, ground −3 (0 V one division above the bottom), as the sandbox `rc` (`scene.ts:239`). The reader puts ch1 into 7ae (`d7`/`e7`), then closes the switch (phone: the dock toggle). | The lime curve rises from 0 V: 1.99 V at 0.25 s, 3.53 at 0.5, 5.66 at 1, 7.71 at 2, 8.45 at 3, 8.82 at 5 s. The final value is 8.88 V, because the probe's 1 MΩ and the can's leak take ≈ 1.4 % (§3.1). An optional dashed line at 5.69 V (63 % of 9 V) and a marker at the crossing (S5). | ch1 is in 7ae when `SW` goes 1, armed as in `meter/flat` (`C/chapters/meter/steps/03-flat.ts:105-121`). From that closing the trace crosses 5.69 V between 0.95 and 1.07 s (model 1.010 s) and is ≥ 8.75 V at 5 s (model 8.82 V); the switch stays closed and the probe stays in throughout. | — · — |
| `time` (:511-518) | The RC board. A dock switch «Резистор» (4.7 / 10 / 22 kΩ) re-seats the board with that R1: a new, empty can, the switch open, the roll restarted. This is the pattern of `M/chapters/resistor/steps/04-inside.ts:74-87`. ch1 is put by the step in `e7`. The reader closes the switch each time. A readout gives the 63 % crossing time of each run. | Three curves, one at a time. Final values 8.94 / 8.88 / 8.73 V; 63 % of 9 V (5.69 V) is reached at 0.47 / 1.01 / 2.25 s (§3.1). The formula card `τ = R × C` shows with the takeaway. | For each of the three resistors, a closing followed by the 5.69 V crossing within ±6 % of 0.4725 / 1.010 / 2.250 s. | стала часу · `τ = R × C` («Висновок»; PATH-ledger.md:151) |
| `reservoir` (:519-529) | A shot that shows C3, the probe and the scope face (§4.1). AMP plays: `SW` 1, `PLAYER` 0.3 V, P1 0.5, with sound. The scope sweeps at 0.05 s/div, 0.1 V/div, with an offset so the screen spans 7.9…8.7 V (S6). ch1 is put by the step on the supply: `e5` on R1's top leg, or `d5`, J8's end. The reader lifts C3 out whole, watches, and lets go; it returns to its own sockets. | The supply trace wobbles with the music, more without C3. PATH's 0.07 / 0.29 V (and 0.14 / 0.50 V at 80 %) are numbers for the 1 kHz tone (PATH-ledger.md:262, :300-301); the melody's numbers come from run R-C (§3.2). With the melody, the speaker's crest is the same with and without C3 (0.61…0.99 V, PATH-ledger.md:337-343). | C3 is out of the circuit (in the hand or pending) for ≥ 2 s with the supply's swing (max − min of ch1 over the last 0.5 s, from `trace(0)`) ≥ X. Then C3 is back in `e2`/`f2` (the board's key equals the entry key) and the swing is ≤ Y for ≥ 2 s. X and Y come from run R-C. Nothing burnt. | — · — |

The «Висновок» arithmetic of `time`: 10 kΩ × 100 μF = 10⁴ × 10⁻⁴ = 1 s; 4.7 kΩ × 100 μF = 0.47 s; 22 kΩ × 100 μF =
2.2 s (exact).

## 2. Capability check

### 2.1 Per step

**`store`**
- Board, tray, preset: HAVE.
  - `bench.preset` with `to` jumpers: `M/sim/board/presets.ts:31-35`, `:68-77`.
  - Tray back row: `M/shared/hand/tray.ts:67`. Label «470 μF 16 V»: `tray.ts:76`.
  - Electrolytic footprint, span [1, 3]: `M/sim/board/footprint.ts:52`.
- Hand: whole part, no flip, switch: HAVE through `handPolicy` (`M/shared/steps/policy.ts:24-53`).
  - SMALL: `kindOf` has no `capacitor` for names (`policy.ts:56-61`; bench bug 8).
- Phone dock: tray button and switch toggle, HAVE (`M/shared/steps/dock.ts:14-39`).
- LED light after the switch opens, and the goal's LED current in time: **NEW (N1).**
  - Light comes from `model.reading(id)` of the DC solve: `C/shared/bench/index.ts:471-476`, `:521-530`.
  - The driver only runs `solveDC`: `C/shared/model/driver.ts:268-276`.
- No «теплий» tint on a can at 8.97 V of 16 V (load 0.56 → tint 0.036): SMALL (bench bug 3;
  `M/shared/parts/look.ts:59-63`, `:100-117`).

**`inside`**
- Door, keeper, ladder, «Глибина»: HAVE (`M/shared/steps/stand.ts:77-90`; `M/shared/steps/depth.ts:39`;
  `M/shared/dive/door.ts`).
- An inner view for the kind `capacitor`: **NEW (N2).** `CUTAWAYS` holds only `resistor`
  (`M/shared/dive/cutaway.ts:14-16`).
- A wedge about the can's vertical axis: SMALL.
  - `createWedge` cuts about the body's x at `axisY` (`M/shared/inside/wedge.ts:145-149`). That fits an axial
    resistor, not an upright can.
  - Its `faceGeometry` (`:80-111`) is reusable with a rotated frame.
- `InsideState.volts`: SMALL.
  - Today `InsideState` is `{ amps, heat, burnt }` (`M/shared/inside/wedge.ts:27-33`).
  - The door feeds it from DC (`M/shared/dive/door.ts:233-239`). It must feed from N1.
- A switch control on the floor `inside`: chapter-level.
  - The shared toggle is phone-only and disabled while `bench.flying` (`M/shared/steps/dock.ts:36-37`).
  - The 3D slider is off too while flying (`C/shared/bench/index.ts:448`).
  - The camera at rest inside still counts as flying (`M/shared/dive/door.ts:240-244`).
  - The step needs its own toggle writing `bench.closed`, as `resistor/inside` wrote its own segmented control
    (`04-inside.ts:76-87`). `bench.closed` reaches the model whatever `flying` is.
- Callouts on the plates and the insulator: part of N2 (`anchor(name, out)` as `film.anchor`, `M/shared/inside/film.ts`).

**`capacity`**
- Three electrolytics in the tray's back row: HAVE (≤ 6 per row, `M/shared/hand/tray.ts`; bench.md §10).
- LED fade, measured time: NEW (N1). The time to 1 mA should be sub-frame: 11 ms is under one frame of 1/60 s, so N1
  should report the crossing moment from its own steps (S8).
- Readout: HAVE (a `readout` control, chapter-level).

**`slow`**
- RC board: HAVE (template above).
- Scope slide-in, roll, `configure`, `put`, `chart`: HAVE.
  - `C/shared/instruments/scope.ts:97-108`. Roll: `scope-model.ts:474`.
  - `meter/flat` is the pattern: `C/chapters/meter/parts/scope.ts:14`, `steps/03-flat.ts`.
- The probe's 1 MΩ load: HAVE, by design (`C/shared/instruments/scope.ts:73`).
- Scope probes in the shared policy and names: SMALL.
  - `take` lets every `probe:*` through (`M/shared/steps/policy.ts:37`), but names them red or black (`:49`).
  - The scope words and chart helpers are still chapter-local in `meter` (`C/chapters/meter/parts/scope.ts:39-85`).
  - Lift both into `shared/steps` (bench bug 8; bench.md §11).
- Goal from the roll trace: HAVE (`oscilloscope.model.trace(0)`, `C/shared/instruments/scope-model.ts:553`; the
  helper `newest`, `C/chapters/meter/steps/03-flat.ts:24-33`).
- 63 % level line and crossing marker on the chart: SMALL, optional (S5). `ScopeModel.chart` draws two series and
  nothing else (`scope-model.ts:567-614`). The platform's `ChartApi.setMarker` and dashed series exist
  (`docs/UI_API.md:303-318`).
- Sound: not needed. Without `sound` the stream runs only while `bench.scope > 0`
  (`C/shared/bench/index.ts:576`).

**`time`**
- Resistors `resistor-4k7`, `resistor-10k`, `resistor-22k`: HAVE (E24, `M/sim/core/parts.ts:770` `resistorKey`).
- A value switch that re-seats the board: HAVE (pattern `04-inside.ts:74-87`).
  - A re-seat restarts the stream and clears the roll (`C/shared/bench/index.ts:624-634`, `onRestart` at `:387`).
  - The new can is empty, so each run starts from 0 V.
- Discharge by hand between runs (alternative): SMALL.
  - With the switch open the + rail floats, and the can only drains through its leak ∥ the probe: τ ≈ 100 μF ×
    0.72 MΩ ≈ 72 s (derived).
  - A step button that bridges the can with 1 kΩ for 0.5 s would be honest (§5, Q3).
- Formula card: HAVE (`resistor/law` puts `I = U / R` as a dock note; `M/chapters/resistor/README.md:30`).

**`reservoir`**
- AMP board, sound, player: SMALL.
  - `createStepStand` mounts without `sound` (`M/shared/steps/stand.ts:58`).
  - The player's level is the `PLAYER` setting (`C/chapters/meter/stand.ts:59-62`).
  - Lift both into `shared/steps` (bench bug 7).
- C3 out by the hand and back into its own sockets only: SMALL.
  - `HandPolicy.place` exists (`M/shared/hand/hands.ts:124`), but the shared `handPolicy` has no `place` rule
    (`M/shared/steps/policy.ts:9-22`, `:30-52`).
  - The prologue needs the same rule (prologue.md:159-165).
- The stream follows C3 out and back without a restart: HAVE (`C/shared/model/live.ts:212-219`: a new solve hands
  the board over at the stream's last moment).
- A held page's window: HAVE (`C/shared/bench/index.ts:597-616`, sweep only). Its warm-up is a half bar, 1 s
  (`C/shared/model/driver.ts:189-198`).
- A scope offset to show ±0.15 V around 8.3 V: SMALL (S6).
  - `ground` is documented as −4…4 divisions (`C/shared/instruments/scope-model.ts:58`).
  - `axes()` already builds ticks for any `ground` (`:622-640`).
  - Need a test and a VISUAL §5.2 line («зсув»), and a check that the instrument's screen clips.
- Swing readout: HAVE. min/max of `trace(0)` is chapter-level. `peak()` gives |v| only (`scope-model.ts:364`).
- Speed on a phone: an owner decision (bench bug 12; amplifier 0.6–0.9× real time).

### 2.2 Shared work this chapter needs (for E4-0 / E4-S)

| # | Size | What | Where |
|---|---|---|---|
| N1 | NEW | **The board in time for the bench's looks, frame-locked**, opt-in (`bench.timed = true` per step). Details below the table. | `C/shared/model/driver.ts`; `C/shared/bench/index.ts:471-476`, `:521-530`, `:572`; `M/shared/dive/door.ts:233-239` |
| N2 | NEW | **The inside of an electrolytic** (`shared/inside/plates.ts`, registered as `CUTAWAYS.capacitor` by dielectric). Details below the table. | `M/shared/dive/cutaway.ts:14-16`; `M/shared/inside/` |
| S1 | SMALL | `createStepStand(ctx, { keepDoor, sound })`; the player's `play` / `playing` lifted from `meter` | `M/shared/steps/stand.ts:57-58`; `C/chapters/meter/stand.ts:49-62` |
| S2 | SMALL | `handPolicy`: scope probe names (`ch1`, `ch2`), a `place` rule, `kindOf` for `capacitor` | `M/shared/steps/policy.ts:9-61` |
| S3 | SMALL | The wedge about a vertical axis (an `axis: 'x' \| 'y'` option) | `M/shared/inside/wedge.ts:145-215` |
| S4 | SMALL | `InsideState.volts` (and `bulged`, for `capacitor-kinds`) | `M/shared/inside/wedge.ts:27-33`; `door.ts:236-238` |
| S5 | SMALL, optional | Scope chart: a dashed level line and a marker (`ChartApi.setMarker`) | `C/shared/instruments/scope-model.ts:567-614` |
| S6 | SMALL | Scope offset: `ground` beyond ±4 documented and tested (0.1 V/div, `ground` −83 → 7.9…8.7 V) | `C/shared/instruments/scope-model.ts:58`, `:622-640`; VISUAL §5.2 |
| S7 | SMALL | No heat tint on a capacitor at «warm» (bench bug 3) | `M/shared/parts/look.ts:59-63` |
| S8 | SMALL (part of N1) | A threshold watch: the model moment a part's current crosses a level, from N1's own steps (11 ms < one frame) | N1 |

N1 in detail:
- Each frame a `Transient` (`M/sim/core` README:604-697) steps over the frame's `dt` at a fixed model step.
  - 1/4800 s gives 80 steps a frame at 60 fps. Use 1/24000 s if a test against `led-discharge.json` needs it.
- `set` on a setting change; `rebuild` on a new shape, which carries the charges by id (README:644). `start('dc')` on
  a step's preset.
- `reading`, `nodeVolts`, `part`, the LED light, the meter's V and the door's `volts` come from its last moment.
- Heat and bulge come from its own steps.
- Held frames (`dt` 0) do not move it.
- The stream stays as it is, for the scope and the speaker.

N2 in detail:
- The can opened by a vertical wedge on the camera's side.
- Two plates and an insulator slab. Charges are orbs without glow: `cyan` electrons on the minus plate, `coral` «+»
  on the plus plate, their count ∝ `volts`. Electrons in the legs move at a speed ∝ the current.
- `anchor('plus' | 'minus' | 'insulator')`, `state()` for `electronics-dive`.
- ≤ 6 inside draw calls.
- A VISUAL §7 entry first.

## 3. Model numbers

### 3.1 Numbers the script needs

Status: **еталон** = ngspice fixture; **модель** = ledger or README model run; **derived** = arithmetic here, to
confirm by the named run (§3.2).

| # | Number | Value | Source | Status |
|---|---|---|---|---|
| 1 | LED loop with 330 Ω, switch closed | LED 21.235 mA, 1.9605 V; resistor 7.0076 V; rails 8.9681 V | PATH-ledger.md:376-380 (E3-3 run) | модель |
| 2 | 470 μF from an ideal 9.0 V into 330 Ω + red LED | 18.2 / 11.4 / 4.5 / 1.0 mA at 0.025 / 0.1 / 0.25 / 0.5 s | `M/sim/core/__fixtures__/led-discharge.json`; PATH-ledger.md:255 | еталон |
| 3 | The same from the bench's rail (8.968 V) | 18.12 / 11.33 / 4.48 / 1.03 mA; < 1 mA at 0.506 s | derived: Euler integration of the catalog's red LED (IS 8.66e-18, N 2, RS 6 Ω; `M/sim/core/parts.ts:734`), ESR 0.5644 Ω, leak 886.9 kΩ (README:446). It reproduces row 2 to 0.1 mA and row 4 to 1 ms. | to confirm, R-A |
| 4 | Time to < 1 mA: 10 / 100 / 470 μF | 0.0113 / 0.108 / 0.506 s (ledger rounds: 11 ms / 0.11 / 0.51 s) | PATH-ledger.md:289-290 | модель; bench board, R-A |
| 5 | LED brightness `b(t)` after opening, `b` = min(1, (I / 20 mA)^(1/3)) | 470 μF: 0.97 (25 ms), 0.83 (0.1 s), 0.61 (0.25), 0.37 (0.5), 0.18 (1), 0.11 (2), 0.047 (10), 0.025 (30 s); `b` < 0.02 (dark) at ≈ 45 s. 100 μF: 0.40 (0.1), 0.10 (0.5), 0.025 (10 s); dark at ≈ 25 s. 10 μF: 0.17 (25 ms), 0.07 (0.1 s), 0.02 at ≈ 2 s | derived (rows 3–4 with C/VISUAL.md:342-345) | to confirm, R-A |
| 6 | The capacitance's volts after opening (470 μF) | 8.968 → 2.02 (0.5 s), 1.61 (1 s), 1.49 (2 s), 1.41 (5 s), 1.36 V (10 s). About 16 % of the charge stays: the LED stops conducting below ≈ 1.5 V | derived | to confirm, R-A (`t.memory('C1').volts`) |
| 7 | Closing onto an empty 470 μF | ≈ 9 / (1.5 + 0.56) ≈ 4.4 A for ≈ 1 ms (τ ≈ 470 μF × 2.06 Ω ≈ 0.97 ms); the rail dips for under a frame | derived | to confirm, R-A; nothing burns (battery heat τ 2 s) |
| 8 | A can's state at 8.97 V | load 8.97 / 16 = 0.56 → «warm» (by voltage) | README:45-46; PATH-ledger.md:172 | модель; never shown as warmth (S7) |
| 9 | `Q = C × U` («Д» of `capacity`) | 10 / 100 / 470 μF × 8.97 V = 0.090 / 0.90 / 4.2 mC | arithmetic | the volume's units have no coulomb (PATH.md:59): keep it a relation, with no number |
| 10 | RC, 10 kΩ / 100 μF, no probe | 1.99 / 3.54 / 5.68 / 7.76 / 8.52 / 8.91 V at 0.25 / 0.5 / 1 / 2 / 3 / 5 s; 63.10 % at R × C | `rc-charge.json`; README:460-461 | еталон (not what the bench shows) |
| 11 | The same with the scope's 1 MΩ on the can | 1.99 / 3.53 / 5.66 / 7.71 / 8.45 / 8.82 V; final 8.877 V; τ_eff 0.987 s; 62.84 % of 9 V at 1 s | derived (Thévenin: the battery's 1.5 Ω, the leak 2.581 MΩ ∥ the probe 1 MΩ, ESR 2.653 Ω). E3-8 measured 5.6557 V = 62.842 % (`.superpowers/sdd/2026-11-20-electronics/task-E3-8-report.md:97`) | derived; matches E3-8 |
| 12 | 63 % of 9 V (5.688 V) reached, with the probe, for 4.7 / 10 / 22 kΩ | 0.4725 / 1.010 / 2.250 s (63.2 % of the final value: 0.467 / 0.987 / 2.135 s; without the probe: 0.471 / 1.003 / 2.213 s) | derived | to confirm, R-B |
| 13 | «Дві третини» (6 V), with the probe | 0.520 / 1.112 / 2.480 s | derived | to confirm, R-B; see Q5 |
| 14 | Final values with the probe | 8.942 / 8.877 / 8.733 V for 4.7 / 10 / 22 kΩ | derived | to confirm, R-B |
| 15 | `τ = R × C` | 0.47 / 1 / 2.2 s | arithmetic | exact |
| 16 | Discharge of 100 μF from 9 V through 10 kΩ | 3.30 V at 1 s | `rc-discharge.json`; PATH-ledger.md:254 | еталон; the bench does not show it unless a discharge path is added (Q3) |
| 17 | The amplifier at rest | supply 8.337 V; C3 8.34 V; battery 13.31 mA; C3's leak 9.4 μA | `amplifier-op.json`; PATH-ledger.md:260, :390 | еталон / модель |
| 18 | Supply swing, tone 1 kHz, 50 % | 74 mV with C3 (еталон); 0.29 V without; 80 %: 0.14 / 0.50 V; THD 1.5 → 2.8 % | PATH-ledger.md:262, :300-301; README:893, :897 | tone, not the bench's melody |
| 19 | Supply swing with the melody, with and without C3, at 50 % (and 80 %) | unknown | — | **run R-C**; source of «вчетверо» and of X/Y |
| 20 | The speaker with the melody, without C3 | 0.61…0.99 V crest, the same as the whole circuit | PATH-ledger.md:337-343 | модель: no audible level change |

### 3.2 Runs that confirm them

All three runs use `sim/core` with the bench's own netlist: `presetState(layout, preset)` →
`netlistOf(layout, state, BENCH_FIXED, extra)` (`M/sim/board/presets.ts:90-94`, `M/sim/board/netlist.ts:29-35`,
`:54-59`). The switch is the fixed part `SW` (open below 0.5). Sample at 24 000 a second, as the ledger preamble does
(PATH-ledger.md:268-273).

- **R-A** (`store`, `capacity`, `inside`):
  - Board: STORE plus the can in `c12`, `SW` 1.
  - `new Transient(net, { dt: 1/24000 })`, `start('dc')`, then `set('SW', 0)`.
  - `run` 1 s with `{ part: 'LED1' }` and the can's node; `memory(id).volts` at 0.5 / 1 / 2 / 5 / 10 s.
  - Thresholds: 1 mA, 20 μA (`b` 0.1), 0.16 μA (`b` 0.02).
  - Repeat for 10, 100 and 470 μF. Also run the closing onto an empty can (`start('dc')` with `SW` 0, then
    `set('SW', 1)`).
  - Then the same at N1's own step (1/4800 s) against these numbers.
- **R-B** (`slow`, `time`):
  - Board: RC plus `extra` `{ id: 'SCOPE1', spec: SCOPE_INPUT.spec, pins: [node(7ae), 0] }`
    (`C/shared/instruments/scope.ts:73`).
  - `start('dc')` with `SW` 0, `set('SW', 1)`, `run` 12 s on node 7ae.
  - Read the samples at 0.25 / 0.5 / 1 / 2 / 3 / 5 s, the crossings of 5.688 V and 6 V, and the final value.
  - Repeat with R1 4.7 kΩ and 22 kΩ.
- **R-C** (`reservoir`):
  - Board: AMP with `PLAYER` 0.3, P1 0.5 (and 0.8), `SW` 1, plus `SCOPE1` on 5ae.
  - `start('dc')`, `run` 8 s (one loop of the melody), node 5ae.
  - `rebuild` without C3, `run` 8 s; `rebuild` with C3, `run` 8 s.
  - Report max − min over every 0.5 s window (the minimum, median and maximum over the loop) for each phase.
  - Check: nothing burns or bulges; the step at the moment C3 leaves or returns (the speaker's crest).

## 4. Risks

### 4.1 Camera framing (tall cans hide rows)

The cans are ≈ 4–5 P tall: 470 μF tops at 1.63 above the board, 100 μF and 10 μF at 1.57 (`capacitors.ts:35-42`
× `MM` 3/26). They hide what lies behind them:
- ≈ 1.14 units (≈ 3.8 P) on `stand`, at ≈ 55° to the base;
- ≈ 1.27 units (≈ 4.2 P) on `scope`, at ≈ 52°;
- ≈ 0.6 units (≈ 2 P) on `phone`, at ≈ 70°.

This bit E3:
- C3 hid J10 and `+1`…`+3` on `meter/amps` (`C/chapters/meter/parts/shots.ts:8-16`);
- C3 hid R5's leg and J8 on `resistor/amp` (`M/chapters/resistor/steps/07-amp.ts:42-58`).

Per board:
- **STORE:** the slot at columns 12/13, right of the LED, keeps the LED and R1 clear. What the can hides — rows
  12–15 behind it and J3's end — the reader never needs. The test must hold that no body overlaps:
  - a can at `c5`/`c6` would sit over R1's body (`b5`…`b9`, top 0.325 > the can's bottom 0.3);
  - the 470 μF's radius of 0.46 reaches to z −1.36.
- **RC:** the probe socket must be in front of the can (`d7`/`e7` when the can stands on line c). On `scope`, sockets
  `a7`/`b7` lie behind it.
- **AMP (`reservoir`):**
  - The supply's free sockets in 2ae (`b2`, `c2`) lie behind C3 from `scope`. A sight line from the `scope` camera to
    `c2` passes ≈ 0.28 from C3's axis at ≈ 0.8 above the board, under C3's top at 1.63 (derived).
  - So the step puts ch1 on `e5` (R1's top leg) or `d5` (J8's end); a probe may stand on a leg
    (`C/shared/README.md:454-459`).
  - Then decide the shot. `scope` sees C3 at the far left. A chapter shot with a `fit` sphere around C3, the probe
    and the scope's face (the `AMP_SHOT` pattern, `07-amp.ts:52-58`) would be safer. Add a sight-line test like
    `C/chapters/meter/__tests__/shot.test.ts`.
- **Inside:** the door frames the can by its `hit` box (`PART_VIEW.inside` 0.85, C/VISUAL.md:667). The can's height
  (1.33) is its largest size, so the plates stand tall and narrow in a wide frame. Check on 1280 × 720 and a phone.

### 4.2 Phone layout

- **Slot geometry.** Radial parts are carried whole at a 1 P span, at `o` 0 from the dock or flipped
  (C/VISUAL.md:932-935). So the slot is two adjacent columns, plus on the left, as the LED in `resistor/flash`.
- **The switch.**
  - `store` and `capacity` need the dock toggle (`M/shared/steps/dock.ts:30-39`).
  - `inside` needs a toggle visible on every device that works while the camera is inside (§2.1).
- **Two tabs in `slow` and `time`.** The chart is in the tab «Графіки» and the toggle in «Керування»
  (C/VISUAL.md:941-943; `C/shared/README.md:522-523`). The reader closes the switch, then switches tab. The curve
  takes 1–5 s, so the order still works. Say it in a hint, or put the toggle in the step's `board` beside the chart.
- **`capacity` panel.** Three tray buttons, the switch toggle and the readout must show at the default sheet height
  on 390 × 844, readouts first (lessons.md §2.5).
- **`reservoir`.** Holding C3 with a finger while the chart is in the panel works, but the chart tab must be opened
  first. A dock toggle «Конденсатор-запас» is the phone fallback (Q6).
- **Callouts inside:** ≤ 3, on fixed sides that never meet on 360 px (the lesson of `resistor/inside`,
  `M/chapters/resistor/README.md:77-79`).

### 4.3 Frozen (`?freeze`) shots of time-domain traces

`chapter-check` takes each step's deep link at `--freeze 3` (`tools/qa/chapter-check.mjs:94`, `:177`): 3 s from the
entry, then held.
- **`slow`.** The switch is open and ch1 at rest, so the channel is off and the chart empty. The «Бачимо» first
  sentence must fit that frame (the scope and the RC board), not the curve.
- **`time`.** ch1 is put by the step: a flat 0 V line, one division above the bottom (ground −3).
- **Held pages hold sweeps only.** `held()` returns for a roll (`C/shared/bench/index.ts:602`), and `still` always
  starts from `'dc'` (`C/shared/model/driver.ts:436`). A held window of a charging curve would need `still` from an
  event, which is out of scope. Recommend: accept the flat frame.
- **`reservoir`.** Sweep plus `still` gives a 1 s warm-up and a window of the supply with the melody. That is
  deterministic and hashable. If C3 is in the hand, the window is without C3.
- **`store`, `capacity`, `inside`.** Frozen frames show the entry state: LED lit, plates full. N1 must start from
  `'dc'` on a preset and not move on `dt` 0.
- **QA goal shots** (`qa/interactions.mjs`, frames of 1/60 s through `__app.step`;
  `M/chapters/resistor/qa/helpers.mjs:9-11`).
  - `advance` adds 10 frames (0.167 s) after every wait, so a fade check must count them.
  - Take the `store` and `capacity` goal shots inside the fade, by 0.25 s, or the LED is only an ember.

### 4.4 Hue families (≤ 4; `tools/qa/lib.mjs:214-245`, 60° bins centred on red, yellow, green, cyan, blue, magenta)

| Step | Families | Note |
|---|---|---|
| `store`, `capacity` | blue (room, base, violet jumpers), cyan (grips, panel), red (LED dome, halo, light; coral `+` stripe and wire) | 3 |
| `inside` | blue, cyan (electrons, the rim's arcs), red (`coral` «+» charges) | 3. Amber field lines (the source's `SEMANTIC.fieldE`, `electricity/…/capacitor.ts:64-77`) would add yellow, making 4 at the limit. Recommend none, or `mist` lines. |
| `slow`, `time` | blue, cyan, yellow (ch1 `lime`) | 3; one channel only |
| `reservoir` | blue, cyan, red (LED «on» at 3 mA, `b` ≈ 0.53), yellow (`lime`) | 4. A second channel (`magenta`) makes 5: keep one channel. |

### 4.5 Draw calls (≤ 350; empty board ≤ 200; C/VISUAL.md:983)

- Each part costs ≤ 6. An electrolytic costs 4: sleeve, top, legs, print (`capacitors.ts:14-15`).
- STORE adds about 30 to the bench. The scope adds its screen and ribbons.
- The inside (N2) adds ≤ 6:
  - plates and insulator in 1–2 meshes;
  - one face mesh;
  - two instanced charge sets;
  - leg electrons.

  The whole opened part is ≈ 10, as the film's 8 (`M/shared/README.md:469-473`).
- The amplifier with the scope was already measured in `meter`; nothing new there.

### 4.6 The inside view: what it shows and what to copy

**What it shows (VISUAL §7 needs an entry first; bench.md §9.3):**
- PATH «Д» (:488-490) allows two plates: the real foil roll is told in words.
- The can opens by a vertical wedge (S3) on the camera's side.
- Inside: two vertical aluminium plates (`steel`, the `metal` slot) facing each other across the legs' axis, plus over
  leg 0 and minus under the stripe. Between them, a thin insulator slab in `mist` through `sheath()`. Not `K.glass`:
  VISUAL warns it glows in the dark (C/VISUAL.md:327).
- Charges:
  - electrons (`cyan`, the library's orb without glow, as the film's, `M/shared/inside/film.ts:453`) on the inner
    face of the minus plate;
  - `coral` «+» on the plus plate;
  - the count is `round(N × volts / 9)` from N1's `volts`. Do not use the terminal `u`, which includes the ESR drop.
- Electrons in the legs drift at a speed ∝ the current (as `electronSpeed`), out of the minus plate while it
  discharges.
- No halos and no field glow. VISUAL §1.5 allows glow only from LEDs and the lamp (C/VISUAL.md:44-50).

**What can be copied, with the REUSE row at `docs/volumes/electronics/REUSE.md:40`** (planned E4: «конденсатор
усередині» from `electricity/chapters/charge-field/parts/capacitor`):
- `app/src/volumes/electricity/chapters/charge-field/parts/capacitor.ts`:
  - the plate meshes (`:53-59`);
  - the charge orbs (`:78-86`: `createOrbs` kind `ion` with `plus` / `minus` glyphs, colours `SEMANTIC.proton` and
    `electron` = `coral` and `cyan`);
  - the placement maths (`:171-187`).
- Not to copy:
  - the halos (`:62-63`, `:110-123`);
  - the amber `RibbonLines` field at intensity 1.35 (`:64-77`);
  - the `K.glass` dielectric block and its molecules (`:88-125`).
- `cap-circuit.ts:126`: `createFlow` for wire electrons. The bench already has the film's electron drift; prefer that.
- The REUSE row becomes «зроблено» (placement maths copied) or «без копії» (rebuilt), file by file in «Копії».

### 4.7 Safety (≤ 9 V; bulging without a blast; no recipes)

- Sources: the 9 V battery only. The amplifier's supply is 8.3 V. Every can in this chapter is 16 V, so the cans are
  at most 0.56 of their rating.
- **No reversed can is possible** on STORE and RC with flip off and plus to the left. Prove it with an enumeration
  test: every placement of every tray can for 30 s, as E3-6 searched the 253 pairs (PATH-ledger.md:391-392).
  - If one slips through anyway, the bench shows the bulge and one puff of steam on the model's event
    (`C/shared/bench/index.ts:503-508`; C/VISUAL.md:431, :439-441).
  - Then a «Нові деталі» button re-seats the board (`M/chapters/resistor/steps/07-amp.ts:100-114`).
- **The text never shows a bulge as a lesson here.** Reversal and over-voltage belong to `capacitor-kinds`
  (PATH.md:580-599).
- **Inrush.** Closing onto an empty 470 μF draws ≈ 4.4 A for ≈ 1 ms (§3.1, row 7). Nothing in the model burns: the
  battery only warms, with heat τ 2 s, and caps have no current limit. The «Д» must not invite shorting cans by hand;
  the discharge in Q3 is through 1 kΩ.
- **`reservoir`.** Removing C3 burns nothing (PATH-ledger.md:337-343). An empty 470 μF from a tray, put on the live
  supply, pulls a ms pulse through D1 (limit 1 A, τ 5 s). R-C must confirm that nothing burns.
- **Wording.** Never «струм тече крізь конденсатор» (PATH-ledger.md:199).
- **Real electrolytics.** Their dangers are said in `capacitor-kinds/reverse` and not here.

### 4.8 Script traps (terms, units, words)

- **«μF» and «мікро-».** The prefix is introduced in `capacity` (`chapters/_terms.md:105`). PATH's own `store` «Дія»
  says «деталі 470 μF» (:473).
  - `store` and `inside` must name the can in words: «великий циліндр із лотка», «конденсатор».
  - The tray label «470 μF 16 V» is a marking, not a caption (VISUAL §1, principle 4).
  - The forms `\bємн\w*` and `фарад` must not appear before `capacity` (`_terms.md:47-48`).
- **No «теплий».** Never print the model's «теплий» for a can, nor read it in QA as heat (PATH-ledger.md:172;
  bench bug 3).
- **`reservoir` words.**
  - «спотворення» is a path term of `amplifier/diodes` (`_terms.md`). «Д» says «обертонів, яких не було в музиці»,
    as PATH does.
  - «звук гіршає» is not supported by the melody numbers (row 20). See Q7.
- **«Висновки» to change after the runs.**
  - `slow`: «за першу секунду напруга сягає двох третин» becomes «близько двох третин» (5.66 V of 9 V is 63 %; 6 V
    comes at 1.11 s).
  - `store`: «світить його ще пів секунди» needs «яскраво — пів секунди, а тоді ще довго ледь жевріє» (row 5).
  - `inside`: «доки йому є куди його віддати» holds; ≈ 1.4 V stays when the LED stops taking current (row 6).
  - Record each change as a line at the end of PATH.md.

### 4.9 Lag between the bench and the scope

- With N1 the bench is frame-locked. The scope still shows the stream ≈ 0.06–0.25 s behind (§0, item 2).
- `slow` and `time` have no LED, so nothing on the bench disagrees with the trace.
- In `store`, if the builder also shows the scope, the trace would trail the LED. Recommend no scope in `store`,
  `capacity` or `inside`.

## 5. Open questions (recommended default first)

1. **Q1: the source of the time-domain looks.**
   - Default: N1, a frame-locked `Transient` in the driver, opt-in per step (`bench.timed`). It drives the LED light,
     the readings, heat and the inside view; the stream stays for the scope and sound.
   - Alternative (bench.md §4.4): stream taps for the LED. One path, but a 0.06–0.25 s lag after every click. «Без
     деталі гасне миттєво» and «10 μF — лише блим» (11 ms) would look the same.
2. **Q2: the afterglow.**
   - Default: keep `ledBrightness` (cube root; a real red LED does glow faintly at μA). The script quotes the panel's
     time to 1 mA (0.51 s), and «Д» says the LED glimmers for seconds on microamperes.
   - Alternative: change VISUAL §4.4's mapping. This touches every chapter's LED.
3. **Q3: emptying the can between `time` runs.**
   - Default: the dock switch «Резистор» re-seats a fresh board (new empty can, switch open), as `resistor/inside` did.
   - Alternative: a step button «Розрядити» that bridges the can's rows with 1 kΩ for 0.5 s (honest; τ 0.1 s), so the
     reader can swap R by hand. It also lets `slow` show PATH's «дзеркальна крива» (row 16) through 1 kΩ, not 10 kΩ.
4. **Q4: the probe's load.**
   - Default: keep `SCOPE_INPUT`. The script quotes the probed numbers (rows 11–14) and «Д» says the scope's input
     takes ≈ 1 % (final 8.88 V, not 8.97 V).
   - Alternative: a ×10 probe (10 MΩ). This is a shared change that moves E3-8's checks.
5. **Q5: what «дві третини» measures.**
   - Default: the crossing of 63 % of 9 V (5.69 V; a dashed line on the chart, S5). The readouts give 0.47 / 1.01 /
     2.25 s against R × C = 0.47 / 1 / 2.2 s.
   - Alternative: 63 % of the final value (0.467 / 0.987 / 2.135 s). That is exact but needs the final value first.
6. **Q6: `reservoir`, C3 out and back.**
   - Default: the hand takes C3 whole (`policy.take` for `part:C3` only). Let go anywhere, it returns to `e2`/`f2`
     (`HandPolicy.place`, S2), as the prologue's `stand` does. On a phone, add a dock toggle «Конденсатор-запас».
   - Alternative: the toggle alone. Easier to watch, but no hand.
7. **Q7: «звук гіршає» in `reservoir`.**
   - Default: take it out of «Висновок» and keep the scope's supply swing (run R-C). In «Д», give the tone's THD,
     1.5 → 2.8 %, labelled as the tone's.
   - Alternative: keep it only if R-C shows a clearly audible difference with the melody.
8. **Q8: the scope view of the supply.**
   - Default: DC with an offset (S6): 0.1 V/div, `ground` −83, so the screen spans 7.9…8.7 V. The ticks are
     absolute volts, and the axis caption says it.
   - Alternative: an AC-coupled input. NEW: a high-pass inside the instrument, and more words.
9. **Q9: the inside picture.**
   - Default: two flat plates in a vertically cut can; no field lines; charges by `volts`; electrons drifting in the
     legs.
   - Alternative: a cut foil roll. Truer to the part, but `capacitor-kinds/film` already has a roll and PATH «Д»
     (:488-490) allows the two plates.
10. **Q10: the STORE slot.**
    - Default: J3 `+12`→`a12`, J4 `e13`→`-13`, the can in `b`/`c`/`d` 12/13, flip off; the goal finds the can by kind
      and rows.
    - Alternative: the can across the LED's rows (`d9`/`d10`). One jumper fewer, but on opening it holds only 1.96 V,
      so the demonstration fails.
11. **Q11: sound for the whole chapter.**
    - Default: `createStepStand(ctx, { sound: true })` (S1). With sound, the stream runs from the mount
      (`C/shared/README.md:71`): cheap for RC and STORE, while the amplifier in `reservoir` is subject to owner
      decision 17 on a phone (bench bug 12).
    - Alternative: sound only in `reservoir` needs a second mount, which is not possible. So it is the chapter's
      choice.
12. **Q12: the time base for `slow` and `time`.**
    - Default: a roll at 1 s/div (10 s on screen, one scale for all three resistors, VISUAL §5.2). The 22 kΩ curve
      reaches 63 % at 2.25 s and 7.9 V at 5 s.
    - Alternative: 0.5 s/div, as `meter/flat`. The 10 kΩ curve's start scrolls out at 5 s. A «лупа часу» switch would
      need a longer roll ring: today a scale change restarts the roll (`scope-model.ts:257-264`, `:288-291`).
