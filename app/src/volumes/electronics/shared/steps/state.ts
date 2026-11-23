/**
 * A part's state in a step's panel: the model's condition (`bench.model.part(id).condition`) as the step's word (its
 * captions: within the limits, hot, bulged …), «—» where the step has none. A capacitor's «warm» is its voltage
 * alone and no warmth (plan decision 2 of batch E4; `parts/look.ts` `shownStatus`): it gets the step's word for «ok»,
 * never a word of warmth, as its look shows no tint. Pure.
 */
import { shownStatus, type PartStatus } from '../parts';

/** What a readout shows with nothing to read. */
const NONE = '—';

export function conditionText(
  spec: string,
  condition: PartStatus | null | undefined,
  words: Readonly<Partial<Record<PartStatus, string>>>,
): string {
  return (condition ? words[shownStatus(spec, condition)] : undefined) ?? NONE;
}
