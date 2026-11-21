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
 * `amp`: the amplifier of E1-6 (`AMPLIFIER_PRESET`) with a gap for the meter in the branch of its LED «on»: the LED's
 * resistor R1 (2,2 kΩ) from the supply's 5ae across the channel to `h5` (5fj), J11 along the line i from `i5` to `i1`
 * (1fj), and the LED from `j1` to the − rail — at the board's left end, so that its tall body hides no more than the
 * jumper's far end from the shots `meter` and `phone`. With J11 in place the board is the amplifier's, node by node; the meter
 * on «A» in J11's rows carries the LED's current alone. The amplifier's own layout has no free row by R5 or in its
 * supply's rows (the reservoir C3 and the output can C2 stand there; the chapter's README), so the gap is here.
 */
export const AMP: BoardPreset = Object.freeze({
  parts: Object.freeze([
    ...AMPLIFIER_PRESET.parts.map((p): PresetPart => {
      if (p.id === 'R1') return { id: 'R1', spec: p.spec, at: 'e5', to: 'h5' };
      if (p.id === 'LED1') return { id: 'LED1', spec: p.spec, at: 'j1', o: 1 };
      return p;
    }),
    { id: 'J11', spec: 'jumper', at: 'i5', to: 'i1' },
  ]),
  leads: AMPLIFIER_PRESET.leads,
});
/** The gap jumper of `amp` and the rows of its ends; the rows of R1's legs (the supply's 5ae, the LED's side 5fj). */
export const AMP_ROWS = Object.freeze({
  jumper: 'J11',
  gap: ['1fj', '5fj'] as readonly RowId[],
  /** The rows of the supply (R1's leg 0; J8 joins 2ae to 5ae) and of R1's other end with the gap closed. */
  supply: ['2ae', '5ae'] as readonly RowId[],
  load: ['1fj', '5fj'] as readonly RowId[],
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
  /** `amp`: |U| on R1 and |I| in the gap (the model's 6,5872 V and 2,9942 mA). */
  amp: { volts: [6.582, 6.592] as Window, amps: [0.00299, 0.002998] as Window },
});
