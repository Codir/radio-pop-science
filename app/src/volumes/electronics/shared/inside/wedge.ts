/**
 * The cut that opens a part on its place (docs/volumes/electronics/VISUAL.md §7): a wedge of the body taken out on the
 * camera's side, its section faces flat. The mechanics every inner view shares, taken out of E2-8's temporary cutaway
 * (`shared/dive/cutaway.ts`): one number `cut` 0 … 1 opens the part (the door's `cut`), the wedge `width · cut` wide,
 * centred on the camera's side of the body's axis.
 *
 * How: the body's materials (not the legs') clip the wedge — two planes through the axis, each keeping its side, with
 * `clipIntersection`, so only what both remove is gone. Each plane clips a hair (`SLIVER`) into the side it keeps, and
 * a section face stands inside that hair with a material that clips nothing: whatever of the body reaches the plane
 * (the ends of the bands' paint) is cut away behind the face, never seen as a seam in front of it. The planes are set
 * once when the wedge is made and parked far away while it is closed, so opening it compiles no shader.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Matrix3,
  Matrix4,
  Plane,
  Vector3,
  type Color,
  type Material,
  type Mesh,
} from 'three';
import type { PartModel } from '../parts';

/** What the circuit model says of the part, as an inner view shows it (the door reads it from the bench's model). */
export interface InsideState {
  /** The current into the part's first leg (A). */
  readonly amps: number;
  /** Its heat, a share of its limit (`PartMemory.heat`). */
  readonly heat: number;
  readonly burnt: boolean;
}

/** An inner view of a part, opened by the door (`shared/dive/door.ts` holds one per part it leads into). */
export interface Cutaway {
  /** The share open now: 0 whole … 1 opened. */
  readonly amount: number;
  /** Whether the inside is drawn (the wedge is open). */
  readonly open: boolean;
  /**
   * Open the part by `cut` 0 … 1 on the side of `view` (world, unit: from the body toward the camera); every frame,
   * after the part stood on its legs. Below `CLOSED` the part is whole and nothing of the inside is drawn.
   */
  set(cut: number, view: Vector3): void;
  /**
   * Every frame after `set`: what the model says of the part now (null while the model's last solve failed: the view
   * keeps the last good one) and the frame's time. A view that shows nothing of the model has none.
   */
  follow?(state: InsideState | null, dt: number, t: number): void;
  /** What it shows, for the checks (the door's reader). */
  state?(): object;
  /** Gives the part back whole: its materials clip nothing, the inside is gone. */
  dispose(): void;
}

/** Below this share the part is whole: nothing clipped, nothing of the inside drawn. */
export const CLOSED = 0.01;

/** How far each plane clips into the side it keeps, and how far into that hair its section face stands. */
export const SLIVER = 0.002;
export const INSET = 0.001;
/** Where every plane is parked while the part is closed: nothing is ever this far on its removed side. */
const PARKED = 1e6;

/** One flat layer of a section face: a stretch along the axis (`u` from the body's end by leg 0) and two radii. */
export interface Layer {
  u0: number;
  u1: number;
  r0: (u: number) => number;
  r1: (u: number) => number;
  color: Color;
  steps: number;
}

/**
 * A section face in its own frame (x along the axis from −`length` / 2, y the radius, z = `z`), facing +z (`front`) or
 * −z, with a colour per vertex.
 */
export function faceGeometry(layers: readonly Layer[], length: number, z: number, front: boolean): BufferGeometry {
  const pos: number[] = [];
  const colors: number[] = [];
  const half = length / 2;
  const quad = (a: number[], b: number[], c: number[], d: number[], color: Color): void => {
    const tris = front ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of tris) {
      pos.push(p[0]!, p[1]!, z);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (const l of layers) {
    for (let i = 0; i < l.steps; i++) {
      const ua = l.u0 + ((l.u1 - l.u0) * i) / l.steps;
      const ub = l.u0 + ((l.u1 - l.u0) * (i + 1)) / l.steps;
      quad(
        [ua - half, l.r0(ua)],
        [ub - half, l.r0(ub)],
        [ub - half, l.r1(ub)],
        [ua - half, l.r1(ua)],
        l.color,
      );
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  const n = new Float32Array(pos.length);
  for (let i = 2; i < n.length; i += 3) n[i] = front ? 1 : -1;
  g.setAttribute('normal', new BufferAttribute(n, 3));
  g.computeBoundingSphere();
  return g;
}

/** The materials of the body that the wedge clips: everything of the body but its legs, its box and `skip`. */
export function bodyMaterials(model: PartModel, skip: ReadonlySet<object>): Material[] {
  const out = new Set<Material>();
  model.bodyGroup.traverse((o) => {
    if (o === model.legs || o === model.hit || skip.has(o)) return;
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) out.add(x);
  });
  return [...out];
}

const UP = new Vector3(0, 1, 0);

export interface Wedge {
  /** The two planes through the axis (world): the body's materials clip with them. */
  readonly planes: readonly [Plane, Plane];
  /** The share open now, 0 … 1, and whether it is open (≥ `CLOSED`). */
  readonly amount: number;
  readonly open: boolean;
  /** The bounds of the opened wedge, as angles about the body's x from its +y toward its +z: `alpha` ∓ `half`. */
  readonly alpha: number;
  readonly half: number;
  /**
   * Opens the wedge by `cut` 0 … 1 toward `view` (world, from the body toward the camera): the planes set (or parked
   * below `CLOSED`), the angles of the faces' bounds; `axisAt` is a point of the axis in the body frame.
   */
  set(cut: number, view: Vector3): void;
  /** Gives the body's materials back their own clipping. */
  dispose(): void;
}

/**
 * The wedge of a part, `width` (radians) wide at `cut` 1, through the body's axis at `axisY` in its body frame (along
 * its x). The materials of `skip` (the inside's own, which clip by planes of their own) are left alone.
 */
export function createWedge(model: PartModel, width: number, axisY: number, skip: ReadonlySet<object>): Wedge {
  const planes: [Plane, Plane] = [new Plane(), new Plane()];
  const clipped = bodyMaterials(model, skip).map((m) => ({
    m,
    planes: m.clippingPlanes,
    intersection: m.clipIntersection,
  }));
  for (const c of clipped) {
    c.m.clippingPlanes = planes;
    c.m.clipIntersection = true;
  }
  const park = (): void => {
    for (const p of planes) p.set(UP, PARKED);
  };
  park();

  let amount = 0;
  let alpha = Math.PI / 2;
  let half = 0;
  const axisAt = new Vector3();
  const local = new Vector3();
  const n = new Vector3();
  const normals = new Matrix3();
  const inverse = new Matrix4();
  return {
    planes,
    get amount() {
      return amount;
    },
    get open() {
      return amount >= CLOSED;
    },
    get alpha() {
      return alpha;
    },
    get half() {
      return half;
    },
    set(cut, view) {
      amount = Math.min(Math.max(Number.isFinite(cut) ? cut : 0, 0), 1);
      const frame = model.bodyGroup;
      frame.updateWorldMatrix(true, false);
      // the camera's side of the axis, as an angle about the body's x from its +y toward its +z
      local.copy(view).transformDirection(inverse.copy(frame.matrixWorld).invert());
      if (local.y !== 0 || local.z !== 0) alpha = Math.atan2(local.z, local.y);
      half = (width / 2) * amount;
      if (amount < CLOSED) {
        park();
        return;
      }
      const scale = frame.matrixWorld.getMaxScaleOnAxis();
      const b1 = alpha - half;
      const b2 = alpha + half;
      // each plane through the axis keeps the side away from the wedge (a point is clipped where both remove it), and
      // clips a hair into it, where the section face stands
      frame.localToWorld(axisAt.set(0, axisY, 0));
      normals.getNormalMatrix(frame.matrixWorld);
      planes[0].setFromNormalAndCoplanarPoint(
        n.set(0, Math.sin(b1), -Math.cos(b1)).applyMatrix3(normals).normalize(),
        axisAt,
      );
      planes[1].setFromNormalAndCoplanarPoint(
        n.set(0, -Math.sin(b2), Math.cos(b2)).applyMatrix3(normals).normalize(),
        axisAt,
      );
      for (const p of planes) p.constant -= SLIVER * scale;
    },
    dispose() {
      for (const c of clipped) {
        c.m.clippingPlanes = c.planes;
        c.m.clipIntersection = c.intersection;
      }
    },
  };
}
