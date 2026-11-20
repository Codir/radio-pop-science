# Recon E2 · drag-and-snap in `circuit/chapters/build` → the electronics breadboard

Snapshot: `main` at `2707887`. Read-only recon. Paths are relative to `app/src/` unless they start with `docs/`,
`tools/` or `.superpowers/`. "L" = line numbers. Sizes are `wc -l`.

Verdict legend: **COPY** as is · **COPY+ADAPT** (what to change is stated) · **USE** the platform API directly ·
**REF** read for the pattern, write fresh · **SKIP**.

---

## 0. TL;DR

- Grabbing is plain `ctx.input.register(hitMesh, { dragStart, drag, dragEnd, enabled, hover, tooltip })`
  (`engine/input.ts` L60-85, L119). There is no platform drag/snap helper. Every chapter projects the pick ray onto
  a plane with `DragInfo.planePoint(normal, through, out)` (L57, impl L458-459) and does its own snapping.
- `build` snaps **during the drag**: each `drag` event converts the hit to board frame and, if a clamp's mouth is
  within `SNAP = 0.34` board units (`parts/hands.ts` L17, L53-67, L109-115), the end is plugged right then and the
  rest of the gesture is ignored. Let go elsewhere and it lies where it is (L117-124).
- Topology is a pure union–find over 6 clamps (`parts/circuit.ts` L43-63). `bench.update` recomputes the verdict
  every frame from `wiring.state()`, which reads each end's **`seated`** clamp (set only when the travel has
  *arrived*, `parts/ends.ts` L108), and turns it into the stage param `closed` (`bench.ts` L76-78, L118-122).
- The shelf/swap are not a part tray: `shelf.ts` is a dead battery from the `drain` border, `swap.ts` animates one
  broken wire leaving and a whole one arriving. Neither generalises directly; the parts tray is new work.
- Warm/burnt display: `parts/thermal-warm.ts` draws false-colour twins of chosen meshes, **only inside the
  magnifier ring while the heat view is on**. It has no `circuit` imports. COPY+ADAPT it if the volume keeps the
  "heat lens" idea; on-part warmth with no lens is a new decision.
- Goals: each step exposes `ui.goal: () => reached(id)`. Code calls `reach(id)` when a condition holds (in an event
  callback or held for N seconds counted with `dt`). The HUD shows «Висновок» when the goal is true.
- QA: `qa/interactions.mjs` + `qa/helpers.mjs` run Playwright on the frozen engine clock. Scene points come from
  `ctx.qa.probe` and are read with `window.__app.locate(name)`. Drags are `pointer(page, touch).path([a, mid, b])`,
  and every move advances one engine frame. State is read through `ctx.qa.expose` (`__app.read`). Per-frame
  continuity is checked with `strides()`.
- How this generalises (§5): a pure board model (rows of sockets → `Netlist`) placed in `sim/board/` or
  `shared/bench/`; a `Leg` class (a generalised `End`); generic `Hands` that snap leg by leg to the nearest free
  socket within reach of the legs already seated; a tray that spawns part instances; multimeter probes as `Leg`s
  that snap to *any* socket (one row = one node). Sockets are never input targets: snapping is maths, not
  picking.

---

## 1. Platform APIs (USE directly; read-only dirs)

### 1.1 `engine/input.ts` (757 L), reached only through `@/engine/api` (chapters must not import `@/engine/*`)

```ts
// L23-42
interface PointerInfo { pointerId; pointerType: 'mouse'|'touch'|'pen'; x; y /*CSS px*/; ndc: Vector2;
  ray: Ray /*world*/; point: Vector3|null /*hit on object*/; object: Object3D; layer; shiftKey; ctrlKey; altKey }
// L44-58
interface DragInfo extends PointerInfo { dx; dy; totalX; totalY; startPoint: Vector3|null;
  planePoint(normal: Vector3, through: Vector3, out?: Vector3): Vector3|null }   // ray ∩ plane
// L60-85
interface InteractionHandlers { cursor?; tooltip?: string|(()=>string); hover?(over, e); press?(e); release?(e);
  click?(e); dragStart?(e: DragInfo); drag?(e: DragInfo); dragEnd?(e: DragInfo); wheel?(dy, e): boolean|void;
  enabled?(): boolean; dragOwner?(e:{dx,dy,pointerType}): Object3D|null|void }
// L119 (ScopedInput) — ctx.input
register(object: Object3D, handlers: InteractionHandlers, layer?: 'world'|'hud'): Unsubscribe
```

Behaviour that matters for a breadboard:
- **Picking** (L381-416): HUD layer first, then the world. Only entries whose `enabled()` is true and whose object
  and all ancestors are `visible` are candidates. `raycaster.intersectObjects(roots, true)`: the **whole subtree**
  of a registered object can be picked, and the nearest hit wins. A mesh with `MeshBasicMaterial({visible:false})`
  can still be picked, because only `Object3D.visible` is tested. `build` relies on this for its invisible hit
  spheres (`grips.ts` L39-40, `switch.ts` L37).
- **Touch slop** (L211, L384-390): when the exact point hits nothing, rings of 10 and 22 CSS px are tried
  (world layer only).
- **Hover refresh** (L342-356): while no pointer is down and *any* entries exist, the scene is re-picked every frame.
  `enabled()` of every entry runs on each pick, so keep it cheap and keep the number of registered roots small.
- **Thresholds** (L202-204): a drag starts after 4 px (mouse) or 9 px (touch). `dragStart` fires on the **first move
  past the threshold** (L602-606), not on press. `press` fires on down (L562).
- Once a drag has started, `drag`/`dragEnd` go to the pressed entry **without re-checking `enabled()`** (L600-607,
  L643). The handler must ignore events itself, as `hands.ts` does with `held !== key`.
- A press on a world entry *without* drag handlers orbits the camera when moved (L608-611). A press on empty space
  orbits too.
- `click` = no drag happened, no long press, released over the same entry. For touch it also must not have moved
  (L648-651).
- Long press (touch/pen) of 480 ms shows the tooltip and suppresses the click (L206, L485-503).
- Only the first pointer picks (L538). A second finger means pinch/orbit (L590-598).
- Teardown: the chapter's scoped input removes every registration on dispose (L321-339).

### 1.2 `engine/qa-probes.ts` (118 L), `ctx.qa`

```ts
probe(name: string, target: Object3D | Vector3 | (() => Object3D|Vector3|null), opts?: { origin?: boolean }): () => void
expose(name: string, fn: () => unknown /* JSON-able */): () => void
```
An Object3D probe resolves to the centre of its **world bounding box** (L87-95, `Box3.setFromObject(t, true)`).
That box includes invisible hit spheres. `build` therefore probes the grip mesh (`g.grip`), not its holder that
contains the hit sphere (`hands.ts` L126). Use a getter that returns a `Vector3` for exact points such as a
socket mouth (`hands.ts` L128-132).

### 1.3 `engine/debug/api.ts` (314 L), `window.__app` for QA

`goto(chapter, stepId?, {instant?})` L41 · `pause()` L47 · `step(dt=1/60, frames)` L50 ·
`locate(name) → {x,y,visible,shown,world}` L93 · `read(name)` L97 · `position()` L75 · `errors()` L80 ·
`project(x,y,z)` L87.

### 1.4 Others used by `build`

- `damp(value, target, rate, dt)` from `@/engine/api` (`switch.ts` L59).
- `@/kit` `G.capsule(r, len, seg)` (`kit/core/geo.ts` L308). Also useful: `G.tube` L428, `G.catenary` L357,
  `G.pathAt` L390, `G.rod` L514.
- `@/style` `K.toon({color, emissive, emissiveIntensity, gloss, keepHue})` (`style/materials/index.ts` L22-32,
  params `style/materials/toon.ts` L62-98, `fade` getter/setter L418-421), `K.glow({color, intensity})`, and
  `col(token)`.
- `@/hud` `stepUi(ctx)`. Step UI `controls` may include `{ type: 'readout', id, label, unit?, digits?,
  format?, get?: () => number, text?: () => string, color? }` (`hud/step-ui-types.ts` L68-80). This is the
  multimeter number in the HUD.
- `ChapterContext` (`engine/chapter.ts` L187-245): `root, camera, stage, input, tweens, clock, random (seeded Rng),
  viewport, device (formFactor), gesture: Promise<void>, onDispose, qa`. Note that `gesture` is on **ctx**, not on
  `ctx.input` (the spec §6.3 says `ctx.input.gesture`).

---

## 2. File-by-file map of `volumes/circuit/chapters/build/**`

### 2.1 Chapter skeleton

| File | L | What / exports | Imports (what a copy drags along) | Verdict |
|---|---|---|---|---|
| `index.ts` | 18 | `defineChapter({ id:'build', order, group:'practicum', ...manifestText(meta), axisValue, theme, load: () => import('./scene') })` | `@/content` `manifestText`; `@/engine/api`; `../../content/generated/build.manifest.json` | COPY+ADAPT (id, group, theme, generated manifest path) |
| `content.ts` | 17 | `default = defineContent(raw)`; `caption(step, i): string`, which throws when the label is missing | `@/content`; `../../content/generated/build.json` | COPY+ADAPT (json path) |
| `chapter.ts` | 52 | `STEP_IDS`, `StepId`; `interface Chapter { ctx; ui: StepUiApi<StepId>; bench; lens; magnifier; reached(s); reach(s); here(s) }`; `interface StepModule { spec; ui; lensInput?; enter?(info); leave?(); update?(dt,t); late?(dt,t) }`; `type StepFactory = (c: Chapter) => StepModule`; `sessionGoals` (a module-level `Set`, so goals survive a scene rebuild) | `@/engine/api`, `@/hud` types; local types | COPY+ADAPT (it is the contract between steps; swap `bench/lens/magnifier` for the electronics bench) |
| `scene.ts` | 133 | `defineScene(ctx => …)`: builds the bench → step modules → `world.define` + `ui.define`; registers the lens **once** and routes its handlers to the current step's `lensInput` (L53-66); `qa.expose('motion')` with every travelling number (L78-92) and `qa.expose('build')` (L93-101); `enterStep` snaps on `info.instant` (L105-112); `leaveChapter` restores the stand for the border (L113-122); **update order**: step.update → bench.update → world.update → every step's `late` → bench.late → lens.late → magnifier.update (L123-131) | everything local; `@/engine/api`, `@/hud` | COPY+ADAPT (pattern; drop lens/magnifier/border specifics) |
| `bench.ts` | 133 | `AMBIENT`; `interface Bench { ctx; world; stage; wiring; sw; hands; swap; restore(sec, hop?); readonly verdict; powered; lit; switchLive; follow; ambient; shelf; snap(); update(); late() }`; `createBench(ctx)`. The rule: `now = verdict(wiring.state(sw.closed)); if (follow) power(now==='lit')` → `ctx.stage.setParam('closed', 0/1, {instant:true})` (L76-78, L114-121). `late` drives the shapes (wiring.update, sw.place, swap, shelf) after the world (L123-130) | `@circuit/shared/stage` (`BATTERY_SHOTS, LAMP_SHOTS, CircuitStage`), `@circuit/shared/world` (`mountWorld`, `CircuitWorld`): the **whole circuit stand** | REF (the pattern "model verdict → stage param each frame, `follow` flag lets a step hold power" carries over; the code does not) |

### 2.2 Pure model

| File | L | Exports | Imports | Verdict |
|---|---|---|---|---|
| `parts/circuit.ts` | 100 | `CLAMP_IDS` (6), `ClampId`, `WIRE_KEYS` (a,b,c), `CLAMP_CAPACITY = 2`; `EndState {clamp: ClampId\|null; contact: boolean}`; `WireState {ends: [EndState,EndState]; whole}`; `CircuitState {wires; switchClosed}`; `Verdict = 'lit'\|'open'\|'short'`; `nets(state): Record<ClampId, number>` (union–find, L43-56: a wire joins its two clamps only if `whole && both clamped && both contact`; closed switch joins swIn–swOut); `verdict(state)` (L58-63: poles in one net → short; lamp clamps one in each pole's net → lit); `switchControls(state)` (L69-74: lit when closed **and** open when open); `occupancy(state)`, used only by tests (L77-81); `HOME`, `homeState(closed)` | none (pure) | REF. The electronics model already has union–find + `analyse()` (`electronics/sim/core/topology.ts` L28-90) and a full MNA. What carries over is the *shape*: a pure "board state → circuit" function, unit-tested, with a `homeState`-like fixture builder |

### 2.3 Hand, ends, grips, snapping

| File | L | Exports / signatures | Imports | Verdict |
|---|---|---|---|---|
| `parts/clamps.ts` | 95 | `interface Clamp {id; mouth: Vector3; out: Vector3}`; `CLAMPS: Record<ClampId, Clamp>` (L21-40, board frame, mouth set `INSET=0.07` into the terminal); `LYING = WIRE.sheath + 0.004`; `ground(x, z): number`, a height field over raised rounded boxes with a smoothstep shoulder (`RAISED` L49-55, `SHOULDER = 0.18`, L62-72); `AREA {x0,x1,z0,z1}` where a loose end may lie (L75); `REST`/`REST_OUT`, where each end lies once out (L78-95) | `three`; `@circuit/shared/stage` (`BATTERY, LAMP, LOOP, SWITCH, WIRE`) | COPY+ADAPT → `shared/bench/sockets.ts`: replace `CLAMPS` with a generated socket grid; keep `ground()` but take `RAISED` as data (parts already on the board are raised ground for a lead draped over them); `AREA` becomes the board-plus-tray bounds |
| `parts/ends.ts` | 148 | `EndKey`, `END_KEYS`; `type Place = {kind:'clamp'; clamp; slot; shared} \| {kind:'lie'; at; out} \| {kind:'hand'; at}` (L21-24); `class End implements EndPose { key; wire; index; pos; out; place; contact; seated: ClampId\|null; get clamp(); get held(); get moving(); go(place, seconds, lift=0.4, hop=false); carry(at); snap(); update(dt, anchor) }`. `go` (L73-84) starts an eased travel from the **shown** pose with a sine lift capped at `way*0.32` (`hop` = full lift). `update` (L100-119): smoothstep, `pos.y += lift*sin(πe)`, and `out` turns by the shortest angle so it never lerps through zero (L112-118). `seated` becomes the clamp **only on arrival** (L108, also `snap` L93); leaving a clamp clears it at once (L74). `resolve` (L121-147): clamp → mouth plus a side offset when shared; lie → `ground()`; hand → `max(ground, LYING) + CARRY 0.2`, with `out` pointing at the wire's body (`anchor`) | `three`; `./circuit` types; `./clamps` (`CLAMPS, LYING, ground`); `./curves` type | **COPY+ADAPT → `Leg`** (the core primitive). Change: `Place` kinds `socket {socket}` / `lie {at,out}` / `hand {at}` / `tray {slot}`; resolve against the socket table and the tray; drop `slot/shared` (capacity 1); keep `seated`, the travel maths and the angle turn |
| `parts/curves.ts` | 145 | `interface EndPose {pos; out}`; `interface Lay {length?; side?}`; `hermite(a, b, out, n=72, lay={}): Vector3[]` (L36-78: tangents scale with the wire length, not the chord; slack bows sideways `bow`; the middle sinks to `LYING` within 0.34 and drapes over `ground()`); `lengths(pts)`; `pointAt(pts, acc, d, p, t)`; `peeled(route, acc, end, peel, out)` (a tail from a free end into a held route); `blend(a, b, k, n, out)` | `three`; `@circuit/shared/stage/dyn-tube` (`resample`, 17 pure lines L12-28); `./clamps` (`LYING, ground`) | **COPY+ADAPT**: copy `resample` next to it (pure). Inject `ground`/`LYING` as parameters (or one `Terrain` object) instead of importing `clamps`. Use it for bendy legs (body → socket), the probe leads and the battery/speaker leads |
| `parts/glide.ts` | 61 | `interface Glide {readonly value; target; moving; go(to, seconds); set(v); update(dt): number}`; `glide(initial=0)`: smoothstep travel that starts from the shown value when retargeted mid-way | none | **COPY as is** (identical copies already exist in `flow/parts` and `resistance/parts`) |
| `parts/grips.ts` | 95 | `interface Grip {holder: Group; grip: Mesh; hit: Mesh; material: KToonMaterial; shown: Glide; call: number; hover: boolean}`; `interface Grips {of; place(key, pts, fromEnd); snap(); update(dt, t)}`; `createGrips(stage, ends)`. The grip is a cyan capsule `G.capsule(0.1, 0.34, 20)` with an invisible `SphereGeometry(0.3)` hit (L38-59) under a holder parented to **`stage.base.frame`** (board frame). `place` walks `BEHIND = 0.3` along the polyline from the tip and orients the capsule along it (L66-81). `update` scales by `s*(2-s)` and sets emissive `0.18 + call*(0.25+0.12 sin 2.4t) + hover 0.3` (L85-92) | `three`; `@/kit` `G`; `@/style` `K`; `CircuitStage` type; `./glide`; `./ends` types | **COPY+ADAPT**: parent `Group` as a parameter; a generic key type; one grip per leg (and per probe tip); hit radius ≥ 0.3 board units on phones; `place` from the leg polyline |
| `parts/hands.ts` | 134 | `SNAP = 0.34` (L17), `AWAY = 0.5` (L19); `interface HandPolicy { take(key): boolean; plug(key, clamp): boolean; plugged?(key, clamp); dropped?(key); tooltip?(key) }` (L21-28); `interface Hands { policy: HandPolicy\|null; readonly held; readonly near }` (L30-36); `createHands(ctx, world, stage, wiring)`. **Grab** (L79-89): `ctx.input.register(g.hit, {cursor:'grab', enabled: live(key) && shown>0.9 && (held===null \|\| held===key), dragStart: held=key; left=end.clamp; wiring.take(key)})`. **Drag** (L90-116): `up` = board normal from `stage.base.frame.getWorldQuaternion` (L92); plane through `boardToWorld(0, LYING+0.2, 0)` (L93); `e.planePoint(up, through, hit)` → `worldToBoard` → clamp to `AREA` → clamp to the wire's **reach** from its seated other end (L99-106) → `wiring.carry(key, p)` → `left` is forgotten after moving `AWAY` from the clamp it left (L108) → `nearest()` (L53-67: closest mouth by board-xz distance `< SNAP`, skipping `left`, skipping clamps at capacity, asking `policy.plug`) → on a hit: `held=null; wiring.plug(key, c); policy.plugged?.()` **mid-drag** (L109-115). **Drop** (L117-124): `wiring.lay(key, 0.3, e.pos, e.out)`, lie where shown. Probes `end-<key>` = the grip mesh; `clamp-<id>` = mouth getter (L126-132). Note `near` is **dead**: only ever assigned `null` (L46, L113) and read by nobody | `three`; `@/engine/api`; `@circuit/shared/stage` (`boardToWorld, worldToBoard, CircuitStage`); `@circuit/shared/world` type (`world.flying`); `./circuit`, `./clamps`, `./ends`, `./wiring` | **COPY+ADAPT → generic `createHands`** (§5.3). Keep: snap during the drag, the `left`/`AWAY` hysteresis, capacity, the policy object, reach clamping, lie on drop. Change: the plane from `frame` (use `frame.worldToLocal` instead of the copied tilt maths); candidates = sockets; reach = the other legs' seated sockets; implement a real `near` for the cue |
| `parts/wiring.ts` | 303 | `LENGTH = {p1:1.15, p2:3.6}`, `TAUT 1.1`, `REACH 2.9`; `interface Wiring { ends; grips; active; whole; bare; state(sw); count(clamp); plug(key, clamp, sec=0.22); lay(key, sec=0.9, at?, out?); take(key); carry(key, at); home(sec, hop?); hop(key, clamp, sec, shared?); lift; loose(sec); reach(key); readonly moving; snap(); update(dt,t) }` (L28-63). `state()` reads `ends[k].seated` (L117-124). `plug` picks slot 0/1 by count and reseats both ends of a shared clamp (L101-110, L126-132). `follow()`: a carried end drags a loose other end once the wire is taut (L218-237). `shape()` writes the stand's tube pieces each frame via `stage.stand.wires.setShape` (L268-291), blending the free Hermite with the stand route by a per-wire `settle` glide | `@circuit/shared/stage/wires` (`BARE, standPath, WireId`), `dyn-tube` (`resample`), `@circuit/shared/stage` (`LOOP, SEAT, CircuitStage`) plus all local parts | **REF**. It is welded to the stand's three tube pieces and their routes. Take: reseat-on-capacity, `follow`/taut (useful for a 2-leg part carried by one leg), `reach`, `moving`, `snap()`/`update()` |

### 2.4 Switch, shelf, swap, warmth, lens

| File | L | Exports | Imports | Verdict |
|---|---|---|---|---|
| `parts/switch.ts` | 78 | `interface SwitchPart { closed; readonly flips; readonly open; onFlip; reset(); snap(); place(dt, unfolded) }`; `switchPart(ctx, world, label, live)`. An invisible `SphereGeometry(0.36)` hit added **as a child of the slider** (L37-39); `click` flips `closed`, counts `flips`, calls `onFlip` (L66-76); `place` damps `open` at rate 22 and moves the slider by `SLIDER_TRAVEL` (L58-64) | `damp`; `@circuit/shared/stage` (`SWITCH`); `small-parts` (`SLIDER_TRAVEL, SLIDER_Y`); world type | COPY+ADAPT for the battery's switch (seat/travel constants from the electronics battery model; drop `world.flying` or replace it with the bench's own flying flag). Its `closed` becomes the `switch` part's `setting` in the netlist |
| `parts/shelf.ts` | 44 | `createShelfBattery(ctx, stage): { update(on: number) }`: a second, discharged battery model eased between `SHELF` and `GONE` | `@circuit/shared/stage` (`BATTERY, SHELF_WORLD, tameAll`), `stage/battery` (`createBattery`) | SKIP (it is the `drain` border prop). REF for "a prop's whole presence = one eased number" |
| `parts/swap.ts` | 95 | `SWAP_SECONDS = 2.4`; `interface Swap { start(); readonly t; running; update(dt); finish() }`; `createSwap(stage, id: WireId, lift: Vector3)`. `start` clones the **current geometry** of the stand's core and sheath into still copies that share materials (renderOrder 960+, so they draw above the magnifier's iris at 950) (L63-80); one `t` 0…1 places everything: 0-0.5 the old copy rises, rolls `-2.2 rad` about its far stretch and drops behind the board; 0.5-1 the stand's own piece comes down by writing `lift` (L43-55); `finish()` snaps to the end | `three`; `@circuit/shared/stage` (`LOOP`), `wires` (`WireId`); `stage.stand.wires.core(id)/sheath(id)` | COPY+ADAPT as "a burnt part goes away, a fresh one comes from the tray": generalise to `createSwap(parent, source: Object3D, path: (u, out) => Vector3)`; snapshot by cloning geometry; keep "one `t`, playable and snappable" |
| `parts/thermal-warm.ts` | 154 | `interface Warmth { shade: number /*0…1 false-colour*/; amount: number /*heat view on*/; readonly count; update() }`; `createWarmth(roots: Object3D[], glass: Mesh, only: RegExp)`. It lazily (on the first `on`) builds **twins** of meshes under `roots` whose names match `only`, skipping invisible pick volumes and meshes without normals (L99-120). Twin = same geometry + one `ShaderMaterial` (ramp `blue→violet→magenta→orange→yellow→white`, `col()` stops; fresnel; `discard` outside the lens ring, `throughLens()` L33-41), renderOrder 4996, no raycast. It reads the source material's `fade` to hide dissolved parts (L143-145) | `three`; `@/style` `col` only | COPY+ADAPT if the heat lens stays: (1) rebuild twins when parts are added or removed (it builds **once**, L140); (2) a uniform toggle to skip the lens test (`uLensR = 0` → draw everywhere) if warmth must show on the board itself; (3) one `Warmth` per part instance with `shade` from the model's power/limit |
| `parts/magnifier.ts` | 267 | `interface Magnifier { amount; power=2.3; readonly focus; update() }`; `createMagnifier(ctx, stage)`. A stencil portal: an iris disc on the glass writes stencil `REF=3` and resets depth (L79-99); a twin of every nearby stand mesh, its world matrix scaled by `power` about the focus, drawn where stencil == REF (L142-205); the stand's own transparent meshes are kept out of the disc (L156-168); the focus = camera ray through the ring centre ∩ the board plane at `LOOP.y` (L232-240) | `@circuit/shared/stage` (`LENS, LOOP, boardToWorld, CircuitStage`; `stage.tools.lens.glass/group`, `stage.base.group`) | Another recon area (loupe). Note: the twin list is built **once** (L229), so parts spawned later from the tray are not magnified unless it is rebuilt |
| `parts/lens-keeper.ts` | 126 | `interface LensKeeper { shown; gliding; hold(pose\|fn); to(pose\|fn, sec=1.2); snap(pose\|fn); call; rim; glass; idle; late(dt,t) }`; `mixPose(a,b,e,lift,out)`; `emptyPose()` | `@circuit/shared/stage` (`CircuitStage, LensPose`; `stand.tools.lens.setPose/setCall/setRim/glass`, `tools.poses.holder`) | Loupe area. REF ("one owner of a tool's pose after the stage update; glides from the shown pose") |
| `parts/loop-track.ts` | 74 | `loopTrack(): { at(s,out); nearest(ndcX, ndcY, aspect, camera); delta(a,b); shareOf(x,z) }`: 480 samples; nearest by projecting each sample to NDC | `@circuit/shared/stage` (`boardToWorld, loopPath`) | SKIP (loop-specific). REF for "drag a tool along a 1-D track by nearest projected sample" |
| `parts/rail.ts` | 150 | `cameraRail(ctx, stops: Shot[], lead?): CameraRail { rail; engaged; position; target; moving; scrub(t); travelTo(t, sec?); snap(t); release(); update(dt) }`: the frame on screen when engaging is kept as a fading offset (`CATCH_UP = 3.2`) | `@circuit/shared/world/dive` (`createDiveRail`) | Camera/dive area; COPY+ADAPT only together with `dive.ts` |

### 2.5 Steps: how goals are checked

| File | L | Interaction | Goal check |
|---|---|---|---|
| `steps/01-first-light.ts` | 135 | `policy {take: here && queue empty; plug: always; plugged: plugged++}` (L32-36). On entry the six ends are queued `[key, delay]` and decremented by `dt` in `update`, which then calls `wiring.lay(k, 1.1)` and grows the grip (L112, L119-126). No timers. Grip `call` 1 until the first plug, then 0.4 on the still-loose ends (L129-132). `info.instant` → `wiring.loose(0)` and the grips set (L104-109) | `sw.onFlip = () => if (!sw.closed && shone && switchControls(wiring.state(true))) reach(...)` (L37-41). `shone` latches `bench.lit` in `update` (L127). The goal is reached **in an event callback** |
| `steps/02-find-fault.ts` | 292 | Phase machine `'arrive'\|'reset'\|'fault'\|'fixing'\|'shine'\|'done'` with a `timer += dt`. Fault 1: an invisible hit sphere at the clamp, `click: fix(1)` (L144-152). Faults 2 and 3: `lensInput.drag` → `track.nearest(e.ndc…)`; `click` fixes when `over(n)`, i.e. the magnifier focus is within `OVER = 0.3` world units of the fault point (L97-98, L154-164). Fault 2's repair is a scripted three-beat sequence driven by `fixT` thresholds `if (fixT >= a && fixT - dt < a)` (L250-272) | `repaired()` → `fixed++`; `if (fixed >= 3) reach(...)` (L124-130) |
| `steps/03-short.ts` | 189 | `policy {take: k==='b1'}` (L83-86). `shorted() = verdict==='short' && b1.seated==='minus'` (L70). `late`: heat is first-order toward 1/0 with τ 1.5/2.6 s; battery `life` drains; the frame's amperes follow the verdict (L156-187); two `createWarmth` (battery, wires) driven by `thermal.value` and `heat` (L57-62, L182-186) | `shortFor = shorted() && sw.closed ? shortFor + dt : 0; if (shortFor >= HOLD 2.5) reach(...)` (L152-153). Goal = **held condition timed with dt** |
| `steps/04-flashlight.ts` | 150 | A DOM slider control `{type:'slider', id:'fold', onChange, onInput(_, how)}` (L62-82), glided to its target with a speed cap (L129-133); `ui.patch('fold', {current})` writes the value back | `atEnd = shown >= 0.999 ? atEnd + dt : 0; if (atEnd >= 1) reach(...)` (L146-147). `panel.closingWhen` shows the volume's closing card |

Common to all four: `ui.goal: () => reached(id)` (the HUD polls it); `enter(info)` re-derives the whole state
(`info.instant` = deep link → snap everything; `info.from === null` = the chapter is opening); `leave()` clears
calls and policies; `ctx.qa.expose('<step>', …)` gives each step's numbers to QA.

### 2.6 Tests and QA

| File | L | What | Verdict |
|---|---|---|---|
| `__tests__/circuit.test.ts` | 96 | vitest; a `wired(map, closed)` helper builds a `CircuitState` from `{a:[clamp\|null, clamp\|null], …}`; 11 cases: home, loose, polarity, no-switch, shorts, each fault | REF: write `seated(parts)` → `netlistOf()` tests the same way (hand-written boards → expected nodes, issues) |
| `__tests__/manifest.test.ts` | 52 | `STEP_IDS` equal the generated content's step ids; `caption(step, i)` text per index (it fails first when the script reorders «Підписи»); pure helpers exported from steps (`amps`, `cameraAt`, `moonAt`) are unit-tested | COPY+ADAPT for every electronics chapter |
| `qa/helpers.mjs` | 200 | `advance(page, s)` = `__app.step(1/60, s*60)` + 10 single frames; `locate(page, id)` (DOM control rect via `__ui.locate('ctl-<id>')`); `read`; `at(page, probe)`; `click`, `slide`, `scrub`, `thumbAt`, `clickTrack` (sliders); `clickProbe`; `dragFrom(page, p, fx, fy)`; `shown(page, sel)`; `press(page, sel)`; **`pointer(page, isTouch)`** → `{down, move, up, tap, path(points, steps=8)}`: mouse through `page.mouse`, touch through CDP `Input.dispatchTouchEvent`; **every move is followed by one engine frame** (L125-174); `strides(page, reader, seconds)`: largest per-frame change of every numeric/array field of an exposed reader (L180-200) | **COPY as is** into each electronics chapter's `qa/` (the same relative depth to `tools/qa/lib.mjs`: 7 × `../`) |
| `qa/interactions.mjs` | 282 | CLI `--port --size WxH --touch --out`; `launch/openApp/appUrl(base, {route:'circuit/build/first-light', freeze:0})`, then `__app.pause()` (L234-238); `check(what, ok, detail)` → exit code; `BOUND` per motion key (L46); `smooth(seconds)` = `strides('motion')` against `BOUND` (L47-58); `enter(id)` = `__app.goto('build', id)` + smooth + "no takeaway yet" (L59-64); **`carry(fromProbe, toProbe, lift)`** = locate both, a mid point `y + lift*height`, `p.path([a, mid, b], 10)`, `advance(0.35)` (L68-73). Per step: six carries `end-xx → clamp-yy`, then a `p.tap` on the `switch` probe, then the glow and takeaway are checked (L76-110); `find-fault` taps `fault-1`, carries the lens to `fault-2/3` (L111-148); the slider is dragged pixel by pixel and the camera stride sampled (L168-187); recall links; console errors (L263-272) | COPY+ADAPT as the skeleton (args, check, smooth, enter, carry) |

How a drag runs in a real browser: `at(page, 'end-c0')` → `__app.locate` projects the probe through the live
camera to CSS px. `p.path` presses (one frame), moves 10 steps per segment (one frame each), releases (one frame).
Because the scene snaps **during** the drag, the end usually clicks in before the pointer reaches the mouth. The
remaining moves and the `dragEnd` are ignored by `held !== key`. Then `advance(0.35)` lets the 0.22 s plug travel
arrive, so `seated` and the verdict update before `read(page, 'build')`. The bounded `lift` on the mid point
keeps the hand away from other mouths on the way.

---

## 3. Answers to the six questions

**(a) How an end is grabbed.** Each end has a grip holder (capsule plus an invisible sphere r = 0.3) under the
board-frame group (`grips.ts` L38-59). `hands.ts` registers the **hit sphere** with `ctx.input.register(g.hit, …)`
(L79). `enabled` = policy allows, the grip is fully shown, and no other end is held (L82). `dragStart` (the first
move past 4/9 px) sets `held`, remembers the clamp it left in `left`, and calls `wiring.take(key)`. That turns
`End.place` into `{kind:'hand'}` with a 0.12 s travel and reseats whatever stays in the old clamp (`wiring.ts`
L143-147). Each `drag`: `planePoint(boardNormal, point at LYING+0.2 on the board)` → board frame → clamped to the
board area and to the wire's reach → `End.carry(p)`, which writes `place.at` so the end follows without lag.

**(b) How it snaps.** Mid-drag, `nearest(key, x, z)` takes the clamp with the smallest board-xz distance below
`SNAP = 0.34` that is not `left` (until the hand has gone `AWAY = 0.5` from it), is below capacity 2 and is allowed
by `policy.plug` (`hands.ts` L53-67). A hit ends the hold at once: `held = null; wiring.plug(key, c)` (an eased
0.22 s travel into the mouth; a second end in a clamp sits side by side and fans out, `ends.ts` L127-133);
`policy.plugged?.()`. The end counts as in the clamp for the model only once the travel arrives (`End.seated`,
`ends.ts` L108): "the click is the moment of contact". Releasing without a snap → `wiring.lay(key, 0.3, pos, out)`,
it lies there.

**(c) Topology → model.** `wiring.state(sw)` → `{wires: {a,b,c: {ends:[{clamp: seated, contact}, …], whole}},
switchClosed}` (`wiring.ts` L117-124) → `verdict()` = union–find nets → `'lit'|'open'|'short'` (`circuit.ts`
L43-63). `bench.update` runs this **every frame** and sets the stage param `closed` (= "the lamp has power") when it
changes (`bench.ts` L76-78, L118-122). `bench.follow = false` lets a step hold the lamp (resets, the swap). There
are no numbers in the model, except that `03-short` maps the verdict to fixed amperes (0.3 / ≈ 6 A,
`03-short.ts` L172).

**(d) Swap from a shelf.** There is no part tray in `build`. `shelf.ts` = a dead battery prop eased by one number;
`swap.ts` = `find-fault` 3's repair, which snapshots the broken wire's geometry, rolls the copy off behind the board
and drops the stand's own (now whole) piece back in, all as a function of one `t` over 2.4 s
(`swap.ts` L40-55, L63-93). `find-fault` sets `wiring.whole.c = true` once `swap.t >= 0.5` (`02-find-fault.ts`
L275).

**(e) Warm / burnt.** Only in `short`: `createWarmth(roots, lensGlass, nameRegex)` adds false-colour twins of the
battery's (and the wires') outer meshes. They are drawn only inside the lens ring and only while the stage heat view
(`stage.lamp.thermal`) is on. `shade` = `HOT 0.72 * heat` (battery) / `0.14 * heat` (wires), where `heat` is a
first-order lag of "shorted now" (`03-short.ts` L163-186). Nothing burns in `circuit`; there is no burnt state.

**(f) Goals.** See §2.5. Three patterns: an event (`sw.onFlip` + `switchControls`), a counter (`fixed >= 3`), or a
condition held for N seconds (`shortFor += dt`, `atEnd += dt`). Every one ends in `reach(id)`. The HUD polls
`ui.goal`. A goal is remembered for the session (`sessionGoals`).

**(g) QA drags.** See §2.6. Probes on the grips and the mouths, `pointer().path()` with one frame per move on the
frozen clock, then `advance()` and `read()` of the exposed state. Touch runs the same script with `--touch`
through CDP touch events.

---

## 4. What a copy drags along

`build` sits on `circuit/shared/stage` (≈ 6 k lines) and `circuit/shared/world` (≈ 1.3 k). For the breadboard the
needed pieces are small and pure:

| Needed | Source | L | Copy as |
|---|---|---|---|
| `resample(points, n, out)` | `circuit/shared/stage/dyn-tube.ts` | 12-28 | COPY (pure) into `shared/bench/geo.ts` |
| board↔world | `shots.ts` L14-16 `boardToWorld`; `tools/index.ts` L31-39 `worldToBoard`, `worldDirToBoard`; `gauge.ts` has a third private copy | — | **Don't copy**: put the board in its own `frame: Group` and use `frame.localToWorld`/`worldToLocal`, so the tilt and height live in one place. If a fixed tilt is kept, copy the two functions with the electronics `BOARD` constants |
| `DynTube` (a tube whose path changes per frame) | `dyn-tube.ts` L30-122 | ~90 | COPY+ADAPT if legs/leads are tubes; otherwise `G.tube` per change |
| a target cue ring | `circuit/chapters/battery/parts/cue.ts` | 43 | COPY as is (`three`, `damp`, `K.glow`; it faces the camera, eases in/out) |
| a probe on a lead | `circuit/shared/stage/tools/gauge.ts` (`Probe {on, handle, hold(world), pole, tip, rest}`, L20-33) and its drag in `battery/steps/04-voltage.ts` L55-81, L164-181 | 337 / 213 | REF (see §5.5 for the two snap styles) |

Nothing in `glide.ts`, `curves.ts` (after injecting `ground`), `thermal-warm.ts` or `cue.ts` reaches the stand.
Record every copy in `docs/volumes/electronics/REUSE.md` (this file does not exist yet). The format of
`docs/volumes/circuit/REUSE.md` is a verdict table «як є / переробити / нове» with "що саме". The electronics file
needs the "звідки, що змінено" columns the constraints ask for.

---

## 5. Proposal: generalise to a breadboard

### 5.1 Where things live (lint-checked)

- Chapter files may import only their own chapter, `@/…` platform, and **their own volume's `sim/**`,
  `content/**`, `shared/**`** (`eslint-rules/chapter-boundary.js` header L8-13, checks L100-114). A volume-local `audio/` or
  `bench/` at the volume root is **not** importable from chapters. Put everything under `shared/`.
- The `_dev` sandboxes (`_sandbox-electronics-*`) may import only `@electronics/shared/**`
  (`showcase`, L27). Whatever they need from `sim/` must be re-exported through `shared/`.
- `sim/**` must stay pure: the purity test reads file texts, **comments included**, for `Math.random`, `Date.now`,
  `new Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `window.`, `document.`, and
  allows only relative imports inside `sim/` (`sim/core/__tests__/purity.test.ts` L14-60). So no `three` there.

Proposed layout:
```
sim/board/            pure: the board as data + the board → Netlist mapping (unit-tested, oracle-free)
  layout.ts           sockets, rows, rails, fixed terminals (numbers only; xz as [number, number])
  seat.ts             BoardState, placement rules, netlistOf(), readings helpers
shared/bench/         three.js: the stand's board and everything the hand touches
  geo.ts              resample (copy), curves (copy+adapt), ground()
  glide.ts            copy
  leg.ts              Leg (from End)
  grips.ts            copy+adapt
  hands.ts            generic hands (from hands.ts)
  tray.ts             the parts tray: slots, spawning instances
  probes.ts           multimeter probes
  cue.ts              copy of battery/parts/cue.ts
  warm.ts             from thermal-warm.ts
  swap.ts             from swap.ts (burnt part away, fresh from the tray)
  index.ts            re-exports, plus the sim/board API the sandbox needs
```

### 5.2 The board model (pure, `sim/board/`)

```ts
export type SocketId = string;            // e.g. 'r12c' : row 12, column c
export type RowId = string;               // e.g. 'r12L' (a–e half), 'r12R' (f–j half), 'rail+', 'rail-'
export interface SocketSpec { id: SocketId; row: RowId; x: number; z: number }   // board frame, units
export interface BoardLayout {
  sockets: readonly SocketSpec[];
  rows: readonly RowId[];                 // the order fixes the node numbers
  ground: RowId;                          // 'rail-': node 0 (GROUND)
  /** Fixed parts of the stand wired to rows by their own leads: battery+switch, player, speaker, lamp. */
  fixed: readonly { id: string; spec: string; rows: readonly RowId[]; setting?: () => number }[];
}
export interface Placed { id: string; spec: string; legs: (SocketId | null)[]; setting?: number; burnt?: boolean }
export interface BoardState { parts: Record<string, Placed> }

/** Node = row: ground row → 0, the others → 1 + index. Fully seated parts only; a part with a leg out is `pending`. */
export function netlistOf(layout: BoardLayout, state: BoardState):
  { net: Netlist; nodeOfRow: Record<RowId, number>; pending: string[]; key: string };
export function occupant(state: BoardState, socket: SocketId): { part: string; leg: number } | null;
export function rowOf(layout: BoardLayout, socket: SocketId): RowId;
```

- One socket holds one leg (`CLAMP_CAPACITY = 1`). A row holds many: "connected sockets" = same `row`.
- **The node is the row.** This matches `topology.ts`: `floating` = "pins in rows that no other part touches"
  (L13-14, L67-71), and a node no pin uses costs nothing (`netlist.ts` L29).
- A part with one leg out is **left out** of the netlist (`pending`), not given a private node. For 2-leg parts
  the result is the same; for a transistor with a floating base it is "off" either way. The board can say "this
  leg is in the air" from `pending`. (Alternative: a private node per loose leg, so `analyse()` reports `floating`.
  This is an open question.)
- `key` = the sorted `id:spec:legs` string. Recompile (`compile(net)`) only when `key` changes. Pot and switch
  positions are read from `part.setting` at every solve (`mna.ts` L185-192), so write the setting into the same
  `PartInstance` object and call `solveDC(circuit, {state})` again.
- Readings: `sol.v[nodeOfRow[rowOf(socket)]]`; per part `sol.parts[id].{u,i,p}` → warmth `= p / limits.powerW`.
- A burnt part stays on the board, but its instance changes to `spec: 'open'` (or it is removed). That is a model
  decision for E1-4+.
- Tests (pattern of `build/__tests__/circuit.test.ts`): a `seat({R1: ['r3a','r7a'], …})` helper → `netlistOf` →
  assert `nodeOfRow`, `pending`, then `solveDC` numbers for a divider placed on the board.

### 5.3 `Leg`, grips, hands (three.js, `shared/bench/`)

`Leg` = `End` with `Place = {kind:'socket'; socket} | {kind:'lie'; at; out} | {kind:'hand'; at} |
{kind:'tray'; slot}`. Keep `go(place, seconds, lift, hop)`, `carry(at)`, `snap()`, `update(dt, anchor)`, `moving`,
`held`, and **`seated: SocketId | null` set on arrival**. The netlist reads `seated`, so the circuit changes at the
click, as in `build`.

A part instance:
```ts
interface BenchPart {
  id: string; spec: string;
  body: Group;                  // the resistor/LED/transistor model; lies on its legs' midpoint, lifted
  legs: Leg[];                  // 2 or 3
  pitch: number;                // body length between the lead exits (resistor ~ 3–4 sockets; TO-92 = 1)
  reach: number;                // how far a free leg may go from a seated one (bendable lead)
  grips: Grip[];                // one per leg, and one on the body (carry the whole part)
}
```

Generic hands:
```ts
interface HandPolicy<K> {
  take(k: K): boolean;
  plug(k: K, socket: SocketId): boolean;    // e.g. the probe accepts any socket, a leg only free ones
  plugged?(k: K, socket: SocketId): void;
  dropped?(k: K, where: 'board' | 'tray' | 'away'): void;
  tooltip?(k: K): string;
}
interface Hands<K> { policy: HandPolicy<K> | null; readonly held: K | null; readonly near: SocketId | null }
function createHands<K extends string>(ctx, frame: Group, items: {
  keys: readonly K[]; hit(k): Object3D; leg(k): Leg;
  candidates(k, x, z): Iterable<SocketSpec>;           // free sockets, or any socket for a probe
  reach(k): { from: {x,z}; most: number } | null;      // the part's other seated legs
}, opts: { snap: number; away: number; area: Area; flying(): boolean }): Hands<K>
```

Snap step (in `drag`), as in `hands.ts` L90-116:
1. `e.planePoint(boardNormal, boardPointAtCarryHeight, hit)`; `frame.worldToLocal(hit)` → board xz; clamp to the
   area (board + tray).
2. Reach: if another leg of the part is seated, clamp to a circle of `reach` around it (`hands.ts` L99-106).
   Better for 2-leg axial parts: also prefer sockets at the part's **pitch** (`|d − pitch| < tolerance`) so a
   resistor does not end up folded to one socket.
3. `left` hysteresis: the socket a leg just left is not a candidate until the hand moves `AWAY`.
4. Nearest candidate within `SNAP` (board units; ~0.45 × socket pitch so neighbouring sockets do not fight).
   Candidates: no other leg in it (`occupant` null), `policy.plug` allows it. Hit → `held = null`,
   `leg.go({kind:'socket', socket}, 0.18, 0.12)`, `policy.plugged`.
5. **`near`** = the candidate within `SNAP * 1.8` (computed, unlike `build`). Show a cue ring
   (`cue.ts`) on it, and a dim ring on every legal socket while the leg is held (the "where can it go" affordance;
   `04-voltage.ts` L204-209 does the same with `targets`).

Leg by leg, from the tray (one possible flow):
- The tray slot shows a model per kind/value; its hit volume is registered. `dragStart` on a tray item **spawns**
  a `BenchPart` (id from a counter, never `Math.random`) and hands the gesture's *first leg* to the hands. The
  input system keeps sending `drag` to the tray item's registration, so the tray item's handlers forward to
  `hands.dragAt(key, e)`. Export a `drive(key, e)` from hands for this.
- The body hangs from the held leg and turns to trail it (as `End.update(dt, anchor)` trails toward the wire body).
  The other legs follow taut (`wiring.ts` `follow()` L218-237).
- Leg 0 snaps → the next leg's grip calls (`grip.call = 1`); the reader drags it within reach → it snaps. With all
  legs seated the part is in `BoardState` and in the next netlist.
- Taking a seated leg out: the same as `build` (drag its grip; `left` hysteresis). Releasing a whole part over the
  tray (or off the board) → back to the tray (`dropped(k, 'tray')`), the part is removed.
- Alternative "whole part at once": carry by the body, and on release snap **all** legs to the nearest
  socket set at the right pitch (this also suits TO-92 transistors: three adjacent sockets). It is simpler for a
  lay reader and for touch. This is an open question.

Grips: one cyan capsule per leg end (tip in the socket) and one on the body. A 2-leg resistor on a dense board
means grips 1 pitch apart, so on phones keep hit spheres ≥ 0.3 units and rely on the 10/22 px touch rings.
Disable the leg grips while another item is held (`enabled: held === null || held === key`, `hands.ts` L82).

### 5.4 Fixed stand parts

The battery with its switch, the player, the speaker and the lamp sit off-board and reach the board through fixed
leads into fixed rows (rails). They are `layout.fixed` with `rows`. The battery switch is `switch.ts` (COPY+ADAPT),
whose `closed` becomes the switch part's `setting`. Leads are drawn with `curves.hermite` (the `Lay.length` slack
bow) like the loose wires of `build`.

### 5.5 Multimeter probe snapped to a socket

Two probes (`com` black, `v` red) = two `Leg`s with `Place` socket | rest (on the meter) | hand, each with a grip on
its handle and a lead drawn by `hermite` (meter jack → tip).
- **Snap style A (from `build/hands`):** snap during the drag in board xz to the nearest socket within `SNAP`.
  It works for the board's flat field of sockets and is deterministic in QA. Recommended.
- **Snap style B (from `battery/voltage`, L68-79):** a camera-facing drag plane through the tip; snap is decided
  by `e.ray.distanceToPoint(pole) < 0.3` and applied **on release**; the tip lerps toward the pole while near
  (L169-171). It is good for a few 3-D targets at different heights (a lamp's terminal, a part's leg above the board).
- **A probe may share a socket with a leg**: one row is one node, so the probe accepts **any** socket
  (`policy.plug = () => true`, occupancy ignored). It can be shown touching the top of the leg in that socket.
- Reading (volts): `v[nodeOfRow[rowOf(sV)]] − v[nodeOfRow[rowOf(sCOM)]]` from the last solve; shown with stepUi
  `{type:'readout', id:'meter', label: caption(…), unit:'V', get: () => meter.volts}`; a damped display value on
  the 3D meter. Amperes need the meter *in series* (it is a part in the netlist with tiny ohms, between two rows
  where the reader opened the circuit). That is a model/design open question; volts first.
- Probes: `ctx.qa.probe('probe-v', () => tipWorld)`, `socket-<id>` getters, `ctx.qa.expose('meter', …)`.

### 5.6 Warm / burnt from the model

`sol.parts[id].p / spec.limits.powerW` → `heat` with a first-order lag (as `03-short` L163-165, all in `late(dt)`,
no timers) → (a) `Warmth.shade` (copy of `thermal-warm.ts`, with the lens test off when it must show on the board),
and/or (b) the part's own `K.toon` emissive tint. `burnt` latches when heat passes 1 for a held time and stays until
the part is swapped from the tray (`swap.ts` pattern: one `t`, playable both ways, `finish()` for deep links).
The spec §3.4 forbids smoke/fire effects as decoration: the visual must be the model's state only.

### 5.7 QA for the board

- Probes: `leg-<part>-<i>` (grip mesh), `body-<part>`, `tray-<kind>`, `socket-<id>` (`Vector3` getter),
  `probe-v`/`probe-com`, `switch`.
- Readers: `motion` = every leg tip / body / probe tip / camera (continuity via `strides`, a `BOUND` per key);
  `board` = `{ key, pending, nodeOfRow, parts: {id: {u,i,p,heat,burnt}} }`; `meter`.
- Drags: `carry('tray-r470', 'socket-r3a')` (spawn plus first leg), then `carry('leg-R1-1', 'socket-r7a')`. Use a
  mid-point lift so the path avoids other sockets. After snapping, `advance(0.3)` before `read`.
- Unit-test `netlistOf` in vitest; the browser script checks only what the hand does and what the model shows.

---

## 6. Gotchas

1. **Lint scope.** `no-restricted-properties` (`Date.now`, `performance.now`, `window.setTimeout`, `Math.random`)
   applies **only to `src/volumes/*/chapters/**`**. `no-restricted-globals: setInterval` applies to all of `src/**`
   (`app/eslint.config.js` L29-32 for all `src/**`; L36-62 for chapters, properties at L54-60). A bare `setTimeout(…)` or `requestAnimationFrame` is **not** caught in
   chapters, and nothing of the list is caught in `shared/**`. They still break the frozen-clock QA: use `dt`
   countdowns (as `01-first-light` L112, L119-126), `ctx.tweens`, `ctx.clock`, and `ctx.random` (seeded `Rng`).
   Part instance ids come from a counter.
2. **`sim/**` purity test** reads comments too: never write those names even in a comment there; only relative
   imports inside `sim/` (no `three`, no `@/…`).
3. **Boundaries.** Chapters → own chapter + `@/…` + own volume `sim|content|shared` only
   (`eslint-rules/chapter-boundary.js` L100-114). The `_dev` sandbox → `@electronics/shared/**` only. Volumes never
   import each other (`local/volume-boundary`). `@electronics/*` is already in `tsconfig.json` L24; vite aliases are
   generated from the folder names (`vite.config.ts` L11-17).
4. **`@/engine/*` is forbidden in chapters** except `@/engine/api` (`eslint.config.js` L41-50). `gsap` is
   forbidden (use `ctx.tweens`).
5. `dragStart` arrives on the first move past 4 px (mouse) or 9 px (touch), not on press. A tap on a grip does
   nothing unless `click` is registered. Decide what a tap on a tray item does.
6. After a mid-drag snap the gesture is still alive: later `drag` and `dragEnd` calls reach the same handler
   (`enabled()` is not re-checked). Guard with `held !== key`.
7. Every registered root is re-raycast **every frame** for hover (`input.ts` L342-356). Do not register sockets
   (dozens); compute the snap mathematically. Keep hit volumes as low-poly spheres.
8. A probe on an Object3D resolves to its world **bbox centre**, which includes invisible hit spheres. Probe the
   visible grip mesh or pass a `Vector3` getter.
9. `End.seated` vs `End.clamp`: the model must read **`seated`** (set on arrival); `clamp` is the target. Mixing
   them makes the lamp light before the end visibly arrives, and QA reading right after a drag sees the old verdict
   unless it `advance()`s past the travel.
10. `hands.near` in `build` is dead code (always null). Don't copy it as if it worked.
11. `magnifier.ts` and `thermal-warm.ts` build their twin lists **once** (`magnifier.ts` L229, `thermal-warm.ts`
    L140). Parts added later are ignored. Rebuild on topology change or make twins per part.
12. Render-order ladder used together: magnifier iris 950, twins 951+, swap copies 960+, thermal twins 4996.
    Keep it if these are copied together.
13. `worldToBoard`/`boardToWorld` assume the stage group at the world origin (`tools/index.ts` L30). `hands.ts`
    mixes a quaternion read from the scene graph (L92) with the closed-form tilt (L93-95). Using `frame.worldToLocal`
    avoids the mismatch.
14. Interaction gating: `build` makes the hands inert while `world.flying` (camera flights between steps) and while
    the step's entry queue still runs (`policy.take`). The electronics bench needs its own "flying" flag.
15. Deep links: every `enter(info)` must handle `info.instant` by snapping (`wiring.snap()`, `glide.set`,
    `lens.snap`); `info.from === null` = the chapter is opening. Steps re-derive everything on entry; what the reader
    built lives only in step-module state (`find-fault` rebuilds the stand with `bench.restore`).
16. Captions are addressed **by index** (`content.ts` `caption(step, i)`), and the manifest test pins each index
    to its text. Reordering «Підписи» in the script breaks the scene silently unless that test exists. No
    Ukrainian words in scene code.
17. QA needs `--out <dir>` on this machine (constraints), `?freeze` (`appUrl(..., {freeze: 0})`) and
    `__app.pause()`. Compare exposed numbers, not pixels. A narrow desktop puts «Керування» in a sheet tab
    (`tools/qa/sheet-tab.mjs`, used at `interactions.mjs` L170).
18. In `build`, the stage param `closed` means "the lamp has power" (the chapter owns the slider through
    `switch.ts`). The electronics stand must decide likewise who owns each displayed state (the model, always).
19. The goal state is a module-level `Set` (`chapter.ts` L47-52), which survives a scene rebuild but is per page
    session. Do the same per chapter.
20. `ctx.gesture` (audio unlock) is on `ChapterContext`, not on `ctx.input` (`engine/chapter.ts` ~L225).

## 7. Open questions

1. Leg by leg (as briefed) or "whole part, snap all legs at pitch on release"? The second is easier on touch and
   for 3-leg TO-92. Maybe do both: carry by the body = whole part; drag a single leg = re-seat that leg.
2. A part with a leg out: left out of the netlist (`pending`, proposed) or a private node per loose leg so that
   `analyse()` reports `floating`?
3. Board geometry: how many rows/columns, split halves (a–e / f–j), power rails, the socket pitch in board units
   vs the minimum touch target (≥ 44 px at 1280×720 and on phones). This sets `SNAP` and the grip size.
   (Spec §9: in `VISUAL.md`.)
4. Board frame: tilted like `circuit` (15°) or level? Recommendation: a `frame` Group whatever the tilt; no
   closed-form copies.
5. Warmth: always visible on the part (emissive / tint) or only through a heat lens as in `circuit/short`? A
   burnt part stays until swapped: does the swap go through the tray (drag a fresh one in) or a tap
   ("replace")?
6. The multimeter: volts only at first? An ammeter needs the reader to open the circuit and insert the meter as a
   part. Resistance mode needs the part out of the circuit. What does the readout show when only one probe is on?
7. Tray: an unlimited supply per kind/value (spawn on drag) or a fixed set of physical pieces? What happens on a
   drop off the board (back to the tray, or lie on the stand like `build`'s loose ends)?
8. Jumper wires: the model has a `jumper` part. Are they tray items with two legs and a long `reach` (the `build`
   wire pattern: `hermite` + `Lay.length` slack)?
9. Where `netlistOf` lives: `sim/board/` (pure, re-exported through `shared/` for the sandbox) or
   `shared/bench/` (no purity test, but no three needed). `sim/board/` is recommended for the test discipline.
10. Probe B style (ray distance, snap on release) for 3-D targets off the board (lamp terminals, the speaker): do
    off-board terminals exist as probe targets at all?
