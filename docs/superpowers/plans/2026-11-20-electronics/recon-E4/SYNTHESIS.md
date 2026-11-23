# Recon E4 · SYNTHESIS — what the batch E4 plan needs before `divider`, `capacitor`, `capacitor-kinds`, `filter`

For the controller who writes `batch-E4.md` (shape: `batch-E3.md`). Sources: the six maps in this folder
(`divider.md`, `capacitor.md`, `capacitor-kinds.md`, `filter.md`, `bench.md`, `lessons.md`), each spot-checked against
the code (§0.2). Trees: `M/` = `/home/pilot/tmp/radio-science-pop/app/src/volumes/electronics/` at `4e6b986`; `C/` =
`/home/pilot/tmp/rsp-e2/app/src/volumes/electronics/` at `7ad47b1` plus the uncommitted fix:E3-8#1 (14 files). Common
ancestor `aabe0a4`. A file identical in both trees is cited under `M/`. «Map §n» means that map's section.

## 0. In one screen

1. **E4 builds on the merged tree.** Only `C/` has the scope, `live`, sound, bulged/steam and `SCOPE_INPUT`; only `M/`
   has `shared/steps`, Ω «—» (`powered`), policy-gated grips and the moved film anchors (bench.md §1). The merge
   (E3-10, after E3-8 fix and E3-9) is the gate for every chapter. Before it, only docs and the capacitor inner views
   can run in `M/` (files neither tree has touched since `aabe0a4`: `shared/inside/wedge.ts`, `shared/dive/*`,
   `shared/parts/look.ts`, `shared/parts/part.ts`).
2. **Four shared tasks** (§1): E4-B steps and bench fixes (12 SMALL items), E4-T the timed bench (NEW), E4-I capacitor
   inner views (NEW ×2), E4-S scope additions (SMALL). No register task: `_terms.md:42-56` already holds every E4 term.
3. **Biggest gap: the bench's looks are DC.** LED light, the meter and the door read the operating point
   (`C/shared/bench/index.ts:471-476`, `:521-530`; `M/shared/dive/door.ts:233-239`), where a capacitor is open
   (`M/sim/core/capacitor.ts:36-47`, companion only when `op.dt > 0`). `capacitor/store`, `capacity`, `inside` cannot
   be honest without E4-T. Recommended: a frame-locked transient, opt-in per step (§1.3), not stream taps.
4. **Capacitor «теплий»: no tint and no word below «гарячий»** (§1.2). Model unchanged.
5. **PATH numbers move.** Scope numbers carry the 1 MΩ probe (62.84 % at R × C, not 63.2 %); the bench plays the
   melody, not 1 kHz (`divider/volume`, `capacitor/reservoir`); `filter/highs` edges with ESR are ≈ 149 / 461 Hz, not
   200 Hz / 2 kHz; `filter/lows`/`tone` are loaded by the volume control. Every script gets model runs (§2).
6. **Order** (§4): scripts + E4-I in `M/` now; after the merge E4-B in `M/` ∥ E4-T, E4-S in `C/`; chapters `divider` ∥
   `capacitor-kinds` first (live first), then `capacitor` ∥ `filter`.

### 0.1 Corrections to the maps

- `divider.md` Q4 proposes a `segmented` «3 V · 4,5 V · 6 V» prediction. E3 lesson: `segmented` starts on its first
  item and ignores a tap on the current one (`app/src/ui3d/widgets/tabs.ts:109`, `:136`). Use three `button`s.
- `bench.md` §4.4 (stream taps) and `capacitor.md` N1 (frame-locked transient) disagree; §1.3 decides.
- `bench.md` bug 9 leaves the capacitor view to «E4-S or the chapter builder»; `capacitor-kinds.md` needs a second view
  (film roll). Both go to one shared task E4-I, names `plates.ts` and `roll.ts` (never `film`: `shared/inside/film.ts`
  is the resistor's, `shared/parts/capacitors.ts` exports another `FILM`/`createFilm`).

### 0.2 Spot-checks (claim → verified at)

| Claim | Verified |
|---|---|
| LED light and looks from the DC `reading` | `C/shared/bench/index.ts:471-476`, `:521-529` |
| Stream runs only with scope or sound | `C/shared/bench/index.ts:575-576` (`live.update(dt, bench.scope > 0 \|\| speaker !== null)`) |
| Held page replaces only sweeps, from `'dc'` | `C/shared/bench/index.ts:597-616` (`display !== 'sweep'` returns) |
| Stream lag up to 4 blocks = 0.256 s | `C/shared/model/live.ts` `lookahead: (plan.capacity + 1) * block`; `C/shared/sound/plan.ts:30` |
| Stream has no `substeps` | `C/shared/model/live.ts:155-160` (setup `{ net, rate, block, probes, damage }`) |
| `preset` keeps unnamed plugs; `clear` drops them | `C/shared/bench/index.ts:209-215`, `:684-695` |
| `createStepStand` mounts without options; `Naming` has no scope/player | `M/shared/steps/stand.ts:16-26`, `:57-58` |
| Policy: leads never, probes named red/black, `kindOf` 3 kinds | `M/shared/steps/policy.ts:36-38`, `:49`, `:56-61` |
| Dock switch phone-only, disabled while flying | `M/shared/steps/dock.ts:30-39` |
| Capacitor tinted by heat at «warm»; warm above 0.5 | `M/shared/parts/look.ts:59-63`, `:97-117`; `M/sim/core/limits.ts:34`, `:89` |
| One `Prints` for all tray labels; pot label = «10 kΩ» | `M/shared/hand/tray.ts:162`, `:221-227`; `:79` |
| Prints hidden on every phone | `M/shared/parts/part.ts:206-213` (`k = eye.phone ? 0 : …`) |
| «1 mF» | `M/shared/parts/capacitors.ts:60-62` (`fmtSI(farads, 'F')`) |
| Inner views: resistor only; `InsideState {amps, heat, burnt}`; wedge about x | `M/shared/dive/cutaway.ts:14-16`; `M/shared/inside/wedge.ts:26-33`, `:145-149` |
| Door targets board parts only | `M/shared/dive/poses.ts:165-170` (`placeOf` reads `bench.state.parts`) |
| `ground` documented −4…4 | `C/shared/instruments/scope-model.ts:58` |
| `hold()` does not feed `peak()` | `C/shared/instruments/scope-model.ts:326-345` (feed) vs `:424-445` (hold) |
| `SCOPE_INPUT` 1 MΩ per probe | `C/shared/instruments/scope.ts:73` |
| C2 on 3 P, C3 at `e2` | `M/sim/board/presets.ts:148`, `:162` |
| «вибух» banned in scripts | `docs/volumes/electronics/check.py:52-54` |
| No-`fit` shot cropped up to ×1.5 | `app/src/engine/camera/director.ts:91-100` |

## 1. Shared work before chapters

### 1.0 Precondition: the merge (E3-10, not E4)

Conflicts expected (bench.md §0): `shared/model/driver.ts` (+ test; union of `powered` and `still`/`STILL`/`damaged`/
bulged), `shared/README.md`, `shared/hand/tray.ts` (same leak fix, `stepped` vs `body`), sandbox `scene.ts` and
`qa/measure.mjs` (take `C/`'s, keep `M/`'s Ω-«—» check, bench bug 15), `REUSE.md`. E3-10 also moves `meter` onto
`shared/steps` (`C/chapters/meter/parts/{policy,dock,goals,scope}.ts`, `stand.ts` are copies, lessons §2.8). If E3-10
leaves that out, E4-B items c and e do it. Ledger line `progress.md:80` (geometry leak) is stale: fixed in both trees.

### 1.1 Tasks

**E4-B · Steps and bench fixes** (after the merge; tree `M/`; ≈ E3-7's extraction in size). One commit per item or
two commits; each item has its tests and README/REUSE lines.

| # | What | Where | Tests | Chapters | Size |
|---|---|---|---|---|---|
| a | `bench.preset` also clears plugs it does not name (a preset is the step's whole bench); doc and README «bench» | `C/shared/bench/index.ts:209-215`, `:684-689` | preset after a board with plugs seats (sandbox lamp → led/divider case) | all | XS |
| b | `createStepStand(ctx, { keepDoor, sound })`; `Naming.scope`, `Naming.player`; `stand.play(on)` / `playing()` and `playerToggle` lifted from `meter` | `M/shared/steps/stand.ts:16-26`, `:57-58`; `C/chapters/meter/stand.ts:49-100`, `C/chapters/meter/parts/dock.ts:75` | stand.test: sound mount, player level survives `board()` only when set | divider, capacitor, filter | S |
| c | `handPolicy`: `probes?: readonly ProbeKey[]` (red, black, ch1, ch2), `lead?(name)` (`pl+`, `pl-`), `place?` (a part returns to its sockets), `kindOf` + `capacitor`, `pot` (electrolytic via `PARTS[key].dielectric`) | `M/shared/steps/policy.ts:9-61`; superset `C/chapters/meter/parts/policy.ts:10-48` | rules.test per key | all | S |
| d | `switchToggle` option: shown on every device and enabled while `bench.flying` (switch on the floor `inside`) | `M/shared/steps/dock.ts:30-39` | rules.test | capacitor/inside | XS |
| e | Scope helpers to `shared/steps/scope.ts`: `timeText`, `voltsText`, `axisTitle`, `scopeWords`, `scopeBoard`, `crestText`, `crestStats` (if E3-10 did not) | `C/chapters/meter/parts/scope.ts:40-112` | moved tests | divider/volume, capacitor/slow·time·reservoir, filter | S |
| f | `shared/steps/knob.ts` `knobSlider(bench, id, partId, label, marks)` (`setSetting` on input) | pattern `C/chapters/meter/steps/06-twice.ts:73-88` | setting and knob follow | divider/pot·volume, filter/tone (+ meter, prologue) | XS |
| g | `shared/steps/fresh.ts`: «Нові деталі» button, visible while something is burnt or bulged, re-seats the step's board | `M/chapters/resistor/steps/07-amp.ts:98-114`, `:156` | visible only when damaged | capacitor-kinds/rated·reverse (+ resistor, meter) | XS |
| h | Lift `onBody`/`firstUnder` → `shared/steps/callouts.ts`; `joinedRows` → `sim/board`; `AMP_SHOT` → `shared/bench/shots.ts` as named shot `amp` with `fit` | `M/chapters/resistor-pick/steps/06-on.ts:57-116`; `M/chapters/resistor-pick/parts/boards.ts:57-72`; `M/chapters/resistor/steps/07-amp.ts:52-58` | moved tests; shot sight-line test | capacitor-kinds/amp, capacitor/reservoir, filter/coupling | S |
| i | Tray labels: one `Prints` per row, each with its own legibility | `M/shared/hand/tray.ts:162`, `:221-227`, `:254` | front labels visible on `stand` beside a back-row can | every capacitor tray | XS |
| j | Electrolytic print in μF: «1000 μF 16 V» | `M/shared/parts/capacitors.ts:60-62` | print and `trayLabel` tests | capacitor-kinds | XS |
| k | Capacitor «warm» (§1.2) | `M/shared/parts/look.ts:59-63`, `:97-117`; VISUAL §4.8 | look.test | capacitor, capacitor-kinds, every amplifier step | XS |
| l | Prints on a phone on the floors `part`/`inside`: `PartEye.close` → phone uses the desk's ≥ 16 px-eq rule; VISUAL §9 exception; measure `printEm` at `DIVE_END` (if < 16 px-eq, a door `elevation` option) | `M/shared/parts/part.ts:198-226`; `M/shared/dive/poses.ts:95` | part.test; sandbox shot of «104» on `pp` | capacitor-kinds/ceramic·electrolytic | S |

**E4-T · Timed bench** (NEW; after the merge; tree `C/` re-synced to main; ≈ E2-9 without UI). §1.3 has the design.
Where: new `shared/model/timed.ts`; hooks in `shared/model/driver.ts` (`reading`, `rowVolts`, `part().u/i`),
`C/shared/bench/index.ts:471-476`, `:521-530` (LED light, looks), the meter's V, `M/shared/dive/door.ts:233-239`
(`volts`). Tests first:
- from an ideal 9 V, 470 μF into 330 Ω + red LED matches `M/sim/core/__fixtures__/led-discharge.json` (18.2 / 11.4 /
  4.5 / 1.0 mA at 0.025 / 0.1 / 0.25 / 0.5 s) to 0.1 mA;
- on the STORE board (§2.2) time to < 1 mA after `SW` 1→0: 0.506 / 0.108 / 0.0113 s for 470 / 100 / 10 μF, the 10 μF
  one reported sub-frame by a threshold watch (capacitor.md S8);
- no can: LED current < 0.1 mA in the frame the switch opens;
- `dt` 0 does not move it; a preset starts it from `'dc'`; a rebuild keeps the can's volts by id;
- cost on STORE ≤ 1 ms/frame on the desktop; `?freeze` hash stable.

Sandbox step `timed` with `measure.mjs --only timed` (LED brightness timeline read from the bench reader, not pixels).
Chapters: `capacitor/store`, `capacity`, `inside`. Size M.

**E4-I · Capacitor inner views** (NEW ×2; can start now in `M/`; ≈ E3-5 in size). First a VISUAL §7 entry for each.
- `shared/inside/wedge.ts`: an `axis: 'x' | 'y'` option (radials cut about the vertical; `:145-149`).
- `InsideState` + `volts`, `bulged` (`wedge.ts:26-33`); the door feeds them, from DC until E4-T switches it to the timed
  model (`door.ts:233-239`).
- `CUTAWAYS.capacitor` branches on `PARTS[key].dielectric`: electrolytic → plates, film → roll, ceramic → none
  (`cutaway.ts:14-16`; `M/sim/core/parts.ts:171-184`).
- `plates.ts` (`createPlates`, `asPlates`, `anchor('plus' | 'minus' | 'insulator')`): can opened by a vertical wedge,
  two `steel` plates, a `mist` insulator via `sheath()` (not `K.glass`), `cyan` electrons on the minus plate and
  `coral` «+» on the plus plate, count `round(N × volts / 9)` from the capacitance's volts (not the terminal `u`),
  leg electrons ∝ current; no halos, no field lines (hue ≤ 3); ≤ 6 inside draw calls. Copy the plate meshes, orbs and
  placement maths of `app/src/volumes/electricity/chapters/charge-field/parts/capacitor.ts:53-59`, `:78-86`,
  `:171-187`; not the halos, the amber field, the glass block. REUSE row `REUSE.md:40` → «зроблено».
- `roll.ts` (`createRoll`, `anchor('film' | 'metal')`): two metallised strips wound along the legs' axis, sprayed metal
  ends where the legs enter, cut by the existing x-axis wedge with own section faces for the box; static (no charge).
  Copy candidate `app/src/volumes/electricity/chapters/lab-battery/parts/jelly-roll.ts` (new REUSE row).
- Tests: geometry inside the part's Box3 for every electrolytic size and both film boxes; anchors inside the exposed
  geometry per variant (lesson §2.7); draw calls; charge count ∝ volts; `dispose` returns the part whole.
  Sandbox `measure.mjs --only plates,roll`. Chapters: `capacitor/inside`, `capacitor-kinds/film`. Size M.

**E4-S · Scope additions** (after the merge; tree `C/`; S).
- a: `ground` beyond ±4, documented and tested (0.1 V/div, `ground` −83 → 7.9…8.7 V); axes already tick any ground
  (`C/shared/instruments/scope-model.ts:58`, `:622-640`); screen clipping check; VISUAL §5.2 line. → `capacitor/reservoir`.
- b: `pretrigger` (divisions before the edge) in `sweep` and `hold` (`scope-model.ts:413`, `:439`); a held page keeps a
  captured single shot (`auto: false` and found) instead of `still` (`C/shared/bench/index.ts:597-616`). → `filter/block`.
- c: check `peak()` on held pages (`hold` does not feed peaks); if crest readouts on `?freeze` do not match the held
  window, feed its chunks. → `divider/volume`, `filter`.
- d (optional, only if a script asks): a dashed level line and a crossing marker on the chart (`scope-model.ts:567-614`;
  `docs/UI_API.md:303-318`). → `capacitor/slow`, `time`.

### 1.2 Decision: capacitor «теплий» (recommend A)

The model calls a capacitor «warm» from voltage alone (load = |U| / `ratedV`, `M/sim/core/limits.ts:79-80`): C3 in
the amplifier at 0.52, every 16 V can on 9 V at 0.56. The look tints it (0.3 × (0.56 − 0.5)/0.5 ≈ 0.036 of the ramp).
`PATH-ledger.md:172` asks that «теплий» not be drawn as warmth; «гарячий» and bulging stay. Owner item in
`reports/batch-E2.md` §4–5.
- **A (recommended):** `KindLook.tint: 'heat' | 'hot'`; capacitor `'hot'`: tint and scorch only while `hot` or `bulged`.
  On leaving `hot` (switch opened before the bulge) the tint fades over `HEAT_LOOK.fade`, not at once. A shared state
  word helper never maps a capacitor's `warm` to «теплий» (chapters show «у межах» or nothing). VISUAL §4.8 line;
  look.test for both kinds; QA never reads a capacitor's `warm` as heat. The model, README «Limits» and the bulge times
  (12.04 s, 1.18 s) do not change.
- B: capacitor load from leak power. Rejected: changes `sim/core`, the README and PATH numbers.
- C: keep the tint, fix words only. Rejected: contradicts the ledger in every amplifier step.

### 1.3 Decision: the source of time-domain looks (recommend N1)

- **N1 (recommended): a frame-locked `Transient` in the driver, opt-in per step (`bench.timed = true`).** Each frame
  steps the frame's `dt` at 1/4800 s (80 steps at 60 fps); `set` on a setting change, `rebuild` on a new shape
  (charges by id), `start('dc')` on a preset; `reading`, `rowVolts`, `part().u/i`, LED light, meter V and the door's
  `volts` come from its last moment while `timed`; heat stays on the DC `advance` (nothing in those steps heats);
  held frames do not move it; the stream stays for the scope and the speaker. Small boards only (STORE ≈ 6 parts);
  never on the amplifier (it costs 2.5–3.5× real time already in the worker, `reports/batch-E2.md` §4).
- Stream taps (bench.md §4.4): one model, but a board change reaches the stream at its last computed moment, up to
  0.256 s ahead of the sample shown (§0.2). «Без деталі гасне миттєво» would show a quarter-second glow, and the 10 μF
  «лише блим» (11 ms) would look like no can. Rejected.
- Consequence: no scope in `store`, `capacity`, `inside` (the trace would trail the LED, capacitor.md §4.9).

## 2. Per chapter

### 2.1 `divider` (PATH.md:399-457; floor `stand`; 5 steps; sound on)

- **Depends on:** the merge; E4-B b, c (`kindOf('pot')`), e, f; E4-S c. Steps `two`, `ratio`, `pot`, `load` are DC on
  presets with the multimeter on V (dial `['off','V']`: no «A» short). Only `volume` needs scope and sound.
- **Hard steps.**
  - `volume` repeats `meter/twice` (probes on wiper and speaker, `PATH.md` deviation `meter/twice`). Default: ch1 on the
    player's row 13ae (top of the pot, socket `d13`), ch2 on the wiper 15ae (`d15`), one scale, two crests in the panel
    under the slider; goal knob ≤ 0.1 and ≥ 0.99, each held 1 s. Melody numbers, not PATH's 1 kHz (`PATH.md:444`).
    Deviation line.
  - `ratio`: prediction by three buttons unlocks the probes; any choice counts. 2k/1k gives 2.99850 V, 7·10⁻⁷ V above
    the rounding edge: run before writing the digit.
  - `pot`: pot preset (P1 at `b5`, cw 9ae from `+9`, ccw 5ae to `-5`, setting 0.5), black probe put by the step, red
    on the wiper row by the reader, panel slider «Ручка». Presetting removes the 13.5 W trap (wiper and an outer leg
    on the two rails; divider.md §4.6).
  - `load`: J3 `j7`→`-7`; the reader's 4.7 kΩ `e7`→`i7`; display 4.499 → 2.937 V.
- **Model numbers to obtain** (solveDC of `netlistOf(presetState(...))`, `SW` 1): `two` 4.4966 / 5.9970 V (and battery
  8.993 / 8.996 V, R1's |u|); `ratio` 2.9985 V (last digit); `pot` at 0 / 0.25 / 0.5 / 0.75 / 1 (expect «0,002 mV»,
  2.250, 4.499, 6.749, 8.999 V); `load` 2.9369 V (fixture `pot-mid.json`) and Д loads 47 kΩ / 100 kΩ / 1 kΩ (≈ 4.272 /
  4.390 / 1.285 V); `volume`: `Transient` of `AMPLIFIER_PRESET` + `SCOPE_INPUT` on 13ae and 15ae, `fs` 24 000, crests
  per 0.5 s over the 8 s loop at knob 0.1 / 0.5 / 0.8 / 1, swept over the melody start (lesson: a range, not one run);
  `tauMax()` for the held window.
- **Risks:** the pot case hides the + rail behind it (probes in lines d/e; sight-line test, 820 × 1180 and 1180 × 820);
  `volume` hue (lime, magenta, red LED «on», coral, blue: run `chapter-check`); phone speed of the amplifier with sound
  (decision 17); «навантаж-» before `load` and «змінний резистор» before `pot`, panel words included; «ручка» is the
  control, «повзунок» the wiper inside, never swapped; `pot` at 0 reads mV, «мікро-» comes in `capacitor/capacity`.

### 2.2 `capacitor` (PATH.md:459-541; floor `inside`; 6 steps; sound on)

- **Depends on:** E4-T (`store`, `capacity`, `inside`); E4-I plates (`inside`); E4-B b, c (`ch1`, `place` for C3,
  `kindOf`), d, e, h, k; E4-S a (`reservoir`).
- **Boards.** STORE = `LED_LOOP` (`M/sim/board/presets.ts:112-120`) + J3 `+12`→`a12`, J4 `e13`→`-13`; the can goes in
  b/c/d of 12/13, plus left, flip off (an enumeration test proves no reversed placement, as E3-6's 253 pairs). RC =
  sandbox `rc` (`C/_dev/chapters/_sandbox-electronics-bench/scene.ts:207-212`), probe `d7`/`e7` in front of the can.
  AMP = `AMPLIFIER_PRESET` unchanged.
- **Hard steps.**
  - `store`/`capacity`: LED fade from N1; goal from the timed LED current (`store`: ≥ 1 mA for ≥ 0.40 s, < 1 mA by
    0.60 s; `capacity`: per-can windows ≤ 0.03 / 0.09…0.13 / 0.45…0.56 s); panel readout «… після вимикача: N s».
  - `inside`: dive into the 470 μF with «Глибина» to 1, own switch toggle that works inside (E4-B d); goal: `SW` 1 for
    ≥ 1 s with volts ≥ 8.9 V, then `SW` 0 for ≥ 1 s with volts ≤ 2.1 V.
  - `time`: a dock switch «Резистор» (4.7 / 10 / 22 kΩ) re-seats the board (fresh empty can, roll restarted), pattern
    `M/chapters/resistor/steps/04-inside.ts:74-87`.
  - `reservoir`: C3 out by hand and back (policy `place` returns it to `e2`/`f2`; phone dock toggle
    «Конденсатор-запас»); ch1 put by the step on `e5` or `d5` (2ae sockets hide behind C3); own shot with `fit`
    around C3, probe and scope face; supply view by DC offset (E4-S a). Drop «звук гіршає» unless R-C shows it.
- **Model numbers** (capacitor.md §3.2): **R-A** STORE + can, `start('dc')`, `set('SW', 0)`: LED current and
  brightness at 0.025…30 s, can volts at 0.5 / 1 / 2 / 5 / 10 s (expect ≈ 2.02 / 1.61 / … / 1.36 V, ≈ 1.4 V stays),
  thresholds 1 mA / 20 μA / 0.16 μA, for 10 / 100 / 470 μF; inrush onto an empty can (≈ 4.4 A, ≈ 1 ms, nothing burns).
  **R-B** RC + `SCOPE1` on 7ae: samples at 0.25…5 s, crossing of 5.688 V (expect 0.4725 / 1.010 / 2.250 s) and of 6 V,
  finals (8.942 / 8.877 / 8.733 V) for 4.7 / 10 / 22 kΩ. **R-C** AMP, `PLAYER` 0.3, P1 0.5 and 0.8, `SCOPE1` on 5ae:
  8 s with C3, `rebuild` without, 8 s, with, 8 s; max − min per 0.5 s window (min/median/max); swept over the removal
  moment; nothing burns or bulges; the speaker's crest.
- **Risks:** text changes (record at the end of `PATH.md`): `store` «яскраво — пів секунди, а тоді ще довго ледь
  жевріє» (cube-root brightness: 0.37 at 0.5 s, 0.11 at 2 s); `slow` «близько двох третин»; `time` 63 % with the probe.
  «μF», «ємн-», «фарад» before `capacity`: `store`/`inside` name the can in words; the tray label is a marking. Frozen
  shots: `slow`/`time` show an empty chart or a flat line (roll is not held), `store`/`inside` the entry state; goal
  shots are taken live by 0.25 s after the event. Hue in `reservoir` = 4: one channel only. Never «струм тече крізь
  конденсатор», never «теплий» for a can.

### 2.3 `capacitor-kinds` (PATH.md:543-618; floor `part`; 6 steps; no sound)

- **Depends on:** the merge (bulged kept out of the circuit and steam: `C/shared/model/driver.ts:372-384`,
  `C/shared/bench/index.ts:503-508`); E4-I roll (`film`); E4-B c (flip per spec), g, h, i, j, k, l.
- **Hard steps.**
  - `ceramic`: the loupe cannot open the tray (`placeOf` reads board parts): one disc `C1` on the board, swapped 104 →
    101 → 102 under the same id on the floor `part`; four answer buttons labelled like tray slots (10 nF the
    distractor); phone needs E4-B l.
  - `film`: dives to `inside` in a `part` chapter (roll view); two callouts at most; deviation line.
  - `electrolytic`: read on `part`, then carry the can whole into a gap whose + row is on the right and flip it by a
    tap; switch locked open.
  - `rated`/`reverse`: gap `J1` `+14`→`a14`, `J2` `e15`→`-15`; `rated` tray only «100 μF 6,3 V», flip off; `reverse`
    16 V can preset right way, flip on for that spec; chapter readouts of `model.reading(id).u` signed and a state
    word without «теплий»; «Нові деталі» (E4-B g); own shot with `fit` near the gap and the switch.
  - `amp`: steep `amp` shot (E4-B h); goal takes the whole node (`joinedRows`); strict probe order (red on plus).
- **Model numbers:** codes/labels unit test (`capacitorCode`, `trayLabel` per key; «101», «102», «104», «105»);
  `rated` bulge 12.04 s (frame 723), tint from 4.31 s, after: 8.99 mA through the 1 kΩ leak; 16 V can on 9 V warm for
  ever; `reverse` 1.178 s (frame 71), tint from 0.57 s; `amp` meter texts «8,337 V», «3,771 V», «685,9 mV» (fixture
  `amplifier-op.json`; mV below 1 V); leaks at 9 V (3.49 / 10.1 / 6.09 / 1.87 μA). Run: `presetState` +
  `createBenchModel` + `advance(1/60)` loop, `meterExtra('V', …)` + display text.
- **Risks:** door reuse across `ceramic` → `film` → `electrolytic` (no `keepDoor`, or a different id per step);
  tray ≤ 6 kinds per row (8 high kinds in the chapter: ≤ 2 per step); `check.py` bans «вибух» (write «без видовища»);
  `reverse` «Докладніше» warns that a real reversed can may burst open and spray hot electrolyte, with no recipe; C1
  and C2 side by side on line `a` (tags apart, raycast check); on a phone the 0.05 dome is ≈ 3 px: steam, tint and the
  state word carry the event.

### 2.4 `filter` (PATH.md:620-697; floor `stand`; 6 steps; sound on)

- **Depends on:** the merge (scope, live, speaker); E4-B b, c (`lead:pl+`, `ch1`/`ch2`), e, f, h; E4-S b, c. No inner
  view.
- **Hard steps.**
  - `block`: single-shot sweep (`auto: false`, explicit level, `slope: 1`) with pretrigger; on `?freeze` the capture
    must stay (E4-S b); speaker unplugged.
  - `pass`: the reader moves `pl+` (lead rule); `pl-` preset on the − rail; all plugs on the right half (reach 4.0).
  - `coupling`: probes on `h7`/`i7` (7fj half of the output node) and `d10`/`e10`; 1 V/div, ground −2; no jumper for C2
    offered (Q2 burns in 2.2 s).
  - `highs`: C2 on 3 P in the preset; a tray can stands on 1 P and a phone cannot re-seat a radial leg → a chapter
    amplifier board with C2 on 1 P (e.g. jumper 7ae→9ae, C2 `a9`/`a10`), proved by the presets overlap/reach tests and
    the node partition against `amplifierNetlist`; flip off. Fallback: dock control «470 / 100 / 10 μF» re-presets C2.
  - `lows`/`tone`: crowded right half (P1 case over 13–17 b/c); P2 `pot-10k` preset as a rheostat (`o: 1`); slider.
- **Model numbers** (filter.md §3; all «to confirm»): `block` τ 9.90 ms, jump 8.999 V, 3.28 V at 10 ms, 0.058 V at
  50 ms, residue ≈ 71 μV; `pass` HP 16.0 Hz, melody crest ratio ch2/ch1 window; `coupling` means 3.73 / 0.0003 V,
  melody crests 0.61…0.98 V; `highs` with ESR 39.5 / 149 / 461 Hz, |H(1 kHz)| 0.933 / 0.743 / 0.210, melody crests per
  can, thumps 0.44 / 0.35 / 0.11 A; `lows`/`tone` on the amplifier (VR1 load) edge ≈ 1.8 kHz → ≈ 0.4 kHz, passband
  0.86 → 0.35–0.39; formula 1.59 kHz / 145 Hz. Response numbers from test runs with `player-tone` and `substeps: 8`
  (`createBenchModel({ fixed })`); live stays at 24 kHz without substeps (−14 % at 5 kHz, −65 % at 10 kHz: README
  note).
- **Risks:** the weakest chapter for speed: every step but `block`/`pass` plays the amplifier (phone ≈ 0.6–0.9× real
  time, decision 17); first dock press starts no sound (step text asks for a tap on the scene, `C/shared/README.md:121-125`);
  sound-only results (`highs`, `lows`, `tone`) need crest readouts and a sound-off line; phone tabs split the chart
  from the controls; hue candidates 5 in two-channel amplifier steps (measure); terms «фільтр» not before `highs`,
  «розділов-» not before `coupling`, «частота зрізу» not before `tone`.

## 3. Rules from E3 (checklist lines for the briefs)

### 3.1 Script tasks

- [ ] Write against the merged bench and this synthesis: read `C/shared/README.md`, the presets, §1 here. A need not in
  §1 is a new shared item for the controller, never «попередньо».
- [ ] Every number names its condition: knob, switch history, `start('dc')`/`'zero'`, tone or melody, instruments
  attached (scope 1 MΩ per probe). A fixture number only under its fixture's condition.
- [ ] Every time-dependent number (after a switch, part out/in, knob, scale change) comes from a sweep over the event
  moment and history; give a range and a QA settling bound with margin. One run is never a range.
- [ ] Every readout, gauge or trace: its value at each event the step allows, not only steady state.
- [ ] «Ціль» holds the predicate; model numbers in a separate «Модель:» sentence; ≈ 10× margin over the model's
  spread; the predicate holds for any order and history; say what happens if the reader acts too early.
- [ ] A stand idealisation is labelled as the stand's, never explained as physics; if it draws a false picture, ask
  for a bench change.
- [ ] Every direction word has its formula or probe in the fact note; every real-part claim has a source or
  «перевірити»; never transfer a model number to a real part.
- [ ] Recompute every product or ratio shown from the printed rounded numbers.
- [ ] Every ledger probe can be rerun from the ledger preamble (netlist call, fs, start, duration).
- [ ] Each «Висновок» clause names the «Ціль» condition that makes it seen; text, hints and «Ціль» accept the same
  actions; hints replayed in order end where the takeaway is visible.
- [ ] Every step has a visible model-driven change; a sound-only result gets a readout and a sound-off line.
- [ ] A formula only after each of its quantities was seen on screen; a stated ratio readable at the display scale.
- [ ] Scope steps list axis and scale captions in «Підписи»; no quantity letter before its step; every dock button's
  word in «Підписи»; one word per control; parts named by position or role, not a shared colour; place words have a
  phone variant.
- [ ] List what the hand may take; give the model's outcome for every reachable misuse (from a sweep); any reachable
  burn or bulge gets «Нові деталі» with its caption.
- [ ] A new board layout is checked by the overlap/reach tests and node partition before it goes into «Бачимо»; preset
  ids J1…J10 are taken on the amplifier.
- [ ] «Бачимо» names what must be visible (targets, instrument) so builders test it.
- [ ] Hand-check «Докладніше» against the register and unit signs (`path_check` skips both).
- [ ] Every deviation gets a line at the end of `PATH.md`; grep it against later chapters' «Нитка».

### 3.2 Chapter tasks (builder)

- [ ] Import `@electronics/shared/steps`; only `HOLD` and the step boards stay in the chapter; a second user moves code
  to `shared/<module>/` with tests and a REUSE row in the same commit.
- [ ] Seat every board through `stand.board()`; every step sets `bench.closed` and `PLAYER` on entry.
- [ ] Every target within ≈ 3 sockets of C3 (e2) or C2 gets its own shot; every own shot has a `fit` holding the
  instrument, its probes at rest and the targets; sight-line test like `M/chapters/resistor/__tests__/shot.test.ts`.
- [ ] Callout anchors on the body toward the camera (`onBody`); inner-view anchors for every variant, unit-tested;
  sides per form factor; tags never over sockets the step asks for; hidden while a probe is held.
- [ ] Everything a finger needs is ≥ 44 px on 390 × 844 or a dock button; actions are `button`s, `segmented` only for a
  persistent mode with a meaningful default; goal controls and compared readouts above the fold.
- [ ] No new shared visual reacts to hover on touch; phone jumpers taken whole; a leg released off the board never
  satisfies a goal (read `parts` and `pending`).
- [ ] A takeable part without a tray slot is re-seated, never lost.
- [ ] Amplifier steps lock D2/D3 and offer no «A» across amplifier rows.
- [ ] When the build changes a part or jumper, re-read «Текст» and hints against the picture.
- [ ] A fix that adds a number, readout, control, hint path or shot gets that kind's full check (sweep, widget
  semantics in code, hints replayed, screenshots on pp, tp, tl).
- [ ] `index.ts` registration only with every check green (it goes live on the next push).

### 3.3 Chapter QA (`qa/interactions.mjs`)

- [ ] Every on-screen claim about the stand («показує «—»», «згасає», «здувається») has a check.
- [ ] Event pictures (charge curve, spike, sag, fade, bulge) are captured live at a stated time after the event or
  asserted from readers; a `?freeze` shot shows the settled state only.
- [ ] Per step, state what the frozen shot must contain and check it from samples first.
- [ ] Goal checks assert the board as data and the electrical outcome; follow every recall link (into unbuilt
  chapters: inert, no console error).
- [ ] Visibility: every named target (`locate().visible`), each dot on its own part (raycast) after every state change,
  phone goal controls and readouts in the first viewport.
- [ ] Run at 390 × 844 and a tablet branch; goal shots at the goal state with the pointer off; sheets rebuilt from
  the same run.

### 3.4 Controller

- [ ] Both seats (reviewer + reader) on every script and chapter task; the reader looks at pictures and real physics.
- [ ] Gate adds `mobile-check --profiles pp,tp,tl --only steps` and the leak check with ≥ 2 chapters on the profile.
- [ ] The controller decides cross-chapter collisions before the next row starts; every outOfScope item that touches
  reader text gets a ruling in the batch report.
- [ ] A brief names the shared files a parallel stream freezes; no brief note contradicts this synthesis.

## 4. Order and parallelism

| Phase | Tree `M/` (main) | Tree `C/` (clone) | Gate |
|---|---|---|---|
| A (now) | Scripts E4-1 `divider` → E4-2 `capacitor` → E4-3 `capacitor-kinds` → E4-4 `filter` (docs only, sequential: shared `_terms.md`, `PATH.md`, generated files; runs on `sim/core`, scope numbers with a 1 MΩ `extra`). Then E4-I (VISUAL §7 + plates + roll; files untouched by `C/`) | E3-8 fix → E3-9 `prologue` (running) | — |
| M | E3-10: merge `C/` into `M/`, `meter` onto `shared/steps`, report E3; push | then `C/` fast-forwards to main | gate GREEN, push |
| B | E4-B (steps and bench fixes) | E4-T (timed bench), then E4-S (scope). Frozen for E4-T/S: `shared/steps/*`, `hand/tray.ts`, `parts/*`, `bench/index.ts` `preset`/`clear` (E4-B owns them); E4-B leaves `model/*`, `instruments/scope*`, `bench/index.ts` `show`/`held` alone | merge both ways after each task |
| C1 | chapter `divider` (needs E4-B) | chapter `capacitor-kinds` (needs E4-B, E4-I) | merge, gate, **push: first E4 chapters live** |
| C2 | chapter `capacitor` (needs E4-T, E4-I, E4-S a) | chapter `filter` (needs E4-B, E4-S b-c) | merge, gate, push |
| R | report E4 | — | gate, push |

- Scripts first because they set the model numbers the shared tests use (R-A feeds E4-T's tests); E4-I can swap ahead
  of scripts if the capacitor script writer needs the picture (its VISUAL §7 entry is fixed by §1.1 anyway).
- `divider` and `capacitor-kinds` go live first: no time-domain looks, no new model path; `capacitor-kinds` needs only
  the merge's bulge and E4-I's roll. `capacitor` waits for E4-T; `filter` carries the speed risk and the busiest boards.
- During C1/C2 a chapter may add to `shared/` only new modules or exports with tests; the adding tree merges into the
  other before the other's next task starts.

## 5. Open questions (recommended default first; build without asking, record in the report)

1. Time-domain looks: N1 frame-locked, opt-in per step (§1.3). Alt: stream taps.
2. Capacitor «теплий»: no tint and no word below «гарячий» (§1.2 A).
3. Loupe over the tray (`capacitor-kinds`): parts stand on the board, the door dives into them; deviation line.
4. Prints on a phone: shown on floors `part`/`inside` by the desk rule (E4-B l); VISUAL §9 exception.
5. LED afterglow: keep the cube-root brightness; the panel quotes the time to 1 mA; text says it glimmers for seconds.
6. Probe load: keep `SCOPE_INPUT` 1 MΩ; scripts quote probed numbers; «Докладніше» says the input takes ≈ 1 %.
7. «Дві третини»: crossing of 63 % of 9 V (5.69 V); «близько двох третин»; τ readouts 0.47 / 1.01 / 2.25 s.
8. `capacitor/time` reset: dock switch «Резистор» re-seats a fresh board. Alt: a «Розрядити» button through 1 kΩ.
9. `capacitor/slow`/`time` time base: roll at 1 s/div for all three resistors.
10. `capacitor/reservoir`: hand takes C3 whole, `place` returns it home, phone dock toggle; DC offset view; melody
    numbers from R-C; «звук гіршає» out unless R-C shows an audible difference; THD 1.5 → 2.8 % in «Докладніше» as the
    tone's.
11. `capacitor/inside` picture: two flat plates in a vertically cut can, charges by volts, no field lines.
12. Sound per chapter: on for `divider`, `capacitor`, `filter`; off for `capacitor-kinds`.
13. `divider/volume`: ch1 on 13ae, ch2 on 15ae, melody crests; deviation line against `meter/twice`.
14. `divider/ratio`: three prediction buttons, any choice counts; formula card with the takeaway (update the ledger's
    field, `PATH-ledger.md:150`).
15. `divider/pot`: pot preset, the reader places the red probe and turns «Ручка»; no inner view of the pot in E4 (a
    stats line «нижня / верхня частина доріжки» from the setting instead).
16. `divider/load`: only 4.7 kΩ on the tray; 47 kΩ in «Докладніше».
17. `capacitor-kinds/ceramic`: one disc swapped under `C1`, four answer buttons, table «Напис · Ємність».
18. `capacitor-kinds/film`: dive to `inside` with the roll view, static.
19. `capacitor-kinds/rated`: only the 6.3 V can; readouts from the model, no probes.
20. `capacitor-kinds/amp`: strict probe order, steep `amp` shot, «685,9 mV» on the meter, «0,69 V» in «Висновок».
21. `filter/block` on freeze: pretrigger plus the captured single shot kept (E4-S b). Alt: `still` from `'zero'`.
22. `filter/highs`: 470 → 100 → 10 μF with the model's ESR numbers («≈ 150 Hz», «≈ 460 Hz»), no «ESR» on screen;
    hands on a chapter board with C2 on 1 P.
23. `filter/lows`/`tone`: on the amplifier, board numbers from runs in «Висновок» («≈ 1,8 kHz … ≈ 0,4 kHz»), the bare
    formula on the card; the load explained with «навантаження» (`divider/load`).
24. Substeps: none live or in `still`; «Докладніше» numbers from `substeps: 8` test runs; README states the warping.
25. No tone generator on the bench: melody only.
26. Owner decision 17 (amplifier live vs loop on phones): stay live; each amplifier step records its worst block time
    on the desktop and the phone estimate in the report.
