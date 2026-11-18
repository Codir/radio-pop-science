/**
 * The yellow slider of the switch as a direct control (steps `click` and `dive`; inert elsewhere): a tap flips the
 * stage param `closed`; the slider and the filament follow with the stand's own inertia. A generous invisible hit
 * volume around the small slider keeps it easy to hit on every screen. `close()` is the scene's own flip (`dive`:
 * the light comes on the moment the reader starts the dive, the owner 2026-11-17).
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CircuitWorld } from '@circuit/shared/world';

export interface SwitchControl {
  /** How many times the lamp went from dark to lit since `reset()`. */
  readonly lightings: number;
  /** True while the switch is closed (the stage param `closed`). */
  readonly closed: boolean;
  /** Close the switch if it is open (the slider flips, the light comes on in this frame). */
  close(): void;
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
  /** Extra condition for switching (default: no flight under way), and what a reader's tap also does. */
  opts: { when?: () => boolean; touched?: () => void } = {},
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
  const allowed = opts.when ?? ((): boolean => !world.flying);
  const active = (): boolean => steps.includes(step()) && world.deep < 0.01 && allowed();
  ctx.input.register(hit, {
    tooltip: label,
    cursor: 'pointer',
    enabled: () => active() || named.includes(step()),
    click: () => {
      if (!active()) return;
      opts.touched?.();
      ctx.stage.setParam('closed', world.value('closed') > 0.5 ? 0 : 1, { instant: true });
    },
  });
  ctx.qa.probe('switch', slider);
  return {
    get lightings() {
      return lightings;
    },
    get closed() {
      return world.value('closed') > 0.5;
    },
    close() {
      if (world.value('closed') < 0.5) ctx.stage.setParam('closed', 1, { instant: true });
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
