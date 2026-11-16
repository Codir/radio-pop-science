import { describe, expect, it } from 'vitest';
import { defineVolume, type ChapterManifest } from '@/engine/api';
import { axisChipText, setWhere, whereFloor } from '../where';

const volume = defineVolume(
  {
    id: 'pilot',
    title: 'Пілот',
    subtitle: '',
    order: 1,
    accent: 'amber',
    status: 'published',
    axis: {
      label: 'Поверх',
      unit: '',
      floors: [
        { id: 'rows', label: 'ряди атомів', value: 1, plain: 'ряди кульок', namedAt: 'wire/atoms' },
        { id: 'stand', label: 'стенд', value: 3 },
      ],
    },
    groups: [{ id: 'path', label: 'Шлях' }],
    journey: [{ id: 'wire', group: 'path' }],
  },
  {
    journey: {
      axis: { min: 0, max: 3, origin: 0, tick: 1, majorEvery: 1, format: String, ascending: 'out' },
    },
    theme: { sky: 'day', mood: 'diorama' },
  },
);
const wire = { volume: 'pilot', id: 'wire', axisLabel: 'стенд' } as ChapterManifest;

describe('«де ми» in the header chip', () => {
  it('shows the chapter floor, then the reported one by the name the reader may see', () => {
    expect(axisChipText(wire, volume, {})).toBe('стенд');
    setWhere('pilot/wire', 'rows');
    expect(whereFloor('pilot/wire')).toBe('rows');
    expect(axisChipText(wire, volume, {})).toBe('ряди кульок');
    expect(axisChipText(wire, volume, { 'pilot/wire': ['atoms'] })).toBe('ряди атомів');
    setWhere('pilot/other', null); // another chapter's end does not clear this one's report
    expect(whereFloor('pilot/wire')).toBe('rows');
    setWhere('pilot/wire', null);
    expect(axisChipText(wire, volume, {})).toBe('стенд');
  });

  it('keeps the axis label of a volume without named floors', () => {
    expect(axisChipText({ ...wire, axisLabel: '10⁻¹⁰ m' }, undefined, {})).toBe('10⁻¹⁰ m');
  });
});
