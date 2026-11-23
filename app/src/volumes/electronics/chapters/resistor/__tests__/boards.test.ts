/**
 * The steps' boards (`parts/boards.ts`) as the bench's model solves them, and the windows of the goals around the
 * model's numbers (the script's «Ціль», `docs/volumes/electronics/chapters/resistor.md`): every board seats, the LED
 * straight on the battery burns within a few frames, the 330 Ω saves it, the three resistors of `law` give their
 * currents, the voltages of `share` add up, and the amplifier of `amp` is the volume's own, its J8 the gap: J8 and the
 * meter in its place carry R5's current and the reservoir's leak, 0,11 % above R5's. On the bench (real part models, a stub context)
 * no two bodies take one place, and nothing of the amplifier's board stands where another part is.
 */
import { Box3, Group, Matrix4, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import {
  AMPLIFIER_PRESET,
  LED_LOOP,
  createLayout,
  place,
  presetState,
  seatLeg,
  setSetting,
  remove,
  type BoardPreset,
  type BoardState,
  type PresetPart,
} from '@electronics/sim/board';
import { LEAD, LEADS, PLUG, mountBench, type Bench } from '@electronics/shared/bench';
import { createBenchModel, type BenchModel } from '@electronics/shared/model';
import { memoryOf } from '@electronics/sim/core';
import { METER_ID, meterExtra, type MeterMode, type ProbeSockets } from '@electronics/shared/instruments';
import { AMP, AMP_ROWS, FLASH, LAW, LAW_PROBES, LIMIT, OHM, WINDOWS, loopWith } from '../parts/boards';

const layout = createLayout();
const board = (parts: readonly PresetPart[], leads: BoardPreset['leads'] = {}): BoardState =>
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

describe('the steps’ boards in the model', () => {
  it('flash: an LED straight from J3’s end to J2’s takes 0,93 A and burns within four frames of 1/60 s', () => {
    const s = board(FLASH);
    expect(place(layout, s, { id: 'LED1', spec: 'led-red', anchor: 'c9', o: 0 })).toBe(true);
    const model = solve(s);
    expect(model.reading('LED1')!.i).toBeCloseTo(0.92903, 4);
    let frames = 0;
    while (model.part('LED1')!.condition !== 'burnt' && frames < 60) {
      model.advance(1 / 60);
      frames++;
    }
    expect(frames).toBe(4);
    expect(model.reading('LED1')!.i).toBeLessThan(1e-9);
    expect(model.rowVolts('+')! - model.rowVolts('-')!).toBeCloseTo(9, 4);
  });

  it('limit: the 330 Ω in the gap from 5ae to 9ae gives the LED 21,235 mA, inside the goal’s window, and it lives', () => {
    const s = board(LIMIT);
    expect(place(layout, s, { id: 'R2', spec: 'resistor-330', anchor: 'd5', o: 0 })).toBe(true);
    const model = solve(s);
    const i = model.reading('LED1')!.i;
    expect(i).toBeCloseTo(0.0212351, 6);
    expect(inside(i, WINDOWS.limit)).toBe(true);
    for (let k = 0; k < 60 * 30; k++) model.advance(1 / 60);
    expect(model.part('LED1')!.condition).not.toBe('burnt');
    expect(model.part('R2')!.condition).toBe('warm');
  });

  it('ohm: on the live loop the 330 Ω reads «—» (powered); out of the loop each resistor its own value', () => {
    const s = board(OHM);
    const model = solve(s);
    const n = (row: string) => layout.node(row);
    expect(model.powered(n('5ae'), n('9ae'))).toBe(true);
    expect(model.powered(n('2fj'), n('6fj'))).toBe(false);
    expect(inside(model.ohms(n('2fj'), n('6fj')), WINDOWS.ohm['resistor-1k'])).toBe(true);
    expect(inside(model.ohms(n('12fj'), n('16fj')), WINDOWS.ohm['resistor-4k7'])).toBe(true);
    // R1 taken out of the loop and set down on the near half's free sockets: the loop is open, it reads 330 Ω
    remove(s, 'R1');
    expect(place(layout, s, { id: 'R1', spec: 'resistor-330', anchor: 'i2', o: 0 })).toBe(true);
    model.sync();
    expect(model.powered(n('2fj'), n('6fj'))).toBe(false);
    // beside the 1 kΩ in the same rows: the two side by side (248 Ω), not one of the goal's values
    expect(model.ohms(n('2fj'), n('6fj'))).toBeCloseTo(248.12, 1);
    remove(s, 'R1');
    expect(place(layout, s, { id: 'R1', spec: 'resistor-330', anchor: 'h7', o: 0 })).toBe(true);
    model.sync();
    expect(inside(model.ohms(n('7fj'), n('11fj')), WINDOWS.ohm['resistor-330'])).toBe(true);
    expect(model.reading('LED1')!.i).toBeLessThan(1e-9);
  });

  it('inside: the loop with 330 Ω or 10 kΩ — 21,235 mA or 0,734 mA, 29 times less', () => {
    const a = solve(board(loopWith('resistor-330'))).reading('R1')!.i;
    const b = solve(board(loopWith('resistor-10k'))).reading('R1')!.i;
    expect(a).toBeCloseTo(0.0212351, 6);
    expect(b).toBeCloseTo(0.00073355, 7);
    expect(a / b).toBeCloseTo(28.95, 1);
  });

  it('law: 1 kΩ, 2 kΩ and 3 kΩ alone in the gap, the meter on «A» from 9ae to the − rail: inside the windows', () => {
    const want = { 'resistor-1k': 0.0089865, 'resistor-2k': 0.0044966, 'resistor-3k': 0.0029985 } as const;
    for (const [spec, i] of Object.entries(want) as [keyof typeof want, number][]) {
      const s = board(LAW);
      expect(place(layout, s, { id: 'R1', spec, anchor: 'c5', o: 0 })).toBe(true);
      const model = solve(s, { mode: 'A', probes: LAW_PROBES });
      const meter = model.reading(METER_ID)!.i;
      expect(meter).toBeCloseTo(i, 7);
      expect(inside(meter, WINDOWS.law[spec])).toBe(true);
    }
    // the gap empty: the meter reads nothing flowing
    expect(solve(board(LAW), { mode: 'A', probes: LAW_PROBES }).reading(METER_ID)!.i).toBeCloseTo(0, 9);
  });

  it('share: 1,960 V on the LED, 7,008 V on the resistor, 8,968 V between the rails — inside the windows', () => {
    const model = solve(board(LED_LOOP.parts));
    const v = (a: string, b: string) => Math.abs(model.rowVolts(a)! - model.rowVolts(b)!);
    expect(inside(v('9ae', '10ae'), WINDOWS.share.led)).toBe(true);
    expect(inside(v('5ae', '9ae'), WINDOWS.share.res)).toBe(true);
    expect(inside(v('+', '-'), WINDOWS.share.bat)).toBe(true);
    // the + side and the − side of the goal: the rail or the row by it, every pair in the window
    for (const [p, m] of [['5ae', '10ae'], ['+', '10ae'], ['5ae', '-']])
      expect(inside(v(p!, m!), WINDOWS.share.bat), `${p}…${m}`).toBe(true);
  });
});

describe('the amplifier of `amp`, the gap in its own J8', () => {
  const gapped = () => board(AMP.parts, AMP.leads);

  it('is the volume’s amplifier as it stands; J8 carries R5’s current and the reservoir’s leak', () => {
    expect(AMP).toBe(AMPLIFIER_PRESET);
    const s = gapped();
    const j = s.parts.get(AMP_ROWS.jumper)!;
    expect(j.spec).toBe('jumper');
    expect(j.legs.map((x) => layout.socket(x!)!.row).sort()).toEqual([...AMP_ROWS.gap].sort());
    // the row 2ae holds R5's leg, C3's plus and J8's end, nothing else: J8 is all that feeds it
    const in2ae = [...s.parts.values()].flatMap((p) =>
      p.legs.flatMap((x, k) => (x !== null && layout.socket(x)!.row === '2ae' ? [`${p.id}.${k}`] : [])),
    );
    expect(in2ae.sort()).toEqual(['C3.0', 'J8.0', 'R5.0']);
    const model = solve(s);
    const r5 = model.reading('R5')!.i;
    const c3 = model.reading('C3')!.i;
    expect(r5).toBeCloseTo(0.008364, 6);
    expect(c3).toBeCloseTo(9.4e-6, 7);
    expect(Math.abs(model.reading(AMP_ROWS.jumper)!.i)).toBeCloseTo(r5 + c3, 10);
  });

  it('(a) the voltage on R5 across its rows is inside the window, the gap closed — either supply row and the top', () => {
    const model = solve(gapped());
    for (const supply of AMP_ROWS.supply)
      for (const top of AMP_ROWS.top) {
        const u = Math.abs(model.rowVolts(supply)! - model.rowVolts(top)!);
        expect(inside(u, WINDOWS.amp.volts), `${supply}…${top}: ${u}`).toBe(true);
      }
    expect(model.reading('R5')!.u).toBeCloseTo(3.93106, 4);
  });

  it('(b) J8 out, the meter on «A» in its rows: R5’s current and the leak, inside the window, either way round', () => {
    const s = gapped();
    remove(s, AMP_ROWS.jumper);
    for (const probes of [
      { red: 'd5', black: 'd2' },
      { red: 'c2', black: 'a5' },
    ] as ProbeSockets[]) {
      const model = solve(s, { mode: 'A', probes });
      const meter = Math.abs(model.reading(METER_ID)!.i);
      const r5 = model.reading('R5')!.i;
      const c3 = model.reading('C3')!.i;
      expect(meter).toBeCloseTo(0.0083734, 7);
      expect(inside(meter, WINDOWS.amp.amps), JSON.stringify(probes)).toBe(true);
      expect(Math.abs(meter / (Math.abs(r5) + Math.abs(c3)) - 1)).toBeLessThan(1e-3);
      // the 0,11 % the takeaway owns up to: Ohm's law on R5 alone gives 8,364 mA, the meter 8,373 mA
      expect(meter / r5 - 1).toBeCloseTo(0.00112, 4);
      expect(Math.abs(model.reading('R5')!.u / 470 - r5)).toBeLessThan(1e-12);
    }
    // without the meter the gap is open: R5 and the reservoir are off the supply, the output falls to 0 V
    const open = solve(s);
    expect(Math.abs(open.reading('R5')!.i)).toBeLessThan(1e-9);
    expect(Math.abs(open.rowVolts('7ae')! - open.rowVolts('-')!)).toBeLessThan(1e-6);
    expect(open.reading('LED1')!.i).toBeCloseTo(0.0030324, 6);
    // and the jumper in place with the meter beside it: two wires side by side, half each — outside the window
    const both = solve(gapped(), { mode: 'A', probes: { red: 'c2', black: 'a5' } });
    expect(Math.abs(both.reading(METER_ID)!.i)).toBeCloseTo(0.0083734 / 2, 6);
    expect(inside(Math.abs(both.reading(METER_ID)!.i), WINDOWS.amp.amps)).toBe(false);
  });

  it('the meter on «A» across the supply and the − rail shorts it through D1, which burns (the button «Нові деталі»)', () => {
    const model = solve(gapped(), { mode: 'A', probes: { red: 'a5', black: '-8' } });
    let t = 0;
    while (model.part('D1')!.condition !== 'burnt' && t < 5) {
      model.advance(1 / 60);
      t += 1 / 60;
    }
    expect(model.part('D1')!.condition).toBe('burnt');
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(1.5);
  });

  it('a leg moved by the hand keeps the step’s shape check honest: the gap’s rows are J8’s', () => {
    const s = gapped();
    const j = s.parts.get(AMP_ROWS.jumper)!;
    expect(j.legs.map((x) => layout.socket(x!)!.row).sort()).toEqual([...AMP_ROWS.gap].sort());
    expect(seatLeg(layout, s, AMP_ROWS.jumper, 1, null)).toBe(true);
    expect(s.parts.get(AMP_ROWS.jumper)!.legs[1]).toBeNull();
  });
});

/* ------------------------------------------------------------------------- on the bench: bodies, legs, plugs */

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

/**
 * What every part takes of the board's space (board frame), as the bench's presets test measures it: its body (its
 * `hit`) and each leg — a post from below the socket up to the legs' top, with an axial leg's run to its body — and a
 * post for every plug.
 */
function occupied(bench: Bench, preset: BoardPreset): { who: string; what: string; box: Box3 }[] {
  bench.board.group.updateWorldMatrix(true, true);
  const out: { who: string; what: string; box: Box3 }[] = [];
  const toBoard = new Matrix4().copy(bench.board.group.matrixWorld).invert();
  const boxOf = (mesh: { geometry: { computeBoundingBox(): void; boundingBox: Box3 | null }; matrixWorld: Matrix4 }) => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBoard, mesh.matrixWorld));
  };
  for (const [id, m] of bench.parts.models) {
    const body = boxOf(m.hit);
    out.push({ who: id, what: 'body', box: body });
    const top = boxOf(m.legs).max.y;
    const toBoardFromParent = new Matrix4().multiplyMatrices(toBoard, m.group.parent!.matrixWorld);
    m.legTips.forEach((t, k) => {
      const tip = t.clone().applyMatrix4(toBoardFromParent);
      const to = new Vector3(
        Math.min(Math.max(tip.x, body.min.x), body.max.x),
        0,
        Math.min(Math.max(tip.z, body.min.z), body.max.z),
      );
      const leg = new Box3(new Vector3(tip.x - 0.03, -0.04, tip.z - 0.03), new Vector3(tip.x + 0.03, top, tip.z + 0.03));
      leg.union(new Box3(new Vector3(to.x - 0.03, -0.04, to.z - 0.03), new Vector3(to.x + 0.03, top, to.z + 0.03)));
      out.push({ who: id, what: `leg ${k}`, box: leg });
    });
  }
  for (const [name, socket] of Object.entries(preset.leads)) {
    const s = layout.socket(socket)!;
    const r = PLUG.radius;
    const top = PLUG.pin - PLUG.dip + PLUG.sleeve;
    out.push({ who: name, what: 'plug', box: new Box3(new Vector3(s.x - r, -PLUG.dip, s.z - r), new Vector3(s.x + r, top, s.z + r)) });
  }
  return out;
}

function hits(preset: BoardPreset, legs: boolean): string[] {
  const bench = mountBench(stubContext());
  bench.preset(preset.parts, preset.leads);
  bench.closed = 1;
  bench.update(0, 0);
  const all = occupied(bench, preset);
  const out: string[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      if (a.who === b.who) continue;
      if (!legs && (a.what !== 'body' || b.what !== 'body')) continue;
      if (meet(a.box, b.box)) out.push(`${a.who} ${a.what} × ${b.who} ${b.what}`);
    }
  return out;
}

describe('the steps’ boards on the bench', () => {
  it('flash, limit, ohm: no two bodies of the step’s parts in one place (the jumpers lie under none)', () => {
    for (const parts of [FLASH, LIMIT, OHM]) expect(hits({ parts, leads: {} }, false)).toEqual([]);
  });

  it('after the amplifier every step’s board seats again: a preset is the step’s whole bench, its plugs out too', () => {
    const bench = mountBench(stubContext());
    // the amplifier's speaker plug stands in c10, where the LED's loop needs its cathode: the preset takes it out
    // (E4-B; before, a plug the preset did not name stayed, and the chapter cleared the bench first)
    for (const parts of [FLASH, LIMIT, OHM, loopWith('resistor-10k'), LAW, LED_LOOP.parts]) {
      bench.preset(AMP.parts, AMP.leads);
      expect(bench.state.leads.get('spk+')).toBe('c10');
      expect(() => bench.preset(parts)).not.toThrow();
      expect(bench.state.leads.size).toBe(0);
    }
  });

  it('amp: the step’s board put again («Нові деталі») brings a burnt part and a burnt speaker back whole', () => {
    const bench = mountBench(stubContext());
    bench.preset(AMP.parts, AMP.leads);
    bench.closed = 1;
    bench.update(0, 0);
    memoryOf(bench.model.state, 'SPK').burnt = true;
    memoryOf(bench.model.state, 'D1').burnt = true;
    bench.closed = 0;
    bench.update(0, 0);
    expect(bench.model.part('SPK')!.condition).toBe('burnt');
    expect(bench.model.part('D1')!.condition).toBe('burnt');
    bench.clear();
    bench.preset(AMP.parts, AMP.leads);
    bench.closed = 1;
    bench.update(0, 0);
    expect(bench.model.part('SPK')!.condition).not.toBe('burnt');
    expect(bench.model.part('D1')!.condition).not.toBe('burnt');
    expect(bench.model.reading('LED1')!.i).toBeCloseTo(0.00299416, 7);
  });

  it('amp: no two bodies in one place, no leg, jumper or plug where another part is; the plugs within their leads', () => {
    expect(hits(AMP, true)).toEqual([]);
    for (const [name, socket] of Object.entries(AMP.leads)) {
      const from = LEADS.find((l) => l.name === name)!.from;
      const s = layout.socket(socket)!;
      expect(Math.hypot(s.x - from.x, s.z - from.z), name).toBeLessThanOrEqual(LEAD.length);
    }
  });
});
