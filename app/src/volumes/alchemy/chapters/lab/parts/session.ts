/**
 * The game session of the lab: the current state, the tools of the step, the countdown of a fleeting nucleus
 * (driven by `update(dt)` from the engine clock), quest completion and saving. No three.js, no DOM: the scene
 * only listens to the events.
 */
import { getNuclide } from '@alchemy/sim/core';
import {
  ALL_TOOLS, EMPTY_PROGRESS, FREE_START, autoDecay, chooseFragment, discover, fireAt, isFleeting, knock, questById,
  reached, recordBest, restoreFree, saveFree, setElectrons, startGame, waitForDecay, waitRefusal,
} from '@alchemy/sim/lab';
import type { GameEvent, GameState, ProjectileId, Progress, Quest, ToolId, Turn } from '@alchemy/sim/lab';
import type { StepId } from '../chapter';

/** Seconds a fleeting nucleus lives before it falls apart by itself. */
export const FLEETING_DELAY_S = 2;

export interface SessionDeps {
  readonly random: () => number;
  readonly load: () => Progress;
  readonly save: (p: Progress) => void;
}

export type SessionEvent =
  | { readonly type: 'reset'; readonly state: GameState }
  | { readonly type: 'turn'; readonly event: GameEvent; readonly before: GameState; readonly after: GameState }
  | { readonly type: 'done'; readonly moves: number; readonly best: number; readonly improved: boolean };

/** The energy a transformation event reports, if it has one. */
function energyOf(event: GameEvent): number | null | undefined {
  switch (event.type) {
    case 'capture': case 'knockOut': case 'decay': return event.q;
    case 'fission': return event.fission.q;
    default: return undefined;
  }
}

export class Session {
  private readonly deps: SessionDeps;
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  private _step: StepId = 'free';
  private _quest: Quest | null = null;
  private _state: GameState;
  private _countdown: number | null = null;
  private _done = false;
  private _lastQ: number | null = null;
  private _progress: Progress;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    try {
      this._progress = deps.load();
    } catch {
      this._progress = EMPTY_PROGRESS;
    }
    this._state = restoreFree(this._progress);
  }

  get step(): StepId { return this._step; }
  get quest(): Quest | null { return this._quest; }
  get state(): GameState { return this._state; }
  get tools(): readonly ToolId[] { return this._quest ? this._quest.tools : ALL_TOOLS; }
  get countdown(): number | null { return this._countdown; }
  get done(): boolean { return this._done; }
  get best(): number | null { return this._quest ? (this._progress.best[this._quest.id] ?? null) : null; }
  get lastQ(): number | null { return this._lastQ; }
  get progress(): Progress { return this._progress; }

  enter(step: StepId): void {
    this._step = step;
    this._quest = questById(step) ?? null;
    this.begin(this._quest ? startGame(this._quest.start.z, this._quest.start.n) : restoreFree(this._progress), false);
  }

  allowed(tool: ToolId): boolean {
    return this.tools.includes(tool);
  }

  fire(projectile: ProjectileId): void {
    if (!this.permit(projectile)) return;
    this.apply(fireAt(this._state, projectile));
  }

  knock(what: 'n' | 'p'): void {
    const tool = what === 'n' ? 'gamma-n' : 'gamma-p';
    if (!this.permit(tool)) return;
    this.apply(knock(this._state, what));
  }

  wait(): void {
    if (!this.permit('wait')) return;
    if (waitRefusal(this._state) !== null) {
      this.apply(waitForDecay(this._state, 0, 0)); // refuses, and no dice are thrown
      return;
    }
    const uTime = this.deps.random();
    const uBranch = this.deps.random();
    this.apply(waitForDecay(this._state, uTime, uBranch));
  }

  pickFragment(which: 'heavy' | 'light'): void {
    this.apply(chooseFragment(this._state, which));
  }

  setElectrons(count: number): void {
    this.apply(setElectrons(this._state, count));
  }

  neutralise(): void {
    this.apply(setElectrons(this._state, this._state.z));
  }

  restart(): void {
    this.begin(this._quest ? startGame(this._quest.start.z, this._quest.start.n) : startGame(FREE_START.z, FREE_START.n), true);
  }

  /** Free lab only, and only a nuclide that exists in nature. */
  startFrom(z: number, n: number): boolean {
    if (this._quest) return false;
    const abundance = getNuclide(z, n)?.abundance;
    if (abundance === undefined || abundance === null) return false;
    this.begin(startGame(z, n), true);
    return true;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0 || this._countdown === null) return;
    this._countdown -= dt;
    if (this._countdown > 0) return;
    const uTime = this.deps.random();
    const uBranch = this.deps.random();
    const before = this._state;
    this.apply(autoDecay(before, uTime, uBranch));
    if (this._state === before) this._countdown = null; // cannot decay: do not retry every frame
  }

  on(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** A tool the step does not offer is refused and changes nothing. */
  private permit(tool: ToolId): boolean {
    if (this.allowed(tool)) return true;
    const state = this._state;
    this.emit({ type: 'turn', event: { type: 'refused', tool, reason: 'noProduct' }, before: state, after: state });
    return false;
  }

  /** Starts a run from `state`: forgets the countdown, the goal and the energy, and tells the scene. */
  private begin(state: GameState, remember: boolean): void {
    this._state = state;
    this._done = false;
    this._lastQ = null;
    this._countdown = null;
    this.syncCountdown(null);
    let next = discover(this._progress, state.z, state.n);
    if (remember && !this._quest) next = saveFree(next, state);
    this.store(next);
    this.emit({ type: 'reset', state });
  }

  private apply(turn: Turn): void {
    const before = this._state;
    const after = turn.state;
    this._state = after;
    const q = energyOf(turn.event);
    if (q !== undefined) this._lastQ = q;
    this.syncCountdown(before);

    let next = this._progress;
    const moved = before.z !== after.z || before.n !== after.n;
    if (moved) next = discover(next, after.z, after.n);
    if (!this._quest && (moved || before.electrons !== after.electrons)) next = saveFree(next, after);
    this.store(next);
    this.emit({ type: 'turn', event: turn.event, before, after });
    this.checkGoal();
  }

  private checkGoal(): void {
    if (this._done || !this._quest || !reached(this._quest.goal, this._state)) return;
    this._done = true;
    const moves = this._state.moves;
    const next = recordBest(this._progress, this._quest.id, moves);
    const improved = next !== this._progress;
    this.store(next);
    this.emit({ type: 'done', moves, best: this._progress.best[this._quest.id] ?? moves, improved });
  }

  /** Runs only while a fleeting nucleus can really fall apart; a changed nuclide restarts the full delay. */
  private syncCountdown(before: GameState | null): void {
    const state = this._state;
    if (!isFleeting(state) || waitRefusal(state) !== null) {
      this._countdown = null;
    } else if (this._countdown === null || before === null || before.z !== state.z || before.n !== state.n) {
      this._countdown = FLEETING_DELAY_S;
    }
  }

  private store(next: Progress): void {
    if (next === this._progress) return;
    this._progress = next;
    try {
      this.deps.save(next);
    } catch {
      // saving is best effort: the game goes on
    }
  }

  private emit(event: SessionEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
