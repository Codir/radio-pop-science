/**
 * `meter/wave` — «Музика в дроті». The amplifier on the board, the switch closed, the knob at its middle, the player
 * stopped on entry. Both instruments: the multimeter comes back on «V» and, once on its place, the step puts its
 * probes — red on the player's row 13ae, black on the − rail (the hand does not take them); the dock shows its number
 * «Мультиметр». The oscilloscope sweeps at 5 ms a division, 0,1 V a division with 0 V in the middle (±0,4 V),
 * triggered by channel 1. A tap on the player's box plays or stops the melody (a phone: the dock's toggle «Плеєр»):
 * the same tap is the engine's first gesture, from which the speaker sounds. The hand takes the scope's probe. Goal:
 * the player plays and the probe stands on 13ae for 3 s in a row, the trace never beyond ±0,35 V over them and each
 * 2 s of them reaching 0,2 V (the model's 0,244 … 0,289 V), the meter on the same row with |U| below 1 mV (the
 * model's 0,002 mV: the operating point's leak). «змінна напруга» stands over the screen with the takeaway.
 */
import { setSetting } from '@electronics/shared/bench';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, KNOB, ROWS, WAVE_METER, WINDOWS } from '../parts/boards';
import { MODE_ID, meterReadout, playerToggle } from '../parts/dock';
import { rowOf, waveVerdict } from '../parts/goals';
import { overTrace } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { WAVE, scopeBoard } from '../parts/scope';

const S = 'wave';
const RULES = { need: HOLD.wave, window: HOLD.crest, crest: WINDOWS.wave.crest, edge: WINDOWS.wave.edge };

export const waveStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  /** The step's meter probes go in once the meter stands on its place (it slides in for 0.6 s). */
  let put = false;
  let held = 0;
  let verdict: 'go' | 'broke' | 'done' = 'go';
  const row = (s: string | null) => rowOf(bench.layout, s);
  const knob = (): number => bench.state.settings.get('P1') ?? KNOB;
  /** The meter as the step put it: «V», red on the player's row, black on the − rail, |U| below 1 mV. */
  const meterOk = (): boolean => {
    const v = bench.multimeter.value;
    return (
      bench.multimeter.mode === 'V' &&
      row(bench.multimeter.sockets.red) === ROWS.player &&
      row(bench.multimeter.sockets.black) === ROWS.minus &&
      typeof v === 'number' &&
      Math.abs(v) < WINDOWS.wave.meter
    );
  };
  const listening = (): boolean =>
    stand.playing() &&
    bench.closed >= 0.5 &&
    Math.abs(knob() - KNOB) < 1e-9 &&
    row(bench.oscilloscope.sockets.ch1) === ROWS.player &&
    meterOk();
  ctx.qa.expose(S, () => ({
    playing: stand.playing(),
    taps: stand.taps,
    ch1: bench.oscilloscope.sockets.ch1,
    red: bench.multimeter.sockets.red,
    black: bench.multimeter.sockets.black,
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    crest: bench.oscilloscope.model.peak(0, HOLD.crest),
    held,
    verdict,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'scope', params: { meter: 1, scope: 1 } },
    ui: {
      reset: true,
      controls: [playerToggle(word(0), stand.phone, (on) => stand.play(on)), meterReadout(bench, word(6))],
      board: scopeBoard(bench, 'scope-wave', word(1), {
        volts: word(3),
        time: word(4),
        division: word(5),
        ch1: word(2),
        ch2: '',
      }),
      callouts: [
        { anchor: () => overTrace(bench, stand.phone()), text: word(7), side: 'up', visible: () => here(S) && reached(S) },
      ],
      goal: () => reached(S),
    },
    enter() {
      put = false;
      held = 0;
      verdict = 'go';
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, 'P1', KNOB);
      bench.closed = 1;
      stand.play(false);
      bench.tray.set([]);
      bench.oscilloscope.configure(WAVE);
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.multimeter.mode = 'V';
      ui.set(MODE_ID, 'V');
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: ['ch1'],
        name: (w) => (w.probe === 'ch1' ? word(2) : ''),
      });
      stand.naming = { meter: word(6), scope: word(1), player: word(0), tap: true };
    },
    update() {
      if (!here(S) || put || bench.meter < 1 - 1e-3) return;
      bench.multimeter.put(WAVE_METER);
      put = true;
    },
    late(dt) {
      if (!here(S)) return;
      held = listening() ? held + dt : 0;
      const scope = bench.oscilloscope.model;
      verdict =
        held > 0 ? waveVerdict(held, scope.peak(0, HOLD.crest), scope.peak(0, Math.min(held, HOLD.wave)), RULES) : 'go';
      if (verdict === 'broke') held = 0;
      if (verdict === 'done' && !reached(S)) reach(S);
    },
  };
};
