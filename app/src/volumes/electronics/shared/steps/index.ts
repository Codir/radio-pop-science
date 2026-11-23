/**
 * What the steps of the chapters on the bench build from (shared/README.md, «steps»): the goals' maths (rows, the
 * tally of held readings, a run of time in a row), the hand's rules by kind and the probes by name, the names under the
 * pointer, the phone's dock buttons for the tray, the switch and the player, the multimeter and the oscilloscope in the
 * panel, the dive's depth slider and the chapter's facade over the bench. A chapter keeps its own words (its captions),
 * boards, scales and hold times; these take them as arguments.
 */
export { across, createHold, createTally, rowOf, rowsOf, sameRows, within, type Hold, type Tally } from './goals';
export { handPolicy, kindOf, type HandRules, type ProbeKey } from './policy';
export { partNames, type Names } from './names';
export { PLAYER_ID, SWITCH_ID, playerToggle, switchToggle, trayButtonId, trayButtons } from './dock';
export { MODE_ID, READOUT_ID, meterReadout, meterSwitch } from './meter';
export {
  axisTitle,
  crestStats,
  crestText,
  perDivision,
  scopeBoard,
  scopeWords,
  timeText,
  voltsText,
  type ChartWords,
} from './scope';
export { DEPTH_ID, depthSlider, type DepthSlider, type DepthWords } from './depth';
export { createStepStand, type Naming, type StepStand, type StepStandOptions } from './stand';
