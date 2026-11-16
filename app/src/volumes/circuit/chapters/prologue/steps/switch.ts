/**
 * The yellow slider of the switch as a direct control (steps `click` and `riddle`): a tap flips the stage param
 * `closed`; the slider and the filament follow with the stand's own inertia. A generous invisible hit volume
 * around the small slider keeps it easy to hit on every screen.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CircuitWorld } from '@circuit/shared/world';

export interface SwitchControl {
  /** How many times the lamp went from dark to lit since `reset()`. */
  readonly lightings: number;
  reset(): void;
  update(): void;
}

export function switchControl(
  ctx: ChapterContext,
  world: CircuitWorld,
  label: string,
  steps: readonly string[],
  /** Steps where the slider is only named on hover (no switching). */
  named: readonly string[] = [],
): SwitchControl {
  const slider = world.stand.stand.slider;
  const hit = new Mesh(
    new SphereGeometry(0.34, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'switch-hit';
  slider.add(hit);
  let lightings = 0;
  let lit = false;
  const step = (): string => ctx.stage.current ?? '';
  const active = (): boolean => steps.includes(step()) && !world.flying && world.deep < 0.01;
  ctx.input.register(hit, {
    tooltip: label,
    cursor: 'pointer',
    enabled: () => active() || named.includes(step()),
    click: () => {
      if (active()) ctx.stage.setParam('closed', world.value('closed') > 0.5 ? 0 : 1, { instant: true });
    },
  });
  ctx.qa.probe('switch', slider);
  return {
    get lightings() {
      return lightings;
    },
    reset() {
      lightings = 0;
      lit = world.stand.glow > 0.5;
    },
    update() {
      const now = world.stand.glow > 0.5;
      if (now && !lit) lightings++;
      lit = now;
    },
  };
}
