/** Projectiles, nucleon knock-out by a gamma quantum, fission, and the energy balance of each. */
import { getNuclide, hasNuclide, HYDROGEN_MASS_EXCESS, NEUTRON_MASS_EXCESS } from '../core';
import type { NuclideRef } from '../core';

export type ProjectileId = 'n' | 'p' | 'd' | 'he3' | 'alpha' | 'c12' | 'o16' | 'ca48';
export interface Projectile extends NuclideRef { readonly id: ProjectileId; readonly symbol: string }

export const PROJECTILES: readonly Projectile[] = [
  { id: 'n', z: 0, n: 1, symbol: 'n' },
  { id: 'p', z: 1, n: 0, symbol: 'p' },
  { id: 'd', z: 1, n: 1, symbol: '²H' },
  { id: 'he3', z: 2, n: 1, symbol: '³He' },
  { id: 'alpha', z: 2, n: 2, symbol: 'α' },
  { id: 'c12', z: 6, n: 6, symbol: '¹²C' },
  { id: 'o16', z: 8, n: 8, symbol: '¹⁶O' },
  { id: 'ca48', z: 20, n: 28, symbol: '⁴⁸Ca' },
];

export interface Fission {
  readonly heavy: NuclideRef;
  readonly light: NuclideRef;
  readonly neutrons: number;
  /** keV; null when a mass is unknown. */
  readonly q: number | null;
  /** True for the textbook splits of the four fissile nuclides. */
  readonly preset: boolean;
}

export type FireResult =
  | { readonly kind: 'capture'; readonly product: NuclideRef; readonly evaporated: number; readonly q: number | null }
  | { readonly kind: 'pp'; readonly product: NuclideRef; readonly q: number }
  | { readonly kind: 'fission'; readonly fission: Fission }
  | { readonly kind: 'bounce' };

export const MAX_EVAPORATED = 4;

const FISSILE: ReadonlyMap<string, { heavy: NuclideRef; light: NuclideRef; neutrons: number }> = new Map([
  ['92-141', { heavy: { z: 54, n: 83 }, light: { z: 38, n: 56 }, neutrons: 3 }],      // ²³³U → ¹³⁷Xe + ⁹⁴Sr
  ['92-143', { heavy: { z: 56, n: 85 }, light: { z: 36, n: 56 }, neutrons: 3 }],      // ²³⁵U → ¹⁴¹Ba + ⁹²Kr
  ['94-145', { heavy: { z: 56, n: 88 }, light: { z: 38, n: 56 }, neutrons: 2 }],      // ²³⁹Pu → ¹⁴⁴Ba + ⁹⁴Sr
  ['94-147', { heavy: { z: 56, n: 88 }, light: { z: 38, n: 57 }, neutrons: 3 }],      // ²⁴¹Pu → ¹⁴⁴Ba + ⁹⁵Sr
]);

function massExcessOf(x: NuclideRef): number | null {
  return getNuclide(x.z, x.n)?.massExcess ?? null;
}

/** Mass excess of a projectile (keV): a free neutron, or the atom for everything else. */
function projectileMass(p: Projectile): number | null {
  return p.id === 'n' ? NEUTRON_MASS_EXCESS : massExcessOf(p);
}

function fissionQ(parentMass: number | null, heavy: NuclideRef, light: NuclideRef, neutrons: number, extra: number): number | null {
  const mh = massExcessOf(heavy), ml = massExcessOf(light);
  if (parentMass === null || mh === null || ml === null) return null;
  return parentMass + extra - mh - ml - neutrons * NEUTRON_MASS_EXCESS;
}

export function fire(target: NuclideRef, projectile: ProjectileId): FireResult {
  const proj = PROJECTILES.find((p) => p.id === projectile)!;
  const targetMass = massExcessOf(target);

  if (projectile === 'p' && target.z === 1 && target.n === 0) {
    return { kind: 'pp', product: { z: 1, n: 1 }, q: 2 * HYDROGEN_MASS_EXCESS - massExcessOf({ z: 1, n: 1 })! };
  }

  if (projectile === 'n') {
    const split = FISSILE.get(`${target.z}-${target.n}`);
    if (split) {
      const q = fissionQ(targetMass, split.heavy, split.light, split.neutrons, NEUTRON_MASS_EXCESS);
      return { kind: 'fission', fission: { ...split, q, preset: true } };
    }
  }

  for (let k = 0; k <= MAX_EVAPORATED; k++) {
    const z = target.z + proj.z, n = target.n + proj.n - k;
    if (n < 0 || !hasNuclide(z, n)) continue;
    // A shot that changes nothing is not a transformation: a neutron at the neutron drip line finds the target
    // itself (k = 1) first, and that is a bounce. The search stops here.
    if (z === target.z && n === target.n) return { kind: 'bounce' };
    const product = { z, n };
    const pm = projectileMass(proj), prodMass = massExcessOf(product);
    const q = targetMass === null || pm === null || prodMass === null ? null : targetMass + pm - prodMass - k * NEUTRON_MASS_EXCESS;
    return { kind: 'capture', product, evaporated: k, q };
  }
  return { kind: 'bounce' };
}

/** Gamma knock-out of one nucleon. q (keV) is negative: the energy the quantum must bring. */
export function knockOut(target: NuclideRef, what: 'n' | 'p'): { readonly product: NuclideRef; readonly q: number | null } | null {
  const z = what === 'p' ? target.z - 1 : target.z, n = what === 'n' ? target.n - 1 : target.n;
  if (z < 1 || n < 0 || !hasNuclide(z, n)) return null;
  const product = { z, n };
  const tm = massExcessOf(target), pm = massExcessOf(product);
  const out = what === 'n' ? NEUTRON_MASS_EXCESS : HYDROGEN_MASS_EXCESS;
  return { product, q: tm === null || pm === null ? null : tm - pm - out };
}

const N_SEARCH = [0, -1, 1, -2, 2, -3, 3, -4, 4] as const;

function nearest(z: number, n: number): NuclideRef | null {
  if (z < 1) return null;
  for (const d of N_SEARCH) if (n + d >= 0 && hasNuclide(z, n + d)) return { z, n: n + d };
  return null;
}

/** Illustrative asymmetric split, one formula for all nuclei; null when no fragment is found. */
export function spontaneousFission(parent: NuclideRef): Fission | null {
  const a = parent.z + parent.n;
  const ap = a - 2;
  const aHeavy = ap - 140 <= 140 ? 140 : ap - 140;
  const zHeavy = Math.round((parent.z * aHeavy) / ap);
  const zLight = parent.z - zHeavy;
  const heavy = nearest(zHeavy, aHeavy - zHeavy);
  const light = nearest(zLight, ap - aHeavy - zLight);
  if (!heavy || !light) return null;
  const neutrons = a - (heavy.z + heavy.n) - (light.z + light.n);
  return { heavy, light, neutrons, q: fissionQ(massExcessOf(parent), heavy, light, neutrons, 0), preset: false };
}
