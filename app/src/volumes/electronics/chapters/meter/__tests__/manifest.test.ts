import { describe, expect, it } from 'vitest';
import raw from '@electronics/content/generated/meter.json';
import meta from '@electronics/content/generated/meter.manifest.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

const NBSP = String.fromCharCode(160);

describe('meter manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.axisValue).toBe(meta.axisValue);
  });
});

describe('meter captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['volts', 0, 'Мультиметр'],
    ['volts', 1, 'вимкнено'],
    ['volts', 2, 'Показ'],
    ['volts', 3, 'Червоний щуп'],
    ['volts', 4, 'Чорний щуп'],
    ['amps', 0, 'Мультиметр'],
    ['amps', 1, 'Показ'],
    ['amps', 2, 'Червоний щуп'],
    ['amps', 3, 'Чорний щуп'],
    ['amps', 4, 'Перемичка'],
    ['amps', 5, 'Нові деталі'],
    ['flat', 0, 'Осцилограф'],
    ['flat', 1, 'Щуп осцилографа'],
    ['flat', 2, 'напруга, V'],
    ['flat', 3, 'час, s'],
    ['flat', 4, 'на поділку'],
    ['flat', 5, 'Вимикач батарейки'],
    ['flat', 6, 'постійна напруга'],
    ['wave', 0, 'Плеєр'],
    ['wave', 1, 'Осцилограф'],
    ['wave', 2, 'Щуп осцилографа'],
    ['wave', 3, 'напруга, V'],
    ['wave', 4, 'час, ms'],
    ['wave', 5, 'на поділку'],
    ['wave', 6, 'Мультиметр'],
    ['wave', 7, 'змінна напруга'],
    ['notes', 0, 'Осцилограф'],
    ['notes', 1, 'Щуп осцилографа'],
    ['notes', 2, 'напруга, V'],
    ['notes', 3, 'час, ms'],
    ['notes', 4, 'на поділку'],
    ['notes', 5, 'Час на поділку'],
    ['notes', 6, 'частота'],
    ['twice', 0, 'Гучність'],
    ['twice', 1, 'тихо'],
    ['twice', 2, 'гучно'],
    ['twice', 3, 'Масштаб першого щупа'],
    ['twice', 4, 'Вершина на вході'],
    ['twice', 5, 'Вершина на динаміку'],
    ['twice', 6, 'Осцилограф'],
    ['twice', 7, 'Перший щуп'],
    ['twice', 8, 'Другий щуп'],
    ['twice', 9, 'напруга, V'],
    ['twice', 10, 'час, ms'],
    ['twice', 11, 'на поділку'],
    ['twice', 12, 'вхід підсилювача'],
    ['twice', 13, 'динамік'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });

  it('throws for a caption the script does not have', () => {
    expect(() => caption('volts', 5)).toThrow(/no caption 5 in step 'volts'/);
  });
});
