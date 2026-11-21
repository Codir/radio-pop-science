/**
 * The speaker of the bench (docs/volumes/electronics/VISUAL.md §4.1), seen from above as the bench's shots see it: the
 * cone is an open bowl whose faces look up (no flat lid over it), a little lighter than `ink`, with the dust cap standing
 * in its middle; the coral dot by the plus lug lies on the rim outside the surround; «8 Ω» lies flat on the rim on the
 * reader's side, outside the surround. Vertices and their baked colours only, no WebGL.
 */
import { Vector3, type BufferGeometry, type Color, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { col } from '@/style';
import { SPEAKER, createSpeaker } from '..';
import { mix } from '../part';

interface Vertex {
  readonly p: Vector3;
  readonly n: Vector3;
}

/** Every vertex of the speaker's meshes (its own frame) whose baked colour is `c`, with its normal. */
function coloured(c: Color): Vertex[] {
  const speaker = createSpeaker();
  speaker.group.updateMatrixWorld(true);
  const out: Vertex[] = [];
  speaker.group.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const g = (o as Mesh).geometry as BufferGeometry;
    const colour = g.getAttribute('color');
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    if (!colour || !nor) return;
    for (let i = 0; i < colour.count; i++) {
      const d = Math.max(
        Math.abs(colour.getX(i) - c.r),
        Math.abs(colour.getY(i) - c.g),
        Math.abs(colour.getZ(i) - c.b),
      );
      if (d > 1e-5) continue;
      out.push({
        p: new Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld),
        n: new Vector3().fromBufferAttribute(nor, i).transformDirection(o.matrixWorld),
      });
    }
  });
  return out;
}

const radius = (v: Vector3) => Math.hypot(v.x, v.z);
/** Where the rim shows outside the surround's ring: from the ring's outer edge to the frame's edge. */
const band = () => [SPEAKER.surround.r + SPEAKER.surround.tube, SPEAKER.radius] as const;

describe('the speaker from above (VISUAL §4.1)', () => {
  it('has a cone that is an open bowl facing up, lighter than ink, under the rim and deepest in its middle', () => {
    const cone = coloured(mix('ink', 'slate', 0.3));
    expect(cone.length).toBeGreaterThan(0);
    for (const { p, n } of cone) {
      expect(n.y, `normal at (${p.x.toFixed(3)}; ${p.y.toFixed(3)}; ${p.z.toFixed(3)})`).toBeGreaterThan(0.5);
      expect(p.y).toBeLessThanOrEqual(SPEAKER.rim + 1e-6);
    }
    const middle = Math.max(...cone.filter((v) => radius(v.p) < 0.1).map((v) => v.p.y));
    const edge = Math.max(...cone.map((v) => v.p.y));
    expect(edge - middle).toBeGreaterThan(0.08);
    // the dust cap stands in the middle of the bowl, above the cone's floor
    const cap = coloured(col('ink')).filter((v) => radius(v.p) < SPEAKER.radius * 0.25 && v.p.y > 0.2);
    expect(cap.length).toBeGreaterThan(0);
    expect(Math.max(...cap.map((v) => v.p.y))).toBeGreaterThan(middle + 0.04);
  });

  it('puts the coral dot by the plus lug on the rim, outside the surround', () => {
    const dot = coloured(col('coral'));
    expect(dot.length).toBeGreaterThan(0);
    const [inner, outer] = band();
    for (const { p } of dot) {
      expect(radius(p)).toBeGreaterThan(inner);
      expect(radius(p)).toBeLessThan(outer);
      expect(p.y).toBeGreaterThanOrEqual(SPEAKER.rim - 1e-6);
    }
    // beside the plus lug: on the board's side (−x), toward the reader (+z)
    const s = createSpeaker();
    expect(s.plusAt.x).toBeLessThan(0);
    expect(s.plusAt.z).toBeGreaterThan(0.14);
  });

  it('prints «8 Ω» flat on the rim on the reader’s side, outside the surround', () => {
    const s = createSpeaker();
    const [inner, outer] = band();
    expect(s.printAt.z).toBeGreaterThan(inner);
    expect(s.printAt.z).toBeLessThan(outer);
    expect(s.printAt.x).toBeCloseTo(0, 9);
    expect(s.printAt.y).toBeGreaterThan(SPEAKER.rim);
    expect(s.printAt.y).toBeLessThan(SPEAKER.rim + 0.01);
    // the rim is wide enough there for the print's em
    expect(outer - inner).toBeGreaterThan(SPEAKER.printSize * 0.8);
  });
});
