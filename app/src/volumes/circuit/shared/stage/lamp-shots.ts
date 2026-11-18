/**
 * Camera shots of the lamp close up and the magnifier's pose over the lamp (README «The lamp close up»).
 * World coordinates for shots, board frame for the lens pose (as everywhere in the stage).
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { LAMP } from './layout';
import { STAGE_SHOTS, boardToWorld } from './shots';
import type { LensPose } from './tools';
import { worldDirToBoard, worldToBoard } from './tools';

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
const lampWorld = boardToWorld(LAMP.x, LAMP.filamentY, LAMP.z);
/** The lamp's middle between the bottom contact and the crown (world). */
const lampMiddle = boardToWorld(LAMP.x, LAMP.socketY + 0.62, LAMP.z);
/** The lamp's base where it enters the socket (world). */
const lampBase = boardToWorld(LAMP.x, LAMP.socketY + 0.02, LAMP.z);
/** Toward the open wedge, a little above it: into the socket. */
const baseView = new Vector3(-0.45, 0.42, 0.79).normalize();
/** From the front, a little left and above: into the open wedge of the base and across the coil. */
const view = new Vector3(-0.34, 0.3, 0.89).normalize();
/** The coil from nearly in front and a little above: the turns read as rings, the room's far blurs stay clear of it. */
const coilView = new Vector3(0.12, 0.34, 0.93).normalize();

export const LAMP_SHOTS = {
  /** The whole lamp, bottom contact to crown, filling the frame's height (`lamp/inside`, `lamp/hot-spot`). */
  lampInside: {
    position: v3(lampMiddle.clone().addScaledVector(view, 3.45)),
    target: v3(lampMiddle),
    fov: 39,
    near: 0.05,
    fit: { center: v3(lampMiddle), radius: 1.15 },
  },
  /** The base and the socket opened (`cut`): bottom contact, both leads, the solder drop on the collar. */
  lampBase: {
    position: v3(lampBase.clone().addScaledVector(baseView, 2.1)),
    target: v3(lampBase),
    fov: 30,
    near: 0.05,
    fit: { center: v3(lampBase), radius: 0.6 },
  },
  /** The coil fills the frame, seen from just outside the glass (`lamp/glow`). */
  lampCoil: {
    position: v3(lampWorld.clone().addScaledVector(coilView, 0.98)),
    target: v3(lampWorld),
    fov: 19,
    near: 0.03,
    fit: { center: v3(lampWorld), radius: 0.3 },
  },
} satisfies Record<string, Shot>;

/**
 * The magnifier over the lamp (`lamp/hot-spot`): between the camera and the lamp, facing the camera, 1.75× large;
 * its ring holds the coil, the leads, the base, the socket and the wires at the lamp's terminals — the hot coil and
 * the cold copper in one view. `from` = the camera's position (world; default the main shot's); `height` = the
 * board height its centre looks at (0.95: from the wires at the terminals to the coil).
 */
export function lampLensPose(
  scale = 1.75,
  from: readonly [number, number, number] = STAGE_SHOTS.stand.position,
  height = 0.95,
): LensPose {
  const centre = boardToWorld(LAMP.x, height, LAMP.z);
  const toCamera = new Vector3(...from).sub(centre).normalize();
  const spot = centre.clone().addScaledVector(toCamera, 1.6);
  const facing = worldDirToBoard(toCamera);
  const handle = new Vector3(0.7, -0.45, 0.55);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  return { position: worldToBoard(spot), facing, handle, scale, grip: 1 / scale };
}
