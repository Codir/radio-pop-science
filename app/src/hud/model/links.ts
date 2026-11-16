/**
 * View model of «Див. також» (the chapter's `crossReferences` as link chips of the step panel), shared by the
 * WebGL view (`hud/step-links.ts`) and the DOM view (`hud-dom/step/links.ts`). A reference belongs to the step
 * its `where` names (`` `step-id` `` or «крок N»); references that name no step go to the last step. Links to
 * built chapters jump there — in this volume or in another one; the others are inactive (dimmed, a tooltip).
 */
import type { ChapterManifest, Library } from '@/engine/api';
import { linkTarget, type ChapterContent, type CrossReference } from '@/content';

export interface LinkModel {
  /** `xref-<target>` (QA name of the chip). */
  readonly name: string;
  /** Caption, cut to 60 characters. */
  readonly label: string;
  /** The target chapter is built (the link is live). */
  readonly built: boolean;
  readonly tooltip: string;
  /** Where a live link goes: `volume/chapter` and the step (undefined: the chapter's first step). */
  readonly to: { readonly chapter: string; readonly stepId: string | undefined } | null;
}

/** Caption of the chips' group. */
export const LINKS_CAPTION = 'Див. також';

/** Step index a reference belongs to (-1: none named). */
export function stepOf(ref: CrossReference, manifest: ChapterManifest): number {
  for (const m of ref.where.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
    const i = manifest.steps.findIndex((s) => s.id === m[1]);
    if (i >= 0) return i;
  }
  const n = /крок(?:и|у|ах)?\s+(\d+)/i.exec(ref.where);
  return n ? Math.min(Number(n[1]) - 1, manifest.steps.length - 1) : -1;
}

/** The links of step `index` of the chapter (empty when it has none). */
export function stepLinks(
  content: ChapterContent | null,
  manifest: ChapterManifest,
  index: number,
  library: Pick<Library, 'registry'>,
): LinkModel[] {
  const last = manifest.steps.length - 1;
  const refs = (content?.crossReferences ?? []).filter((r) => {
    const i = stepOf(r, manifest);
    return i === index || (i < 0 && index === last);
  });
  const out: LinkModel[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    // `note` lists one caption per target, separated by «;»
    const notes = (ref.note ?? '').split(';').map((s) => s.trim());
    ref.targets.forEach((target, k) => {
      if (seen.has(target)) return;
      seen.add(target);
      // targets are full step addresses (`volume/chapter/step`); the volumes a chapter links to are loaded
      // together with its content (`Hud.setChapter`), so a link into another volume resolves here too
      const to = linkTarget(target);
      if (!to) return;
      const volumeId = to.volumeId ?? manifest.volume;
      const chapterId = to.chapterId;
      const built = library.registry(volumeId)?.get(chapterId);
      const step = built?.steps.find((s) => s.id === to.stepId);
      const label =
        (notes.length === ref.targets.length ? notes[k] : undefined) ||
        (built ? `${built.title}${step ? ` · ${step.title}` : ''}` : chapterId);
      out.push({
        name: `xref-${target}`,
        label: label.length > 60 ? `${label.slice(0, 58)}…` : label,
        built: !!built,
        tooltip: built ? 'Перейти до пов’язаного кроку' : 'Цей розділ ще будується',
        to: built ? { chapter: `${volumeId}/${chapterId}`, stepId: step?.id } : null,
      });
    });
  }
  return out;
}
