/**
 * The bench's speaker in sound (docs/volumes/electronics/VISUAL.md §1, principle 3; the design §6.3): what the circuit
 * model gives the speaker `SPK` — its current, block by block from the model in time (`shared/model/live.ts`) — played
 * through the volume's own sound output (`shared/sound`, E1-9), which also paces the model.
 *
 * - **The scale**: 1 W on the speaker is half of full scale (`SPEAKER`): a sample is the current over 2·√(1 W / R),
 *   0.707 A for the 8 Ω speaker — a steady 1 W, or the RMS of a sine of 1 W, is 0.5; the rated 2 W 0.707; 4 W full
 *   scale, and more is held to it. No other scaling: what is louder on the board is louder in the sound, and the
 *   output's gain (the engine's settings, its limiter) comes after.
 * - **The steps**: the samples are those of a 16-bit output, on steps of 2⁻¹⁵ of full scale. A current below half a
 *   step (10.8 μA on 8 Ω, 0.9 nW) is silence — a block of zeros: the volume knob at 0 leaves the 1 mΩ end of the pot's
 *   track across the speaker, a few nanoamperes. After a moment without a solution (`steps`) the rest are zeros too.
 * - **The pace** (`wants`): a block is asked only while fewer than `SPEAKER.queue` (two) are queued on the output, so
 *   with the block on its way at most three are planned — the output's capacity — and a change on the board is heard
 *   one to two blocks later. The output plans on the engine's clock until the first gesture (silently), then on
 *   `AudioContext.currentTime`.
 * - **The mood**: while the speaker is in the circuit (both plugs in), the chapter's ambient pad is silent, and it
 *   comes back when the speaker leaves (VISUAL §1, principle 3: from the circuit one hears only the speaker).
 * - **The crest** (`peak`, E3-9): the largest voltage on the speaker, |I| × R of the model's current (not of the
 *   output's steps, nor held to its full scale), over the last seconds of the samples heard — kept per chunk of
 *   `CREST_CHUNK` samples as the blocks come, looked back from the sample heard now, and from a given first sample on
 *   only (whole chunks after it): the prologue's «Хвиля на динаміку», the same blocks that sound, of its step's board.
 *
 * The output is made with the speaker and freed with the chapter (`createSoundOut` puts its `dispose` into
 * `ctx.onDispose`).
 */
import { audio, moodForTheme } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import type { LiveSound } from '../model/live';
import { createSoundOut, type SoundOut, type SoundOutOptions } from '../sound';

export const SPEAKER = {
  /** The power on the speaker that is `share` of full scale (W). */
  watts: 1,
  share: 0.5,
  /** A block is asked only while fewer than this many are queued on the output. */
  queue: 2,
  /** The output's resolution: a step is 2^−(bits − 1) of full scale. */
  bits: 16,
  /** The levels of the last blocks kept for the checks. */
  levels: 32,
} as const;

/** The speaker current that is full scale (A): 1 W on `ohms` is `SPEAKER.share` of it — 0.7071 A for 8 Ω. */
export function speakerFullScale(ohms: number): number {
  return Math.sqrt(SPEAKER.watts / ohms) / SPEAKER.share;
}

const STEPS = 2 ** (SPEAKER.bits - 1);

/** The largest voltage on the speaker is kept for every this many samples (10 ms at 24 000 a second): `peak`. */
export const CREST_CHUNK = 240;
/** How many chunks are kept (2.56 s at 24 000 a second). */
const CREST_CHUNKS = 256;

/**
 * The output's samples of a speaker current (A): over `fullScale`, on the output's steps, held to ±1; from `steps` on
 * (the model's last good step) zeros. Writes into `out` (as long as the block) and returns it.
 */
export function speakerSamples(
  current: ArrayLike<number>,
  fullScale: number,
  out: Float32Array,
  steps = current.length,
): Float32Array {
  const n = Math.min(steps, current.length, out.length);
  for (let k = 0; k < n; k++) {
    const v = Math.round((current[k]! / fullScale) * STEPS) / STEPS;
    // a silence of −0 is a silence of 0 (its bytes, which the checks hash, too)
    out[k] = v > 1 ? 1 : v < -1 ? -1 : v === 0 ? 0 : v;
  }
  out.fill(0, n);
  return out;
}

/** A block's level as the output got it. */
export interface SpeakerLevel {
  /** The stream's index of its first sample. */
  readonly first: number;
  readonly peak: number;
  readonly rms: number;
}

export interface SpeakerOptions {
  /** Samples per second of the blocks. */
  readonly rate: number;
  /** The speaker's resistance (Ω): the catalog's `speaker-8`. */
  readonly ohms: number;
  /** The part whose current it plays (`SPK` when absent). */
  readonly part?: string;
  /** The sound output's own options (tests: a context, `noaudio`). */
  readonly output?: Omit<SoundOutOptions, 'rate'>;
  /**
   * Told when the speaker comes into the circuit (true) and leaves it (false): the platform's ambient mood goes silent,
   * and back to the chapter's theme, when absent.
   */
  readonly mood?: (inCircuit: boolean) => void;
}

export interface Speaker extends LiveSound {
  /** The volume's own sound output it plays through. */
  readonly output: SoundOut;
  /** The current that is full scale (A). */
  readonly fullScale: number;
  /** How many blocks it gave the output. */
  readonly blocks: number;
  /** The last blocks' levels, the newest last (at most `SPEAKER.levels`). */
  readonly levels: readonly SpeakerLevel[];
  /** The samples of the last block (zeros before any). */
  readonly last: Float32Array;
  /** FNV-1a of the bytes of every sample it gave the output: two held pages that play the same, the same hash. */
  readonly hash: string;
  /** Whether the speaker is in the circuit, as the bench last said. */
  readonly inCircuit: boolean;
  /**
   * The largest voltage on the speaker (V: |I| × its resistance, the model's current) over the last `seconds` of the
   * samples heard (up to the one heard now; the samples planned ahead of it do not count yet), within a chunk of
   * `CREST_CHUNK` samples at either end. With `start` (the stream's index of a sample) nothing before it counts: the
   * window begins at the first chunk that lies wholly at or after it — a chunk that holds the last samples of a board
   * before (a step's new board starts mid-chunk) is not the new board's. Null before any block was heard, or for a
   * window of nothing.
   */
  peak(seconds: number, start?: number): number | null;
  /** The bench says, every frame, whether the speaker is in the circuit now (its mood follows a change). */
  circuit(on: boolean): void;
}

export function createSpeaker(ctx: ChapterContext, opts: SpeakerOptions): Speaker {
  const output = createSoundOut(ctx, { ...opts.output, rate: opts.rate });
  const fullScale = speakerFullScale(opts.ohms);
  const mood =
    opts.mood ??
    ((on: boolean) => audio.mood(on ? null : moodForTheme(ctx.manifest.theme.mood, ctx.manifest.theme.sky)));
  let samples = new Float32Array(0);
  let bytes = new Uint8Array(samples.buffer);
  const levels: SpeakerLevel[] = [];
  let blocks = 0;
  let hash = 0x811c9dc5;
  let inCircuit = false;
  // the crests: the largest |I| of every chunk of CREST_CHUNK samples, a ring by the chunk's own index
  const crestId = new Float64Array(CREST_CHUNKS).fill(-1);
  const crestA = new Float32Array(CREST_CHUNKS);

  return {
    part: opts.part ?? 'SPK',
    output,
    fullScale,
    get blocks() {
      return blocks;
    },
    levels,
    get last() {
      return samples;
    },
    get hash() {
      return (hash >>> 0).toString(16).padStart(8, '0');
    },
    get inCircuit() {
      return inCircuit;
    },
    wants: () => output.queued < SPEAKER.queue,
    heard: () => output.heard(),
    play(first, current, steps) {
      // one array, made again only for a block of another length: the output copies a block into its own buffer
      if (samples.length !== current.length) {
        samples = new Float32Array(current.length);
        bytes = new Uint8Array(samples.buffer);
      }
      speakerSamples(current, fullScale, samples, steps);
      const good = Math.min(steps, current.length);
      for (let k = Math.max(0, current.length - CREST_CHUNKS * CREST_CHUNK); k < current.length; k++) {
        const chunk = Math.floor((first + k) / CREST_CHUNK);
        const slot = chunk % CREST_CHUNKS;
        if (crestId[slot] !== chunk) {
          crestId[slot] = chunk;
          crestA[slot] = 0;
        }
        // after the model's last good step the output plays zeros: so does the crest
        const a = k < good ? Math.abs(current[k]!) : 0;
        if (a > crestA[slot]!) crestA[slot] = a;
      }
      let peak = 0;
      let sum = 0;
      for (const v of samples) {
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v;
      }
      for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i]!, 0x01000193);
      levels.push({ first, peak, rms: samples.length > 0 ? Math.sqrt(sum / samples.length) : 0 });
      if (levels.length > SPEAKER.levels) levels.shift();
      blocks++;
      output.enqueue(samples, { first });
    },
    circuit(on) {
      if (on === inCircuit) return;
      inCircuit = on;
      mood(on);
    },
    peak(seconds, start) {
      const heard = output.heard();
      if (heard === null || !(seconds > 0)) return null;
      // the chunks wholly heard, whose end lies within the window — and, with a start, wholly at or after it
      const last = Math.floor(heard / CREST_CHUNK) - 1;
      const from = Math.max(
        Math.floor((heard - seconds * opts.rate) / CREST_CHUNK),
        last - CREST_CHUNKS + 1,
        start === undefined ? -Infinity : Math.ceil(start / CREST_CHUNK),
      );
      let best = -1;
      for (let chunk = from; chunk <= last; chunk++) {
        const slot = ((chunk % CREST_CHUNKS) + CREST_CHUNKS) % CREST_CHUNKS;
        if (crestId[slot] === chunk && crestA[slot]! > best) best = crestA[slot]!;
      }
      return best < 0 ? null : best * opts.ohms;
    },
  };
}
