/**
 * Blocks the signal chain is built from: low-pass filters with memory, a decimator, an interpolator,
 * a frequency shift and a fractional delay.
 *
 * A signal is a Float32Array: real samples, or pairs [re0, im0, re1, im1, …]. Every block with memory continues
 * the stream of its previous call (the model is continuous between frames), sums its taps in one fixed order,
 * so the output does not depend on how the stream is cut into calls, and after `reset()` repeats its output
 * bit for bit. `process` and `add` allocate nothing. The output array must not overlap the input and must be
 * long enough: writes past its end are lost silently.
 */

export interface Block {
  /** Takes all of `x` and writes the matching stretch of `out`, from its start. */
  process(x: Float32Array, out: Float32Array): void;
  /** Forgets the stream so far. */
  reset(): void;
}

const TWO_PI = 2 * Math.PI;

/** sin(πt)/(πt), exactly 0 at the other whole numbers. */
function sinc(t: number): number {
  if (t === 0) return 1;
  return Number.isInteger(t) ? 0 : Math.sin(Math.PI * t) / (Math.PI * t);
}

/** Slides the newest numbers of `x` into `past`; the newest end up at its end. */
function remember(past: Float32Array, x: Float32Array): void {
  const keep = past.length;
  const n = x.length;
  if (n >= keep) {
    for (let i = 0; i < keep; i++) past[i] = x[n - keep + i]!;
  } else {
    past.copyWithin(0, n);
    for (let i = 0; i < n; i++) past[keep - n + i] = x[i]!;
  }
}

/**
 * Low-pass filter by the window method: h[k] = 2c·sinc(2c·(k − (N − 1)/2))·(0.54 − 0.46·cos(2πk/(N − 1))),
 * then divided by the sum, so the gain at zero frequency is 1. `cutoff` c is a fraction of the sample rate
 * (the gain there is −6 dB). The taps are symmetric: the filter delays by (N − 1)/2 samples.
 */
export function designLowpass(taps: number, cutoff: number): Float32Array {
  if (!Number.isInteger(taps) || taps < 2) throw new RangeError(`designLowpass: ${taps} taps`);
  if (!(cutoff > 0 && cutoff <= 0.5)) throw new RangeError(`designLowpass: cutoff ${cutoff}`);
  const middle = (taps - 1) / 2;
  const h = new Float64Array(taps);
  for (let k = 0; k <= middle; k++) {
    const hamming = 0.54 - 0.46 * Math.cos((TWO_PI * k) / (taps - 1));
    h[k] = h[taps - 1 - k] = 2 * cutoff * sinc(2 * cutoff * (k - middle)) * hamming;
  }
  let sum = 0;
  for (let k = 0; k < taps; k++) sum += h[k]!;
  const out = new Float32Array(taps);
  for (let k = 0; k < taps; k++) out[k] = h[k]! / sum;
  return out;
}

/** A filter of real samples: out[n] = Σ h[i]·x[n − i]. */
export function createFir(h: Float32Array): Block {
  const taps = Float64Array.from(h);
  const count = taps.length;
  const keep = count - 1;
  const past = new Float32Array(keep); // the inputs before this call, the newest last
  return {
    process(x, out) {
      const n = x.length;
      let k = 0;
      // the first outputs of a call still reach into the inputs of the calls before
      for (; k < n && k < keep; k++) {
        let acc = 0;
        for (let i = 0; i <= k; i++) acc += taps[i]! * x[k - i]!;
        for (let i = k + 1; i < count; i++) acc += taps[i]! * past[keep + k - i]!;
        out[k] = acc;
      }
      for (; k < n; k++) {
        let acc = 0;
        for (let i = 0, j = k; i < count; i++, j--) acc += taps[i]! * x[j]!;
        out[k] = acc;
      }
      remember(past, x);
    },
    reset() {
      past.fill(0);
    },
  };
}

/**
 * A filter of pairs that keeps every m-th output: out[k] = Σ h[i]·x[m·k − i], where pair 0 is the first pair
 * after `reset()`. With m = 1 it is a plain filter of pairs. A call must bring a whole number of m pairs
 * (otherwise RangeError), so the count never has to be carried from call to call.
 */
export function createDecimator(h: Float32Array, m: number): Block {
  if (!Number.isInteger(m) || m < 1) throw new RangeError(`createDecimator: every ${m}-th`);
  const taps = Float64Array.from(h);
  const count = taps.length;
  const keep = count - 1;
  const past = new Float32Array(2 * keep); // the pairs before this call, the newest last
  return {
    process(x, out) {
      if (x.length % (2 * m) !== 0) {
        throw new RangeError(`decimator by ${m}: ${x.length} numbers are not a whole number of ${m} pairs`);
      }
      const outputs = x.length / (2 * m);
      let k = 0;
      // the first outputs of a call still reach into the pairs of the calls before
      for (; k < outputs && m * k < keep; k++) {
        const at = m * k;
        let re = 0;
        let im = 0;
        for (let i = 0; i <= at; i++) {
          const j = 2 * (at - i);
          re += taps[i]! * x[j]!;
          im += taps[i]! * x[j + 1]!;
        }
        for (let i = at + 1; i < count; i++) {
          const j = 2 * (keep + at - i);
          re += taps[i]! * past[j]!;
          im += taps[i]! * past[j + 1]!;
        }
        out[2 * k] = re;
        out[2 * k + 1] = im;
      }
      for (; k < outputs; k++) {
        let re = 0;
        let im = 0;
        for (let i = 0, j = 2 * m * k; i < count; i++, j -= 2) {
          const tap = taps[i]!;
          re += tap * x[j]!;
          im += tap * x[j + 1]!;
        }
        out[2 * k] = re;
        out[2 * k + 1] = im;
      }
      remember(past, x);
    },
    reset() {
      past.fill(0);
    },
  };
}

/**
 * Pairs at a rate l times higher: y[n] = l·Σ h[n − l·k]·x[k], so a slow signal keeps its amplitude.
 * It works as l branches: output l·q + p is branch p, the taps h[p + l·j]·l over the inputs x[q − j].
 */
export function createInterpolator(h: Float32Array, l: number): Block {
  if (!Number.isInteger(l) || l < 1) throw new RangeError(`createInterpolator: ${l} times`);
  const longest = Math.ceil(h.length / l); // taps of branch 0, the longest one
  const branches = new Float64Array(l * longest);
  const lengths = new Int32Array(l);
  for (let p = 0; p < l; p++) {
    for (let j = 0; p + l * j < h.length; j++) {
      branches[p * longest + j] = h[p + l * j]! * l;
      lengths[p] = j + 1;
    }
  }
  const keep = longest - 1;
  const past = new Float32Array(2 * keep); // the pairs before this call, the newest last
  return {
    process(x, out) {
      const pairs = x.length >> 1;
      let q = 0;
      // the first outputs of a call still reach into the pairs of the calls before
      for (; q < pairs && q < keep; q++) {
        for (let p = 0; p < l; p++) {
          const base = p * longest;
          const count = lengths[p]!;
          let re = 0;
          let im = 0;
          for (let i = 0; i < count; i++) {
            const tap = branches[base + i]!;
            if (i <= q) {
              re += tap * x[2 * (q - i)]!;
              im += tap * x[2 * (q - i) + 1]!;
            } else {
              re += tap * past[2 * (keep + q - i)]!;
              im += tap * past[2 * (keep + q - i) + 1]!;
            }
          }
          out[2 * (l * q + p)] = re;
          out[2 * (l * q + p) + 1] = im;
        }
      }
      for (; q < pairs; q++) {
        for (let p = 0; p < l; p++) {
          const end = p * longest + lengths[p]!;
          let re = 0;
          let im = 0;
          for (let i = p * longest, j = 2 * q; i < end; i++, j -= 2) {
            const tap = branches[i]!;
            re += tap * x[j]!;
            im += tap * x[j + 1]!;
          }
          out[2 * (l * q + p)] = re;
          out[2 * (l * q + p) + 1] = im;
        }
      }
      remember(past, x);
    },
    reset() {
      past.fill(0);
    },
  };
}

const MIX_SIZE = 4096;
const MIX_SCALE = MIX_SIZE / TWO_PI;
/** 4096 pairs (cos, sin) round the circle. */
const MIX_TABLE = (() => {
  const table = new Float32Array(2 * MIX_SIZE);
  for (let i = 0; i < MIX_SIZE; i++) {
    table[2 * i] = Math.cos((TWO_PI * i) / MIX_SIZE);
    table[2 * i + 1] = Math.sin((TWO_PI * i) / MIX_SIZE);
  }
  return table;
})();

/**
 * Frequency shift: pair n of `x` is turned by phase + n·step radians and written to `out` (which may be `x`
 * itself). The turn is taken from a table of 4096 angles, the nearest to the phase; the phase itself is kept
 * in double precision within [0, 2π). Returns the phase for the next call. A phase or a step that is not a
 * finite number is a RangeError.
 */
export function mix(x: Float32Array, out: Float32Array, phase: number, step: number): number {
  if (!Number.isFinite(phase) || !Number.isFinite(step))
    throw new RangeError(`mix: phase ${phase}, step ${step}`);
  const table = MIX_TABLE;
  const scale = MIX_SCALE;
  const turn = step % TWO_PI;
  let angle = phase - Math.floor(phase / TWO_PI) * TWO_PI;
  if (angle >= TWO_PI) angle = 0; // a tiny negative phase rounds up to the full circle
  for (let i = 0, n = x.length - 1; i < n; i += 2) {
    const at = ((angle * scale + 0.5) & (MIX_SIZE - 1)) << 1;
    const cos = table[at]!;
    const sin = table[at + 1]!;
    const re = x[i]!;
    const im = x[i + 1]!;
    out[i] = re * cos - im * sin;
    out[i + 1] = re * sin + im * cos;
    angle += turn;
    if (angle >= TWO_PI) angle -= TWO_PI;
    else if (angle < 0) {
      angle += TWO_PI;
      if (angle >= TWO_PI) angle = 0;
    }
  }
  return angle;
}

/** Samples every delay line adds on top of the delay asked for; the same for all rays. */
export const DELAY_LATENCY = 5;
const DELAY_TAPS = 12;

/**
 * A delay line for one ray: `add` takes the next pairs of the stream `x` and adds them to `out`, delayed by
 * `delay` + DELAY_LATENCY samples and multiplied by the pair (re, im). `delay` is 0…max samples, a fraction
 * is allowed (otherwise RangeError). One line holds one stream: every ray needs a line of its own.
 *
 * The whole part of the delay is a shift of the index. The fraction is 12 taps
 * g[k] = sinc(k − D)·(0.54 + 0.46·cos(π(k − D)/6)), D = 5 + the fraction, with the sum brought to 1; they are
 * computed again only when the delay changes. Unlike linear interpolation this keeps the amplitude up to the
 * edges of the band (the error stays below −40 dB up to ±0.37 of the sample rate).
 */
export function createDelay(max: number): {
  add(x: Float32Array, out: Float32Array, delay: number, re: number, im: number): void;
  reset(): void;
} {
  if (!Number.isInteger(max) || max < 0) throw new RangeError(`createDelay: at most ${max} samples`);
  const keep = max + DELAY_TAPS - 1;
  const past = new Float32Array(2 * keep); // the pairs before this call, the newest last
  const taps = new Float64Array(DELAY_TAPS);
  let tapsFor = NaN; // the delay the taps are computed for
  let shift = 0; // its whole part
  return {
    add(x, out, delay, re, im) {
      if (!(delay >= 0 && delay <= max)) throw new RangeError(`delay ${delay} is outside 0…${max} samples`);
      if (delay !== tapsFor) {
        shift = Math.floor(delay);
        const centre = DELAY_LATENCY + (delay - shift);
        let sum = 0;
        for (let k = 0; k < DELAY_TAPS; k++) {
          taps[k] = sinc(k - centre) * (0.54 + 0.46 * Math.cos((Math.PI * (k - centre)) / 6));
          sum += taps[k]!;
        }
        for (let k = 0; k < DELAY_TAPS; k++) taps[k] /= sum;
        tapsFor = delay;
      }
      const pairs = x.length >> 1;
      const reach = shift + DELAY_TAPS - 1; // how many pairs back the oldest tap looks
      let n = 0;
      // the first outputs of a call still reach into the pairs of the calls before
      for (; n < pairs && n < reach; n++) {
        let a = 0;
        let b = 0;
        for (let k = 0; k < DELAY_TAPS; k++) {
          const at = n - shift - k;
          const tap = taps[k]!;
          if (at >= 0) {
            a += tap * x[2 * at]!;
            b += tap * x[2 * at + 1]!;
          } else {
            a += tap * past[2 * (keep + at)]!;
            b += tap * past[2 * (keep + at) + 1]!;
          }
        }
        out[2 * n] += re * a - im * b;
        out[2 * n + 1] += re * b + im * a;
      }
      for (; n < pairs; n++) {
        let a = 0;
        let b = 0;
        for (let k = 0, j = 2 * (n - shift); k < DELAY_TAPS; k++, j -= 2) {
          const tap = taps[k]!;
          a += tap * x[j]!;
          b += tap * x[j + 1]!;
        }
        out[2 * n] += re * a - im * b;
        out[2 * n + 1] += re * b + im * a;
      }
      remember(past, x);
    },
    reset() {
      past.fill(0);
    },
  };
}
