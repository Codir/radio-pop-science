/**
 * `charge/rub` — «Кулька й волосся». On the table in front of the stand: the reader takes the balloon, rubs it
 * on the figure's hair (back and forth while touching it), draws it slowly away — the hair reaches after it —
 * then brings it near the second, already rubbed balloon on its thread, which swings away. Goal: ≥ 3 rubs
 * (there and back), then the hair rose after the balloon, then the second balloon leaned noticeably — in order.
 */
import { Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { BALLOON_REST, FIGURE, RUB_PLANE_NORMAL } from '../layout';
import { BALLOON_R } from '../parts/balloon';
import { HEAD, HEAD_R } from '../parts/figure';
import type { RubState } from '../parts/rub-state';

/** Lean of the second balloon (radians) that counts as «помітно відхилилася». */
const LEANED = 0.16;
/** Hair pull that counts as «волосся піднялося» (0…1), held this long (s). */
const ROSE = 0.3;
const ROSE_FOR = 0.5;

export const rubStep =
  (rub: RubState): StepFactory =>
  ({ ctx, world, reached, reach }) => {
    const { props } = world;
    const { balloon, hanger, figure } = props;
    const here = (): boolean => ctx.stage.current === 'rub';
    let landed = false;
    let rose = 0;
    let hairRose = false;
    let leaned = false;
    const p = new Vector3();
    const head = new Vector3();
    const hang = new Vector3();
    ctx.qa.probe('balloon', () => balloon.group.getWorldPosition(p));
    ctx.qa.probe('hair', () => figure.crown(head));
    ctx.qa.probe('second-balloon', () => hanger.centre(hang));
    ctx.qa.expose('rub', () => ({ rubs: rub.rubs, charge: rub.charge, hairRose, leaned, lean: hanger.lean }));
    rub.hand.enabled = () => here() && landed;
    const hairAt = (): Vector3 => figure.crown(new Vector3()).add(new Vector3(-0.22, -0.12, 0.1));
    const secondAt = (): Vector3 => hanger.centre(new Vector3()).add(new Vector3(0, 0.75, 0));

    return {
      spec: world.table('charge-table', { duration: 1.6, cameraMove: { duration: 2.2 } }),
      ui: {
        goal: () => reached('rub'),
        callouts: [
          {
            anchor: () =>
              balloon.group.getWorldPosition(new Vector3()).add(new Vector3(0, BALLOON_R + 0.15, 0)),
            text: caption('rub', 0),
            side: 'right',
            visible: () => here() && landed && (balloon.hover > 0.5 || rub.held()),
          },
          {
            anchor: hairAt,
            text: caption('rub', 1),
            side: 'left',
            visible: () => here() && landed && (hairRose || rub.touching),
          },
          {
            anchor: secondAt,
            text: caption('rub', 2),
            side: 'up',
            visible: () => here() && landed && (hairRose || reached('rub')),
          },
        ],
      },
      enter(info: StepInfo) {
        landed = info.instant;
        rose = 0;
        hairRose = leaned = false;
        rub.reset(info.instant, reached('rub'));
        rub.plane(
          RUB_PLANE_NORMAL,
          head
            .copy(FIGURE)
            .add(HEAD)
            .add(new Vector3(0, 0, 0.18)),
        );
        rub.hand.home = null;
        // the balloon starts on the table (from a later step it is carried back there)
        rub.hand.place(BALLOON_REST, 1.45, info.instant);
      },
      update(dt) {
        if (!here()) return;
        landed ||= !ctx.camera.moving;
        figure.group.localToWorld(head.copy(HEAD));
        rub.update(dt, head, HEAD_R);
        if (rub.charge >= 1 && !rub.touching && figure.pull > ROSE) rose += dt;
        else rose = 0;
        if (rose >= ROSE_FOR) hairRose = true;
        if (hairRose && hanger.lean >= LEANED) leaned = true;
        if (hairRose && leaned && !reached('rub')) reach('rub');
      },
    };
  };
