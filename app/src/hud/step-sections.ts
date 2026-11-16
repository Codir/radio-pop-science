/**
 * The expandable sections under a step's text: key terms (chips that open their definition), formulas,
 * «Цифри і факти», misconceptions. One section is open at a time, so the panel stays compact. At the simple reading
 * level (a `LeveledStep` from `./level`) the chips read «Слова» and «Цікаво»; the selector already left out formulas.
 */
import type { ReadingLevel, StepContent } from '@/content';
import {
  Button,
  Card,
  Chip,
  FormulaBlock,
  Label,
  Table,
  TEXT_COLOR,
  UI,
  UiNode,
  conceal,
  reveal,
  type IconName,
} from '@/ui3d';
import type { HudContext } from './context';
import { MYTH_KICKER, stepSections, type FactModel, type TermModel } from './model/sections';

interface Section {
  id: string;
  button: Button;
  body: UiNode;
}

function termCard(hud: HudContext, term: TermModel): UiNode {
  return new Card({
    width: 'fill',
    kicker: term.kicker,
    title: term.name,
    body: term.body,
    extra: [
      ...(term.intl
        ? [new Label(term.intl, { size: UI.text.caption, color: TEXT_COLOR.mute, rich: false }, { width: 'fill' })]
        : []),
      ...(term.glossary
        ? [
            new Button({
              label: 'Відкрити глосарій',
              icon: 'glossary',
              variant: 'ghost',
              size: 'sm',
              alignSelf: 'start',
              onClick: () => hud.open('glossary', term.name),
            }),
          ]
        : []),
    ],
  });
}

/**
 * A fact chip, or a real table when the document wrote the fact as a Markdown table. Tables wider than four
 * columns do not fit the 420 px-eq panel: each row becomes a small key–value card instead (`model/sections.ts`).
 */
function factNode(f: FactModel): UiNode {
  if (f.kind === 'chip') return new Chip({ kind: 'fact', text: f.text, maxWidth: 360, width: 'fill' });
  const body: UiNode[] =
    f.kind === 'table'
      ? [new Table({ head: f.head, rows: f.rows })]
      : f.cards.map(
          (c) =>
            new UiNode({
              dir: 'col',
              gap: 2,
              width: 'fill',
              children: [
                new Label(c.title, { font: 'bodyBold', size: UI.text.small, color: 'yellow' }, { width: 'fill' }),
                new Table({ rows: c.rows, size: UI.text.caption }),
              ],
            }),
        );
  return new UiNode({
    dir: 'col',
    gap: 8,
    width: 'fill',
    children: [
      ...body,
      f.note ? new Label(f.note, { size: UI.text.caption, color: TEXT_COLOR.mute }, { width: 'fill' }) : null,
    ],
  });
}

/** Build the accordion for a step. Returns null when the step has nothing to put in it. */
export function buildSections(hud: HudContext, step: StepContent & { level?: ReadingLevel }): UiNode | null {
  const sections: Section[] = [];
  const bar = new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill' });
  const bodies = new UiNode({ dir: 'col', width: 'fill' });
  let open: Section | null = null;
  const toggle = (s: Section): void => {
    const next = open === s ? null : s;
    if (open) {
      open.button.selected = false;
      conceal(open.body, { dy: 6, scale: 1 });
    }
    open = next;
    if (next) {
      next.button.selected = true;
      reveal(next.body, { dy: 8, scale: 1 });
    }
    hud.relayout();
  };
  const add = (id: string, label: string, icon: IconName, body: UiNode): void => {
    body.visible = false;
    body.opacity = 0;
    const section: Section = {
      id,
      body,
      button: new Button({ name: `section-${id}`, label, icon, size: 'sm', onClick: () => toggle(section) }),
    };
    sections.push(section);
    bar.add(section.button);
    bodies.add(body);
  };

  for (const sec of stepSections(step)) {
    if (sec.id === 'terms') {
      const slot = new UiNode({ dir: 'col', width: 'fill' });
      const chips = new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill' });
      let shown: TermModel | null = null;
      for (const t of sec.terms) {
        chips.add(
          new Chip({
            kind: 'term',
            text: t.name,
            tooltip: 'Показати визначення',
            onClick: () => {
              slot.clear();
              shown = shown === t ? null : t;
              if (shown) slot.add(termCard(hud, t));
              hud.relayout();
            },
          }),
        );
      }
      add(sec.id, sec.label, sec.icon, new UiNode({ dir: 'col', gap: 10, width: 'fill', children: [chips, slot] }));
    } else if (sec.id === 'formulas') {
      const children = sec.formulas.map(
        (f) => new FormulaBlock({ formula: f.text, size: f.long ? UI.text.small : UI.text.h3 }),
      );
      add(sec.id, sec.label, sec.icon, new UiNode({ dir: 'col', gap: 8, width: 'fill', children }));
    } else if (sec.id === 'facts') {
      const children = sec.facts.map(factNode);
      add(sec.id, sec.label, sec.icon, new UiNode({ dir: 'col', gap: 8, width: 'fill', children }));
    } else {
      const children = sec.myths.map(
        (m) =>
          new Card({
            width: 'fill',
            accent: 'amber',
            kicker: MYTH_KICKER,
            icon: 'warning',
            title: m.title ?? undefined,
            body: m.body,
          }),
      );
      add(sec.id, sec.label, sec.icon, new UiNode({ dir: 'col', gap: 8, width: 'fill', children }));
    }
  }

  if (sections.length === 0) return null;
  return new UiNode({ dir: 'col', gap: 10, width: 'fill', children: [bar, bodies] });
}

/** Small caption used above groups inside the panel. */
export function caption(text: string): Label {
  return new Label(text.toUpperCase(), {
    font: 'bodyBold',
    size: UI.text.caption,
    color: TEXT_COLOR.mute,
    letterSpacing: 0.08,
    nowrap: true,
  });
}
