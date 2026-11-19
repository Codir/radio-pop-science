import { describe, expect, it } from 'vitest';
import angleCase from '../__fixtures__/angle.json';
import phase from '../__fixtures__/fm-phase.json';
import curve from '../__fixtures__/slope-curve.json';
import { type Block, designLowpass } from '../dsp';
import {
  createAngleDetector,
  createModulator,
  createSlopeDetector,
  createVideoFilter,
  limit,
  SLOPE,
  slopeStatic,
  SYNC_THRESHOLD,
  VIDEO_CUTOFF,
  VIDEO_TAPS,
} from '../fm';
import { FRAME_CH, FS_CH, radPerSample, shown, VIDEO_BW } from '../standard';
import { encodeFrame } from '../video';
import { FRAME, gainDb, spread } from './helpers';

const TWO_PI = 2 * Math.PI;

/** `block` over `x` into a new array of `size` numbers. */
function run(block: Block, x: Float32Array, size: number): Float32Array {
  const out = new Float32Array(size);
  block.process(x, out);
  return out;
}

/** A new modulator over the signal u: pairs. */
const modulate = (u: Float32Array): Float32Array => run(createModulator(), u, 2 * u.length);
/** A new angle detector over pairs: u. */
const angle = (x: Float32Array): Float32Array => run(createAngleDetector(), x, x.length >> 1);
/** A new slope detector over pairs: its output. */
const slope = (x: Float32Array): Float32Array => run(createSlopeDetector(), x, x.length >> 1);

/** The turn from pair n − 1 to pair n of `x`, radians: angle(x[n]·conj(x[n − 1])), with x[−1] = (1, 0). */
function turn(x: Float32Array, n: number): number {
  const re = x[2 * n]!;
  const im = x[2 * n + 1]!;
  const re0 = n > 0 ? x[2 * n - 2]! : 1;
  const im0 = n > 0 ? x[2 * n - 1]! : 0;
  return Math.atan2(im * re0 - re * im0, re * re0 + im * im0);
}

/** The largest |a[i] − b[i]| from index `from` on. */
function worst(a: ArrayLike<number>, b: ArrayLike<number>, from = 0): number {
  let most = 0;
  for (let i = from; i < a.length; i++) most = Math.max(most, Math.abs(a[i]! - b[i]!));
  return most;
}

/** The slope detector on 64 samples of a constant u: the last output, where it has settled. */
const tone = (u: number): number => slope(modulate(new Float32Array(64).fill(u)))[63]!;

/** The test frame as the signal u of one frame. */
function frameSignal(): Float32Array {
  const u = new Float32Array(FRAME_CH);
  encodeFrame(FRAME, u, { sync: true });
  return u;
}

/** 400 pairs of the modulator at u = 0.65 whose length ripples: 1 + 0.5·sin(2πn/40). */
function rippled(): Float32Array {
  const x = modulate(new Float32Array(400).fill(0.65));
  for (let n = 0; n < 400; n++) {
    const k = 1 + 0.5 * Math.sin((TWO_PI * n) / 40);
    x[2 * n]! *= k;
    x[2 * n + 1]! *= k;
  }
  return x;
}

describe('fm', () => {
  it('модулятор: крок фази дорівнює radPerSample(u)', () => {
    /* u from fm-phase.json; the angle of x[n]·conj(x[n−1]) = radPerSample(u[n]) ± 1e-6 and = step[n] ± 1e-5 (the
       sample keeps 6 significant digits); |x| = 1 ± 1e-6; two calls of 128 give the same as one of 256. Also: the
       phase starts at 0 (before the first sample stands (1, 0)), and after reset() the modulator repeats its output
       bit for bit. */
    const u = Float32Array.from(phase.u);
    expect(u.length).toBe(256);
    const x = modulate(u);
    const turns = Array.from(u, (_, n) => turn(x, n));
    expect(worst(turns, Array.from(u, radPerSample))).toBeLessThan(1e-6);
    expect(worst(turns, phase.step)).toBeLessThan(1e-5);
    const lengths = Array.from(u, (_, n) => Math.hypot(x[2 * n]!, x[2 * n + 1]!));
    expect(worst(lengths, new Array<number>(256).fill(1))).toBeLessThan(1e-6);
    const modulator = createModulator();
    const halves = new Float32Array(512);
    modulator.process(u.subarray(0, 128), halves.subarray(0, 256));
    modulator.process(u.subarray(128), halves.subarray(256));
    expect(halves).toEqual(x);
    modulator.reset();
    expect(run(modulator, u, 512)).toEqual(x);
  });

  it('детектор кута повертає u', () => {
    /* On the output of the modulator: |out[n] − u[n]| ≤ 1e-4 for n ≥ 1; on angle.json: |out − u| ≤ 1e-5. The input of
       the modulator is the test frame as a signal (28 800 samples; the phase goes round some 300 times). Also:
       the frame cut into three calls gives the same as one call, and after reset() the detector repeats its output
       bit for bit. */
    const u = frameSignal();
    const x = modulate(u);
    const out = angle(x);
    expect(worst(out, u, 1)).toBeLessThanOrEqual(1e-4);
    expect(angleCase.x.length).toBe(128);
    expect(worst(angle(Float32Array.from(angleCase.x)), angleCase.u)).toBeLessThanOrEqual(1e-5);
    const detector = createAngleDetector();
    const cut = new Float32Array(FRAME_CH);
    detector.process(x.subarray(0, 2 * 1000), cut.subarray(0, 1000));
    detector.process(x.subarray(2 * 1000, 2 * 1001), cut.subarray(1000, 1001));
    detector.process(x.subarray(2 * 1001), cut.subarray(1001));
    expect(cut).toEqual(out);
    detector.reset();
    expect(run(detector, x, FRAME_CH)).toEqual(out);
  });

  it('детектор на схилі: чорне, біле, дно синхроімпульсу', () => {
    /* A constant u, 64 samples, the last one is taken. Also: the threshold of the sync pulses stands halfway between
       the bottom of a pulse and black — for the slope detector (0.153 + 0.3)/2 ≈ 0.226, for the angle detector
       (0 + 0.3)/2 = 0.15. */
    expect(Math.abs(tone(0.3) - 0.3)).toBeLessThan(0.002);
    expect(Math.abs(tone(1) - 1)).toBeLessThan(0.002);
    expect(Math.abs(tone(0) - 0.153)).toBeLessThan(0.01);
    expect(SYNC_THRESHOLD.slope).toBeCloseTo((tone(0) + tone(0.3)) / 2, 2);
    const level = (u: number): number => angle(modulate(new Float32Array(64).fill(u)))[63]!;
    expect(SYNC_THRESHOLD.angle).toBeCloseTo((level(0) + level(0.3)) / 2, 4);
  });

  it('крива схилу монотонна й майже пряма', () => {
    /* 21 values of u: each next output is larger; for u ≥ 0.3 |tone(u) − u| ≤ 0.056 (8 % of the swing 0.7);
       |tone(u) − out| ≤ 1e-3 against slope-curve.json; |slopeStatic(u) − tone(u)| ≤ 1e-4. Also: r and θ are those of
       the sample, and slopeStatic puts black at 0.3 and white at 1 exactly. */
    expect(SLOPE.r).toBe(curve.r);
    expect((SLOPE.theta * 180) / Math.PI).toBeCloseTo(curve.thetaDeg, 12);
    expect(curve.u.length).toBe(21);
    const tones = curve.u.map(tone);
    for (let i = 1; i < 21; i++) expect(tones[i]!, `u = ${curve.u[i]}`).toBeGreaterThan(tones[i - 1]!);
    const picture = curve.u.flatMap((u, i) => (u >= 0.3 ? [Math.abs(tones[i]! - u)] : []));
    expect(picture).toHaveLength(15);
    expect(Math.max(...picture)).toBeLessThanOrEqual(0.056);
    expect(worst(tones, curve.out)).toBeLessThanOrEqual(1e-3);
    expect(worst(curve.u.map(slopeStatic), tones)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(slopeStatic(0.3) - 0.3)).toBeLessThan(1e-12);
    expect(Math.abs(slopeStatic(1) - 1)).toBeLessThan(1e-12);
  });

  it('обмежувач знімає брижі розмаху й не чіпає фазу', () => {
    /* x = modulator(u = 0.65)·(1 + 0.5·sin(2πn/40)); limit(x, 0.01): ||x| − 1| < 1e-6, the angle the same ± 1e-6; a
       pair with |x| = 0.005 gets the length 0.5; (0, 0) stays (0, 0). Also: a pair with |x| = 0.02, above the floor,
       gets the length 1; a floor that is not a positive finite number is a RangeError. */
    const x = rippled();
    const before = x.slice();
    limit(x, 0.01);
    for (let n = 0; n < 400; n++) {
      expect(Math.abs(Math.hypot(x[2 * n]!, x[2 * n + 1]!) - 1)).toBeLessThan(1e-6);
      const re = x[2 * n]! * before[2 * n]! + x[2 * n + 1]! * before[2 * n + 1]!;
      const im = x[2 * n + 1]! * before[2 * n]! - x[2 * n]! * before[2 * n + 1]!;
      expect(Math.abs(Math.atan2(im, re))).toBeLessThan(1e-6);
    }
    const small = Float32Array.of(0.003, -0.004, 0, 0, 0.012, 0.016);
    limit(small, 0.01);
    expect(Math.hypot(small[0]!, small[1]!)).toBeCloseTo(0.5, 6);
    expect(small[0]! / small[1]!).toBeCloseTo(-0.75, 6);
    expect([small[2], small[3]]).toEqual([0, 0]);
    expect(Math.hypot(small[4]!, small[5]!)).toBeCloseTo(1, 6);
    for (const floor of [0, -0.01, NaN, Infinity]) expect(() => limit(small, floor)).toThrow(RangeError);
  });

  it('без обмежувача брижі проходять у картинку', () => {
    /* The same x: the swing of the slope detector's output > 0.3; after limit — < 0.004 (n ≥ 20). Also: the angle
       detector does not see the ripple of the length even without the limiter; the slope detector cut into two
       calls gives the same as one call, and after reset() repeats its output bit for bit. */
    const x = rippled();
    const raw = slope(x);
    expect(spread(raw.subarray(20))).toBeGreaterThan(0.3);
    expect(spread(angle(x).subarray(1))).toBeLessThan(1e-4);
    const detector = createSlopeDetector();
    const cut = new Float32Array(400);
    detector.process(x.subarray(0, 2 * 137), cut.subarray(0, 137));
    detector.process(x.subarray(2 * 137), cut.subarray(137));
    expect(cut).toEqual(raw);
    detector.reset();
    expect(run(detector, x, 400)).toEqual(raw);
    limit(x, 0.01);
    expect(spread(slope(x).subarray(20))).toBeLessThan(0.004);
  });

  it('фільтр відеосигналу: 5,5 MHz', () => {
    /* Also: the cutoff is 5.5 MHz of real frequency at the channel rate of 20 MHz, and createVideoFilter is the
       filter of exactly these taps (its response to a single sample is h) and after reset() repeats its output bit
       for bit. */
    const h = designLowpass(VIDEO_TAPS, VIDEO_CUTOFF);
    expect(gainDb(h, 0)).toBeCloseTo(0, 5);
    expect(Math.abs(gainDb(h, 0.275) + 6)).toBeLessThan(0.3);
    expect(gainDb(h, 0.4)).toBeLessThan(-40);
    expect(VIDEO_CUTOFF).toBeCloseTo(VIDEO_BW / shown(FS_CH), 12);
    const impulse = new Float32Array(64);
    impulse[0] = 1;
    const filter = createVideoFilter();
    const response = run(filter, impulse, 64);
    expect(Array.from(response.subarray(0, VIDEO_TAPS))).toEqual(Array.from(h));
    expect(Array.from(new Set(response.subarray(VIDEO_TAPS)))).toEqual([0]);
    filter.reset();
    expect(run(filter, impulse, 64)).toEqual(response);
  });
});
