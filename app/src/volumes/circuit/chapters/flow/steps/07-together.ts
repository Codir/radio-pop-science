/**
 * `together` — «Рушають усі разом». On entry the switch opens by itself (the lamp goes dark) and three lenses lie
 * down one after another on the loop: near the minus, in the middle of the far wire, by the lamp. In each the
 * electrons only dart. The reader clicks the switch: the common shift starts in all three lenses in the same frame
 * as the lamp lights; open again, it stops in all three at once. Goal: the switch closed for 2 s (clicks allowed).
 * The lenses' names stand for ≈ 3 s once they lie, then on hover.
 */
import { Vector3 } from 'three';
import type { StepFactory } from '../chapter';
import { caption } from '../content';

const NAMES_FOR = 3;
const HOLD = 2;
const UP = new Vector3(0, 0.5, 0);

export const togetherStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { lenses, sw } = stand;
  let since = 0;
  let closedFor = 0;
  const landed = (): boolean => lenses.presence.value > 0.999;
  const named = () => here('together') && landed() && since < NAMES_FOR;
  // after that, each lens's name on hover / long press
  lenses.glasses.forEach((g, i) =>
    ctx.input.register(g === stand.stage.tools.lens.glass ? stand.stage.tools.lens.ring : g, {
      tooltip: caption('together', i),
      cursor: 'default',
      enabled: () => here('together') && landed() && since >= NAMES_FOR,
    }),
  );
  const use = {
    enabled: () => here('together') && landed(),
    click: () => {
      sw.closed = !sw.closed;
    },
  };
  ctx.qa.expose('together', () => ({ closedFor, drifting: [...lenses.drifting], landed: landed() }));
  for (let i = 0; i < 3; i++) ctx.qa.probe(`lens-${i}`, () => lenses.centre(i));
  return {
    spec: { camera: 'stand', params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => reached('together'),
      callouts: [0, 1, 2].map((i) => {
        const v = new Vector3();
        return {
          anchor: () => lenses.centre(i, v).add(UP),
          text: caption('together', i),
          side: 'up',
          visible: named,
        };
      }),
    },
    enter(info) {
      since = 0;
      closedFor = 0;
      sw.closed = false;
      stand.light(false);
      lenses.presence.go(1, info.instant ? 0 : 2.4);
      stand.counter.shown.go(0, info.instant ? 0 : 0.5);
      stand.endOut.go(0, 0);
      stand.swSeat.go(0, 0.6);
      stand.jumperSeat.go(0, 0.5);
      stand.glow.intensity = 0;
      stand.switchUse = use;
    },
    update(dt) {
      if (landed()) since += dt;
      // the circuit is the switch: lamp and the three lenses answer in the same frame
      stand.light(sw.closed);
      const on = sw.closed;
      lenses.drifting = [on, on, on];
      closedFor = on ? closedFor + dt : 0;
      if (closedFor >= HOLD) reach('together');
    },
  };
};
