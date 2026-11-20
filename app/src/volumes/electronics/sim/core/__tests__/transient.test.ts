/**
 * The model in time: a fixed step, the trapezoid, and backward Euler at the start and after a change on the board.
 * Against ngspice's samples (`tran` and `ac` of tools/ref-models/electronics/spice.py): an RC circuit charging and
 * discharging, a capacitor emptying through an LED, a low-pass and a high-pass filter on a sine, a half-wave
 * rectifier. Against the plan's numbers and a calculation by hand: R·C, the step's convergence, the inrush of a cold
 * lamp, parts that burn in time. And what a stand does with it: start, step, run blocks into its own arrays, turn a
 * knob, change the board, take a step in shorter steps of integration.
 */
import { describe, expect, it } from 'vitest';
import {
  burnSeconds,
  createModelState,
  EULER_STEPS,
  filamentCapacity,
  memoryOf,
  PARTS,
  ROOM_KELVIN,
  solveDC,
  Transient,
  type CapacitorSpec,
  type LampSpec,
  type Netlist,
  type PartInstance,
  type Probe,
} from '../index';

interface TranSample {
  analysis: 'tran';
  netlist: Netlist;
  start: 'zero' | 'state';
  charges: Record<string, number>;
  times: number[];
  v: Record<string, number[]>;
  i: Record<string, number[]>;
  window: number[];
  mean: Record<string, number>;
  swing: Record<string, number>;
}

interface AcSample {
  analysis: 'ac';
  netlist: Netlist;
  source: string;
  frequencies: number[];
  gain: Record<string, number[]>;
}

const files = import.meta.glob('../__fixtures__/*.json', { eager: true, import: 'default' });
const sample = <T>(name: string): T => files[`../__fixtures__/${name}.json`] as T;

const part = (id: string, spec: string, pins: number[], setting?: number): PartInstance =>
  setting === undefined ? { id, spec, pins } : { id, spec, pins, setting };
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

/** |model − ngspice| ≤ share · |ngspice| at every moment. */
function follows(model: readonly number[], spice: readonly number[], share: number, what: string): void {
  expect(model).toHaveLength(spice.length);
  spice.forEach((want, k) => close(model[k], want, share * Math.abs(want), `${what} [${k}]`));
}

const AUDIO = 1 / 48000;

/** The transient of a sample with the step `dt`: the voltages of its nodes and the currents of its parts at its
 * moments (each a whole number of steps), read straight from the transient after each step. */
function follow(
  s: TranSample,
  dt: number,
): { v: Record<string, number[]>; i: Record<string, number[]>; t: Transient } {
  const state = createModelState();
  for (const [id, volts] of Object.entries(s.charges)) memoryOf(state, id).volts = volts;
  const t = new Transient(structuredClone(s.netlist), { dt, state });
  expect(t.start(s.start)).toBe(true);
  const marks = s.times.map((time) => Math.round(time / dt));
  marks.forEach((mark, k) => close(mark * dt, s.times[k]!, 1e-9, 'a moment is a whole number of steps'));
  const v: Record<string, number[]> = Object.fromEntries(Object.keys(s.v).map((node) => [node, []]));
  const i: Record<string, number[]> = Object.fromEntries(Object.keys(s.i).map((id) => [id, []]));
  for (let step = 1, next = 0; next < marks.length; step++) {
    expect(t.step()).toBe(true);
    if (step !== marks[next]) continue;
    for (const node of Object.keys(v)) v[node]!.push(t.v[Number(node)]!);
    for (const id of Object.keys(i)) i[id]!.push(t.parts[id]!.i);
    next++;
  }
  return { v, i, t };
}

/** The amplitude of a sine of `hertz` in `samples` (taken every `dt`, a whole number of periods): the least-squares
 * fit of a·sin + b·cos + c. */
function amplitude(samples: Float32Array | Float64Array, hertz: number, dt: number, first: number): number {
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const r = [0, 0, 0];
  for (let k = 0; k < samples.length; k++) {
    const phase = 2 * Math.PI * hertz * (first + k) * dt;
    const basis = [Math.sin(phase), Math.cos(phase), 1];
    for (let row = 0; row < 3; row++) {
      r[row]! += basis[row]! * samples[k]!;
      for (let col = 0; col < 3; col++) m[row * 3 + col]! += basis[row]! * basis[col]!;
    }
  }
  // Cramer's rule for the 3 × 3 normal equations
  const det = (a: number[]): number =>
    a[0]! * (a[4]! * a[8]! - a[5]! * a[7]!) -
    a[1]! * (a[3]! * a[8]! - a[5]! * a[6]!) +
    a[2]! * (a[3]! * a[7]! - a[4]! * a[6]!);
  const whole = det(m);
  const with0 = det([r[0]!, m[1]!, m[2]!, r[1]!, m[4]!, m[5]!, r[2]!, m[7]!, m[8]!]);
  const with1 = det([m[0]!, r[0]!, m[2]!, m[3]!, r[1]!, m[5]!, m[6]!, r[2]!, m[8]!]);
  return Math.hypot(with0 / whole, with1 / whole);
}

describe('capacitors in time against ngspice', () => {
  it('9 V through 10 kΩ into 100 μF: 63.2 % after R·C = 1 s, and the curve of ngspice within 1 % at 20 moments', () => {
    const s = sample<TranSample>('rc-charge');
    const { v, i } = follow(s, 1e-3);
    follows(v['2']!, s.v['2']!, 0.01, 'the capacitor’s voltage');
    follows(i.C1!, s.i.C1!, 0.01, 'its current');
    expect(s.times[3]).toBe(1);
    close(v['2']![3]! / 9, 0.632, 0.005, 'after one R·C: 63.2 % ± 0.5 % of 9 V');
  });

  it('100 μF charged to 9 V, through 10 kΩ: 36.8 % after 1 s, and the curve of ngspice within 1 %', () => {
    const s = sample<TranSample>('rc-discharge');
    expect(s.start).toBe('state');
    const { v, i } = follow(s, 1e-3);
    follows(v['1']!, s.v['1']!, 0.01, 'the voltage');
    follows(i.C1!, s.i.C1!, 0.01, 'the current');
    close(v['1']![3]! / 9, 0.368, 0.005, 'after one R·C: 36.8 % ± 0.5 %');
  });

  it('470 μF charged to 9 V empties through 330 Ω and the red LED: its current within 2 % of ngspice', () => {
    const s = sample<TranSample>('led-discharge');
    const { v, i } = follow(s, 1e-4);
    follows(i.D1!, s.i.D1!, 0.02, 'the LED’s current');
    follows(i.C1!, s.i.C1!, 0.02, 'the capacitor’s current');
    follows(v['1']!, s.v['1']!, 0.02, 'the capacitor’s voltage');
    follows(v['2']!, s.v['2']!, 0.02, 'the LED’s voltage');
    // the LED fades from 18 mA to 1 mA in half a second
    expect(i.D1![0]).toBeGreaterThan(0.015);
    expect(i.D1!.at(-1)).toBeLessThan(0.002);
  });

  it('a half-wave rectifier, 1N4007 and 470 μF on 1 kΩ from a sine of 6 V at 50 Hz: mean and ripple within 3 %', () => {
    const s = sample<TranSample>('rectifier');
    const t = new Transient(structuredClone(s.netlist), { dt: AUDIO });
    expect(t.start(s.start)).toBe(true);
    // the first second, every step: the output at ngspice's moments, and its last five periods (0.9 … 1 s)
    const output = new Float32Array(48000);
    expect(t.run(output.length, [{ node: 2, out: output }])).toBe(output.length);
    const at = s.times.map((time) => output[Math.round(time / AUDIO) - 1]!);
    follows(at, s.v['2']!, 0.03, 'the output');
    const window = output.subarray(43200);
    expect(window).toHaveLength(4800);
    const mean = window.reduce((sum, x) => sum + x, 0) / window.length;
    const swing = Math.max(...window) - Math.min(...window);
    close(mean, s.mean['2']!, 0.03 * s.mean['2']!, 'the mean');
    close(swing, s.swing['2']!, 0.03 * s.swing['2']!, 'the ripple');
    close(s.mean['2']!, 5.174, 0.001, 'ngspice: 5.174 V');
    close(s.swing['2']!, 0.2091, 0.0001, 'ngspice: 0.209 V');
  });

  /** The gains of the low-pass (node 2) and the high-pass (node 3) of `filters` for a sine of `hertz`, sampled `rate`
   * times a second in `substeps` steps of integration each: 50 ms to settle (500 times R·C), then 20 ms of whole
   * periods fitted. */
  function gains(s: AcSample, hertz: number, rate: number, substeps = 1): [number, number] {
    const board = structuredClone(s.netlist);
    board.parts.find((p) => p.id === s.source)!.setting = hertz;
    const t = new Transient(board, { dt: 1 / rate, substeps });
    expect(t.start('zero')).toBe(true);
    const settle = rate / 20;
    const low = new Float32Array(rate / 50);
    const high = new Float32Array(rate / 50);
    expect(t.run(settle)).toBe(settle);
    expect(
      t.run(low.length, [
        { node: 2, out: low },
        { node: 3, out: high },
      ]),
    ).toBe(low.length);
    return [
      amplitude(low, hertz, 1 / rate, settle + 1) / 6,
      amplitude(high, hertz, 1 / rate, settle + 1) / 6,
    ];
  }

  it('a low-pass and a high-pass filter of 1 kΩ and 100 nF sampled at 1/48000 s in four steps of the trapezoid: ngspice’s .ac within 1 % at 100 Hz, 1 kHz and 10 kHz', () => {
    // the plan's tolerance at every one of the six points; the worst is the low-pass at 10 kHz, 0.87 % low
    const s = sample<AcSample>('filters');
    expect(s.frequencies.slice(0, 3)).toEqual([100, 1000, 10000]);
    for (const [k, hertz] of [100, 1000, 10000].entries()) {
      const [low, high] = gains(s, hertz, 48000, 4);
      close(low, s.gain['2']![k]!, 0.01 * s.gain['2']![k]!, `low-pass at ${hertz} Hz`);
      close(high, s.gain['3']![k]!, 0.01 * s.gain['3']![k]!, `high-pass at ${hertz} Hz`);
    }
  });

  it('in one step of the trapezoid a sample, the filters are ngspice’s .ac where the trapezoid answers — and the low-pass at 10 kHz is 14.4 % low', () => {
    // A trapezoid with the step h answers a sine of f exactly as the circuit answers (1/(π·h))·tan(π·f·h): at 48 kHz,
    // 100.0014 Hz, 1001.43 Hz and 11 723.9 Hz for 100 Hz, 1 kHz and 10 kHz. There the model is ngspice to 1e-5
    const s = sample<AcSample>('filters');
    for (const [k, hertz] of [100, 1000, 10000].entries()) {
      const warped = s.frequencies[k + 3]!;
      close(warped, (48000 / Math.PI) * Math.tan((Math.PI * hertz) / 48000), 1e-5, `where ${hertz} Hz goes`);
      const [low, high] = gains(s, hertz, 48000);
      close(
        low,
        s.gain['2']![k + 3]!,
        1e-5 * s.gain['2']![k + 3]!,
        `low-pass at ${hertz} Hz, ngspice at ${warped} Hz`,
      );
      close(
        high,
        s.gain['3']![k + 3]!,
        1e-5 * s.gain['3']![k + 3]!,
        `high-pass at ${hertz} Hz, ngspice at ${warped}`,
      );
      // at the frequency itself, within 1 % where the response is gentle; the low-pass at 10 kHz, far above its
      // cut-off, falls steeply, and the stretch of the frequency shows: −1.35 dB, which `substeps` takes away (above)
      close(high, s.gain['3']![k]!, 0.01 * s.gain['3']![k]!, `high-pass at ${hertz} Hz`);
      if (hertz < 10000) close(low, s.gain['2']![k]!, 0.01 * s.gain['2']![k]!, `low-pass at ${hertz} Hz`);
      else
        close(
          low / s.gain['2']![k]!,
          0.856,
          0.0005,
          'the low-pass at 10 kHz: the trapezoid’s warping at 48 kHz',
        );
    }
  });
});

describe('the step', () => {
  /** The RC charge of rc-charge exactly: the battery's 1.5 Ω, 10 kΩ and the ESR in front of the capacitance, the leak
   * across it; the voltage on the capacitor's pins at `t`. */
  function exactCharge(t: number): number {
    const c = PARTS['electrolytic-100u-16v'] as CapacitorSpec;
    const loop = 1.5 + 10e3 + c.esrOhms;
    const final = (9 * c.leakOhms) / (c.leakOhms + loop);
    const tau = (c.farads * loop * c.leakOhms) / (loop + c.leakOhms);
    const inside = -final * Math.expm1(-t / tau);
    return inside + (c.esrOhms * (9 - inside)) / loop;
  }

  it('halving the step changes the RC curve by less than 0.1 %', () => {
    const s = sample<TranSample>('rc-charge');
    const coarse = follow(s, 1e-3).v['2']!;
    const fine = follow(s, 0.5e-3).v['2']!;
    follows(coarse, fine, 0.001, 'dt against dt / 2');
  });

  it('the trapezoid is of the second order: half the step, a quarter of the error', () => {
    const s = sample<TranSample>('rc-charge');
    const error = (dt: number): number => {
      const { v } = follow(s, dt);
      return Math.max(...s.times.map((t, k) => Math.abs(v['2']![k]! - exactCharge(t))));
    };
    const ratio = error(0.025) / error(0.0125);
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
    // eighty steps per R·C: within 1.5 mV, nearly all of it from the two steps of Euler at the start, which leave
    // 9 V·(h / R·C)² / 2 = 0.7 mV each and fade with the charge
    expect(error(0.0125)).toBeLessThan(1.5e-3);
  });

  it('after switching a stiff circuit on, backward Euler leaves no ringing of the trapezoid', () => {
    // 1 nF behind 1 kΩ: R·C = 1 μs against a step of 20.8 μs. The trapezoid alone swings the remainder of a jump from
    // one side of 9 V to the other, shrinking it by less than a fifth a step; one step of backward Euler leaves 4.6 %
    // of the jump to swing, two leave 0.2 % (EULER_STEPS)
    expect(EULER_STEPS).toBe(2);
    const board = net(
      4,
      part('B', 'ideal-9v', [1, 0]),
      part('S', 'switch', [1, 2], 0),
      part('R', 'resistor-1k', [2, 3]),
      part('C', 'ceramic-1n', [3, 0]),
    );
    const t = new Transient(board, { dt: AUDIO });
    expect(t.start('dc')).toBe(true);
    close(t.v[3], 0, 1e-12, 'empty before');
    t.set('S', 1);
    const trace: number[] = [];
    for (let k = 0; k < 40; k++) {
      expect(t.step()).toBe(true);
      trace.push(t.v[3]!);
    }
    // it rises to 9 V (4.6 % short after the first step, 0.21 % after the second) and stays there: what swings about
    // 9 V afterwards never passes 9 V by more than 0.2 % of the jump, and dies out (one step of Euler would leave 3.8 %)
    expect(trace[0]).toBeLessThan(trace[1]!);
    close(trace[0], 9 * (1 - 1 / 21.8), 0.001, 'one step of Euler: 1 / (1 + h / R·C) of the jump left');
    for (const [k, x] of trace.entries()) if (k >= 1) close(x, 9, 0.0025 * 9, `step ${k + 1}`);
    expect(Math.max(...trace)).toBeLessThanOrEqual(9 * 1.002);
    close(trace.at(-1), 9, 1e-4 * 9, 'forty steps on');
    // and the same when the board opens again
    t.set('S', 0);
    const down: number[] = [];
    for (let k = 0; k < 10; k++) {
      expect(t.step()).toBe(true);
      down.push(t.v[3]!);
    }
    for (const x of down) expect(Math.abs(x - 9)).toBeLessThan(1e-3); // the charge stays: nothing to empty it but the leak
  });
});

describe('the lamp and the limits in time', () => {
  it('a cold lamp switched on takes more than five times its steady current, and settles in 3–5 time constants', () => {
    const lamp = PARTS['lamp-6v'] as LampSpec;
    // the filament's heat capacity: τ·4·K·T_hot³, K = 0.6 W / (T_hot⁴ − T0⁴), T_hot = T0·(60 / 5.5)^(1/1.21)
    const hot = ROOM_KELVIN * (60 / 5.5) ** (1 / 1.21);
    close(filamentCapacity(lamp), (0.05 * 4 * 0.6 * hot ** 3) / (hot ** 4 - ROOM_KELVIN ** 4), 1e-18, 'Cth');
    close(filamentCapacity(lamp), 5.55e-5, 0.01e-5, 'about 5.55e-5 J/K');
    const board = net(
      3,
      part('B', 'battery-4aa', [1, 0]),
      part('S', 'switch', [1, 2], 0),
      part('L', 'lamp-6v', [2, 0]),
    );
    const dt = 1e-5;
    const t = new Transient(board, { dt });
    expect(t.start('dc')).toBe(true);
    expect(t.state.parts.get('L')!.kelvin).toBe(ROOM_KELVIN); // dark: the switch is open
    t.set('S', 1);
    const current = new Float32Array(50000); // half a second, ten time constants
    expect(t.run(current.length, [{ part: 'L', out: current }])).toBe(current.length);
    const steady = solveDC(structuredClone(board)).parts.L!.i; // the switch is closed in the board now
    close(t.parts.L!.i, steady, 1e-4 * steady, 'it ends at the steady current');
    const peak = Math.max(...current);
    expect(peak).toBeGreaterThan(5 * steady);
    close(peak, 6 / (0.6 + lamp.coldOhms), 0.02, 'the peak: the cold filament across the battery');
    // settled: within 2 % of the steady current from then on
    let last = 0;
    current.forEach((i, k) => {
      if (Math.abs(i - steady) > 0.02 * steady) last = k;
    });
    const settled = (last + 1) * dt;
    expect(settled).toBeGreaterThanOrEqual(3 * lamp.tauS);
    expect(settled).toBeLessThanOrEqual(5 * lamp.tauS);
    expect(t.memory('L')!.kelvin).toBeGreaterThan(2000);
    expect(t.memory('nobody')).toBeUndefined();
  });

  it('heat gathers in time: 1 W in a 0.25 W resistor burns it when the formula of the limits says', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('R', 'resistor-75', [1, 0]));
    const dt = 1e-3;
    const t = new Transient(board, { dt });
    expect(t.start('dc')).toBe(true);
    const load = t.parts.R!.p / 0.25;
    expect(t.status.R!.condition).toBe('hot');
    while (t.status.R!.condition !== 'burnt' && t.time < 60) expect(t.step()).toBe(true);
    close(t.time, burnSeconds(load, 10), dt, 'the time it took');
    expect(t.time).toBeGreaterThan(1);
    expect(t.time).toBeLessThan(10);
    expect(t.step()).toBe(true);
    expect(t.parts.R).toEqual({ u: t.v[1], i: 0, p: 0 });
    expect(t.issues).toEqual([{ kind: 'open', part: 'B' }]);
    expect(t.state.parts.get('R')!.burnt).toBe(true);
  });

  it('an LED without a resistor flashes and burns within a second, and then carries nothing', () => {
    const board = net(2, part('B', 'battery-9v', [1, 0]), part('D', 'led-red', [1, 0]));
    const t = new Transient(board, { dt: 1e-3 });
    expect(t.start('zero')).toBe(true);
    let peak = 0;
    while (t.status.D!.condition !== 'burnt' && t.time < 5) {
      expect(t.step()).toBe(true);
      peak = Math.max(peak, t.parts.D!.i);
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(t.time).toBeLessThan(1);
    expect(t.step()).toBe(true);
    expect(t.parts.D!.i).toBe(0);
  });
});

describe('the worked example of sim/core/README.md, as written there', () => {
  it('the battery through a switch and 10 kΩ into 100 μF, at the audio rate', () => {
    const board: Netlist = {
      nodes: 4,
      parts: [
        { id: 'B1', spec: 'battery-9v', pins: [1, 0] },
        { id: 'S1', spec: 'switch', pins: [1, 2], setting: 0 },
        { id: 'R1', spec: 'resistor-10k', pins: [2, 3] },
        { id: 'C1', spec: 'electrolytic-100u-16v', pins: [3, 0] },
      ],
    };
    const state = createModelState();
    const t = new Transient(board, { dt: 1 / 48000, state });
    expect(t.start('dc')).toBe(true);
    expect(t.issues).toEqual([{ kind: 'open', part: 'B1' }]);
    t.set('S1', 1);
    const trace = new Float32Array(2048);
    expect(t.run(2048, [{ node: 3, out: trace }])).toBe(2048);
    expect(t.time.toFixed(5)).toBe('0.04267');
    const c1 = t.parts.C1!;
    expect([c1.u.toFixed(3), c1.i.toFixed(6), c1.p.toFixed(6)]).toEqual(['0.378', '0.000862', '0.000326']);
    expect((c1.u - state.parts.get('C1')!.volts!).toFixed(4)).toBe('0.0023'); // the ESR's drop
    expect(t.status.R1!.condition).toBe('ok');
    expect(t.status.R1!.load.toFixed(4)).toBe('0.0297');
    expect(state.parts.get('C1')!.volts!.toFixed(4)).toBe('0.3757');
    expect(trace[2047]).toBe(Math.fround(c1.u));
    expect(t.issues).toEqual([]);
  });
});

describe('what a stand does with the transient', () => {
  const rc = (): Netlist =>
    net(
      3,
      part('B', 'battery-9v', [1, 0]),
      part('R', 'resistor-10k', [1, 2]),
      part('C', 'electrolytic-100u-16v', [2, 0]),
    );

  it('starts at the operating point, from empty, or from the charges in the state', () => {
    const atDc = new Transient(rc(), { dt: 1e-3 });
    expect(atDc.start('dc')).toBe(true);
    close(atDc.v[2], solveDC(rc()).v[2]!, 1e-12, 'dc: charged');
    expect(atDc.time).toBe(0);
    const empty = new Transient(rc(), { dt: 1e-3 });
    expect(empty.start('zero')).toBe(true);
    expect([...empty.v]).toEqual([0, 0, 0]);
    const state = createModelState();
    memoryOf(state, 'C').volts = 4;
    const held = new Transient(rc(), { dt: 1e-3, state });
    expect(held.start('state')).toBe(true);
    expect(held.step()).toBe(true);
    close(held.v[2], 4, 0.01, 'state: it starts at 4 V');
    close(
      held.state.parts.get('C')!.volts,
      4 + (5 * 1e-3) / 1,
      1e-3,
      'and charges on: 0.5 mA for a millisecond',
    );
    close(held.time, 1e-3, 1e-15, 'one step');
  });

  it('run() writes one sample a step into the arrays it is given, the same numbers step() reads', () => {
    const one = new Transient(rc(), { dt: 1e-3 });
    const two = new Transient(rc(), { dt: 1e-3 });
    one.start('zero');
    two.start('zero');
    const volts = new Float32Array(100);
    const amps = new Float32Array(100);
    const probes: Probe[] = [
      { node: 2, out: volts },
      { part: 'C', out: amps },
    ];
    expect(one.run(50, probes)).toBe(50);
    for (let k = 0; k < 50; k++) {
      two.step();
      expect(volts[k]).toBe(Math.fround(two.v[2]!));
      expect(amps[k]).toBe(Math.fround(two.parts.C!.i));
    }
    expect(volts[50]).toBe(0); // nothing past the steps asked for
    expect(probes[0]!.out).toBe(volts); // its own arrays, filled in place
    // a block after a block continues the same curve
    const next = new Float32Array(50);
    expect(one.run(50, [{ node: 2, out: next }])).toBe(50);
    two.run(50);
    expect(next[49]).toBe(Math.fround(two.v[2]!));
    close(one.time, 0.1, 1e-12, 'a hundred steps');
    // what it cannot do is a RangeError before any step: an array too short, a node or a part the board has not
    expect(() => one.run(10, [{ node: 2, out: new Float32Array(5) }])).toThrow(RangeError);
    expect(() => one.run(1, [{ node: 7, out: volts }])).toThrow(RangeError);
    expect(() => one.run(1, [{ part: 'X', out: volts }])).toThrow(RangeError);
    expect(() => one.run(-1)).toThrow(RangeError);
    close(one.time, 0.1, 1e-12, 'nothing ran');
  });

  it('a knob turned between steps takes effect at the next step; a setting that is not a number is a RangeError', () => {
    const board = net(
      3,
      part('B', 'ideal-9v', [1, 0]),
      part('P', 'pot-10k', [0, 2, 1], 0.5),
      part('C', 'ceramic-100n', [2, 0]),
    );
    const t = new Transient(board, { dt: 1e-3 });
    t.start('dc');
    // the capacitor's leak of 10 GΩ beside the 2.5 kΩ of the pot's halves takes 1.1 μV
    close(t.v[2], 4.5, 2e-6, 'half way');
    t.set('P', 1);
    for (let k = 0; k < 20; k++) t.step();
    close(t.v[2], 9, 2e-6, 'turned fully clockwise');
    board.parts[1]!.setting = 0.25; // the netlist itself, as a stand may change it
    for (let k = 0; k < 20; k++) t.step();
    close(t.v[2], 2.25, 2e-6, 'a quarter');
    expect(() => t.set('P', Number.NaN)).toThrow(RangeError);
    expect(() => t.set('nobody', 1)).toThrow(RangeError);
  });

  it('a new part on the board: the charges, the heat and the damage carry over, and time runs on', () => {
    const state = createModelState();
    const t = new Transient(rc(), { dt: 1e-3, state });
    t.start('zero');
    t.run(1000);
    const charged = t.state.parts.get('C')!.volts!;
    close(charged, 9 * (1 - Math.exp(-1)), 0.05, 'charged for one R·C');
    // the battery taken away and an LED put across the resistor's free leg
    t.rebuild(
      net(
        3,
        part('R', 'resistor-10k', [1, 2]),
        part('C', 'electrolytic-100u-16v', [2, 0]),
        part('D', 'led-red', [1, 0]),
      ),
    );
    close(t.time, 1, 1e-12, 'time runs on');
    expect(t.step()).toBe(true);
    close(t.parts.C!.u, charged, 0.01, 'the capacitor holds its charge');
    expect(t.parts.D!.i).toBeGreaterThan(0); // and empties through the LED
    expect(t.parts.D!.i).toBeLessThan(charged / 10e3);
  });

  it('a step whose iterations do not settle is taken again in shorter steps of Euler, and only then fails', () => {
    // 10 μF holds a red LED off for the first milliseconds; one step of 10 ms from cold must switch the LED on, which
    // takes Newton seven iterations. Allowed five, the step settles only in shorter steps — and lands nearer the
    // truth (the capacitor clamped by the LED at 1.82 V within 2 ms) than one long step of Euler does
    const board = (): Netlist =>
      net(
        3,
        part('B', 'battery-9v', [1, 0]),
        part('R', 'resistor-1k', [1, 2]),
        part('C', 'electrolytic-10u-16v', [2, 0]),
        part('D', 'led-red', [2, 0]),
      );
    const patient = new Transient(board(), { dt: 0.01 });
    const hasty = new Transient(board(), { dt: 0.01, maxIterations: 5 });
    patient.start('zero');
    hasty.start('zero');
    expect(patient.step()).toBe(true);
    expect(hasty.step()).toBe(true);
    close(patient.v[2], 1.7953, 1e-4, 'one step of Euler from 0 to 10 ms');
    close(hasty.v[2], 1.8199, 1e-4, 'the same 10 ms in shorter steps');
    close(hasty.time, 0.01, 1e-15, 'one step all the same');
    expect(hasty.run(20)).toBe(20);
    expect(patient.run(20)).toBe(20);
    close(hasty.v[2], patient.v[2]!, 2e-3, 'both on the same curve after');
    // allowed three, nothing settles: the first iteration from nothing never counts, and the step fails as a whole
    const stuck = new Transient(board(), { dt: 0.01, maxIterations: 3 });
    stuck.start('zero');
    expect(stuck.step()).toBe(false);
    expect(stuck.reason).toBe('no-convergence');
    expect(stuck.time).toBe(0);
    expect([...stuck.v]).toEqual([0, 0, 0]);
  });

  it('a step in substeps is that many steps of integration: the moments of the shorter step exactly, one sample a step', () => {
    const s = sample<AcSample>('filters');
    const board = structuredClone(s.netlist);
    board.parts.find((p) => p.id === s.source)!.setting = 10000;
    const sampled = new Transient(structuredClone(board), { dt: AUDIO, substeps: 4 });
    const fine = new Transient(structuredClone(board), { dt: AUDIO / 4 });
    expect(sampled.substeps).toBe(4);
    expect(fine.substeps).toBe(1);
    sampled.start('zero');
    fine.start('zero');
    const low = new Float32Array(480);
    const high = new Float32Array(480);
    const lowFine = new Float32Array(4 * 480);
    const highFine = new Float32Array(4 * 480);
    expect(
      sampled.run(480, [
        { node: 2, out: low },
        { node: 3, out: high },
      ]),
    ).toBe(480);
    expect(
      fine.run(4 * 480, [
        { node: 2, out: lowFine },
        { node: 3, out: highFine },
      ]),
    ).toBe(4 * 480);
    // the same numbers, bit for bit: Euler's first two steps, the sine's moments and the trapezoid's steps all agree
    for (let k = 0; k < 480; k++) {
      expect(low[k]).toBe(lowFine[4 * k + 3]);
      expect(high[k]).toBe(highFine[4 * k + 3]);
    }
    close(sampled.time, 0.01, 1e-15, '480 samples of 1/48000 s');
    close(fine.time, 0.01, 1e-15, 'and 1920 steps of a quarter of it');
    expect(sampled.parts.C1).toEqual(fine.parts.C1);
  });

  it('a step in substeps that fails in a later one goes back to where it began: time, voltages, charges, memory', () => {
    // a sine of 6 V at 50 Hz through 1 kΩ into a red LED with 100 nF across it, allowed three iterations: of 1 ms in two
    // halves, the first half settles (the capacitor charges, the LED stays dark) and the second, where the LED wakes,
    // does not, even in 64 pieces — as a transient stepping by half a millisecond shows
    const board = (): Netlist =>
      net(
        3,
        part('S', 'ideal-ac-6v', [1, 0], 50),
        part('R', 'resistor-1k', [1, 2]),
        part('D', 'led-red', [2, 0]),
        part('C', 'ceramic-100n', [2, 0]),
      );
    const halves = new Transient(board(), { dt: 5e-4, maxIterations: 3 });
    expect(halves.start('dc')).toBe(true);
    expect(halves.step()).toBe(true);
    close(
      halves.memory('C')!.volts,
      0.782,
      0.001,
      'the first half charges the capacitor (the sine is at 0.93 V)',
    );
    expect(halves.step()).toBe(false);
    const t = new Transient(board(), { dt: 1e-3, substeps: 2, maxIterations: 3 });
    expect(t.start('dc')).toBe(true);
    const c = t.circuit;
    const before = {
      v: [...t.v],
      unknowns: [...c.operating.v],
      memory: [...c.memory],
      history: [...c.history],
      initial: c.operating.initial,
      parts: structuredClone(t.parts),
      volts: t.memory('C')!.volts,
    };
    expect(before.history[0]).toBe(0);
    expect(t.step()).toBe(false);
    expect(t.ok).toBe(false);
    expect(t.reason).toBe('no-convergence');
    expect(t.time).toBe(0);
    expect({
      v: [...t.v],
      unknowns: [...c.operating.v],
      memory: [...c.memory],
      history: [...c.history],
      initial: c.operating.initial,
      parts: structuredClone(t.parts),
      volts: t.memory('C')!.volts,
    }).toEqual(before);
    // and the next step tries the same again, from the same place
    expect(t.step()).toBe(false);
    expect([...c.history]).toEqual(before.history);
  });

  it('a circuit with no solution makes the step fail without an exception, and time stands', () => {
    const t = new Transient(net(2, part('A', 'ideal-9v', [1, 0]), part('B', 'ideal-5v', [1, 0])), {
      dt: 1e-3,
    });
    expect(t.start('zero')).toBe(true);
    expect(t.step()).toBe(false);
    expect(t.ok).toBe(false);
    expect(t.reason).toBe('singular');
    expect(t.time).toBe(0);
    expect(t.run(10)).toBe(0);
    expect(() => new Transient(rc(), { dt: 0 })).toThrow(RangeError);
    expect(() => new Transient(rc(), { dt: Number.NaN })).toThrow(RangeError);
    for (const substeps of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => new Transient(rc(), { dt: 1e-3, substeps })).toThrow(RangeError);
    expect(() => new Transient(rc(), { dt: 1e-3 }).step()).toThrow(Error); // not started
  });
});
