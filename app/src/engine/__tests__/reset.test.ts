import { describe, expect, it } from 'vitest';
import { APP_STORAGE_PREFIX, clearAppKeys, restartUrl } from '../reset';
import { Store } from '../store';

/** A Map-backed Storage with the indexed access the sweep uses. */
class FakeStorage {
  readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

describe('reset «Почати з нуля»', () => {
  it('removes every app key and leaves foreign keys alone', () => {
    const s = new FakeStorage();
    for (const k of ['electricity:v2', 'electricity:v1', 'electricity:ui:v1:onboarded', 'electricity:future:x'])
      s.setItem(k, '1');
    s.setItem('other-app', 'keep');
    s.setItem('electricityX', 'keep'); // shares letters, not the namespace
    const removed = clearAppKeys(s);
    expect(removed).toHaveLength(4);
    expect([...s.data.keys()].sort()).toEqual(['electricityX', 'other-app']);
    expect([...s.data.keys()].some((k) => k.startsWith(APP_STORAGE_PREFIX))).toBe(false);
  });

  it('a forgotten store writes nothing back', () => {
    const s = new FakeStorage();
    const store = new Store(s);
    store.markVisited({ volumeId: 'electricity', chapterId: 'atom', stepId: 'a' });
    expect(s.getItem('electricity:v2')).not.toBeNull();
    store.forget();
    clearAppKeys(s);
    store.markVisited({ volumeId: 'electricity', chapterId: 'atom', stepId: 'b' });
    store.updateSettings({ audio: false });
    expect(s.data.size).toBe(0);
    // a fresh start reads defaults
    expect(new Store(s).get().progress.visited).toEqual({});
  });

  it('restarts at the library start and keeps the query flags', () => {
    expect(restartUrl({ pathname: '/', search: '?hud=dom' })).toBe('/?hud=dom#/');
    expect(restartUrl({ pathname: '/app/', search: '' })).toBe('/app/#/');
  });
});
