/**
 * The shots of the yard (B13, VISUAL.md §7), in scene axes, each with its `fit` (the subject sphere a phone keeps in
 * frame): `both` — the pole with the camera, the cat and the kitchen window with the monitor together («the original
 * and the copy»); `yard` — the whole yard; `pole` — over the camera's shoulder: the cat on the fence, the wicket, the
 * white wall and the nook; `window` — the kitchen window from outside; `screen` — the monitor close up wherever it
 * is (`screenShot`); `antenna` — the monitor's whip; `route` — the house cut open with all five stops; `top` — the
 * plan from above. `both` and `window` look past the monitor but keep it sharp (`focus`, VISUAL.md §5 «Різкість»).
 */
import type { Shot, Vec3Like } from '@/engine/api';
import { MONITOR_SCREEN } from '../models';
import { type V3, monitorPlace, screenPlace, toScene } from './layout';

/** Default vertical field and aspect of a shot's safe frame (the engine's director). */
const FOV = 32;
const ASPECT = 1.5;

/**
 * Where the camera of `screenShot` stands, in the monitor's axes (+Z the screen's normal, +Y up): 1.1 m in front of
 * the screen and a little above it — the screen is then about 12 % of the frame (VISUAL.md §5, §7).
 */
export const SCREEN_VIEW: V3 = [0, 0.25, 1.1];

const xyz = (v: Vec3Like): V3 => ('x' in v ? [v.x, v.y, v.z] : v);

/**
 * The share of the shot's safe frame the monitor's screen takes: the area of `MONITOR_SCREEN` over the area of the
 * safe frame (`fov ?? 32`, `frameAspect ?? 1.5`) at the distance from `shot.position` to `screenAt`; the screen's
 * tilt is neglected.
 */
export function screenShare(shot: Shot, screenAt: V3): number {
  const p = xyz(shot.position);
  const d = Math.hypot(p[0] - screenAt[0], p[1] - screenAt[1], p[2] - screenAt[2]);
  const h = 2 * d * Math.tan(((shot.fov ?? FOV) * Math.PI) / 360);
  return (MONITOR_SCREEN.width * MONITOR_SCREEN.height) / (h * h * (shot.frameAspect ?? ASPECT));
}

/**
 * The monitor close up wherever it is on the route: looking at the middle of the screen from `SCREEN_VIEW` in the
 * monitor's axes (turned by its yaw + π/2, as the yard turns the monitor). In the cellar the camera stands under the
 * slab, in the cellar itself (the plan's decision): the cellar is seen through the cut only from `route`.
 */
export function screenShot(route: number): Shot {
  const c = screenPlace(route);
  return { position: inMonitor(route, c, SCREEN_VIEW), target: c, fit: { center: c, radius: 0.45 } };
}

/** `at` + the offset `v` given in the axes of the monitor at `route` (turned by its yaw + π/2). */
function inMonitor(route: number, at: V3, v: V3): V3 {
  const f = monitorPlace(route, 0).yaw + Math.PI / 2;
  return [
    at[0] + v[0] * Math.cos(f) + v[2] * Math.sin(f),
    at[1] + v[1],
    at[2] - v[0] * Math.sin(f) + v[2] * Math.cos(f),
  ];
}

/**
 * Where the camera of `antenna` stands, in the monitor's axes from its antenna at the kitchen: in front of the screen
 * and to the right, a little above the whip — the whip in the middle of the frame, the screen only at its edge.
 */
const ANTENNA_VIEW: V3 = [0.42, 0.18, 0.5];
const KITCHEN_ANTENNA = monitorPlace(1, 0).position;

/** A shot of VISUAL.md §7 from plan points: position, target, the fit's centre and radius. */
const shot = (position: V3, target: V3, center: V3, radius: number, more: Partial<Shot> = {}): Shot => ({
  position: toScene(position),
  target: toScene(target),
  fit: { center: toScene(center), radius },
  ...more,
});

export const YARD_SHOTS: Readonly<
  Record<'both' | 'yard' | 'pole' | 'window' | 'screen' | 'antenna' | 'route' | 'top', Shot>
> = {
  both: shot([-2.0, -24.0, 12.0], [8.4, -0.2, 2.0], [9.6, -0.6, 2.0], 11.2, { focus: screenPlace(1) }),
  yard: shot([14, -45, 23], [14, -1, 1], [14, -1, 1], 21),
  pole: shot([3.0, 3.2, 4.4], [-0.2, -5.5, 1.0], [0.5, -4.5, 1.5], 6.5),
  window: shot([14.0, -4.5, 2.4], [19.2, -1.0, 1.4], [19.3, -0.8, 1.4], 1.6, { focus: screenPlace(1) }),
  screen: screenShot(1),
  antenna: {
    position: inMonitor(1, KITCHEN_ANTENNA, ANTENNA_VIEW),
    target: KITCHEN_ANTENNA,
    fit: { center: KITCHEN_ANTENNA, radius: 0.2 },
  },
  route: shot([22.5, -11.0, 14.0], [24.0, 0.3, 0], [23.0, 1.5, 0.2], 6.4),
  top: shot([14, -1.5, 75], [14, -1, 0], [14, -1, 0], 21),
};
