/**
 * Area `dock` of the DOM interface (docs/HUD_DOM.md §8, §16): the step column — D2's step panel and the control
 * dock with its sticky action row (`column.ts`) — and the step's board (`../board`), built from the chapter's
 * `stepUi` declaration (`build.ts`). Same semantics as the WebGL column (`hud/dock.ts`), which hands over through
 * `columnBridge`: the DOM column draws the controls and owns the binding's hooks (`ui.set`, `ui.patch`, `ui.press`)
 * on every shell. On touch shells the DOM sheet (`hud-dom/touch`, D7) re-homes the panel, the dock and the board
 * (`domColumnParts`); the column takes them back on the desktop shell.
 */
import { bindingOf, watchBindings, type StepUiBinding } from '@/hud/step-ui';
import type { ControlSpec, DomWidget } from '@/hud/step-ui-types';
import { pathEnd } from '@/hud/path-end';
import { fullChapterId } from '@/engine/api';
import { createDomBoard } from '../board';
import type { DomHud } from '../core/context';
import { h, setClass } from '../core/dom';
import { domHost } from '../custom';
import { uiSounds } from '../chrome/sounds';
import { domStepPanel } from '../step';
import type { DomStepPanel } from '../step/step-panel';
import { bindShown, buildDomControls, type BuiltDom } from './build';
import { createDomColumn } from './column';
import './dock.css';
import './controls/inputs.css';
import './controls/display.css';

/** What the touch sheet (`hud-dom/touch`) hosts on phones and tablets: the column's parts, re-homed. */
export interface ColumnParts {
  readonly panel: DomStepPanel;
  /** `section.dk` (scrolling list + action row) and `aside.bd`. */
  readonly dock: HTMLElement;
  readonly board: HTMLElement;
  /** The step on screen has controls / a board. */
  hasDock(): boolean;
  hasBoard(): boolean;
  /** The controls' measurements of the layout pass (segmented shares): the sheet calls it in its own pass. */
  layoutControls(): void;
  /** Set by the sheet: let go of the parts (the column takes them back on the desktop shell, first in its pass). */
  release: (() => void) | null;
}

let columnParts: ColumnParts | null = null;

/** The column's parts (null before the mount). */
export function domColumnParts(): ColumnParts | null {
  return columnParts;
}

export function mount(dom: DomHud): void {
  const panel = domStepPanel();
  if (!panel) return;
  const { hud, webgl } = dom;
  const host = domHost(dom);
  // the column takes the panel's place in the layer: Tab order header → panel → dock → board → navigator
  const place = document.createComment('step column');
  panel.el.before(place);
  const column = createDomColumn(hud, panel);
  const board = createDomBoard(dom);
  // a visually hidden first stop of the Tab order (HUD_DOM §14): straight to the step's controls
  const skip = h('button.kd-skip', { type: 'button', hidden: true }, 'До керування кроком');
  skip.addEventListener('click', () =>
    column.dock.querySelector<HTMLElement>('input, button, [tabindex="0"]')?.focus(),
  );
  /** Back on the desktop shell: the parts the touch sheet re-homed return to the column, in their order. */
  const home = (): void => {
    columnParts?.release?.();
    if (panel.el.parentElement !== column.el) column.el.append(panel.el, column.dock);
    if (column.el.nextElementSibling !== board.el) column.el.after(board.el);
  };

  let binding: StepUiBinding | null = null;
  let built: BuiltDom | null = null;
  let boardBuilt: BuiltDom | null = null;
  let hasBoard = false;
  let tick: ((t: number) => void)[] = [];
  const customs = new Set<DomWidget>();
  let chapterId = '';
  let stepId = '';
  let time = 0;
  /** The step's dock controls, and whether the dock shows now: it fades away while none of them is `visible`, and
   *  while a chapter's closing card stands in the panel (`pathEnd`). */
  let dockSpecs: readonly ControlSpec[] = [];
  let dockOn = false;
  const anyShown = (): boolean =>
    !pathEnd.shown &&
    dockSpecs.some(
      (c) => c.visible === undefined || (typeof c.visible === 'function' ? c.visible() : c.visible),
    );

  const release = (): void => {
    built?.leave();
    boardBuilt?.leave();
    built = boardBuilt = null;
    if (binding) binding.push = binding.repatch = binding.flash = null;
  };

  function rebuild(instant: boolean): void {
    release();
    binding = bindingOf(chapterId) ?? null;
    const spec = binding?.specs.get(stepId) ?? null;
    if (binding) {
      binding.onScreen.clear();
      const b = binding;
      const opts = { reset: spec?.reset, host, customs, relayout: () => hud.relayout() };
      built = spec ? buildDomControls(b, spec.controls ?? [], { ...opts, where: 'dock' }) : null;
      boardBuilt = spec?.board ? buildDomControls(b, spec.board.children, { ...opts, where: 'board' }) : null;
      const parts = [built, boardBuilt].filter((p): p is BuiltDom => p !== null);
      b.push = (id, v) => parts.forEach((p) => p.push(id, v));
      b.repatch = (id) => parts.forEach((p) => p.repatch(id));
      b.flash = (id) => parts.forEach((p) => p.flash(id));
    }
    column.list.replaceChildren(...(built?.body ?? []));
    column.actions.replaceChildren(...(built?.actions ?? []));
    column.list.parentElement!.hidden = (built?.body.length ?? 0) === 0;
    column.actions.hidden = (built?.actions.length ?? 0) === 0;
    column.list.parentElement!.scrollTop = 0;
    dockSpecs = spec?.controls ?? [];
    const has = (built?.body.length ?? 0) + (built?.actions.length ?? 0) > 0 && anyShown();
    dockOn = has;
    column.setDock(has, instant);
    skip.hidden = !has;
    hasBoard = !!spec?.board;
    board.show(spec?.board ?? null, boardBuilt?.body ?? [], boardBuilt?.actions ?? [], instant);
    const boardWhen = bindShown(board.el, spec?.board?.visible, () => hud.relayout(), 0);
    tick = [...(built?.tick ?? []), ...(boardBuilt?.tick ?? []), ...(boardWhen ? [boardWhen] : [])];
    hud.relayout();
  }

  dom.claim('column');
  dom.layers.chrome.prepend(skip);
  for (const el of [column.dock, board.el]) uiSounds(el);
  dom.region(
    {
      el: column.el,
      onChapter(m) {
        for (const w of customs) w.dispose?.();
        customs.clear();
        chapterId = fullChapterId(m);
        stepId = hud.engine.store.get().stepId ?? m.steps[0]!.id;
        rebuild(true);
      },
      onStep(id, instant) {
        stepId = id;
        rebuild(instant);
      },
      update(dt) {
        time += dt;
        for (const fn of tick) fn(time);
        // every control of the dock hidden (`visible`): the dock itself fades and gives the room back
        const on = (built?.body.length ?? 0) + (built?.actions.length ?? 0) > 0 && anyShown();
        if (on !== dockOn) {
          dockOn = on;
          column.setDock(on, false);
          hud.relayout();
        }
      },
      onLayout(m) {
        const desk = m.shell === 'desk';
        // `columnBridge.domOwns()` is true on every shell: the WebGL column and sheet stay hidden
        webgl.column.visible = false;
        setClass(column.el, 'off', !desk);
        // touch shells: the DOM sheet (`hud-dom/touch`) hosts and lays out the parts (its pass runs after this one)
        if (!desk) return;
        home();
        // the neighbours' boxes (layout pass: reading layout is allowed here)
        const region = (n: string): HTMLElement | null =>
          dom.layers.chrome.querySelector(`[data-region="${n}"]`);
        const header = region('header');
        const nav = region('navigator');
        const headerBottom = header
          ? (header.offsetTop + header.offsetHeight) / m.pxPerUnit
          : m.safeMargin + 58;
        const navigatorTop = nav?.offsetParent ? nav.offsetTop / m.pxPerUnit : m.height;
        const taken = column.layout(m, { headerBottom, navigatorTop }, () => {
          built?.layout();
          boardBuilt?.layout();
        });
        const top = m.layout === 'wide' ? Math.max(headerBottom + 14, m.safeMargin + 58) : headerBottom + 12;
        board.place(m, top, taken + 12);
      },
    },
    { inset: { side: 'auto', extra: 14 }, region: 'column' },
  );
  // `region` appended both at the end of the layer: move them to the panel's old place
  place.replaceWith(column.el);
  column.el.after(board.el);
  watchBindings((id) => {
    if (id === chapterId) rebuild(true);
  });
  columnParts = {
    panel,
    dock: column.dock,
    board: board.el,
    hasDock: () => dockOn,
    hasBoard: () => hasBoard,
    layoutControls() {
      built?.layout();
      boardBuilt?.layout();
    },
    release: null,
  };
}
