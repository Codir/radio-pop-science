/**
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

export function createCue(parent: Object3D, color: 'cyan' | 'white' = 'cyan'): Cue {
  const material = K.glow({ color, intensity: 1.1 });
  const mesh = new Mesh(new RingGeometry(0.9, 1, 56), material);
  mesh.name = 'battery:cue';
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
      shown = damp(shown, at ? 1 : 0, 12, dt);
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
