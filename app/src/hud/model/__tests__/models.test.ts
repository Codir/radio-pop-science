import { describe, expect, it } from 'vitest';
import type { ChapterManifest, Library } from '@/engine/api';
import type { ChapterContent, StepContent } from '@/content';
import { stepAtLevel } from '@/content';
import type { Journey, JourneyChapter } from '../../journey';
import { headerModel, headerTitleMax } from '../header';
import { stepLinks, stepOf } from '../links';
import { factModel, stepSections } from '../sections';
import { stepModel } from '../step';
import { spineFamily, spinePick, spineRows } from '../spine';

const manifest = {
  volume: 'electricity',
  id: 'atom',
  group: 'micro',
  title: 'Атом',
  axisLabel: '10⁻¹⁰ m',
  steps: [
    { id: 'dive-in', title: 'Занурення', blurb: 'Опис 1' },
    { id: 'anatomy', title: 'Будова', blurb: '' },
    { id: 'end', title: 'Кінець', blurb: 'Опис 3' },
  ],
} as unknown as ChapterManifest;

const volume = {
  id: 'electricity',
  title: 'Електроенергія',
  journey: { groups: [{ id: 'micro', label: 'Мікросвіт' }], axis: { hint: 'Масштаб' } },
};
const other = { id: 'current', title: 'Струм', steps: [{ id: 'flow', title: 'Потік' }] };
const library = {
  get: (id: string) => (id === 'electricity' ? volume : undefined),
  registry: (id: string) =>
    id === 'electricity'
      ? { get: (c: string) => (c === 'current' ? other : undefined), parentOf: () => ({ title: 'Речовина' }) }
      : undefined,
} as unknown as Library;

describe('header model', () => {
  it('builds the path (volume only at the library level) and the axis hint', () => {
    const a = headerModel(manifest, library, false);
    expect(a.path).toBe('Мікросвіт · Речовина');
    expect(a.path.startsWith('Електроенергія')).toBe(false);
    expect(headerModel(manifest, library, true).path.startsWith('Електроенергія · ')).toBe(true);
    expect(a).toMatchObject({ title: 'Атом', axisLabel: '10⁻¹⁰ m', axisHint: 'Масштаб' });
  });
  it('limits the title width per layout', () => {
    expect(headerTitleMax('wide', 1920)).toBe(430);
    expect(headerTitleMax('narrow', 600)).toBe(252);
    expect(headerTitleMax('portrait', 2000)).toBe(360);
  });
});

describe('links model', () => {
  const content = {
    steps: [],
    crossReferences: [
      { where: 'крок 1', targets: ['current/flow', 'electricity/plant-x/a'], note: 'Струм; Ще не готово' },
      { where: '`anatomy`', targets: ['current/flow'] },
      { where: 'наприкінці', targets: ['current/flow', 'bad target'] },
    ],
  } as unknown as ChapterContent;
  it('assigns references to steps', () => {
    expect(stepOf(content.crossReferences![0]!, manifest)).toBe(0);
    expect(stepOf(content.crossReferences![1]!, manifest)).toBe(1);
    expect(stepOf(content.crossReferences![2]!, manifest)).toBe(-1);
  });
  it('builds live and inactive links with captions from the note', () => {
    const l = stepLinks(content, manifest, 0, library);
    expect(l.map((x) => [x.name, x.label, x.built])).toEqual([
      ['xref-current/flow', 'Струм', true],
      ['xref-electricity/plant-x/a', 'Ще не готово', false],
    ]);
    expect(l[0]!.to).toEqual({ chapter: 'electricity/current', stepId: 'flow' });
    expect(l[1]!.to).toBeNull();
    expect(l[1]!.tooltip).toBe('Цей розділ ще будується');
  });
  it('falls back to the target chapter title and puts unplaced references on the last step', () => {
    expect(stepLinks(content, manifest, 1, library)[0]!.label).toBe('Струм · Потік');
    expect(stepLinks(content, manifest, 2, library).map((x) => x.name)).toEqual(['xref-current/flow']);
  });
});

const step = {
  id: 'dive-in',
  title: 'Занурення',
  panel: ['Сторінка 1', 'Сторінка 2'],
  terms: [
    {
      international: 'Atom',
      ukrainian: 'атом',
      name: 'атом',
      definition: 'Найменша частинка.',
      symbol: 'A',
      unit: '—',
    },
  ],
  formulas: { items: ['E = mc^2', 'x'.repeat(40)] },
  facts: {
    items: [
      { text: 'Факт' },
      { text: '', table: { head: ['a', 'b', 'c', 'd', 'e'], rows: [['1', '2', '3', '4', '5']] } },
    ],
  },
  misconceptions: [
    { myth: '«Атом — кулька»', correction: 'Ні.' },
    { myth: null, correction: '' },
  ],
  simple: { panel: ['Просто'], words: [{ word: 'атом', text: 'Дуже мала частинка.' }], facts: ['Цікаво 1'] },
} as unknown as StepContent;

describe('sections model', () => {
  it('lists the detailed sections in order', () => {
    const s = stepSections(stepAtLevel(step, 'detailed'));
    expect(s.map((x) => [x.id, x.label])).toEqual([
      ['terms', 'Терміни · 1'],
      ['formulas', 'Формули · 2'],
      ['facts', 'Цифри і факти · 2'],
      ['myths', 'Хибне уявлення'],
    ]);
    const t = s[0]!.id === 'terms' ? s[0]!.terms[0]! : null;
    expect(t).toMatchObject({
      name: 'атом',
      kicker: 'Термін',
      body: '`A` — Найменша частинка.',
      glossary: true,
    });
    const f = s[1]!.id === 'formulas' ? s[1]!.formulas.map((x) => x.long) : null;
    expect(f).toEqual([false, true]);
    const m = s[3]!.id === 'myths' ? s[3]!.myths : null;
    expect(m).toEqual([{ title: '«Атом — кулька»', body: 'Ні.' }]);
  });
  it('shows words and «Цікаво» at the simple level, no formulas', () => {
    const s = stepSections(stepAtLevel(step, 'simple'));
    expect(s.map((x) => x.label)).toEqual(['Слова · 1', 'Цікаво · 1']);
    const t = s[0]!.id === 'terms' ? s[0]!.terms[0]! : null;
    expect(t).toMatchObject({ kicker: 'Слово', glossary: false, body: 'Дуже мала частинка.' });
  });
  it('turns wide tables into key–value cards', () => {
    expect(factModel({ text: '', table: { head: ['a', 'b'], rows: [['1', '2']], note: 'n' } })).toMatchObject(
      { kind: 'table', note: 'n' },
    );
    const wide = factModel({
      text: '',
      table: { head: ['a', 'b', 'c', 'd', 'e'], rows: [['1', '2', '3', '4']] },
    });
    expect(wide).toEqual({
      kind: 'cards',
      note: null,
      cards: [
        {
          title: '1',
          rows: [
            ['b', '2'],
            ['c', '3'],
            ['d', '4'],
            ['e', ''],
          ],
        },
      ],
    });
  });
});

describe('step model', () => {
  const content = {
    steps: [step],
    quiz: [{ question: 'q', options: ['a'], answer: 0 }],
  } as unknown as ChapterContent;
  it('gives counter, title, pages and the simple flag', () => {
    const d = stepModel(manifest, content, 'dive-in', 'detailed')!;
    expect(d).toMatchObject({
      index: 0,
      count: 3,
      counter: 'Крок 1 / 3',
      title: 'Занурення',
      hasSimple: true,
      quiz: false,
    });
    expect(d.pages).toEqual(['Сторінка 1', 'Сторінка 2']);
    expect(stepModel(manifest, content, 'dive-in', 'simple')!.pages).toEqual(['Просто']);
  });
  it('falls back to the blurb, marks pending copy and puts the quiz on the last step', () => {
    expect(stepModel(manifest, content, 'end', 'detailed')).toMatchObject({
      pages: ['Опис 3'],
      quiz: true,
      hasSimple: false,
    });
    expect(stepModel(manifest, null, 'anatomy', 'detailed')!.pending).toBe(true);
    expect(stepModel(manifest, content, 'nope', 'detailed')).toBeNull();
  });
});

describe('spine model', () => {
  const ch = (id: string, group: string, parent: string | null, real = true): JourneyChapter =>
    ({
      id,
      volume: 'electricity',
      title: id.toUpperCase(),
      group,
      parent,
      axisLabel: 'x',
      real,
    }) as unknown as JourneyChapter;
  const all = [
    ch('atom', 'a', null),
    ch('plants', 'b', null),
    ch('wind', 'b', 'plants'),
    ch('lab', 'c', null, false),
  ];
  const journey = {
    roots: all.filter((c) => !c.parent),
    childrenOf: (id: string) => all.filter((c) => c.parent === id),
    get: (id: string) => all.find((c) => c.id === id),
  } as unknown as Journey;
  it('groups rows and fans out families', () => {
    const rows = spineRows(journey);
    expect(rows.map((r) => [r.entry.name, r.gapBefore, r.kids.map((k) => k.name)])).toEqual([
      ['spine-atom', false, []],
      ['spine-plants', true, ['spine-wind']],
      ['spine-lab', true, []],
    ]);
    expect(rows[1]!.kids[0]!.small).toBe(true);
    expect(spineFamily(journey, 'wind')).toBe('plants');
    expect(spineFamily(journey, 'atom')).toBe('atom');
  });
  it('opens built chapters and announces the others', () => {
    expect(spinePick(all[0]!)).toEqual({ goto: 'electricity/atom' });
    expect(spinePick(all[3]!)).toEqual({ toast: '«LAB» ще будується.' });
  });
});
