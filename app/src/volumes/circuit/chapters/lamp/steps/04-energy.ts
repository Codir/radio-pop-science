/**
 * `lamp/energy` — «Звідки береться жар». The camera flies from the coil to the battery: one frame holds the battery's
 * section and the switch beside it, the lamp's light on the board (shot `energy`). Once there the near half of the
 * can slides off (0.8 s, `battery.inside.cut`). The battery keeps its poles (`hold`, levels at the mark from the
 * start — no «first moment» here) and its reaction runs while a current flows (`current` = the switch): closed, the
 * zinc front flashes again and again and electrons run to the minus; open, it stills. The reader taps the switch.
 * Names of the layers on hover / long press («цинк», «оксид мангану»); «вимикач» on the switch until the first tap.
 * Goal: the section open, at least two closings and two openings, the circuit once closed for 1 s.
 */
import type { Object3D } from 'three';
import { STAGE_POST } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

/** Seconds the section takes to open (script: 0.8 s) and to close when the step is left. */
const OPEN = 0.8;
const CLOSE = 1.0;

const smooth = (x: number): number => x * x * (3 - 2 * x);

export const energyStep: StepFactory = ({ ctx, world, lens, switcher, fly, flying, reached, reach }) => {
  const { stand } = world;
  const cell = stand.stand.battery.inside;
  const here = (): boolean => ctx.stage.current === 'energy';
  /** Opening of the section 0…1 (linear; shown eased). */
  let open = 0;
  let landed = false;
  let mine = false;
  const named = (layer: Object3D, text: string): void => {
    ctx.input.register(layer, { tooltip: text, cursor: 'default', enabled: () => here() && cell.cut > 0.5 });
  };
  named(cell.layers.zinc.pick, caption('energy', 0));
  named(cell.layers.cathode.pick, caption('energy', 1));
  ctx.qa.probe('zinc', cell.layers.zinc.anchor);
  ctx.qa.probe('cathode', cell.layers.cathode.anchor);
  ctx.qa.expose('energy', () => ({
    cut: cell.cut,
    activity: cell.activity,
    closings: switcher.closings,
    openings: switcher.openings,
    longest: switcher.longest,
  }));

  return {
    spec: {
      camera: 'energy',
      params: { closed: 0, lens: 0, lensCall: 0, window: 0, poles: 1 },
      post: STAGE_POST.stand,
    },
    ui: {
      goal: () => reached('energy'),
      callouts: [
        {
          anchor: stand.stand.slider,
          text: caption('energy', 2),
          side: 'up',
          visible: () => here() && landed && switcher.closings === 0,
        },
      ],
    },
    enter(info) {
      mine = true;
      landed = info.instant;
      open = info.instant ? 1 : 0;
      switcher.reset();
      lens.call = 0;
      lens.rim = 0;
      lens.glass = 1;
      world.lamp.cut = 0;
      if (info.instant) lens.snap(stand.tools.poses.holder);
      else lens.to(stand.tools.poses.holder, 1.4);
      // the battery holds its poles at the mark from the first frame: the reaction runs only for the current
      cell.hold = true;
      cell.surplus = cell.lack = cell.mark;
      cell.current = 0;
      if (!info.instant) fly('energy', 2.2);
    },
    update(dt) {
      if (!here()) return;
      landed ||= !flying() && !ctx.camera.moving;
      if (landed) open = Math.min(1, open + dt / OPEN);
      cell.current = switcher.closed ? 1 : 0;
      if (
        !reached('energy') &&
        cell.cut > 0.9 &&
        switcher.closings >= 2 &&
        switcher.openings >= 2 &&
        switcher.longest >= 1
      )
        reach('energy');
    },
    late(dt) {
      if (!mine) return;
      if (!here()) {
        // left: the half of the can slides back, then the battery is the plain one of the stand again
        open = Math.max(0, open - dt / CLOSE);
        cell.current = 0;
        if (open === 0) {
          cell.hold = false;
          mine = false;
        }
      }
      cell.cut = smooth(open);
      // the soft key light on the cut (it steps back by itself as the lamp lights the section): with the cut
      cell.island = cell.cut;
    },
  };
};
