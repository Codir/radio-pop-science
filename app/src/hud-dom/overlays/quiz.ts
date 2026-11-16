/**
 * DOM quiz card (overlay `quiz`, opened by the step panel's «Міні-квіз розділу»; twin of the WebGL `QuizCard`, rules
 * in `hud/model/quiz.ts`): the chapter quiz of the reading level (`quizAtLevel` — «Простий квіз» on the simple
 * level), one question at a time; options are buttons, the first pick is final, the right one is shown either way,
 * then the explanation and «Далі»; the score at the end with «Ще раз» / «Готово». Keyboard: Tab / Enter, or the
 * option's letter (а, б, в …) or number. A path chapter has no quiz (its panel shows no entry). It closes when the chapter
 * or the reading level changes.
 */
import { quizAtLevel } from '@/content';
import { onReadingLevel } from '@/hud/level';
import { QUIZ_TITLE } from '@/hud/model/step';
import { QUIZ_LETTERS, QuizRun } from '@/hud/model/quiz';
import type { DomHud } from '../core/context';
import { h, setClass } from '../core/dom';
import { icon } from '../core/icons';
import { setRich } from '../core/rich';
import { domModal, type DomModal } from './modal';

export function domQuiz(dom: DomHud): DomModal {
  const { hud } = dom;
  const { engine } = hud;
  let run: QuizRun | null = null;
  let options: HTMLButtonElement[] = [];
  const dots = h('ol.ov-quiz-dots', { 'aria-hidden': 'true' });
  const stage = h('div.ov-quiz-stage');

  const btn = (
    label: string,
    iconName: 'next' | 'resetView' | 'check',
    cls: string,
    onClick: () => void,
  ): HTMLButtonElement => {
    const b = h(
      `button.btn.${cls}`,
      { type: 'button' },
      iconName === 'next' ? null : icon(iconName),
      h('span', null, label),
      iconName === 'next' ? icon('next') : null,
    );
    b.addEventListener('click', onClick);
    return b as HTMLButtonElement;
  };

  const show = (): void => {
    if (!run) return;
    const r = run;
    dots.replaceChildren(
      ...r.items.map((_, i) => {
        const d = h('li');
        setClass(d, 'done', i < r.answered);
        setClass(d, 'at', i === r.at);
        return d;
      }),
    );
    const item = r.item;
    if (!item) {
      const res = r.result;
      const head = h('p.ov-quiz-score', { 'data-ui': 'quiz-result' });
      setRich(head, res.headline);
      const again = btn('Ще раз', 'resetView', 'ov-quiz-again', () => {
        r.restart();
        show();
        options[0]?.focus({ preventScroll: true });
      });
      const done = btn('Готово', 'check', 'primary', () => hud.close());
      stage.replaceChildren(head, h('p.ov-quiz-note', null, res.note), h('div.ov-row', null, again, done));
      done.focus({ preventScroll: true });
      return;
    }
    const question = h('p.ov-quiz-q', { id: 'ov-quiz-q' });
    setRich(question, item.question);
    const explain = h('p.ov-quiz-why', { role: 'status', hidden: true });
    const next = btn(r.nextLabel, 'next', 'primary.ov-quiz-next', () => {
      r.next();
      show();
      options[0]?.focus({ preventScroll: true });
    });
    next.dataset.ui = 'quiz-next';
    next.hidden = true;
    options = item.options.map((text, i) => {
      const b = h(
        'button.ov-quiz-opt',
        { type: 'button', 'data-ui': `quiz-option:${i}` },
        h('span.ov-quiz-letter', null, QUIZ_LETTERS[i] ?? String(i + 1)),
        h('span.ov-quiz-text'),
        h('span.ov-quiz-mark', { 'aria-hidden': 'true' }),
      );
      setRich(b.children[1] as HTMLElement, text);
      b.addEventListener('click', () => pick(i, explain, next));
      return b;
    });
    stage.replaceChildren(
      question,
      h('div.ov-quiz-opts', { role: 'group', 'aria-labelledby': 'ov-quiz-q' }, ...options),
      explain,
      next,
    );
  };

  const pick = (i: number, explain: HTMLElement, next: HTMLButtonElement): void => {
    const r = run;
    const item = r?.item;
    if (!r || !item) return;
    const right = r.answer(i);
    if (right === null) return;
    options.forEach((o, k) => {
      o.setAttribute('aria-disabled', 'true');
      const verdict = k === item.correct ? 'right' : k === i ? 'wrong' : '';
      if (verdict) o.classList.add(verdict);
      const mark = o.querySelector<HTMLElement>('.ov-quiz-mark')!;
      if (verdict) mark.replaceWith(icon(verdict === 'right' ? 'check' : 'close', 'ov-quiz-mark'));
      if (k === i)
        o.setAttribute('aria-label', `${right ? 'Правильно' : 'Неправильно'}: ${o.textContent ?? ''}`);
    });
    options[i]!.dataset.sfx = right ? 'success' : 'error';
    if (item.explanation) {
      setRich(explain, `_Пояснення._ ${item.explanation}`);
      explain.hidden = false;
    }
    next.hidden = false;
    setClass(dots.children[r.at] as HTMLElement, 'done', true);
    next.focus({ preventScroll: true });
  };

  const modal = domModal(dom, {
    name: 'quiz',
    title: QUIZ_TITLE,
    icon: 'quiz',
    width: 600,
    build(body) {
      // progress dots between the title and the close button
      modal.panel.querySelector('.ov-close')?.before(dots);
      body.append(stage);
    },
    onOpen() {
      const quiz = quizAtLevel(hud.content, engine.readingLevel());
      run = new QuizRun(quiz?.items ?? []);
      show();
    },
    key(e) {
      // the option's letter (а, б, в …) or its number picks it
      const n = /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : -1;
      const i =
        n >= 0 ? n : QUIZ_LETTERS.indexOf(e.key.toLocaleLowerCase('uk') as (typeof QUIZ_LETTERS)[number]);
      if (i < 0 || !options[i] || run?.picked !== null) return false;
      options[i].click();
      return true;
    },
  });
  // a quiz belongs to the chapter and the level it was opened at
  const drop = (): void => void (hud.overlay === 'quiz' && hud.close());
  engine.runtime.on('chapter', drop);
  onReadingLevel(engine, drop);
  return modal;
}
