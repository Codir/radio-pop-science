/**
 * Frequency modulation: the camera's transmitter and the receiving side of the monitor.
 *
 * The transmitter turns the signal u into a turning arrow of length 1: every channel sample the arrow turns by
 * radPerSample(u), so its frequency follows the brightness. The monitor has two detectors that the course compares.
 * The slope detector (the household monitor's default) is a tuned circuit set off the carrier: its response grows
 * with the frequency, and the length of what comes out is the picture. Because it reads a length, it also reads
 * whatever ripples the length of the arrow — fading, noise, a neighbour — unless the limiter first brings every pair
 * to length 1. The angle detector (the digital one) reads the turn itself, angle(x[n]·conj(x[n − 1])), and does
 * not look at the length at all.
 *
 * Nothing here draws a fault. Clicks, the threshold of FM and stripes from a rippled length are what this
 * arithmetic makes of a noisy or damaged signal.
 */
import { type Block, createFir, designLowpass } from './dsp';
import { DEVIATION, radPerSample } from './standard';

const PI = Math.PI;
const TWO_PI = 2 * Math.PI;
/** The channel rate in real Hz, the one radPerSample counts with (FS_CH × K). */
const REAL_RATE = 20e6;

/** The pole r·e^(jθ) of the slope detector's tuned circuit: y[n] = x[n] + r·e^(jθ)·y[n − 1]. */
export const SLOPE = { r: 0.2, theta: (82 * Math.PI) / 180 } as const;
/** Where the sync pulses are cut: halfway between the bottom of a pulse and black at the output of each detector. */
export const SYNC_THRESHOLD = { slope: 0.226, angle: 0.15 } as const;
/** The floor of the limiter, dBm (a decision of the plan): a weaker pair is divided by the floor, not brought to 1. */
export const LIMITER_FLOOR_DBM = -100;
/** The filter after the detector: 31 taps, the cutoff 5.5 MHz of 20 (a fraction of the channel rate). */
export const VIDEO_TAPS = 31,
  VIDEO_CUTOFF = 0.275;

/** The settled length of the slope detector's y for a constant u: 1/|1 − r·e^(j(θ − ω))|, ω = radPerSample(u). */
function settled(u: number): number {
  const a = SLOPE.theta - radPerSample(u);
  return 1 / Math.hypot(1 - SLOPE.r * Math.cos(a), SLOPE.r * Math.sin(a));
}

/** The straight line gain·|y| + offset that puts the settled output of black at 0.3 and of white at 1. */
const SLOPE_GAIN = (1 - 0.3) / (settled(1) - settled(0.3));
const SLOPE_OFFSET = 0.3 - SLOPE_GAIN * settled(0.3);
const POLE_RE = SLOPE.r * Math.cos(SLOPE.theta);
const POLE_IM = SLOPE.r * Math.sin(SLOPE.theta);

/** The settled output of the slope detector for a constant u. */
export function slopeStatic(u: number): number {
  return SLOPE_GAIN * settled(u) + SLOPE_OFFSET;
}

/**
 * The transmitter: u → pairs of length 1. The phase φ is kept in double precision within ±π and grows by
 * radPerSample(u[n]) before each sample, so after `reset()` the first pair is already turned from (1, 0);
 * it goes on from call to call.
 */
export function createModulator(): Block {
  let phase = 0;
  return {
    process(u, out) {
      const step = radPerSample;
      const pi = PI;
      const twoPi = TWO_PI;
      let phi = phase;
      for (let n = 0, count = u.length; n < count; n++) {
        phi += step(u[n]!);
        if (phi > pi || phi < -pi) phi -= twoPi * Math.round(phi / twoPi);
        out[2 * n] = Math.cos(phi);
        out[2 * n + 1] = Math.sin(phi);
      }
      phase = phi;
    },
    reset() {
      phase = 0;
    },
  };
}

/**
 * The angle detector: pairs → u. The turn from the pair before, angle(x[n]·conj(x[n − 1])), read back as u:
 * u = (turn·20e6/2π − DEVIATION.atSync)/DEVIATION.span. The length of the pairs does not matter. After `reset()`
 * the pair before the first one is (1, 0).
 */
export function createAngleDetector(): Block {
  let lastRe = 1;
  let lastIm = 0;
  return {
    process(x, out) {
      const hzPerRad = REAL_RATE / TWO_PI;
      const atSync = DEVIATION.atSync;
      const span = DEVIATION.span;
      let re0 = lastRe;
      let im0 = lastIm;
      for (let n = 0, count = x.length >> 1; n < count; n++) {
        const re = x[2 * n]!;
        const im = x[2 * n + 1]!;
        out[n] = (Math.atan2(im * re0 - re * im0, re * re0 + im * im0) * hzPerRad - atSync) / span;
        re0 = re;
        im0 = im;
      }
      lastRe = re0;
      lastIm = im0;
    },
    reset() {
      lastRe = 1;
      lastIm = 0;
    },
  };
}

/**
 * The limiter, in place: a pair at least `floor` long gets the length 1, a shorter one is divided by `floor`, so
 * silence stays silence and the faintest pairs are not blown up to full length. The angle of a pair is kept.
 * `floor` is a length in √mW (LIMITER_FLOOR_DBM as an amplitude); one that is not a positive finite number is a
 * RangeError.
 */
export function limit(x: Float32Array, floor: number): void {
  if (!(floor > 0 && floor < Infinity)) throw new RangeError(`limit: floor ${floor}`);
  const least = floor * floor;
  const below = 1 / floor;
  for (let i = 0, end = x.length - 1; i < end; i += 2) {
    const re = x[i]!;
    const im = x[i + 1]!;
    const power = re * re + im * im;
    const k = power >= least ? 1 / Math.sqrt(power) : below;
    x[i] = re * k;
    x[i + 1] = im * k;
  }
}

/**
 * The slope detector: pairs → the picture. A tuned circuit of one pole, y[n] = x[n] + r·e^(jθ)·y[n − 1], set at
 * θ = 82°, above every frequency of the signal: the nearer the frequency comes to it, the longer y. The output is
 * gain·|y| + offset, the line that puts black at 0.3 and white at 1 (computed when the module loads, from the
 * settled lengths of black and white). y is kept in double precision; after `reset()` it is 0.
 */
export function createSlopeDetector(): Block {
  let lastRe = 0;
  let lastIm = 0;
  return {
    process(x, out) {
      const poleRe = POLE_RE;
      const poleIm = POLE_IM;
      const gain = SLOPE_GAIN;
      const offset = SLOPE_OFFSET;
      let re0 = lastRe;
      let im0 = lastIm;
      for (let n = 0, count = x.length >> 1; n < count; n++) {
        const re = x[2 * n]! + poleRe * re0 - poleIm * im0;
        const im = x[2 * n + 1]! + poleRe * im0 + poleIm * re0;
        out[n] = gain * Math.sqrt(re * re + im * im) + offset;
        re0 = re;
        im0 = im;
      }
      lastRe = re0;
      lastIm = im0;
    },
    reset() {
      lastRe = 0;
      lastIm = 0;
    },
  };
}

/** The filter of the video signal after either detector: a low-pass of VIDEO_TAPS taps cut at 5.5 MHz. */
export function createVideoFilter(): Block {
  return createFir(designLowpass(VIDEO_TAPS, VIDEO_CUTOFF));
}
