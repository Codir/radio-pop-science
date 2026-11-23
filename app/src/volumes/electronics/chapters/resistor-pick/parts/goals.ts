/**
 * How long each goal's state of the chapter holds before it counts: the script's «Ціль». The goals' maths (rows, the
 * tally of held readings) is the bench's chapters' own: `@electronics/shared/steps`.
 */

/** How long a goal's state holds before it counts (s). */
export const HOLD = {
  /** Every value of `series` that counts, every reading of `calc` and `on`. */
  reading: 1,
  /** `power`: each resistor with its readings. */
  power: 2,
  /** `burn`: after the resistor burnt. */
  burnt: 1,
} as const;
