/**
 * The models of the parts on the board (docs/volumes/electronics/VISUAL.md §4): legs at the footprint's pitch that end
 * in their sockets, at any quarter turn and across the channel; the invisible box of gesture 1; at most six draw calls;
 * no shadows; the marks from the data (the resistor's bands, the LED's cut, the electrolytic's stripe); the hook of the
 * model's state; no Text3D in Node (the fonts are not loaded here). Box3 and vertices only, no WebGL.
 */
import { Box3, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { fontsReady } from '@/text';
import { BOARD_SPEC, createLayout, footprintOf, legSockets, type Orientation } from '@electronics/sim/board';
import { PARTS, type CapacitorSpec } from '@electronics/sim/core';
import {
  LEG,
  MM,
  bandColor,
  buildPart,
  createLed,
  createPot,
  createResistor,
  resistorBands,
  type ElectrolyticModel,
  type PartModel,
} from '..';

const P = BOARD_SPEC.pitch;

/** A key of every kind and look of the catalog that stands in sockets (every key: `shared/__tests__/catalog.test.ts`). */
const CATALOG = [
  'resistor-1',
  'resistor-4k7',
  'resistor-10M',
  'diode-1n4148',
  'diode-1n4007',
  'led-red',
  'led-yellow',
  'led-green',
  'led-blue',
  'led-white',
  'pot-10k',
  'jumper',
  'ceramic-100n',
  'film-100n',
  'electrolytic-10u-16v',
  'electrolytic-1000u-16v',
  'transistor-bc547b',
  'transistor-2n3904',
] as const;

/** Every model of the test with the pitch of its legs. */
function everyModel(): { name: string; model: PartModel; pitches: readonly number[] }[] {
  return CATALOG.map((key) => ({
    name: key,
    model: buildPart(key)!,
    pitches: footprintOf(key)!.offsets.map(([dx]) => dx),
  }));
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;
const materialsOf = (m: Mesh): Material[] => (Array.isArray(m.material) ? m.material : [m.material]);

/** Meshes the renderer would draw: shown in the tree and with a visible material. */
function drawCalls(root: Object3D): number {
  let n = 0;
  root.traverseVisible((o) => {
    if (isMesh(o) && materialsOf(o).some((m) => m.visible)) n++;
  });
  return n;
}

/** Vertices of a mesh in the frame of the model's parent (the model's group has no transform of its own). */
function vertices(model: PartModel, mesh: Mesh): Vector3[] {
  model.group.updateMatrixWorld(true);
  const pos = (mesh.geometry as BufferGeometry).getAttribute('position');
  const out: Vector3[] = [];
  for (let i = 0; i < pos.count; i++)
    out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}

/** The lowest vertices of the legs, one cluster per leg end: each is a ring of the leg's radius around a tip. */
function legEnds(model: PartModel): Vector3[] {
  const low = vertices(model, model.legs).filter((v) => v.y < LEG.dip + 1e-6);
  const ends: Vector3[] = [];
  for (const v of low) {
    const near = ends.find((e) => Math.hypot(e.x - v.x, e.z - v.z) < 2.5 * LEG.radius);
    if (!near) ends.push(v.clone());
  }
  return ends;
}

/** Every leg ends in the mouth of its tip: a ring of the leg's radius around it, at the dip. */
function expectLegsEndAt(model: PartModel, tips: readonly Vector3[], name: string): void {
  const low = vertices(model, model.legs).filter((v) => v.y < LEG.dip + 1e-6);
  expect(low.length, name).toBeGreaterThan(0);
  for (const v of low) {
    const d = Math.min(...tips.map((t) => Math.hypot(v.x - t.x, v.z - t.z)));
    expect(d, name).toBeLessThan(LEG.radius + 1e-6);
  }
  for (const t of tips) {
    expect(
      low.some((v) => Math.hypot(v.x - t.x, v.z - t.z) < LEG.radius + 1e-6),
      `${name}: a leg ends at (${t.x}; ${t.z})`,
    ).toBe(true);
  }
  expect(legEnds(model).length, name).toBe(tips.length);
}

describe('legs at the footprint’s pitch (VISUAL §4, the table of footprints)', () => {
  it('every model stands on its nominal tips: leg 0 at the origin, the others along +x at 4 P / 1 P / 2 P', () => {
    for (const { name, model, pitches } of everyModel()) {
      expect(
        model.nominal.map((t) => [t.x, t.y, t.z]),
        name,
      ).toEqual(pitches.map((k) => [k * P, 0, 0]));
      expect(
        model.legTips.map((t) => t.toArray()),
        name,
      ).toEqual(model.nominal.map((t) => t.toArray()));
      expectLegsEndAt(model, model.nominal, name);
      // the legs' box runs from the first leg's tip to the last's (Box3), and down into the mouths
      model.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model.legs);
      const span = pitches[pitches.length - 1]! * P;
      expect(box.min.x, name).toBeCloseTo(-LEG.radius, 6);
      expect(box.max.x, name).toBeCloseTo(span + LEG.radius, 6);
      expect(box.min.y, name).toBeCloseTo(LEG.dip, 6);
    }
  });

  it('the catalog’s pitch is the footprint’s: 4 P axial, 1 P LEDs, electrolytics and TO-92, 2 P the pot and film', () => {
    const at = (key: string) => buildPart(key)!.nominal.map((t) => Math.round((t.x / P) * 1e6) / 1e6);
    expect(at('resistor-4k7')).toEqual([0, 4]);
    expect(at('diode-1n4148')).toEqual([0, 4]);
    expect(at('diode-1n4007')).toEqual([0, 4]);
    expect(at('led-green')).toEqual([0, 1]);
    expect(at('pot-10k')).toEqual([0, 2, 4]);
    expect(at('jumper')).toEqual([0, 4]);
    expect(at('ceramic-1n')).toEqual([0, 2]);
    expect(at('film-1u')).toEqual([0, 2]);
    expect(at('electrolytic-470u-16v')).toEqual([0, 1]);
    expect(at('transistor-bc327-25')).toEqual([0, 1, 2]);
  });

  it('stands at every quarter turn and across the channel: the legs end in their sockets, the body between them', () => {
    const layout = createLayout();
    const cases: [string, string, Orientation][] = [
      ['resistor-4k7', 'b5', 1], // b5 → f5: across the channel, 1.5 apart instead of 1.2
      ['resistor-4k7', 'j9', 2],
      ['led-red', 'e7', 1], // e7 → f7: 0.6 apart instead of 0.3
      ['led-blue', 'c3', 3],
      ['pot-10k', 'd2', 1], // d2, f2 … the pot across the channel: its legs bend
      ['jumper', 'a1', 1],
    ];
    for (const [key, anchor, o] of cases) {
      const model = buildPart(key)!;
      const sockets = legSockets(layout, footprintOf(key)!, layout.socket(anchor)!, o);
      const tips = sockets.map((s) => new Vector3(s!.x, 0, s!.z));
      model.fit(tips);
      const name = `${key} at ${anchor}, o ${o}`;
      expectLegsEndAt(model, tips, name);
      const first = tips[0]!;
      const last = tips[tips.length - 1]!;
      expect(model.bodyGroup.position.x, name).toBeCloseTo((first.x + last.x) / 2, 9);
      expect(model.bodyGroup.position.z, name).toBeCloseTo((first.z + last.z) / 2, 9);
      // the body's +x points from leg 0 to the last leg
      const along = new Vector3(1, 0, 0).applyQuaternion(model.bodyGroup.quaternion);
      const want = last.clone().sub(first).normalize();
      expect(along.distanceTo(want), name).toBeLessThan(1e-9);
    }
  });
});

describe('the box of gesture 1, draw calls, shadows, no fonts in Node', () => {
  it('every model has an invisible box of its body, above the board, that is never drawn', () => {
    for (const { name, model } of everyModel()) {
      expect(model.hit, name).toBeInstanceOf(Mesh);
      expect(
        materialsOf(model.hit).every((m) => !m.visible),
        name,
      ).toBe(true);
      expect(model.hit.visible, name).toBe(true); // a ray still finds it (an invisible Object3D it would not)
      model.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model.hit);
      // the body only: above the board, not down to the sockets with the legs
      expect(box.min.y, name).toBeGreaterThan(0.02);
      expect(box.max.y - box.min.y, name).toBeGreaterThan(0.1);
    }
  });

  it('draws in at most six calls, a lit LED too, and casts no shadow', () => {
    for (const { name, model } of everyModel()) {
      model.setLook({ light: 1 }, 1 / 60);
      expect(drawCalls(model.group), name).toBeLessThanOrEqual(6);
      model.group.traverse((o) => {
        if (isMesh(o)) expect(o.castShadow, `${name}: ${o.name}`).toBe(false);
      });
    }
  });

  it('builds no Text3D where the fonts are not loaded (here), and needs none', () => {
    expect(fontsReady()).toBe(false);
    for (const { name, model } of everyModel()) {
      expect(model.prints, name).toHaveLength(0);
      let texts = 0;
      model.group.traverse((o) => void ((o as { isText3D?: boolean }).isText3D && texts++));
      expect(texts, name).toBe(0);
    }
  });
});

describe('the catalog binds models to keys', () => {
  it('has no model for what does not stand in sockets, or a key it does not know', () => {
    for (const key of ['battery-9v', 'switch', 'speaker-8', 'lamp-6v', 'ideal-9v', 'no-such-part']) {
      expect(buildPart(key), key).toBeNull();
    }
  });

  it('binds the capacitors by their spec and the transistors by their key, and nothing it has no model for', () => {
    for (const [key, spec] of Object.entries(PARTS)) {
      if (spec.kind !== 'capacitor' && spec.kind !== 'transistor') continue;
      expect(buildPart(key)?.key, key).toBe(key);
    }
    // a spec given in the catalog's place (a test's own): a capacitor of a value the catalog has not
    const film = buildPart('film-2u2', { ...(PARTS['film-1u'] as CapacitorSpec), farads: 2.2e-6 });
    expect(film?.nominal.map((t) => t.x)).toEqual([0, 2 * P]);
    // a transistor the board has no pinout for has no model
    expect(buildPart('transistor-unknown', PARTS['transistor-bc547b'])).toBeNull();
  });
});

describe('the marks come from the data', () => {
  /** The vertices (the mesh's own frame) whose baked colour is `c` (Builder stores colours as float32). */
  const coloured = (mesh: Mesh, c: { r: number; g: number; b: number }): Vector3[] => {
    const g = mesh.geometry as BufferGeometry;
    const a = g.getAttribute('color');
    const p = g.getAttribute('position');
    const out: Vector3[] = [];
    if (!a) return out;
    for (let i = 0; i < a.count; i++) {
      const d = Math.max(Math.abs(a.getX(i) - c.r), Math.abs(a.getY(i) - c.g), Math.abs(a.getZ(i) - c.b));
      if (d < 1e-5) out.push(new Vector3().fromBufferAttribute(p, i));
    }
    return out;
  };
  const meanX = (vs: readonly Vector3[]) => vs.reduce((s, v) => s + v.x, 0) / vs.length;

  it('the resistor wears its value’s four bands, the first by leg 0, the tolerance by leg 1', () => {
    const r = createResistor(4700, 0.05);
    expect(r.bands).toEqual(resistorBands(4700, 0.05));
    const meshes: Mesh[] = [];
    r.bodyGroup.traverse((o) => isMesh(o) && meshes.push(o));
    const where = (band: Parameters<typeof bandColor>[0]): number => {
      for (const m of meshes) {
        const vs = coloured(m, bandColor(band));
        if (vs.length) return meanX(vs);
      }
      throw new Error(`no ${band} band`);
    };
    const x = (['yellow', 'violet', 'red', 'gold'] as const).map(where);
    expect(x[0]).toBeLessThan(x[1]!);
    expect(x[1]).toBeLessThan(x[2]!);
    expect(x[2]).toBeLessThan(x[3]!);
    expect(x[0]).toBeLessThan(0); // toward leg 0
    expect(x[3]).toBeGreaterThan(0); // the tolerance, toward leg 1
  });

  it('the LED’s collar is cut on the cathode’s side (leg 1), level with the dome', () => {
    const led = createLed('red');
    const pos = (led.epoxy.geometry as BufferGeometry).getAttribute('position');
    let minX = Infinity;
    let maxX = -Infinity;
    let top = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      top = Math.max(top, y);
      if (y > 0.3 - 1e-6 && y < 0.42 + 1e-6) {
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
      }
    }
    expect(minX).toBeCloseTo(-0.33, 2); // the collar shows on the anode's side
    expect(maxX).toBeLessThanOrEqual(0.29 + 1e-6); // and is cut flat at the dome on the cathode's
    expect(top).toBeCloseTo(1.3, 6);
  });

  it('the electrolytic’s stripe runs over the minus leg (1), on the side and over the top rim; its size is its value’s', () => {
    // a real can three times over (VISUAL §4.7): 5 × 11 mm for 10 μF 16 V, 10 × 16 mm for 1000 μF 16 V
    for (const [key, d, h] of [
      ['electrolytic-10u-16v', 5, 11],
      ['electrolytic-1000u-16v', 10, 16],
    ] as const) {
      const can = buildPart(key) as ElectrolyticModel;
      const stripe = coloured(can.sleeve, col('mist'));
      expect(stripe.length).toBeGreaterThan(0);
      expect(stripe.every((v) => v.x > 0)).toBe(true);
      const top = Math.max(...stripe.map((v) => v.y));
      can.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(can.sleeve);
      expect(top).toBeCloseTo(box.max.y, 6); // the stripe reaches the rim of the top
      expect(box.max.x - box.min.x).toBeCloseTo(d * MM, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(h * MM, 6);
      expect(box.min.y).toBeCloseTo(0.3, 6);
    }
  });
});

describe('the hook of the model’s state (setLook)', () => {
  it('an LED glows by its brightness only: dark at 0, 1.8 at full; dt 0 is a frame like any other', () => {
    const led = createLed('green');
    led.setLook({ light: 0 }, 0);
    expect(led.glow.visible).toBe(false);
    led.setLook({ light: 1 }, 0);
    expect(led.glow.visible).toBe(true);
    expect(led.glowMaterial.intensity).toBeCloseTo(1.8, 9);
    led.setLook({ light: 0.5 }, 1 / 15);
    expect(led.glowMaterial.intensity).toBeCloseTo(0.9, 9);
    led.setLook({ light: 0.01 }, 1 / 60);
    expect(led.glow.visible).toBe(false); // b < 0.02: no light at all (VISUAL §4.4)
  });

  it('a pot’s knob follows its setting through 300°, within 0.15 s, and holds on a frame with dt 0', () => {
    const pot = createPot(10e3);
    const deg = () => (pot.knob.rotation.y * 180) / Math.PI;
    pot.setLook({ setting: 0.5 }, 1);
    expect(deg()).toBeCloseTo(0, 6);
    pot.setLook({ setting: 1 }, 0);
    expect(deg()).toBeCloseTo(0, 6);
    for (let i = 0; i < 9; i++) pot.setLook({ setting: 1 }, 1 / 60);
    expect(deg()).toBeLessThan(-140); // most of the way to the clockwise end in 0.15 s
    pot.setLook({ setting: 1 }, 1);
    expect(deg()).toBeCloseTo(-150, 3);
    pot.setLook({ setting: 0 }, 1);
    expect(deg()).toBeCloseTo(150, 3);
    expect(Number.isFinite(pot.knob.rotation.y)).toBe(true);
  });
});

describe('dispose', () => {
  it('frees every geometry and material of the model', () => {
    for (const { name, model } of everyModel()) {
      const parts: (BufferGeometry | Material)[] = [];
      model.group.traverse((o) => {
        if (isMesh(o)) parts.push(o.geometry as BufferGeometry, ...materialsOf(o));
      });
      let freed = 0;
      const unique = [...new Set(parts)];
      for (const p of unique) p.addEventListener('dispose', () => freed++);
      model.dispose();
      expect(freed, name).toBe(unique.length);
    }
  });
});
