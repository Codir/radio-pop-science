/**
 * The marks of the parts as data (docs/volumes/electronics/VISUAL.md §4.2, §4.7): the colour code of a resistor
 * (IEC 60062, four bands), the three-digit code printed on a ceramic or film capacitor, and the colours of the bands.
 * The palette has no gold, silver or band brown and the platform takes no new tokens, so those three are mixed from
 * tokens by VISUAL's recipes; there is no hex anywhere. Pure: no three.js beyond `Color`.
 */
import type { Color } from 'three';
import { col } from '@/style';

export type BandColor =
  | 'black'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'grey'
  | 'white'
  | 'gold'
  | 'silver';

/** The digit bands 0…9. */
const DIGITS: readonly BandColor[] = [
  'black',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'grey',
  'white',
];

/** The multiplier band by the power of ten: 10⁻² silver, 10⁻¹ gold, then the digits. */
const POWERS: ReadonlyMap<number, BandColor> = new Map([
  [-2, 'silver'],
  [-1, 'gold'],
  ...DIGITS.map((c, i) => [i, c] as const),
]);

/** The tolerance band by the tolerance as a share. */
const TOLERANCES: ReadonlyMap<number, BandColor> = new Map([
  [0.01, 'brown'],
  [0.02, 'red'],
  [0.05, 'gold'],
  [0.1, 'silver'],
]);

/** The two significant digits and the power of ten of a positive value: `value` = digits · 10^power, digits 10…99.
 * Null when two digits do not say it exactly (to a relative 1e-9). */
function twoDigits(value: number): { digits: number; power: number } | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  let power = Math.floor(Math.log10(value)) - 1;
  let digits = Math.round(value / 10 ** power);
  if (digits >= 100) {
    power += 1;
    digits = Math.round(value / 10 ** power);
  } else if (digits < 10) {
    power -= 1;
    digits = Math.round(value / 10 ** power);
  }
  if (digits < 10 || digits > 99 || Math.abs(digits * 10 ** power - value) > 1e-9 * value) return null;
  return { digits, power };
}

/**
 * The four bands of a resistor of `ohms` with the tolerance `tolerance` (a share, 0.05 = 5 %): digit, digit,
 * multiplier, tolerance — 4700 Ω, 5 % → yellow violet red gold; 1 Ω → brown black gold gold. A value two digits and a
 * multiplier from 10⁻² to 10⁹ cannot say, or a tolerance without a band, is a RangeError.
 */
export function resistorBands(ohms: number, tolerance: number): readonly BandColor[] {
  const v = twoDigits(ohms);
  const multiplier = v === null ? undefined : POWERS.get(v.power);
  const last = TOLERANCES.get(tolerance);
  if (v === null || multiplier === undefined || last === undefined) {
    throw new RangeError(`no four-band code for ${ohms} Ω, ${tolerance * 100} %`);
  }
  return [DIGITS[Math.floor(v.digits / 10)]!, DIGITS[v.digits % 10]!, multiplier, last];
}

/**
 * The code printed on a ceramic or film capacitor: two digits and the number of zeros after them in picofarads —
 * 100 nF → '104', 10 pF → '100'. Under 10 pF the letter R stands for the decimal point: 4.7 pF → '4R7'. A value the
 * code cannot say is a RangeError.
 */
export function capacitorCode(farads: number): string {
  const pf = farads * 1e12;
  if (Number.isFinite(pf) && pf > 0 && pf < 10) {
    const tenths = Math.round(pf * 10);
    if (Math.abs(tenths / 10 - pf) <= 1e-9 * pf && tenths >= 10) {
      return `${Math.floor(tenths / 10)}R${tenths % 10}`;
    }
  }
  const v = twoDigits(pf);
  if (v === null || v.power < 0 || v.power > 9) throw new RangeError(`no three-digit code for ${farads} F`);
  return `${v.digits}${v.power}`;
}

const mix = (a: string, b: string, k: number): Color => col(a).lerp(col(b), k);

/** VISUAL §4.2, «Кольори смужок»: a token or a mix of tokens for every band. */
const RECIPES: Readonly<Record<BandColor, Color>> = {
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
  // amber pulled toward yellow, away from orange, and darkened toward brown: a dark ochre, like metallic paint
  gold: mix('amber', 'yellow', 0.6).lerp(col('wireBrown'), 0.5),
  // mist with a touch of sky: lighter than the grey band, darker than the white one
  silver: mix('mist', 'sky', 0.2),
};

/** The bands that shine as metal (`K.metal`): a real gold or silver band glints, grey and white do not. */
export const BAND_METAL: ReadonlySet<BandColor> = new Set<BandColor>(['gold', 'silver']);

/** The colour of a band (linear, as `col` gives it). */
export function bandColor(c: BandColor, out?: Color): Color {
  return out ? out.copy(RECIPES[c]) : RECIPES[c].clone();
}
