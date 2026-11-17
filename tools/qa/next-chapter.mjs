/* global document, window */
// Shared by chapters' QA scripts and walks across a path volume (B-circuit-build round 3): the border between two
// chapters is two presses of «Далі». On a chapter's last step the first brings its closing card («Що ми тепер
// знаємо», «Місток», «Далі: <next question>») into the step panel — a state of the step, no extra dot; the second
// goes on to the next chapter's first step. `settle(seconds)` advances the clock (a frozen-clock script: its own
// `advance(page, s)`). The volume's last chapter has no next one: only the card is checked there.

const press = (page, sel) =>
  page.evaluate((s) => document.querySelector(s)?.click(), sel);

/** «Далі» on a chapter's last step → its closing card. Returns what the card shows. */
export async function closingCard(page, settle) {
  await press(page, '[data-ui="nav-next"]');
  await settle(1.4);
  return page.evaluate(() => {
    const card = document.querySelector('[data-ui="path-closing"]');
    const on = !!card && !card.closest("[hidden]");
    return {
      shown: on,
      lines: card ? card.querySelectorAll(".path-now li").length : 0,
      bridge: card?.querySelector(".path-bridge")?.textContent ?? "",
      next: card?.querySelector('[data-ui="path-next"]')?.textContent ?? "",
      position: window.__app.position(),
    };
  });
}

/**
 * The whole border: «Далі» → the card, «Далі» again → the next chapter. Returns the card and where it landed
 * (`landed`: `{ chapterId, stepId }`).
 */
export async function nextChapter(page, settle) {
  const card = await closingCard(page, settle);
  await press(page, '[data-ui="nav-next"]');
  await settle(2.5);
  const landed = await page.evaluate(() => window.__app.position());
  return { card, landed };
}
