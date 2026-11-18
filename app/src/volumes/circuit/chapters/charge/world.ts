/**
 * The chapter's view of the composed world (`@circuit/shared/world`: the stand and «усередині міді», the
 * flights through the lens) plus the props on the table in front of the stand. Every mount detail — param
 * names, shot names, depth of field of the table shots — stays in this file; the steps speak of props, shots
 * and the lamp.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext, MoveOptions, PostOverrides, Shot, StepSpec } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { COPPER_SHOTS, type CopperShot } from '@circuit/shared/copper/shots';
import { STAGE_FOV, tameAll } from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { BALLOON_REST, FIGURE, HANGER } from './layout';
import { createBalloon, type Balloon } from './parts/balloon';
import { createFigure, type Figure } from './parts/figure';
import { createHanger, type Hanger } from './parts/hanger';

type Vec = [number, number, number];

/** Seconds the props take to grow in or shrink away at a chapter border. */
const PRESENCE_SECONDS = 0.8;

/** Depth of field on the table: the props sharp, the stand behind them soft (VISUAL §5: «поза фокусом»). */
export const TABLE_POST: PostOverrides = { dofAperture: 4.2, dofRange: 1.1, dofMaxBlur: 13 };

/** The table shots of the chapter (world space). */
export const TABLE_SHOTS = {
  /** `rub`: the figure, the balloon and the hanging balloon; the stand in the right third, out of focus. */
  'charge-table': {
    position: [-3.75, 4.1, 12.9],
    target: [-3.9, 1.0, 4.35],
    fov: STAGE_FOV,
    fit: { center: [-4.0, 1.25, 4.4], radius: 2.45 },
    orbit: { azimuth: 0.35, polar: 0.15, zoom: [0.85, 1.25] },
  },
  /** `charge`: the same place, looking a little higher — the balloon hovers over the hair, the lens comes to it. */
  'charge-lens': {
    position: [-3.75, 4.6, 12.9],
    target: [-3.75, 1.65, 4.35],
    fov: STAGE_FOV,
    fit: { center: [-3.6, 1.8, 4.4], radius: 2.3 },
    orbit: { azimuth: 0.35, polar: 0.15, zoom: [0.85, 1.25] },
  },
  /** `signs`: the four spheres on the table in front of the figure, from above; the stand far behind. */
  'charge-spheres': {
    position: [-3.1, 6.6, 13.6],
    target: [-3.75, 0.45, 6.3],
    fov: STAGE_FOV,
    fit: { center: [-4.1, 0.46, 6.9], radius: 2.55 },
    orbit: { azimuth: 0.3, polar: 0.12, zoom: [0.85, 1.2] },
  },
  /** `field`: the rubbed balloon hanging on its thread, room around it for the probe; the stand far right. */
  'charge-field': {
    position: [-5.15, 3.05, 11.9],
    target: [-5.15, 1.55, 4.15],
    fov: STAGE_FOV,
    fit: { center: [-5.15, 1.45, 4.15], radius: 2.35 },
    orbit: { azimuth: 0.3, polar: 0.12, zoom: [0.85, 1.2] },
  },
  /** `shift`: the spare piece of wire with the lens over it, the balloon's way in from the left; the stand behind. */
  'charge-spare': {
    position: [-1.45, 3.1, 9.7],
    target: [-1.1, 0.8, 3.95],
    fov: STAGE_FOV,
    fit: { center: [-1.0, 0.75, 3.7], radius: 2.0 },
    orbit: { azimuth: 0.3, polar: 0.12, zoom: [0.85, 1.2] },
  },
} satisfies Record<string, Shot>;
export type TableShot = keyof typeof TABLE_SHOTS;

export interface Props {
  group: Group;
  figure: Figure;
  balloon: Balloon;
  hanger: Hanger;
  /** Where the figure stands now: null = its own place; a step may send it aside (it walks there). */
  aside: Vector3 | null;
  /**
   * The props on the table at all (1) or not (0): at a chapter border they grow out of / shrink into their places
   * (in 0.8 s, eased) — on a phone the stand shot shows the table in front, and the border frame has no props.
   */
  shown: number;
  /** How far they are shown now (0…1). */
  readonly presence: number;
  /** Jump to `shown` (the border frame on arrival). */
  snapPresence(): void;
}

export interface ChargeWorld {
  world: CircuitWorld;
  copper: Copper;
  props: Props;
  /** The state of a step on the table: the lamp (0 off · 1 on), the camera, the lens (0 holder · 1 in use). */
  table(camera: TableShot | string, extra?: Partial<StepSpec>): StepSpec;
  /** The state of a step below the stand (`deep` 2 «ряди», 3 «один атом»). */
  below(deep: 2 | 3, camera: CopperShot | string): StepSpec;
  go(camera: string | Shot, opts?: MoveOptions): void;
  name(name: string, make: () => Shot): void;
  /** A copper-local point in world space (callout anchors, probes); `out` is overwritten. */
  toWorld(local: Vector3, out?: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createChargeWorld(ctx: ChapterContext): ChargeWorld {
  const world = mountWorld(ctx);
  // chapter 2 shows no common drift; the lamp stays off all chapter long (chapter 1 ended with it off)
  world.drift = 0;
  const { copper } = world;
  ctx.camera.shots(TABLE_SHOTS);

  const group = new Group();
  group.name = 'charge-props';
  const figure = createFigure();
  figure.group.position.copy(FIGURE);
  // three-quarters toward the reader (and toward the balloon on its right) in every shot
  figure.group.rotation.y = 0.55;
  const balloon = createBalloon();
  balloon.group.position.copy(BALLOON_REST);
  balloon.tilt = 1.45;
  const hanger = createHanger();
  hanger.group.position.copy(HANGER);
  group.add(figure.group, balloon.group, hanger.group);
  ctx.root.add(group);
  tameAll(group);
  let presence = 1;
  const props: Props = {
    group,
    figure,
    balloon,
    hanger,
    aside: null,
    shown: 1,
    get presence() {
      return presence;
    },
    snapPresence() {
      presence = props.shown;
    },
  };
  const spot = new Vector3();
  let stepping = 0;
  const nameOf = (c: string): string => (c in COPPER_SHOTS ? `copper-${c}` : c);

  return {
    world,
    copper,
    props,
    table: (camera, extra = {}) => ({
      camera,
      params: { deep: 0, closed: 0, lens: 0, window: 0, lensCall: 0 },
      post: TABLE_POST,
      ...extra,
    }),
    below: (deep, camera) => ({
      camera: nameOf(camera),
      params: { deep, closed: 0, lens: 1, window: 0, lensCall: 0 },
    }),
    go: (camera, opts) => ctx.camera.go(typeof camera === 'string' ? nameOf(camera) : camera, opts),
    name(name, make) {
      ctx.camera.shots({ [name]: make() });
    },
    toWorld: (local, o = new Vector3()) => copper.space.localToWorld(o.copy(local)),
    update(dt, t) {
      world.update(dt, t);
      // stepping aside / back: a short walk with a small bob, never a jump
      spot.copy(props.aside ?? FIGURE);
      const fp = figure.group.position;
      const left = Math.hypot(spot.x - fp.x, spot.z - fp.z);
      const k = 1 - Math.exp(-dt * 2.4);
      fp.x += (spot.x - fp.x) * k;
      fp.z += (spot.z - fp.z) * k;
      stepping = left > 0.02 ? stepping + dt : 0;
      fp.y = left > 0.02 ? 0.035 * Math.abs(Math.sin(stepping * 9)) * Math.min(left * 4, 1) : 0;
      const step = dt / PRESENCE_SECONDS;
      presence = props.shown > presence ? Math.min(props.shown, presence + step) : Math.max(props.shown, presence - step);
      // every prop grows from its own origin (its foot on the table); never quite 0 (the figure divides by it)
      const grown = Math.max(presence * presence * (3 - 2 * presence), 1e-3);
      for (const child of group.children) {
        child.scale.setScalar(grown);
        child.visible = presence > 1e-3;
      }
      figure.update(dt, t);
      balloon.update(dt, t);
      hanger.update(dt, t);
    },
  };
}

export type { Vec };
