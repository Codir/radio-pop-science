import type { Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BULB, createBulb } from '../bulb';
import { FINE_COIL, finePath, lampPathLocal, leadOut } from '../bulb-close';
import { thermalShade } from '../bulb-thermal';
import { ROOM_C, WORK_C } from '../bulb-heat';

describe('the lamp close up (VISUAL §5.3)', () => {
  it('the fine coil is a real helix: ≥ 12 turns of a wire much thinner than the coil', () => {
    expect(FINE_COIL.turns).toBeGreaterThanOrEqual(12);
    expect(FINE_COIL.wire * 2).toBeLessThan(FINE_COIL.radius * 0.5);
    const axis = finePath(BULB, false);
    const helix = finePath(BULB, true);
    // the spiral is many times longer than its axis
    const len = (p: Vector3[]): number => p.reduce((s, q, i) => (i ? s + q.distanceTo(p[i - 1]!) : 0), 0);
    expect(len(helix)).toBeGreaterThan(4 * len(axis));
  });

  it('the current’s way runs contact → lead → coil → lead → thread, in order, ending at the solder drop', () => {
    const { points, marks } = lampPathLocal(BULB);
    expect(points[0]!.length()).toBe(0); // the bottom contact (origin of the bulb)
    expect(points[points.length - 1]!.distanceTo(leadOut(BULB).solder)).toBeLessThan(1e-9);
    const order = [marks.contact, marks.leadIn, marks.coilStart, marks.coilEnd, marks.leadOut, marks.thread];
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    // the coil part lies at the filament's height
    const mid = points[Math.round(points.length * ((marks.coilStart + marks.coilEnd) / 2))]!;
    expect(Math.abs(mid.y - BULB.filamentY)).toBeLessThan(0.1);
  });

  it('keeps today’s lamp until the camera comes close (detail 0: coarse coil only)', () => {
    const bulb = createBulb();
    const fine = bulb.group.getObjectByName('bulb:fine-coil') as Mesh;
    const leads = bulb.group.getObjectByName('bulb:leads')!;
    expect(fine.visible).toBe(false);
    expect(leads.visible).toBe(false);
    expect(bulb.coil.visible).toBe(true);
    bulb.close.setDetail(1);
    expect(fine.visible).toBe(true);
    expect(bulb.coil.visible).toBe(false);
  });

  it('anchors sit on the lamp: contact low, coil high, thread at the collar', () => {
    const { anchors } = createBulb().close;
    expect(anchors.contact.position.y).toBeLessThan(0.1);
    expect(anchors.coil.position.y).toBeCloseTo(BULB.filamentY + 0.02, 6);
    expect(Math.abs(anchors.thread.position.y - BULB.thread)).toBeLessThan(0.05);
  });

  it('the cut adds no clipping until it is used', () => {
    const bulb = createBulb();
    const metal = (bulb.group.getObjectByName('bulb:metal') as Mesh | undefined)?.material as
      { clippingPlanes: unknown } | undefined;
    if (metal) expect(metal.clippingPlanes ?? null).toBeNull();
    bulb.close.setCut(1);
    if (metal) expect(Array.isArray(metal.clippingPlanes)).toBe(true);
  });
});

describe('heat view shades', () => {
  it('room temperature is the cold end, the working coil the hot end, monotone between', () => {
    expect(thermalShade(ROOM_C)).toBe(0);
    expect(thermalShade(WORK_C)).toBeCloseTo(1, 9);
    expect(thermalShade(300)).toBeGreaterThan(0.4); // a lead at a few hundred degrees already reads warm
    let last = -1;
    for (let c = ROOM_C; c <= WORK_C; c += 50) {
      expect(thermalShade(c)).toBeGreaterThanOrEqual(last);
      last = thermalShade(c);
    }
  });
});
