/**
 * A tube whose path and cross-section can change every frame — the flashlight's metal strips that become the
 * stand's wires (VISUAL.md §5.1, beat 5: "each strip rounds into a wire; the sheath grows from the clamps").
 * The geometry is allocated once; `update()` rewrites positions and normals in place.
 *
 * The section is an ellipse: half-width `w` across the path (in the plane the path lies in) and half-height `h`
 * along the reference normal — a flat strip is w ≫ h, a wire is w = h.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

/** Resample a polyline to `n` points, uniform in arc length. */
export function resample(points: readonly Vector3[], n: number, out: Vector3[] = []): Vector3[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
  const total = lengths[lengths.length - 1]!;
  let k = 1;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * total;
    while (k < points.length - 1 && lengths[k]! < d) k++;
    const span = lengths[k]! - lengths[k - 1]! || 1;
    const p = (out[i] ??= new Vector3());
    p.copy(points[k - 1]!).lerp(points[k]!, Math.min(Math.max((d - lengths[k - 1]!) / span, 0), 1));
  }
  out.length = n;
  return out;
}

const tangent = new Vector3();
const normal = new Vector3();
const side = new Vector3();

export class DynTube {
  readonly geometry = new BufferGeometry();
  private readonly position: BufferAttribute;
  private readonly normals: BufferAttribute;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;

  /** `rings` points along the path, `radial` segments around the section. */
  constructor(
    readonly rings: number,
    readonly radial: number,
  ) {
    const count = rings * (radial + 1) + 2;
    this.position = new BufferAttribute(new Float32Array(count * 3), 3);
    this.normals = new BufferAttribute(new Float32Array(count * 3), 3);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('normal', this.normals);
    this.setCaps(true, true);
    const cols = radial + 1;
    this.cos = new Float32Array(cols);
    this.sin = new Float32Array(cols);
    for (let j = 0; j < cols; j++) {
      this.cos[j] = Math.cos((j / radial) * Math.PI * 2);
      this.sin[j] = Math.sin((j / radial) * Math.PI * 2);
    }
  }

  private caps = '';
  /**
   * Close the tube's start / end with a flat cap (both by default). An end left open meets another tube end to end
   * with no visible seam (the far wire's two pieces under their staple).
   */
  setCaps(start: boolean, end: boolean): void {
    const key = `${start}${end}`;
    if (key === this.caps) return;
    this.caps = key;
    const { rings, radial } = this;
    const idx: number[] = [];
    const cols = radial + 1;
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * cols + j;
        const b = a + cols;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    // end caps: fans around two centre vertices (the last two)
    const c0 = rings * cols;
    for (let j = 0; j < radial; j++) {
      if (start) idx.push(c0, j, j + 1);
      if (end) idx.push(c0 + 1, (rings - 1) * cols + j + 1, (rings - 1) * cols + j);
    }
    this.geometry.setIndex(idx);
  }

  /**
   * @param path    exactly `rings` points
   * @param up      reference normal of the section's "height" axis (the frame is transported along the path)
   * @param section half-width and half-height at ring `i` (0 collapses the tube there)
   */
  update(path: readonly Vector3[], up: Vector3, section: (i: number, out: [number, number]) => void): void {
    const { rings, radial, position, normals } = this;
    const cols = radial + 1;
    const wh: [number, number] = [0, 0];
    normal.copy(up);
    for (let i = 0; i < rings; i++) {
      const p = path[i]!;
      tangent.copy(path[Math.min(i + 1, rings - 1)]!).sub(path[Math.max(i - 1, 0)]!);
      if (tangent.lengthSq() < 1e-12) tangent.set(1, 0, 0);
      tangent.normalize();
      // transport the normal: remove its component along the tangent; fall back to `up` if it degenerates
      normal.addScaledVector(tangent, -normal.dot(tangent));
      if (normal.lengthSq() < 1e-8) normal.copy(up).addScaledVector(tangent, -up.dot(tangent));
      if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
      normal.normalize();
      side.crossVectors(tangent, normal);
      section(i, wh);
      const [w, h] = wh;
      for (let j = 0; j < cols; j++) {
        const c = this.cos[j]!;
        const s = this.sin[j]!;
        const k = i * cols + j;
        position.setXYZ(
          k,
          p.x + side.x * w * c + normal.x * h * s,
          p.y + side.y * w * c + normal.y * h * s,
          p.z + side.z * w * c + normal.z * h * s,
        );
        // ellipse normal ∝ (c / w, s / h) → scale by w·h to stay finite
        const nx = side.x * h * c + normal.x * w * s;
        const ny = side.y * h * c + normal.y * w * s;
        const nz = side.z * h * c + normal.z * w * s;
        const len = Math.hypot(nx, ny, nz) || 1;
        normals.setXYZ(k, nx / len, ny / len, nz / len);
      }
      if (i === 0 || i === rings - 1) {
        const k = rings * cols + (i === 0 ? 0 : 1);
        position.setXYZ(k, p.x, p.y, p.z);
        const d = i === 0 ? -1 : 1;
        normals.setXYZ(k, tangent.x * d, tangent.y * d, tangent.z * d);
      }
    }
    position.needsUpdate = true;
    normals.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
