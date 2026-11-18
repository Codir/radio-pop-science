/* global window, document */
// Playwright helpers of the `lab` interaction test (interactions.mjs).
//
// Only hooks that exist in production builds are used, and every position comes from them in CSS px, so one
// script serves 1280×720, 1920×1080 and 3840×2160, under both interfaces (`--hud gl | dom`):
//   HUD controls   `__ui.locate('ctl-<id>')`, segmented items and parts of a custom control `ctl-<id>:<item>`
//   chapter state  `__app.read('lab')`      (the chapter's `ctx.qa.expose`)
//   chart cells    `ctl-chart` + `read('lab').chart` (the window and its grid as fractions of the control's box)

/** Frames rendered one by one at the end of every `advance` (HUD fades ease per rendered frame). */
const SETTLE_FRAMES = 14;

/** Run `n` single frames of the frozen engine clock (1/60 s each); each one is rendered. */
export async function frames(page, n = 1) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/**
 * Advance the frozen engine clock by exactly `seconds` (rounded to 1/60 s; QA runs with ?freeze, so nothing
 * moves by itself). The last frames are rendered one by one so the HUD's fades settle in the picture; they are
 * part of `seconds`, not extra time.
 */
export async function advance(page, seconds) {
  const n = Math.round(seconds * 60);
  const bulk = Math.max(0, n - SETTLE_FRAMES);
  if (bulk > 0) await page.evaluate((k) => window.__app.step(1 / 60, k), bulk);
  await frames(page, n - bulk);
}

/** CSS rectangle { x, y, w, h } (centre + size) of a named HUD node, or null when it is not on screen. */
export const box = (page, name) => page.evaluate((n) => window.__ui.locate(n), name);

/** Rectangle of a step control by its step-UI id; throws when it is not on screen. */
export async function locate(page, id) {
  const rect = await box(page, `ctl-${id}`);
  if (!rect) throw new Error(`control '${id}' is not on screen`);
  return rect;
}

/** The control is on screen (shown, not faded out). */
export const shown = async (page, id) => (await box(page, `ctl-${id}`)) !== null;

/** State published by the chapter with `ctx.qa.expose('lab', …)`. */
export const read = (page) => page.evaluate(() => window.__app.read('lab'));

/** Click a button by its id, then let exactly `settle` seconds of engine time pass (0: the clock does not move). */
export async function click(page, id, settle = 0.4) {
  const r = await locate(page, id);
  await page.mouse.click(r.x, r.y);
  if (settle > 0) await advance(page, settle);
}

/**
 * Click item `item` of the segmented control `id` (`ctl-<id>:<item>`), or a part of a custom control, then let
 * exactly `settle` seconds of engine time pass.
 */
export async function pick(page, id, item, settle = 0.4) {
  const r = await box(page, `ctl-${id}:${item}`);
  if (!r) throw new Error(`'${id}:${item}' is not on screen`);
  await page.mouse.click(r.x, r.y);
  if (settle > 0) await advance(page, settle);
}

/**
 * Where the cell of nuclide (z, n) is on screen (CSS px), or null when it is not in the chart's view: the chart
 * is one control (`ctl-chart`), `read('lab').chart` gives the window and its cell grid as fractions of that box.
 */
export async function cellPoint(page, z, n) {
  const { chart } = await read(page);
  const r = await box(page, 'ctl-chart');
  if (!r || !chart.grid) return null;
  const col = n - chart.n0;
  const row = z - chart.z0;
  if (col < 0 || col >= chart.cols || row < 0 || row >= chart.rows) return null;
  const g = chart.grid;
  return {
    x: r.x - r.w / 2 + (g.left + ((col + 0.5) / chart.cols) * g.width) * r.w,
    y: r.y - r.h / 2 + (g.top + ((chart.rows - row - 0.5) / chart.rows) * g.height) * r.h,
  };
}

/** Click the chart's cell of nuclide (z, n), then let exactly `settle` seconds of engine time pass. */
export async function clickCell(page, z, n, settle = 0.4) {
  const p = await cellPoint(page, z, n);
  if (!p) throw new Error(`cell ${z}-${n} is not on the chart`);
  await page.mouse.click(p.x, p.y);
  if (settle > 0) await advance(page, settle);
}

/**
 * The text a control shows. DOM interface: the element's text; WebGL: the labels the HUD reports under the
 * control's name (each cut to 24 characters by `__ui.textSizes`), joined.
 */
export function controlText(page, id) {
  return page.evaluate((name) => {
    const el = document.querySelector(`[data-ui="${name}"]`);
    if (el) return el.textContent ?? '';
    return window.__ui
      .textSizes()
      .filter((t) => t.name === name || t.name.startsWith(`${name}:`) || t.name.startsWith(`${name}>`))
      .map((t) => t.text)
      .join(' ');
  }, `ctl-${id}`);
}

/** Open a step of the chapter by deep link (instant) and let the picture settle (the `?freeze` hold, then 0.5 s). */
export async function enter(page, step) {
  await page.evaluate((s) => window.__app.goto(`alchemy/lab/${s}`, undefined, { instant: true }), step);
  await advance(page, 0.5);
}

/** A piece of interface text starting with `prefix` is on screen (any interface; `__ui.textSizes` cuts at 24). */
export const textShown = (page, prefix) =>
  page.evaluate((p) => window.__ui.textSizes().some((t) => t.text.startsWith(p)), prefix);
