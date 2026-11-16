/**
 * The showcase answers the pointer the way a chapter will (and shows the chapter builder how): click an atom of
 * the rows to choose it (`wire/atoms`); inside the opened atom drag any electron away from the nucleus
 * (`wire/outer`) — a near one barely gives and springs back, the outer one comes off.
 */
import { Mesh, PlaneGeometry, Ray, Vector3 } from 'three';
import type { ChapterContext, PointerInfo } from '@/engine/api';
import { K } from '@/style';

import type { Copper } from '@circuit/shared/copper/copper';

export function addInteraction(ctx: ChapterContext, copper: Copper): void {
  const onRows = (): boolean => copper.depth > 0.9 && copper.depth < 1.2;
  const choose = (e: PointerInfo): void => {
    if (!e.point) return;
    const site = copper.lattice.siteAt(copper.toLocal(e.point.clone()));
    if (site < 0) return;
    copper.lattice.selected = copper.lattice.selected === site ? -1 : site;
    copper.hero = site; // the next dive opens this atom
    copper.lattice.touch(site);
  };
  for (const atoms of [copper.lattice.atoms, copper.lattice.hero])
    ctx.input.register(atoms, { tooltip: 'Атом міді', cursor: 'pointer', click: choose, enabled: onRows });

  // inside the atom the electrons are soft sprites: one invisible sheet in the picture plane catches the pointer
  const sheet = new Mesh(new PlaneGeometry(60, 40), K.flat('bg.void'));
  sheet.material.colorWrite = false;
  sheet.material.depthWrite = false;
  sheet.name = 'atom-drag-sheet';
  copper.group.add(sheet);
  const ray = new Ray();
  const normal = new Vector3(0, 0, 1);
  const origin = new Vector3();
  const to = new Vector3();
  let held = -1;
  ctx.input.register(sheet, {
    cursor: 'grab',
    enabled: () => copper.depth > 1.85,
    dragStart: (e) => {
      copper.localRay(e.ray, ray);
      held = copper.atom.nearest(ray.origin, ray.direction, 0.3);
    },
    drag: (e) => {
      if (held < 0) return;
      // the sheet's plane in world space: through the mount's origin, facing the reader
      normal.set(0, 0, 1).transformDirection(copper.group.matrixWorld);
      copper.group.getWorldPosition(origin);
      const p = e.planePoint(normal, origin, to);
      if (p) copper.atom.hold(held, copper.toLocal(p));
    },
    dragEnd: () => {
      held = -1;
      copper.atom.hold(-1);
    },
  });
}
