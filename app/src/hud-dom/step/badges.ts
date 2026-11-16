/**
 * Honesty chips under the step title («сповільнено ×1 000», «не в масштабі» …) from the step's `stepUi`
 * declaration through the shared model (`hud/model/step.ts honestyModel`); `visible` predicates are polled per
 * frame and fade a chip in / out with the WebGL semantics (`bindVisible`).
 */
import { fullChapterId, type ChapterManifest } from '@/engine/api';
import { honestyModel } from '@/hud/model/step';
import { bindingOf, watchBindings } from '@/hud/step-ui';
import { bindVisible, h } from '../core/dom';
import { icon } from '../core/icons';

export interface Badges {
  readonly el: HTMLElement;
  /** Rebuild for a step (null: none). */
  show(manifest: ChapterManifest | null, stepId: string | null): void;
  /** Per frame: the `visible` predicates. */
  update(): void;
}

export function createBadges(): Badges {
  const el = h('ul.badges', { 'aria-label': 'Чесність моделі' });
  el.hidden = true;
  let ticks: (() => void)[] = [];
  let key: [ChapterManifest | null, string | null] = [null, null];
  const build = (): void => {
    const [m, stepId] = key;
    const spec = m && stepId ? bindingOf(fullChapterId(m))?.specs.get(stepId) : undefined;
    const list = honestyModel(spec?.honesty);
    ticks = [];
    el.replaceChildren(
      ...list.map((b) => {
        const li = h('li.chip.honesty', null, icon(b.icon), b.text);
        const tick = bindVisible(li, b.visible);
        if (tick) ticks.push(tick);
        return li;
      }),
    );
    el.hidden = list.length === 0;
  };
  // a chapter may call `define()` after it became active (async scene code)
  watchBindings((id) => {
    if (key[0] && id === fullChapterId(key[0])) build();
  });
  return {
    el,
    show(manifest, stepId) {
      key = [manifest, stepId];
      build();
    },
    update() {
      for (const t of ticks) t();
    },
  };
}
