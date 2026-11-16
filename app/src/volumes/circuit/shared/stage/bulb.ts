/**
 * The lamp (VISUAL.md §5.3): a miniature screw-base bulb. Glass globe; inside a glass stem bead with two support
 * wires and, between their tips, the filament coil. Base: brass thread with four ridges, a black insulating
 * ring and a bottom contact drop. The current's real path: bottom contact → first support → filament → second
 * support → soldered to the thread.
 *
 * Origin = the bottom contact; axis = local +y. Only the filament glows; the glass takes a soft glint from it.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  type Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { Builder, G } from '@/kit';
import { K, col, type KGlassMaterial, type KGlowMaterial } from '@/style';
import { LAMP } from './layout';
import { sheath } from './materials';

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

/** Dimensions of the bulb for a globe radius (default `LAMP.glass`). */
export function bulbDims(globe: number = LAMP.glass): BulbDims {
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

export interface BulbModel {
  group: Group;
  /** Centre of the filament — the lamp's light is parented here. */
  filament: Object3D;
  /** Set the filament's look: colour of the incandescence scale and emissive multiplier (0 = cold). */
  setGlow(color: Color, emission: number, glow: number, room?: number): void;
  /** The coil mesh (close-ups, hotspots). */
  coil: Mesh;
  glass: Mesh;
}

function coilGeometry(turns: number, radius: number, wire: number): TubeGeometry {
  const pts: Vector3[] = [];
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = s * turns * Math.PI * 2;
    // a gentle arch: the coil sags upward between the supports, like a real one
    pts.push(
      new Vector3(
        (s * 2 - 1) * BULB.span,
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
    const edge = Math.min((1 - Math.abs(pos.getX(i)) / BULB.span) / 0.28, 1);
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
  thread.push([tr + 0.012, B.thread - 0.02], [tr + 0.012, B.thread], [0, B.thread]);
  b.lathe(thread, { seg: 40, slot: 'metal', c: ['amber.dark', 'amber'], crease: 50 });
  // the two support wires rising from the glass stem bead (the bead itself is lit glass, added below)
  for (const s of [-1, 1] as const) {
    const path = [
      new Vector3(s * 0.035, 0.6, 0),
      new Vector3(s * 0.05, 0.8, 0),
      new Vector3(s * (B.span + 0.012), B.filamentY - 0.06, 0),
      new Vector3(s * (B.span + 0.004), B.filamentY + 0.02, 0),
    ];
    b.tube(G.roundPath(path, 0.08, 5), 0.011, { seg: 8, slot: 'metal', c: 'steel' });
  }
  // globe: neck out of the base, sphere above
  const R = B.globe;
  const globe: G.Pt[] = [
    [tr + 0.004, B.thread - 0.015],
    [tr + 0.02, B.thread + 0.07],
  ];
  for (let a = -52; a <= 90; a += 6) {
    const rad = (a * Math.PI) / 180;
    globe.push([Math.max(Math.cos(rad) * R, 0), B.globeY + Math.sin(rad) * R]);
  }
  b.lathe(globe, { seg: 64, slot: 'glass', c: 'white' });
  const model = b.build();
  const glass = model.group.getObjectByName('bulb:glass') as Mesh;
  const glassMaterial = model.mats.get('glass') as KGlassMaterial;
  (glassMaterial.uniforms.uGlass!.value as Vector3).y = 3.4; // thinner, crisper fresnel rim
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
  const coil = new Mesh(coilGeometry(14, 0.034, 0.0085), filamentMaterial);
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
  // glass stem bead (pinched glass): translucent, so that it never outshines the coil above it
  const bead = new Mesh(
    G.lathe(
      G.fillet(
        [
          [0, B.thread],
          [0.1, B.thread],
          [0.085, 0.52],
          [0.05, 0.68],
          [0, 0.7],
        ],
        [0, 0.02, 0.05, 0.03, 0],
        4,
      ),
      { seg: 20 },
    ),
    sheath({ color: col('mist').lerp(col('sky'), 0.3), opacity: 0.3, edgeOpacity: 0.8, gloss: 0.5 }),
  );
  bead.name = 'bulb:bead';
  bead.renderOrder = 1;
  model.group.add(bead);
  // glare: a soft camera-facing bloom of the filament's own light (additive; it never lights the glass)
  const glareMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uPower: { value: 0 }, uSize: { value: 1.9 } },
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
  model.group.add(coil, filament, halo, glare);
  const haloMaterial = halo.material as KGlowMaterial;
  return {
    group: model.group,
    filament,
    coil,
    glass,
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
  };
}
