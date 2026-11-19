import { describe, expect, it } from 'vitest';
import { routePoint } from '../channel';
import { LOSS_DB, SITE } from '../site';

describe('site', () => {
  it('форма подвір’я', () => {
    expect(SITE.route).toHaveLength(5);
    expect(Math.abs(Math.hypot(...SITE.nudgeAxis) - 1)).toBeLessThanOrEqual(1e-3);
    for (const wall of SITE.walls) expect(Object.keys(LOSS_DB)).toContain(wall.material);
    expect(LOSS_DB).toEqual({ brick: 8, wood: 3, glass: 1, slab: 10, iron: 30 });
  });

  it('зупинка 0 — за 20 м', () => {
    const [x, y, z] = SITE.route[0];
    const [tx, ty, tz] = SITE.tx;
    expect(Math.abs(Math.hypot(x - tx, y - ty, z - tz) - 20)).toBeLessThanOrEqual(0.1);
  });

  it('маршрут', () => {
    const middle = routePoint(SITE, 1.5);
    for (let k = 0; k < 3; k++) expect(middle[k]).toBeCloseTo((SITE.route[1][k] + SITE.route[2][k]) / 2, 12);
    expect(routePoint(SITE, 9)).toEqual([...SITE.route[4]]);
    /* exactly on the stops, and the other end of the route is held at stop 0 */
    SITE.route.forEach((stop, r) => expect(routePoint(SITE, r)).toEqual([...stop]));
    expect(routePoint(SITE, -1)).toEqual([...SITE.route[0]]);
  });
});
