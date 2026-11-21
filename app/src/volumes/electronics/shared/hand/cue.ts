/**
 * Copied from `circuit/chapters/battery/parts/cue.ts` (shared/README.md, «Копії»); the ring's inner radius and how
 * fast it eases are parameters (the bench's cue on a socket has the outer radius 0.12 and is 0.025 thick, and comes
 * and goes in 0.12 s, VISUAL §6), and the mesh is named by its owner.
 *
 * A thin glowing ring facing the camera: the affordance «you can put it here / take this» around the thing under
 * the pointer (a battery end, a clamp). It eases in and out; it never blinks.
 */
import { Mesh, RingGeometry, type Camera, type Object3D, type Vector3 } from 'three';
import { damp } from '@/engine/api';
import { K } from '@/style';

export interface Cue {
  mesh: Object3D;
  /** Where the ring sits (world), its radius (world units) or null when it is not wanted this frame. */
  update(dt: number, at: Vector3 | null, radius: number, camera: Camera): void;
  hide(): void;
}

/** `inner`: the inner radius as a share of the outer one; `rate`: how fast it eases in and out (1/s). */
export function createCue(
  parent: Object3D,
  color: 'cyan' | 'white' = 'cyan',
  inner = 0.9,
  name = 'cue',
  rate = 12,
): Cue {
  const material = K.glow({ color, intensity: 1.1 });
  const mesh = new Mesh(new RingGeometry(inner, 1, 56), material);
  mesh.name = name;
  mesh.renderOrder = 5;
  mesh.visible = false;
  parent.add(mesh);
  let shown = 0;
  let size = 0.3;
  return {
    mesh,
    hide() {
      shown = 0;
      mesh.visible = false;
    },
    update(dt, at, radius, camera) {
      shown = damp(shown, at ? 1 : 0, rate, dt);
      if (at) {
        mesh.position.copy(at);
        size = damp(size, radius, 10, dt);
      }
      mesh.quaternion.copy(camera.quaternion);
      mesh.visible = shown > 0.02;
      mesh.scale.setScalar(size * (0.85 + 0.15 * shown));
      material.fade = shown;
    },
  };
}
