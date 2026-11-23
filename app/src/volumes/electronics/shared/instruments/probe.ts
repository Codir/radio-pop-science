/**
 * A probe of the bench's multimeter (docs/volumes/electronics/VISUAL.md §5.1, §6). Copied from the probe and its lead
 * of `circuit/shared/stage/tools/gauge.ts` (shared/README.md, «Копії»): the same parts along +y from the tip — a steel
 * needle, a guard, the coloured handle, a dark cap — at the bench's size (the needle 0.25, the handle 0.9), and the
 * lead a `DynTube` through a few points rounded by `G.roundPath`. What changed: the tip is a `Leg` of the hand (in a
 * socket, lying on the base, in the hand, at rest by the meter), the lead runs from the meter's jack, and the gauge's
 * scale, needle and number are not taken: the bench's meter is digital and its number is in the step's panel.
 *
 * A probe takes no socket of the board: its socket is its own (`socket`), and it goes into any socket — one a leg or a
 * plug is in too, touching the top of what is there — but the other probe's. The multimeter's are red (`coral`) and
 * black (`ink`) as a real meter's (plan decision 9); the oscilloscope's have an `ink` handle with a ring of their
 * channel's colour (`lime`, `magenta`: VISUAL §5.2) and an `ink` lead. Its grip is the hand's `cyan` capsule on the
 * handle (`hand/grips.ts`).
 *
 * Board frame: the tip, the body and the lead live in the breadboard's group; the meter tells it every frame where its
 * jack is, which way is up and where its rest is.
 *
 * An instrument's two probes are a pair (`createProbePair`): the multimeter's and the oscilloscope's take the same one
 * with their own table of places — where each lead leaves the case, where each probe rests on the table and on a
 * phone — so the way a pair follows its case, leaves with it and is put by a step is written once.
 */
import { Group, Mesh, Quaternion, Vector3, type Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder, G } from '@/kit';
import { K, type ColorLike } from '@/style';
import type { BoardLayout, SocketId } from '@electronics/sim/board';
import { DynTube, resample } from '../bench/dyn-tube';
import { Leg, type LegWorld, type Place, type ProbeEnd } from '../hand';

/** A probe's colours: its handle (and lead) and the guard's ring by the needle; one colour is both. */
export type ProbeColors = ColorLike | { readonly handle: ColorLike; readonly ring: ColorLike };
const colorsOf = (c: ProbeColors): { handle: ColorLike; ring: ColorLike } =>
  typeof c === 'object' && c !== null && 'handle' in c ? c : { handle: c, ring: c };

/** The probe along its axis from the tip (VISUAL §5.1): the needle, the guard, the handle, the cap. */
export const PROBE = {
  needle: 0.25,
  needleRadius: 0.018,
  guard: 0.04,
  guardRadius: 0.075,
  handle: 0.9,
  radius: 0.055,
  cap: 0.06,
} as const;
/** From the tip to the back, where the lead goes in. */
export const PROBE_LENGTH = PROBE.needle + PROBE.guard + PROBE.handle + PROBE.cap;
/** The lead: its radius (VISUAL §5.1) and how far the tip reaches from the jack in plan — from the meter on the table
 * to the farthest socket of the board (`+17`, ≈ 8.5) and a little more. */
export const PROBE_LEAD = { radius: 0.035, reach: 9 } as const;
/** The middle of the hand's capsule on the handle, from the tip. */
const GRIP_AT = PROBE.needle + PROBE.guard + 0.3;
/**
 * How the probe stands in a socket and in the hand (board frame): leaning toward its meter on the left and a little
 * toward the reader, as a hand holds it.
 */
export const STANDING = new Vector3(-0.55, 1, 0.25).normalize();
/** Where the tip touches the top of a leg or a plug in the same socket (board frame, from the mouth). */
const TOUCH = new Vector3(0, 0.07, 0.07);

const UP = new Vector3(0, 1, 0);

export interface Probe<N extends string = string> extends ProbeEnd {
  readonly name: N;
  /** The needle, the guard, the handle and the cap (board frame). */
  readonly body: Group;
  /** The lead from the jack. */
  readonly wire: Mesh;
  /** Where it rests by its meter (board frame): the meter moves it every frame. */
  readonly rest: Place;
  /** 0 lying … 1 upright (in a socket, in the hand). */
  readonly up: number;
  /** Put the tip into the socket at once, or back to rest (a step's, a deep link's). */
  put(socket: SocketId | null): void;
  /**
   * Every frame, before the hand: `jack` (where the lead leaves the meter) and `jackUp` (world up) in the board frame;
   * `restAt` / `restAxis` — the tip and the lying direction at rest. Then the tip travels, the body and the lead follow.
   */
  update(dt: number, pose: ProbePose): void;
  dispose(): void;
}

export interface ProbePose {
  readonly jack: Vector3;
  readonly jackUp: Vector3;
  readonly restAt: Vector3;
  readonly restAxis: Vector3;
  /** The meter is on its place (it may be taken). */
  readonly ready: boolean;
  readonly shown: boolean;
}

export interface ProbeWorld extends LegWorld {
  /** A leg or a plug is in this socket: the tip touches its top. */
  taken(socket: SocketId): boolean;
  /** Where the probe may lie when let go (board frame, plan): over the base's face. */
  lies(x: number, z: number): boolean;
  /** The other probe's socket, which this one never takes. */
  other(): SocketId | null;
  /** The tip has arrived in a socket, or left it (null): the instrument's own record of where its probes are. */
  seated(socket: SocketId | null): void;
}

/** The probe's body along +y from the tip at the origin (copied in its shape from the gauge's `buildProbe`). */
function buildProbe(name: string, colors: { handle: ColorLike; ring: ColorLike }): Group {
  const b = new Builder(`probe-${name}`);
  const { needle, needleRadius, guard, guardRadius, handle, radius, cap } = PROBE;
  b.cyl(needleRadius, needle, { at: [0, 0, 0], axis: 'y', seg: 10, slot: 'metal', c: ['steel', 'mist'], bevel: 0.006 });
  b.cyl(guardRadius, guard, { at: [0, needle, 0], axis: 'y', seg: 16, c: colors.ring, bevel: 0.012 });
  b.cyl(radius, handle, { at: [0, needle + guard, 0], axis: 'y', seg: 16, slot: 'gloss', c: colors.handle, bevel: 0.02 });
  b.cyl(radius * 0.8, cap, { at: [0, needle + guard + handle, 0], axis: 'y', seg: 12, c: 'ink', bevel: 0.015 });
  const group = b.build().group;
  group.name = `probe:${name}`;
  group.traverse((o) => void ((o as Mesh).isMesh && ((o.castShadow = false), (o.receiveShadow = true))));
  return group;
}

/** A probe `name` of its instrument, its tip reaching `reach` from its jack in plan (the multimeter's by default). */
export function createProbe<N extends string>(
  name: N,
  color: ProbeColors,
  world: ProbeWorld,
  reach: number = PROBE_LEAD.reach,
): Probe<N> {
  const colors = colorsOf(color);
  const restAt = new Vector3();
  const restAxis = new Vector3(0, 0, 1);
  const rest: Place = { kind: 'rest', at: restAt };
  // the tip's place: a socket's mouth, or the top of what is in it already
  const tipWorld: LegWorld = {
    socket: (id, out) => {
      world.socket(id, out);
      return world.taken(id) ? out.add(TOUCH) : out;
    },
    ground: (x, z) => world.ground(x, z),
  };
  const leg = new Leg(tipWorld, rest);
  const body = buildProbe(name, colors);
  const tube = new DynTube(30, 8);
  const wire = new Mesh(tube.geometry, K.toon({ color: colors.handle, gloss: 0.4, highlight: 0.4 }));
  wire.name = `probe-lead:${name}`;
  wire.castShadow = false;
  wire.receiveShadow = true;
  wire.frustumCulled = false;

  const from = new Vector3();
  const axis = new Vector3();
  const lying = new Vector3();
  const tmp = new Vector3();
  const toward = new Vector3();
  const q = new Quaternion();
  const pts = Array.from({ length: 5 }, () => new Vector3());
  const path: Vector3[] = [];
  const jackUp = new Vector3(0, 1, 0);
  /** The lead's ends and the probe's axis when the lead was last shaped (never yet: NaN). */
  const last = new Float64Array(9).fill(Number.NaN);
  let socket: SocketId | null = null;
  let ready = false;
  let up = 0;

  /** The axis from the tip to the back now: lying (on the base toward its lead; at rest as the meter lays it) or
   * standing, blended by `up`. */
  const axisNow = (out: Vector3): Vector3 => {
    if (leg.place.kind === 'rest') lying.copy(restAxis);
    else lying.copy(leg.out).setY(0).normalize();
    return out.copy(lying).lerp(STANDING, up).normalize();
  };

  const probe: Probe<N> = {
    name,
    leg,
    from,
    reach,
    body,
    wire,
    rest,
    get up() {
      return up;
    },
    get socket() {
      return socket;
    },
    gripAt(out) {
      return out.copy(leg.pos).addScaledVector(axisNow(tmp), GRIP_AT);
    },
    gripAxis(out) {
      return axisNow(out);
    },
    ready: () => ready,
    seat(s) {
      socket = s;
      world.seated(s);
    },
    takes: (s) => s !== world.other(),
    drop(at) {
      if (!world.lies(at.x, at.z)) return rest;
      const out = from.clone().sub(at).setY(0);
      if (out.lengthSq() < 1e-9) out.set(-1, 0, 0);
      return { kind: 'lie', at: at.clone(), out: out.normalize() };
    },
    put(s) {
      probe.seat(s);
      leg.go(s === null ? rest : { kind: 'socket', socket: s }, 0);
    },
    update(dt, pose) {
      from.copy(pose.jack);
      jackUp.copy(pose.jackUp);
      restAt.copy(pose.restAt);
      restAxis.copy(pose.restAxis);
      ready = pose.ready;
      body.visible = wire.visible = pose.shown;
      // the tip travels; out of the hand and out of a socket its direction is toward the jack
      leg.update(dt, from);
      const upright = leg.place.kind === 'socket' || leg.place.kind === 'hand' ? 1 : 0;
      up = dt > 0 ? damp(up, upright, 14, dt) : upright;
      if (Math.abs(upright - up) < 1e-3) up = upright;
      axisNow(axis);
      body.position.copy(leg.pos);
      body.quaternion.copy(q.setFromUnitVectors(UP, axis));
      // the lead: up out of the jack and already toward the probe (a straight rise would curl, seen from above), over
      // in a gentle arch, into the probe's back along its axis
      const back = tmp.copy(leg.pos).addScaledVector(axis, PROBE_LENGTH);
      // rebuilt only when its ends moved: a still probe costs nothing
      let moved = false;
      [from, back, axis].forEach((v, i) => {
        for (let k = 0; k < 3; k++) {
          const x = v.getComponent(k);
          if (!(Math.abs(x - last[3 * i + k]!) <= 1e-6)) moved = true;
          last[3 * i + k] = x;
        }
      });
      if (!moved) return;
      pts[4]!.copy(back);
      pts[3]!.copy(back).addScaledVector(axis, 0.3);
      toward.copy(pts[3]!).sub(from);
      toward.addScaledVector(jackUp, -toward.dot(jackUp));
      if (toward.lengthSq() > 1e-9) toward.normalize();
      pts[0]!.copy(from);
      pts[1]!.copy(from).addScaledVector(jackUp, 0.14).addScaledVector(toward, 0.12);
      const chord = pts[1]!.distanceTo(pts[3]!);
      pts[2]!.lerpVectors(pts[1]!, pts[3]!, 0.5).addScaledVector(jackUp, 0.08 + 0.1 * chord);
      resample(G.roundPath(pts, 0.3, 6), tube.rings, path);
      tube.update(path, jackUp, (_i, out) => {
        out[0] = PROBE_LEAD.radius;
        out[1] = PROBE_LEAD.radius;
      });
    },
    dispose() {
      tube.geometry.dispose();
      (wire.material as { dispose(): void }).dispose();
      body.traverse((o) => void ((o as Mesh).isMesh && (o as Mesh).geometry.dispose()));
      body.removeFromParent();
      wire.removeFromParent();
    },
  };
  return probe;
}

/** Where an instrument's probes meet the bench. */
export interface ProbePairWorld {
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

/**
 * An instrument's places for its probes: where each lead leaves the case and where each probe rests on the table —
 * the tip, and the way it lies (x, z) — in the case's frame (the origin on the table under the middle of the case,
 * +z toward the reader); on a phone, where each tip rests on the base in front of the board (base frame), the probe
 * lying along the board with its handle to the left (VISUAL §9).
 */
export interface ProbePlaces<N extends string> {
  readonly jack: Readonly<Record<N, readonly [number, number, number]>>;
  readonly rest: Readonly<
    Record<N, { readonly x: number; readonly z: number; readonly axis: readonly [number, number] }>
  >;
  readonly phoneRest: Readonly<Record<N, { readonly x: number; readonly z: number }>>;
}

export interface ProbePairOptions<N extends string> {
  /** The instrument's name, for its leads' group and its errors (`meter`, `scope`). */
  readonly what: string;
  /** Its two probes: each never takes the other's socket. */
  readonly names: readonly N[];
  readonly colors: Readonly<Record<N, ProbeColors>>;
  readonly places: ProbePlaces<N>;
  /** How far a tip reaches from its jack in plan (the multimeter's by default). */
  readonly reach?: number;
}

/** An instrument's two probes and their leads (board frame), and where their tips are. */
export interface ProbePair<N extends string> {
  /** The probes' bodies and leads, in the board's group; an instrument may add its own leads to it. */
  readonly leads: Group;
  readonly probes: ReadonlyMap<N, Probe<N>>;
  /** Where each tip is: the instrument's record, written by a probe as it arrives in a socket or leaves it. */
  readonly sockets: Readonly<Record<N, SocketId | null>>;
  /** A step puts the tips into sockets at once, or back to rest (null); a socket the board has not is a RangeError. */
  put(at: Partial<Record<N, SocketId | null>>): void;
  /**
   * Every frame, before the hand: the probes follow the case `body` (`shown` 0 away … 1 on its place). A probe the
   * hand does not hold (`busy`) goes to rest when the hand let it go of mid-way (a step reset the hand) or when the
   * case leaves; each is told where its jack and rest are in the board's frame — on a phone, its rest on the base,
   * where it comes with the case. Returns whether the case stands on its place.
   */
  follow(dt: number, body: Object3D, shown: number, busy: (name: N) => boolean): boolean;
  /** Jump: the tips where they belong. */
  snap(): void;
  dispose(): void;
}

/** A pair of probes of an instrument (the multimeter's, the oscilloscope's), with its own places. */
export function createProbePair<N extends string>(
  world: ProbePairWorld,
  opts: ProbePairOptions<N>,
): ProbePair<N> {
  const { what, names, colors, places } = opts;
  const leads = new Group();
  leads.name = `${what}-leads`;
  world.frame.add(leads);
  if (names.length !== 2 || names[0] === names[1])
    throw new RangeError(`${what}: a pair of probes, not ${names.join(', ')}`);
  const sockets = Object.fromEntries(names.map((n) => [n, null])) as Record<N, SocketId | null>;
  const probes = new Map<N, Probe<N>>();
  for (const [k, name] of names.entries()) {
    const other = names[1 - k]!;
    const pw: ProbeWorld = {
      socket: (id, out) => world.socket(id, out),
      ground: (x, z) => world.ground(x, z),
      taken: (id) => world.taken(id),
      lies: (x, z) => world.onBase(x, z),
      other: () => sockets[other],
      // the probe's socket is the instrument's record: what it reads, and what it records, use it
      seated: (s) => (sockets[name] = s),
    };
    const p = createProbe(name, colors[name], pw, opts.reach);
    leads.add(p.body, p.wire);
    probes.set(name, p);
  }

  let shownWas = 0;
  const jackWorld = new Vector3();
  const restWorld = new Vector3();
  const phoneRest = new Vector3();
  const unFrame = new Quaternion();
  /** A phone's probes lie along the board, the handles toward the left (board frame). */
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

  return {
    leads,
    probes,
    sockets,
    put(at) {
      for (const [name, s] of Object.entries(at) as [N, SocketId | null | undefined][]) {
        if (s === undefined || !probes.has(name)) continue;
        if (s !== null && world.layout.socket(s) === undefined) {
          throw new RangeError(`${what}.put: the board has no socket ${s}`);
        }
        probes.get(name)!.put(s);
      }
    },
    follow(dt, body, shown, busy) {
      const k = Math.min(Math.max(shown, 0), 1);
      // leaving: the tips the hand does not hold come out of their sockets and go with the case
      const leaving = k < shownWas - 1e-6;
      shownWas = k;
      body.updateWorldMatrix(true, true);
      world.frame.updateWorldMatrix(true, false);
      const phone = world.phone();
      pose.ready = k >= 1 - 1e-3;
      pose.shown = k > 1e-3;
      // world directions into the board's frame: its turn undone (a case on the table is never turned)
      world.frame.getWorldQuaternion(unFrame).invert();
      pose.jackUp.set(0, 1, 0).applyQuaternion(unFrame);
      for (const [name, p] of probes) {
        // a probe the hand let go of mid-way (a step reset the hand) or which leaves with the case: to rest
        if (!busy(name) && (p.leg.place.kind === 'hand' || (leaving && p.leg.place.kind !== 'rest'))) {
          p.seat(null);
          p.leg.go(p.rest, 0.3, 0.3);
        }
        const j = places.jack[name];
        body.localToWorld(jackWorld.set(j[0], j[1], j[2]));
        world.frame.worldToLocal(pose.jack.copy(jackWorld));
        const r = places.rest[name];
        body.localToWorld(restWorld.set(r.x, PROBE.radius, r.z));
        world.frame.worldToLocal(pose.restAt.copy(restWorld));
        // the lying direction on the table (world), in the board's frame
        pose.restAxis.set(r.axis[0], 0, r.axis[1]).normalize().applyQuaternion(unFrame);
        if (phone) {
          // on the base in front of the board, the handle to the left; it comes there with the case
          const pr = places.phoneRest[name];
          world.fromBase(pr.x, PROBE.radius, pr.z, phoneRest);
          pose.restAt.lerp(phoneRest, smooth(k));
          pose.restAxis.lerp(ALONG, smooth(k)).normalize();
        }
        p.update(dt, pose);
      }
      return pose.ready;
    },
    snap() {
      for (const p of probes.values()) p.leg.snap();
    },
    dispose() {
      for (const p of probes.values()) p.dispose();
      leads.removeFromParent();
    },
  };
}
