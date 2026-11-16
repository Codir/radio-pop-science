/**
 * Journey model of ONE volume: its chapters in journey order with their parent / child structure — the data
 * the spine and the Journey Map are drawn from. Built from the volume's registered chapter manifests, or
 * (dev, `?fixture`) from the volume's fixture (`VolumeManifest.fixtures.journey`) so both views can be
 * exercised at full scale before the real chapters exist.
 */
import { chapterProgress, type Visited } from '@/content';
import {
  floorValue,
  type ChapterManifest,
  type Engine,
  type FixtureChapter,
  type VolumeLayer,
  type VolumeManifest,
} from '@/engine/api';
import type { AccentName } from '@/style';

export interface JourneyStep {
  readonly id: string;
  readonly title: string;
}

export interface JourneyChapter {
  /** Volume of the chapter (progress is keyed by `volume/id`). */
  readonly volume: string;
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly parent: string | null;
  readonly axisLabel: string;
  /** Value on the volume's journey axis — the node's height on the map's ruler. */
  readonly axisValue: number;
  readonly accent: AccentName;
  readonly steps: readonly JourneyStep[];
  /**
   * False for chapters that are planned but not built (fixture entries, or `volume.json` journey entries with
   * a `title` — a path volume plans its whole journey): they are drawn as planned and cannot be opened.
   */
  readonly real: boolean;
  /** Role of the chapter's group (prologue, path, branch, practicum). */
  readonly layer: VolumeLayer;
  /** Planned length in minutes (`volume.json` journey), null when the volume does not say. */
  readonly minutes: number | null;
  /** Journey-map emblem loader of real chapters. */
  readonly emblem?: ChapterManifest['emblem'];
}

export interface Journey {
  /** The volume this journey belongs to (axis, groups, layout hints, names). */
  readonly volume: VolumeManifest;
  /** All chapters in journey order (parents followed by their children). */
  readonly chapters: readonly JourneyChapter[];
  /** Main-path chapters. */
  readonly roots: readonly JourneyChapter[];
  childrenOf(id: string): readonly JourneyChapter[];
  get(id: string): JourneyChapter | undefined;
  readonly stepCount: number;
  /** Chapters that exist (can be opened); the rest are planned. */
  readonly built: number;
  /** True when built from the fixture. */
  readonly fixture: boolean;
}

function build(volume: VolumeManifest, chapters: readonly JourneyChapter[], fixture: boolean): Journey {
  const ids = new Set(chapters.map((c) => c.id));
  const roots = chapters.filter((c) => !c.parent || !ids.has(c.parent));
  const kids = new Map<string, JourneyChapter[]>();
  for (const c of chapters) {
    if (c.parent && ids.has(c.parent)) kids.set(c.parent, [...(kids.get(c.parent) ?? []), c]);
  }
  const byId = new Map(chapters.map((c) => [c.id, c]));
  return {
    volume,
    chapters,
    roots,
    childrenOf: (id) => kids.get(id) ?? [],
    get: (id) => byId.get(id),
    stepCount: chapters.reduce((n, c) => n + c.steps.length, 0),
    built: chapters.filter((c) => c.real).length,
    fixture,
  };
}

export function journeyFromManifests(volume: VolumeManifest, manifests: readonly ChapterManifest[]): Journey {
  const plan = new Map(volume.journey.planned.map((p) => [p.id, p]));
  const layerOf = (group: string): VolumeLayer =>
    volume.journey.groups.find((g) => g.id === group)?.layer ?? 'path';
  const real = new Map(
    manifests.map((m): [string, JourneyChapter] => [
      m.id,
      {
        volume: volume.id,
        id: m.id,
        title: m.title,
        group: m.group,
        parent: m.parent ?? null,
        axisLabel: m.axisLabel,
        axisValue: m.axisValue,
        accent: m.theme.accent,
        steps: m.steps.map((s) => ({ id: s.id, title: s.title })),
        real: true,
        emblem: m.emblem,
        layer: layerOf(m.group),
        minutes: plan.get(m.id)?.minutes ?? null,
      },
    ]),
  );
  // Planned chapters with a title (a path volume plans its whole journey in volume.json) keep their place on
  // the map until they are built; built chapters the plan does not list follow in registry order.
  const planned = volume.journey.planned.filter((p) => p.title !== undefined || real.has(p.id));
  if (!planned.some((p) => p.title !== undefined)) return build(volume, [...real.values()], false);
  const chapters = planned.map(
    (p): JourneyChapter =>
      real.get(p.id) ?? {
        volume: volume.id,
        id: p.id,
        title: p.title!,
        group: p.group,
        parent: p.parent ?? null,
        axisLabel: volume.journey.axis.floors.find((f) => f.id === p.floor)?.label ?? '',
        axisValue: floorValue(volume, p.floor) ?? volume.journey.axis.origin,
        accent: volume.accent,
        steps: [],
        real: false,
        layer: layerOf(p.group),
        minutes: p.minutes ?? null,
      },
  );
  const listed = new Set(planned.map((p) => p.id));
  return build(volume, [...chapters, ...[...real.values()].filter((c) => !listed.has(c.id))], false);
}

/** Plural forms of the volume's word for a chapter: «глава» in a path volume (VOLUME_STRUCTURE), else «розділ». */
export function chapterWords(volume: VolumeManifest): readonly [string, string, string] {
  return volume.format === 'path' ? ['глава', 'глави', 'глав'] : ['розділ', 'розділи', 'розділів'];
}

/**
 * What is left of the journey: chapters not finished and their minutes (a chapter counts in proportion to
 * its unopened steps; a planned chapter in full). Branches are optional and do not count. `minutes` is null
 * when the volume gives no chapter lengths.
 */
export function journeyRemaining(
  visited: Visited,
  journey: Pick<Journey, 'chapters'>,
): { chapters: number; total: number; minutes: number | null; totalMinutes: number } {
  let chapters = 0;
  let total = 0;
  let minutes: number | null = null;
  let totalMinutes = 0;
  for (const c of journey.chapters) {
    if (c.layer === 'branch') continue;
    total++;
    const p = c.real ? chapterProgress(visited, c) : { fraction: 0 };
    if (p.fraction < 1) chapters++;
    if (c.minutes !== null) {
      minutes = (minutes ?? 0) + c.minutes * (1 - p.fraction);
      totalMinutes += c.minutes;
    }
  }
  return { chapters, total, minutes: minutes === null ? null : Math.round(minutes), totalMinutes };
}

/** True when the page was opened with `?fixture` (development aid; ignored in production builds without it). */
export function wantsFixture(): boolean {
  return new URLSearchParams(window.location.search).has('fixture');
}

/**
 * The journey of a volume: its registered chapters, or its fixture when asked for with `?fixture` (and the
 * volume has one). Real chapters with the same id replace their fixture entries, so finished chapters are
 * reachable from the full-scale map.
 */
export async function loadJourney(engine: Engine, volume: VolumeManifest): Promise<Journey> {
  const registry = await engine.library.load(volume.id);
  const real = journeyFromManifests(volume, registry.chapters);
  const fixture = wantsFixture() ? volume.fixtures?.journey : undefined;
  if (!fixture) return real;
  const planned: readonly FixtureChapter[] = await fixture();
  return build(
    volume,
    planned.map(
      (f) => real.get(f.id) ?? { ...f, volume: volume.id, real: false, layer: 'path', minutes: null },
    ),
    true,
  );
}
