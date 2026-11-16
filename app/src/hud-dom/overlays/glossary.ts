/**
 * DOM glossary of a volume (twin of `hud/overlays/glossary.ts`, model `hud/model/glossary*.ts`): a real
 * `<input type=search>` (no hidden-input bridge), the letter index (ґ, є, і, ї in place; Latin under `#`), the
 * parts of the volume as a filter, the volume / library scope switch while the library level is shown, rows with
 * the international form as a secondary line (`lang="en"`) and a link to the step that introduces the term.
 * `hud.open('glossary', name)` (a term link) fills the search with the name and marks that term.
 */
import type { GlossaryRecord } from '@/content';
import {
  focusRecord,
  prepareGlossary,
  searchGlossary,
  type PreparedGlossary,
} from '@/hud/model/glossary-search';
import { contentKey } from '@/content';
import {
  glossaryLetters,
  glossaryTabs,
  loadLibraryGlossary,
  loadVolumeGlossary,
  type GlossaryScope,
} from '@/hud/model/glossary';
import type { Journey } from '@/hud/journey';
import type { DomHud } from '../core/context';
import { h, setClass } from '../core/dom';
import { icon } from '../core/icons';
import { domSegmented } from '../dock/controls/inputs';
import type { DomControl } from '../dock/controls/types';
import { glossaryList } from './glossary-list';
import { domModal, type DomModal } from './modal';

export function domGlossary(dom: DomHud, journey: Journey): DomModal {
  const { hud } = dom;
  const library = hud.engine.library;
  const cache: Record<GlossaryScope, PreparedGlossary | null> = { volume: null, library: null };
  let scope: GlossaryScope = journey.volume.glossary.scope;
  let group = 'all';
  let letter = '';
  let focus: GlossaryRecord | null = null;

  const input = h('input.ov-search-input', {
    type: 'search',
    'data-ui': 'glossary-search',
    'data-keys': '',
    'aria-label': 'Пошук терміна',
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: 32,
  });
  const clear = h(
    'button.btn.icon.sm.ghost',
    { type: 'button', 'aria-label': 'Очистити пошук', 'data-ui': 'glossary-clear' },
    icon('close'),
  );
  const count = h('span.ov-count', { 'aria-live': 'polite' });
  const searchRow = h(
    'div.ov-search',
    null,
    h('label.ov-search-box', null, icon('search', 'ov-search-icon'), input, clear),
    count,
  );
  const scopeSlot = h('div.ov-scope');
  const tabsSlot = h('div.ov-tabs');
  const letters = h('div.ov-letters', { role: 'group', 'aria-label': 'Перша літера' });
  const body = h('div.ov-glossary-list');
  const list = glossaryList(hud, journey, body);
  body.append(list.el);
  let tabs: DomControl | null = null;

  const refilter = (): void => {
    const p = cache[scope];
    setClass(clear, 'off', input.value === '');
    if (!p) {
      count.textContent = '';
      return list.show([], { empty: 'Завантаження термінів…' });
    }
    const chapters =
      group === 'all' || scope === 'library'
        ? undefined
        : new Set(journey.chapters.filter((c) => c.group === group).map(contentKey));
    const hits = searchGlossary(p, {
      query: input.value,
      chapters,
      volume: scope === 'library' && group !== 'all' ? group : undefined,
      letter: letter || undefined,
    }).map((i) => p.records[i]!);
    count.textContent = `${hits.length} з ${p.records.length}`;
    list.show(hits, { focus, empty: 'Нічого не знайдено. Спробуйте інше слово або зніміть фільтри.' });
    body.scrollTop = 0;
  };

  const buildFilters = (): void => {
    const items = glossaryTabs(scope, journey, library);
    tabs = domSegmented({ type: 'segmented', id: 'glossary-tabs', items }, group, undefined, (id) => {
      group = id;
      focus = null;
      refilter();
    });
    tabs.el.dataset.ui = 'glossary-tabs';
    tabs.el.setAttribute('aria-label', scope === 'library' ? 'Томи' : 'Частини тому');
    tabsSlot.replaceChildren(tabs.el);
    letters.replaceChildren(
      ...glossaryLetters(cache[scope]?.records ?? null).map((ch) => {
        const b = h(
          'button.chip.ov-letter',
          { type: 'button', 'aria-pressed': String(ch === letter), 'data-ui': `glossary-letter:${ch}` },
          ch,
        );
        if (ch === '#') b.setAttribute('aria-label', 'Латиницею');
        b.addEventListener('click', () => {
          letter = letter === ch ? '' : ch;
          focus = null;
          for (const o of letters.children) o.setAttribute('aria-pressed', String(o === b && letter !== ''));
          refilter();
        });
        return b;
      }),
    );
    // the scope switch exists only while the library level is shown (more than one volume)
    scopeSlot.replaceChildren();
    if (hud.libraryLevel) {
      const items = [
        { id: 'volume', label: journey.volume.title },
        { id: 'library', label: 'Уся бібліотека' },
      ];
      const sw = domSegmented({ type: 'segmented', id: 'glossary-scope', items }, scope, undefined, (id) => {
        scope = id as GlossaryScope;
        group = 'all';
        letter = '';
        focus = null;
        load();
      });
      sw.el.dataset.ui = 'glossary-scope';
      sw.el.setAttribute('aria-label', 'Які терміни');
      sw.el
        .querySelectorAll<HTMLElement>('[role=radio]')
        .forEach((b, i) => (b.dataset.ui = `glossary-scope:${items[i]!.id}`));
      scopeSlot.append(sw.el);
    }
    requestAnimationFrame(() => tabs?.layout?.());
  };

  /** Records of the scope: from the cache, or loaded (the filters are rebuilt with the letters in use). */
  function load(): void {
    list.reset();
    buildFilters();
    refilter();
    if (cache[scope]) return;
    const wanted = scope;
    void (wanted === 'library' ? loadLibraryGlossary(library) : loadVolumeGlossary(journey)).then((r) => {
      cache[wanted] = prepareGlossary(r);
      if (scope !== wanted) return;
      if (focus === null && pendingFocus) focus = pick(pendingFocus);
      buildFilters();
      refilter();
    });
  }
  let pendingFocus = '';
  const pick = (name: string): GlossaryRecord | null => {
    const p = cache[scope];
    const i = p ? focusRecord(p, name) : -1;
    return i >= 0 ? p!.records[i]! : null;
  };

  input.addEventListener('input', () => {
    focus = null;
    refilter();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Esc empties the search first, then closes (the engine leaves keys in a text field alone)
    e.preventDefault();
    if (input.value) {
      input.value = '';
      refilter();
    } else hud.close();
  });
  clear.addEventListener('click', () => {
    input.value = '';
    focus = null;
    refilter();
    input.focus({ preventScroll: true });
  });

  const touch = (): boolean => hud.metrics.shell !== 'desk';
  const modal = domModal(dom, {
    name: 'glossary',
    title: 'Глосарій',
    icon: 'glossary',
    width: 920,
    build(root) {
      root.append(scopeSlot, searchRow, tabsSlot, letters, body);
    },
    onOpen(arg) {
      const name = typeof arg === 'string' ? arg : '';
      input.value = name;
      input.placeholder = touch() ? 'Шукати термін…' : 'Почніть друкувати, щоб знайти термін…';
      group = 'all';
      letter = '';
      pendingFocus = name;
      focus = name ? pick(name) : null;
      load();
    },
    // a phone's on-screen keyboard would cover the list: there the reader taps the field when they want it
    focus: () => (touch() ? null : input),
    key(e) {
      // typing anywhere in the dialog goes into the search (as the WebGL glossary's filter did)
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.key === ' ') return false;
      input.focus({ preventScroll: true });
      if (input.value.length >= 32) return true;
      input.value += e.key;
      focus = null;
      refilter();
      return true;
    },
  });
  modal.body.classList.add('ov-glossary-body');
  return modal;
}
