/* global document */
// Shared by chapters' QA scripts (F-narrow-nav; first written for chapters/prologue/qa/helpers.mjs).

/**
 * In a narrow desktop window (portrait / narrow layout) the step column is a bottom sheet where «Опис» (`text`)
 * and «Керування» (`controls`) share the space through tabs (hud-dom/dock/column.ts): pick one as a reader would,
 * by a click on it. A no-op where there are no tabs (wide layouts: text and controls are on screen together).
 * `settle(page)` runs after the click (the chapter's frozen-clock advance). Returns whether a tab was clicked.
 */
export async function sheetTab(page, id, settle) {
  const tab = await page.evaluate((t) => {
    const el = document.querySelector(`[data-ui="sheet-tabs:${t}"]`);
    if (!el || el.closest("[hidden]")) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      on: el.getAttribute("aria-selected") === "true",
    };
  }, id);
  if (!tab || tab.on) return false;
  await page.mouse.click(tab.x, tab.y);
  await settle(page);
  return true;
}
