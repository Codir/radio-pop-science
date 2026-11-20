/**
 * The door into a part (docs/volumes/electronics/VISUAL.md §7) as pure maths: where a part's body is from its sockets
 * (`poses.ts`), the stops of the dive computed from that place — the lens at work over the body with its ring 22–26 %
 * of the frame's height, the floor `part` with the bands ≥ 12 px at 1280 × 720 (through the real `CameraDirector` with
 * the desk's panels), `inside` closer on the same line — a part moved or turned getting its own stops, a rail through
 * them from the bench's shot `board` without a jump; and the resistor's temporary cutaway (`cutaway.ts`): what its
 * planes clip, its faces, and the part given back whole.
 */
import { Vector3, type BufferGeometry, type Material, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { CameraDirector, type Shot } from '@/engine/camera/director';
import { createLayout, type SocketId } from '@electronics/sim/board';
import { LENS, PLACES } from '../../bench/layout';
import { STAGE_FOV, STAGE_SHOTS, boardToWorld } from '../../bench/shots';
import { AXIAL_Y, RESISTOR, buildPart, createResistor, resistorRadius, type PartModel } from '../../parts';
import { CLOSED, RESISTOR_INSIDE, createCutaway } from '../cutaway';
import { CUT_OPENS } from '../door';
import { FLOOR_FROM } from '../levels';
import { PART_VIEW, partPlace, partStops, type BodyBox } from '../poses';
import { LENS_LANDS, LENS_LEG, createDiveRail } from '../rail-math';

type V = [number, number, number];
const layout = createLayout();
const vec = (a: Shot['position']): Vector3 => new Vector3(...(a as V));
/** The resistor's body box in its body frame, as `createResistor` builds its `hit`. */
const RESISTOR_BOX: BodyBox = {
  centre: new Vector3(0, AXIAL_Y, 0),
  size: new Vector3(RESISTOR.length, 2 * RESISTOR.radius, 2 * RESISTOR.radius),
};
const BOARD_CAMERA = vec(STAGE_SHOTS.board.position);
const placeAt = (sockets: readonly SocketId[]) => partPlace(layout, sockets, RESISTOR_BOX)!;
const R1 = placeAt(['a5', 'a9']);
const STOPS = partStops(R1, BOARD_CAMERA);

/** The DOM interface's panels on a desktop at 1280 × 720 (as `bench/__tests__/layout.test.ts` measured them). */
const DESK = { left: 0.0409, right: 0.2803, top: 0.1131, bottom: 0.1175 };
const W = 1280;
const H = 720;
/** A shot through the real director on the desk: CSS px of a world point, and the safe frame's width in px. */
function onDesk(shot: Shot) {
  const d = new CameraDirector();
  d.reframe = false;
  d.setViewport(W, H);
  d.setInsets(DESK, true);
  d.go(shot, { instant: true });
  d.camera.updateMatrixWorld();
  const px = (p: Vector3) => {
    const n = p.clone().project(d.camera);
    return { x: (n.x / 2 + 0.5) * W, y: (0.5 - n.y / 2) * H };
  };
  const fw = W * (1 - DESK.left - DESK.right);
  const fh = H * (1 - DESK.top - DESK.bottom);
  // the 3 : 2 safe frame fitted into the free area ("contain")
  const frame = { w: Math.min(fw, fh * 1.5), h: Math.min(fh, fw / 1.5) };
  const inside = (p: Vector3) => {
    const q = px(p);
    return q.x >= W * DESK.left && q.x <= W * (1 - DESK.right) && q.y >= H * DESK.top && q.y <= H * (1 - DESK.bottom);
  };
  return { px, frame, inside, camera: d.camera };
}
const ends = (place: typeof R1): [Vector3, Vector3] => [
  place.centre.clone().addScaledVector(place.axis, -place.size / 2),
  place.centre.clone().addScaledVector(place.axis, place.size / 2),
];

describe('a part’s place on the board', () => {
  it('is the middle of its body over the board’s face, from its sockets', () => {
    // a5 and a9 on the board: x −1.2 and 0, line a at z −1.5; the board's frame stands on the base's face
    const B = PLACES.breadboard;
    const expected = boardToWorld(-0.6 + B.x, AXIAL_Y + B.height, -1.5 + B.z);
    expect(R1.centre.distanceTo(expected)).toBeLessThan(1e-9);
    expect(R1.baseCentre.toArray()).toEqual([-0.6 + B.x, AXIAL_Y + B.height, -1.5 + B.z]);
    expect(R1.axis.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9);
    expect(R1.up.distanceTo(new Vector3(0, Math.cos((15 * Math.PI) / 180), Math.sin((15 * Math.PI) / 180)))).toBeLessThan(
      1e-9,
    );
    expect(R1.size).toBe(RESISTOR.length);
    expect(R1.key).toBe('a5 a9');
  });

  it('has none with a leg out of its socket', () => {
    expect(partPlace(layout, ['a5', null], RESISTOR_BOX)).toBeNull();
    expect(partPlace(layout, [], RESISTOR_BOX)).toBeNull();
  });
});

/** The body's largest side as a share of the safe frame's width, and a band in px, through the director on the desk. */
function bodyOnDesk(shot: Shot, place = R1) {
  const view = onDesk(shot);
  const [a, b] = ends(place).map(view.px);
  const px = Math.hypot(b!.x - a!.x, b!.y - a!.y);
  return { share: px / view.frame.w, band: (px * RESISTOR.band) / RESISTOR.length, view };
}

describe('the stops of the dive into a part', () => {
  const door = vec(STOPS.door.position);
  const inside = vec(STOPS.inside.position);

  it('look at the body from one line on the reader’s side, across the axis, 60° over the face', () => {
    expect(vec(STOPS.door.target).distanceTo(R1.centre)).toBeLessThan(1e-9);
    expect(vec(STOPS.inside.target).distanceTo(R1.centre)).toBeLessThan(1e-9);
    const toDoor = door.clone().sub(R1.centre).normalize();
    const toInside = inside.clone().sub(R1.centre).normalize();
    expect(toDoor.distanceTo(toInside)).toBeLessThan(1e-9);
    expect(toDoor.distanceTo(STOPS.view)).toBeLessThan(1e-9);
    expect(Math.abs(toDoor.dot(R1.axis))).toBeLessThan(1e-9);
    expect(Math.asin(toDoor.dot(R1.up))).toBeCloseTo(PART_VIEW.elevation, 9);
    // toward the reader: the camera of `board` is in front of the board, so is the door's
    expect(door.z).toBeGreaterThan(R1.centre.z);
    expect(inside.distanceTo(R1.centre)).toBeLessThan(door.distanceTo(R1.centre));
    const fit = (s: Shot) => s.fit as unknown as { center: V; radius: number };
    for (const s of [STOPS.door, STOPS.inside]) {
      expect(s.fov).toBe(STAGE_FOV);
      expect(vec(fit(s).center).distanceTo(R1.centre)).toBeLessThan(1e-9);
    }
    // the lens leg ends on the rail's own framing; close, a phone keeps the whole body in its frame
    expect(fit(STOPS.door).radius).toBeCloseTo(door.distanceTo(R1.centre) * 0.24, 9);
    expect(fit(STOPS.inside).radius).toBeGreaterThan(R1.size / 2);
  });

  it('at rail 0 the lens is at work over the body: its ring 22–26 % of the frame’s height, framing the body', () => {
    const lens = boardToWorld(STOPS.lens.position.x, STOPS.lens.position.y, STOPS.lens.position.z);
    // on the line from the body to the camera, `lift` from the body
    const toLens = lens.clone().sub(R1.centre);
    expect(toLens.length()).toBeCloseTo(PART_VIEW.lift, 9);
    expect(toLens.normalize().distanceTo(STOPS.view)).toBeLessThan(1e-9);
    const tan = Math.tan(((STAGE_FOV / 2) * Math.PI) / 180);
    const ring = (2 * LENS.radius * (STOPS.lens.scale ?? 1)) / door.distanceTo(lens);
    expect(ring / (2 * tan)).toBeGreaterThanOrEqual(0.22);
    expect(ring / (2 * tan)).toBeLessThanOrEqual(0.26);
    // seen from the door's camera the ring's diameter is well more than the body's length
    expect(ring / (R1.size / door.distanceTo(R1.centre))).toBeGreaterThan(1.2);
    // the camera stands about as far as the step's shot `board`: the lens leg is a short move
    const lead = BOARD_CAMERA.distanceTo(vec(STAGE_SHOTS.board.target));
    expect(door.distanceTo(R1.centre) / lead).toBeGreaterThan(0.85);
    expect(door.distanceTo(R1.centre) / lead).toBeLessThan(1.15);
  });

  it('on the floor `part` (rail 0.5 … 1) the bands read: ≥ 12 px at 1280 × 720; the body ≥ 35 % soon after it begins', () => {
    const rail = createDiveRail([STOPS.door, STOPS.inside], STAGE_SHOTS.board);
    let from35 = Infinity;
    let last = 0;
    for (let t = FLOOR_FROM.part; t <= 1 + 1e-9; t += 0.01) {
      const { share, band } = bodyOnDesk(rail.shotAt(t));
      expect(band, `rail ${t.toFixed(2)}`).toBeGreaterThanOrEqual(12);
      expect(share).toBeGreaterThan(last);
      last = share;
      if (share >= 0.35 && from35 === Infinity) from35 = t;
    }
    // the floor begins with the body a quarter of the frame's width (VISUAL §7 asks 35 %: the push-in keeps its pace,
    // see `poses.ts`) and has it at 35 % from ≈ 0.64 on
    expect(bodyOnDesk(rail.shotAt(FLOOR_FROM.part)).share).toBeGreaterThan(0.24);
    expect(from35).toBeLessThan(0.66);
    // whole on the floor up to the ring's pass: the part opens only after it (`door.ts`)
    expect(CUT_OPENS[0]).toBeGreaterThan(0.75);
  });

  it('on `inside`: the body opened on its place, 85 % of the frame’s width, whole in the free area', () => {
    const { share, view } = bodyOnDesk(STOPS.inside);
    expect(share).toBeCloseTo(PART_VIEW.inside, 2);
    for (const e of ends(R1)) expect(view.inside(e)).toBe(true);
  });
});

describe('the stops follow the part', () => {
  it('a part on other sockets: the same frame, moved with it', () => {
    const moved = placeAt(['j13', 'j17']);
    const s = partStops(moved, BOARD_CAMERA);
    const shift = moved.centre.clone().sub(R1.centre);
    expect(shift.length()).toBeGreaterThan(1);
    expect(vec(s.door.target).distanceTo(vec(STOPS.door.target).add(shift))).toBeLessThan(1e-9);
    // the camera stays across the axis on the reader's side: only its spot moves with the part
    expect(s.view.distanceTo(STOPS.view)).toBeLessThan(1e-9);
    expect(vec(s.door.position).distanceTo(vec(STOPS.door.position).add(shift))).toBeLessThan(1e-9);
  });

  it('a part turned a quarter (along the lines a → e): the camera stays across its axis', () => {
    const turned = placeAt(['a5', 'e5']);
    const s = partStops(turned, BOARD_CAMERA);
    expect(Math.abs(s.view.dot(turned.axis))).toBeLessThan(1e-9);
    expect(Math.asin(s.view.dot(turned.up))).toBeCloseTo(PART_VIEW.elevation, 9);
    // column 5 is left of the board camera: the door looks at it from its right, toward the camera
    expect(s.view.x).toBeGreaterThan(0);
    // column 9 points straight at the board camera: the door looks from the reader's right
    const straight = placeAt(['a9', 'e9']);
    const t = partStops(straight, BOARD_CAMERA);
    expect(Math.abs(t.view.dot(straight.axis))).toBeLessThan(1e-9);
    expect(t.view.x).toBeGreaterThan(0.4);
  });

  it('a rail from the shot `board` through them moves without a jump and lays the lens by 85 % of its leg', () => {
    const rail = createDiveRail([STOPS.door, STOPS.inside], STAGE_SHOTS.board);
    const change = (a: Shot, b: Shot): number => {
      const dist = vec(a.position).distanceTo(vec(a.target));
      return (vec(a.position).distanceTo(vec(b.position)) + vec(a.target).distanceTo(vec(b.target))) / dist;
    };
    let worst = 0;
    for (let t = rail.min; t < 1 - 0.0025; t += 0.005) worst = Math.max(worst, change(rail.shotAt(t), rail.shotAt(t + 0.005)));
    expect(worst).toBeLessThan(0.06);
    expect(vec(rail.shotAt(rail.min).position).distanceTo(BOARD_CAMERA)).toBeLessThan(1e-9);
    expect(vec(rail.shotAt(0).position).distanceTo(vec(STOPS.door.position))).toBeLessThan(1e-9);
    expect(vec(rail.shotAt(1).position).distanceTo(vec(STOPS.inside.position))).toBeLessThan(1e-9);
    expect(rail.lensAt(-LENS_LEG + LENS_LEG * LENS_LANDS)).toBeCloseTo(1, 9);
  });
});

/* ---------------------------------------------------------------------------------------- the cutaway */

const AXIS = new Vector3(0, AXIAL_Y, 0);
/** Whether three's clipping (with `clipIntersection`) removes a point of the body frame (the model at the origin). */
function clipped(m: Material, p: Vector3): boolean {
  const planes = m.clippingPlanes ?? [];
  if (planes.length === 0) return false;
  const out = planes.map((pl) => pl.distanceToPoint(p) < 0);
  return m.clipIntersection ? out.every(Boolean) : out.some(Boolean);
}
const faceArea = (g: BufferGeometry): number => {
  const a = g.getAttribute('position');
  let s = 0;
  for (let i = 0; i < a.count; i += 3) {
    const [x0, y0, x1, y1, x2, y2] = [a.getX(i), a.getY(i), a.getX(i + 1), a.getY(i + 1), a.getX(i + 2), a.getY(i + 2)];
    s += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
  }
  return s;
};

describe('the resistor’s temporary cutaway (VISUAL §7)', () => {
  const make = (): PartModel => {
    const m = buildPart('resistor-4k7')!;
    m.group.updateWorldMatrix(true, true);
    return m;
  };

  it('opens a quarter wedge on the camera’s side and keeps the rest', () => {
    const m = make();
    const cut = createCutaway(m)!;
    const body = m.body[0]!;
    // closed: nothing clipped, nothing drawn
    cut.set(0, new Vector3(0, 1, 0));
    expect(cut.open).toBe(false);
    expect(clipped(body, AXIS.clone().add(new Vector3(0, 0.1, 0)))).toBe(false);
    // open toward +y: the wedge ±45° about +y is gone, the side at 90° and the far side are kept
    cut.set(1, new Vector3(0, 1, 0));
    expect(cut.open).toBe(true);
    expect(cut.amount).toBe(1);
    const at = (deg: number, r = 0.1): Vector3 => {
      const a = (deg * Math.PI) / 180;
      return AXIS.clone().add(new Vector3(0.05, r * Math.cos(a), r * Math.sin(a)));
    };
    // (each plane clips 0.002 past itself, where the section face stands: 50° at r 0.1 is 0.009 off the plane)
    for (const deg of [0, 30, -30, 44, -44]) expect(clipped(body, at(deg)), `${deg}°`).toBe(true);
    for (const deg of [50, -50, 90, -90, 180]) expect(clipped(body, at(deg)), `${deg}°`).toBe(false);
    // half open: the wedge is half as wide
    cut.set(0.5, new Vector3(0, 1, 0));
    expect(clipped(body, at(20))).toBe(true);
    expect(clipped(body, at(25))).toBe(false);
    // the legs are never cut
    expect(m.legs.material as Material).not.toBe(body);
    expect(((m.legs.material as Material).clippingPlanes ?? []).length).toBe(0);
    // a camera on the reader's side (+z of the body frame): the wedge turns there
    cut.set(1, new Vector3(0, 0, 1));
    expect(clipped(body, at(90))).toBe(true);
    expect(clipped(body, at(0))).toBe(false);
  });

  it('closes its section with faces of the rod, the film, the caps and the lacquer, within the body', () => {
    const m = make();
    const body = m.body[0]!;
    const cut = createCutaway(m)!;
    cut.set(1, new Vector3(0, 1, 0));
    const pivot = m.bodyGroup.getObjectByName(`${m.key}:cutaway`)!;
    const faces = pivot.children;
    expect(faces).toHaveLength(2);
    const L = RESISTOR.length;
    // the lacquer and the bands' paint up to the body's surface, nothing beyond it, and no gap: each face covers the
    // body's section under its profile (and the paint of the bands)
    const under = (() => {
      let s = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) s += (resistorRadius(((i + 0.5) / n) * L) * L) / n;
      return s;
    })();
    const paint = RESISTOR.bands.length * RESISTOR.band * RESISTOR_INSIDE.paint;
    for (const face of faces) {
      const meshes = face.children as Mesh[];
      // the lacquer is a twin of the body's own material that clips nothing and takes the body's heat (one uniform)
      const lacquer = meshes[0]!.material as typeof body;
      expect(lacquer).not.toBe(body);
      expect(lacquer.uniforms.uKHeat).toBe(body.uniforms.uKHeat);
      expect(lacquer.clippingPlanes ?? []).toHaveLength(0);
      expect((meshes[1]!.material as Material).clippingPlanes ?? []).toHaveLength(0);
      let area = 0;
      for (const mesh of meshes) {
        const g = mesh.geometry;
        area += faceArea(g);
        const p = g.getAttribute('position');
        // (the positions are float32: a micrometre of slack)
        for (let i = 0; i < p.count; i++) {
          const u = p.getX(i) + L / 2;
          expect(u).toBeGreaterThanOrEqual(-1e-6);
          expect(u).toBeLessThanOrEqual(L + 1e-6);
          const r = resistorRadius(Math.min(Math.max(u, 0), L));
          expect(p.getY(i)).toBeLessThanOrEqual(r + RESISTOR_INSIDE.paint + 1e-6);
        }
      }
      // each face stands in the hair its plane clips into the kept side: whatever of the body reaches the plane is cut
      // away behind the face (a point of it, in the body frame at the origin, is clipped by both planes)
      face.updateWorldMatrix(true, true);
      const g = meshes[0]!.geometry.getAttribute('position');
      const onFace = new Vector3(g.getX(0), g.getY(0), g.getZ(0)).applyMatrix4(meshes[0]!.matrixWorld);
      expect(Math.abs(g.getZ(0))).toBeGreaterThan(0);
      expect(clipped(body, onFace)).toBe(true);
      expect(area).toBeCloseTo(under + paint, 3);
    }
    cut.set(CLOSED / 2, new Vector3(0, 1, 0));
    expect(faces.every((f) => !f.visible)).toBe(true);
  });

  it('gives the part back whole when it is disposed; a kind with no cutaway of its own stays whole', () => {
    const m = make();
    const before = m.materials.map((x) => x.clippingPlanes);
    const cut = createCutaway(m)!;
    cut.set(1, new Vector3(0, 1, 0));
    cut.dispose();
    expect(m.materials.map((x) => x.clippingPlanes)).toEqual(before);
    expect(m.bodyGroup.getObjectByName(`${m.key}:cutaway`)).toBeUndefined();
    expect(createCutaway(buildPart('led-red')!)).toBeNull();
    expect(createCutaway(createResistor(100, 0.05, 'resistor-100'))).not.toBeNull();
  });
});
