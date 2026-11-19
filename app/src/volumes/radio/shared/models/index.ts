/**
 * The objects of the yard (B12): the camera, the pole, the monitor, the wicket and the fences, the shed, the garage,
 * the swing, the bicycle, the cat with the white spot, the tray, the phone, the house cut open and the neighbour's
 * window — each a kit model built once by `buildYardProps` from a plan. The models never read `sim/**`: the plan
 * (`YardPlan`, scene axes: x east, y up, z = −north; metres) gives them their places, and `yard/layout.ts` (B13)
 * makes the real one from the model's numbers; `SAMPLE_PLAN` is the same yard for tests and the sandbox.
 *
 * Conventions shared by every model (B13 relies on them):
 *   - small props (pole, wicket, swing, bicycle, cat, tray, phone, the neighbour's window) face their own +X and
 *     have their origin at the middle of their bottom (the pole: on the ground on its axis), so the yard sets
 *     `rotation.y = yaw`; the cameras look along −Z of their anchor `lens`, the monitor along +Z of its `screen`;
 *   - buildings (house, shed, garage) and fences are drawn in scene axes with their group at the origin;
 *   - colours are the muted recipes of VISUAL.md §4 (`SURFACE`), and nothing carries text.
 */
import type { Rng } from '@/engine/api';
import { type KitModel, island, streetLamp, trees } from '@/kit';
import { type Color, Mesh } from 'three';
import { bicycle } from './bicycle';
import { cameraModel } from './camera';
import { cat } from './cat';
import { picketFence } from './fence';
import { garage } from './garage';
import { SURFACE, house, mix, neighbourWindow, wallBox } from './house';
import { monitor } from './monitor';
import { phone } from './phone';
import { pole } from './pole';
import { shed } from './shed';
import { swing } from './swing';
import { tray } from './tray';
import { wicket } from './wicket';

export type V3 = readonly [number, number, number];
/** A point of the plan: [x, z] of the scene. */
export type P2 = readonly [number, number];
/** The first five are the `Material`s of the model's walls; 'white' — the white walls of the shed. */
export type WallLook = 'brick' | 'wood' | 'glass' | 'slab' | 'iron' | 'white';
export interface WallPlan {
  id: string;
  a: P2;
  b: P2;
  y0: number;
  y1: number;
  look: WallLook;
  /** Cut open: drawn up to 0.6 m above the house's slab, with a light band on the cut. */
  cut?: boolean;
  /** Openings with glass; `from`…`to` — metres along the wall from `a`, `y0`…`y1` — heights. */
  windows?: readonly { from: number; to: number; y0: number; y1: number }[];
}
/** A stretch of fence of one kind. */
export interface FenceRun {
  /** Polyline [x, z] of the scene, corners not rounded. */
  route: readonly P2[];
  /** Height, m. */
  height: number;
  /** Width of a picket and the gap between pickets along the fence, m; gap 0 — a solid fence. */
  picket: number;
  gap: number;
  /** A flat top board (the cat walks on it). */
  board: boolean;
  /** Stretches without fence, metres from the start of `route` (the wicket hangs there). */
  open?: readonly (readonly [number, number])[];
}
export interface YardPlan {
  radius: number;
  /** The middle of the island. */
  centre: P2;
  /** Two opposite corners of the trodden gravel of the back yard. */
  gravel: { a: P2; b: P2 };
  fences: readonly FenceRun[];
  trees: readonly P2[];
  /** The three points are where the anchors of those names go. */
  house: {
    walls: readonly WallPlan[];
    slabY: number;
    slabCut: { min: P2; max: P2 };
    sill: V3;
    microwave: V3;
    phone: V3;
  };
  /** The yard puts the neighbour's window with its anchor `router` at this point. */
  neighbour: { router: V3; yaw: number };
  /**
   * `wall` — the anchor `wall`: the middle of the white wall toward the camera; `nook` — the anchor `nook`, the dark
   * corner of the woodshed: no north wall there, its back and side walls are `ink` inside; `roofY` — the height of
   * the flat sheet-iron roof.
   */
  shed: { walls: readonly WallPlan[]; wall: V3; nook: V3; roofY: number };
  garage: {
    walls: readonly WallPlan[];
    gate: { hinge: P2; width: number; y0: number; y1: number; closedYaw: number; openYaw: number };
  };
}

export { bicycle } from './bicycle';
export { CAMERA, cameraModel } from './camera';
export { CAT, cat } from './cat';
export { picketFence } from './fence';
export { garage } from './garage';
export { HOUSE_SKIRT, SURFACE, house, neighbourWindow } from './house';
export { addKitchenBlock } from './kitchen';
export { MONITOR_ANTENNA, MONITOR_CASE, MONITOR_SCREEN, monitor } from './monitor';
export { phone } from './phone';
export { pole } from './pole';
export { shed } from './shed';
export { swing } from './swing';
export { tray } from './tray';
export { wicket } from './wicket';

export type YardProps = Record<
  | 'island'
  | 'fence'
  | 'trees'
  | 'lantern'
  | 'pole'
  | 'camera1'
  | 'camera2'
  | 'monitor'
  | 'wicket'
  | 'shed'
  | 'garage'
  | 'swing'
  | 'bicycle'
  | 'cat'
  | 'tray'
  | 'phone'
  | 'house'
  | 'neighbour',
  KitModel
>;

/** Grass of the yard and the leaves of its trees (VISUAL.md §4). */
const GRASS: Color = mix('green', 'steel', 0.7);
/**
 * The pit under the house: the bounding rectangle of the wall lines grown by this much on every side, down to
 * `PIT_BELOW` under the cellar floor. The margin comes from the island's grid (step 5 of B12): on an island of
 * radius 23 round (14; −1) of the plan the largest triangle under the rooms has a 0.70 m side, so every triangle
 * that touches a room has all three nodes on the bottom; the slope outside reaches 1.30 m from the outer face of
 * the wall, under the 1.4 m of `HOUSE_SKIRT`. Whoever moves the island recomputes both (the tests catch it).
 */
const PIT_MARGIN = 0.7;
const PIT_BELOW = 0.1;

/**
 * Every object of the yard, built once from the plan; `mountYard` (B13) places them. The island is built round its
 * own zero (put its group at `plan.centre`); house, shed, garage, fences and trees are already in scene axes; the
 * small props stand at their own origin.
 */
export function buildYardProps(plan: YardPlan, rng: Rng): YardProps {
  const h = plan.house;
  const { x0, x1, z0, z1 } = wallBox(h.walls);
  const cellar = Math.min(...h.walls.map((w) => w.y0));
  const [cx, cz] = plan.centre;
  const { a: ga, b: gb } = plan.gravel;
  const land = island({
    radius: plan.radius,
    wobble: 0,
    underside: 'slab',
    relief: 0,
    features: [
      // grass over the whole island, the gravel over it, then the pit (a later pad paints and lifts over an earlier)
      { type: 'pad', x: 0, z: 0, r: 1.2 * plan.radius, color: GRASS },
      {
        type: 'pad',
        x: (ga[0] + gb[0]) / 2 - cx,
        z: (ga[1] + gb[1]) / 2 - cz,
        w: Math.abs(gb[0] - ga[0]),
        d: Math.abs(gb[1] - ga[1]),
        corner: 0,
        blend: 0.05,
        color: SURFACE.slab.c,
      },
      {
        type: 'pad',
        x: (x0 + x1) / 2 - cx,
        z: (z0 + z1) / 2 - cz,
        w: x1 - x0 + 2 * PIT_MARGIN,
        d: z1 - z0 + 2 * PIT_MARGIN,
        corner: 0,
        blend: 0.05,
        y: cellar - PIT_BELOW,
      },
    ],
  });
  levelGrass(land);
  return {
    island: land,
    fence: picketFence(plan.fences),
    trees: trees(
      plan.trees.map(([x, z]) => ({ x, y: 0, z, tint: GRASS })),
      { rng },
    ),
    lantern: streetLamp({ kind: 'park', height: 3.2 }),
    pole: pole(),
    camera1: cameraModel(),
    camera2: cameraModel({ on: false }),
    monitor: monitor(),
    wicket: wicket(),
    shed: shed(plan.shed),
    garage: garage(plan.garage),
    swing: swing(),
    bicycle: bicycle(),
    cat: cat(),
    tray: tray(),
    phone: phone(),
    house: house(h),
    neighbour: neighbourWindow(),
  };
}

/**
 * The kit smooths the island's normals across the wall of the pit too (`computeVertexNormals` weighs faces by area,
 * and a face of the slope is up to 2.6 m tall), so grass up to 0.6 m beyond the skirt would shine like a slope. Every
 * vertex at exactly y = 0 is level ground (no relief; the pit and the rounded rim are lower): its normal points up.
 */
function levelGrass(model: KitModel): void {
  model.group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute('position');
    const n = o.geometry.getAttribute('normal');
    if (!p || !n) return;
    for (let i = 0; i < p.count; i++) if (p.getY(i) === 0) n.setXYZ(i, 0, 1, 0);
    n.needsUpdate = true;
  });
}

/* ------------------------------------------------------------------------------------------ the sample */

/** Plan point (east, north) → [x, z] of the scene. */
const at = (east: number, north: number): P2 => [east, -north];
/** Plan point (east, north, up) → scene point. */
const at3 = (east: number, north: number, up: number): V3 => [east, up, -north];
const brick = (id: string, a: P2, b: P2, more: Partial<WallPlan> = {}): WallPlan => ({
  id,
  a,
  b,
  y0: -2.5,
  y1: 2.7,
  look: 'brick',
  ...more,
});
const wood = (id: string, a: P2, b: P2, y1: number): WallPlan => ({ id, a, b, y0: 0, y1, look: 'wood' });
const white = (id: string, a: P2, b: P2): WallPlan => ({ id, a, b, y0: 0, y1: 2.4, look: 'white' });
const iron = (id: string, a: P2, b: P2, y0 = 0): WallPlan => ({ id, a, b, y0, y1: 2.6, look: 'iron' });

/**
 * The yard of VISUAL.md §2 in scene axes, for the tests and the sandbox: the island (radius 23, centre [14, 1] —
 * the point (14; −1) of the plan), the gravel and the walls of the house with their heights are its numbers, so the
 * tests of the pit and the skirt measure the same island grid as the real yard; `slabCut` lies in the far room.
 * The rest — places of the sill, the phone, the shed's anchors, fences, trees, garage — are its first numbers too;
 * `yard/layout.ts` (B13) makes the real plan from the model and corrects them on snapshots.
 */
export const SAMPLE_PLAN: YardPlan = {
  radius: 23,
  centre: at(14, -1),
  gravel: { a: at(-1.2, -9), b: at(4.6, -3.9) },
  fences: [
    { route: [at(-1.2, -9), at(-1.2, -3.9)], height: 1.8, picket: 0.14, gap: 0, board: false },
    {
      route: [at(-1.2, -3.9), at(-1.2, 12), at(30, 12)],
      height: 1.8,
      picket: 0.14,
      gap: 0.14,
      board: false,
      open: [[0.2, 1.2]],
    },
    { route: [at(-1.2, -3.9), at(4.6, -3.9)], height: 1.1, picket: 0.08, gap: 0.08, board: true },
    { route: [at(4.6, -3.9), at(4.6, -9)], height: 1.1, picket: 0.08, gap: 0, board: false },
  ],
  trees: [at(4, 10), at(15, 10.5), at(24, 10.5), at(-3.5, 6), at(-3.5, -1)],
  house: {
    walls: [
      brick('shell-w', at(19.2, -3), at(19.2, 3), { windows: [{ from: 1.2, to: 2.8, y0: 0.9, y1: 2.1 }] }),
      brick('shell-s', at(19.2, -3), at(28.6, -3), { cut: true }),
      brick('shell-n', at(19.2, 3), at(28.6, 3), { cut: true }),
      brick('shell-e', at(28.6, -3), at(28.6, 3)),
      wood('partition', at(21.4, -3), at(21.4, 3), 2.7),
      wood('cupboard', at(21.7, -3), at(21.7, 3), 2),
      brick('inner', at(25, -3), at(25, 3)),
      wood('wardrobe-doors', at(21.7, -2.4), at(25, -2.4), 2),
      wood('wardrobe-back', at(21.7, -2.7), at(25, -2.7), 2),
    ],
    slabY: -0.2,
    slabCut: { min: [25.6, 0.2], max: [27.8, 2.4] },
    sill: at3(19.8, 0, 0.84),
    microwave: at3(19.8, 0.6, 1.0),
    phone: at3(19.45, -0.8, 0.84),
  },
  neighbour: { router: at3(12, 14, 2), yaw: -Math.PI / 2 },
  shed: {
    walls: [
      white('shed-n', at(-1, -9), at(2.6, -9)),
      white('shed-w', at(-1, -9), at(-1, -12)),
      white('shed-s', at(-1, -12), at(4, -12)),
      white('shed-mid', at(2.6, -9), at(2.6, -12)),
      white('woodshed-e', at(4, -9), at(4, -12)),
    ],
    wall: at3(0.8, -9, 1.2),
    nook: at3(3.3, -9.2, 0.9),
    roofY: 2.4,
  },
  garage: {
    walls: [
      iron('garage-n', at(27.25, -4.8), at(32, -4.8)),
      iron('garage-e', at(32, -4.8), at(32, -9.7)),
      iron('garage-s', at(32, -9.7), at(27.25, -9.7)),
      iron('garage-w', at(27.25, -9.7), at(27.25, -7.23)),
      iron('garage-lintel', at(27.25, -7.23), at(27.25, -4.8), 2.2),
    ],
    gate: {
      hinge: at(27.25, -4.8),
      width: Math.hypot(27.25 - 25.8, -4.8 + 6.75),
      y0: 0,
      y1: 2.2,
      closedYaw: -Math.PI / 2,
      openYaw: Math.atan2(-(-4.8 + 6.75), 25.8 - 27.25),
    },
  },
};
