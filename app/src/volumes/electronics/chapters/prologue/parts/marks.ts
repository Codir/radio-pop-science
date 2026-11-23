/**
 * Where the chapter's callouts stand (world points, every frame) — over a socket of a row (`riddle`), over the board's
 * middle (`loud`: «підсилювач») — and the step's call: a thing the step wants touched pulses `cyan` (VISUAL §6: + 0,25
 * + 0,12 · sin(2,4 t) of glow, the hand's own call of a part waiting in the air), a part on the board through the
 * bench's `parts.glow`, the player through its body's materials the same way. Far below the bench while there is
 * nothing to point at.
 */
import { Vector3 } from 'three';
import type { Bench, SocketId } from '@electronics/shared/bench';

const NOWHERE = (out: Vector3): Vector3 => out.set(0, -100, 0);

/** Over a socket of the board, `lift` above its mouth. */
export function overSocket(bench: Bench, socket: SocketId, lift = 0.3, out = new Vector3()): Vector3 {
  const s = bench.layout.socket(socket);
  if (!s) return NOWHERE(out);
  bench.board.group.updateWorldMatrix(true, false);
  return bench.board.group.localToWorld(out.set(s.x, lift, s.z));
}

/** Over the middle of the field of sockets, `lift` above the board's face. */
export function overBoard(bench: Bench, lift = 1.1, out = new Vector3()): Vector3 {
  bench.board.group.updateWorldMatrix(true, false);
  return bench.board.group.localToWorld(out.set(0, lift, 0));
}

/** The glow of a step's call at engine time `t`: the hand's pulse of a part waiting to be taken (VISUAL §6). */
export const callGlow = (t: number): number => 0.25 + 0.12 * Math.sin(t * 2.4);

/**
 * A step's call on one thing at a time: `to(id, t)` every frame — a part's id on the board, `player` for the player's
 * box, null for none. The thing called before goes back to no glow; the hand's glow under the pointer comes back with
 * its next change.
 */
export interface Call {
  to(id: string | null, t: number): void;
  /** What is called now. */
  readonly id: string | null;
}

export const PLAYER_CALL = 'player';

export function createCall(bench: Bench): Call {
  let now: string | null = null;
  const glow = (id: string, amount: number): void => {
    if (id === PLAYER_CALL) for (const m of bench.props.things.player.body) m.setEmissive('cyan', amount);
    else bench.parts.glow(id, amount);
  };
  return {
    to(id, t) {
      if (now !== null && now !== id) glow(now, 0);
      now = id;
      if (id !== null) glow(id, callGlow(t));
    },
    get id() {
      return now;
    },
  };
}
