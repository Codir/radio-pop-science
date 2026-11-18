/**
 * The yellow slider of the switch as a direct control (as `prologue`'s and `lamp`'s): a tap flips the stage param `closed`; the
 * slider and the filament follow with the stand's own inertia. A generous invisible hit volume keeps the small
 * slider easy to hit on every screen. Steps say when it is live (`live`); elsewhere it only names itself.
 *
 * Counts what the goal of `ghost` needs: closings and openings, and how long the circuit has been
 * closed without a break.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CircuitWorld } from '@circuit/shared/world';

export interface SwitchControl {
  /** True while the switch is closed (the stage param `closed`). */
  readonly closed: boolean;
  /** Closings and openings by the reader since `reset()`. */
  readonly closings: number;
  readonly openings: number;
  /** Seconds the circuit has stayed closed, now (0 while open) and the longest stretch since `reset()`. */
  readonly closedFor: number;
  readonly longest: number;
  /** Seconds since the reader's last tap (Infinity before the first). */
  readonly since: number;
  /** The scene's own flip (step entries): no count. */
  set(closed: boolean, instant?: boolean): void;
  reset(): void;
  update(dt: number): void;
}

export function switchControl(
  ctx: ChapterContext,
  world: CircuitWorld,
  label: string,
  /** The reader may flip it now. */
  live: () => boolean,
): SwitchControl {
  const slider = world.stand.stand.slider;
  const hit = new Mesh(
    new SphereGeometry(0.34, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'switch-hit';
  slider.add(hit);
  let closings = 0;
  let openings = 0;
  let closedFor = 0;
  let longest = 0;
  let since = Infinity;
  const isClosed = (): boolean => world.value('closed') > 0.5;
  ctx.input.register(hit, {
    tooltip: label,
    cursor: 'pointer',
    enabled: () => live(),
    click: () => {
      if (!live()) return;
      const to = isClosed() ? 0 : 1;
      if (to) closings++;
      else openings++;
      since = 0;
      ctx.stage.setParam('closed', to, { instant: true });
    },
  });
  ctx.qa.probe('switch', slider);
  return {
    get closed() {
      return isClosed();
    },
    get closings() {
      return closings;
    },
    get openings() {
      return openings;
    },
    get closedFor() {
      return closedFor;
    },
    get longest() {
      return longest;
    },
    get since() {
      return since;
    },
    set(closed, instant = true) {
      ctx.stage.setParam('closed', closed ? 1 : 0, instant ? { instant } : { duration: 0.01 });
    },
    reset() {
      closings = openings = 0;
      closedFor = longest = 0;
      since = Infinity;
    },
    update(dt) {
      since += dt;
      closedFor = isClosed() ? closedFor + dt : 0;
      longest = Math.max(longest, closedFor);
    },
  };
}
