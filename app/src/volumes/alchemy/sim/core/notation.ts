/** Nuclide and ion notation: ¹⁹⁷Au, ⁵⁶Fe²⁺, ¹H⁻. */
import { superscript } from '@/content';
import { elementByZ, elementName } from './elements';

export function nuclideSymbol(z: number, n: number): string {
  return `${superscript(z + n)}${elementByZ(z)?.symbol ?? '?'}`;
}

/** Charge = protons − electrons; `+`/`−` written as superscripts, magnitude 1 omitted. */
export function ionSymbol(z: number, n: number, electrons: number): string {
  const charge = z - electrons;
  if (charge === 0) return nuclideSymbol(z, n);
  const mag = Math.abs(charge);
  return `${nuclideSymbol(z, n)}${mag === 1 ? '' : superscript(mag)}${charge > 0 ? '⁺' : '⁻'}`;
}

/** «Аурум (золото)-197». */
export function nuclideName(z: number, n: number): string {
  return `${elementName(z)}-${z + n}`;
}
