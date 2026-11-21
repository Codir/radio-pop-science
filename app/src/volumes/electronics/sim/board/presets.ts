/**
 * The boards the chapters put on the bench as data (docs/superpowers/plans/2026-11-20-electronics/batch-E3.md, plan
 * decision 14): a step's parts with their sockets and the plugs of the things off the board, which `bench.preset`
 * seats at once — through `seatPreset` here, the same pure maths a test runs without the bench.
 *
 * - `LED_LOOP` — the red LED's loop of the chapters `resistor` and `resistor-pick` (their scripts' «Бачимо»): + rail →
 *   J1 → 5ae → 330 Ω along the line b → 9ae → the LED → 10ae → J2 → − rail. Their steps take it as it is, or leave a
 *   part of it out.
 * - `AMPLIFIER_IDS` — how the amplifier's ids (`sim/core` `amplifierNetlist`, E1-6) are named on the bench: its
 *   battery, switch, player and speaker are the bench's own fixed parts, its volume control a pot on the board.
 * - `AMPLIFIER_PRESET` — the amplifier of E1-6 built on the board (the prologue's, and the board the chapters of the
 *   path take a part of): its sixteen parts on their sockets, ten jumpers, the player's and the speaker's plugs.
 *   With the jumpers taken as the wires they stand for its nodes are `amplifierNetlist`'s, one by one; every body,
 *   leg, jumper and plug stands clear of the others, and every plug within its lead (`shared/README.md`, «Boards of
 *   the steps»).
 */
import type { BoardLayout, SocketId } from './layout';
import type { Orientation } from './footprint';
import { footprintOf } from './footprint';
import { createBoardState, place, put, seatLead, setSetting, type BoardState } from './seat';

/** A part a step puts on the board: leg 0 in `at`, turned by `o` (default 0: the legs along the line, to the right). */
export interface PresetPart {
  /** The id on the board: the footprint's letters and a number (`R1`, `LED2`). */
  readonly id: string;
  /** The key of the catalog (`resistor-4k7`). */
  readonly spec: string;
  readonly at: SocketId;
  readonly o?: Orientation;
  /**
   * A part of two legs that may stand at any span within its reach (a jumper, 1 … 16 P; a resistor 4 … 6 P): its
   * leg 1 here instead of where `o` would put it — a jumper from a rail to the row it feeds.
   */
  readonly to?: SocketId;
  /** A pot's setting 0…1. */
  readonly setting?: number;
}

/** A board of a step: its parts and the plugs of the fixed things (`spk+`, `pl-` …) with their sockets. */
export interface BoardPreset {
  readonly parts: readonly PresetPart[];
  readonly leads: Readonly<Record<string, SocketId>>;
}

/** A part of two legs from `a` to `b` stands within its reach: its footprint's span, measured on the board. */
export function spans(layout: BoardLayout, spec: string, a: SocketId, b: SocketId): boolean {
  const fp = footprintOf(spec);
  const sa = layout.socket(a);
  const sb = layout.socket(b);
  if (!fp?.span || fp.offsets.length !== 2 || !sa || !sb) return false;
  const apart = Math.hypot(sb.x - sa.x, sb.z - sa.z) / layout.spec.pitch;
  return apart >= fp.span[0] - 1e-9 && apart <= fp.span[1] + 1e-9;
}

/**
 * Seats the parts and the plugs on the board `s` in their order (a plug `null` is taken out): a part that does not
 * stand where it is put, or a plug that does not go into its socket, is a RangeError — a step's board is data, and a
 * wrong one must not show up as a part missing on the screen. The bench calls it from `preset` after it has taken the
 * old parts off.
 */
export function seatPreset(
  layout: BoardLayout,
  s: BoardState,
  parts: readonly PresetPart[],
  leads: Readonly<Record<string, SocketId | null>> = {},
  plugs?: ReadonlySet<string>,
): void {
  for (const p of parts) {
    const stands =
      p.to === undefined
        ? place(layout, s, { id: p.id, spec: p.spec, anchor: p.at, o: p.o ?? 0 })
        : spans(layout, p.spec, p.at, p.to) && put(layout, s, { id: p.id, spec: p.spec, legs: [p.at, p.to] });
    if (!stands) {
      const where = p.to === undefined ? `at ${p.at}, o ${p.o ?? 0}` : `from ${p.at} to ${p.to}`;
      throw new RangeError(`preset: ${p.id} (${p.spec}) does not stand ${where}`);
    }
    if (p.setting !== undefined) setSetting(s, p.id, p.setting);
  }
  for (const [name, socket] of Object.entries(leads)) {
    if ((plugs !== undefined && !plugs.has(name)) || !seatLead(layout, s, name, socket)) {
      throw new RangeError(`preset: the plug ${name} does not go into ${socket}`);
    }
  }
}

/** The plugs of the bench's fixed things (`netlist.ts` `BENCH_FIXED`), by name. */
const PLUGS: ReadonlySet<string> = new Set(['spk+', 'spk-', 'lamp1', 'lamp2', 'pl+', 'pl-']);

/** A fresh board holding a preset (the battery's switch as the board's default: open). */
export function presetState(layout: BoardLayout, preset: BoardPreset): BoardState {
  const s = createBoardState();
  seatPreset(layout, s, preset.parts, preset.leads, PLUGS);
  return s;
}

/**
 * The amplifier's ids (`amplifierNetlist`) that are another id on the board: its battery and its switch are the
 * bench's own `BAT` and `SW`, the player and the speaker the bench's `PLAYER` and `SPK` (`BENCH_FIXED`), and the volume
 * control `VR1` is `P1` (a pot's id on the board is its footprint's letter P and a number). Every other part keeps
 * its id.
 */
export const AMPLIFIER_IDS: Readonly<Record<string, string>> = Object.freeze({
  B1: 'BAT',
  S1: 'SW',
  PL: 'PLAYER',
  LS1: 'SPK',
  VR1: 'P1',
});

/** The red LED's loop of `resistor` and `resistor-pick`: + rail → J1 → 5ae → R1 330 Ω (b5 … b9) → 9ae → LED1 (anode
 * c9, cathode c10) → 10ae → J2 → − rail. */
export const LED_LOOP: BoardPreset = Object.freeze({
  parts: Object.freeze([
    { id: 'J1', spec: 'jumper', at: '+5', to: 'a5' },
    { id: 'R1', spec: 'resistor-330', at: 'b5' },
    { id: 'LED1', spec: 'led-red', at: 'c9' },
    { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
  ] satisfies PresetPart[]),
  leads: Object.freeze({}),
});

/**
 * The amplifier of E1-6 (`amplifierNetlist`, the bench's player as its source, the volume control at its middle) on
 * the board. Where its nodes are (a row is a column's five sockets on one side of the channel: `13ae`):
 *
 * - the supply: the + rail, by J10 1ae, the protection diode D1 on the line b to 5ae — the upper transistor Q2's
 *   collector, the LED's resistor R1 across the channel to 5fj, where the LED «on» stands in front with its cathode in
 *   the − rail; by J8 2ae: the reservoir C3 across the channel (its minus on 2fj, J9 to the rail) and the driver's
 *   load R5 on the line a;
 * - the output stage: Q2 on the line c (collector 5ae, base 6ae — the top of the diodes, where R5 ends —, emitter
 *   7ae), the lower transistor Q3 on the line g (emitter 7fj, base 8fj, collector 9fj), J7 joins the emitters; D2
 *   across the channel from the top 6ae to the middle 6fj, D3 on to the driver 10fj, Q1's collector (J6 to Q3's
 *   base): no jumper carries the diodes' current between the two bases, whose voltages set the pair's bias; the output
 *   7ae with the output capacitor C2 on the line a to the speaker's row 10ae, where `spk+` goes;
 * - the driver Q1 on the line g (collector 10fj, base 11fj, emitter 12fj): its base with the feedback R3 from the
 *   output 7fj, R4 to the ground 15fj and the input resistor R2 across the channel from 11ae, where the input capacitor
 *   C1 stands on the line a with its minus on 12ae, which J2 joins to the wiper's row 15ae; the volume control P1 on
 *   the line b at the far right by the player (ground 17ae, wiper 15ae, the player's 13ae, where `pl+` goes), nothing
 *   tall in front of its knob;
 * - the ground: the − rail, and by jumpers the rows 17ae (J1: the pot, `pl-`, `spk-`), 12fj (J3: Q1's emitter, and by
 *   J5 Q3's collector on 9fj), 15fj (J4: R4) and 2fj (J9: C3).
 *
 * The tall cans stand at the back: C1 and C2 on the line a, C3 across the channel at the left.
 */
export const AMPLIFIER_PRESET: BoardPreset = Object.freeze({
  parts: Object.freeze([
    { id: 'D1', spec: 'diode-1n4007', at: 'b1' },
    { id: 'C3', spec: 'electrolytic-470u-16v', at: 'e2', o: 1 },
    { id: 'R1', spec: 'resistor-2k2', at: 'e5', o: 1 },
    { id: 'LED1', spec: 'led-red', at: 'j5', o: 1 },
    { id: 'P1', spec: 'pot-10k', at: 'b17', o: 2, setting: 0.5 },
    { id: 'C1', spec: 'electrolytic-10u-16v', at: 'a11' },
    { id: 'R2', spec: 'resistor-1k5', at: 'b11', o: 1 },
    { id: 'R3', spec: 'resistor-47k', at: 'j7' },
    { id: 'R4', spec: 'resistor-18k', at: 'i11' },
    { id: 'Q1', spec: 'transistor-bc547b', at: 'g10' },
    { id: 'R5', spec: 'resistor-470', at: 'a2' },
    { id: 'D2', spec: 'diode-1n4007', at: 'd6', o: 1 },
    { id: 'D3', spec: 'diode-1n4007', at: 'i6' },
    { id: 'Q2', spec: 'transistor-bc337-25', at: 'c5' },
    { id: 'Q3', spec: 'transistor-bc327-25', at: 'g9', o: 2 },
    { id: 'C2', spec: 'electrolytic-470u-16v', at: 'a7', to: 'a10' },
    { id: 'J1', spec: 'jumper', at: 'e17', to: '-17' },
    { id: 'J2', spec: 'jumper', at: 'e12', to: 'e15' },
    { id: 'J3', spec: 'jumper', at: 'j12', to: '-12' },
    { id: 'J4', spec: 'jumper', at: 'j15', to: '-15' },
    { id: 'J5', spec: 'jumper', at: 'h9', to: 'h12' },
    { id: 'J6', spec: 'jumper', at: 'f8', to: 'f10' },
    { id: 'J7', spec: 'jumper', at: 'd7', to: 'f7' },
    { id: 'J8', spec: 'jumper', at: 'd2', to: 'd5' },
    { id: 'J9', spec: 'jumper', at: 'j2', to: '-2' },
    { id: 'J10', spec: 'jumper', at: '+1', to: 'a1' },
  ] satisfies PresetPart[]),
  leads: Object.freeze({ 'pl+': 'c13', 'pl-': 'c17', 'spk+': 'c10', 'spk-': 'a17' }),
});
