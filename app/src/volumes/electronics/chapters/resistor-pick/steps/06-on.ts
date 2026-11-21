/**
 * `resistor-pick/on` — «Лампочка «увімкнено»». The amplifier of the volume on the board as the prologue has it
 * (`AMPLIFIER_PRESET`, not a socket changed), the player's and the speaker's plugs in, the switch closed, the player
 * standing: the LED «on» (LED1, its anode with R1 2,2 kΩ in 5fj, its cathode in the − rail) shines at 3 mA. The
 * multimeter on its place, its dial «вимкнено», the probes at rest — the hand takes only them; the dial has «V» and no
 * «A» (the meter on «A» across two rows of the amplifier can short a part of it). Two callouts name «світлодіод
 * „увімкнено“» over LED1 and «резистор 2,2 kΩ» over R1; each goes once its reading has counted, and both step aside
 * while a probe is in the hand (they stand over the sockets the probe is aimed at). Goal: the V mode and two readings,
 * each held 1 s (the probes either way round): 1,745 … 1,755 V across LED1 (5fj and the − rail or a row its jumpers tie
 * to it) and 6,582 … 6,592 V across R1 (the supply's 5ae or 2ae, and 5fj).
 */
import { Box3, Vector3 } from 'three';
import { ON, ON_ROWS, WINDOWS } from '../parts/boards';
import { HOLD, across, createTally, rowsOf, within } from '../parts/goals';
import { meterReadout, meterSwitch } from '../parts/meter';
import { kindOf, handPolicy } from '../parts/policy';
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
  // the callouts' points (world): over a part's body
  const box = new Box3();
  const over = (id: string) => {
    const v = new Vector3();
    return (): Vector3 => {
      const m = bench.parts.models.get(id);
      if (!m) return v.set(0, -100, 0);
      box.setFromObject(m.hit);
      return box.getCenter(v).setY(box.max.y + 0.05);
    };
  };
  /** A probe is in the hand: the names step aside, the sockets they stand over are the probe's targets. */
  const aiming = (): boolean => bench.hands.held?.startsWith('probe:') ?? false;
  const visible = (k: Where) => (): boolean => here(S) && !tally.done(k) && !bench.flying && !aiming();
  ctx.qa.expose(S, () => ({
    mode: bench.multimeter.mode,
    rows: probeRows(),
    value: bench.multimeter.value,
    text: bench.multimeter.text,
    led: bench.model.reading('LED1')?.i ?? null,
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
        // R1 stands just behind LED1 on the screen: their tags go to either side, never one over the other's point
        { anchor: over('LED1'), text: word(8), side: 'left', visible: visible('led') },
        { anchor: over('R1'), text: word(9), side: 'right', visible: visible('res') },
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
