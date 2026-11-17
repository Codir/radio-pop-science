/**
 * The crowd leaning to one side (`charge/shift`): a field outside the copper drives the free electrons toward
 * the far end of a piece until the electrons gathered there cancel it inside — then the crowd stands skewed,
 * crowded at one end and thinned at the other, while every electron keeps its random flight. Drawn as a
 * monotonic warp of the drawn x (the flight itself is untouched, so `lean` 0 is exactly today's picture):
 *
 *   u = (x − centre) / span,  |u| ≤ 1:  u' = 1 − 2 · ((1 − u) / 2)^p,  p = 1 + 1.6 · lean
 *
 * u' grows with u (nobody overtakes anybody) and the ends stay (u = ±1); the far end (+1) gathers the crowd —
 * at lean 0.85 the middle of the span moves 0.66 of the way to it, and the near half thins to a third — the way
 * charge piles up at the far surface. A negative lean mirrors it. Outside the span (off screen) nothing moves.
 * Easing `lean` from 0 to its value over about a second is the brief common rush of the script; holding it is
 * the halt.
 */

/** Largest |lean|. */
export const LEAN_MAX = 0.85;

/** The drawn x of an electron at x, for a crowd leaning by `lean` over `span` around `centre`. */
export function leanX(x: number, centre: number, span: number, lean: number): number {
  const k = Math.min(Math.max(lean, -LEAN_MAX), LEAN_MAX);
  if (k === 0 || span <= 0) return x;
  const s = Math.sign(k);
  const u = ((x - centre) / span) * s;
  if (u <= -1 || u >= 1) return x;
  const p = 1 + 1.6 * Math.abs(k);
  return centre + s * span * (1 - 2 * ((1 - u) / 2) ** p);
}
