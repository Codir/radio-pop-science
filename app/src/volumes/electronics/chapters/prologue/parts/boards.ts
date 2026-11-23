/**
 * The chapter's board as data (the script's «Бачимо»; `sim/board` `AMPLIFIER_PRESET`): every step puts the volume's
 * amplifier on the board; what changes is where the player's and the speaker's plugs go (past the amplifier in
 * `quiet`, on its input and output after), the battery's switch, the player, the volume knob and what the hand may
 * take. Here: the plugs of `quiet`, the rows the goals read, the parts of `stand`, the player's level, the knob, the
 * windows and the times of the goals. Pure: the tests seat the boards without the bench (`presetState`) and play them
 * with the circuit model.
 */
import { AMPLIFIER_PRESET, type BoardPreset, type RowId, type SocketId } from '@electronics/sim/board';
import { PARTS } from '@electronics/sim/core';

/** The amplifier of E1-6 on the board, the volume knob at its middle, the plugs on its input and output. */
export const AMP: BoardPreset = AMPLIFIER_PRESET;

/**
 * `quiet`: the same board, the player's and the speaker's signal plugs together in the free row 16ae at the right
 * (`pl+` in e16, `spk+` in d16) — the player straight on the speaker, past the parts. Their common plugs stay where the
 * amplifier has them, in the ground row 17ae, which the amplifier's jumper J1 ties to the − rail: the speaker's minus
 * does not reach the rail itself (4,1 from its thing at the nearest socket, the lead is 4,0).
 */
export const QUIET: BoardPreset = Object.freeze({
  parts: AMP.parts,
  leads: Object.freeze({ ...AMP.leads, 'pl+': 'e16' as SocketId, 'spk+': 'd16' as SocketId }),
});

/** The rows of the goals. */
export const ROWS = Object.freeze({
  plus: '+' as RowId,
  minus: '-' as RowId,
  /** `quiet`: where the player meets the speaker, past the amplifier. */
  quiet: '16ae' as RowId,
  /** The ground row of the plugs' commons (J1 to the − rail). */
  ground: '17ae' as RowId,
  /** The player's signal on the amplifier's input: `pl+` in c13, the top of the volume control's track. */
  player: '13ae' as RowId,
  /** The speaker's plus on the amplifier's output: `spk+` in c10, the output capacitor's minus leg. */
  speaker: '10ae' as RowId,
});

/** The bench's ids the steps name. */
export const IDS = Object.freeze({ pot: 'P1', led: 'LED1', switch: 'SW', battery: 'BAT', player: 'PLAYER' });

/**
 * `stand`: what the hand may take — the amplifier's sixteen parts but the output pair's bias diodes D2 and D3
 * (without either the model burns the upper output transistor Q2 in 0,8 s: 1,4 A, 4,3 W, the script's fact notes); the
 * jumpers stay where they are.
 */
export const TAKE: readonly string[] = Object.freeze(
  AMP.parts.filter((p) => p.spec !== 'jumper' && p.id !== 'D2' && p.id !== 'D3').map((p) => p.id),
);

/** The player's level when it plays (the catalog's amplitude, 0,3 V) and stopped (0). */
export const PLAYING = (() => {
  const p = PARTS.player;
  return p?.kind === 'player' ? p.amplitude : 0.3;
})();

/** The volume knob: `loud`'s entry, and every other step's (the preset's middle). */
export const KNOB = Object.freeze({ low: 0.1, middle: 0.5 });

type Window = readonly [lo: number, hi: number];

/**
 * The windows of the goals (SI): the script's «Ціль»; `__tests__/boards.test.ts` plays the boards in the model and
 * holds them inside.
 */
export const WINDOWS = Object.freeze({
  /** `quiet`: the crest on the speaker over the goal's 3 s (the model: any 3 s of the melody 0,051 … 0,058 V). */
  quiet: [0.05, 0.06] as Window,
  /** `loud`: the knob at least this; the battery's current above this (the model: 13,31 mA at rest). */
  loud: { knob: 0.8, battery: 0.01 },
  /** `stand`: the speaker silent — its crest over 0,5 s below this (the gauge's «0,00 V»). */
  silent: 0.005,
  /** The gauge «Хвиля на динаміку»: 0 … 4 V (the whole knob's 3,6 V fits). */
  gauge: [0, 4] as Window,
});

/** How long a goal's state holds before it counts (s): the script's «Ціль». */
export const HOLD = Object.freeze({
  /** `quiet`: the player plays with its plugs past the amplifier. */
  quiet: 3,
  /** `loud`: the switch closed and the knob high. */
  loud: 1,
  /** `stand`: the LED «on» out of the circuit; the speaker silent while a part is out; the board whole again after. */
  led: 1.5,
  silent: 1,
  back: 1,
  /** `riddle`: the probe in each row. */
  riddle: 2,
});

/** The gauge looks back this long over the samples heard (s): the largest voltage on the speaker. */
export const CREST_SECONDS = 0.5;

/** `riddle`: the three rows the scope's probe visits, by the word over each. */
export const RIDDLE_ROWS = Object.freeze({ battery: ROWS.plus, player: ROWS.player, speaker: ROWS.speaker });
export type RiddleRow = keyof typeof RIDDLE_ROWS;
/** `riddle`: the free socket of each row the word stands over. */
export const RIDDLE_MARKS: Readonly<Record<RiddleRow, SocketId>> = Object.freeze({
  battery: '+3' as SocketId,
  player: 'e13' as SocketId,
  speaker: 'e10' as SocketId,
});
