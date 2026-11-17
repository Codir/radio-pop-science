import { Box3, type Mesh, type MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { BULB, createBulb } from '../bulb';

describe('the lamp glass (owner 2026-11-17: the globe edge on light and dark ground)', () => {
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
