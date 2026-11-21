/**
 * Copied from `circuit/shared/stage/tools/lens.ts` (shared/README.md, «Копії»); `LENS` is the bench's own.
 * The magnifier (docs/volumes/electronics/VISUAL.md §7): the only door to the lower floors. `cyan` rim — the sign "you can take
 * this" —, `slate` handle. It rests in its holder in the near left corner, leaning toward the reader, and is
 * laid OVER the place it shows (never parked in a corner with a leader line).
 *
 * Local frame: ring in the local XY plane, facing +z; handle along −y.
 * `rim` is what is left of the ring on the lower floors: thin cyan arcs in the corners of the frame (overlay
 * layer, fixed to the screen). It fades in while the camera passes through the real ring.
 */
import { Group, Matrix4, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { Builder, G } from '@/kit';
import { K, col } from '@/style';
import { LENS } from '../layout';
import { sheath } from '../materials';

export interface LensPose {
  /** Centre of the ring (board frame). */
  position: Vector3;
  /** Direction the ring faces (board frame, unit) and the direction of the handle (unit, ⟂ facing). */
  facing: Vector3;
  handle: Vector3;
  /** Size multiplier in this pose (default 1): a lens lifted toward the reader is drawn a little larger. */
  scale?: number;
  /**
   * Size of the handle against the ring in this pose (default 1). A ring drawn `scale` times larger with
   * `grip: 1 / scale` keeps a handle of the ordinary size.
   */
  grip?: number;
}

export interface LensModel {
  group: Group;
  /** Blend between two poses with an arc (0 = `from`, 1 = `to`). */
  setPose(from: LensPose, to: LensPose, k: number): void;
  /** 0 = quiet ring (greyed, no glow) … 1 = full cyan with a slow pulse: "take me" / in use. `t` = engine time. */
  setCall(amount: number, t: number): void;
  /** The arcs in the frame's corners: 0 hidden … 1 shown. */
  setRim(amount: number): void;
  rim: Mesh;
  /** The glass disc (pick target; a chapter may replace its material with a view of the lower floor). */
  glass: Mesh;
  ring: Mesh;
}

const RIM_VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;
// a circle through the frame's corners: only four thin arcs of it are inside the frame
const RIM_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAmount;
uniform float uAspect;
varying vec2 vP;
void main() {
  vec2 p = vec2( vP.x * uAspect, vP.y );
  float r = length( p ) / length( vec2( uAspect, 1.0 ) );
  float inner = mix( 1.06, 0.95, uAmount );
  float band = smoothstep( inner - 0.006, inner + 0.004, r );
  float lip = smoothstep( inner + 0.02, inner + 0.004, r ) * 0.45;
  float a = band * ( 0.82 + lip ) * step( 0.001, uAmount );
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( uColor * ( 0.8 + lip ), a );
}`;

const Y = new Vector3(0, 1, 0);
const basis = new Matrix4();
const bx = new Vector3();
const by = new Vector3();
const bz = new Vector3();

/** Orientation that turns local +z to `facing` and local −y to `handle`. */
function orient(facing: Vector3, handle: Vector3, out: Quaternion): Quaternion {
  bz.copy(facing).normalize();
  by.copy(handle).multiplyScalar(-1);
  by.addScaledVector(bz, -by.dot(bz)).normalize();
  bx.crossVectors(by, bz);
  return out.setFromRotationMatrix(basis.makeBasis(bx, by, bz));
}

/** The resting pose: flat on its pegs in the near left corner, the handle toward the reader over the front edge. */
export function holderPose(): LensPose {
  return {
    position: new Vector3(LENS.holder.x, 0.17, LENS.holder.z),
    facing: new Vector3(0, 1, 0.1).normalize(),
    handle: new Vector3(-0.22, -0.06, 1).normalize(),
  };
}

export function createLens(ctx: ChapterContext): LensModel {
  const R = LENS.radius;
  const b = new Builder('lens');
  b.cyl(0.07, 0.2, {
    at: [0, -R - 0.02, 0],
    rot: [Math.PI, 0, 0],
    seg: 16,
    slot: 'metal',
    c: ['steel', 'mist'],
  });
  b.capsule(0.075, 0.62, { at: [0, -R - 0.5, 0], seg: 16, slot: 'gloss', c: ['steel', 'mist'] });
  b.ring(0.075, 0.02, { at: [0, -R - 0.74, 0], axis: 'y', seg: 20, tubeSeg: 8, slot: 'gloss', c: 'ink' });
  const model = b.build();
  const group = model.group;
  // the handle as one part, so that a pose can keep it small under a large ring (`LensPose.grip`); it is
  // scaled about the point where it meets the ring
  const grip = new Group();
  grip.name = 'lens:handle';
  grip.add(...group.children);
  group.add(grip);
  // at rest the ring is quiet (thin, greyed cyan); it turns full cyan only when a step calls for it or in use
  const quiet = col('slate').lerp(col('cyan'), 0.3);
  const loud = col('cyan');
  const ringMaterial = K.toon({
    color: quiet,
    emissive: 'cyan',
    emissiveIntensity: 0.02,
    gloss: 0.5,
    keepHue: true,
  });
  const ring = new Mesh(G.ring(R - 0.03, 0.03, 72, 12), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = ring.receiveShadow = true;
  ring.name = 'lens:ring';
  const lensGeometry = G.lathe(
    [
      [0, -0.035],
      [(R - 0.06) * 0.6, -0.022],
      [R - 0.06, 0],
      [(R - 0.06) * 0.6, 0.022],
      [0, 0.035],
    ],
    { seg: 56, crease: 80 },
  );
  lensGeometry.rotateX(Math.PI / 2);
  const glass = new Mesh(
    lensGeometry,
    sheath({
      color: col('sky').lerp(col('white'), 0.55),
      opacity: 0.07,
      edgeOpacity: 0.42,
      gloss: 0.9,
      highlight: 0.6,
    }),
  );
  glass.name = 'lens:glass';
  glass.renderOrder = 4;
  group.add(ring, glass);

  const rimMaterial = new ShaderMaterial({
    uniforms: {
      uColor: { value: col('cyan') },
      uAmount: { value: 0 },
      uAspect: { value: ctx.viewport.aspect },
    },
    vertexShader: RIM_VERTEX,
    fragmentShader: RIM_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const rim = new Mesh(new PlaneGeometry(2, 2), rimMaterial);
  rim.frustumCulled = false;
  rim.name = 'lens:rim';
  rim.visible = false;
  rim.renderOrder = 50;
  toOverlay(rim);
  ctx.onResize(() => (rimMaterial.uniforms.uAspect!.value = ctx.viewport.aspect));

  const qa = new Quaternion();
  const qb = new Quaternion();
  return {
    group,
    rim,
    glass,
    ring,
    setPose(from, to, k) {
      const e = k * k * (3 - 2 * k);
      group.position.copy(from.position).lerp(to.position, e);
      // rise off the board first: the arc keeps the ring clear of the parts it passes over
      group.position.addScaledVector(Y, 0.7 * Math.sin(Math.PI * e));
      orient(from.facing, from.handle, qa);
      orient(to.facing, to.handle, qb);
      group.quaternion.copy(qa).slerp(qb, e);
      const sa = from.scale ?? 1;
      group.scale.setScalar(sa + ((to.scale ?? 1) - sa) * e);
      const ga = from.grip ?? 1;
      const g = ga + ((to.grip ?? 1) - ga) * e;
      grip.scale.setScalar(g);
      grip.position.set(0, -R * (1 - g), 0);
    },
    setCall(amount, t) {
      const a = Math.min(Math.max(amount, 0), 1);
      ringMaterial.color.copy(quiet).lerp(loud, a);
      ringMaterial.emissiveIntensity = 0.02 + a * (0.3 + 0.12 * Math.sin(t * 2.4));
    },
    setRim(amount) {
      rimMaterial.uniforms.uAmount!.value = amount;
      rim.visible = amount > 0.002;
    },
  };
}
