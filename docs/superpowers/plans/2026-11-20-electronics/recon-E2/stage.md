# Recon E2 — the `circuit` stage and its visual language (for `electronics/shared/bench`)

Read-only map of `app/src/volumes/circuit/shared/stage/**` (8 687 lines incl. README and tests), the two chapters
that drive it, and `docs/volumes/circuit/VISUAL.md`. Paths are relative to the repo root unless stated.
Stage dir = `app/src/volumes/circuit/shared/stage/` (abbrev. `S/`). Target dir proposed by the design
(`docs/superpowers/specs/2026-11-20-electronics-volume-design.md` §6.1): `app/src/volumes/electronics/shared/bench/`.
`docs/volumes/electronics/` does NOT exist yet (REUSE.md must be created).

Key fact for copying: every stage file imports only `three`, `three/addons/...`, platform `@/…`
(`@/engine/api`, `@/kit`, `@/style`, `@/text`) and RELATIVE stage siblings. No `@circuit/...` import inside `S/`.
So a copied subset keeps working if it keeps the same relative layout; the coupling is entirely through siblings.
(`@circuit/...` imports appear only in `shared/world/**` and chapters.)

---------------------------------------------------------------------------------------------------------------

## 0. Answer in one screen

**Minimal set to get room + demonstration stand + lighting + materials + lens + gauge** (≈ 1 750 lines after
adaptation, vs 8 000+ if `index.ts` is copied as is, because `mountStage` instantiates the torch, unfold, crawl,
battery cutaway, lamp close-up and thermal view):

| # | Source | Lines | Verdict | Into |
|---|---|---|---|---|
| 1 | `S/materials.ts` | 138 | COPY as is | `bench/materials.ts` |
| 2 | `S/room.ts` | 144 | COPY as is | `bench/room.ts` |
| 3 | `S/layout.ts` | 108 | COPY+ADAPT (rewrite places; keep `BOARD`, `LENS`, `SHELF_WORLD` shape) | `bench/layout.ts` |
| 4 | `S/base.ts` | 133 | COPY+ADAPT (sizes from new `BOARD`; shelf → tray or drop) | `bench/base.ts` |
| 5 | `S/light.ts` | 174 | COPY as is (maybe ADAPT key-light owner) | `bench/light.ts` |
| 6 | `S/shots.ts` | 107 | COPY+ADAPT (keep `boardToWorld`, `STAGE_FOV`, `STAGE_POST`, `stand`; drop flashlight/crawl/handover) | `bench/shots.ts` |
| 7 | `S/dyn-tube.ts` | 122 | COPY as is (gauge leads; jumper wires; probe leads) | `bench/dyn-tube.ts` |
| 8 | `S/tools/lens.ts` | 204 | COPY as is | `bench/tools/lens.ts` |
| 9 | `S/tools/gauge.ts` | 337 | COPY+ADAPT (range, dynamic probe poles, home, number → HUD) | `bench/tools/gauge.ts` |
| 10 | `S/tools/index.ts` | 187 | COPY+ADAPT → ~80 lines (lens poses + call/rim + gauge light; no crawl/snail/loupe/frame) | `bench/tools/index.ts` |
| 11 | `S/index.ts` | 366 | COPY+ADAPT → new `mountBench` ~150 lines | `bench/index.ts` |
| 12 | `S/air.ts` | 171 | optional COPY+ADAPT (drop torch `beam`) | `bench/air.ts` |
| 13 | `S/battery-cell.ts` `followVoltage` only | 4 | COPY the function (needle inertia) | into `bench/tools/gauge.ts` or `meter.ts` |
| + | `S/bulb.ts` (+ `supportPath` from `S/bulb-close.ts:24-37`) + `S/bulb-heat.ts` | 339 + 14 + 182 | COPY+ADAPT only if the bench keeps a lamp (design §6.1 lists «лампа» as permanent) | `bench/bulb.ts`, `bench/bulb-heat.ts` |
| + | tests `S/__tests__/layout.test.ts`, `bulb.test.ts`, `bulb-heat.test.ts` | 96, 29, 117 | COPY+ADAPT with the files they cover | `bench/__tests__/` |

Everything else in `S/` is SKIP or REFERENCE (§3). Lens DIVE (stand→part→inside→atoms) is NOT in `S/`; it lives
in `circuit/shared/world/**` (§5) and the magnifier-as-magnifier in `circuit/chapters/build/parts/magnifier.ts`.

---------------------------------------------------------------------------------------------------------------

## 1. Dependency graph of the minimal set (sibling imports only; platform imports listed per file in §2)

```
index.ts (mountBench) ── room.ts ── materials.ts
                     ├── base.ts ── layout.ts, materials.ts, room.ts(TABLE)
                     ├── light.ts                      (no sibling deps)
                     ├── shots.ts ── layout.ts, base.ts(BOARD_Y)
                     ├── tools/index.ts ── layout.ts, shots.ts, base.ts, tools/lens.ts, tools/gauge.ts
                     │      tools/lens.ts  ── layout.ts(LENS), materials.ts(sheath)
                     │      tools/gauge.ts ── base.ts(BOARD_Y), dyn-tube.ts, layout.ts(BATTERY, BOARD)
                     ├── air.ts                        (no sibling deps)
                     └── [bulb.ts ── bulb-close.ts(supportPath), layout.ts(LAMP), lamp-view.ts(createLampCloseUp), materials.ts(sheath)]
                         [bulb-heat.ts — pure, no imports]
```
Cuts needed when copying: `tools/index.ts` imports crawl/loupe/snail/frame (drop); `tools/gauge.ts` imports
`BATTERY` (replace with bench places); `bulb.ts` imports `lamp-view.ts` (strip `close`) and `bulb-close.ts`
(inline `supportPath`); `shots.ts` `HANDOVER` uses `LENS.wireSpot`, `LOOP.y`, `WIRE.core` (drop or redefine).

---------------------------------------------------------------------------------------------------------------

## 2. File by file — the minimal set

### 2.1 `S/README.md` (375) — REFERENCE only
Contract of the stage: mount snippet (11–23), parameters table (29–42), options/entry states (49–81), crawl
(83–135), battery inside + gauge (137–193), board frame (195–203), unfolding (205–213), dive/hand-over (215–227),
light & materials rules (229–238), lamp close-up (240–276), performance (278–283), file index (322–364).
Write a sibling `bench/README.md` in the same shape (the circuit README is the model of what a stage README holds).

### 2.2 `S/index.ts` (366) — COPY+ADAPT → `mountBench(ctx, options)`
Exports (lines): re-exports 25–42; `interface CircuitStage` 44–138; `glowOfCharge(charge)` 141;
`tameAll(root: Group): void` 147; `interface UnfoldPlay` 157; `CRAWL_AMBIENT` 163; `interface StageOptions { globe? }`
165; `mountStage(ctx: ChapterContext, options?: StageOptions): CircuitStage` 173–366.
Imports: `three` (Group, Quaternion, Vector3, Mesh), `@/engine/api` (`damp`, `ChapterContext`), `@/style`
(`KToonMaterial`), and 15 siblings: air, base, crawl-scene, light, materials(tame), room, shots(STAGE_POST), stand,
tools, torch, bulb(bulbDims), bulb-heat(temperatureOfHeat), bulb-print, lamp-view, bulb-thermal, unfold.

What `mountStage` does, in order (keep the bold ones):
- 176–180 **`group` → `ctx.root`; `ctx.env.setScale(3.6)`; `ctx.post.base(STAGE_POST.stand)`** (chapter post base = DoF).
- 181 **`createRoom(ctx)`** (sets `ctx.env.base(ROOM_ENV)`), 182 **`createBase()`**, 183 `createStand(bulb)`,
  184 `createTorch` (SKIP), 185 `base.frame.add(stand.group, ...torch.parts)`, 187 `createUnfold` (SKIP),
  188 **`createTools(ctx, base.frame)`**, 189/193 **`tameAll(group)`** (twice: before and after air),
  190–192 `createAir` + `torch.glass.add(air.beam)`.
- 198–204 bulb print + **phone rule**: prints hidden when `ctx.device.formFactor === 'phone'`, re-checked `ctx.onResize`.
- 205 **`createLight(ctx, stand.bulb.filament)`**; 206 **`ctx.env.setShadow({ extent: 5.4, center: [0, 0.8, 0], softness: 4 })`**.
- 214–226 `createLampView(... createThermal(...))` (SKIP for the bench unless thermal lens wanted).
- 235 `target = manual ?? closed × glowOf(charge)`; 236–285 **`apply()`** every frame:
  `light.set({ glow, moon, light: max(glow, target()), ambient })` (247); **breath** `1 + 0.014 sin(1.7t) + 0.008 sin(2.9t + 1.3)`
  on `light.lamp.intensity` (249–250); **`stand.bulb.setGlow(light.filament, light.emission × breath, glow, moon)`** (251);
  **room light for unlit things** `room = min(1, 0.25 + 0.75·max(moon, glow²))` (252) → `battery.light`, `bulbPrint.light`,
  `tools.set({ light: room, … })`; bounce light position (263–266; at the finished stand `beam = 0` → lamp + (−1.1, 0.5, 0.9));
  `tools.set(...)` (267–280); wires poles/dive (281–282); lamp view (283); air (284).
- 340–362 **`update(dt, t)`**: play unfold, crawl scene, tools, battery inside; **glow damping**
  `glow = damp(glow, to, to > glow ? 16 : 9, dt)` and snap within 1e-3 (357–359); slider `damp(…, 22, dt)`; `apply()`.
- 334–339 **`snap()`**: glow = target, slider = closed, apply (deep links).
For the bench keep: group/env scale/post base, room, base, light, tools(lens+gauge), air (opt.), tameAll, phone rule,
glow state with `setGlow(v|null)`, `snap()`, `update()`, `ambient`/`moon`/`lensCall`/`lens`/`dive` numbers.
Drop: torch, unfold, `playUnfold`, crawl, `snail/ruler/spark/race` (deprecated inert), battery inside, poles, slider glow,
lamp view/thermal (unless wanted), `glowOfCharge` (charge is the model's job now).

### 2.3 `S/room.ts` (144) — COPY as is
Exports: `TABLE = { radius: 8.6, y: 0, thickness: 0.34 }` 21; `MOON_DIR = (-0.62, 0.72, 0.3).normalize()` 24;
`ROOM_ENV: EnvOverrides` 27–42 (top/bottom `bg.void`, mid `bg.deep`, horizon 0.02, bokeh/motes/floor/fog 0,
sunDir = MOON_DIR, keyColor sky→white 0.25, rim `blue`); `interface Room { group; table; setBlurs(amount) }` 79;
`createRoom(ctx): Room` 86 — calls **`ctx.env.base(ROOM_ENV)`**, lathe table top with vertex-colour falloff,
`surface({ color: 'bg.indigo', scatter: 0.085, pool: 0.5, vertexColors: true })`, five additive out-of-focus blurs
(ShaderMaterial, renderOrder −5) far behind and BELOW table level (−5.6…−9.9 y, z −30…−33).
Imports: three; `@/engine/api` (type ChapterContext); `@/kit` (G.fillet, G.lathe); `@/style` (col, ColorLike,
EnvOverrides); sibling `materials` (surface). Requires the chapter/volume theme `{ sky: 'studio', mood: 'studio' }`
(electronics `volume.ts` already sets it at volume level; the circuit sandbox also sets it per chapter manifest).

### 2.4 `S/materials.ts` (138) — COPY as is
- `interface SurfaceParams extends ToonParams { scatter?=0.1; scatterTint?; shoulder?=0.3; pool?=0.8 }` 14.
- `surface(params?): KToonMaterial` 68 — K.toon (bands 2, softness 0.32, terminator 0.3, no highlight/rim) with a
  patched fragment: warm scatter of the direct light + the lamp pool gathered into three soft steps (PATCH 29–37),
  and a 16-tap point-shadow filter (`softPointShadows` 47–66, POINT_SHADOW_TAPS 40). Name `stage.surface`.
- `interface SheathParams extends ToonParams { opacity?=0.4; edgeOpacity?=0.92 }` 85; `sheath(params?)` 98 — LIT
  translucent plastic with fresnel alpha (use instead of unlit `K.glass` for anything translucent in the dark room:
  wire sheath, lens glass, LED epoxy, film-capacitor coating). Name `stage.sheath`.
- `tame<T extends KToonMaterial>(material, cap = 1.1): T` 125 — caps each direct light's colour at `cap` (no blow-out
  next to the lamp); skips `stage.surface` and already tamed; sets `userData.tamed`.
Imports: three (ShaderChunk, Vector4); `@/style` (K, col, ColorLike, KToonMaterial, ToonParams).
All three patch K.toon / three shader TEXT and **throw** if the anchor lines change (`BASE_LINE`, `OUT_LINE`,
`NDL_LINE`, three's `shadowmap_pars_fragment` loop) — safe while platform is read-only, brittle on a three upgrade.

### 2.5 `S/layout.ts` (108) — COPY+ADAPT
Board frame convention (header 1–10): origin = centre of the board face, +x right, +y out of the face, +z toward
the reader; face tilted 15°; **toy scale 1 unit ≈ 26 mm** (AA battery 1.9 units).
Exports: `BOARD { width 6.6, depth 4.4, thickness 0.62, corner 0.34, tilt 15°, feet 0.16 }` 11; `LOOP` 24; `WIRE
{ sheath 0.068, core 0.036 }` 35; `BATTERY` 42; `SWITCH` 55; `SEAT` 67; `LAMP { x, z, socketY 0.74, filamentY 1.65,
glass 0.66, term 0.31 }` 70; `LENS { holder {x −2.81, z 1.68}, wireSpot, radius 0.45 }` 83; `RULER` 93;
`SHELF_WORLD { y 0.92, z −3.02, depth 1.56, width 6.3 }` 99 (WORLD, level); `STAPLES` 102. Pure constants, no imports.
Adapt: keep `BOARD` (base, shots, gauge, tools need it), `LENS` (lens, holder), `SHELF_WORLD` (base) or remove the
shelf; replace LOOP/BATTERY/SWITCH/SEAT/STAPLES/RULER with breadboard + fixed items (9 V battery+switch, player,
speaker, lamp, tray). Test pattern to copy: `S/__tests__/layout.test.ts` (96) asserts VISUAL size rules on constants.

### 2.6 `S/base.ts` (133) — COPY+ADAPT
`BOARD_Y = TABLE.y + BOARD.feet + BOARD.thickness + (BOARD.depth/2)·sin(tilt)` 21 (world y of board-frame origin);
`wedgeGeometry()` 24 (rounded-rect prism sheared to the 15° face, vertex colours `bg.indigo`→`bg.violet`, chamfer
`slate`, creased normals); `interface Base { group; frame: Group; face: Mesh }` 57; `createBase(): Base` 65 —
face `surface({ color: 'bg.violet', scatter 0.2, scatterTint amber→yellow.light, shoulder 0.16 })`, body K.toon,
four `ink` feet, the shelf (ledge + rail, 98–108), **`frame` group at (0, BOARD_Y, 0) rotated x = tilt** (110–114;
"add everything that stands on the board here"), pressed-in edge line (116–131).
Imports: three (BufferAttribute, Color, Group, Mesh, Path, ShapeGeometry), `three/addons/utils/BufferGeometryUtils.js`
(toCreasedNormals), `@/kit` (G), `@/style` (K, col), siblings `layout` (BOARD, SHELF_WORLD), `materials` (surface),
`room` (TABLE). Adapt: new BOARD size if the breadboard needs it; shelf → parts tray place or delete.

### 2.7 `S/light.ts` (174) — COPY as is (decide who owns the key light, §8 Q2)
- `SCALE` 16–24 incandescence stops: 0 `steel.dark` · 0.1 `red.dark` · 0.26 `red` · 0.46 `orange` · 0.66 `amber` ·
  0.84 `yellow.light` · 1 `white`. `filamentColor(t, out?): Color` 27.
- `interface LightState { glow; light?; ambient?=0.5; moon }` 39; `interface LightRig { lamp: PointLight; bounce:
  PointLight; readonly output; set(state); yieldEnv(yielded, blend?); readonly filament: Color; readonly emission }` 56.
- `createLight(ctx, filament: Object3D): LightRig` 79: lamp `PointLight(white, 0, distance 18, decay 1.55)`,
  castShadow, cube map 1024, radius 36, bias −0.0006, normalBias 0.02, **parented to `filament`**; bounce
  `PointLight(…, 0, 15, 1.35)` shadowless in `ctx.root`. `set()`: `output = lit^1.9`; `emission = g < 0.02 ? 0 :
  0.9 + 2.6·g^1.6`; lamp colour = filamentColor(lit) lerp warm 0.8·lit; `lamp.intensity = 7.5·output`; bounce 1.5·output;
  env: `keyIntensity = 0.34·(moonLevel·(1+0.6·lift) + 0.5·lift·(1−moon))`, moon halves with output, ambient lift fades
  with output; **`ctx.env.tune({ keyIntensity, fillIntensity, fillGround, fillSky, rimIntensity, shadowStrength: 0.85 })`**
  (151–164) only when the state key changes OR when `ctx.env.params.keyIntensity` drifted (a step entry reset the env).
  `yieldEnv(true)` hands the env to the lower floors (used by `shared/world/look.ts`).
Imports: three (Color, PointLight, Object3D); `@/engine/api` (type ChapterContext); `@/style` (col).
Note: nothing here needs the lamp to be a bulb — `filament` can be any Object3D (a lamp part in a socket, a fixed
desk-lamp). If the bench lamp is a pluggable part, re-parent `rig.lamp` to the part's filament object.

### 2.8 `S/shots.ts` (107) — COPY+ADAPT
`boardToWorld(x, y, z, out?): Vector3` 14 (stage group at world origin: `(x, BOARD_Y + y·cos − z·sin, y·sin + z·cos)`);
`STAGE_FOV = 27` 21 (vertical fov of the 3:2 safe frame for every stand shot); `HANDOVER` 27–36 (dive end pose over
the near wire: direction (0, −0.66, −0.7513), distance = core / tan(fov/2)); `LENS_OVER_WIRE` 39;
`STAGE_POST = { stand: { dofAperture 1.5, dofRange 2.7, dofMaxBlur 9 }, lamp: { 2.2, 0.9, 12 } }` 49;
`STAGE_SHOTS` 54–107 `satisfies Record<string, Shot>`: **`stand` position [0, 8.05, 8.6], target [0, 1.5, −0.1],
fov 27, fit { center [0, 1.35, 0], radius 3.75 } (phone portrait framing), orbit { azimuth 0.5, polar 0.22,
zoom [0.8, 1.35] }** (56–62); flashlight, crawl, lamp, lens, handover (`near 0.01, far 60, drift 0, orbit disabled`).
Imports: three (Vector3), `@/engine/api` (type Shot), siblings `layout` (BOARD, LAMP, LENS, LOOP, WIRE), `base` (BOARD_Y).
Adapt: keep boardToWorld, STAGE_FOV, STAGE_POST, `stand`; add bench shots (board close, tray, speaker, meter, scope);
redefine a HANDOVER-like pose per part if the dive is copied.

### 2.9 `S/air.ts` (171) — optional, COPY+ADAPT
`interface Air { motes: Points; beam: Mesh; set(lamp: Vector3, color: Color, power: number, axis: Vector3|null, beam: number) }` 80;
`createAir(ctx, count = 260): Air` 94 — `ctx.quality.count(count, 160)` motes seeded with **`ctx.random`**, drifting on
`kGlobals.uKTime` (shader time), visible only in the lamp's light (falloff in the vertex shader); point size from
`ctx.viewport.height × dpr` (re-set `ctx.onResize`); the `beam` cone is the torch's — drop it.
Imports: three; `@/engine/api` (type ChapterContext); `@/kit` (G.lathe); `@/style` (kGlobals). No siblings.

### 2.10 `S/dyn-tube.ts` (122) — COPY as is
`resample(points, n, out?): Vector3[]` 12 (uniform in arc length); `class DynTube` 33: `constructor(readonly rings,
readonly radial)` 41, `readonly geometry: BufferGeometry` (allocated once, always capped),
`update(path: readonly Vector3[], up: Vector3, section: (i, out: [w, h]) => void)` 76 (rewrites positions/normals in
place; elliptic section; flat strip w≫h, wire w = h). Imports: three only. Use for gauge leads, probe leads, jumper
wires, speaker cable.

### 2.11 `S/tools/lens.ts` (204) — COPY as is
- `interface LensPose { position; facing; handle; scale?=1; grip?=1 }` 17 (board frame; `grip = 1/scale` keeps a
  normal-size handle under an enlarged ring).
- `interface LensModel { group; setPose(from, to, k); setCall(amount, t); setRim(amount); rim: Mesh; glass: Mesh; ring: Mesh }` 32.
- `holderPose(): LensPose` 85 (flat on the pegs at `LENS.holder`, y 0.17, handle toward the reader).
- `createLens(ctx): LensModel` 93: Builder handle (steel ferrule, capsule grip, ink ring) regrouped as `lens:handle`;
  ring K.toon quiet = `slate`→`cyan` 0.3, emissive cyan 0.02 (keepHue); glass = lathe disc with `sheath({ sky→white,
  opacity 0.07, edge 0.42 })`, renderOrder 4; **`rim`** = full-screen overlay quad (`toOverlay`, renderOrder 50,
  depthTest off) drawing four cyan arcs in the frame corners while diving (`setRim`), aspect updated `ctx.onResize`.
  `setPose` eases `k` (smoothstep), arcs 0.7 units up mid-way (`sin(π e)`), slerps orientation (`orient(facing, handle)`
  76: local +z → facing, local −y → handle), lerps scale/grip. `setCall(a, t)`: colour quiet→cyan, emissive
  `0.02 + a·(0.3 + 0.12 sin(2.4 t))` — **t must be engine time**.
Imports: three; `@/engine/api` (toOverlay, type ChapterContext); `@/kit` (Builder, G); `@/style` (K, col);
siblings `../layout` (LENS), `../materials` (sheath). Needs `LENS.radius`, `LENS.holder`.

### 2.12 `S/tools/gauge.ts` (337) — COPY+ADAPT (the meter)
Types: `ProbeId = 'minus' | 'plus'` 18; `interface Probe { on: number; handle: Group; hold(world: Vector3|null);
readonly pole; readonly tip; readonly rest }` 20; `interface GaugeModel { group; value: number; shown: number;
light: number; probes: Record<ProbeId, Probe>; readonly touching: boolean; readonly anchor: Object3D }` 35.
Constants 50–60: body 1.5 × 0.95 × 0.26; **SWEEP 104°**, pivot (−0.17, −0.27), radius 0.44, **MAX 2 (V)**, face leans
55° in the world. `angleOf(v) = SWEEP/2 − clamp(v, 0, MAX)/MAX · SWEEP` 62. Private `toBoard/toWorld` 71/75 (inverse
of boardToWorld). **`GAUGE_HOME = (BATTERY.x − 1.05, 0, BOARD.depth/2 + 0.62)` world, on the TABLE** 84.
`buildMeter()` 88 — Builder body + face (`bg.violet`→`slate`), 21 ticks every 0.1 V (major every 0.5), pivot cap,
two lead sockets (dcMinus/dcPlus), needle = K.toon `SEMANTIC.fieldE` (amber) emissive 0.35, **`Text3D` number «1,6 V»
(size 0.17) and printed scale «0 · 0,5 · 1 · 1,5 · 2» (size 0.1)**. `buildProbe(id)` 168 (steel needle, collar,
coloured grip `dcMinus` blue / `dcPlus` coral, ink cap; tip at origin along +y). `PROBE_BACK = 0.56` 184.
`createGauge(): GaugeModel` 186: probe `pole` = FIXED point on the battery clamp leaves (217–219);
rest beside the meter on the table (221–222); `apply()` 268–301:
- **needle** `rotation.z = angleOf(value)`;
- **number** `` `${value.toFixed(1).replace('.', ',')} V` `` re-laid only when the string changes (Text3D relayout cost);
- **shown** `e = smooth(shown)`: slides from `awayBoard` (0.9 toward the reader) to `homeBoard`, scale 0.4→1, hidden < 0.004;
- probes: tip = held point, or lerp(rest → pole, smooth(on)·e); axis lerp rest→on; lead = DynTube(30, 8) through 6
  control points (socket, up, sag, …, probe back) rounded by `G.roundPath(pts, 0.3, 6)`, radius 0.024·(0.4+0.6e).
- `light` setter: number + prints colour = white × (0.35 + 0.65·light) (unlit text follows the room).
Imports: three (Group, Mesh, Object3D, Quaternion, Vector3); `@/kit` (Builder, G); `@/style` (K, SEMANTIC, col);
`@/text` (Text3D); siblings `../base` (BOARD_Y), `../dyn-tube` (DynTube, resample), `../layout` (BATTERY, BOARD).
How a chapter drives it (`circuit/chapters/battery/world.ts:118-127`, `steps/04-voltage.ts:156-185`): slide
`gauge.shown` toward a want at `dt/0.9` per frame; `needle = followVoltage(needle, target, dt)`; write `gauge.value`
only when it moved > 1e-4; probes: `probe.hold(world)` while dragging (pull toward `probe.pole` when near: lerp
`1 − e^(−20 dt)`), glide home `1 − e^(−9 dt)`, then `probe.on = 1; probe.hold(null)`; `touching` gates the reading.
`followVoltage(shown, target, dt)` = `target + (shown − target)·exp(−dt/τ)`, τ 0.14 s falling, 0.75 s rising
(`S/battery-cell.ts:119`).
Adapt for the bench: (1) range: MAX 2 V → multimeter ranges (9 V battery ⇒ 0…10 V; mA; Ω) or a digital meter body;
(2) **probe `pole` must be settable** (any socket/pin, snapping chosen by the bench), not the battery leaves;
(3) design §6.2: the NUMBER lives in the HUD `readout` (UI_API §4: `{ type: 'readout', label, unit, digits, get() }`),
so drop/hide the 3D `Text3D` number (keep scale ticks or a dim LCD); (4) `GAUGE_HOME` from bench layout;
(5) probe grips: design says «бірюзові захвати, як у circuit/build» vs gauge's coral/blue — decide (§8 Q6).

### 2.13 `S/tools/index.ts` (187) — COPY+ADAPT → ~80 lines
Exports: re-exports 19–26; `worldToBoard(p, out?)` 31, `worldDirToBoard(d, out?)` 37 (uses `unTilt` quaternion 28 and
`BOARD_Y`); `overWirePose(): LensPose` 42 (on the dive axis, `scale 1.12`); `overStartPose(scale=1.9, z)` 58 (crawl);
`CRAWL_RING` 76; `interface ToolState { arrive; lensUse; dive; light; call; crawl; crawlShown; loupe; glow }` 78;
`interface Tools { lens; gauge; frame; snail; crawl; loupe; poses: { holder; overWire; overStart }; set(state, t); update(dt, t) }` 98;
`createTools(ctx, frameGroup): Tools` 114 — creates lens/gauge/frame/snail/crawl/loupe, adds to the board frame,
`ctx.root.add(lens.rim)`; `set()` 150–182: lens lands from `above` to holder on `arrive` (keep `arrive = 1` on the bench),
blends holder→inUse by `max(lensUse, crawl)`, **`lens.setCall(landed·(max(call, lensUse)…), t)`**, **`lens.setRim(smooth(ramp(dive, 0.5, 0.92)))`**,
phone hides printed numbers, `gauge.light = frame.light = light`.
Imports: three; `@/engine/api` (type); siblings `../layout`, `../shots`, `../base`, `./frame`, `./gauge`, `./lens`,
`./crawl`, `./crawl-lane`, `./loupe`, `./snail`. Keep: world/board helpers, lens + gauge, holder pose, a generic
`overPose(boardPoint, scale)` replacing `overWirePose`, call/rim logic.

### 2.14 (if the lamp stays) `S/bulb.ts` (339) — COPY+ADAPT; `S/bulb-heat.ts` (182) — COPY+ADAPT
`bulb.ts`: `interface BulbDims { thread; threadRadius; globe; globeY; filamentY; span }` 35; `bulbDims(globe = LAMP.glass)` 46;
`BULB` 56; `interface BulbModel { group; filament: Object3D; setGlow(color, emission, glow, room?); coil; glass; close; print }` 58;
`coilGeometry(turns, radius, wire)` 73 (vertex colours: ends one step cooler); GLARE shaders 101–122 (camera-facing
additive sprite, steps back close up); **`depthShell(glass, centreY)` 132** (invisible depth-only copy, renderOrder 5000,
×1.012 — so DoF focuses transparent glass; reuse for LED domes / any big glass); `createBulb(B)` 148 (Builder with a
`glass` slot `{ color sky, opacity 0.05, edgeOpacity 0.55, specular 0.14 }`; filament K.glow steel.dark; halo K.glow
additive; bead `sheath`; glare). **`setGlow(color, emission, glow, room=1)` 312–337**: filament colour/intensity
`max(emission, 0.55)`/whiten `0.15+0.5 glow`; fine coil (close-up) tweaks; halo `0.05·glow²`; glare `0.62·glow^1.9·(1−0.85 near)`,
visible > 0.05; **K.glass edge colour cold→warm × min(1, 0.1 + 0.9·max(room·0.55, glow))** (unlit glass must not shine).
Imports: three; `@/kit` (Builder, G); `@/style` (K, col, KGlassMaterial, KGlowMaterial); siblings `bulb-close`
(supportPath), `bulb-print` (type), `layout` (LAMP), `lamp-view` (createLampCloseUp), `materials` (sheath).
Adapt: remove `close` (lamp-view + bulb-close close-up: 487 lines) — inline `supportPath` (`S/bulb-close.ts:24-37`,
14 lines, uses `G.roundPath`); `print` optional.
`bulb-heat.ts` (pure, no imports, unit-tested): `ROOM_C 20`, `WORK_C 2300` 19–20; `HEAT_STOPS` 27 (0→20 °C, 0.1→600,
0.26→800, 0.46→1050, 0.66→1400, 0.84→1850, 1→2300); `FIRST_GLOW 0.076` 38; `temperatureOfHeat(h)` 43;
`heatOfTemperature(c)` 56; **`formatTemperature(c)` 72** («≈ 2 300 °C», NBSP, step 50 above 1000 / 10 below);
`LAMP_WORK { amps 0.3, ohms 5, watts 0.45 }` 84; `resistanceAt(c)` 96 (ρ ∝ T^1.2); `lossAt(c)` 101 (T⁴ radiation +
8 % conduction); `temperatureOfCurrent(A)` 109 (bisection of I²R(T) = loss(T)); `heatOfCurrent(A)` 123;
`currentOfHeat(h)` 128; `filamentAfterClick(s, { volts, ohms })` 172 / `filamentAfterRelease(s, fromHeat)` 180
(midpoint integration, step 1e-4 s, ≤ 3 s). Adapt: the heat↔colour scale and `formatTemperature` are generic; the
energy balance is the 1.5 V / 0.3 A circuit lamp — the bench lamp (≤ 9 V) needs its own working point, or (better,
`sim/core/state.ts` comment) the model owns the filament temperature and the bench only maps °C → heat → colour.

---------------------------------------------------------------------------------------------------------------

## 3. Everything else in `S/` — verdicts

| File | Lines | What | Deps (siblings) | Verdict |
|---|---|---|---|---|
| `stand.ts` | 136 | `PLACE` 16; `interface Stand` 27 (mounts, battery, bulb, slider, spring, wires, settle, setSwitch, setSeat, anchors); `createStand(bulbDims)` 55: `Builder('stand')` + `addMounts` + anchors (`b.anchor(name, x, y, z)` → `model.anchor(name)`), parts added to board frame | battery, bulb, layout, mounts, small-parts, wires | REFERENCE (pattern: Builder parts + named anchors in the board frame); write `bench/bench.ts` |
| `mounts.ts` | 225 | `terminal(p, x, dir, collar?, axis)` 18 (steel screw terminal with slotted screw + coloured collar); `addClamp` 35; `addMounts(b)` 80 (clamps, cradle, switch block, lamp post & socket, seat, staples, lens holder 188–207); `mountX` 212 | layout; `@/kit` Builder (type), `@/style` SEMANTIC | COPY+ADAPT pieces: `terminal()` (battery/speaker terminals), lamp post+socket (139–155), lens holder (188–207); rest SKIP |
| `small-parts.ts` | 79 | `SLIDER_Y`, `SLIDER_TRAVEL`; `createSlider(): { group; setGlow(a) }` 30 (yellow thumb on steel bridge, glow-in-the-dark emissive); `createSpring(length, turns)` 56 | layout (SWITCH) | COPY+ADAPT `createSlider` if the 9 V battery switch is a slide switch; spring SKIP |
| `wires.ts` | 370 | `WireId`, `standPath`, `WireShape { path, round, cover, copper, up?, bare?, gap?, thin? }` 65, `BARE` 91, `interface Wires` 95, `createWires()` 156; ember: per-vertex `K_EMISSIVE_ATTRIBUTE` painted `col('orange') × 1.1·ember` on the thin stretch (209–225), `setEmber` 341 | dyn-tube, layout, materials | REFERENCE (sheath + copper core look; per-vertex ember technique); jumper wires: see `circuit/chapters/build/parts/wiring.ts` |
| `battery.ts` | 245 | `interface BatteryModel` 16 (charge, printShown, printAnchor, light, plusTip/minusTip, inside); printed marks on the can (strip/minus/plus); `createBattery()` 145 | layout, battery-inside (→ 6 more files, ≈1 400 lines) | REFERENCE (AA modelling, print as unlit Text3D following `light`); the 9 V «Крона» is a new model |
| `battery-inside.ts` · `-section` · `-layers` · `-grains` · `-react` · `-poles` | 418 · 153 · 122 · 134 · 152 · 292 | AA cutaway, life, reaction, pole charges | each other, layout, shots, tools/gauge | SKIP |
| `battery-cell.ts` | 122 | AA numbers of `life`; `followVoltage` 119 | — | COPY `followVoltage` only (4 lines); rest SKIP (the MNA model replaces it) |
| `bulb-close.ts` | 163 | fine coil, leads, path, `supportPath` 24 | bulb (type) | SKIP (inline `supportPath`) |
| `lamp-view.ts` | 324 | lamp close-up level, cut (clipping planes), path, anchors; `createLampView(close, filament, heatNow, celsiusOf, thermal)` 286 → `{ heat, celsius, detail, cut, thermal, update(cameraPos) }` | bulb (type), bulb-thermal (type), bulb-close | SKIP (REFERENCE for "read-only view object over one model number" pattern and the clipping-plane cutaway `createCutter` 206) |
| `bulb-thermal.ts` | 249 | heat view through the lens: twins of every stand mesh in false colour, only where the camera→fragment ray crosses the lens disc (`LENS_TEST` 49); `thermalShade(°C)` 21 (log scale); `createThermal({ root, glass, bulb, stemY, filamentY })` 132 → `{ set(amount), update(heat) }` | bulb-heat | REFERENCE / COPY+ADAPT if a «теплова лупа» is wanted for hot parts (per-part shade instead of coil/leads) — see also `circuit/chapters/build/parts/thermal-warm.ts` (154, per-object shade in the same view) |
| `bulb-print.ts` | 109 | «0,3 A» Text3D on the base, drawn only ≥ 16 px-eq per em (fades to 20) | — | REFERENCE (the world-text legibility rule implemented) |
| `lamp-shots.ts` | 70 | `LAMP_SHOTS`, `lampLensPose(scale, from, height)` | layout, shots, tools | SKIP |
| `loop-glow.ts` | 240 | additive sleeve of light along `loopPath()` (fronts, flow stripes, hide stretches); `loopShare(x, z)` | layout, tools/frame | REFERENCE (energy/signal flow along a path; needs a bench path) |
| `tools/frame.ts` | 132 | teal counter frame on a wire + billboard Text3D number; `loopPath()` 13 | layout | SKIP (REFERENCE if an "ammeter ring" is wanted; note teal = electronics accent) |
| `tools/loupe.ts` · `tools/loupe-shader.ts` | 122 · 139 | the crawl's plain magnifier picture (wire's first cm, mm scale, sparks) | layout, Text3D | SKIP (crawl-specific). For a real magnifier on the bench see `build/parts/magnifier.ts` (§5) |
| `tools/crawl.ts` · `tools/crawl-lane.ts` · `tools/snail.ts` · `crawl-scene.ts` | 246 · 93 · 128 · 121 | the snail scene | layout, Text3D | SKIP |
| `torch.ts` · `unfold.ts` | 217 · 348 | flashlight and its unfolding into the stand | bulb, layout, materials, wires, stand, small-parts, dyn-tube | SKIP |
| `__tests__/battery-cell` · `bulb-close` · `crawl-lane` | 91 · 70 · 48 | | | SKIP |

---------------------------------------------------------------------------------------------------------------

## 4. How a chapter instantiates the stage (three real patterns)

**A. Direct, minimal** — the showcase `app/src/volumes/_dev/chapters/_sandbox-circuit-stage/scene.ts` (266) + manifest
`index.ts` (77, `theme: { accent: 'amber', sky: 'studio', mood: 'studio' }` line 12):
```ts
export default defineScene((ctx) => {
  const stand = mountStage(ctx, globe > 0 ? { globe } : {});         // scene.ts:31
  camera.shots({ ...STAGE_SHOTS, ...LAMP_SHOTS, ...BATTERY_SHOTS, near: {...}, ... });   // :38
  stage.param('closed', 0, { duration: 0.01, onChange: (v) => (stand.closed = v) });      // :62 one param per field
  stage.param('glow', -1, { duration: 0.01, onChange: (v) => stand.setGlow(v < 0 ? null : v) });
  stage.param('gauge', 0, { duration: 0.6, onChange: (v) => (stand.tools.gauge.shown = v) });
  ...stage.define({...});  return { enterStep: (_id, info) => info.instant && stand.snap(), update: (dt, t) => stand.update(dt, t) };
});
```
(README 8–23 gives the same contract.) A `_dev` chapter is the only place allowed to import another volume's
`shared/**` (lint `showcase`). The bench sandbox `_sandbox-electronics-bench` (design §8 E2) follows this pattern.

**B. `circuit/chapters/resistance/scene.ts` (110)** → `createResistanceStand(ctx)` (`chapters/resistance/stand.ts:86`)
→ `mountWorld(ctx, { drift })` (`shared/world/index.ts:123`) → `mountStage(ctx, …)` (:124), `ctx.camera.shots({ ...STAGE_SHOTS, ...lower, away })`
(:148), `registerParams(ctx, stand)` (`shared/world/params.ts:31-56`: 13 params `ctx.stage.param(name, initial,
{ duration, ease: 'power2.inOut', onChange: (v) => (stand.<field> = v) })`; `deep` sine.inOut 2 s).
Scene: `stand.world.define({...})` (= `ctx.stage.define`) :49; `enterStep` → `stand.world.enterStep(id, info)`; `if (info.instant) stand.snap()` :79–80;
`update` → step update → `stand.update(dt, t)` → `world.update` → `stand.update`. Chapter props are added to
`stage.base.frame` (thermometer :93). **Model value → glow** (`resistance/stand.ts:150-155`):
```ts
wire.ember = (1 - stage.glow) * clamp((k - 1) / 7);                                   // wires.setEmber
stage.setGlow(wire.active ? Math.max(heatOfCurrent(currentOf(k)), DULL) : null);      // model current → heat → whole frame
```
Atoms' heat follows a target with a first-order lag: `lattice.heat += (target − heat)(1 − e^(−dt/rate))` (:148).

**C. `circuit/chapters/lamp/scene.ts` (229)** → `createLampWorld(ctx)` (`chapters/lamp/world.ts:41`) → `mountWorld(ctx, { drift: 0.06 })`;
`createLoopGlow()` added to `world.stand.base.frame`; extra shots `ctx.camera.shots({ ...LAMP_SHOTS, ...BATTERY_SHOTS, ... })`;
`world.lamp.detail = 1` (scene.ts:55); **lens interaction**: `ctx.input.register(world.stand.tools.lens.group,
{ cursor: 'grab', tooltip, enabled, click, dragStart, drag, dragEnd })` (:117–128) routed to the current step;
per frame `world.lamp.cut = door.cut(p)` (:218), `world.glow.update(t)`; lens window placed after the keeper lays the lens (:224).

---------------------------------------------------------------------------------------------------------------

## 5. Outside `S/` but needed for the requested features (pointers, not mapped in depth)

- **Dive stand → part → inside → atoms** = `circuit/shared/world/**` (9 .ts files, 1 398 lines, + README.md): `dive.ts` (222, `createDiveRail(stops: Shot[], lead?)`,
  `LENS_LEG 0.5`, position −½…3 → camera/lens/deep), `flight.ts` (200, imports `STAGE_SHOTS` from `@circuit/shared/stage`),
  `levels.ts` (94, pure: `DEEP`, `mixAt(deep)`, `floorAt`, `floorValue = 3 − deep`, `legsBetween`), `look.ts` (76, env/post
  ownership above/below; imports `@circuit/shared/copper/look`), `window.ts` (126, stencil portal: lower world inside the
  resting lens), `border.ts` (232, chapter-border frames; `ORDER` is circuit's chapter list), `params.ts` (57), `away.ts` (39),
  `index.ts` (352, `mountWorld`). It is wired to the copper world (`circuit/shared/copper/**`) at `HANDOVER`.
  Verdict: COPY+ADAPT `dive.ts` + `levels.ts` (+ `flight.ts`) with `@circuit/...` imports rewritten; `border.ts`/`away.ts`
  REFERENCE; floors renamed to electronics' `stand/part/inside/atoms` (volume.json axis already has them).
  Note `S/README.md:226`: a view of the lower floor inside the resting lens was not built in the stage; `window.ts` did it.
- **Magnifier as a real magnifier** (read resistor bands): `circuit/chapters/build/parts/magnifier.ts` (267) — stencil portal,
  twins of nearby stand meshes scaled `power`× about the focus; `interface Magnifier { amount; power; readonly focus; update() }` 65,
  `createMagnifier(ctx, stage: CircuitStage)` 76; uses `LENS`, `LOOP`, `boardToWorld`, `stage.tools.lens`, `stage.base`. COPY+ADAPT
  candidate (chapter-local in circuit → would be bench-shared in electronics).
- **Warming parts in the heat view**: `circuit/chapters/build/parts/thermal-warm.ts` (154): `createWarmth(roots, glass, only: RegExp)`
  → `{ shade 0…1, amount, count, update() }` 63/77 — per-object false-colour twin in the lens ring.
- **Drag/snap handles** (probes, parts from the tray): `circuit/chapters/build/parts/{wiring,ends,grips,glide,clamps}.ts`
  (cyan grips that stick to clamps; `wiring.ts` imports `@circuit/shared/stage/wires` and `dyn-tube`).
- **Platform alternatives (import directly, no copy)**: `@/fx` thermal — `applyHeat(material: KToonMaterial, t, maxIntensity = 2.2)`
  (`fx/thermal/heat.ts:103`: emissive = `heatRamp(t)` orange→red, intensity t²·max), `createSmoke/createPlume/createHotSteam(env, o)`
  (`fx/thermal/vapour.ts`) for a burning part, `createHeatShimmer`; `@/style` — `heatRamp`, `temperatureRamp` (blue→sky→white→orange→red),
  `voltageRamp` (`style/palette.ts:268-282`), `K_EMISSIVE_ATTRIBUTE` + `paintEmissive(geometry, color, intensity)`
  (`style/materials/toon.ts:245-257`, per-vertex glow for LEDs/bands), `SEMANTIC` (`dcPlus` coral, `dcMinus` blue, `fieldE` amber,
  `nRegion`/`donor` teal, `pRegion`/`acceptor` pink, `valenceBand` violet, `conductionBand` sky, `bandGap` bg.deep, `affordance` cyan);
  HUD step UI `readout` / `gauge` / `chart` controls (`docs/UI_API.md` §4 lines 220–235).

---------------------------------------------------------------------------------------------------------------

## 6. Heat and glow from a model value — how the stage does it, and what to take

Chain in the stage (one number `glow` 0…1 = the coil's place on the incandescence scale):
1. **model → heat**: `heatOfCurrent(A)` (steady energy balance, `bulb-heat.ts:123`) or `glowOf(charge)`; a step may scrub
   with `stand.setGlow(h | null)`; `target = manual ?? closed × glowOf(charge)` (`index.ts:235`).
2. **thermal inertia**: `glow = damp(glow, target, up ? 16 : 9, dt)` (`index.ts:358`); `snap()` jumps (deep links).
   For transients the stage uses the physics directly: `stand.setGlow(filamentAfterClick(t).heat)` (`lamp/glow`).
3. **look** (`light.set` + `bulb.setGlow`): filament colour `filamentColor(glow)`; emission `0.9 + 2.6 g^1.6` (0 under 0.02);
   PointLight `7.5·lit^1.9` warm-shifted; bounce; env key/fill/rim re-tuned; halo `0.05 g²`; glare `0.62 g^1.9`; glass edge warms;
   breath ±2 %; air motes `output^1.5`; unlit things follow `room = 0.25 + 0.75·max(moon, glow²)`.
4. **read-outs**: `lamp.celsius = temperatureOfHeat(glow)` → `formatTemperature` «≈ 2 300 °C».
5. **heat view** (`lamp.thermal` 0…1): `createThermal(...).update(heat)` → coil shade `thermalShade(temperatureOfHeat(heat))`
   (log scale `log1p((T−20)/40)/log1p(2280/40)`), supports at 35 % of the coil's ΔT, everything else room-blue; only inside the ring.
6. **warm wire without glow**: per-vertex emissive `kEmissive` painted orange × 1.1·ember (`wires.ts:209-225`).

For the bench (parts warming from model power): model gives per part `{ u, i, p }` (`sim/core/dc.ts:11 PartReading`) and
`limits.powerW` (`sim/core/parts.ts:14 Limits`). Suggested mapping, all with the stage's own idioms:
`load = p / limits.powerW` → first-order temperature lag (as `lattice.heat`, τ ≈ seconds; or in `ModelState` per
`sim/core/state.ts` comment) → (a) honest visible cue only when really hot: `applyHeat(bodyMat, t)` or `kEmissive` on
the body, smoke from `@/fx` when `burnt`; (b) the true temperature in a heat lens (`thermalShade(°C)` + `thermal-warm`
twins); (c) lamp/LED glow through the `light.ts` chain above. Keep `tame()` on every part body (runtime-added parts too).

---------------------------------------------------------------------------------------------------------------

## 7. What `docs/volumes/circuit/VISUAL.md` (456 lines, Ukrainian) says — palette, light, camera, scale, text

- **§1 (17–24) three tests per frame**: 3 seconds (the eye lands on the thing named for the step), 320 px thumbnail
  (hero and lamp state readable), «one world» (stand, lens rim or the «де ми» cue visible).
- **§2 (26–101) one world: stand in a dark room.** Night `bg.void` → `bg.deep`; 3–5 warm/cool far blurs (hint of a window),
  no objects; table = smooth round top `bg.indigo`, only its edge arcs show; dust visible only in the lamp's light.
  Base: rounded 3:2, thick (two battery thicknesses), four low feet, face tilted 15° to the reader, matte `bg.violet`
  (one tone lighter than the table), `slate` chamfer, thin pressed-in line. **«Без перфорації, сітки, гвинтів, шкал приладів
  і світлячків»** — the only lettering «+»/«−» by the clamps (electronics' breadboard grid must explicitly override this).
  Mounts `steel` on `ink` blocks; plus collar `coral`, minus `blue`. Lens holder near-left corner.
  **Light is the main artistic means** (62–71): open circuit = cold «moon» upper-left (`sky`, weak) + `bg.indigo` fill, whole
  stand readable but muted, brightest = lens rim; closed = **the lamp itself** (warm point `yellow.light`→`white`, strength
  tied to current), moon halves; warm pool brightest under the lamp, long soft coloured shadows. **The click changes the whole
  frame. Bloom only from the filament; glass, board and panel never blow out.**
  Main shot «Стенд» (73–84): camera front-above **35–45° to the board** (code `STAGE_SHOTS.stand` comment says 52° — mismatch);
  board 60–64 % of frame width, 55–62 % height; battery 18–20 % width; lamp glass ≥ 16 % height; switch ≥ 8 % width,
  gap ≥ 12 px; wires ≥ 10 px; lens ring 22–26 % of frame height in use.
  **Nothing runs along wires on the stand plan** (86–88): no dashes/pulses/arrows; life = lamp breath, motes.
- **§3 (103–136) floors & camera**: stand 10⁻¹ m → inside a part 10⁻³ → rows of atoms 10⁻⁹ → one atom 10⁻¹⁰. **The lens is the
  only door**; it lies OVER the place it shows (never parked with a leader line); a continuous depth slider drives the
  flight, full way 1,6–2,2 s, scrubbable both ways; rim leaves thin `cyan` arcs in the corners; back the same way, lens returns
  to its holder. Lens has two uses: door / plain magnifier (the latter is not a door). **No cuts**: up/down only by continuous
  motion; between chapters a return to the stand plan (2–3 s), border = the same frame (`volume.json → seamless`).
  «Де ми» mini-map lower-left; state is passed down (warm light from above when closed). Camera breathes when idle
  (STYLE_GUIDE §5); `reducedMotion` flights 0,6 s.
- **§4 (138–157) semantic colours**: core unchanged (`cyan` = touchable, `green`/`amber`/`red` states, `orange`→`red` heat);
  electron `cyan` glowing; nucleus/+ `coral`; marked electron cyan + white core/ring; field/push `amber`; **light/energy
  `yellow`→`white` only** (filament, light on the board, energy glow); heat `orange`→`red`; poles `coral`/`blue`; wire sheath
  tint by pole; filament cold `steel.dark` then the §5.3 scale; board/mounts/blocks `bg.violet`/`steel`/`ink`.
- **§5.3 (240–261) the incandescence scale**: `steel.dark` → `red.dark` (~600 °C) → `red` → `orange` → `amber` → `yellow.light`
  → white with `yellow` halo; coil ends one step cooler; heating not instant; only the filament glows (soft glint on glass).
- **§5.7 (328–339) meter**: a small instrument with ONE big scale, needle and number; two springy probes on the clamps; «це
  інструмент, як лупа, а не деталь кола»; not ready if bigger than the battery or anything else is on its face.
  Practicum: wire ends are big `cyan` grips that stick to clamps; success is the lamp and the light, not a tick mark.
- **§8 (423–436) panel, labels, numbers (= «text in 3D»)**: ≤ 3 labels in the scene at once; names on hover/tap; numbers in the
  scene only the ONE the step is about (counter, thermometer, meter scale); everyday units in Ukrainian signs (мм, см, с, хв,
  год), electrical international (V, A, Ω, W); phones/tablets: panel below, scene above, sizes from the scene's height.
  (Implementation rule in `S/README.md:313-320` and `bulb-print.ts`: every world `Text3D` ≥ 16 px-eq per em, `chapter-check`
  enforces it; on phones prints are hidden and named in the interface.)
- **§9 (438–456) auditor's checklist** at 1280×720, 1920×1080, 3840×2160, lamp on and off; 60 fps on the reference machine.
- **Scale** (from code, not VISUAL): toy scale **1 unit ≈ 26 mm** (`layout.ts:6`); `ctx.env.setScale(3.6)`; STAGE_FOV 27°;
  measured main shot at 1920×1080 (`README:201-203`): board 62.4 % × 57.6 %, battery 18.9 % width, lamp glass 16.5 % height,
  wire 22 px (core 12 px).

---------------------------------------------------------------------------------------------------------------

## 8. Gotchas

1. **Lint** (`app/eslint.config.js`): `setInterval` is a restricted global in ALL `src/**/*.ts` (line 31); `Date.now`,
   `performance.now`, `window.setTimeout`, `Math.random` are restricted only in `src/volumes/*/chapters/**` (block from line 37; rules 54–60), plus
   `no-restricted-imports` there: only `@/engine/api` from the engine, no `gsap` (use `ctx.tweens`). `shared/**` is not linted
   for them but must stay deterministic anyway (QA): the stage uses `ctx.random` (`air.ts:101`), its own seeded PRNG
   (`battery-grains.ts seeded`), engine time `t` for every sine. Also `consistent-type-imports` (inline `type`),
   `no-explicit-any`, `no-console` except warn/error/info, `eqeqeq`.
2. **Volume boundary** (`app/eslint-rules/chapter-boundary.js`): `local/volume-boundary` on all `src/**`; chapters may use
   `sim`, `content`, `shared` of their OWN volume (`SHARED_IN_VOLUME`, line 24 — `shared` already allowed); only `_dev`/`_path`
   chapters may import another volume's `shared/**`. Alias `@electronics/*` exists in `app/tsconfig.json:24`. When copying,
   any `@circuit/...` import (only in `shared/world`, chapters) must become relative / `@electronics/...`.
3. **`sim/` purity test** (`electronics/sim/core/__tests__/purity.test.ts`) scans file TEXT incl. comments for `Math.random`,
   `Date.now`, `new Date`, `performance.now`, `crypto…`, three/DOM imports — don't put bench heat curves with such words in `sim/`.
4. **Env ownership**: never call `ctx.env.tune()` from a chapter — the light rig owns it and re-applies itself when a step
   entry resets the environment (it compares `ctx.env.params.keyIntensity` every frame, `light.ts:143-144`). `room.ts` sets
   `ctx.env.base(ROOM_ENV)`; needs theme `{ sky: 'studio', mood: 'studio' }`. `mountStage` also sets `ctx.env.setScale(3.6)`,
   `ctx.env.setShadow({...})`, `ctx.post.base(STAGE_POST.stand)`.
5. **Unlit things in a dark room**: `K.glass`, `K.glow`, `Text3D` ignore lights → they shine in the dark. Drive them by hand
   from the room level (`light` props of battery/gauge/frame/prints; glass edge colour in `bulb.setGlow`). Translucent lit
   plastic = `sheath()`, not `K.glass`.
6. **`tameAll(group)` after adding lit props** (`index.ts:147`) — else things near the lamp blow out to yellow-white. Parts
   dragged in at runtime need `tame()` too. `surface()` is exempt on purpose.
7. **Transparent glass + DoF**: glass writes no depth → depth of field blurs it by what lies behind. Add an invisible
   depth-only shell (`depthShell`, `bulb.ts:132`, renderOrder 5000 > env motes 1002). Applies to LED domes, lens glass if big.
8. **GPU NaN rule** (`README:305-307`): no `pow`/`sqrt` of a value that can be 0 in shaders on this GPU — NaN, which bloom
   spreads into black blots. Meshes without normals (flat Text3D) must not get shading twins (`bulb-thermal.ts:189-190`).
9. **Shadows / draw calls** (`README:278-283`): the lamp's cube shadow map costs up to 6 draw calls per shadow-casting mesh;
   the circuit stage already sits at 171–317 draw calls of the **350 budget** (frame 3.0–4.7 ms of 8). A breadboard with
   hundreds of sockets must be ONE merged mesh (Builder merges by material slot) or instanced, `castShadow = false` on small
   things. Prefer few materials (Builder slots).
10. **Lights must stay in the scene** (intensity 0, not removed) — changing the number of lights recompiles every shader
    (README `island`: «Always in the scene (intensity 0 = no recompiles)»). Matters for LEDs/lamps as pluggable parts.
11. **Deep links**: on `info.instant` call `stand.snap()` (no heating ramp, slider in place); the composed world does it in
    `world.enterStep`. Every step must re-derive its state on entry (random access).
12. **Text3D**: needs fonts — the stage creates prints in the mount, not in models constructed by Node unit tests
    (`index.ts:197`). Text relayout is costly: set `.text` only on change (gauge `apply`). World text ≥ 16 px-eq (chapter-check).
13. **Shader-text patches throw** if K.toon/three change (`materials.ts` 53–56, 72–74, 101–103, 130–131).
14. **Phone rule**: printed numbers/labels under 14 px are hidden on `ctx.device.formFactor === 'phone'` and shown in the
    interface (`index.ts:199-204`, `tools/index.ts:175`); re-check on `ctx.onResize`.
15. **Board frame vs world**: everything on the board lives in `base.frame` (tilted 15°); the gauge lives on the TABLE (world)
    but is built in board frame via `toBoard()` — keep the two helpers consistent (`boardToWorld`, `worldToBoard`).
16. **Tests**: vitest, `environment: 'node'` (`app/vite.config.ts:77-80`), files `src/**/*.test.ts` in `__tests__/`; models
    that need ctx are tested with stubs `{ clock, onDispose, qa: { expose } } as unknown as ChapterContext`
    (`radio/shared/world/__tests__/world.test.ts:55-59`); pure modules (bulb-heat) and layout invariants are unit-tested;
    geometry facts asserted with `Box3` (`bulb.test.ts`).
17. **Visual rules that clash with the new volume**: VISUAL §2 forbids grids/perforation/indicator lights on the board and
    allows bloom only from the filament; a breadboard and LEDs break both — electronics VISUAL.md must restate them.
    `teal` was circuit's counter-frame colour and is the electronics accent.
18. **Ambient default 0.5** lifts only the unlit room; the bench will spend most steps with no lamp lit → the muted «circuit
    open» look is the default frame unless the key light is rethought (§9 Q2).
19. **Repo hygiene** (memory): run `pnpm` only from `app/` with Node 24 via nvm; never `pnpm format` (rewrites ~761 files).
20. **Gesture for audio** is `ctx.gesture: Promise<void>` on ChapterContext (`engine/chapter.ts:225`), not `ctx.input.gesture`
    as the design §6.3 writes.
21. Several stage comments cite `docs/requests/*.md` and `/srv/electricity/qa/...` which do not exist in this mirror.

## 9. Open questions

1. **Scale**: keep 1 unit ≈ 26 mm? A real resistor body (6 mm) would be 0.24 units (≈ 2 % of frame width) — far below
   the readability the stand demands. Choose an enlarged «stylised breadboard» scale (and new `BOARD` size) — and whether
   the breadboard replaces the board's face or sits on it.
2. **Key light**: in circuit the lamp IS the key light and the room is dark when it is off. On the bench most steps have
   no lamp lit. Keep `light.ts` as is (moon + ambient lift as the default look), add a fixed warm key (desk lamp) or make
   the permanent lamp normally on? Who owns `rig.lamp` when a lamp part is plugged in elsewhere?
3. **LEDs and hot parts as light sources**: one shadowless PointLight per LED (always present, intensity 0) or emissive
   only? Is bloom allowed from LEDs/glowing parts (VISUAL §2 «bloom only from the filament»)?
4. **The meter**: analogue needle gauge (copy `gauge.ts`, new ranges) or a digital multimeter whose number is ONLY in the
   HUD readout (design §6.2)? Keep the 3D scale prints (≥ 16 px-eq rule at the stand shot)?
5. **Probe snapping**: the gauge's `pole` is a fixed battery-clamp point; on the bench any socket/pin. Should the bench
   own snapping (nearest socket in board frame) or the chapter (as in circuit)?
6. **Probe colours**: coral/blue (gauge, `SEMANTIC.dcPlus/dcMinus`) vs «бірюзові захвати» (design §6.2, circuit `build` grips).
7. **Dive**: copy `shared/world` dive/levels/flight (+ window portal) or write a lighter part-dive? What is the lower world
   (no copper world in electronics yet)? Which parts get a door (design: resistor film, capacitor plates, diode p-n, transistor layers).
8. **Thermal lens** (`bulb-thermal.ts` + `build/thermal-warm.ts`) for honest «warming from model power» — wanted?
9. **Real magnifier** (`build/parts/magnifier.ts`) to read colour bands — wanted on the bench?
10. **Shelf** behind the board: becomes the parts tray place, or removed?
11. **Camera angle**: VISUAL says 35–45° to the board, `STAGE_SHOTS.stand` comment says 52° — which is the reference?
12. **Theme**: is `theme: { sky: 'studio', mood: 'studio' }` in `electronics/volume.ts` enough, or must each chapter manifest
    repeat it (the circuit sandbox repeats it per chapter)?
13. **Directory name**: design §6.1 says `electronics/shared/bench`; keep the stage's internal names (`STAGE_*`, `mountStage`)
    or rename to `BENCH_*` / `mountBench` (REUSE.md must record either way)?
14. **Lamp**: keep `bulb.ts` (stripped of the close-up) as the permanent stand lamp, and whose working point (`LAMP_WORK`
    0.3 A / 5 Ω is the 1.5 V lamp) — or the model owns the filament temperature (`sim/core/state.ts` note)?
