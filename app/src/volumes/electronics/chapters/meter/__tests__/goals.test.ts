/**
 * The chapter's own goal maths (`parts/goals.ts` `waveVerdict`, `steps/03-flat.ts` `newest`): the wave's verdict waits
 * for its window, breaks on a quiet stretch or at the screen's edge and is done after its seconds, and the newest
 * points of a roll are those of the last frame. The tally, the run in a row and the scope's words are the shared
 * steps' (`shared/steps/__tests__`).
 */
import { describe, expect, it } from 'vitest';
import { waveVerdict } from '../parts/goals';
import { newest } from '../steps/03-flat';

describe('the wave’s verdict', () => {
  const rules = { need: 3, window: 2, crest: 0.2, edge: 0.35 };
  it('waits for its window, needs the crest in every window after it, never the edge, and is done after its seconds', () => {
    expect(waveVerdict(1, null, 0.1, rules)).toBe('go');
    expect(waveVerdict(2, 0.25, 0.28, rules)).toBe('go');
    expect(waveVerdict(2.5, 0.15, 0.28, rules)).toBe('broke');
    expect(waveVerdict(1, 0.2, 0.36, rules)).toBe('broke');
    expect(waveVerdict(3, 0.25, 0.29, rules)).toBe('done');
    expect(waveVerdict(3, null, 0.29, rules)).toBe('broke');
  });
});

describe('the newest points of a roll', () => {
  it('are those within the last seconds before its right edge; none when nothing is drawn', () => {
    const x = Float64Array.from([-4, -2, -0.05, -0.04, -0.01, 0]);
    const v = Float32Array.from([0, 1, 8.97, 8.99, 8.98, 8.981]);
    expect(newest(6, x, v, 1 / 30)).toEqual([Math.fround(8.98), Math.fround(8.981)]);
    expect(newest(6, x, v, 0.06)).toEqual([Math.fround(8.97), Math.fround(8.99)]);
    expect(newest(0, x, v, 1)).toBeNull();
  });
});
