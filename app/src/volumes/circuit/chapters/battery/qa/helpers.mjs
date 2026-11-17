/* global window, document */
// Playwright helpers of the chapter's QA scripts (production hooks only; positions in CSS px from
// `__ui.locate` / `__app.locate`, so one script serves every size). Runs on the frozen engine clock (`?freeze`).
// Pointer input is a real mouse, or — after `useTouch(page)` — a real finger (`Input.dispatchTouchEvent`, the page
// sees Pointer Events with `pointerType: 'touch'`), one engine frame after every event.

let finger = null;

/** Switch every gesture of these helpers to touch (call once, after the page is open). */
export async function useTouch(page) {
  const cdp = await page.context().newCDPSession(page);
  let at = [0, 0];
  const send = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })),
    });
  finger = {
    async down(x, y) {
      at = [x, y];
      await send('touchStart', [at]);
    },
    async move(x, y) {
      at = [x, y];
      await send('touchMove', [at]);
    },
    async up() {
      await send('touchEnd', []);
    },
  };
}

/** One engine frame (input events are handled on the engine's frame). */
export const frame = (page) => page.evaluate(() => window.__app.step(1 / 60, 1));

/** Advance the frozen engine clock by `seconds`, then a few single frames so interface fades settle. */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  for (let i = 0; i < 10; i++) await frame(page);
}

/** Press, move and release — mouse or finger (`steps` intermediate moves, one engine frame each). */
export async function press(page, x, y) {
  if (finger) await finger.down(x, y);
  else {
    await page.mouse.move(x, y);
    await frame(page);
    await page.mouse.down();
  }
  await frame(page);
}
export async function moveTo(page, from, to, steps = 12) {
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    if (finger) await finger.move(x, y);
    else await page.mouse.move(x, y);
    await frame(page);
  }
}
export async function lift(page) {
  if (finger) await finger.up();
  else await page.mouse.up();
  await frame(page);
}
/** A tap / click at a point. */
export async function tap(page, x, y) {
  await press(page, x, y);
  await lift(page);
  await advance(page, 0.2);
}

/** Rectangle { x, y, w, h } (centre + size) of the control `ctl-<id>`; throws when it is not on screen. */
export async function locate(page, id) {
  const rect = await page.evaluate((n) => window.__ui.locate(n), `ctl-${id}`);
  if (!rect) throw new Error(`control '${id}' is not on screen`);
  return rect;
}

export const read = (page, name) => page.evaluate((n) => window.__app.read(n), name);

/** Screen position { x, y } of a probe (`ctx.qa.probe`). */
export async function at(page, name) {
  const p = await page.evaluate((n) => window.__app.locate(n), name);
  if (!p) throw new Error(`probe '${name}' is unknown`);
  return p;
}

/** Screen point [x, y] of a slider's track at the fraction `fx`. */
export async function thumbAt(page, id, fx) {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  return [x0 + (x1 - x0) * fx, r.y + r.h * 0.18];
}

/** Press a slider's thumb at `from` and drag to `to` (track fractions), still held; returns the release. */
export async function scrub(page, id, from, to, steps = 12) {
  const a = await thumbAt(page, id, from);
  const b = await thumbAt(page, id, to);
  await press(page, ...a);
  await moveTo(page, a, b, steps);
  return async () => {
    await lift(page);
    await advance(page, 0.1);
  };
}

/** Tap a scene object by its probe (hover one frame first, so the engine picks what is under the pointer). */
export async function tapProbe(page, name) {
  const p = await at(page, name);
  if (!finger) {
    await page.mouse.move(p.x, p.y);
    await frame(page);
  }
  const q = await at(page, name);
  await tap(page, q.x, q.y);
}

/** Press on a point { x, y } and drag to { x, y }, still held; returns the release (seconds to advance after). */
export async function dragTo(page, p, q, { steps = 14, settle = 0.3 } = {}) {
  await press(page, p.x, p.y);
  await moveTo(page, [p.x, p.y], [q.x, q.y], steps);
  await advance(page, settle);
  return async (after = 0.2) => {
    await lift(page);
    await advance(page, after);
  };
}

/** Is a panel element (CSS selector) on screen (present and not inside a hidden subtree)? */
export const shown = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.closest('[hidden]');
  }, sel);

/** Click a panel element by CSS selector (the interface itself is not what is tested here). */
export async function pressUi(page, sel) {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await advance(page, 0.3);
}

/** On a narrow window text and controls share a bottom sheet: show this tab (no-op where there are no tabs). */
export async function sheetTab(page, id) {
  const tab = await page.evaluate((t) => {
    const el = document.querySelector(`[data-ui="sheet-tabs:${t}"]`);
    if (!el || el.closest('[hidden]')) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, on: el.getAttribute('aria-selected') === 'true' };
  }, id);
  if (!tab || tab.on) return false;
  await tap(page, tab.x, tab.y);
  return true;
}
