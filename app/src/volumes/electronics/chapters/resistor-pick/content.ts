/** All reader text comes from the generated runtime content (docs/volumes/electronics/chapters/resistor-pick.md → tools/content). */
import { defineContent } from '@/content';
import raw from '../../content/generated/resistor-pick.json';

const content = defineContent(raw);
export default content;

/**
 * Caption `i` of a step («Підписи» of the script, in their order; `labels` of the runtime content). The scene
 * never types a word of its own: control names, tooltips, callouts, the table's cells and the dock's buttons all come
 * from here.
 */
export function caption(step: string, i: number): string {
  const s = content.steps.find((x) => x.id === step);
  const text = s?.labels?.[i];
  if (text === undefined) throw new Error(`resistor-pick: no caption ${i} in step '${step}'`);
  return text;
}
