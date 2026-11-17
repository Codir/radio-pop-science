/**
 * A thin glowing ring in the picture plane of the copper world: the affordance «this one can be taken» around
 * the electron under the pointer (and in the hand). It eases in and out; it never blinks.
 */
import { Mesh, RingGeometry, type Object3D, type Vector3 } from 'three';
import { damp } from '@/engine/api';
import { K } from '@/style';

export interface HoverRing {
  mesh: Object3D;
  /** Where the ring sits (copper-local), its radius (local units) and whether it is wanted this frame. */
  update(dt: number, at: Vector3 | null, radius: number): void;
  /** Gone at once (the step is left: its update no longer runs). */
  hide(): void;
}

export function createHoverRing(parent: Object3D): HoverRing {
  const material = K.glow({ color: 'white', intensity: 0.9 });
  const mesh = new Mesh(new RingGeometry(0.86, 1, 48), material);
  mesh.name = 'hover-ring';
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
    update(dt, at, radius) {
      shown = damp(shown, at ? 1 : 0, 12, dt);
      if (at) {
        mesh.position.copy(at);
        size = damp(size, radius, 10, dt);
      }
      mesh.visible = shown > 0.02;
      mesh.scale.setScalar(size * (0.8 + 0.2 * shown));
      material.fade = shown;
    },
  };
}
