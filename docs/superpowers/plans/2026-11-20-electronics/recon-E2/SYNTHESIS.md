# Recon E2 · SYNTHESIS — the electronics bench: modules, copies, board model, interaction, instruments, batch split

Read-only synthesis, written 2026-11-20 against `main` at `2707887` (tree clean; E1-4 is being implemented elsewhere and
has not landed). Inputs: the five maps next to this file (`stage.md`, `build.md`, `platform.md`, `radio.md`,
`world.md`), the design `docs/superpowers/specs/2026-11-20-electronics-volume-design.md` §5–§6, §8, the brief format
`docs/superpowers/plans/2026-11-20-electronics/batch-E1.md`, the constraints `.superpowers/sdd/2026-11-20-electronics/
global-constraints.md`. Every claim this file relies on was re-opened at the cited line (list in §0.2).

Paths: `app/src/…` unless they start with `docs/`, `tools/`, `.superpowers/`. Short forms: `E/` = `app/src/volumes/
electronics/`, `C/` = `app/src/volumes/circuit/`, `R/` = `app/src/volumes/radio/`, `S/` = `C/shared/stage/`,
`B/` = `C/chapters/build/parts/`. «L12-30» = lines 12–30.
Verdicts: **COPY** as is (only import paths change) · **COPY+ADAPT** (what changes is said) · **USE** the platform API
directly · **REF** read for the pattern, write our own · **SKIP**.
«Decision (synthesis)» = a call this file makes where the design leaves the choice to builders; the E2 brief may adopt
or override it; VISUAL.md (E2-1) fixes visual numbers.

---------------------------------------------------------------------------------------------------------------------

## 0. In one screen

- **Where things live.** Pure board logic (sockets → rows → `Netlist`) goes to **`E/sim/board/`**: it is pure TS, the
  existing purity test (`E/sim/core/__tests__/purity.test.ts` L62-66 scans every `.ts` under `sim/` recursively) covers
  it for free, and relative imports into `../core` are allowed (`inside()` L38-48). Everything three.js goes to
  **`E/shared/{bench,parts,hand,instruments,model,dive}`**; **`E/shared/sound`** is E1-9's. The `_dev` sandbox
  `_sandbox-electronics-bench` may import only `@electronics/shared/<module>` (≥ 3 path segments — the root
  `@electronics/shared` is a lint error, `eslint-rules/chapter-boundary.js` L27 `seg.length > 2`), so `shared/bench`
  re-exports what it needs from `sim/**`.
- **What is copied.** ≈ 1 500 lines of the circuit stage (room, base, light, materials, shots, dyn-tube, lens, mount
  trimmed to ~150 lines), ≈ 1 100 lines of `build`'s hand (glide, end→leg, curves, grips, hands generalised, swap,
  switch, cue), ≈ 870 lines of the dive kit (rail maths, camera rail, lens keeper, door, levels, poses), the lamp
  (bulb ≈ 250 + heat scale ≈ 80) and small radio helpers (`fnv1a`, `meanOf`, sandbox/QA skeletons). The radio model
  link is **not** copied by E2: E1-9 copies it into `shared/sound`; E2 consumes it.
- **Board model.** A stylised breadboard: 17 columns × lines a–e / f–j + one `+` rail (far) and one `−` rail (near);
  **node = connected row**, the `−` rail is node 0; the 9 V battery and its switch are fixed parts between a private
  node and the rails; speaker, player and lamp reach the board through **plug leads** the reader (or a step) puts
  into sockets. A part with a leg out is left out of the netlist (`pending`); a burnt part stays in it (the model keeps
  damage by part id, E1-4) until it is removed — a replacement gets a new id.
- **Interaction.** Two gestures on one generic `hands` (generalised from `B/hands.ts`): **carry a whole part** by its
  body (tray → board, board → board, board → tray), legs previewed over target sockets and committed on release;
  **re-seat one leg** (or one end of a jumper / lead / probe) with `build`'s mid-drag snap. Sockets are never
  pickables: snapping is grid maths (`layout.nearest`).
- **Instruments.** Multimeter number = HUD `readout` with `text()` (immediate, held-page safe), modes V / A (meter as
  a series `jumper` part between its probes) / Ω (test-source solve on a copy of the netlist with sources removed).
  Oscilloscope = board `chart` control with a fixed X span fed by `setData` once per **triggered sweep**
  (min/max-decimated to ≤ 600 points per channel), `roll` mode (`push` + `window`) for slow RC; the 3D instrument is
  `@/fx` `createScope` fed by the same sweep at 160 points. Sample rate = E1-7's choice (24 or 48 kHz).
- **Batch E2 = 10 tasks** (§6). Can start now (need only E1-3): E2-2 (board as data), E2-8 (dive). Need E1-8 docs:
  E2-1. Hard-gated: **E2-7 heat/burn after E1-4**, **E2-9 scope after E1-5** (live after E1-9, music after E1-7),
  **E2-10 sound after E1-7 + E1-9**; part-catalog bindings of E2-4 grow as E1-4/5/6 add kinds.

### 0.1 What exists now in `E/` (checked)

`volume.json` (axis floors `atoms 0 · inside 1 · part 2 · stand 3`, accent teal, draft), `volume.ts`, `chapters.ts`
(glob, no chapters), `__tests__/journey.test.ts`, `sim/core/{netlist 54, parts 312, mna 201, topology 90, dc 86,
state 15, index 7}.ts`, `README.md` 178, tests (purity, parts, mna, dc, topology, oracle), 7 fixtures. **No `shared/`,
no `docs/volumes/electronics/` yet** (E1-8 creates the docs incl. `REUSE.md`; E1-9 creates `shared/sound`).
E1-8's file list (`batch-E1.md` L322-323) has **no `VISUAL.md`**, although design §8.2 lists it in E1 and §10 puts the
board geometry there → E2-1 writes it.

Model API the bench builds on (verified in source):
```ts
// E/sim/core/netlist.ts
export const GROUND = 0;                                                         // L8
export interface PartInstance { id: string; spec: string; pins: number[]; setting?: number }   // L11-21
export interface Netlist { nodes: number; parts: PartInstance[] }                // L24-28
export function checkNetlist(net: Netlist): void                                 // L31 RangeError naming the fault
// E/sim/core/parts.ts
export interface Limits { readonly powerW?: number; readonly currentA?: number }  // L14-17
export type PartSpec = BatterySpec | SourceSpec | ResistorSpec | PotSpec | SwitchSpec | JumperSpec | SpeakerSpec; // L81
export type PartKind = PartSpec['kind'];                                         // L83
export type Link = readonly [number, number];                                    // L86 (name clash with radio's Link)
export const PARTS: Readonly<Record<string, PartSpec>>;                          // L284-295: battery-9v (9 V, 1.5 Ω),
//   battery-4aa, battery-aa, ideal-9v (never on the bench), resistor-<IEC code> ×169 (0.25 W, 5 %), pot-10k (0.2 W),
//   switch, jumper (1 mΩ), speaker-8 (2 W), earphone-32 (0.1 W)
export function resistorKey(ohms: number): string                                // L299  4700 → 'resistor-4k7'
// E/sim/core/mna.ts
export function compile(net: Netlist): Circuit       // allocates once; unused nodes skipped (index −1, L18-22)
export function readSettings(c: Circuit): Float64Array   // reads e.part.setting at every solve → knobs need no recompile
// E/sim/core/topology.ts
export type TopologyIssue = {kind:'open';part} | {kind:'short';part} | {kind:'floating';part;pins} | {kind:'ungrounded';nodes};
// E/sim/core/dc.ts
export interface PartReading { u: number; i: number; p: number }                 // L11 (u pin0→pin1, i into pin0)
export interface DcSolution { ok; reason?: 'singular'; v: Float64Array; parts: Record<string, PartReading>; iterations; issues }
export function solveDC(net: Netlist | Circuit, opts?: { state?: ModelState }): DcSolution   // never throws on singular
// E/sim/core/state.ts
export interface ModelState { v: Float64Array }     // grows in E1-4…E1-6 (filament temperature, charge, damage by id)
```

**E1-4 as it stands uncommitted in the working tree at the time of writing** (another process; may still change —
re-read before E2-6/E2-7): `state.ts` → `ModelState { v; parts: Map<string, PartMemory> }`, `PartMemory { heat /* share
of limit */; burnt; kelvin? }`, `memoryOf(state, id)`, and the rule «a stand that takes a part off the board for good,
or puts a new one in its place, **deletes its entry**»; `limits.ts` → `type Condition = 'ok' | 'warm' | 'hot' |
'burnt'`, `PartStatus { condition; load }`, `WARM_LOAD 0.5`, `HEAT_SECONDS` per kind (resistor 10 s, LED 2 s, lamp 2 s,
diode 5 s, battery 2 s), `loadOf(spec, reading)` (max of power/current/reverse-voltage shares), `advanceHeat(state, net,
dc, seconds): string[]` (ids that burnt now; the next solve with this state leaves them out); `dc.ts` →
`DcSolution.status: Record<id, PartStatus>`, `sourceSteps`, `DcFailure = 'singular' | 'no-convergence'`,
`DcOptions.maxIterations`; burnt parts stamp nothing (`mna.ts` «broken»); `Limits.reverseV`; new kinds `diode`, `led`,
`lamp` (`diode.ts` `ledLumens(spec, amps)`, `lamp.ts` `filament(spec, volts)`). The bench design below already fits
this shape.

### 0.2 Spot-checks done (claim → where verified)

`ctx.gesture: Promise<void>` on `ChapterContext`, no `ctx.input.gesture` (`engine/chapter.ts` L224-225, `ScopedInput`
`engine/input.ts` L114-130) · `PointerInfo.object` is the **registered** object, the pick walks up from the hit mesh
to the first registered ancestor (`input.ts` L35-37, L406-413) · `DragInfo.planePoint` (`input.ts` L44-58) · lint:
`setInterval` banned in all `src/**` (`app/eslint.config.js` L28-32), `Date.now`/`performance.now`/`window.setTimeout`/
`Math.random` only in `src/volumes/*/chapters/**` (L37, L54-60) · showcase rule needs `seg.length > 2` and applies only
to chapter files (`chapter-boundary.js` L27, L146) · `ReadoutSpec {get?, text?, format?, color?}` (`hud/step-ui-types.ts`
L69-81), `ChartSpec {init?, update?}` (L95-103) · DOM readout count-up `STEADY 0.25`, `COUNT_UP 0.45`
(`hud-dom/dock/controls/readout.ts` L19-20) · DOM chart rebuilt per step entry (`hud-dom/dock/build.ts` L94-97,
`hud-dom/charts/index.ts` L21-33), `push` scrolls only forward (`hud-dom/charts/chart.ts` L87-109) · `createScope`,
`setSamples` resamples by nearest index, self-ticks with `onTick` (`fx/signals/scope.ts` L13-131) · `instanced(model,
placements)` (`kit/core/instancing.ts` L13), `Placement {at, ry?, s?, tint?}` (`kit/core/builder.ts` L637) ·
`applyHeat` (`fx/thermal/heat.ts` L103), `paintEmissive`/`K_EMISSIVE_ATTRIBUTE` (`style/materials/toon.ts` L245-251) ·
platform limiter −12 dB / knee 6 / ratio 20 / 3 ms / 0.25 s and `volume² × MASTER_LEVEL` (`audio/engine.ts` L98-145),
plugin wiring incl. `visibilitychange` suspend (`audio/plugin.ts` L32-85) · QA URLs always add `noaudio`
(`tools/qa/lib.mjs` L103) · freeze sniff `new URLSearchParams(globalThis.location?.search ?? '').has('freeze')`
(`R/shared/world/index.ts` L232) · `fnv1a` L91-95, `meanOf` L97-101 (same file) · radio link API (`R/shared/link/index.ts`
L25-70, spawn L85-89) · circuit stage: `BOARD` 6.6 × 4.4, tilt 15°, 1 unit ≈ 26 mm (`S/layout.ts` L5-21), `LENS` L82-91,
`mountStage` sequence (`S/index.ts` L173-206: `ctx.env.setScale(3.6)`, `ctx.post.base(STAGE_POST.stand)`, `tameAll`,
`createLight`, `setShadow`), `STAGE_SHOTS.stand` position [0, 8.05, 8.6], comment «52°» (`S/shots.ts` L54-62), gauge
constants and `GAUGE_HOME` (`S/tools/gauge.ts` L50-84), `followVoltage` (`S/battery-cell.ts` L119-122) · `B/hands.ts`
`SNAP 0.34`, `AWAY 0.5`, `near` never set non-null (L17-19, L46, L113), `B/ends.ts` `seated` set on arrival (L108),
`B/glide.ts` 61 lines no imports · `C/chapters/battery/parts/cue.ts` 43 lines · `C/shared/world/{dive 222, levels 94}`,
`C/chapters/lamp/parts/{rail 151, door 66, lens-keeper 116}`, imports as stated in §2 · `_dev` chapter orders in use
9001–9003, 9010, 9011, 9020, 9101, 9102 · chapter-check fails > 350 draw calls (`tools/qa/chapter-check.mjs` L185) ·
vitest `environment: 'node'` (`app/vite.config.ts` L77-80) · circuit VISUAL «без перфорації, сітки…» (L41), bloom only
from the filament (L71).

---------------------------------------------------------------------------------------------------------------------

## 1. Module layout and public API sketches

```
E/sim/board/                 pure TS (purity test), unit-tested, no three — sockets, rows, footprints, seating, netlist
E/shared/
  README.md                  shape of R/shared/README.md: mount snippet, options, state table, who writes what, rules,
                             «For checks: __app.read(...)» fields, parts table with batch/task
  bench/                     the world: room, base, light, materials, board view, fixed items, lens tools, mountBench
  parts/                     part models (kit Builder), colour code, looks (heat, glow, burnt), the lamp
  hand/                      glide, leg, curves, grips, generic hands, tray, swap, cue, terrain
  instruments/               multimeter (model + probes + reading), oscilloscope (sweep/trigger/decimation + chart + 3D)
  model/                     the bench's model driver: compile on topology change, solve on setting change, part
                             status, held-page still, consumption of the E1-9 link; qa hashes
  dive/                      floor axis stand → part → inside (→ atoms later): rail maths, camera rail, door, keeper
  sound/                     E1-9 (SoundOut + worker link); E2 only wires the speaker into it
```
Each `shared/<module>/index.ts` is the module's public face; there is **no `shared/index.ts`** (the sandbox could not
import it anyway). `shared/bench/index.ts` re-exports the sim types and functions the sandbox needs (radio precedent
`R/shared/world/index.ts` L31-42).

### 1.1 `E/sim/board/` — the breadboard as data (new, ≈ 450 lines + tests)

```ts
// layout.ts — numbers only; board frame: origin = centre of the breadboard face, +x right, +z toward the reader (units)
export type Line = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | '+' | '-';
export type SocketId = string;   // `${line}${column}` — 'a1' … 'j17', '+1' … '+17', '-1' … '-17' (real breadboard names)
export type RowId = string;      // a connected group: `${column}ae` | `${column}fj` | '+' | '-'
export interface SocketSpec { readonly id: SocketId; readonly row: RowId; readonly line: Line; readonly column: number;
  readonly gx: number; readonly gz: number /* grid indices: column 0…, line + 0, a 1 … e 5, f 6 … j 10, − 11 */;
  readonly x: number; readonly z: number }
export interface BoardSpec { readonly columns: number; readonly pitch: number; readonly channel: number; readonly railGap: number }
export const BOARD_SPEC: BoardSpec;   // decision (synthesis): { columns: 17, pitch: 0.3, channel: 0.3, railGap: 0.15 }
export interface BoardLayout {
  readonly spec: BoardSpec; readonly sockets: readonly SocketSpec[];
  /** Node order: rows[0] = '-' (ground, node 0), rows[1] = '+', then '1ae', '1fj', '2ae', … (34 rows for 17 columns). */
  readonly rows: readonly RowId[];
  socket(id: SocketId): SocketSpec | undefined;
  atGrid(gx: number, gz: number): SocketSpec | undefined;
  /** The socket whose mouth is nearest (x, z) within `within` units, by grid maths (O(1), no search). */
  nearest(x: number, z: number, within: number): SocketSpec | null;
  readonly size: { width: number; depth: number };   // the body under the sockets
}
export function createLayout(spec?: BoardSpec): BoardLayout;

// footprint.ts — how a kind of part sits in sockets
export type Shape = 'axial' | 'radial' | 'to92' | 'pot' | 'wire';
export interface Footprint {
  readonly shape: Shape;
  /** Leg offsets in grid steps from leg 0, at orientation 0 (legs along +column); length = catalog pins.length. */
  readonly offsets: readonly (readonly [dx: number, dz: number])[];
  /** A re-seated leg may sit this far from the others (bendable leads; 'wire' 1…16). */
  readonly minSpan: number; readonly maxSpan: number;
}
export type Orientation = 0 | 1 | 2 | 3;                  // quarter turns; 2 = the part turned end for end (polarity)
/** `null` = this kind is not placeable yet. A Partial table, never an exhaustive switch (Gotcha G6). */
export function footprintOf(spec: PartSpec): Footprint | null;
export function legSockets(layout: BoardLayout, fp: Footprint, anchor: SocketSpec, o: Orientation): (SocketSpec | null)[];

// seat.ts — what is in which socket (the ARRIVED truth: the 3D leg writes it when its travel ends)
export interface Placed { readonly id: string; readonly spec: string; legs: (SocketId | null)[]; setting?: number }
export interface LeadEnd { readonly id: string /* 'spk+' */; readonly part: string /* 'SPK' */; readonly pin: number; end: SocketId | null }
export interface BoardState { readonly parts: Map<string, Placed>; readonly leads: Map<string, LeadEnd>; serial: number }
export function createBoardState(): BoardState;
export function occupant(s: BoardState, socket: SocketId): { part: string; leg: number } | { lead: string } | null;
export function canSeat(layout: BoardLayout, s: BoardState, socket: SocketId, except?: string): boolean; // free & on board
export function place(layout: BoardLayout, s: BoardState, p: { id: string; spec: string; anchor: SocketId; o: Orientation }): boolean; // all legs or none
export function seatLeg(s: BoardState, part: string, leg: number, socket: SocketId | null): void;
export function seatLead(s: BoardState, lead: string, socket: SocketId | null): void;
export function remove(s: BoardState, id: string): void;
/** 'R1', 'R2', 'C1', 'D1', 'LED1', 'Q1', 'P1', 'J1' — a counter per mount, never chance. */
export function nextId(s: BoardState, prefix: string): string;

// netlist.ts — board → Netlist
export type PinTo = { row: RowId } | { private: string } | { lead: string };
export interface FixedPart { readonly id: string; readonly spec: string; readonly pins: readonly PinTo[]; setting?: number }
export const BENCH_FIXED: readonly FixedPart[];   // decision (synthesis), see §3.4
export interface BoardNet {
  readonly net: Netlist;
  readonly nodeOfRow: ReadonlyMap<RowId, number>;
  readonly rowOfNode: readonly (RowId | null)[];      // null = a private node (battery inside its switch)
  readonly pending: readonly string[];                 // parts / fixed parts with a leg or lead out: left out
  readonly key: string;                                // sorted `id:spec:pins` — recompile iff it changed
}
/** `extra`: parts that are not on the board (the multimeter in A mode). Never returns a malformed netlist. */
export function netlistOf(layout: BoardLayout, s: BoardState, fixed: readonly FixedPart[], extra?: readonly PartInstance[]): BoardNet;
export function rowVolts(b: BoardNet, v: Float64Array, row: RowId): number;
```
Tests (`E/sim/board/__tests__/`): `layout.test.ts` (counts 17 × 12 = 204 sockets, 34 rows, `−` = node 0, `nearest`
returns null between sockets beyond `within`, symmetric half), `seat.test.ts` (occupancy, all-or-nothing `place`,
rotation, `nextId` sequence), `netlist.test.ts` (pattern of `C/chapters/build/__tests__/circuit.test.ts`: a
`seated({R1: ['a3','a7'], …})` helper → `netlistOf` → `nodeOfRow`, `pending`, key stability under re-seat inside
the same rows, then `solveDC` on a divider 1 kΩ/2 kΩ placed on the board = **5.997 V** = 9 × 2000 / 3001.5).

### 1.2 `E/shared/bench/` — the world (copied stage + new board view, ≈ 1 700 lines)

```ts
export interface BenchOptions {
  tray?: readonly TrayItem[];          // what the parts tray offers (default: empty)
  meter?: boolean; scope?: boolean;    // instruments shown at mount (default false; steps switch them)
  sound?: boolean;                     // E2-10: speaker → E1-9 SoundOut
  link?: 'auto' | 'sync' | 'off';      // transient link mode (radio idiom); forced 'sync' under ?freeze
}
export interface Bench {
  readonly ctx: ChapterContext;
  readonly group: Group; readonly frame: Group;           // frame = the tilted board frame (everything on the board)
  readonly room: Room; readonly base: Base; readonly light: LightRig;
  readonly layout: BoardLayout; readonly state: BoardState;  // the board as data
  readonly view: BoardView;                               // 3D breadboard
  readonly fixed: FixedItems;                             // battery + switch, player, speaker, lamp, their leads
  readonly parts: PartsOnBoard;                           // 3D part instances by id
  readonly hands: Hands; readonly tray: Tray;
  readonly model: BenchModel;
  readonly meter: Multimeter; readonly scope: Oscilloscope;
  readonly tools: BenchTools;                             // lens model + poses
  /** Hands inert while the camera flies (dive, chapter border). */
  flying: boolean;
  /** A step's own small circuit, placed at once (deep links) or travelling in (seconds > 0). */
  preset(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId | null>>, seconds?: number): void;
  clear(seconds?: number): void;
  snap(): void;                                           // on `info.instant`
  update(dt: number, t: number): void;                    // hands → state → model → looks → instruments → light → air
  late(dt: number, t: number): void;                      // shapes after the world (legs, leads, grips, cues)
}
export interface PresetPart { id: string; spec: string; legs: readonly (SocketId | null)[]; setting?: number }
export function mountBench(ctx: ChapterContext, opts?: BenchOptions): Bench;
// re-exports for _dev: GROUND, PARTS, resistorKey, solveDC, type Netlist/PartInstance/PartReading/TopologyIssue,
// createLayout, BOARD_SPEC, netlistOf, type BoardState/SocketId/RowId, STAGE_SHOTS-like BENCH shots

// board-view.ts (new)
export interface BoardView {
  readonly group: Group;                                  // body + instanced socket mouths + rail stripes, in `frame`
  socketWorld(id: SocketId, out?: Vector3): Vector3;      // mouth centre, world
  socketBoard(id: SocketId, out?: Vector3): Vector3;      // mouth centre, board frame
  highlightRow(row: RowId | null, amount: number): void;  // the connected strip lights under a held leg / probe
  dispose(): void;
}
```
`mountBench` keeps from `S/index.ts` L173-206 and L334-362: group → `ctx.root`; `ctx.env.setScale(3.6)`;
`ctx.post.base(STAGE_POST.stand)`; `createRoom` (sets `ctx.env.base(ROOM_ENV)`); `createBase`; `createLight`;
`ctx.env.setShadow({...})`; `tameAll` after adding lit props (and again for every runtime-added part); phone rule
(prints hidden when `ctx.device.formFactor === 'phone'`, re-checked `ctx.onResize`); `snap()`; glow damping
`damp(glow, to, to > glow ? 16 : 9, dt)`. It drops torch, unfold, crawl, battery inside, poles, slider glow, lamp view.
QA readers it registers: `electronics-bench`, `electronics-board`, `electronics-motion` (§6 per task).

### 1.3 `E/shared/parts/` — part models and looks (new + lamp copy, ≈ 1 200 lines)

```ts
export type BandColor = 'black'|'brown'|'red'|'orange'|'yellow'|'green'|'blue'|'violet'|'grey'|'white'|'gold'|'silver';
/** IEC 60062 four-band code: 4700 Ω, 5 % → yellow violet red gold; 1 Ω → brown black gold gold. Pure, tested. */
export function resistorBands(ohms: number, tolerance: number): readonly BandColor[];
/** Three-digit capacitor code: 100 nF → '104', 10 pF → '100' (pure; values from E1-5's catalog). */
export function capacitorCode(farads: number): string;
/** Palette colours for the code; gold/silver derived from tokens (no hex, no new tokens: platform read-only). */
export function bandColor(c: BandColor, out?: Color): Color;
export interface PartLook {
  load: number;                                   // E1-4 `status.load`: share of the limit now
  heat: number;                                   // E1-4 `PartMemory.heat`: how warm it has become (drives the look)
  status: 'ok' | 'warm' | 'hot' | 'burnt' | 'bulged';   // E1-4 / E1-5 names (provisional)
  light: number;                                  // LED / lamp 0…1 from the model's current
  room: number;                                   // room light level for unlit prints (0.25…1)
}
export interface PartModel {
  readonly group: Group;                          // origin = leg 0's tip at the socket mouth; legs along +x at o = 0
  readonly hit: Mesh;                             // invisible low-poly body proxy (the only pickable)
  readonly legTips: readonly Vector3[];           // local, at o = 0
  readonly legTops: readonly Vector3[];           // where a leg grip / a probe touches
  readonly materials: readonly KToonMaterial[];   // heat / fade
  setLook(look: PartLook, dt: number): void;
  dispose(): void;
}
/** One model per kind; `null` for a kind not built yet (Partial table). */
export function buildPart(key: string, spec: PartSpec): PartModel | null;
// models: resistor (bands from ohms), ceramic disc (code print), film box, electrolytic can (minus stripe, value print),
// diode (cathode band), LED ×5 colours (`sheath` epoxy + `depthShell`), TO-92 transistor (flat face), pot (knob
// follows setting), jumper (DynTube or G.tube), speaker, 9 V battery + slide switch, player, lamp (copied bulb)
```

### 1.4 `E/shared/hand/` — drag, snap, tray (copies from `build` + new, ≈ 1 100 lines)

```ts
export interface Glide { readonly value; readonly target; readonly moving; go(to, seconds): void; set(v): void; update(dt): number } // COPY B/glide.ts
export type Place = { kind: 'socket'; socket: SocketId } | { kind: 'lie'; at: Vector3; out: Vector3 }
                  | { kind: 'hand'; at: Vector3 } | { kind: 'tray'; at: Vector3 };
export class Leg {                                 // from B/ends.ts `End`
  readonly pos: Vector3; readonly out: Vector3; place: Place;
  seated: SocketId | null;                         // set ON ARRIVAL (the click is the moment of contact)
  get moving(): boolean; go(place: Place, seconds: number, lift?: number, hop?: boolean): void;
  carry(at: Vector3): void; snap(): void; update(dt: number, anchor: Vector3): void;
}
export type HandKey = `part:${string}` | `leg:${string}:${number}` | `lead:${string}` | `probe:${string}` | `tray:${string}`;
export interface HandPolicy {
  take(k: HandKey): boolean;
  seat?(k: HandKey, socket: SocketId): boolean;                    // a leg / lead / probe end may click in here
  place?(k: HandKey, anchor: SocketId, o: Orientation): boolean;   // a whole part may be put here
  done?(k: HandKey, where: 'board' | 'tray' | 'away'): void;
  tooltip?(k: HandKey): string;
}
export interface Hands {
  policy: HandPolicy | null;
  readonly held: HandKey | null;
  readonly near: SocketId | null;                  // the socket a carried end would click into (computed, unlike build)
  readonly preview: readonly (SocketId | null)[];  // the sockets a carried part would take on release
}
export function createHands(ctx: ChapterContext, deps: HandsDeps, opts?: { snap?: number; away?: number }): Hands;
export interface TrayItem { readonly spec: string; readonly count?: number /* default: unlimited */ }
export interface Tray { readonly group: Group; set(items: readonly TrayItem[]): void; slot(spec: string, out?: Vector3): Vector3 | null; update(dt: number, t: number): void }
export interface Swap { start(): void; readonly t: number; readonly running: boolean; update(dt: number): void; finish(): void } // from B/swap.ts
export interface Cue { mesh: Object3D; update(dt, at: Vector3 | null, radius: number, camera: Camera): void; hide(): void }   // COPY battery/parts/cue.ts
```

### 1.5 `E/shared/instruments/` (new + gauge pieces, ≈ 700 lines)

```ts
export type MeterMode = 'off' | 'V' | 'A' | 'ohm';
export interface ProbeTip { readonly key: string; readonly leg: Leg; readonly socket: SocketId | null; readonly tipWorld: Vector3 }
export interface Multimeter {
  readonly group: Group; mode: MeterMode; shown: number;            // shown: 0 away … 1 on the table (glide)
  readonly probes: { readonly red: ProbeTip; readonly black: ProbeTip };
  readonly value: number | null;   // SI, null = nothing to read (a probe off the board, 'ohm' on a live circuit)
  readonly text: string;           // '—', 'OL' or fmtSI(value, unit)
  readonly unit: 'V' | 'A' | 'Ω';
  /** A mode: the meter as a series part between its probes (spec 'jumper', id 'METER'). */
  extraParts(): readonly PartInstance[];
  update(dt: number, model: BenchModel): void;
  /** The HUD readout of the step panel (number in the HUD: design §6.2, LIBRARY §2). */
  readout(id: string, label: string): ReadoutSpec;
}
export interface Oscilloscope {
  readonly group: Group; shown: number;
  timePerDiv: number;                               // s/div, 10 divisions
  mode: 'sweep' | 'roll';
  trigger: { channel: 0 | 1; level: number; slope: 1 | -1; auto: boolean };
  readonly channels: readonly { probe: ProbeTip; voltsPerDiv: number; offset: number; on: boolean }[];
  /** Nodes to record in the next transient request (probe rows → nodes). */
  taps(net: BoardNet): readonly number[];
  /** Samples of the tapped nodes at `fs`, continuous from `start` (sample index). */
  feed(fs: number, start: number, channels: readonly Float32Array[], n: number): void;
  readonly sweepVersion: number;
  readonly sweep: { readonly n: number; readonly t: Float32Array; readonly v: readonly Float32Array[] };
  /** The board chart control: `init` refills from the last sweep (charts are rebuilt per step entry). */
  chart(id: string, labels: { ch1: string; ch2: string }): ChartSpec;
  update(dt: number, t: number): void;             // 3D face from the sweep
}
/** Min/max decimation: 2 points per bucket (min then max in time order); no allocation. */
export function decimateMinMax(src: Float32Array, from: number, count: number, buckets: number,
  outT: Float32Array, outV: Float32Array, t0: number, dt: number): number;
export function findTrigger(ring: Float32Array, head: number, size: number, level: number, slope: 1 | -1,
  earliest: number, latest: number): number;      // sample index or −1
```

### 1.6 `E/shared/model/` — the bench's model driver (new, ≈ 350 lines; isolates E1-4…E1-7 API churn)

```ts
export interface BenchModel {
  readonly net: BoardNet | null; readonly circuit: Circuit | null; readonly solution: DcSolution | null;
  readonly state: ModelState;                      // ONE per mount; outlives netlists (damage by part id)
  readonly version: number;                        // bumps on every solve
  readonly dcMs: number;                           // solve time (performance.now is allowed in shared/, not chapters)
  rebuild(net: BoardNet): void;                    // compile iff net.key changed, else keep the circuit
  set(id: string, setting: number): void;          // pot / switch: mutates the compiled PartInstance, marks dirty
  /** Solve when dirty; then (E1-4) `advanceHeat(state, circuit, solution, dt)` on ENGINE time (dt > 0 only) and a
   * re-solve in the same frame when it returns burnt ids. */
  update(dt: number): void;
  /** A part left the board for good / was replaced: `state.parts.delete(id)` (E1-4's rule). */
  forget(id: string): void;
  reading(id: string): PartReading | null;
  rowVolts(row: RowId): number;
  status(id: string): PartLook['status'];          // E1-4 `solution.status[id].condition` (until then 'ok'/'warm'/'hot' by load)
  heat(id: string): number;                        // E1-4 `state.parts.get(id)?.heat` (how warm, share of its limit)
  /** Held page: a transient window computed synchronously (E1-5), once per change. */
  still(window: { warmup: number; span: number; fs: number; taps: readonly number[] }): Float32Array[];
}
export function createBenchModel(ctx: ChapterContext, opts?: { frozen?: boolean }): BenchModel;
export function fnv1a(bytes: Uint8Array): string;  // COPY R/shared/world/index.ts L91-95 (qa hashes of sweeps / solutions)
export function meanOf(cells: ArrayLike<number>): number;  // COPY+ADAPT L97-101 (typed input)
```

### 1.7 `E/shared/dive/` — floor axis (copies, ≈ 870 lines)

```ts
export { LENS_LEG, LENS_LANDS, leadCamera, leadLens, ringEase, createDiveRail, type DiveRail } from './rail-math'; // COPY C/shared/world/dive.ts
export interface CameraRail { rail; engaged; position; target; moving; scrub(t); place(t); travelTo(t, s?); snap(t); release(); update(dt) }
export function cameraRail(ctx: ChapterContext, stops: readonly Shot[], lead?: Shot): CameraRail;   // COPY lamp/parts/rail.ts
export interface LensKeeper { shown; gliding; hold(p); to(p, s?); snap(p); call; rim; glass; late(dt, t) }
export function lensKeeper(tools: BenchTools): LensKeeper;                                          // ADAPT lamp/parts/lens-keeper.ts
export interface Door { rail: CameraRail; lens(t): LensPose; rim(t): number; glass(t): number; cut(t): number }
export function partDoor(ctx: ChapterContext, bench: Bench, partId: string): Door;                  // ADAPT lamp/parts/door.ts
export type FloorId = 'stand' | 'part' | 'inside' | 'atoms';                                       // E volume.json axis ids
export function floorAt(position: number): FloorId;                                                // ADAPT world/levels.ts
export function partLensPose(bench: Bench, partId: string, scale?: number, lift?: number): LensPose; // ADAPT resistance/parts/poses.ts
```
`floorLadder(ctx, { floor: () => … })` from `@/hud-dom/journey` (`hud-dom/journey/index.ts` L3) and
`setWhereBase(key, floor)` from `@/hud/where` (`hud/where.ts` L27) are USE.

### 1.8 `E/shared/sound/` — E1-9's (provisional names from `batch-E1.md` L371-383)

`SoundOut` (own `AudioContext` after `ctx.gesture`; silent with `?noaudio`; follows `settings.audio`/`settings.volume`;
own limiter; queue ≤ 3 blocks scheduled on `AudioContext.currentTime`; counters blocks/underruns/latency; dispose on
`ctx.onDispose`) and the model worker (copy of `R/shared/link`, one request in flight, sync fallback). E2-10 adds
only `speakerOut(bench, sound)`: the speaker part's current blocks → samples. If E1-9's request has no `taps`, E2-9
extends the protocol (version-keyed netlist, `taps: number[]`, `speaker: string`) in E1-9's files with a REUSE note.

---------------------------------------------------------------------------------------------------------------------

## 2. Files to copy — exact list, grouped by the task that copies them

Every row goes into `docs/volumes/electronics/REUSE.md` («звідки», «що змінено»; E1-8 creates the file — E2 tasks
append rows). Copies keep the source's relative layout so sibling imports survive; any `@circuit/…` / `@radio/…`
import becomes relative or `@electronics/…`. Test files move with the code they cover.

### 2.1 Group A — the room and the stand (task E2-3), into `E/shared/bench/`

| Source (lines) | Exports / what | Imports it drags | Destination | Verdict · adaptation |
|---|---|---|---|---|
| `S/materials.ts` (138) | `surface(params)` L68, `sheath(params)` L98, `tame(material, cap=1.1)` L125, `SurfaceParams`, `SheathParams` | three, `@/style` | `bench/materials.ts` | **COPY**. Shader-text patches throw if K.toon/three change (L53-56, L72-74, L101-103, L130-131) |
| `S/room.ts` (144) | `TABLE` L21, `MOON_DIR` L24, `ROOM_ENV` L27-42, `Room`, `createRoom(ctx)` L86 (calls `ctx.env.base(ROOM_ENV)`) | three, `@/engine/api` type, `@/kit` G, `@/style`, `./materials` | `bench/room.ts` | **COPY** |
| `S/layout.ts` (108) | `BOARD` L11-21, `LOOP`, `WIRE`, `BATTERY`, `SWITCH`, `SEAT`, `LAMP`, `LENS` L82-91, `RULER`, `SHELF_WORLD`, `STAPLES` | none | `bench/layout.ts` (~90) | **COPY+ADAPT**: keep `BOARD` shape (new size, decision: 8.4 × 5.6, tilt 15°, feet, corner), `LENS` (new holder spot); replace LOOP/WIRE/BATTERY/SWITCH/SEAT/STAPLES/RULER with `PLACES` {breadboard centre, battery, switch, player, speaker, lamp post, tray (table, world), meter home (table, world), scope home}; `SHELF_WORLD` dropped or reused for the tray (VISUAL decides) |
| `S/__tests__/layout.test.ts` (96) | VISUAL size rules on constants | vitest | `bench/__tests__/layout.test.ts` | **COPY+ADAPT** to the new places; add «breadboard fits the face with margin», «tray/meter clear of the HUD bar» |
| `S/base.ts` (133) | `BOARD_Y` L21, `wedgeGeometry()` L24, `Base {group, frame, face}` L57, `createBase()` L65 (frame group at (0, BOARD_Y, 0) rotated by tilt L110-114) | three, `three/addons/utils/BufferGeometryUtils.js`, `@/kit`, `@/style`, `./layout`, `./materials`, `./room` | `bench/base.ts` | **COPY+ADAPT**: sizes from new `BOARD`; shelf L98-108 removed or turned into the tray ledge |
| `S/light.ts` (174) | `filamentColor(t)` L27, `LightState` L39, `LightRig {lamp, bounce, output, set, yieldEnv, filament, emission}` L56, `createLight(ctx, filament)` L79 (owns `ctx.env.tune`) | three, `@/engine/api` type, `@/style` | `bench/light.ts` | **COPY** (+ADAPT only the key-light owner: `filament` = the bench lamp's filament; when no lamp is lit the rig shows the moon + ambient look — raise `ambient` default per VISUAL, Open Q2) |
| `S/shots.ts` (107) | `boardToWorld` L14, `STAGE_FOV 27` L21, `HANDOVER` L27, `LENS_OVER_WIRE` L39, `STAGE_POST` L49, `STAGE_SHOTS` L54 | three, `@/engine/api` type, `./layout`, `./base` | `bench/shots.ts` (~70) | **COPY+ADAPT**: keep `boardToWorld`, `STAGE_FOV`, `STAGE_POST`, `stand` (new `fit` for the bigger base); add `board` (close), `tray`, `meter`, `scope`, `speaker`; drop flashlight/crawl/lamp/lens/handover/`LENS_OVER_WIRE`. Names kept (`STAGE_*`) — decision (synthesis) |
| `S/dyn-tube.ts` (122) | `resample(points, n, out)` L12, `class DynTube(rings, radial)` L33 `update(path, up, section)` L76 | three | `bench/dyn-tube.ts` | **COPY** (leads of probes, battery/speaker/player/lamp, jumper wires) |
| `S/air.ts` (171) | `Air`, `createAir(ctx, count)` L94 (`ctx.quality.count`, `ctx.random`) | three, `@/engine/api` type, `@/kit`, `@/style` | `bench/air.ts` (~140) | **COPY+ADAPT** (optional): drop the torch `beam` |
| `S/tools/lens.ts` (204) | `LensPose` L17, `LensModel` L32, `holderPose()` L85, `createLens(ctx)` L93 | three, `@/engine/api` (`toOverlay`), `@/kit`, `@/style`, `../layout` (`LENS`), `../materials` (`sheath`) | `bench/tools/lens.ts` | **COPY** (`LENS` comes from the adapted layout) |
| `S/tools/index.ts` (187) | `worldToBoard` L31, `worldDirToBoard` L37, `overWirePose` L42, `ToolState`, `Tools`, `createTools` L114 | stage layout/shots/base + frame/gauge/lens/crawl/loupe/snail | `bench/tools/index.ts` (~80) | **COPY+ADAPT**: keep `worldToBoard`/`worldDirToBoard` (or replace by `frame.worldToLocal`, Gotcha G42), holder pose, generic `overPose(boardPoint, scale)`, lens call/rim (`setRim(smooth(ramp(dive, .5, .92)))` L173); drop gauge/frame/crawl/snail/loupe |
| `S/index.ts` (366) | `mountStage(ctx, options)` L173-366, `tameAll(root)` L147 | 15 siblings | `bench/index.ts` (~150, `mountBench`) | **COPY+ADAPT** as in §1.2 |
| `S/mounts.ts` (225) pieces | `terminal(p, x, dir, collar?, axis)` L18-34; lamp post & socket L135-155; lens holder L188-207 | `@/kit` Builder type, `@/style` | `bench/mounts.ts` (~70) | **COPY+ADAPT**: battery/speaker/lamp terminals, lamp post, lens rest; the rest SKIP |
| `S/small-parts.ts` (79) `createSlider` L30-55, `SLIDER_Y` L12 | yellow thumb on steel bridge | `./layout` (`SWITCH`) | `bench/switch-slider.ts` (~35) | **COPY+ADAPT** for the 9 V battery's slide switch (travel from the new layout) |

### 2.2 Group B — the parts (task E2-4), into `E/shared/parts/`

| Source (lines) | What | Destination | Verdict · adaptation |
|---|---|---|---|
| `S/bulb.ts` (339) | `BulbDims` L35, `bulbDims` L46, `BulbModel` L58, `coilGeometry` L73, glare shaders L101-122, **`depthShell(glass, centreY)` L132**, `createBulb` L148, `setGlow(color, emission, glow, room)` L312-337 | `parts/bulb.ts` (~250) | **COPY+ADAPT**: drop `close` (`lamp-view.ts` + `bulb-close.ts` close-up, 487 lines), inline `supportPath` (`S/bulb-close.ts` L24-37, uses `G.roundPath`), `print` optional; `LAMP` dims from the bench layout. `depthShell` reused for LED domes |
| `S/bulb-heat.ts` (182) | `HEAT_STOPS` L27, `temperatureOfHeat` L43, `heatOfTemperature` L56, `formatTemperature` L72 (generic); `LAMP_WORK`, `resistanceAt`, `lossAt`, `temperatureOfCurrent`, `filamentAfter*` L84-182 (1.5 V lamp physics) | `parts/heat-scale.ts` (~80) | **COPY+ADAPT**: keep the heat ↔ colour scale and `formatTemperature`; SKIP the energy balance — the filament temperature comes from the model (E1-4 lamp) |
| `S/__tests__/bulb.test.ts` (29), `bulb-heat.test.ts` (117) | Box3 geometry; scale monotone | `parts/__tests__/` | **COPY+ADAPT** with the code |
| `S/battery.ts` (245) | AA model, printed marks as unlit Text3D following `light` | — | **REF** (the 9 V «Крона» is a new model) |
| `S/wires.ts` (370) L209-225 | per-vertex ember painted `col('orange') × 1.1·ember` | — | **REF** (warm leads; use `paintEmissive` from `@/style`) |
| `B/thermal-warm.ts` (154) | `createWarmth(roots, glass, only: RegExp)` → `{shade, amount, count, update}`; false-colour twins only inside the lens ring | `parts/warmth.ts` | **COPY+ADAPT only if** a heat lens is wanted (Open Q8): rebuild twins per part instance (it builds once, L140), uniform to skip the lens test. Default for E2: SKIP |

### 2.3 Group C — the hand (task E2-5), into `E/shared/hand/`

| Source (lines) | What | Imports it drags | Destination | Verdict · adaptation |
|---|---|---|---|---|
| `B/glide.ts` (61) | `Glide`, `glide(initial)` | none | `hand/glide.ts` | **COPY** |
| `B/ends.ts` (148) | `Place`, `class End {go, carry, snap, update, seated}` | three, `./circuit` types, `./clamps`, `./curves` type | `hand/leg.ts` (~150) | **COPY+ADAPT** → `Leg`: `Place` = socket / lie / hand / tray; resolve against `layout` + `BoardView.socketBoard`; capacity 1 (drop `slot`/`shared`, SHARE_OFFSET/FAN); keep the travel maths, the sine lift capped at `way*0.32`, the shortest-angle turn L112-118, **`seated` on arrival** L108 |
| `B/curves.ts` (145) | `EndPose`, `Lay`, `hermite(a, b, out, n, lay)` L36-78, `lengths`, `pointAt`, `peeled`, `blend` | three, `@circuit/shared/stage/dyn-tube` (`resample`), `./clamps` (`LYING`, `ground`) | `hand/curves.ts` | **COPY+ADAPT**: `resample` from `../bench/dyn-tube`; inject `ground`/`LYING` as a `Terrain` parameter (for bent legs, jumper wires, all leads) |
| `B/clamps.ts` (95) | `ground(x, z)` L62-72 over `RAISED` boxes, `SHOULDER`, `AREA`, `LYING` | three, `@circuit/shared/stage` | `hand/terrain.ts` (~50) | **COPY+ADAPT**: only `ground()` with `RAISED` as data (parts on the board are raised ground for a lead draped over them) and `AREA` = board + tray; `CLAMPS`/`REST` SKIP |
| `B/grips.ts` (95) | `Grip {holder, grip, hit, material, shown, call, hover}`, `createGrips(stage, ends)`: cyan capsule `G.capsule(0.1, 0.34, 20)` + invisible `SphereGeometry(0.3)` hit; emissive `0.18 + call·(0.25 + 0.12 sin 2.4t) + hover·0.3` | three, `@/kit`, `@/style`, `CircuitStage` type, `./glide`, `./ends` | `hand/grips.ts` | **COPY+ADAPT**: parent group as a parameter, generic key; one grip per leg end / lead plug / probe; hit radius ≥ 0.3 |
| `B/hands.ts` (134) | `SNAP 0.34`, `AWAY 0.5`, `HandPolicy`, `Hands`, `createHands(ctx, world, stage, wiring)`: register hit → `dragStart` (held, left) → `drag` (planePoint on the board plane → board → clamp to AREA → reach → carry → `left` hysteresis → `nearest` → plug mid-drag) → `dragEnd` (lay); probes `end-<key>`, `clamp-<id>` | three, `@/engine/api`, `@circuit/shared/stage` (`boardToWorld`, `worldToBoard`), `@circuit/shared/world` type, `./circuit`, `./clamps`, `./ends`, `./wiring` | `hand/hands.ts` (~220) | **COPY+ADAPT** → generic (§4): keys `part:/leg:/lead:/probe:/tray:`; board plane from `frame` (`frame.worldToLocal`, not the closed-form tilt, L92-95 mismatch); candidates = `layout.nearest` + `canSeat` (+ any socket for probes); reach = other seated legs `[minSpan, maxSpan]`; **real `near`** (dead in build) and `preview` for whole-part carry; `held !== key` guards kept |
| `B/wiring.ts` (303) | `follow()` taut L218-237, `reach`, reseat-on-capacity, `shape()` welded to the stand's tubes | `@circuit/shared/stage/wires`, `dyn-tube`, stage | — | **REF** (take `follow`/`reach`/`moving`/`snap()` ideas for jumper wires and leads) |
| `B/swap.ts` (95) | `Swap {start, t, running, update, finish}`, `createSwap(stage, id, lift)` — one `t` 0…1, playable and snappable | three, stage `LOOP`, `wires` | `hand/swap.ts` (~80) | **COPY+ADAPT**: `createSwap(parent, source: Object3D, path: (u, out) => Vector3)` — a burnt part leaves, a fresh one arrives (scripted repairs only) |
| `B/switch.ts` (78) | `SwitchPart {closed, flips, open, onFlip, reset, snap, place}`; invisible hit sphere child of the slider; `click` flips | `damp`, stage `SWITCH`, `small-parts`, world type | `bench/switch.ts` (~70) | **COPY+ADAPT**: battery switch; `world.flying` → `bench.flying`; `closed` → `model.set('SW', 0/1)` |
| `C/chapters/battery/parts/cue.ts` (43) | `Cue`, `createCue(parent, color)` — glowing camera-facing ring, eased | three, `damp`, `K.glow` | `hand/cue.ts` | **COPY** |
| `B/circuit.ts` (100), `B/__tests__/circuit.test.ts` (96) | pure union–find verdict; `wired(map)` test helper | — | — | **REF** (shape of `sim/board` tests) |
| `C/chapters/build/qa/helpers.mjs` (200) | `advance`, `locate`, `read`, `at`, `pointer(page, touch).path(points, steps)`, `strides(page, reader, s)` | `../../../../../../../tools/qa/lib.mjs` (7 × `../`) | `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` | **COPY** (same depth: 7 × `../`) |

### 2.4 Group D — instruments (task E2-6, E2-9), into `E/shared/instruments/`

| Source (lines) | What | Destination | Verdict · adaptation |
|---|---|---|---|
| `S/tools/gauge.ts` (337) | `Probe {on, handle, hold, pole, tip, rest}` L20-33; `buildProbe(id)` L168; probe lead = `DynTube(30, 8)` through 6 control points rounded by `G.roundPath(pts, 0.3, 6)` L268-301; `shown` slide-in L284-288; `light` setter for unlit prints | `instruments/probe.ts` (~120), `instruments/meter-model.ts` (new) | **COPY+ADAPT** the probe + lead pieces: tip = a `Leg` (socket / rest / hand), lead from the meter jack; needle/scale/`MAX 2 V`/`GAUGE_HOME`/`Text3D` number SKIP (digital meter; number in the HUD) |
| `S/battery-cell.ts` L119-122 | `followVoltage(shown, target, dt)` τ 0.14 s falling / 0.75 s rising | `instruments/meter.ts` | **COPY** (4 lines) — or a DMM refresh (≈ 3 Hz sample-and-hold on engine time): VISUAL decides |
| `@/fx` `createScope`, `createScreen`, `RibbonLines` | 3D oscilloscope face | — | **USE** |
| `electricity/chapters/current/parts/{multimeter 164, circuit-grid 206, circuit-tray 160, lead-pick 40}.ts`, `electricity/chapters/lab-inverter/parts/bench-scope.ts` (198) | the closest prior art (grid + tray + multimeter + scope) | — | **REF only**: they import `@electricity/sim/current` and chapter-local `../world`; the REUSE rule names circuit and radio only (Open Q15) |

### 2.5 Group E — the dive (task E2-8), into `E/shared/dive/`

| Source (lines) | What | Imports | Destination | Verdict · adaptation |
|---|---|---|---|---|
| `C/shared/world/dive.ts` (222) | `LENS_LEG 0.5` L27, `LENS_LANDS 0.85` L29, `ringEase` L46, `leadCamera` L51, `leadLens` L56, `DiveRail` L58-81, `createDiveRail(stops, lead?)` L83 | three, `@/engine/api` type | `dive/rail-math.ts` | **COPY** (generic: stops are `Shot[]`) |
| `C/chapters/lamp/parts/rail.ts` (151) | `CameraRail` L20-38, `cameraRail(ctx, stops, lead?)` L40 (hand follow, catch-up 3.2/s, `fit` carried) | three, `@/engine/api`, `@circuit/shared/world/dive` | `dive/camera-rail.ts` | **COPY** (import → `./rail-math`) |
| `C/chapters/lamp/parts/lens-keeper.ts` (116) | `LensKeeper` L13, `mixPose` L51, `emptyPose` L60, `lensKeeper(stand)` L62 | three, `@circuit/shared/stage` (`CircuitStage`, `LensPose`) | `dive/lens-keeper.ts` | **COPY+ADAPT**: depend on `BenchTools` (lens model + holder pose) |
| `C/chapters/lamp/parts/door.ts` (66) | `Door` L28, `createDoor(ctx, lw, stand)` L38: lens leg → push-in, ring passes at `PASS 0.82`, rim, glass thins, `cut` opens `smooth(ramp(t, .45, 1))` | `@circuit/shared/stage`, `@circuit/shared/world/dive`, `../shots` (`GLASS_POSE`), `./rail`, `./lens-keeper`, `../world` type | `dive/door.ts` (~90) | **COPY+ADAPT** → `partDoor(ctx, bench, partId)`: stops = `[partDoorShot(part), partInsideShot(part)]` computed from the part's board pose; `cut` drives the part model's cutaway (E3) |
| `C/shared/world/levels.ts` (94) | `FloorId` L10, `DEEP` L13, `LEG` L16-23, `mixAt` L54, `floorValue` L67, `floorAt` L70, `legsBetween` L80 | none | `dive/levels.ts` | **COPY+ADAPT**: ids `stand/part/inside/atoms` (E `volume.json`); hand-over depths as data; `legsBetween` SKIP (tests only) |
| `C/chapters/resistance/parts/poses.ts` (37) | `wireLensPose(x, z, scale?, lift?, out?, y?)` — lens over a board point lifted toward the camera | `@circuit/shared/stage` | `dive/poses.ts` | **COPY+ADAPT** → `partLensPose(bench, id)` |
| `C/shared/world/__tests__/dive.test.ts` (136), `levels.test.ts` (51) | rail continuity, lens leg lands at 85 %, `positionOf` inverts `deepAt`, timed travel | `@circuit/shared/stage/shots` | `dive/__tests__/` | **COPY+ADAPT** with synthetic stops |
| `C/shared/world/{index 352, flight 200, look 76, window 126, border 232, params 57, away 39}.ts` | the composed copper world, flights on `deep`, stencil lens window, borders | the whole circuit stage + copper | — | **REF** now; `window.ts` (stencil portal) and `look.ts` (env hand-over) become COPY+ADAPT when a chapter needs atoms through the lens (E3 `resistor`); `border.ts` when `seamless` borders come |
| `S/lamp-view.ts` `createCutter` L206-255 + `capSections` L191; `S/battery-section.ts` `Relief`/`paint` L98-136; `S/bulb-close.ts` helix maths L79-132 | cutaways, section reliefs, resistor spiral | — | — | **defer to E3/E4** (inside a resistor / capacitor); listed so E2-8's door exposes a `cut` number they can use |
| `C/shared/copper/**` (≈ 3 340) | atoms, electron sim, haze, lattice | — | — | **defer** (E3 `resistor` atoms, E4 capacitor plates); REF now |

### 2.6 Group F — radio pieces (tasks E2-3, E2-6, E2-9, E2-10)

| Source (lines) | Destination | Verdict · adaptation |
|---|---|---|
| `R/shared/world/index.ts` `fnv1a` L91-95, `meanOf` L97-101 | `model/hash.ts` | **COPY** (`meanOf` typed `ArrayLike<number>`) |
| `R/shared/world/index.ts` L207-246 (held-frame logic: `moved`/`heldFor` key, forced `sync` when frozen, freeze sniff L232) | `model/driver.ts` | **REF** (re-implement for the scope `still`) |
| `R/shared/README.md` (134) | `E/shared/README.md` | **REF** (shape) |
| `_dev/chapters/_sandbox-radio-link/index.ts` (106): `SANDBOX` words const L14-92 + `defineChapter({ …, dev: true })` L94-106 | `_dev/chapters/_sandbox-electronics-bench/index.ts` | **COPY+ADAPT**: id `_sandbox-electronics-bench`, order **9031** (9030 for E1-9's sound sandbox; used: 9001–9003, 9010, 9011, 9020, 9101, 9102), group `em`, theme `{ accent: 'teal', sky: 'studio', mood: 'studio' }`, own steps/labels |
| `_dev/chapters/_sandbox-radio-link/scene.ts` (459) | — | **REF**: `stepUi` factories, `WRITE` map control → model L250-273, **text readouts on held pages** L102-115, `*-bench` timing reader from the link's `ms` L420-428 |
| `_dev/chapters/_sandbox-radio-link/qa/measure.mjs` (1 262): header L3-46, imports L50-62, `held` L90, `open` L140-152, `report`/`check` L207-225, `SECTIONS` + verdict L1217-1262 | `_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs` | **COPY+ADAPT** the skeleton (args, helpers, report/check/verdict, `open`, `held`, `grown`, `live`, `bench`, `leaks`); bodies are new (§6) |
| `R/shared/link/{protocol 29, handler 68, model.worker 9, index 250}.ts` + tests (96, 272) | `E/shared/sound/…` | **E1-9 copies**; E2 consumes; extend only via E1-9's files (Open Q16) |

### 2.7 SKIP (named so nobody copies them by accident)

`S/{torch 217, unfold 348, crawl-scene 121, battery-inside 418, battery-section 153 (until E3), battery-layers 122,
battery-grains 134, battery-react 152, battery-poles 292, bulb-close 163 (except supportPath), lamp-view 324 (until
E3), lamp-shots 70, loop-glow 240, bulb-print 109, bulb-thermal 249, stand 136, wires 370}.ts`,
`S/tools/{frame 132, loupe 122, loupe-shader 139, crawl 246, crawl-lane 93, snail 128}.ts`, `B/{circuit, clamps (except
ground), wiring, shelf 44, loop-track 74, magnifier 267 (until a band-reading magnifier is wanted), rail 150}.ts`,
`R/shared/{models, yard, screen/eye, whereami}`, `R/sim/core/{dsp, video, fm, …}` (E1-7 may copy `rng.ts` for drums).

---------------------------------------------------------------------------------------------------------------------

## 3. The breadboard data model

### 3.1 Geometry (decision (synthesis); VISUAL.md fixes, `sim/board` and `bench/layout` tests assert)

- **Grid:** 17 columns (1…17, left → right) × 12 lines toward the reader: `+` rail · a b c d e · channel · f g h i j ·
  `−` rail. Pitch **P = 0.3** units (toy scale 1 u ≈ 26 mm → 7.8 mm, ≈ 3 × a real 2.54 mm: a stylised board). Centre
  channel 0.3, rail gap 0.15. Sockets: 17 × 12 = 204. Breadboard body ≈ 5.7 × 4.4.
- **Base:** the circuit base grows to **8.4 × 5.6** (keeps 3 : 2, tilt 15°, feet): breadboard left of centre, a
  strip of fixed items on the right (battery 9 V + slide switch near, player middle, speaker far), lamp post far-left
  corner, lens holder near-left corner. Tray on the table in front-right (world, level, like the circuit gauge);
  multimeter home front-left on the table; scope behind-right on the table (HUD chart is the primary trace).
- **On screen** (main shot, base 62 % of frame width as circuit VISUAL §2): 1920 × 1080 → ≈ 142 px/u → P ≈ 42 px;
  1280 × 720 → P ≈ 28 px; phone portrait needs a closer `board` shot (P ≥ 24 px). Snap radius `SNAP = 0.45 P`
  (0.135 u) so neighbours never fight; grip hit spheres r = 0.3 u (≥ 44 px at 1280 × 720 together with the 10/22 px
  touch rings, `input.ts` L211, L384-390).
- **Parts** are scaled 3× real like the pitch: resistor body 0.73 × 0.29 u, legs 4 P apart (real 10.16 mm × 3);
  LED / electrolytic 1 P; ceramic / film 2 P; TO-92 1 P between legs; pot 2 P.
- **Draw calls:** sockets = one `instanced()` mouth model (2–3 calls), rail stripes and printed column numbers (if any)
  baked into the body Builder; small parts `castShadow = false` (the lamp's cube shadow is ×6 per caster).

### 3.2 Rows, nodes, ground

- A **row** is one connected group: the 5 sockets a–e of a column (`'7ae'`), the 5 sockets f–j (`'7fj'`), the whole
  `+` rail (`'+'`), the whole `−` rail (`'-'`). 34 rows. Real breadboards: strips across the channel are separate;
  rails run along the board.
- **Node of a row** = its index in `layout.rows`: `'-'` → **0 = GROUND**, `'+'` → 1, then `1ae` 2, `1fj` 3, `2ae` 4 …
  Private nodes after the rows (`34…`). `nodes = rows + privates`; unused rows cost nothing (`mna.ts` `compile` skips
  nodes no pin uses, L18-22; they read 0 V).
- Ground is always the `−` rail: the battery is fixed to the rails (§3.4), so the scope's ground clip and the
  meter's «COM» reference are well defined (radio Open Q4 resolved for the bench by construction).

### 3.3 Legs → nodes

- `footprintOf(spec)` gives the leg offsets in grid steps; leg *k* = catalog pin *k* (`PARTS[key].pins` order:
  `['a','b']`, `['plus','minus']`, `['ccw','wiper','cw']`; E1-4 adds diode/LED pins, E1-6 transistor pins).
- `place(anchor, o)` maps every leg through the orientation (quarter turns in grid space) to a socket; all legs must
  land on free sockets of the board, else the placement is refused (whole-part gesture shows no preview there).
- **Polarity is never refused.** A reversed LED/electrolytic/diode is a legal placement; the model makes it dark,
  bulged or blocking. A part with both legs in one row is legal too (shorted by the row — a classic mistake; the model
  gives it zero voltage).
- A leg re-seat keeps the other legs; the new socket must be free and within `[minSpan, maxSpan]` pitches of every other
  seated leg (axial 3–6, radial 1–3, TO-92 fixed 1, wire 1–16).

### 3.4 Fixed parts and leads (`BENCH_FIXED`, decision (synthesis))

| id | spec | pins → | notes |
|---|---|---|---|
| `BAT` | `battery-9v` | `{private:'bat+'}`, `{row:'-'}` | 9 V, 1.5 Ω; always present |
| `SW` | `switch` | `{private:'bat+'}`, `{row:'+'}` | the battery's slide switch; `setting` 0/1 from `bench/switch.ts`; default open |
| `SPK` | `speaker-8` | `{lead:'spk+'}`, `{lead:'spk-'}` | two plug leads from the speaker; pending until both are plugged |
| `PLAYER` | E1-7 key (player source, 32 Ω) | `{lead:'pl+'}`, `{lead:'pl-'}` | pending until both plugged; absent from `BENCH_FIXED` until E1-7 lands |
| `LAMP` | E1-4 key (lamp 6 V · 0.1 A) | `{lead:'lamp1'}`, `{lead:'lamp2'}` | absent until E1-4 lands |

Leads are `Leg`s anchored at their item with a long reach (hermite + `Lay.length` slack bow), the same hands as jumper
ends. A step presets them (`bench.preset([...], { 'spk+': 'a12', 'spk-': '-12' })`).

### 3.5 How a Netlist is built (`netlistOf`)

1. Fixed parts: pins → node of the row / private node / the row of the lead's socket; a fixed part with a lead
   unplugged → `pending`, left out.
2. Board parts: every leg seated → `PartInstance { id, spec, pins: legs.map(node of row of socket), setting }`;
   any leg `null` → `pending`, left out (decision (synthesis), Open Q3; for 2-leg parts identical to a private floating
   node; the board itself says «this leg is in the air» from `pending`).
3. `extra` (the meter in A mode: `{ id: 'METER', spec: 'jumper', pins: [node(red), node(black)] }`).
4. `nodes = rows.length + privates.length`; `checkNetlist(net)` in a dev assertion — a `RangeError` never reaches the
   model (Gotcha G8); `key` = sorted `${id}:${spec}:${pins}` strings joined.
5. **Recompile only when `key` changes** (`compile` allocates the matrix once per circuit). Settings (pot, switch) are
   written into the **compiled** `PartInstance` objects (`circuit.net.parts`) and the same circuit is re-solved:
   `readSettings` reads `e.part.setting` at every solve (`mna.ts` `readSettings`). So the driver keeps a map
   id → compiled `PartInstance` and writes there, not into a fresh netlist.

### 3.6 Removal, burnt parts, replacement

- **Remove** = `remove(state, id)` (dragged off the board or onto the tray) → key changes → recompile; the 3D model
  leaves (eased) and is disposed.
- **Burnt** (E1-4: «Згорілий резистор, світлодіод, лампа, діод стають розривом»; electrolytic `bulged`, E1-5): the
  status lives in the one `ModelState` **by part id**; the part stays in the netlist and the model opens it. Moving a
  burnt part keeps its id → it stays burnt (honest). Removing it and dragging a fresh one from the tray gives a **new
  id** from `nextId` → fresh. The bench never edits damage; a step that resets must `remove` + place anew (or call a
  model reset of that id if E1-4 offers one).
- Until E1-4 lands the driver has no damage: `status()` derives `warm/hot` from `load` only, never `burnt`.
- Ids are stable for the life of a placement and **never reused within a mount** (a reused id would inherit damage).
- On removal for good the driver calls `forget(id)` → `state.parts.delete(id)` (E1-4's contract in `state.ts`); a part
  that is only carried to another place on the board keeps its id and its memory (still hot, still burnt).
- Heat accumulates only while the part is in the netlist (`advanceHeat` skips parts the netlist does not hold: «a part
  the netlist does not hold keeps its heat») — a part held in the hand neither cools nor heats; decision (synthesis):
  acceptable, the hand is brief.

---------------------------------------------------------------------------------------------------------------------

## 4. Interaction model

### 4.1 Platform APIs used (USE)

- `ctx.input.register(hit, { cursor: 'grab', tooltip, enabled, hover, press, click, dragStart, drag, dragEnd })`
  (`engine/input.ts` L60-85, L119); `DragInfo.planePoint(normal, through, out)` (L57); thresholds 4 px mouse / 9 px
  touch (`dragStart` on the first move past it); touch slop rings 10/22 px; long press 480 ms shows the tooltip.
- `ctx.qa.probe(name, Object3D | Vector3 | () => …)`, `ctx.qa.expose(name, fn)` (`engine/qa-probes.ts` L10, L30-38).
- `damp` from `@/engine/api`; `ctx.tweens`/`ctx.stage.scope.delay` for timers; `ctx.random` only if chance is ever
  needed (it is not: ids are counters).
- `stepUi(ctx)` controls for what is not a drag: the pot (slider writes `model.set('P1', v)`, the 3D knob follows), the
  meter mode (`segmented`), scope time/div and volts/div (`segmented`/`slider`), «empty the board» (`button`).

### 4.2 Pickables (few, low-poly)

- One invisible hit proxy per **placed part body** (`PartModel.hit`, a box), one hit sphere per **leg grip / lead plug /
  probe tip** (r 0.3 u), one per **tray slot**, one on the battery switch. Detailed meshes are never registered (the
  pick raycasts the whole subtree of every enabled registered root every hover frame, `input.ts` L342-356, L397-413).
- `PointerInfo.object` is the registered root, not the mesh hit → one registration per proxy is the simplest way to
  know which part/leg was touched; `e.point` gives the hit point for a grab offset.
- `enabled()` = `!bench.flying && policy.take(key) && (held === null || held === key)` — cheap (polled per pick).
- Registrations of runtime parts are made when the part appears and **unsubscribed when it is removed** (the
  `Unsubscribe` from `register`; likewise every `ctx.qa.probe` disposer).

### 4.3 Gesture 1 — carry a whole part (tray → board, board → board, board → tray)

1. `dragStart` on a tray slot → `nextId` → build the `PartModel` → a `PartOnBoard` in «hand» mode; the gesture stays
   with the slot's registration (drag events go to the pressed entry, `input.ts` L600-607), so the slot handler
   forwards to `hands.drive(key, e)`. `dragStart` on a placed body → `unseat` all its legs at once (key changes; the
   model sees the part gone while it is in the hand — honest: it left the sockets).
2. `drag`: board normal from `frame.getWorldQuaternion`; plane through the board at carry height; `planePoint` →
   `frame.worldToLocal` → board xz minus the grab offset → candidate anchor = `layout.nearest(x, z, SNAP)` for leg 0
   → `legSockets(anchor, o)`; legal (all free, on board, `policy.place`) → `preview` = those sockets, the part hovers
   above them with its legs pointing down; cue rings on the target sockets, the target rows highlighted
   (`view.highlightRow`). Not legal → the part follows the hand freely.
3. `dragEnd`: preview legal → every leg `go({kind:'socket'}, 0.18, 0.12)`; each leg writes `seatLeg` **on arrival**
   (the netlist changes at the click). Over the tray / off the board → the part flies to the tray and is removed.
   Elsewhere on the board with no legal preview → back to where it came from (placed part) or to the tray (new part).
4. Orientation: the default per footprint (legs along columns: an axial part spans columns → different strips).
   A **click** on a placed part (no drag) turns it end for end (`o + 2`, polarity flip) when the step's policy allows;
   a quarter turn (part across the channel, `e7 → f7`) comes from re-seating one leg (gesture 2) — decision
   (synthesis), Open Q1.

### 4.4 Gesture 2 — re-seat one leg / one end (build's mid-drag snap)

`dragStart` on a leg grip / lead plug / jumper end / probe tip → `held = key`, `left = its socket`, `seatLeg(null)`
(that leg is out: the part becomes `pending` — the model sees it at once). `drag`: plane point → board → clamp to the
area → clamp to the reach circle of the part's other seated legs (`hands.ts` L99-106 idea; `[minSpan, maxSpan]`) →
`leg.carry(p)` → forget `left` once the hand is `AWAY` from it (decision (synthesis): 0.5 P = 0.15 u; build used
0.5 u for clamps) → `nearest` within `SNAP` that is free (`canSeat`) or
any socket for probes, allowed by `policy.seat` → **snap mid-drag**: `held = null`, `leg.go(socket, 0.18)`, rest of the
gesture ignored (`held !== key`). `dragEnd` with no snap: a leg goes back to `left` (a part leg is never left in the
air on its own — decision (synthesis)); a jumper/lead/probe end lies where it is (`lie`, build behaviour).
`near` = the candidate within `1.8 × SNAP` (cue ring), computed every drag.

### 4.5 Probes

Multimeter (`red`, `black`) and scope (`ch1`, `ch2`) tips are `Leg`s with `Place` socket | rest (beside the
instrument) | hand. Style A only (board-xz snap during the drag, deterministic in QA); a probe **shares** a socket with a
leg (one row = one node; `policy.seat = () => true`, occupancy ignored) and is drawn touching the top of whatever sits
there. The scope's ground clip is fixed on the `−` rail. Off-board terminals (battery clamps, speaker posts) are not
probe targets: every useful node reaches a board row through leads.

### 4.6 Gating, deep links, determinism

- `bench.flying` (set by the dive/door while the camera flies) makes every handler inert; steps add their own `policy`.
- `enterStep(id, info)`: every step re-derives the board (`bench.preset(...)`), `info.instant` → `bench.snap()` (legs,
  grips, glides, looks, instruments jump). What the reader built lives in step-module state; «Назад» rebuilds.
- No timers: countdowns in `update(dt)`; travel times from `Leg.go`; ids from counters.

---------------------------------------------------------------------------------------------------------------------

## 5. Instruments

### 5.1 Multimeter

- **Model:** a digital DMM body on the table (Builder, ≤ 4 draw calls), LCD optional, two leads (`DynTube(30, 8)` as
  `S/tools/gauge.ts` L268-301), two probe tips (`Leg`), grips cyan. Probe body colours: Open Q9 (red/black like a real
  meter vs `SEMANTIC.dcPlus` coral / `SEMANTIC.dcMinus` blue).
- **Reading** (every `update` after the model solved; the DC operating point of the board):
  - `V`: both tips seated → `rowVolts(row(red)) − rowVolts(row(black))`; else `null` → `'—'`.
  - `A`: the meter is a series part: `extraParts()` = `[{ id: 'METER', spec: 'jumper', pins: [node(red), node(black)] }]`
    → value = `reading('METER').i` (current into the red probe). A meter put across the battery is a short: the model
    reports `short`, the battery heats (honest; no fuse in E2 — Open Q8).
  - `Ω`: a copy of the netlist without `battery`/`source`/player parts plus `ideal-9v` between the probe nodes
    (`PARTS['ideal-9v']`, 9 V, never on the bench but fine inside the meter's own solve) → R = 9 / |i|; `i ≈ 0` →
    `'OL'`. In-circuit values come out as they would on a real meter (a teaching point). E1-3 API only.
  - With a time source playing (E2-9+), DC mode shows the operating point (the music's mean is 0) — decision
    (synthesis); an AC mode is not in E2.
- **Display filter:** the shown value follows `followVoltage` (`S/battery-cell.ts` L119-122) or a DMM-like
  sample-and-hold every 0.33 s of engine time; QA reads the raw `value` and the `text`.
- **HUD:** `meter.readout(id, caption)` →
  `{ type: 'readout', id, label, text: () => meter.text }` with `fmtSI(value, unit, { maxDigits: 3 })` (`content/
  format.ts` L73) — **`text`, not `get`**: no count-up lag after a probe jump (`STEADY 0.25 s` → `COUNT_UP 0.45 s`) and
  it works on held pages (radio `scene.ts` L102-115). The label comes from the step's captions. `'—'`/`'OL'` are
  symbols, not Ukrainian words.
- **qa:** `ctx.qa.expose('electronics-meter', () => ({ mode, red, black, value, text, shown }))`; probes
  `probe:red`, `probe:black` (Vector3 getters of the tips).

### 5.2 Oscilloscope

- **Source of samples:**
  - live page: the E1-9 worker link returns, per block, the speaker current **and** the tapped node voltages
    (`taps = scope.taps(net)` → the probe rows' nodes; changing a probe changes taps, not the netlist);
  - held page (`?freeze`): `model.still({ warmup, span, fs, taps })` — a synchronous transient (E1-5) from the operating
    point: warm-up `max(0.2 s, 5 τmax)` (decision (synthesis)), then capture `span + holdoff`; computed once per change
    on the first held frame (`dt === 0`) after `key`/settings/probes changed (radio `heldFor` idiom);
  - before E1-5 lands: DC flat lines from the operating point only.
- **Sample rate:** `fs` = E1-7's choice (24 000 or 48 000 Hz). Ring buffer per channel of
  `ceil(fs × 2 × (span + holdoff))` floats (20 ms span @ 48 kHz → ~2 k; 200 ms → ~20 k; fine).
- **Sweep mode** (default): on each new block, `findTrigger` on ch1 (rising through `level`, default the midpoint of
  the last block's min/max; `auto` free-runs when no edge within one span), then `decimateMinMax` the window
  `[trig, trig + span)` into **≤ 300 buckets → ≤ 600 points per channel** (min then max per bucket, so peaks survive
  and a 48 kHz audio window still draws as a band); bump `sweepVersion`. At most one sweep per engine frame; a sweep
  only when a new block arrived.
- **Roll mode** (slow: RC charge with τ ≈ 1 s): one sample per engine frame (block mean of each tapped node, or the
  DC solve when no transient runs) → `chart.push(id, t, v)` with `window` = 10 divisions.
- **HUD chart** (board, `size: 'md'`): `chart: { x: { min: 0, max: span·1e3, label: 't, ms' }, y: { min: −4·V/div, max:
  4·V/div, label: 'U, V' }, series: [{ id: 'ch1', color }, { id: 'ch2', color, dash? }], window: (roll only) }`;
  `init(c)` refills from the scene's last sweep (DOM charts are rebuilt per step entry, `hud-dom/dock/build.ts` L94-97);
  `update(c)` → `if (scope.sweepVersion !== seen) c.setData('ch1', t, v1)` (+ ch2). Axis titles in Latin symbols are
  allowed in code; series labels/legend from captions. Never NaN in the arrays (breaks the curve).
- **3D instrument:** a Builder body + `createScope({ width, height, channels: [c1, c2], samples: 160 })` (`fx/signals/
  scope.ts` L129); per new sweep `scope.setSamples(i, values)` with `values` = an 80-bucket min/max version (160 points,
  −1…1 by volts/div; `setSamples` resamples by nearest index, so feed it exactly 160 to avoid aliasing). It self-ticks
  (`onTick`); 1 screen + 1 draw call per channel. Same samples as the HUD — «the instrument shows only the model».
- **qa:** `electronics-scope` → `{ mode, fs, span, trigger, sweepVersion, n, min: [..], max: [..], hash: fnv1a(bytes
  of the decimated sweep) }`; held page twice → same hash (determinism gate).

### 5.3 Speaker / sound (E2-10, on E1-9)

Speaker part `SPK`: audio sample = `i_SPK × 8 Ω / V_FULL` (decision (synthesis): `V_FULL` ≈ 2.83 V = 1 W into 8 Ω
maps to 0.5 of full scale), through E1-9's limiter and the settings' volume. Pacing by the audio clock (request while
`queued < 2 blocks`), not by engine time (radio's `LINK_MAX_FPS` would starve audio at low frame rates). Live vs the
«4 s loop» fallback = E1-7's speed verdict. Nothing audible is ever read back into the scene or QA except counters.

---------------------------------------------------------------------------------------------------------------------

## 6. Batch E2 — ten sequential tasks

Format as `batch-E1.md`: each task one cycle «виконавець → огляд → виправлення», commits to local `main`, explicit
paths, Ukrainian commit sentences without AI notes. Every task ends with `cd app && pnpm typecheck && pnpm lint &&
pnpm test` green (prelude; `pnpm` only from `app/`), `python3 tools/content/doccheck.py --all` ALL GREEN,
`python3 docs/volumes/electronics/check.py` OK (from E1-8), REUSE rows for its copies. Browser checks run the sandbox
QA `node app/src/volumes/_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs --port <p> --out <dir> --only <sections>`
against `pnpm dev` (background) and read numbers through `__app.read(...)`, never pixels.

Dependency legend: **[now]** needs only landed work (E1-3) · **[E1-x]** cannot start before E1-x lands ·
(soft E1-x) = can start; a part of it is finished when E1-x lands.

### E2-1. Документ вигляду стенда (`VISUAL.md`) і план копій · **[after E1-8]**

- **Goal:** the visual contract of the bench before any model is drawn (design §6, §10: board geometry, part looks,
  colour table): numbers the code tests assert.
- **Files:** create `docs/volumes/electronics/VISUAL.md` (numbered H2 like circuit/radio: 1 Принципи (3 tests, 320 px,
  one world, «прилад показує лише модель», overrides of circuit VISUAL §2: perforation/grid allowed on the breadboard
  only, bloom allowed from LEDs and the lamp) · 2 Кімната й стенд (base 8.4 × 5.6, places table) · 3 Плата (§3.1
  numbers, socket names, rows, rails, highlight) · 4 Деталі (each kind: scale, colours, prints, legs; resistor code
  colour table with gold/silver derivations from tokens; LED colours; heat/burnt/bulged looks; «no smoke recipe») ·
  5 Прилади (DMM, probes, scope face, channel colours) · 6 Рука (grips, cues, preview, tray) · 7 Поверхи й лупа (stand →
  part → inside) · 8 Ракурси (shots) · 9 Телефон · 10 Чек-лист аудитора); append REUSE rows for §2 groups A–F as
  «planned» (each task flips its rows to «done»); if E1-8's `check.py` asserts VISUAL sections (radio rule 6), keep the
  list in step.
- **Tests/checks:** `python3 docs/volumes/electronics/test_check.py` and `check.py` OK; doccheck ALL GREEN; μ U+03BC,
  ’ U+2019.
- **Reader:** an independent reader (design §9.8) checks physics of looks (no effect without model output) and safety.
- **Commit:** «Вигляд стенда тому «Радіоелектроніка»: плата з гніздами, деталі, прилади, ракурси й перелік копій з
  тому «Електричний струм»».

### E2-2. Плата як дані: гнізда, ряди, відбитки деталей, схема з плати · **[now]**

- **Goal:** `E/sim/board/` (§1.1, §3): the pure board → `Netlist` mapping, unit-tested, no three.
- **Files:** `E/sim/board/{layout,footprint,seat,netlist,index}.ts`, `E/sim/board/__tests__/{layout,seat,netlist}.test.ts`.
  No edit to `sim/core/**` (E1 tasks own it).
- **Tests (vitest, written first):** layout counts and ids (204 sockets, 34 rows, `−` → 0, `+` → 1); `nearest`
  within/outside `SNAP`; footprints for the landed kinds (resistor 4 P, pot, jumper, speaker; null for unknown);
  `place` all-or-nothing, rotation, occupancy, `nextId` sequence `R1, R2`; `netlistOf`: divider on the board →
  `solveDC` → middle strip **5.997 V** (± 1e-9), switch open → 0 A, pending when one leg is out, key stable when a leg
  moves inside its row, key changes across rows; `checkNetlist` never throws on any state reachable by the reducers
  (a small seeded exhaustive walk with a local counter, no chance); purity test still green (file count ≥ 7 rises).
- **Acceptance:** `pnpm vitest run src/volumes/electronics` green; full gates green.
- **Note:** `footprintOf` is a `Partial<Record<PartKind, …>>` lookup (Gotcha G6), never an exhaustive switch.
- **Commit:** «Плата тому «Радіоелектроніка» як дані: гнізда й ряди, відбитки деталей і схема, яку модель кола рахує з
  плати».

### E2-3. Кімната, стенд і плата в 3D; пісочниця стенда · **[after E2-1, E2-2]**

- **Goal:** `mountBench(ctx)` with the copied room/base/light/lens and the new 3D breadboard (`BoardView`, instanced
  sockets), fixed items as placeholders, the sandbox and its QA skeleton.
- **Files:** group A copies (§2.1) into `E/shared/bench/`, new `bench/board-view.ts`, `bench/index.ts`, `bench/README`
  section in `E/shared/README.md`; `model/hash.ts` (fnv1a, meanOf); sandbox `app/src/volumes/_dev/chapters/
  _sandbox-electronics-bench/{index.ts, scene.ts, qa/measure.mjs, qa/helpers.mjs}` (step `room`); REUSE rows.
- **Tests:** `bench/__tests__/layout.test.ts` (places inside the base, breadboard margin, holder clear of the board,
  tray/meter clear of the HUD bar band); `board-view.test.ts` with a ctx stub (`{ clock, onDispose, qa: { expose,
  probe } } as unknown as ChapterContext`, radio `world.test.ts` L55-59): socket positions = `layout` positions under
  the frame transform (Box3/Vector3, no WebGL).
- **QA (`--only room`):** opens `_dev/_sandbox-electronics-bench/room` (`appUrl`, `freeze: 0`, `__app.pause()`);
  `electronics-bench` reader `{ sockets: 204, rows: 34, drawCalls }` via `__app.stats()` → draw calls ≤ 350 (target
  ≤ 200 with the room); `__app.locate('socket:a1' | 'socket:j17' | 'socket:-9')` visible and inside the frame at
  1280 × 720, 1920 × 1080 and phone 390 × 844 (`--touch`); console clean.
- **Commit:** «Стенд тому «Радіоелектроніка»: темна кімната, основа з макетною платою, лупа в тримачі й пісочниця
  стенда».

### E2-4. Деталі з реальними ознаками · **[after E2-3]** (soft E1-4, E1-5, E1-6)

- **Goal:** `E/shared/parts/` (§1.3): every part as a model with real marks, legs at the footprint pitch, a `setLook`
  hook; the lamp copied from circuit.
- **Files:** `parts/{index,code,resistor,capacitors,diode,led,transistor,pot,jumper,speaker,battery9v,player,bulb,
  heat-scale}.ts`, tests; group B copies (§2.2); sandbox step `parts` (one of each on the board, a row of resistors
  1 Ω … 1 MΩ). Kinds whose catalog keys do not exist yet get models built from VISUAL tables and are bound to keys
  later (`buildPart` returns null for an unknown key).
- **Tests:** `code.test.ts` — `resistorBands(4700, .05)` = yellow violet red gold; 330 Ω = orange orange brown gold;
  1 Ω = brown black gold gold; 9.1 MΩ = white brown green gold; every catalog resistor has 4 valid bands;
  `capacitorCode(1e-7)` = '104', 1e-11 = '100'; models: leg tips at 4 P / 1 P / 2 P (Box3), `hit` exists and is
  invisible, draw calls per model ≤ 6 (count meshes per material slot), no `Text3D` built in Node tests (fonts).
- **QA (`--only parts`):** draw calls ≤ 350 with every part on the board; `electronics-board` lists all placed parts;
  text size ≥ 16 px-eq for any print shown at 1280 × 720; prints hidden on phone.
- **Commit:** «Деталі тому «Радіоелектроніка»: резистори з кольоровими смужками за номіналом, конденсатори трьох видів,
  діод, світлодіоди, транзистор, змінний резистор, динамік, батарея з вимикачем, плеєр і лампа».

### E2-5. Рука: лоток, вставляння й виймання деталей, перемички й дроти приладів · **[after E2-4]**

- **Goal:** both gestures (§4) on generic hands; the tray; fixed items' plug leads; the battery switch; the board
  state follows what arrived.
- **Files:** group C copies (§2.3) into `E/shared/hand/`, new `hand/{tray,hands}.ts` (generic), `bench/switch.ts`,
  `bench/fixed.ts` (battery + switch, speaker/player/lamp with leads); `bench/index.ts` wiring; sandbox step `hand`
  (empty board, tray of resistors/jumpers/LEDs, speaker leads loose); qa `helpers.mjs` copy.
- **Tests:** `leg.test.ts` (travel, lift cap, shortest-angle turn, `seated` only on arrival), `hands.test.ts` with fake
  `DragInfo` (snap within SNAP, no snap between sockets, `left`/`AWAY` hysteresis, reach clamp, `near`/`preview`
  computed, `held !== key` ignores late events), `tray.test.ts` (ids from the counter, unlimited supply).
- **QA (`--only hand`, mouse and `--touch`):** `pointer().path([tray:resistor-1k, mid, socket:a3])` then
  `advance(0.35)` → `electronics-board.parts.R1.legs = ['a3','a7']`; drag `leg:R1:1` to `socket:a8` → legs updated,
  key changed; drag `part:R1` onto the tray → removed; jumper end into `socket:+5`; `switch` tap toggles `SW.setting`;
  `strides('electronics-motion')` within bounds (no jumps); every drag also at 390 × 844 touch.
- **Commit:** «Рука на стенді: деталь із лотка стає в гнізда, переставляється по одній ніжці й повертається в лоток, а
  перемички й дроти динаміка вставляються в ряди».

### E2-6. Модель на стенді й мультиметр · **[after E2-5]** (best after E1-4: absorbs its API change)

- **Goal:** the bench's model driver (§1.6: compile on key change, solve on setting change, one `ModelState`, `dcMs`)
  and the multimeter (§5.1: V / A / Ω, probes, HUD readout).
- **Files:** `E/shared/model/{driver,index}.ts`, `E/shared/instruments/{meter,meter-model,probe,index}.ts` (gauge
  pieces §2.4); sandbox steps `divider` (preset 1 kΩ/2 kΩ, switch closed), `meter` (free probes).
- **Tests:** `driver.test.ts` (no recompile when only a setting changes — same `Circuit` object; recompile on key
  change; pending parts excluded; `ModelState` survives rebuilds), `meter.test.ts` (V on a divider = 5.997 V; same row
  → 0; one probe off → '—'; A mode on the divider's branch = 9 / 3001.5 A ≈ 2.9985 mA; Ω on a lone 4.7 kΩ = 4700 ± 1e-6
  relative; Ω on two 1 kΩ in parallel = 500; open → 'OL').
- **QA (`--only meter`):** held page (`?freeze=1`): `__ui.set('meter-mode', 'V', true)`, drag `probe:red` → `socket:a7`,
  `probe:black` → `socket:-3`, `__app.step(1/60, 30)` → `electronics-meter.text` = «5,997 V» (decimal comma) and the
  readout element shows it (`__ui.locate('ctl-meter')`); A and Ω modes likewise; `dcMs` < 1 on this machine.
- **Commit:** «Модель кола працює на стенді, а мультиметр показує напругу, струм і опір у панелі кроку».

### E2-7. Світло, нагрів і згоряння зі стану моделі · **[E1-4]** (lamp inrush in time: soft E1-5)

- **Goal:** LEDs and the lamp light from the model's current; parts warm by `load`; `hot` → `burnt` over **engine** time
  from E1-4's accumulation; burnt stays until replaced; electrolytic `bulged` when E1-5 lands.
- **Files:** `parts/look.ts` (heat via `applyHeat` / `paintEmissive`, charred tint, LED glow, `createHalo`), `bench/
  lights.ts` (a fixed pool of 3 shadowless PointLights for the brightest LEDs, intensity 0 when unused — never add or
  remove lights), `bench/light.ts` hook (the lamp part drives the key light), driver `status()`/`heat()`/`forget()`
  and the per-frame `advanceHeat(state, circuit, solution, dt)` + re-solve on burnt ids; bind LED/diode/lamp
  catalog keys in `buildPart`/`footprintOf`; sandbox steps `led` (red LED + 330 Ω from 9 V), `overload` (100 Ω across
  9 V: 0.786 W on 0.25 W), `lamp`.
- **Tests:** look mapping is a pure function (`load`/status → emissive/intensity) and monotone; the pool assigns the
  brightest; burnt latches and survives a re-seat (same id); a fresh part from the tray is `ok`; `dt = 0` and
  `dt = 1/15` frames tolerated.
- **QA (`--only heat`):** held page + `__app.step(1/60, k)`: `overload` → status `hot` then `burnt` within E1-4's
  window, current 0 after; drag it out and a new 100 Ω in → `ok` then `hot` again; `led` → LED current = model value
  (± 1e-9 vs `electronics-model`), light > 0; lamp lights the room (`light.output` > 0); draw calls ≤ 350; no
  recompiling shaders on burn (programs count flat across the step).
- **Commit:** «Світлодіоди й лампа на стенді світять струмом моделі, деталі гріються за потужністю, а перевантажена
  деталь згоряє й лишається згорілою, доки її не замінять».

### E2-8. Лупа: зі стенда до деталі й усередину · **[now]** (after E2-4 for a part to dive into)

- **Goal:** the floor axis mechanics for any part on the board (§1.7): lens leg → part close-up (bands readable) →
  `inside` (the door's `cut` opens; a placeholder cutaway of the resistor until E3 builds the inner view); floor
  ladder; hands inert while flying.
- **Files:** group E copies (§2.5) into `E/shared/dive/`; `dive/door.ts` (partDoor), `dive/poses.ts`; sandbox step
  `loupe` (a 4.7 kΩ resistor in `a5…a9`; dock slider «depth» `0 … 1 + LENS_LEG` like `lamp/steps/01-inside.ts` L73-91).
- **Tests:** copied `dive.test.ts`/`levels.test.ts` with synthetic stops (continuity, lens lands at 85 %, timed travel
  ends on time, `floorAt` ids `stand/part/inside/atoms`); `partDoor` stops are computed from the part's board pose
  (pure maths test).
- **QA (`--only loupe`):** scrub the slider pixel by pixel → camera stride below the bound (`strides('electronics-
  motion')`), floor ladder reads `part` past 0.5 and `inside` past 1 (`__ui` ladder text), hands disabled while flying,
  back to the stand plan at 0; reduced motion shortens the flight.
- **Commit:** «Лупа на стенді веде від плати до деталі й усередину неї, а сходинки «Де ми» показують поверх».

### E2-9. Осцилограф: живий слід на дошці кроку й прилад на стенді · **[E1-5]** (music traces: soft E1-7; live via worker: soft E1-9; amplifier preset: soft E1-6)

- **Goal:** §5.2 — sweep/roll, trigger, min/max decimation, HUD board chart, 3D `createScope`, probes, held-page
  `still`, live blocks through E1-9's link (taps).
- **Files:** `E/shared/instruments/{scope,sweep,scope-model}.ts`, driver `still()`, link consumption (`taps` in the
  request — extend E1-9's protocol in its own files with a REUSE note if missing); sandbox steps `rc` (9 V → switch → 10
  kΩ → 100 μF, roll mode; needs E1-5 only) and `scope` (player → RC low-pass → speaker; needs E1-7).
- **Tests:** `sweep.test.ts` — `decimateMinMax` keeps the extremes of a sine (min/max within 1e-6 of ±A), no
  allocation (same output buffers), ≤ 600 points; `findTrigger` finds the rising edge of a sine at the level, honours
  slope and holdoff, `auto` free-runs; chart spec: `init` refills, `update` calls `setData` only when `sweepVersion`
  changed (fake ChartApi counts calls); `still` determinism (two calls → identical arrays).
- **QA (`--only scope`):** held page twice → identical `electronics-scope.hash` (repeat gate); `rc`: roll trace reaches
  63,2 % at τ = 1 s ± E1-5's tolerance; `scope` (after E1-7): ch2 amplitude after the filter falls when R grows
  (numbers from the reader, not pixels); live page: `mode === 'worker'`, first sweep ≤ 5 s, sweeps keep coming; draw
  calls ≤ 350.
- **Commit:** «Осцилограф стенда показує напругу в часі з моделі кола — слід на дошці кроку й той самий слід на приладі».

### E2-10. Звук із динаміка, ворота й звіт черги · **[E1-7 + E1-9]**

- **Goal:** the speaker plays what the model gives (§5.3) through E1-9's SoundOut; the sandbox's full QA; shared README;
  the batch report.
- **Files:** `E/shared/sound/speaker.ts` (or `instruments/speaker.ts`): speaker current → samples, pacing by the audio
  queue; `bench/index.ts` option `sound`; sandbox step `sound` (player → pot 10 kΩ as volume → speaker; pot on a HUD
  slider); `E/shared/README.md` complete (mount, options, state table, who writes what, rules, readers, parts table);
  `docs/volumes/electronics/reports/batch-E2.md` (what was built with commits, numbers: draw calls, `dcMs`, sweep cost,
  audio underruns/latency, phone profile, open questions).
- **Tests:** speaker scaling (1 W into 8 Ω → 0.5 FS; pot at 0 → silence = all-zero block), pacing against a fake audio
  clock (requests only while `queued < 2` blocks).
- **QA (`--only sound,repeat,leaks`):** URL without `noaudio` (build it, `appUrl` always adds it), a click for
  `ctx.gesture`, 10 s → `electronics-sound.underruns === 0`; settings mute → gain 0 or suspended; `?noaudio` → no
  `AudioContext` (count constructions with a Playwright init script wrapping `window.AudioContext`); pot to 0 → output
  level 0 from model samples; leaks: 3 × `__app.goto('_sandbox-ui')` and back → geometries/textures/programs flat,
  `page.workers().length === 1`, no live AudioContext; console clean. Then the batch gates (plan «Ворота черги») and
  the site profile build.
- **Commit (two):** «Динамік стенда грає те, що модель кола дає на ньому, крізь власний звуковий вихід тому» and «Звіт
  черги E2 тому «Радіоелектроніка»: стенд, рука, прилади, звук і числа перевірок».

### 6.1 Order and parallelism

`E2-2 [now] → E2-1 [E1-8] → E2-3 → E2-4 → E2-5 → E2-6 → E2-8 → E2-7 [E1-4] → E2-9 [E1-5] → E2-10 [E1-7, E1-9]`.
E2-2 and E2-8 need nothing from E1; E2-8 is placed before E2-7 so that the E1-gated tasks come last. E2 tasks never
edit `E/sim/core/**` or E1-8's documents except by appending REUSE rows (E1 tasks commit to the same `main`).

---------------------------------------------------------------------------------------------------------------------

## 7. Risks

1. **E1 API churn.** E1-4 turns `solveDC` into Newton and grows `ModelState`; E1-5 adds `Transient`; E1-6/E1-7 add kinds
   and the player. Mitigation: one driver (`shared/model`) is the only bench file that calls the model; kind tables are
   `Partial` (G6); catalog bindings are listed per task.
2. **Performance.** Parts × materials × shadow passes can pass 350 draw calls fast (the circuit stage alone sits at
   171–317, `S/README.md` L278-283). Mitigation: instanced sockets, merged Builder slots, `castShadow = false` on small
   parts, fixed light pool, draw-call gate in every QA section.
3. **Touch on phones.** 17 columns on a portrait phone give P ≈ 15–20 px at the stand shot. Mitigation: a closer
   `board` shot on phones, grips ≥ 0.3 u with touch rings, whole-part carry as the main gesture.
4. **Readability in the dark room.** Most steps have no lamp lit; circuit's look is «muted» when open (stage G18).
   Mitigation: VISUAL sets ambient/moon for the bench; LEDs/lamp as extra light.
5. **Snapping to the wrong socket in QA.** Mitigation: `SNAP = 0.45 P`, mid-point lifts in drags, assertions on
   `electronics-board`, not pixels; `advance(0.35)` after each drag (seated on arrival).
6. **Audio.** A second `AudioContext`, parity with engine loudness, hidden-tab underruns, first worker under a Pages
   sub-path (radio never shipped one). Mitigation: E1-9 first, E2-10 only wires; site smoke after E3 asserts
   `mode === 'worker'`.
7. **Held pages vs transient cost.** `still` on the main thread may exceed the 10 ms budget for long windows. Mitigation:
   bound warm-up and span; compute once per change; expose its ms.
8. **Concurrent commits.** Another process commits E1 tasks to `main` while E2 work starts. Mitigation: E2 touches
   only new paths (`sim/board`, `shared/{bench,parts,hand,instruments,model,dive}`, the sandbox) plus REUSE rows.

---------------------------------------------------------------------------------------------------------------------

## Gotchas

- **G1. `ctx.gesture`, not `ctx.input.gesture`** (`engine/chapter.ts` L224-225; design §6.3 and E1-9 text say
  `ctx.input.gesture`). It resolves on the first pointer/key; QA must click. Autoplay flags do not resolve it.
- **G2. Lint scopes** (`app/eslint.config.js`): `setInterval` is banned in every `src/**/*.ts` (L28-32), shared and sim
  included; `Date.now`, `performance.now`, `window.setTimeout`, `Math.random` only in `src/volumes/*/chapters/**`
  (L37, L54-60) plus `@/engine/*` except `@/engine/api` and `gsap` (L40-51). Bare `setTimeout`, `requestAnimationFrame`,
  `queueMicrotask`, `new Date` slip through lint but break the frozen-clock QA — never use them in chapters or shared.
  Timers → `ctx.tweens.delay` / `ctx.stage.scope.delay`; counters in `update(dt)`; chance → `ctx.random` (seeded per
  chapter; `fork` consumes the parent stream, fork in a fixed order); ids → counters. `no-console` allows only
  `warn`/`error`/`info`, and chapter-check fails on any warning or error.
- **G3. `sim/**` purity test** reads file texts **including comments** for `Math.random`, `crypto.*`, `Date.now`,
  `new Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `document.`, `window.` and allows
  only relative imports inside `sim/` (`purity.test.ts` L24-58). `sim/board` inherits it: no three, no `@/…`, not even
  a comment naming those.
- **G4. Volume boundary** covers type-only imports too (`chapter-boundary.js` visitor L63-73): no `@circuit/*`,
  `@radio/*`, `@electricity/*` anywhere in `E/`; every copy recorded in REUSE.md.
- **G5. Sandbox imports**: only `@electronics/shared/<module>` from **chapter files** of `_dev` (`showcase` L27 needs ≥ 3
  segments; L146 applies it only to chapters). `@electronics/shared` (root) and `@electronics/sim/**` are lint errors
  there → `shared/bench/index.ts` re-exports the sim API the sandbox needs.
- **G6. Never an exhaustive `switch (spec.kind)` with a `never` check in E2 code**: E1-4/5/6 add kinds to `PartKind`
  and their own typecheck gate would fail on our file. Use `Partial<Record<PartKind, …>>` + a null branch.
- **G7. E1-4 changes the model's surface** (`ModelState.parts`, Newton, `status`, `advanceHeat`, a second failure
  `'no-convergence'`) — call the model only from `shared/model/driver.ts`; on `ok: false` keep the last good looks and
  show nothing new (the solution then holds zeros), never `NaN` into a chart or a readout.
- **G8. Netlist rules:** pins in catalog order; `nodes` ≥ 1; ids unique and non-empty; settings finite — else
  `RangeError` from `compile`/`solveDC` (never a result). `netlistOf` must never produce a malformed netlist. A compiled
  circuit follows `part.setting` live — write settings into the **compiled** `PartInstance`; any other change needs a new
  `compile`.
- **G9. Numbers QA must expect:** the 9 V battery has 1.5 Ω (divider 1 k/2 k → 5.997 V, not 6.000); `jumper` and a
  closed switch are 1 mΩ (`WIRE_OHMS`); a jumper across the battery reports `short` and 9 / 1.501 A; `ideal-9v` exists but
  never on the bench; an ungrounded island is tied by 1 GΩ and reported.
- **G10. Picking:** `PointerInfo.object` is the registered root (`input.ts` L35-37, L406-413); every enabled registered
  root's subtree is raycast on every hover frame (L342-356) → register low-poly proxies only; `enabled()` cheap; a mesh with
  an invisible material is still pickable, `Object3D.visible = false` is not.
- **G11. Drag events:** `dragStart` on the first move past 4 px (mouse) / 9 px (touch); later `drag`/`dragEnd` go to the
  pressed entry **without** re-checking `enabled()` (L600-607, L643) → guard `held !== key`; a press on a registered
  object without drag handlers orbits the camera; `click` needs no movement (touch) and no long press.
- **G12. `ctx.qa.probe` on an Object3D resolves to its world bbox centre including invisible hit spheres** → probe the
  visible grip mesh or pass a `Vector3` getter (sockets, tips). Probes and input registrations of runtime parts must be
  disposed when the part is removed.
- **G13. `seated` vs target:** the netlist reads arrived legs only (`B/ends.ts` L108); QA must `advance` past the travel
  (0.18–0.35 s) before reading.
- **G14. `build`'s `hands.near` is dead** (only ever null, `B/hands.ts` L46, L113) — implement it, do not copy as working.
- **G15. DOM charts are rebuilt on every step entry** (`hud-dom/dock/build.ts` L94-97): `init` runs each entry, pushed
  history is lost → keep sweep buffers in the scene. `push` scrolls X only forward; without `window` it grows unbounded;
  NaN/±Infinity break the curve; after a time reset `clearData()` + `setAxis('x', …)`.
- **G16. Readouts:** a number readout counts up (0.25 s steady → 0.45 s tween) and freezes on held pages → use `text()`
  readouts for the meter; default number format has no SI prefix → `fmtSI`.
- **G17. `stepUi(ctx)` once per scene** (binding keyed by full chapter id); `ui.onChange` listeners are never removed (add
  them in the factory, not in `enter`); `ui.value(id)` throws for undeclared ids. Every `custom` control needs a `dom`
  factory (DOM HUD is the default, `engine/app.ts` L53).
- **G18. Goals** (`ui.goal`) work only for path-format content; keep reached goals in a module-level `Set` (circuit
  precedent `C/chapters/build/chapter.ts` L47-52) — the one sanctioned module state.
- **G19. Env ownership:** `room.ts` sets `ctx.env.base(ROOM_ENV)`; the light rig owns `ctx.env.tune` and re-applies when a
  step entry reset the env (`light.ts` L143-164); never `ctx.env.tune` from chapters; theme `{ sky: 'studio', mood:
  'studio' }` (set in `E/volume.ts`; circuit's sandbox repeats it per chapter manifest — do the same in ours).
- **G20. Unlit materials shine in the dark room** (`K.glass`, `K.glow`, `Text3D`) → drive them from the room level
  (`light` props); translucent plastic (LED epoxy, film capacitor coat) = `sheath()`; `tame()` every lit material,
  runtime-added parts included (`surface()` exempt).
- **G21. Transparent glass + DoF:** add a `depthShell` (`S/bulb.ts` L132, renderOrder 5000) to LED domes and the lamp.
- **G22. GPU NaN rule:** no `pow`/`sqrt` of a value that can be 0 in shaders on this GPU (bloom spreads NaN as black blots);
  meshes without normals (flat Text3D) get no shading twins.
- **G23. Budget:** ≤ 350 draw calls, ≤ 1.5 M triangles, frame ≤ 8 ms at 1080p (`docs/ENGINE_API.md` L523-525;
  `chapter-check.mjs` L185); post ≈ 30 calls; the lamp's cube shadow ×6 per caster; the **number of lights must stay
  constant** (intensity 0, never add/remove — every change recompiles all shaders).
- **G24. Text3D:** ≥ 16 px-eq at 1280 × 720 or chapter-check fails; fonts load in the mount (not in Node tests); set `.text`
  only on change (relayout cost); phone hides prints < 14 px and the HUD names them.
- **G25. `materials.ts` patches shader text and throws** if K.toon/three anchors change — a three upgrade breaks the copy.
- **G26. Colours:** hex forbidden (ENGINE_API §19); palette has no gold/silver → derive (`col('amber').lerp(col
  ('wireBrown'), k)` as the kit does) and record in VISUAL; platform tokens cannot be added.
- **G27. Words:** no Ukrainian in code (comments in English); scene words come from content captions addressed by index
  (`caption(step, i)` throws on a missing index; a manifest test pins each index); sandbox words in the `SANDBOX` const of
  its `index.ts` (radio precedent — E1-9's brief says «з її документа»: align).
- **G28. Characters:** μ U+03BC, ’ U+2019 everywhere; E1-8's `check.py` scans `app/src/volumes/electronics/` (radio's
  rule 4 does not scan `_dev/`; ask E1-8 or E2-1 to include `_sandbox-electronics-*`).
- **G29. `?freeze`:** up to 180 synchronous `update(1/60)` then held frames with `dt = 0`; no worker reply can arrive →
  force `sync`, compute `still` once per change on a held frame; detect with `new URLSearchParams(globalThis.location?.
  search ?? '').has('freeze')` (no flag on `ctx`).
- **G30. `MAX_FRAME_DT = 1/15`** and `dt = 0` frames (held, first after a hidden tab): heat/burn integration and glides
  must tolerate both.
- **G31. QA URLs always carry `noaudio`, `debug`, `overlay=0`, `q=high`** (`tools/qa/lib.mjs` L100-108): the sound check
  builds its own URL; tools need `--out <dir>` on this machine.
- **G32. Hidden tab:** the engine stops updating, an `AudioContext` keeps running → suspend on `visibilitychange`
  (platform does, `audio/plugin.ts` L52-53) and do not count underruns while hidden. AudioWorklet is secure-context only
  (the app runs over plain HTTP on a LAN) → schedule `AudioBufferSourceNode`s on `currentTime`.
- **G33. Workers:** no `WebWorker` lib → `/// <reference lib="webworker" />` + `declare const self:
  DedicatedWorkerGlobalScope`; never import the worker entry in vitest (`self` undefined); the literal `new Worker(new
  URL('./x.worker.ts', import.meta.url), { type: 'module' })`; CPU throttling never reaches a worker (time the sync path
  for the phone gate); worker time is invisible to chapter-check's 8 ms gate, a sync fallback is not.
- **G34. Name clash:** `@electronics/sim/core` exports `type Link` and `Element`; the copied radio link must be renamed
  (`ModelLink`).
- **G35. No module-level state** (two chapter copies coexist at a border; chapter-check enters/leaves 3×): `ModelState`,
  `BoardState`, counters, worker, `AudioContext` belong to the mount and are released in `ctx.onDispose`.
  `ctx.store.subscribe` is global → unsubscribe in `onDispose`.
- **G36. Board frame vs world:** everything on the board lives in the tilted `frame`; use `frame.worldToLocal` /
  `localToWorld` (circuit has three closed-form copies of the tilt: `shots.ts` L14, `tools/index.ts` L31-39, gauge's
  private `toBoard` L71-77; `hands.ts` mixes a quaternion with the closed form L92-95). Instruments on the table are in
  world, level.
- **G37. Circuit VISUAL rules that clash:** «без перфорації, сітки, гвинтів, шкал приладів і світлячків» (`docs/volumes/
  circuit/VISUAL.md` L41) and «bloom тільки від нитки» (L71) — electronics VISUAL must override them explicitly for the
  breadboard and LEDs. Main shot: VISUAL says 35–45° to the board, the code comment says 52° (`S/shots.ts` L55) — the
  measured code is the reference.
- **G38. Twins built once:** `B/magnifier.ts` L229 and `B/thermal-warm.ts` L140 build their twin lists once → parts
  added later are ignored; rebuild on topology change if copied. Render-order ladder when copied together: iris 950,
  twins 951+, swap copies 960+, thermal twins 4996, depth shell 5000; lens rim on the overlay layer (50).
- **G39. Stencil lens window** (`C/shared/world/window.ts`) clips only materials present when `clip()` is called —
  re-call after adding meshes; never open during a dissolve.
- **G40. Camera keeps world up** (`Shot` has no `up`): inner worlds mounted tilted roll on sideways orbit — narrow
  azimuth (copper shots ±0.03) when tilted; every shot needs `fit` for phone reframing.
- **G41. Docs referenced but absent** (`docs/HUD_DOM.md`, `PATH_FORMAT.md`, `MOBILE.md`, `AGENT_GUIDE.md`,
  `VOLUME_STRUCTURE.md`) — the code is the authority. UI_API's «`gl` default» is stale (DOM is the default).
- **G42. Site profile** deletes every other volume incl. `_dev` and runs `tsc` on the copy → any import outside
  `electronics/` + platform breaks the site; the sandbox never ships; the bench's worker will be the first on a Pages
  sub-path.
- **G43. Environment:** prelude (nvm 24, corepack) in every shell; `pnpm` only from `app/`; never `pnpm format`; never
  `pnpm` in a site-profile work copy; long waits in the background (`sleep` is blocked); commits in Ukrainian
  sentences with **no AI notes**, explicit paths, check `git log -1 --format=%B`; CI tests run with `--testTimeout=30000`,
  local 5 s → long transient tests need `{ timeout }`.
- **G44. `electricity` volume** has the closest prior art (grid + tray + multimeter + scope) but the REUSE rule names
  only circuit and radio; LIBRARY §4 gives «транзистор» to `computing` (boundary note for E6).

## Open questions

Each with the default this synthesis proposes (the owner said «без питань»: E2 proceeds on the default and records it).

1. **Gestures** — whole-part carry + single-leg re-seat (default) or leg-by-leg only (the original brief)? Default:
   both, whole-part first (touch, TO-92); a click on a placed part flips it end for end.
2. **Board geometry** — 17 columns, one rail each side, P = 0.3 u, base 8.4 × 5.6, tilt 15° (default) — or two rail
   pairs like a real board, or a level board? VISUAL.md (E2-1) decides and tests assert.
3. **A leg in the air** — leave the part out of the netlist (`pending`, default) or give the loose leg a private node so
   `analyse()` reports `floating`?
4. **Fixed items** — speaker/player/lamp off the board with plug leads (default), or as tray parts placed in sockets?
5. **Key light** — circuit's rig with the bench lamp as the key when lit and a raised moon/ambient otherwise (default)
   vs a permanent warm desk lamp.
6. **LED light and bloom** — pool of 3 shadowless PointLights + emissive/halo; bloom allowed from LEDs (default,
   overriding circuit VISUAL)?
7. **Meter** — digital, number only in the HUD readout, LCD print optional (default); modes V/A/Ω in E2 (default) or V
   only first? Display: DMM sample-and-hold 0.33 s (default) vs `followVoltage` inertia?
8. **Meter as ammeter across the battery** — honest short (default) or a modelled fuse?
9. **Probe and channel colours** — probes red/black like a real meter vs `SEMANTIC.dcPlus`/`dcMinus`; grips cyan
   (affordance) by default; scope ch1/ch2 tokens (VISUAL table).
10. **Tray** — unlimited supply per value (default) vs a fixed set; dropping off the board returns the part to the tray
    (default) vs lying on the stand like `build`'s loose ends.
11. **Burnt part** — stays (same id) until removed; a replacement is a new id (default); scripted repairs use `swap`.
    Is a single small wisp at the moment of burning allowed (model event, never a loop)? Default: yes, once.
12. **Heat lens** (`bulb-thermal` / `thermal-warm`) in E2? Default: no; heat shows on the part (emissive only when
    really hot).
13. **Dive scope in E2** — mechanics stand → part → inside with a placeholder cutaway (default); atoms worlds (copper
    kit, stencil window) in E3+.
14. **Worker ownership** — one link, E1-9's `shared/sound`, carrying speaker current and scope taps (default) vs a
    second link for the scope.
15. **Copy from `electricity`** (pn-block, si-sheet, circuit-grid, multimeter) — REFERENCE only (default) or allowed
    with REUSE rows?
16. **Held-page scope window** — warm-up `max(0.2 s, 5 τmax)`, capture one span after the first trigger (default)?
17. **Live vs loop** — E1-7's speed verdict decides; if «loop», the scope shows the precomputed loop (same samples).
18. **Sandbox words** — `SANDBOX` const in `index.ts` (radio precedent, default) vs a sandbox document (E1-9 text).
19. **Phone framing** — a dedicated closer `board` shot on phones (default) vs the stand shot with bigger grips only.
20. **Pot** — on the board with a HUD slider driving `setting` and the 3D knob following (default) vs dragging the knob.
21. **Jumper wires** — tray items with two ends and long reach (default).
22. **Border frame** for `seamless` chapter borders (board empty? battery off? player stopped?) — E3 decides; E2 keeps
    `bench.clear()` and `preset()` ready.
23. **Names** — keep the copied stage names (`STAGE_FOV`, `STAGE_POST`, `boardToWorld`) with `mountBench`/`Bench`
    (default) vs renaming everything `BENCH_*`.
