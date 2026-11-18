# API changes after the pilots (M3)

Shared file: each M3 agent appends under its own heading. Everything listed is backward compatible — the pilot
chapters build and pass unchanged; "pilots should switch" lists what in them is now a superseded workaround.

## M3-ui — HUD, step UI, widget kit, content pipeline

Full reference: `docs/UI_API.md` (§2, §3.1 height budget, §3.2 board, §4–§8, §13). Live examples:
`app/src/chapters/_sandbox-ui/parts/step-overflow.ts`, `step-board.ts`.

### Layout and testability
- **Step column fits the screen** (bug fix, no API): the dock's buttons sit in a sticky action row; text yields
  first (≥ 4 lines, scrolls), then the title gets compact, then the dock scrolls inside. Budget ≈ 908 px-eq at
  1280×720. Root cause of the pilots' overflow: the old fit set `maxH` without invalidating the layout.
- **`ctl-<id>` on every control**, segmented items `ctl-<id>:<item id>`:
  `await click('ctl-chem:nmc')` · `__ui.locate('ctl-run6')` · works in production builds.
- **`__ui.offscreen()`** — interactive nodes whose visible part leaves the viewport (empty = all reachable):
  `expect(await page.evaluate(() => window.__ui.offscreen())).toEqual([])` · also `__ui.press(id)`, `__ui.set(id, v, true)`.

### `stepUi` additions (`stepUi(ctx)` now returns `StepUiApi`; `StepUi` keeps its four members)
- `ui.set(id, v, { notify: true })` — like a user gesture: `ui.set('chem', 'nmc', { notify: true })`.
- `ui.press(id)` — runs `onClick`, flashes the button: `ui.press('run')`.
- `ui.patch(id, { min, max, value, label, disabled })` — live slider range:
  `ui.onChange('chem', () => ui.patch('U', { max: limit(), label: 'Напруга заряду' }))`.
- `ui.toast(text, { icon, tone, duration })` — event messages: `ui.toast('Не поглинуто — енергія не та', { tone: 'warning' })`.
- `visible` / `disabled` (`boolean | () => boolean`) on every control:
  `{ type: 'segmented', id: 'orient', items, visible: () => ui.value('orbital') !== 's' }`.
- **`board`** — HUD-placed panel for big charts / tables / stats, insets reported to the camera:
  `board: { title: 'Хімії', size: 'md', children: [{ type: 'chart', … }, { type: 'table', id: 't', head, rows }] }`.
- New control types: `table` (`head`, `rows` or `() => rows`, `highlight()`), `stats` (big numbers grid),
  `note` (status line): `{ type: 'note', id: 'storm', text: 'Захист від шторму', icon: 'warning', visible: () => v > 25 }`.
- `readout` with `text: () => string`: `{ type: 'readout', id: 'mode', label: 'Режим', text: () => mode }`.
- Honesty chips: custom text and conditions —
  `honesty: [{ slowed: 1e9, text: 'сповільнено ≈ у мільярд разів' }, { enlarged: 1000, visible: () => !ui.value('true') }]`;
  `{ kind: 'simplified', text: 'спрощена модель сліду' }`, `{ text: 'збільшено ×2' }`; factors ≥ 10⁶ print as 10ⁿ.
- Callouts: `text: () => string`, `visible`: `{ anchor: nucleus, text: 'Ядро', visible: () => !trueScale }`.
- Hotspots bind by id / index: `{ anchor: gearbox, content: 'gearbox' }` (`id` = slug of the international name);
  `title` is optional; `visible` as above.

### Widgets (`@/ui3d`)
- `Table`, `StatGrid`: `new Table({ head: ['Хімія', 'U'], rows })` · `table.setRows(next)` · `table.highlight = 2`.
- `Readout` text values: `new Readout({ label: 'Режим', text: 'заряд' })` · `readout.setText('на межі')`.
- `Chip.color` / `Chip.setIcon()` live: `chip.color = STATUS.alarm; chip.setIcon('warning')`.
- `Slider.setRange(min, max)`, `Slider.label`; `Tabs.disabled`; `Control.flash()`.
- `Tabs`: labels share the well by length, then smaller type, then wrap to rows (no broken words, no overlaps).
- Charts: `series: [{ id: 'ocv', color: 'mist', dash: true, opacity: 0.5 }]` · `NaN` in data = a gap ·
  year axes print «2010» (auto; `years: true|false`).
- `RadarChart`: `legend: false`, `radar.setSeries(list)`, `radar.setValues(id, values, { duration: 0.6 })` (morph).
- `honesty.slowed(n, text?)` … and `honesty.note(text)`.
- `worldConsole(ctx, { title, unit, children })` — billboard console that keeps text ≥ 16 px at 720p (grows ×3,
  then warns → `chapter-check` fails): `const c = worldConsole(ctx, { title: 'Пульт', unit: 0.01, children: [chart] })`.
- Chart / radar / phasor meshes are clipped inside scroll views; the wheel over a scrollable dock scrolls it
  (a slider takes the wheel only when focused there).

### Content (`@/content`, `tools/content/export_runtime.py`)
- `generated/<id>.manifest.json` + `manifestText(meta)`:
  `import meta from '@/content/generated/plant-wind.manifest.json'` →
  `defineChapter({ id, order, group, parent, ...manifestText(meta), scaleExp, theme, load })`.
- `steps[].labels` — UI labels quoted «…» in «Інтерактив»: `label: raw.steps[1].labels[1] // «×2 швидкості»`.
- `facts.items[].table: { head, rows, note? }` — rendered as a table in «Цифри і факти»; read it instead of parsing pipes.
- `crossReferences` → «Див. також» chips in the step their `where` names (dimmed + tooltip when not built).
- DECISIONS §54: terms / glossary rows get `name` (Ukrainian display name, «… (BMS)» for kept abbreviations) and
  `intl`; hotspots get `title` (display), `intl`, `id`. `termName(t)` returns the display name; the glossary is
  sorted and indexed by the Ukrainian alphabet, `intl` is a secondary line, search matches both.
  Labels builders write themselves (callouts, console titles, control labels) follow §54 too.

### Pilots should switch (superseded workarounds)
- **all three**: hand-mirrored manifest titles / blurbs and their guard tests → `manifestText(meta)`; retyped
  control labels (`atom/labels.ts` parts, `plant-wind/content.ts` `L`, `lab-battery/labels.ts` DOC) → `steps[].labels`;
  hotspot `title` strings matched against content names (`plant-wind` `hotspotNames`, `atom` `hotspotName`,
  `lab-battery` step titles + `labels.test.ts`) → `content: '<id>'`; English-first callout / hotspot / chip texts
  → plain Ukrainian (§54); QA clicks relative to neighbours / class-name walks → `ctl-<id>:<item>` and `__ui.offscreen()`.
- **atom**: `anchorWhen()` (anchor behind the camera) → `visible`; static «збільшено ×1000» → `{ enlarged, visible }`;
  «сповільнено ≈ у мільярд разів» → `{ slowed: 1e9, text }`; `hud()?.toast()` → `ui.toast()`;
  `qa/helpers.mjs locateWidget()` → `__ui.locate('ctl-…')`; «Електромагн.» shortening → full label (segmented fits);
  controls cut from `nucleus` / `models` for lack of room may come back (dock scrolls, buttons stay).
- **lab-battery**: `holo.ts` (hudSurface board) → `board`; `lab-ui.ts` `drive` / `press` / `external` / `action` →
  `ui.set(…, { notify })`, `ui.press`, board controls; `hud-bits.ts` `factTable` / `statGrid` / `notices` → `table`,
  `stats`, `note` (+ `visible`); `chem-data.ts` table parsing → `facts.items[].table`; voltage limit re-`define` →
  `ui.patch`; last-step link chips → automatic «Див. також»; `world.ts` `nowhere` anchors → `visible`; radar with
  7 pre-declared series scaled to 0 → `setSeries` / `setValues(…, { duration })`; dashed OCV / NaN / year `format`
  workarounds → `dash`, NaN gaps, auto years.
- **plant-wind**: dock = inputs only + `parts/console.ts` world consoles → `board` (or `worldConsole`); off-screen
  anchors → `visible`; `parts/badge.ts` Text3D status badges → `note` controls / callout `text: () => …`; chart
  marker labels as status → `note`; ≤ 2 honesty chips → as many as needed, with `{ kind: 'simplified', text }`;
  `blurb: ''` → manifest blurbs; step 11 portals stay (they are scene objects), but cross-references now also show
  as chips.

## M3-core

### Lint
- **Intra-chapter imports are allowed** (`local/chapter-boundary` replaces the `'../*/**'` pattern):
  ```ts
  // steps/blade.ts
  import { createBlade } from '../parts/blade';     // OK now (was a lint error)
  import { x } from '../../other-chapter/parts/x';  // still an error: leaves the chapter
  ```

### Stage (`ctx.stage`)
- **`stage.scope`** — tween / timer scope of the current step, for control handlers:
  ```ts
  onPress: () => {
    ctx.stage.scope.delay(1.2, () => spark());      // killed if the user changes step first
  },
  ```
- **Sub-states inside a step** — reverted automatically by the next step entry:
  ```ts
  ctx.stage.toggle(cutaway, on);                     // animated like a step change; omitted `on` = toggle
  ctx.stage.setParam('flow', 2.5, { duration: 0.6 }); // tween a registered param from a control
  ctx.stage.setColor('tint', 'coral');
  ```
- **Pose + pop actor on the same object** no longer fight over `scale` (the pose scales the actor's base):
  ```ts
  stage.actor(rotor);  stage.pose('rotor', rotor);
  stage.define({ big: { show: [rotor], poses: { rotor: { scale: 2 } } } });   // shows at 2×, pops in
  ```
- **Per-step environment** that deep links reproduce:
  ```ts
  ctx.env.base({ harmony: 0.2, fogDensity: 0.004 });          // factory: chapter look, survives every step
  stage.define({ offshore: { env: 'day', envTune: { harmony: 0.35 }, camera: 'sea' } });
  ```

### Camera
- **`Shot.fit`** — subject bounds for the mobile reframing of F5 (DECISIONS §57 d); a no-op hint today:
  ```ts
  ctx.camera.shots({ nacelle: { position: [40, 95, 60], target: [0, 90, 0], fit: { center: [0, 90, 0], radius: 12 } } });
  ```

### Text
- **`Text3D` text may outgrow its buffer at any time** (it used to vanish); **colour setter**:
  ```ts
  const badge = new Text3D('', { size: 18, screenSpace: true, billboard: true });
  badge.text = 'Захист від шторму: 25 m/s';   // fine after the first render
  badge.color = 'amber';                        // or badge.setColor('amber')
  ```

### Materials
- **`K.toon({ keepHue: true })`** — bright emissive keeps its hue (kit `window` material uses it now):
  ```ts
  const led = K.toon({ color: 'grey', emissive: 'cyan', emissiveIntensity: 1.6, keepHue: true });
  ```
- **`K.water({ followLook: true })`** — pattern follows `env.setScale(r, { adaptFrom })`; kit helpers pass it:
  ```ts
  ctx.env.setScale(60, { adaptFrom: LOOK_SCALE.diorama });
  const lake = waterDisc(40, 0, { followLook: true });        // island({ waterFollowLook: true }) likewise
  ```
  Convention: `K.water` meshes are built in their local XY plane and laid flat (`rotation.x = −π/2`).

### QA hooks and tools
- **Probes** (production builds included), replacing per-chapter `window.__…` globals:
  ```ts
  ctx.qa.probe('rotor', rotorMesh);               // test: await page.evaluate(() => __app.locate('rotor'))
  ctx.qa.expose('soc', () => ({ soc: bms.soc })); // test: await page.evaluate(() => __app.read('soc'))
  ```
  `__app.locate(name)` → `{ x, y, visible, shown, world }` (CSS px) or null; `__app.probes()` lists names.
- **`shot.mjs --eval` prints the value**: `node tools/qa/shot.mjs lab-battery/bms --eval "app.read('soc')"` →
  `eval → {"soc":55}`. Statement bodies print what they `return`.
- **`chapter-check`**: per deep-linked step at 1280×720 and 1920×1080 fails on controls outside the viewport
  (`__ui.offscreen()` — the HUD hook from M3-ui; skipped with a note while absent) and on world `Text3D`
  smaller than 16 px-eq at 1280×720 (`__app.textSizes()`). Frame time = min of 3 interleaved rounds per step,
  spread reported (`--perf-rounds`, `--perf-frames`, `--min-text`, `--skip layout`).

- **4K and DPR 2** (orchestrator addition): `chapter-check --sizes all` = 1920×1080 + 1280×720 + 3840×2160
  (screenshots, sheets, layout / text checks at each; 4K perf: warn > 14 ms, fail > 16.6 ms) + a 1920×1080
  DPR 2 pass comparing HUD rectangles, probes and hit targets with DPR 1. `--also-size` still works.
  ```bash
  node tools/qa/chapter-check.mjs plant-wind --sizes all
  node tools/qa/chapter-check.mjs plant-wind --size 1920x1080 --also-size 3840x2160 --skip dpr2
  ```
  `__app.textSizes()` also reports `magnification` (SDF zoom); > 4× is a warning (soft corners).

### Kit
- **Anchors / paths inside `b.part()` are prefixed** `<part>.<name>`; the bare name stays as an alias:
  ```ts
  const t = windTurbine();
  t.anchorWorld('blade0.tip');   t.anchorWorld('blade2.tip');   // were all 'tip' (last one won)
  ```
- **`windFleet(placements, turbineOptions)`** — instanced farm whose rotors spin (per-instance yaw / phase / speed):
  ```ts
  const fleet = windFleet(sites.map((p) => ({ at: [p.x, 0, p.z], yaw: windDir, speed: 1.2 })), { rotorDiameter: 120 });
  ctx.root.add(fleet.group);   // in update(): fleet.update(dt); fleet.turbines[i].yaw = …; fleet.hubOf(i)
  ```
- **`windTurbine({ interior })`** — `false` (empty nacelle) or a chapter `Object3D` mounted in the nacelle frame;
  drive-train anchors always exist. `addTurbineHub(rotorBuilder, k, accent)` and `addDriveTrainAnchors` exported.
- **`substation({ …, detail: 'light' })`** — breaker → disconnector → gantry / breaker → transformer, low-detail
  insulators, no fence: ≈ 1/3 of the triangles (110 kV, 2 bays: 59k vs 186k). `gantryPort(model, prefix, kV)`
  turns any `addGantry` into a `powerLine` support; `withLowDetail(() => …)` for own assemblies.
- **Offshore models** `addJacket`, `addFloater`, `addScour`, `addTopside('ac' | 'hvdc')`, `addJackUp`
  (`kit/energy/offshore.ts`, copied from `plant-wind/parts/offshore-models.ts` — the chapter keeps its copy; two
  copies exist until plant-wind switches):
  ```ts
  const b = new Builder('export-platform');
  b.frame({ at: [0, 0, 0] }, () => { addJacket(b, 30); addTopside(b, 'hvdc'); });
  ```
- **Close-up cells and a level tube** (copied from `lab-battery`'s `hero-cell.ts` / `lfpBrick()`):
  ```ts
  const hero = cylinderCellDetailed({ format: '21700', scale: 34 });   // parts gasket/cid/ptc/vent/cap, window cutaway
  const brick = prismaticCellDetailed({ scale: 6, cut: true });        // studs, nuts, vent, stepped electrode stack
  const soc = levelTube({ height: 1.2, color: 'lime' });  soc.level = 0.62;
  ```

### FX
- **`createProbabilityCloud`** (from `atom`'s `parts/cloud.ts`): `cloud.fill(n, sample)` / `cloud.sync(pos, ages)`.
- **`RibbonLines({ blend: 'normal' })`** — alpha-blended lines that stay visible on a bright sky.
- **`flow.setPaths(paths)` / `flow.setPath(row, path)`** — reshape a flow at run time (same path count).
- **`createOrbs({ instanceColors: true })`** + `orbs.setInstanceColor(i, colour, brightness)` + `commit()`.
- **`createSparks(ctx, { color: 'cyan' })`** — a single colour is accepted.
- FX_API §0 now gives metre-scale sizes (`createWire` `detail`, `radius`, `repeat`, flows, sparks).

### Simulation helpers (`@/sim/lab-battery`, additive)
```ts
const run = discharge(CELLS['LFP-100'], 0.5);  run.curve[k].wh; run.curve[k].heatJ;    // running totals per sample
bms.setCellSoc(5, 20);                                                                // one weak cell
const mod = createLiveModule('NMC', { barrier: false });  mod.step(dt * 30);  mod.tempsC;
runOvercharge('NMC', true).cutoffS;            // 240 model s (illustrative)
nailScenarioC('LFP', 100, t).vent;             // valve open (stays open)
```

### Pilots should switch
- `atom`: flat `step-*.ts` layout and the "actor or pose, not both" holder groups are no longer needed;
  `qaProbe` / `window.__atomQa` → `ctx.qa.probe` / `ctx.qa.expose`; interaction tweens may use `ctx.stage.scope`.
- `lab-battery`: `parts/index.ts` / `sim/index.ts` / `steps` barrels are optional now; the per-step
  `ctx.env.tune(...)` in `enterStep` (`scene.ts`) → `StepSpec.envTune`; `window.__lab.probe` →
  `ctx.qa.expose('probe', …)` + `__app.read('probe')`.
- `atom` (fx): `parts/cloud.ts` → `createProbabilityCloud`; two `Orbs` sets for "one brighter electron" / mixed
  swarms → `instanceColors`; `createSparks` triples → a single colour where that was the intent.
- `lab-battery` (sim): `sim/runs.ts` re-integration of Wh / heat → `CellSample.wh` / `.heatJ`; copied SOC + `set()`
  in `bms-session.ts` → `setCellSoc`; the coupling loop in `sim/thermal-session.ts` → `createLiveModule`; the
  240 s constant → `runOvercharge(chem, true).cutoffS`; own vent at ≥ 90 °C → `nailScenarioC(...).vent`.
- `lab-battery` (kit): `parts/hero-cell.ts` → `cylinderCellDetailed`; `lfpBrick()` → `prismaticCellDetailed`; the
  three hand-built level tubes → `levelTube`.
- `plant-wind` (kit / fx): `parts/fleet.ts` → `windFleet`; own `blade0` tip markers → `anchor('bladeN.tip')`; hiding
  nacelle meshes → `windTurbine({ interior: machineRoom })`; hand-built substation + copied `LineSupport` port →
  `substation({ detail: 'light' })` / `gantryPort`; `parts/offshore-models.ts` → the kit copy; chapter shaders for
  wind streaks / streamlines / wakes → `RibbonLines({ blend: 'normal' })`; CPU-advected `Orbs` → `flow.setPaths`.
- **Found by the new checks (fix, not just switch):** `atom`'s interaction test locates tabs by class name and
  gets 34/38 on a production build → `__ui.locate('ctl-<id>:<item>')`; `lab-battery` step `scale-and-future`
  label «500 Wh» is 13.6 px-eq at 1280×720 (< 16) → `chapter-check lab-battery` fails on that item.
- `plant-wind`: barrels (`parts/index.ts`, `sim-bindings/index.ts`) optional; `parts/switch.ts` + reset in
  `leave` → `ctx.stage.toggle` / `setParam`; own button tween scopes → `ctx.stage.scope`; `createBadge(…, reserve)`
  placeholder → plain `Text3D` (buffer grows); `qa/B-plant-wind/eval.mjs` → `shot.mjs --eval`; `window.__wind` →
  `ctx.qa.expose`.

## M4 — the project is a library of volumes (2026-11-13, agent M4-volumes; DECISIONS §58)

Electricity is volume 1 (`electricity`). Nothing changed in how it looks, reads or behaves; paths, ids and a few
names did. Full account: `docs/VOLUMES.md`, `docs/ENGINE_API.md` §22, `docs/UI_API.md` §11.

### What moved

| Before | Now |
|---|---|
| `app/src/chapters/<id>/` | `app/src/volumes/electricity/chapters/<id>/` |
| `app/src/chapters/_sandbox-*/` | `app/src/volumes/_dev/chapters/_sandbox-*/` (dev-only pseudo-volume) |
| `app/src/sim/**` (`@/sim/…`) | `app/src/volumes/electricity/sim/**` (`@electricity/sim/…`) |
| `app/src/content/generated/` (`@/content/generated/…`) | `app/src/volumes/electricity/content/generated/` (`@electricity/content/generated/…`) |
| `app/src/hud/fixtures/` | `app/src/volumes/electricity/fixtures/` (given to the HUD by `volume.ts`) |
| `docs/CURRICULUM.md`, `docs/GLOSSARY.md` | `docs/volumes/electricity/CURRICULUM.md`, `…/GLOSSARY.md` |
| `docs/chapters/<id>.md`, `_shared-house.md`, `_notes-*.md` | `docs/volumes/electricity/chapters/…` |
| `docs/chapters/INDEX.md` | `docs/volumes/electricity/INDEX.md` |
| `docs/chapters/_export/<id>.json` | `docs/volumes/electricity/chapters/_export/<id>.json` |
| `docs/chapters/_export/schema.json`, `README.md` | `tools/content/export.schema.json`, `docs/CONTENT_EXPORT.md` |

New: `app/src/volumes/library.json`, `app/src/volumes/<volume>/{volume.json, volume.ts, chapters.ts}`,
`app/src/engine/{volume.ts, library.ts}`, `app/src/hud/library.ts`, `app/src/volumes/_demo/` +
`docs/volumes/_demo/` (dev-only demo volume), `tools/qa/library-check.mjs`, `docs/VOLUMES.md`.

### Renamed / changed API (breaking for code written against M3)

- `ChapterManifest.scaleLabel` → **`axisLabel`**, `scaleExp` → **`axisValue`** (also in
  `<id>.manifest.json` and `manifestText()`); `ChapterManifest.volume` is new and filled in by discovery.
  `ChapterGroup` is a `string` checked against the volume's groups at registration.
- `Position` and router `Route` have **`volumeId`**; store: `volumeId`, `lastIn`, `markVisited(position)`,
  `settle(position)`; `progress.visited` keys are `volume/chapter`; storage key `electricity:v2` (v1 migrated).
- `engine.registry` → **`engine.library`** (`library.registry(volumeId)` is the per-volume `Registry`;
  `new Registry(volume, manifests, opts)`). `discoverChapters()` → `discoverVolumes({ includeDev })`.
- Runtime events carry `volumeId`; `transition.from/to` and `transitionStart/End.from/to` are full chapter ids.
- `Nav`: `goto(chapter, step)` accepts `chapter` or `volume/chapter`; new `open(address)`, `locate(address)`,
  `gotoVolume(id)`, `volume`, `volumes`, `library`; `chapters` is the current volume's list.
- `@/content`: `loadContent(key)` / `contentIds(volume?)` use the key `volume/chapter`; `linkTarget()` returns
  `{ volumeId, chapterId, stepId }` and accepts three-part addresses; new `contentKey()`, `recordKey()`;
  `GlossaryRecord.volumeId`, `alsoIn` holds content keys; `filterGlossary({ volume })`; `ChapterMeta.volume`,
  `ChapterMeta.axisLabel`; `ChapterContent.volume`.
- Generated content and export: `volume` field; **`crossReferences[].targets` are full addresses**
  (`electricity/current/drift`); export `schemaVersion` 2 (`axisLabel` / `axisRaw` instead of `scaleLabel` /
  `scaleRaw`; `group` is any group of the volume).
- HUD: `GROUP_LABEL` is gone → `groupLabel(volume, group)` from `@/engine/api`; `Journey.volume`,
  `JourneyChapter.volume / axisLabel / axisValue`; `loadJourney(engine, volume)`; `HudContext.volume`,
  `libraryLevel`; `HudModule.onVolume`; overlay name `library`; chip names `xref-<volume/chapter/step>`;
  `__ui.open(name)` / `close()`; `__ui.names()` / `locate()` ignore nodes under a hidden ancestor.
- Debug API: `__app.position()` has `volumeId`; `listChapters()` entries have `volume` and `fullId`;
  `listVolumes()`; `goto('volume/chapter/step')`.
- Lint: `local/chapter-boundary` now allows the own volume's `sim/**` and `content/**`;
  new `local/volume-boundary`.
- Tools: every `tools/content/*.py` takes `--volume <id>` (default: `library.json → defaultVolume`) or `--all`;
  `doccheck.py` checks all volumes by default; `regen.sh` regenerates all (`--volume <id>` for one);
  journey order / groups / parents / extra documents / extra checks live in `volume.json`.
  `chapter-check` takes `<chapter>` or `<volume>/<chapter>`.

### Chapter builders: what to do differently

1. Your directory is `app/src/volumes/electricity/chapters/<id>/`; documents are under
   `docs/volumes/electricity/`.
2. Import simulations and generated content through the volume alias: `@electricity/sim/<id>`,
   `@electricity/content/generated/<id>.json`, `@electricity/content/generated/<id>.manifest.json`.
3. In `index.ts` write `axisLabel` / `axisValue` (or `...manifestText(meta)` + `axisValue`). Do not write `volume`.
4. Navigation inside the volume is unchanged: `ctx.nav.goto('grid', 'grid-intro')`,
   `ctx.nav.chapter('plants')`. When you take a target from `content.crossReferences`, it is a full address:
   use `ctx.nav.locate(target)` / `ctx.nav.open(target)` (or `linkTarget(target)`), not `target.split('/')`.
5. Old QA commands keep working (`chapter-check atom`, `shot.mjs atom/quarks`, `__app.goto('atom', 'quarks')`);
   positions now print as `electricity/atom/quarks`.

### Pilots: what was changed by the move (nothing else)

`atom`, `lab-battery`, `plant-wind`: directory, `@/sim` → `@electricity/sim`, `@/content/generated` →
`@electricity/content/generated`, `scaleLabel` / `scaleExp` → `axisLabel` / `axisValue` in `index.ts`, test paths
to the export. `atom/step-standard-model.ts`: the bridge to `charge-field` reads the full address
(`linkTarget` + `ctx.nav.locate` / `open` instead of `split('/')`).

## L1-simple-format — reading level «Просто / Докладно» (2026-11-14; docs/briefs/L-simple-level.md)

All additive; chapters need no change (a chapter shows its simple layer once its document has one).
- **Content** (`@/content`): `StepContent.simple?: SimpleStep`, `ChapterContent.simpleQuiz?`, types `SimpleStep`, `SimpleHotspot`,
  `SimpleWord`; selector `stepAtLevel`, `quizAtLevel`, `hasSimpleLayer`, `READING_LEVELS`, `LEVEL_LABELS`,
  `LeveledStep`, `LevelLabels` (`app/src/content/level.ts`, pure — the 2D interface reuses it).
- **Engine**: `Settings.readingLevel` (`'simple' | 'detailed'`, persisted), `ReadingLevel`, `DEFAULT_READING_LEVEL`
  (`'detailed'` during the pilot), `isReadingLevel` in `engine/store.ts` / `@/engine/api`; `UrlFlags.level`
  (`?level=simple|detailed`, session override); `Engine.readingLevel()` (level in effect), `Engine.setReadingLevel()`.
- **HUD**: `app/src/hud/level.ts` (`readingLevel`, `stepCopy`, `quizCopy`, `onReadingLevel`) — the only place the
  WebGL HUD asks for the level; `buildSections` takes a `LeveledStep` (chips «Слова» / «Цікаво», no glossary button
  on a simple word card); Settings «Рівень тексту»; `__ui.value('reading-level')`; node names `chapter-quiz`,
  Tabs segments `reading-level:simple|detailed`.
- **Pipeline**: `tools/content/simple_layer.py` (parser), `simple_check.py` (doccheck group `simple`),
  `test_simple_layer.py`; `export_content.parse_quiz(text, section, marks)`; export keys `steps[].simple`,
  `simpleQuiz`, misconception `scene` (only when present); `terms_check` and `font-coverage` read the simple layer.
- **Fixture**: `_demo/wave` has a full simple layer, a `bead` hotspot and a `[Сцена: …]` misconception.

## F5 — phones and tablets (2026-11-13, agent F5-mobile; DECISIONS §57)

Full description: `docs/MOBILE.md`; reference: `docs/ENGINE_API.md` §23, `docs/UI_API.md` §15. **Everything is
additive.** On a desktop (fine primary pointer) nothing changes: layouts, projection, tiers and input are the
same code paths with the same numbers (before / after pixel comparison in `docs/reports/F5-mobile.md`).

### New
- **Device model**: `ctx.device` / `engine.device` / `store.get().device` / `__app.device()` —
  `{ formFactor, orientation, pointer, hover, safeArea, keyboard, pixelBudget, … }`; URL `?ff=`, `?safe=`.
  `if (ctx.device.formFactor === 'phone') …` is the only sanctioned device check (and rarely needed).
- **`Shot.fit` is live** on phones / tablets: `wide: { position, target, fit: { center: [0, 1, 0], radius: 6 } }`
  or `fit: rotorGroup`. Limits: `REFRAME` in `engine/camera/director.ts`. No `fit` → cropped to the central square.
- **`mobile` quality tier** (`?q=mobile`, automatic on phones / tablets); `QualityProfile.lowDetail`,
  `.bloomScale`: `if (!ctx.quality.profile.lowDetail) root.add(extraTrees)`.
- `Settings.frameCap: 'auto' | 30 | 60`; `engine.frameCap`; `stats().frameCap`, `.resolutionScale`.
- `engine.canFullscreen`.
- `HudMetrics.formFactor / orientation / pointer / shell / safeArea`; `pxPerUnit ≥ 1` on touch form factors.
- `CalloutSpec.priority` — a phone shows the 3 most important callouts: `{ anchor, text, priority: 0 }`.
- Touch input: `HoverEvent.pointerType`, `.longPress`; `InteractionHandlers.dragOwner`;
  `input.capturePinch(fn)`; a travelled touch is not a tap; fat-finger slop of 22 px around world objects.
- `@/ui3d`: `UiNode.wantsDrag`, `uiPointer`, `Pager.continuous`, `ScrollView` fling, `Tooltip.showAt(…, 'touch')`,
  `worldConsoles` (world consoles re-home into the sheet on phones — nothing to do in chapter code).
- `@/hud`: touch shells (`hud/touch/*`), overlay `'menu'`, `hud.touch` hooks; `window.__ui.sheet()`,
  `setSheet()`, `smallText()`, `smallTargets(px)`, `controls()`, `sounds()` and new node names.
- QA: `tools/qa/mobile-check.mjs`, `chapter-check --mobile`, `webkit-smoke.mjs`, `touch.mjs`, `snap.mjs`,
  `shot.mjs --touch --extra … --q auto`.

### Changed on purpose (all devices)
- Journey map: the invisible drag catcher now really covers the screen (it covered only the middle quarter:
  dragging, wheel-zooming or clicking "back to overview" elsewhere did nothing). No visual change.
- `input.gesture` resolves on touch *release* instead of touch-down (mouse: unchanged) — browsers grant audio
  activation there.
- `Slider`: a **touch** sets the value on tap / drag, not on touch-down (mouse: unchanged).
- `worldConsole()`: the «text … px < 16 px» warning is issued only for a console that is really shown (every
  ancestor visible). three.js updates hidden subtrees too, so consoles of other steps used to trip it — on
  phones in `atom`. Growth itself is unchanged.
- `HoverEvent.tooltip` is filled for touches as before; the HUD shows a touch's tooltip only on long press.

### Chapter builders and refinement agents: what to do
- Declare `fit` on every shot; order callouts by importance; keep readable content in `stepUi` (`controls`,
  `board`) or `worldConsole`; honour `lowDetail`; run `chapter-check <chapter> --mobile`.
- Per-pilot findings (what breaks or reads poorly on a phone, with fixes): `docs/MOBILE.md` §8.

## M5-merge-f5 — F5 merged with L1 / landing fix / D0 (2026-11-14)

No new API. Behaviour where the two sides meet:
- Both sides named the end-of-chapter quiz button (`step-quiz` in F5, `chapter-quiz` in L1): it is
  **`chapter-quiz`** everywhere (MOBILE.md and UI_API.md updated).
- The quiz takes its questions from `quizCopy()` (reading level) also on touch shells, where it opens as the
  sheet card `quiz-card`; switching the level closes an open quiz on every shell.
- The map card's `currentStep` is `null` while the landing step is unseen (landing fix) on every shell; F5's
  `compact` / side-sheet `maxHeight` apply on top.
- Settings: «Рівень тексту» first, then «Якість графіки» (touch set on phones / tablets) and, on touch only,
  «Частота кадрів». `__ui.value('reading-level')` and `__ui.smallTargets(minCssPx)` both kept.

## D0b-no-3d-ui — no 3D effects on the 2D interface (2026-11-14; DECISIONS §59 p)

- `@/hud`: `installParallax` (`hud/keys.ts`) is removed — the HUD plane no longer leans toward the pointer.
- `@/ui3d`: `RevealOptions.tilt` is removed (`reveal()` slides, scales and fades; no swing around the vertical
  axis). Callers passing `tilt` get a type error — drop the option.
- HUD layout: the step column (`dock.ts`) and the board (`board.ts`) are flat on wide screens (their static
  `rotY` of ∓0.03 rad is gone). `__ui.locate` rectangles of HUD nodes no longer change with the pointer.
- Rule for everyone (STYLE_GUIDE §5): interface elements never follow the pointer and get no perspective, tilt or
  fake depth; `UiNode.rotX/rotY` remain in the API, but HUD code must not use them for a 3D look.

## C7-hotspot-ids — a stable explicit id for every hotspot (2026-11-14; brief C7-hotspot-ids)

- Scripts: every hotspot carries `{#id}` after its name (`**Кільце** {#ring}: «…»`; `docs/CONTENT_EXPORT.md`
  «Hotspot ids»). All 661 hotspots of the scripts have one: the 521 ids that existed (slug of the international
  name) are unchanged, 140 are new (`distribution`, `generator-ac`, `magnetism`, `plants`, `transformer`,
  `transmission`).
- Export `_export/<id>.json`: hotspots gain a required `id` (schema pattern `^[a-z0-9]+(-[a-z0-9]+)*$`). New file
  `_export/_hotspot-ids.tsv` per volume: every id ever issued; doccheck fails when one changes or disappears, when a
  hotspot has no id, a malformed one, or an id used twice in a step.
- Runtime `content/generated/<id>.json`: `steps[].hotspots[].id` is now present on **every** hotspot (it was
  absent where the script had no international name) and is read from the script, not derived from the name.
  Purely additive: nothing else in the runtime files changed; `name`, `title`, indexes still resolve
  (`hud/annotations.ts`). `Hotspot.id` in `@/content/types.ts` is still optional (out of C7's scope;
  `docs/requests/C7-hotspot-ids.md`).
- Chapters that can switch to ids: `generator-ac` (30 index bindings), `magnetism` (24 index bindings),
  `transformer` (27 `hot(step, i)` name look-ups); per-step lists in `docs/reports/C7-hotspot-ids.md`.

## D1-dom-core — foundation of the DOM interface (2026-11-14; docs/HUD_DOM.md, DECISIONS §59)

Additive; `?hud=gl` (the default) is pixel-identical to before. Chapters need no change.
- **Engine**: `UrlFlags.hud` (`?hud=dom|gl`), `HudRenderer`, `DEFAULT_HUD = 'gl'` (`engine/app.ts`; D9 flips it).
  `Engine.settled()` also awaits `document.fonts.ready` under `?hud=dom`. `engine/input.ts`: keys whose target is a
  DOM control of `#kd-hud` that keeps them (`[data-keys]`, Space / Enter on what they activate, scroll keys in a
  `.kd-scroll`) or that called `preventDefault()` are not step keys.
- **ui3d**: `uiFocus.browserTab` (set by the DOM interface: Tab belongs to the browser; world surfaces keep focus
  only after a click). `mathMarkup` moved to `@/text` (re-exported from `@/ui3d` as before).
- **text**: `richRuns(source, rich?)` and `NOWRAP_FORMULA` in `@/text` (`text/markup.ts`) — the one pipeline of the
  SDF `Label` and the DOM (`mathMarkup` → short formulas unbreakable → `parseRich`); `Label` now calls it.
- **HUD shell**: `Hud.mountDom(mod: DomModule, inset?: InsetSpec): () => void` — a DOM region's layout box counts
  for the camera insets with the same code as a WebGL node (`offset*`, `ResizeObserver` → `relayout`).
  `DomModule`, `RegionHooks` (`hud/context.ts`), `InsetSpec` (`hud/shell.ts`). Under `?hud=dom` focus returns to
  where it was when an overlay closes.
- **QA hook** `window.__ui`: facade over a DOM backend (`hud-dom/core/qa.ts`, answers first from `[data-ui]`) and
  the WebGL backend (`hud/debug-gl.ts`); new `textSizes()` and `overlaps()`; `setUiDomBackend`, types in
  `hud/debug-types.ts`. `installUiDebug(hud, map, chromeNodes?)`. QA lib: `QA_HUD=dom|gl` env → `?hud=`.
- **`@/hud-dom`** (D2–D7 build on it): `mountDomHud(hud, webgl)`; `DomHud` context `{ hud, root, layers, webgl,
  region(mod, { layer, inset, region }), claim(name), claimed(name) }`; areas `step/ chrome/ dock/ board/ charts/
  custom/ overlays/ map/ annotations/ touch/` each export `mount(dom)`; core helpers `h`, `setText`, `setStyle`,
  `setClass`, `bindVisible`, `scrollArea` (`core/dom.ts`), `presence(el)` (`core/motion.ts`), `setRich`,
  `richFragment`, `richEl` (`core/rich.ts`), `icon`, `setIcon` (`core/icons.ts`), `applyAccent` (`core/tokens.ts`),
  `findNode`, `nodeRect` (`core/webgl.ts`, hybrid only). CSS: `core/base.css` (tokens `--c-*`, `--t-*`, `--r-*`,
  `--dur-*`, `--ease-*`, `--u`, `--safe`; classes `.kd`, `.kd.card`, `.chip`, `.btn`, `.kd-scroll`, `.ic`).
- **Fonts**: `pnpm webfonts` (`app/scripts/build-webfonts.mjs` + `.py`, Python fontTools build dependency);
  `app/scripts/charset.mjs` (charset + composed glyphs, shared with `pnpm fonts`); `pnpm fonts:check` also checks
  the WOFF2 font stacks; Fira Sans Italic added.

## D2-dom-step — DOM header, step panel, navigator, spine, system row, tooltips, toasts (2026-11-14; docs/HUD_DOM.md §22)

Additive; `?hud=gl` (the default) unchanged. Chapters need no change.
- **View models** `app/src/hud/model/` (pure, unit-tested; both renderers read them): `header.ts` (`headerModel`,
  `headerTitleMax`), `step.ts` (`stepModel` — counter, title, pages, copy at the level, `hasSimple`, `quiz`,
  `pending`; `honestyModel`, `honestyFactor`, `QUIZ_TITLE`, `STEP_PENDING`), `links.ts` (`stepLinks`, `stepOf`,
  `LINKS_CAPTION`), `sections.ts` (`stepSections`, `termModel`, `factModel`, `mythTitle`, `MYTH_KICKER`),
  `spine.ts` (`spineRows`, `spineFamily`, `spinePick`). `hud/header.ts`, `step-panel.ts`, `step-sections.ts`,
  `step-links.ts`, `spine.ts` and `dock-build.ts honestyChips` use them.
- **Hybrid bridge** (until D3's DOM column): `stepPanelBridge` in `hud/step-panel.ts` — `sizer: DomPanelSizer`
  (`ready`, `fit`, `chrome`, `want`, `height`, `setCompact`, units) makes the WebGL column budget size the DOM panel
  (the WebGL panel becomes an invisible spacer of its height); `openQuiz()` opens the WebGL quiz card for the DOM entry.
- **`@/hud-dom` step/chrome**: `createDomStepPanel(hud)` → `DomStepPanel { el, scroll, fit, setCompact, chrome,
  want, stepTitle, … }` — the API D3's column calls; reading-level switch `createLevelSwitch` (`reading-level`,
  `reading-level:simple|detailed`); tooltip of any `#kd-hud` element with `data-tip` (all areas may use it); toasts:
  the DOM takes over `hud.toasts.push/flush` (every `hud.toast` / `ui.toast` reaches it); `uiSounds(el)` (hover /
  tap / `data-sfx`); root classes `kd-layout-wide|narrow|portrait`.
- **New `data-ui` names** (DOM only): `reading-level`, `reading-level:simple`, `reading-level:detailed`,
  `term-card`, `tooltip`, `toast`, `toasts`, `loading`, `sys-fullscreen`, `spine`, `system`. The WebGL loading pill
  is now named `loading` (no visual change).
- **Step regions' CSS** (2026-11-16): chips in the step panel take their border off the padding, and the panel's
  gaps follow the WebGL twins (HUD_DOM §22 «Sizes»). An open section button keeps its yellow rim under the
  pointer. No API change.

## D4-dom-charts — charts, custom widgets and `hudLayer` in the DOM interface (2026-11-14; HUD_DOM §21)

All backward compatible for chapters; `?hud=gl` renders as before.
- **`@/ui3d`**: interfaces `ChartApi`, `PhasorApi`, `RadarApi`, `HeatMapApi` (the WebGL classes implement them);
  `HeatMap` / `RadarChart` expose `cfg` and a `twin` (`@internal`, used by the DOM twins); `RadarChart.snapshot()`.
- **`@/hud`**: `ChartSpec.init / update` receive `ChartApi` (method syntax: `(c: Chart) => …` callbacks still
  compile; a *helper* typed `(c: Chart)` that such a callback calls must take `ChartApi`). `CustomSpec.dom?: (host:
  DomHost) => DomWidget`; types `DomHost`, `DomWidget`. New exports `hudLayer(ctx, name?)` (DOM overlay, null
  under `gl`; successor of `hudSurface`) and `domKit` (`h`, `svg`, `setText`, `setStyle`, `setClass`, `observeUnits`,
  `tone`, `color`, `rgbaColor`, `svgPainter`, type `ShapePainter`).
- **`@/hud-dom`** (for D3): `charts/` → `chartWidget(spec)`, `DomChart` / `createChart(props)`, `DomPhasorScope`,
  `DomRadarChart`, `DomHeatMap`, `legendEl`; `custom/` → `customWidget(spec, host)`, `domHost(dom)`, `hudLayer`.
- **Chapters should**: give every `custom` control a `dom` widget (or use a kit chart node); replace `hudSurface`
  by `hudLayer` with a WebGL fallback; type chart helpers with `ChartApi`.

## M6-library-focus — the pilot volume is the front door; volume 1 behind a button (2026-11-16; DECISIONS §60)

- **Volumes.** New published default volume `circuit` (`app/src/volumes/circuit/`, alias `@circuit/*`), empty
  journey. `library.json`: `defaultVolume: "circuit"`, new `legacyVolume: "electricity"` (owner of pre-library
  links and saved data). `electricity/volume.json`: `order: 2`, new `aside: { label }`.
- **Manifest** (`VolumeIdentity` → `VolumeManifest`): `aside?: { label }` → `aside: string | null` (a published
  volume kept aside: not counted for the library level, `listed: false`, reached by its button on the default
  volume's home); `emptyNote?` → `emptyNote: string` (home-screen line while the volume has no chapters). A
  volume with an empty journey may have no groups.
- **Library**: `legacyVolume`, `aside` (published aside volumes); `multi` ignores aside volumes; a short chapter
  id with no caller (address bar, first navigation) is looked up in the legacy volume first, then the default.
  `Store` migrates a v1 record into `library.legacyVolume` (was: the default volume).
- **Nav**: the **lobby** — `nav.lobby` (volume shown by its home screen alone), `nav.onLobby(fn(volume, entered))`.
  `start()`: `#/` restores the last position only outside aside volumes; an empty volume named by the address
  (`#/` = default, `#/<volume>`) becomes the lobby instead of throwing. `gotoVolume()` of an empty volume enters
  its lobby (address `#/` for the default volume, else `#/<volume>`); back/forward between lobby and steps work.
- **HUD**: `createHome(hud, journey, stage)` (was `createHome(hud, map)`; `HomeStage = { setAttract }`);
  `createLibrary(hud, () => HomeStage | null)`. Empty home: names + `emptyNote`, no start / map / facts, drawn over
  `BackdropStage` (`hud/home-stage.ts`; the journey map is not built for a volume without chapters). Aside row at
  the foot of the home screen (`hud/home-aside.ts`): `home-aside-<volume>` buttons / `home-back`. `Hud.register`
  hands an open overlay over in place; `Hud.close()` in the lobby never reveals the empty scene; `M` does nothing
  in the lobby. Map backdrop: sine-free hash for the nebula noise (it showed hard-edged rectangles).
- **QA hooks**: `__app.lobby()`; `__app.listVolumes()[]` gains `role` (`default` | `aside` | null) and `legacy`.
  `tools/qa/lib.mjs → pickChapter / findChapter`: a short chapter id in a QA command resolves like the address
  bar (legacy volume first). Content tools skip a volume that has no `docs/volumes/<id>/chapters/` yet.
- **Command spellings**: without `--volume`, `build_index / build_glossary / export_* / typography / …` now mean
  `circuit` (they print "no documents yet" until its documents exist): add `--volume electricity` for volume 1.
  `regen.sh` and `doccheck.py` (all volumes by default) are unchanged; `chapter-check atom` still means
  `electricity/atom` (legacy-first), the full form `electricity/atom` always works.

## M7-circuit-platform — the «path» chapter format, planned journeys, named floors (2026-11-16; brief M7)

- **Documents and tools.** New format `docs/PATH_FORMAT.md` for volumes with `volume.json → format: "path"`.
  `tools/content/path_format.py` (parser), `path_export.py` (export, runtime, INDEX, GLOSSARY), `path_check.py`
  (doccheck group `path`), tests `test_path_format.py`. `chapters.run_volumes(fn, default_all, path=None)`: a
  path volume runs `path()`; tools without one print «not applicable». `chapters.FORMAT`, `chapters.PLANNED`
  (every journey id); in a path volume `CHAPTER_IDS` = planned chapters that have a document. `doccheck.main_path`.
  `app/scripts/font-coverage.mjs` reads the path export fields too.
- **Manifest** (`engine/volume.ts`): `VolumeIdentity.format?`, `groups[].layer?`, `journey[]: PlannedChapter`
  (`title?`, `minutes?`, `floor?`), `axis.floors?: AxisFloor[]`; `VolumeManifest.format: 'classic' | 'path'`,
  `JourneyGroup.layer: VolumeLayer`, `JourneyAxis.floors`, `floorValue(volume, id)`. Validated in `defineVolume`.
- **Content** (`content/types.ts`): `StepContent.path?: PathStep` (`idea`, `action`, `takeaway`, `more[]`,
  `marks[] {text, term}`, `recall?[] {target, title}`, `honesty?`, `hints?`), `ChapterContent.path?: PathChapter`
  (`layer`, `hook`, `know`, `now[]`, `bridge`, `next`, `minutes`); `ChapterMeta` gains optional `axisValue`,
  `minutes`, `format`, `layer`. `defineContent` passes `path` through. Volume 1 content is unchanged.
- **HUD.** `journeyFromManifests` adds planned chapters (journey entries with a `title`) as `real: false`;
  `JourneyChapter.layer`, `.minutes`; `Journey.built`; `journeyRemaining(visited, journey)`, `chapterWords(volume)`.
  Map: `pathPoint` works for 0 / 1 nodes, no tube for one node, `MapTick.label` (floor names), planned nodes
  slate without emblem (also in `?fixture` mode), «лишилося ≈ N хв». Home: `empty` = no built chapter; minutes chip.
  `hud/recall.ts → RecallTrail` (model of «Згадайте…» + «Повернутися»), not yet wired to a panel (waits for D2).
- **Volumes.** `circuit/volume.json`: format, layers, floors, the 9 planned chapters of PATH.md. New dev volume
  `_path` (two built sandbox chapters `_sandbox-path`, `_sandbox-flow`; planned prologue, `glow`, practicum).

## D3-dom-dock — DOM control dock, action row, board, column height budget (2026-11-16; HUD_DOM §23)

Chapters need no change; every `ControlSpec`, `ctl-<id>` / `ctl-<id>:<item>` name and `stepUi` member keeps its
meaning. `?hud=gl` renders as before (pixel-identical).
- **View models** (pure, unit-tested; both docks use them): `hud/model/controls.ts` — `slotOf(spec)`,
  `arrangeControls(items, 'dock' | 'board')` (dock: sliders, toggles row, blocks, readouts row, buttons to the
  action row; board: declared order, consecutive readouts / toggles in a row, buttons last); `hud/model/column.ts`
  — `columnBudget(sizes, compactChrome, { compactFirst })`, `TEXT_MIN`, `DOCK_MIN`, `COLUMN_GAP` (moved from
  `hud/dock.ts`, which no longer exports them).
- **Hybrid bridge**: `columnBridge` in `hud/dock.ts` (`domOwns()`, `rebuild()`): under `?hud=dom` on the desktop
  shell the DOM column builds the controls and owns the binding's `push` / `repatch` / `flash`; the WebGL column
  keeps the hint toast, honesty chips and annotations (`onSpec`). Touch shells: the WebGL sheet until D7.
- **Removed**: `stepPanelBridge.sizer` and `DomPanelSizer` (`hud/step-panel.ts`) and D2's hybrid placement of the
  DOM step panel; `stepPanelBridge.openQuiz` stays until D5.
- **`@/hud-dom`**: `dock/` → `createDomColumn`, `buildDomControls(binding, specs, { where, reset, host, customs })`,
  controls `domSlider`, `domToggle`, `domSegmented`, `domButton`, `domNote`, `domReadout`, `domStats`, `domGauge`,
  `domTable`; `board/` → `createDomBoard(dom)`.
- **New `data-ui` names** (DOM only): `dock`, `dock-scroll`, `dock-actions` (as the WebGL nodes), `ctl-<id>:tabs`
  (the radio group of a captioned segmented control, as WebGL), `sheet-tabs`, `sheet-tabs:text`,
  `sheet-tabs:controls`, `board`, `board-fold`. Region names `column`, `board` for `__ui.overlaps()`.
- **Keyboard** (DOM): sliders ←/→/↑/↓ (Shift ×10), PgUp/PgDn, Home/End with the WebGL step (`nudge`); segmented
  controls are radio groups (←/→ select); a visually hidden first Tab stop «До керування кроком» focuses the dock.

### M7-circuit-platform, part 2 (after the D2 merge)
- **Lint.** `shared/**` of a volume (its scene library) is importable by the volume's chapters; chapters of a dev
  volume may import another volume's `shared/**` (showcase). `eslint-rules/chapter-boundary.js`, tests, VOLUMES §2.
- **Manifest.** `AxisFloor.plain?` / `.namedAt?` and `floorLabel(volume, floor, visited)`: a floor named with a
  word not yet introduced shows its plain name until the step `namedAt` is opened (map ruler, node labels, home
  range). circuit: «ряди кульок» / «одна кулька» until `wire/atoms`.
- **Format.** «Текст» may have two paragraphs (runtime `panel[]` = paragraphs of one page); «Чесно» →
  `PathStep.note`; «Підписи» timed by the takeaway (`«A» → «B»`, `→ «B»`) → `PathStep.captions` (labels keep
  their order); chips `сповільнено ×10¹⁴`, `×5·10¹⁴`.
- **Step UI.** `StepUiSpec.goal?: When` (path chapters: the takeaway shows once it holds).
- **DOM panel.** `hud/model/path-step.ts` (`pathStepModel`, `hintsDue`, `PATH_LABELS`), `hud-dom/step/path-body.ts`;
  `DomStepPanel` fills it for path chapters (HUD_DOM §22.1). Builders of path chapters declare no `stepUi` honesty.

### M7-circuit-platform, part 3 (punch list of `circuit/prologue`)
- `@/hud-dom/journey`: `journeyInset(ctx, { id, onOpen })` (the volume's journey map as a board / dock widget,
  DOM plot or list, WebGL / touch-sheet stop buttons) and `floorLadder(ctx, { floor })` (the «де ми» cue). UI_API §11a.
- Path panel: no pager (button forward on the opening card, link «Питання з життя» back), one title size.
- `circuit/prologue`: `map` uses `journeyInset` (the scene model of the path is gone); «де ми» ladder in `scene.ts`.

### M7-circuit-platform, part 4
- Board `size: 'fill'` (DOM): the free scene area between spine and step column, centred; `journeyInset` grows
  with it. The inset's list form is a CSS container query (its ResizeObserver made a resize loop).
- `StepUiSpec.acting?: When`; «Позначки» chips written `→ …` appear when it first holds (or at the takeaway).
- `hud/where.ts` (`setWhere`, `onWhere`, `whereFloor`, `axisChipText`): `floorLadder` reports the floor; the header's
  axis chip shows it (path volumes: the current floor, plain names until introduced); on phones the ladder is
  hidden and a `header-floor` chip in the header row carries it.

## D5-dom-overlays — DOM settings, help, glossary, quiz, home, library, journey-map chrome (2026-11-16; HUD_DOM §24)

Chapters need no change. Overlay names, `__ui.open/close/overlay/mapNode`, the keys M, L, Esc and the QA names
(`home-*`, `volume-*`, `glossary-scope:*`, `reading-level:*`, `map-close`, `map-overview`, `map-step-<id>`,
`chapter-quiz`) keep their meaning. `?hud=gl` draws as before (one deliberate text change below).
- **Shell.** `Hud.domTwin(name, twin)`: the view registered under `name` is shown through `twin(view)` (its DOM
  twin; swapped in place when open). `hud/views.ts viewSources` (WeakMap view → `{ journey, stage }`), filled by the
  HUD plugin. `OverlayName` gains `quiz` (DOM only; the WebGL quiz stays a card of the step panel).
- **Removed:** `stepPanelBridge` (`hud/step-panel.ts`) — the DOM quiz entry opens the overlay `quiz`.
- **Map hook points** (`hud/map/map.ts`): `MapChrome { refresh(summary), card(node, currentStep) }`,
  `JourneyMap.attachChrome(chrome)` (the WebGL title bar, buttons, hint and card leave the view), `selection`,
  `enter(node, stepId)` public. Fixed: the WebGL chapter card crashed on a planned chapter (no steps).
- **View models** (pure, tested): `hud/model/home.ts` (`homeModel`, `homeStart`), `library.ts`
  (`volumeCardModel`), `glossary.ts` (`loadVolumeGlossary`, `loadLibraryGlossary`, `glossaryTabs`,
  `glossaryLetters`, `glossaryRow`, `glossaryTarget`), `glossary-search.ts` (`prepareGlossary`, `searchGlossary` —
  the matches of `filterGlossary`, strings normalised once —, `focusRecord`), `quiz.ts` (`QuizRun`), `map.ts`
  (`mapSummary`, `mapCard`, `stopName`, `stopFloor`), `help.ts` (`helpModel`). `hud/home-aside.ts` exports
  `asideLinks`, `enterVolume`. The WebGL views use them.
- **Text change (both renderers):** library cards count chapters with `chapterWords` («2 глави» in a path volume);
  help names «глави» in a path volume and drops the electricity-only «типи станцій» line there.
- **New `data-ui` names** (DOM): `overlay-<name>`, `<name>-close` (dialog close buttons), `glossary-search`,
  `glossary-clear`, `glossary-tabs[:<id>]`, `glossary-letter:<ch>`, `glossary-list`, `settings-quality:*`,
  `settings-frames:*`, `settings-text:*`, `settings-motion:*`, `ctl-settings-sound|dynamic|volume`, `settings-reset`,
  `quiz-option:<i>`, `quiz-next`, `quiz-result`, `home`, `home-resume`, `home-start`, `home-map`, `library`,
  `map-chrome`, `map-title`, `map-ring`, `map-card`, `map-card-ring`, `map-card-close`, `map-go`.

## D7-dom-touch — the touch shells in the DOM interface (2026-11-16; HUD_DOM §25, MOBILE §3a)

Chapters need no change. `?hud=gl` draws as before (the WebGL sheet, header, navigator, system row are untouched;
pixel identity checked). Under `?hud=dom` phones and tablets get the DOM sheet instead of F5's WebGL sheet.
- **Moved:** `hud/touch/geometry.ts` → `hud/model/sheet.ts` (`TOUCH`, `sheetGeometry`, `sideWidth`, `settleSnap`,
  `touchTop`, `SheetSnap`), plus the shared types `SheetTab`, `SHEET_TAB_LABEL`, `SheetInsets`, `SheetCardText`
  and `SheetControl` (`tab`, `snap`, `setTab`, `setSnap` — what `__ui.sheet()/setSheet()` and the step panel ask).
  `hud/touch/sheet.ts` re-exports `SheetTab` / `SheetInsets`; `TouchSheet extends SheetControl`.
- **`HudContext.touch`:** `sheet: SheetControl | null` (was `TouchSheet`); `card(node, onDismiss, opts)` takes
  `opts.text: SheetCardText` — the copy of the card, so the DOM sheet can draw it (`hud/annotations.ts` passes it).
- **`columnBridge.domOwns()`** = `?hud=dom` on every shell (was: desktop shell only); the WebGL dock builds no
  touch sheet under `dom`. `columnBridge.rebuild` is removed (no caller left).
- **DOM areas:** `hud-dom/dock` exports `domColumnParts()` (`ColumnParts`: panel, dock, board, `hasDock`,
  `hasBoard`, `layoutControls`, `release`); `DomStepPanel.setTouch(titleHost | null)` (title into the sheet's head,
  every page in one scroll, no page bar); header, navigator, system row and loading pill stay DOM on touch shells
  (`.off` hand-back removed); the system row gains `sys-menu` (touch shells only); the header gets class `where`
  while the chapter reports a floor; DOM tooltips show on a 480 ms long press on touch (no activation);
  `overlays/index.ts` no longer writes `--safe-*` on the modal layer (the root has them).
- **New overlay twin:** `menu` (DOM, `hud-dom/touch/menu.ts`; items `menu-library|map|glossary|sound|fullscreen|
  settings|help|home` as in WebGL).
- **Root classes / properties** (`#kd-hud`): `kd-touch`, `kd-pointer-coarse`; `--hit` 44 (phone) / 48 (tablet);
  `--safe-top|right|bottom|left` (CSS px), `--kb` (keyboard, CSS px), `--tch-top|left|right|nav-left|nav-w|load`
  (units).
- **New `data-ui` names** (DOM): `sheet`, `sheet-grip`, `sheet-side-grip`, `sheet-tabs`, `sheet-tabs:text|controls|
  board` (as F5), `sheet-card`, `sheet-card-back`, `sys-menu`, `overlay-menu`, `menu-close`.

### M7-circuit-platform, part 5 (owner's first live review, DECISIONS §60 p)
- `StepUiSpec.nav?: { hiddenUntil: When | 'goal' }` (`hud/nav-gate.ts`): the step navigator held back until the
  predicate first holds; DOM: inert + engine-clock fade, layout kept; WebGL: the buttons step aside; forward keys
  blocked; `__ui.navHidden()`; `tools/qa/mobile-flows.mjs` notes and skips «Далі» while held. UI_API §3.4.
- Sliders that scrub an animation: `SliderSpec.onInput?(value, how: 'drag' | 'jump' | 'step')` (DOM) and
  `ControlPatch.current` (the fill shows the animation's position, the thumb the target). UI_API §3.3.


### F-circuit-seams (2026-11-17) — same-frame chapter borders
- `SceneHooks.leaveChapter?(to): number | (() => boolean)` — the outgoing chapter walks to its border frame while the
  next one loads; the runtime swaps once it is there (≤ 12 s); a navigation back meanwhile re-enters the step on
  screen. Not waited for under `?freeze`. ENGINE_API §3.
- `volume.json → seamless` / `VolumeManifest.seamless` — a chapter change inside the volume is a 0.3 s plain
  cross-fade (no zoom, no chromatic aberration); the incoming director continues the outgoing idle drift
  (`CameraDirector.followDrift`, internal) and keeps the outgoing free area for 0.8 s before following the HUD's
  insets again (the incoming panel reports passing insets while it rebuilds). VOLUMES §7.
- Camera director: the idle drift amplitude eases toward the shot's (rate 5/s) instead of switching in one frame
  (the hitch at the end of every floor flight, `docs/requests/B-circuit-charge.md` §4). Affects every chapter by
  ≤ 0.6 s of fading at a change between a drift-0 shot and a normal one.
- `floorLabel(volume, floor, visited, stepsOf?)` — the named form also once a later chapter (or, with `stepsOf`, a
  later step of the naming chapter) was opened: a deep link past `wire/atoms` reads «ряди атомів».
- `@/hud/where`: `setWhereBase(key, floor)`, `baseFloor(key)` — the floor a composed world is on; the header's chip
  text falls back to it (not the chapter's own floor) when no ladder report stands; `whereFloor` (reported) is
  unchanged, so phone headers still swap the title for the chip only while a ladder reports.
- `TransitionState.quiet` — a load inside a `seamless` volume: the DOM loading pill waits 3 s (and only while
  the next chapter is still being built) instead of 0.25 s — the walk to the border frame is not «Завантаження…».
  The runtime now also sets `transition.progress = 1` once the next chapter is built.
- `drain`/`build` (circuit): `StepModule.finish?()` / `rewind?(play)` in `drain` (the battery swap as the chapter's
  end and its way back); `build` walks back to the `drain` border in `leaveChapter`.
- `RuntimeEvents.transitionStart` gains `seamless: boolean`: at a same-frame border the HUD keeps its chrome (no
  hide/show of the panels for the zoom) and the audio plays no whoosh.
- `SceneHooks.leaveChapter` may return `null`: no shared border with `to` (a jump across the map) — the runtime then
  plays the platform's own transition (the zoom), not the same-frame cross-fade (F-circuit-seams round 2).
