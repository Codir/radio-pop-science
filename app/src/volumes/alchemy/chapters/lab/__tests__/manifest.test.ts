import { describe, expect, it } from 'vitest';
import raw from '@alchemy/content/generated/lab.json';
import { QUEST_IDS } from '@alchemy/sim/lab';
import { STEP_IDS } from '../chapter';
import manifest from '../index';
import { FLAT_LABELS, L } from '../labels';
import { SHOTS } from '../shots';

describe('lab manifest', () => {
  it('lists the steps of the document, in order', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual([...QUEST_IDS, 'free']);
    expect(manifest).toMatchObject({ id: 'lab', group: 'nucleus', title: raw.title, axisValue: -14 });
    for (const step of manifest.steps) expect(step.blurb.length).toBeGreaterThan(10);
  });

  it('has its own subtitle, not the title of the first step', () => {
    expect(manifest.subtitle).toBe('Одинадцять квестів і вільна лабораторія');
    expect(manifest.subtitle).not.toBe(raw.steps[0]?.title);
  });
});

describe('lab labels', () => {
  it('takes the document captions from the export', () => {
    const exported = new Set(raw.steps.flatMap((s) => s.labels ?? []));
    for (const text of [
      L.tools.fire,
      L.tools.gammaN,
      L.tools.gammaP,
      L.tools.wait,
      L.tools.restart,
      L.tools.neutral,
      L.fission.heavy,
      L.fission.light,
      L.chart.full,
      L.free.newStart,
      L.free.take,
      L.free.cancel,
      L.free.startHere,
    ])
      expect(exported.has(text), text).toBe(true);
    for (const [key, text] of Object.entries(FLAT_LABELS)) expect(text.trim(), key).not.toBe('');
  });
});

describe('lab camera shots', () => {
  it('declares the subject bounds on every shot', () => {
    for (const [name, shot] of Object.entries(SHOTS)) expect(shot.fit, name).toBeDefined();
  });
});
