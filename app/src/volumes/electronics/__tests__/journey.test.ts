// The planned journey of the volume (docs/superpowers/specs/2026-11-20-electronics-volume-design.md §8.1, §9):
// entries, groups and the ruler come from the manifest; the raw volume.json is read only to show that `seamless`
// is absent (the manifest fills in a default for it) and that `status` is `draft`. The library config and the
// identities of the default and the legacy volume are read as files: a volume never imports another volume.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '@/ui3d';
import volume from '../volume';
import identity from '../volume.json';

const TABLE: readonly (readonly [
  id: string,
  group: string,
  parent: string | null,
  minutes: number,
  floor: string,
])[] = [
  ['prologue', 'prologue', null, 5, 'stand'],
  ['meter', 'tools', null, 9, 'stand'],
  ['resistor', 'resistor', null, 10, 'inside'],
  ['sensors', 'branches', 'resistor', 8, 'part'],
  ['resistor-pick', 'resistor', null, 11, 'part'],
  ['smd', 'branches', 'resistor-pick', 7, 'part'],
  ['divider', 'resistor', null, 9, 'stand'],
  ['capacitor', 'capacitor', null, 10, 'inside'],
  ['capacitor-kinds', 'capacitor', null, 10, 'part'],
  ['filter', 'capacitor', null, 11, 'stand'],
  ['diode', 'diode', null, 9, 'atoms'],
  ['rectifier', 'branches', 'diode', 9, 'stand'],
  ['led', 'diode', null, 9, 'inside'],
  ['transistor', 'transistor', null, 10, 'inside'],
  ['blinker', 'branches', 'transistor', 9, 'stand'],
  ['mosfet', 'branches', 'transistor', 8, 'inside'],
  ['amplifier', 'transistor', null, 12, 'stand'],
  ['build', 'practicum', null, 12, 'stand'],
  ['lab', 'practicum', null, 15, 'stand'],
];
const planned = volume.journey.planned;
const layerOf = (group: string) => volume.journey.groups.find((g) => g.id === group)!.layer;
const main = planned.filter((c) => layerOf(c.group) !== 'branch');
const minutes = (entries: typeof planned) => entries.reduce((sum, c) => sum + c.minutes!, 0);

const VOLUMES = new URL('../../', import.meta.url); // …/src/volumes/
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, VOLUMES), 'utf8')) as T;

describe('electronics: the planned journey', () => {
  it('19 entries in the planned order', () =>
    expect(planned.map((c) => c.id)).toEqual(TABLE.map((r) => r[0])));

  it('group, parent, minutes and floor of every entry', () =>
    expect(planned.map((c) => [c.id, c.group, c.parent ?? null, c.minutes, c.floor])).toEqual(TABLE));

  it('14 entries outside the branches (11 path chapters, 142 minutes); 5 branches, 41 minutes', () => {
    expect(main).toHaveLength(14);
    expect(planned.filter((c) => layerOf(c.group) === 'path')).toHaveLength(11);
    expect(minutes(main)).toBe(142);
    expect(minutes(planned.filter((c) => layerOf(c.group) === 'branch'))).toBe(41);
  });

  it('every entry has positive minutes and a floor of the ruler', () => {
    const floors = volume.journey.axis.floors.map((f) => f.id);
    for (const c of planned) {
      expect(c.minutes).toBeGreaterThan(0);
      expect(floors).toContain(c.floor);
    }
  });

  it('a branch stands right after its parent (behind its earlier siblings only); a parent is not a branch', () => {
    for (const [i, c] of planned.entries()) {
      if (layerOf(c.group) !== 'branch') {
        expect(c.parent).toBeUndefined();
        continue;
      }
      const at = planned.findIndex((p) => p.id === c.parent);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(i);
      expect(layerOf(planned[at]!.group)).not.toBe('branch');
      // between the parent and the branch there are only other branches of the same parent
      for (const between of planned.slice(at + 1, i)) expect(between.parent).toBe(c.parent);
    }
  });

  it('eight groups in the planned order, with their labels and layers', () =>
    expect(volume.journey.groups.map((g) => [g.id, g.label, g.layer])).toEqual([
      ['prologue', 'Пролог', 'prologue'],
      ['tools', 'Прилади', 'path'],
      ['resistor', 'Резистор', 'path'],
      ['capacitor', 'Конденсатор', 'path'],
      ['diode', 'Діод', 'path'],
      ['transistor', 'Транзистор', 'path'],
      ['practicum', 'Практикум', 'practicum'],
      ['branches', 'Гілки', 'branch'],
    ]));

  it('the ruler: four floors 0…3, from the atoms to the stand; going up zooms out', () => {
    const { axis } = volume.journey;
    expect(axis.floors.map((f) => [f.id, f.label, f.value])).toEqual([
      ['atoms', 'атоми', 0],
      ['inside', 'усередині деталі', 1],
      ['part', 'деталь', 2],
      ['stand', 'стенд', 3],
    ]);
    expect([axis.min, axis.max, axis.origin, axis.tick, axis.majorEvery, axis.ascending]).toEqual([
      0,
      3,
      0,
      1,
      1,
      'out',
    ]);
    expect([0, 1, 2, 3].map((v) => axis.format(v))).toEqual(['атоми', 'усередині деталі', 'деталь', 'стенд']);
    expect([axis.label, axis.unit, axis.hint, axis.range]).toEqual([
      'Поверх',
      '',
      'Де ми: від стенда до атомів деталі',
      'атоми … стенд',
    ]);
  });

  it('titles: a question everywhere but the practicum; no U+0027 and no U+00B5', () => {
    for (const c of planned) {
      expect(c.title!.endsWith('?')).toBe(layerOf(c.group) !== 'practicum');
      expect(c.title).not.toMatch(/['\u00b5]/);
    }
  });

  it('a draft with the lobby line, an emblem the library can draw and the dark studio; no seamless', () => {
    expect([identity.status, 'seamless' in identity]).toEqual(['draft', false]);
    expect([
      volume.id,
      volume.title,
      volume.subtitle,
      volume.headline,
      volume.emptyNote,
      volume.accent,
      volume.order,
      volume.format,
      volume.seamless,
    ]).toEqual([
      'electronics',
      'Радіоелектроніка',
      'Від резистора до підсилювача',
      'Радіоелектроніка',
      'Перші глави — в роботі',
      'teal',
      3,
      'path',
      false,
    ]);
    // the library falls back to `book` for a name it does not know, so the emblem must be one of its icons
    expect(volume.emblem).toBe('chart');
    expect(ICON_NAMES).toContain(volume.emblem);
    expect(volume.theme).toEqual({ sky: 'studio', mood: 'studio', accent: 'teal' });
    expect(volume.glossary).toEqual({ scope: 'volume' });
  });

  it('the volume id is not a chapter id of the default or the legacy volume (`#/a/b` would read as volume/chapter)', () => {
    const library = json<{ defaultVolume: string; legacyVolume?: string }>('library.json');
    const front = [library.defaultVolume, library.legacyVolume ?? library.defaultVolume];
    expect(front).not.toContain(volume.id);
    for (const id of front) {
      const chapters = json<{ journey: { id: string }[] }>(`${id}/volume.json`).journey.map((c) => c.id);
      expect(chapters.length).toBeGreaterThan(0);
      expect(chapters).not.toContain(volume.id);
    }
  });
});
