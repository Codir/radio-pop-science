import { describe, expect, it } from 'vitest';
import { PARTS, resistorKey, Transient } from '@electronics/sim/core';
import { BOARD_NODES, BOARD_PROBES, FILTER_OHMS, filterBoard, SPEAKER_FULL_SCALE } from '../board';

const RATE = 24000;
const BLOCK = 2048;

/** The RMS of the speaker's current and of its part above 2 kHz (a second-order Butterworth high-pass) over the
 * second second of the melody, as the sandbox measures it. */
function levels(ohms: number | null): { rms: number; hf: number } {
  const t = new Transient(filterBoard(ohms), { dt: 1 / RATE });
  expect(t.start('dc')).toBe(true);
  const sound = new Float32Array(BLOCK);
  const w = (2 * Math.PI * 2000) / RATE;
  const alpha = Math.sin(w) / Math.SQRT2;
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const [b0, b1, b2, a1, a2] = [
    (1 + cos) / 2 / a0,
    -(1 + cos) / a0,
    (1 + cos) / 2 / a0,
    (-2 * cos) / a0,
    (1 - alpha) / a0,
  ];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, all = 0, high = 0, n = 0; // prettier-ignore
  for (let k = 0; k < 24; k++) {
    t.run(BLOCK, [{ part: 'LS1', out: sound }]);
    for (const x of sound) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      [x2, x1, y2, y1] = [x1, x, y1, y];
      if (k < 12) continue;
      all += x * x;
      high += y * y;
      n++;
    }
  }
  return { rms: Math.sqrt(all / n), hf: Math.sqrt(high / n) };
}

describe('the board of the sound check', () => {
  it('is the amplifier with the player behind a low-pass of R and 100 nF, or behind a jumper', () => {
    const direct = filterBoard(null);
    const filtered = filterBoard(4700);
    expect(direct.nodes).toBe(BOARD_NODES.source + 1);
    expect(direct.parts.find((p) => p.id === 'PL')).toEqual({
      id: 'PL',
      spec: 'player',
      pins: [BOARD_NODES.source, 0],
    });
    expect(direct.parts.find((p) => p.id === 'J1')!.pins).toEqual([BOARD_NODES.source, BOARD_NODES.player]);
    expect(filtered.parts.find((p) => p.id === 'RF')).toEqual({
      id: 'RF',
      spec: 'resistor-4k7',
      pins: [BOARD_NODES.source, BOARD_NODES.player],
    });
    expect(filtered.parts.find((p) => p.id === 'CF')!.pins).toEqual([BOARD_NODES.player, 0]);
    expect(PARTS[filtered.parts.find((p) => p.id === 'CF')!.spec]).toMatchObject({
      kind: 'capacitor',
      farads: 100e-9,
    });
    expect(BOARD_PROBES).toEqual([{ part: 'LS1' }, { node: BOARD_NODES.speaker }]);
  });

  it('the filter’s resistors are the series E12 from 100 Ω to 100 kΩ, all in the catalog', () => {
    expect(FILTER_OHMS).toHaveLength(37);
    expect(FILTER_OHMS[0]).toBe(100);
    expect(FILTER_OHMS.at(-1)).toBe(100000);
    expect(FILTER_OHMS.slice(0, 13)).toEqual([
      100, 120, 150, 180, 220, 270, 330, 390, 470, 560, 680, 820, 1000,
    ]);
    for (const ohms of FILTER_OHMS) expect(() => resistorKey(ohms)).not.toThrow();
  });

  it('full scale is the speaker’s rated current, 0.5 A', () => {
    expect(SPEAKER_FULL_SCALE).toBeCloseTo(0.5, 12);
  });

  it('the filter takes the high notes away, more as its resistor grows', () => {
    const direct = levels(null);
    const k1 = levels(1000);
    const k10 = levels(10000);
    // the share above 2 kHz falls: 0.116 straight, 0.085 through 1 kΩ, 0.038 through 10 kΩ
    expect(k1.hf / k1.rms).toBeLessThan(0.8 * (direct.hf / direct.rms));
    expect(k10.hf / k10.rms).toBeLessThan(0.5 * (k1.hf / k1.rms));
    // and so does what is left of them: 0.108 of it through 10 kΩ (the 10 kΩ of the volume control load the
    // filter: the whole sound is 0.33 of it there)
    expect(k10.hf).toBeLessThan(0.125 * direct.hf);
  });
});
