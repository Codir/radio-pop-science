/**
 * What the reader's hand may take in a step and the names it shows (`HandPolicy` of `shared/hand`), from a step's
 * rules by kind: the parts on the board by their key (`part:<id>`, `leg:<id>:<k>`), the tray's slots (`tray:<key>`),
 * the instruments' probes by name (`probe:red`, `probe:black` of the multimeter, `probe:ch1`, `probe:ch2` of the
 * oscilloscope), the plug leads of the bench's things by name (`lead:pl+`, `lead:pl-`, …) and the battery's switch
 * (`switch`); where a carried part may come down (`place`: a part back into its own sockets) and what happens once a
 * thing has arrived (`done`).
 */
import { PARTS } from '@electronics/sim/core';
import type { SocketId } from '@electronics/sim/board';
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
  /**
   * Where a carried part may come down: its legs in these sockets, in leg order (`false`: not there — let go over the
   * board, the hand takes it back where it was). A step keeps a part to its own sockets this way (the prologue's
   * amplifier in `stand`, the reservoir's can in `capacitor/reservoir`). Without it, wherever its legs find free
   * sockets.
   */
  place?(spec: string, id: string, legs: readonly SocketId[]): boolean;
  /** A thing has arrived: on the board, in the tray (or taken off the board where it has no slot), let go away. */
  done?(k: HandKey, where: 'board' | 'tray' | 'away'): void;
  /** The tray's kinds a new part may be taken from. */
  tray?: readonly string[];
  /** The probes the hand may take, by name; `true` — the multimeter's two (red and black). */
  probes?: boolean | readonly ProbeKey[];
  /** A plug lead of a thing off the board may be taken, by its name (`pl+`, `pl-`, `spk+`, `spk-`, `lamp1` …). */
  lead?(name: string): boolean;
  switch?: boolean;
  /** A click turns a placed part end for end. */
  flip?(spec: string): boolean;
  /** The names under the pointer: a part's (by its key and id), a probe's, a plug's, the switch's ('' — none). */
  name(what: { spec?: string; id?: string; probe?: ProbeKey; lead?: string; switch?: true }): string;
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
      if (what === 'lead') return id !== '' && (rules.lead?.(id) ?? false);
      return false;
    },
    place(k, legs) {
      const { what, id } = split(k);
      return what !== 'part' || (rules.place?.(specOf(id), id, legs) ?? true);
    },
    flip(k) {
      const { what, id } = split(k);
      return what === 'part' && (rules.flip?.(specOf(id)) ?? false);
    },
    done: (k, where) => rules.done?.(k, where),
    tooltip(k) {
      if (k === 'switch') return rules.name({ switch: true });
      const { what, id } = split(k);
      if (what === 'part' || what === 'leg') return rules.name({ spec: specOf(id), id });
      if (what === 'tray') return rules.name({ spec: id });
      if (what === 'probe' && PROBES.has(id)) return rules.name({ probe: id as ProbeKey });
      if (what === 'lead' && id !== '') return rules.name({ lead: id });
      return '';
    },
  };
}

/** The kinds the steps tell apart. */
export type PartKindName = 'resistor' | 'led' | 'jumper' | 'capacitor' | 'electrolytic' | 'pot' | 'other';

/**
 * The kind of a catalog key as the steps name things: `resistor-330` → `resistor`, `led-red` → `led`, `pot-10k` →
 * `pot`; a capacitor by its dielectric (`PARTS[key].dielectric`): the electrolytic can `electrolytic`, a ceramic disc
 * or a film box `capacitor`.
 */
export function kindOf(spec: string): PartKindName {
  if (spec.startsWith('resistor-')) return 'resistor';
  if (spec.startsWith('led-')) return 'led';
  if (spec === 'jumper') return 'jumper';
  const s = Object.hasOwn(PARTS, spec) ? PARTS[spec] : undefined;
  if (s?.kind === 'capacitor') return s.dielectric === 'electrolytic' ? 'electrolytic' : 'capacitor';
  if (s?.kind === 'pot') return 'pot';
  return 'other';
}
