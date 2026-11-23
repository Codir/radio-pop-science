/**
 * `resistor-pick/series` — «Чому немає 352 Ω». The LED's loop and the switch as in `bands`; the step takes the
 * magnifier's door down to the floor `part` (the rail's `DIVE_END`: from `bands` the camera is there already, a deep
 * link puts it there at once) and keeps it there the whole step — no «Глибина», the hand takes nothing; leaving, the
 * scene flies it home. The dock's slider «Номінал» runs through the 25 values of E24 from 100 Ω to 1 kΩ (log scale,
 * `stops`): every new position puts a new resistor of that value into R1's sockets `b5` … `b9`, whole (the door follows
 * it; its bands from the data), and the readout «Допуск» says the span its 5 % allows. Goal, on the floor `part`: the
 * slider at both ends (100 Ω and 1 kΩ) at least once, and 1 s on 330 Ω and 1 s on 360 Ω (any order; on entry it
 * stands on 330 Ω, and that second counts), the board's resistor of the slider's value each time.
 */
import { fmtSI } from '@/content';
import { PARTS, resistorKey } from '@electronics/sim/core';
import { createTally } from '@electronics/shared/steps';
import { loopWith } from '../parts/boards';
import { seriesStops, toleranceSpan } from '../parts/bands';
import { HOLD } from '../parts/goals';
import { NONE } from '../parts/readouts';
import { caption } from '../content';
import { DIVE_END, type StepFactory } from '../chapter';

const S = 'series';
const STOPS = seriesStops();
const FIRST = 330;
const LO = STOPS[0]!;
const HI = STOPS[STOPS.length - 1]!;
/** The two values the goal holds for 1 s each, by their keys. */
const HELD = ['resistor-330', 'resistor-360'] as const;
type Held = (typeof HELD)[number];
/** The resistor of a catalog key: its value and tolerance; null for any other key. */
const resistorOf = (spec: string | undefined): { ohms: number; tolerance: number } | null => {
  const p = spec === undefined ? undefined : PARTS[spec];
  return p?.kind === 'resistor' ? { ohms: p.ohms, tolerance: p.tolerance } : null;
};

export const seriesStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Held>(HELD, HOLD.reading);
  /** The ends of the slider seen on the floor `part` this visit. */
  const ends = new Set<'lo' | 'hi'>();
  /** The door has been sent down this visit (a deep link: put there at once). */
  let sent = false;
  let instant = false;
  const door = () => stand.door;
  const atPart = (): boolean => here(S) && door()?.floor === 'part';
  /** The resistor in R1's sockets now, and its value. */
  const onBoard = () => resistorOf(bench.state.parts.get('R1')?.spec);
  /** The slider's value as the board holds it: a resistor of that value in R1's sockets (null while it is not). */
  const shown = (): number | null => {
    const r = onBoard();
    const v = ui.value<number>('value');
    return r && bench.state.parts.get('R1')?.spec === resistorKey(v) ? r.ohms : null;
  };
  const tolerance = (): string => {
    const r = onBoard();
    return r ? toleranceSpan(r.ohms, r.tolerance, word(2), word(3)) : NONE;
  };
  /** A new resistor of `ohms` in R1's sockets, whole (the door follows the part under its id). */
  const put = (ohms: number): void => {
    const spec = resistorKey(ohms);
    if (bench.state.parts.get('R1')?.spec === spec) return;
    stand.board(loopWith(spec));
    bench.closed = 0;
  };
  ctx.qa.expose(S, () => ({
    slider: ui.value<number>('value'),
    spec: bench.state.parts.get('R1')?.spec ?? null,
    value: shown(),
    tolerance: tolerance(),
    floor: door()?.floor ?? null,
    position: door()?.rail.position ?? null,
    ends: [...ends].sort(),
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'board', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'value',
          label: word(0),
          min: LO,
          max: HI,
          scale: 'log',
          stops: STOPS,
          value: FIRST,
          format: (v) => fmtSI(v, 'Ω'),
          marks: [
            { value: LO, label: fmtSI(LO, 'Ω') },
            { value: HI, label: fmtSI(HI, 'Ω') },
          ],
          onChange: put,
        },
        { type: 'readout', id: 'tolerance', label: word(1), text: tolerance },
      ],
      goal: () => reached(S),
    },
    enter(info) {
      tally.reset();
      ends.clear();
      sent = false;
      instant = info.instant;
      stand.board(loopWith(resistorKey(FIRST)));
      bench.closed = 0;
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = { take: () => false };
      stand.naming = { part: () => '', meter: '' };
      stand.openDoor('R1', info, 'board');
    },
    late(dt) {
      if (!here(S)) return;
      const d = door();
      // down to the floor `part` once the door stands (its stops are built in its first update)
      if (!sent && d?.ready) {
        if (instant) d.rail.snap(DIVE_END);
        else d.travelTo(DIVE_END);
        sent = true;
      }
      const v = atPart() ? shown() : null;
      if (v === LO) ends.add('lo');
      if (v === HI) ends.add('hi');
      const spec = v === null ? null : resistorKey(v);
      tally.feed(spec === HELD[0] || spec === HELD[1] ? spec : null, dt);
      if (tally.all() && ends.size === 2 && !reached(S)) reach(S);
    },
  };
};
