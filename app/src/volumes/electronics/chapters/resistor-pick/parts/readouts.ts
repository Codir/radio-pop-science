/**
 * The panel's readouts of the resistor in a step's gap (`power`, `burn`; the script's «Бачимо»): the voltage on it with
 * four significant digits like the multimeter's display (`formatReading`), its power in watts with three decimals (its
 * state by the model's condition is `shared/steps` `conditionText`). «—» when there is nothing to read (no resistor,
 * or not exactly one, in the gap). Pure.
 */
import { fmtUnit } from '@/content';
import { formatReading } from '@electronics/shared/instruments';

export const NONE = '—';

const real = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** |u| with four significant digits: «7,008 V». The sign says only which leg stands to the + rail. */
export const voltsText = (u: number | null | undefined): string => (real(u) ? formatReading(Math.abs(u), 'V') : NONE);

/** p in watts with three decimals: «0,149 W»; a part solved out as a gap is «0,000 W». */
export const wattsText = (p: number | null | undefined): string =>
  real(p) ? fmtUnit(Math.abs(p) < 5e-4 ? 0 : Math.abs(p), 'W', { digits: 3 }) : NONE;
