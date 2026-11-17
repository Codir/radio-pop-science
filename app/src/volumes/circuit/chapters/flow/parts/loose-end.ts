/**
 * `flow/connect`: the minus wire's end out of its clamp. The first stretch of the piece `m1` bends out of the
 * minus terminal and lies on the board in front of the clamp, its stripped copper end showing, a big `cyan` grip
 * on it (the practicum's handle, VISUAL §5.7). The reader drags the grip; near the terminal the end clicks in.
 * `out` 0…1 is how far the end is out (one number, both ways: «Назад» lays it out again); `hand` overrides the
 * resting place while the reader carries it. Everything in the board frame.
 */
import { Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { BATTERY, LOOP, WIRE, type CircuitStage } from '@circuit/shared/stage';
import { standPath } from '@circuit/shared/stage/wires';

/** Where the end lies when it is out: left of the minus clamp, in the near corner the lens has left (board frame). */
export const REST = new Vector3(BATTERY.minusX - 0.62, WIRE.sheath + 0.004, LOOP.near + 0.4);
/** The terminal's mouth the end goes into. */
export const MOUTH = new Vector3(BATTERY.minusX + 0.07, LOOP.y, LOOP.near);
/** Length of wire (from the terminal) that bends out with the end. */
const BEND = 1.4;
const UP = new Vector3(0, 1, 0);

export interface LooseEnd {
  /** 0 the end in its clamp … 1 lying on the board (or in the hand). */
  out: number;
  /** A point the reader holds the end at (board frame), or null. */
  hand: Vector3 | null;
  /** 0…1 how much the grip calls («take me»: full cyan, pulsing). */
  call: number;
  /** The grip (input target) and where the end is now (board frame). */
  grip: Mesh;
  readonly tip: Vector3;
  /** After the world's update (the stand re-lays the wires when the slider moves). */
  apply(t: number): void;
}

export function looseEnd(stand: CircuitStage): LooseEnd {
  const path = standPath('m1');
  const along: number[] = [];
  let acc = 0;
  path.forEach((p, i) => {
    if (i > 0) acc += p.distanceTo(path[i - 1]!);
    along.push(acc);
  });
  const material = K.toon({
    color: 'cyan',
    emissive: 'cyan',
    emissiveIntensity: 0.25,
    gloss: 0.6,
    keepHue: true,
  });
  const grip = new Mesh(G.capsule(0.1, 0.34, 20), material);
  grip.name = 'flow-loose-end:grip';
  grip.castShadow = true;
  const holder = new Group();
  holder.add(grip);
  stand.base.frame.add(holder);
  const bent: Vector3[] = path.map((p) => p.clone());
  const tip = new Vector3();
  const dir = new Vector3();
  const from = new Vector3();
  const axis = new Vector3();
  let laid = -1;
  const end: LooseEnd = {
    out: 1,
    hand: null,
    call: 0,
    grip,
    tip,
    apply(t) {
      const k = Math.min(Math.max(end.out, 0), 1);
      const e = k * k * (3 - 2 * k);
      from.copy(MOUTH);
      tip.copy(end.hand ?? REST);
      tip.lerpVectors(from, tip, e);
      // an arc while it travels: the end rises off the board between the clamp and its resting place
      tip.y += 0.35 * Math.sin(Math.PI * e) * (end.hand ? 0.4 : 1);
      if (k === 0 && laid === 0) {
        holder.visible = false;
        return;
      }
      // the bent stretch: each point moves by the end's displacement, fading out over BEND along the wire
      dir.subVectors(tip, MOUTH);
      for (let i = 0; i < path.length; i++) {
        const w = Math.max(1 - along[i]! / BEND, 0);
        const f = w * w * (3 - 2 * w);
        bent[i]!.copy(path[i]!).addScaledVector(dir, f);
        // lying on the board, the bent stretch sags onto it instead of floating at the staples' height
        bent[i]!.y = Math.max(
          bent[i]!.y - (LOOP.y - WIRE.sheath) * e * Math.sin(Math.PI * Math.min(f * 1.4, 1)) * 0.8,
          WIRE.sheath,
        );
      }
      stand.stand.wires.setShape('m1', { path: k === 0 ? path : bent, round: 1, cover: 1, copper: 1 });
      laid = k;
      // the grip sits on the wire just behind the stripped end, along the wire
      const a = bent[0]!;
      const b = bent[Math.min(6, bent.length - 1)]!;
      holder.position.lerpVectors(a, b, 0.55);
      holder.quaternion.setFromUnitVectors(UP, axis.subVectors(b, a).normalize());
      holder.visible = k > 0.002;
      const shown = Math.min(k * 3, 1);
      holder.scale.setScalar(Math.max(shown, 1e-3));
      const c = Math.min(Math.max(end.call, 0), 1);
      material.emissiveIntensity = 0.18 + c * (0.25 + 0.12 * Math.sin(t * 2.4));
    },
  };
  return end;
}
