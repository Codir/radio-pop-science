/**
 * «Див. також» in the WebGL step panel: the links of the step (`model/links.ts`) as link chips. Chips of
 * chapters that are built jump there; the others are inactive (dimmed, a tooltip, no sound).
 */
import type { ChapterManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import { Chip, UiNode } from '@/ui3d';
import type { HudContext } from './context';
import { LINKS_CAPTION, stepLinks } from './model/links';
import { caption } from './step-sections';

/** Link chips for step `index` of the chapter, or null when it has none. */
export function buildLinks(
  hud: HudContext,
  content: ChapterContent | null,
  manifest: ChapterManifest,
  index: number,
): UiNode | null {
  const chips = stepLinks(content, manifest, index, hud.engine.library).map(
    (l) =>
      new Chip({
        name: l.name,
        kind: 'plain',
        icon: l.built ? 'link' : 'lock',
        text: l.label,
        maxWidth: 380,
        opacity: l.built ? 1 : 0.55,
        tooltip: l.tooltip,
        onClick: l.to ? ((to) => () => hud.goto(to.chapter, to.stepId))(l.to) : undefined,
      }),
  );
  if (chips.length === 0) return null;
  return new UiNode({
    dir: 'col',
    gap: 8,
    width: 'fill',
    children: [
      caption(LINKS_CAPTION),
      new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill', children: chips }),
    ],
  });
}
