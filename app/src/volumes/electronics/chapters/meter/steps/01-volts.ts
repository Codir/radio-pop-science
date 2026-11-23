/**
 * `meter/volts` — «Напруга між двома точками». The prologue's amplifier on the board (`AMPLIFIER_PRESET`), the switch
 * closed, the player stopped: the amplifier is quiet and its LED «on» lit. The multimeter slides in on the left,
 * its dial «вимкнено», its probes at rest; the dock has the dial's switch («вимкнено», «V») and the number. The hand
 * takes the two probes only. Goal: «V», red in the + rail and black in the − rail, the display 8,975 … 8,985 V (the
 * model's 8,98002 V) for 1 s; and the other way round, −8,985 … −8,975 V for 1 s (either first).
 */
import { MODE_ID, createTally, handPolicy, meterReadout, meterSwitch, rowOf, within } from '@electronics/shared/steps';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, ROWS, WINDOWS } from '../parts/boards';

const S = 'volts';
const [LO, HI] = WINDOWS.volts;

export const voltsStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<'forward' | 'reverse'>(['forward', 'reverse'], HOLD.reading);
  const rows = () => ({
    red: rowOf(bench.layout, bench.multimeter.sockets.red),
    black: rowOf(bench.layout, bench.multimeter.sockets.black),
  });
  /** The state of this frame: the rails' voltage one way or the other on «V», with the amplifier quiet. */
  const reading = (): 'forward' | 'reverse' | null => {
    if (bench.multimeter.mode !== 'V' || bench.closed < 0.5 || stand.playing()) return null;
    const { red, black } = rows();
    const v = bench.multimeter.value;
    if (red === ROWS.plus && black === ROWS.minus && within(v, LO, HI)) return 'forward';
    if (red === ROWS.minus && black === ROWS.plus && within(v, -HI, -LO)) return 'reverse';
    return null;
  };
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    ...rows(),
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    closed: bench.closed,
    playing: stand.playing(),
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'meter', params: { meter: 1, scope: 0 } },
    ui: {
      reset: true,
      controls: [meterSwitch(bench, word(0), ['off', 'V'], word(1), 'off'), meterReadout(bench, word(2))],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      stand.board(AMP.parts, AMP.leads);
      bench.closed = 1;
      stand.play(false);
      bench.tray.set([]);
      bench.multimeter.mode = 'off';
      ui.set(MODE_ID, 'off');
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: ['red', 'black'],
        name: (w) => (w.probe === 'red' ? word(3) : w.probe === 'black' ? word(4) : ''),
      });
      stand.naming = { meter: word(0), scope: '', player: '', tap: false };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
