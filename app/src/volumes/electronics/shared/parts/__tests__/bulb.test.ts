/**
 * The bench's lamp (VISUAL §4.1), copied with `circuit/shared/stage/__tests__/bulb.test.ts` (shared/README.md,
 * «Копії»): the glass's depth shell, the closed crown, the neck inside the collar — and the bench's own: the glass has
 * the radius of `LAMP.glass`, its middle is at `LAMP.glassY` and the thread fits the post's socket.
 */
import { Box3, Vector3, type Mesh, type MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { LAMP } from '../../bench/layout';
import { BULB, BULB_BOTTOM, BULB_SCALE, createBulb } from '../bulb';

describe('the lamp glass (circuit, owner 2026-11-17: the globe edge on light and dark ground)', () => {
  const bulb = createBulb();
  const shell = bulb.glass.getObjectByName('bulb:glass-depth') as Mesh;

  it('has an invisible depth shell, so depth of field focuses the glass, not the room behind it', () => {
    expect(shell).toBeDefined();
    const m = shell.material as MeshBasicMaterial;
    expect(m.colorWrite).toBe(false);
    expect(m.depthWrite).toBe(true);
    expect(m.transparent).toBe(true);
    // after every other transparent object of a frame (the environment's motes are drawn at 1002)
    expect(shell.renderOrder).toBeGreaterThan(1002);
    expect(shell.castShadow).toBe(false);
  });

  it('the globe is closed at its crown (no hole at the top of the glass)', () => {
    const box = new Box3().setFromBufferAttribute(bulb.glass.geometry.getAttribute('position') as never);
    expect(box.max.y).toBeCloseTo(BULB.globeY + BULB.globe, 6);
  });

  it('the neck starts inside the brass collar (no flat disc of glass or brass over the thread)', () => {
    const box = new Box3().setFromBufferAttribute(bulb.glass.geometry.getAttribute('position') as never);
    expect(box.min.y).toBeLessThan(BULB.thread);
  });
});

describe('the bench’s lamp: the circuit’s bulb made smaller', () => {
  it('has the glass of VISUAL §2 (radius 0.38, its middle 1.2 above the face) and a thread that fits the socket', () => {
    expect(BULB.globe * BULB_SCALE).toBeCloseTo(LAMP.glass, 9);
    expect(BULB_BOTTOM + BULB.globeY * BULB_SCALE).toBeCloseTo(LAMP.glassY, 9);
    // the post's socket: a hole of radius 0.15 down to 0.17 below its top (`bench/mounts.ts`)
    expect(BULB.threadRadius * BULB_SCALE).toBeLessThan(0.15);
    expect(BULB_BOTTOM).toBeGreaterThan(LAMP.socketY - 0.17);
    expect(BULB_BOTTOM + BULB.thread * BULB_SCALE).toBeGreaterThan(LAMP.socketY);
  });

  it('is cold and dark until the bench gives it a glow, and the filament sits in the glass', () => {
    const bulb = createBulb();
    expect(bulb.group.getObjectByName('bulb:glare')!.visible).toBe(false);
    bulb.group.updateMatrixWorld(true);
    const glass = new Box3().setFromObject(bulb.glass);
    const filament = bulb.filament.getWorldPosition(new Vector3());
    expect(glass.containsPoint(filament)).toBe(true);
  });
});
