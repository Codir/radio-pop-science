# Recon E2 — `radio` as the worked example of a model-driven volume (+ `electronics` as it is now)

Read-only map at HEAD `2707887` (2026-11-20). All paths are repo-relative (`app/src/…`). Line numbers are of that
HEAD. «L12-30» = lines 12–30. Verdicts: **COPY** (as is) · **COPY+ADAPT** (say what) · **USE** (platform API
directly) · **REF** (pattern only, write own code) · **SKIP**.

---

## 0. Answers in one screen

**Model link (worker vs main thread).**

- **DC on every board change → main thread, synchronous, no worker.** `solveDC` is one dense LU over the *used*
  nodes only (unused rows cost nothing, `mna.ts` L130-146): a board with ~10–30 used rows is far below 1 ms (E1-4
  adds a few Newton iterations). The multimeter readout, LED brightness and heat need the answer in the same frame;
  a held page (`?freeze`) has no thread anyway. Pattern: keep a `Circuit` from `compile(net)` per *topology*
  (sockets), re-`solveDC(circuit, { state })` when only settings changed (pot/switch: a compiled circuit reads
  `part.setting` live, `mna.ts` L118-119, L185-192), recompile on any socket change. Solve only when a dirty
  flag/version changed, not every frame. One `ModelState` per bench mount (`state.ts` L13). Time it in shared code
  (`performance.now` is fine outside `chapters/**`) and expose `dcMs` through the bench's qa reader.
- **Audio-rate transient blocks → a background worker per mount, built exactly like `radio/shared/link`**: pure
  `handler.ts` (one message in, one out, never throws), a 9-line `model.worker.ts`, and `createLink(ctx)` on the main
  side with: at most one request in flight, the freshest board state wins (never queue old ones), `ready` handshake,
  transfer lists for the sample buffers, worker failure → terminate + sync fallback for good + exactly one
  `console.error`, missing `Worker` → silent sync, `dispose` on `ctx.onDispose` (П12: two mounts = two workers). Differences
  from radio: (1) pacing by the **audio clock** (request when the queued audio ahead of `AudioContext.currentTime`
  is below ~2 blocks) instead of `LINK_MAX_FPS` on engine time; (2) the worker keeps the transient state between
  blocks (continuity), recompiles only when a `version` of the board changes and carries part state (capacitor
  charge, lamp temperature, damage) by part id; (3) the sync fallback at audio rate would land in the main-thread
  frame budget — ration it (radio: one model frame per `LINK_SYNC_EVERY = 6` updates) or use the design's «loop»
  fallback (§6.3: compute a 4 s loop once after each change, play it round). E1-9 (`shared/sound`, not landed yet)
  is planned to build this worker; E2 should consume it, not build a second one.
- **Held pages** (`?freeze`): no worker, no audio. The oscilloscope trace must come from a synchronous `still`-style
  call that depends only on (netlist, settings, window): reset → warm-up from the operating point → capture the
  window — computed once on the first held frame (dt 0) after something changed (radio's `heldFor` JSON key,
  `world/index.ts` L207-219).

**Sandbox.** `app/src/volumes/_dev/chapters/_sandbox-electronics-bench/` (name from design §8.2) =
`index.ts` (all words in one `SANDBOX` const + `defineChapter({ …, dev: true })`) + `scene.ts` (no words; mounts
`@electronics/shared/**` only; `stepUi` controls; a `WRITE` map control→model; `ctx.qa.expose` readers) +
`qa/measure.mjs` (sections, `check()`, `measure.json`, last line `PASS …`). It may import only
`@electronics/shared/**` (lint `showcase`), so shared must re-export the sim API it needs (radio: `world/index.ts`
L31-42).

**QA checks.** A node script on `tools/qa/lib.mjs` (`launch`, `openApp`, `appUrl`, `screenshot`, `appErrors`):
open held pages (`?freeze=1`) and drive them with `__ui.set(id, v, true)` + `__app.step(1/60, k)` + held frames
`__app.step(1/60, 0)`; read numbers only via `__app.read('<reader>')` (no pixel diffs); live page for the worker
(mode, first reply ≤ 5 s, mean model ms of 20 replies ≤ gate); phone gate = sync path under CDP 4× CPU throttle
(throttling never reaches a worker, П10); leaks = 3 visits to `_sandbox-ui` and back (geometries/textures/programs
do not grow, `page.workers().length === 1`); console clean every section. For sound (E1-9 plan): click for the
gesture, URL **without** `noaudio` (`appUrl` always adds it), 10 s with 0 underruns, settings mute → silent,
`?noaudio` → no `AudioContext`.

---

## 1. `electronics` as it exists now (E1-1…E1-3)

### 1.1 Files

| File | Lines | What |
|---|---|---|
| `app/src/volumes/electronics/volume.json` | 53 | id `electronics`, `status: draft`, `format: path`, accent `teal`, emblem `chart`, axis «Поверх» with `floors` atoms 0 / inside 1 / part 2 / stand 3, 8 groups, 19 journey entries |
| `app/src/volumes/electronics/volume.ts` | 32 | `defineVolume(identity, { journey: { axis: {min 0,max 3,…, ascending:'out'}, layout {dx 210, dy 70} }, glossary: {scope:'volume'}, theme: {sky:'studio', mood:'studio'} })` |
| `app/src/volumes/electronics/chapters.ts` | 6 | `import.meta.glob('./chapters/*/index.ts', { eager: true })` — no chapters yet |
| `app/src/volumes/electronics/__tests__/journey.test.ts` | 167 | the planned journey; reads `library.json` and other volumes' `volume.json` as **files** (never imports) |
| `app/src/volumes/electronics/sim/core/index.ts` | 7 | barrel: netlist, parts, mna, state, topology, dc |
| `…/sim/core/netlist.ts` | 54 | `Netlist`, `PartInstance`, `GROUND`, `checkNetlist`, `checkSetting` |
| `…/sim/core/parts.ts` | 312 | catalog `PARTS`, specs, `Behaviour`, `behaviour()`, `E12`, `E24`, `resistorKey`, `WIRE_OHMS` |
| `…/sim/core/mna.ts` | 201 | dense LU, `compile`, `Circuit`, `Stamper`, `readSettings`, `assemble`, `PIVOT_MIN`, `TIE_OHMS` |
| `…/sim/core/topology.ts` | 90 | `TopologyIssue`, `analyse` (union–find) |
| `…/sim/core/dc.ts` | 86 | `solveDC`, `DcSolution`, `PartReading`, `DcOptions` |
| `…/sim/core/state.ts` | 15 | `ModelState { v }`, `createModelState()` |
| `…/sim/core/README.md` | 178 | units, conventions, catalog with sources, topology table, «Adding a kind of part» |
| `…/sim/core/__tests__/` | purity 123, parts 111, mna 173, dc 327, topology 181, oracle 63 | purity = radio's test with electronics examples (§6.2) |
| `…/sim/core/__fixtures__/*.json` | 7 files | ngspice samples: battery-load, divider, grid, pot-ccw/mid/cw, speaker-switch |

Alias `@electronics/*` exists in `app/tsconfig.json` L24 (vite builds aliases from the directory list,
`app/vite.config.ts` L14-18). No `shared/` directory yet; no `docs/volumes/electronics/` yet (E1-8).

### 1.2 Exported model API (signatures)

```ts
// netlist.ts
export const GROUND = 0;                                                    // L8
export interface PartInstance { id: string; spec: string; pins: number[]; setting?: number }   // L11-21
export interface Netlist { nodes: number; parts: PartInstance[] }          // L24-28
export function checkNetlist(net: Netlist): void                           // L31  RangeError naming the fault
export function checkSetting(part: PartInstance): void                     // L51

// parts.ts
export const WIRE_OHMS = 1e-3;                                             // L11
export interface Limits { readonly powerW?: number; readonly currentA?: number }   // L14-17
export interface BatterySpec  { kind:'battery'; pins:['plus','minus']; volts; ohms; cells; limits }  // L20
export interface SourceSpec   { kind:'source';  pins:['plus','minus']; volts; limits }             // L31 (ideal; never on the bench)
export interface ResistorSpec { kind:'resistor'; pins:['a','b']; ohms; series:'E12'|'E24'; tolerance; limits } // L39
export interface PotSpec      { kind:'pot'; pins:['ccw','wiper','cw']; ohms; limits }               // L52
export interface SwitchSpec   { kind:'switch'; pins:['a','b']; limits }                             // L60
export interface JumperSpec   { kind:'jumper'; pins:['a','b']; limits }                             // L67
export interface SpeakerSpec  { kind:'speaker'; pins:['plus','minus']; ohms; limits }               // L74
export type PartSpec = BatterySpec|SourceSpec|ResistorSpec|PotSpec|SwitchSpec|JumperSpec|SpeakerSpec;  // L81
export type PartKind = PartSpec['kind'];                                   // L83
export type Link = readonly [number, number];   // L86  !! name clashes with radio's `Link` (the model link) — see Gotchas
export interface Placement { readonly nodes: Int32Array; readonly branch: number }   // L89
export interface Behaviour { branches; source; setting(raw); links(setting); wire(setting);
  stamp(setting, at, s: Stamper); currents(setting, at, v, x, out) }      // L95-110
export function behaviour(spec: PartSpec): Behaviour                       // L219
export const E12: readonly number[]; export const E24: readonly number[];  // L240-243
export const PARTS: Readonly<Record<string, PartSpec>>                     // L284-295 frozen
//   'battery-9v' (9 V, 1.5 Ω, 6 cells), 'battery-4aa' (6 V, 0.6 Ω), 'battery-aa' (1.5 V, 0.15 Ω), 'ideal-9v',
//   'resistor-<IEC 60062 code>' ×169 (1R0 … 9M1, 10M; 0.25 W, 5 %), 'pot-10k' (0.2 W), 'switch', 'jumper',
//   'speaker-8' (8 Ω, 2 W), 'earphone-32' (32 Ω, 0.1 W)
export function resistorKey(ohms: number): string                          // L299  4700 → 'resistor-4k7'; RangeError if absent

// mna.ts
export const PIVOT_MIN = 1e-13; export const TIE_OHMS = 1e9;               // L15, L18
export interface LinearSystem { n; a: Float64Array; b; x; perm: Int32Array }   // L21
export function createSystem(n: number): LinearSystem                      // L32
export function factor(s: LinearSystem): boolean                           // L47  false = singular
export function solveFactored(s: LinearSystem): void                       // L83
export interface Stamper { conductance(a,b,g); current(a,b,i); voltage(plus,minus,branch,volts) }  // L98
export interface Element { part; spec; behaviour; nodes: Int32Array; branch }   // L108
export interface Circuit { net; elements; index: Int32Array; system; stamper }  // L120
export function compile(net: Netlist): Circuit                             // L130  checks + numbers unknowns + allocates once
export function readSettings(c: Circuit): Float64Array                     // L185
export function assemble(c: Circuit, settings: Float64Array, ties: readonly number[]): void   // L195

// topology.ts
export type TopologyIssue =
  | { kind: 'open'; part: string } | { kind: 'short'; part: string }
  | { kind: 'floating'; part: string; pins: string[] } | { kind: 'ungrounded'; nodes: number[] };  // L10-18
export interface Topology { readonly issues: TopologyIssue[]; readonly ties: number[] }   // L20
export function analyse(c: Circuit, settings: Float64Array): Topology       // L42

// dc.ts
export interface PartReading { u: number; i: number; p: number }           // L11  u pin0→pin1; i into pin0; p taken (<0 for a source)
export type DcFailure = 'singular';                                        // L23
export interface DcSolution { ok; reason?; v: Float64Array; parts: Record<string, PartReading>; iterations; issues }  // L25
export interface DcOptions { state?: ModelState }                          // L40
export function solveDC(net: Netlist | Circuit, opts?: DcOptions): DcSolution   // L51  never throws on singular; zeros

// state.ts
export interface ModelState { v: Float64Array }                            // L7   grows in E1-4…E1-6 (temperature, charge, damage)
export function createModelState(): ModelState                             // L13
```

### 1.3 What the bench must do to build a `Netlist` from sockets

- Number every connected group of sockets (a breadboard row, a rail) as one node; **the ground row must be node 0**
  (`GROUND`). Any numbering 0…R−1 is fine: `nodes = R`, unused nodes are skipped (`mna.ts` L132-136) and read 0 V.
- Every thing that connects is a `PartInstance`, including the permanent things (battery with its switch, player,
  speaker, lamp) and jumpers/wires (`jumper` = 1 mΩ). `pins` in catalog order (`PARTS[key].pins`); `id` unique and
  **stable across rebuilds** (it keys readings now and part state later — damage must stay with the physical part).
- Settings: pot 0…1 (share ccw→wiper, default 0.5), switch 0/1 (≥ 0.5 closed, default open). Change a setting →
  mutate `part.setting` and re-solve the same `Circuit`; change sockets → new `Netlist` + `compile`.
- Read `issues` for the UI: `open` / `short` (sources only), `floating` (a leg in a row nothing else touches, never
  ground; a pot's free wiper counts), `ungrounded` (model ties the island by 1 GΩ and solves on).
- `ok: false` (`'singular'`) only with two ideal sources side by side — impossible on the bench (batteries only), but
  handle it (zeros everywhere).
- A malformed netlist is a `RangeError` (not a result): the bench must never hand over half-built data (validate
  in the board model, or catch and show nothing).
- Not there yet (E1-4…E1-7, per `docs/superpowers/plans/2026-11-20-electronics/batch-E1.md`): diodes/LEDs/lamp/limits
  and part state `ok|hot|burnt|bulged` (E1-4/5), `Transient` with fixed `dt`, run of `n` steps into caller-owned
  `Float32Array`s, setting changes between steps (E1-5 L211-223), transistors + `amplifier.ts` netlist with node names
  for the probe (E1-6 L261-262), `music.ts` render `(fs, startSample, n, out)` and the «player» source, speed bench
  (E1-7 L286-299), `shared/sound` with worker and `_sandbox-electronics-sound` (E1-9 L371-389). The bench's API
  contract for these is therefore provisional.

---

## 2. `app/src/volumes/radio/shared/link/` — the model link (B11)

| File | Lines | Imports | What |
|---|---|---|---|
| `link/protocol.ts` | 29 | `@radio/sim/core` (types only) | messages |
| `link/handler.ts` | 68 | `@radio/sim/core` (`createFmLink`, types), `./protocol` | the model's side, pure |
| `link/model.worker.ts` | 9 | `./handler`, `./protocol` | worker entry |
| `link/index.ts` | 250 | `@/engine/api` (type `ChapterContext`), `@radio/sim/core` (types), `./handler`, `./protocol` | `createLink` |
| `link/__tests__/handler.test.ts` | 96 | vitest, `@radio/sim/core`, `../handler` | |
| `link/__tests__/link.test.ts` | 272 | vitest, `@/engine/api`, `@radio/sim/core`, `..`, `../handler` | |

### 2.1 `protocol.ts`

```ts
export interface LinkRequest { seq: number; kind: 'step' | 'still'; state: FmLinkState; luma: Uint8Array; probe: ProbeRequest | null }  // L8-15
export interface LinkReply  { seq: number; screen: Uint8Array; meters: Meters; probe: ProbeData | null; ms: number }                      // L18-24
export type ToWorker   = { type: 'init'; seed: number } | { type: 'frame'; request: LinkRequest };                                    // L26
export type FromWorker = { type: 'ready' } | { type: 'frame'; reply: LinkReply } | { type: 'error'; message: string };               // L28-29
```

`step` continues from the frame before; `still` depends only on (seed, state, frame). The same messages go to the
worker and, on the sync path, straight to `createHandler`.
**Verdict: COPY+ADAPT** → `electronics/shared/link/protocol.ts` (or `shared/sound/…` per E1-9): `init {fs, seed?}`;
request `{ seq, kind: 'block' | 'still', version, netlist?: Netlist /* only when version changed */, settings:
Float64Array | number[], start: number /* sample index */, n: number, taps: number[] /* nodes for the scope */,
speaker: string /* part id */ }`; reply `{ seq, version, speaker: Float32Array, taps: Float32Array[] (one buffer per
tap or one interleaved), states: Record<string, PartState>, ms }`. Drop `luma`, `screen`, `probe`, `meters`.

### 2.2 `handler.ts`

```ts
export interface HandlerOutput { reply: FromWorker; transfer: ArrayBuffer[] }   // L14-18
export interface Handler { handle(msg: ToWorker): HandlerOutput | null }        // L20-22
export function createHandler(now: () => number): Handler                        // L39-68
```

- `init` makes the model (`createFmLink(msg.seed)`), replies `ready`; a second `init` replaces it (restart) (L44-47).
- `frame` before `init` → `{type:'error', message:'link: frame before init'}` (L49); any model exception → `error`
  reply, never a throw (L63-65).
- The model's buffers live only until its next call, so the reply carries **copies** (new `Uint8Array` for the
  screen, `copyProbe` L29-36 for each `Float32Array`) whose buffers go into `transfer`; meters copied by spread (L56-61).
- `ms = now() − before` around the model call only (L52-55); `now` injected (worker passes `performance.now`, tests
  pass `() => 0` or a scripted clock).
**Verdict: COPY+ADAPT** — same skeleton; model = E1-5/E1-7 `Transient` from `@electronics/sim/core`; on a `version`
change recompile and carry state by part id; copy the run's output arrays into fresh buffers for transfer (or
ping-pong buffers handed back by the main side to avoid per-block allocation of 2 × 4096 floats — allocation is
cheap here, radio allocates per frame).

### 2.3 `model.worker.ts` (L1-9)

```ts
/// <reference lib="webworker" />
import { createHandler } from './handler';
import type { ToWorker } from './protocol';
declare const self: DedicatedWorkerGlobalScope;
const handler = createHandler(() => performance.now());
self.onmessage = (e: MessageEvent<ToWorker>) => {
  const out = handler.handle(e.data);
  if (out) self.postMessage(out.reply, { transfer: out.transfer });
};
```

**Verdict: COPY as is.** `/// <reference lib="webworker" />` + `declare const self` is needed because `tsconfig`
`lib` has no `WebWorker` (facts `sim-worker-lint.md` §2 row `lib`). Never import this file from a test (`self` is
undefined in vitest node: `ReferenceError`).

### 2.4 `index.ts` — `createLink`

```ts
export type LinkMode = 'worker' | 'sync';                                      // L27
export interface WorkerLike { postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((e: { data: FromWorker }) => void) | null; onerror: ((e: unknown) => void) | null; terminate(): void }  // L30-35
export interface LinkOptions { seed?: number; mode?: 'auto' | LinkMode; makeWorker?: () => WorkerLike }   // L37-41
export interface Link { readonly mode; readonly frame: LinkReply | null; readonly frames: number; readonly fps: number;
  pump(state, luma: () => Uint8Array, probe): boolean; still(state, luma, probe): LinkReply; dispose(): void }  // L43-62
export const LINK_SYNC_EVERY = 6;   // L65  sync path: one model frame per 6 engine updates
export const LINK_MAX_FPS = 25;     // L67  at most 25 requests per second of ENGINE time
export function createLink(ctx: ChapterContext, opts?: LinkOptions): Link    // L91-250
```

Mechanics worth copying verbatim:
- `spawnWorker` L88-89: `new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' }) as unknown as
  WorkerLike` — the literal form Vite finds and bundles (worker built as IIFE, works from any sub-path; facts §4.2).
- Mode choice L167-176: worker if `opts.mode !== 'sync'` and (`makeWorker` given or `typeof Worker !== 'undefined'`);
  constructor throw → `fail`. Missing `Worker` is **not** a failure and not logged (L10-12, test L180-184).
- `listen` L151-165: ignores messages after `dispose` or from a replaced worker; takes a `frame` only if
  `reply.seq === pending` (stale replies dropped, test L95-96).
- `send` L178-189: copies `luma()` into a fresh array, `postMessage({type:'frame', request}, [data.buffer])`; sets
  `pending`, `sentAt = ctx.clock.time`.
- `pump` L205-227: returns `true` when a new frame arrived since the last call; worker path sends only when `ready &&
  pending === null && clock.time − sentAt ≥ 1/LINK_MAX_FPS − 1e-6`; sync path runs the handler every 6th update; a
  sync model error keeps the last good frame, `complain` once (L112-116: at most one `console.error` per life).
- `fail` L141-149: worker → sync **for good**, terminate, drop `pending`.
- `still` L229-236: a separate handler instance made on first call (`seq: -1`), so a held frame never touches the live
  model; throws `Error('[radio/link] still failed: …')` on a refused state.
- `fps` smoothing L124-138 (`FPS_WEIGHT 0.2`, engine-time intervals, zero interval skipped).
- `ctx.onDispose(() => link.dispose())` L248 (П12: the thread belongs to the mount).
**Verdict: COPY+ADAPT** — keep all of the above; change: pacing (`need()` from the audio queue: request while
`queuedSeconds < 2·blockSeconds` instead of `LINK_MAX_FPS` on engine time), the payload (board, not luma), log
prefix `[electronics/link]`, the exported name `Link` → e.g. `ModelLink` (clash with sim `Link`), and the sync
fallback cost model (an audio block on the main thread may be tens of ms — measure with E1-7 numbers; ration or loop).

### 2.5 Tests (patterns to copy)

- `handler.test.ts` L1-96: `init → ready`; frames equal `createFmLink(seed).step` bit for bit; `still` equals a fresh
  model's `still`; replies carry own buffers, all in `transfer`, earlier replies unchanged by later ones; `ms` = clock
  difference with a scripted clock `[10, 35] → 25`; frame before init → error.
- `link.test.ts` L1-272: `class FakeWorker implements WorkerLike` (L13-43) that records posts and answers through a
  real handler (`answer(i)`); ctx stub `{ clock: {time}, onDispose }` (L45-47); `vi.spyOn(console, 'error')`. Cases:
  one in flight + freshest state after a pause (L75-104), luma copied and transferred (L106-115), ≤ 25 req/s (L117-128),
  worker failure → sync, one error line, in-flight reply ignored (L130-148), constructor throws (L150-162), model
  error: one console line, last good frame kept (L164-178), no Worker → sync, silent (L180-184), sync cadence 6
  (L186-198), `still` isolated from the live line (L200-218), fps (L220-249), dispose terminates once, late reply
  ignored (L251-271).
**Verdict: COPY+ADAPT** (rename, payload; add: blocks are continuous — two half blocks == one block; version change
recompiles and keeps part state; pacing follows a fake audio clock).

---

## 3. `app/src/volumes/radio/shared/world/index.ts` (248 lines) — one call that mounts the volume's world

Imports: `three` (type `Object3D`), `@/engine/api` (`ChapterContext`, `damp`), `@radio/sim/core` (`COLS`,
`DEFAULT_STATE`, types), `../link`, `../models` (`MONITOR_SCREEN`), `../screen`, `../yard`.

```ts
export { DEFAULT_STATE } from '@radio/sim/core';                 // L32  ┐ re-exports so `_dev` sandboxes never import
export type { ChannelNo, FmLinkState, Meters, ProbeData, ProbeRequest, ProbeView, TapId } from '@radio/sim/core';  // L33-41 ┘ sim (П7)
export { type RouteStop, YARD_SHOTS, screenShot } from '../yard'; // L42
export interface WorldOptions { link?: 'auto' | 'sync' | 'off'; seed?: number; dusk?: number }   // L44-54
export interface RadioWorld { yard; eye; link: Link | null; screen; line: FmLinkState; probe: ProbeRequest | null;
  meters; probeData; luma; resetLine(): void; update(dt, t): void }                               // L56-75
export interface WorldParts { yard; eye; screen; link: Link | null; frozen: boolean }             // L78-84
export function fnv1a(bytes: Uint8Array): string                                                  // L91-95  8 hex digits
export function createWorld(ctx, parts: WorldParts, opts?): RadioWorld                            // L123-229
export function mountWorld(ctx, opts?): RadioWorld                                                // L231-248
```

Patterns:
- **mount vs create split** (L14, L123, L231): `mountWorld` builds real parts (needs WebGL/engine) then calls
  `createWorld(ctx, parts)`, which tests drive with stand-ins (`world.test.ts` L16-27 `vi.mock(... importOriginal)`,
  L50-110 `make()` with fake eye/link/screen and a ctx stub `{ clock, onDispose, qa: { expose } }`).
- **frozen detection** L232: `new URLSearchParams(globalThis.location?.search ?? '').has('freeze')` — `ChapterContext`
  has no deterministic flag (facts §5.3); a held page forces `mode: 'sync'` (L240-246).
- **held-frame logic** L207-223: `dt > 0` → `moved = true`; `dt === 0` → compute `still` only if `moved` or
  `JSON.stringify([line, probe, dusk, wicket]) !== heldFor`; both cleared **before** the call so a throwing state throws
  once. Live: `if (link.pump(...) && link.frame) show(link.frame)` (L220-222).
- **state object by reference**: `line` is created once (`structuredClone(DEFAULT_STATE)`, L126); `resetLine()`
  `Object.assign`s into the same sub-objects (L186-190) so references kept by steps stay valid.
- **qa reader** L146-156: `ctx.qa.expose('radio-world', () => ({ mode, frames, fps, modelMs, meters, screenHash,
  screenMean, screenNoise, eye }))` — hashes/means computed on read, not per frame.
- **one disposer per mount** L158-162 (link, eye, screen).
- **the world owns what chapters must not touch** (README «Rules»: env/post owned by the world; screen changes only
  through the model).
**Verdict: REF** for the whole file (the bench world is `circuit`-stage based, other recon). **COPY as is**:
`fnv1a` (L91-95, 5 lines, no imports) and `meanOf` (L97-101) for qa hashes of traces/solutions. **COPY+ADAPT** the
re-export block idea: `@electronics/shared/bench` (or `/world`) must re-export `Netlist`, `PartInstance`,
`PartReading`, `TopologyIssue`, `PARTS`/`resistorKey` (as needed) for the sandbox.

---

## 4. `app/src/volumes/radio/shared/screen/` (README calls these B1a)

| File | Lines | Imports | Exports |
|---|---|---|---|
| `screen/index.ts` | 2 | — | `export * from './eye'; export * from './screen'` |
| `screen/screen.ts` | 86 | `three` (DataTexture, Mesh, PlaneGeometry, ShaderMaterial, RedFormat, filters), `@radio/sim/core` (`COLS`, `ROWS`) | `interface Screen { object: Mesh; power: number; show(luma: Uint8Array): void; luma: Uint8Array; dispose() }` L37-47; `createScreen(opts: { width; height }): Screen` L49-86 |
| `screen/eye.ts` | 275 | `three`, `@/engine/api` (type), `@/style` (`kGlobals`) | `EYE_COLS 128`, `EYE_ROWS 96`, `EYE_SAMPLES 4` L26-29; `autoExposure(meanY)` L69; `lumaFromPixels(src, format, exposure, out, cols?)` L102; `lumaAround(luma, col, row, cols?)` L122; `createEye(ctx, { fov?, hide? }): Eye` L149 (extra renderer pass into a 128×96 MSAA target, read-back, save/restore renderer state in `finally` L187-228) |
| `screen/__tests__/screen.test.ts` | 49 | | texture 128×96 RedFormat, Nearest mag / LinearMipmapLinear min, `generateMipmaps`, `mipmapsAutoUpdate`, `NoColorSpace`; `show` bumps `texture.version` once; `luma` is the texture's own data |
| `screen/__tests__/eye.test.ts` | 258 | | eye math and pass bookkeeping |

`screen.ts` essentials: a one-channel `DataTexture` that **only `show()` updates** (L74-78); shader
`0.015 + 0.985·power·v^2.2` (L33): cell 255 = exactly 1.0 (no bloom), dark glass 0.015, scene light ignored; filters set
before first draw (L52-55: three allocates levels on first upload only).
**Verdicts:** `screen.ts` — **COPY+ADAPT** only if the 3D oscilloscope face is a raster the model writes (take size
from options instead of `COLS/ROWS`, maybe a trace rasteriser + phosphor colour from tokens); otherwise **REF** for the
principle «the instrument face shows only model output, unlit, white ≤ 1.0, mip-mapped so it does not shimmer when
small» (VISUAL §5 radio). `eye.ts` — **SKIP** (radio's camera-to-model path); **REF** for the save/restore-renderer
pattern if the loupe ever renders to a target. `lumaAround`, `autoExposure` — SKIP.

---

## 5. Other `radio/shared/**` — SKIP for the bench

| Dir | Lines | Why skip / what to look at |
|---|---|---|
| `models/` | 1 896 (house 425, index 356, fence 189, …) | yard props |
| `yard/` | index 325, layout 283, look 137, shots 92 | the yard world; `look.ts` (world owns env/post, `duskEnv`) is a REF for «the world owns the environment» |
| `whereami/` | index 99, dom 171, model 71 | REF only: a `custom` step control with a DOM widget (`whereami(ctx, opts): CustomSpec` L35) and sliders built by helpers that own their limits (`routeSlider`, `nudgeSlider` L62, L87) — P21: real sliders live only in the step panel, never inside a custom widget. It imports `SITE` from its own `@radio/sim/core`. |
| `README.md` | 134 | the shape to copy for `electronics/shared/README.md`: Mount snippet, options, state table «field · range · default · what», «who writes it» table, Rules, «For checks: `__app.read(...)`» field list, «Parts» table with batch/task |

---

## 6. `radio/sim/**` layout and the purity test

### 6.1 Layout

`app/src/volumes/radio/sim/core/` only (no `sim/<chapter>/`): `standard.ts`, `units.ts` (32), `rng.ts` (97),
`dsp.ts` (329), `video.ts` (319), `fm.ts` (166), `site.ts` (120) + `site.json`, `channel.ts` (305),
`interferers.ts` (159), `rf.ts` (180), `spectrum.ts` (139), `probe.ts` (278), `fm-link.ts` (387), `index.ts` (14,
barrel), `README.md` (58: module table with formula sources, Conventions, Tests), `__fixtures__/*.json` (10, from
`tools/ref-models/radio/*.py`), `__tests__/` (purity, oracle, per-module tests, `helpers.ts`, `curve.ts`,
`fm-link.bench.ts`). Conventions worth copying into the transient (README L29-47): continuity across calls
(«the result does not depend on how the stream is cut into calls»; `reset()` repeats bit for bit), **no allocation per
frame** (callers own output arrays), chance only from `createRng(seed).fork(label)`, and «loops over samples read no
imports» (copy imported constants into local `const`s before the loop: under vitest each import read costs ~13 ns).

### 6.2 Purity test — `radio/sim/core/__tests__/purity.test.ts` (118) → already copied as `electronics/sim/core/__tests__/purity.test.ts` (123)

- Scans every `*.ts` under `sim/` except `__tests__/` (L62-65) with `readdirSync(SIM, { recursive: true })`.
- Imports must stay inside `sim/` (relative only; any alias/package such as `three`, `@/engine/random`,
  `@radio/shared/...` is a violation) — `IMPORTS` regexes L13-17 cover `import … from`, `export … from`, bare
  `import '…'`, `import()`, `require()`; `inside()` L38-48.
- Forbidden names L24-35, searched **in comments too**: `Math.random`, `crypto.getRandomValues|randomUUID`, `Date.now`,
  `new Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `document`/`window` used as
  objects (`typeof x`, `x.`, `x?.`, `x[`).
- Self-test of the detector (L71-112), then `found == []` and `files.length ≥ 4` (electronics: ≥ 7).
Diff electronics vs radio: comments, describe titles in English, examples (`../../shared/sound`,
`@electronics/shared/bench`, `./parts`, `__fixtures__/divider.json`). **Verdict: done (COPY already made).**
Consequence: the worker/link/sound code must live in `shared/**`, never in `sim/**` (it needs `performance.now`,
`self`, `AudioContext`).

### 6.3 Reusable radio sim modules (if E1-7/E2 need them)

| Module | Exports | Imports | Verdict |
|---|---|---|---|
| `rng.ts` (97) | `interface Rng { u32(); float(); gaussFill(out, sigma); fork(label: number): Rng }` L5-20; `GAUSS_TABLE` L61; `createRng(seed): Rng` L72 | none | **COPY as is** into `electronics/sim/core/` if the melody's drums need seeded noise (E1-7: «власний генератор»); record in REUSE.md |
| `spectrum.ts` (139) | `interface Fft { size; forward(re, im) }` L13; `createFft(n: 256|512|1024|2048)` L25; `powerSpectrumDb(x, fft, out)` L120 | `./units` (`ampToDbm`) → drags `units.ts` (32) | **COPY+ADAPT** only if the scope or the E1-9 «high frequencies fall» check wants a spectrum (real input, dBV not dBm) |
| `dsp.ts` (329) | `Block`, `designLowpass`, `createFir`, decimator/interpolator, `mix`, `createDelay` | none | SKIP (an MNA transient is the filter) |
| `__tests__/fm-link.bench.ts` (20) | vitest `bench` inside `it` with `{ timeout: 60_000 }`, warm-up, `.run({ time: 3000 })`, `expect(result.throughput.mean) ≥ 16` | | **REF** for E1-7's `speed.bench.ts` (not a `.test.ts`, so not in `pnpm test`; run with `pnpm exec vitest bench <dir> --run --reporter verbose`) |

---

## 7. The sandbox `app/src/volumes/_dev/chapters/_sandbox-radio-link/` (the only `_sandbox-radio-*`)

| File | Lines |
|---|---|
| `index.ts` | 106 |
| `scene.ts` | 459 |
| `qa/measure.mjs` | 1 262 |

### 7.1 `index.ts` — words + manifest

- `export const SANDBOX = { steps: { eye, far, yard, where, live, still: { title, blurb } }, labels: {…}, shots: {…} }
  as const` (L14-92): **all** Ukrainian words of the sandbox live here (apostrophe `’`), the scene has none.
- `export default defineChapter({ id: '_sandbox-radio-link', order: 9020, group: 'em', title, subtitle, axisLabel:
  '10¹ m', axisValue: 1, theme: { accent: 'sky', sky: 'dusk', mood: 'diorama' }, steps:
  Object.entries(SANDBOX.steps).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })), load: () =>
  import('./scene'), dev: true })` (L94-106). `_dev` groups: `micro`, `em`, `plants`, `labs`
  (`_dev/volume.json`); the volume is registered only with `?debug` and never on the site (profile deletes `_dev`).
**Verdict: COPY+ADAPT** (id `_sandbox-electronics-bench`, order e.g. 9030, theme `{ accent: 'teal', sky: 'studio',
mood: 'studio' }`, own steps/labels).

### 7.2 `scene.ts` — how a sandbox drives the world

Imports (L31-49): `three`, `@/content` (`fmtNumber`, `fmtUnit`), `@/engine/api` (`Shot`, `defineScene`), `@/hud`
(`ControlSpec`, `StepUiSpec`, `stepUi`), and **only `@radio/shared/**`** — deep paths allowed
(`@radio/shared/yard/layout`, `/yard/look`: `showcase` needs `seg[1] === 'shared' && seg.length > 2`). Never
`@radio/sim/**` (lint), hence the world's re-exports.
Structure:
- `mountWorld(ctx, { seed: 1, dusk: 0.2 })` once (L82).
- `const ui = stepUi(ctx)`; control factories (`slider`, `toggle`, `meter`) L97-115; per-step `StepUiSpec` with
  `reset: true` L133-246; `ui.define(steps)`.
- **readouts on held pages are `text:` readouts, not numbers** (L102-115): a number readout counts up on the engine
  clock, which a held page never moves, so it would keep the previous value. Live fps readout uses `get:`.
- `WRITE` map control-id → model field (L250-266) + `writes` per step (L268-273); every `update` writes the current
  step's control values into the state (L436) before `world.update(dt, t)` (L450) — a slider and the model never part.
- `ctx.stage.define({ step: { camera?, enter } })` (L304-311); `enter` resets the model state (L294-302).
- QA readers: `radio-eye`, `radio-luma` (array), `radio-yard`, `radio-sandbox` (`lumaHash`, `stillHash` of a frame made
  by formula — determinism of the model in the browser), `radio-bench` (L422-428: 10 × `world.link.still(...).ms`
  averaged — **timing comes from the link's `ms`, because `performance.now` is banned in chapter files**); probes
  `ctx.qa.probe('eye:light-on-screen', () => Vector3 | null)` (L429-430).
**Verdict: REF** (structure), COPY+ADAPT the `WRITE`/`writes` idiom and the `*-bench` reader idea (DC solve ms;
transient seconds-of-audio per second from block `ms`).

### 7.3 `qa/measure.mjs` — the browser check

Header comment L3-46 lists sections and gates. Run: `node app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs
--port 5377 --out <dir> [--only eye,…] [--size 1280x720] [--touch]` against a dev/preview server of the full tree
(the sandbox is not on the site).
- File starts `#!/usr/bin/env node` + `/* global process, console, window, document, requestAnimationFrame,
  performance */` (L1-2; `eslint .` lints `.mjs` with `no-undef`).
- Imports from `../../../../../../../tools/qa/lib.mjs` (L50-62): `appErrors, appUrl, baseUrl, decodePng, ensureDir,
  hueFamilies, launch, openApp, parseArgs, parseSize, screenshot`.
- Helpers: `held(page)` = `__app.step(1/60, 0)` L90; `read(page, name)` = `__app.read(name)` L113; `stats` L114
  (`__app.stats()`: geometries/textures/programs, intervalAvg, cpuAvg); `position` L115; `frames(page, n)` (rAF waits;
  `__app.step` would stop the live clock) L120; `perFrame(page, reader, key, n)` L126; `open(page, step, freeze)`
  L140-152 (race with 180 s timeout, fonts ready, returns `__app.position()`); `at(pos, step)` / `where(pos)` L154-155;
  `locateOn(page, probe)` = `__app.locate` L899; `consoleText` L900; `grown(page, from)` — held frames until the reader's
  `frames` grows L907-914.
- Report: `report = { when, base, size, touch, q, gpu, sections: {}, checks: [], verdict }` L207-217;
  `check(what, ok, detail)` pushes and prints `ok`/`FAIL` L219-225; each section starts with `check('opened', …)` and
  returns if it fails; `SECTIONS = { eye, yard, whereami, ladder, repeat, live, bench, leaks }` L1217; `--only`;
  sections wrapped in try/catch → `check('error', false, stack)`; writes `<out>/measure.json`; last line
  `PASS sandbox-radio-link — <n> checks` / `FAIL k of n`, exit 0/1 (L1255-1262).
- Gates (constants L888-897): `ladder` — held page `?freeze=1`, mode must be `sync` (П11), per stop
  `__ui.set('route', r, true)` + `__app.step(1/60, 60)` + `grown`, then levels ±1.5 dB and noise strictly rising
  (L926-989); `repeat` — the held page opened twice → identical `stillHash`, eye frames within tolerance, same screen
  hash if same eye frame (L993-1053); `live` — first worker frame within 5 s (`mode === 'worker' && frames > 0`),
  then `__app.resetStats()` and the mean `modelMs` of 20 replies ≤ 100 ms, single mode `worker` (L1056-1133);
  `bench` — `radio-bench` normal and under `Emulation.setCPUThrottlingRate {rate: 4}` via `context.newCDPSession(page)`,
  `frameMs ≤ 250` (L1136-1162); `leaks` — 3 × `__app.goto('_sandbox-ui')` / back to `live`, memory counters must not
  grow, `page.workers().length === 1` within 5 s, console clean except one known `_sandbox-ui` warning (L1166-1213).
- Underruns: **not measured in radio** (no audio). The E1-9 plan defines them for `SoundOut` (blocks played,
  underruns, latency) and a `qa/check.mjs` (`batch-E1.md` L385-389).
**Verdict: COPY+ADAPT** the skeleton (args, helpers, report/check/verdict, `open`, `held`, `grown`, `live`, `bench`,
`leaks`); drop `eye`/`yard`/`whereami`/`ladder` bodies; add bench sections (see §10.3).

---

## 8. Documents and the volume's own check

### 8.1 `docs/volumes/radio/VISUAL.md` (524 lines) structure

Intro quote (L3-10: built for the builder and the auditor; numbers' source of truth; «who moves a number edits this
table in the same commit»), then nine numbered H2 sections — `## 1. Принципи` (L13: three-second test, 320 px
thumbnail, «one world»; one world per volume; operator flies only along the picture's road or through the loupe;
≤ 3 captions; «the screen shows only the model»), `## 2. Подвір’я` (L38, tables of places/materials/colours/numbers),
`## 3. Де ми` (L227), `## 4. Кольори зі змістом` (L246, colour-meaning tables), `## 5. Екран монітора` (L322: cells,
filters, white = 1.0, no engine grain, dusk tables, sharpness, ≤ ¼ frame of snow, dark glass), `## 6. Щуп і стрічка`
(L374: probe tip, strip window sizes, colours by tap), `## 7. Ракурси` (L410, shot table), `## 8. Телефон` (L464),
`## 9. Чек-лист аудитора кадру` (L479-524: checkbox list at 1280×720, 1920×1080, 3840×2160 and phone 390×844 —
three seconds, world visible, sizes, colours, «new things not before their step», ≤ 3 captions/≤ 80 words, transitions
≤ 2.2 s continuous, ≤ 4 hue families in `report.json`, nothing drawn that the model did not compute, 60 fps, clean
console). Circuit's `VISUAL.md` is the stand's own reference (sections 1–9 incl. «Один світ: стенд у темній
кімнаті», «Поверхи й камера», «Усередині міді», «Чек-лист») — other recon.
**Verdict: REF** — electronics VISUAL.md: same numbered-H2 shape, an «instrument face shows only the model» rule in
place of the screen rule, and a section list that its `check.py` asserts (rule 6).

### 8.2 `docs/volumes/radio/check.py` (296) rules (docstring L2-16)

1. «Основний шлях» rows in `PATH.md` = non-branch journey entries of `volume.json` (order, once, titles, minutes) —
   `rule1` L102.
2. every journey id has exactly one H3 `### \`id\` — title` in `PATH.md`; no heading outside the journey — `rule2` L127.
3. «Терміни шляху» in `PATH-ledger.md` and `chapters/_terms.md` list the same terms/steps; each once; each step's
   chapter in the journey and the step listed in `PATH.md` (`- \`chapter/step\` — …`) — `rule3` L152.
4. no U+00B5 and no straight apostrophe between Cyrillic letters in `docs/volumes/radio/` (except `plan48/`) and
   `app/src/volumes/radio/` (suffixes `.md .tsv .json .ts .mjs .py`) — `rule4` L177, `checked_files` L228. **Not**
   `_dev/` sandboxes.
5. no forbidden topic (`NOWHERE` regex L33-37: jamming, drones, military, radar…) in `chapters/*.md` and in the
   cards of `_terms.md` — `rule5` L188; `test_check.py` keeps the regex in step with `_terms.md`.
6. `VISUAL.md` has all `VISUAL_SECTIONS` (L41-42) — `rule6` L204.
7. every link of «Посилання на курс про електрику» starts at a listed step and leads to a page that exists in this
   tree (`pages()` L239-255 reads `chapters/*/index.ts` step literals and `content/generated/*.manifest.json`) —
   `rule7` L209.
Output: one `radio check: <problem>` per problem (a missing document is one), a counts line, then `radio check: OK`
(exit 0) or `radio check: N problem(s)` (exit 1). Forbidden characters written as escapes (the file checks itself).
**Verdict: COPY+ADAPT** in E1-8 (`batch-E1.md` L346-350 lists the electronics rules: journey vs PATH.md; one heading
per id; ledger steps exist; U+00B5/straight apostrophe in `docs/volumes/electronics/` and
`app/src/volumes/electronics/`; forbidden topics — mains 230 V as an instruction, «how to ignite/explode»; output
`electronics check: OK`). Consider also scanning `_dev/chapters/_sandbox-electronics-*` for rule 4 (radio does not).

---

## 9. Site profile and `pages.yml`

- `tools/site/build.mjs` (97): refuses before copying (id ≠ `--volume`, `aside`, busy port L38-50); copies `app/`
  without `node_modules`/`dist`/`.vite`, links `node_modules` (L58-60); **deletes every other volume incl. `_dev`,
  `_demo`, `_path`** (L62-66); writes `library.json = { title: null, defaultVolume: <volume> }` and sets the volume's
  `status: 'published'` (L68-70); runs `tsc --noEmit` and `vite build --outDir <out> --emptyOutDir` from
  `app/node_modules/.bin` (L82-90; never pnpm in the copy); then `smoke.mjs` under `/<sub>/` (L95-97).
- `.github/workflows/pages.yml`: Types → Lint → Unit tests (`--testTimeout=30000`) → Documents (`doccheck --all`,
  radio `test_check.py`, radio `check.py`; E1-8 adds electronics' two lines) → «Site profile» (`--volume radio --out
  $RUNNER_TEMP/site --sub ${BASE_PATH#/}`) → «Electronics» (`--volume electronics --out $RUNNER_TEMP/site/electronics
  --sub ${BASE_PATH#/}/electronics`, after radio because radio's vite build empties the dir) → nuclear copy → upload.
- Local whole site: `tools/site/README.md` L82-100 (radio + electronics into `~/.cache/radio-pop-science/site-pages`,
  serve on 5395, four `PASS site smoke`; run in background).
- Consequences for E2: anything `electronics/**` imports must be inside `electronics/` or the platform (other volumes
  do not exist in the copy → `tsc` fails); the sandbox is never on the site; the site smoke checks the lobby only
  until a chapter exists. **Radio has no built chapters, so no published site has ever shipped the model worker** —
  the electronics bench will be the first worker under a Pages sub-path (facts `sim-worker-lint.md` §4.2 verified the
  form on a scratch build under `/radio-pop-science/`: worker file `assets/model.worker-<hash>.js`, IIFE, URL relative
  to the importing chunk).
**Verdict: USE as is** (no change needed for E2; E1-8 owns the Documents lines).

---

## 10. Recommendation for the electronics bench

### 10.1 Threads and who owns what

| Need | Where | Cadence | Determinism |
|---|---|---|---|
| Operating point (meters, LED light, heat target, issues) | main thread, `solveDC(circuit, { state })` in shared bench code | on board/setting change (dirty version), not per frame | same on live and held pages |
| Heat/burn accumulation over time (E1-4/E1-5 «функція накопичення») | wherever E1-4 puts it; if DC-driven, main thread per `update(dt)` on engine time | every update with `dt > 0` | engine time, so `?freeze` steps reproduce it |
| Audio blocks (speaker current) + scope taps on a live page | worker (link pattern, §2) | paced by the audio queue; blocks 50–100 ms (2048–4096 @ 48 kHz); queue ≤ 3 | not deterministic (timing); never used for QA numbers except counts/ms |
| Scope trace on a held page | sync `still` on the main thread (own model instance) | first held frame after a change | depends only on (netlist, settings, window) |
| Part state during sound (capacitor charge, lamp temperature, damage) | the worker's transient owns it while running; replies carry a snapshot by part id; main mirrors it (damage monotonic: merge with OR/max) | per reply | — |

### 10.2 Sketch of the shared surface (names provisional)

```ts
// electronics/shared/bench (or /world): one call per mount, like mountWorld
export function mountBench(ctx: ChapterContext, opts?: { link?: 'auto' | 'sync' | 'off'; audio?: boolean }): Bench;
interface Bench {
  readonly board: Board;               // sockets, rows, placed parts; builds Netlist (ground row = node 0)
  readonly solution: DcSolution | null; // last operating point
  readonly link: ModelLink | null;     // transient worker (from E1-9's shared/sound or shared/link)
  reset(preset?: Netlist): void;       // a step's own small circuit
  update(dt: number, t: number): void; // writes nothing a chapter owns; solves when dirty; pumps the link
}
// qa reader 'electronics-bench': { mode, version, nodes, parts: {id: {u,i,p,state}}, issues, dcMs, blocks, blockMs,
//   underruns, latencyMs, audio: {state, gain}, scopeHash }
```

### 10.3 Sandbox `_sandbox-electronics-bench` and its QA (proposed)

- Steps (one idea per step): `board` (empty board + tray; drag by pointer), `divider` (preset 9 V → 1 kΩ/2 kΩ, probe),
  `heat` (overloaded resistor goes hot → burnt over engine time), `scope` (player → RC → speaker, Chart + 3D face),
  `sound` (live audio), `still` (held-page ladder of pot positions), `loupe` (dive axis stand→part→inside→atoms).
- `qa/measure.mjs` sections: `board` (real pointer drag snaps to a socket; reader's netlist = expected parts/nodes;
  numbers vs hand values, e.g. 9 V battery on 1 k/2 k → 5.997 V); `meter` (probe on a node → readout text equals
  `parts[...]`/`v[...]`); `heat` (held page + `__app.step` k frames → `hot` then `burnt`, stays burnt until replaced);
  `repeat` (held page twice → same DC hash and same `still` scope hash); `live` (worker mode, first block ≤ 5 s, mean
  block `ms` over 20 replies ≤ gate derived from E1-7 «≥ 3× real time»); `phone` (sync path under 4× throttle,
  seconds of audio per second ≥ 1 or the loop fallback engaged); `sound` (URL without `noaudio`, click, 10 s,
  `underruns === 0`, mute setting → gain 0 or suspended, `?noaudio` → no `AudioContext`); `leaks` (3 visits:
  memory flat, `page.workers().length === 1`, no live `AudioContext` — count constructions/closes with
  `context.addInitScript` wrapping `window.AudioContext`); `console` in every section.

---

## 11. Verdict table (radio → electronics)

| Item | Verdict | Note |
|---|---|---|
| `radio/shared/link/protocol.ts` | COPY+ADAPT | board/block payload; drop luma/screen/probe |
| `radio/shared/link/handler.ts` | COPY+ADAPT | model = Transient; recompile on version; state carry-over by part id |
| `radio/shared/link/model.worker.ts` | COPY | 9 lines |
| `radio/shared/link/index.ts` | COPY+ADAPT | audio-clock pacing; rename `Link`; log prefix; sync-fallback budget |
| `radio/shared/link/__tests__/*` | COPY+ADAPT | FakeWorker, ctx stub, case list + continuity/version cases |
| `radio/shared/world/index.ts` | REF | mount/create split, frozen flag, held-frame logic, qa reader, re-exports for `_dev` |
| `fnv1a`, `meanOf` (world L91-101) | COPY | qa hashes |
| `radio/shared/world/__tests__/world.test.ts` | REF | `vi.mock(importOriginal)` + stand-ins |
| `radio/shared/screen/screen.ts` | COPY+ADAPT or REF | only if the 3D scope face is a model-written raster |
| `radio/shared/screen/eye.ts` | SKIP | (REF: renderer state save/restore) |
| `radio/shared/{models,yard}` | SKIP | |
| `radio/shared/whereami` | REF | custom control + slider helpers pattern |
| `radio/shared/README.md` | REF | shape of `electronics/shared/README.md` |
| `radio/sim/core/__tests__/purity.test.ts` | done | already copied |
| `radio/sim/core/rng.ts` | COPY (if needed) | seeded noise for drums (E1-7) |
| `radio/sim/core/spectrum.ts` (+`units.ts`) | COPY+ADAPT (optional) | spectrum checks / view |
| `radio/sim/core/__tests__/fm-link.bench.ts` | REF | speed bench shape |
| `_dev/chapters/_sandbox-radio-link/index.ts` | COPY+ADAPT | words const + dev manifest |
| `_dev/chapters/_sandbox-radio-link/scene.ts` | REF | stepUi, WRITE map, readers, text readouts on held pages |
| `_dev/chapters/_sandbox-radio-link/qa/measure.mjs` | COPY+ADAPT | skeleton + live/bench/leaks |
| `docs/volumes/radio/VISUAL.md` | REF | numbered H2 + auditor checklist |
| `docs/volumes/radio/check.py` (+`test_check.py`) | COPY+ADAPT | E1-8 |
| `tools/site/build.mjs`, `pages.yml` | USE | already builds electronics |
| `tools/qa/lib.mjs` | USE | read-only platform tool |

---

## 12. Gotchas

1. **Volume boundary.** `local/volume-boundary` (eslint `files: src/**/*.ts`): no file of `electronics` may import
   `radio`/`circuit`. Copies go to `electronics/shared/**` + a row in `docs/volumes/electronics/REUSE.md` («звідки»,
   «що змінимо»). The site profile deletes other volumes, so a stray import also breaks the site's `tsc`.
2. **Sandboxes import only `@electronics/shared/**`** (`showcase`, `app/eslint-rules/chapter-boundary.js` L27). Non-
   chapter files of `_dev` may import no other volume at all. Shared must re-export what the sandbox needs from
   `sim` (radio `world/index.ts` L31-42).
3. **Determinism lint (chapter files only, `src/volumes/*/chapters/**`, eslint.config.js L54-60):** `Date.now`,
   `performance.now`, `window.setTimeout`, `Math.random` are errors; bare `setTimeout`, `requestAnimationFrame`,
   `queueMicrotask` are *not* flagged (facts §1.3) but break QA determinism all the same — do not use them.
   **`setInterval` is banned in every `src/**/*.ts`** (L29-32), shared and sim included — audio scheduling must be
   pumped from `update` or audio callbacks, never an interval. `no-console` allows only `warn`, `error`, `info`; and
   `__app.errors()` records `warn` and `error`, so any warning fails chapter-check (a «no worker» note may only be
   silent or `console.info`).
4. **`sim/**` purity is a test, not lint**: forbidden names are searched in comments too (`purity.test.ts` L24-35, L57).
   Do not even mention `performance.now` in a sim comment. The link/worker/sound go in `shared/**`.
5. **Timing in a sandbox/chapter**: `performance.now` is banned there, so model ms come from the handler's `ms`
   (radio `scene.ts` L420-428 comment). Expose timings from shared code.
6. **`?freeze`** = up to 180 synchronous `update(1/60)` with no render and no event-loop turn, then held frames with
   `dt = 0` (facts §5.3, M5). A worker reply cannot arrive inside it; never pump audio/transient during it; compute held
   output once per change on the first held frame. There is no deterministic flag on `ctx`: read
   `new URLSearchParams(globalThis.location?.search ?? '').has('freeze')` (radio `world/index.ts` L232).
7. **Readouts on held pages**: a number readout counts up on the engine clock and freezes on a held page — use
   `text:` readouts for values QA reads on held pages (radio `scene.ts` L102-115).
8. **No module-level state** (two copies of a chapter coexist up to 12 s at a boundary, П12; chapter-check enters/leaves
   3×): worker, `ModelState`, `AudioContext` belong to the mount, released via `ctx.onDispose`.
9. **Worker typing**: `tsconfig` `lib` lacks `WebWorker` → `/// <reference lib="webworker" />` + `declare const self:
   DedicatedWorkerGlobalScope` (radio `model.worker.ts` L1-4); or `postMessage(x, { transfer })`. TS 6 typed-array
   generics: `Float32Array` (= `<ArrayBufferLike>`) vs `new Float32Array(n)` (`<ArrayBuffer>`) mismatch on returns
   (facts §2). `verbatimModuleSyntax`: `import { type X }`.
10. **vitest has no `Worker`, `self`, `window`, `document`, `location`** (`environment: 'node'`, `vite.config.ts`
    L77-80): test the handler as a function and the link with an injected `makeWorker`; importing the worker entry
    throws.
11. **CPU throttling does not reach a worker** (П10, facts §4.4): the phone gate must time the sync path.
    `__app.measure` and chapter-check's 8 ms gate see only main-thread CPU: worker time is invisible, a sync fallback
    at audio rate lands in `cpuAvg` and triggers dynamic resolution after 45 slow frames (facts §6.2).
12. **Engine update stops when the tab is hidden** (`engine/app.ts` L347-354), but an `AudioContext` keeps running →
    underruns. The platform audio suspends its context on `visibilitychange` (`app/src/audio/plugin.ts` L52-53) — do
    the same in `SoundOut`, and do not count underruns while hidden.
13. **QA URLs always carry `noaudio`** (`tools/qa/lib.mjs` L103; the engine reads presence, `engine/app.ts` L68): a
    sound check must build its own URL (strip `noaudio`). `ctx.gesture` resolves on the first pointer/key of the
    session (`engine/runtime.ts` L704) — click in QA; GPU_ARGS already pass `--autoplay-policy=no-user-gesture-required`
    (lib.mjs L34), which does not resolve `ctx.gesture`.
14. **AudioWorklet is secure-context only**; the app is served over plain HTTP on a LAN («do not rely on secure-
    context-only APIs», ARCHITECTURE L13-14, facts §4.1). Schedule `AudioBufferSourceNode`s by
    `AudioContext.currentTime` (E1-9 plan), not a worklet.
15. **Platform audio limiter** (to stay no louder than the engine): `DynamicsCompressor` threshold −12, knee 6, ratio 20,
    attack 0.003, release 0.25 (`app/src/audio/engine.ts` L108-113); settings via `ctx.store.subscribe((s) =>
    s.settings.volume, fn, { immediate: true })` and `s.settings.audio` (`audio/plugin.ts` L38-42; store L28-31).
    Unsubscribe in `onDispose`.
16. **Name clash**: `@electronics/sim/core` exports `type Link = readonly [number, number]` (`parts.ts` L86) and
    `Element`; radio's link exports `interface Link`. Rename the copied link type (`ModelLink`).
17. **Netlist rules**: pins in catalog order; `nodes` integer ≥ 1; node indices in range; ids unique and non-empty;
    settings finite — else `RangeError` from `compile`/`solveDC`. A compiled circuit follows `part.setting` live but
    any other change needs a new `compile`. Ground = node 0. `ideal-9v` is in the catalog but never on the bench.
18. **Wires are 1 mΩ** (`WIRE_OHMS`): a jumper across the 9 V battery gives 9/(1.5+0.001) A (0.07 % from E/r);
    a `short` issue is reported anyway. The 9 V battery's 1.5 Ω means a 1 k/2 k divider reads 5.997 V, not 6.000 V —
    QA expectations must use the battery numbers.
19. **One `console.error` per link life** (radio `index.ts` L112-116; test L140-141) — chapter-check fails on any error
    line, so a failing worker in QA shows up exactly once and is a real defect.
20. **Messages from QA readers**: `ctx.qa.expose` readers are per mount (`engine/runtime.ts` L714) — after leaving,
    the reader is gone, so «no live AudioContext after exit» cannot be read from the sandbox's own reader.
21. **Test titles in English** for electronics (E1-3 deviation 7; radio's are Ukrainian); code has no Ukrainian words —
    sandbox words only in `index.ts`'s `SANDBOX` const (radio precedent) — E1-9 plan says «підписи пісочниці — з її
    документа».
22. **Apostrophe/micro**: `’` (U+2019) and `μ` (U+03BC) everywhere; radio's rule 4 scans `app/src/volumes/radio/`
    but not `_dev/` — an electronics check that should cover the sandbox must add it.
23. **Unit tests in CI run with `--testTimeout=30000`** (pages.yml), locally default 5 s: long transient sweeps need an
    explicit `{ timeout }`.
24. **Do not run `pnpm` inside a site-profile work copy** (`tools/site/README.md` L153-175); `pnpm format` is
    forbidden (global constraints).
25. **Radio's link pacing is engine-time based** (`LINK_MAX_FPS` on `ctx.clock.time`): copying it unchanged for audio
    would starve the audio queue at low frame rates (dt clamp 1/15 s) — pace by the audio clock.

## 13. Open questions

1. **Order vs E1-9.** `shared/sound` (SoundOut + model worker) is planned in E1-9, after E1-4…E1-8, none landed.
   Does E2 wait for E1-9's worker API, or define the link first and let E1-9 adopt it? (Recommend: one worker module
   for transient blocks, owned by `shared/sound` or `shared/link`, consumed by the bench.)
2. **Live vs loop.** E1-7 decides «наживо» (≥ 3× real time here) or the loop fallback; the bench's pacing and phone
   gate depend on it. What is the phone gate number (radio used 250 ms per frame under 4× throttle)?
3. **State ownership while sound runs.** Main-thread DC/heat vs worker transient: which one decides `hot`/`burnt`
   when both run? Proposal: worker owns time state while the transient runs; main mirrors replies; damage is
   monotonic.
4. **Ground row.** Which board row/rail is node 0 (the battery's minus rail?) and what if the reader wires the battery
   elsewhere (`ungrounded` tie at 1 GΩ makes numbers float relative to ground; the multimeter measures differences,
   so maybe fine, but the scope's reference must be defined).
5. **Scope on held pages.** Which window (start sample, warm-up length, trigger) does `still` capture so the trace is
   stable and QA-comparable? Two channels («before/after the part»): one request with two taps?
6. **Block size and fs.** 2048 vs 4096 at 48 kHz vs 24 kHz (latency ≈ 0.1–0.2 s per design §6.3) — E1-7 numbers.
7. **3D scope face**: raster DataTexture written by the model (copy of radio `screen.ts`) or a line mesh fed from the
   same samples as the HUD `Chart`?
8. **Sandbox words.** Radio keeps them in `index.ts`; E1-9 plan says «з її документа» — is there a sandbox document
   (none for radio), or the `SANDBOX` const?
9. **«No live AudioContext after exit»**: OK to wrap `window.AudioContext` from a Playwright init script in the QA
   script (no app change), since per-mount readers vanish on exit?
10. **Worker on the Pages sub-path** has never shipped in a published build of this repo (radio has no chapters):
    should the E2 batch add a site-smoke step that opens a bench chapter and asserts `mode === 'worker'` once the
    first chapter exists (E3)?
