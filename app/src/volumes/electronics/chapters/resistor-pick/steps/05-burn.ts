/**
 * `resistor-pick/burn` — «Понад межу». The board: J1 from the + rail to 9ae, J2 from 13ae to the − rail, the sockets
 * `b9` … `b13` free between their ends (the bench sandbox's `overload`); the switch open, no multimeter. The tray has
 * one slot, a 100 Ω (on a phone the dock's button); the hand carries resistors whole and flips the battery's switch (on
 * a phone the dock's toggle). The dock shows the power and the state of the resistor in 9ae/13ae, as in `power`, with
 * «гарячий» and «згорів» too («—» unless exactly one resistor stands there). With the switch closed the model gives it
 * 0,786 W of its 0,25 W, `hot` at once; its heat grows, the body darkens, and at ≈ 3,8 s the model burns it — the bench
 * lets out its one wisp on that event; then a gap, «0,000 W». Goal: a 100 Ω from the tray in the rows 9ae and 13ae, the
 * switch closed, the resistor burnt (the model's event), and 1 s after. On entry nothing stands in the gap and the switch
 * is open, so a deep link burns nothing.
 */
import { trayLabel } from '@electronics/shared/bench';
import type { PartStatus } from '@electronics/shared/parts';
import {
  conditionText,
  handPolicy,
  kindOf,
  rowsOf,
  sameRows,
  switchToggle,
  trayButtons,
} from '@electronics/shared/steps';
import { BURN, ROWS } from '../parts/boards';
import { HOLD } from '../parts/goals';
import { wattsText } from '../parts/readouts';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'burn';
const RESISTOR = 'resistor-100';

export const burnStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  /** The state's words by the model's condition. */
  const states = { ok: word(2), warm: word(3), hot: word(4), burnt: word(5) } as const;
  /** The resistors with a leg in each of 9ae and 13ae now. */
  const inPlace = () =>
    [...bench.state.parts.values()].filter(
      (p) => kindOf(p.spec) === 'resistor' && sameRows(rowsOf(bench.layout, p.legs), ROWS.burn),
    );
  const own = () => {
    const parts = inPlace();
    const r = parts.length === 1 ? parts[0]! : null;
    const reading = r ? bench.model.reading(r.id) : null;
    return {
      id: r?.id ?? null,
      spec: r?.spec ?? null,
      p: reading ? reading.p : null,
      condition: ((r ? bench.model.part(r.id)?.condition : null) ?? null) as PartStatus | null,
    };
  };
  /** The 100 Ω that burnt in its place with the switch closed, and the time since. */
  let burnt: string | null = null;
  let since = 0;
  ctx.qa.expose(S, () => ({
    ...own(),
    closed: bench.closed,
    burnt,
    since,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'stand', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [
        { type: 'readout', id: 'r-power', label: word(0), text: () => wattsText(own().p) },
        {
          type: 'readout',
          id: 'r-state',
          label: word(1),
          text: () => conditionText(own().spec ?? '', own().condition, states),
        },
        ...trayButtons(bench, [RESISTOR], trayLabel, stand.phone),
        switchToggle(bench, word(8), stand.phone),
      ],
      goal: () => reached(S),
    },
    enter() {
      burnt = null;
      since = 0;
      stand.board(BURN);
      bench.closed = 0;
      bench.tray.set([RESISTOR]);
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        tray: [RESISTOR],
        part: (spec) => kindOf(spec) === 'resistor',
        switch: true,
        flip: (spec) => kindOf(spec) === 'resistor',
        name: (w) => (w.switch ? word(8) : w.spec && kindOf(w.spec) === 'resistor' ? word(6) : ''),
      });
      stand.naming = { part: (id) => (bench.state.parts.get(id)?.spec === 'jumper' ? word(7) : ''), meter: '' };
    },
    late(dt) {
      if (!here(S)) return;
      if (burnt === null) {
        for (const p of inPlace()) {
          if (p.spec === RESISTOR && bench.closed >= 0.5 && bench.model.part(p.id)?.condition === 'burnt') {
            burnt = p.id;
            since = 0;
          }
        }
        return;
      }
      since += dt;
      if (since >= HOLD.burnt && !reached(S)) reach(S);
    },
  };
};
