/**
 * The yellow slider of the switch as a direct control (`heat`; inert elsewhere): a tap flips the stage param
 * `closed`; the slider and the filament follow with the stand's own inertia. A generous invisible hit volume
 * around the small slider keeps it easy to hit on every screen (the prologue's control, the same feel).
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CircuitWorld } from '@circuit/shared/world';

export interface SwitchControl {
  /** True while the switch is closed (the stage param `closed`). */
  readonly closed: boolean;
  /** May the reader flip it now (the step decides; never during a flight). */
  enabled: () => boolean;
  /** Called after each flip by the reader. */
  flipped: (closed: boolean) => void;
}

export function switchControl(ctx: ChapterContext, world: CircuitWorld): SwitchControl {
  const slider = world.stand.stand.slider;
  const hit = new Mesh(
    new SphereGeometry(0.34, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'resistance-switch-hit';
  slider.add(hit);
  const control: SwitchControl = {
    get closed() {
      return world.value('closed') > 0.5;
    },
    enabled: () => false,
    flipped: () => undefined,
  };
  ctx.input.register(hit, {
    cursor: 'pointer',
    enabled: () => control.enabled() && !world.flying && world.deep < 0.01,
    click: () => {
      const to = control.closed ? 0 : 1;
      ctx.stage.setParam('closed', to, { instant: true });
      control.flipped(to === 1);
    },
  });
  ctx.qa.probe('switch', slider);
  return control;
}
