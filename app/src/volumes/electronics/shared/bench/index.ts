/**
 * The bench of the volume «Радіоелектроніка» (docs/volumes/electronics/VISUAL.md §2, §3, §4, §6, §7, §8): the dark
 * room, the base with the breadboard, the light, the magnifier in its holder, the permanent things (`props.ts`: the
 * battery, the player, the speaker and the lamp with their real marks; the instruments still stand-ins) with their
 * wires and plug leads (`fixed.ts`), the battery's switch under the hand (`switch.ts`), the tray of parts and the
 * reader's hand (`shared/hand`), and the parts on the board, which stand on their legs (`on-board.ts`). A chapter mounts
 * it once in its scene factory and drives it through plain parameters (shared/README.md, «bench», «hand»). Copied in its shape from
 * `circuit/shared/stage/index.ts` (`mountStage` → `mountBench`; shared/README.md, «Копії»): no flashlight, unfolding,
 * snail, battery cutaway or lamp close-up.
 */
import { Box3, Group, Raycaster, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { KToonMaterial } from '@/style';
import type { Text3D } from '@/text';
import {
  createBoardState,
  createLayout,
  netlistOf,
  place,
  remove,
  seatLead,
  setSetting,
  type BoardLayout,
  type BoardState,
  type Orientation,
  type SocketId,
} from '@electronics/sim/board';
import { createHands, createTerrain, createTray, type Hands, type Raised, type Tray } from '../hand';
import type { PartEye, PartView } from '../parts';
import { createAir } from './air';
import { createBase, type Base } from './base';
import { createBoardView, type BoardView } from './board-view';
import { PLUG, createFixed, type Fixed } from './fixed';
import { PLACES } from './layout';
import { BENCH_AMBIENT, createLight, type LightRig } from './light';
import { tame } from './materials';
import { createMounds } from './mounds';
import { createPartsOnBoard, type PartsOnBoard } from './on-board';
import { createProps, type Props } from './props';
import { createRoom, type Room } from './room';
import { STAGE_POST, benchShots } from './shots';
import { switchPart, type SwitchPart } from './switch';
import { createTools, type BenchTools, type LensPose } from './tools';

export { BOARD, LAMP, LENS, PLACES, SWITCH } from './layout';
export { BOARD_Y } from './base';
export { BOARD_LOOK, type BoardView } from './board-view';
export { BENCH_AMBIENT, filamentColor, type LightRig } from './light';
export { LEAD, LEADS, PLUG, type Fixed, type LeadView } from './fixed';
export { type PartsOnBoard } from './on-board';
export { type SwitchPart } from './switch';
export { AWAY, type Props } from './props';
export { STAGE_FOV, STAGE_POST, STAGE_SHOTS, benchShots, boardToWorld, type BenchShot } from './shots';
export { holderPose, overPose, worldDirToBoard, worldToBoard, type BenchTools, type LensPose } from './tools';
// what the sandbox (`_dev`, which may import only `shared/**`) needs of the board as data
export {
  BOARD_SPEC,
  createLayout,
  netlistOf,
  type BoardLayout,
  type BoardState,
  type Orientation,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';
export { PARTS } from '@electronics/sim/core';
// and of the hand: its numbers, keys and policy
export {
  HOVER,
  LIFT,
  NEAR,
  SEAT_SECONDS,
  SNAP,
  trayLabel,
  type HandKey,
  type HandPolicy,
  type Hands,
  type Tray,
} from '../hand';

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
  /** What stands in which socket (`sim/board`): `preset` and `clear` here, and the reader's hand (`hands`). */
  readonly state: BoardState;
  /** The parts on the board in 3D (`shared/parts`), standing on their legs, which follow `state` every frame. */
  readonly parts: PartsOnBoard;
  /** The permanent things: the battery box with the switch, the player, the speaker, the lamp (real marks, E2-4);
   * the instruments (stand-ins). */
  readonly props: Props;
  /** The battery's wires and the plug leads of the speaker, the player and the lamp (board frame). */
  readonly fixed: Fixed;
  /** The battery's switch under the reader's hand: a tap flips `closed`. */
  readonly switch: SwitchPart;
  /** The tray of parts on the table: `tray.set([...keys])` stands a step's kinds in it (empty by default). */
  readonly tray: Tray;
  /** The reader's hand: the two gestures, the grips, the cues; `hands.policy` is the step's say. */
  readonly hands: Hands;
  /** The camera flies (the magnifier, a chapter's border): the hand and the switch do nothing (default false). */
  flying: boolean;
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
  /**
   * The battery's switch: 0 open (the thumb pushed to the left, the gap shows) … 1 closed (default 0) — the setting of
   * the model's part `SW` in the board's state; a tap on the slider flips it, a step may set it. The slider follows
   * with its inertia.
   */
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
   * A step's own small circuit: the board holds exactly these parts, at once, and the plugs named in `leads` are in
   * these sockets (null: lying at rest); a plug not named stays where it is. A part or a plug that does not stand
   * where it is put is a RangeError: a preset is the step's data.
   */
  preset(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId | null>>): void;
  /** Takes every part and plug off the board. */
  clear(): void;
  /** Jump to the state without the filament's and the slider's ramps (deep links). */
  snap(): void;
  update(dt: number, t: number): void;
}

/** Whether the renderer draws `o`: a mesh with a visible material (whether it is shown in the tree is the caller's). */
function drawn(o: Object3D): boolean {
  const m = (o as Mesh).material as Material | Material[] | undefined;
  return (o as Mesh).isMesh === true && (Array.isArray(m) ? m : m ? [m] : []).some((x) => x.visible);
}

/** Meshes the renderer draws below `root`: shown in the tree, with a visible material. */
function drawnMeshes(root: Object3D): number {
  let n = 0;
  root.traverseVisible((o) => void (drawn(o) && n++));
  return n;
}

/**
 * Whether the camera sees a print (QA): rays from the camera to the middle of its line and to both ends of it (inset a
 * tenth) meet no drawn mesh before the print — a text does not count, and the face the print lies on is behind it.
 */
function printInSight(
  t: Text3D,
  eye: Vector3,
  covers: readonly Object3D[],
  ray: Raycaster,
  at: Vector3,
): boolean {
  const m = t.metrics;
  const y = (m.top + m.bottom) / 2;
  const inset = (m.right - m.left) * 0.1;
  for (const x of [m.left + inset, (m.left + m.right) / 2, m.right - inset]) {
    at.set(x, y, 0).applyMatrix4(t.matrixWorld);
    const d = at.distanceTo(eye);
    if (d < 1e-6) return false;
    ray.set(eye, at.sub(eye).divideScalar(d));
    ray.near = 0;
    // a millimetre's grace: only what stands clearly in front of the print covers it
    ray.far = Math.max(d - 1e-3, 0);
    if (ray.intersectObjects(covers as Object3D[], false).length > 0) return false;
  }
  return true;
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

/** The board's body in plan (board frame): it runs `left` beyond column 1, `right` beyond column 17 and `beyond`
 * beyond each rail (VISUAL §2). */
function boardArea(layout: BoardLayout): { x0: number; x1: number; z0: number; z1: number } {
  const B = PLACES.breadboard;
  const first = layout.socket('+1')!;
  const last = layout.socket('-17')!;
  return { x0: first.x - B.left, x1: last.x + B.right, z0: first.z - B.beyond, z1: last.z + B.beyond };
}

/**
 * What always stands up for a lead lying loose (board frame, the height of a plug's axis lying over it): the board's
 * body, the battery's box, the player, the speaker, the lamp's foot. The bodies of the parts on the board are added to
 * it frame by frame for the leads (`mounds.ts`).
 */
function raised(area: ReturnType<typeof boardArea>): Raised[] {
  const B = PLACES.breadboard;
  const r = PLUG.radius;
  const at = (x: number, z: number, w: number, d: number, top: number): Raised => ({
    x0: x - B.x - w / 2,
    x1: x - B.x + w / 2,
    z0: z - B.z - d / 2,
    z1: z - B.z + d / 2,
    top: top - B.height + r,
  });
  const { battery: bat, player: pl, speaker: sp, lamp } = PLACES;
  return [
    { ...area, top: r },
    at(bat.x, bat.z, bat.width, bat.depth, bat.height),
    at(pl.x, pl.z, pl.width, pl.depth, pl.height),
    at(sp.x, sp.z, sp.radius * 2, sp.radius * 2, 0.36),
    at(lamp.x, lamp.z, 0.52, 0.52, 0.1),
  ];
}

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
  const area = boardArea(layout);
  // what a loose end drapes over (board frame): the board's body, the battery's box, the things on the base — a part's
  // leg lies on that; a lead also goes over the bodies of the parts standing on the board (synthesis §2.3)
  const ground = raised(area);
  const lying = -PLACES.breadboard.height + PLUG.radius;
  const terrain = createTerrain(lying, () => ground);
  const mounds = createMounds(board.group, ground, PLUG.radius);
  const leadTerrain = createTerrain(lying, () => mounds.list, () => mounds.version);
  const parts = createPartsOnBoard(board, state, terrain.ground);
  board.group.add(parts.group);
  ctx.onDispose(() => parts.dispose());
  const props = createProps();
  base.frame.add(board.group, props.onBase);
  group.add(props.onTable);
  const fixed = createFixed({ socket: (id, out) => board.socketLocal(id, out), ground: leadTerrain.ground }, leadTerrain);
  board.group.add(fixed.group);
  ctx.onDispose(() => fixed.dispose());
  const tray = createTray();
  group.add(tray.group);
  ctx.onDispose(() => tray.dispose());
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

  const hands = createHands(ctx, {
    frame: board.group,
    cues: group,
    layout,
    state,
    parts,
    tray,
    leads: fixed.leads,
    terrain: leadTerrain,
    area,
    flying: () => bench.flying,
    phone: () => phone,
  });
  ctx.onDispose(() => hands.dispose());
  parts.driven = (id) => hands.busy(id);
  const toggle = switchPart(
    ctx,
    props.slider.group,
    () => bench.closed,
    (v) => (bench.closed = v),
    () => !bench.flying && (hands.policy?.take('switch') ?? true) && hands.held === null,
    () => hands.policy?.tooltip?.('switch') ?? '',
  );
  ctx.onDispose(() => toggle.dispose());

  let glow = 0;
  let slider = 0;
  let time = 0;
  const unit = (v: number): number => Math.min(Math.max(v, 0), 1);
  const lampWorld = new Vector3();
  const bounceOffset = new Vector3(...BOUNCE_OFFSET);
  const eye: PartEye = { camera: ctx.camera.camera, aspect: 1, phone, room: 1 };
  /** The parts standing on the board this frame (not carried whole), by their bodies: the leads' mounds. */
  const standing = new Map<string, Object3D>();
  const apply = (dt: number, t: number, snap = false): void => {
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
    eye.camera = ctx.camera.camera;
    eye.aspect = ctx.viewport.aspect;
    eye.phone = phone;
    eye.room = room;
    // the parts and the plugs follow the board's state (what the hand drives, it moves), stand on their legs, and the
    // hand turns what has arrived into the board's state; the prints show where they can be read from this camera
    parts.sync();
    fixed.sync(state, (name) => hands.busyLead(name));
    parts.update(dt, eye);
    standing.clear();
    for (const [id, m] of parts.models) if (m.group.visible && !hands.carried(id)) standing.set(id, m.hit);
    for (const [id, m] of parts.shown) standing.set(`shown:${id}`, m.hit);
    mounds.update(dt, standing, snap);
    fixed.update(dt);
    hands.update(dt, t);
    board.highlight(hands.rows, dt);
    tray.update(dt, eye);
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
    fixed,
    switch: toggle,
    tray,
    hands,
    tools,
    flying: false,
    ambient: BENCH_AMBIENT,
    moon: 1,
    lamp: 0,
    get closed() {
      return state.settings.get('SW') ?? 0;
    },
    set closed(v: number) {
      setSetting(state, 'SW', unit(Number.isFinite(v) ? v : 0));
    },
    lens: 0,
    lensTarget: null,
    lensCall: 0,
    dive: 0,
    meter: 0,
    scope: 0,
    preset(list, leads) {
      hands.reset();
      for (const id of [...state.parts.keys()]) remove(state, id);
      for (const p of list) {
        if (!place(layout, state, { id: p.id, spec: p.spec, anchor: p.at, o: p.o ?? 0 })) {
          throw new RangeError(`bench.preset: ${p.id} (${p.spec}) does not stand at ${p.at}, o ${p.o ?? 0}`);
        }
        if (p.setting !== undefined) setSetting(state, p.id, p.setting);
      }
      for (const [name, socket] of Object.entries(leads ?? {})) {
        if (!fixed.leads.has(name) || !seatLead(layout, state, name, socket)) {
          throw new RangeError(`bench.preset: the plug ${name} does not go into ${socket}`);
        }
      }
      parts.sync();
      fixed.sync(state, () => false);
    },
    clear() {
      hands.reset();
      for (const id of [...state.parts.keys()]) remove(state, id);
      state.leads.clear();
      parts.sync();
      fixed.sync(state, () => false);
    },
    snap() {
      glow = unit(bench.lamp);
      slider = unit(bench.closed);
      hands.snap();
      apply(0, time, true);
    },
    update(dt, t) {
      time = t;
      // a small filament heats in a few hundredths of a second and cools a little slower
      const to = unit(bench.lamp);
      glow = damp(glow, to, to > glow ? 16 : 9, dt);
      if (Math.abs(glow - to) < 1e-3) glow = to;
      slider = damp(slider, unit(bench.closed), 22, dt);
      apply(dt, t);
    },
  };

  // QA: the things of the bench by name (the sockets are the board's own, `socket:<id>`; the parts, their legs, the
  // plugs and the tray's slots are the hand's: `part:R1`, `leg:R1:0`, `tip:R1:0`, `lead:spk+`, `end:spk+`,
  // `tray:resistor-1k`) and `__app.read('electronics-bench')` — what the board draws and what the last frame cost
  ctx.qa.probe('bench:lamp', props.filament);
  ctx.qa.probe('bench:lens', tools.lens.ring);
  ctx.qa.probe('bench:meter', props.meter);
  ctx.qa.probe('bench:scope', props.scope);
  ctx.qa.probe('switch', () => props.slider.group.getWorldPosition(new Vector3()));
  ctx.qa.expose('electronics-bench', () => ({
    sockets: board.mouths.count,
    rows: layout.rows.length,
    drawCalls: ctx.renderer.info.render.calls,
    print: board.print.filter((t) => t.visible).length,
    phone,
  }));
  // `__app.read('electronics-board')` — the board as data: every part with the socket of each leg, the plugs, the
  // settings; which parts have a model, and the models shown outside the circuit; the netlist's key (it changes when
  // the circuit's shape does) and the parts left out with a leg in the air
  ctx.qa.expose('electronics-board', () => {
    const net = netlistOf(layout, state);
    return {
      parts: Object.fromEntries(
        [...state.parts.values()].map((p) => [p.id, { spec: p.spec, legs: [...p.legs] }]),
      ),
      leads: Object.fromEntries(state.leads),
      settings: Object.fromEntries(state.settings),
      models: [...parts.models.keys()],
      shown: [...parts.shown.keys()],
      key: net.key,
      pending: [...net.pending],
    };
  });
  // `__app.read('electronics-hand')` — the hand: what it holds, where a carried end would go, the preview of a carried
  // part, the lit rows, the parts it drives, how often the reader flipped the switch
  ctx.qa.expose('electronics-hand', () => ({
    held: hands.held,
    near: hands.near,
    preview: [...hands.preview],
    rows: Object.fromEntries(board.lit),
    busy: [...parts.models.keys()].filter((id) => hands.busy(id)),
    switchFlips: toggle.flips,
  }));
  // `__app.read('electronics-motion')` — what moves, every frame (world): the camera, the thing the hand moves now or
  // moved last (its leg 0, or its plug), that part's own up (its body's turn against the table), every plug; a check
  // samples it frame by frame for jumps
  const v = new Vector3();
  const up = new Vector3();
  ctx.qa.expose('electronics-motion', () => ({
    camera: ctx.camera.camera.getWorldPosition(v).toArray(),
    focus: hands.focus(v, up).toArray(),
    tilt: up.toArray(),
    plugs: [...fixed.leads.values()].flatMap((l) => {
      board.group.updateWorldMatrix(true, false);
      return board.group.localToWorld(v.copy(l.leg.pos)).toArray();
    }),
  }));
  // `__app.read('electronics-parts')` — every part and permanent thing in 3D: where its body is (world), its draw calls,
  // its print, how much of it is shown, how much of it the camera sees with nothing in front of it, and where it is (the
  // checks look at each one close)
  const things: Readonly<Record<string, PartView>> = {
    battery: props.things.battery,
    player: props.things.player,
    speaker: props.things.speaker,
  };
  const ray = new Raycaster();
  const probe = new Vector3();
  ctx.qa.expose('electronics-parts', () => {
    ctx.root.updateMatrixWorld(true);
    const camera = ctx.camera.camera;
    camera.updateMatrixWorld();
    const eye = camera.getWorldPosition(new Vector3());
    // what can cover a print: every mesh of the scene that is drawn, no text
    const covers: Object3D[] = [];
    ctx.root.traverseVisible((o) => void (drawn(o) && !(o as Text3D).isText3D && covers.push(o)));
    const box = new Box3();
    const entry = (key: string, root: Object3D, body: Object3D, prints: readonly Text3D[]) => {
      box.setFromObject(body);
      const c = box.getCenter(new Vector3());
      const first = prints[0];
      const inSight = prints.map((t) => printInSight(t, eye, covers, ray, probe));
      return {
        key,
        center: c.toArray(),
        radius: box.getSize(new Vector3()).length() / 2,
        drawCalls: drawnMeshes(root),
        prints: prints.length,
        printsShown: prints.filter((t) => t.visible).length,
        // the prints the camera sees with nothing drawn in front of them, and those shown although something covers them
        printsClear: inSight.filter(Boolean).length,
        printsCovered: prints.filter((t, i) => t.visible && !inSight[i]).length,
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
