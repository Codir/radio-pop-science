/**
 * Showcase of the crawl (DECISIONS §60 r–t, `@circuit/shared/stage` README «Crawl»): one scrub slider of TRUE
 * time drives the whole frame, both ways, through `stand.crawlScene` — exactly what a chapter does.
 *   stand — the stand as the neighbouring steps leave and find it: the scene arrives from it and leaves to it;
 *   crawl — `time = 0`: lamp off; above 0: lamp on at once; the snail creeps along the wire (1 mm/s) from the
 *           battery's minus toward the lamp and reaches the end of its lane at the slider's end, while the
 *           marked spark in the magnifier reaches the last tick of its scale (0.044 mm/s).
 */
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { CRAWL_SPEED, STAGE_SHOTS, crawlPath, mountStage } from '@circuit/shared/stage';

/** True time in words: «45 с», «2 хв 16 с». */
function fmtTime(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m ? `${m} хв ${s % 60} с` : `${s} с`;
}

export default defineScene((ctx) => {
  const stand = mountStage(ctx);
  const scene = stand.crawlScene;
  const ui = stepUi(ctx);
  ctx.camera.shots(STAGE_SHOTS);
  ctx.stage.param('closed', 0, { duration: 0.01, onChange: (v) => (stand.closed = v) });
  ctx.stage.define({
    stand: { camera: 'stand', params: { closed: 1 } },
    // the scene switches the lamp by its time; the step's own `closed` only says what the entry looks like
    crawl: { camera: 'crawl', params: { closed: 0 } },
  });

  // UI_API §3.3: the thumb is the target; a drag is followed frame by frame, a click on the track or a key glides
  // there; the track's fill shows where the scene is (`current`)
  const time = { target: 0, shown: 0, drag: false, told: -1 };
  ui.define({
    crawl: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'crawl-time',
          label: 'Час',
          min: 0,
          max: scene.duration,
          value: 0,
          step: 0.1,
          format: fmtTime,
          marks: [
            { value: 0, label: '0 с' },
            { value: scene.duration, label: fmtTime(scene.duration) },
          ],
          onChange: (v) => (time.target = v),
          onInput: (_v, how) => (time.drag = how === 'drag'),
        },
      ],
      goal: () => scene.time >= scene.duration - 0.05,
    },
  });

  // the scene's caption anchors, for the QA script (`app.locate('anchor:snail')` …)
  for (const [name, anchor] of Object.entries(scene.anchors)) ctx.qa.probe(`anchor:${name}`, anchor);
  ctx.qa.expose('crawl', () => ({
    seconds: scene.time,
    duration: scene.duration,
    snailCm: scene.snailCm,
    lengthCm: scene.lengthCm,
    sparkMm: scene.sparkMm,
    scaleMm: scene.scaleMm,
    speeds: CRAWL_SPEED,
    wireCm: crawlPath().reduce((sum, p, i, all) => (i ? sum + p.distanceTo(all[i - 1]!) : 0), 0) / 0.38,
    magnification: stand.tools.loupe.magnification * (stand.tools.poses.overStart.scale ?? 1),
    glow: stand.glow,
    light: stand.light.lamp.intensity,
    presence: scene.presence,
    ready: scene.ready,
  }));
  return {
    enterStep(id, info) {
      if (id === 'crawl') {
        // the scene starts at time 0 with the lamp off and arrives as one motion
        time.target = time.shown = 0;
        time.drag = false;
        time.told = -1;
        scene.time = 0;
        scene.show(info.instant);
      } else {
        // leaving, the scene keeps its time: the snail goes from where it is, the lamp is the next step's
        scene.hide(info.instant);
      }
      if (info.instant) stand.snap();
    },
    update(dt, t) {
      if (ctx.stage.current === 'crawl') {
        time.shown = time.drag
          ? time.target
          : time.shown + (time.target - time.shown) * (1 - Math.exp(-dt / 0.25));
        if (Math.abs(time.shown - time.target) < 0.02) time.shown = time.target;
        // all a chapter does: the lamp, the switch, the snail, the lens and its scale follow this one number
        scene.time = time.shown;
        if (Math.abs(time.shown - time.told) > 0.02)
          ui.patch('crawl-time', { current: (time.told = time.shown) });
      }
      stand.update(dt, t);
    },
  };
});
