/**
 * `resistor-pick/power` — «Скільки тепла щосекунди». The loop of `calc` with a new 330 Ω in `b5` … `b9` and a new LED
 * in `c9`/`c10`, the switch closed, the multimeter on «A» with its probes put by the step (`e10`, `-10`): the LED
 * shines at 21,2 mA. The dock: the meter's readout and three readouts of the model for the resistor in the gap from
 * 5ae to 9ae — the voltage on it (|u|, four significant digits like the meter's), its power (p, three decimals in
 * watts) and its state (the model's condition: «холодний», «теплий»); all three «—» unless exactly one resistor stands
 * in the gap. The tray: 330 Ω, 1 kΩ and the red LED (on a phone the dock's buttons). Goal: 2 s in a row with the 330 Ω
 * (from the entry on too) — the meter 21,1 … 21,4 mA, 6,98 … 7,03 V, 0,147 … 0,151 W, warm — and 2 s in a row with a
 * 1 kΩ — 7,12 … 7,22 mA, 7,14 … 7,20 V, 0,050 … 0,053 W, cold; each time the only resistor in the gap and the LED whole
 * in 9ae/10ae (any order). The formula card (`P = U × I`) comes with the takeaway.
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
import { METER_PROBES, POWER, ROWS, WINDOWS } from '../parts/boards';
import { HOLD } from '../parts/goals';
import { conditionText, voltsText, wattsText, type Condition } from '../parts/readouts';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'power';
const LED = 'led-red';
/** The tray's resistors and what each must show (`parts/boards.ts`). */
const VALUES = WINDOWS.power;
type Value = keyof typeof VALUES;
const KEYS = Object.keys(VALUES) as Value[];

export const powerStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  /** The state's words by the model's condition (on this board nothing gets hotter than warm). */
  const states = { ok: word(4), warm: word(5) } as const;
  const tally = createTally<Value>(KEYS, HOLD.power);
  let put = false;
  const inGap = () =>
    [...bench.state.parts.values()].filter(
      (p) => kindOf(p.spec) === 'resistor' && sameRows(rowsOf(bench.layout, p.legs), ROWS.gap),
    );
  /** The one resistor in the gap (null with none or two). */
  const single = () => {
    const parts = inGap();
    return parts.length === 1 ? parts[0]! : null;
  };
  const led = (): string | null => {
    for (const p of bench.state.parts.values()) {
      if (kindOf(p.spec) !== 'led') continue;
      const rows = rowsOf(bench.layout, p.legs);
      if (rows && rows[0] === ROWS.led[0] && rows[1] === ROWS.led[1] && bench.model.part(p.id)?.condition !== 'burnt')
        return p.id;
    }
    return null;
  };
  /** What the model says of the resistor in the gap: |u|, p, its condition (nulls: nothing to read). */
  const own = () => {
    const r = single();
    const reading = r ? bench.model.reading(r.id) : null;
    const state = r ? bench.model.part(r.id) : null;
    return {
      spec: r?.spec ?? null,
      u: reading ? Math.abs(reading.u) : null,
      p: reading ? reading.p : null,
      condition: (state?.condition ?? null) as Condition | null,
    };
  };
  const reading = (): Value | null => {
    const o = own();
    if (o.spec === null || !(o.spec in VALUES) || bench.multimeter.mode !== 'A' || bench.closed < 0.5) return null;
    if (led() === null) return null;
    const w = VALUES[o.spec as Value];
    return within(bench.multimeter.value, ...w.amps) &&
      within(o.u, ...w.volts) &&
      within(o.p, ...w.watts) &&
      o.condition === w.condition
      ? (o.spec as Value)
      : null;
  };
  ctx.qa.expose(S, () => {
    const o = own();
    return {
      gap: inGap().map((p) => p.spec),
      led: led(),
      mode: bench.multimeter.mode,
      red: bench.multimeter.sockets.red,
      black: bench.multimeter.sockets.black,
      value: bench.multimeter.value,
      text: bench.multimeter.text,
      ...o,
      counted: [...tally.counted],
      holding: tally.holding,
      reached: reached(S),
    };
  });

  return {
    spec: { camera: 'stand', params: { meter: 1 } },
    ui: {
      reset: true,
      controls: [
        meterReadout(bench, word(0)),
        { type: 'readout', id: 'r-volts', label: word(1), text: () => voltsText(own().u) },
        { type: 'readout', id: 'r-power', label: word(2), text: () => wattsText(own().p) },
        { type: 'readout', id: 'r-state', label: word(3), text: () => conditionText(own().condition, states) },
        ...trayButtons(bench, KEYS, trayLabel, stand.phone),
        ...trayButtons(bench, [LED], () => word(8), stand.phone),
        { type: 'note', id: 'power-formula', text: word(10), visible: () => reached(S) },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      put = false;
      stand.board(POWER);
      bench.closed = 1;
      bench.tray.set([...KEYS, LED]);
      bench.multimeter.mode = 'A';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: [...KEYS, LED],
        part: (spec) => kindOf(spec) === 'resistor' || kindOf(spec) === 'led',
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => {
          const kind = w.spec ? kindOf(w.spec) : 'other';
          return kind === 'resistor' ? word(6) : kind === 'led' ? word(7) : '';
        },
      });
      stand.naming = {
        part: (id) => (bench.state.parts.get(id)?.spec === 'jumper' ? word(9) : ''),
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
