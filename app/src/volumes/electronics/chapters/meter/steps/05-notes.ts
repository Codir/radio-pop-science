/**
 * `meter/notes` — «Повільні й часті хвилі». As in `wave`, the player playing from the entry and the multimeter away;
 * the step puts the scope's probe on the player's row 13ae once the scope stands on its place, and the hand takes it
 * alone. The dock's switch «Час на поділку» gives 20, 5 (on entry) and 1 ms a division at 0,1 V a division; the time
 * axis' division follows it. Goal: the player plays and the probe stands on 13ae while the switch was on 20 ms for 3 s
 * in a row and on 1 ms for 3 s in a row (either first). «частота» stands over the screen with the takeaway.
 */
import { setSetting } from '@electronics/shared/bench';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, KNOB, NOTES_SCOPE, ROWS } from '../parts/boards';
import { createTally, rowOf } from '../parts/goals';
import { overTrace } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { NOTES_ENTRY, NOTES_TIMES, WAVE, scopeBoard, timeText } from '../parts/scope';

const S = 'notes';
/** The dock's id of the switch «Час на поділку». */
export const TIME_ID = 'time-div';
type Span = 'slow' | 'quick';

export const notesStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Span>(['slow', 'quick'], HOLD.notes);
  let put = false;
  const timePerDiv = (): number => bench.oscilloscope.settings.timePerDiv;
  const state = (): Span | null => {
    if (!stand.playing() || rowOf(bench.layout, bench.oscilloscope.sockets.ch1) !== ROWS.player) return null;
    const t = timePerDiv();
    return t === NOTES_TIMES[0] ? 'slow' : t === NOTES_TIMES[2] ? 'quick' : null;
  };
  ctx.qa.expose(S, () => ({
    playing: stand.playing(),
    ch1: bench.oscilloscope.sockets.ch1,
    timePerDiv: timePerDiv(),
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'scope', params: { meter: 0, scope: 1 } },
    ui: {
      reset: true,
      controls: [
        {
          type: 'segmented',
          id: TIME_ID,
          label: word(5),
          items: NOTES_TIMES.map((t) => ({ id: String(t), label: timeText(t) })),
          value: String(NOTES_ENTRY),
          onChange: (id: string) => bench.oscilloscope.configure({ ...WAVE, timePerDiv: Number(id) }),
        },
      ],
      board: scopeBoard(bench, 'scope-notes', word(0), {
        volts: word(2),
        time: word(3),
        division: word(4),
        ch1: word(1),
        ch2: '',
      }),
      callouts: [
        { anchor: () => overTrace(bench, stand.phone()), text: word(6), side: 'up', visible: () => here(S) && reached(S) },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      put = false;
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, 'P1', KNOB);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.oscilloscope.configure({ ...WAVE, timePerDiv: NOTES_ENTRY });
      ui.set(TIME_ID, String(NOTES_ENTRY));
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: ['ch1'],
        name: (w) => (w.probe === 'ch1' ? word(1) : ''),
      });
      stand.naming = { meter: '', scope: word(0), player: '', tap: false };
    },
    update() {
      if (!here(S) || put || bench.scope < 1 - 1e-3) return;
      bench.oscilloscope.put({ ch1: NOTES_SCOPE });
      put = true;
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(state(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
