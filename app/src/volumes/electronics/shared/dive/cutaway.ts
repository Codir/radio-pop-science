/**
 * The floor `inside` of batch E2 (docs/volumes/electronics/VISUAL.md §7, plan decision 13): a temporary cutaway of a
 * part on its place — a wedge, a quarter of the body, taken out on the camera's side, its two section faces flat. The
 * real inner views (the film's spiral, the plates, the p–n junction) are E3's, in the same mechanics: one number `cut`
 * 0 … 1 opens the part (`door.ts`). E2 has the resistor's: the white ceramic rod, the thin ink film on it, the metal end
 * caps (`mist`, the section's colour of what is not named) and the lacquer of the body's colour with the paint of the
 * bands at the rim. The lacquer's faces are drawn with the body's own material, so a hot part is hot in the section too
 * (VISUAL §7: the state goes down with the reader) — a twin of it that shares its heat — and the rest is one material
 * of the section's colours.
 *
 * How: the body's materials (not the legs') clip the wedge — two planes through the axis, each keeping its side, with
 * `clipIntersection`, so only what both remove is gone. Each plane clips a hair (`SLIVER`) into the side it keeps, and
 * the section face stands inside that hair with a material that clips nothing: whatever of the body reaches the plane
 * (the ends of the bands' paint) is cut away behind the face, never seen as a seam in front of it. The planes are set
 * once when the cutaway is made and parked far away while it is closed, so opening it compiles no shader; at `cut` c
 * the wedge is 90° · c wide, centred on the camera's side of the axis. Four draw calls while it is open (two faces, two
 * materials), none while it is closed.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix3,
  Mesh,
  Plane,
  Vector3,
  type Color,
  type Material,
} from 'three';
import { K, col, type KToonMaterial } from '@/style';
import { PARTS, type PartKind } from '@electronics/sim/core';
import { tame } from '../bench/materials';
import {
  AXIAL_Y,
  RESISTOR,
  RESISTOR_BODY,
  bandColor,
  resistorRadius,
  type PartModel,
  type ResistorModel,
} from '../parts';

export interface Cutaway {
  /** The share open now: 0 whole … 1 the quarter taken out. */
  readonly amount: number;
  /** Whether the section is drawn (the wedge is open). */
  readonly open: boolean;
  /**
   * Open the part by `cut` 0 … 1 on the side of `view` (world, unit: from the body toward the camera); every frame,
   * after the part stood on its legs. Below `CLOSED` the part is whole and nothing of the cutaway is drawn.
   */
  set(cut: number, view: Vector3): void;
  /** Gives the part back whole: its materials clip nothing, the faces are gone. */
  dispose(): void;
}

/** Below this share the part is whole: nothing clipped, no face drawn. */
export const CLOSED = 0.01;

/** The resistor's insides in its body frame (VISUAL §7): radii from the axis and the stretch of each layer along it. */
export const RESISTOR_INSIDE = {
  /** The ceramic rod, `white`, end to end inside the caps. */
  rod: 0.085,
  rodEnds: 0.03,
  /** The film on the rod, `ink`: its outer radius. */
  film: 0.092,
  /** The metal caps over the rod's ends, `mist`: from `from` to `to` of the body's length at each end, their outer
   * radius; the end wall is as deep as the rod's end. The lacquer over the waist is 0.033 thick, over the caps 0.023. */
  cap: { from: 0.01, to: 0.17, outer: 0.122 },
  /** How far the bands' paint stands over the body (`resistor.ts`). */
  paint: 0.004,
} as const;

/** How far each plane clips into the side it keeps, and how far into that hair its section face stands. */
const SLIVER = 0.002;
const INSET = 0.001;
/** Where every plane is parked while the part is closed: nothing is ever this far on its removed side. */
const PARKED = 1e6;

/** One flat layer of a section face: a stretch along the axis (`u` from the body's end by leg 0) and two radii. */
interface Layer {
  u0: number;
  u1: number;
  r0: (u: number) => number;
  r1: (u: number) => number;
  color: Color;
  steps: number;
}

/** A section face in its own frame (x along the axis, y the radius, z = `z`), facing +z (`front`) or −z. */
function faceGeometry(layers: readonly Layer[], z: number, front: boolean): BufferGeometry {
  const pos: number[] = [];
  const colors: number[] = [];
  const half = RESISTOR.length / 2;
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

/** The resistor's section: the lacquer (with the bands' paint at the rim) and the inner layers. */
function resistorLayers(model: ResistorModel): { lacquer: Layer[]; inner: Layer[] } {
  const L = RESISTOR.length;
  const { rod, rodEnds, film, cap, paint } = RESISTOR_INSIDE;
  const R = resistorRadius;
  const at = (r: number) => () => r;
  const body = col(RESISTOR_BODY);
  const lacquer: Layer[] = [];
  const inner: Layer[] = [];
  for (const mirrored of [false, true]) {
    // a stretch v0 … v1 from the end by leg 0, or the same stretch from the other end
    const span = (v0: number, v1: number): [number, number] => (mirrored ? [L - v1, L - v0] : [v0, v1]);
    const [e0, e1] = span(0, cap.from);
    lacquer.push({ u0: e0, u1: e1, r0: at(0), r1: R, color: body, steps: 4 });
    const [c0, c1] = span(cap.from, cap.to);
    lacquer.push({ u0: c0, u1: c1, r0: at(cap.outer), r1: R, color: body, steps: 24 });
    inner.push({ u0: c0, u1: c1, r0: at(film), r1: at(cap.outer), color: col('mist'), steps: 1 });
    const [w0, w1] = span(cap.from, rodEnds);
    inner.push({ u0: w0, u1: w1, r0: at(0), r1: at(film), color: col('mist'), steps: 1 });
  }
  lacquer.push({ u0: cap.to, u1: L - cap.to, r0: at(film), r1: R, color: body, steps: 32 });
  inner.push({ u0: rodEnds, u1: L - rodEnds, r0: at(0), r1: at(rod), color: col('white'), steps: 1 });
  inner.push({ u0: rodEnds, u1: L - rodEnds, r0: at(rod), r1: at(film), color: col('ink'), steps: 1 });
  model.bands.forEach((c, i) => {
    const mid = RESISTOR.bands[i]!;
    const lift = (u: number): number => R(u) + paint;
    inner.push({
      u0: mid - RESISTOR.band / 2,
      u1: mid + RESISTOR.band / 2,
      r0: R,
      r1: lift,
      color: bandColor(c),
      steps: 6,
    });
  });
  return { lacquer, inner };
}

/** The materials of the body that the wedge clips: everything of the body but its legs (and the invisible box). */
function bodyMaterials(model: PartModel, skip: ReadonlySet<object>): Material[] {
  const out = new Set<Material>();
  model.bodyGroup.traverse((o) => {
    if (o === model.legs || o === model.hit || skip.has(o)) return;
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) out.add(x);
  });
  return [...out];
}

const UP = new Vector3(0, 1, 0);

function resistorCutaway(model: ResistorModel): Cutaway {
  const { lacquer, inner } = resistorLayers(model);
  const section = tame(K.toon({ color: 'white', vertexColors: true, highlight: 0.1, rim: 0.2, softness: 0.14 }));
  section.name = 'dive.section';
  // the lacquer's faces: the body's own material, but clipping nothing, its heat the body's (one uniform)
  const body = model.body[0] as KToonMaterial;
  const skin = body.clone();
  skin.name = 'dive.lacquer';
  skin.uniforms.uKHeat = body.uniforms.uKHeat!;
  // the two faces: the first bounds the wedge on its +z side (it faces +z and stands at −INSET), the second on −z
  const pivot = new Group();
  pivot.name = `${model.key}:cutaway`;
  pivot.position.set(0, AXIAL_Y, 0);
  const faces = [true, false].map((front) => {
    const z = front ? -INSET : INSET;
    const face = new Group();
    face.add(new Mesh(faceGeometry(lacquer, z, front), skin), new Mesh(faceGeometry(inner, z, front), section));
    for (const m of face.children as Mesh[]) {
      m.castShadow = false;
      m.receiveShadow = true;
    }
    face.visible = false;
    pivot.add(face);
    return face;
  });
  const meshes = new Set<object>(faces.flatMap((f) => f.children));
  model.bodyGroup.add(pivot);

  const planes = [new Plane(), new Plane()];
  const clipped = bodyMaterials(model, meshes).map((m) => ({
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
  const axisAt = new Vector3();
  const local = new Vector3();
  const n = new Vector3();
  const normals = new Matrix3();
  return {
    get amount() {
      return amount;
    },
    get open() {
      return faces[0]!.visible;
    },
    set(cut, view) {
      amount = Math.min(Math.max(Number.isFinite(cut) ? cut : 0, 0), 1);
      const open = amount >= CLOSED;
      for (const f of faces) f.visible = open;
      if (!open) {
        park();
        return;
      }
      const frame = model.bodyGroup;
      frame.updateWorldMatrix(true, false);
      const scale = frame.matrixWorld.getMaxScaleOnAxis();
      // the camera's side of the axis, as an angle about the body's x from its +y toward its +z
      local.copy(view).transformDirection(frame.matrixWorld.clone().invert());
      const alpha = Math.atan2(local.z, local.y);
      const half = (Math.PI / 4) * amount;
      const b1 = alpha - half;
      const b2 = alpha + half;
      faces[0]!.rotation.x = b1;
      faces[1]!.rotation.x = b2;
      // each plane through the axis keeps the side away from the wedge (a point is clipped where both remove it), and
      // clips a hair into it, where the section face stands
      frame.localToWorld(axisAt.set(0, AXIAL_Y, 0));
      normals.getNormalMatrix(frame.matrixWorld);
      planes[0]!.setFromNormalAndCoplanarPoint(
        n.set(0, Math.sin(b1), -Math.cos(b1)).applyMatrix3(normals).normalize(),
        axisAt,
      );
      planes[1]!.setFromNormalAndCoplanarPoint(
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
      pivot.removeFromParent();
      for (const f of faces)
        for (const m of f.children as Mesh[]) {
          m.geometry.dispose();
        }
      section.dispose();
      skin.dispose();
    },
  };
}

/** The kinds that have a cutaway of their own in E2 (a partial table: E3 adds the real inner views). */
const CUTAWAYS: Partial<Record<PartKind, (model: PartModel) => Cutaway>> = {
  resistor: (model) => resistorCutaway(model as ResistorModel),
};

/** The cutaway of a part's model, or null for a kind that has none yet (it stays whole on `inside`). */
export function createCutaway(model: PartModel): Cutaway | null {
  const kind = Object.hasOwn(PARTS, model.key) ? PARTS[model.key]!.kind : null;
  const make = kind ? CUTAWAYS[kind] : undefined;
  return make ? make(model) : null;
}
