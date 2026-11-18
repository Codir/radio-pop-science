/**
 * `first-light` — «Перше світло». On entry the six ends leave their clamps by themselves and lie down in front of
 * the stand (≈ 2 s, one after another; the lamp goes dark with the first), each with its `cyan` grip. The reader
 * puts ends into clamps (`parts/hands.ts`): any end into any clamp, a clamp takes two, an end comes out the same
 * way. The lamp lights exactly when the pure model says so (`bench.ts`). Goal: the switch controls the lamp (one
 * loop through all three parts, no short), the lamp has shone, and the reader has put it out with the switch once.
 */
import { Vector3 } from 'three';
import { LAMP, boardToWorld } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMBIENT } from '../bench';
import { switchControls } from '../parts/circuit';
import { CLAMPS } from '../parts/clamps';
import { END_KEYS, type EndKey } from '../parts/ends';
import type { HandPolicy } from '../parts/hands';

/** Seconds each end takes to come out and lie down, and the delay from one end to the next. */
const OUT_SECONDS = 1.1;
const OUT_STAGGER = 0.16;
/** On the chapter's first frame the stand is whole and lit; the ends start coming out after this beat. */
const OPEN_BEAT = 1.0;
/** The order the ends come out: left → right along the near side, then the two at the lamp. */
const ORDER: readonly EndKey[] = ['c0', 'a0', 'a1', 'b0', 'b1', 'c1'];

export const firstLightStep: StepFactory = ({ ctx, bench, reached, reach, here }) => {
  const { wiring, sw, stage } = bench;
  let shone = false;
  let plugged = 0;
  /** Ends still to be sent out on entry: [key, seconds until it goes]. */
  let queue: [EndKey, number][] = [];
  const policy: HandPolicy = {
    take: () => here('first-light') && queue.length === 0,
    plug: () => true,
    plugged: () => void plugged++,
  };
  sw.onFlip = () => {
    // the goal: the reader puts out a lamp that the switch really controls
    if (!here('first-light')) return;
    if (!sw.closed && shone && switchControls(wiring.state(true))) reach('first-light');
  };
  const at = (v: Vector3, out = new Vector3()): Vector3 => boardToWorld(v.x, v.y, v.z, out);
  const minusAt = (): Vector3 => at(CLAMPS.minus.mouth).add(new Vector3(0, 0.12, 0));
  const lampAt = (): Vector3 => boardToWorld(LAMP.x - LAMP.glass * 0.8, LAMP.filamentY, LAMP.z);
  const switchAt = (): Vector3 =>
    stage.stand.slider.getWorldPosition(new Vector3()).add(new Vector3(0, 0.18, 0));
  ctx.qa.expose('first-light', () => ({
    verdict: bench.verdict,
    shone,
    plugged,
    flips: sw.flips,
    closed: sw.closed,
    controls: switchControls(wiring.state(true)),
    clamps: Object.fromEntries(END_KEYS.map((k) => [k, wiring.ends[k].seated])),
    queue: queue.length,
  }));
  return {
    spec: {
      camera: 'stand',
      params: { lens: 0, lensCall: 0, window: 0, poles: 1, moon: 1, unfold: 1, charge: 1 },
    },
    ui: {
      goal: () => reached('first-light'),
      callouts: [
        {
          anchor: minusAt,
          text: caption('first-light', 0),
          side: 'down',
          visible: () =>
            here('first-light') && queue.length === 0 && plugged === 0 && wiring.ends.c0.clamp === null,
        },
        {
          anchor: lampAt,
          text: caption('first-light', 2),
          side: 'left',
          visible: () => here('first-light') && queue.length === 0 && plugged === 0,
        },
        {
          anchor: switchAt,
          text: caption('first-light', 1),
          side: 'down',
          visible: () =>
            here('first-light') && queue.length === 0 && plugged > 0 && bench.lit && !reached('first-light'),
        },
      ],
    },
    enter(info) {
      bench.ambient = AMBIENT;
      shone = false;
      plugged = 0;
      sw.closed = true;
      sw.reset();
      wiring.active = true;
      bench.hands.policy = policy;
      bench.switchLive = () => here('first-light') && queue.length === 0;
      for (const k of END_KEYS) {
        wiring.ends[k].contact = true;
        wiring.bare[k].go(1, 0.3);
      }
      wiring.whole.c = true;
      // the chapter opens on the lit stand its neighbour ends on; a beat later the ends come out by themselves
      const opening = info.from === null;
      if (opening) wiring.home(0);
      if (info.instant && !opening) {
        queue = [];
        wiring.loose(0);
        for (const k of END_KEYS) wiring.grips.of[k].shown.set(1);
        return;
      }
      // grips already out (from a later step) stay; the others grow as their ends come out
      if (opening) for (const k of END_KEYS) wiring.grips.of[k].shown.set(0);
      queue = ORDER.map((k, i) => [k, (opening ? OPEN_BEAT : 0) + i * OUT_STAGGER]);
    },
    leave() {
      queue = [];
      for (const k of END_KEYS) wiring.grips.of[k].call = 0;
    },
    update(dt) {
      if (queue.length) {
        for (const q of queue) q[1] -= dt;
        while (queue.length && queue[0]![1] <= 0) {
          const k = queue.shift()![0];
          wiring.lay(k, OUT_SECONDS);
          wiring.grips.of[k].shown.go(1, OUT_SECONDS * 0.6);
        }
      }
      if (bench.lit) shone = true;
      // the loose ends call until the first one is in a clamp; then only a still-loose end calls, quietly
      for (const k of END_KEYS) {
        const loose = wiring.ends[k].clamp === null && !wiring.ends[k].held;
        wiring.grips.of[k].call = queue.length || !loose ? 0 : plugged === 0 ? 1 : 0.4;
      }
    },
  };
};
