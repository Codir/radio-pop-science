/**
 * `wire/restless` — «Рух без потоку». The flashlight is off (cool light, no common drift); the reader marks one
 * free electron (white ring, long trail, the crowd dims) and watches the counter frame: from the moment of marking
 * it counts the crossings to the left and to the right, shown above the frame (`sim.gate`; `gate.balance` keeps
 * them within two with the lamp off, as the script says).
 */
import { Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { electronProxies } from '../parts/electron-proxies';
import { createHoverRing } from '../parts/ring';

/** Crossings each way that make the goal (script: «щонайменше по десять прольотів у кожен бік»). */
const ENOUGH = 10;
/** Where the frame stands: between two columns of atoms, left of the middle (copper README «Shots»). */
const GATE = { x: -4.8, y: 0, half: 3.3 };
/** The marked electron's label shows only while the electron is below this height (local units). */
const LABEL_BELOW = 1.4;
export const restlessStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const { sim } = copper;
  const here = (): boolean => ctx.stage.current === 'restless' && Math.abs(copper.depth - 1) < 0.05;

  const mark = (e: number): void => {
    copper.marked = e;
    sim.gate.left = sim.gate.right = 0;
  };
  const proxies = electronProxies(ctx, copper, { enabled: here, click: mark });
  const ring = createHoverRing(copper.space);

  const at = new Vector3();
  const electron = (e: number, out: Vector3): Vector3 =>
    out.set(sim.pos[3 * e]!, sim.pos[3 * e + 1]!, sim.pos[3 * e + 2]!);
  const markedAt = (): Vector3 => world.toWorld(electron(Math.max(copper.marked, 0), at), at);
  ctx.qa.probe('free-electron', () =>
    world.toWorld(electron(Math.max(proxies.nearest(copper.look.x, copper.look.y), 0), at), at),
  );
  ctx.qa.expose('restless', () => ({
    hovered: proxies.hovered,
    marked: copper.marked,
    left: sim.gate.left,
    right: sim.gate.right,
  }));

  return {
    spec: {
      ...world.state('rows', 0, 'gate'),
      duration: 1.2,
      cameraMove: { duration: 1.8 },
    },
    ui: {
      goal: () => reached('restless'),
      callouts: [
        {
          anchor: markedAt,
          text: caption('restless', 0),
          side: 'down',
          // the counts stand above the frame: the label steps aside while its electron flies up there
          visible: () => here() && copper.marked >= 0 && sim.pos[3 * copper.marked + 1]! < LABEL_BELOW,
        },
      ],
    },
    enter() {
      copper.atoms = Infinity;
      sim.shared = 1;
      copper.lattice.selected = -1;
      copper.hero = 0;
      copper.look.x = copper.look.y = 0;
      copper.atom.reset();
      copper.atom.apart = 0;
      copper.marked = -1;
      // the lamp is off: the library keeps the two counts within two, as a real wire with countless electrons does
      Object.assign(sim.gate, GATE, { on: true, balance: 1, left: 0, right: 0 });
      copper.gate.shown = 1;
      copper.gate.numbers = true;
    },
    leave() {
      ring.hide();
      copper.marked = -1;
      sim.gate.on = false;
      sim.gate.balance = 0;
      copper.gate.shown = 0;
    },
    update(dt) {
      proxies.update();
      const e = here() && copper.marked < 0 ? proxies.hovered : -1;
      ring.update(dt, e >= 0 ? electron(e, at) : null, 0.42);
      if (!here()) return;
      if (copper.marked >= 0 && sim.gate.left >= ENOUGH && sim.gate.right >= ENOUGH) reach('restless');
    },
  };
};
