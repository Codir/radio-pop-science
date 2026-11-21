/**
 * Camera shots of the bench (docs/volumes/electronics/VISUAL.md §8), copied from `circuit/shared/stage/shots.ts`
 * (shared/README.md, «Копії»): the names `boardToWorld`, `STAGE_FOV`, `STAGE_POST` and `STAGE_SHOTS` are kept (plan
 * decision 23); the shots are the bench's own — `stand`, `board`, `phone`, `meter`, `scope`. The flashlight, the
 * crawl, the lamp close-up, the lens over the wire and the hand-over pose of `circuit` are gone. World coordinates;
 * the bench group is mounted at the world origin.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { BOARD } from './layout';
import { BOARD_Y } from './base';

const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);

/** Base frame → world (the bench group at the origin). */
export function boardToWorld(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, BOARD_Y + y * COS - z * SIN, y * SIN + z * COS);
}

/** Vertical field of view of the 3 : 2 safe frame used by every shot of the bench. */
export const STAGE_FOV = 27;

/**
 * Depth of field of the main shots (`mountBench` installs `stand` as the chapter base): the whole bench is sharp,
 * the table's far arc and the room go soft.
 */
export const STAGE_POST = {
  stand: { dofAperture: 1.5, dofRange: 2.7, dofMaxBlur: 9 },
} as const;

/** The orbit the reader gets around the bench's wide shots (as the circuit's main shot). */
const ORBIT = { azimuth: 0.5, polar: 0.22, zoom: [0.8, 1.35] } as const;

export const STAGE_SHOTS = {
  /**
   * The main shot «Стенд»: from the front and above, ≈ 55° to the face; the whole base, the lamp and the tray. Every
   * chapter starts and ends here.
   */
  stand: {
    position: [0, 10.8, 12.6],
    target: [0, 1.15, 0.95],
    fov: STAGE_FOV,
    fit: { center: [0, 1.1, 0.8], radius: 5.6 },
    orbit: ORBIT,
  },
  /** The field of sockets close: fine work, the board's print, the start of the magnifier. */
  board: {
    position: [-0.3, 7.6, 7.7],
    target: [-0.3, 1.45, 0.35],
    fov: STAGE_FOV,
    fit: { center: [-0.3, 1.8, 0.1], radius: 3.2 },
    orbit: ORBIT,
  },
  /**
   * The phone's shot instead of `stand` and `board` (VISUAL §9): only the field of sockets, steeply from above. Its
   * `fit` is centred on the middle of the sockets and holds the outer columns; the engine's re-framing puts the
   * sphere's circle into the free area, and the square around it holds the whole field.
   */
  phone: {
    position: [-0.3, 10.0, 5.8],
    target: [-0.3, 1.79, 0.08],
    fov: STAGE_FOV,
    fit: { center: [-0.3, 1.79, 0.08], radius: 2.55 },
  },
  /** The multimeter on the table on the left and the whole board. */
  meter: {
    position: [-2.2, 11.3, 12.9],
    target: [-1.9, 1.05, 0.85],
    fov: STAGE_FOV,
    fit: { center: [-2.4, 1.0, 0.9], radius: 5.45 },
    orbit: ORBIT,
  },
  /** The oscilloscope behind on the right and the whole board. */
  scope: {
    position: [1.6, 11.2, 12.6],
    target: [1.6, 1.4, -0.2],
    fov: STAGE_FOV,
    fit: { center: [2.0, 1.4, -0.8], radius: 5.6 },
    orbit: ORBIT,
  },
} satisfies Record<string, Shot>;

export type BenchShot = keyof typeof STAGE_SHOTS;

/**
 * The shots a chapter of the bench registers: on a phone every name of the bench (`stand`, `board`, `meter`,
 * `scope`) is the `phone` shot — the field of sockets is all a phone's scene shows; the number of the meter and the
 * oscilloscope's trace are in the dock there (VISUAL §9).
 */
export function benchShots(phone: boolean): Record<BenchShot, Shot> {
  if (!phone) return STAGE_SHOTS;
  const p = STAGE_SHOTS.phone;
  return { stand: p, board: p, phone: p, meter: p, scope: p };
}
