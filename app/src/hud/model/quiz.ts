/**
 * The chapter quiz as a state machine (docs/HUD_DOM.md §4), for the DOM quiz card (`hud-dom/overlays/quiz.ts`);
 * the rules are those of the WebGL `QuizCard` (`ui3d/widgets/quiz.ts`): one question at a time, the first pick is
 * final (the right option is shown either way), then the explanation and «Далі»; after the last one the score.
 * Which questions: `quizAtLevel` of `@/content` — «Простий квіз» on the simple level when the chapter has one.
 */
import type { QuizItem } from '@/content';

/** Option letters of the WebGL card (а, б, в …). */
export const QUIZ_LETTERS = ['а', 'б', 'в', 'г', 'д', 'е'] as const;

export class QuizRun {
  /** Index of the question on screen; `items.length` = the result. */
  at = 0;
  score = 0;
  /** The option picked for the question on screen (null until answered). */
  picked: number | null = null;
  /** Questions answered so far (progress dots). */
  answered = 0;

  constructor(readonly items: readonly QuizItem[]) {}

  get item(): QuizItem | null {
    return this.items[this.at] ?? null;
  }

  get done(): boolean {
    return this.at >= this.items.length;
  }

  /** Pick an option of the question on screen; returns whether it was right (null when already answered). */
  answer(option: number): boolean | null {
    const item = this.item;
    if (!item || this.picked !== null || option < 0 || option >= item.options.length) return null;
    this.picked = option;
    this.answered = this.at + 1;
    const right = option === item.correct;
    if (right) this.score++;
    return right;
  }

  /** On to the next question (or the result) once the one on screen is answered. */
  next(): void {
    if (this.picked === null || this.done) return;
    this.at++;
    this.picked = null;
  }

  restart(): void {
    this.at = this.score = this.answered = 0;
    this.picked = null;
  }

  /** «Далі» on all but the last question, then «Результат». */
  get nextLabel(): string {
    return this.at + 1 < this.items.length ? 'Далі' : 'Результат';
  }

  /** Result headline (mini-markup) and the line under it. */
  get result(): { headline: string; note: string } {
    const total = this.items.length;
    return {
      headline: `Результат: **${this.score} з ${total}**`,
      note:
        this.score === total
          ? 'Бездоганно! Усі відповіді правильні.'
          : 'Пояснення до кожного питання — у кроках розділу. Можна спробувати ще раз.',
    };
  }
}
