import { describe, expect, it } from 'vitest';
import reference from '../__fixtures__/standard.json';
import { GAUSS_TABLE } from '../rng';
import * as standard from '../standard';
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

  it('сталі збігаються з еталоном', () => {
    // standard.json is written by tools/ref-models/radio/fm_chain.py from the plan, not from standard.ts
    const { radWhite, radSync, gauss, ...consts } = reference;
    const ours = standard as unknown as Record<string, unknown>;
    // the sample has 6 significant digits
    const close = (ts: unknown, json: number, name: string): void =>
      expect((ts as number) / json, name).toBeCloseTo(1, 4);

    // every constant of the standard is in the sample, and the sample has no other
    const names = Object.keys(ours).filter((name) => typeof ours[name] !== 'function');
    expect(names.sort()).toEqual(Object.keys(consts).sort());

    for (const [name, json] of Object.entries(consts)) {
      const ts = ours[name];
      if (name === 'LINE' || name === 'LEVEL' || name === 'CHANNELS') expect(ts, name).toEqual(json);
      else if (typeof json === 'number') close(ts, json, name);
      else {
        // DEVIATION, BAND: the same parts, each one a number
        expect(Object.keys(ts as object).sort(), name).toEqual(Object.keys(json).sort());
        for (const [part, value] of Object.entries(json))
          close((ts as Record<string, number>)[part], value, `${name}.${part}`);
      }
    }

    close(radPerSample(1), radWhite, 'radWhite');
    close(radPerSample(0), radSync, 'radSync');
    for (const [index, quantile] of Object.entries(gauss))
      close(GAUSS_TABLE[Number(index)], quantile, `gauss.${index}`);
  });
});
