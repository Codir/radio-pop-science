/**
 * `pump` — «Труба з насосом». On entry the stand turns by itself, in one smooth motion (≈ 2 s), into the water
 * picture on the same places: the wires into glass pipes full of water, the battery into a pump, the lamp into a
 * narrow place with a little wheel, the switch into a tap; the counter frame leaves. Bubbles ride round from the
 * pump. The reader shuts the tap and opens it again: the water and the wheel stop in the whole pipe in the same
 * frame, and start again. Goal: shut and opened again once. Names for ≈ 3 s on entry, then on hover. Leaving,
 * the picture turns back into the stand by the same motion.
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

const MORPH = 2;
const NAMES_FOR = 3;
const LIFT = new Vector3(0, 0.45, 0);

export const pumpStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { water, waterMorph } = stand;
  let since = 0;
  let shut = false;
  const ready = (): boolean => here('pump') && waterMorph.value > 0.999;
  const at =
    (o: { getWorldPosition(v: Vector3): Vector3 }, v = new Vector3()) =>
    () =>
      o.getWorldPosition(v).add(LIFT);
  const named = (): boolean => ready() && since < NAMES_FOR;
  const names: [keyof typeof water.anchors, number][] = [
    ['pump', 0],
    ['tap', 1],
    ['wheel', 2],
  ];
  ctx.input.register(water.anchors.pump, {
    tooltip: caption('pump', 0),
    cursor: 'default',
    enabled: () => ready(),
  });
  ctx.input.register(water.anchors.wheel, {
    tooltip: caption('pump', 2),
    cursor: 'default',
    enabled: () => ready(),
  });
  // the tap answers like the switch: a generous hit volume, the handle lifts under the pointer and dips when pressed
  ctx.input.register(water.tapHit, {
    tooltip: caption('pump', 1),
    cursor: 'pointer',
    enabled: () => ready(),
    hover: (over) => (water.hover = over),
    press: () => (water.press = true),
    release: () => (water.press = false),
    click: () => {
      water.press = false;
      water.open = !water.open;
      if (!water.open) shut = true;
      else if (shut) reach('pump');
    },
  });
  ctx.qa.probe('tap', water.anchors.tap);
  ctx.qa.expose('pump', () => ({ morph: waterMorph.value, open: water.open, flowing: water.flowing, shut }));
  return {
    spec: { camera: 'stand', params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => reached('pump'),
      callouts: names.map(([key, i]) => ({
        anchor: at(water.anchors[key]),
        text: caption('pump', i),
        side: 'up' as const,
        visible: named,
      })),
    },
    enter(info) {
      since = 0;
      shut = false;
      water.open = true;
      waterMorph.go(1, info.instant ? 0 : MORPH);
      stand.light(false);
      stand.counter.shown.go(0, info.instant ? 0 : 0.5);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.2);
      stand.glow.intensity = 0;
      stand.endOut.go(0, 0);
      stand.swSeat.go(0, info.instant ? 0 : 0.6);
      stand.jumperSeat.go(0, info.instant ? 0 : 0.5);
      stand.sw.closed = true;
      stand.switchUse = { enabled: () => false };
    },
    leave() {
      water.hover = water.press = false;
      // back to the stand a little quicker than it came (the next step's own motion follows)
      waterMorph.go(0, MORPH * 0.7);
      water.open = true;
    },
    update(dt) {
      if (ready()) since += dt;
    },
  };
};
