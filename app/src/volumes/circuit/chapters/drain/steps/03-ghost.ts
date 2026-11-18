/**
 * `drain/ghost` — «Сіла, але показує». The section closes, the «Години» run on to the end if the reader stopped
 * short (the battery is dead: the filament a dull red, the room in cold light) and the camera comes a little
 * closer to the battery and the meter. The switch is live. The needle follows the battery itself
 * (`followVoltage`): opened, it creeps up to ≈ 1,2 V in 2–3 s; closed, it falls below 1 V in half a second and
 * the filament barely reddens. Goal: ≥ 2 openings and closings, and once open until the needle stood at 1,2 V.
 */
import { Vector3 } from 'three';
import { openVoltage } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { HOURS_END, phoneMeter } from '../world';

/** The needle counts as «at 1,2» from here (the number shows «1,2 V»). */
const RISEN = openVoltage(1) - 0.035;

export const ghostStep: StepFactory = ({ ctx, world: dw, switcher, here, reached, reach }) => {
  const { hours, cut, gauge } = dw;
  const on = (): boolean => here('ghost');
  let rose = false;
  const meterAt = new Vector3();
  const switchAt = new Vector3();
  const settled = (): boolean => ghostSwitchLive(dw);
  ctx.qa.expose('ghost', () => ({
    volts: dw.volts,
    rose,
    closings: switcher.closings,
    openings: switcher.openings,
    closed: switcher.closed,
    settled: settled(),
  }));

  return {
    spec: { ...dw.state('ghost'), cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => reached('ghost'),
      callouts: [
        phoneMeter(ctx, dw, () => here('ghost')),
        {
          // the name stands right of the instrument, on the free table, never over the scale or the number
          anchor: () => gauge.anchor.getWorldPosition(meterAt).add(new Vector3(0.4, 0.08, 0)),
          text: caption('ghost', 0),
          side: 'right',
          visible: () => on() && settled() && gauge.touching && switcher.openings + switcher.closings === 0,
        },
        {
          anchor: () => dw.stand.stand.anchors.switch.getWorldPosition(switchAt),
          text: caption('ghost', 1),
          side: 'right',
          visible: () => on() && settled() && switcher.openings + switcher.closings === 0,
        },
      ],
    },
    enter(info) {
      dw.meter.want = 1;
      dw.meter.probes = 1;
      dw.meter.needle = 'battery';
      dw.counter.want = 0;
      dw.cell.highlight = null;
      switcher.reset();
      rose = false;
      // the battery goes on to its end (whatever the reader left on the slider), the section closes
      hours.drag = false;
      hours.tau = 0.5;
      hours.target = HOURS_END;
      cut.tau = 0.35;
      cut.target = 0;
      if (info.instant) {
        hours.shown = HOURS_END;
        hours.v = 0;
        cut.shown = 0;
        cut.v = 0;
      }
    },
    leave() {
      hours.tau = 0.4;
    },
    update() {
      if (!on()) return;
      if (!switcher.closed && dw.volts >= RISEN) rose = true;
      if (!reached('ghost') && rose && switcher.openings >= 2 && switcher.closings >= 2) reach('ghost');
    },
  };
};

/** The switch may be flipped in `ghost` once the battery is dead and closed (scene.ts asks). */
export function ghostSwitchLive(dw: { hours: { shown: number }; cut: { shown: number } }): boolean {
  return dw.hours.shown >= HOURS_END - 0.02 && dw.cut.shown < 0.03;
}
