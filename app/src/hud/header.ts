/**
 * Chapter header (top-left): volume (when the library level is shown) and part, chapter title, the chapter's
 * place on the volume's journey axis (electricity: scale chip `10ⁿ m`), chapter progress ring.
 */
import type { ChapterManifest, HudMetrics } from '@/engine/api';
import { chapterProgress } from '@/content';
import { Chip, Label, Panel, ProgressRing, TEXT_COLOR, UI, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import { headerModel, headerTitleMax } from './model/header';
import { TOUCH } from './model/sheet';
import { axisChipText, onWhere, whereFloor } from './where';

export function createHeader(hud: HudContext): HudModule {
  const group = new Label('', {
    font: 'bodyBold',
    size: UI.text.caption,
    color: TEXT_COLOR.mute,
    letterSpacing: 0.08,
    nowrap: true,
  });
  const title = new Label('', { font: 'display', size: UI.text.h2, lineHeight: 1.16, maxWidth: 430 });
  const scale = new Chip({ kind: 'scale', text: '', tooltip: '' });
  const ring = new ProgressRing({ size: 46, label: '' });
  ring.on({ tooltip: 'Переглянуто кроків у розділі' });
  const node = new Panel({
    variant: 'card',
    dir: 'row',
    align: 'center',
    gap: 14,
    pad: [12, 18, 12, 14],
    float: { ax: 0, ay: 0 },
    children: [ring, new UiNode({ dir: 'col', gap: 2, children: [group, title] }), scale],
  });
  const deskParts = [...node.children];
  let manifest: ChapterManifest | null = null;
  // touch shells (phones, tablets): one compact row — a small ring and the chapter title on one line
  const miniRing = new ProgressRing({ size: 30, thickness: 4, visible: false });
  const miniTitle = new Label(
    '',
    { font: 'display', size: UI.text.small, nowrap: true },
    { name: 'header-title', visible: false },
  );
  // touch shells: the floor the reader is on, while the chapter reports one (a dive, the lower floors) — the
  // phone's whole «де ми» cue, in the header row instead of over the scene (hud/where.ts)
  const miniFloor = new Chip({ name: 'header-floor', kind: 'scale', text: '', visible: false });
  /** Measures the chip's text (the chip's own label is private): the title gives up that much width. */
  const probe = new Label('', { font: 'bodyBold', size: UI.text.caption, nowrap: true });
  node.add(miniRing, miniTitle, miniFloor);
  let touch = false;
  let metrics: HudMetrics | null = null;
  const floor = (): void => {
    if (!manifest) return;
    const volume = hud.engine.library.get(manifest.volume);
    const text = axisChipText(manifest, volume, hud.engine.store.get().progress.visited);
    scale.label = text;
    const reported = whereFloor(`${manifest.volume}/${manifest.id}`) !== null;
    if (miniFloor.label !== text) miniFloor.label = text;
    const show = touch && reported;
    if (miniFloor.visible !== show) {
      miniFloor.visible = show;
      if (metrics) layoutTouch(metrics);
    }
  };
  const progress = (): void => {
    if (!manifest) return;
    const p = chapterProgress(hud.engine.store.get().progress.visited, manifest);
    ring.value = p.fraction;
    ring.label = `${p.done}/${p.total}`;
    miniRing.value = p.fraction;
    floor();
  };
  /** The chapter title cut to `width` units with an ellipsis (the label never wraps). */
  const fitTitle = (width: number): void => {
    const full = manifest?.title ?? '';
    miniTitle.text = full;
    if (miniTitle.measure(4000)[0] <= width) return;
    let lo = 1;
    let hi = full.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      miniTitle.text = `${full.slice(0, mid).trimEnd()}…`;
      if (miniTitle.measure(4000)[0] <= width) lo = mid;
      else hi = mid - 1;
    }
    miniTitle.text = `${full.slice(0, lo).trimEnd()}…`;
  };
  hud.engine.store.subscribe((s) => s.progress, progress);
  onWhere(floor);
  const layoutTouch = (m: HudMetrics): void => {
    const left = m.safeArea.left + TOUCH.edge;
    node.float = { ax: 0, ay: 0, dx: left, dy: m.safeArea.top + TOUCH.edge };
    // room: up to the two system buttons (portrait) or up to the side sheet (landscape); the floor chip, when
    // shown, takes its share from the title
    const right = m.shell === 'side' ? (hud.touch.insets?.(m).right ?? 0) : m.safeArea.right;
    const buttons = 46 * 2 + 8 + TOUCH.edge * 2;
    // the chip's text, its icon (17), gap and paddings (13 + 11), and the row gap
    probe.text = miniFloor.label;
    const chip = miniFloor.visible ? probe.measure(4000)[0] + 17 + 6 + 24 + 9 : 0;
    fitTitle(Math.max(m.width - left - right - buttons - (30 + 9 + 9 + 16) - chip, 60));
  };
  return {
    node,
    onChapter(m) {
      manifest = m;
      const model = headerModel(m, hud.engine.library, hud.libraryLevel);
      group.text = model.path.toUpperCase();
      title.text = model.title;
      scale.label = model.axisLabel;
      scale.on({ tooltip: model.axisHint });
      progress();
      floor();
    },
    onLayout(m) {
      const now = m.shell !== 'desk';
      if (now !== touch) {
        touch = now;
        for (const n of deskParts) n.visible = !touch;
        miniRing.visible = miniTitle.visible = touch;
        node.pad = touch ? [0, 16, 0, 9] : [12, 18, 12, 14];
        node.gap = touch ? 9 : 14;
        node.radius = touch ? TOUCH.headerH / 2 : UI.radius.card;
        node.height = touch ? TOUCH.headerH : 'hug';
        node.repaint();
      }
      metrics = m;
      if (touch) {
        floor();
        layoutTouch(m);
        return;
      }
      node.float = { ax: 0, ay: 0, dx: m.safeMargin, dy: m.safeMargin };
      title.setStyle({ maxWidth: headerTitleMax(m.layout, m.width) });
    },
  };
}
