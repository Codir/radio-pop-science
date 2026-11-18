/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand, the copper world seen through the
 * lens, and the chapter's own props, each of which is a number that travels — never jumps — between the states
 * the steps ask for. The stage param `closed` means «the circuit is whole» here (the lamp); the slider of the
 * switch is placed by `parts/switch.ts`, because in this chapter a whole circuit needs more than the switch.
 */
import type { ChapterContext, DragInfo } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { LOOP, boardToWorld, createLoopGlow, type CircuitStage, type LoopGlow } from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { caption } from './content';
import { counter, type Counter } from './parts/counter';
import { glide, type Glide } from './parts/glide';
import { placeJumper } from './parts/jumper';
import { lenses, type Lenses } from './parts/lenses';
import { water, type Water } from './parts/water';
import { looseEnd, type LooseEnd } from './parts/loose-end';
import { switchPart, type SwitchPart } from './parts/switch';

/** The common shift in the lens as a share of the darting speed at full glow (VISUAL §6: 3–6 %). */
export const DRIFT = 0.06;

export interface FlowStand {
  ctx: ChapterContext;
  world: CircuitWorld;
  stage: CircuitStage;
  copper: Copper;
  sw: SwitchPart;
  end: LooseEnd;
  /** How far the minus wire's end is out of its clamp (0 in … 1 lying on the board). */
  endOut: Glide;
  /** The counter frame (`count`, `same`, `loop`). */
  counter: Counter;
  /** The slider's seat (0 the first … 1 the second; travels on an arc) and the jumper's (0 home … 1 the first). */
  swSeat: Glide;
  jumperSeat: Glide;
  /** The second seat on the board (0 none … 1 standing); `seatWanted` — the step needs it (`loop`). */
  seatShown: Glide;
  seatWanted: boolean;
  /** What the slider does when the reader handles it (a step installs its own; default inert). */
  switchUse: SwitchUse;
  /** The three lenses of `together` / `push`. */
  lenses: Lenses;
  /** The sleeve of light round the loop (`push`: the field's wave; `loop`: the perimeter's brief glow). */
  glow: LoopGlow;
  /** The water picture (`pump`) and how far the stand has turned into it. */
  water: Water;
  waterMorph: Glide;
  /** The circuit is whole: the lamp lights in this frame (or goes dark). */
  light(on: boolean): void;
  /** The lamp is lit now (the filament's glow, not the wish). */
  readonly lit: boolean;
  /** The circuit is whole (the param, not the glow). */
  readonly whole: boolean;
  /** Deep links: every prop on its target at once. */
  snap(): void;
  update(dt: number, t: number): void;
}

export interface SwitchUse {
  enabled(): boolean;
  click?(): void;
  dragStart?(): void;
  drag?(e: DragInfo): void;
  dragEnd?(): void;
}

export function createFlowStand(ctx: ChapterContext): FlowStand {
  const world = mountWorld(ctx, { drift: DRIFT });
  const stage = world.stand;
  const sw = switchPart(ctx, world);
  const end = looseEnd(stage);
  ctx.qa.probe('lens', stage.tools.lens.ring);
  // QA: points on the four stretches of wire (the counter's zones) and on the far side
  const wirePoint = (name: string, x: number, z: number): void =>
    void ctx.qa.probe(name, () => boardToWorld(x, LOOP.y, z));
  wirePoint('wire-minus', LOOP.left, 0.2);
  wirePoint('wire-before', 1.2, LOOP.far);
  wirePoint('wire-after', LOOP.right, 0.3);
  wirePoint('wire-plus', 0.96, LOOP.near);
  const endOut = glide(1);
  const count = counter(ctx, stage, caption('count', 0), caption('count', 1));
  const swSeat = glide(0);
  const jumperSeat = glide(0);
  const seatShown = glide(0);
  let seatShownAt = -1;
  const jumper = stage.stand.mounts.seatJumper!;
  const three = lenses(ctx, stage);
  const glow = createLoopGlow();
  const pipes = water(stage, () => ctx.device.formFactor === 'phone');
  const waterMorph = glide(0);
  stage.base.frame.add(glow.group);
  sw.input({
    cursor: 'pointer',
    enabled: () => flow.switchUse.enabled() && !world.flying,
    click: () => flow.switchUse.click?.(),
    dragStart: () => flow.switchUse.dragStart?.(),
    drag: (e) => flow.switchUse.drag?.(e),
    dragEnd: () => flow.switchUse.dragEnd?.(),
  });
  const flow: FlowStand = {
    ctx,
    world,
    stage,
    copper: world.copper,
    sw,
    end,
    endOut,
    counter: count,
    swSeat,
    jumperSeat,
    seatShown,
    seatWanted: false,
    switchUse: { enabled: () => false },
    lenses: three,
    glow,
    water: pipes,
    waterMorph,
    light(on) {
      if (world.value('closed') > 0.5 !== on) ctx.stage.setParam('closed', on ? 1 : 0, { instant: true });
    },
    get lit() {
      return stage.glow > 0.5;
    },
    get whole() {
      return world.value('closed') > 0.5;
    },
    snap() {
      sw.snap();
      swSeat.set(swSeat.target);
      jumperSeat.set(jumperSeat.target);
      if (!flow.seatWanted) seatShown.go(0, 0);
      seatShown.set(seatShown.target);
      three.presence.set(three.presence.target);
      waterMorph.set(waterMorph.target);
      endOut.set(endOut.target);
      count.shown.set(count.shown.target);
    },
    update(dt, t) {
      world.update(dt, t);
      sw.seat = swSeat.update(dt);
      placeJumper(jumper, jumperSeat.update(dt));
      // the seat sinks only once the slider and the jumper are back home
      const home = swSeat.value < 0.005 && jumperSeat.value < 0.005;
      if (!flow.seatWanted && home && seatShown.target !== 0) seatShown.go(0, 0.6);
      const seat = seatShown.update(dt);
      if (seat !== seatShownAt) {
        seatShownAt = seat;
        stage.stand.setSeat(seat);
      }
      sw.place(dt);
      three.update(dt, t, stage.glow);
      glow.update(t);
      pipes.morph = waterMorph.update(dt);
      pipes.update(dt);
      end.out = endOut.update(dt);
      end.apply(t);
      count.update(dt, flow.whole);
    },
  };
  return flow;
}
