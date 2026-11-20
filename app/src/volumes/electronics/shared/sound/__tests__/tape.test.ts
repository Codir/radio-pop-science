import { describe, expect, it } from 'vitest';
import { Tape } from '../tape';

const ramp = (first: number, n: number): Float32Array =>
  Float32Array.from({ length: n }, (_, k) => first + k);

describe('the tape of a scope', () => {
  it('reads the samples before a given one, across blocks and around the ring', () => {
    const tape = new Tape(10);
    tape.write(0, ramp(0, 4));
    tape.write(4, ramp(4, 4));
    tape.write(8, ramp(8, 4)); // the ring turns: 0 and 1 are gone
    expect(tape.end).toBe(12);
    const out = new Float32Array(5);
    expect(tape.read(12, out)).toBe(5);
    expect(Array.from(out)).toEqual([7, 8, 9, 10, 11]);
    expect(tape.read(6, out)).toBe(4);
    expect(Array.from(out)).toEqual([NaN, 2, 3, 4, 5]); // sample 1 is no longer on the tape
    expect(tape.read(14, out)).toBe(3);
    expect(Array.from(out)).toEqual([9, 10, 11, NaN, NaN]); // 12 and 13 are not written yet
  });

  it('a block longer than the tape keeps its last samples', () => {
    const tape = new Tape(4);
    tape.write(100, ramp(100, 10));
    const out = new Float32Array(4);
    expect(tape.read(110, out)).toBe(4);
    expect(Array.from(out)).toEqual([106, 107, 108, 109]);
  });

  it('a block that does not follow the last starts the tape afresh', () => {
    const tape = new Tape(8);
    tape.write(0, ramp(0, 4));
    tape.write(20, ramp(20, 2));
    const out = new Float32Array(4);
    expect(tape.read(22, out)).toBe(2);
    expect(Array.from(out)).toEqual([NaN, NaN, 20, 21]);
    expect(() => new Tape(0)).toThrow(RangeError);
  });
});
