# Recon E4 · `divider` — «Як резистори ділять напругу?»

Read-only reconnaissance for batch E4. Sources: `docs/volumes/electronics/PATH.md:399-457` (the chapter),
`PATH-ledger.md`, `chapters/_terms.md:42-44`, the design (`docs/superpowers/specs/2026-11-20-electronics-volume-design.md`
§2, §3, §8), `VISUAL.md` (clone copy, `/home/pilot/tmp/rsp-e2/docs/volumes/electronics/VISUAL.md`), `sim/core/README.md`,
the built chapters `resistor` and `resistor-pick` (main) and `meter` (clone). Paths: «main» is
`/home/pilot/tmp/radio-science-pop/app/src/volumes/electronics/`, «clone» is `/home/pilot/tmp/rsp-e2/app/src/volumes/electronics/`.
Nothing here was run. Every number marked «to confirm» still needs a model run.

## 0. Verdict

- Four of the five steps (`two`, `ratio`, `pot`, `load`) are DC boards that read the multimeter on V. They need only what
  main has now: presets with a pot setting, `setSetting`, the multimeter, the tray and `shared/steps`. No new shared
  module is needed. The pot's knob is turned the same way the clone's `meter/twice` turns it: the panel slider calls
  `setSetting(bench.state, 'P1', v)` (clone `chapters/meter/steps/06-twice.ts:73-88`).
- `volume` needs the clone's oscilloscope, the model in time and the sound (E2-9, E2-10). The chapter should be built
  after the clone is merged. It then needs two SMALL shared moves:
  - the meter chapter's scope helpers go to `shared/steps`;
  - `createStepStand` gets the `sound` option.
- `volume` duplicates `meter/twice`, which already has a probe on the wiper's row 15ae and the knob slider. This is the
  main content risk. Recommended split: in `divider/volume` channel 1 is on the **top** of the pot (the player's row
  13ae) and channel 2 on the wiper (15ae), so the reader sees a share of one wave. In `twice` the wiper was compared with
  the speaker (§5, Q1).
- The bench has no 1 kHz tone, only the melody (main `shared/README.md:163`, `player-tone` under «Чого стенд не
  показує»). So the PATH's tone numbers (20 / 63 / 295 mV) become melody crests. This is a deviation, like
  `meter/twice`'s, and gets one line in PATH «Де сценарії свідомо відступили».
- Nothing in the chapter can burn or bulge in normal use (≤ 0.081 W on any resistor, the pot ≤ 8.1 mW). One way to burn
  the pot exists: its wiper on a rail row and an outer leg on the other rail. The proposed layout rules this out (§4.6).

## 1. Step table

The floor is `stand` (`volume.json:39`). The chapter has 3 terms and 1 formula (`PATH-ledger.md:42-44`, `:150`). The
board candidates are in §6.

| Step | The reader does on the bench | What moves / shows, and from which model number | «Ціль» predicate (proposed) | Term / formula |
|---|---|---|---|---|
| `two` | R1 1 kΩ already stands on top (3ae→7ae). The reader puts a 1 kΩ from the tray into the lower gap 7ae→11ae, then swaps it for a 2 kΩ. The step puts the probes: red in 7ae, black in the − rail. | The resistor goes in; the multimeter display (refresh 0.33 s) shows `rowVolts('7ae')`: «4,497 V», then «5,997 V». Optional panel readout: |u| of R1 from `bench.model.reading('R1')`, «4,497 V» / «2,999 V», so that «більший опір бере більшу частину» is seen as two numbers. | `mode === 'V'`, red row `7ae`, black row `-`, R1 in {3ae, 7ae}, exactly one resistor in rows {7ae, 11ae}. Tally keys: `half` (that one is `resistor-1k` and \|V\| in [4,492; 4,502]) and `more` (`resistor-2k`, [5,992; 6,002]), each held 1 s, any order. | «подільник напруги» |
| `ratio` | The board has 2 kΩ on top and 1 kΩ at the bottom. The reader picks a prediction in the panel (segmented «3 V · 4,5 V · 6 V»). The probes become takeable; the reader puts red in 7ae and black on the − side. | The display shows «2,998 V» or «2,999 V»: the last digit is borderline, to confirm (§3). The formula card appears with the takeaway. | A prediction was chosen before the first counted reading. `mode === 'V'`, rows {7ae, `-` or 11ae} either way round, \|V\| in [2,993; 3,003] for 1 s. A wrong guess does not block the goal (Q4). | `U_вих = U × R2 / (R1 + R2)` (Висновок; card in Підписи, Q9) |
| `pot` | The step puts pot P1 (knob at 0,5), J1 from the + rail to the cw row, J2 from the ccw row to the − rail, and the black probe in the − rail. The reader puts the red probe on the middle leg's row and turns the slider «Ручка» 0…1 in the panel. | The knob turns 300° after the setting within 0,15 s (`shared/parts/pot.ts:34`, `:71`). The display follows the model: «0,002 mV» at 0 (to confirm), «4,499 V» at 0,5, «8,999 V» at 1. Optional `stats`: «нижня частина доріжки X kΩ / верхня Y kΩ» = setting × 10 kΩ, the model's own input. | `mode === 'V'`, red row = wiper's row, black row `-`. Tally `zero`: knob ≤ 0,02 and \|V\| ≤ 0,005 V. Tally `full`: knob ≥ 0,98 and \|V\| ≥ 8,99. Tally `mid`: knob in [0,45; 0,55] and \|V\| in [4,0; 5,0]. Each held 1 s, any order. | «змінний резистор» |
| `load` | The board is `pot` plus J3 (row 7fj to the − rail). The knob is fixed at 0,5 (no slider) and the step puts the probes (red on the wiper's row, black on the − rail). The reader takes a 4,7 kΩ from the tray and puts it across the channel, wiper row 7ae → 7fj (e7 → i7). | The display drops from «4,499 V» to «2,937 V» (fixture `pot-mid.json`, 2,9369 V). Nothing warms. | Tally `open`: no part joins 7ae–7fj and \|V\| in [4,494; 4,504] (counts from entry). Tally `loaded`: exactly one `resistor-4k7` in rows {7ae, 7fj} and \|V\| in [2,932; 2,942]. Each held 1 s. | «навантаження» |
| `volume` | `AMPLIFIER_PRESET` as it stands; the player plays, the switch is closed, and the scope comes in. The reader puts ch1 (lime) on the player's row 13ae (the top of the pot) and ch2 (magenta) on the wiper's row 15ae, then moves «Гучність» from near 0 to the top. | Both traces come from the model in time (24 000 samples a second). ch1 stays about 0,29 V; ch2 grows from about 0 to ch1's height. Crest readouts, max \|v\| over 0,5 s per channel (`ScopeModel.peak`): about 0,04…0,06 V against about 0,29 V at the middle, i.e. ~21 %, not 50 %. That links back to `load`. The speaker plays louder. | ch1 row 13ae and ch2 row 15ae together for ≥ 3 s, the player playing, the switch closed. Knob ≤ 0,1 held 1 s; knob ≥ 0,99 held 1 s (optional: ch2 crest ≥ 0,9 × ch1 crest then). | — («регулятор» short name starts here: `PATH-ledger.md:76-77`) |

Words that must wait for their step (`_terms.md:42-44`, forms `\bподільник\w*`, `\bзмінн\w* резистор\w*`,
`\bнавантаж\w*`):

- no «подільник» before `two`;
- no «змінний резистор» before `pot`;
- no «навантаж-» in `two`, `ratio` or `pot`. This covers panel words too: «навантаження» is the bench's habitual word for
  the load share, and earlier scripts avoided it.
- `pot` at 0 reads in mV, not μV: the prefix «мікро-» only comes in `capacitor/capacity` (the `resistor/law` deviation in
  PATH).

## 2. Capability check

| Need | Status | Where / what |
|---|---|---|
| A step's board with a pot and its setting | HAVE | `PresetPart.setting`: main `sim/board/presets.ts:35-36`, applied at `:77`. `bench.preset` / `stand.board`: main `shared/steps/stand.ts:57-58`, `shared/README.md:106-110`. Tested divider board: sandbox `DIVIDER`, main `_dev/chapters/_sandbox-electronics-bench/scene.ts:114-119`; «5,997 V» in main `shared/instruments/__tests__/probe.test.ts:131`. |
| Turning the knob from the panel | HAVE | `setSetting`: main `sim/board/seat.ts:182`. The driver solves again on a changed setting (main `shared/model/driver.ts:93`, `:202-209`). The knob look follows `state.settings`: main `shared/bench/on-board.ts:220`, `shared/parts/pot.ts:34`. Pattern: clone `chapters/meter/steps/06-twice.ts:73-88`; documented in clone `shared/README.md:88`, `:541`. VISUAL §4.3 (`VISUAL.md:316-321`): the slider turns the knob, not the hand. |
| Knob slider helper shared by prologue, meter, divider×2 | SMALL | New `shared/steps/knob.ts` with `knobSlider(bench, id, label, partId, marks)`. It wraps the twice pattern: `onInput` / `onChange` call `setSetting`, and the `fmtPercent` format. The third and fourth users justify the move (the E3-7 rule, main `shared/README.md:512-513`). |
| Multimeter V: dial, readout, probes put by the step or by the reader | HAVE | main `shared/steps/meter.ts:16`, `:34`; `multimeter.put` (main `shared/README.md:300`); the display is read at once on `snap` (`:313`). Dial items `['off','V']` only, so nothing can be shorted on «A». |
| Tray with 1 kΩ, 2 kΩ, 4,7 kΩ (and the pot, if the reader places it) and the phone dock | HAVE | main `shared/steps/dock.ts:14`; tray rows by size (`VISUAL.md:585-603`). Note: `trayLabel('pot-10k')` is «10 kΩ», the same as a 10 kΩ resistor (main `shared/hand/tray.ts:79`). The chapter's dock label function must name the pot. |
| Goal maths: rows, windows, tally | HAVE | main `shared/steps/goals.ts:10`, `:21`, `:27`, `:34`, `:51`. |
| Hand policy by kind | SMALL | `kindOf` returns `'resistor' \| 'led' \| 'jumper' \| 'other'` (main `shared/steps/policy.ts:56`), so the pot is `'other'`. Add `'pot'`; the E4 capacitor chapters need `'capacitor'` anyway. `probes` is a boolean (`policy.ts:16`): for `ratio`, re-assign `bench.hands.policy` once a prediction is made (HAVE). |
| Model readout in the panel (R1's \|u\|) | HAVE | `bench.model.reading(id)` (main `shared/model/driver.ts:119`). Formatting: main `chapters/resistor-pick/parts/readouts.ts:17` (`formatReading`). It is chapter-local; a third user should move it to `shared/steps`. |
| Prediction control | HAVE | `segmented` (`docs/UI_API.md:226`), as `meterSwitch` builds one. |
| Formula card with subscripts | HAVE | Dock `note` with the takeaway: main `chapters/resistor-pick/steps/03-calc.ts:86` (rich text for `U_LED`). Same for `U_вих`, `R1`, `R2`. |
| Callouts over a socket or a part | HAVE | `board.socketWorld` and the part's `hit` box: main `chapters/resistor/steps/06-share.ts:55-65`; clone `chapters/meter/parts/marks.ts:29` (`overSocket`). |
| Oscilloscope, two probes, one scale, crests, held-page window | HAVE (clone) | clone `shared/instruments/scope.ts:97` (`configure`), `:106` (`put`), `:108` (`chart`); scope input 1 MΩ, `scope.ts:73`; `peak` at `scope-model.ts:364`; `still` / `STILL` in `shared/model/driver.ts:146-155`, `:189`; the model in time in `shared/model/live.ts:45`, `:113`. |
| Scope words, chart board, crest stats for a second chapter | SMALL | Move clone `chapters/meter/parts/scope.ts` (`voltsText` `:42`, `scopeWords` `:69`, `scopeBoard` `:83`, `crestStats` `:98`) into `shared/steps/scope.ts`, with a REUSE «Копії» row, the way E3-7 moved `resistor`'s pieces. The capacitor and filter chapters will want it too. |
| Sound in a step-stand chapter | SMALL | The clone's `mountBench(ctx, options)` has `sound` per mount (clone `shared/bench/index.ts:118-127`, `:320`). Main's `createStepStand` calls `mountBench(ctx)` with no options (main `shared/steps/stand.ts:58`). After the merge: pass `{ sound }` through, and move the player's `playing()` / `play()` from clone `chapters/meter/stand.ts:59-61` into the step stand. |
| Inside view of the pot (track and wiper) | NEW, optional | No `shared/inside` view for `pot` exists, and the door leaves a kind with no view whole (`VISUAL.md:637-640`). Not recommended for E4 (Q8). |
| QA drivers | HAVE | main `chapters/resistor-pick/qa/interactions.mjs:188` (`fromTray`), `:260` (`probes`), `:277` (`slideTo`). The scope's probes as in the clone's `chapters/meter/qa/`. Board tests as main `chapters/resistor/__tests__/boards.test.ts:37` (`presetState` + `setSetting(s,'SW',1)` + solve). |

## 3. Model numbers the script will need

The bench's fixed parts: the battery 9 V behind 1,5 Ω (`sim/core/README.md:200`), the switch and every jumper 1 mΩ
(`:209-210`), and at least 1 mΩ in each part of the pot's track (`:208`, `:241`). The multimeter on V is ideal (main
`shared/README.md:303`). Arithmetic below uses these values; every row says how to confirm it.

| Number | Value | Source / call |
|---|---|---|
| `two` 1k / 1k, middle row | 9 / 2001,503 Ω = 4,49663 mA; × 1000,001 Ω = **4,4966 V → «4,497 V»** | Hand calculation; to confirm: `solveDC` of `netlistOf(presetState(layout, TWO))` with `SW` = 1, `rowVolts('7ae')`. Ledger: 4,50 V (`PATH-ledger.md:287`). |
| `two` 1k / 2k | **5,9970 V → «5,997 V»** | Already tested: main `shared/instruments/__tests__/probe.test.ts:131`; `shared/README.md:241`. From an ideal 9 V: 6,000 V (`sim/core/__fixtures__/divider.json`, `PATH-ledger.md:246`). |
| Battery under the divider | 8,993 V (1k/1k), 8,996 V (1k/2k) | 9 − 1,5 Ω × I. The «8,99 V» of `PATH.md:414`. To confirm, `reading('BAT').u`. |
| R1's \|u\| (optional readout) | 4,4966 V (1k/1k), 2,9985 V (1k/2k) | `reading('R1').u`, to confirm. |
| `ratio` 2k / 1k | 2,998498 mA × 1000,001 Ω = **2,99850 V**. That is 7·10⁻⁷ V above the rounding edge, so «2,999 V» or «2,998 V» | To confirm by a model run before writing the last digit. Window [2,993; 3,003]. Ledger: 3,00 V (`:287`). |
| `pot` without load | I = 9 / 10 001,503 Ω = 0,89986 mA. Knob 0: (1 mΩ track + 1 mΩ J2) × I = 1,8 μV → «0,002 mV». 0,25 → 2,2497 → «2,250 V». 0,5 → 4,4993 → «4,499 V». 0,75 → 6,7490 → «6,749 V». 1 → 8,9986 → «8,999 V» | Hand calculation; to confirm per setting. Ledger: 0 / 2,25 / 4,50 / 6,75 / 9,00 V (`:287-288`). Battery-only oracle `pot-ccw.json`: 0,9 μV on the wiper. |
| Pot dissipation | 9² / 10 kΩ ≈ 8,1 mW = 0,04 of its 0,2 W | `sim/core/README.md:208`, `:565`; fixture `pot-mid.json` P1 `p` 9,07 mW with the load. |
| `load` 4,7 kΩ at 0,5 | **2,9369 V → «2,937 V»**. Load current 0,6249 mA; battery 1,2123 mA. 4,7 ∥ 5 kΩ = 2,4227 kΩ. Thevenin: 4,4993 V behind ≈ 2,5004 kΩ | Fixture `sim/core/__fixtures__/pot-mid.json` (ngspice, battery only); the bench's ~4 mΩ more shift the 6th digit (to confirm). `PATH-ledger.md:248`. |
| `load` with other loads (Д: «десятки кілоомів і більше») | 47 kΩ → 4,4993 × 47 000 / 49 500 ≈ **4,272 V**; 100 kΩ → **4,390 V**; 1 kΩ → **1,285 V** | Thevenin arithmetic; to confirm by `solveDC` with `resistor-47k`, `resistor-100k`, `resistor-1k`. |
| `volume`, melody: crests on the wiper (whole 8 s run) | 0,0195 / 0,0357 / 0,0605 / 0,1206 / 0,2841 V at 10 / 25 / 50 / 80 / 100 % | `PATH-ledger.md:367-368`; `chapters/meter.md:390-392` (E3-2 run). |
| `volume`, melody: crest of the wiper over 0,5 s windows | 0,012…0,019 / 0,023…0,036 / 0,039…0,061 / 0,079…0,121 V at 10 / 25 / 50 / 80 % | `chapters/meter.md:401-402`. The value at 100 % is not listed: to confirm. |
| `volume`: player row (top of the pot) | up to 0,289 V at 50 % | `PATH-ledger.md:316`. At 100 % it equals the wiper, ≈ 0,284 V; at 10 % unknown: both to confirm. |
| Share on the wiper at 50 % | 0,0605 / 0,289 ≈ 0,21. The unloaded divider would give 0,5, i.e. 0,145 V | To confirm. Call: `Transient(netlistOf(presetState(AMPLIFIER_PRESET)) + SCOPE_INPUT on 13ae and 15ae, { dt: 1/24000, fails: false })`, `start('dc')`, `set('P1', v)`, `run(n, [{ node: row 13ae }, { node: row 15ae }])`; max \|v\| per 0,5 s from 1 s to 9 s. As in clone `chapters/meter/__tests__/boards.test.ts:159`. |
| `volume`: the scope probe's 1 MΩ | 0,0605 → 0,0606 V on the wiper | `chapters/meter.md:406-407`. |
| `volume`, tone 1 kHz (ngspice; Д only, not shown on the bench) | 20,1 / 63,1 / 294,8 mV at 10 / 50 / 100 % | `sim/core/__fixtures__/amplifier-v10.json`, `-v50`, `-v100`; `sim/core/README.md:803-812`; `PATH-ledger.md:262`. |
| `volume` held page | warm-up = `STILL.warmup(tauMax())`. The sandbox amplifier has τ 0,045–0,055 s, so 5τ ≈ 0,25 s, which rounds up to 1 s (one half bar) | clone `shared/model/driver.ts:189`; clone `shared/README.md:416-422`. To confirm `model.tauMax()` on `AMPLIFIER_PRESET`. |
| Nothing burns in the amplifier at any knob | — | `sim/core/README.md:826-840`. |

## 4. Risks

1. **Camera framing.**
   - `two`, `ratio` and `load` need the tray, so they use shot `stand`, as `resistor-pick/calc` does (P ≈ 21 px at
     1280 × 720: `VISUAL.md:705`). Steps where the reader places probes need shot `meter`: the resting probes lie by
     the multimeter, outside `board` (`VISUAL.md:691`).
   - The pot (case 1,1 across, knob top 0,84: `shared/parts/pot.ts:17-25`) hides about 0,35–0,6 units behind itself
     from the ≈ 55° shots. With the pot on line b, the + rail sockets of its columns are hidden. So J1 must land in the
     cw column, which is just outside the case, and the probe sockets must be in front of the pot (d/e lines).
   - No electrolytics on the DC boards. In `volume`, C1 (a11) and C2 (a7–a10) stand left of the pot. ch1 and ch2 should
     go into d13 and d15, in front; a13 is close behind the case's left edge from shot `scope`'s right-hand camera.
   - Add a sight-line test like main `chapters/resistor/__tests__/shot.test.ts` and clone
     `chapters/meter/__tests__/shot.test.ts`, and look at 820 × 1180 and 1180 × 820. That is what bit E3: `resistor/amp`
     and `meter/amps`.
2. **Phone.**
   - The `phone` shot covers the whole field (`VISUAL.md:908-914`). Tray kinds become dock buttons; the pot's needs its
     own label (§2).
   - The multimeter readout sits in the dock and the probes rest in front of the board (`VISUAL.md:941-943`). The pot
     has no grips (`VISUAL.md:525-527`) and is carried whole if the reader places it.
   - `volume`: the chart is under «Графіки». The crest `stats` block must sit right under the slider (the meter/twice
     review lesson, clone `chapters/meter/README.md`, «Steps», row `twice`).
   - Amplifier with sound on a phone: an estimated 0,6–0,9× real time, with plan decision 17 still open (clone
     `docs/volumes/electronics/reports/batch-E2.md:239-241`). `volume` inherits that stutter risk.
   - `sound` is chosen per mount, so with `sound: true` the model in time runs during the DC steps too (clone
     `shared/bench/index.ts:120-125`). The DC boards are small, so the cost should be small.
3. **Frozen page (`?freeze`).**
   - Only `volume` draws traces. The held window starts on a half bar (1 s: bass and kick), so two frames at different
     knob settings show the same stretch of music. That is good for compares.
   - The crest readouts may read «—» on a held page. `peak` uses only samples fed live (clone
     `shared/instruments/scope-model.ts:330-341`, `:364-378`), and `hold()` (`:424`) draws the still window without
     feeding the peaks. Check meter/twice's held snapshots. If they show «—», the SMALL fix is to let `hold` feed the
     window's chunk peaks.
   - The DC steps read the display at once on `snap` (main `shared/README.md:313`).
4. **Hue families ≤ 4** (`VISUAL.md:143-149`).
   - DC steps: blue (room, violet jumpers), cyan (grips), red (coral probe, red bands), yellow (gold bands and the 4,7 kΩ
     yellow band). The pot is unsaturated (`slate`, `steel`, `mist`). No LED in these boards. Safe.
   - `volume` can reach five: blue, cyan, lime ch1, magenta ch2, and the red LED «on» with the coral speaker lead. The
     traces are thin and the LED glows dim at 3 mA. The precedent is meter/twice in the clone; run `chapter-check` on
     `volume` and do not assume.
5. **Draw calls ≤ 350** (`VISUAL.md:983`). The DC boards hold at most about 6 parts plus the meter: far below. The
   amplifier with the scope and sound reached ≤ 275 at most in the sandbox (clone `reports/batch-E2.md:238`).
6. **Safety and burns.**
   - 9 V only. The largest DC dissipation is 1 kΩ across 9 V, 0,081 W (`ok`). The pot takes at most 8,1 mW.
   - The dial offers V only, so there is no short through «A».
   - One trap: the pot's wiper in one rail row and an outer leg in the other. The lower part of the track then lies
     across the battery, peaking at 9² / (4 × 1,5 Ω) ≈ 13,5 W at a setting of 0,00015. The pot's only limit is the whole
     track's 0,2 W (`sim/core/README.md:565`); τ is 10 s (`:585`).
   - This cannot happen if the step presets the pot. If the reader places it, it cannot happen as long as the two rail
     jumpers end 4 P apart and no other row is tied to a rail.
   - No electrolytic is reversed or over-volted in this chapter, and the amplifier's cans are not takeable in `volume`
     (policy: probes only). Nothing in the chapter needs the bulge or the wisp; no recipes.
7. **The inside view.**
   - PATH puts the track only in Д (`PATH.md:428`: «доріжка опору підковою й повзунок»), and the floor is `stand`. The
     takeaway of `pot` («повзунок ковзає доріжкою й ділить її») is otherwise unseen on a closed case. The cheap honest
     substitute is a `stats` block «нижня / верхня частина доріжки» from the setting.
   - If a cutaway is wanted later, it is a NEW `shared/inside/track.ts` plus an entry in `shared/dive/cutaway.ts`: a
     horseshoe carbon track, the wiper arm at `knobAngle`, and electrons per part of the track. The upper and lower
     currents come from `rowVolts` and the setting, and they differ under load (honest and vivid in `load`).
   - Geometry to copy, with a REUSE «План» row: the wound ring and travelling knob of
     `app/src/volumes/electricity/chapters/lab-pv/parts/bench.ts:55-61`, or the rheostat of
     `electricity/chapters/transformer/parts/meter-console.ts:54-77`.
8. **Number precision in text.**
   - The display shows four digits, so the Висновок should quote «4,497 V», «5,997 V», «2,937 V», or say «майже 4,5 V».
     PATH's «4,5 V і 6 V» and «рівно 3 V» need the same rewording as the E3 scripts did.
   - `ratio`'s last digit is borderline (§3).
9. **Repeat of earlier steps.**
   - `two` and `ratio` repeat `resistor/share`'s «напруга ділиться» and add the ratio.
   - `volume` repeats `meter/twice` (§0). Record the split in PATH's deviation list.

## 5. Open questions and recommended defaults

1. **The overlap of `divider/volume` and `meter/twice`.** Default: ch1 on the player's row 13ae (the top of the
   divider), ch2 on the wiper's row 15ae, one scale 0,1 V a division, 5 ms a division (as `meter/wave`), and both
   crests in the panel. The goal is knob ≤ 0,1 and ≥ 0,99. Record it as a deviation (ch1 is not in PATH's Дія).
2. **Tone vs melody.** Default: the melody, the only thing the bench plays. The Висновок uses crests over 0,5 s («у
   середині ручки — близько 0,06 V із 0,29 V»). Д keeps ngspice's tone (63 mV instead of 150 mV) as the reference.
   Deviation line in PATH.
3. **Who places what in `two`.** Default: R1 1 kΩ on top is preset. The reader puts the lower 1 kΩ, then swaps it for
   2 kΩ. The step puts the probes. Add the optional panel readout of R1's voltage.
4. **The prediction in `ratio`.** Default: a segmented choice «3 V · 4,5 V · 6 V» unlocks the probes, and any choice
   counts. The takeaway then shows the formula and the reading. Both resistors are preset.
5. **The pot in `pot`: placed by the reader or preset.** Default: preset, with the black probe put by the step. The
   reader puts the red probe on the middle leg (PATH's «щуп — на середню ніжку») and turns the slider. Shot `meter`
   (probes at rest in frame). This removes the 13,5 W trap and keeps one action.
6. **A second load in `load`.** Default: only 4,7 kΩ (PATH). Д quotes 47 kΩ → about 4,27 V (to confirm), without a
   tray slot.
7. **`sound` for the whole chapter.** Default: on (`volume` needs the speaker). It forces the build to wait for the
   merge of the clone.
8. **The pot's inside view.** Default: none in E4. Use the `stats` split of the track instead.
9. **Formula card for `ratio`.** `PATH.md:420` and `PATH-ledger.md:150` say «Висновок» only, while `resistor/law` and
   `resistor-pick/calc` also show a dock card. Default: add the card with the takeaway, for consistency, and update the
   ledger's field.
10. **`pot` at knob 0 reads «0,002 mV», not «0,000 V».** Default: the goal window ≤ 0,005 V. The text says «нуль»; Д
    may name the 1 mΩ end of the track (`sim/core/README.md:241`).

## 6. Board candidates (to confirm by `presetState` and main `shared/bench/__tests__/presets.test.ts`)

- **TWO / RATIO** — the sandbox `DIVIDER` (main `_dev/chapters/_sandbox-electronics-bench/scene.ts:114-119`):
  - J1 from `+3` to `a3`, R1 at `b3` (to b7), R2 at `c7` (to c11), J2 from `e11` to `-11`.
  - Red probe in `a7` (free; probe test `:131`), black in `-7`.
  - `two` leaves R2 out (the reader's gap is 7ae→11ae, sockets b7…b11 / c7…c11 / d7…d11 / e7…e11 minus taken ones).
  - `ratio` swaps the values: R1 `resistor-2k`, R2 `resistor-1k`.
- **POT** — layout:
  - P1 `pot-10k` at `b5`, `o` 0: ccw b5, wiper b7, cw b9; setting 0,5.
  - J1 from `+9` to `a9` (cw row 9ae).
  - J2 from `e5` to `-5` (ccw row 5ae).
  - Probe sockets in front of the case: red in `d7` or `e7`, black in `-3`.
  - Clearances: the case covers columns 5,17…8,83 and lines a–c (`POT.radius` 0,55). J1 at column 9 and J2 at column 5
    clear it by 0,05, the same margin `AMPLIFIER_PRESET`'s J1 at column 17 beside P1 already passes (main
    `sim/board/presets.ts:151`, `:163`).
- **LOAD** — POT plus J3 from `j7` to `-7`:
  - The reader's 4,7 kΩ goes from `e7` across the channel. `o` 1 puts leg 1 on grid +4, i.e. `i7` (5 P on the board,
    within the 4…6 P reach). Its body spans z ≈ 0,09…0,82, clear of the case (z ≤ −0,65).
  - Red probe in `d7`.
- **VOLUME** — `AMPLIFIER_PRESET` unchanged (main `sim/board/presets.ts:145-174`):
  - P1 at `b17`, `o` 2: ccw 17ae, wiper 15ae, cw 13ae with `pl+` in c13.
  - Free sockets: 13ae → `d13`, `e13`, `a13`; 15ae → `d15` (`e15` holds J2; `a15`, `c15` lie under the case).
  - Callouts «плеєр» / «повзунок» over `d13` / `d15` until each is probed, as twice does (clone
    `chapters/meter/parts/boards.ts:40`).
