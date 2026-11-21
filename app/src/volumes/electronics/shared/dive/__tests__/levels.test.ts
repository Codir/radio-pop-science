/**
 * The floors of the bench's dive (`levels.ts`), copied in its shape with `circuit/shared/world/__tests__/levels.test.ts`
 * (shared/README.md, «Копії»): the volume's floor ids, where on the rail each one begins — the ladder shows `part` from
 * 0.5 and `inside` from 1 (VISUAL §7) — and how long a flight takes, with and without reduced motion; a rail travelling
 * for that long arrives on time.
 */
import { describe, expect, it } from 'vitest';
import volume from '../../../volume.json';
import { FLIGHT, FLOORS, FLOOR_FROM, flightSeconds, floorAt } from '../levels';
import { LENS_LEG, createDiveRail } from '../rail-math';

/** The rail position of a value of the depth slider (0 … 1 + LENS_LEG). */
const rail = (slider: number): number => slider - LENS_LEG;

describe('floors of the dive', () => {
  it('are the floors of the volume’s axis, from the top', () => {
    const axis = [...volume.axis.floors].sort((a, b) => b.value - a.value).map((f) => f.id);
    expect(FLOORS).toEqual(axis);
  });

  it('give stand, part, inside and atoms along the rail: `part` from 0.5, `inside` from 1 (VISUAL §7)', () => {
    expect(floorAt(-LENS_LEG)).toBe('stand');
    expect(floorAt(0)).toBe('stand');
    expect(floorAt(0.49)).toBe('stand');
    expect(floorAt(0.5)).toBe('part');
    expect(floorAt(0.99)).toBe('part');
    expect(floorAt(1)).toBe('inside');
    expect(floorAt(1.99)).toBe('inside');
    expect(floorAt(2)).toBe('atoms');
    expect(new Set([-0.4, 0.7, 1.4, 2.1].map(floorAt))).toEqual(new Set(FLOORS));
    expect(FLOOR_FROM).toEqual({ part: 0.5, inside: 1, atoms: 2 });
  });

  it('on the depth slider (0 … 1 + LENS_LEG): `part` from 1, `inside` at its end', () => {
    expect(floorAt(rail(0))).toBe('stand');
    expect(floorAt(rail(0.995))).toBe('stand');
    expect(floorAt(rail(1))).toBe('part');
    expect(floorAt(rail(1.495))).toBe('part');
    expect(floorAt(rail(1 + LENS_LEG))).toBe('inside');
  });
});

describe('flight time', () => {
  const whole = 1 + LENS_LEG;

  it('the whole way takes 1.6–2.2 s, with reduced motion 0.6 s (VISUAL §7)', () => {
    expect(flightSeconds(whole, false)).toBeGreaterThanOrEqual(1.6);
    expect(flightSeconds(whole, false)).toBeLessThanOrEqual(2.2);
    expect(flightSeconds(whole, true)).toBeCloseTo(0.6, 9);
    expect(flightSeconds(-whole, false)).toBe(flightSeconds(whole, false));
  });

  it('a shorter way takes less, never under its least, and reduced motion is always shorter', () => {
    let last = 0;
    for (let span = 0; span <= whole + 1e-9; span += 0.05) {
      const s = flightSeconds(span, false);
      const r = flightSeconds(span, true);
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s).toBeGreaterThanOrEqual(FLIGHT.least);
      expect(r).toBeGreaterThanOrEqual(FLIGHT.leastReduced);
      expect(r).toBeLessThan(s);
      last = s;
    }
  });

  it('a rail travelling for that long arrives on time', () => {
    for (const reduced of [false, true]) {
      const r = createDiveRail([{ position: [0, 3, 3], target: [0, 0, 0] }, { position: [0, 1, 1], target: [0, 0, 0] }], {
        position: [0, 10, 12],
        target: [0, 1, 1],
      });
      r.set(r.min);
      const seconds = flightSeconds(1 - r.min, reduced);
      r.travelTo(1, seconds);
      let t = 0;
      while (r.moving && t < 5) {
        r.step(1 / 60);
        t += 1 / 60;
      }
      expect(r.position).toBe(1);
      expect(t).toBeCloseTo(seconds, 1);
    }
  });
});
