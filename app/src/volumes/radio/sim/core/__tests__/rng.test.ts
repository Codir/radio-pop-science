import { describe, expect, it } from 'vitest';
import { createRng, GAUSS_TABLE, type Rng } from '../rng';
import { mean, share, std } from './helpers';

const take = (r: Rng, n: number): number[] => Array.from({ length: n }, () => r.u32());

describe('rng', () => {
  it('перші числа закріплено', () => {
    const r = createRng(1);
    expect([r.u32(), r.u32(), r.u32()]).toEqual([2693262067, 11749833, 2265367787]);
    // seed 0 would be a poor start for this generator: it is replaced
    expect(take(createRng(0), 3)).toEqual(take(createRng(0x9e3779b9), 3));
  });

  it('те саме зерно — ті самі 1000 чисел, інше — інші; float у [0, 1)', () => {
    const a = take(createRng(42), 1000);
    expect(take(createRng(42), 1000)).toEqual(a);
    expect(createRng(43).u32()).not.toBe(a[0]);
    const r = createRng(42);
    const floats = Array.from({ length: 1000 }, () => r.float());
    expect(floats).toEqual(a.map((v) => v / 2 ** 32));
    expect(Math.min(...floats)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...floats)).toBeLessThan(1);
  });

  it('таблиця квантилів', () => {
    expect(GAUSS_TABLE.length).toBe(65536);
    expect(GAUSS_TABLE[0]).toBeCloseTo(-4.32492, 4);
    expect(GAUSS_TABLE[16384]).toBeCloseTo(-0.674466, 5);
    expect(GAUSS_TABLE[65535]).toBeCloseTo(4.32492, 4);
  });

  it('gaussFill: середнє, розкид і хвости', () => {
    const x = new Float32Array(1_000_000);
    createRng(7).gaussFill(x, 1);
    // one u32() gives two samples: its upper half indexes the table first, then its lower half
    const v = createRng(7).u32();
    expect([x[0], x[1]]).toEqual([GAUSS_TABLE[v >>> 16], GAUSS_TABLE[v & 0xffff]]);
    expect(Math.abs(mean(x))).toBeLessThan(0.005);
    expect(Math.abs(std(x) - 1)).toBeLessThan(0.01);
    expect(Math.abs(share(x, (v) => Math.abs(v) > 3) - 0.0027)).toBeLessThan(0.0006);
    const y = new Float32Array(100_000);
    createRng(7).gaussFill(y, 2.5);
    expect(std(y)).toBeCloseTo(2.5, 1);
  });

  it('fork — окремий повторюваний потік', () => {
    const parent = createRng(5);
    const one = take(parent.fork(1), 100);
    const two = take(parent.fork(2), 100);
    expect(two[0]).not.toBe(one[0]);
    expect(two).not.toEqual(one);
    expect(take(parent.fork(1), 100)).toEqual(one);
    // a fork neither is the parent's stream nor moves it
    const untouched = take(createRng(5), 100);
    expect(one).not.toEqual(untouched);
    expect(take(parent, 100)).toEqual(untouched);
    // …and it starts from the seed, not from where the parent is now
    expect(take(parent.fork(1), 100)).toEqual(one);
  });
});
