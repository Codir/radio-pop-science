/**
 * `lamp/glow` — «Жар, що світить». The coil fills the frame (`lampCoil`). ONE slider «Розжарення» is the moment after
 * the click, 0 … 0,1 s (DECISIONS §60 p): the switch closes the moment it leaves 0 and opens at 0, the coil's heat is
 * `filamentAfterClick(time)` (the lamp's own model: inrush, then radiation) — the coil, its glare, the glass, the
 * lamp's light on the board, all from that one number, both ways. One number in the scene: the coil's temperature.
 *
 * The time is spread over the track as `0,1 s × x³` (the track's share x): the model runs through red and orange in
 * its first ten thousandths of a second, so on an even track two thirds of it would show one unchanging white coil;
 * so the first third is dark → dull red (≤ 4 ms), the middle orange, the last third yellow-white. The read-out says
 * the true time. Goal: the slider at its end, then back in its first third.
 */
import { Vector3 } from 'three';
import { STAGE_POST, filamentAfterClick, formatTemperature } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

/** A click on the track glides there: time constant (s) of the glide, and the least time for the whole track. */
const GLIDE = 0.35;
const CROSS = 2.2;
const END = 0.1;

const NBSP = ' ';
const DOWN = new Vector3(0, -0.4, 0);
const PHONE = new Vector3(0, -0.3, 0);
const seconds = (x: number): number => END * x * x * x;

export const glowStep: StepFactory = ({ ctx, ui, world, lens, fly, flying, reached, reach }) => {
  const { stand, lamp } = world;
  const here = (): boolean => ctx.stage.current === 'glow';
  const unit = caption('glow', 2).split(/\s+/).pop() ?? '';
  const format = (x: number): string => {
    const s = seconds(x);
    const digits = s === 0 ? 0 : s < 0.01 ? 3 : 2;
    return `${s.toFixed(digits).replace('.', ',')}${NBSP}${unit}`;
  };
  const x = { target: 0, shown: 0, drag: false, told: -1 };
  let wasAtEnd = false;
  let landed = false;
  ctx.qa.expose('glow', () => ({ x: x.shown, seconds: seconds(x.shown), heat: stand.glow, wasAtEnd }));
  ctx.qa.probe('coil', lamp.anchors.coil);
  // the read-out stands below the coil, between the supports — never over the turns
  const below = new Vector3();
  // on a phone the scene is a short strip above the sheet (`glowCoil` frames the coil high in it): the read-out
  // stands a little closer under the coil
  const under = (): Vector3 =>
    lamp.anchors.coil.getWorldPosition(below).add(ctx.device.formFactor === 'phone' ? PHONE : DOWN);

  return {
    spec: {
      camera: 'glowCoil',
      params: { closed: 0, lens: 0, lensCall: 0, window: 0, poles: 1 },
      post: STAGE_POST.lamp,
      cameraMove: { duration: 2 },
    },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'heat',
          label: caption('glow', 0),
          min: 0,
          max: 1,
          value: 0,
          step: 0.002,
          format,
          marks: [
            { value: 0, label: caption('glow', 1) },
            { value: 1, label: caption('glow', 2) },
          ],
          disabled: () => !landed,
          onChange: (v) => (x.target = v),
          onInput: (_v, how) => (x.drag = how === 'drag'),
        },
      ],
      goal: () => reached('glow'),
      callouts: [
        {
          anchor: under,
          text: () => `${caption('glow', 3)}${NBSP}${formatTemperature(lamp.celsius)}`,
          side: 'down',
          visible: () => here() && landed,
        },
      ],
    },
    enter(info) {
      x.target = x.shown = 0;
      x.drag = false;
      x.told = -1;
      wasAtEnd = false;
      landed = info.instant;
      if (!info.instant) fly('glowCoil', 2.2);
      lens.call = 0;
      lens.rim = 0;
      lens.glass = 1;
      lamp.cut = 0;
      if (info.instant) lens.snap(stand.tools.poses.holder);
      else lens.to(stand.tools.poses.holder, 1.4);
      // the lamp was lit on the stand (`hot-spot`): it cools on the way in, as a lamp does when switched off
      stand.setGlow(null);
    },
    leave() {
      stand.setGlow(null);
    },
    update(dt) {
      if (!here()) return;
      landed ||= !flying() && !ctx.camera.moving;
      const gap = x.target - x.shown;
      const step = x.drag ? gap : gap * (1 - Math.exp(-dt / GLIDE));
      const most = dt / CROSS;
      x.shown += x.drag ? gap : Math.max(-most, Math.min(most, step));
      if (Math.abs(x.shown - x.target) < 1e-4) x.shown = x.target;
      // the switch is closed for any moment after the click; at 0 it is open and the coil is the stand's own
      const on = x.shown > 0 || x.target > 0;
      if (on !== stand.closed > 0.5) ctx.stage.setParam('closed', on ? 1 : 0, { instant: true });
      // until the camera has landed the lamp cools by itself (it was lit on the stand); from then on the coil is
      // a pure function of the slider, 0 included
      if (on || landed) stand.setGlow(on ? filamentAfterClick(seconds(x.shown)).heat : 0);
      if (Math.abs(x.shown - x.told) > 0.001) ui.patch('heat', { current: (x.told = x.shown) });
      if (x.shown >= 0.97) wasAtEnd = true;
      if (wasAtEnd && x.shown <= 1 / 3 && !reached('glow')) reach('glow');
    },
  };
};
