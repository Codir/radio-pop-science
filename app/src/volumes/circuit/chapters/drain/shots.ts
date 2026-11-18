/**
 * The chapter's own shots beside the stage's (`stand`, …) and the battery's (`battery`, `voltage`, …). World
 * coordinates; the stand is mounted at the origin.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { BATTERY, LAMP, STAGE_FOV, STAGE_SHOTS, boardToWorld } from '@circuit/shared/stage';

type V = [number, number, number];
const v3 = (v: Vector3): V => [v.x, v.y, v.z];

/** The stand shot's view direction (world, from the target toward the camera). */
const STAND_VIEW = new Vector3(...STAGE_SHOTS.stand.position)
  .sub(new Vector3(...STAGE_SHOTS.stand.target))
  .normalize();
/** Centre of the battery's can (world). */
export const BATTERY_CENTRE = boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z);
/** The lamp's globe centre (world). */
export const GLOBE = boardToWorld(LAMP.x, LAMP.filamentY, LAMP.z);

/**
 * `hours`: the stand plan lowered and pulled back a little (as `battery/voltage`): the whole stand, the lamp, the
 * frame on the right wire and, on the table in front, the meter with its probes on the clamps.
 */
const hours: Shot = {
  position: v3(new Vector3(-0.1, 1.05, 0.75).addScaledVector(STAND_VIEW, 11.6)),
  target: [-0.1, 1.05, 0.75],
  fov: STAGE_FOV,
  fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(0.2, -0.1, 0.55))), radius: 2.1 },
  orbit: { azimuth: 0.4, polar: 0.18, zoom: [0.85, 1.25] },
};

/**
 * `spent`: the section from the front-left and above, near enough for the zinc grains to read; the meter in front
 * of it and the lamp's light (globe at the upper right) still in the frame.
 */
const spentView = new Vector3(0.04, 0.52, 0.85).normalize();
const spentAim = BATTERY_CENTRE.clone().add(new Vector3(0.95, 0.1, -0.85));
const spent: Shot = {
  position: v3(spentAim.clone().addScaledVector(spentView, 9.3)),
  target: v3(spentAim),
  fov: STAGE_FOV,
  fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(-0.15, -0.3, 0.55))), radius: 1.5 },
  orbit: { azimuth: 0.25, polar: 0.12, zoom: [0.85, 1.2] },
};

/** `ghost`: the stand plan a little closer to the battery and the meter, the switch beside them, the lamp above. */
const ghostAim = BATTERY_CENTRE.clone().add(new Vector3(1.0, 0.45, -0.45));
const ghost: Shot = {
  position: v3(ghostAim.clone().addScaledVector(STAND_VIEW, 9.6)),
  target: v3(ghostAim),
  fov: STAGE_FOV,
  fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(0.3, -0.2, 0.5))), radius: 1.7 },
  orbit: { azimuth: 0.35, polar: 0.15, zoom: [0.85, 1.25] },
};

/** `inner` on entry: as `ghost`, pulled back and up a little so the lens lying on the lamp's glass is whole. */
const innerWideAim = ghostAim.clone().add(new Vector3(0.1, 0.3, -0.35));
const innerWide: Shot = {
  position: v3(innerWideAim.clone().addScaledVector(STAND_VIEW, 10.6)),
  target: v3(innerWideAim),
  fov: STAGE_FOV,
  fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(1.45, 0.8, -1.25))), radius: 2.75 },
  orbit: { azimuth: 0.35, polar: 0.15, zoom: [0.85, 1.25] },
};

/** Where the lens hangs over the battery in `inner` (`parts/lens-rig.ts` builds the same pose): the battery's
 *  middle lifted 1.25 toward the `innerWide` camera. */
export const LENS_ON_BATTERY = boardToWorld(BATTERY.x + 0.15, BATTERY.y, BATTERY.z);
const toGhost = new Vector3(...(innerWide.position as V)).sub(LENS_ON_BATTERY).normalize();
const lensSpot = LENS_ON_BATTERY.clone().addScaledVector(toGhost, 1.25);

/** `inner` once the lens is on the battery: pushed in along the same line, the ring large, the meter below it. */
const inner: Shot = {
  position: v3(lensSpot.clone().addScaledVector(toGhost, 5.6)),
  target: v3(lensSpot.clone().add(new Vector3(0.15, -0.12, 0))),
  fov: STAGE_FOV,
  fit: { center: v3(lensSpot), radius: 1.0 },
  orbit: { azimuth: 0.2, polar: 0.1, zoom: [0.9, 1.15] },
};

export const DRAIN_SHOTS = { hours, spent, ghost, innerWide, inner } satisfies Record<string, Shot>;
export type DrainShot = keyof typeof DRAIN_SHOTS | 'stand';
