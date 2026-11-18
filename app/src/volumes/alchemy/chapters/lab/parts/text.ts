/**
 * The game's numbers and events in short Ukrainian strings: half-lives over forty orders of magnitude, energies,
 * decay names, the nuclide card, one line per game event. Pure functions; the words live in `labels.ts`.
 * Numbers follow the course style: three significant digits, decimal comma, no-break space before the unit.
 */
import { fmtNumber, NBSP, plural, superscript } from '@/content';
import { bindingPerNucleon, getNuclide, ionSymbol, nuclideName, nuclideSymbol } from '@alchemy/sim/core';
import type { DecayCode, Nuclide, NuclideRef } from '@alchemy/sim/core';
import { PROJECTILES } from '@alchemy/sim/lab';
import type { GameEvent, GameState, PlayedMode, ProjectileId, Refusal } from '@alchemy/sim/lab';
import { L } from '../labels';

export type Tone = 'green' | 'amber' | 'red' | 'mist';

const NONE = L.energy.unknown;
const SEP = ' · ';
const YEAR_S = 31_557_600;
const DAY_S = 86_400;

const forms = (text: string): [string, string, string] => text.split('|') as [string, string, string];
const unit = (value: string, u: string): string => `${value}${NBSP}${u}`;

/** Three significant digits, trailing zeros dropped: 12,3 · 4,47 · 163. */
function sig3(value: number): string {
  const abs = Math.abs(value);
  return fmtNumber(value, { maxDigits: abs >= 100 ? 0 : abs >= 10 ? 1 : 2, group: false });
}

/** `2,0×10¹⁹`: one decimal in the mantissa, always shown. */
function sciText(value: number): string {
  let exp = Math.floor(Math.log10(value));
  let mantissa = Math.round((value / 10 ** exp) * 10) / 10;
  if (mantissa >= 10) { mantissa /= 10; exp += 1; }
  return `${fmtNumber(mantissa, { digits: 1 })}×10${superscript(exp)}`;
}

const sciOrZero = (value: number, u: string): string => unit(sciText(value), u);

/**
 * Time in the unit that reads best (below a second a unit starts at half of it: 0,58 ms, but 163 μs); `0` → «0 s»; anything not a finite non-negative number → «—».
 */
export function halfLifeText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return NONE;
  const U = L.units;
  if (seconds === 0) return unit('0', U.second);
  if (seconds >= YEAR_S) {
    const years = seconds / YEAR_S;
    const tiers: readonly (readonly [limit: number, divisor: number, name: string])[] = [
      [1e4, 1, U.year], [1e6, 1e3, U.kiloYear], [1e9, 1e6, U.megaYear], [1e12, 1e9, U.gigaYear],
    ];
    for (let i = 0; i < tiers.length; i++) {
      const [limit, divisor, name] = tiers[i]!;
      if (years >= limit) continue;
      const rounded = Number(sig3(years / divisor));
      // 9999,9 р. rounds to 10 000: that reads better as the next tier.
      if (rounded * divisor >= limit && i + 1 < tiers.length) return unit(sig3(years / tiers[i + 1]![1]), tiers[i + 1]![2]);
      return unit(sig3(years / divisor), name);
    }
    return sciOrZero(years, U.year);
  }
  if (seconds >= DAY_S) {
    const days = seconds / DAY_S;
    const text = sig3(days);
    return Number.isInteger(Number(text)) && Number(text) === days
      ? unit(text, plural(days, forms(U.day)))
      : unit(text, forms(U.day)[1]);
  }
  const scaled: readonly (readonly [min: number, per: number, name: string])[] = [
    [3600, 3600, U.hour], [60, 60, U.minute], [1, 1, U.second], [5e-4, 1e-3, U.milli], [5e-7, 1e-6, U.micro], [5e-10, 1e-9, U.nano],
  ];
  for (let i = 0; i < scaled.length; i++) {
    const [min, per, name] = scaled[i]!;
    if (seconds < min) continue;
    const value = seconds / per;
    // 59,99 s rounds to 60: show it as 1 min instead.
    const up = scaled[i - 1];
    if (up && Number(sig3(value)) * per >= up[1]) return unit(sig3(seconds / up[1]), up[2]);
    return unit(sig3(value), name);
  }
  return sciOrZero(seconds, U.second);
}

/** Elapsed game time reads exactly like a half-life. */
export function elapsedText(seconds: number): string {
  return halfLifeText(seconds);
}

/** «виділилось ≈ 17,6 MeV» / «потрібно ≈ 8,0 MeV»; the word comes from the sign of the number. */
export function energyText(q: number | null): string {
  if (q === null || !Number.isFinite(q)) return NONE;
  const word = q >= 0 ? L.energy.released : L.energy.needed;
  const abs = Math.abs(q);
  let value: string;
  let u: string;
  if (abs >= 1000) {
    const mev = abs / 1000;
    value = Math.round(mev * 10) / 10 >= 100 ? fmtNumber(mev, { digits: 0, group: false }) : fmtNumber(mev, { digits: 1 });
    u = L.units.mev;
  } else {
    value = sig3(abs);
    u = L.units.kev;
  }
  return `${word} ≈ ${unit(value, u)}`;
}

/** The name of a decay mode in the glossary's terms. */
export function modeName(mode: PlayedMode): string {
  return L.modes[mode];
}

const codeName = (code: DecayCode): string => L.modes[code];

export function statusLine(x: Nuclide): { readonly text: string; readonly tone: Tone } {
  const S = L.status;
  const half = typeof x.halfLife === 'number' ? `${S.halfLife} ${halfLifeText(x.halfLife)}` : S.halfLifeUnknown;
  const main = x.branches[0] ? codeName(x.branches[0].code) : null;
  const join = (...parts: (string | null)[]): string => parts.filter((p): p is string => p !== null).join(SEP);
  switch (x.status) {
    case 'stable':
      return { text: S.stable, tone: 'green' };
    case 'longLived':
      return { text: join(S.longLived, main === null ? S.notObserved : half, main), tone: 'green' };
    case 'radioactive':
      return { text: join(S.radioactive, half, main), tone: 'amber' };
    case 'fleeting':
      return { text: join(S.fleeting, half, main), tone: 'red' };
    case 'incomplete':
      return { text: S.incomplete, tone: 'mist' };
  }
}

/** «0 — нейтральний атом» · «+2 e — катіон» · «−1 e — аніон». */
export function chargeText(z: number, electrons: number): string {
  const charge = z - electrons;
  if (charge === 0) return `0 — ${L.charge.neutral}`;
  const sign = charge > 0 ? '+' : '−';
  return `${sign}${Math.abs(charge)}${NBSP}e — ${charge > 0 ? L.charge.cation : L.charge.anion}`;
}

/** Four rows of `[label, value]`: atom, makeup, nucleus, charge and binding. */
export function cardRows(state: GameState): string[][] {
  const { z, n, electrons } = state;
  const C = L.card;
  const x = getNuclide(z, n);
  const binding = x ? bindingPerNucleon(x) : null;
  const charge = chargeText(z, electrons);
  return [
    [C.atom, `${ionSymbol(z, n, electrons)}${SEP}${nuclideName(z, n)}`],
    [C.makeup, `Z = ${z}${SEP}N = ${n}${SEP}A = ${z + n}`],
    [C.nucleus, x ? statusLine(x).text : L.status.notInTable],
    [C.chargeAndBinding, binding === null || !Number.isFinite(binding)
      ? charge
      : `${charge}${SEP}${C.binding} ${unit(fmtNumber(binding / 1000, { maxDigits: 2 }), `${L.units.mev} ${C.perNucleon}`)}`],
  ];
}

/** Capitalises a Cyrillic or Latin first letter; Greek ones (β, α) stay as they are: capitals are not in the font. */
const capital = (text: string): string =>
  /^[\p{Script=Cyrillic}a-z]/u.test(text) ? text.charAt(0).toUpperCase() + text.slice(1) : text;
const sym = (x: NuclideRef): string => nuclideSymbol(x.z, x.n);
const projectileSymbol = (id: ProjectileId): string => PROJECTILES.find((p) => p.id === id)?.symbol ?? id;
const neutrons = (k: number): string => `${k} ${plural(k, forms(L.events.neutron))}`;
const withEnergy = (text: string, q: number | null): string => {
  const energy = energyText(q);
  return energy === NONE ? text : `${text}${SEP}${energy}`;
};

function refusalText(tool: ProjectileId | 'gamma-n' | 'gamma-p' | 'wait' | 'fragment' | 'electrons', reason: Refusal): string {
  const R = L.refusal;
  switch (reason) {
    case 'stable': return R.stable;
    case 'notObserved': return R.notObserved;
    case 'noData': return R.noData;
    case 'needsElectron': return R.needsElectron;
    case 'pending': return R.pending;
    case 'noProduct':
      return tool === 'gamma-n' || tool === 'gamma-p' ? R.noProductGamma : tool === 'fragment' ? R.noProductFragment : R.noProduct;
  }
}

type Line = { readonly text: string; readonly tone: 'ok' | 'info' | 'warning' };

/** One line per game event. `ok` — the nucleus changed; `info` — electrons and fragment choice; `warning` — refusal or bounce. */
export function eventLine(e: GameEvent): Line {
  const E = L.events;
  switch (e.type) {
    case 'capture': {
      if (e.pp) return { text: withEnergy(`${E.fusion}: ${sym(e.from)} + ${projectileSymbol(e.projectile)} → ${sym(e.to)}`, e.q), tone: 'ok' };
      const evaporated = e.evaporated > 0 ? `, ${E.evaporated} ${neutrons(e.evaporated)}` : '';
      return {
        text: withEnergy(`${E.capture}: ${sym(e.from)} + ${projectileSymbol(e.projectile)} → ${sym(e.to)}${evaporated}`, e.q),
        tone: 'ok',
      };
    }
    case 'bounce':
      return { text: `${E.bounce}: ${projectileSymbol(e.projectile)} — ${E.bounceNote}`, tone: 'warning' };
    case 'knockOut': {
      const what = e.what === 'n' ? forms(E.neutron)[0] : E.proton;
      return { text: withEnergy(`${E.knock} ${what}: ${sym(e.from)} → ${sym(e.to)}`, e.q), tone: 'ok' };
    }
    case 'decay': {
      const head = e.auto ? `${E.autoDecay}: ` : '';
      const body = `${modeName(e.mode)}: ${sym(e.from)} → ${sym(e.to)}${SEP}${E.elapsed} ${elapsedText(e.seconds)}`;
      return { text: head + (e.auto ? withEnergy(body, e.q) : capital(withEnergy(body, e.q))), tone: 'ok' };
    }
    case 'fission': {
      const f = e.fission;
      const parts = `${sym(f.heavy)} + ${sym(f.light)}${f.neutrons > 0 ? ` + ${neutrons(f.neutrons)}` : ''}`;
      const head = e.induced
        ? `${E.fission}: ${sym(e.from)} + n → ${parts}`
        : `${e.auto ? `${E.autoDecay}: ${modeName('sf')}` : capital(modeName('sf'))}: ${sym(e.from)} → ${parts}${SEP}${E.elapsed} ${elapsedText(e.seconds)}`;
      return { text: `${withEnergy(head, f.q)}. ${E.chooseFragment}`, tone: 'ok' };
    }
    case 'fragment':
      return { text: `${E.fragment} ${sym(e.to)}`, tone: 'info' };
    case 'electrons':
      return { text: `${E.electrons}: ${e.from === e.to ? `${e.to}, ${E.electronsSame}` : `${e.from} → ${e.to}`}`, tone: 'info' };
    case 'refused':
      return { text: refusalText(e.tool, e.reason), tone: 'warning' };
  }
}

/** «Виконано за 3 ходи (найкраще — 3)». */
export function questDoneLine(moves: number, best: number): string {
  const Q = L.quest;
  return `${Q.done} ${moves} ${plural(moves, forms(Q.move))} (${Q.best} — ${best})`;
}
