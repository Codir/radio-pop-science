/**
 * What the multimeter reads (`meter-model.ts`, docs/volumes/electronics/VISUAL.md §5.1): V across its two probes, A
 * through itself as a wire between them, Ω by its own small test current with the sources out; «—» when a probe is not
 * in a socket, «OL» when the Ω mode finds no circuit; four significant digits with a decimal comma and an SI prefix;
 * the display refreshed every `METER_REFRESH` of engine time, as a real meter's, and holding its last reading between.
 */
import { describe, expect, it } from 'vitest';
import { WIRE_OHMS } from '@electronics/sim/core';
import {
  createBoardState,
  createLayout,
  place,
  put,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
} from '@electronics/sim/board';
import { createBenchModel, type BenchModel } from '../../model';
import {
  METER_ID,
  METER_REFRESH,
  OHM_LIMIT,
  createMeterDisplay,
  formatReading,
  meterExtra,
  meterText,
  readMeter,
  type MeterMode,
  type ProbeSockets,
} from '../meter-model';

const layout = createLayout();
const NBSP = '\u00a0';
const shown = (text: string) => text.replaceAll(NBSP, ' ');

/** + rail → jumper → 3ae → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper → − rail; the battery's switch closed. */
function divider(): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
  expect(place(layout, s, { id: 'R2', spec: 'resistor-2k', anchor: 'c7', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e11', '-11'] })).toBe(true);
  setSetting(s, 'SW', 1);
  return s;
}

/** A bench with the meter in `mode`, its probes in these sockets: the driver takes the meter's own parts in. */
function bench(board: BoardState, mode: MeterMode, probes: ProbeSockets): { model: BenchModel; read: () => number | null | undefined } {
  const at = { mode, probes };
  const model = createBenchModel({ layout, board, extra: () => meterExtra(layout, at.mode, at.probes) });
  model.sync();
  return { model, read: () => readMeter(layout, model, at.mode, at.probes) };
}

const textOf = (mode: MeterMode, value: number | null | undefined) => shown(meterText(mode, value ?? null));

describe('the multimeter’s V mode', () => {
  it('reads the divider’s middle against the − rail: 5,997 V', () => {
    const { read } = bench(divider(), 'V', { red: 'a7', black: '-3' });
    const want = (9 * (2000 + WIRE_OHMS)) / (1.5 + 3 * WIRE_OHMS + 3000);
    expect(Math.abs(read()! - want)).toBeLessThanOrEqual(1e-9);
    expect(textOf('V', read())).toBe('5,997 V');
  });

  it('reads 0 with both probes in one row, and «—» with a probe out of the board', () => {
    expect(bench(divider(), 'V', { red: 'a7', black: 'e7' }).read()).toBe(0);
    expect(textOf('V', 0)).toBe('0,000 V');
    const off = bench(divider(), 'V', { red: 'a7', black: null }).read();
    expect(off).toBeNull();
    expect(textOf('V', off)).toBe('—');
    // the probes the other way round: the sign turns
    expect(textOf('V', bench(divider(), 'V', { red: '-3', black: 'a7' }).read())).toBe('−5,997 V');
  });
});

describe('the multimeter’s A mode', () => {
  it('is a wire between its probes: in the divider’s branch instead of a jumper, 9 / 3001,5 A', () => {
    const board = divider();
    // the jumper to the − rail taken out: the meter closes the branch from 11ae to the rail
    expect(seatLeg(layout, board, 'J2', 1, null)).toBe(true);
    const probes: ProbeSockets = { red: 'a11', black: '-3' };
    expect(meterExtra(layout, 'A', probes)).toEqual([
      { id: METER_ID, spec: 'jumper', pins: [layout.node('11ae'), layout.node('-')] },
    ]);
    const { read } = bench(board, 'A', probes);
    // 9 V over the battery's 1.5 Ω, the switch, one jumper, 1 kΩ, 2 kΩ and the meter itself (a wire)
    const want = 9 / (1.5 + 3 * WIRE_OHMS + 3000);
    expect(Math.abs(read()! / want - 1)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(read()! / (9 / 3001.5) - 1)).toBeLessThanOrEqual(1e-6);
    expect(textOf('A', read())).toBe('2,998 mA');
  });

  it('takes no part in the circuit in the other modes, or with a probe out', () => {
    expect(meterExtra(layout, 'V', { red: 'a11', black: '-3' })).toEqual([]);
    expect(meterExtra(layout, 'ohm', { red: 'a11', black: '-3' })).toEqual([]);
    expect(meterExtra(layout, 'A', { red: 'a11', black: null })).toEqual([]);
    expect(bench(divider(), 'A', { red: null, black: '-3' }).read()).toBeNull();
  });
});

describe('the multimeter’s Ω mode', () => {
  it('reads a lone 4,7 kΩ as 4700 Ω, two 1 kΩ side by side as 500 Ω, a gap as «OL»', () => {
    const one = createBoardState();
    expect(place(layout, one, { id: 'R1', spec: 'resistor-4k7', anchor: 'a3', o: 0 })).toBe(true);
    const r = bench(one, 'ohm', { red: 'a3', black: 'b7' }).read()!;
    expect(Math.abs(r / 4700 - 1)).toBeLessThanOrEqual(1e-6);
    expect(textOf('ohm', r)).toBe('4,700 kΩ');

    const two = createBoardState();
    expect(place(layout, two, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 })).toBe(true);
    expect(place(layout, two, { id: 'R2', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    const p = bench(two, 'ohm', { red: 'c3', black: 'c7' }).read()!;
    expect(Math.abs(p / 500 - 1)).toBeLessThanOrEqual(1e-6);
    expect(textOf('ohm', p)).toBe('500,0 Ω');

    const gap = bench(one, 'ohm', { red: 'a9', black: 'a12' }).read();
    expect(gap).toBe(Infinity);
    expect(textOf('ohm', gap)).toBe('OL');
  });

  it('measures the divider with its battery out: 2 kΩ to the − rail, the switch open', () => {
    const board = divider();
    setSetting(board, 'SW', 0);
    const r = bench(board, 'ohm', { red: 'a7', black: '-3' }).read()!;
    expect(Math.abs(r / (2000 + WIRE_OHMS) - 1)).toBeLessThanOrEqual(1e-6);
    expect(textOf('ohm', r)).toBe('2,000 kΩ');
  });

  it('says «—» on a live circuit: a closed battery or a plugged player in the probes’ island (plan E3, decision 5)', () => {
    // the divider with its switch closed: no reading, on any pair of its rows
    const live = bench(divider(), 'ohm', { red: 'a7', black: '-3' });
    expect(live.read()).toBeNull();
    expect(textOf('ohm', live.read())).toBe('—');
    expect(bench(divider(), 'ohm', { red: 'a3', black: 'a7' }).read()).toBeNull();

    // the red LED's loop of the chapter `resistor`: 330 Ω in it reads «—» while the switch is closed, 330 Ω open
    const loop = (closed: boolean): BoardState => {
      const s = createBoardState();
      expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+5', 'a5'] })).toBe(true);
      expect(place(layout, s, { id: 'R1', spec: 'resistor-330', anchor: 'b5', o: 0 })).toBe(true);
      expect(place(layout, s, { id: 'LED1', spec: 'led-red', anchor: 'c9', o: 0 })).toBe(true);
      expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e10', '-10'] })).toBe(true);
      // a lone 1 kΩ on the near half, out of the loop
      expect(place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'g2', o: 0 })).toBe(true);
      setSetting(s, 'SW', closed ? 1 : 0);
      return s;
    };
    expect(bench(loop(true), 'ohm', { red: 'a5', black: 'a9' }).read()).toBeNull();
    const off = bench(loop(false), 'ohm', { red: 'a5', black: 'a9' }).read()!;
    expect(textOf('ohm', off)).toBe('330,0 Ω');
    // the lone resistor beside the live loop: its island has no source, it reads its value
    const lone = bench(loop(true), 'ohm', { red: 'f2', black: 'f6' }).read()!;
    expect(textOf('ohm', lone)).toBe('1,000 kΩ');

    // the player's plugs in the rows of a resistor: «—»; a plug out, the resistor's value
    const played = createBoardState();
    expect(place(layout, played, { id: 'R1', spec: 'resistor-4k7', anchor: 'a3', o: 0 })).toBe(true);
    expect(seatLead(layout, played, 'pl+', 'b3')).toBe(true);
    expect(seatLead(layout, played, 'pl-', 'b7')).toBe(true);
    expect(bench(played, 'ohm', { red: 'c3', black: 'c7' }).read()).toBeNull();
    expect(seatLead(layout, played, 'pl-', null)).toBe(true);
    expect(textOf('ohm', bench(played, 'ohm', { red: 'c3', black: 'c7' }).read())).toBe('4,700 kΩ');
  });

  it('says «OL» above its top range', () => {
    expect(OHM_LIMIT).toBe(40e6);
    expect(textOf('ohm', 10e6)).toBe('10,00 MΩ');
    expect(textOf('ohm', OHM_LIMIT * 1.01)).toBe('OL');
  });
});

describe('the display', () => {
  it('formats four significant digits with a decimal comma and an SI prefix', () => {
    expect(shown(formatReading(5.997001, 'V'))).toBe('5,997 V');
    expect(shown(formatReading(4700, 'Ω'))).toBe('4,700 kΩ');
    expect(shown(formatReading(0.0029986, 'A'))).toBe('2,999 mA');
    expect(shown(formatReading(0.0001234, 'A'))).toBe('123,4 μA');
    expect(shown(formatReading(0.5, 'V'))).toBe('500,0 mV');
    // on the border of two ranges the rounding picks the range
    expect(shown(formatReading(0.99996, 'V'))).toBe('1,000 V');
    expect(shown(formatReading(999.96, 'Ω'))).toBe('1,000 kΩ');
    // below the lowest range it keeps that range's resolution; zero is plain zero
    expect(shown(formatReading(5e-6, 'V'))).toBe('0,005 mV');
    expect(shown(formatReading(0, 'A'))).toBe('0,000 A');
    expect(shown(formatReading(1e-9, 'V'))).toBe('0,000 V');
    expect(shown(formatReading(-0.0005, 'V'))).toBe('−0,500 mV');
    expect(shown(formatReading(5.9963, 'A'))).toBe('5,996 A');
    expect(meterText('off', 5)).toBe('—');
    expect(meterText('V', null)).toBe('—');
    expect(meterText('V', Number.NaN)).toBe('—');
  });

  it(`refreshes every ${METER_REFRESH} s of engine time and holds its reading between`, () => {
    expect(METER_REFRESH).toBe(0.33);
    const d = createMeterDisplay();
    expect(d.text).toBe('—');
    // the first frame reads at once
    d.update(1 / 60, 'V', 5.997);
    expect(shown(d.text)).toBe('5,997 V');
    expect(d.value).toBe(5.997);
    // the reading changes: the display holds the old one until the next refresh
    let t = 1 / 60;
    while (t + 1 / 60 < METER_REFRESH - 1e-9) {
      d.update(1 / 60, 'V', 1.5);
      t += 1 / 60;
    }
    expect(shown(d.text)).toBe('5,997 V');
    d.update(2 / 60, 'V', 1.5);
    expect(shown(d.text)).toBe('1,500 V');
    expect(d.refreshes).toBe(2);
    // a held frame (dt = 0) never refreshes
    d.update(0, 'V', 2);
    expect(shown(d.text)).toBe('1,500 V');
    // the mode turned: the new mode's reading at once
    d.update(0, 'A', 0.002);
    expect(shown(d.text)).toBe('2,000 mA');
    // the model had nothing good to give (undefined): the display keeps what it shows
    for (let k = 0; k < 40; k++) d.update(1 / 60, 'A', undefined);
    expect(shown(d.text)).toBe('2,000 mA');
    // a probe out: «—» at the next refresh
    for (let k = 0; k < 21; k++) d.update(1 / 60, 'A', null);
    expect(d.text).toBe('—');
    expect(d.value).toBeNull();
    // `now`: read at once whatever the time (a deep link)
    d.update(0, 'A', 0.001, true);
    expect(shown(d.text)).toBe('1,000 mA');
  });
});
