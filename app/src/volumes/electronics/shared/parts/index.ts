/**
 * The parts of the bench with their real marks (docs/volumes/electronics/VISUAL.md §4): the resistor with its value in
 * colour bands, the diodes, the LEDs, the variable resistor, the jumper, the capacitors of three kinds and the
 * transistors in TO-92 that stand in the board's sockets, and the permanent things of the base — the 9 V battery in its
 * box, the player, the speaker and the lamp (the circuit's bulb, made smaller).
 *
 * `buildPart(key)` makes the model of a key of the circuit model's catalog (`sim/core` `PARTS`); a key it has no model
 * for — a thing that does not stand in sockets, or a key the catalog does not have (yet) — gives null. Its table is
 * partial by kind, never an exhaustive switch: the kinds the catalog gains in other tasks (capacitors E1-5, transistors
 * E1-6) are bound here already, by the fields of their specs, and their models are built from VISUAL's tables.
 */
import { PARTS, type PartKind, type PartSpec } from '@electronics/sim/core';
import { TO92_LEGS } from '@electronics/sim/board';
import { createCeramic, createElectrolytic, createFilm } from './capacitors';
import { DIODES, createDiode } from './diode';
import { createJumper } from './jumper';
import { createLed } from './led';
import type { PartModel } from './part';
import { createPot } from './pot';
import { createResistor } from './resistor';
import { TRANSISTORS, createTransistor } from './transistor';

export * from './code';
export {
  AXIAL_Y,
  LEG,
  LEG_COLOR,
  LEGIBLE,
  LOOK_AT_REST,
  MM,
  RADIAL_Y,
  type PartEye,
  type PartLook,
  type PartModel,
  type PartStatus,
  type PartView,
} from './part';
export * from './resistor';
export * from './diode';
export * from './led';
export * from './pot';
export * from './jumper';
export * from './capacitors';
export * from './transistor';
export * from './speaker';
export * from './battery9v';
export * from './player';
export * from './bulb';
export * from './heat-scale';

/** The kinds the table knows: the catalog's, and those it gains in other tasks. */
type Kind = PartKind | 'capacitor' | 'transistor';
type Maker = (key: string, spec: PartSpec) => PartModel | null;

/** A finite number field of a spec, read by name (a kind the catalog's types do not list yet). */
function numberField(spec: PartSpec, name: string): number | undefined {
  const v = (spec as unknown as Record<string, unknown>)[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function capacitor(key: string, spec: PartSpec): PartModel | null {
  const dielectric = (spec as unknown as Record<string, unknown>).dielectric;
  const farads = numberField(spec, 'farads');
  if (farads === undefined || farads <= 0) return null;
  if (dielectric === 'ceramic') return createCeramic(farads, key);
  if (dielectric === 'film') return createFilm(farads, key);
  const volts = numberField(spec, 'ratedV');
  return dielectric === 'electrolytic' && volts !== undefined ? createElectrolytic(farads, volts, key) : null;
}

/** A battery, a switch, a source, a speaker, a lamp or the player stand off the board (or never on the bench). */
const MAKERS: Partial<Record<Kind, Maker>> = {
  resistor: (key, spec) => (spec.kind === 'resistor' ? createResistor(spec.ohms, spec.tolerance, key) : null),
  diode: (key) => (Object.hasOwn(DIODES, key) ? createDiode(DIODES[key]!, key) : null),
  led: (key, spec) => (spec.kind === 'led' ? createLed(spec.color, key) : null),
  pot: (key, spec) => (spec.kind === 'pot' ? createPot(spec.ohms, key) : null),
  jumper: (key) => createJumper(key),
  capacitor,
  transistor: (key) =>
    Object.hasOwn(TRANSISTORS, key) && Object.hasOwn(TO92_LEGS, key) ? createTransistor(key) : null,
};

/**
 * The model of the part `key` of the catalog, standing on its nominal tips (leg 0 at the origin, the legs along +x at
 * the footprint's pitch); null when the bench has no model for it. `spec` stands in for the catalog's (tests).
 */
export function buildPart(key: string, spec?: PartSpec): PartModel | null {
  const s = spec ?? (Object.hasOwn(PARTS, key) ? PARTS[key] : undefined);
  if (s === undefined) return null;
  return MAKERS[s.kind as Kind]?.(key, s) ?? null;
}
