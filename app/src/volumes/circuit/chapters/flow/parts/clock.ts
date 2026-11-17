/**
 * True time as the script prints it («45 с», «2 хв 16 с»), the unit words taken from the script's own caption of
 * the slider's end mark, so no Ukrainian is typed into code; and the goal's hold. (The same two helpers as the
 * prologue's riddle — chapters may not import each other.)
 */
const NBSP = ' ';

export interface Clock {
  format(seconds: number): string;
}

/** `endMark` like «2 хв 16 с»: number, minutes word, number, seconds word (any whitespace between). */
export function clockFrom(endMark: string): Clock {
  const parts = endMark.trim().split(/\s+/);
  const minutes = parts[1] ?? '';
  const secondsWord = parts[3] ?? parts[1] ?? '';
  return {
    format(seconds) {
      const s = Math.max(0, Math.round(seconds));
      const m = Math.floor(s / 60);
      return m ? `${m}${NBSP}${minutes} ${s % 60}${NBSP}${secondsWord}` : `${s}${NBSP}${secondsWord}`;
    },
  };
}

/** The goal's hold: true once `on` has held for `seconds` (reset when it stops holding). */
export function holdFor(seconds: number): { update(on: boolean, dt: number): boolean; reset(): void } {
  let held = 0;
  return {
    update(on, dt) {
      held = on ? held + dt : 0;
      return held >= seconds;
    },
    reset() {
      held = 0;
    },
  };
}
