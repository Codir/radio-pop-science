/**
 * The hand of the bench (docs/volumes/electronics/VISUAL.md §6): the two gestures over the breadboard's sockets, the
 * ends it moves, their grips and cues, the tray of parts, the ground loose leads lie on, a scripted repair. The bench
 * (`shared/bench`) mounts it; a chapter steers it through `bench.hands.policy` and `bench.tray.set`.
 */
export * from './hands';
export { Leg, type LegWorld, type Place } from './leg';
export { GRIP, type Grip, type GripKind, type GripSpot } from './grips';
export { TRAY, createTray, partSize, trayLabel, trayRow, type Tray, type TrayRow, type TraySlot } from './tray';
export { createTerrain, type Raised, type Terrain } from './terrain';
export { hermite, lengths, pointAt, SAMPLES, type EndPose, type Lay } from './curves';
export { glide, type Glide } from './glide';
export { createCue, type Cue } from './cue';
export { SWAP_SECONDS, createSwap, type Swap } from './swap';
