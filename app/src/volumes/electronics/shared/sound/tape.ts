/**
 * The last samples of a stream, kept by their index in the stream: what a scope reads around the sample heard now
 * (`SoundOut.heard()`), so that the trace on the screen and the sound come from the same samples.
 */
export class Tape {
  readonly capacity: number;
  private readonly data: Float32Array;
  /** The index of the sample after the last one written; the tape holds [end − held, end). */
  private last = 0;
  private held = 0;

  constructor(capacity: number) {
    if (!(Number.isInteger(capacity) && capacity >= 1))
      throw new RangeError(`the capacity must be a whole number from 1: ${capacity}`);
    this.capacity = capacity;
    this.data = new Float32Array(capacity);
  }

  /** The index of the sample after the last one written. */
  get end(): number {
    return this.last;
  }

  /**
   * Writes the stream's samples from `first` on. Blocks come in order; one that does not follow the last (a gap or a
   * step back) starts the tape afresh.
   */
  write(first: number, samples: ArrayLike<number>): void {
    if (first !== this.last) this.held = 0;
    const n = samples.length;
    const from = Math.max(0, n - this.capacity);
    for (let k = from; k < n; k++) this.data[(first + k) % this.capacity] = samples[k]!;
    this.last = first + n;
    this.held = Math.min(this.capacity, this.held + n);
  }

  /**
   * The samples [end − out.length, end) into `out`; a sample the tape does not hold is NaN (a chart breaks its line
   * there). Returns how many were on the tape.
   */
  read(end: number, out: Float32Array): number {
    const n = out.length;
    const oldest = this.last - this.held;
    let found = 0;
    for (let k = 0; k < n; k++) {
      const i = end - n + k;
      if (i >= oldest && i < this.last && i >= 0) {
        out[k] = this.data[i % this.capacity]!;
        found++;
      } else out[k] = Number.NaN;
    }
    return found;
  }
}
