/**
 * The transient: the circuit in time, with a fixed step `dt`. A capacitor and a lamp's filament carry a state from one
 * moment to the next; at every step they stamp the companion of the step from it (`capacitor.ts`, `lamp.ts`), and the
 * matrix gives the next moment — one solve for a linear circuit, Newton's iterations of the operating point (`dc.ts`)
 * for a nonlinear one, from the solution of the last step. The steps integrate by the trapezoid; the first EULER_STEPS
 * steps after the start and after any change on the board (a knob turned, a switch flipped, a part put in or burnt)
 * by backward Euler, which leaves no ringing of the trapezoid after a jump. A step whose iterations do not settle is
 * taken again in 2, 4, … 64 steps of backward Euler; only then does it fail.
 *
 * At every step the heat of the parts gathers in time as `advanceHeat` gathers it at the operating point
 * (`limits.ts`), and a part that reaches its limit fails there and then: it burns, or an electrolytic capacitor bulges.
 * Everything a part keeps between moments — heat, damage, a capacitor's charge, a filament's temperature — is written
 * to the state (`state.ts`) after every step, so a stand that changes its board carries it over.
 *
 * Nothing in a step allocates: the matrix, the readings and the scratch are made once per circuit, and `run` fills the
 * stand's own arrays. Usage: README.md, «The transient».
 */
import { ROOM_KELVIN } from './diode';
import {
  damageIn,
  failureIn,
  MAX_ITERATIONS,
  newGo,
  newton,
  readPart,
  solveDC,
  type DcFailure,
  type PartReading,
} from './dc';
import {
  canBurn,
  conditionOf,
  fail,
  failureOf,
  HEAT_SECONDS,
  limited,
  loadOf,
  type PartStatus,
} from './limits';
import {
  assemble,
  BULGED,
  BURNT,
  compile,
  factor,
  readSettings,
  solveFactored,
  updateSettings,
  type Circuit,
} from './mna';
import type { Netlist } from './netlist';
import type { PartKind } from './parts';
import { createModelState, keepLevel, levelOf, memoryOf, type ModelState, type PartMemory } from './state';
import { analyse, type TopologyIssue } from './topology';

/** How many steps after the start and after a change go by backward Euler before the trapezoid takes over. */
export const EULER_STEPS = 2;
/** A step that fails is taken again in 2, 4, … 2^RETRIES steps of backward Euler. */
const RETRIES = 6;

/** Where the transient starts: at the operating point (every capacitor charged, every filament steady); from zero (every
 * capacitor empty, every filament at room temperature, as when a board is first switched on); or from the charges and
 * temperatures the state holds (empty and cold for a part it does not know). */
export type TransientStart = 'dc' | 'zero' | 'state';

export interface TransientOptions {
  /** The step (s): a finite number above 0, fixed for the life of the transient. */
  dt: number;
  /** The memory of the stand; a new one when absent. */
  state?: ModelState;
  /** Newton's iterations at most in one step (MAX_ITERATIONS when absent). */
  maxIterations?: number;
}

/** A waveform to record while `run` steps: the voltage of a node, or the current into the first pin of a part. Its
 * sample k is written into `out[k]`. */
export type Probe =
  | { readonly node: number; readonly out: Float32Array }
  | { readonly part: string; readonly out: Float32Array };

/** Everything the transient holds for one circuit; a new board makes a new one. */
interface Board {
  readonly circuit: Circuit;
  readonly settings: Float64Array;
  readonly damage: Uint8Array;
  /** The state's memory of every part, fetched at the build and again at every start. */
  readonly memories: PartMemory[];
  readonly ids: ReadonlyMap<string, number>;
  /** e^(−dt/τ) of the heat of every part, NaN for a part without limits. */
  readonly decay: Float64Array;
  readonly burnable: Uint8Array;
  readonly readings: readonly PartReading[];
  readonly statuses: readonly PartStatus[];
  readonly parts: Record<string, PartReading>;
  readonly status: Record<string, PartStatus>;
  readonly v: Float64Array;
  readonly scratch: Float64Array;
  /** The start of the step, for a step taken again. */
  readonly saved: { readonly v: Float64Array; readonly memory: Float64Array; readonly history: Float64Array };
  ties: readonly number[];
  issues: TopologyIssue[];
  nonlinear: boolean;
}

/** The level of a part with a state in time that starts from nothing: an empty capacitor, a filament at the room. */
const emptyLevel = (kind: PartKind): number => (kind === 'lamp' ? ROOM_KELVIN : 0);

export class Transient {
  /** The step (s). */
  readonly dt: number;
  /** The memory of the stand: heat, damage, charges, temperatures, node voltages; written after every step. */
  readonly state: ModelState;
  readonly maxIterations: number;
  /** Whether the last step (or the start) succeeded. */
  ok = true;
  /** Why the last step failed: 'singular' (no single solution) or 'no-convergence' (not even in 64 steps). */
  reason: DcFailure | undefined = undefined;

  private board: Board;
  private readonly go = newGo();
  private count = 0;
  private euler = EULER_STEPS;
  private started = false;
  private failure: DcFailure = 'singular';

  /** Compiles the board (a malformed netlist is a RangeError, as for `solveDC`); `start` begins its time. */
  constructor(net: Netlist, options: TransientOptions) {
    if (!(options.dt > 0 && Number.isFinite(options.dt)))
      throw new RangeError(`the step must be a finite number of seconds above 0: ${options.dt}`);
    this.dt = options.dt;
    this.state = options.state ?? createModelState();
    this.maxIterations = options.maxIterations ?? MAX_ITERATIONS;
    this.board = this.build(net);
  }

  /** The moment of the last step (s): 0 at the start. */
  get time(): number {
    return this.count * this.dt;
  }

  /** The voltage of every node of the board at the last step (V), by node number. */
  get v(): Float64Array {
    return this.board.v;
  }

  /** The reading of every part at the last step, by id: the same objects, updated in place at every step. */
  get parts(): Record<string, PartReading> {
    return this.board.parts;
  }

  /** What the stand shows of every part at the last step, by id: updated in place at every step. */
  get status(): Record<string, PartStatus> {
    return this.board.status;
  }

  /** What is wrong with the shape of the board now (`topology.ts`). */
  get issues(): TopologyIssue[] {
    return this.board.issues;
  }

  /** The compiled circuit. */
  get circuit(): Circuit {
    return this.board.circuit;
  }

  /** What the model remembers of the part `id` (every part on the board has an entry): its heat, whether it burnt or
   * bulged, its charge or temperature. */
  memory(id: string): PartMemory | undefined {
    return this.state.parts.get(id);
  }

  /** Begins the time of the board at 0 from `from`; false (with `reason`) when its operating point has no solution. */
  start(from: TransientStart): boolean {
    const b = this.board;
    const c = b.circuit;
    const op = c.operating;
    this.count = 0;
    this.euler = EULER_STEPS;
    this.started = true;
    updateSettings(c, b.settings);
    // a stand that put a new part in place of a burnt one has deleted its entry: fetch every memory afresh
    c.elements.forEach((e, k) => (b.memories[k] = memoryOf(this.state, e.part.id)));
    damageIn(c, this.state, b.damage);
    this.retopologize();
    op.sources = 1;
    if (from === 'dc') {
      // the operating point writes every part's steady level into its history and the state
      const dc = solveDC(c, { state: this.state, maxIterations: this.maxIterations, time: 0 });
      this.ok = dc.ok;
      this.reason = dc.reason;
      if (!dc.ok) return false;
      c.elements.forEach((e, k) => {
        Object.assign(b.readings[k]!, dc.parts[e.part.id]);
        Object.assign(b.statuses[k]!, dc.status[e.part.id]);
      });
      b.v.set(dc.v);
      op.initial = false;
      return true;
    }
    op.v.fill(0);
    if (from === 'state' && this.state.v.length === c.net.nodes) op.v.set(this.state.v);
    c.elements.forEach((e, k) => {
      e.behaviour.start?.(e);
      Object.assign(b.readings[k]!, { u: 0, i: 0, p: 0 });
      Object.assign(b.statuses[k]!, { condition: conditionOf(0, failureIn(b.damage[k]!)), load: 0 });
      if (e.behaviour.history === 0) return;
      const memory = b.memories[k]!;
      const empty = emptyLevel(e.spec.kind);
      e.history[0] = from === 'zero' ? empty : levelOf(memory, e.spec.kind, empty);
      e.history[1] = 0;
      if (!b.damage[k]) keepLevel(memory, e.spec.kind, e.history[0]!);
    });
    for (let node = 0; node < b.v.length; node++) b.v[node] = op.v[node]!;
    op.initial = true;
    this.ok = true;
    this.reason = undefined;
    return true;
  }

  /**
   * One step of `dt`. False when the circuit has no solution at the next moment (`ok` false, `reason`): the board
   * then stays at its last moment, and the next step tries again. A setting that is not a finite number is a
   * RangeError.
   */
  step(): boolean {
    if (!this.started) throw new Error('the transient has not started: call start() first');
    const b = this.board;
    const c = b.circuit;
    if (updateSettings(c, b.settings)) {
      this.retopologize();
      this.euler = EULER_STEPS;
    }
    if (!this.advance()) {
      this.ok = false;
      this.reason = this.failure;
      return false;
    }
    this.ok = true;
    this.reason = undefined;
    this.count++;
    if (this.euler > 0) this.euler--;
    c.operating.initial = false;
    const nodes = b.v.length;
    if (this.state.v.length !== nodes) this.state.v = new Float64Array(nodes);
    for (let node = 0; node < nodes; node++) {
      b.v[node] = c.operating.v[node]!;
      this.state.v[node] = b.v[node]!;
    }
    if (this.gatherHeat()) {
      this.retopologize();
      this.euler = EULER_STEPS;
    }
    return true;
  }

  /**
   * `steps` steps, recording every probe after each step: sample k into `out[k]`. Returns how many steps succeeded
   * (fewer than asked when one failed). A probe of a node the board has not, of a part it has not, or with an array
   * shorter than `steps` is a RangeError before any step.
   */
  run(steps: number, probes: readonly Probe[] = []): number {
    if (!Number.isInteger(steps) || steps < 0)
      throw new RangeError(`steps must be a whole number ≥ 0: ${steps}`);
    const b = this.board;
    // a node n as n, a part k as −(k + 1)
    const targets = new Int32Array(probes.length);
    probes.forEach((probe, j) => {
      if (probe.out.length < steps)
        throw new RangeError(`a probe's array holds ${probe.out.length} samples, not ${steps}`);
      if ('node' in probe) {
        if (!Number.isInteger(probe.node) || probe.node < 0 || probe.node >= b.v.length)
          throw new RangeError(`no node ${probe.node} among 0 … ${b.v.length - 1}`);
        targets[j] = probe.node;
      } else {
        const k = b.ids.get(probe.part);
        if (k === undefined) throw new RangeError(`no part ${probe.part} on the board`);
        targets[j] = -(k + 1);
      }
    });
    for (let k = 0; k < steps; k++) {
      if (!this.step()) return k;
      for (let j = 0; j < targets.length; j++) {
        const target = targets[j]!;
        probes[j]!.out[k] = target >= 0 ? this.board.v[target]! : this.board.readings[-target - 1]!.i;
      }
    }
    return steps;
  }

  /** Sets the part's setting in the netlist (a knob, a switch, a sine's frequency): the next step takes it, by
   * backward Euler. An id the board has not, or a setting that is not a finite number, is a RangeError. */
  set(id: string, setting: number): void {
    const k = this.board.ids.get(id);
    if (k === undefined) throw new RangeError(`no part ${id} on the board`);
    if (!Number.isFinite(setting))
      throw new RangeError(`${id}: the setting must be a finite number: ${setting}`);
    this.board.circuit.elements[k]!.part.setting = setting;
  }

  /**
   * A new board (a part put in or taken out, a pin moved): compiles it and carries over, by node number and by part
   * id, the node voltages and every part's state — its charge or temperature, heat and damage from the state; the
   * guess of Newton's iterations from the last step. Time runs on; the next steps go by backward Euler. The readings
   * are those of the next step (zeros until then). A malformed netlist is a RangeError, and the old board stays.
   */
  rebuild(net: Netlist): void {
    const old = this.board;
    const was = new Map(old.circuit.elements.map((e) => [e.part.id, e]));
    const before = old.circuit.operating.v;
    const b = this.build(net);
    this.board = b;
    const c = b.circuit;
    const op = c.operating;
    for (let node = 0; node < c.net.nodes; node++) op.v[node] = node < old.v.length ? old.v[node]! : 0;
    c.elements.forEach((e, k) => {
      const last = was.get(e.part.id);
      if (last && last.spec === e.spec) {
        e.memory.set(last.memory);
        e.inner.forEach((node, j) => (op.v[node] = before[last.inner[j]!]!));
      } else {
        e.behaviour.start?.(e);
        for (const node of e.inner) op.v[node] = op.v[e.nodes[0]!]!;
      }
      if (e.behaviour.history > 0) {
        e.history[0] = levelOf(b.memories[k]!, e.spec.kind, emptyLevel(e.spec.kind));
        e.history[1] = 0;
      }
    });
    op.initial = false;
    this.euler = EULER_STEPS;
    this.ok = true;
    this.reason = undefined;
  }

  // ── inside ────────────────────────────────────────────────────────────────────────────────────────────────────────

  private build(net: Netlist): Board {
    const circuit = compile(net);
    const { elements } = circuit;
    const settings = readSettings(circuit);
    const damage = damageIn(circuit, this.state);
    const readings = elements.map(() => ({ u: 0, i: 0, p: 0 }));
    const statuses = elements.map((_, k) => ({ condition: conditionOf(0, failureIn(damage[k]!)), load: 0 }));
    const board: Board = {
      circuit,
      settings,
      damage,
      memories: elements.map((e) => memoryOf(this.state, e.part.id)),
      ids: new Map(elements.map((e, k) => [e.part.id, k])),
      decay: Float64Array.from(elements, (e) => {
        const tau = HEAT_SECONDS[e.spec.kind];
        return tau !== undefined && limited(e.spec) ? Math.exp(-this.dt / tau) : Number.NaN;
      }),
      burnable: Uint8Array.from(elements, (e) => (canBurn(e.spec) ? 1 : 0)),
      readings,
      statuses,
      parts: Object.fromEntries(elements.map((e, k) => [e.part.id, readings[k]!])),
      status: Object.fromEntries(elements.map((e, k) => [e.part.id, statuses[k]!])),
      v: new Float64Array(net.nodes),
      scratch: new Float64Array(Math.max(3, ...elements.map((e) => e.nodes.length))),
      saved: {
        v: new Float64Array(circuit.size),
        memory: new Float64Array(circuit.memory.length),
        history: new Float64Array(circuit.history.length),
      },
      ties: [],
      issues: [],
      nonlinear: false,
    };
    this.board = board;
    this.retopologize();
    return board;
  }

  /** The issues, the ties and whether Newton's iterations are needed, at the settings and damage now. */
  private retopologize(): void {
    const b = this.board;
    const { issues, ties } = analyse(b.circuit, b.settings, b.damage);
    b.issues = issues;
    b.ties = ties;
    b.nonlinear = b.circuit.elements.some((e, k) => e.behaviour.nonlinear && b.damage[k] !== BURNT);
  }

  /** The next moment, the whole step at once or, when that fails, in shorter steps of backward Euler. */
  private advance(): boolean {
    const b = this.board;
    const c = b.circuit;
    const initial = c.operating.initial;
    b.saved.v.set(c.operating.v);
    b.saved.memory.set(c.memory);
    b.saved.history.set(c.history);
    if (this.solveAt((this.count + 1) * this.dt, this.dt, this.euler === 0, true)) return true;
    for (let pieces = 2; pieces <= 2 ** RETRIES && this.failure !== 'singular'; pieces *= 2) {
      this.restore(initial);
      let ok = true;
      for (let j = 1; j <= pieces && ok; j++)
        ok = this.solveAt((this.count + j / pieces) * this.dt, this.dt / pieces, false, j === pieces);
      if (ok) return true;
    }
    this.restore(initial);
    return false;
  }

  /** Back to the start of the step, as `advance` saved it. */
  private restore(initial: boolean): void {
    const b = this.board;
    const c = b.circuit;
    c.operating.v.set(b.saved.v);
    c.memory.set(b.saved.memory);
    c.history.set(b.saved.history);
    c.operating.initial = initial;
  }

  /** Solves the moment `time` a step `h` after the history, reads the parts when `read` (before their history moves
   * on: a lamp reads its current from it) and moves their history on. */
  private solveAt(time: number, h: number, trapezoid: boolean, read: boolean): boolean {
    const b = this.board;
    const c = b.circuit;
    const { system, elements } = c;
    const op = c.operating;
    op.time = time;
    op.dt = h;
    op.trapezoid = trapezoid;
    op.sources = 1;
    if (b.nonlinear) {
      const go = newton(c, b.settings, b.ties, b.damage, this.maxIterations, this.go);
      if (!go.settled) {
        this.failure = go.singular ? 'singular' : 'no-convergence';
        return false;
      }
    } else {
      assemble(c, b.settings, b.ties, op, b.damage);
      if (!factor(system)) {
        this.failure = 'singular';
        return false;
      }
      solveFactored(system);
      for (let node = 0; node < c.size; node++) {
        const k = c.index[node]!;
        const x = k >= 0 ? system.x[k]! : 0;
        if (!Number.isFinite(x)) {
          this.failure = 'singular';
          return false;
        }
        op.v[node] = x;
      }
    }
    if (read)
      for (let k = 0; k < elements.length; k++)
        readPart(c, k, b.settings[k]!, b.damage[k]!, b.scratch, b.readings[k]!);
    for (let k = 0; k < elements.length; k++) {
      const e = elements[k]!;
      if (b.damage[k] === 0 && e.behaviour.accept) e.behaviour.accept(b.settings[k]!, e, op.v, op);
    }
    return true;
  }

  /** The heat of every part moves toward its load over the step, and a part at its limit fails; every part's level
   * goes to the state. Whether a part failed now. */
  private gatherHeat(): boolean {
    const b = this.board;
    const { elements } = b.circuit;
    let failed = false;
    for (let k = 0; k < elements.length; k++) {
      const e = elements[k]!;
      const status = b.statuses[k]!;
      if (b.damage[k]) continue;
      const memory = b.memories[k]!;
      const load = loadOf(e.spec, b.readings[k]!);
      status.load = load;
      status.condition = conditionOf(load, false);
      if (e.behaviour.history > 0) keepLevel(memory, e.spec.kind, e.history[0]!);
      const decay = b.decay[k]!;
      if (Number.isNaN(decay)) continue;
      memory.heat = load + (memory.heat - load) * decay;
      if (memory.heat >= 1 && b.burnable[k]) {
        const failure = failureOf(e.spec);
        fail(memory, failure);
        if (e.spec.kind === 'lamp') memory.kelvin = ROOM_KELVIN; // a broken filament is dark
        b.damage[k] = failure === 'bulged' ? BULGED : BURNT;
        status.condition = failure;
        status.load = 0;
        failed = true;
      }
    }
    return failed;
  }
}
