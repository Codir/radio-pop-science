/**
 * The plan of the miniature «where are we» (`VISUAL.md` §3) in numbers, from the yard of the model alone: the walls of
 * the house, the camera on the pole at `tx` (where the model sends from; the pole itself, `places.pole`, stands 0.35 m
 * to the north, the same point at the plan's scale), the monitor's five stops and where the monitor is now. Pure: no
 * DOM, no three. Plan axes as in `site.json`: x to the east, y to the north, metres.
 */
import { type Site, routePoint } from '@radio/sim/core';

export type Pt = readonly [number, number];

/** A point of the plan; `below` — under the slab (z < site.slabZ): the cellar. */
export interface PlanPoint {
  x: number;
  y: number;
  below: boolean;
}

/** What the plan draws: the box it fits in (west, south, east, north), the walls, the camera and the stops. */
export interface Plan {
  box: readonly [number, number, number, number];
  walls: readonly { a: Pt; b: Pt }[];
  tx: Pt;
  route: readonly PlanPoint[];
}

/** The margin of the plan's box round the walls, the camera and the stops, metres. */
const MARGIN = 1;

const onPlan = (site: Site, p: readonly [number, number, number]): PlanPoint => ({
  x: p[0],
  y: p[1],
  below: p[2] < site.slabZ,
});

export function planOf(site: Site): Plan {
  const walls = site.walls.map((w) => ({ a: w.a, b: w.b }));
  const tx: Pt = [site.tx[0], site.tx[1]];
  const route = site.route.map((p) => onPlan(site, p));
  const points: Pt[] = [tx, ...route.map((p): Pt => [p.x, p.y]), ...walls.flatMap((w) => [w.a, w.b])];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    box: [
      Math.min(...xs) - MARGIN,
      Math.min(...ys) - MARGIN,
      Math.max(...xs) + MARGIN,
      Math.max(...ys) + MARGIN,
    ],
    walls,
    tx,
    route,
  };
}

/**
 * Where the monitor's antenna is on the plan: `routePoint(site, route)` moved `nudge` metres along
 * `site.nudgeAxis`, as the yard places it (`yard/layout.ts`, `monitorPlace`). A `nudge` that is not a finite number
 * is the caller's mistake (`routePoint` throws on a NaN `route` the same way).
 */
export function markerAt(site: Site, route: number, nudge: number): PlanPoint {
  if (!Number.isFinite(nudge)) throw new RangeError(`markerAt: nudge is ${nudge}`);
  const [x, y, z] = routePoint(site, route);
  const [ax, ay] = site.nudgeAxis;
  return onPlan(site, [x + nudge * ax, y + nudge * ay, z]);
}

/** The stop nearest to `route` (halves go up), held to 0…4. */
export function nearestStop(route: number): 0 | 1 | 2 | 3 | 4 {
  if (Number.isNaN(route)) throw new RangeError('nearestStop: route is NaN');
  return Math.min(4, Math.max(0, Math.round(route))) as 0 | 1 | 2 | 3 | 4;
}
