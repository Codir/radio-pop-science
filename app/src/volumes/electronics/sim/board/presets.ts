/**
 * The boards the chapters put on the bench as data (docs/superpowers/plans/2026-11-20-electronics/batch-E3.md, plan
 * decision 14): a step's parts with their sockets and the plugs of the things off the board, which `bench.preset`
 * seats at once — through `seatPreset` here, the same pure maths a test runs without the bench.
 *
 * - `LED_LOOP` — the red LED's loop of the chapters `resistor` and `resistor-pick` (their scripts' «Бачимо»): + rail →
 *   J1 → 5ae → 330 Ω along the line b → 9ae → the LED → 10ae → J2 → − rail. Their steps take it as it is, or leave a
 *   part of it out.
 * - `AMPLIFIER_IDS` — how the amplifier's ids (`sim/core` `amplifierNetlist`, E1-6) are named on the bench: its
 *   battery, switch, player and speaker are the bench's own fixed parts, its volume control a pot on the board. The
 *   amplifier's layout on the board is not here yet: the one `shared/model/__tests__/driver.test.ts` (E2-M) solved puts
 *   twelve pairs of bodies in one place, and none found in task E3-5 keeps every body, leg, jumper and plug clear of
 *   the others (`shared/README.md`, «Boards of the steps»).
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
