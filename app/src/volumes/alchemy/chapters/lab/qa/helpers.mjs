/* global window, document */
// Playwright helpers of the `lab` interaction test (interactions.mjs).
//
// Only hooks that exist in production builds are used, and every position comes from them in CSS px, so one
// script serves 1280×720, 1920×1080 and 3840×2160, under both interfaces (`--hud gl | dom`):
//   HUD controls   `__ui.locate('ctl-<id>')`, segmented items and parts of a custom control `ctl-<id>:<item>`
//   chapter state  `__app.read('lab')`      (the chapter's `ctx.qa.expose`)

/** Run `n` single frames of the frozen engine clock (1/60 s each); each one is rendered. */
export async function frames(page, n = 1) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** Advance the frozen engine clock by `seconds` (QA runs with ?freeze, so nothing moves by itself). */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  // HUD fades ease per *rendered* frame: render a few single frames so they settle in the picture
  await frames(page, 14);
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

/** Click a button by its id, then let `settle` seconds of engine time pass (0: the clock does not move). */
export async function click(page, id, settle = 0.2) {
  const r = await locate(page, id);
  await page.mouse.click(r.x, r.y);
  if (settle > 0) await advance(page, settle);
}

/** Click item `item` of the segmented control `id` (`ctl-<id>:<item>`), or a part of a custom control. */
export async function pick(page, id, item, settle = 0.2) {
  const r = await box(page, `ctl-${id}:${item}`);
  if (!r) throw new Error(`'${id}:${item}' is not on screen`);
  await page.mouse.click(r.x, r.y);
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

/** Open a step of the chapter by deep link (instant) and let the picture settle. */
export async function enter(page, step) {
  await page.evaluate((s) => window.__app.goto(`alchemy/lab/${s}`, undefined, { instant: true }), step);
  await advance(page, 0.5);
}
