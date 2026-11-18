/**
 * `bumps` — «Розгін і удар». The lens lies on the near wire and carries the camera through the ring to the rows in
 * one motion (the chapter's entry, `stand.diveIn`); the circuit is closed, the crowd shares the common shift. The
 * reader taps a free electron: it gets the white ring and the long path, and from then the field speeds it up
 * toward the plus (its path bends) until it runs into an atom — the path breaks, the atom flashes `orange` and
 * trembles, the trembling runs on to two neighbours, and the run starts again slowly (`shared/copper/run.ts`,
 * `hits.ts`). Goal: five hits after the marking (≈ 3 s).
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { electronProxies } from '../parts/electron-proxies';
import { createHoverRing } from '../parts/ring';

/** Hits after the marking that make the goal (script: «щонайменше п’яти ударів»). */
const ENOUGH = 5;
/** The field's pull on the marked electron (units/s²) and its speed after a hit (units/s): 1–2 hits a second. */
export const FIELD = 9;
export const RESTART = 6.5;
/** The marked electron's path keeps a point every 3° of a bend (the run curves toward the plus). */
const BEND = (3 * Math.PI) / 180;
/** The crowd darts about homes that slide with the common shift (as in `flow`), here on the rows floor. */
const LEASH = 2.4;
/** The focus electrons' box on the rows floor (the library's default). */
const BOX = [15.5, 8.6] as const;
/** Seconds the caption «удар» stays at the first hit after the marking. */
const HIT_LABEL = 2;
/**
 * «Назад» (or any step) from the stand down to the rows, at the pace of the entry dive (2.8 s): the camera to the
 * lens over the wire, then the rail through the ring to the rows.
 */
const DOWN = { lens: 0.9, rail: 1.9 } as const;
/** The marked electron's label shows only while it is below this height (local units; clear of the top). */
const LABEL_BELOW = 4.2;

export const bumpsStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { copper, hits, world } = stand;
  const { sim } = copper;
  const ready = (): boolean =>
    here('bumps') && down === null && !world.flying && Math.abs(copper.depth - 1) < 0.02;
  const mark = (e: number): void => {
    copper.marked = e;
    sim.field = FIELD;
    hits.reset();
  };
  const proxies = electronProxies(ctx, copper, { enabled: () => ready() && copper.marked < 0, click: mark });
  const ring = createHoverRing(copper.space);
  const at = new Vector3();
  const hitAt = new Vector3();
  const local = (e: number, out: Vector3): Vector3 =>
    out.set(sim.pos[3 * e]!, sim.pos[3 * e + 1]!, sim.pos[3 * e + 2]!);
  const toWorld = (p: Vector3): Vector3 => copper.space.localToWorld(p);
  /** The first hit after the marking (the label «удар» stands there for a while). */
  let first: { at: Vector3; time: number } | null = null;
  /** Where the hit that made the goal happened (the label «опір»). */
  let goalAt: Vector3 | null = null;
  /** The way down from the stand: 'start' on the first frame (after the world planned its own flight), then the
   *  seconds left of the camera's move to the lens before the rail takes over. */
  let down: 'start' | number | null = null;

  ctx.qa.probe('free-electron', () =>
    toWorld(local(Math.max(proxies.nearest(copper.look.x, copper.look.y), 0), at)),
  );
  ctx.qa.expose('bumps', () => ({
    hovered: proxies.hovered,
    marked: copper.marked,
    hits: hits.marked,
    total: hits.total,
    rate: Math.round(hits.rate * 10) / 10,
    speed: Math.round(sim.runSpeed * 10) / 10,
  }));

  return {
    spec: { camera: 'copper-rows', params: { deep: 2, closed: 1, lens: 1, poles: 1 } },
    ui: {
      goal: () => reached('bumps'),
      callouts: [
        {
          anchor: () => toWorld(local(Math.max(copper.marked, 0), at)),
          text: caption('bumps', 0),
          side: 'down',
          visible: () =>
            here('bumps') &&
            copper.marked >= 0 &&
            !reached('bumps') &&
            first === null &&
            sim.pos[3 * copper.marked + 1]! < LABEL_BELOW,
        },
        {
          anchor: () => toWorld(hitAt.copy(first?.at ?? hitAt)),
          text: caption('bumps', 1),
          side: 'up',
          visible: () => here('bumps') && first !== null && hits.time - first.time < HIT_LABEL,
        },
        {
          anchor: () => toWorld(hitAt.copy(goalAt ?? hitAt)),
          text: caption('bumps', 2),
          side: 'up',
          visible: () => here('bumps') && reached('bumps') && goalAt !== null,
        },
      ],
    },
    enter(info) {
      down = !info.instant && info.from !== null && world.deep < 0.01 ? 'start' : null;
      stand.thermoShown.go(0, info.instant ? 0 : 0.6);
      stand.heat.target = 0;
      world.lensPose = null;
      // the crowd fills the whole frame of the rows again (the window's small box is for the lens on the stand)
      sim.box.x = BOX[0];
      sim.box.y = BOX[1];
      copper.atoms = Infinity;
      sim.shared = 1;
      copper.lattice.selected = -1;
      copper.hero = 0;
      copper.look.x = copper.look.y = 0;
      copper.marked = -1;
      sim.field = 0;
      sim.restart = RESTART;
      sim.leash = LEASH;
      copper.electrons.bend = BEND;
      hits.flashRate = 0;
      first = null;
      goalAt = null;
    },
    leave() {
      ring.hide();
      copper.marked = -1;
      sim.field = 0;
      copper.electrons.bend = 0;
    },
    update(dt) {
      if (down === 'start') {
        world.release();
        ctx.camera.go('lens', { duration: DOWN.lens, ease: 'power2.inOut' });
        down = DOWN.lens;
      } else if (typeof down === 'number' && (down -= dt) <= 0) {
        down = null;
        world.travelTo(2, DOWN.rail);
      }
      proxies.update();
      const e = ready() && copper.marked < 0 ? proxies.hovered : -1;
      ring.update(dt, e >= 0 ? local(e, at) : null, 0.42);
      if (!here('bumps') || copper.marked < 0) return;
      const last = hits.last;
      if (last && first === null) first = { at: last.at.clone(), time: last.time };
      if (hits.marked >= ENOUGH && !reached('bumps')) {
        reach('bumps');
        goalAt = last ? last.at.clone() : local(copper.marked, new Vector3());
      }
    },
  };
};
