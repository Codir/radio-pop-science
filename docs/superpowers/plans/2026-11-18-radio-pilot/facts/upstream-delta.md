# Upstream delta cf1a355 → 63fd42c and what it made stale in the radio design

Scope: `git diff cf1a355 63fd42c` in `/home/pilot/tmp/radio-science-pop` (merge commit `63fd42c`, parents `cf1a355` and
`a87c714`; 377 files, +35 624 / −961). Design doc: `docs/superpowers/specs/2026-11-17-radio-volume-design.md` (877 lines;
"design Lnnn" below = its line number). Everything below was read in this run; paths are repo-relative.

Unchanged by the merge (empty diff): `app/src/volumes/library.json`, `app/package.json`, `app/vite.config.ts`,
`app/eslint.config.js`, `app/eslint-rules/`, `app/tsconfig.json`, `README.md`, `app/src/engine/nav.ts`,
`app/src/engine/registry.ts`, `app/src/engine/library.ts`, `tools/content/doccheck.py`, `tools/content/chapters.py`,
`tools/content/terms_check.py`, `tools/qa/chapter-check.mjs`, `tools/qa/mobile-*.mjs`, `tools/qa/library-check.mjs`.

---

## 1. Platform changes by area

### 1.1 `app/src/engine` (12 files, +503 / −39)

| File | Change (exact names) |
|---|---|
| `engine/app.ts:53` | `export const DEFAULT_HUD: HudRenderer = 'dom';` (was `'gl'`). `?hud=gl` still works. |
| `engine/app.ts:288-300` | New store subscription on `s.settings.deskShell` → `this.hud.setDeskShell(on)`; a later switch calls `this.resize()`. |
| `engine/chapter.ts:141` | New hook: `leaveChapter?(to: { volumeId: string; chapterId: string; stepId: string }): number \| (() => boolean) \| null;` in `interface SceneHooks`. |
| `engine/chapter.ts:215-217` | `ChapterContext.device` doc: under «Версія для комп'ютера» a phone or tablet reads as `desktop`; a switch calls `onResize`. |
| `engine/camera/director.ts:316` | New public `hold(shot?: string \| Shot): void` — stop on the pose on screen; with `shot` its settings (orbit limits, `fit`, drift, near/far) apply while the camera stays; throws `CameraDirector: unknown shot '<name>'`. |
| `engine/camera/director.ts:423` | `followDrift(other: CameraDirector): void` (`@internal`). |
| `engine/camera/director.ts:84` | `const DRIFT_EASE = 5;` — idle-drift amplitude now eases toward the shot's `drift` (≈ 0.6 s) instead of switching in one frame. Affects every chapter. |
| `engine/hud.ts:82` | `export function shellOf(device: Pick<DeviceState, 'formFactor' \| 'orientation'>, deskShell = false): HudShell` |
| `engine/hud.ts:93` | `export function layoutDevice(device: DeviceState, deskShell: boolean): DeviceState` |
| `engine/hud.ts:189` | `HudLayer.setDeskShell(on: boolean): void` (`@internal`). `HudMetrics.formFactor` reports `desktop` under the forced desktop shell. |
| `engine/reset.ts` (new, 78 lines) | `export const APP_STORAGE_PREFIX = 'electricity:';` · `interface SweepableStorage` · `clearAppKeys(storage: SweepableStorage, prefix = APP_STORAGE_PREFIX): string[]` · `restartUrl(loc: { pathname: string; search: string }): string` (→ `` `${loc.pathname}${loc.search}#/` ``) · `interface Forgetful { forget(): void }` · `async function resetApp(store: Forgetful): Promise<void>` |
| `engine/store.ts:47,115` | `Settings.deskShell: boolean` (default `false`); sanitised on load (`:318`). |
| `engine/store.ts:82` | `TransitionState.quiet?: boolean`. |
| `engine/store.ts:249` | `Store.forget(): void` (stop persisting). |
| `engine/volume.ts:56` | `VolumeIdentity.seamless?: boolean` (`volume.json`). |
| `engine/volume.ts:234,355` | `VolumeManifest.seamless: boolean` (`identity.seamless === true`). |
| `engine/volume.ts:374-379` | `floorLabel(volume: VolumeManifest, floor: AxisFloor, visited: Readonly<Record<string, readonly string[]>>, stepsOf?: (chapterId: string) => readonly string[] \| undefined): string` — the named form also once a later chapter of the journey (or, with `stepsOf`, a later step of the naming chapter) was opened. |
| `engine/runtime.ts:43,45,47` | `const SEAMLESS_FADE = 0.3;` `const LEAVE_MAX = 12;` `const INSET_HOLD = 0.8;` |
| `engine/runtime.ts:66` | `RuntimeEvents.transitionStart: { from: string \| null; to: string; direction: 1 \| -1; duration: number; seamless: boolean }` |
| `engine/runtime.ts:403-427` | On a load: `quiet = active volume === target volume && library.get(volumeId)?.seamless === true`; then `exit = out.hooks.leaveChapter?.({ volumeId, chapterId, stepId }) ?? null`; `this.border = exit !== null`; a throwing hook logs `[runtime] <id>: leaveChapter failed:`. Not waited for when `deps.deterministic()` (`?freeze`). |
| `engine/runtime.ts:428-474` | The incoming chapter is created (`mod.default.create(ctx)`), its step entered instantly and its programs compiled **while the outgoing chapter stays on screen**; the swap waits until `clock.time >= exitEnd` or the predicate holds (a throwing predicate counts as true). Both instances exist during that wait (≤ 12 s plus loading). |
| `engine/runtime.ts:512-534` | Swap is `seamless` only if previous and next are in one volume **and** `this.border` **and** the volume's `seamless === true`: duration `SEAMLESS_FADE`, `next.director.followDrift(previous.director)`, outgoing insets kept `INSET_HOLD` s, no `director.arrive(…)` zoom, `tr.simple = true`, chroma 0. Otherwise the old scale-zoom (`MOTION.transition.duration`). |
| `engine/runtime.ts:695-699` | `ctx.device` getter returns `layoutDevice(s.device, s.settings.deskShell)`. `director.reframe` now follows `hud.metrics.formFactor`. |

New tests: `engine/__tests__/camera-hold.test.ts`, `engine/__tests__/reset.test.ts`; changed `device.test.ts`,
`volumes.test.ts` (`expect(circuit.emptyNote).toBe('')`).

### 1.2 `app/src/hud` (20 files, +154 / −128)

| File | Change |
|---|---|
| `hud/where.ts:27,45` | New `setWhereBase(key: string, floor: string \| null): void`, `baseFloor(key: string): string \| null`. `axisChipText` (`:54-66`) now uses `whereFloor(key) ?? baseFloor(key)` and passes `stepsOf` to `floorLabel`. `whereFloor` unchanged. |
| `hud/path-end.ts` (new) | `export const pathEnd = { shown: false, back: null as (() => void) \| null, forward: null as (() => void) \| null };` re-exported from `@/hud` (`hud/index.ts:222`). |
| `hud/keys.ts:30-37` | ← / PageUp call `pathEnd.back()` first; → / PageDown call `pathEnd.forward()` first. |
| `hud/step-ui-types.ts:259-296` | `StepUiSpec.acting` **removed**. `StepUiSpec.honesty` kept but documented `Ignored — no honesty chips are shown (DECISIONS §60 x)`. `panel?: { hiddenUntil?: When; closingWhen?: When }` (`hiddenUntil` became optional; `closingWhen` new, DOM interface). |
| `hud/model/step.ts` | **Removed:** `HonestyModel`, `honestyFactor`, `honestyModel`. |
| `hud/dock-build.ts`, `hud/dock.ts`, `hud/step-panel.ts` | **Removed:** `honestyChips(...)`, `StepPanel.setBadges(...)`. |
| `hud/model/path-step.ts` | `PathStepModel`: **removed** `honesty`, `honestyOnAction`, `note`; `closing` gains `restart: string \| null` (`chapter.next ? null : (chapter.labels?.[0] ?? null)`). `PATH_LABELS`: **removed** `note: 'Чесно про картинку'`; **added** `map: 'Мапа подорожі'` (`:58`). |
| `hud/context.ts:26` | `OverlayName` gains `'reset'`. |
| `hud/overlays/settings.ts:125` | WebGL settings: button `settings-wipe` «Почати з нуля» → second press «Ще раз — скинути все» → `resetApp(store)`. |
| `hud/annotations.ts:125,157` | Callouts are hidden while `transition.phase !== 'idle' && transition.quiet === true` (the walk to a same-frame border); `layer.setScale(m.pxPerUnit)` per frame. |
| `hud/hints.ts`, `hud/shell.ts:154` | Loading pill waits 3 s on a `quiet` load; `transitionStart` with `seamless` does not hide the chrome. |

### 1.3 `app/src/hud-dom` (27 files, +874 / −197)

| File | Change |
|---|---|
| `hud-dom/step/badges.ts` | **Deleted** (`createBadges`). CSS `.badges`, `.chip.honesty`, `.path-honest`, `.path-note` removed. |
| `hud-dom/step/path-body.ts:88-125` | `closingPage(m, hud, back)`: new buttons `data-ui="path-closing-back"` («Повернутися: <step title>»), `data-ui="path-map"` («Мапа подорожі», only when `next` is null), `data-ui="path-restart"` (caption = `closing.restart`, goes to the volume's first step). `data-ui="path-next"` is `disabled` with `data-tip="Ця глава ще готується"` when the next chapter is not built (`:110-111`). Honesty block and `acting` removed; `PathBodyContext.goPage: (i: number, smooth?: boolean) => void`, new `closingWhen?: When`. |
| `hud-dom/step/step-panel.ts:139-169` | Writes `pathEnd.shown / back / forward`; `turnTo(i)` cross-fades (0.35 s out, 0.7 s in). |
| `hud-dom/step/navigator.ts:17,20,70-72` | `const NEXT = { step: 'Далі', chapter: 'Далі: наступний розділ' }`; `export const REVEAL = { delay: 0.12, fade: 0.5, slide: 0.55, rise: 14 }`; «prev» click = `pathEnd.back ? pathEnd.back() : void nav.prev()`, «next» click = `pathEnd.forward ? pathEnd.forward() : void nav.next()`; `DomNavigator.update(): void` new. |
| `hud-dom/step/nav-fit.ts` (new) | `export const SEG = { min: 22, max: 44 }`, `interface SegFit`, `fitSegment(f: SegFit): number`. |
| `hud-dom/step/nav-glide.ts` (new) | `GLIDE = { duration: 0.45, ease: MOTION.panel.ease }`, `LABEL_FADE = { out: 0.12, in: 0.15 }`, `interface NavGlide { shift(px, instant); label(text, instant) }`, `createNavGlide(hud, el, labelEl)`. |
| `hud-dom/step/header.ts` | `createDomHeader(hud: Hud, system: () => HTMLElement \| null)`; class `below` when the header would run under the system row. |
| `hud-dom/dock/controls/mark-layout.ts` (new) | `interface MarkBox { t; w }`, `interface MarkPlace { x; row: 0 \| 1 }`, `markAnchor(t, width)`, `layoutMarks(marks: readonly MarkBox[], width: number, gap: number): MarkPlace[]` — slider mark names never touch (shift inward, else second line). |
| `hud-dom/dock/controls/slider.ts` | Uses `layoutMarks` (ResizeObserver + rAF); drag bubble kept inside the control. |
| `hud-dom/dock/index.ts:82-83,117,149` | The dock fades away while no control is `visible` or while `pathEnd.shown`. |
| `hud-dom/overlays/reset.ts` (new) | `domReset(dom: DomHud): DomModal` — overlay `reset`: «Скинути весь поступ і налаштування? Усі томи почнуться спочатку.», buttons `data-ui="reset-cancel"` «Скасувати», `data-ui="reset-confirm"` «Скинути». |
| `hud-dom/chrome/system.ts:35,51` | New system-row buttons `sys-reset` «Почати з нуля», `sys-mobile` «Мобільна версія». |
| `hud-dom/touch/menu.ts:44,61` | Menu items `menu-desk` «Версія для комп'ютера» (first), `menu-reset` «Почати з нуля» (last). |
| `hud-dom/touch/index.ts:72,108` | Root class `kd-desk-forced`; the sheet rises to `full` on the text tab while `pathEnd.shown`. |
| `hud-dom/chrome/loading.ts:11` | `const QUIET_DELAY = 3;` |

New tests: `hud-dom/__tests__/nav-fit.test.ts`, `hud-dom/dock/controls/__tests__/mark-layout.test.ts`;
`hud-dom/__tests__/core.test.ts`: `expect(DEFAULT_HUD).toBe('dom')`.

### 1.4 `app/src/content`, `app/src/audio`, `app/scripts`, `app/src/ui3d`

- `content/types.ts:121-141` `PathStep`: **removed** `honesty?`, `honestyOnAction?`, `note?`.
- `content/types.ts:153` `PathChapter.labels?: readonly string[]` — «Підписи глави»; at the volume's end `[0]` is the
  closing card's «start over» caption.
- `audio/plugin.ts:49-50`: no whoosh when `transitionStart.seamless`.
- `app/scripts/font-coverage.mjs:60`: field list `'steps.*.more.*'` (was `'steps.*.{more,honesty}.*'`).
- `ui3d/anchors/layer.ts:96`: `AnnotationLayer.setScale(cssPxPerUnit: number): void`.

### 1.5 `tools/content` (4 files, +25 / −41) — changed checker rules

| File | Change |
|---|---|
| `path_format.py:20-21` | `SECTIONS` gains `'Підписи глави': 'labels'` (parsed at `:123-125` as all `«…»` spans → `ch['labels']`). |
| `path_format.py:24-28` | `FIELDS`: `'Позначки': '-honesty', 'Чесно': '-note'` — "«-» fields are accepted and dropped". `step.update({k: v … if not k.startswith('-')})` (`:170`). |
| `path_format.py` | **Deleted:** `FACTOR`, `HONESTY` regex (`^(?:спрощена модель\|не в масштабі\|сповільнено ×…\|прискорено ×…\|перебільшено\|станом на \d{4}\s?р\.)$`), `step['honesty']`, `step['honestyOnAction']`, error `«Чесно» is one paragraph`. |
| `path_check.py` | **Deleted:** error `unknown honesty mark «%s»`, warning `«Чесно» has %d sentences (one or two)`; `note` no longer in the on-screen units. |
| `path_export.py:122,151-152` | Export gains `labels`; runtime `path.labels` when present; `honesty`, `honestyOnAction`, `note` no longer exported. |
| `test_path_format.py:73-78` | Test: `Позначки` / `Чесно` parse without error and leave no key. |

Budgets are **unchanged**: `BUDGETS = dict(chapterSteps=(4, 8), prologueSteps=(4, 5), chapterTerms=6, stepTerms=2,
ideaWords=(25, 32), textWords=(80, 90), nowLines=3)` (`path_check.py:26-27`); override via `volume.json → path.budgets`.
`REQUIRED = ['idea', 'text', 'action', 'takeaway', 'goal', 'terms', 'more']` (`path_format.py:29`).

### 1.6 `tools/qa` (9 files, +1031 / −3)

| Tool | Purpose | Arguments (as written in the file header) |
|---|---|---|
| `volume-walk.mjs` (new, 320 lines) | Whole volume as a reader walks it: fresh browser, plain address `?noaudio`, real clock, «Далі» only; every frame sampled; each border crossed forward, back, forward; exit 1 on any finding. Output `<out>/<volume>-<W>x<H>/` frames + `walk.json`. | `node tools/qa/volume-walk.mjs circuit --port 5320 [--size 1280x720 \| --touch] [--out DIR] [--no-back] [--from wire/plastic --until battery] [--map]`; also `--base http://<host>:8080/`. Default volume `'circuit'`, default out `/srv/electricity/qa/volume-walk`. |
| `walk-parts.mjs` (new) | Sampler and analysis. | exports `installSampler(page)`, `shoot(page, name)`, `drain(page)`, `jumps(samples, lim = { pos: 0.12, deg: 1.2, lum: 6 })`, `lightCourse(samples, head = 8)`, `frameDiff(a, b)`. |
| `walk-map.mjs` (new) | `--map` mode: every stop of the «Мапа» overlay, then every stop of a step whose id is `map`. | export `mapWalk(io)` with `io: { page, volume, press, tapAt, wait, fail, save, log }`. |
| `next-chapter.mjs` (new) | Border = two presses of «Далі». | exports `closingCard(page, settle)`, `nextChapter(page, settle)` → `{ card, landed }`. |
| `sheet-tab.mjs` (new) | Pick «Опис» / «Керування» tab in a narrow window. | export `sheetTab(page, id, settle)`. |
| `desk-toggle.mjs` (new) | «Версія для комп'ютера» end to end with touch. | `node tools/qa/desk-toggle.mjs [--port 5298 \| --base URL] [--profiles pl,pp,ll] [--out DIR]`; hard-wired to route `circuit/prologue/click` (`:100`). |
| `reset-check.mjs` (new) | «Почати з нуля» end to end. | `node tools/qa/reset-check.mjs [--port 5295 \| --base URL] [--hud dom\|gl] [--touch] [--freeze] [--from circuit/wire] [--out DIR]`. |
| `lib.mjs:9-11` | Comment only: app default is `dom`; `--hud gl` runs the WebGL one. | — |
| `ui-check.mjs:27,35` | Output dir `ui-check-dom` by default; `let hud = 'dom'`. | — |

`volume-walk.mjs` internals that constrain a volume:
- `:26` `const GATES = { circuit: { 'prologue/click': 'switch' } };` — the only way the walk gets past a step with
  `nav.hiddenUntil`; otherwise it throws `«Далі» waits for the goal of <key> and the walk has no way to reach it`.
- `:28,30` `const DIFF = { mean: 6, block: 24 };` `const SEAM = 18;` — the outgoing chapter's last frame is compared with
  the incoming chapter's first and first-idle frames; a larger difference, a light excursion > 8, or a camera / light
  jump within 18 frames of the swap is a FAIL.
- `:124` every chapter's last step must show `[data-ui="path-closing"]` after the first «Далі», else
  `no closing card on <chapter>/<step>`.
- `:226` opens `` `${base}?noaudio` `` (no `?debug`); `:265` throws `left the volume at …` if the app is not in `<volume>`.
- `:308` `walked N of M steps` must match all steps of the non-dev built chapters.
- Uses `window.__app.position()`, `.listChapters(v)`, `.locate(n)`, `.errors()`, `.clearErrors()`,
  `window.__ui.overlay()`, `.close()`, `.mapNode(id)`, `.navHidden()`; selectors `home-start`, `map-go`, `nav-next`,
  `nav-prev`, `path-opening`, `path-closing`, `sys-map`, `map-overview`, `map-card`, `map-card-close`,
  `journey-stop:<id>`, `journey-card`.

Unchanged QA environment facts (`lib.mjs`): `--port` (default `$QA_PORT` or 5201), `--base`, `--size`, `--q`, `--out`
(default `/srv/electricity/qa/$QA_ID`), `--hud`; `QA_CHROME` (default `/usr/bin/google-chrome`), `QA_CHROME_ARGS`,
`QA_ALLOW_SOFTWARE` (`:160`). On this machine `/srv/electricity` does not exist; `/usr/bin/google-chrome` exists.

### 1.7 `docs/*.md`

| File | Change |
|---|---|
| `DECISIONS.md:438-459` | New §60 v, w, x, y, z (section 2). |
| `API_CHANGES.md:651-675` | New section `### F-circuit-seams (2026-11-17) — same-frame chapter borders` (section 2). |
| `ENGINE_API.md:133-135,234-237,842` | `leaveChapter` in §3, `camera.hold(shot?)` in §6, `floorLabel(…, stepsOf?)` in §24. |
| `ARCHITECTURE.md:182-186` | `volume-walk.mjs <volume> [--touch]` added to §5. |
| `UI_API.md` | §6 retitled `Honesty chips — superseded (DECISIONS §60 x)`; `honesty` removed from the `stepUi` example and from §14 "Do". |
| `VOLUMES.md:49,195-196` | "honesty chips" dropped from the Rules row; `axis.floors[]` wording; new row `seamless`. |
| `FX_API.md:163`, `LIBRARY.md:26` | Honesty wording marked superseded by §60 x. |

Docs that lag the code (verified): `UI_API.md:463` still says "default `gl` until the cut-over"; `API_CHANGES.md:586`
still lists the removed `StepUiSpec.acting?`; `pathEnd`, `panel.closingWhen`, `PathChapter.labels` / «Підписи глави»,
`Settings.deskShell`, `resetApp` are in no document under `docs/` (grep).

### 1.8 `app/src/volumes/_path`, `_dev`, `circuit`

- `_path`: generated JSON and both sandbox documents lost their `honesty` data / «Позначки» lines; test now asserts
  `expect(m).not.toHaveProperty('honesty')`.
- `_dev/chapters/_sandbox-circuit-stage`: new `battery-steps.ts`, larger `scene.ts` (circuit stage sandbox only).
- `circuit` (258 files: 221 added, 37 modified; +28 874 / −369), by directory:
  - `volume.json`: `"emptyNote"` removed, `"seamless": true` added. Journey unchanged (9 entries).
  - New chapters (each with `index.ts`/`scene.ts`/`steps/`/`parts/`/`qa/{helpers,interactions}.mjs`/`__tests__/`):
    `charge`, `battery`, `flow`, `resistance`, `lamp`, `drain`, `build`. Changed: `prologue`, `wire`. All nine journey
    chapters are now built.
  - `content/generated/`: 7 new `<id>.json` + `<id>.manifest.json`.
  - `shared/world/`: new `border.ts` (`ORDER`, `BORDERS`, `borderOf(here, there)`, `createBorders(here, d)` →
    `{ leave(to), arrive(id, from, opts?), update(dt) }`, `LEAVE_SECONDS = 2.4`, `SWITCH_DELAY = 0.5`, `HOLD = 0.5`),
    new `__tests__/dive.test.ts`; changed `away.ts`, `dive.ts`, `flight.ts`, `index.ts`, `window.ts`, `README.md`.
  - `shared/stage/` (23 files): battery internals (`battery-cell|grains|inside|layers|poles|react|section.ts`), bulb
    (`bulb-close|heat|print|thermal.ts`), `lamp-shots.ts`, `lamp-view.ts`, `loop-glow.ts`, tools.
  - `shared/copper/` (10 files): `hit-lens.ts`, `hits.ts`, `joule.ts`, `lean.ts`, `run.ts` + tests.
  - Docs: 7 new chapter documents, `PATH.md` (+ section «Де сценарії свідомо відступили від цього шляху»),
    `VISUAL.md` (borders, honesty marks removed), `COPY_STYLE.md` §5 («Чесно про картинку» removed).

---

## 2. New owner decisions in docs/DECISIONS.md and API_CHANGES.md

### DECISIONS.md §60 (new letters v–z; u existed before the merge)

| § | Verbatim (brief) | Consequence for a new path volume |
|---|---|---|
| 60 v (`:438`) | «тепер ти opus і можеш запускати тільки opus (high effort для важчих задач і medium для простіших)». "Supersedes §60 d … No Fable; agents that were spawned on Fable are not resumed". | Conflicts with design decision 17 (L116, L803), which copied §60 d. |
| 60 w (`:443`) | «на другому кроці перший рух слайдера на самому початку перескоком анімує початок. а має бути видно ще рух лупи і піднесення її до дроту». "No jump anywhere on the track." | Circuit-specific, but it extends §60 p: a slider that drives an animation scrubs it frame by frame (`SliderSpec.onInput`, `ControlPatch.current`). |
| 60 x (`:447`) | «прибирай надписи "спрощена модель", "не в масштабі" і блок "чесно про картинку". це все зайве». "The reader's step panel shows neither the honesty marks nor the «Чесно про картинку» note — in every volume, both interfaces. … (path format: the fields become optional, never required); their text is not moved into the main text. Earlier rules requiring them are superseded." | No «Позначки» / «Чесно» in radio chapter documents (accepted, silently dropped); no `stepUi … honesty`; design Part II §6 column «Позначка» has nothing to render. |
| 60 y (`:452`) | «додай кнопку в меню панель (зверху справа), котра скидатиме увесь кеш і я зможу проходити все з нуля». "every `electricity:` key is cleared and the app restarts at `#/` keeping URL flags." | The radio site gets `sys-reset` / `menu-reset` for free; storage prefix stays `electricity:`. |
| 60 z (`:456`) | «не треба додаткових адрес. я хочу відкривати : http://<host>:8080/ і бачити те, про що я тебе прохав». "`DEFAULT_HUD = 'dom'`, the plain address shows the DOM interface; `?hud=gl` keeps working until phase C (deletion)". | DOM-only features (`floorLadder`, `journeyInset` plot, `panel.hiddenUntil`, `panel.closingWhen`, `SliderSpec.onInput`, path panel) are what the site shows; QA runs DOM unless `--hud gl`. |
| 60 u (`:434`, pre-existing) | "**Everyday units in `circuit` (orchestrator's reading, 2026-11-16, to be confirmed by the owner)** … Ukrainian unit signs (мм, см, м, с, хв, год) in captions and spelled out in running text; electrical units stay international as §54 f says (V, A, Ω, W). Volume 1 is not changed." | Scoped to `circuit` and not yet confirmed; the design's "як у `circuit`" (L839) rests on it. |

### API_CHANGES.md `### F-circuit-seams (2026-11-17) — same-frame chapter borders` (`:651-675`)

| Entry (verbatim, brief) | Consequence |
|---|---|
| "`SceneHooks.leaveChapter?(to): number \| (() => boolean)` — the outgoing chapter walks to its border frame while the next one loads; the runtime swaps once it is there (≤ 12 s); a navigation back meanwhile re-enters the step on screen. Not waited for under `?freeze`." | Optional per chapter; without it every chapter change is the platform zoom. |
| "`volume.json → seamless` / `VolumeManifest.seamless` — a chapter change inside the volume is a 0.3 s plain cross-fade (no zoom, no chromatic aberration)" | Needs `"seamless": true` **and** a non-null `leaveChapter` result for that border. |
| "Camera director: the idle drift amplitude eases toward the shot's (rate 5/s) … Affects every chapter by ≤ 0.6 s of fading" | Screenshots taken right after a shot change show a fading drift. |
| "`floorLabel(volume, floor, visited, stepsOf?)`" | Only matters for floors with `plain` / `namedAt`. |
| "`@/hud/where`: `setWhereBase(key, floor)`, `baseFloor(key)` — the floor a composed world is on; the header's chip text falls back to it (not the chapter's own floor) when no ladder report stands" | A shared world may report the floor id for the header chip. |
| "`TransitionState.quiet` — … the DOM loading pill waits 3 s … instead of 0.25 s" | — |
| "`drain`/`build` (circuit): `StepModule.finish?()` / `rewind?(play)` in `drain`" | These are members of circuit's own `interface StepModule` (`app/src/volumes/circuit/chapters/drain/chapter.ts:44-47`), **not** platform API. |
| "`RuntimeEvents.transitionStart` gains `seamless: boolean`" | — |
| "`SceneHooks.leaveChapter` may return `null`: no shared border with `to` (a jump across the map) — the runtime then plays the platform's own transition (the zoom)" | Map jumps between non-neighbours keep the zoom. |

---

## 3. Design statements now stale

"Pre-existing" = true before the merge too, found while checking the design against the code.

| Design line(s) | What it says | What the code now does | Smallest correction |
|---|---|---|---|
| L131-133 (I §4.2) | «Позначки чесності: «спрощена модель», «не в масштабі», «сповільнено ×N», «прискорено ×N», «перебільшено», «станом на РРРР р.». Це перевіряють `tools/content/path_check.py` і `doccheck.py`.» | `HONESTY` regex and the `unknown honesty mark` error are deleted; `'Позначки': '-honesty', 'Чесно': '-note'` are accepted and dropped (`path_format.py:27-28,170`). DECISIONS §60 x. | Replace with: «Позначок чесності в панелі немає (DECISIONS §60 x); поля «Позначки» й «Чесно» інструмент приймає і відкидає.» |
| L89 (I §3) | «Спрощення дозволені лише з чесною позначкою (частина II, §6).» | No mark is rendered in either interface; `StepUiSpec.honesty` is ignored (`step-ui-types.ts:261-262`). | Owner's wording needed for where the honest sentence lives (text, «Докладніше», scene caption). |
| L466-498 (II §6), column «Позначка й що кажемо чесно»; quoted marks at L471-479, 485-486, 489, 493, 496-498 | Each simplification carries a named mark. | `PathStep` has no `honesty` / `note` (`content/types.ts:121-141`); the DOM path body has no honesty block (`path-body.ts`). | Rename the column to «Що кажемо чесно і де»; drop the quoted mark names. |
| L478, L678-679, L739 (III §5 row «Позначка чесності для обчисленого екрана») | Under the screen a constant scene caption «картинку обчислено · зменшено»; on the step the mark «спрощена модель»; "перелік позначок в інструментах фіксований". | There is no list of marks in the tools any more; the step mark has no effect. A scene caption is still possible, but step captions reach the checker only through the field «Підписи» (`path_format.py:176-185` → `step['labels']`). | Delete the step-mark half; keep the caption as a scene caption pending the owner's word (he called such labels «зайве»). |
| L474, L493, L498 («сповільнено ×10⁸», «сповільнено ×N», "лупа часу") | Slowed displays carry a ×N mark. | No chip exists. Circuit replaced them with true-time sliders (`docs/volumes/circuit/VISUAL.md`: «жодного «сповільнено», жодного ×N; DECISIONS §60 p, w»). | Say the rate in the control's own label or caption. |
| L394 (`sat-digital/code`) | «(позначка «спрощена модель»: у моделі один довгий код)» | Same as above (batch 9). | Move to «Докладніше». |
| L116, L803 (decision 17) | «Fable 5.2 — планування, моделі сигналу, візуальна мова; Opus 5.5 — код глав, тести, перевірки.» | DECISIONS §60 v (`:438-442`): Opus only, effort high / medium, "No Fable". | Owner's call: which rule binds this copy. |
| L597-600 (III §1) | «На 17.11.2026 у томі `circuit` збудовано тільки пролог і `wire`, тож посилання на `circuit/charge`, `circuit/battery` і `circuit/flow` чекають» | `app/src/volumes/circuit/chapters/` has `battery build charge drain flow lamp prologue resistance wire`; `engine/__tests__/volumes.test.ts:101-102` "all nine chapters are built". | «У `upstream` збудовано всі дев'ять глав; кнопки чекають лише на публікацію сайту основного курсу.» |
| L650-651 (III §2) | «…документи й дві збудовані глави `circuit`…» | Nine built chapters plus `shared/world/border.ts`. | «дев'ять збудованих глав». |
| L631-639 (III §2 «Гілки в навігації») | «кнопка «далі» з її останнього кроку веде в першу дитину»; «кінцева картка гілки не вміє повернути до батьківської глави»; change expected from `upstream`. | Engine order unchanged: `Registry` visits children right after the parent (`registry.ts:66-79`), `next()` = `linear[i + 1]` (`:123-126`). The decision-25 change is **not** in this merge. New: «Далі» on a chapter's last step first shows the closing card (`navigator.ts:72`, `path-end.ts`); the card's own button `path-next` goes to `chapter.next` (`path_export.py:51-57`, branch-layer entries skipped) and is disabled when that chapter is not built (`path-body.ts:110-111`); the navigator's «Далі: наступний розділ» follows registry order. A chapter whose `next` is null (every branch, and the last non-branch chapter) shows «Кінець шляху» plus the new button «Мапа подорожі» (`path-body.ts:95-96`). | Add: «з кінцевої картки гілки є кнопка «Мапа подорожі»; «далі» тепер двоступеневе: спершу кінцева картка». |
| L201, L759, L853-854 («де ми», "а не «драбина поверхів» рушія") | Own miniature with a depth mark (подвір'я · стенд · під лупою). | Still holds: `floorLadder(ctx, { floor })` lists `volume.json → axis.floors` (`hud-dom/journey/ladder.ts:25-27`) — for radio those are the seven ruler marks. New `setWhereBase(key, floor)` / `baseFloor(key)` feed only the header's axis chip (`hud/where.ts:27,45,61`) and take floor ids of `axis.floors`. | None required. |
| L201 («заставки глав»), L745 («Один світ на весь том») | Chapter-to-chapter transition is not specified. | Default between chapters: scale-zoom with chromatic aberration and whoosh. The 0.3 s cross-fade needs `"seamless": true` and the outgoing chapter's `leaveChapter` returning non-null (`runtime.ts:415-421,512-516`); the incoming chapter must itself start on that frame (circuit: `border.arrive`). | One sentence in III §2 (`volume.json`) and §6: whether radio is `seamless` and what the border frame is. |
| L772-776 (III §7 item 5) | «Інструменти це вже вміють (`--base`, `--out`, `QA_ALLOW_SOFTWARE=1`)» | Still true (`lib.mjs:5,8,160`). New: pages open the DOM interface by default; the new tools default `--out` to `/srv/electricity/qa/…` (absent here); `volume-walk.mjs:226` opens `` `${base}?noaudio` `` without `?debug`, so for a draft volume it can only run against the site-profile build (which is what item 5 already prescribes). | Add `--out` to every new-tool command. |
| L552-556 (III §1: `tools/qa` is not edited) with L772-779 | Checks use the existing `tools/qa`. | `volume-walk.mjs:26` hard-codes `GATES` for `circuit` only; a radio step with `nav.hiddenUntil` stops the walk unless that table is edited. `desk-toggle.mjs:100` is hard-wired to `circuit/prologue/click`; `reset-check.mjs` defaults to `--from circuit/wire`. | State that `volume-walk` is used only if no radio step holds the navigator back, or that the walk gets a volume-side wrapper built on `walk-parts.mjs`. |
| L248 (`prologue/map`), L201, L736 (map = drawing in the scene, `radio/shared/map`) | The prologue's map step is a scene drawing with two tracks. | `walk-map.mjs:71-97` picks the first step whose id is `map` and requires `[data-ui="journey-stop:<chapter>"]` for every built chapter and a `[data-ui="journey-card"]` containing its title — elements of `journeyInset` (UI_API §11a). | Either the step also mounts `journeyInset(ctx, { onOpen })`, or `--map` is not among radio's checks. |
| L517 (II §8.2), L428 | «містка практикум у форматі не має, тож питання глави 13 ставить заключний текст `build-analog/evening`» | A practicum only *requires* «Кроки» (`path_check.py:83-84`), but the parser accepts «Що ми тепер знаємо», «Місток», «Підписи глави» in any chapter (`path_format.py:20-21`); circuit's `build.md` has «Що ми тепер знаємо» (4 lines) and «Підписи глави» («Почати з початку»). A chapter with neither `now` nor `bridge` has no closing card (`hud/model/path-step.ts:91-99`) and `volume-walk` then fails (`:124`). | «Практикум може мати «Що ми тепер знаємо» й «Місток» (перевірка містка для практикуму не діє).» |
| L205 («Радіозір» off by default on a phone), L723-726, L517 (fewer model frames on a phone) | Phone-specific defaults. | `ctx.device.formFactor` reads `desktop` on a phone or tablet under «Версія для комп'ютера» (`runtime.ts:695-699`, `hud.ts:93`); pixel budget and quality tier stay the phone's. | Key cost decisions on `ctx.quality`, not on `ctx.device.formFactor`. |
| L129-130 (budgets) | «Думка кроку — 25–32 слова, текст — 80–90 слів.» | Unchanged by the merge. Exact rule: idea is one sentence, > 32 words error, > 25 warning; text > 90 error, > 80 warning (`path_check.py:105-113`). | Optional: «не більш як 32 / 90 (попередження з 25 / 80)». |
| L450, L838-839 (units) and 16 uses of `µ` (L273, 274, 276, 355, 381, 437, 450, 507, 511, 512, 677, 839) | «µs»; "як у `circuit`". | Pre-existing: DECISIONS §32 "Greek mu `μ` (U+03BC) … never the legacy micro sign `µ` (U+00B5)" (`typography.py` rule 2). §60 u is circuit-scoped and unconfirmed. `dBm`, `nW`, `bit/s`, `Mbit/s` are not in `terms_check.UNITS` (`terms_check.py:114-117`) and are reported by `path_check.check_latin` as `Latin word «…» is not in the allowlist (§54)`; `V/m`, `MHz`, `GHz`, `kHz`, `mW`, `dB`, `ns`, `μs` pass. | `µ` → `μ`; add `dBm`, `nW`, `bit/s`, `Mbit/s` to the allowlist list at L654-655. |
| L641-645 (III §2 «Терміни гілок у реєстрі») | «том додає власну перевірку (рушій дозволяє додаткові перевірки у `volume.json`)» | Pre-existing: `volume.json → docs.checks` is read only by the classic `main()` (`doccheck.py:235-236`); `main_path()` (`:251-269`) runs `path_check`, typography, index, glossary, export, runtime, fonts and never reads `docs.checks`. | The volume's own check is a separate command (not part of `regen.sh`). |

Notes to the rows (facts the design does not state, relevant to batches 1-3):

- **Pilot with only `prologue` and `lines` built.** `next_chapter()` takes the next non-branch entry of the *planned*
  journey (`path_export.py:53`), so the prologue's closing card offers `field`: its button `path-next` reads
  «Далі: Як гребінець тягне шерстинку, не торкаючись?» and is disabled with the tip «Ця глава ще готується», and
  `path_check` demands that the prologue's «Місток» ends with that question (`path_check.py:139-141`, error
  `the bridge does not end with the next question «…»`). The navigator's «Далі: наступний розділ» goes by the registry
  of built chapters, i.e. to `lines`. Likewise `lines`' «Місток» must end with `carrier`'s question.
- **Register before documents.** A register term whose chapter has no document yet sits at that chapter's first step
  (`path_check.py:53-61,154-157`), so the full `_terms.md` can exist from batch 1 without errors.
- **Two chapter instances at a border.** Anything a chapter's scene factory starts (a Web Worker, a render target)
  exists twice while the outgoing chapter walks to its border (`runtime.ts:428-474`); only the active instance's
  `update` runs (`runtime.ts:294-299`).

---

## 4. Opportunities

| New platform part | Exact names | What in the design it makes cheaper |
|---|---|---|
| Whole-volume walk | `node tools/qa/volume-walk.mjs <volume> --base <url> --out <dir> [--touch] [--no-back] [--from chapter/step --until chapter] [--map]`; `walk-parts.mjs` exports (section 1.6) | III §7 items 4-5: one command walks every step, crosses every border three ways and collects console errors per step — provided the constraints in section 1.6 hold. |
| Border helpers for chapter QA | `closingCard(page, settle)`, `nextChapter(page, settle)` (`tools/qa/next-chapter.mjs`); `sheetTab(page, id, settle)` (`tools/qa/sheet-tab.mjs`) | Per-chapter interaction tests (circuit's `chapters/<id>/qa/interactions.mjs` import them). |
| Same-frame borders | `volume.json → "seamless": true`; `SceneHooks.leaveChapter(to)`; reference implementation `app/src/volumes/circuit/shared/world/border.ts` (`createBorders`, `borderOf`, `BORDERS`, `LEAVE_SECONDS`, `HOLD`) and its use in `circuit/chapters/wire/scene.ts:42-109` | "Один світ на весь том" (L745) with the yard as the shared frame. |
| Header floor fallback | `setWhereBase(key, floor)`, `baseFloor(key)` from `@/hud/where` (used at `circuit/shared/world/index.ts:168,321`) | The header chip can name the station the camera is at rather than the chapter's own floor. |
| Scene-timed camera | `ctx.camera.hold(shot?)` (`director.ts:316`; used at `circuit/chapters/prologue/steps/unfold.ts:55`) | Stand unfolding ("камера розкладається на стенд", L271, L293) and flights along the picture's road without `go(…, { instant: true })`. |
| Closing card control | `StepUiSpec.panel.closingWhen?: When`; `pathEnd.shown / back / forward` from `@/hud`; example `circuit/chapters/build/steps/04-flashlight.ts:52-86` | Final frames (`build-analog/evening`, `raster/answer`): the card comes when the last motion rests; the dock fades by itself. |
| Volume's end | Section «Підписи глави» → `PathChapter.labels`; `data-ui="path-map"`, `data-ui="path-restart"`; `PATH_LABELS.map` | The end of the journey (`build-digital/home`) and every branch's end get «Мапа подорожі» without volume code. |
| Slider mark names | `SliderSpec.marks?: readonly { value: number; label: string }[]` now laid out by `layoutMarks` | Route slider with five named stops (L203) and the transmitter-power slider with marks 10 / 1 / 0,1 (L203). |
| Self-hiding dock | `hud-dom/dock/index.ts:83` `anyShown()` | Steps whose controls appear only at some state. |
| Fresh-reader runs | `sys-reset` / `menu-reset` / `reset-confirm`; `resetApp(store)`; `tools/qa/reset-check.mjs` | Owner's review of the pilot from zero. |
| Narrow windows and phones | `fitSegment`, `createNavGlide`; `Settings.deskShell`, `menu-desk`, `sys-mobile` | 8-step chapters fit the step bar; the owner can view the desktop layout on a phone. |
| Deep-link floor names | `floorLabel(volume, floor, visited, stepsOf?)` | Only if radio's ruler uses `plain` / `namedAt`. |
| Worked example of a composed world | `app/src/volumes/circuit/shared/world/` (`mountWorld(ctx)`, `world.define`, `world.enterStep`, `world.update`, `world.scrub(t)`, `world.travelTo(t, seconds?)`, lens window as a stencil portal in `window.ts`) and its `README.md` | Pattern for `radio/shared` (L743-762) and for the probe window "як лупа в `circuit`" (L207); not importable (volume boundary). |
| Sandbox home | `app/src/volumes/_dev/chapters/_sandbox-circuit-*` (volume `_dev`, `"status": "dev"`, `"listed": false`) | Where circuit keeps its sandboxes (design Part IV §1, "де живе пісочниця"). |

---

## 5. Still missing

Absent from this copy (checked with `ls docs` and `os.path.exists` over every `docs/…` and `tools/…` path named in
`docs/`, `tools/`, `app/src/{engine,hud,hud-dom,content,audio}`, `app/scripts`, circuit `shared/`). The merge added none
of the documents of design decision 26.

| Missing | Referenced from (examples; count = references found) |
|---|---|
| `docs/PATH_FORMAT.md` (35) | `tools/content/path_format.py:2`, `path_check.py:3`, `path_export.py:2`, `chapters.py:71,132`, `doccheck.py:253`; `docs/VOLUMES.md:184`, `docs/API_CHANGES.md:520`; `app/src/content/types.ts:108,117,237`, `app/src/engine/volume.ts:50`, `app/src/hud/path-end.ts:2`, `app/src/hud/step-ui-types.ts:271`, `app/src/hud-dom/step/path-body.ts:2`; `docs/volumes/circuit/COPY_STYLE.md:4`, `docs/volumes/circuit/chapters/_terms.md:3` |
| `docs/VOLUME_STRUCTURE.md` (7) | `tools/content/path_check.py:2`, `docs/DECISIONS.md:328,398`, `docs/VOLUMES.md:191`, `app/src/engine/volume.ts:65,102`, `docs/volumes/circuit/VOLUME.md:6`, `docs/volumes/circuit/PATH.md:5` |
| `docs/HUD_DOM.md` (57) | `docs/DECISIONS.md:279,296`, `docs/UI_API.md:318,462,484`, `docs/API_CHANGES.md:420,449,470,…`, `tools/qa/lib.mjs:10,101,164`, `tools/qa/chapter-check.mjs:81`, `app/src/engine/app.ts:42`, `app/src/hud/shell.ts:183,253` |
| `docs/MOBILE.md` (29) | `docs/ARCHITECTURE.md:18`, `docs/ENGINE_API.md:796,837`, `docs/UI_API.md:535`, `docs/API_CHANGES.md:340,379,385`, `tools/qa/chapter-check.mjs:44,336`, `tools/qa/mobile-check.mjs:2`, `app/src/engine/app.ts:38,366`, `app/src/hud/step-ui-types.ts:216` |
| `AGENT_GUIDE` (no file of that name anywhere) | `docs/VOLUMES.md:45,49` |
| `PLAN` (`PLAN §…`; no `PLAN.md`) | `docs/DECISIONS.md:260`, `docs/VOLUMES.md:102`, `tools/qa/chapter-check.mjs:2` |
| `ORCHESTRATOR §7` | `docs/DECISIONS.md:378` |
| `docs/briefs/` (dir) and `docs/briefs/L-simple-level.md` (14), `docs/briefs/D5-dom-overlays.md` | `docs/VOLUMES.md:45`, `docs/DECISIONS.md:299`, `docs/UI_API.md:86`, `docs/CONTENT_EXPORT.md:87`, `tools/content/doccheck.py:21`, `export_runtime.py:23,241`, `simple_check.py:2`, `terms_check.py:75`, `app/src/content/level.ts:2`, `app/src/hud/model/glossary-search.ts:3` |
| `docs/requests/` (dir) and `B-circuit-charge.md`, `B-circuit-prologue.md`, `B-circuit-wire.md`, `C-circuit-2.md`, `-3.md`, `-4.md`, `W1-circuit-stage.md`, `W2-circuit-copper.md`, `F5-mobile.md`, `D3-dom-dock.md`, `C7-hotspot-ids.md` | `docs/ARCHITECTURE.md:97`, `docs/API_CHANGES.md:416,660`, `docs/FX_API.md:423`, `app/src/engine/camera/director.ts:242`, `app/src/volumes/circuit/shared/world/README.md:70`, `docs/volumes/circuit/PATH.md:317` |
| `docs/reports/` (`F1-core.md`, `F3-fx.md`, `F5-mobile.md`, `M4-volumes.md`, `C7-hotspot-ids.md`, `W1-circuit-stage.md`, `W2-circuit-copper.md`) | `docs/ENGINE_API.md:336`, `docs/FX_API.md:6`, `docs/API_CHANGES.md:342,418`, `docs/DECISIONS.md:235`, `app/src/engine/device.ts:68` |
| `docs/ideas/encyclopedia-structure.md` | `docs/DECISIONS.md:329` |
| `tools/deploy.sh` | `docs/ARCHITECTURE.md:193` |
| `/srv/electricity/qa/` (default QA output root; not on this machine) | `tools/qa/lib.mjs:8,81`, `volume-walk.mjs:37`, `desk-toggle.mjs`, `reset-check.mjs` |
| Design-only paths not created yet | `app/src/volumes/radio/`, `tools/site/`, `tools/ref-models/radio/`, `.github/workflows/pages.yml`, `docs/volumes/radio/plan48/` (`docs/volumes/radio/` holds only `CURRICULUM.md`, `NOTES.md`, `VOLUME.md`) |

Also not in this merge: the platform change of design decision 25 (branch navigation).
