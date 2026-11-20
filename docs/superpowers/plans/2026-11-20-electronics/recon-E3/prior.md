# Recon E3 — prior art for electronics chapter content

Read-only map, 2026-11-20, repo HEAD `2707887` (branch `main`). Scope: what `circuit` and `electricity` already teach
and build that the chapters `prologue`, `meter`, `resistor`, `resistor-pick` (E3) and later `divider` … `lab` can copy,
must not repeat, or must build new. Paths are repo-relative; `file:N` = line N.

## 0. Verdicts at a glance

| Electronics chapter (floor) | Best prior art | Verdict |
|---|---|---|
| `prologue` (stand) | `circuit/prologue` torch→stand unfold (`circuit/shared/stage/unfold.ts`, `torch.ts`) | **new** scene (player + speaker); copy the "one stand, constant places" idea only |
| `meter` (stand) — the LIBRARY §3 bridge | `electricity/current` step 9 `measure` (multimeter) + step 10 `dc-ac` (scope); `circuit` gauge/frame tools | **rework**: multimeter model + modes + fuse lesson copy well; scope = platform `@/fx` `createScope` |
| `resistor` (inside) | `circuit/shared/copper` (hits, run, joule, hit-lens), `electricity/matter` step 5 scatter crystal (impurities, alloys) | **new** inside view (carbon/metal film does not exist anywhere); rework copper's "hit + heat" vocabulary |
| `resistor-pick` (part) | colour bands in `matter/parts/circuit.ts:34-42`, `generator-ac/parts/rlc-board.ts:47-55`; heat view `circuit/shared/stage/bulb-thermal.ts` | **new** (band reader, E-series, power check); bands drawn from model data |
| `divider` (stand) | `electricity/current` step 7 constructor (preset «Подільник напруги», node-potential wire tint) | **rework** (idea + colouring), stand is ours |
| `capacitor` (inside) | `electricity/chapters/charge-field/parts/capacitor.ts` + `cap-circuit.ts` (plates, field lines, dielectric dumbbells, pump, discharge through lamp) | **rework/copy** — closest ready "inside" view in the repo |
| `capacitor-kinds` (part) | `lab-inverter/parts/components.ts:80` `addCan` (electrolytic can, scored top, stripe); `DIELECTRICS` ceramic ε_r 2000 | **mostly new** (no ceramic disc/MLCC, no oxide-layer inside view) |
| `filter` (stand) | `generator-ac` step 9 `rlc` (X_C, mini-scopes per element), `lab-inverter/parts/lc-rig.ts`, `bench-scope.ts` | **rework** ideas; the model is ours (`sim/core`) |
| `diode` (atoms) | `matter/parts/pn-block.ts` (complete p-n junction), `si-sheet.ts`, `dopants.ts`, `diamond.ts`, `lab-pv/parts/junction.ts` | **copy + rework** — strongest prior art |
| `led` (inside) | `matter/parts/dev-diode-led.ts:77` `createLed` (dome, photons coloured by λ), `sim/matter/devices.ts:14` `ledEmission` | **copy + rework** |
| `transistor` (inside) | MOSFET only: `matter/parts/dev-solar-mosfet.ts:91`, `lab-inverter/parts/power-switch.ts`; TO-247 body `components.ts:47` | **new** for the NPN (BC547) layers — no bipolar transistor exists anywhere |
| `amplifier`, `build`, `lab` | constructor `current/parts/circuit-grid.ts`, `circuit-tray.ts`, `circuit-parts.ts` (snap between nodes); `circuit/build` | **rework** ideas only (the bench of E2 replaces them) |

Mechanics of "copy": volumes never import each other (lint `local/volume-boundary`, `app/eslint.config.js:67`,
rule text `app/eslint-rules/chapter-boundary.js:1-16`), and a chapter never imports another chapter even inside its
own volume. Anything two electronics chapters share (p-n block, film, capacitor) must be copied into
`app/src/volumes/electronics/shared/**` and recorded in `docs/volumes/electronics/REUSE.md` (design §4).

## 1. `docs/volumes/electronics/` today

- **Does not exist** at HEAD `2707887` (re-checked at the end of this recon): E1-8 has **not** landed. No `VOLUME.md`,
  `PATH.md`, `PATH-ledger.md`, `PATH-NOTES.md`, `REUSE.md`, `check.py`, `chapters/_terms.md`, `terms_allowlist.tsv`.
- What E1-8 will write: `docs/superpowers/plans/2026-11-20-electronics/batch-E1.md:310-360` (files list `:322-325`;
  `PATH.md` content `:333-338` — steps written as ``- `chapter/step` — думка · що робить читач · висновок``, 4–8 per
  chapter, «формула кроку» noted as «Висновок» or «Підписи»; pilot chapters with concrete part values; `check.py`
  prints `electronics check: OK` `:346-350`).
- What exists for the volume: `app/src/volumes/electronics/volume.json:32-52` (journey: 19 entries, ids/titles/
  minutes/floors), `volume.ts:15-32` (axis 0…3 floors, `theme: { sky: 'studio', mood: 'studio' }`), `chapters.ts`
  (glob `./chapters/*/index.ts`), `__tests__/journey.test.ts:46-60` (pins the 19 entries; 14 non-branch = 142 min,
  5 branches = 41 min). Design: `docs/superpowers/specs/2026-11-20-electronics-volume-design.md` (§2 skills `:54-66`,
  §3.3 formula rule `:94-101`, §5.2 catalog `:154-170`, §8.1 journey + amplifier thread `:251-281`).
- Numbers a script can cite today come from `app/src/volumes/electronics/sim/core/README.md` — **working tree,
  partly uncommitted (E1-4 in progress)**: catalog `:118-135` (9 V battery 1.5 Ω internal; E24 1 Ω…10 MΩ, 0.25 W,
  5 %; `pot-10k` 0.2 W; LEDs rated 20 mA, max 30 mA; `lamp-6v` 6 V·0.1 A, 60 Ω hot / 5.5 Ω cold); LED forward voltages
  at 20 mA `:223-228` (red 1.950, yellow 2.050, green 2.150, blue/white 3.100 V); limits `:296-327` (red LED + 330 Ω
  on 9 V = 21.2 mA, load 0.71 «warm», resistor 0.149 W; 75 Ω on 9 V = 1.04 W burns in 2.8 s; LED straight on 9 V
  burns in 0.07 s). Lamp burn-out time is a declared compression `:291-294` («The documents should not present those
  seconds as real»).

## 2. What `circuit` already teaches — do not repeat

Source of truth for each chapter is its script `docs/volumes/circuit/chapters/<id>.md` (PATH.md tables are the plan;
deviations listed at `docs/volumes/circuit/PATH.md:314-337`).

**What circuit deliberately left out** — `docs/volumes/circuit/VOLUME.md:47-55` (the electronics volume's entry points):
Ohm's law with a formula, ohm, resistivity → «Докладніше»; power, watts → branch; LED → branch («світлодіод власник
поки відклав», `:57-59`); capacitor, potential → vol. 1; AC, semiconductors, band theory → vol. 1; measuring with
instruments → branch. Design §1 `:12-14` confirms electronics «бере саме це».

**Chapter `resistance`** (`docs/volumes/circuit/chapters/resistance.md`, 4 steps, 1 term «опір»):

| Step (lines) | What the reader already got | Numbers already used |
|---|---|---|
| `bumps` `:13-40` | opір = electrons hit atoms and lose their run; ohm/Ω named only in «Докладніше» `:31-32`; "really phonons + impurities" `:29-30` | both stand wires ≈ 0,01 Ω |
| `heat` `:42-68` | current heats everything it flows through; heat = trembling atoms; Joule–Lenz (2× current → 4× heat) in «Докладніше» `:60-61` | copper wire < 0,1 °C rise |
| `shape` `:70-100` | long + thin resists more; material matters (copper best of cheap, silver better, heater alloy tens× worse) `:90-92` | I = 1,5 : (5 + 0,0072·k²) on the frame `:98`; k = 40 → 0,09 A |
| `balance` `:102-130` | current = balance of push and total resistance; the lamp holds most of it; Ohm 1827 and I = U/R only in «Докладніше» `:119-121` | lamp ≈ 5 Ω, battery 0,15–0,3 Ω, total ≈ 5,2 Ω → 0,3 A |

«Що ми тепер знаємо» `:137-141`; fact notes in the HTML comment `:147-170` (resistivities with sources — reusable).

**Elsewhere in circuit** (already taught, only recall in electronics): voltage as «поштовх», volt, the gauge reading
1,5/1,6 V (`battery.md:105` `voltage`); ampere as electrons per second (`flow.md:45` `count`); same current before and
after a part (`flow.md:75` `same`); closed loop, switch = gap (`flow.md:99` `loop`); heat where resistance is largest
(`lamp.md:50` `hot-spot`); energy from the battery, **power 0,45 W only in «Докладніше»** (`lamp.md:109`, text at
`:131`); battery's own resistance (`drain.md:98` `inner`); voltage without load lies (`drain.md:70` `ghost`); short
circuit (`build.md:65`, practicum term).

**Circuit's register** `docs/volumes/circuit/chapters/_terms.md`: 20 path terms + «коротке замикання» (`:8-32`) —
атом, ядро, електрон, вільні електрони, провідник, ізолятор, електричний заряд, позитивний/негативний заряд,
нейтральний, електричне поле, полюс, напруга, вольт, електричний струм, ампер, електричне коло, опір, нитка
розжарення, енергія. «Слова, які читач уже має» `:34-40`. «Докладніше»-only `:42-59` includes **світлодіод, закон
Ома/ом, потужність/ват, електрична схема, сила струму, умовний напрям струму, джоуль/кулон, іон**. Banned on the path
`:61-67` includes **конденсатор, потенціал, напруженість, напівпровідник, зонна, змінний струм, фотон, спектр,
магніт, індукція**. Verdict: electronics needs its **own** `_terms.md`; copying circuit's as a template would ban its
core words. Circuit's 20 terms are "already known" for electronics (do not re-introduce as path terms; recall them).

Verdict for `resistor`/`resistor-pick`: do **not** redo "hits → resistance → heat → long/thin → balance". New ground:
the resistor as a *made part* (film, trim cut, value set by design), ohm as a path unit, `I = U / R` as the first
formula (design §3.3 example `:97-98`), power `P = U · I` / rating 0,25 W, tolerance, E-series, colour code.

## 3. Volume `electricity` (vol. 1) — what exists

Chapters built (`app/src/volumes/electricity/chapters/`): atom, charge-field, current, generator-ac, lab-battery,
lab-inverter, lab-pv, magnetism, matter, plant-{coal,gas,hydro,nuclear,wind}, plants, transformer (16 dirs; 25 in
`volume.json`). Scripts: `docs/volumes/electricity/chapters/<id>.md` (old format: «Бачимо / Текст панелі [1][2][3] /
Терміни / Формули / Цифри і факти / Інтерактив / Hotspots / Хибні уявлення / Перехід» — **not** the path grammar).
`app/src/volumes/electricity/content/` = `generated/*.json` + tests only (no hand content). Status `published`.

### 3.1 `matter` — semiconductors (`docs/volumes/electricity/chapters/matter.md`)

| Step | Lines | Teaches (vol. 1 level) | Code (`app/src/volumes/electricity/chapters/matter/…`) |
|---|---|---|---|
| 5 `resistance` | `:144-177` | phonons, impurities, vacancy; ρ(T); alloys NiCr/constantan «багато безладу», α ≈ 0 | `parts/scatter-crystal.ts:35` `createScatterCrystal(ctx)` (imports `./fcc-block`) |
| 6 `silicon` | `:179-207` | Si 4 bonds, pair generation, hole, recombination; 3D diamond → planar scheme | `parts/diamond.ts:16` `createDiamond(cells = 2, a = 1.25)`; `parts/si-sheet.ts:118` `createSiSheet(ctx): SiSheet` (10×8, `COLS/ROWS/SPACING` `:14-16`) |
| 7 `doping` | `:209-233` | P donor (teal, «P, 5 e⁻»), B acceptor (pink, «B, 3 e⁻»), fixed ions, neutral halves | `parts/dopants.ts:35` `createDopantView(trayAt: Vector3): DopantView`, `MAX_DOPANTS = 16` |
| 8 `pn-junction` | `:235-261` | depletion region, built-in field n→p, ~0,7 V barrier, forward/reverse, «зворотний клапан», 220 Ω loop | `parts/pn-block.ts:48` `createPnBlock(ctx): PnBlock`; `parts/circuit.ts:27` `createCircuit(pX, nX, y)` |
| 9 `devices` | `:263-296` | rectifier, LED colour from E_g (λ ≈ 1240/E_g), solar cell, MOSFET channel | `parts/dev-diode-led.ts:27` `createRectifier()`, `:77` `createLed()`, `:12` `pnChip(b, w, h, d, at)`; `parts/dev-solar-mosfet.ts:23` `createSolar()`, `:91` `createMosfet()` |

`PnBlock` (`pn-block.ts:24-38`): `{ group, width (units), barrier (V, default 0.71), flow 0…1, ionAnchor, hillTop,
join 0…1, joinTo, update(dt, t) }` — p bar `pink` glass, n bar `teal`, «−»/«+» ion tiles only inside |x| < W/2,
3 `amber` field arrows (`SEMANTIC.fieldE`), `sky` energy hill ribbon (`RibbonLines`), carriers via
`createOrbs({ kind: 'hole' | 'electron' })`, recombination `createFlash`. Deps: `three`, `@/engine/api` type,
`@/fx`, `@/kit` (`Builder`, `G`), `@/style` (`K`, `SEMANTIC`) — **platform only, copies cleanly**. Randomness via
`ctx.random.next()` (deterministic).
`LedDevice` (`dev-diode-led.ts:67-73`): `{ group, wavelength (nm), dome, update }`; colour by
`wavelengthToColor(λ)` from `@/fx`, `createPhotons`, `createHalo`. Platform-only deps.
`MosfetDevice` (`dev-solar-mosfet.ts:79-87`): `{ channel 0…1, lamp 0…1, oxide }`; p substrate `pink`, n⁺ pockets
`teal`, oxide `white` glass, gate `mist`.
Physics: `app/src/volumes/electricity/sim/matter/` (README table `:5-16`): `diode.ts:37`
`diodeCircuit(sourceV, flipped = false)` → `{ diodeV, currentA, depletionWidthUm, barrierV, lampBrightness }`;
`:55` `diodeIvCurve(points, fromV, toV)`; `:68` `rectifierSample(tS, 'ac'|'dc', peakV, f)`; `devices.ts:14`
`ledEmission(E_g)` → `{ wavelengthNm, band, material, rgb }`; `:26` `MOSFET` consts; `semiconductor.ts:51`
`dopedSilicon(type, N)`. Electronics must **not** import these; its own `sim/core/diode.ts` (SPICE level 1) is
the model — copy only the visual mapping (barrier → hill height, current → `flow`).

### 3.2 `charge-field` step 7 `capacitor` (`docs/volumes/electricity/chapters/charge-field.md:210-242`)

Teaches C = Q/U, C = ε₀ε_rA/d, dielectric polarisation, W = CU²/2, supercapacitor, total charge 0.
Code: `chapters/charge-field/parts/capacitor.ts:50` `createCapacitor(): CapacitorModel` — view `:23-33`
`{ side, gap, field, level, permittivity, blockIn, blockColor }`; plates `K.metal`, `amber` field lines (density ∝
log E), `coral`/`cyan` plate halos, dielectric dumbbell molecules that align, bound-charge layers; the lines-ending-
on-bound-charge construction is physically worked out in its header `:7-9`. Deps to replace on copy: `../layout`
(`CAPACITOR`) and `../chapter` (`clamp`). `parts/cap-circuit.ts:46` `createCapCircuit(ctx): CapCircuit` — battery
«pump», wires that re-route with the plates, `cyan` electron flow only while charge changes, lamp for «Розрядити через
лампочку»; dep `../layout`. Data: `sim/charge-field/capacitor.ts:11-16` `DIELECTRICS` (air 1.0006/3 MV/m, PTFE 2.1/60,
glass 6/13, **ceramic 2000/10 MV/m**). Verdict: the best existing "inside a capacitor"; rework for a real part (rolled
film, ceramic layers, electrolytic oxide are absent).

### 3.3 `current` — instruments and constructor (`docs/volumes/electricity/chapters/current.md`)

- Step 4 `ohm` `:118-153`: U = I·R, R = ρL/A, ohmic vs lamp curve, CC limit, ammeter before/after reads the same.
- Step 7 `series-parallel` `:223-256`: series/parallel sums, Kirchhoff, **divider formula** `U₁ = U·R₁/(R₁ + R₂)`
  `:237`, preset «Подільник напруги» `:245`, wires tinted by potential `blue → pink → coral` `:224`.
- Step 9 `measure` `:288-322`: V in parallel (~10 MΩ), A in series, Ω only de-energised, mA fuse blows when the
  ammeter is across the source, U = ℰ − I·r, modes «OFF | V⎓ | V~ | Ω | mA⎓ | 10 A⎓» `:309`.
- Step 10 `dc-ac` `:324-`: oscilloscope: DC = flat line, AC = sine.
Code (`app/src/volumes/electricity/chapters/current/parts/`): `multimeter.ts:53` `createMultimeter(): Multimeter`
(amber bumper, LCD tag, rotary dial, jacks COM · V Ω · mA · 10 A, fuse window, red/ink probes on cables; deps
`@electricity/sim/current` `MeterMode`, `../world` `tag`); `meter.ts:30` `createMeter(kind: 'A'|'V', scale = 1)`;
`circuit-grid.ts:53` (6×4 nodes, `GRID_PITCH = 1.15` `:30`); `circuit-tray.ts:61` `createCircuitTray(z)`,
`TRAY_KINDS` `:14`; `circuit-parts.ts:37` `partBody(kind)` (candy resistor), `:75` `createPartView(part, pa, pb)`;
`lens.ts:37` `createLens(…)`; `schematic.ts:26` `class Schematic extends UiNode` (IEC symbols on the HUD).

### 3.4 `generator-ac` step 9 `rlc` (`docs/volumes/electricity/chapters/generator-ac.md:240-268`)

X_C = 1/(2πfC) falls with frequency, «для постійного струму він — розрив» `:244`; per-element mini-scopes (current
`cyan`, voltage `yellow`). Code: `chapters/generator-ac/parts/rlc-board.ts` (resistor `steel` body with bands `:47-55`,
capacitor `sky` can). Verdict: idea source for `filter` («музику пропускає, батарейку — ні»), not code.

### 3.5 Labs with electronic parts

- `chapters/lab-inverter/parts/components.ts`: `:47` `addTransistor(b, at, h = 0.62, c = 'ink')` (TO-247, 3 legs,
  tab); `:80` `addCan(b, at, r, h, sleeve = 'slate')` (electrolytic: sleeve, scored top, polarity stripe); `:11`
  `addToroid`; `:116` `addRelay`. Kit-`Builder` helpers, copy cleanly. No TO-92 (BC547) package.
- `lab-inverter/parts/power-switch.ts` (168 l.): power MOSFET cross-section (n⁺ substrate, n⁻ drift, p wells, n⁺
  source islands, oxide, gate; DECISIONS §50 colours). `lc-rig.ts` (161 l.): film capacitor with `amber` E arrows.
  `bench-scope.ts` (198 l.): holographic 2-trace scope, before-filter `violet`, after `yellow`.
- `lab-pv/parts/junction.ts` (110 l.): p-n slab inside a cell (n top `teal`, p bottom `pink`, depletion + `amber`
  arrows, square lattice, outer loop with lamp); `band-diagram.ts` (81 l.) «сходинка енергії».

## 4. `circuit/shared/copper` — «усередині міді» (and the stage's inside views)

README `app/src/volumes/circuit/shared/copper/README.md` (242 l.; 3 339 l. of TS). One object:
`createCopper(ctx: ChapterContext): Copper` (`copper.ts:92`; interface `:43-90`). Mount: `mountAtHandover(group,
HANDOVER)` (`mount.ts`, `HANDOVER` from `circuit/shared/stage/shots.ts`), shots `copperShots(group, prefix)`
(`shots.ts:52`), light `copperEnv(lamp, group)` / `copperPost(depth, scale)` (`look.ts:18`, `:56`).
Parameters (README `:64-80`): `depth` 0 «жила» · 1 «ряди атомів» · 2 «один атом»; `lamp`; `atoms`; `sim.shared`,
`sim.speed`, `sim.drift`; `look`; `marked`/`markNearest`; `sim.gate`; `lattice.selected`/`touch`; `lattice.tremble`,
`lattice.heat`; `atom.apart`/`hold`. Chapter-5 additions `:199-213`: `sim.field`/`sim.restart` (`run.ts`, the marked
electron's run and bounce), `lattice.kick(site, flash, shake)`, `createHits(copper)` (`hits.ts:55`: `marked`, `total`,
`rate`), `createHitLens()` (`hit-lens.ts:87`: strip `fill`, `frost`), `trembleHeat(amps, at = 0.3, top = 0.58)`
(`joule.ts:13`). Geometry constants `layout.ts:12-33` (atom R 1, pitch 3.2, 7×4×4 FCC planes). Foreseen-but-unbuilt
hooks `:129-144` — notably **"another lattice … another palette: `layout.ts` (`latticeSites`) and the colours in
`lattice.ts` are the two places to parameterise"** `:142-143` (the route to a resistive film).

What it is good for in electronics: the *language* of the inside floor (focal plane of balls, cyan streaked electrons,
hit flash `orange`, heat = trembling + orange rim, the lens rim). What it is not: it is welded to circuit's stand
(`HANDOVER` pose, 41° tilt, `STAND_COPPER` colours in `core.ts:38`, `lensRim` owned by the stage) and to copper's FCC
grid; no film, no grains, no layers. Copying it means copying `circuit/shared/stage` assumptions too. Verdict:
**rework** — copy `electron-sim.ts`, `streaks.ts`, `electrons.ts`, `run.ts`, `hits.ts`, `joule.ts`, `haze.ts`
selectively for a "film" world; do not copy `core.ts`/`mount.ts`/`look.ts` unless the E2 bench reproduces the stand's
hand-over.

Other inside views on circuit's stage (`app/src/volumes/circuit/shared/stage/`): `battery-inside.ts:150`
`createBatteryInside(outside)` (cut-away, 418 l.), `battery-section.ts`, `battery-layers.ts`; lamp close-up
`bulb-close.ts` (fine helix, leads, base cut), `lamp-view.ts:63` `createLampCloseUp(B, parts)`; heat
`bulb-heat.ts:43/56/96` `temperatureOfHeat`, `heatOfTemperature`, `resistanceAt` (pure), `bulb-thermal.ts:132`
`createThermal(setup)` (false-colour heat view through the ring, no render target). Tools `stage/tools/`: `lens.ts`,
`frame.ts` (counter frame), `gauge.ts` (voltage gauge, one big number), `loupe.ts`. The thermal view is the natural
prior art for «резистор гріється понад 0,25 W» in `resistor-pick`.

## 5. Inside-the-part views: need vs inventory

| Needed view (design §6.1 `:208-212`) | Exists? | Where / gap |
|---|---|---|
| carbon film / metal film of a resistor, helical trim cut | **no** | nothing in `app/src` (`grep resistor` hits only bodies with bands); build new; closest: alloy "disorder" in `matter.md:148`, `scatter-crystal.ts` impurities `violet` |
| colour bands as data | partial | hand-placed bands `matter/parts/circuit.ts:34-42` (220 Ω: `red, red, wireBrown, amber`) — not data-driven; electronics has `resistorKey()` (sim README `:137-138`) |
| ceramic dielectric (disc / multilayer) | partial | dielectric block + molecules `charge-field/parts/capacitor.ts`; ε_r ceramic 2000 in `DIELECTRICS`; no layered MLCC |
| electrolytic: oxide layer, can, vent, stripe | exterior only | `components.ts:80` `addCan`; no Al₂O₃ inside view, no bulging |
| film capacitor | exterior only | `lc-rig.ts` |
| Si lattice, holes, doping | **yes** | `diamond.ts`, `si-sheet.ts`, `dopants.ts` |
| p-n junction | **yes** | `pn-block.ts` (+ `lab-pv/parts/junction.ts` slab variant) |
| LED chip + dome + photon colour | **yes** | `dev-diode-led.ts:77` |
| NPN layers (emitter / thin base / collector) | **no** | only MOSFETs (`dev-solar-mosfet.ts:91`, `power-switch.ts`); build new from `pnChip`/`PnBlock` vocabulary |
| transistor package TO-92 | **no** | TO-247 only (`components.ts:47`) |
| lamp filament | yes | circuit stage `bulb-close.ts`, `bulb-heat.ts` (but its lamp is 1,5 V·0,3 A; electronics lamp is 6 V·0,1 A) |

Colour conventions to keep (DECISIONS): `docs/DECISIONS.md:134-135` (item 50, N9) donors/n-region `teal`,
acceptors/p-region `pink`, electrons `cyan`, holes `coral`; `:54-56` (items 15–16) «збіднена область» everywhere,
valence band `violet`, conduction `sky`, gap `bg.deep`. Note `teal` is also the electronics accent (`volume.json:7`).

## 6. `docs/LIBRARY.md` — topic boundaries

- Lists five volumes only (`:9-15`: electricity, computing, radio, positioning, networks). **Neither `circuit` nor
  `electronics` appears** — the file is stale for both.
- §3 `:34-47`: vol. 1 owns atom/charge, potential/voltage/**capacitor**, conductors/insulators/band theory/**p-n
  junction basics, diode, transistor as switch (overview)**, current/resistance/**Ohm/power/circuits**, AC/RLC. «Новий
  том може мати **один вступний розділ-місток** … Повторно викладати ці теми заборонено» `:46-47`. Read literally,
  most of electronics' path is vol. 1 territory; the design's answer is `meter` as the bridge and the framing «том 1
  поглиблює … том 2 поглиблює транзистор» (`:40`).
- §4 `:53`: **transistor, logic gates, memory, CPU → `computing`** (others «посилаються»); `:55` ADC/DAC split
  radio/computing; `:56` radio waves, antennas, modulation, noise → `radio`. Design §3.2 `:86-88` narrows it: logic
  switch → computing, «керований кран струму й підсилювач» stays here; `mosfet` branch «посилання на computing»
  (`:272`). Computing's own plan has `switch` (relay, tube, **bipolar transistor** on podiums) and `mosfet` chapters
  (`docs/volumes/computing/VOLUME.md:95-98`) — planned only, no code.
- Radio overlap: radio's path has «підсилювач» as a term (`docs/volumes/radio/PATH.md:58`, `select/amplify` `:157`)
  and a branch with «конденсатор» (`:318`). Separate registers, separate sites — no checker conflict, but the
  definitions should agree.
- §6 `:84-87` sensitive topics: not relevant here; electronics adds its own safety rule (no 230 V, ≤ 9 V; design
  §3.4 `:110-113`).
- Verdict: LIBRARY needs rows for `circuit` and `electronics` (changes go «через NOTES.md тому … затверджуються
  оркестратором», `:3-5`). Until then the design spec governs.

## 7. Script grammar (path format) and the checker, as electronics will meet it

Parser `tools/content/path_format.py` (no `docs/PATH_FORMAT.md` file exists although code cites it):
- H1 `# <id> — <title>` (`:12`); H2 sections `:20-21`: «Питання з життя» hook · «Що ми вже знаємо» know · «Кроки» ·
  «Нитка глави» · «Що ми тепер знаємо» (numbered `1. …`) · «Місток» · «Підписи глави».
- Step `### N. \`step-id\` — Title` (`:14`), id `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (`:17`).
- Field `- **Name:** text` (`:15`), continuation lines indented 2 spaces, list items `  - …` with 4-space
  continuation (`:54-78`). Names `:24-27`: Думка/Завдання → idea, Текст, Дія, Висновок/Перевірка → takeaway,
  Нові терміни, Докладніше, Згадати, Бачимо, Ціль, Підказки, Підписи; Позначки/Чесно accepted and dropped.
  **Required** `:29`: idea, text, action, takeaway, goal, terms, more («Докладніше» optional only in a prologue).
- «Підписи» items `:32-33`: `«A»` (always) · `«A» → «B»` (A until the takeaway, then B) · `→ «B»` (at the takeaway),
  separated by ` · `. «Нові терміни»: comma or `·` list, `—` empty (`:85-89`).
- HTML comments are stripped (`:30`) — circuit keeps fact notes there (`resistance.md:147-170`).
- Register `chapters/_terms.md` (`:190-223`): «Терміни шляху» 5 cells `| term | \`regex\` | \`chapter/step\` | шлях|практикум | card |`;
  «Слова лише для «Докладніше»» 3 cells; «Чого на шляху немає» 2 cells.

Checker `tools/content/path_check.py` (usage `:14`: `path_check.py [--volume <id> | --all] [--selftest]`; output lines
`warning: …` / `error: …` then `path[<vol>]: N chapter document(s), M step(s), K register term(s) — ok|N error(s)`
`:228-230`):
- Budgets `:26-27`: chapter 4–8 steps, prologue 4–5; ≤ 6 path terms/chapter, ≤ 2/step; idea one sentence ≤ 32 words
  (warn > 25); «Текст» ≤ 90 words (warn > 80), ≤ 2 paragraphs; ≤ 2 hints; «Що ми тепер знаємо» exactly 3 one-sentence
  lines; title is a question except practicum; bridge must end with the next chapter's title (branches exempt).
- **Formula rule** `FORMULA = re.compile(r'[=≈×÷√^]|`')` `:28`, applied **only to «Текст»** `:114-115`. «Висновок»,
  «Підписи», «Докладніше» may carry `=`, `×`, `≈` — this is what design §3.3 relies on. The checker does **not**
  enforce "≤ 1 new formula per step" or "formula only after the hands-on dependency" — that is a review rule.
- `**…**` bold allowed only for the step's new terms, in «Текст» and «Висновок» `:116-119`.
- Terms: used on screen before their step → error `:180-185`; «Докладніше»-only and banned words → error on screen.
- Latin words (`check_latin` `:195-205`) checked in all on-screen fields **and «Докладніше»**; exempt: units
  (`tools/content/terms_check.py:114-117`, includes μF nF pF kΩ MΩ mA μA μs mW, with U+03BC μ), single letters
  (so `I = U / R`, `P = U · I` pass), subscripted symbols (`U₁`), letter+digits (`E12`, `E24`), words glued after a
  digit (`1N4148`, `2N3904`). **Need an allowlist entry**: `BC547`, `NPN`, `PNP`, `SMD`, `ESR`, `SPICE` … — global list
  has `LED` (`tools/content/terms_allowlist.tsv:45`, abbr: first mention per chapter in parentheses after
  «світлодіод») and `MOSFET` (`:54`). Volume additions go to `docs/volumes/electronics/terms_allowlist.tsv`
  (`tools/content/chapters.py:61`; model: `docs/volumes/radio/terms_allowlist.tsv`).
- Commands (prelude per memory; no pnpm in worktrees): `python3 tools/content/path_check.py --volume electronics`;
  `python3 tools/content/doccheck.py --all` → `ALL GREEN`; after E1-8: `python3 docs/volumes/electronics/check.py` →
  `electronics check: OK` (batch-E1 `:355-357`).

## 8. Gotchas

1. `docs/volumes/electronics/` is absent; any E3 task that "reads PATH.md" will fail until E1-8 lands. Numbers in the
   model README are partly uncommitted (E1-4 working tree: `diode.ts`, `lamp.ts`, `limits.ts`, LED fixtures).
2. Do not seed electronics' `_terms.md` from circuit's: circuit bans конденсатор/напівпровідник/змінний струм/фотон/
   спектр/потенціал and keeps світлодіод/ом/потужність «Докладніше»-only (`_terms.md:42-67`).
3. Formulas: `=`, `≈`, `×`, `÷`, `√`, `^` and backticks are errors only in «Текст»; but `**bold**`, Latin and
   term-order checks still run on «Висновок»/«Підписи». A formula caption like `«I = U / R»` is fine; `«P = U·I»` uses
   `·` (not checked), `×` would be fine there too.
4. Multi-letter Latin in «Докладніше» is checked too (`check_latin` includes `more`): `BC547`, `NPN`, `ESR` need the
   volume allowlist before the first script mentions them.
5. Chapter ids `prologue` and `build` also exist in `circuit` (and `circuit` is the default volume). A short id
   without a current volume resolves legacy (`electricity`) → default (`circuit`) → others (`docs/VOLUMES.md:21-32`):
   QA commands and cross-references must use the full form `electronics/prologue`, `electronics/build`.
6. «Згадати» may only point to earlier steps of the same volume (`path_check.py:172-179`); recall into `circuit` is
   only a warning and is not checked. And the electronics site does **not** publish `circuit` or `electricity` (design
   §9.7 `:308-309`): «Докладніше» lines like «том 1, `matter`» or «див. `circuit/resistance`» lead nowhere for the
   reader. Say it in words, do not link.
7. Copying vol.-1 parts drags chapter-local deps: `capacitor.ts` needs `../layout` `CAPACITOR` and `../chapter`
   `clamp`; `cap-circuit.ts` needs `../layout`; `multimeter.ts` needs `@electricity/sim/current` `MeterMode` and
   `../world` `tag`; `band-tower.ts` needs `@electricity/sim/matter` `BAND_LOWER_E0_EV`; `scatter-crystal.ts` needs
   `./fcc-block`. `pn-block.ts`, `dev-diode-led.ts`, `dev-solar-mosfet.ts`, `dopants.ts`, `diamond.ts`, `si-sheet.ts`,
   `components.ts` are platform-only.
8. Shared views must live in `electronics/shared/**` — two electronics chapters cannot share a `chapters/<id>/parts`
   file (chapter-boundary rule). The p-n block alone is needed by `diode`, `led`, `transistor` (and branch `rectifier`).
9. Palette (`app/src/style/palette.ts:18-49`, platform, not editable) has no black, grey, gold or silver and only one
   brown (`STANDARD.wireBrown` `:46`, an IEC conductor colour). The resistor colour code (black, brown, red, orange,
   yellow, green, blue, violet, grey, white, gold, silver) must be mapped to tokens (vol. 1 used `amber` for gold,
   `wireBrown` for brown) — and it is *taught* in `resistor-pick`, so brown/red/orange and black/body must stay
   distinguishable on the studio background. Decide once, in `VISUAL.md`.
10. Circuit's lamp is 1,5 V · 0,3 A ≈ 5 Ω hot; electronics' is 6 V · 0,1 A, 60 Ω hot / 5,5 Ω cold. Numbers from
    circuit scripts cannot be reused for the electronics bench.
11. Electronics' diode model is SPICE level 1 (sim README `:165-215`); vol. 1's `diodeCircuit` is a different model
    (barrier 0,71 V default in `pn-block.ts:114`). Visual parameters copied from vol. 1 must be re-derived from
    `sim/core`, or the hill and the multimeter will disagree.
12. Circuit's PATH.md tables ≠ its scripts (deviation list `PATH.md:314-337`); quote the scripts.
13. Vol.-1 scripts are not in the path grammar (`[1][2][3]` panels of 3 paragraphs, «Терміни» with English
    glosses, «Формули» blocks, no word budgets): mine them for facts and sources («Цифри і факти»), never paste the
    prose into electronics scripts.

## 9. Open questions

1. LIBRARY.md: add `circuit` and `electronics` rows and an explicit carve-out from §3 «повторно викладати заборонено»
   (resistor/capacitor/diode/transistor as parts at bench level)? Who approves — orchestrator via a NOTES/PATH-NOTES
   entry?
2. Should the `resistor` inside view be carbon film (grains of graphite, the classic kit resistor) or metal film
   (1 % blue body, NiCr)? The catalog says 5 % / gold band (`sim/core/README.md:126`), which matches carbon film.
3. BJT inside view: draw the real planar NPN (emitter diffused into a base on a collector substrate) or the textbook
   three-slab sandwich? Vol. 1 never drew either; computing plans its own bipolar podium.
4. How deep may `diode` go into doping/holes, given LIBRARY says vol. 1 owns p-n basics and the electronics site has
   no vol. 1? (The journey sets `diode` on floor `atoms`, so the design expects the lattice.)
5. Does the HUD render formulas in «Підписи»/«Висновок» as the STYLE_GUIDE §6 `yellow` formula card, or as plain
   caption text? Not covered by `path_check`; needs the runtime/HUD recon.
6. Which circuit inside-floor assets does the E2 bench actually copy (`copper` world, `HANDOVER`, lens rim)? The
   `resistor` chapter's inside view depends on that choice.
7. Colour-code token mapping (gotcha 9) — needs an owner-visible decision in `VISUAL.md`.
