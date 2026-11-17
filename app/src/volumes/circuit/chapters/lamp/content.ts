/** All reader text comes from the generated runtime content (docs/volumes/circuit/chapters/lamp.md → tools/content). */
import { defineContent } from '@/content';
import raw from '../../content/generated/lamp.json';

const content = defineContent(raw);
export default content;

/**
 * Caption `i` of a step («Підписи» of the script, in their order; `labels` of the runtime content). The scene
 * never types a word of its own: control names, callouts and stage names all come from here.
 */
export function caption(step: string, i: number): string {
  const s = content.steps.find((x) => x.id === step);
  const text = s?.labels?.[i];
  if (text === undefined) throw new Error(`lamp: no caption ${i} in step '${step}'`);
  return text;
}
