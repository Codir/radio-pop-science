import { defineContent } from '@/content';
import { CRAWL_STEPS } from './index';

/** Ukrainian text of the crawl preview: one short paragraph per variant. */
export default defineContent({
  id: '_sandbox-circuit-crawl',
  steps: Object.entries(CRAWL_STEPS).map(([id, s]) => ({ id, title: s.title, panel: [s.body] })),
});
