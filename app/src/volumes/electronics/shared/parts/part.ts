/**
 * What every part of the bench shares (docs/volumes/electronics/VISUAL.md §4): the legs, the frame a part is built in,
 * the invisible box that takes gesture 1, the print and the hook of the model's state.
 *
 * A part is built in its BODY FRAME: the origin on the board's face under the middle between its outer legs, +x from
 * leg 0 toward the last leg, +y up out of the board, +z toward the reader when the part stands at the orientation 0.
 * `fit(tips)` stands the part on any tips in its parent's frame (the board's: y = 0 on its face, the tips are the
 * mouths of the sockets): the body goes to the middle between the outer tips and turns with them, and the legs bend
 * from their sockets to the body — so the same model stands at every quarter turn, across the channel (e → f is 0.6,
 * not one pitch), on a leg re-seated by the hand and with a leg in the air (each leg ends at its own tip's height).
 *
 * Draw calls: a few Builder slots, one mesh of legs, the print (one per text, only where it can be read); the box of
 * gesture 1 is never drawn. Parts on the board cast no shadows (VISUAL §4: the lamp's cube shadow costs up to six calls
 * per caster).
 */
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Box3,
  type Camera,
  type Color,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, type KitModel, type Slot } from '@/kit';
import { K, KToonMaterial, col, type ColorLike } from '@/style';
import { Text3D, fontsReady, type FaceId } from '@/text';
import { createSurfaceLook, kindLook, type KindLook, type Surface } from './look';

/** One millimetre of a real part on the bench: parts are three times real, and one unit is ≈ 26 mm (VISUAL §2). */
export const MM = 3 / 26;

export const mix = (a: ColorLike, b: ColorLike, k: number): Color => col(a).lerp(col(b), k);

/** The legs (VISUAL §4): tinned copper 0.06 thick, darker than the board's plastic, with a metal shine. */
export const LEG = {
  radius: 0.03,
  /** How deep below the mouth a leg ends: it goes into the socket. */
  dip: -0.04,
  /** Radius of the bends of a leg. */
  bend: 0.035,
} as const;
export const LEG_COLOR = mix('steel', 'slate', 0.5);

/** Height of an axial body's axis above the board, and of the bottom of a radial body (VISUAL §4). */
export const AXIAL_Y = 0.18;
export const RADIAL_Y = 0.3;

/** The states of a part the model gives (E1-4; `bulged` is an electrolytic's, E1-5). */
export type PartStatus = 'ok' | 'warm' | 'hot' | 'burnt' | 'bulged';

/** What the circuit model says of a part, as its look takes it (VISUAL §4.8). */
export interface PartLook {
  /** The share of its limit the part takes now (`status.load`). */
  load: number;
  /** How warm it has become, a share of its limit, with inertia (`PartMemory.heat`). */
  heat: number;
  status: PartStatus;
  /** An LED's brightness b 0…1 (VISUAL §4.4: from the model's luminous flux). */
  light: number;
  /** A pot's setting 0…1: the knob follows it. */
  setting: number;
}

export const LOOK_AT_REST: Readonly<PartLook> = Object.freeze({
  load: 0,
  heat: 0,
  status: 'ok',
  light: 0,
  setting: 0.5,
});

/** How the scene sees a part this frame: what decides whether its print can be read. */
export interface PartEye {
  camera: Camera;
  /** The viewport's width over its height. */
  aspect: number;
  /** A phone shows no print in the scene (VISUAL §9). */
  phone: boolean;
  /** The room's light 0…1: an unlit print darkens with it and never shines in the dark. */
  room: number;
}

/** A thing of the bench with real marks: a part on the board, or a permanent thing on the base. */
export interface PartView {
  readonly name: string;
  readonly group: Group;
  /** Every lit K material of the model (`tame`, fades, cutaways). */
  readonly materials: readonly KToonMaterial[];
  /** The materials of the body that take the look of heat (`look.ts`); never a resistor's bands. */
  readonly body: readonly KToonMaterial[];
  /** The print (empty where the fonts are not loaded: unit tests). */
  readonly prints: readonly Text3D[];
  /**
   * The hook of the model's state, every frame (`dt` may be 0): the heat on the body's surface, the burnt marks and
   * the bulged electrolytic (`look.ts`), an LED's light and halo, a pot's knob.
   */
  setLook(look: Partial<PartLook>, dt: number): void;
  /** What the body's surface shows now (`look.ts`): the heat tint, the scorch, the char. */
  readonly surface: Surface;
  /** Every frame: the print shows only where all of it has ≥ 16 px-equivalent per em, never on a phone. */
  view(eye: PartEye): void;
  dispose(): void;
}

/** A part that stands in the sockets of the board. */
export interface PartModel extends PartView {
  /** The key of the catalog (`resistor-4k7`), or the name of a look a catalog key will bind later. */
  readonly key: string;
  /** The body: placed and turned by `fit`; the legs, the box and the print are inside it. */
  readonly bodyGroup: Group;
  /** The legs, one mesh, rebuilt when the tips change. */
  readonly legs: Mesh;
  /** The invisible box of the body — gesture 1's target (VISUAL §6): never drawn, still hit by a ray. */
  readonly hit: Mesh;
  /** The tips of the legs at the orientation 0, leg 0 at the origin (the footprint's pitch, VISUAL §4). */
  readonly nominal: readonly Vector3[];
  /** The tips the part stands on now, in its parent's frame. */
  readonly legTips: readonly Vector3[];
  /** Stand on these tips (parent's frame; y = 0 is the board's face): see the file comment. */
  fit(tips: readonly Vector3[]): void;
}

/* ------------------------------------------------------------------------------------------ the print */

/** px-equivalent per em: hidden below `MIN`, full from `FULL` (`chapter-check` fails any text under 16). */
export const LEGIBLE = { MIN: 16, FULL: 18 } as const;

export interface PrintStyle {
  size: number;
  color: ColorLike;
  font?: FaceId;
  /** Position and rotation (Euler XYZ) in the frame of `parent`. */
  at: readonly [number, number, number];
  rot?: readonly [number, number, number];
  lineHeight?: number;
}

/**
 * The print of one thing: decided as a whole by its smallest text, so it never comes in piece by piece; unlit, so it
 * follows the room's light. A text is made only where the fonts are loaded.
 */
export class Prints {
  readonly texts: Text3D[] = [];
  private readonly base: Color[] = [];
  private legible = -1;
  private room = -1;
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly v = new Vector3();

  add(parent: Object3D, text: string, style: PrintStyle): Text3D | null {
    if (!fontsReady()) return null;
    const t = new Text3D(text, {
      font: style.font ?? 'bodyBold',
      size: style.size,
      color: style.color,
      lineHeight: style.lineHeight ?? 1.1,
      anchorX: 'center',
      anchorY: 'middle',
      align: 'center',
      halo: false,
      rich: false,
    });
    t.position.set(...style.at);
    if (style.rot) t.rotation.set(...style.rot);
    t.name = `print:${text}`;
    t.castShadow = false;
    t.visible = false;
    parent.add(t);
    this.texts.push(t);
    this.base.push(col(style.color));
    return t;
  }

  /** One em of `t` on screen in px-equivalent (px at 1080p), as `chapter-check` measures it. */
  private pxEq(t: Text3D, eye: PartEye): number {
    const m = t.metrics;
    const cx = (m.left + m.right) / 2;
    const cy = (m.top + m.bottom) / 2;
    this.a.set(cx, cy, 0).applyMatrix4(t.matrixWorld);
    this.b.set(cx, cy + t.fontSize, 0).applyMatrix4(t.matrixWorld);
    if (this.v.copy(this.a).applyMatrix4(eye.camera.matrixWorldInverse).z >= 0) return 0;
    this.a.project(eye.camera);
    this.b.project(eye.camera);
    return Math.hypot((this.b.x - this.a.x) * eye.aspect, this.b.y - this.a.y) * 540;
  }

  view(eye: PartEye): void {
    if (this.texts.length === 0) return;
    const room = Math.min(Math.max(eye.room, 0), 1);
    const roomChanged = Math.abs(room - this.room) > 1e-3;
    if (roomChanged) this.room = room;
    let smallest = Infinity;
    if (!eye.phone) {
      this.texts[0]!.parent?.updateWorldMatrix(true, true);
      for (const t of this.texts) {
        t.updateMatrixWorld();
        smallest = Math.min(smallest, this.pxEq(t, eye));
      }
    }
    const k = eye.phone
      ? 0
      : Math.min(Math.max((smallest - LEGIBLE.MIN) / (LEGIBLE.FULL - LEGIBLE.MIN), 0), 1);
    if (Math.abs(k - this.legible) < 1e-3 && !roomChanged) return;
    this.legible = k;
    // a new colour each time: Text3D re-colours only on a new value
    const shade = 0.55 + 0.45 * room;
    this.texts.forEach((t, i) => {
      t.visible = k > 0;
      t.opacity = k;
      t.color = this.base[i]!.clone().multiplyScalar(shade);
    });
  }
}

/* ------------------------------------------------------------------------------------------ the legs */

/** A polyline with its corners rounded (the bends of a leg). */
export const bent = (points: readonly Vector3[], radius: number = LEG.bend): Vector3[] =>
  G.roundPath(points, radius, 4);

/** How far each bend of a crack goes to its side, and how far it is shifted round the body (a fixed, uneven pattern). */
const CRACK_BENDS: readonly (readonly [side: number, shift: number])[] = [
  [0.2, 0],
  [-1, 0.3],
  [0.45, -0.2],
  [-0.3, 0.4],
  [1, -0.1],
  [-0.6, 0.25],
  [0.1, -0.35],
  [-0.85, 0.1],
  [0.55, 0.3],
  [-0.15, -0.25],
  [0.9, 0.15],
  [-0.4, -0.1],
  [0.3, 0.35],
];

/**
 * A crack round an axial body (VISUAL §4.8: 0.03 wide): an uneven ring at `x` of the body frame, `radius` from the axis
 * at `AXIAL_Y`, bending at most `jag` to either side; closed; for a tube of radius 0.015.
 */
export function crackPath(x: number, radius: number, jag = 0.03): Vector3[] {
  const n = CRACK_BENDS.length;
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const [side, shift] = CRACK_BENDS[i % n]!;
    const a = ((i + (i % n === 0 ? 0 : shift)) / n) * Math.PI * 2;
    pts.push(new Vector3(x + side * jag, AXIAL_Y + Math.cos(a) * radius, Math.sin(a) * radius));
  }
  return pts;
}
/** The colour of what a crack bares: the pale core under a charred coat, darkened. */
export const CRACK_COLOR = mix('steel', 'ink', 0.35);

/**
 * The legs of an axial part (resistor, diode): from the socket straight up to the axis, then along it into the end of
 * the body (`ends` from the middle). Tips in the body frame.
 */
export function axialLegs(axisY: number, ends: number): (local: readonly Vector3[]) => Vector3[][] {
  return (local) =>
    local.map((t) => {
      const end = Math.sign(t.x || 1) * ends;
      return bent([
        new Vector3(t.x, t.y + LEG.dip, t.z),
        new Vector3(t.x, axisY, t.z),
        new Vector3(end, axisY, 0),
      ]);
    });
}

/**
 * The legs of a part whose legs come out of the bottom of its body (LED, capacitors, transistor, pot): each from its
 * socket up to its root under the body (`roots`: x in the body frame, at height `rootY`). A tip right under its root
 * makes a straight leg; any other bends at `knee` above the board and runs straight to the root.
 */
export function radialLegs(
  roots: readonly number[],
  rootY: number,
  knee = 0.08,
): (local: readonly Vector3[]) => Vector3[][] {
  return (local) =>
    local.map((t, i) => {
      const rx = roots[i] ?? 0;
      const top = new Vector3(rx, rootY + 0.02, 0);
      if (Math.hypot(t.x - rx, t.z) < 1e-6 && Math.abs(t.y) < 1e-6)
        return [new Vector3(t.x, LEG.dip, t.z), top];
      return bent([
        new Vector3(t.x, t.y + LEG.dip, t.z),
        new Vector3(t.x, t.y + Math.min(knee, rootY - 0.06), t.z),
        new Vector3(rx, rootY - 0.04, 0),
        top,
      ]);
    });
}

/** Tubes of the legs' polylines merged into one geometry. */
function legsGeometry(paths: readonly Vector3[][]): BufferGeometry {
  if (paths.length === 0) return new BufferGeometry();
  const parts = paths.map((p) => G.tube(p, LEG.radius, { seg: 8 }));
  const g = mergeGeometries(parts, false) ?? new BufferGeometry();
  for (const p of parts) p.dispose();
  return g;
}

/* ------------------------------------------------------------------------------------- the assembly */

/** The K materials of a Builder model's slots that it has. */
export function slots(model: KitModel, ...names: readonly Slot[]): KToonMaterial[] {
  return names
    .filter((s) => model.mats.has(s))
    .map((s) => model.mats.get(s))
    .filter((m): m is KToonMaterial => m instanceof KToonMaterial);
}

/** Every K material under `root`, once each. */
export function kMaterials(root: Object3D): KToonMaterial[] {
  const out = new Set<KToonMaterial>();
  root.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if (x instanceof KToonMaterial) out.add(x);
  });
  return [...out];
}

/** Disposes every geometry and material under `root` (Text3D included). */
export function disposeTree(root: Object3D): void {
  const seen = new Set<object>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const m = mesh.material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) {
      if (!seen.has(x)) {
        seen.add(x);
        x.dispose();
      }
    }
  });
}

/** What a part's maker gives `assemble`. */
export interface Assembly {
  readonly key: string;
  readonly name: string;
  /** The body in the body frame (meshes, prints); `assemble` adds the legs and the box. */
  readonly body: Group;
  /** The box of the body (body frame): gesture 1's target. */
  readonly hitBox: Box3;
  /** The x of every leg's tip at the orientation 0, leg 0 at 0 (the footprint's pitch). */
  readonly legX: readonly number[];
  /** The legs' polylines in the body frame from the tips in the body frame. */
  readonly legPaths: (local: readonly Vector3[]) => Vector3[][];
  /** Anything else that follows the tips (a jumper's insulation and its box). */
  readonly follow?: (local: readonly Vector3[], hit: Mesh) => void;
  readonly bodyMaterials: readonly KToonMaterial[];
  /** Materials that take no heat but char with the body when it burns: a resistor's bands, barely seen then. */
  readonly charMaterials?: readonly KToonMaterial[];
  /** What a burnt part shows besides its charred body (a belt and a crack, a dark spot), in `body`, named
   * `<key>:burnt`: hidden until it burns (VISUAL §4.8). */
  readonly marks?: Object3D;
  readonly prints: Prints;
  /** The part's own look (an LED's light, a pot's knob), after `assemble` has stored the state. */
  readonly look?: (look: PartLook, dt: number) => void;
}

const Y = new Vector3(0, 1, 0);

/** No shadows from a part on the board; every mesh receives the lamp's. */
function noShadows(root: Object3D): void {
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = !(o as Text3D).isText3D;
    }
  });
}

/** A part model from its maker's assembly, standing on its nominal tips. */
export function assemble(a: Assembly): PartModel {
  const group = new Group();
  group.name = a.key;
  const body = a.body;
  body.name = `${a.key}:body`;
  group.add(body);

  const legs = new Mesh(new BufferGeometry(), K.metal({ color: LEG_COLOR, specular: 0.55, shininess: 40 }));
  legs.name = `${a.key}:legs`;
  body.add(legs);

  const size = a.hitBox.getSize(new Vector3());
  const hit = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ visible: false }));
  hit.name = `${a.key}:hit`;
  hit.scale.copy(size);
  a.hitBox.getCenter(hit.position);
  body.add(hit);
  noShadows(group);

  const nominal = a.legX.map((x) => new Vector3(x, 0, 0));
  const tips: Vector3[] = nominal.map((t) => t.clone());
  let built: Vector3[] | null = null;
  let angle = 0;
  const local = nominal.map(() => new Vector3());
  const state: PartLook = { ...LOOK_AT_REST };
  const heat = createSurfaceLook(a.bodyMaterials, a.marks ?? null, kindLook(a.key), a.charMaterials);

  const model: PartModel = {
    key: a.key,
    name: a.name,
    group,
    bodyGroup: body,
    legs,
    hit,
    nominal,
    legTips: tips,
    materials: kMaterials(group),
    body: a.bodyMaterials,
    prints: a.prints.texts,
    fit(next) {
      if (next.length !== tips.length) {
        throw new RangeError(`${a.key}: ${next.length} tips for ${tips.length} legs`);
      }
      const first = next[0]!;
      const last = next[next.length - 1]!;
      const dx = last.x - first.x;
      const dz = last.z - first.z;
      if (Math.hypot(dx, dz) > 1e-9) angle = Math.atan2(-dz, dx);
      // the body over the middle between the outer tips, standing on the lowest one (a leg in the air ends above it)
      body.position.set((first.x + last.x) / 2, Math.min(...next.map((t) => t.y)), (first.z + last.z) / 2);
      body.rotation.set(0, angle, 0);
      next.forEach((t, i) => {
        tips[i]!.copy(t);
        local[i]!.copy(t).sub(body.position).applyAxisAngle(Y, -angle);
      });
      if (built && built.every((b, i) => b.distanceToSquared(local[i]!) < 1e-14)) return;
      built = local.map((l) => l.clone());
      const old = legs.geometry;
      legs.geometry = legsGeometry(a.legPaths(local));
      old.dispose();
      a.follow?.(local, hit);
    },
    setLook(look, dt) {
      Object.assign(state, look);
      heat.set(state, Math.max(dt, 0));
      a.look?.(state, Math.max(dt, 0));
    },
    get surface() {
      return heat.surface;
    },
    view(eye) {
      a.prints.view(eye);
    },
    dispose() {
      group.removeFromParent();
      disposeTree(group);
    },
  };
  model.fit(nominal);
  return model;
}

/** What a permanent thing adds to its view: how it takes heat, what it shows burnt, its own look. */
export interface FixedLook {
  /** Default: the kind of the catalog key `name` (`look.ts`). */
  readonly kind?: KindLook;
  /** Hidden until it burns (a speaker's dark ring). */
  readonly marks?: Object3D;
  readonly look?: (look: PartLook, dt: number) => void;
}

/** A permanent thing of the bench as a `PartView` (its own Builder model, its print, its look). */
export function fixedView(
  name: string,
  group: Group,
  bodyMaterials: readonly KToonMaterial[],
  prints: Prints,
  own: FixedLook = {},
): PartView {
  const state: PartLook = { ...LOOK_AT_REST };
  const heat = createSurfaceLook(bodyMaterials, own.marks ?? null, own.kind ?? kindLook(name));
  return {
    name,
    group,
    materials: kMaterials(group),
    body: bodyMaterials,
    prints: prints.texts,
    setLook(next, dt) {
      Object.assign(state, next);
      heat.set(state, Math.max(dt, 0));
      own.look?.(state, Math.max(dt, 0));
    },
    get surface() {
      return heat.surface;
    },
    view: (eye) => prints.view(eye),
    dispose() {
      group.removeFromParent();
      disposeTree(group);
    },
  };
}
