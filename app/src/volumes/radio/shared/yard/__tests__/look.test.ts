import { describe, expect, it } from 'vitest';
import { duskEnv, lanternLevel } from '../look';

describe('look', () => {
  it('сутінки: кінці шкали — набори dusk і night рушія, поза 0…1 — затиснуто', () => {
    expect(duskEnv(0).keyIntensity).toBeCloseTo(0.6, 9);
    expect(duskEnv(1).keyIntensity).toBeCloseTo(0.5, 9);
    expect(duskEnv(0).stars).toBeCloseTo(0.6, 9);
    expect(duskEnv(0.5).stars).toBeCloseTo(0.8, 9);
    expect(duskEnv(1).stars).toBe(1);
    expect(duskEnv(-1)).toEqual(duskEnv(0));
    expect(duskEnv(2)).toEqual(duskEnv(1));
  });

  it('без порошинок, відтінку й гармонії', () => {
    for (const d of [0, 0.5, 1]) {
      const e = duskEnv(d);
      expect(e.motes).toBe(0);
      expect(e.gradeTintAmount).toBe(0);
      expect(e.harmony).toBe(0);
    }
  });

  it('ліхтар вмикається після 0,4', () => {
    expect(lanternLevel(0.39)).toBe(0);
    expect(lanternLevel(0.45)).toBeGreaterThan(0);
    expect(lanternLevel(0.5)).toBe(1);
  });
});
