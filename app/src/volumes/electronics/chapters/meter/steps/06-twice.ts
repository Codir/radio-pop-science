/**
 * `meter/twice` — «Більша хвиля». The player plays, the switch closed, the knob at its middle; both of the scope's
 * probes at rest, the hand takes them alone. Sweeps of 1 ms a division triggered by channel 1, one scale of 0,25 V a
 * division for both channels on entry (±1 V); the dock: the slider «Гучність» (the volume control's knob, «тихо» at 0
 * and «гучно» at 1), right under it the two crests, the largest |v| of each channel over the last 0,5 s, then the switch
 * «Масштаб першого щупа» (0,25 or 0,02 V a division for channel 1 alone, drawn on the chart's right axis). Over the
 * board «вхід підсилювача» stands over the wiper's row 15ae and «динамік» over the speaker's row 10ae, each gone while
 * a probe is in its row, and both while a probe is in the hand. Goal, while channel 1 is on 15ae and channel 2 on 10ae
 * (3 s together at least): the knob at 0,25 or lower for 1 s, at 0,5 or higher for 1 s, and channel 1 at 0,02 V a
 * division for 1 s while the knob stands within 0,25 … 0,5 (both lines on the screen then).
 */
import { fmtPercent } from '@/content/format';
import { setSetting } from '@electronics/shared/bench';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, KNOB, ROWS, TWICE_MARKS, WINDOWS } from '../parts/boards';
import { createHold, rowOf } from '../parts/goals';
import { overSocket } from '../parts/marks';
import { handPolicy } from '../parts/policy';
import { TWICE, TWICE_ZOOM, crestStats, perDivision, scopeBoard, voltsText } from '../parts/scope';

const S = 'twice';
/** The dock's ids. */
export const VOLUME_ID = 'volume';
export const SCALE_ID = 'ch1-scale';
export const CRESTS_ID = 'crests';
const [ZOOM_LO, ZOOM_HI] = WINDOWS.twice.zoom;

export const twiceStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const low = createHold(HOLD.state);
  const high = createHold(HOLD.state);
  const zoom = createHold(HOLD.state);
  let together = 0;
  const row = (s: string | null) => rowOf(bench.layout, s);
  const knob = (): number => bench.state.settings.get('P1') ?? KNOB;
  const zoomed = (): boolean => bench.oscilloscope.settings.channelVolts[0] === TWICE_ZOOM;
  const probed = (r: string): boolean =>
    row(bench.oscilloscope.sockets.ch1) === r || row(bench.oscilloscope.sockets.ch2) === r;
  /** A probe is in the hand: the callouts step aside from the sockets it is aimed at (on a phone they lie on them). */
  const aiming = (): boolean => bench.hands.held?.startsWith('probe:') ?? false;
  const both = (): boolean =>
    stand.playing() &&
    bench.closed >= 0.5 &&
    row(bench.oscilloscope.sockets.ch1) === ROWS.input &&
    row(bench.oscilloscope.sockets.ch2) === ROWS.speaker;
  const setScale = (id: string): void =>
    bench.oscilloscope.configure({ ...TWICE, channelVolts: [id === String(TWICE_ZOOM) ? TWICE_ZOOM : null, null] });
  ctx.qa.expose(S, () => ({
    ch1: bench.oscilloscope.sockets.ch1,
    ch2: bench.oscilloscope.sockets.ch2,
    knob: knob(),
    zoomed: zoomed(),
    crests: [bench.oscilloscope.model.peak(0, 0.5), bench.oscilloscope.model.peak(1, 0.5)],
    together,
    low: low.done,
    high: high.done,
    zoom: zoom.done,
    marks: { input: here(S) && !aiming() && !probed(ROWS.input), speaker: here(S) && !aiming() && !probed(ROWS.speaker) },
    reached: reached(S),
  }));
  const scales = [TWICE.voltsPerDiv!, TWICE_ZOOM];
  // QA: where the callouts point
  ctx.qa.probe('mark:input', () => overSocket(bench, TWICE_MARKS.input));
  ctx.qa.probe('mark:speaker', () => overSocket(bench, TWICE_MARKS.speaker));

  return {
    spec: { camera: 'scope', params: { meter: 0, scope: 1 } },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: VOLUME_ID,
          label: word(0),
          min: 0,
          max: 1,
          step: 0.01,
          value: KNOB,
          marks: [
            { value: 0, label: word(1) },
            { value: 1, label: word(2) },
          ],
          format: (v: number) => fmtPercent(v),
          onInput: (v: number) => void setSetting(bench.state, 'P1', v),
          onChange: (v: number) => void setSetting(bench.state, 'P1', v),
        },
        // the crests right under the knob that moves them (a block keeps its place in the dock; review of E3-8)
        crestStats(bench, CRESTS_ID, [word(4), word(5)]),
        {
          type: 'segmented',
          id: SCALE_ID,
          label: word(3),
          items: scales.map((v) => ({ id: String(v), label: perDivision(voltsText(v), word(11)) })),
          value: String(scales[0]),
          onChange: setScale,
        },
      ],
      board: scopeBoard(bench, 'scope-twice', word(6), {
        volts: word(9),
        time: word(10),
        division: word(11),
        ch1: word(7),
        ch2: word(8),
        own: true,
      }),
      callouts: [
        {
          anchor: () => overSocket(bench, TWICE_MARKS.input),
          text: word(12),
          side: 'up',
          visible: () => here(S) && !bench.flying && !aiming() && !probed(ROWS.input),
        },
        {
          anchor: () => overSocket(bench, TWICE_MARKS.speaker),
          text: word(13),
          side: 'left',
          visible: () => here(S) && !bench.flying && !aiming() && !probed(ROWS.speaker),
        },
      ],
      goal: () => reached(S),
    },
    enter() {
      low.reset();
      high.reset();
      zoom.reset();
      together = 0;
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, 'P1', KNOB);
      ui.set(VOLUME_ID, KNOB);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.oscilloscope.configure(TWICE);
      ui.set(SCALE_ID, String(scales[0]));
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: ['ch1', 'ch2'],
        name: (w) => (w.probe === 'ch1' ? word(7) : w.probe === 'ch2' ? word(8) : ''),
      });
      stand.naming = { meter: '', scope: word(6), player: '', tap: false };
    },
    late(dt) {
      if (!here(S)) return;
      const on = both();
      if (on) together += dt;
      const k = knob();
      low.feed(on && k <= WINDOWS.twice.low + 1e-9, dt);
      high.feed(on && k >= WINDOWS.twice.high - 1e-9, dt);
      zoom.feed(on && zoomed() && k >= ZOOM_LO - 1e-9 && k <= ZOOM_HI + 1e-9, dt);
      if (together >= HOLD.together - 1e-9 && low.done && high.done && zoom.done && !reached(S)) reach(S);
    },
  };
};
