/**
 * The sheet of the touch shells in the DOM (F5 behaviour, docs/MOBILE.md §3; WebGL twin `hud/touch/sheet.ts`,
 * geometry `hud/model/sheet.ts`): what a phone or tablet shows in place of the desktop column and board.
 *
 *   portrait (`sheet` shell)  — a bottom sheet: grip, step title, tabs «Текст | Керування | Графіки», the active
 *                               view; snap heights peek / half / full; the navigation row (D2's navigator, restyled
 *                               by touch.css) is pinned to the screen bottom over it;
 *   landscape (`side` shell)  — a side sheet on the right with the same head and views; collapses to its grip.
 *
 * It hosts the very elements of the desktop column (D2's step panel, D3's dock and board — `domColumnParts`): one
 * build of the step UI, two presentations. Moving the sheet never re-lays the page out: the sheet is laid out at
 * its largest size and slides with `transform`; the views get their height once per snap (and once when a drag
 * starts, for everything the drag can reveal). The camera gets the sheet's snap height as an inset (never more
 * than `half`: the full sheet is for reading, the framing stays).
 */
import type { HudMetrics, Tween } from '@/engine/api';
import {
  SHEET_TAB_LABEL,
  TOUCH,
  settleSnap,
  sheetGeometry,
  sideWidth,
  touchTop,
  type SheetCardText,
  type SheetControl,
  type SheetGeometry,
  type SheetInsets,
  type SheetSnap,
  type SheetTab,
} from '@/hud/model/sheet';
import type { Hud } from '@/hud/shell';
import { h, setClass, setStyle } from '../core/dom';
import { icon } from '../core/icons';
import { setRich } from '../core/rich';
import type { ColumnParts } from '../dock';
import { sheetDrag } from './gesture';

export interface DomSheet extends SheetControl {
  readonly el: HTMLElement;
  /** Layout pass of a touch shell: take the column's parts (once) and lay the sheet out. */
  layout(m: HudMetrics): void;
  /** A new step is on screen: back to the text, at the height remembered for this kind of step. */
  enterStep(instant: boolean): void;
  /** Show a card (an opened hotspot) in place of the views; the returned function removes it. */
  showCard(text: SheetCardText, onDismiss: () => void): () => void;
  /** Area the sheet and the compact header take from the scene, units from each edge. */
  insets(m: HudMetrics): SheetInsets;
}

const TABS: readonly SheetTab[] = ['text', 'controls', 'board'];
/**
 * A dock this short (units, and at most half of the half sheet's view) stays under the text instead of behind a
 * tab: the action («Що зробити»), the control it names and the takeaway it earns are on screen together.
 */
const INLINE_MAX = 160;
/** The text keeps at least this much height (units) at half when a dock sits under it. */
const TEXT_MIN = 110;
const u = (n: number): string => `calc(${n.toFixed(2)} * var(--u))`;

export function createDomSheet(hud: Hud, parts: ColumnParts): DomSheet {
  const bar = (): HTMLElement => h('span.sh-bar', { 'aria-hidden': 'true' });
  const grip = h(
    'button.sh-grip',
    { type: 'button', 'data-ui': 'sheet-grip', 'aria-label': 'Розгорнути чи згорнути панель кроку' },
    bar(),
  );
  const sideGrip = h(
    'button.sh-side-grip',
    { type: 'button', 'data-ui': 'sheet-side-grip', 'aria-label': 'Сховати чи показати панель кроку' },
    bar(),
  );
  const titleHost = h('div.sh-title');
  const tabButtons = new Map<SheetTab, HTMLButtonElement>();
  const views = new Map<SheetTab, HTMLElement>();
  for (const t of TABS) {
    const b = h(
      'button.dk-tab.sh-tab',
      { type: 'button', role: 'tab', id: `kd-sheet-tab-${t}`, 'data-ui': `sheet-tabs:${t}`, 'aria-controls': `kd-sheet-${t}` },
      SHEET_TAB_LABEL[t],
    );
    b.addEventListener('click', () => self.setTab(t));
    tabButtons.set(t, b);
    views.set(t, h('div.sh-view', { role: 'tabpanel', id: `kd-sheet-${t}`, 'aria-labelledby': `kd-sheet-tab-${t}` }));
  }
  views.get('text')!.removeAttribute('aria-labelledby');
  views.get('text')!.setAttribute('aria-label', 'Текст кроку');
  const tabs = h('div.dk-tabs.sh-tabs', { role: 'tablist', 'data-ui': 'sheet-tabs', 'aria-label': 'Що показати' }, ...tabButtons.values());
  const head = h('div.sh-head', null, titleHost, tabs);
  const cardView = h('div.sh-view.sh-card', { 'data-ui': 'sheet-card', hidden: true });
  const viewsEl = h('div.sh-views', null, ...views.values(), cardView);
  let card: { dismiss: () => void } | null = null;
  const el = h(
    'section.kd.kd-sheet',
    { 'data-ui': 'sheet', 'aria-label': 'Панель кроку', hidden: true },
    sideGrip,
    h('div.sh-inner', null, grip, head, viewsEl),
  );

  let adopted = false;
  let mode: 'sheet' | 'side' = 'sheet';
  let tab: SheetTab = 'text';
  let snap: SheetSnap = 'half';
  let has = { controls: false, board: false };
  let geo: SheetGeometry | null = null;
  let metrics: HudMetrics | null = null;
  /** Visible height (portrait) or width (landscape) of the sheet, units; animated between snaps. */
  const pos = { v: 0 };
  let moving = false;
  let anim: Tween | null = null;
  /** Height the views have been given (portrait), units. */
  let fitted = -1;
  /** Snap remembered per kind of step (which tabs it has), for this session. */
  const memory = new Map<string, SheetSnap>();
  /** The step's controls sit under the text (a short dock) — no «Керування» tab. */
  let inline = false;
  /** Height of the panel's own head (reading level) in the text view, units. */
  let panelChrome = 0;
  const kind = (): string => `${has.controls ? (inline ? 'i' : 'c') : ''}${has.board ? 'g' : ''}`;
  const k = (): number => metrics?.pxPerUnit ?? 1;
  const open = (): boolean => snap !== 'peek';

  /** Size of the sheet at a snap: height (portrait) or width (landscape). */
  const extent = (s: SheetSnap): number => {
    if (!geo || !metrics) return 0;
    if (mode === 'sheet') return geo[s];
    return s === 'peek' ? TOUCH.sideGrip : sideWidth(metrics);
  };
  /** Slide the laid-out sheet to `pos` (presentation only — no layout). */
  const place = (): void => {
    if (!geo || !metrics) return;
    const off = ((mode === 'sheet' ? geo.full : sideWidth(metrics)) - pos.v) * k();
    el.style.transform = mode === 'sheet' ? `translateY(${off.toFixed(1)}px)` : `translateX(${off.toFixed(1)}px)`;
  };
  /** Portrait: give the views the height of a snap (a layout change: once per snap, never while dragging). */
  const fit = (s: SheetSnap): void => {
    if (mode !== 'sheet' || !geo) return;
    const height = Math.max(geo.view[s], 0);
    if (height === fitted) return;
    fitted = height;
    setStyle(viewsEl, 'height', u(height));
  };
  /** Height of a view's content, units, also while the view is hidden (layout pass only). */
  const natural = (v: HTMLElement): number => {
    const was = v.hidden;
    v.hidden = false;
    v.classList.add('probe');
    const height = v.scrollHeight / k();
    v.classList.remove('probe');
    v.hidden = was;
    return height;
  };
  /** Which view is on screen follows the tab; at peek the views are out of reach (and of the QA checks). */
  const showViews = (): void => {
    for (const [t, v] of views) v.hidden = card !== null || (t !== tab && !(inline && t === 'controls' && tab === 'text'));
    cardView.hidden = card === null;
    setClass(el, 'inline', inline);
    const on = open() || moving;
    setClass(el, 'peek', !on);
    viewsEl.inert = !on;
    grip.setAttribute('aria-expanded', String(open()));
    sideGrip.setAttribute('aria-expanded', String(open()));
  };
  const syncTabs = (): void => {
    const shown = (t: SheetTab): boolean => t === 'text' || (t === 'controls' ? has.controls && !inline : has.board);
    for (const [t, b] of tabButtons) {
      b.hidden = !shown(t);
      b.setAttribute('aria-selected', String(t === tab));
      b.tabIndex = t === tab ? 0 : -1;
    }
    tabs.hidden = !(has.controls && !inline) && !has.board;
  };

  /** The text continues below the fold: its lower edge fades (touch.css) until the end is reached. */
  const text = parts.panel.scroll;
  const more = (): void => setClass(text, 'more', adopted && text.scrollTop + text.clientHeight < text.scrollHeight - 2);
  text.addEventListener('scroll', more, { passive: true });

  /** Take the column's parts into the views (the column takes them back itself: `parts.release`). */
  const adopt = (): void => {
    if (adopted) return;
    adopted = true;
    el.hidden = false;
    views.get('text')!.append(parts.panel.el);
    views.get('controls')!.append(parts.dock);
    views.get('board')!.append(parts.board);
    parts.panel.setTouch(titleHost);
    parts.release = () => {
      adopted = false;
      setClass(text, 'more', false);
      el.hidden = true;
      parts.panel.setTouch(null);
      parts.release = null;
    };
    fitted = -1;
  };

  const self: DomSheet = {
    el,
    get tab() {
      return tab;
    },
    get snap() {
      return snap;
    },
    layout(m) {
      metrics = m;
      adopt();
      has = { controls: parts.hasDock(), board: parts.hasBoard() };
      if ((tab === 'controls' && !has.controls) || (tab === 'board' && !has.board)) tab = 'text';
      const side = m.shell === 'side';
      if ((side ? 'side' : 'sheet') !== mode) {
        mode = side ? 'side' : 'sheet';
        anim?.kill();
        anim = null;
        moving = false;
        fitted = -1;
        setStyle(viewsEl, 'height', '');
        if (snap === 'full' && side) snap = 'half';
      }
      setClass(el, 'side', side);
      syncTabs();
      showViews();
      // widths first, so the title's height (1–3 lines) can be read (the layout pass may read layout)
      const safe = m.safeArea;
      if (side) {
        setStyle(el, 'width', u(sideWidth(m) + safe.right));
        setStyle(el, 'left', '');
        setStyle(el, 'height', '');
      } else {
        const g0 = sheetGeometry(m, 0, false);
        setStyle(el, 'width', u(g0.width));
        setStyle(el, 'left', u(g0.left));
      }
      parts.layoutControls();
      // reads (the layout pass may read): the title's height (1–3 lines) and the dock's natural height
      const titleH = titleHost.offsetHeight / k();
      const dockH = has.controls ? natural(views.get('controls')!) : 0;
      // the view the text shares with the dock: the half sheet's, or the side sheet's whole height
      const room = side
        ? m.height - safe.top - safe.bottom - titleH - TOUCH.edge * 2 - 16 - (has.board ? TOUCH.tabsH + 8 : 0)
        : sheetGeometry(m, titleH, has.board).view.half;
      // a margin against flipping on the edge (the dock's own padding differs a little between the two places)
      const limit = Math.min(INLINE_MAX, room * 0.5) + (inline ? 24 : 0);
      // and the text keeps a reading window beside the panel's own head (reading level)
      // (the panel's head is measured while the text is on screen; the reader on «Керування» keeps the tab)
      if (tab === 'text' && card === null) panelChrome = parts.panel.chrome();
      const textRoom = room - dockH - panelChrome;
      const nowInline =
        tab === 'controls' ? false : has.controls && dockH <= limit && textRoom >= TEXT_MIN - (inline ? 24 : 0);
      if (nowInline !== inline) {
        inline = nowInline;
        if (inline && tab === 'controls') tab = 'text';
        syncTabs();
        showViews();
      }
      geo = sheetGeometry(m, titleH, !tabs.hidden);
      if (!side) setStyle(el, 'height', u(geo.full));
      if (!moving) pos.v = extent(snap);
      place();
      // the views are fitted for where the sheet is heading (never smaller than what is being revealed)
      fit(open() ? snap : 'half');
      more();
    },
    enterStep(instant) {
      card?.dismiss();
      has = { controls: parts.hasDock(), board: parts.hasBoard() };
      tab = 'text';
      for (const v of views.values()) v.scrollTop = 0;
      // the scene change is part of the step: a sheet left at `full` comes back at `half`
      const kept = memory.get(kind()) ?? 'half';
      self.setSnap(kept === 'full' ? 'half' : kept, { instant });
    },
    setTab(given) {
      card?.dismiss();
      const next = inline && given === 'controls' ? 'text' : given;
      if (next === tab && open()) return;
      tab = next;
      syncTabs();
      showViews();
      if (!open()) self.setSnap('half');
      hud.relayout();
    },
    setSnap(next, opts = {}) {
      snap = mode === 'side' && next === 'full' ? 'half' : next;
      memory.set(kind(), snap);
      if (!geo || !metrics) return;
      const to = extent(snap);
      const target = snap;
      moving = true;
      showViews();
      // growing: the newly revealed part is laid out before it shows
      if (target !== 'peek' && geo.view[target] > fitted) fit(target);
      hud.relayout(); // the camera inset, header and system buttons follow
      const done = (): void => {
        moving = false;
        pos.v = to;
        place();
        showViews();
        fit(target === 'peek' ? 'half' : target);
        hud.relayout();
      };
      anim?.kill();
      anim = null;
      if (opts.instant || hud.engine.reducedMotion) return done();
      anim = hud.host.tweens.to(pos, { v: to }, { duration: 0.34, ease: 'power3.out', onUpdate: place, onComplete: done });
    },
    showCard(text, onDismiss) {
      card?.dismiss();
      const back = h('button.btn.sm.ghost.sh-card-back', { type: 'button', 'data-ui': 'sheet-card-back' }, icon('arrowLeft'), h('span', null, 'Назад до кроку'));
      const body = h('p.sh-card-body');
      setRich(body, text.body);
      cardView.replaceChildren(
        back,
        h('div.kicker.sh-card-kicker', null, icon('info'), h('span', null, text.kicker)),
        h('h3.sh-card-title', null, text.title),
        body,
      );
      const entry = {
        dismiss: () => {
          if (card !== entry) return;
          card = null;
          cardView.replaceChildren();
          onDismiss();
          showViews();
          hud.relayout();
        },
      };
      back.addEventListener('click', entry.dismiss);
      card = entry;
      cardView.scrollTop = 0;
      showViews();
      if (!open()) self.setSnap('half');
      hud.relayout();
      return entry.dismiss;
    },
    insets(m) {
      const top = touchTop(m) + 6;
      if (m.shell === 'side') {
        const right = (open() ? sideWidth(m) : TOUCH.sideGrip) + m.safeArea.right;
        return { left: m.safeArea.left, right, top, bottom: TOUCH.navH + m.safeArea.bottom + TOUCH.edge };
      }
      const g = geo ?? sheetGeometry(m, 26, true);
      // `full` is for reading: the scene keeps the framing of `half` behind it
      return { left: 0, right: 0, top, bottom: Math.min(g[snap], g.half) };
    },
  };

  /* ------------------------------------------------------------------------------------ dragging */

  let from = 0;
  let velocity = 0;
  let lastAt = 0;
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  sheetDrag(el, [grip, sideGrip, head], {
    axis: () => (mode === 'sheet' ? 'y' : 'x'),
    start() {
      if (!geo || !metrics) return;
      anim?.kill();
      anim = null;
      moving = true;
      from = pos.v;
      velocity = 0;
      lastAt = performance.now();
      setClass(el, 'dragging', true);
      showViews();
      // whatever the drag can reveal is laid out up front; nothing is laid out while the finger moves
      fit('full');
    },
    move(dx, dy) {
      if (!geo || !metrics) return;
      const now = performance.now();
      const dt = Math.max((now - lastAt) / 1000, 1 / 240);
      lastAt = now;
      const next =
        mode === 'sheet'
          ? clamp(from - dy / k(), geo.peek - 18, geo.full + 12)
          : clamp(from - dx / k(), TOUCH.sideGrip, sideWidth(metrics));
      velocity = velocity * 0.6 + ((next - pos.v) / dt) * 0.4;
      pos.v = next;
      place();
    },
    end() {
      if (!geo || !metrics) return;
      setClass(el, 'dragging', false);
      const v = performance.now() - lastAt > 90 ? 0 : velocity; // the finger rested before lifting
      if (mode === 'sheet') self.setSnap(settleSnap(pos.v, v, geo));
      else self.setSnap(pos.v + v * 0.18 > sideWidth(metrics) / 2 ? 'half' : 'peek');
    },
  });
  // taps (F5): the grip toggles peek ↔ half (full → half); a tap on the head of a collapsed sheet opens it
  const toggle = (): void => {
    if (mode === 'side') self.setSnap(open() ? 'peek' : 'half');
    else self.setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'peek' : 'half');
  };
  grip.addEventListener('click', toggle);
  sideGrip.addEventListener('click', toggle);
  head.addEventListener('click', (e) => {
    if (!open() && !(e.target instanceof Element && e.target.closest('button'))) self.setSnap('half');
  });
  return self;
}
