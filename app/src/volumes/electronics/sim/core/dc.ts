/**
 * The operating point: the voltages and currents of a circuit with every source steady. A linear circuit is one solve
 * of the matrix. A circuit with nonlinear parts (diodes, LEDs, a lamp) takes Newton's iterations: every part stamps
 * its linearization around the last solution, the matrix gives the next one, until nothing moves. A junction limits
 * the step of its voltage (`diode.ts`); when the iterations still do not settle, the sources are stepped up from zero,
 * each step starting from the solution of the last (source stepping, as in SPICE).
 */
import { ROOM_KELVIN } from './diode';
import { filament } from './lamp';
import { conditionOf, loadOf, type PartStatus } from './limits';
import { assemble, compile, factor, readSettings, solveFactored, type Circuit } from './mna';
import type { Netlist } from './netlist';
import { memoryOf, type ModelState } from './state';
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
  /** The memory of the stand: the solve starts from its node voltages, leaves the burnt parts out, and leaves there
   * its node voltages and the temperature of every lamp when it succeeds. */
  state?: ModelState;
  /** Newton's iterations at most, in one go and in each step of the sources (100, the ITL1 of SPICE). */
  maxIterations?: number;
}

/** The iterations of one go (SPICE's ITL1). */
export const MAX_ITERATIONS = 100;
/**
 * When Newton has settled. At once when no unknown moved by more than `EXACT` of itself plus `FLOOR` (V or A): the
 * solution is then exact to rounding. Or when two iterations in a row moved no more than SPICE allows (its defaults:
 * `SPICE_RELTOL` of the value plus `SPICE_VNTOL` for a voltage, `SPICE_ABSTOL` for a current): that is where a circuit
 * whose node is held by nothing but GMIN — reversed diodes in series — stops, since the rounding of the solve moves
 * such a node by millivolts; elsewhere the quadratic convergence of Newton has by then taken the step to ~1e-6 of
 * the value and the solution to ~1e-12.
 */
const EXACT = 1e-9;
const FLOOR = 1e-12;
const SPICE_RELTOL = 1e-3;
const SPICE_VNTOL = 1e-6;
const SPICE_ABSTOL = 1e-12;
/** Source stepping: the first step, the smallest, and how many iterations all the steps may take together. */
const FIRST_STEP = 0.25;
const SMALLEST_STEP = 1e-6;
const STEPPING_ITERATIONS = 5000;

const isCircuit = (x: Netlist | Circuit): x is Circuit => 'elements' in x;

/** How one go of Newton's iterations ended. */
interface Go {
  settled: boolean;
  singular: boolean;
  iterations: number;
}

/**
 * Newton's iterations from the guess in `c.operating` (its `v`, `initial` and the parts' memory), at most `max` of
 * them. The circuit's last solution is left in `c.operating.v` and `c.system.x`.
 */
function newton(
  c: Circuit,
  settings: Float64Array,
  ties: readonly number[],
  broken: Uint8Array,
  max: number,
): Go {
  const { system, index, operating: op } = c;
  const { v } = op;
  const x = system.x;
  const before = new Float64Array(x.length);
  // the unknowns below `voltages` are node voltages, the rest currents of sources
  let voltages = 0;
  for (const k of index) if (k >= 0) voltages++;
  let spiceBefore = false;
  for (let iterations = 1; iterations <= max; iterations++) {
    op.limited = false;
    assemble(c, settings, ties, op, broken);
    if (!factor(system)) return { settled: false, singular: true, iterations };
    before.set(x);
    solveFactored(system);
    let exact = iterations > 1;
    let spice = exact;
    for (let k = 0; k < x.length; k++) {
      const now = x[k]!;
      if (!Number.isFinite(now)) return { settled: false, singular: false, iterations };
      const step = Math.abs(now - before[k]!);
      const size = Math.max(Math.abs(now), Math.abs(before[k]!));
      if (step > EXACT * size + FLOOR) exact = false;
      if (step > SPICE_RELTOL * size + (k < voltages ? SPICE_VNTOL : SPICE_ABSTOL)) spice = false;
    }
    for (let node = 0; node < c.size; node++) {
      const k = index[node]!;
      v[node] = k >= 0 ? x[k]! : 0;
    }
    const steady = !op.limited && !op.initial;
    op.initial = false;
    if (steady && (exact || (spice && spiceBefore))) return { settled: true, singular: false, iterations };
    spiceBefore = steady && spice;
  }
  return { settled: false, singular: false, iterations: max };
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
  const broken = new Uint8Array(elements.length);
  elements.forEach((e, k) => (broken[k] = state?.parts.get(e.part.id)?.burnt ? 1 : 0));
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
      status[e.part.id] = { condition: conditionOf(0, broken[k] === 1), load: 0 };
    });
    return { ok: false, reason, v: new Float64Array(nodes), parts, status, iterations, sourceSteps, issues };
  };

  let iterations = 1;
  let sourceSteps = 0;
  const nonlinear = elements.some((e, k) => e.behaviour.nonlinear && !broken[k]);
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

  const all = op.v;
  let currents = new Float64Array(3);
  elements.forEach((e, k) => {
    const pins = e.nodes.length;
    if (currents.length < pins) currents = new Float64Array(pins);
    if (broken[k]) currents.fill(0);
    else e.behaviour.currents(settings[k]!, e, all, system.x, currents);
    // the power against the last pin: Σ (v_pin − v_last)·i_pin equals Σ v_pin·i_pin, as the currents add up to zero
    const last = all[e.nodes[pins - 1]!]!;
    let p = 0;
    for (let pin = 0; pin < pins - 1; pin++) p += (all[e.nodes[pin]!]! - last) * currents[pin]!;
    const reading = { u: all[e.nodes[0]!]! - all[e.nodes[1]!]!, i: currents[0]!, p };
    parts[e.part.id] = reading;
    const load = broken[k] ? 0 : loadOf(e.spec, reading);
    status[e.part.id] = { condition: conditionOf(load, broken[k] === 1), load };
  });
  const v = all.slice(0, nodes);
  if (state) {
    state.v = v.slice();
    for (const e of elements) {
      if (e.spec.kind !== 'lamp') continue;
      const memory = memoryOf(state, e.part.id);
      memory.kelvin = memory.burnt ? ROOM_KELVIN : filament(e.spec, parts[e.part.id]!.u).kelvin;
    }
  }
  return { ok: true, v, parts, status, iterations, sourceSteps, issues };
}
