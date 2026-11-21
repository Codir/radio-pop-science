/**
 * `resistor/flash` — «Лампочка просто на батарейці». The board holds three jumpers (J1 from the + rail, J3 along the
 * line b, J2 to the − rail) with free sockets between J3's end (9ae) and J2's (10ae); the switch is open, the tray
 * has one slot, the red LED (on a phone the dock's button «червоний»). The reader carries an LED there, anode to the
 * + side, and closes the switch: the model gives the LED 0,93 A, it lights for a few frames and burns (the bench's
 * wisp is the model's event). Goal: an LED of the step burnt in that place with the switch closed, and 1 s after.
 */
import { kindOf, handPolicy } from '../parts/policy';
import { FLASH, ROWS } from '../parts/boards';
import { HOLD, rowsOf } from '../parts/goals';
import { switchToggle, trayButtons } from '../parts/dock';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'flash';
const LED = 'led-red';

export const flashStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  /** The LED of the step standing anode in 9ae, cathode in 10ae (its legs in the order of the catalog's pins). */
  const inPlace = (): string | null => {
    for (const p of bench.state.parts.values()) {
      if (kindOf(p.spec) !== 'led') continue;
      const rows = rowsOf(bench.layout, p.legs);
      if (rows && rows[0] === ROWS.led[0] && rows[1] === ROWS.led[1]) return p.id;
    }
    return null;
  };
  /** The LED that burnt in its place with the switch closed, and the time since. */
  let burnt: string | null = null;
  let since = 0;
  ctx.qa.expose(S, () => {
    const id = inPlace();
    const part = id ? bench.model.part(id) : null;
    return {
      led: id,
      legs: id ? [...bench.state.parts.get(id)!.legs] : null,
      closed: bench.closed,
      condition: part?.condition ?? null,
      i: id ? (bench.model.reading(id)?.i ?? null) : null,
      burnt,
      since,
      reached: reached(S),
    };
  });

  return {
    spec: { camera: 'stand', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [...trayButtons(bench, [LED], () => word(1), stand.phone), switchToggle(bench, word(3), stand.phone)],
      goal: () => reached(S),
    },
    enter() {
      burnt = null;
      since = 0;
      stand.board(FLASH);
      bench.closed = 0;
      bench.tray.set([LED]);
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: [LED],
        part: (spec) => kindOf(spec) === 'led',
        switch: true,
        // from the tray the LED comes anode to the left: turned end for end it would stand out of the loop's way
        flip: () => false,
        name: (w) => (w.switch ? word(3) : w.spec && kindOf(w.spec) === 'led' ? word(0) : ''),
      });
      stand.naming = { part: (id) => (bench.state.parts.get(id)?.spec === 'jumper' ? word(2) : ''), meter: '' };
    },
    late(dt) {
      if (!here(S)) return;
      if (burnt === null) {
        const id = inPlace();
        if (id && bench.closed >= 0.5 && bench.model.part(id)?.condition === 'burnt') {
          burnt = id;
          since = 0;
        }
        return;
      }
      since += dt;
      if (since >= HOLD.burnt && !reached(S)) reach(S);
    },
  };
};
