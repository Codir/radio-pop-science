import { describe, expect, it } from 'vitest';
import type { HudMetrics } from '@/engine/api';
import { TOUCH, settleSnap, sheetGeometry, sideWidth, touchTop } from '../sheet';

const metrics = (width: number, height: number, safe = { top: 0, right: 0, bottom: 0, left: 0 }): HudMetrics =>
  ({ width, height, safeArea: safe, pxPerUnit: 1 }) as unknown as HudMetrics;

describe('touch sheet geometry (hud/model/sheet.ts)', () => {
  it('orders the snaps and keeps a reading window at half', () => {
    const g = sheetGeometry(metrics(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }), 26, true);
    expect(g.peek).toBeLessThan(g.half);
    expect(g.half).toBeLessThan(g.full);
    expect(g.view.half).toBeGreaterThanOrEqual(TOUCH.halfMinView);
    expect(g.view.peek).toBe(0);
    // full reaches up to the compact header
    expect(g.full).toBe(844 - touchTop(metrics(390, 844, { top: 47, right: 0, bottom: 34, left: 0 })) - 6);
  });

  it('centres a sheet no wider than 620 units on tablets', () => {
    const g = sheetGeometry(metrics(820, 1180), 26, false);
    expect(g.width).toBe(TOUCH.sheetMaxW);
    expect(g.left).toBe((820 - TOUCH.sheetMaxW) / 2);
  });

  it('clamps the side sheet to 320…440 units', () => {
    expect(sideWidth(metrics(600, 360))).toBe(TOUCH.sideMinW);
    expect(sideWidth(metrics(1180, 820))).toBe(TOUCH.sideMaxW);
  });

  it('settles on the nearest snap, a flick on the snap in its direction', () => {
    const g = sheetGeometry(metrics(390, 844), 26, true);
    expect(settleSnap(g.half + 10, 0, g)).toBe('half');
    expect(settleSnap(g.half - 20, -1600, g)).toBe('peek');
    expect(settleSnap(g.half + 20, 1600, g)).toBe('full');
  });
});
