/**
 * The border with `drain`: its last frame has the NEW battery in the cradle and the dead one lying on the shelf
 * left of the flashlight's housing (`chapters/drain/parts/spare.ts`, `docs/requests/B-circuit-drain.md` §3). Here
 * the stand's own battery is the fresh one, so the dead one is a second battery model, discharged, on that same
 * spot — mostly hidden behind the board's rear edge on the stand plan. `away` 1 on the shelf … 0 slid off its far
 * end, out of sight: the fold back into the flashlight clears the shelf for the prologue's frame.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { BATTERY, SHELF_WORLD, tameAll, type CircuitStage } from '@circuit/shared/stage';
import { createBattery } from '@circuit/shared/stage/battery';

/** `drain`'s spot (world) and where the battery goes when the shelf is cleared. */
const SHELF = new Vector3(-1.85, SHELF_WORLD.y + BATTERY.radius, SHELF_WORLD.z + 0.6);
const GONE = SHELF.clone().add(new Vector3(-1.2, -1.1, -0.9));

export interface ShelfBattery {
  update(on: number): void;
}

export function createShelfBattery(ctx: ChapterContext, stage: CircuitStage): ShelfBattery {
  const model = createBattery();
  model.charge = 0;
  model.group.name = 'build:dead-battery';
  ctx.root.add(model.group);
  tameAll(model.group);
  // on the shelf behind the board: no shadow of its own (the stand's cube shadow map counts every caster six times)
  model.group.traverse((o) => (o.castShadow = o.receiveShadow = false));
  let shown = -1;
  return {
    update(on) {
      // its print follows the room's light as the stand's battery's does
      model.light = stage.stand.battery.light;
      // and is not printed where the stand's is not (phones: under 14 px)
      model.printShown = stage.stand.battery.printShown;
      const k = Math.min(Math.max(on, 0), 1);
      if (k === shown) return;
      shown = k;
      const e = k * k * (3 - 2 * k);
      model.group.position.lerpVectors(GONE, SHELF, e);
      model.group.visible = k > 0.002;
    },
  };
}
