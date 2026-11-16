/**
 * Model of the glossary overlay (docs/HUD_DOM.md §4), shared by the WebGL view (`hud/overlays/glossary.ts`) and
 * the DOM view (`hud-dom/overlays/glossary.ts`): where the records come from (a volume, `?fixture`, the whole
 * library), the tabs, the letter index, one row's texts and its link target — plus a prepared search for the DOM
 * view, which filters on every keystroke (same matches as `filterGlossary`, the strings normalised once).
 */
import {
  buildGlossary,
  contentKey,
  glossaryHeading,
  glossaryIntl,
  glossaryLetter,
  loadContents,
  recordKey,
  termName,
  UK_ALPHABET,
  type GlossaryRecord,
} from '@/content';
import type { Library } from '@/engine/api';
import { wantsFixture, type Journey } from '../journey';

export type GlossaryScope = 'volume' | 'library';

/** Terms of one volume (with `?fixture`: completed from the volume's glossary fixture). */
export async function loadVolumeGlossary(journey: Journey): Promise<GlossaryRecord[]> {
  const real = buildGlossary(await loadContents(journey.chapters.filter((c) => c.real).map(contentKey)));
  const fixture = wantsFixture() ? journey.volume.fixtures?.glossary : undefined;
  if (!fixture) return real;
  const rows = await fixture();
  const volumeId = journey.volume.id;
  const have = new Set(real.map((r) => r.international));
  const extra = rows
    .filter((r) => !have.has(r[0]))
    .map((r): GlossaryRecord => ({
      international: r[0],
      ukrainian: r[1],
      symbol: r[2],
      unit: r[3],
      definition: r[4],
      volumeId,
      chapterId: r[5],
      stepId: r[6],
      alsoIn: r[7].map((c) => `${volumeId}/${c}`),
    }));
  const collator = new Intl.Collator('uk', { sensitivity: 'base' });
  const latin = (r: GlossaryRecord): number => (glossaryLetter(r) === '#' ? 1 : 0);
  return [...real, ...extra].sort(
    (a, b) => latin(a) - latin(b) || collator.compare(termName(a), termName(b)),
  );
}

/** Terms of every listed volume, in library order: a term shared by volumes appears once. */
export async function loadLibraryGlossary(library: Library): Promise<GlossaryRecord[]> {
  const keys: string[] = [];
  for (const volume of library.listed) {
    const registry = await library.load(volume.id);
    keys.push(...registry.chapters.map(contentKey));
  }
  return buildGlossary(await loadContents(keys));
}

export interface GlossaryTab {
  readonly id: string;
  readonly label: string;
  readonly tooltip?: string;
}

/** Tabs: «Усі», then the parts of the volume (volume scope) or the volumes (library scope). */
export function glossaryTabs(
  scope: GlossaryScope,
  journey: Journey,
  library: Pick<Library, 'listed'>,
): GlossaryTab[] {
  const items =
    scope === 'library'
      ? library.listed.map((v) => ({ id: v.id, label: v.title, tooltip: v.subtitle }))
      : journey.volume.journey.groups.map((g) => ({ id: g.id, label: g.short, tooltip: g.label }));
  return [{ id: 'all', label: 'Усі' }, ...items];
}

/** Letters of the index in alphabet order (ґ, є, і, ї in place; Latin names under `#`): only those in use. */
export function glossaryLetters(records: readonly GlossaryRecord[] | null): string[] {
  const used = records ? new Set(records.map(glossaryLetter)) : null;
  return [...UK_ALPHABET, '#'].filter((ch) => !used || used.has(ch));
}

export interface GlossaryRow {
  readonly record: GlossaryRecord;
  /** `**name** · \`symbol, unit\`` (mini-markup). */
  readonly heading: string;
  /** The international form when the name does not show it (a secondary line, `lang="en"`). */
  readonly intl: string | null;
  readonly definition: string;
  /** «Том · Розділ · Крок» of the step that introduces the term (the volume only when it is another one). */
  readonly where: string;
  /** The chapter exists (else the link says it is still being built). */
  readonly real: boolean;
}

export function glossaryRow(
  r: GlossaryRecord,
  journey: Journey,
  library: Pick<Library, 'get' | 'registry'>,
): GlossaryRow {
  const volume = journey.volume;
  // the chapter that introduces the term: in this volume's journey, or (library scope) in another volume
  const foreign = r.volumeId !== null && r.volumeId !== volume.id;
  const c = foreign ? library.registry(r.volumeId!)?.get(r.chapterId) : journey.get(r.chapterId);
  const real = foreign ? c !== undefined : journey.get(r.chapterId)?.real === true;
  const step = c?.steps.find((s) => s.id === r.stepId);
  const home = foreign ? `${library.get(r.volumeId!)?.title ?? r.volumeId} · ` : '';
  const where = c ? `${home}${c.title}${step ? ` · ${step.title}` : ''}` : r.chapterId;
  return {
    record: r,
    heading: glossaryHeading(r),
    intl: glossaryIntl(r),
    definition: r.definition,
    where,
    real,
  };
}

/** Where a row's link leads: the chapter (`volume/chapter`) and the step that introduces the term. */
export function glossaryTarget(r: GlossaryRecord): { chapter: string; step: string | undefined } {
  return { chapter: recordKey(r), step: r.stepId ?? undefined };
}
