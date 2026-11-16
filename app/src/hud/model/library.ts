/**
 * View model of the library screen's volume cards (docs/HUD_DOM.md §4), shared by the WebGL view
 * (`hud/library.ts`) and the DOM view (`hud-dom/map/library.ts`): status line, names, size chips, progress and
 * the state of the «open» button. Data-driven from the volume manifests and the reader's store.
 */
import { journeyProgress, plural, type Visited } from '@/content';
import type { ChapterManifest, VolumeManifest } from '@/engine/api';
import { chapterWords } from '../journey';

export interface CardChip {
  readonly icon: 'layers' | 'target' | null;
  readonly kind: 'plain' | 'scale';
  readonly text: string;
  readonly tooltip?: string;
}

export interface VolumeCardModel {
  readonly volume: VolumeManifest;
  /** «ТОМ 2 · У РОЗРОБЦІ» (already in capitals: it is a label, not copy). */
  readonly status: string;
  readonly chips: readonly CardChip[];
  readonly progress: { readonly fraction: number; readonly label: string; readonly tooltip: string };
  /** The reader is in this volume now: the button goes back to the step. */
  readonly current: boolean;
  readonly openLabel: string;
  readonly openIcon: 'prev' | 'play';
  /** A volume without built chapters cannot be entered yet. */
  readonly disabled: boolean;
}

export interface CardState {
  readonly visited: Visited;
  /** Volume of the step on screen (null in the lobby). */
  readonly volumeId: string | null;
  readonly lastIn: Readonly<Record<string, unknown>>;
  /** A step loaded behind a first visit's landing screen is not "the current step" yet. */
  readonly unseen: boolean;
}

export function volumeCardModel(
  volume: VolumeManifest,
  index: number,
  chapters: readonly ChapterManifest[],
  s: CardState,
): VolumeCardModel {
  const steps = chapters.reduce((n, c) => n + c.steps.length, 0);
  const progress = journeyProgress(s.visited, chapters);
  const current = s.volumeId === volume.id && !s.unseen;
  const started = s.lastIn[volume.id] !== undefined;
  return {
    volume,
    status: `ТОМ ${index + 1}${volume.status === 'published' ? '' : ' · У РОЗРОБЦІ'}`,
    chips: [
      {
        icon: 'layers',
        kind: 'plain',
        text: `${chapters.length} ${plural(chapters.length, chapterWords(volume))}`,
      },
      { icon: 'target', kind: 'plain', text: `${steps} ${plural(steps, ['крок', 'кроки', 'кроків'])}` },
      { icon: null, kind: 'scale', text: volume.journey.axis.range, tooltip: volume.journey.axis.label },
    ],
    progress: {
      fraction: progress.fraction,
      label: `${Math.round(progress.fraction * 100)}%`,
      tooltip: `Переглянуто ${progress.done} з ${progress.total} кроків`,
    },
    current,
    openLabel: current ? 'Повернутися' : started ? 'Продовжити' : 'Відкрити том',
    openIcon: current ? 'prev' : 'play',
    disabled: chapters.length === 0,
  };
}
