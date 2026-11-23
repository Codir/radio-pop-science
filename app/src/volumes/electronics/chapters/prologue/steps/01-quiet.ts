/**
 * `prologue/quiet` — «Шепіт плеєра». The amplifier on the board, dark and cold (the switch open); the player's and the
 * speaker's signal plugs together in the free row 16ae, their commons in the ground row 17ae (`QUIET`): the player
 * straight on the speaker, past the parts. The player stands on entry; a tap on its box plays the melody (0,3 V),
 * another stops it — the same tap is the engine's first gesture, from which the volume's sound starts. Until the first
 * tap the player pulses (`cyan`, the step's call). The shot `stand` (a phone: the chapter's own, with the player and the
 * speaker in it — `phone` leaves them out, and a press on the dock is no gesture). The dock: «Хвиля на динаміку» and,
 * while the sound is off, the line that says so. The hand takes nothing. Goal: the player plays with its plugs past
 * the amplifier for 3 s in a row, the speaker's crest over them within 0,05 … 0,06 V (the model's 0,051 … 0,058 V).
 */
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { HOLD, QUIET, ROWS, WINDOWS } from '../parts/boards';
import { soundNote, waveGauge } from '../parts/dock';
import { createRun, rowOf } from '../parts/goals';
import { PLAYER_CALL } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { quietShot } from '../parts/shots';

const S = 'quiet';
const [LO, HI] = WINDOWS.quiet;

export const quietStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  // the step's shot follows the page between a desk and a phone, as the bench's own shots do
  const shoot = (): void => ctx.camera.shots({ [S]: quietShot(stand.phone()) });
  shoot();
  ctx.onResize(shoot);
  const run = createRun(HOLD.quiet, LO, HI);
  /** The taps on the player before this visit of the step: the call lasts until the first one. */
  let tapsBefore = 0;
  const lead = (name: string) => rowOf(bench.layout, bench.state.leads.get(name) ?? null);
  /** The player straight on the speaker: the signal plugs in one row, the commons in the ground row. */
  const past = (): boolean => {
    const signal = lead('pl+');
    return (
      signal !== null &&
      signal === lead('spk+') &&
      signal !== ROWS.ground &&
      lead('pl-') === ROWS.ground &&
      lead('spk-') === ROWS.ground
    );
  };
  ctx.qa.expose(S, () => ({
    playing: stand.playing(),
    taps: stand.taps - tapsBefore,
    leads: Object.fromEntries(['pl+', 'spk+', 'pl-', 'spk-'].map((n) => [n, bench.state.leads.get(n) ?? null])),
    past: past(),
    closed: bench.closed,
    crest: stand.crest(),
    held: run.held,
    runCrest: run.crest,
    soundOff: stand.soundOff(),
    call: stand.call.id,
    reached: reached(S),
  }));

  return {
    spec: { camera: S, params: { meter: 0, scope: 0 } },
    ui: {
      reset: true,
      controls: [waveGauge(word(2), () => stand.crest()), soundNote(word(3), () => stand.soundOff())],
      goal: () => reached(S),
    },
    enter() {
      run.reset();
      stand.board(QUIET.parts, QUIET.leads);
      bench.closed = 0;
      stand.play(false);
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.hands.policy = handPolicy(bench, { name: () => '' });
      stand.naming = { player: word(0), speaker: word(1), scope: '', tap: true };
      tapsBefore = stand.taps;
    },
    late(dt, t) {
      if (!here(S)) return;
      stand.call.to(stand.taps === tapsBefore && !stand.playing() ? PLAYER_CALL : null, t);
      run.feed(stand.playing() && past(), stand.crest(), dt);
      if (run.done && !reached(S)) reach(S);
    },
  };
};
