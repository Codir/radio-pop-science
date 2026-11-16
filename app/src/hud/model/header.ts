/**
 * View model of the chapter header (docs/HUD_DOM.md §4 "Model / view split"), shared by the WebGL view
 * (`hud/header.ts`) and the DOM view (`hud-dom/step/header.ts`): the path above the title, the title, the
 * chapter's place on the volume's journey axis and its hint, the title's width limit per layout.
 */
import { groupLabel, type ChapterManifest, type Library } from '@/engine/api';

export interface HeaderModel {
  /**
   * «Том · Частина · Батьківський розділ» as written (each renderer shows it in capitals; the volume is named
   * only when the library level is shown).
   */
  readonly path: string;
  readonly title: string;
  /** The chapter's place on the journey axis (electricity: `10ⁿ m`), mini-markup. */
  readonly axisLabel: string;
  /** Tooltip of the axis chip: what the axis means. */
  readonly axisHint: string;
}

export function headerModel(
  m: ChapterManifest,
  library: Pick<Library, 'get' | 'registry'>,
  libraryLevel: boolean,
): HeaderModel {
  const volume = library.get(m.volume);
  const parent = library.registry(m.volume)?.parentOf(m.id);
  const path = [
    volume && libraryLevel ? volume.title : '',
    volume ? groupLabel(volume, m.group) : '',
    parent ? parent.title : '',
  ];
  return {
    path: path.filter((p) => p !== '').join(' · '),
    title: m.title,
    axisLabel: m.axisLabel,
    axisHint: volume?.journey.axis.hint ?? '',
  };
}

/** Width limit of the chapter title, units: 430 on wide screens, else at most 42 % of the width (≤ 360). */
export function headerTitleMax(layout: 'wide' | 'narrow' | 'portrait', width: number): number {
  return layout === 'wide' ? 430 : Math.min(360, width * 0.42);
}
