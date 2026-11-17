/**
 * Showcase of `@circuit/shared/stage`: one step per state or beat, so that contact sheets show the whole
 * table floor. A dev chapter is the one place that may reach into a published volume's shared library.
 */
import { defineScene } from '@/engine/api';
import {
  HANDOVER,
  STAGE_FOV,
  STAGE_POST,
  STAGE_SHOTS,
  UNFOLD_PLAY,
  UNFOLD_SECONDS,
  mountStage,
} from '@circuit/shared/stage';

export default defineScene((ctx) => {
  const { stage, camera } = ctx;
  // `?globe=0.5` builds the stand with another lamp size (the side-by-side for the owner, punch list A4)
  const globe = Number(new URLSearchParams(globalThis.location?.search ?? '').get('globe'));
  const stand = mountStage(ctx, globe > 0 ? { globe } : {});
  // `?amb=0` shows the first, darker look of the unlit room (before / after pairs for the owner)
  const amb = new URLSearchParams(globalThis.location?.search ?? '').get('amb');
  if (amb !== null) stand.ambient = Number(amb);
  const lampAt = STAGE_SHOTS.lamp.target;
  const mid = HANDOVER.spot.clone().addScaledVector(HANDOVER.direction, -1.9);
  camera.shots({
    ...STAGE_SHOTS,
    near: {
      position: [-0.3, 4.9, 7.6],
      target: [-0.2, 1.05, 1.5],
      fov: STAGE_FOV,
      fit: { center: [0, 1, 1.4], radius: 2.6 },
    },
    // the lamp from steeply above: the board and the table behind the globe (its edge on a light ground)
    lampTop: {
      position: [lampAt[0] + 1.3, lampAt[1] + 4.4, lampAt[2] + 2.1],
      target: lampAt,
      fov: STAGE_FOV,
      fit: { center: lampAt, radius: 1.3 },
    },
    diveMid: {
      position: [mid.x, mid.y, mid.z],
      target: [HANDOVER.spot.x, HANDOVER.spot.y, HANDOVER.spot.z],
      fov: STAGE_FOV,
      near: 0.02,
      drift: 0,
    },
  });
  stage.param('closed', 0, { duration: 0.01, onChange: (v) => (stand.closed = v) });
  stage.param('unfold', 1, { duration: 3, ease: 'linear', onChange: (v) => (stand.unfold = v) });
  stage.param('moon', 1, { duration: 0.8, onChange: (v) => (stand.moon = v) });
  stage.param('charge', 1, { duration: 2.5, ease: 'linear', onChange: (v) => (stand.charge = v) });
  stage.param('glow', -1, { duration: 0.01, onChange: (v) => stand.setGlow(v < 0 ? null : v) });
  stage.param('gauge', 0, { duration: 0.6, onChange: (v) => (stand.tools.gauge.shown = v) });
  stage.param('frame', 0, { duration: 0.4, onChange: (v) => (stand.tools.frame.shown = v) });
  stage.param('lensCall', 0, { duration: 0.4, onChange: (v) => (stand.lensCall = v) });
  stage.param('poles', 0, { duration: 0.8, onChange: (v) => (stand.poles = v) });
  stage.param('lens', 0, { duration: 1.1, onChange: (v) => (stand.lens = v) });
  stage.param('dive', 0, { duration: 1.8, onChange: (v) => (stand.dive = v) });
  stand.tools.frame.setOnLoop(0.8);
  stand.tools.frame.setNumber('12');
  const beat = (seconds: number): number => seconds / UNFOLD_SECONDS;
  stage.define({
    'torch-off': { params: { closed: 0, unfold: 0, moon: 0 }, camera: 'flashlight' },
    'torch-on': { params: { closed: 1, unfold: 0, moon: 0 }, camera: 'flashlight' },
    play: { params: { closed: 1, moon: 1, unfold: 0 }, camera: 'flashlight' },
    'unfold-1': { params: { closed: 1, unfold: beat(0.7), moon: 0.3 }, camera: 'flashlight' },
    'unfold-2': { params: { closed: 1, unfold: beat(1.35), moon: 0.5 }, camera: 'flashlight' },
    'unfold-3': { params: { closed: 1, unfold: beat(2.3), moon: 0.7 }, camera: 'stand' },
    'unfold-4': { params: { closed: 1, unfold: beat(3.3), moon: 0.8 }, camera: 'stand' },
    'unfold-5': { params: { closed: 1, unfold: beat(4.5) }, camera: 'stand' },
    'unfold-6': { params: { closed: 1, unfold: beat(5.5) }, camera: 'stand' },
    'stand-on': { params: { closed: 1 }, camera: 'stand' },
    'stand-off': { params: { closed: 0 }, camera: 'stand' },
    'lens-call': { params: { closed: 0, lensCall: 1 }, camera: 'stand' },
    poles: { params: { closed: 1, poles: 1 }, camera: 'stand' },
    lamp: { params: { closed: 1 }, camera: 'lamp', post: STAGE_POST.lamp },
    'lamp-off': { params: { closed: 0 }, camera: 'lamp', post: STAGE_POST.lamp },
    'lamp-top': { params: { closed: 1 }, camera: 'lampTop', post: STAGE_POST.lamp },
    'lamp-top-off': { params: { closed: 0 }, camera: 'lampTop', post: STAGE_POST.lamp },
    'lamp-warming': { params: { closed: 1, glow: 0.42 }, camera: 'lamp', post: STAGE_POST.lamp },
    'battery-tired': { params: { closed: 1, charge: 0.22 }, camera: 'stand' },
    'battery-dead': { params: { closed: 1, charge: 0 }, camera: 'stand' },
    gauge: { params: { closed: 1, gauge: 1 }, camera: 'stand' },
    frame: { params: { closed: 1, frame: 1 }, camera: 'stand' },
    lens: { params: { closed: 1, lens: 1 }, camera: 'stand' },
    'lens-close': { params: { closed: 1, lens: 1 }, camera: 'lens' },
    dive: { params: { closed: 1, lens: 1, dive: 0.6 }, camera: 'diveMid' },
    handover: { params: { closed: 1, lens: 1, dive: 1 }, camera: 'handover' },
    'handover-off': { params: { closed: 0, lens: 1, dive: 1 }, camera: 'handover' },
  });
  return {
    enterStep(id, info) {
      if (info.instant) stand.snap();
      // `play`: the unfolding as one move with the recommended camera (flashlight → stand at beat 3)
      if (id === 'play' && !info.instant) {
        stand.unfold = 0;
        stand.playUnfold();
        info.scope.delay(UNFOLD_PLAY.seconds * UNFOLD_PLAY.cameraAt, () =>
          camera.go('stand', { duration: UNFOLD_PLAY.cameraSeconds }),
        );
      }
    },
    update(dt, t) {
      // the gauge reads what the battery gives: 1.5 V fresh, sagging with the charge and under load
      stand.tools.gauge.value = 0.95 + 0.6 * stand.charge - 0.03 * stand.closed;
      stand.update(dt, t);
    },
  };
});
