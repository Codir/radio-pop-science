/**
 * The jumper of the second switch seat (`flow/loop`): a short steel strip that closes the seat while the switch
 * sits in the first one. When the switch is laid into the second seat, the jumper hops in one motion (≈ 0.5 s)
 * into the first; back, the other way. `seat` 0 its own seat … 1 the first seat (the switch block's contacts).
 */
import { Vector3, type Group } from 'three';
import { SEAT, SWITCH } from '@circuit/shared/stage';

/** The part's origin on the face of each seat (board frame); on the switch block it rides the contacts. */
const HOME = new Vector3(SEAT.x, 0, SEAT.z);
const FIRST = new Vector3(SWITCH.x, 0.05, SWITCH.z);

export function placeJumper(jumper: Group, seat: number): void {
  const s = Math.min(Math.max(seat, 0), 1);
  const e = s * s * (3 - 2 * s);
  jumper.position.lerpVectors(HOME, FIRST, e);
  jumper.position.y += 0.9 * Math.sin(Math.PI * e);
  // a half turn about its long axis on the way: a flip, not a slide
  jumper.rotation.set(0, 0, Math.PI * e);
}
