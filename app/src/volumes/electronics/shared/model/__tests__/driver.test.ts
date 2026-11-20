/**
 * The bench's model driver (`driver.ts`): the one place the bench calls the circuit model. It reads the board's
 * netlist at every sync, compiles only when the circuit's shape (`key`) changed, writes a changed setting into the
 * compiled parts and solves again, keeps one `ModelState` for the life of the bench, forgets the memory of a part that
 * left the board for good (sim/core/README.md, «The state») or whose id a new part takes (`forget`, a step's preset),
 * and on a failed solve keeps the last good one.
 */
import { describe, expect, it } from 'vitest';
import { WIRE_OHMS, memoryOf } from '@electronics/sim/core';
import {
  createBoardState,
  createLayout,
  place,
  put,
  remove,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
  type FixedPart,
} from '@electronics/sim/board';
import { createBenchModel } from '../driver';

const layout = createLayout();
const node = (row: string) => layout.node(row);

/** + rail → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper → − rail; the battery's switch `closed`. */
function divider(closed: boolean): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
  expect(place(layout, s, { id: 'R2', spec: 'resistor-2k', anchor: 'c7', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e11', '-11'] })).toBe(true);
  setSetting(s, 'SW', closed ? 1 : 0);
  return s;
}

/** The middle of the divider: 9 V over the battery's 1.5 Ω, the switch, two jumpers, 1 kΩ and 2 kΩ. */
const MIDDLE = (9 * (2000 + WIRE_OHMS)) / (1.5 + 3 * WIRE_OHMS + 3000);

describe('the bench’s model driver', () => {
  it('solves the board: the divider’s middle at 5.997 V, read by row and by part', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.ok).toBe(true);
    expect(model.failure).toBeNull();
    expect(model.compiles).toBe(1);
    expect(model.version).toBe(1);
    expect(Math.abs(model.rowVolts('7ae')! - MIDDLE)).toBeLessThanOrEqual(1e-9);
    expect(model.rowVolts('7ae')).toBeCloseTo(5.997, 3);
    expect(model.nodeVolts(node('7ae'))).toBe(model.rowVolts('7ae'));
    expect(model.reading('R1')!.i).toBeCloseTo(9 / 3001.503, 12);
    expect(model.reading('nothing')).toBeNull();
    expect(model.rowVolts('18ae')).toBeNull();
    // nothing changed: no solve, the same solution
    const solved = model.solution;
    model.sync();
    expect(model.version).toBe(1);
    expect(model.solution).toBe(solved);
  });

  it('a changed setting only solves again: the same compiled circuit', () => {
    const board = divider(false);
    const model = createBenchModel({ layout, board });
    model.sync();
    const circuit = model.circuit;
    expect(circuit).not.toBeNull();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    // the battery's switch closes: a setting, not a new shape
    setSetting(board, 'SW', 1);
    model.sync();
    expect(model.circuit).toBe(circuit);
    expect(model.compiles).toBe(1);
    expect(model.version).toBe(2);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    // the compiled part follows the board's setting (sim/core: a compiled circuit reads its parts' settings live)
    expect(circuit!.net.parts.find((p) => p.id === 'SW')!.setting).toBe(1);
    // back open: the same circuit again, no current
    setSetting(board, 'SW', 0);
    model.sync();
    expect(model.circuit).toBe(circuit);
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-12);
  });

  it('a new shape compiles again; a leg moved within its row does not', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    const first = model.circuit;
    // R2's far leg from c11 to d11: the same row 11ae — the same shape
    expect(seatLeg(layout, board, 'R2', 1, 'd11')).toBe(true);
    model.sync();
    expect(model.circuit).toBe(first);
    expect(model.compiles).toBe(1);
    // to c12: another row, the divider broken — a new circuit
    expect(seatLeg(layout, board, 'R2', 1, 'c12')).toBe(true);
    model.sync();
    expect(model.circuit).not.toBe(first);
    expect(model.compiles).toBe(2);
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-9);
  });

  it('leaves out a part with a leg in the air (pending), and takes it back when the leg is in again', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(seatLeg(layout, board, 'R1', 1, null)).toBe(true);
    model.sync();
    expect(model.net!.pending).toEqual(['R1']);
    expect(model.circuit!.net.parts.map((p) => p.id)).not.toContain('R1');
    expect(model.reading('R1')).toBeNull();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    expect(seatLeg(layout, board, 'R1', 1, 'b7')).toBe(true);
    model.sync();
    expect(model.net!.pending).toEqual([]);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
  });

  it('keeps one ModelState through every new circuit', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    const state = model.state;
    memoryOf(state, 'R2').heat = 0.4;
    expect(seatLeg(layout, board, 'R2', 1, 'c12')).toBe(true);
    model.sync();
    expect(model.compiles).toBe(2);
    expect(model.state).toBe(state);
    expect(state.parts.get('R2')!.heat).toBe(0.4);
  });

  it('forgets the memory of a part that left the board for good, not of one in the hand', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    memoryOf(model.state, 'R1').burnt = true;
    memoryOf(model.state, 'BAT').heat = 0.3;
    model.sync();
    // in the hand: on the bench with every leg in the air (out of the circuit, not pending) — it stays burnt
    expect(put(layout, board, { id: 'R1', spec: 'resistor-1k', legs: [null, null] })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    // put back: still burnt — a gap
    expect(put(layout, board, { id: 'R1', spec: 'resistor-1k', legs: ['b3', 'b7'] })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    expect(Math.abs(model.reading('R1')!.i)).toBe(0);
    // into the tray for good: its entry is deleted (sim/core/README.md, «The state»); the fixed parts keep theirs
    remove(board, 'R1');
    model.sync();
    expect(model.state.parts.has('R1')).toBe(false);
    expect(model.state.parts.get('BAT')?.heat).toBe(0.3);
    // a new part in its place has a new id and is whole
    expect(place(layout, board, { id: 'R3', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R3')?.burnt ?? false).toBe(false);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
  });

  it('forgets a part on demand when its id is given to a new one (a step’s preset), and solves again', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    // R1 burns: a gap from the next solve on (the switch flipped twice solves twice)
    memoryOf(model.state, 'R1').burnt = true;
    memoryOf(model.state, 'R1').heat = 1;
    setSetting(board, 'SW', 0);
    model.sync();
    setSetting(board, 'SW', 1);
    model.sync();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    // a new R1 in the old one's place before any sync, as a preset puts it: the board alone cannot tell the two apart
    remove(board, 'R1');
    expect(place(layout, board, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    // the one who put it says so: the entry goes at once, and the same circuit is solved again with the part whole
    const { version, compiles } = model;
    model.forget('R1');
    expect(model.state.parts.has('R1')).toBe(false);
    model.sync();
    expect(model.compiles).toBe(compiles);
    expect(model.version).toBe(version + 1);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    expect(model.state.parts.get('R1')?.burnt ?? false).toBe(false);
    // forgetting what the model does not remember changes nothing: no solve
    model.forget('R9');
    model.sync();
    expect(model.version).toBe(version + 1);
  });

  it('takes the parts the bench adds off the board (the meter in the A mode) at every sync', () => {
    const board = divider(true);
    // the meter between 11ae and the − rail instead of the jumper J2
    expect(seatLeg(layout, board, 'J2', 1, null)).toBe(true);
    let meter = false;
    const model = createBenchModel({
      layout,
      board,
      extra: () => (meter ? [{ id: 'METER', spec: 'jumper', pins: [node('11ae'), 0] }] : []),
    });
    model.sync();
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-9);
    meter = true;
    model.sync();
    expect(model.compiles).toBe(2);
    expect(model.reading('METER')!.i).toBeCloseTo(9 / (1.5 + 3 * WIRE_OHMS + 3000), 12);
    memoryOf(model.state, 'METER');
    meter = false;
    model.sync();
    expect(model.reading('METER')).toBeNull();
    expect(model.state.parts.has('METER')).toBe(false);
  });

  it('times every solve (dcMs) by its clock', () => {
    let t = 10;
    const board = divider(true);
    const model = createBenchModel({ layout, board, now: () => (t += 0.25) });
    expect(model.dcMs).toBe(0);
    model.sync();
    expect(model.dcMs).toBeCloseTo(0.25, 12);
    // no solve, no new time
    model.sync();
    expect(model.dcMs).toBeCloseTo(0.25, 12);
  });

  it('a failed solve keeps the last good one and says so; never a NaN', () => {
    const board = divider(true);
    // two ideal sources side by side make the matrix singular (the bench never offers them: a test's fixed parts)
    const fixed: FixedPart[] = [
      { id: 'S1', spec: 'ideal-9v', pins: [{ row: '+' }, { row: '-' }] },
      { id: 'S2', spec: 'ideal-5v', pins: [{ lead: 'b+' }, { row: '-' }] },
    ];
    const model = createBenchModel({ layout, board, fixed });
    model.sync();
    expect(model.ok).toBe(true);
    const good = model.solution;
    expect(model.rowVolts('7ae')).toBeCloseTo((9 * (2000 + WIRE_OHMS)) / (3000 + 2 * WIRE_OHMS), 9);
    expect(seatLead(layout, board, 'b+', '+9')).toBe(true);
    model.sync();
    expect(model.ok).toBe(false);
    expect(model.failure).toBe('singular');
    expect(model.solution).toBe(good);
    // the bench shows nothing new: no reading, no voltage of the failed circuit
    expect(model.reading('R1')).toBeNull();
    expect(model.rowVolts('7ae')).toBeNull();
    // the board fixed again: good again
    expect(seatLead(layout, board, 'b+', null)).toBe(true);
    model.sync();
    expect(model.ok).toBe(true);
    expect(Number.isNaN(model.rowVolts('7ae')!)).toBe(false);
  });
});

describe('the ohmmeter’s own solve', () => {
  it('measures between two nodes with the sources out: a lone 4.7 kΩ, two 1 kΩ side by side, nothing', () => {
    const board = createBoardState();
    expect(place(layout, board, { id: 'R1', spec: 'resistor-4k7', anchor: 'a3', o: 0 })).toBe(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(Math.abs(model.ohms(node('3ae'), node('7ae'))! / 4700 - 1)).toBeLessThanOrEqual(1e-6);
    // the same row: zero
    expect(model.ohms(node('3ae'), node('3ae'))).toBe(0);
    // two rows with nothing between them: no current, an infinite resistance
    expect(model.ohms(node('9ae'), node('12ae'))).toBe(Infinity);
    // two 1 kΩ side by side
    remove(board, 'R1');
    expect(place(layout, board, { id: 'R2', spec: 'resistor-1k', anchor: 'a3', o: 0 })).toBe(true);
    expect(place(layout, board, { id: 'R3', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(Math.abs(model.ohms(node('3ae'), node('7ae'))! / 500 - 1)).toBeLessThanOrEqual(1e-6);
  });

  it('does not see the battery, and sees a burnt part as a gap', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    // across 2 kΩ with the battery out: R1's far end goes only to the battery's switch, which now leads nowhere
    expect(Math.abs(model.ohms(node('7ae'), 0)! / (2000 + WIRE_OHMS) - 1)).toBeLessThanOrEqual(1e-6);
    // the bench's own solve is untouched by it
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    memoryOf(model.state, 'R2').burnt = true;
    setSetting(board, 'SW', 0);
    model.sync();
    expect(model.ohms(node('7ae'), 0)).toBe(Infinity);
    expect(model.state.parts.get('R2')!.burnt).toBe(true);
  });
});
