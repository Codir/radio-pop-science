/**
 * The ground a loose wire's end and a lead lie on (board frame): copied from `ground()` of
 * `circuit/chapters/build/parts/clamps.ts` (shared/README.md, «Копії») with the raised boxes as data — the bench says
 * what stands up (the breadboard's body, the battery's box, the things on the base, the bodies of the parts on the
 * board) — instead of the circuit stand's fixed list. The clamps and the resting places of the practicum are not taken.
 */

/** A raised area: x0 … x1, z0 … z1 (board frame), and the height a wire's axis lies at over it. */
export interface Raised {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly top: number;
}

export interface Terrain {
  /** The height of a wire's axis lying on the flat (the base's face). */
  readonly lying: number;
  /** The height a wire's axis rests at over (x, z). */
  ground(x: number, z: number): number;
  /** Changes whenever the raised list does: a wire that keeps its shape while its ends stay rebuilds it then. */
  version(): number;
}

/** Width of the soft shoulder round each raised box. */
const SHOULDER = 0.18;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * `raised` is read at every call: a list that changes (the parts on the board) is followed at once; `version` says
 * when it changed (a fixed list: never).
 */
export function createTerrain(
  lying: number,
  raised: () => readonly Raised[],
  version: () => number = () => 0,
): Terrain {
  return {
    lying,
    ground(x, z) {
      let h = lying;
      for (const r of raised()) {
        const dx = Math.max(r.x0 - x, 0, x - r.x1);
        const dz = Math.max(r.z0 - z, 0, z - r.z1);
        const d = Math.hypot(dx, dz);
        if (d >= SHOULDER) continue;
        h = Math.max(h, lying + (r.top - lying) * smooth(1 - d / SHOULDER));
      }
      return h;
    },
    version,
  };
}
