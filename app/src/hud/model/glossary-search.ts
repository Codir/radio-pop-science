/**
 * Glossary search for a view that filters on every keystroke (the DOM glossary, ≤ 4 ms per key for the 684-term
 * fixture, docs/briefs/D5-dom-overlays.md): the same matches as `filterGlossary` of `@/content`, with every
 * string normalised once when the records arrive instead of three times per record and key.
 */
import { glossaryLetter, recordKey, termName, type GlossaryFilter, type GlossaryRecord } from '@/content';

/** As `@/content` glossary's `norm`: lower case (Ukrainian rules), runs of spaces → one space, trimmed. */
const norm = (s: string): string =>
  s
    .toLocaleLowerCase('uk')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();

interface Keys {
  readonly name: string;
  readonly intl: string;
  readonly uk: string;
  readonly symbol: string;
  readonly unit: string;
  readonly letter: string;
  readonly home: string;
}

export interface PreparedGlossary {
  readonly records: readonly GlossaryRecord[];
  readonly keys: readonly Keys[];
}

export function prepareGlossary(records: readonly GlossaryRecord[]): PreparedGlossary {
  return {
    records,
    keys: records.map((r) => ({
      name: norm(termName(r)),
      intl: norm(r.international),
      uk: norm(r.ukrainian),
      symbol: norm(r.symbol ?? ''),
      unit: norm(r.unit ?? ''),
      letter: glossaryLetter(r),
      home: recordKey(r),
    })),
  };
}

/** Indices of the records that pass `filter` (in record order). */
export function searchGlossary(p: PreparedGlossary, filter: GlossaryFilter): number[] {
  const q = norm(filter.query ?? '');
  const out: number[] = [];
  const { volume, chapters, letter } = filter;
  for (let i = 0; i < p.records.length; i++) {
    const r = p.records[i]!;
    const k = p.keys[i]!;
    if (volume !== undefined && r.volumeId !== volume && !r.alsoIn.some((c) => c.startsWith(`${volume}/`)))
      continue;
    if (chapters && !chapters.has(k.home) && !r.alsoIn.some((c) => chapters.has(c))) continue;
    if (letter && k.letter !== letter) continue;
    if (
      q &&
      !(k.name.includes(q) || k.intl.includes(q) || k.uk.includes(q) || k.symbol === q || k.unit === q)
    )
      continue;
    out.push(i);
  }
  return out;
}

/** The record a term link names (`hud.open('glossary', name)`): exact display name first, else the first match. */
export function focusRecord(p: PreparedGlossary, name: string): number {
  const q = norm(name);
  const exact = p.keys.findIndex((k) => k.name === q || k.uk === q || k.intl === q);
  return exact >= 0 ? exact : (searchGlossary(p, { query: name })[0] ?? -1);
}
