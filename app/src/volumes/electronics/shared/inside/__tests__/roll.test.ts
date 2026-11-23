/**
 * Inside a film capacitor (`roll.ts`, docs/volumes/electronics/VISUAL.md §7, batch E4): the box cut in half by the
 * upright plane through the winding's axis (the body's x) on the reader's side, and on the section the roll of two
 * metallised strips — film and metal taking turns, each strip's metal reaching its own sprayed end and stopping short
 * of the other —, the sprayed ends, the leads from the box's bottom up against them, the potting and the box's shell;
 * the corner by leg 1 kept, its face across the winding. For both film boxes of the catalog: everything it draws within
 * the part's box, two draw calls of its own (four with the part), both leads in the camera's sight, the callouts'
 * points on the section's metal and film, nothing while the part is whole, the part given back whole. No WebGL: the
 * scene graph and the numbers.
 */
import { Box3, Color, Matrix4, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { PARTS } from '@electronics/sim/core';
import { BOARD_SPEC } from '@electronics/sim/board';
import { STAGE_FOV } from '../../bench/shots';
import { PART_VIEW } from '../../dive/poses';
import { FILM as BOX, RADIAL_Y, buildPart, type PartModel } from '../../parts';
import { LEG_COLOR } from '../../parts/part';
import {
  ROLL,
  asRoll,
  boxReach,
  cornerPoint,
  createRoll,
  ovalReach,
  rollLayout,
  uprightOnFace,
  windAt,
} from '../roll';
import { CLOSED, INSET, SLIVER } from '../wedge';

const P = BOARD_SPEC.pitch;
const BOXES = Object.entries(PARTS)
  .flatMap(([key, s]) => (s.kind === 'capacitor' && s.dielectric === 'film' ? [key] : []))
  .sort();
const make = (key = 'film-1u'): PartModel => {
  const m = buildPart(key)!;
  m.group.updateWorldMatrix(true, true);
  return m;
};
/** The door's line of sight in the body frame of a part at the orientation 0: 60° over the board, from the reader. */
const FRONT = new Vector3(0, Math.sin(PART_VIEW.elevation), Math.cos(PART_VIEW.elevation));
const L = rollLayout();

function drawn(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = o; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    const material = m.material as Material | Material[];
    if (Array.isArray(material) ? material.every((x) => !x.visible) : !material.visible) return;
    out.push(m);
  });
  return out;
}
function clipped(m: Material, p: Vector3): boolean {
  const planes = m.clippingPlanes ?? [];
  if (planes.length === 0) return false;
  const out = planes.map((pl) => pl.distanceToPoint(p) < 0);
  return m.clipIntersection ? out.every(Boolean) : out.some(Boolean);
}
/** Whether a point of the body frame is in the part's rounded box. */
function inBox(q: Vector3): boolean {
  const k = L.box.corner;
  const d = [Math.abs(q.x) - (L.box.x - k), Math.abs(q.y - L.axisY) - (L.box.y - k), Math.abs(q.z) - (L.box.z - k)];
  return Math.hypot(...d.map((x) => Math.max(x, 0))) + Math.min(Math.max(...d), 0) - k <= 0;
}
/** The door's camera on the floor `inside`, in the body frame of the part `m` (as `PART_VIEW` frames it). */
function insideCamera(m: PartModel): Vector3 {
  const size = Math.max(m.hit.scale.x, m.hit.scale.y, m.hit.scale.z);
  const distance = size / (PART_VIEW.inside * 2 * Math.tan(((STAGE_FOV / 2) * Math.PI) / 180) * 1.5);
  return m.hit.position.clone().addScaledVector(FRONT, distance);
}
function opened(key = 'film-1u') {
  const m = make(key);
  const roll = createRoll(m);
  roll.set(1, FRONT);
  return { m, roll };
}
/** The section's quads (six vertices each, in order): their extent along x, their reach, their colour. */
function quads(roll: { group: Object3D }) {
  const faces = roll.group.getObjectByName('roll:faces') as Mesh;
  const pos = faces.geometry.getAttribute('position');
  const colors = faces.geometry.getAttribute('color');
  const out: { x0: number; x1: number; r0: number; r1: number; color: string; face: 0 | 1 }[] = [];
  for (let i = 0; i < pos.count; i += 6) {
    const xs: number[] = [];
    const rs: number[] = [];
    for (let j = 0; j < 6; j++) {
      xs.push(pos.getX(i + j));
      rs.push(Math.hypot(pos.getY(i + j) - L.axisY, pos.getZ(i + j)));
    }
    out.push({
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      r0: Math.min(...rs),
      r1: Math.max(...rs),
      color: new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString(),
      face: i < pos.count / 2 ? 0 : 1,
    });
  }
  return out;
}

describe('the reach of the box and of the roll from the winding’s axis', () => {
  it('meets the box’s faces straight out and its rounded edge between them; the oval its half-axes', () => {
    const { y, z, corner } = L.box;
    expect(boxReach(y, z, corner, 0)).toBeCloseTo(y, 12);
    expect(boxReach(y, z, corner, Math.PI / 2)).toBeCloseTo(z, 12);
    expect(boxReach(y, z, corner, Math.PI)).toBeCloseTo(y, 12);
    // toward the corner the rounded edge is nearer than the sharp corner, never farther
    const toCorner = Math.atan2(z, y);
    expect(boxReach(y, z, corner, toCorner)).toBeLessThan(Math.hypot(y, z));
    expect(boxReach(y, z, corner, toCorner)).toBeGreaterThan(Math.hypot(y, z) - corner);
    for (let k = 0; k < 72; k++) {
      const th = (k / 72) * 2 * Math.PI;
      const r = boxReach(y, z, corner, th);
      const py = Math.abs(r * Math.cos(th));
      const pz = Math.abs(r * Math.sin(th));
      expect(py).toBeLessThanOrEqual(y + 1e-9);
      expect(pz).toBeLessThanOrEqual(z + 1e-9);
      // on the rounded box's surface
      const dy = Math.max(py - (y - corner), 0);
      const dz = Math.max(pz - (z - corner), 0);
      if (dy > 0 && dz > 0) expect(Math.hypot(dy, dz)).toBeCloseTo(corner, 9);
      else expect(Math.max(py - y, pz - z)).toBeCloseTo(0, 9);
    }
    expect(ovalReach(0.3, 0.1, 0)).toBeCloseTo(0.3, 12);
    expect(ovalReach(0.3, 0.1, Math.PI / 2)).toBeCloseTo(0.1, 12);
    // an upright bar under the axis: on the face straight down from its top to its bottom, on the face up only what of
    // it stands over the axis; on a face across it, none
    expect(uprightOnFace(0.675, 0.02, 0.3, 0.7, Math.PI)).toEqual([0, expect.closeTo(0.375, 12)]);
    expect(uprightOnFace(0.675, 0.02, 0.3, 0.7, 0)).toEqual([0, expect.closeTo(0.025, 12)]);
    const [a, b] = uprightOnFace(0.675, 0.02, 0.3, 0.7, Math.PI / 2);
    expect(b).toBe(a);
  });
});

describe('the roll inside a film capacitor (createRoll)', () => {
  it('lays out the roll in the box: along the legs’ axis, flattened to the box, its ends sprayed, a lead on each', () => {
    expect(L.axisY).toBeCloseTo(RADIAL_Y + BOX.height / 2, 12);
    // the roll and its sprayed ends inside the box's shell, the ends wider than the roll by a little
    expect(L.roll.y).toBeLessThan(L.inner.y);
    expect(L.roll.z).toBeLessThan(L.inner.z);
    expect(L.spray.y).toBeLessThanOrEqual(L.inner.y);
    expect(L.spray.z).toBeLessThanOrEqual(L.inner.z);
    expect(L.spray.end).toBeGreaterThan(L.roll.end);
    // flattened like a real box's winding: taller than deep
    expect(L.roll.y / L.roll.z).toBeGreaterThan(2);
    // each lead stands on its leg's line (±P), against its sprayed end's outer face, from the box's bottom up over
    // the axis (where the cut lays it open)
    expect(L.lead.x).toBe(P);
    expect(L.lead.x - L.lead.radius).toBeCloseTo(L.spray.end, 12);
    expect(L.lead.x + L.lead.radius).toBeLessThan(L.inner.x);
    expect(L.lead.bottom).toBe(RADIAL_Y);
    expect(L.lead.top).toBeGreaterThan(L.axisY);
    expect(L.lead.top).toBeLessThan(L.axisY + L.spray.y);
    expect(L.lead.bottom).toBeLessThan(L.axisY - L.spray.y);
  });

  it('draws nothing while the box is whole, and cuts it in half by the upright plane through the winding’s axis', () => {
    const m = make();
    const roll = createRoll(m);
    roll.set(0, FRONT);
    expect(roll.open).toBe(false);
    expect(drawn(roll.group)).toEqual([]);
    roll.cut(1);
    expect(roll.open).toBe(true);
    const box = m.body[0]!;
    // the half on the reader's side gone, over the axis and under it; the half behind kept, however high
    for (const y of [L.axisY + 0.3, L.axisY, L.axisY - 0.3]) {
      expect(clipped(box, m.bodyGroup.localToWorld(new Vector3(-0.1, y, 0.05)))).toBe(true);
      expect(clipped(box, m.bodyGroup.localToWorld(new Vector3(-0.1, y, -0.05)))).toBe(false);
    }
    // but for the corner by leg 1 under the plane across the winding, which stands on the reader's side too
    const { x: cx, slope } = L.corner;
    for (const [x, y] of [
      [0.3, L.axisY],
      [0.35, L.axisY + 0.1],
      [0.1, L.axisY - 0.2],
      [-0.05, L.axisY - 0.33],
    ] as const) {
      expect(x - slope * (y - L.axisY) > cx, `${x}, ${y}`).toBe(true);
      expect(clipped(box, m.bodyGroup.localToWorld(new Vector3(x, y, 0.1))), `${x}, ${y}`).toBe(false);
    }
    expect(clipped(box, m.bodyGroup.localToWorld(new Vector3(0.1, L.axisY + 0.05, 0.1)))).toBe(true);
    expect(((m.legs.material as Material).clippingPlanes ?? []).length).toBe(0);
    roll.cut(CLOSED / 2);
    expect(roll.open).toBe(false);
    expect(drawn(roll.group)).toEqual([]);
  });

  it('stays inside the part’s box, for both film boxes', () => {
    for (const key of BOXES) {
      const { m, roll } = opened(key);
      const box = new Box3().setFromCenterAndSize(m.hit.position.clone(), m.hit.scale.clone()).expandByScalar(1e-6);
      m.bodyGroup.updateWorldMatrix(true, true);
      const toBody = new Matrix4().copy(m.bodyGroup.matrixWorld).invert();
      const meshes = drawn(roll.group);
      expect(meshes.map((x) => x.name), key).toEqual(['roll:faces', 'roll:corner']);
      for (const mesh of meshes) {
        mesh.geometry.computeBoundingBox();
        const b = mesh.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBody, mesh.matrixWorld));
        expect(box.containsBox(b), `${key}: ${mesh.name}`).toBe(true);
      }
    }
  });

  it('costs two draw calls of its own and four with the part', () => {
    for (const key of BOXES) {
      const { m, roll } = opened(key);
      const calls = drawn(m.bodyGroup);
      expect(calls.length, calls.map((c) => c.name).join(', ')).toBeLessThanOrEqual(4);
      expect(roll.state().drawCalls).toBe(calls.length);
      expect(roll.state().insideCalls).toBe(2);
      expect(calls).toContain(m.legs);
    }
  });

  it('lays its section in the upright plane of the cut, facing the reader, the leads in it', () => {
    const { roll } = opened();
    const faces = roll.group.getObjectByName('roll:faces') as Mesh;
    const pos = faces.geometry.getAttribute('position');
    const nor = faces.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getZ(i)).toBeCloseTo(-INSET, 6);
      expect(new Vector3().fromBufferAttribute(nor, i).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-6);
    }
    // each lead, on its leg's line, runs from the box's bottom (where the leg comes in) up over the axis, against its
    // sprayed end
    const leg = LEG_COLOR.getHexString();
    for (const sign of [-1, 1]) {
      const lead = quads(roll).filter((q) => q.color === leg && q.r1 - q.r0 > 1e-6 && Math.sign(q.x0 + q.x1) === sign);
      expect(lead.length).toBe(2);
      for (const q of lead) {
        expect(Math.min(Math.abs(q.x0), Math.abs(q.x1))).toBeCloseTo(L.spray.end, 6);
        expect(Math.max(Math.abs(q.x0), Math.abs(q.x1))).toBeCloseTo(P + L.lead.radius, 6);
      }
      const down = lead.find((q) => q.face === 1)!;
      // (float32 positions: a micrometre of slack)
      expect(L.axisY - down.r1).toBeCloseTo(RADIAL_Y, 5);
      // from the axis (the quads' reach is measured off the face, INSET in front of the axis)
      expect(down.r0).toBeLessThanOrEqual(INSET + 1e-6);
      expect(lead.find((q) => q.face === 0)!.r1).toBeCloseTo(L.lead.top - L.axisY, 3);
    }
  });

  it('shows film and metal taking turns: each strip’s metal from its own sprayed end, stopping short of the other', () => {
    const { roll } = opened();
    const steel = col('steel').getHexString();
    const mist = col('mist').getHexString();
    const E = L.roll.end;
    for (const face of [0, 1] as const) {
      const all = quads(roll).filter((q) => q.face === face && q.r1 - q.r0 > 1e-6 && q.x0 >= -E - 1e-6 && q.x1 <= E + 1e-6);
      const metal = all.filter((q) => q.color === steel).sort((a, b) => a.r0 - b.r0);
      // one layer of metal per strip and turn, all within the roll's oval on this face
      expect(metal.length).toBe(2 * ROLL.turns);
      metal.forEach((q, i) => {
        if (i % 2 === 0) {
          // the first strip: from the end by leg 0, bare by leg 1
          expect(q.x0).toBeCloseTo(-E, 6);
          expect(q.x1).toBeCloseTo(E - ROLL.margin, 6);
        } else {
          expect(q.x0).toBeCloseTo(-E + ROLL.margin, 6);
          expect(q.x1).toBeCloseTo(E, 6);
        }
      });
      // between every two metal layers, film; the roll's outer layer metal, inside the potting
      for (let i = 1; i < metal.length; i++) {
        const between = all.filter((q) => q.color === mist && q.r0 >= metal[i - 1]!.r1 - 1e-6 && q.r1 <= metal[i]!.r0 + 1e-6);
        expect(between.length).toBeGreaterThan(0);
      }
    }
  });

  it('winds the strips into a spiral: each turn a little farther out as the angle about the axis grows', () => {
    const w0 = windAt(0);
    const wPi = windAt(Math.PI);
    // half a turn round from over the axis to under it, a quarter from straight behind (where the spiral starts) to
    // over it
    expect(wPi.layers(0)[0] - w0.layers(0)[0]).toBeCloseTo(w0.turn / 2, 12);
    expect(w0.layers(0)[0] - windAt(-Math.PI / 2 + 1e-9).layers(0)[0]).toBeCloseTo(w0.turn / 4, 6);
    // one turn more of room than turns: the roll's oval holds every angle's spiral, the wrap of bare film round it
    for (let k = 0; k < 64; k++) {
      const th = -Math.PI / 2 + (k / 64) * 2 * Math.PI;
      const w = windAt(th);
      expect(w.core).toBeGreaterThanOrEqual(ROLL.core);
      expect(w.layers(ROLL.turns - 1)[4]).toBeCloseTo(w.wrap, 12);
      expect(w.wrap).toBeLessThanOrEqual(1 + 1e-12);
      // each turn's layers in order — film, metal, film, metal — and each turn where the one before ends
      for (let t = 0; t < ROLL.turns; t++) {
        const b = w.layers(t);
        for (let i = 1; i < 5; i++) expect(b[i]).toBeGreaterThan(b[i - 1]!);
        if (t > 0) expect(b[0]).toBeCloseTo(w.layers(t - 1)[4], 12);
      }
    }
    // on the upright section the layers over the axis and under it are half a turn apart
    const { roll } = opened();
    const steel = col('steel').getHexString();
    const firstMetal = (face: 0 | 1) =>
      quads(roll)
        .filter((q) => q.face === face && q.color === steel && q.r1 - q.r0 > 1e-6 && Math.abs(q.x0 + q.x1) < 0.2)
        .sort((a, b) => a.r0 - b.r0)[0]!;
    expect(firstMetal(0).r0 / ovalReach(L.roll.y, L.roll.z, 0)).toBeCloseTo(w0.layers(0)[1], 3);
    expect(firstMetal(1).r0 / ovalReach(L.roll.y, L.roll.z, Math.PI)).toBeCloseTo(wPi.layers(0)[1], 3);
  });

  it('lays the kept corner’s face across the winding, toward the camera, whole, the turns on it as a spiral', () => {
    const { slope, x: cx } = L.corner;
    const out = new Vector3(-1, slope, 0).normalize();
    // the face looks up out of the corner, toward the door's camera
    expect(out.dot(FRONT)).toBeGreaterThan(0.5);
    // the plane meets the box on the reader's side only between the roll's ends and leg 1's end wall: leg 0's end, its
    // lead and the second strip's bare edge stay on the upright section, in full view
    expect(cx - slope * L.box.y).toBeGreaterThan(-L.roll.end + ROLL.margin);
    expect(cx + slope * L.box.y).toBeGreaterThan(L.box.x);
    for (const key of BOXES) {
      const { roll } = opened(key);
      const mesh = roll.group.getObjectByName('roll:corner') as Mesh;
      const pos = mesh.geometry.getAttribute('position');
      const nor = mesh.geometry.getAttribute('normal');
      const colors = mesh.geometry.getAttribute('color');
      // on the plane where the wedge clips the corner (its hair into it: the box's own faces end at the face's edge),
      // on the reader's side, facing out of the corner, wound so
      const p = new Vector3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        expect((p.x - slope * (p.y - L.axisY) - cx) / Math.hypot(1, slope)).toBeCloseTo(SLIVER, 6);
        expect(p.z).toBeGreaterThanOrEqual(-1e-6);
        expect(new Vector3().fromBufferAttribute(nor, i).distanceTo(out)).toBeLessThan(1e-6);
      }
      // each triangle's corners as (y, z) — on the plane x follows from y — its colour, its area
      const tris: { t: [number, number][]; color: string; area: number }[] = [];
      for (let i = 0; i < pos.count; i += 3) {
        const v = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(pos, i + j));
        const n = new Vector3().subVectors(v[1]!, v[0]!).cross(new Vector3().subVectors(v[2]!, v[0]!));
        if (n.lengthSq() < 1e-16) continue;
        expect(n.clone().normalize().dot(out)).toBeGreaterThan(0.999);
        const t = v.map((q) => {
          q.addScaledVector(out, SLIVER);
          return [q.y, q.z] as [number, number];
        });
        const color = new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString();
        tris.push({ t, color, area: n.length() / 2 });
      }
      // whole: as much face as the plane has in the box on the reader's side, out to its surface — no holes, no
      // overlaps (1 %)
      let expected = 0;
      const N = 720;
      for (let j = 0; j < N; j++) {
        const th = ((j + 0.5) / N) * Math.PI;
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (inBox(cornerPoint(mid, th).addScaledVector(out, -SLIVER))) lo = mid;
          else hi = mid;
        }
        expected += ((lo * lo) / 2) * (Math.PI / N) * Math.hypot(1, slope);
      }
      const area = tris.reduce((a, x) => a + x.area, 0);
      expect(Math.abs(area / expected - 1), `${key}: ${area} of ${expected}`).toBeLessThan(0.01);
      // the colour of the face at ρ from the axis at the angle θ
      const colourAt = (th: number, rho: number): string | null => {
        const q = cornerPoint(rho, th);
        // (the triangles' corners taken back onto the plane itself above)
        for (const { t, color } of tris) {
          const [[x0, y0], [x1, y1], [x2, y2]] = t as [[number, number], [number, number], [number, number]];
          const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
          const a = ((y1 - y2) * (q.y - x2) + (x2 - x1) * (q.z - y2)) / d;
          const b = ((y2 - y0) * (q.y - x2) + (x0 - x2) * (q.z - y2)) / d;
          if (a >= -1e-6 && b >= -1e-6 && a + b <= 1 + 1e-6) return color;
        }
        return null;
      };
      // across the roll, under the axis toward the reader: the turns — film and metal by turns, each strip's metal
      // once a turn, the first a little farther out as the angle grows (a spiral, not rings)
      const steel = col('steel').getHexString();
      for (const th of [0.6 * Math.PI, 0.75 * Math.PI, 0.9 * Math.PI]) {
        const reach = ovalReach(L.roll.y, L.roll.z, th);
        const runs: { color: string | null; from: number }[] = [];
        for (let rho = 0.0005; rho < reach * 0.999; rho += 0.0005) {
          const c = colourAt(th, rho);
          if (runs.at(-1)?.color !== c) runs.push({ color: c, from: rho });
        }
        const metal = runs.filter((r) => r.color === steel);
        expect(metal.length, `${key} at ${th}`).toBe(2 * ROLL.turns);
        expect(runs.filter((r) => r.color === null), `${key} at ${th}: a hole`).toEqual([]);
        expect(metal[0]!.from / reach, `${key} at ${th}`).toBeCloseTo(windAt(th).layers(0)[1], 2);
      }
    }
  });

  it('shows each lead going into its sprayed end in the camera’s sight: leg 1’s over the kept corner and on its face', () => {
    const { x: cx, slope } = L.corner;
    const R = L.lead.radius;
    const leg = LEG_COLOR.getHexString();
    for (const key of BOXES) {
      const { m, roll } = opened(key);
      m.bodyGroup.updateWorldMatrix(true, true);
      const box = m.body[0]!;
      const camera = insideCamera(m);
      const all = quads(roll);
      const blocked: string[] = [];
      for (const sign of [-1, 1]) {
        for (const x of [P - 0.9 * R, P, P + 0.9 * R]) {
          // near the lead's top, on its strip of the section over the axis
          const at = new Vector3(sign * x, L.lead.top - 0.004, -INSET);
          const r = Math.hypot(at.y - L.axisY, INSET);
          const onLead = all.some(
            (q) => q.color === leg && q.face === 0 && q.x0 <= at.x && at.x <= q.x1 && q.r0 <= r && r <= q.r1,
          );
          expect(onLead, `${key}: lead ${sign} at ${x}`).toBe(true);
          // the line from it to the door's camera meets nothing of the box the cut keeps — the corner by leg 1 above all
          // — until it leaves the box
          const dir = camera.clone().sub(at).normalize();
          const q = new Vector3();
          for (let k = 1; k <= 4000; k++) {
            q.copy(at).addScaledVector(dir, k * 0.0005);
            if (!inBox(q)) break;
            if (!clipped(box, m.bodyGroup.localToWorld(q.clone()))) {
              blocked.push(`lead ${sign} at ${x}: the box kept at ${q.toArray().map((v) => v.toFixed(3))}`);
              break;
            }
          }
        }
      }
      expect(blocked, key).toEqual([]);
      // the corner's face cuts leg 1's lead across where its plane meets it: a patch of the legs' colour, as large as
      // the plane's cut through the lead's column on the reader's side
      const mesh = roll.group.getObjectByName('roll:corner') as Mesh;
      const pos = mesh.geometry.getAttribute('position');
      const colors = mesh.geometry.getAttribute('color');
      let area = 0;
      const v = [new Vector3(), new Vector3(), new Vector3()] as const;
      for (let i = 0; i < pos.count; i += 3) {
        if (new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString() !== leg) continue;
        for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(pos, i + j);
        const a = new Vector3().subVectors(v[1], v[0]).cross(new Vector3().subVectors(v[2], v[0])).length() / 2;
        // (none of the lead at these angles: collapsed to a point on the axis)
        if (a < 1e-12) continue;
        area += a;
        // on leg 1's column, in front of the section, no higher than the lead's top
        for (const p of v) {
          expect(p.x, key).toBeGreaterThan(P - R - 0.005);
          expect(p.x, key).toBeLessThan(P + R + 0.005);
          expect(p.z, key).toBeGreaterThanOrEqual(-1e-6);
          expect(p.z, key).toBeLessThanOrEqual(R + 1e-6);
          expect(p.y, key).toBeLessThanOrEqual(L.lead.top + 1e-6);
        }
      }
      const lo = (P - R - cx) / slope;
      const hi = Math.min((P + R - cx) / slope, L.lead.top - L.axisY);
      const expected = Math.max(hi - lo, 0) * R * Math.hypot(1, slope);
      expect(expected).toBeGreaterThan(0);
      expect(Math.abs(area / expected - 1), `${key}: ${area} of ${expected}`).toBeLessThan(0.1);
    }
    // the corner's plane rises toward leg 1, and leg 1's lead stands clear over it across its whole width — by more
    // than its own thickness at the far side
    const over = (x: number): number => L.lead.top - L.axisY - (x - cx) / slope;
    expect(over(P + R)).toBeGreaterThan(R);
  });

  it('gives its callouts points on the section: a layer of metal toward leg 0, a layer of film toward leg 1', () => {
    for (const key of BOXES) {
      const { m, roll } = opened(key);
      m.bodyGroup.updateWorldMatrix(true, true);
      const local = (name: 'metal' | 'film') => m.bodyGroup.worldToLocal(roll.anchor(name, new Vector3()));
      const metal = local('metal');
      const film = local('film');
      const all = quads(roll);
      const on = (p: Vector3, color: string): boolean => {
        const r = Math.hypot(p.y - L.axisY, p.z);
        return all.some((q) => q.color === color && q.x0 <= p.x && p.x <= q.x1 && q.r0 <= r && r <= q.r1);
      };
      for (const p of [metal, film]) {
        // on the section's plane, over the axis, never behind the corner kept by leg 1
        expect(p.z).toBeCloseTo(-INSET, 6);
        expect(p.y).toBeGreaterThan(L.axisY);
        expect(p.x - L.corner.slope * (p.y - L.axisY), key).toBeLessThan(L.corner.x - 0.05);
      }
      expect(on(metal, col('steel').getHexString()), key).toBe(true);
      expect(on(film, col('mist').getHexString()), key).toBe(true);
      expect(metal.x).toBeLessThan(0);
      expect(film.x).toBeGreaterThan(0);
      // room for two tags side by side
      expect(film.x - metal.x).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('is what the door finds for a film capacitor (`asRoll`), static, and gives the part back whole', () => {
    const m = make();
    const before = m.materials.map((x) => [x.clippingPlanes, x.clipIntersection]);
    const roll = createRoll(m);
    expect(asRoll(roll)).toBe(roll);
    expect(asRoll(null)).toBeNull();
    // nothing of the model moves it: it has no `follow`
    expect(roll.follow).toBeUndefined();
    roll.set(1, FRONT);
    expect(roll.state().turns).toBe(3);
    roll.dispose();
    expect(m.materials.map((x) => [x.clippingPlanes, x.clipIntersection])).toEqual(before);
    expect(roll.group.parent).toBeNull();
  });
});
