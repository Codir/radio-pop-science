/**
 * `resistor/amp` — «Резистор у підсилювачі». The amplifier is back on the board as the volume puts it (`parts/boards.ts`
 * `AMP` = `AMPLIFIER_PRESET`), the switch closed, the player's and the speaker's plugs in; the gap for the meter is its
 * own violet J8, which feeds the row of R5's (470 Ω) leg from the supply's row; on a desk the step has its own shot,
 * steeper than `stand` (`SHOT`), so the reservoir's can hides neither. The multimeter on its place on «V»; the
 * hand takes the probes and J8 (whole or by an end; one let go off the board goes to the tray, which has a jumper) and
 * nothing else of the amplifier. A callout names «резистор 470 Ω». Goal, in this order: (a) the gap closed, «V», the
 * probes across R5 (2ae or 5ae, and 6ae), |U| 3,926 … 3,936 V for 1 s; (b) no jumper in the gap, «A», the probes in
 * J8's rows, |I| 8,370 … 8,377 mA for 1 s and the meter's current all that leaves the row 2ae — R5's and the reservoir
 * C3's leak — within 0,1 %. The meter on «A» elsewhere is nearly a wire and can short a part of the amplifier: a part
 * burns (the model's event); then the dock's button «Нові деталі» puts the step's board back, whole, the dial on «V»,
 * the probes at rest.
 */
import { Box3, Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { STAGE_FOV, STAGE_SHOTS } from '@electronics/shared/bench';
import { METER_ID } from '@electronics/shared/instruments';
import { kindOf, handPolicy } from '../parts/policy';
import { AMP, AMP_ROWS, WINDOWS } from '../parts/boards';
import { HOLD, across, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { trayButtons } from '../parts/dock';
import { MODE_ID, meterReadout, meterSwitch } from '../parts/meter';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'amp';
/** The windows of the two readings: |U| on R5 (the model's 3,9311 V), |I| in the gap (the model's 8,3734 mA). */
const { volts: VOLTS, amps: AMPS } = WINDOWS.amp;
/** How far the meter's current may be from R5's and C3's together in (b) (relative). */
const SAME = 1e-3;
/**
 * The step's shot on a desk: the bench's `stand` (the board, the multimeter on the left, the tray) seen steeper, ≈ 56°
 * to the table instead of ≈ 40°, so that the reservoir's tall can (C3, by column 2) hides neither R5 with both its legs
 * nor J8's right half; in `stand` and `meter` it stands in front of R5's leg in a2 and of J8. On a phone the bench's
 * `phone` shot, which is steep already.
 */
const SHOT: Shot = {
  position: [-0.2, 13.85, 9.67],
  target: [-0.7, 1.0, 1.0],
  fov: STAGE_FOV,
  orbit: STAGE_SHOTS.stand.orbit,
};
const SHOT_NAME = 'amp';
/** The amplifier's own jumpers: they stay where they are. */
const FIXED = new Set(AMP.parts.filter((p) => p.spec === 'jumper' && p.id !== AMP_ROWS.jumper).map((p) => p.id));

export const ampStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  // the step's shot follows the page between a desk and a phone, as the bench's own shots do
  const shoot = (): void => ctx.camera.shots({ [SHOT_NAME]: stand.phone() ? STAGE_SHOTS.phone : SHOT });
  shoot();
  ctx.onResize(shoot);
  const first = createTally<'a'>(['a'], HOLD.reading);
  const second = createTally<'b'>(['b'], HOLD.reading);
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  /** A part joins the gap's two rows (J8, or a jumper from the tray put there). */
  const closed = (): boolean =>
    [...bench.state.parts.values()].some((p) => sameRows(rowsOf(bench.layout, p.legs), AMP_ROWS.gap));
  const size = (): number | null => {
    const v = bench.multimeter.value;
    return typeof v === 'number' ? Math.abs(v) : null;
  };
  const volts = (): boolean =>
    bench.multimeter.mode === 'V' &&
    closed() &&
    across(probeRows(), AMP_ROWS.supply, AMP_ROWS.top) &&
    within(size(), VOLTS[0], VOLTS[1]);
  /** What leaves the row 2ae with the gap open: R5's current and the reservoir's leak (A), null before a solve. */
  const fed = (): number | null => {
    const r5 = bench.model.reading('R5')?.i;
    const c3 = bench.model.reading('C3')?.i;
    return r5 === undefined || c3 === undefined ? null : Math.abs(r5) + Math.abs(c3);
  };
  const amps = (): boolean => {
    if (bench.multimeter.mode !== 'A' || closed() || !sameRows(probeRows(), AMP_ROWS.gap)) return false;
    const meter = bench.model.reading(METER_ID)?.i;
    const row = fed();
    if (meter === undefined || row === null || row < 1e-6) return false;
    return within(size(), AMPS[0], AMPS[1]) && Math.abs(Math.abs(meter) / row - 1) < SAME;
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
  const r5 = (): Vector3 => {
    const m = bench.parts.models.get('R5');
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
    r5: bench.model.reading('R5')?.i ?? null,
    c3: bench.model.reading('C3')?.i ?? null,
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
    spec: { camera: SHOT_NAME, params: { meter: 1 } },
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
          anchor: r5,
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
