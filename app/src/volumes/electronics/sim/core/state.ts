/**
 * What the model remembers between solves. One object per stand — two copies of a chapter side by side at a chapter
 * boundary hold two — and never a variable of a module. It lives longer than a netlist: the board changes, the state
 * stays, so what it keeps is by node number now and by part id later. The tasks after E1-3 add their memory here:
 * the temperature of a lamp's filament, the charge of the capacitors, the damage of a part.
 */
export interface ModelState {
  /** The node voltages of the last solve that succeeded, by node number (empty before the first): the first guess
   * of the next solve once Newton's iterations need one. */
  v: Float64Array;
}

export function createModelState(): ModelState {
  return { v: new Float64Array(0) };
}
