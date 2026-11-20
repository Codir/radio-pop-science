/**
 * The incandescent lamp: a tungsten filament whose resistance grows with its temperature, at the temperature where
 * the heat it radiates equals the power it takes. The numbers of the plan (6 V · 0.1 A, cold ≈ 11 times less) and a
 * steady state found here again by plain bisection, independently of the model's own iteration.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceHeat,
  createModelState,
  filament,
  PARTS,
  ROOM_KELVIN,
  solveDC,
  TUNGSTEN_EXPONENT,
  type LampSpec,
  type Netlist,
  type PartInstance,
} from '../index';

const part = (id: string, spec: string, pins: number[], setting?: number): PartInstance =>
  setting === undefined ? { id, spec, pins } : { id, spec, pins, setting };
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

const LAMP = PARTS['lamp-6v'] as LampSpec;

// ── The lamp by hand, from the numbers of README.md ─────────────────────────────────────────────────────────────
const T0 = 300.15; // the room, K
const ALPHA = 1.21; // R ∝ T^1.21: tungsten from 300 to 3000 K
const COLD = 5.5; // Ω at the room's temperature
const HOT = 60; // Ω at 6 V and 0.1 A
const T_HOT = T0 * (HOT / COLD) ** (1 / ALPHA);
const K = 0.6 / (T_HOT ** 4 - T0 ** 4); // the filament radiates K·(T⁴ − T0⁴) W
const ohmsAt = (t: number): number => COLD * (t / T0) ** ALPHA;

/** The steady filament at `volts` by bisection: the power V²/R(T) it takes equals the K·(T⁴ − T0⁴) it radiates. */
function steady(volts: number): { kelvin: number; amps: number } {
  let low = T0;
  let high = 10 * T_HOT;
  for (let k = 0; k < 200; k++) {
    const t = (low + high) / 2;
    if (K * (t ** 4 - T0 ** 4) * ohmsAt(t) < volts * volts) low = t;
    else high = t;
  }
  const kelvin = (low + high) / 2;
  return { kelvin, amps: volts / ohmsAt(kelvin) };
}

/** The current of a lamp on a battery of `volts` behind `ohms`, by bisection on the current. */
function onBattery(volts: number, ohms: number): number {
  let low = 0;
  let high = volts / ohms;
  for (let k = 0; k < 200; k++) {
    const i = (low + high) / 2;
    if (i < steady(volts - i * ohms).amps) low = i;
    else high = i;
  }
  return (low + high) / 2;
}

describe('the incandescent lamp', () => {
  it('the catalog: 6 V · 0.1 A, cold 5.5 Ω, a filament of tungsten with a thermal time constant of 50 ms', () => {
    expect(LAMP).toEqual({
      kind: 'lamp',
      pins: ['a', 'b'],
      volts: 6,
      amps: 0.1,
      coldOhms: 5.5,
      tauS: 0.05,
      limits: { powerW: 0.7 },
    });
    expect(TUNGSTEN_EXPONENT).toBe(ALPHA);
    expect(ROOM_KELVIN).toBe(T0);
    // the plan: cold 10 to 12 times less than hot; the time constant 50 to 100 ms
    expect(HOT / LAMP.coldOhms).toBeGreaterThanOrEqual(10);
    expect(HOT / LAMP.coldOhms).toBeLessThanOrEqual(12);
    expect(LAMP.tauS).toBeGreaterThanOrEqual(0.05);
    expect(LAMP.tauS).toBeLessThanOrEqual(0.1);
  });

  it('at its 6 V it takes 0.1 A: 60 Ω at about 2160 K; cold it has 5.5 Ω', () => {
    const rated = filament(LAMP, 6);
    close(rated.amps, 0.1, 1e-12, '0.1 A');
    close(rated.ohms, 60, 1e-9, '60 Ω');
    close(rated.watts, 0.6, 1e-12, '0.6 W');
    close(rated.kelvin, T_HOT, 1e-9, 'the hot filament');
    close(rated.kelvin, 2163, 1, 'about 2160 K');
    const cold = filament(LAMP, 0);
    expect(cold).toEqual({ kelvin: T0, ohms: 5.5, amps: 0, watts: 0 });
    // a millivolt hardly warms it (0.2 K: near the room's temperature radiation alone cools a filament slowly)
    close(filament(LAMP, 1e-3).ohms, 5.5, 0.002, 'at 1 mV');
  });

  it('the steady filament agrees with the calculation by hand at every voltage', () => {
    for (const volts of [0.01, 0.5, 1.5, 3, 4.5, 6, 7.5, 9, 12]) {
      const hand = steady(volts);
      const model = filament(LAMP, volts);
      close(model.kelvin, hand.kelvin, 1e-9 * hand.kelvin, `${volts} V: temperature`);
      close(model.amps, hand.amps, 1e-9 * hand.amps, `${volts} V: current`);
      close(model.ohms * model.amps, volts, 1e-12 * volts, `${volts} V: Ohm`);
      close(model.watts, volts * model.amps, 1e-15, `${volts} V: power`);
      // the reverse voltage drives the same current back
      const back = filament(LAMP, -volts);
      expect(back.kelvin).toBe(model.kelvin);
      expect(back.amps).toBe(-model.amps);
    }
  });

  it('its law: the current grows about as V^0.55, the power as V^1.55', () => {
    const ratio = filament(LAMP, 6).amps / filament(LAMP, 3).amps;
    expect(ratio).toBeGreaterThan(2 ** 0.5);
    expect(ratio).toBeLessThan(2 ** 0.6);
  });

  it('from 6 V (four AA cells): 0.1 A ± 2 %', () => {
    const dc = solveDC(net(2, part('B', 'battery-4aa', [1, 0]), part('L', 'lamp-6v', [1, 0])));
    expect(dc.ok).toBe(true);
    expect(dc.iterations).toBeLessThanOrEqual(50);
    close(dc.parts.L!.i, 0.1, 0.002, '0.1 A ± 2 %');
    close(dc.parts.L!.i, onBattery(6, 0.6), 1e-9, 'the loop by hand');
    expect(dc.status.L!.condition).toBe('warm'); // it glows at its rated power: hot to the touch, within its limit
  });

  it('from 3 V (two AA cells in series) less than half the brightness, by power', () => {
    const six = solveDC(net(2, part('B', 'battery-4aa', [1, 0]), part('L', 'lamp-6v', [1, 0])));
    const three = solveDC(
      net(
        3,
        part('B1', 'battery-aa', [1, 0]),
        part('B2', 'battery-aa', [2, 1]),
        part('L', 'lamp-6v', [2, 0]),
      ),
    );
    expect(three.ok).toBe(true);
    close(three.parts.L!.i, onBattery(3, 0.3), 1e-9, 'the loop by hand');
    expect(three.parts.L!.p).toBeLessThan(0.5 * six.parts.L!.p);
    expect(three.parts.L!.p / six.parts.L!.p).toBeGreaterThan(0.25); // dimmer, not dark
  });

  it('a solve leaves the filament’s temperature in the state, and a dark lamp is at room temperature', () => {
    const state = createModelState();
    const board = net(
      3,
      part('B', 'battery-4aa', [1, 0]),
      part('S', 'switch', [1, 2], 0),
      part('L', 'lamp-6v', [2, 0]),
    );
    solveDC(board, { state });
    expect(state.parts.get('L')!.kelvin).toBe(T0);
    board.parts[1]!.setting = 1;
    const on = solveDC(board, { state });
    close(state.parts.get('L')!.kelvin, filament(LAMP, on.parts.L!.u).kelvin, 1e-9, 'lit');
    expect(state.parts.get('L')!.kelvin).toBeGreaterThan(2000);
  });

  it('within 10 % over its voltage it lives; from the 9 V battery it is hot and burns out in seconds', () => {
    expect(filament(LAMP, 6.6).watts).toBeLessThanOrEqual(LAMP.limits.powerW!);
    const six = net(2, part('B', 'battery-4aa', [1, 0]), part('L', 'lamp-6v', [1, 0]));
    const calm = createModelState();
    const glowing = solveDC(six, { state: calm });
    for (let k = 0; k < 3600; k++) expect(advanceHeat(calm, six, glowing, 1)).toEqual([]);

    const nine = net(2, part('B', 'battery-9v', [1, 0]), part('L', 'lamp-6v', [1, 0]));
    const state = createModelState();
    const dc = solveDC(nine, { state });
    expect(dc.status.L!.condition).toBe('hot');
    let seconds = 0;
    while (advanceHeat(state, nine, dc, 0.01).length === 0 && seconds < 60) seconds += 0.01;
    expect(seconds).toBeGreaterThan(0.5);
    expect(seconds).toBeLessThan(10);
    const after = solveDC(nine, { state });
    expect(after.parts.L!.i).toBe(0);
    expect(after.status.L!.condition).toBe('burnt');
    expect(state.parts.get('L')!.kelvin).toBe(T0); // a broken filament is dark
  });
});
