/**
 * The operating point: the voltages and currents of a circuit with every source steady. For the linear parts of
 * E1-3 this is one solve of the matrix; E1-4 makes it Newton's iterations around the nonlinear parts.
 */
import { assemble, compile, factor, readSettings, solveFactored, type Circuit } from './mna';
import type { Netlist } from './netlist';
import type { ModelState } from './state';
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
export type DcFailure = 'singular';

export interface DcSolution {
  ok: boolean;
  /** Set when `ok` is false. `singular`: the matrix has no single solution (two ideal sources side by side). */
  reason?: DcFailure;
  /** The voltage of every node (V), by node number; 0 for the ground, for a node no pin uses, and everywhere when
   * the solve failed. */
  v: Float64Array;
  /** The reading of every part by its id; zeros when the solve failed. */
  parts: Record<string, PartReading>;
  /** How many times the matrix was factored: 1 for a linear circuit. */
  iterations: number;
  /** What is wrong with the shape of the circuit (`topology.ts`); the numbers are valid all the same. */
  issues: TopologyIssue[];
}

export interface DcOptions {
  /** The memory of the stand; the solve leaves its node voltages there when it succeeds. */
  state?: ModelState;
}

const isCircuit = (x: Netlist | Circuit): x is Circuit => 'elements' in x;

/**
 * Solves the operating point of a netlist, or of a compiled circuit (its matrix is then reused). A malformed netlist
 * or a setting that is not a finite number is a RangeError; a circuit without a single solution is `ok: false`.
 */
export function solveDC(net: Netlist | Circuit, opts: DcOptions = {}): DcSolution {
  const circuit = isCircuit(net) ? net : compile(net);
  const settings = readSettings(circuit);
  const { issues, ties } = analyse(circuit, settings);
  const { system, index, elements } = circuit;
  const nodes = circuit.net.nodes;
  const v = new Float64Array(nodes);
  const parts: Record<string, PartReading> = {};
  const failed = (reason: DcFailure): DcSolution => {
    for (const e of elements) parts[e.part.id] = { u: 0, i: 0, p: 0 };
    return { ok: false, reason, v, parts, iterations: 1, issues };
  };

  assemble(circuit, settings, ties);
  if (!factor(system)) return failed('singular');
  solveFactored(system);
  if (!system.x.every(Number.isFinite)) return failed('singular');
  for (let node = 0; node < nodes; node++) {
    const k = index[node]!;
    if (k >= 0) v[node] = system.x[k]!;
  }

  let currents = new Float64Array(3);
  elements.forEach((e, k) => {
    const pins = e.nodes.length;
    if (currents.length < pins) currents = new Float64Array(pins);
    e.behaviour.currents(settings[k]!, e, v, system.x, currents);
    // the power against the last pin: Σ (v_pin − v_last)·i_pin equals Σ v_pin·i_pin, as the currents add up to zero
    const last = v[e.nodes[pins - 1]!]!;
    let p = 0;
    for (let pin = 0; pin < pins - 1; pin++) p += (v[e.nodes[pin]!]! - last) * currents[pin]!;
    parts[e.part.id] = { u: v[e.nodes[0]!]! - v[e.nodes[1]!]!, i: currents[0]!, p };
  });
  if (opts.state) opts.state.v = v.slice();
  return { ok: true, v, parts, iterations: 1, issues };
}
