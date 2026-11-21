/**
 * The filament's heat as numbers (docs/volumes/electronics/VISUAL.md §4.6), copied from
 * `circuit/shared/stage/bulb-heat.ts` (shared/README.md, «Копії»): only the scale «heat ↔ temperature» and the
 * read-out. The circuit's energy balance of its 1.5 V lamp is not taken: here the filament's temperature comes from the
 * circuit model (`sim/core/lamp.ts`, `kelvin`). Pure functions, no three.js.
 *
 * One number `heat` 0…1 is the lamp's glow on the bench (`bench.lamp`) — the place of the coil on the incandescence
 * scale (`filamentColor` in `bench/light.ts`): its colour stops stand for the colours a hot body really shows (first
 * visible dull red near 500–600 °C, cherry red ≈ 800 °C, orange ≈ 1 050 °C, …, ≈ 2 300 °C the eye takes for yellowish
 * white). Model kelvin → °C → `heatOfTemperature` → colour.
 */

/** Room temperature and the working temperature of the coil (heat 1), °C. */
export const ROOM_C = 20;
export const WORK_C = 2300;

/**
 * The scale's stops (`light.ts` SCALE: steel.dark, red.dark, red, orange, amber, yellow.light, white) and the
 * temperature each one stands for. Between stops the temperature runs linearly with heat.
 */
export const HEAT_STOPS: readonly (readonly [heat: number, celsius: number])[] = [
  [0, ROOM_C],
  [0.1, 600],
  [0.26, 800],
  [0.46, 1050],
  [0.66, 1400],
  [0.84, 1850],
  [1, WORK_C],
];

/** Below this heat nothing is seen to glow (≈ 460 °C: a hot body's first, barely visible dull red). */
export const FIRST_GLOW = 0.076;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

/** Temperature of the coil's middle, °C, for a heat 0…1. */
export function temperatureOfHeat(heat: number): number {
  const h = clamp01(heat);
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [h1, c1] = HEAT_STOPS[i]!;
    if (h <= h1) {
      const [h0, c0] = HEAT_STOPS[i - 1]!;
      return c0 + ((c1 - c0) * (h - h0)) / (h1 - h0);
    }
  }
  return WORK_C;
}

/** The inverse: heat 0…1 for a temperature in °C (clamped to room … working temperature). */
export function heatOfTemperature(celsius: number): number {
  if (celsius <= ROOM_C) return 0;
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [h1, c1] = HEAT_STOPS[i]!;
    if (celsius <= c1) {
      const [h0, c0] = HEAT_STOPS[i - 1]!;
      return h0 + ((h1 - h0) * (celsius - c0)) / (c1 - c0);
    }
  }
  return 1;
}

/**
 * The read-out: «≈ 2 300 °C», «≈ 790 °C», «20 °C». Rounded the way a reader can take it in while it runs: to 50 °C
 * above 1 000, to 10 °C below; room temperature without «≈». No-break spaces (DECISIONS §23).
 */
export function formatTemperature(celsius: number): string {
  const c = Math.max(celsius, ROOM_C);
  if (c < ROOM_C + 5) return `${ROOM_C}\u00a0°C`;
  const step = c >= 1000 ? 50 : 10;
  const r = Math.round(c / step) * step;
  const text = r >= 1000 ? `${Math.floor(r / 1000)}\u00a0${String(r % 1000).padStart(3, '0')}` : String(r);
  return `≈\u00a0${text}\u00a0°C`;
}
