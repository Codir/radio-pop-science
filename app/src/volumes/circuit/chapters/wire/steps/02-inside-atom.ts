/**
 * `wire/inside-atom` — «Усередині атома». A flight from the rows into the touched atom (depth 1 → 2); the slider
 * «Розсунути атом» moves the 29 electrons aside and opens the nucleus. The camera follows the slider between the
 * shots `atom` and `apart`, so the nucleus and the moved cloud stay composed at every value.
 */
import { Vector3 } from 'three';
import { damp } from '@/engine/api';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

/** The slider counts as «to the end» from here (a knob let go a hair before the stop still counts). */
const END = 0.97;

export const insideAtomStep: StepFactory = ({ ctx, ui, world, reached, reach }) => {
  const { copper, camera } = { ...world, camera: ctx.camera };
  const here = (): boolean => ctx.stage.current === 'inside-atom';
  let want = 0;
  let framed = 0;
  let follow = false;
  let landed = false;
  /** A drag on the slider: the atom is exactly where the thumb is (UI_API §3.3); otherwise it eases there. */
  let dragging = false;
  let fill = -1;

  const nucleus = new Vector3();
  const cloud = new Vector3();
  // the opened atom is the one the reader touched (`copper.hero`); `atom.*` positions are lattice units
  const nucleusAt = (): Vector3 => copper.heroPosition(nucleus);
  const cloudAt = (): Vector3 => {
    copper.toLocal(copper.heroPosition(cloud)).addScaledVector(copper.atom.aside, copper.atom.apart);
    cloud.y += 1.05;
    return world.toWorld(cloud, cloud);
  };
  const open = (): boolean => reached('inside-atom') && copper.atom.apart > 0.6;
  ctx.qa.probe('nucleus', nucleusAt);
  ctx.qa.expose('inside-atom', () => ({ apart: copper.atom.apart, want }));

  return {
    spec: {
      ...world.state('atom', 1, 'atom'),
      duration: 2,
      ease: 'sine.inOut',
      cameraMove: { duration: 2 },
    },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'apart',
          label: caption('inside-atom', 0),
          value: 0,
          min: 0,
          max: 1,
          step: 0.01,
          format: () => '',
          onChange: (v) => {
            want = v;
            follow = true;
          },
          onInput: (_v, how) => {
            dragging = how === 'drag';
          },
        },
      ],
      goal: () => reached('inside-atom'),
      callouts: [
        { anchor: nucleusAt, text: caption('inside-atom', 1), side: 'up', visible: open },
        { anchor: cloudAt, text: caption('inside-atom', 2), side: 'up', visible: open },
        { anchor: nucleusAt, text: caption('inside-atom', 3), side: 'down', visible: open },
      ],
    },
    enter(info) {
      copper.atoms = Infinity;
      copper.marked = -1;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.atom.reset();
      want = framed = 0;
      follow = landed = dragging = false;
      fill = -1;
      copper.atom.apart = 0;
      if (info.instant) ui.set('apart', 0);
    },
    update(dt) {
      if (!here()) return;
      copper.atom.apart = dragging ? want : damp(copper.atom.apart, want, 5, dt);
      if (Math.abs(copper.atom.apart - fill) > 0.002)
        ui.patch('apart', { current: (fill = copper.atom.apart) });
      // the goal is the picture, not the thumb: the electrons have moved all the way aside
      if (copper.atom.apart >= END) reach('inside-atom');
      // the camera follows the reader's hand once the flight in has landed
      landed ||= !camera.moving;
      if (follow && landed && Math.abs(copper.atom.apart - framed) > 0.015) {
        framed = copper.atom.apart;
        // a drag moves the frame with the hand; an eased change lets the camera ease with it
        world.go(world.between('atom', 'apart', framed), {
          duration: dragging ? 0.12 : 0.45,
          ease: 'power2.out',
        });
      }
    },
  };
};
