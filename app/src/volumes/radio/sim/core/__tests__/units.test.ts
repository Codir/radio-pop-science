import { describe, expect, it } from 'vitest';
import { ampToDbm, dbmToAmp, powerDbm } from '../units';

describe('units', () => {
  it('dBm і розмах', () => {
    expect(dbmToAmp(0)).toBe(1);
    expect(dbmToAmp(-20)).toBeCloseTo(0.1, 12);
    expect(ampToDbm(dbmToAmp(-54))).toBeCloseTo(-54, 9);
    expect(ampToDbm(0)).toBe(-200);
  });

  it('потужність блока пар', () => {
    const x = new Float32Array(200);
    for (let i = 0; i < 200; i += 2) x[i] = 0.1;
    expect(powerDbm(x)).toBeCloseTo(-20, 4);
    expect(powerDbm(x, 10, 20)).toBeCloseTo(-20, 4);
  });

  it('нулі й порожній відтинок дають −200', () => {
    expect(powerDbm(new Float32Array(8))).toBe(-200);
    expect(powerDbm(new Float32Array(8), 3, 3)).toBe(-200);
  });
});
