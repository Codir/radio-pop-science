import { describe, expect, it } from 'vitest';
import { fitSegment, SEG } from '../step/nav-fit';

// the measured bar of circuit/wire (6 steps) at 390×844 with a mouse: u 0.7 px, safe 11.7 px, the widest label
// «Далі: наступний розділ» ≈ 140 px, everything else ≈ 110 px — it overflowed with 44-unit segments (F-narrow-nav)
const narrow = {
  steps: 6,
  widthUnits: 557,
  pxPerUnit: 0.7,
  roomPx: 390 - 2 * 11.7,
  fixedPx: 110,
  labelPx: 140,
};

describe('fitSegment', () => {
  it('keeps the WebGL stepper width where the bar fits', () => {
    expect(fitSegment({ ...narrow, widthUnits: 1829, roomPx: 1280 - 43 })).toBe(SEG.max);
    expect(fitSegment({ ...narrow, steps: 40, widthUnits: 2743, roomPx: 1920 - 43 })).toBeCloseTo(
      (2743 * 0.5) / 40,
    );
  });
  it('shrinks the segments so the bar with its widest label fits a narrow window', () => {
    const seg = fitSegment(narrow);
    expect(seg).toBeLessThan(SEG.max);
    expect(narrow.fixedPx + narrow.labelPx + narrow.steps * seg * narrow.pxPerUnit).toBeLessThanOrEqual(
      narrow.roomPx + 1e-9,
    );
  });
  it('never goes below the pointer minimum (the CSS clamp cuts the label then)', () => {
    expect(fitSegment({ ...narrow, steps: 20 })).toBe(SEG.min);
  });
});
