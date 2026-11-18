/**
 * The yellow slider of the switch, owned by the chapter: in `flow` the lamp is not only the switch's business (the
 * wire's end may be out of its clamp, the slider may be in the reader's hand on its way to the second seat), so the
 * stage param `closed` means «the circuit is whole» and this part places the slider itself, every frame after the
 * world: on its seat (the first, near; or the second, far — `flow/loop`), open or closed, with the stand's own
 * inertia; carried between the seats along a low arc. A generous invisible hit volume makes it easy to hit.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { damp, type ChapterContext, type InteractionHandlers } from '@/engine/api';
import { SEAT, SWITCH } from '@circuit/shared/stage';
import { SLIDER_TRAVEL, SLIDER_Y } from '@circuit/shared/stage/small-parts';
import type { CircuitWorld } from '@circuit/shared/world';

/** The slider's places on the two seats (board frame, closed). */
export const SEATS = {
  first: new Vector3(SWITCH.x, SLIDER_Y, SWITCH.z),
  second: new Vector3(SEAT.x, SLIDER_Y - 0.005, SEAT.z),
} as const;

export interface SwitchPart {
  /** The slider bridges its contacts (target; the slider follows with inertia). */
  closed: boolean;
  /** Where it sits: 0 the first seat … 1 the second; between = carried (lifted on an arc). */
  seat: number;
  /** A free position (board frame) overriding `seat` while the reader carries it, or null. */
  hand: Vector3 | null;
  /** The slider's shown opening 0 closed … 1 open. */
  readonly open: number;
  /** Register the slider's input (one handler set for the whole chapter; steps switch it by `enabled`). */
  input(handlers: InteractionHandlers): void;
  /** Jump to the targets (deep links). */
  snap(): void;
  /** After the world's update: place the slider. */
  place(dt: number): void;
}

export function switchPart(ctx: ChapterContext, world: CircuitWorld): SwitchPart {
  const slider = world.stand.stand.slider;
  const hit = new Mesh(
    new SphereGeometry(0.36, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'flow-switch-hit';
  slider.add(hit);
  ctx.qa.probe('switch', slider);
  let open = 0;
  const p = new Vector3();
  const part: SwitchPart = {
    closed: true,
    seat: 0,
    hand: null,
    get open() {
      return open;
    },
    input(handlers) {
      ctx.input.register(hit, handlers);
    },
    snap() {
      open = part.closed ? 0 : 1;
    },
    place(dt) {
      open = damp(open, part.closed ? 0 : 1, 22, dt);
      if (Math.abs(open - (part.closed ? 0 : 1)) < 1e-3) open = part.closed ? 0 : 1;
      if (part.hand) p.copy(part.hand);
      else {
        const s = Math.min(Math.max(part.seat, 0), 1);
        const e = s * s * (3 - 2 * s);
        p.copy(SEATS.first).lerp(SEATS.second, e);
        p.y += 0.55 * Math.sin(Math.PI * e);
      }
      p.x -= open * SLIDER_TRAVEL;
      slider.position.copy(p);
    },
  };
  return part;
}
