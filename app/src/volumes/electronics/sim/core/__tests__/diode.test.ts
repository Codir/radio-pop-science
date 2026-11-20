/**
 * Diodes and LEDs: the junction of SPICE behind its series resistance, the LEDs fitted to the plan's forward
 * voltages, and what the plan asks of them on the board — an LED of each colour with its resistor, an LED without
 * one, a diode the wrong way round, 1N4148 at 10 mA — against ngspice's samples and against a calculation by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceHeat,
  compile,
  createModelState,
  forwardVoltage,
  GMIN,
  junctionCurrent,
  junctionOf,
  ledLumens,
  PARTS,
  pnjlim,
  solveDC,
  THERMAL_VOLTAGE,
  type DiodeSpec,
  type LedSpec,
  type Netlist,
  type PartInstance,
  type PartReading,
} from '../index';

interface Sample {
  netlist: Netlist;
  parts: Record<string, PartReading>;
}

const files = import.meta.glob<Sample>('../__fixtures__/*.json', { eager: true, import: 'default' });
const sample = (name: string): Sample => files[`../__fixtures__/${name}.json`]!;

const part = (id: string, spec: string, pins: number[]): PartInstance => ({ id, spec, pins });
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

const COLORS = ['red', 'yellow', 'green', 'blue', 'white'] as const;
const diode = (key: string): DiodeSpec => PARTS[key] as DiodeSpec;
const led = (color: string): LedSpec => PARTS[`led-${color}`] as LedSpec;

describe('the junction is the diode of SPICE at 27 °C', () => {
  it('kT/q at 300.15 K with the constants of ngspice, and GMIN across the junction', () => {
    close(THERMAL_VOLTAGE, (1.38064852e-23 / 1.6021766208e-19) * 300.15, 1e-17, 'Vt');
    close(THERMAL_VOLTAGE, 0.025865, 1e-6, 'about 25.865 mV');
    expect(GMIN).toBe(1e-12);
  });

  it('forward: IS·(e^(v/(N·Vt)) − 1) + GMIN·v, and its slope', () => {
    const spec = diode('diode-1n4148');
    const j = junctionOf(spec);
    const vte = spec.n * THERMAL_VOLTAGE;
    const out = { i: 0, g: 0 };
    for (const v of [0, 0.3, 0.6, 0.7, 0.8, -3 * vte]) {
      junctionCurrent(j, v, out);
      const i = spec.is * Math.expm1(v / vte) + GMIN * v;
      const g = (spec.is * Math.exp(v / vte)) / vte + GMIN;
      close(out.i, i, 1e-12 * Math.abs(i) + 1e-30, `i at ${v} V`);
      close(out.g, g, 1e-12 * g, `g at ${v} V`);
    }
  });

  it('reverse: SPICE’s cubic below −3·N·Vt, then breakdown at BV with IBV', () => {
    for (const key of ['diode-1n4148', 'led-red']) {
      const spec = diode(key);
      const j = junctionOf(spec);
      const vte = spec.n * THERMAL_VOLTAGE;
      const out = { i: 0, g: 0 };
      // the cubic: −IS·(1 + (3·N·Vt / (e·v))³) + GMIN·v
      for (const v of [-0.5, -5, -9]) {
        junctionCurrent(j, v, out);
        const cubic = ((3 * vte) / (v * Math.E)) ** 3;
        close(out.i, -spec.is * (1 + cubic) + GMIN * v, 1e-12 * Math.abs(out.i), `${key} at ${v} V`);
      }
      // the two regions meet at −3·N·Vt: IS·(e^−3 − 1) on both sides
      const seam = -3 * vte * (1 + 1e-12);
      junctionCurrent(j, seam, out);
      close(out.i, spec.is * Math.expm1(-3) + GMIN * seam, 1e-9 * spec.is, `${key}: the seam`);
      // breakdown: ngspice moves the knee a little below BV, to where IS·(e^((BV − knee)/(N·Vt)) − 1 + knee/Vt)
      // is IBV within 1e-3 of it; beyond the knee the current is −IS·e^(−(knee + v)/(N·Vt))
      expect(j.knee, key).toBeLessThan(spec.bv);
      expect(j.knee, key).toBeGreaterThan(spec.bv - 2); // 1N4148: 0.47 V below; the red LED, IS 8.66e-18 A: 1.44 V
      const match = spec.is * (Math.expm1((spec.bv - j.knee) / vte) + j.knee / THERMAL_VOLTAGE);
      close(match, spec.ibv, 1e-3 * spec.ibv, `${key}: the knee`);
      for (const beyond of [1, 5, 20]) {
        const v = -j.knee - beyond * vte;
        junctionCurrent(j, v, out);
        close(out.i, -spec.is * Math.exp(beyond) + GMIN * v, 1e-12 * Math.abs(out.i), `${key}: breakdown`);
      }
    }
  });

  it('a step of the junction voltage is limited as by pnjlim of ngspice', () => {
    const vt = 1.752 * THERMAL_VOLTAGE;
    const vcrit = 0.74;
    // a jump far above the knee is cut to a few N·Vt beyond the old voltage
    const cut = pnjlim(5, 0.6, vt, vcrit);
    close(cut, 0.6 + vt * (2 + Math.log((5 - 0.6) / vt - 2)), 1e-15, 'up from 0.6 V');
    expect(cut).toBeLessThan(0.6 + 10 * vt);
    // from below zero the start is the logarithm
    close(pnjlim(5, -1, vt, vcrit), vt * Math.log(5 / vt), 1e-15, 'up from −1 V');
    // small steps and steps below the knee pass
    expect(pnjlim(0.62, 0.6, vt, vcrit)).toBe(0.62);
    expect(pnjlim(0.5, 0, vt, vcrit)).toBe(0.5);
    // downwards: at most to −v − 1 below a forward voltage v, to 2·v − 1 below a reverse one
    close(pnjlim(-9, 0.7, vt, vcrit), -1.7, 1e-15, 'down from 0.7 V');
    close(pnjlim(-9, -1.7, vt, vcrit), -4.4, 1e-15, 'down from −1.7 V');
    expect(pnjlim(-3, -2, vt, vcrit)).toBe(-3);
  });
});

describe('the catalog: the published diodes and the LEDs fitted to the plan', () => {
  it('every LED has its forward voltage at 20 mA in the window of the plan', () => {
    const windows = {
      red: [1.9, 2.0],
      yellow: [2.0, 2.1],
      green: [2.1, 2.2],
      blue: [3.0, 3.2],
      white: [3.0, 3.2],
    };
    for (const color of COLORS) {
      const volts = forwardVoltage(led(color), 0.02);
      const [low, high] = windows[color];
      expect(volts, color).toBeGreaterThanOrEqual(low!);
      expect(volts, color).toBeLessThanOrEqual(high!);
      // by hand: the junction's N·Vt·ln(1 + I/IS) and the drop on RS (GMIN takes 2 pA of 20 mA)
      const spec = led(color);
      close(volts, spec.n * THERMAL_VOLTAGE * Math.log1p(0.02 / spec.is) + 0.02 * spec.rs, 1e-9, color);
    }
    // the fit puts each colour in the middle of its window
    for (const [color, middle] of [
      ['red', 1.95],
      ['yellow', 2.05],
      ['green', 2.15],
      ['blue', 3.1],
      ['white', 3.1],
    ] as const)
      close(forwardVoltage(led(color), 0.02), middle, 1e-3, `${color}: the middle`);
  });

  it('1N4148 at 10 mA: about 0.69 V; 1N4007 at 1 A: under the 1.1 V of its datasheet', () => {
    close(forwardVoltage(diode('diode-1n4148'), 0.01), 0.694, 1e-3, '1N4148');
    const big = forwardVoltage(diode('diode-1n4007'), 1);
    expect(big).toBeGreaterThan(0.8);
    expect(big).toBeLessThan(1.1);
  });

  it('light is proportional to the forward current, with the colour’s own yield', () => {
    for (const color of COLORS) {
      const spec = led(color);
      close(ledLumens(spec, 0.02), 0.02 * spec.lumensPerAmp, 1e-15, color);
      close(ledLumens(spec, 0.01), ledLumens(spec, 0.02) / 2, 1e-15, `${color}: half the current`);
      expect(ledLumens(spec, -1e-9)).toBe(0); // the wrong way round it does not shine
    }
    // the classic GaAsP and GaP chips are dim beside InGaN at the same current
    expect(led('blue').lumensPerAmp).toBeGreaterThan(10 * led('red').lumensPerAmp);
    expect(led('white').lumensPerAmp).toBeGreaterThan(10 * led('green').lumensPerAmp);
  });
});

describe('diodes and LEDs on the board', () => {
  it('an LED of each colour with 330 Ω from 9 V: the current of ngspice within ± 3 %', () => {
    // ngspice's currents (the samples led-<colour>.json, loop B1 — the 9 V battery, 330 Ω, the LED)
    const ngspice = {
      red: 21.2353e-3,
      yellow: 20.9408e-3,
      green: 20.6468e-3,
      blue: 17.8922e-3,
      white: 17.8922e-3,
    };
    for (const color of COLORS) {
      const reference = sample(`led-${color}`);
      close(reference.parts.D1!.i, ngspice[color], 1e-7, `${color}: the sample`);
      const dc = solveDC(structuredClone(reference.netlist));
      expect(dc.ok, color).toBe(true);
      close(dc.parts.D1!.i, reference.parts.D1!.i, 0.03 * reference.parts.D1!.i, color);
      // and much closer than that: the same equations on both sides
      close(dc.parts.D1!.i, reference.parts.D1!.i, 1e-6 * reference.parts.D1!.i, `${color}, closely`);
    }
    close(sample('led-red').parts.D1!.i, 0.021, 0.0005, 'red: about 21 mA');
  });

  it('an LED without a resistor from 9 V: far over 30 mA, hot, burnt in time, then no current', () => {
    for (const color of COLORS) {
      const board = net(2, part('B', 'battery-9v', [1, 0]), part('D', `led-${color}`, [1, 0]));
      const state = createModelState();
      const dc = solveDC(board, { state });
      expect(dc.ok, color).toBe(true);
      expect(dc.iterations, color).toBeLessThanOrEqual(50);
      expect(Number.isFinite(dc.parts.D!.i), color).toBe(true);
      expect(dc.parts.D!.i, color).toBeGreaterThan(10 * 0.03);
      expect(dc.status.D, color).toEqual({ condition: 'hot', load: dc.parts.D!.i / 0.03 });
      // only the battery's own 1.5 Ω (and the LED's RS inside its voltage) hold it back
      const spec = led(color);
      close(dc.parts.D!.i, (9 - dc.parts.D!.u) / 1.5, 1e-12, `${color}: the battery's drop`);
      let seconds = 0;
      let burnt: string[] = [];
      while (burnt.length === 0 && seconds < 10) {
        burnt = advanceHeat(state, board, dc, 0.001);
        seconds += 0.001;
      }
      expect(burnt, color).toEqual(['D']);
      expect(seconds, color).toBeLessThan(1); // a flash, not a glow
      const after = solveDC(board, { state });
      expect(after.parts.D, color).toEqual({ u: after.v[1], i: 0, p: 0 });
      expect(after.status.D, color).toEqual({ condition: 'burnt', load: 0 });
      close(after.v[1], 9, 1e-9, `${color}: the battery without load`);
      expect(after.issues, color).toEqual([{ kind: 'open', part: 'B' }]);
      expect(spec.limits.currentA).toBe(0.03);
    }
  });

  it('a diode the wrong way round lets less than 1 μA through', () => {
    const reference = sample('diode-reverse');
    const dc = solveDC(structuredClone(reference.netlist));
    expect(dc.ok).toBe(true);
    for (const id of ['D1', 'D2', 'D3']) {
      expect(dc.parts[id]!.i, id).toBeLessThan(0);
      expect(Math.abs(dc.parts[id]!.i), id).toBeLessThan(1e-6);
      close(dc.parts[id]!.u, -9, 1e-4, `${id}: the whole battery across it`);
      expect(dc.status[id]!.condition, id).toBe('ok');
    }
    // straight across the battery, with no resistor: still nanoamperes
    const bare = solveDC(net(2, part('B', 'battery-9v', [1, 0]), part('D', 'diode-1n4148', [0, 1])));
    expect(Math.abs(bare.parts.D!.i)).toBeLessThan(1e-6);
    close(bare.parts.D!.i, -(2.52e-9 + GMIN * 9), 1e-12, 'IS and GMIN');
  });

  it('1N4148 at 10 mA: the forward voltage of ngspice within ± 2 %', () => {
    // the sample diode-forward: 5 V through 430 Ω into 1N4148 (D2) gives 10.01 mA
    const reference = sample('diode-forward');
    close(reference.parts.D2!.i, 10e-3, 0.02e-3, 'the sample is at 10 mA');
    const dc = solveDC(structuredClone(reference.netlist));
    close(dc.parts.D2!.u, reference.parts.D2!.u, 0.02 * reference.parts.D2!.u, 'in the circuit');
    close(
      forwardVoltage(diode('diode-1n4148'), 10e-3),
      reference.parts.D2!.u,
      0.02 * reference.parts.D2!.u,
      'alone',
    );
    close(reference.parts.D2!.u, 0.6943, 1e-4, 'ngspice: 0.6943 V');
  });
});

describe('the worked example of sim/core/README.md, as written there', () => {
  it('an LED with its resistor, then a wire instead of the resistor', () => {
    const state = createModelState();
    const board: Netlist = {
      nodes: 3,
      parts: [
        { id: 'B1', spec: 'battery-9v', pins: [1, 0] },
        { id: 'R1', spec: 'resistor-330', pins: [1, 2] },
        { id: 'D1', spec: 'led-red', pins: [2, 0] },
      ],
    };
    let dc = solveDC(board, { state });
    const d1 = dc.parts.D1!;
    expect([d1.u.toFixed(3), d1.i.toFixed(5), d1.p.toFixed(5)]).toEqual(['1.960', '0.02124', '0.04163']);
    expect(dc.status.D1!.condition).toBe('warm');
    expect(dc.status.D1!.load.toFixed(3)).toBe('0.708');
    expect(ledLumens(led('red'), d1.i).toFixed(5)).toBe('0.01826');
    board.parts[1] = { id: 'J1', spec: 'jumper', pins: [1, 2] };
    dc = solveDC(board, { state });
    expect(dc.status.D1!.condition).toBe('hot');
    expect(dc.status.D1!.load.toFixed(1)).toBe('31.0');
    expect(advanceHeat(state, board, dc, 0.1)).toEqual(['D1']);
    dc = solveDC(board, { state });
    expect(dc.parts.D1!.i).toBe(0);
    expect(dc.status.D1).toEqual({ condition: 'burnt', load: 0 });
    expect(dc.issues).toEqual([{ kind: 'open', part: 'B1' }]);
  });
});

describe('Newton’s iterations', () => {
  it('converge from a cold start and from the last solution', () => {
    const board = net(
      3,
      part('B', 'battery-9v', [1, 0]),
      part('R', 'resistor-330', [1, 2]),
      part('D', 'led-red', [2, 0]),
    );
    const cold = solveDC(board);
    expect(cold.ok).toBe(true);
    expect(cold.sourceSteps).toBe(0);
    expect(cold.iterations).toBeGreaterThan(2);
    expect(cold.iterations).toBeLessThanOrEqual(50);
    // a stand compiles once and keeps a state: the next solve starts from the last one and settles at once
    const circuit = compile(board);
    const state = createModelState();
    solveDC(circuit, { state });
    const warm = solveDC(circuit, { state });
    expect(warm.iterations).toBeLessThanOrEqual(3);
    close(warm.parts.D!.i, cold.parts.D!.i, 1e-12, 'the same answer');
    // a fresh netlist with the state of the last solve: the junctions start at their knee as from cold
    const fresh = solveDC(structuredClone(board), { state });
    expect(fresh.iterations).toBeLessThanOrEqual(cold.iterations);
    close(fresh.parts.D!.i, cold.parts.D!.i, 1e-12, 'the same answer again');
  });

  it('when Newton runs out of iterations, the sources are stepped up from zero', () => {
    // an LED straight on the battery, with one iteration fewer than it needs at once: each source step, starting
    // from the last one's solution, settles within that
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('D', 'led-blue', [1, 0]));
    const plain = solveDC(board);
    expect(plain.sourceSteps).toBe(0);
    const stepped = solveDC(board, { maxIterations: plain.iterations - 1 });
    expect(stepped.ok).toBe(true);
    expect(stepped.sourceSteps).toBeGreaterThan(0);
    expect(stepped.iterations).toBeGreaterThan(plain.iterations);
    close(stepped.parts.D!.i, plain.parts.D!.i, 1e-9 * plain.parts.D!.i, 'the same answer');
  });

  it('odd boards settle too: a leg in the air, LEDs back to back, reversed diodes in series', () => {
    const boards: [string, Netlist][] = [
      ['a leg in the air', net(3, part('B', 'battery-9v', [1, 0]), part('D', 'led-red', [1, 2]))],
      ['an LED in the air', net(4, part('B', 'battery-9v', [1, 0]), part('D', 'led-red', [2, 3]))],
      ['both legs in one row', net(2, part('B', 'battery-9v', [1, 0]), part('D', 'led-red', [1, 1]))],
      [
        'back to back',
        net(
          3,
          part('B', 'battery-9v', [1, 0]),
          part('D1', 'led-red', [1, 2]),
          part('D2', 'led-blue', [0, 2]),
        ),
      ],
      [
        // nothing but GMIN holds the nodes between them: the rounding of the solve moves them by millivolts
        'reversed in series',
        net(
          4,
          part('B', 'battery-9v', [1, 0]),
          part('D1', 'diode-1n4148', [2, 1]),
          part('D2', 'diode-1n4007', [3, 2]),
          part('D3', 'diode-1n4148', [0, 3]),
        ),
      ],
    ];
    for (const [name, board] of boards) {
      const dc = solveDC(board);
      expect(dc.ok, name).toBe(true);
      expect(dc.sourceSteps, name).toBe(0);
      expect(dc.iterations, name).toBeLessThanOrEqual(50);
      expect([...dc.v].every(Number.isFinite), name).toBe(true);
      for (const reading of Object.values(dc.parts)) expect(Math.abs(reading.i), name).toBeLessThan(1e-6);
    }
    // the reversed chain: the current of the smaller IS (1N4148, 2.52 nA), the voltages add up to the battery's 9 V
    const chain = solveDC(boards[4]![1]);
    close(chain.parts.D1!.i, -2.524e-9, 0.002e-9, 'the chain');
    close(chain.parts.D1!.u + chain.parts.D2!.u + chain.parts.D3!.u, -chain.v[1]!, 1e-9, 'the voltages');
    close(chain.parts.D1!.u, -4.5, 0.01, 'half of it');
  });

  it('a circuit no iteration settles is ok: false, with zeros and the reason', () => {
    // one iteration cannot tell that Newton has settled, with or without stepping
    const dc = solveDC(net(2, part('B', 'battery-9v', [1, 0]), part('D', 'led-red', [1, 0])), {
      maxIterations: 1,
    });
    expect(dc.ok).toBe(false);
    expect(dc.reason).toBe('no-convergence');
    expect([...dc.v]).toEqual([0, 0]);
    expect(dc.parts.D).toEqual({ u: 0, i: 0, p: 0 });
    expect(dc.status.D).toEqual({ condition: 'ok', load: 0 });
  });
});
