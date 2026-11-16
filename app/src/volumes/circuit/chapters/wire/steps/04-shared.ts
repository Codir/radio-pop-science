/**
 * `wire/shared` — «Електрони стають спільними». Back at the scale of the rows (depth 1) with one lone atom; the
 * button «Додати атоми» adds a neighbour, then a row, then a piece (1 → 2 → 5 → 15 atoms, the library's `atoms`),
 * and the camera steps back with every addition. A lone atom keeps its outer electron on a circle
 * (`sim.shared` 0); from two atoms on the outer electrons are shared and roam the whole piece.
 */
import { Mesh, RingGeometry, Vector3 } from 'three';
import { damp } from '@/engine/api';
import { PIECE_ATOMS, PITCH, ROW_ATOMS } from '@circuit/shared/copper/layout';
import type { CopperShot } from '@circuit/shared/copper/shots';
import { K } from '@/style';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

interface Stage {
  atoms: number;
  shot: CopperShot;
  shared: number;
}
const STAGES: readonly Stage[] = [
  { atoms: 1, shot: 'one', shared: 0 },
  { atoms: 2, shot: 'pair', shared: 1 },
  { atoms: ROW_ATOMS, shot: 'row', shared: 1 },
  { atoms: PIECE_ATOMS, shot: 'piece', shared: 1 },
];
const LAST = STAGES.length - 1;

export const sharedStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const here = (): boolean => ctx.stage.current === 'shared';
  // where the next atom will stand: a faint breathing outline beside the lone atom, so the first frame reads as
  // «one, and room for more» (the button «Додати атоми» fills it), not as a ball lost in the dark
  const ghostMat = K.glow({ color: 'cyan', intensity: 0.7 });
  const ghost = new Mesh(new RingGeometry(0.93, 1, 72), ghostMat);
  ghost.name = 'next-atom-outline';
  ghost.position.set(PITCH, 0, 0);
  ghost.visible = false;
  copper.space.add(ghost);
  let ghostShown = 0;
  // the first frame holds the lone atom and the place beside it (the shot `one` alone leaves that place under
  // the panel)
  world.name('one-wide', () => world.between('one', 'pair', 0.5));
  let k = 0;

  const add = (): void => {
    if (!here() || k >= LAST) return;
    k++;
    copper.atoms = STAGES[k]!.atoms;
    world.go(STAGES[k]!.shot, { duration: 1.8 });
    if (k === LAST) reach('shared');
  };

  // the caption points into a gap of the piece where the free electrons roam (a label riding on one electron
  // at 0.7 frame widths a second could not be read)
  const e = new Vector3();
  const gapAt = (): Vector3 => world.toWorld(e.set(PITCH * 1.5, PITCH * 0.5, 0.4), e);
  ctx.qa.expose('shared', () => ({ stage: k, atoms: copper.atoms, shared: copper.sim.shared }));

  return {
    spec: {
      ...world.state('rows', 1, 'one-wide'),
      duration: 1.8,
      ease: 'sine.inOut',
      cameraMove: { duration: 1.8 },
    },
    ui: {
      controls: [
        {
          type: 'button',
          id: 'add-atoms',
          label: caption('shared', 0),
          icon: 'plus',
          primary: true,
          disabled: () => k >= LAST,
          onClick: add,
        },
        { type: 'note', id: 'shared-stage', text: () => caption('shared', 1 + k) },
      ],
      goal: () => reached('shared'),
      callouts: [
        {
          anchor: gapAt,
          text: caption('shared', 5),
          side: 'up',
          visible: () => here() && reached('shared') && k === LAST,
        },
      ],
    },
    enter() {
      k = 0;
      copper.atoms = STAGES[0]!.atoms;
      copper.sim.shared = STAGES[0]!.shared;
      copper.marked = -1;
      copper.lattice.selected = -1;
      // the middle atom again (invisible here: on the atom floor the hero sits in the middle whichever it is)
      copper.hero = 0;
      copper.look.x = copper.look.y = 0;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.atom.reset();
      copper.atom.apart = 0;
    },
    leave() {
      // its update stops with the step: the outline must not stay behind in the next one
      ghostShown = 0;
      ghost.visible = false;
    },
    update(dt, t) {
      // only once the place is empty and the camera has landed: never over a neighbour still leaving
      const empty = copper.lattice.presence(1) < 0.02 && !ctx.camera.moving && copper.depth < 1.02;
      ghostShown = damp(ghostShown, here() && k === 0 && empty ? 1 : 0, 4, dt);
      ghost.visible = ghostShown > 0.01;
      ghostMat.fade = ghostShown;
      ghostMat.intensity = 0.36 + 0.16 * Math.sin(t * 2.4);
      if (!here()) return;
      copper.sim.shared = damp(copper.sim.shared, STAGES[k]!.shared, 2.5, dt);
    },
  };
};
