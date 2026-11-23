/**
 * The words the chapter's panel composes from numbers (`parts/bands.ts`, `parts/readouts.ts`): the table of the bands
 * of `bands` (what each band says, shown once it was chosen), the tolerance's span of `series`, the stops of its
 * slider, and the readouts of `power` and `burn` (the voltage with four significant digits like the multimeter, the
 * power in watts with three decimals, the state by the model's condition). The captions themselves are the script's
 * (`__tests__/manifest.test.ts`); here they are stand-ins.
 */
import { describe, expect, it } from 'vitest';
import { resistorBands } from '@electronics/shared/parts';
import { PARTS } from '@electronics/sim/core';
import { bandMeaning, bandRows, seriesStops, toleranceSpan } from '../parts/bands';
import { conditionText, voltsText, wattsText } from '../parts/readouts';

const NBSP = String.fromCharCode(160);
const plain = (s: string): string => s.split(NBSP).join(' ');

describe('the bands of a resistor and what each says', () => {
  it('reads 330 Ω as 3, 3, one zero and 5 %; 4,7 kΩ as 4, 7, two zeros and 5 %', () => {
    const b330 = resistorBands(330, 0.05);
    expect([0, 1, 2, 3].map((i) => plain(bandMeaning(b330, i, 0.05)))).toEqual(['3', '3', '1', '5 %']);
    const b4k7 = resistorBands(4700, 0.05);
    expect([0, 1, 2, 3].map((i) => plain(bandMeaning(b4k7, i, 0.05)))).toEqual(['4', '7', '2', '5 %']);
    // a multiplier below one has no count of zeros the table could show
    expect(() => bandMeaning(resistorBands(4.7, 0.05), 2, 0.05)).toThrow(RangeError);
  });

  it('fills a row once its band was chosen, «—» before; the role of each row always', () => {
    const bands = resistorBands(330, 0.05);
    const words = {
      role: (i: number) => ['d1', 'd2', 'zeros', 'tol'][i]!,
      colour: (c: string) => `<${c}>`,
      none: '—',
    };
    expect(bandRows(bands, new Set(), words, 0.05)).toEqual([
      ['d1', '—', '—'],
      ['d2', '—', '—'],
      ['zeros', '—', '—'],
      ['tol', '—', '—'],
    ]);
    expect(bandRows(bands, new Set([0, 2, 3]), words, 0.05).map((r) => r.map(plain))).toEqual([
      ['d1', '<orange>', '3'],
      ['d2', '—', '—'],
      ['zeros', '<brown>', '1'],
      ['tol', '<gold>', '5 %'],
    ]);
  });
});

describe('the series of `series`', () => {
  it('has the 25 values of E24 from 100 Ω to 1 kΩ, each a resistor of the catalog, none between 330 and 360 Ω', () => {
    const stops = seriesStops();
    expect(stops).toHaveLength(25);
    expect(stops[0]).toBe(100);
    expect(stops.at(-1)).toBe(1000);
    expect(stops.filter((v) => v > 330 && v < 360)).toEqual([]);
    expect(stops).toContain(330);
    expect(stops).toContain(360);
    for (let i = 1; i < stops.length; i++) expect(stops[i]! / stops[i - 1]!).toBeGreaterThan(1.06);
  });

  it('gives the span of 5 % around a value: 313,5 … 346,5 Ω for 330 Ω, 342 … 378 Ω for 360 Ω', () => {
    expect(PARTS['resistor-330']).toMatchObject({ tolerance: 0.05 });
    expect(toleranceSpan(330, 0.05, 'from', 'to').split(NBSP).join(' ')).toBe('from 313,5 Ω to 346,5 Ω');
    expect(toleranceSpan(360, 0.05, 'from', 'to').split(NBSP).join(' ')).toBe('from 342 Ω to 378 Ω');
    expect(plain(toleranceSpan(100, 0.05, 'a', 'b'))).toBe('a 95 Ω b 105 Ω');
    expect(plain(toleranceSpan(1000, 0.05, 'a', 'b'))).toBe('a 950 Ω b 1050 Ω');
  });
});

describe('the readouts of `power` and `burn`', () => {
  it('shows the voltage on the resistor with four significant digits, by its size; «—» without one', () => {
    expect(plain(voltsText(7.0076))).toBe('7,008 V');
    expect(plain(voltsText(-7.1693))).toBe('7,169 V');
    expect(plain(voltsText(8.8667))).toBe('8,867 V');
    expect(voltsText(null)).toBe('—');
    expect(voltsText(Number.NaN)).toBe('—');
  });

  it('shows the power in watts with three decimals; «—» without one', () => {
    expect(plain(wattsText(0.14881))).toBe('0,149 W');
    expect(plain(wattsText(0.0514))).toBe('0,051 W');
    expect(plain(wattsText(0.7862))).toBe('0,786 W');
    expect(plain(wattsText(0))).toBe('0,000 W');
    expect(plain(wattsText(-1e-12))).toBe('0,000 W');
    expect(wattsText(undefined)).toBe('—');
  });

  it('names the state by the model’s condition; «—» for one the step has no word for', () => {
    const words = { ok: 'cold', warm: 'warm' };
    expect(conditionText('ok', words)).toBe('cold');
    expect(conditionText('warm', words)).toBe('warm');
    expect(conditionText('hot', words)).toBe('—');
    expect(conditionText(null, words)).toBe('—');
  });
});
