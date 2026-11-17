/**
 * `battery/poles` — «Два кінці батарейки». The stand, switch open, lamp off. The reader lays the lens on the
 * battery's «−» end and on its «+» end (tap the lens, tap an end, or drag the lens there); the camera comes closer
 * with the first move. Inside the ring: the metal under the pole's surface (`parts/metal.ts`) — on «−» the free
 * electrons crowd the surface, on «+» they keep away from it and the edge atoms glow coral — and beside the rim
 * the pole scale points at «забагато» / «бракує». Goal: ≥ 2 s on each end, any order.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { worldToBoard } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createCue } from '../parts/cue';
import { POLES_VIEW, POLE_END, poleLensPose, type PoleId } from '../parts/poses';
import { besideOnScreen } from '../world';

/** Seconds on each end the goal asks for. */
const STAY = 2;
/** The window opens when the lens centre is this close to a pole pose (board units). */
const NEAR_POLE = 0.85;
const smooth = (a: number, b: number, v: number): number => {
  const k = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return k * k * (3 - 2 * k);
};

export const polesStep: StepFactory = ({ ctx, world: bw, reached, reach }) => {
  const { world, stand, cell, lens, metal, scale } = bw;
  const here = (): boolean => ctx.stage.current === 'poles';
  const stay = { minus: 0, plus: 0 };
  let taken = false;
  let hovered: PoleId | null = null;
  let windowWanted = 0;
  let level = 0;
  let after = -1;
  const poses = { minus: poleLensPose('minus'), plus: poleLensPose('plus') };
  const xMinus = poses.minus.position.x;
  const xPlus = poses.plus.position.x;
  const cue = createCue(ctx.root);

  const take = (pole: PoleId): void => {
    if (!taken) {
      taken = true;
      ctx.stage.setParam('lensCall', 0);
      ctx.camera.go('poles', { duration: 1.5 });
    }
    lens.goTo(pole);
  };
  const ready = (): boolean => here() && !world.flying;

  // the lens itself: a tap takes it to «−» (or, lying on one end, to the other); a drag carries it
  const grabbed = new Vector3();
  const offset = new Vector3();
  const centre = new Vector3();
  const normal = new Vector3();
  const hit = new Vector3();
  ctx.input.register(stand.tools.lens.group, {
    cursor: 'grab',
    enabled: ready,
    click: () => take(lens.landed === 'minus' ? 'plus' : 'minus'),
    dragStart: (e) => {
      if (!taken) take('minus');
      stand.tools.lens.glass.getWorldPosition(centre);
      offset.copy(e.startPoint ?? centre).sub(centre);
      grabbed.copy(centre);
    },
    drag: (e) => {
      normal.copy(POLES_VIEW);
      if (!e.planePoint(normal, grabbed, hit)) return;
      lens.hold(worldToBoard(hit.sub(offset)));
    },
    dragEnd: () => {
      const p = lens.position;
      const dm = p.distanceTo(poses.minus.position);
      const dp = p.distanceTo(poses.plus.position);
      lens.hold(null);
      lens.goTo(dm <= dp ? 'minus' : 'plus');
    },
  });
  // the two ends: a tap lays the lens there
  const material = new MeshBasicMaterial({ visible: false });
  for (const pole of ['minus', 'plus'] as const) {
    const pick = new Mesh(new SphereGeometry(0.34, 12, 8), material);
    pick.name = `battery:end-${pole}`;
    pick.position.copy(POLE_END[pole]);
    ctx.root.add(pick);
    ctx.input.register(pick, {
      cursor: 'pointer',
      enabled: () => ready() && lens.spot !== pole,
      hover: (over) => {
        if (over) hovered = pole;
        else if (hovered === pole) hovered = null;
      },
      click: () => take(pole),
    });
  }

  const lensAt = new Vector3();
  const scaleAt = new Vector3();
  const above = (pole: PoleId) => (): Vector3 => POLE_END[pole].clone().add(new Vector3(0, 0.32, 0));
  ctx.qa.probe('lens', () => stand.tools.lens.glass.getWorldPosition(lensAt));
  ctx.qa.probe('end-minus', () => POLE_END.minus);
  ctx.qa.probe('end-plus', () => POLE_END.plus);
  ctx.qa.expose('poles', () => ({
    stay: { ...stay },
    landed: lens.landed,
    window: world.window.amount,
    charge: metal.charge,
    pointer: scale.pointer,
  }));

  return {
    spec: { ...bw.state('stand', { poles: 0, lensCall: 1 }), cameraMove: { duration: 1.8 } },
    ui: {
      goal: () => reached('poles'),
      callouts: (['minus', 'plus'] as const).map((pole) => ({
        anchor: above(pole),
        text: caption('poles', 3),
        visible: () => here() && reached('poles') && after > 0.6,
      })),
    },
    enter(info) {
      stay.minus = stay.plus = 0;
      taken = false;
      hovered = null;
      after = reached('poles') ? 1 : -1;
      world.window.closeSeconds = 0.45;
      // «Назад» from the section: the battery closes again (the same cut, going back)
      bw.cut.target = 0;
      bw.cut.tau = 0.3;
      if (info.instant) bw.cut.shown = 0;
      cell.hold = false;
      if (info.instant) {
        lens.place('holder');
        level = cell.mark;
      }
      if (reached('poles')) ctx.stage.setParam('poles', 1, { instant: info.instant });
      windowWanted = 0;
      ctx.stage.setParam('window', 0, { instant: true });
    },
    leave() {
      cue.hide();
      metal.active = false;
      scale.shown = 0;
    },
    update(dt) {
      if (!here()) return;
      // the poles are charged whether we look or not; the dots come up with the scene, never in one frame
      level = Math.min(cell.mark, level + dt * 0.5);
      cell.surplus = cell.lack = level;
      const p = lens.position;
      const near = Math.min(p.distanceTo(poses.minus.position), p.distanceTo(poses.plus.position));
      const want = taken && near < NEAR_POLE ? 1 : 0;
      if (want !== windowWanted) {
        windowWanted = want;
        ctx.stage.setParam('window', want);
      }
      const u = smooth(0, 1, (p.x - xMinus) / (xPlus - xMinus));
      metal.active = taken || world.window.amount > 0.002;
      metal.charge = 1 - 2 * u;
      // the scale beside the rim (right of it on the screen), shown with the window
      stand.tools.lens.glass.getWorldPosition(lensAt);
      scale.mark = cell.mark;
      scale.names = [true, true, true];
      scale.low = -1;
      scale.level = metal.charge * cell.mark;
      scale.shown = after > 0.3 ? 0 : world.window.amount;
      // right of the ring on «−» (free board there), left of it on «+» (the switch is right of it): it slides over
      const side = metal.charge;
      const ring = stand.tools.lens.group.scale.x;
      scale.place(besideOnScreen(ctx, lensAt, 0.33 * side * ring, 0.3 * ring, scaleAt), ctx.camera.camera, [
        -side,
        -1,
      ]);
      for (const pole of ['minus', 'plus'] as const) {
        if (lens.landed === pole && world.window.amount > 0.95) stay[pole] += dt;
      }
      if (!reached('poles') && stay.minus >= STAY && stay.plus >= STAY) {
        reach('poles');
        after = 0;
        ctx.stage.setParam('poles', 1);
      }
      if (after >= 0) after += dt;
      cue.update(dt, hovered && lens.spot !== hovered ? POLE_END[hovered] : null, 0.34, ctx.camera.camera);
    },
  };
};
