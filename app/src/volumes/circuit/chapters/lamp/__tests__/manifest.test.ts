import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/lamp.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

describe('lamp manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('lamp captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['inside', 0, 'Глибина'],
    ['inside', 1, 'стенд'],
    ['inside', 2, 'усередині лампочки'],
    ['inside', 3, 'нижній контакт'],
    ['inside', 4, 'тримач'],
    ['inside', 5, 'різьба'],
    ['inside', 6, 'нитка розжарення'],
    ['hot-spot', 0, 'теплова лупа'],
    ['hot-spot', 1, 'холодне'],
    ['hot-spot', 2, 'гаряче'],
    ['glow', 0, 'Розжарення'],
    ['glow', 1, '0 с'],
    ['glow', 2, '0,1 с'],
    ['glow', 3, 'температура нитки'],
    ['energy', 0, 'цинк'],
    ['energy', 1, 'оксид мангану'],
    ['energy', 2, 'вимикач'],
    ['handover', 0, 'позначений електрон'],
    ['handover', 1, 'шлях енергії'],
    ['story', 0, 'Час'],
    ['story', 1, '0'],
    ['story', 5, '1 десята секунди'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });
});
