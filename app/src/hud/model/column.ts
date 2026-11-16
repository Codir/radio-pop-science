/**
 * Height budget of the step column (UI_API §3.1) — shared by the WebGL column (`hud/dock.ts`) and the DOM
 * column (`hud-dom/dock`). Pure: the views measure, this decides. All sizes in HUD units.
 *
 * The step panel (title, chips, scrolling text, page bar) and the dock (scrolling controls + sticky action row)
 * share the height under the header. Order of yielding (UI_API §3.1): the text scrolls, down to `TEXT_MIN`;
 * then the title takes the compact size; then the dock's controls scroll inside the dock. The action row, the
 * page bar and the title never leave the screen.
 */

/** Least height of the step text when the dock needs room (≈ 4 lines of body text), units. */
export const TEXT_MIN = 130;
/** Least height of the dock's scrolling controls before the title gets compact, units. */
export const DOCK_MIN = 150;
/** Gap between the panel and the dock, units. */
export const COLUMN_GAP = 12;
/** The scrolling parts never get less than this, units (a sliver that still shows it scrolls). */
const FLOOR = 60;

export interface ColumnSizes {
  /** Height the column may take, units. */
  available: number;
  /** The step panel is shown (narrow layouts show either the text or the controls). */
  withText: boolean;
  /** The dock is shown (the step declares controls). */
  withDock: boolean;
  /** Panel height without its scrolling text, title at full size. */
  chrome: number;
  /** Height the step text would take unclipped. */
  textWant: number;
  /** Dock height without its scrolling controls (padding, gaps, action row). */
  dockChrome: number;
  /** Height the dock's controls would take unclipped. */
  bodyWant: number;
}

export interface ColumnBudget {
  /** The title takes the compact size. */
  compact: boolean;
  /** Most height of the step text (null: the panel is not shown). */
  text: number | null;
  /** Most height of the dock's scrolling controls (null: no dock). */
  body: number | null;
}

/**
 * Share the column's height. `compactChrome()` is asked only when the compact title is needed (the views measure
 * it by switching the title). `compactFirst` reproduces the WebGL column's order (the title compacts as soon as
 * anything has to yield, then the text scrolls); the DOM column follows UI_API §3.1 (text first).
 */
export function columnBudget(
  s: ColumnSizes,
  compactChrome: () => number,
  opts: { compactFirst?: boolean } = {},
): ColumnBudget {
  if (!s.withDock) return { compact: false, text: s.withText ? s.available - s.chrome : null, body: null };
  if (!s.withText) return { compact: false, text: null, body: Math.max(s.available - s.dockChrome, FLOOR) };
  const spaceFor = (chrome: number): number => s.available - chrome - COLUMN_GAP - s.dockChrome;
  const least = Math.min(TEXT_MIN, s.textWant);
  const share = (space: number): { text: number; body: number } => {
    const text = Math.min(s.textWant, Math.max(least, space - s.bodyWant));
    return { text, body: Math.max(space - text, FLOOR) };
  };
  let space = spaceFor(s.chrome);
  const fits = s.textWant + s.bodyWant <= space;
  // UI_API order: the text alone may give room as long as it stays above TEXT_MIN
  const textEnough = space - s.bodyWant >= least;
  if (fits || (!opts.compactFirst && textEnough)) return { compact: false, ...share(space) };
  space = spaceFor(compactChrome());
  return { compact: true, ...share(space) };
}
