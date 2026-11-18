import { describe, expect, it } from 'vitest';
import { filterGlossary, type GlossaryRecord } from '@/content';
import type { VolumeManifest } from '@/engine/api';
import type { Journey, JourneyChapter } from '../../journey';
import { glossaryLetters } from '../glossary';
import { focusRecord, prepareGlossary, searchGlossary } from '../glossary-search';
import { mapCard, mapSummary, stopName } from '../map';
import { QuizRun } from '../quiz';

const rec = (
  uk: string,
  intl: string,
  chapter: string,
  extra: Partial<GlossaryRecord> = {},
): GlossaryRecord => ({
  international: intl,
  ukrainian: uk,
  definition: `${uk} — визначення`,
  volumeId: 'v',
  chapterId: chapter,
  stepId: null,
  alsoIn: [],
  ...extra,
});
const records = [
  rec('атом', 'atom', 'a'),
  rec('ґратка', 'lattice', 'a', { alsoIn: ['v/b'] }),
  rec('напруга', 'voltage', 'b', { symbol: 'U', unit: 'V' }),
  rec('їжак', 'hedgehog', 'c'),
  rec('', 'LED', 'c'),
];

describe('glossary search', () => {
  const p = prepareGlossary(records);
  const same = (f: Parameters<typeof filterGlossary>[1]): void =>
    expect(searchGlossary(p, f).map((i) => records[i])).toEqual(filterGlossary(records, f));
  it('matches filterGlossary for queries, letters, chapters and volumes', () => {
    for (const query of ['', 'а', 'АТ', 'v', 'u', 'lat', '  гр ', 'zzz']) same({ query });
    same({ letter: 'Ґ' });
    same({ letter: '#' });
    same({ chapters: new Set(['v/b']) });
    same({ volume: 'v', query: 'а' });
    same({ volume: 'w' });
  });
  it('finds the record a term link names', () => {
    expect(focusRecord(p, 'Напруга')).toBe(2);
    expect(focusRecord(p, 'lattice')).toBe(1);
    expect(focusRecord(p, 'нема')).toBe(-1);
  });
  it('lists the index letters in use, Latin last', () => {
    expect(glossaryLetters(records)).toEqual(['А', 'Ґ', 'Ї', 'Н', '#']);
    expect(glossaryLetters(null)).toHaveLength(34);
  });
});

describe('quiz run', () => {
  const items = [
    { question: 'Q1', options: ['a', 'b'], correct: 1 },
    { question: 'Q2', options: ['a', 'b', 'c'], correct: 0 },
  ];
  it('takes the first pick only, counts the score and ends with the result', () => {
    const q = new QuizRun(items);
    expect(q.nextLabel).toBe('Далі');
    expect(q.answer(0)).toBe(false);
    expect(q.answer(1)).toBeNull();
    q.next();
    expect(q.nextLabel).toBe('Результат');
    expect(q.answer(0)).toBe(true);
    q.next();
    expect(q.done).toBe(true);
    expect(q.result.headline).toBe('Результат: **1 з 2**');
    q.restart();
    expect([q.at, q.score, q.picked]).toEqual([0, 0, null]);
  });
});

const volume = {
  id: 'c',
  format: 'path',
  seamless: false,
  journey: {
    groups: [{ id: 'path', label: 'Шлях' }],
    axis: { floors: [{ id: 'f', label: 'атом', plain: 'кулька', namedAt: 'one/s2' }] },
  },
} as unknown as VolumeManifest;
const ch = (id: string, layer: JourneyChapter['layer'], real: boolean, minutes: number): JourneyChapter => ({
  volume: 'c',
  id,
  title: `${id}?`,
  group: layer,
  parent: null,
  axisLabel: 'атом',
  axisValue: 0,
  accent: 'cyan',
  steps: real
    ? [
        { id: 's1', title: 'S1' },
        { id: 's2', title: 'S2' },
      ]
    : [],
  real,
  layer,
  minutes,
});
const chapters = [ch('pro', 'prologue', true, 4), ch('one', 'path', true, 10), ch('two', 'path', false, 6)];
const journey = { volume, chapters, built: 2 } as unknown as Journey;

describe('map chrome model', () => {
  it('tells a planned journey in chapters and minutes', () => {
    const s = mapSummary(journey, { 'c/pro': ['s1', 's2'] });
    expect(s.text).toBe('Пройдено 1 з 3 глави · лишилося ≈ 16 хв');
    expect(s.label).toBe('20%');
  });
  it('names stops and plans, the floor plain until its word is introduced', () => {
    expect(chapters.map((c) => stopName(journey, c))).toEqual(['Пролог', 'Глава 1', 'Глава 2']);
    const planned = mapCard(journey, chapters[2]!, {}, null);
    expect(planned).toMatchObject({ action: null, note: 'Ця глава ще готується.', floor: 'кулька' });
    expect(planned.facts).toEqual(['≈ 6 хв', 'у планах']);
    const built = mapCard(journey, chapters[1]!, { 'c/one': ['s1', 's2'] }, 's2');
    expect(built).toMatchObject({
      floor: 'атом',
      done: 2,
      action: { step: 's2', label: 'Повернутися до кроку' },
    });
    expect(mapCard(journey, chapters[1]!, {}, null).action).toEqual({ step: 's1', label: 'Почати главу' });
  });
});
