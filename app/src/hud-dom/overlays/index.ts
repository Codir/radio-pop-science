/**
 * Area `overlays` of the DOM interface (docs/HUD_DOM.md §16, D5): the modal overlays settings, help, glossary
 * (one per volume, like the WebGL ones) and the chapter quiz, in the `modal` layer. Each takes its overlay name
 * through `Hud.domTwin` — `__ui.open/close/overlay`, the system buttons and the keys keep working unchanged.
 */
import { viewSources } from '@/hud/views';
import type { DomHud } from '../core/context';
import { uiSounds } from '../chrome/sounds';
import { domGlossary } from './glossary';
import { domHelp } from './help';
import { domQuiz } from './quiz';
import { domSettings } from './settings';
import { twinOf } from './twin';
import './overlays.css';

export function mount(dom: DomHud): void {
  const { hud } = dom;
  dom.claim('overlay:settings');
  dom.claim('overlay:help');
  dom.claim('overlay:glossary');
  dom.claim('overlay:quiz');
  // safe-area insets (`--safe-top/right/bottom/left`) and the keyboard (`--kb`) live on `#kd-hud` (hud-dom/touch)
  uiSounds(dom.layers.modal);
  const settings = domSettings(dom);
  const help = domHelp(dom);
  hud.domTwin('settings', () => settings);
  hud.domTwin('help', () => help);
  hud.domTwin(
    'glossary',
    twinOf((gl) => {
      const journey = viewSources.get(gl)?.journey;
      return journey ? domGlossary(dom, journey) : gl;
    }),
  );
  hud.register('quiz', domQuiz(dom));
}
