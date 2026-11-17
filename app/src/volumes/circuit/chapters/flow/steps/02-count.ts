/**
 * `count` — «Скільки за секунду». The counter frame rests on the board right of the near corner; the reader drags
 * it onto the wire (anywhere). Standing still there it counts one second: the number runs from 0 to
 * «1 872 000 000 000 000 000» and stops, the ring round «за 1 с» filling meanwhile. Goal: one full second counted.
 * At the takeaway «0,3 A» stands under the number.
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

export const countStep: StepFactory = ({ stand, reached, reach, here }) => {
  const { counter } = stand;
  const p = new Vector3();
  const below = (): Vector3 =>
    stand.stage.tools.frame.group.getWorldPosition(p).add(new Vector3(0, -0.12, 0));
  return {
    spec: { camera: 'stand', params: { closed: 1, poles: 1 } },
    ui: {
      goal: () => reached('count'),
      callouts: [
        // on a phone the number stands in the interface (the scene's print would be under 14 px)
        {
          anchor: () => stand.counter.anchor(),
          text: () => stand.counter.text,
          side: 'up',
          visible: () => here('count') && stand.counter.phone && stand.counter.text !== '',
          priority: 0,
        },
        {
          anchor: () => stand.stage.tools.frame.group.getWorldPosition(new Vector3()),
          text: caption('count', 0),
          side: 'down',
          visible: () => here('count') && !counter.onWire && counter.shown.value > 0.95,
        },
        {
          anchor: below,
          text: caption('count', 2),
          side: 'down',
          visible: () => here('count') && reached('count') && counter.onWire && counter.progress >= 1,
        },
      ],
    },
    enter(info) {
      stand.endOut.go(0, info.instant ? 0 : 0.5);
      stand.light(true);
      stand.sw.closed = true;
      stand.sw.seat = 0;
      counter.shown.go(1, info.instant ? 0 : 0.6);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.4);
      stand.glow.intensity = 0;
      counter.enabled = () => here('count') || here('same');
      counter.done = null;
    },
    update() {
      if (counter.done) {
        counter.done = null;
        reach('count');
      }
    },
  };
};
