/**
 * The transistors in TO-92 (docs/volumes/electronics/VISUAL.md §4.7): for every key, the model's name printed on the
 * flat side and the lead in every leg — leg 0 the leftmost seen on the flat side with the legs down; the flat side
 * toward the reader (+z) at the orientation 0; the body's size. The lead of every leg is the board's own table
 * (`sim/board` `TO92_LEGS`, which `footprint.test.ts` holds against the catalog), so the board and the model never part.
 */
import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { BOARD_SPEC, TO92_LEGS } from '@electronics/sim/board';
import { LEG, MM, RADIAL_Y, TO92, TRANSISTORS, createTransistor } from '..';

/** VISUAL §4.7, the table, and the two output transistors of the amplifier (E1-6) the board's table also knows. */
const TABLE = {
  'transistor-bc547b': { print: 'BC547B', type: 'NPN', legs: ['collector', 'base', 'emitter'] },
  'transistor-bc557b': { print: 'BC557B', type: 'PNP', legs: ['collector', 'base', 'emitter'] },
  'transistor-2n3904': { print: '2N3904', type: 'NPN', legs: ['emitter', 'base', 'collector'] },
  'transistor-2n3906': { print: '2N3906', type: 'PNP', legs: ['emitter', 'base', 'collector'] },
  'transistor-bc337-25': { print: 'BC337-25', type: 'NPN', legs: ['collector', 'base', 'emitter'] },
  'transistor-bc327-25': { print: 'BC327-25', type: 'PNP', legs: ['collector', 'base', 'emitter'] },
} as const;

describe('the transistors in TO-92 (VISUAL §4.7)', () => {
  it('knows every transistor the board knows, and only those', () => {
    expect(Object.keys(TRANSISTORS).sort()).toEqual(Object.keys(TO92_LEGS).sort());
    expect(Object.keys(TABLE).sort()).toEqual(Object.keys(TO92_LEGS).sort());
  });

  it('prints the model on the flat side and carries the lead of the table in every leg', () => {
    for (const [key, want] of Object.entries(TABLE)) {
      expect(TRANSISTORS[key]?.print, key).toBe(want.print);
      expect(TRANSISTORS[key]?.type, key).toBe(want.type);
      const q = createTransistor(key);
      expect(q.print, key).toBe(want.print);
      expect(q.legNames, key).toEqual(want.legs);
      // leg 0 the leftmost, then 1 and 2 to the right (+x), one pitch apart
      expect(
        q.nominal.map((t) => t.x),
        key,
      ).toEqual([0, BOARD_SPEC.pitch, 2 * BOARD_SPEC.pitch]);
    }
  });

  it('turns its flat side to the reader (+z) at the orientation 0: a half cylinder 0.52 × 0.42 × 0.52 from 0.3 up', () => {
    const q = createTransistor('transistor-bc547b');
    const pos = (q.case.geometry as BufferGeometry).getAttribute('position');
    const all: Vector3[] = [];
    for (let i = 0; i < pos.count; i++) all.push(new Vector3().fromBufferAttribute(pos, i));
    const box = new Box3().setFromPoints(all);
    expect(box.max.x - box.min.x).toBeCloseTo(0.52, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(0.42, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(0.52, 3);
    expect(box.min.y).toBeCloseTo(0.3, 6);
    // the front is flat: a wide plane of vertices at the largest z; the back is round
    const front = all.filter((v) => v.z > box.max.z - 1e-6);
    const back = all.filter((v) => v.z < box.min.z + 1e-6);
    const width = (vs: Vector3[]) => Math.max(...vs.map((v) => v.x)) - Math.min(...vs.map((v) => v.x));
    expect(width(front)).toBeGreaterThan(0.3);
    expect(width(back)).toBeLessThan(0.05);
    // the print lies on the flat side
    expect(q.printAt.z).toBeGreaterThan(box.max.z - 1e-6);
  });

  it('brings every leg out from under the case: above the case’s bottom each leg is inside its outline', () => {
    const q = createTransistor('transistor-bc547b');
    // the legs and the case are both in the body frame (the legs' mesh has no transform of its own)
    expect(q.legs.parent).toBe(q.bodyGroup);
    expect(q.legs.matrix.equals(new Matrix4())).toBe(true);
    // the outline seen from above: a circle of the width, its centre behind the flat side so the case is `depth` deep
    const r = TO92.width / 2;
    const cz = TO92.front - (TO92.depth - r);
    const pos = (q.legs.geometry as BufferGeometry).getAttribute('position');
    const inside: Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new Vector3().fromBufferAttribute(pos, i);
      if (v.y < RADIAL_Y) continue;
      inside.push(v);
      expect(
        Math.hypot(v.x, v.z - cz),
        `(${v.x.toFixed(3)}; ${v.y.toFixed(3)}; ${v.z.toFixed(3)})`,
      ).toBeLessThan(r);
      expect(v.z).toBeLessThan(TO92.front);
    }
    // all three legs reach into the case, at the real lead pitch of a TO-92 (1.27 mm, three times over)
    for (const x of [-1.27 * MM, 0, 1.27 * MM]) {
      expect(
        inside.some((v) => Math.abs(v.x - x) < LEG.radius + 1e-6),
        `a leg rises into the case at x ${x.toFixed(3)}`,
      ).toBe(true);
    }
  });

  it('has no model for a key it does not know', () => {
    expect(() => createTransistor('transistor-unknown')).toThrow(RangeError);
  });
});
