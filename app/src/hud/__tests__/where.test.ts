import { describe, expect, it } from 'vitest';
import { defineVolume, type ChapterManifest } from '@/engine/api';
import { axisChipText, setWhere, setWhereBase, whereFloor } from '../where';

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
    journey: [
      { id: 'wire', group: 'path' },
      { id: 'lamp', group: 'path' },
    ],
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

  it('names the floor once the reader is past the naming step: a later chapter or a later step (deep links)', () => {
    setWhere('pilot/wire', 'rows');
    expect(axisChipText(wire, volume, { 'pilot/lamp': ['inside'] })).toBe('ряди атомів');
    const steps = [
      { id: 'atoms', title: '', blurb: '' },
      { id: 'outer', title: '', blurb: '' },
    ] as unknown as ChapterManifest['steps'];
    expect(axisChipText({ ...wire, steps }, volume, { 'pilot/wire': ['outer'] })).toBe('ряди атомів');
    expect(axisChipText({ ...wire, steps }, volume, {})).toBe('ряди кульок');
    setWhere('pilot/wire', null);
  });

  it('falls back to the floor the world reports, not the chapter’s own, when no ladder reports', () => {
    const lamp = { ...wire, id: 'lamp', axisLabel: 'ряди атомів' } as ChapterManifest;
    expect(axisChipText(lamp, volume, {})).toBe('ряди кульок');
    setWhereBase('pilot/lamp', 'stand');
    expect(whereFloor('pilot/lamp')).toBe(null);
    expect(axisChipText(lamp, volume, {})).toBe('стенд');
    setWhere('pilot/lamp', 'rows');
    expect(axisChipText(lamp, volume, {})).toBe('ряди кульок');
    setWhere('pilot/lamp', null);
    setWhereBase('pilot/lamp', null);
  });

  it('keeps the axis label of a volume without named floors', () => {
    expect(axisChipText({ ...wire, axisLabel: '10⁻¹⁰ m' }, undefined, {})).toBe('10⁻¹⁰ m');
  });
});
