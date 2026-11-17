import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/drain.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

describe('drain manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('drain captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['hours', 0, 'Години'],
    ['hours', 1, '0 год'],
    ['hours', 2, '8 год'],
    ['hours', 3, 'вимірювач'],
    ['hours', 4, 'рамка-лічильник'],
    ['spent', 0, 'Години'],
    ['spent', 3, 'цинк'],
    ['spent', 4, 'оксид мангану'],
    ['ghost', 0, 'вимірювач'],
    ['ghost', 1, 'вимикач'],
    ['inner', 0, 'лічильник ударів'],
    ['inner', 1, 'частинки пасти'],
    ['inner', 2, 'наліт'],
    ['life', 0, 'нова батарейка'],
    ['life', 1, 'сіла батарейка'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });
});
