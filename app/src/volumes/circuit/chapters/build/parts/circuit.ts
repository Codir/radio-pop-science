/**
 * The practicum's circuit as topology — pure, no three.js (unit-tested in `__tests__/circuit.test.ts`).
 *
 * Six clamps: the battery's «−» and «+», the switch's two, the lamp's two. Three wires, each with two ends; an end
 * sits in a clamp or lies loose, and a clamp takes up to two ends. Copper touches copper only where an end's bare
 * copper is in a clamp (`contact`: false = clamped with its sheath, `find-fault` 2) and along a wire whose core
 * is whole (`whole`: false = broken under the sheath, `find-fault` 3). The closed switch joins its two clamps.
 *
 * From that alone: `short` when the poles are joined by copper (no filament on the way — the lamp gets nothing),
 * `lit` when the lamp's two clamps are joined one to each pole, `open` otherwise. Nothing else decides whether the
 * lamp shines: a wrong but harmless wiring simply stays dark.
 */

export const CLAMP_IDS = ['minus', 'plus', 'swIn', 'swOut', 'lampA', 'lampB'] as const;
export type ClampId = (typeof CLAMP_IDS)[number];
export const WIRE_KEYS = ['a', 'b', 'c'] as const;
export type WireKey = (typeof WIRE_KEYS)[number];

/** How many ends one clamp takes. */
export const CLAMP_CAPACITY = 2;

export interface EndState {
  /** The clamp this end sits in, or null (loose: on the board or in the hand). */
  clamp: ClampId | null;
  /** The end's bare copper touches the clamp's metal (false: the sheath is clamped instead). */
  contact: boolean;
}

export interface WireState {
  ends: readonly [EndState, EndState];
  /** The copper core runs whole from end to end. */
  whole: boolean;
}

export interface CircuitState {
  wires: Readonly<Record<WireKey, WireState>>;
  switchClosed: boolean;
}

export type Verdict = 'lit' | 'open' | 'short';

/** Groups of clamps joined by copper (union–find over the six). */
export function nets(state: CircuitState): Record<ClampId, number> {
  const parent = CLAMP_IDS.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const join = (a: ClampId, b: ClampId): void => {
    parent[find(CLAMP_IDS.indexOf(a))] = find(CLAMP_IDS.indexOf(b));
  };
  for (const key of WIRE_KEYS) {
    const w = state.wires[key];
    const [e0, e1] = w.ends;
    if (w.whole && e0.clamp && e1.clamp && e0.contact && e1.contact) join(e0.clamp, e1.clamp);
  }
  if (state.switchClosed) join('swIn', 'swOut');
  return Object.fromEntries(CLAMP_IDS.map((c, i) => [c, find(i)])) as Record<ClampId, number>;
}

export function verdict(state: CircuitState): Verdict {
  const n = nets(state);
  if (n.minus === n.plus) return 'short';
  const lamp = [n.lampA, n.lampB];
  return lamp.includes(n.minus) && lamp.includes(n.plus) ? 'lit' : 'open';
}

/**
 * The goal of `first-light`: one closed loop through battery, switch and lamp — the lamp lights with the switch
 * closed and goes dark with it open (so the switch is on the only road, every part in the loop once), never a short.
 */
export function switchControls(state: CircuitState): boolean {
  return (
    verdict({ ...state, switchClosed: true }) === 'lit' &&
    verdict({ ...state, switchClosed: false }) === 'open'
  );
}

/** How many ends sit in each clamp. */
export function occupancy(state: CircuitState): Record<ClampId, number> {
  const count = Object.fromEntries(CLAMP_IDS.map((c) => [c, 0])) as Record<ClampId, number>;
  for (const key of WIRE_KEYS) for (const e of state.wires[key].ends) if (e.clamp) count[e.clamp]++;
  return count;
}

/** The stand as built (every chapter's): plus → switch → lamp → minus, everything whole, switch closed. */
export const HOME: Readonly<Record<WireKey, readonly [ClampId, ClampId]>> = {
  a: ['plus', 'swIn'],
  b: ['swOut', 'lampB'],
  c: ['minus', 'lampA'],
};

export function homeState(switchClosed = true): CircuitState {
  const end = (clamp: ClampId): EndState => ({ clamp, contact: true });
  return {
    switchClosed,
    wires: {
      a: { ends: [end(HOME.a[0]), end(HOME.a[1])], whole: true },
      b: { ends: [end(HOME.b[0]), end(HOME.b[1])], whole: true },
      c: { ends: [end(HOME.c[0]), end(HOME.c[1])], whole: true },
    },
  };
}
