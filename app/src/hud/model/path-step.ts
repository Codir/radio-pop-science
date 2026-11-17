/**
 * View model of the step panel for a path-format chapter (docs/PATH_FORMAT.md): one reader, no reading levels,
 * no section tabs. The main text with its term marks, the action line, the takeaway (shown once the step's goal
 * is reached), hints for a stuck reader, «Докладніше», «Згадайте…» links — and on the first step the chapter's opening card, on the last its closing card. Shared by every renderer; pure.
 */
import { stepContent, type ChapterContent, type PathRecall } from '@/content';
import type { ChapterManifest } from '@/engine/api';

export interface PathTerm {
  /** The marked span as it stands in the text («електричним струмом»). */
  readonly text: string;
  /** Card name in the glossary («електричний струм»). */
  readonly name: string;
  readonly definition: string;
}

export interface PathStepModel {
  readonly index: number;
  readonly count: number;
  /** «Крок n / N». */
  readonly counter: string;
  readonly title: string;
  /** One or two paragraphs of rich text; new terms are bold spans listed in `terms`. */
  readonly paragraphs: readonly string[];
  readonly terms: readonly PathTerm[];
  readonly action: string;
  /** May carry a bold term span too (a term first used in the takeaway). */
  readonly takeaway: string;
  readonly hints: readonly string[];
  readonly more: readonly string[];
  readonly recall: readonly PathRecall[];
  /** First step: «Питання з життя» and «Що ми вже знаємо» (empty `know` in a prologue). */
  readonly opening: { readonly hook: string; readonly know: string } | null;
  /** Last step: «Що ми тепер знаємо», the bridge and where «Далі» leads (null: the end of the journey). */
  readonly closing: {
    readonly now: readonly string[];
    readonly bridge: string;
    readonly next: { readonly id: string; readonly title: string } | null;
  } | null;
}

export const PATH_LABELS = {
  more: 'Докладніше',
  action: 'Що зробити',
  takeaway: 'Висновок',
  hint: 'Підказка',
  recall: 'Згадайте',
  back: 'Повернутися',
  hook: 'Питання з життя',
  know: 'Що ми вже знаємо',
  now: 'Що ми тепер знаємо',
  start: 'До першого кроку',
  next: 'Далі',
  end: 'Кінець шляху',
} as const;

/** True when the chapter is in the path format (its content carries the chapter's path parts). */
export function isPathContent(content: ChapterContent | null | undefined): boolean {
  return !!content?.path;
}

export function pathStepModel(
  manifest: ChapterManifest,
  content: ChapterContent | null,
  stepId: string,
): PathStepModel | null {
  const chapter = content?.path;
  const index = manifest.steps.findIndex((s) => s.id === stepId);
  const step = stepContent(content, stepId);
  const path = step?.path;
  if (!chapter || index < 0 || !step || !path) return null;
  const card = new Map((step.terms ?? []).map((t) => [t.name ?? t.ukrainian ?? '', t.definition ?? '']));
  const last = index === manifest.steps.length - 1;
  return {
    index,
    count: manifest.steps.length,
    counter: `Крок ${index + 1} / ${manifest.steps.length}`,
    title: step.title,
    paragraphs: step.panel,
    terms: path.marks.map((m) => ({ text: m.text, name: m.term, definition: card.get(m.term) ?? '' })),
    action: path.action,
    takeaway: path.takeaway,
    hints: path.hints ?? [],
    more: path.more,
    recall: path.recall ?? [],
    opening: index === 0 && chapter.hook ? { hook: chapter.hook, know: chapter.know } : null,
    closing:
      last && (chapter.now.length > 0 || chapter.bridge)
        ? { now: chapter.now, bridge: chapter.bridge, next: chapter.next }
        : null,
  };
}

/** Hints for a stuck reader: the first after 15 s on the step, the second after 40 s (PATH_FORMAT «Підказки»). */
export const HINT_AFTER = [15, 40] as const;

/** How many hints are due after `seconds` on the step without reaching its goal. */
export function hintsDue(hints: readonly string[], seconds: number): number {
  return HINT_AFTER.filter((t, i) => i < hints.length && seconds >= t).length;
}
