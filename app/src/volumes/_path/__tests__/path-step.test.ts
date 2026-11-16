import { describe, expect, it } from 'vitest';
import { defineContent } from '@/content';
import type { ChapterManifest } from '@/engine/api';
import raw from '../content/generated/_sandbox-flow.json';
import { hintsDue, isPathContent, pathStepModel } from '@/hud/model/path-step';

const content = defineContent(raw);
const manifest = {
  id: raw.id,
  steps: raw.steps.map((s) => ({ id: s.id, title: s.title, blurb: '' })),
} as unknown as ChapterManifest;

describe('path step model', () => {
  it('reads the main text, its term links and the parts of the step', () => {
    expect(isPathContent(content)).toBe(true);
    const m = pathStepModel(manifest, content, 'drift')!;
    expect(m.counter).toBe('Крок 1 / 2');
    expect(m.paragraphs.join(' ')).toContain('**електричним струмом**');
    expect(m.terms).toEqual([
      {
        text: 'електричним струмом',
        name: 'електричний струм',
        definition: 'Спільний рух електронів в один бік.',
      },
    ]);
    expect(m.action).toMatch(/^Приєднайте/);
    expect(m.honesty).toEqual(['не в масштабі', 'сповільнено ×1000']);
    expect(m.opening?.know).toMatch(/провідник/);
    expect(m.closing).toBeNull();
  });

  it('closes the chapter on its last step, with the next question', () => {
    const m = pathStepModel(manifest, content, 'same')!;
    expect(m.opening).toBeNull();
    expect(m.closing?.now).toHaveLength(3);
    expect(m.closing?.next).toEqual({ id: 'glow', title: 'Чому лампа світиться?' });
    expect(m.recall[0]?.target).toBe('_path/_sandbox-path/core');
  });

  it('is null for a classic chapter or an unknown step', () => {
    expect(pathStepModel(manifest, { id: 'x', steps: [] }, 'drift')).toBeNull();
    expect(pathStepModel(manifest, content, 'nope')).toBeNull();
  });

  it('times the hints for a stuck reader', () => {
    expect([0, 14.9, 15, 39, 40, 99].map((t) => hintsDue(['a', 'b'], t))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(hintsDue(['a'], 60)).toBe(1);
    expect(hintsDue([], 60)).toBe(0);
  });
});
