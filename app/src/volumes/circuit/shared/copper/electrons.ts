/**
 * How the free electrons are drawn (VISUAL §6, §4): bright cyan dots a sixth of an atom across with a short
 * tail whose length follows the speed; the ones behind the focal plane are dimmer and left to the depth of
 * field. No «−» on them in chapter 1. One electron can be marked: white core, white ring, long trail — the
 * crowd dims a little so the eye finds it.
 */
import { Group, Mesh, RingGeometry, Vector3, type Quaternion } from 'three';
import { toOverlay } from '@/engine/api';
import { createOrbs, ORB_STYLES, RibbonLines, type Orbs } from '@/fx';
import { K } from '@/style';
import type { ElectronSim } from './electron-sim';
import { ELECTRON_R, mix } from './layout';
import { createStreaks } from './streaks';

/** The short tail is the last 0.11 s of the flight; the marked electron's path is its last 2.4 s. */
const TAIL_S = 0.11;
const PATH_S = 2.4;
const PATH_SEGMENTS = 48;
/** A jump longer than this between two frames is a wrap of the periodic box, not a flight. */
const JUMP = 3;

export interface ElectronView {
  group: Group;
  orbs: Orbs;
  /** Index of the marked electron, −1 = none. */
  marked: number;
  /** 0…1 dissolve; brightness of the unmarked crowd (1 = as styled). */
  fade: number;
  crowd: number;
  /** Position of electron e as drawn (local units). */
  positionOf(e: number, out: Vector3): Vector3;
  /** Forget the trails (after a jump of the whole state: deep link, reset). */
  cut(): void;
  /** `face`: the orientation that faces the viewer, in the local frame of the copper world. */
  update(dt: number, face: { quaternion: Quaternion }): void;
}

export function createElectronView(sim: ElectronSim): ElectronView {
  const n = sim.count;
  const group = new Group();
  group.name = 'copper-electrons';
  const orbs = createOrbs({
    kind: { ...ORB_STYLES.electron, glyph: 'none', halo: { color: 'cyan', size: 3.4, strength: 0.55 } },
    count: n,
    radius: ELECTRON_R,
    instanceColors: true,
  });
  const tails = createStreaks(n);
  const trail = new RibbonLines({
    capacity: PATH_SEGMENTS * 2,
    color: 'cyan.light',
    width: ELECTRON_R * 0.55,
    intensity: 0.95,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
    hotCore: 0.3,
  });
  // the mark: a thin white ring that always faces the viewer
  const ring = new Mesh(
    new RingGeometry(ELECTRON_R * 2.5, ELECTRON_R * 2.95, 48),
    K.glow({ color: 'white', intensity: 1.5, falloff: 0, edge: 0 }),
  );
  ring.name = 'electron-mark';
  group.add(tails.mesh, trail, orbs, ring);
  // The mark and the path are a note about one electron, not things in the copper: on the overlay layer they
  // stay crisp (the depth of field would smear them wherever they cross the blurred planes behind) and are
  // never hidden by an atom. The short tails are solid streaks in the world (streaks.ts).
  toOverlay(trail);
  toOverlay(ring);

  // Every flight is straight, so every tail is one straight segment: from the electron back along its flight,
  // never past the point where it last turned (a polyline through a bounce would fold the ribbon into a flap).
  const flight = Array.from({ length: n }, () => ({
    prev: new Vector3(),
    corner: new Vector3(),
    dir: new Vector3(),
    speed: 0,
  }));
  // the marked electron's path: the corners it turned at (with the time), newest last
  const corners: { p: Vector3; at: number }[] = [];
  const pathPool = Array.from({ length: PATH_SEGMENTS }, () => ({
    points: [new Vector3(), new Vector3()],
    brightness: [0, 0],
  }));
  let primed = false;
  let lastMarked = -1;
  let clock = 0;
  const p = new Vector3();
  const d = new Vector3();
  const glowAt = (at: number): number => Math.max(1 - (clock - at) / PATH_S, 0) ** 1.3;
  const view: ElectronView = {
    group,
    orbs,
    marked: -1,
    fade: 1,
    crowd: 1,
    positionOf: (e, out) => out.fromArray(sim.pos, 3 * e),
    cut: () => (primed = false),
    update(dt, face) {
      const m = view.marked;
      if (m !== lastMarked) corners.length = 0;
      lastMarked = m;
      clock += dt;
      for (let e = 0; e < n; e++) {
        p.fromArray(sim.pos, 3 * e);
        const f = flight[e]!;
        const step = d.subVectors(p, f.prev).length();
        if (!primed || step > JUMP) {
          // a wrap of the periodic box or a jump of state: no flight to draw yet
          f.corner.copy(p);
          f.speed = 0;
          if (e === m) corners.length = 0;
        } else if (dt > 0 && step > 1e-5) {
          d.multiplyScalar(1 / step);
          if (f.speed > 0 && d.dot(f.dir) < 0.96) {
            f.corner.copy(f.prev);
            if (e === m) corners.push({ p: f.prev.clone(), at: clock - dt });
          }
          f.dir.copy(d);
          f.speed = step / dt;
        }
        f.prev.copy(p);
        const reach = Math.min(f.speed * TAIL_S, f.corner.distanceTo(p));
        d.copy(p).addScaledVector(f.dir, -reach);
        const deep = sim.depthOf[e]!;
        const k = sim.shown[e]!;
        const isMarked = e === m;
        const light = isMarked ? 1.5 : view.crowd * mix(1, 0.34, deep);
        orbs.setPosition(e, p.x, p.y, p.z, k * (isMarked ? 1.25 : mix(1, 0.8, deep)));
        orbs.setInstanceColor(e, isMarked ? 'white' : 'cyan', light);
        const size = k * (isMarked ? 1.25 : mix(1, 0.8, deep));
        tails.set(
          e,
          p.x,
          p.y,
          p.z,
          d.x,
          d.y,
          d.z,
          ELECTRON_R * 0.9 * size,
          reach > 0.05 ? Math.min(light, 1.2) : 0,
        );
      }
      primed = true;
      orbs.commit();
      orbs.fade = view.fade;
      tails.commit();
      tails.fade = view.fade;
      trail.visible = view.fade > 0.5;
      // the marked electron: a ring around it and the path it has flown (≈ 2.5 s of it)
      ring.visible = m >= 0 && view.fade > 0.5;
      if (m >= 0) {
        view.positionOf(m, p);
        ring.position.copy(p);
        ring.quaternion.copy(face.quaternion);
        ring.scale.setScalar(sim.shown[m]!);
        // forget corners that are too old (keep one older than the limit: the oldest segment is cut in its middle)
        while (corners.length > 1 && corners[1]!.at < clock - PATH_S) corners.shift();
        while (corners.length >= PATH_SEGMENTS) corners.shift();
        const count = corners.length;
        for (let i = 0; i < count; i++) {
          const a = corners[i]!;
          const endP = i + 1 < count ? corners[i + 1]!.p : p;
          const endAt = i + 1 < count ? corners[i + 1]!.at : clock;
          const seg = pathPool[i]!;
          // the part of the oldest segment that is older than the limit is not drawn
          const cut = Math.min(Math.max((clock - PATH_S - a.at) / Math.max(endAt - a.at, 1e-4), 0), 1);
          seg.points[0]!.lerpVectors(a.p, endP, cut);
          seg.points[1]!.copy(endP);
          seg.brightness[0] = glowAt(a.at + (endAt - a.at) * cut);
          seg.brightness[1] = glowAt(endAt);
        }
        trail.setLines(pathPool.slice(0, count));
      } else trail.setLines([]);
    },
  };
  return view;
}
