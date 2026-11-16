/**
 * DOM view of the sections under the step text (`hud/model/sections.ts`, WebGL twin `hud/step-sections.ts`):
 * «Терміни» / «Слова», «Формули», «Цифри і факти» / «Цікаво», «Хибне уявлення» — disclosure buttons
 * (`aria-expanded`, `aria-controls`), one body open at a time, revealed on the engine clock. An opened body
 * (and a term card) is scrolled into view inside the step text.
 */
import type { ReadingLevel, StepContent } from '@/content';
import { stepSections, MYTH_KICKER, type FactModel, type SectionModel, type TermModel } from '@/hud/model/sections';
import type { IconName } from '@/ui3d';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { nbDash, prose } from './typo';

let uid = 0;

/** A pill button (`variant`: '' secondary, 'primary', 'ghost', + 'sm'). */
export function btn(label: string, ic: IconName | null, variant: string, onClick: () => void): HTMLButtonElement {
  const b = h(`button.btn${variant ? `.${variant.split(' ').join('.')}` : ''}`, { type: 'button' });
  if (ic) b.append(icon(ic));
  b.append(h('span', null, label));
  b.addEventListener('click', onClick);
  return b;
}

/** The term card (also the one-sentence card of a simple word): kicker, name, definition, glossary link. */
export function termCard(t: TermModel, openGlossary: (name: string) => void): HTMLElement {
  return h(
    'div.kd.card.term-card',
    { 'data-ui': 'term-card' },
    h('div.kicker', null, t.kicker),
    h('div.card-title', null, nbDash(t.name)),
    prose('p', 'card-body', t.body),
    t.intl ? h('div.intl', { lang: 'en' }, t.intl) : null,
    t.glossary ? btn('Відкрити глосарій', 'glossary', 'ghost sm', () => openGlossary(t.name)) : null,
  );
}

function table(head: readonly string[] | null, rows: readonly (readonly string[])[], cls = ''): HTMLElement {
  return h(
    `table.kd-table${cls}`,
    null,
    head ? h('thead', null, h('tr', null, ...head.map((c) => prose('th', '', c)))) : null,
    h('tbody', null, ...rows.map((r) => h('tr', null, ...r.map((c) => prose('td', '', c))))),
  );
}

function factNode(f: FactModel): HTMLElement {
  if (f.kind === 'chip') return h('div.chip.fact.multi', null, icon('lightning'), prose('span', 'chip-text', f.text));
  const body =
    f.kind === 'table'
      ? [h('div.table-wrap', null, table(f.head, f.rows))]
      : f.cards.map((c) => h('div.fact-card', null, prose('div', 'fact-card-title', c.title), table(null, c.rows, '.kv')));
  return h('div.fact-table', null, ...body, f.note ? prose('p', 'note', f.note) : null);
}

function bodyOf(s: SectionModel, openGlossary: (name: string) => void, show: (el: HTMLElement) => void): HTMLElement {
  if (s.id === 'terms') {
    const slot = h('div.term-slot');
    let shown: TermModel | null = null;
    const chips = s.terms.map((t) => {
      const c = h('button.chip.term', { type: 'button', 'data-tip': 'Показати визначення', 'aria-expanded': 'false' }, icon('book'), t.name);
      c.addEventListener('click', () => {
        shown = shown === t ? null : t;
        for (const other of chips) other.setAttribute('aria-expanded', String(other === c && shown !== null));
        slot.replaceChildren(...(shown ? [termCard(t, openGlossary)] : []));
        if (shown) show(slot);
      });
      return c;
    });
    return h('div.sec-col', null, h('div.chips', null, ...chips), slot);
  }
  if (s.id === 'formulas')
    return h('div.sec-col', null, ...s.formulas.map((f) => prose('div', `formula${f.long ? ' long' : ''}`, `\`${f.text}\``)));
  if (s.id === 'facts') return h('div.sec-col', null, ...s.facts.map(factNode));
  return h(
    'div.sec-col',
    null,
    ...s.myths.map((m) =>
      h(
        'div.kd.card.myth',
        null,
        h('div.kicker', null, icon('warning'), MYTH_KICKER),
        m.title ? h('div.card-title', null, nbDash(m.title)) : null,
        prose('p', 'card-body', m.body),
      ),
    ),
  );
}

/**
 * Build the section bar and bodies for a step (copy at its reading level), or null when it has none. `reveal`
 * scrolls an opened body into view, keeping `keep` on screen (the panel knows its scroll area).
 */
export function buildDomSections(
  step: StepContent & { level?: ReadingLevel },
  openGlossary: (name: string) => void,
  reveal: (el: HTMLElement, keep: HTMLElement) => void,
): HTMLElement | null {
  const sections = stepSections(step);
  if (sections.length === 0) return null;
  const bar = h('div.sec-bar', { role: 'group', 'aria-label': 'Розділи кроку' });
  // an opened body (or term card) comes into view with the section buttons kept on screen
  const show = (el: HTMLElement): void => reveal(el, bar);
  const bodies = h('div.sec-bodies');
  const buttons: HTMLButtonElement[] = [];
  for (const s of sections) {
    const body = bodyOf(s, openGlossary, show);
    body.id = `kd-sec-${++uid}`;
    body.classList.add('sec-body');
    body.hidden = true;
    const p = presence(body);
    const b = btn(s.label, s.icon, 'sm', () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      buttons.forEach((other, k) => {
        if (other.getAttribute('aria-expanded') !== 'true') return;
        other.setAttribute('aria-expanded', 'false');
        // closing: a short fade; switching to another section: the old body leaves at once (no double height)
        presence(bodies.children[k] as HTMLElement).conceal({ instant: !open, dy: 6, scale: 1 });
      });
      if (open) return;
      b.setAttribute('aria-expanded', 'true');
      p.reveal({ dy: 8, scale: 1 });
      show(body);
    });
    b.dataset.ui = `section-${s.id}`;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', body.id);
    buttons.push(b);
    bar.append(b);
    bodies.append(body);
  }
  return h('div.sections', null, bar, bodies);
}
