/**
 * Putting the copper world where the stand hands the reader over (`W1-circuit-stage`, `HANDOVER` in
 * `shared/stage/shots.ts`): the camera looks across the near wire, the copper core fills the 3 : 2 safe frame.
 * After `mountAtHandover` the first frame of this world (depth 0, shot `core`) shows exactly that band of
 * copper from exactly that camera, so the two worlds can be exchanged by a dissolve.
 */
import { Matrix4, Vector3, type Object3D } from 'three';
import { CORE_R } from './core';

export interface Handover {
  /** The point on the wire axis under the lens, world units. */
  point: readonly [number, number, number];
  /** Unit direction the camera looks along at the hand-over (perpendicular to the wire). */
  view: readonly [number, number, number];
  /** Direction of the wire that is «right» in the frame. */
  axis: readonly [number, number, number];
  /** Radius of the copper core, world units. */
  coreRadius: number;
}

/** z of the wire's surface point in the copper world at depth 0 (see `Core.surface`). */
const SURFACE_Z = 0.35;

/**
 * Place and scale `group` (the `Copper.group`, a direct child of the scene root or of an untransformed group).
 * Returns the scale: pass it to `copperPost(depth, scale)` and `ctx.env.setScale`.
 */
export function mountAtHandover(group: Object3D, h: Handover): number {
  const x = new Vector3(...h.axis).normalize();
  const z = new Vector3(...h.view).normalize().negate(); // local +Z looks back at the reader
  const y = new Vector3().crossVectors(z, x).normalize();
  x.crossVectors(y, z); // exactly perpendicular even if the given axis was not
  const scale = h.coreRadius / CORE_R;
  group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  group.scale.setScalar(scale);
  // the wire's axis lies behind the surface point the reader looks at
  group.position.set(...h.point).addScaledVector(z, -(SURFACE_Z - CORE_R) * scale);
  group.updateMatrixWorld(true);
  return scale;
}
