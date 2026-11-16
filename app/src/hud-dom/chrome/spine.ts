/**
 * DOM scale spine (left edge, wide desktop screens; WebGL twin `hud/spine.ts`): a ladder of the volume's
 * main-path chapters — one button each (`spine-<id>`, name and axis label in the tooltip), a gap between groups,
 * the current chapter enlarged and lit, the family of the chapter on screen fanned out beside its parent, a
 * progress arc per chapter. Rows from the shared model (`hud/model/spine.ts`).
 */
import { chapterProgress } from '@/content';
import type { Journey } from '@/hud/journey';
import { spineFamily, spinePick, spineRows, type SpineEntry } from '@/hud/model/spine';
import type { Hud } from '@/hud/shell';
import { h, setClass, setStyle } from '../core/dom';
import { presence } from '../core/motion';
import { applyAccent } from '../core/tokens';

export interface DomSpine {
  readonly el: HTMLElement;
  readonly journey: Journey;
  /** The chapter on screen (`id` within the volume). */
  setChapter(id: string): void;
  /** Progress arcs from the store. */
  refresh(): void;
}

export function createDomSpine(hud: Hud, journey: Journey): DomSpine {
  const dots = new Map<string, { el: HTMLElement; entry: SpineEntry }>();
  const fans = new Map<string, HTMLElement>();
  const dot = (e: SpineEntry): HTMLElement => {
    const b = h(
      `button.sdot${e.small ? '.small' : ''}`,
      { type: 'button', 'data-ui': e.name, 'data-tip': e.tooltip, 'aria-label': e.tooltip },
      h('span.arc', { 'aria-hidden': 'true' }),
      h('span.core', { 'aria-hidden': 'true' }),
    );
    applyAccent(b, e.chapter.accent);
    b.addEventListener('click', () => {
      const to = spinePick(e.chapter);
      if ('goto' in to) hud.goto(to.goto);
      else hud.toast(to.toast, { tone: 'warning', duration: 2.5 });
    });
    dots.set(e.chapter.id, { el: b, entry: e });
    return b;
  };
  const list = h('ol.spine-list');
  for (const row of spineRows(journey)) {
    const li = h(`li.spine-row${row.gapBefore ? '.gap' : ''}`, null, dot(row.entry));
    if (row.kids.length > 0) {
      const fan = h('div.spine-fan', { role: 'group', 'aria-label': row.entry.chapter.title }, ...row.kids.map(dot));
      fan.hidden = true;
      fans.set(row.entry.chapter.id, fan);
      li.append(fan);
    }
    list.append(li);
  }
  const el = h('nav.kd-spine', { 'data-ui': 'spine', 'aria-label': `Розділи: ${journey.volume.title}` }, h('div.rail'), list);
  let current = '';
  return {
    el,
    journey,
    setChapter(id) {
      const was = dots.get(current)?.el;
      if (was) {
        setClass(was, 'on', false);
        was.removeAttribute('aria-current');
      }
      current = id;
      const now = dots.get(id)?.el;
      if (now) {
        setClass(now, 'on', true);
        now.setAttribute('aria-current', 'page');
      }
      const family = spineFamily(journey, id);
      for (const [parent, fan] of fans) {
        const p = presence(fan);
        const open = parent === family;
        if (open === p.shown) continue;
        // the WebGL fan fades (0.25 s) without moving
        if (open) p.reveal({ dy: 0, scale: 1, duration: 0.25 });
        else p.conceal({ dy: 0, scale: 1, duration: 0.25 });
      }
    },
    refresh() {
      const visited = hud.engine.store.get().progress.visited;
      for (const { el: b, entry } of dots.values()) {
        const f = Math.min(chapterProgress(visited, entry.chapter).fraction, 1);
        setStyle(b, '--p', f > 0.01 ? `${(f * 100).toFixed(1)}%` : '0%');
      }
    },
  };
}
