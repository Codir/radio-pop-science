import { describe, expect, it } from 'vitest';
import { createAir } from '../channel';
import { ANTENNA_NOISE_SIGMA, createFrontEnd, createPlacer, type FrontEnd } from '../rf';
import { type ChannelNo, FRAME_CH, FRAME_WB } from '../standard';
import { dbmToAmp, powerDbm } from '../units';

const TWO_PI = 2 * Math.PI;
const FRAMES = 4;

/** `pairs` pairs of a tone of amplitude `amp` at `f` cycles per sample. */
function tone(pairs: number, f: number, amp: number): Float32Array {
  const x = new Float32Array(2 * pairs);
  for (let n = 0; n < pairs; n++) {
    x[2 * n] = amp * Math.cos(TWO_PI * f * n);
    x[2 * n + 1] = amp * Math.sin(TWO_PI * f * n);
  }
  return x;
}

/** `x` (pairs at the channel's rate) put on channel `ch` of the band by a fresh placer. */
function placed(x: Float32Array, ch: ChannelNo): Float32Array {
  const band = new Float32Array(5 * x.length);
  createPlacer().place(x, ch, band);
  return band;
}

/** What a fresh receiver (seed 1) gives on channel `ch` from the antenna `x`: its level without the first 200 pairs, dBm. */
function through(ch: ChannelNo, x: Float32Array, set: (fe: FrontEnd) => void = () => {}): number {
  const fe = createFrontEnd(1);
  set(fe);
  const out = new Float32Array(x.length / 5);
  fe.process(x, ch, out);
  return powerDbm(out, 200);
}

/** The bits of a Float32Array, to compare byte for byte. */
const bits = (x: Float32Array): Uint32Array => new Uint32Array(x.buffer, x.byteOffset, x.length);

describe('rf', () => {
  it('свій канал проходить, чужий — ні', () => {
    /* a tone of 0.1 cycle per channel sample with the amplitude dbmToAmp(−60), place(…, 3, …), 4 frames;
       channel 4 is shut as well (below −100) */
    const x = placed(tone(FRAMES * FRAME_CH, 0.1, dbmToAmp(-60)), 3);
    expect(Math.abs(through(3, x) + 60)).toBeLessThan(0.5);
    expect(through(1, x)).toBeLessThan(-100);
    expect(through(2, x)).toBeLessThan(-90);
    expect(through(4, x)).toBeLessThan(-100);
  });

  it('шум у фільтрі каналу — −92 dBm', () => {
    /* createAir(5).noise(antenna, ANTENNA_NOISE_SIGMA), 4 frames, channel 3; the input filter lets the same noise into
       every channel: −92 ± 0.5 on channels 1, 2 and 4 as well */
    const antenna = new Float32Array(2 * FRAMES * FRAME_WB);
    createAir(5).noise(antenna, ANTENNA_NOISE_SIGMA);
    const level = through(3, antenna);
    expect(Math.abs(level + 92)).toBeLessThan(0.5);
    for (const ch of [1, 2, 4] as const) expect(Math.abs(through(ch, antenna) + 92)).toBeLessThan(0.5);
  });

  it('стеля підсилювача', () => {
    /* a tone in the middle of channel 3, one frame; with the gain turned down by 20 dB the ceiling stands 20 dB
       higher on the antenna: −10 dBm comes out at −10 ± 0.5 */
    const at = (dbm: number, gainDb = 0): number =>
      through(3, placed(tone(FRAME_CH, 0, dbmToAmp(dbm)), 3), (fe) => {
        fe.gainDb = gainDb;
      });
    expect(Math.abs(at(-40) + 40)).toBeLessThan(0.1);
    expect(at(0)).toBeLessThanOrEqual(-20);
    expect(at(0)).toBeGreaterThan(-21.5);
    expect(at(-10)).toBeLessThanOrEqual(-20);
    expect(Math.abs(at(-10, -20) + 10)).toBeLessThan(0.5);
  });

  it('зі скрученим підсиленням хвиля тоне в шумі дальших блоків', () => {
    /* an empty antenna, 4 frames: gainDb 0 → the level −122 ± 0.7; gainDb −30 → −92 ± 0.7; the knob only turns the
       gain down: gainDb above 0 or NaN is a RangeError */
    const empty = new Float32Array(2 * FRAMES * FRAME_WB);
    expect(Math.abs(through(3, empty) + 122)).toBeLessThan(0.7);
    const turned = through(3, empty, (fe) => {
      fe.gainDb = -30;
    });
    expect(Math.abs(turned + 92)).toBeLessThan(0.7);
    for (const gainDb of [1, Number.NaN])
      expect(() =>
        through(3, empty, (fe) => {
          fe.gainDb = gainDb;
        }),
      ).toThrow(RangeError);
  });

  it('вхідний фільтр пропускає всі чотири канали', () => {
    /* a tone of −60 dBm in the middle of each channel, 4 frames: its own channel gives −60 ± 0.5;
       a wave of 0 dBm at 2489 MHz, beyond the band, next to the tone in channel 3: the filter keeps it off the
       amplifier (channel 3 still −60 ± 0.5); without the filter the amplifier hits its ceiling and the tone sinks
       by more than 10 dB */
    for (const ch of [1, 2, 3, 4] as const) {
      const x = placed(tone(FRAMES * FRAME_CH, 0, dbmToAmp(-60)), ch);
      expect(Math.abs(through(ch, x) + 60)).toBeLessThan(0.5);
    }
    const x = placed(tone(FRAMES * FRAME_CH, 0, dbmToAmp(-60)), 3);
    const beyond = tone(FRAMES * FRAME_WB, 0.48, 1); // 2441 + 48 MHz
    for (let i = 0; i < x.length; i++) x[i] += beyond[i]!;
    expect(Math.abs(through(3, x) + 60)).toBeLessThan(0.5);
    const bare = through(3, x, (fe) => {
      fe.inputFilter = false;
    });
    expect(bare).toBeLessThan(-70);
  });

  it('reset повторює вихід', () => {
    /* noise, 1 frame, reset(), the same input: toEqual; the second call goes on from the first; a fresh receiver of
       the same seed gives the same, and so does reset() after a call of a part of a frame; the placer repeats its
       output after reset() too */
    const antenna = new Float32Array(2 * FRAME_WB);
    createAir(3).noise(antenna, ANTENNA_NOISE_SIGMA);
    const fe = createFrontEnd(1);
    const run = (block: FrontEnd): Float32Array => {
      const out = new Float32Array(2 * FRAME_CH);
      block.process(antenna, 3, out);
      return out;
    };
    const first = run(fe);
    expect(bits(run(fe))).not.toEqual(bits(first));
    fe.reset();
    expect(bits(run(fe))).toEqual(bits(first));
    expect(bits(run(createFrontEnd(1)))).toEqual(bits(first));
    // a call of a part of a frame leaves the shift at another phase (a whole frame turns it a whole number of
    // times): reset() brings the phase back as well
    fe.process(antenna.subarray(0, 2 * 5 * 333), 3, new Float32Array(2 * 333));
    fe.reset();
    expect(bits(run(fe))).toEqual(bits(first));

    const signal = new Float32Array(2 * 1000); // short, so that a failure is reported quickly
    createAir(4).noise(signal, 0.1);
    const placer = createPlacer();
    const put = (): Float32Array => {
      const band = new Float32Array(5 * signal.length);
      placer.place(signal, 2, band);
      return band;
    };
    const once = put();
    expect(bits(put())).not.toEqual(bits(once));
    placer.reset();
    expect(bits(put())).toEqual(bits(once));
    placer.place(signal.subarray(0, 2 * 333), 2, new Float32Array(2 * 5 * 333));
    placer.reset();
    expect(bits(put())).toEqual(bits(once));
  });
});
