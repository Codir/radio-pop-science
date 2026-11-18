/**
 * (A copy of `lamp/parts/…` — chapters do not import each other.)
 *
 * The loop of wire as a track for things carried along it (the heat lens in `hot-spot`): the stand's
 * `loopPath()` by length, a point / tangent for a share `s` (closed: 0 = 1, at the far side's second seat,
 * clockwise from above), and the share nearest a pointer on screen.
 */
import { Vector3, type Camera } from 'three';
import { boardToWorld, loopPath } from '@circuit/shared/stage';

export interface LoopTrack {
  /** Board-frame point at share `s` (wraps). */
  at(s: number, out: Vector3): Vector3;
  /** The share whose point is nearest to a pointer (NDC), seen by `camera`. */
  nearest(ndcX: number, ndcY: number, aspect: number, camera: Camera): number;
  /** Shortest signed way from `a` to `b` on the closed track (−½…½). */
  delta(a: number, b: number): number;
  /** Share of the track nearest a board point (xz only). */
  shareOf(x: number, z: number): number;
}

export function loopTrack(): LoopTrack {
  const pts = loopPath();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  const total = cum[cum.length - 1]!;
  const wrap = (s: number): number => s - Math.floor(s);
  const SAMPLES = 480;
  const world = Array.from({ length: SAMPLES }, () => new Vector3());
  const board = new Vector3();
  const screen = new Vector3();
  const track: LoopTrack = {
    at(s, out) {
      const d = wrap(s) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i]! < d) i++;
      const span = cum[i]! - cum[i - 1]! || 1;
      return out.copy(pts[i - 1]!).lerp(pts[i]!, (d - cum[i - 1]!) / span);
    },
    nearest(x, y, aspect, camera) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < SAMPLES; i++) {
        track.at(i / SAMPLES, board);
        boardToWorld(board.x, board.y, board.z, world[i]!);
        screen.copy(world[i]!).project(camera);
        const d = ((screen.x - x) * aspect) ** 2 + (screen.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i / SAMPLES;
        }
      }
      return best;
    },
    delta(a, b) {
      const d = wrap(b) - wrap(a);
      return d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d;
    },
    shareOf(x, z) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < SAMPLES; i++) {
        track.at(i / SAMPLES, board);
        const d = (board.x - x) ** 2 + (board.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i / SAMPLES;
        }
      }
      return best;
    },
  };
  return track;
}
