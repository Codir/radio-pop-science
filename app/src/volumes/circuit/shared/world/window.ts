/**
 * The lens as a window (VISUAL §3: «лупа над місцем, яке показує, — вікно, а не проліт»): the copper world, at
 * the floor «ряди», seen inside the resting magnifier on the stand. No second camera — a stencil portal:
 *
 * 1. a disc on the glass (`iris`) is drawn after the stand's opaque things; it writes stencil 1 and resets the
 *    depth inside the disc to the far plane, so nothing of the stand behind the lens hides the world inside;
 * 2. the copper world is mounted just behind the glass, small, facing the lens, and every one of its materials
 *    is drawn only where the stencil is 1.
 * The glass itself (transparent) still lies over it with its sheen. The iris opens from the centre (`amount`).
 */
import {
  AlwaysDepth,
  AlwaysStencilFunc,
  CircleGeometry,
  EqualStencilFunc,
  KeepStencilOp,
  Matrix4,
  Mesh,
  ReplaceStencilOp,
  ShaderMaterial,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { col } from '@/style';
import type { LensModel } from '@circuit/shared/stage';
import { LENS } from '@circuit/shared/stage';

/** Draw order: after every opaque thing of the stand, before the world inside. */
const IRIS_ORDER = 900;
const INSIDE_ORDER = 901;

const VERT = /* glsl */ `
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  p.z = p.w; // on the far plane: the depth inside the disc is reset to "nothing here yet"
  gl_Position = p;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;

export interface LensWindow {
  /** 0 closed … 1 open (the iris grows from the centre of the glass). */
  amount: number;
  /** Local copper units seen across the window's diameter (smaller = closer). */
  span: number;
  /** Put `world` inside the lens (call every frame while open; the lens may move). */
  place(world: Object3D): void;
  /** Turn the stencil test of every material below `world` on or off. */
  clip(world: Object3D, on: boolean): void;
  update(): void;
}

export function createLensWindow(lens: LensModel): LensWindow {
  const radius = LENS.radius - 0.065;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uColor: { value: col('bg.void') } },
    depthFunc: AlwaysDepth,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: AlwaysStencilFunc,
    stencilZPass: ReplaceStencilOp,
    stencilZFail: ReplaceStencilOp,
    stencilFail: ReplaceStencilOp,
  });
  const iris = new Mesh(new CircleGeometry(radius, 64), material);
  iris.name = 'lens:window';
  iris.renderOrder = IRIS_ORDER;
  iris.frustumCulled = false;
  iris.visible = false;
  lens.glass.add(iris);

  const orders = new WeakMap<Object3D, number>();
  const centre = new Vector3();
  const facing = new Vector3();
  const x = new Vector3();
  const y = new Vector3();
  const basis = new Matrix4();
  const win: LensWindow = {
    amount: 0,
    span: 12,
    place(world) {
      lens.glass.updateWorldMatrix(true, false);
      lens.glass.getWorldPosition(centre);
      facing.set(0, 0, 1).transformDirection(lens.glass.matrixWorld);
      // the wire runs along world +x: keep it left ↔ right inside the window
      x.set(1, 0, 0).addScaledVector(facing, -facing.x).normalize();
      y.crossVectors(facing, x).normalize();
      world.quaternion.setFromRotationMatrix(basis.makeBasis(x, y, facing));
      const scale = (2 * radius) / win.span;
      world.scale.setScalar(scale);
      // the focal plane a little behind the glass, so the front atoms never poke through it
      world.position.copy(centre).addScaledVector(facing, -1.4 * scale);
      world.updateMatrixWorld(true);
    },
    clip(world, on) {
      world.traverse((o) => {
        const m = (o as Mesh).material as Material | Material[] | undefined;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
          mat.stencilWrite = on;
          mat.stencilRef = 1;
          mat.stencilFunc = EqualStencilFunc;
          mat.stencilZPass = mat.stencilZFail = mat.stencilFail = KeepStencilOp;
        }
        if (!(o as Mesh).isMesh) return;
        if (!orders.has(o)) orders.set(o, o.renderOrder);
        o.renderOrder = on ? Math.max(orders.get(o)!, INSIDE_ORDER) : orders.get(o)!;
      });
    },
    update() {
      const k = Math.min(Math.max(win.amount, 0), 1);
      iris.visible = k > 0.002;
      const e = k * k * (3 - 2 * k);
      iris.scale.setScalar(Math.max(e, 1e-3));
    },
  };
  return win;
}
