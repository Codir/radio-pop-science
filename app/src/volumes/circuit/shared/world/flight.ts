/**
 * Moving between floors, on the dive rail (`dive.ts`). While the rail is engaged it owns the camera and `deep`
 * every frame: the frame is a function of the rail's position, whether the hand scrubs it, a click travels it, or
 * a step change flies it. Around the rail:
 * - down from the stand plan: the lens goes onto the wire and the camera to `lens` first (one camera move), then
 *   the rail engages at 0 — the same pose — and travels;
 * - at the end of a travel to a step whose camera is not the stop's own shot (`race`, `copper-gate`, …): the rail
 *   lets go and one camera move takes the frame there, the lens returning to the step's `lens` value.
 */
import { Vector3 } from 'three';
import type { ChapterContext, Shot } from '@/engine/api';
import { REDUCED_MOTION } from '@/style';
import { STAGE_SHOTS } from '@circuit/shared/stage';
import type { DiveRail } from './dive';
import { LEG } from './levels';

const LENS_SHOT = new Vector3(...STAGE_SHOTS.lens.position);
/** Shot names at the rail's stops (0 lens · 1 «жила» · 2 «ряди» · 3 «один атом»). */
export const STOP_SHOTS = ['lens', 'handover', 'copper-rows', 'copper-atom'] as const;

export interface FlightPlan {
  /** Where to end: `deep` and the camera of the destination. */
  deep: number;
  camera: string | Shot;
  /** The stage param `lens` at the end (the lens lies over the wire during any time below the stand). */
  lens: number;
}

export interface Flight {
  /**
   * Go to a floor: lens leg if needed (`lead` seconds for it, default `LEG.lens`), rail travel, final camera move.
   * Replaces any flight under way.
   */
  fly(plan: FlightPlan, lead?: number): void;
  /** Lay the lens on the wire and bring the camera to `lens` (the dive step's «take the lens»). */
  takeLens(): void;
  /** The hand on the rail (engages it at once; the camera must already be on the rail's pose). */
  scrub(t: number): void;
  travelTo(t: number): void;
  /** Let the stage have the camera again (step entry). */
  release(): void;
  /** True while anything of a flight is still moving. */
  readonly flying: boolean;
  /** Every frame, before the world applies `deep`. */
  update(dt: number): void;
}

export function createFlight(
  ctx: ChapterContext,
  rail: DiveRail,
  deepNow: () => number,
  lensNow: () => number,
): Flight {
  const { stage, camera } = ctx;
  let engaged = false;
  /** Seconds of a camera-only move (lens leg, final move) still running. */
  let busy = 0;
  /** What to do when the rail arrives. */
  let pending: FlightPlan | null = null;
  /** The lens leg is running: engage and travel when it ends. */
  let afterLens: number | null = null;
  const span = (d: number): number =>
    ctx.reducedMotion ? Math.min(d, Math.max(0.3, d * REDUCED_MOTION.camera)) : d;
  const engage = (): void => {
    if (!engaged) rail.set(deepNow());
    engaged = true;
  };
  /** The lens onto the wire and the camera to `lens`; `seconds` longer when the camera comes from far away. */
  const lensLeg = (seconds: number = LEG.lens): void => {
    stage.setParam('lens', 1, { duration: span(Math.min(seconds, LEG.lens + 0.6)), ease: 'power2.inOut' });
    camera.go('lens', { duration: seconds, ease: 'power2.inOut' });
    busy = span(seconds);
  };
  const atLens = (): boolean => lensNow() > 0.99 && camera.camera.position.distanceTo(LENS_SHOT) < 0.4;

  const flight: Flight = {
    get flying() {
      return busy > 0 || afterLens !== null || pending !== null || (engaged && rail.moving);
    },
    fly(plan, lead) {
      pending = plan;
      afterLens = null;
      const from = deepNow();
      if (plan.deep > from && from < 0.01 && !atLens()) {
        lensLeg(lead);
        afterLens = plan.deep;
        return;
      }
      // the step's own tween would take the lens away while the reader is still below: hold it
      if (from > 0.01) stage.setParam('lens', 1, { instant: lensNow() > 0.99, duration: 0.4 });
      engage();
      rail.travelTo(plan.deep);
    },
    takeLens() {
      if (lensNow() > 0.99 && atLens()) return;
      lensLeg();
    },
    scrub(t) {
      pending = null;
      engage();
      rail.scrub(t);
    },
    travelTo(t) {
      pending = null;
      engage();
      rail.travelTo(t);
    },
    release() {
      engaged = false;
      pending = null;
      afterLens = null;
    },
    update(dt) {
      if (busy > 0) {
        busy = Math.max(0, busy - dt);
        if (busy === 0 && afterLens !== null) {
          const to = afterLens;
          afterLens = null;
          engage();
          rail.travelTo(to);
        }
      }
      if (!engaged) return;
      const t = rail.step(ctx.reducedMotion ? dt / REDUCED_MOTION.camera : dt);
      stage.setParam('deep', t, { instant: true });
      camera.go(rail.shotAt(t), { instant: true });
      if (pending && !rail.moving) {
        const plan = pending;
        pending = null;
        const stop = STOP_SHOTS[Math.round(plan.deep)];
        if (plan.camera !== stop) {
          // the rail's stop is not the step's frame: one camera move takes it there
          engaged = false;
          camera.go(plan.camera, { duration: LEG.lens + 0.3, ease: 'power2.inOut' });
          busy = span(LEG.lens + 0.3);
        }
        if (Math.abs(plan.lens - lensNow()) > 0.01)
          stage.setParam('lens', plan.lens, { duration: span(LEG.lens), ease: 'power2.inOut' });
      }
    },
  };
  return flight;
}
