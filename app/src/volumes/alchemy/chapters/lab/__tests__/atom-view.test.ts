import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { getNuclide, MAX_N, MAX_Z } from '@alchemy/sim/core';
import { Nucleus, NUCLEON_RADIUS } from '@alchemy/shared/nucleus';
import { shellRadius } from '@alchemy/shared/shell-atom';
import { atomRadiusFor, nucleusScaleFor, unrest } from '../parts/atom-view';

const status = (z: number, n: number) => getNuclide(z, n)!.status;

describe('atom view: the state without words', () => {
  it('rests for stable and practically stable nuclei, is restless when radioactive, trembles when fleeting', () => {
    expect(status(1, 0)).toBe('stable');
    expect(unrest(status(1, 0))).toBe(0); // ¹H
    expect(status(90, 142)).toBe('longLived');
    expect(unrest(status(90, 142))).toBe(0); // ²³²Th
    expect(status(98, 151)).toBe('radioactive');
    expect(unrest(status(98, 151))).toBe(0.35); // ²⁴⁹Cf
    expect(status(4, 4)).toBe('fleeting');
    expect(unrest(status(4, 4))).toBe(1); // ⁸Be
    expect(unrest('incomplete')).toBe(0);
    expect(unrest(null)).toBe(0);
  });
});

describe('atom view: sizes', () => {
  it('keeps even the heaviest nucleus, trembling, inside the K shell', () => {
    const nucleus = new Nucleus(new Rng(3), { maxProtons: MAX_Z, maxNeutrons: MAX_N, protons: 0, neutrons: 0 });
    const p = new Vector3();
    for (const [z, n] of [[118, 176], [MAX_Z, MAX_N]] as const) {
      nucleus.setCounts(z, n, true);
      nucleus.jiggle = 1 + 4 * unrest('fleeting');
      const scale = nucleusScaleFor(nucleus.radius);
      let far = 0;
      for (let frame = 0; frame < 240; frame++) {
        nucleus.update(1 / 60, frame / 60);
        for (let i = 0; i < z; i++) far = Math.max(far, nucleus.local('p', i, p).length());
        for (let i = 0; i < n; i++) far = Math.max(far, nucleus.local('n', i, p).length());
      }
      const breathe = 1 + 0.025 * nucleus.jiggle; // the largest size of a breathing nucleon
      expect((far + NUCLEON_RADIUS * breathe) * scale, `Z=${z} N=${n}`).toBeLessThan(shellRadius(0));
    }
  });

  it('never enlarges a small nucleus beyond the standard scale', () => {
    expect(nucleusScaleFor(0.5)).toBe(0.3);
    expect(nucleusScaleFor(4) * 4).toBeCloseTo(0.95);
  });

  it('draws atoms with more shells larger, from 2 to 4.1 world units', () => {
    expect(atomRadiusFor(1)).toBe(2);
    expect(atomRadiusFor(7)).toBeCloseTo(4.1);
    for (let k = 2; k <= 7; k++) expect(atomRadiusFor(k)).toBeGreaterThan(atomRadiusFor(k - 1));
  });
});
