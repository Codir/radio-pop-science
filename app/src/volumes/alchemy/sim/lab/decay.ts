/**
 * Decay rules: where each decay code moves a nuclide on the chart, which particles fly out, which branches
 * are playable with a given number of shell electrons, and the energy balance (Q) of a decay.
 */
import { getNuclide, HYDROGEN_MASS_EXCESS, NEUTRON_MASS_EXCESS } from '../core';
import type { Branch, DecayCode, Nuclide, NuclideRef } from '../core';

export type Particle = 'e-' | 'e+' | 'alpha' | 'p' | 'n';

type ShiftedCode = Exclude<DecayCode, 'sf'>;

/** (dZ, dN) of the daughter relative to the parent. */
export const DECAY_SHIFT: Readonly<Record<ShiftedCode, readonly [dz: number, dn: number]>> = {
  'b-': [1, -1], 'b+': [-1, 1], 'ec': [-1, 1], 'ec/b+': [-1, 1],
  'a': [-2, -2], 'p': [-1, 0], '2p': [-2, 0], 'n': [0, -1], '2n': [0, -2],
  '2b-': [2, -2], '2b+': [-2, 2],
  'b-n': [1, -2], 'b-2n': [1, -3], 'b-3n': [1, -4], 'b-4n': [1, -5],
  'b-p': [0, -1], 'b-a': [-1, -3],
  'b+p': [-2, 1], 'b+2p': [-3, 1], 'b+a': [-3, -1],
};

/** How a branch is actually played: 'ec/b+' becomes 'ec' or 'b+'. */
export type PlayedMode = Exclude<DecayCode, 'ec/b+'>;

export const EMITS: Readonly<Record<Exclude<PlayedMode, 'sf'>, readonly Particle[]>> = {
  'b-': ['e-'], 'b+': ['e+'], 'ec': [],
  'a': ['alpha'], 'p': ['p'], '2p': ['p', 'p'], 'n': ['n'], '2n': ['n', 'n'],
  '2b-': ['e-', 'e-'], '2b+': [],
  'b-n': ['e-', 'n'], 'b-2n': ['e-', 'n', 'n'], 'b-3n': ['e-', 'n', 'n', 'n'], 'b-4n': ['e-', 'n', 'n', 'n', 'n'],
  'b-p': ['e-', 'p'], 'b-a': ['e-', 'alpha'],
  'b+p': ['e+', 'p'], 'b+2p': ['e+', 'p', 'p'], 'b+a': ['e+', 'alpha'],
};

/** Shell electrons a mode consumes. */
export const ELECTRONS_USED: Readonly<Partial<Record<PlayedMode, number>>> = { 'ec': 1, '2b+': 2 };

/** Below this Q (keV) a positron cannot be made, so 'ec/b+' is played as electron capture. */
const POSITRON_THRESHOLD_KEV = 1022;

export function daughterOf(x: NuclideRef, code: ShiftedCode): NuclideRef {
  const [dz, dn] = DECAY_SHIFT[code];
  return { z: x.z + dz, n: x.n + dn };
}

function emittedMass(particle: Particle): number | null {
  switch (particle) {
    case 'n': return NEUTRON_MASS_EXCESS;
    case 'p': return HYDROGEN_MASS_EXCESS;
    case 'alpha': return getNuclide(2, 2)?.massExcess ?? null;
    default: return 0; // atomic masses already include the electrons
  }
}

/** Energy release in keV; null when any mass is unknown. */
export function decayQ(x: Nuclide, code: ShiftedCode): number | null {
  const daughter = daughterOf(x, code);
  const d = getNuclide(daughter.z, daughter.n);
  if (x.massExcess === null || !d || d.massExcess === null) return null;
  let q = x.massExcess - d.massExcess;
  const emitted = code === 'ec/b+' ? [] : EMITS[code];
  for (const particle of emitted) {
    const m = emittedMass(particle);
    if (m === null) return null;
    q -= m;
  }
  return q;
}

/** The mode a branch is played as with this many shell electrons; null when it is impossible right now. */
export function playedMode(x: Nuclide, code: DecayCode, electrons: number): PlayedMode | null {
  if (code === 'ec/b+') {
    const q = decayQ(x, code);
    if (q === null || q > POSITRON_THRESHOLD_KEV) return 'b+';
    return electrons >= 1 ? 'ec' : null;
  }
  const need = ELECTRONS_USED[code] ?? 0;
  return electrons >= need ? code : null;
}

/** Branches playable now, shares renormalised to 1. */
export function availableBranches(x: Nuclide, electrons: number): readonly Branch[] {
  const ok = x.branches.filter((b) => playedMode(x, b.code, electrons) !== null);
  const total = ok.reduce((s, b) => s + b.share, 0);
  if (total <= 0) return [];
  return ok.map((b) => ({ code: b.code, share: b.share / total }));
}

/** u in [0, 1). */
export function pickBranch(branches: readonly Branch[], u: number): Branch {
  let acc = 0;
  for (const b of branches) {
    acc += b.share;
    if (u < acc) return b;
  }
  return branches[branches.length - 1]!;
}

/** Seconds until the decay; 0 for unknown or stable. */
export function sampleLifetime(halfLife: number | 'stable' | null, u: number): number {
  if (halfLife === null || halfLife === 'stable') return 0;
  return (-Math.log(1 - u) * halfLife) / Math.LN2;
}
