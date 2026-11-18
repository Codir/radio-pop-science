/**
 * The atom on stage: the nucleus of Z protons and N neutrons, the electron shells around it, the name plate to
 * its right, and the wordless stability display — a stable (or practically stable) nucleus rests, a radioactive
 * one is restless, a fleeting one trembles inside a red halo while the countdown ring runs out. While a fission
 * waits for the fragment choice the atom steps aside — nucleus, shells and plate fade out, and the fission view
 * (`fission-view.ts`) has the stage; the chosen fragment's atom then builds up again. The view only shows a
 * `GameState`; it never changes the game.
 *
 * Units: atom-local units are those of the shell model (K shell at 1.25, the seventh at 6.17). `zoom` maps them
 * to the world so that small atoms are not lost in a frame made for the largest ones: the element's neutral
 * shell count sets the radius of its outer electrons on screen (2 → 4.1 world units for 1 → 7 shells), so
 * adding or removing electrons never rescales the atom. The picture is not to scale anyway (the steps say so).
 */
import { Group, Mesh, Object3D, RingGeometry, Vector3 } from 'three';
import { damp, toOverlay, type ChapterContext } from '@/engine/api';
import { createHalo } from '@/fx';
import { K } from '@/style';
import { Text3D } from '@/text';
import { getNuclide, ionSymbol, MAX_N, MAX_Z, nuclideName, shellCounts } from '@alchemy/sim/core';
import type { NuclideStatus } from '@alchemy/sim/core';
import type { GameState } from '@alchemy/sim/lab';
import { ShellAtom, shellRadius } from '@alchemy/shared/shell-atom';
import { L } from '../labels';
import { statusLine } from './text';

export interface AtomView {
  readonly group: Group;
  readonly anchors: {
    readonly nucleus: Object3D;
    readonly shells: Object3D;
    readonly plate: Object3D;
    /** On the countdown ring, upper right (hotspot `countdown`). */
    readonly countdown: Object3D;
  };
  /** World radius of the nucleus as drawn now (what a shot flies at, what a fission drop grows from). */
  readonly coreRadius: number;
  /** The countdown ring is on (a fleeting nucleus is on stage). */
  readonly counting: boolean;
  /** Nucleus, shells and plate for `state`; `instant` skips every easing (deep links, chapter entry). */
  show(state: GameState, instant: boolean): void;
  /** Draw `count` electrons fewer than the state shown has, until the next `show`: they are falling into the nucleus. */
  lendElectrons(count: number): void;
  /** 1 → 0: the red countdown ring around the nucleus runs out; `null` hides it. */
  setCountdown(fraction: number | null): void;
  update(dt: number, t: number): void;
}

/** Share of the restlessness kept when the user asks for reduced motion. */
const REDUCED_UNREST = 0.25;
/** Local radius the nucleus must stay within: the K shell is at 1.25. */
const NUCLEUS_FIT = 0.95;
/** The valence shell floats up to 0.30 farther out (see `ShellAtom.update`); plus a hero electron's radius. */
const VALENCE_REACH = 0.22 + 0.08 + 0.19;
/** World radius of the outer electrons of a neutral atom with 1 and with 7 shells. */
const ATOM_RADIUS = { one: 2, seven: 4.1 };
/** The name plate: its left edge this far right of the outer electrons; text sizes and heights in world units. */
const PLATE = {
  gap: 0.5,
  symbol: { size: 1.05, y: 0.78 },
  name: { size: 0.42, y: -0.2 },
  badge: { size: 0.36, y: -0.82 },
};
/** The countdown ring: band width as a share of its radius, the arc drawn in `RING_SEGMENTS` pieces. */
const RING_WIDTH = 0.11;
const RING_SEGMENTS = 120;
/** Ring radius (local): this far outside the nucleus, never out to the K-shell electrons. */
const RING_MARGIN = 0.22;
const RING_MAX = 1.1;
/** Where on the outer shell the `shells` anchor sits: upper left, away from the plate. */
const SHELL_ANCHOR_DIR = new Vector3(-Math.SQRT1_2, Math.SQRT1_2, 0);
/** Where on the countdown ring its anchor sits: upper right, toward the plate. */
const RING_ANCHOR_DIR = new Vector3(Math.SQRT1_2, Math.SQRT1_2, 0);

const BADGE: Record<NuclideStatus, string> = {
  stable: L.status.stable,
  longLived: L.status.longLived,
  radioactive: L.status.radioactive,
  fleeting: L.status.fleeting,
  incomplete: L.status.incomplete,
};

/** How restless the nucleus is: 0 at rest, 1 trembling; a radioactive one is restless at 0.35. */
export function unrest(status: NuclideStatus | null): number {
  switch (status) {
    case 'fleeting': return 1;
    case 'radioactive': return 0.35;
    default: return 0; // stable, practically stable (longLived), no data, not in the table
  }
}

/** Scale of the nucleus cluster of local radius `radius`: the K shell always keeps it inside, even ²⁹⁴Og. */
export function nucleusScaleFor(radius: number): number {
  return Math.min(0.3, NUCLEUS_FIT / radius);
}

/** World radius of the outer electrons of a neutral atom with `shells` shells (1…7). */
export function atomRadiusFor(shells: number): number {
  const k = Math.min(Math.max(shells, 1), 7) - 1;
  return ATOM_RADIUS.one + ((ATOM_RADIUS.seven - ATOM_RADIUS.one) * k) / 6;
}

/** Local radius of the outermost electrons (or of the bare nucleus). */
const reachOf = (shells: readonly number[], bare: number): number =>
  shells.length > 0 ? shellRadius(shells.length - 1) + VALENCE_REACH : bare;

export function createAtomView(ctx: ChapterContext): AtomView {
  const group = new Group();
  group.name = 'lab-atom';

  const atom = new ShellAtom(ctx.random.fork('atom'), { maxProtons: MAX_Z, maxNeutrons: MAX_N, nucleusScale: 0.3 });
  const nucleus = atom.nucleus;
  group.add(atom.group);

  // the fleeting nucleus: a red halo and the countdown ring — a bright arc that runs out over a dim track
  const halo = createHalo({ color: 'red', size: 1, intensity: 0 });
  halo.visible = false;
  const band = (): RingGeometry => new RingGeometry(1 - RING_WIDTH, 1, RING_SEGMENTS, 1, Math.PI / 2, Math.PI * 2);
  const arcGeometry = band();
  const trackGeometry = band();
  const arcMaterial = K.glow({ color: 'red', intensity: 1.5, whiten: 0, keepHue: true, falloff: 0 });
  const trackMaterial = K.glow({ color: 'red', intensity: 0.3, whiten: 0, falloff: 0 });
  const arc = new Mesh(arcGeometry, arcMaterial);
  const track = new Mesh(trackGeometry, trackMaterial);
  arc.name = 'countdown';
  arc.visible = track.visible = false;
  atom.group.add(halo, track, arc);

  const shellAnchor = new Object3D();
  shellAnchor.name = 'shells-anchor';
  const ringAnchor = new Object3D();
  ringAnchor.name = 'countdown-anchor';
  atom.group.add(shellAnchor, ringAnchor);

  // the name plate: ion symbol, nuclide name, status badge — on the overlay layer, never blurred
  const plate = new Group();
  plate.name = 'plate';
  const line = (spec: { readonly size: number; readonly y: number }): Text3D => {
    const text = new Text3D('', {
      font: 'display', size: spec.size, color: 'white', anchorX: 'left', anchorY: 'middle', billboard: true, rich: false,
    });
    text.position.set(0, spec.y, 0);
    plate.add(text);
    toOverlay(text);
    return text;
  };
  const symbol = line(PLATE.symbol);
  const name = line(PLATE.name);
  const badge = line(PLATE.badge);
  group.add(plate);

  // targets set by `show`, eased toward in `update` (or taken at once when `show` is instant)
  // (`core`: the nucleus's radius on its shells — sizes the halo and the ring; `presence` of the nucleus and
  // `plate`: 0 while a fission choice is pending — the atom steps aside)
  const target = {
    unrest: 0, alarm: 0, scale: 0.3, core: 0.3, zoom: 1, reach: shellRadius(0), shell: shellRadius(0), presence: 1, plate: 1,
  };
  const now = { ...target };
  let countdown: number | null = null;
  let ringShown = 0;
  let ringFraction = 1;
  /** An instant `show` sets the ring at once on the next update (it knows the new countdown only then). */
  let snapRing = false;
  let shown: GameState | null = null;
  const eye = new Vector3();

  /** The shells of `state` (none while a fission choice is pending), `lent` electrons fewer. */
  const shellsOf = (state: GameState, lent: number): number[] =>
    state.pending !== null ? [] : shellCounts(state.z, Math.max(0, state.electrons - lent));

  return {
    group,
    anchors: { nucleus: nucleus.group, shells: shellAnchor, plate, countdown: ringAnchor },
    get coreRadius() {
      return now.core * now.zoom * now.presence;
    },
    get counting() {
      return countdown !== null;
    },

    show(state, instant) {
      shown = state;
      const shells = shellsOf(state, 0);
      atom.set(state.z, state.n, shells, instant);
      const x = getNuclide(state.z, state.n);
      const status = x?.status ?? null;
      symbol.text = ionSymbol(state.z, state.n, state.electrons);
      name.text = nuclideName(state.z, state.n);
      badge.text = status === null ? L.status.notInTable : BADGE[status];
      badge.color = x ? statusLine(x).tone : 'mist';

      const neutral = shellCounts(state.z, state.z);
      target.scale = nucleusScaleFor(nucleus.radius);
      target.core = target.scale * nucleus.radius;
      target.zoom = atomRadiusFor(neutral.length) / reachOf(neutral, NUCLEUS_FIT);
      target.reach = reachOf(shells, target.core);
      target.shell = shells.length > 0 ? shellRadius(shells.length - 1) : target.core;
      const pending = state.pending !== null;
      target.unrest = pending ? 0 : unrest(status);
      target.alarm = status === 'fleeting' && !pending ? 1 : 0;
      target.presence = target.plate = pending ? 0 : 1;
      if (instant) {
        Object.assign(now, target);
        snapRing = true;
      }
    },

    lendElectrons(count) {
      if (shown) atom.set(shown.z, shown.n, shellsOf(shown, count), false);
    },

    setCountdown(fraction) {
      countdown = fraction === null ? null : Math.min(Math.max(fraction, 0), 1);
    },

    update(dt, t) {
      now.unrest = damp(now.unrest, target.unrest, 5, dt);
      now.alarm = damp(now.alarm, target.alarm, 5, dt);
      now.scale = damp(now.scale, target.scale, 4, dt);
      now.core = damp(now.core, target.core, 6, dt);
      now.zoom = damp(now.zoom, target.zoom, 4, dt);
      now.reach = damp(now.reach, target.reach, 6, dt);
      now.shell = damp(now.shell, target.shell, 6, dt);
      // the fission drop takes the nucleus's place at once; the next atom builds up
      now.presence = target.presence === 0 ? 0 : damp(now.presence, target.presence, 6, dt);
      now.plate = damp(now.plate, target.plate, 8, dt);

      // reduced motion: no shake (STYLE_GUIDE §5) — the halo and the badge still tell the state
      const reduced = ctx.reducedMotion;
      nucleus.jiggle = 1 + 4 * now.unrest * (reduced ? REDUCED_UNREST : 1);
      atom.update(dt, t);
      nucleus.group.scale.setScalar(Math.max(now.scale * now.presence, 1e-4));
      atom.group.scale.setScalar(now.zoom);
      shellAnchor.position.copy(SHELL_ANCHOR_DIR).multiplyScalar(now.shell);
      plate.position.set(now.zoom * now.reach + PLATE.gap, 0, 0);
      symbol.fade = name.fade = badge.fade = now.plate;
      plate.visible = now.plate > 0.01;

      const core = now.core;
      halo.intensity = now.alarm * (1.1 + (reduced ? 0 : 0.6 * Math.sin(t * 9)));
      halo.visible = halo.intensity > 0.02;
      halo.size = 4.2 * core;

      const ringTarget = countdown === null ? 0 : 1;
      ringShown = snapRing ? ringTarget : damp(ringShown, ringTarget, 12, dt);
      snapRing = false;
      if (countdown !== null) ringFraction = countdown;
      const radius = Math.min(core + RING_MARGIN, RING_MAX) * (0.75 + 0.25 * ringShown);
      ringAnchor.position.copy(RING_ANCHOR_DIR).multiplyScalar(radius);
      const ringOn = ringShown > 0.01;
      arc.visible = track.visible = ringOn;
      if (ringOn) {
        const lit = Math.ceil(ringFraction * RING_SEGMENTS);
        arcGeometry.setDrawRange(0, 6 * lit);
        trackGeometry.setDrawRange(6 * lit, 6 * (RING_SEGMENTS - lit));
        arcMaterial.fade = trackMaterial.fade = ringShown;
        ctx.camera.camera.getWorldPosition(eye);
        arc.scale.setScalar(radius);
        track.scale.setScalar(radius);
        arc.lookAt(eye);
        track.lookAt(eye);
      }
    },
  };
}
