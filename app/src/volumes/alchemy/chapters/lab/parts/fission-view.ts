/**
 * Fission on stage: the nucleus (the compound nucleus after a neutron hit, or the nucleus itself in a spontaneous
 * fission) becomes a liquid drop that grows to a size the eye can follow, trembles, stretches into a dumbbell and
 * tears into two fragments; the free neutrons fly off with trails. The fragments then hang left and right of the
 * atom's place until one is picked — by a click on it in the scene (`pick`, the twin of the dock's «Продовжити з
 * важким / легким уламком») or in the dock; the scene's callouts carry their symbols. The picked fragment moves
 * to the centre and becomes the new atom's nucleus, the other one drifts away.
 *
 * The atom view hides its own nucleus, shells and plate while a choice is pending (the drop takes the nucleus's
 * place at its size), so the fragments have the free area to themselves. The drop is `shared/fission-drop.ts`.
 */
import { Group, Mesh, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { EASE, toOverlay, type ChapterContext } from '@/engine/api';
import { createHalo, createNeutron, createTrail, type Orbs } from '@/fx';
import { K } from '@/style';
import { MAX_N, MAX_Z, nuclideSymbol, type NuclideRef } from '@alchemy/sim/core';
import { createFissionDrop, type DropPose } from '@alchemy/shared/fission-drop';
import { L } from '../labels';
import { Clip, smooth, type EventFx } from './emitter';

export type Fragment = 'heavy' | 'light';

export interface FissionView extends EventFx {
  /** The two fragments while they hang in the scene (callouts, QA probes `lab.fragment.*`; hidden otherwise). */
  readonly anchors: { readonly heavy: Object3D; readonly light: Object3D };
  /** Above the middle of the pair: the hotspot `fragments`. */
  readonly middle: Object3D;
  /** The fragments hang and wait to be picked. */
  readonly choosing: boolean;
  /** Symbol of a fragment on show («¹⁴¹Ba»), '' when there is none. */
  label(which: Fragment): string;
  /** World radius of the atom's nucleus now: the drop starts at that size. The scene keeps it current. */
  nucleusRadius: number;
}

/** Durations, seconds. */
export const FISSION = {
  /** The drop grows, trembles and stretches. */
  tremble: 0.9,
  /** It tears: the fragments round off and move apart, the free neutrons fly. */
  tear: 0.6,
  /** A picked fragment moves to the centre (the atom takes it over at 0.45 s). */
  pick: 0.6,
} as const;

/** World size of the drop, and where the fragments hang (the atom is at the origin, the emitter lower left). */
const DROP_RADIUS = 1.3;
const HANG: Record<Fragment, Vector3> = { heavy: new Vector3(-2.8, 0.8, 0), light: new Vector3(3.2, -0.7, 0) };
const MIDDLE = new Vector3(0.2, 2.2, 0);
/** The free neutrons: directions (degrees from +x) away from the emitter and the board, distance. */
const NEUTRON_ANGLES = [95, -75, 145, 35];
const NEUTRON_REACH = 4.5;
const NEUTRON_FLY = 0.7;
const DEG = Math.PI / 180;
/** When the picked fragment hands over to the atom. */
const HANDOVER = 0.45;

export function createFissionView(ctx: ChapterContext, pick: (which: Fragment) => void): FissionView {
  const group = new Group();
  group.name = 'lab-fission';
  const drop = createFissionDrop(MAX_Z, MAX_N + 1);
  drop.group.visible = false;
  const neutrons: Orbs[] = NEUTRON_ANGLES.map(() => createNeutron({ radius: 0.17 }));
  const trails = neutrons.map((n) => createTrail(n, { color: 'mist', duration: 0.3, width: 0.045, intensity: 1 }));
  for (const n of neutrons) n.visible = false;
  for (const tr of trails) {
    tr.visible = false;
    toOverlay(tr); // crisp: a trail writes no depth, the depth of field would blur it with the backdrop
  }
  const flash = createHalo({ color: 'yellow', size: 3.5, intensity: 0 });
  flash.visible = false;

  // the affordance of a fragment you can pick: a cyan ring (brighter under the pointer) and an invisible pick sphere
  const ringGeometry = new RingGeometry(0.92, 1, 64);
  const sphere = new SphereGeometry(1, 16, 12);
  const part = (which: Fragment): { ring: Mesh<RingGeometry, ReturnType<typeof K.glow>>; proxy: Mesh } => {
    const ring = new Mesh(ringGeometry, K.glow({ color: 'cyan', intensity: 1.4, whiten: 0, keepHue: true, falloff: 0 }));
    const proxy = new Mesh(sphere, K.flat('cyan'));
    proxy.material.colorWrite = false;
    proxy.material.depthWrite = false;
    proxy.name = `fragment-${which}`;
    ring.visible = proxy.visible = false;
    return { ring, proxy };
  };
  const parts = { heavy: part('heavy'), light: part('light') };
  const middle = new Object3D();
  middle.position.copy(MIDDLE);
  group.add(drop.group, ...neutrons, ...trails, flash, parts.heavy.ring, parts.light.ring, parts.heavy.proxy, parts.light.proxy, middle);

  let clip: Clip | null = null;
  let mode: 'fission' | 'pick' = 'fission';
  let dealt: { heavy: NuclideRef; light: NuclideRef; freed: number } | null = null;
  let chosen: Fragment = 'heavy';
  let choosing = false;
  let hovered: Fragment | null = null;
  let start = 0.5; // drop scale at the hit
  let full = 1; // drop scale once grown
  const sizes = { heavy: 1, light: 1 };
  const pose: DropPose = { wobble: 0, stretch: 0, heavy: new Vector3(), light: new Vector3(), split: 0, scale: sizes };
  const world = { heavy: new Vector3(), light: new Vector3() };
  const eye = new Vector3();
  const from = new Vector3();
  const to = new Vector3();
  let now = 0; // engine time of the last update (a skip draws the final picture at once)

  const showParts = (on: boolean): void => {
    for (const which of ['heavy', 'light'] as const) parts[which].ring.visible = parts[which].proxy.visible = on;
  };
  const hideNeutrons = (): void => {
    neutrons.forEach((n, i) => {
      n.visible = false;
      trails[i]!.visible = false;
      trails[i]!.reset();
    });
  };
  const clear = (): void => {
    clip = null;
    dealt = null;
    choosing = false;
    hovered = null;
    drop.group.visible = false;
    flash.visible = false;
    showParts(false);
    hideNeutrons();
  };

  /** Fragment centres (world) and drop pose at fission clip time `tau`. */
  function fissionPose(tau: number, t: number): void {
    const T = FISSION.tremble;
    const s = start + (full - start) * EASE['power2.out'](Math.min(1, tau / 0.5));
    drop.group.scale.setScalar(s);
    if (tau < T) {
      pose.wobble = Math.min(1, 0.2 + tau / 0.35);
      pose.stretch = smooth(0.45, T, tau);
      pose.split = 0;
    } else {
      const u = Math.min(1, (tau - T) / FISSION.tear);
      pose.wobble = Math.max(0, 0.6 - (tau - T));
      pose.stretch = 1;
      pose.split = Math.min(1, (tau - T) / 0.45);
      // each half leaves from where the dumbbell put it, and eases to where it hangs
      const k = EASE['power2.out'](u);
      for (const which of ['heavy', 'light'] as const) {
        from.copy(drop.centroids[which]).setX(drop.centroids[which].x + (which === 'heavy' ? -0.75 : 0.75) * drop.radius);
        pose[which].copy(from).lerp(to.copy(HANG[which]).divideScalar(full), k);
      }
    }
    sizes.heavy = sizes.light = 1;
    drop.pose(pose, t);
    // the free neutrons leave the tearing neck
    neutrons.forEach((n, i) => {
      const u = (tau - T) / NEUTRON_FLY;
      const on = dealt !== null && i < dealt.freed && u >= 0 && u < 1;
      n.visible = on;
      trails[i]!.visible = on;
      if (!on) return;
      const a = NEUTRON_ANGLES[i]! * DEG;
      n.position.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(0.3 + NEUTRON_REACH * EASE['power2.out'](u));
      n.scale.setScalar(Math.max(1 - smooth(0.6, 1, u), 1e-3));
    });
    const glow = smooth(T, T + 0.05, tau) * (1 - smooth(T + 0.05, T + 0.35, tau));
    flash.visible = glow > 0.01;
    flash.intensity = 1.8 * glow;
  }

  /** The hanging fragments (choice pending): a slow bob, rings round the pickable ones. */
  function hangPose(t: number): void {
    drop.group.scale.setScalar(full);
    const still = ctx.reducedMotion;
    for (const which of ['heavy', 'light'] as const) {
      const bob = still ? 0 : 0.06 * Math.sin(t * 1.3 + (which === 'heavy' ? 0 : 2));
      world[which].copy(HANG[which]).setY(HANG[which].y + bob);
      pose[which].copy(world[which]).divideScalar(full);
    }
    pose.wobble = 0;
    pose.stretch = 1;
    pose.split = 1;
    sizes.heavy = hovered === 'heavy' ? 1.06 : 1;
    sizes.light = hovered === 'light' ? 1.06 : 1;
    drop.pose(pose, t);
    ctx.camera.camera.getWorldPosition(eye);
    for (const which of ['heavy', 'light'] as const) {
      const radius = drop.fragmentRadius[which] * full;
      const { ring, proxy } = parts[which];
      ring.position.copy(world[which]);
      ring.scale.setScalar(radius + 0.28);
      ring.lookAt(eye);
      // a gentle pulse in brightness (STYLE_GUIDE §6), full under the pointer
      ring.material.intensity = hovered === which ? 2 : still ? 1.2 : 1 + 0.35 * Math.sin(t * 3);
      ring.scale.multiplyScalar(hovered === which ? 1.05 : 1);
      proxy.position.copy(world[which]);
      proxy.scale.setScalar(radius * 1.15);
    }
  }

  /** The picked fragment moves in and hands over to the atom; the other drifts away. */
  function pickPose(tau: number, t: number): void {
    const u = Math.min(1, tau / FISSION.pick);
    const end = Math.max(0.3, view.nucleusRadius) / drop.fragmentRadius[chosen];
    const s = full + (end - full) * EASE['power2.inOut'](u);
    drop.group.scale.setScalar(s);
    const other: Fragment = chosen === 'heavy' ? 'light' : 'heavy';
    world[chosen].copy(HANG[chosen]).multiplyScalar(1 - EASE['power2.inOut'](u));
    world[other].copy(HANG[other]).multiplyScalar(1 + 0.8 * EASE['power2.out'](u));
    pose.heavy.copy(world.heavy).divideScalar(s);
    pose.light.copy(world.light).divideScalar(s);
    pose.wobble = 0;
    pose.stretch = 1;
    pose.split = 1;
    sizes[chosen] = 1 - smooth(HANDOVER, FISSION.pick + 0.15, tau);
    sizes[other] = 1 - smooth(0.1, FISSION.pick, tau);
    drop.pose(pose, t);
  }

  const view: FissionView = {
    group,
    anchors: { heavy: parts.heavy.proxy, light: parts.light.proxy },
    middle,
    nucleusRadius: 0.5,
    get busy() {
      return clip !== null;
    },
    get choosing() {
      return choosing;
    },

    label(which) {
      const x = dealt?.[which];
      return x ? nuclideSymbol(x.z, x.n) : '';
    },

    play(e, onImpact) {
      if (e.type === 'reset') {
        clip?.drop();
        clear();
        onImpact();
        return;
      }
      const ev = e.type === 'turn' ? e.event : null;
      if (ev?.type === 'fission') {
        if (clip) view.skip();
        const f = ev.fission;
        const a = ev.from.z + ev.from.n + (ev.induced ? 1 : 0);
        drop.deal({ z: ev.from.z, a, heavy: { z: f.heavy.z, a: f.heavy.z + f.heavy.n }, freed: f.neutrons });
        dealt = { heavy: f.heavy, light: f.light, freed: f.neutrons };
        start = Math.max(view.nucleusRadius, 0.2) / drop.radius;
        full = DROP_RADIUS / drop.radius;
        mode = 'fission';
        choosing = false;
        showParts(false);
        drop.group.visible = true;
        for (const tr of trails) tr.reset();
        clip = new Clip(FISSION.tremble, FISSION.tremble + Math.max(FISSION.tear, NEUTRON_FLY) + 0.05, onImpact);
      } else if (ev?.type === 'fragment' && dealt) {
        if (clip) view.skip();
        chosen = ev.to.z === dealt.heavy.z && ev.to.n === dealt.heavy.n ? 'heavy' : 'light';
        mode = 'pick';
        choosing = false;
        hovered = null;
        showParts(false);
        clip = new Clip(HANDOVER, FISSION.pick + 0.15, onImpact);
      } else {
        onImpact();
        return;
      }
      clip.advance(0);
    },

    skip() {
      if (!clip) return;
      const c = clip;
      clip = null;
      hideNeutrons();
      flash.visible = false;
      if (mode === 'fission') {
        choosing = true;
        showParts(true);
        hangPose(now);
      } else clear();
      c.finish();
    },

    update(dt, t) {
      now = t;
      const c = clip;
      if (c) {
        const tau = c.advance(dt);
        if (clip !== c) return; // the impact ended this run
        if (mode === 'fission') fissionPose(tau, t);
        else pickPose(tau, t);
        if (c.done) {
          clip = null;
          hideNeutrons();
          flash.visible = false;
          if (mode === 'fission') {
            choosing = true;
            showParts(true);
          } else clear();
        }
      }
      if (choosing) hangPose(t);
    },
  };

  for (const which of ['heavy', 'light'] as const) {
    ctx.input.register(parts[which].proxy, {
      tooltip: which === 'heavy' ? L.fission.heavy : L.fission.light,
      cursor: 'pointer',
      hover: (over) => {
        hovered = over ? which : hovered === which ? null : hovered;
      },
      click: () => {
        if (choosing) pick(which);
      },
      enabled: () => choosing,
    });
  }
  return view;
}
