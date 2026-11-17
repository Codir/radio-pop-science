/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand, the copper world (at «ряди» in
 * `bumps`, as the lens window on the stand later), the hit counter of the copper world, and the chapter's own props
 * — the thermometer (`heat`), the snake of the far wire with its handle and the counter frame in amperes (`shape`),
 * the lens carried along the loop with the hit strip on its rim (`balance`). Each prop is a number that travels,
 * never jumps, between the states the steps ask for.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { createHits, type Hits } from '@circuit/shared/copper/hits';
import { LOOP, heatOfCurrent, type CircuitStage } from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { glide, type Glide } from './parts/glide';
import { wireLensPose } from './parts/poses';
import { snake, type Snake } from './parts/snake';
import { currentOf } from './parts/snake-path';
import { switchControl, type SwitchControl } from './parts/switch';
import { thermometer, type Thermometer } from './parts/thermometer';

/** The common shift in the copper as a share of the darting speed at full glow (VISUAL §6: 3–6 %), as in `flow`. */
export const DRIFT = 0.06;
/** Seconds of the entry dive: the lens from its holder onto the wire, through the ring, down to the rows. */
export const DIVE_SECONDS = 2.8;
/** The lens as a window on the stand (`heat`, `balance`): its size, the copper units across it, the crowd's cage. */
export const LENS_SCALE = 1.2;
export const SPAN = 8.5;
export const LEASH = 1.7;
/**
 * Where the lens rests as a window in `heat` (board z on the loop's right side, between the switch and the lamp:
 * clear of the switch, which the reader handles there) and where the thermometer is clipped beside it, further
 * along the same wire toward the lamp.
 */
export const WINDOW_Z = 0.62;
const THERMO_Z = -0.32;
/**
 * The counter frame: on the same wire as the snake (from the minus), where that wire comes down the loop's left
 * side just below the far corner. A wire running toward the reader is seen ringed face-on, as in `flow/count`
 * (across the far wire the frame would be seen edge-on, as a post).
 */
const FRAME_Z = -1.22;
/**
 * The lamp's glow never falls below this while the snake holds the current back: the script's lamp «ледь жевріє» at
 * 0.09 A, and the coil's own balance (`heatOfCurrent`) gives 0.07 there — just under the first dull red (0.076).
 */
const DULL = 0.14;
const NBSP = String.fromCharCode(160);
/** The frame's number: amperes with two decimals and a decimal comma («0,30 A»). */
export const amps = (a: number): string => `${a.toFixed(2).replace('.', ',')}${NBSP}A`;

export interface ResistanceStand {
  ctx: ChapterContext;
  world: CircuitWorld;
  stage: CircuitStage;
  copper: Copper;
  /** Hits of the free electrons on atoms (counts, flashes). */
  hits: Hits;
  sw: SwitchControl;
  /** The thermometer of `heat` and its presence (travels). */
  thermo: Thermometer;
  thermoShown: Glide;
  /** The atoms' heat (`lattice.heat`): the value follows `target` with the time constant `rate` (s). */
  heat: { target: number; rate: number };
  /** The far wire's snake (`shape`), its stretch (travels: 1 … 40) and the current it lets through (A). */
  snake: Snake;
  stretch: Glide;
  readonly amps: number;
  /** The counter frame on the far wire showing amperes (`shape`, `balance`) and its presence (travels). */
  frameShown: Glide;
  /** The frame's number as text ('' while it is hidden), for a phone callout at `frameTop()`. */
  readonly frameText: string;
  frameTop(out: Vector3): Vector3;
  /** The lens over the near wire as a window onto the copper (pose, span, the crowd's cage). */
  window(instant: boolean): void;
  /**
   * The chapter's entry from its neighbour: start on the stand shot (lamp on, the lens in its holder — the frame
   * `flow` ends on) and dive to the rows in one motion: the lens rises, lies on the wire and takes the camera
   * through its ring (the world's dive rail, timed).
   */
  diveIn(): void;
  /** Deep links: every prop on its target at once. */
  snap(): void;
  update(dt: number, t: number): void;
}

export function createResistanceStand(ctx: ChapterContext): ResistanceStand {
  const world = mountWorld(ctx, { drift: DRIFT });
  const stage = world.stand;
  const hits = createHits(world.copper);
  const sw = switchControl(ctx, world);
  const thermo = thermometer();
  thermo.place(LOOP.right, THERMO_Z, true);
  stage.base.frame.add(thermo.group);
  const thermoShown = glide(0);
  const heat = { target: 0, rate: 0.5 };
  const wire = snake(stage);
  const stretch = glide(1);
  const frameShown = glide(0);
  const { frame } = stage.tools;
  frame.setAt(new Vector3(LOOP.left, LOOP.y, FRAME_Z), new Vector3(0, 0, -1));
  let frameText = '';
  ctx.qa.probe('frame', frame.group);
  ctx.qa.probe('grip', wire.grip);
  ctx.qa.probe('lens', stage.tools.lens.ring);
  const stand: ResistanceStand = {
    ctx,
    world,
    stage,
    copper: world.copper,
    hits,
    sw,
    thermo,
    thermoShown,
    heat,
    snake: wire,
    stretch,
    get amps() {
      return currentOf(stretch.value);
    },
    frameShown,
    get frameText() {
      return frameText;
    },
    frameTop: (out) => frame.group.localToWorld(out.set(0, 0.62, 0)),
    window() {
      const { sim } = world.copper;
      sim.leash = LEASH;
      // the crowd's box just beyond the window plus the leash: the 32 electrons crowd the glass
      sim.box.x = sim.box.y = SPAN / 2 + LEASH + 0.3;
      world.window.span = SPAN;
      world.lensPose = wireLensPose(LOOP.right, WINDOW_Z, LENS_SCALE);
    },
    diveIn() {
      ctx.stage.setParam('deep', 0, { instant: true });
      ctx.stage.setParam('lens', 0, { instant: true });
      ctx.camera.go('stand', { instant: true });
      world.release();
      world.travelTo(2, DIVE_SECONDS);
    },
    snap() {
      thermoShown.set(thermoShown.target);
      stretch.set(stretch.target);
      frameShown.set(frameShown.target);
      world.copper.lattice.heat = heat.target;
    },
    update(dt, t) {
      const lattice = world.copper.lattice;
      lattice.heat += (heat.target - lattice.heat) * (1 - Math.exp(-dt / Math.max(heat.rate, 1e-3)));
      // the snake: the stand's own far wire unless stretched (or about to be); the lamp follows its current
      const k = stretch.update(dt);
      wire.k = k;
      // the thin copper keeps an ember of warmth while the lamp dims (it eases in with the stretch)
      wire.ember = (1 - stage.glow) * Math.min(Math.max((k - 1) / 7, 0), 1);
      wire.active = k > 1 + 1e-4 || ctx.stage.current === 'shape';
      stage.setGlow(wire.active ? Math.max(heatOfCurrent(currentOf(k)), DULL) : null);
      world.update(dt, t);
      hits.update(dt);
      wire.update(t);
      frame.shown = frameShown.update(dt);
      frameText = frame.shown > 0.5 ? amps(currentOf(k)) : '';
      frame.setNumber(ctx.device.formFactor === 'phone' ? '' : frameText);
      thermo.shown = thermoShown.update(dt);
      thermo.update();
    },
  };
  return stand;
}
