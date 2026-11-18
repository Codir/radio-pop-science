/**
 * `heat` — «Струм гріє». The camera rises from the rows to the stand plan in one motion; the lens stays on the near
 * wire as a window onto the copper (as in `flow`), the thermometer is clipped to the wire beside it. The reader
 * opens the switch: the lamp goes dark, the hits stop, the atoms in the lens calm down to their rest (2–3 % of the
 * diameter) within 1–2 s and the column sinks to its tick; closes it again: hits again, the atoms tremble harder
 * (8 %, an orange rim) and in 3 s the column stands one tick's width above the tick. The trembling follows the
 * current squared (`shared/copper/joule.ts`). Goal: opened, closed again, 3 s since.
 */
import { Vector3 } from 'three';
import { STAGE_SHOTS, boardToWorld, currentOfHeat } from '@circuit/shared/stage';
import { trembleHeat } from '@circuit/shared/copper/joule';
import { caption } from '../content';
import type { StepFactory } from '../chapter';

/** Seconds after closing again that the goal asks for (the column has risen to its place). */
const WATCH = 3;
/** Seconds the rise from the rows to the lens over the wire takes, and the camera's move from there to the stand. */
const RISE = 2;
const SETTLE = 1.2;
/** How fast the trembling follows the current (s): calm in 1–2 s. */
const CALM = 0.55;
/** The column: up in about 3 s, down a little faster. */
const COLUMN_UP = 0.85;
const COLUMN_DOWN = 0.6;
/** Hits that flash in the lens each second at the working current (the others are counted, not shown). */
const FLASHES = 2.2;
/**
 * The step's shot: the main shot's direction, closer, on the right half of the stand — the lens window, the
 * thermometer beside it and the switch (the column's rise must be seen at 1280×720). Board point it looks at and
 * the share of the main shot's distance.
 */
const SHOT = { at: [1.45, 0.55, 0.5] as const, closer: 0.76, name: 'resistance-heat' };
/** Seconds the caption «термометр» stays once the camera is on the stand. */
const NAME_FOR = 3;

export const heatStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { world, copper, hits, sw, thermo } = stand;
  const top = new Vector3();
  {
    const stand = STAGE_SHOTS.stand;
    const target = boardToWorld(...SHOT.at);
    const from = new Vector3(...stand.position).sub(new Vector3(...stand.target)).multiplyScalar(SHOT.closer);
    ctx.camera.shots({
      [SHOT.name]: {
        position: target.clone().add(from).toArray(),
        target: target.toArray(),
        fov: stand.fov,
        fit: { center: target.toArray(), radius: 2.1 },
        orbit: stand.orbit,
      },
    });
  }
  let rising = false;
  /** The rise is still to be started (on the first frame of the step, after the world's flight was planned). */
  let start = false;
  /** Seconds left of the camera's move from the lens out to the stand plan. */
  let settling = 0;
  let opened = false;
  let closedFor = -1;
  let level = 0;
  let named = 0;
  const landed = (): boolean => !rising && settling <= 0 && !world.flying && world.deep < 0.01;

  sw.flipped = (closed) => {
    if (!here('heat')) return;
    if (!closed) {
      opened = true;
      closedFor = -1;
    } else if (opened) closedFor = 0;
  };
  ctx.qa.probe('thermometer', thermo.top);
  ctx.qa.expose('heat', () => ({
    opened,
    closedFor: Math.round(closedFor * 100) / 100,
    level: Math.round(level * 1000) / 1000,
    heat: Math.round(copper.lattice.heat * 1000) / 1000,
    rising,
    landed: landed(),
    position: Math.round(world.position * 1000) / 1000,
    flying: world.flying,
  }));

  return {
    spec: { camera: SHOT.name, params: { deep: 0, closed: 1, lens: 1, window: 1, poles: 1 } },
    ui: {
      goal: () => reached('heat'),
      callouts: [
        {
          anchor: () => thermo.top.getWorldPosition(top),
          text: caption('heat', 0),
          side: 'up',
          visible: () => here('heat') && landed() && named > 0 && named < NAME_FOR,
        },
      ],
    },
    enter(info) {
      opened = false;
      closedFor = -1;
      named = 0;
      // the lens glides to its window place once the camera is well out of the ring (from the rows), at once else
      if (info.instant || world.deep < 0.01) stand.window(info.instant);
      else world.lensPose = null;
      sw.enabled = () => here('heat') && landed();
      hits.flashRate = 0;
      // the thermometer grows out of its clip once the camera is out on the stand (deep links: already there)
      if (info.instant) stand.thermoShown.go(1, 0);
      // from the rows: one rise through the ring to the lens over the wire, then out to the stand plan
      rising = !info.instant && world.deep > 0.01;
      settling = 0;
      // the world's own flight starts after this (the scene's enterStep): it is replaced on the first frame
      start = rising;
    },
    leave() {
      sw.enabled = () => false;
      rising = false;
    },
    update(dt) {
      if (start) {
        start = false;
        world.release();
        world.travelTo(0, RISE);
      }
      if (rising && !world.flying && world.position < 0.005) {
        rising = false;
        world.release();
        ctx.camera.go(SHOT.name, { duration: SETTLE, ease: 'power2.inOut' });
        settling = SETTLE;
      }
      settling = Math.max(settling - dt, 0);
      if (!rising && settling > 0 && settling < SETTLE * 0.55 && world.lensPose === null) stand.window(false);
      if (landed()) {
        if (stand.thermoShown.target < 1) stand.thermoShown.go(1, 0.9);
        if (stand.thermoShown.value > 0.95) named += dt;
      }
      // the current now (A): the lamp's glow tells it (0.3 A lit); none while the switch is open
      const amps = sw.closed ? currentOfHeat(Math.max(stand.stage.glow, 1e-3)) : 0;
      const k = amps / 0.3;
      const target = trembleHeat(amps);
      stand.heat.target = target;
      stand.heat.rate = CALM;
      hits.flashRate = FLASHES * k * k;
      const want = sw.closed ? 1 : 0;
      level += (want - level) * (1 - Math.exp(-dt / (want > level ? COLUMN_UP : COLUMN_DOWN)));
      thermo.level = level;
      if (closedFor >= 0 && sw.closed) closedFor += dt;
      if (closedFor >= WATCH && !reached('heat')) reach('heat');
    },
  };
};
