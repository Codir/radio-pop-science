/**
 * The immutable game state and the tools that move it. Every function returns a new state (or the very same
 * object when nothing changed) together with the event that explains what happened. Dice come in as arguments.
 */
import { getNuclide, hasNuclide, maxElectrons } from '../core';
import type { DecayCode, Nuclide, NuclideRef } from '../core';
import { availableBranches, daughterOf, decayQ, ELECTRONS_USED, pickBranch, playedMode, sampleLifetime } from './decay';
import type { PlayedMode } from './decay';
import { fire, knockOut, spontaneousFission } from './reactions';
import type { Fission, ProjectileId } from './reactions';

export type ToolId = ProjectileId | 'gamma-n' | 'gamma-p' | 'wait';
export type Refusal = 'stable' | 'notObserved' | 'noData' | 'needsElectron' | 'noProduct' | 'pending';

export type GameEvent =
  | { readonly type: 'capture'; readonly projectile: ProjectileId; readonly from: NuclideRef; readonly to: NuclideRef;
      readonly evaporated: number; readonly pp: boolean; readonly q: number | null }
  | { readonly type: 'bounce'; readonly projectile: ProjectileId }
  | { readonly type: 'knockOut'; readonly what: 'n' | 'p'; readonly from: NuclideRef; readonly to: NuclideRef; readonly q: number | null }
  | { readonly type: 'decay'; readonly mode: Exclude<PlayedMode, 'sf'>; readonly from: NuclideRef; readonly to: NuclideRef;
      readonly seconds: number; readonly q: number | null; readonly auto: boolean }
  | { readonly type: 'fission'; readonly from: NuclideRef; readonly fission: Fission; readonly induced: boolean;
      readonly seconds: number; readonly auto: boolean }
  | { readonly type: 'fragment'; readonly to: NuclideRef }
  | { readonly type: 'electrons'; readonly from: number; readonly to: number }
  | { readonly type: 'refused'; readonly tool: ToolId | 'fragment' | 'electrons'; readonly reason: Refusal };

export interface GameState {
  readonly z: number; readonly n: number; readonly electrons: number;
  readonly elapsedSeconds: number; readonly moves: number;
  /** Every nuclide the atom has been, the starting one included; the current one is last. */
  readonly history: readonly NuclideRef[];
  /** Waiting for the player to pick a fission fragment. */
  readonly pending: Fission | null;
  /** This run has seen a fission. */
  readonly fissioned: boolean;
  /** Electrons that flew off during the latest action. */
  readonly shed: number;
}

export interface Turn { readonly state: GameState; readonly event: GameEvent }

type ShiftedCode = Exclude<DecayCode, 'sf'>;

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

export function startGame(z: number, n: number): GameState {
  return {
    z, n, electrons: clamp(z, 0, maxElectrons(z)), elapsedSeconds: 0, moves: 0,
    history: [{ z, n }], pending: null, fissioned: false, shed: 0,
  };
}

const refuse = (state: GameState, tool: ToolId | 'fragment' | 'electrons', reason: Refusal): Turn =>
  ({ state, event: { type: 'refused', tool, reason } });

/** Moves the atom to a new nuclide, clipping the electrons to what the new element can hold. */
function moveTo(state: GameState, to: NuclideRef, electrons: number, extra: Partial<GameState>): GameState {
  const kept = clamp(electrons, 0, maxElectrons(to.z));
  return {
    ...state, z: to.z, n: to.n, electrons: kept, shed: Math.max(0, electrons - kept),
    history: [...state.history, { z: to.z, n: to.n }], ...extra,
  };
}

export function fireAt(state: GameState, projectile: ProjectileId): Turn {
  if (state.pending) return refuse(state, projectile, 'pending');
  const from = { z: state.z, n: state.n };
  const result = fire(from, projectile);
  switch (result.kind) {
    case 'bounce':
      return { state, event: { type: 'bounce', projectile } };
    case 'fission':
      return {
        state: { ...state, moves: state.moves + 1, pending: result.fission, fissioned: true, shed: 0 },
        event: { type: 'fission', from, fission: result.fission, induced: true, seconds: 0, auto: false },
      };
    case 'pp':
    case 'capture': {
      const pp = result.kind === 'pp';
      return {
        state: moveTo(state, result.product, state.electrons, { moves: state.moves + 1 }),
        event: {
          type: 'capture', projectile, from, to: result.product,
          evaporated: pp ? 0 : result.evaporated, pp, q: result.q,
        },
      };
    }
  }
}

export function knock(state: GameState, what: 'n' | 'p'): Turn {
  const tool = what === 'n' ? 'gamma-n' : 'gamma-p';
  if (state.pending) return refuse(state, tool, 'pending');
  const from = { z: state.z, n: state.n };
  const out = knockOut(from, what);
  if (!out) return refuse(state, tool, 'noProduct');
  return {
    state: moveTo(state, out.product, state.electrons, { moves: state.moves + 1 }),
    event: { type: 'knockOut', what, from, to: out.product, q: out.q },
  };
}

function refusalFor(x: Nuclide | undefined): Refusal {
  if (!x) return 'noData';
  if (x.status === 'stable') return 'stable';
  if (x.branches.length > 0) return 'needsElectron';
  return x.status === 'longLived' ? 'notObserved' : 'noData';
}

/** Why "wait" does nothing right now; null when it works. */
export function waitRefusal(state: GameState): Refusal | null {
  if (state.pending) return 'pending';
  const x = getNuclide(state.z, state.n);
  if (x && availableBranches(x, state.electrons).length > 0) return null;
  return refusalFor(x);
}

function decayStep(state: GameState, uTime: number, uBranch: number, auto: boolean): Turn {
  if (state.pending) return refuse(state, 'wait', 'pending');
  const x = getNuclide(state.z, state.n);
  const branches = x ? availableBranches(x, state.electrons) : [];
  if (!x || branches.length === 0) return refuse(state, 'wait', refusalFor(x));

  const branch = pickBranch(branches, uBranch);
  const mode = playedMode(x, branch.code, state.electrons)!;
  const from = { z: state.z, n: state.n };
  const seconds = Math.min(sampleLifetime(x.halfLife, uTime), Number.MAX_VALUE);
  const clock = {
    elapsedSeconds: Math.min(state.elapsedSeconds + seconds, Number.MAX_VALUE),
    moves: auto ? state.moves : state.moves + 1,
  };

  if (mode === 'sf') {
    const fission = spontaneousFission(from);
    if (!fission) return refuse(state, 'wait', 'noData');
    return {
      state: { ...state, ...clock, pending: fission, fissioned: true, shed: 0 },
      event: { type: 'fission', from, fission, induced: false, seconds, auto },
    };
  }

  const to = daughterOf(from, branch.code as ShiftedCode);
  if (!hasNuclide(to.z, to.n)) return refuse(state, 'wait', 'noData');
  return {
    state: moveTo(state, to, state.electrons - (ELECTRONS_USED[mode] ?? 0), clock),
    event: { type: 'decay', mode, from, to, seconds, q: decayQ(x, branch.code as ShiftedCode), auto },
  };
}

export function waitForDecay(state: GameState, uTime: number, uBranch: number): Turn {
  return decayStep(state, uTime, uBranch, false);
}

/** The same as waiting, but it is not a move: the fleeting nucleus fell apart on its own. */
export function autoDecay(state: GameState, uTime: number, uBranch: number): Turn {
  return decayStep(state, uTime, uBranch, true);
}

export function chooseFragment(state: GameState, which: 'heavy' | 'light'): Turn {
  if (!state.pending) return refuse(state, 'fragment', 'noProduct');
  const to = which === 'heavy' ? state.pending.heavy : state.pending.light;
  const next = moveTo(state, to, to.z, { pending: null });
  return { state: next, event: { type: 'fragment', to: { z: to.z, n: to.n } } };
}

export function setElectrons(state: GameState, count: number): Turn {
  if (state.pending) return refuse(state, 'electrons', 'pending');
  const to = clamp(Math.round(count), 0, maxElectrons(state.z));
  if (to === state.electrons) return { state, event: { type: 'electrons', from: to, to } };
  return { state: { ...state, electrons: to, shed: 0 }, event: { type: 'electrons', from: state.electrons, to } };
}

/** A fleeting nucleus falls apart by itself, unless a fission choice is waiting. */
export function isFleeting(state: GameState): boolean {
  return !state.pending && getNuclide(state.z, state.n)?.status === 'fleeting';
}
