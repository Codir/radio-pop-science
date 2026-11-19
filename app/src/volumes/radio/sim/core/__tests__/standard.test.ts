import { describe, expect, it } from 'vitest';
import { BAND, CHANNELS, FRAME_CH, FRAME_WB, FS_CH, FS_WB, LINE, radPerSample, shown } from '../standard';

describe('standard', () => {
  it('частини рядка дають 288 відліків', () => {
    expect(LINE.front + LINE.sync + LINE.back + LINE.active).toBe(288);
    expect(LINE.samples).toBe(288);
    expect(FRAME_CH).toBe(28_800);
    expect(FRAME_WB).toBe(144_000);
  });

  it('білий +72° за відлік, дно синхроімпульсу −77,4°', () => {
    expect((radPerSample(1) * 180) / Math.PI).toBeCloseTo(72, 9);
    expect((radPerSample(0) * 180) / Math.PI).toBeCloseTo(-77.4, 9);
  });

  it('справжні темпи — 20 і 100 MHz', () => {
    expect(shown(FS_CH)).toBe(20e6);
    expect(shown(FS_WB)).toBe(100e6);
  });

  it('канали стоять за ±9 і ±27 MHz від середини діапазону', () =>
    expect(CHANNELS.map((f) => f - BAND.centre)).toEqual([-27e6, -9e6, 9e6, 27e6]));
});
