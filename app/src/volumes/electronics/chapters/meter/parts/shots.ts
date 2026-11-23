/**
 * The chapter's own shot and its flight. `amps` sees the supply jumper J10 from the left and in front, past the
 * reservoir's can that hides it in the bench's `meter` (review of E3-8); the bench's shots serve every other step.
 */
import type { Shot } from '@/engine/api';
import { STAGE_FOV, STAGE_SHOTS } from '@electronics/shared/bench';

/**
 * The step's shot on a desk and a tablet: the multimeter on the table and the board's left half, seen from the left
 * and in front (≈ 26° round from the front, ≈ 48° to the table). In the bench's `meter`, seen from the front, the
 * reservoir's tall can (C3, in e2/d2) stands before J10, the + rail's first sockets and the row 1ae: J10 showed as a
 * stub over its lid and the black probe's socket not at all (review of E3-8). From the left the sight lines to `+1`,
 * `a1` … `d1` and J10 pass beside the can (`__tests__/shot.test.ts`). `fit` (tablets; desktops ignore it, phones take
 * `phone`, steep already): a sphere just around the multimeter with its probes at rest, J10's ends, the gap's sockets
 * and the LED «on» (the smallest holds them at 3.19).
 */
export const AMPS_SHOT: Shot = {
  position: [-7.98, 11.59, 8.97],
  target: [-3.8, 1.0, 0.4],
  fov: STAGE_FOV,
  fit: { center: [-4.2, 1.1, 0.3], radius: 3.3 },
  orbit: STAGE_SHOTS.meter.orbit,
};
/** The flight into this shot and out of it into `scope` (s): the bench's 1,8 s would take ≈ 0,46 a frame. */
export const CAMERA_FLIGHT = 2.6;
