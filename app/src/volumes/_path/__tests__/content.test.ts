import { describe, expect, it } from 'vitest';
import { buildGlossary, defineContent } from '@/content';
import flowRaw from '../content/generated/_sandbox-flow.json';
import meta from '../content/generated/_sandbox-path.manifest.json';
import pathRaw from '../content/generated/_sandbox-path.json';

describe('generated content of the path sandbox (docs/PATH_FORMAT.md)', () => {
  const chapter = defineContent(pathRaw);
  const flow = defineContent(flowRaw);

  it('keeps the path parts of the chapter and its steps', () => {
    expect(chapter.path?.layer).toBe('path');
    expect(chapter.path?.now).toHaveLength(3);
    expect(chapter.path?.next).toEqual({ id: '_sandbox-flow', title: 'Що тече в дроті?' });
    const core = chapter.steps[0]!;
    expect(core.path?.action).toMatch(/^Торкніться/);
    expect(core.path?.more.length).toBe(2);
    expect(core.path?.hints).toHaveLength(2);
    expect(core.labels).toEqual(['Торкнутися міддю', 'Торкнутися пластиком', 'мідна жила', 'провідник']);
    expect(core.path?.captions?.[3]).toEqual({ text: 'провідник', at: 'takeaway' });
    // the term is marked in the main text and linked to its card
    const mark = core.path!.marks[0]!;
    expect(core.panel[0]).toContain(`**${mark.text}**`);
    expect(core.terms?.map((t) => t.name)).toContain(mark.term);
  });

  it('points «Згадайте» to a full step address', () => {
    expect(flow.steps[1]!.path?.recall).toEqual([
      { target: '_path/_sandbox-path/core', title: 'Мідна жила' },
    ]);
  });

  it('feeds the glossary: path terms with their step, «Докладніше» words as chapter cards', () => {
    const records = buildGlossary([chapter, flow]);
    const conductor = records.find((r) => r.name === 'провідник')!;
    expect(conductor).toMatchObject({ chapterId: '_sandbox-path', stepId: 'core' });
    expect(records.find((r) => r.name === 'срібло')).toMatchObject({
      chapterId: '_sandbox-path',
      stepId: null,
    });
  });

  it('gives the manifest the floor of the chapter', () => {
    expect(meta).toMatchObject({ axisLabel: 'деталь', axisValue: 2, minutes: 4, layer: 'path' });
  });
});
