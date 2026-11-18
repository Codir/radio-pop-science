/**
 * `inside`: the light mark on the current's way through the lamp (`stand.lamp.path`, `contact → lead → coil → lead
 * → thread`). The reader drags it; it moves only along the way — a bead on a wire: each drag event looks for the
 * point of the way nearest the pointer on screen within a short stretch around the mark, so it never jumps across
 * to another part of the way. Along the coil the mark rides the coil's axis (the turns would overlap on screen);
 * the stretch it has passed glows faintly behind it along the real spiral.
 */
import {
  type BufferGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { K } from '@/style';
import type { LampMarks, LampView } from '@circuit/shared/stage';

/** Samples of the way for the search (axis path) and segments of the glowing trail (spiral path). */
const SAMPLES = 400;
const TRAIL = 900;
const RADIAL = 6;
/** Stretch of the way (share) searched around the mark per step, and steps per drag event. */
const WINDOW = 0.05;
const STEPS = 4;

export interface PathMarker {
  group: Group;
  /** Where the mark is (share of the way 0 contact … 1 thread) and the farthest point it reached. */
  readonly s: number;
  readonly reachedEnd: boolean;
  /** The invisible pick ball around the mark (registered for dragging). */
  readonly handle: Mesh;
  /** 0…1 how much of it shows (fades with the arrival). */
  shown: number;
  reset(): void;
  /** Probe: the mark's world position. */
  position(out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

/** Piecewise-linear map of a share between two sets of marks (axis way → spiral way). */
function remap(s: number, a: LampMarks, b: LampMarks): number {
  const keys = ['contact', 'leadIn', 'coilStart', 'coilEnd', 'leadOut', 'thread'] as const;
  for (let i = 1; i < keys.length; i++) {
    const a0 = a[keys[i - 1]!];
    const a1 = a[keys[i]!];
    if (s <= a1 || i === keys.length - 1) {
      const k = a1 > a0 ? Math.min(Math.max((s - a0) / (a1 - a0), 0), 1) : 0;
      return b[keys[i - 1]!] + (b[keys[i]!] - b[keys[i - 1]!]) * k;
    }
  }
  return s;
}

export function pathMarker(
  ctx: ChapterContext,
  lamp: LampView,
  opts: { enabled: () => boolean; moved?: () => void },
): PathMarker {
  const group = new Group();
  group.name = 'lamp:path-marker';
  ctx.root.add(group);
  const dotMat = K.glow({ color: 'cyan', intensity: 1.7, whiten: 0.5 });
  const dot = new Mesh(new SphereGeometry(0.03, 16, 12), dotMat);
  const haloMat = K.glow({ color: 'cyan', additive: true, opacity: 0.4, falloff: 2.6, edge: 0 });
  const halo = new Mesh(new SphereGeometry(0.085, 20, 14), haloMat);
  const handle = new Mesh(
    new SphereGeometry(0.16, 12, 8),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  handle.name = 'lamp:path-handle';
  group.add(dot, halo, handle);
  const trailMat = K.glow({ color: 'cyan', additive: true, opacity: 0.32, falloff: 0.6, edge: 0.4 });
  let trail: Mesh<BufferGeometry> | null = null;

  // both ways once: along the axis (the mark) and along the spiral (the trail)
  const helixWas = lamp.path.helix;
  lamp.path.helix = false;
  const axisMarks = { ...lamp.path.marks };
  const axis = Array.from({ length: SAMPLES + 1 }, (_, i) => lamp.path.at(i / SAMPLES, new Vector3()));
  lamp.path.helix = true;
  const spiralMarks = { ...lamp.path.marks };
  const spiral = Array.from({ length: TRAIL + 1 }, (_, i) => lamp.path.at(i / TRAIL, new Vector3()));
  lamp.path.helix = helixWas;
  trail = new Mesh(
    new TubeGeometry(new CatmullRomCurve3(spiral, false, 'centripetal'), TRAIL, 0.0075, RADIAL, false),
    trailMat,
  );
  trail.renderOrder = 3;
  group.add(trail);

  let s = 0;
  let far = 0;
  const p = new Vector3();
  const at = (share: number, out: Vector3): Vector3 => {
    const x = Math.min(Math.max(share, 0), 1) * SAMPLES;
    const i = Math.min(Math.floor(x), SAMPLES - 1);
    return out.copy(axis[i]!).lerp(axis[i + 1]!, x - i);
  };
  const screen = new Vector3();
  const near = (ndcX: number, ndcY: number): void => {
    const aspect = ctx.viewport.aspect;
    for (let step = 0; step < STEPS; step++) {
      let best = s;
      let bestD = Infinity;
      for (let j = -12; j <= 12; j++) {
        const q = Math.min(Math.max(s + (j / 12) * WINDOW, 0), 1);
        at(q, screen).project(ctx.camera.camera);
        const d = ((screen.x - ndcX) * aspect) ** 2 + (screen.y - ndcY) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      if (Math.abs(best - s) < 1e-4) break;
      s = best;
    }
    far = Math.max(far, s);
  };
  ctx.input.register(handle, {
    cursor: 'grab',
    enabled: opts.enabled,
    drag: (e) => {
      near(e.ndc.x, e.ndc.y);
      opts.moved?.();
    },
  });

  const marker: PathMarker = {
    group,
    handle,
    shown: 0,
    get s() {
      return s;
    },
    get reachedEnd() {
      return far >= 0.995;
    },
    reset() {
      s = far = 0;
    },
    position: (out) => at(s, out),
    update(_dt, t) {
      const a = marker.shown;
      group.visible = a > 0.01;
      if (!group.visible) return;
      at(s, p);
      dot.position.copy(p);
      halo.position.copy(p);
      handle.position.copy(p);
      // a calm breath while it waits on the contact: «this can be moved»
      const breathe = s < 0.002 ? 1 + 0.18 * Math.sin(t * 3.1) : 1;
      halo.scale.setScalar(a * breathe);
      dot.scale.setScalar(Math.max(a, 1e-3));
      haloMat.uniforms.opacity!.value = 0.4 * a;
      trailMat.uniforms.opacity!.value = 0.32 * a;
      const done = remap(s, axisMarks, spiralMarks);
      trail!.geometry.setDrawRange(0, Math.round(done * TRAIL) * RADIAL * 6);
    },
  };
  return marker;
}
