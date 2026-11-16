/**
 * «Згадайте…» links of the path format (docs/PATH_FORMAT.md, field «Згадати»): a step points to an earlier
 * step; following the link remembers where the reader was, and «Повернутися» brings them back to that step.
 * One return point at a time (a new link replaces it); it ends when used, or when the reader comes back to the
 * origin by any other way. Pure model over `Nav` — the step panel draws the link and the way back.
 */
import { samePosition, type Position } from '@/engine/api';

/** The part of `Nav` the trail uses. */
export interface RecallNav {
  readonly position: Position | null;
  open(address: string): Promise<boolean>;
}

export const address = (p: Position): string => `${p.volumeId}/${p.chapterId}/${p.stepId}`;

export class RecallTrail {
  private origin: Position | null = null;
  private readonly listeners = new Set<(origin: Position | null) => void>();

  constructor(private readonly nav: RecallNav) {}

  /** Where «Повернутися» leads (null: no link was followed). */
  get returnTo(): Position | null {
    return this.origin;
  }

  onChange(fn: (origin: Position | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Follow a «Згадайте» link to a full step address; remembers the step on screen as the way back. */
  async follow(target: string): Promise<boolean> {
    const here = this.nav.position;
    if (!here) return false;
    const origin = this.origin ?? here; // a link followed from a recalled step keeps the first way back
    this.set(origin);
    const ok = await this.nav.open(target);
    if (!ok && this.origin === origin) this.set(null);
    return ok;
  }

  /** Back to where the first link was followed from. */
  back(): Promise<boolean> {
    const o = this.origin;
    if (!o) return Promise.resolve(false);
    this.set(null);
    return this.nav.open(address(o));
  }

  /** Call on every step change: arriving at the origin by any other way ends the trail. */
  onStep(pos: Position | null): void {
    if (this.origin && samePosition(pos, this.origin)) this.set(null);
  }

  private set(origin: Position | null): void {
    if (origin === this.origin) return;
    this.origin = origin;
    for (const fn of this.listeners) fn(origin);
  }
}
