/**
 * What the reader's hand may take in a step and the names it shows (`HandPolicy` of `shared/hand`), from a step's
 * rules by kind: a part on the board by its id (`part:<id>`, whole only — no leg is taken alone in this chapter), the
 * scope's probe (`probe:ch1`) and the battery's switch (`switch`); where a part may come down (`place`) and what
 * happens once a thing has arrived (`done`). A plug lead and the tray are never taken here. The shape of the chapter
 * `meter`'s `parts/policy.ts` (a chapter never imports another), with `place` and `done` passed on.
 */
import type { Bench, HandKey, HandPolicy } from '@electronics/shared/bench';
import type { SocketId } from '@electronics/sim/board';

export interface HandRules {
  /** A part on the board (or in the hand) may be taken whole. */
  part?(spec: string, id: string): boolean;
  /** Where a carried part may come down: its legs in these sockets. */
  place?(id: string, legs: readonly SocketId[]): boolean;
  /** A thing has arrived: a part on the board, or let go off it ('tray': the bench has taken it off the board). */
  done?(k: HandKey, where: 'board' | 'tray' | 'away'): void;
  /** The scope's probe may be taken. */
  probe?: boolean;
  switch?: boolean;
  /** The names under the pointer: a part's (by its spec and id), the probe's, the switch's ('' — none). */
  name(what: { spec?: string; id?: string; probe?: true; switch?: true }): string;
}

export function handPolicy(bench: Bench, rules: HandRules): HandPolicy {
  const specOf = (id: string): string => bench.state.parts.get(id)?.spec ?? '';
  const split = (k: HandKey): { what: string; id: string } => {
    const [what = '', id = ''] = k.split(':');
    return { what, id };
  };
  return {
    take(k) {
      if (k === 'switch') return rules.switch === true;
      const { what, id } = split(k);
      if (what === 'part') return rules.part?.(specOf(id), id) ?? false;
      if (what === 'probe') return id === 'ch1' && rules.probe === true;
      return false;
    },
    place(k, legs) {
      const { what, id } = split(k);
      return what === 'part' && (rules.place?.(id, legs) ?? true);
    },
    flip: () => false,
    done: (k, where) => rules.done?.(k, where),
    tooltip(k) {
      if (k === 'switch') return rules.name({ switch: true });
      const { what, id } = split(k);
      if (what === 'part') return rules.name({ spec: specOf(id), id });
      if (what === 'probe' && id === 'ch1') return rules.name({ probe: true });
      return '';
    },
  };
}
