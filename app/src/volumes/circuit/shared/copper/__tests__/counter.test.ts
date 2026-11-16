/**
 * The counter frame of `wire/restless` and the common drift: what the picture promises, measured on the
 * simulation itself (the frame stands where the chapters put it, left of the hero's column).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { siteIndex } from '../electron-rules';
import { createElectronSim, driftFor, FOCUS_COUNT, type ElectronSim } from '../electron-sim';
import { latticeSites } from '../layout';

const sites = latticeSites();
function run(seed: string, seconds: number, set: (sim: ElectronSim) => void) {
  const sim = createElectronSim(new Rng(seed), { sites, at: siteIndex(sites), presence: () => 1 });
  Object.assign(sim.gate, { on: true, x: -4.8, y: 0, half: 3.3 });
  set(sim);
  let worst = 0;
  let gapSum = 0;
  let meanX = 0;
  const frames = Math.round(seconds * 60);
  const before = Float32Array.from(sim.pos);
  for (let f = 0; f < frames; f++) {
    sim.step(1 / 60, f / 60);
    const gap = Math.abs(sim.gate.left - sim.gate.right);
    worst = Math.max(worst, gap);
    gapSum += gap;
    if (f === 0) before.set(sim.pos);
  }
  for (let e = 0; e < FOCUS_COUNT; e++) meanX += sim.pos[3 * e]! / FOCUS_COUNT;
  return { sim, worst, meanGap: gapSum / frames, meanX };
}
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('common drift follows the lamp', () => {
  it('is zero with the lamp off and right → left in proportion to the glow', () => {
    expect(driftFor(0)).toBe(0);
    expect(driftFor(-1)).toBe(0);
    expect(driftFor(1)).toBeCloseTo(-0.05, 9);
    expect(driftFor(0.5, 0.06)).toBeCloseTo(-0.03, 9);
    expect(driftFor(3)).toBeCloseTo(-0.05, 9);
  });
  it('lamp off: over many runs as many electrons cross to the left as to the right', () => {
    let left = 0;
    let right = 0;
    for (const seed of SEEDS) {
      const { sim } = run(seed, 120, (s) => (s.drift = driftFor(0)));
      left += sim.gate.left;
      right += sim.gate.right;
    }
    expect(left + right).toBeGreaterThan(1500);
    expect(Math.abs(left - right) / (left + right)).toBeLessThan(0.03);
  });
  it('lamp on: a net flow to the left (small against the random traffic, as VISUAL §6 wants it)', () => {
    // 5 % of the speed is about 14 electrons a minute through this frame, under a random traffic of ± 13:
    // one run can hide it, six runs together cannot; three times the drift shows in every run
    let net = 0;
    for (const seed of SEEDS) {
      const { sim } = run(seed, 120, (s) => (s.drift = driftFor(1)));
      net += sim.gate.left - sim.gate.right;
    }
    expect(net).toBeGreaterThan(70);
    for (const seed of SEEDS) {
      const { sim } = run(seed, 120, (s) => (s.drift = driftFor(1, 0.15)));
      expect(sim.gate.left - sim.gate.right).toBeGreaterThan(20);
    }
  });
});

describe('the balance of the counter frame (`sim.gate.balance`)', () => {
  it('without it the two counts part like a random walk', () => {
    const worst = Math.max(...SEEDS.map((seed) => run(seed, 120, () => undefined).worst));
    expect(worst).toBeGreaterThan(6);
  });
  it('with it they never part by more than two, and by about one on average', () => {
    for (const seed of SEEDS) {
      const { worst, meanGap, sim } = run(seed, 120, (s) => (s.gate.balance = 1));
      expect(worst).toBeLessThanOrEqual(2);
      expect(meanGap).toBeLessThan(1.2);
      // it still is a busy frame: electrons keep crossing both ways
      expect(sim.gate.left).toBeGreaterThan(100);
      expect(sim.gate.right).toBeGreaterThan(100);
    }
  });
  it('steers no one visibly: few crossings are turned, and the crowd goes nowhere', () => {
    for (const seed of SEEDS) {
      const { sim } = run(seed, 120, (s) => (s.gate.balance = 1));
      const crossings = sim.gate.left + sim.gate.right;
      // a turn at the frame is one more of the random turns an electron makes about twice a second anyway
      expect(sim.gate.turned / (crossings + sim.gate.turned)).toBeLessThan(0.3);
      expect(sim.gate.turned / (120 * FOCUS_COUNT)).toBeLessThan(0.1); // per electron: under one in ten seconds
    }
  });
  it('a weaker balance holds the counts less tightly', () => {
    const weak = Math.max(...SEEDS.map((seed) => run(seed, 120, (s) => (s.gate.balance = 0.2)).worst));
    expect(weak).toBeGreaterThan(2);
    expect(weak).toBeLessThanOrEqual(5);
  });
});
