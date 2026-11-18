/**
 * The magnifier as a real magnifier (`find-fault`: «чого не видно оком, покаже лупа»): inside the ring the stand is
 * seen enlarged `power` times around the point the ring looks at. No second camera, no render target — the stencil
 * portal of `shared/world/window.ts`, with the stand itself inside:
 *
 * 1. a disc on the glass (`iris`) is drawn after the stand's opaque things; it writes stencil `REF` and resets the
 *    depth inside the disc to the far plane (painting the dark of the board's shadow);
 * 2. every nearby mesh of the stand has a twin sharing its geometry and material, whose world matrix is the
 *    source's scaled by `power` about the focus — drawn only where the stencil is `REF` (the material's stencil
 *    state is switched for the twin's draw and restored after it);
 * 3. the stand's own transparent things (the wires' sheaths, the glass) are kept out of the disc the same way, so
 *    only the enlarged picture shows there; the lens's glass still lies over it.
 * Twins share geometry: the wires' shapes, a clamped sheath, a break in the copper all show enlarged as they are.
 */
import {
  AlwaysDepth,
  AlwaysStencilFunc,
  CircleGeometry,
  EqualStencilFunc,
  Group,
  KeepStencilOp,
  Matrix4,
  Mesh,
  NotEqualStencilFunc,
  type Material,
  type Object3D,
  Plane,
  Quaternion,
  Ray,
  ReplaceStencilOp,
  ShaderMaterial,
  Sphere,
  Vector3,
  type StencilFunc,
  type StencilOp,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';
import { LENS, LOOP, boardToWorld, type CircuitStage } from '@circuit/shared/stage';

const REF = 3;
const IRIS_ORDER = 950;
const TWIN_ORDER = 951;
const SKIP = /glass|halo|glare|depth|motes|thermal|beam|hit|window|rim/;

const VERT = /* glsl */ `
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  p.z = p.w;
  gl_Position = p;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;

interface Saved {
  write: boolean;
  ref: number;
  func: StencilFunc;
  pass: StencilOp;
  fail: StencilOp;
  zfail: StencilOp;
}

export interface Magnifier {
  /** 0 off … 1 on (the iris opens from the centre of the glass). */
  amount: number;
  /** Enlargement inside the ring. */
  power: number;
  /** The board point the ring looks at now (board frame). */
  readonly focus: Vector3;
  /** After the lens is laid for the frame. */
  update(): void;
}

export function createMagnifier(ctx: ChapterContext, stage: CircuitStage): Magnifier {
  const lens = stage.tools.lens;
  const radius = LENS.radius - 0.065;
  const iris = new Mesh(
    new CircleGeometry(radius, 64),
    new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uColor: { value: col('bg.void').lerp(col('slate'), 0.18) } },
      depthFunc: AlwaysDepth,
      stencilWrite: true,
      stencilRef: REF,
      stencilFunc: AlwaysStencilFunc,
      stencilZPass: ReplaceStencilOp,
      stencilZFail: ReplaceStencilOp,
      stencilFail: ReplaceStencilOp,
    }),
  );
  iris.name = 'build-magnifier:iris';
  iris.renderOrder = IRIS_ORDER;
  iris.frustumCulled = false;
  iris.visible = false;
  iris.raycast = () => {};
  lens.glass.add(iris);

  const saved = new WeakMap<Material, Saved>();
  const save = (m: Material): void => {
    saved.set(m, {
      write: m.stencilWrite,
      ref: m.stencilRef,
      func: m.stencilFunc,
      pass: m.stencilZPass,
      fail: m.stencilFail,
      zfail: m.stencilZFail,
    });
  };
  const restore = (m: Material): void => {
    const s = saved.get(m);
    if (!s) return;
    m.stencilWrite = s.write;
    m.stencilRef = s.ref;
    m.stencilFunc = s.func;
    m.stencilZPass = s.pass;
    m.stencilFail = s.fail;
    m.stencilZFail = s.zfail;
  };
  const test = (m: Material, func: StencilFunc): void => {
    save(m);
    m.stencilWrite = true;
    m.stencilRef = REF;
    m.stencilFunc = func;
    m.stencilZPass = m.stencilFail = m.stencilZFail = KeepStencilOp;
  };
  const mats = (o: Mesh): Material[] => (Array.isArray(o.material) ? o.material : [o.material]);

  const twins = new Group();
  twins.name = 'build-magnifier:twins';
  twins.matrixAutoUpdate = false;
  ctx.root.add(twins);
  interface Twin {
    src: Mesh;
    twin: Mesh;
    sphere: Sphere;
  }
  let list: Twin[] | null = null;
  let on = false;
  const build = (): Twin[] => {
    const out: Twin[] = [];
    const skipUnder = new Set<Object3D>();
    lens.group.traverse((o) => skipUnder.add(o));
    stage.base.group.traverse((o) => {
      const m = o as Mesh;
      if (
        !m.isMesh ||
        skipUnder.has(m) ||
        SKIP.test(m.name) ||
        (m as { isInstancedMesh?: boolean }).isInstancedMesh
      )
        return;
      if (mats(m).some((x) => /glass|thermal/.test(x.name ?? ''))) return;
      if (mats(m).some((x) => x.transparent)) {
        // the stand's own sheaths stay out of the disc
        const before = m.onBeforeRender;
        const after = m.onAfterRender;
        m.onBeforeRender = function (...a) {
          before.apply(this, a);
          if (on) for (const x of mats(m)) test(x, NotEqualStencilFunc);
        };
        m.onAfterRender = function (...a) {
          if (on) for (const x of mats(m)) restore(x);
          after.apply(this, a);
        };
      }
      const twin = new Mesh(m.geometry, m.material);
      twin.name = `build-magnifier:${m.name}`;
      twin.matrixAutoUpdate = false;
      twin.matrixWorldAutoUpdate = false;
      twin.renderOrder = TWIN_ORDER + m.renderOrder;
      twin.frustumCulled = false;
      twin.castShadow = twin.receiveShadow = false;
      twin.raycast = () => {};
      twin.visible = false;
      // through the glass the sheath is seen thinner: the copper inside reads (a break in it is the point)
      const sheathed = /:sheath$/.test(m.name);
      const clear: { u: { value: number }; was: number; k: number }[] = [];
      twin.onBeforeRender = () => {
        for (const x of mats(twin)) {
          test(x, EqualStencilFunc);
          if (!sheathed) continue;
          const u = (x as Material & { uniforms?: Record<string, { value: number }> }).uniforms;
          for (const [name, k] of [
            ['opacity', 0.4],
            ['uEdgeAlpha', 0.55],
          ] as const)
            if (u?.[name]) {
              clear.push({ u: u[name], was: u[name].value, k });
              u[name].value *= k;
            }
        }
      };
      twin.onAfterRender = () => {
        for (const c of clear) c.u.value = c.was;
        clear.length = 0;
        for (const x of mats(twin)) restore(x);
      };
      out.push({ src: m, twin, sphere: new Sphere() });
    });
    for (const t of out) twins.add(t.twin);
    return out;
  };

  const focus = new Vector3();
  const focusWorld = new Vector3();
  const lensC = new Vector3();
  const cam = new Vector3();
  const ray = new Ray();
  const plane = new Plane();
  const up = new Vector3();
  const S = new Matrix4();
  const T = new Matrix4();
  const c = new Vector3();
  const q = new Quaternion();
  const unS = new Matrix4();
  const mag: Magnifier = {
    amount: 0,
    power: 2.3,
    focus,
    update() {
      const k = Math.min(Math.max(mag.amount, 0), 1);
      on = k > 0.002;
      iris.visible = on;
      twins.visible = on;
      if (!on) return;
      if (!list) list = build();
      const e = k * k * (3 - 2 * k);
      iris.scale.setScalar(Math.max(e, 1e-3));
      // the focus: where the line from the camera through the ring's centre meets the wires' height
      lens.glass.updateWorldMatrix(true, false);
      lens.glass.getWorldPosition(lensC);
      ctx.camera.camera.getWorldPosition(cam);
      ray.set(cam, lensC.clone().sub(cam).normalize());
      up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
      plane.setFromNormalAndCoplanarPoint(up, boardToWorld(0, LOOP.y, 0));
      if (!ray.intersectPlane(plane, focusWorld)) return;
      focus.copy(focusWorld);
      const p = mag.power;
      S.makeTranslation(focusWorld.x, focusWorld.y, focusWorld.z)
        .multiply(T.makeScale(p, p, p))
        .multiply(unS.makeTranslation(-focusWorld.x, -focusWorld.y, -focusWorld.z));
      const reach = radius * lens.glass.getWorldScale(c).x * 2.6;
      for (const t of list) {
        const geo = t.src.geometry;
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        t.sphere.copy(geo.boundingSphere!).applyMatrix4(t.src.matrixWorld);
        // the wires change shape every frame (their bounds are not kept): always in
        const near =
          t.src.name.startsWith('wire-') ||
          t.sphere.center.distanceTo(focusWorld) * p < reach + t.sphere.radius * p;
        const shown = near && t.src.visible && isShown(t.src);
        t.twin.visible = shown;
        if (shown) t.twin.matrixWorld.multiplyMatrices(S, t.src.matrixWorld);
      }
    },
  };
  return mag;
}

/** Visible with all its parents. */
function isShown(o: Object3D): boolean {
  for (let x: Object3D | null = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}
