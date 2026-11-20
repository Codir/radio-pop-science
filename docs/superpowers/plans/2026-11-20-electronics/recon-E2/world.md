# Recon E2 · world — floor axis, dive, inside-of-a-part views (circuit → electronics)

Read-only map, written 2026-11-20 against `main` at `2707887`. Paths are repo-relative; `C/` = `app/src/volumes/circuit/`,
`E/` = `app/src/volumes/electronics/`. Line numbers are of the files as they stand now. Verdicts: **COPY** (as is,
only import paths change) · **COPY+ADAPT** (what to change is said) · **PLATFORM** (use the platform API directly) ·
**REFERENCE** (read for the technique, write our own) · **SKIP**.

---

## 0. Answers in short

**How a circuit chapter moves the camera between floors.** One stage param `deep` (0 stand · 1 «жила» · 2 «ряди» · 3
«один атом»; `C/shared/world/params.ts:54`) is the floor. A step declares `{ camera, params: { deep, lens } }`
through `world.define` (`C/shared/world/index.ts:223`). On a step change `world.enterStep` replaces the stage's straight
tween with a *flight on the dive rail* (`index.ts:273-277`). The rail (`C/shared/world/dive.ts:83`) is a pure function
`position −½…3 → { camera Shot, deep, lens }` built from four stop shots `[lens, handover, copper-rows, copper-atom]`
plus a lead shot `stand` (`index.ts:154-158`): direction slerped, distance log-lerped around the stops' targets.
`flight.update` (`flight.ts:139-197`) writes `deep` and `lens` instantly and `camera.go(shot, {instant})` every frame.
`world.apply` (`index.ts:324-350`) maps `deep` through `mixAt` (`levels.ts:54`) to: the stand's `dive` look (rim arcs,
sheath dissolve), which of the two worlds is drawn, the copper world's own `depth = deep − 1`, and the dithered
dissolve of the copper core over the stand's wire (`index.ts:316`). `look.ts` hands env/post from the stand's light rig
to `copperEnv/copperPost` below `deep 0.98`. Chapters drive it four ways: (a) step params (auto flight), (b)
`world.travelTo(t, seconds)` / `world.scrub(t)` (sliders, scripted entry — `resistance/stand.ts:133-139` dives
`−½ → 2` in 2.8 s), (c) `world.fly(deep, camera)`, (d) no flight at all: the lens as a *window* (stencil portal) on the
stand, `params: { window: 1, lens: 1, deep: 0 }` + `world.lensPose` anywhere (resistance `heat`/`balance`, lamp `story`
on the coil). Chapter borders rewind the rail to `−½` (`border.ts:149-154`).

The *dive into a part* (not into the wire) exists only in the lamp chapter: a chapter-local `CameraRail`
(`C/chapters/lamp/parts/rail.ts:40`, on the same `createDiveRail` maths) with stops `[lampDoor, lampWhole]` and lead
`stand`, a `Door` (`parts/door.ts:38`) that gives the lens pose, rim, glass and the base's cut as functions of the
position, and a `LensKeeper` (`parts/lens-keeper.ts:62`). `deep` stays 0 there; the ladder reports `part` while the
rail is past 0.5 (`lamp/scene.ts:60-64`). **This is the closest precedent for electronics' stand → part → inside.**

**Generic vs copper-specific.** Generic: the rail maths (`dive.ts`), leg/ease constants and floor bookkeeping
(`levels.ts`, after renaming), the flight controller (`flight.ts`, after de-hard-coding shots), the stencil lens
window (`window.ts`), the env/post hand-over pattern (`look.ts`), border choreography (`border.ts` mechanism), the lens
model and its poses, the lamp chapter's door/rail/keeper, and in the copper library the *drawing and motion
primitives* (haze, soft dots, shells, streaks, electron sim + rules, run, lean, hits, joule, backdrop, rim). Copper-
specific: `world/index.ts` (mounts the circuit stage and the copper world at the near wire's `HANDOVER`), `core.ts` +
`core-shader.ts` (the wire's cylinder, measured stand colours, FCC dot stages), `mount.ts` (core radius), `shots.ts`
(wire shots), FCC `latticeSites`, `atom.ts` (29-electron copper layers), `plastic.ts` (wire sheath placement),
`gate.ts` (counter frame), every circuit table (`BORDERS`, `ORDER`, `WorldParam` names).

**What to copy for electronics' four views.** A volume-local dive kit `E/shared/dive/**` (rail, levels, flight, window,
look, border, door/rail/keeper from lamp) + one "inner world" per material in `E/shared/inner/**` built from copied
copper primitives: **resistor film** = film lattice (FCC for metal film with impurity tint, disordered sites for
carbon) + electron sim + run/hits/joule (the `resistance/bumps` demo) + a helix groove on a ceramic rod (helix maths
from `bulb-close.ts:79`) opened by a wedge/sleeve cutaway (`lamp-view.ts:206`, `battery-inside.ts:235`); **capacitor**
= two metal plates (lattice + sim with `sim.surface` ±1 for surplus/lack, `electron-sim.ts:66-70`) with a dielectric
of bound electrons on threads (`plastic.ts`, add a polarisation bias) and a section relief (`battery-section.ts:98-153`);
**p–n junction / transistor layers** = new silicon sheet with dopant ions, free electrons and holes — nothing in
circuit; the platform has `ORB_STYLES.hole`/`ion` (`app/src/fx/characters/orb.ts:130,175`) and volume `electricity`
has a full planar scheme (`electricity/chapters/matter/parts/{si-sheet,pn-block,dopants,dev-solar-mosfet}.ts`) — copy
permission for that volume is an open question.

---

## 1. The dive, step by step (circuit)

1. **Mount** (`C/shared/world/index.ts:123-193`): `mountStage(ctx)` (the stand, already under `ctx.root`), `createCopper`
   added to `ctx.root`, `mountAtHandover(copper.group, {point: HANDOVER.spot, view: HANDOVER.direction, axis:[1,0,0],
   coreRadius: WIRE.core*1.012})` → `scale` (≈0.0059). `createLensWindow(stand.tools.lens)`; `copper.rim.amount = 0`
   (the stand owns the rim); `ctx.camera.shots({...STAGE_SHOTS, ...copperShots(group,'copper-'), away})`;
   `registerParams`; `createLook`; rail = `createDiveRail([STAGE_SHOTS.lens, STAGE_SHOTS.handover, copper-rows,
   copper-atom], STAGE_SHOTS.stand)`; `createFlight`; `createBorders(manifest.id, deps)`.
2. **Steps** (`index.ts:223-226`): `world.define(steps)` remembers specs and forwards to `ctx.stage.define`.
3. **Step entry** (`index.ts:266-289`): release the rail; if not instant and `deep` changes and the step has a camera →
   reset `deep` to where it was and `flight.fly({deep, camera, lens})`. Instant (deep link) → `rail.set(to)`, iris to
   the window param, `stand.snap()`, `copper.snap()`, `poseSnap`. Then `apply()` and `look.assert(below, {instant,
   standPost})` (re-asserts env/post, which the stage resets on every entry).
4. **Flight** (`flight.ts:99-112`): from the stand plan with the lens not yet on the wire → lens leg (`stage.setParam
   ('lens',1)` + `camera.go('lens', 1.4 s)`), then engage the rail and `travelTo(deep)`; below the stand → hold
   `lens` at 1, engage, travel. Engaging never cuts: the offset between screen and rail pose fades at `CATCH_UP` 6/s
   (`flight.ts:157-183`). At arrival, if the step's camera is not the stop's shot (`STOP_SHOTS`, `flight.ts:23`), one
   extra camera move (`flight.ts:184-196`).
5. **Every frame** (`index.ts:290-322`): border.update → flight.update → `stand.update` → lens pose blend
   (`lensPose`, damped 3.2/s) → `afterLens` hook → `apply()` → copper lamp/drift from the stand's glow → `copper.update`
   and the core dissolve `core.fade *= mixAt(deep).copperIn` → `look.update` → `setWhereBase(key, floorAt(deep) |
   'stand')`.
6. **`apply()`** (`index.ts:324-350`): window iris (opens 1.6/s, closes per `closeSeconds`), `win.clip` toggles stencil
   on every copper material when the window opens/closes and re-mounts the copper world at the hand-over on close;
   `stand.dive = mix.standDive`; visibility of both worlds; `copper.depth = inWindow ? 1 : mix.copperDepth`.
7. **Look** (`C/shared/world/look.ts:19-76`): below → `stand.light.yieldEnv(true)` + `ctx.env.tune(copperEnv(glow,
   group))` + `ctx.post.apply(copperPost(depth, scale))`; follows lamp changes (> 0.04) and swaps the core's lens (no
   DOF) for the rows' (deep DOF) at copper depth 0.5; above → `yieldEnv(false, blend)` + the step's post.
8. **Borders** (`C/shared/world/border.ts:106-232`): `leave(to)` → from below a timed rewind `travel(−LENS_LEG, 1.9)`
   then the switch; on the stand a 2.4 s move to `stand`, lens home, window shut; returns the «there» predicate for
   `SceneHooks.leaveChapter`. `arrive(id, from, {then})` → put the step on the border frame, hold `HOLD` 0.5 s, then
   `fly` (below) or move the camera, set params (switch after 0.5 s), call `then`.

---

## 2. `C/shared/world/**` — file by file

| File (lines) | Exports (signatures) | What | Imports that a copy drags | Verdict |
|---|---|---|---|---|
| `README.md` (126) | — | contract: mount, `deep` table, flight timings, params, look, window, dive-as-position (round 4–5), borders | — | REFERENCE (rewrite as `E/shared/dive/README.md`) |
| `index.ts` (352) | `interface WorldOptions {globe?, drift?}` :46 · `interface CircuitWorld` :53-118 (`stand, copper, scale, deep, floor, floorId, floorName(volume, visited), window, lensPose, drift, afterLens, value(name), flying, define(steps), fly(deep, camera, info?, lens?), scrub(t), travelTo(t, s?), release(), position, goal, takeLens(), flyIn(id, info?), border, enterStep(id, info), update(dt,t)`) · `mountWorld(ctx, opts?): CircuitWorld` :123 · re-exports levels, `STOP_SHOTS`, `LENS_LEG`, away, `BORDERS/borderOf` :39-44 | the composition of stand + copper on one `deep` | `@/engine/api` (`damp, floorLabel, ChapterContext, PostOverrides, StepInfo, StepSpec, VolumeManifest`), `@/hud/where` (`setWhereBase`), `@circuit/shared/stage` (`HANDOVER, STAGE_POST, STAGE_SHOTS, WIRE, mountStage, CircuitStage, LensPose`), `@circuit/shared/copper/{copper,mount,shots}`, `./away ./border ./dive ./flight ./levels ./look ./window ./params` | **COPY+ADAPT → REFERENCE-heavy rewrite**: keep the API shape (`define/enterStep/update/fly/scrub/travelTo/release/position/goal/lensPose/afterLens/window/border/floorId`); replace `mountStage` by the electronics bench, `createCopper`+`mountAtHandover` by a pluggable `InnerWorld` interface (`group, depth, snap(), update(dt,t), env(lamp), post(depth, scale)`) mounted at a per-part hand-over; rail stops from the part under the lens, not from fixed `STAGE_SHOTS`; drop `flyIn`/`away` unless the prologue ends on a map frame |
| `levels.ts` (94) | `type FloorId = 'stand'\|'part'\|'rows'\|'atom'` :10 · `DEEP` :13 · `LEG {lens 1.4, ring 2.1, floor 2.2}` :16-23 · `FLIGHT_EASE 'sine.inOut'` :26 · `interface WorldMix {standDive, standShown, copperShown, copperIn, copperDepth, below}` :39 · `mixAt(deep): WorldMix` :54 · `floorValue(deep)` :67 · `floorAt(deep): FloorId` :70 · `interface Leg`, `legsBetween(from,to): Leg[]` :76-94 | pure floor bookkeeping; dissolve window `[0.8,1]` :29, stand hidden from 1.3 :31 | none | **COPY+ADAPT**: `FloorId = 'stand'\|'part'\|'inside'\|'atoms'` (E `volume.json` axis ids; note `atoms` plural, `inside` not `rows`), `floorAt` array :72; rename `copper*` fields to `inner*`; electronics likely needs **two** hand-overs (part→inside exchange of models, inside→atoms exchange of worlds) — make `mixAt` take the hand-over depths as data. `legsBetween` is unused by the rail now (only tests) — may SKIP |
| `dive.ts` (222) | `LENS_LEG = 0.5` :27 · `LENS_LANDS = 0.85` :29 · `ringEase(x)` :46 · `leadCamera(u)` :51 · `leadLens(u)` :56 · `interface DiveRail {min, position, target, moving, scrub, travelTo(t, s?), set, step(dt), shotAt(t): Shot, deepAt(t), lensAt(t), positionOf(deep, lens)}` :58-81 · `createDiveRail(stops: readonly Shot[], lead?: Shot): DiveRail` :83 | the dive as a position; speed-limited glide (`V_MAX .6`, `A_MAX .75` :24-25) or timed cosine glide; Hermite-eased ring leg (`RING_IN .22`) so the lens leg's pace carries into the push-in; `between()` :100-123 slerps direction, log-lerps distance, fov lerp, `near = clamp(dist*0.03, .004, 2)`, `fit` radius `dist*0.24`, `drift 0`, orbit off | `three` (`Vector3`), `@/engine/api` (`Shot` type) | **COPY as is** (fully generic; stops are just `Shot[]`) |
| `flight.ts` (200) | `STOP_SHOTS = ['lens','handover','copper-rows','copper-atom']` :23 · `interface FlightPlan {deep, camera: string\|Shot, lens}` :27 · `interface Flight {fly(plan, lead?), takeLens(), scrub(t), travelTo(t,s?), release(), flying, engaged, update(dt)}` :35-54 · `createFlight(ctx, rail, deepNow, lensNow): Flight` :56 | rail ⇄ stage params ⇄ camera; lens leg; catch-up offset; final camera move | `@/style` (`REDUCED_MOTION`), `@circuit/shared/stage` (`STAGE_SHOTS` — **only** for `LENS_SHOT` :21 used by `atLens()` :93), `./dive`, `./levels` (`LEG`) | **COPY+ADAPT**: pass `lensShot: string` and `stopShots: readonly string[]` (or a `stopName(i)` fn) into `createFlight`; `atLens()` must compare to the *current part's* lens shot; keep param names `deep`/`lens` |
| `look.ts` (76) | `interface WorldLook {assert(below, {instant, standPost}), update(below, depth, standPost)}` :12 · `createLook(ctx, stand, copper, scale)` :19 | env/post ownership hand-over with blends; follows the lamp | types `CircuitStage`, `Copper`; `copperEnv/copperPost` from `copper/look.ts` | **COPY+ADAPT**: depend on `{ light: { yieldEnv(yielded, blend?) } }` of the electronics bench and on the inner world's `env(state)`/`post(depth, scale)`; "lamp" input becomes whatever state the bench passes down (current through the part) |
| `window.ts` (126) | `interface LensWindow {amount, span, closeSeconds, place(world), clip(world, on), update()}` :43 · `createLensWindow(lens: LensModel): LensWindow` :57 | stencil portal: iris disc on the glass (renderOrder 900, depth reset to far, stencil 1); inner world materials draw only where stencil = 1 (renderOrder 1001+own); orientation keeps world +x left↔right :92-95; focal plane 1.4×scale behind the glass | `@/style` (`col`), `@circuit/shared/stage` (`LensModel` type, `LENS.radius`) | **COPY+ADAPT**: radius from the electronics lens; replace the fixed `(1,0,0)` "wire axis" by a parameter (the part's axis on the board); keep the renderOrder-preserving `WeakMap` |
| `params.ts` (57) | `type WorldParam` :9-22 · `interface WorldParams {deep, lens, window, all, deepBefore}` :24 · `registerParams(ctx, stand): WorldParams` :33 | registers stage params with `onChange` → stand fields; `deep` has no onChange (read by the world) | `CircuitStage` type | **COPY+ADAPT**: new param set for the bench (e.g. `power`, `lens`, `lensCall`, `window`, `deep`, `cut`…); drop the deprecated `snail/ruler/spark/race` |
| `border.ts` (232) | `interface BorderState {closed, poles, away?}` :15 · `ORDER` :25 · `BORDERS` :45 · `borderOf(here, there)` :57 · `LEAVE_SECONDS 2.4` :65 · `SWITCH_DELAY .5` :72 · `HOLD .5` :76 · `interface BorderDeps` :79 · `interface Borders {leave(to), arrive(id, from, {camera?, then?}), update(dt)}` :93 · `createBorders(here, deps): Borders` :106 | chapter-border choreography (VISUAL §3 «межа — той самий кадр») | `./away`, `./dive` (`LENS_LEG`) | **COPY+ADAPT**: mechanism generic; rewrite `ORDER` (= E journey order), `BORDERS` and `BorderState` for the bench (battery switch, player playing?, parts on board?); drop `away` unless needed |
| `away.ts` (39) | `AWAY_FOCUS, AWAY_SHOT, AWAY_MOON .3, AWAY_POST` | prologue's «away» frame behind the map board | `@circuit/shared/stage` (`STAGE_FOV`) | **SKIP** (adapt only if the electronics prologue ends on a map board) |
| `__tests__/dive.test.ts` (136) | — | lens leg monotone & lands at 85 %; joint at 0 keeps pace (ratio < 1.5); no jump (frame change < 0.06 per 0.005); `positionOf` inverts `deepAt`; timed travel ends on time, eased | `@circuit/shared/stage/shots` (`HANDOVER, STAGE_SHOTS`) for stop shots | **COPY+ADAPT**: build synthetic stops (no stage import) |
| `__tests__/levels.test.ts` (51) | — | `mixAt` visibility/dissolve, `floorValue/floorAt`, `legsBetween` | — | **COPY+ADAPT** to new ids/thresholds |

---

## 3. `C/shared/copper/**` — «inside the metal» (lower floors)

Total ≈ 3 340 lines + 319 lines of tests. Frame (README:23-26): wire axis **X**, focal plane **XY at z = 0**, bulk
along **−Z**, reader on **+Z**, +Y «above»; atom radius 1, pitch 3.2, electron radius 1/6; origin = hero atom.
`copper.space` carries the dive zoom (`copper.ts:157-158`). Uniform scale only.

| File (lines) | Exports | What | Imports (copy closure) | Verdict |
|---|---|---|---|---|
| `README.md` (241) | — | parameters table :64-80, chapter states :85-95, foreseen: tungsten `layout.ts`+lattice colours :142-143; additions of ch. 4–5 (`leash`, `box`, `field/restart/onHit`, `bend`, `kick`, `hits`, `hit-lens`, `trembleHeat`) | — | REFERENCE |
| `copper.ts` (234) | `ATOM_ZOOM 2.35` :21 · `interface Copper {group, space, lattice, sim, electrons, atom, plastic, gate, backdrop, core, rim, depth, lamp, atoms, growSeconds, hero, heroPosition(out), look{x,y}, marked, markNearest(x?,y?), toLocal(p), localRay(ray,out), snap(), update(dt,t)}` :43-90 · `createCopper(ctx)` :92 | orchestrator: `depth` 0…2 drives every sub-part through `smooth()` windows (`copper.ts:155-231`): dive scale log-lerp `DIVE [[0,.03],[.7,.62],[1,1]]` :24, core stages dots .05–.4 / balls .26–.7 / open .72–.9, lattice fade .54–.7, hero shrink 1.05–1.68, neighbours leave 1.06–1.68, veils through-share, electrons fade .6–.8 and out 1.1–1.4, atom open 1.05–1.25 | everything below + `ctx.random.fork('copper-electrons' / 'copper-atom' / 'plastic')` | **COPY+ADAPT** as the template of an `InnerWorld` per material: keep the "one `depth` → every property is a continuous eased function" rule; replace core/plastic/gate with the material's own parts |
| `layout.ts` (82) | `ATOM_R 1, PITCH 3.2, PLANE_GAP, ELECTRON_R, OUTER_R 1.52, NUCLEUS_R .085, COLS 7, ROWS 4, PLANES 4, ROW_HALF, ROW_ATOMS, PIECE_ATOMS, COPPER_TOP` · `interface Site {p, plane, i, j, rank}` :35 · `latticeSites(): Site[]` :48 · `clamp01, smooth(a,b,v), mix` :77-82 | FCC seen along a cube axis (square grids, ABAB shift); ranks for "atoms pop in" | `three` | **COPY+ADAPT**: parameterise pitch/rows/planes/top; add `filmSites(kind)` (metal film: FCC + impurity flag; carbon: jittered/disordered sites; silicon: square projection of diamond); keep `Site.i/j` grid indices or replace the grid lookup (see `electron-rules`) |
| `lattice.ts` (233) | `interface Lattice {group, sites, atoms: Orbs, hero: Orbs, haze, reveal, tremble, heat, edge, color: Color, fade, heroShrink, others, recede, hazeAmount, selected, heroSite, siteAt(p), touch(site), kick(site, flash, shake), positionOf(site,out), presence(site), update(dt,t)}` :35-89 · `createLattice()` :93 | instanced matte orbs (`ORB_STYLES.blob`, coral, glyph none :25-33), hero apart, trembling, heat rim, kick flash | `@/engine/api` (`damp`), `@/fx` (`createOrbs, ORB_STYLES, Orbs, OrbStyle`), `@/style` (`col`), `./haze`, `./layout` | **COPY+ADAPT**: sites and per-site colour/kind as inputs (impurity atoms in NiCr / dopants in Si need a second colour or a second `Orbs`); `lattice.color` already swappable (tungsten precedent `lamp/steps/06-story.ts:124`) |
| `haze.ts` (105) | `interface Haze`, `createHaze(count)` :61 | per-atom veil of own electrons; heat → orange rim; one draw call | `@/style`, `./layout` (`ATOM_R`) | **COPY** |
| `electron-sim.ts` (326) | `FOCUS_COUNT 32`, `DEPTH_COUNT 44`, `driftFor(lamp, share?)` :23 · `interface ElectronSim {count, pos, shown, depthOf, speed, drift, leash, box{x,y}, shared, surface (−1…1), width, piece, centre, lean, leanSpan, gate{…}, followed, field, restart, runSpeed, onHit, nearest(x,y), reset(), step(dt,t)}` :36-123 · `createElectronSim(rng: Rng, world: Obstacles)` :125 | the restless crowd: straight flights, random turns, bounces off atoms; leash homes slide with drift; `surface` ±1 = charged top surface (surplus/lack) — **directly usable for a capacitor plate**; `field/restart` = the run of one electron (resistance) | `@/engine/api` (`Rng`), `./electron-rules`, `./lean`, `./layout`, `./run` | **COPY** (+ADAPT later: holes need a mirrored sim or a `charge` sign per particle; slab/box constants are copper-frame) |
| `electron-rules.ts` (121) | `interface Obstacles {at(plane,i,j), presence(site), sites}` :10 · `siteIndex(sites)` :18 · `collide(pos, dir, e, world): site\|-1` :36 · `keepNear` :65 · `keepInCopper` :103 · `keepInSlab` :112 | collisions via **grid lookup** (`k0 = round(-z/PLANE_GAP)`, i/j from PITCH) | `./layout` | **COPY+ADAPT**: a disordered (carbon) film needs a spatial-hash `at()`; `keepInCopper` uses `COPPER_TOP` — generalise to the film's/plate's bounds |
| `run.ts` (54) | `accelerate(pos, dir, e, v, field, dt, top)` :14 · `steerInward(...)` :42 | field speeds the followed electron toward −X; bounce restarts it | — | **COPY** |
| `lean.ts` (28) | `LEAN_MAX .85` :17 · `leanX(x, centre, span, lean)` :20 | crowd drawn denser on one side (field outside) | — | **COPY** (capacitor plates charging, junction diffusion pictures) |
| `electrons.ts` (193) | `interface ElectronView {group, orbs, marked, fade, crowd, bend, positionOf(e,out), cut(), update(dt, face)}` :22 · `createElectronView(sim)` :44 | cyan electron orbs (`glyph:'none'`), tails, marked ring + 2.4 s path | `@/engine/api` (`toOverlay`), `@/fx` (`createOrbs, ORB_STYLES, RibbonLines`), `@/style` (`K`), `./electron-sim` (type), `./layout`, `./streaks` | **COPY** (holes: a sibling view with `ORB_STYLES.hole`) |
| `streaks.ts` (113) | `createStreaks(count)` :72 | solid tapered tails that write depth (DOF-correct) | `@/style` | **COPY** |
| `hits.ts` (143) | `interface HitEvent` :28 · `interface Hits {marked, total, rate, last, time, flashRate, show, reset(), update(dt)}` :36 · `createHits(copper: Copper)` :55 | counts sim hits, flashes atoms, trembling runs to two neighbours 0.11 s later | type `Copper`, `./layout` (`PITCH`) | **COPY+ADAPT**: narrow the `Copper` dependency to `{sim, lattice, marked}` |
| `joule.ts` (16) | `WORKING_HEAT .58` :10 · `trembleHeat(amps, at=.3, top=WORKING_HEAT)` :13 | heat ∝ I² | — | **COPY+ADAPT** (`at` = the part's rated current / power, from the model) |
| `backdrop.ts` (151) | `interface Backdrop`, `createBackdrop()` :76 | dome + veils between planes; lamp light from above (warm) vs cool | `@/style` (`col, kGlobals`), `./layout` (`PLANE_GAP, PLANES`) | **COPY+ADAPT** (plane count from layout; "lamp" = state passed down) |
| `look.ts` (68) | `copperEnv(lamp, group?): EnvOverrides` :18 · `COPPER_LOOK_RADIUS 6` :47 · `copperPost(depth, scale=1): PostOverrides` :56 | light rig and lens of the lower floors; world-unit DOF/AO params × mount scale | `@/engine/api`, `@/style` | **COPY+ADAPT** (rename `innerEnv/innerPost`; the depth<0.5 "no DOF" rule belongs to the part's surface floor) |
| `lens-rim.ts` (86) | `interface LensRim {mesh, amount, open}`, `createLensRim()` :50 | screen-space rim on the overlay layer | `@/engine/api` (`toOverlay`), `@/style` | **COPY** only for sandbox/stand-alone; in a chapter the stand's `tools.lens.rim` is used (`copper.rim.amount = 0`) |
| `atom.ts` (241) | `INNER_COUNT 28`, `OUTER` :24-26 · `interface Atom {group, nucleus, outer, open, apart, aside, outerShown, nucleusShown, freed, hold(i,to?), held, nearest(o,d,reach?), electronPosition(i,out), reset(), update}` :30-53 · `createAtom(rng)` :65 | one copper atom: glowing nucleus, 28 soft electrons in 2·8·18 (`LAYERS` :19-23), outer electron as the character, tear-off at 2.15 | `@/engine/api`, `@/fx`, `./layout`, `./shells`, `./soft-dots` | **COPY+ADAPT** if a single-atom view is wanted (Si = 2·8·4, C = 2·4): make `LAYERS` and the outer count data. Journey: `diode` sits on floor `atoms` — probably lattice, not one atom |
| `shells.ts` (93) | `createShells(radii: [n,n,n,n])` :55 | 4 soft bands, one quad | `@/style` | **COPY** (with atom.ts) |
| `soft-dots.ts` (96) | `createSoftDots(count, color)` :55 | additive soft blobs | `@/style` | **COPY** (with atom.ts; also good for a bound-charge blur) |
| `plastic.ts` (167) | `interface Plastic {group, atoms, electrons, fade, update(t)}` :35 · `createPlastic(rng)` :44 | insulator: violet atoms in wavy chains, each electron on a short springy thread; chains placed above `COPPER_TOP` :16-24 | `@/engine/api`, `@/fx`, `@/style` (`K`), `./layout` | **COPY+ADAPT** → the **dielectric** of a film capacitor: placement from the gap between plates, add `polar` (−1…1) that offsets every tethered electron along the field (visible polarisation); ceramic dielectric could reuse it with a crystal placement |
| `gate.ts` (171) | `createGate(sim)` :38 | counter frame among atoms with two counts | `@/engine/api`, `@/style`, `@/text` (`Text3D`), `./electron-sim` | SKIP (unless a "current through the film" counter is scripted) |
| `hit-lens.ts` (175) | `interface HitLens {group, fill, shown, frost, light, update}` :73 · `createHitLens()` :87 | strip on the lens rim filling by hit rate; frosted glass | `three`, `@/style` | REFERENCE/COPY if `resistor` compares parts by hits (the `resistance/balance` idea) |
| `core.ts` (190) · `core-shader.ts` (139) | `CORE_R 6.1, CAMERA_Z 19.7, CAMERA_FOV 27, STAND_COPPER` · `createCore()` :117 · `CORE_VERT/CORE_FRAG` | the wire's copper cylinder at the hand-over, colours measured on the stand, four-stage "metal → dots → balls → open" shader keyed to the FCC planes | `@/style`, `./layout` | **REFERENCE** (the four-stage dissolve is the technique for a film surface turning into atoms; the cylinder, colours and FCC maths are wire-only) |
| `mount.ts` (40) | `interface Handover {point, view, axis, coreRadius}` :10 · `mountAtHandover(group, h): scale` :28 | places/scales the inner world so its first frame equals the stand's hand-over frame | `./core` (`CORE_R`) | **COPY+ADAPT**: `coreRadius/CORE_R` → "the size of the part's feature that fills the frame" (film thickness band, plate gap, junction width) |
| `shots.ts` (74) | `COPPER_SHOTS` :25 (`core, rows, atom, apart, one, pair, row, piece, gate, edge, plastic`) · `GATE_SHOT_X` :49 · `copperShots(group, prefix?)` :52 | local shots → world; tilted mount narrows azimuth to ±0.03 and drift 0.4 | `./core`, `./layout` | **COPY+ADAPT** (own shot table per inner world; keep the tilt rule) |
| `__tests__/*` (319) | — | `copper.test` lattice ranks/positions, sim keeps inside; `counter`, `lean`, `leash`, `run` (`new Rng(seed)` from `@/engine/api`) | — | COPY the ones whose code is copied |

---

## 4. `C/shared/stage/**` — inside-of-a-part views and the lens

| File (lines) | Exports | What | Imports | Verdict |
|---|---|---|---|---|
| `unfold.ts` (348) | `UNFOLD_SECONDS 6` :26 · `UNFOLD_PLAY` :35 · `BEATS` :37 · `interface Unfold {set(u, open), beat6, beatOf(u), beam, axis}` :75 · `createUnfold(stand, torch, T?, B?)` :88 | flashlight → stand as ONE pure function of `u` (six beats; `place(object, from, to, e, lift)` arc :155-161; strips pinned to parts) | `./layout ./base ./small-parts ./stand ./torch ./bulb ./wires ./dyn-tube` | **REFERENCE** (pattern "assembly as a pure function of one number, scrubbable both ways" + helpers `ramp/smooth/inOut/backOut/hump` :39-44 and `place()`; useful for parts flying from the tray into sockets and for an exploded view of a part) |
| `battery-section.ts` (153) | `type BatteryLayer` :15 · `BATTERY_LAYERS` :18 (**Ukrainian strings in code**) · `type Stuff` :29 · `SEC` :34 · `METAL` :85 · `interface Cell {stuff, layer, s, first, count}` :88 · `class Relief {cells; box(stuff,x0,x1,y0,y1,s?); pair(...); geometry()}` :98-133 · `paint(geometry, cells, colorOf)` :136 | a cut face as a shallow **relief** of boxes, each layer at its own height so steps catch light; vertex-colour repaint per cell | `three`, `./layout` (`BATTERY`) | **COPY+ADAPT**: `Relief` + `paint` are generic (make `TOP`/`LAYER_OF` tables parameters); use for the resistor's lengthwise section (lead · end cap · ceramic rod · film · lacquer), the film capacitor's foil/film stack, the electrolytic's foil/paper/electrolyte; layer names go to content (not code) |
| `battery-inside.ts` (418) | `CUT_TILT` :39 · `CUT_NORMAL` :41 · `interface BatteryInside {cut, life, reaction, activity, surplus, lack, mark, hold, current, clump, …, highlight, island, lamp, layers, anchors, pick(raycaster), update}` :43-92 · `interface Outside {group, keepFar, keepNear, pastMinus, sleeve, setSleeveFade, setPrint}` :95-107 · `createBatteryInside(outside)` :150 · `BATTERY_SHOTS` :391 | the opened battery: outside built twice (far half clipped by `keepFar`, near-half sleeve clipped by `keepNear`), sleeve lifts along `CUT_NORMAL`, slides along the axis and fades by alpha (`applyCut` :235-249); section relief under it; per-layer anchors + invisible pick boxes (`PICK_AT` :125, `PICK_ORDER` :138); `highlight` lifts one layer; `island` point light (shadowless, intensity 0 when off: no recompiles) :142-144, :358-361 | `@/engine/api`, `@/style`, `./layout ./battery-grains ./battery-layers ./battery-section ./battery-react ./battery-poles ./shots ./tools/gauge` | **REFERENCE + COPY+ADAPT the cut mechanism** (`Outside` contract, `applyCut`, `placePlanes`, pick boxes, `highlight`, `island`) into a generic `cutaway(outside, section)`; battery chemistry (grains, react, poles) SKIP |
| `bulb-close.ts` (163) | `FINE_COIL {turns 22, radius .03, wire .0052, half .148}` :18 · `coilArch(s)` :21 · `supportPath(B, side)` :24 · `FRONT {lead, cut}` :38 · `leadDown()` :41 · `leadOut(B)` :56 · `finePath(B, helix?, perTurn?)` :79 · `fineCoilGeometry(B): TubeGeometry` :96 · `interface LampMarks` :117 · `lampPathLocal(B, helix?): {points, marks}` :132 | the lamp close-up geometry as pure functions: a real helix, leads, the current's ordered path with share marks | `three`, `@/kit` (`G.roundPath`), `./bulb` (type `BulbDims`) | **COPY+ADAPT**: the helix maths is exactly the **resistor's spiral cut** (helical groove on the film around the ceramic rod; turns ∝ how much the value was trimmed) and the current's path `lead → cap → film spiral → cap → lead` with marks (for a path marker as `lamp/inside`); tests in `stage/__tests__/bulb-close.test.ts` (70) are the pattern (pure geometry assertions) |
| `lamp-view.ts` (324) | `capSections` :191 · `CAP_TONE .42` :199 · `createCutter(B, parts)` :206-255 · `DETAIL_FAR 4.1, DETAIL_NEAR 3.5` :259 · `interface LampView {heat, celsius, detail, detailShown, cut, thermal, path, anchors}` :263 · `createLampView(close, filament, heatNow, celsiusOf, thermal)` :286 | close-up **LOD by camera distance** (coarse ↔ fine coil); **wedge cutaway**: 5 local clipping planes in intersection mode, installed only while `cut > .001` (toggling sets `needsUpdate`), refreshed to world each frame; back faces of shells shaded flat as section caps (`onBeforeCompile` patch before fog) | `three`, `@/kit`, `@/style`, `./bulb`, `./bulb-thermal`, `./bulb-close` | **COPY+ADAPT** `createCutter` + `capSections` into a generic `wedgeCut(group, materials, shells, planesFn)` — the cheapest way to open a resistor's lacquer / a ceramic disc / an electrolytic can where it stands; the detail-by-distance cross-fade is the pattern for parts on the board |
| `bulb-thermal.ts` (249) | `thermalShade(celsius)` :21 · `interface ThermalView` :112 · `createThermal(setup)` :132 | heat view **inside the lens ring**: twin meshes in false colour, fragment kept only if the camera ray crosses the lens disc; no render target | `@/style`, `./bulb-heat` | REFERENCE (a "thermal loupe" over warming parts on the breadboard — only if a step asks for it) |
| `crawl-scene.ts` (121) | `CRAWL_SECONDS {in 2, out 1.5}` :18 · `interface CrawlAnchors` :20 · `interface CrawlScene {duration, lengthCm, scaleMm, time, show(i?), hide(i?), shown, presence, ready, snailCm, sparkMm, anchors}` :34 · `createCrawlScene(tools)` :64 | one-entry scene driven by one number (true seconds); arrival/leaving as a constant-speed presence 0…1 | `three`, `./tools` (type) | REFERENCE (the "presence 0…1 + beats windows" idiom); scene content SKIP |
| `tools/crawl.ts` (246) | `CRAWL_BEATS` :35 · `interface CrawlModel` :71 · `createCrawl(snail)` :113 | snail on its lane, ticks as an instanced wave, trail shader | `@/style`, `@/text`, `./crawl-lane`, `./snail` | SKIP (the instanced "grow as a wave" ticks :157-167 is a nice REFERENCE) |
| `tools/lens.ts` (204) | `interface LensPose {position, facing, handle, scale?, grip?}` :17 · `interface LensModel {group, setPose(from,to,k), setCall(amount,t), setRim(amount), rim, glass, ring}` :32 · `holderPose()` :85 · `createLens(ctx)` :93 | the magnifier: cyan ring (quiet ↔ calling), slate handle as a scalable `grip`, glass (`sheath` material, renderOrder 4), screen-space rim arcs (overlay, renderOrder 50, aspect on resize); `setPose` arcs 0.7 up | `@/engine/api` (`toOverlay`), `@/kit` (`Builder, G`), `@/style`, `../layout` (`LENS`), `../materials` (`sheath`) | **COPY+ADAPT** (holder position and radius from the electronics bench layout; copy `materials.ts` `sheath()` :98 along, 138 lines file) |
| `tools/index.ts` (187) | `worldToBoard`, `worldDirToBoard` :31-39 · `overWirePose()` :42 · `overStartPose(scale?, z?)` :58 · `interface ToolState` :78 · `interface Tools` :98 · `createTools(ctx, frameGroup)` :114 | owns lens poses (holder/overWire/overStart), the arrive beat, call, `setRim(smooth(ramp(dive,.5,.92)))` :173 | stage layout/shots/base, every tool | **REFERENCE** (bench will have its own tools index; copy only the pose helpers' pattern "lens over a board point, lifted toward the camera" — also `resistance/parts/poses.ts:16` and `lamp-shots.ts:58`) |
| `tools/loupe.ts` (122) · `loupe-shader.ts` (139) | `LOUPE` :15 · `interface LoupeModel {group, shown, magnification, labels, anchors, set(mm, warm, t, lens)}` :17 · `createLoupe(scaleMm, unitsPerMm)` :35 | the lens as a *plain* magnifier: a shader disc behind the glass with its own enlarged picture (no stencil, no world) | `@/style`, `@/text`, `../layout` | REFERENCE (a cheap "enlarged colour bands" view if the part floor needs magnification without a camera move) |
| `shots.ts` (107) | `boardToWorld(x,y,z,out?)` :14 · `STAGE_FOV 27` :21 · `HANDOVER {spot, direction, distance, position, fov}` :27 · `LENS_OVER_WIRE` :39 · `STAGE_POST {stand, lamp}` :49 · `STAGE_SHOTS {stand, flashlight, crawl, lamp, lens, handover}` :54 | hand-over pose: perpendicular to the wire, core diameter = safe-frame height (`distance = r / tan(fov/2)`) | `./layout ./base` | REFERENCE (the hand-over rule "the inner world's first frame = the outer world's last frame, same camera, same feature size" must be re-derived per part) |

---

## 5. Chapter-level references

### 5.1 `C/chapters/resistance/**` (dives into the *wire*, not a resistor)

- `chapter.ts` (46): `STEP_IDS` :13 (kept equal to the generated manifest by `__tests__/manifest.test.ts`), `interface Chapter
  {ctx, ui, stand, reached, reach, here}` :16, `interface StepModule {spec, ui, enter?(info), leave?(), update?(dt,t)}` :27,
  `type StepFactory` :39, `sessionGoals` module state :42 (survives a scene rebuild). **COPY+ADAPT** as the electronics chapter
  skeleton.
- `scene.ts` (110): orchestrator only — stand → step modules → `world.define({...spec, enter, leave})` :49-56 →
  `ui.define` :57; `from` = chapter on screen at create (`ctx.store.get()`) :42-43; `enterStep` → `world.enterStep` first,
  `stand.snap()` on instant, `world.border.arrive(id, from, {camera: id !== 'bumps', then})` with `then` = `stand.diveIn()`
  for the first step :77-93; `leaveChapter` → step `leave`, props off, `border.leave` predicate :94-104; `update` skips the
  step while leaving :105-108; `ctx.qa.expose('motion'|'resistance', …)` :58-75. **REFERENCE** (template).
- `content.ts` (17): `caption(step, i)` reads `labels[i]` of the generated content; throws if missing. **COPY+ADAPT**.
- `stand.ts` (167): `DRIFT .06` :22, `DIVE_SECONDS 2.8` :24, `LENS_SCALE 1.2 / SPAN 8.5 / LEASH 1.7` :26-28 (the window
  look: `sim.box = SPAN/2 + LEASH + .3`), `window()` :125-132 (`world.window.span`, `world.lensPose = wireLensPose(...)`),
  **`diveIn()` :133-139** (`deep 0, lens 0` instant, camera `stand` instant, `world.release()`, `world.travelTo(2, 2.8)`),
  `update` :146-164 (heat eased toward target; `world.update`; `hits.update`). REFERENCE.
- `steps/01-bumps.ts` (152): `spec {camera:'copper-rows', params:{deep:2, closed:1, lens:1, poles:1}}` :74; "Назад" from the
  stand down: on the *first update frame* `world.release(); camera.go('lens', .9)` then `world.travelTo(2, 1.9)` :131-139
  (because `world.enterStep` already planned its own flight); tap a free electron (`parts/electron-proxies.ts`) → `sim.field
  = 9`, `restart 6.5`, `electrons.bend = 3°` → goal 5 hits (`hits.marked`). **The resistor chapter's atoms floor is this
  demo on a film lattice.**
- `steps/02-heat.ts` (149): rise `world.travelTo(0, 2)` on first frame → release → `camera.go('resistance-heat', 1.2)` :117-128;
  lens becomes a window over the wire; `lattice.heat = trembleHeat(I)` :136-141; registers a chapter shot with
  `ctx.camera.shots` :38-52. REFERENCE.
- `steps/04-balance.ts` (216) + `parts/lens-track.ts` (108): the lens dragged along a track with sticky detents on parts
  (`sticky(u)` :64-72) and "what is under the lens" weights (`under(u)` :74-90); `ctx.input.register(hit, {dragStart, drag:
  e.planePoint(up, through, out), dragEnd})` :75-88. **REFERENCE** for dragging the loupe across breadboard sockets (track →
  grid of sockets, detents at parts).
- `parts/glide.ts` (61): `glide(initial): Glide {value, target, moving, go(to, s), set(v), update(dt)}` — a number that travels
  eased from wherever it is. **COPY** into `E/shared/` (every prop/state of the bench should be one).
- `parts/poses.ts` (37): `wireLensPose(x, z, scale?, lift?, out?, y?)` — lens over a board point lifted toward the main
  camera. **COPY+ADAPT** (socket/part point instead of loop wire).

### 5.2 `C/chapters/lamp/**` — the real "dive into a part" precedent (not in the reading list, but decisive)

- `parts/rail.ts` (151): `interface CameraRail {rail, engaged, position, target, moving, scrub(t), place(t), travelTo(t,s?),
  snap(t), release(), update(dt)}` :20-38 · `cameraRail(ctx, stops: Shot[], lead?: Shot)` :40 — `createDiveRail` + hand
  follow (`HAND .05` s) + catch-up offset (3.2/s) + `fit` carried along the stops (:58-72). Imports only `createDiveRail`.
  **COPY** (the right building block for part dives: no `deep` param, no world exchange).
- `parts/door.ts` (66): `interface Door {rail, lens(t): LensPose, rim(t), glass(t), cut(t)}` :28 · `createDoor(ctx, lw, stand)`
  :38 — position −½…1: lens leg (holder → `GLASS_POSE` on the part, `leadLens`) then push-in, the ring travelling toward the
  camera and past it at `PASS .82`, rim arcs `smooth(ramp(t, PASS-.3, PASS))`, glass thins, the base's `cut` opens
  `smooth(ramp(t,.45,1))`. **COPY+ADAPT** → `partDoor(part)` for any breadboard part (stops: `partDoor` shot → `partInside`
  shot; the cut = the part's cutaway).
- `parts/lens-keeper.ts` (116): `interface LensKeeper {shown, gliding, hold(p), to(p, s?), snap(p), call, rim, glass,
  late(dt,t)}` :13 · `mixPose(a,b,e,lift,out)` :51 · `lensKeeper(stand)` :62 — one owner of the lens pose after the stand's
  update; glides with lift ∝ distance; drives ring call, rim, glass opacity (reads `sheath` uniforms `opacity`, `uEdgeAlpha`).
  **COPY+ADAPT**.
- `shots.ts` (95): `door` shot on the close-up's line from farther back (`fit.radius = distance × 0.24` to match the rail's own
  framing) :32-38; `whole` :44; `GLASS_POSE = lampLensPose(1.7, door.position, 1.18)` :53. REFERENCE (recipe per part).
- `steps/01-inside.ts` (141): dock slider «Глибина» `0 … 1 + LENS_LEG`, `onChange: rail.travelTo(v − LENS_LEG)`, `onInput:
  (v, how) => how === 'drag' && rail.scrub(v − LENS_LEG)` :73-91, `ui.patch('depth', {current})` :122-123; tap the resting
  lens → `travelTo(0)` :58-65; post `STAGE_POST.stand ↔ lamp` at rail 0.5 :125-129; ambient lift while at the part :133.
  REFERENCE (the electronics `resistor` step "go inside").
- `steps/06-story.ts` (195): atoms of the filament **through the lens window** placed on the coil, `lattice.color` →
  tungsten :124, `window` param as a function of the slider :171. REFERENCE (the electronics "atoms of the film" can be a window
  on the part instead of a flight).
- `scene.ts:60-64`: `floorLadder(ctx, {floor: () => deep > .01 ? floorId : door.rail.engaged && door.rail.position > .5 ?
  'part' : null})`.

### 5.3 Volume `electricity` (another volume; copying it is an open question) — semiconductor pictures

`app/src/volumes/electricity/chapters/matter/parts/`: `si-sheet.ts` (358, planar Si 10×8, bond electrons, pair generation,
hole hops, recombination; `field` drift; imports only `three`, `@/engine/api`, `@/fx`, `@/style`), `pn-block.ts` (206, p bar
with holes / n bar with electrons, depletion region of fixed ion squares, built-in field arrows, energy hill; `flow` sends
carriers across with recombination flashes), `dopants.ts` (117, P/B dopant atoms that become fixed ±ions, tray),
`dev-solar-mosfet.ts` (131, `createMosfet()` :91: p substrate, two n⁺ pockets, oxide, gate pulls a channel), `diamond.ts`
(86). All platform-only imports (self-contained). Style is volume-1 toon, not circuit's dark studio. **REFERENCE** (or COPY+ADAPT
if allowed) for `diode`, `led`, `transistor`, `mosfet`.

---

## 6. Platform APIs to use directly (no copy)

- `@/engine/api`: `Shot`, `ChapterContext` (`ctx.stage.param/setParam/define/current`, `ctx.camera.shots/go/camera/target/
  moving`, `ctx.post.base/apply`, `ctx.env.tune/setScale/setShadow`, `ctx.random.fork(name)` → `Rng`, `ctx.qa.expose/probe`,
  `ctx.input.register(obj, {cursor, enabled, click, dragStart, drag(e.planePoint), dragEnd, tooltip})`, `ctx.device.formFactor`,
  `ctx.reducedMotion`, `ctx.onResize/onDispose`, `ctx.store.get()`, `ctx.nav.volume`), `damp`, `floorLabel`, `toOverlay`,
  `defineScene`, `defineChapter`, `Rng` (tests: `new Rng(seed)`). `Shot` fields: `position, target, fov, frameAspect, focus,
  orbit, drift, near, far, fit` — **no `up`** (`app/src/engine/camera/director.ts:28-52`).
- `@/hud/where`: `setWhereBase(key, floorId|null)` (world's floor fallback), `setWhere`. `@/hud-dom/journey`: `floorLadder(ctx,
  {floor: () => id|null})` (`ladder.ts:25`; desk ladder, phone chip). `@/hud`: `stepUi(ctx)`, sliders with `onChange/onInput
  (v, how)`, `ui.patch(id, {current})`, callouts `{anchor, text, side, visible}`.
- `@/fx`: `createOrbs`, `ORB_STYLES.{electron, proton, ion, hole (hollow dashed coral ring with +), blob}`, `RibbonLines`,
  `createFlash`, `createSparks`, `createVectorArrow`, `createHalo`.
- `@/kit`: `Builder`, `G.{ring, lathe, roundPath, pathAt, pathLength}`. `@/style`: `K.{toon, metal, glow, glass}`, `col`,
  `kGlobals`, `REDUCED_MOTION`, `EnvOverrides`. `@/text`: `Text3D` (counter-scale inside scaled groups).
- Engine already sets `renderer.localClippingEnabled = true` (`app/src/engine/pipeline/pipeline.ts:255`): clipping planes work.

---

## 7. Generic vs copper-specific (one table)

| Concern | Generic (copy) | Copper/circuit-specific (rewrite) |
|---|---|---|
| Camera along floors | `dive.ts` rail; lamp `rail.ts`; flight catch-up; reduced-motion scaling | stop shot names, `LENS_SHOT`, `HANDOVER` geometry |
| Floor bookkeeping | `levels.ts` maths (`mixAt` windows, `floorValue`) | ids `atom/rows`, single dissolve at 0.8–1 |
| Lens | `tools/lens.ts` model, `LensPose`, `mixPose`, keeper, poses "over a point lifted toward camera" | `LENS.holder/wireSpot`, `overWire/overStart` |
| Window (atoms in the lens on the stand) | `window.ts` stencil portal | "+x is the wire" orientation, radius constant |
| Env/post hand-over | `look.ts` pattern, `copperPost` scale rule | `copperEnv` colours tied to the stand lamp |
| Borders | `border.ts` mechanism, `HOLD`, predicate | `ORDER`, `BORDERS`, `BorderState` |
| Opening a part | `Relief/paint`, battery `Outside`+sleeve+clip planes, lamp wedge cutter + `capSections`, LOD by distance, pick boxes, `island` light | battery chemistry, lamp leads/base, `SEC` numbers |
| Inner world | depth-driven orchestration; haze; electron sim + rules + run + lean + leash + `surface`; electrons/streaks; hits/joule; backdrop; shells/soft dots | FCC sites, `COPPER_TOP`, `core*` cylinder + `STAND_COPPER`, `mount.ts` `CORE_R`, wire shots, plastic placement, gate, copper atom layers |

---

## 8. Proposed electronics layout and per-view recipes

`E/shared/dive/` (generic kit, copied; ≈ 1 100 lines): `rail-math.ts` ← `world/dive.ts` (COPY) · `camera-rail.ts` ←
`lamp/parts/rail.ts` (COPY) · `levels.ts` ← `world/levels.ts` (ADAPT ids `stand/part/inside/atoms`) · `flight.ts` ←
`world/flight.ts` (ADAPT: shots injected) · `window.ts` ← `world/window.ts` (ADAPT: axis + radius) · `look.ts` ←
`world/look.ts` (ADAPT) · `border.ts` ← `world/border.ts` (ADAPT tables) · `door.ts` ← `lamp/parts/door.ts` (ADAPT: any part) ·
`lens-keeper.ts` ← `lamp/parts/lens-keeper.ts` · `glide.ts` ← `resistance/parts/glide.ts` · `world.ts` ← `world/index.ts`
(rewrite around `InnerWorld`). Tests: `dive.test.ts`, `levels.test.ts` (synthetic stops).

`E/shared/cut/` (≈ 300 lines): `relief.ts` ← `battery-section.ts` `Relief`, `paint` (ADAPT: TOP table as input) ·
`sleeve.ts` ← `battery-inside.ts` `Outside` + `applyCut/placePlanes` + pick boxes + highlight + island (ADAPT, generic) ·
`wedge.ts` ← `lamp-view.ts` `createCutter` + `capSections` (ADAPT: plane set as a function) · `helix.ts` ← `bulb-close.ts`
`finePath/fineCoilGeometry/lampPathLocal` maths (ADAPT: radius/turns/pitch inputs).

`E/shared/inner/` (≈ 1 700 lines copied + new): `layout.ts` (ADAPT, site generators per material) · `lattice.ts`, `haze.ts`,
`electron-sim.ts`, `electron-rules.ts` (ADAPT lookup), `run.ts`, `lean.ts`, `electrons.ts`, `streaks.ts`, `hits.ts` (ADAPT
type), `joule.ts`, `backdrop.ts`, `look.ts` (inner env/post), `mount.ts` (ADAPT), `shots.ts` (ADAPT), `atom.ts`+`shells.ts`+
`soft-dots.ts` (if one atom is shown), `dielectric.ts` ← `plastic.ts` (ADAPT: polarisation), new `holes.ts` (mirror of the
electron sim drawn with `ORB_STYLES.hole`), new `dopants.ts`.

Floors in electronics (proposal, to confirm): `deep` 0 `stand` (the breadboard) → 1 `part` (lens on the part, camera close-up:
colour bands readable; same scene, lamp `door` style) → 2 `inside` (the part opened where it stands: cutaway/section in the
bench scene, or a larger interior model mounted at a hand-over) → 3 `atoms` (inner world, copper-style, exchanged by a
dissolve at a measured hand-over frame). Journey floors: `resistor/capacitor/led/transistor/mosfet` = `inside`, `diode` =
`atoms`, `*-pick/kinds/sensors/smd` = `part`.

**Resistor (carbon/metal film, spiral cut).** Part: body model with bands from the value (data → band colours; legibility on
phones → HUD callout fallback like `battery.printShown`). Inside: lacquer opened by `wedge.ts` or a sleeve; ceramic rod;
film as a thin shell; the **helical groove** from `helix.ts` (turns as data — more turns = longer, narrower film path = higher
R); current path marker along the spiral (lamp `path-marker` idea). Atoms: film lattice (metal film: FCC with NiCr impurity
tint; carbon: disordered sites) + electron sim with `field/restart` + `hits` + `trembleHeat(power)` — the `resistance/bumps`
demo; four-stage "surface → dots → balls" transition after `core-shader.ts` (new shader, same staging).

**Capacitor (plates, dielectric).** Part: ceramic disc / film box / electrolytic can with minus stripe. Inside: section relief
(`relief.ts`) — two plates + dielectric (ceramic), wound foil/film stack (film; helix/spiral roll from `helix.ts`), foil +
oxide + electrolyte paper (electrolytic). Atoms: two metal slabs with free electrons using `sim.surface = +k` on one and `−k` on
the other (surplus crowded under the surface / lack band; `electron-sim.ts:66-70`) + `leanX` while charging; dielectric =
`dielectric.ts` (bound electrons on threads, shifted by the field) — charge stored without crossing.

**p–n junction (diode, LED).** Nothing in circuit. New silicon sheet on the copied lattice (square projection), dopant atoms as
fixed ions (`ORB_STYLES.ion`, colour per side), free electrons (copied sim) on n, holes (`ORB_STYLES.hole`, mirrored sim) on
p, depletion zone without mobile carriers, built-in field arrows (`createVectorArrow`), recombination flash (`createFlash`)
— LED adds a photon of the band colour. Reference: `electricity/.../pn-block.ts`, `si-sheet.ts`, `dopants.ts`.

**Transistor layers.** BJT: three regions (n-p-n) = two junction sheets sharing the thin base; base current lets electrons
cross (`flow` share driven by the model's currents). MOSFET: reference `electricity/.../dev-solar-mosfet.ts createMosfet`
(substrate, two n⁺ pockets, oxide, gate channel). Inside floor: the package opened by `wedge.ts`, die on the lead frame, bond
wires (`G.roundPath` like the lamp's leads).

Copy closure warnings: `world/index.ts` drags the whole circuit stage (`shared/stage/*.ts` + `tools/*.ts` ≈ 7 860 lines) —
do not copy it, rewrite; `copper.ts`
drags core/plastic/gate/lens-rim/atom — copy the orchestrator only as a template; `hits.ts` drags the `Copper` type;
`tools/lens.ts` drags `stage/layout.ts` (`LENS`) and `stage/materials.ts` (`sheath`); `flight.ts` drags `STAGE_SHOTS`
(one constant); `window.ts` drags `LENS` + `LensModel`.

---

## 9. Gotchas

1. **Volume boundary** (`app/eslint-rules/chapter-boundary.js:119-160`, rule on all `src/**/*.ts`): any import of `@circuit/*`,
   `@radio/*`, `@electricity/*` from `E/**` fails — *type-only imports too* (the visitor checks every `ImportDeclaration`).
   Copy into `E/shared/**` and record in `docs/volumes/electronics/REUSE.md` (does not exist yet; `docs/volumes/electronics/`
   does not exist yet). Aliases come from directories (`app/vite.config.ts:12,49`); `@electronics/*` is already in
   `app/tsconfig.json` paths.
2. **Chapter boundary**: chapter files may import only their own chapter, the platform and `@electronics/{sim,content,shared}/**`;
   `_dev` sandboxes may import only `@electronics/shared/**` (sim through shared).
3. **Determinism**: in `src/volumes/*/chapters/**` lint bans `Date.now`, `performance.now`, `window.setTimeout`, `Math.random`
   (`app/eslint.config.js:54-60`); `setInterval` is banned everywhere in `src/**` (:29-32). `shared/**` is *not* linted for the
   first four — keep it clean anyway: copper uses `ctx.random.fork('…')` and the engine's `dt/t`; `E/sim/**` has its own purity
   test that reads file texts. Timers → `ctx.tweens.delay`, counters in `update(dt)`.
4. **Camera keeps world up** (no `Shot.up`): any inner world mounted tilted (the hand-over looks 41° down) rolls on sideways
   orbit — `copperShots` narrows azimuth to ±0.03 and drift to 0.4 when tilted (`copper/shots.ts:59-71`); never turn an inner
   shot sideways, only raise it.
5. **Env ownership**: the stand's light rig re-applies the environment whenever it differs from its own values; below the stand
   it must `yieldEnv(true)` or it takes the lower floor back every frame (`world/look.ts:29-39`, docs/requests/W2 §5b).
   `env.setScale` belongs to the stand when both exist; the inner world passes only `post` with world-unit params × mount scale
   (`copper/look.ts:56-68`, README:56-58).
6. **Every step entry resets env and post**: the world re-asserts its look after `enterStep` (`index.ts:288`); steps below the
   stand must not give `envTune`/`post`, must not call `stand.update`/`copper.update`/`ctx.env.tune`/`setScale` (README:21-22).
7. **Order inside `enterStep`**: `world.enterStep` first; a step that wants its *own* move must start it on its **first
   `update`** (the world has already planned a flight on entry) — `resistance/steps/01-bumps.ts:104,132-139`,
   `02-heat.ts:111,118-122`. `world.lensPose` may be set after `enterStep` (`poseSnap` lands it next frame, `index.ts:285`).
8. **Rail engagement**: never `camera.go(...)` with a duration while the rail is engaged — `release()` first; engaging carries
   the on-screen offset and fades it (never cuts). `flight.atLens()` compares to a fixed `LENS_SHOT` (`flight.ts:21,93`) — in
   a copy it must be the current part's lens shot or the lens leg replays.
9. **Dissolve colour match**: the hand-over frame must look identical in both worlds or the dissolve shows a jump (known in
   circuit: brighter orange copper core vs stand core, README:68-70; fixed by measuring `STAND_COPPER` in the *composed* world,
   not in a sandbox — `copper/core.ts:27-37`, `qa/W2-circuit-copper/profile.sh`).
10. **Stencil window**: `clip(world, on)` changes the stencil flags of the materials present *at that moment* — meshes added to
    the inner world later are not clipped until `clip` is called again; renderOrders are offset, not flattened (flattening let
    the dome cover the picture, `window.ts:113-115`); the window closes at once for the dive (`closeSeconds 0`), and is never
    open during the dissolve (`index.ts:328`).
11. **Clipping/cutaway**: planes installed only while `cut > 0.001` (shader recompiles on toggle — `needsUpdate`); world planes
    refreshed from the group's matrix every frame (`lamp-view.ts:250-254`, `battery-inside.ts:251-263`); the battery's sleeve
    fades by **alpha** — the dithered fade left a stipple at mid-cut (`battery.ts:156-159`); no shadows on a cut face (the
    unclipped outside would shade it, `battery-inside.ts:169`); point light kept in the scene at intensity 0 to avoid recompiles.
12. **Text in code**: `battery-section.ts:18-26` holds Ukrainian layer names in code — the electronics rule forbids any
    Ukrainian word in scene code; names go to the chapter docs → `content/generated/*.json` → `caption(step, i)` /
    tooltips. Captions are addressed by position; a manifest test pins them (`resistance/__tests__/manifest.test.ts:19-33`).
13. **Phones**: prints under 14 px are not drawn in 3D (battery print, crawl numbers, frame number) — label them in the HUD at an
    anchor (`stage/index.ts:195-204`, `resistance/stand.ts:160-161`). Resistor colour bands need the same fallback. `fit` on
    every shot drives phone re-framing; the rail carries `fit` along stops (`lamp/parts/rail.ts:58-72`) — the world's rail sets
    `fit` radius `dist × 0.24` (`dive.ts:118`).
14. **Screen-space `Text3D`** inside a scaled inner world must be counter-scaled (copper README:59-60, `gate.ts`).
15. **Reduced motion**: flights are shortened by `REDUCED_MOTION.camera` (`flight.ts:78-79,150`); VISUAL §3 wants 0.6 s.
16. **Floor ids differ**: electronics axis ids are `atoms/inside/part/stand` (`E/volume.json` axis) vs circuit
    `atom/rows/part/stand`; electronics floors have no `plain`/`namedAt` — `floorLabel` will always show the label.
    `setWhereBase` key is `${volume}/${chapter}` and must be cleared on dispose (`index.ts:167-168`).
17. **Stale doc**: `C/shared/stage/README.md:226-227` says the lens window is "not built" — it is (`world/window.ts`).
    `params.ts` still registers deprecated `snail/ruler/spark/race` (stage/index.ts:68-76) — drop in the copy.
18. **QA**: screenshots are not bit-exact; tests compare numbers exposed via `ctx.qa.expose` and positions via `ctx.qa.probe`
    (`resistance/scene.ts:58-75`); chapter interaction QA is `qa/interactions.mjs` with a frozen clock; `tools/qa/*` need
    `--out <dir>`. Pure-function unit tests for geometry/rails (`stage/__tests__/bulb-close.test.ts`, `world/__tests__/*`),
    seeded `new Rng(n)` for sims (`copper/__tests__/*`).
19. **Performance budget** (copper README:123-127): ≤ 4 ms/frame at 1080p, ≤ 46 draw calls, 812 instanced atoms, 76 electrons;
    one inner world per lens — three lenses at once were never built (`world/README.md:74-75`). Mount inner worlds lazily per
    part kind or share one with swappable layouts.
20. **VISUAL rules carried over** (`docs/volumes/circuit/VISUAL.md` §3, §6): the lens is the only door and all doors start on the
    stand; no cut anywhere — up and down only by continuous motion; between chapters back to the stand plan (2–3 s); the rim
    stays as thin cyan arcs in the corners below the stand; state is passed down as light (closed = warm from above, drift);
    12–20 electrons in focus, never more than 20; no orbit rings; atoms without marks unless a step introduces signs.

---

## 10. Open questions

1. **Where are the two exchanges?** Is `part` an in-scene close-up (lamp `door` style, `deep` 0) and `inside` an in-scene cutaway
   of the stand's own model (battery/lamp style), with only `atoms` a separate world (copper style)? Or does `inside` need a
   larger interior model mounted at its own hand-over (parts on a breadboard are small; a 6 mm resistor's film is microns)?
2. **One `deep` axis for all chapters, or a door per part kind?** The circuit world hard-wires one door (the near wire); electronics
   has many parts at arbitrary sockets. Proposal: the bench's dive takes `part` (socket id) and builds the stops from it.
3. **Lens over any socket**: dragged freely over the board with detents on parts (`resistance/parts/lens-track.ts` on a grid), or
   only on fixed demo places?
4. **Carbon vs metal film**: `ResistorSpec` (`E/sim/core/parts.ts:39-48`) has no material or trim depth; is the film kind and
   the number of spiral turns data (per value) or fixed per chapter?
5. **Copy from `electricity`?** The REUSE rule names `circuit` and `radio`; the only existing p–n / Si / MOSFET pictures are in
   `electricity/chapters/matter/parts/**`. Copy (and record) or rewrite in the circuit look?
6. **Atoms of the film through the lens window or by flight?** Lamp `story` uses the window on the stand; resistance `bumps` flies.
   Which does `resistor` want (journey floor `inside`, not `atoms`)?
7. **Border frame of electronics**: what is fixed on every chapter border (board empty? battery switched off? player stopped?
   lens home?) — needed to re-author `BORDERS/BorderState`; does `E/volume.json` get `seamless`?
8. **Floor ladder on `part`**: report `part` while the camera is at a part close-up (lamp precedent) — and `inside` while a cutaway
   is open even if `deep` stays 0?
9. **Holes**: a mirrored copy of `electron-sim` (positive carriers, opposite drift) or a `sign` per particle in one sim?
10. **Thermal loupe** (`bulb-thermal.ts`) for "parts warm up" — wanted in E2, or warmth shown only as colour/glow on the part?
11. **Single-atom view** (`atom.ts`) needed at all? `diode` is on floor `atoms`; Si (2·8·4) and dopant P/B atoms would need
    parametric layers.
