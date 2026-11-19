/**
 * Helpers shared by the tests of the model. They are written apart from the model (only the size of the screen
 * comes from the standard, and the test frame comes from the reference model), so a test compares the model with
 * an independent calculation.
 */
import frame from '../__fixtures__/test-frame.json';
import { COLS, ROWS } from '../standard';

if (frame.cols !== COLS || frame.rows !== ROWS || frame.luma.length !== COLS * ROWS)
  throw new Error(`test-frame.json is not a frame of ${COLS} × ${ROWS} cells`);

/**
 * The test frame of the reference model (tools/ref-models/radio/fm_chain.py writes it): brightness 0…255 of
 * 128 × 96 cells, row 0 on top, cell (c, r) at `r * 128 + c`.
 */
export const FRAME: Uint8Array = Uint8Array.from(frame.luma);

/**
 * Where the parts of the test frame are. `wall` (255), `nook` (0), `pickets` (one cell wide: even columns 255, odd
 * ones 0) and `ramp` (grey, 0 on the left … 255 on the right) are [first column, first row, last column, last row],
 * both ends inside; `spot` (255 on the forehead of the cat, which is 90) is one cell, [column, row].
 */
export const PLACES = frame.places;

/**
 * 1 for a flat cell of the test frame, 0 for the rest. A cell is flat when both its neighbours in the row differ
 * from it by 8 at most; the first and the last column are never flat.
 */
export const FLAT: Uint8Array = (() => {
  const flat = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 1; c < COLS - 1; c++) {
      const i = r * COLS + c;
      if (Math.abs(FRAME[i]! - FRAME[i - 1]!) <= 8 && Math.abs(FRAME[i]! - FRAME[i + 1]!) <= 8) flat[i] = 1;
    }
  return flat;
})();

/** Gain of a filter at the frequency `f` (a fraction of the sample rate), dB: 20·lg|Σ h[k]·e^(−j2πfk)|. */
export function gainDb(h: ArrayLike<number>, f: number): number {
  let re = 0;
  let im = 0;
  for (let k = 0; k < h.length; k++) {
    const a = -2 * Math.PI * f * k;
    re += h[k]! * Math.cos(a);
    im += h[k]! * Math.sin(a);
  }
  return 20 * Math.log10(Math.hypot(re, im));
}

export function mean(x: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]!;
  return sum / x.length;
}

/** Standard deviation of the whole array (division by its length). */
export function std(x: ArrayLike<number>): number {
  const m = mean(x);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i]! - m) ** 2;
  return Math.sqrt(sum / x.length);
}

/** The part of the values, 0…1, for which `when` holds. */
export function share(x: ArrayLike<number>, when: (v: number) => boolean): number {
  let count = 0;
  for (let i = 0; i < x.length; i++) if (when(x[i]!)) count++;
  return count / x.length;
}

/** Index of the largest value (the first of them). */
export function argmax(x: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < x.length; i++) if (x[i]! > x[best]!) best = i;
  return best;
}

/** The largest value minus the smallest. */
export function spread(x: ArrayLike<number>): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < x.length; i++) {
    lo = Math.min(lo, x[i]!);
    hi = Math.max(hi, x[i]!);
  }
  return hi - lo;
}

/** Centre of mass of the brightness of row `r` of a 128 × 96 screen, in columns; NaN for a black row. */
export function centre(screen: ArrayLike<number>, r: number): number {
  let mass = 0;
  let moment = 0;
  for (let c = 0; c < COLS; c++) {
    const v = screen[r * COLS + c]!;
    mass += v;
    moment += c * v;
  }
  return moment / mass;
}

/** Mean re² + im² of the pairs (I, Q), dBm; no floor: silence gives −Infinity, no pairs give NaN. */
export function meanPowerDbm(points: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i + 1 < points.length; i += 2) sum += points[i]! ** 2 + points[i + 1]! ** 2;
  return 10 * Math.log10(sum / (points.length >> 1));
}
