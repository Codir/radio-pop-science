/**
 * View model of the step panel, shared by the WebGL view (`hud/step-panel.ts`) and the DOM view
 * (`hud-dom/step/step-panel.ts`): counter, title and pages of the step at the reading level in effect (L1's
 * selector, never the `simple` fields directly) and whether the chapter quiz entry belongs under it.
 */
import type { ChapterManifest, ReadingLevel } from '@/engine/api';
import { quizAtLevel, stepAtLevel, stepContent, type ChapterContent, type LeveledStep } from '@/content';

export interface StepModel {
  readonly index: number;
  readonly count: number;
  /** «Крок n / N» as written (the renderers show the counter in capitals). */
  readonly counter: string;
  readonly title: string;
  /** Pages of rich text (the manifest's blurb when the chapter has no copy for the step). */
  readonly pages: readonly string[];
  /** The step's copy at the level in effect (undefined: no content for this step). */
  readonly copy: LeveledStep | undefined;
  /** The step has a simple layer (the «Просто / Докладно» switch is live). */
  readonly hasSimple: boolean;
  /** The chapter quiz entry goes under this step (the last one, when the chapter has a quiz). */
  readonly quiz: boolean;
  /** No copy yet and no blurb: «Текст цього кроку ще готується.» */
  readonly pending: boolean;
}

export const STEP_PENDING = 'Текст цього кроку ще готується.';
export const QUIZ_TITLE = 'Міні-квіз розділу';

/** The panel's data for step `stepId`, or null when the manifest has no such step. */
export function stepModel(
  manifest: ChapterManifest,
  content: ChapterContent | null,
  stepId: string,
  level: ReadingLevel,
): StepModel | null {
  const index = manifest.steps.findIndex((s) => s.id === stepId);
  const step = manifest.steps[index];
  if (!step) return null;
  const raw = stepContent(content, stepId);
  const copy = raw ? stepAtLevel(raw, level) : undefined;
  return {
    index,
    count: manifest.steps.length,
    counter: `Крок ${index + 1} / ${manifest.steps.length}`,
    title: copy?.title ?? step.title,
    pages: copy?.panel.length ? copy.panel : [step.blurb],
    copy,
    hasSimple: !!raw?.simple,
    quiz: index === manifest.steps.length - 1 && (quizAtLevel(content, level)?.items.length ?? 0) > 0,
    pending: !copy && content === null && !step.blurb,
  };
}

