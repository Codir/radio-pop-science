/**
 * The tray of parts on the table (docs/volumes/electronics/VISUAL.md §6, «Лоток»): two rows of six slots — the low
 * parts in front, the tall and wide ones a step higher behind, the row chosen from the part's size; one slot holds one
 * kind with a supply that never ends; a part taken from it gets the next id of the board's counter; a label of numbers
 * and units on the step in front of each slot, none for the LEDs (their colour shows) and the jumper.
 */
import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import { createBoardState, createLayout, place } from '@electronics/sim/board';
import {
  buildPart,
  createCeramic,
  createElectrolytic,
  createFilm,
  createTransistor,
  type PartModel,
} from '../../parts';
import { PLACES } from '../../bench/layout';
import { TRAY, createTray, partSize, trayLabel, trayRow } from '../tray';

const model = (key: string): PartModel => buildPart(key)!;

describe('which row of the tray a part takes, from its size', () => {
  it('the low ones (≤ 0.9 tall with their legs, ≤ 0.5 deep) in front, the tall and wide ones behind', () => {
    const front: [string, PartModel][] = [
      ['resistor-4k7', model('resistor-4k7')],
      ['diode-1n4148', model('diode-1n4148')],
      ['diode-1n4007', model('diode-1n4007')],
      ['jumper', model('jumper')],
      ['ceramic 100 nF', createCeramic(100e-9)],
      ['BC547B', createTransistor('transistor-bc547b')],
    ];
    const back: [string, PartModel][] = [
      ['led-red', model('led-red')],
      ['pot-10k', model('pot-10k')],
      ['film 100 nF', createFilm(100e-9)],
      ['470 μF', createElectrolytic(470e-6, 16)],
      ['1000 μF', createElectrolytic(1000e-6, 16)],
    ];
    for (const [name, m] of front) {
      const s = partSize(m);
      expect(trayRow(m), `${name}: ${s.height.toFixed(2)} tall, ${s.depth.toFixed(2)} deep`).toBe('front');
    }
    for (const [name, m] of back) {
      const s = partSize(m);
      expect(trayRow(m), `${name}: ${s.height.toFixed(2)} tall, ${s.depth.toFixed(2)} deep`).toBe('back');
      // the biggest still fits its slot: the back slot is 1.3 × 1.2
      expect(s.width, name).toBeLessThanOrEqual(TRAY.pitch);
      expect(s.depth, name).toBeLessThanOrEqual(PLACES.tray.back.depth);
    }
    // the sizes VISUAL names: the top of the body above the face the legs stand on
    expect(partSize(model('led-red')).height).toBeCloseTo(1.3, 6);
    expect(partSize(createCeramic(100e-9)).height).toBeCloseTo(0.88, 6);
    expect(partSize(createTransistor('transistor-bc547b')).height).toBeCloseTo(0.82, 6);
  });
});

describe('the labels: numbers and units made by the code', () => {
  it('a resistor’s value, a diode’s model, a pot’s value; nothing on an LED or a jumper', () => {
    expect(trayLabel('resistor-4k7')).toBe(`4,7${NBSP}kΩ`);
    expect(trayLabel('resistor-1k')).toBe(`1${NBSP}kΩ`);
    expect(trayLabel('resistor-330')).toBe(`330${NBSP}Ω`);
    expect(trayLabel('resistor-1M')).toBe(`1${NBSP}MΩ`);
    expect(trayLabel('diode-1n4007')).toBe('1N4007');
    expect(trayLabel('pot-10k')).toBe(`10${NBSP}kΩ`);
    expect(trayLabel('led-red')).toBe('');
    expect(trayLabel('jumper')).toBe('');
  });
});

describe('the tray on the table', () => {
  it('stands its kinds in two rows: each in the row its size asks for, at most six in a row', () => {
    const tray = createTray();
    tray.set(['resistor-1k', 'resistor-4k7', 'led-red', 'jumper', 'led-green', 'diode-1n4007']);
    const rows = Object.fromEntries(tray.slots.map((s) => [s.spec, s.row]));
    expect(rows).toEqual({
      'resistor-1k': 'front',
      'resistor-4k7': 'front',
      jumper: 'front',
      'diode-1n4007': 'front',
      'led-red': 'back',
      'led-green': 'back',
    });
    // in each row the order given, from the left; every slot within the tray and its row's band (world)
    const z0 = PLACES.tray.z - PLACES.tray.depth / 2;
    const band = {
      back: [z0, z0 + PLACES.tray.back.depth],
      front: [z0 + PLACES.tray.back.depth, z0 + PLACES.tray.depth],
    } as const;
    for (const row of ['front', 'back'] as const) {
      const xs = tray.slots.filter((s) => s.row === row).map((s) => s.at.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
    for (const s of tray.slots) {
      expect(Math.abs(s.at.x - PLACES.tray.x), s.spec).toBeLessThan(PLACES.tray.width / 2);
      expect(s.at.z, s.spec).toBeGreaterThan(band[s.row][0]);
      expect(s.at.z, s.spec).toBeLessThan(band[s.row][1]);
      expect(s.at.y, s.spec).toBeCloseTo(PLACES.tray[s.row].top + TRAY.foam, 9);
      // the sample stands in the foam as it will on the board: its legs' tips on the foam, its box inside the slot
      expect(s.sample, s.spec).not.toBeNull();
      s.sample!.group.updateWorldMatrix(true, true);
      const box = new Box3().setFromObject(s.sample!.hit);
      expect(box.min.y, s.spec).toBeGreaterThan(s.at.y - 1e-6);
      expect(Math.abs(box.getCenter(new Vector3()).x - s.at.x), s.spec).toBeLessThan(TRAY.pitch / 2);
    }
    expect(() => tray.set(['resistor-1', 'resistor-10', 'resistor-100', 'resistor-1k', 'resistor-10k', 'resistor-100k', 'resistor-1M'])).toThrow(RangeError);
    // a key the bench has no model for has no slot
    expect(() => tray.set(['battery-9v'])).toThrow(RangeError);
    tray.dispose();
  });

  it('gives every part taken the next id of the board’s counter, and never runs out', () => {
    const layout = createLayout();
    const state = createBoardState();
    const tray = createTray();
    tray.set(['resistor-1k', 'led-red']);
    expect(tray.take('resistor-1k', state)).toBe('R1');
    expect(tray.take('resistor-1k', state)).toBe('R2');
    expect(tray.take('led-red', state)).toBe('LED1');
    // a part a step put on the board by hand as R7: the counter goes on after it
    expect(place(layout, state, { id: 'R7', spec: 'resistor-4k7', anchor: 'a3', o: 0 })).toBe(true);
    expect(tray.take('resistor-1k', state)).toBe('R8');
    // the supply never ends: a hundred more, all new, and the slot still holds its sample
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(tray.take('resistor-1k', state)!);
    expect(ids.size).toBe(100);
    expect(ids.has('R1') || ids.has('R8')).toBe(false);
    expect(tray.slot('resistor-1k')!.sample).not.toBeNull();
    // a kind not in the tray gives nothing
    expect(tray.take('resistor-4k7', state)).toBeNull();
    tray.dispose();
  });

  it('raises a new sample from the foam in 0.3 s after one is taken', () => {
    const state = createBoardState();
    const tray = createTray();
    tray.set(['resistor-1k']);
    const slot = tray.slot('resistor-1k')!;
    const rest = slot.sample!.group.position.y;
    tray.take('resistor-1k', state);
    tray.update(0);
    expect(slot.sample!.group.position.y).toBeLessThan(rest - 0.2);
    for (let i = 0; i < 17; i++) tray.update(1 / 60);
    expect(slot.sample!.group.position.y).toBeLessThan(rest);
    tray.update(1 / 60);
    tray.update(1 / 60);
    expect(slot.sample!.group.position.y).toBeCloseTo(rest, 9);
    tray.dispose();
  });
});
