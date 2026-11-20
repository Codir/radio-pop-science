/**
 * The marks the parts carry as data (docs/volumes/electronics/VISUAL.md §4.2, §4.7): the four colour bands of a
 * resistor (IEC 60062) from its value, the three-digit code of a ceramic or film capacitor, and the colours of the
 * bands — exactly the recipes of VISUAL's table, gold and silver derived from tokens.
 */
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { PARTS } from '@electronics/sim/core';
import { BAND_METAL, bandColor, capacitorCode, resistorBands, type BandColor } from '../code';

/** IEC 60062, written out here once more so the test does not read the code's own table. */
const DIGIT: Partial<Record<BandColor, number>> = {
  black: 0,
  brown: 1,
  red: 2,
  orange: 3,
  yellow: 4,
  green: 5,
  blue: 6,
  violet: 7,
  grey: 8,
  white: 9,
};
const POWER: Partial<Record<BandColor, number>> = { ...DIGIT, gold: -1, silver: -2 };
const TOLERANCE: Partial<Record<BandColor, number>> = { brown: 0.01, red: 0.02, gold: 0.05, silver: 0.1 };

/** The value and tolerance four bands stand for. */
function decode(bands: readonly BandColor[]): { ohms: number; tolerance: number } {
  const [a, b, m, t] = bands as [BandColor, BandColor, BandColor, BandColor];
  return { ohms: (DIGIT[a]! * 10 + DIGIT[b]!) * 10 ** POWER[m]!, tolerance: TOLERANCE[t]! };
}

describe('resistorBands — the colour code of a value (VISUAL §4.2)', () => {
  it('reads the examples of VISUAL', () => {
    expect(resistorBands(4700, 0.05)).toEqual(['yellow', 'violet', 'red', 'gold']);
    expect(resistorBands(330, 0.05)).toEqual(['orange', 'orange', 'brown', 'gold']);
    expect(resistorBands(1, 0.05)).toEqual(['brown', 'black', 'gold', 'gold']);
    expect(resistorBands(9.1e6, 0.05)).toEqual(['white', 'brown', 'green', 'gold']);
    expect(resistorBands(10e6, 0.05)).toEqual(['brown', 'black', 'blue', 'gold']);
  });

  it('gives every resistor of the catalog four bands that read back as its value and its gold 5 %', () => {
    const resistors = Object.entries(PARTS).filter(([, s]) => s.kind === 'resistor');
    expect(resistors.length).toBe(169);
    for (const [key, spec] of resistors) {
      if (spec.kind !== 'resistor') continue;
      const bands = resistorBands(spec.ohms, spec.tolerance);
      expect(bands, key).toHaveLength(4);
      const back = decode(bands);
      expect(Math.abs(back.ohms - spec.ohms), key).toBeLessThanOrEqual(1e-9 * spec.ohms);
      expect(back.tolerance, key).toBe(0.05);
      expect(bands[3], key).toBe('gold');
      // the first band is a digit from 1: a value never starts with black
      expect(bands[0], key).not.toBe('black');
    }
  });

  it('takes the other tolerances and the small multipliers', () => {
    expect(resistorBands(0.47, 0.1)).toEqual(['yellow', 'violet', 'silver', 'silver']);
    expect(resistorBands(2200, 0.01)).toEqual(['red', 'red', 'red', 'brown']);
    expect(resistorBands(56e3, 0.02)).toEqual(['green', 'blue', 'orange', 'red']);
  });

  it('refuses what four bands cannot say', () => {
    expect(() => resistorBands(4712, 0.05)).toThrow(RangeError);
    expect(() => resistorBands(0, 0.05)).toThrow(RangeError);
    expect(() => resistorBands(Number.NaN, 0.05)).toThrow(RangeError);
    expect(() => resistorBands(1e11, 0.05)).toThrow(RangeError);
    expect(() => resistorBands(4700, 0.07)).toThrow(RangeError);
  });
});

describe('capacitorCode — two digits and the number of zeros in picofarads (VISUAL §4.7)', () => {
  it('reads the examples of VISUAL and the catalog’s ceramic and film values', () => {
    expect(capacitorCode(1e-7)).toBe('104');
    expect(capacitorCode(1e-11)).toBe('100');
    expect(capacitorCode(100e-12)).toBe('101');
    expect(capacitorCode(1e-9)).toBe('102');
    expect(capacitorCode(10e-9)).toBe('103');
    expect(capacitorCode(1e-6)).toBe('105');
    expect(capacitorCode(4.7e-9)).toBe('472');
    expect(capacitorCode(22e-12)).toBe('220');
  });

  it('writes a value under 10 pF with the letter R for the decimal point', () => {
    expect(capacitorCode(4.7e-12)).toBe('4R7');
    expect(capacitorCode(1e-12)).toBe('1R0');
  });

  it('refuses what three digits cannot say', () => {
    expect(() => capacitorCode(4.71e-9)).toThrow(RangeError);
    expect(() => capacitorCode(0)).toThrow(RangeError);
    expect(() => capacitorCode(-1e-9)).toThrow(RangeError);
  });
});

describe('bandColor — the table of VISUAL §4.2, no hex', () => {
  const mix = (a: string, b: string, k: number) => col(a).lerp(col(b), k);
  const RECIPES: Record<BandColor, ReturnType<typeof col>> = {
    black: col('ink'),
    brown: mix('wireBrown', 'ink', 0.3),
    red: col('red'),
    orange: col('orange'),
    yellow: col('yellow'),
    green: col('green'),
    blue: col('blue'),
    violet: col('violet'),
    grey: col('steel'),
    white: col('white'),
    gold: col('amber').lerp(col('yellow'), 0.6).lerp(col('wireBrown'), 0.5),
    silver: mix('mist', 'sky', 0.2),
  };

  it('gives exactly the recipes, and only gold and silver shine as metal', () => {
    for (const [name, want] of Object.entries(RECIPES) as [BandColor, ReturnType<typeof col>][]) {
      const got = bandColor(name);
      expect([got.r, got.g, got.b], name).toEqual([want.r, want.g, want.b]);
    }
    expect([...BAND_METAL].sort()).toEqual(['gold', 'silver']);
  });

  it('writes into the colour it is given', () => {
    const out = col('white');
    expect(bandColor('blue', out)).toBe(out);
    expect(out.equals(col('blue'))).toBe(true);
  });
});
