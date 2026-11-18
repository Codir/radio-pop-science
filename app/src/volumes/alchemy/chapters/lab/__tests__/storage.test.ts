import { afterEach, describe, expect, it, vi } from 'vitest';
import { discover, EMPTY_PROGRESS } from '@alchemy/sim/lab';
import { loadProgress, saveProgress } from '../parts/storage';

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers with empty progress when there is no window', () => {
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
  });

  it('answers with empty progress when the storage throws', () => {
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('denied'); } });
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
  });

  it('round-trips under the key alchemy:v1', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) },
    });
    saveProgress(discover(EMPTY_PROGRESS, 1, 0));
    expect([...data.keys()]).toEqual(['alchemy:v1']);
    expect(loadProgress().discovered).toEqual(['1-0']);
  });
});
