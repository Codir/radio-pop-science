import { describe, expect, it } from 'vitest';
import type { Position } from '@/engine/api';
import { RecallTrail, type RecallNav } from '../recall';

function fakeNav(start: string): RecallNav & { opened: string[] } {
  const at = (a: string): Position => {
    const [volumeId, chapterId, stepId] = a.split('/') as [string, string, string];
    return { volumeId, chapterId, stepId };
  };
  const nav = {
    position: at(start) as Position | null,
    opened: [] as string[],
    open(a: string): Promise<boolean> {
      if (a.includes('missing')) return Promise.resolve(false);
      nav.opened.push(a);
      nav.position = at(a);
      return Promise.resolve(true);
    },
  };
  return nav;
}

describe('RecallTrail («Згадайте…» and back)', () => {
  it('follows a link and returns to the step it was followed from', async () => {
    const nav = fakeNav('v/flow/same');
    const trail = new RecallTrail(nav);
    const seen: (Position | null)[] = [];
    trail.onChange((o) => seen.push(o));
    expect(await trail.follow('v/wire/core')).toBe(true);
    expect(trail.returnTo).toEqual({ volumeId: 'v', chapterId: 'flow', stepId: 'same' });
    trail.onStep(nav.position); // arriving at the target keeps the way back
    expect(trail.returnTo).not.toBeNull();
    expect(await trail.back()).toBe(true);
    expect(nav.opened).toEqual(['v/wire/core', 'v/flow/same']);
    expect(trail.returnTo).toBeNull();
    expect(seen.map((o) => o?.stepId ?? null)).toEqual(['same', null]);
  });

  it('keeps the first way back across a chain of links, and ends when the reader comes back by hand', async () => {
    const nav = fakeNav('v/build/first');
    const trail = new RecallTrail(nav);
    await trail.follow('v/flow/loop');
    await trail.follow('v/wire/core');
    expect(trail.returnTo?.chapterId).toBe('build');
    trail.onStep({ volumeId: 'v', chapterId: 'build', stepId: 'first' });
    expect(trail.returnTo).toBeNull();
    expect(await trail.back()).toBe(false);
  });

  it('forgets the way back when the link leads nowhere', async () => {
    const trail = new RecallTrail(fakeNav('v/flow/same'));
    expect(await trail.follow('v/missing/step')).toBe(false);
    expect(trail.returnTo).toBeNull();
  });
});
