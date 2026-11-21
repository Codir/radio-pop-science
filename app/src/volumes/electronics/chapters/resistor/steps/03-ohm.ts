/**
 * `resistor/ohm` — «Опір у числах». The LED's loop with its 330 Ω, the switch closed (the LED shines), and two
 * resistors by themselves on the near half: 1 kΩ in g2 … g6, 4,7 kΩ in g12 … g16. The multimeter comes in on the
 * left, its dial «вимкнено». The hand takes the loop's resistor whole and the two probes. On the resistor in the live
 * loop the Ω mode shows «—» (a resistance is measured without power: plan E3 decision 5, `BenchModel.powered`); taken
 * out of the loop and set down on free sockets, it reads its 330 Ω. Goal: the Ω mode and three readings, each held
 * 1 s with the probes in the two rows of one resistor's legs — «330,0 Ω», «1,000 kΩ», «4,700 kΩ».
 */
import { kindOf, handPolicy } from '../parts/policy';
import { OHM, WINDOWS } from '../parts/boards';
import { HOLD, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { meterReadout, meterSwitch } from '../parts/meter';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'ohm';
/** The three values the goal waits for, by the key of the resistor the probes are on: the display's window (Ω). */
const VALUES = WINDOWS.ohm;
type Value = keyof typeof VALUES;
const KEYS = Object.keys(VALUES) as Value[];

export const ohmStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Value>(KEYS, HOLD.reading);
  /** The rows of the probes' tips (null while one is out of a socket). */
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  /** The resistor whose two legs are in the probes' rows, if any. */
  const touched = (): { id: string; spec: string } | null => {
    const rows = probeRows();
    for (const p of bench.state.parts.values())
      if (kindOf(p.spec) === 'resistor' && sameRows(rowsOf(bench.layout, p.legs), rows ?? [])) return p;
    return null;
  };
  /** This frame's reading of the goal: a value in its window on its own resistor, in the Ω mode. */
  const reading = (): Value | null => {
    if (bench.multimeter.mode !== 'ohm') return null;
    const p = touched();
    if (!p || !(p.spec in VALUES)) return null;
    const [lo, hi] = VALUES[p.spec as Value];
    return within(bench.multimeter.value, lo, hi) ? (p.spec as Value) : null;
  };
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
    on: touched()?.id ?? null,
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'meter', params: { meter: 1 } },
    ui: {
      reset: true,
      controls: [meterSwitch(bench, word(0), ['off', 'ohm'], word(1), 'off'), meterReadout(bench, word(2))],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      stand.board(OHM);
      bench.closed = 1;
      bench.tray.set([]);
      bench.multimeter.mode = 'off';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        // the loop's resistor, whole; the probes
        part: (_spec, id) => id === 'R1',
        probes: true,
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => (w.probe ? word(w.probe === 'red' ? 3 : 4) : w.spec && kindOf(w.spec) === 'resistor' ? word(5) : ''),
      });
      stand.naming = {
        part: (id) => {
          const kind = kindOf(bench.state.parts.get(id)?.spec ?? '');
          return kind === 'resistor' ? word(5) : kind === 'led' ? word(6) : kind === 'jumper' ? word(7) : '';
        },
        meter: word(0),
      };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
