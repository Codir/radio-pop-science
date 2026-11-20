/**
 * The bodies of the parts on the board as raised ground for the leads (recon synthesis §2.3, `hand/terrain.ts`): a plug
 * lying loose, its wire on the way to its socket and a plug in the hand go over a part, never through it. Every part
 * that stands on the board (the bench says which: not carried whole) is a mound — its body's box (`hit`) in the board's
 * frame, as it stands now. A mound rises in `SETTLE` when its part comes to stand, and sinks in `SETTLE` where it was
 * when the part leaves (taken whole, gone), so a lead over it never jumps. The parts' own legs do not lie on mounds: a
 * jumper's end let go beside its own body would climb it.
 */
import { Box3, Matrix4, Vector3, type Object3D } from 'three';
import type { Raised } from '../hand/terrain';

/** A mound rises (or sinks) in this time (s). */
export const SETTLE = 0.2;

export interface Mounds {
  /** The fixed raised ground, then the mounds (board frame): what the leads' terrain reads. */
  readonly list: readonly Raised[];
  /** Changes whenever `list` does. */
  readonly version: number;
  /**
   * Every frame, with the parts standing on the board now: id → its body's box (a unit box mesh scaled to the body).
   * `snap`: the mounds are where they belong at once (deep links).
   */
  update(dt: number, bodies: ReadonlyMap<string, Object3D>, snap?: boolean): void;
}

interface Mound {
  /** The part it stands for; null once the part has left (it sinks where it was). */
  id: string | null;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** The body's top over the board's face. */
  height: number;
  /** 0 … 1: how far it has risen. */
  w: number;
}

const ease = (x: number): number => x * x * (3 - 2 * x);
const UNIT = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));

/**
 * `frame` is the board's group; `fixed` what always stands up (the board's body, the things on the base); `lift` the
 * height of a wire's axis over the board's face (a mound's top is the body's top plus it).
 */
export function createMounds(frame: Object3D, fixed: readonly Raised[], lift: number): Mounds {
  const mounds: Mound[] = [];
  const list: Raised[] = [...fixed];
  const inv = new Matrix4();
  const rel = new Matrix4();
  const box = new Box3();
  let version = 0;

  return {
    list,
    get version() {
      return version;
    },
    update(dt, bodies, snap = false) {
      let changed = false;
      for (const m of mounds) if (m.id !== null && !bodies.has(m.id)) m.id = null;
      frame.updateWorldMatrix(true, false);
      inv.copy(frame.matrixWorld).invert();
      for (const [id, hit] of bodies) {
        hit.updateWorldMatrix(true, false);
        box.copy(UNIT).applyMatrix4(rel.multiplyMatrices(inv, hit.matrixWorld));
        const at = [box.min.x, box.max.x, box.min.z, box.max.z, Math.max(box.max.y, 0)] as const;
        const m = mounds.find((x) => x.id === id);
        if (!m) {
          mounds.push({ id, x0: at[0], x1: at[1], z0: at[2], z1: at[3], height: at[4], w: 0 });
          changed = true;
        } else if ([m.x0, m.x1, m.z0, m.z1, m.height].some((v, i) => Math.abs(v - at[i]!) > 1e-7)) {
          [m.x0, m.x1, m.z0, m.z1, m.height] = at;
          changed = true;
        }
      }
      const step = Math.max(dt, 0) / SETTLE;
      for (let i = mounds.length - 1; i >= 0; i--) {
        const m = mounds[i]!;
        const to = m.id !== null ? 1 : 0;
        const w = snap ? to : to > m.w ? Math.min(m.w + step, 1) : Math.max(m.w - step, 0);
        if (w !== m.w) {
          m.w = w;
          changed = true;
        }
        if (m.id === null && m.w <= 0) {
          mounds.splice(i, 1);
          changed = true;
        }
      }
      if (!changed) return;
      version++;
      list.length = fixed.length;
      for (const m of mounds) {
        list.push({ x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1, top: lift + m.height * ease(m.w) });
      }
    },
  };
}
