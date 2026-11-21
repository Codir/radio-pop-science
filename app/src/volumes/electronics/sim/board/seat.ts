/**
 * What stands in which socket: the board's truth, one object per stand (never a variable of a module). The hand of
 * the bench changes it through the functions here when a leg or a plug has arrived in its socket, and the netlist
 * (`netlist.ts`) is read from it. One socket holds one leg or one plug; a probe of a meter is not held here, it touches
 * whatever is in its socket.
 */
import { footprintOf, legSockets, type Orientation } from './footprint';
import type { BoardLayout, SocketId } from './layout';

/** A part on the board: the socket of every leg (null — the leg is in the air), leg k as in its footprint. */
export interface Placed {
  readonly id: string;
  /** The key of the part in the catalog. */
  readonly spec: string;
  readonly legs: (SocketId | null)[];
}

export interface BoardState {
  /** The parts on the board by id, in the order they came. */
  readonly parts: Map<string, Placed>;
  /** The socket of every plug that is in one, by the lead's name (`'spk+'`); a plug not in a socket is absent. */
  readonly leads: Map<string, SocketId>;
  /** The setting of a part by id — a pot's knob, the battery's switch `SW` (`netlist.ts`); absent — the part's own
   * default. */
  readonly settings: Map<string, number>;
  /** The highest number given to each prefix of an id: ids are never given twice (`nextId`). */
  readonly serial: Map<string, number>;
}

export type Occupant = { readonly part: string; readonly leg: number } | { readonly lead: string };

/** Where a part is put: leg 0 in `anchor`, turned by `o`. */
export interface PartAt {
  readonly id: string;
  readonly spec: string;
  readonly anchor: SocketId;
  readonly o: Orientation;
}

export function createBoardState(): BoardState {
  return { parts: new Map(), leads: new Map(), settings: new Map(), serial: new Map() };
}

/** What is in the socket: a leg of a part, a plug, or nothing. */
export function occupant(s: BoardState, socket: SocketId): Occupant | null {
  for (const p of s.parts.values()) {
    const leg = p.legs.indexOf(socket);
    if (leg >= 0) return { part: p.id, leg };
  }
  for (const [lead, at] of s.leads) if (at === socket) return { lead };
  return null;
}

/** Whether a leg or a plug can go into the socket: it is on the board and free, or a leg of the part `except` (the
 * part being moved) is there. */
export function canSeat(layout: BoardLayout, s: BoardState, socket: SocketId, except?: string): boolean {
  if (layout.socket(socket) === undefined) return false;
  const there = occupant(s, socket);
  return there === null || ('part' in there && there.part === except);
}

/** The number of an id made of `prefix` and a whole number from 1, as `R12` for `R`; undefined for any other. */
function numberOf(id: string, prefix: string): number | undefined {
  if (prefix === '' || !id.startsWith(prefix)) return undefined;
  const digits = id.slice(prefix.length);
  return /^[1-9]\d*$/.test(digits) ? Number(digits) : undefined;
}

/** The next id for the prefix: `R1`, `R2` … — a counter of the board, never chance; an id once given or placed by
 * hand is never given again, so a new part never inherits what the model remembers of an old one. */
export function nextId(s: BoardState, prefix: string): string {
  const n = (s.serial.get(prefix) ?? 0) + 1;
  s.serial.set(prefix, n);
  return `${prefix}${n}`;
}

/**
 * Puts the part with all its legs, or not at all: false, and nothing changes, when the part does not stand in
 * sockets, its id is not its prefix and a number (`R1`, `LED2`), a leg falls off the board or onto a socket that is
 * taken, or the id is on the board as another part. A part already on the board is carried to the new place; its own
 * sockets count as free.
 */
export function place(layout: BoardLayout, s: BoardState, at: PartAt): boolean {
  const fp = footprintOf(at.spec);
  if (fp === null || fp.shape === 'lead') return false;
  const n = numberOf(at.id, fp.prefix);
  if (n === undefined) return false;
  const was = s.parts.get(at.id);
  if (was !== undefined && was.spec !== at.spec) return false;
  const anchor = layout.socket(at.anchor);
  if (anchor === undefined) return false;
  const sockets = legSockets(layout, fp, anchor, at.o);
  if (sockets.some((socket) => socket === null || !canSeat(layout, s, socket.id, at.id))) return false;
  s.parts.set(at.id, { id: at.id, spec: at.spec, legs: sockets.map((socket) => socket!.id) });
  s.serial.set(fp.prefix, Math.max(s.serial.get(fp.prefix) ?? 0, n));
  return true;
}

/** A part with the socket of every leg given (null — the leg is in the air). */
export interface PartLegs {
  readonly id: string;
  readonly spec: string;
  readonly legs: readonly (SocketId | null)[];
}

/**
 * Puts the part with exactly these sockets, one per leg as in its footprint, or not at all — the hand's way: a part in
 * the hand is on the bench with every leg in the air (out of the circuit, not pending), and comes down, or turns end
 * for end, with the legs where the hand puts them, in any shape (a re-seated leg's too). False, and nothing changes,
 * when the part does not stand in sockets, its id is not its prefix and a number, the count of legs is not its own, a
 * socket is off the board or taken, two legs share one, or the id is on the board as another part. The part's own
 * sockets count as free.
 */
export function put(layout: BoardLayout, s: BoardState, at: PartLegs): boolean {
  const fp = footprintOf(at.spec);
  if (fp === null || fp.shape === 'lead' || at.legs.length !== fp.offsets.length) return false;
  const n = numberOf(at.id, fp.prefix);
  if (n === undefined) return false;
  const was = s.parts.get(at.id);
  if (was !== undefined && was.spec !== at.spec) return false;
  const taken = at.legs.filter((socket): socket is SocketId => socket !== null);
  if (new Set(taken).size !== taken.length) return false;
  if (taken.some((socket) => !canSeat(layout, s, socket, at.id))) return false;
  s.parts.set(at.id, { id: at.id, spec: at.spec, legs: [...at.legs] });
  s.serial.set(fp.prefix, Math.max(s.serial.get(fp.prefix) ?? 0, n));
  return true;
}

/**
 * Moves one leg: into a free socket within the reach of the part (its footprint's `span` from every other leg in a
 * socket, measured on the board), or out into the air (`null`; the part then stays out of the circuit). False, and
 * nothing changes, when the part or the leg does not exist, the part's legs move only together, or the socket is off
 * the board, taken or out of reach.
 */
export function seatLeg(
  layout: BoardLayout,
  s: BoardState,
  part: string,
  leg: number,
  socket: SocketId | null,
): boolean {
  const p = s.parts.get(part);
  const span = p === undefined ? null : footprintOf(p.spec)?.span;
  if (p === undefined || !span || !Number.isInteger(leg) || leg < 0 || leg >= p.legs.length) return false;
  if (socket === null || socket === p.legs[leg]) {
    p.legs[leg] = socket;
    return true;
  }
  const to = layout.socket(socket);
  if (to === undefined || !canSeat(layout, s, socket)) return false;
  const pitch = layout.spec.pitch;
  for (const [k, other] of p.legs.entries()) {
    const from = k === leg || other === null ? undefined : layout.socket(other);
    if (from === undefined) continue;
    const apart = Math.hypot(to.x - from.x, to.z - from.z) / pitch;
    if (apart < span[0] - 1e-9 || apart > span[1] + 1e-9) return false;
  }
  p.legs[leg] = socket;
  return true;
}

/** Puts a plug into a free socket of the board or takes it out (`null`); false, and nothing changes, when the socket
 * is off the board or taken. */
export function seatLead(layout: BoardLayout, s: BoardState, lead: string, socket: SocketId | null): boolean {
  if (lead === '') return false;
  if (socket === null) {
    s.leads.delete(lead);
    return true;
  }
  if (s.leads.get(lead) !== socket && !canSeat(layout, s, socket)) return false;
  s.leads.set(lead, socket);
  return true;
}

/** Takes the part off the board for good, with its setting. Its id is not given again. */
export function remove(s: BoardState, id: string): void {
  s.parts.delete(id);
  s.settings.delete(id);
}

/** Sets the part's setting; false, and nothing changes, for a value that is not a finite number or an empty id. */
export function setSetting(s: BoardState, id: string, value: number): boolean {
  if (id === '' || !Number.isFinite(value)) return false;
  s.settings.set(id, value);
  return true;
}
