import { describe, expect, it } from 'vitest';
import { LENS, type V3, monitorPlace, screenPlace } from '../layout';
import { YARD_SHOTS, screenShare, screenShot } from '../shots';

const KEYS = ['both', 'yard', 'pole', 'window', 'screen', 'antenna', 'route', 'top'] as const;
const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The subject sphere of a shot (every yard shot gives it as a centre and a radius). */
const fitOf = (k: (typeof KEYS)[number]): { center: V3; radius: number } =>
  YARD_SHOTS[k].fit as { center: V3; radius: number };

describe('shots', () => {
  it('вісім ракурсів, кожен із fit', () => {
    expect(Object.keys(YARD_SHOTS).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(YARD_SHOTS[k].fit).toBeDefined();
  });

  it('both: і об’єктив, і монітор на кухні — в кулі fit', () => {
    const { center, radius } = fitOf('both');
    expect(dist(center, LENS.position)).toBeLessThanOrEqual(radius);
    expect(dist(center, monitorPlace(1, 0).position)).toBeLessThanOrEqual(radius);
  });

  it('route: усі п’ять зупинок — у кулі fit', () => {
    const { center, radius } = fitOf('route');
    for (let i = 0; i < 5; i++) expect(dist(center, monitorPlace(i, 0).position)).toBeLessThanOrEqual(radius);
  });

  it('screenShare: екран на відстані 1 м', () =>
    expect(screenShare({ position: [0, 0, 1], target: [0, 0, 0] }, [0, 0, 0])).toBeCloseTo(0.155674, 5));

  it('монітор зблизька: від 6 % до чверті кадру на всьому маршруті', () => {
    expect(YARD_SHOTS.screen).toEqual(screenShot(1));
    for (const r of [0, 0.5, 1, 2, 3, 3.5, 4]) {
      const s = screenShare(screenShot(r), screenPlace(r));
      expect(s).toBeGreaterThanOrEqual(0.06);
      expect(s).toBeLessThanOrEqual(0.25);
      expect(screenShot(r).fit).toBeDefined();
    }
  });
});
