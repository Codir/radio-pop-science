/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand, the battery's hours, the meter on
 * the battery's clamps, the counter frame on the right wire, the section. ONE chain makes the dying battery
 * (DECISIONS §60 p, w; VISUAL §5.8): hours → `lifeAtHours` → the battery's numbers (`battery-cell.ts`) → current →
 * `heatOfCurrent` → the lamp's heat, its light and the room (`stand.glowOf`). The needle, the frame's number and the
 * filament's colour are three readings of that one life, in the same frame.
 */
import { Vector3 } from 'three';
import type { ChapterContext, Shot } from '@/engine/api';
import type { CalloutSpec } from '@/hud';
import {
  BATTERY_SHOTS,
  LOOP,
  POLE_MARK,
  STAGE_POST,
  STAGE_SHOTS,
  followVoltage,
  heatOfCurrent,
  lifeAtHours,
  loadCurrent,
  meterVoltage,
  type BatteryInside,
  type CircuitStage,
  type FrameModel,
  type GaugeModel,
} from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { scrub, stepScrub, type Scrub } from './parts/scrub';
import { DRAIN_SHOTS, type DrainShot } from './shots';

/** The slider «Години» runs 0 … 8 h (script); the battery is dead at `lifeHours()` ≈ 8.0 h. */
export const HOURS_END = 8;
/** Where the counter frame stands: on the right wire, a little in from the near corner (board frame). */
const FRAME_AT = new Vector3(LOOP.right, LOOP.y, 0.62);
const FRAME_TANGENT = new Vector3(0, 0, -1);
const NBSP = ' ';

/** «0,31 A»: two decimals, so the number moves with the slider; comma and no-break space (DECISIONS §23). */
export function formatAmps(a: number): string {
  return `${Math.max(a, 0).toFixed(2).replace('.', ',')}${NBSP}A`;
}

/** «1,5 V»: the meter's reading as its number shows it (one decimal). */
export function formatVolts(v: number): string {
  return `${Math.max(v, 0).toFixed(1).replace('.', ',')}${NBSP}V`;
}

/**
 * On a phone the meter's printed scale and number are under 14 px: its reading stands in the interface at the
 * meter instead (as the frame's number does). Add it to a step's callouts.
 */
export function phoneMeter(ctx: ChapterContext, dw: DrainWorld, here: () => boolean): CalloutSpec {
  const at = new Vector3();
  return {
    anchor: () => dw.gauge.anchor.getWorldPosition(at),
    text: () => formatVolts(dw.volts),
    side: 'up',
    visible: () => here() && ctx.device.formFactor === 'phone' && dw.gauge.shown > 0.95,
    priority: 0,
  };
}

export interface DrainWorld {
  ctx: ChapterContext;
  world: CircuitWorld;
  stand: CircuitStage;
  cell: BatteryInside;
  gauge: GaugeModel;
  frame: FrameModel;
  /** The «Години» of the stand's battery (0 … `HOURS_END`); everything below follows `shown`. */
  hours: Scrub;
  /** The section of the battery 0 … 1 (`cell.cut`). */
  cut: Scrub;
  /** The stand's battery's life now (0 fresh … 1 dead) — a function of `hours.shown`. */
  readonly life: number;
  /**
   * The battery the lamp hangs on (`life`): `fresh` = the new one is in the cradle (life 0); `contact` 0 … 1 —
   * the circuit runs through the cradle (0 while one battery leaves and the other arrives).
   */
  cradle: { fresh: boolean; contact: number };
  /** The meter: `want` 0 away … 1 on the table; `probes` 0 resting … 1 on the clamps; `needle` the law it follows:
   *  'meter' = the instrument's own settle (the hours scrub), 'battery' = `followVoltage` (`ghost`). */
  meter: { want: number; probes: number; needle: 'meter' | 'battery' };
  /** The counter frame on the right wire: `want` 0 … 1. */
  counter: { want: number };
  /** Volts the needle stands at now, amperes through the lamp now. */
  readonly volts: number;
  readonly amps: number;
  /** The declarative part of a step: shot (and its post), switch, wire tint. */
  state(
    camera: DrainShot,
    opts?: { closed?: number },
  ): { camera: string; params: Record<string, number>; post: object };
  shot(name: string): Shot;
  update(dt: number, t: number): void;
}

const ALL: Record<string, Shot> = { ...STAGE_SHOTS, ...BATTERY_SHOTS, ...DRAIN_SHOTS };

export function createDrainWorld(ctx: ChapterContext): DrainWorld {
  const world = mountWorld(ctx);
  world.drift = 0;
  const { stand } = world;
  ctx.camera.shots({ ...BATTERY_SHOTS, ...DRAIN_SHOTS });
  const cell = stand.stand.battery.inside;
  const { gauge, frame } = stand.tools;
  for (const probe of Object.values(gauge.probes)) probe.on = 0;
  // the battery keeps its poles itself all through the chapter (the surplus on the minus stays)
  cell.hold = true;
  cell.surplus = cell.lack = cell.mark;
  gauge.shown = 0;
  frame.shown = 0;
  frame.setAt(FRAME_AT, FRAME_TANGENT);
  const hours = scrub(0, 0.4);
  const cut = scrub(0, 0.3);
  const cradle = { fresh: false, contact: 1 };
  const meter = { want: 0, probes: 0, needle: 'meter' as 'meter' | 'battery' };
  const counter = { want: 0 };
  let life = 0;
  let volts = 0;
  let needleV = 0;
  let needleVel = 0;
  let amps = 0;
  let probesOn = 0;
  let shownText = '';
  // the lamp's heat is the battery model's chain; the stage keeps the switch and the filament's inertia
  const cradleLife = (): number => (cradle.fresh ? 0 : life);
  stand.glowOf = () => cradle.contact * heatOfCurrent(loadCurrent(cradleLife()));

  const out: DrainWorld = {
    ctx,
    world,
    stand,
    cell,
    gauge,
    frame,
    hours,
    cut,
    cradle,
    meter,
    counter,
    get life() {
      return life;
    },
    get volts() {
      return needleV;
    },
    get amps() {
      return amps;
    },
    state: (camera, opts = {}) => ({
      camera,
      params: { deep: 0, closed: opts.closed ?? 1, lens: 0, poles: 1, lensCall: 0, window: 0 },
      post: camera === 'spent' ? STAGE_POST.lamp : STAGE_POST.stand,
    }),
    shot(name) {
      const s = ALL[name];
      if (!s) throw new Error(`drain: no shot '${name}'`);
      return s;
    },
    update(dt, t) {
      stepScrub(hours, dt, 1e-3);
      stepScrub(cut, dt);
      life = lifeAtHours(hours.shown);
      cell.cut = cut.shown;
      // the open cut's own soft key light (only `spent` opens it): it keeps the section readable as the lamp
      // dies and the room goes dark; the stage eases it and scales it down while the lamp is lit
      cell.island = cut.target > 0.5 ? 1 : 0;
      cell.life = life;
      // the surplus on the minus stays: at the very end a little smaller (VISUAL §5.8 «Не готово, якщо»)
      cell.mark = POLE_MARK * (1 - 0.18 * life * life);
      stand.charge = 1 - life;
      const closed = world.value('closed');
      cell.current = closed * cradle.contact;
      // the meter slides on and off the table (0.9 s), the probes travel to the clamps and back (0.7 s)
      const k = Math.min(Math.abs(meter.want - gauge.shown), dt / 0.9);
      if (k > 0) gauge.shown += Math.sign(meter.want - gauge.shown) * k;
      const want = gauge.shown > 0.98 ? meter.probes : 0;
      const kp = Math.min(Math.abs(want - probesOn), dt / 0.7);
      if (kp > 0) probesOn += Math.sign(want - probesOn) * kp;
      const pe = probesOn * probesOn * (3 - 2 * probesOn);
      gauge.probes.minus.on = gauge.probes.plus.on = pe;
      // what the poles hold now: the switch's state as the slider and the filament show it (its own inertia)
      const target = gauge.touching ? meterVoltage(cradleLife(), closed * cradle.contact) : 0;
      if (meter.needle === 'battery') needleV = followVoltage(needleV, target, dt);
      else volts = target;
      if (meter.needle === 'meter') {
        // the needle's own settle: a quick critically damped swing (τ 0.11 s), both ways alike — it starts and
        // stops at rest, as an instrument's needle does
        const w = 1 / 0.11;
        let left = Math.min(dt, 0.1);
        while (left > 0) {
          const h = Math.min(left, 1 / 240);
          needleVel += (w * w * (volts - needleV) - 2 * w * needleVel) * h;
          needleV += needleVel * h;
          left -= h;
        }
      } else needleVel = 0;
      if (Math.abs(needleV - gauge.value) > 1e-4) gauge.value = needleV;
      // the frame: the current through the lamp, the same life
      amps = closed * cradle.contact * loadCurrent(cradleLife());
      const kf = Math.min(Math.abs(counter.want - frame.shown), dt / 0.6);
      if (kf > 0) frame.shown += Math.sign(counter.want - frame.shown) * kf;
      // on a phone the frame's print would be under 14 px: the step shows the number in the interface instead
      const text = frame.shown > 0.01 && ctx.device.formFactor !== 'phone' ? formatAmps(amps) : '';
      if (text !== shownText) frame.setNumber((shownText = text));
      world.update(dt, t);
    },
  };
  return out;
}
