/**
 * A circuit as data: what the board builds from its sockets and the model solves. The model knows nothing of the
 * board; the board knows nothing of matrices. Units are SI everywhere (V, A, Ω, W); node 0 is the ground.
 */
import { PARTS } from './parts';

/** The ground: the node every voltage is measured from. */
export const GROUND = 0;

/** One part on the board. */
export interface PartInstance {
  /** Unique within the netlist; the key of the part in a solution. */
  id: string;
  /** The key of the part in the catalog (`PARTS`), for example `'resistor-4k7'`. */
  spec: string;
  /** The node of every pin, in the order of the catalog's pins. */
  pins: number[];
  /** A pot: the share of the track from `ccw` to the wiper, 0…1 (0.5 when absent). A switch: 0 open, 1 closed (open
   * when absent). Other parts ignore it. */
  setting?: number;
}

/** A whole circuit: the nodes 0 … nodes − 1 and the parts between them. */
export interface Netlist {
  /** How many nodes, the ground included. A node no pin uses costs nothing. */
  nodes: number;
  parts: PartInstance[];
}

/** Throws a RangeError naming the first fault of the netlist: the number of nodes, an id, a key, a pin, a setting. */
export function checkNetlist(net: Netlist): void {
  if (!Number.isInteger(net.nodes) || net.nodes < 1)
    throw new RangeError(`nodes must be a whole number ≥ 1: ${net.nodes}`);
  const ids = new Set<string>();
  for (const part of net.parts) {
    if (typeof part.id !== 'string' || part.id === '') throw new RangeError('a part without an id');
    if (ids.has(part.id)) throw new RangeError(`two parts with the id ${part.id}`);
    ids.add(part.id);
    const spec = Object.hasOwn(PARTS, part.spec) ? PARTS[part.spec] : undefined;
    if (spec === undefined) throw new RangeError(`${part.id}: no part ${part.spec} in the catalog`);
    if (!Array.isArray(part.pins) || part.pins.length !== spec.pins.length)
      throw new RangeError(`${part.id}: ${part.spec} has ${spec.pins.length} pins (${spec.pins.join(', ')})`);
    for (const node of part.pins)
      if (!Number.isInteger(node) || node < 0 || node >= net.nodes)
        throw new RangeError(`${part.id}: no node ${node} among 0 … ${net.nodes - 1}`);
    checkSetting(part);
  }
}

/** Throws a RangeError when the part's setting is there but is not a finite number. */
export function checkSetting(part: PartInstance): void {
  if (part.setting !== undefined && !Number.isFinite(part.setting))
    throw new RangeError(`${part.id}: the setting must be a finite number: ${part.setting}`);
}
