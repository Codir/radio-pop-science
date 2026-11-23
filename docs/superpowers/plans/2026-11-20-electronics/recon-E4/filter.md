# Recon E4 — chapter `filter` («Чому конденсатор пропускає музику, а батарейку — ні?»)

Read-only reconnaissance, 23.11.2026. Main = `/home/pilot/tmp/radio-science-pop` (`main` at 4e6b986); clone =
`/home/pilot/tmp/rsp-e2` (7ad47b1 plus uncommitted meter fixes). Paths below are repo-relative; a `clone:` prefix
means the file exists only in the clone. Nothing was run but arithmetic in `python3`.

Sources: `docs/volumes/electronics/PATH.md:620-697` (the chapter), `PATH-ledger.md:54-56,151-152,170,190,257,302-303,
310,404-411`, `chapters/_terms.md:54-56`, `PATH-NOTES.md` §6 (tone control), design spec §2, §3, §8
(`docs/superpowers/specs/2026-11-20-electronics-volume-design.md:42-114,249-296`), `clone:docs/volumes/electronics/VISUAL.md`,
`app/src/volumes/electronics/sim/core/README.md`, the built chapters `chapters/resistor`, `chapters/resistor-pick`
(main) and `clone:chapters/meter`.

**Headline findings**

1. Every step needs the oscilloscope, the model in time and (steps 4–6) the speaker in sound — all three exist only in
   the clone (`clone:shared/instruments/scope*.ts`, `clone:shared/model/live.ts`, `clone:shared/instruments/speaker.ts`);
   main's `mountBench(ctx)` has no options and a stand-in scope (`shared/bench/index.ts:4,284`). The clone must be
   merged before `filter` is built.
2. PATH's numbers for `highs` (200 Hz, 2 kHz) ignore the electrolytics' series resistance the model carries (2.653 Ω in
   100 μF, 26.53 Ω in 10 μF, `sim/core/README.md:443-446`). With it: ≈ 149 Hz and ≈ 461 Hz, and 10 μF also cuts the
   whole melody to ≈ 0.21 of what 470 μF gives at 1 kHz — the reader hears «quieter», not only «less bass».
3. `lows` and `tone` must play through the amplifier to be heard, and the amplifier's volume control loads the RC
   (≈ 6–7 kΩ at the knob's middle, estimate). `tone`'s «145 Hz» is the unloaded formula; on the board the edge stops
   near ≈ 0.4 kHz and the music drops to ≈ 0.35–0.39 (estimates, to confirm by a model run).
4. `block`'s switch-on spike cannot survive a held frame: on `?freeze` the bench replaces the sweep with
   `model.still`, which starts from the operating point (capacitor already charged → a flat line).
5. The live stream has no `substeps` (`clone:shared/model/live.ts:155-160`), so the hi-hat through the 1 kΩ/100 nF
   low-pass is over-attenuated at 24 kHz (−14 % at 5 kHz, −65 % at 10 kHz); substeps on amplifier boards are
   unaffordable (phone already 0.6–0.9× real time, `clone:docs/volumes/electronics/reports/batch-E2.md:241`).

## 1. Steps

PATH: 6 steps, ≈ 11 min, floor `stand` (`volume.json:42`), 3 terms, 1 new formula. Numbers in «…» are model or
fixture numbers (section 3 says where each comes from); «est.» = my arithmetic, to confirm by a model run.

| Step | Reader does on the bench | What moves / glows / draws (model) | «Ціль» predicate (proposal) | Term / formula |
|---|---|---|---|---|
| `block` | puts film 1 μF and 10 kΩ in series from the + rail (via a jumper) to the − rail, the probe on the resistor's row, closes the switch (phone: dock toggle) | chart: single-shot sweep, ch2 (resistor) jumps to «8.999 V» and decays with τ «9.90 ms» (10 kΩ ∥ the scope's 1 MΩ), «3.28 V» at 10 ms, «0.058 V» at 50 ms, then «71 μV» (leak 7.2 nA) — est.; ch1 (+ rail after the switch) a step 0 → 8.98 V. No glow, no sound (speaker unplugged) | film-1u and resistor-10k each alone between the feed row and the probe's row/ground (`electronics-board.parts`); probe in the R row (`rowsOf(oscilloscope.sockets)`); a sweep captured after a closing with ch2 max ≥ 8.5 V and the last 10 % of points ≤ 0.2 V (`oscilloscope.model.state()` `max`, `points`, `trigger.found`); held 1 s | — / repeats `τ = R × C` in «Докладніше» only (ledger:151) |
| `pass` | replaces the battery's feed jumper by the player's plug `pl+` (its `pl-` preset in the − rail); looks at «до/після» | chart, sweep 5 ms/div, 0.1 V/div: ch1 player's row (melody, crest ≤ 0.29 V), ch2 after 1 μF on 10 kΩ — same wave, high-pass at «16.0 Hz» est. (41 Hz bass passes 0.93, 110 Hz 0.99). A −9 V blip on ch2 if the step left the cap charged at entry (honest, decays in 50 ms) | `pl+` in the cap's input row, no jumper from a rail there; ch1/ch2 in input/output rows (step puts them); player playing 3 s with crest(ch2, 2 s) ≥ 0.1 V and crest ratio ch2/ch1 within a window from the model (expected ≈ 0.93–1.0) | — / — |
| `coupling` | in the playing amplifier (`AMPLIFIER_PRESET`, knob 0.5) puts ch1 on the output row 7ae/7fj and ch2 on the speaker row 10ae (C2's two legs) | chart 1 V/div, `ground` −2 div (screen −2 … +6 V): ch1 waves around «3.73 V» (playing mean, fixture), ch2 around «0.0003 V»; amplitudes «1.096 V» / «1.023 V» for the tone (fixture); melody crests 0.61–0.98 V on the speaker (ledger:319). LED «on» lit, music sounds | ch1 row ∈ {7ae, 7fj}, ch2 row = 10ae (either probe order or fixed — open Q8), player on, knob 0.25…0.75, 2 s with `min[ch on 7] ≥ 2 V` and ch on 10ae `min ≤ −0.1 V`, `max ≥ 0.1 V` (`state()`) | розділовий конденсатор / — |
| `highs` | swaps C2 470 μF for 100 μF, then for 10 μF (tray / dock buttons), listens to the bass | sound: bass fades; chart ch2 on the speaker row (step-put), 10 ms/div; panel crest over 0.5 s (`peak`). Edge with the model's ESR: 470 μF «39.5 Hz», 100 μF «149 Hz», 10 μF «461 Hz»; at 1 kHz 0.933 / 0.743 / 0.210, at 100 Hz 0.869 / 0.418 / 0.049 (est.; the 470 μF 1 kHz value equals the fixture's 1.0227/1.0957). A thump on every new can (3.77 V charges it through the speaker: ≤ 0.35 A for ~1 ms) | the speaker's minus-row can is `electrolytic-100u-16v` ≥ 3 s, then `electrolytic-10u-16v` ≥ 3 s, plus in the output row, speaker in circuit (`speaker.inCircuit`), player on; order 100 → 10 or either | фільтр / forward ref. to `f = 1/(2π×R×C)` in «Докладніше» (ledger:152 lists `highs` as a repeat, though `tone` comes later) |
| `lows` | moves `pl+` to a new row, puts 1 kΩ from it to VR1's input row (13ae) and 100 nF film from 13ae to ground; listens to the hi-hat | sound: hat dims; chart ch1 player row / ch2 13ae, 1 ms/div 0.1 V/div: the fuzz disappears from ch2. Unloaded fixture: 0.998 / 0.847 / 0.157 at 100 Hz / 1 kHz / 10 kHz; on the amplifier (VR1 loads it) edge ≈ 1.8 kHz, passband ≈ 0.85–0.87 (est.) | resistor-1k between the player's row and 13ae, film-100n (or ceramic-100n) between 13ae and a ground row, player on, speaker in, 3 s | — / — |
| `tone` | turns a 10 kΩ pot in series with the 1 kΩ (step-preset as a rheostat) with a panel slider; listens, watches ch2 | sound: hat goes, then the music thins; ch2 smoother as R grows. Formula: 1 kΩ → «1.59 kHz», 11 kΩ → «145 Hz» (1.54 kHz / 144 Hz with the player's 32 Ω). On the amplifier: ≈ 1.8 kHz → ≈ 0.37–0.41 kHz and passband 0.86 → 0.35–0.39 (est.) | pot P2 setting ≤ 0.1 held 1 s and ≥ 0.9 held 1 s (either order), player on, speaker in | частота зрізу / `f = 1 / (2π × R × C)` in «Висновок» + card in «Підписи» |

## 2. Capability check

HAVE = landed; SMALL = a small shared addition; NEW = a new shared module. Everything marked `clone:` is HAVE only
after the merge (finding 1).

### Common to every step

- Bench, preset boards, tray, hand, switch: HAVE — `shared/bench/index.ts:165,182-184,572-580`;
  `shared/steps/stand.ts:57`, `dock.ts:14,30` (`trayButtons`, `switchToggle`), `policy.ts:19,24,40-42` (`flip` per
  spec), `goals.ts:10-51` (`rowsOf`, `across`, `within`, `createTally`).
- `createStepStand` with the speaker: SMALL — it calls `mountBench(ctx)` with no options
  (`shared/steps/stand.ts:57-58`); add `StepStandOptions.sound` → `mountBench(ctx, { sound })`
  (`clone:shared/bench/index.ts:127,320`).
- Oscilloscope (two probes, chart, sweep/roll, per-channel scale, 1 MΩ input, crests): HAVE —
  `clone:shared/instruments/scope.ts:73,93-108`, `scope-model.ts:46-65,88-97,364-377,567-616,643`.
- Scope chart words, crest stats, player toggle: SMALL — they live in the meter chapter
  (`clone:chapters/meter/parts/scope.ts:69,83,98`; `clone:chapters/meter/parts/dock.ts:17,75`) and a chapter may not
  import another; move them to `shared/steps/scope.ts` and `shared/steps/dock.ts` as E3-7 did (`REUSE.md:110`).
- A pot knob slider: SMALL — the meter writes `setSetting(bench.state, 'P1', v)` inline
  (`clone:chapters/meter/steps/06-twice.ts:86-87`; `sim/board/seat.ts:182`); `divider` (E4) needs the same:
  `shared/steps/knob.ts` (`knobSlider(bench, id, partId, label)`).
- Speaker in sound, mood silenced while plugged: HAVE — `clone:shared/instruments/speaker.ts:105,137`.

### Per step

| Step | Need | Status |
|---|---|---|
| `block` | film 1 μF, 10 kΩ, jumper on the tray; DC model | HAVE (`sim/core/README.md:442`; tray `shared/bench/index.ts`) |
| | the switch-on transient on the scope | HAVE live (`clone:shared/model/live.ts:207-229`: a new solve gives the stream the board, the model goes on (`:222`)) |
| | a single-shot capture that stays on screen | HAVE live: `trigger.auto: false` keeps the last sweep (`clone:scope-model.ts:407-411`); settings/preset clear it (`:257-264,307-313`) |
| | the 0 → 9 V edge visible at the left of the sweep | SMALL — pre-trigger (`ScopeSetup.pretrigger`, divisions before the edge): `sweep` draws from `at` (`scope-model.ts:413`), `hold` likewise (`:439`); without it the trace starts already at ≈ 9 V |
| | the capture on a held frame (`?freeze`, QA snapshots) | SMALL — `held()` replaces any sweep by `model.still` from the operating point (`clone:shared/bench/index.ts:597-616`, `driver.ts:427-446`); keep a single-shot capture (auto false + found) instead of the still, or give `StillWindow` `start: 'zero'` + `warmup: 0` |
| `pass` | `pl+`/`pl-` plugs moved by hand; player level | HAVE (`sim/board/netlist.ts:34`; hand gesture 2 on `lead:pl+`, `clone:shared/README.md:302-309`) |
| | two-channel sweep of melody; crests | HAVE (`clone:scope-model.ts:364-377`) |
| `coupling` | both probes in amplifier rows; DC offset vs zero on one screen | HAVE — one `ground` for both channels (`scope-model.ts:58-59`) is enough at 1 V/div, ground −2 |
| | «around 3.8 V» as a number | optional SMALL — `ScopeModel.mean(channel, s)` next to `peak`; the axis ticks may suffice |
| `highs` | swap C2 by hand on desktop and phone | SMALL (chapter data) — `AMPLIFIER_PRESET` puts C2 on 3 P (`sim/board/presets.ts:162`, a7→a10); a can from the tray stands on 1 P and a phone cannot re-seat a radial leg (`clone:VISUAL.md:932-935`). Chapter's own board: e.g. a jumper 7ae→9ae and C2 at a9→a10, or `spk+` moved so the can fits 1 P; prove it with `presetState` and the bench presets test (`shared/bench/__tests__/presets.test.ts`) |
| | polarity guard | HAVE — `flip: false` (`shared/steps/policy.ts:40-42`) |
| | speaker crest readout | HAVE after the SMALL move of `crestStats` |
| `lows` | two new parts between player and VR1 on a crowded right half (P1's case over 13–17 b/c; plugs `pl+` c13, `pl-` c17, `spk+` c10, `spk-` a17 — `presets.ts:145-175`) | SMALL (chapter data) — a variant board, same tests; `pl+`'s lead reaches only the right half (`clone:VISUAL.md:114-115`) |
| | honest hi-hat attenuation | SMALL if wanted — plumb `substeps` into `createLive` → `createStream` setup (`clone:live.ts:155-160`; protocol `clone:shared/sound/protocol.ts:26-27`, handler `handler.ts:67-77`, fixed per stream: `stream.ts:146`) — but see risk 4.8: unaffordable on amplifier boards |
| `tone` | a second pot as a rheostat | HAVE as data — preset P2 `pot-10k` across the channel with `o: 1` (legs d·f·h of one column: wiper and cw in one row, `clone:VISUAL.md:244`); pots have no movable legs, so the step presets it |
| | knob slider | SMALL (`knobSlider`, above) |
| | response numbers (edge at the knob's ends) | test-only — `Transient` with `player-tone` swapped in through `createBenchModel({ fixed })` (`clone:shared/model/driver.ts:63-64`) or a raw netlist, `substeps: 8` (`sim/core/README.md:685-691`) |

No NEW shared module is required. An inside view is not part of this chapter (floor `stand`).

## 3. Model numbers the script will need

| Number | Source / call | Value |
|---|---|---|
| amplifier output at rest; electrolytics 8.34 / 3.77 / 0.69 V | `sim/core/__fixtures__/amplifier-op.json` (ledger:260) | 3.771 V |
| output and speaker playing the 1 kHz tone, knob 0.5 | `amplifier-v50.json`: `amplitude` 12 → 1.0957, 13 → 1.0227; `mean` 12 → 3.7312, 13 → 0.0003 | PATH's «1,10 V / 1,02 V» ✓ |
| C2 replaced by a jumper: speaker 0.42 A DC, battery 428 mA, Q2 1.75 W, burns in 2.2 s | ledger:302-303 (prog. E3) | «Докладніше» of `coupling` only |
| melody: below 150 Hz 0.77 of RMS, above 2 kHz 0.12; bass 41–110 Hz | `sim/core/README.md:991-997` | `highs`, `lows` |
| speaker crests with melody at 50 %: 0.61…0.98 V per 0.5 s | ledger:319 (E3-1 run) | `coupling`, `highs` (470 μF) |
| unloaded 1 kΩ / film 100 nF from an ideal source | `__fixtures__/filters.json` `gain.2` / `gain.3` | LP 0.998 / 0.847 / 0.157, HP 0.063 / 0.532 / 0.988 at 100 Hz / 1 kHz / 10 kHz |
| capacitor ESR and leak | `sim/core/README.md:438-448` | film-1u 0.03 Ω, 1.25 GΩ; 470 μF 0.5644 Ω; 100 μF 2.653 Ω; 10 μF 26.53 Ω; electrolytic-1u 265.3 Ω (keep it off `block`'s tray) |
| `block` τ, jump, residue | derived: τ = 1 μF × (10 kΩ ∥ 1 MΩ + 1.5 Ω + 0.03 Ω) = 9.90 ms; jump 9 × 9901/9902.5 = 8.999 V; 8.999·e^(−10/9.90) = 3.28 V; ·e^(−50/9.90) = 0.058 V | to confirm: `Transient` on the step's `netlistOf` with `SCOPE_INPUT` parts on the probe rows, `start('dc')` SW 0, `set('SW', 1)`, 0.1 s at 1/24000 (`sim/core/README.md:604-648`) |
| `block` after charging | derived: 9 V / 1.25 GΩ = 7.2 nA; × 9.9 kΩ = 71 μV | to confirm (same run, 1 s) |
| `pass` high-pass | derived: fc = 1 / (2π × (9.901 kΩ + 32 Ω) × 1 μF) = 16.0 Hz; |H| 0.932 / 0.960 / 0.990 at 41 / 55 / 110 Hz | to confirm: crests of both rows over 0.5 s windows, `player` 0.3 V, 8 s loop (E3-2 recipe, ledger:268-273) |
| `highs` edges and gains with ESR, amplifier's output impedance taken as 0 | derived: fc = 1/(2π (8 + ESR) C): 39.5 / 149.4 / 460.9 Hz; passband 8/(8+ESR) 0.934 / 0.751 / 0.232; |H(1 kHz)| 0.933 / 0.743 / 0.210; |H(100 Hz)| 0.869 / 0.418 / 0.049 | to confirm: `amplifierNetlist` with C2's key swapped, `player-tone` at 50 / 100 / 1000 Hz, `substeps: 8`; and melody crests per can |
| thump on a new can | derived: 3.77 V / (8 + ESR): 0.44 / 0.35 / 0.11 A, τ 4.0 / 1.07 / 0.35 ms | to confirm (Q2 stays under 0.5 A, `sim/core/README.md:833-834`) |
| `lows` on the amplifier | est.: VR1 input ≈ 5 kΩ + (5 kΩ ∥ ≈ 1.8–2.9 kΩ) ≈ 6–7 kΩ at knob 0.5; fc ≈ 1/(2π (1.032 kΩ ∥ 6–7 kΩ) 100 nF) ≈ 1.77–1.81 kHz; passband ≈ 0.85–0.87 | to confirm: the step's netlist with `player-tone` at 100 Hz / 1 kHz / 10 kHz, `substeps: 8`, ratio at 13ae to the player's row (ledger:404-411 marks it «попередньо») |
| `tone` formula | 1/(2π × 1 kΩ × 100 nF) = 1591.5 Hz; 11 kΩ → 144.7 Hz; with the player's 32 Ω 1542 / 144.3 Hz | formula (ledger:152; PATH:683) |
| `tone` on the amplifier | est.: knob at 10 kΩ: R∥load ≈ 3.9–4.3 kΩ → ≈ 0.37–0.41 kHz; passband 6–7 / 17–18 kΩ ≈ 0.35–0.39 | to confirm as `lows`, P2 at 0 and 1 |
| trapezoid at 24 kHz, LP 1 kΩ/100 nF | `sim/core/README.md:668-691`; derived with f' = tan(πfh)/(πh): k = 1 → −13.6 % at 5 kHz, −64.5 % at 10 kHz; k = 2 → −3.3 / −14.4 %; k = 8 → −0.2 / −0.9 % | for the chapter README and «Докладніше» numbers (take them at k = 8) |

## 4. Risks

### 4.1 Camera framing (the tall cans)

- `coupling` probes: row 7ae has free sockets b7 and e7 only (a7 C2+, c7 Q2's emitter, d7 J7 — `presets.ts:145-175`).
  b7 sits right in front of C2's 470 μF can (Ø 0.92, top 1.63; `shared/parts/capacitors.ts:39`, VISUAL §4.7), and a
  scope probe leans toward the scope at the back right (`clone:shared/instruments/scope.ts:48-63`), i.e. into that
  can. e7 lies under J7's arch (d7→f7). Use the fj half of the output node: 7fj = f7 J7, g7 Q3, j7 R3, so **h7/i7**
  are free and in front. Speaker row 10ae: d10/e10 are free and clear of C2 and C1 (a11, 10 μF, top 1.57). Check with
  a chapter `__tests__/shot.test.ts` (as `chapters/resistor/__tests__/shot.test.ts` and
  `clone:chapters/meter/__tests__/shot.test.ts`, the `amps` lesson where C3 hid J10: `clone:chapters/meter/README.md`,
  «`amps` has its own shot»).
- Tray vs scope: the `scope` shot keeps the scope and all sockets (`clone:VISUAL.md:692`), not the tray (its front
  corners lie ≈ 8 from its fit centre against a radius of 5.6); `stand` keeps the tray but the scope's probes rest on
  the table at ≈ (4.85; −0.8) world, at the edge of `stand`. Default: `block`, `pass`, `highs`, `lows` use `stand` and
  the step puts the probes; only `coupling` and `tone` use `scope`.
- `block`/`pass` boards and every `pl+` socket must stay on the right half (lead reach 4.0, `clone:VISUAL.md:114-115`).

### 4.2 Phone

- The chart is in the «Графіки» tab while the switch, tray buttons and knob are in «Керування» (`clone:VISUAL.md:920-
  943`): the reader cannot watch and act at once. `block` survives it (single-shot capture stays); `tone` relies on
  sound and a crest/stats block under the slider (the `twice` lesson: `clone:chapters/meter/README.md`, readouts in
  one `stats` block under the slider).
- Radial legs are not taken on a phone (`clone:VISUAL.md:932-935`): every can/film/ceramic must fit its default span
  (1 P can, 2 P film/ceramic) in the chapter's boards (see `highs`, `lows`).
- Scope probes rest on the base in front of the board on a phone (`clone:scope.ts:59-62`); `coupling` is the only step
  where the reader drags them; P ≈ 19 px (`clone:VISUAL.md:908-914`).

### 4.3 Frozen pages (`?freeze`) and time-domain traces

- `block`: see section 2 — without the SMALL fix the goal snapshot on a held frame shows a flat line. The entry deep
  link (switch open) is fine: the still is 0 V on both channels.
- Roll displays are not replaced on held frames (`clone:shared/bench/index.ts:602`), but a roll moves the spike off
  screen within one window; prefer the single-shot sweep.
- Melody steps: still warm-up is max(0.2 s, 5 τmax) rounded to 1 s, ≤ 2 s (`clone:driver.ts:189-198`); every filter
  board's τmax is well under 0.2 s, so all held windows open at 1 s — deterministic hashes, a bass note in the window.
- Still has no substeps either (`clone:bench/index.ts:610`): held `lows`/`tone` traces carry the 24 kHz warping.

### 4.4 Hue families (≤ 4)

Stand: blue + cyan. Amplifier steps add the lit red LED «on» and coral leads (one red family), the scope's lime and
magenta traces on the 3D screen, violet jumpers (blue). Five candidates; the meter chapter's `twice` frame is the same
mix — read its `chapter-check` result before E4 (no hue note in `clone:chapters/meter/README.md`). The film box's
cherry and the ceramic's tan are kept below the saturation threshold by design (`clone:VISUAL.md:376-382`).

### 4.5 Draw calls (≤ 350)

E2's worst was 275 with the amplifier, scope and sound (`clone:reports/batch-E2.md:238`); `lows`/`tone` add ≤ 3 parts
and a second pot (≤ 6 each, `clone:VISUAL.md:224-226`) → ≈ 295 est. Low risk; measure.

### 4.6 Inside view

Not needed: floor `stand`. `pass`'s «Докладніше» (electrons gather on one plate and leave the other) could dive into
the cap, but that view belongs to `capacitor/inside` (planned copy from
`app/src/volumes/electricity/chapters/charge-field/parts/capacitor.ts` → `electronics/shared/inside/`, `REUSE.md:40`).
If the owner wants it here, reuse that module through `shared/dive/cutaway.ts`'s kind table after `capacitor` lands,
with no new REUSE row.

### 4.7 Safety and honesty

- Only the 9 V battery; nothing above it. ✓
- `highs`: a can flipped end for end (plus to the speaker, minus to the 3.77 V output) is 3.77 V reverse → load 3.77,
  bulges after 10·ln(3.77/2.77) ≈ 3.1 s (`sim/core/README.md:476-485`) with one steam puff, no blast
  (`clone:VISUAL.md:431,439-440`). Set `flip: false`; the reverse lesson and its warning stay in
  `capacitor-kinds/reverse` (ledger:178, 204-206).
- `coupling`: keep the jumper-instead-of-C2 experiment in «Докладніше» only (Q2 burns in 2.2 s); the hand policy should
  not offer a jumper in that step.
- Wording: never «струм тече крізь конденсатор» (ledger:199); terms only from their steps — «фільтр» not before
  `highs`, «розділовий» not before `coupling`, «частота зрізу» not before `tone` (`_terms.md:54-56`).

### 4.8 Model fidelity and speed

- `highs` ESR (finding 2) and `lows`/`tone` loading (finding 3): the screen and «Висновок» must quote the board's
  numbers, not the bare formula's; record the departures in PATH's deviation list (`PATH.md:1311-1315`).
- Trapezoid warping at 24 kHz (finding 5): honest substeps (k ≥ 4) cost 4× on the amplifier, already 2.5–3.5× real time
  on the desktop and ≈ 0.6–0.9× on a phone (`clone:reports/batch-E2.md:85,117,241`). The ledger keeps this as a note to
  builders only (ledger:190).

## 5. Open questions (recommended default first)

1. **Merge before build.** Default: merge `rsp-e2` (E2-9, E2-10, meter, prologue) into main before E4's `filter`;
   `filter` is last in E4 anyway.
2. **`block` on held frames.** Default: SMALL — `held()` keeps a captured single-shot sweep (`trigger.auto` false and
   found); add `pretrigger` (one division) so the 0 → 9 V edge shows. Alternative: `still({ start: 'zero', warmup: 0
   })`, which `capacitor/slow` (E4) can use too.
3. **`highs` numbers.** Default: keep 470 → 100 → 10 μF and write the model's numbers (≈ 150 Hz, ≈ 460 Hz, and «a small
   can also takes part of the music with its own resistance» in «Докладніше», with no «ESR» on screen:
   ledger:132). Alternative: stop at 100 μF and leave 10 μF to «Докладніше».
4. **`highs` swap mechanics.** Default: hands on desktop and phone, on the chapter's own amplifier board with C2 on 1 P
   (tested like `AMPLIFIER_PRESET`), `flip: false`. Fallback: a dock control «470 / 100 / 10 μF» that re-presets C2,
   as `resistor-pick/series` does with R1.
5. **`lows`/`tone` loaded by the volume control.** Default: build them on the amplifier (the only way to hear them),
   keep the formula card, and let «Висновок» give the stand's range from a model run («≈ 1,8 kHz … ≈ 0,4 kHz»); the
   load is explained in «Докладніше» with «навантаження» (`divider/load`). Alternative: show the unloaded filter on
   the scope only and drop «слухати» from `tone`.
6. **Substeps.** Default: none live and none in `still` (speed); «Докладніше» numbers come from test runs at
   `substeps: 8`; the chapter README states the 24 kHz warping. Revisit if the owner picks the precomputed loop
   (E2 decision 17).
7. **`tone` pot.** Default: the step presets P2 as a rheostat (`o: 1` across the channel) in series with the 1 kΩ of
   `lows`; the reader only turns the panel slider (pots have no movable legs).
8. **`coupling` probes.** Default: either channel on either leg counts; suggested sockets h7/i7 and d10/e10; the
   chart's ground at −2 div, 1 V/div, sweep 2 ms/div triggered on the speaker's channel.
9. **A tone generator on the bench** (`player-tone` is outside the bench now: `clone:shared/README.md:273`). Default:
   no; melody only, frequency numbers in «Докладніше» from tests.
10. **Number readouts.** Default: crests (`peak`) only, through the shared `crestStats`; no new mean or band meter.
11. **Speaker in `block`/`pass`.** Default: unplugged (the mood plays); the bench is mounted with `sound: true` for
    the whole chapter because `highs`/`lows`/`tone` need it.
