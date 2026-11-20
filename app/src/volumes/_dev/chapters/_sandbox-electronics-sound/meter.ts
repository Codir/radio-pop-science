/**
 * The sandbox's measure of what the model plays (for its QA, `qa/check.mjs`): the RMS of the speaker's current and of
 * its part above 2 kHz — a second-order Butterworth high-pass, run over every block in order — over the last
 * `window` blocks, and how many of them the model computed with the board of the newest one. Read from the model's
 * samples, never from a microphone.
 */
export interface Level {
  /** The revision of the board of the newest block. */
  revision: number;
  /** Blocks in the window computed with that board. */
  fresh: number;
  /** RMS of the speaker's current over the window (A). */
  rms: number;
  /** RMS of its part above 2 kHz (A). */
  hf: number;
}

export function createMeter(rate: number, window: number, cutoffHz = 2000) {
  const w = (2 * Math.PI * cutoffHz) / rate;
  const alpha = Math.sin(w) / Math.SQRT2;
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const blocks: { revision: number; all: number; high: number; n: number }[] = [];

  return {
    add(samples: Float32Array, revision: number): void {
      let all = 0;
      let high = 0;
      for (let k = 0; k < samples.length; k++) {
        const x = samples[k]!;
        const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        all += x * x;
        high += y * y;
      }
      blocks.push({ revision, all, high, n: samples.length });
      if (blocks.length > window) blocks.shift();
    },
    read(): Level {
      const revision = blocks.at(-1)?.revision ?? 0;
      let all = 0;
      let high = 0;
      let n = 0;
      let fresh = 0;
      for (const b of blocks) {
        all += b.all;
        high += b.high;
        n += b.n;
        if (b.revision === revision) fresh++;
      }
      return {
        revision,
        fresh,
        rms: n > 0 ? Math.sqrt(all / n) : 0,
        hf: n > 0 ? Math.sqrt(high / n) : 0,
      };
    },
  };
}
