/**
 * The boards of the chapter's steps as data (the script's «Бачимо»; `sim/board` `LED_LOOP` and `AMPLIFIER_PRESET`):
 * what `bench.preset` puts on the board when a step is entered, and the rows each step's goal reads. Pure: the tests
 * seat every board without the bench (`presetState`) and solve it with the circuit model.
 */
import {
  AMPLIFIER_PRESET,
  LED_LOOP,
  type BoardPreset,
  type PresetPart,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';

/** `flash`: the LED's loop with neither the LED nor the resistor — J1 from `+5` to `a5`, J3 along the line b from
 * `b5` to `b9` (where the resistor stands in `limit`), J2 from `e10` over the channel to `-10`; the free sockets for
 * the LED between J3's end (9ae) and J2's (10ae). */
export const FLASH: readonly PresetPart[] = Object.freeze([
  { id: 'J1', spec: 'jumper', at: '+5', to: 'a5' },
  { id: 'J3', spec: 'jumper', at: 'b5', to: 'b9' },
  { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
]);

/** `limit`: the LED's loop without its resistor — the gap from 5ae to 9ae, the sockets `b5` … `b9` free. */
export const LIMIT: readonly PresetPart[] = Object.freeze(LED_LOOP.parts.filter((p) => p.id !== 'R1'));

/** The LED's loop with its resistor of the value `spec` (`inside`, `share`; `LED_LOOP` has 330 Ω). */
export const loopWith = (spec: string): readonly PresetPart[] =>
  LED_LOOP.parts.map((p) => (p.id === 'R1' ? { ...p, spec } : p));

/** `ohm`: the LED's loop and two resistors by themselves on the near half — 1 kΩ in `g2` … `g6`, 4,7 kΩ in
 * `g12` … `g16` (J2 goes over the column 10 between them). */
export const OHM: readonly PresetPart[] = Object.freeze([
  ...LED_LOOP.parts,
  { id: 'R2', spec: 'resistor-1k', at: 'g2' },
  { id: 'R3', spec: 'resistor-4k7', at: 'g12' },
]);

/** `law`: only J1 from the + rail; the resistor's gap from 5ae to 9ae, the meter from 9ae to the − rail. */
export const LAW: readonly PresetPart[] = Object.freeze([{ id: 'J1', spec: 'jumper', at: '+5', to: 'a5' }]);
/** `law`: where the step puts the probes — the meter on «A» closes the loop from 9ae to the − rail. */
export const LAW_PROBES: Readonly<Record<'red' | 'black', SocketId>> = Object.freeze({ red: 'e9', black: '-9' });

/** The rows of the steps' goals. */
export const ROWS = Object.freeze({
  /** The LED's anode by the end of J3, its cathode by the end of J2 (`flash`). */
  led: ['9ae', '10ae'] as readonly RowId[],
  /** The resistor's gap (`limit`, `law`; R1 of the loop in `share`). */
  gap: ['5ae', '9ae'] as readonly RowId[],
});

/**
 * `amp`: the amplifier of E1-6 on the board as the volume puts it (`AMPLIFIER_PRESET`, not a socket changed), with the
 * gap for the meter in its own jumper J8 (`d2` … `d5`): J8 joins the supply's row 5ae (after the protection diode) to
 * the row 2ae of R5's (470 Ω) leg and the reservoir C3's plus. Out of the board it leaves R5 and C3 without the
 * supply; the meter on «A» in its rows carries what J8 carried — R5's current and C3's leak (9,4 μA, 0,11 % of R5's),
 * which the script's takeaway and its more-detail note say. A gap of R5's current alone has no place in this layout (no free
 * row by R5 clear of C3, C2, D1, Q2 and the neighbours' legs: the chapter's README), and a relayout would part the
 * chapter's amplifier from the prologue's.
 */
export const AMP: BoardPreset = AMPLIFIER_PRESET;
/** The gap jumper of `amp` and the rows of its ends; the rows of R5's legs: the supply's side (2ae, and 5ae through
 * J8) and the top's (6ae: the upper output transistor's base and the two diodes). */
export const AMP_ROWS = Object.freeze({
  jumper: 'J8',
  gap: ['2ae', '5ae'] as readonly RowId[],
  supply: ['2ae', '5ae'] as readonly RowId[],
  top: ['6ae'] as readonly RowId[],
});

type Window = readonly [lo: number, hi: number];

/**
 * The windows of the goals (SI): where the bench's number must stay — the model's value within the display's last
 * digit or so (the script's «Ціль»; `__tests__/boards.test.ts` solves every board and holds the model inside them).
 */
export const WINDOWS = Object.freeze({
  /** `limit`: the LED's current (A), the model's 21,235 mA. */
  limit: [0.021, 0.0215] as Window,
  /** `ohm`: the Ω display on each resistor, by its key. */
  ohm: {
    'resistor-330': [329.5, 330.5] as Window,
    'resistor-1k': [999, 1001] as Window,
    'resistor-4k7': [4695, 4705] as Window,
  },
  /** `law`: the A display with each resistor alone in the gap (the model's 8,9865, 4,4966, 2,9985 mA). */
  law: {
    'resistor-1k': [0.00898, 0.00899] as Window,
    'resistor-2k': [0.00449, 0.0045] as Window,
    'resistor-3k': [0.00299, 0.003] as Window,
  },
  /** `share`: |V| on the LED, on the resistor, from rail to rail (the model's 1,9605, 7,0076, 8,9681 V). */
  share: { led: [1.955, 1.965] as Window, res: [7.003, 7.013] as Window, bat: [8.963, 8.973] as Window },
  /** `amp`: |U| on R5 and |I| in J8's gap (the model's 3,9311 V and 8,3734 mA: R5's 8,3640 and C3's leak 0,0094). */
  amp: { volts: [3.926, 3.936] as Window, amps: [0.00837, 0.008377] as Window },
});
