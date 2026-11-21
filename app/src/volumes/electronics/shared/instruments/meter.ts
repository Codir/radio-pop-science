/**
 * The bench's multimeter (docs/volumes/electronics/VISUAL.md §5.1, plan decisions 7, 8, 9): a digital pocket meter
 * lying on the table on the left, display up, its top away from the reader — a `slate` case with an `ink` face, the
 * display's matt window (no digits, no light: the number is in the step's panel), the dial with its four positions
 * (off, V, A, Ω; the knob turns after the panel's switch in 0.25 s), the two jacks with their `ink` («COM») and `coral`
 * rings, and the red and black probes on their leads (`probe.ts`).
 *
 * What it reads is `meter-model.ts`'s; the circuit is the bench's model driver's (`shared/model`): the meter gives the
 * driver its own part in the A mode (`extra`), and after every sync it reads the driver and refreshes its display as a
 * real meter does. The number reaches the reader only through the step's panel: `readout()`.
 *
 * Frames: the case is built in its own frame (the origin on the table under the middle of the case, +z toward the
 * reader) and the bench slides it in and out on the table (world); the probes and their leads live in the board's
 * frame (the hand's), and the meter tells them every frame where its jacks and their rests are.
 */
import { Group, Quaternion, Vector3, type Object3D } from 'three';
import { Builder } from '@/kit';
import { col } from '@/style';
import type { ReadoutSpec } from '@/hud';
import type { PartInstance } from '@electronics/sim/core';
import type { BoardLayout, SocketId } from '@electronics/sim/board';
import { PLACES } from '../bench/layout';
import { Prints, disposeTree, type PartEye } from '../parts/part';
import type { BenchModel } from '../model';
import {
  METER_MODES,
  PROBE_NAMES,
  UNIT,
  createMeterDisplay,
  meterExtra,
  readMeter,
  type MeterMode,
  type MeterUnit,
  type ProbeName,
  type ProbeSockets,
} from './meter-model';
import { PROBE, createProbe, type Probe, type ProbeWorld } from './probe';

const mix = (a: string, b: string, k: number) => col(a).lerp(col(b), k);

/** The case (VISUAL §5.1, `PLACES.meter`): 1.4 × 2.4 × 0.4. */
const { width: W, depth: D, height: H } = PLACES.meter;
/** The dial: its middle on the face, the knob's radius, where the marks of its positions stand around it. */
export const DIAL = { z: 0.25, radius: 0.32, marks: 0.5, seconds: 0.25 } as const;
/** The knob's turn at each position (radians from «up the face», away from the reader, clockwise seen from above):
 * four positions 45° apart (VISUAL §5.1). */
export const DIAL_ANGLE: Readonly<Record<MeterMode, number>> = {
  off: (-67.5 * Math.PI) / 180,
  V: (-22.5 * Math.PI) / 180,
  A: (22.5 * Math.PI) / 180,
  ohm: (67.5 * Math.PI) / 180,
};
/** The jacks on the face near the reader: black «COM» on the left, red «V Ω A» on the right (case frame). */
const JACK = { z: D / 2 - 0.35, x: { black: -0.3, red: 0.3 } } as const;
/** The probes at rest on the table, right of the case (case frame): the tips away from the reader, the handles toward
 * it; on a phone they rest on the base in front of the board instead (VISUAL §9). */
const REST: Readonly<Record<ProbeName, { x: number; z: number; axis: readonly [number, number] }>> = {
  red: { x: W / 2 + 0.45, z: -0.85, axis: [0.1, 1] },
  black: { x: W / 2 + 0.2, z: -0.75, axis: [0.05, 1] },
};
/**
 * On a phone: lying on the base in front of the board along it, the handles toward the meter (base frame, VISUAL §9:
 * x −2.0 … 1.4, z 2.3 … 2.5) — both on the band's edge nearer the board: on a 360 × 800 phone with the panel at half,
 * z 2.5 puts a grip ≈ 13 px above the panel's top, where the panel's own grab strip takes the touch.
 */
const PHONE_REST: Readonly<Record<ProbeName, { x: number; z: number }>> = {
  red: { x: -2.0 + PROBE.needle + PROBE.guard + PROBE.handle + PROBE.cap, z: 2.3 },
  black: { x: 1.4, z: 2.3 },
};
const COLORS: Readonly<Record<ProbeName, string>> = { red: 'coral', black: 'ink' };

/** Where the probes meet the bench. */
export interface MeterWorld {
  /** The breadboard's group: the probes' frame. */
  readonly frame: Object3D;
  readonly layout: BoardLayout;
  /** A socket's mouth (board frame). */
  socket(id: SocketId, out: Vector3): Vector3;
  /** A leg or a plug is in the socket. */
  taken(id: SocketId): boolean;
  /** The ground a lead lies on (board frame). */
  ground(x: number, z: number): number;
  /** The base's face under this plan point of the board frame (a probe let go there lies there). */
  onBase(x: number, z: number): boolean;
  /** The base frame → the board frame (a phone's rest). */
  fromBase(x: number, y: number, z: number, out: Vector3): Vector3;
  phone(): boolean;
}

export interface Multimeter {
  /** The case on the table (its own frame): the bench slides it in and out (`props.meter`). */
  readonly body: Group;
  /** The probes and their leads (board frame). */
  readonly leads: Group;
  readonly probes: ReadonlyMap<ProbeName, Probe<ProbeName>>;
  /** The dial's position: a step's or the panel's (default `V`). */
  mode: MeterMode;
  /** Where each tip is. */
  readonly sockets: ProbeSockets;
  /** The reading now (`readMeter`), before the display's refresh. */
  readonly live: number | null | undefined;
  /** What the display shows: the SI value (Infinity: «OL», null: «—»), its text, how many times it refreshed. */
  readonly value: number | null;
  readonly text: string;
  readonly refreshes: number;
  readonly unit: MeterUnit | '';
  /** Its marks by the dial («V», «A», «Ω»): shown only where they read (≥ 16 px-equivalent), never on a phone. */
  readonly prints: Prints;
  /** The meter's own part of the board's circuit (the driver's `extra`): a wire between the probes in the A mode. */
  extra(): PartInstance[];
  /** A step puts the tips into sockets at once, or back to rest (null); a socket the board has not is a RangeError. */
  put(at: Partial<Record<ProbeName, SocketId | null>>): void;
  /** The number in the step's panel: a text readout (no count-up, right on a held page). */
  readout(id: string, label: string): ReadoutSpec;
  /** Before the hand, every frame: the probes the hand does not hold follow the meter (`shown` 0 away … 1 on its
   * place), the knob turns, the leads follow the tips. `busy` — the hand drives this probe. */
  update(dt: number, shown: number, busy: (name: ProbeName) => boolean): void;
  /** After the model's sync, every frame: the reading, the display's refresh (`now`: at once, a deep link). */
  measure(dt: number, model: BenchModel, now?: boolean): void;
  view(eye: PartEye): void;
  /** Jump: the knob at its position, the tips where they belong. */
  snap(): void;
  dispose(): void;
}

/** The case: the face, the display's window, the dial's knob and its «off» mark, the jacks (no moving part). */
function buildCase(): Group {
  const b = new Builder('meter');
  b.box(W, H, D, { r: 0.12, c: 'slate' });
  b.box(W - 0.16, 0.02, D - 0.16, { at: [0, H, 0], r: 0.05, c: 'ink' });
  b.box(W - 0.4, 0.02, 0.62, { at: [0, H + 0.01, -D / 2 + 0.5], r: 0.03, slot: 'gloss', c: mix('steel', 'mist', 0.5) });
  b.cyl(DIAL.radius, 0.08, { at: [0, H + 0.01, DIAL.z], seg: 32, c: 'slate', bevel: 0.03 });
  // «off»: a small ring where the knob points when the meter is off (the other positions have printed signs)
  const off = DIAL_ANGLE.off;
  b.ring(0.045, 0.012, {
    at: [Math.sin(off) * DIAL.marks, H + 0.025, DIAL.z - Math.cos(off) * DIAL.marks],
    axis: 'y',
    seg: 20,
    tubeSeg: 6,
    c: 'mist',
  });
  for (const name of PROBE_NAMES) {
    const x = JACK.x[name];
    b.ring(0.09, 0.025, { at: [x, H + 0.03, JACK.z], axis: 'y', seg: 24, tubeSeg: 8, slot: 'gloss', c: COLORS[name]! });
    b.cyl(0.06, 0.02, { at: [x, H + 0.01, JACK.z], seg: 16, c: 'ink' });
  }
  return b.build().group;
}

/** The knob's pointer: a light bar from the middle of the knob toward its edge, turned about +y. */
function buildPointer(): Group {
  const b = new Builder('meter-knob');
  b.box(0.06, 0.03, 0.26, { at: [0, 0, -0.1], r: 0.01, c: 'mist' });
  const group = b.build().group;
  group.name = 'meter-knob';
  group.position.set(0, H + 0.09, DIAL.z);
  return group;
}

export function createMultimeter(world: MeterWorld): Multimeter {
  const body = new Group();
  body.name = 'multimeter';
  body.add(buildCase());
  const pointer = buildPointer();
  body.add(pointer);
  const prints = new Prints();
  for (const mode of ['V', 'A', 'ohm'] as const) {
    const a = DIAL_ANGLE[mode];
    prints.add(body, UNIT[mode], {
      size: 0.13,
      color: 'mist',
      at: [Math.sin(a) * DIAL.marks, H + 0.022, DIAL.z - Math.cos(a) * DIAL.marks],
      rot: [-Math.PI / 2, 0, 0],
    });
  }

  const leads = new Group();
  leads.name = 'meter-leads';
  world.frame.add(leads);
  const sockets: Record<ProbeName, SocketId | null> = { red: null, black: null };
  const probes = new Map<ProbeName, Probe<ProbeName>>();
  for (const name of PROBE_NAMES) {
    const pw: ProbeWorld = {
      socket: (id, out) => world.socket(id, out),
      ground: (x, z) => world.ground(x, z),
      taken: (id) => world.taken(id),
      lies: (x, z) => world.onBase(x, z),
      other: () => sockets[name === 'red' ? 'black' : 'red'],
      // the probe's socket is the meter's record: what the reading and the A mode's wire use
      seated: (s) => (sockets[name] = s),
    };
    const p = createProbe(name, COLORS[name]!, pw);
    leads.add(p.body, p.wire);
    probes.set(name, p);
  }

  const display = createMeterDisplay();
  let mode: MeterMode = 'V';
  let live: number | null | undefined = null;
  let knob = DIAL_ANGLE[mode];
  let turn: { from: number; to: number; t: number } | null = null;
  let shownWas = 0;

  // scratch for the per-frame poses
  const jackWorld = new Vector3();
  const restWorld = new Vector3();
  const phoneRest = new Vector3();
  const unFrame = new Quaternion();
  /** A phone's probes lie along the board, the handles toward the meter on the left (board frame). */
  const ALONG = new Vector3(-1, 0, 0);
  const pose = {
    jack: new Vector3(),
    jackUp: new Vector3(),
    restAt: new Vector3(),
    restAxis: new Vector3(),
    ready: false,
    shown: false,
  };
  const smooth = (x: number): number => x * x * (3 - 2 * x);

  const meter: Multimeter = {
    body,
    leads,
    probes,
    get mode() {
      return mode;
    },
    set mode(m: MeterMode) {
      if (!METER_MODES.includes(m) || m === mode) return;
      mode = m;
      turn = { from: knob, to: DIAL_ANGLE[m], t: 0 };
    },
    sockets,
    get live() {
      return live;
    },
    get value() {
      return display.value;
    },
    get text() {
      return display.text;
    },
    get refreshes() {
      return display.refreshes;
    },
    get unit() {
      return mode === 'off' ? '' : UNIT[mode];
    },
    prints,
    extra: () => meterExtra(world.layout, mode, sockets),
    put(at) {
      for (const [name, s] of Object.entries(at) as [ProbeName, SocketId | null | undefined][]) {
        if (s === undefined || !probes.has(name)) continue;
        if (s !== null && world.layout.socket(s) === undefined) {
          throw new RangeError(`meter.put: the board has no socket ${s}`);
        }
        probes.get(name)!.put(s);
      }
    },
    readout: (id, label) => ({ type: 'readout', id, label, text: () => display.text }),
    update(dt, shown, busy) {
      const k = Math.min(Math.max(shown, 0), 1);
      // the knob: to its position in 0.25 s, eased
      if (turn) {
        turn.t = Math.min(turn.t + Math.max(dt, 0) / DIAL.seconds, 1);
        knob = turn.from + (turn.to - turn.from) * smooth(turn.t);
        if (turn.t >= 1) turn = null;
      }
      pointer.rotation.y = -knob;
      // leaving: the tips the hand does not hold come out of their sockets and go with the meter
      const leaving = k < shownWas - 1e-6;
      shownWas = k;
      body.updateWorldMatrix(true, true);
      world.frame.updateWorldMatrix(true, false);
      const phone = world.phone();
      pose.ready = k >= 1 - 1e-3;
      pose.shown = k > 1e-3;
      // world directions into the board's frame: its turn undone (the case on the table is never turned)
      world.frame.getWorldQuaternion(unFrame).invert();
      pose.jackUp.set(0, 1, 0).applyQuaternion(unFrame);
      for (const p of probes.values()) {
        const name = p.name;
        if (!busy(name)) {
          // a probe the hand let go of mid-way (a step reset the hand) or which leaves with the meter: to rest
          if (p.leg.place.kind === 'hand' || (leaving && p.leg.place.kind !== 'rest')) {
            p.seat(null);
            p.leg.go(p.rest, 0.3, 0.3);
          }
        }
        body.localToWorld(jackWorld.set(JACK.x[name], H + 0.03, JACK.z));
        world.frame.worldToLocal(pose.jack.copy(jackWorld));
        const r = REST[name];
        body.localToWorld(restWorld.set(r.x, PROBE.radius, r.z));
        world.frame.worldToLocal(pose.restAt.copy(restWorld));
        // the lying direction on the table (world), in the board's frame
        pose.restAxis.set(r.axis[0], 0, r.axis[1]).normalize().applyQuaternion(unFrame);
        if (phone) {
          // on the base in front of the board, the handle toward the meter; it comes there with the meter
          const pr = PHONE_REST[name];
          world.fromBase(pr.x, PROBE.radius, pr.z, phoneRest);
          pose.restAt.lerp(phoneRest, smooth(k));
          pose.restAxis.lerp(ALONG, smooth(k)).normalize();
        }
        p.update(dt, pose);
      }
    },
    measure(dt, model, now = false) {
      live = readMeter(world.layout, model, mode, sockets);
      display.update(dt, mode, live, now);
    },
    view(eye) {
      prints.view(eye);
    },
    snap() {
      if (turn) {
        knob = turn.to;
        turn = null;
      }
      pointer.rotation.y = -knob;
      for (const p of probes.values()) p.leg.snap();
    },
    dispose() {
      for (const p of probes.values()) p.dispose();
      leads.removeFromParent();
      body.removeFromParent();
      disposeTree(body);
    },
  };
  meter.snap();
  return meter;
}
