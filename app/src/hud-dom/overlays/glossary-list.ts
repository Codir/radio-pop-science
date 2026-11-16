/**
 * The term list of the DOM glossary (glossary.ts): rows built once per record and kept, the hits shown in chunks
 * of `CHUNK` — the next chunk joins when the reader scrolls near the end (an `IntersectionObserver` on a sentinel)
 * — so a keystroke costs the search plus re-attaching at most one chunk of ready rows (684-term fixture: < 4 ms).
 */
import type { GlossaryRecord } from '@/content';
import { glossaryRow, glossaryTarget } from '@/hud/model/glossary';
import type { Journey } from '@/hud/journey';
import type { Hud } from '@/hud/shell';
import { h, setClass } from '../core/dom';
import { icon } from '../core/icons';
import { setRich } from '../core/rich';

const CHUNK = 20;

export interface GlossaryList {
  readonly el: HTMLElement;
  /** Show these records (in order); `focus` is marked and scrolled to. Text for an empty list / loading. */
  show(records: readonly GlossaryRecord[], opts?: { focus?: GlossaryRecord | null; empty?: string }): void;
  /** Forget the rows (the scope changed: other records, other link texts). */
  reset(): void;
}

export function glossaryList(hud: Hud, journey: Journey, scroll: HTMLElement): GlossaryList {
  const rows = new Map<GlossaryRecord, HTMLElement>();
  const list = h('ul.ov-terms', { 'data-ui': 'glossary-list' });
  const note = h('p.ov-terms-note', { role: 'status' });
  const sentinel = h('li.ov-terms-more', { 'aria-hidden': 'true' });
  let hits: readonly GlossaryRecord[] = [];
  let shown = 0;

  const row = (r: GlossaryRecord): HTMLElement => {
    const old = rows.get(r);
    if (old) return old;
    const m = glossaryRow(r, journey, hud.engine.library);
    const heading = h('h3.ov-term-name');
    setRich(heading, m.heading);
    const text = h('p.ov-term-def');
    setRich(text, m.definition);
    const link = h(
      'button.btn.ghost.sm.ov-term-link',
      { type: 'button', 'data-tip': 'Перейти до кроку, де вводиться термін' },
      icon('link'),
      h('span', null, m.where),
    );
    link.addEventListener('click', () => {
      if (!m.real) return void hud.toast('Цей розділ ще будується.', { tone: 'warning', duration: 2.5 });
      const t = glossaryTarget(r);
      hud.goto(t.chapter, t.step);
    });
    const el = h(
      'li.ov-term',
      null,
      heading,
      m.intl ? h('p.ov-term-intl', { lang: 'en' }, m.intl) : null,
      text,
      link,
    );
    rows.set(r, el);
    return el;
  };

  const more = (): void => {
    const next = hits.slice(shown, shown + CHUNK).map(row);
    shown += next.length;
    sentinel.remove();
    list.append(...next);
    if (shown < hits.length) list.append(sentinel);
  };
  const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), {
    root: scroll,
    rootMargin: '0px 0px 400px 0px',
  });
  io.observe(sentinel);

  return {
    el: h('div.ov-terms-wrap', null, note, list),
    show(records, opts = {}) {
      hits = records;
      const focus = opts.focus ?? null;
      const at = focus ? records.indexOf(focus) : -1;
      shown = 0;
      list.replaceChildren();
      for (const el of rows.values()) setClass(el, 'focus', false);
      // at least the first chunk, or as far as the focused term
      while (shown < Math.min(records.length, Math.max(CHUNK, at + 1))) more();
      if (records.length < CHUNK || shown >= records.length) sentinel.remove();
      note.textContent = records.length === 0 ? (opts.empty ?? '') : '';
      note.hidden = records.length > 0;
      if (focus && at >= 0) {
        const el = row(focus);
        setClass(el, 'focus', true);
        // after the dialog is laid out; the list's own scroll only (scrollIntoView would also move the layer)
        requestAnimationFrame(() => (scroll.scrollTop = Math.max(el.offsetTop - 8, 0)));
      }
    },
    reset() {
      rows.clear();
      list.replaceChildren();
      hits = [];
      shown = 0;
    },
  };
}
