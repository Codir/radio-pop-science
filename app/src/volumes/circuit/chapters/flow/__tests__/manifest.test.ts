import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/flow.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';
import { PER_SECOND, countAt, grouped } from '../parts/count-display';

const NBSP = String.fromCharCode(160);

describe('flow manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('flow captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['connect', 0, 'кінець дроту'],
    ['connect', 2, 'струм'],
    ['count', 0, 'рамка-лічильник'],
    ['count', 1, 'за 1 с'],
    ['same', 0, 'перед лампочкою'],
    ['same', 1, 'після лампочки'],
    ['loop', 0, 'друге гніздо'],
    ['loop', 1, 'перемичка'],
    ['loop', 2, 'електричне коло'],
    ['pump', 0, 'насос'],
    ['pump', 1, 'кран'],
    ['pump', 2, 'коліщатко'],
    ['snail', 0, 'Час'],
    ['snail', 7, 'равлик'],
    ['snail', 8, 'позначений електрон'],
    ['together', 0, 'біля мінуса'],
    ['together', 2, 'біля лампочки'],
    ['push', 0, 'Час'],
    ['push', 3, 'поштовх поля'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });
});

describe('the counter frame', () => {
  it('counts 0.3 A for one second exactly, digits in groups of three', () => {
    expect(countAt(0)).toBe(0n);
    expect(countAt(1)).toBe(PER_SECOND);
    expect(grouped(countAt(1)).split(NBSP).join(' ')).toBe('1 872 000 000 000 000 000');
    // the script's number is 0.3 × 6.241 509 × 10¹⁸, rounded as the script prints it
    expect(Number(PER_SECOND) / 6.241509074e18).toBeCloseTo(0.3, 3);
  });
  it('runs up monotonically within the second', () => {
    let last = -1n;
    for (let t = 0; t <= 1.0001; t += 1 / 60) {
      const n = countAt(t);
      expect(n >= last).toBe(true);
      last = n;
    }
  });
});
