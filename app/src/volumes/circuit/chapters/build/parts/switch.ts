/**
 * The yellow slider of the switch, owned by the chapter (as in `flow`): here the lamp is not the switch's business
 * alone — the wiring decides whether there is a road at all — so the stage param `closed` means «the lamp has
 * power» and this part places the slider itself, every frame after the world, with the stand's own inertia. A tap
 * flips it while a step allows (`live`); a generous invisible hit volume keeps the small slider easy to hit.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { SWITCH } from '@circuit/shared/stage';
import { SLIDER_TRAVEL, SLIDER_Y } from '@circuit/shared/stage/small-parts';
import type { CircuitWorld } from '@circuit/shared/world';

const SEAT = new Vector3(SWITCH.x, SLIDER_Y, SWITCH.z);

export interface SwitchPart {
  /** The slider bridges its contacts (target; the slider follows with inertia). */
  closed: boolean;
  /** Openings by the reader since `reset()` (the goal of `first-light` asks for one with the lamp lit). */
  readonly flips: number;
  /** The slider's shown opening 0 closed … 1 open. */
  readonly open: number;
  /** Called after each flip by the reader. */
  onFlip: (() => void) | null;
  reset(): void;
  snap(): void;
  /** Place the slider: `unfolded` false = the stand's own placing (while it folds) is left alone. */
  place(dt: number, unfolded: boolean): void;
}

export function switchPart(
  ctx: ChapterContext,
  world: CircuitWorld,
  label: () => string,
  live: () => boolean,
): SwitchPart {
  const slider = world.stand.stand.slider;
  const hit = new Mesh(new SphereGeometry(0.36, 16, 10), new MeshBasicMaterial({ visible: false }));
  hit.name = 'build-switch-hit';
  slider.add(hit);
  ctx.qa.probe('switch', slider);
  let open = 0;
  let flips = 0;
  const part: SwitchPart = {
    closed: true,
    get flips() {
      return flips;
    },
    get open() {
      return open;
    },
    onFlip: null,
    reset() {
      flips = 0;
    },
    snap() {
      open = part.closed ? 0 : 1;
    },
    place(dt, unfolded) {
      open = damp(open, part.closed ? 0 : 1, 22, dt);
      if (Math.abs(open - (part.closed ? 0 : 1)) < 1e-3) open = part.closed ? 0 : 1;
      if (!unfolded) return;
      slider.position.copy(SEAT);
      slider.position.x -= open * SLIDER_TRAVEL;
    },
  };
  ctx.input.register(hit, {
    tooltip: label,
    cursor: 'pointer',
    enabled: () => live() && !world.flying,
    click: () => {
      if (!live()) return;
      part.closed = !part.closed;
      flips++;
      part.onFlip?.();
    },
  });
  return part;
}
