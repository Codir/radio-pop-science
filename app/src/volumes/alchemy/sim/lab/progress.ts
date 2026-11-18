/**
 * What the game remembers between visits: found nuclides, best move counts, the free-lab atom and a visit counter.
 * Everything here is pure; reading and writing the browser storage is the caller's job (see PROGRESS_KEY).
 */
import { hasNuclide, maxElectrons, nuclideKey } from '../core';
import { FREE_START, QUEST_IDS } from './quests';
import type { QuestId } from './quests';
import { startGame } from './game';
import type { GameState } from './game';

export const PROGRESS_KEY = 'alchemy:v1';

export interface FreeSave {
  readonly z: number; readonly n: number; readonly electrons: number;
  readonly elapsedSeconds: number; readonly moves: number;
}

export interface Progress {
  /** `nuclideKey` strings, in the order they were found. */
  readonly discovered: readonly string[];
  /** The smallest number of moves per quest. */
  readonly best: Readonly<Partial<Record<QuestId, number>>>;
  readonly free: FreeSave | null;
  /** Visit counter, a seed for variety. */
  readonly rolls: number;
}

export const EMPTY_PROGRESS: Progress = { discovered: [], best: {}, free: null, rolls: 0 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Keys of nuclides that exist, once each, in the original order. */
function parseDiscovered(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) if (typeof item === 'string' && knownKey(item)) seen.add(item);
  return [...seen];
}

function knownKey(key: string): boolean {
  const match = /^(\d+)-(\d+)$/.exec(key);
  if (!match) return false;
  const z = Number(match[1]), n = Number(match[2]);
  return hasNuclide(z, n) && nuclideKey(z, n) === key;
}

function parseBest(raw: unknown): Partial<Record<QuestId, number>> {
  const best: Partial<Record<QuestId, number>> = {};
  if (!isRecord(raw)) return best;
  for (const id of QUEST_IDS) {
    const value = Object.hasOwn(raw, id) ? raw[id] : undefined;
    if (isCount(value) && value > 0) best[id] = value;
  }
  return best;
}

function parseFree(raw: unknown): FreeSave | null {
  if (!isRecord(raw)) return null;
  const { z, n, electrons, elapsedSeconds, moves } = raw;
  if (!isCount(z) || !isCount(n) || !hasNuclide(z, n)) return null;
  const cap = maxElectrons(z);
  const kept = typeof electrons === 'number' && !Number.isNaN(electrons)
    ? Math.min(cap, Math.max(0, Math.round(electrons)))
    : Math.min(cap, z);
  return {
    z, n, electrons: kept,
    elapsedSeconds: typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0 ? elapsedSeconds : 0,
    moves: isCount(moves) ? moves : 0,
  };
}

/**
 * Parsing rules. The text comes from storage and is untrusted:
 * - anything that is not a plain JSON object (null, bad JSON, array, number...) gives EMPTY_PROGRESS;
 * - every field is validated on its own; a bad field falls back to its empty value and the good ones survive;
 * - `discovered`: only strings that are keys of existing nuclides, de-duplicated, original order kept;
 * - `best`: only known quest ids with a positive integer value;
 * - `free`: kept only if (z, n) is an existing nuclide; its numbers are sanitised, not trusted: `electrons` is
 *   clamped to 0...maxElectrons(z), `elapsedSeconds` must be finite and >= 0 (else 0), `moves` a finite
 *   non-negative integer (else 0);
 * - `rolls`: a finite non-negative integer, else 0;
 * - every number must be finite: JSON.parse('1e999') is Infinity, so nothing is taken on trust.
 * Unknown fields are dropped. This function never throws.
 */
export function parseProgress(text: string | null): Progress {
  if (text === null) return EMPTY_PROGRESS;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (!isRecord(raw)) return EMPTY_PROGRESS;
  return {
    discovered: parseDiscovered(raw.discovered),
    best: parseBest(raw.best),
    free: parseFree(raw.free),
    rolls: isCount(raw.rolls) ? raw.rolls : 0,
  };
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify(p);
}

/** The same object when the nuclide is already known (or does not exist). */
export function discover(p: Progress, z: number, n: number): Progress {
  if (!hasNuclide(z, n)) return p;
  const key = nuclideKey(z, n);
  if (p.discovered.includes(key)) return p;
  return { ...p, discovered: [...p.discovered, key] };
}

/** Keeps the smaller count; the same object when nothing improves. */
export function recordBest(p: Progress, quest: QuestId, moves: number): Progress {
  if (!isCount(moves) || moves < 1) return p;
  const old = p.best[quest];
  if (old !== undefined && old <= moves) return p;
  return { ...p, best: { ...p.best, [quest]: moves } };
}

/** The atom waiting for a fragment choice is not saved: the previous save stays. */
export function saveFree(p: Progress, state: GameState): Progress {
  if (state.pending) return p;
  const free: FreeSave = {
    z: state.z, n: state.n, electrons: state.electrons, elapsedSeconds: state.elapsedSeconds, moves: state.moves,
  };
  return { ...p, free };
}

/** A fresh state around the saved nuclide: the history starts over, nothing is pending. */
export function restoreFree(p: Progress): GameState {
  if (!p.free) return startGame(FREE_START.z, FREE_START.n);
  const { z, n, electrons, elapsedSeconds, moves } = p.free;
  return { ...startGame(z, n), electrons, elapsedSeconds, moves };
}

export function nextVisit(p: Progress): Progress {
  return { ...p, rolls: p.rolls + 1 };
}

export function countDiscovered(p: Progress): { readonly elements: number; readonly nuclides: number } {
  const elements = new Set(p.discovered.map((key) => key.split('-')[0]));
  return { elements: elements.size, nuclides: p.discovered.length };
}
