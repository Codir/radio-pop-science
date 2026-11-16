/**
 * View model of a volume's home screen (docs/HUD_DOM.md §4 "Model / view split"), shared by the WebGL view
 * (`hud/home.ts`) and the DOM view (`hud-dom/map/home.ts`): the names from the volume manifest, the fact chips,
 * which actions exist, and the start / resume state of the reader. All text comes from the manifest.
 */
import { journeyProgress, NBSP, plural, type Visited } from '@/content';
import type { ChapterManifest, VolumeManifest } from '@/engine/api';
import { chapterWords, journeyRemaining, type Journey } from '../journey';

export interface HomeFact {
  readonly icon: 'layers' | 'clock' | 'target' | null;
  /** `scale` = the journey axis range (mono chip). */
  readonly kind: 'plain' | 'scale';
  readonly text: string;
}

export interface HomeModel {
  readonly volume: VolumeManifest;
  /** Kicker above the headline as written ('' = none; views show it in capitals). */
  readonly kicker: string;
  readonly headline: string;
  /** The subtitle under a title headline (a volume whose headline is its subtitle shows the lead only). */
  readonly tagline: string | null;
  readonly lead: string;
  /** No built chapter yet: the names and `emptyNote`, nothing to start. */
  readonly empty: boolean;
  /** No chapter at all, not even planned (the lobby on the bare backdrop): the names stand mid-screen. */
  readonly bare: boolean;
  /** `volume.json → emptyNote` while the volume is empty. */
  readonly note: string | null;
  readonly facts: readonly HomeFact[];
  /** «Бібліотека» exists only while the library level is shown. */
  readonly library: boolean;
}

export function homeModel(journey: Journey, showsLibrary: boolean): HomeModel {
  const volume = journey.volume;
  const empty = journey.built === 0;
  const words = chapterWords(volume);
  const minutes = journeyRemaining({}, journey).minutes;
  const n = journey.chapters.length;
  return {
    volume,
    kicker: volume.kicker,
    headline: volume.headline,
    tagline: volume.headline === volume.title && volume.subtitle ? volume.subtitle : null,
    lead: volume.lead,
    empty,
    bare: empty && n === 0,
    note: empty && volume.emptyNote ? volume.emptyNote : null,
    facts: [
      { icon: 'layers', kind: 'plain', text: `${n} ${plural(n, words)}` },
      // a planned journey knows its length in minutes, not yet its steps
      minutes !== null
        ? { icon: 'clock', kind: 'plain', text: `≈${NBSP}${minutes}${NBSP}хв` }
        : {
            icon: 'target',
            kind: 'plain',
            text: `${journey.stepCount} ${plural(journey.stepCount, ['крок', 'кроки', 'кроків'])}`,
          },
      { icon: null, kind: 'scale', text: volume.journey.axis.range },
    ],
    library: showsLibrary,
  };
}

export interface HomeStart {
  /** The reader has been here before: «Продовжити» returns to the step, the start button starts over. */
  readonly seen: boolean;
  readonly startLabel: string;
  /** Content key of the first chapter (where «Почати спочатку» leads), null when nothing is built. */
  readonly first: ChapterManifest | null;
}

/** Start / resume state of the home screen when it opens (returning readers continue where they stopped). */
export function homeStart(
  visited: Visited,
  lastIn: Readonly<Record<string, unknown>>,
  volumeId: string,
  chapters: readonly ChapterManifest[],
): HomeStart {
  const seen = journeyProgress(visited, chapters).done > 0 && lastIn[volumeId] !== undefined;
  return { seen, startLabel: seen ? 'Почати спочатку' : 'Почати подорож', first: chapters[0] ?? null };
}
