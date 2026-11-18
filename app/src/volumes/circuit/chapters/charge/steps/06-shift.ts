/**
 * `charge/shift` — «Поле і вільні електрони». The spare piece of wire lies in front of the stand and the lens is
 * already over it (a window, not a door: «ряди» of copper inside the resting lens, `world.window`). The reader
 * brings the charged balloon to one end: the free electrons, still darting, lean to the far end within ≈ 1 s
 * (`copper.sim.lean`, `shared/copper/lean.ts`) and the atoms they uncovered glow faintly `coral`; then nothing
 * more moves together although the balloon is still there. Balloon away — in ≈ 1 s they are even again.
 * Goal: one cycle (near < the piece's length for ≥ 2 s with the crowd settled, then away and even again).
 * After the takeaway the camera returns to the stand: the chapter ends where it began.
 */
import { AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { BALLOON_REST, FIGURE_OUT, RUB_PLANE_NORMAL, SPARE, SPARE_LENGTH } from '../layout';
import { BALLOON_R } from '../parts/balloon';
import type { LensKeeper } from '../parts/lens-keeper';
import type { RubState } from '../parts/rub-state';
import { createSpare } from '../parts/spare';
import { softShadow } from '../parts/spheres';

/** Largest lean of the crowd (the balloon at the very end of the piece). */
const LEAN = 0.85;
/** Time constant of the lean, s: ≈ 95 % in one second. */
const TAU = 0.33;
const HOLD = 2;
/** Copper units across the window (the free electrons in view: about a dozen). */
const SPAN = 12;
/** Half-size of the free electrons' box while the window shows them (just beyond the window's radius). */
const CROWD = { x: 7.2, y: 6.3 };
/** Seconds of the takeaway on screen before the camera returns to the stand. */
const BACK_AFTER = 3.5;
/** Where the balloon waits when the step begins: well away from the piece. */
const START = new Vector3(-2.6, 0.5, 4.0);

export const shiftStep =
  (rub: RubState, keeper: LensKeeper): StepFactory =>
  ({ ctx, world, reached, reach }) => {
    const { copper } = world;
    const { balloon } = world.props;
    const spare = createSpare(SPARE, SPARE_LENGTH);
    world.props.group.add(spare.group);
    // the atoms the electrons uncovered: a faint coral glow over the near side of the window
    const glow = new Mesh(
      new PlaneGeometry(9, 16),
      new MeshBasicMaterial({
        map: softShadow('255,255,255'),
        color: 0xff5e5b,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.set(-5.2, 0, -1.1);
    copper.space.add(glow);
    const here = (): boolean => ctx.stage.current === 'shift';
    const box = { ...copper.sim.box };
    let landed = false;
    let lean = 0;
    let held = 0;
    let gathered = false;
    let home = -1;
    let windowOn = 0;
    const p = new Vector3();
    const eye = new Vector3();
    const reachOf = (): { d: number; side: number } => {
      balloon.group.getWorldPosition(p);
      const dl = p.distanceTo(spare.left);
      const dr = p.distanceTo(spare.right);
      return dl < dr ? { d: dl, side: 1 } : { d: dr, side: -1 };
    };
    const lensPose = () =>
      keeper.facingPose(p.copy(SPARE).setY(0.95), ctx.camera.camera.getWorldPosition(eye).clone(), 1.6);
    ctx.qa.probe('spare-left', () => spare.left.clone());
    ctx.qa.probe('spare-right', () => spare.right.clone());
    ctx.qa.expose('shift', () => ({
      lean,
      held,
      gathered,
      d: reachOf().d,
      window: world.world.window.amount,
    }));

    return {
      spec: world.table('charge-spare', { cameraMove: { duration: 2 } }),
      ui: {
        goal: () => reached('shift'),
        callouts: [
          {
            anchor: () => balloon.group.getWorldPosition(new Vector3()).add(eye.set(0, BALLOON_R + 0.2, 0)),
            text: caption('shift', 0),
            side: 'up',
            visible: () => here() && landed && home < 0 && (balloon.hover > 0.5 || rub.held()),
          },
          {
            anchor: () => spare.right.clone().add(eye.set(0.1, 0, 0.1)),
            text: caption('shift', 1),
            side: 'right',
            visible: () => here() && landed && home < 0 && !rub.held(),
          },
        ],
      },
      enter(info: StepInfo) {
        landed = info.instant;
        lean = 0;
        held = 0;
        gathered = false;
        home = -1;
        rub.reset(info.instant, true);
        rub.plane(RUB_PLANE_NORMAL, p.copy(SPARE).setY(0.6));
        rub.hand.home = null;
        rub.hand.constrain = null;
        rub.hand.enabled = () => here() && landed && home < 0;
        rub.hand.home = null;
        rub.hand.place(START, 1.45, info.instant);
        // the figure walks off to the left: wholly out of the shot, never cut by its edge
        world.props.aside = FIGURE_OUT;
        keeper.send(lensPose(), info.instant ? 0 : 1.2, info.instant);
        world.world.window.span = SPAN;
        // the 32 free electrons of the focal plane crowd the window (≈ 20 in view), so the lean shows by them
        copper.sim.box.x = CROWD.x;
        copper.sim.box.y = CROWD.y;
      },
      leave() {
        world.props.aside = null;
        copper.sim.lean = 0;
        copper.sim.box.x = box.x;
        copper.sim.box.y = box.y;
        rub.hand.drive(null);
      },
      update(dt) {
        landed ||= !ctx.camera.moving;
        // the window opens once the lens lies on the piece, and closes before the lens leaves it
        const open = keeper.settled && home !== 0 && ctx.stage.current === 'shift' ? 1 : 0;
        if (open !== windowOn)
          ctx.stage.setParam('window', (windowOn = open), { duration: open ? 0.6 : 0.4 });
        // the balloon's field reaches into the piece: the lean it asks for falls off steeply with distance
        const { d, side } = reachOf();
        // nothing beyond the piece's own length («ближче ніж на його довжину»), full at the end of it
        const near = Math.min(Math.max((SPARE_LENGTH - d) / (SPARE_LENGTH - 0.7), 0), 1) ** 2;
        const want = side * LEAN * near;
        lean += (want - lean) * (1 - Math.exp(-dt / TAU));
        copper.sim.lean = lean;
        copper.sim.leanSpan = 6.6;
        const glowing = Math.abs(lean) / LEAN;
        (glow.material as MeshBasicMaterial).opacity = 0.32 * glowing;
        glow.position.x = -5.2 * Math.sign(lean || 1);
        if (d < SPARE_LENGTH && Math.abs(lean - want) < 0.04 * LEAN && Math.abs(want) > 0.25) held += dt;
        else if (!gathered) held = 0;
        if (held >= HOLD) gathered = true;
        if (gathered && d > SPARE_LENGTH && Math.abs(lean) < 0.03 && home < 0 && !reached('shift')) {
          reach('shift');
          home = BACK_AFTER;
        }
        // the chapter ends where it began: the stand shot, the lens back in its holder
        if (home > 0 && (home -= dt) <= 0) {
          home = 0;
          ctx.stage.setParam('window', (windowOn = 0), { duration: 0.4 });
          // the balloon goes back to its place on the table, outside the stand shot
          rub.hand.drive(null);
          rub.hand.home = BALLOON_REST;
          keeper.home(1.6);
          world.go('stand', { duration: 2.6, ease: 'sine.inOut' });
        }
      },
    };
  };
