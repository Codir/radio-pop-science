/**
 * What the steps of the chapters on the bench build from (shared/README.md, «steps»): the goals' maths (rows, the
 * tally of held readings), the hand's rules by kind, the names under the pointer, the phone's dock buttons for the tray
 * and the switch, the multimeter in the panel, the dive's depth slider and the chapter's facade over the bench. A
 * chapter keeps its own words (its captions), boards and hold times; these take them as arguments.
 */
export { across, createTally, rowsOf, sameRows, within, type Tally } from './goals';
export { handPolicy, kindOf, type HandRules } from './policy';
export { partNames, type Names } from './names';
export { SWITCH_ID, switchToggle, trayButtonId, trayButtons } from './dock';
export { MODE_ID, READOUT_ID, meterReadout, meterSwitch } from './meter';
export { DEPTH_ID, depthSlider, type DepthSlider, type DepthWords } from './depth';
export { createStepStand, type Naming, type StepStand, type StepStandOptions } from './stand';
