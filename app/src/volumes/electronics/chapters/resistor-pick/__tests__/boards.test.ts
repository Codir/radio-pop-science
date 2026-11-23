/**
 * The steps' boards (`parts/boards.ts`) as the bench's model solves them, and the windows of the goals around the
 * model's numbers (the script's «Ціль», `docs/volumes/electronics/chapters/resistor-pick.md`): the two nearest values
 * of the LED's resistor give 21,24 and 19,51 mA and the others lie outside both windows; the 330 Ω beside the LED is
 * warm at 0,149 W and the 1 kΩ cold at 0,051 W; the 100 Ω between the jumpers' ends takes 0,786 W and burns after
 * ≈ 3,8 s, a gap after; the amplifier's LED «on» and its 2,2 kΩ share its supply, 1,750 and 6,587 V. On the bench (the
 * real part models, a stub context) no two bodies of a step take one place.
 */
import { Group, Matrix4, PerspectiveCamera, type Box3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import {
  AMPLIFIER_PRESET,
  LED_LOOP,
  createLayout,
  place,
  presetState,
  setSetting,
  type BoardState,
  type PresetPart,
} from '@electronics/sim/board';
import { mountBench } from '@electronics/shared/bench';
import { createBenchModel, type BenchModel } from '@electronics/shared/model';
import { METER_ID, meterExtra, type MeterMode, type ProbeSockets } from '@electronics/shared/instruments';
import {
  BURN,
  CALC,
  LOOP,
  METER_PROBES,
  ON,
  ON_ROWS,
  POWER,
  ROWS,
  WINDOWS,
  joinedRows,
  loopWith,
} from '../parts/boards';

const layout = createLayout();
const board = (parts: readonly PresetPart[], leads: Record<string, string> = {}): BoardState =>
  presetState(layout, { parts, leads });

/** The bench's model on a board, the meter in `mode` with its probes in these sockets, the switch closed. */
function solve(s: BoardState, meter?: { mode: MeterMode; probes: ProbeSockets }): BenchModel {
  setSetting(s, 'SW', 1);
  const model = createBenchModel({
    layout,
    board: s,
    extra: () => (meter ? meterExtra(layout, meter.mode, meter.probes) : []),
  });
  model.sync();
  expect(model.ok).toBe(true);
  return model;
}

const inside = (v: number | null | undefined, [lo, hi]: readonly [number, number]): boolean =>
  typeof v === 'number' && v >= lo && v <= hi;
const rowOf = (socket: string | null): string => layout.socket(socket!)!.row;

describe('the steps’ boards in the model', () => {
  it('bands, series: the LED’s loop of `resistor` with its 330 Ω; series puts another value in R1’s sockets', () => {
    expect(LOOP).toBe(LED_LOOP.parts);
    const r1 = loopWith('resistor-360').find((p) => p.id === 'R1')!;
    expect(r1).toMatchObject({ spec: 'resistor-360', at: 'b5' });
    expect(board(loopWith('resistor-1k')).parts.get('R1')!.legs).toEqual(['b5', 'b9']);
  });

  it('calc: the meter on «A» from 10ae to the − rail closes the loop; each value alone in the gap', () => {
    const want = {
      'resistor-330': 0.0212351,
      'resistor-360': 0.0195136,
      'resistor-390': 0.018051,
      'resistor-470': 0.0150465,
    } as const;
    for (const [spec, i] of Object.entries(want) as [keyof typeof want, number][]) {
      const s = board(CALC);
      expect(place(layout, s, { id: 'R1', spec, anchor: 'd5', o: 0 })).toBe(true);
      const model = solve(s, { mode: 'A', probes: METER_PROBES });
      const meter = model.reading(METER_ID)!.i;
      expect(meter).toBeCloseTo(i, 6);
      const counts = Object.entries(WINDOWS.calc).filter(([, w]) => inside(meter, w)).map(([k]) => k);
      // 330 and 360 Ω each in its own window, 390 and 470 Ω in neither
      expect(counts).toEqual(spec in WINDOWS.calc ? [spec] : []);
      for (let k = 0; k < 60 * 30; k++) model.advance(1 / 60);
      expect(model.part('LED1')!.condition).not.toBe('burnt');
    }
    // the gap empty: nothing flows; the LED stands in the rows of the goal
    const empty = board(CALC);
    expect(solve(empty, { mode: 'A', probes: METER_PROBES }).reading(METER_ID)!.i).toBeCloseTo(0, 9);
    expect(empty.parts.get('LED1')!.legs.map(rowOf)).toEqual([...ROWS.led]);
    // two 330 Ω side by side in the gap: 41 mA, the LED burns within 2,6 s (the tray has a new one)
    const two = board(CALC);
    expect(place(layout, two, { id: 'R1', spec: 'resistor-330', anchor: 'b5', o: 0 })).toBe(true);
    expect(place(layout, two, { id: 'R2', spec: 'resistor-330', anchor: 'd5', o: 0 })).toBe(true);
    const m2 = solve(two, { mode: 'A', probes: METER_PROBES });
    expect(m2.reading(METER_ID)!.i).toBeCloseTo(0.04135, 4);
    let t = 0;
    while (m2.part('LED1')!.condition !== 'burnt' && t < 10) {
      m2.advance(1 / 60);
      t += 1 / 60;
    }
    expect(t).toBeGreaterThan(2.4);
    expect(t).toBeLessThan(2.8);
  });

  it('power: 330 Ω warm at 7,008 V and 0,149 W, 1 kΩ cold at 7,169 V and 0,051 W — inside the windows', () => {
    for (const [spec, w] of [
      ['resistor-330', WINDOWS.power['resistor-330']],
      ['resistor-1k', WINDOWS.power['resistor-1k']],
    ] as const) {
      const s = board(POWER.map((p) => (p.id === 'R1' ? { ...p, spec } : p)));
      const model = solve(s, { mode: 'A', probes: METER_PROBES });
      const r = model.reading('R1')!;
      expect(inside(model.reading(METER_ID)!.i, w.amps), spec).toBe(true);
      expect(inside(Math.abs(r.u), w.volts), `${spec} ${r.u}`).toBe(true);
      expect(inside(r.p, w.watts), `${spec} ${r.p}`).toBe(true);
      expect(model.part('R1')!.condition).toBe(w.condition);
      for (let k = 0; k < 60 * 30; k++) model.advance(1 / 60);
      expect(model.part('LED1')!.condition).not.toBe('burnt');
      expect(model.part('R1')!.condition).toBe(w.condition);
    }
    expect(solve(board(POWER), { mode: 'A', probes: METER_PROBES }).reading('R1')!.u).toBeCloseTo(7.0076, 4);
  });

  it('burn: 100 Ω between the jumpers’ ends takes 0,786 W, hot at once, burns at ≈ 3,83 s; then a gap, 9 V', () => {
    const s = board(BURN);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-100', anchor: 'c9', o: 0 })).toBe(true);
    expect(s.parts.get('R1')!.legs.map(rowOf)).toEqual([...ROWS.burn]);
    const model = solve(s);
    const r = model.reading('R1')!;
    expect(r.i).toBeCloseTo(0.088667, 5);
    expect(r.p).toBeCloseTo(0.7862, 4);
    expect(model.part('R1')!.condition).toBe('hot');
    let t = 0;
    while (model.part('R1')!.condition !== 'burnt' && t < 10) {
      model.advance(1 / 60);
      t += 1 / 60;
    }
    expect(t).toBeCloseTo(3.833, 1);
    // a gap: no current, no power (the readout «0,000 W»), the rails at the battery's 9 V
    expect(model.reading('R1')).not.toBeNull();
    expect(Math.abs(model.reading('R1')?.p ?? 0)).toBeLessThan(1e-9);
    expect(Math.abs(model.reading('R1')?.i ?? 0)).toBeLessThan(1e-9);
    expect(model.rowVolts('+')! - model.rowVolts('-')!).toBeCloseTo(9, 4);
  });

  it('on: the rows of the LED «on» and of its 2,2 kΩ, the ground and the supply through the jumpers', () => {
    expect(ON).toBe(AMPLIFIER_PRESET);
    const s = board(ON.parts, ON.leads);
    expect(s.parts.get('LED1')!.legs.map(rowOf)).toEqual([ON_ROWS.led, '-']);
    expect(s.parts.get('R1')!.legs.map(rowOf).sort()).toEqual(['5ae', ON_ROWS.led].sort());
    expect([...ON_ROWS.ground].sort()).toEqual(['-', '12fj', '15fj', '17ae', '2fj', '9fj'].sort());
    expect([...ON_ROWS.supply].sort()).toEqual(['2ae', '5ae']);
    expect(joinedRows(ON, '7ae').sort()).toEqual(['7ae', '7fj']);
    const model = solve(s);
    const v = (a: string, b: string) => Math.abs(model.rowVolts(a)! - model.rowVolts(b)!);
    for (const g of ON_ROWS.ground) expect(inside(v(ON_ROWS.led, g), WINDOWS.on.led), g).toBe(true);
    for (const p of ON_ROWS.supply) expect(inside(v(p, ON_ROWS.led), WINDOWS.on.res), p).toBe(true);
    expect(model.reading('LED1')!.i).toBeCloseTo(0.00299417, 7);
    expect(model.reading('R1')!.p).toBeCloseTo(0.019723, 5);
    expect(model.part('R1')!.condition).toBe('ok');
    // the supply to the ground: 8,337 V; nothing of it is either window
    expect(v('5ae', '-')).toBeCloseTo(8.33688, 3);
    expect(inside(v('5ae', '-'), WINDOWS.on.led) || inside(v('5ae', '-'), WINDOWS.on.res)).toBe(false);
  });
});

/* ------------------------------------------------------------------------------ on the bench: the bodies */

/** A chapter context with what the bench uses (as `shared/bench/__tests__/presets.test.ts` has it). */
function stubContext(): ChapterContext {
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return {
    root: new Group(),
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    input: { register: () => () => {}, on: () => () => {} },
    device: { formFactor: 'desktop', hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: { base: () => {}, setScale: () => {}, setShadow: () => {}, tune: () => {}, params: { keyIntensity: 0 } },
    post: { base: () => {} },
    camera: { shots: () => {}, camera: new PerspectiveCamera(27, 1920 / 1080, 0.1, 100) },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
}

const meet = (A: Box3, B: Box3): boolean => {
  const m = A.clone().intersect(B);
  if (m.isEmpty()) return false;
  const size = m.max.clone().sub(m.min);
  return size.x > 1e-3 && size.y > 1e-3 && size.z > 1e-3;
};

/** The bodies (`hit` boxes, board frame) of a board that meet another body. */
function bodiesMeeting(parts: readonly PresetPart[]): string[] {
  const bench = mountBench(stubContext());
  bench.preset(parts);
  bench.update(0, 0);
  bench.board.group.updateWorldMatrix(true, true);
  const toBoard = new Matrix4().copy(bench.board.group.matrixWorld).invert();
  const boxes = [...bench.parts.models].map(([id, m]) => {
    m.hit.geometry.computeBoundingBox();
    const box = m.hit.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBoard, m.hit.matrixWorld));
    return { id, box };
  });
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) if (meet(boxes[i]!.box, boxes[j]!.box)) out.push(`${boxes[i]!.id} × ${boxes[j]!.id}`);
  return out;
}

describe('the steps’ boards on the bench', () => {
  it('no two bodies of a step’s parts in one place (calc and power with a resistor in the gap, burn with the 100 Ω)', () => {
    const r = (spec: string, at: string): PresetPart => ({ id: 'R9', spec, at });
    for (const parts of [
      LOOP,
      CALC,
      [...CALC, r('resistor-360', 'd5')],
      POWER,
      BURN,
      [...BURN, r('resistor-100', 'c9')],
    ])
      expect(bodiesMeeting(parts)).toEqual([]);
  });

  it('after the amplifier of `on` every other step’s board seats again, once the bench is cleared first', () => {
    const bench = mountBench(stubContext());
    for (const parts of [LOOP, CALC, POWER, BURN, loopWith('resistor-100')]) {
      bench.preset(ON.parts, ON.leads);
      bench.clear();
      expect(() => bench.preset(parts)).not.toThrow();
      expect(bench.state.leads.size).toBe(0);
    }
  });
});
