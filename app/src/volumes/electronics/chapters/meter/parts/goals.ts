/**
 * The chapter's own goal maths: the check of the player's wave over its seconds (`wave`). The rows, the tally of held
 * states and the run of time in a row are the bench's chapters' own: `@electronics/shared/steps`; how long each state
 * holds is the chapter's `HOLD` (`parts/boards.ts`).
 */

/**
 * The player's wave on the scope over the seconds the probe stood on its row (`wave`): a frame's verdict from how
 * long the run is now (`held`, s), the largest |v| of the last `window` seconds shown (`crest`) and of the whole run
 * so far (`whole`). While the run is shorter than `window` there is nothing to say; from then on every frame's last
 * `window` seconds must reach the crest (in every such stretch the player is heard), and the whole run never reaches
 * the screen's edge. `go` — the run goes on; `broke` — start again; `done` — `need` seconds of it.
 */
export function waveVerdict(
  held: number,
  crest: number | null,
  whole: number | null,
  rules: { need: number; window: number; crest: number; edge: number },
): 'go' | 'broke' | 'done' {
  if (whole !== null && whole > rules.edge) return 'broke';
  if (held < rules.window - 1e-9) return 'go';
  if (crest === null || crest < rules.crest) return 'broke';
  return held >= rules.need - 1e-9 ? 'done' : 'go';
}
