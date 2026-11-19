import { describe, expect, it } from 'vitest';
import {
  type Block,
  createDecimator,
  createDelay,
  createFir,
  createInterpolator,
  DELAY_LATENCY,
  designLowpass,
  mix,
} from '../dsp';
import { createRng } from '../rng';
import { gainDb } from './helpers';

const TWO_PI = 2 * Math.PI;

/** `pairs` pairs of a tone of amplitude 1 at `f` cycles per sample. */
function tone(pairs: number, f: number): Float32Array {
  const x = new Float32Array(2 * pairs);
  for (let n = 0; n < pairs; n++) {
    x[2 * n] = Math.cos(TWO_PI * f * n);
    x[2 * n + 1] = Math.sin(TWO_PI * f * n);
  }
  return x;
}

/** Lengths of the pairs of `x` from pair `from` on. */
function lengths(x: Float32Array, from: number): number[] {
  const out: number[] = [];
  for (let n = from; 2 * n < x.length; n++) out.push(Math.hypot(x[2 * n]!, x[2 * n + 1]!));
  return out;
}

/** The largest distance between the pairs of `x` and a tone of amplitude 1 at `f`, delayed by `delay` samples. */
function offTone(x: Float32Array, from: number, f: number, delay: number): number {
  let worst = 0;
  for (let n = from; 2 * n < x.length; n++) {
    const a = TWO_PI * f * (n - delay);
    worst = Math.max(worst, Math.hypot(x[2 * n]! - Math.cos(a), x[2 * n + 1]! - Math.sin(a)));
  }
  return worst;
}

describe('dsp', () => {
  it('фільтр 63 відводи, зріз 0,1', () => {
    const h = designLowpass(63, 0.1);
    expect(gainDb(h, 0)).toBeCloseTo(0, 5);
    expect(h[10]).toBeCloseTo(h[52]!, 7);
    expect(gainDb(h, 0.1)).toBeGreaterThan(-6.2);
    expect(gainDb(h, 0.1)).toBeLessThan(-5.8);
    for (let f = 0.15; f <= 0.5; f += 0.005) expect(gainDb(h, f)).toBeLessThan(-50);
    // tap by tap it is the sinc under the Hamming window, divided by the sum
    const want = Array.from({ length: 63 }, (_, k) => {
      const t = Math.PI * 0.2 * (k - 31);
      return (t === 0 ? 0.2 : (0.2 * Math.sin(t)) / t) * (0.54 - 0.46 * Math.cos((TWO_PI * k) / 62));
    });
    const sum = want.reduce((a, v) => a + v, 0);
    expect(Math.max(...want.map((v, k) => Math.abs(h[k]! - v / sum)))).toBeLessThan(1e-7);
    expect(() => designLowpass(1, 0.1)).toThrow(RangeError);
    expect(() => designLowpass(63, 0.6)).toThrow(RangeError);
    // a filter answers a single 1 with its taps, in their order
    const answer = new Float32Array(6);
    createFir(Float32Array.of(1, 2, 3)).process(Float32Array.of(0, 1, 0, 0, 0, 0), answer);
    expect(Array.from(answer)).toEqual([0, 1, 2, 3, 0, 0]);
  });

  it('потік дорівнює одному шматку', () => {
    const h = designLowpass(63, 0.1);
    const x = new Float32Array(2000);
    createRng(3).gaussFill(x, 1);
    const cuts = [0, 10, 70, 640, 1500, 2000];
    // a block and how many numbers it gives (up) for how many taken (down)
    const cases: [() => Block, number, number][] = [
      [() => createFir(h), 1, 1],
      [() => createDecimator(h, 5), 1, 5],
      [() => createInterpolator(h, 5), 5, 1],
    ];
    for (const [create, up, down] of cases) {
      const block = create();
      const whole = new Float32Array((2000 * up) / down);
      block.process(x, whole);
      expect(whole.every((v) => Number.isFinite(v)) && whole.some((v) => v !== 0)).toBe(true);
      const chunked = create();
      const pieces = new Float32Array((2000 * up) / down);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const [a, b] = [cuts[i]!, cuts[i + 1]!];
        chunked.process(x.subarray(a, b), pieces.subarray((a * up) / down, (b * up) / down));
      }
      expect(Array.from(pieces)).toEqual(Array.from(whole));
      // after reset() a block repeats its output bit for bit
      const again = new Float32Array((2000 * up) / down);
      block.reset();
      block.process(x, again);
      expect(Array.from(again)).toEqual(Array.from(whole));
    }
  });

  it('проріджувач пропускає своє й глушить чуже', () => {
    const h = designLowpass(63, 0.1);
    const through = (f: number): Float32Array => {
      const out = new Float32Array(800);
      createDecimator(h, 5).process(tone(2000, f), out);
      return out;
    };
    const own = through(0.02);
    expect(Math.min(...lengths(own, 20))).toBeGreaterThan(0.99);
    expect(Math.max(...lengths(own, 20))).toBeLessThan(1.01);
    // out[k] = Σ h[i]·x[5k − i]: the tone comes out five times faster and 31 input samples late
    expect(offTone(own, 20, 0.1, 31 / 5)).toBeLessThan(0.01);
    expect(20 * Math.log10(Math.max(...lengths(through(0.3), 20)))).toBeLessThan(-50);
    // m = 1 is a plain filter of pairs
    const plain = new Float32Array(4000);
    createDecimator(h, 1).process(tone(2000, 0.02), plain);
    expect(offTone(plain, 100, 0.02, 31)).toBeLessThan(0.01);
    // the taps go in their order, the newest pair meets h[0]: a single pair (1, −1) comes out as the taps
    const answer = new Float32Array(10);
    createDecimator(Float32Array.of(1, 2, 3), 1).process(
      Float32Array.of(0, 0, 1, -1, 0, 0, 0, 0, 0, 0),
      answer,
    );
    expect(Array.from(answer)).toEqual([0, 0, 1, -1, 2, -2, 3, -3, 0, 0]);
    // a call brings a whole number of m pairs
    expect(() => createDecimator(h, 5).process(new Float32Array(12), new Float32Array(4))).toThrow(
      RangeError,
    );
    expect(() => createDecimator(h, 0)).toThrow(RangeError);
  });

  it('інтерполятор зберігає розмах', () => {
    const out = new Float32Array(4000);
    createInterpolator(designLowpass(63, 0.1), 5).process(tone(400, 0.1), out);
    expect(Math.min(...lengths(out, 100))).toBeGreaterThan(0.99);
    expect(Math.max(...lengths(out, 100))).toBeLessThan(1.01);
    // y[n] = 5·Σ h[n − 5k]·x[k]: the same tone five times slower, 31 output samples late
    expect(offTone(out, 100, 0.02, 31)).toBeLessThan(0.01);
    // a single pair (1, −1) at k = 1 comes out as l·h[n − l·k]
    const answer = new Float32Array(16);
    createInterpolator(Float32Array.of(1, 2, 3, 4, 5), 2).process(
      Float32Array.of(0, 0, 1, -1, 0, 0, 0, 0),
      answer,
    );
    expect(Array.from(answer)).toEqual([0, 0, 0, 0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 0, 0]);
    expect(() => createInterpolator(designLowpass(63, 0.1), 2.5)).toThrow(RangeError);
  });

  it('інтерполятор і проріджувач разом затримують на 62/5 відліку', () => {
    const h = designLowpass(63, 0.1);
    const x = new Float32Array(200);
    x[2 * 35] = 1;
    const wide = new Float32Array(1000);
    const back = new Float32Array(200);
    createInterpolator(h, 5).process(x, wide);
    createDecimator(h, 5).process(wide, back);
    const re = Array.from({ length: 100 }, (_, k) => back[2 * k]!);
    expect(re.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 4);
    // the centre of mass is 35 + 62/5; another phase of the decimator would give 46.6
    expect(re.reduce((a, v, k) => a + k * v, 0)).toBeCloseTo(47.4, 2);
    expect(Math.max(...Array.from({ length: 100 }, (_, k) => Math.abs(back[2 * k + 1]!)))).toBe(0);
  });

  it('mix тримає довжину й фазу', () => {
    const n = 1_000_000;
    const step = TWO_PI * 0.09;
    const x = new Float32Array(2 * n);
    for (let i = 0; i < 2 * n; i += 2) x[i] = 1;
    const out = new Float32Array(2 * n);
    const phase = mix(x, out, 0, step);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 2 * n; i += 2) {
      const length = Math.hypot(out[i]!, out[i + 1]!);
      lo = Math.min(lo, length);
      hi = Math.max(hi, length);
    }
    expect(lo).toBeGreaterThan(1 - 1e-4);
    expect(hi).toBeLessThan(1 + 1e-4);
    // the returned phase is an angle in [0, 2π): compare it with (n·step) mod 2π around the circle
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(TWO_PI);
    const off = Math.abs(phase - ((n * step) % TWO_PI));
    expect(Math.min(off, TWO_PI - off)).toBeLessThan(1e-6);
    // the turn itself: pair n is turned by n·step, to the nearest of 4096 table angles
    expect(offTone(out.subarray(0, 2000), 0, 0.09, 0)).toBeLessThan(1e-3);
    // a negative step turns back
    const home = new Float32Array(2000);
    const backPhase = mix(out.subarray(0, 2000), home, 0, -step);
    expect(offTone(home, 0, 0, 0)).toBeLessThan(2e-3);
    expect(backPhase).toBeGreaterThanOrEqual(0);
    expect(backPhase).toBeLessThan(TWO_PI);
    // a quarter turn of a pair with both shadows
    const pair = new Float32Array(2);
    mix(Float32Array.of(0.6, 0.8), pair, Math.PI / 2, 0);
    expect(pair[0]).toBeCloseTo(-0.8, 6);
    expect(pair[1]).toBeCloseTo(0.6, 6);
    // two calls of 500 pairs are one call of 1000
    const one = new Float32Array(2000);
    const two = new Float32Array(2000);
    mix(x.subarray(0, 2000), one, 0.3, step);
    const middle = mix(x.subarray(0, 1000), two.subarray(0, 1000), 0.3, step);
    mix(x.subarray(1000, 2000), two.subarray(1000), middle, step);
    expect(Math.max(...one.map((v, i) => Math.abs(v - two[i]!)))).toBeLessThanOrEqual(1e-6);
    // …and so are 333 and 667, where the first call ends inside a turn
    const partial = mix(x.subarray(0, 666), two.subarray(0, 666), 0.3, step);
    expect(partial).toBeCloseTo((0.3 + 333 * step) % TWO_PI, 9);
    mix(x.subarray(666, 2000), two.subarray(666), partial, step);
    expect(Math.max(...one.map((v, i) => Math.abs(v - two[i]!)))).toBeLessThanOrEqual(1e-6);
    expect(() => mix(x.subarray(0, 2), pair, NaN, step)).toThrow(RangeError);
  });

  it('дробове запізнення на похилій', () => {
    const x = new Float32Array(400);
    for (let n = 0; n < 200; n++) x[2 * n] = 0.001 * n;
    const out = new Float32Array(400);
    const delay = createDelay(8);
    delay.add(x, out, 3.3, 1, 0);
    for (let n = 20; n < 200; n++) {
      expect(Math.abs(out[2 * n]! - 0.001 * (n - DELAY_LATENCY - 3.3))).toBeLessThanOrEqual(1e-5);
      expect(out[2 * n + 1]).toBe(0);
    }
    const first = Array.from(out);
    // turned by a quarter, the same ramp is added to the other shadow of the same block
    createDelay(8).add(x, out, 3.3, 0, 1);
    for (let n = 20; n < 200; n++) {
      expect(Math.abs(out[2 * n + 1]! - 0.001 * (n - DELAY_LATENCY - 3.3))).toBeLessThanOrEqual(1e-5);
      expect(out[2 * n]).toBe(first[2 * n]);
    }
    // a pair with both shadows turns the wave: (0.6, −0.8) is a turn back by atan(0.8/0.6)
    const wave = tone(200, 0.09);
    const turned = new Float32Array(400);
    createDelay(8).add(wave, turned, 3.3, 0.6, -0.8);
    const late = DELAY_LATENCY + 3.3 + Math.atan2(0.8, 0.6) / (TWO_PI * 0.09);
    expect(offTone(turned, 20, 0.09, late)).toBeLessThan(0.01);
    // the stream continues over calls, and reset() starts it again
    const pieces = new Float32Array(400);
    delay.reset();
    delay.add(wave.subarray(0, 14), pieces.subarray(0, 14), 3.3, 0.6, -0.8);
    delay.add(wave.subarray(14, 100), pieces.subarray(14, 100), 3.3, 0.6, -0.8);
    delay.add(wave.subarray(100), pieces.subarray(100), 3.3, 0.6, -0.8);
    expect(Array.from(pieces)).toEqual(Array.from(turned));
    // a whole delay is a plain shift; the same line takes a new delay
    const shifted = new Float32Array(400);
    delay.reset();
    delay.add(x, shifted, 8, 1, 0);
    expect(shifted[2 * 100]).toBe(Math.fround(0.001 * (100 - DELAY_LATENCY - 8)));
    expect(() => createDelay(8).add(x, shifted, 8.5, 1, 0)).toThrow(RangeError);
    expect(() => createDelay(8).add(x, shifted, -0.1, 1, 0)).toThrow(RangeError);
    expect(() => createDelay(2.5)).toThrow(RangeError);
  });

  it('запізнення рівне до країв діапазону', () => {
    for (const f of [0.09, 0.27, 0.37]) {
      const out = new Float32Array(800);
      createDelay(8).add(tone(400, f), out, 3.5, 1, 0);
      expect(Math.min(...lengths(out, 20))).toBeGreaterThan(0.98);
      expect(Math.max(...lengths(out, 20))).toBeLessThan(1.02);
      // and it is that delay: the tone comes DELAY_LATENCY + 3.5 samples late
      expect(offTone(out, 20, f, DELAY_LATENCY + 3.5)).toBeLessThan(0.02);
    }
    // the taps themselves: a single 1 comes out as g[k] = sinc(k − D)·(0.54 + 0.46·cos(π(k − D)/6)), D = 5.3,
    // with the sum brought to 1, three samples later (the whole part of the delay)
    const x = new Float32Array(80);
    x[2 * 10] = 1;
    const out = new Float32Array(80);
    createDelay(8).add(x, out, 3.3, 1, 0);
    const want = Array.from({ length: 12 }, (_, k) => {
      const t = Math.PI * (k - 5.3);
      return (Math.sin(t) / t) * (0.54 + 0.46 * Math.cos(t / 6));
    });
    const sum = want.reduce((a, v) => a + v, 0);
    expect(Math.max(...want.map((v, k) => Math.abs(out[2 * (13 + k)]! - v / sum)))).toBeLessThan(1e-7);
    expect(Array.from(out.subarray(0, 26)).every((v) => v === 0)).toBe(true);
  });
});
