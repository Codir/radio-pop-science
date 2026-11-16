/**
 * Area `map` of the DOM interface (docs/HUD_DOM.md §16, D5): the full-screen views — a volume's home screen, the
 * library screen and the journey map's chrome (title bar, «Уся подорож», «Закрити», hint, chapter card) — in the
 * `modal` layer. The map's world, node labels, camera and gestures stay WebGL (`JourneyMap`). Each view takes its
 * overlay name through `Hud.domTwin`, so `__ui.open/close/overlay`, `__ui.mapNode`, M, L and Esc work unchanged.
 */
import { JourneyMap } from '@/hud/map/map';
import { viewSources } from '@/hud/views';
import type { DomHud } from '../core/context';
import { twinOf } from '../overlays/twin';
import { domMapChrome } from './chrome';
import { domHome } from './home';
import { domLibrary } from './library';
import './map.css';

export function mount(dom: DomHud): void {
  const { hud } = dom;
  dom.claim('overlay:home');
  dom.claim('overlay:library');
  dom.claim('overlay:map');
  hud.domTwin(
    'home',
    twinOf((gl) => {
      const src = viewSources.get(gl);
      const stage = src?.stage();
      return src?.journey && stage ? domHome(dom, src.journey, stage) : gl;
    }),
  );
  hud.domTwin(
    'library',
    twinOf((gl) => {
      const src = viewSources.get(gl);
      return src ? domLibrary(dom, src.stage) : gl;
    }),
  );
  hud.domTwin(
    'map',
    twinOf((gl) => (gl instanceof JourneyMap ? domMapChrome(dom, gl) : gl)),
  );
}
