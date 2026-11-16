/**
 * DOM view of «Див. також» (`hud/model/links.ts`, WebGL twin `hud/step-links.ts`): live links are buttons that
 * jump to the related step; links to chapters not built yet are dimmed, with the reason in their tooltip.
 */
import type { ChapterManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import { LINKS_CAPTION, stepLinks } from '@/hud/model/links';
import type { Hud } from '@/hud/shell';
import { h } from '../core/dom';
import { icon } from '../core/icons';

/** The link group of step `index`, or null when it has none. */
export function buildDomLinks(hud: Hud, content: ChapterContent | null, manifest: ChapterManifest, index: number): HTMLElement | null {
  const links = stepLinks(content, manifest, index, hud.engine.library);
  if (links.length === 0) return null;
  const items = links.map((l) => {
    const to = l.to;
    const el = to
      ? h('button.chip.link.multi', { type: 'button', 'data-ui': l.name, 'data-tip': l.tooltip }, icon('link'), h('span', null, l.label))
      : // not focusable, but it still explains itself on hover
        h(
          'span.chip.link.multi.dim',
          { 'data-ui': l.name, 'data-tip': l.tooltip },
          icon('lock'),
          h('span', null, l.label),
          h('span.kd-sr', null, ` (${l.tooltip})`),
        );
    if (to) el.addEventListener('click', () => hud.goto(to.chapter, to.stepId));
    return h('li', null, el);
  });
  return h('div.links', null, h('div.kicker', null, LINKS_CAPTION), h('ul.chips', { 'aria-label': LINKS_CAPTION }, ...items));
}
