/**
 * The marks the parts carry as data (docs/volumes/electronics/VISUAL.md §4.2, §4.7): the four colour bands of a
 * resistor (IEC 60062) from its value, the three-digit code of a ceramic or film capacitor, and the colours of the
 * bands — exactly the recipes of VISUAL's table, gold and silver derived from tokens.
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { E12, E24, PARTS, resistorKey } from '@electronics/sim/core';
import {
  BAND_METAL,
  bandAt,
  bandColor,
  capacitorCode,
  nearestInSeries,
  resistorBands,
  seriesValues,
  type BandColor,
} from '../code';
import { AXIAL_Y } from '../part';
import { RESISTOR, createResistor } from '../resistor';
import { buildPart } from '..';

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

describe('nearestInSeries — the neighbours of a value in the series E12 and E24 (IEC 60063)', () => {
  it('gives 330 and 360 Ω around 352.5 Ω in E24, 330 and 390 Ω in E12, with their catalog keys', () => {
    const e24 = nearestInSeries(352.5, 'E24');
    expect(e24.below).toEqual({ ohms: 330, key: 'resistor-330' });
    expect(e24.above).toEqual({ ohms: 360, key: 'resistor-360' });
    // the nearer of the two on the series' own scale, the logarithm: 352.5 / 330 = 1.068, 360 / 352.5 = 1.021
    expect(e24.nearest).toEqual(e24.above);
    const e12 = nearestInSeries(352.5, 'E12');
    expect(e12.below).toEqual({ ohms: 330, key: 'resistor-330' });
    expect(e12.above).toEqual({ ohms: 390, key: 'resistor-390' });
    expect(e12.nearest).toEqual(e12.below);
  });

  it('is the value itself when it is in the series, across decades, and null beyond the catalog', () => {
    const at = nearestInSeries(4700, 'E12');
    expect(at.below).toEqual({ ohms: 4700, key: 'resistor-4k7' });
    expect(at.above).toEqual(at.below);
    expect(at.nearest).toEqual(at.below);
    // across a decade: 9.5 kΩ lies between 9.1 kΩ and 10 kΩ
    expect(nearestInSeries(9500, 'E24')).toMatchObject({ below: { ohms: 9100 }, above: { ohms: 10_000 } });
    expect(nearestInSeries(9500, 'E12')).toMatchObject({ below: { ohms: 8200 }, above: { ohms: 10_000 } });
    // the catalog runs from 1 Ω to 10 MΩ
    expect(nearestInSeries(0.5, 'E24')).toMatchObject({ below: null, above: { ohms: 1, key: 'resistor-1' } });
    expect(nearestInSeries(0.5, 'E24').nearest).toEqual(nearestInSeries(0.5, 'E24').above);
    expect(nearestInSeries(2e7, 'E24')).toMatchObject({ below: { ohms: 1e7 }, above: null });
    expect(() => nearestInSeries(Number.NaN, 'E24')).toThrow(RangeError);
    expect(() => nearestInSeries(-5, 'E12')).toThrow(RangeError);
  });

  it('finds, for every value of the catalog, the series’ own neighbours (a check against the digits of IEC 60063)', () => {
    for (const series of ['E12', 'E24'] as const) {
      const digits = series === 'E12' ? E12 : E24;
      const values = seriesValues(series, 1, 1e7);
      for (const [key, spec] of Object.entries(PARTS)) {
        if (spec.kind !== 'resistor') continue;
        const n = nearestInSeries(spec.ohms * 1.01, series);
        expect(n.below!.ohms, key).toBeLessThanOrEqual(spec.ohms * 1.01);
        expect(n.above === null || n.above.ohms >= spec.ohms * 1.01, key).toBe(true);
        // no value of the series lies between the two neighbours
        expect(values.filter((v) => v > n.below!.ohms && v < (n.above?.ohms ?? Infinity)), key).toEqual([]);
        expect(digits.includes(Math.round(n.below!.ohms / 10 ** Math.floor(Math.log10(n.below!.ohms) - 1))), key).toBe(
          true,
        );
      }
    }
  });
});

describe('seriesValues — the values of a series between two bounds, as the catalog has them', () => {
  it('gives the 25 values of E24 from 100 Ω to 1 kΩ, both ends included, and every one a catalog key', () => {
    const v = seriesValues('E24', 100, 1000);
    expect(v).toHaveLength(25);
    expect(v.slice(0, 4)).toEqual([100, 110, 120, 130]);
    expect(v.slice(-3)).toEqual([820, 910, 1000]);
    for (const ohms of v) expect(() => resistorKey(ohms)).not.toThrow();
    // E12 is every second value of E24
    expect(seriesValues('E12', 100, 1000)).toEqual(v.filter((_, i) => i % 2 === 0));
    expect(seriesValues('E24', 100, 10_000)).toHaveLength(49);
    expect(seriesValues('E24', 1, 1e7)).toHaveLength(169);
    expect(seriesValues('E24', 340, 350)).toEqual([]);
  });
});

describe('bandAt — which band of a resistor a point on its body is nearest', () => {
  const m = createResistor(330, 0.05, 'resistor-330');
  const L = RESISTOR.length;
  /** x in the body frame of a point `u` from the body's end by leg 0. */
  const x = (u: number) => u - L / 2;

  it('reads the bands by their middles (VISUAL §4.2: 0.135, 0.235, 0.335 and 0.595 from the end by leg 0)', () => {
    const table: [number, number | null][] = [
      [0, 0], // the end by leg 0: the first band is the nearest
      [0.135, 0],
      [0.18, 0], // a hair nearer the first than the second
      [0.19, 1],
      [0.235, 1],
      [0.284, 1],
      [0.286, 2],
      [0.335, 2],
      [0.365, 2], // the middle of the body: still the multiplier
      [0.464, 2],
      [0.466, 3], // past halfway to the tolerance's band
      [0.595, 3],
      [L, 3], // the end by leg 1
    ];
    for (const [u, band] of table) expect(bandAt(x(u), m), `u ${u}`).toBe(band);
  });

  it('is null off the body, and for a part that has no bands', () => {
    expect(bandAt(x(-0.01), m)).toBeNull();
    expect(bandAt(x(L + 0.01), m)).toBeNull();
    expect(bandAt(Number.NaN, m)).toBeNull();
    expect(bandAt(0, buildPart('led-red')!)).toBeNull();
    expect(bandAt(0, buildPart('diode-1n4148')!)).toBeNull();
  });

  it('follows the body frame: a point on a resistor turned end for end reads from its own leg 0', () => {
    const r = buildPart('resistor-4k7')!;
    // leg 0 now on the right (`fit` turns the body with its tips)
    r.fit([r.nominal[1]!.clone(), r.nominal[0]!.clone()]);
    r.group.updateWorldMatrix(true, true);
    const first = r.bodyGroup.localToWorld(new Vector3(x(0.135), AXIAL_Y, 0));
    expect(first.x).toBeGreaterThan(0.6); // nearer leg 0, at 1.2
    expect(bandAt(r.bodyGroup.worldToLocal(first.clone()).x, r)).toBe(0);
    const last = r.bodyGroup.localToWorld(new Vector3(x(0.595), AXIAL_Y, 0));
    expect(last.x).toBeLessThan(0.6);
    expect(bandAt(r.bodyGroup.worldToLocal(last.clone()).x, r)).toBe(3);
  });
});
