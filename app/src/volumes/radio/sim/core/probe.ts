/**
 * The probe of the model: what the reader's probe shows at a tap of the chain, cut from the model's own buffers of
 * one frame. It draws nothing of its own; every number it gives is a sample of the tap or a power of its spectrum.
 *
 * A tap is a signal of one frame: `camera.video` (u on the camera's cable) and `rx.detected` (u after the detector
 * and the video filter) are real samples; `air.rx` (the band on the monitor's antenna) and `rx.shifted`,
 * `rx.limited` (the channel after the shift and after the limiter) are pairs. A request picks a part of the frame,
 * `start` and `span` (fractions of the frame), and one of three views:
 * - `strip` — the trace in time: the least and the largest sample in each column, the right shadow (re) of pairs;
 * - `scale` — the spectrum: the mean power of up to eight pieces of the transform's size spread over the part,
 *   the largest bin in each column, dBm, on real frequencies;
 * - `arrow` — the complex plane: the pairs (I, Q) themselves, every few samples; a real tap has none.
 */
import { type Fft, powerSpectrumDb } from './spectrum';
import { shown } from './standard';
import { ampToDbm } from './units';

/** Where the probe can touch the chain. */
export type TapId = 'camera.video' | 'air.rx' | 'rx.shifted' | 'rx.limited' | 'rx.detected';
/** How it shows what it touches: the trace in time, the spectrum, the complex plane. */
export type ProbeView = 'strip' | 'scale' | 'arrow';
/**
 * `start` and `span` are fractions of the frame, 0…1 (the shortest part is `PROBE_MIN_SAMPLES` samples of the
 * tap); `columns` is at most `PROBE_MAX_COLUMNS`. Values outside are clamped; a value that is not a number is a
 * RangeError.
 */
export interface ProbeRequest {
  tap: TapId;
  view: ProbeView;
  start: number;
  span: number;
  columns: number;
}
/** What the probe shows. The fields of the other views are arrays of length 0, and `fromHz = toHz = 0`. */
export interface ProbeData {
  tap: TapId;
  view: ProbeView;
  /** 'strip': the least and the largest value in each column; fewer than `columns` when the part has fewer samples. */
  lo: Float32Array;
  hi: Float32Array;
  /** 'scale': dBm in each column, never below −200. */
  bins: Float32Array;
  /** 'scale': the real frequencies of the edges, Hz; `fromHz` is the left edge of column 0. */
  fromHz: number;
  toHz: number;
  /** 'arrow': pairs (I, Q), at most `columns` of them; none for a real tap. */
  points: Float32Array;
}

/** Which taps are pairs (re, im); the others are real samples. */
export const TAP_PAIRS: Readonly<Record<TapId, boolean>> = Object.freeze({
  'camera.video': false,
  'air.rx': true,
  'rx.shifted': true,
  'rx.limited': true,
  'rx.detected': false,
});
export const PROBE_MAX_COLUMNS = 512,
  PROBE_MIN_SAMPLES = 16;

/** The scale averages the power of at most this many pieces. */
const PIECES = 8;
/** The lowest level the scale shows, dBm: the floor of units.ts. */
const FLOOR_DBM = ampToDbm(0);
const VIEWS: readonly ProbeView[] = ['strip', 'scale', 'arrow'];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

function checkNumber(name: string, v: unknown): void {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new RangeError(`probe: ${name} is ${String(v)}`);
}

/**
 * The model's probe. `read` cuts one view out of the taps of a frame: `rates` are the taps' rates, model Hz;
 * `centres` the real frequencies of the middles of the taps of pairs (the receiver's channel is a part of the
 * state, so it comes with each call); `fft` the transform of the scale. The arrays it returns live until the next
 * `read`.
 */
export function createProbe(): {
  read(
    req: ProbeRequest,
    taps: Record<TapId, Float32Array>,
    rates: Record<TapId, number>,
    centres: Record<TapId, number>,
    fft: Fft,
  ): ProbeData;
} {
  const lo = new Float32Array(PROBE_MAX_COLUMNS);
  const hi = new Float32Array(PROBE_MAX_COLUMNS);
  const bins = new Float32Array(PROBE_MAX_COLUMNS);
  const points = new Float32Array(2 * PROBE_MAX_COLUMNS);
  const none = new Float32Array(0);
  /** The scale: the largest power in each column, mW. */
  const top = new Float64Array(PROBE_MAX_COLUMNS);
  // the scale's work for one size of the transform: a block of pairs, its spectrum, the mean power of the pieces
  let size = 0;
  let block = none;
  let spectrum = none;
  let power = new Float64Array(0);
  // the window's gain over the last part shorter than the transform: its size, length and place in the block
  let padSize = 0;
  let padCount = 0;
  let padAt = 0;
  let padGain = 1;

  /** The least and the largest of each of `c` columns of the part [first, first + count). */
  function strip(x: Float32Array, step: number, first: number, count: number, c: number): void {
    for (let j = 0; j < c; j++) {
      const from = first + Math.floor((j * count) / c);
      const to = first + Math.floor(((j + 1) * count) / c);
      let a = x[from * step]!;
      let b = a;
      for (let n = from + 1; n < to; n++) {
        const v = x[n * step]!;
        a = Math.min(a, v); // Math.min, not <: a NaN of the model shows as NaN
        b = Math.max(b, v);
      }
      lo[j] = a;
      hi[j] = b;
    }
  }

  /** Up to `columns` pairs of the part, `⌈count/columns⌉` samples apart; returns how many. */
  function arrow(x: Float32Array, first: number, count: number, columns: number): number {
    const step = Math.ceil(count / columns);
    const m = Math.ceil(count / step);
    for (let k = 0; k < m; k++) {
      const i = 2 * (first + k * step);
      points[2 * k] = x[i]!;
      points[2 * k + 1] = x[i + 1]!;
    }
    return m;
  }

  /**
   * Puts `count` samples of `x` from `from` into `block` at `at`. A real sample gets im = 0 written beside it, so
   * nothing of a tap of pairs read before stays in the block.
   */
  function load(x: Float32Array, pairs: boolean, from: number, count: number, at: number): void {
    if (pairs) block.set(x.subarray(2 * from, 2 * (from + count)), 2 * at);
    else
      for (let n = 0; n < count; n++) {
        block[2 * (at + n)] = x[from + n]!;
        block[2 * (at + n) + 1] = 0;
      }
  }

  /** The spectrum of `block` added to `power` in mW; the floor of the spectrum counts as silence. */
  function addPower(fft: Fft): void {
    powerSpectrumDb(block, fft, spectrum);
    const floor = FLOOR_DBM;
    for (let b = 0; b < size; b++) {
      const db = spectrum[b]!;
      if (!(db <= floor)) power[b]! += 10 ** (db / 10); // a NaN of the model stays NaN
    }
  }

  /**
   * How much the window loses on a part of `count` samples put at `at` in an empty block: the level of a block of
   * ones there, read through the same spectrum at zero frequency, is (the window's sum over the part / its whole
   * sum)². Its inverse brings a tone in the padded block back to its own power.
   */
  function padding(fft: Fft, count: number, at: number): number {
    if (size !== padSize || count !== padCount || at !== padAt) {
      block.fill(0);
      for (let n = 0; n < count; n++) block[2 * (at + n)] = 1;
      powerSpectrumDb(block, fft, spectrum);
      padGain = 10 ** (-spectrum[size >> 1]! / 10);
      padSize = size;
      padCount = count;
      padAt = at;
    }
    return padGain;
  }

  /** The mean power of the part in `power`, mW per bin, in the order of frequency. */
  function averagePower(x: Float32Array, pairs: boolean, first: number, count: number, fft: Fft): void {
    if (fft.size !== size) {
      size = fft.size;
      block = new Float32Array(2 * size);
      spectrum = new Float32Array(size);
      power = new Float64Array(size);
    }
    power.fill(0);
    if (count >= size) {
      // at most eight pieces spread evenly, the first at the part's start, the last at its end; a short part takes
      // fewer, as many as it holds when each overlaps the next by at least half (Welch)
      const pieces = Math.min(PIECES, Math.ceil((2 * count) / size) - 1);
      for (let k = 0; k < pieces; k++) {
        const from = first + (pieces > 1 ? Math.round((k * (count - size)) / (pieces - 1)) : 0);
        load(x, pairs, from, size, 0);
        addPower(fft);
      }
      for (let b = 0; b < size; b++) power[b]! /= pieces;
    } else {
      // a short part in the middle of an empty block, where the window is near its top, its power multiplied by what
      // the window loses on it: a tone keeps its own level at any length of the part, while the mean noise in a bin
      // rises as the part shortens, as a shorter look resolves coarser (16 samples: about 16 dB over a whole frame)
      const at = (size - count) >> 1;
      const gain = padding(fft, count, at);
      block.fill(0);
      load(x, pairs, first, count, at);
      addPower(fft);
      for (let b = 0; b < size; b++) power[b]! *= gain;
    }
  }

  /**
   * The scale of `c` columns over `nb` bins from `power[offset]`: the largest bin of the transform in each column,
   * as it is. A real tap shows only the half of positive frequencies, its bins unchanged (two-sided: a real tone of
   * power P shows P/2, the other half is in its mirror image at the negative frequency, which is not shown).
   */
  function scale(c: number, nb: number, offset: number): void {
    top.fill(0, 0, c);
    for (let b = 0; b < nb; b++) {
      const j = Math.floor((b * c) / nb); // the column of the bin's frequency
      top[j] = Math.max(top[j]!, power[offset + b]!); // Math.max: a NaN of the model stays NaN
    }
    const floor = FLOOR_DBM;
    for (let j = 0; j < c; j++) bins[j] = Math.max(floor, 10 * Math.log10(top[j]!));
  }

  return {
    read(req, taps, rates, centres, fft) {
      const { tap, view } = req;
      if (!Object.hasOwn(TAP_PAIRS, tap)) throw new RangeError(`probe: no tap ${String(tap)}`);
      if (!VIEWS.includes(view)) throw new RangeError(`probe: no view ${String(view)}`);
      checkNumber('start', req.start);
      checkNumber('span', req.span);
      checkNumber('columns', req.columns);
      const x = taps[tap];
      if (!(x instanceof Float32Array)) throw new RangeError(`probe: tap ${tap} is not a Float32Array`);
      const pairs = TAP_PAIRS[tap];
      if (pairs && x.length % 2 !== 0)
        throw new RangeError(`probe: tap ${tap} of pairs has ${x.length} numbers`);
      const n = pairs ? x.length >> 1 : x.length;
      if (n < PROBE_MIN_SAMPLES) throw new RangeError(`probe: tap ${tap} has ${n} samples`);

      // the part of the frame and the number of columns
      const count = clamp(Math.round(req.span * n), PROBE_MIN_SAMPLES, n);
      const first = clamp(Math.floor(req.start * n), 0, n - count);
      const columns = clamp(Math.floor(req.columns), 1, PROBE_MAX_COLUMNS);

      const data: ProbeData = { tap, view, lo: none, hi: none, bins: none, fromHz: 0, toHz: 0, points: none };
      if (view === 'strip') {
        const c = Math.min(columns, count);
        strip(x, pairs ? 2 : 1, first, count, c);
        data.lo = lo.subarray(0, c);
        data.hi = hi.subarray(0, c);
      } else if (view === 'arrow') {
        if (pairs) data.points = points.subarray(0, 2 * arrow(x, first, count, columns));
      } else {
        const rate = rates[tap];
        if (typeof rate !== 'number' || !(rate > 0) || !Number.isFinite(rate))
          throw new RangeError(`probe: rate of ${tap} is ${String(rate)}`);
        const span = shown(rate);
        averagePower(x, pairs, first, count, fft);
        if (pairs) {
          const centre = centres[tap];
          if (typeof centre !== 'number' || !Number.isFinite(centre))
            throw new RangeError(`probe: centre of ${tap} is ${String(centre)}`);
          const c = Math.min(columns, size);
          scale(c, size, 0);
          data.bins = bins.subarray(0, c);
          data.fromHz = centre - span / 2;
          data.toHz = centre + span / 2;
        } else {
          const half = size >> 1;
          const c = Math.min(columns, half);
          scale(c, half, half);
          data.bins = bins.subarray(0, c);
          data.toHz = span / 2;
        }
      }
      return data;
    },
  };
}
