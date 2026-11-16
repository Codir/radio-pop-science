/**
 * Camera shots of the copper world, in its own frame (origin = the hero atom, X = the wire, +Z = toward the
 * reader). All share the field of view of the hand-over from the stand, so the dive never changes the lens.
 * `copperShots(group)` gives them in world space for the group as it is mounted (ENGINE_API §6).
 */
import { Vector3, type Object3D } from 'three';
import type { Shot } from '@/engine/api';
import { CAMERA_FOV, CAMERA_Z } from './core';
import { COPPER_TOP, PITCH } from './layout';

type Vec = [number, number, number];
interface LocalShot {
  position: Vec;
  target: Vec;
  /** Radius around `target` that must stay in frame on phones and tablets (Shot.fit). */
  fit: number;
}
const Z = CAMERA_Z;
const at = (target: Vec, offset: Vec, fit: number): LocalShot => ({
  position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
  target,
  fit,
});

export const COPPER_SHOTS = {
  /** The hand-over from the stand: square on to the wire, the core filling the safe frame (depth 0). */
  core: at([0, 0, 0], [0, 0, Z], 4.6),
  /** «Ряди атомів»: three rows in focus, from a little above so the planes behind show (depth 1). */
  rows: at([0, 0, 0], [0, 2.4, Z], 4.6),
  /** «Один атом» (depth 2) and the same with the electrons moved aside (`atom.apart`). */
  atom: at([0, 0, 0], [0, 1.5, Z], 5.4),
  apart: at([-2.6, 0, 0], [0, 1.5, Z], 4.8),
  /** `wire/shared`: a lone atom, a pair, a row of five, a piece of 15 (depth 1, `atoms` 1 / 2 / 5 / 15). */
  one: at([0, 0, 0], [0, 0.9, Z * 0.5], 2.4),
  pair: at([PITCH / 2, 0, 0], [0, 1.1, Z * 0.62], 3.6),
  row: at([0, 0, 0], [0, 1.8, Z], 7.8),
  piece: at([0, 0, 0], [0, 2.2, Z * 1.06], 7.8),
  /** `wire/restless` with the counter frame standing left of the middle (`sim.gate.x` ≈ −4.8): from here the
   *  perspective alone shows it as a narrow window. */
  gate: at([-0.6, 0, 0], [0, 2.4, Z], 6.4),
  /** `wire/plastic`: the top of the copper with the sheath above it, and inside the sheath. */
  edge: at([0, COPPER_TOP + 0.4, 0], [0, 1.6, Z], 4.8),
  plastic: at([0, COPPER_TOP + 8.6, 0], [0, 1.6, Z], 4.8),
} as const satisfies Record<string, LocalShot>;

export type CopperShot = keyof typeof COPPER_SHOTS;

/** Where the counter frame stands for the shot `gate` (`sim.gate.x`): in the gap left of the hero atom's column. */
export const GATE_SHOT_X = -4.8;

/** The shots in world space for a mounted copper world; register with `ctx.camera.shots(…)`. */
export function copperShots(group: Object3D, prefix = ''): Record<string, Shot> {
  group.updateWorldMatrix(true, false);
  const scale = group.matrixWorld.getMaxScaleOnAxis();
  const world = (v: Vec): Vec => new Vector3(...v).applyMatrix4(group.matrixWorld).toArray() as Vec;
  // The engine's camera keeps the world's «up». At the hand-over the world is mounted tilted (the reader looks
  // 41° down at the stand), and there any turn to the side rolls the frame — so no shot is turned sideways, and
  // the reader's own look-around to the sides is all but off unless the mount is upright.
  const tilted = new Vector3(0, 1, 0).transformDirection(group.matrixWorld).y < 0.998;
  return Object.fromEntries(
    Object.entries(COPPER_SHOTS).map(([name, s]) => [
      prefix + name,
      {
        position: world(s.position),
        target: world(s.target),
        fov: CAMERA_FOV,
        fit: { center: world(s.target), radius: s.fit * scale },
        // the picture is composed for the reader: only a small look-around
        orbit: { azimuth: tilted ? 0.03 : 0.3, polar: 0.16, zoom: [0.8, 1.25] as [number, number] },
        drift: tilted ? 0.4 : 1,
      },
    ]),
  );
}
