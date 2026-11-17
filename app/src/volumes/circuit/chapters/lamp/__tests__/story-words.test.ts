import { describe, expect, it } from 'vitest';
import { caption } from '../content';
import { sayMoment } from '../parts/story-words';
import { secondsAt } from '../parts/story-path';

const say = (s: number): string => sayMoment(s, (i) => caption('story', i)).replace(/ /g, ' ');

describe('story read-out', () => {
  it.each([
    [0, '0'],
    [0.4e-9, '0,4 мільярдних секунди'],
    [1e-9, '1 мільярдна секунди'],
    [3.4e-9, '3 мільярдні секунди'],
    [63e-9, '50 мільярдних секунди'],
    [1e-6, '1 мільйонна секунди'],
    [2.2e-6, '2 мільйонні секунди'],
    [280e-6, '200 мільйонних секунди'],
    [1e-3, '1 тисячна секунди'],
    [4e-3, '3 тисячні секунди'],
    [12e-3, '10 тисячних секунди'],
    [25e-3, '2 соті секунди'],
    [60e-3, '5 сотих секунди'],
    [0.1, '1 десята секунди'],
  ] as const)('%f s → «%s»', (s, text) => {
    expect(say(s)).toBe(text);
  });

  it('never goes back while the time grows (no flicker)', () => {
    let last = -1;
    for (let x = 0; x <= 1; x += 0.001) {
      const s = secondsAt(x);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});
