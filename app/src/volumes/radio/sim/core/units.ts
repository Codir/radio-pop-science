/**
 * Units of the model. Amplitude is measured in √mW: for a pair (re, im) the power is re² + im² mW, so a level
 * in dBm is 10·lg of that power, or 20·lg of the amplitude. No level is reported below −200 dBm.
 */
const FLOOR_DBM = -200;

/** Amplitude in √mW of a level in dBm: 10^(dbm/20). */
export function dbmToAmp(dbm: number): number {
  return 10 ** (dbm / 20);
}

/** Level in dBm of an amplitude in √mW: 20·lg(amp), never below −200. */
export function ampToDbm(amp: number): number {
  return Math.max(FLOOR_DBM, 20 * Math.log10(amp));
}

/**
 * Mean power of the pairs [from, to) of a block, dBm; `from` and `to` count pairs and default to the whole
 * block. A silent or empty stretch gives −200. A NaN in the block (or a stretch outside it) gives NaN: the
 * caller should see it, not a plausible level.
 */
export function powerDbm(x: Float32Array, from = 0, to = x.length >> 1): number {
  const pairs = to - from;
  if (!(pairs > 0)) return FLOOR_DBM;
  let sum = 0;
  for (let i = 2 * from, end = 2 * to; i < end; i += 2) {
    const re = x[i]!;
    const im = x[i + 1]!;
    sum += re * re + im * im;
  }
  return Math.max(FLOOR_DBM, 10 * Math.log10(sum / pairs));
}
