/**
 * Where the chapter's callouts stand (world points, every frame): over the oscilloscope's screen (the word a step's
 * takeaway names: «постійна напруга», «змінна напруга», «частота»; on a phone, where the scope is out of the shot, over
 * the tip of channel 1's probe), over a socket of a row (`twice`), over a part on the board (`amps`: the supply jumper)
 * and over the battery's switch (`flat`). Far below the bench while there is nothing to point at.
 */
import { Vector3 } from 'three';
import { PLACES, type Bench, type SocketId } from '@electronics/shared/bench';
import { SCOPE_SCREEN, type ScopeProbeName } from '@electronics/shared/instruments';

const NOWHERE = (out: Vector3): Vector3 => out.set(0, -100, 0);

/** The middle of the top edge of the scope's screen, a little in front of the glass. */
export function overScreen(bench: Bench, out = new Vector3()): Vector3 {
  const { x, bottom, height } = SCOPE_SCREEN;
  bench.oscilloscope.body.updateWorldMatrix(true, false);
  return bench.oscilloscope.body.localToWorld(out.set(x, bottom + height + 0.04, PLACES.scope.depth / 2 + 0.05));
}

/** Over a probe's tip on the board (or where it rests). */
export function overProbe(bench: Bench, name: ScopeProbeName, out = new Vector3()): Vector3 {
  const p = bench.oscilloscope.probes.get(name);
  if (!p) return NOWHERE(out);
  bench.board.group.updateWorldMatrix(true, false);
  return bench.board.group.localToWorld(out.copy(p.leg.pos).setY(p.leg.pos.y + 0.35));
}

/** Over a socket of the board, `lift` above its mouth. */
export function overSocket(bench: Bench, socket: SocketId, lift = 0.3, out = new Vector3()): Vector3 {
  const s = bench.layout.socket(socket);
  if (!s) return NOWHERE(out);
  bench.board.group.updateWorldMatrix(true, false);
  return bench.board.group.localToWorld(out.set(s.x, lift, s.z));
}

/** Over the middle of a part's legs on the board, `lift` above the sockets; nowhere while a leg is out of a socket. */
export function overPart(bench: Bench, id: string, lift = 0.3, out = new Vector3()): Vector3 {
  const legs = bench.state.parts.get(id)?.legs ?? [];
  let x = 0;
  let z = 0;
  for (const leg of legs) {
    const s = leg === null ? undefined : bench.layout.socket(leg);
    if (!s) return NOWHERE(out);
    x += s.x / legs.length;
    z += s.z / legs.length;
  }
  if (legs.length === 0) return NOWHERE(out);
  bench.board.group.updateWorldMatrix(true, false);
  return bench.board.group.localToWorld(out.set(x, lift, z));
}

/** Over the battery's switch (its slider). */
export function overSwitch(bench: Bench, out = new Vector3()): Vector3 {
  const g = bench.props.slider.group;
  g.updateWorldMatrix(true, false);
  return g.getWorldPosition(out).setY(out.y + 0.25);
}

/** The step's word at the takeaway: over the screen, on a phone over channel 1's probe. */
export function overTrace(bench: Bench, phone: boolean, out = new Vector3()): Vector3 {
  return phone ? overProbe(bench, 'ch1', out) : overScreen(bench, out);
}
