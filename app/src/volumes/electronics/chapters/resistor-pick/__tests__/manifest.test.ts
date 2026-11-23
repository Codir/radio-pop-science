import { describe, expect, it } from 'vitest';
import raw from '@electronics/content/generated/resistor-pick.json';
import meta from '@electronics/content/generated/resistor-pick.manifest.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';

const NBSP = String.fromCharCode(160);

describe('resistor-pick manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.axisValue).toBe(meta.axisValue);
  });
});

describe('resistor-pick captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  const all = [
    ['bands', 0, 'Глибина'],
    ['bands', 1, 'стенд'],
    ['bands', 2, 'резистор зблизька'],
    ['bands', 3, 'Смужка'],
    ['bands', 4, 'Колір'],
    ['bands', 5, 'Що означає'],
    ['bands', 6, 'перша цифра'],
    ['bands', 7, 'друга цифра'],
    ['bands', 8, 'скільки нулів'],
    ['bands', 9, 'точність'],
    ['bands', 10, 'помаранчева'],
    ['bands', 11, 'коричнева'],
    ['bands', 12, 'золота'],
    ['series', 0, 'Номінал'],
    ['series', 1, 'Допуск'],
    ['series', 2, 'від'],
    ['series', 3, 'до'],
    ['calc', 0, 'Мультиметр'],
    ['calc', 1, 'Резистор'],
    ['calc', 2, 'Світлодіод'],
    ['calc', 3, 'червоний'],
    ['calc', 4, 'Перемичка'],
    ['calc', 5, 'резистор для світлодіода: `R = (U − U_LED) / I`'],
    ['power', 0, 'Мультиметр'],
    ['power', 1, 'Напруга на резисторі'],
    ['power', 2, 'Потужність резистора, межа 0,25 W'],
    ['power', 3, 'Стан резистора'],
    ['power', 4, 'холодний'],
    ['power', 5, 'теплий'],
    ['power', 6, 'Резистор'],
    ['power', 7, 'Світлодіод'],
    ['power', 8, 'червоний'],
    ['power', 9, 'Перемичка'],
    ['power', 10, 'потужність: `P = U × I`'],
    ['burn', 0, 'Потужність резистора, межа 0,25 W'],
    ['burn', 1, 'Стан резистора'],
    ['burn', 2, 'холодний'],
    ['burn', 3, 'теплий'],
    ['burn', 4, 'гарячий'],
    ['burn', 5, 'згорів'],
    ['burn', 6, 'Резистор'],
    ['burn', 7, 'Перемичка'],
    ['burn', 8, 'Вимикач батарейки'],
    ['on', 0, 'Мультиметр'],
    ['on', 1, 'вимкнено'],
    ['on', 2, 'Показ'],
    ['on', 3, 'Червоний щуп'],
    ['on', 4, 'Чорний щуп'],
    ['on', 5, 'Резистор'],
    ['on', 6, 'Світлодіод'],
    ['on', 7, 'Деталь'],
    ['on', 8, 'світлодіод „увімкнено“'],
    ['on', 9, 'резистор 2,2 kΩ'],
  ] as const;

  it.each(all)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });

  it('pins every caption of every step: the scene uses them all', () => {
    for (const s of raw.steps) expect(all.filter(([id]) => id === s.id)).toHaveLength(s.labels.length);
  });

  it('throws for a caption the script does not have', () => {
    expect(() => caption('bands', 13)).toThrow(/no caption 13 in step 'bands'/);
  });
});
