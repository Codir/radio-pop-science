/**
 * What the DOM twin of a view (`Hud.domTwin`, `@/hud-dom`) needs to know about the WebGL view it stands in for:
 * the volume's journey and what the full-screen views stand on (its journey map in "attract" mode, or the lobby's
 * bare backdrop). The HUD plugin records it when it builds a view; the WebGL views themselves stay as they are.
 */
import type { HomeStage } from './home';
import type { Journey } from './journey';
import type { Overlay } from './shell';

export interface ViewSource {
  /** Journey of the view's volume (null for the library, which is above the volumes). */
  readonly journey: Journey | null;
  /** The stage of the volume on screen (the library asks each time: it outlives the volumes). */
  readonly stage: () => HomeStage | null;
}

export const viewSources = new WeakMap<Overlay, ViewSource>();
