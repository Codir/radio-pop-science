/**
 * A scripted repair (docs/volumes/electronics/VISUAL.md §4.8: a burnt part stays until it is taken out; a step may
 * replace it): a still copy of the old thing leaves along a way, and the new one comes the same way back. Copied from
 * `circuit/chapters/build/parts/swap.ts` (shared/README.md, «Копії») and made general: the circuit replaced one wire
 * of its stand along a fixed way over the board's far edge; here the parent, the thing and its way are parameters.
 * One number `t` 0 … 1 places everything (`seconds` long), so it can be played and snapped: the copy leaves in the
 * first half, the new one arrives in the second (`lift` is its offset from its place, for its owner to add).
 */
import { Group, Mesh, type Material, type Object3D, type Vector3 } from 'three';

export const SWAP_SECONDS = 2.4;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export interface Swap {
  /** Take the snapshot of the thing and start (the thing is hidden until it comes back). */
  start(): void;
  /** 0 … 1 (1 = done: the copy is gone, the thing in place). */
  readonly t: number;
  readonly running: boolean;
  update(dt: number): void;
  /** Done at once (deep links, leaving the step). */
  finish(): void;
}

/**
 * `way(u, out)`: the offset from the thing's place at `u` 0 (in place) … 1 (gone), in the frame of `parent`; `lift`
 * receives the new thing's offset while it arrives (zero when done).
 */
export function createSwap(
  parent: Object3D,
  thing: Object3D,
  way: (u: number, out: Vector3) => Vector3,
  lift: Vector3,
  seconds = SWAP_SECONDS,
): Swap {
  const holder = new Group();
  holder.name = `swap:${thing.name}`;
  holder.visible = false;
  parent.add(holder);
  let copies: Mesh[] = [];
  let t = 1;
  let running = false;
  const place = (): void => {
    const u = smooth(Math.min(t / 0.5, 1));
    way(u, holder.position);
    holder.visible = running && u < 1;
    const v = smooth(Math.max((t - 0.5) / 0.5, 0));
    way(1 - v, lift);
    thing.visible = !running || t >= 0.5;
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
      parent.updateWorldMatrix(true, false);
      thing.updateWorldMatrix(true, true);
      const toParent = parent.matrixWorld.clone().invert();
      copies = [];
      thing.traverseVisible((o) => {
        const src = o as Mesh;
        const m = src.material as Material | undefined;
        if (!src.isMesh || !m || !m.visible) return;
        const copy = new Mesh(src.geometry.clone(), src.material);
        copy.matrixAutoUpdate = false;
        copy.matrix.multiplyMatrices(toParent, src.matrixWorld);
        copy.castShadow = false;
        holder.add(copy);
        copies.push(copy);
      });
      t = 0;
      running = true;
      place();
    },
    update(dt) {
      if (!running) return;
      t = Math.min(t + Math.max(dt, 0) / seconds, 1);
      place();
      if (t >= 1) this.finish();
    },
    finish() {
      t = 1;
      running = false;
      lift.set(0, 0, 0);
      thing.visible = true;
      holder.visible = false;
      for (const m of copies) m.geometry.dispose();
      holder.clear();
      copies = [];
    },
  };
}
