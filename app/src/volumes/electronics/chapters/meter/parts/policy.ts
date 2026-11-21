/**
 * What the reader's hand may take in a step and the names it shows (`HandPolicy` of `shared/hand`), from a step's
 * rules by kind: a part on the board by its key and id (`part:<id>`, `leg:<id>:<k>`), the tray's slots (`tray:<key>`),
 * the instruments' probes by name (`probe:red`, `probe:black`, `probe:ch1`, `probe:ch2`) and the battery's switch
 * (`switch`). A plug lead is never taken in this chapter. The shape of the chapter `resistor`'s `parts/policy.ts`
 * (a chapter never imports another), the probes named one by one.
 */
import type { Bench, HandKey, HandPolicy } from '@electronics/shared/bench';

export type ProbeKey = 'red' | 'black' | 'ch1' | 'ch2';

export interface HandRules {
  /** A part on the board (or waiting in the air) may be taken whole. */
  part?(spec: string, id: string): boolean;
  /** One of its ends may be taken (a jumper's capsule). */
  leg?(spec: string, id: string): boolean;
  /** The tray's kinds a new part may be taken from. */
  tray?: readonly string[];
  /** The probes the hand may take. */
  probes?: readonly ProbeKey[];
  switch?: boolean;
  /** The names under the pointer: a part's (by its key), a probe's, the switch's ('' — none). */
  name(what: { spec?: string; probe?: ProbeKey; switch?: true }): string;
}

const PROBES: ReadonlySet<string> = new Set<ProbeKey>(['red', 'black', 'ch1', 'ch2']);

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
      if (what === 'leg') return rules.leg?.(specOf(id), id) ?? false;
      if (what === 'tray') return rules.tray?.includes(id) ?? false;
      if (what === 'probe') return PROBES.has(id) && (rules.probes?.includes(id as ProbeKey) ?? false);
      return false;
    },
    flip: () => false,
    tooltip(k) {
      if (k === 'switch') return rules.name({ switch: true });
      const { what, id } = split(k);
      if (what === 'part' || what === 'leg') return rules.name({ spec: specOf(id) });
      if (what === 'tray') return rules.name({ spec: id });
      if (what === 'probe' && PROBES.has(id)) return rules.name({ probe: id as ProbeKey });
      return '';
    },
  };
}
