/**
 * The bench's 6 V lamp (docs/volumes/electronics/VISUAL.md §4.1, §4.6), copied from `circuit/shared/stage/bulb.ts`
 * (shared/README.md, «Копії»): a miniature screw-base bulb — glass globe; inside a glass stem bead with two support
 * wires and, between their tips, the filament coil; base: brass thread with four ridges, a black insulating ring and a
 * bottom contact drop. The circuit's close-up level (`lamp-view.ts`) is not taken; its support path is inlined here.
 * The whole bulb is made smaller (`BULB_SCALE`) so its glass has the bench's radius `LAMP.glass` and its thread fits
 * the post's socket; «6 V» is printed on the brass collar. `depthShell` also gives the LED domes their place in the
 * depth buffer (VISUAL §4.4).
 *
 * Origin = the bottom contact; axis = local +y. Only the filament glows; the glass takes a soft glint from it.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { Builder, G } from '@/kit';
import { K, col, type KGlassMaterial, type KGlowMaterial } from '@/style';
import type { Text3D } from '@/text';
import { LAMP } from '../bench/layout';
import { sheath } from '../bench/materials';
import { Prints, disposeTree, type PartEye } from './part';

/** Local heights: top of the thread, centre of the globe, the filament. */
export interface BulbDims {
  thread: number;
  threadRadius: number;
  /** Radius of the glass globe (the one free size: the base stays the same). */
  globe: number;
  globeY: number;
  filamentY: number;
  span: number;
}

/**
 * The bench's lamp is the circuit's bulb made smaller as a whole: by this its glass has `LAMP.glass` (0.38) and its
 * thread (0.175 × 0.8 = 0.14) goes into the post's socket (0.15).
 */
export const BULB_SCALE = 0.8;

/** Dimensions of the bulb, before `BULB_SCALE`, for a globe radius (default: the bench's glass). */
export function bulbDims(globe: number = LAMP.glass / BULB_SCALE): BulbDims {
  return {
    thread: 0.34,
    threadRadius: 0.175,
    globe,
    globeY: 0.41 + globe,
    filamentY: 0.43 + globe,
    span: 0.17,
  };
}
export const BULB: BulbDims = bulbDims();

/** Height of the bottom contact above the base's face when the middle of the glass is at `LAMP.glassY`. */
export const BULB_BOTTOM = LAMP.glassY - BULB.globeY * BULB_SCALE;

export interface BulbModel {
  /** The bulb, already made smaller by `BULB_SCALE`; origin at its bottom contact. */
  group: Group;
  /** Centre of the filament. */
  filament: Object3D;
  /** Set the filament's look: colour of the incandescence scale and emissive multiplier (0 = cold). */
  setGlow(color: Color, emission: number, glow: number, room?: number): void;
  coil: Mesh;
  glass: Mesh;
  /** «6 V» on the collar (empty where the fonts are not loaded). */
  prints: readonly Text3D[];
  /** Every frame: the print only where it can be read. */
  view(eye: PartEye): void;
  dispose(): void;
}

/** The support wire inside the globe, side −1 (left) or +1 (right): stem → tip (local frame). */
export function supportPath(B: BulbDims, side: -1 | 1): Vector3[] {
  return G.roundPath(
    [
      new Vector3(side * 0.035, 0.6, 0),
      new Vector3(side * 0.05, 0.8, 0),
      new Vector3(side * (B.span + 0.012), B.filamentY - 0.06, 0),
      new Vector3(side * (B.span + 0.004), B.filamentY + 0.02, 0),
    ],
    0.08,
    5,
  );
}

function coilGeometry(B: BulbDims, turns: number, radius: number, wire: number): TubeGeometry {
  const pts: Vector3[] = [];
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = s * turns * Math.PI * 2;
    // a gentle arch: the coil sags upward between the supports, like a real one
    pts.push(
      new Vector3(
        (s * 2 - 1) * B.span,
        Math.cos(a) * radius + 0.035 * (1 - (2 * s - 1) ** 2),
        Math.sin(a) * radius,
      ),
    );
  }
  const g = new TubeGeometry(new CatmullRomCurve3(pts), n * 2, wire, 7, false);
  // the ends near the supports are one step cooler than the middle — true, and it gives depth
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const edge = Math.min((1 - Math.abs(pos.getX(i)) / B.span) / 0.28, 1);
    const k = 0.42 + 0.58 * Math.max(edge, 0) ** 0.7;
    colors.set([k, k * k, k * k * k], i * 3); // cooler = dimmer and redder
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

const GLARE_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vP;
varying float vFar;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  // from far the glare tells "the lamp is on" at thumbnail size; close up it steps back so that the coil shows
  vFar = smoothstep( 2.2, 8.0, -mv.z );
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLARE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec2 vP;
varying float vFar;
void main() {
  float r = length( vP );
  float a = pow( max( 1.0 - r, 0.0 ), 2.6 ) * uPower * ( 0.25 + 0.75 * vFar );
  gl_FragColor = vec4( uColor * a, 1.0 );
}`;

/**
 * The glass's place in the depth buffer. Glass is transparent and writes no depth, so the depth of field (and AO) of
 * the post pipeline would see straight through it: the globe would take the blur of whatever lies behind it. This
 * invisible copy of the glass's front faces writes only depth, after every other transparent thing of the frame (so
 * nothing behind it is hidden), and the glass is focused like the solid thing it belongs to. Also for the LED domes.
 */
export function depthShell(glass: Mesh, centreY: number): Mesh {
  const shell = new Mesh(
    glass.geometry,
    new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: FrontSide }),
  );
  shell.name = `${glass.name || 'glass'}-depth`;
  shell.renderOrder = 5000;
  shell.raycast = () => {};
  // a hair larger than the glass (about its centre): the anti-aliased pixels of the silhouette, whose resolved depth
  // would still be the background's, are covered too — no faint spray just outside the rim
  const k = 1.012;
  shell.scale.setScalar(k);
  shell.position.y = centreY * (1 - k);
  return shell;
}

/** The glare's size: the circuit's 1.9 for its 0.66 globe, with the glass. */
const GLARE_SIZE = (1.9 * LAMP.glass) / 0.66;

export function createBulb(B: BulbDims = BULB): BulbModel {
  const b = new Builder('bulb', {
    glass: { color: 'sky', opacity: 0.05, edgeOpacity: 0.55, specular: 0.14 },
  });
  const tr = B.threadRadius;
  // base: bottom contact drop, black insulating ring, brass thread with four ridges, collar
  b.lathe(
    G.fillet(
      [
        [0, 0],
        [0.07, 0],
        [0.085, 0.035],
        [0.05, 0.06],
        [0, 0.06],
      ],
      0.015,
      3,
    ),
    { seg: 20, slot: 'metal', c: 'mist' },
  );
  b.lathe(
    [
      [0.05, 0.05],
      [0.13, 0.055],
      [tr - 0.02, 0.1],
      [tr - 0.02, 0.12],
      [0, 0.12],
    ],
    { seg: 32, c: 'ink' },
  );
  const thread: G.Pt[] = [[tr - 0.02, 0.11]];
  for (let i = 0; i < 4; i++) {
    const y = 0.125 + i * 0.05;
    thread.push([tr - 0.018, y], [tr, y + 0.014], [tr, y + 0.03], [tr - 0.018, y + 0.044]);
  }
  // collar: its top edge is rolled in over the glass neck and the brass goes on down inside
  thread.push(
    [tr + 0.012, B.thread - 0.02],
    [tr + 0.012, B.thread - 0.004],
    [tr + 0.002, B.thread + 0.006],
    [tr - 0.01, B.thread - 0.004],
  );
  b.lathe(thread, { seg: 40, slot: 'metal', c: ['amber.dark', 'amber'], crease: 50 });
  // the basing cement inside the collar, under the glass: the dark well the neck stands in
  b.lathe(
    [
      [tr - 0.01, B.thread - 0.004],
      [tr - 0.016, B.thread - 0.05],
      [0.06, B.thread - 0.075],
      [0, B.thread - 0.08],
    ],
    { seg: 32, c: 'ink' },
  );
  // the two support wires rising from the glass stem bead (the bead itself is lit glass, added below)
  for (const s of [-1, 1] as const) b.tube(supportPath(B, s), 0.011, { seg: 8, slot: 'metal', c: 'steel' });
  // globe: neck out of the base, sphere above
  const R = B.globe;
  const globe: G.Pt[] = [
    [tr - 0.022, B.thread - 0.045],
    [tr - 0.012, B.thread + 0.004],
    [tr + 0.004, B.thread + 0.05],
    [tr + 0.03, B.thread + 0.1],
  ];
  for (let a = -52; a <= 90; a += 6) {
    const rad = (a * Math.PI) / 180;
    globe.push([Math.max(Math.cos(rad) * R, 0), B.globeY + Math.sin(rad) * R]);
  }
  // close the crown (the 6° steps stop at 86°: a small hole at the top read as a dark spot on the glass)
  globe.push([0, B.globeY + R]);
  b.lathe(globe, { seg: 64, slot: 'glass', c: 'white' });
  const model = b.build();
  const glass = model.group.getObjectByName('bulb:glass') as Mesh;
  const glassMaterial = model.mats.get('glass') as KGlassMaterial;
  (glassMaterial.uniforms.uGlass!.value as Vector3).y = 3.4; // thinner, crisper fresnel rim
  glass.add(depthShell(glass, B.globeY));
  const edgeCold = col('sky').lerp(col('white'), 0.45);
  const edgeWarm = col('yellow.light').lerp(col('white'), 0.35);

  const filamentMaterial = K.glow({
    color: 'steel.dark',
    intensity: 1,
    whiten: 0.2,
    falloff: 0.5,
    edge: 0.8,
    vertexColors: true,
  });
  const coil = new Mesh(coilGeometry(B, 14, 0.034, 0.0085), filamentMaterial);
  coil.name = 'bulb:filament';
  const filament = new Object3D();
  filament.name = 'filament';
  filament.position.set(0, B.filamentY + 0.02, 0);
  coil.position.set(0, B.filamentY, 0);
  // soft glint of the filament inside the glass: a faint additive shell, never brighter than the coil
  const halo = new Mesh(
    G.sphere(R * 0.93, 32),
    K.glow({ color: 'yellow.light', intensity: 0, additive: true, falloff: 2.6, edge: 0, whiten: 0 }),
  );
  halo.position.y = B.globeY;
  halo.name = 'bulb:halo';
  halo.renderOrder = 1;
  // glass stem (pinched glass): a flare fused to the neck down in the collar, narrowing to the bead that holds the
  // supports; open at the bottom. Translucent, so that it never outshines the coil above it
  const bead = new Mesh(
    G.lathe(
      G.fillet(
        [
          [tr - 0.024, B.thread - 0.045],
          [0.12, B.thread + 0.03],
          [0.088, 0.47],
          [0.085, 0.52],
          [0.05, 0.68],
          [0, 0.7],
        ],
        [0, 0.05, 0.03, 0.05, 0.03, 0],
        4,
      ),
      { seg: 24 },
    ),
    sheath({ color: col('mist').lerp(col('sky'), 0.3), opacity: 0.3, edgeOpacity: 0.8, gloss: 0.5 }),
  );
  bead.name = 'bulb:bead';
  bead.renderOrder = 1;
  model.group.add(bead);
  // glare: a soft camera-facing bloom of the filament's own light (additive; it never lights the glass)
  const glareMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uPower: { value: 0 }, uSize: { value: GLARE_SIZE } },
    vertexShader: GLARE_VERTEX,
    fragmentShader: GLARE_FRAGMENT,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const glareWarm = col('yellow');
  const glare = new Mesh(new PlaneGeometry(1, 1), glareMaterial);
  glare.position.copy(filament.position);
  glare.frustumCulled = false;
  glare.renderOrder = 7;
  glare.name = 'bulb:glare';
  glare.visible = false;
  model.group.add(coil, filament, halo, glare);
  const haloMaterial = halo.material as KGlowMaterial;

  // «6 V» stamped on the front of the brass collar, above the socket (VISUAL §4.1)
  const prints = new Prints();
  prints.add(model.group, '6\u00a0V', {
    size: 0.07,
    color: 'amber.dark',
    at: [0, B.thread - 0.075, tr + 0.004],
  });

  const group = new Group();
  group.name = 'lamp';
  group.scale.setScalar(BULB_SCALE);
  group.add(model.group);
  return {
    group,
    filament,
    coil,
    glass,
    prints: prints.texts,
    view: (eye) => prints.view(eye),
    setGlow(color, emission, glow, room = 1) {
      filamentMaterial.setColor(color);
      filamentMaterial.intensity = Math.max(emission, 0.55);
      // cold coil: the vertex colours' cooling must not darken an unlit wire
      filamentMaterial.whiten = 0.15 + 0.5 * glow;
      haloMaterial.color.copy(color);
      haloMaterial.intensity = 0.05 * glow ** 2;
      (glareMaterial.uniforms.uColor!.value as Color).copy(color).lerp(glareWarm, 0.45);
      glareMaterial.uniforms.uPower!.value = 0.62 * glow ** 1.9;
      glare.visible = glow > 0.05;
      // K.glass is unlit: in a dark room its rim must not shine by itself
      (glassMaterial.uniforms.uEdgeColor!.value as Color)
        .copy(edgeCold)
        .lerp(edgeWarm, glow)
        .multiplyScalar(Math.min(1, 0.1 + 0.9 * Math.max(room * 0.55, glow)));
    },
    dispose() {
      group.removeFromParent();
      disposeTree(group);
    },
  };
}
