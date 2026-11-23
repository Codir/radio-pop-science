/**
 * `resistor-pick/on` — «Лампочка «увімкнено»». The amplifier of the volume on the board as the prologue has it
 * (`AMPLIFIER_PRESET`, not a socket changed), the player's and the speaker's plugs in, the switch closed, the player
 * standing: the LED «on» (LED1, its anode with R1 2,2 kΩ in 5fj, its cathode in the − rail) shines at 3 mA. The
 * multimeter on its place, its dial «вимкнено», the probes at rest — the hand takes only them; the dial has «V» and no
 * «A» (the meter on «A» across two rows of the amplifier can short a part of it). Two callouts name «світлодіод
 * „увімкнено“», its point on LED1's dome, and «резистор 2,2 kΩ», its point on R1's body — each on the side of its part
 * toward the camera, since R1 stands just behind LED1 on the screen and a point over the dome would land on R1. The
 * LED's tag goes to the left of it, on a phone (too narrow there) below it, between the dome and the − rail; R1's to
 * the right. Each goes once its reading has counted, and both step aside while a probe is in the hand (they stand
 * over the sockets the probe is aimed at). Goal: the V mode and two readings, each held 1 s (the probes either way
 * round): 1,745 … 1,755 V across LED1 (5fj and the − rail or a row its jumpers tie to it) and 6,582 … 6,592 V across
 * R1 (the supply's 5ae or 2ae, and 5fj).
 */
import { Vector3 } from 'three';
import type { CalloutSpec } from '@/hud';
import {
  across,
  createTally,
  firstUnder,
  handPolicy,
  kindOf,
  meterReadout,
  meterSwitch,
  onBody,
  rowsOf,
  within,
} from '@electronics/shared/steps';
import { ON, ON_ROWS, WINDOWS } from '../parts/boards';
import { HOLD } from '../parts/goals';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const S = 'on';
type Where = 'led' | 'res';
const KEYS: readonly Where[] = ['led', 'res'];
const LED_ROW = [ON_ROWS.led];

export const onStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const tally = createTally<Where>(KEYS, HOLD.reading);
  const probeRows = () => rowsOf(bench.layout, [bench.multimeter.sockets.red, bench.multimeter.sockets.black]);
  const reading = (): Where | null => {
    if (bench.multimeter.mode !== 'V') return null;
    const rows = probeRows();
    const v = bench.multimeter.value;
    const size = typeof v === 'number' ? Math.abs(v) : null;
    const at: Where | null = across(rows, LED_ROW, ON_ROWS.ground)
      ? 'led'
      : across(rows, ON_ROWS.supply, LED_ROW)
        ? 'res'
        : null;
    return at !== null && within(size, ...WINDOWS.on[at]) ? at : null;
  };
  /** A probe is in the hand: the names step aside, the sockets they stand over are the probe's targets. */
  const aiming = (): boolean => bench.hands.held?.startsWith('probe:') ?? false;
  const visible = (k: Where) => (): boolean => here(S) && !tally.done(k) && !bench.flying && !aiming();
  // the callouts' points (world): on a part's body toward the camera (`onBody`) — on the part on the screen, never over
  // it, where the oblique shot would put the point on whatever stands behind
  const dots = { led: onBody(ctx, bench, 'LED1'), res: onBody(ctx, bench, 'R1') };
  const led: CalloutSpec = {
    anchor: dots.led,
    text: word(8),
    visible: visible('led'),
    // read each time the step comes on screen: a phone has no room left of the LED, so the tag goes below it
    get side() {
      return stand.phone() ? 'down' : 'left';
    },
  };
  // for the checks: the callouts' points (and the part a ray through each meets first, `firstUnder`), and R1's body end
  // to end along its axis (the hit box's local x)
  ctx.qa.probe('on:led', dots.led);
  ctx.qa.probe('on:res', dots.res);
  for (const k of [0, 1] as const) {
    const v = new Vector3();
    ctx.qa.probe(`on:r1-${k}`, () => {
      const m = bench.parts.models.get('R1');
      return m ? m.hit.localToWorld(v.set(k === 0 ? -0.5 : 0.5, 0, 0)) : v.set(0, -100, 0);
    });
  }
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    led: bench.model.reading('LED1')?.i ?? null,
    dots: { led: firstUnder(ctx, bench, dots.led()), res: firstUnder(ctx, bench, dots.res()) },
    counted: [...tally.counted],
    holding: tally.holding,
    reached: reached(S),
  }));
  const name = (id: string): string => {
    const spec = bench.state.parts.get(id)?.spec ?? '';
    const kind = kindOf(spec);
    if (kind === 'resistor') return word(5);
    if (kind === 'led') return word(6);
    return spec === '' ? '' : word(7);
  };

  return {
    spec: { camera: 'meter', params: { meter: 1 } },
    ui: {
      reset: true,
      controls: [meterSwitch(bench, word(0), ['off', 'V'], word(1), 'off'), meterReadout(bench, word(2))],
      callouts: [
        // R1 stands just behind LED1 on the screen: their tags go apart, never one over the other's part
        led,
        { anchor: dots.res, text: word(9), side: 'right', visible: visible('res') },
      ],
      goal: () => reached(S),
    },
    enter() {
      tally.reset();
      stand.board(ON.parts, ON.leads);
      bench.closed = 1;
      bench.tray.set([]);
      bench.multimeter.mode = 'off';
      bench.multimeter.put({ red: null, black: null });
      bench.hands.policy = handPolicy(bench, {
        probes: true,
        name: (w) => (w.probe ? word(w.probe === 'red' ? 3 : 4) : ''),
      });
      stand.naming = { part: name, meter: word(0) };
    },
    late(dt) {
      if (!here(S)) return;
      tally.feed(reading(), dt);
      if (tally.all() && !reached(S)) reach(S);
    },
  };
};
