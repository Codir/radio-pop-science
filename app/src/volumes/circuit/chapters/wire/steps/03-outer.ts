/**
 * `wire/outer` — «Зовнішній електрон». Inside one atom (depth 2) the reader takes an electron and pulls: a near
 * one barely gives and springs back (`atom.hold` does the physics of the picture), the outer one follows and comes
 * off. Every electron has its own moving pick proxy, so hover rings and grabs are per electron and exact; a drag
 * that starts on an electron never orbits the camera.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { damp } from '@/engine/api';
import { OUTER } from '@circuit/shared/copper/atom';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createHoverRing } from '../parts/ring';

/** A near electron counts as «pulled» once the hand went this far from where it was taken (local units). */
const PULLED = 0.55;
/** Pick radius of a near electron and of the outer one (local units; the layers are 0.27 – 0.84 apart). */
const NEAR_R = 0.17;
const OUTER_R = 0.42;

export const outerStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const { atom } = copper;
  const here = (): boolean => ctx.stage.current === 'outer' && copper.depth > 1.9;
  let hovered = -1;
  const start = new Vector3();
  let pulledFar = false;
  let nearDone = false;
  let resetIn = -1;

  const hand = new Vector3();
  const normal = new Vector3();
  const origin = new Vector3();
  const material = new MeshBasicMaterial({ visible: false });
  const proxies = Array.from({ length: OUTER + 1 }, (_, i) => {
    const proxy = new Mesh(new SphereGeometry(i === OUTER ? OUTER_R : NEAR_R, 10, 6), material);
    proxy.name = `electron-proxy-${i}`;
    copper.space.add(proxy);
    ctx.input.register(proxy, {
      cursor: 'grab',
      enabled: () => here() && !(i === OUTER && atom.freed && nearDone),
      hover: (over) => {
        if (over) hovered = i;
        else if (hovered === i) hovered = -1;
      },
      dragStart: () => {
        atom.electronPosition(i, start);
        pulledFar = false;
        atom.hold(i, start);
      },
      drag: (e) => {
        // the picture plane of the atom in world space: through the mount's origin, facing the reader
        normal.set(0, 0, 1).transformDirection(copper.group.matrixWorld);
        copper.group.getWorldPosition(origin);
        const p = e.planePoint(normal, origin, hand);
        if (!p) return;
        copper.toLocal(p);
        if (p.distanceTo(start) > PULLED) pulledFar = true;
        atom.hold(i, p);
      },
      dragEnd: () => {
        atom.hold(-1);
        if (i !== OUTER && pulledFar) nearDone = true;
      },
    });
    return proxy;
  });
  const ring = createHoverRing(copper.space);
  const ringAt = new Vector3();

  const near = new Vector3();
  const outer = new Vector3();
  const shownNear = (): number =>
    atom.held >= 0 && atom.held !== OUTER ? atom.held : hovered !== OUTER ? hovered : -1;
  const nearAt = (): Vector3 => world.toWorld(atom.electronPosition(Math.max(shownNear(), 0), near), near);
  const outerAt = (): Vector3 => world.toWorld(atom.electronPosition(OUTER, outer), outer);
  ctx.qa.probe('outer-electron', outerAt);
  ctx.qa.probe('near-electron', () => world.toWorld(atom.electronPosition(14, near), near));
  ctx.qa.probe('nucleus-outer', () => copper.heroPosition(near));
  ctx.qa.expose('outer', () => ({ held: atom.held, freed: atom.freed, nearDone }));

  return {
    spec: {
      ...world.state('atom', 1, 'atom'),
      duration: 1.6,
      cameraMove: { duration: 1.6 },
    },
    ui: {
      goal: () => reached('outer'),
      callouts: [
        {
          anchor: nearAt,
          text: caption('outer', 0),
          side: 'left',
          visible: () => here() && shownNear() >= 0,
        },
        {
          anchor: outerAt,
          text: caption('outer', 1),
          side: 'right',
          visible: () => here() && (hovered === OUTER || atom.held === OUTER || atom.freed || nearDone),
        },
      ],
    },
    enter(info) {
      if (info.instant) copper.atom.apart = 0;
      copper.atoms = Infinity;
      copper.marked = -1;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      atom.reset();
      hovered = -1;
      nearDone = pulledFar = false;
      resetIn = -1;
    },
    leave() {
      atom.hold(-1);
      ring.hide();
    },
    update(dt) {
      // from «Розсунути атом» the electrons come back together in the open, never in one frame
      copper.atom.apart = damp(copper.atom.apart, 0, 4, dt);
      for (let i = 0; i <= OUTER; i++) atom.electronPosition(i, proxies[i]!.position);
      const ringed = atom.held >= 0 ? atom.held : here() ? hovered : -1;
      ring.update(
        dt,
        ringed >= 0 ? atom.electronPosition(ringed, ringAt) : null,
        ringed === OUTER ? 0.3 : 0.2,
      );
      if (!here()) return;
      if (nearDone && atom.freed && atom.held < 0 && resetIn < 0) {
        reach('outer');
        resetIn = 2.6;
      }
      // after the takeaway the outer electron comes home: the next step starts from a whole atom
      if (resetIn > 0 && (resetIn -= dt) <= 0) atom.reset();
    },
  };
};
