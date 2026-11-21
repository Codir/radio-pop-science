/**
 * The floors of the bench's dive (docs/volumes/electronics/VISUAL.md §7), copied in its shape from
 * `circuit/shared/world/levels.ts` (shared/README.md, «Копії»): the floor ids of the volume's axis (`volume.json`), where
 * on the dive each one begins — data, not the nearest stop — and how long a flight takes. The circuit's composed copper
 * world (`mixAt`, the dissolve) and its flight legs (`legsBetween`) are not taken: the bench has no world below the
 * part yet, and its flight is one timed travel of the rail. Pure functions.
 *
 * The dive's position is the door's rail (`door.ts`): −`LENS_LEG` the step's own shot with the magnifier in its holder,
 * 0 the magnifier laid over the part, seen from about as far as the step's shot (the lens at work), 1 the part opened on
 * its place, close. The depth slider runs 0 … 1 + `LENS_LEG` and is the position + `LENS_LEG`.
 */
import { LENS_LEG } from './rail-math';

/** The floors of the volume's axis, from the top (`volume.json` → `axis.floors`). */
export type FloorId = 'stand' | 'part' | 'inside' | 'atoms';
export const FLOORS: readonly FloorId[] = ['stand', 'part', 'inside', 'atoms'];

/**
 * Where on the rail each floor below the stand begins (VISUAL §7: `part` from 0.5, `inside` from 1):
 * - `part` — halfway through the door: the push-in has brought the part large into the frame;
 * - `inside` — the end of the door: the ring has passed the camera and the part stands opened (`door.ts`);
 * - `atoms` — a third stop below `inside` (rail 2, from E3), the rule of `inside` one floor down.
 * On the depth slider: `part` from 1, `inside` at its end, 1 + `LENS_LEG`.
 */
export const FLOOR_FROM: Readonly<Record<Exclude<FloorId, 'stand'>, number>> = {
  part: 0.5,
  inside: 1,
  atoms: 2,
};

/** The floor the reader is on at a position of the dive's rail. */
export function floorAt(position: number): FloorId {
  if (position >= FLOOR_FROM.atoms) return 'atoms';
  if (position >= FLOOR_FROM.inside) return 'inside';
  if (position >= FLOOR_FROM.part) return 'part';
  return 'stand';
}

/**
 * How long a flight takes (VISUAL §7): the whole way from the step's shot into the opened part (−`LENS_LEG` … 1) in
 * `whole` seconds, with reduced motion in `reduced`; a shorter way in less, as the square root of its share of the
 * whole, but never under `least` (`leastReduced`). Never a cut: even reduced motion flies.
 */
export const FLIGHT = { whole: 2, reduced: 0.6, least: 0.45, leastReduced: 0.2 } as const;

/** Seconds of a timed travel of the rail over `span` positions. */
export function flightSeconds(span: number, reduced: boolean): number {
  const share = Math.min(Math.abs(span) / (1 + LENS_LEG), 1);
  const whole = reduced ? FLIGHT.reduced : FLIGHT.whole;
  return Math.max(reduced ? FLIGHT.leastReduced : FLIGHT.least, whole * Math.sqrt(share));
}
