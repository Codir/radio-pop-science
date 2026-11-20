/**
 * How each kind of part stands in the sockets (docs/volumes/electronics/VISUAL.md §4, «Відбитки», and §4.7 for the
 * transistors): its legs in grid steps, the catalog pin in every leg, how far one leg may move, the letters of its id.
 */
import { describe, expect, it } from 'vitest';
import { PARTS } from '../../core';
import { footprintOf, legSockets, type Footprint } from '../footprint';
import { createLayout } from '../layout';
import { netlistOf } from '../netlist';
import { createBoardState, place, seatLeg } from '../seat';

const layout = createLayout();

const footprint = (
  shape: Footprint['shape'],
  offsets: [number, number][],
  span: [number, number] | null,
  prefix: string,
  pins = offsets.map((_, k) => k),
): Footprint => ({ shape, offsets, pins, span, prefix });

describe('the footprint of every kind (VISUAL.md §4)', () => {
  it('gives the legs, the reach of one leg and the letters of the id as the table says', () => {
    const AXIAL: [number, number][] = [
      [0, 0],
      [4, 0],
    ];
    const NEXT: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const TWO: [number, number][] = [
      [0, 0],
      [2, 0],
    ];
    const lead = footprint('lead', [], null, '', [0, 1]);
    const want: Record<string, Footprint> = {
      'resistor-4k7': footprint('axial', AXIAL, [4, 6], 'R'),
      'resistor-1': footprint('axial', AXIAL, [4, 6], 'R'),
      'diode-1n4148': footprint('axial', AXIAL, [4, 6], 'D'),
      'diode-1n4007': footprint('axial', AXIAL, [4, 6], 'D'),
      'led-red': footprint('radial', NEXT, [1, 3], 'LED'),
      'led-white': footprint('radial', NEXT, [1, 3], 'LED'),
      'ceramic-100n': footprint('radial', TWO, [1, 3], 'C'),
      'film-100n': footprint('radial', TWO, [1, 3], 'C'),
      'electrolytic-470u-16v': footprint('radial', NEXT, [1, 3], 'C'),
      'pot-10k': footprint(
        'pot',
        [
          [0, 0],
          [2, 0],
          [4, 0],
        ],
        null,
        'P',
      ),
      jumper: footprint('wire', AXIAL, [1, 16], 'J'),
      'speaker-8': lead,
      'earphone-32': lead,
      'lamp-6v': lead,
      player: lead,
    };
    for (const [key, fp] of Object.entries(want)) expect(footprintOf(key), key).toEqual(fp);
  });

  it('gives null to what does not stand in sockets and to what the catalog does not have', () => {
    for (const key of [
      'battery-9v',
      'battery-4aa',
      'battery-aa',
      'switch',
      'ideal-9v',
      'ideal-5v',
      'player-tone',
    ])
      expect(footprintOf(key), key).toBeNull();
    for (const key of ['no-such-part', '', 'resistor', 'transistor-bc548', 'toString', '__proto__'])
      expect(footprintOf(key), key).toBeNull();
  });

  it('is whole for every key of the catalog that has one: each catalog pin in exactly one leg', () => {
    // the battery and its switch are fixed to the rails; the ideal sources (direct and sine) are the model's references
    const NONE: readonly string[] = ['battery', 'switch', 'source', 'sine'];
    let placeable = 0;
    for (const [key, spec] of Object.entries(PARTS)) {
      const fp = footprintOf(key);
      if (NONE.includes(spec.kind)) {
        expect(fp, key).toBeNull();
        continue;
      }
      expect(fp, key).not.toBeNull();
      expect([...fp!.pins].sort(), key).toEqual(spec.pins.map((_, i) => i));
      if (fp!.shape === 'lead') {
        expect(fp!.offsets, key).toEqual([]);
        continue;
      }
      placeable++;
      expect(fp!.offsets, key).toHaveLength(spec.pins.length);
      expect(fp!.offsets[0], key).toEqual([0, 0]);
      expect(new Set(fp!.offsets.map(String)).size, key).toBe(fp!.offsets.length);
      expect(fp!.prefix, key).toMatch(/^[A-Z]+$/);
    }
    expect(placeable).toBeGreaterThan(170); // the resistors alone are 169
  });

  it('turns the legs by quarter turns in the grid', () => {
    const pot = footprintOf('pot-10k')!;
    const at = (anchor: string, o: 0 | 1 | 2 | 3) =>
      legSockets(layout, pot, layout.socket(anchor)!, o).map((s) => s?.id ?? null);
    expect(at('c5', 0)).toEqual(['c5', 'c7', 'c9']);
    expect(at('a5', 1)).toEqual(['a5', 'c5', 'e5']);
    expect(at('c9', 2)).toEqual(['c9', 'c7', 'c5']);
    expect(at('e5', 3)).toEqual(['e5', 'c5', 'a5']);
    expect(at('c16', 0)).toEqual(['c16', null, null]);
    expect(at('i5', 1)).toEqual(['i5', '-5', null]);
  });
});

describe('transistors in TO-92 (VISUAL.md §4.7)', () => {
  /** The pin of every leg with the flat side toward the reader, legs down, leg 0 the leftmost: the makers' drawings. */
  const PINOUT: Record<string, readonly string[]> = {
    'transistor-bc547b': ['collector', 'base', 'emitter'],
    'transistor-bc557b': ['collector', 'base', 'emitter'],
    'transistor-2n3904': ['emitter', 'base', 'collector'],
    'transistor-2n3906': ['emitter', 'base', 'collector'],
    'transistor-bc337-25': ['collector', 'base', 'emitter'],
    'transistor-bc327-25': ['collector', 'base', 'emitter'],
  };

  it('knows the pinout of every transistor of the catalog', () => {
    const transistors = Object.entries(PARTS).filter(([, spec]) => spec.kind === 'transistor');
    expect(transistors.map(([key]) => key).sort()).toEqual(Object.keys(PINOUT).sort());
    for (const [key] of transistors) {
      const fp = footprintOf(key)!;
      expect(fp.shape, key).toBe('to92');
      expect(fp.offsets, key).toEqual([
        [0, 0],
        [1, 0],
        [2, 0],
      ]);
      expect(fp.span, key).toBeNull();
      expect(fp.prefix, key).toBe('Q');
    }
  });

  it('puts leg k at o 0 in the column anchor + k, and the node of that row gets the pin of the table', () => {
    for (const [key, legs] of Object.entries(PINOUT)) {
      const s = createBoardState();
      expect(place(layout, s, { id: 'Q1', spec: key, anchor: 'a5', o: 0 }), key).toBe(true);
      expect(s.parts.get('Q1')!.legs).toEqual(['a5', 'a6', 'a7']);
      const q = netlistOf(layout, s).net.parts.find((p) => p.id === 'Q1')!;
      const names = PARTS[key]!.pins as readonly string[];
      legs.forEach((name, k) =>
        expect(q.pins[names.indexOf(name)], `${key} ${name}`).toBe(layout.node(`${5 + k}ae`)),
      );
    }
  });

  it('turned end for end (o 2), the flat side looks away and the pins swap columns with it', () => {
    const s = createBoardState();
    place(layout, s, { id: 'Q1', spec: 'transistor-2n3904', anchor: 'a7', o: 2 });
    expect(s.parts.get('Q1')!.legs).toEqual(['a7', 'a6', 'a5']);
    const q = netlistOf(layout, s).net.parts.find((p) => p.id === 'Q1')!;
    // collector, base, emitter: the emitter (leg 0) in column 7, the collector (leg 2) in column 5
    expect(q.pins).toEqual([layout.node('5ae'), layout.node('6ae'), layout.node('7ae')]);
  });

  it('moves the three legs only together', () => {
    const s = createBoardState();
    place(layout, s, { id: 'Q1', spec: 'transistor-bc547b', anchor: 'f5', o: 0 });
    expect(seatLeg(layout, s, 'Q1', 2, null)).toBe(false);
    expect(seatLeg(layout, s, 'Q1', 2, 'f8')).toBe(false);
    expect(s.parts.get('Q1')!.legs).toEqual(['f5', 'f6', 'f7']);
  });
});

describe('polar parts keep the order of the catalog in their legs', () => {
  it('an electrolytic: leg 0 is plus; an LED and a diode: leg 0 the anode, leg 1 the cathode', () => {
    const s = createBoardState();
    place(layout, s, { id: 'C1', spec: 'electrolytic-470u-16v', anchor: 'a3', o: 0 });
    place(layout, s, { id: 'LED1', spec: 'led-red', anchor: 'b9', o: 2 });
    place(layout, s, { id: 'D1', spec: 'diode-1n4007', anchor: 'f3', o: 0 });
    const parts = netlistOf(layout, s).net.parts;
    const pins = (id: string) => parts.find((p) => p.id === id)!.pins;
    expect(pins('C1')).toEqual([layout.node('3ae'), layout.node('4ae')]); // plus, minus
    expect(pins('LED1')).toEqual([layout.node('9ae'), layout.node('8ae')]); // anode, cathode
    expect(pins('D1')).toEqual([layout.node('3fj'), layout.node('7fj')]);
  });
});
