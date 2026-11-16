/**
 * `riddle` — «Загадка равлика» on the crawl (DECISIONS §60 q–t; script step 3; C-circuit-1 §29–32): ONE slider of
 * true time, «Час», 0 … 136.4 s. Its position is the moment of the scene (`stand.crawlScene.time`): at 0 the lamp
 * is dark; above 0 it shines in the same frame; the snail creeps along its lane beside the wire at 1 mm/s and the
 * marked spark in the magnifier at the wire's start advances along the millimetre scale — 13.6 cm against 6 mm at
 * the end. A drag scrubs, a click on the track or a key glides (UI_API §3.3); the stand's switch is inert here.
 * Goal: the slider at its end, held for a second. No button, no clock, no question to the reader.
 */
import type { ChapterContext, StepInfo } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { CircuitWorld } from '@circuit/shared/world';
import { clockFrom, holdFor } from './clock';

/** Seconds at the end before the takeaway (script: «щонайменше 1 s»). */
const HOLD = 1;
/** A click on the track glides there: the shown time follows the target with this time constant (seconds)… */
const GLIDE = 0.5;
/** …and never crosses the whole range faster than this (seconds). */
const CROSS = 3.5;
/** Arriving from `dive` the lamp was lit: it dims over this long into the dark of time 0 (C-circuit-1 §32). */
const DIM = 1.4;

export interface RiddleStep {
  spec: StepUiSpec;
  /** The lens's name while this step is on (the lens itself is registered once, by `dive`). */
  lensName: { text: string; when: () => boolean };
  enter(info: StepInfo): void;
  update(dt: number): void;
  state(): {
    seconds: number;
    target: number;
    snailCm: number;
    sparkMm: number;
    ready: boolean;
    lampOn: boolean;
  };
}

export function riddleStep(
  ctx: ChapterContext,
  world: CircuitWorld,
  ui: StepUiApi,
  labels: readonly string[],
): RiddleStep {
  const [timeLabel = '', zeroMark = '', endMark = '', , , , , snailName = '', sparkName = ''] = labels;
  const crawl = world.stand.crawlScene;
  const clock = clockFrom(endMark);
  const goal = holdFor(HOLD);
  const time = { target: 0, shown: 0, drag: false, told: -1 };
  let reached = false;
  let showing = false;
  /** The lamp's glow when the dimming began (−1 = no dimming). */
  let dimFrom = -1;
  let dimT = 0;
  const active = (): boolean => ctx.stage.current === 'riddle';
  const onStand = (): boolean => !world.flying && world.deep < 0.01;

  // the names on hover / long press (captions 7–8): the snail, and the marked spark in the magnifier
  const named = (text: string) => ({
    tooltip: text,
    cursor: 'default',
    enabled: () => active() && crawl.ready,
  });
  ctx.input.register(world.stand.tools.snail.group, named(snailName));
  ctx.qa.probe('snail', crawl.anchors.snail);
  ctx.qa.probe('lens-start', crawl.anchors.lens);
  ctx.qa.probe('spark-mark', crawl.anchors.mark);

  const spec: StepUiSpec = {
    reset: true,
    controls: [
      {
        type: 'slider',
        id: 'riddle-time',
        label: timeLabel,
        min: 0,
        max: crawl.duration,
        value: 0,
        step: 0.1,
        format: (v) => clock.format(v),
        marks: [
          { value: 0, label: zeroMark },
          { value: crawl.duration, label: endMark },
        ],
        // the slider wakes when the scene is in place (the snail at its start, the magnifier on the wire)
        disabled: () => !crawl.ready,
        onChange: (v) => (time.target = v),
        onInput: (_v, how) => (time.drag = how === 'drag'),
      },
    ],
    goal: () => reached,
  };
  return {
    spec,
    lensName: { text: sparkName, when: () => active() && crawl.ready },
    enter(info) {
      time.target = time.shown = 0;
      time.drag = false;
      time.told = -1;
      reached = false;
      goal.reset();
      crawl.time = 0;
      showing = false;
      // from `dive` the lamp was lit: it will dim into the dark of time 0 instead of snapping off
      dimFrom = info.instant ? -1 : world.stand.glow;
      dimT = 0;
      if (info.instant) {
        crawl.show(true);
        showing = true;
      }
    },
    update(dt) {
      if (!active()) {
        if (dimFrom > 0) world.stand.setGlow(null);
        dimFrom = -1;
        return;
      }
      // arriving by the flight up from «ряди», the scene comes once the reader is back on the stand
      if (!showing && onStand()) {
        crawl.show(false);
        showing = true;
      }
      // a drag: the moment is the thumb's; a click or a key: glide there, eased out, never faster than the whole
      // range in `CROSS` seconds (the snail visibly crawls rather than jumps)
      const gap = time.target - time.shown;
      const step = time.drag ? gap : gap * (1 - Math.exp(-dt / GLIDE));
      const most = (crawl.duration / CROSS) * dt;
      time.shown += time.drag ? gap : Math.max(-most, Math.min(most, step));
      if (Math.abs(time.shown - time.target) < 0.05) time.shown = time.target;
      // the lamp shines the moment the time leaves zero — the thumb's target counts, no waiting for the glide
      crawl.time = time.target > 0 && time.shown === 0 ? Math.min(time.target, 0.05) : time.shown;
      // the calm dimming on arrival: the filament's own glow by hand, until it is dark or the time moves
      if (dimFrom > 0) {
        dimT += dt;
        const k = Math.min(dimT / DIM, 1);
        if (crawl.time > 0 || k >= 1) {
          world.stand.setGlow(null);
          dimFrom = -1;
        } else world.stand.setGlow(dimFrom * (1 - k * k * (3 - 2 * k)));
      }
      if (Math.abs(time.shown - time.told) > 0.02)
        ui.patch('riddle-time', { current: (time.told = time.shown) });
      if (goal.update(crawl.ready && crawl.time >= crawl.duration - 1e-3, dt)) reached = true;
    },
    state: () => ({
      seconds: crawl.time,
      target: time.target,
      snailCm: crawl.snailCm,
      sparkMm: crawl.sparkMm,
      ready: crawl.ready,
      lampOn: world.stand.glow > 0.5,
    }),
  };
}
