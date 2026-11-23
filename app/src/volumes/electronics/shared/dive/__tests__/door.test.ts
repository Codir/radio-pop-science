/**
 * The door into a part (docs/volumes/electronics/VISUAL.md §7) as pure maths: where a part's body is from its sockets
 * (`poses.ts`), the stops of the dive computed from that place — the lens at work over the body with its ring 22–26 %
 * of the frame's height, the floor `part` with the bands ≥ 12 px at 1280 × 720 (through the real `CameraDirector` with
 * the desk's panels), `inside` closer on the same line — a part moved or turned getting its own stops, a rail through
 * them from the bench's shot `board` without a jump; and which inner view a part opens (`cutaway.ts`; the views
 * themselves are tested in `shared/inside/__tests__`).
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CameraDirector, type Shot } from '@/engine/camera/director';
import { PARTS } from '@electronics/sim/core';
import { createLayout, type SocketId } from '@electronics/sim/board';
import { LENS, PLACES } from '../../bench/layout';
import { STAGE_FOV, STAGE_SHOTS, boardToWorld } from '../../bench/shots';
import { asFilm, asPlates, asRoll } from '../../inside';
import { AXIAL_Y, RESISTOR, buildPart, createResistor } from '../../parts';
import { createCutaway } from '../cutaway';
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

/* ----------------------------------------------------------------------------------- the inner views */

describe('the inner views by kind (cutaway.ts)', () => {
  it('a resistor opens its carbon film; a kind with no inner view yet stays whole', () => {
    const r = createCutaway(createResistor(100, 0.05, 'resistor-100'));
    expect(r).not.toBeNull();
    expect(asFilm(r)).not.toBeNull();
    r!.dispose();
    expect(createCutaway(buildPart('led-red')!)).toBeNull();
    expect(createCutaway(buildPart('ceramic-100n')!)).toBeNull();
  });

  it('a capacitor opens by its dielectric: an electrolytic its plates, a film box its roll, a ceramic disc nothing', () => {
    for (const [key, s] of Object.entries(PARTS)) {
      if (s.kind !== 'capacitor') continue;
      const c = createCutaway(buildPart(key)!);
      if (s.dielectric === 'electrolytic') {
        expect(asPlates(c), key).not.toBeNull();
        expect(asRoll(c), key).toBeNull();
      } else if (s.dielectric === 'film') {
        expect(asRoll(c), key).not.toBeNull();
        expect(asPlates(c), key).toBeNull();
      } else expect(c, key).toBeNull();
      expect(asFilm(c), key).toBeNull();
      c?.dispose();
    }
  });
});
