import { describe, expect, it } from 'vitest';
import { allNuclides, getNuclide, hasNuclide } from '../../core';
import { DECAY_SHIFT, availableBranches, daughterOf, decayQ, pickBranch, playedMode, sampleLifetime } from '../decay';

describe('decay rules', () => {
  it('moves along the chart', () => {
    expect(daughterOf({ z: 6, n: 8 }, 'b-')).toEqual({ z: 7, n: 7 });
    expect(daughterOf({ z: 92, n: 146 }, 'a')).toEqual({ z: 90, n: 144 });
    expect(daughterOf({ z: 80, n: 117 }, 'ec')).toEqual({ z: 79, n: 118 });
    expect(DECAY_SHIFT['b-3n']).toEqual([1, -4]);
    expect(DECAY_SHIFT['b+a']).toEqual([-3, -1]);
  });
  it('finds every daughter the table lists', () => {
    for (const x of allNuclides())
      for (const b of x.branches) {
        if (b.code === 'sf') continue;
        const d = daughterOf(x, b.code);
        expect(hasNuclide(d.z, d.n), `${x.z}-${x.n} ${b.code}`).toBe(true);
      }
  });
  it('needs an electron for a pure capture', () => {
    const be7 = getNuclide(4, 3)!, hg197 = getNuclide(80, 117)!, n13 = getNuclide(7, 6)!;
    expect(availableBranches(be7, 0)).toEqual([]);
    expect(availableBranches(be7, 4)).toEqual([{ code: 'ec', share: 1 }]);
    expect(playedMode(hg197, 'ec', 80)).toBe('ec');
    expect(playedMode(n13, 'ec/b+', 7)).toBe('b+');
    expect(playedMode(n13, 'ec/b+', 0)).toBe('b+');
  });
  it('picks a branch and a lifetime', () => {
    const og = getNuclide(118, 176)!.branches;
    expect(pickBranch(og, 0).code).toBe('a');
    expect(pickBranch(og, 0.5).code).toBe('a');
    expect(pickBranch(og, 0.9).code).toBe('sf');
    expect(pickBranch(og, 0.999999).code).toBe('sf');
    expect(sampleLifetime(100, 0.5)).toBeCloseTo(100, 9);
    expect(sampleLifetime(null, 0.3)).toBe(0);
    expect(sampleLifetime('stable', 0.3)).toBe(0);
    expect(Number.isFinite(sampleLifetime(6.3e26, 0.999999))).toBe(true);
  });
  it('balances the energy', () => {
    expect(decayQ(getNuclide(1, 2)!, 'b-')).toBeCloseTo(18.59, 1);
    expect(decayQ(getNuclide(92, 146)!, 'a')).toBeCloseTo(4269.9, 0);
    expect(decayQ(getNuclide(2, 3)!, 'n')).toBeCloseTo(735.0, 0);
  });
});
