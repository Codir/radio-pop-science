/* global window, document */
// Playwright helpers of the chapter's QA scripts (production hooks only; positions in CSS px from
// `__ui.locate` / `__app.locate`, so one script serves every size). Runs on the frozen engine clock (`?freeze`).

import { sheetTab as openSheetTab } from '../../../../../../../tools/qa/sheet-tab.mjs';

/** Advance the frozen engine clock by `seconds`, then a few single frames so HUD fades settle. */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** Open a tab of the narrow window's bottom sheet (`text` | `controls`); a no-op where there are none. */
export const sheetTab = (page, id) => openSheetTab(page, id, (p) => advance(p, 0.2));

/**
 * Rectangle { x, y, w, h } (centre + size) of the control `ctl-<id>`; throws when it is not on screen. In a
 * narrow window the controls sit on the sheet's «Керування» tab: it is opened first, as a reader would.
 */
export async function locate(page, id) {
  const find = () => page.evaluate((n) => window.__ui.locate(n), `ctl-${id}`);
  let rect = await find();
  if (!rect && (await sheetTab(page, 'controls'))) rect = await find();
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

/** Click a dock button by id. */
export async function click(page, id) {
  const r = await locate(page, id);
  await page.mouse.click(r.x, r.y);
  await advance(page, 0.2);
}

/** Drag a slider's knob from where it is (`from`, fraction of the track) to the fraction `fx`. */
export async function slide(page, id, fx, from = 0) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18;
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.move(x0 + (x1 - x0) * from, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * fx, y, { steps: 10 });
  await page.mouse.up();
  await advance(page, 0.2);
}

/** Press a slider's thumb at `from` and drag to `to` (track fractions), keeping the button down; returns the release. */
export async function scrub(page, id, from, to) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18;
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.move(x0 + (x1 - x0) * from, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * to, y, { steps: 12 });
  await advance(page, 0.1);
  return async () => {
    await page.mouse.up();
    await advance(page, 0.1);
  };
}

/** Screen point [x, y] of a slider's track at the fraction `fx` (to move a held pointer there). */
export async function thumbAt(page, id, fx) {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  return [x0 + (x1 - x0) * fx, r.y + r.h * 0.18];
}

/** One click on a slider's track at the fraction `fx` (the scene travels there, eased). */
export async function clickTrack(page, id, fx) {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.click(x0 + (x1 - x0) * fx, r.y + r.h * 0.18);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** Click a scene object by its probe (one frame first, so the engine picks what is under the pointer now). */
export async function clickProbe(page, name) {
  const p = await at(page, name);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const q = await at(page, name);
  await page.mouse.click(q.x, q.y);
  await advance(page, 0.2);
}

/**
 * Press on a point { x, y } (CSS px) and drag by (fx, fy) viewport heights, keeping the button down; returns the
 * release function.
 */
export async function dragFrom(page, p, fx, fy, { settle = 0.5 } = {}) {
  const h = page.viewportSize().height;
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  await page.mouse.down();
  await page.mouse.move(p.x + fx * h, p.y + fy * h, { steps: 14 });
  await advance(page, settle);
  return async (after = 0.2) => {
    await page.mouse.up();
    await advance(page, after);
  };
}

/** Is a panel element (CSS selector) on screen (present and not inside a hidden subtree)? */
export const shown = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.closest('[hidden]');
  }, sel);

/** Click a panel element by CSS selector. */
export async function press(page, sel) {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await advance(page, 0.3);
}

/**
 * The lowest y ≤ `y` at column `x` where the scene itself is under the pointer (not the step panel): in a narrow
 * window the bottom sheet covers the lower part of the screen, so a drag must start above it.
 */
export async function sceneY(page, x, y) {
  return page.evaluate(
    ([px, py]) => {
      for (let q = py; q > 0; q -= 8) if (document.elementFromPoint(px, q)?.tagName === 'CANVAS') return q;
      return py;
    },
    [x, y],
  );
}
