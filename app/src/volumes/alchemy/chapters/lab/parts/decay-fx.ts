/**
 * Everything that leaves the nucleus, or falls into it: the particles of a decay (α — two protons and two neutrons
 * together, β⁻ — an electron, β⁺ — a positron, protons, neutrons), the neutrons a compound nucleus evaporates after
 * a capture, the positron of two fusing protons, the nucleon a γ quantum knocks out, an outer electron that falls
 * into the nucleus (electron capture), and the surplus electrons a smaller atom can no longer hold (`state.shed`).
 * The nucleus flashes (`yellow`, light) when it changes.
 *
 * Timing: the nucleus changes (the scene's `onImpact`) as the particles leave — at once — except for electron
 * capture, where it changes when the falling electron arrives. Particles fly out over `DECAY.fly` and fade; their
 * directions avoid the emitter (lower left), the board (left) and the name plate (right), with a little jitter
 * from the chapter's seeded random numbers. Electrons and positrons draw a trail.
 */
import { Group, Object3D, Vector3 } from 'three';
import { EASE, toOverlay, type ChapterContext } from '@/engine/api';
import { createHalo, createOrbs, createTrail, type Orbs, type Trail } from '@/fx';
import { EMITS, ELECTRONS_USED, type Particle } from '@alchemy/sim/lab';
import type { AtomView } from './atom-view';
import { Clip, createCluster, SHOT_DIRECTION, smooth, type EventFx } from './emitter';
import type { SessionEvent } from './session';

/** Durations, seconds. */
export const DECAY = {
  /** A particle flies out and fades. */
  fly: 0.7,
  /** An outer electron falls into the nucleus (electron capture). */
  fall: 0.6,
  /** The flash of the changing nucleus. */
  flash: 0.3,
} as const;

type Kind = Particle | 'shed';
interface Flyer {
  readonly kind: Kind;
  /** Instance in its swarm (the α particle has a cluster of its own). */
  readonly index: number;
  readonly from: Vector3;
  readonly dir: Vector3;
  readonly reach: number;
  /** Clip time it leaves (falling electrons: 0). */
  readonly start: number;
  readonly falling: boolean;
  readonly trail: Trail | null;
  readonly target: Object3D;
}

const DEG = Math.PI / 180;
/** Directions of the particles of one event, in order (degrees from +x): up, down, then the diagonals away from the emitter. */
const OUT_ANGLES = [65, -55, 115, -110, 35, -25];
/** Where surplus electrons leave the outer shell. */
const SHED_ANGLES = [100, 70, -80, 40];
/** How far each kind flies (world units): light and fast ones farther. */
const REACH: Record<Kind, number> = { 'e-': 5, 'e+': 5, n: 4.2, p: 4.2, alpha: 3.6, shed: 2.5 };
const TRAIL_COLOR: Record<Kind, 'cyan' | 'coral' | 'mist'> = { 'e-': 'cyan', 'e+': 'coral', n: 'mist', p: 'coral', alpha: 'coral', shed: 'cyan' };
const Z_AXIS = new Vector3(0, 0, 1);
/** Most particles of one event (β⁻ with four neutrons and four surplus electrons: 9); the first ones draw a trail. */
const MAX_FLYERS = 12;
const TRAILS = 6;

export function createDecayFx(ctx: ChapterContext, atom: AtomView): EventFx {
  const group = new Group();
  group.name = 'lab-decay-fx';
  const rng = ctx.random.fork('decay-fx');

  const alpha = createCluster(2, 2);
  alpha.shape(2, 2, 0.15);
  alpha.group.visible = false;
  const protons = createOrbs({ kind: 'proton', count: 4, radius: 0.17 });
  const neutrons = createOrbs({ kind: 'neutron', count: 6, radius: 0.17 });
  const electrons = createOrbs({ kind: 'electron', count: 8, radius: 0.15 });
  // the positron: an electron's twin with the opposite charge — a `coral` marble with a «+»
  const positrons = createOrbs({ kind: 'electron', count: 2, radius: 0.15, color: 'coral', glyph: 'plus' });
  electrons.glow = positrons.glow = 1.6; // heroes among the faint shell electrons
  const swarms: Record<Exclude<Kind, 'alpha'>, Orbs> = { p: protons, n: neutrons, 'e-': electrons, shed: electrons, 'e+': positrons };
  for (const s of [protons, neutrons, electrons, positrons]) s.instances = 0;
  const targets = Array.from({ length: MAX_FLYERS }, () => new Object3D());
  const trails = targets.slice(0, TRAILS).map((t) => createTrail(t, { duration: 0.3, width: 0.04, intensity: 1.1 }));
  for (const tr of trails) {
    tr.visible = false;
    toOverlay(tr); // crisp: a trail writes no depth, the depth of field would blur it with the backdrop
  }
  const flash = createHalo({ color: 'yellow', size: 1, intensity: 0 });
  flash.visible = false;
  group.add(alpha.group, protons, neutrons, electrons, positrons, ...targets, ...trails, flash);

  let clip: Clip | null = null;
  let flyers: Flyer[] = [];
  const p = new Vector3();
  const shellPoint = new Vector3();

  const hide = (): void => {
    for (const s of [protons, neutrons, electrons, positrons]) s.instances = 0;
    alpha.group.visible = false;
    for (const tr of trails) {
      tr.visible = false;
      tr.reset();
    }
    flash.visible = false;
    flyers = [];
    clip = null;
  };

  /** Lays out the particles of `e`; returns the clip time of the impact (0, or the end of a fall). */
  function launch(e: Extract<SessionEvent, { type: 'turn' }>): number {
    const ev = e.event;
    const used = { p: 0, n: 0, 'e-': 0, 'e+': 0 };
    const core = atom.coreRadius;
    const jitter = rng.range(-10, 10) * DEG;
    const out: Kind[] = [];
    let falling = 0;
    let knocked: Vector3 | null = null;
    switch (ev.type) {
      case 'decay':
        out.push(...EMITS[ev.mode]);
        falling = Math.min(ELECTRONS_USED[ev.mode] ?? 0, e.before.electrons);
        break;
      case 'capture':
        if (ev.pp) out.push('e+');
        for (let k = 0; k < ev.evaporated; k++) out.push('n');
        break;
      case 'knockOut':
        out.push(ev.what);
        // the knocked nucleon carries on the way the γ came (from the emitter, lower left)
        knocked = SHOT_DIRECTION.clone().applyAxisAngle(Z_AXIS, jitter);
        break;
      default:
        break;
    }
    const impact = falling > 0 ? DECAY.fall : 0;
    const add = (kind: Kind, from: Vector3, dir: Vector3, start: number, fall: boolean): void => {
      if (flyers.length >= MAX_FLYERS) return;
      const swarmKind = kind === 'shed' ? 'e-' : kind;
      const index = kind === 'alpha' ? 0 : used[swarmKind as keyof typeof used]++;
      const trail = trails[flyers.length] ?? null;
      if (trail) {
        trail.setColor(TRAIL_COLOR[kind]);
        trail.reset();
      }
      flyers.push({ kind, index, from, dir, reach: REACH[kind], start, falling: fall, trail, target: targets[flyers.length]! });
    };
    // electron capture: the electrons come from the outer shell (upper left), the shells lend them meanwhile
    if (falling > 0) {
      atom.anchors.shells.getWorldPosition(shellPoint);
      for (let k = 0; k < falling; k++) {
        const from = shellPoint.clone().applyAxisAngle(Z_AXIS, Math.PI * k);
        add('e-', from, new Vector3(), 0, true);
      }
      atom.lendElectrons(falling);
    }
    out.forEach((kind, k) => {
      const angle = OUT_ANGLES[k % OUT_ANGLES.length]! * DEG + jitter;
      const dir = knocked && k === 0 ? knocked.clone() : new Vector3(Math.cos(angle), Math.sin(angle), 0);
      add(kind, dir.clone().multiplyScalar(core), dir, impact, false);
    });
    // a smaller atom cannot hold all its electrons: the surplus leaves the outer shell
    const shellR = atom.anchors.shells.getWorldPosition(shellPoint).length();
    for (let k = 0; k < Math.min(e.after.shed, SHED_ANGLES.length); k++) {
      const angle = SHED_ANGLES[k]! * DEG + jitter;
      const dir = new Vector3(Math.cos(angle), Math.sin(angle), 0);
      add('shed', dir.clone().multiplyScalar(shellR), dir, impact, false);
    }
    protons.instances = used.p;
    neutrons.instances = used.n;
    electrons.instances = used['e-'];
    positrons.instances = used['e+'];
    alpha.group.visible = out.includes('alpha');
    for (const f of flyers) if (f.trail) f.trail.visible = true;
    return impact;
  }

  /** Where flyer `f` is at clip time `tau` (into `p`); returns its scale (0 = not out yet / gone). */
  function where(f: Flyer, tau: number): number {
    if (f.falling) {
      // a spiral into the nucleus, faster as it closes in; gone on arrival
      const u = Math.min(1, tau / DECAY.fall);
      const k = EASE['power1.in'](u);
      const r0 = f.from.length();
      const r = r0 + (atom.coreRadius - r0) * k;
      const a = Math.atan2(f.from.y, f.from.x) - 1.3 * Math.PI * k;
      p.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      return 1 - smooth(0.85, 1, u);
    }
    const u = (tau - f.start) / DECAY.fly;
    if (u < 0) return 0;
    p.copy(f.from).addScaledVector(f.dir, f.reach * EASE['power2.out'](Math.min(u, 1)));
    return 1 - smooth(0.6, 1, u);
  }

  function draw(tau: number): void {
    for (const f of flyers) {
      const k = where(f, tau);
      f.target.position.copy(p);
      if (f.kind === 'alpha') {
        alpha.group.position.copy(p);
        alpha.group.scale.setScalar(Math.max(k, 1e-3));
      } else swarms[f.kind].setPosition(f.index, p.x, p.y, p.z, k);
      if (f.trail) f.trail.visible = k > 0.01;
    }
    for (const s of [protons, neutrons, electrons, positrons]) s.commit();
    alpha.group.rotation.z = tau * 2.5;
    // the flash of the changing nucleus
    const impact = clip?.impactAt ?? 0;
    const glow = tau < impact ? 0 : smooth(impact, impact + 0.05, tau) * (1 - smooth(impact + 0.05, impact + DECAY.flash, tau));
    flash.visible = glow > 0.01;
    flash.intensity = 1.6 * glow;
    flash.size = Math.max(1.2, 5 * atom.coreRadius);
  }

  const fx: EventFx = {
    group,
    // a flash alone fading after the impact holds nothing up; flying particles do
    get busy() {
      return clip !== null && (clip.t < clip.impactAt || flyers.length > 0);
    },

    play(e, onImpact) {
      if (e.type === 'reset') {
        clip?.drop();
        hide();
        onImpact();
        return;
      }
      if (e.type !== 'turn' || !['decay', 'capture', 'knockOut'].includes(e.event.type)) {
        onImpact();
        return;
      }
      if (clip) fx.skip();
      const impact = launch(e);
      clip = new Clip(impact, impact + (flyers.length > 0 ? DECAY.fly : DECAY.flash), onImpact);
      draw(0);
      clip.advance(0);
    },

    skip() {
      if (!clip) return;
      const c = clip;
      hide();
      c.finish();
    },

    update(dt) {
      const c = clip;
      if (!c) return;
      const tau = c.advance(dt);
      if (clip !== c) return; // the impact ended this run (a reset)
      draw(tau);
      if (c.done) hide();
    },
  };
  return fx;
}
