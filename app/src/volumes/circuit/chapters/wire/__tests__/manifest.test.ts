import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/wire.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

describe('wire manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('wire captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['atoms', 5, 'атом'],
    ['inside-atom', 0, 'Розсунути атом'],
    ['inside-atom', 1, 'ядро'],
    ['inside-atom', 2, 'електрони'],
    ['inside-atom', 3, 'ядро збільшено'],
    ['outer', 0, 'ближній електрон'],
    ['outer', 1, 'зовнішній електрон'],
    ['shared', 0, 'Додати атоми'],
    ['shared', 1, 'один атом'],
    ['shared', 4, 'шматочок міді'],
    ['shared', 5, 'вільні електрони'],
    ['restless', 0, 'позначений електрон'],
    ['restless', 1, 'ліворуч'],
    ['restless', 2, 'праворуч'],
    ['plastic', 0, 'мідь'],
    ['plastic', 1, 'пластик'],
    ['plastic', 2, 'провідник'],
    ['plastic', 3, 'ізолятор'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });

  it('captions that appear at the takeaway are marked so in the content', () => {
    const at = (step: string, text: string) =>
      raw.steps.find((s) => s.id === step)?.path.captions?.find((c) => c.text === text);
    for (const [step, text] of [
      ['atoms', 'атом'],
      ['inside-atom', 'ядро'],
      ['inside-atom', 'електрони'],
      ['shared', 'вільні електрони'],
      ['plastic', 'провідник'],
      ['plastic', 'ізолятор'],
    ] as const)
      expect(at(step, text)?.at, `${step}: ${text}`).toBe('takeaway');
  });
});
