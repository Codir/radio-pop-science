import { describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import { allNuclides, getNuclide } from '@alchemy/sim/core';
import {
  autoDecay, chooseFragment, fireAt, knock, setElectrons, startGame, waitForDecay,
} from '@alchemy/sim/lab';
import type { GameEvent, PlayedMode, Refusal } from '@alchemy/sim/lab';
import {
  cardRows, chargeText, elapsedText, energyText, eventLine, halfLifeText, modeName, questDoneLine, statusLine,
} from '../parts/text';
import { L } from '../labels';

const s = (t: string) => t.replaceAll(NBSP, ' ');
const BAD = /undefined|null|NaN|Infinity|\[object/;
const ALLOWED = /^[\p{Script=Cyrillic}A-Za-z0-9 \u00a0=.,:;!?()«»„“"'’\-—−·×→←↔≈½°%+/⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀-₉αβγνλμ]*$/u;

const MODES: readonly PlayedMode[] = [
  'b-', 'b+', 'ec', 'a', 'p', '2p', 'n', '2n', '2b-', '2b+', 'b-n', 'b-2n', 'b-3n', 'b-4n', 'b-p', 'b-a',
  'b+p', 'b+2p', 'b+a', 'sf',
];
const REASONS: readonly Refusal[] = ['stable', 'notObserved', 'noData', 'needsElectron', 'noProduct', 'pending'];
const TOOLS = ['n', 'p', 'd', 'he3', 'alpha', 'c12', 'o16', 'ca48', 'gamma-n', 'gamma-p', 'wait', 'electrons', 'fragment'] as const;
const REF = { z: 6, n: 8 };

describe('lab text', () => {
  it('writes half-lives across forty orders of magnitude', () => {
    expect(s(halfLifeText(388781328))).toBe('12,3 р.');
    expect(s(halfLifeText(179874478055))).toBe('5700 р.');
    expect(s(halfLifeText(7.608374852e11))).toBe('24,1 тис. р.');
    expect(s(halfLifeText(1.4099634525e17))).toBe('4,47 млрд р.');
    expect(s(halfLifeText(6.342942e26))).toBe('2,0×10¹⁹ р.');
    expect(s(halfLifeText(4598208))).toBe('53,2 доби');
    expect(s(halfLifeText(14112))).toBe('3,92 h');
    expect(s(halfLifeText(1096.2))).toBe('18,3 min');
    expect(s(halfLifeText(32))).toBe('32 s');
    expect(s(halfLifeText(0.00058))).toBe('0,58 ms');
    expect(s(halfLifeText(0.00016346))).toBe('163 μs');
    expect(s(halfLifeText(8.19e-17))).toBe('8,2×10⁻¹⁷ s');
    expect(s(halfLifeText(3.7e-22))).toBe('3,7×10⁻²² s');
  });
  it('picks the right case for whole days and survives rounding at unit borders', () => {
    expect(s(halfLifeText(86400))).toBe('1 доба');
    expect(s(halfLifeText(2 * 86400))).toBe('2 доби');
    expect(s(halfLifeText(5 * 86400))).toBe('5 діб');
    expect(s(halfLifeText(59.99))).toBe('1 min');
    expect(s(halfLifeText(9999.9 * 31557600))).toBe('10 тис. р.');
  });
  it('agrees the day word with the displayed number', () => {
    expect(s(halfLifeText(138.376 * 86400))).toBe('138 діб');
    expect(s(halfLifeText(1.001 * 86400))).toBe('1 доба');
    expect(s(halfLifeText(5.001 * 86400))).toBe('5 діб');
    expect(s(halfLifeText(2.001 * 86400))).toBe('2 доби');
    expect(s(halfLifeText(2.5 * 86400))).toBe('2,5 доби');
    expect(s(halfLifeText(311.6 * 86400))).toBe('312 діб');
  });
  it('carries over at every unit border', () => {
    expect(s(halfLifeText(86399))).toBe('1 доба');
    expect(s(halfLifeText(3599.9))).toBe('1 h');
    expect(s(halfLifeText(31557599))).toBe('365 діб');
    expect(s(halfLifeText(31557600 * 0.9999e4))).toBe('10 тис. р.');
    expect(s(halfLifeText(31557600 * 999.6e3))).toBe('1 млн р.');
    expect(s(halfLifeText(999.6e9 * 31557600))).toBe('1,0×10¹² р.');
    expect(s(halfLifeText(999.6e6 * 31557600))).toBe('1 млрд р.');
    expect(s(halfLifeText(4.9996e-4))).toBe('0,5 ms');
    expect(s(halfLifeText(5e-4))).toBe('0,5 ms');
    expect(s(halfLifeText(4.9999e-10))).toBe('0,5 ns');
    expect(s(halfLifeText(5e-10))).toBe('0,5 ns');
    expect(s(halfLifeText(4.9e-10))).toBe('4,9×10⁻¹⁰ s');
    expect(s(halfLifeText(0.9996))).toBe('1 s');
    expect(s(energyText(999.6))).toBe('виділилось ≈ 1,0 MeV');
    for (const v of [59.99, 3599.9, 86399, 3.15e7, 3.1e14, 0.9999, 9.9999e-7]) expect(halfLifeText(v)).not.toMatch(/(^|\D)1\d{3}\D|\d{4,}/);
  });
  it('writes evaporated neutrons as a formula and keeps colons single', () => {
    const cap = { type: 'capture', projectile: 'd', from: { z: 5, n: 14 }, to: { z: 6, n: 14 }, q: 1000, pp: false } as const;
    expect(s(eventLine({ ...cap, evaporated: 1 }).text)).toContain('→ ²⁰C + n');
    expect(s(eventLine({ ...cap, evaporated: 3 }).text)).toContain('→ ²⁰C + 3n');
    expect(eventLine({ ...cap, evaporated: 3 }).text).not.toContain('вилетіл');
    const fis = eventLine(fireAt(startGame(92, 143), 'n').event).text;
    expect(fis).toContain('+ 3n');
    expect(fis).not.toContain('нейтрони');
    const auto = eventLine(autoDecay(startGame(4, 4), 0.5, 0).event).text;
    expect(auto.split(':').length - 1).toBe(1);
    const sf = eventLine({ type: 'fission', from: REF, induced: false, seconds: 5, auto: true,
      fission: { heavy: { z: 56, n: 85 }, light: { z: 36, n: 56 }, neutrons: 3, q: null, preset: false } }).text;
    expect(sf.split(':').length - 1).toBe(1);
    expect(sf).toContain('спонтанний поділ');
    expect(modeName('sf')).toBe('спонтанний поділ');
  });
  it('words the gamma refusal truthfully and drops binding for a lone proton', () => {
    const line = eventLine(knock(startGame(1, 0), 'n').event).text;
    expect(line).not.toContain('такого ядра немає');
    expect(cardRows(startGame(1, 0))[3]![1]).not.toContain('зв’язок');
    expect(cardRows(startGame(79, 118))[3]![1]).toContain('зв’язок');
  });
  it('never prints a broken number', () => {
    for (const v of [0, 1e-30, 1, 1e30, 1e300, Number.MAX_VALUE, NaN, Infinity, -1])
      for (const text of [halfLifeText(v), elapsedText(v)]) expect(text).not.toMatch(/NaN|Infinity|e\+|e-|undefined/);
    expect(s(elapsedText(0))).toBe('0 s');
    expect(s(halfLifeText(0))).toBe('0 s');
  });
  it('says released or needed', () => {
    expect(s(energyText(17589))).toBe('виділилось ≈ 17,6 MeV');
    expect(s(energyText(-8003))).toBe('потрібно ≈ 8,0 MeV');
    expect(s(energyText(18.59))).toBe('виділилось ≈ 18,6 keV');
    expect(s(energyText(-198036))).toBe('потрібно ≈ 198 MeV');
    expect(s(energyText(-99970))).toBe('потрібно ≈ 100 MeV');
    expect(energyText(null)).toBe('—');
    expect(energyText(NaN)).toBe('—');
  });
  it('names modes and charges in the glossary terms', () => {
    expect(modeName('b-')).toBe('β⁻-розпад');
    expect(modeName('ec')).toBe('захоплення електрона');
    expect(modeName('a')).toBe('α-розпад');
    expect(modeName('sf')).toContain('поділ');
    expect(s(chargeText(79, 79))).toBe('0 — нейтральний атом');
    expect(s(chargeText(79, 77))).toBe('+2 e — катіон');
    expect(s(chargeText(1, 2))).toBe('−1 e — аніон');
  });
  it('judges the nucleus', () => {
    expect(statusLine(getNuclide(79, 118)!).tone).toBe('green');
    expect(statusLine(getNuclide(82, 122)!).tone).toBe('green');
    expect(s(statusLine(getNuclide(82, 122)!).text)).toContain('розпаду не спостерігали');
    const c14 = statusLine(getNuclide(6, 8)!);
    expect(c14.tone).toBe('amber');
    expect(s(c14.text)).toContain('5700 р.');
    expect(c14.text).toContain('β⁻-розпад');
    expect(statusLine(getNuclide(4, 4)!).tone).toBe('red');
    expect(statusLine(getNuclide(3, 1)!).tone).toBe('red');
    expect(statusLine(getNuclide(3, 1)!).text).not.toMatch(BAD);
    expect(statusLine(getNuclide(92, 146)!).tone).toBe('amber');
  });
  it('keeps the card’s «Ядро» row short: half-life and main decay, the status word only when nothing else is said', () => {
    const row = (z: number, n: number): string => s(cardRows(startGame(z, n))[2]![1]!);
    expect(row(92, 146)).toBe('T½ 4,47 млрд р. · α-розпад');
    expect(row(92, 143)).toBe('T½ 704 млн р. · α-розпад');
    expect(row(6, 8)).toBe('T½ 5700 р. · β⁻-розпад');
    expect(row(4, 4)).toMatch(/^T½ .+ · α-розпад$/);
    expect(row(79, 118)).toBe('Стабільне ядро');
    expect(row(82, 122)).toBe('Довгоживуче ядро · розпаду не спостерігали');
    // the plate under the atom names the status: whenever the row has a half-life or a decay, it has no status word
    const words = [L.status.longLived, L.status.radioactive, L.status.fleeting];
    for (const x of allNuclides()) {
      const text = statusLine(x).text;
      if (x.branches.length > 0) expect(words.some((w) => text.includes(w)), `${x.z}-${x.n}`).toBe(false);
    }
  });
  it('fills the card and the event line', () => {
    const rows = cardRows(startGame(79, 118));
    expect(rows).toHaveLength(4);
    expect(rows[0]![1]).toBe('¹⁹⁷Au · Аурум (золото)-197');
    expect(rows[1]![1]).toBe('Z = 79 · N = 118 · A = 197');
    for (const row of cardRows(startGame(1, 0))) expect(row.join(' ')).not.toMatch(BAD);
    for (const row of cardRows(startGame(118, 178))) expect(row.join(' ')).not.toMatch(BAD);
    for (const turn of [fireAt(startGame(1, 0), 'n'), fireAt(startGame(118, 176), 'ca48'), knock(startGame(1, 0), 'p'),
                        waitForDecay(startGame(79, 118), 0.5, 0), fireAt(startGame(92, 143), 'n')])
      expect(eventLine(turn.event).text.length).toBeGreaterThan(5);
    expect(questDoneLine(3, 3)).toBe('Виконано за 3 ходи (найкраще — 3)');
    expect(questDoneLine(13, 11)).toBe('Виконано за 13 ходів (найкраще — 11)');
  });
  it('gives every refusal reason and every played mode a clean line', () => {
    for (const tool of TOOLS)
      for (const reason of REASONS) {
        const line = eventLine({ type: 'refused', tool, reason });
        expect(line.tone).toBe('warning');
        expect(line.text.length, `${tool}/${reason}`).toBeGreaterThan(5);
        expect(line.text).not.toMatch(BAD);
      }
    for (const mode of MODES) {
      expect(modeName(mode).length).toBeGreaterThan(3);
      const e: GameEvent = mode === 'sf'
        ? { type: 'fission', from: REF, fission: { heavy: { z: 56, n: 85 }, light: { z: 36, n: 56 }, neutrons: 3, q: null, preset: false },
            induced: false, seconds: 5, auto: false }
        : { type: 'decay', mode, from: REF, to: { z: 7, n: 7 }, seconds: 1e12, q: null, auto: false };
      const line = eventLine(e);
      expect(line.tone).toBe('ok');
      expect(line.text).not.toMatch(BAD);
      expect(line.text.toLowerCase()).toContain(modeName(mode));
    }
  });
  it('reads the sign of Q from the number, not the event type', () => {
    const base = { type: 'knockOut', what: 'n', from: REF, to: { z: 6, n: 7 } } as const;
    expect(s(eventLine({ ...base, q: -8000 }).text)).toContain('потрібно ≈ 8,0 MeV');
    expect(s(eventLine({ ...base, q: 500 }).text)).toContain('виділилось ≈ 500 keV');
    expect(eventLine({ ...base, q: null }).text).not.toMatch(BAD);
    const decay = { type: 'decay', mode: 'b-', from: REF, to: { z: 7, n: 7 }, seconds: 1, auto: false } as const;
    expect(s(eventLine({ ...decay, q: -30 }).text)).toContain('потрібно');
  });
  it('writes capture variants and tones', () => {
    const cap = { type: 'capture', projectile: 'n', from: { z: 1, n: 0 }, to: { z: 1, n: 1 }, q: 2224 } as const;
    const plain = eventLine({ ...cap, evaporated: 0, pp: false });
    expect(plain.tone).toBe('ok');
    expect(s(plain.text)).toContain('²H');
    const evap = eventLine({ ...cap, evaporated: 2, pp: false });
    expect(evap.text).toContain('+ 2n');
    expect(eventLine({ ...cap, projectile: 'p', evaporated: 0, pp: true }).text).not.toBe(plain.text);
    expect(eventLine({ type: 'bounce', projectile: 'n' }).tone).toBe('warning');
    expect(eventLine({ type: 'electrons', from: 3, to: 2 }).tone).toBe('info');
    expect(eventLine({ type: 'fragment', to: REF }).tone).toBe('info');
    const auto = autoDecay(startGame(4, 4), 0.5, 0);
    expect(eventLine(auto.event).text).not.toBe(eventLine({ ...(auto.event as Extract<GameEvent, { type: 'decay' }>), auto: false }).text);
  });
  it('writes every event kind produced by the game without broken text or foreign glyphs', () => {
    const fissioned = fireAt(startGame(92, 143), 'n');
    const turns = [
      fireAt(startGame(1, 0), 'n'), fireAt(startGame(1, 0), 'p'), fireAt(startGame(118, 176), 'ca48'),
      fireAt(startGame(2, 2), 'n'), knock(startGame(79, 118), 'n'), knock(startGame(1, 0), 'p'),
      waitForDecay(startGame(6, 8), 0.5, 0), waitForDecay(startGame(79, 118), 0.5, 0),
      waitForDecay(startGame(80, 117), 0.5, 0), autoDecay(startGame(4, 4), 0.5, 0), fissioned,
      waitForDecay(fissioned.state, 0.5, 0), chooseFragment(fissioned.state, 'heavy'),
      setElectrons(startGame(6, 6), 3), setElectrons(startGame(6, 6), 6),
    ];
    for (const turn of turns) {
      const line = eventLine(turn.event);
      expect(line.text, JSON.stringify(turn.event)).not.toMatch(BAD);
      expect(line.text).toMatch(ALLOWED);
    }
    for (const [z, n] of [[1, 0], [6, 8], [79, 118], [82, 122], [4, 4], [3, 1], [92, 146]] as const) {
      const state = startGame(z, n);
      for (const row of cardRows(state)) expect(row.join(' ')).toMatch(ALLOWED);
      expect(statusLine(getNuclide(z, n)!).text).toMatch(ALLOWED);
    }
    for (const v of [0, 1e-30, 1, 1e30, 14112, 4598208]) expect(halfLifeText(v)).toMatch(ALLOWED);
  });
});
