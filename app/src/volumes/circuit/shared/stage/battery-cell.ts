/**
 * The numbers of the one AA alkaline battery of the volume as functions of its `life` (0 fresh … 1 dead), so
 * that the meter, the lamp and the cutaway of chapters 3, 6 and 7 all tell one story (VISUAL.md §5.8).
 * Pure functions, no three.js. Plausible curves, not a datasheet:
 *
 * - open-circuit voltage: 1.60 V fresh (1.57–1.62 V on datasheets), sliding almost linearly, 1.20 V dead (alkaline cells rest at ≈1.2 V
 *   when they no longer light a torch);
 * - internal resistance: 0.2 Ω fresh (0.15–0.3 Ω for an AA), slowly rising, then many times more at the end
 *   (6.4 Ω dead — the reaction no longer keeps up and the paste is crowded with its spent forms). The end is
 *   steep on purpose: at 0.1 A the filament only just glows dull red (`heatOfCurrent`), which is what VISUAL §5.8
 *   and `drain/hours` show for «сіла» («нитка ледь жевріє», under load well below 1 V);
 * - the load: the lamp's filament, ≈ 5 Ω hot (treated as a fixed resistor — the simplification of the volume);
 * - capacity at this ≈ 0.25 A drain: 1.86 A·h, so the lamp lights for ≈ 8 hours (`drain/hours`: «годин на вісім»).
 *
 * `life` is the share of the reacting substances already spent. The four named states of §5.8 are points on it.
 */

/** Hot resistance of the lamp's filament, Ω (the load of the stand). */
export const LAMP_OHMS = 5;
/** What the stand's battery can deliver at the lamp's current, A·h. */
export const CAPACITY_AH = 1.86;
/** Where the four states of VISUAL.md §5.8 sit on `life` (their centres, for a timeline with four marks). */
export const LIFE_STATES = { fresh: 0, working: 0.4, tired: 0.75, dead: 1 } as const;
export type LifeState = keyof typeof LIFE_STATES;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** Open-circuit voltage, V (nothing connected — what the meter shows with the switch open). */
export function openVoltage(life: number): number {
  const q = clamp01(life);
  return 1.6 - 0.31 * q - 0.09 * q ** 4;
}

/** Internal resistance, Ω: 0.2 fresh … 6.4 dead (the lamp then takes ≈ 0.1 A: a dull red glow). */
export function internalOhms(life: number): number {
  const q = clamp01(life);
  return 0.2 + 0.3 * q + 5.9 * q ** 8;
}

/** Current through a load of `load` Ω (default: the lamp), A. I = U₀ / (R + r). */
export function loadCurrent(life: number, load = LAMP_OHMS): number {
  return openVoltage(life) / (Math.max(load, 0) + internalOhms(life));
}

/**
 * Voltage on the poles while the current flows through `load` Ω, V: U = U₀ − I·r. `load = Infinity` gives the
 * open-circuit voltage.
 */
export function loadVoltage(life: number, load = LAMP_OHMS): number {
  if (!Number.isFinite(load)) return openVoltage(life);
  return openVoltage(life) - loadCurrent(life, load) * internalOhms(life);
}

/** What the meter on the poles reads: `closed` 0 … 1 blends open circuit → the lamp's load. */
export function meterVoltage(life: number, closed: number): number {
  const c = clamp01(closed);
  return openVoltage(life) * (1 - c) + loadVoltage(life) * c;
}

/** Power the lamp takes, W (P = U·I). */
export function lampPower(life: number): number {
  return loadVoltage(life) * loadCurrent(life);
}

/** The named state of a life (nearest of the four by the borders between them). */
export function lifeState(life: number): LifeState {
  const q = clamp01(life);
  return q < 0.2 ? 'fresh' : q < 0.6 ? 'working' : q < 0.9 ? 'tired' : 'dead';
}

const STEPS = 200;
let table: Float64Array | null = null;

/** Hours of lighting the lamp at each of STEPS + 1 lives: t(q) = ∫ C / I(q) dq (trapezoids). */
function hoursTable(): Float64Array {
  if (table) return table;
  const t = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    const a = (i - 1) / STEPS;
    const b = i / STEPS;
    t[i] = t[i - 1]! + ((CAPACITY_AH / STEPS) * (1 / loadCurrent(a) + 1 / loadCurrent(b))) / 2;
  }
  return (table = t);
}

/** Hours the lamp has been lighting when the battery reaches `life` (0 → 0 h, 1 → ≈8 h). */
export function hoursAt(life: number): number {
  const t = hoursTable();
  const x = clamp01(life) * STEPS;
  const i = Math.min(Math.floor(x), STEPS - 1);
  return t[i]! + (t[i + 1]! - t[i]!) * (x - i);
}

/** Total hours the lamp lights a fresh battery down to dead. */
export function lifeHours(): number {
  return hoursAt(1);
}

/** Inverse of `hoursAt`: the life after `hours` of lighting (clamped to 0 … 1). */
export function lifeAtHours(hours: number): number {
  const t = hoursTable();
  if (hours <= 0) return 0;
  if (hours >= t[STEPS]!) return 1;
  let lo = 0;
  let hi = STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= hours) lo = mid;
    else hi = mid;
  }
  return (lo + (hours - t[lo]!) / (t[hi]! - t[lo]!)) / STEPS;
}

/**
 * The meter's needle as the battery really answers (`drain/ghost`): under a new load the voltage falls in
 * about half a second; when the load goes the battery recovers slowly, in two–three seconds (the paste at the
 * zinc has to even out). Call every frame: returns the next shown value.
 */
export function followVoltage(shown: number, target: number, dt: number): number {
  const tau = target < shown ? 0.14 : 0.75;
  return target + (shown - target) * Math.exp(-Math.max(dt, 0) / tau);
}
