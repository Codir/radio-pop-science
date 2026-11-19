import { describe, expect, it } from 'vitest';
import ladder from '../__fixtures__/ladder.json';
import notches from '../__fixtures__/notches.json';
import { type Air, type AirState, createAir, responseDb, trace, wallsBetween } from '../channel';
import { SITE } from '../site';
import { CHANNELS } from '../standard';
import { powerDbm } from '../units';

/** The air of the contract's DEFAULT_STATE: the kitchen, the antenna in place, the gate shut, no tray, 10 mW, channel 3. */
const DEFAULT_AIR: AirState = {
  route: 1,
  nudge: 0,
  gate: 0,
  tray: 0,
  txPowerMw: 10,
  txChannel: 3,
  router: false,
  oven: false,
};
const air = (p: Partial<AirState>): Air => trace(SITE, { ...DEFAULT_AIR, ...p });

/** «Move the antenna» from −0.15 to 0.15 m in steps of 0.0025: 121 points. */
const NUDGES = Array.from({ length: 121 }, (_, i) => (i - 60) / 400);
/** The level at stop 2 with the gate open along NUDGES, and the nudge where it is lowest. */
const OPENED = NUDGES.map((nudge) => air({ route: 2, gate: 1, nudge }).rxDbm);
const worst = NUDGES[OPENED.indexOf(Math.min(...OPENED))]!;
/** 2400…2483 MHz in steps of 0.25 MHz, real Hz. */
const FREQS = Array.from({ length: 333 }, (_, i) => 2400e6 + i * 0.25e6);

/** Indices of the inner local minima of `v`: the values lower than both neighbours. */
function dips(v: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i + 1 < v.length; i++) if (v[i]! < v[i - 1]! && v[i]! < v[i + 1]!) out.push(i);
  return out;
}

/** Differences of neighbours. */
const gaps = (v: readonly number[]): number[] => v.slice(1).map((x, i) => x - v[i]!);

/** The bits of a Float32Array, to compare byte for byte. */
const bits = (x: Float32Array): Uint32Array => new Uint32Array(x.buffer, x.byteOffset, x.length);

describe('channel', () => {
  it('сходинки рівня (проєкт II §7)', () => {
    [-54, -62, -70, -78, -88].forEach((t, r) => {
      expect(Math.abs(air({ route: r }).rxDbm - t)).toBeLessThanOrEqual(1.5);
      expect(air({ route: r, txPowerMw: 1 }).rxDbm).toBeCloseTo(air({ route: r }).rxDbm - 10, 6);
      expect(air({ route: r, txPowerMw: 0.1 }).rxDbm).toBeCloseTo(air({ route: r }).rxDbm - 20, 6);
    });
  });

  it('поле за 20 м — 0,03 V/m', () => {
    expect(air({ route: 0 }).fieldVm).toBeGreaterThan(0.027);
    expect(air({ route: 0 }).fieldVm).toBeLessThan(0.033);
  });

  it('пряма хвиля до кухні проходить одну цегляну стіну', () => {
    const ids = wallsBetween(SITE, SITE.tx, SITE.route[1]);
    expect(ids).toHaveLength(1);
    expect(SITE.walls.find((w) => w.id === ids[0])!.material).toBe('brick');
  });

  it('відчинені ворота: провали що 30 MHz', () => {
    const a = air({ route: 2, gate: 1, nudge: worst });
    expect(a.rays).toHaveLength(2);
    const extra = (a.rays[1].delayNs - a.rays[0].delayNs) * 0.299792458;
    expect(extra).toBeGreaterThan(9.1);
    expect(extra).toBeLessThan(11.1);
    /* responseDb(a, f) for f = 2400…2483 MHz in steps of 0.25: neighbouring minima are 27…33 MHz apart */
    const notch = dips(FREQS.map((f) => responseDb(a, f))).map((i) => FREQS[i]!);
    expect(notch.length).toBeGreaterThanOrEqual(2);
    for (const gap of gaps(notch)) {
      expect(gap).toBeGreaterThanOrEqual(27e6);
      expect(gap).toBeLessThanOrEqual(33e6);
    }
  });

  it('найглибша мертва точка й крок між ними', () => {
    const closed = air({ route: 2 }).rxDbm,
      depth = air({ route: 2, gate: 1, nudge: worst }).rxDbm - closed;
    expect(depth).toBeLessThanOrEqual(-8);
    expect(depth).toBeGreaterThanOrEqual(-10.5);
    /* neighbouring minima of rxDbm along nudge are 0.055…0.08 m apart; at nudge −0.15, 0 and +0.15 two rays each */
    const spots = dips(OPENED).map((i) => NUDGES[i]!);
    expect(spots.length).toBeGreaterThanOrEqual(2);
    for (const gap of gaps(spots)) {
      expect(gap).toBeGreaterThanOrEqual(0.055);
      expect(gap).toBeLessThanOrEqual(0.08);
    }
    for (const nudge of [-0.15, 0, 0.15]) expect(air({ route: 2, gate: 1, nudge }).rays).toHaveLength(2);
  });

  it('ворота діють плавно', () => {
    /* gate 0 and 0.3: one ray; at worst the level does not grow while gate goes 0.3 → 0.9 in steps of 0.05;
       gate 1 equals gate 0.9; at gate 0.45, 0.6 and 0.75 the level is notches.json.gate ± 0.3 dB */
    const at = (gate: number): Air => air({ route: 2, nudge: worst, gate });
    expect(at(0).rays).toHaveLength(1);
    expect(at(0.3).rays).toHaveLength(1);
    const levels = Array.from({ length: 13 }, (_, k) => at((30 + 5 * k) / 100).rxDbm);
    for (let k = 1; k < levels.length; k++) expect(levels[k]).toBeLessThanOrEqual(levels[k - 1]!);
    expect(at(1).rxDbm).toBeCloseTo(levels[12]!, 9);
    // the reflected ray comes in without a jump: just past 0.3 the level is still that of the shut gate
    expect(Math.abs(at(0.31).rxDbm - at(0).rxDbm)).toBeLessThan(0.01);
    for (const [gate, level] of Object.entries(notches.gate)) {
      const a = air({ route: notches.route, nudge: notches.worstNudge, gate: Number(gate) });
      expect(Math.abs(a.rxDbm - level)).toBeLessThanOrEqual(0.3);
    }
  });

  it('у мертвій точці інший канал живий', () =>
    expect(
      air({ route: 2, gate: 1, nudge: worst, txChannel: 1 }).rxDbm -
        air({ route: 2, gate: 1, nudge: worst }).rxDbm,
    ).toBeGreaterThanOrEqual(6));

  it('деко діє лише впритул і дає зерно, а не сніг', () => {
    const loss = (t: number) => air({ route: 1 }).rxDbm - air({ route: 1, tray: t }).rxDbm;
    expect(loss(0.7)).toBe(0);
    expect(loss(1)).toBeGreaterThanOrEqual(15);
    expect(loss(1)).toBeLessThanOrEqual(18);
    /* loss does not fall while tray goes 0 → 1 in steps of 0.05; at 0.75, 0.8, 0.9 and 1 loss = notches.json.tray ± 0.3 dB */
    const losses = Array.from({ length: 21 }, (_, k) => loss(k / 20));
    for (let k = 1; k < losses.length; k++) expect(losses[k]).toBeGreaterThanOrEqual(losses[k - 1]!);
    for (const [tray, db] of Object.entries(notches.tray))
      expect(Math.abs(loss(Number(tray)) - db)).toBeLessThanOrEqual(0.3);
  });

  it('незалежний розрахунок згоден', () => {
    /* ladder.json, five stops: |rxDbm − rxDbm10| ≤ 0.5 and wallsBetween(SITE, SITE.tx, stop) equals walls;
       notches.json: the deepest point ± 0.5 dB (and every point of the curve along nudge), every notch ± 0.5 MHz;
       the number of rays on route 0, 0.25, …, 4 with gate 1 equals rayCount */
    expect(ladder.stops).toHaveLength(5);
    ladder.stops.forEach((stop, r) => {
      expect(Math.abs(air({ route: r }).rxDbm - stop.rxDbm10)).toBeLessThanOrEqual(0.5);
      expect(wallsBetween(SITE, SITE.tx, SITE.route[r])).toEqual(stop.walls);
    });
    const levels = notches.nudge.map((nudge) => air({ route: notches.route, gate: 1, nudge }).rxDbm);
    expect(Math.abs(Math.min(...levels) - Math.min(...notches.rxDbm))).toBeLessThanOrEqual(0.5);
    levels.forEach((level, i) => expect(Math.abs(level - notches.rxDbm[i]!)).toBeLessThanOrEqual(0.5));
    const a = air({ route: notches.route, gate: 1, nudge: notches.worstNudge });
    const notch = dips(FREQS.map((f) => responseDb(a, f))).map((i) => FREQS[i]! / 1e6);
    expect(notch).toHaveLength(notches.notchMhz.length);
    notch.forEach((f, i) => expect(Math.abs(f - notches.notchMhz[i]!)).toBeLessThanOrEqual(0.5));
    const counts = notches.rayCount.map((_, k) => air({ route: k / 4, gate: 1 }).rays.length);
    expect(counts).toEqual(notches.rayCount);
  });

  it('промені в сигналі дають ту саму мертву точку', () => {
    /* a tone of steady amplitude 1 at the offset of each of the four channels (−0.27, −0.09, 0.09, 0.27 of the
       sample rate), 4000 pairs; apply(tone, air({ route: 2, gate: 1, nudge: worst }), 10, out):
       powerDbm(out, 100, 4000) = 10 + responseDb(a, CHANNELS[i]) ± 0.5 */
    const a = air({ route: 2, gate: 1, nudge: worst });
    [-0.27, -0.09, 0.09, 0.27].forEach((step, i) => {
      const tone = new Float32Array(8000);
      for (let n = 0; n < 4000; n++) {
        tone[2 * n] = Math.cos(2 * Math.PI * step * n);
        tone[2 * n + 1] = Math.sin(2 * Math.PI * step * n);
      }
      const out = new Float32Array(8000);
      createAir(1).apply(tone, a, 10, out);
      const level = 10 + responseDb(a, CHANNELS[i]!);
      expect(Math.abs(powerDbm(out, 100, 4000) - level)).toBeLessThanOrEqual(0.5);
    });
  });

  it('шум антени і крайні стани', () => {
    /* noise(out, 0.01) on 100 000 pairs: powerDbm = 10·lg(2·0.01²) ± 0.1; the same seed and reset() give the
       same bytes, for noise and for the delay lines of apply; air({ route: −1 }), ({ route: 9 }), ({ nudge: 1 }),
       ({ gate: 5 }), ({ tray: −1 }), ({ txPowerMw: 0 }), ({ txPowerMw: 100 }): rxDbm and fieldVm finite, at least
       one ray */
    const noise = (block: ReturnType<typeof createAir>): Float32Array => {
      const out = new Float32Array(200_000);
      block.noise(out, 0.01);
      return out;
    };
    const block = createAir(7);
    const first = noise(block);
    expect(Math.abs(powerDbm(first) - 10 * Math.log10(2 * 0.01 ** 2))).toBeLessThanOrEqual(0.1);
    expect(bits(noise(block))).not.toEqual(bits(first));
    expect(bits(noise(createAir(7)))).toEqual(bits(first));
    block.reset();
    expect(bits(noise(block))).toEqual(bits(first));

    const input = noise(createAir(3)).subarray(0, 8000);
    const opened = air({ route: 2, gate: 1, nudge: worst });
    const rays = (): Float32Array => {
      const out = new Float32Array(8000);
      block.apply(input, opened, 10, out);
      return out;
    };
    block.reset();
    const once = rays();
    expect(bits(rays())).not.toEqual(bits(once)); // the second call goes on from the first
    block.reset();
    expect(bits(rays())).toEqual(bits(once));

    for (const p of [
      { route: -1 },
      { route: 9 },
      { nudge: 1 },
      { gate: 5 },
      { tray: -1 },
      { txPowerMw: 0 },
      { txPowerMw: 100 },
    ]) {
      const a = air(p);
      expect(Number.isFinite(a.rxDbm)).toBe(true);
      expect(Number.isFinite(a.fieldVm)).toBe(true);
      expect(a.rays.length).toBeGreaterThanOrEqual(1);
    }
  });
});
