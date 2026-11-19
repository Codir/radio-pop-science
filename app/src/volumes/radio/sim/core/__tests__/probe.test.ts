import { describe, expect, it } from 'vitest';
import {
  createProbe,
  PROBE_MAX_COLUMNS,
  PROBE_MIN_SAMPLES,
  type ProbeData,
  type ProbeRequest,
  type ProbeView,
  TAP_PAIRS,
  type TapId,
} from '../probe';
import { createRng } from '../rng';
import { createFft } from '../spectrum';
import { BAND, FS_CH, FS_WB, IF } from '../standard';
import { dbmToAmp } from '../units';
import { argmax } from './helpers';

const TWO_PI = 2 * Math.PI;
const TAPS: readonly TapId[] = ['camera.video', 'air.rx', 'rx.shifted', 'rx.limited', 'rx.detected'];
const VIEWS: readonly ProbeView[] = ['strip', 'scale', 'arrow'];
const fft = createFft(1024);

/** The taps of one frame, silent: camera.video and rx.detected 28 800 numbers, rx.* 57 600, air.rx 288 000. */
function silent(): Record<TapId, Float32Array> {
  return {
    'camera.video': new Float32Array(28_800),
    'air.rx': new Float32Array(288_000),
    'rx.shifted': new Float32Array(57_600),
    'rx.limited': new Float32Array(57_600),
    'rx.detected': new Float32Array(28_800),
  };
}

/** The rates of the taps, model Hz, and the real middles of the taps of pairs, as the chain gives them. */
const RATES: Record<TapId, number> = {
  'camera.video': FS_CH,
  'air.rx': FS_WB,
  'rx.shifted': FS_CH,
  'rx.limited': FS_CH,
  'rx.detected': FS_CH,
};
const CENTRES: Record<TapId, number> = {
  'camera.video': 0,
  'air.rx': BAND.centre,
  'rx.shifted': IF,
  'rx.limited': IF,
  'rx.detected': 0,
};

/** What a fresh probe shows. */
const read = (taps: Record<TapId, Float32Array>, req: ProbeRequest): ProbeData =>
  createProbe().read(req, taps, RATES, CENTRES, fft);

/** A tone e^(j2π·f·n) of amplitude `amp` into the pairs [from, to) of `x`. */
function tone(x: Float32Array, f: number, amp: number, from = 0, to = x.length >> 1): void {
  for (let n = from; n < to; n++) {
    const a = TWO_PI * ((f * n) % 1);
    x[2 * n] = amp * Math.cos(a);
    x[2 * n + 1] = amp * Math.sin(a);
  }
}

/** The real frequency of the middle of column `j` of a scale. */
const at = (d: ProbeData, j: number): number => d.fromHz + ((j + 0.5) / d.bins.length) * (d.toHz - d.fromHz);

/** Every number the probe gave. */
const numbers = (d: ProbeData): number[] => [...d.lo, ...d.hi, ...d.bins, ...d.points, d.fromHz, d.toHz];

describe('probe', () => {
  it('стрічка пилки', () => {
    /* camera.video[n] = (n mod 100)/100; { tap: 'camera.video', view: 'strip', start: 0, span: 1, columns: 288 };
       the fields of the other views are empty; on a seeded random tap every column of a window holds the least and
       the largest of its own samples, first + ⌊j·count/C⌋ … first + ⌊(j + 1)·count/C⌋ − 1 */
    const taps = silent();
    const v = taps['camera.video'];
    for (let n = 0; n < v.length; n++) v[n] = (n % 100) / 100;
    const d = read(taps, { tap: 'camera.video', view: 'strip', start: 0, span: 1, columns: 288 });
    expect(d.lo).toHaveLength(288);
    expect(Math.max(...d.lo)).toBe(0);
    expect(Math.min(...d.hi)).toBe(Math.fround(0.99));
    expect([d.tap, d.view, d.hi.length, d.bins.length, d.points.length, d.fromHz, d.toHz]).toEqual([
      'camera.video',
      'strip',
      288,
      0,
      0,
      0,
      0,
    ]);
    // a window of 0.37 of the frame from 0.3 on 500 columns: the columns follow the rule to the sample
    createRng(5).gaussFill(v, 1);
    const w = read(taps, { tap: 'camera.video', view: 'strip', start: 0.3, span: 0.37, columns: 500 });
    const count = Math.round(0.37 * 28_800);
    const first = Math.floor(0.3 * 28_800);
    expect(w.lo).toHaveLength(500);
    for (let j = 0; j < 500; j++) {
      const part = v.subarray(
        first + Math.floor((j * count) / 500),
        first + Math.floor(((j + 1) * count) / 500),
      );
      expect([w.lo[j], w.hi[j]]).toEqual([Math.min(...part), Math.max(...part)]);
    }
  });

  it('шістнадцять відліків — самі відліки', () => {
    /* air.rx з re[n] = n; span 16/144000, start 0.5; im[n] = −n, so the strip of a tap of pairs shows the right
       shadow (re) and nothing of the other */
    const taps = silent();
    const x = taps['air.rx'];
    for (let n = 0; n < x.length >> 1; n++) {
      x[2 * n] = n;
      x[2 * n + 1] = -n;
    }
    const d = read(taps, { tap: 'air.rx', view: 'strip', start: 0.5, span: 16 / 144000, columns: 256 });
    expect(Array.from(d.lo)).toEqual(Array.from({ length: 16 }, (_, i) => 72000 + i));
    expect(Array.from(d.hi)).toEqual(Array.from(d.lo));
  });

  it('шкала: тон на своєму місці й у справжніх частотах', () => {
    /* air.rx = dbmToAmp(−60)·e^(j2π·0,09n); view 'scale', columns 500; стовпчики далі ніж за 5 від j — нижче −95;
       parts shorter than the transform (300, 100, 16 samples, padded with zeros) show the tone at the same place and
       level; a tone on a bin lights the column that holds the bin's frequency; the power is the mean of the pieces;
       a part over the second half of the frame shows only what is there; rx.shifted with a tone at 0.05 of its rate
       stands on 25…45 MHz with the tone at 36 MHz */
    const taps = silent();
    tone(taps['air.rx'], 0.09, dbmToAmp(-60));
    const d = read(taps, { tap: 'air.rx', view: 'scale', start: 0, span: 1, columns: 500 });
    expect(d.bins).toHaveLength(500);
    expect(d.fromHz).toBe(2391e6);
    expect(d.toHz).toBe(2491e6);
    const j = argmax(d.bins);
    expect(Math.abs(d.fromHz + ((j + 0.5) / 500) * 100e6 - 2450e6)).toBeLessThan(0.3e6);
    expect(Math.abs(d.bins[j] + 60)).toBeLessThan(1.5);
    for (let k = 0; k < 500; k++) if (Math.abs(k - j) > 5) expect(d.bins[k]).toBeLessThan(-95);
    expect([d.lo.length, d.hi.length, d.points.length]).toEqual([0, 0, 0]);

    // parts of 300, 100, 16 and again 300 samples from the middle of the frame, fewer than the transform's 1024, read
    // by one probe in turn, and a part of 300 after a transform of 256: the tone at its place and its level each time
    const probe = createProbe();
    for (const [count, transform] of [
      [300, fft],
      [100, fft],
      [16, fft],
      [300, createFft(256)],
      [300, fft],
    ] as const) {
      const short = probe.read(
        { tap: 'air.rx', view: 'scale', start: 0.5, span: count / 144_000, columns: 500 },
        taps,
        RATES,
        CENTRES,
        transform,
      );
      const s = argmax(short.bins);
      expect(Math.abs(at(short, s) - 2450e6)).toBeLessThan(transform.size === 256 ? 0.6e6 : 0.3e6);
      expect(Math.abs(short.bins[s]! + 60)).toBeLessThan(1.5);
    }

    // a tone right on bin 600 of the transform (2449.59375 MHz) lights the column that holds that frequency, 292
    const onBin = silent();
    tone(onBin['air.rx'], (600 - 512) / 1024, dbmToAmp(-60));
    const b = read(onBin, { tap: 'air.rx', view: 'scale', start: 0, span: 1, columns: 500 });
    expect(argmax(b.bins)).toBe(292);
    expect(Math.abs(b.bins[292]! + 60)).toBeLessThan(0.01);

    // the power is the mean of eight pieces spread over the frame: a tone only in the first 18 000 samples is in the
    // first piece alone, 10·lg 8 = 9.03 dB lower
    const eighth = silent();
    tone(eighth['air.rx'], 0.09, dbmToAmp(-60), 0, 18_000);
    const mean = read(eighth, { tap: 'air.rx', view: 'scale', start: 0, span: 1, columns: 500 });
    expect(Math.abs(mean.bins[j]! - d.bins[j]! + 10 * Math.log10(8))).toBeLessThan(0.01);

    // the first half at 2450 MHz, the second at 2421 MHz: a window over the second half sees only 2421 MHz
    tone(taps['air.rx'], -0.2, dbmToAmp(-60), 72_000);
    const half = read(taps, { tap: 'air.rx', view: 'scale', start: 0.5, span: 0.5, columns: 500 });
    const h = argmax(half.bins);
    expect(Math.abs(at(half, h) - 2421e6)).toBeLessThan(0.3e6);
    expect(Math.abs(half.bins[h]! + 60)).toBeLessThan(1.5);
    for (let k = 0; k < 500; k++)
      if (Math.abs(at(half, k) - 2450e6) < 1e6) expect(half.bins[k]).toBeLessThan(-95);

    // after the shift the channel stands round IF
    tone(taps['rx.shifted'], 0.05, dbmToAmp(-60));
    const c = read(taps, { tap: 'rx.shifted', view: 'scale', start: 0, span: 1, columns: 500 });
    expect([c.fromHz, c.toHz]).toEqual([25e6, 45e6]);
    expect(Math.abs(at(c, argmax(c.bins)) - 36e6)).toBeLessThan(0.1e6);
  });

  it('шкала дійсного відведення — від нуля до 10 MHz', () => {
    /* rx.detected = 0,5·cos(2π·0,1n): fromHz 0, toHz 10e6, найбільший стовпчик — на 2 MHz ± 0,1; the scale of a
       real tap is one-sided, so the tone shows its power 0.5²/2 = 0.125, −9.03 dB, within the Hann window's loss
       between bins (≤ 1.5 dB); farther than 1 MHz from it all is below −90 */
    const taps = silent();
    const x = taps['rx.detected'];
    for (let n = 0; n < x.length; n++) x[n] = 0.5 * Math.cos(TWO_PI * ((0.1 * n) % 1));
    const d = read(taps, { tap: 'rx.detected', view: 'scale', start: 0, span: 1, columns: 500 });
    expect(d.fromHz).toBe(0);
    expect(d.toHz).toBe(10e6);
    expect(d.bins).toHaveLength(500);
    const j = argmax(d.bins);
    expect(Math.abs(at(d, j) - 2e6)).toBeLessThanOrEqual(0.1e6);
    expect(d.bins[j]).toBeLessThanOrEqual(10 * Math.log10(0.125) + 0.05);
    expect(d.bins[j]).toBeGreaterThan(10 * Math.log10(0.125) - 1.5);
    for (let k = 0; k < 500; k++) if (Math.abs(at(d, k) - 2e6) > 1e6) expect(d.bins[k]).toBeLessThan(-90);
  });

  it('стрілка: пари (I, Q)', () => {
    /* rx.shifted = e^(j2π·0,05n); view 'arrow', columns 512, span 1: крок ⌈28800/512⌉ = 57, тож пар 506;
       кожна пара має довжину 1 ± 1e-6 and is the sample 57·k of the tap itself; для camera.video points.length = 0 */
    const taps = silent();
    const x = taps['rx.shifted'];
    tone(x, 0.05, 1);
    const d = read(taps, { tap: 'rx.shifted', view: 'arrow', start: 0, span: 1, columns: 512 });
    expect(d.points).toHaveLength(1012);
    for (let k = 0; k < 506; k++) {
      expect(Math.abs(Math.hypot(d.points[2 * k]!, d.points[2 * k + 1]!) - 1)).toBeLessThan(1e-6);
      expect([d.points[2 * k], d.points[2 * k + 1]]).toEqual([x[2 * 57 * k], x[2 * 57 * k + 1]]);
    }
    expect([d.lo.length, d.hi.length, d.bins.length, d.fromHz, d.toHz]).toEqual([0, 0, 0, 0, 0]);
    expect(
      read(taps, { tap: 'camera.video', view: 'arrow', start: 0, span: 1, columns: 512 }).points,
    ).toHaveLength(0);
    // a part of 100 samples from the middle on 50 columns: every second pair from 14 400 on, (n, n + 0.5)
    const y = taps['rx.limited'];
    for (let n = 0; n < y.length >> 1; n++) {
      y[2 * n] = n;
      y[2 * n + 1] = n + 0.5;
    }
    const part = read(taps, {
      tap: 'rx.limited',
      view: 'arrow',
      start: 0.5,
      span: 100 / 28_800,
      columns: 50,
    });
    expect(Array.from(part.points)).toEqual(
      Array.from({ length: 100 }, (_, i) => 14_400 + 2 * (i >> 1) + (i & 1) / 2),
    );
  });

  it('запити поза межами обтинаються', () => {
    /* start −1 → 0; start 2, span 0.5 → вікно в кінці; span 0 → 16 відліків; columns 9000 → 512; columns 0 → 1;
       усе скінченне (every tap in every view, with these requests and a few more); a request that is not a number
       is a RangeError, not a guess */
    expect([PROBE_MAX_COLUMNS, PROBE_MIN_SAMPLES]).toEqual([512, 16]);
    expect(TAPS.filter((tap) => TAP_PAIRS[tap])).toEqual(['air.rx', 'rx.shifted', 'rx.limited']);
    const taps = silent();
    const v = taps['camera.video'];
    for (let n = 0; n < v.length; n++) v[n] = n; // each sample shows its own index
    const strip = (start: number, span: number, columns: number): ProbeData =>
      read(taps, { tap: 'camera.video', view: 'strip', start, span, columns });

    const before = strip(-1, 0.01, 288);
    expect([before.lo.length, before.lo[0], before.hi[287]]).toEqual([288, 0, 287]);
    const after = strip(2, 0.5, 288);
    expect([after.lo.length, after.lo[0], after.hi[287]]).toEqual([288, 14_400, 28_799]);
    const thin = strip(0.25, 0, 288);
    expect(Array.from(thin.lo)).toEqual(Array.from({ length: 16 }, (_, i) => 7200 + i));
    expect(strip(100.9 / 28_800, 0, 288).lo[0]).toBe(100); // a start between samples: the sample before it
    expect(strip(0, 100.6 / 28_800, 288).lo).toHaveLength(101); // a span between samples: the nearest count
    expect(strip(0.25, -3, 288).lo).toHaveLength(16);
    const wide = strip(0, 1, 9000);
    expect([wide.lo.length, wide.lo[0], wide.hi[511]]).toEqual([512, 0, 28_799]);
    const one = strip(0.5, 0.25, 0);
    expect([one.lo.length, one.lo[0], one.hi[0]]).toEqual([1, 14_400, 21_599]);
    const all = strip(-Infinity, Infinity, Infinity);
    expect([all.lo.length, all.lo[0], all.hi[511]]).toEqual([512, 0, 28_799]);

    tone(taps['rx.shifted'], 0.05, 1);
    const arrow = (columns: number): number =>
      read(taps, { tap: 'rx.shifted', view: 'arrow', start: 0, span: 1, columns }).points.length;
    expect([arrow(9000), arrow(0)]).toEqual([1012, 2]);
    expect(
      read(taps, { tap: 'rx.shifted', view: 'arrow', start: 0.5, span: 0, columns: 512 }).points,
    ).toHaveLength(32);
    const scale = (columns: number): number =>
      read(taps, { tap: 'air.rx', view: 'scale', start: 0, span: 1, columns }).bins.length;
    expect([scale(9000), scale(0)]).toEqual([512, 1]);
    // a transform of 256 has no more columns than bins: 256 for pairs, the 128 of positive frequencies for a real tap
    const small = createFft(256);
    const columnsOf = (tap: TapId): number =>
      createProbe().read({ tap, view: 'scale', start: 0, span: 1, columns: 512 }, taps, RATES, CENTRES, small)
        .bins.length;
    expect([columnsOf('air.rx'), columnsOf('rx.detected')]).toEqual([256, 128]);

    // every tap in every view: some noise in each tap, and the requests above
    const rng = createRng(3);
    for (const tap of TAPS) rng.gaussFill(taps[tap], 0.01);
    const probe = createProbe();
    const odd: readonly [number, number, number][] = [
      [-1, 0.01, 288],
      [2, 0.5, 288],
      [0.25, 0, 288],
      [0, 1, 9000],
      [0.5, 0.25, 0],
      [-Infinity, Infinity, Infinity],
      [Infinity, -Infinity, -Infinity],
    ];
    for (const tap of TAPS)
      for (const view of VIEWS)
        for (const [start, span, columns] of odd) {
          const d = probe.read({ tap, view, start, span, columns }, taps, RATES, CENTRES, fft);
          expect(numbers(d).every(Number.isFinite)).toBe(true);
          // the view shows something, except the arrow of a real tap
          const own = view === 'strip' ? d.lo : view === 'scale' ? d.bins : d.points;
          expect(own.length > 0).toBe(view !== 'arrow' || TAP_PAIRS[tap]);
        }
    for (const req of [
      { start: NaN, span: 1, columns: 256 },
      { start: 0, span: NaN, columns: 256 },
      { start: 0, span: 1, columns: NaN },
    ])
      expect(() => probe.read({ tap: 'air.rx', view: 'strip', ...req }, taps, RATES, CENTRES, fft)).toThrow(
        RangeError,
      );
    // and the probe hides nothing: a NaN of the model shows as NaN in the strip's column and on the scale
    taps['air.rx'][2 * 1000] = NaN;
    const frame = { tap: 'air.rx', start: 0, span: 1, columns: 512 } as const;
    const nanStrip = probe.read({ ...frame, view: 'strip' }, taps, RATES, CENTRES, fft);
    expect([nanStrip.lo[3], nanStrip.hi[3], nanStrip.lo[4]].map(Number.isNaN)).toEqual([true, true, false]);
    expect(probe.read({ ...frame, view: 'scale' }, taps, RATES, CENTRES, fft).bins.some(Number.isNaN)).toBe(
      true,
    );
  });
});
