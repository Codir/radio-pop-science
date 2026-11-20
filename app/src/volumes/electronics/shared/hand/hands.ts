/**
 * The reader's hand on the bench (docs/volumes/electronics/VISUAL.md §6), generalised from
 * `circuit/chapters/build/parts/hands.ts` (shared/README.md, «Копії»): there the hand moved six wire ends between six
 * clamps; here it has two gestures over the breadboard's sockets.
 *
 * - Gesture 1 — a whole part, by its body (`part:<id>`), or a new one from a slot of the tray (`tray:<spec>`): the part
 *   leaves its sockets at the press (it is out of the circuit while it is in the hand, not pending) and follows the
 *   hand; over the board it looks for a socket for its leg 0 within `SNAP` (on a touch screen under the point `LIFT` px
 *   above the finger), and when every leg finds a free socket it hangs `HOVER` above them, legs down — the `preview`,
 *   with its rows lit and a cue ring on every socket. Let go there, the legs go down in `SEAT_SECONDS`; the board's
 *   state changes when they have arrived (the click), not at the release. Let go over the board with no place, the part
 *   goes back to where it was; off the board, to its slot in the tray (0.4 s) and is gone. A click (no drag) on a
 *   placed part turns it end for end: lifted 0.2, turned 180° and put back in 0.3 s (when the step allows it).
 * - Gesture 2 — one end, by its grip: a leg of a part (`leg:<id>:<k>`, a ring on an axial part's leg, a tab before a
 *   radial part's body, a capsule on a jumper's end), a plug of a lead (`lead:<name>`), a probe of the multimeter
 *   (`probe:<name>`, a capsule on its handle). The press takes it out of its socket (the part is pending at once); the
 *   hand leads it within its reach (the part's span from its other legs, the lead's length from its thing, the probe's
 *   lead from its jack); within `NEAR` of a socket it may take — a free one; for a probe any but the other probe's,
 *   since a probe touches what is there (VISUAL §5.1) — a cue ring shows there and the row lights (`near`), never the
 *   socket it just left until the hand has gone `AWAY` from it. A part's leg clicks into the nearest such socket within
 *   `SNAP` while the hand still moves (VISUAL §6, «Одна ніжка»); let go with no socket, it goes back where it was (it
 *   never stays in the air on its own). A wire's end — a jumper's, a plug, a probe's — clicks in when it is let go
 *   within `SNAP` of such a socket, and lies where it was let go otherwise (a probe let go off the base goes back to
 *   rest by its meter): it crosses many sockets on its way (a plug always comes from beyond the board's edge), and one
 *   that clicked into the first of them would never reach its row.
 *
 * The circuit's `near` was never set (zero synthesis, gotcha G14); here it is live. Drag events after the hand let go
 * of a thing (a click mid-drag ends the gesture) go to the same press without asking `enabled` again (G11): every
 * handler checks that the thing is still the one held. Nothing is taken while the camera flies (`flying`) or what the
 * step's `policy` does not allow; timers are the frames' own (`update`), ids the board's counter.
 *
 * Board frame: everything the hand computes lies in the board's own frame (`frame` = the breadboard's group); the cue
 * rings live in `cues` (world).
 */
import {
  Box3,
  Group,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { audio } from '@/audio';
import type { ChapterContext, DragInfo, Unsubscribe } from '@/engine/api';
import {
  SNAP,
  canSeat,
  footprintOf,
  nextId,
  put,
  remove,
  seatLead,
  seatLeg,
  type BoardLayout,
  type BoardState,
  type RowId,
  type Shape,
  type SocketId,
  type SocketSpec,
} from '@electronics/sim/board';
import { JUMPER, type PartModel } from '../parts';
import { createCue, type Cue } from './cue';
import { createGrip, gripGeometries, type Grip, type GripKind, type GripSpot } from './grips';
import type { Leg, Place } from './leg';
import type { Terrain } from './terrain';
import { TRAY, type Tray } from './tray';

export { SNAP };

/* ------------------------------------------------------------------------------- the numbers (VISUAL §6) */

/** The socket an end just left takes it back once the hand has gone this far from it (0.5 P). */
export const AWAY = 0.15;
/** Within this of a socket a carried end shows the cue ring there (1.8 · SNAP). */
export const NEAR = 1.8 * SNAP;
/** A leg goes into its mouth in this time, rising by `SEAT_LIFT` on the way. */
export const SEAT_SECONDS = 0.18;
export const SEAT_LIFT = 0.12;
/** A part carried whole hangs this high over the board (over the sockets of its preview, legs down). */
export const HOVER = 0.35;
/** The ring on an axial part's leg: its height above the mouth (the leg bends to the body at 0.18). */
export const RING_Y = 0.14;
/** A radial part's tab: the head's middle this much nearer the reader than the front of the body's box; its sphere's
 * largest radius; the heads of legs one behind the other this far to either side of the legs' axis. */
export const TAB_AHEAD = 0.17;
export const TAB_R = 0.15;
export const TAB_SIDE = 0.15;
/** On a touch screen the carried thing rides this many CSS px above the finger (up the screen); the socket is looked
 * for under that point. With a mouse there is no lift. */
export const LIFT = 48;
/** A click turns a placed part end for end in this time, rising this high. */
export const FLIP = { seconds: 0.3, rise: 0.2 } as const;
/** An end in the hand rides this high above the board (a leg) or the ground (a plug). */
const CARRY = 0.12;
/** A carried part comes to the hand, and moves between previews, in this time: never a jump. */
const FOLLOW = 0.08;
/** The grips stay this long after the pointer has left their part. */
const LINGER = 1.5;
/** The largest radius of a grip's sphere (VISUAL §6). */
const GRIP_R = 0.3;
/** How far a jumper's grip sits from its end along the wire (at most a quarter of the span). */
const JUMPER_GRIP = 0.12;

/* ------------------------------------------------------------------------------------------- the types */

/** What the hand can hold: a whole part, one leg of it, a plug, a probe's tip, a new part from a tray's slot, the
 * battery's switch (a tap). */
export type HandKey =
  | `part:${string}`
  | `leg:${string}:${number}`
  | `lead:${string}`
  | `probe:${string}`
  | `tray:${string}`
  | 'switch';

/** What a step allows (no policy: everything). */
export interface HandPolicy {
  take(k: HandKey): boolean;
  /** May the end click into this socket. */
  seat?(k: HandKey, socket: SocketId): boolean;
  /** May the part come down with its legs in these sockets. */
  place?(k: HandKey, legs: readonly SocketId[]): boolean;
  /** May a click turn the part end for end. */
  flip?(k: HandKey): boolean;
  /** After a thing has arrived: on the board, in the tray, or let go away from any socket. */
  done?(k: HandKey, where: 'board' | 'tray' | 'away'): void;
  /** The name under the pointer. */
  tooltip?(k: HandKey): string;
}

/** A plug lead of a thing off the board (`bench/fixed.ts`). */
export interface LeadEnd {
  readonly name: string;
  readonly leg: Leg;
  /** Where its wire leaves its thing (board frame): the plug reaches `reach` from here, in plan. */
  readonly from: Vector3;
  readonly reach: number;
  /** Where its grip sits now (the plug's sleeve) and the capsule's axis. */
  gripAt(out: Vector3): Vector3;
  gripAxis(out: Vector3): Vector3;
}

/**
 * A probe of an instrument (`shared/instruments/probe.ts`): an end on a lead from its jack, like a plug, but it takes
 * no socket of the board — its own socket is the instrument's (`socket`, `seat`) and it may go into one a leg is in.
 */
export interface ProbeEnd extends LeadEnd {
  /** The socket its tip has arrived in, or null. */
  readonly socket: SocketId | null;
  /** The instrument is on its place: the probe may be taken. */
  ready(): boolean;
  /** Its tip has arrived in the socket, or was taken out (null). */
  seat(socket: SocketId | null): void;
  /** May its tip go into this socket of the board: any one, a taken one too, but the other probe's. */
  takes(socket: SocketId): boolean;
  /** Where it goes when it is let go away from every socket at `at` (board frame): lying there over the base, or
   * back to rest by its instrument. */
  drop(at: Vector3): Place;
}

/** The parts on the board as the hand sees them (`bench/on-board.ts`). */
export interface HandParts {
  readonly models: ReadonlyMap<string, PartModel>;
  /** The legs every part stands on (the hand moves them). */
  readonly legs: ReadonlyMap<string, readonly Leg[]>;
  /** Make the models follow the board's state now. */
  sync(): void;
  /** The body's own glow 0…1 (under the pointer, called). */
  glow(id: string, amount: number): void;
  /** 0 level with the table (in the tray) … 1 in the board's frame. */
  level(id: string, k: number): void;
  /** Where the part's level is now (1 when nothing set it). */
  levelOf(id: string): number;
}

export interface HandsWorld {
  /** The breadboard's group: its local frame is the board's. */
  readonly frame: Object3D;
  /** Where the cue rings go (world). */
  readonly cues: Object3D;
  readonly layout: BoardLayout;
  readonly state: BoardState;
  readonly parts: HandParts;
  readonly tray: Tray;
  readonly leads: ReadonlyMap<string, LeadEnd>;
  /** The probes of the instruments by name (`red`, `black`): their keys are `probe:<name>`. */
  readonly probes?: ReadonlyMap<string, ProbeEnd>;
  readonly terrain: Terrain;
  /** The board's body in plan (board frame): a part let go over it goes back where it was, off it to the tray. */
  readonly area: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
  /** The camera flies (the magnifier, a chapter's border): the hand does nothing. */
  flying(): boolean;
  /** A phone's page: the tray is in the dock, the radial parts' tabs are hidden (VISUAL §9). */
  phone(): boolean;
}

export interface Hands {
  /** What the step allows; null — everything. */
  policy: HandPolicy | null;
  /** The thing in the hand now. */
  readonly held: HandKey | null;
  /** The socket a carried end would click into (within `NEAR`): its cue ring. */
  readonly near: SocketId | null;
  /** The sockets a carried part would take if let go now (empty: none). */
  readonly preview: readonly SocketId[];
  /** The rows lit now: those of the preview, or of `near`. */
  readonly rows: readonly RowId[];
  /** The grip of an end (`leg:R1:1`, `lead:spk+`), when it has one. */
  grip(key: HandKey): Grip | undefined;
  /** A new part in the hand without a drag (the phone's dock): it hangs over the middle of the board, above the
   * tallest part, until the reader takes it (gesture 1). One at a time: a second offer takes the first one away. */
  offer(spec: string): string | null;
  /** The hand drives this part now (carried, travelling, turning, a leg held): its legs are the hand's. */
  busy(id: string): boolean;
  /** The part is off the board whole: in the hand, waiting in the air (`offer`), or on its way to the tray. */
  carried(id: string): boolean;
  /** The plug lead the hand drives now, or which travels. */
  busyLead(name: string): boolean;
  /** The probe the hand drives now, or which travels into a socket. */
  busyProbe(name: string): boolean;
  /** Where the thing the hand moves now, or moved last, is (world): the checks' motion reader. `up`, when given, gets
   * the world direction of that part's own up — its turn against the table (a plug's focus leaves it as it was). */
  focus(out: Vector3, up?: Vector3): Vector3;
  /** Every travel at its end at once (deep links). */
  snap(): void;
  /** Let go of everything at once, nothing arriving (a step puts its own board: `bench.preset`, `bench.clear`). */
  reset(): void;
  /** After the legs moved this frame: arrivals change the board, the grips and the cues follow. */
  update(dt: number, t: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------------------------------- the grips */

const ease = (x: number): number => x * x * (3 - 2 * x);

/** The grip of every leg a part can move on its own, before its neighbours are counted (VISUAL §6): a ring on an
 * axial part's leg, a tab before a radial part's body, a capsule on a jumper's end; none for the legs that move only
 * together (a pot, a transistor). `tips` are where the legs stand now (the model's parent frame), the model fitted
 * on them. */
export function gripSpots(m: PartModel, shape: Shape, tips: readonly Vector3[]): GripSpot[] {
  if (tips.length < 2) return [];
  const first = tips[0]!;
  const last = tips[tips.length - 1]!;
  const cx = (first.x + last.x) / 2;
  const cz = (first.z + last.z) / 2;
  const spots: GripSpot[] = [];
  if (shape === 'axial') {
    // the body runs along the legs: its end is `half` from the middle; a ring's sphere stops 0.02 short of it
    const half = m.hit.scale.x / 2;
    const ux = last.x - first.x;
    const uz = last.z - first.z;
    const len = Math.hypot(ux, uz) || 1;
    tips.forEach((t, k) => {
      const along = Math.abs(((t.x - cx) * ux + (t.z - cz) * uz) / len);
      spots.push({
        leg: k,
        kind: 'ring',
        at: new Vector3(t.x, RING_Y, t.z),
        r: Math.min(GRIP_R, Math.max(along - half - 0.02, 0.02)),
      });
    });
  } else if (shape === 'radial') {
    // the front of the body's box, as the body stands now
    m.bodyGroup.updateMatrix();
    const box = new Box3().setFromCenterAndSize(m.hit.position, m.hit.scale).applyMatrix4(m.bodyGroup.matrix);
    const front = box.max.z + TAB_AHEAD;
    const side = Math.abs(last.x - first.x) >= Math.abs(last.z - first.z);
    tips.forEach((t, k) => {
      // side by side: before its own leg; one behind the other: the back one to the left, the front one to the right
      const back = t.z <= tips[1 - k]!.z;
      const x = side ? t.x : cx + (back ? -TAB_SIDE : TAB_SIDE);
      spots.push({
        leg: k,
        kind: 'tab',
        at: new Vector3(x, 0.05, front),
        r: TAB_R,
        from: new Vector3(t.x, 0, t.z),
      });
    });
  } else if (shape === 'wire') {
    tips.forEach((t, k) => {
      const o = tips[1 - k]!;
      const dir = new Vector3(o.x - t.x, 0, o.z - t.z);
      const span = dir.length();
      if (span > 1e-9) dir.divideScalar(span);
      else dir.set(1, 0, 0);
      const at = t.clone().addScaledVector(dir, Math.min(JUMPER_GRIP, span / 4));
      at.y = Math.max(t.y, o.y) + JUMPER.height;
      spots.push({ leg: k, kind: 'end', at, r: GRIP_R, axis: dir.clone() });
    });
  }
  spaceSpots(spots);
  return spots;
}

/** No two spheres overlap: each at most half the way to its nearest neighbour (plan and height). */
function spaceSpots(spots: readonly GripSpot[]): void {
  const r = spots.map((s, i) => {
    let near = Infinity;
    spots.forEach((o, j) => void (j !== i && (near = Math.min(near, s.at.distanceTo(o.at)))));
    return Math.min(s.r, near / 2);
  });
  spots.forEach((s, i) => (s.r = r[i]!));
}

/* ------------------------------------------------------------------------------------------- the hand */

/** A part in the hand (gesture 1). */
interface Carry {
  readonly key: `part:${string}`;
  readonly id: string;
  readonly spec: string;
  /** Where it was taken from: the sockets (null for a leg that was not in one), or null — the tray, the dock. */
  readonly from: readonly (SocketId | null)[] | null;
  /** Where the legs that were not in sockets lay. */
  readonly lay: readonly Vector3[];
  /** Grid steps of every leg from leg 0, and the plan offsets while it follows the hand freely. */
  readonly grid: readonly (readonly [number, number])[];
  readonly free: readonly Vector3[];
  /** Leg 0 − the hand at the press (plan). */
  readonly offset: Vector3;
  preview: SocketSpec[] | null;
  /** The middle of the carried part now (plan): over the board or off it. */
  readonly hand: Vector3;
}

/** An end in the hand (gesture 2). */
interface End {
  readonly key: HandKey;
  readonly leg: Leg;
  readonly part: string | null;
  readonly k: number;
  readonly lead: string | null;
  readonly probe: string | null;
  /** The socket it left (null: it lay). */
  readonly from: SocketId | null;
  readonly offset: Vector3;
  /** Let go with no socket: back to `from` (a part's leg), or lie there (a jumper's end, a plug). */
  readonly loose: 'back' | 'lie';
  /** When it clicks in: while the hand moves (a part's leg), or when it is let go (a wire's end). */
  readonly click: 'move' | 'release';
  left: SocketId | null;
  /** The end's last point (plan), where it is let go. */
  readonly at: Vector3;
}

interface Flip {
  readonly spec: string;
  readonly target: SocketId[];
  readonly start: Vector3[];
  readonly pivot: Vector3;
  t: number;
}

type Intent =
  | { readonly kind: 'part'; readonly id: string; readonly spec: string; readonly legs: readonly (SocketId | null)[] }
  | { readonly kind: 'leg'; readonly id: string; readonly k: number; readonly socket: SocketId }
  | { readonly kind: 'lead'; readonly name: string; readonly socket: SocketId }
  | { readonly kind: 'probe'; readonly name: string; readonly socket: SocketId }
  | { readonly kind: 'tray'; readonly id: string };

interface PartRec {
  readonly id: string;
  readonly model: PartModel;
  readonly shape: Shape;
  readonly grips: (Grip | null)[];
  readonly off: Unsubscribe[];
  linger: number;
  over: number;
  glow: number;
}

interface LeadRec {
  readonly lead: LeadEnd;
  readonly grip: Grip;
  /** A probe's: its grip shows only while its instrument is on its place. */
  readonly ready: () => boolean;
  linger: number;
  over: number;
}

/** What the hand moves now or moved last, for the checks' motion reader. */
interface Focus {
  readonly part: string | null;
  readonly lead: string | null;
  readonly probe: string | null;
}
const NO_FOCUS: Focus = { part: null, lead: null, probe: null };

const UP = new Vector3(0, 1, 0);

export function createHands(ctx: ChapterContext, world: HandsWorld): Hands {
  const { frame, layout, state, parts, tray, terrain } = world;
  const P = layout.spec.pitch;
  const grips = new Group();
  grips.name = 'grips';
  frame.add(grips);
  const geo = gripGeometries();
  const cues: Cue[] = [0, 1, 2].map((i) => createCue(world.cues, 'cyan', 0.095 / 0.12, `cue:${i}`, 25));

  let held: HandKey | null = null;
  /** The tray's slot whose press took the carried part (its drag events come to the slot's registration). */
  let heldFrom: HandKey | null = null;
  let carry: Carry | null = null;
  let end: End | null = null;
  let near: SocketSpec | null = null;
  let offered: string | null = null;
  let lastFocus: Focus = NO_FOCUS;
  const probeEnds: ReadonlyMap<string, ProbeEnd> = world.probes ?? new Map();
  const flips = new Map<string, Flip>();
  const levels = new Map<string, { from: number; to: number; t: number; seconds: number }>();
  let intents: Intent[] = [];
  const recs = new Map<string, PartRec>();
  const leadRecs = new Map<string, LeadRec>();
  const slots = new Map<string, { hit: Object3D; off: Unsubscribe[] }>();
  const gripsByKey = new Map<HandKey, Grip>();

  /* ---------------------------------------------------------------------------------------- helpers */

  const live = (k: HandKey): boolean => !world.flying() && (hands.policy?.take(k) ?? true);
  const free = (k: HandKey): boolean => held === null || held === k;
  const legsOf = (id: string): readonly Leg[] => parts.legs.get(id) ?? [];
  const mouth = (id: SocketId, out = new Vector3()): Vector3 => {
    const s = layout.socket(id)!;
    return out.set(s.x, 0, s.z);
  };
  const overBoard = (p: Vector3): boolean =>
    p.x >= world.area.x0 && p.x <= world.area.x1 && p.z >= world.area.z0 && p.z <= world.area.z1;

  const normal = new Vector3();
  const through = new Vector3();
  const q = new Quaternion();
  const plane = new Plane();
  const ray = new Raycaster();
  const ndc = new Vector2();
  /**
   * The hand's point on the board's face (board frame): under the pointer, or `LIFT` px above a finger; `press` — where
   * it was at the press (the drag starts only past a few px, 4 for a mouse, 9 for a finger: the grip is the press's).
   */
  const handPoint = (e: DragInfo, out: Vector3, press = false): Vector3 | null => {
    frame.updateWorldMatrix(true, false);
    normal.copy(UP).applyQuaternion(frame.getWorldQuaternion(q));
    through.setFromMatrixPosition(frame.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, through);
    const w = ctx.viewport.width || 1;
    const h = ctx.viewport.height || 1;
    const lift = e.pointerType === 'touch' ? LIFT : 0;
    const back = press ? 1 : 0;
    ndc.set(e.ndc.x - (2 * e.totalX * back) / w, e.ndc.y + (2 * (e.totalY * back + lift)) / h);
    ray.setFromCamera(ndc, ctx.camera.camera);
    if (!ray.ray.intersectPlane(plane, out)) return null;
    return frame.worldToLocal(out).setY(0);
  };

  /** The part's level eases from where it is shown now (mid-way through an earlier change too) to `to`. */
  const setLevel = (id: string, to: number, seconds: number): void => {
    const now = levels.get(id);
    const from = now ? now.from + (now.to - now.from) * ease(Math.min(now.t, 1)) : parts.levelOf(id);
    if (seconds <= 0 || Math.abs(from - to) < 1e-9) {
      levels.delete(id);
      parts.level(id, to);
      return;
    }
    levels.set(id, { from, to, t: 0, seconds });
  };

  /** A thing has arrived; on the board its legs went in with a click (VISUAL §1: the bench's engine sounds are the
   * gestures' answers — `tick` on a leg's or an end's click). */
  const done = (k: HandKey, where: 'board' | 'tray' | 'away'): void => {
    if (where === 'board') audio.play('tick');
    hands.policy?.done?.(k, where);
  };

  /* ------------------------------------------------------------------------------ gesture 1: a part */

  /** The preview: leg 0 within SNAP of a socket, every leg on a free socket, allowed by the step. */
  const previewAt = (c: Carry, leg0: Vector3): SocketSpec[] | null => {
    const a = layout.nearest(leg0.x, leg0.z, SNAP);
    if (!a) return null;
    const out: SocketSpec[] = [];
    for (const [dx, dz] of c.grid) {
      const s = layout.atGrid(a.gx + dx, a.gz + dz);
      if (!s || !canSeat(layout, state, s.id, c.id)) return null;
      out.push(s);
    }
    if (hands.policy?.place?.(c.key, out.map((s) => s.id)) === false) return null;
    return out;
  };

  const legTarget = (c: Carry, k: number, leg0: Vector3, out: Vector3): Vector3 =>
    c.preview ? mouth(c.preview[k]!.id, out).setY(HOVER) : out.copy(leg0).add(c.free[k]!).setY(HOVER);

  /** Move the carried part to the hand at `hp` (board frame): the preview, or free. Whether it is over the board is
   * the part's own middle's matter, not the hand's (a finger rides below it, `LIFT`). */
  const follow = (c: Carry, hp: Vector3, smoothly = false): void => {
    const leg0 = hp.clone().add(c.offset);
    c.hand.copy(leg0);
    for (const f of c.free) c.hand.addScaledVector(f, 1 / c.free.length);
    const next = overBoard(c.hand) ? previewAt(c, leg0) : null;
    const changed = (next?.map((s) => s.id).join() ?? '') !== (c.preview?.map((s) => s.id).join() ?? '');
    c.preview = next;
    legsOf(c.id).forEach((leg, k) => {
      const at = legTarget(c, k, leg0, new Vector3());
      if (smoothly || changed || leg.place.kind !== 'hand') leg.go({ kind: 'hand', at }, FOLLOW, 0);
      else leg.carry(at);
    });
  };

  /** The part is the hand's now: out of every socket (out of the circuit, not pending). */
  const lift = (id: string, spec: string, n: number): void => {
    put(layout, state, { id, spec, legs: new Array<SocketId | null>(n).fill(null) });
  };

  const startCarry = (id: string, origin: 'board' | 'tray' | 'offer', hp: Vector3): void => {
    const p = state.parts.get(id);
    const m = parts.models.get(id);
    const fp = p ? footprintOf(p.spec) : null;
    if (!p || !m || !fp) return;
    const legs = legsOf(id);
    const from = origin === 'board' ? [...p.legs] : null;
    const seated = from !== null && from.every((s) => s !== null);
    // the shape it keeps in the hand: its sockets' as they were (a re-seated leg too), or its footprint's
    const s0 = seated ? layout.socket(from[0]!)! : null;
    const grid = seated
      ? from.map((s) => {
          const x = layout.socket(s!)!;
          return [x.gx - s0!.gx, x.gz - s0!.gz] as const;
        })
      : fp.offsets;
    const free = seated
      ? from.map((s) => mouth(s!).sub(mouth(from[0]!)))
      : m.nominal.map((t) => t.clone().sub(m.nominal[0]!));
    // from the board the hand keeps its grip on the part; from the tray, leg 0 comes under the hand
    const offset = origin === 'tray' ? new Vector3() : legs[0]!.pos.clone().setY(0).sub(hp);
    lift(id, p.spec, p.legs.length);
    held = `part:${id}`;
    carry = {
      key: `part:${id}`,
      id,
      spec: p.spec,
      from,
      lay: legs.map((l) => l.pos.clone()),
      grid,
      free,
      offset,
      preview: null,
      hand: hp.clone(),
    };
    if (origin === 'offer') offered = null;
    lastFocus = { ...NO_FOCUS, part: id };
    follow(carry, hp, true);
    // level with the table in the tray (the slot's press set it), the board's tilt on the way
    if (origin === 'tray') setLevel(id, 1, 0.25);
  };

  /** A part goes back to its slot (0.4 s) and is gone; with no slot in sight (a phone, a kind the tray lacks) at once. */
  const toTray = (id: string, spec: string): void => {
    const tips = world.phone() ? null : tray.tips(spec);
    if (!tips) {
      remove(state, id);
      parts.sync();
      done(`part:${id}`, 'tray');
      return;
    }
    frame.updateWorldMatrix(true, false);
    legsOf(id).forEach((leg, k) =>
      leg.go({ kind: 'tray', at: frame.worldToLocal(tips[k]!.clone()) }, TRAY.back, 0.4),
    );
    setLevel(id, 0, TRAY.back);
    intents.push({ kind: 'tray', id });
  };

  const endCarry = (c: Carry): void => {
    held = null;
    carry = null;
    heldFrom = null;
    const legs = legsOf(c.id);
    if (c.preview) {
      const target = c.preview.map((s) => s.id);
      legs.forEach((leg, k) => leg.go({ kind: 'socket', socket: target[k]! }, SEAT_SECONDS, SEAT_LIFT));
      intents.push({ kind: 'part', id: c.id, spec: c.spec, legs: target });
    } else if (c.from && overBoard(c.hand)) {
      // over the board with no place: back to where it was
      legs.forEach((leg, k) => {
        const s = c.from![k];
        if (s) leg.go({ kind: 'socket', socket: s }, SEAT_SECONDS + 0.1, SEAT_LIFT);
        else leg.go({ kind: 'lie', at: c.lay[k]!.clone(), out: leg.out.clone() }, SEAT_SECONDS + 0.1, 0);
      });
      intents.push({ kind: 'part', id: c.id, spec: c.spec, legs: c.from });
    } else toTray(c.id, c.spec);
  };

  /* --------------------------------------------------------------------------------- the flip */

  const startFlip = (id: string): void => {
    const p = state.parts.get(id);
    if (!p || p.legs.some((s) => s === null) || hands.busy(id)) return;
    const legs = legsOf(id);
    const start = legs.map((l) => l.pos.clone());
    const pivot = start.reduce((a, b) => a.add(b), new Vector3()).divideScalar(start.length);
    flips.set(id, { spec: p.spec, target: [...p.legs].reverse() as SocketId[], start, pivot, t: 0 });
    lift(id, p.spec, p.legs.length);
    legs.forEach((l, k) => l.go({ kind: 'hand', at: start[k]!.clone() }, 0));
    lastFocus = { ...NO_FOCUS, part: id };
  };

  const stepFlips = (dt: number): void => {
    for (const [id, f] of flips) {
      f.t = Math.min(f.t + Math.max(dt, 0) / FLIP.seconds, 1);
      const e = ease(f.t);
      const legs = legsOf(id);
      const at = new Vector3();
      legs.forEach((leg, k) => {
        at.copy(f.start[k]!).sub(f.pivot).applyAxisAngle(UP, Math.PI * e).add(f.pivot);
        at.y = f.start[k]!.y + FLIP.rise * Math.sin(Math.PI * e);
        leg.carry(at);
      });
      if (f.t >= 1) {
        flips.delete(id);
        legs.forEach((leg, k) => leg.go({ kind: 'socket', socket: f.target[k]! }, 0));
        intents.push({ kind: 'part', id, spec: f.spec, legs: f.target });
      }
    }
  };

  /* -------------------------------------------------------------------------------- gesture 2: an end */

  /** The lead an end is on: a plug's, a probe's; null for a part's leg. */
  const wireOf = (e: End): LeadEnd | null =>
    e.lead !== null ? world.leads.get(e.lead)! : e.probe !== null ? probeEnds.get(e.probe)! : null;

  /** Where an end may go from its other legs (a part's span) or its thing (a lead's length), in plan. */
  const reach = (e: End, p: Vector3): void => {
    const l = wireOf(e);
    if (l !== null) {
      const d = Math.hypot(p.x - l.from.x, p.z - l.from.z);
      if (d > l.reach) {
        p.x = l.from.x + ((p.x - l.from.x) * l.reach) / d;
        p.z = l.from.z + ((p.z - l.from.z) * l.reach) / d;
      }
      return;
    }
    const part = state.parts.get(e.part!);
    const span = part ? footprintOf(part.spec)?.span : null;
    if (!part || !span) return;
    part.legs.forEach((s, k) => {
      if (k === e.k || s === null) return;
      const o = mouth(s);
      let dx = p.x - o.x;
      let dz = p.z - o.z;
      let d = Math.hypot(dx, dz);
      if (d < 1e-9) {
        dx = e.leg.pos.x - o.x;
        dz = e.leg.pos.z - o.z;
        d = Math.hypot(dx, dz) || 1;
      }
      const to = Math.min(Math.max(d, span[0] * P), span[1] * P);
      p.x = o.x + (dx * to) / d;
      p.z = o.z + (dz * to) / d;
    });
  };

  /** May the end click into this socket: free (a probe: any it takes), not the one just left, within reach, allowed. */
  const takes = (e: End, s: SocketSpec): boolean => {
    if (s.id === e.left) return false;
    const probe = e.probe !== null ? probeEnds.get(e.probe)! : null;
    if (probe ? !probe.takes(s.id) : !canSeat(layout, state, s.id)) return false;
    if (hands.policy?.seat?.(e.key, s.id) === false) return false;
    const l = wireOf(e);
    if (l !== null) return Math.hypot(s.x - l.from.x, s.z - l.from.z) <= l.reach + 1e-9;
    const part = state.parts.get(e.part!);
    const span = part ? footprintOf(part.spec)?.span : null;
    if (!part || !span) return false;
    return part.legs.every((o, k) => {
      if (k === e.k || o === null) return true;
      const x = layout.socket(o)!;
      const apart = Math.hypot(s.x - x.x, s.z - x.z) / P;
      return apart >= span[0] - 1e-9 && apart <= span[1] + 1e-9;
    });
  };

  const endHeight = (e: End, p: Vector3): number =>
    wireOf(e) !== null ? Math.max(terrain.ground(p.x, p.z), 0) + CARRY : CARRY;

  const startEnd = (
    key: HandKey,
    leg: Leg,
    ev: DragInfo,
    who: { part?: string; k?: number; lead?: string; probe?: string },
  ) => {
    const hp = handPoint(ev, new Vector3(), true);
    if (!hp) return;
    let from: SocketId | null;
    let loose: 'back' | 'lie';
    if (who.lead !== undefined) {
      from = state.leads.get(who.lead) ?? null;
      if (from) seatLead(layout, state, who.lead, null);
      loose = 'lie';
      lastFocus = { ...NO_FOCUS, lead: who.lead };
    } else if (who.probe !== undefined) {
      // out of its socket at the press: the meter reads nothing until it is in one again
      const probe = probeEnds.get(who.probe)!;
      from = probe.socket;
      probe.seat(null);
      loose = 'lie';
      lastFocus = { ...NO_FOCUS, probe: who.probe };
    } else {
      const p = state.parts.get(who.part!)!;
      from = p.legs[who.k!] ?? null;
      if (from) seatLeg(layout, state, who.part!, who.k!, null);
      loose = footprintOf(p.spec)?.shape === 'wire' ? 'lie' : 'back';
      lastFocus = { ...NO_FOCUS, part: who.part! };
    }
    held = key;
    end = {
      key,
      leg,
      part: who.part ?? null,
      k: who.k ?? 0,
      lead: who.lead ?? null,
      probe: who.probe ?? null,
      from,
      offset: leg.pos.clone().setY(0).sub(hp),
      loose,
      click: loose === 'lie' ? 'release' : 'move',
      left: from,
      at: leg.pos.clone().setY(0),
    };
    const at = leg.pos.clone();
    at.y = endHeight(end, at);
    leg.go({ kind: 'hand', at }, FOLLOW, 0);
    // the hand has moved since the press: the end follows to where it is now
    steer(end, ev);
  };

  /** The end follows the hand; `near` is where it may go. True when it is within `SNAP` of that socket. */
  const steer = (e: End, ev: DragInfo | null): boolean => {
    const hp = ev ? handPoint(ev, new Vector3()) : null;
    if (hp) {
      const p = hp.add(e.offset);
      reach(e, p);
      p.y = endHeight(e, p);
      e.leg.carry(p);
      e.at.copy(p).setY(0);
    }
    const p = e.at;
    if (e.left !== null) {
      const l = layout.socket(e.left)!;
      if (Math.hypot(l.x - p.x, l.z - p.z) > AWAY) e.left = null;
    }
    const c = layout.nearest(p.x, p.z, NEAR);
    near = c && takes(e, c) ? c : null;
    return near !== null && Math.hypot(near.x - p.x, near.z - p.z) <= SNAP;
  };

  /** The end clicks into `near`: the rest of this gesture is ignored; the board changes when it has arrived. */
  const clickIn = (e: End): void => {
    const socket = near!.id;
    held = null;
    end = null;
    near = null;
    e.leg.go({ kind: 'socket', socket }, SEAT_SECONDS, SEAT_LIFT);
    intents.push(
      e.lead !== null
        ? { kind: 'lead', name: e.lead, socket }
        : e.probe !== null
          ? { kind: 'probe', name: e.probe, socket }
          : { kind: 'leg', id: e.part!, k: e.k, socket },
    );
  };

  const moveEnd = (e: End, ev: DragInfo): void => {
    if (steer(e, ev) && e.click === 'move') clickIn(e);
  };

  const endEnd = (e: End, ev: DragInfo | null): void => {
    if (steer(e, ev) && e.click === 'release') {
      clickIn(e);
      return;
    }
    held = null;
    end = null;
    near = null;
    if (e.loose === 'back' && e.from !== null) {
      e.leg.go({ kind: 'socket', socket: e.from }, SEAT_SECONDS + 0.1, SEAT_LIFT);
      intents.push({ kind: 'leg', id: e.part!, k: e.k, socket: e.from });
      return;
    }
    const at = e.leg.pos.clone();
    if (e.probe !== null) {
      // a probe lies where the hand let it go over the base, and goes back to rest by its meter off it
      e.leg.go(probeEnds.get(e.probe)!.drop(e.at.clone()), 0.3, 0.3);
      done(e.key, 'away');
      return;
    }
    // it lies where it was let go, its wire toward its thing or its part
    const anchor = e.lead !== null ? world.leads.get(e.lead)!.from : null;
    const out = anchor ? anchor.clone().sub(at).setY(0) : e.leg.out.clone().setY(0);
    if (out.lengthSq() < 1e-9) out.set(1, 0, 0);
    e.leg.go({ kind: 'lie', at, out: out.normalize() }, 0.15, 0);
    done(e.key, 'away');
  };

  /* --------------------------------------------------------------------------------- arrivals */

  /** The intents whose legs have arrived change the board now; an intent whose leg went elsewhere is dropped. */
  const resolve = (): void => {
    const keep: Intent[] = [];
    for (const i of intents) {
      if (i.kind === 'part') {
        const legs = legsOf(i.id);
        const wanted = (leg: Leg, k: number) =>
          i.legs[k] === null ? leg.place.kind === 'lie' : leg.socket === i.legs[k];
        if (legs.length !== i.legs.length || !legs.every(wanted)) continue;
        if (!legs.every((leg, k) => !leg.moving && (i.legs[k] === null || leg.seated === i.legs[k]))) {
          keep.push(i);
          continue;
        }
        if (put(layout, state, { id: i.id, spec: i.spec, legs: i.legs })) done(`part:${i.id}`, 'board');
        else toTray(i.id, i.spec); // a socket was taken meanwhile
      } else if (i.kind === 'leg') {
        const leg = legsOf(i.id)[i.k];
        if (!leg || leg.socket !== i.socket) continue;
        if (leg.seated !== i.socket) {
          keep.push(i);
          continue;
        }
        if (seatLeg(layout, state, i.id, i.k, i.socket)) done(`leg:${i.id}:${i.k}`, 'board');
      } else if (i.kind === 'lead') {
        const l = world.leads.get(i.name);
        if (!l || l.leg.socket !== i.socket) continue;
        if (l.leg.seated !== i.socket) {
          keep.push(i);
          continue;
        }
        if (seatLead(layout, state, i.name, i.socket)) done(`lead:${i.name}`, 'board');
        else {
          const at = l.leg.pos.clone();
          l.leg.go({ kind: 'lie', at, out: l.from.clone().sub(at).setY(0).normalize() }, 0.15, 0);
        }
      } else if (i.kind === 'probe') {
        const pr = probeEnds.get(i.name);
        if (!pr || pr.leg.socket !== i.socket) continue;
        if (pr.leg.seated !== i.socket) {
          keep.push(i);
          continue;
        }
        pr.seat(i.socket);
        done(`probe:${i.name}`, 'board');
      } else {
        const legs = legsOf(i.id);
        if (!legs.every((l) => l.place.kind === 'tray')) continue;
        if (legs.some((l) => l.moving)) {
          keep.push(i);
          continue;
        }
        remove(state, i.id);
        levels.delete(i.id);
        parts.sync();
        done(`part:${i.id}`, 'tray');
      }
    }
    intents = keep;
  };

  /* ------------------------------------------------------------------------------ registration */

  const gripOf = (owner: Group, key: HandKey, kind: GripKind): Grip => {
    const g = createGrip(owner, key, kind, geo);
    gripsByKey.set(key, g);
    return g;
  };

  const probes: Unsubscribe[] = [];
  const probe = (name: string, at: () => Vector3): Unsubscribe => ctx.qa.probe(name, at);

  /** A part's body and its grips, while it has a model. */
  const adopt = (id: string, model: PartModel): void => {
    const spec = state.parts.get(id)?.spec ?? model.key;
    const fp = footprintOf(spec);
    const shape: Shape = fp?.shape ?? 'axial';
    const movable = (fp?.span ?? null) !== null;
    const key = `part:${id}` as const;
    const rec: PartRec = {
      id,
      model,
      shape,
      grips: model.legTips.map(() => null),
      off: [],
      linger: 0,
      over: 0,
      glow: 0,
    };
    const bodyLive = (): boolean =>
      live(key) && free(key) && (!hands.busy(id) || offered === id || carry?.id === id);
    rec.off.push(
      ctx.input.register(model.hit, {
        cursor: 'grab',
        tooltip: () => hands.policy?.tooltip?.(key) ?? '',
        enabled: bodyLive,
        hover: (on) => void (on ? (rec.over |= 1) : (rec.over &= ~1)),
        click: () => {
          if (!bodyLive() || held !== null || offered === id) return;
          if (hands.policy?.flip?.(key) === false) return;
          startFlip(id);
        },
        dragStart: (e) => {
          if (!bodyLive() || held !== null) return;
          const at = handPoint(e, new Vector3(), true);
          if (!at) return;
          startCarry(id, offered === id ? 'offer' : 'board', at);
          const hp = handPoint(e, new Vector3());
          if (hp && carry) follow(carry, hp);
        },
        drag: (e) => {
          if (held !== key || !carry || carry.id !== id) return;
          const hp = handPoint(e, new Vector3());
          if (hp) follow(carry, hp);
        },
        dragEnd: () => {
          if (held !== key || !carry || carry.id !== id) return;
          endCarry(carry);
        },
      }),
    );
    rec.off.push(
      probe(key, () => {
        model.hit.updateWorldMatrix(true, false);
        return new Box3().setFromObject(model.hit).getCenter(new Vector3());
      }),
    );
    model.legTips.forEach((_, k) => {
      rec.off.push(
        probe(`tip:${id}:${k}`, () => {
          const l = legsOf(id)[k];
          frame.updateWorldMatrix(true, false);
          return frame.localToWorld(l ? l.pos.clone().setY(0) : new Vector3());
        }),
      );
      if (!movable) return;
      const gk = `leg:${id}:${k}` as const;
      const kind: GripKind = shape === 'axial' ? 'ring' : shape === 'radial' ? 'tab' : 'end';
      const g = gripOf(grips, gk, kind);
      rec.grips[k] = g;
      // a grip hidden for want of the pointer still takes it: over its sphere the pointer is over its part, and the
      // grips come in (a hand that holds something else, a part the hand drives, a phone's tabs: none)
      const gripLive = (): boolean =>
        live(gk) && free(gk) && (held === gk || !hands.busy(id)) && !(kind === 'tab' && world.phone());
      rec.off.push(
        ctx.input.register(g.hit, {
          cursor: 'grab',
          tooltip: () => hands.policy?.tooltip?.(gk) ?? hands.policy?.tooltip?.(key) ?? '',
          enabled: gripLive,
          hover: (on) => {
            g.hover = on;
            if (on) rec.over |= 2;
            else rec.over &= ~2;
          },
          dragStart: (e) => {
            if (!gripLive() || held !== null) return;
            const leg = legsOf(id)[k];
            if (leg) startEnd(gk, leg, e, { part: id, k });
          },
          drag: (e) => {
            if (held !== gk || !end || end.key !== gk) return;
            moveEnd(end, e);
          },
          dragEnd: (e) => {
            if (held !== gk || !end || end.key !== gk) return;
            endEnd(end, e);
          },
        }),
      );
      rec.off.push(
        probe(gk, () => {
          frame.updateWorldMatrix(true, false);
          return frame.localToWorld(g.spot ? g.spot.at.clone() : new Vector3());
        }),
      );
    });
    recs.set(id, rec);
  };

  const forget = (rec: PartRec): void => {
    for (const f of rec.off) f();
    for (const g of rec.grips) {
      if (!g) continue;
      gripsByKey.delete(g.key as HandKey);
      g.dispose();
    }
    recs.delete(rec.id);
  };

  /** The tray's slots: a press on one takes a new part (gesture 1). */
  const syncSlots = (): void => {
    const now = new Set(tray.slots.map((s) => s.spec));
    for (const [spec, r] of slots) {
      const s = tray.slot(spec);
      if (now.has(spec) && s?.hit === r.hit) continue;
      for (const f of r.off) f();
      slots.delete(spec);
    }
    for (const s of tray.slots) {
      if (slots.has(s.spec)) continue;
      const key = `tray:${s.spec}` as const;
      const slotLive = (): boolean => live(key) && free(key) && !world.phone();
      const off = [
        ctx.input.register(s.hit, {
          cursor: 'grab',
          tooltip: () => hands.policy?.tooltip?.(key) ?? '',
          enabled: slotLive,
          dragStart: (e) => {
            if (!slotLive() || held !== null) return;
            const hp = handPoint(e, new Vector3());
            if (!hp) return;
            const id = tray.take(s.spec, state);
            if (!id) return;
            lift(id, s.spec, footprintOf(s.spec)!.offsets.length);
            parts.sync();
            syncParts();
            // the new part starts where the sample stood, level with the table
            const tips = tray.tips(s.spec)!;
            frame.updateWorldMatrix(true, false);
            legsOf(id).forEach((leg, k) =>
              leg.go({ kind: 'tray', at: frame.worldToLocal(tips[k]!.clone()) }, 0),
            );
            parts.level(id, 0);
            startCarry(id, 'tray', hp);
            heldFrom = key;
          },
          // the press was on the slot: the carried part's drag events come here
          drag: (e) => {
            if (heldFrom !== key || !carry || held !== carry.key) return;
            const hp = handPoint(e, new Vector3());
            if (hp) follow(carry, hp);
          },
          dragEnd: () => {
            if (heldFrom !== key || !carry || held !== carry.key) return;
            endCarry(carry);
          },
        }),
        probe(key, () => s.hit.getWorldPosition(new Vector3())),
      ];
      slots.set(s.spec, { hit: s.hit, off });
    }
  };
  const syncParts = (): void => {
    for (const rec of [...recs.values()]) if (parts.models.get(rec.id) !== rec.model) forget(rec);
    for (const [id, m] of parts.models) if (!recs.has(id)) adopt(id, m);
  };

  /** The capsule of a plug or of a probe (the end of a lead), and what the hand does with it. */
  const adoptWire = (
    key: `lead:${string}` | `probe:${string}`,
    lead: LeadEnd,
    who: { lead?: string; probe?: string },
    ready: () => boolean,
    busy: () => boolean,
  ): void => {
    const g = gripOf(grips, key, 'end');
    const rec: LeadRec = { lead, grip: g, ready, linger: 0, over: 0 };
    leadRecs.set(key, rec);
    const gripLive = (): boolean => live(key) && free(key) && ready() && (held === key || !busy());
    probes.push(
      ctx.input.register(g.hit, {
        cursor: 'grab',
        tooltip: () => hands.policy?.tooltip?.(key) ?? '',
        enabled: gripLive,
        hover: (on) => {
          g.hover = on;
          rec.over = on ? 1 : 0;
        },
        dragStart: (e) => {
          if (!gripLive() || held !== null) return;
          startEnd(key, lead.leg, e, who);
        },
        drag: (e) => {
          if (held !== key || !end || end.key !== key) return;
          moveEnd(end, e);
        },
        dragEnd: (e) => {
          if (held !== key || !end || end.key !== key) return;
          endEnd(end, e);
        },
      }),
      probe(key, () => {
        frame.updateWorldMatrix(true, false);
        return frame.localToWorld(g.spot ? g.spot.at.clone() : lead.gripAt(new Vector3()));
      }),
      probe(`end:${lead.name}`, () => {
        frame.updateWorldMatrix(true, false);
        return frame.localToWorld(lead.leg.pos.clone().setY(0));
      }),
    );
  };
  for (const lead of world.leads.values()) {
    adoptWire(`lead:${lead.name}`, lead, { lead: lead.name }, () => true, () => hands.busyLead(lead.name));
  }
  // the probes of the instruments: only while their instrument is on its place
  for (const p of probeEnds.values()) {
    adoptWire(`probe:${p.name}`, p, { probe: p.name }, () => p.ready(), () => hands.busyProbe(p.name));
  }

  /* ---------------------------------------------------------------------------------- the frame */

  const cueAt = new Vector3();
  const focusAt = new Vector3();
  const focusUp = new Vector3(0, 1, 0);
  const upTurn = new Quaternion();
  const hands: Hands = {
    policy: null,
    get held() {
      return held;
    },
    get near() {
      return near?.id ?? null;
    },
    get preview() {
      return carry?.preview?.map((s) => s.id) ?? [];
    },
    get rows() {
      const list = carry?.preview ?? (near ? [near] : []);
      return [...new Set(list.map((s) => s.row))];
    },
    grip: (key) => gripsByKey.get(key),
    offer(spec) {
      if (offered !== null) {
        remove(state, offered);
        offered = null;
        parts.sync();
      }
      const fp = footprintOf(spec);
      if (fp === null || fp.prefix === '' || held !== null) return null;
      const id = tray.slot(spec) ? tray.take(spec, state) : nextId(state, fp.prefix);
      if (!id) return null;
      lift(id, spec, fp.offsets.length);
      parts.sync();
      syncParts();
      const m = parts.models.get(id);
      if (!m) {
        remove(state, id);
        return null;
      }
      // over the middle of the field of sockets, above the tallest part on the board
      let top = 0;
      for (const [other, o] of parts.models) {
        if (other === id) continue;
        o.group.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(o.hit);
        frame.updateWorldMatrix(true, false);
        top = Math.max(top, frame.worldToLocal(box.max.clone()).y);
      }
      const y = Math.max(HOVER, top + 0.1);
      const span = m.nominal[m.nominal.length - 1]!.x - m.nominal[0]!.x;
      legsOf(id).forEach((leg, k) =>
        leg.go({ kind: 'hand', at: new Vector3(m.nominal[k]!.x - span / 2, y, 0) }, 0),
      );
      parts.level(id, 1);
      offered = id;
      lastFocus = { ...NO_FOCUS, part: id };
      return id;
    },
    busy(id) {
      return (
        carry?.id === id ||
        flips.has(id) ||
        offered === id ||
        levels.has(id) ||
        end?.part === id ||
        intents.some((i) => (i.kind === 'part' || i.kind === 'leg' || i.kind === 'tray') && i.id === id)
      );
    },
    carried(id) {
      return carry?.id === id || offered === id || intents.some((i) => i.kind === 'tray' && i.id === id);
    },
    busyLead(name) {
      return end?.lead === name || intents.some((i) => i.kind === 'lead' && i.name === name);
    },
    busyProbe(name) {
      return end?.probe === name || intents.some((i) => i.kind === 'probe' && i.name === name);
    },
    focus(out, up) {
      frame.updateWorldMatrix(true, false);
      const l =
        lastFocus.lead !== null
          ? world.leads.get(lastFocus.lead)
          : lastFocus.probe !== null
            ? probeEnds.get(lastFocus.probe)
            : undefined;
      const legs = lastFocus.part !== null ? legsOf(lastFocus.part) : [];
      // a part gone (into the tray) stays where it was last seen
      if (l) frame.localToWorld(focusAt.copy(l.leg.pos));
      else if (legs.length) frame.localToWorld(focusAt.copy(legs[0]!.pos));
      if (up) {
        const m = !l && lastFocus.part !== null ? parts.models.get(lastFocus.part) : undefined;
        if (m) focusUp.copy(UP).applyQuaternion(m.group.getWorldQuaternion(upTurn));
        up.copy(focusUp);
      }
      return out.copy(focusAt);
    },
    snap() {
      for (const f of flips.values()) f.t = 1;
      stepFlips(0);
      for (const [id, l] of levels) {
        l.t = 1;
        parts.level(id, l.to);
      }
      levels.clear();
      for (const i of intents) {
        if (i.kind === 'lead') world.leads.get(i.name)?.leg.snap();
        else if (i.kind === 'probe') probeEnds.get(i.name)?.leg.snap();
        else for (const leg of legsOf(i.id)) leg.snap();
      }
      resolve();
    },
    reset() {
      held = null;
      heldFrom = null;
      carry = null;
      end = null;
      near = null;
      flips.clear();
      for (const id of levels.keys()) parts.level(id, 1);
      levels.clear();
      intents = [];
      if (offered !== null) remove(state, offered);
      offered = null;
    },
    update(dt, t) {
      stepFlips(dt);
      for (const [id, l] of levels) {
        l.t = Math.min(l.t + Math.max(dt, 0) / l.seconds, 1);
        parts.level(id, l.from + (l.to - l.from) * ease(l.t));
        if (l.t >= 1) levels.delete(id);
      }
      resolve();
      syncParts();
      syncSlots();

      // the grips: shown on a touch screen always, with a mouse while the pointer is on the thing and 1.5 s after;
      // hidden while the hand holds anything else, and on the parts the hand drives; while the camera flies (the
      // magnifier's dive) nothing can be taken, so no grip is shown and no body glows
      const touch = ctx.device.hover === false;
      const still = !world.flying();
      const phone = world.phone();
      const spots: { g: Grip; s: GripSpot }[] = [];
      for (const rec of recs.values()) {
        const legs = legsOf(rec.id);
        const tips = legs.map((l) => l.pos);
        rec.linger = rec.over ? LINGER : Math.max(rec.linger - Math.max(dt, 0), 0);
        const mine = held !== null && (held === `part:${rec.id}` || held.startsWith(`leg:${rec.id}:`));
        const want =
          still &&
          (touch || rec.linger > 0) &&
          (held === null || mine) &&
          (!hands.busy(rec.id) || end?.part === rec.id);
        if (rec.grips.some((g) => g)) {
          for (const s of gripSpots(rec.model, rec.shape, tips)) {
            const g = rec.grips[s.leg];
            if (!g) continue;
            spots.push({ g, s });
            const hide = s.kind === 'tab' && phone;
            g.shown.go(want && !hide ? 1 : 0, 0.15);
          }
        }
        // the body glows under the pointer (0.3) and pulses while it waits in the air (the phone's dock)
        const glow = !still
          ? 0
          : offered === rec.id
            ? 0.25 + 0.12 * Math.sin(t * 2.4)
            : rec.over & 1 && held === null
              ? 0.3
              : 0;
        if (Math.abs(glow - rec.glow) > 1e-3) {
          rec.glow = glow;
          parts.glow(rec.id, glow);
        }
      }
      for (const rec of leadRecs.values()) {
        const l = rec.lead;
        rec.linger = rec.over ? LINGER : Math.max(rec.linger - Math.max(dt, 0), 0);
        const want = still && (touch || rec.linger > 0) && (held === null || held === rec.grip.key) && rec.ready();
        const at = l.gripAt(new Vector3());
        spots.push({ g: rec.grip, s: { leg: 0, kind: 'end', at, r: GRIP_R, axis: l.gripAxis(new Vector3()) } });
        rec.grip.shown.go(want ? 1 : 0, 0.15);
      }
      // no two spheres overlap, across all the things on the board
      spaceSpots(spots.map((x) => x.s));
      for (const { g, s } of spots) g.place(s);
      for (const g of gripsByKey.values()) g.update(dt, t);

      // the cue rings: on every socket of the preview, or where the carried end would go
      const list = carry?.preview ?? (near ? [near] : []);
      frame.updateWorldMatrix(true, false);
      cues.forEach((c, i) => {
        const s = list[i];
        c.update(dt, s ? frame.localToWorld(cueAt.set(s.x, 0.012, s.z)) : null, 0.12, ctx.camera.camera);
      });
    },
    dispose() {
      for (const rec of [...recs.values()]) forget(rec);
      for (const r of slots.values()) for (const f of r.off) f();
      slots.clear();
      for (const f of probes) f();
      for (const g of gripsByKey.values()) g.dispose();
      gripsByKey.clear();
      for (const c of cues) c.mesh.removeFromParent();
      geo.dispose();
      grips.removeFromParent();
    },
  };

  return hands;
}
