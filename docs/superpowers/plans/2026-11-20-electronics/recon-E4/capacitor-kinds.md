# Recon E4 · `capacitor-kinds` — «Чим різняться конденсатори?»

Read-only map for chapter 6 of the path (floor `part`, 6 steps, ≈ 10 min, 4 terms: маркування, електролітичний
конденсатор, полярність, номінальна напруга; no formula). Sources: `docs/volumes/electronics/PATH.md:543-618`,
`PATH-ledger.md` (terms 24–27, «Чесна фізика» rows 170–180, numbers 260, 308–309), `chapters/_terms.md:50-53`, the
design §2–§3 and §8, `VISUAL.md` of the clone (§4.7, §4.8, §6, §7, §9), `sim/core/README.md` («Capacitors»,
«Limits», «The transient», «The amplifier»), the built chapters `resistor` and `resistor-pick` and their scripts.

Abbreviations: `M/` = `/home/pilot/tmp/radio-science-pop/app/src/volumes/electronics/` (main), `K/` =
`/home/pilot/tmp/rsp-e2/app/src/volumes/electronics/` (the clone with E2-9, E2-10). Line numbers as of 2026-11-23.

## 0. Verdict

- Every step can be built on what exists, **after E2-9 is merged**: main's bench does not yet bind `bulged`
  (`M/shared/model/driver.ts:287-297` keeps only `burnt` in memory — `bulged` passes through from the solve while the
  can is in the circuit and is lost once it is moved out; `M/shared/bench/index.ts:437-441` lets out a *smoke* wisp
  for any failure, a bulging can included). The clone has it (`K/shared/model/driver.ts:376-380`,
  `K/shared/bench/index.ts:495-508`, steam `K/shared/bench/smoke.ts:24-31`). `rated` and `reverse` need it.
- Two real gaps: **(a)** a part's print is never shown on a phone (`M/shared/parts/part.ts:206-213`; VISUAL §9 «Друк у
  сцені … на телефоні схований»), so `ceramic` («101», «102», «104») and `electrolytic` («470 μF 16 V») cannot be read
  on a phone even on the floor `part`; **(b)** no capacitor has an inner view (`M/shared/dive/cutaway.ts:14-16` has the
  resistor only), and `film` («розрізати його навпіл») needs one.
- «Лупа над лотком конденсаторів» (PATH «На стенді») is impossible as written: the magnifier's door leads only into a
  part standing on the board (`M/shared/dive/poses.ts:165-171` `placeOf` reads `bench.state.parts` and its legs). The
  parts to look at must stand on the board — a deviation to record at the end of `PATH.md`.
- No oscilloscope, no sound, no `still()`: nothing in this chapter is a trace in time. Time enters only as heat and the
  bulge (`rated` 12.0 s, `reverse` 1.2 s).

## 1. Steps → bench, motion, goal, term

Boards are proposals (sockets checked against `VISUAL.md` §3 and §4 footprints; `seatPreset` throws on a wrong one,
`M/sim/board/presets.ts:61-84`). `HOLD` = the chapter's hold time, 1 s as in `resistor-pick`.

| Step | Reader does on the bench | What moves / shows (model source) | «Ціль» predicate (proposal) | Term / formula |
|---|---|---|---|---|
| `ceramic` | Board: one disc `C1` (`ceramic-*` at `e8`, legs `e8`/`e10`), not in any circuit; shot `board`. «Глибина» to the floor `part` (rail `DIVE_END` ≈ 0.75, as `resistor-pick/bands`). A dock switch «Диск» puts the next disc under the same id (`104` → `101` → `102`, the `series` swap: `M/chapters/resistor-pick/steps/02-series.ts`); on the floor `part` the reader presses the capacitance that matches the print: four buttons labelled like the tray slots (`trayLabel`: «100 pF 50 V», «1 nF 50 V», «10 nF 50 V» — a distractor —, «100 nF 50 V»). Table «Напис · Ємність». | The disc's own print, three digits (`capacitorCode`, `M/shared/parts/code.ts:95-106`; printed at `M/shared/parts/capacitors.ts:85`). Nothing of the model moves: no circuit. | Door into `C1`, `door.floor === 'part'`; for each of the three codes the matching button pressed while that disc stood under the door; `matched` = {101, 102, 104}. A wrong press does not count (the table may say so). | **маркування** (+ піко-, нано-: `PATH-ledger.md:114`) |
| `film` | Board: `C1` = `film-1u` at `e8`. «Глибина» to its end (rail 1, floor `inside`): the box opens. | NEW inner view: the wound metallised film, the sprayed metal ends where the legs come in; the box's cut faces. Static — no circuit, so no charge and no current (honest: the model gives a film capacitor nothing to show here). | As `resistor/inside` `down()` (`M/chapters/resistor/steps/04-inside.ts:34-38`): floor `inside`, rail ≥ 1 − 1e-3, the cutaway `open`, held `HOLD`. | — |
| `electrolytic` | Board: `C1` = `electrolytic-470u-16v` standing alone (e.g. `h4`, legs `h4`/`h5`) and a gap fed from the rails with **+ on the right**: `J1` `+13`→`a13`, `J2` `e12`→`-12`; switch open and not takeable. (1) «Глибина» to `part`: read «470 μF 16 V», the stripe on the side and on the rim. (2) Back on the step's shot, carry `C1` whole into the gap; at `o` 0 its plus (leg 0) is on the left, so the reader taps it to flip (`o`+2) — stripe toward the − row. | Print and stripe: `M/shared/parts/capacitors.ts:172-179` (stripe over leg 1, over the rim too), `:236-241` (print up the side facing +z). Flip: `M/shared/hand/hands.ts:905-908`. | (a) the door reached `part` once this visit, and (b) an `electrolytic-470u-16v` with leg 0 in `13ae` and leg 1 in `12ae` (`rowsOf`, `M/shared/steps/goals.ts:10-20`), held `HOLD`. Switch stays open: a wrong placement can never bulge here. | **електролітичний конденсатор**, **полярність** |
| `rated` | Board: `J1` `+14`→`a14`, `J2` `e15`→`-15` (the sandbox's `REVERSED` pattern moved right, near the battery: `K/../_dev/chapters/_sandbox-electronics-bench/scene.ts:227-231`); tray one slot `electrolytic-100u-6v3` («100 μF 6,3 V»); switch takeable (phone: dock toggle). Reader puts the can across `14ae`/`15ae` (o 0 = right way), closes the switch, waits. | Load 1.43 → `hot`; heat h rises with τ 10 s; the body's heat tint from h > 0.5 (≈ 4.3 s), scorch with it (`M/shared/parts/look.ts:100-119`); at h = 1 the model bulges it (≈ 12.0 s): domed top, opened vent, wider sleeve (`M/shared/parts/capacitors.ts:209-259`), one puff of steam (clone). After: a leak of 1 kΩ, ≈ 9 mA. Panel: the can's u plus to minus and its state (chapter readouts, as `resistor-pick/parts/readouts.ts`). | An `electrolytic-100u-6v3` with leg 0 in `14ae`, leg 1 in `15ae`, switch closed, `model.part(id).condition === 'bulged'` (told by `advance`; clone `electronics-heat.burns[].what === 'bulged'`), then `HOLD`. Flip disabled (policy `flip` false), so only the right way bulges here. | **номінальна напруга** |
| `reverse` | Same gap; `C1` = `electrolytic-100u-16v` preset the right way (`c14`, o 0), switch open; flip allowed for capacitors, switch takeable. Reader taps the can (it turns end for end: stripe to «+»), closes the switch. | Before the flip, closed: 9 V on 16 V, load 0.56, nothing visible (tint 0.04 of the ramp). Flipped: reverse load 9 → bulges in ≈ 1.2 s, steam once; then the 1 kΩ leak. | An `electrolytic-100u-16v` with leg 0 in `15ae` and leg 1 in `14ae`, switch closed, `bulged`, then `HOLD`. | — |
| `amp` | Board `AMPLIFIER_PRESET` unchanged (`M/sim/board/presets.ts:145-175`), switch closed, player standing; meter on its place, dial «вимкнено»/«V», probes at rest. Reader measures each can «від ніжки «+» до смуги «−»». | Only the multimeter's number (DC solve of the bench model). Three callouts name the cans (≤ 3 labels). | Three readings, each held `HOLD`, red probe on the plus node (value positive): C3 — red in the supply node (`2ae`, `5ae` via `J8`), black in ground (`-`, `2fj`, `9fj`, `12fj`, `15fj`, `17ae`); C2 — red `7ae`/`7fj` (`J7`), black `10ae`; C1 — red `11ae`, black `12ae`/`15ae` (`J2`). Windows in §3. Rows by `joinedRows` (`M/chapters/resistor-pick/parts/boards.ts:57-72`). | — |

Shots: `ceramic`, `film`, `electrolytic` lead from `board` (the door's default, `M/shared/dive/door.ts:52-55`);
`rated`, `reverse` — a chapter shot close to the gap at columns 14–15 that also holds the battery's switch (pattern
`M/chapters/resistor/steps/07-amp.ts:52-67`; phone: the bench's `phone`); `amp` — a steep meter shot (§4.1).

## 2. Capability check

| Need | Step(s) | Status |
|---|---|---|
| Mount, step boards, door, ladder, names | all | HAVE — `M/shared/steps/stand.ts:57-100` (`createStepStand`, `openDoor`, `closeDoor`), `M/sim/board/presets.ts:61-84` |
| «Глибина» to `part` / `inside` | ceramic, film, electrolytic | HAVE — `M/shared/steps/depth.ts:39`; patterns `resistor-pick/steps/01-bands.ts:48-52`, `resistor/steps/04-inside.ts:32` |
| Disc, film box, can with real marks; stripe on side and rim; print «470 μF 16 V» | ceramic, film, electrolytic | HAVE — `M/shared/parts/capacitors.ts:66-123`, `:140-262`; code `M/shared/parts/code.ts:95-106`; tray labels `M/shared/hand/tray.ts:76-80` |
| Swap a part under one id while the door stays on `part` | ceramic | HAVE (chapter-local pattern) — `M/chapters/resistor-pick/steps/02-series.ts`, README «series» |
| Answer buttons + table on the floor `part` | ceramic | HAVE — HUD `table`/`button`, `M/chapters/resistor-pick/steps/01-bands.ts:100-118` |
| **Print legible on a phone on the floor `part`** | ceramic, electrolytic | **SMALL** — `Prints.view` hides every print on a phone (`M/shared/parts/part.ts:206-213`). Add an eye flag (e.g. `close`: the door is on `part`/`inside`, from `bench.flying` + door floor) under which a phone uses the same ≥ 16 px-eq rule as a desk; amend VISUAL §9 «Друк у сцені». Without it the phone must get the code from the panel, which defeats the step |
| Print not too foreshortened on `part` | ceramic, electrolytic | HAVE, to measure — the door looks 60° over the board (`M/shared/dive/poses.ts:95`), so a print on a vertical face loses half its height (the can's print runs vertically: half its length). Estimate for the disc at rail 0.75: ≈ 60 px-eq per em (desk). Measure `electronics-parts.printEm` at `DIVE_END`; only if < 16: SMALL — a door option `elevation` (default 60°) |
| **Inner view of a film capacitor** | film | **NEW** — `shared/inside/roll.ts` (`createRoll`): the winding of two metallised PET layers along the legs' axis, the sprayed metal ends (`steel`) the legs enter, the box's potting; opened by the existing wedge about the body's x axis (`M/shared/inside/wedge.ts:149`, axis = legs' axis = the winding axis of a real film capacitor); own section faces (the wedge's `Layer` faces are radial for a cylinder, the box is not). ≤ 8 draw calls with the body, like the resistor's film (`M/shared/README.md:469-473`). Copy candidate §4.6 |
| Cutaway chosen by dielectric | film (and `capacitor/inside`) | **SMALL** — `CUTAWAYS` is keyed by `PartKind` (`M/shared/dive/cutaway.ts:14-16`); every capacitor is kind `capacitor`. Branch on `PARTS[key].dielectric` (`M/sim/core/parts.ts:171-184`): `film` → roll, `electrolytic` → the plates of `capacitor/inside`, `ceramic` → none |
| Carry a can whole, flip by a tap, tray slot / dock button | electrolytic, rated, reverse | HAVE — `M/shared/hand/hands.ts:905-908` (click flips if `policy.flip`), `M/shared/steps/policy.ts:24-42`, `M/shared/steps/dock.ts:14-43` |
| Switch: slider on desk, dock toggle on phone | rated, reverse | HAVE — `M/shared/steps/dock.ts:31-43`; scene keeps it in sync (`M/chapters/resistor-pick/scene.ts:83-85`) |
| Over-voltage / reverse load, heat τ 10 s, bulge, 1 kΩ leak | rated, reverse | HAVE — `M/sim/core/parts.ts:649` (`voltageV: ratedV, reverseV: 1`), `M/sim/core/limits.ts:37-47` (`capacitor: 10`), `:108` `burnSeconds`, `M/sim/core/capacitor.ts:15` `BULGED_OHMS` |
| Heat tint and scorch on the can | rated, reverse | HAVE — `M/shared/parts/look.ts:31-41`, `:100-119` (capacitor `CHARRED`, `:59-73`) |
| Bulged look bound to the model, kept out of the circuit; one puff of steam; reader `burns[].what` | rated, reverse | HAVE in clone only — `K/shared/model/driver.ts:376-380`, `K/shared/bench/index.ts:495-508`, `K/shared/bench/smoke.ts:24-31`, `K/shared/model/live.ts:101-110`; sandbox proof `K/../_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs:1297-1360`. Main: wrong wisp (`M/shared/bench/index.ts:437-441`). **Blocker until E2-9 is merged** |
| Panel readouts of one part (u plus→minus, state words) | rated, reverse | HAVE (chapter-local pattern) — `M/chapters/resistor-pick/parts/readouts.ts`; read `bench.model.reading(id).u` (signed, plus to minus: `M/sim/core/README.md:73-75`) |
| Chapter's own shot with a `fit` sphere | rated, reverse, amp | HAVE — `M/chapters/resistor/steps/07-amp.ts:52-67`, test `M/chapters/resistor/__tests__/shot.test.ts` |
| Steep meter shot over tall cans | amp | SMALL — lift `AMP_SHOT` (`M/chapters/resistor/steps/07-amp.ts:52`) into `shared/bench/shots.ts` as a named shot; two chapters need it |
| `AMPLIFIER_PRESET`, meter V, readout, tally | amp | HAVE — `M/sim/board/presets.ts:145-175`, `M/shared/steps/meter.ts:16-40`, `M/shared/steps/goals.ts` |
| Rows a jumper joins to a node | amp | SMALL — `joinedRows` lives in `M/chapters/resistor-pick/parts/boards.ts:57-72`; lift to `sim/board` (pure) |
| Callouts on a part's body + the «first part under the point» check | amp | SMALL — `onBody`, `firstUnder` in `M/chapters/resistor-pick/steps/06-on.ts:59-69`, `:96-109`; lift to `shared/steps` (third user) |
| Oscilloscope, sweep, `still()`, `live`, speaker | — | NOT NEEDED (`K/shared/instruments/scope*.ts`, `K/shared/model/driver.ts:146-155`, `K/shared/instruments/speaker.ts`) |
| Tray capacity | all | HAVE per step — ≤ 6 kinds a row or a `RangeError` (`M/shared/hand/tray.ts:198`). The chapter's whole set is 8 high kinds (2 film + 6 electrolytic: `VISUAL.md` §6 puts both in the back row), so never one tray for the chapter; each step offers ≤ 2 |

## 3. Model numbers the script needs

Derived numbers are marked **(to confirm by a model run)**; the run named after each.

**Codes and labels** (`capacitorCode` = two digits and the number of zeros in pF, `M/shared/parts/code.ts:95-106`):
100 pF → «101», 1 nF = 1 000 pF → «102», 10 nF → «103», 100 nF = 100 000 pF → «104», 1 μF = 10⁶ pF → «105» (the
film box's print; PATH: «1μ» або «105» — the stand prints «105»). Tray labels (`trayLabel` → `electrolyticPrint`,
`M/shared/hand/tray.ts:80`, `M/shared/parts/capacitors.ts:60-62`): «100 pF 50 V», «1 nF 50 V», «10 nF 50 V», «100 nF
50 V», «100 nF 63 V», «1 μF 63 V», «470 μF 16 V», «100 μF 6,3 V», «100 μF 16 V». Run: `shared/parts/__tests__/code.test.ts`
style unit (`capacitorCode`, `trayLabel` for each key) **(to confirm)**.

**Catalog** (`M/sim/core/parts.ts:748-759`; README «Capacitors» table): ceramic 50 V either way, ESR 0.03 Ω, leak
10 GΩ, C0G for 100 pF and 1 nF, X7R for 10 and 100 nF, no voltage or temperature dependence; film (WIMA MKS 2) 63 V,
leak 10 GΩ (100 nF) and 1.25 GΩ (1 μF); electrolytic ESR / leak: 1 μF 265.3 Ω / 5.277 MΩ, 10 μF 26.53 Ω / 4.819 MΩ,
100 μF 16 V 2.653 Ω / 2.581 MΩ, 470 μF 0.5644 Ω / 886.9 kΩ, 1000 μF 0.2653 Ω / 457.1 kΩ, 100 μF 6.3 V 3.714 Ω /
1.479 MΩ; limits: rated voltage either way, 1 V reverse (`parts.ts:649`).

**Can sizes on the bench** (`ELECTROLYTIC_CANS` × `MM` = 3/26, `M/shared/parts/capacitors.ts:35-42`,
`M/shared/parts/part.ts:36`; body bottom 0.3 over the board): 5 × 11 mm → 0.577 × 1.269 (1 μF, 10 μF, 100 μF 6.3 V);
6.3 × 11 → 0.727 × 1.269 (100 μF 16 V); 8 × 11.5 → 0.923 × 1.327 (470 μF, top 1.63 over the board); 10 × 16 → 1.154 ×
1.846 (1000 μF, top 2.15). Useful for `rated`: the 6.3 V can is visibly thinner than the 16 V one of the same 100 μF.

**Leakage at 9 V** (u / leak; battery 1.5 Ω negligible): 100 μF 16 V 3.49 μA (PATH: «кілька мікроамперів» ✓), 470 μF
10.1 μA, 100 μF 6.3 V 6.09 μA, 10 μF 1.87 μA. Run: `solveDC` of the gap board with the can, `parts[id].i`
**(to confirm)**.

**`rated`** (`burnSeconds` = τ·ln(L / (L − 1)), `M/sim/core/limits.ts:108`; τ = 10 s):
L = 9 / 6.3 = 1.4286 → t = 10 · ln(1.4286 / 0.4286) = 10 · 1.2040 = **12.04 s** (README «Bulging»: 12.0 s; ledger
308). Heat tint starts at h = 0.5: h(t) = L(1 − e^(−t/10)) → t = −10 · ln(1 − 0.5/1.4286) = **4.31 s**; at 1/60 s
frames it bulges on frame 723 (12.05 s). Before: u ≈ 9.000 V, `hot`, load 1.43. After: 1 kΩ leak, i = 9 / 1001.5 =
**8.99 mA**, u = 8.987 V, 81 mW, condition `bulged`, load 0. A 100 μF **16 V** on the same gap: load 0.5625, `warm`
for ever, never bulges (README «Limits» table: «on 16 V it is warm for ever»). Run: `presetState` + `createBenchModel`
+ `model.advance(1/60)` loop, as `M/chapters/resistor-pick/__tests__/boards.test.ts:43-56` does for the 100 Ω
**(to confirm)**.

**`reverse`**: reverse load = 9 / 1 = 9 → t = 10 · ln(9/8) = **1.178 s** (ledger: 1.2 s); tint from
−10 · ln(1 − 0.5/9) = 0.57 s; frame 71 (1.183 s). Before the flip, switch closed: u = +9.0 V, load 0.5625, `warm`,
tint 0.3 · (0.0625 / 0.5) = 0.0375 of the ramp — invisible, as the ledger asks. After: u = −8.987 V, i = −8.99 mA.
Same run **(to confirm)**; the sandbox measured the 6.3 V can reversed against `burnSeconds` within a frame
(`K/../_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs:1314-1330`).

**`amp`** — ngspice fixture `M/sim/core/__fixtures__/amplifier-op.json`, `parts.*.u`:

| Can | u (fixture) | Meter text | Load (u / 16 V) | Proposed window |
|---|---|---|---|---|
| C3, reservoir 470 μF (supply → ground) | 8.336884 V | «8,337 V» | 0.521 (`warm` by voltage) | 8.330 … 8.344 V |
| C2, 470 μF before the speaker (output → speaker) | 3.770799 V | «3,771 V» | 0.236 | 3.765 … 3.777 V |
| C1, 10 μF at the input (coupled → volume) | 0.685946 V | «685,9 mV» | 0.043 | 0.683 … 0.689 V |

Bench with jumpers of 1 mΩ: within 1e-4 of these (`M/sim/board/__tests__/presets.test.ts`, shared README «Boards of
the steps»). Run: `presetState(layout, AMPLIFIER_PRESET)` + `createBenchModel` + `meterExtra('V', probes)`, read the
display text through `createMeterDisplay` **(to confirm)**. Note for the script: the meter switches to mV below 1 V,
so C1 shows «685,9 mV», not PATH's «0,7 V» / ledger's «0,69 V».

**Reference facts not from the model** (mark «перевірити» in Д): the oxide «тонший за тисячну частку міліметра» —
anodic Al₂O₃ grows ≈ 1.2–1.5 nm per volt of forming voltage, so a 16 V part's film is tens of nanometres (makers'
technical notes, e.g. Nichicon «General Description of Aluminum Electrolytic Capacitors»); «плівковий тримає ємність
стабільно» — the model gives no capacitor any voltage or temperature dependence (README «Capacitors», ceramic
paragraph), so the stand cannot show stability: it is a Д fact, never a claim about what the stand shows.

## 4. Risks

1. **Camera and tall cans** (bit E3: `resistor/amp` needed its own steeper shot, commit c128d6a). In
   `AMPLIFIER_PRESET` C3 stands across the channel at `e2`/`f2` (`presets.ts:148`): from the `meter` shot (≈ 55° over
   the board face) a can whose top is 1.63 over the board hides ≈ 1.1 units behind it — all of `a2`…`d2`, the rows of
   its own plus. Q2 (TO-92 at `c5`…`c7`) hides `a5`/`b5`. So: the goal must take the whole node (`joinedRows`:
   `d5`/`e5` of `5ae` are visible), the text must say «у ряду ніжки «+» або там, куди його виводить перемичка», and the
   shot should be the steep one (SMALL lift of `AMP_SHOT`). C1 and C2 stand side by side on line `a` (centres ≈ 0.9
   apart, gap ≈ 0.15): their callout tags must go apart, as in `resistor-pick/on`; check the first part under each
   point. For `rated`/`reverse` put the gap so that the can hides only rows nobody probes (probes, if any, in front).
2. **Phone.** Prints hidden (§2, SMALL). Radial tabs hidden: cans are carried whole and flipped by a tap
   (`VISUAL.md` §9) — fine for `electrolytic`/`reverse`. The dock of `ceramic` (switch + depth + table + four buttons)
   scrolls, as `bands` did. `phone` shot is steep (≈ 70°): the cans hide less, but the 0.05 dome of a bulge is ≈ 3 px;
   the steam, the tint and the panel's state word carry the event.
3. **Frozen pages.** Nothing here is a trace in time; `still()` is not used. Every step enters before its event
   (switch open, no can in the gap, discs whole), so a `?freeze` deep link shows the pre-action frame. Goal snapshots
   come from the interaction script after `advance`: `rated` needs ≥ 12.1 s, `reverse` ≥ 1.2 s; the steam lasts
   1.5 s — take its frame ≈ 0.5 s after the event, as the sandbox did (`measure.mjs:1342-1344`).
4. **Hue families ≤ 4.** `ceramic` close-up: the tan disc (`CERAMIC_BODY`, `capacitors.ts:30`) and any yellow
   marker share one family; with blue room and cyan/teal: 3. `rated`/`reverse`: orange tint + coral rail and wire +
   cyan + blue: 3. `amp`: as `resistor-pick/on` (red LED «on», coral, cyan, blue). The film box (`FILM_BODY`, dark)
   and the roll (`mist`, white PET) add no saturated family. Low risk.
5. **Draw calls ≤ 350.** Small boards; the amplifier passes in `resistor-pick/on`. The roll's inner view: keep ≤ 8
   with the body (the resistor's budget); steam meshes are made with the bench (`K/shared/bench/smoke.ts:9-14`).
6. **The inside.** What it shows: the film capacitor's two metallised plastic strips wound into a roll along the
   legs' axis, the sprayed metal ends joining every turn to a leg; electrolytic (if ever cut): anode foil with its
   dark oxide skin, paper soaked in electrolyte, cathode foil. Copy candidates: `app/src/volumes/electricity/chapters/
   lab-battery/parts/jelly-roll.ts` (`createJellyRoll`: four sheets on an Archimedean spiral, spiral end faces,
   electrolyte haze, unrolling by `amount` — four sheets are exactly foil · paper · foil · paper) → `shared/inside/
   roll.ts` with a REUSE row (drop the lift-out flight and the world's `Mats`; sheets and colours as parameters; sizes
   of the part; driven by the door's `cut`). `electricity/chapters/charge-field/parts/capacitor.ts` (two plates, field
   lines, charge halos) is the planned row for `capacitor/inside` (`REUSE.md:40`), not this chapter.
   `electricity/chapters/lab-inverter/parts/components.ts:80` `addCan` is not needed (`REUSE.md:43`: the can was built
   new). `circuit` has no capacitor. **Name clash:** `shared/inside/film.ts` is the resistor's carbon film
   (`createFilm`, `FILM`), and `shared/parts/capacitors.ts:27,100` exports another `FILM` and `createFilm` (the film
   capacitor's box): call the new view `roll`, never `film`.
7. **Safety and words.** ≤ 9 V only (battery). The model makes no smoke or bang (README «Bulging»); the bench lets out
   one puff of steam on the model's event, no sound (`VISUAL.md` §1, principle 3). `check.py` forbids `\bвибух`
   anywhere in scripts and cards (`docs/volumes/electronics/check.py:52-54`) — «без вибуху» fails; write «без
   видовища». Д of `reverse` must say a real reversed can may burst open and spray hot electrolyte (ledger «Не кажемо
   ніколи» 7), with no recipe of how. Never draw or name a capacitor's `warm` as warmth: the state readout must not
   map `warm` to «теплий» (C3 reads `warm` in `amp`; a 16 V can on 9 V reads `warm` in `reverse` before the flip).
8. **Door reuse across steps.** `createStepStand({ keepDoor })` keeps a door into the same id
   (`M/shared/steps/stand.ts:77-90`); `ceramic` → `film` → `electrolytic` preset different parts, possibly under the
   same id `C1`. Either no `keepDoor`, or a different id per step; otherwise the camera may stay on a disc's stops over
   a film box.
9. **Merge order.** `rated`/`reverse` and their QA (`burns[].what`, steam) depend on the clone's E2-9;
   `M/shared/README.md:359-366` still says «E2-9 binds it».
10. **Script ↔ PATH drift to record** (end of `PATH.md`): parts on the board, not the loupe over the tray; the film
    step dives to `inside` in a `part` chapter; `amp` quotes «685,9 mV»; the meter or the model's readouts in `rated`.

## 5. Open questions (recommended default first)

1. **Loupe over the tray?** Default: no — the step's parts stand on the board and the door dives into them; one line in
   `PATH.md`'s deviations.
2. **`ceramic` mechanics.** Default: one disc under `C1` swapped by a dock switch (order 104, 101, 102), answers by four
   dock buttons labelled with the tray labels (10 nF a distractor) on the floor `part`, table «Напис · Ємність».
   Alternative: three dives and three placements from the tray — truer to «знайти на лотку», ≈ 3× longer.
3. **Prints on a phone.** Default: SMALL change — on the floor `part`/`inside` a phone shows a part's print by the
   desk's ≥ 16 px-eq rule; VISUAL §9 gets the exception. Alternative: the panel names the code (the reader reads the
   panel, not the part — rejected).
4. **`film` cut.** Default: dive to `inside` (rail 1) with the new roll view, two callouts at most («плівка», «метал»);
   static (no charge shown). Alternative: stay on `part`, no cut (drops PATH's action).
5. **`electrolytic` action.** Default: dive to `part` to read, then carry the can into a gap whose + row is on the
   right, flip it, switch locked open; goal = right polarity held 1 s. Alternative: a touch on the stripe on the floor
   `part` (lift `M/chapters/resistor-pick/parts/picker.ts:18` to `shared/steps`) — but the side stripe faces away from
   the door's camera (it sits over leg 1, along the axis), so the target is the rim's 0.05 ring: too small on a phone.
6. **`rated` comparison.** Default: tray offers only «100 μF 6,3 V»; Д says the 16 V one lives on (model). Option: both
   slots, the reader tries 16 V first (+≈ 20 s of step time).
7. **Numbers in `rated`/`reverse`.** Default: chapter readouts from `model.reading(id).u` (signed «від «+» до «−»») and
   a state word with no «теплий» («у межах» / «понад номінальну» / «навпаки» / «здувся»); no probes to place. Option:
   the multimeter on V with probes put by the step (PATH lists a multimeter on the stand).
8. **`amp` probe order.** Default: strict — red on the plus node, value positive (the takeaway is «плюс скрізь
   вищий»); hint says so. Option: either way, as `resistor-pick/on`.
9. **`amp` shot.** Default: the steep meter shot, lifted from `resistor` into `shared/bench`. Option: `meter` + node
   rows only.
10. **Inner view per dielectric, shared with `capacitor`.** Default: `CUTAWAYS` by dielectric — electrolytic → the
    plates of `capacitor/inside`, film → the roll of this chapter, ceramic → none; one module `shared/inside/roll.ts`
    whose sheets also fit a later foil roll. Needs agreement with the `capacitor` recon (its `capacitor/inside` dives
    into the 470 μF can).
11. **Sound in `amp`.** Default: off (meter step, no mood/latency checks); revisit after E2-10 is merged.
12. **C1's number in the script.** Default: «Висновок» «8,3 V, 3,8 V і 0,69 V», «Ціль» and Д quote the meter
    («8,337 V», «3,771 V», «685,9 mV») and say the meter shows millivolts below 1 V.
