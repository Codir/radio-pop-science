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
 * load (E1-4's `advanceHeat`), and a part that burns is a gap from the same frame on — the driver solves again at once
 * and tells its id once. `part(id)` is what the bench shows of a part: its condition, load, heat and a lamp's filament.
 */
import {
  PARTS,
  advanceHeat,
  compile,
  createModelState,
  memoryOf,
  solveDC,
  type Circuit,
  type Condition,
  type DcFailure,
  type DcSolution,
  type ModelState,
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
}

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
/** The kinds the ohmmeter takes out of the circuit: what gives power (the player joins the catalog in E1-7). */
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
      const burnt = memory?.burnt === true;
      const base = {
        condition: burnt ? ('burnt' as const) : (status?.condition ?? 'ok'),
        load: burnt ? 0 : (status?.load ?? 0),
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
      // its own memory: the burnt parts are gaps here as on the bench, and nothing of the bench's is written
      const own = createModelState();
      for (const p of parts) if (state.parts.get(p.id)?.burnt) memoryOf(own, p.id).burnt = true;
      const dc = solveDC({ nodes: size + 1, parts }, { state: own });
      let value: number | null = null;
      if (dc.ok) {
        const i = dc.parts[OHM_SERIES]!.i;
        value = i > NO_CURRENT ? Math.abs(dc.v[a]! - dc.v[b]!) / i : Infinity;
      }
      ohmsMemo = { key, value };
      return value;
    },
  };
  return model;
}
