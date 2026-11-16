/** Placeholder scene (the volume’s scene library, shared/): table, wire, lamp; the goal buttons come from the document’s captions. */
import { placeholderScene } from '../../shared/placeholder';
import content from './content';

export default placeholderScene(
  content,
  { drift: 1, same: 1 },
  { scrub: { drift: { label: 1, marks: [2, 3, 4] } } },
);
