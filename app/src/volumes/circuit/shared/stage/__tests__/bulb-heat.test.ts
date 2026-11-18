import { describe, expect, it } from 'vitest';
import {
  FIRST_GLOW,
  HEAT_STOPS,
  ROOM_C,
  WORK_C,
  currentOfHeat,
  filamentAfterClick,
  filamentAfterRelease,
  formatTemperature,
  heatOfCurrent,
  heatOfTemperature,
  resistanceAt,
  temperatureOfCurrent,
  temperatureOfHeat,
} from '../bulb-heat';

describe('heat ↔ temperature (the incandescence scale, VISUAL §5.3)', () => {
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

  it('reads out in the course format', () => {
    expect(formatTemperature(2300)).toBe('≈ 2 300 °C');
    expect(formatTemperature(1024)).toBe('≈ 1 000 °C');
    expect(formatTemperature(793)).toBe('≈ 790 °C');
    expect(formatTemperature(20.4)).toBe('20 °C');
    expect(formatTemperature(-3)).toBe('20 °C');
  });
});

describe('current → heat (the coil’s steady energy balance)', () => {
  it('0.3 A is the working white, more is clamped, none is cold', () => {
    expect(heatOfCurrent(0.3)).toBeCloseTo(1, 3);
    expect(heatOfCurrent(0.5)).toBe(1);
    expect(heatOfCurrent(0)).toBe(0);
    expect(currentOfHeat(1)).toBeCloseTo(0.3, 4);
  });

  it('is monotone and plausible on the way down (a dying cell: yellower, then orange, then dark)', () => {
    let last = -1;
    for (let a = 0; a <= 0.3; a += 0.01) {
      const h = heatOfCurrent(a);
      expect(h).toBeGreaterThanOrEqual(last);
      last = h;
    }
    // two thirds of the current: still glowing yellow-orange; half: orange-red; a third: hardly glowing
    expect(heatOfCurrent(0.2)).toBeGreaterThan(0.6);
    expect(heatOfCurrent(0.15)).toBeGreaterThan(0.3);
    expect(heatOfCurrent(0.15)).toBeLessThan(0.66);
    expect(heatOfCurrent(0.1)).toBeLessThan(0.15);
    for (const h of [0.2, 0.5, 0.9]) expect(heatOfCurrent(currentOfHeat(h))).toBeCloseTo(h, 4);
  });

  it('the hot coil has ≈ 5 Ω, the cold one about a thirteenth of it', () => {
    expect(resistanceAt(WORK_C)).toBeCloseTo(5, 6);
    expect(resistanceAt(ROOM_C)).toBeGreaterThan(0.3);
    expect(resistanceAt(ROOM_C)).toBeLessThan(0.45);
    expect(temperatureOfCurrent(0.3)).toBeCloseTo(WORK_C, 0);
  });
});

describe('the first hundredths of a second (lamp/glow)', () => {
  it('heats through the whole scale in hundredths of a second, monotone, scrubbable', () => {
    expect(filamentAfterClick(0).heat).toBe(0);
    let last = -1;
    for (let t = 0; t <= 0.12; t += 0.002) {
      const h = filamentAfterClick(t).heat;
      expect(h).toBeGreaterThanOrEqual(last);
      last = h;
    }
    expect(filamentAfterClick(0.01).heat).toBeGreaterThan(0.2); // red/orange after a hundredth
    expect(filamentAfterClick(0.01).heat).toBeLessThan(0.8);
    expect(filamentAfterClick(0.1).heat).toBeGreaterThan(0.98); // white after a tenth
    // the cold coil's inrush current is many times the working one
    expect(filamentAfterClick(0.0002).amps).toBeGreaterThan(2);
    expect(filamentAfterClick(0.2).amps).toBeCloseTo(0.3, 2);
  });

  it('cools more slowly than it heats, and goes dark within a second', () => {
    // in the same 20 ms the cold coil climbs most of the scale; the white one drops only a little of it
    expect(1 - filamentAfterRelease(0.02).heat).toBeLessThan(filamentAfterClick(0.02).heat / 2);
    expect(filamentAfterRelease(0.05).heat).toBeGreaterThan(0.5);
    expect(filamentAfterRelease(1).heat).toBeLessThan(FIRST_GLOW);
    expect(filamentAfterRelease(0, 0.4).heat).toBeCloseTo(0.4, 9);
    expect(filamentAfterRelease(0.3).amps).toBe(0);
  });

  it('a dying cell heats the coil less (no separate code path: the same balance)', () => {
    const fresh = filamentAfterClick(0.3).heat;
    const tired = filamentAfterClick(0.3, { volts: 1.2, ohms: 1.5 }).heat;
    expect(tired).toBeLessThan(fresh);
    expect(tired).toBeGreaterThan(0.1);
  });
});
