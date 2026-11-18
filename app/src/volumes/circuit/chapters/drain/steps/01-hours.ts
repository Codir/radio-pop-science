/**
 * `drain/hours` — «Години роботи». The chapter opens on the lit stand plan (chapter 6's last frame); the camera
 * lowers a little while the meter slides onto the table and lays its probes on the battery's clamps, and the
 * counter frame rises on the right wire. The dock slider «Години» 0 … 8 год IS the battery's time (UI_API §3.3):
 * the needle, the frame's number and the filament's colour — with the pool of light and the room — are one
 * function of it, both ways. Goal: the thumb at «8 год» (needle below 1 V, the filament a dull red) for 1 s.
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { HOURS_END, formatAmps, phoneMeter } from '../world';

/** Seconds at the end before the goal holds. */
const HOLD = 1;

export const hoursStep: StepFactory = ({ ctx, ui, world: dw, here, reached, reach }) => {
  const { hours, gauge, frame } = dw;
  const on = (): boolean => here('hours');
  let held = 0;
  let told = -1;
  let landed = false;
  const meterAt = new Vector3();
  const frameAt = new Vector3();
  const phone = (): boolean => ctx.device.formFactor === 'phone';
  const ready = (): boolean => on() && gauge.touching && frame.shown > 0.95;
  ctx.qa.expose('hours', () => ({
    hours: hours.shown,
    target: hours.target,
    life: dw.life,
    volts: dw.volts,
    amps: dw.amps,
    glow: dw.stand.glow,
    held,
  }));
  ctx.qa.probe('meter', () => gauge.anchor.getWorldPosition(meterAt));
  ctx.qa.probe('frame', () => frame.group.getWorldPosition(frameAt));

  return {
    spec: { ...dw.state('hours'), cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => reached('hours'),
      controls: [
        {
          type: 'slider',
          id: 'hours',
          label: caption('hours', 0),
          min: 0,
          max: HOURS_END,
          value: 0,
          format: () => '',
          marks: [
            { value: 0, label: caption('hours', 1) },
            { value: HOURS_END, label: caption('hours', 2) },
          ],
          onChange: (v: number) => (hours.target = v),
          onInput: (_v: number, how: string) => (hours.drag = how === 'drag'),
        },
      ],
      callouts: [
        phoneMeter(ctx, dw, () => here('hours')),
        {
          // the name stands right of the instrument, on the free table, never over the scale or the number
          anchor: () => gauge.anchor.getWorldPosition(meterAt).add(new Vector3(0.4, 0.08, 0)),
          text: caption('hours', 3),
          side: 'right',
          visible: () => ready() && hours.shown < 0.05 && !reached('hours'),
        },
        {
          anchor: () => frame.group.getWorldPosition(frameAt).add(new Vector3(0.25, -0.1, 0)),
          text: caption('hours', 4),
          side: 'right',
          visible: () => ready() && hours.shown < 0.05 && !reached('hours'),
        },
        {
          // on a phone the frame's printed number would be under 14 px: the interface shows it at the frame
          anchor: () => frame.group.getWorldPosition(frameAt).add(new Vector3(0, 0.45, 0)),
          text: () => formatAmps(dw.amps),
          side: 'up',
          visible: () => on() && phone() && frame.shown > 0.95,
          priority: 0,
        },
      ],
    },
    enter(info) {
      dw.meter.want = 1;
      dw.meter.probes = 1;
      dw.meter.needle = 'meter';
      dw.counter.want = 1;
      dw.cut.target = 0;
      held = 0;
      landed = false;
      if (info.instant) {
        hours.target = hours.shown = 0;
        hours.v = 0;
        dw.cut.shown = 0;
      }
      ui.set('hours', hours.target);
      told = -1;
      // the chapter opens on the stand plan the lamp chapter ends on; the camera lowers from there
      if (info.from === null) ctx.camera.go('stand', { instant: true });
    },
    leave() {
      hours.drag = false;
    },
    update(dt) {
      if (!on()) return;
      if (!landed && !ctx.camera.moving) {
        landed = true;
        if (
          ctx.camera.camera.position.distanceTo(
            new Vector3(...(dw.shot('hours').position as [number, number, number])),
          ) > 0.05
        )
          ctx.camera.go('hours', { duration: 2.4 });
      }
      if (Math.abs(hours.shown - told) > 0.004) ui.patch('hours', { current: (told = hours.shown) });
      const end = hours.shown >= HOURS_END - 0.02 && hours.target >= HOURS_END - 0.02;
      held = end && dw.volts < 1 ? held + dt : 0;
      if (held >= HOLD && !reached('hours')) reach('hours');
    },
  };
};
