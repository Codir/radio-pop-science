/**
 * `handover`: the marked electron seen in the small lens window must be found in one second. The copper world's own
 * mark (an overlay ring) is not drawn inside the lens's stencil window, so the chapter draws its own in the stand's
 * space, over the glass: a bright white ring round the electron and a short trail of its last half second.
 */
import { Group, Mesh, RingGeometry, type Camera, type Object3D, type Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { RibbonLines } from '@/fx';
import { K } from '@/style';

/** Trail: samples kept and the seconds they cover. */
const SAMPLES = 24;
const SPAN = 0.5;

export interface ElectronMark {
  group: Group;
  /** The ring (its origin = the electron as drawn): the callout's anchor. */
  ring: Object3D;
  /** 0…1 how much shows. */
  shown: number;
  /** Ring radius (world units) — about the electron's size in the window × 3. */
  radius: number;
  /** Every frame: where the electron is (world) and the camera to face. */
  update(at: Vector3, camera: Camera, dt: number): void;
  reset(): void;
}

export function electronMark(ctx: ChapterContext): ElectronMark {
  const group = new Group();
  group.name = 'lamp:electron-mark';
  ctx.root.add(group);
  const ringMat = K.glow({ color: 'white', intensity: 1.6, falloff: 0, edge: 0 });
  // drawn after everything (the transparent queue), never hidden by the stand or the glass
  ringMat.depthTest = false;
  ringMat.transparent = true;
  const ring = new Mesh(new RingGeometry(0.82, 1, 48), ringMat);
  ring.renderOrder = 960;
  const trail = new RibbonLines({
    capacity: SAMPLES * 2,
    color: 'cyan.light',
    width: 0.012,
    intensity: 1.1,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
    hotCore: 0.4,
  });
  trail.renderOrder = 959;
  trail.material.depthTest = false;
  trail.material.transparent = true;
  group.add(trail, ring);
  group.visible = false;
  const past: { p: Vector3; age: number }[] = [];
  const mark: ElectronMark = {
    group,
    ring,
    shown: 0,
    radius: 0.05,
    update(at, camera, dt) {
      group.visible = mark.shown > 0.01;
      for (const s of past) s.age += dt;
      while (past.length && past[0]!.age > SPAN) past.shift();
      if (!past.length || past[past.length - 1]!.p.distanceToSquared(at) > 1e-8) {
        if (past.length >= SAMPLES) past.shift();
        past.push({ p: at.clone(), age: 0 });
      }
      if (!group.visible) return;
      ring.position.copy(at);
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(mark.radius * (0.6 + 0.4 * mark.shown));
      ringMat.fade = mark.shown;
      const lines = [];
      for (let i = 1; i < past.length; i++) {
        const a = past[i - 1]!;
        const b = past[i]!;
        lines.push({
          points: [a.p, b.p],
          brightness: [mark.shown * (1 - a.age / SPAN), mark.shown * (1 - b.age / SPAN)],
        });
      }
      trail.setLines(lines);
    },
    reset() {
      past.length = 0;
    },
  };
  return mark;
}
