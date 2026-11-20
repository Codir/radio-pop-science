/**
 * Modified nodal analysis. The unknowns are the voltages of the nodes in use (the ground and the rows no pin uses are
 * left out), then the voltages of the parts' own nodes (a diode's junction behind its series resistance), then the
 * currents of the parts that need one (an ideal source). A node's row says that the currents leaving it through the
 * parts add up to what is pushed into it; a source's row says what its voltage is. Every part leaves its stamp in a
 * dense matrix, and LU with partial pivoting solves it.
 *
 * `compile` allocates the matrix of a circuit once, and with it the scratch of Newton's iterations and the history of
 * the parts in time. A solve clears the matrix, stamps again and factors it in place, so the transient
 * (`transient.ts`) solves thousands of times without allocating; the Newton iterations of nonlinear parts (`dc.ts`)
 * stamp the parts again around each new guess. A circuit's matrix is mostly zeros — a part touches two or three
 * nodes — so the factorization skips them; and the matrix of a linear circuit stays the same from one step of the
 * transient to the next while nothing on the board changes, so the transient keeps its factors and stamps the
 * right-hand side alone (`assembleRight`).
 */
import { checkNetlist, checkSetting, GROUND, type Netlist, type PartInstance } from './netlist';
import { behaviour, PARTS, type Behaviour, type Operating, type PartSpec, type Placement } from './parts';

/** Read here once: the transient checks every part's setting at every moment, and under the test runner (vitest)
 * every read of an import is a lookup (README.md, «Speed»). */
const check = checkSetting;

/** The smallest pivot the factorization takes, in the unit of the matrix (S): the default PIVTOL of SPICE. */
export const PIVOT_MIN = 1e-13;

/** The resistance that ties a node without a path to the ground (Ω): the air between two rows of a board. */
export const TIE_OHMS = 1e9;

/** What happened to a part, by element, in the array a solve takes (`damage`): whole (0); burnt, a gap in the
 * circuit (BURNT); bulged, its failed form (BULGED: an electrolytic capacitor, `capacitor.ts`). */
export const BURNT = 1;
export const BULGED = 2;

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
  /** Scratch of `factor`: the columns where the pivot row is not zero. */
  readonly columns: Int32Array;
  /** How many times `factor` has factored A: whoever keeps the factors to solve again knows whether another
   * factorization has taken their place since. */
  factorizations: number;
}

export function createSystem(n: number): LinearSystem {
  return {
    n,
    a: new Float64Array(n * n),
    b: new Float64Array(n),
    x: new Float64Array(n),
    perm: new Int32Array(n),
    columns: new Int32Array(n),
    factorizations: 0,
  };
}

/**
 * Factors A in place into L·U with the rows exchanged (partial pivoting: in each column the largest number becomes
 * the pivot). False when a pivot is smaller than PIVOT_MIN or is not a number: the matrix is singular, and nothing
 * is divided by it. `b` is left as it is. Most of a circuit's matrix is zeros: a row with a zero under the pivot is
 * left alone, and a row below the pivot changes only in the columns where the pivot row is not zero. A term skipped is
 * a product with a zero, which would not have changed the number it was taken from: the factors are the same, number
 * for number, as those of the whole loops, in a fraction of the time.
 */
export function factor(s: LinearSystem): boolean {
  const { n, a, perm, columns } = s;
  s.factorizations++;
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
    const row = k * n;
    const d = a[row + k]!;
    let m = 0;
    for (let c = k + 1; c < n; c++) if (a[row + c] !== 0) columns[m++] = c;
    for (let r = k + 1; r < n; r++) {
      const below = a[r * n + k]!;
      if (below === 0) continue;
      const f = below / d;
      a[r * n + k] = f;
      const base = r * n;
      for (let j = 0; j < m; j++) {
        const c = columns[j]!;
        a[base + c] -= f * a[row + c]!;
      }
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
  /** A current g·(v(`p`) − v(`q`)) that flows through the part from node `a` to node `b`, `g` in S: the voltage of
   * another pair of nodes controls it (a transistor's collector current, which its base–emitter voltage sets). */
  transconductance(a: number, b: number, p: number, q: number, g: number): void;
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
  /** A stamper of the right-hand side alone: what a part puts into the matrix goes nowhere (`assembleRight`). */
  readonly right: Stamper;
  /** The memory of every part, one array (each element's `memory` is a view of its share). */
  readonly memory: Float64Array;
  /** The history of every part in time, one array (each element's `history` is a view of its share). */
  readonly history: Float64Array;
  /** Scratch of Newton's iterations, as long as the unknowns: the last guess. */
  readonly scratch: Float64Array;
  /** Scratch of Newton's iterations: the matrix and the right-hand side as assembled, before `factor` overwrote the
   * matrix — to ask afterwards whether the guess already satisfied them. */
  readonly kept: { readonly a: Float64Array; readonly b: Float64Array };
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
  const history = new Float64Array(parts.reduce((sum, p) => sum + p.behaviour.history, 0));
  let own = net.nodes;
  let kept = 0;
  let held = 0;
  const elements = parts.map(({ part, spec, behaviour: how }): Element => {
    const branch = how.branches > 0 ? unknowns : -1;
    unknowns += how.branches;
    const inner = Int32Array.from({ length: how.inner }, (_, k) => own + k);
    own += how.inner;
    const share = memory.subarray(kept, kept + how.memory);
    kept += how.memory;
    const past = history.subarray(held, held + how.history);
    held += how.history;
    const nodes = Int32Array.from(part.pins);
    return { part, spec, behaviour: how, nodes, branch, inner, memory: share, history: past };
  });
  const system = createSystem(unknowns);
  return {
    net,
    elements,
    size,
    index,
    system,
    stamper: stamperOf(system, index),
    right: rightOf(system, index),
    memory,
    history,
    scratch: new Float64Array(unknowns),
    kept: { a: new Float64Array(unknowns * unknowns), b: new Float64Array(unknowns) },
    operating: {
      v: new Float64Array(size),
      sources: 1,
      initial: false,
      limited: false,
      time: 0,
      dt: 0,
      trapezoid: false,
    },
    solved: false,
  };
}

function stamperOf(system: LinearSystem, index: Int32Array): Stamper {
  const { n, a, b } = system;
  // a conductance or a current from a node to itself (a part with both legs in one row) carries nothing: it is not
  // stamped, since adding and taking away a large g would round away the GMIN that alone may hold that node; nor is a
  // transconductance from a node to itself or controlled by a node against itself
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
    transconductance(from, to, p, q, g) {
      if (from === to || p === q) return;
      const i = index[from]!;
      const j = index[to]!;
      const cp = index[p]!;
      const cq = index[q]!;
      // the current leaves `from` (its row: +g·v(p) − g·v(q)) and comes into `to` (the same, negated)
      if (i >= 0) {
        if (cp >= 0) a[i * n + cp] += g;
        if (cq >= 0) a[i * n + cq] -= g;
      }
      if (j >= 0) {
        if (cp >= 0) a[j * n + cp] -= g;
        if (cq >= 0) a[j * n + cq] += g;
      }
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

/** The stamper of the right-hand side of `stamperOf` alone: the same currents and source voltages into `b`, added in
 * the same order, and nothing into the matrix. */
function rightOf(system: LinearSystem, index: Int32Array): Stamper {
  const { b } = system;
  const none = (): void => undefined;
  return {
    conductance: none,
    current(p, q, i) {
      if (p === q) return;
      const from = index[p]!;
      const to = index[q]!;
      if (from >= 0) b[from] -= i;
      if (to >= 0) b[to] += i;
    },
    transconductance: none,
    voltage(_plus, _minus, k, volts) {
      b[k] += volts;
    },
  };
}

/** The setting every part works with now, in the order of the elements, into `out` (a new array when absent); a
 * setting that is not a finite number is a RangeError. */
export function readSettings(
  c: Circuit,
  out: Float64Array = new Float64Array(c.elements.length),
): Float64Array {
  updateSettings(c, out);
  return out;
}

/** `readSettings` in place: whether any setting differs from what `out` held. */
export function updateSettings(c: Circuit, out: Float64Array): boolean {
  let changed = false;
  const { elements } = c;
  for (let k = 0; k < elements.length; k++) {
    const e = elements[k]!;
    check(e.part);
    const setting = e.behaviour.setting(e.part.setting);
    if (setting !== out[k]) changed = true;
    out[k] = setting;
  }
  return changed;
}

/**
 * Clears the matrix and stamps every part at its setting around the guess `op`, then ties each node of `ties` to the
 * ground by TIE_OHMS. A part marked BURNT in `damage` stamps nothing: it is a gap, and its own nodes follow its first
 * pin through 1 S, which carries no current since nothing else touches them. A part marked BULGED stamps its failed
 * form (a gap when it has none).
 */
export function assemble(
  c: Circuit,
  settings: Float64Array,
  ties: readonly number[],
  op: Operating = c.operating,
  damage?: Uint8Array,
): void {
  const { system, stamper, elements } = c;
  system.a.fill(0);
  system.b.fill(0);
  for (let k = 0; k < elements.length; k++) {
    const e = elements[k]!;
    const failed = damage?.[k] ?? 0;
    if (failed === 0) e.behaviour.stamp(settings[k]!, e, stamper, op);
    else if (failed === BULGED && e.behaviour.failed) e.behaviour.failed.stamp(e, stamper);
    else for (let j = 0; j < e.inner.length; j++) stamper.conductance(e.inner[j]!, e.nodes[0]!, 1);
  }
  for (let j = 0; j < ties.length; j++) stamper.conductance(ties[j]!, GROUND, 1 / TIE_OHMS);
}

/**
 * `assemble` for the right-hand side alone: clears `b` and stamps every part at its setting around `op` with the
 * stamper `right`, so `b` comes out as `assemble` would make it, number for number, and the matrix with its factors is
 * left as it is. For a linear circuit whose matrix has not changed since it was factored — the same settings, damage,
 * ties and step of integration — `solveFactored` then solves the new moment.
 */
export function assembleRight(
  c: Circuit,
  settings: Float64Array,
  op: Operating = c.operating,
  damage?: Uint8Array,
): void {
  const { system, right, elements } = c;
  system.b.fill(0);
  for (let k = 0; k < elements.length; k++) {
    const e = elements[k]!;
    const failed = damage?.[k] ?? 0;
    if (failed === 0) e.behaviour.stamp(settings[k]!, e, right, op);
    else if (failed === BULGED && e.behaviour.failed) e.behaviour.failed.stamp(e, right);
  }
}
