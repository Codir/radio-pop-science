/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand with the battery that opens
 * (`stand.stand.battery.inside`), the meter (`stand.tools.gauge`), the lens in the reader's hand, the metal of a
 * pole inside the lens and the pole scale. Every mount detail lives here; the steps speak of the cut, the poles,
 * the scale and shots.
 */
import { Vector3 } from 'three';
import type { ChapterContext, StepSpec } from '@/engine/api';
import {
  BATTERY_SHOTS,
  STAGE_POST,
  followVoltage,
  type BatteryInside,
  type CircuitStage,
  type GaugeModel,
} from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { caption } from './content';
import { createLensHand, type LensHand } from './parts/lens';
import { createPoleMetal, type PoleMetal } from './parts/metal';
import { CHAPTER_SHOTS } from './parts/poses';
import { createPoleScale, type PoleScale } from './parts/scale';

export type ShotName = 'stand' | 'poles' | 'cut' | 'meter';

/** A value the reader scrubs (UI_API §3.3): the thumb is `target`, the scene shows `shown`. */
export interface Scrub {
  target: number;
  shown: number;
  drag: boolean;
  /** Time constant of the glide toward `target` when not dragged (s): a critically damped spring, so a glide
   * starts and ends at rest (no kick at the start, as a plain exponential would give). */
  tau: number;
  /** Speed of the glide (per s). */
  v: number;
}

export interface BatteryWorld {
  ctx: ChapterContext;
  world: CircuitWorld;
  stand: CircuitStage;
  cell: BatteryInside;
  gauge: GaugeModel;
  lens: LensHand;
  metal: PoleMetal;
  scale: PoleScale;
  /** The «Розріз» of the battery: `cell.cut` follows `shown` every frame. */
  cut: Scrub;
  /** The meter: `want` 0 away … 1 on the table (it slides at its own pace), `volts` what the needle goes to. */
  meter: { want: number; volts: number };
  /** The declarative part of a step: shot (and its post), wire tint `poles`, the lens calling. */
  state(camera: ShotName, opts?: { poles?: number; lensCall?: number }): StepSpec;
  update(dt: number, t: number): void;
  /** After the step's own update: the lens pose and the window. */
  late(dt: number): void;
}

export function createBatteryWorld(ctx: ChapterContext): BatteryWorld {
  const world = mountWorld(ctx);
  world.drift = 0;
  const { stand } = world;
  ctx.camera.shots({ ...BATTERY_SHOTS, ...CHAPTER_SHOTS });
  const cell = stand.stand.battery.inside;
  // on a phone the ring over an end is drawn 1.6× (the frame has room above the sheet): the poles differ by the
  // electrons in it, not only by the scale card
  const lens = createLensHand(stand, () => (ctx.device.formFactor === 'phone' ? 1.6 : 1));
  const metal = createPoleMetal(world);
  const scale = createPoleScale({
    surplus: caption('poles', 0),
    equal: caption('poles', 1),
    lack: caption('poles', 2),
  });
  ctx.root.add(scale.group);
  // the meter waits off the table with its probes at rest until `voltage` brings it
  for (const probe of Object.values(stand.tools.gauge.probes)) probe.on = 0;
  const cut: Scrub = { target: 0, shown: 0, drag: false, tau: 0.3, v: 0 };
  const meter = { want: 0, volts: 0 };
  const gauge = stand.tools.gauge;
  let needle = 0;
  const close = new Set<ShotName>(['poles', 'cut']);

  const out: BatteryWorld = {
    ctx,
    world,
    stand,
    cell,
    gauge,
    meter,
    lens,
    metal,
    scale,
    cut,
    state: (camera, opts = {}) => ({
      camera,
      params: { deep: 0, closed: 0, lens: 0, poles: opts.poles ?? 1, lensCall: opts.lensCall ?? 0 },
      post: close.has(camera) ? STAGE_POST.lamp : STAGE_POST.stand,
    }),
    update(dt, t) {
      if (!cut.drag) {
        const w = 1 / cut.tau;
        const h = Math.min(dt, 1 / 30);
        cut.v += (w * w * (cut.target - cut.shown) - 2 * w * cut.v) * h;
        cut.shown = Math.min(Math.max(cut.shown + cut.v * h, 0), 1);
        if (Math.abs(cut.target - cut.shown) < 1e-4 && Math.abs(cut.v) < 1e-3) {
          cut.shown = cut.target;
          cut.v = 0;
        }
      } else {
        cut.shown = cut.target;
        cut.v = 0;
      }
      cell.cut = cut.shown;
      world.update(dt, t);
    },
    late(dt) {
      lens.update(dt);
      if (world.window.amount > 0.002) world.window.place(world.copper.group);
      metal.update();
      scale.update(dt);
      // the open section's own soft key light (the stage's island): on in the steps that look into the cut
      const step = ctx.stage.current;
      cell.island = step === 'inside' || step === 'balance' ? 1 : 0;
      // the meter slides on and off the table (0.9 s for the whole way), the needle answers as the battery does
      const k = Math.min(Math.abs(meter.want - gauge.shown), dt / 0.9);
      if (k > 0) gauge.shown += Math.sign(meter.want - gauge.shown) * k;
      needle = followVoltage(needle, meter.volts, dt);
      if (Math.abs(needle - gauge.value) > 1e-4) gauge.value = needle;
    },
  };
  return out;
}

/** A world point `out` beside an anchor, offset in the camera's screen plane (world units right / up). */
export function besideOnScreen(
  ctx: ChapterContext,
  at: Vector3,
  right: number,
  up: number,
  out: Vector3,
): Vector3 {
  const cam = ctx.camera.camera;
  const r = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const u = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  return out.copy(at).addScaledVector(r, right).addScaledVector(u, up);
}
