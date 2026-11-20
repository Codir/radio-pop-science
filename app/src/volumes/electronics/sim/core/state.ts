/**
 * What the model remembers between solves. One object per stand — two copies of a chapter side by side at a chapter
 * boundary hold two — and never a variable of a module. It lives longer than a netlist: the board changes, the state
 * stays, so what it keeps is by node number and by part id: how warm every part is, whether it burnt or bulged, the
 * temperature of a lamp's filament and the charge of a capacitor.
 */
import type { PartKind } from './parts';

/** What the model remembers of one part, by its id. */
export interface PartMemory {
  /** How warm the part is, as a share of its limit: 0 cold, the part's load when it has run long enough; a part that
   * can burn burns when it reaches 1 (`limits.ts`). */
  heat: number;
  /** The part burnt: from now on it is a gap in the circuit, until the stand forgets it (a new part). */
  burnt: boolean;
  /** An electrolytic capacitor bulged: from now on it has no capacitance, only a large leak (`capacitor.ts`), until
   * the stand forgets it. */
  bulged?: boolean;
  /** A lamp: the temperature of its filament (K). */
  kelvin?: number;
  /** A capacitor: the voltage across its capacitance (V) — its charge over its capacitance. */
  volts?: number;
}

export interface ModelState {
  /** The node voltages of the last solve that succeeded, by node number (empty before the first): the first guess
   * of the next solve's Newton iterations. */
  v: Float64Array;
  /** The memory of every part the model has seen, by id. A stand that takes a part off the board for good, or puts a
   * new one in its place, deletes its entry. */
  parts: Map<string, PartMemory>;
}

export function createModelState(): ModelState {
  return { v: new Float64Array(0), parts: new Map() };
}

/** The memory of the part `id`, made cold and whole the first time it is asked for. */
export function memoryOf(state: ModelState, id: string): PartMemory {
  let memory = state.parts.get(id);
  if (memory === undefined) {
    memory = { heat: 0, burnt: false };
    state.parts.set(id, memory);
  }
  return memory;
}

/** The level of a part with a state in time as its memory keeps it — a capacitor's voltage, a lamp's temperature —
 * or `otherwise` when it keeps none (a part the state has not seen in time: empty, cold). */
export function levelOf(memory: PartMemory, kind: PartKind, otherwise: number): number {
  const level = kind === 'capacitor' ? memory.volts : kind === 'lamp' ? memory.kelvin : undefined;
  return level ?? otherwise;
}

/** Keeps the level of a part with a state in time in its memory. */
export function keepLevel(memory: PartMemory, kind: PartKind, level: number): void {
  if (kind === 'capacitor') memory.volts = level;
  else if (kind === 'lamp') memory.kelvin = level;
}
