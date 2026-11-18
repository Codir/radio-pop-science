# Ready-made building blocks for the radio volume: kit, fx, ui3d, text, style, audio

Repository: `/home/pilot/tmp/radio-science-pop` (HEAD `63fd42c`). Read-only run; nothing in the repository was
changed. Paths are repo-relative. "Design" = `docs/superpowers/specs/2026-11-17-radio-volume-design.md`.

Files opened completely: `docs/KIT_API.md`, `docs/FX_API.md`, `docs/UI_API.md`, `docs/STYLE_GUIDE.md`;
`app/src/{kit,fx,ui3d,text,style,audio}/index.ts`; `app/src/style/{palette,motion}.ts`,
`style/materials/{index,unlit,globals}.ts`, `style/env/presets.ts` (parts), `style/env/environment.ts` (parts);
`app/src/text/{text3d,fonts,layout,markup,rich}.ts`; `app/src/fx/signals/*.ts`, `fx/core/{ribbon,tick,env,color,quad}.ts`,
`fx/fields/{arrows,lines,sources}.ts`, `fx/drama/glows.ts`; `app/src/kit/core/builder.ts`, `kit/buildings/houses.ts`,
`kit/home/{house-shell,furniture}.ts`, `kit/env/props.ts`; `app/src/ui3d/{host,console,theme}.ts`,
`ui3d/charts/{chart,heatmap}.ts`, `ui3d/anchors/callout.ts`; `app/src/audio/{audio,engine,plugin,offline,moods}.ts`;
`app/scripts/{charset,font-coverage,build-fonts,webfaces}.mjs`; design lines 1-240, 240-380, 500-877.
Opened in part: `docs/ENGINE_API.md` §4-§13, §16-§21, §23-§24, `docs/ARCHITECTURE.md` §1, §5,
`docs/DECISIONS.md` (§8, §32, §57, §59 j-l), `docs/VOLUMES.md` §4, `docs/volumes/circuit/VISUAL.md` §4, §8,
`docs/volumes/radio/VOLUME.md` §6, `app/src/engine/pipeline/{shaders,post-params,pipeline}.ts`,
`app/src/engine/{app,quality,device,layers}.ts`, `tools/qa/{chapter-check,lib,mobile-check,mobile-parts,dom-cost}.mjs`,
`tools/content/{doccheck,typography,terms_check}.py`, `app/eslint.config.js`, `app/eslint-rules/chapter-boundary.js`.

Baseline command run in this session (reads only): `cd app && node scripts/font-coverage.mjs` (= `pnpm fonts:check`) →

```
font coverage: 273 distinct characters in on-screen copy of the chapter exports
OK: every character has a glyph in every face
OK: every character is in every web font stack (9 WOFF2 faces)
exit=0
```

`node scripts/font-coverage.mjs --volume radio` → `font coverage: 0 distinct characters …`, exit 0 (there is no
`docs/volumes/radio/chapters/_export/` yet, so the check is vacuous for radio today).

Documents the docs refer to that do **not** exist in this copy: `docs/MOBILE.md`, `docs/HUD_DOM.md`,
`docs/PATH_FORMAT.md`, `docs/VOLUME_STRUCTURE.md`, `docs/AGENT_GUIDE.md`, `docs/briefs/`, `docs/reports/`
(`F3-fx.md`, `F1-core.md`), `docs/requests/`, `docs/PLAN.md`, and the `/srv/electricity/qa/…` sheets named in KIT_API §10.

---

## 1. Parts that fit

Import rule: platform libraries through `@/…` (`@/kit`, `@/fx`, `@/ui3d`, `@/text`, `@/style`, `@/audio`); a
chapter may also import its own volume's `sim/**`, `content/**`, `shared/**` (`app/eslint-rules/chapter-boundary.js:25`
`SHARED_IN_VOLUME = new Set(['sim', 'content', 'shared'])`). `@radio/*` needs one line in `app/tsconfig.json` `paths`
(today only `@/*`, `@electricity/*`, `@circuit/*`, `tsconfig.json:19-23`); Vite derives the alias from the directory
name (`app/vite.config.ts:13-17`).

### 1.1 Need → existing export → gap

| Need (design) | Existing export (import path, signature, key options) | Gap |
|---|---|---|
| **Yard ground / base** | `island(options: IslandOptions = {}): Island` from `@/kit` (`kit/env/terrain.ts:211`). Options: `radius` (60), `wobble`, `outline`, `seed`, `relief`, `features: TerrainFeature[]` (`hill`, `lake`, `river`, `pad {x,z,r \| w,d,rot,color,corner,blend}`, `path {path,width,color}`), `biome: 'meadow'\|'steppe'\|'desert'\|'snow'\|'rock'\|'industrial'`, `underside: 'floating'\|'slab'\|'none'`, `depth`, `crystals`, `detail`. Returns `heightAt(x,z)`, `rimAt(θ)`, `inside(x,z,margin)`, `dry(x,z)`, `place(obj,x,z,ry?,lift?)`. Ground colours `GROUND.gravel()/concrete()/asphalt()/dirt()/sand()/coal()` (`terrain.ts:201-208`) | Cost: `island` 75k tris / 3 meshes (KIT_API §10). Units are metres; pair with `ctx.env.setScale(r, { adaptFrom: LOOK_SCALE.diorama })` (KIT_API §1) |
| **House (exterior)** | `house(o: HouseOptions = {}): KitModel`, `addHouse(b, o)` (`kit/buildings/houses.ts:35,112`). Options `width` (8), `depth` (7), `floors: 1\|2`, `roof: 'gable'\|'hip'\|'flat'\|'shed'`, `wall`, `roofColor`, `door`, `shutters`, `chimney`, `flowers`, `lit` (0.7), `seed`. Anchors `door`, `lamp`, `service`, `meter`, `chimney.smoke`, `roof`. Front faces +Z | Closed box, no interior, no cut. Default walls are pastel tokens (`houses.ts:31`), not brick |
| **Brick house in section: kitchen, corridor, far room, cellar** | `cutawayHouse(o: CutawayHouseOptions = {}): CutawayHouse` (`kit/home/cutaway-house.ts:57`) is the electricity "shared house": 2 storeys 10 × 8 m, rooms `living`, `hall`, `kitchen`, `back`, `bedroom`, `study`, `bathroom`, parts `roof`, `front`, `setOpen(front, roof?)`, default wall `yellow.light` (`house-shell.ts:85`), 109k tris / 50 meshes. Reusable pieces: `addHouseShell(b, o)`, `addPartition(b, axis, pos, from, to, y0, h, openings, c, t = HOUSE.p)`, `addThroughWindow(b, w = 1.3, h = 1.3)` (`kit/home/house-shell.ts:35,65,83`), `addWindow(b, o)`, `addDoor(b, o)`, `addRoof(b, kind, w, d, rise, c, overhang = 0.45)`, `addChimney`, `onWall(b, at, ry, fn, prefix)` (`kit/buildings/parts.ts`) | No cellar («льох»), no corridor / far-room layout, no brick look, `HOUSE` dimensions are fixed constants. The radio house is a new `Builder` model in `radio/shared` built from the part helpers |
| **Kitchen furniture, microwave, router, table** | `addKitchen(b, w = 3.0, c = 'teal')` — worktop, hob, sink, kettle, **microwave** (anchors `stove`, `kettle`, `microwave`) (`kit/home/appliances.ts:23`); `addRouter(b)` (anchor `router`, 3 green `glow` LEDs, `appliances.ts:124`); `addTable(b, w, d, h, c)`, `addChair`, `addShelf`, `addFridge`, `addPlant`, `addRug`, `addFloorLamp`, `addCeilingLamp` (`kit/home/furniture.ts`) | Microwave exists only inside `addKitchen` (not a separate builder). No phone, no window sill |
| **Monitor / TV body** | `addTv(b: Builder): void` (`kit/home/furniture.ts:61`): stand + `ink` body + screen = `window`-slot box 1.17 × 0.64 with `glow: SCREEN_GLOW` (`col('sky').lerp(col('white'), 0.25)`, line 59), anchor `tv`. `addDesk(b)` has a laptop and a monitor the same way (line 70) | The screen is a vertex-coloured pane that only glows with `model.night`; it cannot show a texture. No portable baby-monitor-style model, no whip antenna |
| **Wireless camera, pole, antenna («прутик»), gate, shed, iron garage with doors, swing, bicycle with lamp, cat, phone, satellite dish, CRT** | none (searched `app/src/kit` for camera, monitor, garage, gate, swing, bike, cat, antenna, phone, dish). Nearest: `streetLamp(o)` / `addStreetLamp(b, o)` (`kit/env/props.ts:80,108`; `kind: 'road'\|'double'\|'park'`, `height`, `color`, `light`; anchors `light`, `light2`), `fence(o)` / `addFence(b, o)` (`props.ts:24,64`; `route: Pt[]`, `kind: 'picket'\|'rail'\|'mesh'\|'wall'`, `height`, `color` — picket boards every 0.42 m), `people(specs, rng)` with `scale` «~0.25 = cat-sized» (`kit/life/people.ts:29`) — a small capsule person, not a cat; `vehicle(kind)` kinds `'car'\|'van'\|'truck'\|'tractor'\|'boat'\|'ship'` (`kit/life/vehicles.ts:12`) — no bicycle | All of these are new models in `radio/shared/models` (design l.741 says so). Build with `Builder` + `G` (KIT_API §2b) |
| **Primitive builders** | `new Builder(name = 'model', mats: MatSet \| MatOptions = {})` (`kit/core/builder.ts:349`). Shapes: `box(w,h,d,{r,seg,mid})`, `cyl(r,h,{axis,…})`, `cone`, `dome`, `sphere(r,{seg})`, `capsule(r,length,{axis})`, `ring(R,r,{axis})`, `lathe(profile,{axis})`, `tube(points,radius)`, `rod(a,b,radius)`, `beam(a,b,w,{h,r})`, `add(geo, o: AddOptions, pre?)`. Structure: `frame(place, fn, prefix = '')`, `part(name, place = {}): Builder`, `anchor(name,x,y,z)`, `locate(name)`, `path(name, points)`, `attach(object)`, `geometry(slot)`, `build(): KitModel`. `AddOptions = Place & { c?: Tint; slot?: Slot; glow?: ColorLike }`, `Place = { at?: V3; rot?: V3; s?: number \| V3 }`. Geometry toolbox `G` (`kit/core/geo.ts`): `rbox`, `fillet`, `lathe`, `cyl`, `cone`, `dome`, `sphere`, `facet`, `capsule`, `ring`, `roundPath`, `catenary`, `tube`, `rod`, `rrectShape`, `polyShape`, `extrude`, `revolve`, `loft`, `mergeGeometries`, `quads` | `Slot` is a closed set: `'toon'\|'matte'\|'soft'\|'metal'\|'gloss'\|'facet'\|'double'\|'window'\|'lamp'\|'glow'\|'flat'\|'glass'` (`builder.ts:50-62`). No slot carries a texture; a textured screen has to be its own `Mesh` parented with `b.attach(obj)` or to a model anchor |
| **What a builder returns** | `KitModel` (`builder.ts:239`): `group`, `parts`, `anchors`, `paths`, `mats: MatSet`, `triangles`, `drawCalls` (getter), `night` (0…1), `update(dt, t)`, `part(name)`, `anchor(name)`, `anchorWorld(name, out?)`, `anchorLocal(name, out?)`. `part()` / `anchor()` throw `kit: model "<name>" has no part "<x>"` / `… has no anchor "<x>"` | — |
| **Materials (K)** | `K` from `@/style` (`style/materials/index.ts:22-45`): `K.toon(params: ToonParams = {})`, `K.metal(params: MetalParams = {})`, `K.energy(params: EnergyParams = {})`, `K.glow(params: GlowParams = {})`, `K.flat(color, params = {})`, `K.glass(params: GlassParams = {})`, `K.water(params: WaterParams = {})`, `K.hologram(params: HologramParams)`. All have tweenable `fade`. `GlowParams`: `color` (`cyan`), `intensity` (2.2; > ~1.2 blooms), `core`, `whiten` (0.55), `keepHue`, `falloff` (1.6), `edge` (0.55), `additive`, `opacity`, `vertexColors`, `side`, `fog`, `clippingPlanes`, `name` | **No K material samples a texture** (no `sampler2D` / `map` anywhere in `app/src/style/materials`). `MeshStandardMaterial` / `MeshBasicMaterial` are forbidden by ENGINE_API §19 (l.599), but no lint rule enforces it (`app/eslint.config.js`) and `volumes/circuit` uses `MeshBasicMaterial` in 34 files (0 in the platform libraries) and `new ShaderMaterial` 21 times in `volumes/circuit/shared` |
| **Palette tokens** | `col(value: ColorLike, out?): Color` (new linear `Color`), `hex(value)`, `sem(name)`, `voltageRamp(t)`, `heatRamp(t)`, `temperatureRamp(t)` (`style/palette.ts`). Tokens: accents ± `.light` / `.dark`, neutrals, `bg.*`, `wireBrown`, `wireGreen`, groups `plantType.*`, `ui.*`, `flow.*`. Hex values in §3 below | No radio token group (`carrier`, `iq`, `bits`, `noise`) |
| **Oscilloscope trace of a signal over time (probe strip)** | `createScope(o: ScopeOptions = {}): Scope` from `@/fx` (`fx/signals/scope.ts:129`). Options: `width` (4), `height` (2.4), `channels: ColorLike[]` (default `[SEMANTIC.phaseL1, phaseL2, phaseL3]` = yellow / green / red), `samples` (160), `cycles` (2), `frequency` (0.5 Hz), `lineWidth` (0.035), `accent`. Methods: `setWave(i, wave \| null, amplitude = 1)`, `setSamples(i, values: ArrayLike<number>)`, `push(i, value)`, `setChannelIntensity(i, v)`; fields `screen`, `frequency`, `phase`, `frozen`. 1 draw call for the plate + 1 per channel; lies in local XY | `setSamples` resamples by **nearest index** to `samples` points (`scope.ts:92`) — no min/max decimation, so a narrow sync pulse in a long buffer can vanish; values are clamped to ±1.15 of the half-height (`scope.ts:121`); the default channel colours are the electricity phase colours (pass `channels`); no axis text (FX_API l.318: «Text … is yours»); sizes are tuned for 3-6-unit scenes |
| **Bare instrument plate** | `createScreen(o: ScreenOptions): Screen` (`fx/signals/screen.ts:98`): `width`, `height` (required), `divisions` ([10, 6]), `accent` (`cyan`), `kind: 'grid' \| 'polar'`, `radius`; `fade`. Fill `bg.deep`, alpha 0.94 | Procedural grid only; no texture input |
| **Custom glowing curves (raster scan line, probe curves, wave fronts)** | `new RibbonLines(o: RibbonOptions)` from `@/fx` (`fx/core/ribbon.ts:80`): `capacity` (required, points), `color`, `width` (0.03), `minPixels` (1.4), `intensity` (1.15), `dashRepeat`, `dashStrength` (0.75; 0 = solid), `dashSpeed`, `base`, `endFade`, `hotCore`, `keepHue`, `mitre`, `depthTest`, `blend: 'additive' \| 'normal'`. `setLines(lines: readonly RibbonLine[])` with `RibbonLine = { points: readonly Vector3[]; closed?; brightness? }`; props `color` / `setColor`, `intensity`, `fade`, `reveal`, `width` (setter), `dashSpeed`. One draw call | `setLines` wants `Vector3[]` — callers keep a pool (as `Scope` does). `minPixels` is measured in the pixels of the **current render target** (`ribbon.ts:197-200`), so in a 128 × 96 camera-eye pass every ribbon is ≥ 1.4 px of 96 |
| **Wave travelling along a line** | `createWaveOnCurve(curve: Curve<Vector3>, o: WaveOnCurveOptions = {}): WaveOnCurve` (`fx/signals/extras.ts:65`): `color` (default `SEMANTIC.current` = yellow), `amplitude` (0.2), `wavelength` (1), `speed` (1), `transverse` (+Y), `samples` (160), `taper` (0.1), `width`, `intensity` | One sine only (no modulation, no E + B pair). Rebuilt on the CPU every frame |
| **Square / stepped trace** | `createPulseTrain(o: PulseTrainOptions): PulseTrain` (`extras.ts:120`): `wave: Waveform`, `length` (4), `height` (0.6), `cycles` (1), `frequency` (0.25), `color`, `width`; fields `phase`, `wave`, `frequency`. Capacity 1400 points | Analytic `Waveform = (theta: number) => number` only, not sample buffers |
| **Waveform maths** | `sine(phase)`, `square(duty)`, `triangle()`, `sawtooth()`, `rectified(half)`, `harmonics(amplitudes, phases)`, `spwm(m, ratio)`, `threePhase(k)`; `rms(wave, n)`, `mean`, `spectrum(wave, count, n = 4096): number[]`, `thd` (`fx/signals/waveforms.ts`) | `spectrum` is a harmonic Fourier series of a periodic `Waveform`, not an FFT of samples |
| **Spectrum humps / field-strength column** | `createSpectrumBars(o: SpectrumBarsOptions): SpectrumBars` (`extras.ts:172`): `count` (required), `width` (3), `height` (1.5), `color` (`sky`), `fundamental` (`yellow` — colour of bar 0), `response` (8 1/s); `set(values: ArrayLike<number>)` (clamped 0…1). Instanced boxes on local XZ, 1 draw call. Alternatives: `Chart` from `@/ui3d` (`ui3d/charts/chart.ts:89`): `new Chart({ height, x: AxisSpec, y, y2?, series: SeriesSpec[], window?, legend?, onScrub? })`, series `kind: 'line' \| 'area' \| 'bars' \| 'step'`, `{ log: true }` axes, `setData(id, xs, ys)`, `push(id, x, y)`, `clearData`, `setAxis`, `setMarker` | Bars: no axis, no labels, bar 0 is specially coloured. `Chart` is a HUD widget (dock / board through `stepUi`, or in the world through `worldSurface` / `worldConsole`); `setData` copies with `Array.from` on every call (`chart.ts:134-135`) |
| **Rotating arrow + shadows (later chapters; sandbox prototype of `arrow` in batch 3)** | `createPhasors(o: PhasorsOptions = {}): Phasors` (`fx/signals/phasors.ts:124`): `size` (2.4), `phasors: PhasorSpec[]` (`color`, `amplitude`, `phase`), `frequency` (0.5), `projection` (true), `accent`; `set(i, amplitude, phase)`, `value(i)`, `angle`, `frequency`, `frozen`. HUD twin: `PhasorScope` from `@/ui3d` | Projects onto the vertical axis only (one shadow); the design needs two (I and Q, design l.317) and a constellation plane → new part |
| **Arrows / vectors (field pointer of the probe)** | `createVectorArrow(o: VectorArrowOptions = {}): VectorArrow` (`fx/fields/arrows.ts:91`): `color` (white), `radius` (0.035), `headLength` (0.24), `headRadius` (0.1), `intensity` (1.25); `set(origin, vector)`, `tip: Object3D`, `setColor`. Uses `K.glow({ whiten: 0, keepHue: true })`. `createArrowField(field, { points, color = 'amber', length = 0.5, reference, magnitudeScale = 0.6, intensity })`, `sample(field)`, `gridPoints(center, size, counts)` | — |
| **Field lines / field maths** | `createFieldLines(o: FieldLinesOptions): FieldLines` (`fx/fields/lines.ts:90`): `field: VectorField`, `seeds`, `kind: 'E' \| 'B'` (amber / magenta from `SEMANTIC.fieldE/fieldB`), `color`, `trace: StreamlineOptions`, `magnitudeContrast` (0.5), `capacity`; `refresh(field?, seeds?)`, `lines`, `reveal`. Fields: `pointChargesField`, `pointChargesPotential`, `barMagnetField`, `dipoleField`, `straightWireField`, `currentLoopField`, `solenoidField`, `uniformField`, `superpose`; `type VectorField = (p, out) => out` (`fx/fields/sources.ts`); `streamline`, `streamlines`, `seedsOnSphere/Ring/Line`; `createPotentialSurface`, `contourLines` + `createEquipotentials`, `createFluxSurface` | All static-field tools. Nothing for a radiating / time-dependent field (kink of a jerked charge, travelling wave fronts, field slice) — the four «радіозір» views (design l.735) are new |
| **Wave fronts / rings / halos** | `createPulseRings(o: GlowOptions = {})` (`fx/drama/glows.ts:152`; source comment l.5: «rings … (affordance ping, radio waves, ripples)»), `createHalo`, `createCorona`, `createFlash`. `GlowOptions`: `color`, `size` (1), `intensity` (1.5), `billboard` (true), `amount`, `speed`, `depthTest`. `createBeam({ from, to, color, width, intensity, speed, ripple })` + `reach`; `createLightShaft({ length, radiusTop, radiusBottom, color, intensity })`; `createPhotons(…)` | Rings are a decorative, seamless loop of equal rings: no wavelength, no attenuation, no shadowing by walls |
| **Particles / instancing** | `createParticles(env: FxEnv, opts: ParticleOptions): ParticleSystem` (`fx/particles/system.ts:555`; GPU-simulated, 1 draw call; `count` is nominal at `high` and follows the tier); `createProbabilityCloud(opts: CloudOptions)` (`capacity`, `color`, `flash`, `size`, `lifetime`, `intensity`; `fill` / `sync`); `createOrbs`, `createGas`, `createFlow`, `createMeshFlow`; `createTrail(target, o)`. Kit: `instanced(model: KitModel, placements: readonly Placement[]): Group` (`kit/core/instancing.ts:13`), `b.geometry(slot)` for own `InstancedMesh`; scatter builders `forest`, `trees`, `groundCover`, `people`, `birds` | — |
| **Labels and captions in 3D** | `new Text3D(text = '', style: TextStyle = {})`, `measureText(text, style)` from `@/text` (§4). In-scene annotations through `stepUi(ctx).define({ step: { callouts, hotspots } })` (UI_API §5). `worldLabelSize(cssPxPerUnit, size = UI.text.small)` from `@/ui3d` | See §4 for sizes, wrapping and the two renderers |
| **Panels / consoles in the world** | `worldSurface(ctx, { width, height, unit, mode?: 'overlay' \| 'scene', name? }): UiSurface`, `worldConsole(ctx, { title?, width = 420, children, unit, minPx = 16, maxGrow = 3, billboard = true, mode?, name? }): WorldConsole` (`ui3d/host.ts:51`, `ui3d/console.ts:74`); `hudSurface(ctx, name)`; `K.hologram({ size, … })` | Widgets only (text, charts, controls). On phones a console's panel is moved into the sheet (UI_API §15) |
| **Anything that shows a texture on a device** | Only `HeatMap` from `@/ui3d` (`ui3d/charts/heatmap.ts`): a static `DataTexture` on a quad inside a HUD surface | Nothing for a live image on a world mesh — see §2 |
| **Glow / bloom / post** | Emissive via `K.glow`, `K.toon({ emissive, emissiveIntensity, keepHue })`, `Text3D.intensity`, kit slots `window` / `lamp` / `glow`. Post per chapter `ctx.post.base({...})`, per step `stage.define({ step: { post: {...} } })`; `PostParams` in `engine/pipeline/post-params.ts:5-66`, defaults `POST_BASE` (l.71-100), moods `POST_MOODS` | Bloom only above 1.0 (§2.3) |
| **Environment / sky / backdrop** | `ctx.env` (`Environment`, `style/env/environment.ts:100`): `set(preset, { duration, ease, overrides })`, `tune(overrides, opts)`, `base(overrides)`, `setScale(scale, { adaptFrom })`, `setShadow({ extent, center, softness })`, `fitShadow(object, padding = 1.1, softness = 3)`, `setGrounding`. `EnvPresetName = 'micro' \| 'studio' \| 'day' \| 'golden' \| 'dusk' \| 'night'` (`presets.ts:81`); `envPreset(name, overrides)`, `envKind`, `LOOK_SCALE = { studio: 3.4, micro: 6, diorama: 11 }` exported from `@/style`. Kit backdrop: `clouds(o)`, `sunDisc(o)`, `moonDisc({ radius, phase })`, `hills(o)`, `forest(o)` / `trees(spots, o)`, `groundCover(o)`, `road(o)`, `birds(o)` | "Twilight as a numeric parameter" (design l.750): `set()` only blends over time between presets of one kind; a continuous dial means computing `EnvOverrides` yourself and calling `tune(…, { duration: 0 })` (precedent: `volumes/circuit/shared/copper/look.ts` `copperEnv(lamp, group): EnvOverrides`) |
| **"Where are we" miniature** | Engine's own: `floorLadder(ctx, { floor: () => string \| null }): FloorLadder` (`hud-dom/journey/ladder.ts:25`; DOM only, hidden on touch shells) and `journeyInset(ctx, opts): CustomSpec` (`hud-dom/journey/inset.ts:102`) (UI_API §11a) | The design wants its own instrument (yard plan + route slider + "move antenna" slider + depth mark; in the dock on phones — l.201, l.759). Nothing ready; it is a `custom` step-UI control (`node` + `dom`, UI_API §8) or scene objects |

### 1.2 Conventions every part above shares

| Rule | Source |
|---|---|
| fx effects self-tick from `kGlobals.uKTime` inside `updateMatrixWorld` (`onTick`), once per engine-time value and only while visible; only controllers (`Spin`, `Vibration`) need `fx.update(dt, t)` | `fx/core/tick.ts:25-37`, FX_API §0 |
| fx sizes are world units tuned for a subject of ≈ 3-6 units; «In a metre-scale scene … pass every size explicitly — nothing in `@/fx` follows `lookScale`» | FX_API l.40-46 |
| `intensity` > ~1.2 blooms; semantic hues need `keepHue` / `whiten: 0` | FX_API l.27-33 |
| Custom additive shaders: `gl_FragColor = vec4(rgb, 0.0)` with `blending: AdditiveBlending, premultipliedAlpha: true` | FX_API l.47-49 |
| Disposal is automatic for everything under `ctx.root` incl. shader-uniform textures; `ctx.track(x)` for things outside the graph (render targets); engine-lifetime shared resources are marked `userData.shared = true` | ENGINE_API §13 l.434-444, `text/fonts.ts:199` |
| A kit model costs one draw call per slot used + one per `part()`, doubled by the shadow pass | KIT_API l.453-455 |
| «No text on models (nameplates are anchors: `nameplate`, `display`) — text belongs to chapters' `content.ts`» | KIT_API l.468 |
| Missing effects: «request it in `docs/requests/<your-id>.md` rather than building a look-alike» | FX_API l.422-423 (directory does not exist here) |

---

## 2. Showing a computed image on a screen mesh

### 2.1 Is there an existing part?

**No.** Search of `app/src` for `DataTexture | CanvasTexture | WebGLRenderTarget | VideoTexture | DataArrayTexture`:

| Where | What | Format / filters / colour space | Updated at run time? |
|---|---|---|---|
| `ui3d/charts/heatmap.ts:86-97` | `new DataTexture(data, nx, ny, RGBAFormat, UnsignedByteType)` on a 1 × 1 `PlaneGeometry` with a raw `ShaderMaterial` (`gl_FragColor = vec4( texture2D( tMap, vUv ).rgb, uOpacity )`, `transparent: true, depthTest: false, depthWrite: false`), placed by a `MeshNode` inside a `UiSurface` | `colorSpace = SRGBColorSpace`, `magFilter = minFilter = LinearFilter`; the ramp colours are converted with `col(c).convertLinearToSRGB()` before being written as bytes (l.73-75) | No — built once in the constructor |
| `fx/flow/pathset.ts:106-112` | path lookup `DataTexture(data, w, h, RGBAFormat, FloatType)` | `NearestFilter` both, `generateMipmaps = false` | Yes: `this.texture.needsUpdate = true` in `setPaths` etc. (l.69-97) |
| `ui3d/core/batch.ts:76-82` | node-transform `DataTexture(…, RGBAFormat, FloatType)` | `NearestFilter`, no mipmaps | Yes, only when something changed: `if (changed) this.xform.texture.needsUpdate = true` (`ui3d/core/surface.ts:571`) |
| `ui3d/core/icons.ts:314-320` | icon SDF atlas `DataTexture(data, w, h, RedFormat, UnsignedByteType)` | `LinearFilter`, no mipmaps | No |
| `text/fonts.ts:192-200` | glyph atlas `DataArrayTexture`, `RedFormat`, `UnsignedByteType` | `LinearMipmapLinearFilter` / `LinearFilter`, mipmaps, `unpackAlignment = 1`, `userData.shared = true` | No |
| `volumes/circuit/chapters/charge/parts/glyphs.ts:20-39,54-59` | 64 × 64 `CanvasTexture` (`anisotropy = 4`) on `MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })`, instanced quads on the overlay layer (`toOverlay`) | default colour space | No |
| `volumes/circuit/chapters/charge/parts/spheres.ts:34-45` | `softShadow()` radial-gradient `CanvasTexture` | default | No |
| `engine/pipeline/pipeline.ts`, `engine/quality.ts:204` | `WebGLRenderTarget`s of the post stack and of the GPU benchmark | `HalfFloatType`, `LinearFilter`, no mipmaps (`pipeline.ts:121-141`) | engine only |

No `VideoTexture` anywhere. No chapter, kit or fx code renders into a render target or reads pixels back. The only
read-back in the repository is the benchmark: `renderer.getRenderTarget()` → `setRenderTarget(target)` →
`renderer.render(scene, camera)` → `renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel)` →
`setRenderTarget(previous)` (`engine/quality.ts:226-236`).

### 2.2 How emissive screens are done elsewhere

| Screen | Technique | Location |
|---|---|---|
| TV, monitor, laptop in the kit | a box in the `window` slot with a per-vertex night colour `glow: SCREEN_GLOW`; lights up with `model.night` (`MatSet.applyNight`: `vertexEmissiveIntensity = v * 1.45`) | `kit/home/furniture.ts:59-76`, `kit/core/builder.ts:207-213`; KIT_API l.59-65 |
| Inverter display | `K.glow({ color: 'teal', core: 'teal.light', intensity: 1.5, falloff: 0 })` bar on dark glass; LEDs `K.glow({ whiten: 0, keepHue: true, intensity: 1.7 })` | `kit/energy/inverter.ts:37-55` |
| Oscilloscope / phasor plate | procedural `ShaderMaterial` (`fx.screen`) + `RibbonLines` traces floating 0.02 above it, `renderOrder = 2 + i` | `fx/signals/screen.ts`, `fx/signals/scope.ts:65-67` |
| Level tube | glowing fill 0…1 | `levelTube(…)`, KIT_API l.176 |
| Panels with widgets | `UiSurface` (`worldSurface` / `worldConsole`), SDF text and shapes batched | `ui3d/host.ts`, `ui3d/console.ts` |

### 2.3 Colour space, tone mapping, bloom, filtering — what the code and docs say

| Fact | Source |
|---|---|
| The renderer is created with `antialias: false, alpha: false, depth: false, stencil: false`; no `toneMapping` and no `outputColorSpace` is set anywhere in `app/src/engine` (three defaults) | `engine/app.ts:226-233` |
| The world is rendered into `HalfFloatType` targets: «linear HDR until the last pass» | `pipeline.ts:121-141`, ENGINE_API l.334 |
| The final pass does the sRGB encode itself (`toSRGB`) after: bloom add → `× uExposure` → overflow bleed → clamp → grade → mood grade → vignette → grain | `engine/pipeline/shaders.ts:322-403` |
| «Values ≤ 1 are passed through the display transform unchanged (no filmic curve)»; above 1: `color = mix( color, vec3( peak ), 1.0 - exp( -max( peak - 1.0, 0.0 ) * 0.7 ) )` then clamp — bleed toward white | ENGINE_API l.334-336, `shaders.ts:361-364` |
| Bloom bright-pass: «nothing ≤ threshold (i.e. no lit surface, no palette colour) contributes — only emissive pixels do»; defaults `bloomThreshold: 1.0`, `bloomKnee: 0.25`, `bloomIntensity: 0.9` (diorama mood 0.85). A screen whose white is exactly 1.0 does not bloom | `shaders.ts:262-270`, `post-params.ts:71-100,126-135` |
| Grade defaults that touch every pixel, a grey screen included: `gradeLift: 0.012` (shadows lifted toward `(0.42, 0.3, 1.0)` by `lift · (1 − luma)^4`), `gradeContrast: 0.05`, `gradeVibrance: 0.06`, `vignette: 0.42` toward `(0.16, 0.13, 0.42)` | `post-params.ts:91-97`, `pipeline.ts` uniforms (`uLiftColor`, `uVignetteColor`), `shaders.ts:366-398` |
| **Animated film grain on every frame**: `grain: 0.022` (display space), `n = hash( gl_FragCoord.xy + fract( uGrain.y * 7.123 ) * 311.7 ) - 0.5; g += n * uGrain.x * mix( 1.0, 0.45, l )` — strongest in dark areas; `uGrain.y` = engine time, so it stands still under `?freeze`. `grain` is a tweenable `PostParam` (per chapter / per step) | `post-params.ts:62-63,98`, `shaders.ts:399-401`, `pipeline.ts:518` |
| **Mood grade of evening presets**: `dusk` has `gradeTint (0.97, 0.88, 1)` with `gradeTintAmount 0.5`, `harmonyColor mix('magenta','violet',0.55)`, `harmony 0.58`, `accentColor 'yellow'`; `night` has `harmonyColor mix('blue','violet',0.4)`, `harmony 0.35`, `accentColor 'yellow'`, no tint. «hues that are not analogous to `harmonyColor` are desaturated and partly rotated toward it … greens turn olive, blues slate — while `accentColor` hues are left alone. All zero for `day`, `studio`, `micro`, where palette tokens must land exactly». All five fields are `EnvOverrides` | `style/env/presets.ts:67-78,231-241,265-273,314-316,335-340`, `shaders.ts:373-391`, ENGINE_API l.618-622 |
| Depth of field / tilt-shift: diorama mood has `tiltAmount: 0.4`, `dofAperture: 1.0`, `dofRange: 2.5`. Objects on `OVERLAY_LAYER` (`toOverlay(obj)`) are «drawn after depth of field (and after ambient occlusion), on top of the world … never occluded by scene geometry». «Transparent, non-depth-writing objects … take the depth of what is behind them for DOF» | `post-params.ts:126-135`, `engine/layers.ts:1-21`, ENGINE_API l.337-338 |
| Anti-aliasing: MSAA 0/2/4/4 by tier + FXAA on all tiers («sub-pixel blending toned down to keep SDF text crisp»); `mobile`: MSAA 0, FXAA only | `engine/quality.ts:67-158`, `shaders.ts:408-409` |
| Render resolution is not the CSS size: DPR cap 1 / 1.25 / 1.5 / 2 by tier, `mobile` `maxDpr 2` × pixel budget (phone 1.0e6 px, tablet 2.0e6 px) × dynamic resolution | ENGINE_API l.517-520, l.815-821; `engine/device.ts:70` |
| three 0.187 `DataTexture` defaults: `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`, `flipY = false`, `unpackAlignment = 1` | `app/node_modules/three/src/textures/DataTexture.js` |
| three 0.187: an sRGB-tagged texture must be `RGBAFormat` + `UnsignedByteType`, otherwise it logs `WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.` — a console warning, which fails `chapter-check` | `app/node_modules/three/src/renderers/webgl/WebGLTextures.js:2490-2510`; ENGINE_API l.579-581 |
| `chapter-check` leak gate: after leaving and returning ×3, `geometries`, `textures`, `programs` of `__app.stats()` must not grow | `tools/qa/chapter-check.mjs:264-291` |
| STYLE_GUIDE on the subject: «Bloom is seasoning: emissive elements glow; white surfaces must not blow out»; «no photo textures»; §8 «No z-fighting, shadow acne, banding, bloom blow-out, aliasing shimmer». ARCHITECTURE §1: «Small generated lookup textures (ramps, noise) are fine» | STYLE_GUIDE l.15-16, l.129, l.185; ARCHITECTURE l.20-21 |
| K lighting: `colour = base × light`, lit results are clamped to 1; a screen cannot light the kitchen by being emissive — «Extra `PointLight`s work (same cel banding) — keep them few … and keep them in the scene permanently (tween `intensity`, do not toggle `visible`: that recompiles programs)» | ENGINE_API l.273-278 |

### 2.4 Frame order facts that matter for the camera-eye pass

| Fact | Source |
|---|---|
| Per frame: `this.update(…)` (chapter `update` hooks) → `this.pipeline.render(…)` → stats read `renderer.info.render` | `engine/app.ts:596-613` |
| `pipeline.render` starts with `r.info.reset()`; the pipeline sets `renderer.autoClear = false` and `renderer.info.autoReset = false` once | `pipeline.ts:253-254,334` |
| Consequence: a `renderer.render()` issued from a chapter `update()` is reset away before the frame's stats are taken, so it is **not** in `__app.stats().drawCalls / triangles` (the 350 / 1.5 M gates) | same lines |
| `ChapterContext.renderer`: «capabilities / render targets only; never call `render()`»; «do not touch `renderer` state» | ENGINE_API l.159, l.602-603 |
| Objects with `onBeforeRender` react to whichever camera / target renders them: `Text3D` rewrites `matrixWorld` for `billboard` / `screenSpace` (`text/text3d.ts:338-371`), `RibbonLines` reads the target height (`ribbon.ts:197-200`); `onTick` effects tick on the first `updateMatrixWorld` of an engine-time value | `fx/core/tick.ts:25-37` |
| Layers: `WORLD_LAYER = 0`, `OVERLAY_LAYER = 1` | `engine/layers.ts:11-12` |

---

## 3. Semantic colours

### 3.1 Palette (`app/src/style/palette.ts:10-49`, STYLE_GUIDE §2.1)

| Group | Tokens → hex |
|---|---|
| Backgrounds | `bg.void #070A1F`, `bg.deep #0D1136`, `bg.indigo #1A1657`, `bg.violet #2E1F7A`, `bg.plum #4A2A8F` |
| Accents | `cyan #2DE2E6`, `teal #1CC8A5`, `green #7BE36B`, `lime #C6F24E`, `yellow #FFD23F`, `amber #FFB02E`, `orange #FF8A3D`, `coral #FF5E5B`, `red #F0355C`, `pink #FF6FB5`, `magenta #E34BD0`, `violet #8E5CF7`, `blue #3D7BFF`, `sky #6EC6FF` |
| Neutrals | `white #F6F3FF`, `mist #C9C6EA`, `steel #8D8FB8`, `slate #4B4F7A`, `ink #1B1D3A` |
| Standards | `wireBrown #B5651D`, `wireGreen #3FB950` |
| Variants | `<accent\|neutral>.light` (+18 % L, −8 % S), `.dark` (hue ≤ 12° toward violet, L × 0.7) — `lightVariant`, `darkVariant` (l.121-136) |
| Alias groups | `ui.ok` = green, `ui.warning` = amber, `ui.alarm` = red, `ui.info` = sky (`UI_STATUS`, l.75); `flow.active` = yellow, `flow.reactive` = sky (`FLOW`, l.81); `plantType.*` (`PLANT_TYPE`, l.56-72) |

### 3.2 Global core (STYLE_GUIDE §2.2.1, l.49-58) — binding in every volume

| Meaning | Colour |
|---|---|
| Interactive affordance | `cyan` outline / glow + cursor change; selected = `yellow` |
| Safe / OK / efficiency | `green` |
| Warning / caution state | `amber` (token `ui.warning`) |
| Danger / fault / loss | `red` (pulsing) |
| Heat | `orange` → `red`; hot steam `white` + `pink` |
| Cold / water / coolant | `blue` / `sky`; wet steam / vapour `white` / `mist` |

Rule (l.43-47): «A volume's table adds meanings; it never redefines the core, and a token that the core uses for a
state (cyan = "you can touch this", green / amber / red = ok / caution / alarm) keeps that meaning wherever it is used
as a state signal.»

### 3.3 Already taken by volume 1 (STYLE_GUIDE §2.2.2, l.60-87) and in code (`SEMANTIC`, `palette.ts:189-249`)

| Meaning | Token(s) | `SEMANTIC` key |
|---|---|---|
| Electron / negative charge | `cyan` | `electron`, `negative` |
| Proton / positive charge / hole | `coral` | `proton`, `positive`, `hole` |
| Neutron | `mist` → `steel` | `neutron`, `neutronShade` |
| Quarks u / d, gluon | `amber` / `violet` / `lime` | `quarkUp`, `quarkDown`, `gluon` |
| Photon / light | `yellow` → white | `photon` |
| **Electric field E** | `amber` | `fieldE` |
| **Magnetic field B** | `magenta` | `fieldB` |
| **Current / energy flow** | `yellow` pulses | `current`, `energyFlow` |
| Voltage / potential | ramp `blue` → `pink` → `coral` | `voltageLow/Mid/High`, `voltageRamp(t)` |
| Heat / cold / water / vapour | `orange`, `red`, `pink.light`, `blue`, `sky`, `mist` | `heat`, `heatHot`, `steamHot`, `cold`, `water`, `coolant`, `vapour` |
| Phases L1 / L2 / L3 | `yellow` / `green` / `red` | `phaseL1…L3` |
| Home wiring L / N / PE | `wireBrown` / `blue` / `wireGreen` + `yellow` | `wireL`, `wireN`, `wirePE`, `wirePEStripe` |
| Li⁺ | `lime` | `lithiumIon` |
| Magnet poles N / S, DC + / − | `coral` / `blue` | `poleN/S`, `dcPlus/Minus` |
| Reactive current | `sky` dashed | `reactive` |
| Doping n / p | `teal` / `pink` | `donor`, `nRegion`, `acceptor`, `pRegion` |
| Bands | `violet` / `sky` / `bg.deep` | `valenceBand`, `conductionBand`, `bandGap` |
| Nuclear | `violet`; glow `sky` → `white` | `nuclear`, `radioactivity`, `coreGlow`, `coreGlowHot` |
| States | `red`, `green`, `cyan`, `yellow`, `ui.warning`, `ui.ok`, `ui.alarm` | `danger`, `safe`, `affordance`, `selected`, `warning`, `ok`, `alarm` |

fx defaults follow this table (FX_API l.24-26): electron `cyan`, E `amber`, B `magenta`, current `yellow`, phases
yellow / green / red. Concretely: `createScope` default channels are the three phases, `createWaveOnCurve` and
`createPulseTrain` default to `SEMANTIC.current` (yellow), `createSpectrumBars` to `sky` with a `yellow` first bar,
`createArrowField` to `amber`, `createBeam` to `SEMANTIC.photon`.

### 3.4 How a volume adds its own table

| Source | Text |
|---|---|
| STYLE_GUIDE l.89-90 | «A new volume writes its own table as §2.2.3, §2.2.4 … (and, where chapters need tokens for it, a token group in `app/src/style` next to `SEMANTIC`) when its curriculum is reconciled — see `docs/VOLUMES.md` §4.» |
| VOLUMES §4 step 1, l.121 | «STYLE_GUIDE §2.2: reserve the volume's semantic table (filled in at step 4).» |
| VOLUMES §4 step 4, l.130-131 | the reconciliation agent «writes … its semantic colour table into STYLE_GUIDE §2.2.x» |
| VOLUMES §4 step 6, l.140-142 | semantic tokens are «requested from the platform owners …; nothing volume-specific goes into `app/src/{engine,hud,…}`» |
| Precedent, volume `circuit` | its table lives in `docs/volumes/circuit/VISUAL.md` §4 «Смислові кольори тому (пропозиція для STYLE_GUIDE §2.2.3)» (l.138-157). STYLE_GUIDE has **no** §2.2.3; `SEMANTIC` has no circuit keys; circuit code reuses `SEMANTIC.dcPlus`, `.dcMinus`, `.fieldE` (`volumes/circuit/shared/stage/{mounts,wires}.ts`, `tools/gauge.ts`) and keeps look helpers in `volumes/circuit/shared/{stage/materials.ts, copper/look.ts, world/look.ts}` |
| Old radio plan | `docs/volumes/radio/VOLUME.md` §6 «Смислові кольори тому» (l.282-310): E `amber` (trough `amber.dark`), B `magenta`, energy flow / current in antenna `yellow`, message / bits `lime`, carrier `sky`, I / Q `sky` / `violet`, check bits `teal`, noise `mist` → `steel` grain, interference `red`, level ramp `bg.deep` → `blue` → `sky` → `yellow` → `white` |

### 3.5 The design's radio colours against what is taken

Design l.205 and l.757: «E — `amber`, B — `magenta`, несна — `sky`, тіні — `sky`/`violet`, біти — `lime`, шум — зерно `steel`»; volume accent `sky` (l.621).

| Radio meaning | Token | Status |
|---|---|---|
| Electric field | `amber` | same as volume 1 (`SEMANTIC.fieldE`); `amber` is also the core's warning state |
| Magnetic field | `magenta` | same as volume 1 (`SEMANTIC.fieldB`) |
| Carrier | `sky` | new meaning; `sky` is in the core for cold / water and is `ui.info`, `flow.reactive`, `SEMANTIC.conductionBand`, `.coreGlow` |
| Shadows I / Q | `sky` / `violet` | new; I shares the carrier's token; `violet` = nuclear / down quark in volume 1 |
| Bits | `lime` | new; `lime` = gluon, Li⁺, `plantType.bess` |
| Noise | `steel` grain | neutral; the old plan says `mist` → `steel` |
| Not named in the design | electron (`cyan` in vol. 1), current in the antenna (`yellow` in vol. 1 and in the old plan), interference (`red` in the old plan) | — |

`chapter-check` colour gate that the «радіозір» palette meets: a deep-link frame fails with more than `--max-hues`
(default 4) "strong hue families" — pixels with saturation ≥ 0.35 and value ≥ 0.3 sorted into six 60° families
(`red`, `yellow`, `green`, `cyan`, `blue`, `magenta`), a family counts at ≥ 8 % of them
(`tools/qa/lib.mjs:214-245`, `tools/qa/chapter-check.mjs:96,188-191`).

---

## 4. Text and fonts

### 4.1 Two renderers

| Text | Renderer today | Source |
|---|---|---|
| Step panel, dock, board, header, navigator, glossary, callouts, hotspot markers and cards, tooltips | **DOM** — `export const DEFAULT_HUD: HudRenderer = 'dom'` (`app/src/engine/app.ts:53`); `?hud=gl` switches back to the WebGL HUD | DECISIONS §59 j (l.287-290): «callouts, hotspot markers and cards, journey-map labels and 3D tooltips become DOM, projected per frame; `Text3D` and world consoles stay WebGL; `hudSurface` is replaced by a DOM `hudLayer`» |
| `Text3D` in the scene, `worldSurface` / `worldConsole`, fx / kit | WebGL SDF | `text/text3d.ts`, `ui3d/*` |
| A `custom` step-UI control | needs `dom: (host) => ({ el, update?, dispose? })` next to `node`; a node without `dom` «is drawn by the WebGL fallback with one warning (D9 makes that a `chapter-check` failure)» | UI_API l.349-354 |

### 4.2 3D text API (`@/text`)

SDF atlases, not MSDF: one 8-bit greyscale PNG per face → one R8 `DataArrayTexture` (`text/fonts.ts:1-6,192-200`); built
offline, «no runtime glyph generation». Atlas: `em 48`, `range 12`, 2048 × 704, 4 layers, 641 glyphs per face
(`app/public/fonts/fonts.json`, read in this run). Faces (`FaceId`): `display` (Nunito 800, fallback Fira Sans 700),
`body` (Fira Sans 400), `bodyBold` (Fira Sans 600), `mono` (JetBrains Mono 500, fallback Fira Sans 500); symbol
fallbacks Noto Sans Math and Noto Sans Symbols 2 (`app/scripts/build-fonts.mjs:36-75`).

```ts
// app/src/text/text3d.ts
export class Text3D extends Mesh<BufferGeometry, ShaderMaterial> {
  constructor(text = '', style: TextStyle = {})
  text: string            // setter re-lays out lazily
  set(style: Partial<TextStyle>): this
  color: ColorLike;  setColor(value: ColorLike): this
  readonly fontSize: number;  readonly screenSpace: boolean
  readonly metrics: TextMetrics      // width, height, lineCount, lineHeight, baseline, left, bottom, right, top, lineWidths, spans
  opacity: number;  fade: number;  intensity: number
  sync(): void;  dispose(): void
}
export function measureText(text: string, style: LayoutOptions = {}): TextMetrics
export const textViewport = { cssHeight: 1080, pxPerUnit: 1 }
// TextStyle extends LayoutOptions: color ('white'), accent ('cyan'), formulaColor ('yellow'), opacity, intensity (>1 blooms),
//   outline { width ≤ 0.1 em, color }, halo { radius ≤ 0.12 em, color, opacity } | false, minScreenPx (16), weight (±0.03 em),
//   billboard, screenSpace, depthTest (true), depthWrite (true)
// LayoutOptions (text/layout.ts:12-30): font ('body'), size (1), maxWidth, align ('left'), lineHeight (1.4),
//   letterSpacing, anchorX ('left'), anchorY ('top' | 'middle' | 'bottom' | 'baseline'), rich (true)
```

| Topic | Fact | Source |
|---|---|---|
| Wrapping | Only with `maxWidth`; greedy; breaks after a space, a zero-width space (U+200B) or a hyphen between two letters; `\n` forces a line; a space between a number and a unit becomes U+00A0 automatically (`bindUnits`); short `` `formulas` `` (≤ 28 chars, `NOWRAP_FORMULA`) never wrap in the `richRuns` pipeline | `text/layout.ts:179-232`, `text/rich.ts:84-90`, `text/markup.ts:20-35` |
| Maximum length | none in `Text3D` (the glyph buffer grows ×1.5; index switches to `Uint32` above 65 535 vertices) | `text3d.ts:263-283` |
| Markup | `**term**`, `_emphasis_`, `` `formula` ``, `x^2`, `10^{-19}`, `U_{rms}`, `{token:text}`, `\*` escapes; Unicode super / subscripts are routed through the script style | `text/rich.ts:1-15` |
| Character substitutions | U+2011 → `-`, `℃` → `°C`, Ohm sign U+2126 → `Ω`, tab → two spaces | `text/rich.ts:93-100` |
| Missing glyph | logged once per code point: `` `text: no glyph for U+XXXX '<ch>' — add it to scripts/build-fonts.mjs` `` and `?` is drawn; a console warning fails `chapter-check` | `text/layout.ts:146-153` |
| Fonts not loaded | `fontData()` throws `text: fonts are not loaded yet (await loadFonts() first)`; unit tests install metrics with `setFontData(json)`; `fontAtlas()` is null there | `text/fonts.ts:122-140` |
| World labels | `billboard: true` + `screenSpace: true` (size in px-eq, constant on screen, dark halo by default, never below `minScreenPx` = 16 CSS px per em) and `toOverlay(obj)` so DOF never blurs them | ENGINE_API l.376-379, l.647-648; `text3d.ts:355-369,418` |
| Size gates | `chapter-check` fails world `Text3D` under `--min-text` (16) px-eq at 1280 × 720 (`__app.textSizes()`); SDF magnification > 4× the atlas is a warning; interface text under `UI.text.caption` (15 units = 10.5 CSS px at 1280 × 720) fails; touch profiles: `MIN_TEXT_PX = 14` CSS px (world text under it is a warning) | ENGINE_API l.721-726, UI_API l.490-492, `tools/qa/mobile-parts.mjs:19-20` |
| Type scale | STYLE_GUIDE §6 (px-eq at 1080p): hero 56-72, H1 34-40, H2 24-28, body 18-20, caption 14-15 «(never smaller)». Tokens `UI.text = { hero: 66, h1: 36, h2: 26, h3: 21, body: 19, small: 17, caption: 15 }`, `UI.minWorldLabelPx = 16`, `UI.hit = 44` | STYLE_GUIDE l.156-160, `ui3d/theme.ts:16-35` |
| Length rules | «Line length ≤ 46 characters in side panels»; «a step's side panel shows ≤ ~450 characters per page»; manifest blurb ≤ 140 chars; circuit's frame checklist: «≤ 3 підписи в сцені; ≤ 80 слів у панелі» | STYLE_GUIDE l.158-165, UI_API l.60, `docs/volumes/circuit/VISUAL.md:450` |
| Callouts | declared per step: `CalloutSpec { anchor, text: string \| (() => string), color?, side?, occluders?, visible?, priority? }` (`hud/step-ui-types.ts:203-220`); the WebGL `Callout` is one line (`nowrap: true`, `bodyBold`, `ui3d/anchors/callout.ts:30`); phones show the 3, tablets the 5 most important | UI_API §5, §15 |
| Where caption wording lives | «Scene labels that are not in the document (callouts, button captions) go into `labels`» of `defineContent(raw, { labels })`; labels quoted «…» in a document's interaction text are exported as `steps[].labels` — «do not retype or invent wording» | UI_API l.53-55 |
| Mobile rule | «Text in the 3D world is limited to short labels; consoles/cards in the world use the world-console preset … never hand-built text panels» | DECISIONS §57 a (l.189-191) |
| Advice in the docs | «don't use `Text3D` for labels that must stay legible (use callouts)» | UI_API l.506-507 |

### 4.3 Glyph coverage rule and its check

| Item | Fact |
|---|---|
| Command | `pnpm fonts:check` = `node scripts/font-coverage.mjs` (run from `app/`; `app/package.json:15`). Options `--list` (print every non-ASCII character in use), `--volume <id>` |
| What it scans | **only** `docs/volumes/<volume>/chapters/_export/*.json`, on-screen fields listed in `FIELDS` (`font-coverage.mjs:32-64`; includes the path-format fields `{hook,know,bridge}`, `now.*`, `next.title`, `steps.*.{idea,text,action,takeaway}`, `steps.*.more.*`, `steps.*.recall.*.title`, `steps.*.terms.*.{name,card}`, `glossary.*.{name,card}`) plus labels quoted «…» in `steps[].interaction.items[].text` (l.81-86) |
| What it requires | every used character has a glyph in **every** face of `app/public/fonts/fonts.json` **and** in every DOM font stack of `WEB_STACKS` (`app/scripts/webfaces.mjs:38-46`; symbol faces count only inside `SYMBOL_RANGES`); also that `app/src/hud-dom/core/fonts.ts` registers the same files and the same `SYMBOL_RANGE` string |
| Output on failure | `  MISSING U+XXXX '<ch>' in <faces> — used in <chapters>`, `FAIL: <n> missing`, `FAIL: <n> problems with the web fonts`; exit 1 |
| What it does **not** scan | strings written in code (`content.ts` `labels`, `Text3D` literals, `volume.json`) — those are caught only at run time by the `text: no glyph …` warning |
| Part of | `doccheck.py` check 12 «fonts» (`tools/content/doccheck.py:27`) |

### 4.4 Adding glyphs

1. Add the code point to `charset()` in `app/scripts/charset.mjs` (shared by both builders; if no bundled font has it,
   add a composition to `SYNTH`).
2. `pnpm fonts` (`node scripts/build-fonts.mjs`) → `app/public/fonts/<face>.png` + `fonts.json`. Dev dependencies
   `fontkit 3.0.0`, `pngjs 7.0.0`, `@expo-google-fonts/*`. The script prints per face
   `<id>: <n> glyphs (<k> from fallback fonts), … packed height <h>` and `, MISSING: U+…` when no source has a glyph.
3. `pnpm webfonts` (`node scripts/build-webfonts.mjs`) → `app/public/fonts/web/<face>.woff2`. Needs
   «Python 3 with fontTools ≥ 4.40 and brotli (`pip install fonttools brotli`)»; on failure it prints
   `build-webfonts needs Python 3 with fontTools and brotli (see the header of this script).`
4. `pnpm fonts:check`.

These are platform files (`app/scripts`, `app/public/fonts`).

### 4.5 Coverage relevant to radio (checked against `fonts.json` in this run)

| Present in all four faces | Missing in all four faces |
|---|---|
| `µ` U+00B5, `μ` U+03BC, `°`, `×`, `·`, `±`, `≈`, `−` U+2212, `→ ← ↑ ↓ ↔ ⇄ ⇒`, `Ω λ π φ ω Δ`, `∠`, `≤ ≥ ∞ √ ≠ ∑ ∼`, `½ ¼`, `…`, `« »`, `— –`, `’` U+2019, `№ ‰ ′ ″`, `⁻ ²`, `▶ ● ⚡ ✓`, NBSP, U+202F, U+2009, `ґ є і ї` | `ʼ` U+02BC (modifier apostrophe), `⊙` U+2299, `⊗` U+2297, `∿` U+223F |

Every one of the 163 distinct characters of the design document has a glyph in all four faces (non-ASCII,
non-Cyrillic ones used there: `§ « ° ± µ · » × Ω π – — … ⁸ № → ↔ − ≈`). The design writes the apostrophe as
U+0027 (119 times) and micro as U+00B5 (12 times).

Typography rules that decide which of those characters reach the screen:

| Rule | Source |
|---|---|
| «Greek mu `μ` (U+03BC) for micro and permeability, never the legacy micro sign `µ` (U+00B5)» | DECISIONS §32 (`docs/DECISIONS.md:93`); enforced by `doccheck.py` (`('§32', 'µ', None)`, l.69; check 5 «no straight quotes / apostrophes in Ukrainian copy; no legacy micro sign µ», l.9) |
| `typography.py` normalises chapter documents: apostrophe inside a word `' ʼ `` ` `` ´` → `’` (U+2019); `µ` → `μ`; `...` → `…`; `"…"` → «…»; NBSP between number and unit | `tools/content/typography.py:1-20` |
| `fmtSI` writes Greek `μ`; «Decimal comma, real minus sign, SI symbols in Latin, Greek μ for micro» | `app/src/content/format.ts:69-72`, UI_API l.434-437 |
| Unit symbols exempt from the Latin-word check: `UNITS` in `tools/content/terms_check.py:114-117` — has `mW`, `Hz kHz MHz GHz`, `μs ns ms`, `dB`, `V mV`, `m mm cm km`; does **not** have `dBm`, `nW`, `bit`, `Mbit` | same file |

---

## 5. Motion and effects rules

### 5.1 Tokens (`app/src/style/motion.ts`)

| `MOTION.<name>` | duration, s | ease |
|---|---|---|
| `camera` / `cameraShort` / `cameraLong` | 1.8 / 1.2 / 2.4 | `cinematic` |
| `appear` | 0.5 | `back.out` |
| `disappear` | 0.25 | `power2.in` |
| `state` | 0.7 | `power2.inOut` |
| `mood` | 2.0 | `sine.inOut` |
| `hover` / `press` | 0.12 / 0.08 | `power1.out` |
| `release` | 0.4 | `spring` |
| `panel` | 0.35 | `power2.out` |
| `transition` | 1.35 | `power2.inOut` |

`STAGGER = 0.055`. `REDUCED_MOTION = { camera: 0.35, transition: 0.4, drift: 0 }`. Ease names (`EaseName`): `linear`,
`power1…4.in|out|inOut`, `sine.*`, `expo.*`, `back.*`, `elastic.out`, `cinematic`, `spring`, or `(t) => number`
(ENGINE_API l.426-427).

### 5.2 Rules

| Rule | Source |
|---|---|
| Camera: always eased, 1.2-2.4 s for shot changes, «subtle continuous drift/breathing when idle»; «Never cut»; orbit damped and constrained | STYLE_GUIDE l.133-135 |
| `Shot.drift` (idle motion, default 1); «`reducedMotion` shortens moves (×0.35) and disables drift» | ENGINE_API l.228-231, l.242 |
| Objects appear with scale-up + `back.out` (0.35-0.6 s), staggered 30-80 ms; disappear in 0.2-0.3 s `power2.in`; «State changes interpolate; numbers count up» | STYLE_GUIDE l.136-137 |
| Flows «loop seamlessly; speed and density map to real quantities» | STYLE_GUIDE l.138-139 |
| «The interface is flat 2D and never follows the pointer» | STYLE_GUIDE l.141-143 (DECISIONS §59 p) |
| «Respect `reducedMotion` setting (shorter camera moves, no camera drift, no shake)» | STYLE_GUIDE l.144 |
| `ctx.reducedMotion` (boolean user preference; the engine also listens to `(prefers-reduced-motion: reduce)`, `app.ts:235-236`); `FxEnv.reducedMotion` «effects drop shake / jitter»; `createVibration(…, { reducedMotion: ctx.reducedMotion })`; panel / navigator reveals are immediate or short under reduced motion and at once under a frozen clock | ENGINE_API l.160, `fx/core/env.ts:12-13`, FX_API l.284,295, UI_API l.203-217 |
| All animation on the engine clock: «no `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Math.random`»; use `update(dt, t)`, `ctx.tweens`, `kGlobals.uKTime`, `ctx.random`. Lint: `setInterval` is restricted in all `src/**/*.ts`; `Date.now`, `performance.now`, `window.setTimeout`, `Math.random` only in `src/volumes/*/chapters/**/*.ts` — **not** in `shared/**` or `sim/**` | ENGINE_API l.428-430, l.600; `app/eslint.config.js:27-31,37-63` |
| One-shot fx triggers (`emit`, `burst`, `fire`, `strike`) «use the engine clock; call them from `update`, tweens or input handlers — not from a `setTimeout`»; «do not call `emit` / `fire` / `strike` every frame» | FX_API l.38-39, l.434 |
| `?freeze=<seconds>`: no real-time advance; after every navigation N seconds are simulated in 1/60 s steps, then the picture holds | ENGINE_API l.540-541 |
| «Chromatic aberration only during transitions. No lens dirt, no heavy motion blur»; film grain «very subtle, animated» | STYLE_GUIDE l.127-128 |
| `Spin`: «the visible step per frame is capped so nothing strobes» | FX_API l.294 |
| Quality checklist: «No z-fighting, shadow acne, banding, bloom blow-out, aliasing shimmer»; circuit's frame checklist adds «ніщо не миготить» | STYLE_GUIDE l.185; `docs/volumes/circuit/VISUAL.md:452` |
| `volume-walk.mjs`: «camera/light jumps and flashes near the swap fail» (chapter borders of a seamless volume) | ARCHITECTURE l.182-186 |

### 5.3 Flashes, strobing, noise, photosensitivity

A search of `docs/*.md` (STYLE_GUIDE, ENGINE_API, ARCHITECTURE, DECISIONS, UI_API, VOLUMES, API_CHANGES, LIBRARY)
for `flash | strob | flicker | photosens | epilep | seizure | мигот | блима` finds **no rule** that limits flash
rate, flash area or luminance swing, and nothing about noise / "snow" effects. What exists is listed in §5.2 (the
`Spin` cap, «ніщо не миготить» in circuit's checklist, the seam check) plus the engine's own always-on noise: film
grain 0.022 (§2.3) and the hologram panel's «faint animated scan/grain» (`style/materials/unlit.ts:324-327`).

The design asks for effects no rule covers: screen snow from the model (l.203, l.311), brightness that «блимає»
(`slope/limiter` l.310, `angle/both` l.323, `build-analog/fault` l.426) and a stroboscope step (`shift/strobe`
l.300: «крутити темп спалахів велосипедної фари»). Of these only the snow is inside batches 2-3
(`prologue/between`).

---

## 6. Audio

Public surface (`app/src/audio/index.ts`): `audio`, `plugin`, `moodForTheme`, types `AudioDebug`, `LoopHandle`,
`LoopParams`, `LoopName`, `MoodName`, `OneShotName`, `OneShotOptions`, `RenderStats`, `SoundRef`.

```ts
// app/src/audio/audio.ts:10-30
export const audio = {
  play: (name: OneShotName, opts?: OneShotOptions): void,        // OneShotOptions = { gain?, pitch? }
  loop: (name: LoopName): LoopHandle,                             // .set({ gain?: 0…1, pitch?: number }): this; .stop(fade = 0.4)
  mood: (name: MoodName | null): void,
  stopLoops: (fade?: number): void,
  get unlocked(): boolean,
  names: { oneShots: OneShotName[], loops: LoopName[], moods: MoodName[] },
} as const;
```

| Kind | Names | Source |
|---|---|---|
| One-shots | `hover`, `click`, `toggle`, `tick`, `panelOpen`, `panelClose`, `success`, `error`, `zap`, `spark`, `breaker`, `relay`, `whooshUp`, `whooshDown`; `DUCKING = { zap, breaker, success, error, whooshUp, whooshDown }` dips the ambient bed | `audio/oneshots.ts:19-111` |
| Loops (one shared voice per name) | `hum` (50 Hz + harmonics), `turbine`, `water`, `steam`, `wind`, `fire`, `geiger`, `buzz` | `audio/loops.ts:29-179` |
| Moods | `micro`, `studio`, `dioramaDay`, `dioramaNight`; cross-fade `MOOD_FADE = 2.5` s | `audio/moods.ts:23-34`, `audio/engine.ts:16` |

| Topic | Fact | Source |
|---|---|---|
| Triggering from a chapter | `audio.play('click')`, `audio.loop('hum').set({ gain, pitch })`, `audio.mood('dioramaNight')`. «Set loops continuously (in `update`) or in `enterStep`, not once in the scene factory: the plugin fades all loops out when the chapter changes» | FX_API l.324-334 |
| Automatic | unlock on the first gesture; follows `settings.audio` / `settings.volume`; mood per chapter from `manifest.theme` via `moodForTheme(mood, sky)` (`sky` `night` or `dusk` → `dioramaNight`, other dioramas → `dioramaDay`); `whooshDown` / `whooshUp` on non-seamless chapter transitions; `engine.stopLoops()` on every chapter change; suspend with a hidden tab | `audio/plugin.ts:32-84`, `audio/moods.ts:82-86` |
| Silent no-ops | before the first gesture and with `?noaudio` every call does nothing (only intent is recorded) | `audio/engine.ts:1-5,89-106` |
| Arbitrary sample buffers | **Not possible through the public API.** `play` takes `OneShotName`, `loop` takes `LoopName`; both index fixed tables `ONE_SHOTS` / `LOOPS` of synthesis functions `(ctx, out, t0, …)`. «No sample files; everything is synthesised» (`audio/index.ts:2`). The only `AudioBuffer` in the library is the internal 2-s white-noise buffer (`audio/synth.ts:7-25`) | — |
| What a non-public import would reach | `app/src/audio/audio.ts:8` `export const engine = new AudioEngine()` (not re-exported by the barrel) with public fields `context: AudioContext \| null`, `loopBus: GainNode \| null`, `analyser`; `master`, `sfxBus`, `ambientBus` are private. Master chain: buses (`SFX_LEVEL 1.8`, `LOOP_LEVEL 0.7`, `AMBIENT_LEVEL 0.4`) → master (`volume² × 0.55`, 0 when muted) → limiter (−12 dB, ratio 20) → analyser → destination. No lint rule blocks `@/audio/audio` | `audio/engine.ts:10-16,73-145` |
| QA | `node app/src/audio/qa/audio-check.mjs` (file exists), `window.__audio` (`unlocked`, `level`, `renderOffline`, `names`, `play`, `loop`, `mood`, `stopLoops`, `state`) | `audio/plugin.ts:13-24,55-75` |
| Style rule | «Master ≤ −14 LUFS feel; nothing harsh. Sound is seasoning, never required for understanding»; mains hum «where thematically relevant» | STYLE_GUIDE §7 l.171-175 |

Nothing radio-specific exists (no static / hiss, no tuning sound). A radio chapter with `theme.sky: 'dusk'` gets the
`dioramaNight` pad automatically.

---

## 7. Performance budgets

### 7.1 Gates

| Gate | Value | Where set | Enforced by |
|---|---|---|---|
| Frame time, 1920 × 1080, tier `high`, RTX 5060 | avg ≤ 8 ms | ARCHITECTURE l.24-27, ENGINE_API l.523 | `chapter-check.mjs` `--budget` (8), l.95; min of 3 interleaved rounds × 90 frames; GPU timer query + CPU |
| Frame time, 3840 × 2160, `high` | avg ≤ 14 ms (warning above), fail above 16.6 ms | ENGINE_API l.527 | `--budget-4k` (14), `--fail-4k` (16.6), l.101-102 |
| Draw calls per chapter view | ≤ 350 (the post stack itself ≈ 30) | ARCHITECTURE l.24, ENGINE_API l.523-525 | `chapter-check.mjs:185`: `` `${step}: ${s.drawCalls} draw calls (budget 350)` `` |
| Triangles per chapter view | ≤ 1.5 M | same | `chapter-check.mjs:186`: `` `${step}: ${s.triangles} triangles (budget 1.5 M)` `` |
| Chapter chunk / initial load | ≤ ~350 kB gzip / ≤ ~900 kB gzip | ARCHITECTURE l.25 | — |
| Leaks | geometry / texture / program counts must not grow over leave-and-return ×3 | `chapter-check.mjs:264-291` | fail `leak: <key> grew a → b over two enter/leave cycles` |
| Console | any console error **or warning** fails | ENGINE_API l.579-581 | `checkErrors` |
| Hue families | ≤ 4 per deep-link frame | `chapter-check.mjs:96` | l.191 |
| World text | `Text3D` ≥ 16 px-eq at 1280 × 720 | ENGINE_API l.723-726 | `--min-text` |
| Phone / tablet frame time, tier `mobile` | 16.6 ms («a phone frame at 60 Hz»); over budget is a **warning** unless `--perf-fail` | `tools/qa/mobile-check.mjs:27-28,57,192-194` | `mobile-check.mjs` |
| Phone / tablet pixel budget | phone 1.0e6 px, tablet 2.0e6 px rendered; `mobile-check` fails above budget × 1.02 | `engine/device.ts:70`, `mobile-check.mjs:117` | fail `renders WxH, over the pixel budget` |
| DOM interface cost (`dom-cost.mjs`) | `stepLayoutMs` 4 (mobile 8), `steadyLayouts` 0, `recalcMs` 0.2, `hudScriptMs` 0.5 (mobile 1.0), `nodes` 1500, `onOffMs` 1.5 (mobile 2.5) | `tools/qa/dom-cost.mjs:36-43` | exit 1 `OVER BUDGET` |
| Emblem | ≤ 3 meshes, ≤ 2 000 triangles, no textures, no lights | UI_API §9 l.365-370 | — |
| GPU assertion of every QA tool | `WebGL is not running on the NVIDIA GPU (renderer: "…"). Check the Chrome GPU flags.` unless `QA_ALLOW_SOFTWARE` is set | `tools/qa/lib.mjs:160-162` | all tools through `openApp` |

There is no separate draw-call or triangle budget per tier or for phones: the 350 / 1.5 M gates are measured at
`high`; phones are governed by the `mobile` tier profile, the pixel budget and the 16.6 ms warning.

### 7.2 Quality tiers (`app/src/engine/quality.ts:67-158`)

| Tier | maxDpr | MSAA | shadow map | AO samples | DOF taps | bloom levels / scale | `particles` | other |
|---|---|---|---|---|---|---|---|---|
| `low` | 1 | 0 | 1024 | 0 | 0 | 4 / 0.5 | 0.35 | — |
| `medium` | 1.25 | 2 | 2048 | 6 | 16 | 5 / 0.5 | 0.6 | — |
| `high` | 1.5 | 4 | 2048 | 10 | 28 | 6 / 0.5 | 1 | — |
| `ultra` | 2 | 4 | 4096 | 16 | 44 | 7 / 0.5 | 1.5 | — |
| `mobile` | 2 | 0 | 1024 | 0 | 0 | 3 / 0.25 | 0.5 | `lowDetail: true`, `directWorld: true` |

`ctx.quality.count(nominal, min = 1)` = `max(min, round(nominal × particles))`; `ctx.quality.onChange(fn)`;
`ctx.quality.profile.lowDetail` is «the "drop optional detail" signal for kits and chapters» (ENGINE_API l.818).
`auto` resolves to `mobile` on phones / tablets without a benchmark; `Settings.frameCap: 'auto' | 30 | 60` — `auto`
holds 30 fps on `mobile` after ~3 s of long frames at the lowest dynamic resolution (ENGINE_API l.815-821).

### 7.3 Rules on per-frame work, allocations, texture uploads

No document states a rule about per-frame allocations or about texture uploads. What the docs do say:

| Rule | Source |
|---|---|
| «avoid > 10 ms synchronous blocks in `update`»; `await ctx.breathe()` between build phases (yields only when ≥ 7 ms of the slice are used, never under `?freeze`) | ENGINE_API l.526, l.660-661 |
| What scales with pixel count: every full-screen post pass plus «fill-heavy transparent / additive effects (glass, halos, point clouds, ribbons near the camera). Geometry, draw calls and CPU do not scale» | ENGINE_API l.527-533 |
| «Instance everything repeated …; share materials; shadows double the draw calls of casters» | ENGINE_API l.524-525 |
| fx: «every effect is one or two draw calls; fill rate is what costs»; counts scale with the tier (×0.35 at `low`), «do not compensate by hand» | FX_API l.415-417 |
| fx CPU per frame: `Scope` 160 points per analytic channel; `WaveOnCurve` / `PulseTrain` rebuild every frame (≤ 1400 points); `SpectrumBars` one matrix per bar; `FieldLines` only on `refresh()` — «do not re-integrate Biot–Savart field lines every frame; refresh on change» (11 lines + 27 arrows every frame ≈ 0.5 ms) | FX_API l.210-214, l.398-413, l.436 |
| Step UI: a `readout` is «polled every frame; keep it cheap»; chart `update` «runs every frame: change data only when inputs changed»; «don't rebuild chart data every frame when nothing changed»; `PlotMesh` is «cheap enough for 30-60 Hz live plots of a few thousand points» | UI_API l.228,233,509; `ui3d/charts/plot.ts:1-5` |
| `PointLight`s: «keep them few (each one is a loop iteration in every lit shader) and keep them in the scene permanently» | ENGINE_API l.276-278 |
| Mobile rule e: «Scenes honour the quality tier: particle counts through the tier budgets, kit `low`/detail options and optional set-dressing keyed to the tier» | DECISIONS §57 e (l.197-198) |

Existing code patterns for textures that change at run time: one long-lived `DataTexture`, `needsUpdate = true` only
when the data changed (`ui3d/core/surface.ts:571`, `fx/flow/pathset.ts:69-97`). `Scope.redraw` and `Phasors.redraw`
allocate small arrays / `Vector3`s per frame (`scope.ts:123`, `phasors.ts:118`), so the libraries themselves do not
follow a zero-allocation rule.

### 7.4 Reference costs (KIT_API §10, FX_API §11; measured on the authors' RTX 5060)

| Item | Cost |
|---|---|
| `house-gable` | 24k tris (frame) / 7 meshes; `house-shed` 16k / 7 |
| `cutaway-house` | 109k / 50; `cutaway-house-home` 78k / 32 |
| `island` | 75k / 3; `forest` 258k / 14; `trees` 27k / 10 |
| `people` 18k / 4; `birds` 3k / 2; `backdrop` 27k / 9 | |
| fx `signals` stand (3 scopes with 5 traces, phasors, PWM train, spectrum bars, wave on a wire) | 2.9 ms, 55 draw calls, 7k tris at 1080p `high` |
| fx `fields` stand (26 field lines, 80² potential surface, probe arrow) | 2.1 ms, 37 draw calls, 19k tris |
| `Scope` | 1 screen + 1 per channel; `SpectrumBars` 1; `RibbonLines` 1; `ArrowField` 1; `ParticleSystem` 1; `Text3D` 1 per block |

"Triangles (frame)" in KIT_API includes the shadow pass and ≈ 3k of studio plinth, «so the model itself is roughly
half of it» (KIT_API l.299-301).

---

## 8. Surprises (design document against the code / docs of this subsystem)

1. **No ready part shows a live image; no K material takes a texture.** Design l.717 «Екран. Текстура, яку модель
   оновлює кожним своїм кадром» and l.733 place it in `radio/shared/screen`, which matches — but the scope is a new
   `Mesh` + custom `ShaderMaterial` + `DataTexture`: `K.*` has no `map` (`style/materials/*.ts`), the kit `Slot` set
   is closed (`kit/core/builder.ts:50-62`), kit screens are vertex-coloured `window` panes
   (`kit/home/furniture.ts:59-67`), and the only texture-on-quad precedent is the static HUD `HeatMap`
   (`ui3d/charts/heatmap.ts:86-97`). ENGINE_API l.599 forbids `MeshBasicMaterial` in chapters (not lint-enforced).
2. **The engine adds its own animated noise to every pixel, the screen included.** Design l.29-31 «Екран не бреше …
   Сніг … виникають із моделі, а не намальовані» and l.86 anti-goal «Намальований сніг». `POST_BASE.grain = 0.022`
   (`engine/pipeline/post-params.ts:98`) is applied in the final pass, strongest in dark areas
   (`engine/pipeline/shaders.ts:399-401`), on top of whatever the screen mesh shows; it is a per-chapter / per-step
   `PostParam`.
3. **Evening presets recolour the frame.** Design l.188 «Сутінки густішають до фіналу … Обидва екрани чорно-білі» and
   l.757 fixed radiovision hues. `dusk` multiplies the image by `(0.97, 0.88, 1)` at 0.5 and pulls hues toward
   magenta-violet with `harmony 0.58`; `night` pulls toward blue-violet with `harmony 0.35`; only `accentColor`
   (`yellow`) is exempt (`style/env/presets.ts:231-241,265-273`; ENGINE_API l.618-622 «zero for `day`, `studio`,
   `micro`, where palette tokens land exactly»). A neutral grey screen takes the dusk tint; `sky`, `lime`, `cyan`
   are desaturated / rotated in both presets. The five fields are overridable (`EnvOverrides`).
4. **Where the volume's semantic table lives contradicts the "do not edit the platform" rule.** Design l.552-556
   lists `style` among directories that are not edited. STYLE_GUIDE l.89-90 puts a new volume's table into
   STYLE_GUIDE §2.2.3… and its tokens «in `app/src/style` next to `SEMANTIC`»; VOLUMES §4 l.130-131 says the same.
   The built precedent does neither: circuit's table is `docs/volumes/circuit/VISUAL.md` §4 «(пропозиція для
   STYLE_GUIDE §2.2.3)», and STYLE_GUIDE has no §2.2.3.
5. **Radio tokens reuse hues the core and volume 1 already use.** Design l.205 / l.757: carrier `sky` (core: cold /
   water; `ui.info`; `flow.reactive`), I shadow `sky` = same token as the carrier, bits `lime` (Li⁺, gluon,
   `plantType.bess`), Q `violet` (nuclear). E `amber` / B `magenta` match `SEMANTIC.fieldE/fieldB`
   (`style/palette.ts:201-202`). The design names no colour for electrons or antenna current (volume 1: `cyan`,
   `yellow`). With E, B, carrier, Q and bits in one frame the 4-hue-family gate of `chapter-check`
   (`tools/qa/lib.mjs:214-245`, `chapter-check.mjs:96,191`) is at risk.
6. **«де можна — на основі наявних осцилографа, стовпчиків спектра й стрілок із `fx/signals`» (design l.734).**
   They exist (`createScope`, `createSpectrumBars`, `createPhasors` in `fx/signals`; `createVectorArrow` is in
   `fx/fields/arrows.ts`), with limits: `Scope.setSamples` resamples by nearest index to 160 points by default
   (`fx/signals/scope.ts:87-94`) and clamps to ±1.15; default trace colours are the electricity phases
   (`scope.ts:63`); `SpectrumBars` colours bar 0 `yellow` and has no axis (`fx/signals/extras.ts:138-151`);
   `Phasors` shows one projection, not the two shadows I and Q of design l.317 (`fx/signals/phasors.ts:107-121`);
   all default sizes assume a 3-6-unit scene (FX_API l.40-46), not a 20 m yard.
7. **Micro sign and apostrophe.** Design l.838-839 lists «µs» among the units and writes `µ` as U+00B5 (12 times)
   and the apostrophe as U+0027 (119 times, e.g. «сузір'я»). DECISIONS §32 (`docs/DECISIONS.md:93`) and `doccheck.py`
   (l.9, l.69) forbid U+00B5; `typography.py` rewrites both in chapter documents (→ `μ` U+03BC, `’` U+2019);
   `fmtSI` emits `μ` (`app/src/content/format.ts:69`). All four characters have glyphs, so this is a copy / doccheck
   matter, not a font gap.
8. **No new glyph is needed for anything the design writes** (all 163 distinct characters are in all four faces).
   If one were, it would mean editing `app/scripts/charset.mjs` and regenerating `app/public/fonts/**` — platform
   assets — and `pnpm webfonts` needs Python `fontTools` + `brotli`, which design l.117 («Node 24 і pnpm») does not
   list.
9. **`pnpm fonts:check` does not see captions written in code.** Design l.678-679 «Під екраном — постійний підпис
   «картинку обчислено · зменшено»» and l.739. `app/scripts/font-coverage.mjs:23-29` reads only
   `docs/volumes/<v>/chapters/_export/*.json`; a scene caption that is not in a chapter document is covered only by
   the run-time `text: no glyph …` warning (`text/layout.ts:146-153`). As a world `Text3D` it must also pass the
   16 px-eq gate at 1280 × 720 and the 14 CSS px touch warning.
10. **The interface default is now DOM, the docs still say WebGL.** `DEFAULT_HUD = 'dom'` (`app/src/engine/app.ts:53`)
    against UI_API l.4 «there is no DOM UI», l.464 «default `gl` until the cut-over», STYLE_GUIDE l.148 «All UI is
    rendered in WebGL». For the design's own HUD instruments (the «де ми» miniature in the dock, l.201, l.759) a
    `custom` control needs a `dom` builder; a WebGL-only node is drawn with a warning that D9 turns into a
    `chapter-check` failure (UI_API l.349-354). `docs/HUD_DOM.md`, which describes this, is not in this copy.
11. **Arbitrary sound (design l.77-78, l.740) — confirmed and more closed than the design implies.** The public
    `@/audio` API plays only named synthesised sounds; `AudioContext` and buses are reachable only through the
    non-exported `engine` of `app/src/audio/audio.ts:8` (`context`, `loopBus` public; master gain private). Batch 9
    only; nothing in batches 1-3 depends on it.
12. **«з окремим обліком у перевірці швидкодії» (design l.705, the camera-eye pass).** An extra
    `renderer.render()` issued from a chapter `update()` runs before `pipeline.render()` calls `r.info.reset()`
    (`engine/app.ts:596-613`, `engine/pipeline/pipeline.ts:334`), so `__app.stats().drawCalls / triangles` — the
    numbers behind the 350 / 1.5 M gates — do not contain it; it would have to be counted by the volume itself.
    The pipeline also leaves `renderer.autoClear = false` (`pipeline.ts:253`).
13. **fx objects inside the camera-eye view.** `RibbonLines` sizes its minimum width in pixels of the *current*
    render target (`fx/core/ribbon.ts:197-200`) and `Text3D` re-orients / re-scales per rendering camera
    (`text/text3d.ts:338-371`); in a 128 × 96 pass any ribbon is ≥ 1.4 px of 96 and billboards face the eye camera.
    Design l.699-701 expects the eye to see «гойднута хвіртка, кіт і картка» with no special code; radiovision,
    probe strips and labels in the same scene graph are seen too unless they are on another layer
    (`OVERLAY_LAYER = 1`, `engine/layers.ts:12`) or hidden.
14. **Strobe and flicker steps have no rule to design against.** Design l.300 (`shift/strobe`), l.310, l.323, l.426
    («блимає») and the snow itself; the only written constraints are «ніщо не миготить»
    (`docs/volumes/circuit/VISUAL.md:452`), STYLE_GUIDE §8 and the `Spin` anti-strobe cap (FX_API l.294). No
    photosensitivity limit exists in the docs of this copy.
15. **Design l.597-598 «На 17.11.2026 у томі `circuit` збудовано тільки пролог і `wire`».** After the merge
    `app/src/volumes/circuit/chapters/` holds `battery`, `build`, `charge`, `drain`, `flow`, `lamp`, `prologue`,
    `resistance`, `wire` (directory listing only; not this subsystem — reported because `circuit/shared/**` is the
    nearest precedent for a volume-local look library).
16. **Stale doc pointers.** ENGINE_API l.371 and the run-time warning (`text/layout.ts:150`) say to add glyphs in
    `app/scripts/build-fonts.mjs`; `charset()` actually lives in `app/scripts/charset.mjs`. FX_API l.6 and KIT_API
    l.303-447 point to `docs/reports/F3-fx.md` and `/srv/electricity/qa/F4-kit/…`, absent here.

## 9. Open questions (not established from the files)

1. Whether the eye-of-camera pass is included in the frame time that `chapter-check` / `__app.measure()` report
   (GPU timer query scope was not read); only the draw-call / triangle accounting was traced.
2. Whether `path_check.py` / `terms_check.py` are run on path-format radio documents in a way that rejects `dBm`,
   `nW`, `Mbit/s` (absent from `UNITS`) — the volume's `terms_allowlist.tsv` mechanism was not read.
3. Whether the owner wants the radio semantic table in `docs/volumes/radio/VISUAL.md` (circuit's way) or in
   STYLE_GUIDE §2.2.3 with tokens in `app/src/style` (the documented way, which edits the platform).
4. What colour electrons, antenna current and interference take in radio (the design names only six meanings).
5. Whether any limit on flashing / snow (rate, area, contrast) and a reduced-motion behaviour for the screen is
   wanted; the docs contain none.
6. Whether the evening mood grade (`harmony`, `gradeTint`) and film grain are to stay on in screen steps or be
   overridden per chapter — a look decision the design leaves to `VISUAL.md`.
7. Whether Python `fontTools` + `brotli` exist on this machine (needed only if a glyph must be added; not tried).
8. Real costs on this machine: all figures in KIT_API §10 / FX_API §11 are from the authors' RTX 5060 at `high`;
   nothing was measured here (software rendering).
9. The DOM-side contract of a `custom` control (`domKit`, `hudLayer`) beyond UI_API §8 — `docs/HUD_DOM.md` is
   missing and `app/src/hud-dom/**` was not read beyond two signatures.
