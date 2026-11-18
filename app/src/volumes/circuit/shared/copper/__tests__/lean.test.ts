import { describe, expect, it } from 'vitest';
import { LEAN_MAX, leanX } from '../lean';

describe('leanX (the crowd leaning to one side, charge/shift)', () => {
  it('is the identity at lean 0 and outside the span', () => {
    for (const x of [-9, -3, 0, 2.5, 7.4, 12]) expect(leanX(x, 0, 7.5, 0)).toBe(x);
    expect(leanX(-8, 0, 7.5, 0.8)).toBe(-8);
    expect(leanX(8, 0, 7.5, 0.8)).toBe(8);
  });

  it('keeps the order of the electrons (monotonic) and the ends of the span fixed', () => {
    let prev = -Infinity;
    for (let x = -7.5; x <= 7.5; x += 0.05) {
      const y = leanX(x, 0, 7.5, LEAN_MAX);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
    expect(leanX(-7.5, 0, 7.5, 0.8)).toBeCloseTo(-7.5);
    expect(leanX(7.5, 0, 7.5, 0.8)).toBeCloseTo(7.5);
  });

  it('crowds the +x side for a positive lean (denser there), the −x side for a negative one', () => {
    const density = (x: number, lean: number): number =>
      0.01 / (leanX(x + 0.005, 0, 7.5, lean) - leanX(x - 0.005, 0, 7.5, lean));
    expect(density(6, 0.8)).toBeGreaterThan(2.5);
    expect(density(-6, 0.8)).toBeLessThan(0.7);
    expect(density(-6, -0.8)).toBeGreaterThan(2.5);
  });

  it('follows the centre', () => {
    expect(leanX(13, 10, 7.5, 0.5)).toBeCloseTo(10 + leanX(3, 0, 7.5, 0.5));
  });
});
