/**
 * Copied from `circuit/chapters/build/parts/curves.ts` (shared/README.md, «Копії»): the ground a curve sinks onto is a
 * parameter (`Terrain`) instead of the circuit stand's own. The peeled route of a wire held on the stand (`peeled`)
 * and `blend` (with its `resample`) are not taken: every lead of the bench has both ends free.
 *
 * The shapes of the bench's loose leads (board frame), pure geometry. A lead lies as one smooth curve between its two
 * ends (Hermite: each end leaves along its own direction); its middle sinks onto the ground and drapes over what stands
 * there; near the ends it keeps the ends' own heights.
 */
import { Vector3 } from 'three';
import type { Terrain } from './terrain';

/** Points of a curve sampled between two ends. */
export const SAMPLES = 72;
/** Length from an end over which the ground's influence fades in (the end keeps its own height). */
const END_HOLD = 0.24;

export interface EndPose {
  /** The tip (where the stripped copper ends). */
  pos: Vector3;
  /** Unit direction in which the wire leaves the tip, toward its body. */
  out: Vector3;
}

/** How a free wire lies: its own length (slack bows beside the chord) and to which side of it (±1). */
export interface Lay {
  length?: number;
  side?: number;
}

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Hermite from `a` (leaving along `a.out`) to `b` (arriving against `b.out`), `n` points into `out`; the middle sinks
 * toward the ground of `terrain` and drapes over raised ground.
 */
export function hermite(
  a: EndPose,
  b: EndPose,
  terrain: Terrain,
  out: Vector3[],
  n = SAMPLES,
  lay: Lay = {},
): Vector3[] {
  const LYING = terrain.lying;
  const chord = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  const L = lay.length;
  // a wire of a given length: the ends' tangents scale with the wire, not with the gap between its ends (a short
  // chord would curl it), and the slack it has over the chord lies beside it as a gentle bow on the board
  const k = L
    ? Math.min(Math.max(0.3 * Math.max(chord, 0.7 * L), 0.18), 1.3)
    : Math.min(Math.max(chord * 0.42, 0.22), 1.5);
  const bow =
    L && chord < L
      ? Math.min(0.42 * L, ((2 * chord) / Math.PI) * Math.sqrt(L / Math.max(chord, 0.05) - 1))
      : 0;
  const side = lay.side ?? 1;
  const px = chord > 1e-4 ? (-(b.pos.z - a.pos.z) / chord) * side : 0;
  const pz = chord > 1e-4 ? ((b.pos.x - a.pos.x) / chord) * side : 0;
  const length = Math.max(chord, L ?? 0) * 1.08 + 1e-6;
  const drop = Math.max(a.pos.y, b.pos.y) - LYING;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const p = (out[i] ??= new Vector3());
    p.x = h00 * a.pos.x + h10 * k * a.out.x + h01 * b.pos.x - h11 * k * b.out.x;
    p.z = h00 * a.pos.z + h10 * k * a.out.z + h01 * b.pos.z - h11 * k * b.out.z;
    if (bow > 0) {
      const w = bow * Math.sin(Math.PI * u);
      p.x += px * w;
      p.z += pz * w;
    }
    const y = h00 * a.pos.y + h01 * b.pos.y;
    // the middle lies down: the drop reaches the ground within a short way from either end
    const along = Math.min(u, 1 - u) * length;
    const sink = smooth(along / 0.34);
    const g = LYING + (terrain.ground(p.x, p.z) - LYING) * smooth(along / END_HOLD);
    p.y = Math.max(y - drop * sink, g);
  }
  out.length = n;
  return out;
}

/** Cumulative lengths of a polyline. */
export function lengths(pts: readonly Vector3[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  return acc;
}

/** Point and unit tangent at arc length `d` of a polyline (with its cumulative lengths). */
export function pointAt(
  pts: readonly Vector3[],
  acc: readonly number[],
  d: number,
  p: Vector3,
  t: Vector3,
): void {
  let i = 1;
  while (i < pts.length - 1 && acc[i]! < d) i++;
  const span = acc[i]! - acc[i - 1]! || 1;
  p.copy(pts[i - 1]!).lerp(pts[i]!, Math.min(Math.max((d - acc[i - 1]!) / span, 0), 1));
  t.copy(pts[i]!)
    .sub(pts[i - 1]!)
    .normalize();
}
