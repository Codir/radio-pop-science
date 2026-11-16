/**
 * Ukrainian typography of the step regions: a line never starts with a dash — the space before «—» / «–»
 * becomes a no-break space, so the browser keeps the dash at the end of the previous line.
 */
import { richEl } from '../core/rich';

export function nbDash(s: string): string {
  return s.replace(/ ([—–])(?=\s)/g, ' $1');
}

/** `richEl` with the dash rule. */
export function prose(tag: string, cls: string, source: string): HTMLElement {
  return richEl(tag, cls, nbDash(source));
}
