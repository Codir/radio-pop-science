/**
 * The yard laid out from the model's numbers (B13): every place of the scene derives from `SITE` (sim/core/site.json —
 * the camera's antenna, the monitor's route, the walls of the house, the slab, the garage leaf, the oven and the
 * router), and the rest — what the model does not know (the lens's aim, the angle of the monitor at each stop, the
 * small props, the shed, the garage, the fences, the trees, the island, the heights of the walls, the phone) — are
 * the numbers of VISUAL.md §2 «Подвір’я», chosen on the snapshots of B13. No `ctx` and no three objects here: plain
 * numbers, so the tests and the plan «де ми» (whereami/model.ts) read the same yard; with it, the only reader of
 * `SITE` in `shared/`.
 *
 * Axes: VISUAL.md writes plan points (x east, y north, z up; yaw in degrees from east toward north); the scene has
 * x east, y up, z = −north, 1 unit = 1 m (`toScene`, `toScene2`), and yaw here is in radians — a prop facing its own
 * +X gets `rotation.y = yaw`.
 */
import { SITE, routePoint } from '@radio/sim/core';
import {
  CAMERA,
  type FenceRun,
  MONITOR_ANTENNA,
  MONITOR_CASE,
  type P2,
  type V3,
  type WallPlan,
  type YardPlan,
} from '../models';

export type { P2, V3 } from '../models';

/** A plan point of `SITE` (east, north, up) → the scene (x, y up, z = −north). */
export const toScene = (p: V3): V3 => [p[0], p[2], -p[1]];
/** A plan point (east, north) → [x, z] of the scene. */
export const toScene2 = (p: readonly [number, number]): P2 => [p[0], -p[1]];
const deg = (d: number): number => (d * Math.PI) / 180;

/** The camera's antenna, where the model sends the wave from. */
const TX = toScene(SITE.tx);

/**
 * The eye: the lens `CAMERA.antennaUp` under the antenna, 40° of vertical field, aimed at `lookAt` (VISUAL.md §2): the
 * cat on the cross fence, the wicket, the white wall of the shed and the dark nook of the woodshed within 0.75 of the
 * half frame, a strip of sky over the shed's roof at the top and the yard in front of the cross fence at the bottom.
 * The sky's dark strip is part of what keeps the white wall at 200 or more under the eye's auto exposure; aimed any
 * higher, the wicket leaves the central 0.75 of the frame.
 */
export const LENS: { position: V3; lookAt: V3; fov: number } = {
  position: [TX[0], TX[1] - CAMERA.antennaUp, TX[2]],
  lookAt: toScene([0, -6.0, 1.0]),
  fov: 40,
};

/**
 * Where the screen looks at each stop (plan yaw, radians): −45° — south-east, so the screen is seen both from the
 * south (the reader's side in `route`) and from the east; from the kitchen window outside only the monitor's back
 * or edge shows (VISUAL.md §7).
 */
export const STOP_YAW: readonly [number, number, number, number, number] = [
  deg(-45),
  deg(-45),
  deg(-45),
  deg(-45),
  deg(-45),
];

/** Angle `a → b` along the shorter arc, radians in −π…π. */
const arc = (a: number, b: number): number => {
  const d = (b - a) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

/**
 * The monitor on its route: `position` is its anchor `monitorAntenna`, exactly where the model computes the field —
 * `routePoint(SITE, route)` moved `nudge` metres along `SITE.nudgeAxis` — and `yaw` (plan, radians) is where its
 * screen looks, between the neighbouring `STOP_YAW` along the shorter arc.
 */
export function monitorPlace(route: number, nudge: number): { position: V3; yaw: number } {
  const [x, y, z] = routePoint(SITE, route);
  const [ax, ay] = SITE.nudgeAxis;
  const r = Math.min(4, Math.max(0, route));
  const i = Math.min(3, Math.floor(r));
  const t = r - i;
  const a = STOP_YAW[i]!;
  return {
    position: toScene([x + nudge * ax, y + nudge * ay, z]),
    yaw: a + t * arc(a, STOP_YAW[i + 1]!),
  };
}

/**
 * The middle of the screen: `position − R_y(yaw + π/2) · MONITOR_ANTENNA` — the monitor's axes (+Z the screen's
 * normal, +Y up, +X to the right of a viewer in front of it) are the scene's turned by `yaw + π/2`.
 */
export function screenPlace(route: number, nudge = 0): V3 {
  const { position: p, yaw } = monitorPlace(route, nudge);
  const f = yaw + Math.PI / 2;
  const [mx, my, mz] = MONITOR_ANTENNA;
  return [
    p[0] - (mx * Math.cos(f) + mz * Math.sin(f)),
    p[1] - my,
    p[2] - (mz * Math.cos(f) - mx * Math.sin(f)),
  ];
}

/* ------------------------------------------------------------------------------------------- places */

type Place = { position: V3; yaw: number };
/** A place of VISUAL.md §2 «Місця, які знає лише сцена»: plan point and yaw in degrees. */
const place = (at: V3, yawDeg: number): Place => ({ position: toScene(at), yaw: deg(yawDeg) });

const PLACES: Record<
  'pole' | 'wicket' | 'cat' | 'shedWall' | 'nook' | 'swing' | 'bicycle' | 'lantern' | 'trayRest',
  Place
> = {
  // 0.35 m north of `tx`: the body of the first camera (tilted toward the cat) and its whip stand in front of it
  pole: place([0, 0.35, 0], -90),
  // the middle of the 1.0 × 1.8 m leaf in the west fence; the yard stands it on the ground under this point
  wicket: place([-1.2, -3.2, 0.9], 0),
  // the white spot on the cat's forehead, 0.29 m above its paws: the cat walks the top board (1.1 m) of the cross
  // fence side-on to the camera
  cat: place([0.6, -3.9, 1.39], 0),
  // the white of the eye's frame: the middle of the shed's north wall
  shedWall: place([0.8, -9.0, 1.2], 90),
  // the black of the eye's frame: the open woodshed, where the eye's ray meets the dark back wall face on, above the
  // logs (farther east it would meet the side wall at a slant, and the rim light would lift it)
  nook: place([2.95, -9.2, 1.2], 90),
  swing: place([8.0, 5.0, 0], 0),
  // on the skirt of the house, 0.5 m from the face of the west wall, north of the window
  bicycle: place([18.6, 1.6, 0], 90),
  // north of the cross fence, east of its end: it lights the cat's face, the pickets and the shed wall; it stands
  // outside the eye's frame (≈ 65° off its axis) and outside the shot `pole` on a desktop and on a phone (≈ 47° off
  // that shot's axis, where the desktop's frame reaches ≈ 27° and the phone's ≈ 32°)
  lantern: place([6.0, -2.8, 0], 0),
  // the tray on the worktop of the kitchen block (the middle of its bottom; the worktop's top is 0.86, B12)
  trayRest: place([19.7, 1.5, 0.86], 0),
};

/* ----------------------------------------------------------------------------------------- the plan */

/** Heights of the walls of the house (VISUAL.md «Стіни дому»): the model does not bound them in height. */
function wallHeights(id: string, look: WallPlan['look']): { y0: number; y1: number } {
  if (look === 'brick') return { y0: -2.5, y1: 2.7 }; // below 0 — the foundation, seen only in the cellar
  if (id === 'partition') return { y0: 0, y1: 2.7 };
  return { y0: 0, y1: 2 }; // the cupboards: no wood under the floor
}

/** The house's walls: each wall of `SITE` with the same id, its material as the look, cut walls and the window. */
const HOUSE_WALLS: WallPlan[] = SITE.walls.map((w) => ({
  id: w.id,
  a: toScene2(w.a),
  b: toScene2(w.b),
  look: w.material,
  ...wallHeights(w.id, w.material),
  // the kitchen window, y −1.8…−0.2, z 0.9…2.1, metres from a = (19.2; −3); the model's wall stays brick
  ...(w.id === 'shell-w' ? { windows: [{ from: 1.2, to: 2.8, y0: 0.9, y1: 2.1 }] } : {}),
  // `shell-s` stands between the reader and the rooms in `route`; beyond `shell-n` that shot sees the yard's stop
  ...(w.id === 'shell-s' || w.id === 'shell-n' ? { cut: true } : {}),
}));

/** The top of the window board under the monitor in the kitchen: under its antenna, at the bottom of its case. */
const KITCHEN = monitorPlace(1, 0).position;
const SILL: V3 = [KITCHEN[0], screenPlace(1)[1] - MONITOR_CASE.height / 2, KITCHEN[2]];

const white = (id: string, a: P2, b: P2): WallPlan => ({
  id,
  a: toScene2(a),
  b: toScene2(b),
  y0: 0,
  y1: 2.4,
  look: 'white',
});
const iron = (id: string, a: P2, b: P2, y0 = 0): WallPlan => ({
  id,
  a: toScene2(a),
  b: toScene2(b),
  y0,
  y1: 2.6,
  look: 'iron',
});

const GATE_A = toScene2(SITE.gateLeaf.a);
const GATE_B = toScene2(SITE.gateLeaf.b);

const PLAN: YardPlan = {
  // the island: VISUAL.md «Решта сцени»; the pit's margin and the skirt's width come from its grid (B12, step 5)
  radius: 23,
  centre: toScene2([14, -1]),
  // the trodden gravel of the back yard between the fences
  gravel: { a: toScene2([-1.2, -9]), b: toScene2([4.6, -3.9]) },
  fences: [
    // round the yard, 1.8 m: solid south of the corner with the cross fence, pickets 14 / 14 cm from there on,
    // with the wicket's opening y −3.7…−2.7
    {
      route: [toScene2([-1.2, -9]), toScene2([-1.2, -3.9])],
      height: 1.8,
      picket: 0.14,
      gap: 0,
      board: false,
    },
    {
      route: [toScene2([-1.2, -3.9]), toScene2([-1.2, 12]), toScene2([30, 12])],
      height: 1.8,
      picket: 0.14,
      gap: 0.14,
      board: false,
      open: [[0.2, 1.2]],
    },
    // the cross fence, 1.1 m: pickets 8 / 8 cm with the top board the cat walks, and its solid south leg
    {
      route: [toScene2([-1.2, -3.9]), toScene2([4.6, -3.9])],
      height: 1.1,
      picket: 0.08,
      gap: 0.08,
      board: true,
    },
    { route: [toScene2([4.6, -3.9]), toScene2([4.6, -9])], height: 1.1, picket: 0.08, gap: 0, board: false },
  ] satisfies FenceRun[],
  // the fifth stands in the north-west corner beyond the fence, next to the fourth: west of the pole it would stand
  // between the pole and the shots `yard` and `both` from the south-west
  trees: [
    toScene2([4, 10]),
    toScene2([15, 10.5]),
    toScene2([24, 10.5]),
    toScene2([-3.5, 6]),
    toScene2([-3.5, 9.5]),
  ],
  house: {
    walls: HOUSE_WALLS,
    slabY: SITE.slabZ,
    // over the cellar stop, on the reader's side in `route`: through it that shot sees the cellar's floor and the
    // screen at the cellar stop, and the monitor's way down from the far room passes through it
    slabCut: { min: toScene2([25.3, 0.4]), max: toScene2([27.8, -2.6]) },
    sill: SILL,
    microwave: toScene(SITE.oven.at),
    // flat on the same board, in front of the window
    phone: toScene([19.45, -0.8, SILL[1]]),
  },
  neighbour: { router: toScene(SITE.router.at), yaw: deg(-90) },
  shed: {
    // the shed x −1.0…2.6 and the woodshed x 2.6…4.0, y −12…−9, 2.4 m, all white; the woodshed has no north wall
    walls: [
      white('shed-n', [-1, -9], [2.6, -9]),
      white('shed-w', [-1, -9], [-1, -12]),
      white('shed-s', [-1, -12], [4, -12]),
      white('shed-mid', [2.6, -9], [2.6, -12]),
      white('woodshed-e', [4, -9], [4, -12]),
    ],
    wall: PLACES.shedWall.position,
    nook: PLACES.nook.position,
    roofY: 2.4,
  },
  garage: {
    // x 27.25…32.0, y −9.7…−4.8, 2.6 m, iron; the gate's opening on the west under a lintel from 2.2 m
    walls: [
      iron('garage-n', [27.25, -4.8], [32, -4.8]),
      iron('garage-e', [32, -4.8], [32, -9.7]),
      iron('garage-s', [32, -9.7], [27.25, -9.7]),
      iron('garage-w', [27.25, -9.7], [27.25, -7.23]),
      iron('garage-lintel', [27.25, -7.23], [27.25, -4.8], 2.2),
    ],
    gate: {
      hinge: GATE_A,
      width: Math.hypot(GATE_B[0] - GATE_A[0], GATE_B[1] - GATE_A[1]),
      y0: 0,
      y1: 2.2,
      // shut: in the plane of the garage's front wall, from the hinge south to (27.25; −7.23)
      closedYaw: -Math.PI / 2,
      // open: along `SITE.gateLeaf`, a → b (the leaf model lies along +X from the hinge at angle 0)
      openYaw: Math.atan2(-(GATE_B[1] - GATE_A[1]), GATE_B[0] - GATE_A[0]),
    },
  },
};

/** The leaf's angle: 0 — shut (`closedYaw`), 1 — open (`openYaw`), linear between. */
export function gateYaw(gate: number): number {
  const g = PLAN.garage.gate;
  const k = Math.min(1, Math.max(0, gate));
  return g.closedYaw + k * (g.openYaw - g.closedYaw);
}

export const LAYOUT: {
  plan: YardPlan;
  /** `toScene(SITE.tx)`: the camera's antenna. */
  tx: V3;
  places: typeof PLACES;
} = { plan: PLAN, tx: TX, places: PLACES };
