import { Box3, type Material, Mesh, type Object3D, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { Builder } from '@/kit';
import {
  CAMERA,
  CAT,
  HOUSE_SKIRT,
  MONITOR_ANTENNA,
  MONITOR_SCREEN,
  SAMPLE_PLAN,
  type YardProps,
  addKitchenBlock,
  buildYardProps,
  picketFence,
} from '..';

/** The materials of a mesh as an array (nothing for other objects). */
const materialsOf = (o: Object3D): Material[] =>
  o instanceof Mesh ? (Array.isArray(o.material) ? o.material : [o.material]) : [];

const size = (o: Object3D) => new Box3().setFromObject(o).getSize(new Vector3());

describe('models', () => {
  const props = buildYardProps(SAMPLE_PLAN, new Rng('models-test'));
  const BUDGET: Record<string, number> = {
    camera1: 3000,
    camera2: 3000,
    pole: 1500,
    monitor: 3000,
    wicket: 3000,
    fence: 40000,
    shed: 5000,
    garage: 8000,
    swing: 3000,
    bicycle: 8000,
    cat: 5000,
    tray: 600,
    phone: 600,
    house: 60000,
    neighbour: 4000,
  };
  const ANCHORS: Record<string, readonly string[]> = {
    camera1: ['lens', 'antenna', 'cable'],
    pole: ['mount1', 'mount2'],
    monitor: ['screen', 'antenna'],
    wicket: ['latch'],
    shed: ['wall', 'nook'],
    garage: ['gate'],
    bicycle: ['lamp'],
    cat: ['spot'],
    house: ['sill', 'microwave', 'phone'],
    neighbour: ['window', 'router'],
  };
  const PARTS: Record<string, readonly string[]> = {
    camera1: ['rod'],
    wicket: ['leaf'],
    garage: ['gate'],
    swing: ['seat'],
    cat: ['head', 'tail', 'spot'],
    house: ['floor', 'cellarFloor', 'skirt'],
  };

  it.each(Object.keys(BUDGET))('%s: якорі, частини, межа трикутників, матеріали', (name) => {
    const m = props[name as keyof YardProps];
    for (const a of ANCHORS[name] ?? []) expect(() => m.anchor(a)).not.toThrow();
    for (const p of PARTS[name] ?? []) expect(() => m.part(p)).not.toThrow();
    expect(m.triangles).toBeGreaterThan(0);
    expect(m.triangles).toBeLessThanOrEqual(BUDGET[name]!);
    m.group.traverse((o) => {
      for (const mat of materialsOf(o)) expect('isMeshStandardMaterial' in mat).toBe(false);
    });
  });

  it('увесь двір — до 400 000 трикутників', () =>
    expect(Object.values(props).reduce((s, m) => s + m.triangles, 0)).toBeLessThanOrEqual(400_000));

  it('об’єктив — найпередніша точка камери', () => {
    const box = new Box3().setFromObject(props.camera1.group);
    expect(box.min.z).toBeGreaterThanOrEqual(props.camera1.anchorLocal('lens').z - 0.02);
  });

  it('екран монітора 4 : 3', () =>
    expect(MONITOR_SCREEN.width / MONITOR_SCREEN.height).toBeCloseTo(4 / 3, 9));

  it('розміри, на які спираються кадр камери й модель', () => {
    const up = props.camera1.anchorLocal('antenna').sub(props.camera1.anchorLocal('lens'));
    expect(up.y).toBeCloseTo(CAMERA.antennaUp, 6);
    expect(Math.hypot(up.x, up.z)).toBeLessThanOrEqual(0.05);
    const d = props.monitor.anchorLocal('antenna').sub(props.monitor.anchorLocal('screen')).toArray();
    for (let k = 0; k < 3; k++) expect(d[k]).toBeCloseTo(MONITOR_ANTENNA[k]!, 6);
    const c = size(props.cat.group);
    expect(Math.max(c.x, c.z)).toBeGreaterThanOrEqual(CAT.length);
    expect(Math.max(c.x, c.z)).toBeLessThanOrEqual(0.75);
    const s = size(props.cat.part('spot'));
    expect(Math.max(s.x, s.y, s.z)).toBeGreaterThanOrEqual(0.04);
    expect(Math.max(s.x, s.y, s.z)).toBeLessThanOrEqual(0.08);
    expect(size(props.wicket.part('leaf')).z).toBeCloseTo(1.0, 1);
    expect(size(props.wicket.part('leaf')).y).toBeCloseTo(1.8, 1);
    const f = picketFence([
      {
        route: [
          [0, 0],
          [1.6, 0],
        ],
        height: 1.1,
        picket: 0.08,
        gap: 0.08,
        board: true,
      },
    ]);
    expect(size(f.group).x).toBeCloseTo(1.6, 2);
    expect(size(f.group).y).toBeCloseTo(1.1, 2);
  });

  it('якорі дому й сараю лягають у точки плану', () => {
    for (const k of ['sill', 'microwave', 'phone'] as const) {
      const a = props.house.anchorLocal(k);
      const p = SAMPLE_PLAN.house[k];
      expect(Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2])).toBeLessThanOrEqual(0.05);
    }
    for (const k of ['wall', 'nook'] as const) {
      const a = props.shed.anchorLocal(k);
      const p = SAMPLE_PLAN.shed[k];
      expect(Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2])).toBeLessThanOrEqual(0.05);
    }
    const kb = new Builder('kitchen');
    addKitchenBlock(kb, { length: 2.4 });
    const m = kb.build().anchorLocal('microwave');
    expect(m.y).toBeCloseTo(1.0, 6);
    expect(m.x).toBeLessThanOrEqual(-2.4 / 2 + 0.5);
  });

  const H = SAMPLE_PLAN.house;
  const ends = H.walls.flatMap((w) => [w.a, w.b]);
  const cellar = Math.min(...H.walls.map((w) => w.y0)); // the cellar floor: the lowest y0 of the walls
  /** The bounding rectangle of the wall lines. */
  const box = {
    x0: Math.min(...ends.map((p) => p[0])),
    x1: Math.max(...ends.map((p) => p[0])),
    z0: Math.min(...ends.map((p) => p[1])),
    z1: Math.max(...ends.map((p) => p[1])),
  };
  /** Height of the first thing straight below (x, y, z) in `o`, or undefined. */
  const down = (o: Object3D, x: number, y: number, z: number) => (
    o.updateMatrixWorld(true),
    new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0)).intersectObject(o, true)[0]?.point.y
  );
  /** The drawn ground: the island's mesh, linear between its nodes (the kit's `heightAt` is smooth and blind to it). */
  const groundAt = (x: number, z: number) =>
    down(props.island.group, x - SAMPLE_PLAN.centre[0], 10, z - SAMPLE_PLAN.centre[1])!;
  /** Points every 0.25 m along the perimeter of `box` grown by `e`. */
  const around = (e: number): [number, number][] => {
    const x0 = box.x0 - e;
    const x1 = box.x1 + e;
    const z0 = box.z0 - e;
    const z1 = box.z1 + e;
    const out: [number, number][] = [];
    for (let x = x0; x <= x1 + 1e-9; x += 0.25) out.push([x, z0], [x, z1]);
    for (let z = z0; z <= z1 + 1e-9; z += 0.25) out.push([x0, z], [x1, z]);
    return out;
  };

  it('під домом острів поглиблено: земля всередині стін нижча за підлогу льоху, а яма не доходить до низу острова', () => {
    for (let x = box.x0 + 0.1; x <= box.x1 - 0.1 + 1e-9; x += 0.25)
      for (let z = box.z0 + 0.1; z <= box.z1 - 0.1 + 1e-9; z += 0.25)
        expect(groundAt(x, z)).toBeLessThan(cellar - 0.05);
    expect(
      groundAt((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2) -
        new Box3().setFromObject(props.island.group).min.y,
    ).toBeGreaterThanOrEqual(1);
  });

  it('вимощення — від лиця стін на HOUSE_SKIRT.width, а за ним земля рівна й освітлена як рівна', () => {
    const s = new Box3().setFromObject(props.house.part('skirt'));
    const d = 0.1 + HOUSE_SKIRT.width;
    expect(s.min.x).toBeCloseTo(box.x0 - d, 3);
    expect(s.max.x).toBeCloseTo(box.x1 + d, 3);
    expect(s.min.z).toBeCloseTo(box.z0 - d, 3);
    expect(s.max.z).toBeCloseTo(box.z1 + d, 3);
    expect(s.max.y).toBeCloseTo(HOUSE_SKIRT.top, 3);
    for (const e of [d + 0.05, d + 0.5])
      for (const [x, z] of around(e)) expect(Math.abs(groundAt(x, z))).toBeLessThanOrEqual(0.01);
    // the grass round the pit does not shine like a slope: every vertex of the island at y = 0 has the normal (0, 1, 0)
    let flat = 0;
    let tilted = 0;
    props.island.group.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const p = o.geometry.getAttribute('position');
      const n = o.geometry.getAttribute('normal');
      for (let i = 0; i < p.count; i++)
        if (p.getY(i) === 0) {
          flat++;
          if (Math.abs(n.getY(i) - 1) > 1e-6) tilted++;
        }
    });
    expect(flat).toBeGreaterThan(0);
    expect(tilted).toBe(0);
  });

  it('підлога кімнат — від slabY до 0 з вирізом рівно на slabCut, а крізь виріз видно підлогу льоху', () => {
    const floor = props.house.part('floor');
    const f = new Box3().setFromObject(floor);
    expect(f.min.y).toBeCloseTo(H.slabY, 3);
    expect(f.max.y).toBeCloseTo(0, 3);
    const { min, max } = H.slabCut;
    const inBox = (x: number, z: number) => x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1;
    // the middle of each edge of the cut, and which way is outward from it
    const edges: [number, number, number, number][] = [
      [min[0], (min[1] + max[1]) / 2, -1, 0],
      [max[0], (min[1] + max[1]) / 2, 1, 0],
      [(min[0] + max[0]) / 2, min[1], 0, -1],
      [(min[0] + max[0]) / 2, max[1], 0, 1],
    ];
    let outside = 0;
    for (const [x, z, dx, dz] of edges) {
      expect(down(floor, x - 0.05 * dx, 0.5, z - 0.05 * dz)).toBeUndefined();
      if (!inBox(x + 0.05 * dx, z + 0.05 * dz)) continue;
      outside++;
      expect(down(floor, x + 0.05 * dx, 0.5, z + 0.05 * dz)).toBeCloseTo(0, 3);
    }
    expect(outside).toBeGreaterThan(0);
    // the first thing a ray through the cut meets is the top of the cellar floor
    expect(down(props.house.group, (min[0] + max[0]) / 2, 0.5, (min[1] + max[1]) / 2)).toBeCloseTo(cellar, 3);
  });

  it('кіт рухається за часом, а не за кроками', () => {
    const pose = () => {
      const head = props.cat.part('head').rotation;
      const tail = props.cat.part('tail').rotation;
      return [head.x, head.y, head.z, tail.x, tail.y, tail.z];
    };
    props.cat.update(0.5, 2);
    const first = pose();
    for (const [dt, t] of [
      [0.016, 0.3],
      [0.1, 7.25],
      [1.2, 13.9],
      [0.033, 2.4],
    ] as const)
      props.cat.update(dt, t);
    expect(pose()).not.toEqual(first); // the head and tail do move…
    props.cat.update(0.5, 2);
    expect(pose()).toEqual(first); // …and come back to the same pose at the same time
  });
});
