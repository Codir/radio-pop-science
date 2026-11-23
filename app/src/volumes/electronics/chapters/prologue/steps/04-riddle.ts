/**
 * `prologue/riddle` — «Загадка хвилі». The amplifier plays (the switch closed, the knob at 0,5, the player at 0,3 V);
 * the oscilloscope slides in at the back on the right (0,6 s) — the prologue does not name it: «Прилад з екраном». One
 * scale for the three points (2,5 V a division, 0 V in the middle; 5 ms a division, sweeps triggered by the probe's
 * own channel, `parts/scope.ts`). The hand takes the scope's first probe alone («Щуп»). Over the board «батарейка»
 * stands over the + rail, «плеєр» over the player's row 13ae, «динамік» over the speaker's row 10ae; each goes out
 * once the probe has been in its row 2 s. The shot `scope` (a phone: `phone`, the chart in the sheet). Goal: the probe
 * 2 s in a row in each of the three rows (any order), the amplifier playing.
 */
import { setSetting } from '@electronics/shared/bench';
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { AMP, HOLD, IDS, KNOB, RIDDLE_MARKS, RIDDLE_ROWS, type RiddleRow } from '../parts/boards';
import { createTally, rowOf } from '../parts/goals';
import { overSocket } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { RIDDLE, riddleBoard } from '../parts/scope';

const S = 'riddle';
const KEYS = Object.keys(RIDDLE_ROWS) as RiddleRow[];

export const riddleStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<RiddleRow>(KEYS, HOLD.riddle);
  const row = () => rowOf(bench.layout, bench.oscilloscope.sockets.ch1);
  /** The row of the three the probe is in now, or null. */
  const at = (): RiddleRow | null => {
    const r = row();
    return KEYS.find((k) => RIDDLE_ROWS[k] === r) ?? null;
  };
  const playing = (): boolean => bench.closed >= 0.5 && stand.playing() && bench.scope >= 0.999;
  ctx.qa.expose(S, () => ({
    ch1: bench.oscilloscope.sockets.ch1,
    at: at(),
    playing: playing(),
    counted: [...tally.counted],
    holding: tally.holding,
    crest: bench.oscilloscope.model.peak(0, HOLD.riddle),
    marks: Object.fromEntries(KEYS.map((k) => [k, here(S) && !tally.done(k)])),
    reached: reached(S),
  }));
  // QA: where the words stand
  for (const k of KEYS) ctx.qa.probe(`mark:${k}`, () => overSocket(bench, RIDDLE_MARKS[k]));
  const words: Record<RiddleRow, number> = { battery: 2, player: 3, speaker: 4 };
  const sides: Record<RiddleRow, 'up' | 'left' | 'right'> = { battery: 'left', player: 'right', speaker: 'up' };

  return {
    spec: { camera: 'scope', params: { meter: 0, scope: 1 } },
    ui: {
      reset: true,
      board: riddleBoard(bench, 'scope-riddle', word(0), word(1)),
      callouts: KEYS.map((k) => ({
        anchor: () => overSocket(bench, RIDDLE_MARKS[k]),
        text: word(words[k]),
        side: sides[k],
        visible: () => here(S) && !bench.flying && !tally.done(k),
      })),
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, IDS.pot, KNOB.middle);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.oscilloscope.configure(RIDDLE);
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, { probe: true, name: (w) => (w.probe ? word(1) : '') });
      stand.naming = { player: '', speaker: '', scope: word(0), tap: false };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(playing() ? at() : null, dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
