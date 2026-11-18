// The planned journey of the volume (docs/superpowers/specs/2026-11-17-radio-volume-design.md II §1, §3, §4):
// entries, groups and the ruler come from the manifest; the raw volume.json is read only to show that `seamless`
// and `emblem` are absent (the manifest fills in defaults for them) and that `status` is `draft`.
import { describe, expect, it } from 'vitest';
import volume from '../volume';
import identity from '../volume.json';

const TABLE: readonly (readonly [id: string, group: string, parent: string | null, minutes: number, floor: string])[] = [
  ['prologue', 'prologue', null, 5, 'road'],
  ['field', 'basics', null, 8, 'basics'],
  ['current', 'basics', null, 8, 'basics'],
  ['wave', 'basics', null, 9, 'basics'],
  ['antenna-size', 'engineering', 'wave', 8, 'basics'],
  ['lines', 'picture', null, 10, 'camera'],
  ['carrier', 'picture', null, 9, 'transmitter'],
  ['air', 'picture', null, 9, 'air'],
  ['select', 'picture', null, 7, 'receiver'],
  ['tank', 'engineering', 'select', 10, 'receiver'],
  ['cable', 'engineering', 'select', 8, 'receiver'],
  ['shift', 'picture', null, 10, 'receiver'],
  ['synth', 'engineering', 'shift', 10, 'receiver'],
  ['slope', 'picture', null, 7, 'receiver'],
  ['budget', 'engineering', 'slope', 11, 'receiver'],
  ['arrow', 'picture', null, 8, 'receiver'],
  ['angle', 'picture', null, 7, 'receiver'],
  ['fm-depth', 'engineering', 'angle', 10, 'receiver'],
  ['sdr', 'engineering', 'angle', 10, 'receiver'],
  ['raster', 'picture', null, 9, 'screen'],
  ['tv', 'branches', 'raster', 13, 'screen'],
  ['lab-tube', 'labs', 'raster', 10, 'screen'],
  ['sat', 'branches', 'raster', 10, 'screen'],
  ['colour-sound', 'branches', 'raster', 11, 'screen'],
  ['build-analog', 'practicum-analog', null, 12, 'road'],
  ['lab-bench', 'labs', 'build-analog', 12, 'road'],
  ['compress', 'numbers', null, 10, 'camera'],
  ['packets', 'numbers', null, 7, 'transmitter'],
  ['points', 'numbers', null, 9, 'air'],
  ['codes', 'engineering', 'points', 10, 'air'],
  ['many', 'numbers', null, 7, 'receiver'],
  ['one-sum', 'engineering', 'many', 8, 'receiver'],
  ['cliff', 'numbers', null, 8, 'screen'],
  ['sat-digital', 'branches', 'cliff', 7, 'screen'],
  ['build-digital', 'practicum-digital', null, 10, 'road'],
  ['lab-digital', 'labs', 'build-digital', 12, 'road'],
  ['lab-yard', 'labs', 'build-digital', 9, 'road'],
];
const planned = volume.journey.planned;
const layerOf = (group: string) => volume.journey.groups.find((g) => g.id === group)!.layer;
const main = planned.filter((c) => layerOf(c.group) !== 'branch');

describe('radio: подорож тому', () => {
  it('37 записів у порядку договору', () => expect(planned.map((c) => c.id)).toEqual(TABLE.map((r) => r[0])));
  it('група, батько, хвилини й позначка кожного запису', () =>
    expect(planned.map((c) => [c.id, c.group, c.parent ?? null, c.minutes, c.floor])).toEqual(TABLE));
  it('20 записів поза гілками, 17 глав шляху, 169 хвилин', () => {
    expect(main).toHaveLength(20);
    expect(planned.filter((c) => layerOf(c.group) === 'path')).toHaveLength(17);
    expect(main.reduce((sum, c) => sum + c.minutes!, 0)).toBe(169);
  });
  it('гілка стоїть після батька, а батько — не гілка', () => {
    for (const [i, c] of planned.entries()) {
      if (layerOf(c.group) !== 'branch') {
        expect(c.parent).toBeUndefined();
        continue;
      }
      const at = planned.findIndex((p) => p.id === c.parent);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(i);
      expect(layerOf(planned[at]!.group)).not.toBe('branch');
    }
  });
  it('групи — дев’ять, у порядку договору', () =>
    expect(volume.journey.groups.map((g) => [g.id, g.label, g.layer])).toEqual([
      ['prologue', 'Пролог', 'prologue'],
      ['basics', 'Основи', 'path'],
      ['picture', 'Дорога картинки', 'path'],
      ['practicum-analog', 'Практикум', 'practicum'],
      ['numbers', 'Дорога чисел', 'path'],
      ['practicum-digital', 'Практикум', 'practicum'],
      ['branches', 'Гілки', 'branch'],
      ['engineering', 'Інженерні гілки', 'branch'],
      ['labs', 'Лабораторії', 'branch'],
    ]));
  it('лінійка: сім позначок зі значеннями 0…6', () => {
    const { axis } = volume.journey;
    expect(axis.floors.map((f) => [f.id, f.label, f.value])).toEqual([
      ['basics', 'основи', 0],
      ['camera', 'камера', 1],
      ['transmitter', 'передавач', 2],
      ['air', 'повітря', 3],
      ['receiver', 'приймач', 4],
      ['screen', 'екран', 5],
      ['road', 'уся дорога', 6],
    ]);
    expect([axis.min, axis.max, axis.origin, axis.format(0), axis.format(6)]).toEqual([
      0,
      6,
      0,
      'основи',
      'уся дорога',
    ]);
    expect([axis.label, axis.hint, axis.range]).toEqual([
      'Станція',
      'Де ми на дорозі картинки',
      'від камери до екрана',
    ]);
  });
  it('назви: питання всюди, крім практикумів; без U+0027 і U+00B5', () => {
    for (const c of planned) {
      expect(c.title!.endsWith('?')).toBe(layerOf(c.group) !== 'practicum');
      expect(c.title).not.toMatch(/['\u00b5]|^Практикум/);
    }
  });
  it('чернетка з рядком вестибюля; без seamless та emblem', () => {
    expect([identity.status, 'seamless' in identity, 'emblem' in identity]).toEqual(['draft', false, false]);
    expect([
      volume.title,
      volume.subtitle,
      volume.headline,
      volume.emptyNote,
      volume.accent,
      volume.order,
      volume.format,
    ]).toEqual(['Радіо', 'Від електрона до екрана', 'Радіо', 'Перші глави — в роботі', 'sky', 2, 'path']);
    expect(volume.theme).toEqual({ sky: 'dusk', mood: 'diorama', accent: 'sky' });
  });
});
