/**
 * The path format's closing card as the interface shows it right now (docs/PATH_FORMAT.md, «Що ми тепер знаємо»,
 * «Місток»): a state of a chapter's last step, reached by «Далі» there (or a step's `panel.closingWhen`). The step
 * panel writes it; the navigator and the keys read it; a chapter may read it (the dock fades while it stands).
 */
export const pathEnd = {
  /** The closing card is the panel's page now. */
  shown: false,
  /** While it is: the way back to the step (the navigator's «back», ← and PageUp take it before the previous step). */
  back: null as (() => void) | null,
  /**
   * On a chapter's last step while the card is not shown: the way to it (the navigator's «Далі», → and PageDown
   * bring the card first; from the card «Далі» goes on to the next chapter).
   */
  forward: null as (() => void) | null,
};
