/**
 * The snake of the far wire on the stand (`shape`): a copper core in its sheath along `snakePath(k)`: the sheath is
 * the stand's own material of the piece `m2` (the same blue with its pole tint), the core the same copper made the
 * same way (`wires.ts`), so at k = 1 it is that piece exactly. When the lamp dims the core keeps an ember of warm
 * copper (`ember`), so the thin wire never turns into a cold blue line. While it is shown the stand's `m2` is hidden; it is shown only while needed (`active`).
 * The cyan handle (`grip`) sits at the bottom of the middle fold.
 */
import { Mesh, SphereGeometry, Vector3, type Material } from 'three';
import { K, col } from '@/style';
import { LOOP, type CircuitStage } from '@circuit/shared/stage';
import { tame } from '@circuit/shared/stage/materials';
import { DynTube } from '@circuit/shared/stage/dyn-tube';
import { MIDDLE_X, SNAKE_POINTS, depthOf, radiiOf, snakePath } from './snake-path';

/** The stripped copper at both ends that goes into the terminals (as the stand's wires). */
const BARE = 0.11;
const RADIAL = 12;

export interface Snake {
  /** The cyan ball the reader pulls (register it with the input). */
  grip: Mesh;
  /** The stretch shown now (1 … 40). */
  k: number;
  /** The snake replaces the stand's `m2` (false: the stand's own piece, the snake hidden). */
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
  const m2core = wires.core('m2');
  const m2skin = wires.group.getObjectByName('wire-m2:sheath') as Mesh | undefined;
  if (!m2skin) throw new Error('resistance/snake: the stand has no wire-m2:sheath');
  const coreTube = new DynTube(SNAKE_POINTS, RADIAL);
  const skinTube = new DynTube(SNAKE_POINTS, RADIAL);
  // the copper of `wires.ts` (same parameters, same gradient across the core), tamed like every stand material
  const copper = tame(K.metal({ color: 'orange', specular: 0.22, shininess: 180, rim: 0.3, highlight: 0.2 }));
  const low = col('orange.dark').lerp(col('wireBrown'), 0.5);
  const high = col('orange.dark').lerp(col('orange'), 0.7);
  const warm = col('orange');
  const core = new Mesh(coreTube.geometry, copper);
  core.name = 'resistance-snake:core';
  core.castShadow = core.receiveShadow = true;
  const skin = new Mesh(skinTube.geometry, m2skin.material as Material);
  skin.name = 'resistance-snake:sheath';
  skin.castShadow = true;
  skin.renderOrder = m2skin.renderOrder;
  wires.group.add(core, skin);
  const grip = new Mesh(new SphereGeometry(0.1, 24, 16), K.glow({ color: 'cyan', intensity: 1.1 }));
  grip.name = 'resistance-snake:grip';
  stage.base.frame.add(grip);
  const hit = new Mesh(new SphereGeometry(0.26, 12, 8), K.glow({ color: 'cyan', intensity: 0 }));
  hit.material.visible = false;
  grip.add(hit);
  const up = new Vector3(0, 1, 0);
  const path: Vector3[] = [];
  const along: number[] = [];
  let shownK = -1;
  let active = false;
  const draw = (k: number): void => {
    snakePath(k, path);
    const { core: rc, sheath: rs } = radiiOf(k);
    copper.setGradient(low, high, [LOOP.y - rc, LOOP.y + rc]);
    along.length = 0;
    let total = 0;
    for (let i = 0; i < path.length; i++) {
      if (i > 0) total += path[i]!.distanceTo(path[i - 1]!);
      along.push(total);
    }
    coreTube.update(path, up, (_i, out) => {
      out[0] = out[1] = rc;
    });
    skinTube.update(path, up, (i, out) => {
      const bare = Math.min(along[i]!, total - along[i]!) < BARE;
      out[0] = out[1] = bare ? rc * 0.96 : rs;
    });
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
        core.visible = skin.visible = active;
        m2core.visible = m2skin.visible = !active;
        shownK = -1;
      }
      if (active && Math.abs(s.k - shownK) > 1e-5) {
        shownK = s.k;
        draw(s.k);
      }
      copper.setEmissive(warm, 1.1 * Math.min(Math.max(s.ember, 0), 1));
      grip.visible = active;
      s.gripAt(grip.position);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
      grip.scale.setScalar(1 + 0.12 * s.call * pulse);
      (grip.material as ReturnType<typeof K.glow>).intensity = 0.8 + 0.5 * s.call * pulse;
    },
  };
  core.visible = skin.visible = false;
  grip.visible = false;
  return s;
}
