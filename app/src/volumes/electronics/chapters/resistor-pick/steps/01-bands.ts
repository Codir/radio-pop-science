/**
 * `resistor-pick/bands` — «Смужки замість цифр». The LED's loop of `resistor` with its 330 Ω, the switch open (the LED
 * dark: it adds no colour to the bands); the shot `board`. The dock's slider «Глибина» (`shared/steps`, `depthSlider`)
 * is the magnifier's way down to the floor `part` only (`shared/dive`: the door into R1, 0 «стенд» … the end «резистор
 * зблизька», the rail's `DIVE_END` before the cut opens; a drag scrubs it, a click glides), a tap on the resting lens
 * lays it on the resistor; the ladder «де ми» shows the floor. On the floor `part` a touch on the resistor's body picks the band nearest along it
 * (`parts/picker.ts`, `bandAt`), and so do the dock's four buttons — one per band, every press —; the stand marks the
 * band picked last (`parts/marker.ts`) and the dock's table says what each band picked says (its colour's name and
 * number; «—» before). Off the floor `part` neither the buttons (grey) nor the touch work. Goal: on the floor `part`,
 * every one of the four bands picked at least once, by either way, in any order.
 */
import { Vector3 } from 'three';
import type { Door } from '@electronics/shared/dive';
import { AXIAL_Y, resistorBands, type BandColor, type ResistorModel } from '@electronics/shared/parts';
import { depthSlider } from '@electronics/shared/steps';
import { PARTS } from '@electronics/sim/core';
import { LOOP } from '../parts/boards';
import { bandRows } from '../parts/bands';
import { createBandMarker } from '../parts/marker';
import { bandPicker } from '../parts/picker';
import { NONE } from '../parts/readouts';
import { caption } from '../content';
import { DIVE_END, type StepFactory } from '../chapter';

const S = 'bands';
/** The step's resistor, the loop's 330 Ω, as the catalog has it. */
const R330 = (() => {
  const p = PARTS['resistor-330'];
  if (p?.kind !== 'resistor') throw new Error('resistor-pick: the catalog has no resistor-330');
  return p;
})();
const TOLERANCE = R330.tolerance;
/** The 330 Ω's bands, from leg 0: orange, orange, brown, gold. */
const BANDS: readonly BandColor[] = resistorBands(R330.ohms, TOLERANCE);
/** The captions of the colours the step's resistor wears. */
const COLOUR_WORD: Readonly<Partial<Record<BandColor, number>>> = { orange: 10, brown: 11, gold: 12 };
/** The buttons' and the table rows' captions, band by band. */
const ROLE_WORD = [6, 7, 8, 9] as const;

export const bandsStep: StepFactory = ({ ctx, ui, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  /** The bands picked on the floor `part` this visit, and the one picked last (the table's highlighted row). */
  const seen = new Set<number>();
  let last: number | null = null;
  const door = (): Door | null => stand.door;
  // «Глибина» down to the floor `part` only (the rail's `DIVE_END`); a tap on the resting lens lays it on the resistor
  const depth = depthSlider(ctx, bench, ui, door, () => here(S), DIVE_END, {
    label: word(0),
    top: word(1),
    bottom: word(2),
  });
  /** The camera is on the floor `part` (the band's way works only there). */
  const atPart = (): boolean => here(S) && door()?.floor === 'part';
  const choose = (band: number): void => {
    if (!atPart()) return;
    seen.add(band);
    last = band;
  };
  const model = (): ResistorModel | null => (bench.parts.models.get('R1') as ResistorModel | undefined) ?? null;
  const picker = bandPicker(ctx, bench, 'R1', atPart, choose);
  const marker = createBandMarker(bench.group);
  ctx.onDispose(() => marker.dispose());
  // the checks' probes: the middle of each band on the body (far below the bench while there is no R1)
  BANDS.forEach((_, i) => {
    const v = new Vector3();
    ctx.qa.probe(`band:${i}`, () => {
      const m = model();
      return m ? m.bodyGroup.localToWorld(v.set(m.bandX[i]!, AXIAL_Y, 0)) : v.set(0, -100, 0);
    });
  });
  ctx.qa.probe('band:marker', () => marker.aim ?? new Vector3(0, -100, 0));
  ctx.qa.expose(S, () => {
    const d = door();
    return {
      floor: d?.floor ?? null,
      position: d?.rail.position ?? null,
      ready: d?.ready ?? false,
      atPart: atPart(),
      seen: [...seen].sort(),
      last,
      marked: marker.group.visible ? last : null,
      bands: [...BANDS],
      closed: bench.closed,
      reached: reached(S),
    };
  });
  const words = {
    role: (i: number) => word(ROLE_WORD[i]!),
    colour: (c: BandColor) => {
      const k = COLOUR_WORD[c];
      return k === undefined ? NONE : word(k);
    },
    none: NONE,
  };

  return {
    spec: { camera: 'board', params: { meter: 0 } },
    ui: {
      reset: true,
      controls: [
        depth.control,
        {
          type: 'table',
          id: 'band-table',
          head: [word(3), word(4), word(5)],
          rows: () => bandRows(BANDS, seen, words, TOLERANCE),
          highlight: () => last ?? -1,
          align: ['left', 'left', 'right'],
        },
        ...ROLE_WORD.map((k, i) => ({
          type: 'button' as const,
          id: `band-${i}`,
          label: word(k),
          disabled: () => !atPart(),
          onClick: () => choose(i),
        })),
      ],
      goal: () => reached(S),
    },
    enter(info) {
      seen.clear();
      last = null;
      depth.reset();
      stand.board(LOOP);
      bench.closed = 0;
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      // the hand takes nothing here; while the camera flies it could not anyway
      bench.hands.policy = { take: () => false };
      stand.naming = { part: () => '', meter: '' };
      const d = stand.openDoor('R1', info, 'board');
      // back from `series` (its door kept): the step starts on its shot again, as its slider does
      if (d.rail.engaged) d.home();
    },
    update() {
      // the slider's fill is where the dive is (its thumb where the reader put it)
      depth.update();
    },
    late() {
      picker.update();
      marker.show(here(S) && atPart() ? model() : null, last, ctx.camera.camera);
      if (!here(S)) return;
      if (seen.size === BANDS.length && !reached(S)) reach(S);
    },
    leave() {
      marker.show(null, null, ctx.camera.camera);
    },
  };
};
