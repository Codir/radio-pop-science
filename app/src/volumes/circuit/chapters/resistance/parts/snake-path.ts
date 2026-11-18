/**
 * The far wire as a snake (`shape`, VISUAL §5.7 «Дріт-змійка»): pure geometry, one function of the stretch `k`
 * (1 … 40; script: the wire is `k` times longer and its cross-section `k` times smaller).
 *
 * The far wire `m` runs along the far side to the lamp. From the place of the second seat (its staple) on, stretched,
 * it hangs from that line into
 * the empty middle of the board as a meander of ten runs (five folds, at any `k`: one wire, never a hatch), whose
 * depth grows with `k` while the tube thins — the handle's place is the bottom of the middle fold. The turns are
 * half circles; the outer folds hang a little shallower, so the snake has round shoulders. A fold of depth 0 is a
 * straight piece of the far line, so the family is continuous in `k`. Every `k` gives the same number of points
 * (`SNAKE_POINTS`), so a tube can be rewritten in place.
 *
 * The length on the board grows to about 10 times the straight wire at k = 40 (the script: «На дошці змійка, звісно,
 * значно коротша» of the true 40 times); the thinning is true to the section (radius ∝ 1/√k) down to a floor.
 */
import { Vector3 } from 'three';
import { LAMP, LOOP, SEAT, WIRE } from '@circuit/shared/stage';
import { standPath } from '@circuit/shared/stage/wires';

/** The stretch at the handle's end and the deepest the snake hangs (board units, from the far line). */
export const K_MAX = 40;
export const DEPTH_MAX = 2.3;
/** Where the snake starts (under the staple at the seat's place), where the far wire enters the lamp's terminal
 * (as `standPath('m')`), and the snake's zone. */
const INSET = 0.07;
export const FROM_X = SEAT.x;
export const TO_X = LAMP.x - LAMP.term + INSET;
export const ZONE = { from: 0.1, to: 1.92 } as const;
export const MIDDLE_X = (ZONE.from + ZONE.to) / 2;
/** Folds on each side of the middle one (five folds, ten runs), and the pitch of the runs that fills the zone. */
const FOLDS = 2;
const PITCH = (ZONE.to - ZONE.from) / (2 * (2 * FOLDS + 1));
/** Points of each rounded corner and the corners: four per fold. */
const CORNER_STEPS = 6;
const CORNERS = 4 * (2 * FOLDS + 1);
export const SNAKE_POINTS = 2 + CORNERS * (CORNER_STEPS + 1);
/** How deep each fold hangs against the middle one, from the middle out (round shoulders). */
const SHOULDER = [1, 0.94, 0.8] as const;

const clamp = (v: number, a: number, b: number): number => Math.min(Math.max(v, a), b);
const g = (k: number): number => (k - 1) / Math.sqrt(k);
const G_MAX = g(K_MAX);

/** How deep the middle fold hangs for a stretch `k` (0 at k = 1, `DEPTH_MAX` at `K_MAX`), and back. */
export function depthOf(k: number): number {
  return (DEPTH_MAX * g(clamp(k, 1, K_MAX))) / G_MAX;
}
export function stretchOf(depth: number): number {
  const q = (clamp(depth, 0, DEPTH_MAX) / DEPTH_MAX) * G_MAX;
  const r = (q + Math.sqrt(q * q + 4)) / 2;
  return clamp(r * r, 1, K_MAX);
}

/** The wire's radii at stretch `k`: the section is `k` times smaller (a floor keeps it a pixel or two wide). */
export function radiiOf(k: number): { core: number; sheath: number } {
  const s = 1 / Math.sqrt(clamp(k, 1, K_MAX));
  // the copper keeps a larger share of the thin wire, so that it still reads as copper in its sheath
  return { core: Math.max(WIRE.core * s, 0.0095), sheath: Math.max(WIRE.sheath * s, 0.017) };
}

/** Current on the stand for a stretch `k` (script: I = 1,5 V : (5 Ω + 0,0072 Ω × k²)), amperes. */
export function currentOf(k: number): number {
  return 1.5 / (5 + 0.0072 * k * k);
}

/**
 * The snake's path for a stretch `k` (board frame, at the wire's height), exactly `SNAKE_POINTS` points written
 * into `out`.
 */
export function snakePath(k: number, out: Vector3[] = []): Vector3[] {
  const kk = clamp(k, 1, K_MAX);
  const depth = depthOf(kk);
  const pitch = PITCH;
  const y = LOOP.y;
  const far = LOOP.far;
  const corners: Vector3[] = [];
  const at = (x: number, z: number): void =>
    void corners.push(new Vector3(clamp(x, ZONE.from, ZONE.to), y, z));
  for (let b = -FOLDS; b <= FOLDS; b++) {
    const centre = MIDDLE_X + 2 * b * pitch;
    const d = depth * SHOULDER[Math.abs(b)]!;
    at(centre - pitch / 2, far);
    at(centre - pitch / 2, far + d);
    at(centre + pitch / 2, far + d);
    at(centre + pitch / 2, far);
  }
  let n = 0;
  const put = (p: Vector3): void => void (out[n++] ??= new Vector3()).copy(p);
  put(new Vector3(FROM_X, y, far));
  const a = new Vector3();
  const e = new Vector3();
  const q = new Vector3();
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i]!;
    const prev = i > 0 ? corners[i - 1]! : out[0]!;
    const next = i + 1 < corners.length ? corners[i + 1]! : new Vector3(TO_X, y, far);
    const la = prev.distanceTo(p);
    const lb = next.distanceTo(p);
    // the corner's rounding: a quarter of the pitch at most, never more than half of either side
    const r = Math.min(pitch / 2, la * 0.49, lb * 0.49);
    a.copy(p).lerp(prev, la > 1e-9 ? r / la : 0);
    e.copy(p).lerp(next, lb > 1e-9 ? r / lb : 0);
    for (let s = 0; s <= CORNER_STEPS; s++) {
      const t = s / CORNER_STEPS;
      q.set(0, 0, 0)
        .addScaledVector(a, (1 - t) * (1 - t))
        .addScaledVector(p, 2 * t * (1 - t))
        .addScaledVector(e, t * t);
      put(q);
    }
  }
  put(new Vector3(TO_X, y, far));
  out.length = n;
  return out;
}

/** The stand's far wire up to its last corner (the minus clamp, the left side, the far left corner). */
const NEAR = standPath('m').slice(0, -1);
/**
 * Length of the far wire from the minus clamp to the snake's start (`FROM_X`): the wire is thin from there on
 * (`WireShape.thin`, centred so that its taper sits under the staple at the seat's place).
 */
export const SNAKE_FROM =
  NEAR.reduce((a, p, i) => (i ? a + p.distanceTo(NEAR[i - 1]!) : 0), 0) +
  NEAR[NEAR.length - 1]!.distanceTo(new Vector3(FROM_X, LOOP.y, LOOP.far));

/**
 * The whole far wire for a stretch `k`: its stand route up to the far left corner, then `snakePath(k)` to the lamp
 * — at k = 1 the very same line as `standPath('m')`, so the wire stays one tube with no join.
 */
export function farWirePath(k: number, out: Vector3[] = []): Vector3[] {
  const snake = snakePath(k);
  out.length = 0;
  for (const p of NEAR) out.push(p);
  for (const p of snake) out.push(p);
  return out;
}
