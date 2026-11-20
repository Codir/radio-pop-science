# Recon E2 — platform APIs a chapter / scene of `electronics` uses

Snapshot: `main` at `2707887` (2026-11-20). Read-only recon; every signature below was checked in the source, not only
in the docs. Paths are repo-relative (`app/src/...`). "§" refs point into `docs/*.md` with line numbers.

Verdict legend: **USE** = import the platform API directly (it is importable; platform dirs are read-only) ·
**COPY** = copy as is into `app/src/volumes/electronics/shared/**` + `docs/volumes/electronics/REUSE.md` ·
**COPY+ADAPT** = copy and change (said what) · **REFERENCE** = read for the pattern, write our own · **SKIP**.

Prior recon of the same engine (written for `radio`, snapshot `63fd42c`, still accurate where re-checked here):
`docs/superpowers/plans/2026-11-18-radio-pilot/facts/chapter-api.md` (958 lines), `sim-worker-lint.md` (512),
`kit-fx-ui3d.md` (619). Use them for camera / stage / render-target detail not repeated here.

---

## 0. Doc index (where each topic is written down)

| Topic | Doc § (file:lines) |
|---|---|
| Chapter files, manifest, `defineScene`, `ChapterContext` table | ENGINE_API §2–§4 (`docs/ENGINE_API.md:49-166`) |
| Step states `ctx.stage`; sub-states `stage.toggle/setParam`, `stage.scope` | §5 (`:168-209`), §21 Stage (`:684-697`) |
| Input, drag `planePoint`, `captureKeys` | §11 (`:381-411`); touch model §23 (`:823-829`) |
| Tweens & clock (no timers) | §12 (`:413-430`) |
| Disposal (`track`, `onDispose`) | §13 (`:432-446`) |
| Audio rule for plugins/chapters | §15 (`:512-513`) |
| Perf budget | §16 (`:515-533`) |
| URL flags, `window.__app` | §17 (`:535-551`) |
| Do / don't (determinism list) | §19 (`:588-606`) |
| Lint chapter boundary / volume boundary | §21 (`:676-682`) |
| QA hooks `ctx.qa.probe/expose` → `__app.locate/read` | §21 (`:710-716`) |
| Volumes, aliases, `sim/**` `shared/**` | §22 (`:732-792`), VOLUMES §2 (`docs/VOLUMES.md:40-61`), §5 (`:162-172`) |
| Path volumes: `goal`, floors | ENGINE_API §24 (`:839-843`), VOLUMES §7 (`:184-203`) |
| New-volume checklist | VOLUMES §4 (`:100-160`) |
| `content.ts`, generated JSON, `labels` | UI_API §2 (`docs/UI_API.md:34-100`) |
| `stepUi`, board, slider scrub, panel/nav gates | UI_API §3–§3.4 (`:102-218`) |
| `ControlSpec` table (slider, toggle, segmented, readout, chart, …) | UI_API §4 (`:220-238`) |
| Callouts / hotspots | UI_API §5 (`:240-265`) |
| Charts (`Chart`, live `window` + `push`, markers, log axes, two Y axes) | UI_API §7 (`:282-323`) |
| World consoles, `hudLayer`, `custom` DOM widgets, `domKit` | UI_API §8 (`:325-361`) |
| Journey inset / «де ми» ladder | UI_API §11a (`:418-430`) |
| Number formatting `fmt*` | UI_API §12 (`:432-437`) |
| QA (`__ui.*`, `--hud dom`) | UI_API §13 (`:439-497`), §15 (`:535-564`) |
| Colour code (global core; per-volume tables) | STYLE_GUIDE §2.2 (`docs/STYLE_GUIDE.md:41-90`) |
| UI typography; **formulas yellow on a darker inset** | STYLE_GUIDE §6 (`:146-169`, the rule at `:159-160`) |
| Audio style | STYLE_GUIDE §7 (`:171-175`) |
| FX conventions, heat, smoke, sparks, outline, scope | FX_API §0 (`docs/FX_API.md:11-49`), §6 (`:220-243`), §7 (`:245-268`), §8 (`:270-296`), §9 (`:298-319`) |
| Platform audio facade | FX_API §10 (`:321-347`) |
| Kit `Builder` + `G` for hero models | KIT_API §1 (`docs/KIT_API.md:10-90`), §2b (`:122-164`), §12 (`:466-473`) |
| Volume ownership boundaries | LIBRARY.md §3–§4 (`docs/LIBRARY.md:34-67`) |

Docs referenced by UI_API / ENGINE_API but **absent in this repo**: `docs/HUD_DOM.md`, `docs/PATH_FORMAT.md`,
`docs/MOBILE.md`, `docs/AGENT_GUIDE.md`, `docs/VOLUME_STRUCTURE.md` (mirror repo; see Gotchas). The code is the
authority for the DOM interface.

---

## 1. Engine — `@/engine/api` (the only engine import a chapter may use)

`app/src/engine/api.ts` (105 lines) re-exports: `defineChapter`, `defineScene`, `bindChapter`, `fullChapterId`,
types `ChapterContext`, `SceneHooks`, `StepInfo`, `StepIdOf`, `Shot`, `CameraDirector`, `ClockView`, `ScopedInput`,
`InteractionHandlers`, `DragInfo`, `PointerInfo`, `QaApi`, `Stage`, `StepSpec`, `Store`, `Settings`, `TweenScope`,
`Tween`, `EaseName`; values `Rng`, `toOverlay`, `worldBounds`, `OVERLAY_LAYER`, `WORLD_LAYER`, `markShared`,
`Emitter`, `damp`, `EASE`, `resolveEase`, `defineVolume`, `floorLabel`, `floorValue`, `groupLabel`,
`DEFAULT_READING_LEVEL`. **Verdict: USE.**

### 1.1 Scene contract — `app/src/engine/chapter.ts` (246 lines)

```ts
// chapter.ts:156
export function defineScene(create: SceneFactory): SceneModule;
type SceneFactory = (ctx: ChapterContext) => SceneHooks | void | Promise<SceneHooks | void>;   // :148
interface SceneHooks {                                                                            // :131-146
  enterStep?(stepId: string, info: StepInfo): void;     // after ctx.stage applied the step; safe from ANY state
  leaveChapter?(to: { volumeId; chapterId; stepId }): number | (() => boolean) | null;  // seamless border walk
  update?(dt: number, t: number): void;                 // every engine update, engine-clock seconds
  dispose?(): void;
}
interface StepInfo { from: string | null; instant: boolean; direction: 1 | -1 | 0; index: number; scope: TweenScope } // :117-128
export function defineChapter<const M extends ChapterSpec>(spec: M): M & { volume: string };    // :86-98
```

### 1.2 `ChapterContext` — `chapter.ts:186-246`; built in `engine/runtime.ts:674-723`

| Member | Signature / meaning | Notes |
|---|---|---|
| `root: Group` | add everything here → auto-disposed | §13 |
| `scene`, `camera: CameraDirector`, `env`, `post`, `stage: Stage` | | §5–§9 |
| `input: ScopedInput` | `register(obj, handlers, layer?: 'world'\|'hud'): Unsubscribe`; `on('hover'\|'action'\|'gesture'\|'background', fn)`; `captureKeys(fn, { priority? })` (`input.ts:114-130`) | **there is no `ctx.input.gesture`** — the gesture promise is `ctx.gesture` |
| `gesture: Promise<void>` | resolves on the first user gesture (touch: on release) (`chapter.ts:224-225`, `runtime.ts:704`) | audio may start only after it |
| `tweens: TweenScope`, `clock: ClockView` | `ClockView { time; dt; frame }` (`clock.ts:5-12`) | see §6 |
| `quality: QualityView` | `tier`, `profile` (`lowDetail` on `mobile`), `count(nominal, min?)`, `onChange(fn)` | |
| `store: Store` | the **global** store: `get()`, `set()`, `subscribe(select, listener, { immediate? }) → () => void` (`store.ts:257-268`) | subscriptions are NOT chapter-scoped: unsubscribe in `ctx.onDispose` |
| `nav: Nav`, `hud: HudLayer`, `viewport`, `onResize(fn)` | | `onResize` is auto-unsubscribed |
| `device` | `formFactor` desktop/tablet/phone etc. (live getter, `runtime.ts:695-699`) | |
| `random: Rng` | seeded `new Rng('chapter:<id>')` (`runtime.ts:691`); `next() range() int() signed() gauss() pick() onSphere() fork(label)` (`random.ts:8-56`) | `fork` consumes the parent stream: fork order matters |
| `reducedMotion: boolean` | getter | |
| `disposed`, `track(x)`, `onDispose(fn)` | lifetime | |
| `progress(f)`, `breathe()` | loading; `breathe` never yields in deterministic mode (`runtime.ts:716-722`) | |
| `qa: QaApi` | §1.4 | |
| `renderer` | capabilities / render targets only | never `render()` |

**Settings** (`store.ts:21-48`): `audio: boolean` (master mute), `volume: 0…1`, `reducedMotion`, `textScale`,
`readingLevel`, `quality`, `frameCap`, `deskShell`, `dynamicResolution`, `benchmarkTier`. Read with
`ctx.store.get().settings`; follow with `const off = ctx.store.subscribe((s) => s.settings.volume, fn, { immediate: true }); ctx.onDispose(off)`.

**URL flags are not on `ctx`** (`UrlFlags` live on `Engine.flags`, `engine/app.ts:28-68`, plugins only). Radio sniffs
`?freeze` itself: `new URLSearchParams(globalThis.location?.search ?? '').has('freeze')`
(`volumes/radio/shared/world/index.ts:232`). `?noaudio` can be inferred from `audio.unlocked` (§8).

### 1.3 Input & drag — `app/src/engine/input.ts` (757 lines)

```ts
interface InteractionHandlers {                         // input.ts:60-85
  cursor?: string; tooltip?: string | (() => string);
  hover?(over: boolean, e: PointerInfo): void; press?(e): void; release?(e): void; click?(e): void;
  dragStart?(e: DragInfo): void; drag?(e: DragInfo): void; dragEnd?(e: DragInfo): void;
  wheel?(deltaY: number, e: PointerInfo): boolean | void; enabled?(): boolean;
  dragOwner?(e: { dx; dy; pointerType }): Object3D | null | undefined | void;   // touch arbitration
}
interface DragInfo extends PointerInfo {                // :44-58
  dx; dy; totalX; totalY; startPoint: Vector3 | null;
  planePoint(normal: Vector3, through: Vector3, out?: Vector3): Vector3 | null;  // ray ∩ plane
}
// PointerInfo :23-42 — pointerId, pointerType, x, y (CSS px), ndc, ray, point, object, layer, shift/ctrl/altKey
export const LONG_PRESS_MS = 480;                       // :206 (touch long press shows tooltip, suppresses click)
```

HUD objects are picked first; a touch moving > 9 CSS px is not a tap; fat-finger rings 10/22 px (ENGINE_API
`:823-829`). Picking walks the registered object's whole subtree; invisible objects are skipped → register an
invisible proxy mesh for thin or moving targets. **No platform drag/snap/grip helper exists** (kit has none; grep
for `grip` finds only HUD sheet code). Patterns to copy the *idea* from (REFERENCE only, they are other volumes'
chapter code):
- `volumes/circuit/chapters/flow/steps/01-connect.ts:53-80` — drag a wire end on the board plane with
  `e.planePoint`, snap into a clamp within a radius, `enabled: () => here(step) && …`, `ctx.qa.probe` on the grip.
- `volumes/electricity/chapters/current/steps/05-circuit.ts:156-200` — drag a part along a row, on `dragEnd` snap to the
  nearest slot and **store the result in a step control** (`ui.set('pos5', String(slot), { notify: true })`) so the
  state is random-access safe and testable; probes `seat5:<k>` / `drop5:<place>` for scripted drags.
- `volumes/electricity/chapters/current/parts/circuit-tray.ts` (160 lines; tray → board snap with a glowing bar),
  `circuit-grid.ts` (206; node grid, `nodeAt`, `partAt`, invisible `pick` plane), `multimeter.ts` (164; probes with
  `target`/`held`, cables follow), `lead-pick.ts` (40; nearest point on leads). Imports they would drag along:
  `@electricity/sim/current` (`BUILDER`, `gridNode`, `PartKind`, `MeterMode`), `../world` (`tag`, `Mats`),
  `../sim-bindings/builder-edit`, `./circuit-parts`, `./leads`. **REFERENCE** (the closest prior art to a
  breadboard + tray + multimeter; copying would drag electricity's sim — rewrite against `@electronics/sim/core`).

### 1.4 QA hooks — `app/src/engine/qa-probes.ts` (118 lines)

```ts
type ProbeTarget = Object3D | Vector3 | (() => Object3D | Vector3 | null);   // :10
interface QaApi {                                                              // :30-38
  probe(name: string, target: ProbeTarget, opts?: { origin?: boolean }): () => void;  // → __app.locate(name)
  expose(name: string, fn: () => unknown): () => void;                                 // → __app.read(name)
}
// __app.locate → { x, y (CSS px), visible, shown, world:[x,y,z] } | null   (:17-27, :99-112)
```

`expose`: `fn` is called on every `__app.read(name)` (`qa-probes.ts:59-61`; `engine/debug/api.ts:277`); return
plain JSON-able data. `__app.probes()` lists probe names and `read:<name>` (`debug/api.ts:273-275`). Cleared with the
chapter (`runtime.ts:729`); present in production builds. Pattern (circuit `flow/scene.ts:89-110`): one reader per
concern (`'motion'`, `'flow'`), numbers rounded where tests compare. Constraints file: tests compare `qa.expose`
numbers, never pixels. **USE.**

### 1.5 Stage sub-states — `app/src/engine/stage.ts` (573 lines)

`stage.current: string | null`; `stage.scope: TweenScope` (current step's, killed on step change; read at call time,
`:237-245`); `stage.toggle(actorOrObject, shown?, { instant? })` (`:252`), `stage.setParam(name, v, { duration,
ease, instant })`, `stage.setColor(...)`. Next step entry restores declared state. **USE.**

---

## 2. Step UI — `@/hud` (`stepUi`) and its DOM renderer `@/hud-dom`

`app/src/hud/index.ts:219-226` exports `stepUi`, types `StepUi`, `StepUiApi`, `ControlPatch`, all of
`step-ui-types`, `pathEnd`, `hudLayer`, `domKit`. **The DOM interface is the default**: `DEFAULT_HUD = 'dom'`
(`engine/app.ts:53`) — UI_API §13 ("default `gl` until the cut-over", `docs/UI_API.md:463`) is stale.

### 2.1 Entry — `app/src/hud/step-ui.ts` (216 lines)

```ts
export function stepUi<M extends ChapterManifest>(ctx: ChapterContext & { manifest: M }): StepUiApi<StepIdOf<M>>; // :135
interface StepUi<S> {                                    // :41-53
  define(steps: Partial<Record<S, StepUiSpec>>): void;  // merges; unknown step id throws (:163)
  value<T extends number | boolean | string = number>(id: string): T;   // throws if no control with a value (:175)
  set(id, value, opts?: { notify?: boolean }): void;    // sliders clamped; notify → onChange + listeners
  onChange(id, fn: (v) => void): void;                  // listeners are never removed
}
interface StepUiApi<S> extends StepUi<S> {              // :56-63
  press(id: string): void;                              // a button's onClick (+ flash)
  patch(id: string, p: ControlPatch): void;             // { label?, min?, max?, value?, disabled?, current? } (:26-38)
  toast(text, opts?: { icon?, duration?, tone? }): () => void;
}
```

The binding is keyed by the **full chapter id** (`:141-157`): call `stepUi(ctx)` once per scene; a second call
replaces the first. Values live as long as the chapter instance; `ui.value(id)` returns the declared default until
touched, in every step.

### 2.2 `StepUiSpec` — `app/src/hud/step-ui-types.ts:259-295`

```ts
interface StepUiSpec {
  controls?: ControlSpec[];        // dock under the step panel («Керування» tab on phones)
  board?: BoardSpec;               // big charts / tables / stats («Графіки» tab on phones)
  callouts?: CalloutSpec[]; hotspots?: HotspotSpec[];
  hint?: string;                   // toast on entry
  reset?: boolean;                 // controls back to defaults on every entry
  goal?: When;                     // path chapters: takeaway («Висновок») shows once it holds
  nav?: { hiddenUntil: When | 'goal' };            // navigator held back until …
  panel?: { hiddenUntil?: When; closingWhen?: When };
  honesty?: …                      // ignored (DECISIONS §60 x) — do not use
}
type When = boolean | (() => boolean);            // :15 — polled every frame, keep cheap
interface BoardSpec { title?: string; size?: 'sm' | 'md' | 'lg' | 'fill'; children: ControlSpec[]; visible?: When } // :244-257
```

Board widths: sm 380, md 520, lg 680 px-eq (`hud-dom/board/index.ts:18`); wide screens top-left right of the
spine, narrow full width under the header; its area insets the camera (frame shots for it).

### 2.3 `ControlSpec` — `step-ui-types.ts:17-185` (every spec: `id`, `hint?`, `visible?: When`, inputs `disabled?: When`)

| type | Fields (exact) | Lines |
|---|---|---|
| `slider` | `label, value, unit?, digits?, format?(v), marks?[{value,label}], onChange?(v), onInput?(v, 'drag'\|'jump'\|'step')` + `SliderScale` (`min, max, step?, scale?: 'log', stops?, snaps?`) | :28-43 |
| `toggle` | `label, value?, onChange?(b)` | :45-50 |
| `segmented` | `label?, items: {id,label}[], value?, onChange?(id)`; items named `ctl-<id>:<item>` | :52-59 |
| `button` | `label, icon?, primary?, onClick()` (sticky action row) | :61-67 |
| `readout` | `label, unit?, digits?, format?(v), get?(): number` **or** `text?(): string`, `color?(v)` — polled every frame | :69-81 |
| `gauge` | `kind?: 'radial'\|'linear', label, min, max, unit?, digits?, zones?, get()` | :83-93 |
| `chart` | `chart: ChartProps, init?(c: ChartApi), update?(c: ChartApi, t)` | :95-103 |
| `custom` | `node: UiNode` (WebGL), `dom?: (host: DomHost) => DomWidget`, `update?(t)` | :122-136 |
| `table` | `head?, rows: string[][] \| () => string[][], highlight?(): number, align?` | :139-149 |
| `stats` | `items: {label, get(): number\|string, unit?, digits?, color?()}[], columns?` | :152-164 |
| `note` | `text: string \| () => string, icon?, color?` | :167-172 |

`DomHost = { tweens: TweenScope; reducedMotion(): boolean }`, `DomWidget = { el; update?(t); dispose?() }` (:106-120).
`CalloutSpec { anchor: Object3D | [x,y,z] | () => Vector3; text: string | () => string; color?; side?; occluders?; visible?; priority? }` (:203-220).
`HotspotSpec { anchor; content?: number | string; title?; text?; occluders?; onOpen?(); visible? }` (:222-237).

### 2.4 How live values reach the screen each frame (answer)

- **Readout / stats / gauge**: `get()` / `text()` polled every frame while on screen; DOM writes only on change
  (`hud-dom/dock/controls/readout.ts:32-78`). Numbers that jump after holding still ≥ 0.25 s **count up over 0.45 s**
  (`STEADY`, `COUNT_UP`, `:19-20`); a streaming value (changes every frame) is shown as is; reduced motion: never.
  Default number format `fmtUnit(v, unit, { maxDigits: 2 })` (no SI prefix) — give `format: (v) => fmtSI(v, 'A')`
  for mA/μA/kΩ (`content/format.ts:73-82`, Greek μ). `text()` goes through rich markup (`setRich`).
- **Chart**: `update(chart, t)` runs every frame while the control is on screen; change data only when the inputs
  changed (UI_API `:233`). See §3.
- **Callout text**: `text: () => string` re-read every frame (step-ui-types `:205`).
- **Labels / ranges**: `ui.patch(id, { label, min, max, disabled, current })`.
- **Scene → control**: `ui.set(id, v)` (silent) or `ui.set(id, v, { notify: true })` (as a gesture).

### 2.5 How a step goal is checked (answer)

- Declared per step: `goal: () => reachedThisSession` (path-format chapters only — the DOM step panel builds the
  path body only when `pathStepModel(...)` returns non-null, i.e. the step's content has `path` data,
  `hud/model/path-step.ts:66-90`).
- Polled once per frame by the panel: `if (holds(ctx.goal)) return reveal();` (`hud-dom/step/path-body.ts:244`);
  reveal shows «Висновок» and adds `volume/chapter/step` to the HUD's private session set; a step without `goal`
  shows its takeaway at once (`:221-224`). Hints of the step appear at 15 s and 40 s (`HINT_AFTER = [15, 40]`,
  `path-step.ts:104`, `hintsDue` `:107`) until the goal holds.
- `nav: { hiddenUntil: 'goal' }` hides the navigator (and the → keys) until the goal first holds, then for the
  session (`hud/nav-gate.ts:23-33`); QA: `__ui.navHidden()`; the takeaway element is `data-ui="path-takeaway"`.
- The chapter keeps its own memory for captions «→ X»: circuit uses a **module-level** `Set` that survives scene
  rebuilds (`circuit/chapters/flow/chapter.ts:40-45`, `reached/reach/here` in `scene.ts:59-66`); a step's `update`
  calls `reach('connect')` when its condition holds (`flow/steps/01-connect.ts:136-138`). **REFERENCE** — the
  `Chapter`/`StepModule`/`StepFactory` contract (`flow/chapter.ts`, 46 lines) is circuit chapter code, not engine;
  copy the shape, not the file.

### 2.6 Other `@/hud` / `@/hud-dom` bits

| Item | Signature | Verdict |
|---|---|---|
| `hudLayer(ctx, name = 'chapter-layer'): HTMLElement \| null` | full-screen DOM layer in the chrome, removed with the chapter; null under `?hud=gl` (`hud-dom/custom/layer.ts:34`) | USE only if a step needs a DOM overlay the step UI cannot express |
| `domKit` | `h, setClass, setStyle, setText, color, rgbaColor, tone, svg, svgPainter, observeUnits` (`hud-dom/custom/kit.ts:13-95`) | USE inside `custom.dom` widgets (e.g. a colour-band picker); chapters ship no CSS |
| `pathEnd` | path-format closing helper (`hud/path-end.ts`) | USE on last steps (see circuit) |
| `journeyInset(ctx, {id?, onOpen?})`, `floorLadder(ctx, { floor })` | `@/hud-dom/journey` (UI_API §11a) | USE (prologue map, «де ми» ladder for stand→part→inside→atoms) |

---

## 3. Charts — `@/ui3d` `Chart` / `@/hud-dom` `DomChart` behind `ChartApi`

### 3.1 Types — `app/src/ui3d/charts/chart.ts` (226 lines), `axis.ts` (75)

```ts
interface ChartProps extends NodeProps {                 // chart.ts:50-61
  x: AxisSpec; y: AxisSpec; y2?: AxisSpec; series: SeriesSpec[];
  window?: number;            // live mode: push() appends, X shows the last `window` units
  legend?: boolean;           // default: on when > 1 labelled series
  onScrub?: (x: number) => void;
  height?: number;            // from NodeProps; default 220
}
interface SeriesSpec { id; label?; color: ColorLike; axis?: 'y'|'y2'; kind?: 'line'|'area'|'bars'|'step';
                       width?: number /*2.6*/; stack?: string; dash?: boolean | [on, off]; opacity?: number }  // :21-38
interface MarkerSpec { x; y; axis?; color?; label?; guides?: boolean /*true*/ }                                 // :40-48
interface AxisSpec { min; max; log?; label?; ticks?; tickCount? /*5*/; format?(v); bare?; years? }             // axis.ts:7-27
interface ChartApi {                                                                                             // :67-78
  setData(id, xs: ArrayLike<number>, ys: ArrayLike<number>): void;   // NaN/±Inf break the curve
  push(id, x, y): void;
  clearData(id?): void;
  setAxis(which: 'x'|'y'|'y2', spec: Partial<AxisSpec>): void;
  setMarker(id, marker: MarkerSpec | null): void;
}
```

Channels = series (one id per trace; colours by semantic token). Markers: operating point with dashed guides; a
moving marker repaints only the marker layer in DOM (3 canvases: grid / data / markers, `hud-dom/charts/chart.ts:25-31`).

### 3.2 Behaviour and limits (both renderers)

- **No engine cap on points or sample rate.** UI_API says 30–120 Hz pushes are fine (`docs/UI_API.md:298`); the
  WebGL `PlotMesh` is "cheap enough for 30–60 Hz live plots of a few thousand points" (`ui3d/charts/plot.ts:1-5`),
  buffers grow ×2 on demand. One draw call per chart (WebGL).
- `push` with `window`: drops samples older than `x − window` (keeps one beyond the edge) and scrolls the X axis
  **only forward** (`if (x > ax.max)` — WebGL `chart.ts:142-161`, DOM `hud-dom/charts/chart.ts:87-109`). After a time
  reset call `clearData()` + `setAxis('x', { min: 0, max: window })`.
- `push` **without** `window` grows unbounded — always set `window` for streams, or use `setData` for sweeps.
- DOM `setData`/`push` copy into JS arrays (`Array.from`) and mark dirty; `render()` (called by the widget each
  frame) repaints only what changed. Static charts get a hidden a11y table, ≤ 24 rows per series, rebuilt ≤ 2×/s
  (`hud-dom/charts/a11y.ts:12`, `chart.ts:169-175`).
- **DOM chart widgets are rebuilt on every step entry** (`hud-dom/dock/build.ts:94-97` → `chartWidget(spec)`,
  `hud-dom/charts/index.ts:21-33`: `new DomChart`, `spec.init?.(chart)` once, then `update` + `render` per frame;
  disposed on leave). History pushed in an earlier step is gone → keep sample buffers in the scene, refill in
  `init`.
- Under `?hud=dom` a scrub chart is also a keyboard slider; log axes label decades; years auto-detected.
- Axis titles «symbol, unit» in Latin (`U, V`, `t, ms`, `I, mA`) — allowed in scene code; legend/series labels in
  Ukrainian must come from content captions.

**Oscilloscope recommendation (inferred from the above):** a board `chart` with fixed `x: { min: 0, max: span }`
(time per screen) and `setData(id, xs, ys)` once per frame **only when a new sweep is ready** (a triggered sweep
from the model's transient solution, ≤ ~500 points per channel), rather than `push` + `window` (which scrolls and
cannot show a stable triggered trace). Two channels = two series (`y` and `y2` if volts/div differ).

### 3.3 Existing usages of charts (grep `type: 'chart'`, `new Chart(`, `new DomChart(`, `chartWidget(`)

Circuit and radio: **none.** Platform: `hud/dock-build.ts:249` (WebGL `new Chart(c.chart)`),
`hud-dom/dock/build.ts:95` (`chartWidget(c)`), `ui3d/examples/step-ui-example.ts:55`.
Dev sandboxes: `_dev/chapters/_sandbox-ui/parts/step-ui.ts:73`, `step-board.ts:64`, `step-overflow.ts:63`,
`dom-widgets.ts:30` (+ `chartWidget` at `:83`), `readouts.ts:44,68,80` (`new Chart`), `extras.ts:38`,
`dom-charts.ts:51,73,84,131` (`new DomChart`; dev chapter imports `@/hud-dom/charts` directly — lint allows it).

Electricity (`app/src/volumes/electricity/chapters/…`), `type: 'chart'` at:
- live `window` + `push` (scrolling): `magnetism/steps/09-inductance.ts:152` (window 1.5, 3 series incl. `y2`,
  push at `:167-169`), `magnetism/steps/07-induction.ts:189` (window 3, push `:203-204`),
  `magnetism/steps/11-to-generator.ts:147` (window 2, `:161-162`), `matter/steps/09-devices.ts:237` (window 4,
  rectifier in/out, push `:251-252`), `plant-nuclear/steps/reactor-sim.ts:89` (window 300, `:104-106`),
  `transformer/steps/07-three-phase-groups.ts:112` (window 2), `plant-hydro/steps/reservoir-environment.ts:178`
  (push `:195-196`).
- `setData` on change + `setMarker` (static curves): `generator-ac/steps/09-rlc.ts:109` (I(f), |Z|(f) dashed on
  `y2`, keyed recompute, marker at `:129`), `lab-inverter/steps/04-pwm.ts:164` (log-log bars spectrum, version
  key), `lab-inverter/steps/02-switches.ts:192`, `05-lc-filter.ts:196`, `06-dc-link.ts:257`, `08-grid-tie.ts:300`,
  `lab-pv/ui-bits/curve-chart.ts:43`, `lab-pv/steps/08-orientation.ts:111`, `09-array.ts:124`, `10-mppt.ts:106`,
  `11-lifecycle.ts:85`, `current/steps/04-ohm-board.ts:42`, `charge-field/steps/02-coulomb.ts:288`,
  `08-bridge.ts:168`, `matter/steps/05-resistance.ts:228,243`, `08-pn-junction.ts:114,133`, `atom/steps/03-nucleus.ts:213`,
  `magnetism/steps/02-domains.ts:183`, `lab-battery/steps/06-voltage-capacity.ts:181`, `07-charging.ts:171`,
  `09-bms.ts:150`, `10-degradation.ts:132`, `11-safety.ts:173`, `12-scale-and-future.ts:142`,
  `transformer/steps/02-turns-ratio.ts:163`, `03-why-high-voltage.ts:123`, `05-tap-changer.ts:103`,
  `06-losses-efficiency.ts:131`, `plants/steps/04-heat-engine.ts:89`, `05-rankine.ts:106`, `06-brayton.ts:90`,
  `08-metrics.ts:107,117`, `plant-gas/steps/brayton-sim.ts:57,80`, `combined-cycle.ts:56`, `emissions-hydrogen.ts:72`,
  `flexibility.ts:77,104`, `hot-section.ts:87`, `natural-gas.ts:65`, `plant-nuclear/steps/chain-reaction.ts:91`,
  `control.ts:89,100`, `fission.ts:109`, `reactor-types.ts:56`, `safety.ts:81`, `plant-hydro/steps/generator-governor.ts:117`,
  `pumped-storage.ts:117`, `role-ukraine.ts:113`, `turbines.ts:135`, `water-path.ts:132`, `plant-wind/steps/betz.ts:58`,
  `blade.ts:64`, `capacity-factor.ts:98,105,111`, `power-curve.ts:63`, `role.ts:131,150`, `wind-farm.ts:94`,
  `wind-power.ts:65`, `plant-coal/steps/chp-flex.ts:84,104`, `role-ukraine.ts:85`, `steam-params.ts:93`.

Best templates for us: `matter/steps/09-devices.ts:230-262` (diode rectifier in/out on one live chart),
`generator-ac/steps/09-rlc.ts:95-140` (recompute-on-key + marker + stats row), `magnetism/steps/09-inductance.ts:140-185`
(`y2`, `reset: true`). **REFERENCE.**

### 3.4 3D oscilloscope (scene instrument) — `@/fx` signals

```ts
// fx/signals/scope.ts:13-28, :40-131
interface ScopeOptions { width?: 4; height?: 2.4; channels?: ColorLike[] /*L1/L2/L3*/; samples?: 160; cycles?: 2;
                         frequency?: 0.5 /*Hz, slowed*/; lineWidth?: 0.035; accent? }
class Scope extends Group { screen; frequency; phase; frozen;
  setWave(i, wave: Waveform | null, amplitude = 1); setSamples(i, values: ArrayLike<number> /* −1…1, resampled */);
  push(i, value); setChannelIntensity(i, v) }
export function createScope(o?: ScopeOptions): Scope;      // self-ticks via onTick (no update call needed)
export function createScreen({ width, height, kind?: 'grid'|'polar', divisions?, accent? }): Screen;  // fx/signals/screen.ts:98
new RibbonLines({ capacity, color, width, intensity, hotCore, dashStrength, endFade, minPixels, mitre, keepHue }) // fx/core/ribbon
```

Cost: 1 screen + 1 draw call per channel; 160 points per channel per frame (FX_API `:406`). Values are clamped to
±1.15 of half-height. Text (V/div) is ours (Text3D). Prior art: `electricity/chapters/lab-inverter/parts/bench-scope.ts`
(198 lines: `createScreen` + two `RibbonLines` tracks + spectrum bars; deps `@/fx`, `@/style`,
`../sim-bindings/wave-lab`) and `generator-ac/parts/holo-scope.ts`. **USE** `createScope`/`createScreen`/`RibbonLines`;
bench-scope = **REFERENCE** (drags electricity sim-bindings).

---

## 4. Text from documents to the screen

- Chain: `docs/volumes/electronics/chapters/<id>.md` → `tools/content` (path format) →
  `app/src/volumes/electronics/content/generated/<id>.json` + `<id>.manifest.json` → chapter `content.ts`
  (`defineContent(raw)`) → HUD finds `chapters/<id>/content.ts` by glob and renders the step panel itself
  (UI_API §2, `docs/UI_API.md:34-84`). `index.ts` spreads `...manifestText(meta)` and `axisValue: meta.axisValue`
  (`circuit/chapters/flow/index.ts`).
- Scene words (control labels, callouts, legend names) come from «Підписи» = `steps[].labels[]` via a
  `caption(step, i)` helper that throws on a missing index (`circuit/chapters/flow/content.ts:1-17`). Constraint:
  no Ukrainian word in scene code.
- Path panel fields: «Текст» → `panel[]` paragraphs (no formulas allowed there — `path_check`), «Що зробити» →
  `action`, «Висновок» → `takeaway` (shown when `goal` holds), «Докладніше» → `more[]`, hints → `hints[]`
  (`hud/model/path-step.ts:78-90`, `hud-dom/step/path-body.ts:141-187`).
- **Formula styling (STYLE_GUIDE §6 "formulas in `yellow` on a darker inset", `docs/STYLE_GUIDE.md:159-160`)** —
  as implemented in the DOM HUD: inline `` `U = I·R` `` in any rich text (panel, takeaway, more, readout `text()`,
  callouts, captions) → `<code class="f">` in `var(--c-yellow)`, mono, 0.95 em, **no background**
  (`hud-dom/core/rich.ts:20`, `hud-dom/core/base.css:140-148`); formulas ≤ 28 chars never wrap
  (`NOWRAP_FORMULA`, `text/markup.ts:20`). The **dark inset** exists only for the non-path «Формули» section:
  `.formula { background: rgb(var(--c-bg-void-rgb) / 0.66); border-radius; padding }`
  (`hud-dom/step/step.css:213-221`, built in `hud-dom/step/sections.ts:73-74`). Path steps (our format) render
  takeaway/more through `prose()` → `richEl` (`hud-dom/step/typo.ts:12-14`) → yellow inline, no inset.
- Markup (both renderers, `@/text` `richRuns`): `**term**`, `_em_`, `` `formula` ``, `x^2`, `10^{-19}`, `U_{rms}`,
  `V_oc`, `{token:text}`; number + unit get a no-break space automatically.
- World text: `Text3D` (`@/text`), `screenSpace: true` + `billboard: true` + `toOverlay(obj)` for crisp labels; min
  16 CSS px (`minScreenPx`); chapter-check fails world text < 16 px-eq at 1280×720 (ENGINE_API `:723-726`). Prefer
  callouts for legible labels (UI_API `:506`).
- Numbers: `fmtNumber`, `fmtUnit`, `fmtSI`, `fmtSci`, `fmtPercent`, `fmtRange` (`content/format.ts:26-104`) —
  decimal comma, real minus, μ.

---

## 5. Materials, models, heat, glow — `@/style`, `@/kit`, `@/fx`

| Item | Signature (file:line) | Verdict |
|---|---|---|
| `K.toon / K.metal / K.glow / K.glass / K.flat / K.energy / K.hologram` | ENGINE_API §7 table (`:262-271`); all support `InstancedMesh` + `setColorAt`, `fade`, clipping | USE (only K materials) |
| `col(token, out?)`, `SEMANTIC`, `voltageRamp(t)`, `heatRamp(t)`, `temperatureRamp(t)` | `style/palette.ts:171`, `:269-282` | USE |
| `applyHeat(material: KToonMaterial, t: 0…1, maxIntensity = 2.2)` — emissive along `orange→red`, ∝ t² | `fx/thermal/heat.ts:103-107` | USE for warming/burning parts (t from model power/temperature) |
| `createHeatShimmer({ width, height, lines, intensity })` | `fx/thermal/heat.ts:94` | USE (hot resistor) |
| `createSmoke(ctx, { radius, height, axis, wind, count, color })` | `fx/thermal/vapour.ts:71` | USE — only as model output (constraints: no "smoke recipe"; burn = honest consequence) |
| `createSparks(ctx, opts)` → `burst(pos, n, dir?, spread?)`; `createShortCircuit(ctx).fire(pos)`; `createHalo({ color, size, intensity })` | `fx/drama/sparks.ts:64`; FX_API §6 | USE (LED/lamp halo, short) |
| `createOutline(mesh)` → `amount`, `setSelected()`; `ctx.onDispose(() => o.dispose())` | FX_API §8 (`:285`, `:296`) | USE for cyan affordance / yellow selected (STYLE_GUIDE §2.2.1) |
| `createWire(curve, { radius, color, repeat, speed })`, `createFlow(ctx, { kind:'electron', paths, … })`, `flowNetwork` (Kirchhoff split) | FX_API §3–§4 | USE for jumper wires / current pulses |
| `onTick(object, fn(t, dt))` — self-tick once per engine-time value while visible | `fx/core/tick.ts:25-37` | USE inside our own effect objects |
| `Builder` (kit) — `new Builder(name, opts?)`; `box(w,h,d,{r,slot,c,at})` `:506`, `cyl(r,h,{seg,axis,…})` `:517`, `ring` `:540`, `lathe` `:544`, `tube` `:549`, `rod` `:554`, `part(name, place)` `:384`, `anchor(name,x,y,z)` `:395`, `path()` `:416`, `frame(place, fn, prefix)` `:369`, `build(): KitModel` `:579`; `G.*` geometry | `kit/core/builder.ts` (653 lines) | USE for resistors/capacitors/transistors/board (2–6 draw calls each; colour baked per vertex from tokens) |
| `instanced(model, placements)`, `Placement { at, ry?, s?, tint? }` | `kit/core/instancing.ts`, `builder.ts:637` | USE for hundreds of breadboard sockets (≤ 350 draw calls budget) |
| Kit labels / grips / picking / drag helpers | — (none exist; `kit/index.ts:5-76`) | n/a — see §1.3 |

Resistor colour bands vs palette: tokens exist for black≈`ink`/`bg.void`, brown=`wireBrown` (`palette.ts:46`), red,
orange, yellow, green, blue, violet, grey≈`steel`/`slate`, white; **no gold / silver tokens**. `ColorLike` accepts hex
(`palette.ts:116`) and lint does not stop hex, but ENGINE_API §19 forbids hard-coded hex in chapters → derive via
`col('amber').lerp(col('wireBrown'), k)` as the kit does (`builder.ts:135-138`) and record it in the volume's colour
table (STYLE_GUIDE §2.2.x; platform tokens cannot be added — read-only).

---

## 6. Clock, ticking, determinism

- `ClockView { time; dt; frame }` (`engine/clock.ts:5-12`). `MAX_FRAME_DT = 1/15` (`:15`) clamps a real frame;
  `FIXED_DT = 1/60` (`:17`) for `?freeze` fast-forward and `__app.step`. Under `?freeze=N` time stands still after
  N simulated seconds; updates run with `dt = 0` on held frames. First frame after a hidden tab: `dt = 0`.
- All animation and simulation stepping from `update(dt, t)`, `ctx.tweens` (`to`, `value`, `delay`, `wait`,
  `timeline`, `scope()` — `engine/tween.ts:293-353`), or `uKTime`. Timers: `ctx.tweens.delay(s, fn)` /
  `ctx.stage.scope.delay(...)` (killed on step change).
- Random: `ctx.random` (seeded per chapter id); in `sim/**` use the model's own seeded RNG.
- Step state not driven by `stage` must be re-derived in `enterStep` (random access + step spamming in chapter-check).
- **Enforced** (`app/eslint.config.js`): all `src/**/*.ts` — `no-restricted-globals: setInterval` (`:29-32`);
  `src/volumes/*/chapters/**/*.ts` only (`:37`) — `no-restricted-properties` `Date.now`, `performance.now`,
  `window.setTimeout`, `Math.random` (`:54-60`), `no-restricted-imports` `@/engine/*` except `@/engine/api`, `gsap`
  (`:40-51`), `local/chapter-boundary` (`:53`); all `src/**` — `local/volume-boundary` (`:63-68`).
- **Not enforced by lint**: bare `setTimeout(...)` (only `window.setTimeout` is caught), `requestAnimationFrame`,
  `new Date`, anything in `shared/**` (radio's `shared/link/index.ts:82` uses `performance.now()` legitimately for a
  diagnostics metric). `sim/**` is guarded by the volume's own text-scanning test
  `electronics/sim/core/__tests__/purity.test.ts` (123 lines): forbids `Math.random`, `crypto.getRandomValues/randomUUID`,
  `Date.now`, `new Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `document.*`,
  `window.*` — **even in comments** (`:30-41`) — and any import leaving `sim/` (`:43-58`); scans every `.ts` under
  `sim/` recursively except `__tests__` (`:62-66`).

---

## 7. Workers — engine has none; radio's link is the pattern

Engine: no worker helper, no worker pool, no flag on `ctx` (grep `new Worker` → only radio). Vite config has no
`worker` key (`app/vite.config.ts`); tsconfig `lib` has no `WebWorker`; vitest `environment: 'node'` has no `Worker`
(facts: `sim-worker-lint.md:153-176`, `:306-348`).

Radio files (`app/src/volumes/radio/shared/link/`):

| File | Lines | Exports / what | Imports a copy drags along | Verdict |
|---|---|---|---|---|
| `index.ts` | 250 | `createLink(ctx, { seed?, mode?: 'auto'\|'worker'\|'sync', makeWorker? }): Link` (`:91`); `Link { mode; frame; frames; fps; pump(state, luma, probe): boolean; still(state, luma, probe): LinkReply; dispose() }` (`:43-62`); `WorkerLike` (`:30-35`); `LINK_SYNC_EVERY = 6`, `LINK_MAX_FPS = 25` (`:65-67`); one request in flight, freshest state wins, throttled by **engine** time; worker failure → sync for good with one `console.error`; `ctx.onDispose(dispose)` (`:248`); spawn literal `new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' })` (`:88-89`) | `@/engine/api` (type), `@radio/sim/core` types `FmLinkState`, `ProbeRequest`; `./handler`, `./protocol` | **COPY+ADAPT** only if the electronics model needs a thread: rename to circuit model, replace `FmLinkState/luma/probe` by `Netlist` (+ transient request), keep in-flight/throttle/fallback/still logic |
| `handler.ts` | 68 | `createHandler(now: () => number): Handler` — `init` / `frame` → reply + transfer list; never throws out (`:46-68`) | `@radio/sim/core` (`createFmLink`, `FmLink`, `FmLinkFrame`, `ProbeData`) | COPY+ADAPT with the above |
| `protocol.ts` | 29 | `LinkRequest`, `LinkReply`, `ToWorker`, `FromWorker` | `@radio/sim/core` types | COPY+ADAPT |
| `model.worker.ts` | 9 | `/// <reference lib="webworker" />`, `declare const self: DedicatedWorkerGlobalScope`, `self.onmessage → handler.handle → self.postMessage(reply, { transfer })` | `./handler`, `./protocol` | COPY (path rename only) |
| `__tests__/link.test.ts`, `handler.test.ts` | 272, 96 | `FakeWorker` pattern, sync-mode tests | — | COPY+ADAPT if the link is copied |

`?freeze` handling: radio forces `mode: 'sync'` when frozen and computes a `still` frame on a held frame only when
the state changed (`radio/shared/world/index.ts:207-223`, `:232-246`). Readers: `__app.read('radio-world')` exposes
`mode`, `frames`, `fps`, `modelMs` (`:146-156`).

Assessment (inferred): a DC/MNA solve of a breadboard (tens of nodes) costs ≪ 1 ms → main thread, on change
only. A worker becomes worth it only for long transient runs (oscilloscope sweeps, audio-rate buffers). Budget rule:
avoid > 10 ms synchronous work in `update` (ENGINE_API `:526`); frame ≤ 8 ms at 1080p.

---

## 8. Audio — platform facade vs a volume-local Web Audio output

Platform `@/audio` (`app/src/audio/index.ts`, 23 lines; `audio.ts`, 30): **USE** for UI-ish sounds.

```ts
audio.play(name: OneShotName, { gain?, pitch? }?)   // click, toggle, tick, success, error, zap, spark, breaker, relay, …
audio.loop(name: LoopName).set({ gain?, pitch? })   // hum, turbine, water, steam, wind, fire, geiger, buzz — set in update/enterStep
audio.mood(name | null); audio.stopLoops(fade?); audio.unlocked: boolean; audio.names
```

Facts that shape a volume-local output (speaker playing the model's signal):
- The platform's `AudioContext`, master bus and limiter are **not exported** from the barrel (`AudioEngine.context`
  and `loopBus` are public fields, reachable only by a deep import `@/audio/audio` → `engine`; nobody does that today).
- Plugin wiring to mirror (`audio/plugin.ts:32-85`): `?noaudio` → `engine.disable()`; `input.gesture.then(unlock)`;
  `setVolume(volume, audio)` on both settings; **suspend on `visibilitychange`**; stop loops on `chapter` event.
- Master level: `enabled ? volume² × 0.55 : 0` through a compressor (thr −12 dB, ratio 20) (`audio/engine.ts:11`,
  `:108-117`, `:140-145`).
- `audio.unlocked` is `false` forever with `?noaudio` and before the gesture (`audio.ts:20-23`, `engine.ts:93-99`).
  The plugin registers its `gesture.then(unlock)` at mount, before any chapter, so in a chapter
  `ctx.gesture.then(() => { if (!audio.unlocked) return; … })` sees the final answer.
- A local output must therefore: start only after `ctx.gesture`; stay silent when `!audio.unlocked`; follow
  `settings.audio` / `settings.volume` via `ctx.store.subscribe` (+ `onDispose`); suspend with `document.hidden`
  (listener removed in `onDispose`); close its nodes/context in `ctx.onDispose`; produce sound only from the model's
  output (constraints: no recorded "effect" sounds). Determinism: audio runs on real time — never read audio state
  back into the scene or the oscilloscope; QA reads model numbers via `qa.expose`.
- Verdict: **REFERENCE** `audio/plugin.ts` + `audio/engine.ts:98-145` for the gating; write `electronics/shared/sound/**`.

---

## 9. World UI and instruments in the scene

| Item | Signature | Verdict |
|---|---|---|
| `worldSurface(ctx, { width, height, unit, mode?: 'overlay'\|'scene' })` | `ui3d/host.ts` (UI_API §8) | USE sparingly — WebGL widget tree |
| `worldConsole(ctx, { title, width?, unit, children, maxGrow? }) → { surface, panel, textPx, grow }` | `ui3d/console.ts:74` | open question under the DOM HUD (phone moves it into «Графіки» per UI_API `:544`); UI_API prefers the board for anything read |
| `toOverlay(obj)`, `worldBounds(obj, out?)` | `engine/layers.ts:18`, `:30` | USE (crisp labels, LCD digits) |
| Multimeter digits | show the number in a HUD `readout` (plan) and optionally a `Text3D` on the 3D LCD fed by the same getter | USE |

---

## 10. QA patterns (interaction tests)

- Chapter QA scripts live in `chapters/<id>/qa/*.mjs` (circuit: `flow/qa/helpers.mjs`, `interactions.mjs`) using
  `tools/qa/lib.mjs` (`parseArgs` `:37`, `appUrl` `:100`, `launch` `:132`, `openApp` `:155`, `hudMode` `:174`,
  `appErrors` `:179`). Helpers: `advance(page, s)` → `__app.step(1/60, n)` on `?freeze`; `locate(page, id)` →
  `__ui.locate('ctl-<id>')` (opens the phone sheet tab when needed); `read(page, name)` → `__app.read(name)`;
  `at(page, probe)` → `__app.locate(probe)`.
- Unit tests: `src/**/*.test.ts`, vitest node env; chapters keep `__tests__/manifest.test.ts` (step ids = generated
  manifest). Tests must pass against a production build for interaction scripts (ENGINE_API `:715-716`).
- `chapter-check` fails on any console warning/error, > 350 draw calls, > 1.5 M triangles, frame > 8 ms, leaks
  across 3 leave/return cycles, text < caption size, HUD region overlaps; tools need `--out <dir>` on this machine.

---

## Gotchas

1. **`ctx.gesture`, not `ctx.input.gesture`** — `ScopedInput` has no `gesture` (`input.ts:114-130`); the plugin-level
   `engine.input.gesture` is what ENGINE_API §15 means.
2. **No URL flags on `ctx`**: sniff `location.search` for `freeze` (radio `world/index.ts:232`); infer `noaudio` from
   `audio.unlocked`.
3. **`ctx.store.subscribe` is global** — leaks across chapter instances unless unsubscribed in `ctx.onDispose`.
4. **DOM HUD is the default** (`engine/app.ts:53`); UI_API text about `gl` default is stale. Every `custom` control
   needs a `dom` factory, otherwise a warning → chapter-check failure (D9). `hudSurface` is WebGL-only.
5. **DOM chart widgets are rebuilt per step entry** (`hud-dom/dock/build.ts:94-97`): `init` runs each entry; pushed
   history is lost; keep buffers in the scene.
6. `Chart.push` scrolls X only forward; without `window` it grows unbounded; `setMarker` ignores identical markers.
7. Readout count-up (0.25 s steady → 0.45 s tween) can make a multimeter look "laggy" after a probe jump; use
   `text()` with `fmtSI` for an instant value. Default readout format has no SI prefix.
8. `stepUi(ctx)` once per scene (binding keyed by full chapter id); `ui.onChange` listeners are never removed — add
   them in the factory, not in `enter`; `ui.value(id)` throws for undeclared ids.
9. Goal / takeaway / hints work **only for path-format content** (`pathStepModel` non-null); a step without `goal`
   shows the takeaway immediately. The HUD's reached-set is private: keep your own (circuit: module-level `Set`,
   deliberately against ENGINE_API §19 "no module-level state", to survive scene rebuilds).
10. Formula "yellow on a darker inset" is only the non-path «Формули» section; in path steps formulas are inline
    yellow mono without inset (`rich.ts:20`, `base.css:140-145`, `step.css:213-221`). Path «Текст» must hold no
    formulas at all (`path_check`).
11. Lint determinism rules cover `chapters/**` only; bare `setTimeout`, `requestAnimationFrame`, `new Date` slip
    through lint — the docs still forbid them. `sim/**` purity test rejects forbidden names **even in comments**
    and any import leaving `sim/` (so a worker or `performance.now` must live in `shared/`).
12. Volume boundary: `electronics` may not import `@circuit/*`, `@radio/*`, `@electricity/*`; dev sandboxes
    (`_dev/chapters/_sandbox-electronics-*`) may import only `@electronics/shared/**` (`eslint-rules/chapter-boundary.js:24-27`),
    so anything a sandbox needs from `sim/**` must be re-exported through `shared/**` (radio did so in
    `shared/world/index.ts`).
13. Chapter lint allows deep platform imports other than `@/engine/*` (e.g. `@/hud-dom/charts`, `@/audio/audio`) —
    legal but couples to internals; prefer barrels.
14. Worker typing: no `WebWorker` lib → `/// <reference lib="webworker" />` + `declare const self: DedicatedWorkerGlobalScope`
    (radio `model.worker.ts`); importing a worker entry in vitest throws (`self` undefined) → test the handler as a
    plain module with a `FakeWorker`. Use the literal `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`.
15. `MAX_FRAME_DT = 1/15`: a thermal/transient model integrated from `dt` must tolerate 66 ms steps and `dt = 0`
    (held frames, first frame after a hidden tab).
16. `ctx.random.fork(label)` consumes the parent stream — create forks in a fixed order.
17. Hex colours are not linted but forbidden by ENGINE_API §19; palette has no gold/silver for resistor bands.
18. World `Text3D` < 16 px-eq at 720p fails chapter-check; missing glyphs warn (fail) — keep scene text to captions
    from content and Latin symbols the atlas has (Ω, μ are covered).
19. Perf: breadboard sockets must be instanced (≤ 350 draw calls; shadows double casters; K materials support
    `InstancedMesh.setColorAt`). Each `Outline` is +1 draw call per mesh.
20. Audio plugin stops **its** loops on chapter change and suspends **its** context on hidden tab — a volume-local
    output must do both itself.
21. Docs `HUD_DOM.md`, `PATH_FORMAT.md`, `MOBILE.md` are referenced but absent in this repo — read the code.
22. Constraints (`.superpowers/sdd/2026-11-20-electronics/constraints.md`): no Ukrainian in scene code; μ is U+03BC;
    apostrophe U+2019; no `pnpm format`; commits without AI notes; tests compare `qa.expose` numbers, not pixels.

## Open questions

1. Audio: own `AudioContext` in `electronics/shared/sound` (second context, own limiter, own visibility/mute
   handling) **or** a deep import of the platform `engine` (`@/audio/audio`: `context`, `loopBus`) to share the
   master limiter? The barrel exposes neither; platform is read-only.
2. Music player source: synthesised in code (deterministic, no sample files — matches `@/audio` practice) or a
   bundled audio file (none exist in the repo; would be a new asset type)? Constraints forbid recorded *effects*.
3. Do we need a worker at all? DC solve is tiny; decide after measuring the transient solver (oscilloscope sweep,
   audio buffers). If yes, copy radio `shared/link` (4 files, 356 lines) with types swapped.
4. Oscilloscope on the board: triggered sweep via `setData` (recommended) vs scrolling `push` + `window`? And the 3D
   scope: `createScope().setSamples` (resampled to 160 points, values −1…1) or custom `RibbonLines`?
5. `worldConsole` under the default DOM HUD — still drawn as WebGL in the world on desktop? (Not verified in a
   browser; the board is the safe place for anything read.)
6. Electronics colour table (STYLE_GUIDE §2.2.x): resistor code colours incl. gold/silver, LED colours, polarity
   (+ coral / − blue from volume 1?), heat — where does it live (docs/volumes/electronics/VISUAL.md + volume-local
   token map) since `app/src/style` is read-only?
7. Path-format panel shows formulas inline without the dark inset STYLE_GUIDE §6 promises — acceptable, or does the
   volume need a platform request?
8. Goal memory: follow circuit (module-level session `Set`) or keep reached goals per scene instance?
9. LIBRARY.md §4 (`docs/LIBRARY.md:53`) assigns "транзистор" to the `computing` volume — the electronics volume's
   transistor/amplifier chapters overlap that boundary (not a platform issue; flag for the orchestrator).
10. The electricity constructor (`current` step 7: grid + tray + snap, step 9 multimeter) is the closest prior art for
    the breadboard; is any of it worth copying into `electronics/shared` (needs REUSE.md entry and rewriting off
    `@electricity/sim/current`), or only used as a reference?
