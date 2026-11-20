# Recon E3 — chapter QA and acceptance (map)

Read-only recon, 2026-11-20, tree at `2707887` + uncommitted E1 sim work. Paths are repo-relative; `L` = line.
Scope: `tools/qa/**`, `tools/site/{build,smoke}.mjs` + README, `.github/workflows/pages.yml`, `docs/ENGINE_API.md`
§16–18/§21, circuit `chapters/build/qa/*.mjs`, `_dev/chapters/_sandbox-radio-link/qa/measure.mjs`, the engine/HUD QA
hooks those tools call. `tools/qa/**` is **not editable** for this volume (global-constraints L41): electronics adds
its own QA scripts under `app/src/volumes/electronics/chapters/<id>/qa/` (and the bench sandbox's under `_dev`).

## 0. Verdicts in one screen

| Question | Answer |
|---|---|
| The acceptance check of a chapter | `node tools/qa/chapter-check.mjs electronics/<id> …` — exit 0 and last line `PASS electronics/<id> — report: <out>/electronics-<id>/report.json` |
| Goal reached by a script | No generic tool. Each chapter writes `qa/interactions.mjs` (+ `qa/helpers.mjs`) driving goals with real pointer input on `__app.locate(<probe>)` / `__ui.locate('ctl-<id>')`, or programmatically with `__ui.press(id)` / `__ui.set(id, v, true)`; proof = `[data-ui="path-takeaway"]` shown + numbers from `__app.read(<reader>)` |
| Screenshots for a reviewer | chapter-check writes per-step deep-link JPGs + contact sheets (`sheet-<W>x<H>.jpg`, `sheet-random.jpg`); goal states come from the chapter's interaction script `--out` snaps (+ `tools/qa/sheet.sh`); single states via `tools/qa/shot.mjs --eval/--script` |
| Site smoke and chapters | Once ≥ 1 electronics chapter is built, smoke stops checking the lobby (`home-empty` + `emptyNote`) and instead requires `home-start`/`home-resume` and a deep link `#/electronics/<first built chapter>/<its first step>` that lands exactly; no console **error** anywhere; every request < 400 and under the sub-path |
| Machine | GPU works now (`nvidia-smi`: RTX 5070, 580.178.04); no ImageMagick (shims), no tmux, no `/srv/electricity`, no Playwright Firefox/WebKit; port 5392 was busy at recon time |

## 1. Environment preamble (this machine)

- `source tools/site/qa-env.sh` (`tools/site/qa-env.sh` L12-27): Node 24 via nvm, `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`,
  **`QA_ALLOW_SOFTWARE=1`** (L23, unconditional), `QA_OUT=${QA_OUT:-~/.cache/radio-pop-science/qa}` (L24, created),
  `tools/site/shims` first on `PATH` when `montage` is missing (L27: `montage`, `identify`, `mogrify` on Pillow).
  Functions `site_serve [port=5391] [dir=tools/site/dist]` (L31-53; serves via `smoke.mjs --serve`, **always under
  `/radio-pop-science/`**, prints `http://127.0.0.1:<port>/radio-pop-science/` on 200 within 10 s; busy port or no
  `index.html` → rc 1) and `site_stop [port]` (L77-95; kills only listeners owned by this repo/worktrees).
- Chrome: `/usr/bin/google-chrome` (`QA_CHROME` overrides). `tools/qa/lib.mjs` `GPU_ARGS` L27-35
  (`--use-angle=vulkan --enable-gpu --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --force-color-profile=srgb
  --autoplay-policy=no-user-gesture-required`); `QA_CHROME_ARGS` replaces them (L134). Software comparison:
  `VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.json` (global-constraints L70-71).
- `openApp` asserts `/nvidia/i` in the WebGL renderer **unless** `QA_ALLOW_SOFTWARE` is set (lib.mjs L160-162).
- No `tools/dev-start.sh` here (needs tmux and `/srv/electricity/wt`). Serve either the site profile
  (`site_serve`) or the full tree from `app/` in the background: `pnpm build && pnpm preview --port <p> --strictPort`
  or `pnpm dev --port <p> --strictPort` (`app/package.json` L8-10). Pick a free port: `ss -ltnH "sport = :<p>"`.
- Long runs go to the background and one at a time (radio PATH-NOTES L309-310: chapter-check ≈ 30 s per 4 steps with
  `--skip perf` under software, mobile-check ≈ 67 s per profile, an interaction script up to 2.5 min; two software
  runs at once can time out). Foreground `sleep` is forbidden.

## 2. `tools/qa/lib.mjs` — plumbing every tool and chapter script imports

| Export | Signature / behaviour | Line |
|---|---|---|
| `parseArgs(argv)` | `{ _: [...positional], key: value }`; `--flag` with no value (or followed by `--x`) → `true`; `--hud` must be `dom`/`gl` (else exit 2) and is exported to `QA_HUD` for child tools | L37-60 |
| `baseUrl(args)` | `--base <url>` (slash appended) else `http://localhost:${--port ?? $QA_PORT ?? 5201}/` | L70-73 |
| `parseSize(v, fallback=[1920,1080])` | `"WxH"` → `[w,h]`; anything else → fallback (silently) | L75-78 |
| `outRoot(args)` | `--out` else `/srv/electricity/qa/${QA_ID ?? 'misc'}` (does not exist here → always pass `--out`) | L80-82 |
| `appUrl(base, { route, q='high', freeze=null, extra={} })` | `?debug&overlay=0&noaudio&q=<q>[&hud=…][&<extra>][&freeze=N]#/<route>`; `q:'auto'` drops `q` | L100-108 |
| `pickChapter(chapters, volumes, ref)` | exact `fullId`, else short id ranked **legacy (electricity) → default (circuit) → others** | L115-123 |
| `launch({ width, height, dpr=1, uncapped, touch })` | headless Chrome → `{ browser, context, page, requests, pageErrors }` | L132-149 |
| `openApp(page, url, { timeout=60000 })` | goto (load) → wait `window.__app` → `await __app.ready` → GPU assert → `gpu.hud` → under `dom` waits `document.fonts.ready`; returns `__app.gpu()` + `hud` | L155-171 |
| `appErrors(page)` | `__app.errors()` → `[{ level: 'error'|'warn', message, time }]` | L179-181 |
| `thirdPartyRequests(requests, base)` | URLs whose origin ≠ base origin (data:/blob:/about: ignored) | L184-194 |
| `screenshot(page, file, quality=90)` | JPEG, creates parent dir, returns file | L196-199 |
| `hueFamilies(png, minShare=0.08)` | every 3rd px; coloured = value ≥ 0.3 and saturation ≥ 0.35; six 60° families (red/yellow/green/cyan/blue/magenta, centred on 0/60/…); family counts if ≥ 8 % of coloured px → `{ families, shares, coloured }` | L222-245 |
| `decodePng(buf)`, `playwright`, `ensureDir`, `ensureParent`, `fmt(n, d=2)`, `findChapter(page, ref)`, `hudMode(page)` | helpers | L84-92, L126-129, L174-176, L201-212 |

## 3. `tools/qa/chapter-check.mjs` — the acceptance check (349 lines)

### 3.1 Command grammar (L4-49, parsing L72-108)

```
node tools/qa/chapter-check.mjs <volume/chapter | chapter> [--size WxH=1920x1080] [--also-size WxH]
     [--sizes all | WxH,WxH…] [--q high] [--freeze 3] [--out DIR] [--port N | --base URL] [--other <chapter>]
     [--budget 8] [--budget-4k 14] [--fail-4k 16.6] [--no-perf-fail] [--dpr2] [--skip perf,leaks,random,layout,dpr2]
     [--perf-rounds 3] [--perf-frames 90 (min 30)] [--min-text 16] [--sdf-max-mag 4] [--max-hues 4]
     [--hud dom|gl] [--zoom 1] [--mobile [all|pp,pa,pl,tp,tl]]
```

- `--sizes all` = `[[1920,1080],[1280,720],[3840,2160]]` (L79); the first size is the "primary" (stats, hues, perf,
  leaks run there). Default sizes = `--size` (+ `--also-size`).
- `--max-hues` is parsed (L96) but **not listed** in the header help.
- DPR-2 pass runs with `--sizes all` or `--dpr2`, never with `--zoom > 1`, unless `--skip dpr2` (L103).
- `EXTRA_LAYOUT` (L105): 1280×720 and 1920×1080 (÷ zoom) are always layout-checked by resizing if not in the list.
- Output dir (L108): `<out>/<argument with / → ->[-zoom<z>]` — named from the **argument as typed**, before it is
  resolved (`prologue` → `<out>/prologue` even though it resolves to `circuit/prologue`).
- Unknown chapter → `check aborted: chapter '<x>' is not registered (known: …)` (L166).

### 3.2 Gates, in run order

Fail = `failures.push` → exit 1. Warn/note never fail (L40-41).

| # | Pass / gate | What it measures | Threshold → verdict | Line |
|---|---|---|---|---|
| 0 | boot | console after first load | any `error` **or `warn`** → FAIL `boot: console …` | L162-171, `checkErrors` L128-132 |
| 1 | deep link (per size, per step) | fresh full page load `#/<chapter>/<step>` with `?…&freeze=3&n=<i>` | landed `volume/chapter` + `stepId` ≠ requested → FAIL | L172-179 |
| 1a | screenshot | `<outDir>/NN-<step>-<W>x<H>.jpg` | — | L180-181 |
| 1b | draw calls (primary size) | `__app.stats().drawCalls` | > **350** → FAIL | L183-185 |
| 1c | triangles (primary) | `stats().triangles` | > **1 500 000** → FAIL | L186 |
| 1d | colour discipline (primary) | `hueFamilies(png screenshot)` | families > `--max-hues` (**4**) → FAIL | L187-191 |
| 1e | layout (every size) | `layoutAt` (§3.3) | see §3.3 | L192-193, L144-155 |
| 1f | DPR-1 snapshot | `uiSnapshot` at 1920×1080 for the DPR-2 compare | — | L194 |
| 1g | console | per step | any error/warn → FAIL `deep link <step>: console …` | L195 |
| 1h | contact sheet | `sheet.sh <outDir>/sheet-<W>x<H>.jpg --cols min(3,n) --tile 640 --title …` | sheet tool failure → **FAIL** `contact sheet failed` | L197, L133-139 |
| 2 | sequential | `freeze=2`; `__app.goto(chapter, s)` forward through all steps then back | position ≠ target → FAIL; console | L202-209 |
| 3 | random + spam (`--skip random`) | LCG seed 12345, `2×steps` random targets (+ any never drawn); before each, 3 un-awaited `engine.nav.goto` to random steps, then the awaited real target | final step ≠ target → FAIL; first entry of each step shot `random-NN-<step>.jpg` → `sheet-random.jpg` | L212-236 |
| 4 | perf (`--skip perf`) | real clock (no freeze); `measurePerf`: `--perf-rounds` interleaved passes, each step `goto({instant:true})`, wait 700 ms (round 1) / 300 ms, `__app.measure(frames)`; best = min `frameAvg` (= `cpuAvg + gpuAvg` from timer queries, not vsync-bound) | best > **8 ms** → FAIL (warn only with `--no-perf-fail`) | L239-262; `check-parts.mjs` L65-77 |
| 4a | perf confirmation | steps over the warn limit get up to **3** extra samples **4 s** apart | reported after confirmation | `check-parts.mjs` L84-100 |
| 4b | perf 4K (only if 3840×2160 in sizes) | same at 4K | > **14** warn, > **16.6** FAIL | L260, L101-102 |
| 5 | leaks (`--skip leaks`) | `freeze=1`; other chapter = `--other`, else another chapter of the same volume, else any; 3× `goto(other)` → `goto(chapter, step0)` | `geometries`/`textures`/`programs` at return 3 > return 1 → FAIL (`tweens` recorded, not compared) | L265-293 |
| 5a | leaks, no other chapter | — | **skipped with a log line, no fail** | L271-272 |
| 6 | DPR 2 | new browser 1920×1080 @2, every step deep-linked (`&dpr=2`); `uiSnapshot` vs DPR 1 | any HUD node box (x,y,w,h) or probe (x,y) off by > **2 CSS px**, a node/probe present at one DPR only, or small-target list differs → FAIL (≤ 4 per step); layout + console again; `dpr2-<step0>.jpg` | L296-316; `compareSnapshots` `check-parts.mjs` L132-145 |
| 7 | page errors | uncaught `pageerror` | any → FAIL | L318 |
| 8 | network | requests leaving the base origin | any (first 10 unique) → FAIL `third-party request: …` | L319-321 |
| 9 | abort | any exception | FAIL `check aborted: …` + console dump | L322-328 |
| 10 | `--mobile` | runs `mobile-check.mjs <fullId> --profiles …` (passes `--port/--base/--out`, `--skip perf` if skipped) | its exit ≠ 0 → exit 1 | L338-348 |

### 3.3 Layout gates (`tools/qa/check-parts.mjs` `layoutAt` L19-59 + `dom-parts.mjs` `hudChecks` L17-42)

| Gate | Source | Threshold | Verdict |
|---|---|---|---|
| controls off screen | `__ui.offscreen()` (visible hit box leaves viewport; scrolled-out content does not count) | non-empty | FAIL, every size (L39-40) |
| world text size | `__app.textSizes()` (Text3D only) | `pxEq` < `--min-text` **16**, **only at exactly 1280×720** | FAIL, ≤ 5 listed + count (L45-51) |
| ui3d world surfaces | `__ui.worldTextSizes()` | hook **does not exist** (`hud/debug.ts` has `surfaceTextSizes` only) → always a note | never checked here |
| SDF magnification | `textSizes()[].magnification` | > `--sdf-max-mag` **4** | WARN (L52-55) |
| interface text | `__ui.textSizes()[].units` (DOM text + WebGL labels) | < `CAPTION_UNITS` **15** units (= 10.5 CSS px @1280×720) − 0.05 | FAIL, every size (dom-parts L11, L31-35) |
| region overlap | `__ui.overlaps()` over `header, spine, system, column, board, navigator, sheet` | any intersection > 0.5 px | FAIL (dom-parts L36-40; regions `hud/debug-types.ts` L38) |

### 3.4 Output and pass line

- Files in `<outDir>`: `NN-<step>-<W>x<H>.jpg`, `sheet-<W>x<H>.jpg`, `random-NN-<step>.jpg`, `sheet-random.jpg`,
  `dpr2-<step0>.jpg`, `report.json` (L333).
- `report.json` keys: `chapterId, size, sizes, quality, gpu{renderer,vendor,webgl2,maxTextureSize,hud}, steps[{step,
  drawCalls,triangles,hues{families,shares,coloured}}], perf[{step,frameAvg,gpuAvg,cpuAvg,syncAvg,syncP95,drawCalls,
  triangles,quality,resolution,samples,spread,confirmed?}], perf4k[], layout[{step,size,offscreen,textCount,textMin,
  maxMagnification,hudTextCount,hudTextMin,overlaps,dpr?}], dpr2[{step,nodes,probes,compared,diffs}],
  leaks{other,rounds[{geometries,textures,programs,tweens}]}, failures[], warnings[], notes[], zoom, requests{total,
  thirdParty}`.
- Console: `[1/5] … [5/5]` (+ `[6/6]`) headers; `  <step> hue families: …` per step; `  FAIL …`, `  WARN …`,
  `  note: …`; `<n> warning(s) (not failures) — see report.json`; **last line** (L335):
  `PASS <volume/chapter> — report: <outDir>/report.json` or `FAILED <volume/chapter>: <n> problem(s) — report: …`.
  Exit 0 only with no failures and (with `--mobile`) a passing mobile-check (L349).
- Expected notes on a DOM-HUD path chapter: `ui3d world surfaces are not measured …` (benign).

## 4. `tools/qa/mobile-check.mjs` (touch profiles; also via `chapter-check --mobile`)

`node tools/qa/mobile-check.mjs <volume/chapter> [--profiles all|pp,pa,pl,tp,tl] [--only|--skip steps,gestures,travel,
rotation,perf] [--budget 16.6] [--perf-fail] [--perf-rounds 2] [--perf-frames 90] [--other <chapter>] [--freeze 3]
[--extra k=v&…] [--out DIR] [--port|--base]` (L3-30).

- Profiles (`mobile-parts.mjs` L11-15): pp 390×844@3 safe `47,0,34,0` sheet minHit 44 · pa 360×800@3 sheet 44 ·
  pl 844×390@3 safe `0,47,21,47` side 44 · tp 820×1180@2 sheet 48 · tl 1180×820@2 side 48. URL `q=auto`, touch.
- Fails: wrong `formFactor`/`pointer` or tier ≠ `mobile` (L95-97); per step and per sheet tab (`touchLayout`
  `mobile-parts.mjs` L29-48): `__ui.offscreen()` non-empty, `__ui.smallText(14)` non-empty (HUD text < **14 CSS px**),
  `__ui.smallTargets(44|48)` non-empty; any console error/warn; gestures/travel/rotation failures; contact sheet.
  World text (`__app.textSizes()` + `__ui.surfaceTextSizes()`) < 14 px is a **warning**. Perf > 16.6 ms is a warning
  unless `--perf-fail`. A step with `nav.hiddenUntil` gets a note («Далі» by touch not tested).
- Output `<out>/<chapter.id>/` (**short id** — L90): `m-<profile>-<step>[-<tab>].jpg`, `mobile-<profile>.jpg`,
  `mobile-<profile>-tabs.jpg`, `mobile-report.json`. Last line (L208):
  `mobile-check <volume/chapter>: PASS — 0 failure(s), <w> warning(s), <n> note(s) · <out>/mobile-report.json`.

## 5. Other tools — use / skip on this volume

| Tool | Command | Use for E3 | Notes |
|---|---|---|---|
| `shot.mjs` | `node tools/qa/shot.mjs <volume/chapter/step> [--size WxH] [--q] [--freeze 3|off] [--wait ms] [--eval "<js>"] [--script f.mjs] [--dpr n] [--touch] [--extra "k=v"] [--out f.jpg|dir]` | **yes** — single state shots | `--eval`: `app` = `__app`, expression value printed `eval → …`, then `await app.settled()` (L28-37, L57-60); `--script`: `export default async (page, { base, width, height }) => {…}` then `settled()` (L61-65). Output `shot <file>  [<renderer>]` + `  <W>x<H> <tier> · <n> calls · <k>k tris · t=<s>`; exit 1 on any console error/warn (L67-76). `--out` ending `.jpg` = file, else dir → `<dir>/<route with / → ->-<W>x<H>.jpg` |
| `sheet.sh` | `tools/qa/sheet.sh <out.jpg> [--cols 3] [--tile 640] [--title "…"] img…` | **yes** | tiles labelled with file names (`-label '%t'`), dark background, capped at 1920 px wide; prints `sheet <file> (<W>x<H>, <n> tiles)` (L28). Needs the shims |
| `snap.mjs` | `--chapters a,b --sizes WxH,… --out DIR [--freeze 3] [--extra] [--dpr] [--touch]` | optional | lossless PNG per step `<chapterId>-<step>-<W>x<H>.png` (L69); `--compare A B` needs ImageMagick `compare` — **no shim** → unusable here |
| `a11y-check.mjs` | `<volume/chapter/step> … [--size] [--tabs 60] [--hud dom] [--out]` | optional | Tab order, accessible names, aria sanity, contrast ≥ 4.5:1 (3:1 large); `<out>/a11y/<step>.json`; exit 1 on fail |
| `dom-cost.mjs` | `<chapter> [--size] [--tier] [--frames 120] [--no-fail]` | optional | layout on step change ≤ 4 ms (mobile 8), steady layouts 0, style ≤ 0.2 ms/frame, HUD script ≤ 0.5 ms (1.0), `#kd-hud` ≤ 1500 nodes, HUD on/off ≤ 1.5 ms (2.5); HUD script attribution needs the dev server |
| `transition.mjs` | `<from>[/step] <to>[/step] [--frames 12] [--size 1280x720] [--out]` | optional (borders) | frame-sequence sheet + longest live frame ≤ 50 ms |
| `perf.mjs` | `<route>… [--q high,ultra] [--frames 300] [--warmup 1200] [--json f] [--uncapped]` | optional | same budget numbers as chapter-check |
| `volume-walk.mjs` | `<volume> --port|--base [--size 1280x720|--touch] [--out] [--no-back] [--from ch/step --until ch] [--map]` | **no** (see Gotchas) | opens `?noaudio` only (no `debug`) (L226) → a draft volume is invisible in the full tree; `GATES` (L26) knows only `circuit/prologue/click`; a step with `nav.hiddenUntil` throws «Далі» waits for the goal… (L270-272) |
| `next-chapter.mjs` | `closingCard(page, settle)` L12-26 → `{ shown, lines, bridge, next, position }`; `nextChapter(page, settle)` L32-38 → `{ card, landed }` | **yes** in chapter scripts | presses `[data-ui="nav-next"]` via `element.click()` |
| `sheet-tab.mjs` | `sheetTab(page, 'text'|'controls'|'board', settle)` L10-26 | **yes** in chapter scripts | clicks `[data-ui="sheet-tabs:<id>"]` in narrow layouts; no-op on wide ones |
| `reset-check`, `ui-check`, `library-check`, `desk-toggle`, `robustness`, `color-check`, `hud-sheet` | — | no | platform checks, not chapter acceptance (`ui-check` passes here only with `--hud gl --no-perf`) |
| `xbrowser`, `webkit-smoke` | — | no | Playwright Firefox/WebKit absent (`~/.cache/ms-playwright` holds only `__dirlock`) |

## 6. Chapter interaction scripts — the established pattern (circuit `build`)

Files: `app/src/volumes/<v>/chapters/<id>/qa/helpers.mjs` + `qa/interactions.mjs` (radio PATH-NOTES L232; README of
each chapter has a `## QA` line with the command, e.g. `circuit/chapters/build/README.md` L37-41). Linted (`*.mjs`
under `app/src` get the default ESLint config with `no-undef`) → first line after the shebang:
`/* global process, console, window, document, getComputedStyle */`. Imports from tools by 7 × `../`:
`'../../../../../../../tools/qa/lib.mjs'`, `'../../../../../../../tools/qa/sheet-tab.mjs'`,
`'../../../../../../../tools/qa/next-chapter.mjs'`.

**Harness** (`circuit/chapters/build/qa/interactions.mjs`):
- Args L29-33: `--port|--base`, `--size` (default **1280x720**), `--touch`, `--out` (optional; no `--out` → no shots).
- `check(what, ok, detail)` L36-41 prints `  ok  <step> <what>  [detail]` / `  FAIL …`.
- `snap(name)` L43-44 → `<out>/<W>x<H>[t]-<name>.jpg`.
- Boot L236-238: `openApp(page, appUrl(base, { route: 'circuit/build/first-light', freeze: 0, extra: {} }))`, then
  `__app.pause()`, `advance(page, 0.1)` — frozen engine clock, stepped by hand → deterministic.
- `enter(id)` L59-64: `__app.goto('<chapter>', id)` then a continuity sample and `check('no takeaway before the goal')`.
- Per-step bodies `steps[id]()` L75-232 reach the goal and assert takeaway; L245-262 every «Згадайте» link
  (`[data-ui="path-recall"]`) opens another chapter's step and `[data-ui="path-back"]` returns.
- Console L264-272: `appErrors` filtered to `level === 'error'` (**bug to not copy**: detail uses `e.text`; the field is
  `message`).
- Last line L279-282: `<passed>/<total> checks passed (<W>x<H>[, touch])`; exit 1 on any failed check. (Prologue's
  variant ends `FAIL prologue interactions — 70/71 checks at 1280x720`; no project-wide convention.)

**Helpers** (`circuit/chapters/build/qa/helpers.mjs`), all CSS-px based so one script serves every size/DPR:

| Function | Signature | Line |
|---|---|---|
| `advance` | `(page, seconds)` → `__app.step(1/60, round(s·60))` + 10 single frames (HUD fades settle) | L6-9 |
| `locate` | `(page, id)` → `__ui.locate('ctl-<id>')` `{x,y,w,h}` (centre+size); throws if off screen | L12-16 |
| `read` | `(page, name)` → `__app.read(name)` | L18 |
| `at` | `(page, probe)` → `__app.locate(probe)` `{x,y,visible,shown,world}`; throws if unknown | L21-25 |
| `click` | `(page, id)` mouse click on a dock control + `advance(0.2)` | L28-32 |
| `slide` | `(page, id, fx, from=0)` drag a slider knob to track fraction `fx` (track = box ±4 %, y = top 18 %) | L35-45 |
| `scrub` | `(page, id, from, to)` → returns `release()` (button held) | L48-61 |
| `thumbAt` / `clickTrack` | `(page, id, fx)` point on track / one click (eased jump) | L64-78 |
| `clickProbe` | `(page, name)` move → 1 frame → re-locate → click → `advance(0.2)` | L81-88 |
| `dragFrom` | `(page, {x,y}, fx, fy, {settle})` → `release(after)`; offsets in viewport heights | L94-105 |
| `shown` / `press` | `(page, css)` element present and not under `[hidden]` / `element.click()` + `advance(0.3)` | L108-118 |
| `pointer` | `(page, isTouch)` → `{ down, move, up, tap, path(points, steps=8) }`; touch through CDP `Input.dispatchTouchEvent`; one frame after each move | L125-174 |
| `strides` | `(page, reader, seconds)` → largest per-frame change per numeric field (continuity) | L180-200 |

**Sandbox skeleton** (`_dev/chapters/_sandbox-radio-link/qa/measure.mjs`, 1262 lines; recon-E2 SYNTHESIS L522 plans a
COPY+ADAPT for `_sandbox-electronics-bench`): header with sections L3-46; `--out` required (exit 2) L76-80;
`q = touch ? 'auto' : 'high'` L83; `held(page)` = `__app.step(1/60, 0)` L90; `frames(page, n)` = n rAF on the live
clock L120-123; `perFrame` L126-137; `open(page, step, freeze)` with a 180 s race and `fonts.ready` L140-152;
`report` + `check(what, ok, detail)` L207-225; sections run in one context, each `check('opened', …)` first;
draw calls ≤ 350 / triangles ≤ 1.5 M / hues ≤ 4 per frame L486-489, L556-575; phone gate via
`Emulation.setCPUThrottlingRate` ×4, `frameMs ≤ 250` L1136-1162 (CPU throttling never reaches a worker); leaks via 3
visits to `_sandbox-ui` with its one known warning filtered (L73-75, L1166-1213); verdict
`PASS sandbox-radio-link — <n> checks` / `FAIL <k> of <n>` + `<out>/measure.json` L1255-1262.

## 7. Goal automation — how to drive a step to its goal from a script

1. **What a goal is.** `stepUi … goal?: When` (`hud/step-ui-types.ts` L271-275; ENGINE_API §24 L841). The DOM panel
   polls it every frame (`hud-dom/step/path-body.ts` L244 `if (holds(ctx.goal)) return reveal()`); once true the
   takeaway («Висновок», `[data-ui="path-takeaway"]`) is revealed and stays for the session (`ctx.reached`, L214-224);
   a step without `goal` shows it at once. `nav: { hiddenUntil: When | 'goal' }` keeps the navigator inert/hidden
   until it first holds (`hud/nav-gate.ts` L13-46; QA `__ui.navHidden()`); ArrowRight does nothing meanwhile;
   `__app.goto` is not blocked by it (chapter-check navigates such steps fine).
2. **Chapter side (must exist for any script).** `ctx.qa.probe(name, Object3D | Vector3 | () => …, { origin? })` →
   `__app.locate(name)` = `{ x, y, visible, shown, world }` in CSS px (`engine/qa-probes.ts` L10-38);
   `ctx.qa.expose(name, () => json)` → `__app.read(name)`; `__app.probes()` lists both (readers as `read:<name>`).
   Circuit convention: one reader per step with the goal's inputs (`first-light`: verdict, clamps, flips …) plus a
   chapter reader with `reached: STEP_IDS.filter(s => sessionGoals.has(s))` and a `motion` reader for continuity
   (`circuit/chapters/build/scene.ts` L78-101, `steps/01-first-light.ts` L47-63). Probes/readers exist in production.
3. **Page setup.** `openApp(page, appUrl(base, { route: 'electronics/<ch>/<step>', freeze: 0 }))`;
   `__app.pause()`; then only `advance(page, s)` / `__app.step(dt, n)` moves time. First step of a chapter opens on
   its opening card (`hud-dom/step/step-panel.ts` L204-209): press `[data-ui="path-opening"] button` first.
4. **Reader-like input (preferred, what circuit asserts).** HUD control: `__ui.locate('ctl-<id>')` (segmented item
   `ctl-<id>:<item>`), then `page.mouse`/`pointer(...)`. Scene object: `__app.locate(probe)` → move → 1 frame →
   re-locate → click/drag (`clickProbe`, `pointer.path`). Narrow layouts: `sheetTab(page, 'controls', …)` first.
   Under a frozen clock hover fires only when the object under the pointer changes: move away by a fraction of the
   window first (radio PATH-NOTES L345-346).
5. **Programmatic shortcut (no pointer).** `__ui.press(id)` (step **buttons** only; throws `__ui.press: no button`
   otherwise) and `__ui.set(id, value, true)` (`notify=true` runs the change handlers like a gesture)
   (`hud/debug.ts` L214-227); `_path/qa/nav-scrub.mjs` reaches a goal with two `__ui.press` calls. Scene-only goals
   (drag a part into a socket) have no programmatic route unless the chapter exposes one.
6. **Proof.** After `advance(page, ≥0.2)`: `shown(page, '[data-ui="path-takeaway"]')` true (and false *before*),
   `!__ui.navHidden()`, and the step reader's numbers (`__app.read`). Last step: «Далі» → `closingCard()` →
   `[data-ui="path-closing"]` with `.path-now li` = 3 lines (path) / bridge / `[data-ui="path-next"]`;
   `panel.closingWhen` brings the card by itself.
7. **Other DOM names** (`hud-dom/step/path-body.ts`): `path-opening` L81, `path-closing-back` L93, `path-map` L96,
   `path-restart` L103, `path-next` L109, `path-closing` L115, `path-back` L136, `path-action` L145, `path-hint`
   L149, `path-takeaway` L157, `path-recall` L162, `path-more` (toggle, `aria-expanded`) L184, `path-to-card` L191,
   `path-step` L194; navigator `nav-next`, `nav-prev`, `navigator`; home `home-start`, `home-resume`, `home-empty`;
   map `map-go`, `map-chrome`; dock `dock`.

## 8. Screenshots for a human / visual reviewer

- **Every step, deep-linked, frozen 3 s:** chapter-check output — `sheet-1920x1080.jpg` (+ `sheet-1280x720.jpg`,
  `sheet-3840x2160.jpg` with `--sizes all`), per-step `NN-<step>-<W>x<H>.jpg`, and `sheet-random.jpg` (same steps
  entered by spam navigation — must look the same). Sheets ≤ 1920 px wide, labelled by file name, 3 columns.
- **One state:** `node tools/qa/shot.mjs electronics/<ch>/<step> --size 1280x720 --out "$QA_OUT/E3/<ch>-<step>.jpg"
  [--freeze 3] [--eval "await app.step(1/60, 60)"] [--script reach.mjs]`. With `--script`, the module gets
  `(page, { base, width, height })` on a frozen page: it must advance the clock itself after input.
- **Goal states:** run the chapter's `qa/interactions.mjs --out <dir>` (snaps at start / mid / goal per step), then
  `tools/qa/sheet.sh <dir>/sheet-goals.jpg --cols 3 --tile 640 --title "electronics/<ch> — goals" <dir>/*-goal.jpg`.
- **Phones:** `mobile-<profile>.jpg` (+ `-tabs.jpg`) from mobile-check.
- Pixels are not bit-stable between runs (global-constraints L78): assertions compare `__app.read` numbers, never
  images; sheets are for eyes. A reviewer agent can open the JPGs with the Read tool.

## 9. Site profile and site smoke

**Build** `node tools/site/build.mjs --volume electronics [--out DIR] [--sub radio-pop-science/electronics]
[--port 5391] [--no-smoke] [--keep-work]` (`tools/site/build.mjs` L5-14): refuses before copying when `volume.json`
id ≠ `--volume`, an `aside` is set, or (smoke on) the port is busy (L37-50); copies `app/` minus
`node_modules,dist,.vite`, links node_modules, deletes every other volume incl. `_demo _dev _path`, writes
`library.json = { title: null, defaultVolume: 'electronics' }`, sets `status: published` (L53-75); `tsc --noEmit`,
`vite build --outDir <out> --emptyOutDir` (10 min limit each, L83-90); then `smoke`. First line
`site: volume electronics (draft → published); removed from the copy: _demo _dev _path circuit electricity radio`;
last line `PASS site smoke` (or `site: built <out> (browser check skipped)` with `--no-smoke`).

**Smoke** `node tools/site/smoke.mjs --dist DIR --volume electronics [--sub …] [--port 5391]` | `--url <served URL/>
--volume electronics` | `--dist DIR --serve [--port]` (L6-9, CLI L193-219). Software GL by default (SwiftShader
`SOFTWARE_ARGS` L31-32, `QA_CHROME_ARGS` replaces), viewport 1280×800, fresh context per load, real clock. Each load:
`goto` 60 s, `__app` 60 s, `__app.ready` / `__app.settled()` / `document.fonts.ready` 90 s each, then 1 s (L113-129).
Checks (expected title = `volume.json` `subtitle` if `headline: "subtitle"`, else `title` → **«Радіоелектроніка»**;
note = `emptyNote` «Перші глави — в роботі»; L212-216):

| Check | Requirement | Line |
|---|---|---|
| per load: every request answered | no status ≥ 400, no `requestfailed` (workers, audio, fonts included) | L105-109, L144 |
| per load: stays under sub-path | every response URL starts with the site URL | L107, L145 |
| per load: no console error | page `console.error`, `pageerror`, `__app.errors()` level `error` (**warnings pass**) | L110-111, L139, L146 |
| per load: booted | `#fatal` not shown, `#boot` has class `out` | L140-141, L147 |
| home: only volume | `listVolumes()` ids = `electronics`, `status: published`, `role: default` | L155-156 |
| home: plain address | `lobby() ?? position.volumeId` = `electronics`; `__ui.overlay() === 'home'`; `document.title` = title and body text contains it | L157-159 |
| home: no library/aside | no `home-library`, no `home-aside*` in `__ui.names()` | L160 |
| **no chapters built** | `home-empty` in names and body contains `emptyNote` | L161-163 |
| **≥ 1 chapter built** | `home-start` or `home-resume` in names; deep link `#/electronics/<listChapters()[0].id>/<its steps[0].id>` keeps the hash and `position` = that chapter/step | L164-170 |
| foreign link | `#/no-such-volume/chapter/step` opens electronics | L171-172 |
| bare address | `/<sub>` (no slash) → 3xx to `/<sub>/` (skipped for a root site) | L175-181 |

Last line `PASS site smoke` / `FAILED site smoke: <n> problem(s)` + list (L189). `listChapters()[0]` = registry order:
roots by `order` then id, children (`parent`) right after their parent (`engine/registry.ts` L50-72) — with E3 that
is `prologue` if built (journey order). Smoke never runs goals, never checks warnings, never asserts worker mode.

**Whole site locally** (README L89-98, background): build radio into `$X`, electronics into `$X/electronics` with
`--sub radio-pop-science/electronics`, `site_serve 5395 "$X"`, smoke both by `--url`; expect four `PASS site smoke`.

## 10. CI — `.github/workflows/pages.yml`

On push to `main` and manual (L4-7); `concurrency: pages`, no cancel (L12-14); job `build` (ubuntu-24.04, 20 min,
L20-26): checkout → Node 24 → `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint`
→ `pnpm test --testTimeout=30000` (L39-56) → **Documents**: `doccheck.py --all`, `docs/volumes/radio/test_check.py`,
`docs/volumes/radio/check.py` (L58-62; **no electronics `check.py`**) → `configure-pages@v6` (L64-66) → Site profile
radio (L69-75) → **Electronics** `node tools/site/build.mjs --volume electronics --out "$RUNNER_TEMP/site/electronics"
--sub "${BASE_PATH#/}/electronics"` (L80-86; smoke runs here with SwiftShader) → Nuclear from `gh-pages` (L90-96) →
upload (L98-100); job `deploy` (L102-114). No `tools/qa` tool runs in CI: chapter-check, mobile-check and interaction
scripts are local gates only. `doccheck --all` covers electronics once `docs/volumes/electronics/chapters/` exists
(path group + typography/index/glossary/export/runtime up-to-date + fonts; `tools/content/doccheck.py` L252-270), so
generated files must be committed.

## 11. Commands to accept one new electronics chapter (E3)

```bash
# 0. shell (every new shell)
source tools/site/qa-env.sh                     # Node 24, QA_ALLOW_SOFTWARE=1, QA_OUT, shims on PATH

# 1. documents and code (pass lines)
python3 tools/content/path_check.py --volume electronics        # path[electronics]: … — ok
tools/content/regen.sh --volume electronics                     # … doccheck[electronics]: ALL GREEN
python3 docs/volumes/electronics/check.py                       # E1-8's own check (last line OK)
(cd app && pnpm typecheck && pnpm lint && pnpm test src/volumes/electronics && pnpm fonts:check)

# 2a. browser checks on the site profile (radio's way: published, under a sub-path, no ?debug needed)
X="$HOME/.cache/radio-pop-science/site-electronics"
node tools/site/build.mjs --volume electronics --out "$X" --sub radio-pop-science/electronics   # last: PASS site smoke
site_serve 5393 "$X" >/dev/null; B=http://127.0.0.1:5393/radio-pop-science/
node tools/qa/chapter-check.mjs electronics/<ch> --base $B --skip perf --out "$QA_OUT/E3" > "$QA_OUT/E3-<ch>-cc.log" 2>&1; echo "exit $?"; tail -1 "$QA_OUT/E3-<ch>-cc.log"
node tools/qa/mobile-check.mjs electronics/<ch> --base $B --profiles pp --skip perf --out "$QA_OUT/E3-m" | tail -1
node app/src/volumes/electronics/chapters/<ch>/qa/interactions.mjs --base $B --out "$QA_OUT/E3-<ch>-i" | tail -1
node app/src/volumes/electronics/chapters/<ch>/qa/interactions.mjs --base $B --touch --out "$QA_OUT/E3-<ch>-i" | tail -1
site_stop 5393

# 2b. or the full tree (draft volume; tools add ?debug): from app/, in the background
#     pnpm build && pnpm preview --port 5377 --strictPort      → then the same commands with --port 5377

# 2c. perf on the GPU (one run at a time, assert NVIDIA)
env -u QA_ALLOW_SOFTWARE node tools/qa/chapter-check.mjs electronics/<ch> --port 5377 --out "$QA_OUT/E3-perf"

# 2d. the full gate of docs/VOLUMES.md L150 (adds 4K perf + DPR 2)
node tools/qa/chapter-check.mjs electronics/<ch> --sizes all --port 5377 --out "$QA_OUT/E3-all"
```

Pass = exit 0 and the last lines quoted in §3.4, §4, §9; for interaction scripts the chosen last line with zero
failures. Expected durations: §1 above.

## Gotchas

1. **Short ids resolve to circuit.** `pickChapter` ranks legacy → default (`circuit`) → others (lib.mjs L115-123):
   `chapter-check prologue` / `build` check **circuit's** chapters. Always pass `electronics/<id>`. In chapter scripts
   `__app.goto('<id>', step)` resolves in the *current* volume first (`engine/debug/api.ts` L36-41), but full ids are
   safer. Output dirs: chapter-check names the dir from the typed argument (`electronics-<id>`); mobile-check from the
   short id (`<out>/<id>`, L90) → `prologue`/`build` collide with circuit runs in the same `--out`.
2. **Any `console.warn` fails chapter-check** (and shot.mjs, mobile-check); smoke fails only on errors. Typical
   warning sources: missing glyph in a 3D caption (`text: no glyph …`; the doccheck `fonts` group skips «Текст»,
   «Підказки» and «Підписи», radio PATH-NOTES L183-184 — formulas in «Підписи» are caught only at run time), a `custom` control without a `dom` widget (radio PATH-NOTES L279-282), three.js texture/colour-space
   warnings. `console.log` fails lint; `console.info` is not captured. Worker errors must be forwarded to
   `console.error` to be seen at all.
3. **Contact sheets are a gate.** Without the shims on `PATH`, `sheet.sh` fails → `FAIL contact sheet failed` → exit 1
   (L133-139). Always `source tools/site/qa-env.sh`. `snap.mjs --compare` needs `compare`, which has no shim.
4. **Hue gate vs. this volume's subject.** > 4 strong hue families (≥ 8 % of coloured px each, sat ≥ 0.35, val ≥
   0.3) fails a deep-link frame. Resistor colour-band close-ups (brown/red/orange/yellow/green/blue/violet), a row of
   red/yellow/green/blue LEDs, the teal accent plus amber lamp light can exceed it. Dark room helps only if the
   coloured objects stay small *relative to each other*: shares are of coloured pixels, not of the frame.
5. **World text on ui3d surfaces is never measured by chapter-check** (`__ui.worldTextSizes` does not exist; note
   only); multimeter/scope readouts drawn as world surfaces escape the 16 px-eq gate on desktop but are a *warning*
   in mobile-check (< 14 px via `surfaceTextSizes`). Text3D below 16 px-eq at 1280×720 fails. The 16 px-eq check
   runs only at exactly 1280×720 (never under `--zoom`).
6. **`QA_ALLOW_SOFTWARE=1` is always set by qa-env.sh**, which disables the NVIDIA assertion: a silent SwiftShader
   fallback would make perf numbers meaningless without a failure. For perf runs unset it. `--skip perf` was decided
   while the GPU was broken (radio П19; baseline 75–97 ms/frame); the GPU works now but no perf run of a new-volume
   chapter is recorded.
7. **Leak check can silently skip.** On a site-profile build with a single built chapter there is no other chapter →
   `[5/5] leak check skipped` (no fail, L271-272). In the full tree it leaves to another volume's chapter instead.
   Module-level state survives rebuilds and two chapter copies coexist at a border: keep state in the mount.
8. **Frozen clock semantics.** `?freeze=N` simulates N s in 1/60 steps after each navigation, then frames with
   `dt = 0`; chapter transitions are instant; `ctx.clock.frame` is not deterministic; a background worker never
   replies on held frames (force sync under freeze). Real-clock assertions are flaky here (28 rAF in 2 s under
   software; volume-walk failed 1 of 3) — assert on `?freeze` + `__app.step`.
9. **volume-walk is unusable for a draft electronics.** It opens `?noaudio` without `debug` (draft not registered in
   the full tree) and only knows `circuit`'s gate probe; any `nav.hiddenUntil` step throws. `tools/qa` is not
   editable, so a walk would need the site profile and no held-back navigators.
10. **`site_serve` always serves under `/radio-pop-science/`** (no `--sub`); fine for a profile built with
    `--sub radio-pop-science/electronics` because the build is relative (`base: './'`), but build.mjs's own smoke runs
    under the `--sub` given. `build.mjs` without `--no-smoke` needs port 5391 free; port 5392 was taken at recon time.
11. **Do not run pnpm/corepack in a kept site work copy** (relinks `app/node_modules`); unit tests in the copy fail by
    construction. `vite build --emptyOutDir` empties `--out`: build radio before electronics when combining.
12. **Copy hazard in circuit scripts:** `e.text` instead of `e.message` (build/qa/interactions.mjs L269); its harness
    filters warnings out of its own console check, so warnings are only caught by chapter-check.
13. **Deep links show the opening card** on a chapter's first step (until its goal was reached this session) and
    hide the takeaway on steps with a goal; chapter-check screenshots are pre-goal states by construction.
14. **Smoke's deep link** is to `listChapters()[0]` — the lowest `order` among *built* chapters, booted under
    SwiftShader within 90 s with zero console errors; a worker/audio file 404 or a request outside the sub-path fails it.
15. **CI does not run electronics' own `check.py`** (pages.yml L58-62 lists radio only) nor any `tools/qa` tool.

## Open questions

1. Perf gate for E3: keep `--skip perf` (radio П19 / decision 18) or run the 8 ms gate now that the RTX 5070 works
   (and with `env -u QA_ALLOW_SOFTWARE`)? Who owns the number if a bench step exceeds it?
2. Size set for acceptance: `--sizes all` (VOLUMES.md L150: 4K + DPR 2) or the default 1920×1080 (+ forced 1280×720
   layout)? Is `--mobile pp` (or more profiles) part of E3 acceptance?
3. Steps that are inherently multicoloured (resistor bands, LED colours): design every deep-link frame to ≤ 4 hue
   families, or allow a recorded `--max-hues 5` deviation per chapter?
4. Browser checks against the site profile (radio's practice; published, no `?debug`) or a full-tree preview
   (`--port`)? With the profile, the leak check needs ≥ 2 built chapters.
5. Interaction script contract for electronics: one `qa/interactions.mjs` per chapter with a fixed last line
   (`PASS electronics/<id> — n checks` / `FAIL k of n`)? Copy the bench sandbox's `qa/helpers.mjs` (E2) or circuit's?
6. Should something assert the model worker on the published site (recon-E2 SYNTHESIS risk 6 says "site smoke after
   E3 asserts `mode === 'worker'`", but `tools/site/smoke.mjs` does not; `tools/site` is not in the read-only list)?
7. Add `python3 docs/volumes/electronics/test_check.py && python3 docs/volumes/electronics/check.py` to the
   `Documents` step of `pages.yml`?
8. Closing card of the last built chapter (`resistor-pick` in E3): its bridge names the next journey chapter (`smd`
   branch or `divider`), which is not built — what should `[data-ui="path-next"]` do, and do the scripts assert it?
