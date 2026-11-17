import { describe, expect, it } from 'vitest';
import { BOARD, LOOP } from '@circuit/shared/stage';
import {
  DEPTH_MAX,
  FROM_X,
  K_MAX,
  SNAKE_POINTS,
  TO_X,
  currentOf,
  depthOf,
  radiiOf,
  snakePath,
  stretchOf,
} from '../parts/snake-path';

describe('the current of the stretched wire (script: I = 1,5 V : (5 Ω + 0,0072 Ω × k²))', () => {
  it.each([
    [1, '0.30'],
    [25, '0.16'],
    [40, '0.09'],
  ])('k = %i → %s A', (k, a) => expect(currentOf(k).toFixed(2)).toBe(a));
});

describe('the snake', () => {
  it('is the straight far wire at k = 1', () => {
    const path = snakePath(1);
    expect(path[0]!.x).toBeCloseTo(FROM_X, 6);
    expect(path.at(-1)!.x).toBeCloseTo(TO_X, 6);
    for (const p of path) expect(p.z).toBeCloseTo(LOOP.far, 6);
  });
  it('has the same number of points for every stretch', () => {
    for (const k of [1, 1.01, 2, 7.5, 25, 39.9, 40]) expect(snakePath(k).length).toBe(SNAKE_POINTS);
  });
  it('changes continuously with k (no fold pops in)', () => {
    let prev = snakePath(1).map((p) => p.clone());
    for (let k = 1.02; k <= K_MAX; k += 0.02) {
      const cur = snakePath(k);
      const step = Math.max(...cur.map((p, i) => p.distanceTo(prev[i]!)));
      expect(step).toBeLessThan(0.06);
      prev = cur.map((p) => p.clone());
    }
  });
  it('stays on the board, in front of the far line, clear of the battery and the switch', () => {
    for (const k of [2, 10, 25, 40]) {
      for (const p of snakePath(k)) {
        expect(p.z).toBeGreaterThanOrEqual(LOOP.far - 1e-6);
        expect(p.z).toBeLessThan(LOOP.near - 0.6);
        expect(Math.abs(p.x)).toBeLessThan(BOARD.width / 2 - 0.4);
      }
    }
  });
  it('gets thinner by the root of k and hangs deeper with k; the handle maps back exactly', () => {
    expect(radiiOf(4).core).toBeCloseTo(radiiOf(1).core / 2, 6);
    expect(depthOf(1)).toBe(0);
    expect(depthOf(K_MAX)).toBeCloseTo(DEPTH_MAX, 6);
    for (const k of [1, 3, 12.5, 25, 40]) expect(stretchOf(depthOf(k))).toBeCloseTo(k, 6);
  });
});
