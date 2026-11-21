/**
 * The chapter's board as data (the script's «Бачимо»; `sim/board` `AMPLIFIER_PRESET`): every step puts the prologue's
 * amplifier on the board, the volume control at its middle, the player's and the speaker's plugs in; what changes is
 * the battery's switch, the player and where the instruments' probes go. Here: the rows the goals read, the sockets a
 * step puts a probe in, the player's level and the windows of the goals around the model's numbers. Pure: the tests
 * seat the board without the bench (`presetState`) and solve it with the circuit model.
 */
import { AMPLIFIER_PRESET, type BoardPreset, type RowId, type SocketId } from '@electronics/sim/board';
import { PARTS } from '@electronics/sim/core';

/** The board of every step: the amplifier of E1-6 as the prologue left it. */
export const AMP: BoardPreset = AMPLIFIER_PRESET;

/**
 * The amplifier's supply jumper (the script's «фіолетова перемичка біля шини «+»»): from `+1` to `a1`, the row of the
 * protection diode D1's anode — the only way the amplifier takes power from the + rail (`presets.ts`; the script's
 * `J1` is this preset's `J10`).
 */
export const SUPPLY = 'J10';

/** The rows of the goals. */
export const ROWS = Object.freeze({
  plus: '+' as RowId,
  minus: '-' as RowId,
  /** `amps`: the gap the supply jumper leaves — the + rail and D1's anode row. */
  gap: ['+', '1ae'] as readonly RowId[],
  /** The player's signal: `pl+` in c13, the top of the volume control's track (`wave`, `notes`). */
  player: '13ae' as RowId,
  /** The volume control's wiper, the amplifier's input (`twice`, channel 1). */
  input: '15ae' as RowId,
  /** The speaker's plus: `spk+` in c10, the output capacitor's minus leg (`twice`, channel 2). */
  speaker: '10ae' as RowId,
});

/** `wave`: where the step puts the multimeter's probes — red on the player's row, black on the − rail. */
export const WAVE_METER: Readonly<Record<'red' | 'black', SocketId>> = Object.freeze({ red: 'd13', black: '-14' });
/** `notes`: where the step puts the scope's probe — on the player's row, where the reader had it in `wave`. */
export const NOTES_SCOPE: SocketId = 'd13';
/** `twice`: where the callouts «вхід підсилювача» and «динамік» stand — over a free socket of each row. */
export const TWICE_MARKS = Object.freeze({ input: 'c15' as SocketId, speaker: 'd10' as SocketId });

/** The player's level when it plays (the catalog's amplitude, 0,3 V) and stopped (0). */
export const PLAYING = (() => {
  const p = PARTS.player;
  return p?.kind === 'player' ? p.amplitude : 0.3;
})();
/** The volume control's knob on every entry (the preset's middle). */
export const KNOB = 0.5;

type Window = readonly [lo: number, hi: number];

/**
 * The windows of the goals (SI): where the bench's numbers must stay — the script's «Ціль»; `__tests__/boards.test.ts`
 * solves the board and holds the model inside them.
 */
export const WINDOWS = Object.freeze({
  /** `volts`: the display between the rails (the model's 8,98002 V), and minus that the other way round. */
  volts: [8.975, 8.985] as Window,
  /** `amps`: |I| through the meter in the gap (the model's 13,3122 mA), and how far it may be from the battery's. */
  amps: [0.0132, 0.0134] as Window,
  same: 1e-3,
  /** `flat`: the rail's trace from 0,5 s after the closing (the model's 8,98001 V with the scope's input). */
  flat: [8.975, 8.985] as Window,
  /** `wave`: the trace never beyond this (V); in every 2 s at least this; the meter's |value| below this (V). */
  wave: { edge: 0.35, crest: 0.2, meter: 1e-3 },
  /** `twice`: the knob low, high, and the window where both lines are on the screen at 0,02 V a division. */
  twice: { low: 0.25, high: 0.5, zoom: [0.25, 0.5] as Window },
});

/** How long a goal's state holds before it counts (s): the script's «Ціль». */
export const HOLD = Object.freeze({
  /** Every reading of the multimeter that counts (`volts`, `amps`). */
  reading: 1,
  /** `flat`: the closing settles for this long, then the trace lies in its window for `flat`. */
  settle: 0.5,
  flat: 2,
  /** `wave`: the probe on the player's row while it plays; each 2 s of it has its crest. */
  wave: 3,
  crest: 2,
  /** `notes`: each time a division. */
  notes: 3,
  /** `twice`: both probes in place together; each of the three states of the knob and the scale. */
  together: 3,
  state: 1,
});
