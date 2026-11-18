/** Electron-shell filling: Madelung order with the textbook exceptions; cations and anions derived from it. */
import { MAX_Z } from './nuclides';

interface Sub { readonly n: number; readonly l: number; count: number }

/** Subshell capacity is 2(2l + 1). Madelung order: by n + l, then by n. */
const ORDER: readonly (readonly [number, number])[] = [
  [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1], [5, 0], [4, 2], [5, 1], [6, 0],
  [4, 3], [5, 2], [6, 1], [7, 0], [5, 3], [6, 2], [7, 1],
];

/** Final occupations of the subshells that deviate from Madelung, keyed by the neutral atom's Z. */
const EXCEPTIONS: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  24: { '3d': 5, '4s': 1 },
  29: { '3d': 10, '4s': 1 },
  41: { '4d': 4, '5s': 1 },
  42: { '4d': 5, '5s': 1 },
  44: { '4d': 7, '5s': 1 },
  45: { '4d': 8, '5s': 1 },
  46: { '4d': 10, '5s': 0 },
  47: { '4d': 10, '5s': 1 },
  57: { '4f': 0, '5d': 1, '6s': 2 },
  58: { '4f': 1, '5d': 1, '6s': 2 },
  64: { '4f': 7, '5d': 1, '6s': 2 },
  78: { '5d': 9, '6s': 1 },
  79: { '5d': 10, '6s': 1 },
  89: { '5f': 0, '6d': 1, '7s': 2 },
  90: { '5f': 0, '6d': 2, '7s': 2 },
  91: { '5f': 2, '6d': 1, '7s': 2 },
  92: { '5f': 3, '6d': 1, '7s': 2 },
  93: { '5f': 4, '6d': 1, '7s': 2 },
  96: { '5f': 7, '6d': 1, '7s': 2 },
  103: { '5f': 14, '6d': 0, '7s': 2, '7p': 1 },
};

const L_LETTER = 'spdf';
const key = (s: Sub): string => `${s.n}${L_LETTER[s.l]}`;

/** `electrons` is clamped to 0…maxElectrons(z); the Z used for cation derivation. */
export const maxElectrons = (z: number): number => Math.min(z + 1, MAX_Z);

function neutralConfig(electrons: number): Sub[] {
  const subs: Sub[] = [];
  let left = electrons;
  for (const [n, l] of ORDER) {
    if (left <= 0) break;
    const count = Math.min(left, 2 * (2 * l + 1));
    subs.push({ n, l, count });
    left -= count;
  }
  const exc = EXCEPTIONS[electrons];
  if (exc) {
    for (const [k, count] of Object.entries(exc)) {
      const sub = subs.find((s) => key(s) === k);
      if (sub) sub.count = count;
      else {
        const [n, l] = ORDER.find(([nn, ll]) => key({ n: nn, l: ll, count: 0 }) === k)!;
        subs.push({ n, l, count });
      }
    }
  }
  return subs.filter((s) => s.count > 0);
}

/** Electrons per shell, K first; `[]` for no electrons. */
export function shellCounts(z: number, electrons: number): number[] {
  const e = Math.max(0, Math.min(Math.trunc(electrons), maxElectrons(z)));
  const subs = e > z ? neutralConfig(e) : neutralConfig(z);
  if (e < z) {
    // Cation: strip from the highest n, within n from the highest l.
    const order = [...subs].sort((a, b) => b.n - a.n || b.l - a.l);
    let remove = z - e;
    for (const s of order) {
      const take = Math.min(s.count, remove);
      s.count -= take;
      remove -= take;
      if (remove === 0) break;
    }
  }
  const shells: number[] = [];
  for (const s of subs) if (s.count > 0) shells[s.n - 1] = (shells[s.n - 1] ?? 0) + s.count;
  return Array.from(shells, (c) => c ?? 0);
}
