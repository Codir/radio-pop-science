/**
 * `meter/amps` — «Струм крізь прилад». The same amplifier, the switch closed, the player stopped; the whole amplifier
 * takes its power through the violet supply jumper `J10` from `+1` to `a1` (the protection diode's anode row). The
 * multimeter on its place on «V», its probes at rest; the dock has «V», «A» and the number. The hand takes the jumper
 * whole only (let go off the board it goes to the tray, which offers a new one) and the two probes; the callout
 * «Перемичка» stands over `J10` while it is in the gap. On a desk and a tablet the step has its own shot
 * (`AMPS_SHOT`). Goal: no part joins the gap's rows (the + rail and 1ae), «A», the probes in those two rows (either
 * way), |I| 13,2 … 13,4 mA (the model's 13,3122 mA) for 1 s, and the meter's current the battery's within 0,1 %: all
 * the amplifier's current through the meter. The meter on «A» elsewhere is nearly a wire and can short a part of the
 * amplifier: a part burns (the model's event); then the dock's button «Нові деталі» puts the step's board back, whole,
 * the dial on «V», the probes at rest.
 */
import { STAGE_SHOTS } from '@electronics/shared/bench';
import { METER_ID } from '@electronics/shared/instruments';
import {
  MODE_ID,
  createTally,
  handPolicy,
  meterReadout,
  meterSwitch,
  rowsOf,
  sameRows,
  trayButtons,
  within,
} from '@electronics/shared/steps';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMP, HOLD, ROWS, SUPPLY, WINDOWS } from '../parts/boards';
import { overPart } from '../parts/marks';
import { AMPS_SHOT, CAMERA_FLIGHT } from '../parts/shots';

const S = 'amps';
const [LO, HI] = WINDOWS.amps;
/** The amplifier's own jumpers but the supply's: they stay where they are. */
const FIXED = new Set(AMP.parts.filter((p) => p.spec === 'jumper' && p.id !== SUPPLY).map((p) => p.id));

export const ampsStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  // the step's shot follows the page between a desk and a phone, as the bench's own shots do
  const shoot = (): void => ctx.camera.shots({ [S]: stand.phone() ? STAGE_SHOTS.phone : AMPS_SHOT });
  shoot();
  ctx.onResize(shoot);
  const tally = createTally<'gap'>(['gap'], HOLD.reading);
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  /** A part joins the gap's two rows (the supply jumper, or a jumper from the tray put there). */
  const closed = (): boolean =>
    [...bench.state.parts.values()].some((p) => sameRows(rowsOf(bench.layout, p.legs), ROWS.gap));
  /** J10 stands in the gap, both ends in their sockets (the callout «Перемичка» over it). */
  const supplyIn = (): boolean => sameRows(rowsOf(bench.layout, bench.state.parts.get(SUPPLY)?.legs ?? []), ROWS.gap);
  const size = (): number | null => {
    const v = bench.multimeter.value;
    return typeof v === 'number' ? Math.abs(v) : null;
  };
  const amps = (): boolean => {
    if (bench.multimeter.mode !== 'A' || closed() || !sameRows(probeRows(), ROWS.gap)) return false;
    if (bench.closed < 0.5 || stand.playing()) return false;
    const meter = bench.model.reading(METER_ID)?.i;
    const battery = bench.model.reading('BAT')?.i;
    if (meter === undefined || battery === undefined || Math.abs(battery) < 1e-6) return false;
    return within(size(), LO, HI) && Math.abs(Math.abs(meter) / Math.abs(battery) - 1) < WINDOWS.same;
  };
  /** A part of the board burnt or bulged, or the speaker burnt (a thing of the bench, outside `state.parts`): the
   * button «Нові деталі» shows; the step's board brings them back whole (the bench forgets its things too). */
  const damaged = (): boolean => {
    for (const id of [...bench.state.parts.keys(), 'SPK']) {
      const c = bench.model.part(id)?.condition;
      if (c === 'burnt' || c === 'bulged') return true;
    }
    return false;
  };
  /** The step's own board, new and whole; the dial on «V», the probes at rest. */
  const fresh = (): void => {
    stand.board(AMP.parts, AMP.leads);
    bench.closed = 1;
    stand.play(false);
    bench.multimeter.mode = 'V';
    ui.set(MODE_ID, 'V');
    bench.multimeter.put({ red: null, black: null });
  };
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
    gapClosed: closed(),
    supplyIn: supplyIn(),
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    meter: bench.model.reading(METER_ID)?.i ?? null,
    battery: bench.model.reading('BAT')?.i ?? null,
    led: bench.model.reading('LED1')?.i ?? null,
    holding: tally.holding,
    damaged: damaged(),
    key: bench.model.net?.key ?? null,
    reached: reached(S),
  }));

  return {
    // a longer flight: from `meter` (volts) and from `scope` (flat, on the way back) the camera crosses the bench
    spec: { camera: S, cameraMove: { duration: CAMERA_FLIGHT }, params: { meter: 1, scope: 0 } },
    ui: {
      reset: true,
      controls: [
        meterSwitch(bench, word(0), ['V', 'A'], '', 'V'),
        meterReadout(bench, word(1)),
        ...trayButtons(bench, ['jumper'], () => word(4), stand.phone),
        { type: 'button', id: 'fresh', label: word(5), visible: () => here(S) && damaged(), onClick: fresh },
      ],
      callouts: [
        {
          anchor: () => overPart(bench, SUPPLY, 0.35),
          text: word(4),
          side: 'up',
          visible: () => here(S) && !bench.flying && supplyIn() && bench.hands.held === null,
        },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      bench.tray.set(['jumper']);
      fresh();
      bench.hands.policy = handPolicy(bench, {
        tray: ['jumper'],
        // the supply jumper (or a new one from the tray), whole only; the amplifier's own parts stay. Not by an end:
        // the short jumper's two grips cover it (on a touch screen they show all the time), so a press on it took an
        // end, and an end let go off the board lay stretched across the board instead of going to the tray (review
        // of E3-8)
        part: (spec, id) => spec === 'jumper' && !FIXED.has(id),
        probes: ['red', 'black'],
        name: (w) =>
          w.probe === 'red' ? word(2) : w.probe === 'black' ? word(3) : w.spec === 'jumper' ? word(4) : '',
      });
      stand.naming = { meter: word(0), scope: '', player: '', tap: false };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(amps() ? 'gap' : null, dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
