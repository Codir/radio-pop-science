/** The only code of the chapter that touches `localStorage`. Every failure (no window, denied, garbage) is silent. */
import { EMPTY_PROGRESS, PROGRESS_KEY, parseProgress, serializeProgress } from '@alchemy/sim/lab';
import type { Progress } from '@alchemy/sim/lab';

/** Saved progress; empty progress when the storage is missing, throws or holds garbage. */
export function loadProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Best effort: never throws. */
export function saveProgress(p: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, serializeProgress(p));
  } catch {
    // storage unavailable or full: the game goes on without saving
  }
}
