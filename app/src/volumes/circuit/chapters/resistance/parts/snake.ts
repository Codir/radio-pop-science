/**
 * The snake of the far wire on the stand (`shape`): the far stretch of the stand's own wire `m` itself, laid along
 * `farWirePath(k)` — the stand route up to the far left corner, then the meander — and thin from the seat's place
 * on (`WireShape.thin`, the taper under the staple there). One tube from the minus clamp to the lamp, no join; at
 * k = 1 it is the stand wire exactly. When the lamp dims the thin copper keeps an ember of warmth (`ember`,
 * `Wires.setEmber`), so the thin wire never turns into a cold blue line. The snake writes the wire only while
 * needed (`active`); off, the stand lays its own. The cyan handle (`grip`) sits at the bottom of the middle fold.
 */
import { Mesh, SphereGeometry, type Vector3 } from 'three';
import { K } from '@/style';
import { LOOP, type CircuitStage } from '@circuit/shared/stage';
import type { WireShape } from '@circuit/shared/stage/wires';
import { MIDDLE_X, SNAKE_FROM, depthOf, farWirePath, radiiOf } from './snake-path';

/** The thin stretch begins half a taper past the snake's start, so the taper sits under the staple. */
const THIN_FROM = SNAKE_FROM + 0.07;

export interface Snake {
  /** The cyan ball the reader pulls (register it with the input). */
  grip: Mesh;
  /** The stretch shown now (1 … 40). */
  k: number;
  /** The snake shapes the far wire (false: the stand's own shape, the handle hidden). */
  active: boolean;
  /** 0 quiet … 1 «take me»: the grip's glow. */
  call: number;
  /** 0 … 1: the warm glow the copper keeps when the room is dark. */
  ember: number;
  /** The grip's place (board frame, at the bottom of the middle fold). */
  gripAt(out: Vector3): Vector3;
  update(t: number): void;
}

export function snake(stage: CircuitStage): Snake {
  const wires = stage.stand.wires;
  const grip = new Mesh(new SphereGeometry(0.1, 24, 16), K.glow({ color: 'cyan', intensity: 1.1 }));
  grip.name = 'resistance-snake:grip';
  stage.base.frame.add(grip);
  const hit = new Mesh(new SphereGeometry(0.26, 12, 8), K.glow({ color: 'cyan', intensity: 0 }));
  hit.material.visible = false;
  grip.add(hit);
  const path: Vector3[] = [];
  let shown: WireShape | null = null;
  let shownK = -1;
  let active = false;
  const draw = (k: number): void => {
    const { core, sheath } = radiiOf(k);
    shown = { path: farWirePath(k, path), round: 1, cover: 1, copper: 1, thin: { from: THIN_FROM, core, sheath } };
    wires.setShape('m', shown);
  };
  const s: Snake = {
    grip,
    k: 1,
    active: false,
    call: 0,
    ember: 0,
    gripAt: (out) => out.set(MIDDLE_X, LOOP.y + 0.02, LOOP.far + depthOf(s.k) + radiiOf(s.k).sheath + 0.06),
    update(t) {
      if (s.active !== active) {
        active = s.active;
        shownK = -1;
        if (!active) wires.setStand('m');
      }
      // the stand re-lays its wires when the switch moves: take the far wire back at once
      if (active && (Math.abs(s.k - shownK) > 1e-5 || wires.shapeOf('m') !== shown)) {
        shownK = s.k;
        draw(s.k);
      }
      wires.setEmber(active ? s.ember : 0);
      grip.visible = active;
      s.gripAt(grip.position);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
      grip.scale.setScalar(1 + 0.12 * s.call * pulse);
      (grip.material as ReturnType<typeof K.glow>).intensity = 0.8 + 0.5 * s.call * pulse;
    },
  };
  grip.visible = false;
  return s;
}
