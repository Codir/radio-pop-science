/** The eleven quests: where the atom starts, which tools it gets, what it must become, and the best move count. */
import { getNuclide } from '../core';
import type { NuclideRef } from '../core';
import type { GameState, ToolId } from './game';
import { PROJECTILES } from './reactions';

export const QUEST_IDS = ['heavy-hydrogen', 'radiocarbon', 'sun', 'star-forge', 'mercury-gold', 'technetium',
  'plutonium', 'fission', 'uranium-chain', 'lead-gold', 'superheavy'] as const;
export type QuestId = (typeof QUEST_IDS)[number];

export type Goal =
  | { readonly kind: 'nuclide'; readonly z: number; readonly n: number }
  | { readonly kind: 'element'; readonly z: number }
  | { readonly kind: 'stableFragment' };          // a stable nuclide after a fission

export interface Quest {
  readonly id: QuestId;
  readonly start: NuclideRef;
  readonly tools: readonly ToolId[];
  readonly goal: Goal;
  readonly par: number;
}

const PROJECTILE_IDS: readonly ToolId[] = PROJECTILES.map((p) => p.id);

/** The 8 projectiles, then the gamma knock-outs and waiting. */
export const ALL_TOOLS: readonly ToolId[] = [...PROJECTILE_IDS, 'gamma-n', 'gamma-p', 'wait'];

/** Free play starts on the lightest atom. */
export const FREE_START: NuclideRef = { z: 1, n: 0 };

export const QUESTS: readonly Quest[] = [
  { id: 'heavy-hydrogen', start: { z: 1, n: 0 }, tools: ['n', 'wait'], goal: { kind: 'nuclide', z: 2, n: 1 }, par: 3 },
  { id: 'radiocarbon', start: { z: 6, n: 6 }, tools: ['n', 'wait'], goal: { kind: 'nuclide', z: 7, n: 7 }, par: 3 },
  { id: 'sun', start: { z: 1, n: 0 }, tools: ['p', 'he3', 'wait'], goal: { kind: 'nuclide', z: 2, n: 2 }, par: 2 },
  { id: 'star-forge', start: { z: 2, n: 2 }, tools: ['alpha', 'wait'], goal: { kind: 'nuclide', z: 6, n: 6 }, par: 2 },
  { id: 'mercury-gold', start: { z: 80, n: 116 }, tools: ['n', 'wait'], goal: { kind: 'nuclide', z: 79, n: 118 }, par: 2 },
  { id: 'technetium', start: { z: 42, n: 56 }, tools: ['n', 'd', 'wait'], goal: { kind: 'element', z: 43 }, par: 1 },
  { id: 'plutonium', start: { z: 92, n: 146 }, tools: ['n', 'wait'], goal: { kind: 'nuclide', z: 94, n: 145 }, par: 3 },
  { id: 'fission', start: { z: 92, n: 143 }, tools: ['n', 'wait'], goal: { kind: 'stableFragment' }, par: 4 },
  { id: 'uranium-chain', start: { z: 92, n: 146 }, tools: ['wait'], goal: { kind: 'nuclide', z: 82, n: 124 }, par: 13 },
  { id: 'lead-gold', start: { z: 82, n: 126 }, tools: ['gamma-n', 'gamma-p', 'wait'], goal: { kind: 'nuclide', z: 79, n: 118 }, par: 11 },
  { id: 'superheavy', start: { z: 98, n: 151 }, tools: [...PROJECTILE_IDS, 'wait'], goal: { kind: 'element', z: 118 }, par: 1 },
];

export function questById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Never true while a fission fragment is still to be chosen. */
export function reached(goal: Goal, state: GameState): boolean {
  if (state.pending !== null) return false;
  switch (goal.kind) {
    case 'nuclide': return state.z === goal.z && state.n === goal.n;
    case 'element': return state.z === goal.z;
    case 'stableFragment': return state.fissioned && getNuclide(state.z, state.n)?.status === 'stable';
  }
}
