/**
 * The volume contract (DECISIONS §58, docs/VOLUMES.md): the library is a set of volumes, a volume is a set of
 * chapters with its own journey map. A volume lives in `src/volumes/<id>/`:
 *
 *   volume.json   identity and journey order — plain data, also read by vite.config.ts, tools/content, tools/qa
 *   volume.ts     `export default defineVolume(identity, { journey, theme, … })` — the manifest (tiny, no three.js)
 *
 * Platform code never names a volume: manifests are discovered (`discover.ts`) and kept in the `Library`.
 */
import { ACCENT, type AccentName } from '@/style/palette';
import type { ChapterTheme } from './chapter';

/**
 * `published` — listed in production. `draft` — a volume in the making: bundled, but registered only with
 * `?debug`. `dev` — development-only (demo, sandboxes): its directory starts with `_`, its manifest is lazy
 * and registered only with `?debug`.
 */
export type VolumeStatus = 'published' | 'draft' | 'dev';

/** Shape of `volume.json` (the fields the app reads; the document pipeline reads `docs` as well). */
export interface VolumeIdentity {
  readonly id: string;
  /** Short name of the volume: library cards, header, glossary scope («Електроенергія»). */
  readonly title: string;
  /** The volume's own line («Від електрона до розетки»). */
  readonly subtitle: string;
  /** Which of the two is the big line on the volume's home screen (default `title`). */
  readonly headline?: string;
  /** Small caps line above the headline on the home screen. */
  readonly kicker?: string;
  /** One or two sentences under the headline. */
  readonly lead?: string;
  /** Position in the library. */
  readonly order: number;
  /** Accent token of the volume (library card, emblem). */
  readonly accent: string;
  /** Icon of the volume's emblem on the library screen (a `@/ui3d` icon name; default `book`). */
  readonly emblem?: string;
  readonly status: string;
  /** False keeps a registered volume off the library screen (the sandbox pseudo-volume). Default true. */
  readonly listed?: boolean;
  /**
   * A published volume kept aside from the main flow (an earlier draft): it does not count toward the library
   * level and is not on the library shelf; the default volume's home screen leads to it through one secondary
   * button with this `label`, and its own home screen leads back (docs/VOLUMES.md §3).
   */
  readonly aside?: { readonly label: string };
  /** Line of the home screen while the volume has no chapters yet («Том у роботі — …»). */
  readonly emptyNote?: string;
  /** Chapter document format: `classic` (volume 1, default) or `path` (docs/PATH_FORMAT.md). */
  readonly format?: string;
  /**
   * The chapters share one world and every border is the same frame (the last of one chapter = the first of the
   * next): a chapter change is a short plain cross-fade, never the scale-zoom. Default false.
   */
  readonly seamless?: boolean;
  readonly axis: {
    readonly label: string;
    readonly unit: string;
    readonly hint?: string;
    readonly range?: string;
    /** Named floors: the ruler shows these words at their axis values instead of formatted numbers. */
    readonly floors?: readonly AxisFloor[];
  };
  /** Parts of the volume, in order. `label` is the short on-screen name; `layer` its role (VOLUME_STRUCTURE §2). */
  readonly groups: readonly {
    readonly id: string;
    readonly label: string;
    readonly short?: string;
    readonly layer?: string;
  }[];
  /**
   * Planned chapters in journey order (built or not) — the document pipeline's source of truth. A path volume
   * also gives each chapter its question (`title`), length (`minutes`) and floor (an `axis.floors` id), so the
   * map can show chapters that are not built yet.
   */
  readonly journey: readonly PlannedChapter[];
}

export interface PlannedChapter {
  readonly id: string;
  readonly group: string;
  readonly parent?: string;
  readonly title?: string;
  readonly minutes?: number;
  readonly floor?: string;
}

/** A named level of the journey axis («стенд», «один атом»). */
export interface AxisFloor {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /**
   * The floor's name uses a word the journey has not introduced yet: `plain` («ряди кульок») is shown instead
   * until the reader has opened the step `namedAt` (`chapter/step` of this volume) that introduces it.
   */
  readonly plain?: string;
  readonly namedAt?: string;
}

/** Role of a group of chapters in the volume (docs/VOLUME_STRUCTURE.md §2). */
export type VolumeLayer = 'prologue' | 'path' | 'branch' | 'practicum';
const LAYERS: readonly string[] = ['prologue', 'path', 'branch', 'practicum'];

/** The axis of a volume's journey map — electricity: scale in metres; another volume: frequency, time, level… */
export interface JourneyAxis {
  /** Name of the quantity («Масштаб»). */
  readonly label: string;
  /** Unit symbol (`m`, `Hz`; empty for a dimensionless axis). */
  readonly unit: string;
  /** Tooltip of a chapter's axis chip («Характерний масштаб розділу»). */
  readonly hint: string;
  /** The whole span of the journey as one label for the home screen (`10⁻¹⁸ m … 10⁶ m`). */
  readonly range: string;
  /** Ruler range, in axis values (a chapter's `axisValue` uses the same numbers). */
  readonly min: number;
  readonly max: number;
  /** Axis value drawn at map height 0. */
  readonly origin: number;
  /** Distance between ruler ticks, in axis values, and how often a tick is long and labelled. */
  readonly tick: number;
  readonly majorEvery: number;
  /** Ruler label of an axis value (`10⁻¹⁰ m`). */
  format(value: number): string;
  /** Named floors of the axis (empty: the ruler shows `format` at every major tick). */
  readonly floors: readonly AxisFloor[];
  /**
   * What the chapter transition does when the axis value grows: electricity zooms **out** when the scale
   * grows. `in` suits axes where "more" means "closer" (level of detail).
   */
  readonly ascending: 'out' | 'in';
}

export interface JourneyGroup {
  readonly id: string;
  /** Ukrainian name (header kicker, map card). */
  readonly label: string;
  /** Name for narrow places (glossary tabs); the label when `volume.json` gives no `short`. */
  readonly short: string;
  /** Generic journey-map emblem of the group's chapters until they ship their own (`@/hud` emblem names). */
  readonly emblem: string;
  /** Role of the group (`path` when `volume.json` does not say). */
  readonly layer: VolumeLayer;
}

/** Geometry hints of the journey map, in map units (defaults: `DEFAULT_MAP_LAYOUT`). */
export interface JourneyLayout {
  /** Horizontal distance between main-path nodes. */
  readonly dx: number;
  /** Height per unit of the axis. */
  readonly dy: number;
  /** Depth meander amplitude. */
  readonly dz: number;
  readonly rootRadius: number;
  readonly childRadius: number;
  /** Horizontal spacing of satellites under their hub. */
  readonly orbit: number;
}

export const DEFAULT_MAP_LAYOUT: JourneyLayout = {
  dx: 196,
  dy: 34,
  dz: 110,
  rootRadius: 46,
  childRadius: 27,
  orbit: 152,
};

/** A chapter of a journey fixture (`?fixture`): what the map and the spine need before the chapter exists. */
export interface FixtureChapter {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly parent: string | null;
  readonly axisLabel: string;
  readonly axisValue: number;
  readonly accent: AccentName;
  readonly steps: readonly { readonly id: string; readonly title: string }[];
}

/** Glossary fixture row: international, ukrainian, symbol, unit, definition, chapterId, stepId, alsoIn. */
export type FixtureGlossaryRow = readonly [
  string,
  string,
  string | null,
  string | null,
  string,
  string,
  string | null,
  readonly string[],
];

/** Optional development data of a volume, loaded only with `?fixture`. */
export interface VolumeFixtures {
  /** Every planned chapter of the volume, so the map and the spine can be exercised at full size. */
  readonly journey?: () => Promise<readonly FixtureChapter[]>;
  readonly glossary?: () => Promise<readonly FixtureGlossaryRow[]>;
}

export interface VolumeManifest {
  /** URL-safe id; equals the directory name under `src/volumes/`. */
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The big line of the volume's home screen (the title or the subtitle, see `VolumeIdentity.headline`). */
  readonly headline: string;
  readonly kicker: string;
  readonly lead: string;
  readonly order: number;
  readonly accent: AccentName;
  /** Icon name of the volume's emblem on the library screen. */
  readonly emblem: string;
  readonly status: VolumeStatus;
  /** Shown on the library screen (when registered); false for an aside volume. */
  readonly listed: boolean;
  /** Label of the secondary button that leads to this volume, if it is kept aside (`VolumeIdentity.aside`). */
  readonly aside: string | null;
  /** Home-screen line while the volume has no chapters (empty: none). */
  readonly emptyNote: string;
  readonly journey: {
    readonly axis: JourneyAxis;
    readonly groups: readonly JourneyGroup[];
    readonly layout: JourneyLayout;
    /**
     * Planned chapters in journey order (built chapters register themselves). In a path volume the entries
     * carry `title`, `minutes` and `floor`, and the map shows the unbuilt ones as planned.
     */
    readonly planned: readonly PlannedChapter[];
  };
  /** Chapter document format of the volume: `path` chapters use the one-reader step panel. */
  readonly format: 'classic' | 'path';
  /** Borders are the same frame: chapter changes cross-fade instead of zooming (`volume.json` `seamless`). */
  readonly seamless: boolean;
  /** What the glossary shows when opened inside this volume: its own terms, or the whole library's. */
  readonly glossary: { readonly scope: 'volume' | 'library' };
  /** Default environment of the volume: the look of its chapters unless a chapter chooses otherwise. */
  readonly theme: ChapterTheme;
  readonly fixtures?: VolumeFixtures;
}

/** What `volume.ts` adds to the identity of `volume.json`. */
export interface VolumeSpec {
  readonly journey: {
    /** `label` and `unit` come from `volume.json`. */
    readonly axis: Omit<JourneyAxis, 'label' | 'unit' | 'hint' | 'range' | 'floors'>;
    /** Emblem of each group (`@/hud` emblem names); groups without an entry use the generic emblem. */
    readonly emblems?: Readonly<Record<string, string>>;
    readonly layout?: Partial<JourneyLayout>;
  };
  readonly glossary?: { readonly scope: 'volume' | 'library' };
  /** Default environment; `accent` defaults to the volume accent. */
  readonly theme: Omit<ChapterTheme, 'accent'> & { readonly accent?: AccentName };
  readonly fixtures?: VolumeFixtures;
}

const ID = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const STATUSES: readonly string[] = ['published', 'draft', 'dev'];

/** Is this the id of a development-only volume (directory name starting with `_`)? */
export function isDevVolumeId(id: string): boolean {
  return id.startsWith('_');
}

/** Declare a volume: `export default defineVolume(identity, { … })`. Validates eagerly, like `defineChapter`. */
export function defineVolume(identity: VolumeIdentity, spec: VolumeSpec): VolumeManifest {
  const fail = (msg: string): never => {
    throw new Error(`defineVolume(${identity.id}): ${msg}`);
  };
  if (!ID.test(identity.id)) fail(`invalid volume id '${identity.id}'`);
  if (!STATUSES.includes(identity.status)) fail(`status must be one of ${STATUSES.join(' | ')}`);
  const status = identity.status as VolumeStatus;
  if (isDevVolumeId(identity.id) !== (status === 'dev'))
    fail(`a dev volume has status 'dev' and a directory name starting with '_' (and only a dev volume)`);
  if (!(identity.accent in ACCENT)) fail(`unknown accent '${identity.accent}'`);
  const accent = identity.accent as AccentName;
  // a volume that is only a skeleton (no planned chapters yet) may have no groups either
  if (identity.groups.length === 0 && identity.journey.length > 0)
    fail('a volume with chapters needs a group');
  if (identity.aside !== undefined && (status !== 'published' || !identity.aside.label))
    fail(`an aside volume is published and has a button label`);
  const groupIds = new Set(identity.groups.map((g) => g.id));
  if (groupIds.size !== identity.groups.length) fail('duplicate group id');
  const planned = new Set<string>();
  for (const c of identity.journey) {
    if (!ID.test(c.id)) fail(`invalid chapter id '${c.id}' in journey`);
    if (planned.has(c.id)) fail(`chapter '${c.id}' is listed twice in journey`);
    if (!groupIds.has(c.group)) fail(`chapter '${c.id}': unknown group '${c.group}'`);
    planned.add(c.id);
  }
  for (const c of identity.journey)
    if (c.parent !== undefined && !planned.has(c.parent))
      fail(`chapter '${c.id}': unknown parent '${c.parent}'`);
  const format = identity.format ?? 'classic';
  if (format !== 'classic' && format !== 'path') return fail(`format must be 'classic' or 'path'`);
  for (const g of identity.groups)
    if (g.layer !== undefined && !LAYERS.includes(g.layer))
      fail(`group '${g.id}': unknown layer '${g.layer}'`);
  const floors = identity.axis.floors ?? [];
  const floorIds = new Set(floors.map((f) => f.id));
  for (const f of floors)
    if (
      (f.plain === undefined) !== (f.namedAt === undefined) ||
      (f.namedAt && f.namedAt.split('/').length !== 2)
    )
      fail(`floor '${f.id}': 'plain' and 'namedAt' (chapter/step) go together`);
  for (const c of identity.journey) {
    if (c.floor !== undefined && !floorIds.has(c.floor))
      fail(`chapter '${c.id}': unknown floor '${c.floor}'`);
    if (c.minutes !== undefined && !(c.minutes > 0)) fail(`chapter '${c.id}': minutes must be positive`);
  }
  const axis = spec.journey.axis;
  if (!(axis.max > axis.min) || !(axis.tick > 0) || !(axis.majorEvery >= 1))
    fail('journey axis needs max > min, tick > 0, majorEvery ≥ 1');
  if (identity.headline !== undefined && identity.headline !== 'title' && identity.headline !== 'subtitle')
    fail(`headline must be 'title' or 'subtitle'`);
  return {
    id: identity.id,
    title: identity.title,
    subtitle: identity.subtitle,
    headline: identity.headline === 'subtitle' ? identity.subtitle : identity.title,
    kicker: identity.kicker ?? '',
    lead: identity.lead ?? '',
    order: identity.order,
    accent,
    emblem: identity.emblem ?? 'book',
    status,
    listed: (identity.listed ?? true) && identity.aside === undefined,
    aside: identity.aside?.label ?? null,
    emptyNote: identity.emptyNote ?? '',
    journey: {
      axis: {
        ...axis,
        label: identity.axis.label,
        unit: identity.axis.unit,
        hint: identity.axis.hint ?? identity.axis.label,
        range:
          identity.axis.range ??
          (floors.length > 1
            ? `${floors[0]!.plain ?? floors[0]!.label} … ${floors[floors.length - 1]!.plain ?? floors[floors.length - 1]!.label}`
            : `${axis.format(axis.min)} … ${axis.format(axis.max)}`),
        floors,
      },
      groups: identity.groups.map((g) => ({
        id: g.id,
        label: g.label,
        short: g.short ?? g.label,
        emblem: spec.journey.emblems?.[g.id] ?? 'generic',
        layer: (g.layer ?? 'path') as VolumeLayer,
      })),
      layout: { ...DEFAULT_MAP_LAYOUT, ...spec.journey.layout },
      planned: identity.journey,
    },
    format,
    seamless: identity.seamless === true,
    glossary: spec.glossary ?? { scope: 'volume' },
    theme: { ...spec.theme, accent: spec.theme.accent ?? accent },
    fixtures: spec.fixtures,
  };
}

/** Axis value of a named floor (undefined for an unknown or missing id). */
export function floorValue(volume: VolumeManifest, floor: string | undefined): number | undefined {
  return volume.journey.axis.floors.find((f) => f.id === floor)?.value;
}

/**
 * The name of a floor as the reader may see it now: its `plain` name until the reader is past the step that
 * introduces the word (`visited`: full chapter id `volume/chapter` → opened step ids, the store's progress) —
 * that step opened, or any step of a later chapter of the journey (a deep link into a later chapter, whose text
 * already uses the word), or, when `stepsOf` gives the order of the steps of that step's own chapter, a later
 * step of it.
 */
export function floorLabel(
  volume: VolumeManifest,
  floor: AxisFloor,
  visited: Readonly<Record<string, readonly string[]>>,
  stepsOf?: (chapterId: string) => readonly string[] | undefined,
): string {
  if (!floor.namedAt || floor.plain === undefined) return floor.label;
  const [chapter, step] = floor.namedAt.split('/') as [string, string];
  const seen = (c: string): readonly string[] => visited[`${volume.id}/${c}`] ?? [];
  if (seen(chapter).includes(step)) return floor.label;
  const order = (volume.journey.planned ?? []).map((c) => c.id);
  const at = order.indexOf(chapter);
  if (at >= 0 && order.slice(at + 1).some((c) => seen(c).length > 0)) return floor.label;
  const steps = stepsOf?.(chapter);
  const i = steps?.indexOf(step) ?? -1;
  return i >= 0 && seen(chapter).some((s) => steps!.indexOf(s) > i) ? floor.label : floor.plain;
}

/** Short on-screen name of a group of the volume (empty for an unknown group). */
export function groupLabel(volume: VolumeManifest, group: string): string {
  return volume.journey.groups.find((g) => g.id === group)?.label ?? '';
}
