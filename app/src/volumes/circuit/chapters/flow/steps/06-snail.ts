/**
 * `snail` — «Повільніше за равлика». The prologue's riddle scene, not forked: `stand.crawlScene` (shared/stage
 * README «Crawl») under ONE slider of true time «Час», 0 … 136.4 s; only the words differ — the marked spark is
 * now «позначений електрон». A drag scrubs, a click on the track or a key glides (UI_API §3.3); the lamp is dark at
 * 0 and lit the moment the time leaves 0; the stand's switch is inert (the scene moves it). Goal: the slider at its
 * end (the snail at the end of its lane, the marked electron on «6 мм»), held for a second.
 */
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { clockFrom, holdFor } from '../parts/clock';

const HOLD = 1;
/** A click on the track glides there with this time constant (s), never crossing the range faster than CROSS. */
const GLIDE = 0.5;
const CROSS = 3.5;
/** Arriving with the lamp lit, it dims over this long into the dark of time 0. */
const DIM = 1.4;

export const snailStep: StepFactory = ({ ctx, stand, ui, reached, reach, here }) => {
  const crawl = stand.stage.crawlScene;
  const clock = clockFrom(caption('snail', 2));
  const goal = holdFor(HOLD);
  const time = { target: 0, shown: 0, drag: false, told: -1 };
  let dimFrom = -1;
  let dimT = 0;
  let showing = false;
  const named = (text: string) => ({
    tooltip: text,
    cursor: 'default',
    enabled: () => here('snail') && crawl.ready,
  });
  ctx.input.register(stand.stage.tools.snail.group, named(caption('snail', 7)));
  ctx.input.register(stand.stage.tools.lens.glass, named(caption('snail', 8)));
  ctx.qa.probe('snail', crawl.anchors.snail);
  ctx.qa.expose('snail', () => ({
    seconds: crawl.time,
    ready: crawl.ready,
    snailCm: crawl.snailCm,
    sparkMm: crawl.sparkMm,
  }));
  return {
    spec: { camera: 'crawl', params: { closed: 0, lens: 0, poles: 1 } },
    ui: {
      reset: true,
      goal: () => reached('snail'),
      controls: [
        {
          type: 'slider',
          id: 'snail-time',
          label: caption('snail', 0),
          min: 0,
          max: crawl.duration,
          value: 0,
          step: 0.1,
          format: (v) => clock.format(v),
          marks: [
            { value: 0, label: caption('snail', 1) },
            { value: crawl.duration, label: caption('snail', 2) },
          ],
          disabled: () => !crawl.ready,
          onChange: (v) => (time.target = v),
          onInput: (_v, how) => (time.drag = how === 'drag'),
        },
      ],
    },
    enter(info) {
      time.target = time.shown = 0;
      time.drag = false;
      time.told = -1;
      goal.reset();
      crawl.time = 0;
      // from the water picture the stand comes back first, then the crawl arrives (one motion after the other)
      showing = info.instant;
      if (info.instant) crawl.show(true);
      dimFrom = info.instant || stand.stage.glow < 0.5 ? -1 : stand.stage.glow;
      dimT = 0;
      stand.counter.shown.go(0, info.instant ? 0 : 0.5);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.4);
      stand.glow.intensity = 0;
      stand.endOut.go(0, 0);
      stand.swSeat.go(0, 0.6);
      stand.jumperSeat.go(0, 0.5);
      stand.switchUse = { enabled: () => false };
    },
    leave() {
      crawl.hide(false);
      if (dimFrom > 0) stand.stage.setGlow(null);
      dimFrom = -1;
      stand.sw.closed = true;
    },
    update(dt) {
      if (!showing && stand.waterMorph.value < 0.15) {
        crawl.show(false);
        showing = true;
      }
      const gap = time.target - time.shown;
      const step = time.drag ? gap : gap * (1 - Math.exp(-dt / GLIDE));
      const most = (crawl.duration / CROSS) * dt;
      time.shown += time.drag ? gap : Math.max(-most, Math.min(most, step));
      if (Math.abs(time.shown - time.target) < 0.05) time.shown = time.target;
      // the lamp shines the moment the time leaves zero — the thumb's target counts, no waiting for the glide
      crawl.time = time.target > 0 && time.shown === 0 ? Math.min(time.target, 0.05) : time.shown;
      // the slider of the stand's switch goes with the lamp (the crawl's own rule)
      stand.sw.closed = crawl.time > 0;
      if (dimFrom > 0) {
        dimT += dt;
        const k = Math.min(dimT / DIM, 1);
        if (crawl.time > 0 || k >= 1) {
          stand.stage.setGlow(null);
          dimFrom = -1;
        } else stand.stage.setGlow(dimFrom * (1 - k * k * (3 - 2 * k)));
      }
      if (Math.abs(time.shown - time.told) > 0.02)
        ui.patch('snail-time', { current: (time.told = time.shown) });
      if (goal.update(crawl.ready && crawl.time >= crawl.duration - 1e-3, dt)) reach('snail');
    },
  };
};
