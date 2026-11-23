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
 *
 * The axis of the cut (`WedgeAxis`): the body's x, the axis of an axial part (a resistor) and of a film capacitor's
 * winding; or the body's vertical y through the origin, the axis of a radial can (E4-I). A body that is not round about
 * the axis (a box, an oval roll) or a thing off the axis (a plate, a leg) meets each face at its own distance:
 * `createSection` lays such faces with their radii as functions of the face's angle.
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
  /** A capacitor: the voltage across its capacitance (V, `PartMemory.volts`: its charge over its capacitance, not the
   * voltage between its legs); 0 for any other part. */
  readonly volts: number;
  /** An electrolytic capacitor bulged (`PartMemory.bulged`). */
  readonly bulged: boolean;
}

/** The axis a wedge cuts about: the body's x (at a height), or its vertical y through the origin. */
export type WedgeAxis = 'x' | 'y';

/**
 * The unit direction at angle `theta` about the axis, out from it (body frame): about x from +y toward +z, about y
 * from +z toward +x.
 */
export function radialOf(axis: WedgeAxis, theta: number, out = new Vector3()): Vector3 {
  return axis === 'x' ? out.set(0, Math.cos(theta), Math.sin(theta)) : out.set(Math.sin(theta), 0, Math.cos(theta));
}

/** The unit direction in which `theta` grows there (body frame). */
export function tangentOf(axis: WedgeAxis, theta: number, out = new Vector3()): Vector3 {
  return axis === 'x' ? out.set(0, -Math.sin(theta), Math.cos(theta)) : out.set(Math.cos(theta), 0, -Math.sin(theta));
}

/** The angle about the axis of a direction (body frame), as `radialOf` measures it; null along the axis. */
export function angleOf(axis: WedgeAxis, v: Vector3): number | null {
  if (axis === 'x') return v.y !== 0 || v.z !== 0 ? Math.atan2(v.z, v.y) : null;
  return v.x !== 0 || v.z !== 0 ? Math.atan2(v.x, v.z) : null;
}

/** A point `u` along the axis, `rho` out from it at angle `theta` (body frame; the axis 'x' at height `axisY`). */
export function pointOf(
  axis: WedgeAxis,
  axisY: number,
  u: number,
  rho: number,
  theta: number,
  out = new Vector3(),
): Vector3 {
  radialOf(axis, theta, out).multiplyScalar(rho);
  return axis === 'x' ? out.set(u, axisY + out.y, out.z) : out.set(out.x, u, out.z);
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
  /** The axis it cuts about. */
  readonly axis: WedgeAxis;
  /** The two planes through the axis (world): the body's materials clip with them. */
  readonly planes: readonly [Plane, Plane];
  /** The share open now, 0 … 1, and whether it is open (≥ `CLOSED`). */
  readonly amount: number;
  readonly open: boolean;
  /** The bounds of the opened wedge, as angles about the axis (`radialOf`: about x from its +y toward its +z, about y
   * from its +z toward its +x): `alpha` ∓ `half`. */
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

/** How a wedge cuts: about which axis, and whether its middle turns to the camera or stands level. */
export interface WedgeOptions {
  /** The body's x (the default) or its vertical y. */
  readonly axis?: WedgeAxis;
  /**
   * The wedge's middle level, toward the camera's side across the axis rather than up toward the camera itself: about
   * x the middle is the body's +z or −z (a half cut is then the upright plane through the axis, facing the reader:
   * what stands under the axis — a lead into the box — lies in it). About y the middle is level anyway.
   */
  readonly upright?: boolean;
}

/**
 * The wedge of a part, `width` (radians) wide at `cut` 1, through the body's axis — its x at `axisY` in its body frame
 * (the default), or its vertical y through the origin (`axis` 'y'; `axisY` is then any point's height on it). The
 * materials of `skip` (the inside's own, which clip by planes of their own) are left alone.
 */
export function createWedge(
  model: PartModel,
  width: number,
  axisY: number,
  skip: ReadonlySet<object>,
  opts: WedgeOptions = {},
): Wedge {
  const axis = opts.axis ?? 'x';
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
  let alpha = axis === 'x' ? Math.PI / 2 : 0;
  let half = 0;
  const axisAt = new Vector3();
  const local = new Vector3();
  const n = new Vector3();
  const normals = new Matrix3();
  const inverse = new Matrix4();
  return {
    axis,
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
      // the camera's side of the axis, as an angle about it (`radialOf`); upright, level across the axis
      local.copy(view).transformDirection(inverse.copy(frame.matrixWorld).invert());
      if (opts.upright && axis === 'x') local.y = 0;
      alpha = angleOf(axis, local) ?? alpha;
      half = (width / 2) * amount;
      if (amount < CLOSED) {
        park();
        return;
      }
      const scale = frame.matrixWorld.getMaxScaleOnAxis();
      const b1 = alpha - half;
      const b2 = alpha + half;
      // each plane through the axis keeps the side away from the wedge (a point is clipped where both remove it), and
      // clips a hair into it, where the section face stands: the first faces back from where `b1` grows, the second
      // on from `b2`
      frame.localToWorld(axisAt.set(0, axisY, 0));
      normals.getNormalMatrix(frame.matrixWorld);
      planes[0].setFromNormalAndCoplanarPoint(tangentOf(axis, b1, n).negate().applyMatrix3(normals).normalize(), axisAt);
      planes[1].setFromNormalAndCoplanarPoint(tangentOf(axis, b2, n).applyMatrix3(normals).normalize(), axisAt);
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

/* ------------------------------------------------------------------------- faces off the round */

/**
 * A layer of a section face whose radii may change with the face's angle: a body that is not round about the axis (a
 * box, an oval roll) or a thing off the axis (a plate, a leg) meets each face at its own distance from the axis.
 */
export interface SectionLayer {
  /** A stretch along the axis, in the body frame's own coordinate (x for the axis 'x', y for 'y'). */
  readonly u0: number;
  readonly u1: number;
  /** Its inner and outer radius from the axis at `u` on the face at angle `theta` (none there where r1 ≤ r0). */
  readonly r0: (u: number, theta: number) => number;
  readonly r1: (u: number, theta: number) => number;
  /** Its colour, or its colour on the face at `theta`. */
  readonly color: Color | ((theta: number) => Color);
  /** Quads along `u`. */
  readonly steps: number;
}

/** The two section faces of a wedge as one mesh's geometry: laid anew whenever the wedge's bounds move. */
export interface Section {
  readonly geometry: BufferGeometry;
  /**
   * Lays face 0 at the angle `b1` — it closes what is kept below `b1`, facing the open wedge — and face 1 at `b2` (it
   * closes what is kept above `b2`), each `INSET` into the side it closes, its colours for its angle.
   */
  pose(b1: number, b2: number): void;
  /** The layers' radii changed (a bulged top): the next `pose` lays the faces again even at the same bounds. */
  redo(): void;
}

/**
 * The section faces of `layers` about `axis` (the axis 'x' at `axisY`), as `faceGeometry` lays them for a round body
 * but with radii that may change with the face's angle; positions in the part's body frame, colours per vertex, a
 * fixed number of vertices (every layer has its quads on both faces, empty ones flat).
 */
export function createSection(axis: WedgeAxis, axisY: number, layers: readonly SectionLayer[]): Section {
  const quads = layers.reduce((n, l) => n + l.steps, 0);
  const count = 2 * quads * 6;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new BufferAttribute(nor, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const n = new Vector3();
  const inset = new Vector3();
  const corners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()] as const;
  let posed: [number, number] | null = null;
  return {
    geometry,
    pose(b1, b2) {
      if (posed && posed[0] === b1 && posed[1] === b2) return;
      posed = [b1, b2];
      let k = 0;
      for (const face of [0, 1] as const) {
        const theta = face === 0 ? b1 : b2;
        // the face looks into the open wedge and stands INSET into the side it closes
        tangentOf(axis, theta, n);
        if (face === 1) n.negate();
        inset.copy(n).multiplyScalar(-INSET);
        for (const l of layers) {
          const c = typeof l.color === 'function' ? l.color(theta) : l.color;
          for (let i = 0; i < l.steps; i++) {
            const ua = l.u0 + ((l.u1 - l.u0) * i) / l.steps;
            const ub = l.u0 + ((l.u1 - l.u0) * (i + 1)) / l.steps;
            const ra0 = Math.max(l.r0(ua, theta), 0);
            const rb0 = Math.max(l.r0(ub, theta), 0);
            const ra1 = l.r1(ua, theta);
            const rb1 = l.r1(ub, theta);
            const [a, b, cc, d] = corners;
            if (ra1 <= ra0 && rb1 <= rb0) {
              // none of it on this face: a point where the layer begins (never out where it might reach)
              pointOf(axis, axisY, l.u0, Math.max(l.r0(l.u0, theta), 0), theta, a).add(inset);
              b.copy(a);
              cc.copy(a);
              d.copy(a);
            } else {
              pointOf(axis, axisY, ua, ra0, theta, a).add(inset);
              pointOf(axis, axisY, ub, rb0, theta, b).add(inset);
              pointOf(axis, axisY, ub, Math.max(rb1, rb0), theta, cc).add(inset);
              pointOf(axis, axisY, ua, Math.max(ra1, ra0), theta, d).add(inset);
            }
            // (b − a) × (c − a) points along the face's tangent: face 0 is wound so, face 1 the other way
            for (const p of face === 0 ? [a, b, cc, a, cc, d] : [a, cc, b, a, d, cc]) {
              pos[3 * k] = p.x;
              pos[3 * k + 1] = p.y;
              pos[3 * k + 2] = p.z;
              nor[3 * k] = n.x;
              nor[3 * k + 1] = n.y;
              nor[3 * k + 2] = n.z;
              colors[3 * k] = c.r;
              colors[3 * k + 1] = c.g;
              colors[3 * k + 2] = c.b;
              k++;
            }
          }
        }
      }
      for (const name of ['position', 'normal', 'color']) geometry.getAttribute(name).needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    },
    redo() {
      posed = null;
    },
  };
}

/* ------------------------------------------------------------------------------------ the print */

/**
 * The print (`Text3D`, which three's clipping does not reach) goes where the cut takes the body it is printed on: each
 * text is hidden while the wedge's planes both remove its middle, or come within `reach` of it (its own size: a text
 * the cut runs through goes as a whole). `update` after every `wedge.set`; `dispose` shows them all again.
 */
export function printKeeper(model: PartModel, wedge: Wedge): { update(): void; hidden(): number; dispose(): void } {
  const at = new Vector3();
  const scale = new Vector3();
  const prints = model.prints;
  let hidden = 0;
  const show = (on: (i: number) => boolean): void => {
    hidden = 0;
    prints.forEach((t, i) => {
      const visible = on(i);
      if (!visible) hidden++;
      const m = t.material as Material;
      if (m.visible !== visible) m.visible = visible;
    });
  };
  return {
    update() {
      if (!wedge.open) {
        show(() => true);
        return;
      }
      show((i) => {
        const t = prints[i]!;
        t.updateWorldMatrix(true, false);
        t.getWorldPosition(at);
        const reach = (t.fontSize ?? 0) * t.getWorldScale(scale).x * 0.75;
        return !wedge.planes.every((p) => p.distanceToPoint(at) < reach);
      });
    },
    hidden: () => hidden,
    dispose() {
      show(() => true);
    },
  };
}
