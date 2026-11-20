/**
 * Modified nodal analysis. The unknowns are the voltages of the nodes in use (the ground and the rows no pin uses are
 * left out) and then the currents of the parts that need one (an ideal source). A node's row says that the currents
 * leaving it through the parts add up to what is pushed into it; a source's row says what its voltage is. Every part
 * leaves its stamp in a dense matrix, and LU with partial pivoting solves it.
 *
 * `compile` allocates the matrix of a circuit once. A solve clears it, stamps again and factors it in place, so the
 * transient (E1-5) can solve thousands of times without allocating; the Newton iterations of nonlinear parts (E1-4)
 * stamp the parts again around each new guess.
 */
import { checkNetlist, checkSetting, GROUND, type Netlist, type PartInstance } from './netlist';
import { behaviour, PARTS, type Behaviour, type PartSpec } from './parts';

/** The smallest pivot the factorization takes, in the unit of the matrix (S): the default PIVTOL of SPICE. */
export const PIVOT_MIN = 1e-13;

/** The resistance that ties a node without a path to the ground (Ω): the air between two rows of a board. */
export const TIE_OHMS = 1e9;

/** A square system A·x = b of `n` unknowns, A dense in rows. */
export interface LinearSystem {
  readonly n: number;
  /** A, row after row; after `factor` it holds L (below the diagonal, without its ones) and U. */
  readonly a: Float64Array;
  readonly b: Float64Array;
  /** The solution, after `solveFactored`. */
  readonly x: Float64Array;
  /** The row of A that became row k of the factors. */
  readonly perm: Int32Array;
}

export function createSystem(n: number): LinearSystem {
  return {
    n,
    a: new Float64Array(n * n),
    b: new Float64Array(n),
    x: new Float64Array(n),
    perm: new Int32Array(n),
  };
}

/**
 * Factors A in place into L·U with the rows exchanged (partial pivoting: in each column the largest number becomes
 * the pivot). False when a pivot is smaller than PIVOT_MIN or is not a number: the matrix is singular, and nothing
 * is divided by it. `b` is left as it is.
 */
export function factor(s: LinearSystem): boolean {
  const { n, a, perm } = s;
  for (let k = 0; k < n; k++) perm[k] = k;
  for (let k = 0; k < n; k++) {
    let pivot = k;
    let largest = Math.abs(a[k * n + k]!);
    for (let r = k + 1; r < n; r++) {
      const size = Math.abs(a[r * n + k]!);
      if (size > largest) {
        largest = size;
        pivot = r;
      }
    }
    if (!(largest >= PIVOT_MIN)) return false; // NaN fails this too
    if (pivot !== k) {
      for (let c = 0; c < n; c++) {
        const t = a[k * n + c]!;
        a[k * n + c] = a[pivot * n + c]!;
        a[pivot * n + c] = t;
      }
      const t = perm[k]!;
      perm[k] = perm[pivot]!;
      perm[pivot] = t;
    }
    const d = a[k * n + k]!;
    for (let r = k + 1; r < n; r++) {
      const f = a[r * n + k]! / d;
      a[r * n + k] = f;
      if (f === 0) continue;
      for (let c = k + 1; c < n; c++) a[r * n + c] -= f * a[k * n + c]!;
    }
  }
  return true;
}

/** x from b through the factors of the last `factor` that returned true. */
export function solveFactored(s: LinearSystem): void {
  const { n, a, b, x, perm } = s;
  for (let r = 0; r < n; r++) {
    let sum = b[perm[r]!]!;
    for (let c = 0; c < r; c++) sum -= a[r * n + c]! * x[c]!;
    x[r] = sum;
  }
  for (let r = n - 1; r >= 0; r--) {
    let sum = x[r]!;
    for (let c = r + 1; c < n; c++) sum -= a[r * n + c]! * x[c]!;
    x[r] = sum / a[r * n + r]!;
  }
}

/** What a part's stamp writes with: nodes by their numbers (the ground and unused rows are skipped). */
export interface Stamper {
  /** A conductance `g` (S) between nodes `a` and `b`. */
  conductance(a: number, b: number, g: number): void;
  /** A current `i` (A) that flows through the part from node `a` to node `b`: it leaves `a` and comes into `b`. */
  current(a: number, b: number, i: number): void;
  /** An ideal source: v(plus) − v(minus) = `volts`; its current, into `plus`, is the unknown `branch`. */
  voltage(plus: number, minus: number, branch: number, volts: number): void;
}

/** A part of a compiled circuit. */
export interface Element {
  readonly part: PartInstance;
  readonly spec: PartSpec;
  readonly behaviour: Behaviour;
  /** The node of every pin. */
  readonly nodes: Int32Array;
  /** The index of its first current unknown, −1 when it has none. */
  readonly branch: number;
}

/** A netlist ready to solve: its parts with their behaviour, its unknowns and its matrix, made once. The circuit
 * follows the settings of its netlist (turning a knob needs no new compile); any other change of the netlist does. */
export interface Circuit {
  readonly net: Netlist;
  readonly elements: readonly Element[];
  /** The unknown of every node, −1 for the ground and for a node no pin uses; the currents follow the nodes. */
  readonly index: Int32Array;
  readonly system: LinearSystem;
  readonly stamper: Stamper;
}

/** Checks the netlist (a RangeError names the fault), numbers the unknowns and allocates the matrix. */
export function compile(net: Netlist): Circuit {
  checkNetlist(net);
  const index = new Int32Array(net.nodes).fill(-1);
  let unknowns = 0;
  const used = new Uint8Array(net.nodes);
  for (const part of net.parts) for (const node of part.pins) used[node] = 1;
  for (let node = 0; node < net.nodes; node++) if (node !== GROUND && used[node]) index[node] = unknowns++;
  const elements = net.parts.map((part): Element => {
    const spec = PARTS[part.spec]!;
    const how = behaviour(spec);
    const branch = how.branches > 0 ? unknowns : -1;
    unknowns += how.branches;
    return { part, spec, behaviour: how, nodes: Int32Array.from(part.pins), branch };
  });
  const system = createSystem(unknowns);
  return { net, elements, index, system, stamper: stamperOf(system, index) };
}

function stamperOf(system: LinearSystem, index: Int32Array): Stamper {
  const { n, a, b } = system;
  return {
    conductance(p, q, g) {
      const i = index[p]!;
      const j = index[q]!;
      if (i >= 0) a[i * n + i] += g;
      if (j >= 0) a[j * n + j] += g;
      if (i >= 0 && j >= 0) {
        a[i * n + j] -= g;
        a[j * n + i] -= g;
      }
    },
    current(p, q, i) {
      const from = index[p]!;
      const to = index[q]!;
      if (from >= 0) b[from] -= i;
      if (to >= 0) b[to] += i;
    },
    voltage(plus, minus, k, volts) {
      const i = index[plus]!;
      const j = index[minus]!;
      if (i >= 0) {
        a[i * n + k] += 1;
        a[k * n + i] += 1;
      }
      if (j >= 0) {
        a[j * n + k] -= 1;
        a[k * n + j] -= 1;
      }
      b[k] += volts;
    },
  };
}

/** The setting every part works with now, in the order of the elements; a setting that is not a finite number is a
 * RangeError. */
export function readSettings(c: Circuit): Float64Array {
  const out = new Float64Array(c.elements.length);
  c.elements.forEach((e, k) => {
    checkSetting(e.part);
    out[k] = e.behaviour.setting(e.part.setting);
  });
  return out;
}

/** Clears the matrix and stamps every part at its setting, then ties each node of `ties` to the ground by TIE_OHMS. */
export function assemble(c: Circuit, settings: Float64Array, ties: readonly number[]): void {
  const { system, stamper, elements } = c;
  system.a.fill(0);
  system.b.fill(0);
  elements.forEach((e, k) => e.behaviour.stamp(settings[k]!, e, stamper));
  for (const node of ties) stamper.conductance(node, GROUND, 1 / TIE_OHMS);
}
