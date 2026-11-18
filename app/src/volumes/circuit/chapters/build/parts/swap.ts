/**
 * `find-fault` 3, the repair: the far wire C (`m`, minus → lamp) with the broken copper is replaced by a whole one.
 * A still copy of the old wire (its geometry as it is at the touch, the wire's own materials) rises off the
 * staples, rolls back over the far edge of the board about its far stretch and drops out of sight behind it; meanwhile the stand's own piece — now whole — comes down from above onto its
 * staples (`Wiring.lift`). One number `t` 0 … 1 places everything (`SECONDS` long), so it can be played and snapped.
 */
import { Group, Mesh, Vector3, type Material } from 'three';
import { LOOP, type CircuitStage } from '@circuit/shared/stage';
import type { WireId } from '@circuit/shared/stage/wires';

export const SWAP_SECONDS = 2.4;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const span = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));

export interface Swap {
  /** Take the snapshot of the piece and start (the stand's piece is hidden until it comes down). */
  start(): void;
  /** 0 … 1 (1 = done: the copy is gone, the stand's piece in place). */
  readonly t: number;
  readonly running: boolean;
  update(dt: number): void;
  /** Done at once (deep links, leaving the step). */
  finish(): void;
}

export function createSwap(stage: CircuitStage, id: WireId, lift: Vector3): Swap {
  const wires = stage.stand.wires;
  const core = wires.core(id);
  const skin = wires.sheath(id);
  const holder = new Group();
  holder.name = `build-swap:${id}`;
  holder.visible = false;
  stage.base.frame.add(holder);
  let copies: Mesh[] = [];
  let t = 1;
  let running = false;
  const centre = new Vector3();
  /** The way off the staples and over the far edge, `u` 0 on the staples … 1 behind the board (board frame). */
  const way = (u: number, out: Vector3): Vector3 =>
    out.set(0, 0.42 * span(u, 0, 0.45) - 1.0 * span(u, 0.55, 1), -1.2 * span(u, 0.2, 0.85));
  const off = new Vector3();
  const place = (): void => {
    // the old wire leaves first (rolling as it goes over the edge); the new one comes the same way back, from
    // behind the board where the old one went — neither appears or vanishes in sight
    const u = Math.min(t / 0.5, 1);
    holder.rotation.x = -2.2 * span(u, 0.2, 0.85);
    holder.position.copy(way(u, off));
    // rotate about the wire's own line, not the board's centre
    holder.position.add(centre).sub(centre.clone().applyEuler(holder.rotation));
    holder.visible = running && u < 1;
    const v = Math.max((t - 0.5) / 0.5, 0);
    way(1 - v, lift);
    core.visible = skin.visible = !running || t >= 0.5;
  };
  return {
    get t() {
      return t;
    },
    get running() {
      return running;
    },
    start() {
      for (const m of copies) m.geometry.dispose();
      holder.clear();
      copies = [core, skin].map((src) => {
        const m = new Mesh(src.geometry.clone(), src.material as Material);
        // after the magnifier's iris: the old wire stays in sight through the ring as it leaves
        m.renderOrder = 960 + src.renderOrder;
        m.castShadow = false;
        holder.add(m);
        return m;
      });
      copies[0]!.geometry.computeBoundingSphere();
      // it rolls about its far stretch (the L of the left side swings up and over it)
      centre.set(copies[0]!.geometry.boundingSphere!.center.x, LOOP.y, LOOP.far);
      t = 0;
      running = true;
      place();
    },
    update(dt) {
      if (!running) return;
      t = Math.min(t + dt / SWAP_SECONDS, 1);
      place();
      if (t >= 1) this.finish();
    },
    finish() {
      t = 1;
      running = false;
      lift.set(0, 0, 0);
      core.visible = skin.visible = true;
      holder.visible = false;
    },
  };
}
