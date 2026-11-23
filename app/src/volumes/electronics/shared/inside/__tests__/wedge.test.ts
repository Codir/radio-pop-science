/**
 * The wedge that opens a part (`wedge.ts`, docs/volumes/electronics/VISUAL.md §7): about the body's x (an axial part,
 * a film capacitor's winding) or about its vertical (a radial can, E4-I), always on the camera's side; the section
 * faces of a body that is not round about the axis (`createSection`), laid where the wedge's planes are, facing the
 * open wedge, wound as they face; the print, which three's clipping does not reach, going with the half the cut takes
 * (`printKeeper`). No WebGL: the planes and the numbers.
 */
import { BoxGeometry, Color, Mesh, MeshBasicMaterial, Vector3, type Material } from 'three';
import { describe, expect, it } from 'vitest';
import { buildPart, type PartModel } from '../../parts';
import {
  CLOSED,
  INSET,
  SLIVER,
  angleOf,
  createSection,
  createWedge,
  pointOf,
  printKeeper,
  radialOf,
  tangentOf,
  type SectionLayer,
} from '../wedge';

/** Whether three's clipping (with `clipIntersection`) removes a world point. */
function clipped(m: Material, p: Vector3): boolean {
  const planes = m.clippingPlanes ?? [];
  if (planes.length === 0) return false;
  const out = planes.map((pl) => pl.distanceToPoint(p) < 0);
  return m.clipIntersection ? out.every(Boolean) : out.some(Boolean);
}
const can = (): PartModel => {
  const m = buildPart('electrolytic-470u-16v')!;
  m.group.updateWorldMatrix(true, true);
  return m;
};
/** The door's line of sight in the body frame of a part at the orientation 0: 60° over the board, from the reader. */
const FRONT = new Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3));

describe('the directions about an axis', () => {
  it('measure the angle about x from +y toward +z, about y from +z toward +x; the tangent turns the radial on', () => {
    for (const axis of ['x', 'y'] as const) {
      for (let k = 0; k < 12; k++) {
        const th = -Math.PI + (k / 12) * 2 * Math.PI + 0.1;
        const d = radialOf(axis, th);
        const t = tangentOf(axis, th);
        expect(d.length()).toBeCloseTo(1, 12);
        expect(d.dot(t)).toBeCloseTo(0, 12);
        // the tangent is the derivative of the radial
        const ahead = radialOf(axis, th + 1e-6).sub(d).divideScalar(1e-6);
        expect(ahead.distanceTo(t)).toBeLessThan(1e-5);
        expect(angleOf(axis, d)).toBeCloseTo(th, 9);
        // the point is the radial from the axis
        const p = pointOf(axis, 0.18, 0.3, 0.2, th);
        const along = axis === 'x' ? p.x : p.y;
        expect(along).toBeCloseTo(0.3, 12);
      }
    }
    expect(radialOf('x', 0).toArray()).toEqual([0, 1, 0]);
    expect(radialOf('y', 0).toArray()).toEqual([0, 0, 1]);
    expect(radialOf('y', Math.PI / 2).x).toBeCloseTo(1, 12);
    expect(angleOf('y', new Vector3(0, 1, 0))).toBeNull();
  });
});

describe('the wedge about the vertical (a radial can)', () => {
  it('opens on the camera’s side about the can’s axis and keeps the far side; the legs are never cut', () => {
    const m = can();
    const wedge = createWedge(m, Math.PI, 0, new Set(), { axis: 'y' });
    const sleeve = m.body[0]!;
    wedge.set(0, FRONT);
    expect(wedge.open).toBe(false);
    expect(clipped(sleeve, new Vector3(0, 0.9, 0.4))).toBe(false);
    wedge.set(1, FRONT);
    expect(wedge.open).toBe(true);
    expect(wedge.alpha).toBeCloseTo(0, 12);
    expect(wedge.half).toBeCloseTo(Math.PI / 2, 12);
    // the half toward the camera (+z) is gone, the far half kept, whatever the height
    for (const y of [0.35, 0.9, 1.6]) {
      expect(clipped(sleeve, new Vector3(0, y, 0.4))).toBe(true);
      expect(clipped(sleeve, new Vector3(0.3, y, 0.05))).toBe(true);
      expect(clipped(sleeve, new Vector3(0, y, -0.4))).toBe(false);
      expect(clipped(sleeve, new Vector3(0.3, y, -0.05))).toBe(false);
    }
    // each plane keeps a hair on its own side clipped: where the section face stands
    expect(clipped(sleeve, new Vector3(0.3, 0.9, -SLIVER / 2))).toBe(true);
    expect(clipped(sleeve, new Vector3(0.3, 0.9, -2 * SLIVER))).toBe(false);
    expect(((m.legs.material as Material).clippingPlanes ?? []).length).toBe(0);
    // from behind, the cut turns to the back
    wedge.set(1, new Vector3(0, FRONT.y, -FRONT.z));
    expect(wedge.alpha).toBeCloseTo(Math.PI, 12);
    expect(clipped(sleeve, new Vector3(0, 0.9, -0.4))).toBe(true);
    expect(clipped(sleeve, new Vector3(0, 0.9, 0.4))).toBe(false);
    // a narrower wedge half open: the sector about the camera's side only
    const other = can();
    const narrow = createWedge(other, (2 * Math.PI) / 3, 0, new Set(), { axis: 'y' });
    narrow.set(0.5, FRONT);
    expect(narrow.half).toBeCloseTo(Math.PI / 6, 12);
    expect(clipped(other.body[0]!, new Vector3(0, 0.9, 0.4))).toBe(true);
    expect(clipped(other.body[0]!, new Vector3(0.4, 0.9, 0.1))).toBe(false);
    wedge.set(CLOSED / 2, FRONT);
    expect(wedge.open).toBe(false);
    expect(clipped(sleeve, new Vector3(0, 0.9, 0.4))).toBe(false);
    wedge.dispose();
    expect(sleeve.clippingPlanes ?? []).toEqual([]);
  });

  it('about x and upright, the half cut is the upright plane through the axis on the reader’s side', () => {
    const m = buildPart('film-1u')!;
    m.group.updateWorldMatrix(true, true);
    const axisY = 0.675;
    const wedge = createWedge(m, Math.PI, axisY, new Set(), { axis: 'x', upright: true });
    wedge.set(1, FRONT);
    // the middle level toward the reader (+z), not up toward the camera
    expect(wedge.alpha).toBeCloseTo(Math.PI / 2, 12);
    const box = m.body[0]!;
    for (const y of [axisY + 0.3, axisY, axisY - 0.3]) {
      expect(clipped(box, new Vector3(0.1, y, 0.05))).toBe(true);
      expect(clipped(box, new Vector3(0.1, y, -0.05))).toBe(false);
    }
    // not upright, the same half cut faces the camera itself: the front low corner is kept
    const tilted = createWedge(buildPart('film-1u')!, Math.PI, axisY, new Set(), { axis: 'x' });
    tilted.set(1, FRONT);
    expect(tilted.alpha).toBeCloseTo(Math.PI / 6, 12);
  });

  it('about x it still cuts as it did for the resistor (the default axis)', () => {
    const m = buildPart('resistor-330')!;
    m.group.updateWorldMatrix(true, true);
    const wedge = createWedge(m, (2 * Math.PI) / 3, 0.18, new Set());
    expect(wedge.axis).toBe('x');
    wedge.set(1, new Vector3(0, 1, 0));
    const body = m.body[0]!;
    expect(clipped(body, new Vector3(0.05, 0.18 + 0.12, 0))).toBe(true);
    expect(clipped(body, new Vector3(0.05, 0.18 - 0.12, 0))).toBe(false);
  });
});

describe('section faces off the round (createSection)', () => {
  const white = new Color(1, 1, 1);
  const red = new Color(1, 0, 0);
  /** A box section about the vertical: the radius to a square's side at each angle, and a bar off the axis. */
  const layers: SectionLayer[] = [
    {
      u0: 0,
      u1: 1,
      r0: () => 0,
      r1: (_u, th) => 0.2 / Math.max(Math.abs(Math.sin(th)), Math.abs(Math.cos(th))),
      color: white,
      steps: 3,
    },
    { u0: 0.2, u1: 0.4, r0: () => 0.3, r1: () => 0.35, color: (th) => (Math.sin(th) > 0 ? red : white), steps: 1 },
  ];

  it('lays each face in its plane of the wedge, INSET into the side it closes, facing the open wedge, wound so', () => {
    for (const axis of ['x', 'y'] as const) {
      const s = createSection(axis, 0.5, layers);
      for (const [b1, b2] of [
        [-Math.PI / 2, Math.PI / 2],
        [-0.4, 1.3],
      ] as const) {
        s.pose(b1, b2);
        const pos = s.geometry.getAttribute('position');
        const nor = s.geometry.getAttribute('normal');
        const half = pos.count / 2;
        const [a, b, c, e1, e2, n] = Array.from({ length: 6 }, () => new Vector3());
        let wound = 0;
        for (let i = 0; i < pos.count; i += 3) {
          const face = i < half ? 0 : 1;
          const th = face === 0 ? b1 : b2;
          const expected = tangentOf(axis, th);
          if (face === 1) expected.negate();
          for (let j = 0; j < 3; j++) {
            const p = new Vector3().fromBufferAttribute(pos, i + j);
            const from = axis === 'x' ? p.clone().setY(p.y - 0.5).setX(0) : p.clone().setY(0);
            // in its plane through the axis, a hair into the kept side
            expect(from.dot(expected)).toBeCloseTo(-INSET, 6);
            expect(new Vector3().fromBufferAttribute(nor, i + j).distanceTo(expected)).toBeLessThan(1e-6);
          }
          a.fromBufferAttribute(pos, i);
          b.fromBufferAttribute(pos, i + 1);
          c.fromBufferAttribute(pos, i + 2);
          n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
          if (n.lengthSq() < 1e-16) continue;
          expect(n.normalize().dot(expected)).toBeGreaterThan(0.999);
          wound++;
        }
        expect(wound).toBeGreaterThan(8);
      }
    }
  });

  it('gives each face the radii and the colours of its own angle', () => {
    const s = createSection('y', 0, layers);
    s.pose(-Math.PI / 4, Math.PI / 2);
    const pos = s.geometry.getAttribute('position');
    const col = s.geometry.getAttribute('color');
    const half = pos.count / 2;
    /** The farthest reach of the vertices `from` … `to`. */
    const reachOf = (from: number, to: number): number => {
      let r = 0;
      for (let i = from; i < to; i++) r = Math.max(r, Math.hypot(pos.getX(i), pos.getZ(i)));
      return r;
    };
    // the square's layer (its three quads first on each face) reaches its side: farther on the diagonal (−45°) than
    // straight out (+90°)
    expect(reachOf(0, 18)).toBeCloseTo(0.2 * Math.SQRT2, 3);
    expect(reachOf(half, half + 18)).toBeCloseTo(0.2, 3);
    const far1 = reachOf(half, pos.count);
    // the bar's colour is red only on the face toward +x
    const reds = (from: number, to: number): number => {
      let n = 0;
      for (let i = from; i < to; i++) if (col.getX(i) === 1 && col.getY(i) === 0) n++;
      return n;
    };
    expect(reds(0, half)).toBe(0);
    expect(reds(half, pos.count)).toBe(6);
    expect(far1).toBeCloseTo(0.35, 3);
    // a radius changed under the same bounds is laid again only after `redo`
    let wide = false;
    const t = createSection('y', 0, [{ u0: 0, u1: 1, r0: () => 0, r1: () => (wide ? 0.5 : 0.1), color: white, steps: 1 }]);
    t.pose(-1, 1);
    const reach = (): number => {
      const p = t.geometry.getAttribute('position');
      let r = 0;
      for (let i = 0; i < p.count; i++) r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
      return r;
    };
    expect(reach()).toBeCloseTo(0.1, 3);
    wide = true;
    t.pose(-1, 1);
    expect(reach()).toBeCloseTo(0.1, 3);
    t.redo();
    t.pose(-1, 1);
    expect(reach()).toBeCloseTo(0.5, 3);
  });
});

describe('the print goes with the half the cut takes (printKeeper)', () => {
  it('hides a text whose middle both planes remove, or that the cut runs through; shows it again when closed', () => {
    const m = can();
    // stand-ins for the prints (no fonts in unit tests): one in front, one behind, one on the side close to the cut
    const text = (z: number, x = 0) => {
      const t = Object.assign(new Mesh(new BoxGeometry(0.01, 0.01, 0.01), new MeshBasicMaterial()), { fontSize: 0.1 });
      t.position.set(x, 0.9, z);
      m.bodyGroup.add(t);
      return t;
    };
    const front = text(0.47);
    const back = text(-0.47);
    const edge = text(-0.03, 0.46);
    (m as unknown as { prints: Mesh[] }).prints = [front, back, edge];
    m.group.updateWorldMatrix(true, true);
    const wedge = createWedge(m, Math.PI, 0, new Set([front, back, edge]), { axis: 'y' });
    const keeper = printKeeper(m, wedge);
    wedge.set(1, FRONT);
    keeper.update();
    expect((front.material as Material).visible).toBe(false);
    expect((back.material as Material).visible).toBe(true);
    // 0.03 behind the cut, within its own size of it: it goes as a whole
    expect((edge.material as Material).visible).toBe(false);
    expect(keeper.hidden()).toBe(2);
    wedge.set(0, FRONT);
    keeper.update();
    expect([front, back, edge].every((t) => (t.material as Material).visible)).toBe(true);
    wedge.set(1, FRONT);
    keeper.update();
    keeper.dispose();
    expect([front, back, edge].every((t) => (t.material as Material).visible)).toBe(true);
  });
});
