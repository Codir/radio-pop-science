import { describe, expect, it } from 'vitest';
import { layoutMarks, markAnchor, type MarkBox, type MarkPlace } from '../mark-layout';

const GAP = 9;

/** No two names on one line closer than the gap; all inside the strip. */
function expectClean(marks: readonly MarkBox[], places: readonly MarkPlace[], width: number): void {
  places.forEach((p, i) => {
    const w = marks[i]?.w ?? 0;
    expect(p.x, `name ${i} left`).toBeGreaterThanOrEqual(-0.01);
    expect(p.x + w, `name ${i} right`).toBeLessThanOrEqual(width + 0.01);
  });
  for (const row of [0, 1] as const) {
    const on = places
      .map((p, i) => ({ x: p.x, w: marks[i]?.w ?? 0, row: p.row }))
      .filter((b) => b.row === row)
      .sort((a, b) => a.x - b.x);
    for (let k = 1; k < on.length; k++) {
      const a = on[k - 1];
      const b = on[k];
      if (a && b) expect(b.x - (a.x + a.w), `gap on line ${row}`).toBeGreaterThanOrEqual(GAP - 0.01);
    }
  }
}

describe('slider mark names (hud-dom/dock/controls/mark-layout.ts)', () => {
  // the prologue's depth slider: «стенд» · «усередині дроту» · «ряди кульок» at 0 · 0.6 · 1
  const dive = (scale: number): MarkBox[] => [
    { t: 0, w: 38 * scale },
    { t: 0.6, w: 104 * scale },
    { t: 1, w: 82 * scale },
  ];

  it('keeps the CSS spots where there is room (desktop look unchanged)', () => {
    const width = 600;
    const marks = dive(1);
    const places = layoutMarks(marks, width, GAP);
    marks.forEach((m, i) => {
      expect(places[i]?.row).toBe(0);
      expect(places[i]?.x).toBeCloseTo(markAnchor(m.t, width) - m.t * m.w, 6);
    });
  });

  it('shifts a name inward when it would touch the end name (phone width)', () => {
    const width = 300;
    const marks = dive(1);
    const places = layoutMarks(marks, width, GAP);
    expect(places.map((p) => p.row)).toEqual([0, 0, 0]);
    expectClean(marks, places, width);
    // the end name stays aligned to the end, the middle one moved left but still stands over its tick
    expect((places[2]?.x ?? 0) + 82).toBeCloseTo(width, 6);
    const mid = places[1]?.x ?? 0;
    expect(mid).toBeLessThan(markAnchor(0.6, width) - 0.6 * 104);
    expect(mid).toBeLessThanOrEqual(markAnchor(0.6, width));
    expect(mid + 104).toBeGreaterThanOrEqual(markAnchor(0.6, width));
  });

  it('drops a name to the second line under its tick when shifting cannot fit it', () => {
    const width = 240;
    const marks: MarkBox[] = [
      { t: 0, w: 38 },
      { t: 0.85, w: 104 },
      { t: 1, w: 82 },
    ];
    const places = layoutMarks(marks, width, GAP);
    expect(places.map((p) => p.row)).toEqual([0, 1, 0]);
    expectClean(marks, places, width);
    const a = markAnchor(0.85, width);
    expect(places[1]?.x ?? 0).toBeLessThanOrEqual(a);
    expect((places[1]?.x ?? 0) + 104).toBeGreaterThanOrEqual(a);
  });

  it('keeps the input order and handles unsorted, single and crowded marks', () => {
    const width = 200;
    const marks: MarkBox[] = [
      { t: 1, w: 50 },
      { t: 0, w: 50 },
      { t: 0.5, w: 50 },
      { t: 0.55, w: 50 },
    ];
    const places = layoutMarks(marks, width, GAP);
    expect(places).toHaveLength(4);
    expect(places[0]?.row).toBe(0);
    expect(places[1]?.row).toBe(0);
    expectClean(marks, places, width);
    expect(layoutMarks([{ t: 0.5, w: 40 }], 100, GAP)).toEqual([{ x: 30, row: 0 }]);
  });
});
