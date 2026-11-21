/**
 * `resistor/inside` — «Усередині резистора». The LED's loop with 330 Ω, the switch closed; the shot `board`. The dock's
 * slider «Глибина» is the magnifier's way down (`shared/dive`: the door into R1, 0 «стенд» … the end «усередині
 * резистора»; a drag scrubs it, a click glides), a tap on the resting lens lays it on the resistor; the ladder «де ми»
 * shows the floor. On the floor `inside` the resistor's carbon film (`shared/inside`) is open: its groove cut for the
 * value, the electrons drifting at the model's current, three callouts on it. The dock's switch «Резистор» puts a
 * 330 Ω or a 10 kΩ in R1's sockets (a new part under the same id: the door follows it). Goal: on the floor `inside`,
 * 1 s with each of the two values (any order), the switch closed.
 */
import { Vector3 } from 'three';
import { trayLabel } from '@electronics/shared/bench';
import { LENS_LEG } from '@electronics/shared/dive';
import { asFilm, type FilmAnchor } from '@electronics/shared/inside';
import { loopWith } from '../parts/boards';
import { HOLD, createTally } from '../parts/goals';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'inside';
/** The slider runs 0 … `DEPTH`; the door's rail position is the slider − `LENS_LEG`. */
const DEPTH = 1 + LENS_LEG;
/** The two values of the dock's switch. */
const VALUES = ['resistor-330', 'resistor-10k'] as const;
type Value = (typeof VALUES)[number];
/** The rail position from which the camera is down inside (the floor `inside` from 1). */
const DOWN = 1 - 1e-3;

export const insideStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Value>(VALUES, HOLD.reading);
  let fill = -1;
  const door = () => stand.door;
  const resting = (): boolean => {
    const d = door();
    return !!d && !d.rail.moving && d.rail.position <= d.rail.rail.min + 1e-6;
  };
  /** The camera rests on the floor `inside` and the film is open. */
  const down = (): boolean => {
    const d = door();
    const film = asFilm(d?.cutaway ?? null);
    return here(S) && !!d && d.floor === 'inside' && d.rail.position >= DOWN && !!film?.open;
  };
  const value = (): Value | null => {
    const spec = bench.state.parts.get('R1')?.spec;
    return spec === VALUES[0] || spec === VALUES[1] ? spec : null;
  };
  // the callouts' points on the film (and the checks' probes): far below the bench while there is none
  const point = (name: FilmAnchor) => {
    const v = new Vector3();
    return (): Vector3 => {
      const film = asFilm(door()?.cutaway ?? null);
      return film && film.open ? film.anchor(name, v) : v.set(0, -100, 0);
    };
  };
  const points = { film: point('film'), groove: point('groove'), rod: point('rod') };
  for (const name of ['film', 'groove', 'rod'] as const) ctx.qa.probe(`film:${name}`, points[name]);
  // a tap on the resting magnifier lays it over the resistor: the slider glides to the end of its lens leg
  ctx.input.register(bench.tools.lens.group, {
    cursor: 'pointer',
    enabled: () => here(S) && !!door()?.ready && resting() && !bench.flying,
    click: () => {
      ui.set('depth', LENS_LEG);
      door()?.travelTo(0);
    },
  });
  ctx.qa.expose(S, () => {
    const d = door();
    const film = asFilm(d?.cutaway ?? null);
    return {
      value: value(),
      floor: d?.floor ?? null,
      position: d?.rail.position ?? null,
      down: down(),
      turns: film?.state().turns ?? null,
      amps: film?.state().amps ?? null,
      closed: bench.closed,
      counted: [...tally.counted],
      holding: tally.holding,
      reached: reached(S),
    };
  });
  const stop = (v: number): string => (v < DEPTH / 2 ? word(1) : word(2));

  return {
    spec: { camera: 'board', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'depth',
          label: word(0),
          min: 0,
          max: DEPTH,
          value: 0,
          step: 0.005,
          marks: [
            { value: 0, label: word(1) },
            { value: DEPTH, label: word(2) },
          ],
          format: stop,
          disabled: () => !door()?.ready && resting(),
          onChange: (v) => door()?.travelTo(v - LENS_LEG),
          onInput: (v, how) => {
            if (how === 'drag') door()?.rail.scrub(v - LENS_LEG);
          },
        },
        {
          type: 'segmented',
          id: 'film-value',
          label: word(3),
          items: VALUES.map((spec) => ({ id: spec, label: trayLabel(spec) })),
          value: VALUES[0],
          onChange: (spec) => {
            // a new resistor of that value in R1's sockets, whole; the loop stays closed
            stand.board(loopWith(spec));
            bench.closed = 1;
          },
        },
      ],
      // three bands that never meet, a phone's narrow frame included: the film's tag above the film, the groove's to
      // the left of its point (the film's point is a turn or so further toward leg 1: `film.anchor`), the rod's below
      callouts: [
        { anchor: points.film, text: word(4), side: 'up', visible: down },
        { anchor: points.groove, text: word(5), side: 'left', visible: down },
        { anchor: points.rod, text: word(6), side: 'down', visible: down },
      ],
      goal: () => reached(S),
    },
    enter(info) {
      tally.reset();
      fill = -1;
      stand.board(loopWith(VALUES[0]));
      bench.closed = 1;
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      // the hand takes nothing here; while the camera flies it could not anyway
      bench.hands.policy = { take: () => false };
      stand.naming = { part: () => '', meter: '' };
      stand.openDoor('R1', info, 'board');
    },
    update() {
      const d = door();
      if (!here(S) || !d) return;
      // the slider's fill is where the dive is (its thumb where the reader put it)
      const p = d.rail.position;
      if (Math.abs(p + LENS_LEG - fill) > 0.002) ui.patch('depth', { current: (fill = p + LENS_LEG) });
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(down() && bench.closed >= 0.5 ? value() : null, dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
