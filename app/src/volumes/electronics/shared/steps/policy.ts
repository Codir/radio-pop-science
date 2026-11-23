/**
 * What the reader's hand may take in a step and the names it shows (`HandPolicy` of `shared/hand`), from a step's
 * rules by kind: the parts on the board by their key (`part:<id>`, `leg:<id>:<k>`), the tray's slots (`tray:<key>`),
 * the instruments' probes by name (`probe:red`, `probe:black` of the multimeter, `probe:ch1`, `probe:ch2` of the
 * oscilloscope) and the battery's switch (`switch`). A plug lead (`lead:<id>`) is never taken through these rules.
 */
import type { Bench, HandKey, HandPolicy } from '../bench';

/** The instruments' probes as the hand names them: the multimeter's two, the oscilloscope's two channels. */
export type ProbeKey = 'red' | 'black' | 'ch1' | 'ch2';

const PROBES: ReadonlySet<string> = new Set<ProbeKey>(['red', 'black', 'ch1', 'ch2']);
/** `probes: true` — the multimeter's two. */
const METER_PROBES: readonly ProbeKey[] = ['red', 'black'];

export interface HandRules {
  /** A part on the board (or waiting in the air) may be taken whole. */
  part?(spec: string, id: string): boolean;
  /** One of its ends may be taken (a jumper's capsule, a resistor's ring). */
  leg?(spec: string, id: string): boolean;
  /** The tray's kinds a new part may be taken from. */
  tray?: readonly string[];
  /** The probes the hand may take, by name; `true` — the multimeter's two (red and black). */
  probes?: boolean | readonly ProbeKey[];
  switch?: boolean;
  /** A click turns a placed part end for end. */
  flip?(spec: string): boolean;
  /** The names under the pointer: a part's (by its key), a probe's, the switch's ('' — none). */
  name(what: { spec?: string; probe?: ProbeKey; switch?: true }): string;
}

export function handPolicy(bench: Bench, rules: HandRules): HandPolicy {
  const specOf = (id: string): string => bench.state.parts.get(id)?.spec ?? '';
  const split = (k: HandKey): { what: string; id: string } => {
    const [what = '', id = ''] = k.split(':');
    return { what, id };
  };
  const probes: readonly ProbeKey[] =
    rules.probes === true ? METER_PROBES : rules.probes === false || rules.probes === undefined ? [] : rules.probes;
  return {
    take(k) {
      if (k === 'switch') return rules.switch === true;
      const { what, id } = split(k);
      if (what === 'part') return rules.part?.(specOf(id), id) ?? false;
      if (what === 'leg') return rules.leg?.(specOf(id), id) ?? false;
      if (what === 'tray') return rules.tray?.includes(id) ?? false;
      if (what === 'probe') return PROBES.has(id) && probes.includes(id as ProbeKey);
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
      if (what === 'probe' && PROBES.has(id)) return rules.name({ probe: id as ProbeKey });
      return '';
    },
  };
}

/** The kind of a catalog key as the steps name things: `resistor-330` → `resistor`, `led-red` → `led`. */
export function kindOf(spec: string): 'resistor' | 'led' | 'jumper' | 'other' {
  if (spec.startsWith('resistor-')) return 'resistor';
  if (spec.startsWith('led-')) return 'led';
  if (spec === 'jumper') return 'jumper';
  return 'other';
}
