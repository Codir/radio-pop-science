/**
 * Width of one step segment of the DOM step bar (F-narrow-nav). The WebGL stepper shares half the screen among the
 * steps, 22…44 HUD units each; in a narrow window that alone overflowed the viewport once the last step's «Далі:
 * наступний розділ» label widened the bar. The segment therefore also shrinks so that the bar with the chapter's
 * widest label fits the room it is centred in — chosen per chapter and window, not per step, so the dots do not
 * move when the label changes. Below `SEG.min` the CSS clamp (step.css) cuts the label with «…» instead.
 */

/** Segment width bounds in HUD units (the minimum keeps a usable pointer target). */
export const SEG = { min: 22, max: 44 } as const;

export interface SegFit {
  /** Steps in the chapter. */
  steps: number;
  /** Screen width in HUD units. */
  widthUnits: number;
  /** CSS px per HUD unit. */
  pxPerUnit: number;
  /** CSS px the bar may take: the free area minus the safe margins. */
  roomPx: number;
  /** CSS px of everything in the bar but the dots and the «Далі» label (buttons, gaps, padding). */
  fixedPx: number;
  /** CSS px of the widest «Далі» label the chapter shows. */
  labelPx: number;
}

/** Segment width in HUD units. */
export function fitSegment(f: SegFit): number {
  const n = Math.max(f.steps, 1);
  const half = Math.min(SEG.max, Math.max(SEG.min, (f.widthUnits * 0.5) / n));
  const room = (f.roomPx - f.fixedPx - f.labelPx) / Math.max(f.pxPerUnit, 1e-6) / n;
  return Math.max(SEG.min, Math.min(half, room));
}
