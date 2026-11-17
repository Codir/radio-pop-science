/**
 * The lamp close up (VISUAL.md §5.3, PATH `lamp/inside`): what the camera finds when it comes to the lamp.
 *
 * - the fine coil: a real tight helix of thin tungsten (22 turns), uncoiled legs crimped into the support tips —
 *   it takes over from the stand's coarse coil only near the camera (`detail`), so far shots keep today's lamp;
 * - the two leads («ніжки») continued below the stem: one down through the cement and the insulating ring into
 *   the bottom contact drop, the other out over the brass collar's rim to a solder drop on its outside;
 * - `cut`: a wedge of the base opens toward the camera (clipping planes; world space, refreshed every frame);
 * - the current's path `contact → lead → coil → lead → thread` as an ordered polyline with anchors.
 *
 * Local frame = the bulb's (origin the bottom contact, axis +y). Pure geometry helpers are exported for tests.
 */
import { BufferAttribute, CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import { G } from '@/kit';
import type { BulbDims } from './bulb';

/** The fine coil: turns, radius of the helix, radius of the wire, half-length of the coiled part. */
export const FINE_COIL = { turns: 22, radius: 0.03, wire: 0.0052, half: 0.148 } as const;

/** The arch of the coil between the supports (the same as the stand's coarse coil): y offset at s 0…1. */
export const coilArch = (s: number): number => 0.035 * (1 - (2 * s - 1) ** 2);

/** The support wire inside the globe, side −1 (left) or +1 (right): stem → tip (local frame). */
export function supportPath(B: BulbDims, side: -1 | 1): Vector3[] {
  return G.roundPath(
    [
      new Vector3(side * 0.035, 0.6, 0),
      new Vector3(side * 0.05, 0.8, 0),
      new Vector3(side * (B.span + 0.012), B.filamentY - 0.06, 0),
      new Vector3(side * (B.span + 0.004), B.filamentY + 0.02, 0),
    ],
    0.08,
    5,
  );
}

/** Direction (local, horizontal) toward which the right lead leaves over the collar, and the base opens. */
export const FRONT = { lead: (35 * Math.PI) / 180, cut: (120 * Math.PI) / 180 } as const;

/** Lead A below the stem: down the axis through the cement into the contact drop (local; stem → contact). */
export function leadDown(): Vector3[] {
  return G.roundPath(
    [
      new Vector3(-0.035, 0.6, 0),
      new Vector3(-0.042, 0.44, 0.012),
      new Vector3(-0.026, 0.26, 0.03),
      new Vector3(-0.008, 0.1, 0.02),
      new Vector3(0, 0.045, 0),
    ],
    0.06,
    5,
  );
}

/** Lead B below the stem: out over the collar's rim, ending in the solder drop on its outside (stem → solder). */
export function leadOut(B: BulbDims): { points: Vector3[]; solder: Vector3 } {
  const c = Math.cos(FRONT.lead);
  const s = Math.sin(FRONT.lead);
  const r = B.threadRadius;
  const at = (radius: number, y: number): Vector3 => new Vector3(radius * c, y, radius * s);
  const points = G.roundPath(
    [
      new Vector3(0.035, 0.6, 0),
      new Vector3(0.05, 0.47, 0.01),
      at(r - 0.03, B.thread + 0.03),
      at(r + 0.006, B.thread + 0.016),
      at(r + 0.02, B.thread - 0.012),
    ],
    0.035,
    5,
  );
  return { points, solder: at(r + 0.016, B.thread - 0.016) };
}

/**
 * Centre line of the fine coil with its legs, from the left support's tip to the right one's (local frame).
 * `helix` false gives the coil's axis instead of the wire's spiral (for a marker that should not spin).
 */
export function finePath(B: BulbDims, helix = true, perTurn = 16): Vector3[] {
  const { turns, radius, half } = FINE_COIL;
  const pts: Vector3[] = [];
  const tip = (side: -1 | 1): Vector3 => new Vector3(side * (B.span + 0.004), B.filamentY + 0.012, 0);
  pts.push(tip(-1));
  const n = helix ? turns * perTurn : 24;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = s * turns * Math.PI * 2;
    const r = helix ? radius : 0;
    pts.push(new Vector3((s * 2 - 1) * half, B.filamentY + coilArch(s) + Math.cos(a) * r, Math.sin(a) * r));
  }
  pts.push(tip(1));
  return pts;
}

/** The fine coil's mesh geometry, with the cooler ends in its vertex colours (as the coarse coil). */
export function fineCoilGeometry(B: BulbDims): TubeGeometry {
  const pts = finePath(B);
  const g = new TubeGeometry(
    new CatmullRomCurve3(pts, false, 'catmullrom', 0.1),
    pts.length * 3,
    FINE_COIL.wire,
    8,
  );
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    // the legs and the last turns are cooler: the supports draw heat off the ends
    const edge = Math.min(Math.max((1 - Math.abs(pos.getX(i)) / (FINE_COIL.half + 0.01)) / 0.22, 0), 1);
    const k = 0.4 + 0.6 * edge ** 0.7;
    colors.set([k, k * k, k * k * k], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

/** Places along the current's path, as shares 0…1 of its length. */
export interface LampMarks {
  contact: number;
  /** The middle of the first lead, in the glass. */
  leadIn: number;
  coilStart: number;
  coilEnd: number;
  /** The middle of the second lead, in the glass. */
  leadOut: number;
  thread: number;
}

/**
 * The current's way through the lamp in the bulb's local frame: contact → lead → coil → lead → solder on the
 * thread, with the shares where each part starts. `helix` runs the coil part along the wire's spiral.
 */
export function lampPathLocal(B: BulbDims, helix = true): { points: Vector3[]; marks: LampMarks } {
  const down = leadDown().reverse(); // contact → stem
  const left = supportPath(B, -1); // stem → tip
  const coil = finePath(B, helix, 12);
  const right = supportPath(B, 1).reverse(); // tip → stem
  const out = leadOut(B);
  const parts = [[new Vector3(0, 0, 0)], down, left, coil, right, out.points, [out.solder]];
  const points: Vector3[] = [];
  const startOf: number[] = [];
  for (const part of parts) {
    startOf.push(points.length);
    for (const p of part)
      if (!points.length || points[points.length - 1]!.distanceToSquared(p) > 1e-10) points.push(p);
  }
  const at: number[] = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
  const total = at[at.length - 1]!;
  const share = (i: number): number => at[Math.min(i, at.length - 1)]! / total;
  // the middle of a lead inside the glass: halfway along the visible support wire
  const leadMid = (i0: number, i1: number): number => (share(i0) + share(i1)) / 2;
  return {
    points,
    marks: {
      contact: 0,
      leadIn: leadMid(startOf[2]!, startOf[3]!),
      coilStart: share(startOf[3]!),
      coilEnd: share(startOf[4]!),
      leadOut: leadMid(startOf[4]!, startOf[5]!),
      thread: 1,
    },
  };
}
