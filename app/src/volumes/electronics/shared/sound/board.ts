/**
 * The board the sound check plays (the sandbox `_dev/_sandbox-electronics-sound`): the player, a low-pass filter —
 * a resistor from the player and 100 nF to the ground after it — or a jumper in its place, then the volume's
 * amplifier (`amplifierNetlist`) and its 8 Ω speaker. This is the filter of the step `filter/lows` of PATH.md, between
 * the player and the volume control. A filter straight on the speaker would not filter: 8 Ω beside 100 nF take the
 * edge of the filter above 200 kHz, and the resistor only divides the level (README.md, «The board»).
 * A sandbox imports only `shared/**` of the volume, so what it needs of `sim/core` comes through here.
 */
import {
  AMPLIFIER_NODES,
  amplifierNetlist,
  E12,
  type Netlist,
  PARTS,
  resistorKey,
} from '@electronics/sim/core';
import type { ProbeSpec } from './protocol';

export type { Netlist } from '@electronics/sim/core';

/** The nodes of the board: the amplifier's, and the player's own before the filter. */
export const BOARD_NODES = Object.freeze({ ...AMPLIFIER_NODES, source: AMPLIFIER_NODES.speaker + 1 });

/** The filter's capacitor (the catalog's key). */
export const FILTER_CAPACITOR = 'ceramic-100n';

/** The filter's resistors: the series E12 from 100 Ω to 100 kΩ (Ω). */
export const FILTER_OHMS: readonly number[] = Object.freeze(
  [100, 1000, 10000].flatMap((decade) => E12.map((d) => Math.round(d * decade) / 10)).concat(100000),
);

/** What a block records, in this order: the speaker's current (the sound) and the voltage on it (the scope). */
export const BOARD_PROBES: readonly ProbeSpec[] = Object.freeze([
  { part: 'LS1' },
  { node: BOARD_NODES.speaker },
]);

const speaker = PARTS['speaker-8']!;
/**
 * The speaker's current that is full scale for the sound (A): its rated power as a steady current, √(2 W / 8 Ω) =
 * 0.5 A — a little above the 0.45 A the amplifier gives at the top of its volume control, where it clips.
 */
export const SPEAKER_FULL_SCALE =
  speaker.kind === 'speaker' ? Math.sqrt((speaker.limits.powerW ?? 0) / speaker.ohms) : Number.NaN;

/** The board: the player straight into the amplifier (`ohms` null), or through the low-pass of `ohms` and 100 nF. */
export function filterBoard(ohms: number | null): Netlist {
  const net = amplifierNetlist({ source: 'player' });
  const { source, player } = BOARD_NODES;
  net.nodes = source + 1;
  for (const part of net.parts) if (part.id === 'PL') part.pins = [source, 0];
  if (ohms === null) net.parts.push({ id: 'J1', spec: 'jumper', pins: [source, player] });
  else
    net.parts.push(
      { id: 'RF', spec: resistorKey(ohms), pins: [source, player] },
      { id: 'CF', spec: FILTER_CAPACITOR, pins: [player, 0] },
    );
  return net;
}
