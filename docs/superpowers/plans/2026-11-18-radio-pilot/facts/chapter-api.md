# Engine API a path chapter's code uses — facts for the `radio` plan

Verified in this run against the copy at `/home/pilot/tmp/radio-science-pop` (HEAD `63fd42c`). All paths are
repo-relative. three.js is `0.187.0` (`app/package.json:20`, `app/node_modules/three/package.json`).

Files opened: `docs/ENGINE_API.md` (all 843 lines), `docs/API_CHANGES.md:500-675`, `docs/UI_API.md` (all 564),
`docs/DECISIONS.md:380-459`, `docs/ARCHITECTURE.md:8-24,112-182`, design doc lines 1-330, 466-877;
`app/src/engine/{api,chapter,stage,runtime,app,clock,random,tween,store,nav,hud,quality,device,layers,disposables,qa-probes,events,volume}.ts`,
`engine/input.ts:1-145`, `engine/registry.ts:80-153`, `engine/camera/director.ts`, `engine/pipeline/pipeline.ts`,
`engine/pipeline/post-params.ts:100-144`, `engine/debug/api.ts:1-260`, `content/types.ts`,
`hud/{step-ui,step-ui-types,where,nav-gate,path-end}.ts`, `hud/model/path-step.ts`, `hud/index.ts`,
`hud-dom/step/{step-panel,path-body}.ts`, `hud-dom/step/header.ts:60-92`, `hud-dom/journey/{ladder,inset,index}.ts`,
`hud-dom/custom/{layer,kit}.ts`, `hud-dom/dock/{index.ts:60-175,build.ts:90-140}`, `style/materials/globals.ts`,
`style/env/environment.ts:100-360`, `style/motion.ts`, `fx/core/tick.ts`, `app/eslint.config.js`,
`app/eslint-rules/chapter-boundary.js`, `app/vite.config.ts`, `app/tsconfig.json`, and the reference chapters
`volumes/circuit/chapters/{wire,drain,prologue}/…`, `volumes/circuit/shared/world/index.ts`,
`volumes/_path/shared/placeholder.ts`, `volumes/_path/chapters/_sandbox-path/*`.

**Documents that code/docs refer to but that do NOT exist in this copy:** `docs/PATH_FORMAT.md`, `docs/MOBILE.md`,
`docs/HUD_DOM.md`, `docs/VOLUME_STRUCTURE.md`, `docs/AGENT_GUIDE.md`, `docs/briefs/`, `docs/reports/` (ENGINE_API
§9 cites `docs/reports/F1-core.md`), `docs/requests/`. `COPY_STYLE.md` exists only as
`docs/volumes/circuit/COPY_STYLE.md`. Existing: `docs/VOLUMES.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`app/src/engine/examples/minimal-chapter/`, `_dev/chapters/_sandbox-{micro,diorama,studio,ui}`.

---

## 1. Chapter module contract

### 1.1 Files of a chapter (ENGINE_API §2, `docs/ENGINE_API.md:51-57`)

```
app/src/volumes/<volume>/chapters/<id>/
  index.ts      manifest — `export default defineChapter({...})`
  scene.ts      `export default defineScene((ctx) => {...})`   (+ parts/*.ts for bigger scenes)
  content.ts    all Ukrainian text of the chapter
  emblem.ts     optional tiny model for the journey map
```

Auto-discovery: existing directory = registered chapter; `manifest.volume` is bound by discovery
(`bindChapter`, `engine/chapter.ts:104-107`). Lazy chunk names (`app/vite.config.ts:61-68`):
`assets/chapter-<volume>-<id>-<hash>.js` (matched on `volumes/<v>/chapters/<id>/scene.ts`),
`assets/volume-<volume>-<hash>.js` (`volumes/<v>/chapters.ts`).

### 1.2 `defineChapter` (`app/src/engine/chapter.ts:83-98`)

```ts
export type ChapterSpec = Omit<ChapterManifest, 'volume'>;
export function defineChapter<const M extends ChapterSpec>(spec: M): M & { readonly volume: string }
```

| Field (`ChapterManifest`, `chapter.ts:46-78`) | Type | Notes |
|---|---|---|
| `volume` | `string` | filled by `bindChapter`; authors do not write it. Full id `<volume>/<id>` = `fullChapterId(manifest)` |
| `id` | `string` | regex `/^[A-Za-z0-9_][A-Za-z0-9_-]*$/` (`chapter.ts:80`); = directory name |
| `order` | `number` | position on the main path (children: among siblings) |
| `group` | `ChapterGroup` (= `string`) | one of `volume.json → groups[].id` |
| `parent?` | `string` | parent chapter id |
| `title`, `subtitle` | `string` | |
| `axisLabel` | `string` | place on the journey axis as shown; in a path volume it equals a floor label (`hud/where.ts:62` matches `f.label === m.axisLabel`) |
| `axisValue` | `number` | number on the volume axis; node height on the map + zoom direction |
| `theme` | `ChapterTheme { accent: AccentName; sky: EnvPresetName; mood: Mood }` | `sky`: `'micro' \| 'studio' \| 'day' \| 'golden' \| 'dusk' \| 'night'` (`style/env/presets.ts:81`); kind `space/studio/sky` fixed per chapter. `mood`: `'micro' \| 'studio' \| 'diorama'` (`engine/pipeline/post-params.ts:102`) |
| `steps` | `readonly StepManifest[]` | `{ id, title, blurb }`, ≥ 1, ids unique |
| `load` | `() => Promise<{ default: SceneModule }>` | `() => import('./scene')` |
| `emblem?` | `() => Promise<{ default: () => Object3D }>` | |
| `dev?` | `boolean` | hidden unless `?debug` |

Errors thrown by `defineChapter` (verbatim): `defineChapter: invalid chapter id '${id}'`,
`defineChapter(${id}): a chapter needs at least one step`, `defineChapter(${id}): invalid step id '${step.id}'`,
`defineChapter(${id}): duplicate step id '${step.id}'`.

How the existing path chapters write it (`volumes/circuit/chapters/wire/index.ts:1-18`):

```ts
import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/wire.manifest.json';
export default defineChapter({
  id: 'wire', order: meta.order, group: 'path', ...manifestText(meta), axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
```

`manifestText(meta)` gives `title`, `subtitle`, `axisLabel`, `steps` (ENGINE_API §3, `docs/ENGINE_API.md:123-124`).

### 1.3 `defineScene`, `SceneHooks`, `StepInfo` (`chapter.ts:117-158`)

```ts
export interface StepInfo {
  readonly from: string | null;        // step we came from (null: chapter just entered / deep-linked)
  readonly instant: boolean;           // apply without animation (deep link, QA, chapter entry behind the transition)
  readonly direction: 1 | -1 | 0;      // +1 forward, −1 backward, 0 on entry
  readonly index: number;              // index in the manifest
  readonly scope: TweenScope;          // killed automatically when this step is left
}
export interface SceneHooks {
  enterStep?(stepId: string, info: StepInfo): void;
  leaveChapter?(to: { volumeId: string; chapterId: string; stepId: string }): number | (() => boolean) | null;
  update?(dt: number, t: number): void;     // every engine update while the chapter is active; engine-clock seconds
  dispose?(): void;                         // extras only
}
export type SceneFactory = (ctx: ChapterContext) => SceneHooks | void | Promise<SceneHooks | void>;
export interface SceneModule { readonly isSceneModule: true; readonly create: SceneFactory }
export function defineScene(create: SceneFactory): SceneModule
```

`leaveChapter` (doc comment `chapter.ts:134-141`): return seconds, or a predicate «there» (waited at most
`LEAVE_MAX = 12` s, `runtime.ts:45`), or `null` = no shared border with `to` → the platform's own zoom transition.
"Not waited for under `?freeze`". A same-frame cross-fade (`SEAMLESS_FADE = 0.3` s, `runtime.ts:43`) happens only
when the hook returned non-null **and** `volume.json → seamless: true` and both chapters are in the same volume
(`runtime.ts:512-516`). A predicate that throws counts as `true` (`runtime.ts:49-55`). A throwing hook is logged
`[runtime] ${id}: leaveChapter failed:` and treated as `null` (`runtime.ts:414-418`).

### 1.4 "StepModule" is NOT an engine type

`grep "interface StepModule"` finds it only inside chapters: every circuit/electricity chapter declares its own in
`chapters/<id>/chapter.ts` (or `steps/types.ts`). The engine knows only `SceneHooks` and `StepSpec.enter/leave`.
There is no `exit` — the name is `leave`. Two variants in the path volume:

```ts
// volumes/circuit/chapters/wire/chapter.ts:16-38
export interface Chapter { ctx: ChapterContext; ui: StepUiApi<StepId>; world: WireWorld;
  reached(step: StepId): boolean; reach(step: StepId): void }
export interface StepModule {
  spec: StepSpec;                         // declarative stage state
  ui: StepUiSpec;                         // controls, callouts, goal
  enter?(info: StepInfo): void;           // after the stage applied the step (honour info.instant)
  leave?(): void;
  update?(dt: number, t: number): void;   // every frame while the step is on screen
}
export type StepFactory = (chapter: Chapter) => StepModule;

// volumes/circuit/chapters/drain/chapter.ts:32-48 adds
  late?(dt: number, t: number): void;     // every frame after the world's update, for EVERY step (check `here`)
  finish?(): () => boolean;               // leaving the chapter from this step → «there» predicate for leaveChapter
  rewind?(play: boolean): void;           // arriving from the next chapter into this step
```

Wiring pattern (`wire/scene.ts:55-68`): `steps = Object.fromEntries(STEP_IDS.map(id => [id, FACTORIES[id](chapter)]))`
→ `world.world.define({ [id]: { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) } })` (which calls
`ctx.stage.define`, `circuit/shared/world/index.ts:223-226`) → `ui.define({ [id]: steps[id].ui })` → scene `update`
routes `steps[stage.current]?.update?.(dt, t)`. `STEP_IDS` is a `const` tuple kept equal to the generated manifest
by `__tests__/manifest.test.ts`. Session goals are a **module-level** `Set` (`wire/chapter.ts:42-46`: "module state
survives a rebuild of the scene") — a deliberate exception to ENGINE_API §19 "do not keep state in module-level
variables".

### 1.5 Lifecycle order (from `engine/runtime.ts`, `engine/app.ts`)

**Engine update order, every update** (`app.ts:677-685`):
`kGlobals.uKTime.value = clock.time` → `tweens.update(dt)` → `events.emit('update', dt)` (plugins: fx steppers
`fx/plugin.ts:13`; HUD `Hud.update`, `hud/shell.ts:142, 425-433` — `tickNavGate` and every mounted module's
`update`, DOM regions included via `hud.mountDom`: goal polling, `visible` predicates) → `runtime.update(dt, clock.time)`
→ `input.update()`. Inside `runtime.update` (`runtime.ts:294-341`): `a.hooks.update?.(dt, t)` → `a.director.update(dt)`
→ `a.env.update(…)` → pipeline dof params → transition zoom. Then the frame renders (`app.ts:610`).
Consequence: HUD predicates (`goal`, `visible`, `nav.hiddenUntil`) of an update read the chapter state left by the
**previous** `hooks.update`.

**A. Chapter load — deep link, first boot, `nav.goto` to another chapter, `next()` across a border**
(`ChapterRuntime.load`, `runtime.ts:387-498`; `swap` 500-581):

1. `store.set({ transition: { phase: 'loading', from, to, direction, progress: 0, quiet } })`; event `loading { progress: 0 }`.
2. Outgoing chapter (if any, and not already leaving): `out.hooks.leaveChapter?.({ volumeId, chapterId, stepId })`
   (`runtime.ts:415`); it keeps updating and rendering during the whole load.
3. `await manifest.load()`; must be `defineScene` or throws
   ``chapter '${key}': scene.ts must `export default defineScene(...)` ``.
4. `createInstance` (`runtime.ts:619-659`): new `Scene` (`chapter:<id>`), `root` Group (`chapter-root`),
   `CameraDirector`, `Environment(scene, { preset: theme.sky, accent }, quality.profile)`, chapter tween scope,
   `ChapterPost`, `Stage`, `Disposables`, scoped input, `QaProbes`.
5. `hooks = await mod.default.create(ctx)` — the factory (may be async; `ctx.progress`, `ctx.breathe`).
6. `stage.validate(stepIds, manifest.id)` (only if `stage.hasSteps`); throws
   `Stage(${chapterId}): step definitions do not match the manifest — missing: … — not in manifest: …`.
7. `enterStep(instance, stepId, /*instant*/ true, /*announce*/ false)` (`runtime.ts:451`) → `stage.apply(stepId,
   { from: null, instant: true, direction: 0, index })` → `StepSpec.enter(info)` → `hooks.enterStep(stepId, info)`.
8. `director.update(0)`, `env.update(0, …)`; shader compile: `renderer.compileAsync(scene, director.camera)` when
   `KHR_parallel_shader_compile`, else `renderer.compile(...)` (`runtime.ts:454-460`).
9. `loading { progress: 1 }`; wait for the outgoing border (`runtime.ts:468-474`); `pipeline.requestFreeze()` + one frame.
10. `swap`: `active = next`; **previous instance disposed** (`runtime.ts:508`); `next.post.activate`; director viewport
    / insets; `director.arrive(...)` unless seamless; `store.set({ volumeId, chapterId, stepId, transition })`;
    events `chapter { volumeId, chapterId, from }` then `step { …, from: null, instant: true }`;
    `clock.resetReal()`; zoom with 3 warm-up frames (`transitionStart` after them, `runtime.ts:308-322`);
    `store.settle`, `markVisited`; a step change requested during loading → `enterStep(next, want.stepId, true)`.
11. First `hooks.update` of the new chapter comes only after the swap (`runtime.update` drives `this.active` only):
    between factory and swap **no `update` is called** on the new instance, and `enterStep` precedes the first `update`.

If the factory (or validate) throws: logged `[runtime] failed to load chapter '${key}':`, event `error`, the new
instance is disposed, the previous chapter stays on screen (`runtime.ts:484-497`).

**B. Step change inside the chapter** (`pump`, `runtime.ts:360-377` → `enterStep` 594-617 → `Stage.apply`
`stage.ts:429-560`), from ANY state including mid-tween:

1. previous step's `StepSpec.leave?.()`;
2. previous step scope disposed (`stepScope.dispose()` kills every tween/`delay` started on `info.scope` /
   `ctx.stage.scope`); new step scope;
3. actors → params (`onChange`) → colours → poses (instant or tweened from the value on screen);
4. `camera.go(spec.camera, { ...spec.cameraMove, instant })`; `env.set(...)`; `post.apply(spec.post ?? {}, { instant })`;
5. `StepSpec.enter?.(info)`;
6. `hooks.enterStep?.(stepId, info)`;
7. `store.set({ volumeId, chapterId, stepId })`, `store.settle`, `markVisited`, event
   `step { volumeId, chapterId, stepId, from, instant }`.

An exception in 1-6 is caught and logged `[runtime] ${manifest.id}/${stepId}: enterStep failed:` — the step still
becomes current. `info.instant` = the navigation's `GotoOptions.instant ?? false` (`nav.ts:238`); a typed hash /
browser back-forward inside the chapter arrives with `instant: false` (`nav.ts:307`); `Nav.start()` uses
`instant: true` (`nav.ts:279`). `info.direction` = sign of index difference (`runtime.ts:600-601`).
A step is re-entered (same id) only when the chapter was already walking to its border (`back`, `runtime.ts:372-374`).

**C. Going back.** `nav.prev()` → `registry.prev` = previous entry of the linear journey (`registry.ts:128-131`).
Inside the chapter: case B with `direction: -1`, `instant: false`, `from = <step id>`. Across a border: case A —
the previous chapter is **rebuilt from scratch** and entered at its **last** step with `from: null, instant: true,
direction: 0`; the chapter on screen gets `leaveChapter(to)` first. A scene learns where the reader came from by
reading the store **inside the factory** (`wire/scene.ts:42-44`:
`const before = ctx.store.get(); let from = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id ? before.chapterId : null;`).

**D. Under `?freeze=<seconds>`** (`app.ts:55-77, 313-319, 357, 478-484, 597-605`; `runtime.ts:423, 519-520, 716-722`):

- `clock.paused = true` at boot; `deterministic()` is `flags.freeze !== null`.
- `ctx.breathe()` never yields; `leaveChapter` **is called** but never waited for; chapter transition duration is 0.
- After every `step` event (and lobby change) `freezePending = flags.freeze`. In the next frame where
  `!runtime.busy`: `advance(seconds)` = `Math.round(seconds / FIXED_DT)` iterations of
  `clock.advance(1/60); update(1/60)` **back-to-back inside one rAF callback, without rendering** — i.e.
  `hooks.update(1/60, t)` runs e.g. 180 times for `?freeze=3`.
- Every frame afterwards: `clock.advance(0); update(0)` → `hooks.update(0, t)` with **`dt === 0`**, same `t`;
  `clock.frame` still increments (`clock.ts:37-41`), so `ctx.clock.frame` is not a deterministic quantity.
- `__app.step(dt = 1/60, frames = 1)` → `clock.paused = true; engine.advance(dt * frames); await nextFrame()`;
  `__app.setTime(s)` advances forward only (`engine/debug/api.ts:198-209`).
- DOM interface: `<html>` gets class `kd-freeze` (`hud-dom/core/motion.ts:37`); panels held by `panel.hiddenUntil`
  appear at once; nav gate reveals at once (UI_API §3.3a, §3.4).

### 1.6 Disposal (ENGINE_API §13, `docs/ENGINE_API.md:432-446`; code `runtime.ts:726-745`, `disposables.ts`)

Order in `disposeInstance`: `instance.disposed = true` → `probes.clear()` → `hooks.dispose?.()` →
`stage.dispose()` (calls the current step's `leave?.()`, kills stage tweens) → `tweens.dispose()` →
`input.dispose()` → `disposables.dispose()` (everything given to `ctx.track` / `ctx.onDispose`, **reverse
registration order**, errors collected) → `resizeListeners.clear()` → `disposeObject3D(instance.root)` →
`env.dispose()` → `scene.clear()`. Errors: `[runtime] ${id}: error during dispose:`.

| Released automatically | How |
|---|---|
| every geometry / material under `ctx.root`; textures that are **own enumerable properties of a material or values of `material.uniforms`** (`isTexture`); `customDepthMaterial` / `customDistanceMaterial`; objects with a `dispose()` method (InstancedMesh, `Text3D`) | `disposeObject3D` (`disposables.ts:58-83`, `disposeMaterial` 31-49) |
| environment, all `ctx.tweens`, all `ctx.input` registrations, `ctx.onResize` listeners, `ctx.qa` probes/readers, stage | runtime |
| the `stepUi` binding of the chapter | `ctx.onDispose` inside `stepUi` (`hud/step-ui.ts:155-157`) |

Must be registered: `ctx.track(resource)` for anything with `dispose()` not under root (render targets, standalone
textures/materials); `ctx.onDispose(fn)` for listeners, audio nodes, **objects added to `ctx.hud.root`**, workers.
Quote (`docs/ENGINE_API.md:438-441`):

```ts
const rt = ctx.track(new WebGLRenderTarget(256, 256));     // anything with dispose() that is not under root
ctx.onDispose(() => window.removeEventListener('x', fn));  // listeners, audio nodes, HUD objects you added
```

`track`/`onDispose` after disposal run the cleanup immediately (`disposables.ts:90-100`); check `ctx.disposed` after
`await`. Engine-lifetime shared resources: `markShared(resource)` sets `userData.shared = true` and is skipped.
`chapter-check` "enters/leaves the chapter three times and fails if `renderer.info.memory` geometries/textures or
the program count grow" (`docs/ENGINE_API.md:445-446`).

---

## 2. ChapterContext

`interface ChapterContext` — `app/src/engine/chapter.ts:186-246`; built in `runtime.ts:661-724`.

| Field | Type | What a chapter calls (exact signatures) |
|---|---|---|
| `manifest` | `ChapterManifest` | `fullChapterId(ctx.manifest)`; `ctx.manifest.steps` |
| `scene` | `THREE.Scene` | read-only use; lights/fog/backdrop belong to `env` |
| `root` | `THREE.Group` | `root.add(...objects)` — everything under it is auto-disposed |
| `camera` | `CameraDirector` | `shots(map: Record<string, Shot>): void` · `go(shot: string \| Shot, opts?: MoveOptions): void` · `hold(shot?: string \| Shot): void` · `focusOn(subject: Object3D \| Vec3Like, opts?: FocusOptions): void` · read `camera.camera` (`DirectedCamera`), `camera.target`, `camera.moving` |
| `env` | `Environment` | `setScale(scale: number, opts?: { adaptFrom?: number }): void` · `setShadow(setup: ShadowSetup): void` / `fitShadow(object, padding = 1.1, softness = 3): void` · `base(overrides: EnvOverrides, opts?): void` · `set(preset, opts?)` · `tune(overrides, opts?)` · `setGrounding(radius, strength = 0.55)` |
| `post` | `PostControl` | `base(overrides: PostOverrides): void` (once in init) · `apply(overrides?: PostOverrides, opts?: { duration?: number; instant?: boolean }): void` · `params: Readonly<PostParams>` |
| `stage` | `Stage` | `define(steps: Record<string, StepSpec>): void` · `param(name, initial, opts?): Param` · `setParam(name, value, opts?)` · `actor(object, opts?)` · `toggle(item, shown?, opts?)` · `current: string \| null` · `scope: TweenScope` (§4.4) |
| `input` | `ScopedInput` | `register(object: Object3D, handlers: InteractionHandlers, layer?: InputLayer): Unsubscribe` · `on<K extends keyof InputEvents>(type: K, fn): Unsubscribe` · `captureKeys(handler: KeyCapture, options?: { priority?: number }): Unsubscribe` |
| `tweens` | `TweenScope` | `to<T extends object>(target: T, props: NumericProps<T>, opts?: TweenOptions): Tween` · `value(from, to, opts, fn: (value: number) => void): Tween` · `delay(seconds: number, fn: () => void): Tween` · `wait(seconds): Promise<boolean>` · `timeline(startDelay = 0): Timeline` · `scope(): TweenScope` |
| `clock` | `ClockView` | `readonly time: number` · `readonly dt: number` · `readonly frame: number` |
| `quality` | `QualityView` | `tier: QualityTier` · `profile: QualityProfile` · `count(nominal: number, min?: number): number` · `onChange(fn: (profile: QualityProfile) => void): Unsubscribe` |
| `store` | `Store` | `get(): AppState` · `subscribe<T>(select: (s: AppState) => T, listener: (value: T, previous: T) => void, opts?: { immediate?: boolean }): () => void` · (`set`, `updateSettings`, `markVisited`, `settle` exist; chapters read) |
| `nav` | `Nav` (getter, late-bound) | `next(opts?: GotoOptions): Promise<boolean>` · `goto(chapter: string, stepId?: string \| null, opts?: GotoOptions): Promise<boolean>` · `locate(address: string): Position \| null` / `open(address, opts?)` · `volume: VolumeManifest \| null` · `chapters` · `position` · `chapter(ref)` |
| `hud` | `HudLayer` | `root: Group` (camera-space, 1 unit = 1 px-eq) · `metrics: HudMetrics` · `onResize(fn)`; passed to `@/ui3d` widgets. Objects added to `hud.root` must be removed in `onDispose` |
| `random` | `Rng` | `next(): number` · `range(min, max): number` · `int(min, max): number` · `signed(scale = 1)` · `gauss()` · `pick<T>(items)` · `onSphere()` · `fork(label: string): Rng` |
| `viewport` | `Viewport` (getter) | `{ width, height (CSS px), aspect, dpr }` |
| `device` | `DeviceState` (getter) | `formFactor: 'desktop' \| 'tablet' \| 'phone'` · `orientation` · `pointer: 'fine' \| 'coarse'` · `hover` · `safeArea` · `keyboard` · `pixelBudget` · `width/height` · `forced`. Under «Версія для комп'ютера» a phone reads as `desktop` (`layoutDevice`, `engine/hud.ts:93-95`) |
| `renderer` | `THREE.WebGLRenderer` | see §5 |
| `reducedMotion` | `boolean` (getter) | |
| `gesture` | `Promise<void>` | resolves on the first user gesture (audio unlock) |
| `disposed` | `boolean` (getter) | check after `await` |
| `track` | `<T extends Disposable>(resource: T) => T` | `ctx.track(new WebGLRenderTarget(w, h))` |
| `onDispose` | `(fn: DisposeFn) => void` | |
| `onResize` | `(fn: (viewport: Viewport) => void) => Unsubscribe` | auto-unsubscribed on dispose; also fired on a deskShell switch |
| `progress` | `(fraction: number) => void` | loading 0…1 during the factory |
| `breathe` | `() => Promise<void>` | yields to the next frame only when ≥ 7 ms of the slice are used; never under `?freeze` (`runtime.ts:716-722`) |
| `qa` | `QaApi` | `probe(name: string, target: ProbeTarget, opts?: ProbeOptions): () => void` · `expose(name: string, fn: () => unknown): () => void` |

Not in the context: no `flags` / "deterministic" / `freeze` field; no worker, audio or fetch service; no
`engine`. `@/engine/api` (`app/src/engine/api.ts`) exports values `bindChapter, defineChapter, defineScene,
fullChapterId, markShared, Emitter, OVERLAY_LAYER, WORLD_LAYER, toOverlay, worldBounds, Rng, samePosition,
DEFAULT_READING_LEVEL, isReadingLevel, DEFAULT_MAP_LAYOUT, defineVolume, floorLabel, floorValue, groupLabel, EASE,
damp, resolveEase` and types only for everything else (`Engine`, `UrlFlags`, `CameraDirector`, `Shot`, `Stage`,
`StepSpec`, `QaApi`, `Store`, `Nav`, …).

Supporting types:

```ts
// engine/store.ts:56-60, 85-103
interface Position { volumeId: string; chapterId: string; stepId: string }
interface AppState { volumeId; chapterId; stepId; target: Position | null; transition: TransitionState;
  quality: QualityTier; device: DeviceState; settings: Settings; progress: Progress /* { visited: Record<'<volume>/<chapter>', string[]> } */;
  last: Position | null; lastIn: Record<string, Position> }
// engine/nav.ts:15-20
interface GotoOptions { instant?: boolean; replace?: boolean }
// engine/tween.ts:80-90
interface TweenOptions { duration?: number /* default 0.5 */; ease?: EaseLike; delay?: number;
  onStart?: () => void; onUpdate?: (progress: number) => void; onComplete?: () => void }
export function damp(current: number, target: number, lambda: number, dt: number): number  // tween.ts:76
// engine/qa-probes.ts:10-27
type ProbeTarget = Object3D | Vector3 | (() => Object3D | Vector3 | null);
interface ProbeOptions { origin?: boolean }
interface LocatedProbe { x: number; y: number; visible: boolean; shown: boolean; world: [number, number, number] }
```

Imports a chapter may make (lint, §6.4): libraries `@/style`, `@/text`, `@/ui3d`, `@/fx`, `@/kit`, `@/content`,
`@/hud`, `@/hud-dom/journey`, `@/hud/where`; from the engine only `@/engine/api`; of its own volume only
`sim/**`, `content/**`, `shared/**`. Actual usage by `circuit` + `_path` (import counts): `@/engine/api` 123,
`@/style` 74, `@/kit` 30, `@/hud` 25, `@/content` 25, `@/text` 9, `@/fx` 9, `@/hud-dom/journey` 5, `@/hud/where` 1
(`circuit/shared/world/index.ts:30`), `@/hud/model/path-step` 1.

---

## 3. Controls and goals

### 3.1 Entry point (`app/src/hud/step-ui.ts`; exported from `@/hud`, `hud/index.ts:219-226`)

```ts
import { stepUi } from '@/hud';
export function stepUi<M extends ChapterManifest>(ctx: ChapterContext & { manifest: M }): StepUiApi<StepIdOf<M>>;

interface StepUi<S extends string = string> {
  define(steps: Partial<Record<S, StepUiSpec>>): void;      // merges; unknown step id throws `stepUi(${chapterId}): unknown step '${stepId}'`
  value<T extends number | boolean | string = number>(id: string): T;   // throws `stepUi(${chapterId}): no control '${id}' with a value`
  set(id: string, value: number | boolean | string, opts?: { notify?: boolean }): void;
  onChange(id: string, fn: (value: number | boolean | string) => void): void;
}
interface StepUiApi<S> extends StepUi<S> {
  press(id: string): void;                                  // throws `stepUi(${chapterId}): no button '${id}'`
  patch(id: string, patch: ControlPatch): void;             // throws `stepUi(${chapterId}): no control '${id}'`
  toast(text: string, opts?: { icon?: IconName; duration?: number; tone?: 'info' | 'ok' | 'warning' | 'alarm' }): () => void;
}
interface ControlPatch { label?: string; min?: number; max?: number; value?: number | boolean | string;
  disabled?: boolean; current?: number }
```

One binding per chapter: "`stepUi(ctx)` again would start a new, empty one" (`_path/shared/placeholder.ts:67`). The
binding is keyed by the full chapter id.

### 3.2 `StepUiSpec` (`app/src/hud/step-ui-types.ts:259-295`)

```ts
export type When = boolean | (() => boolean);      // re-evaluated every frame while the step is on screen
export interface StepUiSpec {
  controls?: readonly ControlSpec[];
  honesty?: readonly HonestySpec[];                // "Ignored — no honesty chips are shown (DECISIONS §60 x)"
  callouts?: readonly CalloutSpec[];
  hotspots?: readonly HotspotSpec[];
  board?: BoardSpec;                               // { title?, size?: 'sm' | 'md' | 'lg' | 'fill', children: ControlSpec[], visible?: When }
  hint?: string;                                   // one-line toast on entering the step
  reset?: boolean;                                 // restore control values to declared defaults on every entry
  goal?: When;                                     // path chapters: takeaway shows once this holds
  nav?: { hiddenUntil: When | 'goal' };            // step navigator held back
  panel?: { hiddenUntil?: When; closingWhen?: When };
}
```

`StepUiSpec.acting` (announced in `docs/API_CHANGES.md:586`) does **not** exist in this copy.

### 3.3 Control specs (exact, `step-ui-types.ts:17-185`)

```ts
interface Base { id: string; hint?: string; visible?: When; disabled?: When }   // node name `ctl-<id>`

export interface SliderScale {                       // app/src/ui3d/widgets/slider-scale.ts:5-18
  min: number; max: number;
  scale?: 'linear' | 'log';                          // log needs min > 0
  step?: number;                                     // linear: value units; log: significant digits
  stops?: readonly number[];                         // only these values; overrides step
  snaps?: readonly number[];                         // magnetic values
  snapRange?: number;                                // fraction of the track, default 0.025
}
export interface SliderSpec extends Base, SliderScale {
  type: 'slider'; label: string; value: number;
  unit?: string; digits?: number; format?: (value: number) => string;
  marks?: readonly { value: number; label: string }[];
  onChange?: (value: number) => void;
  onInput?: (value: number, how: 'drag' | 'jump' | 'step') => void;
}
export interface ToggleSpec extends Base { type: 'toggle'; label: string; value?: boolean; onChange?: (value: boolean) => void }
export interface SegmentedSpec extends Base {        // the "choice" control; items named `ctl-<id>:<item id>`
  type: 'segmented'; label?: string; items: readonly { id: string; label: string }[];
  value?: string; onChange?: (id: string) => void }
export interface ButtonSpec extends Base { type: 'button'; label: string; icon?: IconName; primary?: boolean; onClick: () => void }
export interface ReadoutSpec extends Base { type: 'readout'; label: string; unit?: string; digits?: number;
  format?: (value: number) => string; get?: () => number; text?: () => string; color?: (value: number) => ColorLike }
export interface NoteSpec extends Base { type: 'note'; text: string | (() => string); icon?: IconName; color?: ColorLike | (() => ColorLike) }
export interface CustomSpec extends Base { type: 'custom'; node: UiNode; dom?: (host: DomHost) => DomWidget; update?: (t: number) => void }
export interface DomHost { readonly tweens: TweenScope; reducedMotion(): boolean }
export interface DomWidget { readonly el: HTMLElement; update?(t: number): void; dispose?(): void }
export type ControlSpec = SliderSpec | ToggleSpec | SegmentedSpec | ButtonSpec | ReadoutSpec | GaugeSpec
  | ChartSpec | CustomSpec | TableSpec | StatsSpec | NoteSpec;
```

- `onInput` — doc comment `step-ui-types.ts:37-41`: "`drag` — the thumb is being dragged, follow it directly;
  `jump` — a click / tap on the track, ease to the new value; `step` — a key or the wheel, ease. Called after
  `onChange` with the same value. The WebGL slider does not call it." Paired with `ui.patch(id, { current })` (the
  track's fill shows where the animation is). Reference recipe: UI_API §3.3 (`docs/UI_API.md:175-199`) and
  `volumes/_path/shared/placeholder.ts:64-114`:
  `s.shown = s.drag ? s.target : s.shown + (s.target - s.shown) * (1 - Math.exp(-dt / 0.25));`
  `if (Math.abs(s.shown - s.told) > 0.002) ui.patch('depth', { current: (s.told = s.shown) });`
- Slider keys (DOM): ←/→/↑/↓ (Shift ×10), PgUp/PgDn, Home/End (`docs/API_CHANGES.md:561-562`).
- `CustomSpec.node` is **required** by the type. Under the default DOM interface a `custom` without `dom` renders
  the placeholder `Віджет «${c.id}» ще не має 2D-версії` (`hud-dom/dock/build.ts:99-102`); only kit `HeatMap` /
  `RadarChart` nodes get a DOM twin automatically. `dom` is built once on first show, detached (not disposed) when
  the step is left, `dispose` on chapter leave.
- Layout is automatic (UI_API §3): sliders first, toggles in a row, segmented / tables / notes / charts full width,
  readouts in a row, **buttons in the sticky action row**; "≤ 3 sliders, one segmented control and a row of readouts
  fit 720p without scrolling under a two-line title" (`docs/UI_API.md:152-153`). Phone: «Керування» tab of the sheet;
  board → «Графіки» tab (UI_API §15 table).
- Captions must come from content: `content.steps[i].labels` (the «Підписи» of the script, in order) — circuit
  helper `caption(step, i)` (`wire/content.ts:12-17`) throws `wire: no caption ${i} in step '${step}'`.

### 3.4 Goal, takeaway, hints, navigator gate

| Thing | How it works | Where |
|---|---|---|
| goal | `goal?: When` on the step's `StepUiSpec`; polled once per frame by the DOM panel: `holds = (w) => typeof w === 'function' ? w() : w !== false` | `hud-dom/step/path-body.ts:46, 243-244` |
| takeaway | block «Висновок» (`PATH_LABELS.takeaway`, text = `content.steps[i].path.takeaway`), `data-ui="path-takeaway"`, hidden until the goal first holds, then revealed (`presence(...).reveal`) and scrolled into view; a step **without** `goal` shows it at once | `path-body.ts:151-158, 214-224`; `hud/model/path-step.ts:44-59` |
| memory | `reached: Set<string>` of keys `volume/chapter/step`, owned by the DOM step panel: kept for the session (not persisted; lost on reload); a first step whose goal was reached opens on the step, not on the opening card | `hud-dom/step/step-panel.ts:103, 189-205` |
| hints | `content…path.hints`: first after 15 s, second after 40 s of **engine** time on the step without the goal (`HINT_AFTER = [15, 40]`); timers restart while the panel is `held` | `hud/model/path-step.ts:104-109`; `path-body.ts:228-250` |
| navigator gate | `nav: { hiddenUntil: When \| 'goal' }`; hidden, inert, forward keys do nothing until first true; then stays for the session (module-level `opened` set); `__ui.navHidden()` | `hud/nav-gate.ts:18-34`; UI_API §3.4 |
| panel hold | `panel: { hiddenUntil }` — empty plate, class `held`, fades in 0.7 s on the engine clock; at once under reduced motion; no fade under `kd-freeze` | `step-panel.ts:111-135` |
| closing card | `panel: { closingWhen }` (last step) — closing card on each rising edge; `pathEnd.shown / back / forward` readable by the chapter (`import { pathEnd } from '@/hud'`) | `hud/path-end.ts`; `path-body.ts:238-242`; used in `circuit/chapters/build/steps/04-flashlight.ts:52,78,86` |
| QA names | `path-step`, `path-action`, `path-hint`, `path-takeaway`, `path-more`, `path-recall`, `path-back`, `path-opening`, `path-closing`, `path-closing-back`, `path-next`, `path-map`, `path-restart`, `path-to-card` | `path-body.ts` |

Chapter-side goal state in circuit is a predicate over the model plus a module-level session set
(`reached()/reach()`, §1.4). The platform keeps its own `reached` set as well — the two are independent.

### 3.5 Values: lifetime, reset, persistence

- `binding.values` (`Map<string, number | boolean | string>`) lives **as long as the chapter instance**
  ("`ui.value(id)` is valid in every step (it returns the declared default until the user touches the control)",
  `hud/step-ui.ts:16-17`). A chapter change destroys it.
- `reset: true` on a step: when the HUD (re)builds the step's controls it writes the declared default back
  (`hud-dom/dock/build.ts:113-116`: `if (opts.reset) { const d = controlDefault(c); if (d !== undefined) binding.values.set(c.id, d); }`)
  — **`onChange` is not called**. The rebuild runs on the HUD's `onStep` (after the runtime emitted `step`, i.e.
  after `hooks.enterStep` returned), so inside `enterStep` `ui.value(id)` is still the old value.
- `ui.set(id, v)` → widget follows, no `onChange`; `ui.set(id, v, { notify: true })` → exactly like a gesture.
  Slider values are clamped to (patched) `min/max`.
- **The store has no slot for chapter values.** `Store` persists only `settings`, `progress`, `last`, `lastIn`
  under localStorage key `electricity:v2` (`engine/store.ts:139-145, 156, 324-338`). State that must survive a
  chapter change (in radio: monitor route position, channel, transmitter power …) has no platform home; circuit's
  only precedent is module-level session state (`sessionGoals`). The reset «Почати з нуля» clears every
  `electricity:` key (DECISIONS §60 y).
- Stage sub-states: `stage.setParam / toggle / setColor` last until the next step entry, which restores the
  declared state (`stage.ts:246-321`).

---

## 4. Camera and stage

### 4.1 Shots (`app/src/engine/camera/director.ts:17-79`)

```ts
type Vec3Like = Vector3 | readonly [number, number, number];
interface OrbitLimits { azimuth?: number /* ±0.7 */; polar?: number /* ±0.35 */; zoom?: readonly [number, number] /* [0.65, 1.5] */; enabled?: boolean }
interface Shot {
  position: Vec3Like; target: Vec3Like;
  fov?: number;            // vertical FOV of the SAFE FRAME, default 32
  frameAspect?: number;    // default 1.5
  focus?: Vec3Like | Object3D;   // DOF focus; default target
  orbit?: OrbitLimits;
  drift?: number;          // idle drift multiplier, default 1 (0 = still)
  near?: number; far?: number;   // default near = clamp(distance·0.03, 0.02, 2), far = max(distance·40, 600)
  fit?: ShotFit;           // { center: Vec3Like; radius: number } | Object3D — phones/tablets re-frame from it
}
interface MoveOptions { duration?: number; ease?: EaseLike; instant?: boolean }
interface FocusOptions extends MoveOptions { padding?: number /* 1.35 */; direction?: Vec3Like; fov?: number }
```

| Call | Signature | Behaviour |
|---|---|---|
| `shots` | `shots(map: Record<string, Shot>): void` | merge named shots |
| `go` | `go(shot: string \| Shot, opts: MoveOptions = {}): void` | arc move from the pose on screen (orbit baked in); default `MOTION.camera` = 1.8 s `'cinematic'`; reduced motion: `min(d, max(0.3, d·0.35))`; unknown name throws `CameraDirector: unknown shot '${shot}'`. Normally issued by the stage (`StepSpec.camera`) |
| `hold` | `hold(shot?: string \| Shot): void` | stop on the pose on screen; with `shot` its limits/fit/drift apply while the camera stays; next `go()` leaves from here. "never `go(…, { instant: true })` there" (`docs/ENGINE_API.md:234-237`) |
| `focusOn` | `focusOn(subject: Object3D \| Vec3Like, opts: FocusOptions = {}): void` | frames the `worldBounds` sphere from the current direction; declares it as `fit` |
| read | `camera: DirectedCamera`, `target: Vector3`, `focusDistance`, `moving`, `currentShot`, `hasShot(name)` | "do not move it yourself" |
| user | `userControl = true`, `orbitBy`, `zoomBy`, `resetOrbit()` | orbit/zoom within the shot's limits, unwinds on the next move |

Rules: "Give **every step a `camera`**" (`docs/ENGINE_API.md:205`); declare `fit` on every shot (ENGINE_API §6).

### 4.2 Safe frame and HUD insets

- The HUD reports the area its panels cover: `hud.setInsets({ left, right, top, bottom })` in HUD units
  (`engine/hud.ts:154-157`) → fractions clamped 0…0.8 → `director.setInsets` → eased (λ = 7 s⁻¹,
  `director.ts:444-449`). Chapters do not call it.
- `DirectedCamera.updateProjectionMatrix` (`director.ts:126-162`): off-axis projection that fits the safe frame
  (`frameAspect` × `frameFov`) "contain" into the free rectangle; `camera.camera.insets`, `freeCenter(out)`.
  `camera.camera.fov` / `.aspect` are back-filled, the real projection is `makePerspective(left, right, top, bottom, …)`.
- Phones/tablets: `director.reframe = hud.metrics.formFactor !== 'desktop'`; `REFRAME = { min: 0.7, max: 2.5,
  autoAspect: 1, margin: 0.06, lambda: 6 }` (`director.ts:100`); `camera.camera.frameZoom`.
- `HudMetrics` (`engine/hud.ts:43-71`): `width, height (units), pxPerUnit, cssWidth, cssHeight,
  layout: 'wide' | 'narrow' | 'portrait', safeMargin, formFactor, orientation, pointer, shell: 'desk' | 'sheet' | 'side', safeArea`.
  `pxPerUnit = clamp(min(h, w·9/16)/1080, floor, 3) × textScale`, floor 0.7 desk / 1 touch.
- Step column budget: ≈ 908 px-eq at 1280×720, 990 at 1080p/4K (UI_API §3.1). Board area is reported as an inset
  too (left on wide screens, top otherwise).

### 4.3 Stage (`app/src/engine/stage.ts`)

```ts
type AppearMode = 'pop' | 'grow' | 'fade' | 'none';
interface ActorOptions { appear?: AppearMode | ((object: Object3D, value: number) => void); inDuration?: number; outDuration?: number }
interface PoseSpec { position?: readonly [number, number, number]; rotation?: readonly [number, number, number]; scale?: number | readonly [number, number, number] }
interface StepSpec {
  show?: readonly (Actor | Object3D)[];
  params?: Readonly<Record<string, number>>;
  colors?: Readonly<Record<string, ColorLike>>;
  poses?: Readonly<Record<string, PoseSpec>>;
  camera?: string | Shot;
  cameraMove?: MoveOptions;
  env?: EnvPresetName;
  envTune?: EnvOverrides;
  post?: PostOverrides;
  duration?: number; ease?: EaseLike;     // default MOTION.state = 0.7 s 'power2.inOut'
  enter?(info: StepInfo): void;
  leave?(): void;
}
class Stage {
  get current(): string | null;
  get scope(): TweenScope;                                   // current step's scope; read at call time, never cache
  actor(object: Object3D, opts?: ActorOptions): Actor;
  actors(objects: readonly Object3D[], opts?: ActorOptions): Actor[];
  param(name: string, initial: number, opts?: { duration?: number; ease?: EaseLike; onChange?: (value: number) => void }): Param;
  color(name: string, initial: ColorLike, opts?: { onChange?: (value: Color) => void }): ColorParam;
  pose(name: string, object: Object3D): void;
  define(steps: Record<string, StepSpec>): void;             // merges; may be called more than once
  toggle(item: Actor | Object3D, shown?: boolean, opts?: { instant?: boolean }): boolean;
  shown(item: Actor | Object3D): boolean;
  setParam(name: string, value: number, opts?: { duration?: number; ease?: EaseLike; instant?: boolean }): void;
  setColor(name: string, value: ColorLike, opts?: { duration?: number; instant?: boolean }): void;
  get hasSteps(): boolean;
  validate(stepIds: readonly string[], chapterId: string): void;
}
```

- "Everything not mentioned returns to its default" (actors hidden, params/colours/poses at registered values, env =
  chapter sky, post = chapter base). Objects in `show` are auto-registered as `pop` actors.
- Errors (verbatim): `Stage: param '${name}' is already registered`, `Stage: color '${name}' is already registered`,
  `Stage: pose '${name}' is already registered`, `Stage: step '${id}' uses unknown param '${name}'` (also `color`,
  `pose`), `Stage: unknown param '${name}'`, `Stage: unknown color '${name}'`.
- Motion tokens (`style/motion.ts:13-36`): `camera 1.8 cinematic`, `cameraShort 1.2`, `cameraLong 2.4`,
  `appear 0.5 back.out`, `disappear 0.25 power2.in`, `state 0.7 power2.inOut`, `mood 2.0 sine.inOut`,
  `transition 1.35`; `STAGGER = 0.055`.
- Layers (`engine/layers.ts`): `WORLD_LAYER = 0`, `OVERLAY_LAYER = 1`; `toOverlay<T extends Object3D>(object: T): T`
  (call after the subtree is built); `worldBounds(object: Object3D, out = new Box3()): Box3`.
- Environment: backdrop kind is fixed per chapter; `env.set(preset)` across kinds throws
  `Environment: cannot blend from a '${kind}' backdrop to preset '${preset}' (${envKind(preset)}). The backdrop kind is fixed per chapter (manifest.theme.sky).`
  (`style/env/environment.ts:217-226`). Continuous look changes: `StepSpec.envTune`, `ctx.env.tune(overrides, { duration })`,
  `ctx.env.base(overrides)`.

### 4.4 Quality tiers (`app/src/engine/quality.ts:21-159`)

`QUALITY_TIERS = ['low', 'medium', 'high', 'ultra', 'mobile']`.

| | low | medium | high | ultra | mobile |
|---|---|---|---|---|---|
| `maxDpr` | 1 | 1.25 | 1.5 | 2 | 2 |
| `msaa` / `hudMsaa` | 0 / 0 | 2 / 2 | 4 / 4 | 4 / 4 | 0 / 0 |
| `shadowMapSize` | 1024 | 2048 | 2048 | 4096 | 1024 |
| `aoSamples` (`aoScale`) | 0 (0.5) | 6 (0.5) | 10 (0.5) | 16 (1) | 0 |
| `bloomLevels` / `bloomScale` | 4 / 0.5 | 5 / 0.5 | 6 / 0.5 | 7 / 0.5 | 3 / 0.25 |
| `dofTaps` | 0 | 16 | 28 | 44 | 0 |
| `fxaa` | true | true | true | true | true |
| `particles` | 0.35 | 0.6 | 1 | 1.5 | 0.5 |
| `anisotropy` | 2 | 4 | 8 | 16 | 2 |
| `lowDetail` | false | false | false | false | **true** |
| `directWorld` | false | false | false | false | **true** |

- Picked: `?q=<tier>` > user setting > first-run GPU benchmark (desktop) / `mobile` on phones and tablets (no
  benchmark). `ctx.quality.count(nominal, min = 1) = max(min, round(nominal × particles))`.
- On a tier change the runtime calls `env.setQuality(profile)` and sets `needsUpdate = true` on every material of
  the scene (`runtime.ts:201-211`); the pipeline rebuilds its targets and re-warms its programs
  (`pipeline.ts:289-297`); chapters hear `ctx.quality.onChange`.
- Render DPR = `min(devicePixelRatio, profile.maxDpr, budgetDpr(device, w, h)) × resolutionScale` (`app.ts:728-736`);
  pixel budget phone 1.0 MP, tablet 2.0 MP (`device.ts:70`); dynamic resolution 0.6…1; automatic 30 fps cap on
  `mobile` (`app.ts:693-726`).
- Budget (ENGINE_API §16): frame ≤ 8 ms at 1080p `high`, ≤ 350 draw calls, ≤ 1.5 M triangles, chunk ≤ ~350 kB gzip;
  4K avg ≤ 14 ms; "avoid > 10 ms synchronous blocks in `update`".

---

## 5. Renderer rule and render targets

### 5.1 The rule, quoted

- ENGINE_API §4 table row (`docs/ENGINE_API.md:159`): «| `renderer` | capabilities / render targets only; never call `render()` |»
- `app/src/engine/chapter.ts:220-221`: `/** For render targets / capability queries. Do not call \`render()\` or change global state. */ readonly renderer: WebGLRenderer;`
- ENGINE_API §19 Don't (`docs/ENGINE_API.md:602-603`): "do not add lights for ambience (tune `ctx.env`), do not toggle
  light visibility, do not touch `renderer` state, `scene.fog`, `scene.background` or the camera transform;"
- §13 (`docs/ENGINE_API.md:439`): `const rt = ctx.track(new WebGLRenderTarget(256, 256));     // anything with dispose() that is not under root`

No ESLint rule enforces it (it is documentation only); the chapter lint block covers imports and four globals (§6.4).

### 5.2 Allocating a render target / DataTexture / CanvasTexture

- Render target: `ctx.track(new WebGLRenderTarget(w, h, opts))` — the chapter's `Disposables` call `rt.dispose()`
  on leave. The pipeline's own targets dispose `rt.depthTexture` explicitly before `rt.dispose()`
  (`pipeline.ts:665-669`).
- `DataTexture` / `CanvasTexture`: disposed automatically **only** when it is an own property of a material, or a
  `material.uniforms[*].value`, of a mesh under `ctx.root` (`disposables.ts:31-55`); otherwise `ctx.track(texture)`.
  Double disposal is harmless (`seen` set; `track` after disposal disposes at once).
- Platform precedents: `fx/flow/pathset.ts:106-107` (`new DataTexture(data, width, height, RGBAFormat, FloatType)`),
  `ui3d/charts/heatmap.ts:86` (`RGBAFormat, UnsignedByteType`), `ui3d/core/icons.ts`.
- Volume precedents: `volumes/circuit/chapters/charge/parts/glyphs.ts:20-59` and `…/charge/parts/spheres.ts:34-44`
  build a `CanvasTexture` from `document.createElement('canvas')` (64×64, 2D context) and put it on
  `new MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })` — the
  texture is the material's `map`, so chapter disposal releases it. **No `WebGLRenderTarget`, no
  `renderer.render(`, no `readRenderTargetPixels`, no `DataTexture` anywhere under `app/src/volumes`** (grep): no
  chapter or volume library renders off-screen today.
- **No K material accepts a texture** (`style/materials/*.ts` have no `map` / `Texture` parameter). What circuit
  does for pictures: `MeshBasicMaterial` with a `map` (above; 46 non-import uses of `MeshBasicMaterial` under
  `volumes/circuit`, although ENGINE_API §19 says "no `MeshStandardMaterial`/`MeshBasicMaterial`") and custom
  `ShaderMaterial`s (e.g. `volumes/circuit/chapters/flow/parts/lens-picture.ts`, a procedural picture on a disc).
  ENGINE_API allows custom `ShaderMaterial`s sharing `uniforms: { uKTime: kGlobals.uKTime }`
  (`docs/ENGINE_API.md:428-430`); `kGlobals` is exported from `@/style` (`style/materials/index.ts:58`).
- Engine-owned example of save / render / read / restore (`engine/quality.ts:226-237`):
  `const previous = renderer.getRenderTarget(); … renderer.setRenderTarget(target); renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel); … renderer.setRenderTarget(previous);`
- three 0.187 readback: `readRenderTargetPixels(renderTarget, x, y, width, height, buffer, activeCubeFaceIndex, textureIndex = 0)`
  (sync; restores the framebuffer of the current render target in `finally`) and
  `readRenderTargetPixelsAsync(…)` (PBO + `fenceSync`, polled with wall-clock timers) —
  `app/node_modules/three/src/renderers/WebGLRenderer.js:3158, 3245`. Both reject non-RGBA / non-UnsignedByte
  ("or implementation defined") targets.

### 5.3 Where the frame loop renders

| What | Where |
|---|---|
| rAF callback | `Engine.frame`, `app/src/engine/app.ts:577-675` |
| update (real time) | `app.ts:607` `this.update(this.clock.tickReal(now));` |
| update (freeze) | `app.ts:597-605` (`advance(seconds)` then `clock.advance(0); update(0)`) |
| **the one render call per frame** | `app.ts:610` `this.pipeline.render(suspended ? null : this.runtime.worldView(), this.hud, this.clock.time);` |
| draw-call stats read | `app.ts:611-613` (`renderer.info.render.calls / .triangles` → `stats().drawCalls / triangles`) |
| `RenderPipeline.render(world, hud, time)` | `app/src/engine/pipeline/pipeline.ts:329-528` |
| world `renderer.render` | `pipeline.ts:363` (regular path, into `rtScene`), `pipeline.ts:349` (`directWorld` / `mobile`, into `rtHud`) |
| overlay-layer `renderer.render` | `pipeline.ts:426` / `355` |
| HUD `renderer.render` | `pipeline.ts:459` |
| full-screen passes | `pass()` `pipeline.ts:546-550` (AO 375-382, prep/DOF 411-418, transition 443/452, bloom 472/483, final 521/526, FXAA 524) |

There is no three.js `EffectComposer`; the post stack is `RenderPipeline` itself.

### 5.4 What an extra `renderer.render()` from chapter code meets

State the pipeline sets **once** and then assumes (`pipeline.ts:253-256, 559-561`):
`renderer.autoClear = false`, `renderer.info.autoReset = false`, `renderer.localClippingEnabled = true`,
`renderer.shadowMap.type = PCFShadowMap`, `renderer.shadowMap.enabled = profile.shadowMapSize > 0`.
The canvas context is created with `antialias: false, alpha: false, depth: false, stencil: false` (`app.ts:226-233`).

State the pipeline (re)sets **every frame**, so a chapter's change does not survive into its passes:
render target (`setRenderTarget` before every pass — which also restores viewport/scissor from the target),
clear colour before each colour clear (`r.setClearColor(VOID, 1)`), explicit `r.clear(…)`, `kGlobals.uKTime`,
`kGlobals.uKRimColor / uKRimDir / uKLookScale` (`applyRig`, `pipeline.ts:552-557`), world camera layers
(`cam.layers.set(OVERLAY_LAYER)` … `set(WORLD_LAYER)`), `shadowMap.autoUpdate` (saved, `false` for the overlay pass, restored).

State the pipeline **never** resets (a chapter that changes it must restore it):

| State | Why it matters |
|---|---|
| current render target (`getRenderTarget` / `setRenderTarget`, incl. active cube face / mip) | harmless for the pipeline (it always sets its own) but `Engine.measure` and `warmUp` assume `getRenderTarget()` is theirs |
| canvas viewport / scissor / scissor test (`renderer.setViewport`, `setScissor`, `setScissorTest`) | the final pass to `null` uses the renderer's own viewport; never touched by the engine after `setSize`. A render target's own `.viewport` / `.scissor` are applied by `setRenderTarget` and are local to it |
| `renderer.autoClear` (must stay `false`), `autoClearColor/Depth/Stencil` | pipeline clears explicitly; with `autoClear = false` an extra pass must `clear()` its own target itself |
| clear colour / alpha | reset before the world clear; the HUD clear is depth-only |
| `renderer.toneMapping`, `toneMappingExposure`, `outputColorSpace` | never assigned anywhere in `app/src` (three defaults `NoToneMapping`, `SRGBColorSpace`); part of the program cache key |
| `renderer.shadowMap.enabled / type / autoUpdate / needsUpdate` | every `renderer.render(scene, cam)` with `autoUpdate === true` re-renders the key light's shadow map (`three/src/renderers/webgl/WebGLShadowMap.js:95`); the pipeline's own overlay pass avoids that by `autoUpdate = false` |
| `scene.overrideMaterial`, `scene.background`, `scene.fog`, `renderer.clippingPlanes`, `renderer.sortObjects` | not managed per frame |
| `kGlobals.uKRimColor / uKRimDir / uKLookScale` | written before the world pass and again with the **HUD rig** before the HUD pass (`pipeline.ts:456`): during `hooks.update` they hold the HUD's values from the previous frame, not the chapter's `env.rig` |
| the world camera (`ctx.camera.camera`) | `DirectedCamera` with off-axis projection and `layers` = world; the pipeline flips its layers mid-frame |
| `renderer.xr` | unused in `app/src` (grep: no `xr.`) |
| pixel ratio / size | set only in `Engine.resize` (`app.ts:736-738`) |

Further facts about an extra world render:

- **Programs**: rendering into a non-XR render target uses `ColorManagement.workingColorSpace` as output colour space
  regardless of the target texture's `colorSpace` (`three/src/renderers/webgl/WebGLPrograms.js:217`), the same as the
  pipeline's HDR targets → no extra program variants as long as tone mapping / shadow settings / override material
  are unchanged (the leak check counts programs).
- **World output is linear HDR** (RGBA16F, `pipeline.ts:122-135`); tone/display transform, grade, bloom, AO, DOF
  exist only in the post passes. A separate target gets raw K-material output (lit values ≤ 1, emissive > 1).
- **Per-draw hooks** run again for the extra pass, with its camera / target: `Text3D.onBeforeRender` rewrites
  `matrixWorld` for billboard / screenSpace text (`text/text3d.ts:338-371`), `fx/particles/cloud.ts:111-115`
  (`uPixel` from target height), `fx/machine/outline.ts:67-71` (`uViewport`), `fx/core/ribbon.ts:197-200`. The main
  pass re-runs them. `K.energy`'s pulse phase advances once per `uKTime` value (`style/materials/toon.ts:443-452`).
- **`fx` self-ticking** (`fx/core/tick.ts:25-37`) hooks `updateMatrixWorld`, which **any** `renderer.render(scene, …)`
  triggers: an extra pass ticks `onTick` effects at that moment (once per engine-time value).
- **Environment in the same scene**: the backdrop dome, motes, bokeh, floor disc, key and fill lights live in
  `ctx.scene` on the world layer; the dome shader uses `uViewDir` = the director camera's forward and the motes use
  `uPixelScale` from the director camera (`style/env/environment.ts:326-338`). The key and fill lights are enabled on
  both layers.
- **Layers**: a plain `PerspectiveCamera` has `layers.mask = 1` = `WORLD_LAYER`; overlay-layer labels are not drawn by it.
- **Draw-call accounting**: `r.info.reset()` runs at the start of every `pipeline.render` (`pipeline.ts:334`, with
  `info.autoReset = false`), so draws issued from `hooks.update` (which runs before `pipeline.render`) are wiped and
  **never appear in `__app.stats().drawCalls / triangles`**. They are inside `stats().cpu*` (timer started at
  `app.ts:586`, before `update`) and inside `__app.measure()`'s GPU timer query (`app.ts:590-593`) and sync time.
  `chapter-check` takes its draw-call budget from exactly that number
  (`tools/qa/chapter-check.mjs:183-185`: `const s = await page.evaluate(() => window.__app.stats()); … if (s.drawCalls > 350) fail(\`${step}: ${s.drawCalls} draw calls (budget 350)\`);`),
  and its frame time from `measure()` (`frameAvg`, gpu + cpu, `chapter-check.mjs:252`).
- Renderer state names that never occur in `app/src` at all (grep): `toneMapping`, `outputColorSpace`, `.xr`,
  `setScissor`, `renderer.setViewport`; `autoClear` occurs once (`pipeline.ts:253`).
- **`runtime.suspendWorld(true)`** (journey map / home screen covers the scene): the world is not rendered but
  "the chapter keeps updating" (`runtime.ts:248-256`) — `hooks.update` continues to run.
- **During a chapter load** the outgoing chapter updates and renders normally; the incoming one gets
  `renderer.compileAsync(scene, director.camera)` and no `update` until the swap.
- **Under `?freeze`** `hooks.update` runs N times without a render in between (§1.5 D).
- `Engine.measure` does raw GL (`gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(…); this.renderer.resetState();`,
  `app.ts:625-627`).

---

## 6. Determinism and time

### 6.1 Clock (`app/src/engine/clock.ts`)

```ts
export interface ClockView { readonly time: number; readonly dt: number; readonly frame: number }
export const MAX_FRAME_DT = 1 / 15;   // longest step one real frame may advance
export const FIXED_DT = 1 / 60;       // step of deterministic fast-forward
```

- Real time: `tickReal(nowMs)` → `dt = clamp((now − last)/1000, 0, 1/15) × timeScale`; `0` while paused; the loop
  stops on `visibilitychange` / `pagehide` and `clock.resetReal()` is called on resume, context restore and chapter swap.
- `update(dt, t)` of a scene: `dt` = that step, `t = clock.time`. Rule (ENGINE_API §12, `docs/ENGINE_API.md:428-430`):
  "**all** animation must derive from `update(dt, t)`, tweens or `uKTime`".
- Tweens advance "in creation order (deterministic)" (`tween.ts:394-406`); a tween created during an update starts
  advancing on the next one. `tweens.delay / wait` are engine-time timers. `Tween.finished: Promise<boolean>`.
- `kGlobals.uKTime` is set in `Engine.update` too, so fixed steps see the simulated time (`app.ts:678-680`).

### 6.2 Random (`app/src/engine/random.ts`)

`ctx.random = new Rng(\`chapter:${instance.manifest.id}\`)` (`runtime.ts:691`) — mulberry32, seeded with the
**short** chapter id (FNV-1a hash), created anew for every chapter instance, so a rebuilt chapter replays the same
sequence. `Rng` is a value export of `@/engine/api`; the class file has **no imports** (pure TS, 66 lines).
`new Rng(seed: number | string = 1)`; `fork(label)` derives an independent stream.

### 6.3 `?freeze` and QA hooks

- URL flags (`app.ts:25-77`): `?freeze=<seconds>` (0…120; empty = 0), `?q=`, `?debug`, `?overlay=0`, `?noaudio`,
  `?level=`, `?ff=phone|tablet|desktop`, `?safe=t,r,b,l`, `?hud=dom|gl` (default `DEFAULT_HUD = 'dom'`, `app.ts:53`).
- `ctx.qa` (`engine/qa-probes.ts:30-38`):
  `probe(name: string, target: ProbeTarget, opts?: ProbeOptions): () => void` → `__app.locate(name)` →
  `{ x, y, visible, shown, world }` (CSS px, any DPR / size);
  `expose(name: string, fn: () => unknown): () => void` → `__app.read(name)` (plain JSON-able values);
  `__app.probes()` lists both. Registered names are replaced on re-registration; all cleared with the chapter;
  present in production builds. Circuit convention: one reader named after the chapter exposing the whole
  observable state (`ctx.qa.expose('wire', () => ({ step: stage.current, depth, …, reached: [...] }))`,
  `wire/scene.ts:70-78`).
- `window.__app` (`engine/debug/api.ts:32-106`): `ready`, `goto(chapter, stepId?, { instant })`, `next()`, `prev()`,
  `settled()`, `pause()`, `resume()`, `step(dt?, frames?)`, `setTime(seconds)`, `stats()`, `resetStats()`,
  `measure(frames?)`, `listVolumes()`, `lobby()`, `listChapters(volumeId?)`, `position()`, `setQuality(tier)`,
  `device()`, `errors()` / `clearErrors()` (console errors **and warnings**, uncaught errors, unhandled rejections),
  `gpu()`, `simulateContextLoss(ms)`, `project(x, y, z)`, `locate(name)`, `probes()`, `read(name)`, `textSizes()`,
  `engine`. `__app.settled()` = navigation idle + freeze hold simulated + one frame (+ web fonts under `dom`).
- `window.__ui` (UI_API §13): `locate(name)` (`ctl-<id>`, `ctl-<id>:<item>`, `board`, `dock`, `step-panel`, …),
  `value(id)`, `set(id, v, notify?)`, `press(id)`, `offscreen()`, `navHidden()`, `textSizes()`, `overlaps()`,
  `controls()`, `sheet()` / `setSheet()`.
- QA pages are opened with `debug`, `overlay=0`, `noaudio`, `q=high` and optional `freeze` (`tools/qa/lib.mjs:100-105`).
  `chapter-check` fails on any console error **or warning**.

### 6.4 Rules on wall-clock and randomness — what is enforced where

| Rule | Scope | Source |
|---|---|---|
| `setInterval` banned ("Use the engine clock (ctx.clock / ctx.tweens), not timers.") | all `src/**/*.ts` | `app/eslint.config.js:29-32` |
| `Date.now` ("Use the engine clock (ctx.clock.time)."), `performance.now`, `window.setTimeout` ("Use ctx.tweens.delay()."), `Math.random` ("Use ctx.random (seeded) for deterministic QA.") | **only** `src/volumes/*/chapters/**/*.ts` | `eslint.config.js:37, 54-60` |
| `@/engine/*` except `@/engine/api`; `gsap` | **only** `src/volumes/*/chapters/**/*.ts` | `eslint.config.js:40-51` |
| `local/chapter-boundary` — a chapter may import its own files, the platform via `@/…`, and its own volume's `sim/**`, `content/**`, `shared/**`; never another chapter or volume (dev volumes may showcase another volume's `shared/**`) | chapter files | `app/eslint-rules/chapter-boundary.js:24, 77-116` |
| `local/volume-boundary` — volumes never import each other; platform never names a volume | all `src/**/*.ts` | `chapter-boundary.js:119-151` |
| docs: no `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Math.random`; no network requests | chapters | ENGINE_API §19 (`docs/ENGINE_API.md:598-606`) |

So `volumes/<v>/shared/**` and `volumes/<v>/sim/**` are **not** covered by the wall-clock / `Math.random` /
`@/engine/*` lint (precedent: `circuit/shared/world/index.ts:30` imports `@/hud/where`; `hud-dom/custom/layer.ts:11`
imports `parseFlags` from `@/engine/app`). Simulations: "pure TypeScript modules without three.js imports,
unit-tested with vitest" (`docs/ARCHITECTURE.md:149-151`); vitest runs with `environment: 'node'`,
`include: ['src/**/*.test.ts']` (`app/vite.config.ts:77-80`). `tsconfig.json` `lib` is `["ES2023", "DOM", "DOM.Iterable"]`
(no `WebWorker`), `types: ["vite/client"]`. There is **no `Worker` anywhere in `app/src`** (grep `new Worker`);
ARCHITECTURE forbids relying on secure-context-only APIs — "WebGPU, service workers, clipboard, SharedArrayBuffer"
(`docs/ARCHITECTURE.md:11-13`).

How code can learn that `?freeze` is on (no `ChapterContext` field): `engine.flags.freeze` (plugins only, via
`EnginePlugin.mount(engine)`); `hud()?.engine.flags.freeze` (`import { hud } from '@/hud'`, `hud/index.ts:34`,
`Hud.engine` is public `hud/shell.ts:124`); `document.documentElement.classList.contains('kd-freeze')` (DOM interface
only); `parseFlags(window.location.search).freeze` from `@/engine/app` (not importable from `chapters/**`). No
existing chapter or volume code checks it (grep) — existing scenes are pure functions of engine time.

---

## 7. «Де ми» and the journey axis

### 7.1 Floors in the volume manifest (`app/src/engine/volume.ts`)

```ts
export interface AxisFloor { readonly id: string; readonly label: string; readonly value: number;
  readonly plain?: string; readonly namedAt?: string /* 'chapter/step' of this volume; goes together with plain */ }
export function floorValue(volume: VolumeManifest, floor: string | undefined): number | undefined      // volume.ts:363
export function floorLabel(volume: VolumeManifest, floor: AxisFloor,
  visited: Readonly<Record<string, readonly string[]>>,
  stepsOf?: (chapterId: string) => readonly string[] | undefined): string                              // volume.ts:374
```

`volume.json → axis.floors[]`, `journey[].floor` (a floor id; validated: `chapter '${id}': unknown floor '${floor}'`,
`floor '${id}': 'plain' and 'namedAt' (chapter/step) go together`). `floorLabel` returns `plain` until the step
`namedAt` was opened, or any step of a later chapter of `journey`, or (with `stepsOf`) a later step of the naming
chapter. Example (`volumes/circuit/volume.json`): floors `atom 0 «один атом»` (plain «одна кулька», namedAt
`wire/atoms`), `rows 1 «ряди атомів»`, `part 2 «деталь»`, `stand 3 «стенд»`; axis `label: «Поверх»`,
`hint: «Де ми: від стенда до одного атома»`.

### 7.2 `@/hud/where` (`app/src/hud/where.ts`) — pure module state

```ts
export function setWhere(key: string, floor: string | null): void       // a closer report (ladder / chapter cue); key = 'volume/chapter'
export function setWhereBase(key: string, floor: string | null): void   // the floor a composed world is on; fallback
export function onWhere(fn: () => void): () => void
export function whereFloor(key: string): string | null                  // the reported floor of `key`
export function baseFloor(key: string): string | null
export function axisChipText(m: ChapterManifest, volume: VolumeManifest | undefined,
  visited: Readonly<Record<string, readonly string[]>>): string
```

`axisChipText` (`where.ts:54-66`): no named floors → `m.axisLabel`; else the floor with id
`whereFloor(key) ?? baseFloor(key)`, else the floor whose `label === m.axisLabel`, shown through `floorLabel`.
Consumers: header axis chip (`hud-dom/step/header.ts:72-77`, WebGL `hud/header.ts:45-56`). On touch shells the
header gets class `where` / the `header-floor` chip **only while `whereFloor(key) !== null`** (a `setWhere` report;
`setWhereBase` alone does not switch it). A chapter clears its report on leave: `ctx.onDispose(() => setWhere(key, null))`.
Circuit's composed world reports every frame:
`setWhereBase(whereKey, params.deep.value > 0.01 ? floorAt(params.deep.value) : 'stand')`
(`circuit/shared/world/index.ts:167-168, 321`).

### 7.3 Ladder and journey inset (`@/hud-dom/journey`, UI_API §11a `docs/UI_API.md:418-430`)

```ts
export function floorLadder(ctx: ChapterContext, opts: { floor: () => string | null }): FloorLadder   // { update(): void }
export function journeyInset(ctx: ChapterContext, opts?: { id?: string; onOpen?: (chapterId: string) => void }): CustomSpec
```

- `floorLadder` (`hud-dom/journey/ladder.ts:25-77`): a flat list of **all** `axis.floors` sorted by value
  (highest on top), the current one lit (`aria-current="location"`), names via `floorLabel`; `<nav data-ui="floor-ladder"
  aria-label="Де ми">` with kicker «Де ми», placed in `hudLayer(ctx, 'floor-ladder-layer')` (lower left on a desk);
  hidden by CSS on `.kd-shell-sheet` / `.kd-shell-side` (`journey.css:217-218`); `floor()` returning `null` hides it.
  Every change calls `setWhere(key, id)`. Under `?hud=gl` no element, only the `setWhere` report. A volume without
  floors → no-op object. Call `ladder.update()` from the scene's `update`.
  Usage: `floorLadder(ctx, { floor: () => (world.world.deep > 0.01 ? world.world.floorId : null) })` (`wire/scene.ts:40`).
- `journeyInset` → a `custom` control for a board or the dock: the volume's journey (stops in order, height by floor,
  built / planned / «ви тут», «лишилося ≈ N хв»); `data-ui="journey-stop:<id>"`, `journey-card`; WebGL / touch sheet:
  buttons `ctl-<id>:<chapter>`. Canonical use (`docs/UI_API.md:425-426`):
  `stepUi(ctx).define({ map: { board: { title: 'Мапа тому', size: 'lg', children: [journeyInset(ctx, { onOpen })] }, goal: () => opened.size >= 7 } })`.
  Stop names come from `LAYER_NAME` (`inset.ts:49-53`): `prologue → «Пролог»`, `practicum → «Практикум»`,
  `branch → «Гілка»`, path chapters `«Глава k»`.

### 7.4 What the platform offers for a volume-specific "where are we" miniature

| Need | Platform means |
|---|---|
| a list of the volume's floors with the current one lit | `floorLadder` (fixed look, desk only) |
| header chip text | `setWhere` / `setWhereBase` with a floor **id** of `axis.floors` — only ids of declared floors resolve; anything else falls back to the chapter's own floor label |
| a custom flat widget in the dock or on a board | `CustomSpec` with `node` (required) + `dom: (host) => ({ el, update?, dispose? })`; helpers `domKit` from `@/hud` (`h`, `setText`, `setStyle`, `setClass`, `svg`, `svgPainter`, `observeUnits`, `tone`, `color`, `rgbaColor`); platform classes `.btn`, `.chip`, `.kd-stepper`, `.kd-chip-pick`, `.kd-diagram`; lengths `calc(N * var(--u))`; "chapters ship no CSS"; "nothing may move with the pointer (DECISIONS §59 p)" (`docs/UI_API.md:355-361`) |
| a free-floating DOM overlay | `hudLayer(ctx, name?)` from `@/hud` → full-screen element in the chrome layer, `null` under `?hud=gl`, removed with the chapter (`hud-dom/custom/layer.ts:34-47`) |
| a slider inside such a widget | not a `SliderSpec`: its value is not in `ui.value()`; QA names by convention `data-ui="ctl-<id>:<item>"`; `domKit` has no slider builder. A real `SliderSpec` lives only in the dock / board |
| a 3D miniature in the scene | ordinary scene objects under `ctx.root`; world labels via `Text3D` + `toOverlay`, or `callouts` |

A scene reports its floor either by `floorLadder`'s `floor()` getter or by calling `setWhere` / `setWhereBase`
itself (plain functions; importable from chapters and from `shared/`). There is no `.css` file anywhere under
`app/src/volumes` (find): every stylesheet of the DOM interface is a platform file under `app/src/hud-dom/**`
(14 `.css` imports there), e.g. the ladder's `hud-dom/journey/journey.css`.

---

## 8. Events between chapter and HUD (after DECISIONS §60 x)

DECISIONS §60 x (`docs/DECISIONS.md:447-451`): «прибирай надписи "спрощена модель", "не в масштабі" і блок "чесно
про картинку". це все зайве» — "The reader's step panel shows neither the honesty marks nor the «Чесно про
картинку» note — in every volume, both interfaces." In code: `StepUiSpec.honesty` "Ignored" (`step-ui-types.ts:261-262`);
`HonestySpec` kept only so volume 1 compiles (187-198); `PathStep` has no `honesty` / `note` field
(`content/types.ts:121-139`); the document parser accepts and drops them (`tools/content/path_format.py:27-28`:
`'Позначки': '-honesty', 'Чесно': '-note'` — "«-» fields are accepted and dropped"). UI_API §6 is marked superseded.

What a chapter can still put outside the 3D scene:

| Channel | API | Where it shows |
|---|---|---|
| step text, action, takeaway, hints, «Докладніше», «Згадайте…», opening / closing cards | content only (`content.ts` ← generated JSON; `StepContent.path`, `ChapterContent.path`) | step panel (DOM: `hud-dom/step/path-body.ts`). Labels: «Що зробити», «Висновок», «Підказка», «Докладніше», «Згадайте», «Повернутися», «Питання з життя», «Що ми вже знаємо», «Що ми тепер знаємо», «До першого кроку», «Далі», «Кінець шляху», «Мапа подорожі» |
| entry hint | `StepUiSpec.hint` | toast under the header, 6 s, icon `hand`; **not on instant entries** (`hud/dock.ts:303`: `if (spec?.hint && !instant) hintOff = hud.toast(spec.hint, { icon: 'hand', duration: 6 });` — in the WebGL column's rebuild; `docs/API_CHANGES.md:551-552` says that column keeps the hint toast under `?hud=dom`; not re-verified at runtime) |
| event message | `ui.toast(text, { icon?, duration?, tone? })` → hide function | toast stack under the header (default 4.5 s) |
| status line | `{ type: 'note', id, text: string \| (() => string), icon?, color?, visible? }` | dock / board |
| live number / word | `readout` (`get` or `text`), `stats`, `gauge`, `table`, `chart` | dock / board |
| world label with a leader | `callouts: [{ anchor, text: string \| (() => string), color?, side?, occluders?, visible?, priority? }]` | screen space, never blurred; phones show the 3 (tablet 5) most important |
| info card on a marker | `hotspots: [{ anchor, content? \| title?, text?, onOpen?, visible? }]` | pulsing ring → card |
| tooltip | `ctx.input.register(obj, { tooltip })` | HUD tooltip (touch: 480 ms long press) |
| board | `board: { title?, size?, children, visible? }` | top-left / «Графіки» tab; its area is a camera inset |
| floor cue | `floorLadder`, `setWhere`, `setWhereBase` | ladder, header chip |
| chapter-owned DOM | `hudLayer(ctx, name)`; `custom.dom` | chrome layer; dock / board |
| chapter-owned WebGL HUD | objects under `ctx.hud.root` (remove in `onDispose`); `hudSurface(ctx)` / `worldSurface` / `worldConsole` of `@/ui3d` | WebGL only ("goes with the WebGL HUD (D9)") |
| scene captions | `Text3D` (world; `billboard`, `screenSpace`, `toOverlay`) | in the picture |
| timed captions of the script | `content.steps[i].labels` (order of «Підписи») and `path.captions?: { text, until?, at? }[]` — data only; the scene decides where each caption goes | — |

Events a chapter can listen to: `ctx.input.on('hover' | 'action' | 'gesture' | 'background', fn)` (`KeyAction =
'next' | 'prev' | 'first' | 'last' | 'map' | 'library' | 'back' | 'fullscreen'`, `input.ts:101`);
`ctx.store.subscribe(selector, listener)`; `ctx.quality.onChange`; `ctx.onResize`; `ui.onChange(id, fn)`. Runtime
events (`loading`, `transitionStart`, `transitionEnd`, `chapter`, `step`, `error`) are on `engine.runtime.on(...)` —
plugin API, not in `ChapterContext`. Readable HUD state: `pathEnd.shown` (`@/hud`). All text a chapter shows must
come from content: step captions `labels`, chapter-level `path.labels` («Підписи глави»), or
`defineContent(raw, { labels: {...} })` (`content/define.ts:29-32`); a missing glyph logs a `console.warn`, which
fails `chapter-check`.

---

## Surprises — where the design doc and this subsystem disagree

Design doc = `docs/superpowers/specs/2026-11-17-radio-volume-design.md`.

| # | Design doc | Code / platform fact |
|---|---|---|
| 1 | lines 131-133, 89, 468-498 (column «Позначка й що кажемо чесно»), 478, 678-679, 739: steps carry honesty marks («спрощена модель», «не в масштабі», «сповільнено ×N» …), "Це перевіряють `tools/content/path_check.py` і `doccheck.py`" | DECISIONS §60 x (`docs/DECISIONS.md:447-451`): no honesty marks or «Чесно про картинку» "in every volume, both interfaces". `StepUiSpec.honesty` is "Ignored" (`app/src/hud/step-ui-types.ts:187-198, 261-262`); `PathStep` has no `honesty` / `note` (`app/src/content/types.ts:121-139`); the parser drops «Позначки» / «Чесно» (`tools/content/path_format.py:27-28`). Only a scene-drawn caption can exist |
| 2 | lines 123, 703-705, 814-815: the camera-eye pass "рахується окремо в перевірці швидкодії", renderer state saved and restored | `renderer.info.autoReset = false` and `r.info.reset()` at the start of `pipeline.render` (`app/src/engine/pipeline/pipeline.ts:254, 334`); stats are read right after it (`app/src/engine/app.ts:611-613`) and `chapter-check` budgets on them (`tools/qa/chapter-check.mjs:183-185`) → draws issued from `hooks.update` are invisible to the draw-call budget; they are inside `measure()` cpu/gpu time (`app.ts:586-593`). State that needs care is listed in §5.4 (`autoClear = false`, kGlobals rim values hold the HUD rig during `update`, shadow map re-render per `render()`, fx `onTick` via `updateMatrixWorld`) |
| 3 | lines 713-715: "У режимі зупиненого кадру для перевірки … та сама модель рахує потрібний кадр синхронно" | `ChapterContext` has no freeze / deterministic flag (`app/src/engine/chapter.ts:186-246`; `api.ts:25` exports the `UrlFlags` type only). Under `?freeze` `hooks.update` runs `round(seconds × 60)` times back-to-back with no render (`app.ts:478-484, 597-603`), then every frame with `dt === 0` (`app.ts:604-605`); `clock.frame` keeps counting (`clock.ts:37-41`). `readRenderTargetPixelsAsync` waits on wall-clock polling (`three/src/renderers/WebGLRenderer.js:3245-3320`) |
| 4 | lines 139-140, 659-661: no wall clock or randomness outside the engine; `sim/core` pure TS in a Web Worker | the wall-clock / `Math.random` / `@/engine/*` lint covers only `src/volumes/*/chapters/**/*.ts` (`app/eslint.config.js:37-62`); `shared/**` and `sim/**` get only the `setInterval` ban (`:29-32`) and `local/volume-boundary` (`:65-67`). No `Worker` exists in `app/src`; `docs/ARCHITECTURE.md:11-13` forbids relying on `SharedArrayBuffer` and other secure-context APIs; `app/tsconfig.json:6` has no `WebWorker` lib; vitest runs in `node` (`app/vite.config.ts:77-80`) |
| 5 | lines 190, 203: one receiver state for the whole volume (monitor route, channel, transmitter power carried from step to step and chapter to chapter) | control values live per chapter instance (`app/src/hud/step-ui.ts:16-17, 142-157`); every chapter change builds a new `Scene`, `Stage`, env and context and disposes the old one (`app/src/engine/runtime.ts:508, 619-659`); `Store` persists only `settings / progress / last / lastIn` (`app/src/engine/store.ts:139-145, 324-338`). The only precedent for cross-chapter state is a module-level session `Set` (`volumes/circuit/chapters/wire/chapter.ts:42-46`). `reset: true` restores defaults without calling `onChange` (`app/src/hud-dom/dock/build.ts:113-116`) |
| 6 | lines 201, 203, 759, 853-854: own «де ми» miniature with the route slider on it, "на телефоні вона стоїть у доку" | a dock widget is a `CustomSpec` whose `node: UiNode` is required and whose DOM form needs `dom` (`step-ui-types.ts:122-136`); without `dom` the default interface prints «Віджет «<id>» ще не має 2D-версії» (`hud-dom/dock/build.ts:99-102`). A slider inside it is not a `SliderSpec` (no `ui.value`, no `onInput`, no platform keys). "chapters ship no CSS", "nothing may move with the pointer" (`docs/UI_API.md:360-361`); no `.css` exists under `app/src/volumes`. The phone header shows a floor chip only while `setWhere` reports a declared `axis.floors` id (`app/src/hud/where.ts:54-66`, `app/src/hud-dom/step/header.ts:75`) |
| 7 | line 609 (`chapters/<id>/ index.ts, scene.ts, content.ts, steps/, parts/ …`) and the plan brief ("step modules enter/exit/update/finish/rewind") | no engine type for step modules: only `SceneHooks` and `StepSpec.enter/leave` (`engine/chapter.ts:131-146`, `engine/stage.ts:171-197`); `Chapter` / `StepModule` / `StepFactory` are redeclared in every chapter (`volumes/circuit/chapters/wire/chapter.ts:16-38`; `drain/chapter.ts:32-48` adds `late / finish / rewind`). There is no `exit` |
| 8 | lines 597-598, 650-651: "у томі `circuit` збудовано тільки пролог і `wire`", "дві збудовані глави `circuit`" | this copy has nine: `app/src/volumes/circuit/chapters/{battery,build,charge,drain,flow,lamp,prologue,resistance,wire}` — with them came `SceneHooks.leaveChapter`, `volume.json → seamless`, `finish / rewind` (`docs/API_CHANGES.md:651-675`) |
| 9 | lines 745-746: "Один світ на весь том … Глави не будують власних світів" | "one world" is a library that every chapter mounts again: `mountWorld(ctx)` is called in each scene factory (`volumes/circuit/shared/world/index.ts:123`), nothing survives a chapter change (row 5). Same-frame borders exist only with `seamless: true` **and** a non-null `leaveChapter` (`engine/runtime.ts:403-427, 512-523`); otherwise every chapter change is the scale-zoom whose direction comes from `axisValue` (`engine/registry.ts:143-152`) |
| 10 | line 717: "Екран. Текстура, яку модель оновлює кожним своїм кадром" | no K material takes a texture (`app/src/style/materials/*.ts`); the documented rule is "no `MeshStandardMaterial`/`MeshBasicMaterial`" (`docs/ENGINE_API.md:599`) while circuit uses `MeshBasicMaterial({ map: CanvasTexture })` (`volumes/circuit/chapters/charge/parts/glyphs.ts:53-59`) and custom `ShaderMaterial`s. No render target exists anywhere under `app/src/volumes` |
| 11 | line 478: permanent caption «картинку обчислено · зменшено» as a scene caption | all on-screen text must come from generated content: step captions `StepContent.labels`, chapter captions `PathChapter.labels`, or `defineContent(raw, { labels })` per chapter (`app/src/content/types.ts:152-153, 173-174, 235-236`; `content/define.ts:29-32`); there is no volume-level label store |
| 12 | lines 647-651: missing format documents | confirmed missing: `docs/PATH_FORMAT.md`, `VOLUME_STRUCTURE.md`, `AGENT_GUIDE.md`, `MOBILE.md`, `HUD_DOM.md`, `docs/briefs/`; also missing `docs/reports/`, `docs/requests/`; `COPY_STYLE.md` only at `docs/volumes/circuit/COPY_STYLE.md`. `docs/UI_API.md:4, 463` still describe the WebGL interface as default while `DEFAULT_HUD = 'dom'` (`app/src/engine/app.ts:53`) |

## Open questions (not established from the files)

1. Whether `StepUiSpec.hint` still raises its toast under the default DOM interface (the call is in the WebGL column, `hud/dock.ts:303`).
2. How a Vite-built Web Worker behaves with `base: './'` and the single-volume site profile — no worker precedent in the repo.
3. Whether a `SliderSpec` can run from a larger to a smaller value («від 10 до 0,1 mW»): `SliderScale` only has `min`/`max`; the DOM slider code was not opened.
4. How a `custom` control is laid out in the phone sheet («Керування» tab) — described only in the missing `docs/HUD_DOM.md` / `docs/MOBILE.md`.
5. Behaviour of `goal` / takeaway under `?hud=gl` (`hud/step-panel.ts` not opened).
6. Whether a volume's `shared/**` may ship its own CSS (rule text says "chapters ship no CSS"; no precedent).
7. Cost and correctness of a synchronous `readRenderTargetPixels` on the software renderer used for QA here — not measured.
8. The exact document fields of the path format that produce `labels`, `captions`, `hints` (`docs/PATH_FORMAT.md` is missing; `tools/content/path_format.py` was only grepped).

## Appendix — doc/code disagreements inside the platform (not the design doc)

- `docs/UI_API.md:4` "All UI is WebGL … there is no DOM UI" and `:463` "default `gl` until the cut-over" are stale:
  `DEFAULT_HUD: HudRenderer = 'dom'` (`app/src/engine/app.ts:53`, DECISIONS §60 z).
- `docs/API_CHANGES.md:586` announces `StepUiSpec.acting?: When`; `:530, :571` announce `PathStep.honesty?` / `.note`;
  none of them is in the code of this copy.
- `docs/API_CHANGES.md:654` places `leaveChapter` in "ENGINE_API §3"; it is in §4.
- `docs/ENGINE_API.md:397` lists `KeyAction` without `'library'`; the code has it.
- `docs/UI_API.md` has two sections numbered 11 (`:394` layout, `:512` volumes) plus 11a (`:418`).
