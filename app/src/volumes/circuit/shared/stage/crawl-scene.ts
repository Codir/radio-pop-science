/**
 * The crawl as ONE entry for a chapter (DECISIONS §60 t — the scene of `prologue/riddle`, later `flow/snail`):
 * the snail creeping along the wire from the battery's minus toward the lamp, the magnifier lying on the start of
 * that wire as a plain magnifier with the spark's millimetre scale inside, and the lamp — all placed by one
 * number, seconds of true time.
 *
 *   const crawl = stand.crawlScene;
 *   enterStep: id === 'riddle' ? crawl.show(info.instant) : crawl.hide(info.instant);
 *   slider:    min 0, max crawl.duration → onChange / update: crawl.time = seconds;   // nothing else
 *
 * While it is shown the lamp and the switch follow the time (on as soon as it is above 0, in that very frame)
 * and the scene keeps the magnifier; after `hide()` both follow the stand's own `closed` and `lens` again.
 */
import { Object3D } from 'three';
import type { Tools } from './tools';

/** Seconds of the arrival and of the leaving — each one motion (lens → ticks → snail → numbers), no pop. */
export const CRAWL_SECONDS = { in: 2.0, out: 1.5 } as const;

export interface CrawlAnchors {
  /** Just above the snail's shell. */
  snail: Object3D;
  /** Centre of the magnifier's glass, and the four points just outside its ring as the reader sees them. */
  lens: Object3D;
  lensTop: Object3D;
  lensBottom: Object3D;
  lensLeft: Object3D;
  lensRight: Object3D;
  /** In the magnifier: the point on the scale the marked spark has really reached, and the scale's last tick. */
  mark: Object3D;
  scaleEnd: Object3D;
}

export interface CrawlScene {
  /** Seconds of true time for the snail's whole way (136.4), that way in centimetres, the spark's in millimetres. */
  readonly duration: number;
  readonly lengthCm: number;
  readonly scaleMm: number;
  /** THE number: seconds of true time, 0 … `duration` (clamped). Every frame is a function of it, both ways. */
  time: number;
  /** Bring the scene in / take it out as one motion (`CRAWL_SECONDS`); `instant` for deep links. */
  show(instant?: boolean): void;
  hide(instant?: boolean): void;
  /** Asked to be shown (after `show`, until `hide`). */
  readonly shown: boolean;
  /** 0 away … 1 fully in place; `ready` = shown and in place (the moment for captions and for the slider). */
  readonly presence: number;
  readonly ready: boolean;
  /** Where the two are now: the snail's way in centimetres, the marked spark's net advance in millimetres. */
  readonly snailCm: number;
  readonly sparkMm: number;
  /** Places for captions (`getWorldPosition`); valid while the scene is in place. */
  anchors: CrawlAnchors;
}

/** What the stage needs besides the public part. */
export interface CrawlSceneDriver extends CrawlScene {
  /** The lamp's switch as the scene wants it (0 / 1), or `null` when the scene is not shown. */
  closed(): number | null;
  /** Advance the arrival / leaving and write the scene's state into `target`. */
  update(dt: number, target: { crawl: number; crawlShown: number; loupe: number }): void;
}

export function createCrawlScene(tools: Tools): CrawlSceneDriver {
  const { crawl, loupe, snail, lens } = tools;
  const state = { on: false, presence: 0, time: 0, held: false };
  const above = new Object3D();
  above.name = 'crawl:snail-anchor';
  above.position.set(0, 0.72, 0);
  snail.group.add(above);
  return {
    duration: crawl.duration,
    lengthCm: crawl.lengthCm,
    scaleMm: crawl.scaleMm,
    get time() {
      return state.time;
    },
    set time(seconds: number) {
      state.time = Math.min(Math.max(seconds, 0), crawl.duration);
    },
    show(instant = false) {
      state.on = true;
      if (instant) state.presence = 1;
    },
    hide(instant = false) {
      state.on = false;
      if (instant) state.presence = 0;
    },
    get shown() {
      return state.on;
    },
    get presence() {
      return state.presence;
    },
    get ready() {
      return state.on && state.presence >= 1;
    },
    get snailCm() {
      return crawl.snailCmAt(state.time);
    },
    get sparkMm() {
      return crawl.sparkMmAt(state.time);
    },
    anchors: { snail: above, lens: lens.glass, ...loupe.anchors },
    closed: () => (state.on ? (state.time > 0 ? 1 : 0) : null),
    update(dt, target) {
      const to = state.on ? 1 : 0;
      const step = dt / (state.on ? CRAWL_SECONDS.in : CRAWL_SECONDS.out);
      if (to > state.presence) state.presence = Math.min(state.presence + step, 1);
      else if (to < state.presence) state.presence = Math.max(state.presence - step, 0);
      // the scene owns the stand's crawl fields only while it is about; afterwards they are the chapter's again
      // (a showcase may drive them directly)
      if (state.on || state.presence > 0 || state.held) {
        state.held = state.on || state.presence > 0;
        target.crawl = state.time;
        target.crawlShown = state.presence;
        target.loupe = state.held ? 1 : 0;
      }
    },
  };
}
