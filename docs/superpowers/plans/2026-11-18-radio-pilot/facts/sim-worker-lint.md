# Sim code, workers, lint and unit tests — facts for the radio signal model

Repository: `/home/pilot/tmp/radio-science-pop` at `63fd42c`. All paths below are repo-relative unless absolute.
Design doc = `docs/superpowers/specs/2026-11-17-radio-volume-design.md` (877 lines).

## 0. How this was verified

| What | How |
|---|---|
| Config, rules, engine, sims, QA tools | files opened in this run (line numbers quoted) |
| Lint behaviour on future `radio` paths | `eslint --stdin --stdin-filename src/volumes/radio/…` in `app/` (virtual files, nothing written) |
| Type behaviour | `tsc` 6.0.3 on a scratch project with the same `compilerOptions`, plus a scratch tsconfig that `extends` `app/tsconfig.json` and includes all of `app/src` (control run: 0 errors, ≈ 11 s) |
| Worker build, sub-path, vitest environment | scratch Vite project using the repo's installed Vite 8.3.8 / vitest 5.1.0, built and opened in headless Chrome 157.0.8103.38 under `/radio-pop-science/` |
| CPU throttling of a worker | scratch page + CDP in the same Chrome |

Scratch evidence (re-runnable, outside the repo):
`/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/simcheck-ts/` and
`/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/simcheck-vite/`
(`serve-check.mjs`, `throttle/check.mjs`, `src/volumes/radio/shared/link/__tests__/link.test.ts`).

`app/node_modules` did not exist when this run started and was installed by another agent at 09:33; `git status --short`
was empty at the end of this run. `pnpm lint` and `pnpm test` on the full tree were **not** run here (only targeted probes).

Installed versions (read from `app/node_modules/*/package.json`): TypeScript 6.0.3, Vite 8.3.8 (rolldown 1.2.19),
vitest 5.1.0 (`engines.node`: `^22.12.0 || ^24.0.0 || >=26.0.0`), ESLint 10.14.0, typescript-eslint 8.72.2, three 0.187.0.
Local Node: v22.22.2 (README.md:36: «Потрібні Node.js 24+ і pnpm.»). `packageManager`: `pnpm@12.18.0` (app/package.json:43).

Files the task named that do **not** exist in this copy: `app/vitest.config.*` (vitest is configured by the `test` key of
`app/vite.config.ts:77-80`), any `sim/` directory under `app/src/volumes/circuit/`, `tools/site/`, `.github/`,
`tools/deploy.sh` (named in docs/ARCHITECTURE.md:193), `docs/AGENT_GUIDE.md`, `docs/PATH_FORMAT.md`, `docs/MOBILE.md`,
`docs/HUD_DOM.md`, `docs/briefs/` (so the `S-sim` brief named in docs/VOLUMES.md:136 cannot be read).

Scripts (app/package.json:9-14):

```
"build": "tsc -p tsconfig.json --noEmit && vite build",
"typecheck": "tsc -p tsconfig.json --noEmit",
"lint": "eslint . --max-warnings 0",
"format": "prettier --write \"src/**/*.{ts,css}\" \"*.{ts,js,json,html}\"",
"test": "vitest run",
```

Prettier (app/.prettierrc.json): `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 110`, `tabWidth: 2`.
There is no format check in `lint` (`eslint-config-prettier` only switches formatting rules off, eslint.config.js:69).

---

## 1. Lint boundaries

Config: `app/eslint.config.js` (70 lines) + local plugin `app/eslint-rules/chapter-boundary.js` (153 lines).
Ignored: `dist/**`, `node_modules/**`, `public/**`, `scripts/**` (eslint.config.js:8). `tools/**` is outside `app/` and is not linted.
Base sets: `js.configs.recommended`, `...tseslint.configs.recommended` (not type-aware), `prettier` last.

### 1.1 Rule blocks

**Block A — `files: ['src/**/*.ts', 'vite.config.ts']`, globals `globals.browser`** (eslint.config.js:11-34)

| Rule | Setting |
|---|---|
| `@typescript-eslint/no-explicit-any` | `error` |
| `@typescript-eslint/consistent-type-imports` | `['error', { fixStyle: 'inline-type-imports' }]` |
| `@typescript-eslint/no-unused-vars` | `error`; `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, `caughtErrorsIgnorePattern: '^_'` |
| `@typescript-eslint/no-non-null-assertion` | `off` |
| `no-console` | `['error', { allow: ['warn', 'error', 'info'] }]` |
| `eqeqeq` | `['error', 'always']` |
| `prefer-const`, `no-var` | `error` |
| `no-restricted-globals` | `{ name: 'setInterval', message: 'Use the engine clock (ctx.clock / ctx.tweens), not timers.' }` |

**Block B — `files: ['src/volumes/*/chapters/**/*.ts']`** (eslint.config.js:35-62)

| Rule | Setting |
|---|---|
| `no-restricted-imports` | patterns: `group: ['@/engine/*', '!@/engine/api']` → `'Chapters import engine types from "@/engine/api" and use ChapterContext services.'`; `group: ['gsap', 'gsap/*']` → `'Use ctx.tweens (engine clock bound).'` |
| `local/chapter-boundary` | `error` |
| `no-restricted-properties` | `Date.now` → `'Use the engine clock (ctx.clock.time).'`; `performance.now` → same; `window.setTimeout` → `'Use ctx.tweens.delay().'`; `Math.random` → `'Use ctx.random (seeded) for deterministic QA.'` |

**Block C — `files: ['src/**/*.ts']`** (eslint.config.js:63-68): `local/volume-boundary: 'error'`.

Every configured rule is `error`; the policy is `--max-warnings 0` (app/package.json:12).

### 1.2 Who may import what

`chapter-boundary.js` definitions: `SHARED_IN_VOLUME = new Set(['sim', 'content', 'shared'])` (line 24); a "chapter file" is a
file with ≥ 4 path segments under `src/volumes/<v>/chapters/<id>/…` (`locate`, lines 47-52; "a file directly in chapters/
belongs to no chapter"); a dev volume is a directory starting with `_`; `showcase = (from, seg) => from.startsWith('_') &&
seg[1] === 'shared' && seg.length > 2` (line 27).

| Importer | Its own chapter | Another chapter, same volume | Own volume `sim/**`, `content/**`, `shared/**` | Other parts of own volume (`volume.ts`, `chapters.ts`, `fixtures/`…) | Another volume | Platform `@/…` | `@/engine/<x>` other than `api` |
|---|---|---|---|---|---|---|---|
| `volumes/<v>/chapters/<id>/**` | yes | **no** (`other`) | yes | **no** (`area`) | **no** (`volume` + `cross`); only a dev-volume chapter may import another volume's `shared/**` | yes, by alias only (a relative path into the platform → `leaves`) | **no** (`no-restricted-imports`) |
| `volumes/<v>/shared/**`, `sim/**`, `volume.ts`, tests outside chapters | (lint does not object) | (lint does not object) | yes | yes | **no** (`cross`) — also for dev volumes: `_dev/sim/x.ts → @circuit/shared/x` is rejected (`src/engine/__tests__/lint-chapter-boundary.test.ts:88-90`) | yes | **yes** — the engine restriction exists only in block B |
| platform `src/<lib>/**` | — | — | — | — | **no** (`platform`), except files directly in `src/` and directly in `src/volumes/` (chapter-boundary.js:143-145) | yes | yes |

Exact messages (chapter-boundary.js:83-89, 125-127):

```
leaves:   'Import "{{spec}}" leaves the chapter directory. Use "@/…" for the platform and "@<volume>/sim/…", "@<volume>/content/…", "@<volume>/shared/…" for the volume.'
other:    'Import "{{spec}}" reaches into another chapter ("{{target}}"). Chapters must not import other chapters.'
volume:   'Import "{{spec}}" reaches into another volume ("{{target}}"). A chapter uses only its own volume.'
area:     'Import "{{spec}}": a chapter may use only "sim/**", "content/**" and "shared/**" of its volume, not "{{target}}".'
cross:    'Import "{{spec}}" reaches into another volume ("{{target}}"). Volumes are independent.'
platform: 'Import "{{spec}}": platform code must not import a volume by name — volumes are discovered with import.meta.glob.'
```

Mechanics that matter for a worker:

- Only `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration`, `ImportExpression` with a string-literal source
  are visited (chapter-boundary.js:63-74). `new Worker(new URL('…', import.meta.url))` is **not** an import and is never checked.
- A `?worker` suffix stays in the resolved path; the area segment still decides (probe: a chapter importing
  `'../../../shared/link/model.worker?worker'` → no error).
- `@<volume>/…` is recognised only when `<volume>` is an existing directory under `src/volumes` at lint time
  (`volumeIds()` → `readdirSync`, lines 29-37; `resolveSpec`, lines 55-61).

### 1.3 Probe results on virtual `radio` files (`eslint --stdin`, run in `app/`)

| Virtual file | Code probed | Result |
|---|---|---|
| `src/volumes/radio/sim/core/probe.ts` | `import { Vector3 } from 'three'`, `Math.random()`, `Date.now()`, `performance.now()`, `setTimeout(…)`, `window.setTimeout(…)`, `requestAnimationFrame(…)` | **no error** |
| same | `setInterval(…)` | error `no-restricted-globals` |
| `src/volumes/radio/shared/link/model.worker.ts` | `import … from '../../sim/core/probe'`, `import { Clock } from '@/engine/clock'`, `performance.now()`, `self.onmessage = …`, `self.postMessage(x, { transfer: [] })` | **no error** |
| same | `console.log('x')`; `t == 1` | `no-console`; `eqeqeq` |
| same | `/// <reference lib="webworker" />` + `declare const self: DedicatedWorkerGlobalScope;` | **no error** (exit 0) |
| same | `const bad: any`; `// @ts-ignore`; bare `// @ts-expect-error`; unused `const unused`; `let` never reassigned; `var` | `no-explicit-any`; `ban-ts-comment` ("Use "@ts-expect-error" instead of "@ts-ignore"…"); `ban-ts-comment` ("Include a description after the "@ts-expect-error" directive… 3 characters or longer"); `no-unused-vars` ("Allowed unused vars must match /^_/u"); `prefer-const`; `no-var` |
| `src/volumes/radio/chapters/lines/scene.ts` | `'../../shared/link'`, `'../../sim/core/probe'`, `'@/engine/api'` | no error |
| same | `'../../volume'` | `area` |
| same | `'../prologue/parts/x'` | `other` |
| same | `'@/engine/clock'` | `no-restricted-imports` |
| same | `'../../../circuit/shared/stage'` | `volume` **and** `cross` (two errors) |
| same | `new Worker(new URL('../../shared/link/model.worker.ts', import.meta.url), { type: 'module' })` | no error |
| same | `Math.random()`, `performance.now()`, `Date.now()`, `window.setTimeout(…)` | `no-restricted-properties` |
| `src/volumes/radio/chapters/lines/steps/a.ts` | bare `setTimeout(…)`, `requestAnimationFrame(…)`, `queueMicrotask(…)` | **no error** (only the `window.setTimeout` property form is restricted) |
| `src/volumes/radio/sim/core/__tests__/fm.test.ts` | `import … from 'node:fs'`, `import ref from './fixtures/fm.json'`, `Math.random()` | no error |
| `src/volumes/radio/chapters/lines/qa/interactions.mjs` | `process`, `console`, `setTimeout` | `no-undef` ×3 — existing QA scripts start with `/* global process, console, window, setTimeout */` (`app/src/volumes/electricity/chapters/plant-hydro/qa/interaction.mjs:2`) |

### 1.4 What lint does not enforce

- Nothing in `sim/**` or `shared/**` forbids `three`, `Math.random`, `Date.now`, `performance.now`, `setTimeout`,
  `requestAnimationFrame`, DOM access. Those rules are documentation only: docs/ARCHITECTURE.md:70-71 ("pure-TS, unit-tested
  simulation models … no three.js imports"), :143-145; `app/src/volumes/electricity/sim/core/S2-sim/README.md:3` ("Pure
  TypeScript, no three.js / DOM / timers"); `…/S1-sim/rng.ts:2` ("Models never call `Math.random()`").
  Today 0 files under `app/src/volumes/electricity/sim` import `three` (grep), and no unit test asserts it.
- docs/ENGINE_API.md:600 lists "no `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`,
  `Math.random`" for chapters; lint covers only the four of block B plus `setInterval` (ENGINE_API.md:43-44 says so itself).
- No file-name rule. Layout that tools (not lint) depend on: test glob `src/**/*.test.ts` (vite.config.ts:79); chunk names from
  `volumes/<v>/chapters/<id>/scene.ts` and `volumes/<v>/chapters.ts` (vite.config.ts:63-69); one alias per non-`_` volume
  directory (vite.config.ts:14-18) which must be mirrored in `tsconfig.json → paths` — asserted by
  `app/src/engine/__tests__/volumes.test.ts:66-73`.
- Precedent for testing lint from vitest: `app/src/engine/__tests__/lint-chapter-boundary.test.ts:9-15`
  (`new ESLint({ cwd: appDir })`, `eslint.lintText(code, { filePath: `${appDir}/${file}` })`).

---

## 2. TypeScript settings that bite

`app/tsconfig.json` (26 lines), TypeScript 6.0.3. `include: ["src", "vite.config.ts"]` — test files and the worker file are
part of `pnpm typecheck` and of `pnpm build`.

| Setting | Value | Consequence for numeric typed-array / worker code |
|---|---|---|
| `strict` | `true` | all strict-family checks; closures over `let` state need explicit types |
| `noUncheckedIndexedAccess` | **not set** (never was in this file's history) | `a[i]` on `Float32Array`, `number[]`, `Record<string, number>` is `number`, not `number \| undefined` (probe compiles). The repo still writes `arr[i]!` widely (≈ 295 hits in `volumes/circuit`, ≈ 188 in `volumes/electricity/sim`; `no-non-null-assertion` is off); `electricity/sim/core/S1-sim/fft.ts` writes plain `re[b]`. Both compile. |
| `exactOptionalPropertyTypes` | `false` (line 11) | `{ x?: number }` accepts an explicit `undefined`; `Partial<Params>` spreads are fine |
| `verbatimModuleSyntax` | `true` | importing a type as a value is `TS1484: 'Req' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled`; write `import { type Req }` (lint's fix style) or `import type { Req }` |
| `isolatedModules` | `true` | type re-exports need `export type`; `--showConfig` adds `preserveConstEnums: true` |
| `lib` | `["ES2023", "DOM", "DOM.Iterable"]` — **no `WebWorker`** | in a worker file `self` is `Window & typeof globalThis`: `self.postMessage(out, [buf])` → `TS2769: No overload matches this call … Argument of type 'ArrayBufferLike[]' is not assignable to parameter of type 'string' … has no properties in common with type 'WindowPostMessageOptions'`. Three forms that compile here: (a) `self.postMessage(out, { transfer: [buf] })`; (b) a local interface + `const scope = self as unknown as WorkerScope`; (c) `/// <reference lib="webworker" />` + `declare const self: DedicatedWorkerGlobalScope;` — (c) was added to the whole app program in a scratch tsconfig: still 0 errors (`skipLibCheck: true`), and lint accepts it |
| `lib` level | ES2023 | `findLast`, `toSorted`, `.at()` compile; `Float16Array` → `TS2304`; `Promise.withResolvers`, `Object.groupBy` → `TS2550`; `new ArrayBuffer(8, { maxByteLength })` → `TS2554` |
| typed-array generics (TS 6) | — | the annotation `Float32Array` means `Float32Array<ArrayBufferLike>`; `new Float32Array(n)` is `Float32Array<ArrayBuffer>`. Returning the former where the latter is declared is `TS2322 … Type 'SharedArrayBuffer' is not assignable to type 'ArrayBuffer'`; so is `const b: ArrayBuffer = a.buffer`. `[a.buffer]` as `Transferable[]`, `worker.postMessage(x, [a.buffer])` and `new DataTexture(data: Uint8Array, 128, 96, RedFormat, UnsignedByteType)` (three 0.187 typings) compile with the plain annotation |
| `noFallthroughCasesInSwitch` | `true` | a `switch (msg.kind)` case without `break`/`return` → `TS7029` |
| `noImplicitOverride` | `true` | overriding a member without `override` → `TS4114` |
| `types` | `["vite/client"]` | gives `import.meta.url`, `import.meta.env`, and the `*?worker`, `*?worker&inline`, `*?worker&url` module declarations (`node_modules/vite/client.d.ts:211-228`: `new (options?: { name?: string }): Worker`) |
| Node globals | leak into the app program | a file using `process.pid` / `Buffer.from` added to the full app program type-checks (0 errors), although `types` lists only `vite/client`. `tsc` will not catch Node-only API use in sim or worker code |
| `resolveJsonModule` | `true` | `import ref from './fixtures/x.json'` works in tests |
| `moduleResolution` / `paths` | `bundler`; `@/*`, `@electricity/*`, `@circuit/*` (lines 19-23) | a new line `"@radio/*": ["./src/volumes/radio/*"]` is required — `volumes.test.ts:66-73` asserts `paths['@<dir>/*']` equals `['./src/volumes/<dir>/*']` for every non-`_` volume directory |
| `target`, `useDefineForClassFields`, `skipLibCheck`, `noEmit` | `ES2022`, `true`, `true`, `true` | — |
| not set | `noUnusedLocals`, `noUnusedParameters` (lint does it), `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly` | — |

---

## 3. Sim module pattern

### 3.1 Layout of the legacy volume

`app/src/volumes/electricity/sim/`: 26 directories, 46 test files.

| Directory | Contents |
|---|---|
| `core/S1-sim/` | 17 modules + `index.ts` barrel (`export * from './rng'` …, index.ts:5-20) + `__tests__/{core,mna,stability}.test.ts` |
| `core/S2-sim/` | 11 modules + `README.md`, no barrel — "Import with `@electricity/sim/core/S2-sim/<file>`" (README.md:3) + `__tests__/` |
| `core/S3-sim/` | modules only (`battery.ts`, `pv.ts`, `home/…`); tested from `sim/lab-*/__tests__/` |
| `<chapter-id>/` | modules, `index.ts` barrel, `README.md` (table `Step \| Model \| API` + a usage snippet for the chapter builder), `__tests__/*.test.ts` |

`circuit` (the path-format reference volume) has **no** `sim/`: its pure logic sits in `shared/**` next to three.js code
(e.g. `shared/copper/run.ts`, `shared/stage/bulb-heat.ts`) and in chapters (`chapters/build/parts/circuit.ts`), each with
`__tests__/`; those tests import `three` freely (`shared/world/__tests__/dive.test.ts:1`).

### 3.2 Anatomy of a stateful model — `electricity/sim/magnetism/dc-motor.ts`

```ts
export const DC_MOTOR = { coilConstant: 50 * 0.3 * 0.0012, …, voltageRange: { min: 0, max: 12, step: 0.5, default: 6 }, … } as const;   // :12-21
export interface MotorParams { voltageV: number; loadTorqueNm: number; mode: 'commutator' | 'slipRings'; jammed: boolean }               // :25-31
export interface MotorState { angleRad: number; omegaRadPerS: number; … }                                                               // :33-45
export function motorSteadyState(voltageV: number, loadTorqueNm: number): { … } | null                                                  // :48  closed form, used by tests
export interface DcMotor {                                                                                                              // :60-66
  readonly state: MotorState;
  readonly params: MotorParams;
  step(dt: number): MotorState;
  set(params: Partial<MotorParams>): void;
  reset(): void;
}
export function createDcMotor(initial: Partial<MotorParams> = {}): DcMotor                                                              // :68
```

- Header comment carries the formulas, constants and the chapter-document section (lines 1-9) — docs/ARCHITECTURE.md:145:
  "Physical formulas and constants are cited in comments."
- `step(dt)` sub-steps internally: `const n = subStepCount(dt, 5e-4, 80); const h = dt / Math.max(n, 1);` (:132-134);
  `publish()` rewrites the same `state` object every call (:78-95).
- Typed arrays in state: `electricity/sim/magnetism/domains.ts:18-31` (`Float64Array`, `Int8Array`);
  seeds are injected: `export function createDomains(rng: RandomSource | number = 5): DomainModel` (:41).
- In-place flat arrays: `circuit/shared/copper/run.ts:14-22`
  `export function accelerate(pos: Float32Array, dir: Float32Array, e: number, speed: number, field: number, dt: number, top: number): number`
  ("positions and unit directions, 3 numbers per electron").

Time helpers (not importable from `radio`, see §5):

```ts
// electricity/sim/core/S1-sim/math.ts:78
export function subStepCount(dt: number, maxStep: number, maxCount = 1000): number
// electricity/sim/core/S2-sim/math.ts:112-127 — "converts arbitrary frame `dt` into whole internal steps of `h`, carrying the
// remainder, so a time-domain model gives identical results whatever the frame rate (deterministic QA)"
export class FixedStepper { constructor(public readonly h: number); advance(dt: number): number; reset(): void }
// electricity/sim/core/S1-sim/fft.ts:3-13 — allocates two Float64Array per call; radix-2 for powers of two, O(N²) DFT otherwise
export interface Spectrum { re: Float64Array; im: Float64Array }
export function fft(samples: ArrayLike<number>): Spectrum
```

Heavy work on the main thread today: `electricity/chapters/lab-inverter/sim-bindings/wave-lab.ts:5-7` — "Everything is
recomputed lazily, once, when a setting changed … a full 65 536-point analysis costs ≈ 5 ms, so sliders may call `set()` on
every move while the frame pays once."

### 3.3 How sims are tested

| Fact | Evidence |
|---|---|
| Runner | `vitest run`; config `test: { environment: 'node', include: ['src/**/*.test.ts'] }` (vite.config.ts:77-80). No setup files, no `globals`, no pool or worker options, no `define` |
| Location and name | all 146 test files are `__tests__/*.test.ts` (0 elsewhere, 0 `.spec.ts`) |
| Imports | 146/146 import `describe, expect, it` (two add `beforeAll`/`beforeEach`, one `vi`) explicitly from `'vitest'` |
| Timeout | vitest default 5000 ms (`node_modules/vitest/dist/chunks/cac.BYbt0aJp.js:1022-1023`); no existing test sets one. Both `it(name, { timeout: N }, fn)` and `it(name, fn, N)` work in 5.1.0 (probe) |
| Fixtures | control-point numbers are hard-coded from the chapter documents (docs/DECISIONS.md:39-42: "chapter documents' control-point values are the test fixtures"). No sim test reads a data file (grep for `readFileSync` / `.json'` under `electricity/sim`: none) |
| Python oracles | `tools/ref-models/C6-labs/{home,battery,thermal}_model.py --check`, listed in `app/src/volumes/electricity/volume.json:49-56` (`docs.checks`) and run by `tools/content/doccheck.py:235-236` — classic format only (see §7 M12). Python 3.12.3, numpy 2.5.1, scipy 1.17.1 are installed here |
| Reading files in tests (precedent) | `readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/plant-gas.md', import.meta.url), 'utf8')` (`electricity/chapters/plant-gas/__tests__/labels.test.ts:13`); `import.meta.glob(…, { eager: true })` (`engine/__tests__/volumes.test.ts:11`) |
| Helper idioms | `const run = (step, seconds, dt = 1 / 30) => { for (let t = 0; t < seconds - 1e-9; t += dt) step(dt); }` (`magnetism/__tests__/dynamics.test.ts:23-25`); NaN sweep `finite(o)` at `DT = 1 / 30` with a seeded RNG (`core/S1-sim/__tests__/stability.test.ts:16-27`, header: "time-domain models stay stable for dt up to 1/30 s and never produce NaN/Infinity for in-range inputs"); `it.each([...])` tables; `toBeCloseTo(value, digits)` |

A short real test, copied (`app/src/volumes/electricity/sim/core/S1-sim/__tests__/core.test.ts:37-46`):

```ts
  it('rng is deterministic per seed and in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
```

And one on typed arrays (`app/src/volumes/circuit/shared/copper/__tests__/run.test.ts:6-15`):

```ts
  it('speeds up toward −X and bends its path that way', () => {
    const pos = new Float32Array([0, 0, 0]);
    const dir = new Float32Array([0, 1, 0]);
    let v = 5;
    for (let i = 0; i < 30; i++) v = accelerate(pos, dir, 0, v, 9, 1 / 60, 100);
    expect(v).toBeGreaterThan(5);
    expect(dir[0]).toBeLessThan(-0.3);
    expect(pos[0]).toBeLessThan(0);
    expect(Math.hypot(dir[0]!, dir[1]!, dir[2]!)).toBeCloseTo(1, 5);
  });
```

---

## 4. Workers today

### 4.1 There are none

Grep over `app/src`, `tools`, `app/vite.config.ts`, `app/index.html`, `app/scripts`, `app/eslint*`:

| Pattern | Hits |
|---|---|
| `new Worker`, `?worker`, `SharedArrayBuffer`, `OffscreenCanvas`, `postMessage`, `WebAssembly`, `requestIdleCallback`, `MessageChannel`, `queueMicrotask` | **0** |
| `setInterval` | only the lint rule (eslint.config.js:31) |
| word "worker" | kit/chapter comments about people, and `electricity/sim/charge-field/README.md:23`: "Recompute lines at ≤ 30 Hz while dragging (≈ 50 lines × 400 RK4 steps is a few ms; a worker is optional)." |
| `import.meta.url` | tests and QA scripts (file paths), `vite.config.ts:8,49`, `eslint-rules/chapter-boundary.js:21`; never for a worker |
| `performance.now` | platform only: `engine/app.ts:586,615,628`, `engine/runtime.ts:673,719,721`, `engine/quality.ts:228,232`, `engine/input.ts:489,550`, `engine/debug/overlay.ts:126`, `hud/touch/sheet.ts`, `hud-dom/touch/*`, `hud-dom/charts/chart.ts:170`, `ui3d/widgets/scroll.ts`; one dev sandbox (`_dev/chapters/_sandbox-ui/parts/dom-widgets.ts:111,114`); QA tools |
| `Math.random` | comments only (5 hits) |
| `Date.now` | `audio/qa/audio-check.mjs`, QA tools, `scripts/build-fonts.mjs`; one comment in `engine/examples/minimal-chapter/scene.ts:68` |
| `setTimeout` | `hud-dom/chrome/tooltips.ts:102`, `engine/boot-ui.ts:83`, `engine/debug/api.ts:263`, two engine tests (`flush`), QA scripts |
| `requestAnimationFrame` | `engine/app.ts:569,578` (the loop), `hud-dom/**` (5), QA |

`app/index.html` has no Content-Security-Policy. docs/ARCHITECTURE.md:13-14: "The app is served over plain HTTP on a LAN …
do not rely on secure-context-only APIs (WebGPU, service workers, clipboard, SharedArrayBuffer)."

### 4.2 What Vite needs (verified on a scratch project mirroring `app/vite.config.ts`: `base: './'`, alias `@` and `@radio`, `build.target: 'es2022'`, the same `rolldownOptions.output`, **no `worker` key**)

`app/vite.config.ts` needs no change. Without a `worker` key the defaults apply: `worker: { format: "iife", … }`
(`node_modules/vite/dist/node/chunks/node.js:37371-37372`, `:37767`). Worker bundles are written with
`entryFileNames: path.posix.join(config.build.assetsDir, "[name]-[hash].js")` (same file, `bundleWorkerEntry`); the main
config's `chunkFileNames` function (vite.config.ts:63-69) is not applied to them.

| Source form | Build output | Worker kind in build / dev | Extra file |
|---|---|---|---|
| `new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' })` | ``new Worker(new URL(new URL(`model.worker-BjSz-PtM.js`,import.meta.url).href,``+import.meta.url),{type:`module`})`` | `{ type: 'module' }` kept; the file itself is an IIFE | `assets/model.worker-<hash>.js` |
| `import ModelWorker from './model.worker?worker'` → `new ModelWorker()` | ``new Worker(new URL(`model.worker-BjSz-PtM.js`,import.meta.url).href,{name:e?.name})`` | classic in a build, module in dev (`node.js:26258`: `workerType = isBundled ? format === "es" ? "module" : "classic" : "module"`) | same |
| `import ModelWorker from './model.worker?worker&inline'` | Blob URL (fallback `data:` URL) built from an embedded string | classic | none; the chapter chunk grew 0.88 → 1.73 kB in the toy |

Verified facts:

- All three builds pass and run in headless Chrome 157 served under `/radio-pop-science/`: the worker was fetched from
  `/radio-pop-science/assets/model.worker-BjSz-PtM.js` (URL relative to the importing chunk, so it works from any sub-path) or
  from a `blob:` URL (inline form); the page got the reply; the synchronous path with `?freeze=3` gave the same result.
- The alias `@radio/sim/core/model` imported **inside the worker** resolved without any `worker.plugins` setting.
- The worker bundle is one self-contained IIFE: the sim core is bundled twice (once in the worker file, once in the chunk
  that holds the synchronous fallback).
- `tools/qa/lib.mjs:184-194` `thirdPartyRequests` ignores `data:`, `blob:`, `about:` and same-origin URLs, so none of the
  three forms trips chapter-check's "third-party request" failure (chapter-check.mjs:319-320).
- Not tested here: the Vite dev server (the QA tools default to a dev server on port 5201, lib.mjs:72), Firefox, Safari, and a
  worker that uses dynamic `import()` under the default `iife` format (`node.js:26141` rewrites an `INVALID_OPTION`
  "output.format" error to "worker.format", so such an error path exists).

### 4.3 What vitest can do in this config

Measured under vitest 5.1.0, `environment: 'node'`, Node 22.22.2:

| Check | Result |
|---|---|
| `typeof Worker`, `typeof window`, `typeof document`, `typeof globalThis.location`, `typeof self` | all `'undefined'` |
| `typeof performance.now`, `typeof structuredClone` | `'function'` |
| `import.meta.env.MODE` | `'test'` |
| importing a worker entry whose top level touches `self` | `ReferenceError: self is not defined` |
| importing a module that contains `new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' })` behind `typeof Worker === 'undefined'` | fine; the test reaches the synchronous path |
| `structuredClone(req, { transfer: [req.luma.buffer] })` | copy keeps `Uint8Array`; the source array is detached (`length` 0), as after a real transfer |

`@vitest/web-worker` is not in `app/pnpm-lock.yaml`; `jsdom` / `happy-dom` appear there only as optional peers of vitest
(pnpm-lock.yaml:1081-1105). So a test cannot start a Worker in this config: it must call the worker's message handler as a
plain function (handler in its own module, the worker entry a few lines that bind `self.onmessage`).

### 4.4 CPU throttling and workers (measured, Chrome 157.0.8103.38)

| Setting | Main thread | Dedicated worker |
|---|---|---|
| none | 1549–2405 ms | 1537–2017 ms |
| `Emulation.setCPUThrottlingRate { rate: 4 }` on the page session | 7231–8426 ms | 2001–2193 ms |
| same command relayed to the worker's session | — | reply `{"error":{"code":-32000,"message":"Operation is only supported for pages, not workers"}}`; 2055–2321 ms |

No tool under `tools/qa` uses `setCPUThrottlingRate` (grep), and none measures anything inside a worker.

---

## 5. Determinism and randomness

### 5.1 Rules as written

| Rule | Where |
|---|---|
| "all animation runs on the engine clock (`dt`, `t`), which can be paused/stepped/scaled by the debug API for deterministic QA. No `Date.now()`/`setTimeout`-driven animation in chapters." | docs/ARCHITECTURE.md:130-131 |
| "`ctx.clock.time / dt / frame`: engine time. It can be paused, stepped, scaled and fast-forwarded (QA), so **all** animation must derive from `update(dt, t)`, tweens or `uKTime`" | docs/ENGINE_API.md:428-430 |
| "`random: Rng` — seeded RNG — use instead of `Math.random()`" | docs/ENGINE_API.md:156; `engine/chapter.ts:209-210` |
| "`?freeze=<seconds>` (deterministic clock: no real-time advance; after every navigation exactly N seconds are simulated in 1/60 s steps, then the picture holds; chapter transitions are instant)" | docs/ENGINE_API.md:540-541 |
| "do not keep state in module-level variables (a chapter can be created and disposed many times)" | docs/ENGINE_API.md:604-605 |
| "Animation must run on the engine clock (ARCHITECTURE §3) — wall-clock timers break QA determinism." | eslint.config.js:28 |
| "Seeded PRNG (mulberry32) → uniform [0, 1). Deterministic for QA; never use Math.random in models." | `electricity/sim/core/S2-sim/math.ts:89` |

### 5.2 Seeded generators that exist

| Utility | Path | Signature | Usable from `radio/sim/core`? |
|---|---|---|---|
| `Rng` (mulberry32) | `app/src/engine/random.ts:5-57`, re-exported at `engine/api.ts:59`; `ctx.random` is `new Rng(`chapter:${instance.manifest.id}`)` (`engine/runtime.ts:691`) | `constructor(seed: number \| string = 1)`, `next(): number`, `range(min, max)`, `int(min, max)`, `signed(scale = 1)`, `gauss()`, `pick<T>(items)`, `onSphere()`, `fork(label: string): Rng` | lint allows `@/engine/random` from `sim/**` and `shared/**` (not from chapters); the file has no imports. But `gauss()` is "Approximately normal (mean 0, σ 1) via the sum of uniforms": `(next()+next()+next()+next() - 2) * 1.7320508` (:37-39), bounded to ±3.46 σ |
| `createRng`, `toRandomSource`, `RandomSource` | `electricity/sim/core/S1-sim/rng.ts:5-27` | `interface RandomSource { next(): number }`; `createRng(seed = 1): RandomSource`; `toRandomSource(source: RandomSource \| number \| undefined, fallbackSeed = 1): RandomSource`; also `exponentialSample(rng, mean)`, `randomUnitVector(rng)`, `randomInt(rng, min, max)` | **no** — another volume (`local/volume-boundary`). Its own comment: "mulberry32 — same generator as `engine/random.ts`, duplicated so `sim/` has no engine dependency" (:10) |
| `seededRandom`, `gaussian` | `electricity/sim/core/S2-sim/math.ts:90-108` | `seededRandom(seed: number): () => number`; `gaussian(rand: () => number): number` — Box–Muller: `Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand())` | **no** — another volume |
| `mulberry32` | `electricity/sim/plant-wind/year.ts:9` | `mulberry32(seed: number): () => number` | no |
| `seeded` | `circuit/shared/stage/battery-grains.ts:12` | `seeded(seed: number): () => number` | no |

Every volume so far carries its own copy of mulberry32; the only platform-level generator is `Rng`. All copies keep a 32-bit
counter stepped by `0x6d2b79f5` (period 2³²).

### 5.3 What "deterministic" means at run time

- `ChapterContext` has no flag for deterministic mode (`engine/chapter.ts:186-246`). `deterministic: () => boolean` exists only
  in the runtime's private deps (`engine/runtime.ts:92-93`, set at `engine/app.ts:274`). `ctx.clock` is a `ClockView` with
  `time`, `dt`, `frame` only (`engine/clock.ts:5-12`).
- What a scene can observe: in `?freeze` mode every rendered frame calls `this.clock.advance(0); this.update(0);`
  (`engine/app.ts:597-605`), and with a paused clock `tickReal` returns `this.advance(0)` (`engine/clock.ts:28-34`) — so
  `update(0, t)` (`ctx.clock.dt === 0`) is what a held frame looks like. Simulated time arrives through
  `advance(seconds)`: `Math.round(seconds / FIXED_DT)` calls of `update(FIXED_DT)` in one synchronous loop **with no render
  and no return to the event loop** (`engine/app.ts:478-484`; `FIXED_DT = 1 / 60`, `engine/clock.ts:17`).
  `__app.step(dt, frames)` and `__app.setTime(s)` pause the clock and call the same `advance` (`engine/debug/api.ts:198-209`).
- Precedent for a scene reading a URL flag itself: `new URLSearchParams(globalThis.location?.search ?? '').get('globe')`
  (`volumes/_dev/chapters/_sandbox-circuit-stage/scene.ts:30`); the platform reads `?fixture` the same way (`hud/journey.ts:166`).

---

## 6. Time and frame budget

### 6.1 How `update(dt, t)` is driven

```
requestAnimationFrame → Engine.frame(now)                                   engine/app.ts:577
  frame cap: skip if now - lastRenderAt < 1000/frameCap - 2 (not while measuring, not in freeze)   :582-584
  freeze mode:  [advance(freezePending) once]  clock.advance(0); update(0)   :597-605
  otherwise:    update(clock.tickReal(now))                                  :607
  pipeline.render(worldView, hud, clock.time)                                :610
  cpu = performance.now() - t0   (update + render submission)                :586, :615

Engine.update(dt)                                                            :677-685
  kGlobals.uKTime.value = clock.time; tweens.update(dt); events.emit('update', dt);
  runtime.update(dt, clock.time); input.update()
ChapterRuntime.update(dt, t)                                                 engine/runtime.ts:294-301
  a.hooks.update?.(dt, t); a.director.update(dt); a.env.update(…)
```

- `SceneHooks.update?(dt: number, t: number): void` — "every engine update; engine-clock seconds" (docs/ENGINE_API.md:136).
- `MAX_FRAME_DT = 1 / 15` — "Longest step a single real frame may advance the clock: tab switches and hitches must not
  teleport state" (`engine/clock.ts:14-15`); `tickReal` clamps to it and multiplies by `timeScale` (:32-33).
- The loop stops while `document.hidden` and on `pagehide` (`engine/app.ts:347-354`); `startLoop` calls `clock.resetReal()`
  (:565-570), so the first frame afterwards has `dt = 0`.
- A shared world is mounted per chapter with that chapter's context, and the chapter forwards `update`:
  `export function mountStage(ctx: ChapterContext, options: StageOptions = {}): CircuitStage` with
  `update(dt: number, t: number): void` (`circuit/shared/stage/index.ts:173`, `:137`); `world.update(dt, t)` inside the
  chapter's `update(dt, t)` (`circuit/chapters/wire/scene.ts:100-102`).
- Hooks that fire only on rendered frames: `onTick(object, fn)` from `@/fx` (`fx/index.ts:8`; `fx/core/tick.ts:25` — hooks
  `updateMatrixWorld`, once per engine-time value, only while visible) and three's `onBeforeRender` (used in
  `circuit/shared/stage/bulb-thermal.ts:226`).

### 6.2 What the engine does on slow frames

| Mechanism | Trigger | Effect | Where |
|---|---|---|---|
| dt clamp | real frame longer than 1/15 s | engine time advances by 1/15 s at most | `engine/clock.ts:15,32` |
| dynamic resolution (`settings.dynamicResolution`, default `true`, `engine/store.ts:108`) | frame interval > 22 ms (or `1000 / frameCap + 8`): a counter of slow frames passes 45 (each fast frame takes one off) | `resolutionScale -= 0.1`, floor 0.6; `+0.05` after 900 fast frames | `engine/app.ts:693-725` |
| not applied | in `?freeze`, while a transition runs, in the first 4 s, during `measure()` | — | `:694-697`, `:667-669` |
| 30 fps cap | `mobile` tier, scale already 0.6, `settings.frameCap === 'auto'` (default, `store.ts:114`), still slow for > 180 frames | `frameCap = 30` for the session | `:707-716` |
| `ctx.breathe()` | more than 7 ms used in a slice of scene **building** | yields to the next frame; never in deterministic mode | `engine/runtime.ts:715-721` |

`tools/qa/robustness.mjs:156-175` checks the dynamic-resolution path by burning ≈ 30 ms in every update.

### 6.3 Quality tiers a model could read

`QUALITY_TIERS = ['low', 'medium', 'high', 'ultra', 'mobile']` (`engine/quality.ts:21`). `QualityView`: `tier`, `profile`,
`count(nominal: number, min?: number): number` = `Math.max(min, Math.round(nominal * profile.particles))`,
`onChange(fn)` (:162-195). `particles`: 0.35 / 0.6 / 1 / 1.5 / 0.5. `profile.lowDetail` is `true` on `mobile` only (:156).
`ctx.device.formFactor`: `desktop | tablet | phone` (docs/ENGINE_API.md:158). Nothing in the tiers concerns CPU work.

### 6.4 Guidance on work per frame

- Budget (RTX 5060, `high`): "avg frame ≤ 8 ms at 1920×1080 and ≤ 14 ms at 3840×2160; ≤ 350 draw calls and ≤ 1.5 M triangles
  per chapter view; chapter chunk ≤ ~350 kB gzip; initial load (engine + home) ≤ ~900 kB gzip" (docs/ARCHITECTURE.md:24-25).
- "`await ctx.breathe()` between build phases; avoid > 10 ms synchronous blocks in `update`." (docs/ENGINE_API.md:526)
- Sizes implied by the design's own numbers (my arithmetic from design lines 507 and 512): a line is 128 × 64/52 ≈ 158 cells,
  a frame 100 lines ≈ 15 800 video samples; the whole band 83,5 MHz / 4,5 ≈ 18,6 MHz over a 28,8 ms model frame
  ≈ 535 000 complex samples — consistent with "сотні тисяч пар чисел" (line 720). At the design's 10–25 model frames/s one
  frame costs 40–100 ms of CPU: four to ten times the 10 ms guidance if run inside `update`.

### 6.5 How QA measures performance

| Tool | What it measures | Gate |
|---|---|---|
| `window.__app.measure(frames = 240)` (`engine/app.ts:547`) | per frame: GPU time (`EXT_disjoint_timer_query_webgl2`), CPU time (`performance.now()` around `update` + render submission on the **main thread**), wall time with a blocking 1×1 `readPixels`; `frameAvg = cpuAvg + gpuAvg`, or `syncAvg` without timer queries (:661) | — |
| `node tools/qa/chapter-check.mjs <chapter> [--sizes all]` | pass 4 reopens the chapter **without** `freeze` (:243), per step: `goto(c, s, { instant: true })`, wait 700 / 300 ms, `measure(90)`; minimum of 3 interleaved rounds (`check-parts.mjs:65-77`); steps over budget get up to 3 more samples 4 s apart | fail `frameAvg > 8` ms at the primary size (`--budget`, :95); at 3840×2160 warn > 14, fail > 16.6 (`--budget-4k`, `--fail-4k`); fail > 350 draw calls, > 1 500 000 triangles (:185-186); `--no-perf-fail`, `--skip perf` |
| same tool, passes 1–3 | deep links, sequential and random navigation run with `?freeze` (default 3 s; :94, :162, :177, :203) | fail on any console error **or warning**, page error, wrong position, leak, third-party request (:40-41) |
| `node tools/qa/perf.mjs <route> … [--q high,ultra] [--size WxH] [--frames 300] [--warmup 1200] [--uncapped] [--json f]` | same `measure`, prints `frame = gpu + cpu · sync` | none (exit 1 only on errors) |
| `node tools/qa/mobile-check.mjs` | `mobile` tier at the profile's pixel budget | 16.6 ms; a warning unless `--perf-fail` (:27-28, :57, :194) |
| `node tools/qa/dom-cost.mjs <chapter>` | script / style / layout per frame of the DOM interface | HUD script ≤ 0.5 ms (mobile 1.0) (:10-12) |

All tools: `openApp` throws unless the WebGL renderer matches `/nvidia/i` or `QA_ALLOW_SOFTWARE` is set (`lib.mjs:160`);
`timeout = 60000` per page open (`lib.mjs:155`); output goes to `/srv/electricity/qa/$QA_ID` unless `--out` (`lib.mjs:80-82`).
`__app.errors()` records `console.error`, `console.warn`, window `error` and `unhandledrejection`
(`engine/debug/api.ts:136-153`); `console.info` is not recorded. A volume can publish numbers to QA scripts through
`ctx.qa.expose(name: string, fn: () => unknown): () => void` → `window.__app.read(name)` (`engine/qa-probes.ts:33-37`).

---

## 7. Mismatches with the design

Each row: what Part III §3–4 (lines 657-727) or Part II §7 (502-513) assumes, what this configuration does, and a way through
that stays inside the rules (no platform edit unless stated).

| # | Design | Reality here | Way through |
|---|---|---|---|
| M1 | 659-661: "без three.js і без доступу до часу чи випадковості ззовні" for `radio/sim/core/` | Lint enforces none of it outside `chapters/**` (§1.3: `three`, `Math.random`, `Date.now`, `performance.now`, `setTimeout` pass in `sim/core`); `tsc` also accepts `process` / `Buffer` | A volume-owned guard test under `app/src/volumes/radio/sim/core/__tests__/` that scans the sources of `sim/**` (and the worker entry) for forbidden imports and identifiers — `readFileSync`/`readdirSync` with `import.meta.url`, or the `ESLint.lintText` pattern of `engine/__tests__/lint-chapter-boundary.test.ts:9-15`. `app/eslint.config.js` stays untouched |
| M2 | 708: "Модель живе у фоновому потоці (Web Worker)" | No worker exists; `lib` has no `WebWorker`, so `self.postMessage(x, [buf])` is `TS2769` | Worker entry of a few lines in `radio/shared/link/` using `self.postMessage(msg, { transfer })` (compiles against the DOM typings and is the worker API too), or `/// <reference lib="webworker" />` + `declare const self: DedicatedWorkerGlobalScope;` (both pass `tsc` and lint). `new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' })` next to it; no change to `vite.config.ts`; boundary rules allow `shared/link → sim/core` |
| M3 | 660-661: "Той самий код працює у фоновому потоці, в основному потоці й у тестах" | vitest here has no `Worker` and no `self`; importing a worker entry throws `ReferenceError: self is not defined` | Three files: the pure handler `(request, post) => void` (imports `sim/core`, no globals), the entry that binds it to `self`, and the link that chooses worker or direct call. Tests call the handler and the direct path and compare bytes; `structuredClone(msg, { transfer })` reproduces the detach |
| M4 | 713-715: the synchronous path is used "у режимі зупиненого кадру для перевірки" | `ChapterContext` exposes no deterministic flag (§5.3) | Detect a held frame by `ctx.clock.dt === 0` in `update`, or read `freeze` from `globalThis.location?.search` (precedent `_sandbox-circuit-stage/scene.ts:30`); `typeof Worker === 'undefined'` covers "де фонового потоку немає" |
| M5 | 713-715: "рахує потрібний кадр синхронно … Знімки повторюються біт у біт" | `?freeze=3` means 180 synchronous `update(1/60)` calls with no render and no event-loop turn (`app.ts:478-484`), then held frames with `dt = 0`. A worker reply cannot arrive inside that loop; a model frame computed on every fixed update would be 180 × (40–100 ms) per page open, against `openApp`'s 60 s timeout and three sizes × all steps in chapter-check | In `update(dt > 0)` only record the scene state and the model-frame index for `t`; compute one frame synchronously on the first held frame after the state or index changed. That requires a model frame to be a function of (scene state, frame index, seed) alone — noise seeded per frame index, loop states (line rhythm, gain) started from a defined point inside the frame computation — otherwise the picture depends on how many frames ran before |
| M6 | 660: "шум береться з генератора із заданим зерном"; 694: "частка помилок чотириточкового сузір'я без коду збігається з теорією" | The seeded generators with a true Gaussian live in `electricity` and cannot be imported; `Rng.gauss()` is a four-uniform approximation cut at ±3.46 σ | `radio/sim/core` gets its own mulberry32 + Box–Muller (the pattern of `electricity/sim/core/S2-sim/math.ts:90-108`), as every volume already does (§5.2) |
| M7 | 671: `spectrum` — "швидке перетворення Фур'є" | The only FFT (`electricity/sim/core/S1-sim/fft.ts`) is in another volume, allocates per call and falls back to O(N²) | A new in-place transform in `radio/sim/core` |
| M8 | 659: "на типізованих масивах"; 709-710: scene state and camera frame go in, screen frame and probe taps come back | Transfer detaches the sender's array; `SharedArrayBuffer` is ruled out (docs/ARCHITECTURE.md:13-14); a parameter typed `Float32Array` is `Float32Array<ArrayBufferLike>` and cannot be returned as `Float32Array<ArrayBuffer>`; `lib` is ES2023 (no `Float16Array`) | Type message fields as `Uint8Array<ArrayBuffer>` / `Float32Array<ArrayBuffer>`; send with a transfer list and hand the buffer back in the reply (or allocate per message: the screen is 128 × 96 = 12 288 bytes) |
| M9 | 710-711: "Якщо модель не встигає, вона бере найсвіжіший стан і пропускає старі" | A worker that is busy cannot look at its queue; messages are handled in order | Keep the policy on the main side: at most one request in flight, one slot for the newest state. The worker stays a request → reply function, which is also what M3 tests. Requests stop by themselves while the tab is hidden because `update` stops (`app.ts:347-349`) |
| M10 | 722-724: phone "оцінюємо чотирикратним сповільненням процесора" | CDP CPU throttling slows the page's main thread only; Chrome answers "Operation is only supported for pages, not workers" on the worker session (§4.4). No QA tool throttles or measures model frames | Measure the synchronous path under page-session throttling, or the worker path unthrottled and report it ×4 as an estimate. Publish the model's frame rate with `ctx.qa.expose('…', fn)` and read it from a volume-owned script with `__app.read` |
| M11 | 704-705, 720-726: the model's speed is judged against "мірило", the extra pass "з окремим обліком у перевірці швидкодії" | `__app.measure` sees main-thread CPU + GPU only: worker time is invisible to the 8 ms gate, while a synchronous fallback in real time lands entirely in `cpuAvg`, breaks the gate and triggers dynamic resolution after 45 frames slower than 22 ms (§6.2) | Worker path for real time; where no Worker exists, the fallback has to be rationed (a slice of the model frame per `update`, or fewer model frames) — the gate passes of chapter-check that run with `?freeze` do not measure time at all |
| M12 | 681-682: "Вона пише зразкові дані, а тести TypeScript порівнюють із ними результат"; 643-644: "рушій дозволяє додаткові перевірки у `volume.json`" | No existing sim test reads oracle data. `volume.json → docs.checks` is honoured only by the classic `main()` (`tools/content/doccheck.py:235-236`); a `format: "path"` volume runs `main_path()` (:252-270) with a fixed list (typography, index, glossary, export, runtime, fonts) and the only tunable is `path.budgets` (`path_check.py:49`). `tools/content` is a directory the design says not to edit (552-553) | The Python models write small JSON files that are committed; vitest reads them (`import ref from './fixtures/x.json'` — `resolveJsonModule` is on — or `readFileSync(new URL(…, import.meta.url))`). Keep the fixtures under `app/src/volumes/radio/**` so the tree copied by the site profile (`app/` only, line 564) still type-checks. The oracle's own `--check` runs as a separate step (CI workflow / a volume script), not through doccheck. Sweeps such as the 1–2 dB cliff need a per-test timeout above the 5 s default |
| M13 | 552-553: platform directories are not edited; 171: existing tests stay green | `app/src/engine/__tests__/volumes.test.ts:30` — `expect(volumes.map((v) => v.dir).sort()).toEqual(['_demo', '_dev', '_path', 'circuit', 'electricity']);` — fails as soon as `app/src/volumes/radio/volume.ts` exists | A one-line edit of that platform test (add `'radio'`) is unavoidable for a volume in the tree; the same test (:66-73) demands the `@radio/*` line in `tsconfig.json` that the design already lists (line 548) |
| M14 | 708-711 + Part III §6 (`link` in `shared/`) | docs/ENGINE_API.md:604-605 forbids module-level state; chapter-check enters and leaves a chapter three times; worker exceptions do not reach the window `error` listener that `__app.errors()` records (general browser behaviour, not tested here) | Create the worker inside the mount function that takes `ctx` (the `mountStage(ctx, …)` pattern) and `ctx.onDispose(() => worker.terminate())`; forward `worker.onerror` / `onmessageerror` to `console.error` so QA sees them; a "no worker, using the fallback" note may only be `console.info` (`warn`/`error` fail chapter-check, `log` fails lint) |
| M15 | 792, 818: batch 2 shows the live screen "у пісочниці" | A chapter of a dev volume may import another volume's `shared/**` but not its `sim/**` (`chapter-boundary.js:27`; test FAIL case `lint-chapter-boundary.test.ts:58`); non-chapter files of a dev volume may import neither | A sandbox chapter under `_dev` reaches the model only through `@radio/shared/…`; a sandbox chapter inside `radio` itself may import both |
| M16 | 725-726: WebAssembly as the last resort | No `.wasm`, no `WebAssembly` use anywhere (grep 0); `vite/client.d.ts:208` declares `*.wasm` modules | Nothing to prepare in batches 1–3 |

Design statements about this subsystem that **do** hold: `sim/core/` and `sim/<chapter>/` are the engine's own layout
(docs/ARCHITECTURE.md:70-71; design 610-611); `tools/ref-models/radio/` follows `tools/ref-models/C6-labs/` (docs/VOLUMES.md:137-138);
"у рушії немає фонового потоку" (design 141) is true; `base: './'` makes a worker file load from the Pages sub-path (§4.2);
`QA_ALLOW_SOFTWARE=1`, `--base`, `--out` exist as the design says (775).
