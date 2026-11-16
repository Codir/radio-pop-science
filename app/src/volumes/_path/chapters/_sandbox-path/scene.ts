/** Placeholder scene (the volume’s scene library, shared/): table, wire, lamp; the goal buttons come from the document’s captions. */
import { placeholderScene } from '../../shared/placeholder';
import content from './content';

export default placeholderScene(content, { core: 2, sheath: 1 }, { holdNav: ['core'] });
