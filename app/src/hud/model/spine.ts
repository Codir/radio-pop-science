/**
 * View model of the scale spine (left edge, wide screens), shared by the WebGL view (`hud/spine.ts`) and the
 * DOM view (`hud-dom/chrome/spine.ts`): one row per main-path chapter, a gap between groups, the plant types /
 * labs of a family fanned out next to their parent while a chapter of that family is on screen.
 */
import { contentKey } from '@/content';
import type { Journey, JourneyChapter } from '../journey';

export interface SpineEntry {
  readonly chapter: JourneyChapter;
  /** QA name: `spine-<id>`. */
  readonly name: string;
  /** «Назва · 10ⁿ m». */
  readonly tooltip: string;
  /** A child of a family (smaller dot in the fan). */
  readonly small: boolean;
}

export interface SpineRow {
  readonly entry: SpineEntry;
  /** A new group starts here (a gap above the row). */
  readonly gapBefore: boolean;
  /** The family fanned out beside the parent (empty for a plain chapter). */
  readonly kids: readonly SpineEntry[];
}

const entry = (c: JourneyChapter, small: boolean): SpineEntry => ({
  chapter: c,
  name: `spine-${c.id}`,
  tooltip: `${c.title} · ${c.axisLabel}`,
  small,
});

export function spineRows(journey: Journey): SpineRow[] {
  let group = '';
  return journey.roots.map((root) => {
    const gapBefore = group !== '' && root.group !== group;
    group = root.group;
    return {
      entry: entry(root, false),
      gapBefore,
      kids: journey.childrenOf(root.id).map((k) => entry(k, true)),
    };
  });
}

/** The family (parent id) whose fan is open while chapter `id` is on screen. */
export function spineFamily(journey: Journey, id: string): string {
  return journey.get(id)?.parent ?? id;
}

/** What a click on a spine dot does: open the chapter, or say that it is still being built. */
export type SpinePick = { readonly goto: string } | { readonly toast: string };

export function spinePick(c: JourneyChapter): SpinePick {
  return c.real ? { goto: contentKey(c) } : { toast: `«${c.title}» ще будується.` };
}
