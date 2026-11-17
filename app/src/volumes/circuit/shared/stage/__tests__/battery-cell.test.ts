import { describe, expect, it } from 'vitest';
import {
  LIFE_STATES,
  followVoltage,
  hoursAt,
  internalOhms,
  lifeAtHours,
  lifeHours,
  lifeState,
  loadCurrent,
  loadVoltage,
  meterVoltage,
  openVoltage,
} from '../battery-cell';

describe('the numbers of the stand battery (VISUAL §5.8, PATH drain/*)', () => {
  it('fresh: ≈1.5–1.6 V open, ≈1.5 V under the lamp, ≈0.3 A, 0.15–0.3 Ω', () => {
    expect(openVoltage(0)).toBeGreaterThan(1.5);
    expect(openVoltage(0)).toBeLessThan(1.62);
    expect(loadVoltage(0)).toBeGreaterThan(1.45);
    expect(loadCurrent(0)).toBeGreaterThan(0.28);
    expect(loadCurrent(0)).toBeLessThan(0.33);
    expect(internalOhms(0)).toBeGreaterThanOrEqual(0.15);
    expect(internalOhms(0)).toBeLessThanOrEqual(0.3);
  });

  it('tired: about 1.1 V under the lamp', () => {
    expect(loadVoltage(LIFE_STATES.tired)).toBeGreaterThan(1.05);
    expect(loadVoltage(LIFE_STATES.tired)).toBeLessThan(1.18);
  });

  it('dead: ≈1.2 V open, well below 1 V under load, resistance many times the fresh one', () => {
    expect(openVoltage(1)).toBeCloseTo(1.2, 2);
    expect(loadVoltage(1)).toBeLessThan(0.85);
    expect(internalOhms(1) / internalOhms(0)).toBeGreaterThan(10);
  });

  it('dead under the lamp: about 0.1 A — the filament only just glows dull red (drain/hours)', () => {
    expect(loadCurrent(1)).toBeGreaterThan(0.095);
    expect(loadCurrent(1)).toBeLessThan(0.115);
    expect(loadVoltage(1)).toBeLessThan(0.6);
  });

  it('everything falls monotonically with life', () => {
    for (let i = 1; i <= 100; i++) {
      const a = (i - 1) / 100;
      const b = i / 100;
      expect(openVoltage(b)).toBeLessThan(openVoltage(a));
      expect(loadVoltage(b)).toBeLessThan(loadVoltage(a));
      expect(loadCurrent(b)).toBeLessThan(loadCurrent(a));
      expect(internalOhms(b)).toBeGreaterThan(internalOhms(a));
    }
  });

  it('Ohm and Kirchhoff hold: U = I·R_load and U₀ = I·(R + r)', () => {
    for (const q of [0, 0.3, 0.7, 1]) {
      expect(loadVoltage(q)).toBeCloseTo(loadCurrent(q) * 5, 9);
      expect(openVoltage(q)).toBeCloseTo(loadCurrent(q) * (5 + internalOhms(q)), 9);
    }
    expect(loadVoltage(0.5, Infinity)).toBe(openVoltage(0.5));
  });

  it('the meter blends open circuit into load with the switch', () => {
    expect(meterVoltage(0.5, 0)).toBe(openVoltage(0.5));
    expect(meterVoltage(0.5, 1)).toBeCloseTo(loadVoltage(0.5), 9);
  });

  it('the lamp lights about eight hours; hours and life invert each other', () => {
    expect(lifeHours()).toBeGreaterThan(7.8);
    expect(lifeHours()).toBeLessThan(8.2);
    expect(hoursAt(0)).toBe(0);
    for (const q of [0.1, 0.4, 0.75, 0.95]) expect(lifeAtHours(hoursAt(q))).toBeCloseTo(q, 4);
    expect(lifeAtHours(-1)).toBe(0);
    expect(lifeAtHours(100)).toBe(1);
  });

  it('names the four states', () => {
    for (const [name, q] of Object.entries(LIFE_STATES)) expect(lifeState(q)).toBe(name);
  });

  it('the needle falls fast under load and creeps back slowly (drain/ghost)', () => {
    let v = 1.2;
    for (let i = 0; i < 30; i++) v = followVoltage(v, 0.7, 1 / 60); // 0.5 s
    expect(v).toBeLessThan(0.72);
    let w = 0.7;
    for (let i = 0; i < 60; i++) w = followVoltage(w, 1.2, 1 / 60); // 1 s
    expect(w).toBeLessThan(1.1);
    for (let i = 0; i < 120; i++) w = followVoltage(w, 1.2, 1 / 60); // 3 s in all
    expect(w).toBeGreaterThan(1.18);
  });
});
