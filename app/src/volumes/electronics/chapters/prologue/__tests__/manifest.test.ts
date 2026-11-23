import { describe, expect, it } from 'vitest';
import raw from '@electronics/content/generated/prologue.json';
import meta from '@electronics/content/generated/prologue.manifest.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

const NBSP = String.fromCharCode(160);
const SOUND_OFF = 'Звук вимкнено: торкніться стенда або ввімкніть кнопку „Звук“';

describe('prologue manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.axisValue).toBe(meta.axisValue);
  });
});

describe('prologue captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['quiet', 0, 'Плеєр'],
    ['quiet', 1, 'Динамік'],
    ['quiet', 2, 'Хвиля на динаміку'],
    ['quiet', 3, SOUND_OFF],
    ['loud', 0, 'Вимикач батарейки'],
    ['loud', 1, 'Гучність'],
    ['loud', 2, 'тихо'],
    ['loud', 3, 'гучно'],
    ['loud', 4, 'Хвиля на динаміку'],
    ['loud', 5, SOUND_OFF],
    ['loud', 6, 'підсилювач'],
    ['stand', 0, 'Деталь'],
    ['stand', 1, 'Лампочка „увімкнено“'],
    ['stand', 2, 'Хвиля на динаміку'],
    ['stand', 3, SOUND_OFF],
    ['riddle', 0, 'Прилад з екраном'],
    ['riddle', 1, 'Щуп'],
    ['riddle', 2, 'батарейка'],
    ['riddle', 3, 'плеєр'],
    ['riddle', 4, 'динамік'],
    ['map', 0, 'Мапа тому'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });

  it('throws for a caption the script does not have', () => {
    expect(() => caption('map', 1)).toThrow(/no caption 1 in step 'map'/);
  });
});
