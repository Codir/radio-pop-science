/**
 * What the course shows on the screen comes out of the model, and nothing draws it: the ladder of levels, the knee
 * of the cleanliness curve, torn lines below it, the five stops, the dead spot, the limiter and the oven's band.
 * Every test names the line of the design it proves.
 */
import { describe, expect, it } from 'vitest';
import { trace } from '../channel';
import { createFmLink } from '../fm-link';
import { SITE } from '../site';
import type { ChannelNo } from '../standard';
import { badRows, curve, measure, reference, S } from './curve';
import { argmax, FRAME, mean, meanPowerDbm, spread } from './helpers';

const link = createFmLink(2026);
const ref = reference(link);

/** «Move the antenna» from −0.15 to 0.15 m in steps of 0.0025: the grid of channel.test.ts and notches.json. */
const NUDGES = Array.from({ length: 121 }, (_, i) => (i - 60) / 400);
/** The level at stop 2 with the gate open along NUDGES, by `trace`; channel 3, 10 mW. */
const OPENED = NUDGES.map((nudge) => trace(SITE, S({ route: 2, gate: 1, nudge }).air).rxDbm);
/** The nudges where channel 3 is weakest (the dead spot) and strongest. */
const worst = NUDGES[argmax(OPENED.map((v) => -v))]!;
const best = NUDGES[argmax(OPENED)]!;

describe('emerges', () => {
  it('сходинки рівня збігаються з розрахунком (II §7, III §3)', { timeout: 120_000 }, () => {
    [-54, -62, -70, -78, -88].forEach((t, r) => {
      const f = link.step(S({ route: r }), FRAME, {
        tap: 'rx.shifted',
        view: 'arrow',
        start: 0,
        span: 1,
        columns: 512,
      });
      expect(Math.abs(f.meters.rxDbm - t)).toBeLessThanOrEqual(1.5);
      expect(
        Math.abs(meanPowerDbm(f.probe!.points) - 10 * Math.log10(10 ** (f.meters.rxDbm / 10) + 10 ** -9.2)),
      ).toBeLessThanOrEqual(1);
    }); // the level is in the signal, not only in the calculation: the wave plus the noise of −92 dBm
  });

  it('крива чистоти має злам біля межі частотної модуляції (III §3)', { timeout: 120_000 }, () => {
    const c = curve();
    expect(c.slopeAbove).toBeGreaterThanOrEqual(0.65);
    expect(c.slopeAbove).toBeLessThanOrEqual(1.2);
    expect(c.knee).toBeGreaterThanOrEqual(-86);
    expect(c.knee).toBeLessThanOrEqual(-76);
    expect(c.clean(-74) - c.clean(-82)).toBeGreaterThanOrEqual(12);
    expect(c.clean(-62)).toBeGreaterThanOrEqual(36);
    expect(c.clean(-88)).toBeLessThanOrEqual(16);
  });

  it('нижче межі синхроімпульси губляться, і рядки рвуться (III §3)', { timeout: 120_000 }, () => {
    const c = curve();
    expect(c.syncLost(-74)).toBeLessThan(0.02);
    expect(c.syncLost(-88)).toBeGreaterThan(0.5);
  });

  it(
    'п’ять зупинок: чисто · чисто · ледь зерно · зерно з першими іскрами · сніг; деко — зерно (II §0, §2)',
    { timeout: 120_000 },
    () => {
      // the five stops of the route with 10 mW, the gate shut; then the kitchen with the tray against the antenna
      const p = [0, 1, 2, 3, 4].map((route) => measure(link, S({ route }), ref));
      const tray = measure(link, S({ tray: 1 }), ref);
      expect(p[0].clean).toBeGreaterThanOrEqual(38);
      expect(p[1].clean).toBeGreaterThanOrEqual(38);
      expect(p[0].syncLost + p[1].syncLost).toBe(0);
      expect(p[2].clean).toBeGreaterThanOrEqual(32);
      expect(p[2].clean).toBeLessThanOrEqual(38);
      expect(p[1].clean - p[2].clean).toBeGreaterThanOrEqual(3);
      for (const q of [p[3], tray]) {
        expect(q.clean).toBeGreaterThanOrEqual(16);
        expect(q.clean).toBeLessThanOrEqual(28);
        expect(q.syncLost).toBeLessThanOrEqual(0.1);
      }
      expect(p[4].clean).toBeLessThanOrEqual(14);
      expect(p[4].syncLost).toBeGreaterThanOrEqual(0.5);
    },
  );

  it('у мертвій точці перемикання каналу повертає картинку (III §3)', { timeout: 120_000 }, () => {
    // stop 2 with the gate open, the antenna at the nudge where channel 3 is weakest by `trace`; the camera and the
    // monitor switch the channel together. The levels are read from the link's meter; the gate shut is nudge 0, as
    // the depth of channel.test.ts is counted.
    const dead = (txChannel: ChannelNo) => S({ route: 2, gate: 1, nudge: worst, txChannel });
    const rx = (ch: ChannelNo): number => link.step(dead(ch), FRAME).meters.rxDbm;
    const rxClosed = link.step(S({ route: 2 }), FRAME).meters.rxDbm;
    const cleanOn = (ch: ChannelNo): number => measure(link, dead(ch), ref).clean;
    expect(rx(3)).toBeLessThanOrEqual(rxClosed - 8);
    expect(cleanOn(1) - cleanOn(3)).toBeGreaterThanOrEqual(5);
  });

  it(
    'без обмежувача хитання воріт хитає яскравість, з обмежувачем — ні (II §6, «Чому частота, а не розмах»)',
    { timeout: 120_000 },
    () => {
      // stop 2, the antenna at the nudge where channel 3 is strongest; after reset() the gate rocks as
      // 0.6 + 0.3·sin(2πi/8), i = 0…9; m — the mean brightness of the screen in frames 2…9
      const rocking = (limiter: boolean): number[] => {
        const m: number[] = [];
        link.reset();
        for (let i = 0; i < 10; i++) {
          const gate = 0.6 + 0.3 * Math.sin((2 * Math.PI * i) / 8);
          const f = link.step(S({ route: 2, nudge: best, gate }, { limiter }), FRAME);
          if (i >= 2) m.push(mean(f.screen));
        }
        return m;
      };
      const mLimited = rocking(true);
      const mFree = rocking(false);
      expect(spread(mLimited)).toBeLessThanOrEqual(3);
      expect(spread(mFree)).toBeGreaterThanOrEqual(30);
    },
  );

  it('піч дає смугу на половину екрана, канали 1 і 2 від неї вільні (II §7)', { timeout: 120_000 }, () => {
    // the kitchen with the oven on: reset(), two frames of warming up, then the bad rows of each of three frames
    const bands = (txChannel: ChannelNo): number[][] => {
      const state = S({ oven: true, txChannel });
      link.reset();
      link.step(state, FRAME);
      link.step(state, FRAME);
      return [0, 1, 2].map(() => badRows(link.step(state, FRAME).screen, ref));
    };
    for (const n of bands(3)) {
      expect(n.length).toBeGreaterThanOrEqual(40);
      expect(n.length).toBeLessThanOrEqual(60);
      expect(Math.max(...n)).toBeLessThanOrEqual(52);
    }
    // the same on channel 1 (n1) and on channel 2 (n2), the bad rows of all three frames together
    const n1 = bands(1).flat();
    const n2 = bands(2).flat();
    expect(n1.length + n2.length).toBe(0);
  });
});
