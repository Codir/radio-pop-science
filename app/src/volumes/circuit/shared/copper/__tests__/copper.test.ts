import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { CAMERA_Z, CORE_R } from '../core';
import { siteIndex } from '../electron-rules';
import { createElectronSim, FOCUS_COUNT } from '../electron-sim';
import {
  ATOM_R,
  COPPER_TOP,
  ELECTRON_R,
  latticeSites,
  PIECE_ATOMS,
  PITCH,
  ROW_ATOMS,
  ROW_HALF,
} from '../layout';
import { mountAtHandover } from '../mount';

describe('lattice sites', () => {
  const sites = latticeSites();
  it('starts with the hero, its right neighbour, the row, the piece', () => {
    expect(sites[0]!.p.length()).toBe(0);
    expect(sites[1]!.p.distanceTo(new Vector3(PITCH, 0, 0))).toBe(0);
    for (const s of sites.slice(0, ROW_ATOMS)) expect(s.j === 0 && Math.abs(s.i) <= ROW_HALF).toBe(true);
    for (const s of sites.slice(0, PIECE_ATOMS)) {
      expect(s.plane).toBe(0);
      expect(Math.abs(s.j) <= 1 && Math.abs(s.i) <= ROW_HALF).toBe(true);
    }
  });
  it('keeps every atom below the top surface of the copper and has no two in one place', () => {
    const seen = new Set<string>();
    for (const s of sites) {
      expect(s.p.y).toBeLessThanOrEqual(COPPER_TOP);
      const key = s.p
        .toArray()
        .map((v) => v.toFixed(3))
        .join();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('mount at the hand-over of the stand', () => {
  // HANDOVER of W1-circuit-stage, 2026-11-16
  const h = {
    point: [0.99, 1.141, 1.549],
    view: [0, -0.66, -0.7513],
    axis: [1, 0, 0],
    coreRadius: 0.036,
  } as const;
  const group = new Group();
  const scale = mountAtHandover(group, h);
  const world = (x: number, y: number, z: number): Vector3 =>
    new Vector3(x, y, z).applyMatrix4(group.matrixWorld);
  it('puts the camera of the shot `core` where the stand leaves it', () => {
    const view = new Vector3(...h.view).normalize();
    const expected = new Vector3(...h.point).addScaledVector(view, -4.17 * h.coreRadius);
    // 4.17 radii is the published, rounded figure: allow a hundredth of a radius
    expect(world(0, 0, CAMERA_Z).distanceTo(expected)).toBeLessThan(0.01 * h.coreRadius * 4.17);
  });
  it('puts the wire axis through the published point, along the published direction', () => {
    expect(world(0, 0, 0.35 - CORE_R).distanceTo(new Vector3(...h.point))).toBeLessThan(1e-6);
    expect(
      world(1, 0, 0)
        .sub(world(0, 0, 0))
        .normalize().x,
    ).toBeCloseTo(1, 6);
    expect(scale).toBeCloseTo(h.coreRadius / CORE_R, 9);
  });
});

describe('free electrons', () => {
  const sites = latticeSites();
  const sim = createElectronSim(new Rng('test'), { sites, at: siteIndex(sites), presence: () => 1 });
  sim.gate.on = true;
  sim.gate.x = PITCH / 2;
  sim.gate.half = 6;
  for (let f = 0; f < 60 * 40; f++) sim.step(1 / 60, f / 60);
  it('never end a frame inside an atom of the focal plane or above the copper', () => {
    for (let e = 0; e < FOCUS_COUNT; e++) {
      const p = new Vector3().fromArray(sim.pos, 3 * e);
      expect(p.y).toBeLessThanOrEqual(COPPER_TOP);
      for (const s of sites) {
        if (s.plane > 0) break;
        expect(p.distanceTo(s.p)).toBeGreaterThan(ATOM_R + ELECTRON_R * 0.9);
      }
    }
  });
  it('cross the counter frame about as often to the left as to the right (no drift)', () => {
    const { left, right } = sim.gate;
    expect(left + right).toBeGreaterThan(100);
    expect(Math.abs(left - right) / (left + right)).toBeLessThan(0.12);
  });
  it('cross it mostly one way with a drift', () => {
    sim.gate.left = sim.gate.right = 0;
    sim.drift = -0.3;
    for (let f = 0; f < 60 * 20; f++) sim.step(1 / 60, 40 + f / 60);
    expect(sim.gate.left).toBeGreaterThan(sim.gate.right * 1.3);
  });
});
