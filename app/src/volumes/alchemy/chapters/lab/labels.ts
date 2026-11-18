/**
 * Scene and control captions. Those the document quotes in «Інтерактив» are read from the generated export
 * (`steps[].labels`) with `doc(step, wording)`, so a caption changed in the document breaks the build instead
 * of drifting. The rest is plain Ukrainian written here. Panel copy never lives here — see `content.ts`.
 */
import raw from '@alchemy/content/generated/lab.json';
import type { StepId } from './chapter';

/** A UI label of the document, from the export; the caller names it by its wording. */
function doc(step: StepId, wording: string): string {
  const label = raw.steps.find((s) => s.id === step)?.labels?.find((l) => l === wording);
  if (label === undefined) throw new Error(`lab: step '${step}' has no label «${wording}» in the document`);
  return label;
}

export const L = {
  tools: {
    fire: doc('heavy-hydrogen', 'Вистрілити'),
    gammaN: doc('lead-gold', 'γ: вибити нейтрон'),
    gammaP: doc('lead-gold', 'γ: вибити протон'),
    wait: doc('heavy-hydrogen', 'Чекати на розпад'),
    restart: doc('heavy-hydrogen', 'Почати знову'),
    neutral: doc('heavy-hydrogen', 'Нейтралізувати'),
  },
  fission: {
    heavy: doc('fission', 'Продовжити з важким уламком'),
    light: doc('fission', 'Продовжити з легким уламком'),
  },
  chart: {
    full: doc('heavy-hydrogen', 'Уся карта'),
  },
  free: {
    newStart: doc('free', 'Новий старт'),
    take: doc('free', 'Взяти як старт'),
    cancel: doc('free', 'Скасувати'),
    startHere: doc('free', 'Почати звідси'),
  },
} as const;

/** `tools.fire` → text: the flat map handed to `defineContent` (the HUD exposes it as `content.labels`). */
export const FLAT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(L).flatMap(([group, items]) => Object.entries(items).map(([key, text]) => [`${group}.${key}`, text])),
);
