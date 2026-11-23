/**
 * `resistor-pick/calc` — «Розрахунок для світлодіода». The board: J1 from the + rail to 5ae, the gap `b5` … `b9` empty,
 * a new red LED anode in `c9`, cathode in `c10`, no J2; the switch closed; the multimeter on «A» with its probes put by
 * the step once it stands on its place (red `e10`, black `-10`): the meter itself closes the loop from 10ae to the −
 * rail, so with no resistor it reads «0,000 A». The tray: 330, 360, 390 and 470 Ω and the red LED (on a phone the
 * dock's buttons); the hand carries resistors and the LED whole (the LED never turned end for end), nothing else. Goal:
 * the 330 Ω and the 360 Ω, each the only resistor in the gap from 5ae to 9ae with the LED whole in 9ae/10ae, the meter's
 * display held 1 s in its window — «21,24 mA» and «19,51 mA» (the model's 21,235 and 19,514 mA; any order). The formula
 * card (a note of the dock, rich: `R = (U − U_LED) / I`) comes with the takeaway.
 */
import { trayLabel } from '@electronics/shared/bench';
import {
  createTally,
  handPolicy,
  kindOf,
  meterReadout,
  rowsOf,
  sameRows,
  trayButtons,
  within,
} from '@electronics/shared/steps';
import { CALC, METER_PROBES, ROWS, WINDOWS } from '../parts/boards';
import { HOLD } from '../parts/goals';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'calc';
const LED = 'led-red';
/** The tray's resistors: the two nearest values of 352 Ω and the two above them. */
const RESISTORS = ['resistor-330', 'resistor-360', 'resistor-390', 'resistor-470'] as const;
/** The two values the goal waits for and the window of the current each gives (A). */
const VALUES = WINDOWS.calc;
type Value = keyof typeof VALUES;
const KEYS = Object.keys(VALUES) as Value[];

export const calcStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Value>(KEYS, HOLD.reading);
  /** The step's probes go in once the meter stands on its place (it slides in for 0.6 s). */
  let put = false;
  /** The resistors with both legs in the gap's rows now. */
  const inGap = () =>
    [...bench.state.parts.values()].filter(
      (p) => kindOf(p.spec) === 'resistor' && sameRows(rowsOf(bench.layout, p.legs), ROWS.gap),
    );
  /** An LED anode in 9ae, cathode in 10ae, not burnt: its id. */
  const led = (): string | null => {
    for (const p of bench.state.parts.values()) {
      if (kindOf(p.spec) !== 'led') continue;
      const rows = rowsOf(bench.layout, p.legs);
      if (rows && rows[0] === ROWS.led[0] && rows[1] === ROWS.led[1] && bench.model.part(p.id)?.condition !== 'burnt')
        return p.id;
    }
    return null;
  };
  const reading = (): Value | null => {
    const parts = inGap();
    if (parts.length !== 1 || bench.multimeter.mode !== 'A' || bench.closed < 0.5 || led() === null) return null;
    const spec = parts[0]!.spec;
    if (!(spec in VALUES)) return null;
    const [lo, hi] = VALUES[spec as Value];
    return within(bench.multimeter.value, lo, hi) ? (spec as Value) : null;
  };
  ctx.qa.expose(S, () => ({
    gap: inGap().map((p) => p.spec),
    led: led(),
    mode: bench.multimeter.mode,
    red: bench.multimeter.sockets.red,
    black: bench.multimeter.sockets.black,
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'stand', params: { meter: 1 } },
    ui: {
      reset: true,
      controls: [
        meterReadout(bench, word(0)),
        ...trayButtons(bench, RESISTORS, trayLabel, stand.phone),
        ...trayButtons(bench, [LED], () => word(3), stand.phone),
        { type: 'note', id: 'led-formula', text: word(5), visible: () => reached(S) },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      put = false;
      stand.board(CALC);
      bench.closed = 1;
      bench.tray.set([...RESISTORS, LED]);
      bench.multimeter.mode = 'A';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: [...RESISTORS, LED],
        part: (spec) => kindOf(spec) === 'resistor' || kindOf(spec) === 'led',
        // a resistor either way round; an LED only anode to the + side, as it comes from the tray
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => {
          const kind = w.spec ? kindOf(w.spec) : 'other';
          return kind === 'resistor' ? word(1) : kind === 'led' ? word(2) : '';
        },
      });
      stand.naming = {
        part: (id) => (bench.state.parts.get(id)?.spec === 'jumper' ? word(4) : ''),
        meter: word(0),
      };
    },
    update() {
      if (!here(S) || put || bench.meter < 1 - 1e-3) return;
      bench.multimeter.put(METER_PROBES);
      put = true;
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
