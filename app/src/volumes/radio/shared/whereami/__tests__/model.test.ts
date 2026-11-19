import { describe, expect, it } from 'vitest';
import { SITE } from '@radio/sim/core';
import { markerAt, nearestStop, planOf } from '../model';
import { nudgeSlider, routeSlider } from '../index';

describe('whereami', () => {
  it('найближча зупинка', () => {
    expect(nearestStop(-3)).toBe(0);
    expect(nearestStop(2.49)).toBe(2);
    expect(nearestStop(2.5)).toBe(3);
    expect(nearestStop(9)).toBe(4);
  });

  it('цятка стоїть на зупинках SITE', () => {
    for (let i = 0; i < 5; i++)
      expect(markerAt(SITE, i, 0)).toMatchObject({ x: SITE.route[i]![0], y: SITE.route[i]![1] });
  });

  it('льох — під перекриттям, кухня — ні', () => {
    expect(markerAt(SITE, 4, 0).below).toBe(true);
    expect(markerAt(SITE, 1, 0).below).toBe(false);
  });

  it('між зупинками й уздовж nudge', () => {
    expect(markerAt(SITE, 1.5, 0).x).toBeCloseTo((SITE.route[1][0] + SITE.route[2][0]) / 2, 9);
    expect(markerAt(SITE, 2, 0.15).x - markerAt(SITE, 2, 0).x).toBeCloseTo(0.15 * SITE.nudgeAxis[0], 9);
  });

  it('план містить усе з полем 1 м', () => {
    const p = planOf(SITE);
    expect(p.route).toHaveLength(5);
    expect(p.walls).toHaveLength(SITE.walls.length);
    expect(p.tx).toEqual([SITE.tx[0], SITE.tx[1]]); // the camera on the pole is drawn at tx (VISUAL.md §3)
    for (const q of [...p.route, { x: p.tx[0], y: p.tx[1] }]) {
      expect(q.x).toBeGreaterThanOrEqual(p.box[0] + 1);
      expect(q.x).toBeLessThanOrEqual(p.box[2] - 1);
      expect(q.y).toBeGreaterThanOrEqual(p.box[1] + 1);
      expect(q.y).toBeLessThanOrEqual(p.box[3] - 1);
    }
  });

  it('повзунки: межі й кроки в одному місці', () => {
    expect(routeSlider({ label: 'a', stops: ['0', '1', '2', '3', '4'] })).toMatchObject({
      type: 'slider',
      id: 'route',
      min: 0,
      max: 4,
      step: 0.01,
      value: 1,
    });
    expect(routeSlider({ label: 'a', stops: ['1', '2', '3', '4'], from: 1 })).toMatchObject({
      min: 1,
      marks: [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
      ],
    });
    expect(nudgeSlider({ label: 'b', unit: 'u' })).toMatchObject({
      id: 'nudge',
      min: -0.15,
      max: 0.15,
      step: 0.005,
      value: 0,
      unit: 'u',
    });
  });
});
