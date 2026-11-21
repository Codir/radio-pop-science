/**
 * Inside the resistor (`film.ts`, docs/volumes/electronics/VISUAL.md §7): the carbon film on its ceramic rod with the
 * helical groove trimmed into it, the end caps, the lacquer with the bands taken away by the door's cut, the electrons
 * along the strip and the heat of the model. What the drawing says of the model is pure: the turns of the groove grow
 * with the value and stay within bounds (`filmTurns`), the electrons' speed is the model's current times one number
 * (`electronSpeed`). The view stays inside the part's body, costs at most eight draw calls, draws nothing while the
 * part is whole and gives the part back whole when it goes. No WebGL: the scene graph and the numbers.
 */
import { Box3, Matrix4, Vector3, type InstancedMesh, type Material, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PARTS } from '@electronics/sim/core';
import { AXIAL_Y, RESISTOR, buildPart, resistorRadius, type PartModel } from '../../parts';
import { CLOSED } from '../wedge';
import { FILM, createFilm, electronSpeed, filmTurns } from '../film';

const make = (key = 'resistor-330'): PartModel => {
  const m = buildPart(key)!;
  m.group.updateWorldMatrix(true, true);
  return m;
};
const UP = new Vector3(0, 1, 0);

/** The meshes that would be drawn now under `root` (visible all the way up), an instanced one counted once. */
function drawn(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = o; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    const material = m.material as Material | Material[];
    if (Array.isArray(material) ? material.every((x) => !x.visible) : !material.visible) return;
    if ((m as InstancedMesh).isInstancedMesh && (m as InstancedMesh).count === 0) return;
    out.push(m);
  });
  return out;
}

/** Whether three's clipping (with `clipIntersection`) removes a point of the body frame (the model at the origin). */
function clipped(m: Material, p: Vector3): boolean {
  const planes = m.clippingPlanes ?? [];
  if (planes.length === 0) return false;
  const out = planes.map((pl) => pl.distanceToPoint(p) < 0);
  return m.clipIntersection ? out.every(Boolean) : out.some(Boolean);
}

describe('filmTurns — the groove’s turns as a drawing of «more groove, more Ω»', () => {
  const values = Object.values(PARTS)
    .flatMap((s) => (s.kind === 'resistor' ? [s.ohms] : []))
    .sort((a, b) => a - b);

  it('never falls as the value grows, grows across the pilot’s values, and stays within its bounds', () => {
    let last = -Infinity;
    for (const ohms of values) {
      const n = filmTurns(ohms);
      expect(n, `${ohms} Ω`).toBeGreaterThanOrEqual(last);
      expect(n).toBeGreaterThanOrEqual(FILM.turns.min);
      expect(n).toBeLessThanOrEqual(FILM.turns.max);
      last = n;
    }
    // strictly between the values the chapters show: 100 Ω … 1 kΩ … 10 kΩ
    expect(filmTurns(100)).toBeLessThan(filmTurns(330));
    expect(filmTurns(330)).toBeLessThan(filmTurns(1000));
    expect(filmTurns(1000)).toBeLessThan(filmTurns(4700));
    expect(filmTurns(4700)).toBeLessThan(filmTurns(10_000));
    // `resistor/inside`: 10 kΩ has clearly more turns than 330 Ω
    expect(filmTurns(10_000) - filmTurns(330)).toBeGreaterThanOrEqual(2);
    // the ends of the scale are held, and a value out of the catalog or no value at all is the least
    expect(filmTurns(1)).toBe(FILM.turns.min);
    expect(filmTurns(1e7)).toBe(FILM.turns.max);
    expect(filmTurns(1e12)).toBe(FILM.turns.max);
    expect(filmTurns(0)).toBe(FILM.turns.min);
    expect(filmTurns(Number.NaN)).toBe(FILM.turns.min);
  });
});

describe('electronSpeed — the electrons’ speed along the strip from the model’s current', () => {
  it('is proportional to the current, the other way to it (electrons are negative), and held at a top speed', () => {
    const k = electronSpeed(0.001) / 0.001;
    expect(k).toBeLessThan(0);
    for (const amps of [1e-6, 0.000734, 0.0212, 0.05, -0.0212]) expect(electronSpeed(amps)).toBeCloseTo(k * amps, 12);
    // `resistor/inside`: 21.235 mA against 0.7336 mA — 29 times slower
    expect(electronSpeed(0.0212351) / electronSpeed(0.0007336)).toBeCloseTo(0.0212351 / 0.0007336, 9);
    expect(electronSpeed(0)).toBe(0);
    expect(Math.abs(electronSpeed(10))).toBe(FILM.electrons.top);
    expect(electronSpeed(Number.NaN)).toBe(0);
  });
});

describe('the film inside a resistor (createFilm)', () => {
  it('draws nothing while the part is whole, and opens on the camera’s side with the door’s cut', () => {
    const m = make();
    const film = createFilm(m);
    film.set(0, UP);
    film.update(1 / 60, 0);
    expect(film.open).toBe(false);
    expect(drawn(film.group)).toEqual([]);
    const body = m.body[0]!;
    // closed: the body clips nothing
    expect(clipped(body, new Vector3(0, AXIAL_Y + 0.12, 0))).toBe(false);
    film.cut(1);
    film.update(1 / 60, 1 / 60);
    expect(film.open).toBe(true);
    expect(film.amount).toBe(1);
    // the lacquer on the camera's side (+y here) is gone, the far side is kept; the legs are never cut
    expect(clipped(body, new Vector3(0.05, AXIAL_Y + 0.12, 0))).toBe(true);
    expect(clipped(body, new Vector3(0.05, AXIAL_Y - 0.12, 0))).toBe(false);
    expect(((m.legs.material as Material).clippingPlanes ?? []).length).toBe(0);
    // the wedge turns to the camera given with it
    film.set(1, new Vector3(0, 0, 1));
    film.update(0, 1 / 60);
    expect(clipped(body, new Vector3(0.05, AXIAL_Y, 0.12))).toBe(true);
    expect(clipped(body, new Vector3(0.05, AXIAL_Y + 0.12, 0))).toBe(false);
    // below CLOSED it is whole again
    film.cut(CLOSED / 2);
    film.update(0, 1 / 60);
    expect(film.open).toBe(false);
    expect(drawn(film.group)).toEqual([]);
  });

  it('stays inside the part’s body: everything it draws within the body’s box', () => {
    for (const key of ['resistor-1', 'resistor-330', 'resistor-10k', 'resistor-10M']) {
      const m = make(key);
      const film = createFilm(m);
      film.set(1, UP);
      film.flow(0.02);
      film.update(1 / 60, 0);
      film.burnt(true);
      film.update(1 / 60, 1 / 60);
      const L = RESISTOR.length;
      // the body with its bands' paint, which stands that far over it (`parts/resistor.ts`)
      const R = RESISTOR.radius + FILM.paint + 1e-6;
      // (the positions are float32: a micrometre of slack)
      const X = L / 2 + 1e-6;
      const bodyBox = new Box3(new Vector3(-X, AXIAL_Y - R, -R), new Vector3(X, AXIAL_Y + R, R));
      m.bodyGroup.updateWorldMatrix(true, true);
      const toBody = new Matrix4().copy(m.bodyGroup.matrixWorld).invert();
      for (const mesh of drawn(film.group)) {
        // the electrons are drawn by a shader from their points (checked below), not from their quad's own box
        if (mesh.name === 'film:electrons') continue;
        const box = new Box3();
        const inst = mesh as InstancedMesh;
        if (inst.isInstancedMesh) {
          inst.computeBoundingBox();
          box.copy(inst.boundingBox!);
        } else {
          mesh.geometry.computeBoundingBox();
          box.copy(mesh.geometry.boundingBox!);
        }
        box.applyMatrix4(new Matrix4().multiplyMatrices(toBody, mesh.matrixWorld));
        expect(bodyBox.containsBox(box), `${key}: ${mesh.name}`).toBe(true);
      }
      // the electrons are points the film computes: every one on the strip, under the waist
      for (const p of film.electrons()) {
        const r = Math.hypot(p.y - AXIAL_Y, p.z);
        expect(r, key).toBeLessThan(resistorRadius(L / 2));
        expect(Math.abs(p.x)).toBeLessThanOrEqual(L / 2);
      }
    }
  });

  it('costs at most eight draw calls for the whole view, burnt and with every electron', () => {
    const m = make();
    const film = createFilm(m);
    film.set(1, UP);
    film.flow(0.03);
    film.heat(0.9);
    film.burnt(true);
    film.update(1 / 60, 0);
    const calls = drawn(film.group);
    expect(calls.length, calls.map((c) => c.name).join(', ')).toBeLessThanOrEqual(8);
    expect(calls.length).toBeGreaterThanOrEqual(5);
    // the grains and the electrons are one instanced call each
    expect(calls.filter((c) => (c as InstancedMesh).isInstancedMesh).length).toBeGreaterThanOrEqual(1);
  });

  it('draws its strip from outside: every face wound to face away from the rod, its shading normal the same way', () => {
    const film = createFilm(make('resistor-4k7'));
    const strip = film.group.getObjectByName('film:strip') as Mesh;
    const pos = strip.geometry.getAttribute('position');
    const nor = strip.geometry.getAttribute('normal');
    const [a, b, c, n, e1, e2, mid, out] = Array.from({ length: 8 }, () => new Vector3());
    let tops = 0;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      if (n.lengthSq() < 1e-14) continue; // a sliver where the strip is held under a cap
      n.normalize();
      // the winding (what the GPU culls by) agrees with the shading normal
      expect(n.dot(out.fromBufferAttribute(nor, i))).toBeGreaterThan(0.99);
      // a face of the top faces away from the axis
      mid.copy(a).add(b).add(c).divideScalar(3);
      const radial = out.set(0, mid.y - AXIAL_Y, mid.z).normalize();
      if (Math.abs(n.dot(radial)) > 0.9) {
        expect(n.dot(radial)).toBeGreaterThan(0);
        tops++;
      }
    }
    expect(tops).toBeGreaterThan(100);
  });

  it('cuts its groove for the value: more turns, a longer and narrower strip for more Ω', () => {
    const film = createFilm(make('resistor-330'));
    const at330 = film.state();
    expect(at330.turns).toBe(filmTurns(330));
    const n = film.turns(10_000);
    expect(n).toBe(filmTurns(10_000));
    const at10k = film.state();
    expect(at10k.turns).toBe(n);
    expect(at10k.path).toBeGreaterThan(at330.path);
    expect(at10k.width).toBeLessThan(at330.width);
  });

  it('moves its electrons along the strip by the model’s current, and stops them with no current', () => {
    const film = createFilm(make());
    film.set(1, UP);
    film.flow(0.0212351);
    film.update(0, 0);
    const before = film.electrons().map((p) => p.clone());
    expect(before.length).toBeGreaterThan(20);
    film.update(0.1, 0.1);
    const s = film.state();
    expect(s.speed).toBeCloseTo(electronSpeed(0.0212351), 12);
    expect(s.amps).toBe(0.0212351);
    // every electron moved by at most the speed times the time along the strip (the path is a helix), but one that
    // came round from the end of the strip to its start: that happens under the caps, where none is seen
    const after = film.electrons();
    const along = Math.abs(s.speed) * 0.1;
    const under = (p: Vector3) => Math.abs(p.x) >= RESISTOR.length / 2 - FILM.cap.to - FILM.electrons.radius;
    const round = after.filter((p, i) => p.distanceTo(before[i]!) > along * 1.01 + 1e-9);
    for (const p of round) expect(under(p) && under(before[after.indexOf(p)]!)).toBe(true);
    expect(round.length).toBeLessThan(before.length * 0.1);
    const moved = after.map((p, i) => p.distanceTo(before[i]!));
    expect(moved.filter((d) => d > along * 0.5 && d <= along * 1.01).length).toBeGreaterThan(before.length * 0.8);
    // conventional current into leg 0 (positive): the electrons drift toward leg 0 (−x of the body frame)
    const kept = after.map((p, i) => [p, before[i]!] as const).filter(([p]) => !round.includes(p));
    const dx = kept.reduce((sum, [p, q]) => sum + (p.x - q.x), 0) / kept.length;
    expect(dx).toBeLessThan(0);
    // no current, no drift; a held frame (dt 0) moves nothing either
    film.flow(0);
    const still = film.electrons().map((p) => p.clone());
    film.update(0.5, 0.6);
    expect(film.electrons().every((p, i) => p.distanceTo(still[i]!) < 1e-12)).toBe(true);
  });

  it('takes the heat of the model as a colour of its surface, never as light; burnt, the strip breaks', () => {
    const film = createFilm(make());
    film.set(1, UP);
    film.heat(0.4);
    film.update(1 / 60, 0);
    expect(film.state().surface.tint).toBe(0);
    film.heat(1);
    film.update(1 / 60, 0);
    expect(film.state().surface.tint).toBeCloseTo(0.3, 9);
    // nothing of the view is emissive
    film.group.traverse((o) => {
      const mat = (o as Mesh).material as { emissiveIntensity?: number; uniforms?: Record<string, { value: unknown }> };
      if (mat?.emissiveIntensity !== undefined) expect(mat.emissiveIntensity, o.name).toBe(0);
    });
    expect(film.state().burnt).toBe(false);
    film.burnt(true);
    film.update(1 / 60, 0);
    expect(film.state().burnt).toBe(true);
    expect(film.group.getObjectByName('film:burn')!.visible).toBe(true);
  });

  it('gives the callouts their points: on the strip, on the groove, on the rod, each on the camera’s side', () => {
    const m = make();
    const film = createFilm(m);
    film.set(1, UP);
    film.update(0, 0);
    m.bodyGroup.updateWorldMatrix(true, true);
    for (const name of ['film', 'groove', 'rod'] as const) {
      const p = m.bodyGroup.worldToLocal(film.anchor(name, new Vector3()));
      expect(Math.abs(p.x), name).toBeLessThan(RESISTOR.length / 2);
      // within the opened wedge, toward the camera (+y)
      expect(p.y - AXIAL_Y, name).toBeGreaterThan(0);
      expect(Math.hypot(p.y - AXIAL_Y, p.z), name).toBeLessThanOrEqual(FILM.film + 1e-6);
    }
  });

  it('gives the part back whole when it is disposed', () => {
    const m = make();
    const before = m.materials.map((x) => x.clippingPlanes);
    const film = createFilm(m);
    film.set(1, UP);
    film.update(0, 0);
    film.dispose();
    expect(m.materials.map((x) => x.clippingPlanes)).toEqual(before);
    expect(film.group.parent).toBeNull();
  });
});
