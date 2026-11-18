/**
 * Where the six clamps take a wire's end (board frame), which way a wire leaves each, where each end lies once it
 * is out, and the ground a loose wire lies on (the board, raised over the parts it crosses). The mouths and
 * directions are the stand's own (`wires.ts`: the stripped end sits `INSET` deep in its screw terminal).
 */
import { Vector3 } from 'three';
import { BATTERY, LAMP, LOOP, SWITCH, WIRE } from '@circuit/shared/stage';
import type { ClampId } from './circuit';

const INSET = 0.07;
const y = LOOP.y;

export interface Clamp {
  id: ClampId;
  /** The point the stripped end goes to (the wire's end on the stand). */
  mouth: Vector3;
  /** Unit direction in which the wire leaves the clamp (horizontal, board frame). */
  out: Vector3;
}

export const CLAMPS: Readonly<Record<ClampId, Clamp>> = {
  minus: {
    id: 'minus',
    mouth: new Vector3(BATTERY.minusX + INSET, y, LOOP.near),
    out: new Vector3(-1, 0, 0),
  },
  plus: { id: 'plus', mouth: new Vector3(BATTERY.plusX - INSET, y, LOOP.near), out: new Vector3(1, 0, 0) },
  swIn: { id: 'swIn', mouth: new Vector3(SWITCH.inX + INSET, y, LOOP.near), out: new Vector3(-1, 0, 0) },
  swOut: { id: 'swOut', mouth: new Vector3(SWITCH.outX - INSET, y, LOOP.near), out: new Vector3(1, 0, 0) },
  lampA: {
    id: 'lampA',
    mouth: new Vector3(LAMP.x - LAMP.term + INSET, y, LOOP.far),
    out: new Vector3(-1, 0, 0),
  },
  lampB: {
    id: 'lampB',
    mouth: new Vector3(LOOP.right, y, LAMP.z + LAMP.term - INSET),
    out: new Vector3(0, 0, 1),
  },
};

/** Height of a wire's axis lying on the board. */
export const LYING = WIRE.sheath + 0.004;

/**
 * Raised ground (rounded boxes, board frame): x0, x1, z0, z1, top of the wire's axis lying over it. A loose wire
 * drapes over the battery, the clamps' blocks, the switch and the lamp's post instead of sinking into them.
 */
const RAISED: readonly (readonly [number, number, number, number, number])[] = [
  [-1.78, 0.62, LOOP.near - 0.3, LOOP.near + 0.3, BATTERY.y + BATTERY.radius + 0.17],
  [-2.06, -1.72, LOOP.near - 0.3, LOOP.near + 0.3, 0.42],
  [0.6, 0.86, LOOP.near - 0.3, LOOP.near + 0.3, 0.42],
  [SWITCH.inX + 0.18, SWITCH.outX - 0.18, LOOP.near - 0.24, LOOP.near + 0.24, 0.5],
  [LAMP.x - 0.2, LAMP.x + 0.2, LAMP.z - 0.2, LAMP.z + 0.2, 0.95],
];
/** Width of the soft shoulder round each raised box. */
const SHOULDER = 0.18;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The height a wire's axis rests at over a board point. */
export function ground(x: number, z: number): number {
  let h = LYING;
  for (const [x0, x1, z0, z1, top] of RAISED) {
    const dx = Math.max(x0 - x, 0, x - x1);
    const dz = Math.max(z0 - z, 0, z - z1);
    const d = Math.hypot(dx, dz);
    if (d >= SHOULDER) continue;
    h = Math.max(h, LYING + (top - LYING) * smooth(1 - d / SHOULDER));
  }
  return h;
}

/** Board bounds a loose end may lie within (inside the face, clear of its rounded edge). */
export const AREA = { x0: -3.05, x1: 3.05, z0: -1.95, z1: 2.1 } as const;

/** Where each end lies once it has come out of its home clamp: out of the mouth and toward the reader. */
export const REST: Readonly<Record<'a0' | 'a1' | 'b0' | 'b1' | 'c0' | 'c1', Vector3>> = {
  c0: new Vector3(-2.2, LYING, 2.0),
  a0: new Vector3(0.15, LYING, 2.1),
  a1: new Vector3(1.3, LYING, 2.1),
  b0: new Vector3(2.15, LYING, 2.0),
  b1: new Vector3(2.78, LYING, -1.2),
  c1: new Vector3(1.78, LYING, -1.45),
};

/** The direction a resting end's wire leaves it (toward its body), board frame. */
export const REST_OUT: Readonly<Record<keyof typeof REST, Vector3>> = {
  c0: new Vector3(-0.2, 0, -1).normalize(),
  a0: new Vector3(1, 0, 0),
  a1: new Vector3(-1, 0, 0),
  b0: new Vector3(0.6, 0, -0.8).normalize(),
  b1: new Vector3(0, 0, 1),
  c1: new Vector3(-1, 0, -0.35).normalize(),
};
