/**
 * The only source of chance in the model: a seeded generator and normal noise drawn from a table of quantiles.
 * The generator works in 32-bit integers, so one seed gives the same numbers on every machine.
 */
export interface Rng {
  /** The next 32-bit unsigned integer. */
  u32(): number;
  /** Uniform in [0, 1): u32() / 2³². */
  float(): number;
  /**
   * Fills `out` with normal noise of standard deviation `sigma`. One u32() `v` gives two samples,
   * sigma·T[v >>> 16] and then sigma·T[v & 0xffff], T = GAUSS_TABLE; the last sample of an odd length takes
   * the first of the two.
   */
  gaussFill(out: Float32Array, sigma: number): void;
  /**
   * A generator of its own for a part of the model; `label` is a non-negative integer. It depends on the seed
   * and the label only, not on how many numbers this generator has already given.
   */
  fork(label: number): Rng;
}

const TABLE_SIZE = 65_536;

/**
 * Inverse of the normal distribution function by Peter Acklam's rational approximation
 * (relative error below 1.2·10⁻⁹ over the whole range 0 < p < 1).
 */
function normalQuantile(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ] as const;
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ] as const;
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ] as const;
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416] as const;
  const tail = 0.02425;
  if (p < tail || p > 1 - tail) {
    // the two tails mirror each other
    const q = Math.sqrt(-2 * Math.log(p < tail ? p : 1 - p));
    const x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < tail ? x : -x;
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/** 65 536 quantiles of N(0, 1): Φ⁻¹((i + 0.5) / 65 536). Built once, when the module loads. */
export const GAUSS_TABLE: Float32Array = (() => {
  const table = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) table[i] = normalQuantile((i + 0.5) / TABLE_SIZE);
  return table;
})();

/**
 * A mulberry32 generator, the same sequence as the engine's (`app/src/engine/random.ts`), but `u32()` gives the
 * integer itself. The state is kept within 32 bits, so the sequence stays exact however long it runs.
 * Seed 0 is replaced by 0x9e3779b9: `createRng(0)` and `createRng(0x9e3779b9)` are one generator, forks included.
 */
export function createRng(seed: number): Rng {
  const start = seed >>> 0 || 0x9e3779b9;
  let state = start | 0;
  const u32 = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    u32,
    float: () => u32() / 4_294_967_296,
    gaussFill(out, sigma) {
      const table = GAUSS_TABLE;
      const n = out.length;
      let i = 0;
      for (; i + 1 < n; i += 2) {
        const v = u32();
        out[i] = sigma * table[v >>> 16]!;
        out[i + 1] = sigma * table[v & 0xffff]!;
      }
      if (i < n) out[i] = sigma * table[u32() >>> 16]!;
    },
    fork: (label) => createRng((start ^ Math.imul(label + 1, 0x9e3779b1)) >>> 0),
  };
}
