/**
 * Showcase of `@circuit/shared/stage`: one step per state or beat, so that contact sheets show the whole
 * table floor. A dev chapter is the one place that may reach into a published volume's shared library.
 */
import { defineScene } from '@/engine/api';
import { Mesh, SphereGeometry } from 'three';
import { stepUi } from '@/hud';
import { K } from '@/style';
import {
  HANDOVER,
  LAMP_SHOTS,
  STAGE_FOV,
  STAGE_POST,
  STAGE_SHOTS,
  UNFOLD_PLAY,
  UNFOLD_SECONDS,
  filamentAfterClick,
  formatTemperature,
  heatOfCurrent,
  lampLensPose,
  mountStage,
  BATTERY_SHOTS,
} from '@circuit/shared/stage';
import { batterySteps } from './battery-steps';

export default defineScene((ctx) => {
  const { stage, camera } = ctx;
  const ui = stepUi(ctx);
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
    ...LAMP_SHOTS,
    ...BATTERY_SHOTS,
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
  stage.param('closed', 0, { duration: 0.01, onChange: (v: number) => (stand.closed = v) });
  stage.param('unfold', 1, { duration: 3, ease: 'linear', onChange: (v: number) => (stand.unfold = v) });
  stage.param('moon', 1, { duration: 0.8, onChange: (v: number) => (stand.moon = v) });
  stage.param('charge', 1, { duration: 2.5, ease: 'linear', onChange: (v: number) => (stand.charge = v) });
  let glowParam = -1;
  stage.param('glow', -1, {
    duration: 0.01,
    onChange: (v: number) => {
      glowParam = v;
      stand.setGlow(v < 0 ? null : v);
    },
  });
  stage.param('gauge', 0, { duration: 0.6, onChange: (v: number) => (stand.tools.gauge.shown = v) });
  stage.param('frame', 0, { duration: 0.4, onChange: (v: number) => (stand.tools.frame.shown = v) });
  stage.param('lensCall', 0, { duration: 0.4, onChange: (v: number) => (stand.lensCall = v) });
  stage.param('poles', 0, { duration: 0.8, onChange: (v: number) => (stand.poles = v) });
  stage.param('lens', 0, { duration: 1.1, onChange: (v: number) => (stand.lens = v) });
  stage.param('dive', 0, { duration: 1.8, onChange: (v: number) => (stand.dive = v) });
  // `?hide=a,b` hides objects of the scene by name (finding what a stray shape in a frame is)
  const hide = new URLSearchParams(globalThis.location?.search ?? '').get('hide');
  for (const name of hide ? hide.split(',') : [])
    ctx.root.traverse((o) => void (o.name === name && (o.visible = false)));
  ctx.qa.expose('lamp', () => {
    const disc = stand.tools.lens.glass.getObjectByName('thermal:ground');
    let twins = 0;
    let shown = 0;
    stand.stand.group.traverse((o) => {
      if (o.name.startsWith('thermal:')) {
        twins++;
        if (o.visible) shown++;
      }
    });
    const { heat, celsius, detailShown, cut, thermal } = stand.lamp;
    return { heat, celsius, detailShown, cut, thermal, disc: disc?.visible ?? null, twins, shown };
  });
  // `lamp-inside` / `lamp-cut`: a marker runs the current's way through the lamp (stand.lamp.path), 4 s a lap
  const marker = new Mesh(new SphereGeometry(0.03, 16, 12), K.glow({ color: 'cyan', intensity: 1.6 }));
  marker.name = 'sandbox:path-marker';
  marker.visible = false;
  ctx.root.add(marker);
  let lensLamp = 0;
  // the lamp close up (K-lamp-filament): detail −1 = automatic by the camera's distance
  stage.param('detail', -1, {
    duration: 0.01,
    onChange: (v: number) => (stand.lamp.detail = v < 0 ? null : v),
  });
  stage.param('cut', 0, { duration: 1.2, onChange: (v: number) => (stand.lamp.cut = v) });
  stage.param('thermal', 0, { duration: 0.8, onChange: (v: number) => (stand.lamp.thermal = v) });
  stage.param('lensLamp', 0, { duration: 1.1, onChange: (v: number) => (lensLamp = v) });
  const overLamp = lampLensPose(1.45, STAGE_SHOTS.lamp.position, 1.15);
  /** `lamp-glow`: milliseconds after the click (the slider), `lamp-dim`: the current in amperes. */
  const lab = { ms: 30, amps: 0.18 };
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
    'lamp-inside': { params: { closed: 1 }, camera: 'lampInside', post: STAGE_POST.lamp },
    'lamp-cut': { params: { closed: 1, cut: 1 }, camera: 'lampBase', post: STAGE_POST.lamp },
    'lamp-coil': { params: { closed: 1 }, camera: 'lampCoil', post: STAGE_POST.lamp },
    'lamp-coil-off': { params: { closed: 0 }, camera: 'lampCoil', post: STAGE_POST.lamp },
    'lamp-glow': { params: { closed: 1, glow: 0.5 }, camera: 'lampCoil', post: STAGE_POST.lamp },
    'lamp-dim': { params: { closed: 1, glow: 0.6 }, camera: 'lampInside', post: STAGE_POST.lamp },
    'lamp-thermal': { params: { closed: 1, lensLamp: 1, thermal: 1 }, camera: 'lamp', post: STAGE_POST.lamp },
    'battery-tired': { params: { closed: 1, charge: 0.22 }, camera: 'stand' },
    'battery-dead': { params: { closed: 1, charge: 0 }, camera: 'stand' },
    gauge: { params: { closed: 1, gauge: 1 }, camera: 'stand' },
    frame: { params: { closed: 1, frame: 1 }, camera: 'stand' },
    lens: { params: { closed: 1, lens: 1 }, camera: 'stand' },
    'lens-close': { params: { closed: 1, lens: 1 }, camera: 'lens' },
    dive: { params: { closed: 1, lens: 1, dive: 0.6 }, camera: 'diveMid' },
    handover: { params: { closed: 1, lens: 1, dive: 1 }, camera: 'handover' },
    'handover-off': { params: { closed: 0, lens: 1, dive: 1 }, camera: 'handover' },
    'battery-cut': { params: { closed: 1 }, camera: 'battery', post: STAGE_POST.lamp },
    'battery-cut-stand': { params: { closed: 1 }, camera: 'stand' },
    'battery-dead-cut': { params: { closed: 1, charge: 0 }, camera: 'battery', post: STAGE_POST.lamp },
    'battery-minus': { params: { closed: 0 }, camera: 'batteryMinus', post: STAGE_POST.lamp },
    'battery-plus': { params: { closed: 0 }, camera: 'batteryPlus', post: STAGE_POST.lamp },
    'battery-voltage': { params: { closed: 0, gauge: 1 }, camera: 'voltage' },
  });
  const ms = (v: number): string => `${Math.round(v)}\u00a0мс`;
  ui.define({
    'lamp-inside': {
      controls: [
        {
          type: 'slider',
          id: 'cutS',
          label: 'Розріз цоколя',
          min: 0,
          max: 1,
          value: 0,
          onChange: (v: number) => (stand.lamp.cut = v),
        },
        {
          type: 'slider',
          id: 'heatS',
          label: 'Жар нитки',
          min: 0,
          max: 1,
          value: 1,
          onChange: (v: number) => stand.setGlow(v),
        },
        { type: 'readout', id: 'tempR', label: 'Нитка', text: () => formatTemperature(stand.lamp.celsius) },
      ],
    },
    'lamp-glow': {
      controls: [
        {
          type: 'slider',
          id: 'msS',
          label: 'Після клацання',
          min: 0,
          max: 120,
          value: lab.ms,
          format: ms,
          onChange: (v: number) => (lab.ms = v),
        },
        { type: 'readout', id: 'glowR', label: 'Нитка', text: () => formatTemperature(stand.lamp.celsius) },
      ],
    },
    'lamp-dim': {
      controls: [
        {
          type: 'slider',
          id: 'ampS',
          label: 'Струм',
          min: 0,
          max: 0.3,
          value: lab.amps,
          unit: 'A',
          digits: 2,
          onChange: (v: number) => (lab.amps = v),
        },
        { type: 'readout', id: 'dimR', label: 'Нитка', text: () => formatTemperature(stand.lamp.celsius) },
      ],
    },
    'lamp-thermal': {
      controls: [
        {
          type: 'slider',
          id: 'thermS',
          label: 'Теплова лупа',
          min: 0,
          max: 1,
          value: 1,
          onChange: (v: number) => (stand.lamp.thermal = v),
        },
        {
          type: 'slider',
          id: 'heatT',
          label: 'Жар нитки',
          min: 0,
          max: 1,
          value: 1,
          onChange: (v: number) => stand.setGlow(v),
        },
      ],
    },
  });
  const battery = batterySteps(ctx, stand);
  return {
    enterStep(id, info) {
      battery.enterStep(id, info);
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
      const current = stage.current;
      if (current === 'lamp-glow') stand.setGlow(filamentAfterClick(lab.ms / 1000).heat);
      else if (current === 'lamp-dim') stand.setGlow(heatOfCurrent(lab.amps));
      else if (current !== 'lamp-inside' && current !== 'lamp-thermal' && glowParam < 0) stand.setGlow(null);
      battery.update(dt);
      stand.update(dt, t);
      marker.visible = current === 'lamp-inside' || current === 'lamp-cut';
      if (marker.visible) stand.lamp.path.at((t / 4) % 1, marker.position);
      if (lensLamp > 0) stand.tools.lens.setPose(stand.tools.poses.holder, overLamp, lensLamp);
    },
  };
});
