/**
 * `resistor/share` — «Куди йде напруга». The LED's loop with 330 Ω, the switch closed, the LED shining; the multimeter
 * on its place, its dial «вимкнено», the probes at rest — the hand takes only them. Three callouts over the board name
 * where to measure: «світлодіод» over its rows, «резистор» over its, «батарейка» over the + rail; each goes once its
 * reading has counted, and all three step aside while a probe is in the hand (on a phone there is no room beside the
 * LED: its name stands below it, over the sockets of its rows the probe is aimed at). Goal: the V mode and three
 * readings, each held 1 s (the probes either way round): 1,960 V on the LED's rows (9ae, 10ae), 7,008 V on the
 * resistor's (5ae, 9ae), 8,968 V from the + side (the rail or 5ae) to the − side (the rail or 10ae).
 */
import { Box3, Vector3 } from 'three';
import { handPolicy } from '../parts/policy';
import { ROWS, WINDOWS, loopWith } from '../parts/boards';
import { HOLD, across, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { meterReadout, meterSwitch } from '../parts/meter';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'share';
type Where = 'led' | 'res' | 'bat';
const KEYS: readonly Where[] = ['led', 'res', 'bat'];
/** The windows of |V| (the model's 1,9605 V, 7,0076 V and 8,9681 V). */
const WINDOW = WINDOWS.share;
const PLUS_SIDE = ['+', '5ae'];
const MINUS_SIDE = ['-', '10ae'];

export const shareStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Where>(KEYS, HOLD.reading);
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  const reading = (): Where | null => {
    if (bench.multimeter.mode !== 'V') return null;
    const rows = probeRows();
    const v = bench.multimeter.value;
    const size = typeof v === 'number' ? Math.abs(v) : null;
    const at: Where | null = sameRows(rows, ROWS.led)
      ? 'led'
      : sameRows(rows, ROWS.gap)
        ? 'res'
        : across(rows, PLUS_SIDE, MINUS_SIDE)
          ? 'bat'
          : null;
    return at !== null && within(size, WINDOW[at][0], WINDOW[at][1]) ? at : null;
  };
  // the callouts' points (world): over a part's body, over the + rail
  const box = new Box3();
  const over = (id: string) => {
    const v = new Vector3();
    return (): Vector3 => {
      const m = bench.parts.models.get(id);
      if (!m) return v.set(0, -100, 0);
      box.setFromObject(m.hit);
      return box.getCenter(v).setY(box.max.y + 0.05);
    };
  };
  const rail = new Vector3();
  const railPoint = (): Vector3 => bench.board.socketWorld('+3', rail);
  /** A probe is in the hand: the names step aside, the sockets they stand over are the probe's targets. */
  const aiming = (): boolean => bench.hands.held?.startsWith('probe:') ?? false;
  const visible = (k: Where) => (): boolean => here(S) && !tally.done(k) && !bench.flying && !aiming();
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
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
      controls: [meterSwitch(bench, word(0), ['off', 'V'], word(1), 'off'), meterReadout(bench, word(2))],
      callouts: [
        { anchor: over('LED1'), text: word(5), side: 'up', visible: visible('led') },
        { anchor: over('R1'), text: word(6), side: 'up', visible: visible('res') },
        { anchor: railPoint, text: word(7), side: 'up', visible: visible('bat') },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      stand.board(loopWith('resistor-330'));
      bench.closed = 1;
      bench.tray.set([]);
      bench.multimeter.mode = 'off';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: true,
        name: (w) => (w.probe ? word(w.probe === 'red' ? 3 : 4) : ''),
      });
      stand.naming = { part: () => '', meter: word(0) };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
