/**
 * Copied from `circuit/shared/world/dive.ts` (shared/README.md, «Копії»), unchanged below this note: the dive's
 * position maths for any stops — on the bench the stops are a part's (`door.ts`), the lead shot the step's.
 */
/**
 * The dive as a position, not as a flight (DECISIONS §60 p, the owner's rule for every slider that drives an
 * animation in this volume: «ми можемо посунути слайдер в будь-яку позицію і стан стенду буде заанімований
 * відповідно до положення слайдеру»).
 *
 * `position` −½…3 is the whole dive: −½ (`−LENS_LEG`) the stand plan with the lens in its holder (the `lead` shot) · 0 the lens
 * over the wire (shot `lens`) · 1 «жила» (`handover`) · 2 «ряди» (`copper-rows`) · 3 «один атом» (`copper-atom`).
 * Every frame it gives `deep`, the lens (`lensAt`, on the lens leg −1…0) and a camera pose interpolated between the
 * stops (around the common target, log-distance), so the frame is a pure function of the position: drag it, stop
 * anywhere, go back. Without a `lead` shot the rail starts at 0 (as before).
 *
 * The lens leg (−½…0, half a floor long; on the prologue's depth slider a fifth of the track): the lens rises out of its holder first, crosses the stand and settles on the near wire by
 * `LENS_LANDS`; the camera starts a moment later and comes to the rail's start, arriving with the speed the push-in
 * through the ring begins with — the ring leg (0…1) eases in (`RING_IN`), so a hand moving evenly along a slider sees
 * one continuous motion from the holder down into the wire (the owner, 2026-11-17: the slider's first move jumped).
 *
 * `scrub(t)` follows the hand directly (a slider's `drag`); `travelTo(t)` glides there with limited acceleration and
 * speed (a click on the track, keys, a step change): a full-range travel takes about as long as the old flights.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';

/** Speed and acceleration of a travel, in positions per second (²). 0 → 2 takes ≈ 4.2 s. */
const V_MAX = 0.6;
const A_MAX = 0.75;
/** Length of the lens leg in positions (the rail starts at −LENS_LEG when it has a `lead` shot). */
export const LENS_LEG = 0.5;
/** Share of the lens leg after which the lens lies on the wire (the camera still settles after it). */
export const LENS_LANDS = 0.85;
/** Share of the lens leg the lens rises alone before the camera starts to follow it. */
const CAMERA_FROM = 0.1;
/** Slope of the ring leg at its start (1 = the old even push-in): the push-in eases in from the lens leg's pace. */
const RING_IN = 0.22;

const v = (a: Shot['position']): Vector3 =>
  a instanceof Vector3 ? a.clone() : new Vector3(...(a as readonly [number, number, number]));
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
/** Cubic Hermite on 0…1 from 0 to 1 with end slopes `m0`, `m1`. */
const hermite = (x: number, m0: number, m1: number): number => {
  const x2 = x * x;
  const x3 = x2 * x;
  return -2 * x3 + 3 * x2 + m0 * (x3 - 2 * x2 + x) + m1 * (x3 - x2);
};

/** The ring leg's eased share (0…1 → 0…1, monotone; slope `RING_IN` at 0 and 1 at the end). */
export const ringEase = (x: number): number => hermite(clamp01(x), RING_IN, 1);
/**
 * The lens leg's camera share for its share u (still for `CAMERA_FROM`, eased in; at the end 1 per position, the
 * pace the ring leg starts with).
 */
export const leadCamera = (u: number): number => {
  const span = 1 - CAMERA_FROM;
  return hermite(clamp01((u - CAMERA_FROM) / span), 0, span * LENS_LEG);
};
/** The stage param `lens` for the lens leg's share u (the stand's own arc eases it: `LensModel.setPose`). */
export const leadLens = (u: number): number => clamp01(u / LENS_LANDS);

export interface DiveRail {
  /** The lowest position: −LENS_LEG with a `lead` shot, else 0. */
  readonly min: number;
  readonly position: number;
  readonly target: number;
  /** True while a travel is under way. */
  readonly moving: boolean;
  /** Follow the hand: the frame is the position at once (a slider's `drag`). */
  scrub(t: number): void;
  /** Glide to a position (eased, limited speed), or in exactly `seconds` (eased in and out: a rewind). */
  travelTo(t: number, seconds?: number): void;
  /** Jump without motion (deep links). */
  set(t: number): void;
  /** Advance a travel; returns the position. */
  step(dt: number): number;
  /** The camera pose for a position (shots of the stops interpolated). */
  shotAt(t: number): Shot;
  /** `deep` for a position (0 on the lens leg). */
  deepAt(t: number): number;
  /** The stage param `lens` for a position (0 in the holder at `min` … 1 from `LENS_LANDS` of the lens leg on). */
  lensAt(t: number): number;
  /** The position that shows a given `deep` and `lens` (where to engage the rail from a step's state). */
  positionOf(deep: number, lens: number): number;
}

export function createDiveRail(stops: readonly Shot[], lead?: Shot): DiveRail {
  const max = stops.length - 1;
  const min = lead ? -LENS_LEG : 0;
  /** Share of the lens leg at a position below 0. */
  const share = (c: number): number => (c + LENS_LEG) / LENS_LEG;
  const clampT = (t: number): number => Math.min(Math.max(t, min), max);
  let pos = 0;
  let target = 0;
  let speed = 0;
  /** A timed travel (`travelTo(t, seconds)`): where it started, how long it takes, how far it is. */
  let timed: { from: number; seconds: number; elapsed: number } | null = null;
  const ta = new Vector3();
  const tb = new Vector3();
  const da = new Vector3();
  const db = new Vector3();
  const fa = new Vector3();
  /** Camera pose between two shots at share `k` (target lerped, direction slerped, distance log-lerped). */
  const between = (a: Shot, b: Shot, k: number): { shot: Shot } => {
    ta.copy(v(a.target));
    tb.copy(v(b.target));
    da.copy(v(a.position)).sub(ta);
    db.copy(v(b.position)).sub(tb);
    const la = da.length();
    const lb = db.length();
    const dir = da.normalize().lerp(db.normalize(), k).normalize();
    const dist = la * Math.pow(lb / la, k);
    const target3 = ta.lerp(tb, k);
    const position = dir.multiplyScalar(dist).add(target3);
    const fov = (a.fov ?? 27) + ((b.fov ?? 27) - (a.fov ?? 27)) * k;
    return {
      shot: {
        position: [position.x, position.y, position.z],
        target: [target3.x, target3.y, target3.z],
        fov,
        near: Math.min(Math.max(dist * 0.03, 0.004), 2),
        fit: { center: [target3.x, target3.y, target3.z], radius: dist * 0.24 },
        drift: 0,
        orbit: { enabled: false },
      },
    };
  };
  const deepAt = (t: number): number => {
    const c = clampT(t);
    if (c <= 0) return 0;
    return c < 1 ? ringEase(c) : c;
  };
  const rail: DiveRail = {
    min,
    get position() {
      return pos;
    },
    get target() {
      return target;
    },
    get moving() {
      return pos !== target;
    },
    scrub(t) {
      // the hand on the thumb: the frame is where the thumb is (UI_API §3.3, `how = 'drag'`)
      pos = target = clampT(t);
      speed = 0;
      timed = null;
    },
    travelTo(t, seconds) {
      target = clampT(t);
      timed = seconds !== undefined && seconds > 0 ? { from: pos, seconds, elapsed: 0 } : null;
      if (timed) speed = 0;
    },
    set(t) {
      pos = target = clampT(t);
      speed = 0;
      timed = null;
    },
    step(dt) {
      if (timed) {
        timed.elapsed += dt;
        const k = Math.min(timed.elapsed / timed.seconds, 1);
        pos = timed.from + (target - timed.from) * (0.5 - 0.5 * Math.cos(Math.PI * k));
        if (k >= 1) {
          pos = target;
          timed = null;
        }
        return pos;
      }
      const dist = target - pos;
      if (dist === 0) return pos;
      // accelerate toward the target, never faster than V_MAX, braking in time to stop on it
      const want = Math.sign(dist) * Math.min(V_MAX, Math.sqrt(2 * A_MAX * Math.abs(dist)));
      speed += Math.max(-A_MAX * dt, Math.min(A_MAX * dt, want - speed));
      pos += speed * dt;
      if (Math.sign(target - pos) !== Math.sign(dist) || Math.abs(target - pos) < 1e-4) {
        pos = target;
        speed = 0;
      }
      return pos;
    },
    shotAt(t) {
      const c = clampT(t);
      if (c < 0 && lead) {
        // the lens leg: from the stand plan to the rail's start; the stand's framing (`fit`) and idle drift hand
        // over to the rail's on the way, so neither end of the leg differs from the shot it meets
        const k = leadCamera(share(c));
        const { shot } = between(lead, stops[0]!, k);
        const end = between(stops[0]!, stops[1]!, 0);
        const lf = lead.fit as { center: Shot['position']; radius: number } | undefined;
        const ef = end.shot.fit as { center: [number, number, number]; radius: number };
        if (lf) {
          fa.copy(v(lf.center)).lerp(v(ef.center), k);
          shot.fit = { center: [fa.x, fa.y, fa.z], radius: lf.radius * Math.pow(ef.radius / lf.radius, k) };
        }
        shot.drift = (lead.drift ?? 1) * (1 - k);
        return shot;
      }
      const i = Math.min(Math.floor(c), max - 1);
      const k = c - i;
      return between(stops[i]!, stops[i + 1]!, i === 0 ? ringEase(k) : k).shot;
    },
    deepAt,
    lensAt(t) {
      const c = clampT(t);
      return c < 0 ? leadLens(share(c)) : 1;
    },
    positionOf(deep, lens) {
      if (deep > 1e-4) {
        if (deep >= 1) return clampT(deep);
        // invert the ring leg's ease (monotone): bisection
        let lo = 0;
        let hi = 1;
        for (let n = 0; n < 40; n++) {
          const mid = (lo + hi) / 2;
          if (ringEase(mid) < deep) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }
      return lead && lens < 0.999 ? (clamp01(lens) * LENS_LANDS - 1) * LENS_LEG : 0;
    },
  };
  return rail;
}
