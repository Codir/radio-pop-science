/**
 * The DOM step column (WebGL twin `hud/dock.ts`): the step panel of `hud-dom/step` and, under it, the control dock
 * — a scrolling list of controls and a sticky action row. Wide: the right column under the header. Narrow /
 * portrait (desktop shell): a bottom sheet over the navigator, where «Опис» and «Керування» share the space through
 * a tab switch. Touch shells keep the WebGL sheet until D7.
 *
 * Height budget (UI_API §3.1, `hud/model/column.ts`): computed in the shell's layout pass — the only place that
 * reads layout; a `ResizeObserver` on the dock's content (and D2's on the step text) asks for a new pass when a
 * size changes. The text scrolls down to `TEXT_MIN`, then the title compacts, then the dock scrolls; the action
 * row, the page bar and the title never leave the screen.
 */
import type { HudMetrics } from '@/engine/api';
import { COLUMN_GAP, columnBudget } from '@/hud/model/column';
import type { Hud } from '@/hud/shell';
import { PANEL_WIDTH } from '@/hud/step-panel';
import { h, scrollArea, setClass, setStyle } from '../core/dom';
import { presence } from '../core/motion';
import type { DomStepPanel } from '../step/step-panel';

/** Height of the sheet's tab switch (the WebGL `Tabs` well), units. */
const TABS_H = 44;
const u = (n: number): string => `calc(${n.toFixed(2)} * var(--u))`;

export interface DomColumn {
  readonly el: HTMLElement;
  /** `<section data-ui="dock">` and its parts. */
  readonly dock: HTMLElement;
  readonly list: HTMLElement;
  readonly actions: HTMLElement;
  /** The step declares controls (set by the builder before `hud.relayout()`). */
  setDock(has: boolean, instant: boolean): void;
  /**
   * Lay out for the metrics (shell layout pass); `sized` runs once the width is set, before the budget measures.
   * Returns the units the column takes from the bottom edge.
   */
  layout(m: HudMetrics, around: { headerBottom: number; navigatorTop: number }, sized: () => void): number;
}

export function createDomColumn(hud: Hud, panel: DomStepPanel): DomColumn {
  const list = h('div.dk-list');
  const body = scrollArea(h('div.dk-body', { 'data-ui': 'dock-scroll' }, list));
  const actions = h('div.dk-actions', { 'data-ui': 'dock-actions' });
  const dock = h(
    'section.kd.glass.dk',
    { 'data-ui': 'dock', id: 'kd-dock', 'aria-label': 'Керування кроком', hidden: true },
    body,
    actions,
  );
  const tabItem = (id: 'text' | 'controls', label: string): HTMLButtonElement =>
    h('button.dk-tab', { type: 'button', role: 'tab', 'data-ui': `sheet-tabs:${id}`, 'aria-controls': id === 'text' ? 'kd-step-title' : 'kd-dock' }, label);
  const tabText = tabItem('text', 'Опис');
  const tabControls = tabItem('controls', 'Керування');
  const tabs = h('div.dk-tabs', { role: 'tablist', 'data-ui': 'sheet-tabs', 'aria-label': 'Що показати', hidden: true }, tabText, tabControls);
  const el = h('div.kd-col', null, tabs, panel.el, dock);
  const shown = presence(dock);
  let hasDock = false;
  /** Title size and text height of the last budget (the next pass measures without resetting them). */
  let compact = false;
  let lastText = 4000;
  let tab: 'text' | 'controls' = 'text';
  const setTab = (t: typeof tab): void => {
    tab = t;
    for (const [b, id] of [[tabText, 'text'], [tabControls, 'controls']] as const) {
      b.setAttribute('aria-selected', String(id === t));
      b.tabIndex = id === t ? 0 : -1;
    }
    hud.relayout();
  };
  tabText.addEventListener('click', () => setTab('text'));
  tabControls.addEventListener('click', () => setTab('controls'));
  setTab('text');

  // one observer: the dock's content and its action row change size (a control fades in, a table grows)
  const grow = new ResizeObserver(() => hud.relayout());
  grow.observe(list);
  grow.observe(actions);

  const k = (): number => hud.metrics.pxPerUnit;
  /** Share `available` units between the step panel and the dock (`columnBudget`); layout pass only. */
  function fit(available: number, width: number, withText: boolean, withDock: boolean): void {
    // read first, write after: every size measured here is independent of the max-heights the budget sets (the
    // text's and the list's own heights, the plates without their scrolling parts), so no reset is needed and the
    // pass costs one forced layout (two when the title must switch size)
    if (compact) panel.setCompact((compact = false));
    panel.fit(width, lastText); // the width (a no-op when unchanged)
    const bodyWant = withDock ? list.offsetHeight / k() : 0;
    const fit = columnBudget(
      {
        available,
        withText,
        withDock,
        chrome: withText || !withDock ? panel.chrome() : 0,
        textWant: withText && withDock ? panel.want() : 0,
        dockChrome: withDock ? (dock.offsetHeight - body.offsetHeight) / k() : 0,
        bodyWant,
      },
      () => {
        panel.setCompact((compact = true));
        return panel.chrome();
      },
    );
    if (fit.text !== null) panel.fit(width, (lastText = fit.text));
    if (fit.body !== null) setStyle(body, 'max-height', u(fit.body));
    // the controls scroll: the lower edge fades until the end is reached (a cut-off control reads as a hint)
    setClass(body, 'more', fit.body !== null && bodyWant > fit.body + 0.5);
    atEnd();
  }
  const atEnd = (): void => setClass(body, 'end', body.scrollTop + body.clientHeight >= body.scrollHeight - 1);
  body.addEventListener('scroll', atEnd, { passive: true });

  return {
    el,
    dock,
    list,
    actions,
    setDock(has, instant) {
      hasDock = has;
      if (has) shown.reveal({ instant, dy: -10 });
      else {
        shown.conceal({ instant, onDone: () => hud.relayout() });
        if (tab !== 'text') setTab('text');
      }
      tabs.hidden = !has;
    },
    layout(m, { headerBottom, navigatorTop }, sized) {
      const margin = m.safeMargin;
      if (m.layout === 'wide') {
        const top = margin + 58;
        setClass(el, 'sheet', false);
        setClass(panel.el, 'off', false);
        tabs.hidden = true;
        setStyle(el, 'width', u(PANEL_WIDTH));
        setStyle(el, 'left', '');
        setStyle(el, 'right', u(margin));
        setStyle(el, 'top', u(top));
        setStyle(el, 'bottom', '');
        setStyle(dock, 'display', '');
        sized();
        fit(m.height - top - margin, PANEL_WIDTH, true, hasDock);
        return 0;
      }
      const width = Math.min(m.width - margin * 2, 760);
      // above the step navigator (78 units as the WebGL sheet, or more when the DOM navigator is taller)
      const bottom = Math.max(margin + 78, m.height - navigatorTop + 6);
      const showDock = hasDock && tab === 'controls';
      setClass(el, 'sheet', true);
      tabs.hidden = !hasDock;
      setClass(panel.el, 'off', showDock);
      // the dock stays in the tree (its presence state) but takes no room while the text is shown
      setStyle(dock, 'display', hasDock && !showDock ? 'none' : '');
      setStyle(el, 'width', u(width));
      setStyle(tabs, 'width', u(Math.min(width, 360)));
      setStyle(el, 'right', '');
      setStyle(el, 'left', u((m.width - width) / 2));
      setStyle(el, 'top', '');
      setStyle(el, 'bottom', u(bottom));
      // the sheet takes up to 42 % of the height (45 % in portrait), never more than the room under the header
      const share = m.height * (m.layout === 'portrait' ? 0.45 : 0.42);
      sized();
      const room = Math.min(share, m.height - headerBottom - 12 - bottom) - (hasDock ? TABS_H + COLUMN_GAP : 0);
      fit(room, width, !showDock, showDock);
      return bottom + el.offsetHeight / k();
    },
  };
}
