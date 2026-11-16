/**
 * View model of the step panel, shared by the WebGL view (`hud/step-panel.ts`, `hud/dock-build.ts`
 * `honestyChips`) and the DOM view (`hud-dom/step/step-panel.ts`): counter, title and pages of the step at the
 * reading level in effect (L1's selector, never the `simple` fields directly), the honesty chips of its step UI
 * and whether the chapter quiz entry belongs under it.
 */
import type { ChapterManifest, ReadingLevel } from '@/engine/api';
import { fmtNumber, fmtSci } from '@/content/format';
import { quizAtLevel, stepAtLevel, stepContent, type ChapterContent, type LeveledStep } from '@/content';
import type { IconName } from '@/ui3d';
import type { HonestySpec, When } from '../step-ui-types';

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

/** One honesty chip of a step («сповільнено ×1 000», «не в масштабі» …). */
export interface HonestyModel {
  readonly icon: IconName;
  readonly text: string;
  /** Shown only while this holds (undefined: always). */
  readonly visible: When | undefined;
}

/** «×1 000», but «×10⁹» for huge factors (a row of zeros is unreadable). */
export function honestyFactor(n: number): string {
  return n >= 1e6 ? `×${fmtSci(n, 2)}` : `×${fmtNumber(n)}`;
}

/** The course-wide wording of the honesty chips (DECISIONS §5); `text` is the document's own wording. */
const KINDS = {
  notToScale: ['scale', 'не в масштабі'],
  simplified: ['layers', 'спрощена модель'],
  illustrative: ['eye', 'ілюстративно'],
} as const satisfies Record<string, readonly [IconName, string]>;

export function honestyModel(list: readonly HonestySpec[] = []): HonestyModel[] {
  return list.map((h): HonestyModel => {
    if (typeof h === 'string') return { icon: KINDS[h][0], text: KINDS[h][1], visible: undefined };
    const visible = h.visible;
    if ('slowed' in h)
      return { icon: 'clock', text: h.text ?? `сповільнено ${honestyFactor(h.slowed)}`, visible };
    if ('sped' in h) return { icon: 'clock', text: h.text ?? `прискорено ${honestyFactor(h.sped)}`, visible };
    if ('enlarged' in h)
      return { icon: 'search', text: h.text ?? `збільшено ${honestyFactor(h.enlarged)}`, visible };
    if ('kind' in h) return { icon: KINDS[h.kind][0], text: h.text ?? KINDS[h.kind][1], visible };
    return { icon: 'info', text: h.text ?? '', visible };
  });
}
