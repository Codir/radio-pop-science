/**
 * The LEDs (docs/volumes/electronics/VISUAL.md §4.4): a 5 mm LED three times over — a dome 0.58 across and 1.0 high on
 * a collar 0.66 across and 0.12 high, the collar's bottom 0.3 above the board, the dome's top at 1.3; the legs 1 P apart,
 * the same length (the polarity shows by the collar's cut on the cathode's side, leg 1, level with the dome). The epoxy
 * is lit translucent plastic (`sheath()`, never `K.glass`, which shines in the dark) with a depth shell; through it the
 * two lead frames, the reflector cup and the crystal. Red, yellow and green are diffused; blue and white are clear.
 *
 * The light (VISUAL §4.4): the crystal and the dome glow `K.glow({ whiten: 0, keepHue: true })` at 1.8 · b, where b is
 * the brightness the model's current gives (E2-7 computes it from the luminous flux); below b = 0.02 there is no light
 * at all. The halo and the pool of light on the board are E2-7's.
 *
 * Draw calls: the epoxy, its depth shell, the frames and the crystal, the legs; lit, the glow.
 */
import { Box3, Group, Mesh, Shape, Vector3, type BufferGeometry, type Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, G } from '@/kit';
import { K, col, type KGlowMaterial } from '@/style';
import type { LedColor } from '@electronics/sim/core';
import { BOARD_SPEC } from '@electronics/sim/board';
import { sheath } from '../bench/materials';
import { depthShell } from './bulb';
import { Prints, RADIAL_Y, assemble, mix, radialLegs, type PartModel } from './part';

export const LED = {
  /** The dome: radius, and the top of its cylinder where the hemisphere starts (1.3 − 0.29). */
  radius: 0.29,
  shoulder: 1.01,
  top: 1.3,
  /** The collar: radius, height; cut flat on the cathode's side at the dome's radius. */
  collar: 0.33,
  collarHeight: 0.12,
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
}

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

  const R = LED.collar;
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-R, RADIAL_Y, -R), new Vector3(R, LED.top, R)),
    legX: [0, BOARD_SPEC.pitch],
    legPaths: radialLegs([-BOARD_SPEC.pitch / 2, BOARD_SPEC.pitch / 2], RADIAL_Y),
    bodyMaterials: [epoxy.material],
    prints: new Prints(),
    look: (state) => {
      const b = Math.min(Math.max(state.light, 0), 1);
      glow.visible = b >= 0.02;
      glowMaterial.intensity = 1.8 * b;
    },
  });
  return Object.assign(m, { color, epoxy, glow, glowMaterial });
}
