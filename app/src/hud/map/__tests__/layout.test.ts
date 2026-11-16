import { describe, expect, it } from 'vitest';
import { defineVolume, floorLabel, type ChapterManifest, type VolumeIdentity } from '@/engine/api';
import { journeyFromManifests, journeyRemaining } from '../../journey';
import { layoutJourney, pathPoint } from '../layout';

const identity: VolumeIdentity = {
  id: 'pilot',
  title: 'Пілот',
  subtitle: 'Перевірка карти',
  order: 1,
  accent: 'amber',
  status: 'published',
  format: 'path',
  axis: {
    label: 'Поверх',
    unit: '',
    floors: [
      { id: 'atom', label: 'один атом', value: 0 },
      { id: 'table', label: 'стіл', value: 3 },
    ],
  },
  groups: [
    { id: 'prologue', label: 'Пролог', layer: 'prologue' },
    { id: 'path', label: 'Шлях', layer: 'path' },
    { id: 'side', label: 'Гілки', layer: 'branch' },
  ],
  journey: [
    { id: 'intro', group: 'prologue', title: 'Що сталося?', minutes: 4, floor: 'table' },
    { id: 'wire', group: 'path', title: 'З чого дріт?', minutes: 10, floor: 'atom' },
    { id: 'lamp', group: 'path', title: 'Чому світить?', minutes: 11, floor: 'table' },
    { id: 'more', group: 'side', title: 'А далі?', minutes: 8, floor: 'table' },
  ],
};
const axis = { min: 0, max: 3, origin: 0, tick: 1, majorEvery: 1, format: String, ascending: 'out' as const };
const volume = defineVolume(identity, { journey: { axis }, theme: { sky: 'day', mood: 'diorama' } });

/** The fields of a chapter manifest the journey reads. */
const built = (id: string, group: string, steps: string[], axisValue = 1): ChapterManifest =>
  ({
    volume: volume.id,
    id,
    title: `Глава ${id}`,
    group,
    axisLabel: 'деталь',
    axisValue,
    theme: { accent: 'cyan' },
    steps: steps.map((s) => ({ id: s, title: s, blurb: '' })),
  }) as unknown as ChapterManifest;

describe('journey map with planned chapters', () => {
  it('works with 0, 1 and 2 built chapters', () => {
    for (const manifests of [
      [],
      [built('wire', 'path', ['a', 'b'])],
      [built('wire', 'path', ['a']), built('lamp', 'path', ['c'])],
    ]) {
      const journey = journeyFromManifests(volume, manifests);
      expect(journey.chapters.map((c) => c.id)).toEqual(['intro', 'wire', 'lamp', 'more']);
      expect(journey.built).toBe(manifests.length);
      const layout = layoutJourney(journey);
      expect(layout.spine).toHaveLength(4);
      for (const u of [-1, 0, 0.5, 2.7, 9]) expect(Number.isFinite(pathPoint(layout, u).y)).toBe(true);
    }
    const planned = journeyFromManifests(volume, []).get('intro')!;
    expect(planned).toMatchObject({
      real: false,
      axisLabel: 'стіл',
      axisValue: 3,
      minutes: 4,
      layer: 'prologue',
    });
  });

  it('lays out a journey of one chapter and of none', () => {
    const solo = defineVolume(
      { ...identity, format: undefined, journey: [{ id: 'wire', group: 'path' }] },
      {
        journey: { axis },
        theme: { sky: 'day', mood: 'diorama' },
      },
    );
    const one = layoutJourney(journeyFromManifests(solo, [built('wire', 'path', ['a'], 2)]));
    expect(one.spine).toHaveLength(1);
    expect(pathPoint(one, 0.4)).toEqual({ x: one.spine[0]!.x, y: one.spine[0]!.y, z: one.spine[0]!.z });
    const none = layoutJourney(
      journeyFromManifests({ ...solo, journey: { ...solo.journey, planned: [] } }, []),
    );
    expect(none.spine).toHaveLength(0);
    expect(pathPoint(none, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('labels the ruler with the named floors', () => {
    const ticks = layoutJourney(journeyFromManifests(volume, [])).ticks;
    expect(ticks.map(({ value, major, label }) => ({ value, major, label }))).toEqual([
      { value: 0, major: true, label: 'один атом' },
      { value: 3, major: true, label: 'стіл' },
    ]);
  });

  it('names a floor plainly until the step that introduces its word', () => {
    const v = defineVolume(
      {
        ...identity,
        axis: {
          ...identity.axis,
          floors: [{ id: 'atom', label: 'один атом', value: 0, plain: 'одна кулька', namedAt: 'wire/a' }],
        },
        journey: [],
      },
      { journey: { axis }, theme: { sky: 'day', mood: 'diorama' } },
    );
    const floor = v.journey.axis.floors[0]!;
    expect(floorLabel(v, floor, {})).toBe('одна кулька');
    expect(floorLabel(v, floor, { 'pilot/wire': ['a'] })).toBe('один атом');
    expect(layoutJourney(journeyFromManifests(v, [])).ticks[0]!.label).toBe('одна кулька');
    expect(() =>
      defineVolume(
        { ...identity, axis: { ...identity.axis, floors: [{ id: 'x', label: 'x', value: 0, plain: 'y' }] } },
        { journey: { axis }, theme: { sky: 'day', mood: 'diorama' } },
      ),
    ).toThrow(/plain/);
  });

  it('counts the chapters and minutes left (branches are optional)', () => {
    const journey = journeyFromManifests(volume, [built('wire', 'path', ['a', 'b'])]);
    expect(journeyRemaining({}, journey)).toEqual({ chapters: 3, total: 3, minutes: 25, totalMinutes: 25 });
    expect(journeyRemaining({ 'pilot/wire': ['a'] }, journey)).toEqual({
      chapters: 3,
      total: 3,
      minutes: 20,
      totalMinutes: 25,
    });
    expect(journeyRemaining({ 'pilot/wire': ['a', 'b'] }, journey)).toEqual({
      chapters: 2,
      total: 3,
      minutes: 15,
      totalMinutes: 25,
    });
  });
});
