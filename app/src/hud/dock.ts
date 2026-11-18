/**
 * The step column: the step info panel and, under it, the control dock built from the chapter's `stepUi`
 * declaration (plus the optional board, `board.ts`). Wide screens: right column, flat (DECISIONS §59 p). Narrow /
 * portrait: a bottom sheet where «Опис» and «Керування» share the space through a tab switch (STYLE_GUIDE §6).
 *
 * Height budget (UI_API §3.1, `model/column.ts`): the column never leaves the screen. The dock keeps its buttons
 * in a sticky action row at its bottom; when text and controls do not both fit, the title switches to the compact
 * size, then the text scrolls (down to `TEXT_MIN`), then the dock's controls scroll inside the dock.
 */
import { Panel, ScrollView, Tabs, UiNode, conceal, reveal, worldConsoles } from '@/ui3d';
import { fullChapterId, type HudMetrics } from '@/engine/api';
import { createBoard } from './board';
import type { HudContext, HudModule } from './context';
import { bindVisible, buildControls, type BuiltControls } from './dock-build';
import { COLUMN_GAP, columnBudget } from './model/column';
import { PANEL_WIDTH, createStepPanel } from './step-panel';
import { bindingOf, watchBindings, type StepUiBinding } from './step-ui';
import type { StepUiSpec } from './step-ui-types';
import { createTouchSheet, type TouchSheet } from './touch/sheet';

/** Gap between the panel and the dock. */
const GAP = COLUMN_GAP;

/**
 * Hybrid bridge of the DOM interface (`?hud=dom`, docs/HUD_DOM.md §16): while the DOM draws the column (`domOwns`,
 * every shell), this column builds no controls and leaves the binding's hooks to the DOM.
 */
export const columnBridge: { domOwns: () => boolean } = {
  domOwns: () => false,
};

export interface StepColumn extends HudModule {
  /** Called with the step's spec whenever the visible step UI changes (annotations listen). */
  onSpec: ((spec: StepUiSpec | null) => void) | null;
  /** The board module (mounted separately by the plugin for its own inset). */
  readonly board: HudModule;
}

export function createStepColumn(hud: HudContext, popups: UiNode, header: UiNode): StepColumn {
  const panel = createStepPanel(hud, popups);
  const board = createBoard(hud);
  const body = new ScrollView({ name: 'dock-scroll', height: 'hug', gap: 14 });
  const actions = new UiNode({
    name: 'dock-actions',
    dir: 'row',
    wrap: true,
    gap: 10,
    width: 'fill',
    justify: 'end',
  });
  const dock = new Panel({
    name: 'dock',
    width: PANEL_WIDTH,
    gap: 12,
    pad: [18, 22],
    visible: false,
    opacity: 0,
    children: [body, actions],
  });
  const tabs = new Tabs<'text' | 'controls'>({
    name: 'sheet-tabs',
    items: [
      { id: 'text', label: 'Опис' },
      { id: 'controls', label: 'Керування' },
    ],
    visible: false,
    onChange: () => hud.relayout(),
  });
  const node = new UiNode({
    name: 'step-column',
    dir: 'col',
    gap: GAP,
    float: { ax: 1, ay: 0 },
    children: [tabs, panel.node, dock],
  });
  let built: BuiltControls | null = null;
  let boardBuilt: BuiltControls | null = null;
  let tick: ((t: number) => void)[] = [];
  let binding: StepUiBinding | null = null;
  let chapterId = '';
  let stepId = '';
  let time = 0;
  let hintOff: (() => void) | null = null;
  const relayout = (): void => hud.relayout();
  /** Touch shells (phones, tablets): the same views live in a sheet instead of the column (`touch/sheet.ts`). */
  let sheet: TouchSheet | null = null;
  let touch = false;
  let boardHome: UiNode | null = null;
  /** World consoles currently shown in the sheet. */
  let rehomed = 0;

  const self: StepColumn = {
    node,
    onSpec: null,
    board,
    onChapter(m) {
      chapterId = fullChapterId(m);
      stepId = hud.engine.store.get().stepId ?? m.steps[0]!.id;
      panel.onChapter?.(m);
      rebuild(true);
    },
    onContent: (c) => panel.onContent?.(c),
    onStep(id, instant) {
      stepId = id;
      panel.onStep?.(id, instant);
      rebuild(instant);
      if (touch) sheet?.enterStep(instant);
    },
    update(dt) {
      time += dt;
      for (const fn of tick) fn(time);
      if (worldConsoles.size > 0 || rehomed > 0) syncConsoles();
    },
    onLayout(m) {
      // `?hud=dom`: the DOM sheet (`hud-dom/touch`) is the touch shell; this column stays hidden there
      if (m.shell !== 'desk' && !columnBridge.domOwns()) {
        layoutTouch(m);
        return;
      }
      leaveTouch();
      if (m.layout === 'wide') layoutWide(m);
      else layoutSheet(m);
    },
  };

  /**
   * World consoles (`worldConsole()`): on a phone the panel of every console that is shown in the scene moves
   * into the sheet's «Графіки» view; when the step hides the console, or the device stops being a phone, it
   * goes back. Polled every frame — a handful of visibility checks.
   */
  function syncConsoles(): void {
    const phone = touch && hud.metrics.formFactor === 'phone';
    let count = 0;
    for (const c of worldConsoles) {
      let shown = phone && c.surface.parent !== null;
      for (let o: typeof c.surface.parent = c.surface; shown && o; o = o.parent) shown = o.visible;
      if (shown) {
        c.moveTo(board.guests);
        count++;
      } else c.home();
    }
    if (count !== rehomed) {
      rehomed = count;
      board.setGuests(count);
    }
  }

  /** Phones and tablets: hand the views to the touch sheet and let it lay them out. */
  function layoutTouch(m: HudMetrics): void {
    if (!sheet) {
      sheet = createTouchSheet(hud, { panel, dock, dockBody: body, board });
      node.parent?.add(sheet.node);
      hud.touch.insets = (metrics) => sheet!.insets(metrics);
      hud.touch.card = (card, onDismiss, opts) => sheet!.showCard(card, onDismiss, opts);
      hud.touch.sheet = sheet;
    }
    if (!touch) {
      touch = true;
      placeActions();
      boardHome = board.node.parent;
      tabs.visible = false;
      node.visible = false;
      sheet.adopt(true);
    }
    sheet.layout(m, { controls: hasDock(), board: board.active });
  }

  /** Back on a desktop (emulation switched off, a mouse plugged in): the column takes its views back. */
  function leaveTouch(): void {
    if (!touch || !sheet) return;
    touch = false;
    placeActions();
    sheet.adopt(false);
    node.add(panel.node, dock);
    boardHome?.add(board.node);
    node.visible = true;
    panel.node.visible = true;
  }

  /**
   * Desktop: the step's buttons sit in a fixed row under the scrolling controls. Touch shells (F5): they go at
   * the end of the scroll — a half-open sheet has no room for a fixed block of several wrapped buttons.
   */
  function placeActions(): void {
    if (touch) {
      if (actions.parent !== body.content) body.content.add(actions);
    } else if (actions.parent !== dock) dock.add(actions);
  }

  const hasDock = (): boolean => built !== null && built.body.length + built.actions.length > 0;
  /** Lay the surface out now with the constraints set so far (field changes do not invalidate by themselves). */
  const measure = (): void => {
    hud.surface.invalidateLayout();
    hud.surface.flush();
  };

  /** Share `available` units of height between the text panel and the dock (`hud/model/column.ts`). */
  function fitColumn(available: number, width: number, withText: boolean, withDock: boolean): void {
    panel.setCompact(false);
    body.maxH = 4000;
    panel.fit(width, 4000);
    measure();
    const sizes = {
      available,
      withText,
      withDock,
      chrome: withText || !withDock ? panel.chrome() : 0,
      textWant: withText && withDock ? panel.want() : 0,
      dockChrome: withDock ? dock.bh - body.bh : 0,
      bodyWant: withDock ? body.bh : 0,
    };
    // the WebGL column keeps its own order: the title compacts as soon as anything has to yield
    const fit = columnBudget(
      sizes,
      () => {
        panel.setCompact(true);
        measure();
        return panel.chrome();
      },
      { compactFirst: true },
    );
    if (fit.body !== null) body.maxH = fit.body;
    if (fit.text !== null) panel.fit(width, fit.text);
    if (fit.body !== null || fit.text !== null) measure();
  }

  function layoutWide(m: HudMetrics): void {
    const margin = m.safeMargin;
    const top = margin + 58;
    const withDock = hasDock();
    tabs.visible = false;
    panel.node.visible = true;
    dock.visible = withDock;
    dock.width = PANEL_WIDTH;
    node.float = { ax: 1, ay: 0, dx: -margin, dy: top };
    fitColumn(m.height - top - margin, PANEL_WIDTH, true, withDock);
    board.place(m, Math.max(header.by + header.bh + 14, top), 0);
    measure();
  }

  function layoutSheet(m: HudMetrics): void {
    const margin = m.safeMargin;
    const width = Math.min(m.width - margin * 2, 760);
    const bottom = margin + 78; // above the step navigator
    const withDock = hasDock();
    tabs.visible = withDock;
    const showDock = withDock && tabs.value === 'controls';
    panel.node.visible = !showDock;
    dock.visible = showDock;
    dock.width = width;
    tabs.width = Math.min(width, 360);
    node.float = { ax: 0.5, ay: 1, dy: -bottom };
    // the sheet may take up to 42 % of the height (45 % in portrait), never more than the free area under the header
    const headerBottom = header.by + header.bh + 12;
    const share = m.height * (m.layout === 'portrait' ? 0.45 : 0.42);
    const sheet = Math.min(share, m.height - headerBottom - bottom) - (withDock ? 44 + GAP : 0);
    fitColumn(sheet, width, !showDock, showDock);
    board.place(m, headerBottom, bottom + node.bh + 12);
    measure();
  }

  function rebuild(instant: boolean): void {
    hintOff?.();
    hintOff = null;
    // the DOM column draws the controls (and owns the binding's hooks): this column only keeps the step's
    // hint and annotations going
    const own = !columnBridge.domOwns();
    if (binding && own) binding.push = binding.repatch = binding.flash = null;
    binding = bindingOf(chapterId) ?? null;
    if (own) binding?.onScreen.clear();
    const spec = binding?.specs.get(stepId) ?? null;
    built =
      own && binding && spec
        ? buildControls(binding, spec.controls ?? [], { where: 'dock', reset: spec.reset, relayout })
        : null;
    boardBuilt =
      own && binding && spec?.board
        ? buildControls(binding, spec.board.children, { where: 'board', reset: spec.reset, relayout })
        : null;
    const parts = [built, boardBuilt].filter((b): b is BuiltControls => b !== null);
    if (binding && own) {
      binding.push = (id, v) => parts.forEach((b) => b.push(id, v));
      binding.repatch = (id) => parts.forEach((b) => b.repatch(id));
      binding.flash = (id) => parts.forEach((b) => b.flash(id));
    }
    body.content.clear();
    actions.clear();
    for (const n of built?.body ?? []) body.content.add(n);
    for (const n of built?.actions ?? []) actions.add(n);
    actions.visible = (built?.actions.length ?? 0) > 0;
    placeActions();
    // on touch shells the buttons are inside the scroll: keep it when a step has buttons only
    body.visible = (built?.body.length ?? 0) > 0 || (touch && actions.visible);
    body.scrollTo(0, true);
    const has = hasDock();
    if (has) reveal(dock, { instant, dy: -10 });
    else conceal(dock, { instant });
    if (!has) tabs.value = 'text';
    tick = [...(built?.tick ?? []), ...(boardBuilt?.tick ?? [])];
    board.show(own ? (spec?.board ?? null) : null, boardBuilt?.body ?? [], boardBuilt?.actions ?? [], instant);
    const boardWhen = own ? bindVisible(board.node, spec?.board?.visible, relayout, { dy: 0 }) : null;
    if (boardWhen) tick.push(boardWhen);
    if (spec?.hint && !instant) hintOff = hud.toast(spec.hint, { icon: 'hand', duration: 6 });
    self.onSpec?.(spec);
    hud.relayout();
  }

  // a chapter may call `define()` after it became active (async scene code)
  watchBindings((id) => {
    if (id === chapterId) rebuild(true);
  });
  // `?hud=dom` draws the column in the DOM from the first frame — also before `@/hud-dom` has loaded, so a chapter's
  // controls are never built twice (chapter callbacks that cache their last inputs would skip the second); on every
  // shell: the touch shells are the DOM sheet's (D7)
  columnBridge.domOwns = () => hud.engine.flags.hud === 'dom';
  return self;
}
