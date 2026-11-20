/**
 * Capacitors: the catalog (ceramic, film and electrolytic, each a capacitance behind its ESR with a leak across it),
 * a capacitor at the operating point (open, but for its leak), its limits (the rated voltage either way, an
 * electrolytic the wrong way round above 1 V) and what happens to an electrolytic over them in time: it bulges, and
 * from then on it is a leak of 1 kΩ with no capacitance.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceHeat,
  BULGED_OHMS,
  conditionOf,
  createModelState,
  HEAT_SECONDS,
  loadOf,
  PARTS,
  solveDC,
  Transient,
  type CapacitorSpec,
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

const capacitor = (key: string): CapacitorSpec => PARTS[key] as CapacitorSpec;
const round4 = (x: number): number => Number(x.toPrecision(4));

/** An electrolytic: tan δ at 120 Hz of Nichicon's VR series by rated voltage; the leakage after 5 minutes at the
 * rated voltage of Vishay's 048 RML, 0.002·C·U + 3 μA (C in μF, U in V). */
const TAN_DELTA: Record<number, number> = { 16: 0.2, 6.3: 0.28 };
const ELECTROLYTIC: readonly (readonly [string, number, number])[] = [
  ['electrolytic-1u-16v', 1e-6, 16],
  ['electrolytic-10u-16v', 10e-6, 16],
  ['electrolytic-100u-16v', 100e-6, 16],
  ['electrolytic-470u-16v', 470e-6, 16],
  ['electrolytic-1000u-16v', 1000e-6, 16],
  ['electrolytic-100u-6v3', 100e-6, 6.3],
];

describe('the capacitors of the catalog', () => {
  it('ceramic 100 pF … 100 nF on 50 V, film 100 nF and 1 μF on 63 V, every value the plan names', () => {
    const ceramic = {
      'ceramic-100p': 100e-12,
      'ceramic-1n': 1e-9,
      'ceramic-10n': 10e-9,
      'ceramic-100n': 100e-9,
    };
    for (const [key, farads] of Object.entries(ceramic))
      expect(capacitor(key), key).toEqual({
        kind: 'capacitor',
        pins: ['a', 'b'],
        dielectric: 'ceramic',
        polar: false,
        farads,
        esrOhms: 0.03,
        leakOhms: 10e9,
        ratedV: 50,
        limits: { voltageV: 50 },
      });
    // WIMA MKS 2: at least 10⁴ MΩ up to 0.33 μF, at least 1250 s (MΩ·μF) above
    for (const [key, farads, leakOhms] of [
      ['film-100n', 100e-9, 10e9],
      ['film-1u', 1e-6, 1.25e9],
    ] as const)
      expect(capacitor(key), key).toEqual({
        kind: 'capacitor',
        pins: ['a', 'b'],
        dielectric: 'film',
        polar: false,
        farads,
        esrOhms: 0.03,
        leakOhms,
        ratedV: 63,
        limits: { voltageV: 63 },
      });
    const keys = Object.keys(PARTS).filter((key) => PARTS[key]!.kind === 'capacitor');
    expect(keys.sort()).toEqual(
      [...Object.keys(ceramic), 'film-100n', 'film-1u', ...ELECTROLYTIC.map(([k]) => k)].sort(),
    );
  });

  it('an electrolytic: ESR = tan δ / (2π·120 Hz·C), leak = U / (0.002·C·U + 3 μA), 1 V the wrong way round at most', () => {
    for (const [key, farads, ratedV] of ELECTROLYTIC) {
      const spec = capacitor(key);
      const leakage = (0.002 * (farads * 1e6) * ratedV + 3) * 1e-6;
      expect(spec, key).toEqual({
        kind: 'capacitor',
        pins: ['plus', 'minus'],
        dielectric: 'electrolytic',
        polar: true,
        farads,
        esrOhms: round4(TAN_DELTA[ratedV]! / (2 * Math.PI * 120 * farads)),
        leakOhms: round4(ratedV / leakage),
        ratedV,
        limits: { voltageV: ratedV, reverseV: 1 },
      });
    }
    // the numbers as README.md writes them
    expect(capacitor('electrolytic-100u-16v')).toMatchObject({ esrOhms: 2.653, leakOhms: 2.581e6 });
    expect(capacitor('electrolytic-470u-16v')).toMatchObject({ esrOhms: 0.5644, leakOhms: 886.9e3 });
    expect(capacitor('electrolytic-100u-6v3')).toMatchObject({ esrOhms: 3.714, leakOhms: 1.479e6 });
    // the leak empties a charged electrolytic in about R·C: 100 s for the larger ones, a few seconds for 1 μF
    close(capacitor('electrolytic-1000u-16v').leakOhms * 1000e-6, 457, 1, '1000 μF');
    close(capacitor('electrolytic-1u-16v').leakOhms * 1e-6, 5.3, 0.1, '1 μF');
  });

  it('at the operating point a capacitor is open but for its leak, and the state keeps its charge', () => {
    // 9 V → 10 kΩ → 100 μF: long after switching on, the leak of 2.581 MΩ holds the capacitor a little below 9 V
    const spec = capacitor('electrolytic-100u-16v');
    const state = createModelState();
    const dc = solveDC(
      net(
        3,
        part('B', 'battery-9v', [1, 0]),
        part('R', 'resistor-10k', [1, 2]),
        part('C', 'electrolytic-100u-16v', [2, 0]),
      ),
      { state },
    );
    expect(dc.ok).toBe(true);
    expect(dc.iterations).toBe(1); // a capacitor is linear
    expect(dc.issues).toEqual([]); // the leak is a path for direct current: nothing is open or in the air
    const current = 9 / (1.5 + 10e3 + spec.esrOhms + spec.leakOhms);
    close(dc.parts.C!.i, current, 1e-15, 'the leak current');
    close(dc.parts.C!.u, current * (spec.esrOhms + spec.leakOhms), 1e-9, 'its voltage');
    close(dc.parts.C!.u, 8.965, 0.001, 'about 8.965 V');
    close(
      state.parts.get('C')!.volts,
      current * spec.leakOhms,
      1e-9,
      'the state: the voltage across the capacitance',
    );
    // a ceramic one across the battery alone: 9 V, a current of 0.9 nA through its 10 GΩ
    const ceramic = solveDC(net(2, part('B', 'battery-9v', [1, 0]), part('C', 'ceramic-100n', [1, 0])));
    expect(ceramic.issues).toEqual([]);
    close(ceramic.parts.C!.i, 9 / (1.5 + 0.03 + 10e9), 1e-20, 'through the insulation');
  });

  it('its load: the rated voltage either way; an electrolytic the wrong way round above 1 V', () => {
    const reading = (u: number) => ({ u, i: 0, p: 0 });
    const small = capacitor('electrolytic-100u-6v3');
    close(loadOf(small, reading(9)), 9 / 6.3, 1e-15, '9 V on 6.3 V');
    close(loadOf(small, reading(-9)), 9, 1e-15, '9 V the wrong way round');
    close(loadOf(small, reading(-0.5)), 0.5, 1e-15, 'half a volt the wrong way round');
    close(loadOf(capacitor('electrolytic-100u-16v'), reading(9)), 9 / 16, 1e-15, '9 V on 16 V: warm');
    close(loadOf(capacitor('ceramic-100n'), reading(-9)), 9 / 50, 1e-15, 'a ceramic either way');
    close(loadOf(capacitor('film-1u'), reading(9)), 9 / 63, 1e-15, 'film');
    expect(conditionOf(9 / 6.3, false)).toBe('hot');
    expect(conditionOf(0, 'bulged')).toBe('bulged');
    expect(HEAT_SECONDS.capacitor).toBe(10);
    expect(BULGED_OHMS).toBe(1e3);
  });
});

describe('an electrolytic over its limits', () => {
  /** Runs the board in steps of 10 ms until the part `id` fails or `limit` seconds pass. */
  function untilFailed(board: Netlist, id: string, limit: number): { seconds: number; transient: Transient } {
    const transient = new Transient(board, { dt: 0.01 });
    expect(transient.start('zero')).toBe(true);
    while (transient.time < limit) {
      expect(transient.step()).toBe(true);
      const condition = transient.status[id]!.condition;
      if (condition === 'bulged' || condition === 'burnt') break;
    }
    return { seconds: transient.time, transient };
  }

  it('100 μF / 6.3 V on the 9 V battery: hot, then bulged after about 12 s, then a leak of 1 kΩ', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('C', 'electrolytic-100u-6v3', [1, 0]));
    const { seconds, transient } = untilFailed(board, 'C', 60);
    // the load 9 / 6.3 = 1.43: it bulges after τ·ln(load / (load − 1)) with τ = 10 s
    const load = 9 / 6.3;
    close(seconds, 10 * Math.log(load / (load - 1)), 0.05, 'the time it took');
    expect(transient.status.C).toEqual({ condition: 'bulged', load: 0 });
    expect(transient.state.parts.get('C')).toMatchObject({ bulged: true, burnt: false });
    expect(transient.step()).toBe(true);
    close(transient.parts.C!.i, 9 / (1.5 + BULGED_OHMS), 1e-9, 'it leaks 9 mA now');
    expect(transient.status.C).toEqual({ condition: 'bulged', load: 0 });
    // and so it stays: the operating point with the same state knows it too
    const dc = solveDC(board, { state: transient.state });
    expect(dc.status.C).toEqual({ condition: 'bulged', load: 0 });
    close(dc.parts.C!.i, 9 / (1.5 + BULGED_OHMS), 1e-12, 'the leak at the operating point');
    expect(dc.issues).toEqual([]);
  });

  it('the wrong way round on 9 V it bulges too, nine times over its limit and so in about a second', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('C', 'electrolytic-100u-6v3', [0, 1]));
    const { seconds, transient } = untilFailed(board, 'C', 60);
    close(seconds, 10 * Math.log(9 / 8), 0.05, 'the time it took');
    expect(transient.status.C!.condition).toBe('bulged');
  });

  it('at the operating point the heat of advanceHeat bulges it as well; a ceramic or film part would burn instead', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('C', 'electrolytic-100u-6v3', [1, 0]));
    const state = createModelState();
    const dc = solveDC(board, { state });
    expect(dc.status.C!.condition).toBe('hot');
    expect(advanceHeat(state, board, dc, 30)).toEqual(['C']);
    expect(state.parts.get('C')).toMatchObject({ bulged: true, burnt: false });
    // within the rating nothing happens, ever
    const calm = net(2, part('B', 'battery-9v', [1, 0]), part('C', 'electrolytic-100u-16v', [1, 0]));
    const quiet = createModelState();
    const fine = solveDC(calm, { state: quiet });
    expect(fine.status.C!.condition).toBe('warm'); // 9 V of 16 V
    for (let k = 0; k < 3600; k++) expect(advanceHeat(quiet, calm, fine, 1)).toEqual([]);
  });
});
