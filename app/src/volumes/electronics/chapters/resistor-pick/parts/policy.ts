/**
 * A copy of `chapters/resistor/parts/policy.ts`, unchanged but for this note: a chapter never imports another chapter.
 *
 * What the reader's hand may take in a step and the names it shows (`HandPolicy` of `shared/hand`), from a step's
 * rules by kind: the parts on the board by their key (`part:<id>`, `leg:<id>:<k>`), the tray's slots (`tray:<key>`),
 * the multimeter's probes (`probe:red`, `probe:black`) and the battery's switch (`switch`). A plug lead is never
 * taken in this chapter.
 */
import type { Bench, HandKey, HandPolicy } from '@electronics/shared/bench';

export interface HandRules {
  /** A part on the board (or waiting in the air) may be taken whole. */
  part?(spec: string, id: string): boolean;
  /** One of its ends may be taken (a jumper's capsule, a resistor's ring). */
  leg?(spec: string, id: string): boolean;
  /** The tray's kinds a new part may be taken from. */
  tray?: readonly string[];
  probes?: boolean;
  switch?: boolean;
  /** A click turns a placed part end for end. */
  flip?(spec: string): boolean;
  /** The names under the pointer: a part's (by its key), a probe's, the switch's ('' — none). */
  name(what: { spec?: string; probe?: 'red' | 'black'; switch?: true }): string;
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
      if (what === 'leg') return rules.leg?.(specOf(id), id) ?? false;
      if (what === 'tray') return rules.tray?.includes(id) ?? false;
      if (what === 'probe') return rules.probes === true;
      return false;
    },
    flip(k) {
      const { what, id } = split(k);
      return what === 'part' && (rules.flip?.(specOf(id)) ?? false);
    },
    tooltip(k) {
      if (k === 'switch') return rules.name({ switch: true });
      const { what, id } = split(k);
      if (what === 'part' || what === 'leg') return rules.name({ spec: specOf(id) });
      if (what === 'tray') return rules.name({ spec: id });
      if (what === 'probe') return rules.name({ probe: id === 'black' ? 'black' : 'red' });
      return '';
    },
  };
}

/** The kind of a catalog key as this chapter names things: `resistor-330` → `resistor`, `led-red` → `led`. */
export function kindOf(spec: string): 'resistor' | 'led' | 'jumper' | 'other' {
  if (spec.startsWith('resistor-')) return 'resistor';
  if (spec.startsWith('led-')) return 'led';
  if (spec === 'jumper') return 'jumper';
  return 'other';
}
