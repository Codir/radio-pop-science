/**
 * `resistor/law` — «Більший опір — менший струм». Only J1 from the + rail on the board; the multimeter on «A» with its
 * probes put by the step (red in e9, black in −9): the meter itself closes the loop from 9ae to the − rail, so a
 * resistor set in the gap from 5ae to 9ae carries the current the panel shows. The tray: 1 kΩ, 2 kΩ, 3 kΩ (on a phone
 * the dock's buttons). Goal: each of the three alone in the gap, its current held 1 s in its window — «8,986 mA»,
 * «4,497 mA», «2,998 mA» (the model's 9 V over the battery's 1,5 Ω and the resistor). The formula card (a note of the
 * dock, rich: `I = U / R`) comes with the takeaway.
 */
import { trayLabel } from '@electronics/shared/bench';
import { kindOf, handPolicy } from '../parts/policy';
import { LAW, LAW_PROBES, ROWS, WINDOWS } from '../parts/boards';
import { HOLD, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { trayButtons } from '../parts/dock';
import { meterReadout } from '../parts/meter';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'law';
/** The tray's three resistors and the window of the current each gives (A). */
const VALUES = WINDOWS.law;
type Value = keyof typeof VALUES;
const KEYS = Object.keys(VALUES) as Value[];

export const lawStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Value>(KEYS, HOLD.reading);
  /** The step's probes go in once the meter stands on its place (it slides in for 0.6 s). */
  let put = false;
  /** The resistors in the gap from 5ae to 9ae now. */
  const inGap = () =>
    [...bench.state.parts.values()].filter(
      (p) => kindOf(p.spec) === 'resistor' && sameRows(rowsOf(bench.layout, p.legs), ROWS.gap),
    );
  const reading = (): Value | null => {
    const parts = inGap();
    if (parts.length !== 1 || bench.multimeter.mode !== 'A') return null;
    const spec = parts[0]!.spec;
    if (!(spec in VALUES)) return null;
    const [lo, hi] = VALUES[spec as Value];
    return within(bench.multimeter.value, lo, hi) ? (spec as Value) : null;
  };
  ctx.qa.expose(S, () => ({
    gap: inGap().map((p) => p.spec),
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
        ...trayButtons(bench, KEYS, trayLabel, stand.phone),
        { type: 'note', id: 'ohm-law', text: word(3), visible: () => reached(S) },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      put = false;
      stand.board(LAW);
      bench.closed = 1;
      bench.tray.set(KEYS);
      bench.multimeter.mode = 'A';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: KEYS,
        part: (spec) => kindOf(spec) === 'resistor',
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => (w.spec && kindOf(w.spec) === 'resistor' ? word(1) : ''),
      });
      stand.naming = {
        part: (id) => (bench.state.parts.get(id)?.spec === 'jumper' ? word(2) : ''),
        meter: word(0),
      };
    },
    update() {
      if (!here(S) || put || bench.meter < 1 - 1e-3) return;
      bench.multimeter.put(LAW_PROBES);
      put = true;
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
