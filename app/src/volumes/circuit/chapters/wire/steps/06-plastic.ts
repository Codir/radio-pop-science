/**
 * `wire/plastic` — «Мідь і пластик». The reader holds the lens and moves it: a drag anywhere in the picture moves
 * the lens with the hand (up = toward the sheath), the camera and the crowd of free electrons (`copper.look`)
 * follow without lag. In the copper the free electrons roam; in the plastic every electron stays on its atom.
 * Goal: the lens stayed over the plastic for 2 s and came back to the copper.
 */
import { Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { COPPER_TOP } from '@circuit/shared/copper/layout';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

/** Lens height (local Y of the point the camera looks at): 0 the rows … the middle of the sheath. */
const TOP = COPPER_TOP + 8.6;
/** Where the step starts: high in the copper, the edge of the sheath showing at the top of the frame. */
const START = COPPER_TOP - 3.4;
/** «On the plastic» and «back on the copper» (local Y of the lens). */
const ON_PLASTIC = COPPER_TOP + 4.6;
const ON_COPPER = COPPER_TOP - 2.6;
/** Seconds of the takeaway on screen before the closing flight to the stand. */
const BACK_AFTER = 3.5;
/** Seconds over the plastic the goal asks for. */
const STAY = 2;
/** Local units the lens travels for a drag over the whole height of the viewport: half a screen of hand takes
 *  the lens from the copper into the plastic (the frame itself is ≈ 9.5 units high). */
const TRAVEL = 21;

export const plasticStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const here = (): boolean => ctx.stage.current === 'plastic';
  const below = (): boolean => world.world.deep > 1.99 && !world.world.flying;
  let lens = START;
  let from = START;
  let held = false;
  let stayed = 0;
  let peek = -1;
  let landed = false;
  let info: StepInfo | null = null;
  /** Seconds until the closing flight to the stand (after the takeaway), −1 = none planned. */
  let home = -1;

  const go = (instant = false): void => {
    copper.look.y = lens;
    world.go(
      world.between('rows', 'plastic', lens / TOP),
      instant ? { instant } : { duration: 0.28, ease: 'power2.out' },
    );
  };

  world.name('lens-start', () => world.between('rows', 'plastic', START / TOP));
  const sheet = new Mesh(new PlaneGeometry(400, 400), new MeshBasicMaterial({ visible: false }));
  sheet.name = 'lens-drag-sheet';
  copper.group.add(sheet);
  ctx.input.register(sheet, {
    cursor: 'grab',
    enabled: () => (here() && landed && below()) || held,
    dragStart: () => {
      held = true;
      peek = -1;
      from = lens;
    },
    drag: (e) => {
      lens = Math.min(Math.max(from - (e.totalY * TRAVEL) / ctx.viewport.height, 0), TOP);
      go();
    },
    dragEnd: () => {
      held = false;
    },
  });

  const p = new Vector3();
  // each label sits in its own material, but never farther than a few units from where the lens looks, so the
  // material in view is always named
  const label = (y: () => number) => (): Vector3 => world.toWorld(p.set(-4.8, y(), 0.6), p);
  const copperY = (): number => Math.min(COPPER_TOP - 1.9, lens + 2);
  const plasticY = (): number => Math.max(COPPER_TOP + 1.7, lens - 1.5);
  const done = (): boolean => reached('plastic');
  // names appear once the camera has landed (never on a moving frame), and only for the material that is well in
  // view: the «peek» on entry must not flash the plastic's name at the edge
  const named = (): boolean => here() && landed && world.world.deep > 1.6 && !world.world.flying;
  const copperText = (): string =>
    done() ? `${caption('plastic', 0)} — ${caption('plastic', 2)}` : caption('plastic', 0);
  const plasticText = (): string =>
    done() ? `${caption('plastic', 1)} — ${caption('plastic', 3)}` : caption('plastic', 1);
  ctx.qa.expose('plastic', () => ({
    lens,
    stayed,
    onPlastic: lens >= ON_PLASTIC,
    onCopper: lens <= ON_COPPER,
  }));
  ctx.qa.probe('lens-centre', () => world.toWorld(p.set(0, lens, 0), p));

  return {
    spec: {
      ...world.state('rows', 0, 'lens-start'),
      cameraMove: { duration: 1.8 },
    },
    ui: {
      goal: () => reached('plastic'),
      callouts: [
        {
          anchor: label(copperY),
          text: copperText,
          side: 'left',
          visible: () => named() && lens < COPPER_TOP + 3,
        },
        {
          anchor: label(plasticY),
          text: plasticText,
          side: 'left',
          visible: () => named() && lens > COPPER_TOP - 1,
        },
      ],
    },
    enter(i) {
      info = i;
      home = -1;
      copper.atoms = Infinity;
      copper.sim.shared = 1;
      copper.marked = -1;
      copper.lattice.selected = -1;
      copper.hero = 0;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.look.x = 0;
      lens = START;
      copper.look.y = lens;
      stayed = 0;
      held = landed = false;
      // once the flight in has landed, the lens lifts a little and settles back: «this can be moved»
      peek = i.instant ? 0.6 : 2.2;
    },
    leave() {
      copper.look.y = 0;
    },
    update(dt) {
      if (!here()) return;
      // a dive into the step (arriving from the next chapter) is the rail's: the camera director is idle meanwhile
      landed ||= !ctx.camera.moving && !world.world.flying;
      if (peek > 0 && !held) {
        peek -= dt;
        if (peek <= 0) {
          world.go(world.between('rows', 'plastic', (lens + 1.6) / TOP), {
            duration: 0.7,
            ease: 'sine.inOut',
          });
          ctx.stage.scope.delay(0.75, () => !held && here() && go());
        }
      }
      if (lens >= ON_PLASTIC) stayed += dt;
      if (stayed >= STAY && lens <= ON_COPPER && home < 0 && below()) {
        reach('plastic');
        home = BACK_AFTER;
      }
      // the chapter ends where it began: after the takeaway, back up through the lens to the stand (VISUAL §3)
      if (home > 0 && !held && (home -= dt) <= 0 && info) {
        world.world.fly(0, 'stand', info, 0);
      }
    },
  };
};
