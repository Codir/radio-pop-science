/**
 * The operating point: the voltages and currents of a circuit with every source steady. A linear circuit is one solve
 * of the matrix. A circuit with nonlinear parts (diodes, LEDs, a lamp) takes Newton's iterations: every part stamps
 * its linearization around the last solution, the matrix gives the next one, until nothing moves. A junction limits
 * the step of its voltage (`diode.ts`); when the iterations still do not settle, the sources are stepped up from zero,
 * each step starting from the solution of the last (source stepping, as in SPICE). The transient (`transient.ts`)
 * takes the same iterations at every step, from the solution of the last.
 */
import { ROOM_KELVIN } from './diode';
import { conditionOf, damageOf, loadOf, type PartStatus } from './limits';
import {
  assemble,
  BULGED,
  BURNT,
  compile,
  factor,
  readSettings,
  solveFactored,
  type Circuit,
  type LinearSystem,
} from './mna';
import type { Netlist } from './netlist';
import { keepLevel, memoryOf, type ModelState } from './state';
import { analyse, type TopologyIssue } from './topology';

/** What a meter would read on a part. */
export interface PartReading {
  /** The voltage from the first pin to the second (V). */
  u: number;
  /** The current into the part through its first pin (A): negative when it comes out there, as out of the plus pin
   * of a battery that feeds a circuit. */
  i: number;
  /** The power the part takes (W): the sum over its pins of voltage times the current into the pin; negative for a
   * source that gives power out. */
  p: number;
}

/** Why the model could not solve a circuit. */
export type DcFailure = 'singular' | 'no-convergence';

export interface DcSolution {
  ok: boolean;
  /** Set when `ok` is false. `singular`: the matrix has no single solution (two ideal sources side by side).
   * `no-convergence`: Newton's iterations did not settle, not even with the sources stepped up from zero. */
  reason?: DcFailure;
  /** The voltage of every node (V), by node number; 0 for the ground, for a node no pin uses, and everywhere when
   * the solve failed. */
  v: Float64Array;
  /** The reading of every part by its id; zeros when the solve failed. */
  parts: Record<string, PartReading>;
  /** What the stand shows of every part by its id (`limits.ts`): its condition and its load. */
  status: Record<string, PartStatus>;
  /** How many times the matrix was factored: 1 for a linear circuit, Newton's iterations otherwise (all of them,
   * those of the source steps too). */
  iterations: number;
  /** How many steps of the sources it took: 0 when Newton's iterations settled at once. */
  sourceSteps: number;
  /** What is wrong with the shape of the circuit (`topology.ts`); the numbers are valid all the same. */
  issues: TopologyIssue[];
}

export interface DcOptions {
  /** The memory of the stand: the solve starts from its node voltages, knows the parts that burnt or bulged, and
   * leaves there its node voltages, the temperature of every lamp and the charge of every capacitor when it
   * succeeds. */
  state?: ModelState;
  /** Newton's iterations at most, in one go and in each step of the sources (100, the ITL1 of SPICE). */
  maxIterations?: number;
  /** The moment whose sources the operating point holds steady (s): a sine gives its value then. 0 when absent. */
  time?: number;
}

/** The iterations of one go (SPICE's ITL1). */
export const MAX_ITERATIONS = 100;
/**
 * When Newton has settled (no junction limited its step, and the iteration did not start from nothing):
 * - exact: no unknown moved by more than `EXACT` of itself plus `FLOOR` (V or A);
 * - quiet: the guess already satisfies every row of the matrix linearized around it to the rounding of the solve — what
 *   is left of the rows is no more than `QUIET` of the largest row's terms (the backward error of the guess) — and no
 *   voltage moved by more than SPICE's tolerance (`SPICE_RELTOL` plus `SPICE_VNTOL`) of the largest voltage of the
 *   circuit, no current by more than `SPICE_RELTOL` of itself plus `SPICE_ABSTOL`. That is where a group of nodes held
 *   to the rest by nothing but GMIN (1e-12 S) or the tie (1 GΩ) stops: the rounding of amperes elsewhere moves its
 *   potential by micro- to millivolts at every solve, so its own step never shrinks; everything else has settled to
 *   the rounding, and the step taken from the quiet guess puts it there too.
 * - a go that runs out of iterations while the last `NOISE_RUN` of them were all quiet has reached the rounding
 *   noise: only the potential of such a group still moves, by more than SPICE's tolerance (a jumper of 1 mΩ inside a
 *   group that only GMIN holds), and no further iteration or source step would fix it.
 */
const EXACT = 1e-9;
const FLOOR = 1e-12;
const QUIET = 16 * Number.EPSILON;
const NOISE_RUN = 20;
const SPICE_RELTOL = 1e-3;
const SPICE_VNTOL = 1e-6;
const SPICE_ABSTOL = 1e-12;
/** Source stepping: the first step, the smallest, and how many iterations all the steps may take together. */
const FIRST_STEP = 0.25;
const SMALLEST_STEP = 1e-6;
const STEPPING_ITERATIONS = 5000;

const isCircuit = (x: Netlist | Circuit): x is Circuit => 'elements' in x;

/** How one go of Newton's iterations ended. */
export interface Go {
  settled: boolean;
  singular: boolean;
  iterations: number;
}

/** A go to fill: `newton` writes into it instead of making one. */
export const newGo = (): Go => ({ settled: false, singular: false, iterations: 0 });

const end = (go: Go, settled: boolean, singular: boolean, iterations: number): Go => {
  go.settled = settled;
  go.singular = singular;
  go.iterations = iterations;
  return go;
};

/** Whether the guess `x` leaves every row of A·x = b, just assembled around it, at the rounding: the largest row's
 * remainder against the largest row's sum of the magnitudes of its terms. */
function quietAt(system: LinearSystem, x: Float64Array): boolean {
  const { n, a, b } = system;
  let left = 0;
  let terms = 0;
  for (let i = 0; i < n; i++) {
    let r = -b[i]!;
    let sum = Math.abs(b[i]!);
    for (let j = 0; j < n; j++) {
      const t = a[i * n + j]! * x[j]!;
      r += t;
      sum += Math.abs(t);
    }
    left = Math.max(left, Math.abs(r));
    terms = Math.max(terms, sum);
  }
  return left <= QUIET * terms;
}

/**
 * Newton's iterations from the guess in `c.operating` (its `v`, `initial`, the moment it is for and the parts' memory),
 * at most `max` of them, written into `go` (a new one when absent). The circuit's last solution is left in
 * `c.operating.v` and `c.system.x`. It allocates nothing: the transient calls it at every step.
 */
export function newton(
  c: Circuit,
  settings: Float64Array,
  ties: readonly number[],
  damage: Uint8Array,
  max: number,
  go: Go = newGo(),
): Go {
  const { system, index, operating: op } = c;
  const { v } = op;
  const x = system.x;
  const before = c.scratch;
  // the unknowns below `voltages` are node voltages, the rest currents of sources
  let voltages = 0;
  for (let node = 0; node < index.length; node++) if (index[node]! >= 0) voltages++;
  let quietRun = 0;
  for (let iterations = 1; iterations <= max; iterations++) {
    op.limited = false;
    assemble(c, settings, ties, op, damage);
    // from the second iteration of a go on, `x` is the guess the parts were just stamped around
    const quiet = iterations > 1 && quietAt(system, x);
    if (!factor(system)) return end(go, false, true, iterations);
    before.set(x);
    solveFactored(system);
    let exact = iterations > 1;
    let small = quiet;
    let scale = 0;
    for (let k = 0; k < voltages; k++) scale = Math.max(scale, Math.abs(x[k]!), Math.abs(before[k]!));
    for (let k = 0; k < x.length; k++) {
      const now = x[k]!;
      if (!Number.isFinite(now)) return end(go, false, false, iterations);
      const step = Math.abs(now - before[k]!);
      const size = Math.max(Math.abs(now), Math.abs(before[k]!));
      if (step > EXACT * size + FLOOR) exact = false;
      const allowed = k < voltages ? SPICE_RELTOL * scale + SPICE_VNTOL : SPICE_RELTOL * size + SPICE_ABSTOL;
      if (step > allowed) small = false;
    }
    for (let node = 0; node < c.size; node++) {
      const k = index[node]!;
      v[node] = k >= 0 ? x[k]! : 0;
    }
    const steady = !op.limited && !op.initial;
    op.initial = false;
    if (steady && (exact || small)) return end(go, true, false, iterations);
    quietRun = steady && quiet ? quietRun + 1 : 0;
  }
  return end(go, quietRun >= NOISE_RUN, false, max);
}

/** Sets every part's memory for a new solve. */
function startParts(c: Circuit): void {
  for (const e of c.elements) e.behaviour.start?.(e);
}

/**
 * The first guess. A compiled circuit solved before starts from its own last solution, its junctions too. Otherwise
 * every junction starts at its knee of conduction, as in SPICE (a junction voltage read off the board's nodes, with
 * the drop on the series resistance in it, overshoots the exponential), and the other nodes start at the state's
 * node voltages when it has some for this many nodes, else at zero.
 */
function firstGuess(c: Circuit, state: ModelState | undefined): void {
  const op = c.operating;
  op.sources = 1;
  if (c.solved) {
    op.initial = false;
    return;
  }
  startParts(c);
  op.initial = true;
  op.v.fill(0);
  if (state && state.v.length === c.net.nodes) op.v.set(state.v);
}

/** The sources from zero to their full voltage in steps that grow while they settle and shrink when they do not. */
function stepSources(
  c: Circuit,
  settings: Float64Array,
  ties: readonly number[],
  broken: Uint8Array,
  max: number,
): Go & { steps: number } {
  const op = c.operating;
  const savedV = new Float64Array(op.v.length);
  const savedMemory = new Float64Array(c.memory.length);
  op.v.fill(0);
  startParts(c);
  op.initial = false;
  op.sources = 0;
  let iterations = 0;
  let steps = 0;
  const zero = newton(c, settings, ties, broken, max);
  iterations += zero.iterations;
  if (!zero.settled) return { ...zero, iterations, steps };
  let reached = 0;
  let step = FIRST_STEP;
  while (reached < 1) {
    if (iterations > STEPPING_ITERATIONS || step < SMALLEST_STEP) break;
    const next = Math.min(1, reached + step);
    savedV.set(op.v);
    savedMemory.set(c.memory);
    op.sources = next;
    const go = newton(c, settings, ties, broken, max);
    iterations += go.iterations;
    if (go.singular) return { ...go, iterations, steps };
    if (go.settled) {
      reached = next;
      steps++;
      step *= 2;
    } else {
      op.v.set(savedV);
      c.memory.set(savedMemory);
      step /= 4;
    }
  }
  op.sources = 1;
  return { settled: reached === 1, singular: false, iterations, steps };
}

/** The damage of every element of the circuit by the state's memory: 0 whole, BURNT, BULGED. */
export function damageIn(
  c: Circuit,
  state: ModelState | undefined,
  out: Uint8Array = new Uint8Array(c.elements.length),
): Uint8Array {
  c.elements.forEach((e, k) => {
    const failure = damageOf(state?.parts.get(e.part.id));
    out[k] = failure === 'burnt' ? BURNT : failure === 'bulged' ? BULGED : 0;
  });
  return out;
}

const FAILURES = [false, 'burnt', 'bulged'] as const;

/** The failure an element's damage code stands for, or false. */
export const failureIn = (damage: number): false | 'burnt' | 'bulged' => FAILURES[damage] ?? false;

/**
 * The reading of the element `k` of a circuit solved into `c.operating.v` and `c.system.x` for the moment of
 * `c.operating`, into `out`: a burnt part carries nothing, a bulged one what its failed form carries. `scratch` holds
 * the currents of the pins (as long as the part has pins at least).
 */
export function readPart(
  c: Circuit,
  k: number,
  setting: number,
  damage: number,
  scratch: Float64Array,
  out: PartReading,
): void {
  const e = c.elements[k]!;
  const all = c.operating.v;
  const pins = e.nodes.length;
  if (damage === 0) e.behaviour.currents(setting, e, all, c.system.x, scratch, c.operating);
  else if (damage === BULGED && e.behaviour.failed) e.behaviour.failed.currents(e, all, scratch);
  else scratch.fill(0, 0, pins);
  // the power against the last pin: Σ (v_pin − v_last)·i_pin equals Σ v_pin·i_pin, as the currents add up to zero
  const last = all[e.nodes[pins - 1]!]!;
  let p = 0;
  for (let pin = 0; pin < pins - 1; pin++) p += (all[e.nodes[pin]!]! - last) * scratch[pin]!;
  out.u = all[e.nodes[0]!]! - all[e.nodes[1]!]!;
  out.i = scratch[0]!;
  out.p = p;
}

/**
 * Solves the operating point of a netlist, or of a compiled circuit (its matrix is then reused, and the solve starts
 * from its last solution). A malformed netlist or a setting that is not a finite number is a RangeError; a circuit
 * without a single solution, or one whose iterations do not settle, is `ok: false` with the reason.
 */
export function solveDC(net: Netlist | Circuit, opts: DcOptions = {}): DcSolution {
  const circuit = isCircuit(net) ? net : compile(net);
  const { state } = opts;
  const max = opts.maxIterations ?? MAX_ITERATIONS;
  const settings = readSettings(circuit);
  const { system, elements, operating: op } = circuit;
  op.time = opts.time ?? 0;
  op.dt = 0;
  op.trapezoid = false;
  const broken = damageIn(circuit, state);
  const { issues, ties } = analyse(circuit, settings, broken);
  const nodes = circuit.net.nodes;
  const parts: Record<string, PartReading> = {};
  const status: Record<string, PartStatus> = {};
  const failed = (reason: DcFailure, iterations: number, sourceSteps: number): DcSolution => {
    circuit.solved = false;
    op.v.fill(0);
    op.sources = 1;
    elements.forEach((e, k) => {
      parts[e.part.id] = { u: 0, i: 0, p: 0 };
      status[e.part.id] = { condition: conditionOf(0, failureIn(broken[k]!)), load: 0 };
    });
    return { ok: false, reason, v: new Float64Array(nodes), parts, status, iterations, sourceSteps, issues };
  };

  let iterations = 1;
  let sourceSteps = 0;
  const nonlinear = elements.some((e, k) => e.behaviour.nonlinear && broken[k] !== BURNT);
  if (!nonlinear) {
    op.v.fill(0);
    op.sources = 1;
    assemble(circuit, settings, ties, op, broken);
    if (!factor(system)) return failed('singular', 1, 0);
    solveFactored(system);
    if (!system.x.every(Number.isFinite)) return failed('singular', 1, 0);
    for (let node = 0; node < circuit.size; node++) {
      const k = circuit.index[node]!;
      op.v[node] = k >= 0 ? system.x[k]! : 0;
    }
  } else {
    firstGuess(circuit, state);
    const go = newton(circuit, settings, ties, broken, max);
    iterations = go.iterations;
    if (go.singular) return failed('singular', iterations, 0);
    if (!go.settled) {
      const stepped = stepSources(circuit, settings, ties, broken, max);
      iterations += stepped.iterations;
      sourceSteps = stepped.steps;
      if (stepped.singular) return failed('singular', iterations, sourceSteps);
      if (!stepped.settled) return failed('no-convergence', iterations, sourceSteps);
    }
  }
  circuit.solved = true;

  const scratch = new Float64Array(Math.max(3, ...elements.map((e) => e.nodes.length)));
  elements.forEach((e, k) => {
    const reading = { u: 0, i: 0, p: 0 };
    readPart(circuit, k, settings[k]!, broken[k]!, scratch, reading);
    parts[e.part.id] = reading;
    const load = broken[k] ? 0 : loadOf(e.spec, reading);
    status[e.part.id] = { condition: conditionOf(load, failureIn(broken[k]!)), load };
  });
  const v = op.v.slice(0, nodes);
  if (state) {
    state.v = v.slice();
    // the level of every part with a state in time, steady: a lamp's temperature, a capacitor's charge
    elements.forEach((e, k) => {
      if (!e.behaviour.settle) return;
      const memory = memoryOf(state, e.part.id);
      if (broken[k]) {
        if (e.spec.kind === 'lamp') memory.kelvin = ROOM_KELVIN; // a broken filament is dark
        return;
      }
      e.behaviour.settle(settings[k]!, e, op.v, op);
      keepLevel(memory, e.spec.kind, e.history[0]!);
    });
  }
  return { ok: true, v, parts, status, iterations, sourceSteps, issues };
}
