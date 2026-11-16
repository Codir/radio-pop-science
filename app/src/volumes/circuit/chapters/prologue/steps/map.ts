/**
 * `map` — «Сім питань». The volume's own journey map inside the step (`journeyInset` of the platform, the same
 * nodes, floors and minutes as «Мапа подорожі») on a board over the stand, which stands out of focus behind it.
 * Each stop opens its card with that chapter's question; the goal is every one of the seven chapters opened at
 * least once (the prologue is «ви тут», the practicum may be opened too but does not count).
 */
import type { ChapterContext } from '@/engine/api';
import type { StepUiSpec } from '@/hud';
import { journeyInset } from '@/hud-dom/journey';

export interface MapStep {
  spec: StepUiSpec;
  state(): { opened: number; of: number };
}

export function mapStep(ctx: ChapterContext): MapStep {
  const journey = ctx.nav.volume?.journey;
  const layers = new Map((journey?.groups ?? []).map((g) => [g.id, g.layer]));
  // the seven questions of the path (volume.json): the stops the goal counts
  const chapters = (journey?.planned ?? []).filter((j) => layers.get(j.group) === 'path').map((j) => j.id);
  const opened = new Set<string>();
  const inset = journeyInset(ctx, {
    id: 'map-journey',
    onOpen: (id) => {
      if (chapters.includes(id)) opened.add(id);
    },
  });
  const spec: StepUiSpec = {
    board: { title: 'Мапа тому', size: 'fill', children: [inset] },
    // the opened stops are kept for the session: the goal is "each at least once"
    goal: () => opened.size >= chapters.length,
  };
  return { spec, state: () => ({ opened: opened.size, of: chapters.length }) };
}
