import { describe, expect, it } from 'vitest';
import { fnv1a, meanOf } from '../hash';

describe('fnv1a and meanOf (copied from the radio world)', () => {
  it('hashes as FNV-1a 32 bits, eight hex digits', () => {
    expect(fnv1a(new Uint8Array())).toBe('811c9dc5');
    expect(fnv1a(new TextEncoder().encode('a'))).toBe('e40c292c');
    expect(fnv1a(new TextEncoder().encode('foobar'))).toBe('bf9cf968');
  });

  it('means any numbers, 0 for none', () => {
    expect(meanOf(new Uint8Array([0, 255]))).toBe(127.5);
    expect(meanOf(new Float32Array([0.5, -1.5, 4]))).toBe(1);
    expect(meanOf([])).toBe(0);
  });
});
