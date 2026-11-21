/**
 * The chapter's board (`parts/boards.ts`: the prologue's amplifier) as the bench's model solves it, and the windows of
 * the goals around the model's numbers (the script's «Ціль», `docs/volumes/electronics/chapters/meter.md`): the rails'
 * voltage on «V» both ways, all the amplifier's current through the meter in the supply jumper's gap, the honest short
 * across the rails, the rail behind the switch with the scope's input of 1 MΩ — at rest at 0 V, a step to 8,98 V that
 * settles within 0,5 s and lies flat, and back to the diode's leak when the switch opens —, the player's row as the
 * scope sees it and as the multimeter does, and every probe socket the steps put free of what stands there.
 */
import { describe, expect, it } from 'vitest';
import {
  createLayout,
  occupant,
  presetState,
  remove,
  setSetting,
  type BoardState,
} from '@electronics/sim/board';
import { Transient, createModelState, type PartInstance } from '@electronics/sim/core';
import { createBenchModel, type BenchModel } from '@electronics/shared/model';
import {
  METER_ID,
  SCOPE_INPUT,
  formatReading,
  meterExtra,
  type MeterMode,
  type ProbeSockets,
} from '@electronics/shared/instruments';
import { AMP, KNOB, NOTES_SCOPE, PLAYING, ROWS, SUPPLY, TWICE_MARKS, WAVE_METER, WINDOWS } from '../parts/boards';
import { waveVerdict } from '../parts/goals';

const layout = createLayout();
const FS = 24000;
const amp = (): BoardState => presetState(layout, AMP);
const node = (row: string): number => layout.node(row);
/** The scope's input on a row, as the bench puts it in the circuit (`SCOPE_INPUT`). */
const scopeOn = (row: string, c = 0): PartInstance => ({ id: SCOPE_INPUT.ids[c]!, spec: SCOPE_INPUT.spec, pins: [node(row), 0] });

/** The bench's model on a board, the switch and the player as given, the meter and the scope's inputs as given. */
function solve(
  s: BoardState,
  opts: { closed?: number; player?: number; meter?: { mode: MeterMode; probes: ProbeSockets }; scope?: PartInstance[] } = {},
): BenchModel {
  setSetting(s, 'SW', opts.closed ?? 1);
  setSetting(s, 'PLAYER', opts.player ?? 0);
  const model = createBenchModel({
    layout,
    board: s,
    extra: () => [...(opts.meter ? meterExtra(layout, opts.meter.mode, opts.meter.probes) : []), ...(opts.scope ?? [])],
  });
  model.sync();
  expect(model.ok).toBe(true);
  return model;
}

const inside = (v: number | null | undefined, [lo, hi]: readonly [number, number]): boolean =>
  typeof v === 'number' && v >= lo && v <= hi;

describe('the chapter’s board in the model', () => {
  it('the board is the prologue’s amplifier, its supply jumper J10 from +1 to D1’s anode row', () => {
    const s = amp();
    expect(s.parts.get(SUPPLY)?.legs).toEqual(['+1', 'a1']);
    expect(s.parts.get('D1')?.legs[0]).toBe('b1');
    // nothing else of the amplifier takes the + rail
    const plus = [...s.parts.values()].filter((p) => p.legs.some((l) => l !== null && layout.socket(l)?.row === '+'));
    expect(plus.map((p) => p.id)).toEqual([SUPPLY]);
    expect(s.settings.get('P1')).toBe(KNOB);
    expect(PLAYING).toBe(0.3);
  });

  it('volts: the rails 8,980 V on «V» with the amplifier quiet (8,98002 V), minus that the other way round', () => {
    const model = solve(amp());
    const v = model.rowVolts('+')! - model.rowVolts('-')!;
    expect(v).toBeCloseTo(8.98002, 4);
    expect(inside(v, WINDOWS.volts)).toBe(true);
    expect(formatReading(v, 'V').replace('\u00a0', ' ')).toBe('8,980 V');
    expect(formatReading(-v, 'V').replace('\u00a0', ' ')).toBe('−8,980 V');
    expect(model.reading('BAT')!.i).toBeCloseTo(-0.0133122, 6);
  });

  it('amps: without J10 the meter on «A» in its rows carries all the amplifier’s 13,31 mA, as the battery does', () => {
    const s = amp();
    remove(s, SUPPLY);
    const open = solve(s);
    expect(Math.abs(open.reading('BAT')!.i)).toBeLessThan(1e-9);
    expect(open.reading('LED1')!.i).toBeLessThan(1e-9);
    for (const probes of [
      { red: '+2', black: 'c1' },
      { red: 'd1', black: '+9' },
    ] as ProbeSockets[]) {
      // J10 still in its place: the meter beside it takes about half
      const beside = solve(amp(), { meter: { mode: 'A', probes } });
      expect(Math.abs(beside.reading(METER_ID)!.i)).toBeCloseTo(0.0133122 / 2, 4);
      // J10 out: the meter in its gap
      const t = amp();
      remove(t, SUPPLY);
      const m = solve(t, { meter: { mode: 'A', probes } });
      const i = m.reading(METER_ID)!.i;
      const bat = m.reading('BAT')!.i;
      expect(Math.abs(i)).toBeCloseTo(0.0133122, 6);
      expect(inside(Math.abs(i), WINDOWS.amps)).toBe(true);
      expect(Math.abs(Math.abs(i) / Math.abs(bat) - 1)).toBeLessThan(WINDOWS.same);
      expect(m.reading('LED1')!.i).toBeCloseTo(0.002994, 5);
    }
  });

  it('amps: the meter on «A» across the rails is an honest short — 5,992 A, the battery warms and never burns', () => {
    const model = solve(amp(), { meter: { mode: 'A', probes: { red: '+5', black: '-9' } } });
    expect(Math.abs(model.reading(METER_ID)!.i)).toBeCloseTo(9 / (1.5 + 0.001 + 0.001), 2);
    expect(model.part('BAT')!.condition).toBe('hot');
    for (let k = 0; k < 5 * 60; k++) model.advance(1 / 60);
    expect(model.part('BAT')!.condition).not.toBe('burnt');
    expect(Object.values(model.solution!.status).some((x) => x.condition === 'burnt')).toBe(false);
  });

  it('amps: «A» from the supply after D1 to the − rail burns D1 — what «Нові деталі» is for', () => {
    const model = solve(amp(), { meter: { mode: 'A', probes: { red: 'c5', black: '-9' } } });
    let frames = 0;
    while (model.part('D1')!.condition !== 'burnt' && frames < 600) {
      model.advance(1 / 60);
      frames++;
    }
    expect(model.part('D1')!.condition).toBe('burnt');
    expect(frames / 60).toBeLessThan(3);
  });

  it('flat: behind the open switch the rail lies at 0 V; closed, 8,98001 V with the scope’s 1 MΩ on it', () => {
    const open = solve(amp(), { closed: 0, scope: [scopeOn('+')] });
    expect(Math.abs(open.rowVolts('+')!)).toBeLessThan(1e-9);
    const closed = solve(amp(), { closed: 1, scope: [scopeOn('+')] });
    expect(closed.rowVolts('+')!).toBeCloseTo(8.98001, 4);
    expect(inside(closed.rowVolts('+'), WINDOWS.flat)).toBe(true);
    expect(closed.reading('SCOPE1')!.i).toBeCloseTo(8.98001e-6, 9);
  });

  it('flat: in time the closing lifts the rail to 8,98 V within 0,5 s, flat for 2 s; opened, the diode’s leak at once', () => {
    const model = solve(amp(), { closed: 0, scope: [scopeOn('+')] });
    const t = new Transient(structuredClone(model.net!.net), { dt: 1 / FS, state: createModelState(), fails: false });
    expect(t.start('dc')).toBe(true);
    const rail = (seconds: number) => {
      const out = new Float32Array(Math.round(seconds * FS));
      expect(t.run(out.length, [{ node: node('+'), out }])).toBe(out.length);
      return out;
    };
    const before = rail(0.5);
    expect(Math.max(...before.map(Math.abs))).toBeLessThan(1e-6);
    t.set('SW', 1);
    const settle = rail(0.5);
    expect(settle[0]!).toBeLessThan(5);
    const flat = rail(2);
    expect(Math.min(...flat)).toBeGreaterThanOrEqual(WINDOWS.flat[0]);
    expect(Math.max(...flat)).toBeLessThanOrEqual(WINDOWS.flat[1]);
    t.set('SW', 0);
    const opened = rail(0.05);
    // the 1 MΩ of the scope's input against the diode's reverse leak: 0,014 V from the first sample on
    expect(opened[0]!).toBeLessThan(0.02);
    expect(Math.max(...opened)).toBeLessThan(0.02);
  });

  it('wave: the player’s row on the scope — within ±0,35 V, every 2 s of 3 reaching 0,2 V; the meter there under 1 mV', () => {
    const model = solve(amp(), { closed: 1, player: PLAYING, scope: [scopeOn(ROWS.player)] });
    expect(Math.abs(model.rowVolts(ROWS.player)!)).toBeLessThan(WINDOWS.wave.meter);
    const t = new Transient(structuredClone(model.net!.net), { dt: 1 / FS, state: createModelState(), fails: false });
    expect(t.start('dc')).toBe(true);
    const out = new Float32Array(4 * FS);
    expect(t.run(out.length, [{ node: node(ROWS.player), out }])).toBe(out.length);
    // the run from 1 s to 4 s, frame by frame as the step reads it (the crest of the last 2 s, the whole run so far)
    const crestOf = (a: number, b: number) => Math.max(...out.subarray(Math.round(a * FS), Math.round(b * FS)).map(Math.abs));
    let verdict = 'go';
    for (let held = 1 / 60; held <= 3 + 1e-9 && verdict === 'go'; held += 1 / 60) {
      const now = 1 + held;
      verdict = waveVerdict(held, crestOf(Math.max(1, now - 2), now), crestOf(1, now), {
        need: 3,
        window: 2,
        crest: WINDOWS.wave.crest,
        edge: WINDOWS.wave.edge,
      });
    }
    expect(verdict).toBe('done');
  });

  it('the sockets the steps put probes in and mark are free of legs and plugs, in the rows the goals read', () => {
    const s = amp();
    const rowOf = (id: string) => layout.socket(id)!.row;
    for (const id of [WAVE_METER.red, NOTES_SCOPE, TWICE_MARKS.input, TWICE_MARKS.speaker]) expect(occupant(s, id)).toBeNull();
    expect(occupant(s, WAVE_METER.black)).toBeNull();
    expect(rowOf(WAVE_METER.red)).toBe(ROWS.player);
    expect(rowOf(WAVE_METER.black)).toBe(ROWS.minus);
    expect(rowOf(NOTES_SCOPE)).toBe(ROWS.player);
    expect(rowOf(TWICE_MARKS.input)).toBe(ROWS.input);
    expect(rowOf(TWICE_MARKS.speaker)).toBe(ROWS.speaker);
    // the rows are what the script says: the player's plug, the volume control's wiper, the speaker's plug
    expect(rowOf(AMP.leads['pl+']!)).toBe(ROWS.player);
    expect(rowOf(AMP.leads['spk+']!)).toBe(ROWS.speaker);
    expect(rowOf(s.parts.get('P1')!.legs[1]!)).toBe(ROWS.input);
  });
});
