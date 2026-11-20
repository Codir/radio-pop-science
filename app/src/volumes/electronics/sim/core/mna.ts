/**
 * Modified nodal analysis. The unknowns are the voltages of the nodes in use (the ground and the rows no pin uses are
 * left out), then the voltages of the parts' own nodes (a diode's junction behind its series resistance), then the
 * currents of the parts that need one (an ideal source). A node's row says that the currents leaving it through the
 * parts add up to what is pushed into it; a source's row says what its voltage is. Every part leaves its stamp in a
 * dense matrix, and LU with partial pivoting solves it.
 *
 * `compile` allocates the matrix of a circuit once, and with it the scratch of Newton's iterations. A solve clears
 * the matrix, stamps again and factors it in place, so the transient (E1-5) can solve thousands of times without
 * allocating; the Newton iterations of nonlinear parts (`dc.ts`) stamp the parts again around each new guess.
 */
import { checkNetlist, checkSetting, GROUND, type Netlist, type PartInstance } from './netlist';
import { behaviour, PARTS, type Behaviour, type Operating, type PartSpec, type Placement } from './parts';

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

/** A part of a compiled circuit: where it sits (the node of every pin, its own nodes, its first current unknown, its
 * memory) and how it behaves. */
export interface Element extends Placement {
  readonly part: PartInstance;
  readonly spec: PartSpec;
  readonly behaviour: Behaviour;
}

/** A netlist ready to solve: its parts with their behaviour, its unknowns and its matrix, made once. The circuit
 * follows the settings of its netlist (turning a knob needs no new compile); any other change of the netlist does. */
export interface Circuit {
  readonly net: Netlist;
  readonly elements: readonly Element[];
  /** How many nodes there are with the parts' own: the board's `net.nodes`, then one for each own node. */
  readonly size: number;
  /** The unknown of every node (the parts' own too), −1 for the ground and for a node no pin uses; the currents
   * follow the nodes. */
  readonly index: Int32Array;
  readonly system: LinearSystem;
  readonly stamper: Stamper;
  /** The memory of every part, one array (each element's `memory` is a view of its share). */
  readonly memory: Float64Array;
  /** The guess the parts stamp around: its `v` holds the last solution of this circuit, the parts' own nodes too. */
  readonly operating: Operating;
  /** Whether `operating.v` and `memory` hold a solution of this circuit (a later solve may start from it). */
  solved: boolean;
}

/** Checks the netlist (a RangeError names the fault), numbers the unknowns and allocates the matrix. */
export function compile(net: Netlist): Circuit {
  checkNetlist(net);
  const parts = net.parts.map((part) => {
    const spec = PARTS[part.spec]!;
    return { part, spec, behaviour: behaviour(spec) };
  });
  const size = net.nodes + parts.reduce((sum, p) => sum + p.behaviour.inner, 0);
  const index = new Int32Array(size).fill(-1);
  let unknowns = 0;
  const used = new Uint8Array(net.nodes);
  for (const part of net.parts) for (const node of part.pins) used[node] = 1;
  for (let node = 0; node < net.nodes; node++) if (node !== GROUND && used[node]) index[node] = unknowns++;
  for (let node = net.nodes; node < size; node++) index[node] = unknowns++;
  const memory = new Float64Array(parts.reduce((sum, p) => sum + p.behaviour.memory, 0));
  let own = net.nodes;
  let kept = 0;
  const elements = parts.map(({ part, spec, behaviour: how }): Element => {
    const branch = how.branches > 0 ? unknowns : -1;
    unknowns += how.branches;
    const inner = Int32Array.from({ length: how.inner }, (_, k) => own + k);
    own += how.inner;
    const share = memory.subarray(kept, kept + how.memory);
    kept += how.memory;
    return { part, spec, behaviour: how, nodes: Int32Array.from(part.pins), branch, inner, memory: share };
  });
  const system = createSystem(unknowns);
  return {
    net,
    elements,
    size,
    index,
    system,
    stamper: stamperOf(system, index),
    memory,
    operating: { v: new Float64Array(size), sources: 1, initial: false, limited: false },
    solved: false,
  };
}

function stamperOf(system: LinearSystem, index: Int32Array): Stamper {
  const { n, a, b } = system;
  // a conductance or a current from a node to itself (a part with both legs in one row) carries nothing: it is not
  // stamped, since adding and taking away a large g would round away the GMIN that alone may hold that node
  return {
    conductance(p, q, g) {
      if (p === q) return;
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
      if (p === q) return;
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

/**
 * Clears the matrix and stamps every part at its setting around the guess `op`, then ties each node of `ties` to the
 * ground by TIE_OHMS. A part marked in `broken` (it burnt) stamps nothing: it is a gap, and its own nodes follow its
 * first pin through 1 S, which carries no current since nothing else touches them.
 */
export function assemble(
  c: Circuit,
  settings: Float64Array,
  ties: readonly number[],
  op: Operating = c.operating,
  broken?: Uint8Array,
): void {
  const { system, stamper, elements } = c;
  system.a.fill(0);
  system.b.fill(0);
  elements.forEach((e, k) => {
    if (broken?.[k]) for (const node of e.inner) stamper.conductance(node, e.nodes[0]!, 1);
    else e.behaviour.stamp(settings[k]!, e, stamper, op);
  });
  for (const node of ties) stamper.conductance(node, GROUND, 1 / TIE_OHMS);
}
