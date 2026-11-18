/**
 * `sim.leash` (chapters 4 – 6): with it the common drift carries the whole crowd — every electron keeps darting,
 * but about a home of its own that slides with the drift, so the crowd's pattern moves as one. Measured on the
 * simulation itself, without wrapping (a box far larger than the run).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { siteIndex } from '../electron-rules';
import { createElectronSim, FOCUS_COUNT } from '../electron-sim';
import { latticeSites } from '../layout';

const sites = latticeSites();
function run(leash: number, drift: number, seconds: number) {
  const sim = createElectronSim(new Rng('leash'), { sites, at: siteIndex(sites), presence: () => 1 });
  sim.box = { x: 500, y: 500 };
  sim.leash = leash;
  sim.drift = drift;
  sim.step(1 / 60, 0); // the homes are taken here, where the electrons are
  const start = Array.from({ length: FOCUS_COUNT }, (_, e) => [sim.pos[3 * e]!, sim.pos[3 * e + 1]!]);
  let far = 0;
  for (let f = 0; f < seconds * 60; f++) {
    sim.step(1 / 60, (f + 1) / 60);
    // how far an electron strays from where its home has got to (its start carried by the drift)
    for (let e = 0; e < FOCUS_COUNT; e++) {
      const hx = start[e]![0]! + drift * sim.speed * ((f + 1) / 60);
      far = Math.max(far, Math.hypot(sim.pos[3 * e]! - hx, sim.pos[3 * e + 1]! - start[e]![1]!));
    }
  }
  let shift = 0;
  for (let e = 0; e < FOCUS_COUNT; e++) shift += (sim.pos[3 * e]! - start[e]![0]!) / FOCUS_COUNT;
  return { shift, far };
}

describe('the leash: the drift carries the whole crowd', () => {
  it('the crowd moves by the drift, and no electron strays far from its sliding home', () => {
    const { shift, far } = run(1.7, -0.06, 10);
    // 0.06 × 12 units/s × 10 s = 7.2 units to the left
    expect(shift).toBeLessThan(-6);
    expect(shift).toBeGreaterThan(-8.4);
    // the leash plus one frame's flight and a collision's push
    expect(far).toBeLessThan(1.7 + 1.2);
  });
  it('without a drift the leashed crowd stays where it is', () => {
    expect(Math.abs(run(1.7, 0, 10).shift)).toBeLessThan(0.6);
  });
});
