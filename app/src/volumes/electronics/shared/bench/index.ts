/**
 * The bench of the volume «Радіоелектроніка» (docs/volumes/electronics/VISUAL.md §2, §3, §7, §8): the dark room, the
 * base with the breadboard, the light, the magnifier in its holder and the permanent things — for now as stand-ins
 * (`props.ts`). A chapter mounts it once in its scene factory and drives it through plain parameters (shared/README.md,
 * «bench»). Copied in its shape from `circuit/shared/stage/index.ts` (`mountStage` → `mountBench`; shared/README.md,
 * «Копії»): no flashlight, unfolding, snail, battery cutaway or lamp close-up.
 */
import { Group, Vector3, type Mesh } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { KToonMaterial } from '@/style';
import { createLayout, type BoardLayout } from '@electronics/sim/board';
import { createAir } from './air';
import { createBase, type Base } from './base';
import { createBoardView, type BoardView } from './board-view';
import { PLACES } from './layout';
import { BENCH_AMBIENT, createLight, type LightRig } from './light';
import { tame } from './materials';
import { createProps, type Props } from './props';
import { createRoom, type Room } from './room';
import { STAGE_POST, benchShots } from './shots';
import { createTools, type BenchTools, type LensPose } from './tools';

export { BOARD, LAMP, LENS, PLACES, SWITCH } from './layout';
export { BOARD_Y } from './base';
export { BOARD_LOOK, type BoardView } from './board-view';
export { BENCH_AMBIENT, filamentColor, type LightRig } from './light';
export { AWAY, type Props } from './props';
export { STAGE_FOV, STAGE_POST, STAGE_SHOTS, benchShots, boardToWorld, type BenchShot } from './shots';
export { holderPose, overPose, worldDirToBoard, worldToBoard, type BenchTools, type LensPose } from './tools';
// what the sandbox (`_dev`, which may import only `shared/**`) needs of the board as data
export {
  BOARD_SPEC,
  createLayout,
  type BoardLayout,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';

export interface Bench {
  /** Everything of the bench; already added to `ctx.root`. */
  readonly group: Group;
  readonly room: Room;
  /** The base; `base.frame` is the tilted base frame everything on the base lives in. */
  readonly base: Base;
  readonly light: LightRig;
  /** The breadboard as data (`sim/board`) and in 3D. */
  readonly layout: BoardLayout;
  readonly board: BoardView;
  /** The permanent things as stand-ins: battery box with the switch, player, speaker, lamp, tray, instruments. */
  readonly props: Props;
  /** The magnifier and its holder. */
  readonly tools: BenchTools;
  /**
   * Lift of the unlit room 0…1 (default `BENCH_AMBIENT`): an even cool fill and a stronger moon that step back as
   * the lamp's light rises.
   */
  ambient: number;
  /** Strength of the cold moon 0…1 (default 1). */
  moon: number;
  /**
   * The lamp's filament 0 cold … 1 working white, as the circuit model gives it (until the model drives the bench,
   * 0). Shown with the filament's inertia: it heats in hundredths of a second and cools a little slower.
   */
  lamp: number;
  /** The battery's switch: 0 open (the thumb pushed to the left, the gap shows) … 1 closed (default 0). */
  closed: number;
  /** The magnifier: 0 in its holder … 1 at `lensTarget` (base frame); with no target it stays in its holder. */
  lens: number;
  lensTarget: LensPose | null;
  /** 0…1: the step asks the reader to take the magnifier — the resting ring turns full cyan and pulses. */
  lensCall: number;
  /** 0…1 progress of the flight through the ring (the rim's arcs from 0.5 on). */
  dive: number;
  /** The instruments: 0 away beyond the frame's edge … 1 on their places on the table (a step tweens them, 0.6 s). */
  meter: number;
  scope: number;
  /** Jump to the state without the filament's and the slider's ramps (deep links). */
  snap(): void;
  update(dt: number, t: number): void;
}

/** Apply `tame()` to every lit K material below `root` (call again after adding things to the bench). */
export function tameAll(root: Group): void {
  root.traverse((o) => {
    const material = (o as Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      if (m instanceof KToonMaterial) tame(m);
    }
  });
}

/** Subject scale of the environment: the circuit's 3.6 grown with the base (8.4 against 6.6). */
const ENV_SCALE = 4.6;

export function mountBench(ctx: ChapterContext): Bench {
  const group = new Group();
  group.name = 'electronics-bench';
  ctx.root.add(group);
  ctx.env.setScale(ENV_SCALE);
  ctx.post.base(STAGE_POST.stand);
  const room = createRoom(ctx);
  const base = createBase();
  group.add(room.group, base.group);

  const layout = createLayout();
  const board = createBoardView(ctx, layout);
  board.group.position.set(PLACES.breadboard.x, PLACES.breadboard.height, PLACES.breadboard.z);
  const props = createProps();
  base.frame.add(board.group, props.onBase);
  group.add(props.onTable);
  const tools = createTools(ctx, base.frame);
  const air = createAir(ctx);
  group.add(air.motes);
  tameAll(group);
  const light = createLight(ctx, props.filament);
  ctx.env.setShadow({ extent: 7.2, center: [0, 0.8, 0.3], softness: 4 });

  // on a phone the scene shows the field of sockets only: every shot of the bench is `phone` there (VISUAL §9)
  let phone = ctx.device.formFactor === 'phone';
  ctx.camera.shots(benchShots(phone));
  ctx.onResize(() => {
    const now = ctx.device.formFactor === 'phone';
    if (now === phone) return;
    phone = now;
    ctx.camera.shots(benchShots(phone));
  });

  let glow = 0;
  let slider = 0;
  let time = 0;
  const unit = (v: number): number => Math.min(Math.max(v, 0), 1);
  const lampWorld = new Vector3();
  const apply = (): void => {
    light.set({ glow, moon: bench.moon, ambient: bench.ambient });
    const room = Math.min(1, 0.25 + 0.75 * Math.max(bench.moon, glow ** 2));
    // the slider shows in the dark by its own faint glow and hands over to the room's light
    props.slider.setGlow(1 - Math.max(bench.moon, light.output));
    props.setSwitch(slider);
    props.place(bench.meter, bench.scope);
    props.filament.getWorldPosition(lampWorld);
    air.set(lampWorld, light.lamp.color, light.output ** 1.5);
    tools.set({ use: bench.lens, target: bench.lensTarget, dive: bench.dive, call: bench.lensCall }, time);
    board.update(ctx.camera.camera, room);
  };

  const bench: Bench = {
    group,
    room,
    base,
    light,
    layout,
    board,
    props,
    tools,
    ambient: BENCH_AMBIENT,
    moon: 1,
    lamp: 0,
    closed: 0,
    lens: 0,
    lensTarget: null,
    lensCall: 0,
    dive: 0,
    meter: 0,
    scope: 0,
    snap() {
      glow = unit(bench.lamp);
      slider = unit(bench.closed);
      apply();
    },
    update(dt, t) {
      time = t;
      // a small filament heats in a few hundredths of a second and cools a little slower
      const to = unit(bench.lamp);
      glow = damp(glow, to, to > glow ? 16 : 9, dt);
      if (Math.abs(glow - to) < 1e-3) glow = to;
      slider = damp(slider, unit(bench.closed), 22, dt);
      apply();
    },
  };

  // QA: the things of the bench by name (the sockets are the board's own, `socket:<id>`) and
  // `__app.read('electronics-bench')` — what the board draws and what the last frame cost
  ctx.qa.probe('bench:lamp', props.filament);
  ctx.qa.probe('bench:lens', tools.lens.ring);
  ctx.qa.probe('bench:meter', props.meter);
  ctx.qa.probe('bench:scope', props.scope);
  ctx.qa.expose('electronics-bench', () => ({
    sockets: board.mouths.count,
    rows: layout.rows.length,
    drawCalls: ctx.renderer.info.render.calls,
    print: board.print.filter((t) => t.visible).length,
    phone,
  }));
  bench.snap();
  return bench;
}
