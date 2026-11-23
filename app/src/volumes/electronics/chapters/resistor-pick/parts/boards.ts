/**
 * The boards of the chapter's steps as data (the script's «Бачимо»; `sim/board` `LED_LOOP` and `AMPLIFIER_PRESET`):
 * what `bench.preset` puts on the board when a step is entered, the rows each step's goal reads and the windows of its
 * numbers. Pure: the tests seat every board without the bench (`presetState`) and solve it with the circuit model.
 */
import {
  AMPLIFIER_PRESET,
  LED_LOOP,
  createLayout,
  joinedRows,
  type BoardPreset,
  type PresetPart,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';

/** `bands`: the red LED's loop as the chapter `resistor` left it — J1 from `+5` to `a5`, the 330 Ω in `b5` … `b9`, the
 * LED anode `c9`, cathode `c10`, J2 from `e10` to `-10` (the switch open: the LED adds no colour to the bands). */
export const LOOP: readonly PresetPart[] = LED_LOOP.parts;

/** `series`: the loop with a resistor of the value `spec` in R1's sockets (`b5` … `b9`). */
export const loopWith = (spec: string): readonly PresetPart[] =>
  LED_LOOP.parts.map((p) => (p.id === 'R1' ? { ...p, spec } : p));

/** `calc`: J1 and a new LED; no resistor (the gap from 5ae to 9ae, `b5` … `b9` free) and no J2 — the meter on «A» with
 * its probes in `e10` and `-10` closes the loop from 10ae to the − rail. */
export const CALC: readonly PresetPart[] = Object.freeze(LED_LOOP.parts.filter((p) => p.id !== 'R1' && p.id !== 'J2'));

/** `power`: the loop of `calc` with a new 330 Ω in R1's sockets: the meter closes it as in `calc`. */
export const POWER: readonly PresetPart[] = Object.freeze(LED_LOOP.parts.filter((p) => p.id !== 'J2'));

/** `calc`, `power`: where the step puts the probes (the meter on «A» from the LED's cathode row to the − rail). */
export const METER_PROBES: Readonly<Record<'red' | 'black', SocketId>> = Object.freeze({ red: 'e10', black: '-10' });

/** `burn`: J1 from `+9` to `a9`, J2 from `e13` to `-13`; the sockets `b9` … `b13` free between their ends (the board of
 * the bench sandbox's step `overload`, E2-7). */
export const BURN: readonly PresetPart[] = Object.freeze([
  { id: 'J1', spec: 'jumper', at: '+9', to: 'a9' },
  { id: 'J2', spec: 'jumper', at: 'e13', to: '-13' },
]);

/** `on`: the amplifier of E1-6 as the volume puts it on the board, not a socket changed (the prologue's). */
export const ON: BoardPreset = AMPLIFIER_PRESET;

/** The rows of the steps' goals. */
export const ROWS = Object.freeze({
  /** The resistor's gap between J1's end and the LED's anode (`calc`, `power`). */
  gap: ['5ae', '9ae'] as readonly RowId[],
  /** The LED: anode by the gap, cathode by the meter's red probe (`calc`, `power`). */
  led: ['9ae', '10ae'] as readonly RowId[],
  /** Between the ends of the two jumpers from the rails (`burn`). */
  burn: ['9ae', '13ae'] as readonly RowId[],
});

const layout = createLayout();

/** `on`: the rows of the LED «on» (its anode's, by R1's leg) and of the two sides around them. */
export const ON_ROWS = Object.freeze({
  /** The row of LED1's anode and R1's leg on the near half. */
  led: '5fj' as RowId,
  /** The − rail and the rows its jumpers tie to it: LED1's cathode stands in the rail. */
  ground: joinedRows(layout, ON, '-'),
  /** The supply after the protection diode (Q2's collector, R1's other leg) and the row J8 feeds from it. */
  supply: joinedRows(layout, ON, '5ae'),
});

type Window = readonly [lo: number, hi: number];

/**
 * The windows of the goals (SI): where the bench's number must stay — the model's value within the display's last
 * digit or so (the script's «Ціль»; `__tests__/boards.test.ts` solves every board and holds the model inside them).
 */
export const WINDOWS = Object.freeze({
  /** `calc`: the A display with each of the two nearest values alone in the gap (the model's 21,235 and 19,514 mA). */
  calc: {
    'resistor-330': [0.0211, 0.0214] as Window,
    'resistor-360': [0.0194, 0.0196] as Window,
  },
  /** `power`: the meter's current, |u| and p of the resistor, and its condition (the model's 21,235 mA, 7,0076 V,
   * 0,1488 W, warm; 7,1693 mA, 7,1693 V, 0,0514 W, ok). */
  power: {
    'resistor-330': {
      amps: [0.0211, 0.0214] as Window,
      volts: [6.98, 7.03] as Window,
      watts: [0.147, 0.151] as Window,
      condition: 'warm' as const,
    },
    'resistor-1k': {
      amps: [0.00712, 0.00722] as Window,
      volts: [7.14, 7.2] as Window,
      watts: [0.05, 0.053] as Window,
      condition: 'ok' as const,
    },
  },
  /** `on`: |V| on the LED «on» and on its resistor (the model's 1,7497 and 6,5872 V). */
  on: { led: [1.745, 1.755] as Window, res: [6.582, 6.592] as Window },
});
