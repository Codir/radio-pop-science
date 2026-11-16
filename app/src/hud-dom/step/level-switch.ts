/**
 * «Просто | Докладно» — the reading-level switch in the step panel's head (docs/HUD_DOM.md §10). A radio group
 * (`role=radiogroup`, roving focus, ←/→ move and select) writing L1's persisted setting through
 * `engine.setReadingLevel`; the panel re-renders from L1's selector on the store change, the switch itself stays,
 * so focus stays on it. A step without a simple layer shows the switch dimmed with a tooltip.
 */
import type { Engine, ReadingLevel } from '@/engine/api';
import { READING_LEVELS } from '@/content';
import { h, setClass } from '../core/dom';

/** Tooltip of the dimmed switch (wording: orchestrator, HUD_DOM §18 Q8 — placeholder). */
export const ONLY_DETAILED = 'Для цього кроку є лише докладний текст';

export interface LevelSwitch {
  readonly el: HTMLElement;
  /** The level shown and whether the step has a simple layer (else dimmed, inactive). */
  sync(level: ReadingLevel, live: boolean): void;
}

export function createLevelSwitch(engine: Engine): LevelSwitch {
  let live = true;
  const items = READING_LEVELS.map((l) =>
    h('button.seg', { type: 'button', role: 'radio', 'data-ui': `reading-level:${l.id}`, 'data-level': l.id }, l.label),
  );
  const el = h('div.level', { role: 'radiogroup', 'aria-label': 'Рівень тексту', 'data-ui': 'reading-level', 'data-keys': '' }, ...items);
  const pick = (id: ReadingLevel): void => {
    if (live && id !== engine.readingLevel()) engine.setReadingLevel(id);
  };
  items.forEach((b, i) => {
    b.addEventListener('click', () => pick(READING_LEVELS[i]!.id));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = items[(i + d + items.length) % items.length]!;
      next.focus();
      pick(next.dataset.level as ReadingLevel);
    });
  });
  return {
    el,
    sync(level, isLive) {
      live = isLive;
      setClass(el, 'dim', !live);
      if (live) {
        el.removeAttribute('aria-disabled');
        delete el.dataset.tip;
      } else {
        el.setAttribute('aria-disabled', 'true');
        el.dataset.tip = ONLY_DETAILED;
      }
      // without a simple layer the detailed copy is shown, whatever the setting says
      const shown = live ? level : 'detailed';
      for (const b of items) {
        const on = b.dataset.level === shown;
        b.setAttribute('aria-checked', String(on));
        // roving focus: Tab enters the group on the checked item
        b.tabIndex = on ? 0 : -1;
      }
    },
  };
}
