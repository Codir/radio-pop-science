import { describe, expect, it } from 'vitest';
import raw from '@electronics/content/generated/resistor.json';
import meta from '@electronics/content/generated/resistor.manifest.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

const NBSP = String.fromCharCode(160);

describe('resistor manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.axisValue).toBe(meta.axisValue);
  });
});

describe('resistor captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['flash', 0, 'Світлодіод'],
    ['flash', 1, 'червоний'],
    ['flash', 2, 'Перемичка'],
    ['flash', 3, 'Вимикач батарейки'],
    ['limit', 0, 'Резистор'],
    ['limit', 1, 'Світлодіод'],
    ['limit', 2, 'Перемичка'],
    ['limit', 3, 'Вимикач батарейки'],
    ['ohm', 0, 'Мультиметр'],
    ['ohm', 1, 'вимкнено'],
    ['ohm', 2, 'Показ'],
    ['ohm', 3, 'Червоний щуп'],
    ['ohm', 4, 'Чорний щуп'],
    ['ohm', 5, 'Резистор'],
    ['ohm', 6, 'Світлодіод'],
    ['ohm', 7, 'Перемичка'],
    ['inside', 0, 'Глибина'],
    ['inside', 1, 'стенд'],
    ['inside', 2, 'усередині резистора'],
    ['inside', 3, 'Резистор'],
    ['inside', 4, 'вугільна плівка'],
    ['inside', 5, 'канавка'],
    ['inside', 6, 'керамічний стрижень'],
    ['law', 0, 'Мультиметр'],
    ['law', 1, 'Резистор'],
    ['law', 2, 'Перемичка'],
    ['law', 3, 'закон Ома: `I = U / R`'],
    ['share', 0, 'Мультиметр'],
    ['share', 1, 'вимкнено'],
    ['share', 2, 'Показ'],
    ['share', 3, 'Червоний щуп'],
    ['share', 4, 'Чорний щуп'],
    ['share', 5, 'світлодіод'],
    ['share', 6, 'резистор'],
    ['share', 7, 'батарейка'],
    ['amp', 0, 'Мультиметр'],
    ['amp', 1, 'Показ'],
    ['amp', 2, 'Червоний щуп'],
    ['amp', 3, 'Чорний щуп'],
    ['amp', 4, 'Перемичка'],
    ['amp', 5, 'Резистор'],
    ['amp', 6, 'Світлодіод'],
    ['amp', 7, 'Деталь'],
    ['amp', 8, 'резистор 2,2 kΩ'],
    ['amp', 9, 'Нові деталі'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });

  it('throws for a caption the script does not have', () => {
    expect(() => caption('flash', 4)).toThrow(/no caption 4 in step 'flash'/);
  });
});
