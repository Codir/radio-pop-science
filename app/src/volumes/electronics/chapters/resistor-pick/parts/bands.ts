/**
 * What the colour bands of a resistor say, as the panel of `bands` shows it (the script's table «Смужка · Колір · Що
 * означає»), and the series of values of `series` with the span its tolerance allows. Pure: the numbers are composed
 * here from the part's data (VISUAL §1, principle 4: a number with its unit is code), every word is the step's caption,
 * handed in.
 */
import { fmtPercent, fmtUnit } from '@/content';
import { seriesValues, type BandColor } from '@electronics/shared/parts';

/** The digit of a digit band (IEC 60062): black 0 … white 9. */
const DIGIT: Readonly<Partial<Record<BandColor, number>>> = {
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

/**
 * What band `i` of `bands` (digit, digit, multiplier, tolerance — `resistorBands`) says: a digit, the number of
 * zeros the multiplier adds, the tolerance in per cent. A multiplier below one (gold, silver) adds no zeros: the
 * table has nothing to say for it (no resistor of this chapter wears one), a RangeError.
 */
export function bandMeaning(bands: readonly BandColor[], i: number, tolerance: number): string {
  if (i === 3) return fmtPercent(tolerance);
  const digit = DIGIT[bands[i]!];
  if (digit === undefined) throw new RangeError(`band ${i} (${bands[i]}) is not a count`);
  return String(digit);
}

export interface BandWords {
  /** The name of the band's row: «перша цифра» … «точність». */
  role(i: number): string;
  /** The colour's name (the step's caption). */
  colour(c: BandColor): string;
  /** A cell of a band not chosen yet. */
  none: string;
}

/** The table's rows: the band's role, and once the band was chosen its colour and what it says. */
export function bandRows(
  bands: readonly BandColor[],
  seen: ReadonlySet<number>,
  words: BandWords,
  tolerance: number,
): string[][] {
  return bands.map((c, i) =>
    seen.has(i) ? [words.role(i), words.colour(c), bandMeaning(bands, i, tolerance)] : [words.role(i), words.none, words.none],
  );
}

/** The slider «Номінал» of `series`: the values of E24 from 100 Ω to 1 kΩ (25; `E24` of the catalog, IEC 60063). */
export const seriesStops = (): number[] => seriesValues('E24', 100, 1000);

/** «від 313,5 Ω до 346,5 Ω»: the span a resistor of `ohms` may have with its `tolerance` (the words handed in). */
export function toleranceSpan(ohms: number, tolerance: number, from: string, to: string): string {
  const at = (k: number): string => fmtUnit(ohms * k, 'Ω', { maxDigits: 1 });
  return `${from} ${at(1 - tolerance)} ${to} ${at(1 + tolerance)}`;
}
