/**
 * Places of the lens in this chapter (board frame, `LensPose`): over a point of the loop, lifted toward the main
 * shot's camera along the line of sight, so that in the frame it sits right over that point — the way the stage's
 * `overWire` and `lampLensPose` are built. The handle points down and to the right, out of the loop.
 */
import { Vector3 } from 'three';
import { LOOP, STAGE_SHOTS, boardToWorld, worldDirToBoard, worldToBoard } from '@circuit/shared/stage';
import type { LensPose } from '@circuit/shared/stage/tools/lens';

const CAMERA = new Vector3(...STAGE_SHOTS.stand.position);

/**
 * The lens over the board point (x, `y`, z) — by default a point of the loop's wire —, `lift` units toward the
 * camera, drawn `scale` times larger. `out` is overwritten when given (a pose that follows a hand every frame).
 */
export function wireLensPose(
  x: number,
  z: number,
  scale = 1.2,
  lift = 1.5,
  out?: LensPose,
  y: number = LOOP.y,
): LensPose {
  const centre = boardToWorld(x, y, z);
  const toCamera = CAMERA.clone().sub(centre).normalize();
  const spot = centre.addScaledVector(toCamera, lift);
  const facing = worldDirToBoard(toCamera);
  const handle = new Vector3(0.62, -0.5, 0.6);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  if (!out) return { position: worldToBoard(spot), facing, handle, scale, grip: 1 / Math.max(scale, 1) };
  worldToBoard(spot, out.position);
  out.facing.copy(facing);
  out.handle.copy(handle);
  out.scale = scale;
  out.grip = 1 / Math.max(scale, 1);
  return out;
}
