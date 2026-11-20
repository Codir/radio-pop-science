/**
 * The scale «heat ↔ temperature» of the filament (VISUAL §4.6), copied with the part of
 * `circuit/shared/stage/__tests__/bulb-heat.test.ts` that covers it (shared/README.md, «Копії»); the circuit's energy
 * balance and its tests are not taken — here the temperature comes from the circuit model.
 */
import { describe, expect, it } from 'vitest';
import {
  FIRST_GLOW,
  HEAT_STOPS,
  ROOM_C,
  WORK_C,
  formatTemperature,
  heatOfTemperature,
  temperatureOfHeat,
} from '../heat-scale';

describe('heat ↔ temperature (the incandescence scale, VISUAL §4.6)', () => {
  it('runs from room temperature to the working ≈ 2 300 °C, monotone, and inverts', () => {
    expect(temperatureOfHeat(0)).toBe(ROOM_C);
    expect(temperatureOfHeat(1)).toBe(WORK_C);
    let last = -Infinity;
    for (let h = 0; h <= 1.0001; h += 0.01) {
      const c = temperatureOfHeat(h);
      expect(c).toBeGreaterThan(last);
      last = c;
      expect(heatOfTemperature(c)).toBeCloseTo(Math.min(h, 1), 9);
    }
    expect(heatOfTemperature(-50)).toBe(0);
    expect(heatOfTemperature(5000)).toBe(1);
  });

  it('puts the colour stops where a hot body shows those colours', () => {
    // red.dark: the first visible dull red (Draper point ≈ 525 °C); orange about 1 000 °C; white-ish above 2 000
    expect(temperatureOfHeat(0.1)).toBeGreaterThanOrEqual(525);
    expect(temperatureOfHeat(0.1)).toBeLessThanOrEqual(700);
    expect(temperatureOfHeat(0.46)).toBeGreaterThan(900);
    expect(temperatureOfHeat(0.46)).toBeLessThan(1200);
    expect(temperatureOfHeat(0.84)).toBeGreaterThan(1700);
    expect(HEAT_STOPS.length).toBe(7); // one per colour of light.ts SCALE
    expect(temperatureOfHeat(FIRST_GLOW)).toBeGreaterThan(430);
    expect(temperatureOfHeat(FIRST_GLOW)).toBeLessThan(525);
  });

  it('places the bench lamp where VISUAL §4.6 says: pale yellow at 6 V (≈ 1 890 °C), amber at 3 V (≈ 1 390 °C)', () => {
    expect(heatOfTemperature(1890)).toBeGreaterThan(0.84); // past yellow.light
    expect(heatOfTemperature(1390)).toBeGreaterThan(0.46); // past orange
    expect(heatOfTemperature(1390)).toBeLessThan(0.66); // short of amber's stop
  });

  it('reads out in the course format', () => {
    expect(formatTemperature(2300)).toBe('≈ 2 300 °C');
    expect(formatTemperature(1024)).toBe('≈ 1 000 °C');
    expect(formatTemperature(793)).toBe('≈ 790 °C');
    expect(formatTemperature(20.4)).toBe('20 °C');
    expect(formatTemperature(-3)).toBe('20 °C');
  });
});
