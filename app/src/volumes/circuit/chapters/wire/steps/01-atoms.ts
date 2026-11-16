/**
 * `wire/atoms` — «Ряди атомів». The reader comes down through the lens to the rows (from the prologue: the whole
 * dive, `world.flyIn`; the wheel «Глибина» moves between the stand, the wire's core and the rows) and touches one
 * ball: it swells, stays lit, and from the takeaway on it carries the caption «атом».
 *
 * Touching is exact and forgiving: every atom of the focal plane in the frame has an invisible proxy ball of
 * 1.5 atom radii (the gap between atoms is split, never a dead zone), hovering swells the atom under the
 * pointer, and until the first touch the middle atom pulses now and then — the invitation to touch.
 */
import { Vector3 } from 'three';
import type { StepUiSpec } from '@/hud';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { atomProxies } from '../parts/proxies';

const INVITE_EVERY = 3.2;

export const atomsStep: StepFactory = ({ ctx, ui, world, reached, reach }) => {
  const { copper } = world;
  const atRows = (): boolean => world.world.deep > 1.99 && world.world.deep < 2.01 && !world.world.flying;
  const here = (): boolean => ctx.stage.current === 'atoms' && atRows();
  let invite = 0;
  let fill = -1;
  /** The depth slider IS the dive (DECISIONS §60 p, UI_API §3.3, as `prologue/dive`): 0 the lens over the wire ·
   *  1 «усередині дроту» · 2 the rows. Names stand as marks; the last one takes the new word at the takeaway. */
  const stopName = (v: number): string =>
    [caption('atoms', 1), caption('atoms', 2), caption('atoms', reached('atoms') ? 4 : 3)][Math.round(v)] ??
    '';

  const choose = (site: number): void => {
    // the chosen ball becomes the hero: the atom the next step opens (nothing moves on this floor)
    copper.hero = site;
    copper.lattice.selected = site;
    copper.lattice.touch(site);
    reach('atoms');
    // the slider's last mark is renamed with the new word: «ряди кульок» → «ряди атомів» (marks are built with
    // the control, so the step's UI is declared again; the slider keeps its value)
    ui.define({ atoms: atomsUi() });
  };
  const proxies = atomProxies(ctx, copper, {
    enabled: here,
    hover: (site) => copper.lattice.touch(site),
    click: choose,
  });

  const anchor = new Vector3();
  const atomAt = (): Vector3 => copper.heroPosition(anchor);
  ctx.qa.probe('atom-hero', () => world.toWorld(copper.lattice.positionOf(0, anchor), anchor));
  ctx.qa.probe('atom-side', () => world.toWorld(copper.lattice.positionOf(proxies.side, anchor), anchor));
  ctx.qa.expose('atoms', () => ({ selected: copper.lattice.selected, hero: copper.hero }));

  const atomsUi = (): StepUiSpec => ({
    reset: true,
    controls: [
      {
        type: 'slider',
        id: 'depth',
        label: caption('atoms', 0),
        min: 0,
        max: 2,
        value: 2,
        step: 0.005,
        marks: [0, 1, 2].map((v) => ({ value: v, label: stopName(v) })),
        format: stopName,
        // the thumb is the target: a drag is followed frame by frame, a click on the track or a key glides there;
        // the track's fill shows where the dive is now (`current`, patched in `update`)
        onChange: (v) => world.world.travelTo(v),
        onInput: (v, how) => {
          if (how === 'drag') world.world.scrub(v);
        },
      },
    ],
    goal: () => reached('atoms'),
    callouts: [
      {
        anchor: atomAt,
        text: caption('atoms', 5),
        side: 'up',
        visible: () => reached('atoms') && copper.lattice.selected >= 0 && atRows(),
      },
    ],
  });

  return {
    spec: {
      ...world.state('rows', 1, 'rows'),
      duration: 2,
      cameraMove: { duration: 2 },
    },
    ui: atomsUi(),
    enter(i) {
      fill = -1;
      ui.set('depth', 2);
      copper.atoms = Infinity;
      copper.sim.shared = 1;
      copper.marked = -1;
      copper.look.x = copper.look.y = 0;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.atom.reset();
      copper.atom.apart = 0;
      // a deep link after the goal shows the hero chosen; a first visit starts with nothing chosen
      if (i.instant) copper.hero = 0;
      copper.lattice.selected = reached('atoms') ? copper.hero : -1;
      invite = 1.2;
    },
    update(dt) {
      if (ctx.stage.current === 'atoms' && Math.abs(world.world.position - fill) > 0.002)
        ui.patch('depth', { current: (fill = world.world.position) });
      if (!here() || copper.lattice.selected >= 0) return;
      invite -= dt;
      if (invite <= 0) {
        invite = INVITE_EVERY;
        copper.lattice.touch(0);
      }
    },
  };
};
