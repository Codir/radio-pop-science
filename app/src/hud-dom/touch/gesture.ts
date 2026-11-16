/**
 * The sheet's own drag (F5 rules, docs/MOBILE.md §3 "Touch"), on DOM events. A finger that lands on the sheet is a
 * tap until it travels more than 9 px; then the gesture is decided once:
 *
 *   - along the sheet's axis (vertical for the bottom sheet, horizontal for the side sheet) on a part that does not
 *     scroll — grip, head, a view with nothing to scroll — it moves the sheet;
 *   - in a view that scrolls, a downward drag moves the sheet only while the view is scrolled to its top (the one
 *     gesture rule kept in JS); otherwise the browser scrolls the view natively (momentum, `overscroll-behavior`);
 *   - a slider or another control that takes drags keeps the gesture.
 *
 * Touch input uses touch events: a `touchmove` is still cancelable when the decision falls, so the sheet can take a
 * gesture away from the view's native scroll. A mouse (desktop emulation `?ff=phone`) drags grip and head through
 * pointer events. Scene drags start on the canvas and never reach the sheet.
 */

/** What a decided drag reports: total travel since the press, CSS px (down / right positive). */
export interface DragHandlers {
  /** The sheet's axis: `y` for the bottom sheet, `x` for the side sheet. */
  axis(): 'x' | 'y';
  start(): void;
  move(dx: number, dy: number): void;
  end(): void;
}

/** Controls that take a drag themselves (sliders, custom widgets, charts with a scrub). */
const OWN_DRAG = 'input[type="range"], [role="slider"], [data-drag], .kd-chart-frame.scrub, .kd-chart-frame.pick';
/** Travel (CSS px) under which a press stays a tap (F5). */
export const TAP_SLOP = 9;

/** The nearest element between `el` and `stop` that can scroll vertically right now. */
function scroller(el: Element | null, stop: Element): HTMLElement | null {
  for (let p = el; p && p !== stop; p = p.parentElement) {
    if (!(p instanceof HTMLElement) || p.scrollHeight <= p.clientHeight + 1) continue;
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

/** Install the drag on `sheet`; `handle` = the parts (grip, head) a mouse may drag too. */
export function sheetDrag(sheet: HTMLElement, handle: readonly HTMLElement[], on: DragHandlers): void {
  let x0 = 0;
  let y0 = 0;
  let id = -1;
  let state: 'press' | 'sheet' | 'native' = 'native';
  let view: HTMLElement | null = null;
  let own = false;

  const decide = (dx: number, dy: number): typeof state => {
    if (own) return 'native';
    const vertical = Math.abs(dy) >= Math.abs(dx);
    if (on.axis() === 'x') return !vertical ? 'sheet' : view ? 'native' : 'sheet';
    if (!vertical) return 'native';
    if (!view) return 'sheet';
    // a view scrolled to its top gives a downward drag to the sheet
    return dy > 0 && view.scrollTop <= 0 ? 'sheet' : 'native';
  };

  sheet.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        if (state === 'sheet') on.end();
        state = 'native';
        return;
      }
      const t = e.touches[0]!;
      id = t.identifier;
      x0 = t.clientX;
      y0 = t.clientY;
      const target = e.target instanceof Element ? e.target : null;
      own = !!target?.closest(OWN_DRAG);
      view = scroller(target, sheet);
      state = 'press';
    },
    { passive: true },
  );
  sheet.addEventListener(
    'touchmove',
    (e) => {
      const t = [...e.changedTouches].find((c) => c.identifier === id);
      if (!t || state === 'native') return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (state === 'press') {
        if (Math.hypot(dx, dy) <= TAP_SLOP) return;
        // the browser started its own pan already: it keeps the gesture
        state = e.cancelable ? decide(dx, dy) : 'native';
        if (state !== 'sheet') return;
        on.start();
      }
      if (e.cancelable) e.preventDefault();
      on.move(dx, dy);
    },
    { passive: false },
  );
  const finish = (e: TouchEvent): void => {
    if (![...e.changedTouches].some((c) => c.identifier === id)) return;
    if (state === 'sheet') {
      // no click after a drag
      if (e.cancelable) e.preventDefault();
      on.end();
    }
    state = 'native';
  };
  sheet.addEventListener('touchend', finish, { passive: false });
  sheet.addEventListener('touchcancel', finish);

  // mouse / pen: grip and head only (a mouse scrolls the views with its wheel)
  for (const el of handle) {
    let pid = -1;
    let moved = false;
    /** The click that follows a mouse drag must not toggle the sheet. */
    let quiet = 0;
    el.addEventListener('click', (c) => performance.now() < quiet && c.stopImmediatePropagation(), { capture: true });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      pid = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      moved = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!moved) {
        if (Math.hypot(dx, dy) <= TAP_SLOP) return;
        moved = true;
        el.setPointerCapture(pid);
        on.start();
      }
      on.move(dx, dy);
    });
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return;
      pid = -1;
      if (!moved) return;
      quiet = performance.now() + 300;
      on.end();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
}
