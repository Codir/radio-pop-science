/**
 * The bench of the volume «Радіоелектроніка» (docs/volumes/electronics/VISUAL.md §2, §3, §4, §5, §6, §7, §8): the dark
 * room, the base with the breadboard, the light, the magnifier in its holder, the permanent things (`props.ts`: the
 * battery, the player, the speaker and the lamp with their real marks) with their wires and plug leads (`fixed.ts`),
 * the battery's switch under the hand (`switch.ts`), the tray of parts and the reader's hand (`shared/hand`), the
 * parts on the board, which stand on their legs (`on-board.ts`), the circuit model that solves what is on the board
 * (`shared/model`), the multimeter that reads it and the oscilloscope that shows it in time (`shared/instruments`,
 * the model in time `shared/model/live.ts`), with the option `sound` the speaker that plays it through the volume's
 * own sound output (`shared/instruments/speaker.ts`), and what the model's state shows: the LEDs' light
 * (`lights.ts`), the lamp lit by its filament, the heat and the burn of every part (`shared/parts/look.ts`), the wisp
 * of a burn and a bulged can's puff of steam (`smoke.ts`). A chapter mounts it once in its scene factory and drives it
 * through plain parameters (shared/README.md, «Mount», «State», «bench», «hand», «model», «instruments»). Copied in
 * its shape from `circuit/shared/stage/index.ts` (`mountStage` → `mountBench`; docs/volumes/electronics/REUSE.md,
 * «Копії»): no flashlight, unfolding, snail, battery cutaway or lamp close-up.
 */
import { Box3, Group, Raycaster, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { K, KToonMaterial } from '@/style';
import type { Text3D } from '@/text';
import {
  BENCH_FIXED,
  createBoardState,
  createLayout,
  netlistOf,
  occupant,
  remove,
  seatPreset,
  setSetting,
  type BoardLayout,
  type BoardState,
  type PresetPart,
  type SocketId,
} from '@electronics/sim/board';
import { PARTS } from '@electronics/sim/core';
import { createHands, createTerrain, createTray, type Hands, type ProbeEnd, type Raised, type Tray } from '../hand';
import {
  createMultimeter,
  createOscilloscope,
  createSpeaker,
  type MeterWorld,
  type Multimeter,
  type Oscilloscope,
  type Speaker,
} from '../instruments';
import { LIVE, createBenchModel, createLive, type BenchModel, type Live } from '../model';
import {
  LED_LOOK,
  heatable,
  lampGlow,
  ledBrightness,
  type LedModel,
  type PartEye,
  type PartLook,
  type PartView,
} from '../parts';
import { createAir } from './air';
import { createBase, type Base } from './base';
import { createBoardView, type BoardView } from './board-view';
import { PLUG, createFixed, type Fixed } from './fixed';
import { BOARD, PLACES } from './layout';
import { BENCH_AMBIENT, createLight, type LightRig } from './light';
import { createLedLights, type LedLights, type LedSource } from './lights';
import { tame } from './materials';
import { createMounds } from './mounds';
import { createPartsOnBoard, type PartsOnBoard } from './on-board';
import { createProps, type Props } from './props';
import { createRoom, type Room } from './room';
import { STAGE_POST, benchShots } from './shots';
import { createSmoke, keeper, type SmokeView } from './smoke';
import { switchPart, type SwitchPart } from './switch';
import { createTools, type BenchTools, type LensPose } from './tools';

export { BOARD, LAMP, LENS, PLACES, SWITCH } from './layout';
export { BOARD_Y } from './base';
export { BOARD_LOOK, type BoardView } from './board-view';
export { BENCH_AMBIENT, filamentColor, type LightRig } from './light';
export { LED_LIGHTS, LED_POWER, LED_RANGE, type LedLights } from './lights';
export { SMOKE, type SmokeView } from './smoke';
export { LEAD, LEADS, PLUG, type Fixed, type LeadView } from './fixed';
export { type PartsOnBoard } from './on-board';
export { type SwitchPart } from './switch';
export { AWAY, type Props } from './props';
export { STAGE_FOV, STAGE_POST, STAGE_SHOTS, benchShots, boardToWorld, type BenchShot } from './shots';
export { holderPose, overPose, worldDirToBoard, worldToBoard, type BenchTools, type LensPose } from './tools';
// what the sandbox (`_dev`, which may import only `shared/**`) needs of the board as data
export {
  AMPLIFIER_IDS,
  AMPLIFIER_PRESET,
  BOARD_SPEC,
  LED_LOOP,
  createLayout,
  netlistOf,
  setSetting,
  type BoardLayout,
  type BoardPreset,
  type BoardState,
  type Orientation,
  type PresetPart,
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

/** What a chapter chooses once, at the mount. */
export interface BenchOptions {
  /**
   * The speaker in sound (E2-10; default false): the bench makes the volume's own sound output (`shared/sound`: an
   * `AudioContext` of its own after the first gesture, none with `?noaudio`) and plays through it what the circuit
   * model gives the speaker `SPK`. The model in time then runs from the mount, paced by that output — the player plays
   * on whether the speaker is in the circuit or not — and the chapter's ambient mood is silent while the speaker is in
   * the circuit (VISUAL §1, principle 3). Without it the bench makes no sound and no `AudioContext`, and the model in
   * time runs only while the oscilloscope is there.
   */
  readonly sound?: boolean;
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
   * the places of the instruments on the table. */
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
  /** The circuit model of what is on the board (`shared/model`): the only way the bench reads the circuit. */
  readonly model: BenchModel;
  /** The LEDs' light on the board: three shadowless point lights the brightest LEDs take (VISUAL §4.4). */
  readonly leds: LedLights;
  /**
   * The wisps in the air (VISUAL §4.8), read-only: the bench alone lets one out, at the moment the model tells a part
   * burnt (none from the lamp: its filament breaks inside the sealed glass); a chapter cannot.
   */
  readonly smoke: SmokeView;
  /** The multimeter on the table: its dial (`mode`), its probes (`put`), its number for the step's panel
   * (`readout`); it comes and goes with `meter`. */
  readonly multimeter: Multimeter;
  /** The oscilloscope on the table: its scale and trigger (`settings`), its probes (`put`), its trace for the step's
   * board (`chart`); it comes and goes with `scope`, and while it is there the model plays the board in time. */
  readonly oscilloscope: Oscilloscope;
  /** The circuit model in time (`shared/model/live.ts`): the board played at 24 000 samples a second for the scope
   * and the speaker. */
  readonly live: Live;
  /** The speaker in sound (the option `sound`), or null: its current through the volume's own sound output. */
  readonly speaker: Speaker | null;
  /**
   * Lift of the unlit room 0…1 (default `BENCH_AMBIENT`): an even cool fill and a stronger moon that step back as
   * the lamp's light rises.
   */
  ambient: number;
  /** Strength of the cold moon 0…1 (default 1). */
  moon: number;
  /**
   * The lamp's filament 0 cold … 1 working white, from the circuit model only (VISUAL §1, principle 3; §4.6): the place
   * of the model's filament temperature on the incandescence scale while the lamp is in the circuit (both plugs in),
   * 0 out of it or burnt; while the model's last solve failed, what it was. Shown with the filament's inertia: it heats
   * in hundredths of a second and cools a little slower (the transient of E1-5 takes that over).
   */
  readonly lamp: number;
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
   * A step's own small circuit — the step's whole bench: the board holds exactly these parts, at once, and the plugs
   * named in `leads` are in these sockets; a plug not named (or named null) lies at rest, so no plug of the board
   * before stands where these parts go. A part or a plug that does not stand where it is put is a RangeError: a preset
   * is the step's data. Every part in it is new and whole: the model forgets what it remembered of the parts taken off
   * (`model.forget`), an old `R1` burnt or warm included.
   */
  preset(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId | null>>): void;
  /** Takes every part and plug off the board; the model forgets the parts at once (`model.forget`). */
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

/** The bench's speaker: the fixed part `SPK` of the netlist, the catalog's `speaker-8`. */
const SPEAKER_PART = BENCH_FIXED.find((f) => f.id === 'SPK')!;

export function mountBench(ctx: ChapterContext, options: BenchOptions = {}): Bench {
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
  // the instruments: their cases in their places on the table, their probes and leads in the board's frame (the hand's)
  const instruments: MeterWorld = {
    frame: board.group,
    layout,
    socket: (id, out) => board.socketLocal(id, out),
    taken: (id) => occupant(state, id) !== null,
    ground: leadTerrain.ground,
    onBase: (x, z) =>
      Math.abs(x + PLACES.breadboard.x) <= BOARD.width / 2 && Math.abs(z + PLACES.breadboard.z) <= BOARD.depth / 2,
    fromBase: (x, y, z, out) => out.set(x - PLACES.breadboard.x, y - PLACES.breadboard.height, z - PLACES.breadboard.z),
    phone: () => phone,
  };
  const multimeter = createMultimeter(instruments);
  props.meter.add(multimeter.body);
  ctx.onDispose(() => multimeter.dispose());
  // the circuit model of what is on the board, the instruments' own parts in it: the meter in the A mode, the scope's
  // inputs of 1 MΩ while its probes are in sockets (`SCOPE_INPUT`)
  const model = createBenchModel({
    layout,
    board: state,
    extra: () => [...multimeter.extra(), ...oscilloscope.extra()],
  });
  // the speaker in sound (the option `sound`): the volume's own output, which paces the model in time
  const spec = PARTS[SPEAKER_PART.spec];
  const speaker =
    options.sound === true && spec?.kind === 'speaker'
      ? createSpeaker(ctx, { rate: LIVE.rate, ohms: spec.ohms, part: SPEAKER_PART.id })
      : null;
  // the oscilloscope and the model in time behind it (one background thread; a held page on the main thread, its
  // window computed at once: `model.still`)
  const frozen = new URLSearchParams(globalThis.location?.search ?? '').has('freeze');
  const live = createLive(ctx, model, {
    frozen,
    // a block's samples after a moment without a solution are the model's zeros: never shown (G7)
    onBlock: (first, samples, steps) =>
      oscilloscope.feed(first, steps < (samples[0]?.length ?? 0) ? samples.map((x) => x.subarray(0, steps)) : samples),
    onRestart: () => oscilloscope.reset(),
    sound: speaker ?? undefined,
  });
  const oscilloscope = createOscilloscope(instruments, LIVE.rate, live.lookahead);
  props.scope.add(oscilloscope.body);
  ctx.onDispose(() => oscilloscope.dispose());
  const tray = createTray();
  group.add(tray.group);
  ctx.onDispose(() => tray.dispose());
  const tools = createTools(ctx, base.frame);
  const air = createAir(ctx);
  group.add(air.motes);
  tameAll(group);
  const light = createLight(ctx, props.filament);
  ctx.env.setShadow({ extent: 7.2, center: [0, 0.8, 0.3], softness: 4 });
  // the LEDs' three lights and the wisps of a burn: made once, with the bench (never a light added or taken away)
  const leds = createLedLights(group);
  ctx.onDispose(() => leds.dispose());
  const smoke = createSmoke();
  group.add(smoke.group);
  ctx.onDispose(() => smoke.dispose());
  // the burnt marks' shader (a Builder's toon with the heat's term, as every part's marks have it) kept compiled for the
  // frame's lights and quality, as the wisp's is: a burn in a shot that draws no such body compiles nothing either
  const marks = keeper(tame(heatable(K.toon({ color: 'white', vertexColors: true, name: 'kit.toon' }))), true, 'marks:keeper');
  group.add(marks);
  ctx.onDispose(() => {
    marks.geometry.dispose();
    (marks.material as KToonMaterial).dispose();
  });

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
    probes: new Map<string, ProbeEnd>([...multimeter.probes, ...oscilloscope.probes]),
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

  /* ---------------------------------------------------- what the circuit model shows (VISUAL §1, principle 3) */

  /** The lamp's filament from the model: in the circuit, its temperature on the scale; out of it or burnt, cold; while
   * the last solve failed, what it was. */
  let lampLevel = 0;
  const lampNow = (): number => {
    if (!model.ok) return lampLevel;
    const s = model.reading('LAMP') !== null ? model.part('LAMP') : null;
    lampLevel = s && s.condition !== 'burnt' ? lampGlow(s.kelvin) : 0;
    return lampLevel;
  };
  /** A part's look from the model: its condition, heat and load, an LED's brightness; null while the last solve
   * failed (the last look holds). */
  const lookOf = (id: string, key: string): Partial<PartLook> | null => {
    const s = model.part(id);
    if (s === null) return null;
    const r = s.condition === 'burnt' ? null : model.reading(id);
    return { status: s.condition, heat: s.heat, load: s.load, light: r ? ledBrightness(key, r.i) : 0 };
  };
  const ledAt = new Vector3();
  const hotBox = new Box3();
  /**
   * Where a part's wisp rises from (world): over the top of its body, the speaker's over its cone. Null: no wisp — the
   * lamp's filament breaks inside its sealed glass (vacuum or inert gas), so nothing leaves the bulb: the broken coil,
   * the greyed top and the dark are the whole event (VISUAL §4.8).
   */
  const hottest = (id: string, out: Vector3): Vector3 | null => {
    const m = parts.models.get(id);
    if (m) {
      hotBox.setFromObject(m.hit);
      return hotBox.getCenter(out).setY(hotBox.max.y);
    }
    if (id === 'LAMP') return null;
    if (id === 'SPK') return props.things.speaker.group.getWorldPosition(out).setY(out.y + 0.4);
    return null;
  };
  const puffAt = new Vector3();
  /** The parts that failed, as the model told it (QA): the id, the bench's time and how — burnt, or a can bulged. */
  const burns: { id: string; t: number; what: 'burnt' | 'bulged' }[] = [];
  /**
   * After the model's sync, every frame: the model's time passes (a part may burn, an electrolytic bulge), and
   * everything shows its state. The moment of either is one puff, once: a wisp of smoke over a burnt part, a puff of
   * steam out of a bulged can's vent (VISUAL §4.8; E1-5's `bulged`).
   */
  const show = (dt: number): void => {
    for (const id of model.advance(dt)) {
      const what = model.part(id)?.condition === 'bulged' ? 'bulged' : 'burnt';
      burns.push({ id, t: time, what });
      if (burns.length > 32) burns.shift();
      const at = hottest(id, puffAt);
      if (at) smoke.puff(at, what === 'bulged' ? 'steam' : 'smoke');
    }
    smoke.update(dt);
    parts.look(dt, lookOf);
    if (!model.ok) return;
    for (const [id, thing] of [
      ['BAT', props.things.battery],
      ['SPK', props.things.speaker],
    ] as const) {
      const look = lookOf(id, '');
      if (look) thing.setLook(look, dt);
    }
    props.bulb.setBurnt(model.part('LAMP')?.condition === 'burnt');
    // the LEDs that give light, for the three point lights of the board
    const sources: LedSource[] = [];
    for (const [id, m] of parts.models) {
      const led = m as LedModel;
      if (!led.halo || !m.group.visible) continue;
      const r = model.part(id)?.condition === 'burnt' ? null : model.reading(id);
      const b = r ? ledBrightness(m.key, r.i) : 0;
      if (b > 0) sources.push({ id, b, color: LED_LOOK[led.color].light, at: led.halo.getWorldPosition(ledAt).clone() });
    }
    leds.set(sources);
  };
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
    // down at a part (the dive's floors): a phone reads its print by the desk's rule (VISUAL §9, its exception)
    eye.close = bench.flying;
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
    multimeter.update(dt, bench.meter, (name) => hands.busyProbe(name));
    oscilloscope.update(dt, bench.scope, (name) => hands.busyProbe(name));
    hands.update(dt, t);
    // the circuit on the board now (what arrived this frame included), the model's time passing in it (heat, a burn),
    // everything showing its state, and what the meter reads of it
    model.sync();
    show(dt);
    multimeter.measure(dt, model, snap);
    // the model in time while the scope is there, and all the time with the speaker (the player plays on): the
    // scope's probes' rows, the board, the blocks; then the sweep shown now — with the speaker, of the sample heard now
    live.taps(oscilloscope.taps());
    live.update(dt, bench.scope > 0 || speaker !== null);
    speaker?.circuit(model.net?.net.parts.some((p) => p.id === SPEAKER_PART.id) ?? false);
    oscilloscope.show(live.now);
    if (frozen) held(dt);
    board.highlight(hands.rows, dt);
    tray.update(dt, eye);
    props.view(eye);
    multimeter.view(eye);
  };

  /**
   * A held page (`?freeze`, plan decision 16): on a frame with no time (dt 0) after anything changed — the board, a
   * setting, a probe, the scale, or time that passed — the scope shows the window `model.still` computes at once: from
   * the operating point, warmed up, then two spans (the first edge within the first). Once per change, as the radio's
   * held frames (`radio/shared/world/index.ts`).
   */
  let moved = true;
  let heldFor = '';
  let stills = 0;
  let stillMs = 0;
  let lastStill = { warmup: Number.NaN, tau: Number.NaN };
  const held = (dt: number): void => {
    if (dt > 0) {
      moved = true;
      return;
    }
    if (bench.scope <= 0 || oscilloscope.settings.display !== 'sweep' || !model.ok) return;
    const taps = oscilloscope.taps();
    const key = JSON.stringify([model.version, taps, oscilloscope.settings, oscilloscope.model.on]);
    if (!moved && key === heldFor) return;
    // cleared before the call: a board the model refuses is not tried again on every held frame
    moved = false;
    heldFor = key;
    const t0 = globalThis.performance?.now() ?? 0;
    const w = model.still({ fs: LIVE.rate, count: 2 * oscilloscope.model.spanSamples, taps });
    stillMs = (globalThis.performance?.now() ?? 0) - t0;
    if (!w) return;
    stills++;
    oscilloscope.hold(w.samples, w.warmup);
    lastStill = { warmup: w.warmup, tau: w.tau };
  };

  /**
   * Every part off the board, the one in the hand too, and the model forgets them at once: a preset puts its list
   * under fixed ids in the same call, with no sync between, so a new `R1` must not inherit an old one's memory. The
   * permanent things start the step whole and cold as well (a lamp burnt in an earlier step lights again): a step's
   * preset is the step's own bench.
   */
  const takeOff = (): void => {
    const gone = [...state.parts.keys()];
    hands.reset();
    for (const id of gone) {
      remove(state, id);
      model.forget(id);
    }
    for (const f of BENCH_FIXED) model.forget(f.id);
    // the model in time starts again from the new board's operating point: its parts new and whole there too
    live.restart();
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
    model,
    multimeter,
    oscilloscope,
    live,
    speaker,
    leds,
    // what is in the air, never `puff`: only `show` lets a wisp out, on the model's event
    smoke: {
      get active() {
        return smoke.active;
      },
      get fired() {
        return smoke.fired;
      },
    },
    flying: false,
    ambient: BENCH_AMBIENT,
    moon: 1,
    get lamp() {
      return lampNow();
    },
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
      takeOff();
      // the plugs too: a preset is the step's whole bench (`seatPreset` seats the parts before the plugs, so a plug of
      // the board before left in a socket would stand where a part's leg goes)
      state.leads.clear();
      seatPreset(layout, state, list, leads, new Set(fixed.leads.keys()));
      parts.sync();
      fixed.sync(state, () => false);
    },
    clear() {
      takeOff();
      state.leads.clear();
      parts.sync();
      fixed.sync(state, () => false);
    },
    snap() {
      // the circuit as it stands now (a step's preset), so that the filament jumps to the model's
      model.sync();
      glow = unit(lampNow());
      slider = unit(bench.closed);
      hands.snap();
      multimeter.snap();
      oscilloscope.snap();
      apply(0, time, true);
    },
    update(dt, t) {
      time = t;
      // a small filament heats in a few hundredths of a second and cools a little slower (the model's last solve)
      const to = unit(lampNow());
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
  // `__app.read('electronics-model')` — the circuit model of the board: the netlist's key, how many solves and compiles,
  // whether the last solve succeeded (and why not), what it cost, the parts left out, every part's reading and the
  // voltage of every row a part uses (the last good solution; nothing of a failed one)
  ctx.qa.expose('electronics-model', () => {
    const used = new Set(model.circuit?.net.parts.flatMap((p) => p.pins) ?? []);
    return {
      key: model.net?.key ?? null,
      version: model.version,
      compiles: model.compiles,
      ok: model.ok,
      failure: model.failure,
      dcMs: model.dcMs,
      iterations: model.solution?.iterations ?? 0,
      issues: model.solution?.issues ?? [],
      pending: [...(model.net?.pending ?? [])],
      parts: model.ok ? { ...model.solution?.parts } : {},
      rows: Object.fromEntries(
        layout.rows.filter((r) => used.has(layout.node(r))).map((r) => [r, model.rowVolts(r)]),
      ),
    };
  });
  // `__app.read('electronics-heat')` — what the model's state shows: every part's condition, heat, load, its LED light
  // and what its surface shows (the heat tint, the scorch, the char), its burnt marks, a can's bulged top; the battery,
  // the speaker and the lamp; the lamp's filament (the model's level, the glow shown, the light's output); the LEDs
  // lighting the board and their lights' intensities; the wisps; the parts that failed as the model told it, with the
  // bench's time and how (burnt, bulged)
  ctx.qa.expose('electronics-heat', () => ({
    ok: model.ok,
    parts: Object.fromEntries(
      [...parts.models].map(([id, m]) => {
        const s = model.part(id);
        const r = model.reading(id);
        return [
          id,
          {
            key: m.key,
            condition: s?.condition ?? null,
            heat: s?.heat ?? null,
            load: s?.load ?? null,
            i: r?.i ?? null,
            light: s && s.condition !== 'burnt' && r ? ledBrightness(m.key, r.i) : 0,
            surface: m.surface,
            marks: m.group.getObjectByName(`${m.key}:burnt`)?.visible ?? false,
            bulged: m.group.getObjectByName(`${m.key}:bulged`)?.visible ?? false,
          },
        ];
      }),
    ),
    things: {
      battery: { ...model.part('BAT'), surface: props.things.battery.surface },
      speaker: { ...model.part('SPK'), surface: props.things.speaker.surface },
      lamp: { ...model.part('LAMP'), burnt: props.bulb.burnt },
    },
    lamp: { level: lampLevel, glow, output: light.output, intensity: light.lamp.intensity },
    leds: { lit: [...leds.lit], intensity: leds.lights.map((l) => l.intensity) },
    lights: (() => {
      let n = 0;
      ctx.root.traverse((o) => void ((o as { isLight?: boolean }).isLight && n++));
      return n;
    })(),
    smoke: { active: smoke.active, fired: smoke.fired },
    burns: burns.map((b) => ({ ...b })),
  }));
  // `__app.read('electronics-meter')` — the multimeter: its dial, where its probes are, the reading now (`live`), what
  // its display shows (`value`, `text`) and how often it refreshed, how far it is on its place, its marks shown
  ctx.qa.expose('electronics-meter', () => ({
    mode: multimeter.mode,
    red: multimeter.sockets.red,
    black: multimeter.sockets.black,
    live: multimeter.live ?? null,
    value: multimeter.value,
    text: multimeter.text,
    unit: multimeter.unit,
    refreshes: multimeter.refreshes,
    shown: bench.meter,
    ready: multimeter.probes.get('red')!.ready(),
    prints: multimeter.prints.texts.filter((t) => t.visible).length,
  }));
  // `__app.read('electronics-scope')` — the oscilloscope: where the model runs in time (`mode`: worker, sync, off), its
  // blocks and their cost, the moment the board and probes now were taken (`since`, s), the sample shown now (s); the
  // scope's display, scale and trigger, its sweeps and holds, every channel's points and their hash (two pages that
  // show the same, the same hash); a held page's windows (how many, their warm-up and τmax, the last one's ms); its
  // probes' sockets; how far it is on its place
  ctx.qa.expose('electronics-scope', () => ({
    mode: live.mode,
    blocks: live.blocks,
    ms: live.ms,
    since: live.since,
    now: live.now === null ? null : live.now / LIVE.rate,
    ...oscilloscope.model.state(),
    frozen,
    stills,
    still: { ...lastStill, ms: stillMs },
    ch1: oscilloscope.sockets.ch1,
    ch2: oscilloscope.sockets.ch2,
    shown: bench.scope,
    ready: oscilloscope.probes.get('ch1')!.ready(),
  }));
  // `__app.read('electronics-sound')` — the speaker in sound (the option `sound`; `on` false without it): the output
  // (its state and clock, blocks played and late, queued, the latency, the gain asked for and applied), where the model
  // runs and what a block costs, the moment the board now was taken (`since`, s) and the sample heard now (s); whether
  // the speaker is in the circuit, its full scale, the blocks it gave, the last blocks' levels as the output got them
  // and the hash of every sample it gave
  ctx.qa.expose('electronics-sound', () => {
    if (speaker === null) return { on: false, mode: live.mode };
    const o = speaker.output;
    return {
      on: true,
      state: o.state,
      clock: o.clock,
      played: o.played,
      underruns: o.underruns,
      queued: o.queued,
      latency: o.latency,
      gain: o.gain,
      gainNow: o.gainNow,
      mode: live.mode,
      rate: LIVE.rate,
      block: LIVE.block,
      ms: live.ms,
      since: live.since,
      heard: live.now === null ? null : live.now / LIVE.rate,
      speaker: speaker.inCircuit,
      fullScale: speaker.fullScale,
      blocks: speaker.blocks,
      levels: speaker.levels.map((l) => ({ ...l })),
      hash: speaker.hash,
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
