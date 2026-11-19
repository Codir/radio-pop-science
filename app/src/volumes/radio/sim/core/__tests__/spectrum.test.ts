import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { createFft, powerSpectrumDb } from '../spectrum';
import { dbmToAmp } from '../units';
import { argmax } from './helpers';

const TWO_PI = 2 * Math.PI;

/** `pairs` pairs of a tone of amplitude `amp` that makes `bin` turns over `size` pairs. */
function tone(pairs: number, bin: number, size: number, amp: number): Float32Array {
  const x = new Float32Array(2 * pairs);
  for (let n = 0; n < pairs; n++) {
    const a = (TWO_PI * bin * n) / size;
    x[2 * n] = amp * Math.cos(a);
    x[2 * n + 1] = amp * Math.sin(a);
  }
  return x;
}

/** The spectrum of the first `size` pairs of `x`, dBm. */
function spectrum(x: Float32Array, size: 256 | 512 | 1024 | 2048): Float32Array {
  const out = new Float32Array(size);
  powerSpectrumDb(x, createFft(size), out);
  return out;
}

describe('spectrum', () => {
  it('тон стоїть у своєму стовпчику', () => {
    /* a tone e^(j2π·64n/1024) of amplitude dbmToAmp(−30): the largest bin is 512 + 64, its value −30 ± 0.1,
       every bin farther than 8 from it is below −100; a tone at −64 stands at 512 − 64 (out[0] is the lowest frequency);
       a tone between two bins; pairs after the first 1024 change nothing */
    const out = spectrum(tone(1024, 64, 1024, dbmToAmp(-30)), 1024);
    const top = argmax(out);
    expect(top).toBe(512 + 64);
    expect(Math.abs(out[top]! + 30)).toBeLessThan(0.1);
    for (let j = 0; j < 1024; j++) if (Math.abs(j - top) > 8) expect(out[j]).toBeLessThan(-100);
    expect(argmax(spectrum(tone(1024, -64, 1024, dbmToAmp(-30)), 1024))).toBe(512 - 64);
    // a tone halfway between two bins: both show the window's loss there, 1.42 dB, and farther than 16 bins all is
    // below −100 — the work of the Hann window (a plain cut of the block would leave about −64 dBm there)
    const between = spectrum(tone(1024, 64.5, 1024, dbmToAmp(-30)), 1024);
    for (const j of [576, 577]) expect(Math.abs(between[j]! + 30 + 1.4236)).toBeLessThan(0.05);
    for (let j = 0; j < 1024; j++) if (Math.abs(j - 576.5) > 16) expect(between[j]).toBeLessThan(-100);
    // only the first 1024 pairs count: what follows them changes nothing
    const longer = tone(1500, 64, 1024, dbmToAmp(-30));
    longer.fill(1, 2048);
    expect(Array.from(spectrum(longer, 1024))).toEqual(Array.from(out));
  });

  it('рівність Парсеваля', () => {
    /* forward on 1024 random pairs: Σ|X|²/1024 = Σ|x|² with a relative error of 1e-4; every X[k] equals the direct
       sum Σ x[n]·e^(−j2πkn/1024) to 1e-4 of the largest |X| */
    const re = new Float32Array(1024);
    const im = new Float32Array(1024);
    createRng(11).gaussFill(re, 1);
    createRng(12).gaussFill(im, 1);
    const x = { re: Float64Array.from(re), im: Float64Array.from(im) };
    createFft(1024).forward(re, im);
    let before = 0;
    let after = 0;
    for (let n = 0; n < 1024; n++) {
      before += x.re[n]! ** 2 + x.im[n]! ** 2;
      after += re[n]! ** 2 + im[n]! ** 2;
    }
    expect(Math.abs(after / 1024 - before) / before).toBeLessThan(1e-4);
    let worst = 0;
    let largest = 0;
    for (let k = 0; k < 1024; k++) {
      let a = 0;
      let b = 0;
      for (let n = 0; n < 1024; n++) {
        const t = (-TWO_PI * ((k * n) % 1024)) / 1024;
        a += x.re[n]! * Math.cos(t) - x.im[n]! * Math.sin(t);
        b += x.re[n]! * Math.sin(t) + x.im[n]! * Math.cos(t);
      }
      worst = Math.max(worst, Math.hypot(re[k]! - a, im[k]! - b));
      largest = Math.max(largest, Math.hypot(a, b));
    }
    expect(worst / largest).toBeLessThan(1e-4);
  });

  it('розміри', () => {
    /* 256, 512, 2048: a tone in bin n/4 stands at n/2 + n/4 with its power; silence gives −200 everywhere;
       a size that is not one of the four is a RangeError */
    for (const n of [256, 512, 2048] as const) {
      expect(createFft(n).size).toBe(n);
      const out = spectrum(tone(n, n / 4, n, dbmToAmp(-50)), n);
      expect(argmax(out)).toBe(n / 2 + n / 4);
      expect(Math.abs(out[n / 2 + n / 4]! + 50)).toBeLessThan(0.1);
      expect(spectrum(new Float32Array(2 * n), n).every((v) => v === -200)).toBe(true);
    }
    expect(() => createFft(1000 as 1024)).toThrow(RangeError);
    // the block must hold `size` pairs
    expect(() => powerSpectrumDb(new Float32Array(2 * 255), createFft(256), new Float32Array(256))).toThrow(
      RangeError,
    );
  });
});
