/**
 * `lamp/inside` — «Усередині лампочки». The switch opens by itself on entry; the lamp is dark, the coil reads turn
 * by turn. The dock slider «Глибина» IS the way in (DECISIONS §60 p, `parts/door.ts`): 0 «стенд» · ⅓ the lens on
 * the glass · 1 «усередині лампочки» (the base opened, the rim arcs in the corners). Down there a light mark waits
 * on the bottom contact; the reader drags it along the current's way to the thread (`parts/path-marker.ts`).
 * Names of the parts on hover / long press; «нитка розжарення» appears over the coil at the takeaway.
 * Goal: the slider at its end and the mark brought to the thread.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { LampAnchor } from '@circuit/shared/stage';
import { STAGE_POST } from '@circuit/shared/stage';
import { LENS_LEG } from '@circuit/shared/world/dive';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { pathMarker } from '../parts/path-marker';

/** The slider runs 0 … `MAX`; the rail position is the slider − `LENS_LEG`. */
const MAX = 1 + LENS_LEG;
/** Rail position from which the lamp close-up counts as «down there». */
const DOWN = 0.985;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => x * x * (3 - 2 * x);

export const insideStep: StepFactory = ({ ctx, ui, world, lens, door, reached, reach }) => {
  const { lamp } = world;
  const here = (): boolean => ctx.stage.current === 'inside';
  const pos = (): number => door.rail.position;
  const down = (): boolean => here() && pos() >= DOWN && !door.rail.moving;
  let fill = -1;
  let deep = false;
  const marker = pathMarker(ctx, lamp, { enabled: down });
  const probeAt = marker.handle.position.clone();
  ctx.qa.probe('path-mark', () => marker.position(probeAt));

  // the parts' names on hover / long press (captions 3–5), only down there
  const names: [LampAnchor, number][] = [
    ['contact', 3],
    ['leadIn', 4],
    ['leadOut', 4],
    ['thread', 5],
  ];
  for (const [anchor, i] of names) {
    const pick = new Mesh(
      new SphereGeometry(0.07, 10, 8),
      new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    pick.name = `lamp:name-${anchor}`;
    lamp.anchors[anchor].add(pick);
    ctx.input.register(pick, { tooltip: caption('inside', i), cursor: 'default', enabled: down });
    ctx.qa.probe(`lamp-${anchor}`, lamp.anchors[anchor]);
  }
  ctx.qa.probe('lamp-coil', lamp.anchors.coil);
  const stop = (v: number): string => (v < MAX / 2 ? caption('inside', 1) : caption('inside', 2));

  return {
    // a tap on the resting lens lays it on the glass: the slider glides to the end of its lens leg
    lensInput: {
      cursor: 'pointer',
      enabled: () => here() && pos() < -0.02 && !door.rail.moving,
      click: () => {
        ui.set('depth', LENS_LEG);
        door.rail.travelTo(0);
      },
    },
    spec: {
      camera: 'stand',
      params: { closed: 0, lens: 0, lensCall: 0, window: 0, poles: 1 },
      post: STAGE_POST.stand,
    },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'depth',
          label: caption('inside', 0),
          min: 0,
          max: MAX,
          value: 0,
          step: 0.005,
          marks: [
            { value: 0, label: caption('inside', 1) },
            { value: MAX, label: caption('inside', 2) },
          ],
          format: stop,
          onChange: (v) => door.rail.travelTo(v - LENS_LEG),
          onInput: (v, how) => {
            if (how === 'drag') door.rail.scrub(v - LENS_LEG);
          },
        },
      ],
      goal: () => reached('inside'),
      callouts: [
        {
          anchor: lamp.anchors.coil,
          text: caption('inside', 6),
          side: 'up',
          visible: () => reached('inside') && down(),
        },
      ],
    },
    enter(info) {
      fill = -1;
      deep = false;
      marker.reset();
      if (info.instant) door.rail.snap(-LENS_LEG);
      else {
        // from wherever the camera is (the stand plan of the chapter before, or back from `hot-spot`)
        door.rail.rail.set(-LENS_LEG);
        door.rail.travelTo(-LENS_LEG);
      }
      lens.call = 1;
      if (info.instant) lens.snap(() => door.lens(pos()));
      else lens.to(() => door.lens(pos()), 1.2);
    },
    leave() {
      world.stand.ambient = 0.5;
    },
    update() {
      const p = pos();
      if (here() && Math.abs(p + LENS_LEG - fill) > 0.002)
        ui.patch('depth', { current: (fill = p + LENS_LEG) });
      // the close-up's depth of field once the camera is at the lamp, the stand's above it
      const wantDeep = p > 0.5;
      if (wantDeep !== deep) {
        deep = wantDeep;
        ctx.post.apply(deep ? STAGE_POST.lamp : STAGE_POST.stand, { duration: 0.8 });
      }
    },
    late(dt, t) {
      // the dark room lifted a little while the camera is at the lamp: the opened base must read with the lamp off
      if (here() || door.rail.engaged) world.stand.ambient = 0.5 + 0.5 * smooth(clamp01((pos() - 0.3) / 0.7));
      // every frame, also after the step is left: the mark fades with the rail as it rewinds
      const mine = here() || door.rail.engaged;
      marker.shown = mine ? smooth(clamp01((pos() - 0.86) / 0.13)) : 0;
      marker.update(dt, t);
      if (!reached('inside') && down() && marker.reachedEnd) reach('inside');
    },
  };
};
