/**
 * View model of the sections under a step's text — «Терміни» / «Слова», «Формули», «Цифри і факти» /
 * «Цікаво», «Хибне уявлення» — shared by the WebGL view (`hud/step-sections.ts`) and the DOM view
 * (`hud-dom/step/sections.ts`). Input is the step's copy at its effective reading level (`stepAtLevel`): the
 * simple layer's words and facts already arrive as terms and facts, and it has no formulas.
 */
import {
  LEVEL_LABELS,
  termIntl,
  termName,
  type Fact,
  type ReadingLevel,
  type StepContent,
  type Term,
} from '@/content';
import type { IconName } from '@/ui3d';

/** One term chip and the card it opens. */
export interface TermModel {
  readonly name: string;
  /** Kicker of the card: «Термін» / «Слово». */
  readonly kicker: string;
  /** Card body (mini-markup): «`symbol, unit` — definition». */
  readonly body: string;
  /** International name and abbreviation (`lang="en"` data), or null. */
  readonly intl: string | null;
  /** The card offers «Відкрити глосарій» (simple words are not glossary entries). */
  readonly glossary: boolean;
}

export type FactModel =
  | { readonly kind: 'chip'; readonly text: string }
  /** A real table (≤ 4 columns). */
  | {
      readonly kind: 'table';
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
      readonly note: string | null;
    }
  /** A table wider than four columns does not fit the panel: each row becomes a small key–value card. */
  | { readonly kind: 'cards'; readonly cards: readonly FactCard[]; readonly note: string | null };

export interface FactCard {
  readonly title: string;
  readonly rows: readonly (readonly [string, string])[];
}

export interface MythModel {
  /** «Myth» in guillemets, or null when the document gives only the correction. */
  readonly title: string | null;
  readonly body: string;
}

interface SectionBase {
  /** QA name of the section button: `section-<id>`. */
  readonly label: string;
  readonly icon: IconName;
}
export type SectionModel =
  | (SectionBase & { readonly id: 'terms'; readonly terms: readonly TermModel[] })
  | (SectionBase & {
      readonly id: 'formulas';
      readonly formulas: readonly { readonly text: string; readonly long: boolean }[];
    })
  | (SectionBase & { readonly id: 'facts'; readonly facts: readonly FactModel[] })
  | (SectionBase & { readonly id: 'myths'; readonly myths: readonly MythModel[] });

/** Kicker of a misconception card. */
export const MYTH_KICKER = 'Хибне уявлення';

export function termModel(term: Term, level: ReadingLevel): TermModel {
  const labels = LEVEL_LABELS[level];
  const tail = [term.symbol, term.unit].filter((v): v is string => !!v && v !== '—').join(', ');
  return {
    name: termName(term),
    kicker: labels.term,
    body: `${tail ? `\`${tail}\` — ` : ''}${term.definition ?? ''}`,
    intl: termIntl(term),
    glossary: labels.glossary,
  };
}

export function factModel(f: Fact): FactModel {
  if (!f.table) return { kind: 'chip', text: f.text };
  const { head, rows } = f.table;
  // an empty note shows nothing
  const note = (f.table.note ?? f.source) || null;
  if (head.length <= 4) return { kind: 'table', head, rows, note };
  return {
    kind: 'cards',
    note,
    cards: rows.map((r) => ({
      title: r[0] ?? '',
      rows: head.slice(1).map((h, j): [string, string] => [h, r[j + 1] ?? '']),
    })),
  };
}

/** A misconception's title: the myth in guillemets (quotes of the document replaced). */
export function mythTitle(myth: string | null | undefined): string | null {
  return myth ? `«${myth.replace(/^[«"]|[»"]$/g, '')}»` : null;
}

/** The sections of a step in display order (empty when it has none). */
export function stepSections(step: StepContent & { level?: ReadingLevel }): SectionModel[] {
  const level = step.level ?? 'detailed';
  const labels = LEVEL_LABELS[level];
  const out: SectionModel[] = [];
  const terms = step.terms ?? [];
  if (terms.length > 0)
    out.push({
      id: 'terms',
      label: `${labels.terms} · ${terms.length}`,
      icon: 'book',
      terms: terms.map((t) => termModel(t, level)),
    });
  const formulas = step.formulas?.items ?? [];
  if (formulas.length > 0)
    out.push({
      id: 'formulas',
      label: `Формули · ${formulas.length}`,
      icon: 'chart',
      formulas: formulas.map((text) => ({ text, long: text.length > 34 })),
    });
  const facts = step.facts?.items ?? [];
  if (facts.length > 0)
    out.push({
      id: 'facts',
      label: `${labels.facts} · ${facts.length}`,
      icon: 'lightning',
      facts: facts.map(factModel),
    });
  const myths = (step.misconceptions ?? []).filter((m) => m.correction);
  if (myths.length > 0)
    out.push({
      id: 'myths',
      label: myths.length > 1 ? `Хибні уявлення · ${myths.length}` : MYTH_KICKER,
      icon: 'warning',
      myths: myths.map((m) => ({ title: mythTitle(m.myth), body: m.correction ?? '' })),
    });
  return out;
}
