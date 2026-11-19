/**
 * How many frames of the model `step` computes per second in Node, with the whole band: the camera, the air with
 * its noise and the receiver, frame after frame on the test frame. Not part of `pnpm test`: the name of this file
 * does not end in `.test.ts`. Run it with `pnpm exec vitest bench src/volumes/radio/sim --run --reporter verbose`.
 */
import { describe, expect, it } from 'vitest';
import { createFmLink, DEFAULT_STATE } from '../fm-link';
import { FRAME } from './helpers';

describe('швидкість моделі', () => {
  it('step з усім діапазоном', { timeout: 60_000 }, async ({ bench }) => {
    const link = createFmLink(1);
    const state = structuredClone(DEFAULT_STATE);
    for (let i = 0; i < 5; i++) link.step(state, FRAME); // warm-up
    const result = await bench('fm-link step', () => {
      link.step(state, FRAME);
    }).run({ time: 3000 });
    expect(result.throughput.mean).toBeGreaterThanOrEqual(16); // ≤ 62.5 ms per frame: room under the gate modelMs ≤ 100
  });
});
