/**
 * `journeyInset(ctx, { onOpen })` — the volume's journey map inside a step (a board or dock widget): the same
 * nodes as «Мапа подорожі» (journey order, height by floor), the floors named as the reader may see them now
 * (`floorLabel`), built / planned / here, the chapter questions and «лишилося ≈ N хв». The reader opens a stop
 * (a real button); its card names the stop and `onOpen(chapterId)` tells the chapter — a step's `goal` reads it.
 *
 *   stepUi(ctx).define({ map: { board: { title: 'Мапа тому', size: 'lg', children: [journeyInset(ctx, …)] } } })
 *
 * DOM interface: the plot (a phone-narrow widget gets the same stops as a list). WebGL interface and the touch
 * sheet («Графіки»): a row of numbered stop buttons and the same card (`@/ui3d`).
 */
import { NBSP, plural } from '@/content';
import { floorLabel, type AxisFloor, type ChapterContext } from '@/engine/api';
import { chapterWords, journeyFromManifests, journeyRemaining, type JourneyChapter } from '@/hud/journey';
import { layoutJourney } from '@/hud/map/layout';
import type { CustomSpec } from '@/hud/step-ui-types';
import { Button, Label, TEXT_COLOR, UI, UiNode } from '@/ui3d';
import { buildDomInset } from './inset-dom';

export interface JourneyInsetOptions {
  /** Control id (default `journey`); stops are `data-ui="journey-stop:<chapter id>"` (WebGL: `ctl-<id>:<chapter>`). */
  readonly id?: string;
  /** The reader opened a stop (every time, not only the first). */
  readonly onOpen?: (chapterId: string) => void;
}

/** One stop of the inset, in plot coordinates (percent of the plot box, y down). */
export interface InsetStop {
  readonly chapter: JourneyChapter;
  /** «Глава 2», «Пролог», «Практикум». */
  readonly name: string;
  /** The dot's mark: the chapter's number, `0` for the prologue, empty for the practicum (an icon). */
  readonly mark: string;
  /** «один атом · ≈ 10 хв · у планах». */
  readonly meta: string;
  readonly here: boolean;
  readonly x: number;
  readonly y: number;
}

export interface InsetModel {
  readonly summary: string;
  readonly floors: readonly { readonly name: string; readonly y: number }[];
  readonly stops: readonly InsetStop[];
  /** The journey path through the stops, `x,y` pairs for an SVG polyline. */
  readonly path: string;
}

const LAYER_NAME: Readonly<Record<string, string>> = {
  prologue: 'Пролог',
  practicum: 'Практикум',
  branch: 'Гілка',
};

/** The data of the inset (pure over the chapter context: the volume, its chapters, the reader's progress). */
export function insetModel(ctx: ChapterContext): InsetModel {
  const volume = ctx.nav.volume!;
  const journey = journeyFromManifests(volume, ctx.nav.chapters);
  const layout = layoutJourney(journey);
  const visited = ctx.store.get().progress.visited;
  const axis = volume.journey.axis;
  const floorName = (f: AxisFloor): string => floorLabel(volume, f, visited);
  const left = journeyRemaining(visited, journey);
  const words = chapterWords(volume);
  const summary =
    left.minutes !== null
      ? `${left.total} ${plural(left.total, words)} · лишилося ≈${NBSP}${left.minutes}${NBSP}хв`
      : `${journey.chapters.length} ${plural(journey.chapters.length, words)}`;
  // x by journey order (the map's own x), y by the axis (floors), as percent of the plot box
  const xs = layout.spine.map((n) => n.x);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [layout.height(axis.min), layout.height(axis.max)];
  const px = (x: number): number => 4 + (92 * (x - x0)) / Math.max(x1 - x0, 1);
  const py = (y: number): number => 8 + 84 * (1 - (y - y0) / Math.max(y1 - y0, 1));
  let no = 0;
  const stops = layout.spine.map((n): InsetStop => {
    const c = n.chapter;
    const k = c.layer === 'path' ? ++no : 0;
    const f = axis.floors.find((x) => x.label === c.axisLabel);
    const state = c.id === ctx.manifest.id ? 'ви тут' : c.real ? 'готова' : 'у планах';
    const meta = [f ? floorName(f) : c.axisLabel, c.minutes ? `≈${NBSP}${c.minutes}${NBSP}хв` : '', state];
    return {
      chapter: c,
      name: LAYER_NAME[c.layer] ?? `Глава ${k}`,
      mark: c.layer === 'path' ? String(k) : c.layer === 'prologue' ? '0' : '',
      meta: meta.filter(Boolean).join(' · '),
      here: c.id === ctx.manifest.id,
      x: px(n.x),
      y: py(n.y),
    };
  });
  return {
    summary,
    floors: layout.ticks
      .filter((t) => t.major)
      .map((t) => ({ name: t.floor ? floorName(t.floor) : t.label, y: py(layout.height(t.value)) })),
    stops,
    path: stops.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`).join(' '),
  };
}

export function journeyInset(ctx: ChapterContext, opts: JourneyInsetOptions = {}): CustomSpec {
  const id = opts.id ?? 'journey';
  return {
    type: 'custom',
    id,
    node: glInset(ctx, id, opts),
    dom: () => buildDomInset(insetModel(ctx), opts),
  };
}

/** The WebGL / touch-sheet form: numbered stop buttons in a wrapping row, the summary and the card. */
function glInset(ctx: ChapterContext, id: string, opts: JourneyInsetOptions): UiNode {
  const root = new UiNode({ dir: 'col', gap: 10 });
  const kicker = new Label('', { size: UI.text.caption, color: TEXT_COLOR.dim, maxWidth: 520 });
  kicker.visible = false; // until a stop is opened: no empty line between the stops and the prompt
  const title = new Label('Торкніться зупинки, щоб прочитати її питання.', {
    size: UI.text.small,
    maxWidth: 520,
    lineHeight: 1.3,
  });
  {
    const m = insetModel(ctx);
    const buttons = m.stops.map(
      (s) =>
        new Button({
          name: `ctl-${id}:${s.chapter.id}`,
          label: s.mark || 'П',
          size: 'sm',
          variant: s.here ? 'primary' : 'secondary',
          onClick: () => {
            for (const b of buttons) b.selected = b === buttons[m.stops.indexOf(s)];
            kicker.text = `${s.name} · ${s.meta}`.toLocaleUpperCase('uk');
            kicker.visible = true;
            title.text = s.chapter.title;
            opts.onOpen?.(s.chapter.id);
          },
        }),
    );
    root.add(
      new Label(m.summary, { size: UI.text.caption, color: TEXT_COLOR.dim }),
      new UiNode({ dir: 'row', gap: 8, wrap: true, children: buttons }),
      kicker,
      title,
    );
  }
  return root;
}
