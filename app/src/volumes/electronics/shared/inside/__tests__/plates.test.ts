/**
 * Inside an electrolytic capacitor (`plates.ts`, docs/volumes/electronics/VISUAL.md §7, batch E4): the can cut in
 * half about its vertical axis on the camera's side, two plates over the legs with the insulator between them, the
 * charges on their inner sides as many as the voltage across the capacitance says (`chargeCount`), the electrons in
 * the legs at the speed of the model's current. For every can of the catalog: everything it draws within the part's
 * box, at most six draw calls of its own (nine with the part), the callouts' points on what the cut lays open and in
 * the camera's sight, nothing while the part is whole, the part given back whole. No WebGL: the scene graph and the
 * numbers.
 */
import {
  Box3,
  Color,
  Matrix4,
  Vector3,
  type InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { PARTS } from '@electronics/sim/core';
import { BOARD_SPEC } from '@electronics/sim/board';
import { STAGE_FOV } from '../../bench/shots';
import { PART_VIEW } from '../../dive/poses';
import { CAN, LEG, RADIAL_Y, buildPart, type PartModel } from '../../parts';
import { LEG_COLOR, mix } from '../../parts/part';
import { electronSpeed } from '../film';
import { PLATES, asPlates, chargeCount, createPlates, platesLayout } from '../plates';
import { CLOSED, INSET } from '../wedge';

const P = BOARD_SPEC.pitch;
const CANS = Object.entries(PARTS)
  .flatMap(([key, s]) => (s.kind === 'capacitor' && s.dielectric === 'electrolytic' ? [key] : []))
  .sort();
const make = (key = 'electrolytic-470u-16v'): PartModel => {
  const m = buildPart(key)!;
  m.group.updateWorldMatrix(true, true);
  return m;
};
/** The door's line of sight in the body frame of a part at the orientation 0: 60° over the board, from the reader. */
const FRONT = new Vector3(0, Math.sin(PART_VIEW.elevation), Math.cos(PART_VIEW.elevation));
const BACK = new Vector3(0, FRONT.y, -FRONT.z);

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
/** The orbs drawn of a set (their centres, body frame: the view is a child of the body at the origin). */
function orbsOf(group: Object3D, name: string): Vector3[] {
  const o = group.getObjectByName(name) as Mesh;
  const a = o.geometry.getAttribute('aInst') as InstancedBufferAttribute;
  const out: Vector3[] = [];
  for (let i = 0; i < a.count; i++) if (a.getW(i) > 0) out.push(new Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  return out;
}
/** The part's box in its body frame (its `hit`). */
const boxOf = (m: PartModel): Box3 =>
  new Box3().setFromCenterAndSize(m.hit.position.clone(), m.hit.scale.clone());
/** An opened view at a voltage across the capacitance, a current into leg 0, a frame later. */
function opened(key: string, volts = 8.968, amps = 0, view = FRONT) {
  const m = make(key);
  const plates = createPlates(m);
  plates.set(1, view);
  plates.follow({ amps, heat: 0, burnt: false, volts, bulged: false }, 1 / 60, 0);
  return { m, plates, L: platesLayout(m.hit.scale.x / 2, m.hit.scale.y) };
}

describe('chargeCount — the charges on each plate from the voltage across the capacitance', () => {
  it('is round(N · |V| / 9), held to 0 … N; the numbers of `capacitor/inside`', () => {
    const N = PLATES.charges.count;
    expect(N).toBe(60);
    expect(chargeCount(0)).toBe(0);
    expect(chargeCount(9)).toBe(N);
    expect(chargeCount(12)).toBe(N);
    expect(chargeCount(4.5)).toBe(30);
    // the script's model run: closed 8.968 V; 0.5 s, 1 s and 10 s after the switch opens 2.02, 1.61 and 1.36 V
    expect(chargeCount(8.968)).toBe(60);
    expect(chargeCount(2.02)).toBe(13);
    expect(chargeCount(1.61)).toBe(11);
    expect(chargeCount(1.36)).toBe(9);
    // charged the other way round: as many
    expect(chargeCount(-3)).toBe(20);
    expect(chargeCount(Number.NaN)).toBe(0);
    let last = -1;
    for (let v = 0; v <= 9; v += 0.01) {
      expect(chargeCount(v)).toBeGreaterThanOrEqual(last);
      last = chargeCount(v);
    }
  });
});

describe('the plates inside an electrolytic (createPlates)', () => {
  it('draws nothing while the can is whole, and cuts it in half on the camera’s side', () => {
    const m = make();
    const plates = createPlates(m);
    plates.set(0, FRONT);
    plates.update(1 / 60, 0);
    expect(plates.open).toBe(false);
    expect(drawn(plates.group)).toEqual([]);
    const sleeve = m.body[0]!;
    expect(clipped(sleeve, new Vector3(0, 0.9, 0.4))).toBe(false);
    plates.cut(1);
    expect(plates.open).toBe(true);
    expect(plates.amount).toBe(1);
    // the half toward the camera is gone, the far half kept; the legs are never cut
    expect(clipped(sleeve, new Vector3(0, 0.9, 0.4))).toBe(true);
    expect(clipped(sleeve, new Vector3(0, 0.9, -0.4))).toBe(false);
    expect(((m.legs.material as Material).clippingPlanes ?? []).length).toBe(0);
    // the inside is cut by the same half: a plate's near half goes, its far half stays
    const metal = plates.group.getObjectByName('plates:metal') as Mesh;
    expect(clipped(metal.material as Material, new Vector3(-P / 2, 0.9, 0.2))).toBe(true);
    expect(clipped(metal.material as Material, new Vector3(-P / 2, 0.9, -0.2))).toBe(false);
    plates.cut(CLOSED / 2);
    expect(plates.open).toBe(false);
    expect(drawn(plates.group)).toEqual([]);
  });

  it('stands the plates over the legs (plus over leg 0, minus under the stripe), the insulator on the plus', () => {
    // thinner than the plate (a real can's insulator is an oxide tens of nanometres thick on its plus foil)
    expect(PLATES.insulator.thick).toBeLessThanOrEqual(PLATES.plate.thick / 2);
    for (const key of CANS) {
      const { L, plates } = opened(key);
      expect(L.x).toBeCloseTo(P / 2, 12);
      expect(L.bottom).toBeLessThan(L.top);
      // the skin lies on the plus plate's inner side (leg 0's, −x), as tall and as deep as the plate: no free sheet
      expect(L.ins.x0).toBeCloseTo(-L.x + L.half, 12);
      expect(L.ins.x1 - L.ins.x0).toBeCloseTo(PLATES.insulator.thick, 12);
      expect(L.ins.cx).toBeCloseTo((L.ins.x0 + L.ins.x1) / 2, 12);
      expect([L.ins.bottom, L.ins.top, L.ins.depth]).toEqual([L.bottom, L.top, L.depth]);
      const skin = plates.group.getObjectByName('plates:insulator') as Mesh;
      skin.geometry.computeBoundingBox();
      const b = skin.geometry.boundingBox!.clone().translate(skin.position);
      expect(b.min.x).toBeCloseTo(L.ins.x0, 6);
      expect(b.max.x).toBeCloseTo(L.ins.x1, 6);
      expect(b.min.y).toBeCloseTo(L.bottom, 6);
      expect(b.max.y).toBeCloseTo(L.top, 6);
      // the charges of the plus plate in its skin, room for them between it and the minus plate
      expect(L.x - L.half - L.ins.x1).toBeGreaterThan(4 * PLATES.charges.radius);
      // the plates within the can's inner wall, over the bung, under the top
      expect(Math.hypot(L.x + L.half, L.depth)).toBeLessThan(L.inner);
      expect(L.top).toBeLessThan(L.ceiling);
      expect(L.bottom).toBeGreaterThan(L.floor);
    }
  });

  it('stays inside the part’s box for every can: every mesh of the inside and every charge (bulged: up to its dome)', () => {
    for (const key of CANS) {
      for (const bulged of [false, true]) {
        const { m, plates } = opened(key, 9, 0.02);
        plates.follow({ amps: 0.02, heat: 0, burnt: false, volts: bulged ? 0 : 9, bulged }, 1 / 60, 1 / 60);
        const box = boxOf(m).expandByScalar(1e-6);
        // the bulged top domes 0.05 over the can and the sleeve swells (VISUAL §4.8), its section with it
        if (bulged) {
          box.max.y += CAN.bulge.dome;
          const swell = (CAN.bulge.swell - 1) * (m.hit.scale.x / 2);
          box.expandByVector(new Vector3(swell, 0, swell));
        }
        m.bodyGroup.updateWorldMatrix(true, true);
        const toBody = new Matrix4().copy(m.bodyGroup.matrixWorld).invert();
        const meshes = drawn(plates.group).filter((x) => !x.name.startsWith('plates:plus') && x.name !== 'plates:electrons');
        expect(meshes.length, key).toBeGreaterThanOrEqual(4);
        for (const mesh of meshes) {
          mesh.geometry.computeBoundingBox();
          const b = mesh.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBody, mesh.matrixWorld));
          expect(box.containsBox(b), `${key}${bulged ? ' bulged' : ''}: ${mesh.name}`).toBe(true);
        }
        // the charges within the can; the electrons of the legs on their legs (the legs stand straight here)
        const { positive, negative } = plates.charges();
        for (const p of [...positive, ...negative]) expect(box.containsPoint(p), key).toBe(true);
        const ER = PLATES.charges.radius * PLATES.electrons.scale;
        for (const { at, shown } of plates.legElectrons()) {
          if (!shown) continue;
          const leg = at.x < 0 ? -P / 2 : P / 2;
          expect(Math.hypot(at.x - leg, at.z), key).toBeLessThanOrEqual(LEG.radius + ER + INSET + 1e-6);
          expect(at.y).toBeGreaterThan(0);
          expect(at.y).toBeLessThan(platesLayout(m.hit.scale.x / 2, m.hit.scale.y).bottom);
        }
      }
    }
  });

  it('costs at most six draw calls of its own and nine with the part, for every can, bulged or not', () => {
    for (const key of CANS) {
      const { m, plates } = opened(key, 8.968, 0.02);
      const calls = drawn(m.bodyGroup);
      const own = drawn(plates.group);
      expect(own.map((c) => c.name).sort(), key).toEqual([
        'plates:core',
        'plates:electrons',
        'plates:faces',
        'plates:insulator',
        'plates:metal',
        'plates:plus',
      ]);
      expect(calls.length, `${key}: ${calls.map((c) => c.name).join(', ')}`).toBeLessThanOrEqual(9);
      expect(plates.state().drawCalls, key).toBe(calls.length);
      expect(plates.state().insideCalls, key).toBe(6);
      expect(calls).toContain(m.legs);
      // bulged: the part shows its dome instead of its flat top, the inside's crack is in its one mesh
      plates.bulged(true);
      m.setLook({ status: 'bulged' }, 1 / 60);
      plates.update(1 / 60, 0);
      expect(drawn(plates.group).length, key).toBeLessThanOrEqual(6);
      expect(plates.state().drawCalls, key).toBeLessThanOrEqual(9);
    }
  });

  it('puts as many charges on each plate as the voltage across the capacitance says, pair facing pair', () => {
    for (const key of CANS) {
      for (const volts of [8.968, 2.02, 1.61, 1.36, 0, -3]) {
        const { plates, L } = opened(key, volts);
        const n = chargeCount(volts);
        const s = plates.state();
        expect(s.volts).toBe(volts);
        expect(s.charges, `${key} ${volts} V`).toBe(n);
        // what is drawn is what it says: the orbs of each set (the legs' electrons apart)
        const plus = orbsOf(plates.group, 'plates:plus');
        const minus = orbsOf(plates.group, 'plates:electrons').filter((p) => p.y >= L.bottom);
        expect(plus.length, `${key} ${volts} V`).toBe(n);
        expect(minus.length, `${key} ${volts} V`).toBe(n);
        // the «+» on the plate at the higher potential: the plus one (leg 0, −x) unless charged the other way round
        const sign = volts >= 0 ? -1 : 1;
        expect(s.positive).toBe(volts >= 0 ? 'plus' : 'minus');
        for (const p of plus) expect(Math.sign(p.x)).toBe(sign);
        for (const p of minus) expect(Math.sign(p.x)).toBe(-sign);
        // each charge on its plate's inner side, pair facing pair, on the half the cut leaves (z ≤ 0 seen from +z)
        const { positive, negative } = plates.charges();
        positive.forEach((p, i) => {
          const q = negative[i]!;
          expect(p.y).toBeCloseTo(q.y, 12);
          expect(p.z).toBeCloseTo(q.z, 12);
          expect(p.x).toBeCloseTo(-q.x, 12);
          expect(Math.abs(p.x)).toBeLessThan(L.x - L.half);
          expect(Math.abs(p.x)).toBeGreaterThan(L.x - L.half - PLATES.charges.radius);
          expect(p.z).toBeLessThan(0);
          expect(p.y).toBeGreaterThan(L.bottom);
          expect(p.y).toBeLessThan(L.top);
        });
      }
    }
    // the count follows the voltage it is given, never the current: the same voltage, any current, the same charges
    const a = opened('electrolytic-470u-16v', 5, 0).plates.state().charges;
    const b = opened('electrolytic-470u-16v', 5, 4.17).plates.state().charges;
    expect(a).toBe(b);
    // bulged: no charges, whatever the voltage it is told
    const { plates } = opened('electrolytic-470u-16v', 9);
    plates.follow({ amps: 0.009, heat: 1, burnt: false, volts: 9, bulged: true }, 1 / 60, 0);
    expect(plates.state().charges).toBe(0);
    expect(orbsOf(plates.group, 'plates:plus')).toEqual([]);
    expect(plates.state().bulged).toBe(true);
  });

  it('bulged: the insulator cracked where the camera sees it, the top’s section domed, no charges', () => {
    for (const key of CANS) {
      const { m, plates, L } = opened(key, 9);
      const core = plates.group.getObjectByName('plates:core') as Mesh;
      const faces = plates.group.getObjectByName('plates:faces') as Mesh;
      const vertices = (x: Mesh) => x.geometry.getAttribute('position').count;
      const top = (): number => {
        faces.geometry.computeBoundingBox();
        return faces.geometry.boundingBox!.max.y;
      };
      const ink = mix('ink', 'steel', 0.12).getHexString();
      /** The section's triangles of some area in the crack's colour: their corners. */
      const darkOnCut = (): Vector3[] => {
        const pos = faces.geometry.getAttribute('position');
        const colors = faces.geometry.getAttribute('color');
        const out: Vector3[] = [];
        for (let i = 0; i < pos.count; i += 3) {
          if (new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString() !== ink) continue;
          const t = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(pos, i + j));
          const area = new Vector3().subVectors(t[1]!, t[0]!).cross(new Vector3().subVectors(t[2]!, t[0]!)).length();
          if (area > 1e-9) out.push(...t);
        }
        return out;
      };
      const whole = vertices(core);
      expect(top(), key).toBeCloseTo(L.y1, 3);
      expect(darkOnCut(), key).toEqual([]);
      plates.follow({ amps: 0.009, heat: 1, burnt: false, volts: 0, bulged: true }, 1 / 60, 0);
      plates.update(0, 0);
      // on the cut: a dark band up through the skin's strip, within it, from its bottom to its top
      const cut = darkOnCut();
      expect(cut.length, key).toBeGreaterThan(30);
      for (const p of cut) {
        expect(p.x, key).toBeGreaterThanOrEqual(L.ins.x0 - 1e-6);
        expect(p.x, key).toBeLessThanOrEqual(L.ins.x1 + 1e-6);
        expect(p.z, key).toBeCloseTo(-INSET, 6);
      }
      const ys = cut.map((p) => p.y);
      expect(Math.min(...ys), key).toBeCloseTo(L.ins.bottom, 6);
      expect(Math.max(...ys), key).toBeCloseTo(L.ins.top, 6);
      // it zigzags: across the skin, the band's middle swings by more than half the skin's thickness
      const xs = cut.map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs), key).toBeGreaterThan(0.75 * PLATES.insulator.thick);
      // up the skin's face by the cut: the crack joins the inside's one mesh, on the skin's face toward the minus
      // plate, just behind the cut on the half it leaves, from the plate's bottom to its top
      expect(vertices(core), key).toBeGreaterThan(whole);
      const pos = core.geometry.getAttribute('position');
      const crack: Vector3[] = [];
      for (let i = 0; i < pos.count; i++) {
        const p = new Vector3().fromBufferAttribute(pos, i);
        // (the inner wall and the bottom stand off the skin: at the wall's radius, or on the floor)
        if (Math.hypot(p.x, p.z) > L.inner - 1e-3 || p.y < L.floor + 0.005) continue;
        crack.push(p);
      }
      expect(crack.length, key).toBeGreaterThan(20);
      const { radius, near, far } = PLATES.crack;
      for (const p of crack) {
        expect(p.x, key).toBeGreaterThanOrEqual(L.ins.x1 - radius - 1e-6);
        expect(p.x, key).toBeLessThanOrEqual(L.ins.x1 + 2 * radius + 1e-6);
        expect(p.z, key).toBeLessThanOrEqual(-near + 1e-6);
        expect(p.z, key).toBeGreaterThanOrEqual(-far - 1e-6);
        expect(p.y, key).toBeGreaterThanOrEqual(L.ins.bottom - radius - 1e-6);
        expect(p.y, key).toBeLessThanOrEqual(L.ins.top + radius + 1e-6);
      }
      // in the camera's sight: the line from the crack's front toward the door's camera on `inside` meets no plate
      // and no skin, and leaves the can where the cut took it (z > 0), never through its kept wall or top
      const size = Math.max(m.hit.scale.x, m.hit.scale.y, m.hit.scale.z);
      const distance = size / (PART_VIEW.inside * 2 * Math.tan(((STAGE_FOV / 2) * Math.PI) / 180) * 1.5);
      const camera = m.hit.position.clone().addScaledVector(FRONT, distance);
      const front = crack.filter((p) => p.x > L.ins.x1 + radius);
      expect(front.length, key).toBeGreaterThan(10);
      const blocked: string[] = [];
      for (const at of front.filter((_, i) => i % 3 === 0)) {
        const dir = camera.clone().sub(at).normalize();
        const q = new Vector3();
        let left: Vector3 | null = null;
        for (let k = 1; k <= 4000 && !left; k++) {
          q.copy(at).addScaledVector(dir, k * 0.0005);
          const inside = q.y > L.bottom && q.y < L.top && Math.abs(q.z) < L.depth;
          if (inside && Math.abs(q.x + L.x) < L.half) blocked.push('the plus plate');
          if (inside && Math.abs(q.x - L.x) < L.half) blocked.push('the minus plate');
          if (inside && q.x > L.ins.x0 && q.x < L.ins.x1) blocked.push('the skin');
          if (Math.hypot(q.x, q.z) > L.r || q.y > L.y1) left = q.clone();
        }
        if (!left || left.z <= 0) blocked.push(`leaves at ${left?.toArray().join(', ')}, not through the cut`);
      }
      expect(blocked, key).toEqual([]);
      expect(top(), key).toBeGreaterThan(L.y1 + CAN.bulge.dome * 0.9);
      expect(plates.state().charges, key).toBe(0);
      // whole again (a new part would be): the crack goes, the top is flat
      plates.bulged(false);
      plates.update(0, 0);
      expect(vertices(core), key).toBe(whole);
      expect(darkOnCut(), key).toEqual([]);
      expect(top(), key).toBeCloseTo(L.y1, 3);
    }
  });

  it('seen from behind, the cut and the charges turn to the back', () => {
    const { plates, m } = opened('electrolytic-470u-16v', 9, 0, BACK);
    expect(clipped(m.body[0]!, new Vector3(0, 0.9, -0.4))).toBe(true);
    for (const p of plates.charges().positive) expect(p.z).toBeGreaterThan(0);
    // still the «+» over leg 0: the plates do not swap sides with the camera
    for (const p of plates.charges().positive) expect(p.x).toBeLessThan(0);
  });

  it('moves the electrons of the legs at the speed of the model’s current: out of the plus plate while it charges', () => {
    const { plates, L } = opened('electrolytic-470u-16v', 9, 0.02);
    const before = plates.legElectrons().map((e) => e.at.clone());
    plates.update(0.1, 0.1);
    const after = plates.legElectrons().map((e) => e.at.clone());
    expect(plates.state().speed).toBeCloseTo(electronSpeed(0.02), 12);
    const per = PLATES.electrons.perLeg;
    const along = Math.abs(electronSpeed(0.02)) * 0.1;
    // every electron moved that far along its leg (one that came round from its plate to its socket apart: both ends
    // are hidden, in the plate and in the socket), down leg 0, up leg 1
    let down = 0;
    let up = 0;
    after.forEach((p, i) => {
      const d = p.distanceTo(before[i]!);
      if (d > along * 1.01 + 1e-9) return;
      expect(d).toBeGreaterThan(along * 0.5);
      if (i < per && p.y < before[i]!.y) down++;
      if (i >= per && p.y > before[i]!.y) up++;
    });
    expect(down).toBeGreaterThan(per * 0.7);
    expect(up).toBeGreaterThan(per * 0.7);
    // giving the charge back (current out of leg 0): the other way
    plates.flow(-0.02);
    const back0 = plates.legElectrons().map((e) => e.at.clone());
    plates.update(0.1, 0.2);
    const back1 = plates.legElectrons().map((e) => e.at.clone());
    expect(back1.filter((p, i) => i < per && p.y > back0[i]!.y).length).toBeGreaterThan(per * 0.7);
    // no current, or a held frame: nothing moves
    plates.flow(0.02);
    const still = plates.legElectrons().map((e) => e.at.clone());
    plates.update(0, 0.2);
    expect(plates.legElectrons().every((e, i) => e.at.distanceTo(still[i]!) < 1e-12)).toBe(true);
    plates.flow(0);
    plates.update(0.5, 0.7);
    expect(plates.legElectrons().every((e, i) => e.at.distanceTo(still[i]!) < 1e-12)).toBe(true);
    // the inrush is held at the top speed
    plates.flow(4.17);
    expect(Math.abs(plates.state().speed)).toBe(0.6);
    // shown: on the leg under the can and on the cut lead inside, never in the bung, the socket or the plate
    const shown = plates.legElectrons().filter((e) => e.shown);
    expect(shown.length).toBeGreaterThan(8);
    expect(shown.some((e) => e.at.y < RADIAL_Y)).toBe(true);
    expect(shown.some((e) => e.at.y > L.floor)).toBe(true);
    expect(plates.state().legElectrons).toBe(shown.length);
  });

  it('gives its callouts points on what the cut lays open, in the camera’s sight, for every can', () => {
    for (const key of CANS) {
      const { m, plates, L } = opened(key);
      m.bodyGroup.updateWorldMatrix(true, true);
      const local = (name: 'plus' | 'minus' | 'insulator') => m.bodyGroup.worldToLocal(plates.anchor(name, new Vector3()));
      const plus = local('plus');
      const minus = local('minus');
      const ins = local('insulator');
      // on the inner side of its plate (the plus plate's in front of its skin), within it, on the half the cut leaves
      expect(plus.x).toBeCloseTo(L.ins.x1, 9);
      expect(minus.x).toBeCloseTo(L.x - L.half, 9);
      for (const p of [plus, minus]) {
        expect(p.y).toBeGreaterThan(L.bottom);
        expect(p.y).toBeLessThan(L.top);
        expect(p.z).toBeLessThan(0);
        expect(p.z).toBeGreaterThan(-L.depth);
      }
      // on the skin's section on the plus plate, under its middle
      expect(ins.x).toBeCloseTo(L.ins.cx, 9);
      expect(ins.z).toBeCloseTo(-INSET, 12);
      expect(ins.y).toBeGreaterThan(L.ins.bottom);
      expect(ins.y).toBeLessThan((L.ins.bottom + L.ins.top) / 2);
      // in sight: the line to the door's camera on `inside` meets no plate, no insulator, and leaves the can where
      // the cut took it (z > 0), never through the half it kept (its side or its top)
      const size = Math.max(m.hit.scale.x, m.hit.scale.y, m.hit.scale.z);
      const distance = size / (PART_VIEW.inside * 2 * Math.tan(((STAGE_FOV / 2) * Math.PI) / 180) * 1.5);
      const camera = m.hit.position.clone().addScaledVector(FRONT, distance);
      for (const [name, p] of [
        ['plus', plus],
        ['minus', minus],
        ['insulator', ins],
      ] as const) {
        const dir = camera.clone().sub(p).normalize();
        let left: Vector3 | null = null;
        for (let k = 1; k <= 4000 && !left; k++) {
          const q = p.clone().addScaledVector(dir, k * 0.0005);
          const inPlate = (cx: number): boolean =>
            Math.abs(q.x - cx) < L.half - 1e-4 && q.y > L.bottom && q.y < L.top && Math.abs(q.z) < L.depth;
          expect(inPlate(-L.x) || inPlate(L.x), `${key} ${name}: through a plate`).toBe(false);
          const inIns =
            Math.abs(q.x - L.ins.cx) < L.ins.half - 1e-4 &&
            q.y > L.ins.bottom &&
            q.y < L.ins.top &&
            Math.abs(q.z) < L.ins.depth;
          if (name !== 'insulator') expect(inIns, `${key} ${name}: through the insulator`).toBe(false);
          if (Math.hypot(q.x, q.z) > L.r || q.y > L.y1) left = q;
        }
        expect(left, `${key} ${name}`).not.toBeNull();
        expect(left!.z, `${key} ${name}: leaves through the half the cut took`).toBeGreaterThan(0);
      }
    }
  });

  it('lays its section faces in the cut’s plane, facing the camera’s side, the plates and the leads among them', () => {
    const { plates, L } = opened('electrolytic-470u-16v');
    const faces = plates.group.getObjectByName('plates:faces') as Mesh;
    const pos = faces.geometry.getAttribute('position');
    const nor = faces.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getZ(i)).toBeCloseTo(-INSET, 6);
      expect(nor.getZ(i)).toBeCloseTo(1, 6);
    }
    // what colour the section has at a point of the cut (a triangle of some area covering it), or null
    const colors = faces.geometry.getAttribute('color');
    const colourAt = (x: number, y: number): string | null => {
      for (let i = 0; i < pos.count; i += 3) {
        const xs = [pos.getX(i), pos.getX(i + 1), pos.getX(i + 2)];
        const ys = [pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)];
        const area = Math.abs((xs[1]! - xs[0]!) * (ys[2]! - ys[0]!) - (xs[2]! - xs[0]!) * (ys[1]! - ys[0]!));
        if (area < 1e-9) continue;
        if (Math.min(...xs) <= x && x <= Math.max(...xs) && Math.min(...ys) <= y && y <= Math.max(...ys))
          return new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString();
      }
      return null;
    };
    const mid = (L.bottom + L.top) / 2;
    // a plate's section stands where its leg's line is: over leg 0 at −P/2, over leg 1 at +P/2; the lead under it;
    // the insulator's on the plus plate's inner side; between it and the minus plate nothing
    expect(colourAt(-P / 2, mid)).toBe(col('steel').getHexString());
    expect(colourAt(P / 2, mid)).toBe(col('steel').getHexString());
    expect(colourAt(-P / 2, (L.floor + L.bottom) / 2)).toBe(LEG_COLOR.getHexString());
    expect(colourAt(P / 2, (L.floor + L.bottom) / 2)).toBe(LEG_COLOR.getHexString());
    expect(colourAt(L.ins.x0 + 0.1 * PLATES.insulator.thick, mid)).toBe(col('mist').getHexString());
    expect(colourAt(L.ins.x1 - 0.1 * PLATES.insulator.thick, mid)).toBe(col('mist').getHexString());
    expect(colourAt(L.ins.x1 + 0.5 * PLATES.insulator.thick, mid)).toBeNull();
    expect(colourAt(0, mid)).toBeNull();
    expect(colourAt(-P / 4, mid)).toBeNull();
    // the sleeve's section: `mist` on the stripe's side (+x, over leg 1), `ink` on the other
    expect(colourAt(L.r - PLATES.sleeve / 2, mid)).toBe(col('mist').getHexString());
    expect(colourAt(-L.r + PLATES.sleeve / 2, mid)).toBe(col('ink').getHexString());
  });

  it('faces its inner wall in, toward the axis, its winding the same way as its shading', () => {
    const { plates, L } = opened('electrolytic-470u-16v');
    const core = plates.group.getObjectByName('plates:core') as Mesh;
    const g = core.geometry.index ? core.geometry.toNonIndexed() : core.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const [a, b, c, n, e1, e2] = Array.from({ length: 6 }, () => new Vector3());
    let walls = 0;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      if (n.lengthSq() < 1e-14) continue;
      n.normalize();
      expect(n.dot(new Vector3().fromBufferAttribute(nor, i))).toBeGreaterThan(0.9);
      const mid = a.clone().add(b).add(c).divideScalar(3);
      if (Math.abs(Math.hypot(mid.x, mid.z) - L.inner) < 0.01) {
        expect(n.x * mid.x + n.z * mid.z).toBeLessThan(0);
        walls++;
      }
    }
    expect(walls).toBeGreaterThan(40);
  });

  it('is what the door finds for an electrolytic (`asPlates`), and gives the part back whole', () => {
    const m = make();
    const before = m.materials.map((x) => [x.clippingPlanes, x.clipIntersection]);
    const plates = createPlates(m);
    expect(asPlates(plates)).toBe(plates);
    expect(asPlates(null)).toBeNull();
    plates.set(1, FRONT);
    plates.update(0, 0);
    plates.dispose();
    expect(m.materials.map((x) => [x.clippingPlanes, x.clipIntersection])).toEqual(before);
    expect(plates.group.parent).toBeNull();
    expect(m.bodyGroup.getObjectByName(`${m.key}:plates`)).toBeUndefined();
  });
});
