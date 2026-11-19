import { PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { SITE } from '@radio/sim/core';
import { CAT, HOUSE_SKIRT, MONITOR_ANTENNA, MONITOR_CASE, buildYardProps } from '../../models';
import {
  LAYOUT,
  LENS,
  type P2,
  type V3,
  gateYaw,
  monitorPlace,
  screenPlace,
  toScene,
  toScene2,
} from '../layout';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The eye's camera at the lens, as the yard points it (B1a: 40° vertical, 128 × 96). */
const eyeCamera = (): PerspectiveCamera => {
  const cam = new PerspectiveCamera(LENS.fov, 4 / 3, 0.1, 200);
  cam.position.set(...LENS.position);
  cam.lookAt(...LENS.lookAt);
  cam.updateMatrixWorld();
  return cam;
};

describe('layout', () => {
  it('п’ять зупинок стоять на SITE.route', () => {
    for (let i = 0; i < 5; i++) expect(monitorPlace(i, 0).position).toEqual(toScene(SITE.route[i]!));
  });

  it('між зупинками — посередині', () => {
    const m = monitorPlace(1.5, 0).position;
    const a = toScene(SITE.route[1]!);
    const b = toScene(SITE.route[2]!);
    for (let k = 0; k < 3; k++) expect(m[k]).toBeCloseTo((a[k]! + b[k]!) / 2, 9);
  });

  it('nudge зсуває вздовж SITE.nudgeAxis на задані метри', () => {
    const d = sub(monitorPlace(2, 0.1).position, monitorPlace(2, 0).position);
    const want = toScene([0.1 * SITE.nudgeAxis[0], 0.1 * SITE.nudgeAxis[1], 0]);
    for (let k = 0; k < 3; k++) expect(d[k]).toBeCloseTo(want[k]!, 9);
  });

  it('антена камери — у SITE.tx, об’єктив — на 0,2 м нижче', () => {
    expect(LAYOUT.tx).toEqual(toScene(SITE.tx));
    expect(LENS.position[0]).toBe(LAYOUT.tx[0]);
    expect(LENS.position[1]).toBeCloseTo(LAYOUT.tx[1] - 0.2, 9);
    expect(LENS.position[2]).toBe(LAYOUT.tx[2]);
  });

  it('стіни дому — це стіни SITE', () => {
    const h = LAYOUT.plan.house;
    expect(h.walls).toHaveLength(SITE.walls.length);
    expect(h.slabY).toBe(SITE.slabZ);
    for (const w of SITE.walls) {
      const p = h.walls.find((x) => x.id === w.id)!;
      expect(p.a).toEqual(toScene2(w.a));
      expect(p.b).toEqual(toScene2(w.b));
      expect(p.look).toBe(w.material);
      // heights: VISUAL.md «Стіни дому»
      expect([p.y0, p.y1]).toEqual(
        w.material === 'brick' ? [-2.5, 2.7] : w.id === 'partition' ? [0, 2.7] : [0, 2],
      );
    }
  });

  it('піч, роутер і підвіконня — там, де їх має модель', () => {
    const h = LAYOUT.plan.house;
    const k = monitorPlace(1, 0).position;
    expect(h.microwave).toEqual(toScene(SITE.oven.at));
    expect(LAYOUT.plan.neighbour.router).toEqual(toScene(SITE.router.at));
    expect(Math.hypot(h.sill[0] - k[0], h.sill[2] - k[2])).toBeLessThanOrEqual(0.3);
    expect(h.sill[1]).toBeCloseTo(screenPlace(1)[1] - MONITOR_CASE.height / 2, 3);
    expect(h.phone[1] - h.sill[1]).toBeGreaterThanOrEqual(0);
    expect(h.phone[1] - h.sill[1]).toBeLessThanOrEqual(0.08);
  });

  it('відчинена стулка лежить на SITE.gateLeaf', () => {
    const g = LAYOUT.plan.garage.gate;
    const b = toScene2(SITE.gateLeaf.b);
    const end = (yaw: number): P2 => [
      g.hinge[0] + g.width * Math.cos(yaw),
      g.hinge[1] - g.width * Math.sin(yaw),
    ];
    expect(g.hinge).toEqual(toScene2(SITE.gateLeaf.a));
    expect(end(gateYaw(1))[0]).toBeCloseTo(b[0], 6);
    expect(end(gateYaw(1))[1]).toBeCloseTo(b[1], 6);
    expect(gateYaw(0)).toBe(g.closedYaw);
    expect(gateYaw(0.5)).toBeCloseTo((g.closedYaw + g.openYaw) / 2, 9);
    // shut: along x = 27.25 down to (27.25; −7.23)
    const shut = toScene2([27.25, -7.23]);
    expect(end(gateYaw(0))[0]).toBeCloseTo(shut[0], 2);
    expect(end(gateYaw(0))[1]).toBeCloseTo(shut[1], 2);
    // the leaf opens by 36.6°
    expect(Math.abs(g.openYaw - g.closedYaw)).toBeCloseTo(0.639, 2);
  });

  it('екран стоїть перед антеною монітора', () => {
    // +Z of the monitor is the screen's normal, +X — to the right of a viewer in front of the screen
    for (const r of [0, 1, 2.5, 4]) {
      const { position: a, yaw } = monitorPlace(r, 0);
      const f = yaw + Math.PI / 2;
      const [mx, my, mz] = MONITOR_ANTENNA;
      const s = screenPlace(r);
      expect(s[0]).toBeCloseTo(a[0] - (mx * Math.cos(f) + mz * Math.sin(f)), 9);
      expect(s[1]).toBeCloseTo(a[1] - my, 9);
      expect(s[2]).toBeCloseTo(a[2] - (mz * Math.cos(f) - mx * Math.sin(f)), 9);
    }
  });

  it('камера бачить кота, хвіртку, білу стіну й темний закуток', () => {
    const cam = eyeCamera();
    for (const k of ['cat', 'wicket', 'shedWall', 'nook'] as const) {
      const p = LAYOUT.places[k].position;
      const v = new Vector3(...p).project(cam);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(0.75);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(0.75);
      expect(v.z).toBeLessThan(1);
    }
    // the shed's anchors lie on the same points
    expect(LAYOUT.plan.shed.wall).toEqual(LAYOUT.places.shedWall.position);
    expect(LAYOUT.plan.shed.nook).toEqual(LAYOUT.places.nook.position);
  });

  it('кіт на кадрі камери — не вужчий за 8 комірок, цятка — не менша за одну', () => {
    // the width by the silhouette: the projection of the ends of the body along the cat's walk
    const cam = eyeCamera();
    const { position: p, yaw } = LAYOUT.places.cat;
    const h = CAT.length / 2;
    const colAt = (s: number) =>
      ((new Vector3(p[0] + s * h * Math.cos(yaw), p[1], p[2] - s * h * Math.sin(yaw)).project(cam).x + 1) /
        2) *
      128;
    expect(Math.abs(colAt(1) - colAt(-1))).toBeGreaterThanOrEqual(8);
    const w = 2 * dist(LENS.position, p) * Math.tan((25.9 * Math.PI) / 180);
    expect((CAT.spot / w) * 128).toBeGreaterThanOrEqual(1);
  });

  it('справжнє подвір’я: під домом яма, довкола вимощення, на ньому — лише велосипед', () => {
    // the same measurements as B12 (step 1), on the island and the house of LAYOUT.plan
    const props = buildYardProps(LAYOUT.plan, new Rng('layout-test'));
    const c = LAYOUT.plan.centre;
    const h = LAYOUT.plan.house;
    const cellar = Math.min(...h.walls.map((w) => w.y0));
    const groundAt = (x: number, z: number) => (
      props.island.group.updateMatrixWorld(true),
      new Raycaster(new Vector3(x - c[0], 10, z - c[1]), new Vector3(0, -1, 0)).intersectObject(
        props.island.group,
        true,
      )[0]!.point.y
    );
    // box — the bounding rectangle of the ends of h.walls; d — the outer edge of the skirt from the wall lines
    const ends = h.walls.flatMap((w) => [w.a, w.b]);
    const box = {
      x0: Math.min(...ends.map((e) => e[0])),
      x1: Math.max(...ends.map((e) => e[0])),
      z0: Math.min(...ends.map((e) => e[1])),
      z1: Math.max(...ends.map((e) => e[1])),
    };
    const d = 0.1 + HOUSE_SKIRT.width;
    /** L∞ distance of a scene point (x, z) from `box` (0 inside). */
    const off = (x: number, z: number) => Math.max(0, box.x0 - x, x - box.x1, box.z0 - z, z - box.z1);
    // a grid of 0.25 m inside the walls: the pit
    for (let x = box.x0 + 0.1; x <= box.x1 - 0.1 + 1e-9; x += 0.25)
      for (let z = box.z0 + 0.1; z <= box.z1 - 0.1 + 1e-9; z += 0.25)
        expect(groundAt(x, z)).toBeLessThan(cellar - 0.05);
    // points every 0.25 m on the perimeter of the box grown by d + 0.05 and by d + 0.5: level ground
    for (const e of [d + 0.05, d + 0.5]) {
      const x0 = box.x0 - e;
      const x1 = box.x1 + e;
      const z0 = box.z0 - e;
      const z1 = box.z1 + e;
      for (let x = x0; x <= x1 + 1e-9; x += 0.25)
        for (const z of [z0, z1]) expect(Math.abs(groundAt(x, z))).toBeLessThanOrEqual(0.01);
      for (let z = z0; z <= z1 + 1e-9; z += 0.25)
        for (const x of [x0, x1]) expect(Math.abs(groundAt(x, z))).toBeLessThanOrEqual(0.01);
    }
    for (const [k, p] of Object.entries(LAYOUT.places))
      if (k !== 'bicycle' && k !== 'trayRest')
        expect(off(p.position[0], p.position[2])).toBeGreaterThan(d + 0.5);
    const y = monitorPlace(0, 0).position;
    expect(off(y[0], y[2])).toBeGreaterThan(d + 0.5);
    // the bounding rectangle of the garage's walls and the hinge of the leaf: farther than d + 0.1 from box (the
    // leaf opens away from the house, so its ends shut and open are checked too)
    const gEnds = LAYOUT.plan.garage.walls.flatMap((w) => [w.a, w.b]);
    const gx0 = Math.min(...gEnds.map((e) => e[0]));
    const gx1 = Math.max(...gEnds.map((e) => e[0]));
    const gz0 = Math.min(...gEnds.map((e) => e[1]));
    const gz1 = Math.max(...gEnds.map((e) => e[1]));
    expect(Math.max(gx0 - box.x1, box.x0 - gx1, gz0 - box.z1, box.z0 - gz1)).toBeGreaterThan(d + 0.1);
    const gate = LAYOUT.plan.garage.gate;
    expect(off(gate.hinge[0], gate.hinge[1])).toBeGreaterThan(d + 0.1);
    for (const yaw of [gateYaw(0), gateYaw(1)])
      expect(
        off(gate.hinge[0] + gate.width * Math.cos(yaw), gate.hinge[1] - gate.width * Math.sin(yaw)),
      ).toBeGreaterThan(d + 0.1);
    // the bicycle stands on the skirt (step 5)
    const b = LAYOUT.places.bicycle.position;
    expect(off(b[0], b[2])).toBeGreaterThan(0.1);
    expect(off(b[0], b[2])).toBeLessThan(d);
  });
});
