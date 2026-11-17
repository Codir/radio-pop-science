/**
 * The lamp's close-up level, live (VISUAL.md §5.3): crossfade of the coarse coil to the fine one, the leads
 * below the stem, the opening of the base (`cut`), the current's path and the anchors. Built by `createBulb`
 * (bulb.ts) and driven from the stage (`stand.lamp`, README «The lamp close up»).
 */
import { DoubleSide, FrontSide, Group, type Material, Mesh, Object3D, Plane, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, type KGlowMaterial } from '@/style';
import type { BulbDims } from './bulb';
import type { ThermalView } from './bulb-thermal';
import { FRONT, fineCoilGeometry, lampPathLocal, leadDown, leadOut, type LampMarks } from './bulb-close';

export type LampAnchor = 'contact' | 'leadIn' | 'bead' | 'coil' | 'leadOut' | 'thread' | 'glass';

/** The current's way through the lamp, in world coordinates (follows the lamp wherever it is). */
export interface LampPath {
  /** Point (and unit tangent) at a share `s` 0…1 of the way, by length. */
  at(s: number, out: Vector3, tangent?: Vector3): Vector3;
  /** The whole polyline (world). */
  points(): Vector3[];
  /** Where each part starts, as shares of the way. */
  readonly marks: LampMarks;
  /** Run the coil part along the wire's spiral (default true) or along the coil's axis. */
  helix: boolean;
}

export interface LampCloseUp {
  group: Group;
  fineCoil: Mesh;
  /** The fine coil's glow material (kept equal to the coarse one by `setGlow`). */
  fineMaterial: KGlowMaterial;
  path: LampPath;
  anchors: Record<LampAnchor, Object3D>;
  /** 0 = the stand's coarse coil … 1 = the close-up (fine coil, leads to the contact and the thread). */
  setDetail(detail: number): void;
  /** The level set last. */
  readonly detail: number;
  /**
   * How close the camera is, 0 far … 1 at the close-up (by distance, whatever `detail` is forced to): the glare
   * steps back by this, so a chapter that forces the close-up level keeps the far lamp's glare on the stand plan.
   */
  near: number;
  /** 0 … 1: the wedge of the base toward the camera opens. */
  setCut(cut: number): void;
  /** Refresh the world-space clipping planes (the lamp moves in the unfolding). Cheap when nothing is cut. */
  update(): void;
  /**
   * Open these too (the socket the lamp stands in): their materials get the same bounded wedge. Materials shared
   * with things far from the lamp are safe — the wedge ends 0.32 from the lamp's axis and at the socket's floor.
   */
  cutAlso(root: Object3D): void;
}

export interface CloseUpParts {
  group: Group;
  coarse: Mesh;
  /** Materials of the base and the glass that the cut opens. */
  cutMaterials: Material[];
  /** Materials that must show their inside once the base is open (the brass, the ring, the cement). */
  shells: Material[];
}

export function createLampCloseUp(B: BulbDims, parts: CloseUpParts): LampCloseUp {
  const group = new Group();
  group.name = 'bulb:close';
  const fineMaterial = K.glow({
    color: 'steel.dark',
    intensity: 1,
    whiten: 0.2,
    falloff: 0.5,
    edge: 0.8,
    vertexColors: true,
  });
  const fineCoil = new Mesh(fineCoilGeometry(B), fineMaterial);
  fineCoil.name = 'bulb:fine-coil';
  // the leads below the stem, the crimp sleeves at the support tips, the solder drop on the collar
  const b = new Builder('bulb-close');
  b.tube(leadDown(), 0.011, { seg: 8, slot: 'metal', c: 'steel' });
  const out = leadOut(B);
  b.tube(out.points, 0.011, { seg: 8, slot: 'metal', c: 'steel' });
  b.add(G.sphere(0.024, 14), {
    slot: 'metal',
    c: 'mist',
    at: [out.solder.x, out.solder.y, out.solder.z],
    s: [1, 0.75, 1],
  });
  for (const side of [-1, 1] as const) {
    const tip = new Vector3(side * (B.span + 0.006), B.filamentY + 0.004, 0);
    // the support's tip pinched round the coil's leg: a small rounded crimp
    b.add(G.capsule(0.0125, 0.022, 10), { slot: 'metal', c: 'steel', at: [tip.x, tip.y, tip.z] });
  }
  const leads = b.build();
  leads.group.name = 'bulb:leads';
  const leadMaterials: Material[] = [];
  leads.group.traverse((o) => {
    const m = (o as Mesh).material as Material | undefined;
    if (m) leadMaterials.push(m);
    o.castShadow = false;
  });
  group.add(fineCoil, leads.group);
  parts.group.add(group);

  // ── the path and the anchors ──
  const local = { true: lampPathLocal(B, true), false: lampPathLocal(B, false) };
  const world: Vector3[] = [];
  const tmp = new Vector3();
  const tan = new Vector3();
  const pathLocal = (helix: boolean): Vector3[] => local[helix ? 'true' : 'false'].points;
  const path: LampPath = {
    helix: true,
    marks: local.true.marks,
    at(s, outPoint, tangent) {
      const pts = pathLocal(path.helix);
      const length = G.pathLength(pts);
      G.pathAt(pts, Math.min(Math.max(s, 0), 1) * length, outPoint, tangent ? tan : undefined);
      parts.group.localToWorld(outPoint);
      if (tangent) tangent.copy(tan).transformDirection(parts.group.matrixWorld);
      return outPoint;
    },
    points() {
      const pts = pathLocal(path.helix);
      world.length = pts.length;
      for (let i = 0; i < pts.length; i++)
        world[i] = parts.group.localToWorld((world[i] ?? new Vector3()).copy(pts[i]!));
      return world.slice();
    },
  };
  const anchors = {} as Record<LampAnchor, Object3D>;
  const pts = local.false.points;
  const len = G.pathLength(pts);
  const put = (name: LampAnchor, p: Vector3): void => {
    const o = new Object3D();
    o.name = `lamp:${name}`;
    o.position.copy(p);
    parts.group.add(o);
    anchors[name] = o;
  };
  const along = (s: number): Vector3 => G.pathAt(pts, s * len, new Vector3());
  put('contact', new Vector3(0, 0.02, 0));
  put('leadIn', along(local.false.marks.leadIn));
  put('bead', new Vector3(0, 0.66, 0));
  put('coil', new Vector3(0, B.filamentY + 0.02, 0));
  put('leadOut', along(local.false.marks.leadOut));
  put('thread', leadOut(B).solder.clone());
  put(
    'glass',
    new Vector3(0, B.globeY + B.globe * 0.72, 0).add(tmp.set(-0.45, 0, 0.3).multiplyScalar(B.globe)),
  );
  const cutter = createCutter(B, parts);
  let detailNow = 0;
  // the stand's lamp until the camera comes close
  fineCoil.visible = false;
  leads.group.visible = false;
  return {
    get detail() {
      return detailNow;
    },
    near: 0,
    group,
    fineCoil,
    fineMaterial,
    path,
    anchors,
    setDetail(detail) {
      const d = Math.min(Math.max(detail, 0), 1);
      detailNow = d;
      const coarse = parts.coarse.material as KGlowMaterial;
      coarse.fade = 1 - d;
      parts.coarse.visible = d < 0.999;
      fineMaterial.fade = d;
      fineCoil.visible = d > 0.001;
      for (const m of leadMaterials) (m as KGlowMaterial).fade = d;
      leads.group.visible = d > 0.001;
    },
    setCut: (cut) => cutter.set(cut),
    cutAlso(root) {
      root.traverse((o) => {
        const m = (o as Mesh).material as Material | undefined;
        if (m && !parts.cutMaterials.includes(m)) {
          parts.cutMaterials.push(m);
          parts.shells.push(m);
        }
      });
    },
    update: () => cutter.update(),
  };
}

const FOG = '#include <fog_fragment>';
/** K.toon / K.metal: the back faces (insides of a shell, seen only through the cut) in a flat tone of their colour. */
function capSections(shader: { fragmentShader: string }): void {
  if (!shader.fragmentShader.includes(FOG) || !shader.fragmentShader.includes('diffuseColor')) return;
  shader.fragmentShader = shader.fragmentShader.replace(
    FOG,
    `if ( !gl_FrontFacing ) gl_FragColor.rgb = diffuseColor.rgb * ${CAP_TONE.toFixed(2)};\n  ${FOG}`,
  );
}
/** Brightness of the section faces against their material's colour (flat, unlit: they read as solid walls). */
const CAP_TONE = 0.42;

/**
 * The base opens as a wedge toward the camera's side (local angle `FRONT.cut`), up to 130°, from the collar's
 * top down to the socket's floor and 0.32 deep. Five local clipping planes in intersection mode: a fragment goes
 * only if it is inside the wedge AND below the collar AND near the axis AND above the floor. The planes exist only while `cut > 0` (no clipping code in any shader of today's frames).
 */
function createCutter(B: BulbDims, parts: CloseUpParts): { set(cut: number): void; update(): void } {
  const top = B.thread + 0.012;
  /** Bounds of the opened wedge: its depth from the axis and its floor (local; the socket's floor is at −0.1). */
  const reach = 0.32;
  const floor = -0.13;
  const local = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane()] as const;
  const world = local.map(() => new Plane());
  let on = false;
  const original = new Map<Material, Material['onBeforeCompile']>();
  const apply = (enable: boolean): void => {
    on = enable;
    for (const m of parts.cutMaterials) {
      m.clippingPlanes = enable ? world : null;
      m.clipIntersection = true;
      m.needsUpdate = true;
    }
    for (const m of parts.shells) {
      m.side = enable ? DoubleSide : FrontSide;
      // the walls' insides, seen through the opening, become flat section faces (a cutaway drawing's caps)
      if (!original.has(m)) original.set(m, m.onBeforeCompile);
      m.onBeforeCompile = enable ? capSections : original.get(m)!;
      m.needsUpdate = true;
    }
  };
  return {
    set(value) {
      const cut = Math.min(Math.max(value, 0), 1);
      if (cut > 0.001 !== on) apply(cut > 0.001);
      const h = ((65 * Math.PI) / 180) * cut;
      const a1 = FRONT.cut - h;
      const a2 = FRONT.cut + h;
      // negative (clipped) side of plane 1: counter-clockwise from a1 (toward +z); of plane 2: clockwise from a2
      local[0].normal.set(Math.sin(a1), 0, -Math.cos(a1));
      local[0].constant = 0;
      local[1].normal.set(-Math.sin(a2), 0, Math.cos(a2));
      local[1].constant = 0;
      local[2].normal.set(0, 1, 0);
      local[2].constant = -top;
      // only near the axis (a chord across the wedge) and above the socket's floor
      local[3].normal.set(Math.cos(FRONT.cut), 0, Math.sin(FRONT.cut));
      local[3].constant = -reach;
      local[4].normal.set(0, -1, 0);
      local[4].constant = floor;
    },
    update() {
      if (!on) return;
      parts.group.updateWorldMatrix(true, false);
      for (let i = 0; i < local.length; i++) world[i]!.copy(local[i]!).applyMatrix4(parts.group.matrixWorld);
    },
  };
}

/** Camera distances (world units) between which the close-up fades in; the `lamp` shot is ≈ 4.7 away. */
export const DETAIL_FAR = 4.1;
export const DETAIL_NEAR = 3.5;

/** `stand.lamp`: the lamp as the chapters of `lamp/*`, `resistance/heat`, `drain/*` see it (README). */
export interface LampView {
  /** The coil's heat 0…1 now (= `stand.glow`; scrub it with `stand.setGlow`). */
  readonly heat: number;
  /** The coil's temperature now, °C (`formatTemperature` for the read-out). */
  readonly celsius: number;
  /** `null` (default) = by the camera's distance; 0…1 forces the close-up level. */
  detail: number | null;
  /** The close-up level shown now 0…1. */
  readonly detailShown: number;
  /** 0…1: the wedge of the base toward the camera opens (both leads inside the base show). */
  cut: number;
  /** 0…1: heat view inside the magnifier's ring. */
  thermal: number;
  readonly path: LampPath;
  readonly anchors: Readonly<Record<LampAnchor, Object3D>>;
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The live `stand.lamp`; `update(cameraPosition)` every frame after the glow is known. */
export function createLampView(
  close: LampCloseUp,
  filament: Object3D,
  heatNow: () => number,
  celsiusOf: (heat: number) => number,
  thermalView: ThermalView,
): LampView & { update(camera: Vector3): void } {
  const at = new Vector3();
  let thermalShown = -1;
  let shown = -1;
  let cutShown = -1;
  const view = {
    detail: null as number | null,
    cut: 0,
    thermal: 0,
    detailShown: 0,
    path: close.path,
    anchors: close.anchors,
    get heat() {
      return heatNow();
    },
    get celsius() {
      return celsiusOf(heatNow());
    },
    update(camera: Vector3) {
      filament.getWorldPosition(at);
      const near = smooth(DETAIL_FAR, DETAIL_NEAR, camera.distanceTo(at));
      close.near = near;
      const d = view.detail ?? near;
      if (Math.abs(d - shown) > 1e-4) close.setDetail((shown = d));
      view.detailShown = d;
      if (Math.abs(view.cut - cutShown) > 1e-4) close.setCut((cutShown = view.cut));
      close.update();
      if (Math.abs(view.thermal - thermalShown) > 1e-4) thermalView.set((thermalShown = view.thermal));
      thermalView.update(heatNow());
    },
  };
  return view;
}
