/**
 * Area `board` of the DOM interface (WebGL twin `hud/board.ts`, UI_API §3.2): `<aside data-ui="board">` for the
 * big charts, tables and stat grids of a step — title, fold button (`board-fold`), scrolling body, buttons last.
 * Wide: top-left, right of the spine, under the header. Narrow / portrait: full width under the header, above the
 * column's sheet. Its box frames the camera (inset `left` on wide screens, `top` otherwise).
 *
 * The step column (`hud-dom/dock`) builds the board's controls with its own and places it in its layout pass, so
 * the board always follows the column; this area's `mount` has nothing of its own to mount.
 */
import type { HudMetrics } from '@/engine/api';
import type { BoardSpec } from '@/hud/step-ui-types';
import type { DomHud } from '../core/context';
import { h, scrollArea, setStyle, setText } from '../core/dom';
import { icon, setIcon } from '../core/icons';
import { presence } from '../core/motion';
import './board.css';

const WIDTH = { sm: 380, md: 520, lg: 680, fill: 680 } as const;
/** `fill`: the margin kept free around the board inside the scene area, units. */
const FILL_MARGIN = 28;
const u = (n: number): string => `calc(${n.toFixed(2)} * var(--u))`;

export interface DomBoard {
  readonly el: HTMLElement;
  /** Show `spec` with the built body and buttons (null: hide the board). */
  show(
    spec: BoardSpec | null,
    body: readonly HTMLElement[],
    actions: readonly HTMLElement[],
    instant: boolean,
  ): void;
  /** Layout pass: `top` = under the header, `bottom` = units the column's sheet takes (narrow layouts). */
  place(m: HudMetrics, top: number, bottom: number): void;
}

export function mount(_dom: DomHud): void {}

export function createDomBoard(dom: DomHud): DomBoard {
  const hud = dom.hud;
  const title = h('h3.bd-title', { id: 'kd-board-title' });
  const fold = h(
    'button.btn.icon.sm.bd-fold',
    {
      type: 'button',
      'data-ui': 'board-fold',
      'aria-expanded': 'true',
      'aria-controls': 'kd-board-body',
      'aria-label': 'Згорнути / розгорнути дошку',
      'data-tip': 'Згорнути / розгорнути дошку',
    },
    icon('chevronUp'),
  );
  const list = h('div.bd-list');
  const scroll = scrollArea(h('div.bd-scroll', null, list));
  const actions = h('div.bd-actions');
  const body = h('div.bd-body', { id: 'kd-board-body' }, scroll, actions);
  const el = h(
    'aside.kd.glass.bd',
    { 'data-ui': 'board', 'aria-labelledby': 'kd-board-title', hidden: true },
    h('div.bd-head', null, title, fold),
    body,
  );
  const shown = presence(el);
  const open = presence(body);
  let spec: BoardSpec | null = null;
  let collapsed = false;
  fold.addEventListener('click', () => {
    collapsed = !collapsed;
    fold.setAttribute('aria-expanded', String(!collapsed));
    setIcon(fold.firstElementChild as HTMLElement, collapsed ? 'chevronDown' : 'chevronUp');
    if (collapsed) open.conceal({ dy: 8, scale: 1, onDone: () => hud.relayout() });
    else open.reveal({ dy: 8, scale: 1 });
    hud.relayout();
  });
  // the scroll's content changes size (a table grows, a control fades in): new layout pass
  new ResizeObserver(() => hud.relayout()).observe(list);
  dom.region(
    { el },
    { inset: { side: (m) => (m.layout === 'wide' ? 'left' : 'top'), extra: 14 }, region: 'board' },
  );

  return {
    el,
    show(next, nodes, buttons, instant) {
      spec = next;
      if (!next) {
        shown.conceal({ instant, dx: -16, dy: 0, onDone: () => hud.relayout() });
        return;
      }
      list.replaceChildren(...nodes);
      actions.replaceChildren(...buttons);
      actions.hidden = buttons.length === 0;
      setText(title, next.title ?? '');
      title.hidden = !next.title;
      el.setAttribute('aria-label', next.title ?? 'Дошка');
      scroll.scrollTop = 0;
      // a calm entrance after the step's own change (engine clock; reduced motion: short, by `presence`): a
      // corner board slides in from the spine's side, a `fill` board — the step's subject — rises in place
      if (next.size === 'fill') shown.reveal({ instant, dx: 0, dy: -12, scale: 0.985, duration: 0.9, delay: 0.25 });
      else shown.reveal({ instant, dx: -24, dy: 0, duration: 0.6, delay: 0.12 });
    },
    place(m, top, bottom) {
      const margin = m.safeMargin;
      const want = WIDTH[spec?.size ?? 'md'];
      let width: number;
      let room: number;
      const fill = spec?.size === 'fill' && m.layout === 'wide';
      el.classList.toggle('fill', spec?.size === 'fill');
      if (fill) {
        // the subject of the step: the free scene area between the spine and the step column, centred in it
        const from = margin + 64;
        const free = m.width - from - (468 + margin * 2) - 24;
        width = Math.max(free - FILL_MARGIN * 2, 300);
        setStyle(el, 'left', u(from + (free - width) / 2));
        room = m.height - top - margin - 96 - FILL_MARGIN;
        setStyle(el, '--bd-room', String(Math.round(room)));
      } else if (m.layout === 'wide') {
        // right of the spine; never under the step column (468 + margins) on the right
        const left = margin + 64;
        width = Math.max(Math.min(want, m.width - left - (468 + margin * 2) - 24), 300);
        setStyle(el, 'left', u(left));
        room = m.height - top - margin - 96;
      } else {
        width = Math.min(m.width - margin * 2, Math.max(want, 560));
        setStyle(el, 'left', u((m.width - width) / 2));
        room = m.height - top - bottom - 24;
      }
      setStyle(el, 'top', u(top));
      setStyle(el, 'width', u(width));
      if (el.hidden) return;
      // the body scrolls when the screen is short: the board's own chrome (title, buttons, padding) stays. The chrome
      // does not depend on the scroll's max-height: read, then write (one forced layout)
      const k = m.pxPerUnit;
      const chrome = (el.offsetHeight - scroll.offsetHeight) / k;
      setStyle(scroll, 'max-height', u(Math.max(room - chrome, m.layout === 'wide' ? 120 : 110)));
      // `fill`: centred in the free height too (its height follows its width, within the room)
      if (fill) setStyle(el, 'top', u(top + FILL_MARGIN / 2 + Math.max((room - el.offsetHeight / k) / 2, 0)));
    },
  };
}
