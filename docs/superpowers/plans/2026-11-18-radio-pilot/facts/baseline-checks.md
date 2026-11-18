# Baseline of the project's own checks on the untouched tree

Repository `/home/pilot/tmp/radio-science-pop`, `main` at `63fd42c` (4 commits ahead of `origin/main`), measured 2026-11-18 09:30–10:05 EET.
Machine: Ubuntu 24.04.4, i9-13900KS (32 threads), 46 GB RAM, no usable GPU (`nvidia-smi`: `Failed to initialize NVML: Driver/library version mismatch`).
All durations are wall-clock, one sample unless stated; the 5/15-minute load average was 13/17 during the QA part (other work on the machine), so treat timings as upper-ish bounds.

Paths used below:

```
REPO=/home/pilot/tmp/radio-science-pop
PLAN=/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/plan
OUT=$PLAN/qa-baseline          # every QA screenshot / report of this run
LOGS=$PLAN/baseline-logs       # full stdout+stderr of every command of this run (<name>.log)
SHIM=$PLAN/qa-shims            # my stand-ins for montage / identify / mogrify (not part of the repo)
```

Final `git -C /home/pilot/tmp/radio-science-pop status --porcelain`: **empty** (exit 0). No tool rewrote a tracked file; nothing had to be restored.
`git status --porcelain --ignored` at the end: `!! app/dist/`, `!! app/node_modules/` only (a `tools/content/__pycache__/` created by `unittest discover` / `pytest` was removed).

---

## Shell prelude

Verified in a clean non-interactive shell (`env -i HOME="$HOME" PATH=/usr/local/bin:/usr/bin:/bin bash --noprofile --norc -c '…'`):

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
```

Cost: 0.23 s. After it: `node -v` → `v24.22.3`, `corepack --version` → `0.36.0`, `pnpm` → `/home/pilot/.nvm/versions/node/v24.22.3/bin/pnpm` (a corepack shim, symlink to `../lib/node_modules/corepack/dist/pnpm.js`).

| Fact | Evidence |
|---|---|
| Node 24 is already installed; `nvm install 24` was not needed | `nvm ls`: `v22.22.2`, `v24.22.3`, `system`; `default -> 22` |
| Without the prelude the tool shell gets Node **v22.22.2** (nvm default alias) and a bare `env -i` shell gets `/usr/bin/node` **v18.19.1** | `command -v node` in both shells |
| pnpm is pinned by `app/package.json:43` `"packageManager": "pnpm@12.18.0"`; that version is already in the corepack cache (`~/.cache/node/corepack/v1/pnpm/12.18.0`), so nothing is downloaded | `pnpm --version` in `app/` → `12.18.0` (0.05 s) |
| **Outside `app/` the same `pnpm` shim runs 12.21.0** (corepack `lastKnownGood.json`), so every pnpm command must run with cwd `app/` | `pnpm -v` at the repo root and in `tools/` → `12.21.0`; in `app/` → `12.18.0` |
| No `.nvmrc` in the repo or in `app/`; no `"engines"` field in `app/package.json` | `ls`, `grep` |
| Equivalent prelude without sourcing nvm (0.00 s), also verified | `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0` |
| `python3` on the tool shell's PATH is `/home/pilot/venv-ardupilot/bin/python3` (3.12.3; numpy 2.5.1, scipy 1.17.1, PIL 11.1.0, pytest 9.1.1); `/usr/bin/python3` is 3.12.3 too (numpy 1.26.4, scipy 1.11.4, PIL 10.2.0) | `python3 --version`, imports |
| Chrome | `/usr/bin/google-chrome --version` → `Google Chrome 157.0.8103.38` |

Every command below was run as `cd <dir> && <prelude> && <command>`.

## Install

```bash
cd /home/pilot/tmp/radio-science-pop/app && pnpm install --frozen-lockfile
```

| Result | Value |
|---|---|
| Exit / duration | 0 / **0.14 s** (pnpm: `Done in 91ms using pnpm v12.18.0`) |
| Lockfile | `app/pnpm-lock.yaml` exists; `Lockfile is up to date, resolution step is skipped`; `✓ Lockfile passes supply-chain policies (verified 18h ago)` |
| Packages | `Packages: +154`, `Progress: resolved 154, reused 154, downloaded 0, added 154, done` |
| Store | hard links from `/home/pilot/.local/share/pnpm/store/v11` (174 MB, warm); `app/node_modules` 177 MB |
| Network | none used (warm store). A cold store needs the npm registry — not measured |
| `app/.npmrc` | `save-exact=true` |
| Binaries in `app/node_modules/.bin` | `eslint`, `eslint-config-prettier`, `playwright-core`, `prettier`, `tsc`, `tsserver`, `vite`, `vitest` |
| Tracked files touched | none |

Pinned versions (`app/package.json:19-42`): `three 0.187.0`, `typescript 6.0.3`, `vite 8.3.8`, `vitest 5.1.0`, `eslint 10.14.0`, `typescript-eslint 8.72.2`, `prettier 3.10.1`, `playwright-core 1.65.0`, `pngjs 7.0.0`, `fontkit 3.0.0`, `@types/node 24.9.2`.

## Static checks

All run in `/home/pilot/tmp/radio-science-pop/app`. Scripts are `app/package.json:7-18`.

| Command | Script | Exit | Duration | Result |
|---|---|---|---|---|
| `pnpm typecheck` | `tsc -p tsconfig.json --noEmit` | 0 | 6.0 s (2nd run 5.9 s) | no output |
| `pnpm lint` | `eslint . --max-warnings 0` | 0 | 9.0 s (2nd run 9.1 s) | no output |
| `pnpm test` | `vitest run` | 0 | 9.1 s (vitest `Duration 8.62s`) | `Test Files  146 passed (146)` / `Tests  1601 passed (1601)` |
| `pnpm build` | `tsc -p tsconfig.json --noEmit && vite build` | 0 | 7.8 s (vite `✓ built in 1.54s`) | `✓ 1712 modules transformed.`; `app/dist` 7.8 MB, 159 files in `dist/assets`, plus `dist/fonts`, `dist/index.html` |
| `pnpm fonts:check` | `node scripts/font-coverage.mjs` | 0 | 0.2 s | `font coverage: 273 distinct characters in on-screen copy of the chapter exports` / `OK: every character has a glyph in every face` / `OK: every character is in every web font stack (9 WOFF2 faces)` |
| `pnpm test src/engine/__tests__/qa-probes.test.ts` | one file | 0 | 0.30 s | `Test Files  1 passed (1)` / `Tests  3 passed (3)` |
| `pnpm test src/volumes/circuit` | one volume | 0 | 7.4 s | `Test Files  25 passed (25)` / `Tests  260 passed (260)` |
| `pnpm exec prettier --check "src/**/*.{ts,css}" "*.{ts,js,json,html}"` (not a project script; the globs of `pnpm format`) | — | **1** | 8.3 s | `[warn] Code style issues found in 761 files. Run Prettier with --write to fix.` |

Facts behind the table:

- vitest config is in `app/vite.config.ts:77-80` (`environment` :78, `include` :79): `environment: 'node'`, `include: ['src/**/*.test.ts']`. Test files per area: `volumes/electricity` 77, `volumes/circuit` 25, `engine` 14, `hud` 10, `hud-dom` 4, `text` 3, `fx` 3, `volumes/_path` 2, `style` 2, `kit` 2, `content` 2, `volumes/_demo` 1, `ui3d` 1.
- `node -e "console.log(typeof Worker)"` on v24.22.3 → `undefined`; `grep -rn "new Worker" app/src` → no hit (no Web Worker exists in the code base today).
- `app/tsconfig.json:19-23` `paths` lists `@/*`, `@electricity/*`, `@circuit/*`; `app/vite.config.ts:14-18` builds the `@<volume>` aliases from the directories of `src/volumes` that do not start with `_`.
- ESLint (`app/eslint.config.js`): ignores `dist/**`, `node_modules/**`, `public/**`, `scripts/**`; the TS rule block is `files: ['src/**/*.ts', 'vite.config.ts']`. `*.mjs` files under `app/src` (chapter `qa/` scripts) are linted too: `pnpm exec eslint --print-config src/volumes/circuit/chapters/prologue/qa/interactions.mjs` → `no-undef: [2, …]`, 0 globals — hence the `/* global process, console, window, document, … */` header those scripts carry.
- Chapter-only lint rules (`app/eslint.config.js:35-60`, `files: ['src/volumes/*/chapters/**/*.ts']`): `no-restricted-imports` (`@/engine/*` except `@/engine/api`; `gsap`), `local/chapter-boundary`, `no-restricted-properties` on `Date.now`, `performance.now`, `window.setTimeout`, `Math.random`. All `src/**/*.ts`: `setInterval` restricted, `no-console` except `warn|error|info`, `local/volume-boundary`.
- Build chunk names (`app/vite.config.ts:58-74`): `assets/chapter-<volume>-<id>-[hash].js`, `assets/volume-<volume>-[hash].js`, group `three`. The production build contains the dev volumes' chunks too (`chapter-_dev-_sandbox-ui-…js`, `volume-_path-…js`, …).

## Content tools

Python: `python3` = `/home/pilot/venv-ardupilot/bin/python3`, Python 3.12.3 (tools are standard-library only; `test_path_format.py` also passes with `/usr/bin/python3`). All run from the repo root. Every tool takes `--volume <id>` (default: `defaultVolume` of `app/src/volumes/library.json` = `circuit`) or `--all` (`tools/content/chapters.py:111-127`).

`tools/content/path_export.py` and `path_format.py` have **no `__main__`**: the path exporter is reached through the four usual entry points (`export_content.py`, `export_runtime.py`, `build_index.py`, `build_glossary.py`), each of which calls `C.run_volumes(main, path=PX.<kind>_main)` and takes `--check` (exit 1 when a file would change).

| Command | Exit | Duration | Last line(s) of output |
|---|---|---|---|
| `python3 tools/content/path_check.py --volume circuit` | 0 | 0.07 s | `path[circuit]: 9 chapter document(s), 47 step(s), 21 register term(s) — ok` |
| `python3 tools/content/path_check.py --volume _path` | 0 | 0.04 s | `path[_path]: 2 chapter document(s), 4 step(s), 3 register term(s) — ok` |
| `python3 tools/content/path_check.py` (no args = `circuit`) | 0 | 0.07 s | same as circuit |
| `python3 tools/content/path_check.py --all` | 0 | 0.07 s | `── volume circuit` … ok / `── volume _demo` `not a path volume` / `── volume electricity` `not a path volume` / `── volume _path` … ok |
| `python3 tools/content/path_check.py --volume _dev` | 0 | 0.04 s | `volume _dev has no documents yet (docs/volumes/_dev/chapters): nothing to do` |
| `python3 tools/content/path_check.py --volume radio` | **1** | 0.04 s | `unknown volume 'radio' (no app/src/volumes/radio/volume.json)` |
| `python3 tools/content/export_content.py --check --volume circuit` | 0 | 0.06 s | `path export[circuit]: 9 chapter(s), up to date` |
| `python3 tools/content/export_runtime.py --check --volume circuit` | 0 | 0.05 s | `path runtime[circuit]: 9 chapter(s), up to date` |
| `python3 tools/content/build_index.py --check --volume circuit` | 0 | 0.04 s | `path index[circuit]: 9 chapter(s), up to date` |
| `python3 tools/content/build_glossary.py --check --volume circuit` | 0 | 0.05 s | `path glossary[circuit]: 9 chapter(s), up to date` |
| the same four with `--volume _path` | 0 | 0.04–0.05 s each | `path export[_path]: 2 chapter(s), up to date` (and `runtime`, `index`, `glossary`) |
| `tools/content/regen.sh --volume circuit` (write mode) | 0 | 0.54 s | `path index[circuit]: 9 chapter(s), 0 file(s) written` / `path glossary…0 file(s) written` / `path export…0 file(s) written` / `path runtime…0 file(s) written`, then doccheck … `doccheck[circuit]: ALL GREEN` / `doccheck: ALL GREEN` |
| `tools/content/regen.sh --volume _path` (write mode) | 0 | 0.42 s | same shape, `2 chapter(s), 0 file(s) written`, `doccheck[_path]: ALL GREEN` |
| `python3 tools/content/doccheck.py --volume circuit` | 0 | 0.38 s | groups `path`, `typography`, `index`, `glossary`, `export`, `runtime`, `fonts` all `ok`; `doccheck[circuit]: ALL GREEN` / `doccheck: ALL GREEN` |
| `python3 tools/content/doccheck.py --volume _path` | 0 | 0.28 s | `doccheck[_path]: ALL GREEN` / `doccheck: ALL GREEN` |
| `python3 tools/content/doccheck.py --all` | 0 | 17.9 s | circuit, `_demo`, electricity (`25 chapter documents, 267 steps, 721 panel pages`, incl. `oracle-home`, `oracle-batt`, `oracle-heat`), `_path` — each `ALL GREEN`; `doccheck: ALL GREEN` |
| `python3 tools/content/doccheck.py` (no args = all volumes, `main_all`, `default_all=True`) | 0 | 17.9 s | `doccheck: ALL GREEN` |
| `python3 tools/content/doccheck.py --volume _dev` | 0 | — | `volume _dev has no documents yet (docs/volumes/_dev/chapters): nothing to do` / `doccheck: ALL GREEN` |
| `python3 tools/content/test_path_format.py` (the way its docstring says, line 3) | 0 | 0.05 s | `Ran 8 tests in 0.008s` / `OK` |
| `python3 tools/content/test_hotspot_ids.py` | 0 | 0.05 s | `Ran 9 tests` / `OK` |
| `python3 tools/content/test_simple_layer.py` | 0 | 0.07 s | `Ran 10 tests` / `OK` |
| `python3 -m unittest discover -s tools/content -p 'test_*.py'` | 0 | 0.08 s | `Ran 27 tests in 0.017s` / `OK` |
| `python3 -m pytest -q tools/content -p no:cacheprovider` | 0 | 0.47 s | `27 passed in 0.06s` |
| `python3 docs/volumes/circuit/check.py` | 0 | 0.04 s | `chapters 9 · steps 47 (chapter steps 39) · path terms 20 …` / `OK: 0 errors` |
| `python3 docs/volumes/circuit/check.py --selftest` | 0 | 0.04 s | `selftest: OK — both planted faults caught` |

Notes:

- "The dev sandbox volume" for the path format is `_path` (`app/src/volumes/_path/volume.json`: `"title": "Пісочниця шляху"`, `"status": "dev"`, `"format": "path"`, `"path": { "budgets": { "chapterSteps": [2, 8], "prologueSteps": [2, 5] } }`, journey `opening`, `_sandbox-path`, `_sandbox-flow`, `glow`, `practice`; two of them have documents). `_dev` has no documents; `_demo` is `classic`.
- `tools/content/regen.sh` (13 lines): `build_index.py`, `build_glossary.py`, `export_content.py … --quiet`, `export_runtime.py`, then `doccheck.py … | tail -24`, under `set -euo pipefail`; scope is `--all` unless `--volume <id>`.
- `path_check.py` docstring advertises `[--selftest]` (line 14) but the file contains no handling of it (`grep -n selftest tools/content` → only that line).
- `doccheck.py` group `fonts` shells out to `node ../../app/scripts/font-coverage.mjs --volume <id>` (`doccheck.py:198-202`, `:234`, `:261`), i.e. it needs Node on PATH and `app/node_modules` (`fontkit`).
- `doccheck.py --all` / no args only visits volumes that have both `docs/volumes/<id>/chapters/` and `app/src/volumes/<id>/volume.json` (`chapters.py:37-42`). `docs/volumes/radio/` today holds `CURRICULUM.md`, `NOTES.md`, `VOLUME.md` and no `chapters/`.
- `unittest discover` and `pytest` write `tools/content/__pycache__/` (git-ignored by `__pycache__/`); running a test file directly does not.
- Budgets the checker enforces (`path_check.py:26-27`): `BUDGETS = dict(chapterSteps=(4, 8), prologueSteps=(4, 5), chapterTerms=6, stepTerms=2, ideaWords=(25, 32), textWords=(80, 90), nowLines=3)`, overridable per volume through `volume.json → path.budgets` (`path_check.py:49-52`).

## Browser QA

### How the tools find the server, the output directory and the browser (`tools/qa/lib.mjs`)

| Thing | Rule | Line |
|---|---|---|
| Base URL | `--base <url>` else `http://localhost:${args.port ?? process.env.QA_PORT ?? 5201}/` | `lib.mjs:70-73` |
| Output | `--out <path>` else `/srv/electricity/qa/${process.env.QA_ID ?? 'misc'}` — `/srv/electricity` does not exist here | `lib.mjs:80-82` |
| Browser | `process.env.QA_CHROME ?? '/usr/bin/google-chrome'`, headless | `lib.mjs:135-137` |
| Chrome flags | `GPU_ARGS` = `--use-angle=vulkan --enable-gpu --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --force-color-profile=srgb --autoplay-policy=no-user-gesture-required`; `QA_CHROME_ARGS` (space-separated) replaces them | `lib.mjs:27-35`, `:134` |
| GPU assertion | `if (!/nvidia/i.test(gpu.renderer) && !process.env.QA_ALLOW_SOFTWARE) throw new Error(\`WebGL is not running on the NVIDIA GPU (renderer: "…"). Check the Chrome GPU flags.\`)` | `lib.mjs:160-162` |
| URL every tool opens | `?debug&overlay=0&noaudio&q=<tier>[&hud=…][&freeze=<s>]#/<route>` — `debug` is always set, so dev volumes are always registered | `lib.mjs:100-108` |
| Interface renderer | `--hud dom|gl` or `QA_HUD`; default is the app's (`dom`) | `lib.mjs:51-58`, `:163-169` |
| Routes | `<volume>/<chapter>/<step>` or short `<chapter>/<step>`; short chapter ids resolve legacy volume → default volume → others | `lib.mjs:115-123` |

None of the tools starts a server. `tools/dev-start.sh` cannot be used here: it hard-codes `/srv/electricity/wt/<id>/app` / `/srv/electricity/repo/app`, uses `tmux` (not installed) and logs to `/srv/electricity/logs`.

### Server: how it was started and stopped

`app/vite.config.ts:51-52` sets `server: { host: '0.0.0.0', strictPort: true }` and `preview: { host: '0.0.0.0', strictPort: true }` and no port; I bound to loopback explicitly.

```bash
# preview of the production build (needs `pnpm build` first) — used for every run below unless stated
cd /home/pilot/tmp/radio-science-pop/app && <prelude> && \
  (setsid nohup pnpm preview --host 127.0.0.1 --port 5377 --strictPort > $LOGS/preview-5377.log 2>&1 < /dev/null &)
for i in $(seq 1 60); do curl -fsS -o /dev/null http://127.0.0.1:5377/ && break; sleep 0.25; done     # up after ≈ 0.3 s

# dev server
(setsid nohup pnpm dev --host 127.0.0.1 --port 5378 --strictPort > $LOGS/dev-5378.log 2>&1 < /dev/null &)   # up after ≈ 0.4 s, "VITE v8.3.8  ready in 74 ms"

# stop (by listening port)
kill $(ss -ltnpH 'sport = :5377' | grep -o 'pid=[0-9]*' | cut -d= -f2)
```

- `$!` of the backgrounded `pnpm` is **not** the server: the listener is a grandchild (`pnpm-native … → sh -c … → node …/vite/bin/vite.js preview --host 127.0.0.1 --port 5377 --strictPort`).
- `pkill -f 'vite.js preview --host 127.0.0.1 --port 5377'` typed in the same `bash -c` line killed the calling shell too (exit code 144): the pattern matches the shell's own command line. The port-based `kill` above is what worked.
- Port **5351** is taken on this machine by another project's preview (`/home/pilot/tmp/nuclear-alchemy/app`, `vite preview --port 5351 --strictPort`, up for 15 h). 5377 and 5378 were free.
- `http://localhost:<port>/` (what `--port` builds) reaches a server bound to `127.0.0.1`.

### What the renderer is here

| Flags | `__app.gpu().renderer` | One `shot.mjs` at 1920×1080 `high` |
|---|---|---|
| default `GPU_ARGS`, no `QA_ALLOW_SOFTWARE` | — | exit 1, 4.7 s: `shot failed: WebGL is not running on the NVIDIA GPU (renderer: "ANGLE (Mesa, Vulkan 1.4.318 (llvmpipe (LLVM 20.1.2 256 bits) (0x00000000)), llvmpipe)"). Check the Chrome GPU flags.` |
| default `GPU_ARGS`, `QA_ALLOW_SOFTWARE=1` | `ANGLE (Mesa, Vulkan 1.4.318 (llvmpipe (LLVM 20.1.2 256 bits) (0x00000000)), llvmpipe)`, `webgl2: true`, `maxTextureSize: 16384` | exit 0, **2.6 s**; `1920x1080 high · 198 calls · 217.1k tris · t=3.00` — picture correct (checked by eye: `$OUT/shot/circuit-prologue-click-default-args.jpg`) |
| `QA_CHROME_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --force-color-profile=srgb --autoplay-policy=no-user-gesture-required"` + `QA_ALLOW_SOFTWARE=1` | `Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) …` | exit 0, 10.1 s |
| `QA_CHROME_ARGS="--no-sandbox --hide-scrollbars --force-color-profile=srgb"` + `QA_ALLOW_SOFTWARE=1` | same SwiftShader | exit 0, 12.7 s |

So the default flags already land on Mesa lavapipe (`/usr/share/vulkan/icd.d/lvp_icd.json` is installed) and that is ≈ 4× faster than SwiftShader. `QA_ALLOW_SOFTWARE=1` relaxes **only** the renderer-string assertion; no budget, threshold or assertion of any tool changes with it.

### Runs (cwd = repo root, prelude applied, preview on 5377 unless stated)

| # | Command (env in front) | Exit | Duration | Outcome |
|---|---|---|---|---|
| 1 | `QA_ALLOW_SOFTWARE=1 node tools/qa/chapter-check.mjs circuit/prologue --port 5377 --out $OUT` | **1** | **338.8 s** | `FAILED circuit/prologue: 6 problem(s)`: 2 × `contact sheet failed` (`sheet.sh: line 24: montage: command not found`), 4 × perf (`click @1920x1080: min avg frame 97.07 ms … > 8 ms`, `dive` 74.96, `riddle` 80.55, `map` 74.88). Deep links, sequential, random + spam, layout at 1920×1080 and 1280×720, hue families, leaks (`geo 51 tex 25 prog 105 → geo 50 tex 25 prog 105 → …`), console, third-party requests (`{total: 389, thirdParty: 0}`): all clean |
| 2 | `QA_ALLOW_SOFTWARE=1 node tools/qa/chapter-check.mjs circuit/prologue --port 5377 --skip perf --out $OUT/skip-perf` | **1** | 29.2 s | `FAILED circuit/prologue: 2 problem(s)` — only the two contact sheets |
| 3 | `PATH="$SHIM:$PATH" QA_ALLOW_SOFTWARE=1 node tools/qa/chapter-check.mjs circuit/prologue --port 5377 --skip perf --out $OUT/shim` | 0 | 33.1 s | `PASS circuit/prologue — report: …/shim/circuit-prologue/report.json` |
| 4 | same as 3 with `--port 5378 --out $OUT/dev` (dev server) | 0 | 30.5 s, 29.4 s | `PASS circuit/prologue` (twice) |
| 5 | `QA_ALLOW_SOFTWARE=1 node tools/qa/ui-check.mjs --port 5377 --no-perf --out $OUT` (interface `dom`, the app default) | **1** | 58.9 s | `FAILED ui-check: 6 problem(s)` — see "Failures" |
| 6 | `QA_ALLOW_SOFTWARE=1 node tools/qa/ui-check.mjs --port 5377 --no-perf --hud gl --out $OUT` | 0 | 107.6 s | `PASS ui-check`, 67 `ok` lines, 6 `note … regions overlap — column×navigator 384×3` (1024×768, 800×1200) |
| 7 | `QA_ALLOW_SOFTWARE=1 node tools/qa/ui-check.mjs --port 5377 --hud gl --out $OUT/ui-full` (with the HUD-cost part) | **1** | 286.8 s | `FAILED ui-check: 1 problem(s)`: `1920x1080: HUD frame cost ≤ 1.5 ms — 3.82 ms (63.52 → 67.34)`; at 4K the same check "passed" with `-8.94 ms (319.10 → 310.16)` (noise) |
| 8 | `QA_ALLOW_SOFTWARE=1 node tools/qa/mobile-check.mjs circuit/prologue --profiles pp --port 5377 --out $OUT/mobile` | **1** | 67.4 s | `mobile-check circuit/prologue: FAIL — 2 failure(s), 4 warning(s), 2 note(s)`: both failures are `contact sheet failed`; warnings are perf (`frame 39.82 ms > 16.6 ms on the mobile tier` …, render `611x1323`); notes: `prologue/click: the step holds the navigator back (nav.hiddenUntil) — «Далі» by touch not tested`, `single volume — no library level to test` |
| 9 | `QA_ALLOW_SOFTWARE=1 node tools/qa/volume-walk.mjs circuit --port 5377 --from prologue/riddle --until wire --out $OUT/volume-walk` | **1** | 43.7 s | `walked 2 steps, 3 border crossings`; `FAIL prologue/map → wire/atoms: a flash (light leaves both ends by 8)` (`walk.json`: `excursion 8.0936`, threshold `> 8`) |
| 10 | same, `--out $OUT/volume-walk-run2` and `-run3` | 0, 0 | 43.1 s, 43.4 s | `PASS` (excursions 5/3/0 and 0/0/0) — the run is **not stable** under software rendering: 1 failure in 3 |
| 11 | `QA_ALLOW_SOFTWARE=1 node app/src/volumes/circuit/chapters/prologue/qa/interactions.mjs --port 5377` | **1** | 139.0 s | `FAIL prologue interactions — 70/71 checks at 1280x720`; the one: `FAIL bar     «Далі»: the bar stays put, no frame jumps  [28 frames, largest frame step 0.00 px]` |
| 12 | `QA_ALLOW_SOFTWARE=1 node app/src/volumes/_path/qa/nav-scrub.mjs --port 5377` | **1** | 0.2 s | uncaught `EACCES … mkdir … path: '/srv/electricity/qa/_path-nav-scrub'` (no `--out`) |
| 13 | same with `--out $OUT/_path-nav-scrub` | 0 | 3.8 s | `PASS _path nav-scrub`, 13 `ok` |
| 14 | `PATH="$SHIM:$PATH" QA_ALLOW_SOFTWARE=1 node tools/qa/library-check.mjs --base http://127.0.0.1:5377/ --out $OUT` | 0 | 26.4 s | `PASS library-check`, 42 `ok` (incl. the production-only part, because `--base` is a preview) |
| 15 | `QA_ALLOW_SOFTWARE=1 node tools/qa/reset-check.mjs --port 5377 --out $OUT/reset-check` | 0 | 20.3 s | `PASS` (8 `ok`; real clock, `--from circuit/wire` default) |
| 16 | `QA_ALLOW_SOFTWARE=1 node tools/qa/a11y-check.mjs circuit/prologue/click --port 5377 --out $OUT` | 0 | 2.3 s | `PASS a11y circuit/prologue/click` (`Tab order (18)`, `names: 18 interactive, 18 named`, `contrast: 9 texts on plates (worst 5.21:1)`, `not covered (still WebGL, no DOM): callout-0`) |
| 17 | `QA_ALLOW_SOFTWARE=1 node tools/qa/shot.mjs circuit/prologue/click --port 5377 --size 390x844 --dpr 3 --touch --q auto --out $OUT/shot/circuit-prologue-click-phone.jpg` | 0 | 2.0 s | `679x1471 mobile · 186 calls · 217.0k tris · t=3.00` |

`$SHIM` holds three PIL scripts I wrote in the scratchpad (`montage`, `identify`, `mogrify`, `#!/usr/bin/python3`) that accept exactly the arguments `tools/qa/sheet.sh` passes; they are an experiment to prove that ImageMagick is the only thing between run 2 and exit 0, not a project tool.

### What each tool asserts, and what software rendering does to it

| Tool | Argument | Asserts (fails on) | Under llvmpipe here | Output |
|---|---|---|---|---|
| `chapter-check.mjs <chapter \| volume/chapter>` | options `--size WxH` (1920x1080), `--sizes all\|WxH,…`, `--also-size`, `--q` (high), `--freeze` (3), `--out`, `--port/--base`, `--other <chapter>`, `--budget` (8), `--no-perf-fail`, `--dpr2`, `--skip perf,leaks,random,layout,dpr2`, `--perf-rounds` (3), `--perf-frames` (90), `--min-text` (16), `--max-hues` (4), `--hud`, `--zoom`, `--mobile [profiles]` | deep link lands on the step; `drawCalls > 350`, `triangles > 1_500_000`; `> --max-hues` strong hue families; `__ui.offscreen()` non-empty at every size; world text `< 16` px-eq at 1280×720; interface text below `CAPTION_UNITS = 15`; region overlaps; sequential and random+spam end on the requested step; perf `best.frameAvg > 8 ms`; leak: `geometries/textures/programs` grew between return 1 and return 3; any console error **or warning**; page error; third-party request; **contact sheet failure** (`chapter-check.mjs:133-138`) | perf always fails (75–97 ms vs 8 ms; +≈ 5 min for 4 steps because `confirmPerf` re-samples 3× with 4 s pauses) → `--skip perf`. Everything else passes. `--no-perf-fail` only downgrades to a warning, the time is still spent. 1280×720 and 1920×1080 are always layout-checked | `<out>/<arg with / → ->/NN-<step>-<W>x<H>.jpg`, `random-NN-<step>.jpg`, `sheet-<W>x<H>.jpg`, `sheet-random.jpg`, `report.json` (keys `chapterId,size,sizes,quality,gpu,steps,perf,perf4k,layout,dpr2,leaks,failures,warnings,notes,zoom,requests`) |
| `ui-check.mjs` | **no route argument**: hard-wired to `_sandbox-ui/controls`, `/board`, `/overflow` and `_sandbox-micro` of the dev volume `_dev` (`ui-check.mjs:57`, `:120`, `:199`); `--size`, `--out`, `--no-perf`, `--hud`, `--zoom`, `--port` | click/drag/keyboard/map/spine/settings flows; targets ≥ 44 px-eq; no console errors or warnings; layout sweep at 1280×720, 1920×1080, 1024×768, 800×1200, 3840×2160, 1920×1080@2; HUD cost `≤ 1.5 ms`, `≤ 60` calls | HUD-cost part is meaningless (run 7) → `--no-perf`. With the default `dom` interface it fails for reasons unrelated to rendering (run 5) | `<out>/ui-check-dom/` (dom) or `<out>/ui-check/` (gl): `1-slider-drag.jpg … 5-board.jpg`, `sweep-<W>x<H>[@2x]-<step>.jpg`, `exception.jpg` |
| `mobile-check.mjs <chapter \| volume/chapter>` | `--profiles all\|pp,pa,pl,tp,tl` (`phone-portrait 390×844@3`, `phone-small 360×800@3`, `phone-landscape 844×390@3`, `tablet-portrait 820×1180@2`, `tablet-landscape 1180×820@2`), `--only/--skip steps,gestures,travel,rotation,perf`, `--budget` (16.6), `--perf-fail`, `--other`, `--extra k=v` | device classified (`formFactor`, `pointer coarse`), tier `mobile`, shell `sheet`/`side`, render ≤ pixel budget, nothing off screen, text ≥ 14 CSS px, targets ≥ 44 (48 tablets), gestures, travel, rotation, console clean, **contact sheets** | perf is a warning unless `--perf-fail`; everything else passed on `pp` | `<out>/<short chapter id>/m-<profile>-<step>[-<tab>].jpg`, `mobile-<profile>.jpg`, `mobile-<profile>-tabs.jpg`, `mobile-report.json` |
| `volume-walk.mjs <volume>` (default `circuit`) | `--size` (1280x720) or `--touch` (390×844, DPR 2), `--out`, `--no-back`, `--from <chapter/step> --until <chapter>`, `--map`, `--port/--base` | real clock, plain address `?noaudio`; per border: frame diff `mean > 6` or `block > 24`, `light.excursion > 8` ("a flash"), camera/light jumps within `SEAM = 18` frames of the swap, missing closing card, console **errors** (warnings ignored here), `walked N of total steps` (full walk only) | ≈ 30 frames/s at 1280×720; flash threshold borderline → flaky (1 of 3) | `<out>/<volume>-<W>x<H>/NNN-<dir>-<from>-<to>-{0-pressed,a-last,b-first,c-free,d-settled}.jpg`, `walk.json`; default out is `/srv/electricity/qa/volume-walk` (not `outRoot`) |
| `circuit/chapters/prologue/qa/interactions.mjs` | `--port`, `--size` (1280x720); no `--out` (writes nothing) | 71 checks: every goal by real pointer, takeaway only after the goal, console clean; one real-clock check `trail.length >= 60 && hop <= 2` over 2 s (`interactions.mjs:580-584`) | that check gets 28 frames → fails | stdout only |

Other tools present and not run: `perf.mjs`, `transition.mjs`, `robustness.mjs`, `color-check.mjs` (dev server only), `dom-cost.mjs`, `hud-sheet.mjs`, `snap.mjs` (`--compare` needs ImageMagick `compare`), `desk-toggle.mjs`, `xbrowser.mjs` and `webkit-smoke.mjs` (need Playwright's Firefox / WebKit: `~/.cache/ms-playwright` holds only `__dirlock`).

Screenshots of this run: `$OUT/circuit-prologue/`, `$OUT/skip-perf/circuit-prologue/`, `$OUT/shim/circuit-prologue/` (with sheets), `$OUT/dev/circuit-prologue/`, `$OUT/ui-check-dom/`, `$OUT/ui-check/`, `$OUT/ui-full/ui-check/`, `$OUT/mobile/prologue/`, `$OUT/volume-walk{,-run2,-run3}/circuit-1280x720/`, `$OUT/_path-nav-scrub/`, `$OUT/library/`, `$OUT/reset-check/`, `$OUT/a11y/`, `$OUT/shot/`.

## Failures on the untouched tree

Nothing fails in install, typecheck, lint, unit tests, build, fonts, the content tools or their tests. Everything red is in browser QA:

| Check | Failure text | Cause | Class |
|---|---|---|---|
| `chapter-check` (runs 1, 2), `mobile-check` (run 8) | `/home/pilot/tmp/radio-science-pop/tools/qa/sheet.sh: line 24: montage: command not found` → `FAIL contact sheet failed: Command failed: …/sheet.sh …` | ImageMagick is not installed (`montage`, `identify`, `mogrify`, `compare`, `convert`, `magick` all absent); `sheet.sh` needs `montage`, `identify`, `mogrify` and font `DejaVu-Sans` (the font is installed) | missing system package; turns the tool's exit code to 1 |
| `chapter-check` perf (run 1) | `FAIL click @1920x1080: min avg frame 97.07 ms (samples 121.70 / 97.07 / 100.51 / 111.81 / 107.74 / 99.57) > 8 ms` (and `dive`, `riddle`, `map`) | software rasteriser | environment |
| `ui-check --hud gl` with perf (run 7) | `FAIL 1920x1080: HUD frame cost ≤ 1.5 ms — 3.82 ms (63.52 → 67.34)` | software rasteriser | environment |
| `ui-check` default interface `dom` (run 5) | `FAIL no console errors or warnings — hud-dom: custom control 'legacy' has no 'dom' widget — drawn by the WebGL fallback` (also at 1280x720 and 1920x1080); `FAIL 1280x720: board and step column do not overlap — {"b":{…},"c":null}` (also 1920x1080); `FAIL exception: Cannot read properties of null (reading 'w')` at `1024x768 _sandbox-ui/overflow` | `__ui.locate('step-column')` / `'step-panel'` return null under the DOM interface; the sandbox logs a warning. Not a rendering effect: the same build passes with `--hud gl` (run 6) | state of the tree (tool vs default interface) |
| `volume-walk` short range (run 9; runs 10 pass) | `FAIL prologue/map → wire/atoms: a flash (light leaves both ends by 8)` | real clock at ≈ 30 fps; excursion 8.09 against the fixed `> 8` | environment, flaky |
| `prologue/qa/interactions.mjs` (run 11) | `FAIL bar     «Далі»: the bar stays put, no frame jumps  [28 frames, largest frame step 0.00 px]` | the check demands ≥ 60 `requestAnimationFrame` frames in 2 s of real time | environment |
| `_path/qa/nav-scrub.mjs` without `--out` (run 12) | `EACCES` `mkdir` `/srv/electricity/qa/_path-nav-scrub` | default output root | environment |
| `pnpm exec prettier --check …` | `Code style issues found in 761 files` | the tree is not prettier-clean (511 of them under `src/volumes/electricity`, 19 under `src/volumes/circuit`) | state of the tree; no project gate runs it |

Last 15 lines of the two longest failing logs are in `$LOGS/q-chapter-check-prologue-full.log` and `$LOGS/q-ui-check-noperf.log` (both reproduced in full in the table above — neither is longer than 50 lines).

## What a plan must not rely on here

| Do not rely on | Because (verified) | What did work |
|---|---|---|
| `node` / `pnpm` being right without the prelude | default Node is 22.22.2 (tool shell) or 18.19.1 (`env -i`); `pnpm` outside `app/` is 12.21.0 | the prelude + cwd `app/` |
| `pnpm format` | it is `prettier --write` over globs where 761 files currently differ | — |
| QA tools' default output | `/srv/electricity/qa/…` cannot be created (`EACCES`); `volume-walk`, `reset-check`, `desk-toggle`, `snap`, chapter scripts like `nav-scrub.mjs` have their own `/srv/…` defaults | `--out <dir>` on every call |
| QA tools' default port / a server being up | default 5201, nothing listens; no tool starts a server; `tools/dev-start.sh` needs `/srv/electricity` and `tmux` | `pnpm preview` / `pnpm dev` with `--host 127.0.0.1 --port <n> --strictPort`, stop by port |
| port 5351 | occupied by another project's preview | 5377, 5378 were free |
| an NVIDIA renderer | `nvidia-smi` broken; renderer is llvmpipe | `QA_ALLOW_SOFTWARE=1` (any non-empty value) on every QA command |
| exit 0 from `chapter-check` / `mobile-check` (and, by its code, `library-check.mjs:272-275`, whose `sheet.sh` call is outside any `try`) | no ImageMagick; installing it needs `sudo apt` | with stand-ins for `montage`/`identify`/`mogrify` first on `PATH`, `chapter-check … --skip perf` exits 0 in ≈ 30 s for a 4-step chapter |
| any frame-time budget (`chapter-check` perf, `ui-check` HUD cost, `mobile-check --perf-fail`, `perf.mjs`, `dom-cost.mjs`) | 75–97 ms/frame at 1920×1080 `high`, 37–45 ms on the phone profile | `--skip perf` (chapter-check, mobile-check), `--no-perf` (ui-check) |
| real-clock assertions (frames per second, flash excursion) | 28 rAF frames in 2 s; volume-walk failed 1 run in 3 | frozen-clock checks (`?freeze`, `__app.step`) gave the same verdicts in all four chapter-check runs |
| bit-identical screenshots between runs | of the 8 step JPEGs of `circuit/prologue`, 6 had the same md5 in all four runs (3 × preview, 1 × dev); `02-dive-1920x1080.jpg` came in two variants (63 pixels differ by more than 8 levels, inside the box 584,248–1185,856) — one variant in preview runs 1–2, the other in preview run 3 and the dev run; `01-click-1920x1080.jpg` differed in the dev run by 8 pixels | compare with a tolerance, not by hash |
| `ui-check.mjs` as a check of a volume's step | it only drives `_sandbox-ui` of `_dev`, and is red with the default `dom` interface | `--hud gl --no-perf` passes (108 s) |
| `volume-walk.mjs` for another volume's gated steps | `const GATES = { circuit: { 'prologue/click': 'switch' } };` (`volume-walk.mjs:26`); a step whose navigator waits throws `«Далі» waits for the goal of ${key} and the walk has no way to reach it` (`:271-272`) | — |
| `doccheck: ALL GREEN` as proof that a volume was checked | a volume without `docs/volumes/<id>/chapters/` prints `nothing to do` and still ends `doccheck: ALL GREEN`, exit 0; `--all` skips it silently | look for the `path[<volume>]: N chapter document(s), …` line |
| `tools/content/*.py --volume radio` today | `unknown volume 'radio' (no app/src/volumes/radio/volume.json)`, exit 1 | — |
| `$!` or `pkill -f` to manage the server | see "Server" above | kill by listening port |
| Web `Worker` in unit tests | `typeof Worker === 'undefined'` on Node 24.22.3; vitest `environment: 'node'`; no worker exists in `app/src` | — |
| documents the tools cite | absent in this copy: `docs/PATH_FORMAT.md`, `docs/VOLUME_STRUCTURE.md`, `docs/HUD_DOM.md`, `docs/MOBILE.md`, `docs/PLAN.md`, `docs/AGENT_GUIDE.md`, `docs/briefs/`, `docs/requests/`, `tools/deploy.sh` (named in `docs/ARCHITECTURE.md:193`); there is no `.github/` directory | — |
| Firefox / WebKit runs | no Playwright-managed browsers installed; installing needs network (`pnpm exec playwright-core install firefox webkit`) and possibly `sudo … install-deps` | — |

Needs by category:

| Need | Steps |
|---|---|
| Network | none in this run (pnpm store and corepack cache warm, Node 24 present). Would need it: cold `pnpm install`, a pnpm version not in the corepack cache, `nvm install 24` on a machine without it, Playwright Firefox/WebKit |
| sudo | installing ImageMagick or tmux; creating `/srv/electricity`; Playwright `install-deps` |
| Missing system packages | ImageMagick (`montage`, `identify`, `mogrify`, `compare`), `tmux`, `vulkaninfo`; present: `xvfb-run`, `curl`, `ss`, DejaVu fonts, Mesa lavapipe ICD |
