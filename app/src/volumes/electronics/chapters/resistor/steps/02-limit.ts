/**
 * `resistor/limit` — «Деталь, що заважає». The LED's loop without its resistor: J1 from the + rail to 5ae, a new red
 * LED in c9/c10, J2 from 10ae to the − rail, the sockets b5 … b9 free; the switch open, the tray's one slot a 330 Ω
 * (on a phone the dock's button). The reader sets the resistor into the gap between 5ae and 9ae and closes the switch:
 * the model gives 21,2 mA, the LED shines steadily and never burns. Goal: a 330 Ω in the rows 5ae and 9ae, the switch
 * closed, and the LED of the step at 21,0 … 21,5 mA, whole, for 2 s in a row.
 */
import { kindOf, handPolicy } from '../parts/policy';
import { LIMIT, ROWS, WINDOWS } from '../parts/boards';
import { HOLD, rowsOf, sameRows, within } from '../parts/goals';
import { switchToggle, trayButtons } from '../parts/dock';
import { trayLabel } from '@electronics/shared/bench';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'limit';
const RESISTOR = 'resistor-330';

export const limitStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const inGap = (): string | null => {
    for (const p of bench.state.parts.values())
      if (p.spec === RESISTOR && sameRows(rowsOf(bench.layout, p.legs), ROWS.gap)) return p.id;
    return null;
  };
  const lit = (): boolean => {
    const s = bench.model.part('LED1');
    return within(bench.model.reading('LED1')?.i, ...WINDOWS.limit) && s !== null && s.condition !== 'burnt';
  };
  let held = 0;
  ctx.qa.expose(S, () => ({
    resistor: inGap(),
    closed: bench.closed,
    i: bench.model.reading('LED1')?.i ?? null,
    condition: bench.model.part('LED1')?.condition ?? null,
    held,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'stand', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [
        ...trayButtons(bench, [RESISTOR], trayLabel, stand.phone),
        switchToggle(bench, word(3), stand.phone),
      ],
      goal: () => reached(S),
    },
    enter() {
      held = 0;
      stand.board(LIMIT);
      bench.closed = 0;
      bench.tray.set([RESISTOR]);
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: [RESISTOR],
        part: (spec) => kindOf(spec) === 'resistor',
        switch: true,
        // a resistor has no polarity: either way round
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => (w.switch ? word(3) : w.spec && kindOf(w.spec) === 'resistor' ? word(0) : ''),
      });
      stand.naming = {
        part: (id) => {
          const kind = kindOf(bench.state.parts.get(id)?.spec ?? '');
          return kind === 'led' ? word(1) : kind === 'jumper' ? word(2) : '';
        },
        meter: '',
      };
    },
    late(dt) {
      if (!here(S)) return;
      held = inGap() !== null && bench.closed >= 0.5 && lit() ? held + dt : 0;
      if (held >= HOLD.lit && !reached(S)) reach(S);
    },
  };
};
