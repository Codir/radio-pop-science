/**
 * The magnifier as the door to a part's floors (docs/volumes/electronics/VISUAL.md §7), copied in its shape from
 * `circuit/chapters/lamp/parts/door.ts` (shared/README.md, «Копії»): there the door into the lamp, here into any part
 * on the board, its stops computed from where the part stands (`poses.ts`). One position −½ … 1 of the door's camera
 * rail is the whole way, both ways, at any speed:
 *
 * - −½ … 0, the lens leg: the lens rises out of its holder and lands over the part (by 85 % of the leg), the camera
 *   following from the step's shot (`lead`) to the lens at work over the part (`PartStops.door`), about as far;
 * - 0 … 1, through the ring: the camera pushes in to `inside` on the same line — the floor `part` from halfway
 *   (`levels.ts`), the body large, its bands read; the ring comes to meet it, passes it at `PASS` and stays as the thin
 *   cyan arcs in the frame's corners (`rim`); its glass thins out on the way so the tint never snaps; past the ring the
 *   part opens (`cut`, `cutaway.ts`: a resistor's carbon film, `shared/inside/film.ts`; an electrolytic's plates, a film
 *   capacitor's roll) and stands opened at the end, the floor `inside`; the door feeds the inner view what the bench's
 *   model says of the part every frame (its current, its heat, whether it burnt, a capacitor's voltage across its
 *   capacitance and whether it bulged).
 *
 * The door follows its part: while its rail rests on the step's shot, a part moved to other sockets (or the phone's
 * shot instead of the desk's) gives it new stops. The camera is the rail's only while it is off the step's shot: back
 * there, at rest, the rail lets it go and the step's shot is held. While it is off, the hand and the battery's switch do
 * nothing (`bench.flying`, written when it changes). A chapter feeds the rail from its depth slider (`travelTo`, and
 * `rail.scrub` for a drag) and lays the magnifier with its keeper from `lens`, `rim` and `glass` (`lens-keeper.ts`).
 */
import { Vector3 } from 'three';
import type { ChapterContext, Shot } from '@/engine/api';
import {
  LENS,
  benchShots,
  boardToWorld,
  worldToBoard,
  type Bench,
  type BenchShot,
  type LensPose,
} from '../bench';
import { cameraRail, type CameraRail } from './camera-rail';
import { createCutaway, type Cutaway } from './cutaway';
import { emptyPose, mixPose } from './lens-keeper';
import { FLOOR_FROM, flightSeconds, floorAt, type FloorId } from './levels';
import { placeOf, partStops, type PartPlace, type PartStops } from './poses';
import { LENS_LEG, leadLens } from './rail-math';

/** Share of the door leg at which the ring reaches the camera (as in `circuit`). */
export const PASS = 0.82;
/**
 * The stretch of the door leg over which the part opens (`cut` 0 → 1): from just before the ring passes the camera to
 * the floor `inside` — on the floor `part` before it the part is whole, its bands to be read.
 */
export const CUT_OPENS: readonly [number, number] = [PASS - 0.04, FLOOR_FROM.inside];

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const ramp = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
const smooth = (x: number): number => x * x * (3 - 2 * x);

export interface DoorOptions {
  /** The bench's shot the dive starts from and comes back to (default `board`; on a phone every shot is `phone`). */
  readonly lead?: BenchShot;
}

export interface Door {
  readonly partId: string;
  /**
   * The camera's rail: −`LENS_LEG` the step's shot with the lens in its holder … 0 the floor `part` … 1 `inside`.
   * Built anew when the part moves while the rail rests on the step's shot: read it from the door each time.
   */
  readonly rail: CameraRail;
  /** The part stands on the board with every leg in a socket: the door leads somewhere. */
  readonly ready: boolean;
  /** The stops built from where the part stood last (null until it first stood on the board). */
  readonly stops: PartStops | null;
  /** The floor on screen while the dive is off the step's shot; null on it (the ladder hides). */
  readonly floor: FloorId | null;
  /** The camera is off the step's shot (flying or resting below): the hand does nothing. */
  readonly flying: boolean;
  /** The part's inner view (null for a kind with none yet, or while the part has no model): a resistor's is its film,
   * an electrolytic's its plates, a film capacitor's its roll (`shared/inside` `asFilm`, `asPlates`, `asRoll`: the
   * callouts' points, the numbers). */
  readonly cutaway: Cutaway | null;
  /** The lens's pose for a position (base frame; the rail's camera for that position is read from the rail). */
  lens(t: number): LensPose;
  /** The rim's arcs, the glass and the part's cut for a position. */
  rim(t: number): number;
  glass(t: number): number;
  cut(t: number): number;
  /** Glide to a position of the rail in the flight's time (`flightSeconds`: reduced motion shortens it). */
  travelTo(t: number): void;
  /**
   * Back to the step's shot with the lens to its holder: glides there, arrived, the rail lets the camera go, which then
   * moves to the shot `then` (default: the lead shot is held where it is); or at once (`instant`, a step entered without
   * motion): the rail is put on its start (`lens(rail.position)` is the holder's pose) and lets the camera go where it
   * is, on the shot the new step has already put it on (`then` is not used).
   */
  home(opts?: { instant?: boolean; then?: string }): void;
  /** Every frame after `bench.update`: follows the part, advances the rail, opens the part, says whether it flies. */
  update(dt: number): void;
  /** Gives the camera and the part back: the rail released, the part whole, the checks' readers gone. */
  dispose(): void;
}

export function partDoor(ctx: ChapterContext, bench: Bench, partId: string, opts: DoorOptions = {}): Door {
  const leadName: BenchShot = opts.lead ?? 'board';
  const phone = (): boolean => ctx.device.formFactor === 'phone';
  const leadShot = () => benchShots(phone())[leadName];
  const holder = bench.tools.holder;

  /** A rail through `through` from the lead shot, resting at its start (the step's shot, the lens in its holder). */
  const railOf = (through: readonly [Shot, Shot]): CameraRail => {
    const r = cameraRail(ctx, through, leadShot());
    r.rail.set(r.rail.min);
    return r;
  };
  let place: PartPlace | null = null;
  let stops: PartStops | null = null;
  /** The sockets, the form factor and the lead the stops were built for, and those last looked at. */
  let built = '';
  let seen = '';
  /** A rail with no part yet: both stops are the step's own shot, so a slider moves nothing. */
  let rail: CameraRail = railOf([leadShot(), leadShot()]);
  const rest = (): boolean => !rail.engaged || (!rail.moving && rail.position <= rail.rail.min + 1e-9);
  const build = (p: PartPlace, key: string): void => {
    const lead = leadShot();
    stops = partStops(p, new Vector3(...(lead.position as [number, number, number])));
    const wasEngaged = rail.engaged;
    rail.release();
    rail = railOf([stops.door, stops.inside]);
    // resting on the step's shot: the new rail's start is that very frame, so taking the camera there changes nothing
    if (wasEngaged) rail.snap(rail.rail.min);
    built = key;
  };
  /** Where the part stands now (null: not on the board with every leg in a socket); new stops while at rest. */
  const follow = (): void => {
    const part = bench.state.parts.get(partId);
    const standing = part !== undefined && bench.parts.models.has(partId) && part.legs.every((s) => s !== null);
    if (!standing) {
      place = null;
      seen = '';
      return;
    }
    const key = `${part.legs.join(' ')}|${phone() ? 'phone' : 'desk'}|${leadName}`;
    if (key !== seen || !place) {
      place = placeOf(bench, partId);
      seen = key;
    }
    if (place && key !== built && rest()) build(place, key);
  };
  follow();

  /** Where to go once the rail is back on the step's shot (undefined: no way home under way). */
  let homing: { then: string | null } | undefined;
  let flying = false;
  let cutaway: Cutaway | null = null;
  let cutModel: object | null = null;
  let time = 0;

  const pose = emptyPose();
  const eye = emptyPose();
  const cam = new Vector3();
  const position = (): number => rail.position;

  const door: Door = {
    partId,
    get rail() {
      return rail;
    },
    get ready() {
      return place !== null;
    },
    get stops() {
      return stops;
    },
    get floor() {
      return rail.engaged && rail.position > rail.rail.min + 1e-3 ? floorAt(rail.position) : null;
    },
    get flying() {
      return flying;
    },
    get cutaway() {
      return cutaway;
    },
    lens(t) {
      if (!stops) return holder;
      const over = stops.lens;
      if (t <= 0) {
        const u = clamp01((t + LENS_LEG) / LENS_LEG);
        return mixPose(holder, over, smooth(leadLens(u)), 0.7, pose);
      }
      // the ring travels from over the part toward the camera along their line, facing it, and on past it
      worldToBoard(cam.fromArray(rail.rail.shotAt(t).position as readonly number[] as number[]), cam);
      const k = smooth(ramp(t, 0.04, 1)) / smooth(ramp(PASS, 0.04, 1));
      eye.position.copy(over.position).lerp(cam, k);
      eye.facing.copy(cam).sub(over.position).normalize();
      eye.handle.copy(over.handle);
      eye.scale = over.scale ?? 1;
      eye.grip = over.grip ?? 1;
      return mixPose(over, eye, 1, 0, pose);
    },
    rim: (t) => smooth(ramp(t, PASS - 0.3, PASS)),
    glass: (t) => 1 - smooth(ramp(t, PASS - 0.32, PASS - 0.04)),
    cut: (t) => smooth(ramp(t, CUT_OPENS[0], CUT_OPENS[1])),
    travelTo(t) {
      rail.travelTo(t, flightSeconds(t - rail.position, ctx.reducedMotion));
    },
    home({ instant = false, then } = {}) {
      if (!rail.engaged) return;
      if (instant) {
        // the rail's own position back to the step's shot, without driving the camera (`rail.snap` would cut it back
        // to the lead shot over the shot the new step has just put it on)
        rail.rail.set(rail.rail.min);
        rail.release();
        homing = undefined;
        return;
      }
      rail.travelTo(rail.rail.min, flightSeconds(rail.position - rail.rail.min, ctx.reducedMotion));
      homing = { then: then ?? null };
    },
    update(dt) {
      follow();
      rail.update(dt);
      // back on the step's shot and at rest: the camera is the step's again
      if (rail.engaged && !rail.moving && rail.position <= rail.rail.min + 1e-9) {
        rail.release();
        const then = homing?.then ?? null;
        homing = undefined;
        if (then && then !== leadName) ctx.camera.go(then, { duration: 1.6, ease: 'sine.inOut' });
        else ctx.camera.hold(leadName);
      }
      // the part's cutaway: made with its model (the planes parked: opening it compiles nothing), opened by the rail
      const model = bench.parts.models.get(partId) ?? null;
      if (model !== cutModel) {
        cutaway?.dispose();
        cutaway = model ? createCutaway(model) : null;
        cutModel = model;
      }
      if (cutaway && stops) cutaway.set(rail.engaged ? door.cut(position()) : 0, stops.view);
      // the inner view shows the model's state of the part: its current, its heat, a burn, a capacitor's voltage across
      // its capacitance and its bulging (the last good solve's while the model's last solve failed)
      if (cutaway?.follow) {
        time += Math.max(dt, 0);
        // (a part out of the circuit, a burnt one solved out, has no reading: no current through it)
        const state = bench.model.part(partId);
        const amps = state ? (bench.model.reading(partId)?.i ?? 0) : 0;
        // the operating point's memory (`PartMemory.volts`, written by every good solve) until the bench counts in time
        const memory = bench.model.state.parts.get(partId);
        cutaway.follow(
          state
            ? {
                amps,
                heat: state.heat,
                burnt: state.condition === 'burnt',
                volts: memory?.volts ?? 0,
                bulged: memory?.bulged === true || state.condition === 'bulged',
              }
            : null,
          dt,
          time,
        );
      }
      const now = rail.engaged && (rail.moving || rail.position > rail.rail.min + 1e-6);
      if (now !== flying) {
        flying = now;
        bench.flying = now;
      }
    },
    dispose() {
      rail.release();
      cutaway?.dispose();
      cutaway = null;
      cutModel = null;
      if (flying) bench.flying = flying = false;
      for (const off of qa) off();
    },
  };

  // QA: `__app.read('electronics-dive')` — where the dive is, every frame; probes for the body's two ends (its share of
  // the frame on `part`) and the top and bottom of the lens's ring along the camera's up (the ring's share of it)
  const end = (sign: number) => {
    const v = new Vector3();
    return (): Vector3 =>
      place ? v.copy(place.centre).addScaledVector(place.axis, (sign * place.size) / 2) : v.set(0, -100, 0);
  };
  const ring = (sign: number) => {
    const v = new Vector3();
    const up = new Vector3();
    return (): Vector3 => {
      const lens = bench.tools.lens;
      lens.ring.updateWorldMatrix(true, false);
      const r = LENS.radius * lens.group.getWorldScale(up).x;
      up.setFromMatrixColumn(ctx.camera.camera.matrixWorld, 1).normalize();
      return lens.ring.getWorldPosition(v).addScaledVector(up, sign * r);
    };
  };
  const qa = [
    ctx.qa.probe('dive:end0', end(-1)),
    ctx.qa.probe('dive:end1', end(1)),
    ctx.qa.probe('dive:ring-top', ring(1)),
    ctx.qa.probe('dive:ring-bottom', ring(-1)),
    ctx.qa.expose('electronics-dive', () => ({
      part: partId,
      ready: door.ready,
      engaged: rail.engaged,
      position: rail.position,
      target: rail.target,
      moving: rail.moving,
      min: rail.rail.min,
      floor: door.floor,
      flying,
      bench: bench.flying,
      cut: cutaway?.amount ?? 0,
      open: cutaway?.open ?? false,
      inside: cutaway?.state?.() ?? null,
      camera: ctx.camera.camera.getWorldPosition(new Vector3()).toArray(),
      aim: ctx.camera.target.toArray(),
      lens: bench.tools.lens.ring.getWorldPosition(new Vector3()).toArray(),
      // the lens lies in its holder (its ring where the holder's pose puts it, within a micrometre of the bench)
      atHolder:
        bench.tools.lens.ring
          .getWorldPosition(new Vector3())
          .distanceTo(boardToWorld(holder.position.x, holder.position.y, holder.position.z)) < 1e-3,
      stops: stops && { door: stops.door.position, inside: stops.inside.position, target: stops.door.target },
    })),
  ];
  return door;
}
