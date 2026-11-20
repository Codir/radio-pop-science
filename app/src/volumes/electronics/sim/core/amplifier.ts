/**
 * The amplifier of the volume: the circuit the reader builds in the chapter `amplifier` and the thread of the whole
 * course, as data — the netlist a stand puts on its board, the names of its nodes for the probe and what every part
 * does there. Three transistors from a 9 V battery play the player into the 8 Ω speaker: the driver BC547B, its gain
 * set by feedback from the output, and the push-pull pair BC337-25 / BC327-25 that gives the speaker its current,
 * within its makers' ratings at every setting of the volume. ngspice checks it (tools/ref-models/electronics/cases.py
 * builds the same netlist); why this circuit and not another, and its numbers: README.md, «The amplifier».
 */
import type { Netlist, PartInstance } from './netlist';

/** The nodes of the amplifier by name, where a probe may go. */
export const AMPLIFIER_NODES = Object.freeze({
  /** The plus of the battery. */
  battery: 1,
  /** After the switch. */
  switched: 2,
  /** The supply of the circuit: after the protection diode, on the reservoir capacitor. */
  supply: 3,
  /** Between the LED's resistor and the LED. */
  led: 4,
  /** The output of the player (the tone behind its internal resistance). */
  player: 5,
  /** The wiper of the volume control: what goes into the amplifier. */
  volume: 6,
  /** Between the input capacitor and the input resistor. */
  coupled: 7,
  /** The base of the driver. */
  base: 8,
  /** The base of the upper output transistor, at the top of the two diodes. */
  top: 9,
  /** Between the two diodes. */
  middle: 10,
  /** The collector of the driver and the base of the lower output transistor, at the bottom of the two diodes. */
  driver: 11,
  /** The emitters of the output pair: the output, near half the supply at rest. */
  output: 12,
  /** The plus of the speaker, after the output capacitor. */
  speaker: 13,
});

/** How the stand puts the amplifier on its board. */
export interface AmplifierOptions {
  /** The volume control: 0 silent … 1 full (0.5 when absent). */
  volume?: number;
  /** The switch closed (true when absent). */
  on?: boolean;
  /** The battery the wrong way round: its plus on the ground row (false when absent). */
  reversed?: boolean;
  /** The catalog key of the source in the player's place: a sine source (its setting is its frequency) or the player
   * `player` with the volume's melody (its setting is its amplitude). The test tone `player-tone` when absent. */
  source?: string;
}

/** The amplifier's netlist: a new object each time, which the stand may change (a knob, a part taken out). */
export function amplifierNetlist(options: AmplifierOptions = {}): Netlist {
  const { volume = 0.5, on = true, reversed = false, source = 'player-tone' } = options;
  const n = AMPLIFIER_NODES;
  const part = (id: string, spec: string, pins: number[], setting?: number): PartInstance =>
    setting === undefined ? { id, spec, pins } : { id, spec, pins, setting };
  return {
    nodes: n.speaker + 1,
    parts: [
      part('B1', 'battery-9v', reversed ? [0, n.battery] : [n.battery, 0]),
      part('S1', 'switch', [n.battery, n.switched], on ? 1 : 0),
      part('D1', 'diode-1n4007', [n.switched, n.supply]),
      part('C3', 'electrolytic-470u-16v', [n.supply, 0]),
      part('R1', 'resistor-2k2', [n.supply, n.led]),
      part('LED1', 'led-red', [n.led, 0]),
      part('PL', source, [n.player, 0]),
      part('VR1', 'pot-10k', [0, n.volume, n.player], volume),
      part('C1', 'electrolytic-10u-16v', [n.coupled, n.volume]),
      part('R2', 'resistor-1k5', [n.coupled, n.base]),
      part('R3', 'resistor-47k', [n.output, n.base]),
      part('R4', 'resistor-18k', [n.base, 0]),
      part('Q1', 'transistor-bc547b', [n.driver, n.base, 0]),
      part('R5', 'resistor-470', [n.supply, n.top]),
      part('D2', 'diode-1n4007', [n.top, n.middle]),
      part('D3', 'diode-1n4007', [n.middle, n.driver]),
      part('Q2', 'transistor-bc337-25', [n.supply, n.top, n.output]),
      part('Q3', 'transistor-bc327-25', [0, n.driver, n.output]),
      part('C2', 'electrolytic-470u-16v', [n.output, n.speaker]),
      part('LS1', 'speaker-8', [n.speaker, 0]),
    ],
  };
}

/** What a part does in the amplifier. */
export interface AmplifierRole {
  /** The chapter of the part's own kind where one sentence explains this job (an id of the journey). */
  readonly chapter: string;
  /** The job, for the builders of the stand and the writers of the chapters. */
  readonly role: string;
}

/** Every part of the amplifier by id: its job and the chapter that explains it. */
export const AMPLIFIER_ROLES: Readonly<Record<string, AmplifierRole>> = Object.freeze({
  B1: { chapter: 'prologue', role: 'the 9 V battery: all the energy the speaker gets comes from it' },
  S1: { chapter: 'prologue', role: 'the switch: off, the battery gives nothing and the speaker is silent' },
  D1: {
    chapter: 'diode',
    role: 'protection: a battery put in the wrong way round finds the diode shut and the circuit unharmed',
  },
  C3: {
    chapter: 'capacitor',
    role: 'the reservoir: it holds a charge beside the circuit and gives the loud peaks their current at once',
  },
  R1: {
    chapter: 'resistor-pick',
    role: 'the LED’s resistor: 3 mA are enough for a lamp that only says «on»',
  },
  LED1: { chapter: 'led', role: 'the light «on»: it lights while the switch is closed' },
  PL: { chapter: 'prologue', role: 'the player: a weak signal, 0.3 V at most behind 32 Ω' },
  VR1: {
    chapter: 'divider',
    role: 'the volume control: a divider that passes on a share of the player’s signal',
  },
  C1: {
    chapter: 'filter',
    role: 'the input capacitor: it lets the music in and keeps the driver’s 0.7 V of bias from the volume control',
  },
  R2: {
    chapter: 'resistor',
    role:
      'the input resistor: with R3 it caps the gain at R3/R2, about 31; one driver cannot give the feedback that ' +
      'much to spare, so the gain is about 16 and follows the driver’s β (13 to 18 over its spread)',
  },
  R3: {
    chapter: 'divider',
    role:
      'the feedback resistor: the output settles where R4’s current and the driver’s base current, both through ' +
      'R3, hold the base at 0.69 V — a loaded divider, so the output rests at 3.8 V, not the 2.5 V of R3 and R4 alone',
  },
  R4: {
    chapter: 'divider',
    role: 'the lower leg of that divider, from the base to the ground; the driver’s base current loads it',
  },
  Q1: {
    chapter: 'amplifier',
    role: 'the driver: a small current into its base controls the large current of its collector',
  },
  R5: {
    chapter: 'resistor',
    role: 'the driver’s load: it brings the current that opens the upper output transistor',
  },
  D2: {
    chapter: 'diode',
    role:
      'one of two diodes whose 1.24 V keep both output transistors at the edge of opening, so the current ' +
      'passes from one to the other without a gap',
  },
  D3: { chapter: 'diode', role: 'the second of those two diodes' },
  Q2: {
    chapter: 'transistor',
    role: 'the upper output transistor: it pushes current from the supply into the speaker, up to 0.37 A of its 0.5 A',
  },
  Q3: {
    chapter: 'transistor',
    role: 'the lower output transistor: it pulls the current back through the speaker to the ground, as much again',
  },
  C2: {
    chapter: 'filter',
    role: 'the output capacitor: it passes the music to the speaker and keeps the steady half supply off it',
  },
  LS1: { chapter: 'prologue', role: 'the 8 Ω speaker: it turns the current it gets into sound' },
});
