/**
 * One end the hand moves on the bench (docs/volumes/electronics/VISUAL.md §6): a leg of a part, a plug of a lead, later
 * a probe's tip. Copied from `End` of `circuit/chapters/build/parts/ends.ts` (shared/README.md, «Копії»): where it
 * belongs now (a socket, lying on the bench, the hand, the tray) and where it is shown. Every change of place is a
 * travel from the pose on screen — eased, rising in a low arc (a short way rises less) — so an end never jumps,
 * whatever the step or the hand asks. One socket holds one end (the board's state says which): the circuit's clamps
 * for two ends, their sharing offsets and fan are not taken.
 *
 * `seated` is set ON ARRIVAL: the click is the moment of contact, and the board's netlist reads arrived ends only.
 *
 * Board frame: the sockets' mouths lie on y = 0.
 */
import { Vector3 } from 'three';
import type { SocketId } from '@electronics/sim/board';

export type Place =
  /** In a socket: the tip in its mouth. */
  | { readonly kind: 'socket'; readonly socket: SocketId }
  /** Lying on the bench where it was let go, its wire leaving along `out`. */
  | { readonly kind: 'lie'; readonly at: Vector3; readonly out: Vector3 }
  /** In the hand: the tip at `at` (the hand moves it, `carry`). */
  | { readonly kind: 'hand'; readonly at: Vector3 }
  /** In the tray, where a part taken from it starts and where a part let go off the board ends. */
  | { readonly kind: 'tray'; readonly at: Vector3 };

/** What a leg needs of the bench. */
export interface LegWorld {
  /** The mouth of a socket (board frame, y = 0 on the board's face) into `out`. */
  socket(id: SocketId, out: Vector3): Vector3;
  /** The height an end lying on the bench rests at over (x, z). */
  ground(x: number, z: number): number;
}

/** The pose a leg travels to. */
interface Pose {
  pos: Vector3;
  out: Vector3;
}

export class Leg {
  /** Shown pose: the tip, and the direction its wire (or the part's body) leaves it in the plan of the board. */
  readonly pos = new Vector3();
  readonly out = new Vector3(1, 0, 0);
  /** Where it belongs. */
  place: Place;
  /** The socket the end has ARRIVED in; null while it travels, lies, is held or is in the tray. */
  seated: SocketId | null;
  private readonly world: LegWorld;
  private readonly fromPos = new Vector3();
  private readonly fromOut = new Vector3();
  private k = 1;
  private seconds = 0;
  private lift = 0;
  private readonly target: Pose = { pos: new Vector3(), out: new Vector3(1, 0, 0) };
  private readonly tmp = new Vector3();

  constructor(world: LegWorld, place: Place, out?: Vector3) {
    this.world = world;
    this.place = place;
    if (out) this.out.copy(out);
    this.seated = place.kind === 'socket' ? place.socket : null;
    this.target.out.copy(this.out);
    this.resolve(this.target);
    this.pos.copy(this.target.pos);
    this.out.copy(this.target.out);
  }

  /** The socket it belongs in (arrived or on its way), or null. */
  get socket(): SocketId | null {
    return this.place.kind === 'socket' ? this.place.socket : null;
  }
  get held(): boolean {
    return this.place.kind === 'hand';
  }
  /** True while it travels to its place. */
  get moving(): boolean {
    return this.k < 1;
  }

  /**
   * Go to `place` from where it is shown, in `seconds` (0 = at once), rising by up to `lift` (a short way rises
   * less: at most 0.32 of it); `hop` rises by `lift` whatever the way — an end lifted out of its socket and put back.
   */
  go(place: Place, seconds: number, lift = 0.4, hop = false): void {
    if (place.kind !== 'socket' || place.socket !== this.seated) this.seated = null;
    this.place = place;
    this.fromPos.copy(this.pos);
    this.fromOut.copy(this.out);
    this.resolve(this.target);
    const way = this.fromPos.distanceTo(this.target.pos);
    this.seconds = seconds;
    this.lift = hop ? lift : Math.min(lift, way * 0.32);
    this.k = seconds > 0 && (hop || way + this.fromOut.distanceTo(this.target.out) > 1e-4) ? 0 : 1;
    if (this.k >= 1) this.snap();
  }

  /** Move the hand's point (a held end follows it at once). */
  carry(at: Vector3): void {
    if (this.place.kind === 'hand') this.place.at.copy(at);
  }

  /** Be where it belongs now (deep links, a preset). */
  snap(): void {
    this.k = 1;
    this.seated = this.socket;
    this.resolve(this.target);
    this.pos.copy(this.target.pos);
    this.out.copy(this.target.out);
  }

  /** `anchor`: where its wire or its part's body is, for the direction of an end that is not lying (plan only). */
  update(dt: number, anchor?: Vector3): void {
    this.resolve(this.target, anchor);
    if (this.k >= 1) {
      this.pos.copy(this.target.pos);
      this.out.copy(this.target.out);
      return;
    }
    this.k = Math.min(this.k + Math.max(dt, 0) / this.seconds, 1);
    if (this.k >= 1) this.seated = this.socket;
    const e = this.k * this.k * (3 - 2 * this.k);
    this.pos.lerpVectors(this.fromPos, this.target.pos, e);
    this.pos.y += this.lift * Math.sin(Math.PI * e);
    // the direction turns in the plan of the board (the shorter way round), never through zero — a lerp of opposite
    // directions would flip a wire's end over in one frame
    const a0 = Math.atan2(this.fromOut.z, this.fromOut.x);
    let d = Math.atan2(this.target.out.z, this.target.out.x) - a0;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    const a = a0 + d * e;
    this.out.set(Math.cos(a), 0, Math.sin(a));
  }

  private resolve(t: Pose, anchor?: Vector3): void {
    const p = this.place;
    if (p.kind === 'socket') this.world.socket(p.socket, t.pos);
    else if (p.kind === 'lie') {
      t.pos.copy(p.at);
      t.pos.y = this.world.ground(p.at.x, p.at.z);
      t.out.copy(p.out);
      return;
    } else t.pos.copy(p.at);
    // an end that is not lying leaves toward its anchor (its thing, its part's body), when there is one
    if (anchor) {
      this.tmp.subVectors(anchor, t.pos).setY(0);
      if (this.tmp.lengthSq() > 1e-8) t.out.copy(this.tmp.normalize());
    }
  }
}
