/**
 * Where a part stands, seen as the door to its floors (docs/volumes/electronics/VISUAL.md §7): the place of its body on
 * the board in the world, the two stops of the dive into it and the magnifier laid over it. Copied in its idea from
 * `circuit/chapters/resistance/parts/poses.ts` (shared/README.md, «Копії»: there the lens over a point of the loop,
 * lifted toward the camera along the line of sight; here over a part's body, toward the camera of the door's first stop).
 *
 * Everything is pure maths of the part's sockets (`sim/board`), its body's box (a model's `hit`, VISUAL §4) and the
 * bench's fixed places (`bench/layout.ts`, `shots.ts`): a part on another socket, at another quarter turn, gets its own
 * stops; a test computes them without a scene. `partLensPose` and `placeOf` read the live bench.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import type { BoardLayout, SocketId } from '@electronics/sim/board';
import type { Bench } from '../bench';
import { LENS, PLACES } from '../bench/layout';
import { STAGE_FOV, boardToWorld } from '../bench/shots';
import { overPose, type LensPose } from '../bench/tools';

type V = [number, number, number];
const Y = new Vector3(0, 1, 0);
/** The safe frame every shot of the bench is composed for: 3 : 2 (the director's default). */
const FRAME_ASPECT = 1.5;

/** A part's body as the door sees it: its box in the part's body frame (a model's `hit`: position and scale). */
export interface BodyBox {
  readonly centre: Vector3;
  readonly size: Vector3;
}

/** Where a part's body is (world, unless named otherwise). */
export interface PartPlace {
  /** The middle of the body's box. */
  readonly centre: Vector3;
  /** The same point in the base frame (where the magnifier's poses live, `bench/tools`). */
  readonly baseCentre: Vector3;
  /** Along the part from its first leg to its last (unit). */
  readonly axis: Vector3;
  /** Out of the board's face (unit). */
  readonly up: Vector3;
  /** The body's largest side: what fills the frame on the floor `inside`. */
  readonly size: number;
  /** The sockets it stands in: a door builds its stops again when they change. */
  readonly key: string;
}

/**
 * The place of a part whose legs stand in `sockets` (in leg order; a leg out of its socket, null: no place). The body
 * frame is the one `PartModel.fit` stands the model in — the origin on the board's face between the outer legs, +x
 * from the first leg to the last — and the board's frame lies `PLACES.breadboard.height` over the base's face.
 */
export function partPlace(
  layout: BoardLayout,
  sockets: readonly (SocketId | null)[],
  body: BodyBox,
): PartPlace | null {
  if (sockets.length === 0 || sockets.some((s) => s === null)) return null;
  const tips = sockets.map((s) => layout.socket(s!));
  const first = tips[0];
  const last = tips[tips.length - 1];
  if (!first || !last || tips.some((t) => !t)) return null;
  const dx = last.x - first.x;
  const dz = last.z - first.z;
  const angle = Math.hypot(dx, dz) > 1e-9 ? Math.atan2(-dz, dx) : 0;
  const B = PLACES.breadboard;
  const onBoard = body.centre
    .clone()
    .applyAxisAngle(Y, angle)
    .add(new Vector3((first.x + last.x) / 2, 0, (first.z + last.z) / 2));
  const baseCentre = onBoard.add(new Vector3(B.x, B.height, B.z));
  const origin = boardToWorld(0, 0, 0);
  const dir = (d: Vector3): Vector3 => boardToWorld(d.x, d.y, d.z).sub(origin).normalize();
  return {
    centre: boardToWorld(baseCentre.x, baseCentre.y, baseCentre.z),
    baseCentre,
    axis: dir(new Vector3(1, 0, 0).applyAxisAngle(Y, angle)),
    up: dir(Y),
    size: Math.max(body.size.x, body.size.y, body.size.z),
    key: sockets.join(' '),
  };
}

/**
 * How the dive into a part is framed (VISUAL §7). Both cameras of the door stand on one line from the body,
 * `elevation` over the board's face, across the part's axis on the reader's side (toward the shot the dive starts
 * from): the bands and the print face them, and the push-in through the ring is one straight move.
 * - Rail 0, the lens at work: the magnifier lies over the body `lift` toward the camera, drawn `scale` times its size
 *   (the bench's `overPose`), and its ring takes `ring` of the safe frame's height (VISUAL: 22–26 %, as in `circuit`) —
 *   so the camera stands about as far as the step's shot `board`: the lens leg is a short move, and the frame keeps its
 *   pace where the push-in begins (the copied rail maths ease that push-in in, `rail-math.ts`).
 * - Rail 1, `inside`: the body's largest side takes `inside` of the safe frame's width, opened, whole in the frame.
 * On the way the floor `part` begins at 0.5 (`levels.ts`); the body is a quarter of the frame's width there and a
 * third (35 %) a little later — `door.test.ts` holds where.
 */
export const PART_VIEW = {
  elevation: (60 * Math.PI) / 180,
  ring: 0.26,
  lift: 1.6,
  scale: 1.12,
  inside: 0.85,
} as const;

/** The two stops of the dive into a part and the magnifier laid over it. */
export interface PartStops {
  /** Rail 0: the magnifier at work over the body. */
  readonly door: Shot;
  /** Rail 1, the floor `inside`: the body opened on its place, close, on the same line. */
  readonly inside: Shot;
  /** From the body toward both cameras (world, unit): the cut opens on this side. */
  readonly view: Vector3;
  /** The magnifier over the body, facing the camera of `door` (base frame). */
  readonly lens: LensPose;
}

/** Height of the safe frame at distance 1 for the bench's field of view; its width is `FRAME_ASPECT` times that. */
const frameHeight = (): number => 2 * Math.tan(((STAGE_FOV / 2) * Math.PI) / 180);

/**
 * The stops of the dive into the part at `place`; `from` is the camera of the shot the dive starts from (world): the
 * cameras go to the side of the part that faces it.
 */
export function partStops(place: PartPlace, from: Vector3): PartStops {
  const { centre, axis, up, size } = place;
  // across the axis in the board's face, toward the camera the dive starts from (a part pointing straight at it: from
  // the reader's right, the world's +x, which the base's tilt leaves in the board's face)
  const side = from.clone().sub(centre);
  side.addScaledVector(up, -side.dot(up)).addScaledVector(axis, -side.dot(axis));
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0).addScaledVector(axis, -axis.x);
  side.normalize();
  const view = up
    .clone()
    .multiplyScalar(Math.sin(PART_VIEW.elevation))
    .addScaledVector(side, Math.cos(PART_VIEW.elevation))
    .normalize();
  /** A camera on the line, `distance` from the body; `fit` (what a phone keeps in its frame) at least `hold`. */
  const shot = (distance: number, hold = 0): Shot => {
    const position = centre.clone().addScaledVector(view, distance);
    return {
      position: position.toArray() as V,
      target: centre.toArray() as V,
      fov: STAGE_FOV,
      near: Math.min(Math.max(distance * 0.03, 0.004), 2),
      // the rail's own framing at this distance (`rail-math.ts`: distance × 0.24) — the lens leg ends on this frame —
      // or, close, the whole body
      fit: { center: centre.toArray() as V, radius: Math.max(distance * 0.24, hold) },
      drift: 0,
      orbit: { enabled: false },
    };
  };
  // the ring (outer diameter 2 · LENS.radius · scale) at `ring` of the frame's height, `lift` in front of the body
  const ringAt = (2 * LENS.radius * PART_VIEW.scale) / (PART_VIEW.ring * frameHeight());
  const door = shot(PART_VIEW.lift + ringAt);
  const lens = overPose(
    place.baseCentre,
    new Vector3(...(door.position as V)),
    PART_VIEW.lift,
    PART_VIEW.scale,
  );
  lens.grip = 1 / Math.max(PART_VIEW.scale, 1);
  // a phone keeps the whole opened body (its half and a fifth more), as a desk's frame does
  const inside = shot(size / (PART_VIEW.inside * frameHeight() * FRAME_ASPECT), size * 0.6);
  return { door, inside, view, lens };
}

/** The place of a part on the live bench: its sockets and its model's box; null off the board or with a leg out. */
export function placeOf(bench: Bench, partId: string): PartPlace | null {
  const part = bench.state.parts.get(partId);
  const model = bench.parts.models.get(partId);
  if (!part || !model) return null;
  return partPlace(bench.layout, part.legs, { centre: model.hit.position, size: model.hit.scale });
}

/**
 * The magnifier laid over a part of the live bench (base frame), as the dive lays it at the end of its lens leg; `from`
 * is the camera the dive starts from (world). Null when the part does not stand on the board.
 */
export function partLensPose(bench: Bench, partId: string, from: Vector3): LensPose | null {
  const place = placeOf(bench, partId);
  return place ? partStops(place, from).lens : null;
}
