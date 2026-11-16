/**
 * The stage of a home screen whose volume has no chapters yet (the lobby, docs/VOLUMES.md §3): the journey
 * map's deep-space backdrop alone — no path, no ruler, no floor grid, nothing that would read as an empty map.
 * Like the map in "attract" mode it hides whatever chapter is still loaded underneath (and stops rendering its
 * world once the backdrop is opaque).
 */
import { Backdrop } from './map/backdrop';
import type { HomeStage } from './home';
import type { Hud } from './shell';

export class BackdropStage implements HomeStage {
  /** 0…1 presence (animated). */
  presence = 0;
  private readonly backdrop = new Backdrop();
  private shown = false;
  private suspending = false;

  constructor(private readonly hud: Hud) {
    const engine = hud.engine;
    this.backdrop.userData.hudView = true; // not chapter-owned: never hidden by the shell
    engine.hud.root.add(this.backdrop);
    const place = (): void => this.backdrop.resize(hud.metrics.width, hud.metrics.height);
    engine.hud.onResize(place);
    place();
    engine.onUpdate(() => this.update());
  }

  setAttract(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    // the scene must render again before the fade-out starts to reveal it
    if (!on) this.suspend(false);
    const reduced = this.hud.engine.reducedMotion;
    this.hud.host.tweens.to(
      this as BackdropStage,
      { presence: on ? 1 : 0 },
      { duration: reduced ? 0.12 : on ? 0.5 : 0.3, ease: on ? 'power2.out' : 'power2.in' },
    );
  }

  private update(): void {
    this.backdrop.opacity = this.presence;
    if (this.shown && this.presence >= 0.999) this.suspend(true);
  }

  private suspend(on: boolean): void {
    if (on === this.suspending) return;
    this.suspending = on;
    this.hud.engine.runtime.suspendWorld(on);
  }
}
