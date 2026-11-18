/**
 * How hard the atoms of a wire tremble for a current (`resistance/heat`, later `lamp/*`): the heat a current makes
 * goes with its square (Joule – Lenz), so the trembling the lens shows over the rest it has without current is
 * `lattice.heat = top × (I / at)²`. `at` is the stand's working current (0.3 A), `top` the heat the script asks for
 * at it — trembling 8 % of the atom's diameter (VISUAL §6: 2–3 % at rest, up to 8 % in a working wire, 12 % hot).
 * Exaggerated beyond measure, as the script says: our wire warms by less than a tenth of a degree.
 */

/** `lattice.heat` that makes the trembling 8 % of the diameter (tremble 0.05 × (1 + 3.8 × heat) = 0.16 units). */
export const WORKING_HEAT = 0.58;

/** `lattice.heat` for a current `amps`; 0 without current, `top` at `at`, never above 1. */
export function trembleHeat(amps: number, at = 0.3, top = WORKING_HEAT): number {
  const k = Math.max(amps, 0) / at;
  return Math.min(top * k * k, 1);
}
