/**
 * `dive` — «Углиб дроту». The reader takes the lens from its holder (a tap or a drag onto the stand); then the
 * depth slider IS the dive (DECISIONS §60 p, UI_API §3.3): its position is the frame — camera, `deep`, the ring,
 * the dissolve, the metal turning into rows. Drag it and the dive follows the hand both ways (`world.scrub`), let
 * go anywhere and it stays; click the track or use the keys and it glides there (`world.travelTo`, speed-limited). The three names stand as
 * marks along the track: стенд · усередині дроту · ряди кульок. The goal holds after 2 s at the end.
 */
import type { ChapterContext } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { CircuitWorld } from '@circuit/shared/world';
import type { PartNames } from './parts';

/** The slider's range on the dive rail: the lens (0) … «ряди» (2); the prologue does not go to one atom. */
const END = 2;
/** Seconds at the end before the takeaway (script: «пробув там щонайменше 2 s»). */
const DWELL = 2;
/** Seconds the camera needs to come to the lens after it is taken (the slider waits for it). */
const TAKE = 1.6;

export interface DiveStep {
  spec: StepUiSpec;
  enter(): void;
  update(dt: number): void;
  /** For the interaction test (`__app.read('prologue')`). */
  state(): { lens: number; slider: number; position: number; moving: boolean; dwell: number };
}

export function diveStep(
  ctx: ChapterContext,
  world: CircuitWorld,
  ui: StepUiApi,
  labels: readonly string[],
  names: PartNames,
  /** True while the step's panel is held back (the unfolding plays): the depth slider waits with the text. */
  held: () => boolean,
  /** Another step's name for the lens (`riddle`: «позначена іскорка» on hover), with when it applies. */
  otherName?: { text: string; when: () => boolean },
): DiveStep {
  const [lensLabel = '', wheelLabel = '', ...stopLabels] = labels;
  const lens = world.stand.tools.lens;
  let dwell = 0;
  let shownFill = -1;
  /** Seconds since the lens was taken (∞ when it was already on the wire). */
  let sinceTake = Infinity;
  const active = (): boolean => ctx.stage.current === 'dive';
  const lensOn = (): boolean => world.value('lens') > 0.99;
  const ready = (): boolean => lensOn() && sinceTake >= TAKE;

  const take = (): void => {
    if (!active() || lensOn() || world.flying) return;
    ctx.stage.setParam('lensCall', 0, { duration: 0.4 });
    names.dismiss();
    world.takeLens();
    sinceTake = 0;
  };
  // one registration for the lens (a second one on its glass would swallow the tap that takes it here)
  const other = (): boolean => otherName?.when() ?? false;
  ctx.input.register(lens.group, {
    tooltip: () => (other() ? (otherName?.text ?? '') : lensLabel),
    cursor: 'grab',
    enabled: () => (active() && !lensOn()) || other(),
    click: take,
    dragEnd: take,
  });
  const anchor = lens.glass.position.clone();
  ctx.qa.probe('lens', () => lens.glass.getWorldPosition(anchor));

  const spec: StepUiSpec = {
    reset: true,
    controls: [
      {
        type: 'slider',
        id: 'depth',
        label: wheelLabel,
        min: 0,
        max: END,
        value: 0,
        step: 0.005,
        marks: [0, 1, 2].map((v, i) => ({ value: v, label: stopLabels[i] ?? '' })),
        format: (v) => stopLabels[Math.round(v)] ?? '',
        // held with the panel's text (stepUi `panel.hiddenUntil` holds only the text: requests §7)
        visible: () => !held(),
        disabled: () => !ready(),
        // the thumb is where the hand put it; the scene follows (a far jump glides, a drag follows at once)
        // UI_API §3.3: the thumb is the target; a drag is followed frame by frame, a click on the track or a key
        // glides there; the track's fill shows where the dive is now (`current`, patched in `update`)
        onChange: (v) => {
          names.dismiss();
          world.travelTo(v);
        },
        onInput: (v, how) => {
          if (how === 'drag') world.scrub(v);
        },
      },
    ],
    callouts: [
      ...names.callouts,
      {
        anchor: () => lens.glass.getWorldPosition(anchor),
        text: lensLabel,
        visible: () => active() && !lensOn() && !names.shown && world.deep < 0.01,
      },
    ],
    goal: () => lensOn() && dwell >= DWELL,
  };
  return {
    spec,
    enter() {
      dwell = 0;
      names.reset();
      sinceTake = lensOn() ? Infinity : 0;
      // a deep link lands on the stand with the lens in its holder, the slider at the start
      ui.set('depth', 0);
    },
    update(dt) {
      if (!active()) return;
      if (Math.abs(world.position - shownFill) > 0.002)
        ui.patch('depth', { current: (shownFill = world.position) });
      sinceTake += dt;
      dwell = world.position > END - 0.005 && world.goal > END - 0.005 ? dwell + dt : 0;
    },
    state: () => ({
      lens: world.value('lens'),
      slider: Number(ui.value('depth')),
      position: world.position,
      moving: world.position !== world.goal,
      dwell,
    }),
  };
}
