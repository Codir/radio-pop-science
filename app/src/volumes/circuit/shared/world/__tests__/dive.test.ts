import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Shot } from '@/engine/api';
import { HANDOVER, STAGE_SHOTS } from '@circuit/shared/stage/shots';
import { LENS_LANDS, LENS_LEG, createDiveRail, ringEase } from '../dive';

// the stand's shots and two stand-ins for the copper floors further down the same axis
const below = (k: number): Shot => ({
  position: HANDOVER.spot
    .clone()
    .addScaledVector(HANDOVER.direction, -HANDOVER.distance * k)
    .toArray(),
  target: HANDOVER.spot.toArray(),
  fov: STAGE_SHOTS.handover.fov,
});
const STOPS = [STAGE_SHOTS.lens, STAGE_SHOTS.handover, below(0.4), below(0.1)];
const vec = (a: Shot['position']): Vector3 => new Vector3(...(a as [number, number, number]));

/** How much the frame changes between two poses, relative to the viewing distance (≈ share of the frame). */
function change(a: Shot, b: Shot): number {
  const dist = vec(a.position).distanceTo(vec(a.target));
  return (vec(a.position).distanceTo(vec(b.position)) + vec(a.target).distanceTo(vec(b.target))) / dist;
}

describe('dive rail: the lens leg', () => {
  const rail = createDiveRail(STOPS, STAGE_SHOTS.stand);

  it('starts on the stand plan with the lens in its holder', () => {
    expect(rail.min).toBe(-LENS_LEG);
    const s = rail.shotAt(rail.min);
    expect(vec(s.position).distanceTo(vec(STAGE_SHOTS.stand.position))).toBeLessThan(1e-9);
    expect(vec(s.target).distanceTo(vec(STAGE_SHOTS.stand.target))).toBeLessThan(1e-9);
    // the stand's framing and idle drift, so that engaging there changes nothing on screen
    expect(s.fit).toEqual(STAGE_SHOTS.stand.fit);
    expect(s.drift).toBe(1);
    expect(rail.lensAt(rail.min)).toBe(0);
    expect(rail.deepAt(rail.min)).toBe(0);
  });

  it('lays the lens on the wire before the camera has arrived, and keeps `deep` 0 all the way', () => {
    let last = -1;
    for (let t = -LENS_LEG; t <= 0; t += 0.005) {
      const lens = rail.lensAt(t);
      expect(lens).toBeGreaterThanOrEqual(last);
      last = lens;
      expect(rail.deepAt(t)).toBe(0);
    }
    expect(rail.lensAt(-LENS_LEG + LENS_LEG * LENS_LANDS)).toBeCloseTo(1, 9);
    expect(change(rail.shotAt(-LENS_LEG * (1 - LENS_LANDS)), rail.shotAt(0))).toBeGreaterThan(0.01);
  });

  it('meets the dive at 0 exactly as the rail without a lens leg does', () => {
    const plain = createDiveRail(STOPS);
    expect(plain.min).toBe(0);
    for (const t of [0, 0.3, 1, 2.5]) {
      expect(change(rail.shotAt(t), plain.shotAt(t))).toBeLessThan(1e-9);
      expect(rail.deepAt(t)).toBe(plain.deepAt(t));
    }
    expect(change(rail.shotAt(-1e-6), rail.shotAt(0))).toBeLessThan(1e-4);
    expect(rail.shotAt(0).drift).toBe(0);
  });
});

describe('dive rail: no jump anywhere', () => {
  const rail = createDiveRail(STOPS, STAGE_SHOTS.stand);
  const dt = 0.005;
  const steps: number[] = [];
  for (let t = rail.min; t < 3 - dt / 2; t += dt) steps.push(change(rail.shotAt(t), rail.shotAt(t + dt)));

  it('moves the frame by small amounts between neighbouring positions', () => {
    expect(Math.max(...steps)).toBeLessThan(0.06);
  });

  it('keeps its pace where the lens leg meets the push-in through the ring (0)', () => {
    const at = (t: number): number => steps[Math.round((t - rail.min) / dt)]!;
    const before = at(-2 * dt);
    const after = at(dt);
    expect(after / before).toBeLessThan(1.5);
    expect(before / after).toBeLessThan(1.5);
  });

  it('`deep` is continuous and the ring leg eases in from the lens leg', () => {
    expect(ringEase(0)).toBe(0);
    expect(ringEase(1)).toBe(1);
    let last = 0;
    for (let t = 0; t <= 3; t += dt) {
      const d = rail.deepAt(t);
      expect(d).toBeGreaterThanOrEqual(last - 1e-12);
      expect(d - last).toBeLessThan(0.012);
      last = d;
    }
    expect(rail.deepAt(0.05)).toBeLessThan(0.05 * 0.5);
  });
});

describe('dive rail: where to engage, how to travel', () => {
  it('finds the position that shows a state (inverse of deep and lens)', () => {
    const rail = createDiveRail(STOPS, STAGE_SHOTS.stand);
    expect(rail.positionOf(0, 0)).toBe(-LENS_LEG);
    expect(rail.positionOf(0, 1)).toBe(0);
    expect(rail.lensAt(rail.positionOf(0, 0.4))).toBeCloseTo(0.4, 9);
    for (const t of [0.1, 0.5, 0.93, 1.7, 2]) expect(rail.positionOf(rail.deepAt(t), 1)).toBeCloseTo(t, 6);
    // without a lens leg the stand with the lens in its holder is simply 0
    expect(createDiveRail(STOPS).positionOf(0, 0)).toBe(0);
  });

  it('a timed travel arrives in exactly that long, eased in and out', () => {
    const rail = createDiveRail(STOPS, STAGE_SHOTS.stand);
    rail.set(2);
    rail.travelTo(-LENS_LEG, 1.5);
    const first = 2 - rail.step(1 / 60);
    let t = 1 / 60;
    let mid = 0;
    while (rail.moving && t < 3) {
      const before = rail.position;
      rail.step(1 / 60);
      mid = Math.max(mid, before - rail.position);
      t += 1 / 60;
    }
    expect(rail.position).toBe(-LENS_LEG);
    expect(t).toBeCloseTo(1.5, 1);
    expect(first).toBeLessThan(mid / 10);
  });

  it('a click glides at the rail pace; a drag is the frame at once', () => {
    const rail = createDiveRail(STOPS, STAGE_SHOTS.stand);
    rail.set(rail.min);
    rail.travelTo(0);
    rail.step(0.25);
    expect(rail.position).toBeGreaterThan(rail.min);
    expect(rail.position).toBeLessThan(0);
    rail.scrub(-0.2);
    expect(rail.position).toBe(-0.2);
    expect(rail.moving).toBe(false);
  });
});
