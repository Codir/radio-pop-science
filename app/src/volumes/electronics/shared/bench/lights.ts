/**
 * The LEDs' light on the board (docs/volumes/electronics/VISUAL.md §4.4; plan decision 6): a pool of three shadowless
 * point lights, each in the colour of its LED, its intensity ∝ the LED's brightness b (the model's), range 2.5. Frame by
 * frame they go to the three brightest LEDs (ties by the order of their ids); the others glow with no pool on the board.
 * An unused light has intensity 0: the lights are made once, with the bench, and never added or taken away — every
 * change of their number recompiles every shader of the scene (synthesis G23).
 */
import { PointLight, type Color, type Object3D, type Vector3 } from 'three';

/** How many LEDs light the board at once. */
export const LED_LIGHTS = 3;
/** The reach of an LED's light (VISUAL §4.4). */
export const LED_RANGE = 2.5;
/**
 * Intensity at b = 1: a faint pool round the dome — beyond 0.3 of it the lit board stays under the saturation that
 * counts as a strong hue (VISUAL §2, «Родини відтінків»); the shot keeps its tone.
 */
export const LED_POWER = 0.35;
/** Below this brightness an LED gives no light at all (VISUAL §4.4). */
const DARK = 0.02;

/** An LED that may light the board: its id, brightness b 0…1, the colour of its light and where its dome is (world). */
export interface LedSource {
  readonly id: string;
  readonly b: number;
  readonly color: Color;
  readonly at: Vector3;
}

/** The `n` brightest of the sources that give light, brightest first; at the same brightness by id. */
export function brightest(list: readonly LedSource[], n: number): LedSource[] {
  return list
    .filter((s) => s.b >= DARK)
    .sort((a, b) => b.b - a.b || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n);
}

export interface LedLights {
  /** The three lights, in the parent from the start; the first goes to the brightest LED. */
  readonly lights: readonly PointLight[];
  /** The ids of the LEDs lighting the board now, brightest first. */
  readonly lit: readonly string[];
  /** Every frame: the LEDs that give light now (any number). */
  set(sources: readonly LedSource[]): void;
  dispose(): void;
}

export function createLedLights(parent: Object3D): LedLights {
  const lights = Array.from({ length: LED_LIGHTS }, (_, i) => {
    const l = new PointLight(0xffffff, 0, LED_RANGE, 2);
    l.name = `led-light-${i}`;
    l.castShadow = false;
    parent.add(l);
    return l;
  });
  let lit: string[] = [];
  return {
    lights,
    get lit() {
      return lit;
    },
    set(sources) {
      const top = brightest(sources, LED_LIGHTS);
      lit = top.map((s) => s.id);
      lights.forEach((l, i) => {
        const s = top[i];
        if (!s) {
          l.intensity = 0;
          return;
        }
        l.color.copy(s.color);
        l.position.copy(s.at);
        l.intensity = LED_POWER * s.b;
      });
    },
    dispose() {
      for (const l of lights) {
        l.removeFromParent();
        l.dispose();
      }
    },
  };
}
