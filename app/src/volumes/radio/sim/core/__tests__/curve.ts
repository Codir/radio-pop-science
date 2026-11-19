/**
 * States of the whole link for the tests of the model.
 */
import type { AirState } from '../channel';
import { type CameraState, DEFAULT_STATE, type FmLinkState, type MonitorState } from '../fm-link';

/**
 * A copy of DEFAULT_STATE in which the given fields of its three parts are replaced:
 * `S({ route: 3 })`, `S({}, { lineLength: 288.5 }, { sync: false })`. Every call gives new objects.
 */
export function S(
  air: Partial<AirState> = {},
  monitor: Partial<MonitorState> = {},
  camera: Partial<CameraState> = {},
): FmLinkState {
  return {
    air: { ...DEFAULT_STATE.air, ...air },
    camera: { ...DEFAULT_STATE.camera, ...camera },
    monitor: { ...DEFAULT_STATE.monitor, ...monitor },
  };
}
