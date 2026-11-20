/**
 * The melody of the volume: music of its own, synthesised by this code — no recording, nobody else's tune — so that
 * the player on the stand has something with low and high notes in it for the filters and the amplifier to change.
 * A loop of MELODY_SECONDS: four bars of 4/4 at 120 beats a minute in A minor (Am, Fmaj7, Dm, E), in five voices — a
 * bass from 41 to 110 Hz, chords on the off-beats around 175–330 Hz, a melody from 587 Hz to 1.3 kHz whose second and
 * third harmonics reach 4 kHz, and quiet drums: a kick, a snare and a hi-hat, the last two made of the noise of a
 * generator with a seed.
 *
 * The melody is a function of time, `melodyAt(t)`, continuous and periodic: every note rises from 0 and falls back to
 * 0 within its own length, so any moment can be computed alone — the operating point (t = 0, silence), a moment
 * inside a step of the transient, any sample of any block. Its value stays within ±1 (the loudest moment is
 * MELODY_PEAK); the player (`parts.ts`) multiplies it by its amplitude. The noise is the generator mulberry32 read by
 * its index: its j-th number is a mix of seed + j·0x6D2B79F5, so the noise at any moment needs no numbers before it.
 * Nothing here allocates after the module has loaded. Usage and numbers: README.md, «The melody and the player».
 */

/** The length of the loop (s): four bars of four beats at 120 beats a minute. */
export const MELODY_SECONDS = 8;

/** The loudest moment of the loop, |melodyAt(t)| at most (sampled every 1/192 000 s; README.md). */
export const MELODY_PEAK = 0.98;

/** A sixteenth note (s): the grid every note starts on. */
const SIXTEENTH = 0.125;
const SLOTS = MELODY_SECONDS / SIXTEENTH;
/** The noise: this many numbers of the generator a second, joined by straight lines. */
const NOISE_RATE = 48000;
/** The seed of the noise. */
const SEED = 0x2f6b9e1d;
const TWO_PI = 2 * Math.PI;

/** The frequency of a MIDI note (Hz): A4 = 69 is 440 Hz, twelve equal steps an octave. */
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** How a note of a voice swells and fades: a straight rise over `attack` (s), then e^(−τ/`decay`), and a straight
 * fall to zero over the last `release` (s) of the note. */
interface Shape {
  readonly attack: number;
  readonly decay: number;
  readonly release: number;
}

/** A voice: its notes, none of them overlapping, and the note that sounds in every slot of the grid (−1 for none). */
interface Voice {
  readonly onset: Float64Array;
  readonly length: Float64Array;
  /** Up to four frequencies a note (0 for none): a chord has three or four, every other voice one. */
  readonly hz: Float64Array;
  /** The level of a note (a hi-hat's accent; 1 elsewhere). */
  readonly level: Float64Array;
  readonly slot: Int16Array;
  readonly shape: Shape;
}

/** Builds a voice from its notes: [first slot, slots it lasts, MIDI notes, level]; a note may last a fraction of a
 * slot (a drum) and still holds the slots it touches. */
function voice(notes: readonly (readonly [number, number, readonly number[], number?])[], shape: Shape): Voice {
  const v: Voice = {
    onset: new Float64Array(notes.length),
    length: new Float64Array(notes.length),
    hz: new Float64Array(4 * notes.length),
    level: new Float64Array(notes.length),
    slot: new Int16Array(SLOTS).fill(-1),
    shape,
  };
  notes.forEach(([first, slots, midi, level = 1], k) => {
    v.onset[k] = first * SIXTEENTH;
    v.length[k] = slots * SIXTEENTH;
    midi.forEach((m, j) => (v.hz[4 * k + j] = hz(m)));
    v.level[k] = level;
    for (let s = first; s < first + Math.ceil(slots); s++) {
      if (s >= SLOTS || v.slot[s] !== -1) throw new Error(`the score: a note at slot ${first} overlaps or leaves the loop`);
      v.slot[s] = k;
    }
  });
  return v;
}

/** The notes of one bar, `bar` 0…3, moved to their place in the loop. */
const inBar = (bar: number, notes: readonly (readonly [number, number, number])[]): [number, number, number[]][] =>
  notes.map(([slot, slots, midi]) => [16 * bar + slot, slots, [midi]]);

// ── the score ──────────────────────────────────────────────────────────────────────────────────────────────────────
// MIDI notes: A1 33 (55 Hz), E1 28, F1 29, G#1 32, B1 35, C2 36, D2 38, E2 40, F2 41, G2 43, A2 45; F3 53, G#3 56, A3 57,
// B3 59, C4 60, D4 62, E4 64; D5 74, E5 76, F5 77, G5 79, G#5 80, A5 81, B5 83, C6 84, D6 86, E6 88.

const BASS = voice(
  [
    ...inBar(0, [[0, 3, 33], [3, 1, 45], [6, 2, 33], [8, 3, 33], [11, 1, 45], [12, 2, 40], [14, 2, 43]]),
    ...inBar(1, [[0, 3, 29], [3, 1, 41], [6, 2, 29], [8, 3, 29], [11, 1, 41], [12, 2, 36], [14, 2, 40]]),
    ...inBar(2, [[0, 3, 38], [3, 1, 45], [6, 2, 38], [8, 3, 38], [11, 1, 45], [12, 2, 41], [14, 2, 45]]),
    ...inBar(3, [[0, 3, 28], [3, 1, 40], [6, 2, 28], [8, 3, 28], [11, 1, 40], [12, 2, 32], [14, 2, 35]]),
  ],
  { attack: 0.005, decay: 0.6, release: 0.03 },
);

/** Am, Fmaj7, Dm, E: one chord a bar, struck on the off-beat of every beat. */
const CHORD_NOTES: readonly (readonly number[])[] = [
  [57, 60, 64],
  [53, 57, 60, 64],
  [53, 57, 62],
  [56, 59, 64],
];
const CHORDS = voice(
  CHORD_NOTES.flatMap((midi, bar) => [2, 6, 10, 14].map((slot) => [16 * bar + slot, 2, midi] as const)),
  { attack: 0.004, decay: 0.25, release: 0.03 },
);

const LEAD = voice(
  [
    ...inBar(0, [[0, 2, 76], [2, 2, 81], [4, 2, 84], [6, 1, 83], [7, 1, 81], [8, 4, 76], [14, 1, 74], [15, 1, 76]]),
    ...inBar(1, [[0, 2, 77], [2, 2, 81], [4, 2, 84], [6, 2, 88], [8, 3, 86], [11, 1, 84], [12, 4, 81]]),
    ...inBar(2, [[0, 2, 74], [2, 2, 77], [4, 2, 81], [6, 1, 79], [7, 1, 77], [8, 2, 76], [10, 2, 77], [12, 4, 81]]),
    ...inBar(3, [[0, 2, 80], [2, 2, 83], [4, 3, 88], [7, 1, 86], [8, 2, 83], [10, 2, 80], [12, 3, 76]]),
  ],
  { attack: 0.01, decay: 0.5, release: 0.03 },
);

/** A drum: hits at these slots, each `seconds` long. */
const hits = (slots: readonly number[], seconds: number, level = (_: number): number => 1) =>
  slots.map((slot) => [slot, seconds / SIXTEENTH, [], level(slot)] as const);

const KICK = voice(hits([0, 8, 16, 24, 27, 32, 40, 48, 56, 59], 0.2), {
  attack: 0.001,
  decay: 0.08,
  release: 0.02,
});
const SNARE = voice(hits([4, 12, 20, 28, 36, 44, 52, 60], 0.18), { attack: 0.001, decay: 0.06, release: 0.02 });
const HAT = voice(
  hits(
    Array.from({ length: SLOTS / 2 }, (_, k) => 2 * k),
    0.05,
    (slot) => (slot % 4 === 2 ? 1 : 0.6),
  ),
  { attack: 0.0005, decay: 0.015, release: 0.01 },
);

// the levels of the voices against each other, and the gain that makes the loudest moment MELODY_PEAK
const BASS_LEVEL = 0.5;
const CHORD_LEVEL = 0.1;
const LEAD_LEVEL = 0.3;
const KICK_LEVEL = 0.35;
const SNARE_LEVEL = 0.12;
const HAT_LEVEL = 0.09;
const GAIN = 0.8475;

/** The envelope of the note `k` of `v` at `tau` seconds after its onset: 0 outside the note. */
function envelope(v: Voice, k: number, tau: number): number {
  const length = v.length[k]!;
  if (!(tau >= 0 && tau < length)) return 0;
  const { attack, decay, release } = v.shape;
  const rise = tau < attack ? tau / attack : 1;
  const fall = tau > length - release ? (length - tau) / release : 1;
  return v.level[k]! * rise * fall * Math.exp(-tau / decay);
}

/** The j-th number of the generator, uniform in [−1, 1): mulberry32's output for the state seed + (j + 1)·0x6D2B79F5. */
function noiseAt(j: number): number {
  const state = (SEED + Math.imul(j + 1, 0x6d2b79f5)) | 0;
  let t = Math.imul(state ^ (state >>> 15), state | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
}

/** White noise at `x` seconds into the loop: the generator's numbers NOISE_RATE a second, joined by straight lines. */
function noise(x: number): number {
  const at = x * NOISE_RATE;
  const j = Math.floor(at);
  const a = noiseAt(j);
  return a + (noiseAt(j + 1) - a) * (at - j);
}

/** The same noise with its low frequencies taken out: the difference of two neighbouring numbers, joined by lines. */
function hiss(x: number): number {
  const at = x * NOISE_RATE;
  const j = Math.floor(at);
  const before = noiseAt(j - 1);
  const a = noiseAt(j);
  const b = noiseAt(j + 1);
  return 0.5 * (a - before + (b - 2 * a + before) * (at - j));
}

/** The melody at `t` seconds (any moment, the loop repeating every MELODY_SECONDS): a number within ±1. */
export function melodyAt(t: number): number {
  let x = t % MELODY_SECONDS;
  if (x < 0) x += MELODY_SECONDS;
  const slot = Math.min(Math.floor(x / SIXTEENTH), SLOTS - 1);
  let sum = 0;

  let k = BASS.slot[slot]!;
  if (k >= 0) {
    const tau = x - BASS.onset[k]!;
    const theta = TWO_PI * BASS.hz[4 * k]! * tau;
    const s = Math.sin(theta);
    // the fundamental and a little of the octave above it (sin 2θ = 2·sin θ·cos θ)
    sum += BASS_LEVEL * envelope(BASS, k, tau) * (s + 0.5 * s * Math.cos(theta));
  }

  k = CHORDS.slot[slot]!;
  if (k >= 0) {
    const tau = x - CHORDS.onset[k]!;
    const env = envelope(CHORDS, k, tau);
    if (env !== 0) {
      let chord = 0;
      for (let j = 0; j < 4; j++) {
        const f = CHORDS.hz[4 * k + j]!;
        if (f === 0) break;
        const s = Math.sin(TWO_PI * f * tau);
        // a little of the third harmonic (sin 3θ = 3·sin θ − 4·sin³ θ)
        chord += s + 0.2 * s * (3 - 4 * s * s);
      }
      sum += CHORD_LEVEL * env * chord;
    }
  }

  k = LEAD.slot[slot]!;
  if (k >= 0) {
    const tau = x - LEAD.onset[k]!;
    const env = envelope(LEAD, k, tau);
    if (env !== 0) {
      const theta = TWO_PI * LEAD.hz[4 * k]! * tau;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      // the fundamental, its second and its third harmonic
      sum += LEAD_LEVEL * env * (s + 0.7 * s * c + 0.25 * s * (3 - 4 * s * s));
    }
  }

  k = KICK.slot[slot]!;
  if (k >= 0) {
    const tau = x - KICK.onset[k]!;
    const env = envelope(KICK, k, tau);
    if (env !== 0) {
      // a tone that falls from 120 Hz to 45 Hz (its phase is the integral of 45 + 75·e^(−τ/0.04) Hz) and a click of
      // noise at the beater
      const phase = TWO_PI * (45 * tau + 75 * 0.04 * -Math.expm1(-tau / 0.04));
      sum += KICK_LEVEL * env * (Math.sin(phase) + 0.3 * Math.exp(-tau / 0.003) * noise(x));
    }
  }

  k = SNARE.slot[slot]!;
  if (k >= 0) {
    const tau = x - SNARE.onset[k]!;
    const env = envelope(SNARE, k, tau);
    if (env !== 0) sum += SNARE_LEVEL * env * (0.4 * Math.sin(TWO_PI * 190 * tau) + noise(x));
  }

  k = HAT.slot[slot]!;
  if (k >= 0) {
    const tau = x - HAT.onset[k]!;
    const env = envelope(HAT, k, tau);
    if (env !== 0) sum += HAT_LEVEL * env * hiss(x);
  }

  return GAIN * sum;
}

/**
 * The melody sampled at `fs` (Hz) from the sample `startSample` on: `n` samples, the k-th at (startSample + k)/fs
 * seconds, written into `out` from its start (`out` itself comes back). It allocates nothing, and a block from any
 * sample is the same, number for number, as that stretch of one long render. A rate that is not a finite number above
 * 0, a start that is not a whole number, or `n` not a whole number from 0 to `out.length` is a RangeError.
 */
export function renderMelody<T extends Float32Array | Float64Array>(
  fs: number,
  startSample: number,
  n: number,
  out: T,
): T {
  if (!(fs > 0 && Number.isFinite(fs))) throw new RangeError(`the rate must be a finite number above 0: ${fs}`);
  if (!Number.isSafeInteger(startSample)) throw new RangeError(`the first sample must be a whole number: ${startSample}`);
  if (!Number.isInteger(n) || n < 0 || n > out.length)
    throw new RangeError(`n must be a whole number from 0 to ${out.length}: ${n}`);
  for (let k = 0; k < n; k++) out[k] = melodyAt((startSample + k) / fs);
  return out;
}
