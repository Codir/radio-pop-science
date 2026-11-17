/**
 * «Почати з нуля»: wipe everything the app keeps in the browser and start again from the very beginning.
 * Every key the app writes shares the prefix `electricity:` (the project's code name, not a volume id —
 * `engine/store.ts`, `hud/hints.ts`), so the reset clears by prefix and catches future keys too; storage of other
 * apps on the same origin is left alone. IndexedDB databases and Cache Storage caches are swept by the same prefix
 * (the app uses none today).
 */

/** Namespace of every key, database and cache the app keeps in the browser. */
export const APP_STORAGE_PREFIX = 'electricity:';

/** The part of `Storage` the sweep needs (tests pass a fake). */
export interface SweepableStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Remove every key of the app from `storage`; returns the removed keys. Foreign keys stay. */
export function clearAppKeys(storage: SweepableStorage, prefix = APP_STORAGE_PREFIX): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null && k.startsWith(prefix)) keys.push(k);
  }
  // collected first: removing while indexing would shift the indices
  for (const k of keys) storage.removeItem(k);
  return keys;
}

/** The very beginning of the app: the library start `#/`, with the reader's query flags (`?hud=dom`…) kept. */
export function restartUrl(loc: { pathname: string; search: string }): string {
  return `${loc.pathname}${loc.search}#/`;
}

function storageOf(get: () => Storage): Storage | null {
  try {
    return get();
  } catch {
    return null; // storage disabled (private mode, blocked site data)
  }
}

/** Delete the app's IndexedDB databases and caches (by prefix); best effort, never throws. */
async function clearAppDatabases(prefix: string): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function')
      for (const db of await indexedDB.databases())
        if (db.name?.startsWith(prefix)) indexedDB.deleteDatabase(db.name);
  } catch {
    // not supported / blocked: nothing of ours can be there
  }
  try {
    if (typeof caches !== 'undefined')
      for (const name of await caches.keys()) if (name.startsWith(prefix)) await caches.delete(name);
  } catch {
    // Cache Storage unavailable (insecure context)
  }
}

/** Anything that persists app state and must stop writing before the wipe (`Store.forget`). */
export interface Forgetful {
  forget(): void;
}

/**
 * Wipe the app's browser state and reload at the beginning. `store` stops persisting first, so nothing is written
 * back between the wipe and the reload.
 */
export async function resetApp(store: Forgetful): Promise<void> {
  store.forget();
  for (const s of [storageOf(() => window.localStorage), storageOf(() => window.sessionStorage)])
    if (s) clearAppKeys(s);
  await clearAppDatabases(APP_STORAGE_PREFIX);
  // a hash-only change would not reload: set the address, then reload the page itself
  window.history.replaceState(null, '', restartUrl(window.location));
  window.location.reload();
}
