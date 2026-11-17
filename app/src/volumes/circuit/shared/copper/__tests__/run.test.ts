import { describe, expect, it } from 'vitest';
import { accelerate, steerInward } from '../run';
import { WORKING_HEAT, trembleHeat } from '../joule';

describe('the run of the marked electron in the field', () => {
  it('speeds up toward −X and bends its path that way', () => {
    const pos = new Float32Array([0, 0, 0]);
    const dir = new Float32Array([0, 1, 0]);
    let v = 5;
    for (let i = 0; i < 30; i++) v = accelerate(pos, dir, 0, v, 9, 1 / 60, 100);
    expect(v).toBeGreaterThan(5);
    expect(dir[0]).toBeLessThan(-0.3);
    expect(pos[0]).toBeLessThan(0);
    expect(Math.hypot(dir[0]!, dir[1]!, dir[2]!)).toBeCloseTo(1, 5);
  });
  it('never runs faster than its top', () => {
    const pos = new Float32Array([0, 0, 0]);
    const dir = new Float32Array([-1, 0, 0]);
    let v = 5;
    for (let i = 0; i < 600; i++) v = accelerate(pos, dir, 0, v, 9, 1 / 60, 12);
    expect(v).toBeLessThanOrEqual(12);
  });
  it('turns back toward the middle after a hit near the edge only', () => {
    const pos = new Float32Array([-5, 0, 0]);
    const dir = new Float32Array([-1, 0, 0]);
    steerInward(pos, dir, 0, { x: 0, y: 0 }, [6.4, 3.5]);
    expect(dir[0]).toBe(1);
    pos[0] = -1;
    dir[0] = -1;
    steerInward(pos, dir, 0, { x: 0, y: 0 }, [6.4, 3.5]);
    expect(dir[0]).toBe(-1);
  });
});

describe('the trembling for a current (Joule – Lenz)', () => {
  it('is none without current, the working heat at 0.3 A, four times the share at twice the current', () => {
    expect(trembleHeat(0)).toBe(0);
    expect(trembleHeat(0.3)).toBeCloseTo(WORKING_HEAT, 6);
    expect(trembleHeat(0.15)).toBeCloseTo(WORKING_HEAT / 4, 6);
    expect(trembleHeat(3)).toBe(1);
  });
});
