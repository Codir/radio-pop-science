/**
 * The tray of parts on the table (docs/volumes/electronics/VISUAL.md §6, «Лоток»): two rows of six slots — the low
 * parts in front, the tall and wide ones a step higher behind, the row chosen from the part's size; one slot holds one
 * kind with a supply that never ends; a part taken from it gets the next id of the board's counter; a label of numbers
 * and units on the step in front of each slot, none for the LEDs (their colour shows) and the jumper; a capacitor's
 * with its rated voltage, and every label no wider than its slot.
 */
import { readFileSync } from 'node:fs';
import { Box3, Vector3, type BufferGeometry, type Mesh } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import { setFontData, type FontJson, type Text3D } from '@/text';
import { PARTS } from '@electronics/sim/core';
import { createBoardState, createLayout, place } from '@electronics/sim/board';
import { buildPart, type PartModel } from '../../parts';
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
      ['ceramic-100n', model('ceramic-100n')],
      ['transistor-bc547b', model('transistor-bc547b')],
      ['transistor-2n3906', model('transistor-2n3906')],
    ];
    const back: [string, PartModel][] = [
      ['led-red', model('led-red')],
      ['pot-10k', model('pot-10k')],
      ['film-100n', model('film-100n')],
      ['film-1u', model('film-1u')],
      ['electrolytic-470u-16v', model('electrolytic-470u-16v')],
      ['electrolytic-1000u-16v', model('electrolytic-1000u-16v')],
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
    expect(partSize(model('ceramic-100n')).height).toBeCloseTo(0.88, 6);
    expect(partSize(model('transistor-bc547b')).height).toBeCloseTo(0.82, 6);
  });
});

describe('the labels: numbers and units made by the code', () => {
  it('a resistor’s or pot’s value, a diode’s or transistor’s model, a capacitor’s value and voltage; none on an LED, a jumper', () => {
    expect(trayLabel('resistor-4k7')).toBe(`4,7${NBSP}kΩ`);
    expect(trayLabel('resistor-1k')).toBe(`1${NBSP}kΩ`);
    expect(trayLabel('resistor-330')).toBe(`330${NBSP}Ω`);
    expect(trayLabel('resistor-1M')).toBe(`1${NBSP}MΩ`);
    expect(trayLabel('diode-1n4007')).toBe('1N4007');
    expect(trayLabel('pot-10k')).toBe(`10${NBSP}kΩ`);
    expect(trayLabel('transistor-bc337-25')).toBe('BC337-25');
    expect(trayLabel('transistor-2n3904')).toBe('2N3904');
    // a capacitor: its capacitance and its rated voltage, from the catalog
    expect(trayLabel('ceramic-100n')).toBe(`100${NBSP}nF 50${NBSP}V`);
    expect(trayLabel('ceramic-100p')).toBe(`100${NBSP}pF 50${NBSP}V`);
    expect(trayLabel('film-100n')).toBe(`100${NBSP}nF 63${NBSP}V`);
    expect(trayLabel('film-1u')).toBe(`1${NBSP}μF 63${NBSP}V`);
    expect(trayLabel('electrolytic-470u-16v')).toBe(`470${NBSP}μF 16${NBSP}V`);
    expect(trayLabel('electrolytic-100u-16v')).toBe(`100${NBSP}μF 16${NBSP}V`);
    expect(trayLabel('electrolytic-100u-6v3')).toBe(`100${NBSP}μF 6,3${NBSP}V`);
    expect(trayLabel('led-red')).toBe('');
    expect(trayLabel('jumper')).toBe('');
  });

  it('no two capacitors share a label (a phone’s dock shows only the label); an electrolytic’s is its can’s print', () => {
    const capacitors = Object.entries(PARTS).filter(([, s]) => s.kind === 'capacitor');
    expect(capacitors.length).toBeGreaterThan(0);
    const labels = capacitors.map(([key]) => trayLabel(key));
    expect(new Set(labels).size, labels.join(' · ')).toBe(capacitors.length);
    for (const [key, s] of capacitors) {
      if (s.kind !== 'capacitor' || s.dielectric !== 'electrolytic') continue;
      const can = model(key);
      expect(can.printed, key).toEqual([trayLabel(key)]);
      can.dispose();
    }
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

// last in the file: the fonts' metrics stay installed once set
describe('the labels in the font (VISUAL §6)', () => {
  beforeAll(() => {
    const json = JSON.parse(
      readFileSync(new URL('../../../../../../public/fonts/fonts.json', import.meta.url), 'utf8'),
    ) as FontJson;
    setFontData(json);
  });

  it('every label of the catalog is no wider than its slot’s foam, so two neighbours never run together', () => {
    // the foam of a slot (tray.ts, `block`): the slot's pitch less its walls
    const foam = TRAY.pitch - 0.12;
    const tray = createTray();
    let widest = { key: '', width: 0 };
    const measured = new Set<string>();
    for (const key of Object.keys(PARTS)) {
      const label = trayLabel(key);
      const sample = label === '' ? null : buildPart(key);
      if (sample === null) continue;
      sample.dispose();
      tray.set([key]);
      const text = tray.group.getObjectByName(`print:${label}`) as Text3D | undefined;
      expect(text, key).toBeDefined();
      expect(text!.fontSize, key).toBe(TRAY.label[tray.slot(key)!.row]);
      const width = text!.metrics.width;
      expect(width, `${key}: «${label}» ${width.toFixed(3)} wide`).toBeLessThanOrEqual(foam);
      if (width > widest.width) widest = { key, width };
      measured.add(key);
    }
    // every key of a kind the tray labels, the capacitors with their voltages among them
    const labelled = new Set(['resistor', 'pot', 'diode', 'capacitor', 'transistor']);
    for (const [key, s] of Object.entries(PARTS))
      if (labelled.has(s.kind)) expect(measured.has(key), key).toBe(true);
    // the widest is a capacitor's value with its voltage in the front row, as VISUAL §6 says
    expect(widest.key).toMatch(/^ceramic-100[pn]$/);
    expect(widest.width).toBeCloseTo(1.12, 2);
    tray.dispose();
  });
});

describe('the tray freed with the chapter', () => {
  it('frees its block’s geometry and materials too: once its group leaves the tree, the teardown cannot reach them', () => {
    const tray = createTray();
    tray.set(['resistor-1k']);
    const block = tray.group.getObjectByName('tray-block')!;
    const freed = new Set<object>();
    const own: { addEventListener(type: 'dispose', fn: () => void): void }[] = [];
    block.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      own.push(mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
    });
    expect(own.length).toBeGreaterThan(1);
    for (const r of own) r.addEventListener('dispose', () => freed.add(r));
    tray.dispose();
    expect(tray.group.parent).toBeNull();
    expect(freed.size).toBe(new Set(own).size);
  });

  it('disposes every geometry it drew — the block and its foam too — when the bench goes (task E3-7)', () => {
    const tray = createTray();
    tray.set(['resistor-330', 'led-red']);
    const geometries = new Set<BufferGeometry>();
    tray.group.traverse((o) => {
      const g = (o as Mesh).geometry as BufferGeometry | undefined;
      if (g) geometries.add(g);
    });
    expect(geometries.size).toBeGreaterThan(0);
    const disposed = new Set<BufferGeometry>();
    for (const g of geometries) g.addEventListener('dispose', () => disposed.add(g));
    tray.dispose();
    // the chapter's own disposal runs before the engine's sweep of the scene: a geometry the tray took off the scene
    // without disposing it would stay on the GPU, one more with every bench (the leak check of `chapter-check`)
    expect([...geometries].filter((g) => !disposed.has(g)).map((g) => g.name || g.type)).toEqual([]);
  });
});
