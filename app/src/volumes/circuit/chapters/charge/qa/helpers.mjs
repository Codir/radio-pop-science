/* global window, document */
// Playwright helpers of the chapter's QA scripts (production hooks only; positions in CSS px from
// `__ui.locate` / `__app.locate`, so one script serves every size). Runs on the frozen engine clock (`?freeze`).

/** Advance the frozen engine clock by `seconds`, then a few single frames so HUD fades settle. */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
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
