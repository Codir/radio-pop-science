/**
 * The whole chain against its independent reference (tools/ref-models/radio/fm_chain.py, task B9a): the clean
 * screen without noise, and the curve of cleanliness measured the same way.
 */
import { describe, expect, it } from 'vitest';
import noiseless from '../__fixtures__/link-noiseless.json';
import snr from '../__fixtures__/snr-curve.json';
import { createFmLink } from '../fm-link';
import { curve, reference } from './curve';
import { FLAT } from './helpers';

describe('oracle', () => {
  it('чистий екран збігається з еталоном', { timeout: 120_000 }, () => {
    // the model screen of seed 2026 (stop 0, 10 mW, with the noise of the antenna) against the reference's screen
    // without any noise; the bounds of brightness differ a little, as the reference's line rhythm wanders its own way
    const screen = reference(createFmLink(2026));
    expect(screen).toHaveLength(noiseless.screen.length);
    let flatWorst = 0;
    let worst = 0;
    let sum = 0;
    for (let k = 0; k < screen.length; k++) {
      const d = Math.abs(screen[k]! - noiseless.screen[k]!);
      if (FLAT[k]) flatWorst = Math.max(flatWorst, d);
      worst = Math.max(worst, d);
      sum += d;
    }
    expect(flatWorst).toBeLessThanOrEqual(3);
    expect(worst).toBeLessThanOrEqual(24);
    expect(sum / screen.length).toBeLessThanOrEqual(1.5);
  });

  it('крива чистоти збігається з еталонною', { timeout: 120_000 }, () => {
    // at −66…−74 dBm within 1.5 dB; at −60…−64, where seeds spread the cleanliness by up to 2.7 dB, within 3 dB
    const c = curve();
    const checked = snr.levels.filter((dbm) => dbm >= -74);
    expect(checked).toEqual([-60, -62, -64, -66, -68, -70, -72, -74]);
    for (const dbm of checked) {
      const gap = Math.abs(c.clean(dbm) - snr.clean[snr.levels.indexOf(dbm)]!);
      expect(gap, `${dbm} dBm`).toBeLessThanOrEqual(dbm >= -64 ? 3 : 1.5);
    }
    expect(Math.abs(c.knee - snr.knee)).toBeLessThanOrEqual(2);
  });
});
