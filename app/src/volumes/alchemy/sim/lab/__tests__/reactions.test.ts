import { describe, expect, it } from 'vitest';
import { allNuclides, getNuclide, hasNuclide, type NuclideRef } from '../../core';
import { decayQ } from '../decay';
import { fire, knockOut, spontaneousFission, type Fission } from '../reactions';

describe('reactions', () => {
  it('captures, evaporates, bounces', () => {
    expect(fire({ z: 1, n: 0 }, 'n')).toMatchObject({ kind: 'capture', product: { z: 1, n: 1 }, evaporated: 0 });
    expect((fire({ z: 1, n: 0 }, 'n') as { q: number }).q).toBeCloseTo(2224.57, 1);
    expect(fire({ z: 1, n: 0 }, 'p')).toMatchObject({ kind: 'pp', product: { z: 1, n: 1 } });
    expect((fire({ z: 1, n: 0 }, 'p') as { q: number }).q).toBeCloseTo(1442.2, 0);
    expect(fire({ z: 98, n: 151 }, 'ca48')).toMatchObject({ kind: 'capture', product: { z: 118, n: 176 }, evaporated: 3 });
    expect(fire({ z: 2, n: 2 }, 'alpha')).toMatchObject({ kind: 'capture', product: { z: 4, n: 4 } });
    expect(fire({ z: 2, n: 1 }, 'he3')).toMatchObject({ kind: 'capture', product: { z: 4, n: 2 } });
    expect(fire({ z: 118, n: 176 }, 'ca48')).toEqual({ kind: 'bounce' });
  });
  it('bounces when the first compound nucleus is the target itself', () => {
    expect(fire({ z: 1, n: 6 }, 'n')).toEqual({ kind: 'bounce' });
    expect(fire({ z: 118, n: 176 }, 'n')).toEqual({ kind: 'bounce' });
  });
  it('sums to the known D–T energy over capture and decay', () => {
    const capture = fire({ z: 1, n: 2 }, 'd') as { product: NuclideRef; q: number };
    expect(capture.product).toEqual({ z: 2, n: 3 });
    expect(capture.q + decayQ(getNuclide(2, 3)!, 'n')!).toBeCloseTo(17589, -1);
  });
  it('splits the four fissile nuclides the textbook way', () => {
    const u235 = fire({ z: 92, n: 143 }, 'n');
    expect(u235).toMatchObject({ kind: 'fission', fission: { heavy: { z: 56, n: 85 }, light: { z: 36, n: 56 }, neutrons: 3, preset: true } });
    expect((u235 as { fission: Fission }).fission.q! / 1000).toBeCloseTo(173.3, 0);
    for (const [z, n] of [[92, 141], [92, 143], [94, 145], [94, 147]] as const) {
      const r = fire({ z, n }, 'n');
      if (r.kind !== 'fission') throw new Error('expected fission');
      const f = r.fission;
      expect(f.heavy.z + f.light.z).toBe(z);
      expect(f.heavy.z + f.heavy.n + f.light.z + f.light.n + f.neutrons).toBe(z + n + 1);
      expect(hasNuclide(f.heavy.z, f.heavy.n) && hasNuclide(f.light.z, f.light.n)).toBe(true);
    }
    expect(fire({ z: 92, n: 146 }, 'n')).toMatchObject({ kind: 'capture', product: { z: 92, n: 147 } });
  });
  it('finds fragments for every nuclide with a spontaneous-fission branch', () => {
    const sf = allNuclides().filter((x) => x.branches.some((b) => b.code === 'sf'));
    expect(sf.length).toBeGreaterThan(100);
    for (const x of sf) {
      const f = spontaneousFission(x);
      expect(f, `${x.z}-${x.n}`).not.toBeNull();
      expect(f!.heavy.z + f!.light.z).toBe(x.z);
      expect(f!.neutrons).toBeGreaterThanOrEqual(0);
      expect(hasNuclide(f!.heavy.z, f!.heavy.n) && hasNuclide(f!.light.z, f!.light.n)).toBe(true);
    }
  });
  it('never invents nucleons in a spontaneous split of any nuclide', () => {
    for (const x of allNuclides()) {
      const f = spontaneousFission(x);
      if (f === null) continue;
      expect(f.neutrons, `${x.z}-${x.n}`).toBeGreaterThanOrEqual(0);
      expect(f.heavy.z + f.light.z, `${x.z}-${x.n}`).toBe(x.z);
    }
  });
  it('knocks nucleons out, but never below hydrogen or off the table', () => {
    expect(knockOut({ z: 82, n: 126 }, 'p')).toMatchObject({ product: { z: 81, n: 126 } });
    expect(knockOut({ z: 82, n: 126 }, 'p')!.q).toBeCloseTo(-8003, 0);
    expect(knockOut({ z: 82, n: 126 }, 'n')!.q).toBeCloseTo(-7368, 0);
    expect(knockOut({ z: 1, n: 0 }, 'p')).toBeNull();
    expect(knockOut({ z: 1, n: 0 }, 'n')).toBeNull();
    expect(knockOut({ z: 118, n: 176 }, 'n')).toBeNull();
  });
});
