/**
 * A value the reader scrubs (UI_API §3.3) or a step moves: the thumb is `target`, the scene shows `shown`.
 * Dragged, `shown` IS the thumb; otherwise it glides there on a critically damped spring, so a glide starts and
 * ends at rest (no kick at the start, as a plain exponential would give) — the same law as `battery`'s «Розріз».
 */
export interface Scrub {
  target: number;
  shown: number;
  drag: boolean;
  /** Time constant of the glide (s). */
  tau: number;
  /** Speed of the glide (per s). */
  v: number;
}

export function scrub(value: number, tau: number): Scrub {
  return { target: value, shown: value, drag: false, tau, v: 0 };
}

/** One frame of the glide; `eps` = how close counts as arrived (in the value's units). */
export function stepScrub(s: Scrub, dt: number, eps = 1e-4): void {
  if (s.drag) {
    s.shown = s.target;
    s.v = 0;
    return;
  }
  const w = 1 / s.tau;
  // sub-steps keep the spring stable on a long frame
  let left = Math.min(dt, 0.1);
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    s.v += (w * w * (s.target - s.shown) - 2 * w * s.v) * h;
    s.shown += s.v * h;
    left -= h;
  }
  if (Math.abs(s.target - s.shown) < eps && Math.abs(s.v) < eps * 10) {
    s.shown = s.target;
    s.v = 0;
  }
}

/** Put it there at once (deep links). */
export function snapScrub(s: Scrub, value = s.target): void {
  s.target = s.shown = value;
  s.v = 0;
}
