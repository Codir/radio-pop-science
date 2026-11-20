/**
 * The shape of a circuit, before its numbers: which sources have an open loop or a loop of wires alone, which pins
 * hang in a row nothing else touches, which nodes have no path to the ground for direct current. The model ties each
 * group of such nodes to the ground by TIE_OHMS at its lowest node and solves on; the stand reads the issues to say
 * what is wrong on the board.
 */
import type { Circuit } from './mna';
import { GROUND } from './netlist';

export type TopologyIssue =
  /** A source whose terminals the rest of the circuit does not join: no current can flow through it. */
  | { kind: 'open'; part: string }
  /** A source whose terminals are joined by wires alone (jumpers, closed switches, one row). */
  | { kind: 'short'; part: string }
  /** Pins of a part in rows that no other part touches (never the ground). */
  | { kind: 'floating'; part: string; pins: string[] }
  /** Nodes in use with no path to the ground; the model ties `nodes[0]` to the ground. */
  | { kind: 'ungrounded'; nodes: number[] };

export interface Topology {
  /** Issues of the sources (open, short) in the order of the parts, then the floating pins in the order of the
   * parts, then the groups of ungrounded nodes by their lowest node. */
  readonly issues: TopologyIssue[];
  /** The node the model ties to the ground in every group of ungrounded nodes. */
  readonly ties: number[];
}

/** Groups of nodes, merged by links (union–find with halving of paths). */
function groups(nodes: number): { find: (n: number) => number; join: (a: number, b: number) => void } {
  const parent = Int32Array.from({ length: nodes }, (_, k) => k);
  const find = (n: number): number => {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]!]!;
      n = parent[n]!;
    }
    return n;
  };
  return { find, join: (a, b) => void (parent[find(a)] = find(b)) };
}

/** The topology of a circuit at the settings of its parts (in the order of the elements). */
export function analyse(c: Circuit, settings: Float64Array): Topology {
  const { elements } = c;
  const nodes = c.net.nodes;
  const issues: TopologyIssue[] = [];

  /** Groups joined by the links of every part but `skip`, or by its wires alone. */
  const joined = (skip: number, wiresOnly: boolean) => {
    const g = groups(nodes);
    elements.forEach((e, k) => {
      if (k === skip || (wiresOnly && !e.behaviour.wire(settings[k]!))) return;
      for (const [a, b] of e.behaviour.links(settings[k]!)) g.join(e.nodes[a]!, e.nodes[b]!);
    });
    return g;
  };

  elements.forEach((e, k) => {
    if (!e.behaviour.source) return;
    const [plus, minus] = [e.nodes[0]!, e.nodes[1]!];
    const wires = joined(k, true);
    const rest = joined(k, false);
    if (wires.find(plus) === wires.find(minus)) issues.push({ kind: 'short', part: e.part.id });
    else if (rest.find(plus) !== rest.find(minus)) issues.push({ kind: 'open', part: e.part.id });
  });

  // how many parts touch each node: a pin is floating when its part is the only one there
  const touching = new Int32Array(nodes);
  for (const e of elements) for (const node of new Set(e.nodes)) touching[node] += 1;
  for (const e of elements) {
    const pins = e.spec.pins.filter((_, pin) => e.nodes[pin] !== GROUND && touching[e.nodes[pin]!] === 1);
    if (pins.length > 0) issues.push({ kind: 'floating', part: e.part.id, pins });
  }

  const all = joined(-1, false);
  const ground = all.find(GROUND);
  const islands = new Map<number, number[]>(); // in the order of their lowest node
  for (let node = 0; node < nodes; node++) {
    const root = all.find(node);
    if (touching[node] === 0 || root === ground) continue;
    const island = islands.get(root);
    if (island) island.push(node);
    else islands.set(root, [node]);
  }
  const ties: number[] = [];
  for (const island of islands.values()) {
    issues.push({ kind: 'ungrounded', nodes: island });
    ties.push(island[0]!);
  }
  return { issues, ties };
}
