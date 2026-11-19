/**
 * The band of four channels and the monitor's receiver up to the filter of the channel.
 *
 * The band is pairs at FS_WB (100 MHz real) round BAND.centre (2441 MHz): a pair turning by f cycles per sample
 * is a wave at 2441 MHz + f·100 MHz. The channels stand at −27, −9, +9 and +27 MHz from the middle.
 *
 * The camera's signal comes at the channel's rate (FS_CH, 20 MHz real). `createPlacer` puts it on its channel:
 * five times the rate through the interpolator on CHANNEL_FILTER, then a shift to the channel's place, and adds it
 * to the band. The same placer puts the neighbour's router at any frequency of the band (`placeAt`).
 *
 * `createFrontEnd` is the monitor's receiver, a decision of the plan. Its input and output are in √mW on the
 * antenna: the gain is taken out again after the amplifier, so the levels on the scales and the threshold of the
 * limiter do not depend on the knob. In order:
 * - the input filter (INPUT_FILTER, 2399–2483 MHz) keeps what lies beyond the band off the amplifier;
 *   `inputFilter = false` takes it out of the way;
 * - the amplifier y = g·x/√(1 + |g·x|²/c²), g = 10^(gainDb/20) (gainDb ≤ 0, 0 by default: the full gain),
 *   c = dbmToAmp(−20): a ceiling that no wave on its input passes, however strong;
 * - division by g;
 * - the shift that brings the channel to zero;
 * - CHANNEL_FILTER (±10 MHz) and every fifth pair: the channel's rate;
 * - the noise of the blocks after the amplifier, −92 − 30 dBm in the channel, divided by g: added at the channel's
 *   rate behind the filter of the channel, it gives in the channel what it would give in front of it, for a fifth
 *   of the work. With the gain turned down by 30 dB it is as strong as the noise of the antenna.
 */
import { createDecimator, createInterpolator, designLowpass, mix } from './dsp';
import { createRng } from './rng';
import { BAND, CHANNELS, type ChannelNo, FS_WB, OVERSAMPLE, shown } from './standard';
import { dbmToAmp } from './units';

/** The noise of the antenna in the filter of the channel, dBm: −101 dBm of 20 MHz at 290 K plus 9 dB of the receiver's own. */
export const NOISE_DBM_IN_CHANNEL = -92,
  /** The ceiling of the amplifier, dBm. */
  AMP_CEILING_DBM = -20,
  /** The noise of the blocks after the amplifier against NOISE_DBM_IN_CHANNEL, dB, with the full gain. */
  SECOND_NOISE_DB = -30;

/** The filter of the channel at the band's rate: 63 taps, ±10 MHz of 100. The placer interpolates with it too. */
export const CHANNEL_FILTER: Float32Array = designLowpass(63, 0.1);
/** The input filter at the band's rate: 47 taps, cut at ±41.75 MHz round 2441 MHz, i.e. 2399–2483 MHz (a decision of the plan). */
export const INPUT_FILTER: Float32Array = designLowpass(47, 0.4175);

/** Σ h². */
function squares(h: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < h.length; i++) sum += h[i]! * h[i]!;
  return sum;
}

/**
 * The deviation of the antenna's noise on each shadow at the band's rate: white noise of this deviation gives
 * NOISE_DBM_IN_CHANNEL behind the filter of the channel, dbmToAmp(−92)/√(2·Σ CHANNEL_FILTER²).
 */
export const ANTENNA_NOISE_SIGMA: number =
  dbmToAmp(NOISE_DBM_IN_CHANNEL) / Math.sqrt(2 * squares(CHANNEL_FILTER));

const TWO_PI = 2 * Math.PI;
/** The band's rate in real Hz: 100 MHz. */
const BAND_HZ = shown(FS_WB);

/** The turn per band sample that takes the middle of the band to `shownHz`, radians. */
const turnTo = (shownHz: number): number => (TWO_PI * (shownHz - BAND.centre)) / BAND_HZ;

/** The middle of channel `channel`, real Hz; a channel other than 1…4 is a RangeError. */
function channelHz(channel: ChannelNo, who: string): number {
  const hz = CHANNELS[channel - 1];
  if (hz === undefined) throw new RangeError(`${who}: channel ${channel}`);
  return hz;
}

/**
 * One transmitter's way into the band. `placeAt` takes `tx`, pairs at the channel's rate, makes the rate five
 * times higher (the interpolator on CHANNEL_FILTER keeps the amplitude of a slow signal), shifts it to the real
 * frequency `shownHz` and adds it to `out`, which holds five times as many pairs; `place` does the same on the
 * middle of a channel. The interpolator and the phase of the shift go on from call to call, so one placer carries
 * one stream; `reset()` forgets it. `tx` that is not whole pairs, `out` of another length, or a frequency the band
 * cannot hold (more than 50 MHz from its middle) is a RangeError.
 */
export function createPlacer(): {
  place(tx: Float32Array, channel: ChannelNo, out: Float32Array): void;
  placeAt(tx: Float32Array, shownHz: number, out: Float32Array): void;
  reset(): void;
} {
  const up = createInterpolator(CHANNEL_FILTER, OVERSAMPLE);
  let phase = 0;
  let band = new Float32Array(0); // the stream at the band's rate before it is added; kept between calls
  const placeAt = (tx: Float32Array, shownHz: number, out: Float32Array): void => {
    if (tx.length % 2 !== 0) throw new RangeError(`placer: ${tx.length} numbers are not whole pairs`);
    if (out.length !== OVERSAMPLE * tx.length) {
      throw new RangeError(
        `placer: ${tx.length >> 1} pairs go into ${OVERSAMPLE * (tx.length >> 1)}, not ${out.length >> 1}`,
      );
    }
    if (!(Math.abs(shownHz - BAND.centre) < BAND_HZ / 2))
      throw new RangeError(`placer: ${shownHz} Hz is beyond the band`);
    if (band.length !== out.length) band = new Float32Array(out.length);
    const b = band;
    up.process(tx, b);
    phase = mix(b, b, phase, turnTo(shownHz));
    for (let i = 0, n = b.length; i < n; i++) out[i] += b[i]!;
  };
  return {
    place: (tx, channel, out) => placeAt(tx, channelHz(channel, 'placer'), out),
    placeAt,
    reset() {
      up.reset();
      phase = 0;
    },
  };
}

export interface FrontEnd {
  /**
   * `antenna`, pairs at the band's rate, √mW → `out`, channel `channel` at the channel's rate, √mW on the antenna;
   * `out` holds a fifth of the pairs, and a call brings a whole number of five pairs. Goes on from call to call.
   */
  process(antenna: Float32Array, channel: ChannelNo, out: Float32Array): void;
  /** Forgets the stream and starts the noise again: after it the output repeats bit for bit. */
  reset(): void;
  /** The gain knob, dB: 0 is the full gain, lower turns it down; above 0 or not a finite number is a RangeError. */
  gainDb: number;
  /** The input filter is in the way; false takes it out (and it forgets its stream). */
  inputFilter: boolean;
}

/** The monitor's receiver up to the filter of the channel; the noise of the blocks after the amplifier comes from `seed`. */
export function createFrontEnd(seed: number): FrontEnd {
  const input = createDecimator(INPUT_FILTER, 1);
  const down = createDecimator(CHANNEL_FILTER, OVERSAMPLE);
  const ceiling = dbmToAmp(AMP_CEILING_DBM);
  /** The deviation of the second noise on each shadow with the full gain: −122 dBm in the channel. */
  const secondSigma = dbmToAmp(NOISE_DBM_IN_CHANNEL + SECOND_NOISE_DB) / Math.SQRT2;
  let rng = createRng(seed);
  let phase = 0;
  let band = new Float32Array(0); // the band after the amplifier; kept between calls
  let noise = new Float32Array(0); // the second noise of one call; kept between calls
  const fe: FrontEnd = {
    gainDb: 0,
    inputFilter: true,
    process(antenna, channel, out) {
      const gainDb = fe.gainDb;
      if (!(gainDb <= 0 && Number.isFinite(gainDb))) throw new RangeError(`front end: gain ${gainDb} dB`);
      const turn = -turnTo(channelHz(channel, 'front end'));
      if (OVERSAMPLE * out.length !== antenna.length) {
        throw new RangeError(
          `front end: ${antenna.length >> 1} pairs give ${antenna.length / (2 * OVERSAMPLE)}, not ${out.length >> 1}`,
        );
      }
      if (band.length !== antenna.length) band = new Float32Array(antenna.length);
      if (noise.length !== out.length) noise = new Float32Array(out.length);
      const b = band;
      let x = antenna;
      if (fe.inputFilter) {
        input.process(antenna, b);
        x = b;
      } else input.reset();
      // the amplifier and the division by g: g·x/√(1 + |g·x|²/c²)/g = x/√(1 + |x|²·(g/c)²)
      const g = 10 ** (gainDb / 20);
      const k = (g / ceiling) ** 2;
      for (let i = 0, n = b.length; i < n; i += 2) {
        const re = x[i]!;
        const im = x[i + 1]!;
        const s = 1 / Math.sqrt(1 + (re * re + im * im) * k);
        b[i] = re * s;
        b[i + 1] = im * s;
      }
      phase = mix(b, b, phase, turn);
      down.process(b, out);
      const add = noise;
      rng.gaussFill(add, secondSigma / g);
      for (let i = 0, n = out.length; i < n; i++) out[i] += add[i]!;
    },
    reset() {
      input.reset();
      down.reset();
      phase = 0;
      rng = createRng(seed);
    },
  };
  return fe;
}
