/**
 * `meter/flat` — «Рівна лінія». The amplifier on the board, the switch open, the player stopped; the multimeter goes
 * away and the oscilloscope slides in at the back on the right, rolling at 0,5 s a division (5 s on the screen) and
 * 2,5 V a division with 0 V in the middle (±10 V). The board's chart «Осцилограф» shows the same samples. The hand
 * takes the probe of channel 1 and the battery's switch (a phone: the dock's toggle). The scope's input takes 1 MΩ
 * from the probed row to the − rail, as a real one does (`SCOPE_INPUT`): the open rail lies at 0,014 V. Goal: the probe
 * in the + rail, the switch closed while it is there (a closing before does not count: the switch's name stands over
 * it then, to open and close it again), and from 0,5 s after that closing the newest samples of the trace lie within
 * 8,975 … 8,985 V for 2 s in a row (the model's 8,98001 V). «постійна напруга» stands over the screen with the takeaway.
 */
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, ROWS, WINDOWS } from '../parts/boards';
import { switchToggle } from '../parts/dock';
import { createHold, rowOf, within } from '../parts/goals';
import { overSwitch, overTrace } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { FLAT, scopeBoard } from '../parts/scope';
import { CAMERA_FLIGHT } from '../parts/shots';

const S = 'flat';
const [LO, HI] = WINDOWS.flat;

/** The smallest and largest volts of a roll's newest points: those of the last `seconds` (its x ≤ 0, in s). */
export function newest(n: number, x: ArrayLike<number>, v: ArrayLike<number>, seconds: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = n - 1; k >= 0 && x[k]! >= -seconds; k--) {
    if (v[k]! < lo) lo = v[k]!;
    if (v[k]! > hi) hi = v[k]!;
  }
  return lo <= hi ? [lo, hi] : null;
}

export const flatStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const flat = createHold(HOLD.flat);
  let time = 0;
  /** A closing of the switch counts: the probe was in the rail at its moment (engine time), and has stayed there. */
  let armed = false;
  let closedAt = Number.NaN;
  let wasClosed = false;
  let last: [number, number] | null = null;
  const inRail = (): boolean => rowOf(bench.layout, bench.oscilloscope.sockets.ch1) === ROWS.plus;
  /** The switch was closed before the probe was in: the step calls it (open and close it again). */
  const callSwitch = (): boolean => !reached(S) && bench.closed >= 0.5 && inRail() && !armed;
  ctx.qa.expose(S, () => ({
    ch1: bench.oscilloscope.sockets.ch1,
    inRail: inRail(),
    closed: bench.closed,
    armed,
    since: Number.isFinite(closedAt) ? time - closedAt : null,
    newest: last,
    holding: flat.held,
    call: callSwitch(),
    display: bench.oscilloscope.settings.display,
    reached: reached(S),
  }));

  return {
    // from `amps`'s shot on the left the camera crosses the bench: the same longer flight
    spec: { camera: 'scope', cameraMove: { duration: CAMERA_FLIGHT }, params: { meter: 0, scope: 1 } },
    ui: {
      reset: true,
      controls: [switchToggle(bench, word(5), stand.phone)],
      board: scopeBoard(bench, 'scope-flat', word(0), {
        volts: word(2),
        time: word(3),
        division: word(4),
        ch1: word(1),
        ch2: '',
      }),
      callouts: [
        { anchor: () => overTrace(bench, stand.phone()), text: word(6), side: 'up', visible: () => here(S) && reached(S) },
        {
          anchor: () => overSwitch(bench),
          text: word(5),
          side: 'up',
          visible: () => here(S) && !stand.phone() && !bench.flying && callSwitch(),
        },
      ],
      goal: () => reached(S),
    },
    enter() {
      flat.reset();
      time = 0;
      armed = false;
      closedAt = Number.NaN;
      wasClosed = false;
      last = null;
      stand.board(AMP.parts, AMP.leads);
      bench.closed = 0;
      stand.play(false);
      bench.tray.set([]);
      bench.oscilloscope.configure(FLAT);
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.hands.policy = handPolicy(bench, {
        probes: ['ch1'],
        switch: true,
        name: (w) => (w.switch ? word(5) : w.probe === 'ch1' ? word(1) : ''),
      });
      stand.naming = { meter: '', scope: word(0), player: '', tap: false };
    },
    late(dt) {
      if (!here(S)) return;
      time += dt;
      const closed = bench.closed >= 0.5;
      const rail = inRail();
      if (closed && !wasClosed) {
        armed = rail;
        closedAt = time;
      }
      wasClosed = closed;
      if (!closed || !rail) armed = false;
      const { n, x, v } = bench.oscilloscope.model.trace(0);
      last = newest(n, x, v, Math.max(dt, 1 / 30));
      const settled = armed && time - closedAt >= HOLD.settle - 1e-9;
      flat.feed(settled && !stand.playing() && last !== null && within(last[0], LO, HI) && within(last[1], LO, HI), dt);
      if (flat.done && !reached(S)) reach(S);
    },
  };
};
