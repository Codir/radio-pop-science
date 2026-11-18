/**
 * Text of the chapter. Panel pages, terms, facts, hotspot texts, glossary and quiz come from the generated
 * export of `docs/volumes/alchemy/chapters/lab.md` — never retyped here. `labels.ts` holds only the scene and
 * control captions that the export does not carry.
 */
import { defineContent } from '@/content';
import raw from '@alchemy/content/generated/lab.json';
import { FLAT_LABELS } from './labels';

const content = defineContent(raw, { labels: FLAT_LABELS });
export default content;
