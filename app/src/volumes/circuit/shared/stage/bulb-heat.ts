/**
 * The filament's heat as numbers (VISUAL.md §5.3, PATH `lamp/glow`, `lamp/hot-spot`, `drain/*`): pure functions,
 * no three.js. One number `heat` 0…1 is what the stand already calls the lamp's `glow` — the place of the coil on
 * the incandescence scale (`filamentColor` in light.ts). This module says what that number means:
 *
 *   heat ↔ temperature   the scale's colour stops stand for the colours a hot body really shows (first visible
 *                        dull red near 500–600 °C, cherry red ≈ 800 °C, orange ≈ 1 050 °C, …, the working
 *                        flashlight lamp ≈ 2 300 °C, which the eye takes for yellowish white)
 *   current → heat       the coil's steady energy balance: Joule heat I²·R(T) = what it radiates and conducts away
 *   time → heat          the first hundredths of a second after the click (and the cooling after release),
 *                        integrated from the same balance with the coil's heat capacity
 *
 * The lamp (one AA cell, the stand's): 1.5 V × 0.3 A ≈ 0.45 W, hot resistance ≈ 5 Ω (PATH `lamp/hot-spot`).
 * Simplifications, stated: tungsten resistivity ∝ T^1.2; radiation ∝ T⁴ with a constant emissivity; the loss
 * to the supports is a small share linear in T; the heat capacity is constant.
 */

/** Room temperature and the working temperature of the coil (heat 1), °C. */
export const ROOM_C = 20;
export const WORK_C = 2300;
const K0 = 273.15;

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

// ── the coil's energy balance ─────────────────────────────────────────────────────────────────────────────────

/** The working point of the stand's lamp: current, hot resistance, power. */
export const LAMP_WORK = { amps: 0.3, ohms: 5, watts: 0.45 } as const;
/** Share of the working power that leaves through the supports (the rest is radiated). */
const CONDUCTION = 0.08;
const T0 = ROOM_C + K0;
const TH = WORK_C + K0;
/**
 * Heat capacity of the coil, J/K: ≈ 0.1 mg of tungsten (a 33 µm wire ≈ 6 mm long — what radiates 0.45 W at
 * 2 300 °C with an emissivity ≈ 0.3 and has 5 Ω hot) × 0.15 J/(g·K).
 */
const CAPACITY = 1.4e-5;

/** Resistance of the coil at a temperature (°C): 5 Ω at work, ≈ 0.37 Ω cold (tungsten, ρ ∝ T^1.2). */
export function resistanceAt(celsius: number): number {
  return LAMP_WORK.ohms * ((Math.max(celsius, ROOM_C) + K0) / TH) ** 1.2;
}

/** Power the coil loses at a temperature (°C), W: radiation (∝ T⁴ − T0⁴) and conduction to the supports. */
export function lossAt(celsius: number): number {
  const t = Math.max(celsius, ROOM_C) + K0;
  const rad = (t ** 4 - T0 ** 4) / (TH ** 4 - T0 ** 4);
  const cond = (t - T0) / (TH - T0);
  return LAMP_WORK.watts * ((1 - CONDUCTION) * rad + CONDUCTION * cond);
}

/** Steady temperature of the coil (°C) for a current in amperes: I²·R(T) = loss(T), solved by bisection. */
export function temperatureOfCurrent(amps: number): number {
  const i2 = amps * amps;
  if (i2 <= 0) return ROOM_C;
  let lo = ROOM_C;
  let hi = 3400; // tungsten melts at 3 422 °C
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (i2 * resistanceAt(mid) > lossAt(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Heat 0…1 the coil settles at for a current (0 … 0.3 A; 0.3 A = 1, more is clamped). */
export function heatOfCurrent(amps: number): number {
  return heatOfTemperature(temperatureOfCurrent(amps));
}

/** Steady current (A) that keeps the coil at a heat — the inverse of `heatOfCurrent`. */
export function currentOfHeat(heat: number): number {
  const c = temperatureOfHeat(heat);
  return Math.sqrt(lossAt(c) / resistanceAt(c));
}

// ── the first hundredths of a second ───────────────────────────────────────────────────────────────────────

/** What drives the coil: the cell's push (V) and its own resistance (Ω). Defaults: a fresh AA cell. */
export interface Supply {
  volts?: number;
  ohms?: number;
}

/** The coil at one moment of a transient. */
export interface FilamentMoment {
  heat: number;
  celsius: number;
  /** Current through the coil, A (0 after the release). */
  amps: number;
}

const STEP = 1e-4; // s; the fastest change (the cold coil's inrush) takes about a millisecond

function run(seconds: number, from: number, volts: number, ohms: number): FilamentMoment {
  let c = from;
  const n = Math.ceil(Math.min(Math.max(seconds, 0), 3) / STEP);
  const rate = (t: number): number => {
    const i = volts / (resistanceAt(t) + ohms);
    return (i * i * resistanceAt(t) - lossAt(t)) / CAPACITY;
  };
  for (let k = 0; k < n; k++) {
    // midpoint step; the temperature never leaves room … melting
    const mid = c + 0.5 * STEP * rate(c);
    c = Math.min(Math.max(c + STEP * rate(mid), ROOM_C), 3400);
  }
  const amps = volts > 0 ? volts / (resistanceAt(c) + ohms) : 0;
  return { heat: heatOfTemperature(c), celsius: c, amps };
}

/**
 * The coil `seconds` after the switch closes on a cold lamp (`lamp/glow`): the cold coil takes a large inrush
 * current (≈ 2.7 A through 0.37 Ω), so it runs through red and orange in a few thousandths of a second and is
 * yellow-white after about four hundredths. A pure function of the time: scrub it both ways.
 */
export function filamentAfterClick(seconds: number, supply: Supply = {}): FilamentMoment {
  return run(seconds, ROOM_C, supply.volts ?? 1.56, supply.ohms ?? 0.2);
}

/**
 * The coil `seconds` after the switch opens, from a heat (default 1): no current, it radiates and conducts its
 * heat away — fast while white, ever slower as it reddens (radiation falls as T⁴).
 */
export function filamentAfterRelease(seconds: number, fromHeat = 1): FilamentMoment {
  return run(seconds, temperatureOfHeat(fromHeat), 0, 1);
}
