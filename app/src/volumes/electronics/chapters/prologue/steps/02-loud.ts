/**
 * `prologue/loud` — «Гучна музика». The amplifier on the board with the player's plugs on its input (`pl+` in c13, the
 * top of the volume control) and the speaker's on its output (`spk+` in c10), the commons in the ground row 17ae
 * (`AMPLIFIER_PRESET`); the player plays (0,3 V), the switch open, the knob at 0,1: silence — the amplifier is off. The
 * hand takes the switch alone (a tap on its slider; a phone: the dock's toggle «Вимикач батарейки»); the dock: the
 * slider «Гучність» («тихо» at 0, «гучно» at 1), the knob on the board follows it; «Хвиля на динаміку» and the line
 * about the sound. The shot `stand` (a phone: `phone`). Goal: the switch closed, the battery giving above 10 mA (the
 * model's 13,31 mA at rest) and the knob at 0,8 or higher for 1 s. «підсилювач» stands over the board with the
 * takeaway.
 */
import { setSetting } from '@electronics/shared/bench';
import { createHold, handPolicy, knobSlider, switchToggle } from '@electronics/shared/steps';
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { AMP, HOLD, IDS, KNOB, WINDOWS } from '../parts/boards';
import { VOLUME_ID, soundNote, waveGauge } from '../parts/dock';
import { overBoard } from '../parts/marks';

const S = 'loud';

export const loudStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const hold = createHold(HOLD.loud);
  /** The battery's current (A, its size): the amplifier powered takes 13,31 mA at rest. */
  const battery = (): number => Math.abs(bench.model.reading(IDS.battery)?.i ?? 0);
  const loud = (): boolean =>
    bench.closed >= 0.5 && battery() > WINDOWS.loud.battery && stand.knob() >= WINDOWS.loud.knob - 1e-9;
  ctx.qa.expose(S, () => ({
    playing: stand.playing(),
    closed: bench.closed,
    knob: stand.knob(),
    battery: battery(),
    led: bench.model.reading(IDS.led)?.i ?? null,
    crest: stand.crest(),
    soundOff: stand.soundOff(),
    held: hold.held,
    reached: reached(S),
  }));

  return {
    spec: { camera: 'stand', params: { meter: 0, scope: 0 } },
    ui: {
      reset: true,
      controls: [
        knobSlider(
          bench,
          VOLUME_ID,
          IDS.pot,
          word(1),
          [
            { value: 0, label: word(2) },
            { value: 1, label: word(3) },
          ],
          KNOB.low,
        ),
        switchToggle(bench, word(0), stand.phone),
        waveGauge(word(4), () => stand.crest()),
        soundNote(word(5), () => stand.soundOff()),
      ],
      callouts: [{ anchor: () => overBoard(bench), text: word(6), side: 'up', visible: () => here(S) && reached(S) }],
      goal: () => reached(S),
    },
    enter() {
      hold.reset();
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, IDS.pot, KNOB.low);
      ui.set(VOLUME_ID, KNOB.low);
      bench.closed = 0;
      stand.play(true);
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.hands.policy = handPolicy(bench, { switch: true, name: (w) => (w.switch ? word(0) : '') });
      stand.naming = { meter: '' };
    },
    late(dt) {
      if (!here(S)) return;
      hold.feed(loud(), dt);
      if (hold.done && !reached(S)) reach(S);
    },
  };
};
