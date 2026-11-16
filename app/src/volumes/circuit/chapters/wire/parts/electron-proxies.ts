/**
 * Moving pick proxies for the free electrons of the focal slab (`wire/restless`): one invisible ball per focus
 * electron, moved to it every frame, so the electron under the pointer is hovered and clicked exactly even at
 * full speed. They draw nothing (`material.visible = false`).
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { FOCUS_COUNT } from '@circuit/shared/copper/electron-sim';

/** Pick radius, local units (an electron is 1/6 of an atom; the finger needs more). */
const REACH = 0.62;
/** Only electrons this close to the focal plane are sharp enough to be taken (farther ones melt in the depth of
 *  field: a ring around them would circle a faint blur). */
const SHARP = 0.9;

export interface ElectronProxies {
  /** The electron under the pointer now, or −1. */
  hovered: number;
  /** Move the proxies onto their electrons (call every frame while enabled). */
  update(): void;
  /** The sharp electron nearest to a point of the focal plane (local units), or −1 — for tests. */
  nearest(x: number, y: number): number;
}

export function electronProxies(
  ctx: ChapterContext,
  copper: Copper,
  on: { enabled: () => boolean; click: (electron: number) => void },
): ElectronProxies {
  const geometry = new SphereGeometry(REACH, 10, 6);
  const material = new MeshBasicMaterial({ visible: false });
  const { sim } = copper;
  const sharp = (e: number): boolean => sim.shown[e]! > 0.5 && Math.abs(sim.pos[3 * e + 2]!) < SHARP;
  const out: ElectronProxies = {
    hovered: -1,
    update() {
      proxies.forEach((p, e) => {
        p.position.set(sim.pos[3 * e]!, sim.pos[3 * e + 1]!, sim.pos[3 * e + 2]!);
        p.visible = sharp(e);
      });
    },
    nearest(x, y) {
      let best = -1;
      let d = Infinity;
      for (let e = 0; e < FOCUS_COUNT; e++) {
        const q = Math.hypot(sim.pos[3 * e]! - x, sim.pos[3 * e + 1]! - y);
        if (sharp(e) && q < d) {
          d = q;
          best = e;
        }
      }
      return best;
    },
  };
  const proxies = Array.from({ length: FOCUS_COUNT }, (_, e) => {
    const proxy = new Mesh(geometry, material);
    proxy.name = `free-electron-proxy-${e}`;
    copper.space.add(proxy);
    ctx.input.register(proxy, {
      cursor: 'pointer',
      enabled: on.enabled,
      hover: (over) => {
        if (over) out.hovered = e;
        else if (out.hovered === e) out.hovered = -1;
      },
      click: () => on.click(e),
    });
    return proxy;
  });
  return out;
}
