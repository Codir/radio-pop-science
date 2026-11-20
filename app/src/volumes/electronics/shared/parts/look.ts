/**
 * The look of the circuit model's state on a part (docs/volumes/electronics/VISUAL.md §1 principle 3, §4.4, §4.6,
 * §4.8): what a part shows is read from the model and from nothing else, through pure maps that this file holds — the
 * heat of a body, its condition, an LED's current, a lamp's filament temperature.
 *
 * **Heat is a colour of the surface, never light** (VISUAL §1, principle 3; §4.8): the body's own colour mixed with
 * `heatRamp(t)` (`orange` → `red`) by 0.3 · t, t = min(1, max(0, (h − 0.5) / 0.5)); a hot body also darkens toward
 * `mix('wireBrown', 'ink', 0.5)` by up to 30 % with t (its paint scorches); a burnt one is charred, mix(body, ink, 0.75)
 * (an LED's dome 0.6), and its tint goes within 1 s. No emissive, glow or halo from heat in any state. The platform's
 * `applyHeat` (`fx/thermal`) lights a surface by its emissive — exactly what VISUAL forbids here — so the mix is a
 * term of the body's own shader instead (`heatable`): `diffuseColor = mix(diffuseColor, colour, amount)` after the
 * vertex colours, the three mixes of a state folded into one colour and one amount (`mixOf`). It is written into the
 * shader before the part is first drawn, so a part that burns compiles nothing.
 *
 * **The kinds** of the catalog are bound by a table, partial by kind (never an exhaustive switch: the kinds E1-5 and
 * E1-6 add are listed by name): whether a hot body scorches and how far a burnt one chars. A battery only warms (it
 * never burns, the model says so), and a burnt speaker or lamp shows its own marks (a dark ring on the cone; a broken
 * filament and a greyed top of the glass) instead of a charred body.
 *
 * **Light** comes from the model only: an LED's brightness b = min(1, (Φ / Φ₀)^(1/3)) from its luminous flux Φ
 * (`ledLumens`), Φ₀ the red LED's flux at 20 mA; b < 0.02 is no light at all. The lamp's glow is the place of its
 * filament's temperature (the model's `kelvin`) on the incandescence scale (`heatOfTemperature`).
 */
import { Color, Vector4, type Material, type Mesh, type Object3D } from 'three';
import { KToonMaterial, col, heatRamp } from '@/style';
import { PARTS, ROOM_KELVIN, ledLumens, type PartKind } from '@electronics/sim/core';
import { heatOfTemperature } from './heat-scale';
import type { PartLook, PartStatus } from './part';

/** The numbers of VISUAL §4.8. */
export const HEAT_LOOK = {
  /** The heat (a share of the limit) from which the tint starts. */
  from: 0.5,
  /** The most of `heatRamp(t)` mixed into the body. */
  tint: 0.3,
  /** The most a hot body darkens toward `SCORCH`. */
  scorch: 0.3,
  /** A burnt body toward `ink`. */
  char: 0.75,
  /** Seconds the heat tint takes to go after the burn: no current flows any more. */
  fade: 1,
} as const;

/** What a hot body's paint darkens toward: `mix('wireBrown', 'ink', 0.5)`. */
export const SCORCH: Readonly<Color> = col('wireBrown').lerp(col('ink'), 0.5);
const INK = col('ink');

/** How a kind of part takes the look of heat. */
export interface KindLook {
  /** A hot body darkens toward `SCORCH` (paint scorching). */
  readonly scorch: boolean;
  /** How far a burnt body chars toward `ink` (0: its own marks only). */
  readonly char: number;
}

const CHARRED: KindLook = { scorch: true, char: HEAT_LOOK.char };

/** The kinds the table knows: the catalog's, and those it gains in other tasks (E1-5, E1-6). */
type Kind = PartKind | 'capacitor' | 'transistor';

/** VISUAL §4.8, by kind; a kind not listed takes `CHARRED`. */
export const KIND_LOOK: Readonly<Partial<Record<Kind, KindLook>>> = {
  resistor: CHARRED,
  pot: CHARRED,
  diode: CHARRED,
  capacitor: CHARRED,
  transistor: CHARRED,
  // the dome darkens to mix(colour, ink, 0.6), with a black spot on the crystal
  led: { scorch: true, char: 0.6 },
  // a burnt speaker: a dark ring round the middle of the cone, the rest as it is
  speaker: { scorch: false, char: 0 },
  // a short only warms the battery: the box takes the tint, nothing else
  battery: { scorch: false, char: 0 },
  // a burnt lamp: its filament broken and the top of its glass greyed
  lamp: { scorch: false, char: 0 },
};

/** How the part of a key of the catalog takes heat; a key the catalog has not (yet), as a charring body. */
export function kindLook(key: string): KindLook {
  const spec = Object.hasOwn(PARTS, key) ? PARTS[key] : undefined;
  return (spec && KIND_LOOK[spec.kind as Kind]) ?? CHARRED;
}

/** t of the heat tint: 0 up to half the limit, 1 at the limit and beyond (a shorted battery's heat goes past 1). */
export function heatShare(heat: number): number {
  const t = (heat - HEAT_LOOK.from) / (1 - HEAT_LOOK.from);
  return t > 0 ? Math.min(t, 1) : 0;
}

/** What the body's surface shows: the position on `heatRamp` and the shares of the three mixes, in this order. */
export interface Surface {
  readonly t: number;
  readonly tint: number;
  readonly scorch: number;
  readonly char: number;
}

/**
 * The surface for a heat h and a state (VISUAL §4.8): ok, warm and hot tint by 0.3 · t; hot also scorches by 0.3 · t
 * (a kind that scorches); burnt chars by the kind's share at once and its tint goes within `HEAT_LOOK.fade` of the burn
 * (`since`, seconds). A bulged electrolytic takes heat like a warm one. Monotone in h for every state.
 */
export function surfaceOf(
  heat: number,
  status: PartStatus,
  since = Number.POSITIVE_INFINITY,
  kind: KindLook = CHARRED,
): Surface {
  if (status === 'burnt') {
    const left = since >= HEAT_LOOK.fade ? 0 : 1 - Math.max(since, 0) / HEAT_LOOK.fade;
    return { t: 1, tint: HEAT_LOOK.tint * left, scorch: 0, char: kind.char };
  }
  const t = heatShare(heat);
  return {
    t,
    tint: HEAT_LOOK.tint * t,
    scorch: status === 'hot' && kind.scorch ? HEAT_LOOK.scorch * t : 0,
    char: 0,
  };
}

const ramp = new Color();
const folded = new Color();

/**
 * The three mixes of a surface folded into one: `out.xyz` the colour and `out.w` the amount of a single
 * mix(body, colour, amount) that gives the same as the tint, then the scorch, then the char, for any body.
 */
export function mixOf(s: Surface, out: Vector4): Vector4 {
  const keep = (1 - s.tint) * (1 - s.scorch) * (1 - s.char);
  const amount = 1 - keep;
  if (amount <= 1e-12) return out.set(0, 0, 0, 0);
  heatRamp(s.t, ramp);
  folded
    .copy(ramp)
    .multiplyScalar(s.tint * (1 - s.scorch) * (1 - s.char))
    .add(ramp.copy(SCORCH).multiplyScalar(s.scorch * (1 - s.char)))
    .add(ramp.copy(INK).multiplyScalar(s.char))
    .multiplyScalar(1 / amount);
  return out.set(folded.r, folded.g, folded.b, amount);
}

/* ---------------------------------------------------------------------------------------------- light */

/** Φ₀: the red LED's luminous flux at 20 mA (VISUAL §4.4), lm. */
export const LED_FULL_LUMENS = 0.0172;
/** Below this brightness an LED gives no light at all. */
export const LED_DARK = 0.02;

/** An LED's brightness 0…1 at a current through it (A); 0 for any other key, a current the wrong way round or none. */
export function ledBrightness(key: string, amps: number): number {
  const spec = Object.hasOwn(PARTS, key) ? PARTS[key] : undefined;
  if (spec?.kind !== 'led' || !Number.isFinite(amps)) return 0;
  const flux = ledLumens(spec, amps);
  if (!(flux > 0)) return 0;
  const b = Math.min(1, Math.cbrt(flux / LED_FULL_LUMENS));
  return b < LED_DARK ? 0 : b;
}

/**
 * The lamp's glow 0…1 at its filament's temperature (K, the model's `kelvin`): kelvin → °C → `heatOfTemperature`; 0 at
 * the model's room temperature or below (27 °C, a hair above the scale's 20 °C) and when unknown.
 */
export function lampGlow(kelvin: number | undefined): number {
  if (kelvin === undefined || !(kelvin > ROOM_KELVIN)) return 0;
  return heatOfTemperature(kelvin - 273.15);
}

/* ----------------------------------------------------------------------------------- on the materials */

const COLOR_LINE = '#include <color_fragment>';
const UNIFORM_LINE = 'uniform vec4 uBand;';

/**
 * Give a lit K material the heat's term: after the vertex colours, `diffuseColor.rgb = mix(diffuseColor.rgb,
 * uKHeat.rgb, uKHeat.a)` (`uKHeat` 0 — the body as it is). Call before the material is first drawn; throws if K.toon's
 * shader changed so that the patch no longer applies (as `tame` does).
 */
export function heatable<T extends KToonMaterial>(material: T): T {
  if (material.userData.heatable) return material;
  const src = material.fragmentShader;
  if (!src.includes(COLOR_LINE) || !src.includes(UNIFORM_LINE)) {
    throw new Error('parts/look: K.toon shader changed — the heat patch no longer applies');
  }
  material.fragmentShader = src
    .replace(UNIFORM_LINE, `${UNIFORM_LINE}\nuniform vec4 uKHeat;`)
    .replace(
      COLOR_LINE,
      `${COLOR_LINE}\n  diffuseColor.rgb = mix( diffuseColor.rgb, uKHeat.rgb, uKHeat.a );`,
    );
  material.uniforms.uKHeat = { value: new Vector4(0, 0, 0, 0) };
  material.userData.heatable = true;
  return material;
}

/** How fast a hot body's scorch follows its state (s⁻¹): a part that cools from hot to warm does not jump. */
const SCORCH_RATE = 6;

/** The heat's look of one thing: its body's materials and its burnt marks, driven by the model's state. */
export interface SurfaceLook {
  /** Every frame (dt may be 0) with the thing's state. */
  set(look: Readonly<PartLook>, dt: number): void;
  /** What the surface shows now. */
  readonly surface: Surface;
}

/** Every lit K material under `root`, once each. */
function kOf(root: Object3D | null): KToonMaterial[] {
  const out = new Set<KToonMaterial>();
  root?.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if (x instanceof KToonMaterial) out.add(x);
  });
  return [...out];
}

/**
 * The heat's look on `materials` (made `heatable` here), the materials that only char with them when the thing burns
 * (`charred`: a resistor's bands, barely seen then), and the `marks` a burnt thing shows (hidden until then). The tint of
 * a burn fades from the frame it burnt; a thing first seen burnt shows no tint at all. The marks' own materials get the
 * same term, unused: their shader is then one the bench has already compiled for the bodies, and a burn compiles none.
 */
export function createSurfaceLook(
  materials: readonly KToonMaterial[],
  marks: Object3D | null,
  kind: KindLook,
  charred: readonly KToonMaterial[] = [],
): SurfaceLook {
  for (const m of [...materials, ...charred, ...kOf(marks)]) heatable(m);
  if (marks) marks.visible = false;
  const ink = new Vector4(INK.r, INK.g, INK.b, 0);
  let was: PartStatus | null = null;
  let since = Number.POSITIVE_INFINITY;
  let scorch = 0;
  let surface: Surface = surfaceOf(0, 'ok', since, kind);
  const value = new Vector4();
  return {
    get surface() {
      return surface;
    },
    set(look, dt) {
      const step = Math.max(dt, 0);
      if (look.status === 'burnt') since = was === 'burnt' ? since + step : was === null ? Infinity : 0;
      const target = surfaceOf(look.heat, look.status, since, kind);
      // the char takes over at once when it burns; otherwise the scorch follows the state smoothly
      scorch =
        was === null || look.status === 'burnt'
          ? target.scorch
          : target.scorch + (scorch - target.scorch) * Math.exp(-SCORCH_RATE * step);
      was = look.status;
      surface = { ...target, scorch };
      mixOf(surface, value);
      for (const m of materials) (m.uniforms.uKHeat!.value as Vector4).copy(value);
      ink.w = surface.char;
      for (const m of charred) (m.uniforms.uKHeat!.value as Vector4).copy(ink);
      if (marks) marks.visible = look.status === 'burnt';
    },
  };
}
