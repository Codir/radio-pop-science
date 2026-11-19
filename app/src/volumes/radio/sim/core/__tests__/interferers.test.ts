import { describe, expect, it } from 'vitest';
import { type AirState, pathGainDb, routePoint } from '../channel';
import { createInterferers } from '../interferers';
import { createFrontEnd } from '../rf';
import { SITE } from '../site';
import { createFft, powerSpectrumDb } from '../spectrum';
import { BAND, FRAME_LINES, FRAME_WB } from '../standard';
import { powerDbm } from '../units';

/** The air of the tests: the kitchen, the antenna in place; the router and the oven are switched by each test. */
const AIR: AirState = {
  route: 1,
  nudge: 0,
  gate: 0,
  tray: 0,
  txPowerMw: 10,
  txChannel: 3,
  router: false,
  oven: false,
};
/** Pairs of the band in a line of the frame: 1440. */
const LINE = FRAME_WB / FRAME_LINES;
/** The monitor's antenna in the kitchen. */
const ANTENNA = routePoint(SITE, 1);
const ROUTER_DBM = 10 * Math.log10(SITE.router.mw) + pathGainDb(SITE, SITE.router.at, ANTENNA);
const OVEN_DBM = 10 * Math.log10(SITE.oven.leakMw) + pathGainDb(SITE, SITE.oven.at, ANTENNA);

/** `frames` frames of an antenna that held nothing but what `block` added to it, one `add` per frame. */
function antenna(frames: number, p: Partial<AirState>, block = createInterferers(1)): Float32Array {
  const out = new Float32Array(2 * frames * FRAME_WB);
  for (let f = 0; f < frames; f++)
    block.add(out.subarray(2 * f * FRAME_WB, 2 * (f + 1) * FRAME_WB), { ...AIR, ...p }, SITE);
  return out;
}

/** The power of each of the 100 lines of a frame, mW (silence is 0). */
function linePowers(x: Float32Array): number[] {
  return Array.from({ length: FRAME_LINES }, (_, r) => {
    let sum = 0;
    for (let i = 2 * r * LINE, end = i + 2 * LINE; i < end; i++) sum += x[i]! ** 2;
    return sum / LINE;
  });
}

/** Runs of neighbouring lines for which `on` holds: [first line, last line]. */
function runs(on: readonly boolean[]): [number, number][] {
  const out: [number, number][] = [];
  on.forEach((v, r) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last !== undefined && last[1] === r - 1) last[1] = r;
    else out.push([r, r]);
  });
  return out;
}

/** The real frequency of the turn from pair n to pair n + 1 of `x`, Hz. */
function frequencyAt(x: Float32Array, n: number): number {
  const [a, b, c, d] = [x[2 * n]!, x[2 * n + 1]!, x[2 * n + 2]!, x[2 * n + 3]!];
  const turn = Math.atan2(a * d - b * c, a * c + b * d); // angle of x[n + 1]·conj(x[n])
  return BAND.centre + (turn / (2 * Math.PI)) * 100e6;
}

/**
 * The first number where `a` and `b` differ bit for bit, −1 when they are the same. (toEqual on arrays of a million
 * numbers that differ would spend minutes on the report.)
 */
function firstDifference(a: Float32Array, b: Float32Array): number {
  const x = new Uint32Array(a.buffer, a.byteOffset, a.length);
  const y = new Uint32Array(b.buffer, b.byteOffset, b.length);
  if (x.length !== y.length) return Math.min(x.length, y.length);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return i;
  return -1;
}

describe('interferers', () => {
  it('вимкнені завади нічого не додають', () => {
    /* router: false, oven: false → the antenna stays zeros, at every stop */
    for (const route of [0, 1, 2, 3, 4]) expect(antenna(1, { route }).every((v) => v === 0)).toBe(true);
  });

  it('роутер накриває канали 2 і 3, а 1 і 4 вільні', () => {
    /* 4 frames; p[ch] is the level after createFrontEnd(1).process(…, ch, …). Also the hump itself, from
       powerSpectrumDb on pieces of 2048 pairs: its centre of power within 0.5 MHz of 2437 MHz, more than 99 % of its
       power within 2426…2448 MHz */
    const a = antenna(4, { router: true });
    const p = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const ch of [1, 2, 3, 4] as const) {
      const out = new Float32Array(a.length / 5);
      createFrontEnd(1).process(a, ch, out);
      p[ch] = powerDbm(out, 200);
    }
    expect(p[2] - p[1]).toBeGreaterThanOrEqual(20);
    expect(p[3] - p[4]).toBeGreaterThanOrEqual(20);
    expect(p[2]).toBeGreaterThan(p[3]);

    const fft = createFft(2048);
    const bins = new Float32Array(2048);
    let total = 0;
    let moment = 0;
    let hump = 0;
    for (let c = 0; (c + 1) * 2048 <= 4 * FRAME_WB; c++) {
      powerSpectrumDb(a.subarray(2 * c * 2048), fft, bins);
      bins.forEach((db, j) => {
        const hz = BAND.centre + ((j - 1024) / 2048) * 100e6;
        const power = 10 ** (db / 10);
        total += power;
        moment += power * hz;
        if (Math.abs(hz - 2437e6) <= 11e6) hump += power;
      });
    }
    expect(Math.abs(moment / total - 2437e6)).toBeLessThan(0.5e6);
    expect(hump / total).toBeGreaterThan(0.99);
  });

  it('роутер шле сплесками', () => {
    /* the power of each of the 100 lines (1440 pairs); «on» is above 25 % of the largest (the interpolator's tail leaves
       up to 5 % in the next line); in each of 8 frames 3…6 groups of lines that are on, each 3…12 long; the mean
       power of the lines stronger than half the largest = 10·lg(SITE.router.mw) + pathGainDb(SITE, SITE.router.at,
       antenna) ± 1 dB. Also: only the line after a group holds a tail, below 10 % of the largest (about 2 % on
       average; the most seen in 300 frames of this seed is 5.1 %), every other line that is off is silent, and the
       frames are not all alike */
    const block = createInterferers(1);
    const counts: number[] = [];
    for (let f = 0; f < 8; f++) {
      const power = linePowers(antenna(1, { router: true }, block));
      const top = Math.max(...power);
      const groups = runs(power.map((v) => v > 0.25 * top));
      counts.push(groups.length);
      expect(groups.length).toBeGreaterThanOrEqual(3);
      expect(groups.length).toBeLessThanOrEqual(6);
      for (const [first, last] of groups) {
        expect(last - first + 1).toBeGreaterThanOrEqual(3);
        expect(last - first + 1).toBeLessThanOrEqual(12);
      }
      const strong = power.filter((v) => v > 0.5 * top);
      const level = 10 * Math.log10(strong.reduce((s, v) => s + v, 0) / strong.length);
      expect(Math.abs(level - ROUTER_DBM)).toBeLessThanOrEqual(1);
      const tails = new Set(groups.map(([, last]) => last + 1));
      power.forEach((v, r) => {
        if (v > 0.25 * top) return;
        if (tails.has(r)) expect(v).toBeLessThan(0.1 * top);
        else expect(v).toBe(0);
      });
    }
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('піч: половина кадру і лише 2450–2470 MHz', () => {
    /* lines 0–49: the level = 10·lg(SITE.oven.leakMw) + pathGainDb(SITE, SITE.oven.at, antenna) ± 0.2; lines 50–99:
       −200; powerSpectrumDb on pieces of 2048 pairs in lines 0–49: more than 99 % of the power between 2449 and
       2471 MHz. Also, over two frames: the turn from pair to pair stays within 2450–2470 MHz and reaches both ends,
       across the seam of the frames too (the phase goes on); at the start of an even line the sweep is at 2450 MHz,
       of an odd one at 2470; the antenna moved by «move the antenna» 0.15 m along the nudge axis gets the level of
       its new place */
    const frames = antenna(2, { oven: true });
    for (const from of [0, FRAME_WB]) {
      for (let r = 0; r < 50; r++) {
        const level = powerDbm(frames, from + r * LINE, from + (r + 1) * LINE);
        expect(Math.abs(level - OVEN_DBM)).toBeLessThanOrEqual(0.2);
      }
      for (let r = 50; r < 100; r++)
        expect(powerDbm(frames, from + r * LINE, from + (r + 1) * LINE)).toBe(-200);
    }

    const fft = createFft(2048);
    const bins = new Float32Array(2048);
    let inside = 0;
    let total = 0;
    for (let c = 0; (c + 1) * 2048 <= 50 * LINE; c++) {
      powerSpectrumDb(frames.subarray(2 * c * 2048), fft, bins);
      bins.forEach((db, j) => {
        const hz = BAND.centre + ((j - 1024) / 2048) * 100e6;
        const p = 10 ** (db / 10);
        total += p;
        if (hz >= 2449e6 && hz <= 2471e6) inside += p;
      });
    }
    expect(inside / total).toBeGreaterThan(0.99);

    const turns: number[] = [];
    for (const from of [0, FRAME_WB]) {
      for (let n = 0; n + 1 < 50 * LINE; n++) turns.push(frequencyAt(frames, from + n));
      for (let r = 0; r < 50; r++) {
        const sweep = r % 2 === 0 ? 2450e6 : 2470e6;
        expect(Math.abs(frequencyAt(frames, from + r * LINE) - sweep)).toBeLessThan(0.05e6);
      }
    }
    // the seam: from the last pair that is on in the first frame to the first pair of the second
    const last = 2 * (50 * LINE - 1);
    const next = 2 * FRAME_WB;
    turns.push(
      frequencyAt(Float32Array.of(frames[last]!, frames[last + 1]!, frames[next]!, frames[next + 1]!), 0),
    );
    const lo = turns.reduce((m, v) => Math.min(m, v), Infinity);
    const hi = turns.reduce((m, v) => Math.max(m, v), -Infinity);
    expect(lo).toBeGreaterThan(2450e6 - 0.05e6);
    expect(lo).toBeLessThan(2450e6 + 0.05e6);
    expect(hi).toBeLessThan(2470e6 + 0.05e6);
    expect(hi).toBeGreaterThan(2470e6 - 0.05e6);

    const [ax, ay] = SITE.nudgeAxis;
    const along = 0.15 / Math.hypot(ax, ay);
    const moved = [ANTENNA[0] + along * ax, ANTENNA[1] + along * ay, ANTENNA[2]] as const;
    const movedDbm = 10 * Math.log10(SITE.oven.leakMw) + pathGainDb(SITE, SITE.oven.at, moved);
    expect(Math.abs(movedDbm - OVEN_DBM)).toBeGreaterThan(0.5);
    expect(
      Math.abs(powerDbm(antenna(1, { oven: true, nudge: 0.15 }), 0, 50 * LINE) - movedDbm),
    ).toBeLessThanOrEqual(0.2);
  });

  it('те саме зерно — ті самі сплески', () => {
    /* two createInterferers(9): the antennas are equal; after reset() the frame repeats; another seed gives other
       bursts */
    const both = { router: true, oven: true };
    const a = createInterferers(9);
    const first = antenna(3, both, a);
    expect(firstDifference(antenna(3, both, createInterferers(9)), first)).toBe(-1);
    a.reset();
    expect(firstDifference(antenna(3, both, a), first)).toBe(-1);
    expect(firstDifference(antenna(3, both, createInterferers(10)), first)).not.toBe(-1);
  });
});
