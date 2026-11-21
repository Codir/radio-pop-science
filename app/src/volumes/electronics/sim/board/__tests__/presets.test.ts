/**
 * The boards of the pilot chapters as data (`presets.ts`): what a step puts on the board with `bench.preset`, seated by
 * the same pure maths the bench uses (`seatPreset`). The LED's loop of the chapters `resistor` and `resistor-pick` gives
 * the numbers their scripts give; the amplifier's parts have the bench's names (`AMPLIFIER_IDS`).
 */
import { describe, expect, it } from 'vitest';
import { amplifierNetlist, solveDC } from '../../core';
import { footprintOf } from '../footprint';
import { createLayout } from '../layout';
import { BENCH_FIXED, netlistOf, type BoardNet } from '../netlist';
import {
  AMPLIFIER_IDS,
  LED_LOOP,
  presetState,
  seatPreset,
  spans,
  type BoardPreset,
  type PresetPart,
} from '../presets';
import { createBoardState, setSetting } from '../seat';

const layout = createLayout();

/** The board of a preset with the battery's switch closed, as a step that closes it. */
function closed(preset: BoardPreset, parts: readonly PresetPart[] = preset.parts): BoardNet {
  const s = presetState(layout, { parts, leads: preset.leads });
  setSetting(s, 'SW', 1);
  return netlistOf(layout, s);
}

describe('a preset on the board', () => {
  it('seats every part where it says — `at` and `o`, or `to` within the part’s reach — and every plug', () => {
    const s = presetState(layout, {
      parts: [
        { id: 'R1', spec: 'resistor-1k', at: 'a3' },
        { id: 'J1', spec: 'jumper', at: '+3', to: 'b3' },
        { id: 'LED1', spec: 'led-red', at: 'e7', o: 1 },
        { id: 'P1', spec: 'pot-10k', at: 'h2', setting: 0.2 },
      ],
      leads: { 'spk+': 'c17' },
    });
    expect(s.parts.get('R1')!.legs).toEqual(['a3', 'a7']);
    expect(s.parts.get('J1')!.legs).toEqual(['+3', 'b3']);
    expect(s.parts.get('LED1')!.legs).toEqual(['e7', 'f7']);
    expect(s.parts.get('P1')!.legs).toEqual(['h2', 'h4', 'h6']);
    expect(s.settings.get('P1')).toBe(0.2);
    expect(s.leads.get('spk+')).toBe('c17');
    // the ids of the preset are taken: the hand's next jumper is J2
    expect(s.serial.get('J')).toBe(1);
  });

  it('refuses what does not stand: a leg off the board, a taken socket, a span out of reach, an unknown plug', () => {
    const fails = (parts: PresetPart[], leads: Record<string, string> = {}) => () =>
      seatPreset(layout, createBoardState(), parts, leads);
    expect(fails([{ id: 'R1', spec: 'resistor-1k', at: 'a15' }])).toThrow(RangeError); // a19 is off the board
    expect(
      fails([
        { id: 'R1', spec: 'resistor-1k', at: 'a3' },
        { id: 'R2', spec: 'resistor-1k', at: 'a7' }, // a7 is R1's leg 1
      ]),
    ).toThrow(RangeError);
    expect(fails([{ id: 'R1', spec: 'resistor-1k', at: 'a3', to: 'a5' }])).toThrow(RangeError); // 2 P: under 4
    expect(fails([{ id: 'J1', spec: 'jumper', at: 'a3', to: 'a3' }])).toThrow(RangeError);
    expect(fails([], { 'spk+': 'z9' })).toThrow(RangeError);
    // the span is measured on the board: across the channel e → f is 0.6, two grid steps
    expect(spans(layout, 'resistor-1k', 'd5', 'f5')).toBe(false); // 3 P
    expect(spans(layout, 'resistor-1k', 'c5', 'f5')).toBe(true); // 4 P
    expect(spans(layout, 'led-red', 'c9', 'c10')).toBe(true);
    expect(spans(layout, 'pot-10k', 'a1', 'a5')).toBe(false); // three legs: no span of its own
  });
});

describe('the amplifier’s ids on the bench (AMPLIFIER_IDS)', () => {
  it('names every part of the amplifier as the bench does: its fixed parts, or the footprint’s letters and a number', () => {
    const fixed = new Set(BENCH_FIXED.map((f) => f.id));
    const board = new Set<string>();
    for (const p of amplifierNetlist({ source: 'player' }).parts) {
      const id = AMPLIFIER_IDS[p.id] ?? p.id;
      expect(board.has(id), id).toBe(false);
      board.add(id);
      if (fixed.has(id)) {
        // the same kind of thing as the bench's own
        expect(BENCH_FIXED.find((f) => f.id === id)!.spec.split('-')[0], p.id).toBe(p.spec.split('-')[0]);
        continue;
      }
      const fp = footprintOf(p.spec);
      expect(fp, p.id).not.toBeNull();
      expect(id, p.id).toMatch(new RegExp(`^${fp!.prefix}\\d+$`));
    }
    // the battery, the switch, the player and the speaker are the bench's; the volume control is a pot on the board
    expect(AMPLIFIER_IDS).toEqual({ B1: 'BAT', S1: 'SW', PL: 'PLAYER', LS1: 'SPK', VR1: 'P1' });
  });
});

describe('the LED’s loop of the chapters `resistor` and `resistor-pick` (LED_LOOP)', () => {
  it('is + rail → J1 → 5ae → 330 Ω → 9ae → the red LED → 10ae → J2 → − rail, the numbers of the scripts', () => {
    const s = presetState(layout, LED_LOOP);
    expect(Object.fromEntries([...s.parts].map(([id, p]) => [id, p.legs]))).toEqual({
      J1: ['+5', 'a5'],
      R1: ['b5', 'b9'],
      LED1: ['c9', 'c10'],
      J2: ['e10', '-10'],
    });
    const sol = solveDC(closed(LED_LOOP).net);
    expect(sol.ok).toBe(true);
    // docs/volumes/electronics/chapters/resistor.md, `limit` and `share`: 21.2351 mA, 1.96049 V on the LED,
    // 7.00759 V and 0.14881 W on the resistor, 8.96813 V between the rails
    expect(sol.parts.LED1!.i).toBeCloseTo(0.0212351, 7);
    expect(sol.parts.LED1!.u).toBeCloseTo(1.96049, 5);
    expect(sol.parts.R1!.u).toBeCloseTo(7.00759, 5);
    expect(sol.parts.R1!.p).toBeCloseTo(0.14881, 5);
    expect(sol.v[layout.node('+')]! - sol.v[layout.node('-')]!).toBeCloseTo(8.96813, 5);
  });

  it('with a 10 kΩ in the 330 Ω’s sockets gives the 0.7336 mA of `resistor/inside`', () => {
    const parts = LED_LOOP.parts.map((p) => (p.id === 'R1' ? { ...p, spec: 'resistor-10k' } : p));
    const sol = solveDC(closed(LED_LOOP, parts).net);
    expect(sol.parts.LED1!.i).toBeCloseTo(0.0007336, 7);
  });
});
