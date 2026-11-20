/**
 * The board as the model sees it: every row of sockets is a node, every part with all its legs in sockets is a part of
 * the netlist, and the fixed parts of the bench join them — the battery behind its switch on the rails, the things off
 * the board on their plug leads. The rows keep their nodes whatever stands on the board (`layout.ts`); the battery's own
 * node (between it and its switch) comes after them.
 */
import type { Netlist, PartInstance } from '../core';
import { footprintOf } from './footprint';
import type { BoardLayout, RowId, SocketId } from './layout';
import type { BoardState } from './seat';

/** Where a pin of a fixed part goes: a row of the board, a node of the bench's own (named), or the socket of a plug. */
export type PinTo = { readonly row: RowId } | { readonly private: string } | { readonly lead: string };

/** A part that is always on the bench, off the board's sockets. Its setting is in the board's state, by id. */
export interface FixedPart {
  readonly id: string;
  readonly spec: string;
  /** In the order of the catalog's pins. */
  readonly pins: readonly PinTo[];
}

/**
 * The fixed parts of the bench (VISUAL.md §2): the 9 V battery's minus on the − rail, its plus through the slide switch
 * `SW` (open until a setting closes it) to the + rail; the speaker and the lamp stand off the board, each with two plug
 * leads. None has an id a part from the tray can get. The player joins when the catalog has it (E1-7).
 */
export const BENCH_FIXED: readonly FixedPart[] = [
  { id: 'BAT', spec: 'battery-9v', pins: [{ private: 'bat+' }, { row: '-' }] },
  { id: 'SW', spec: 'switch', pins: [{ private: 'bat+' }, { row: '+' }] },
  { id: 'SPK', spec: 'speaker-8', pins: [{ lead: 'spk+' }, { lead: 'spk-' }] },
  { id: 'LAMP', spec: 'lamp-6v', pins: [{ lead: 'lamp1' }, { lead: 'lamp2' }] },
];

export interface BoardNet {
  /** What the model solves: `nodes` = the rows and then the bench's own nodes. */
  readonly net: Netlist;
  /** Parts left out because some of their legs or plugs are in sockets and some not: a leg in the air. A part or a
   * thing with nothing in a socket is out of the circuit without being pending. */
  readonly pending: readonly string[];
  /** The circuit's shape — every part's id, key and nodes, sorted — and nothing else: a new `compile` is needed only
   * when it changes. A setting does not change it. */
  readonly key: string;
}

/**
 * The netlist of what is on the board now. `extra` are parts that are not on the board, with their nodes given (the
 * meter in the A mode between the rows of its probes); their ids must differ from the board's and the fixed parts'.
 * Every part of the result has a node for every pin in the order of the catalog, so the model never gets a malformed
 * netlist from the board.
 */
export function netlistOf(
  layout: BoardLayout,
  s: BoardState,
  fixed: readonly FixedPart[] = BENCH_FIXED,
  extra: readonly PartInstance[] = [],
): BoardNet {
  const own = new Map<string, number>();
  for (const f of fixed)
    for (const pin of f.pins)
      if ('private' in pin && !own.has(pin.private)) own.set(pin.private, layout.rows.length + own.size);

  const parts: PartInstance[] = [];
  const pending: string[] = [];
  const nodeAt = (socket: SocketId | null | undefined): number | undefined =>
    socket === null || socket === undefined ? undefined : layout.socket(socket)?.node;
  /** The part with a node for every pin, or pending: `byLeg[k]` is the node of leg k, which carries the catalog pin
   * `pinOfLeg[k]` (pin k when absent). */
  const add = (
    id: string,
    spec: string,
    byLeg: (number | undefined)[],
    pinOfLeg?: readonly number[],
  ): void => {
    const seated = byLeg.filter((n) => n !== undefined).length;
    if (seated < byLeg.length) {
      if (seated > 0) pending.push(id);
      return;
    }
    const pins = new Array<number>(byLeg.length);
    byLeg.forEach((node, k) => (pins[pinOfLeg?.[k] ?? k] = node!));
    const setting = s.settings.get(id);
    parts.push(setting === undefined ? { id, spec, pins } : { id, spec, pins, setting });
  };

  for (const f of fixed) {
    const byPin = f.pins.map((pin) => {
      if ('lead' in pin) return nodeAt(s.leads.get(pin.lead));
      if ('private' in pin) return own.get(pin.private)!;
      const node = layout.node(pin.row);
      if (node < 0) throw new RangeError(`${f.id}: no row ${pin.row} on the board`);
      return node;
    });
    add(f.id, f.spec, byPin);
  }
  for (const p of s.parts.values()) {
    const fp = footprintOf(p.spec);
    if (fp !== null && fp.pins.length === p.legs.length) add(p.id, p.spec, p.legs.map(nodeAt), fp.pins);
  }
  for (const e of extra) parts.push({ ...e, pins: [...e.pins] });

  const nodes = layout.rows.length + own.size;
  const shape = parts.map((p) => `${p.id}:${p.spec}:${p.pins.join(',')}`).sort();
  return { net: { nodes, parts }, pending, key: `${nodes}|${shape.join('|')}` };
}
