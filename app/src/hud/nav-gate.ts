/**
 * The step navigator held back until the reader has done the step's thing (owner, DECISIONS §60 p: «на кроці 1
 * спочатку тримай прихованою панель із перемиканням кроків … коли світло увімкнеться, панель має плавно
 * з'явитись»). A step declares `stepUi … nav: { hiddenUntil: () => boolean | 'goal' }`; the navigator (bottom bar
 * on a desk, its row in the phone's sheet) stays hidden, takes no pointer or focus, and the forward step keys do
 * nothing, until the predicate first holds — then it is revealed and stays for the session (a way back to the
 * step finds it shown). Back stays possible. Pure state, evaluated once per frame by the HUD (`Hud.update`).
 */
import type { ChapterManifest, Position } from '@/engine/api';
import { bindingOf } from './step-ui';
import type { StepUiSpec, When } from './step-ui-types';

/** `stepUi` field: keep the step navigator hidden until this first holds (`'goal'`: the step's `goal`). */
export interface StepNavSpec {
  hiddenUntil: When | 'goal';
}

const opened = new Set<string>();
let hidden = false;
const listeners = new Set<(hidden: boolean) => void>();

const holds = (w: When): boolean => (typeof w === 'function' ? w() : w);

/** Is the navigator held back for this step now? Pure over the spec and the session's opened steps. */
export function gateHidden(spec: StepUiSpec | undefined, key: string): boolean {
  const until = spec?.nav?.hiddenUntil;
  if (until === undefined || opened.has(key)) return false;
  const cond = until === 'goal' ? spec?.goal : until;
  if (cond === undefined || holds(cond)) {
    opened.add(key);
    return false;
  }
  return true;
}

/** Per frame (`Hud.update`): evaluate the gate of the step on screen; listeners hear changes only. */
export function tickNavGate(chapter: ChapterManifest | null, pos: Position | null): void {
  let now = false;
  if (chapter && pos && pos.volumeId === chapter.volume && pos.chapterId === chapter.id) {
    const id = `${chapter.volume}/${chapter.id}`;
    now = gateHidden(bindingOf(id)?.specs.get(pos.stepId), `${id}/${pos.stepId}`);
  }
  if (now === hidden) return;
  hidden = now;
  for (const fn of listeners) fn(now);
}

/** The navigator is held back right now (the step keys «next» do nothing; QA: `__ui.navHidden()`). */
export function navHidden(): boolean {
  return hidden;
}

export function onNavGate(fn: (hidden: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tests only: forget the session's opened steps. */
export function resetNavGate(): void {
  opened.clear();
  hidden = false;
}
