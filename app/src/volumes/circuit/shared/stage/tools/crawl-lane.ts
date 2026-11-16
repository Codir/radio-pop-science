/**
 * The geometry of the crawl (the owner's snail scene, DECISIONS §60 r–s): the wire's run from the battery's minus
 * clamp to the lamp — the way the electrons go — and the snail's own lane on the board beside it.
 *
 * The lane lies inside the loop, `LANE.inset` from the wire's axis: up the left side, one round corner, along the
 * far side to the lamp's terminal. It starts behind the minus clamp, just past the magnifier that lies on the
 * wire's start. Its length is what the snail really creeps, so the slider's length (1 mm/s) and the spark's
 * scale (0.044 mm/s) are both derived from it; the start is placed so that the scale is a whole number of
 * millimetres (a free choice of layout, not a rounding of physics).
 */
import { Vector3 } from 'three';
import { G } from '@/kit';
import { BATTERY, LAMP, LOOP, RULER } from '../layout';

/** True speeds, mm per second: a garden snail; the electrons' drift at 0.3 A in 0.5 mm² (v = I / (n·e·S)). */
export const CRAWL_SPEED = { snail: 1, spark: 0.044 } as const;
/** Board units per centimetre (the battery is 5 cm) and per millimetre. */
export const CM = (RULER.x1 - RULER.x0) / RULER.cm;
export const MM = CM / 10;

export const LANE = {
  /** Distance of the lane's centre line from the wire's axis, toward the inside of the loop. */
  inset: 0.56,
  /** Radius of the lane's one corner. */
  corner: 0.62,
  /** The farthest toward the reader the snail's nose may start (its body must clear the minus clamp and the lens). */
  startMaxZ: 0.3,
} as const;

/** The wire's axis along the run: minus clamp → left side → far side → the lamp's terminal (board frame). */
export function crawlPath(): Vector3[] {
  const y = LOOP.y;
  return G.roundPath(
    [
      new Vector3(BATTERY.minusX, y, LOOP.near),
      new Vector3(LOOP.left, y, LOOP.near),
      new Vector3(LOOP.left, y, LOOP.far),
      new Vector3(LAMP.x - LAMP.term, y, LOOP.far),
    ],
    LOOP.corner,
    14,
  );
}

export interface Lane {
  /** Length the snail creeps, board units / centimetres. */
  length: number;
  lengthCm: number;
  /** Seconds of true time for the whole lane and the millimetres one spark covers meanwhile (a whole number). */
  duration: number;
  scaleMm: number;
  /**
   * Point at distance `d` along the lane (it runs on straight before 0 and after the end), pushed `side` board
   * units toward the wire (negative: toward the middle of the board). Returns the unit tangent.
   */
  at(d: number, side: number, out: Vector3): Vector3;
}

export function createLane(): Lane {
  const xl = LOOP.left + LANE.inset;
  const zf = LOOP.far + LANE.inset;
  const xe = LAMP.x - LAMP.term;
  const r = LANE.corner;
  const arc = (Math.PI / 2) * r;
  // the longest lane that fits, then shortened at its start to a whole number of the spark's millimetres
  const longest = LANE.startMaxZ - (zf + r) + arc + (xe - (xl + r));
  const perMm = (MM * CRAWL_SPEED.snail) / CRAWL_SPEED.spark; // lane units per millimetre of the spark's way
  const scaleMm = Math.floor(longest / perMm + 1e-9);
  const length = scaleMm * perMm;
  const up = length - arc - (xe - (xl + r)); // the straight stretch up the left side
  const z0 = zf + r + up;
  const tangent = new Vector3();
  return {
    length,
    lengthCm: length / CM,
    duration: length / MM / CRAWL_SPEED.snail,
    scaleMm,
    at(d, side, out) {
      if (d <= up) {
        tangent.set(0, 0, -1);
        out.set(xl - side, 0, z0 - d);
      } else if (d <= up + arc) {
        const a = (d - up) / r;
        tangent.set(Math.sin(a), 0, -Math.cos(a));
        out.set(xl + r - (r + side) * Math.cos(a), 0, zf + r - (r + side) * Math.sin(a));
      } else {
        tangent.set(1, 0, 0);
        out.set(xl + r + (d - up - arc), 0, zf - side);
      }
      return tangent;
    },
  };
}
