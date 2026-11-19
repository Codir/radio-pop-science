/**
 * The reduced standard of the model: rates, the parts of a line, levels and the grid of channels.
 *
 * The model computes at reduced frequencies; scales and labels show the real ones. The rule:
 * real frequency = model frequency × K. Names with "real Hz" below are already real frequencies.
 *
 * Conventions of the whole model:
 * - a signal with both shadows is a Float32Array of pairs [re0, im0, re1, im1, …]; the unit of amplitude is
 *   √mW, so re² + im² is the power in mW;
 * - a line of the frame is [front 7 × 0.3][sync 21 × 0][back 26 × 0.3][active 234], u = 0.3 + 0.7 · luma / 255;
 *   lines 96–99 are the frame mark: [front 7 × 0.3][255 × 0][back 26 × 0.3];
 * - one frame of the model lasts 6.4 ms of model time (100 lines of 64 μs); blocks keep their state between
 *   frames, so the signal is continuous.
 */
export const K = 40 / 9; // ≈ 4.44
export const COLS = 128,
  ROWS = 96,
  FRAME_LINES = 100; // 96 visible lines + 4 lines of the frame mark
export const LINE = { samples: 288, front: 7, sync: 21, back: 26, active: 234 } as const; // 1.65 : 4.7 : 5.7 : 52
export const FS_CH = 4.5e6; // channel rate, model Hz = 20 MHz real
export const OVERSAMPLE = 5;
export const FS_WB = 22.5e6; // band rate, model Hz = 100 MHz real
export const FRAME_CH = 28_800,
  FRAME_WB = 144_000; // samples per frame
export const LEVEL = { sync: 0, black: 0.3, white: 1 } as const; // the signal u: 0 is the bottom of the sync pulse
export const DEVIATION = { atSync: -4.3e6, span: 8.3e6 } as const; // real Hz: f(u) = atSync + span·u
export const VIDEO_BW = 5.5e6,
  CHANNEL_BW = 20e6; // real Hz
export const BAND = { centre: 2441e6, lo: 2400e6, hi: 2483.5e6 } as const;
export const IF = 35e6; // real Hz: where the channel stands after the shift (25…45 MHz on the probe's scales)
export const CHANNELS = [2414e6, 2432e6, 2450e6, 2468e6] as const;
export type ChannelNo = 1 | 2 | 3 | 4;
export const shown = (modelHz: number): number => modelHz * K;
export const model = (shownHz: number): number => shownHz / K;
/** Turn of the arrow per channel sample, radians: white +72°, the bottom of the sync pulse −77.4°. */
export const radPerSample = (u: number): number =>
  (2 * Math.PI * (DEVIATION.atSync + DEVIATION.span * u)) / 20e6;
