/** The catalog: the keys, the series of resistors, the numbers of the plan and of the published models. */
import { describe, expect, it } from 'vitest';
import { E12, E24, PARTS, resistorKey, WIRE_OHMS, type PartSpec } from '../index';

const resistors = Object.entries(PARTS).filter(
  (entry): entry is [string, Extract<PartSpec, { kind: 'resistor' }>] => entry[1].kind === 'resistor',
);

describe('the catalog of parts', () => {
  it('resistors: every value of E24 from 1 Ω to 9.1 MΩ and 10 MΩ, 0.25 W, 5 %', () => {
    expect(E24).toHaveLength(24);
    expect(E12).toHaveLength(12);
    expect(E12.every((d) => E24.includes(d))).toBe(true);
    expect(resistors).toHaveLength(7 * 24 + 1);
    const values = resistors.map(([, spec]) => spec.ohms).sort((a, b) => a - b);
    expect(values[0]).toBe(1);
    expect(values.at(-1)).toBe(10e6);
    for (const [key, spec] of resistors) {
      expect(spec.pins).toEqual(['a', 'b']);
      expect(spec.limits).toEqual({ powerW: 0.25 });
      expect(spec.tolerance).toBe(0.05);
      const digits = Math.round(spec.ohms / 10 ** (Math.floor(Math.log10(spec.ohms) + 1e-9) - 1));
      expect(E24, key).toContain(digits);
      expect(spec.series, key).toBe(E12.includes(digits) ? 'E12' : 'E24');
      expect(resistorKey(spec.ohms), key).toBe(key);
    }
    expect(resistors.filter(([, spec]) => spec.series === 'E12')).toHaveLength(7 * 12 + 1);
  });

  it('a resistor key is the letter code of its value', () => {
    for (const [ohms, key] of [
      [1, 'resistor-1'],
      [4.7, 'resistor-4R7'],
      [10, 'resistor-10'],
      [100, 'resistor-100'],
      [330, 'resistor-330'],
      [1000, 'resistor-1k'],
      [2000, 'resistor-2k'],
      [2200, 'resistor-2k2'],
      [4700, 'resistor-4k7'],
      [47e3, 'resistor-47k'],
      [470e3, 'resistor-470k'],
      [1e6, 'resistor-1M'],
      [9.1e6, 'resistor-9M1'],
      [10e6, 'resistor-10M'],
    ] as const) {
      expect(resistorKey(ohms)).toBe(key);
      expect(PARTS[key]).toMatchObject({ kind: 'resistor', ohms });
    }
    for (const missing of [1234, 0.5, 0, -100, 20e6, Number.NaN])
      expect(() => resistorKey(missing)).toThrow(RangeError);
  });

  it('batteries and the ideal sources: the numbers of the plan', () => {
    expect(PARTS['battery-9v']).toEqual({
      kind: 'battery',
      pins: ['plus', 'minus'],
      volts: 9,
      ohms: 1.5,
      cells: 6,
      limits: { currentA: 1 },
    });
    expect(PARTS['battery-4aa']).toMatchObject({ volts: 6, ohms: 0.6, cells: 4 });
    expect(PARTS['battery-aa']).toMatchObject({ volts: 1.5, ohms: 0.15, cells: 1 });
    expect(PARTS['ideal-9v']).toEqual({ kind: 'source', pins: ['plus', 'minus'], volts: 9, limits: {} });
    expect(PARTS['ideal-5v']).toEqual({ kind: 'source', pins: ['plus', 'minus'], volts: 5, limits: {} });
    // a sine of 6 V amplitude, 50 Hz unless its setting says another frequency: the reference of the oracle in time
    expect(PARTS['ideal-ac-6v']).toEqual({
      kind: 'sine',
      pins: ['plus', 'minus'],
      amplitude: 6,
      hz: 50,
      limits: {},
    });
  });

  it('the diodes: the parameters of their published SPICE models', () => {
    // Nexperia (NXP) 1N4148: R1 1 2 5.827E+9 / .MODEL 1N4148 D IS = 4.352E-9 N = 1.906 BV = 110 IBV = 0.0001
    // RS = 0.6458 …; the limits from its datasheet: IF 200 mA, VRRM 100 V
    expect(PARTS['diode-1n4148']).toEqual({
      kind: 'diode',
      pins: ['anode', 'cathode'],
      is: 4.352e-9,
      n: 1.906,
      rs: 0.6458,
      bv: 110,
      ibv: 1e-4,
      leakOhms: 5.827e9,
      limits: { currentA: 0.2, reverseV: 100 },
    });
    // Vishay (Thomatronik) d1n4007: is = 1.43733E-008 n = 1.80829 rs = 0.0414712 … bv = 1100 ibv = 10
    expect(PARTS['diode-1n4007']).toEqual({
      kind: 'diode',
      pins: ['anode', 'cathode'],
      is: 1.43733e-8,
      n: 1.80829,
      rs: 0.0414712,
      bv: 1100,
      ibv: 10,
      limits: { currentA: 1, reverseV: 1000 },
    });
  });

  it('the LEDs: five colours, fitted to the plan, 20 mA rated, 30 mA at most', () => {
    const fitted = {
      red: { is: 8.66e-18, n: 2, rs: 6 },
      yellow: { is: 1.25e-18, n: 2, rs: 6 },
      green: { is: 1.81e-19, n: 2, rs: 6 },
      blue: { is: 2.45e-16, n: 3.5, rs: 10 },
      white: { is: 2.45e-16, n: 3.5, rs: 10 },
    };
    for (const [color, junction] of Object.entries(fitted)) {
      expect(PARTS[`led-${color}`], color).toEqual({
        kind: 'led',
        pins: ['anode', 'cathode'],
        color,
        ...junction,
        bv: 20,
        ibv: 10e-6,
        ratedA: 0.02,
        lumensPerAmp: expect.any(Number),
        limits: { currentA: 0.03 },
      });
    }
  });

  it('the pot, the switch, the jumper, the speaker and the earphone', () => {
    expect(WIRE_OHMS).toBe(1e-3);
    expect(PARTS['pot-10k']).toEqual({
      kind: 'pot',
      pins: ['ccw', 'wiper', 'cw'],
      ohms: 10e3,
      limits: { powerW: 0.2 },
    });
    expect(PARTS.switch).toEqual({ kind: 'switch', pins: ['a', 'b'], limits: {} });
    expect(PARTS.jumper).toEqual({ kind: 'jumper', pins: ['a', 'b'], limits: {} });
    expect(PARTS['speaker-8']).toEqual({
      kind: 'speaker',
      pins: ['plus', 'minus'],
      ohms: 8,
      limits: { powerW: 2 },
    });
    expect(PARTS['earphone-32']).toEqual({
      kind: 'speaker',
      pins: ['plus', 'minus'],
      ohms: 32,
      limits: { powerW: 0.1 },
    });
  });

  it('every part has a kind, named pins and limits; the catalog cannot be changed', () => {
    const kinds = new Set<string>();
    for (const [key, spec] of Object.entries(PARTS)) {
      kinds.add(spec.kind);
      expect(spec.pins.length, key).toBeGreaterThanOrEqual(2);
      expect(new Set(spec.pins).size, key).toBe(spec.pins.length);
      expect(spec.limits, key).toBeTypeOf('object');
    }
    expect([...kinds].sort()).toEqual([
      'battery',
      'capacitor',
      'diode',
      'jumper',
      'lamp',
      'led',
      'pot',
      'resistor',
      'sine',
      'source',
      'speaker',
      'switch',
    ]);
    expect(Object.isFrozen(PARTS)).toBe(true);
  });
});
