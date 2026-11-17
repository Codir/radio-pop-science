/**
 * `charge/neutral` — «Порівну». Through the lens down to «один атом» (the composed world's own door, see README):
 * the copper atom of chapter 1, now with marks — «+» on the nucleus, «−» on every electron, «+29» and «−29» by
 * them. After a moment the camera rises to «ряди» and the crystal thins to two tiny pieces of copper with a gap
 * (`parts/crumbs.ts`); a number over each piece, «разом: 0» between them. The reader carries free electrons
 * across the gap. Goal: ≥ 3 carried (any way); the pieces' numbers were non-zero at least once; «разом» is 0
 * always (by construction: a carried electron leaves one piece as it joins the other).
 */
import { Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { INNER_COUNT } from '@circuit/shared/copper/atom';
import { copperShots } from '@circuit/shared/copper/shots';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createCrumbs } from '../parts/crumbs';
import { createGlyphs } from '../parts/glyphs';

/** Seconds on the atom (marks and numbers) before the camera rises to the two pieces. */
const ON_ATOM = 3.4;
/** How far the pieces' shot stands back from «ряди» and where it looks (lattice units right of the hero). */
const BACK = 1.62;
const LOOK_X = 3.2;

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export const neutralStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const crumbs = createCrumbs(ctx.random.fork('charge-crumbs'));
  copper.space.add(crumbs.group);
  const minus = createGlyphs('minus', INNER_COUNT + 1);
  const plus = createGlyphs('plus', 1 + crumbs.ions.length);
  ctx.root.add(minus.mesh, plus.mesh);
  // the shot of the two pieces: «ряди», stepped back and turned to look at the gap
  world.name('charge-crumbs', () => {
    const rows = copperShots(copper.group, 'tmp-')['tmp-rows']!;
    const o = copper.group.localToWorld(new Vector3(0, 0, 0));
    const d = copper.group.localToWorld(new Vector3(LOOK_X, 0, 0)).sub(o);
    const t = new Vector3(...(rows.target as [number, number, number])).add(d);
    const p = new Vector3(...(rows.position as [number, number, number]))
      .add(d)
      .sub(t)
      .multiplyScalar(BACK)
      .add(t);
    return { ...rows, position: p.toArray(), target: t.toArray(), fit: undefined };
  });
  const here = (): boolean => ctx.stage.current === 'neutral';
  let phase: 'fly' | 'atom' | 'rise' | 'pieces' = 'fly';
  let clock = 0;
  let wasNonZero = false;
  let marks = 0;
  const p = new Vector3();
  const q = new Vector3();
  const normal = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  const scale = new Vector3();
  const toWorld = (local: Vector3): Vector3 => copper.space.localToWorld(local);

  crumbs.electrons.forEach((e, i) => {
    ctx.qa.probe(`crumb-electron-${i}`, () => toWorld(p.copy(e.pos)).clone());
    ctx.input.register(e.pick, {
      cursor: 'grab',
      enabled: () => (here() && phase === 'pieces' && crumbs.shown > 0.95) || crumbs.held === i,
      hover: (over) => (e.hover = over ? 1 : 0),
      drag: (ev) => {
        normal.set(0, 0, 1).transformDirection(copper.space.matrixWorld);
        toWorld(through.set(0, 0, 0.9));
        const at = ev.planePoint(normal, through, hit);
        if (at) crumbs.hold(i, copper.toLocal(at));
      },
      dragEnd: () => crumbs.hold(-1, null),
    });
  });
  ctx.qa.probe('crumb-left', () => toWorld(crumbs.centre(0, p)).clone());
  ctx.qa.probe('crumb-right', () => toWorld(crumbs.centre(1, p)).clone());
  ctx.qa.expose('neutral', () => ({
    phase,
    moved: crumbs.moved,
    left: crumbs.charge(0),
    right: crumbs.charge(1),
    wasNonZero,
  }));

  const above = (piece: 0 | 1 | 'gap', h: number) => (): Vector3 =>
    toWorld(crumbs.centre(piece, q).setY(h)).clone();
  const pieces = (): boolean => here() && phase === 'pieces' && crumbs.shown > 0.9;
  const onAtom = (): boolean => here() && phase === 'atom' && marks > 0.9;
  return {
    spec: { ...world.below(3, 'atom'), duration: 1.8 },
    ui: {
      goal: () => reached('neutral'),
      callouts: [
        {
          anchor: () => toWorld(q.set(0.16, 0.05, 0)).clone(),
          text: caption('neutral', 0),
          side: 'right',
          visible: onAtom,
        },
        {
          anchor: () => toWorld(q.set(-0.92, 0.32, 0)).clone(),
          text: caption('neutral', 1),
          side: 'left',
          visible: onAtom,
        },
        { anchor: above(0, 4.7), text: () => signed(crumbs.charge(0)), side: 'up', visible: pieces },
        { anchor: above(1, 4.7), text: () => signed(crumbs.charge(1)), side: 'up', visible: pieces },
        {
          anchor: above('gap', -5.4),
          text: () =>
            `${caption('neutral', 2)}: ${signed(crumbs.charge(0) + crumbs.charge(1))}${reached('neutral') ? ` — ${caption('neutral', 3)}` : ''}`,
          side: 'down',
          visible: pieces,
        },
      ],
    },
    enter(info: StepInfo) {
      phase = 'fly';
      clock = 0;
      wasNonZero = false;
      copper.atoms = Infinity;
      copper.sim.shared = 1;
      copper.marked = -1;
      copper.hero = 0;
      copper.look.x = copper.look.y = 0;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.atom.reset();
      crumbs.reset();
      if (info.instant) {
        crumbs.shown = 0;
        marks = 0;
      }
    },
    leave() {
      crumbs.hold(-1, null);
      copper.atoms = Infinity;
      copper.look.x = 0;
    },
    update(dt) {
      clock += dt;
      const deep = world.world.deep;
      const flying = world.world.flying;
      if (phase === 'fly' && deep > 2.98 && !flying) {
        phase = 'atom';
        clock = 0;
      } else if (phase === 'atom' && clock > ON_ATOM) {
        phase = 'rise';
        world.world.fly(2, 'charge-crumbs');
      } else if (phase === 'rise' && deep < 2.02 && !flying && !ctx.camera.moving) {
        phase = 'pieces';
        // the crystal thins to the two pieces: its atoms leave from the outside in while the pieces grow
        copper.atoms = 0;
      }
      if (phase === 'pieces' && (crumbs.charge(0) !== 0 || crumbs.charge(1) !== 0)) wasNonZero = true;
      if (!reached('neutral') && crumbs.moved >= 3 && wasNonZero && crumbs.held < 0) reach('neutral');
    },
    tick(dt, t) {
      const on = here();
      // marks on the atom while the reader is on it; the pieces while they are in view
      marks = Math.min(Math.max(marks + (on && phase === 'atom' ? dt : -dt) / 0.6, 0), 1);
      crumbs.shown = Math.min(Math.max(crumbs.shown + (on && phase === 'pieces' ? dt : -dt * 2) / 1.3, 0), 1);
      copper.look.x = on && (phase === 'rise' || phase === 'pieces') ? LOOK_X : 0;
      if (crumbs.group.visible || crumbs.shown > 0) crumbs.update(dt, t);
      minus.shown = marks;
      plus.shown = Math.max(marks, crumbs.shown > 0.75 ? 1 : 0);
      if (marks > 0) {
        copper.space.getWorldScale(scale);
        const s = scale.x;
        for (let i = 0; i <= INNER_COUNT; i++)
          minus.set(i, toWorld(copper.atom.electronPosition(i, p)), s * (i === INNER_COUNT ? 0.26 : 0.2));
        plus.set(0, copper.heroPosition(p), s * 0.24);
      } else plus.set(0, p, 0);
      // «+» on the front atoms of the pieces once they stand alone (the crystal around has no marks)
      const ionMarks = Math.min(Math.max((crumbs.shown - 0.75) / 0.25, 0), 1);
      if (ionMarks > 0) {
        copper.space.getWorldScale(scale);
        crumbs.ions.forEach((c, i) =>
          plus.set(1 + i, toWorld(p.copy(c).setZ(c.z + 1.05)), scale.x * 0.62 * ionMarks),
        );
      }
      plus.count(ionMarks > 0 ? 1 + crumbs.ions.length : 1);
      minus.commit(ctx.camera.camera);
      plus.commit(ctx.camera.camera);
    },
  };
};
