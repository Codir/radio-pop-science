import { describe, expect, it } from 'vitest';
import { ELEMENTS, elementByZ, elementName } from '../elements';
import { maxElectrons, shellCounts } from '../shells';
import { ionSymbol, nuclideName, nuclideSymbol } from '../notation';
import { SOURCE_SYMBOLS } from '../nuclides';

describe('elements, shells and notation', () => {
  it('names all 118 elements like the source', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.map((e) => e.symbol)).toEqual([...SOURCE_SYMBOLS]);
    expect(elementByZ(79)).toEqual({ z: 79, symbol: 'Au', nameUk: 'Аурум', substanceUk: 'золото' });
    expect(elementName(1)).toBe('Гідроген (водень)');
    expect(elementName(2)).toBe('Гелій');
    expect(elementName(118)).toBe('Оганесон');
    expect(elementByZ(0)).toBeUndefined();
    expect(elementByZ(119)).toBeUndefined();
  });
  it('fills the shells', () => {
    const cases: [number, number, number[]][] = [
      [1, 1, [1]], [1, 0, []], [1, 2, [2]], [6, 6, [2, 4]], [24, 24, [2, 8, 13, 1]], [26, 24, [2, 8, 14]],
      [29, 29, [2, 8, 18, 1]], [29, 28, [2, 8, 18]], [46, 46, [2, 8, 18, 18]], [47, 47, [2, 8, 18, 18, 1]],
      [58, 58, [2, 8, 18, 19, 9, 2]], [64, 64, [2, 8, 18, 25, 9, 2]], [79, 79, [2, 8, 18, 32, 18, 1]],
      [92, 92, [2, 8, 18, 32, 21, 9, 2]], [103, 103, [2, 8, 18, 32, 32, 8, 3]], [118, 118, [2, 8, 18, 32, 32, 18, 8]],
    ];
    for (const [z, e, shells] of cases) expect(shellCounts(z, e), `${z}/${e}`).toEqual(shells);
    for (let z = 1; z <= 118; z++) expect(shellCounts(z, z).reduce((a, b) => a + b, 0)).toBe(z);
    expect(shellCounts(79, 500)).toEqual(shellCounts(79, 80));
    expect(shellCounts(79, -3)).toEqual([]);
    expect(maxElectrons(79)).toBe(80);
    expect(maxElectrons(118)).toBe(118);
    expect(shellCounts(118, 119)).toEqual([2, 8, 18, 32, 32, 18, 8]);
  });
  it('writes nuclides and ions', () => {
    expect(nuclideSymbol(79, 118)).toBe('¹⁹⁷Au');
    expect(nuclideSymbol(1, 0)).toBe('¹H');
    expect(ionSymbol(79, 118, 79)).toBe('¹⁹⁷Au');
    expect(ionSymbol(79, 118, 78)).toBe('¹⁹⁷Au⁺');
    expect(ionSymbol(26, 30, 24)).toBe('⁵⁶Fe²⁺');
    expect(ionSymbol(1, 0, 2)).toBe('¹H⁻');
    expect(nuclideName(79, 118)).toBe('Аурум (золото)-197');
  });
});
