/**
 * DOM step panel (WebGL twin `hud/step-panel.ts`): head with «КРОК n / N» and the «Просто | Докладно» switch,
 * step title, paged rich text with its page bar (the last page's «next» goes on to the next
 * step), the sections, «Див. також» and the quiz entry. All copy comes from the shared model
 * (`hud/model/step.ts`) at the reading level in effect (L1's selector).
 *
 * Sizing API for the step column (`fit`, `setCompact`, `chrome`, `want`, units — the WebGL panel's contract,
 * UI_API §3.1): D3's DOM column calls it in its layout pass.
 */
import { fullChapterId, type ChapterManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import { QUIZ_TITLE, STEP_PENDING, stepModel, type StepModel } from '@/hud/model/step';
import { onReadingLevel } from '@/hud/level';
import { pathStepModel } from '@/hud/model/path-step';
import { RecallTrail } from '@/hud/recall';
import { bindingOf } from '@/hud/step-ui';
import type { Hud } from '@/hud/shell';
import { h, scrollArea, setClass, setStyle, setText } from '../core/dom';
import { icon } from '../core/icons';
import { nbDash, prose } from './typo';
import { createLevelSwitch } from './level-switch';
import { buildPathBody, type PathBody } from './path-body';
import { buildDomLinks } from './links';
import { btn, buildDomSections } from './sections';
import { revealIn } from './scroll';

export interface DomStepPanel {
  readonly el: HTMLElement;
  /** The scrolling text (pages + sections + links). */
  readonly scroll: HTMLElement;
  onChapter(m: ChapterManifest): void;
  onContent(c: ChapterContent | null): void;
  onStep(id: string, instant: boolean): void;
  update(): void;
  /** Panel width and the height its scrolling text may take, units (the column decides both). */
  fit(width: number, maxScroll: number): void;
  /** Height of everything but the scrolling text, units (reads layout: call from the layout pass only). */
  chrome(): number;
  /** Height the scrolling text would take unclipped, units (layout pass only). */
  want(): number;
  /** Compact title (smaller type) when the column is short of height. */
  setCompact(on: boolean): void;
  /** Title of the step on screen. */
  readonly stepTitle: string;
  /**
   * Touch shells (D7): the text flows as one scroll (every page shown, no page bar) and the title lives in the
   * sheet's head (`titleHost`); `null` puts the title back and pages the text again.
   */
  setTouch(titleHost: HTMLElement | null): void;
}

export function createDomStepPanel(hud: Hud): DomStepPanel {
  const engine = hud.engine;
  const counter = h('div.kicker.sp-count', { 'aria-hidden': 'true' });
  const level = createLevelSwitch(engine);
  const title = h('h2.sp-title', { id: 'kd-step-title' });
  const pages = h('div.pages');
  const extra = h('div.sp-extra');
  const scroll = scrollArea(
    h('div.sp-scroll', { 'data-ui': 'step-text', tabindex: '0', 'aria-label': 'Текст кроку' }, pages, extra),
  );
  const pageLabel = h('span.page-count');
  const prev = h(
    'button.btn.icon.sm',
    {
      type: 'button',
      'aria-label': 'Попередня сторінка',
      'data-tip': 'Попередня сторінка',
      'data-sfx': 'page',
    },
    icon('prev'),
  );
  const next = h(
    'button.btn.icon.sm',
    {
      type: 'button',
      'aria-label': 'Наступна сторінка',
      'data-tip': 'Наступна сторінка',
      'data-sfx': 'page',
    },
    icon('next'),
  );
  const head = h('div.sp-head', null, counter, level.el);
  const bar = h('nav.pager', { 'aria-label': 'Сторінки тексту' }, prev, pageLabel, next);
  const el = h(
    'section.kd.glass.sp',
    { 'data-ui': 'step-panel', 'aria-labelledby': 'kd-step-title' },
    head,
    title,
    scroll,
    bar,
  );
  let manifest: ChapterManifest | null = null;
  let content: ChapterContent | null = null;
  let stepId: string | null = null;
  let model: StepModel | null = null;
  let page = 0;
  const fade = { o: 1 };
  // path-format chapters (docs/PATH_FORMAT.md): one reader, «Згадайте…» links with a way back, takeaways kept
  // once their goal was reached
  const trail = new RecallTrail(engine.nav);
  const reached = new Set<string>();
  let path: PathBody | null = null;
  /** Touch shells: one scroll, no pages (a path chapter keeps its opening / closing cards as pages). */
  let flow = false;
  // the content held back until the step's condition (stepUi `panel.hiddenUntil`): an empty plate of the same size
  // (visibility, so the column does not re-lay out), then title and text fade in on the engine clock
  let held = false;
  let openKey = '';
  const panelGate = (): void => {
    if (!manifest || !stepId) return;
    const key = `${fullChapterId(manifest)}/${stepId}`;
    if (openKey === key) return;
    const until = bindingOf(fullChapterId(manifest))?.specs.get(stepId)?.panel?.hiddenUntil;
    const root = document.documentElement.classList;
    const go = until === undefined || root.contains('kd-reduced') || (typeof until === 'function' ? until() : until);
    if (!go) {
      if (!held) setClass(el, 'held', (held = true));
      return;
    }
    openKey = key;
    if (!held) return;
    setClass(el, 'held', (held = false));
    if (root.contains('kd-freeze')) return;
    const apply = (): void => {
      const o = fade.o >= 1 ? '' : fade.o.toFixed(3);
      setStyle(scroll, 'opacity', o);
      setStyle(title, 'opacity', o);
    };
    fade.o = 0;
    apply();
    hud.host.tweens.to(fade, { o: 1 }, { duration: 0.7, ease: 'power1.out', onUpdate: apply });
  };

  const showPage = (i: number): void => {
    const list = [...pages.children] as HTMLElement[];
    page = Math.min(Math.max(i, 0), Math.max(list.length - 1, 0));
    const all = flow && path === null;
    list.forEach((p, k) => (p.hidden = !all && k !== page));
    // a path chapter has no pager: its opening card has a button forward and the step a link back
    bar.hidden = list.length < 2 || path !== null || flow;
    setText(pageLabel, `${page + 1} / ${list.length}`);
    prev.disabled = page === 0;
    scroll.scrollTop = 0;
  };
  prev.addEventListener('click', () => showPage(page - 1));
  // like the WebGL pager: «next» on the last page goes on to the next step
  next.addEventListener('click', () => {
    if (page < pages.children.length - 1) showPage(page + 1);
    else void engine.nav.next();
  });

  // the DOM quiz card (overlay `quiz`, `hud-dom/overlays/quiz.ts`)
  const openQuiz = (): void => hud.open('quiz');

  /** A path-format step: its own body instead of the reading levels, the sections and the content chips. */
  const fillPath = (m: ChapterManifest, id: string): boolean => {
    const pm = pathStepModel(m, content, id);
    level.el.hidden = !!pm;
    setClass(el, 'path', !!pm);
    if (!pm) {
      path = null;
      return false;
    }
    const key = `${fullChapterId(m)}/${id}`;
    setText(counter, pm.counter);
    setText(title, nbDash(pm.title));
    const spec = bindingOf(fullChapterId(m))?.specs.get(id);
    const goal = spec?.goal;
    const body = buildPathBody(pm, {
      hud,
      scroll,
      trail,
      goal,
      reached,
      key,
      goPage: (i) => showPage(i),
    });
    // the first step opens on the chapter's opening card unless its goal was reached before (a way back)
    const start = pm.opening && !reached.has(key) ? 0 : pm.opening ? 1 : 0;
    path = body;
    pages.replaceChildren(...body.pages);
    extra.replaceChildren();
    showPage(start);
    return true;
  };

  const fill = (): void => {
    if (!manifest || !stepId) return;
    if (fillPath(manifest, stepId)) return;
    model = stepModel(manifest, content, stepId, engine.readingLevel());
    if (!model) return;
    setText(counter, model.counter);
    setText(title, nbDash(model.title));
    level.sync(engine.readingLevel(), model.hasSimple);
    pages.replaceChildren(...model.pages.map((t) => prose('p', 'page', t)));
    const parts: HTMLElement[] = [];
    const sections = model.copy
      ? buildDomSections(
          model.copy,
          (name) => hud.open('glossary', name),
          (t, keep) => revealIn(scroll, t, keep),
        )
      : null;
    if (sections) parts.push(sections);
    const links = buildDomLinks(hud, content, manifest, model.index);
    if (links) parts.push(links);
    if (model.quiz) {
      const quiz = btn(QUIZ_TITLE, 'quiz', 'primary', openQuiz);
      quiz.dataset.ui = 'chapter-quiz';
      parts.push(quiz);
    }
    if (model.pending) parts.push(h('p.pending', null, STEP_PENDING));
    extra.replaceChildren(...parts);
    showPage(0);
  };
  // the text grows or shrinks (a section opens, a term card, a page): the column re-runs its height budget
  const grow = new ResizeObserver(() => hud.relayout());
  grow.observe(pages);
  grow.observe(extra);
  // «Просто / Докладно» switched (here, in the settings or the end of a `?level=` pin): the open step re-renders
  onReadingLevel(engine, fill);

  const k = (): number => hud.metrics.pxPerUnit;
  const gapOf = (): number => parseFloat(getComputedStyle(scroll).rowGap) || 0;
  return {
    el,
    scroll,
    onChapter(m) {
      manifest = m;
      stepId = engine.store.get().stepId ?? m.steps[0]!.id;
    },
    onContent(c) {
      content = c;
      fill();
    },
    onStep(id, instant) {
      trail.onStep(engine.nav.position);
      if (id === stepId && pages.children.length > 0) return;
      stepId = id;
      openKey = '';
      if (instant) return fill();
      // the page-turn dip of the WebGL panel, on the engine clock (deterministic under ?freeze)
      const tweens = hud.host.tweens;
      const apply = (): void => {
        const o = fade.o >= 1 ? '' : fade.o.toFixed(3);
        setStyle(scroll, 'opacity', o);
        setStyle(title, 'opacity', o);
      };
      tweens.to(fade, { o: 0 }, { duration: 0.12, ease: 'power2.in', onUpdate: apply, onComplete: () => {
        fill();
        tweens.to(fade, { o: 1 }, { duration: 0.3, ease: 'power2.out', onUpdate: apply });
      } }); // prettier-ignore
    },
    update: () => {
      panelGate();
      path?.tick(held);
    },
    fit(width, maxScroll) {
      setStyle(el, 'width', `calc(${width.toFixed(2)} * var(--u))`);
      setStyle(scroll, 'max-height', `calc(${Math.max(maxScroll, 60).toFixed(2)} * var(--u))`);
    },
    chrome: () => (el.offsetHeight - scroll.offsetHeight) / k(),
    want() {
      // the content's own height (the scroll area's box is clamped between 60 units and its max-height)
      const parts = [pages, extra].filter((p) => p.offsetHeight > 0);
      const sum = parts.reduce((s, p) => s + p.offsetHeight, 0) + gapOf() * Math.max(parts.length - 1, 0);
      return sum / k();
    },
    setCompact: (on) => setClass(title, 'compact', on),
    get stepTitle() {
      return path ? (title.textContent ?? '') : (model?.title ?? '');
    },
    setTouch(titleHost) {
      if (titleHost) titleHost.append(title);
      else if (title.parentElement !== el) head.after(title);
      if (flow === (titleHost !== null)) return;
      flow = titleHost !== null;
      showPage(page);
    },
  };
}
