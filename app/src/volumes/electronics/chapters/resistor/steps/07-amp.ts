/**
 * `resistor/amp` — «Резистор у підсилювачі». The amplifier is back on the board (`parts/boards.ts` `AMP`: the volume's
 * `AMPLIFIER_PRESET` with a gap for the meter in the branch of its LED «on» — R1 2,2 kΩ from the supply to 5fj, the
 * violet J11 from 5fj to 1fj, the LED from 1fj to the − rail), the switch closed, the player's and the speaker's plugs
 * in. The multimeter on its place on «V»; the hand takes the probes and the jumper (whole or by an end; one let go off
 * the board goes to the tray, which has a jumper). A callout names «резистор 2,2 kΩ». Goal, in this order: (a) J11 in
 * place, «V», the probes across R1 (the supply's row and 5fj or 1fj), |U| 6,582 … 6,592 V for 1 s; (b) no jumper in the
 * gap, «A», the probes in J11's rows, |I| 2,990 … 2,998 mA for 1 s and the meter's current the LED's within 0,1 %. The
 * meter on «A» elsewhere is nearly a wire and can short a part of the amplifier: a part burns (the model's event);
 * then the dock's button «Нові деталі» puts the step's board back, whole, the dial on «V», the probes at rest.
 */
import { Box3, Vector3 } from 'three';
import { METER_ID } from '@electronics/shared/instruments';
import { kindOf, handPolicy } from '../parts/policy';
import { AMP, AMP_ROWS, WINDOWS } from '../parts/boards';
import { HOLD, across, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { trayButtons } from '../parts/dock';
import { MODE_ID, meterReadout, meterSwitch } from '../parts/meter';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'amp';
/** The windows of the two readings: |U| on R1 (the model's 6,5872 V), |I| in the gap (the model's 2,9942 mA). */
const { volts: VOLTS, amps: AMPS } = WINDOWS.amp;
/** How far the meter's current may be from the LED's in (b) (relative). */
const SAME = 1e-3;
/** The amplifier's own jumpers: they stay where they are. */
const FIXED = new Set(AMP.parts.filter((p) => p.spec === 'jumper' && p.id !== AMP_ROWS.jumper).map((p) => p.id));

export const ampStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const first = createTally<'a'>(['a'], HOLD.reading);
  const second = createTally<'b'>(['b'], HOLD.reading);
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  /** A part joins the gap's two rows (J11, or a jumper from the tray put there). */
  const closed = (): boolean =>
    [...bench.state.parts.values()].some((p) => sameRows(rowsOf(bench.layout, p.legs), AMP_ROWS.gap));
  const size = (): number | null => {
    const v = bench.multimeter.value;
    return typeof v === 'number' ? Math.abs(v) : null;
  };
  const volts = (): boolean =>
    bench.multimeter.mode === 'V' &&
    closed() &&
    across(probeRows(), AMP_ROWS.supply, AMP_ROWS.load) &&
    within(size(), VOLTS[0], VOLTS[1]);
  const amps = (): boolean => {
    if (bench.multimeter.mode !== 'A' || closed() || !sameRows(probeRows(), AMP_ROWS.gap)) return false;
    const meter = bench.model.reading(METER_ID)?.i;
    const led = bench.model.reading('LED1')?.i;
    if (meter === undefined || led === undefined || Math.abs(led) < 1e-6) return false;
    return within(size(), AMPS[0], AMPS[1]) && Math.abs(Math.abs(meter) / Math.abs(led) - 1) < SAME;
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
    bench.multimeter.mode = 'V';
    ui.set(MODE_ID, 'V');
    bench.multimeter.put({ red: null, black: null });
  };
  const box = new Box3();
  const over = new Vector3();
  const r1 = (): Vector3 => {
    const m = bench.parts.models.get('R1');
    if (!m) return over.set(0, -100, 0);
    box.setFromObject(m.hit);
    return box.getCenter(over).setY(box.max.y + 0.05);
  };
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
    gapClosed: closed(),
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    meter: bench.model.reading(METER_ID)?.i ?? null,
    led: bench.model.reading('LED1')?.i ?? null,
    a: first.done('a'),
    b: second.done('b'),
    damaged: damaged(),
    key: bench.model.net?.key ?? null,
    reached: reached(S),
  }));
  const name = (id: string): string => {
    const spec = bench.state.parts.get(id)?.spec ?? '';
    const kind = kindOf(spec);
    if (kind === 'resistor') return word(5);
    if (kind === 'led') return word(6);
    if (kind === 'jumper') return word(4);
    return spec === '' ? '' : word(7);
  };

  return {
    spec: { camera: 'meter', params: { meter: 1 } },
    ui: {
      reset: true,
      controls: [
        meterSwitch(bench, word(0), ['V', 'A'], '', 'V'),
        meterReadout(bench, word(1)),
        ...trayButtons(bench, ['jumper'], () => word(4), stand.phone),
        { type: 'button', id: 'fresh', label: word(9), visible: () => here(S) && damaged(), onClick: fresh },
      ],
      callouts: [
        {
          anchor: r1,
          text: word(8),
          side: 'up',
          visible: () => here(S) && !second.done('b') && !bench.flying,
        },
      ],
      goal: () => reached(S),
    },
    enter() {
      first.reset();
      second.reset();
      bench.tray.set(['jumper']);
      fresh();
      bench.hands.policy = handPolicy(bench, {
        tray: ['jumper'],
        // the gap's jumper (or a new one from the tray), whole or by an end; the amplifier's own parts stay
        part: (spec, id) => spec === 'jumper' && !FIXED.has(id),
        leg: (spec, id) => spec === 'jumper' && !FIXED.has(id),
        probes: true,
        name: (w) => (w.probe ? word(w.probe === 'red' ? 2 : 3) : w.spec === 'jumper' ? word(4) : ''),
      });
      stand.naming = { part: name, meter: word(0) };
    },
    late(dt) {
      if (!here(S)) return;
      if (!first.done('a')) first.feed(volts() ? 'a' : null, dt);
      else second.feed(amps() ? 'b' : null, dt);
      if (second.done('b') && !reached(S)) reach(S);
    },
  };
};
