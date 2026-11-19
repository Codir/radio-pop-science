/**
 * The fast Fourier transform and the power spectrum the probe's scale shows.
 *
 * `createFft(n)` is the radix-2 transform of n pairs in place: the pairs are put in bit-reversed order, then
 * log₂(n) passes of butterflies join halves of growing length. It gives X[k] = Σ x[n]·e^(−j2πkn/n) without any
 * scaling, so Σ|X|²/n = Σ|x|². `powerSpectrumDb` lays the Hann window over the first `size` pairs of a block,
 * transforms them and divides by the square of the window's sum: a tone that falls on a bin shows its own power
 * there, in dBm. The bins are put in the order of frequency: out[0] is the lowest one (−half the rate), out[size/2]
 * is zero, the middle of the block's band.
 */
import { ampToDbm } from './units';

export interface Fft {
  readonly size: number;
  /** The transform of the first `size` numbers of `re` and `im`, in place: X[k] = Σ x[n]·e^(−j2πkn/size), no scaling. */
  forward(re: Float32Array, im: Float32Array): void;
}

const TWO_PI = 2 * Math.PI;
const SIZES: readonly number[] = [256, 512, 1024, 2048];
/** The lowest level a bin shows, dBm: the floor of units.ts. */
const FLOOR_DBM = ampToDbm(0);

/** The radix-2 transform of n pairs (n is 256, 512, 1024 or 2048), in place. */
export function createFft(n: 256 | 512 | 1024 | 2048): Fft {
  if (!SIZES.includes(n)) throw new RangeError(`createFft: ${n} pairs (256, 512, 1024 or 2048)`);
  const bits = Math.log2(n);
  // where each pair goes: its index with the bits in reverse order
  const reversed = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0, v = i; b < bits; b++, v >>= 1) r = (r << 1) | (v & 1);
    reversed[i] = r;
  }
  // e^(−j2πk/n) for k < n/2
  const half = n >> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos((TWO_PI * k) / n);
    sin[k] = -Math.sin((TWO_PI * k) / n);
  }
  return {
    size: n,
    forward(re, im) {
      if (re.length < n || im.length < n) {
        throw new RangeError(`fft of ${n}: ${re.length} and ${im.length} numbers`);
      }
      for (let i = 0; i < n; i++) {
        const j = reversed[i]!;
        if (j > i) {
          const a = re[i]!;
          re[i] = re[j]!;
          re[j] = a;
          const b = im[i]!;
          im[i] = im[j]!;
          im[j] = b;
        }
      }
      // join pairs of transforms of length `span` into one of length 2·span
      for (let span = 1, stride = half; span < n; span <<= 1, stride >>= 1) {
        for (let start = 0; start < n; start += span << 1) {
          for (let k = 0; k < span; k++) {
            const wr = cos[k * stride]!;
            const wi = sin[k * stride]!;
            const a = start + k;
            const b = a + span;
            const br = re[b]!;
            const bi = im[b]!;
            const tr = br * wr - bi * wi;
            const ti = br * wi + bi * wr;
            const ar = re[a]!;
            const ai = im[a]!;
            re[b] = ar - tr;
            im[b] = ai - ti;
            re[a] = ar + tr;
            im[a] = ai + ti;
          }
        }
      }
    },
  };
}

/** What a power spectrum needs for one size: the Hann window and two arrays to transform in. */
interface Work {
  hann: Float64Array;
  /** 1/(Σ hann)²: brings a tone that falls on a bin to its own power. */
  scale: number;
  re: Float32Array;
  im: Float32Array;
}

/** The work arrays of each transform, made on its first spectrum, so no spectrum allocates after that. */
const works = new WeakMap<Fft, Work>();

function workFor(fft: Fft): Work {
  const known = works.get(fft);
  if (known !== undefined) return known;
  const n = fft.size;
  if (!Number.isInteger(n) || n < 2) throw new RangeError(`powerSpectrumDb: a transform of ${n} pairs`);
  // the periodic Hann window: a tone that falls on a bin leaks into no bin but its two neighbours
  const hann = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / n);
    sum += hann[i]!;
  }
  const work: Work = { hann, scale: 1 / (sum * sum), re: new Float32Array(n), im: new Float32Array(n) };
  works.set(fft, work);
  return work;
}

/**
 * The power spectrum of the first `fft.size` pairs of `x` (√mW), dBm, into the first `size` numbers of `out`:
 * the Hann window, the transform, |X|² divided by the square of the window's sum, never below −200. out[0] is the
 * lowest frequency, out[size/2] the middle. `x` shorter than `size` pairs or `out` shorter than `size` is a
 * RangeError.
 */
export function powerSpectrumDb(x: Float32Array, fft: Fft, out: Float32Array): void {
  const work = workFor(fft);
  const n = fft.size;
  if (x.length < 2 * n) throw new RangeError(`powerSpectrumDb: ${x.length >> 1} pairs, ${n} needed`);
  if (out.length < n) throw new RangeError(`powerSpectrumDb: room for ${out.length} bins, ${n} needed`);
  const { hann, scale, re, im } = work;
  for (let i = 0; i < n; i++) {
    const w = hann[i]!;
    re[i] = x[2 * i]! * w;
    im[i] = x[2 * i + 1]! * w;
  }
  fft.forward(re, im);
  const floor = FLOOR_DBM;
  const half = n >> 1;
  for (let j = 0; j < n; j++) {
    const k = j < half ? j + n - half : j - half; // bin k of the transform is frequency k (or k − n when k ≥ n/2)
    const p = (re[k]! * re[k]! + im[k]! * im[k]!) * scale;
    out[j] = Math.max(floor, 10 * Math.log10(p));
  }
}
