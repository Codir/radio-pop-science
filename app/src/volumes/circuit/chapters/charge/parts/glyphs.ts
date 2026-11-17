/**
 * Sign stickers «+» / «−» laid over particles that are drawn without one (the soft electrons and the nucleus of
 * the copper atom — `shared/copper` keeps `glyph: 'none'`): camera-facing quads in one instanced draw, white with
 * a dark rim like the course's orb stickers (`@/fx` orbs). Positions are world space, set every frame. They live
 * on the overlay layer: drawn crisp after the depth of field, which would blur them with the soft dots under them.
 */
import {
  CanvasTexture,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Camera,
} from 'three';
import { toOverlay } from '@/engine/api';

function glyphTexture(kind: 'plus' | 'minus'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const bar = (w: number, h: number, colour: string): void => {
    g.fillStyle = colour;
    g.beginPath();
    g.roundRect(32 - w / 2, 32 - h / 2, w, h, h / 2);
    g.fill();
    if (kind === 'plus') {
      g.beginPath();
      g.roundRect(32 - h / 2, 32 - w / 2, h, w, h / 2);
      g.fill();
    }
  };
  bar(52, 20, 'rgba(13,17,54,0.85)');
  bar(42, 11, '#F6F3FF');
  const t = new CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export interface Glyphs {
  mesh: InstancedMesh;
  /** 0…1 presence of all stickers. */
  shown: number;
  set(i: number, at: Vector3, size: number): void;
  /** Hide the stickers from `n` on. */
  count(n: number): void;
  commit(camera: Camera): void;
}

export function createGlyphs(kind: 'plus' | 'minus', capacity: number): Glyphs {
  const material = new MeshBasicMaterial({
    map: glyphTexture(kind),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 60;
  mesh.name = `charge-glyphs-${kind}`;
  toOverlay(mesh);
  const at = Array.from({ length: capacity }, () => new Vector3());
  const size = new Float32Array(capacity);
  let n = capacity;
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const glyphs: Glyphs = {
    mesh,
    shown: 0,
    set(i, p, sz) {
      at[i]!.copy(p);
      size[i] = sz;
    },
    count(k) {
      n = Math.min(k, capacity);
    },
    commit(camera) {
      camera.getWorldQuaternion(q);
      const k = glyphs.shown;
      mesh.visible = k > 0.002;
      material.opacity = Math.min(k * 1.5, 1);
      for (let i = 0; i < capacity; i++) {
        const z = i < n ? size[i]! * (0.6 + 0.4 * k) : 0;
        m.compose(at[i]!, q, s.set(z, z, z));
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  return glyphs;
}
