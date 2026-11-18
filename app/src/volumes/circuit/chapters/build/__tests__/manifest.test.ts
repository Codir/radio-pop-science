import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/build.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';
import { amps } from '../steps/03-short';
import { cameraAt, moonAt } from '../steps/04-flashlight';

describe('build manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('build captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['first-light', 0, 'затискач'],
    ['first-light', 1, 'вимикач'],
    ['first-light', 2, 'лампочка'],
    ['find-fault', 0, 'полагоджено: 0 з 3'],
    ['find-fault', 1, 'полагоджено: 3 з 3'],
    ['short', 0, 'рамка-лічильник'],
    ['short', 1, 'теплова лупа'],
    ['short', 2, 'коротке замикання'],
    ['flashlight', 0, 'Скласти'],
    ['flashlight', 1, 'стенд'],
    ['flashlight', 2, 'ліхтарик'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });
  it('the closing card has the four lines of «Що ми тепер знаємо»', () => {
    expect(raw.path.now).toHaveLength(4);
  });
});

describe('build numbers', () => {
  it('the frame reads the lamp’s 0,3 A and a short’s ≈ 6 A', () => {
    expect(amps(0.3)).toBe('0,3 A');
    expect(amps(6)).toBe('≈ 6 A');
    expect(amps(0)).toBe('0 A');
  });
  it('the fold ends on the flashlight shot with the moon gone, and starts on the stand', () => {
    expect(cameraAt(0)).toBe(0);
    expect(cameraAt(1)).toBe(1);
    expect(moonAt(1)).toBe(1);
    expect(moonAt(0)).toBe(0);
    for (let f = 0; f < 1; f += 0.01) expect(cameraAt(f + 0.01)).toBeGreaterThanOrEqual(cameraAt(f));
  });
});
