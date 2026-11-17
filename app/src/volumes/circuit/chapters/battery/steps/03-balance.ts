/**
 * `battery/balance` — «Реакція чекає». The same section; the battery keeps its poles (`cell.hold`), the reaction
 * stands still at the mark. The reader grabs the clump of electrons on the minus cap and pulls it away (it follows
 * the hand, like the outer electron in `wire/outer`); let go far from the battery it melts, the scale has fallen by
 * what was taken, the reaction revives and fills the minus back to the mark (≈ 3 s). As often as the reader likes.
 * Goal: the scale fell by at least a third, the clump was let go far, the scale is back on the mark.
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createCue } from '../parts/cue';
import { besideOnScreen } from '../world';

export const balanceStep: StepFactory = ({ ctx, world: bw, reached, reach }) => {
  const { cell, cut, scale, lens } = bw;
  const here = (): boolean => ctx.stage.current === 'balance';
  let hovered = false;
  let fell = false;
  let melted = false;
  /** Seconds since the last clump melted (the zinc front's name shows while the reaction answers). */
  let since = -1;
  let low = 1;
  const cue = createCue(ctx.root);

  const plane = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  ctx.input.register(cell.clump.handle, {
    cursor: 'grab',
    hover: (over) => (hovered = over),
    dragStart: () => {
      cell.clump.grab();
      low = Math.min(low, cell.surplus);
    },
    drag: (e) => {
      // across the plane facing the camera through the heap
      ctx.camera.camera.getWorldDirection(plane).negate();
      cell.clump.handle.getWorldPosition(through);
      if (e.planePoint(plane, through, hit)) cell.clump.moveTo(hit);
    },
    dragEnd: () => {
      if (cell.clump.release()) {
        melted = true;
        since = 0;
      }
    },
    enabled: () => here() && cut.shown > 0.95 && cell.surplusCount > 2 && !ctx.camera.moving,
  });

  const minusAt = new Vector3();
  const scaleAt = new Vector3();
  const clumpAt = new Vector3();
  const frontAt = new Vector3();
  ctx.qa.probe('clump', () => cell.clump.handle.getWorldPosition(clumpAt));
  ctx.qa.expose('balance', () => ({ fell, melted, low, surplus: cell.surplus, held: cell.clump.held }));

  return {
    spec: { ...bw.state('cut'), cameraMove: { duration: 1.6 } },
    ui: {
      goal: () => reached('balance'),
      callouts: [
        {
          anchor: () => cell.clump.handle.getWorldPosition(clumpAt),
          text: caption('balance', 0),
          side: 'left',
          visible: () => here() && (hovered || cell.clump.held) && since < 0,
        },
        {
          // the zinc front, where the flashes are: on the cut, a little above the axis
          anchor: () => cell.layers.separator.anchor.getWorldPosition(frontAt),
          text: caption('balance', 1),
          visible: () => here() && since >= 0 && since < 6 && !cell.clump.held,
        },
      ],
    },
    enter(info) {
      lens.goTo('holder');
      bw.metal.active = false;
      ctx.stage.setParam('window', 0, { instant: true });
      cut.target = 1;
      cut.tau = 0.35;
      if (info.instant) cut.shown = 1;
      cell.hold = true;
      if (info.instant || cell.surplus < cell.mark * 0.97) cell.surplus = cell.lack = cell.mark;
      fell = melted = false;
      since = -1;
      low = 1;
    },
    leave() {
      if (cell.clump.held) cell.clump.release();
      cue.hide();
    },
    update(dt) {
      if (!here()) return;
      low = Math.min(low, cell.surplus);
      if (low <= cell.mark * (2 / 3)) fell = true;
      if (since >= 0) since += dt;
      if (cell.clump.held) since = -1;
      if (fell && melted && !cell.clump.held && cell.surplus >= cell.mark * 0.97 && !reached('balance')) {
        reach('balance');
      }
      cell.anchors.minusCap.getWorldPosition(minusAt);
      scale.mark = cell.mark;
      scale.names = [false, true, true];
      scale.low = -0.25;
      scale.level = cell.surplus;
      // the scale comes with the open section (from `voltage` the cut opens again first)
      scale.shown = cut.shown > 0.85 ? 1 : 0;
      scale.place(besideOnScreen(ctx, minusAt, 0.02, -0.4, scaleAt), ctx.camera.camera, [-1, 1]);
      cue.update(
        dt,
        hovered && !cell.clump.held ? cell.clump.handle.getWorldPosition(clumpAt) : null,
        0.12,
        ctx.camera.camera,
      );
    },
  };
};
