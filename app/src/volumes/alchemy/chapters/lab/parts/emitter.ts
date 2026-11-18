/**
 * The emitter on the left of the atom and what flies out of it: a projectile (a neutron, a proton or a small
 * nucleus) or a γ quantum flies into the nucleus; a hit sinks in, a bounce glances off and flies away. Between
 * shots the muzzle holds what the next «Вистрілити» sends (the step's projectile, the one chosen in the dock), a γ
 * source in a step that only knocks out nucleons, nothing in a step that only waits (then the scene hides it).
 *
 * This file also holds what the three event animations share (`emitter`, `decay-fx`, `fission-view`): the
 * `EventFx` contract, the `Clip` that times one event, and `Cluster`, the small nucleus a projectile or an α
 * particle is drawn as.
 *
 * Placement: the muzzle sits lower left of the atom (the atom is at the origin), outside the largest atom (outer
 * electrons ≤ 4.4 units out) and right of the board «Карта нуклідів» at 1280×720 and 1920×1080 (measured: the
 * device's back end lands ≥ 19 CSS px right of the board at 720p, ≥ 32 px at 1080p). Sizes are not to scale.
 */
import { Group, LatheGeometry, Mesh, Object3D, TorusGeometry, Vector2, Vector3 } from 'three';
import { damp, EASE, toOverlay, type ChapterContext } from '@/engine/api';
import { createHalo, createOrbs, createPhotons, createTrail } from '@/fx';
import { K } from '@/style';
import { PROJECTILES, type ProjectileId } from '@alchemy/sim/lab';
import { packCluster } from '@alchemy/shared/fission-drop';
import type { SessionEvent } from './session';

/** One event animation of the lab (the emitter, the decay particles, the fission). */
export interface EventFx {
  /** Everything it draws (the scene adds it under `ctx.root`). */
  readonly group: Group;
  /** Something is still being shown (a waiting fragment choice is not). */
  readonly busy: boolean;
  /**
   * Show event `e`. `onImpact` fires exactly once, at the moment the atom must change (at once when there is
   * nothing to show before that). A `reset` (a new run, a new step) stops everything at once: nothing in flight
   * stays, and the callback of an interrupted event is dropped, never fired.
   */
  play(e: SessionEvent, onImpact: () => void): void;
  /** Straight to the final look of the event being shown; its pending `onImpact` fires now. */
  skip(): void;
  update(dt: number, t: number): void;
}

/** The clock of one event: its impact moment fires the callback once, `finish` jumps to the end. */
export class Clip {
  t = 0;
  private impact: (() => void) | null;

  constructor(
    readonly impactAt: number,
    readonly length: number,
    onImpact: () => void,
  ) {
    this.impact = onImpact;
  }

  get done(): boolean {
    return this.t >= this.length;
  }

  /** Moves the clip's clock (fires the impact when its moment has come); returns the clip time. */
  advance(dt: number): number {
    this.t = Math.min(this.t + Math.max(dt, 0), this.length);
    if (this.t >= this.impactAt) this.hit();
    return this.t;
  }

  finish(): void {
    this.t = this.length;
    this.hit();
  }

  /** Forget the callback: the run it belonged to is over. */
  drop(): void {
    this.impact = null;
  }

  private hit(): void {
    const fire = this.impact;
    this.impact = null;
    fire?.();
  }
}

/** 0 → 1 between `a` and `b` (smoothstep). */
export const smooth = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A small nucleus: Z protons and N neutrons packed into a ball, centred on its group (projectiles, α). */
export interface Cluster {
  readonly group: Group;
  /** Radius of the ball (local units of the group's parent). */
  readonly radius: number;
  /** Re-pack for Z protons and N neutrons of radius `nucleon`. */
  shape(z: number, n: number, nucleon: number): void;
}

export function createCluster(maxZ: number, maxN: number): Cluster {
  const protons = createOrbs({ kind: 'proton', count: Math.max(1, maxZ), radius: 0.2 });
  const neutrons = createOrbs({ kind: 'neutron', count: Math.max(1, maxN), radius: 0.2 });
  protons.instances = neutrons.instances = 0;
  const group = new Group();
  group.add(protons, neutrons);
  const centre = new Vector3();
  const cluster = {
    group,
    radius: 0.2,
    shape(z: number, n: number, nucleon: number): void {
      const a = z + n;
      const pts = a === 1 ? [new Vector3()] : packCluster(a, nucleon);
      centre.set(0, 0, 0);
      for (const p of pts) centre.add(p);
      centre.multiplyScalar(1 / a);
      let ip = 0;
      let ineu = 0;
      let far = 0;
      for (let s = 0; s < a; s++) {
        const p = pts[s]!.sub(centre);
        far = Math.max(far, p.length());
        // protons spread evenly over the ball, as in the atom's nucleus
        const isProton = Math.floor(((s + 1) * z) / a) > Math.floor((s * z) / a);
        if (isProton) protons.setPosition(ip++, p.x, p.y, p.z);
        else neutrons.setPosition(ineu++, p.x, p.y, p.z);
      }
      protons.instances = ip;
      neutrons.instances = ineu;
      protons.radius = neutrons.radius = nucleon;
      protons.commit();
      neutrons.commit();
      cluster.radius = far + nucleon;
    },
  };
  return cluster;
}

/** Radius of each nucleon of a flying nucleus of A nucleons: a hero-size neutron, a ⁴⁸Ca no wider than 1 unit. */
export const nucleonRadius = (a: number): number => Math.min(0.2, 0.5 / Math.cbrt(Math.max(a, 1) / 0.6));

/** What the muzzle holds: a projectile, a γ source, or nothing. */
export type Loaded = ProjectileId | 'gamma' | null;

export interface Emitter extends EventFx {
  /** On the device's collar (hotspot `emitter`, QA probe `lab.emitter`). */
  readonly anchor: Object3D;
  /** The device itself — a step actor: shown in the steps that shoot or knock out nucleons. */
  readonly device: Object3D;
  /** What waits in the muzzle; a change pops in between shots. */
  load(what: Loaded): void;
  /** World radius of the nucleus the shots fly at (a bounce turns there); the scene keeps it current. */
  nucleusRadius: number;
}

/** Durations, seconds (STYLE_GUIDE §5: short and eased). */
export const SHOT = {
  /** A projectile from the muzzle into the nucleus. */
  flight: 0.45,
  /** A γ quantum from the muzzle into the nucleus. */
  gamma: 0.6,
  /** A bounced projectile flying away. */
  bounce: 0.5,
  /** The hit projectile sinks into the nucleus (the next one then pops into the muzzle). */
  sink: 0.12,
} as const;

/** The muzzle, world units (the atom sits at the origin). */
const MUZZLE = new Vector3(-3.7, -3.3, 0);
/** Unit direction of every shot: from the muzzle to the nucleus. */
const AIM = MUZZLE.clone().negate().normalize();
/** The way every shot flies (world, unit): a knocked-out nucleon carries on along it. */
export const SHOT_DIRECTION: Readonly<Vector3> = AIM;
const ORIGIN = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);
/** A bounce leaves at this angle to the way back (toward the free space below the atom, never at the board). */
const BOUNCE_TURN = Math.PI / 4;
const BOUNCE_REACH = 3.5;
/** Barrel profile (radius, axial position; the muzzle at 0, the back at −1.15): rounded back, flared lip, bore. */
const BARREL: readonly [number, number][] = [
  [0.001, -1.15], [0.12, -1.14], [0.2, -1.1], [0.25, -1.03], [0.265, -0.95], [0.265, -0.22], [0.29, -0.14],
  [0.305, -0.06], [0.3, -0.01], [0.27, 0.01], [0.2, 0.01], [0.175, -0.03], [0.17, -0.3], [0.001, -0.32],
];
const GAP = 0.08;

export function createEmitter(ctx: ChapterContext): Emitter {
  const group = new Group();
  group.name = 'lab-emitter-fx';

  // the device: a short barrel with a glowing violet lip (the chapter's accent), pointing at the nucleus
  const device = new Group();
  device.name = 'emitter';
  device.position.copy(MUZZLE);
  device.quaternion.setFromUnitVectors(Z_AXIS, AIM);
  const lathe = new LatheGeometry(BARREL.map(([r, y]) => new Vector2(r, y)), 40);
  lathe.rotateX(Math.PI / 2); // lathe axis +Y → the device's +Z (toward the nucleus)
  const barrel = new Mesh(lathe, K.metal({ color: 'steel' }));
  const collar = new Mesh(new TorusGeometry(0.29, 0.06, 12, 40), K.toon({ color: 'slate', gloss: 0.4 }));
  collar.position.z = -0.72;
  const lip = new Mesh(new TorusGeometry(0.255, 0.032, 10, 48), K.glow({ color: 'violet', intensity: 1.6, whiten: 0, keepHue: true }));
  // the hotspot marker sits on the collar, so the projectile waiting in the muzzle stays in sight
  const anchor = new Object3D();
  anchor.name = 'emitter-anchor';
  anchor.position.z = collar.position.z;
  device.add(barrel, collar, lip, anchor);

  // what waits in the muzzle: a nucleon or a small nucleus, or (γ source) a quantum quivering in a yellow glow
  const ready = createCluster(20, 28);
  device.add(ready.group);
  const readyGamma = createPhotons({ count: 1, color: 'yellow', length: 0.55, amplitude: 0.08, waves: 3, width: 0.035, intensity: 1.4 });
  const gammaGlow = createHalo({ color: 'yellow', size: 0.75, intensity: 1.1 });
  gammaGlow.position.z = 0.1;
  device.add(readyGamma, gammaGlow);

  // the shot in flight
  const shot = createCluster(20, 28);
  shot.group.visible = false;
  const trail = createTrail(shot.group, { color: 'mist', duration: 0.22, width: 0.05, intensity: 1 });
  trail.visible = false;
  // γ: the yellow light packet, its hue kept on screen (a white-hot core would read as a smudge at this size)
  const gamma = createPhotons({ count: 1, color: 'yellow', length: 1.5, amplitude: 0.22, waves: 4, width: 0.06, keepHue: true });
  gamma.visible = false;
  group.add(device, shot.group, trail, gamma);
  // light and trails are transparent and write no depth: in the world pass the depth of field would blur them with
  // the backdrop behind (ENGINE_API §9) — on the overlay layer they stay crisp (on top of the atom they cross)
  for (const crisp of [gamma, readyGamma, trail]) toOverlay(crisp);

  let clip: Clip | null = null;
  let kind: 'hit' | 'bounce' | 'gamma' = 'hit';
  let loaded: Loaded = null;
  let wanted: Loaded = null;
  let readyScale = 0;
  const start = new Vector3();
  const turn = new Vector3();
  const away = new Vector3();
  const at = new Vector3();

  const shapeAs = (c: Cluster, id: ProjectileId): void => {
    const p = PROJECTILES.find((x) => x.id === id)!;
    c.shape(p.z, p.n, nucleonRadius(p.z + p.n));
  };
  const showLoaded = (): void => {
    const isGamma = loaded === 'gamma';
    ready.group.visible = loaded !== null && !isGamma;
    readyGamma.visible = gammaGlow.visible = isGamma;
  };
  const stop = (): void => {
    shot.group.visible = gamma.visible = trail.visible = false;
    trail.reset();
    clip = null;
  };

  const emitter: Emitter = {
    group,
    anchor,
    device,
    nucleusRadius: 0.4,
    get busy() {
      return clip !== null;
    },

    load(what) {
      wanted = what;
    },

    play(e, onImpact) {
      if (e.type === 'reset') {
        clip?.drop();
        stop();
        readyScale = 1;
        onImpact();
        return;
      }
      const ev = e.type === 'turn' ? e.event : null;
      const projectile: ProjectileId | null =
        ev?.type === 'capture' || ev?.type === 'bounce' ? ev.projectile : ev?.type === 'fission' && ev.induced ? 'n' : null;
      if (ev?.type !== 'knockOut' && projectile === null) {
        onImpact();
        return;
      }
      if (clip) emitter.skip();
      start.copy(MUZZLE).addScaledVector(AIM, GAP);
      if (projectile === null) {
        kind = 'gamma';
        clip = new Clip(SHOT.gamma, SHOT.gamma + 0.15, onImpact);
      } else {
        kind = ev?.type === 'bounce' ? 'bounce' : 'hit';
        shapeAs(shot, projectile);
        trail.setColor(projectile === 'n' ? 'mist' : 'coral');
        shot.group.position.copy(start);
        shot.group.visible = true;
        trail.visible = true;
        trail.reset();
        // a bounce turns where the projectile would touch the nucleus, then glances off downward
        turn.copy(AIM).multiplyScalar(-(emitter.nucleusRadius + shot.radius));
        away.copy(AIM).negate().applyAxisAngle(Z_AXIS, BOUNCE_TURN);
        clip = kind === 'bounce'
          ? new Clip(SHOT.flight, SHOT.flight + SHOT.bounce, onImpact)
          : new Clip(SHOT.flight, SHOT.flight + SHOT.sink, onImpact);
      }
      readyScale = 0;
      clip.advance(0);
    },

    skip() {
      if (!clip) return;
      const c = clip;
      stop();
      c.finish();
      readyScale = 1;
    },

    update(dt, t) {
      // the muzzle: reload between shots, a new choice pops in
      if (!clip && wanted !== loaded) {
        loaded = wanted;
        if (loaded !== null && loaded !== 'gamma') shapeAs(ready, loaded);
        showLoaded();
        readyScale = 0;
      }
      const tau = clip ? clip.advance(dt) : 0;
      const reloaded = !clip || (kind === 'bounce' ? tau >= SHOT.flight + SHOT.bounce * 0.6 : tau >= clip.impactAt);
      readyScale = damp(readyScale, reloaded ? 1 : 0, reloaded ? 9 : 30, dt);
      const bob = ctx.reducedMotion ? 0 : 0.035 * Math.sin(t * 2.2);
      ready.group.position.set(0, 0, GAP + ready.radius + bob);
      ready.group.scale.setScalar(Math.max(readyScale, 1e-3));
      ready.group.rotation.z = ctx.reducedMotion ? 0 : t * 0.6;
      readyGamma.setPhoton(0, [0, 0, 0.3], [0, 0, 1], undefined, Math.max(readyScale, 1e-3));
      readyGamma.commit();
      gammaGlow.fade = readyScale;

      if (!clip) return;
      if (kind === 'gamma') {
        // the packet's front reaches the nucleus at the impact, then the packet is gone
        const u = Math.min(1, tau / SHOT.gamma);
        at.copy(start).lerp(ORIGIN, u).addScaledVector(AIM, -0.75 * u);
        const k = tau <= SHOT.gamma ? smooth(0, 0.08, tau) : 1 - smooth(SHOT.gamma, clip.length, tau);
        gamma.visible = k > 0.01;
        gamma.setPhoton(0, [at.x, at.y, at.z], [AIM.x, AIM.y, AIM.z], undefined, Math.max(k, 1e-3));
        gamma.commit();
      } else if (tau <= SHOT.flight) {
        const u = tau / SHOT.flight;
        if (kind === 'bounce') shot.group.position.copy(start).lerp(turn, u);
        else shot.group.position.copy(start).lerp(ORIGIN, u);
        shot.group.scale.setScalar(1);
      } else if (kind === 'bounce') {
        const u = (tau - SHOT.flight) / SHOT.bounce;
        shot.group.position.copy(turn).addScaledVector(away, BOUNCE_REACH * EASE['power2.out'](u));
        shot.group.scale.setScalar(Math.max(1 - smooth(0.5, 1, u), 1e-3));
      } else {
        // a hit sinks into the nucleus
        shot.group.position.set(0, 0, 0);
        shot.group.scale.setScalar(Math.max(1 - smooth(SHOT.flight, SHOT.flight + SHOT.sink, tau), 1e-3));
        trail.visible = false;
      }
      shot.group.rotation.z = t * 1.4;
      if (clip.done) stop();
    },
  };
  return emitter;
}
