/**
 * `same` — «Скільки ввійшло, стільки вийшло». The frame slides along the wire like a bead (over the switch, the
 * lamp's socket and the second seat it lifts; into the battery it never goes); wherever it stops it counts a new
 * second, and the number is always the same. Goal: a full second in each of the four stretches — from the minus,
 * before the lamp, after it, near the plus (any order). The stretch's name stands at the frame before and after
 * the lamp.
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import type { Zone } from '../parts/loop-track';

const ZONES: readonly Zone[] = ['minus', 'before', 'after', 'plus'];

export const sameStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { counter } = stand;
  const counted = new Set<Zone>();
  const at = (): Vector3 => stand.stage.tools.frame.group.getWorldPosition(new Vector3());
  const named = (z: Zone) => () => here('same') && counter.onWire && counter.zone === z;
  ctx.qa.expose('same', () => ({
    counted: [...counted],
    zone: counter.zone,
    u: counter.u,
    progress: counter.progress,
  }));
  return {
    spec: { camera: 'stand', params: { closed: 1, poles: 1 } },
    ui: {
      goal: () => reached('same'),
      callouts: [
        // on a phone the number stands in the interface (the scene's print would be under 14 px)
        {
          anchor: () => stand.counter.anchor(),
          text: () => stand.counter.text,
          side: 'up',
          visible: () => here('same') && stand.counter.phone && stand.counter.text !== '',
          priority: 0,
        },
        { anchor: at, text: caption('same', 0), side: 'down', visible: named('before') },
        { anchor: at, text: caption('same', 1), side: 'down', visible: named('after') },
      ],
    },
    enter(info) {
      counted.clear();
      stand.endOut.go(0, info.instant ? 0 : 0.5);
      stand.light(true);
      stand.sw.closed = true;
      stand.sw.seat = 0;
      counter.shown.go(1, info.instant ? 0 : 0.6);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.4);
      stand.glow.intensity = 0;
      counter.enabled = () => here('count') || here('same');
      counter.done = null;
      // arriving without the frame on the wire (a deep link): it stands where `count` would have left it
      if (!counter.onWire) counter.slideTo(0.62, info.instant ? 0 : 0.8);
    },
    update() {
      if (counter.done) {
        counted.add(counter.done);
        counter.done = null;
      }
      if (ZONES.every((z) => counted.has(z))) reach('same');
    },
  };
};
