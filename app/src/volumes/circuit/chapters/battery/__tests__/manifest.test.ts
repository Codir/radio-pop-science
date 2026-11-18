import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/battery.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

describe('battery manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('battery captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['poles', 0, 'забагато'],
    ['poles', 1, 'порівну'],
    ['poles', 2, 'бракує'],
    ['poles', 3, 'полюс'],
    ['inside', 0, 'Розріз'],
    ['inside', 1, 'цинк'],
    ['inside', 2, 'перегородка з пастою'],
    ['inside', 3, 'оксид мангану'],
    ['balance', 0, 'зайві електрони'],
    ['balance', 1, 'межа цинку'],
    ['voltage', 0, 'вимірювач'],
    ['voltage', 1, '1,6\u00a0V'],
    ['voltage', 2, 'напруга'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });

  it('the new terms appear at the takeaway', () => {
    const at = (step: string, text: string) =>
      raw.steps.find((s) => s.id === step)?.path.captions?.find((c) => c.text === text);
    expect(at('poles', 'полюс')?.at).toBe('takeaway');
    expect(at('voltage', 'напруга')?.at).toBe('takeaway');
  });
});
