/**
 * The LEDs (docs/volumes/electronics/VISUAL.md §4.4): a 5 mm LED three times over — a dome 0.58 across and 1.0 high on
 * a collar 0.66 across and 0.12 high, the collar's bottom 0.3 above the board, the dome's top at 1.3; the legs 1 P apart,
 * the same length (the polarity shows by the collar's cut on the cathode's side, leg 1, level with the dome). The epoxy
 * is lit translucent plastic (`sheath()`, never `K.glass`, which shines in the dark) with a depth shell; through it the
 * two lead frames, the reflector cup and the crystal. Red, yellow and green are diffused; blue and white are clear.
 *
 * The light (VISUAL §4.4): the crystal and the dome glow `K.glow({ whiten: 0, keepHue: true })` at 1.8 · b, where b is
 * the brightness the model's current gives (`look.ts` `ledBrightness`, from the luminous flux), and a soft halo of radius
 * 0.6 round the dome adds the LED's light at 0.5 · b; below b = 0.02 there is no light at all. The pool of light on the
 * board is the bench's (`bench/lights.ts`). Burnt: the dome darkened (`look.ts`), a black spot on the crystal, no light.
 *
 * Draw calls: the epoxy, its depth shell, the frames and the crystal, the legs; lit, the glow and the halo; burnt, the
 * spot.
 */
import {
  AdditiveBlending,
  Box3,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  Vector3,
  type BufferGeometry,
  type Color,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, G } from '@/kit';
import { K, col, type KGlowMaterial } from '@/style';
import type { LedColor } from '@electronics/sim/core';
import { BOARD_SPEC } from '@electronics/sim/board';
import { sheath } from '../bench/materials';
import { depthShell } from './bulb';
import { LED_DARK } from './look';
import { Prints, RADIAL_Y, assemble, mix, radialLegs, type PartModel } from './part';

export const LED = {
  /** The dome: radius, and the top of its cylinder where the hemisphere starts (1.3 − 0.29). */
  radius: 0.29,
  shoulder: 1.01,
  top: 1.3,
  /** The collar: radius, height; cut flat on the cathode's side at the dome's radius. */
  collar: 0.33,
  collarHeight: 0.12,
  /** The halo's radius round the dome's middle (VISUAL §4.4). */
  halo: 0.6,
} as const;

/** VISUAL §4.4, the table: the dome when dark, the light, whether the plastic is clear; the crystal as it shows. */
export interface LedLook {
  readonly dome: Color;
  readonly light: Color;
  readonly clear: boolean;
  readonly chip: Color;
}

export const LED_LOOK: Readonly<Record<LedColor, LedLook>> = {
  red: { dome: col('red'), light: col('red'), clear: false, chip: mix('red', 'ink', 0.35) },
  yellow: { dome: col('yellow'), light: col('yellow'), clear: false, chip: mix('yellow', 'ink', 0.35) },
  green: { dome: col('green'), light: col('green'), clear: false, chip: mix('green', 'ink', 0.35) },
  blue: { dome: mix('mist', 'blue', 0.15), light: col('blue'), clear: true, chip: mix('blue', 'ink', 0.2) },
  white: {
    dome: col('white'),
    light: mix('white', 'sky', 0.15),
    clear: true,
    chip: mix('yellow', 'white', 0.6),
  },
};

/** The dome's profile (r, y): a cylinder from the collar's top, a hemisphere above; `k` shrinks it about the axis. */
function domeProfile(k = 1, from: number = RADIAL_Y + LED.collarHeight): G.Pt[] {
  const r = LED.radius * k;
  const pts: G.Pt[] = [
    [0, from],
    [r, from],
  ];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push([r * Math.cos(a), LED.shoulder + (LED.top - LED.shoulder) * k * Math.sin(a)]);
  }
  pts[pts.length - 1] = [0, LED.shoulder + (LED.top - LED.shoulder) * k];
  return pts;
}

/** The collar: a disc 0.66 across, cut flat at x = 0.29 (the cathode's side), from the bottom of the body up. */
function collarGeometry(): BufferGeometry {
  const R = LED.collar;
  const a = Math.acos(LED.radius / R);
  const s = new Shape();
  s.moveTo(LED.radius, -Math.sqrt(R * R - LED.radius * LED.radius));
  s.lineTo(LED.radius, Math.sqrt(R * R - LED.radius * LED.radius));
  s.absarc(0, 0, R, a, 2 * Math.PI - a, false);
  const g = G.extrude(s, LED.collarHeight, { curveSeg: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, RADIAL_Y + LED.collarHeight / 2, 0);
  return g;
}

export interface LedModel extends PartModel {
  readonly color: LedColor;
  /** The dome and the collar: one mesh of lit translucent epoxy. */
  readonly epoxy: Mesh;
  /** What glows when the LED is lit (hidden while b < 0.02). */
  readonly glow: Mesh;
  readonly glowMaterial: KGlowMaterial;
  /** The halo round the dome (hidden while b < 0.02): its diameter, and its opacity now (0.5 · b). */
  readonly halo: Mesh;
  readonly haloSize: number;
  readonly haloPower: number;
}

/** A camera-facing quad at the dome's middle, `uSize` across. */
const HALO_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
/**
 * A soft disc of the LED's light, added: nearly even over the dome (which hides the middle) and fading out to the rim
 * of the halo; squares only — no power of a value that can be 0 (a NaN on some GPUs).
 */
const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec2 vP;
void main() {
  float fall = 1.0 - smoothstep( 0.2, 1.0, length( vP ) );
  gl_FragColor = vec4( uColor * ( fall * fall * uPower ), 1.0 );
}`;

export function createLed(color: LedColor, key = `led-${color}`): LedModel {
  const look = LED_LOOK[color];
  const body = new Group();

  const dome = G.lathe(domeProfile(), { seg: 40, crease: 60 }).toNonIndexed();
  const collar = collarGeometry();
  const epoxyGeo = mergeGeometries([dome, collar], false)!;
  dome.dispose();
  collar.dispose();
  const epoxy = new Mesh(
    epoxyGeo,
    sheath({
      color: look.dome.clone(),
      // diffused epoxy is milky: the frames inside only just show; clear epoxy shows the crystal
      opacity: look.clear ? 0.28 : 0.9,
      edgeOpacity: look.clear ? 0.8 : 0.97,
      gloss: 0.85,
    }),
  );
  epoxy.name = `${key}:epoxy`;
  epoxy.renderOrder = 3;
  epoxy.add(depthShell(epoxy, (RADIAL_Y + LED.top) / 2));
  body.add(epoxy);

  // inside: the anode's post (leg 0, −x), the cathode's anvil with its reflector cup (leg 1, +x), the crystal in the
  // cup and the bond wire from the crystal to the post
  const b = new Builder(key);
  const y0 = RADIAL_Y;
  b.box(0.08, 0.38, 0.04, { at: [-0.12, y0, 0], r: 0, slot: 'metal', c: 'steel' });
  b.box(0.13, 0.3, 0.04, { at: [0.1, y0, 0], r: 0, slot: 'metal', c: 'steel' });
  b.cyl(0.085, 0.07, {
    at: [0.04, y0 + 0.28, 0],
    rTop: 0.1,
    seg: 18,
    slot: 'metal',
    c: 'steel',
    bevel: 0.01,
  });
  b.box(0.06, 0.04, 0.06, { at: [0.04, y0 + 0.33, 0], r: 0, slot: 'metal', c: look.chip.clone() });
  b.tube(
    G.roundPath(
      [new Vector3(0.04, y0 + 0.37, 0), new Vector3(0.0, y0 + 0.47, 0), new Vector3(-0.12, y0 + 0.4, 0)],
      0.06,
      5,
    ),
    0.006,
    { seg: 5, slot: 'metal', c: 'steel' },
  );
  const frames = b.build();
  body.add(frames.group);

  // the light: the crystal and the dome glowing in the LED's own colour, inside the epoxy
  const glowMaterial = K.glow({ color: look.light.clone(), whiten: 0, keepHue: true, intensity: 0 });
  const glow = new Mesh(G.lathe(domeProfile(0.94, RADIAL_Y + 0.02), { seg: 32, crease: 60 }), glowMaterial);
  glow.name = `${key}:glow`;
  glow.visible = false;
  body.add(glow);

  // the halo (VISUAL §4.4): a soft circle of the LED's light round the dome, radius up to 0.6, opacity 0.5 · b
  const haloMaterial = new ShaderMaterial({
    uniforms: {
      uColor: { value: look.light.clone() },
      uPower: { value: 0 },
      uSize: { value: 2 * LED.halo },
    },
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  haloMaterial.name = 'led.halo';
  const halo = new Mesh(new PlaneGeometry(1, 1), haloMaterial);
  halo.name = `${key}:halo`;
  halo.position.y = (RADIAL_Y + LED.top) / 2;
  halo.frustumCulled = false;
  halo.renderOrder = 6;
  halo.raycast = () => {};
  halo.visible = false;
  body.add(halo);

  // burnt (VISUAL §4.8): a black spot on the crystal under the darkened dome
  const burnt = new Builder(`${key}:burnt`);
  burnt.sphere(0.045, { at: [0.04, y0 + 0.37, 0], seg: 10, c: 'ink' });
  const marks = burnt.build().group;
  marks.name = `${key}:burnt`;
  body.add(marks);

  const power = haloMaterial.uniforms.uPower!;
  const R = LED.collar;
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-R, RADIAL_Y, -R), new Vector3(R, LED.top, R)),
    legX: [0, BOARD_SPEC.pitch],
    legPaths: radialLegs([-BOARD_SPEC.pitch / 2, BOARD_SPEC.pitch / 2], RADIAL_Y),
    bodyMaterials: [epoxy.material],
    marks,
    prints: new Prints(),
    look: (state) => {
      // a burnt LED gives no light (the model gives it no current either)
      const b = state.status === 'burnt' ? 0 : Math.min(Math.max(state.light, 0), 1);
      const lit = b >= LED_DARK;
      glow.visible = lit;
      glowMaterial.intensity = 1.8 * b;
      halo.visible = lit;
      power.value = 0.5 * b;
    },
  });
  const led = Object.assign(m, { color, epoxy, glow, glowMaterial, halo, haloSize: 2 * LED.halo });
  return Object.defineProperty(led, 'haloPower', { get: () => power.value as number }) as unknown as LedModel;
}
