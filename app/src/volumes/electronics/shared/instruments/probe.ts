/**
 * A probe of the bench's multimeter (docs/volumes/electronics/VISUAL.md §5.1, §6). Copied from the probe and its lead
 * of `circuit/shared/stage/tools/gauge.ts` (shared/README.md, «Копії»): the same parts along +y from the tip — a steel
 * needle, a guard, the coloured handle, a dark cap — at the bench's size (the needle 0.25, the handle 0.9), and the
 * lead a `DynTube` through a few points rounded by `G.roundPath`. What changed: the tip is a `Leg` of the hand (in a
 * socket, lying on the base, in the hand, at rest by the meter), the lead runs from the meter's jack, and the gauge's
 * scale, needle and number are not taken: the bench's meter is digital and its number is in the step's panel.
 *
 * A probe takes no socket of the board: its socket is its own (`socket`), and it goes into any socket — one a leg or a
 * plug is in too, touching the top of what is there — but the other probe's. Red (`coral`) and black (`ink`) as a
 * real meter's (plan decision 9); its grip is the hand's `cyan` capsule on the handle (`hand/grips.ts`).
 *
 * Board frame: the tip, the body and the lead live in the breadboard's group; the meter tells it every frame where its
 * jack is, which way is up and where its rest is.
 */
import { Mesh, Quaternion, Vector3, type Group } from 'three';
import { damp } from '@/engine/api';
import { Builder, G } from '@/kit';
import { K, type ColorLike } from '@/style';
import type { SocketId } from '@electronics/sim/board';
import { DynTube, resample } from '../bench/dyn-tube';
import { Leg, type LegWorld, type Place, type ProbeEnd } from '../hand';
import type { ProbeName } from './meter-model';

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

export interface Probe extends ProbeEnd {
  readonly name: ProbeName;
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
function buildProbe(name: ProbeName, color: ColorLike): Group {
  const b = new Builder(`probe-${name}`);
  const { needle, needleRadius, guard, guardRadius, handle, radius, cap } = PROBE;
  b.cyl(needleRadius, needle, { at: [0, 0, 0], axis: 'y', seg: 10, slot: 'metal', c: ['steel', 'mist'], bevel: 0.006 });
  b.cyl(guardRadius, guard, { at: [0, needle, 0], axis: 'y', seg: 16, c: color, bevel: 0.012 });
  b.cyl(radius, handle, { at: [0, needle + guard, 0], axis: 'y', seg: 16, slot: 'gloss', c: color, bevel: 0.02 });
  b.cyl(radius * 0.8, cap, { at: [0, needle + guard + handle, 0], axis: 'y', seg: 12, c: 'ink', bevel: 0.015 });
  const group = b.build().group;
  group.name = `probe:${name}`;
  group.traverse((o) => void ((o as Mesh).isMesh && ((o.castShadow = false), (o.receiveShadow = true))));
  return group;
}

export function createProbe(name: ProbeName, color: ColorLike, world: ProbeWorld): Probe {
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
  const body = buildProbe(name, color);
  const tube = new DynTube(30, 8);
  const wire = new Mesh(tube.geometry, K.toon({ color, gloss: 0.4, highlight: 0.4 }));
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

  const probe: Probe = {
    name,
    leg,
    from,
    reach: PROBE_LEAD.reach,
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
