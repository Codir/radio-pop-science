/**
 * How long each goal's state of the chapter holds before it counts: the script's «Ціль». The goals' maths (rows, the
 * tally of held readings) is the bench's chapters' own: `@electronics/shared/steps`.
 */

/** How long a goal's state holds before it counts (s). */
export const HOLD = {
  /** `flash`: after the LED burnt. */
  burnt: 1,
  /** `limit`: the LED lit and whole. */
  lit: 2,
  /** Every reading of the multimeter that counts (`ohm`, `law`, `share`, `amp`) and every value inside (`inside`). */
  reading: 1,
} as const;
