/**
 * Proof that a quest can be won, and in how many moves at best. A 0-1 breadth-first search over nuclides of a
 * neutral atom, built on the very functions the game plays (fire, knockOut, spontaneousFission, daughterOf).
 * Tools cost one move; the self-decay of a fleeting nucleus costs none.
 */
import { getNuclide, hasNuclide } from '../core';
import type { DecayCode, NuclideRef } from '../core';
import { daughterOf } from './decay';
import { startGame } from './game';
import type { ToolId } from './game';
import { fire, knockOut, spontaneousFission } from './reactions';
import type { ProjectileId } from './reactions';
import { reached } from './quests';
import type { Quest } from './quests';

interface Node { readonly z: number; readonly n: number; readonly fissioned: boolean }
interface Edge { readonly to: Node; readonly cost: 0 | 1; readonly label: string }

const keyOf = (s: Node): string => `${s.z}-${s.n}-${s.fissioned ? 1 : 0}`;
const nameOf = (x: NuclideRef): string => `${x.z}-${x.n}`;

/** The main-branch decay of a nuclide as edges: a shifted daughter, or both fragments of a spontaneous fission. */
function decayEdges(s: Node, cost: 0 | 1, tool: string): Edge[] {
  const main = getNuclide(s.z, s.n)?.branches[0];
  if (!main) return [];
  if (main.code === 'sf') {
    const fission = spontaneousFission(s);
    if (!fission) return [];
    return [fission.heavy, fission.light].map((f) => ({ to: { ...f, fissioned: true }, cost, label: `${tool} → ${nameOf(f)}` }));
  }
  const d = daughterOf(s, main.code as Exclude<DecayCode, 'sf'>);
  return hasNuclide(d.z, d.n) ? [{ to: { ...d, fissioned: s.fissioned }, cost, label: `${tool} → ${nameOf(d)}` }] : [];
}

function toolEdges(s: Node, tool: ToolId): Edge[] {
  if (tool === 'wait') return decayEdges(s, 1, 'wait');
  if (tool === 'gamma-n' || tool === 'gamma-p') {
    const out = knockOut(s, tool === 'gamma-n' ? 'n' : 'p');
    return out ? [{ to: { ...out.product, fissioned: s.fissioned }, cost: 1, label: `${tool} → ${nameOf(out.product)}` }] : [];
  }
  const result = fire(s, tool as ProjectileId);
  switch (result.kind) {
    case 'bounce': return [];
    case 'fission':
      return [result.fission.heavy, result.fission.light].map((f) => ({ to: { ...f, fissioned: true }, cost: 1, label: `${tool} → ${nameOf(f)}` }));
    case 'pp':
    case 'capture':
      return [{ to: { ...result.product, fissioned: s.fissioned }, cost: 1, label: `${tool} → ${nameOf(result.product)}` }];
  }
}

function edgesOf(s: Node, tools: readonly ToolId[]): Edge[] {
  const edges = tools.flatMap((t) => toolEdges(s, t));
  if (getNuclide(s.z, s.n)?.status === 'fleeting') edges.push(...decayEdges(s, 0, 'decays'));
  return edges;
}

const isGoal = (quest: Quest, s: Node): boolean => reached(quest.goal, { ...startGame(s.z, s.n), fissioned: s.fissioned });

export function solve(quest: Quest, limit = 16): { readonly moves: number; readonly path: readonly string[] } | null {
  const first: Node = { ...quest.start, fissioned: false };
  const dist = new Map<string, number>([[keyOf(first), 0]]);
  const parent = new Map<string, { from: string; label: string }>();
  const nodes = new Map<string, Node>([[keyOf(first), first]]);
  const settled = new Set<string>();
  // Two-ended queue: cost-0 edges go to the front, cost-1 edges to the back.
  const deque: string[] = [keyOf(first)];

  while (deque.length > 0) {
    const key = deque.shift()!;
    if (settled.has(key)) continue;
    settled.add(key);
    const node = nodes.get(key)!;
    const d = dist.get(key)!;
    if (isGoal(quest, node)) {
      const path: string[] = [];
      for (let k = key; parent.has(k); k = parent.get(k)!.from) path.unshift(parent.get(k)!.label);
      return { moves: d, path };
    }
    for (const edge of edgesOf(node, quest.tools)) {
      const nd = d + edge.cost;
      const nk = keyOf(edge.to);
      if (nd > limit || nd >= (dist.get(nk) ?? Infinity)) continue;
      dist.set(nk, nd);
      nodes.set(nk, edge.to);
      parent.set(nk, { from: key, label: edge.label });
      if (edge.cost === 0) deque.unshift(nk); else deque.push(nk);
    }
  }
  return null;
}
