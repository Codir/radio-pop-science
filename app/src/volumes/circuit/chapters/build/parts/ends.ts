/**
 * One end of a practicum wire: where it belongs now (a clamp and a slot in it, a place on the board, the hand) and
 * where it is shown. Every change of place is a travel from the pose on screen — eased, rising in a low arc over
 * the board — so an end never jumps, whatever the step or the hand asks (board frame).
 */
import { Vector3 } from 'three';
import type { ClampId, WireKey } from './circuit';
import { CLAMPS, LYING, ground } from './clamps';
import type { EndPose } from './curves';

export type EndKey = 'a0' | 'a1' | 'b0' | 'b1' | 'c0' | 'c1';
export const END_KEYS: readonly EndKey[] = ['a0', 'a1', 'b0', 'b1', 'c0', 'c1'];

/** Sideways offset of each of two ends sharing a clamp, and how much they fan out. */
const SHARE_OFFSET = 0.052;
const SHARE_FAN = 0.32;
/** How high a carried end rides above the ground. */
const CARRY = 0.2;
const UP = new Vector3(0, 1, 0);

export type Place =
  | { kind: 'clamp'; clamp: ClampId; slot: number; shared: boolean }
  | { kind: 'lie'; at: Vector3; out: Vector3 }
  | { kind: 'hand'; at: Vector3 };

export class End implements EndPose {
  readonly key: EndKey;
  readonly wire: WireKey;
  readonly index: 0 | 1;
  /** Shown pose. */
  readonly pos = new Vector3();
  readonly out = new Vector3(1, 0, 0);
  /** Where it belongs. */
  place: Place;
  /** The bare copper touches the clamp (false: clamped with its sheath). */
  contact = true;
  /** The clamp the end has ARRIVED in (the click is the moment of contact; a re-seat inside it keeps it). */
  seated: ClampId | null;
  private readonly fromPos = new Vector3();
  private readonly fromOut = new Vector3();
  private k = 1;
  private seconds = 0;
  private lift = 0;
  private readonly target: EndPose = { pos: new Vector3(), out: new Vector3() };
  private readonly tmp = new Vector3();

  constructor(key: EndKey, place: Place) {
    this.key = key;
    this.wire = key[0] as WireKey;
    this.index = key[1] === '0' ? 0 : 1;
    this.place = place;
    this.seated = place.kind === 'clamp' ? place.clamp : null;
    this.resolve(this.target);
    this.pos.copy(this.target.pos);
    this.out.copy(this.target.out);
  }

  get clamp(): ClampId | null {
    return this.place.kind === 'clamp' ? this.place.clamp : null;
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
   * less); `hop` rises by `lift` whatever the way — an end lifted out of its clamp and put back.
   */
  go(place: Place, seconds: number, lift = 0.4, hop = false): void {
    if (place.kind !== 'clamp' || place.clamp !== this.seated) this.seated = null;
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

  snap(): void {
    this.k = 1;
    this.seated = this.clamp;
    this.resolve(this.target);
    this.pos.copy(this.target.pos);
    this.out.copy(this.target.out);
  }

  /** `anchor`: a point of the wire's body (for the direction of a carried end). */
  update(dt: number, anchor: Vector3): void {
    this.resolve(this.target, anchor);
    if (this.k >= 1) {
      this.pos.copy(this.target.pos);
      this.out.copy(this.target.out);
      return;
    }
    this.k = Math.min(this.k + dt / this.seconds, 1);
    if (this.k >= 1) this.seated = this.clamp;
    const e = this.k * this.k * (3 - 2 * this.k);
    this.pos.lerpVectors(this.fromPos, this.target.pos, e);
    this.pos.y += this.lift * Math.sin(Math.PI * e);
    // the direction turns on the board (the shorter way round), never through zero — a lerp of opposite directions
    // would flip the wire's end over in one frame
    const a0 = Math.atan2(this.fromOut.z, this.fromOut.x);
    let d = Math.atan2(this.target.out.z, this.target.out.x) - a0;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    const a = a0 + d * e;
    this.out.set(Math.cos(a), 0, Math.sin(a));
  }

  private resolve(t: EndPose, anchor?: Vector3): void {
    const p = this.place;
    if (p.kind === 'clamp') {
      const c = CLAMPS[p.clamp];
      t.pos.copy(c.mouth);
      t.out.copy(c.out);
      if (p.shared) {
        // two ends in one clamp: side by side, fanning out a little as they leave it
        const side = p.slot === 0 ? -1 : 1;
        const across = this.tmp.crossVectors(c.out, UP).normalize();
        t.pos.addScaledVector(across, side * SHARE_OFFSET);
        t.out.addScaledVector(across, side * SHARE_FAN).normalize();
      }
    } else if (p.kind === 'lie') {
      t.pos.copy(p.at);
      t.pos.y = ground(p.at.x, p.at.z);
      t.out.copy(p.out);
    } else {
      t.pos.copy(p.at);
      t.pos.y = Math.max(ground(p.at.x, p.at.z), LYING) + CARRY;
      // a carried end trails its wire: it leaves toward the body
      if (anchor) {
        this.tmp.subVectors(anchor, t.pos).setY(0);
        if (this.tmp.lengthSq() > 1e-4) t.out.copy(this.tmp.normalize());
      }
    }
  }
}
