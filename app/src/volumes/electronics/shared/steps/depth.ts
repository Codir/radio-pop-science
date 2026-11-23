/**
 * The dock's slider «Глибина» of a dive step (VISUAL §7, `shared/dive`): it runs 0 (the step's shot, the lens in its
 * holder) … `end` + `LENS_LEG` (the door's rail at `end`: 1 is the floor `inside`, less stops short of the cut on the
 * floor `part`), the door's rail position being the slider − `LENS_LEG`; a drag scrubs the rail, a click glides it. A
 * tap on the resting magnifier lays it over the part: the slider glides to the end of its lens leg. Every frame of the
 * step the slider's fill shows where the dive is (its thumb stays where the reader put it). The words are the step's
 * captions; the door is the stand's (`stand.ts`).
 */
import type { ChapterContext } from '@/engine/api';
import type { SliderSpec, StepUiApi } from '@/hud';
import type { Bench } from '../bench';
import { LENS_LEG, type Door } from '../dive';

/** The dock's id of the slider. */
export const DEPTH_ID = 'depth';

export interface DepthWords {
  /** The slider's label. */
  label: string;
  /** The mark at 0, and the slider's value in the first half of its way. */
  top: string;
  /** The mark at the end, and the value in the second half. */
  bottom: string;
}

export interface DepthSlider {
  /** The dock's slider (`DEPTH_ID`). */
  readonly control: SliderSpec;
  /** The slider's end: `end` + `LENS_LEG`. */
  readonly max: number;
  /** The door rests on the step's shot, its lens in the holder. */
  resting(): boolean;
  /** On the step's entry: the fill is set anew on the first frame. */
  reset(): void;
  /** Every frame of the step (its `update`): the slider's fill follows the rail. */
  update(): void;
}

export function depthSlider(
  ctx: ChapterContext,
  bench: Bench,
  ui: Pick<StepUiApi, 'set' | 'patch'>,
  door: () => Door | null,
  here: () => boolean,
  end: number,
  words: DepthWords,
): DepthSlider {
  const max = end + LENS_LEG;
  let fill = -1;
  const resting = (): boolean => {
    const d = door();
    return !!d && !d.rail.moving && d.rail.position <= d.rail.rail.min + 1e-6;
  };
  // a tap on the resting magnifier lays it over the part: the slider glides to the end of its lens leg
  ctx.input.register(bench.tools.lens.group, {
    cursor: 'pointer',
    enabled: () => here() && !!door()?.ready && resting() && !bench.flying,
    click: () => {
      ui.set(DEPTH_ID, LENS_LEG);
      door()?.travelTo(0);
    },
  });
  const control: SliderSpec = {
    type: 'slider',
    id: DEPTH_ID,
    label: words.label,
    min: 0,
    max,
    value: 0,
    step: 0.005,
    marks: [
      { value: 0, label: words.top },
      { value: max, label: words.bottom },
    ],
    format: (v) => (v < max / 2 ? words.top : words.bottom),
    disabled: () => !door()?.ready && resting(),
    onChange: (v) => door()?.travelTo(v - LENS_LEG),
    onInput: (v, how) => {
      if (how === 'drag') door()?.rail.scrub(v - LENS_LEG);
    },
  };
  return {
    control,
    max,
    resting,
    reset() {
      fill = -1;
    },
    update() {
      const d = door();
      if (!here() || !d) return;
      const p = d.rail.position;
      if (Math.abs(p + LENS_LEG - fill) > 0.002) ui.patch(DEPTH_ID, { current: (fill = p + LENS_LEG) });
    },
  };
}
