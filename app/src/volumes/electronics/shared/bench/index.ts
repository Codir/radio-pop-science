/**
 * The bench of the volume «Радіоелектроніка» (docs/volumes/electronics/VISUAL.md §2, §3, §4, §7, §8): the dark room,
 * the base with the breadboard, the light, the magnifier in its holder, the permanent things (`props.ts`: the battery,
 * the player, the speaker and the lamp with their real marks; the tray and the instruments still stand-ins) and the
 * parts on the board, which follow the board's state (`on-board.ts`). A chapter mounts it once in its scene factory and
 * drives it through plain parameters (shared/README.md, «bench»). Copied in its shape from
 * `circuit/shared/stage/index.ts` (`mountStage` → `mountBench`; shared/README.md, «Копії»): no flashlight, unfolding,
 * snail, battery cutaway or lamp close-up.
 */
import { Box3, Group, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { KToonMaterial } from '@/style';
import type { Text3D } from '@/text';
import {
  createBoardState,
  createLayout,
  place,
  remove,
  setSetting,
  type BoardLayout,
  type BoardState,
  type Orientation,
  type SocketId,
} from '@electronics/sim/board';
import type { PartEye, PartView } from '../parts';
import { createAir } from './air';
import { createBase, type Base } from './base';
import { createBoardView, type BoardView } from './board-view';
import { PLACES } from './layout';
import { BENCH_AMBIENT, createLight, type LightRig } from './light';
import { tame } from './materials';
import { createPartsOnBoard, type PartsOnBoard } from './on-board';
import { createProps, type Props } from './props';
import { createRoom, type Room } from './room';
import { STAGE_POST, benchShots } from './shots';
import { createTools, type BenchTools, type LensPose } from './tools';

export { BOARD, LAMP, LENS, PLACES, SWITCH } from './layout';
export { BOARD_Y } from './base';
export { BOARD_LOOK, type BoardView } from './board-view';
export { BENCH_AMBIENT, filamentColor, type LightRig } from './light';
export { type PartsOnBoard } from './on-board';
export { AWAY, type Props } from './props';
export { STAGE_FOV, STAGE_POST, STAGE_SHOTS, benchShots, boardToWorld, type BenchShot } from './shots';
export { holderPose, overPose, worldDirToBoard, worldToBoard, type BenchTools, type LensPose } from './tools';
// what the sandbox (`_dev`, which may import only `shared/**`) needs of the board as data
export {
  BOARD_SPEC,
  createLayout,
  type BoardLayout,
  type BoardState,
  type Orientation,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';

/** A part a step puts on the board: leg 0 in `at`, turned by `o` (default 0: the legs along the line, to the right). */
export interface PresetPart {
  /** The id on the board: the footprint's letters and a number (`R1`, `LED2`). */
  readonly id: string;
  /** The key of the catalog (`resistor-4k7`). */
  readonly spec: string;
  readonly at: SocketId;
  readonly o?: Orientation;
  /** A pot's setting 0…1. */
  readonly setting?: number;
}

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
  /** What stands in which socket (`sim/board`): `preset` and `clear` here, the hand from E2-5. */
  readonly state: BoardState;
  /** The parts on the board in 3D (`shared/parts`), following `state` every frame. */
  readonly parts: PartsOnBoard;
  /** The permanent things: the battery box with the switch, the player, the speaker, the lamp (real marks, E2-4);
   * the tray and the instruments (stand-ins). */
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
  /**
   * A step's own small circuit: the board holds exactly these parts, at once (the hand's travel is E2-5's). A part
   * that does not stand where it is put is a RangeError: a preset is the step's data.
   */
  preset(parts: readonly PresetPart[]): void;
  /** Takes every part and plug off the board. */
  clear(): void;
  /** Jump to the state without the filament's and the slider's ramps (deep links). */
  snap(): void;
  update(dt: number, t: number): void;
}

/** Meshes the renderer draws below `root`: shown in the tree, with a visible material. */
function drawnMeshes(root: Object3D): number {
  let n = 0;
  root.traverseVisible((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    if ((o as Mesh).isMesh && (Array.isArray(m) ? m : m ? [m] : []).some((x) => x.visible)) n++;
  });
  return n;
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

/**
 * Where the lamp's bounce light hangs, from the filament (world units): above the middle of the lamp's pool, toward
 * the middle of the board and a little higher than the glass. The circuit's offset for its lamp shining all around,
 * (−1.1; 0.5; 0.9), mirrored in x: the bench's lamp stands in the far LEFT corner, the circuit's in the far right.
 */
const BOUNCE_OFFSET = [1.1, 0.5, 0.9] as const;

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
  const state = createBoardState();
  const parts = createPartsOnBoard(board, state);
  board.group.add(parts.group);
  ctx.onDispose(() => parts.dispose());
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
  const bounceOffset = new Vector3(...BOUNCE_OFFSET);
  const eye: PartEye = { camera: ctx.camera.camera, aspect: 1, phone, room: 1 };
  const apply = (dt: number): void => {
    light.set({ glow, moon: bench.moon, ambient: bench.ambient });
    const room = Math.min(1, 0.25 + 0.75 * Math.max(bench.moon, glow ** 2));
    props.bulb.setGlow(light.filament, light.emission, glow, bench.moon);
    // the slider shows in the dark by its own faint glow and hands over to the room's light
    props.slider.setGlow(1 - Math.max(bench.moon, light.output));
    props.setSwitch(slider);
    props.place(bench.meter, bench.scope);
    props.filament.getWorldPosition(lampWorld);
    // the bounce light (shadowless, in `ctx.root`): above the middle of the lamp's pool, every frame
    light.bounce.position.copy(lampWorld).add(bounceOffset);
    air.set(lampWorld, light.lamp.color, light.output ** 1.5);
    tools.set({ use: bench.lens, target: bench.lensTarget, dive: bench.dive, call: bench.lensCall }, time);
    board.update(ctx.camera.camera, room);
    // the parts follow the board's state; the prints show where they can be read from this camera
    parts.sync();
    eye.camera = ctx.camera.camera;
    eye.aspect = ctx.viewport.aspect;
    eye.phone = phone;
    eye.room = room;
    parts.update(dt, eye);
    props.view(eye);
  };

  const bench: Bench = {
    group,
    room,
    base,
    light,
    layout,
    board,
    state,
    parts,
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
    preset(list) {
      for (const id of [...state.parts.keys()]) remove(state, id);
      for (const p of list) {
        if (!place(layout, state, { id: p.id, spec: p.spec, anchor: p.at, o: p.o ?? 0 })) {
          throw new RangeError(`bench.preset: ${p.id} (${p.spec}) does not stand at ${p.at}, o ${p.o ?? 0}`);
        }
        if (p.setting !== undefined) setSetting(state, p.id, p.setting);
      }
      parts.sync();
    },
    clear() {
      for (const id of [...state.parts.keys()]) remove(state, id);
      state.leads.clear();
      parts.sync();
    },
    snap() {
      glow = unit(bench.lamp);
      slider = unit(bench.closed);
      apply(0);
    },
    update(dt, t) {
      time = t;
      // a small filament heats in a few hundredths of a second and cools a little slower
      const to = unit(bench.lamp);
      glow = damp(glow, to, to > glow ? 16 : 9, dt);
      if (Math.abs(glow - to) < 1e-3) glow = to;
      slider = damp(slider, unit(bench.closed), 22, dt);
      apply(dt);
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
  // `__app.read('electronics-board')` — the board as data: every part with the socket of each leg, the plugs, the
  // settings; which parts have a model, and the models shown outside the circuit
  ctx.qa.expose('electronics-board', () => ({
    parts: Object.fromEntries(
      [...state.parts.values()].map((p) => [p.id, { spec: p.spec, legs: [...p.legs] }]),
    ),
    leads: Object.fromEntries(state.leads),
    settings: Object.fromEntries(state.settings),
    models: [...parts.models.keys()],
    shown: [...parts.shown.keys()],
  }));
  // `__app.read('electronics-parts')` — every part and permanent thing in 3D: where its body is (world), its draw calls,
  // its print, how much of it is shown and where (the checks look at each one close)
  const things: Readonly<Record<string, PartView>> = {
    battery: props.things.battery,
    player: props.things.player,
    speaker: props.things.speaker,
  };
  ctx.qa.expose('electronics-parts', () => {
    group.updateMatrixWorld(true);
    const box = new Box3();
    const entry = (key: string, root: Object3D, body: Object3D, prints: readonly Text3D[]) => {
      box.setFromObject(body);
      const c = box.getCenter(new Vector3());
      const first = prints[0];
      return {
        key,
        center: c.toArray(),
        radius: box.getSize(new Vector3()).length() / 2,
        drawCalls: drawnMeshes(root),
        prints: prints.length,
        printsShown: prints.filter((t) => t.visible).length,
        // where the first print is and how tall one em of it is (world), for a look at it close
        printAt: first ? first.getWorldPosition(new Vector3()).toArray() : null,
        printEm: first ? first.fontSize * first.matrixWorld.getMaxScaleOnAxis() : 0,
      };
    };
    return Object.fromEntries([
      ...[...parts.models, ...parts.shown].map(([id, m]) => [id, entry(m.key, m.group, m.hit, m.prints)]),
      ...Object.entries(things).map(([id, t]) => [id, entry(t.name, t.group, t.group, t.prints)]),
      ['lamp', entry('lamp-6v', props.bulb.group, props.bulb.glass, props.bulb.prints)],
    ]);
  });
  bench.snap();
  return bench;
}
