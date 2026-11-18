import { describe, expect, it } from 'vitest';
import { NUCLIDE_COUNT, SOURCE_SYMBOLS, allNuclides, bindingPerNucleon, getNuclide, hasNuclide, isotopesOf, naturalNuclides } from '../nuclides';

describe('nuclide table', () => {
  it('has the snapshot counts', () => {
    expect(NUCLIDE_COUNT).toBe(3383);
    expect(allNuclides()).toHaveLength(3383);
    expect(new Set(allNuclides().map((x) => x.z)).size).toBe(118);
    expect(SOURCE_SYMBOLS).toHaveLength(118);
    expect(naturalNuclides()).toHaveLength(288);
    const count = (s: string) => allNuclides().filter((x) => x.status === s).length;
    expect([count('stable'), count('longLived'), count('radioactive'), count('fleeting'), count('incomplete')])
      .toEqual([244, 38, 1870, 1170, 61]);
    expect(allNuclides().every((x) => x.z >= 1 && x.n >= 0)).toBe(true);
  });
  it('keeps shares normalised and sorted', () => {
    for (const x of allNuclides()) {
      if (x.branches.length === 0) continue;
      expect(x.branches.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 5);
      expect(x.branches.every((b, i, all) => i === 0 || all[i - 1]!.share >= b.share)).toBe(true);
      expect(x.branches.every((b) => b.share >= 1e-4)).toBe(true);
    }
  });
  it('cleans the known quirks of the snapshot', () => {
    expect(getNuclide(79, 118)).toMatchObject({ a: 197, status: 'stable', abundance: 100, branches: [] });
    expect(getNuclide(1, 2)!.branches).toEqual([{ code: 'b-', share: 1 }]);
    expect(getNuclide(1, 2)!.halfLife).toBeCloseTo(388781328, -2);
    expect(getNuclide(118, 176)!.branches.map((b) => [b.code, +b.share.toFixed(4)])).toEqual([['a', 0.8333], ['sf', 0.1667]]);
    expect(getNuclide(4, 2)!.branches).toEqual([{ code: '2p', share: 1 }]);          // α → ²He does not exist
    expect(getNuclide(82, 122)).toMatchObject({ status: 'longLived', branches: [] }); // lower limit: no decay seen
    expect(getNuclide(90, 142)).toMatchObject({ status: 'longLived', branches: [{ code: 'a', share: 1 }] });
    expect(getNuclide(20, 28)!.branches.map((b) => [b.code, b.share])).toEqual([['2b-', 0.78], ['b-', 0.22]]);
    expect(getNuclide(92, 146)!.branches).toEqual([{ code: 'a', share: 1 }]);          // sf 5·10⁻⁷ dropped
    expect(getNuclide(3, 1)).toMatchObject({ halfLife: null, status: 'fleeting' });    // ⁴Li: branch, no T½
    expect(getNuclide(2, 0)).toBeUndefined();
    expect(hasNuclide(118, 177)).toBe(false);
    expect(isotopesOf(118).map((x) => x.n)).toEqual([176]);
  });
  it('derives the binding energy per nucleon from the mass excess', () => {
    expect(bindingPerNucleon(getNuclide(26, 30)!)).toBeCloseTo(8790.36, 0);
    expect(bindingPerNucleon(getNuclide(1, 0)!)).toBeCloseTo(0, 6);
  });
});
