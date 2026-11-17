/**
 * `charge/charge` — «Що перенесло тертя». The balloon sits on the figure's hair (a rubbed balloon sticks). The
 * reader takes the magnifier from its holder (it calls: full cyan) and lays it over the place of contact — the
 * ring is a window onto the floor below there: rubber above, hair below (`parts/banks.ts`). Then they rub again
 * (drag the balloon, or drag in the lens): each move slides the rubber along the hair and an electron hops from
 * the hair to the rubber; the counter by the rim counts all that moved onto the balloon (600 мільярдів after
 * three rubs — the script's estimate). Goal: lens on the spot, then ≥ 3 rubs, ≥ 5 hops seen, counter at its end.
 */
import { Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { RUB_PLANE_NORMAL } from '../layout';
import { BALLOON_R, BALLOON_TALL } from '../parts/balloon';
import { HEAD, HEAD_R } from '../parts/figure';
import type { LensKeeper } from '../parts/lens-keeper';
import type { RubState } from '../parts/rub-state';
import type { LensView } from '../parts/lens-view';

/** Electrons moved onto the whole balloon by three rubs (script: «600 мільярдів», an estimate). */
const TOTAL = 6e11;
/** Moves (half rubs) that bring the counter to its end. */
const MOVES = 6;
/** The lens lands on the spot when let go this close to it (world units). */
const CATCH = 0.85;
/** The ring over the spot: large enough that the floor below reads (≈ 27 % of the frame height). */
const LENS_SCALE = 1.4;

export const chargeStep =
  (rub: RubState, keeper: LensKeeper, view: LensView): StepFactory =>
  ({ ctx, world, reached, reach }) => {
    const { props } = world;
    const { figure, balloon } = props;
    const { stand } = world.world;
    const here = (): boolean => ctx.stage.current === 'charge';
    let landed = false;
    let placed = false;
    let moves = 0;
    let shown = 0;
    let lastCall = 1;
    const head = new Vector3();
    const rest = new Vector3();
    const spot = new Vector3();
    const hit = new Vector3();
    const eye = new Vector3();
    /** Where the balloon sits on the hair, and the place of contact the lens shows. */
    const places = (): void => {
      figure.group.localToWorld(head.copy(HEAD));
      // a rubbed balloon hovers just over the hair, which rises to it (it is not pressed flat)
      rest.copy(head).add(hit.set(0.05, HEAD_R + 0.42 + BALLOON_R * BALLOON_TALL, 0.08));
      spot.copy(head).add(hit.set(0.05, HEAD_R + 0.36, 0.12));
    };
    places();
    const spotPose = () =>
      keeper.facingPose(spot, ctx.camera.camera.getWorldPosition(eye).clone(), LENS_SCALE);
    const count = (): number => Math.round((Math.min(moves, MOVES) / MOVES) * TOTAL);
    const done = (): boolean => reached('charge');

    // the lens: from the holder by hand; once on the spot a drag on it rubs the balloon
    ctx.input.register(stand.tools.lens.group, {
      cursor: 'grab',
      enabled: () => (here() && landed) || keeper.held,
      dragStart: () => {
        if (!placed) keeper.held = true;
      },
      drag: (e) => {
        if (placed) {
          const p = e.planePoint(rub.hand.normal, rub.hand.through, hit);
          if (p) rub.hand.drive(p.add(eye.copy(rest).sub(spot)));
          return;
        }
        ctx.camera.camera.getWorldPosition(eye);
        const p = e.planePoint(RUB_PLANE_NORMAL, spot, hit);
        if (p) keeper.follow(p, keeper.facingPose(p, eye, 1.05));
      },
      dragEnd: (e) => {
        if (placed) return rub.hand.drive(null);
        keeper.held = false;
        const p = e.planePoint(RUB_PLANE_NORMAL, spot, hit);
        if (p && p.distanceTo(spot) < CATCH) {
          placed = true;
          keeper.send(spotPose(), 0.45);
        } else keeper.home(0.9);
      },
    });
    ctx.qa.probe('lens', () => stand.tools.lens.glass.getWorldPosition(new Vector3()));
    ctx.qa.probe('contact', () => spot.clone());
    ctx.qa.expose('charge-step', () => ({ placed, moves, hops: view.banks.hops, count: count(), shown }));

    const rimAnchor = (): Vector3 => view.rim(1, 0, new Vector3());
    return {
      spec: world.table('charge-lens', {
        params: { deep: 0, closed: 0, lens: 0, window: 0, lensCall: 1 },
        cameraMove: { duration: 1.6 },
      }),
      ui: {
        goal: () => reached('charge'),
        callouts: [
          {
            anchor: () => view.rim(-0.55, 0.62, new Vector3()),
            text: caption('charge', 0),
            side: 'left',
            visible: () => here() && view.open > 0.9 && !done(),
          },
          {
            anchor: () => view.rim(-0.55, -0.62, new Vector3()),
            text: caption('charge', 1),
            side: 'left',
            visible: () => here() && view.open > 0.9 && !done(),
          },
          {
            anchor: rimAnchor,
            // whole hundreds of billions only: 100 … 600 all take the one form «мільярдів»
            text: () => `${caption('charge', 2)}: ${Math.round(shown / 1e11) * 100} ${caption('charge', 5)}`,
            side: 'right',
            visible: () => here() && view.open > 0.9,
          },
          {
            anchor: () =>
              balloon.group.getWorldPosition(new Vector3()).add(hit.set(-BALLOON_R * 0.85, -0.1, 0)),
            text: caption('charge', 3),
            side: 'left',
            visible: () => here() && done(),
          },
          {
            anchor: () => figure.crown(new Vector3()).add(hit.set(-0.45, -0.1, 0)),
            text: caption('charge', 4),
            side: 'left',
            visible: () => here() && done(),
          },
        ],
      },
      enter(info: StepInfo) {
        landed = info.instant;
        places();
        rub.reset(info.instant, true);
        rub.plane(RUB_PLANE_NORMAL, rest);
        rub.hand.home = rest;
        rub.hand.constrain = (p) => {
          p.x = Math.min(Math.max(p.x, rest.x - 0.5), rest.x + 0.5);
          p.y = rest.y;
          p.z = rest.z;
        };
        if (info.instant) rub.hand.place(rest, 0, true);
        else rub.hand.place(rest, 0);
        moves = 0;
        shown = done() ? TOTAL : 0;
        placed = false;
        lastCall = 1;
        view.banks.reset();
        rub.onMove = () => {
          if (!placed || view.open < 0.6) return;
          moves++;
          view.banks.slide(Math.sign(rub.hand.velocity.x) || 1);
          view.banks.hop();
        };
        // a deep link with the goal reached shows the lens already lying on the spot
        if (info.instant && done()) {
          placed = true;
          keeper.send(spotPose(), 0, true);
        } else if (keeper.active) keeper.home(0.8);
      },
      leave() {
        rub.onMove = null;
        rub.hand.constrain = null;
        rub.hand.home = null;
        rub.hand.drive(null);
      },
      update(dt) {
        if (!here()) return;
        landed ||= !ctx.camera.moving;
        places();
        rub.update(dt, head, HEAD_R);
        view.want = placed && keeper.settled ? 1 : 0;
        const call = placed || keeper.held ? 0.35 : 1;
        if (call !== lastCall) ctx.stage.setParam('lensCall', (lastCall = call), { duration: 0.4 });
        shown += (count() - shown) * Math.min(dt * 4, 1);
        if (Math.abs(count() - shown) < 1e9) shown = count();
        if (!done() && placed && moves >= MOVES && view.banks.hops >= 5 && shown >= TOTAL) reach('charge');
      },
    };
  };
