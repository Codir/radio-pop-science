/**
 * The loop as a track for a bead (the counter frame): `u` 0…1 runs along the wire the electrons' way, from the
 * minus terminal round the loop to the plus terminal, leaving out the battery (the frame never goes into it).
 * The switch, the lamp's socket and the second seat are short hops — the frame lifts over them. Every place is
 * found from the stand's layout, not typed. Board frame.
 */
import { Vector3 } from 'three';
import { G } from '@/kit';
import { BATTERY, LAMP, LOOP, SEAT, SWITCH, loopPath, loopShare } from '@circuit/shared/stage';

/** The four stretches of wire `flow/same` counts in: from the minus, before the lamp, after it, near the plus. */
export type Zone = 'minus' | 'before' | 'after' | 'plus';

export interface LoopTrack {
  /** `loopPath()` parameter (the frame's `setOnLoop`) of a track position. */
  loopS(u: number): number;
  /** Point and tangent (board frame) of a track position. */
  at(u: number, point: Vector3, tangent?: Vector3): Vector3;
  /** Nearest track position to a board point (`from`/`reach`: search only that far around `from`). */
  nearest(p: Vector3, from?: number, reach?: number): { u: number; distance: number };
  /** How far the frame is lifted at `u` (0 on bare wire … 1 over a hop). */
  lift(u: number): number;
  zone(u: number): Zone | null;
  /** The middle of a zone (where `flow/loop` parks the frame: `plus`). */
  middle(zone: Zone): number;
  /** Track ends: the frame keeps this far inside (clear of the clamps). */
  readonly min: number;
  readonly max: number;
}

export function loopTrack(): LoopTrack {
  const path = loopPath();
  const total = G.pathLength(path);
  const tmp = new Vector3();
  const sOf = loopShare;
  const sMinus = sOf(BATTERY.minusX, LOOP.near);
  const span = (((sOf(BATTERY.plusX, LOOP.near) - sMinus) % 1) + 1) % 1;
  const uOf = (x: number, z: number): number => ((((sOf(x, z) - sMinus) % 1) + 1) % 1) / span;
  const margin = 0.13 / (total * span);
  const hops: [number, number][] = [
    [uOf(SEAT.x - SEAT.width / 2, LOOP.far), uOf(SEAT.x + SEAT.width / 2, LOOP.far)],
    [uOf(LAMP.x - LAMP.term, LOOP.far), uOf(LOOP.right, LAMP.z + LAMP.term)],
    [uOf(SWITCH.outX, LOOP.near), uOf(SWITCH.inX, LOOP.near)],
  ];
  const [seat, lamp, sw] = hops as [[number, number], [number, number], [number, number]];
  const track: LoopTrack = {
    min: margin,
    max: 1 - margin,
    loopS: (u) => (((sMinus + u * span) % 1) + 1) % 1,
    at(u, point, tangent) {
      return G.pathAt(path, track.loopS(u) * total, point, tangent);
    },
    nearest(p, from, reach) {
      const lo = from === undefined ? track.min : Math.max(track.min, from - (reach ?? 1));
      const hi = from === undefined ? track.max : Math.min(track.max, from + (reach ?? 1));
      let best = lo;
      let d = Infinity;
      const n = Math.max(8, Math.ceil(((hi - lo) * total * span) / 0.02));
      for (let i = 0; i <= n; i++) {
        const u = lo + ((hi - lo) * i) / n;
        const q = track.at(u, tmp).distanceTo(p);
        if (q < d) {
          d = q;
          best = u;
        }
      }
      return { u: best, distance: d };
    },
    lift(u) {
      let k = 0;
      const pad = 0.06 / (total * span);
      for (const [a, b] of hops) {
        const x = Math.min((u - (a - pad)) / pad, (b + pad - u) / pad, 1);
        k = Math.max(k, Math.max(x, 0));
      }
      return k * k * (3 - 2 * k);
    },
    zone(u) {
      if (u < seat[0]) return 'minus';
      if (u > seat[1] && u < lamp[0]) return 'before';
      if (u > lamp[1] && u < sw[0]) return 'after';
      if (u > sw[1]) return 'plus';
      return null;
    },
    middle(zone) {
      const ends: Record<Zone, [number, number]> = {
        minus: [track.min, seat[0]],
        before: [seat[1], lamp[0]],
        after: [lamp[1], sw[0]],
        plus: [sw[1], track.max],
      };
      const [a, b] = ends[zone];
      return (a + b) / 2;
    },
  };
  return track;
}
