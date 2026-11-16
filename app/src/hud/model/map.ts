/**
 * Model of the journey map's chrome (docs/HUD_DOM.md §4), shared by the WebGL map (`hud/map/map.ts`) and its DOM
 * chrome (`hud-dom/map/chrome.ts`): the title bar's ring and line, and the chapter card of a selected stop. A
 * planned journey (`volume.json` gives minutes) is told in chapters and minutes (VOLUME_STRUCTURE §2); floors are
 * named as the reader may see them now (`floorLabel`: a plain name until the step that introduces the word).
 */
import {
  chapterProgress,
  contentKey,
  isVisited,
  journeyProgress,
  NBSP,
  plural,
  type Visited,
} from '@/content';
import { floorLabel, groupLabel, type VolumeManifest } from '@/engine/api';
import { chapterWords, journeyRemaining, type Journey, type JourneyChapter } from '../journey';

export interface MapSummary {
  /** Ring: 0…1 and its label («40%»). */
  readonly fraction: number;
  readonly label: string;
  /** «Пройдено 1 з 9 глав · лишилося ≈ 68 хв» / «Переглянуто 12 з 80 кроків · 14 розділів». */
  readonly text: string;
  /** The same for a phone's title bar, which shares its row with the close button. */
  readonly short: string;
}

export function mapSummary(journey: Journey, visited: Visited): MapSummary {
  const all = journeyProgress(visited, journey.chapters);
  const left = journeyRemaining(visited, journey);
  const words = chapterWords(journey.volume);
  if (left.minutes !== null) {
    const done = left.total - left.chapters;
    // the ring fills by reading time: a planned chapter weighs its minutes, a built one its opened steps
    const fraction = left.totalMinutes > 0 ? 1 - left.minutes / left.totalMinutes : 0;
    const rest = left.chapters > 0 ? `лишилося ≈${NBSP}${left.minutes}${NBSP}хв` : 'усе пройдено';
    return {
      fraction,
      label: `${Math.round(fraction * 100)}%`,
      text: `Пройдено ${done} з ${left.total} ${plural(left.total, words)} · ${rest}`,
      short: rest,
    };
  }
  const n = journey.chapters.length;
  return {
    fraction: all.fraction,
    label: `${Math.round(all.fraction * 100)}%`,
    text: `Переглянуто ${all.done} з ${all.total} кроків · ${n} ${plural(n, words)}`,
    short: `${all.done} з ${all.total} кроків`,
  };
}

/** The axis label of a chapter as the reader may see it now (a floor's plain name before its word is introduced). */
export function stopFloor(volume: VolumeManifest, c: JourneyChapter, visited: Visited): string {
  const floor = volume.journey.axis.floors.find((f) => f.label === c.axisLabel);
  return floor ? floorLabel(volume, floor, visited) : c.axisLabel;
}

const LAYER_NAME: Readonly<Record<string, string>> = {
  prologue: 'Пролог',
  practicum: 'Практикум',
  branch: 'Гілка',
};

/** «Глава 2», «Пролог», «Практикум» (a path volume), else the chapter's group («Мікросвіт»). */
export function stopName(journey: Journey, c: JourneyChapter): string {
  const volume = journey.volume;
  if (volume.format !== 'path') return groupLabel(volume, c.group);
  if (c.layer !== 'path') return LAYER_NAME[c.layer] ?? groupLabel(volume, c.group);
  return `Глава ${journey.chapters.filter((x) => x.layer === 'path').indexOf(c) + 1}`;
}

export interface MapCardStep {
  readonly id: string;
  readonly title: string;
  readonly seen: boolean;
  readonly current: boolean;
}

export interface MapCardModel {
  readonly chapter: JourneyChapter;
  /** «ГЛАВА 2» / «МІКРОСВІТ» as written (views show it in capitals). */
  readonly kicker: string;
  readonly title: string;
  /** Floor (scale chip), size and state chips. */
  readonly floor: string;
  readonly facts: readonly string[];
  readonly steps: readonly MapCardStep[];
  readonly done: number;
  /** The step the main button opens, and its label; null for a planned chapter (it cannot be opened). */
  readonly action: { readonly step: string; readonly label: string } | null;
  /** Shown instead of the button for a planned chapter. */
  readonly note: string | null;
}

export function mapCard(
  journey: Journey,
  c: JourneyChapter,
  visited: Visited,
  currentStep: string | null,
): MapCardModel {
  const key = contentKey(c);
  const words = chapterWords(journey.volume);
  const done = c.real ? chapterProgress(visited, c).done : 0;
  const next = c.steps.find((s) => !isVisited(visited, key, s.id)) ?? c.steps[0];
  const facts: string[] = [];
  if (c.real) facts.push(`${c.steps.length} ${plural(c.steps.length, ['крок', 'кроки', 'кроків'])}`);
  if (c.minutes !== null) facts.push(`≈${NBSP}${c.minutes}${NBSP}хв`);
  if (!c.real) facts.push('у планах');
  const label = currentStep
    ? 'Повернутися до кроку'
    : done === 0
      ? words[0] === 'глава'
        ? 'Почати главу'
        : 'Почати розділ'
      : done >= c.steps.length
        ? 'Переглянути знову'
        : 'Продовжити';
  return {
    chapter: c,
    kicker: stopName(journey, c),
    title: c.title,
    floor: stopFloor(journey.volume, c, visited),
    facts,
    steps: c.steps.map((s) => ({
      id: s.id,
      title: s.title,
      seen: isVisited(visited, key, s.id),
      current: s.id === currentStep,
    })),
    done,
    action: c.real && next ? { step: currentStep ?? next.id, label } : null,
    note: c.real ? null : words[0] === 'глава' ? 'Ця глава ще готується.' : 'Цей розділ ще будується.',
  };
}
