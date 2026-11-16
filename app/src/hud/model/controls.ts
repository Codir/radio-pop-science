/**
 * Control grouping and order of the step UI (UI_API §3, §3.2) — shared by the WebGL dock (`hud/dock-build.ts`)
 * and the DOM dock (`hud-dom/dock`). Pure: it decides *where* each control goes, the views build the widgets.
 *
 * Dock: sliders first, toggles in one row, blocks (segmented, tables, notes, charts, linear gauges, custom) full
 * width, readouts and radial gauges in one row, buttons to the sticky action row.
 * Board: the declared order, consecutive readouts / toggles share a row, buttons last.
 */
import type { ControlSpec } from '../step-ui-types';

/** Where a control goes in a dock or board. */
export type ControlSlot = 'slider' | 'toggle' | 'block' | 'readout' | 'action';

export function slotOf(c: ControlSpec): ControlSlot {
  switch (c.type) {
    case 'slider':
      return 'slider';
    case 'toggle':
      return 'toggle';
    case 'button':
      return 'action';
    case 'readout':
      return 'readout';
    case 'gauge':
      return c.kind === 'linear' ? 'block' : 'readout';
    default:
      return 'block';
  }
}

/**
 * One entry of the body, top to bottom: a single control, or a wrapping row — `toggles` (gap 18) or `readouts`
 * (gap 22, aligned to the bottom; on a board consecutive toggles join it too).
 */
export type ControlGroup<T> = { kind: 'one'; item: T } | { kind: 'toggles' | 'readouts'; items: T[] };

export interface ControlLayout<T> {
  body: ControlGroup<T>[];
  /** Buttons: the dock's sticky action row; on the board the row after the body. */
  actions: T[];
}

/** Arrange built items (each with its slot) for the dock or the board. */
export function arrangeControls<T>(
  items: readonly { slot: ControlSlot; item: T }[],
  where: 'dock' | 'board',
): ControlLayout<T> {
  const actions: T[] = [];
  if (where === 'board') {
    const body: ControlGroup<T>[] = [];
    let row: T[] | null = null;
    for (const { slot, item } of items) {
      if (slot === 'readout' || slot === 'toggle') {
        if (!row) body.push({ kind: 'readouts', items: (row = []) });
        row.push(item);
        continue;
      }
      row = null;
      if (slot === 'action') actions.push(item);
      else body.push({ kind: 'one', item });
    }
    return { body, actions };
  }
  const by = (s: ControlSlot): T[] => items.filter((i) => i.slot === s).map((i) => i.item);
  const toggles = by('toggle');
  const readouts = by('readout');
  const body: ControlGroup<T>[] = by('slider').map((item) => ({ kind: 'one', item }));
  if (toggles.length) body.push({ kind: 'toggles', items: toggles });
  body.push(...by('block').map((item): ControlGroup<T> => ({ kind: 'one', item })));
  if (readouts.length) body.push({ kind: 'readouts', items: readouts });
  return { body, actions: by('action') };
}
