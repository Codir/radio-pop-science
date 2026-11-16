/**
 * The dive as a position, not as a flight (DECISIONS §60 p, the owner's rule for every slider that drives an
 * animation in this volume: «ми можемо посунути слайдер в будь-яку позицію і стан стенду буде заанімований
 * відповідно до положення слайдеру»).
 *
 * `position` 0…3 is the whole dive: 0 the lens over the wire (shot `lens`) · 1 «жила» (`handover`) · 2 «ряди»
 * (`copper-rows`) · 3 «один атом» (`copper-atom`). Every frame it gives `deep` and a camera pose interpolated
 * between the stops (around the common target, log-distance — the push-in through the ring reads evenly), so
 * the frame is a pure function of the position: drag it, stop anywhere, go back.
 *
 * `scrub(t)` follows the hand directly (a slider's `drag`); `travelTo(t)` glides there with limited acceleration and
 * speed (a click on the track, keys, a step change): a full-range travel takes about as long as the old flights.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';

/** Speed and acceleration of a travel, in positions per second (²). 0 → 2 takes ≈ 4.2 s. */
const V_MAX = 0.6;
const A_MAX = 0.75;
const v = (a: Shot['position']): Vector3 =>
  a instanceof Vector3 ? a.clone() : new Vector3(...(a as readonly [number, number, number]));

export interface DiveRail {
  readonly position: number;
  readonly target: number;
  /** True while a travel is under way. */
  readonly moving: boolean;
  /** Follow the hand: the frame is the position at once (a slider's `drag`). */
  scrub(t: number): void;
  /** Glide to a position (eased, limited speed). */
  travelTo(t: number): void;
  /** Jump without motion (deep links). */
  set(t: number): void;
  /** Advance a travel; returns the position. */
  step(dt: number): number;
  /** The camera pose for a position (shots of the stops interpolated). */
  shotAt(t: number): Shot;
}

export function createDiveRail(stops: readonly Shot[]): DiveRail {
  const max = stops.length - 1;
  const clampT = (t: number): number => Math.min(Math.max(t, 0), max);
  let pos = 0;
  let target = 0;
  let speed = 0;
  const ta = new Vector3();
  const tb = new Vector3();
  const da = new Vector3();
  const db = new Vector3();
  const rail: DiveRail = {
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
    },
    travelTo(t) {
      target = clampT(t);
    },
    set(t) {
      pos = target = clampT(t);
      speed = 0;
    },
    step(dt) {
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
      const i = Math.min(Math.floor(c), max - 1);
      const k = c - i;
      const a = stops[i]!;
      const b = stops[i + 1]!;
      ta.copy(v(a.target));
      tb.copy(v(b.target));
      da.copy(v(a.position)).sub(ta);
      db.copy(v(b.position)).sub(tb);
      const la = da.length();
      const lb = db.length();
      // direction slerped, distance log-lerped: an even push-in from far to very near
      const dir = da.normalize().lerp(db.normalize(), k).normalize();
      const dist = la * Math.pow(lb / la, k);
      const target3 = ta.lerp(tb, k);
      const position = dir.multiplyScalar(dist).add(target3);
      const fov = (a.fov ?? 27) + ((b.fov ?? 27) - (a.fov ?? 27)) * k;
      return {
        position: [position.x, position.y, position.z],
        target: [target3.x, target3.y, target3.z],
        fov,
        near: Math.min(Math.max(dist * 0.03, 0.004), 2),
        fit: { center: [target3.x, target3.y, target3.z], radius: dist * 0.24 },
        drift: 0,
        orbit: { enabled: false },
      };
    },
  };
  return rail;
}
