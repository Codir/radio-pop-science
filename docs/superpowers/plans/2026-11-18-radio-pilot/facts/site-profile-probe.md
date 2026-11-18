# Site profile probe — one-volume GitHub Pages build

Probe date 2026-11-18, repository `/home/pilot/tmp/radio-science-pop` at `63fd42c` (clean before and after:
`git status --short` prints nothing). Everything below was run on scratch copies under
`/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/plan/site-probe/`
(called `site-probe/` below) with Node `v24.22.3` (nvm), `corepack pnpm` → `12.18.0`, Chrome `157.0.8103.38`
(`/usr/bin/google-chrome`). Design doc = `docs/superpowers/specs/2026-11-17-radio-volume-design.md`, cited
as `design:<line>`.

Scratch layout (kept for inspection):

| Path under `site-probe/` | What it is |
|---|---|
| `app/` | copy of `app/` pruned by hand to volume `circuit` (+ a scratch-only worker probe) |
| `repo2/app/` | copy of the full `app/` **plus a draft skeleton volume `radio`** (3 planned chapters, none built) and the `@radio/*` alias |
| `repo2/tools/site/build.mjs`, `repo2/tools/site/smoke.mjs` | the candidate site script, run for `radio` and for `circuit` |
| `serve.mjs`, `smoke.mjs` | the hand-probe server and browser test |
| `*.log`, `smoke-*/*.jpg`, `lobby-radio*.jpg`, `fatal-*.jpg` | logs and screenshots of every run quoted below |

## How volumes are discovered

There is no registry file and no environment-driven filter: a volume exists because its directory exists.
Every consumer of the volume list, with the exact pattern:

| Consumer | File:line | Pattern / call | Loaded |
|---|---|---|---|
| Published + draft volume manifests | `app/src/engine/discover.ts:20-22` | `import.meta.glob<VolumeModule>(['../volumes/*/volume.ts', '!../volumes/_*/volume.ts'], { eager: true })` | eager, entry chunk |
| Dev volume manifests | `app/src/engine/discover.ts:23` | `import.meta.glob<VolumeModule>('../volumes/_*/volume.ts')` | lazy, only with `?debug` |
| Chapter lists per volume | `app/src/engine/discover.ts:24` | `import.meta.glob<{ default?: Record<string, ChapterModule> }>('../volumes/*/chapters.ts')` | lazy chunk `volume-<id>` |
| Chapters of one volume | `app/src/volumes/<id>/chapters.ts:6` (same file in every volume) | `export default import.meta.glob('./chapters/*/index.ts', { eager: true });` | inside `volume-<id>` |
| Chapter content | `app/src/content/loader.ts:9` | `import.meta.glob<{ default?: unknown }>('../volumes/*/chapters/*/content.ts')` | lazy per chapter |
| Library config | `app/src/engine/discover.ts:12` | `import config from '../volumes/library.json';` → `export const LIBRARY_CONFIG: LibraryConfig = config;` (`:26`) | entry chunk |
| Vite aliases `@<volume>` | `app/vite.config.ts:14-18` | `readdirSync(src('volumes'), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'))` | config time |
| Splash / tab title | `app/vite.config.ts:25-44` (`libraryTitle()`) | reads `volumes/library.json` and `volumes/${library.defaultVolume}/volume.json`; fills `%LIBRARY_TITLE%`, `%LIBRARY_SUBTITLE%`, `%LIBRARY_DESCRIPTION%` of `app/index.html` | config time |
| ESLint volume rules | `app/eslint-rules/chapter-boundary.js:29-37` | `readdirSync(VOLUMES, { withFileTypes: true }).filter((d) => d.isDirectory())` | lint time |
| Unit test of the tree | `app/src/engine/__tests__/volumes.test.ts:11-17` | globs `'../../volumes/*/volume.ts'`, `'../../volumes/*/volume.json'`, `'../../volumes/*/chapters/*/index.ts'` (all eager) | test time |
| Document tools | `tools/content/chapters.py:37-42` | `volume_ids()`: directories of `docs/volumes/` that have `chapters/` **and** `app/src/volumes/<id>/volume.json` | tool time |

Boot path (`app/src/main.ts:45-46`): `discoverVolumes({ includeDev: flags.debug })` →
`new Library(volumes, LIBRARY_CONFIG, { includeDev: flags.debug })`.

Rules that decide what a build shows:

```ts
// app/src/engine/discover.ts:74-79
export async function discoverVolumes(opts: { includeDev: boolean }): Promise<VolumeSource[]> {
  …
    if (m && (m.status === 'published' || opts.includeDev)) manifests.push(m);

// app/src/engine/library.ts:18-28
export interface LibraryConfig {
  readonly title: string | null;
  readonly defaultVolume: string;
  readonly legacyVolume?: string;   // doc comment: "Default: the default volume."
}

// app/src/engine/library.ts:69-76 (constructor)
if (!def) throw new Error(`Library: default volume '${config.defaultVolume}' is not registered`);
const legacy = this.sources.get(config.legacyVolume ?? def.id)?.manifest;
if (!legacy) throw new Error(`Library: legacy volume '${config.legacyVolume}' is not registered`);
this.title = config.title ?? def.headline;
this.multi = this.volumes.filter((v) => v.status === 'published' && v.aside === null).length > 1;

// app/src/engine/library.ts:99-102
showsLibrary(volumeId: string): boolean {
  const volume = this.get(volumeId);
  return this.multi || (volume !== undefined && volume.status !== 'published' && volume.listed);
}

// app/src/engine/volume.ts:18, 258, 273-274
export type VolumeStatus = 'published' | 'draft' | 'dev';
const STATUSES: readonly string[] = ['published', 'draft', 'dev'];
if (isDevVolumeId(identity.id) !== (status === 'dev'))
  fail(`a dev volume has status 'dev' and a directory name starting with '_' (and only a dev volume)`);
```

Current `app/src/volumes/library.json` (whole file):

```json
{
  "title": null,
  "defaultVolume": "circuit",
  "legacyVolume": "electricity"
}
```

Volumes in the tree: `circuit` (`published`, default), `electricity` (`published`, `aside`), `_demo`, `_dev`,
`_path` (`dev`). No volume imports another one: a search for `@electricity`, `@/volumes/<other>` and relative
paths in `app/src/volumes/circuit` finds nothing; the only cross-volume imports are `_dev` sandboxes importing
`@circuit/shared/**` (allowed for `_…` volumes by `app/eslint-rules/chapter-boundary.js:26-27`). Platform code
names no volume in imports (lint `local/volume-boundary`, `app/eslint.config.js:63-68`); the one literal is the
default argument `private readonly legacyVolume = 'electricity'` (`app/src/engine/store.ts:202`), always
overridden by `new Store(safeStorage(), library.legacyVolume.id)` (`app/src/engine/app.ts:217`).

Routing is hash-only (`app/src/engine/router.ts:1-4`: «Hash routing (not the History API paths) keeps the app
servable from any static path without rewrites»). The only History API calls write a hash or keep the path:
`this.host.history.replaceState(null, '', formatHash(route))` (`router.ts:95`) and
`window.history.replaceState(null, '', restartUrl(window.location))` where `restartUrl` returns
`${loc.pathname}${loc.search}#/` (`app/src/engine/reset.ts:32-34,76`). There is no service worker and no web
manifest (search for `serviceWorker`, `webmanifest` in `app/index.html`, `app/src/main.ts`,
`app/src/engine/*.ts`: nothing).

Asset addressing is relative everywhere:

| Asset | Where the URL is built | Base |
|---|---|---|
| JS / CSS chunks | `app/vite.config.ts:46` `base: './'` (comment `:6-7`: «`base: './'` keeps every asset URL relative, so the build works from any sub-path») | `import.meta.url` of the importing chunk |
| Font atlases + metrics | `app/src/text/fonts.ts:174-176`: `new URL('fonts/', baseUrl ?? document.baseURI)`, `fetch(new URL('fonts.json', base), { cache: 'no-cache' })` | `document.baseURI` |
| Web fonts (DOM interface) | `app/src/hud-dom/core/fonts.ts:45-50`: `new URL('fonts/web/', baseUrl)`, `new FontFace(f.family, …)` | `document.baseURI` |
| Workers | none in the engine today (search for `new Worker` over `app/src`: no hit) | — |

## How upstream publishes

| Fact | Evidence |
|---|---|
| The live site is a `gh-pages` branch that holds a finished build, not a workflow | `git ls-tree --name-only upstream/gh-pages` → `.nojekyll`, `assets`, `fonts`, `index.html` (180 files, 7.66 MB) |
| It is pushed by hand or by a script outside the mirror | 24 commits, all by `NikoSkakun`, linear, all titled `Збірка сайту (<sha>, <date>)`; the last three: `Збірка сайту (f204ef47, 2026-11-18)`, `Збірка сайту (8bb8f517, 2026-11-17)`, `Збірка сайту (7bdd06c9, 2026-11-17)` |
| No workflow and no deploy script in `upstream/main` or in this copy | `git ls-tree -r --name-only upstream/main` filtered for `deploy` or `.github`: nothing; top level is `.gitignore README.md app docs tools`; `tools/` holds `content`, `dev-start.sh`, `qa`, `ref-models` |
| The only deployment text names a file that does not exist here | `docs/ARCHITECTURE.md:193-194`: «`tools/deploy.sh` builds `main` (`pnpm build`) and rsyncs `app/dist/` → `/srv/electricity/www/app/` (nginx, port 8080 …)» — `tools/deploy.sh` is **absent** in this copy and in `upstream/main` |
| The build is the plain `pnpm build`, relative base, served from `/tech/` | `git show upstream/gh-pages:index.html` line 19: `<script type="module" crossorigin src="./assets/index-BY_Bo0Az.js">`; title `Електричний струм`, splash sub-line `Від атома до лампочки` |
| It ships every volume, dev ones included | 14 files match `assets/chapter-_dev…`, `chapter-_demo…`, `chapter-_path…` in `upstream/gh-pages` (dev volumes are bundled, registered only with `?debug`) |
| `.nojekyll` is added by their publish step, not by the build | it is an empty file in the branch; `app/public/` contains only `fonts/` |
| README | `README.md:8` «**Подивитися:** https://nikoskakun.github.io/tech/»; `README.md:36` «Потрібні Node.js 24+ і pnpm.»; `README.md:42` «`pnpm build        # продакшн-збірка в app/dist (працює з будь-якої підтеки)`»; `README.md:46` «Перевірка сценаріїв і згенерованих файлів: `python3 tools/content/doccheck.py --all`.» |

Nothing of upstream's publishing exists as code; `.github/` does not exist upstream, so a new
`.github/workflows/pages.yml` and a new `tools/site/` do not collide with anything in `upstream/main` today.

## Profile recipe (verified steps)

Stand-in volume `circuit` (already `"status": "published"`, `app/src/volumes/circuit/volume.json:8`), in
`site-probe/app` (copy of `app/` without `node_modules`, `dist`; `node_modules` as a hard-link copy).

| # | Step | Exact action | Result |
|---|---|---|---|
| 1 | keep one volume | `rm -rf src/volumes/electricity src/volumes/_demo src/volumes/_dev src/volumes/_path` | `src/volumes/` = `circuit`, `library.json` |
| 2 | library config | write `src/volumes/library.json` = `{ "title": null, "defaultVolume": "circuit" }` — **the field `legacyVolume` is dropped**. Field names are unchanged from the design's wording (`design:566`); the only adaptation is that the current file has a third field which must go | with `legacyVolume: "electricity"` left in, the build is green and the page dies at boot (failure modes below) |
| 3 | publish | nothing for `circuit`; for a draft volume set `"status": "published"` in its `volume.json` | verified on the `radio` skeleton, below |
| 4 | typecheck | `corepack pnpm typecheck` (`tsc -p tsconfig.json --noEmit`) | exit 0, 3.1 s — **no edit needed**: the stale `paths` entry `@electricity/*` in `tsconfig.json` is harmless |
| 5 | lint | `corepack pnpm lint` (`eslint . --max-warnings 0`) | exit 0, 4.2 s |
| 6 | unit tests | `corepack pnpm test` (`vitest run`) | **exit 1: `Test Files  2 failed \| 64 passed (66)`, `Tests  8 failed \| 541 passed (549)`** — table below |
| 7 | build | `corepack pnpm build` (`tsc -p tsconfig.json --noEmit && vite build`) | exit 0, 3.6 s; `✓ 681 modules transformed.`; `dist/` = `index.html`, `assets/` (38 files), `fonts/`; 4.2 MB (fonts 2.2 MB); no dotfiles |
| 8 | base path | **none needed.** `vite.config.ts:46` already has `base: './'`; `dist/index.html` references `./assets/index-J8XoPO9H.js`, lazy chunks resolve through `import.meta.url` | served under `/radio-pop-science/`: all checks pass |
| 8b | base path, alternative | `corepack pnpm exec vite build --base=/radio-pop-science/ --outDir dist-abs` (the CLI flag overrides the config) | exit 0 and the same smoke test passes; `index.html` then has `src="/radio-pop-science/assets/index-….js"` — works, but hard-codes the repository name and gains nothing |

Extra edits needed for typecheck / lint / build to pass in the pruned copy: **none** (no generated index, no
alias, no config, no `index.html` edit). The title, splash and description follow automatically
(`dist/index.html`: `<title>Електричний струм</title>`, `<h1 class="boot-title">Електричний струм</h1>`,
`<p class="boot-sub">Від атома до лампочки</p>`).

Unit tests that cannot pass in a pruned copy (all in platform directories):

| Test file | Failing test | Why |
|---|---|---|
| `app/src/engine/__tests__/volumes.test.ts:29-32` | `has the volumes this test knows about` | `expect(volumes.map((v) => v.dir).sort()).toEqual(['_demo', '_dev', '_path', 'circuit', 'electricity']);` |
| `app/src/engine/__tests__/volumes.test.ts:94-103` | `the pilot volume is the front door; volume 1 is kept aside behind its button (DECISIONS §60)` | `expect(config).toMatchObject({ defaultVolume: 'circuit', legacyVolume: 'electricity' });` |
| `app/src/engine/__tests__/volumes.test.ts:105-112` | `volume 1 keeps its names in volume.json only: the home headline is the subtitle` | reads the `electricity` manifest |
| `app/src/engine/__tests__/lint-chapter-boundary.test.ts:65-66` | 3 × `rejects … '@electricity/…'` | the rule lists volumes with `readdirSync`; `electricity` is gone, so the import is no longer recognised as a volume |
| `app/src/engine/__tests__/lint-chapter-boundary.test.ts:79-105` | `keeps volumes independent`, `keeps the platform free of volume names` | same |

Besides, tests read files outside `app/` by relative path (`docs/volumes/electricity/chapters/…`,
`docs/VOLUMES.md`, `tools/content/export_runtime.py`): a copy of `app/` alone fails them with `ENOENT` (seen
in `repo2` before `docs` was linked next to it: `Test Files  10 failed | 136 passed (146)`, nine of the ten
because of missing `docs/…` files). **Unit tests belong to the full tree only**; in the pruned copy only `tsc`
and `vite build` make sense.

### The same recipe on a draft skeleton `radio` (the state batch 1 produces)

`site-probe/repo2/app` = full tree + `src/volumes/radio/{volume.json,volume.ts,chapters.ts}` (`status:
"draft"`, `format: "path"`, 3 planned chapters with `title` / `minutes` / `floor`, an `emptyNote`, no
`chapters/` directory) + `"@radio/*": ["./src/volumes/radio/*"]` in `tsconfig.json`.

| Check on the **full** tree with the draft `radio` added | Result |
|---|---|
| `corepack pnpm typecheck` | exit 0 |
| `corepack pnpm lint` | exit 0 |
| `corepack pnpm build` | exit 0; `dist/assets/volume-radio-BVN16wbY.js` is bundled (a draft is bundled, registered only with `?debug`); 160 asset files, 7.8 MB |
| `corepack pnpm test` | **exit 1: `Test Files  1 failed \| 145 passed (146)`, `Tests  1 failed \| 1602 passed (1603)`** — `src/engine/__tests__/volumes.test.ts > volumes in the repository > has the volumes this test knows about`: `expected [ '_demo', '_dev', '_path', …(3) ] to deeply equal [ '_demo', '_dev', '_path', …(2) ]` (`+ "radio"`) |
| the same file with that one test skipped: `corepack pnpm exec vitest run src/engine/__tests__/volumes.test.ts -t '^(?!.*has the volumes this test knows about)'` | exit 0, `Tests  18 passed \| 1 skipped (19)` (the per-volume rows of `it.each(volumes)` do cover `radio`) |
| for comparison, the unmodified tree (log of the baseline agent, `plan/baseline-logs/test.log`) | `Test Files  146 passed (146)`, `Tests  1601 passed (1601)` |

Profile of that tree (`node tools/site/build.mjs --volume radio`, script below): exit 0 in 15–20 s, tree
untouched afterwards (`library.json` still names `circuit`, `radio/volume.json` still `"draft"`), 336 modules,
`dist` 3.5 MB, `<title>Радіо</title>`, smoke `PASS`.

### Failure modes that the build does NOT catch (each verified)

| Mistake in the profile | `tsc` / `vite build` | What the reader sees |
|---|---|---|
| `legacyVolume: "electricity"` left in `library.json` | green | fatal screen: «Не вдалося запустити посібник» / «Під час завантаження сталася помилка.» / «Перевірте з’єднання з сервером і спробуйте ще раз.» / `Library: legacy volume 'electricity' is not registered` / button «Спробувати знову» |
| volume left `"status": "draft"` | green | the same fatal screen with `Library: default volume 'radio' is not registered` |
| `defaultVolume` names a directory that is not there | **red** at config time: `ENOENT … src/volumes/nope/volume.json` (thrown from `libraryTitle()`, `vite.config.ts:28`) | — |

The browser check is the only gate for the first two.

## Smoke test and results

Server: `site-probe/serve.mjs` — `dist` is reachable **only** under `/radio-pop-science/`; `/` and any
absolute `/assets/…`, `/fonts/…` answer 404; `/radio-pop-science` answers 301 to the slash form; there is no
fallback page (as on GitHub Pages). It is the same server as `serve()` in the candidate
`tools/site/smoke.mjs` listed in the next section, plus a `<status> <url>` log line per request.

Browser: `playwright-core` 1.65.0 (already a devDependency, `app/package.json:35`) + `/usr/bin/google-chrome`.
`tools/qa/lib.mjs` has no software-rendering flag set of its own: its `GPU_ARGS` (`lib.mjs:27-35`) are
`--use-angle=vulkan --enable-gpu --ignore-gpu-blocklist --no-sandbox --hide-scrollbars
--force-color-profile=srgb --autoplay-policy=no-user-gesture-required`, replaceable through the environment
variable `QA_CHROME_ARGS` (`lib.mjs:133-134`), and `openApp` throws «WebGL is not running on the NVIDIA GPU…»
unless `QA_ALLOW_SOFTWARE` is set (`lib.mjs:160-162`). The probe kept those switches and selected SwiftShader:
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox
--hide-scrollbars --force-color-profile=srgb --autoplay-policy=no-user-gesture-required`. Reported renderer:
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, interface `dom`.

Commands:

```bash
cd site-probe && source ~/.nvm/nvm.sh && nvm use 24
node serve.mjs app/dist-rel-w 5391 &      # build with base './'
node serve.mjs app/dist-abs-w 5392 &      # build with --base=/radio-pop-science/
node smoke.mjs --base http://127.0.0.1:5391/radio-pop-science/ --volume circuit --step prologue/click --app "$PWD/app" --out "$PWD/smoke-rel-w"
node smoke.mjs --base http://127.0.0.1:5392/radio-pop-science/ --volume circuit --step prologue/click --app "$PWD/app" --out "$PWD/smoke-abs-w"
```

Results — identical for both builds: **84 checks ok, 0 failed, `PASS site smoke`** (1 min 42 s and 1 min 28 s
for 8 page loads under SwiftShader). `-w` = the same profile plus a scratch-only worker probe. The first run,
on the untouched profile `dist-rel`, gave 63 ok and one false failure caused by my own pattern for
`fonts/*.png?v=…`; the pattern was fixed before the runs above.

| Scenario | Observed |
|---|---|
| Plain address `…/radio-pop-science/` | 27 requests, all 200, all under `/radio-pop-science/`; the address becomes `#/circuit/prologue/click` (`Nav.start` normalises with `replaceState`); `__ui.overlay() === 'home'`; home controls `home`, `home-start`, `home-map` — **no `home-library`, no `home-aside-*`**; key `L` does not open a library; `__app.listVolumes()` = `[{"id":"circuit","title":"Електричний струм","status":"published","listed":true,"loaded":true,"role":"default","legacy":true}]`; `document.title` «Електричний струм». Screenshot `smoke-rel/01-plain.jpg`: headline «Електричний струм», «Від атома до лампочки», buttons «Почати подорож», «Мапа», chips «9 глав», «≈ 82 хв», «одна кулька … стенд», the journey map behind |
| Console | no console error, no page error, `__app.errors()` has no `error` entry, fatal screen hidden, splash gone — in every scenario |
| Deep link `#/circuit/prologue/click` | step open, address kept, `overlay` is `null` (no home screen), all 200 |
| Deep link into the second chapter `#/circuit/wire/atoms` | its lazy chunk `assets/chapter-circuit-wire-….js` resolves; step open |
| Link into a removed volume `#/electricity/atom/nucleus` (page load) | **silent fallback**: the first step of the first chapter opens (`circuit/prologue/click`; screenshot `smoke-rel/04-removed-volume.jpg` shows the step panel «Клац — і світло»), the address bar is rewritten to `#/circuit/prologue/click`; no message, no error, no home screen. Code path `Nav.start` (`app/src/engine/nav.ts:268-283`): `library.resolve(route)` gives `null` for an unknown volume, then `volumeEntry(this.library.defaultVolume.id)` |
| The same hash typed into a running app (`hashchange`) | nothing moves; the address is restored to the current step (`nav.ts:297-299`, comment «unknown target: restore the address of where we actually are») |
| Two-part pre-library link `#/prologue/click` | completed to `#/circuit/prologue/click` |
| Saved state of another engine copy on the same origin (`localStorage['electricity:v2']` with `last` in `electricity`) | ignored, the home of the volume opens (`nav.ts:271`: resuming requires `library.get(last.volumeId)?.aside === null`) |
| Pre-library record `localStorage['electricity:v1']` | boot fine; it is migrated into the only volume (an `electricity:v2` record appears) |
| Fonts | `fonts/fonts.json`, `fonts/{mono,body,bodyBold,display}.png?v=…`, `fonts/web/{nunito-800,fira-400,fira-600,jbmono-500}.woff2` all 200 under the sub-path; `document.fonts`: `K Display`, `K Body` ×2, `K Mono` loaded, none in error |
| Worker (scratch-only probe: `new Worker(new URL('../../sim/probe.worker.ts', import.meta.url), { type: 'module' })` spawned from the lazy chunk of `circuit/prologue`; the worker imports a second module) | built as `assets/probe.worker-CII3QAFh.js` (Vite emits one self-contained IIFE file, the import inlined); with the relative base the chunk contains ``new Worker(new URL(new URL(`probe.worker-CII3QAFh.js`,import.meta.url).href,``+import.meta.url),{type:`module`})``; the worker answered `{"ok":true,"answer":42,"url":"http://127.0.0.1:5391/radio-pop-science/assets/probe.worker-CII3QAFh.js"}`. `tsc` and `eslint` accepted the probe files as written (`tsconfig.json` has no `WebWorker` lib; `self.onmessage` / `self.postMessage(x)` type-check against the DOM lib) |
| QA-tool URL shape on a profile build: `?debug&overlay=0&noaudio&q=high#/circuit/wire/atoms` (what `appUrl()`, `tools/qa/lib.mjs:99-107`, builds) | works: volumes `["circuit:published:default"]`, 9 chapters, no error — `tools/qa` can be pointed at a profile build with `--base` |

`radio` skeleton (no chapter built), profile build, plain address — screenshots `lobby-radio.jpg`,
`lobby-radio-map.jpg`:

| Observed | Value |
|---|---|
| state | `__app.lobby() === 'radio'`, address `#/`, `overlay` is `home`, controls `home`, `home-empty` |
| on screen | «Радіо», «Від електрона до екрана», a chip with the `emptyNote` text and, behind them, the journey plates of the planned chapters **without labels**; no «Почати подорож», no «Мапа» button (matches `docs/VOLUMES.md:77-79`: «no start / map / size facts») |
| labelled map | key `M` → overlay stays `home`; click on a plate → nothing. Only the QA hook `window.__ui.open('map')` shows the map with the cards «Як передати цілу картинку одним числом?» / «у планах · ≈ 10 хв», the header «Пройдено 0 з 3 глави · лишилося ≈ 24 хв» and the floor ruler. Hover was not tested |
| foreign link `#/no-such-volume/chapter/step` | lobby again, address `#/` |

Hand-probe test script (`site-probe/smoke.mjs`, as run):

```js
// Smoke test of a one-volume site build served under a sub-path.
//   node smoke.mjs --base http://127.0.0.1:5391/radio-pop-science/ --volume circuit --step prologue/click \
//                  --app <dir with node_modules/playwright-core> [--out <dir>] [--gone electricity/atom/nucleus]
// Exit code 0 = every check passed.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('base');
const volume = arg('volume', 'circuit');
const step = arg('step', 'prologue/click');
const gone = arg('gone', 'electricity/atom/nucleus');
const out = arg('out', './smoke-out');
const require = createRequire(`${arg('app', process.cwd())}/package.json`);
const { chromium } = require('playwright-core');
mkdirSync(out, { recursive: true });

// tools/qa/lib.mjs: QA_CHROME_ARGS replaces GPU_ARGS; software rendering = SwiftShader through ANGLE
const ARGS = (
  process.env.QA_CHROME_ARGS ??
  '--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --force-color-profile=srgb --autoplay-policy=no-user-gesture-required'
)
  .split(/\s+/)
  .filter(Boolean);

const failures = [];
const check = (ok, name, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ARGS,
});

/** A fresh context (empty localStorage) per scenario; collects responses, console errors and page errors. */
async function open(url, name, seed = null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // `seed`: localStorage records present before the app boots (a reader who used another build on this origin)
  if (seed)
    await context.addInitScript((records) => {
      for (const [k, v] of Object.entries(records)) if (window.localStorage.getItem(k) === null) window.localStorage.setItem(k, v);
    }, seed);
  const page = await context.newPage();
  const responses = [];
  const failed = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('response', (r) => responses.push({ status: r.status(), url: r.url() }));
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout: 60000 });
  await page.evaluate(() => window.__app.ready);
  await page.evaluate(() => window.__app.settled());
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({
    href: window.location.href,
    hash: window.location.hash,
    title: document.title,
    position: window.__app.position(),
    lobby: window.__app.lobby(),
    volumes: window.__app.listVolumes(),
    overlay: window.__ui?.overlay() ?? null,
    names: window.__ui?.names() ?? [],
    appErrors: window.__app.errors(),
    gpu: window.__app.gpu(),
    hud: window.__app.engine?.flags?.hud ?? null,
    bootHidden: document.getElementById('boot')?.classList.contains('out') ?? null,
    fatalShown: document.getElementById('fatal')?.hidden === false,
    fatalText: document.getElementById('fatal')?.hidden === false ? document.getElementById('fatal').innerText : '',
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    fontsError: [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family),
    storageKeys: Object.keys(window.localStorage),
  }));
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85 });
  return { context, page, responses, failed, consoleErrors, pageErrors, state };
}

const origin = new URL(base).origin;
const sub = new URL(base).pathname;
function common(run, label) {
  const bad = run.responses.filter((r) => r.status >= 400);
  check(bad.length === 0, `${label}: no response ≥ 400`, bad.map((r) => `${r.status} ${r.url}`).join(' '));
  check(run.failed.length === 0, `${label}: no failed request`, run.failed.join(' '));
  const outside = run.responses.filter((r) => !r.url.startsWith(origin + sub) && !/^(data|blob|about):/.test(r.url));
  check(outside.length === 0, `${label}: every request stays under ${sub}`, outside.map((r) => r.url).join(' '));
  check(run.consoleErrors.length === 0, `${label}: no console error`, run.consoleErrors.join(' | '));
  check(run.pageErrors.length === 0, `${label}: no uncaught page error`, run.pageErrors.join(' | '));
  const appErr = run.state.appErrors.filter((e) => e.level === 'error');
  check(appErr.length === 0, `${label}: __app.errors() has no error`, appErr.map((e) => e.message).join(' | '));
  check(!run.state.fatalShown, `${label}: the fatal screen is hidden`, run.state.fatalText);
  check(run.state.bootHidden === true, `${label}: the splash is gone`);
}

try {
  // 1. the plain address ------------------------------------------------------------------------------------
  const plain = await open(base, '01-plain');
  const s = plain.state;
  console.log(`renderer: ${s.gpu.renderer} · interface: ${s.hud}`);
  console.log(`plain: hash=${s.hash} title=${JSON.stringify(s.title)} pos=${JSON.stringify(s.position)} lobby=${s.lobby} overlay=${s.overlay}`);
  console.log(`plain: names=${s.names.filter((n) => n.startsWith('home')).join(' ')}`);
  console.log(`plain: volumes=${JSON.stringify(s.volumes)}`);
  common(plain, 'plain');
  check(s.volumes.length === 1 && s.volumes[0].id === volume, 'plain: exactly one volume is registered', s.volumes.map((v) => v.id).join(' '));
  check(s.volumes[0]?.role === 'default' && s.volumes[0]?.legacy === true, 'plain: it is the default and the legacy volume');
  check((s.lobby ?? s.position.volumeId) === volume, 'plain: the app is inside the volume', JSON.stringify(s.position));
  check(s.overlay === 'home', 'plain: the home screen of the volume is shown', String(s.overlay));
  check(s.overlay !== 'library', 'plain: not the library screen');
  check(!s.names.includes('home-library'), 'plain: no «Бібліотека» button on the home screen');
  check(!s.names.some((n) => n.startsWith('home-aside')), 'plain: no button to another volume', s.names.filter((n) => n.startsWith('home-aside')).join(' '));
  check(s.names.includes('home-start') || s.names.includes('home-resume'), 'plain: the home screen has its start button');
  await plain.page.keyboard.press('l');
  await plain.page.waitForTimeout(600);
  check((await plain.page.evaluate(() => window.__ui.overlay())) !== 'library', 'plain: the library key does nothing');
  const urls = plain.responses.map((r) => r.url.slice((origin + sub).length));
  console.log(`plain: ${plain.responses.length} responses: ${urls.join(' ')}`);
  check(urls.some((u) => /^fonts\/fonts\.json/.test(u)), 'plain: fonts/fonts.json is fetched under the sub-path');
  check(urls.filter((u) => /^fonts\/[^/]+\.png(\?|$)/.test(u)).length >= 1, 'plain: font atlases are fetched under the sub-path');
  check(urls.filter((u) => /^fonts\/web\/.*\.woff2$/.test(u)).length >= 1, 'plain: web fonts are fetched under the sub-path');
  check(s.fontsError.length === 0 && s.fontsLoaded.length > 0, 'plain: FontFace objects loaded', `loaded ${s.fontsLoaded.join(',')} error ${s.fontsError.join(',')}`);
  check(urls.some((u) => new RegExp(`^assets/volume-${volume}-`).test(u)), 'plain: the volume chunk is fetched');
  check(!urls.some((u) => /_demo|_dev|_path|_sandbox|electricity/.test(u)), 'plain: nothing of a removed volume is requested');
  const workerProbe = await plain.page.evaluate(() => window.__workerProbe ?? null);
  if (workerProbe !== null) {
    console.log(`plain: worker probe → ${JSON.stringify(workerProbe)}`);
    check(workerProbe.ok === true, 'plain: the module worker started and answered', JSON.stringify(workerProbe));
    check(urls.some((u) => /^assets\/.*worker.*\.js$/.test(u)), 'plain: the worker script is fetched under the sub-path');
  }
  await plain.context.close();

  // 2. a deep link -----------------------------------------------------------------------------------------
  const deep = await open(`${base}#/${volume}/${step}`, '02-deep');
  console.log(`deep: hash=${deep.state.hash} pos=${JSON.stringify(deep.state.position)} overlay=${deep.state.overlay}`);
  common(deep, 'deep');
  const [ch, st] = step.split('/');
  check(deep.state.position.volumeId === volume && deep.state.position.chapterId === ch && deep.state.position.stepId === st, 'deep: the step is open', JSON.stringify(deep.state.position));
  check(deep.state.hash === `#/${volume}/${step}`, 'deep: the address is kept', deep.state.hash);
  check(deep.state.overlay !== 'library', 'deep: not the library screen', String(deep.state.overlay));
  // a second deep link, to a later chapter (its lazy chunk must resolve under the sub-path)
  const later = await deep.page.evaluate(() => window.__app.listChapters().map((c) => `${c.id}/${c.steps[0].id}`));
  console.log(`deep: chapters = ${later.join(' ')}`);
  await deep.context.close();
  if (later[1]) {
    const second = await open(`${base}#/${volume}/${later[1]}`, '03-deep-second-chapter');
    common(second, 'deep2');
    check(`${second.state.position.chapterId}/${second.state.position.stepId}` === later[1], 'deep2: the first step of the second chapter is open', JSON.stringify(second.state.position));
    await second.context.close();
  }

  // 3. a link into a volume that is not in this build -------------------------------------------------------
  const lost = await open(`${base}#/${gone}`, '04-removed-volume');
  console.log(`removed: hash=${lost.state.hash} pos=${JSON.stringify(lost.state.position)} lobby=${lost.state.lobby} overlay=${lost.state.overlay}`);
  common(lost, 'removed');
  check((lost.state.lobby ?? lost.state.position.volumeId) === volume, 'removed: falls back to the volume of this site', JSON.stringify(lost.state.position));
  check(!lost.state.hash.includes(gone.split('/')[0]), 'removed: the address bar is rewritten', lost.state.hash);
  await lost.context.close();
  // … and typed into the address bar of a running app (hashchange, not a page load)
  const typed = await open(`${base}#/${volume}/${step}`, '05-before-typed');
  await typed.page.evaluate((h) => {
    window.location.hash = h;
  }, `#/${gone}`);
  await typed.page.waitForTimeout(1200);
  const after = await typed.page.evaluate(() => ({ hash: window.location.hash, pos: window.__app.position(), errors: window.__app.errors() }));
  console.log(`typed: hash=${after.hash} pos=${JSON.stringify(after.pos)}`);
  check(after.hash === `#/${volume}/${step}`, 'typed: an unknown volume in the hash restores the current address', after.hash);
  check(after.errors.filter((e) => e.level === 'error').length === 0, 'typed: no error', JSON.stringify(after.errors));
  await typed.context.close();

  // 4. a pre-library two-part link and a saved position of another build on the same origin -------------
  const short = await open(`${base}#/${step}`, '06-short-link');
  check(short.state.hash === `#/${volume}/${step}`, 'short: a two-part link is completed with the volume', short.state.hash);
  common(short, 'short');
  await short.context.close();
  const there = { volumeId: gone.split('/')[0], chapterId: gone.split('/')[1], stepId: gone.split('/')[2] };
  const stale = await open(base, '07-stale-storage', {
    'electricity:v2': JSON.stringify({ v: 2, settings: {}, progress: { visited: { [`${there.volumeId}/${there.chapterId}`]: [there.stepId] } }, last: there, lastIn: { [there.volumeId]: there } }),
  });
  console.log(`stale: hash=${stale.state.hash} pos=${JSON.stringify(stale.state.position)} overlay=${stale.state.overlay} keys=${stale.state.storageKeys.join(',')}`);
  common(stale, 'stale');
  check(stale.state.position.volumeId === volume, 'stale: a saved position in a volume that is not in this build is ignored', JSON.stringify(stale.state.position));
  await stale.context.close();
  const v1 = await open(base, '08-v1-storage', {
    'electricity:v1': JSON.stringify({ v: 1, progress: { visited: { atom: ['dive-in'] } }, last: { chapterId: 'atom', stepId: 'nucleus' } }),
  });
  console.log(`v1: hash=${v1.state.hash} pos=${JSON.stringify(v1.state.position)} overlay=${v1.state.overlay} keys=${v1.state.storageKeys.join(',')}`);
  common(v1, 'v1');
  check(v1.state.position.volumeId === volume, 'v1: a pre-library record does not break the boot', JSON.stringify(v1.state.position));
  await v1.context.close();
} catch (error) {
  failures.push(`exception: ${error.message}`);
  console.error(error);
} finally {
  await browser.close();
}
console.log(failures.length === 0 ? 'PASS site smoke' : `FAILED site smoke: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
process.exit(failures.length === 0 ? 0 : 1);
```

## Proposed tools/site script: inputs, outputs, files it rewrites

The engine has **no** env-driven or config-driven volume filter (discovery is the globs above), so the profile
has to be a pruned copy. A candidate was written and run in the scratch repository
(`site-probe/repo2/tools/site/`) for `--volume radio` (draft skeleton → lobby) and `--volume circuit`
(9 chapters → home + deep link): exit 0, `PASS site smoke`, source tree unchanged afterwards, temporary
directory removed.

| | |
|---|---|
| Files | `tools/site/build.mjs` (78 lines), `tools/site/smoke.mjs` (155 lines) — plain Node ESM, no dependency beyond `app/node_modules` (`typescript`, `vite`, `playwright-core`) |
| Command | `node tools/site/build.mjs [--volume radio] [--out tools/site/dist] [--sub radio-pop-science] [--port 5391] [--no-smoke] [--keep-work]` (paths resolve from the script's own location, so the working directory does not matter) |
| Preconditions | `app/node_modules` exists; `app/src/volumes/<volume>/volume.json` exists (else `site: app/src/volumes/<volume>/volume.json is missing`, exit 1) |
| Work copy | `mkdtempSync(join(tmpdir(), 'site-profile-'))` ← `app/` without `node_modules`, `dist`, `.vite`; `node_modules` is a **symlink** to `app/node_modules` (verified: `tsc` and `vite build` work through the symlink and write nothing into it). Removed at the end unless `--keep-work`; kept when `tsc` or `vite` fails |
| Output | `--out`, default `tools/site/dist` — already git-ignored by the existing rule `.gitignore:2` `dist/` (`git check-ignore -v tools/site/dist/index.html` → `.gitignore:2:dist/`). Content: `index.html`, `assets/`, `fonts/` |
| Exit code | 0 = built and the browser check passed; 1 otherwise |
| Other entry points | `node tools/site/smoke.mjs --dist <dir> --volume <id> [--sub …] [--port …]` (check an existing build; verified, also with `--sub ""`); `node tools/site/smoke.mjs --dist <dir> --serve` (only serve under `/<sub>/`, e.g. for `tools/qa/… --base http://127.0.0.1:5391/radio-pop-science/`; verified with `curl`: 200 inside, 404 outside) |
| Environment | `QA_CHROME` (default `/usr/bin/google-chrome`), `QA_CHROME_ARGS` (replaces the SwiftShader flags) — the names `tools/qa/lib.mjs:133-137` uses |

What it changes **in the copy** (the repository is never written):

| Path in the copy | Change | Why |
|---|---|---|
| every entry of `src/volumes/` except `<volume>/` — today `electricity/`, `circuit/`, `_demo/`, `_dev/`, `_path/` | deleted | discovery is by directory; `design:565` |
| `src/volumes/library.json` | rewritten to `{ "title": null, "defaultVolume": "<volume>" }` | the front door is the volume; `legacyVolume` must go (`library.ts:72-73` throws otherwise) |
| `src/volumes/<volume>/volume.json` | `"status"` → `"published"` (parsed and re-serialised; a volume with `aside` is refused) | `discover.ts:78` registers only `published` volumes without `?debug` |

Not touched, verified unnecessary: `tsconfig.json` (stale `paths`), `vite.config.ts` (aliases and title come
from the pruned directory), `index.html`, `eslint.config.js`, every platform directory, every test.

Checks inside the pruned copy: `tsc -p tsconfig.json --noEmit` passes (kept in the script); `eslint` passes
(not run by the script); `vitest` fails by construction (8 platform tests, table above) and is not run.

What the browser check asserts (works for a chapterless volume too): every request answered and under the
sub-path; no console / page / `__app.errors()` error; splash gone, no fatal screen; the only volume is
`<volume>`, `published`, `role: 'default'`; the plain address is inside it (`lobby` or position) with
`overlay === 'home'`; `document.title` equals the volume's headline; no `home-library` / `home-aside-*`; if a
chapter is built, a deep link to its first step keeps its address; a link into an unknown volume lands in the
volume.

`tools/site/build.mjs` (as run):

```js
#!/usr/bin/env node
// Site profile: a production build of app/ that contains ONE volume, shown as a stand-alone course.
// The repository tree is not touched: the profile is applied to a temporary copy of app/.
//
//   node tools/site/build.mjs [--volume radio] [--out tools/site/dist] [--sub radio-pop-science]
//                             [--port 5391] [--no-smoke] [--keep-work]
//
//   1. copy app/ (without node_modules, dist, .vite) to a temporary directory; link app/node_modules into it
//   2. keep only src/volumes/<volume>/ (other volumes and the dev volumes `_…` are not in the build)
//   3. write src/volumes/library.json = { title: null, defaultVolume: <volume> }; set the volume's status to published
//   4. typecheck the copy and build it (`tsc --noEmit`, `vite build`) into --out
//   5. serve --out under /<sub>/ and check it in the browser (tools/site/smoke.mjs)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smoke } from './smoke.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const flag = (name) => argv.includes(`--${name}`);
const volume = opt('volume', 'radio');
const out = resolve(opt('out', join(repo, 'tools/site/dist')));
const sub = opt('sub', 'radio-pop-science');
const port = Number(opt('port', 5391));

const app = join(repo, 'app');
const fail = (message) => {
  console.error(`site: ${message}`);
  process.exit(1);
};
if (!existsSync(join(app, 'node_modules'))) fail('app/node_modules is missing: run `pnpm install --frozen-lockfile` in app/');
if (!existsSync(join(app, 'src/volumes', volume, 'volume.json'))) fail(`app/src/volumes/${volume}/volume.json is missing`);

// 1. the copy -------------------------------------------------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), 'site-profile-'));
const skip = new Set(['node_modules', 'dist', '.vite']);
cpSync(app, work, { recursive: true, filter: (src) => !skip.has(src.slice(app.length + 1).split('/')[0]) });
symlinkSync(join(app, 'node_modules'), join(work, 'node_modules'), 'dir');

// 2. one volume -----------------------------------------------------------------------------------------------
const volumes = join(work, 'src/volumes');
const removed = [];
for (const entry of readdirSync(volumes, { withFileTypes: true })) {
  if (entry.name === volume) continue;
  rmSync(join(volumes, entry.name), { recursive: true, force: true });
  if (entry.isDirectory()) removed.push(entry.name);
}

// 3. the front door -------------------------------------------------------------------------------------------
// no `legacyVolume`: it defaults to the default volume (app/src/engine/library.ts)
writeFileSync(join(volumes, 'library.json'), `${JSON.stringify({ title: null, defaultVolume: volume }, null, 2)}\n`);
const identityFile = join(volumes, volume, 'volume.json');
const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
if (identity.id !== volume) fail(`volume.json: id '${identity.id}' is not '${volume}'`);
if (identity.aside !== undefined) fail('volume.json: an aside volume cannot be the front door');
const was = identity.status;
identity.status = 'published';
writeFileSync(identityFile, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`site: volume ${volume} (${was} → published); removed from the copy: ${removed.join(' ')}`);

// 4. build ----------------------------------------------------------------------------------------------------
const bin = (name) => join(app, 'node_modules/.bin', name);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: work, stdio: 'inherit' });
  if (r.status !== 0) fail(`${[cmd, ...args].join(' ')} failed (work copy kept: ${work})`);
};
run(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit']);
run(bin('vite'), ['build', '--outDir', out, '--emptyOutDir']);
if (flag('keep-work')) console.log(`site: work copy kept at ${work}`);
else rmSync(work, { recursive: true, force: true });

// 5. browser check --------------------------------------------------------------------------------------------
const headline = identity.headline === 'subtitle' ? identity.subtitle : identity.title;
if (flag('no-smoke')) console.log(`site: built ${out} (browser check skipped)`);
else process.exit((await smoke({ dist: out, sub, port, volume, title: headline, appDir: app })) ? 0 : 1);
```

`tools/site/smoke.mjs` (as run):

```js
#!/usr/bin/env node
// Browser check of a site-profile build: serves <dist> under /<sub>/ exactly as a GitHub Pages project site does
// (nothing exists outside the sub-path, no fallback page) and opens it in headless Chrome.
//
//   node tools/site/smoke.mjs --dist tools/site/dist --volume radio [--sub radio-pop-science] [--port 5391]
//   node tools/site/smoke.mjs --dist tools/site/dist --serve     only serve (for tools/qa: --base http://127.0.0.1:5391/<sub>/)
//
// Environment: QA_CHROME (default /usr/bin/google-chrome), QA_CHROME_ARGS (replaces the software-rendering flags).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
// SwiftShader through ANGLE: WebGL2 without a GPU (a CI runner, a machine whose GPU Chrome cannot use)
const SOFTWARE_ARGS =
  '--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --autoplay-policy=no-user-gesture-required';

/** Serve `dist` under `/<sub>/` only. Resolves to { url, close }. */
export function serve(dist, sub, port) {
  const root = resolve(dist);
  const prefix = sub ? `/${sub}/` : '/'; // a user site or a custom domain has no sub-path
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const end = (status, headers = {}, body = '') => res.writeHead(status, headers).end(body);
    if (sub && url.pathname === `/${sub}`) return end(301, { location: prefix + url.search });
    if (!url.pathname.startsWith(prefix)) return end(404, { 'content-type': 'text/plain' }, 'outside the site');
    let rel = normalize(decodeURIComponent(url.pathname.slice(prefix.length)));
    if (rel === '.' || rel === '') rel = 'index.html';
    const file = join(root, rel);
    if (!file.startsWith(root)) return end(403);
    try {
      const path = (await stat(file)).isDirectory() ? join(file, 'index.html') : file;
      end(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }, await readFile(path));
    } catch {
      end(404, { 'content-type': 'text/plain' }, 'not found');
    }
  });
  return new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(port, '127.0.0.1', () =>
      ok({ url: `http://127.0.0.1:${port}${prefix}`, close: () => new Promise((done) => server.close(done)) }),
    );
  });
}

/** Returns true when every check passed. `title`: the expected browser-tab title (the volume's headline). */
export async function smoke({ dist, sub, port, volume, title, appDir }) {
  const { chromium } = createRequire(join(appDir, 'package.json'))('playwright-core');
  const site = await serve(dist, sub, port);
  const failures = [];
  const check = (ok, name, detail = '') => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROME ?? '/usr/bin/google-chrome',
    headless: true,
    args: (process.env.QA_CHROME_ARGS ?? SOFTWARE_ARGS).split(/\s+/).filter(Boolean),
  });
  /** One page load in a fresh profile; `label` prefixes the checks every load must pass. */
  const open = async (hash, label) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const bad = [];
    const outside = [];
    const errors = [];
    page.on('response', (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
      if (!r.url().startsWith(site.url)) outside.push(r.url());
    });
    page.on('requestfailed', (r) => bad.push(`failed ${r.url()}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(site.url + hash, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout: 60000 });
    await page.evaluate(() => window.__app.ready);
    await page.evaluate(() => window.__app.settled());
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      hash: window.location.hash,
      title: document.title,
      position: window.__app.position(),
      lobby: window.__app.lobby(),
      volumes: window.__app.listVolumes(),
      chapters: window.__app.listChapters().map((c) => `${c.id}/${c.steps[0]?.id}`),
      overlay: window.__ui?.overlay() ?? null,
      names: window.__ui?.names() ?? [],
      appErrors: window.__app.errors().filter((e) => e.level === 'error').map((e) => e.message),
      fatal: document.getElementById('fatal')?.hidden === false,
      splashGone: document.getElementById('boot')?.classList.contains('out') ?? false,
      text: document.body.innerText,
    }));
    check(bad.length === 0, `${label}: every request is answered`, bad.join(' '));
    check(outside.length === 0, `${label}: every request stays under ${new URL(site.url).pathname}`, outside.join(' '));
    check(errors.length === 0 && state.appErrors.length === 0, `${label}: no console error`, [...errors, ...state.appErrors].join(' | '));
    check(!state.fatal && state.splashGone, `${label}: the app booted (splash gone, no fatal screen)`);
    await context.close();
    return state;
  };
  try {
    const home = await open('', 'home');
    const where = home.lobby ? `lobby:${home.lobby}` : `${home.position.volumeId}/${home.position.chapterId}/${home.position.stepId}`;
    console.log(`  site: ${site.url} → ${where}, overlay ${home.overlay}, title «${home.title}», chapters: ${home.chapters.join(' ') || '(none built)'}`);
    check(home.volumes.map((v) => v.id).join(' ') === volume, `home: the only volume is ${volume}`, home.volumes.map((v) => v.id).join(' '));
    check(home.volumes[0]?.status === 'published' && home.volumes[0]?.role === 'default', 'home: it is published and is the front door');
    check((home.lobby ?? home.position.volumeId) === volume, `home: the plain address opens ${volume}`, where);
    check(home.overlay === 'home', 'home: on its home screen', String(home.overlay));
    check(home.title === title && home.text.includes(title), `home: the page is titled «${title}»`, home.title);
    check(!home.names.includes('home-library') && !home.names.some((n) => n.startsWith('home-aside')), 'home: no way to a library or to another volume');
    if (home.chapters.length > 0) {
      const first = home.chapters[0];
      const deep = await open(`#/${volume}/${first}`, 'deep link');
      check(deep.hash === `#/${volume}/${first}` && `${deep.position.chapterId}/${deep.position.stepId}` === first, `deep link: #/${volume}/${first} opens that step`, deep.hash);
    }
    const other = await open('#/no-such-volume/chapter/step', 'foreign link');
    check((other.lobby ?? other.position.volumeId) === volume, `foreign link: a link into a volume that is not here opens ${volume}`, other.hash);
  } catch (error) {
    failures.push(`exception: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
    await site.close();
  }
  console.log(failures.length === 0 ? 'PASS site smoke' : `FAILED site smoke: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  return failures.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../app');
  const volume = opt('volume', 'radio');
  const dist = resolve(opt('dist', join(appDir, '../tools/site/dist')));
  const sub = opt('sub', 'radio-pop-science');
  const port = Number(opt('port', 5391));
  if (argv.includes('--serve')) {
    console.log(`serving ${dist} at ${(await serve(dist, sub, port)).url} (Ctrl+C to stop)`);
  } else {
    const title = (await readFile(join(dist, 'index.html'), 'utf8')).match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    process.exit((await smoke({ dist, sub, port, volume, title, appDir })) ? 0 : 1);
  }
}
```

Output of `node tools/site/build.mjs --volume radio` in the scratch repository (Vite's file list omitted):

```text
site: volume radio (draft → published); removed from the copy: _demo _dev _path circuit electricity
✓ 336 modules transformed.
✓ built in 615ms
  ok   home: every request is answered
  ok   home: every request stays under /radio-pop-science/
  ok   home: no console error
  ok   home: the app booted (splash gone, no fatal screen)
  site: http://127.0.0.1:5391/radio-pop-science/ → lobby:radio, overlay home, title «Радіо», chapters: (none built)
  ok   home: the only volume is radio — radio
  ok   home: it is published and is the front door
  ok   home: the plain address opens radio — lobby:radio
  ok   home: on its home screen — home
  ok   home: the page is titled «Радіо» — Радіо
  ok   home: no way to a library or to another volume
  ok   foreign link: every request is answered
  ok   foreign link: every request stays under /radio-pop-science/
  ok   foreign link: no console error
  ok   foreign link: the app booted (splash gone, no fatal screen)
  ok   foreign link: a link into a volume that is not here opens radio — #/
PASS site smoke
```

For `--volume circuit` the same script prints 20 `ok` lines (adds `deep link: #/circuit/prologue/click opens
that step`) and `PASS site smoke` in 31–33 s.

Commands whose output proves the script on the real tree: `node tools/site/build.mjs --volume radio; echo $?`
→ last lines `PASS site smoke`, `0`; `git status --short` → empty; `ls tools/site/dist` → `assets fonts
index.html`; `grep -o '<title>[^<]*</title>' tools/site/dist/index.html` → `<title>Радіо</title>`;
`ls tools/site/dist/assets | grep -cE 'electricity|circuit|_dev|_demo|_path'` → `0`.

## Proposed workflow (yaml)

Latest releases, read on 2026-11-18 from `api.github.com/repos/actions/<name>/releases/latest` and the
actions' `action.yml`:

| Action | Latest tag | Published | Facts from its `action.yml` / release notes |
|---|---|---|---|
| `actions/checkout` | `v7.0.1` | 2026-07-20 | |
| `actions/setup-node` | `v7.1.0` | 2026-10-08 | inputs `node-version`, `cache` (`npm`, `yarn`, `pnpm`), `package-manager-cache` (default `true`; automatic caching only when `package.json` declares npm), `cache-dependency-path`; `runs.using: node24` |
| `actions/configure-pages` | `v6.0.0` | 2026-03-25 | outputs `base_url`, `origin`, `host`, `base_path` (e.g. `/my-repo`); input `enablement` default `'false'` (turning Pages on needs a token other than `GITHUB_TOKEN`) |
| `actions/upload-pages-artifact` | `v5.0.0` | 2026-04-10 | inputs `name` (`github-pages`), `path` (`_site/`), `retention-days` (`1`), `include-hidden-files` (`false`); tars with `--dereference --hard-dereference`, always excludes `.git` and `.github`, by default every dotfile; calls `actions/upload-artifact` v7.0.0 |
| `actions/deploy-pages` | `v5.0.1` | 2026-09-01 | needs `pages: write` and `id-token: write`; output `page_url`; input `artifact_name` default `github-pages` |

GitHub's documentation page «Using custom workflows with GitHub Pages» still shows the previous majors
(`configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`), and the `deploy-pages` README example
says `@v4`; that the three latest majors work together is **unverified** (no workflow run was possible here).
The hosted image `ubuntu-24.04` lists `Google Chrome 157.0.8103.50`, Node `22.23.4` (cached `24.22.2`),
`Python 3.12.3`, no pnpm / corepack entry (image readme, read today). The Chrome **path** on the runner and
WebGL2 under SwiftShader there are **unverified** (locally: Chrome 157.0.8103.38 at `/usr/bin/google-chrome`).

```yaml
# .github/workflows/pages.yml
name: pages

on:
  push:
    branches: [main]
  workflow_dispatch:        # manual re-run from the Actions tab (not in the design)

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false

env:
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'

jobs:
  build:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          package-manager-cache: false

      # pnpm comes from corepack; its version is pinned in app/package.json → "packageManager": "pnpm@12.18.0".
      # Every pnpm call runs in app/ (there is no package.json at the repository root).
      - name: pnpm
        run: corepack enable

      - name: Install
        working-directory: app
        run: pnpm install --frozen-lockfile

      # Checks on the full tree
      - name: Types
        working-directory: app
        run: pnpm typecheck

      - name: Lint
        working-directory: app
        run: pnpm lint

      - name: Unit tests
        working-directory: app
        run: pnpm test

      - name: Documents
        run: python3 tools/content/doccheck.py --all

      - name: Pages settings
        id: pages
        uses: actions/configure-pages@v6

      # Site profile: pruned copy → tsc → vite build → served under the Pages base path → browser check
      - name: Site profile
        env:
          BASE_PATH: ${{ steps.pages.outputs.base_path }}
        run: |
          export QA_CHROME="$(command -v google-chrome)"
          node tools/site/build.mjs --volume radio --out "$RUNNER_TEMP/site" --sub "${BASE_PATH#/}"

      - uses: actions/upload-pages-artifact@v5
        with:
          path: ${{ runner.temp }}/site

  deploy:
    needs: build
    runs-on: ubuntu-24.04
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v5
```

Facts behind each line:

| Line | Fact |
|---|---|
| `node-version: 24` | `README.md:36`; `@types/node` `24.9.2` in `app/package.json`; everything above was run with `v24.22.3` |
| `corepack enable` + `working-directory: app` | `"packageManager": "pnpm@12.18.0"` (`app/package.json:43`); the lockfile is `app/pnpm-lock.yaml`; locally `corepack pnpm -v` → `12.18.0` under Node 24. Baseline agent's install log: `Done in 91ms using pnpm v12.18.0` with a warm store |
| `package-manager-cache: false`, no `cache: pnpm` | `cache: pnpm` on `setup-node` needs `pnpm` on `PATH` before that action runs; the draft has no dependency cache (156 entries in `app/node_modules/.pnpm`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | `app/package.json:11,12,14`: `tsc -p tsconfig.json --noEmit`, `eslint . --max-warnings 0`, `vitest run` |
| `python3 tools/content/doccheck.py --all` | `README.md:46`. The Python tools import only the standard library (`sys re os json math unittest subprocess cmath copy`) and their own modules; `doccheck` also starts `node app/scripts/font-coverage.mjs` (`tools/content/doccheck.py:199-200,234`), so it has to come **after** the install. Baseline agent's log ends with `doccheck: ALL GREEN` |
| `configure-pages` before the build | supplies `base_path` (`/radio-pop-science`) for the smoke server and fails early when Pages is not set to «GitHub Actions» |
| `--out "$RUNNER_TEMP/site"` | keeps the checkout clean; `upload-pages-artifact` takes that directory as `path` |
| no `.nojekyll`, no `404.html`, no SPA fallback | routing is hash-only (`router.ts:1-4`): the server only ever receives `/radio-pop-science/` and static files under it — verified with a server that has no fallback. `upload-pages-artifact` drops dotfiles anyway; upstream has `.nojekyll` because it publishes from a branch |
| no `--base` | `base: './'` (`vite.config.ts:46`) |
| two jobs | `deploy` holds only `pages: write` + `id-token: write`; `build` keeps `contents: read` |

One-time owner action (`design:576-577`, `design:872`): Settings → Pages → Build and deployment → Source:
**GitHub Actions**. Until then `actions/configure-pages` fails.

## Risks

| # | Risk | Evidence | Weight |
|---|---|---|---|
| 1 | **Adding `app/src/volumes/radio/` turns the full-tree unit tests red** unless a platform test is edited: the list of volume directories is hard-coded there. The design promises green upstream tests with platform directories untouched | `app/src/engine/__tests__/volumes.test.ts:30`; reproduced: `1 failed \| 1602 passed (1603)`. Design: `design:171` («його тести й перевірки лишаються зеленими»), `design:552-556` (platform directories are not edited), `design:548` (the alias is the only addition named as required by the engine). Two ways out were checked mechanically: (a) add `'radio'` to that array — one line in a platform test, a merge conflict only when upstream changes the same line; (b) `vitest run -t '^(?!.*has the volumes this test knows about)'` — that single test is skipped, nothing is edited | blocks batch 1 and the `Unit tests` step of the workflow |
| 2 | A second new directory (a dev volume for sandboxes, e.g. `_radio`) hits the same test line again | same line; the `it.each(volumes)` rows then check it too | small |
| 3 | A volume whose only chapters are `dev: true` shows them on the public site: the registry falls back to dev chapters when nothing else is visible. A sandbox chapter added inside `radio` before the pilot exists would replace the lobby on the site | `app/src/engine/registry.ts:47-49` («Until real chapters exist a build would be empty: fall back to the dev chapters rather than to nothing.»). `design:818-819` wants the sandbox «поза подорожжю тому, якої немає у збірці сайту». A sandbox in a `_…` volume is removed by the profile; such a volume may import only `shared/**` of `radio`, not `sim/**` (`chapter-boundary.js:26-27`; `lint-chapter-boundary.test.ts:58`) | medium |
| 4 | After batch 1 the site does **not** show a labelled map of the planned chapters: a chapterless volume opens as the lobby — names, `emptyNote`, unlabeled plates; the reader cannot open the map with «у планах · ≈ N хв» (key `M` and clicks do nothing; hover not tested) | probe on the `radio` skeleton; `docs/VOLUMES.md:77-79,199-200`. Design: `design:571-572`, `design:791` («сайт із мапою всіх глав «у планах»») | expectation of the owner |
| 5 | The build is green for two broken profiles (stale `legacyVolume`, volume left `draft`); only the browser check catches them | failure-mode table | covered by the smoke step |
| 6 | The browser check on the hosted runner is unproven: Chrome path, WebGL2 with `--enable-unsafe-swiftshader`, speed on a small runner. Locally one ad-hoc run timed out (30 s waiting for `window.__app`) while another agent's `tools/qa/ui-check.mjs` was rendering in software at the same time | runner image readme lists Chrome 157 only; local runs 15–34 s (script), up to 1 min 42 s (8 loads). The script keeps one page open at a time and waits up to 60 s per stage | medium: a red smoke step blocks publishing |
| 7 | `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` are the latest tags, but their combination was not run; official examples still pair `v5` / `v4` / `v4` | web lookups above | small |
| 8 | Pages must be enabled by the owner first; whether the repository is public (or the plan allows Pages for a private one) was not checked | `design:872`; `git remote -v`: `origin git@github.com:Codir/radio-pop-science.git` | owner action |
| 9 | A link into a volume this site lacks (from the main course, or mistyped) silently opens the first step of the volume, with no notice | smoke scenario «removed volume»; `nav.ts:268-283` | engine behaviour |
| 10 | The `localStorage` key is `electricity:v2` for every copy of the engine and is scoped to the origin `codir.github.io`, i.e. shared with any other project site of that account built on this engine | `app/src/engine/store.ts:156-157`; the stale-record scenarios pass (a foreign `last` is ignored) | small |
| 11 | `tsconfig.json` in the copy keeps aliases to deleted volumes; harmless today (`tsc` exit 0). A volume that imported another volume would break the profile build — lint forbids that for non-dev volumes | `local/volume-boundary`, `local/chapter-boundary` | small |
| 12 | Unit tests cannot run inside the profile copy (8 platform failures by construction; tests also read `../docs`, `../tools`) | recipe table | by construction: tests on the full tree |
| 13 | Upstream may later add its own `.github/` or `tools/site/`; today neither exists | `git ls-tree upstream/main` | small |

### Design doc vs code (this subsystem)

| Design line | Says | Code / probe |
|---|---|---|
| `design:171`, `design:552-556` | upstream's tests stay green; platform directories are not edited | `app/src/engine/__tests__/volumes.test.ts:30` must list `radio` (risk 1) |
| `design:175` | «Перевірено на копії рушія: збірка з одним томом проходить без правок платформи.» | confirmed for typecheck, lint, build and the browser; **not** for unit tests inside the copy (8 fail) |
| `design:558-559` | «Перевірка бібліотеки рушія вимагає рівно один опублікований том у головному потоці, і це `circuit`» | the «exactly one» assertion is in the QA tool `tools/qa/library-check.mjs:86` (`'exactly one published volume in the main flow'`); the unit test pins the config instead: `expect(config).toMatchObject({ defaultVolume: 'circuit', legacyVolume: 'electricity' })` (`volumes.test.ts:96`). The engine itself accepts several published volumes (`Library.multi`, `library.ts:76`) |
| `design:566` | «пише `library.json` з `defaultVolume: "radio"`» | must also remove `legacyVolume` (`library.ts:72-73`) |
| `design:567` and the probe task's «base path /radio-pop-science/» | build | no base path is needed (`vite.config.ts:46`); `--base=/radio-pop-science/` also works |
| `design:570-571` | one published volume = a stand-alone course, no shelf, no button to other volumes | confirmed (`home-start`, `home-map` only) |
| `design:571-572`, `design:791` | the map shows unbuilt chapters as «у планах · ≈ N хв», so the site has a face from batch 1 | true only inside the map overlay, which the chapterless lobby does not open (risk 4) |
| `design:574-575` | checks on the full tree: types, lint, tests, documents | the commands exist and are green today; tests turn red once `radio` is added (risk 1) |
| `design:773-775` | QA tools run against the profile build (`--base`, `--out`, `QA_ALLOW_SOFTWARE=1`) | the debug URL shape works on a profile build; `node tools/site/smoke.mjs --dist … --serve` provides the server |
| `docs/ARCHITECTURE.md:193` | `tools/deploy.sh` | the file does not exist in this copy |
