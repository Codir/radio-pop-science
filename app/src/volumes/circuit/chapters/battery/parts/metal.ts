/**
 * The metal of a pole seen in the lens (`battery/poles`, VISUAL §3 «лупа — вікно», §6): the composed world's lens
 * window shows the copper world at «ряди»; here it is turned into the metal just under a pole's surface — the top
 * surface of the crystal in the upper part of the ring, no plastic above it. `charge` −1 … 1: + = the minus cap
 * (the free electrons crowd under the surface), − = the plus nub (a band under the surface the electrons avoid,
 * the edge atoms glow `coral`). It glides with the lens from one end to the other.
 */
import { Vector3 } from 'three';
import { COPPER_TOP } from '@circuit/shared/copper/layout';
import type { CircuitWorld } from '@circuit/shared/world';

export interface PoleMetal {
  /** −1 (plus: lack) … 0 … 1 (minus: surplus). */
  charge: number;
  /** Whether the window shows the pole's metal (and the copper world is adjusted for it). */
  active: boolean;
  /** Call after the world's update (the window has been placed there): moves the surface into the ring. */
  update(): void;
}

/** Local height of the window's centre: the surface (`COPPER_TOP`) sits 3.4 units above it. */
const VIEW_Y = COPPER_TOP - 2.9;
/** Copper units across the ring: closer than over the wire, so a few atoms and electrons read at a glance. */
const SPAN = 9.5;

export function createPoleMetal(world: CircuitWorld): PoleMetal {
  const { copper } = world;
  const up = new Vector3();
  let was = false;
  let span = world.window.span;
  let width = copper.sim.width;
  const metal: PoleMetal = {
    charge: 0,
    active: false,
    update() {
      const on = metal.active;
      if (on !== was) {
        was = on;
        if (on) {
          span = world.window.span;
          world.window.span = SPAN;
          width = copper.sim.width;
          copper.sim.width = SPAN * 0.58;
        } else {
          world.window.span = span;
          copper.sim.width = width;
          copper.sim.surface = 0;
          copper.lattice.edge = 0;
          copper.look.x = copper.look.y = 0;
        }
      }
      if (!on) return;
      // a pole has no sheath: nothing above the metal but the dark
      copper.plastic.group.visible = false;
      copper.look.x = 0;
      copper.look.y = VIEW_Y;
      copper.sim.surface = metal.charge;
      copper.lattice.edge = Math.max(0, -metal.charge);
      if (world.window.amount <= 0.002) return;
      // the window put the copper's origin at the centre of the glass: slide it down by VIEW_Y along its own up
      const g = copper.group;
      up.set(0, 1, 0).applyQuaternion(g.quaternion);
      g.position.addScaledVector(up, -VIEW_Y * g.scale.x);
      g.updateMatrixWorld(true);
    },
  };
  return metal;
}
