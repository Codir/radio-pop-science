import { describe, expect, it } from 'vitest';
import { getNuclide, hasNuclide } from '../../core';
import type { DecayCode } from '../../core';
import { daughterOf } from '../decay';
import { chooseFragment, fireAt, startGame, waitForDecay } from '../game';
import { QUEST_IDS, QUESTS, questById, reached } from '../quests';
import { solve } from '../solver';

describe('quests', () => {
  it('declares eleven quests with nuclides that exist', () => {
    expect(QUESTS.map((q) => q.id)).toEqual([...QUEST_IDS]);
    for (const q of QUESTS) {
      expect(hasNuclide(q.start.z, q.start.n), q.id).toBe(true);
      expect(q.tools.length).toBeGreaterThan(0);
      expect(reached(q.goal, startGame(q.start.z, q.start.n)), q.id).toBe(false);
    }
  });

  it.each(QUESTS.map((q) => [q.id, q] as const))('%s is solvable in exactly its par', (_id, quest) => {
    expect(solve(quest)?.moves).toBe(quest.par);
  });

  it('pins the pars', () => {
    expect(Object.fromEntries(QUESTS.map((q) => [q.id, q.par]))).toEqual({
      'heavy-hydrogen': 3, radiocarbon: 3, sun: 2, 'star-forge': 2, 'mercury-gold': 2, technetium: 1,
      plutonium: 3, fission: 4, 'uranium-chain': 13, 'lead-gold': 11, superheavy: 1,
    });
  });

  it('every way of waiting from ²³⁸U ends on ²⁰⁶Pb after 14 decays', () => {
    const ends = new Set<string>();
    const walk = (z: number, n: number, depth: number): void => {
      const branches = getNuclide(z, n)!.branches.filter((b) => b.code !== 'sf');
      if (branches.length === 0 || depth > 30) return void ends.add(`${z}-${n}@${depth}`);
      for (const b of branches) { const d = daughterOf({ z, n }, b.code as Exclude<DecayCode, 'sf'>); walk(d.z, d.n, depth + 1); }
    };
    walk(92, 146, 0);
    expect([...ends]).toEqual(['82-124@14']);
  });

  it('plays quest 1 and quest 8 through the real rules', () => {
    let s = startGame(1, 0);
    s = fireAt(s, 'n').state; s = fireAt(s, 'n').state; s = waitForDecay(s, 0.5, 0).state;
    expect(reached(questById('heavy-hydrogen')!.goal, s)).toBe(true);
    let f = fireAt(startGame(92, 143), 'n').state;
    expect(reached(questById('fission')!.goal, f)).toBe(false);
    f = chooseFragment(f, 'heavy').state;
    for (let i = 0; i < 3; i++) f = waitForDecay(f, 0.5, 0).state;
    expect(f).toMatchObject({ z: 59, n: 82, moves: 4 });
    expect(reached(questById('fission')!.goal, f)).toBe(true);
    expect(reached({ kind: 'stableFragment' }, startGame(59, 82))).toBe(false);
  });
});
