import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BATTERY, LAMP, LOOP } from '../layout';
import { CM, CRAWL_SPEED, LANE, MM, createLane } from '../tools/crawl-lane';

describe('the crawl lane (DECISIONS §60 r–t)', () => {
  const lane = createLane();

  it('the slider is the snail at 1 mm/s over its whole lane', () => {
    expect(lane.duration).toBeCloseTo((lane.lengthCm * 10) / CRAWL_SPEED.snail, 9);
    expect(lane.length).toBeCloseTo(lane.lengthCm * CM, 9);
  });

  it('the spark covers a whole number of millimetres in that time — exactly the scale', () => {
    expect(Number.isInteger(lane.scaleMm)).toBe(true);
    expect(lane.duration * CRAWL_SPEED.spark).toBeCloseTo(lane.scaleMm, 9);
    expect(lane.scaleMm).toBeGreaterThanOrEqual(5);
  });

  it('starts behind the minus clamp and ends at the lamp terminal, inside the loop', () => {
    const p = new Vector3();
    lane.at(0, 0, p);
    expect(p.x).toBeCloseTo(LOOP.left + LANE.inset, 9);
    expect(p.z).toBeLessThanOrEqual(LANE.startMaxZ + 1e-9);
    // the body behind the nose (0.94 long) stays clear of the clamp's block (0.36 deep around the near side)
    expect(p.z + 0.94).toBeLessThan(BATTERY.z - 0.36);
    lane.at(lane.length, 0, p);
    expect(p.x).toBeCloseTo(LAMP.x - LAMP.term, 9);
    expect(p.z).toBeCloseTo(LOOP.far + LANE.inset, 9);
  });

  it('is continuous through its corner and measured in true length', () => {
    const a = new Vector3();
    const b = new Vector3();
    let walked = 0;
    const n = 2000;
    lane.at(0, 0, a);
    for (let i = 1; i <= n; i++) {
      lane.at((lane.length * i) / n, 0, b);
      const step = a.distanceTo(b);
      expect(step).toBeLessThan((lane.length / n) * 1.001);
      walked += step;
      a.copy(b);
    }
    expect(walked).toBeCloseTo(lane.length, 3);
    expect(MM * 10).toBeCloseTo(CM, 12);
  });
});
