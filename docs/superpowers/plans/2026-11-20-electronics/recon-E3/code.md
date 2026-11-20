# Recon E3 · code — chapter CODE structure in the path format (from `circuit`)

Read-only map for the `electronics` chapters (prologue, meter, resistor, resistor-pick, then divider … lab).
Sources read in full: `app/src/volumes/circuit/chapters/{resistance,lamp,prologue}/**` (chapter.ts, content.ts,
index.ts, scene.ts, stand.ts / world.ts / shots.ts, steps/*, the parts the steps lean on, __tests__/*, README.md,
qa/*), plus the engine/HUD API they use. Paths below are repo-relative; `C/` = `app/src/volumes/circuit/chapters/`,
`E/` = `app/src/volumes/electronics/`. Line numbers are as of commit 2707887 + the working tree of 2026-11-20.

## 0. Verdict in one screen

- **Copy the `resistance` / `lamp` pattern, not the `prologue` one.** Both use one contract file `chapter.ts`
  (`STEP_IDS`, `Chapter`, `StepModule`, `StepFactory`, `sessionGoals`), one factory per step in
  `steps/NN-<id>.ts`, a thin orchestrator `scene.ts`, and a world facade (`stand.ts` / `world.ts`). Every
  non-prologue `circuit` chapter (battery, build, charge, drain, flow, wire, resistance, lamp) has exactly this
  shape plus `__tests__/manifest.test.ts`. The prologue is an older ad-hoc shape (helpers returning `{spec, enter,
  update, state}` wired by hand in scene.ts, no `chapter.ts`, no manifest test, a hard-coded Ukrainian board title,
  a stale README) — do not copy it.
- A chapter is 5 required files + steps: `index.ts` (eager manifest, from the generated manifest JSON),
  `content.ts` (generated runtime content + `caption(step, i)`), `chapter.ts`, `scene.ts`, `steps/NN-<id>.ts`
  (one per step), `__tests__/manifest.test.ts`, `README.md`, `qa/interactions.mjs` (+ `qa/helpers.mjs`). Optional:
  `stand.ts`/`world.ts` (the chapter's view of the shared world), `shots.ts`, `parts/*`.
- **Every on-screen word comes from the script's «Підписи»** via `caption(step, i)` (positional, pinned by the
  manifest test). Units in international notation (`V`, `A`, `Ω`, `s`) may be typed in code; Ukrainian may not
  (global constraints: «Код сцен не містить жодного українського слова»).
- **Goal** = the step's `ui.goal` predicate, polled per frame by the HUD; the first frame it holds the panel reveals
  «Висновок» and remembers it for the session. Chapters latch it themselves in a module-level `Set` (`sessionGoals`)
  so their own visuals (captions «→ X») can follow.
- **Steps never mount or unmount the world.** The scene mounts the shared world once; steps register input and QA
  probes once (at factory time, gated by `here(step)`), and change *numbers that travel* (stage params, `glide`s)
  in `enter` / `leave` / `update` / `late`.
- `electronics` is **not seamless** (`E/__tests__/journey.test.ts:127-128` asserts `'seamless' in identity ===
  false`): no border choreography; `leaveChapter` may be omitted or return `null` (the platform plays its zoom).

## 1. Files of one chapter (recipe)

| File | Required | Contains | Model in `circuit` |
|---|---|---|---|
| `index.ts` | yes | `export default defineChapter({...})` — manifest only, lazy scene | `C/resistance/index.ts:11-19`, `C/prologue/index.ts:9-17` |
| `content.ts` | yes | `defineContent(raw)` default export + `caption(step, i)` | `C/resistance/content.ts:1-17`, `C/lamp/content.ts:1-17` |
| `chapter.ts` | yes | `STEP_IDS`, `StepId`, `Chapter`, `StepModule`, `StepFactory`, `sessionGoals` | `C/resistance/chapter.ts:12-46`, `C/lamp/chapter.ts:16-67` |
| `scene.ts` | yes | `export default defineScene((ctx) => …)`: world → factories → `define` ×2 → QA → hooks | `C/resistance/scene.ts:22-110`, `C/lamp/scene.ts:35-229` |
| `steps/NN-<id>.ts` | yes, one per step | `export const <camel>Step: StepFactory = (chapter) => ({ spec, ui, enter, leave, update, late? })` | `C/resistance/steps/01-bumps.ts` … `04-balance.ts` |
| `stand.ts` or `world.ts` | when the chapter owns props | mounts the shared world once, the chapter's props as `glide`s, `snap()`, `update()` | `C/resistance/stand.ts:86-167`, `C/lamp/world.ts:41-60` |
| `shots.ts` | when the chapter has its own camera shots | `export const X_SHOTS = {...} satisfies Record<string, Shot>` | `C/lamp/shots.ts:88-95`, `C/prologue/shots.ts:8-11` |
| `parts/*.ts` | optional | chapter-local pieces (controls on 3D objects, pure maps, glides); a chapter never imports another chapter, so shared bits are copied | `C/resistance/parts/glide.ts`, `C/lamp/parts/switch.ts` |
| `__tests__/manifest.test.ts` | yes | step ids/titles = generated content; captions by position | `C/resistance/__tests__/manifest.test.ts:1-39` |
| `__tests__/<pure>.test.ts` | per pure helper | number formats, pure maps (no WebGL; vitest env is `node`) | `C/lamp/__tests__/story-words.test.ts`, `C/prologue/steps/__tests__/clock.test.ts` |
| `README.md` | yes | Script path, world, first/last frame, Files table, Steps table, QA command | `C/resistance/README.md`, `C/lamp/README.md` |
| `qa/interactions.mjs` (+ `helpers.mjs`, `steps-*.mjs`) | yes | Playwright walk: every goal by real pointer input | `C/lamp/qa/*`, `C/resistance/qa/*` |

Registration needs nothing else: `E/chapters.ts` is `import.meta.glob('./chapters/*/index.ts', { eager: true })`
(already present). The scene file MUST be named `scene.ts` (Vite names the lazy chunk
`chapter-<volume>-<id>-<hash>.js` by matching `/chapters/<id>/scene.ts`, `app/vite.config.ts:65-66`).

## 2. `index.ts` — the manifest

Template (from `C/resistance/index.ts:1-19`, `C/prologue/index.ts:1-17`):

```ts
import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/<id>.manifest.json';

/** <one-paragraph English doc: chapter N of `electronics`, the question, what the steps do>. */
export default defineChapter({
  id: '<id>',
  order: meta.order,
  group: meta.group,             // prologue style; resistance hard-codes 'path' — wrong for electronics
  ...manifestText(meta),         // title, subtitle (= first step title), axisLabel (= floor label), steps[]
  axisValue: meta.axisValue,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
```

- `defineChapter<const M extends ChapterSpec>(spec: M): M & { readonly volume: string }` —
  `app/src/engine/chapter.ts:86-98`: validates ids (`/^[A-Za-z0-9_][A-Za-z0-9_-]*$/`, L80), ≥ 1 step, unique step ids.
- `manifestText(meta, override?)` — `app/src/content/meta.ts:12-27`.
- The generated manifest (`tools/content/path_export.py:153-156`) has: `volume, id, title, subtitle (= steps[0].title),
  axisLabel (= floor label), axisValue, group, parent (null), order, format 'path', layer, minutes, steps[{id,
  title, blurb (= «Думка»)}]`.
- **Do not spread `parent: meta.parent`** for a main-path chapter: the generated value is `null`, while
  `app/src/engine/__tests__/volumes.test.ts:60-61` asserts `chapter.group === planned.group` and
  `chapter.parent === planned.parent` (raw `volume.json` → `undefined` for main chapters). Branches (`sensors`,
  `smd`, …) need `parent: '<id>'`.
- Theme names: `AccentName` keys of `ACCENT` in `app/src/style/palette.ts` (teal exists), `sky: EnvPresetName`
  (`'micro'|'studio'|'day'|'golden'|'dusk'|'night'`), `mood: Mood` (`'micro'|'studio'|'diorama'`). Volume theme is
  `{ sky: 'studio', mood: 'studio' }` (`E/volume.ts`), accent teal (`E/volume.json`).

For electronics (`E/volume.json` journey), what `meta` will carry:

| chapter | group | floor → axisValue | layer |
|---|---|---|---|
| prologue | prologue | stand → 3 | prologue |
| meter | tools | stand → 3 | path |
| resistor | resistor | inside → 1 | path |
| resistor-pick | resistor | part → 2 | path |
| divider | resistor | stand → 3 | path |
| capacitor | capacitor | inside → 1 | path |
| capacitor-kinds | capacitor | part → 2 | path |
| filter | capacitor | stand → 3 | path |
| diode | diode | atoms → 0 | path |
| led | diode | inside → 1 | path |
| transistor | transistor | inside → 1 | path |
| amplifier | transistor | stand → 3 | path |
| build, lab | practicum | stand → 3 | practicum |

## 3. `content.ts` and the script → screen grammar

Template (`C/lamp/content.ts:1-17`):

```ts
/** All reader text comes from the generated runtime content (docs/volumes/electronics/chapters/<id>.md → tools/content). */
import { defineContent } from '@/content';
import raw from '../../content/generated/<id>.json';

const content = defineContent(raw);
export default content;

/** Caption `i` of a step («Підписи» of the script, in their order; `labels` of the runtime content). */
export function caption(step: string, i: number): string {
  const s = content.steps.find((x) => x.id === step);
  const text = s?.labels?.[i];
  if (text === undefined) throw new Error(`<id>: no caption ${i} in step '${step}'`);
  return text;
}
```

`defineContent(source, extra?)` — `app/src/content/define.ts:29-89`. The runtime JSON is written by
`tools/content/path_export.py:125-158` (`runtime()`) into `E/content/generated/<id>.json` and `<id>.manifest.json`;
regenerate with `tools/content/regen.sh --volume electronics` (runs build_index, build_glossary, export_content,
export_runtime, doccheck; the runtime step prints `path runtime[electronics]: N chapter(s), K file(s) written`).

### 3.1 Step field grammar (parser `tools/content/path_format.py`)

- Step header: `### <n>. \`<step-id>\` — <title>` (L14); id kebab-case Latin `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` (L17);
  numbers consecutive from 1.
- Field line: `- **<Поле>:** text` (L15), continuation lines indented 2 spaces, or `  - paragraph` items
  (4-space continuation) — `parse_step_fields` L54-78. Inline text and items together = error.
- Fields → export keys (L24-27): Думка→`idea`, Завдання→`idea` (practicum), Текст→`text`, Дія→`action`,
  Висновок→`takeaway`, Перевірка→`takeaway` (practicum), Нові терміни→`terms`, Докладніше→`more`,
  Згадати→`recall`, Бачимо→`see`, Ціль→`goal`, Підказки→`hints`, Підписи→`labels`; Позначки / Чесно are dropped.
  Required (L29): idea, text, action, takeaway, goal, terms, more.
- What reaches the runtime (`path_export.py:131-147`): `panel` (= «Текст» paragraphs, terms marked `**…**`),
  `terms` (cards), `path.{idea, action, takeaway, more[], marks[], recall?, hints?, captions?}`, `labels[]`.
  «Ціль» and «Бачимо» are builder briefs only — the code implements them; they never reach the screen.
- **«Підписи» grammar** (L32-33, L175-185): items separated by `·`; each item is `«A»` (shown all the time),
  `«A» → «B»` (A until the takeaway, B from it), or `→ «B»` (appears at the takeaway); `—` = none.
  `labels` is the flat list of texts in order — **`«A» → «B»` contributes TWO indices** (A then B). The timing
  goes to `path.captions` only when some item has a timing (`path_export.py:144-145`); the HUD does NOT apply it
  — the scene implements it (`visible: () => !reached(s)` for A, `reached(s)` for B).
- Chapter sections (L20-21): `## Питання з життя` (hook), `## Що ми вже знаємо` (know, empty in a prologue),
  `## Кроки`, `## Нитка глави`, `## Що ми тепер знаємо` (numbered `1. …`, three lines), `## Місток`,
  `## Підписи глави` (chapter-level captions, e.g. the volume end's «start over»). Order enforced (L155-157).
- Formulas: `tools/content/path_check.py:28,114-115` bans `= ≈ × ÷ √ ^` and backticks only in «Текст». In
  electronics formulas are allowed in «Висновок», «Підписи», «Докладніше» (global constraints). On screen the
  mini-markup renders them (`app/src/text/rich.ts:1-15`: `` `U = I·R` `` formula, `x^2`, `U_{rms}`, `**term**`;
  `app/src/text/markup.ts:12-17` turns `V_oc`, `A^(1/3)` into groups).
- Labels may carry NBSP between number and unit (`'0,3 A'` in `circuit/content/generated/resistance.json`):
  tests compare after `.split(NBSP).join(' ')` (`C/resistance/__tests__/manifest.test.ts:8,30`).

### 3.2 How the code addresses captions (patterns)

- By position, with a comment naming the text: `caption('bumps', 2)` = «опір» (`C/resistance/steps/01-bumps.ts:97`).
- Slider label + mark labels: `label: caption('glow', 0)`, `marks: [{ value: 0, label: caption('glow', 1) }, …]`
  (`C/lamp/steps/03-glow.ts:61-70`).
- Unit words pulled out of a caption: `caption('glow', 2).split(/\s+/).pop()` → the seconds word of «0,1 с»
  (`03-glow.ts:30`); clock words from the end mark «2 хв 16 с» (`C/prologue/steps/clock.ts:12-23`).
- Word forms for a read-out from a run of captions (`C/lamp/parts/story-words.ts:21-45`, captions 1…14 of `story`).
- Tooltips on 3D parts: `ctx.input.register(obj, { tooltip: caption('energy', 0), cursor: 'default', enabled })`
  (`C/lamp/steps/04-energy.ts:29-33`).
- Dynamic callout text: `text: () => \`${caption('glow', 3)}${NBSP}${formatTemperature(c)}\``
  (`03-glow.ts:80`).

## 4. `chapter.ts` — the contract between scene and steps

`C/resistance/chapter.ts:1-46` (minimal) and `C/lamp/chapter.ts:1-67` (with `late` and a shared input):

```ts
import type { ChapterContext, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['bumps', 'heat', 'shape', 'balance'] as const;     // L13
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {                       // L16-25 — what every factory receives
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;                         // the ONE stepUi binding of the chapter
  stand: ResistanceStand;                        // the chapter's world facade (lamp: world, switcher, lens, door, fly)
  reached(step: StepId): boolean;                // goal reached this session
  reach(step: StepId): void;
  here(step: StepId): boolean;                   // stage.current === step
}

export interface StepModule {                    // L27-37
  spec: StepSpec;                                // declarative stage state (camera, params, post)
  ui: StepUiSpec;                                // controls, board, callouts, goal, nav/panel gates
  enter?(info: StepInfo): void;                  // after the stage applied the step; honour info.instant
  leave?(): void;
  update?(dt: number, t: number): void;          // every frame while on screen, before the world updates
  // lamp adds: lensInput?: InteractionHandlers; late?(dt, t): void  — `late` runs for EVERY step every frame,
  // after the world (C/lamp/chapter.ts:48-57); use it to fade out what a step left once it is no longer current
}
export type StepFactory = (chapter: Chapter) => StepModule;  // L39

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();               // L42-46
export const sessionGoals = { has: (s) => REACHED.has(s), add: (s) => void REACHED.add(s) };
```

## 5. `scene.ts` — the orchestrator (order matters)

`C/resistance/scene.ts:22-110`, `C/lamp/scene.ts:35-229`:

1. `const FACTORIES: Record<StepId, StepFactory> = { bumps: bumpsStep, … }` (L22-27) — the typed record forces one
   factory per id.
2. `export default defineScene((ctx) => { … })` (`app/src/engine/chapter.ts:156-158`; `SceneFactory =
   (ctx) => SceneHooks | void | Promise<…>`, L148).
3. Mount the world once: `const stand = createResistanceStand(ctx)` (L31) — everything under `ctx.root` is
   disposed with the chapter.
4. `const ui = stepUi(ctx) as StepUiApi<StepId>` (L32) — **exactly once per chapter**: a second `stepUi(ctx)`
   replaces the chapter's binding (`app/src/hud/step-ui.ts:141-154`; `_path/shared/placeholder.ts:67` warns).
5. Build `chapter: Chapter` (L33-40) with `reached/reach` → `sessionGoals`, `here: (s) => stage.current === s`.
6. `const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)]))` (L45-48) — all
   factories run at scene creation (they register input / probes / exposes once).
7. Stage states: `world.define(Object.fromEntries(STEP_IDS.map((id) => [id, { ...m.spec, enter:
   m.enter?.bind(m), leave: m.leave?.bind(m) }])))` (L49-56) — the step's `enter/leave` ride on `StepSpec.enter/leave`
   (`app/src/engine/stage.ts:193-196`). The runtime then `stage.validate()`s: if any step is defined, all manifest
   steps must be, and no extra (`stage.ts:415-426`, called `app/src/engine/runtime.ts:442-445`).
8. Step UI: `ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])))` (L57) — throws on an unknown
   step id (`step-ui.ts:163`).
9. QA: `ctx.qa.expose('<chapter-id>', () => ({ step, …, reached: STEP_IDS.filter(sessionGoals.has) }))` and a
   `'motion'` reader of every travelling number for continuity sampling (L58-75).
10. Return hooks (`SceneHooks`, `chapter.ts:131-146`):
    - `enterStep(id, info)` — forward to the world (`world.enterStep(id, info)`), `if (info.instant) stand.snap()`;
      circuit adds border arrival here (L77-93).
    - `leaveChapter(to)` — call the current step's `leave`, set a `leaving` flag, walk props home, return the
      border predicate or `null` (L94-104). Electronics (not seamless): omit, or call `leave()` and return `null`.
    - `update(dt, t)` — `if (!leaving) steps[stage.current]?.update?.(dt, t); stand.update(dt, t);` (L105-108); lamp
      then runs `late` for every step (`C/lamp/scene.ts:220`).

Runtime call order on every step entry (`app/src/engine/runtime.ts:605-606`): `stage.apply(stepId, info)` — which
applies params/camera/post and **calls the step's `enter(info)`** (`stage.ts:558`) — and only then
`hooks.enterStep(stepId, info)`. So the world's `enterStep` runs after the step's `enter`; circuit steps that start
their own flight defer it to the first `update` frame (`C/resistance/steps/02-heat.ts:110-122`, `start` flag;
`01-bumps.ts:104,132-139`). Exceptions in either are caught and logged as `console.error` (the QA «console clean»
check catches them).

Chapter entry is applied **instantly**: the first step after a load gets `info.instant === true`, `info.from ===
null` (`runtime.ts:451`, 580). Every `enter` must produce the full state from any previous state (deep links,
«Назад», random access); circuit replays a non-instant `enter` only when it arrives across a seamless border.

## 6. A step module (anatomy)

`C/resistance/steps/03-shape.ts:24-126` is the cleanest example. Conventions:

- Doc comment: `` `<id>` — «<step title>». <what the reader sees and does>. Goal: <the «Ціль» condition>. ``
- Constants at the top, each with a one-line comment (seconds, thresholds; «script: …» when the number is the
  script's).
- `export const shapeStep: StepFactory = ({ ctx, stand, reached, reach, here }) => { … }`.
- Factory-time (once per chapter): `ctx.input.register(obj, { cursor, enabled: () => ready() && …, dragStart,
  drag, dragEnd })` (L39-58), `ctx.qa.probe(name, target)` (L60-62), `ctx.qa.expose(stepId, () => ({…}))` (L63-70).
  `InteractionHandlers`: `app/src/engine/input.ts:60-85` (`cursor, tooltip, hover, press, release, click,
  dragStart, drag, dragEnd, wheel, enabled, dragOwner`); `register(object, handlers, layer?) → Unsubscribe` (L119).
- `ready()` / `landed` predicate: `here(step) && <arrival motion finished>` — input and callouts wait for it
  (`03-shape.ts:37`, `03-glow.ts:107`).
- `spec: StepSpec` (`app/src/engine/stage.ts:171-197`): `{ camera, params, colors?, poses?, show?, cameraMove?,
  env?, envTune?, post?, duration?, ease? }`. **Unspecified params return to their initial value on every step
  entry** (`stage.ts:465-480`) — the reset you get for free. Camera: name registered with `ctx.camera.shots({…})`
  or an inline `Shot` (`position, target, fov, fit{center, radius}, orbit, near, …`).
- `ui: StepUiSpec` — §7.
- `enter(info)`: reset per-visit state (`held = false; shownFor = 0; …`), set targets with `info.instant ? 0 :
  seconds` (`03-shape.ts:98-109`).
- `leave()`: release holds, send the step's props home (`stretch.go(1, SHAPE_BACK)`, L110-114).
- `update(dt)`: early `if (!here(step)) return` where needed; per-frame timers (`shownFor += dt`); the goal check
  `if (<condition> && !reached(step)) reach(step)` (L123).
- Sub-states inside a step: `ctx.stage.setParam(name, v, { duration | instant })` (`stage.ts:275-298`; reverts on
  the next entry), `ctx.stage.toggle(actor, shown?)` (L252-263), tweens on `ctx.stage.scope` / `info.scope` (killed
  when the step is left, L242-244).
- Scrubbing slider pattern (UI_API §3.3, used by `glow`, `story`, `riddle`, `dive`): state `{ target, shown, drag,
  told }`; `onChange: (v) => x.target = v`; `onInput: (_v, how) => x.drag = how === 'drag'`; in `update` follow the
  thumb directly while dragging, else glide speed-capped; push the fill with `ui.patch(id, { current: x.shown })`
  when it moved (`C/lamp/steps/03-glow.ts:57-75,108-119`).

## 7. Step UI — declarations and binding

Types: `app/src/hud/step-ui-types.ts`; API: `app/src/hud/step-ui.ts`; both exported from `@/hud`
(`app/src/hud/index.ts:220-222`).

`StepUiSpec` (L259-295): `controls?` (dock), `board?` (big chart / table / stats), `callouts?`, `hotspots?`,
`reset?` (restore control defaults on each entry), `goal?: When`, `nav?: { hiddenUntil: When | 'goal' }`,
`panel?: { hiddenUntil?: When; closingWhen?: When }`. Ignore `honesty` (L261, not rendered) and `hint` (L267, a
toast; path hints come from the content and are shown by the panel after 15 s and 40 s, `hud-dom/step/path-body.ts:245-249`).

Controls (`ControlSpec`, L174-185); common base `{ id, hint?, visible?: When, disabled?: When }` (L17-26):

| type | fields | lines |
|---|---|---|
| `slider` | `label, value, min, max, scale?: 'linear'|'log', step?, stops?, snaps?, unit?, digits?, format?, marks?[{value,label}], onChange?, onInput?(v, 'drag'|'jump'|'step')` | L28-43; `SliderScale` `app/src/ui3d/widgets/slider-scale.ts:5-18` |
| `toggle` | `label, value?, onChange?` | L45-50 |
| `segmented` | `label?, items[{id,label}], value?, onChange?` (nodes `ctl-<id>:<item>`) | L52-59 |
| `button` | `label, icon?, primary?, onClick` | L61-67 |
| `readout` | `label, unit?, digits?, format?, get?: () => number` or `text?: () => string`, `color?` | L69-81 |
| `gauge` | `kind?, label, min, max, unit?, digits?, zones?, get` | L83-93 |
| `chart` | `chart: ChartProps`, `init?(chart)`, `update?(chart, t)` | L95-103 |
| `table` | `head?, rows | () => rows, highlight?, align?` | L139-149 |
| `stats` | `items[{label, get, unit?, digits?, color?}], columns?` | L152-164 |
| `note` | `text | () => string, icon?, color?` | L167-172 |
| `custom` | `node: UiNode, dom?(host) => DomWidget, update?` | L122-136 |

`BoardSpec` (L244-257): `{ title?, size?: 'sm'|'md'|'lg'|'fill', children: ControlSpec[], visible? }` — the
sanctioned place for the oscilloscope chart and result tables; readouts in a board sit in rows. `ChartProps`
(`app/src/ui3d/charts/chart.ts:50-61`): `{ height?, x: AxisSpec, y: AxisSpec, y2?, series: SeriesSpec[], window?,
legend?, onScrub? }`; `AxisSpec` (`charts/axis.ts:7-27`): `min, max, log?, label ('U, V'), ticks?, tickCount?,
format?, bare?`; `SeriesSpec` (`chart.ts:21-37`): `id, label?, color, axis?, kind?, width?, stack?, dash?, opacity?`;
`ChartApi` (L67-78): `setData(id, xs, ys)`, `push(id, x, y)`, `clearData(id?)`, `setAxis(which, spec)`,
`setMarker(id, marker | null)`. Example with chart + stats in a board: `app/src/volumes/electricity/chapters/
current/steps/04-ohm-board.ts:30-90` (volume 1, classic format, but the same API).

`CalloutSpec` (L203-220): `{ anchor: Object3D | [x,y,z] | () => Vector3, text: string | () => string, color?,
side?: 'left'|'right'|'up'|'down', occluders?, visible?: When, priority? }` — phones show only the first few
(declare the step's point first).

Binding rules:

- **Every `label`, mark label, callout text, tooltip and board `title` is `caption(step, i)`** (or built from
  captions). Readout/axis units in international notation may be literals (`unit: 'V'`, `label: 'U, V'`).
- Control `id` unique within the chapter (`binding.controls` keyed by id, `step-ui.ts:165-169`); node name
  `ctl-<id>` (QA finds it with `__ui.locate('ctl-<id>')`). Values live for the chapter instance:
  `ui.value(id)` works in every step (throws for an id without a value, L175); `reset: true` restores defaults on
  entry.
- `StepUiApi` (L56-63): `define, value, set(id, v, {notify?}), onChange, press(id), patch(id, {label?, min?, max?,
  value?, disabled?, current?}), toast(text, opts)`.
- The DOM HUD **rebuilds the step's dock and board on every step entry** (`app/src/hud-dom/dock/index.ts:96-112`):
  a chart's `init` runs again each entry (`hud-dom/charts/index.ts:21-33`), so `init` must refill from model state.
- Gates: `nav: { hiddenUntil: 'goal' }` hides the navigator until the goal (`app/src/hud/nav-gate.ts:24-34`);
  `panel.hiddenUntil` holds the step text during a self-playing entry (`C/prologue/scene.ts:88`);
  `panel.closingWhen` brings the closing card on a last step by itself (`C/build/steps/04-flashlight.ts:86`);
  `pathEnd.shown` (`app/src/hud/path-end.ts:6-16`) tells a step the closing card is up (fade its dock:
  `visible: () => !pathEnd.shown`).

Sketch for an electronics step (instruments are E2's, names provisional from `recon-E2/SYNTHESIS.md` §1.5):

```ts
ui: {
  reset: true,
  controls: [
    { type: 'slider', id: 'r-set', label: caption('pick', 0), min: 100, max: 10_000, scale: 'log', step: 2,
      value: 1000, unit: 'Ω', marks: [{ value: 100, label: caption('pick', 1) }, …], onChange: (v) => … },
    bench.meter.readout('meter-v', caption('pick', 2)),          // ReadoutSpec (planned)
  ],
  board: { title: caption('pick', 3), size: 'md', children: [bench.scope.chart('scope', { ch1: caption('pick', 4), ch2: caption('pick', 5) })] },
  callouts: [{ anchor: () => …, text: caption('pick', 6), side: 'up', visible: () => here('pick') && reached('pick') }],
  goal: () => reached('pick'),
}
```

## 8. Goals — check, latch, report

- Script «Ціль» → code: the step's `update` tests the condition each frame and calls `reach(step)` once
  (`C/resistance/steps/01-bumps.ts:146-149`, `02-heat.ts:145-146`, `04-balance.ts:195-199`; holds use a timer:
  `held = cond ? held + dt : 0; if (held >= HOLD) reach()` — `C/lamp/steps/06-story.ts:174-175`, helper
  `holdFor(seconds)` in `C/prologue/steps/clock.ts:26-37`).
- `ui.goal: () => reached(step)` (`01-bumps.ts:76`). The HUD polls it per frame; on the first `true` it reveals
  «Висновок» and records the step in its session set (`app/src/hud-dom/step/path-body.ts:214-224,244`). A step
  without `goal` shows the takeaway at once (L221) — usable for `lab`'s free-bench steps.
- A non-latched predicate also works (`C/prologue/scene.ts:83` `goal: () => toggle.lightings >= 2 && glow > 0.5`)
  because the HUD latches, but then the chapter cannot show «→ X» captions after the condition drops: prefer
  `sessionGoals`.
- Captions timed by the script: `→ «X»` → `visible: () => here(s) && reached(s) && …` (`01-bumps.ts:95-99`);
  `«A» → «B»` → A `!reached(s)`, B `reached(s)`.
- Report for QA: the chapter reader exposes `reached: STEP_IDS.filter((s) => sessionGoals.has(s))`
  (`C/resistance/scene.ts:74`); QA checks the panel (`[data-ui="path-takeaway"]` shown only after the goal).

## 9. Mounting and unmounting shared things

- The world (circuit: `mountWorld(ctx, { drift })`, `app/src/volumes/circuit/shared/world/index.ts:123`) is mounted
  **once**, in the chapter's facade (`C/resistance/stand.ts:87`, `C/lamp/world.ts:43`), before the factories run.
  Chapter-only props are created there too and added to the shared frame (`stage.base.frame.add(thermo.group)`,
  `stand.ts:91-93`). Disposal is automatic (`ctx.root`, `ctx.track`, `ctx.onDispose`).
- A step changes the world through (a) its declarative `spec.params` (`deep`, `lens`, `window`, `closed`, …),
  (b) `ctx.stage.setParam` sub-states, (c) the facade's travelling numbers: `glide(initial)` with
  `go(to, seconds)` / `set(v)` / `update(dt)` (`C/resistance/parts/glide.ts:6-61`), e.g.
  `stand.thermoShown.go(0, info.instant ? 0 : 0.6)` in every other step's `enter` (`01-bumps.ts:105`). The facade
  owns `snap()` (all glides to target, deep links) and `update(dt, t)` (`stand.ts:140-164`).
- Things a step leaves on the bench fade out in `late()` (runs for every step every frame, `mine` flag:
  `C/lamp/steps/04-energy.ts:92-106`) or in `leave()`.
- Per-step input on shared objects: register once, gate with `enabled: () => here(step) && ready()`; for one
  object used differently by several steps the scene registers it once and asks the step on screen
  (`lensInput`, `C/lamp/scene.ts:115-128`); a step-configurable control object (`sw.enabled = () => …;
  sw.flipped = (closed) => …`, `C/resistance/parts/switch.ts:10-45`, set in `02-heat.ts:64-70,103,114`).
- Electronics (planned in `recon-E2/SYNTHESIS.md` §1.2, not built yet): `mountBench(ctx, opts) → Bench` with
  `preset(parts, leads?, seconds?)` / `clear(seconds?)` for a step's own small circuit, `snap()`, `update`,
  `late`, `flying`, `meter.readout(id, label)`, `scope.chart(id, labels)`; QA readers `electronics-bench`,
  `electronics-board`, `electronics-motion` (so chapter readers must use other names).

## 10. Borders and `seamless`

- `circuit` is `"seamless": true` (`app/src/volumes/circuit/volume.json:10`): neighbours share one border frame;
  `shared/world/border.ts` (`ORDER`, `BORDERS`, `borderOf`, `createBorders` → `leave(to)`, `arrive(id, from,
  {camera?, then?})`); scenes read the previous chapter from `ctx.store.get()` at creation
  (`C/resistance/scene.ts:42-43`) and replay the first step's entry non-instantly after the hold (L83-91).
- `electronics` has no `seamless` (asserted, `E/__tests__/journey.test.ts:127-128`): the runtime plays its own
  zoom (`app/src/engine/runtime.ts:510-528`). `leaveChapter?(to) → number | (() => boolean) | null`
  (`chapter.ts:141`): return `null` (or omit). No `ORDER`/`BORDERS` needed; first steps simply build their state
  in `enter` with `info.instant`.

## 11. QA hooks and the interaction script

- `ctx.qa.probe(name, Object3D | Vector3 | () => …, { origin? })` and `ctx.qa.expose(name, () => json)`
  (`app/src/engine/qa-probes.ts:30-38`), cleared with the chapter. Naming in circuit: one reader per chapter
  (`'resistance'`, `'lamp'`), one per step (`'bumps'`, `'heat'`, …), `'motion'` for continuity; probes for every
  thing a test must touch (`'grip'`, `'switch'`, `'place-lamp'`, `loop-0..24`).
- Browser hooks used by the scripts: `__app.step(dt, n)`, `__app.read(name)`, `__app.locate(probe)` → `{x, y,
  visible, shown, world}`, `__app.next()`, `__app.position()`, `__app.pause()`; `__ui.locate('ctl-<id>')` →
  `{x, y, w, h}`, `__ui.value(id)`; panel selectors `[data-ui="path-takeaway"]`, `path-more` (`aria-expanded`),
  `path-opening`, `path-recall`, `path-closing`, `nav-next`; narrow screens: open the sheet tab first
  (`tools/qa/sheet-tab.mjs` `sheetTab(page, 'controls'|'text', settle)`).
- Script skeleton (`C/lamp/qa/interactions.mjs:11-35,98-138`): imports from
  `'../../../../../../../tools/qa/lib.mjs'` (`parseArgs, parseSize, launch, openApp, appUrl, baseUrl, appErrors,
  ensureDir, screenshot`) and `next-chapter.mjs` (`nextChapter(page, settle)` → `{ card: {shown, lines, bridge,
  next}, landed }`); `openApp(page, appUrl(baseUrl(args), { route: 'electronics/<id>/<step>', freeze: 0 }))`
  (frozen clock, `?debug&overlay=0&noaudio&q=high&freeze=0#/<route>`, `tools/qa/lib.mjs:100-113`); per step: reach
  the goal by pointer, `check('no takeaway before the goal', …)`, `check('takeaway after …', …)`, open
  «Докладніше» once, sample continuity; at the end the closing card (3 lines + bridge) and «Далі» lands on the next
  chapter; console clean.
- Command and output: `node app/src/volumes/<v>/chapters/<id>/qa/interactions.mjs --port <p> [--size 1280x720]
  [--touch] [--out <dir>]`. Each check prints `  ok  <step padded> <what>  [detail]` or `  FAIL …`; the last line
  is `PASS <n> checks at 1280x720[ touch]` / `FAIL <k> of <n>` (lamp, L136-138) or `<ok>/<n> checks passed
  (1280x720[, touch])` (resistance); exit code 1 on any failure. Sizes used: 1280x720, 1920x1080, 390x844 --touch.
- Platform acceptance: `node tools/qa/chapter-check.mjs electronics/<id> --out <dir>` (deep links, sequential,
  random, perf, leaks, layout; `tools/qa/chapter-check.mjs:1-30`); on this machine `QA_ALLOW_SOFTWARE=1` and
  `--skip perf` under software GL (memory note).

## 12. Tests every chapter has

`__tests__/manifest.test.ts` (template `C/lamp/__tests__/manifest.test.ts:1-44`):

```ts
import { describe, expect, it } from 'vitest';
import raw from '@electronics/content/generated/<id>.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

const NBSP = String.fromCharCode(160);
describe('<id> manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});
describe('<id> captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([['<step>', 0, '<text>'], …] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });
});
```

Plus one test per pure helper the steps use (number formatting `amps()` in `C/resistance/__tests__/manifest.test.ts:34-39`,
`sayMoment` / monotonic `secondsAt` in `C/lamp/__tests__/story-words.test.ts`, geometry in
`C/resistance/__tests__/snake.test.ts`). Vitest runs `src/**/*.test.ts` in the `node` environment
(`app/vite.config.ts` `test`), so no WebGL: tests import manifests, content, pure parts.

Platform-wide checks that bind a new chapter (no edit needed, but they will fail on a mistake):
`app/src/engine/__tests__/volumes.test.ts:47-64` (group/parent/axisValue agree with `volume.json`),
ESLint `app/eslint.config.js:35-61` on `src/volumes/*/chapters/**/*.ts` (engine only via `@/engine/api`; no gsap;
no `Date.now`, `performance.now`, `window.setTimeout`, `Math.random`; `local/chapter-boundary`: own volume's
`sim/`, `content/`, `shared/` only, never another chapter), `local/volume-boundary` (no other volume).
Gates: `cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build`, `python3 tools/content/doccheck.py --all`.

## 13. README pattern

`C/resistance/README.md` (34 lines) and `C/lamp/README.md` (38 lines):

```md
# Chapter `electronics/<id>` — «<question>»

Script: `docs/volumes/electronics/chapters/<id>.md` (all reader text from `content/generated/<id>.json`, captions by
position — `__tests__/manifest.test.ts`). World: `@electronics/shared/bench` (…). First frame: … ; last frame: … .

## Files
| File | What |
| `scene.ts` · `chapter.ts` | orchestrator …; the step contract |
| `stand.ts` | … every prop a number that travels (`parts/glide.ts`) |
| `parts/<x>.ts` | … |
| `qa/interactions.mjs` | every goal by real pointer input, continuity sampling, first/last frame |

## Steps
| Step | Reader does → goal | Notes |            (lamp: | Step | Camera | What the reader does → goal |)
| `<id>` | <action> → <goal> | entry motion, timings, caption timing, numbers |

## QA
`node app/src/volumes/electronics/chapters/<id>/qa/interactions.mjs --port <port> --size 1280x720 [--touch] [--out <dir>]`
(<n> checks; frozen clock; starts on `<route>`).
```

English, terse, every number that the script fixes (seconds, thresholds) named; a «Simplified / differs from the
script» section when the code deviates (prologue README L51-55).

## Gotchas

1. **Caption indices shift with `«A» → «B»`**: it yields two labels. Reordering or adding a caption silently
   re-labels the scene; the manifest test is the only guard — list every index the code uses.
2. **`·` is the «Підписи» separator** (`path_format.py:176`): a formula caption like «`U = I·R`» is split in two
   (and the halves fail the `«…»` grammar). Captions also cannot contain `«` or `»`. `tools/content` may not be
   edited (global constraints): write products with `×` or `⋅` (U+22C5) in captions, never U+00B7.
3. `«Текст»` bans `= ≈ × ÷ √ ^` and backticks (`path_check.py:28,114`); formulas only in «Висновок», «Підписи»,
   «Докладніше».
4. Generated labels carry NBSP between number and unit; compare with `.split(NBSP).join(' ')` in tests.
5. `stepUi(ctx)` must be called once per chapter; a shared bench helper that calls it again replaces the
   chapter's binding. Instruments should *return* `ReadoutSpec` / `ChartSpec` for the chapter's `ui`.
6. Do not copy `group: 'path'` from circuit chapters: electronics groups are `prologue, tools, resistor, capacitor,
   diode, transistor, practicum, branches`; use `group: meta.group`. Do not pass `parent: meta.parent` (null) on
   main chapters (`volumes.test.ts:61`).
7. The prologue hard-codes Ukrainian (`C/prologue/steps/map.ts:29` board title 'Мапа тому') — forbidden in
   electronics; take board titles from captions.
8. `C/prologue/README.md` describes an `open` step that no longer exists (scene has click/dive/riddle/map): the
   prologue is not a reliable template.
9. Step `enter` runs before the scene's `enterStep` (`runtime.ts:605-606`): camera flights or world moves
   started in `enter` can be overridden by the world's own `enterStep`; start them on the first `update` frame.
10. Chapter entry is `instant: true, from: null` even when the reader comes from the previous chapter; every
    `enter` must honour `info.instant` (glide seconds 0, `snap()`).
11. Unspecified `spec.params` revert to their initial value on every entry; a step that wants a param to persist
    must list it.
12. `StepSpec.camera` should be given for every step (`stage.ts:178`); `world.define`/`ctx.stage.define` throw for
    unknown params/colours/poses (`stage.ts:393-407`) and the runtime throws if defined steps ≠ manifest steps.
13. DOM board/dock are rebuilt on every step entry: chart `init` runs again; keep chart data in the model, not in
    the widget. Control `id`s are chapter-wide; reuse an id across steps only on purpose (values persist).
14. Callouts are evaluated per frame only for the step on screen, but circuit still ANDs `here(step)` into
    `visible` (transitions); phones show only the first few callouts (`priority`/declaration order).
15. `ctx.qa.expose` names share one namespace with the shared world's readers (planned `electronics-bench`,
    `electronics-board`, `electronics-motion`); chapter readers: `<chapter-id>`, `<step-id>`, `motion`.
16. Lint applies the clock / random bans only under `chapters/**`; `shared/**` may use `performance.now`, chapters
    may not. Chapters may import their own volume's `shared/`, `sim/`, `content/` only.
17. QA READMEs point to `/srv/electricity/qa/...` scratch tools — absent on this machine; always pass `--out`.
18. `docs/PATH_FORMAT.md`, `docs/HUD_DOM.md`, `docs/MOBILE.md` are referenced in code comments but absent from this
    repo (mirror): the field grammar's truth is `tools/content/path_format.py`.
19. `docs/volumes/electronics/` does not exist in this checkout yet (E1-8 in flight): no generated
    `E/content/generated/*.json`, so no chapter can compile until the script and `regen.sh --volume electronics`
    land.
20. A path step's `«Ціль»` and `«Бачимо»` never reach the runtime; the HUD does not apply caption timing
    (`path.captions`) — the scene must.
21. Mini-markup (formulas in backticks, `U_{out}`, `**term**`) is rendered in: callouts (WebGL labels, the DOM
    annotations area is a stub, `app/src/hud-dom/annotations/index.ts:1-8`), DOM slider / toggle labels
    (`hud-dom/dock/controls/slider.ts:216,227`, `inputs.ts:31,121,142` `setRich`), readout and stats captions
    (`readout.ts:37,84` `richEl`). It is NOT rendered in slider **mark** labels (`slider.ts:105`, plain
    `h('span', null, m.label)`) nor in the board **title** (`hud-dom/board/index.ts:93`, `setText`): a formula
    caption used there shows its backticks. Keep formulas out of marks and board titles.

## Open questions

1. (Partly answered, see Gotcha 21.) Do chart axis labels and segmented item labels render mini-markup? Not
   checked; axis labels in the repo are plain (`'U, V'`).
2. Will the electronics bench expose a `world.define`-style wrapper (like `CircuitWorld.define`, which also records
   specs for borders) or should chapters call `ctx.stage.define` directly? E2's `mountBench` sketch has no `define`
   / `enterStep`.
3. Where do the bench's stage params live (names like `closed`, `lens`, `deep` in circuit's
   `shared/world/params.ts`)? Steps' `spec.params` can only name registered params.
4. Should electronics keep circuit's module-level `sessionGoals` per chapter (survives a scene rebuild) or read the
   HUD's own reached set? Circuit's choice is per-chapter module state; nothing platform-side exposes the HUD's set
   to chapters.
5. `lab` (free bench): steps without `goal` show «Висновок» at once — is that the intended reading of the practicum
   «Перевірка» there, or does every lab step need a checkable goal?
6. Chapter-level «Підписи глави» (`path.labels`) — needed for electronics' last chapter (`lab`, the volume end's
   «start over»), as circuit's `build`?
7. Do electronics chapters need the floor ladder (`floorLadder(ctx, { floor })`, `@/hud-dom/journey`, used by
   `C/lamp/scene.ts:61-64`) for dives into a part (resistor film, p-n junction), and who owns it — bench or chapter?
