/**
 * DOM chapter header (top-left; WebGL twin `hud/header.ts`): progress ring (SVG), «ТОМ · ЧАСТИНА ·
 * БАТЬКІВСЬКИЙ РОЗДІЛ» (capitals by CSS, the volume only at the library level), chapter title `<h1>`, the
 * chapter's place on the journey axis with its hint as tooltip. Data: `hud/model/header.ts`.
 */
import type { ChapterManifest, HudMetrics } from '@/engine/api';
import { headerModel, headerTitleMax } from '@/hud/model/header';
import { chapterProgress } from '@/content';
import type { Hud } from '@/hud/shell';
import { axisChipText, onWhere, whereFloor } from '@/hud/where';
import { h, setClass, setStyle, setText } from '../core/dom';
import { icon } from '../core/icons';
import { setRich } from '../core/rich';

const SVG = 'http://www.w3.org/2000/svg';

function ring(): { el: HTMLElement; set(fraction: number, label: string): void } {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 46 46');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'circle');
  const arc = document.createElementNS(SVG, 'circle');
  for (const c of [track, arc]) {
    c.setAttribute('cx', '23');
    c.setAttribute('cy', '23');
    c.setAttribute('r', '20');
    c.setAttribute('pathLength', '100');
  }
  track.setAttribute('class', 'track');
  arc.setAttribute('class', 'arc');
  svg.append(track, arc);
  const text = h('span.ring-label');
  const el = h(
    'div.ring',
    { role: 'img', 'data-ui': 'header-ring', 'data-tip': 'Переглянуто кроків у розділі' },
    text,
  );
  el.prepend(svg);
  return {
    el,
    set(fraction, label) {
      setStyle(arc as unknown as HTMLElement, 'stroke-dasharray', `${(fraction * 100).toFixed(2)} 100`);
      setText(text, label);
      el.setAttribute('aria-label', `Переглянуто кроків: ${label}`);
    },
  };
}

export function createDomHeader(hud: Hud): {
  el: HTMLElement;
  onChapter(m: ChapterManifest): void;
  onLayout(m: HudMetrics): void;
} {
  const r = ring();
  const kicker = h('div.kicker');
  const title = h('h1.hd-title');
  const axis = h('span.axis-text');
  const chip = h('span.chip.scale', null, icon('ruler'), axis);
  const el = h(
    'header.kd.card.hd',
    { 'data-ui': 'header' },
    r.el,
    h('div.hd-text', null, kicker, title),
    chip,
  );
  let manifest: ChapterManifest | null = null;
  // the floor the reader is on (path volumes: reported by the chapter, plain names until introduced)
  const floor = (): void => {
    if (!manifest) return;
    // touch shells show the chip only while the chapter reports a floor (a dive): the phone's «де ми» cue
    setClass(el, 'where', whereFloor(`${manifest.volume}/${manifest.id}`) !== null);
    setRich(axis, axisChipText(manifest, hud.engine.library.get(manifest.volume), hud.engine.store.get().progress.visited));
  };
  const progress = (): void => {
    if (!manifest) return;
    const p = chapterProgress(hud.engine.store.get().progress.visited, manifest);
    r.set(p.fraction, `${p.done}/${p.total}`);
    floor();
  };
  hud.engine.store.subscribe((s) => s.progress, progress);
  onWhere(floor);
  return {
    el,
    onChapter(m) {
      manifest = m;
      const model = headerModel(m, hud.engine.library, hud.libraryLevel);
      // capitals by CSS: copying the kicker gives the words as written
      setText(kicker, model.path);
      setText(title, model.title);
      setRich(axis, model.axisLabel);
      floor();
      if (model.axisHint) chip.dataset.tip = model.axisHint;
      else delete chip.dataset.tip;
      progress();
    },
    onLayout(m) {
      setStyle(title, 'max-width', `calc(${headerTitleMax(m.layout, m.width).toFixed(1)} * var(--u))`);
    },
  };
}
