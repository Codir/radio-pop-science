/**
 * The limits of the parts: how loaded a part is (its power or its current against its limit), what the stand shows
 * of it (ok, warm, hot, burnt), how heat gathers in time, and that a burnt part is an open circuit while a shorted
 * battery only warms.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceHeat,
  burnSeconds,
  canBurn,
  conditionOf,
  createModelState,
  HEAT_SECONDS,
  heatStep,
  loadOf,
  PARTS,
  solveDC,
  WARM_LOAD,
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

/** Runs a steady circuit in steps of `dt` until a part burns or `limit` seconds pass; the time when it burnt. */
function timeToBurn(board: Netlist, dt: number, limit: number): { seconds: number; burnt: string[] } {
  const state = createModelState();
  const dc = solveDC(board, { state });
  let seconds = 0;
  while (seconds < limit) {
    seconds += dt;
    const burnt = advanceHeat(state, board, dc, dt);
    if (burnt.length > 0) return { seconds, burnt };
  }
  return { seconds, burnt: [] };
}

describe('how loaded a part is', () => {
  it('ok up to half its limit, warm above that, hot above the limit, burnt once it is damaged', () => {
    expect(WARM_LOAD).toBe(0.5);
    expect(conditionOf(0, false)).toBe('ok');
    expect(conditionOf(0.5, false)).toBe('ok');
    expect(conditionOf(0.5000001, false)).toBe('warm');
    expect(conditionOf(1, false)).toBe('warm');
    expect(conditionOf(1.0000001, false)).toBe('hot');
    expect(conditionOf(20, false)).toBe('hot');
    expect(conditionOf(0, true)).toBe('burnt');
    expect(conditionOf(5, true)).toBe('burnt');
  });

  it('by power or by current, whichever is nearer its limit; the wrong way round by reverse voltage', () => {
    const reading = (u: number, i: number) => ({ u, i, p: u * i });
    // a resistor of 0.25 W: by power
    close(loadOf(PARTS['resistor-100']!, reading(5, 0.05)), 1, 1e-15, '0.25 W in 0.25 W');
    // an LED: by current, 30 mA
    close(loadOf(PARTS['led-red']!, reading(1.95, 0.02)), 2 / 3, 1e-15, '20 mA of 30 mA');
    // a diode: by current, and by the voltage the wrong way round
    close(loadOf(PARTS['diode-1n4148']!, reading(0.9, 0.1)), 0.5, 1e-15, '1N4148: 100 mA of 200 mA');
    close(loadOf(PARTS['diode-1n4148']!, reading(-50, -1.3e-8)), 0.5, 1e-15, '1N4148: 50 V of 100 V');
    close(loadOf(PARTS['diode-1n4007']!, reading(0.9, 2)), 2, 1e-15, '1N4007: 2 A of 1 A');
    // the lamp by power, the speaker by power, the pot by the power of its whole track
    close(loadOf(PARTS['lamp-6v']!, reading(6, 0.1)), 0.6 / 0.7, 1e-15, 'the lamp at 6 V');
    close(loadOf(PARTS['speaker-8']!, reading(4, 0.5)), 1, 1e-15, 'the speaker at 2 W');
    close(loadOf(PARTS['pot-10k']!, { u: 0, i: -0.001, p: 0.01 }), 0.05, 1e-15, 'the pot');
    // a battery by its current, whichever way it flows
    close(loadOf(PARTS['battery-9v']!, reading(0.009, -6)), 6, 1e-12, 'the 9 V battery shorted');
    close(loadOf(PARTS['battery-aa']!, reading(1.2, -1.5)), 0.5, 1e-15, 'an AA cell at 1.5 A');
    // parts without limits are never loaded
    // a transistor by its collector current or by the power it takes, whichever is nearer its limit
    close(
      loadOf(PARTS['transistor-bc547b']!, { u: 4, i: 0.05, p: 0.2 }),
      0.5,
      1e-15,
      'BC547B: 50 mA of 100 mA',
    );
    close(
      loadOf(PARTS['transistor-2n3906']!, { u: -5, i: -0.1, p: 0.5 }),
      0.8,
      1e-15,
      '2N3906: 0.5 W of 0.625 W',
    );
    for (const key of ['jumper', 'switch', 'ideal-9v', 'ideal-5v', 'player-tone'])
      expect(loadOf(PARTS[key]!, reading(9, 100)), key).toBe(0);
  });

  it('the limits of the catalog', () => {
    for (const [key, spec] of Object.entries(PARTS))
      if (spec.kind === 'resistor') expect(spec.limits, key).toEqual({ powerW: 0.25 });
    expect(PARTS['battery-9v']!.limits).toEqual({ currentA: 1 });
    expect(PARTS['battery-4aa']!.limits).toEqual({ currentA: 3 });
    expect(PARTS['battery-aa']!.limits).toEqual({ currentA: 3 });
    expect(PARTS['diode-1n4148']!.limits).toEqual({ currentA: 0.2, reverseV: 100 });
    expect(PARTS['diode-1n4007']!.limits).toEqual({ currentA: 1, reverseV: 1000 });
    for (const color of ['red', 'yellow', 'green', 'blue', 'white'])
      expect(PARTS[`led-${color}`]!.limits, color).toEqual({ currentA: 0.03 });
    expect(PARTS['lamp-6v']!.limits).toEqual({ powerW: 0.7 });
    for (const key of ['transistor-bc547b', 'transistor-bc557b'])
      expect(PARTS[key]!.limits, key).toEqual({ currentA: 0.1, powerW: 0.5 });
    for (const key of ['transistor-2n3904', 'transistor-2n3906'])
      expect(PARTS[key]!.limits, key).toEqual({ currentA: 0.2, powerW: 0.625 });
    // what can burn: every limited part but a battery
    expect(canBurn(PARTS['resistor-1k']!)).toBe(true);
    expect(canBurn(PARTS['led-blue']!)).toBe(true);
    expect(canBurn(PARTS['lamp-6v']!)).toBe(true);
    expect(canBurn(PARTS['diode-1n4007']!)).toBe(true);
    expect(canBurn(PARTS['pot-10k']!)).toBe(true);
    expect(canBurn(PARTS['speaker-8']!)).toBe(true);
    expect(canBurn(PARTS['transistor-2n3904']!)).toBe(true);
    for (const key of ['battery-9v', 'battery-4aa', 'battery-aa', 'jumper', 'switch', 'ideal-9v'])
      expect(canBurn(PARTS[key]!), key).toBe(false);
  });
});

describe('heat in time', () => {
  it('heat follows the load with the part’s time constant; a part burns when its heat reaches 1', () => {
    expect(HEAT_SECONDS).toEqual({
      battery: 2,
      capacitor: 10,
      resistor: 10,
      pot: 10,
      speaker: 10,
      lamp: 2,
      led: 2,
      diode: 5,
      transistor: 5,
    });
    // the exact step of dH/dt = (load − H)/τ for a constant load
    close(heatStep(0, 4, 10, 10), 4 * (1 - Math.exp(-1)), 1e-15, 'one time constant');
    close(heatStep(2, 0, 10, 10), 2 * Math.exp(-1), 1e-15, 'cooling');
    expect(heatStep(0.7, 0.7, 123, 10)).toBe(0.7);
    // from cold at a constant load L > 1 it burns after τ·ln(L / (L − 1)); never at L ≤ 1
    close(burnSeconds(4, 10), 10 * Math.log(4 / 3), 1e-15, 'four times its limit');
    close(heatStep(0, 4, burnSeconds(4, 10), 10), 1, 1e-15, 'burns exactly then');
    expect(burnSeconds(1, 10)).toBe(Number.POSITIVE_INFINITY);
    expect(burnSeconds(0.8, 10)).toBe(Number.POSITIVE_INFINITY);
  });

  it('a 0.25 W resistor at 0.2 W never burns; at 1 W it burns in 1 to 10 s of model time', () => {
    // 6 V across 180 Ω behind the 0.6 Ω of four AA cells: 0.199 W
    const gentle = net(2, part('B', 'battery-4aa', [1, 0]), part('R', 'resistor-180', [1, 0]));
    const calm = solveDC(gentle);
    close(calm.parts.R!.p, 0.2, 0.002, '0.2 W');
    expect(calm.status.R).toEqual({ condition: 'warm', load: calm.parts.R!.p / 0.25 });
    expect(timeToBurn(gentle, 1, 3600).burnt).toEqual([]); // an hour
    // 9 V across 75 Ω behind the 1.5 Ω of the battery: 1.04 W
    const harsh = net(2, part('B', 'battery-9v', [1, 0]), part('R', 'resistor-75', [1, 0]));
    const hot = solveDC(harsh);
    close(hot.parts.R!.p, 1, 0.05, '1 W');
    expect(hot.status.R!.condition).toBe('hot');
    const { seconds, burnt } = timeToBurn(harsh, 0.01, 60);
    expect(burnt).toEqual(['R']);
    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeLessThanOrEqual(10);
    close(seconds, burnSeconds(hot.parts.R!.p / 0.25, 10), 0.01, 'as the formula says');
  });

  it('a burnt part is an open circuit and stays burnt', () => {
    const board = net(
      3,
      part('B', 'battery-9v', [1, 0]),
      part('R1', 'resistor-75', [1, 2]),
      part('R2', 'resistor-1', [2, 0]),
    );
    const state = createModelState();
    const dc = solveDC(board, { state });
    for (let k = 0; k < 1000 && advanceHeat(state, board, dc, 0.01).length === 0; k++);
    expect(state.parts.get('R1')).toMatchObject({ burnt: true });
    const after = solveDC(board, { state });
    expect(after.ok).toBe(true);
    expect(after.parts.R1).toEqual({ u: after.v[1]! - after.v[2]!, i: 0, p: 0 });
    expect(after.parts.R2!.i).toBe(0);
    close(after.parts.R1!.u, 9, 1e-9, 'the whole battery across the gap');
    expect(after.status.R1).toEqual({ condition: 'burnt', load: 0 });
    expect(after.status.R2).toEqual({ condition: 'ok', load: 0 });
    expect(after.issues).toEqual([{ kind: 'open', part: 'B' }]);
    // nothing brings it back but a new part: the stand forgets the old one
    advanceHeat(state, board, after, 1000);
    expect(state.parts.get('R1')!.burnt).toBe(true);
    state.parts.delete('R1');
    expect(solveDC(board, { state }).parts.R1!.i).toBeGreaterThan(0.1);
  });

  it('a shorted battery warms and never burns; the jumper across it never either', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('J', 'jumper', [1, 0]));
    const state = createModelState();
    const dc = solveDC(board, { state });
    expect(dc.status.B).toEqual({ condition: 'hot', load: Math.abs(dc.parts.B!.i) / 1 });
    expect(dc.status.J).toEqual({ condition: 'ok', load: 0 });
    for (let k = 0; k < 3600; k++) expect(advanceHeat(state, board, dc, 1)).toEqual([]);
    close(state.parts.get('B')!.heat, dc.status.B!.load, 1e-9, 'as warm as its load');
    expect(state.parts.get('B')!.burnt).toBe(false);
    // two seconds of a short warm it by 1 − 1/e of the way
    const fresh = createModelState();
    advanceHeat(fresh, board, dc, 2);
    close(fresh.parts.get('B')!.heat, dc.status.B!.load * (1 - Math.exp(-1)), 1e-12, 'two seconds');
  });

  it('two stands keep their own heat', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('R', 'resistor-75', [1, 0]));
    const a = createModelState();
    const b = createModelState();
    const dc = solveDC(board);
    advanceHeat(a, board, dc, 5);
    expect(a.parts.get('R')!.burnt).toBe(true);
    expect(b.parts.size).toBe(0);
    expect(solveDC(board, { state: b }).parts.R!.i).toBeGreaterThan(0.1);
    expect(solveDC(board, { state: a }).parts.R!.i).toBe(0);
  });

  it('time runs forward only', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('R', 'resistor-1k', [1, 0]));
    const dc = solveDC(board);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => advanceHeat(createModelState(), board, dc, bad)).toThrow(RangeError);
    expect(advanceHeat(createModelState(), board, dc, 0)).toEqual([]);
  });
});
