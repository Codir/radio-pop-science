/**
 * The oscilloscope's two pieces of arithmetic (docs/volumes/electronics/VISUAL.md §5.2; synthesis §5.2), with no
 * three.js and no allocation: they work on the instrument's own arrays.
 *
 * - `decimateMinMax` — a sweep of many samples drawn as a few hundred points: the smallest and the largest sample of
 *   every bucket, in their order in time, so that a peak is never lost between two points and a window of audio still
 *   draws as the band it is.
 * - `findTrigger` — where a sweep starts: the first sample at which the trace crosses the trigger's level the way its
 *   slope says.
 *
 * Both read a ring by the samples' absolute index: sample i of the stream is `ring[i mod ring.length]` (a plain array
 * read from 0 is the same thing).
 */

/** The array the decimation writes into: the instrument's own, made once. */
export type Points = Float32Array | Float64Array;

/** `i mod n` for any whole `i` (a ring's slot). */
const slot = (i: number, n: number): number => ((i % n) + n) % n;

/**
 * Min/max decimation: the samples [from, from + count) of `src` (a ring by absolute index) in `buckets` buckets as
 * even as possible — bucket b holds [from + ⌊b·count/buckets⌋, from + ⌊(b + 1)·count/buckets⌋) — and for every bucket
 * its smallest and its largest sample, in their order in time (the first of equal ones), as two points: the sample's
 * time `t0 + (i − from)·dt` into `outT` and its value into `outV`. A bucket of one sample gives that sample twice.
 * Fewer samples than buckets: a bucket a sample. Returns how many points were written, 2·min(buckets, count); it
 * allocates nothing. Output arrays shorter than that are a RangeError.
 */
export function decimateMinMax(
  src: ArrayLike<number>,
  from: number,
  count: number,
  buckets: number,
  outT: Points,
  outV: Points,
  t0: number,
  dt: number,
): number {
  if (!(Number.isInteger(from) && Number.isInteger(count) && count >= 0))
    throw new RangeError(`decimateMinMax: a whole first sample and count from 0: ${from}, ${count}`);
  if (!(Number.isInteger(buckets) && buckets >= 1))
    throw new RangeError(`decimateMinMax: a whole number of buckets from 1: ${buckets}`);
  const size = src.length;
  if (count > 0 && size === 0) throw new RangeError('decimateMinMax: no samples to read');
  const nb = Math.min(buckets, count);
  if (outT.length < 2 * nb || outV.length < 2 * nb)
    throw new RangeError(`decimateMinMax: ${2 * nb} points do not fit in ${Math.min(outT.length, outV.length)}`);
  let w = 0;
  for (let b = 0; b < nb; b++) {
    const a = Math.floor((b * count) / nb);
    const e = Math.floor(((b + 1) * count) / nb);
    let lo = a;
    let hi = a;
    let vlo = src[slot(from + a, size)]!;
    let vhi = vlo;
    for (let k = a + 1; k < e; k++) {
      const v = src[slot(from + k, size)]!;
      if (v < vlo) {
        vlo = v;
        lo = k;
      } else if (v > vhi) {
        vhi = v;
        hi = k;
      }
    }
    const [k1, v1, k2, v2] = lo <= hi ? [lo, vlo, hi, vhi] : [hi, vhi, lo, vlo];
    outT[w] = t0 + k1 * dt;
    outV[w++] = v1;
    outT[w] = t0 + k2 * dt;
    outV[w++] = v2;
  }
  return w;
}

/**
 * The first sample index i in [earliest, latest] at which the trace crosses `level` between samples i − 1 and i the
 * way `slope` says: rising (1) — s[i − 1] < level ≤ s[i]; falling (−1) — s[i − 1] > level ≥ s[i]. `ring` holds the
 * samples [head − size, head) by absolute index; a position whose pair is not all there is not searched. The holdoff
 * of a scope is its `earliest` (the end of the last sweep and the holdoff after it). −1 when there is none.
 */
export function findTrigger(
  ring: ArrayLike<number>,
  head: number,
  size: number,
  level: number,
  slope: 1 | -1,
  earliest: number,
  latest: number,
): number {
  const n = ring.length;
  if (n === 0 || !Number.isFinite(level)) return -1;
  const from = Math.max(earliest, head - Math.min(size, n) + 1);
  const to = Math.min(latest, head - 1);
  if (from > to) return -1;
  let prev = ring[slot(from - 1, n)]!;
  for (let i = from; i <= to; i++) {
    const v = ring[slot(i, n)]!;
    if (slope > 0 ? prev < level && v >= level : prev > level && v <= level) return i;
    prev = v;
  }
  return -1;
}
