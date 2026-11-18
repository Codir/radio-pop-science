/**
 * Body of the DOM step panel for a path-format chapter (docs/PATH_FORMAT.md; model `hud/model/path-step.ts`):
 * one reader — no «Просто | Докладно», no section tabs. Pages of the panel's pager:
 *   first step: the chapter's opening card («Питання з життя», «Що ми вже знаємо») → the step;
 *   every step: main text (new terms are links to their glossary cards), the action, hints for a stuck reader,
 *     the takeaway once the step's goal is reached, «Згадайте…» links, one disclosure
 *     «Докладніше» (no honesty chips or «Чесно про картинку» — DECISIONS §60 x);
 *   last step: the step → the closing card («Що ми тепер знаємо», the bridge, «Далі: <next question>»).
 * Everything is real text (selectable, read by screen readers); reveals run on the engine clock.
 */
import type { Position } from '@/engine/api';
import { hintsDue, PATH_LABELS as L, type PathStepModel } from '@/hud/model/path-step';
import type { RecallTrail } from '@/hud/recall';
import type { Hud } from '@/hud/shell';
import type { When } from '@/hud/step-ui-types';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { btn } from './sections';
import { revealIn } from './scroll';
import { nbDash, prose } from './typo';

export interface PathBodyContext {
  readonly hud: Hud;
  /** The panel's scrolling text (an opened block is scrolled into view inside it). */
  readonly scroll: HTMLElement;
  readonly trail: RecallTrail;
  /** The step's goal from its `stepUi` (undefined: the takeaway shows at once). */
  readonly goal: When | undefined;
  /** Goals already reached this session (`volume/chapter/step`): the takeaway shows at once there. */
  readonly reached: Set<string>;
  readonly key: string;
  /** Show page `i` of the panel's pager (`smooth`: a calm cross-fade of the panel's text). */
  readonly goPage: (i: number, smooth?: boolean) => void;
  /** The last step: the closing card takes the panel each time this starts to hold (stepUi `panel.closingWhen`). */
  readonly closingWhen?: When;
}

export interface PathBody {
  readonly pages: readonly HTMLElement[];
  /** Per frame: the goal, the hints, the way back of a «Згадайте» link. `held`: the panel's content is held back
   * (stepUi `panel.hiddenUntil`) — the hint timers start when it appears. */
  tick(held?: boolean): void;
}

const holds = (w: When | undefined): boolean => (typeof w === 'function' ? w() : w !== false);

/** Rich text whose bold spans are the step's new terms: each becomes a link to its glossary card. */
function withTerms(el: HTMLElement, m: PathStepModel, hud: Hud): HTMLElement {
  for (const strong of [...el.querySelectorAll('strong')]) {
    const term = m.terms.find((t) => t.text === strong.textContent);
    if (!term) continue;
    const link = h(
      'button.term-link',
      {
        type: 'button',
        'data-tip': term.definition || 'Картка в глосарії',
        'aria-label': `${term.text} — картка терміна`,
      },
      term.text,
    );
    link.addEventListener('click', () => hud.open('glossary', term.name));
    strong.replaceWith(link);
  }
  return el;
}

function block(
  cls: string,
  kicker: string,
  ic: Parameters<typeof icon>[0] | null,
  ...body: (Node | null)[]
): HTMLElement {
  return h(`div.${cls}`, null, h('div.kicker', null, ic ? icon(ic) : null, kicker), ...body);
}

function openingPage(m: PathStepModel, go: () => void): HTMLElement | null {
  if (!m.opening) return null;
  return h(
    'div.page.path-card.opening',
    { 'data-ui': 'path-opening' },
    block('path-sec', L.hook, null, prose('p', 'path-p', m.opening.hook)),
    m.opening.know ? block('path-sec', L.know, null, prose('p', 'path-p', m.opening.know)) : null,
    btn(L.start, 'arrowRight', 'primary', go),
  );
}

function closingPage(m: PathStepModel, hud: Hud, back: () => void): HTMLElement | null {
  if (!m.closing) return null;
  const { now, bridge, next, restart } = m.closing;
  // the way back to the step the card stands over (also the navigator's «back», ← — `pathEnd.back`)
  const toStep = btn(`${L.back}: ${m.title}`, 'arrowLeft', 'ghost sm', back);
  toStep.dataset.ui = 'path-closing-back';
  // the end of a volume's journey: the journey map, where every chapter can be opened again
  const map = next ? null : btn(L.map, 'map', 'primary', () => hud.open('map'));
  if (map) map.dataset.ui = 'path-map';
  // … and the way back to its very first step (the volume's first chapter in journey order)
  const first = hud.engine.nav.chapters[0];
  const again =
    !next && restart && first
      ? btn(restart, 'arrowLeft', 'ghost', () => void hud.engine.nav.goto(first.id, first.steps[0]?.id))
      : null;
  if (again) again.dataset.ui = 'path-restart';
  const built = next ? hud.engine.nav.chapter(next.id) : undefined;
  const go = next
    ? btn(`${L.next}: ${next.title}`, 'next', 'primary', () => void hud.engine.nav.goto(next.id))
    : null;
  if (go) {
    go.dataset.ui = 'path-next';
    go.disabled = !built;
    if (!built) go.dataset.tip = 'Ця глава ще готується';
  }
  return h(
    'div.page.path-card.closing',
    { 'data-ui': 'path-closing' },
    toStep,
    now.length
      ? block('path-sec', L.now, null, h('ol.path-now', null, ...now.map((t) => prose('li', '', t))))
      : null,
    bridge ? prose('p', 'path-p path-bridge', bridge) : null,
    go ?? h('p.path-end', null, L.end),
    map || again ? h('div.path-actions', null, map, again) : null,
  );
}

/** Title of the step the way back leads to («Мідна жила»), from the registered chapter manifests. */
function stepTitle(hud: Hud, p: Position): string {
  return (
    hud.engine.nav.chapter(`${p.volumeId}/${p.chapterId}`)?.steps.find((s) => s.id === p.stepId)?.title ?? ''
  );
}

export function buildPathBody(m: PathStepModel, ctx: PathBodyContext): PathBody {
  const { hud, scroll, trail } = ctx;
  const back = btn('', 'arrowLeft', 'ghost sm', () => void trail.back());
  back.dataset.ui = 'path-back';
  back.hidden = true;
  const text = h(
    'div.path-text',
    null,
    ...m.paragraphs.map((t) => withTerms(prose('p', 'path-p', t), m, hud)),
  );
  const action = h(
    'div.path-action',
    { 'data-ui': 'path-action' },
    icon('hand'),
    h('div', null, h('div.kicker', null, L.action), prose('p', 'path-p', m.action)),
  );
  const hint = h('p.path-hint', { 'aria-live': 'polite', 'data-ui': 'path-hint' });
  hint.hidden = true;
  const takeaway = block(
    'path-takeaway',
    L.takeaway,
    'check',
    withTerms(prose('p', 'path-p', m.takeaway), m, hud),
  );
  takeaway.dataset.ui = 'path-takeaway';
  takeaway.hidden = true;
  const recall = m.recall.length
    ? h('div.path-recall', null, ...m.recall.map((r) => {
        const b = btn(`${L.recall}: ${r.title || r.target}`, 'link', 'ghost sm', () => void trail.follow(r.target));
        b.dataset.ui = 'path-recall';
        return b;
      })) // prettier-ignore
    : null;
  let more: HTMLElement | null = null;
  if (m.more.length) {
    const body = h(
      'div.path-more-body',
      { id: `kd-more-${ctx.key.replace(/[^\w-]/g, '-')}` },
      ...m.more.map((t) => prose('p', 'path-p', t)),
    );
    body.hidden = true;
    const p = presence(body);
    const toggle = btn(L.more, 'chevronDown', 'ghost sm', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        p.reveal({ dy: 8, scale: 1 });
        revealIn(scroll, body, toggle);
      } else p.conceal({ dy: 6, scale: 1 });
    });
    toggle.classList.add('path-more-toggle');
    toggle.dataset.ui = 'path-more';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', body.id);
    more = h('div.path-more', null, toggle, body);
  }
  // the first step: a plain way back to the chapter's opening card (there is no pager in a path chapter)
  const toCard = m.opening ? btn(L.hook, 'arrowLeft', 'ghost sm', () => ctx.goPage(0)) : null;
  if (toCard) toCard.dataset.ui = 'path-to-card';
  const main = h(
    'div.page.path-main',
    { 'data-ui': 'path-step' },
    toCard,
    back,
    text,
    action,
    hint,
    takeaway,
    recall,
    more,
  );
  const opening = openingPage(m, () => ctx.goPage(1));
  const closing = closingPage(m, hud, () => ctx.goPage(opening ? 1 : 0, true));
  const pages = [opening, main, closing].filter((p): p is HTMLElement => p !== null);
  /** `closingWhen` held last frame (the card comes on its rising edge only). */
  let ending = holds(ctx.closingWhen ?? false);

  const clock = hud.engine.clock;
  let entered = clock.time;
  let shown = 0;
  let done = false;
  const reveal = (): void => {
    done = true;
    ctx.reached.add(ctx.key);
    hint.hidden = true;
    presence(takeaway).reveal({ dy: 8, scale: 1 });
    if (!main.hidden) revealIn(scroll, takeaway, text);
  };
  if (ctx.reached.has(ctx.key) || ctx.goal === undefined) {
    done = true;
    takeaway.hidden = false;
  }
  return {
    pages,
    tick(held = false) {
      if (held) {
        entered = clock.time;
        return;
      }
      const origin = trail.returnTo;
      const away = !!origin && `${origin.volumeId}/${origin.chapterId}/${origin.stepId}` !== ctx.key;
      if (away !== !back.hidden) {
        back.hidden = !away;
        if (away) back.querySelector('span')!.textContent = `${L.back}: ${stepTitle(hud, origin!)}`;
      }
      if (closing && ctx.closingWhen !== undefined) {
        const now = holds(ctx.closingWhen);
        if (now && !ending) ctx.goPage(pages.length - 1, true);
        ending = now;
      }
      if (done) return;
      if (holds(ctx.goal)) return reveal();
      const due = hintsDue(m.hints, clock.time - entered);
      if (due > shown) {
        shown = due;
        hint.replaceChildren(h('span.kicker', null, icon('info'), L.hint), ' ', nbDash(m.hints[due - 1]!));
        if (hint.hidden) presence(hint).reveal({ dy: 6, scale: 1 });
      }
    },
  };
}
