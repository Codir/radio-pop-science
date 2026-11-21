/**
 * The pool of the LEDs' lights (`lights.ts`, docs/volumes/electronics/VISUAL.md §4.4): three shadowless point lights
 * that the three brightest LEDs take frame by frame (ties by id); the rest glow with no pool on the board; an unused
 * light has intensity 0, and no light is ever added or taken away (every change of their number recompiles every
 * shader — synthesis G23).
 */
import { Color, Group, PointLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LED_LIGHTS, brightest, createLedLights, type LedSource } from '../lights';

const source = (id: string, b: number, x = 0): LedSource => ({
  id,
  b,
  color: new Color(1, 0, 0),
  at: new Vector3(x, 0.8, 0),
});

describe('which LEDs light the board', () => {
  it('the three brightest, ties by id; none below b 0.02', () => {
    const list = [
      source('LED5', 0.4),
      source('LED2', 1),
      source('LED10', 1),
      source('LED1', 0.4),
      source('LED3', 0.01),
    ];
    expect(brightest(list, 3).map((s) => s.id)).toEqual(['LED10', 'LED2', 'LED1']);
    expect(brightest(list, 5).map((s) => s.id)).toEqual(['LED10', 'LED2', 'LED1', 'LED5']);
    expect(brightest([source('LED1', 0.019), source('LED2', 0)], 3)).toEqual([]);
    expect(brightest([source('LED1', Number.NaN)], 3)).toEqual([]);
    // the list is not changed
    expect(list.map((s) => s.id)).toEqual(['LED5', 'LED2', 'LED10', 'LED1', 'LED3']);
  });
});

describe('the pool', () => {
  it('has exactly three shadowless point lights of range 2.5 from the start, all dark', () => {
    const parent = new Group();
    const pool = createLedLights(parent);
    expect(LED_LIGHTS).toBe(3);
    expect(pool.lights).toHaveLength(3);
    for (const l of pool.lights) {
      expect(l).toBeInstanceOf(PointLight);
      expect(l.castShadow).toBe(false);
      expect(l.distance).toBe(2.5);
      expect(l.intensity).toBe(0);
      expect(l.parent).toBe(parent);
    }
  });

  it('gives its lights to the brightest LEDs, intensity ∝ b, in their colour and place; never adds or takes one', () => {
    const parent = new Group();
    const pool = createLedLights(parent);
    const children = parent.children.length;
    const lights = [...pool.lights];
    const green = new Color(0, 1, 0);
    pool.set([
      source('LED1', 0.5, 1),
      { id: 'LED2', b: 1, color: green, at: new Vector3(2, 0.8, 0) },
      source('LED3', 0.25, 3),
      source('LED4', 0.1, 4),
    ]);
    expect(pool.lit).toEqual(['LED2', 'LED1', 'LED3']);
    const [a, b, c] = pool.lights;
    expect(a!.color.equals(green)).toBe(true);
    expect(a!.position.x).toBe(2);
    expect(b!.intensity / a!.intensity).toBeCloseTo(0.5, 12);
    expect(c!.intensity / a!.intensity).toBeCloseTo(0.25, 12);
    expect(a!.intensity).toBeGreaterThan(0);
    // one LED goes dark: its light is unused, intensity 0, still there
    pool.set([source('LED1', 0.5, 1)]);
    expect(pool.lit).toEqual(['LED1']);
    expect(pool.lights.filter((l) => l.intensity > 0)).toHaveLength(1);
    pool.set([]);
    expect(pool.lit).toEqual([]);
    expect(pool.lights.every((l) => l.intensity === 0)).toBe(true);
    expect(parent.children.length).toBe(children);
    expect(pool.lights).toEqual(lights);
    pool.dispose();
    expect(parent.children.length).toBe(children - 3);
  });
});
