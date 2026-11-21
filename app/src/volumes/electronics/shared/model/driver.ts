/**
 * The bench's link to the circuit model (docs/volumes/electronics/VISUAL.md §1, principle 3; synthesis §1.6, G7): the
 * only file of the bench that calls `sim/core`. Everything the bench shows of the circuit — a meter's number, the
 * light, the heat and the burn, the sound later — is read from here.
 *
 * At every `sync` the driver reads the netlist of what is on the board (`sim/board` `netlistOf`, with the parts the
 * bench adds off the board: the meter in the A mode). A new shape of the circuit (its `key`) compiles a new circuit —
 * the matrix is allocated once per shape; a changed setting (a pot's knob, the battery's switch) is written into the
 * compiled parts, which the model reads live, and the same circuit is solved again. Nothing changed: no solve.
 *
 * One `ModelState` per bench, for its whole life: what the model remembers of every part (its heat, whether it burnt,
 * a lamp's filament) lives there by part id, through every new circuit. A part that left the bench for good — into the
 * tray, never just into the hand — has its entry deleted at the next sync (sim/core/README.md, «The state»). The hand
 * never gives an id twice (`sim/board` `nextId`), but a step's preset puts its own list under fixed ids (`R1`, `J1`)
 * in the same call that takes the old parts off, so the board alone cannot tell a new part from an old one under the
 * same id: whoever puts a new part under an id that was given calls `forget(id)`, and the new part is whole.
 *
 * A solve that fails (`ok: false`) is never shown: the driver keeps the last good solution, says it failed, and gives
 * no reading of the circuit now on the board until one succeeds — never a NaN, never the zeros of the failure.
 *
 * The model's time passes frame by frame (`advance`, the frame's dt, after the sync): every part's heat moves toward its
 * load (E1-4's `advanceHeat`), and a part that burns — or an electrolytic that bulges (E1-5) — is changed in the
 * circuit from the same frame on: the driver solves again at once and tells its id once. `part(id)` is what the bench
 * shows of a part: its condition (a burnt part stays `burnt` and a bulged can `bulged` wherever it is moved, until it
 * leaves the bench), load, heat and a lamp's filament.
 *
 * A held page (`?freeze`) shows the oscilloscope's window from `still` (plan decision 16): the circuit on the board in
 * time, computed at once from its operating point — warmed up for max(0.2 s, 5 τmax), τmax the longest time constant of
 * its capacitors (`tauMax`), then the samples asked for. The model in time on a live page is the stream's (`live.ts`).
 */
import {
  PARTS,
  Transient,
  advanceHeat,
  compile,
  createModelState,
  memoryOf,
  resistorKey,
  solveDC,
  type Circuit,
  type Condition,
  type DcFailure,
  type DcSolution,
  type ModelState,
  type Netlist,
  type PartInstance,
  type PartReading,
} from '@electronics/sim/core';
import {
  BENCH_FIXED,
  netlistOf,
  type BoardLayout,
  type BoardNet,
  type BoardState,
  type FixedPart,
  type RowId,
} from '@electronics/sim/board';

export interface BenchModelSource {
  readonly layout: BoardLayout;
  /** The board's state: the driver reads it at every sync and never writes it. */
  readonly board: BoardState;
  /** The fixed parts of the bench (default `BENCH_FIXED`: the battery, its switch, the speaker, the lamp). */
  readonly fixed?: readonly FixedPart[];
  /** Parts off the board with their nodes given, read at every sync: the meter in the A mode, a wire between its
   * probes. Their ids differ from the board's and the fixed parts'. */
  readonly extra?: () => readonly PartInstance[];
  /** The clock of `dcMs`, in milliseconds (default `performance.now`): a test gives its own. */
  readonly now?: () => number;
}

/** What the bench shows of a part (`part`). */
export interface PartState {
  readonly condition: Condition;
  /** The share of its limit it is under now (0 out of the circuit). */
  readonly load: number;
  /** How warm it is, a share of its limit (`PartMemory.heat`). */
  readonly heat: number;
  /** A lamp: its filament's temperature (K), written by every good solve. */
  readonly kelvin?: number;
}

export interface BenchModel {
  /** What the model remembers between solves: one for the bench's life. */
  readonly state: ModelState;
  /** The board's netlist at the last sync (null before the first): its key, the parts left out with a leg in the air. */
  readonly net: BoardNet | null;
  /** The circuit compiled for that netlist's shape. */
  readonly circuit: Circuit | null;
  /** The last solve that succeeded (null before one did). After a failure it is an older circuit's: see `ok`. */
  readonly solution: DcSolution | null;
  /** The last solve succeeded: `solution` is the circuit now on the board. */
  readonly ok: boolean;
  /** Why the last solve failed; null when it succeeded. */
  readonly failure: DcFailure | null;
  /** Bumps on every solve. */
  readonly version: number;
  /** How many circuits were compiled. */
  readonly compiles: number;
  /** How long the last solve took (ms). */
  readonly dcMs: number;
  /** Follow the board now: compile a new shape, solve again when the shape or a setting changed, or a part was
   * forgotten. */
  sync(): void;
  /**
   * Delete what the model remembers of a part (its heat, whether it burnt; sim/core/README.md, «The state») at once:
   * a new part is going to stand under this id (a step's preset, `bench.preset` and `bench.clear`). The next sync
   * solves again, though the circuit's shape is the same. A part the model remembers nothing of changes nothing.
   */
  forget(id: string): void;
  /**
   * Let `seconds` of the model's time pass at the operating point of the circuit now on the board (the frame's time):
   * the heat of every part moves toward its load (`sim/core` `advanceHeat`), and a part whose heat reaches its limit
   * burns — the circuit is solved again at once, with it a gap. Returns the ids of the parts that burnt now (an event,
   * told once). After a failed solve no time passes: the heat holds (G7, nothing new is shown). A frame with no time
   * (dt 0, a held frame) or a time that is not one changes nothing.
   */
  advance(seconds: number): readonly string[];
  /**
   * The state of a part as the bench shows it (VISUAL §4.8): in the circuit, its condition and load from the last
   * solve; out of it (in the hand, a leg in the air), `ok` and no load — or `burnt`, which it stays until it leaves the
   * bench; its heat and a lamp's filament temperature from the model's memory. A part the model never saw is ok and
   * cold. Null before the first solve and while the last one failed.
   */
  part(id: string): PartState | null;
  /** What a meter would read on a part of the circuit now on the board; null when it is not in it, or the last solve
   * failed. */
  reading(id: string): PartReading | null;
  /** The voltage of a node (V); null when the node is not the board's, or the last solve failed. */
  nodeVolts(node: number): number | null;
  /** The voltage of a row (V): its node's. */
  rowVolts(row: RowId): number | null;
  /**
   * The resistance between two nodes as an ohmmeter measures it (Ω): the circuit now on the board with its sources
   * out (the batteries, a player), a small test current from the meter's own source (`OHMMETER`) through the nodes,
   * the voltage it makes over the current. A burnt part is a gap here too. Infinity when no current flows (no path);
   * null when the board has no circuit yet or the meter's own solve fails. Its own state: the bench's is untouched.
   */
  ohms(a: number, b: number): number | null;
  /**
   * The longest time constant of the circuit now on the board (s): of every capacitor, its capacitance times the
   * resistance the circuit at its operating point shows between its pins (a small test current through them: the
   * capacitor's own leak and series resistance included, every other capacitor open). 0 with no capacitor or no
   * solve.
   */
  tauMax(): number;
  /**
   * A held page's oscilloscope (plan decision 16): the circuit now on the board in time at `fs` samples a second, from
   * its operating point, warmed up for `STILL.warmup(tauMax())`, then `count` samples of each tap (a node's voltage or
   * the current into a part's first pin, as the stream's probes). The bench's damage goes in — a burnt part is a gap,
   * a bulged can its leak — nothing fails in the window on its own heat (the bench's model tells what burns, as it
   * tells the live page's stream), and nothing of the bench's is written. The same board, the same samples. Null
   * while the board has no good solve, or when a moment of it has none.
   */
  still(window: StillWindow): Still | null;
}

/** What `still` computes: the rate, how many samples after the warm-up, what to record. */
export interface StillWindow {
  readonly fs: number;
  readonly count: number;
  readonly taps: readonly StillTap[];
  /** Steps of integration a sample (1 when absent; the stream's). */
  readonly substeps?: number;
}

/** A node's voltage, or the current into the first pin of a part (`sim/core` `Probe` without its array). */
export type StillTap = { readonly node: number } | { readonly part: string };

export interface Still {
  /** The model's time before the first sample (s). */
  readonly warmup: number;
  /** The longest time constant it was warmed up by (s). */
  readonly tau: number;
  /** A channel a tap. */
  readonly samples: Float32Array[];
}

/**
 * The warm-up of a held page's window (plan decision 16: max(0.2 s, 5 τmax)), rounded up to a whole beat of the
 * volume's melody (0.5 s at 120 beats a minute: two boards of one step that differ in a part show the same stretch of
 * the music) and held to `max` — an RC behind an open switch has τ of minutes (its capacitor's own leak), and a
 * circuit of direct currents is at rest from its operating point on anyway.
 */
export const STILL = {
  least: 0.2,
  taus: 5,
  beat: 0.5,
  max: 2,
  warmup(tau: number): number {
    const want = Math.max(STILL.least, STILL.taus * (Number.isFinite(tau) ? tau : Infinity));
    return Math.min(STILL.max, Math.ceil(want / STILL.beat - 1e-9) * STILL.beat);
  },
} as const;

/**
 * The ohmmeter's source (the plan's decision, made in task E2-6): 5 V behind 10 kΩ — at most 0.5 mA, a small test
 * current like a pocket meter's, so a lamp reads its cold filament (5.5 Ω; sim/core/README.md, «The lamp») and the
 * model's own solve warms nothing. The ideal source is the catalog's reference, never a part on the bench; inside the
 * meter's own solve it stands for the meter's battery.
 */
export const OHMMETER = { source: 'ideal-5v', series: 'resistor-10k' } as const;
/** The ids of the ohmmeter's two parts in its own solve. */
const OHM_SOURCE = 'OHM-V';
const OHM_SERIES = 'OHM-R';
/** A current smaller than this (A) is the rounding of none: no path between the probes. */
const NO_CURRENT = 1e-15;
/**
 * The test current of `tauMax`: 5 V behind 10 MΩ, at most 0.5 μA — small against a transistor's bias, so the
 * resistance it sees is the circuit's at its operating point.
 */
const TAU_TEST = { source: 'ideal-5v', series: resistorKey(10e6), source_id: 'TAU-V', series_id: 'TAU-R' } as const;
/** The kinds the ohmmeter takes out of the circuit: what gives power (the batteries, the references, the player). */
const SOURCES: ReadonlySet<string> = new Set(['battery', 'source', 'player']);

const clock = (): number => globalThis.performance?.now() ?? 0;
/** Nothing burnt this frame. */
const NONE: readonly string[] = Object.freeze([]);

export function createBenchModel(src: BenchModelSource): BenchModel {
  const { layout, board } = src;
  const fixed = src.fixed ?? BENCH_FIXED;
  const extra = src.extra ?? (() => []);
  const now = src.now ?? clock;
  const state = createModelState();
  const fixedIds = new Set(fixed.map((f) => f.id));

  let net: BoardNet | null = null;
  let circuit: Circuit | null = null;
  /** The compiled parts by id: a setting is written there (the compiled circuit reads its parts' settings live). */
  let compiled = new Map<string, PartInstance>();
  let solution: DcSolution | null = null;
  let ok = false;
  let failure: DcFailure | null = null;
  let version = 0;
  let compiles = 0;
  let dcMs = 0;
  /** A part's memory was deleted on demand since the last solve: the next sync solves again. */
  let forgotten = false;
  let ohmsMemo: { key: string; value: number | null } | null = null;

  /** Copy the settings of the new netlist into the compiled parts; true when one changed. */
  const settle = (parts: readonly PartInstance[]): boolean => {
    let changed = false;
    for (const p of parts) {
      const c = compiled.get(p.id);
      if (!c || c.setting === p.setting) continue;
      if (p.setting === undefined) delete c.setting;
      else c.setting = p.setting;
      changed = true;
    }
    return changed;
  };

  /** Delete the memory of every part that is no longer on the bench (sim/core/README.md, «The state»). */
  const forgetGone = (more: readonly PartInstance[]): void => {
    for (const id of [...state.parts.keys()]) {
      if (board.parts.has(id) || fixedIds.has(id) || more.some((p) => p.id === id)) continue;
      state.parts.delete(id);
    }
  };

  /** Solve the compiled circuit with the bench's state; a failure keeps the last good solution. */
  const solve = (c: Circuit): void => {
    const t0 = now();
    const dc = solveDC(c, { state });
    dcMs = now() - t0;
    version++;
    ok = dc.ok;
    failure = dc.ok ? null : (dc.reason ?? 'singular');
    if (dc.ok) solution = dc;
  };

  /** A state of its own with the bench's damage (a burnt part a gap, a bulged can its leak): what a solve of the
   * meter or a held page starts from, so that nothing of the bench's is written. */
  const damaged = (parts: readonly PartInstance[]): ModelState => {
    const own = createModelState();
    for (const p of parts) {
      const m = state.parts.get(p.id);
      if (!m) continue;
      if (m.burnt) memoryOf(own, p.id).burnt = true;
      if (m.bulged) memoryOf(own, p.id).bulged = true;
    }
    return own;
  };

  let tauMemo: { version: number; value: number } | null = null;
  /** The longest time constant of `net`'s capacitors at its operating point (`BenchModel.tauMax`). */
  const tauOf = (net: Netlist): number => {
    const caps = net.parts.filter((p) => PARTS[p.spec]?.kind === 'capacitor');
    if (caps.length === 0) return 0;
    const base = solveDC(net, { state: damaged(net.parts) });
    if (!base.ok) return 0;
    let tau = 0;
    for (const c of caps) {
      const spec = PARTS[c.spec]!;
      if (spec.kind !== 'capacitor') continue;
      const [a, b] = c.pins as [number, number];
      const inner = net.nodes;
      const parts: PartInstance[] = [
        ...net.parts,
        { id: TAU_TEST.source_id, spec: TAU_TEST.source, pins: [inner, b] },
        { id: TAU_TEST.series_id, spec: TAU_TEST.series, pins: [inner, a] },
      ];
      const dc = solveDC({ nodes: inner + 1, parts }, { state: damaged(net.parts) });
      if (!dc.ok) continue;
      const i = dc.parts[TAU_TEST.series_id]!.i;
      if (!(Math.abs(i) > NO_CURRENT)) continue;
      const dv = dc.v[a]! - dc.v[b]! - (base.v[a]! - base.v[b]!);
      tau = Math.max(tau, spec.farads * Math.abs(dv / i));
    }
    return tau;
  };

  const model: BenchModel = {
    state,
    get net() {
      return net;
    },
    get circuit() {
      return circuit;
    },
    get solution() {
      return solution;
    },
    get ok() {
      return ok;
    },
    get failure() {
      return failure;
    },
    get version() {
      return version;
    },
    get compiles() {
      return compiles;
    },
    get dcMs() {
      return dcMs;
    },
    sync() {
      const more = extra();
      const next = netlistOf(layout, board, fixed, more);
      forgetGone(more);
      let dirty: boolean;
      if (circuit === null || next.key !== net?.key) {
        // `netlistOf` never builds a malformed netlist, so `compile` never throws here
        circuit = compile(next.net);
        compiled = new Map(next.net.parts.map((p) => [p.id, p]));
        compiles++;
        dirty = true;
      } else dirty = settle(next.net.parts) || forgotten;
      net = next;
      if (!dirty) return;
      forgotten = false;
      solve(circuit);
    },
    forget(id) {
      if (state.parts.delete(id)) forgotten = true;
    },
    advance(seconds) {
      if (!ok || !solution || !circuit || !(seconds > 0) || !Number.isFinite(seconds)) return NONE;
      // the solution is the circuit's now on the board: a failed or a new one would have been solved at the sync
      const burnt = advanceHeat(state, circuit, solution, seconds);
      if (burnt.length > 0) solve(circuit);
      return burnt;
    },
    part(id) {
      if (!ok || !solution) return null;
      const memory = state.parts.get(id);
      const status = solution.status[id];
      // a burnt part and a bulged can stay so wherever they are moved, in the circuit or out of it
      const failed: Condition | null = memory?.burnt === true ? 'burnt' : memory?.bulged === true ? 'bulged' : null;
      const base = {
        condition: failed ?? status?.condition ?? 'ok',
        load: failed ? 0 : (status?.load ?? 0),
        heat: memory?.heat ?? 0,
      };
      return memory?.kelvin === undefined ? base : { ...base, kelvin: memory.kelvin };
    },
    reading(id) {
      return ok && solution ? (solution.parts[id] ?? null) : null;
    },
    nodeVolts(n) {
      if (!ok || !solution || !Number.isInteger(n) || n < 0 || n >= solution.v.length) return null;
      return solution.v[n]!;
    },
    rowVolts(row) {
      const n = layout.node(row);
      return n < 0 ? null : model.nodeVolts(n);
    },
    ohms(a, b) {
      if (!net || !Number.isInteger(a) || !Number.isInteger(b)) return null;
      const size = net.net.nodes;
      if (a < 0 || b < 0 || a >= size || b >= size) return null;
      const key = `${version}|${a}|${b}`;
      if (ohmsMemo?.key === key) return ohmsMemo.value;
      // the circuit with its sources out, and the meter's own source behind its series resistor across the probes
      const inner = size;
      const parts: PartInstance[] = net.net.parts
        .filter((p) => !SOURCES.has(PARTS[p.spec]!.kind))
        .map((p) => ({ ...p, pins: [...p.pins] }));
      parts.push(
        { id: OHM_SOURCE, spec: OHMMETER.source, pins: [inner, b] },
        { id: OHM_SERIES, spec: OHMMETER.series, pins: [inner, a] },
      );
      // its own memory: the burnt parts are gaps here as on the bench, a bulged can its leak, and nothing of the
      // bench's is written
      const dc = solveDC({ nodes: size + 1, parts }, { state: damaged(parts) });
      let value: number | null = null;
      if (dc.ok) {
        const i = dc.parts[OHM_SERIES]!.i;
        value = i > NO_CURRENT ? Math.abs(dc.v[a]! - dc.v[b]!) / i : Infinity;
      }
      ohmsMemo = { key, value };
      return value;
    },
    tauMax() {
      if (!ok || !net) return 0;
      if (tauMemo?.version !== version) tauMemo = { version, value: tauOf(net.net) };
      return tauMemo.value;
    },
    still({ fs, count, taps, substeps }) {
      if (!ok || !net || !(fs > 0) || !Number.isInteger(count) || count < 1) return null;
      const tau = model.tauMax();
      const warmup = STILL.warmup(tau);
      try {
        // the board as it is now, the bench's damage in a state of its own; nothing fails in the window on its own
        // heat — the bench's model tells what burns, as it tells the stream of a live page (`live.ts`)
        const board = structuredClone(net.net);
        const t = new Transient(board, { dt: 1 / fs, substeps, state: damaged(board.parts), fails: false });
        if (!t.start('dc')) return null;
        const warm = Math.round(warmup * fs);
        if (t.run(warm) < warm) return null;
        const samples = taps.map(() => new Float32Array(count));
        if (t.run(count, taps.map((tap, k) => ({ ...tap, out: samples[k]! }))) < count) return null;
        return { warmup, tau, samples };
      } catch {
        // a tap the board has not: nothing to show
        return null;
      }
    },
  };
  return model;
}
