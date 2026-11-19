import { describe, expect, it } from 'vitest';
import {
  CHAIN_DELAY,
  createFmLink,
  DEFAULT_STATE,
  type FmLinkFrame,
  type FmLinkState,
  type Meters,
} from '../fm-link';
import type { ProbeData, TapId } from '../probe';
import { type ChannelNo, COLS, ROWS } from '../standard';
import { S } from './curve';
import { argmax, centre, FLAT, FRAME, meanPowerDbm } from './helpers';

const CELLS = COLS * ROWS;

/** The mean and the largest |screen − FRAME| over the flat cells of the test frame. */
function flatDiff(screen: ArrayLike<number>): { mean: number; worst: number } {
  let sum = 0;
  let count = 0;
  let worst = 0;
  for (let i = 0; i < CELLS; i++) {
    if (!FLAT[i]) continue;
    const d = Math.abs(screen[i]! - FRAME[i]!);
    sum += d;
    count++;
    worst = Math.max(worst, d);
  }
  return { mean: sum / count, worst };
}

/** The frame «white band»: columns 40–59 are 255, the rest 0. */
function bandFrame(): Uint8Array {
  const band = new Uint8Array(CELLS);
  for (let r = 0; r < ROWS; r++) band.fill(255, r * COLS + 40, r * COLS + 60);
  return band;
}

/** The real frequency of the middle of column `k` of a scale. */
const hzOf = (d: ProbeData, k: number): number =>
  d.fromHz + ((k + 0.5) / d.bins.length) * (d.toHz - d.fromHz);

/** The numbers of the meters, in the order of the contract. */
const numbersOf = (m: Meters): number[] => [
  m.rxDbm,
  m.fieldVm,
  m.cnrDb,
  m.syncLost,
  m.lineOffset,
  m.lineDrift,
  m.lineRow,
];

describe('fm-link', { timeout: 60_000 }, () => {
  it('still залежить лише від зерна, стану й кадру', () => {
    // a: a new link of seed 7; b: another link of seed 7 that has run five frames on route 3 before its still
    const a = createFmLink(7).still(S(), FRAME);
    const other = createFmLink(7);
    for (let i = 0; i < 5; i++) other.step(S({ route: 3 }), FRAME);
    const b = other.still(S(), FRAME);
    expect(Array.from(b.screen)).toEqual(Array.from(a.screen));
    expect(b.meters).toEqual(a.meters);
    expect([a.probe, b.probe]).toEqual([null, null]);
    // so with lineLength 240 too, whose line does not reach the right edge of the screen: those cells are not
    // redrawn, and still shows them as a new link does, not as the frames before left them
    const short = S({}, { lineLength: 240 });
    const c = Array.from(createFmLink(7).still(short, FRAME).screen);
    expect(Array.from(other.still(short, FRAME).screen)).toEqual(c);
    // the seed is a part of it: on route 3 the stills of seeds 7 and 8 differ
    const seven = Array.from(createFmLink(7).still(S({ route: 3 }), FRAME).screen);
    const eight = Array.from(createFmLink(8).still(S({ route: 3 }), FRAME).screen);
    expect(eight).not.toEqual(seven);
  });

  it('step продовжує попередній кадр, reset починає спочатку', () => {
    // on route 3 and on route 4: two steps in a row give different screens; reset() and a step give what the first
    // step of a new createFmLink(7) gives, which is the first step of this link too
    for (const route of [3, 4]) {
      const state = S({ route });
      const link = createFmLink(7);
      const first = Array.from(link.step(state, FRAME).screen);
      const second = Array.from(link.step(state, FRAME).screen);
      expect(second, `route ${route}`).not.toEqual(first);
      link.reset();
      const again = link.step(state, FRAME);
      const fresh = createFmLink(7).step(state, FRAME);
      expect(Array.from(again.screen), `route ${route}`).toEqual(Array.from(fresh.screen));
      expect(again.meters, `route ${route}`).toEqual(fresh.meters);
      expect(Array.from(again.screen), `route ${route}`).toEqual(first);
    }
  });

  it('типовий стан: рядки стоять, кухня чиста', () => {
    // the default state of the contract; S() is a new copy of it
    expect(DEFAULT_STATE).toEqual({
      air: { route: 1, nudge: 0, gate: 0, tray: 0, txPowerMw: 10, txChannel: 3, router: false, oven: false },
      camera: { sync: true },
      monitor: {
        on: true,
        rxChannel: null,
        lineLength: 288,
        syncTrust: 0.25,
        detector: 'slope',
        limiter: true,
      },
    });
    const state = S();
    expect(state).toEqual(DEFAULT_STATE);
    expect(state.air).not.toBe(DEFAULT_STATE.air);
    expect(state.camera).not.toBe(DEFAULT_STATE.camera);
    expect(state.monitor).not.toBe(DEFAULT_STATE.monitor);
    // 4 steps
    const link = createFmLink(1);
    let f!: FmLinkFrame;
    for (let i = 0; i < 4; i++) f = link.step(state, FRAME);
    const m = f.meters;
    expect(m.syncLost).toBe(0);
    expect(Math.abs(m.lineOffset)).toBeLessThan(1);
    expect(Math.abs(m.lineDrift)).toBeLessThan(0.05);
    expect(m.lineRow).toBe(0);
    expect(Math.abs(m.rxDbm + 62)).toBeLessThanOrEqual(1.5);
    expect(m.cnrDb).toBeCloseTo(m.rxDbm + 92, 9);
    // the flat cells against FRAME: the slope detector bends the scale of grey by up to 6 % (16 levels)
    const { mean, worst } = flatDiff(f.screen);
    expect(mean).toBeLessThanOrEqual(6);
    expect(worst).toBeLessThanOrEqual(30);
  });

  it('ритм рядків і блок синхроімпульсів: без блока картинка їде ліворуч', () => {
    // the frame «white band», camera.sync false, lineLength 288.5, still
    const f = createFmLink(1).still(S({}, { lineLength: 288.5 }, { sync: false }), bandFrame());
    const m = f.meters;
    expect(m.syncLost).toBe(1);
    expect(Math.abs(m.lineDrift - 0.5)).toBeLessThan(0.1);
    expect(centre(f.screen, 10) - centre(f.screen, 30)).toBeGreaterThan(3);
    // with the sync block but syncTrust 0 the rhythm does not listen to the pulses: the same drift of 0.5 a line
    const deaf = createFmLink(1).still(S({}, { lineLength: 288.5, syncTrust: 0 }), FRAME).meters;
    expect(Math.abs(deaf.lineDrift - 0.5)).toBeLessThan(0.1);
    // FRAME, sync true, lineLength 290, 4 steps: the pulses hold the picture, a few samples to the left
    const link = createFmLink(1);
    let m2!: Meters;
    for (let i = 0; i < 4; i++) m2 = link.step(S({}, { lineLength: 290 }), FRAME).meters;
    expect(m2.syncLost).toBe(0);
    expect(Math.abs(m2.lineOffset - 6)).toBeLessThan(1.5);
  });

  it('затримка ланцюга дорівнює CHAIN_DELAY', () => {
    // the first 64 samples of rx.detected as they are; j is the first index ≥ 16 where lo[j − 1] ≥ 0.15 > lo[j]
    const f = createFmLink(1).still(S({ route: 0 }, { detector: 'angle' }), FRAME, {
      tap: 'rx.detected',
      view: 'strip',
      start: 0,
      span: 64 / 28800,
      columns: 64,
    });
    const lo = f.probe!.lo;
    expect(lo).toHaveLength(64);
    let j = 16;
    while (j < 64 && !(lo[j - 1]! >= 0.15 && 0.15 > lo[j]!)) j++;
    expect(j).toBeLessThan(64);
    const x = j - 1 + (lo[j - 1]! - 0.15) / (lo[j - 1]! - lo[j]!);
    expect(Number.isInteger(CHAIN_DELAY)).toBe(true);
    // on camera.video the sync pulse of line 0 falls between samples 6 and 7
    expect(Math.abs(x - (6.5 + CHAIN_DELAY))).toBeLessThanOrEqual(0.5);
  });

  it('відведення: кабель камери, антена, канал після зсуву', () => {
    const link = createFmLink(1);
    // camera.video, strip, start 24/100, span 1/100, columns 288: line 24 sample by sample
    const d = link.still(S(), FRAME, {
      tap: 'camera.video',
      view: 'strip',
      start: 24 / 100,
      span: 1 / 100,
      columns: 288,
    }).probe!;
    expect(d.hi).toHaveLength(288);
    expect(Math.max(...d.hi.subarray(7, 28))).toBe(0);
    expect(d.hi[230]).toBeGreaterThanOrEqual(0.82); // the spot on the forehead of the cat
    // air.rx, scale, columns 500: the strongest column no farther than 6 MHz from the middle of the camera's
    // channel, every column farther than 15 MHz from it at least 20 dB lower; on channel 3 and on channel 1
    for (const [txChannel, hz] of [
      [3, 2450e6],
      [1, 2414e6],
    ] as const) {
      const f = link.still(S({ txChannel }), FRAME, {
        tap: 'air.rx',
        view: 'scale',
        start: 0,
        span: 1,
        columns: 500,
      });
      expect(f.meters.syncLost, `channel ${txChannel}`).toBe(0); // rxChannel null: the monitor follows the camera
      const a = f.probe!;
      expect(a.bins).toHaveLength(500);
      const j = argmax(a.bins);
      expect(Math.abs(hzOf(a, j) - hz), `channel ${txChannel}`).toBeLessThanOrEqual(6e6);
      let far = -Infinity;
      for (let k = 0; k < 500; k++) if (Math.abs(hzOf(a, k) - hz) > 15e6) far = Math.max(far, a.bins[k]!);
      expect(far, `channel ${txChannel}`).toBeLessThanOrEqual(a.bins[j]! - 20);
    }
    // rx.shifted, scale: the channel after the shift stands on 25…45 MHz, its strongest column near IF
    const s = link.still(S(), FRAME, {
      tap: 'rx.shifted',
      view: 'scale',
      start: 0,
      span: 1,
      columns: 500,
    }).probe!;
    expect(s.fromHz).toBe(25e6);
    expect(s.toHz).toBe(45e6);
    expect(Math.abs(hzOf(s, argmax(s.bins)) - 35e6)).toBeLessThanOrEqual(6e6);
  });

  it('детектор кута дає ту саму картинку', () => {
    // detector 'angle', route 1: the mean of 4 steps after 2
    const state = S({ route: 1 }, { detector: 'angle' });
    const link = createFmLink(1);
    for (let i = 0; i < 2; i++) link.step(state, FRAME);
    const sum = new Float64Array(CELLS);
    for (let i = 0; i < 4; i++) {
      const f = link.step(state, FRAME);
      const m = f.meters;
      expect(m.syncLost).toBe(0);
      for (let c = 0; c < CELLS; c++) sum[c]! += f.screen[c]!;
    }
    // the flat cells against FRAME
    expect(flatDiff(sum.map((v) => v / 4)).mean).toBeLessThanOrEqual(2);
  });

  it('монітор на чужому каналі показує сніг', () => {
    // txChannel 3, rxChannel 1, 3 steps
    const link = createFmLink(1);
    let f!: FmLinkFrame;
    const arrow = { tap: 'rx.shifted', view: 'arrow', start: 0, span: 1, columns: 512 } as const;
    for (let i = 0; i < 3; i++) f = link.step(S({ txChannel: 3 }, { rxChannel: 1 }), FRAME, arrow);
    const m = f.meters;
    expect(m.syncLost).toBeGreaterThanOrEqual(0.9);
    // what the monitor hears there is the noise of the antenna, −92 dBm in the filter of the channel
    expect(Math.abs(meanPowerDbm(f.probe!.points) + 92)).toBeLessThanOrEqual(1);
  });

  it('вимкнений монітор — темний екран', () => {
    // two steps show the picture first, then monitor.on false
    const link = createFmLink(1);
    const on = { ...link.step(S(), FRAME).meters };
    link.step(S(), FRAME);
    const f = link.step(S({}, { on: false }), FRAME);
    expect(Math.max(...f.screen)).toBe(0);
    expect(Number.isFinite(f.meters.rxDbm)).toBe(true);
    expect([f.meters.syncLost, f.meters.lineOffset, f.meters.lineDrift, f.meters.lineRow]).toEqual([
      0, 0, 0, 0,
    ]);
    // the camera and the air are computed: the level is the one of the monitor that is on
    expect([f.meters.rxDbm, f.meters.fieldVm, f.meters.cnrDb]).toEqual([on.rxDbm, on.fieldVm, on.cnrDb]);
    // the taps of the receiver are zeros; the probe on the antenna works
    const strip = (tap: TapId): ProbeData =>
      link.step(S({}, { on: false }), FRAME, { tap, view: 'strip', start: 0, span: 1, columns: 512 }).probe!;
    for (const tap of ['rx.shifted', 'rx.limited', 'rx.detected'] as const) {
      const p = strip(tap);
      expect([Math.min(...p.lo), Math.max(...p.hi)], tap).toEqual([0, 0]);
    }
    const air = strip('air.rx');
    expect(Math.max(...air.hi)).toBeGreaterThan(0);
    expect(Math.min(...air.lo)).toBeLessThan(0);
  });

  it('крайні стани', () => {
    // each state: 3 steps and 1 still with the probe { tap: 'rx.detected', view: 'strip', start: 0, span: 1,
    // columns: 256 }, on one link, one state after another; no exception, every number of the meters finite,
    // lineRow a whole number 0…99, lo and hi finite; the black and the white frame on route 1: syncLost 0
    const black = new Uint8Array(CELLS);
    const white = new Uint8Array(CELLS).fill(255);
    const cases: [string, FmLinkState, Uint8Array][] = [];
    for (const lineLength of [280, 296])
      for (const sync of [true, false])
        cases.push([`lineLength ${lineLength}, sync ${sync}`, S({}, { lineLength }, { sync }), FRAME]);
    for (const lineLength of [100, 240, 336, 1000])
      cases.push([`lineLength ${lineLength}`, S({}, { lineLength }), FRAME]);
    for (const syncTrust of [0, 1]) cases.push([`syncTrust ${syncTrust}`, S({}, { syncTrust }), FRAME]);
    cases.push(['0.1 mW on route 4', S({ route: 4, txPowerMw: 0.1 }), FRAME]);
    for (const route of [0, 0.5, 1.5, 2.5, 3.5, 4]) cases.push([`route ${route}`, S({ route }), FRAME]);
    for (const nudge of [-0.15, 0.15])
      cases.push([`gate 1, nudge ${nudge}, route 2`, S({ route: 2, gate: 1, nudge }), FRAME]);
    cases.push(['gate 0.5', S({ gate: 0.5 }), FRAME]);
    cases.push(['tray 1', S({ tray: 1 }), FRAME]);
    cases.push(['router and oven', S({ router: true, oven: true }), FRAME]);
    cases.push(['txChannel 3, rxChannel 1', S({ txChannel: 3 }, { rxChannel: 1 }), FRAME]);
    cases.push(['angle', S({}, { detector: 'angle' }), FRAME]);
    cases.push(['no limiter', S({}, { limiter: false }), FRAME]);
    cases.push(['black', S(), black]);
    cases.push(['white', S(), white]);
    expect(cases).toHaveLength(27);

    const link = createFmLink(1);
    const request = { tap: 'rx.detected', view: 'strip', start: 0, span: 1, columns: 256 } as const;
    const sound = (f: FmLinkFrame, name: string): void => {
      expect(numbersOf(f.meters).every(Number.isFinite), name).toBe(true);
      expect(Number.isInteger(f.meters.lineRow), name).toBe(true);
      expect(f.meters.lineRow >= 0 && f.meters.lineRow <= 99, name).toBe(true);
      expect(f.screen, name).toHaveLength(CELLS);
    };
    for (const [name, state, luma] of cases) {
      for (let i = 0; i < 3; i++) sound(link.step(state, luma), name);
      const f = link.still(state, luma, request);
      sound(f, name);
      const p = f.probe!;
      expect(p.lo, name).toHaveLength(256);
      expect([...p.lo, ...p.hi].every(Number.isFinite), name).toBe(true);
      if (luma !== FRAME) expect(f.meters.syncLost, name).toBe(0);
    }
    // without the limiter the receiver is set for the direct wave: in the kitchen, where it is the only ray, the
    // arrow comes to the detector 1 long on average (the noise of the antenna still ripples it, by about 2 %)
    const free = link.still(S({}, { limiter: false }), FRAME, {
      tap: 'rx.limited',
      view: 'arrow',
      start: 0,
      span: 1,
      columns: 512,
    });
    const points = free.probe!.points;
    let length = 0;
    for (let i = 0; i < points.length; i += 2) length += Math.hypot(points[i]!, points[i + 1]!);
    expect(Math.abs(length / (points.length / 2) - 1)).toBeLessThan(0.01);

    // a damaged state is refused
    expect(() => createFmLink(1).step({ ...S(), monitor: null } as unknown as FmLinkState, FRAME)).toThrow();
    // …in any of its parts, and so is a frame of another size or kind, before anything moves
    const broken: [string, unknown, unknown][] = [
      ['no state', null, FRAME],
      ['air', { ...S(), air: undefined }, FRAME],
      ['camera', { ...S(), camera: 'on' }, FRAME],
      ['route', S({ route: Number.NaN }), FRAME],
      ['txPowerMw', S({ txPowerMw: Number.POSITIVE_INFINITY }), FRAME],
      ['txChannel', S({ txChannel: 5 as ChannelNo }), FRAME],
      ['router', S({ router: undefined }), FRAME],
      ['rxChannel 0', S({}, { rxChannel: 0 as ChannelNo }), FRAME],
      ['rxChannel missing', S({}, { rxChannel: undefined }), FRAME],
      ['lineLength', S({}, { lineLength: Number.NaN }), FRAME],
      ['syncTrust', S({}, { syncTrust: Number.NEGATIVE_INFINITY }), FRAME],
      ['detector', S({}, { detector: 'phase' as 'angle' }), FRAME],
      ['limiter', S({}, { limiter: 1 as unknown as boolean }), FRAME],
      ['sync', S({}, {}, { sync: null as unknown as boolean }), FRAME],
      ['short frame', S(), FRAME.subarray(1)],
      ['frame of floats', S(), new Float32Array(CELLS)],
    ];
    // a link that has shown one frame and then got all of these goes on as its twin does: neither a step went on
    // nor a still started again
    const used = createFmLink(1);
    const twin = createFmLink(1);
    used.step(S({ route: 3 }), FRAME);
    twin.step(S({ route: 3 }), FRAME);
    for (const [name, state, luma] of broken) {
      expect(() => used.step(state as FmLinkState, luma as Uint8Array), name).toThrow();
      expect(() => used.still(state as FmLinkState, luma as Uint8Array), name).toThrow();
    }
    const next = used.step(S({ route: 3 }), FRAME);
    const same = twin.step(S({ route: 3 }), FRAME);
    expect(Array.from(next.screen)).toEqual(Array.from(same.screen));
    expect(next.meters).toEqual(same.meters);
  });
});
