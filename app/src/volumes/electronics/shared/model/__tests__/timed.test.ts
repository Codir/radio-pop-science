/**
 * The board in time for the bench's looks (`timed.ts`; plan decision 1 of batch E4, recon E4 §1.3 N1 and §1.1 E4-T):
 * while `model.timed`, the driver counts the board on the bench in time frame by frame — the frame's `dt` in steps of
 * 1/4800 s, from the board's operating point at a start (a step's preset), the charges carried by id across a new
 * shape, a frame of no time moving nothing — and `reading`, `nodeVolts`, `rowVolts` and a capacitor's `volts` come from
 * its last moment. A threshold watch tells, between two of its steps, the moment a part's current crossed a level.
 * Checked against the oracle (`led-discharge.json`: 470 μF from an ideal 9 V into 330 Ω and the red LED) and against
 * the script's model runs of `capacitor/store` and `capacitor/capacity` (docs/volumes/electronics/chapters/capacitor.md,
 * «Ціль» and the notes: run E4-2).
 */
import { describe, expect, it } from 'vitest';
import {
  createBoardState,
  createLayout,
  place,
  put,
  remove,
  seatLeg,
  seatPreset,
  setSetting,
  LED_LOOP,
  BENCH_FIXED,
  type BoardState,
  type FixedPart,
  type PresetPart,
} from '@electronics/sim/board';
import { createBenchModel, type BenchModel } from '../driver';
import { TIMED } from '../timed';

const layout = createLayout();
const DT = 1 / 60;

/** The board of `capacitor/store` (its script's «Бачимо»): the LED's loop, J3 + rail → 12ae, J4 13ae → − rail. */
const STORE: readonly PresetPart[] = [
  ...LED_LOOP.parts,
  { id: 'J3', spec: 'jumper', at: '+12', to: 'a12' },
  { id: 'J4', spec: 'jumper', at: 'e13', to: '-13' },
];

/** STORE with a can in c12/c13 (plus in row 12, on the + rail), or none; the battery's switch closed. */
function store(can: string | null): BoardState {
  const s = createBoardState();
  seatPreset(layout, s, can === null ? STORE : [...STORE, { id: 'C1', spec: can, at: 'c12' }]);
  setSetting(s, 'SW', 1);
  return s;
}

/** A bench model in time on `board`, its first sync done (the board in time starts there, from the operating point). */
function timed(board: BoardState, fixed?: readonly FixedPart[]): BenchModel {
  const model = createBenchModel({ layout, board, fixed });
  model.timed = true;
  model.sync();
  return model;
}

/** One frame of the bench for the model: its sync, then its time. */
const frame = (model: BenchModel, dt = DT): void => {
  model.sync();
  model.advance(dt);
};
const frames = (model: BenchModel, seconds: number, dt = DT): void => {
  for (let k = 0; k < Math.round(seconds / dt); k++) frame(model, dt);
};

/** The seconds from the switch's opening to the moment the LED's current fell below 1 mA, by the threshold watch;
 * also the frame (of 1/60 s, counted from the opening) in which the bench first read it below. */
function fade(model: BenchModel, board: BoardState): { seconds: number; frame: number } {
  const watch = model.timeline.watch('LED1', 1e-3);
  setSetting(board, 'SW', 0);
  let first = 0;
  for (let k = 1; k <= 120 && !(watch.fell >= model.timeline.changed('SW')); k++) {
    frame(model);
    if (first === 0 && Math.abs(model.reading('LED1')!.i) < 1e-3) first = k;
  }
  return { seconds: watch.fell - model.timeline.changed('SW'), frame: first };
}

type Tran = { times: number[]; i: Record<string, number[]> };
const files = import.meta.glob('../../../sim/core/__fixtures__/*.json', { eager: true, import: 'default' });
const oracle = files['../../../sim/core/__fixtures__/led-discharge.json'] as Tran;

describe('the board in time for the bench’s looks', () => {
  it('470 μF from an ideal 9 V into 330 Ω and the red LED: the oracle’s current within 0.1 mA', () => {
    // the bench's battery replaced by an ideal 9 V behind the same switch: the can charged to 9.0 V at the start, as
    // the oracle's deck starts it, and the switch's opening leaves the oracle's own circuit (the jumpers' 1 mΩ apart)
    const ideal: FixedPart[] = BENCH_FIXED.map((f) => (f.id === 'BAT' ? { ...f, spec: 'ideal-9v' } : f));
    const board = store('electrolytic-470u-16v');
    const model = timed(board, ideal);
    expect(model.volts('C1')).toBeCloseTo(9, 4);
    setSetting(board, 'SW', 0);
    // frames of 25 ms: the oracle's own times after the opening (the board in time takes any frame's dt)
    oracle.times.forEach((t, k) => {
      frame(model, 0.025);
      expect(model.timeline.now - model.timeline.changed('SW')).toBeCloseTo(t, 9);
      const amps = model.reading('LED1')!.i;
      expect(Math.abs(amps - oracle.i.D1![k]!)).toBeLessThan(1e-4);
    });
    // the script's four: 18.2 / 11.4 / 4.5 / 1.0 mA at 0.025 / 0.1 / 0.25 / 0.5 s
    expect(oracle.i.D1![0]).toBeCloseTo(0.0182, 4);
    expect(oracle.i.D1![19]).toBeCloseTo(0.001, 4);
  });

  it('`store` on the bench’s battery: 21.235 mA closed; after the opening 11.33 / 4.48 / 1.03 mA, below 1 mA at 0.506 s', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    expect(model.timeline.running).toBe(true);
    expect(model.timeline.rate).toBe(TIMED.rate);
    expect(model.reading('LED1')!.i).toBeCloseTo(0.021235, 6);
    expect(model.volts('C1')).toBeCloseTo(8.968, 3);
    // the step's frames move it by 80 steps each
    frames(model, 0.2);
    expect(model.timeline.frameSteps).toBe(80);
    expect(model.timeline.steps).toBe(12 * 80);
    expect(model.timeline.now).toBeCloseTo(0.2, 9);
    const watch = model.timeline.watch('LED1', 1e-3);
    setSetting(board, 'SW', 0);
    const at: Record<number, number> = {};
    for (let k = 1; k <= 60; k++) {
      frame(model);
      at[k] = model.reading('LED1')!.i;
    }
    // frames 6, 15, 30 of 1/60 s: 0.1, 0.25 and 0.5 s after the opening (the script's run E4-2)
    expect(at[6]).toBeCloseTo(0.011334, 5);
    expect(at[15]).toBeCloseTo(0.00448, 5);
    expect(at[30]).toBeCloseTo(0.001032, 5);
    // the can's voltage across its capacitance at the same moments: 2.02 V at 0.5 s, 1.61 V at 1 s
    const opened = model.timeline.changed('SW');
    expect(opened).toBeCloseTo(0.2, 9);
    expect(model.timeline.changes()).toEqual({ SW: opened });
    expect(model.timeline.watches()).toEqual([watch]);
    expect(model.timeline.watch('LED1', 1e-3)).toBe(watch);
    expect(watch.fell - opened).toBeCloseTo(0.5058, 3);
    expect(watch.below).toBe(true);
    expect(model.volts('C1')).toBeCloseTo(1.61, 2);
  });

  it('`capacity`: below 1 mA after the opening at 0.506 / 0.108 / 0.0113 s for 470 / 100 / 10 μF, the last within a frame', () => {
    // the script's model run E4-2: 0.5058 / 0.1081 / 0.0113 s at 1/24 000 s; by frames of 1/60 s the 31st, 7th, 1st
    const cases = [
      { can: 'electrolytic-470u-16v', seconds: 0.5058, within: 5e-4, frame: 31 },
      { can: 'electrolytic-100u-16v', seconds: 0.1081, within: 5e-4, frame: 7 },
      { can: 'electrolytic-10u-16v', seconds: 0.0113, within: 1e-4, frame: 1 },
    ];
    for (const c of cases) {
      const board = store(c.can);
      const model = timed(board);
      frames(model, 0.5);
      const f = fade(model, board);
      expect(Math.abs(f.seconds - c.seconds), c.can).toBeLessThan(c.within);
      expect(f.frame, c.can).toBe(c.frame);
    }
  });

  it('no can: the LED’s current is below 0.1 mA in the very frame the switch opens', () => {
    const board = store(null);
    const model = timed(board);
    frames(model, 0.2);
    expect(model.reading('LED1')!.i).toBeCloseTo(0.021235, 6);
    const watch = model.timeline.watch('LED1', 1e-3);
    setSetting(board, 'SW', 0);
    frame(model);
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-4);
    // the current fell below 1 mA within the first step of 1/4800 s
    const fell = watch.fell - model.timeline.changed('SW');
    expect(fell).toBeGreaterThan(0);
    expect(fell).toBeLessThanOrEqual(1 / TIMED.rate);
  });

  it('a can put on the closed switch empty fills within the frame, and then gives the same fade', () => {
    const board = store(null);
    const model = timed(board);
    frames(model, 0.2);
    // the hand's new part (a new id) in c12/c13 on the live board: it comes empty, the battery fills it at once
    expect(place(layout, board, { id: 'C2', spec: 'electrolytic-470u-16v', anchor: 'c12', o: 0 })).toBe(true);
    frame(model);
    expect(model.timeline.starts).toBe(1);
    expect(model.volts('C2')).toBeGreaterThan(8.9);
    // one frame closed is enough (the script: any time from one frame to 5 s)
    const watch = model.timeline.watch('LED1', 1e-3);
    setSetting(board, 'SW', 0);
    for (let k = 0; k < 40; k++) frame(model);
    expect(watch.fell - model.timeline.changed('SW')).toBeCloseTo(0.5058, 3);
  });

  it('a frame of no time (dt 0, a held frame) moves nothing: the moment, the readings, the hash', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    setSetting(board, 'SW', 0);
    frames(model, 0.25);
    const now = model.timeline.now;
    const amps = model.reading('LED1')!.i;
    const volts = model.volts('C1');
    const row = model.rowVolts('12ae');
    const hash = model.timeline.hash();
    const steps = model.timeline.steps;
    for (let k = 0; k < 10; k++) frame(model, 0);
    expect(model.timeline.now).toBe(now);
    // no step taken; the last frame that let time pass is still the one the count tells of
    expect(model.timeline.steps).toBe(steps);
    expect(model.timeline.frameSteps).toBe(80);
    expect(model.reading('LED1')!.i).toBe(amps);
    expect(model.volts('C1')).toBe(volts);
    expect(model.rowVolts('12ae')).toBe(row);
    expect(model.timeline.hash()).toBe(hash);
    // and the same board in the same frames gives the same hash (two held pages)
    const other = store('electrolytic-470u-16v');
    const twin = timed(other);
    setSetting(other, 'SW', 0);
    frames(twin, 0.25);
    expect(twin.timeline.hash()).toBe(hash);
  });

  it('a preset starts it again from the operating point: the can full again at once', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    setSetting(board, 'SW', 0);
    frames(model, 0.5);
    expect(model.volts('C1')).toBeCloseTo(2.02, 2);
    const before = model.timeline.now;
    // what `bench.preset` does: every part off and forgotten (the fixed ones too), the step's list under its ids
    for (const id of [...board.parts.keys()]) {
      remove(board, id);
      model.forget(id);
    }
    for (const f of BENCH_FIXED) model.forget(f.id);
    seatPreset(layout, board, [...STORE, { id: 'C1', spec: 'electrolytic-470u-16v', at: 'c12' }]);
    setSetting(board, 'SW', 1);
    model.sync();
    expect(model.timeline.starts).toBe(2);
    expect(model.volts('C1')).toBeCloseTo(8.968, 3);
    expect(model.reading('LED1')!.i).toBeCloseTo(0.021235, 6);
    // its moment runs on, and the setting's change belongs to the old start
    expect(model.timeline.now).toBe(before);
    expect(Number.isNaN(model.timeline.changed('SW'))).toBe(true);
    // with the switch open at the preset, the can starts empty: the operating point of that board
    for (const id of [...board.parts.keys()]) {
      remove(board, id);
      model.forget(id);
    }
    seatPreset(layout, board, [...STORE, { id: 'C1', spec: 'electrolytic-470u-16v', at: 'c12' }]);
    setSetting(board, 'SW', 0);
    model.sync();
    expect(model.timeline.starts).toBe(3);
    expect(Math.abs(model.volts('C1')!)).toBeLessThan(1e-6);
  });

  it('a new shape keeps the can’s charge by id: another part put in, the can itself in the hand and back', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    setSetting(board, 'SW', 0);
    frames(model, 0.5);
    const half = model.volts('C1')!;
    expect(half).toBeCloseTo(2.02, 2);
    // a resistor elsewhere on the board: a new circuit, the same moment, the same charge
    expect(place(layout, board, { id: 'R2', spec: 'resistor-10k', anchor: 'g1', o: 0 })).toBe(true);
    const key = model.net!.key;
    model.sync();
    expect(model.net!.key).not.toBe(key);
    expect(model.volts('C1')).toBe(half);
    frame(model);
    expect(model.timeline.starts).toBe(1);
    expect(model.volts('C1')).toBeLessThan(half);
    expect(model.volts('C1')).toBeGreaterThan(half - 0.05);
    // the can in the hand (both legs in the air: out of the circuit, on the bench): it keeps what it holds
    const held = model.volts('C1')!;
    expect(seatLeg(layout, board, 'C1', 0, null)).toBe(true);
    expect(seatLeg(layout, board, 'C1', 1, null)).toBe(true);
    frames(model, 1);
    expect(model.reading('C1')).toBeNull();
    expect(model.volts('C1')).toBeCloseTo(held, 6);
    // the LED alone has nothing to take from: dark
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-9);
    // back in its sockets: the LED takes from it again
    expect(put(layout, board, { id: 'C1', spec: 'electrolytic-470u-16v', legs: ['c12', 'c13'] })).toBe(true);
    frame(model);
    expect(model.reading('LED1')!.i).toBeGreaterThan(1e-5);
    expect(model.volts('C1')).toBeLessThan(held);
    expect(model.volts('C1')).toBeGreaterThan(held - 0.05);
  });

  it('turned off, the driver’s operating point again; turned on again, from the operating point of the board now', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    setSetting(board, 'SW', 0);
    frames(model, 0.25);
    expect(model.reading('LED1')!.i).toBeGreaterThan(1e-3);
    model.timed = false;
    expect(model.timeline.running).toBe(false);
    // the operating point: the switch open, the can open but for its leak — no current
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-9);
    expect(Math.abs(model.volts('C1')!)).toBeLessThan(1e-6);
    setSetting(board, 'SW', 1);
    model.timed = true;
    frame(model);
    expect(model.timeline.running).toBe(true);
    expect(model.timeline.starts).toBe(2);
    expect(model.volts('C1')).toBeCloseTo(8.968, 3);
  });

  it('the damage is the driver’s: an LED it burns is a gap in the board in time from that very frame', () => {
    // the red LED straight across the battery: 0.93 A, the driver burns it after ≈ 0.07 s (sim/core README, «Limits»)
    const s = createBoardState();
    seatPreset(layout, s, [
      { id: 'J1', spec: 'jumper', at: '+9', to: 'a9' },
      { id: 'LED1', spec: 'led-red', at: 'c9' },
      { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
    ]);
    setSetting(s, 'SW', 1);
    const model = timed(s);
    expect(model.reading('LED1')!.i).toBeGreaterThan(0.5);
    let burnt: readonly string[] = [];
    let k = 0;
    for (; k < 30 && burnt.length === 0; k++) {
      model.sync();
      burnt = model.advance(DT);
      // till then the board in time has it whole: the same current as the driver's operating point
      if (burnt.length === 0) expect(model.reading('LED1')!.i).toBeGreaterThan(0.5);
    }
    expect(burnt).toEqual(['LED1']);
    expect(k).toBeLessThanOrEqual(6);
    expect(model.part('LED1')!.condition).toBe('burnt');
    // the frame it burnt in: the board in time took the damage before its steps
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-9);
    frames(model, 0.5);
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-9);
    expect(model.timeline.starts).toBe(1);
  });

  it('the meter’s rows and a node read the same moment: the can’s row is its capacitance’s volts and the ESR’s drop', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    setSetting(board, 'SW', 0);
    frames(model, 0.1);
    const plus = model.rowVolts('12ae')!;
    const minus = model.rowVolts('13ae')!;
    const c = model.reading('C1')!;
    expect(plus - minus).toBeCloseTo(c.u, 9);
    // u = volts + i × ESR (0.5644 Ω), i into leg 0 (negative: the can gives)
    expect(c.u - model.volts('C1')!).toBeCloseTo(c.i * 0.5644, 6);
    expect(model.nodeVolts(layout.node('12ae'))).toBe(plus);
  });
});

describe('the cost of the board in time', () => {
  it('`store`: 80 steps a frame of 1/60 s, at most 1 ms a frame on average', () => {
    const board = store('electrolytic-470u-16v');
    const model = timed(board);
    frames(model, 0.5);
    setSetting(board, 'SW', 0);
    let total = 0;
    let worst = 0;
    const n = 240;
    for (let k = 0; k < n; k++) {
      frame(model);
      total += model.timeline.ms;
      worst = Math.max(worst, model.timeline.ms);
    }
    expect(model.timeline.frameSteps).toBe(80);
    expect(total / n).toBeLessThan(1);
    expect(Number.isFinite(worst)).toBe(true);
  });
});
