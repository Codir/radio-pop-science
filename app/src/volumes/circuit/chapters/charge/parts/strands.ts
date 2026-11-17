/**
 * Many thin tapered tubes in ONE geometry whose points move every frame — the figure's hair. Each strand is a
 * polyline of `points` points with a ring of `RADIAL` vertices around each; the caller writes the points
 * (`set(strand, k, p)`) and calls `commit()`, which rebuilds positions and normals in place (one draw call).
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

const RADIAL = 6;

export class Strands {
  readonly geometry = new BufferGeometry();
  private readonly pts: Float32Array;
  private readonly position: BufferAttribute;
  private readonly normal: BufferAttribute;

  constructor(
    readonly count: number,
    readonly points: number,
    /** Radius at the root; the tip is `tip` × that. */
    private readonly radius: number,
    private readonly tip = 0.25,
  ) {
    this.pts = new Float32Array(count * points * 3);
    const verts = count * points * RADIAL;
    this.position = new BufferAttribute(new Float32Array(verts * 3), 3);
    this.normal = new BufferAttribute(new Float32Array(verts * 3), 3);
    const index: number[] = [];
    for (let s = 0; s < count; s++)
      for (let k = 0; k < points - 1; k++)
        for (let r = 0; r < RADIAL; r++) {
          const a = (s * points + k) * RADIAL + r;
          const b = (s * points + k) * RADIAL + ((r + 1) % RADIAL);
          index.push(a, a + RADIAL, b, b, a + RADIAL, b + RADIAL);
        }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('normal', this.normal);
  }

  set(strand: number, k: number, p: Vector3): void {
    this.pts.set([p.x, p.y, p.z], (strand * this.points + k) * 3);
  }

  commit(): void {
    const { pts, points, count } = this;
    const pos = this.position.array as Float32Array;
    const nor = this.normal.array as Float32Array;
    const t = new Vector3();
    const n = new Vector3();
    const b = new Vector3();
    const ref = new Vector3();
    for (let s = 0; s < count; s++) {
      const o = s * points * 3;
      // a stable reference across the strand: perpendicular to its overall direction
      t.set(pts[o + (points - 1) * 3]! - pts[o]!, pts[o + (points - 1) * 3 + 1]! - pts[o + 1]!, 0);
      t.z = pts[o + (points - 1) * 3 + 2]! - pts[o + 2]!;
      ref.set(0, 1, 0);
      if (Math.abs(t.normalize().y) > 0.9) ref.set(1, 0, 0);
      for (let k = 0; k < points; k++) {
        const i = o + k * 3;
        const prev = o + Math.max(k - 1, 0) * 3;
        const next = o + Math.min(k + 1, points - 1) * 3;
        t.set(pts[next]! - pts[prev]!, pts[next + 1]! - pts[prev + 1]!, pts[next + 2]! - pts[prev + 2]!);
        t.normalize();
        n.crossVectors(t, ref).normalize();
        b.crossVectors(t, n);
        const r = this.radius * (1 - (1 - this.tip) * (k / (points - 1)) ** 1.4);
        for (let j = 0; j < RADIAL; j++) {
          const a = (j / RADIAL) * Math.PI * 2;
          const c = Math.cos(a);
          const d = Math.sin(a);
          const nx = n.x * c + b.x * d;
          const ny = n.y * c + b.y * d;
          const nz = n.z * c + b.z * d;
          const v = ((s * points + k) * RADIAL + j) * 3;
          pos[v] = pts[i]! + nx * r;
          pos[v + 1] = pts[i + 1]! + ny * r;
          pos[v + 2] = pts[i + 2]! + nz * r;
          nor[v] = nx;
          nor[v + 1] = ny;
          nor[v + 2] = nz;
        }
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
