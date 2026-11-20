/**
 * The limits of the parts: how loaded a part is, what the stand shows of it, and how heat gathers until a part burns.
 *
 * The load is the share of its limit a part is under now: the largest of its power over `powerW`, its current over
 * `currentA`, its voltage either way over `voltageV` and its voltage the wrong way round over `reverseV` (the limits a
 * part of the catalog has). Up to half its limit a part is `ok`, above that `warm`, above the limit `hot`; a part that
 * failed is `burnt`, or `bulged` (an electrolytic capacitor).
 *
 * Heat follows the load as a body warms to a steady temperature: dH/dt = (load − H) / τ, with the time constant τ of
 * its kind (`HEAT_SECONDS`). H is how warm the part is as a share of its limit; a part that can burn fails when H
 * reaches 1, which happens only under a load above 1, after τ·ln(load / (load − 1)) from cold. A burnt part is a gap
 * in the circuit from then on, a bulged capacitor a large leak without capacitance. A battery never burns: a short only
 * warms it. Numbers: README.md, «Limits».
 */
import type { DcSolution, PartReading } from './dc';
import type { Circuit } from './mna';
import type { Netlist } from './netlist';
import { PARTS, type PartKind, type PartSpec } from './parts';
import { memoryOf, type ModelState, type PartMemory } from './state';

export type Condition = 'ok' | 'warm' | 'hot' | 'burnt' | 'bulged';

/** How a part fails over its limits: an electrolytic capacitor bulges, every other part that can fail burns. */
export type Failure = 'burnt' | 'bulged';

/** What the stand shows of a part. */
export interface PartStatus {
  condition: Condition;
  /** The share of its limit the part is under now (0 for a part without limits and for a burnt one). */
  load: number;
}

/** Above this share of its limit a part is warm. */
export const WARM_LOAD = 0.5;

/** The time constant of the heat of each kind that has limits (s). */
export const HEAT_SECONDS: Readonly<Partial<Record<PartKind, number>>> = Object.freeze({
  battery: 2,
  capacitor: 10,
  resistor: 10,
  pot: 10,
  speaker: 10,
  lamp: 2,
  led: 2,
  diode: 5,
  transistor: 5,
});

/** Whether the part has any limit. */
export const limited = (spec: PartSpec): boolean =>
  spec.limits.powerW !== undefined ||
  spec.limits.currentA !== undefined ||
  spec.limits.voltageV !== undefined ||
  spec.limits.reverseV !== undefined;

/** Whether the part can burn: every part with limits except a battery. */
export function canBurn(spec: PartSpec): boolean {
  return spec.kind !== 'battery' && limited(spec);
}

/** How the part fails when its heat reaches 1: a polar (electrolytic) capacitor bulges, any other part burns. */
export function failureOf(spec: PartSpec): Failure {
  return spec.kind === 'capacitor' && spec.polar ? 'bulged' : 'burnt';
}

/** How the part failed by its memory, or false while it is whole. */
export function damageOf(memory: PartMemory | undefined): Failure | false {
  if (memory?.burnt) return 'burnt';
  if (memory?.bulged) return 'bulged';
  return false;
}

/** The share of its limits the part `spec` is under with the reading `r`. */
export function loadOf(spec: PartSpec, r: PartReading): number {
  const { powerW, currentA, voltageV, reverseV } = spec.limits;
  let load = 0;
  if (powerW !== undefined) load = Math.max(load, Math.abs(r.p) / powerW);
  if (currentA !== undefined) load = Math.max(load, Math.abs(r.i) / currentA);
  if (voltageV !== undefined) load = Math.max(load, Math.abs(r.u) / voltageV);
  if (reverseV !== undefined) load = Math.max(load, Math.max(0, -r.u) / reverseV);
  return load;
}

/** What the stand shows of a part under `load` that failed as `damage` (true is burnt), or not at all (false). */
export function conditionOf(load: number, damage: boolean | Failure = false): Condition {
  if (damage === true || damage === 'burnt') return 'burnt';
  if (damage === 'bulged') return 'bulged';
  if (load > 1) return 'hot';
  if (load > WARM_LOAD) return 'warm';
  return 'ok';
}

/** Marks the part failed in its memory, as `failure` says; a bulged capacitor has no capacitance left to hold a
 * charge. */
export function fail(memory: PartMemory, failure: Failure): void {
  if (failure === 'bulged') {
    memory.bulged = true;
    memory.volts = 0;
  } else memory.burnt = true;
}

/** The heat after `seconds` at a steady `load`, from `heat`, with the time constant `tau`: the exact step. */
export function heatStep(heat: number, load: number, seconds: number, tau: number): number {
  return load + (heat - load) * Math.exp(-seconds / tau);
}

/** How long a cold part takes to burn at a steady `load` with the time constant `tau`; never at a load up to 1. */
export function burnSeconds(load: number, tau: number): number {
  return load > 1 ? tau * Math.log(load / (load - 1)) : Number.POSITIVE_INFINITY;
}

/**
 * Lets `seconds` of model time pass at the operating point `dc` of `net`: the heat of every limited part on the board
 * moves toward its load, and a part that can burn and reaches 1 fails — it burns, or an electrolytic capacitor bulges.
 * Returns the ids of the parts that failed now; the next solve with this state knows them. A failed solve has no
 * load: the parts cool. A part the netlist does not hold keeps its heat. The transient (`transient.ts`) runs the same
 * steps at every moment of its own.
 */
export function advanceHeat(
  state: ModelState,
  net: Netlist | Circuit,
  dc: DcSolution,
  seconds: number,
): string[] {
  if (!(seconds >= 0 && Number.isFinite(seconds)))
    throw new RangeError(`time runs forward by a finite number of seconds: ${seconds}`);
  const parts = 'elements' in net ? net.net.parts : net.parts;
  const failed: string[] = [];
  for (const part of parts) {
    const spec = PARTS[part.spec];
    const tau = spec ? HEAT_SECONDS[spec.kind] : undefined;
    if (spec === undefined || tau === undefined || !limited(spec)) continue;
    const memory = memoryOf(state, part.id);
    if (damageOf(memory)) continue;
    memory.heat = heatStep(memory.heat, dc.status[part.id]?.load ?? 0, seconds, tau);
    if (memory.heat >= 1 && canBurn(spec)) {
      fail(memory, failureOf(spec));
      failed.push(part.id);
    }
  }
  return failed;
}
