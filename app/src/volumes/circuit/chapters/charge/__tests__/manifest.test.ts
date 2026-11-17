import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/charge.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

describe('charge manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('charge captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['rub', 0, 'кулька'],
    ['rub', 1, 'волосся'],
    ['rub', 2, 'друга кулька'],
    ['charge', 0, 'гума'],
    ['charge', 1, 'волосся'],
    ['charge', 2, 'перейшло електронів'],
    ['charge', 3, 'заряджена кулька'],
    ['charge', 4, 'заряджене волосся'],
    ['charge', 5, 'мільярдів'],
    ['signs', 0, '−'],
    ['signs', 1, '+'],
    ['signs', 2, 'негативний заряд'],
    ['signs', 3, 'позитивний заряд'],
    ['neutral', 0, '+29'],
    ['neutral', 1, '−29'],
    ['neutral', 2, 'разом'],
    ['neutral', 3, 'нейтральний'],
    ['field', 0, 'пробник'],
    ['field', 1, 'заряджена кулька'],
    ['field', 2, 'електричне поле'],
    ['shift', 0, 'заряджена кулька'],
    ['shift', 1, 'шматочок дроту'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i)).toBe(text);
  });
});
