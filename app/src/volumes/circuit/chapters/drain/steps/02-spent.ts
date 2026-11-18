/**
 * `drain/spent` — «Що скінчилося». The camera comes to the battery (the section in front, the meter below it, the
 * lamp above at the right); on the way the «Години» glide back to 0 (the light whitens again) and the section
 * opens. The same slider «Години» drives the same life: the zinc grains melt into a pale deposit from the
 * separator toward the axis, the manganese oxide pales, the reaction's events thin out — and the surplus of
 * electrons on the minus stays (a little smaller at the end). Goal: section open, the thumb at «8 год» for 1 s.
 */
import { Vector3 } from 'three';
import { BATTERY, CUT_NORMAL } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { HOURS_END, phoneMeter } from '../world';

const HOLD = 1;
/** In the cut face, across the axis toward the reader and down (world): axis × the face's normal. */
const LOWER = new Vector3(1, 0, 0).cross(CUT_NORMAL).normalize();
/** The section counts as open from here. */
const OPEN = 0.97;

export const spentStep: StepFactory = ({ ctx, ui, world: dw, here, reached, reach }) => {
  const { hours, cut, cell } = dw;
  const on = (): boolean => here('spent');
  let held = 0;
  let told = -1;
  const zincAt = new Vector3();
  const oxideAt = new Vector3();
  ctx.qa.expose('spent', () => ({ hours: hours.shown, cut: cut.shown, held, surplus: cell.surplus }));
  ctx.qa.probe('zinc', () => cell.layers.zinc.anchor.getWorldPosition(new Vector3()));

  return {
    spec: { ...dw.state('spent'), cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => reached('spent'),
      controls: [
        {
          type: 'slider',
          id: 'spent-hours',
          label: caption('spent', 0),
          min: 0,
          max: HOURS_END,
          value: 0,
          format: () => '',
          marks: [
            { value: 0, label: caption('spent', 1) },
            { value: HOURS_END, label: caption('spent', 2) },
          ],
          onChange: (v: number) => (hours.target = v),
          onInput: (_v: number, how: string) => (hours.drag = how === 'drag'),
        },
      ],
      callouts: [
        phoneMeter(ctx, dw, () => here('spent')),
        {
          // the two names apart along the battery: zinc toward the minus, the oxide toward the plus
          anchor: () => cell.layers.zinc.anchor.getWorldPosition(zincAt).add(new Vector3(-0.3, 0, 0)),
          text: caption('spent', 3),
          side: 'up',
          visible: () => on() && cut.shown > 0.9,
        },
        {
          // on the ring's lower stripe, toward the plus: the name then stands below the battery, never over the cut
          anchor: () =>
            cell.anchors.section
              .getWorldPosition(oxideAt)
              .addScaledVector(LOWER, BATTERY.radius * 0.82)
              .add(new Vector3(0.5, 0, 0)),
          text: caption('spent', 4),
          side: 'down',
          visible: () => on() && cut.shown > 0.9,
        },
      ],
    },
    enter(info) {
      dw.meter.want = 1;
      dw.meter.probes = 1;
      dw.meter.needle = 'meter';
      dw.counter.want = 0;
      cell.highlight = null;
      held = 0;
      // the slider comes back to the start (the light whitens on the way), the section opens
      hours.drag = false;
      hours.tau = 0.45;
      hours.target = 0;
      cut.tau = 0.45;
      cut.target = 1;
      if (info.instant) {
        hours.shown = 0;
        hours.v = 0;
        cut.shown = 1;
        cut.v = 0;
      }
      ui.set('spent-hours', 0);
      told = -1;
    },
    leave() {
      hours.drag = false;
      hours.tau = 0.4;
    },
    update(dt) {
      if (!on()) return;
      if (Math.abs(hours.shown - told) > 0.004) ui.patch('spent-hours', { current: (told = hours.shown) });
      const end = cut.shown >= OPEN && hours.shown >= HOURS_END - 0.02 && hours.target >= HOURS_END - 0.02;
      held = end ? held + dt : 0;
      if (held >= HOLD && !reached('spent')) reach('spent');
    },
  };
};
