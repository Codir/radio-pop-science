/**
 * The circuit model's catalog on the bench (shared/README.md, «The catalog on the bench»): every key of `sim/core`
 * `PARTS` is a part of the board — a footprint with a leg for every pin, a model and a slot in the tray —, a permanent
 * thing of the base — a fixed part of the netlist and its model on the base —, or a row of the README's table «Чого стенд
 * не показує» with its reason. Every leg carries the pin the part's datasheet puts there, the marks of polarity sit by
 * the right leg, and the marks a part prints are read off its key.
 */
import { readFileSync } from 'node:fs';
import { Box3, Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { NBSP, fmtSI } from '@/content';
import { col } from '@/style';
import { PARTS, type PartSpec } from '@electronics/sim/core';
import {
  BENCH_FIXED,
  BOARD_SPEC,
  createBoardState,
  footprintOf,
  type Footprint,
} from '@electronics/sim/board';
import { PLACES } from '../bench/layout';
import { LEADS } from '../bench/fixed';
import { createProps } from '../bench/props';
import { createTray, TRAY } from '../hand/tray';
import {
  MM,
  TRANSISTORS,
  buildPart,
  capacitorCode,
  electrolyticPrint,
  type ElectrolyticModel,
  type LedModel,
  type PartModel,
  type TransistorModel,
} from '../parts';

const P = BOARD_SPEC.pitch;
const KEYS = Object.keys(PARTS);

/** The rows of the README's table «Чого стенд не показує»: every key in backticks in a row's first cell → its reason. */
function hidden(): Map<string, string> {
  const md = readFileSync(new URL('../README.md', import.meta.url), 'utf-8').split('\n');
  const at = md.findIndex((l) => /^#+ .*«Чого стенд не показує»/.test(l));
  expect(at, 'the README has the table «Чого стенд не показує»').toBeGreaterThan(0);
  const out = new Map<string, string>();
  let header = true;
  for (const line of md.slice(at + 1)) {
    if (line.startsWith('#')) break;
    if (!line.startsWith('|')) {
      if (out.size > 0) break;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (header || /^-+$/.test(cells[0] ?? '')) {
      header = false;
      continue;
    }
    const reason = cells[1] ?? '';
    for (const m of (cells[0] ?? '').matchAll(/`([^`]+)`/g)) {
      expect(out.has(m[1]!), `«Чого стенд не показує» lists ${m[1]} twice`).toBe(false);
      out.set(m[1]!, reason);
    }
  }
  return out;
}

const boardFootprint = (key: string): Footprint | null => {
  const fp = footprintOf(key);
  return fp !== null && fp.shape !== 'lead' ? fp : null;
};
const fixedOf = (key: string) => BENCH_FIXED.find((f) => f.spec === key);
/** The names of the catalog's pins in the legs, from leg 0. */
const legNames = (key: string, fp: Footprint): string[] =>
  fp.pins.map((i) => (PARTS[key]!.pins as readonly string[])[i]!);

/** The datasheet's pin in every leg at the orientation 0, from leg 0 — a transistor seen on its flat side with the
 * legs down, from the left: the makers' package drawings (shared/README.md, «The catalog on the bench»). */
const TO92: Readonly<Record<string, readonly string[]>> = {
  'transistor-bc547b': ['collector', 'base', 'emitter'],
  'transistor-bc557b': ['collector', 'base', 'emitter'],
  'transistor-bc337-25': ['collector', 'base', 'emitter'],
  'transistor-bc327-25': ['collector', 'base', 'emitter'],
  'transistor-2n3904': ['emitter', 'base', 'collector'],
  'transistor-2n3906': ['emitter', 'base', 'collector'],
};
/** The name printed on a transistor's flat side. */
const PRINT: Readonly<Record<string, string>> = {
  'transistor-bc547b': 'BC547B',
  'transistor-bc557b': 'BC557B',
  'transistor-bc337-25': 'BC337-25',
  'transistor-bc327-25': 'BC327-25',
  'transistor-2n3904': '2N3904',
  'transistor-2n3906': '2N3906',
};

/** What every leg of a part of the board carries, by its kind: the order a real part has from leg 0 (VISUAL §4). */
function wantLegs(key: string, spec: PartSpec): readonly string[] | undefined {
  if (spec.kind === 'transistor') return TO92[key];
  if (spec.kind === 'capacitor') return spec.dielectric === 'electrolytic' ? ['plus', 'minus'] : ['a', 'b'];
  const byKind: Partial<Record<PartSpec['kind'], readonly string[]>> = {
    resistor: ['a', 'b'],
    jumper: ['a', 'b'],
    pot: ['ccw', 'wiper', 'cw'],
    diode: ['anode', 'cathode'],
    led: ['anode', 'cathode'],
  };
  return byKind[spec.kind];
}

/** What a part of the board prints, from its key (none: a resistor wears bands, an LED and a jumper nothing). */
function wantPrint(key: string, spec: PartSpec): readonly string[] {
  if (spec.kind === 'capacitor') {
    return [
      spec.dielectric === 'electrolytic'
        ? electrolyticPrint(spec.farads, spec.ratedV)
        : capacitorCode(spec.farads),
    ];
  }
  if (spec.kind === 'transistor') return [PRINT[key]!];
  if (spec.kind === 'pot') return [fmtSI(spec.ohms, 'Ω')];
  if (key === 'diode-1n4007') return ['1N4007'];
  return [];
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;

/** How wide (x) and deep (z) the drawn part is: every mesh shown but its invisible box (a jumper's runs 0.06 past its
 * ends). */
function drawnSize(m: PartModel): { width: number; depth: number } {
  const box = new Box3();
  m.group.updateWorldMatrix(true, true);
  m.group.traverseVisible((o) => {
    if (!isMesh(o) || o === m.hit) return;
    const g = o.geometry as BufferGeometry;
    g.computeBoundingBox();
    box.union(g.boundingBox!.clone().applyMatrix4(o.matrixWorld));
  });
  return { width: box.max.x - box.min.x, depth: box.max.z - box.min.z };
}

/** The mean x (body frame: +x from leg 0 to leg 1) of the vertices of the body baked in the colour `c`. */
function meanXOf(model: PartModel, c: string): number {
  const want = col(c);
  let sum = 0;
  let n = 0;
  model.bodyGroup.traverse((o) => {
    if (!isMesh(o) || o === model.legs) return;
    const g = o.geometry as BufferGeometry;
    const colour = g.getAttribute('color');
    const pos = g.getAttribute('position');
    if (!colour) return;
    for (let i = 0; i < colour.count; i++) {
      const d = Math.max(
        Math.abs(colour.getX(i) - want.r),
        Math.abs(colour.getY(i) - want.g),
        Math.abs(colour.getZ(i) - want.b),
      );
      if (d < 1e-5) {
        sum += new Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrix).x;
        n++;
      }
    }
  });
  expect(n, `${model.key}: vertices of ${c}`).toBeGreaterThan(0);
  return sum / n;
}

describe('every key of the catalog has its place on the bench', () => {
  it('is a part of the board, a permanent thing of the base, or a row of «Чого стенд не показує» — one of them', () => {
    const table = hidden();
    for (const key of KEYS) {
      const places = [boardFootprint(key) !== null, fixedOf(key) !== undefined, table.has(key)];
      expect(places.filter(Boolean).length, `${key}: board, fixed, not shown`).toBe(1);
    }
    for (const [key, reason] of table) {
      expect(Object.hasOwn(PARTS, key), `«Чого стенд не показує»: ${key}, a key of the catalog`).toBe(true);
      expect(reason.length, `${key}: a reason`).toBeGreaterThan(20);
    }
    // what the bench offers the reader: every kind of the catalog but the references and the second sources
    const kinds = new Set(KEYS.filter((k) => !table.has(k)).map((k) => PARTS[k]!.kind));
    expect([...kinds].sort()).toEqual([
      'battery',
      'capacitor',
      'diode',
      'jumper',
      'lamp',
      'led',
      'player',
      'pot',
      'resistor',
      'speaker',
      'switch',
      'transistor',
    ]);
  });

  it('a part of the board: a leg for every pin, each pin in one leg, a model on its legs and a slot in the tray', () => {
    const tray = createTray();
    let n = 0;
    for (const key of KEYS) {
      const fp = boardFootprint(key);
      if (fp === null) continue;
      n++;
      const spec = PARTS[key]!;
      expect(fp.offsets, key).toHaveLength(spec.pins.length);
      expect([...fp.pins].sort(), key).toEqual(spec.pins.map((_, i) => i));
      const model = buildPart(key);
      expect(model, `${key}: a model`).not.toBeNull();
      expect(
        model!.nominal.map((t) => [t.x / P, t.z]),
        key,
      ).toEqual(fp.offsets.map(([dx, dz]) => [expect.closeTo(dx, 9), dz]));
      model!.dispose();
      // its slot: the row its size asks for, and the sample fits the slot
      tray.set([key]);
      const slot = tray.slot(key)!;
      expect(slot.sample, key).not.toBeNull();
      const size = drawnSize(slot.sample!);
      expect(size.width, `${key} in the ${slot.row} row`).toBeLessThanOrEqual(TRAY.pitch);
      expect(size.depth, `${key} in the ${slot.row} row`).toBeLessThanOrEqual(PLACES.tray[slot.row].depth);
      expect(tray.take(key, createBoardState()), key).toBe(`${fp.prefix}1`);
    }
    tray.dispose();
    expect(n).toBeGreaterThan(190); // 169 resistors, the pot, the jumper, 2 diodes, 5 LEDs, 12 capacitors, 6 transistors
  });

  it('a permanent thing: a fixed part with a pin for every pin of its key, and its model on the base', () => {
    const props = createProps();
    /** The model on the base that shows each fixed part. */
    const VIEW: Readonly<Record<string, Object3D>> = {
      BAT: props.things.battery.group,
      SW: props.slider.group,
      SPK: props.things.speaker.group,
      LAMP: props.bulb.group,
      PLAYER: props.things.player.group,
    };
    expect(BENCH_FIXED.map((f) => f.id).sort()).toEqual(Object.keys(VIEW).sort());
    for (const f of BENCH_FIXED) {
      expect(PARTS[f.spec]?.pins, f.id).toHaveLength(f.pins.length);
      let onBase = false;
      VIEW[f.id]!.traverseAncestors((a) => void (a === props.onBase && (onBase = true)));
      expect(onBase, `${f.id}: its model stands on the base`).toBe(true);
    }
    props.onBase.removeFromParent();
  });
});

describe('every leg carries the pin of the part’s datasheet (VISUAL §4, «Відбитки»; §4.7)', () => {
  it('for every part of the board, from leg 0', () => {
    for (const key of KEYS) {
      const fp = boardFootprint(key);
      if (fp === null) continue;
      const want = wantLegs(key, PARTS[key]!);
      expect(want, `${key}: a datasheet order of its legs`).toBeDefined();
      expect(legNames(key, fp), key).toEqual(want);
    }
  });

  it('a transistor in TO-92: C · B · E or E · B · C from the left on its flat side, as its maker draws it', () => {
    const transistors = KEYS.filter((k) => PARTS[k]!.kind === 'transistor');
    expect(transistors.sort()).toEqual(Object.keys(TO92).sort());
    // both orders are on the bench
    const orders = new Set(transistors.map((k) => legNames(k, footprintOf(k)!).join(' ')));
    expect([...orders].sort()).toEqual(['collector base emitter', 'emitter base collector']);
    for (const key of transistors) {
      const spec = PARTS[key]!;
      const q = buildPart(key) as TransistorModel;
      // the model's legs: the same leads, leg 0 the leftmost seen on its flat side (+z at the orientation 0)
      expect(q.legNames, key).toEqual(TO92[key]);
      expect(
        q.nominal.map((t) => t.x / P).map((x) => Math.round(x * 1e9) / 1e9),
        key,
      ).toEqual([0, 1, 2]);
      expect(q.printAt.z, `${key}: the print on the flat side, toward the reader`).toBeGreaterThan(0);
      // its name and its type off the key
      expect(q.print, key).toBe(PRINT[key]);
      expect(q.printed, key).toEqual([PRINT[key]]);
      expect(TRANSISTORS[key]?.type, key).toBe(
        spec.kind === 'transistor' && spec.polarity === 'npn' ? 'NPN' : 'PNP',
      );
      q.dispose();
    }
  });

  it('an LED’s cut collar and a diode’s band by the cathode (leg 1), an electrolytic’s stripe over its minus (leg 1)', () => {
    for (const key of KEYS) {
      const spec = PARTS[key]!;
      const fp = boardFootprint(key);
      if (fp === null) continue;
      if (spec.kind === 'led') {
        expect(legNames(key, fp)[1], key).toBe('cathode');
        const led = buildPart(key) as LedModel;
        // the collar (0.3 … 0.42 up) shows its rim on the anode's side and is cut flat at the dome on the cathode's
        const pos = (led.epoxy.geometry as BufferGeometry).getAttribute('position');
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y < 0.3 - 1e-6 || y > 0.42 + 1e-6) continue;
          min = Math.min(min, pos.getX(i));
          max = Math.max(max, pos.getX(i));
        }
        expect(min, key).toBeCloseTo(-0.33, 2);
        expect(max, key).toBeLessThanOrEqual(0.29 + 1e-6);
        led.dispose();
      } else if (spec.kind === 'diode') {
        expect(legNames(key, fp)[1], key).toBe('cathode');
        const d = buildPart(key)!;
        // the band: black on the glass of 1N4148, grey on the epoxy of 1N4007
        expect(meanXOf(d, key === 'diode-1n4148' ? 'ink' : 'steel'), key).toBeGreaterThan(0.05);
        d.dispose();
      } else if (spec.kind === 'capacitor' && spec.dielectric === 'electrolytic') {
        expect(legNames(key, fp), key).toEqual(['plus', 'minus']);
        const can = buildPart(key) as ElectrolyticModel;
        const g = can.sleeve.geometry as BufferGeometry;
        const colour = g.getAttribute('color');
        const pos = g.getAttribute('position');
        const mist = col('mist');
        let stripe = 0;
        for (let i = 0; i < colour.count; i++) {
          const d =
            Math.abs(colour.getX(i) - mist.r) +
            Math.abs(colour.getY(i) - mist.g) +
            Math.abs(colour.getZ(i) - mist.b);
          if (d > 3e-5) continue;
          stripe++;
          expect(pos.getX(i), `${key}: the stripe over the minus leg (+x)`).toBeGreaterThan(0);
        }
        expect(stripe, key).toBeGreaterThan(0);
        can.dispose();
      }
    }
  });

  it('the plugs of a permanent thing: the coral one on the plus, the ink one on the minus; the lamp has no polarity', () => {
    const colour = (lead: string) => LEADS.find((l) => l.name === lead)?.color;
    for (const f of BENCH_FIXED) {
      const names = PARTS[f.spec]!.pins as readonly string[];
      f.pins.forEach((pin, i) => {
        if (!('lead' in pin)) return;
        const want = names[i] === 'plus' ? 'coral' : names[i] === 'minus' ? 'ink' : 'mist';
        expect(colour(pin.lead), `${f.id} ${pin.lead} on ${names[i]}`).toBe(want);
      });
    }
    // the player's signal and common are its plus and minus
    expect(fixedOf('player')?.pins).toEqual([{ lead: 'pl+' }, { lead: 'pl-' }]);
  });
});

describe('the marks a part shows are read off its key (VISUAL §4.7)', () => {
  it('a capacitor’s code or value and voltage, a transistor’s name, the pot’s and the 1N4007’s print', () => {
    for (const key of KEYS) {
      const spec = PARTS[key]!;
      if (boardFootprint(key) === null) continue;
      const m = buildPart(key)!;
      expect(m.printed, key).toEqual(wantPrint(key, spec));
      m.dispose();
    }
    // the examples of VISUAL §4.7 and the catalog's own values
    const print = (key: string) => buildPart(key)!.printed;
    expect(print('ceramic-100p')).toEqual(['101']);
    expect(print('ceramic-1n')).toEqual(['102']);
    expect(print('ceramic-100n')).toEqual(['104']);
    expect(print('film-1u')).toEqual(['105']);
    expect(print('electrolytic-470u-16v')).toEqual([`470${NBSP}μF 16${NBSP}V`]);
    expect(print('electrolytic-100u-6v3')).toEqual([`100${NBSP}μF 6,3${NBSP}V`]);
  });

  it('an electrolytic’s can is its own value’s, three times the real one', () => {
    const CANS: Readonly<Record<string, readonly [d: number, h: number]>> = {
      'electrolytic-1u-16v': [5, 11],
      'electrolytic-10u-16v': [5, 11],
      'electrolytic-100u-16v': [6.3, 11],
      'electrolytic-470u-16v': [8, 11.5],
      'electrolytic-1000u-16v': [10, 16],
      'electrolytic-100u-6v3': [5, 11],
    };
    const cans = KEYS.filter((k) => {
      const s = PARTS[k]!;
      return s.kind === 'capacitor' && s.dielectric === 'electrolytic';
    });
    expect(cans.sort()).toEqual(Object.keys(CANS).sort());
    for (const key of cans) {
      const can = buildPart(key) as ElectrolyticModel;
      expect(can.size.d, key).toBeCloseTo(CANS[key]![0] * MM, 9);
      expect(can.size.h, key).toBeCloseTo(CANS[key]![1] * MM, 9);
      can.dispose();
    }
  });
});
