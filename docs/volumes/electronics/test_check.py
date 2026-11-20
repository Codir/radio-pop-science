#!/usr/bin/env python3
"""Tests for docs/volumes/electronics/check.py: one test per rule on small hand-written documents.

The micro sign and the straight apostrophe appear here only as escapes: rule 4 reads this file too.
Usage: python3 docs/volumes/electronics/test_check.py
"""
import pathlib
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check as K  # noqa: E402

V = {'groups': [{'id': 'prologue', 'layer': 'prologue'}, {'id': 'resistor', 'layer': 'path'},
                {'id': 'practicum', 'layer': 'practicum'}, {'id': 'branches', 'layer': 'branch'}],
     'journey': [
         {'id': 'prologue', 'group': 'prologue', 'title': 'Музика з плеєра ледь чути. Що поставити між ним і динаміком?',
          'minutes': 5},
         {'id': 'resistor', 'group': 'resistor', 'title': 'Навіщо схемі деталь, яка лише заважає струму?', 'minutes': 10},
         {'id': 'sensors', 'group': 'branches', 'parent': 'resistor', 'title': 'Які резистори відчувають тепло й світло?',
          'minutes': 8},
         {'id': 'build', 'group': 'practicum', 'title': 'Зберіть підсилювач самі', 'minutes': 12}]}

ROW = '| 2 | `resistor` | Навіщо схемі деталь, яка лише заважає струму? | 10 |\n'
SENSORS = '### `sensors` — Які резистори відчувають тепло й світло?\n'
LAW = ('- `resistor/law` — Що більший опір, то менший струм.\n'
       '  **Дія:** ставити резистори.\n'
       '  **Терміни:** закон Ома\n'
       '  **Формула:** `I = U / R` — «Висновок»\n')
PATH = ('# Шлях\n\n## Основний шлях\n\n| № | id | Назва-питання | ≈ хв |\n|---|---|---|---|\n'
        '| 0 | `prologue` | Музика з плеєра ледь чути. Що поставити між ним і динаміком? | 5 |\n' + ROW
        + '| — | `build` | Практикум. Зберіть підсилювач самі | 12 |\n\n## Кроки шляху\n\n'
        '### 0. `prologue` — Музика з плеєра ледь чути. Що поставити між ним і динаміком?\n\n'
        '- `prologue/quiet` — Плеєр ледь шепоче.\n  **Терміни:** —\n  **Формула:** —\n\n'
        '### 2. `resistor` — Навіщо схемі деталь, яка лише заважає струму?\n\n'
        '- `resistor/limit` — Резистор рятує світлодіод.\n  **Терміни:** світлодіод, резистор\n  **Формула:** —\n'
        + LAW + '\n## Гілки\n\n' + SENSORS
        + '\n- `sensors/heat` — Опір падає з теплом.\n  **Терміни:** терморезистор\n  **Формула:** —\n\n'
        '## Практикуми\n\n### `build` — Практикум. Зберіть підсилювач самі\n\n'
        '- `build/play` — Ціль: підсилювач грає.\n  **Терміни:** —\n  **Формула:** —\n')
LEDGER = ('# Реєстр\n\n## Терміни шляху\n\n| № | Термін | Крок |\n|---|---|---|\n'
          '| 1 | резистор | `resistor/limit` |\n| 2 | світлодіод | `resistor/limit` |\n'
          '| 3 | закон Ома | `resistor/law` |\n\n'
          '## Терміни гілок\n\n| № | Термін | Крок |\n|---|---|---|\n| 1 | терморезистор | `sensors/heat` |\n\n'
          '## Формули\n\n| № | Формула | Крок | Повторюється |\n|---|---|---|---|\n'
          '| 1 | `I = U / R` | `resistor/law` | `build/play` |\n\n'
          '## Чесна фізика\n\nСказано в «Докладніше» `prologue/quiet`; `sim/core` і `resistor/*` — не кроки.\n')
# The deviations as circuit's PATH.md writes them: one line each, beginning with the step.
NOTES = ('\n## Де сценарії свідомо відступили від цього шляху (21.11.2026)\n\n'
         '- `resistor/law` — два резистори замість чотирьох → `chapters/resistor.md`.\n'
         '- `resistor/limit`, `prologue/quiet` — інша дія; друге речення\n'
         '  перенесено в «Докладніше» → `chapters/resistor.md`.\n')
CARD = '| резистор | `\\bрезистор\\w*` | `resistor/limit` | шлях | Деталь, що стримує струм. |\n'
TERMS = '## Терміни шляху\n\n| Термін | Форми | Крок | Тип | Картка |\n|---|---|---|---|---|\n' + CARD
# Topics the course never touches (rule 5), and innocent words close to them.
HIT = ('Увімкніть адаптер у розетку.', 'Живлення від мережі.', 'Напруга мережі велика.', 'Мережевий шнур.', 'Там 220 вольт.',
       'Конденсатор вибухне.', 'Як підпалити резистор?', 'Задимлення стенда.', 'Без вогню.', 'Полум’я над платою.',
       'Пожежа в кімнаті.', 'Підірвати батарею.', 'Електромережа будинку.', '230V у стіні.')
FREE = ('Вогник зарядки ще світить.', 'Вогні світлофора.', 'Резистор згоряє.', 'Світлодіод загоряється.',
        'Конденсатор здувається й випускає пару.', 'Спалах світлодіода.', 'Електроліт на 16 V.', 'Діод на 1000 V навпаки.',
        'Над резистором димок.', 'Мережка на скатертині.', 'Напруга 2,30 V.')


class CheckTest(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(K.rule1(V, PATH) + K.rule2(V, PATH) + K.rule3(V, PATH, LEDGER, TERMS) + K.rule5(PATH, {}, TERMS),
                         [])

    def test_main_path(self):
        title = '| Навіщо схемі деталь, яка лише заважає струму? | 10 |'
        self.assertEqual(K.rule1(V, PATH.replace(ROW, ROW.replace('| 10 |', '| 9 |'))),
                         ['PATH.md: `resistor`: 9 хв ≠ volume.json 10'])
        self.assertEqual(K.rule1(V, PATH.replace(title, '| навіщо схемі деталь, яка лише заважає струму | 10 |')), [])
        self.assertEqual(K.rule1(V, PATH.replace(title, '| Навіщо схемі резистор? | 10 |')),
                         ['PATH.md: `resistor`: title differs from volume.json'])
        self.assertEqual(K.rule1(V, PATH.replace(ROW, '')), ['PATH.md: no main-path row for `resistor`'])
        self.assertEqual(K.rule1(V, PATH.replace(ROW, ROW + ROW)), ['PATH.md: main-path row `resistor` appears 2 times'])
        self.assertEqual(K.rule1(V, PATH.replace(ROW, ROW.replace('`resistor`', '`sensors`'))),
                         ['PATH.md: no main-path row for `resistor`', 'PATH.md: main-path row `sensors` is a branch'])
        first = '| 0 | `prologue` | Музика з плеєра ледь чути. Що поставити між ним і динаміком? | 5 |\n'
        self.assertEqual(K.rule1(V, PATH.replace(first + ROW, ROW + first)), ['PATH.md: main-path rows are out of order'])

    def test_headings(self):
        self.assertEqual(K.rule2(V, PATH.replace(SENSORS, '')),
                         ['PATH.md: no heading for `sensors`',
                          'PATH.md:32: step `sensors/heat` stands outside a chapter heading'])
        self.assertEqual(K.rule2(V, PATH + SENSORS), ['PATH.md: 2 headings for `sensors`'])
        self.assertEqual(K.rule2(V, PATH.replace(SENSORS, SENSORS.replace('тепло й світло', 'тепло'))),
                         ['PATH.md: heading `sensors`: title differs from volume.json'])
        self.assertEqual(K.rule2(V, PATH + '### `ghost` — Що це?\n'),
                         ['PATH.md: heading for `ghost` is not in the journey'])
        # a step item under any other H2 is a misplaced step (the deviations: test_deviations)
        self.assertEqual(K.rule2(V, PATH + '\n## Ризики\n\n- `resistor/law` — ще раз.\n'),
                         ['PATH.md:47: step `resistor/law` stands outside a chapter heading',
                          'PATH.md: step `resistor/law` appears 2 times'])

    def test_deviations(self):  # the lines of «Де сценарії свідомо відступили…» are notes, not steps
        doc = PATH + NOTES
        self.assertEqual(K.parse_path(doc), K.parse_path(PATH))
        self.assertEqual(K.rule1(V, doc) + K.rule2(V, doc) + K.rule3(V, doc, LEDGER, TERMS) + K.rule5(doc, {}, TERMS),
                         [])
        # the section ends at the next H2: an item after it is a step again
        self.assertEqual(K.rule2(V, doc + '\n## Ризики\n\n- `resistor/law` — ще раз.\n'),
                         ['PATH.md:53: step `resistor/law` stands outside a chapter heading',
                          'PATH.md: step `resistor/law` appears 2 times'])

    def test_steps(self):
        heads, steps = K.parse_path(PATH)
        self.assertEqual(sorted(heads), ['build', 'prologue', 'resistor', 'sensors'])
        self.assertEqual([s['id'] for s in steps],
                         ['prologue/quiet', 'resistor/limit', 'resistor/law', 'sensors/heat', 'build/play'])
        law = steps[2]
        self.assertEqual((law['chapter'], law['under'], law['line']), ('resistor', 'resistor', 24))
        self.assertEqual(K.terms_of(law['fields']['Терміни']), ['закон Ома'])
        self.assertEqual(K.formulas_of(law['fields']['Формула']), ['I = U / R'])
        self.assertEqual(law['fields']['idea'], 'Що більший опір, то менший струм.')
        self.assertEqual(K.terms_of('—'), [])
        self.assertEqual(K.terms_of(' резистор,  світлодіод. '), ['резистор', 'світлодіод'])

    def test_register(self):
        self.assertEqual(K.rule3(V, PATH, LEDGER.replace('Сказано', 'Див. `resistor/ohm`. Сказано')),
                         ['PATH-ledger.md:25: `resistor/ohm` is not a step of PATH.md'])
        self.assertEqual(K.rule3(V, PATH, LEDGER.replace('`sensors/heat`', '`nope/heat`')),
                         ['PATH-ledger.md: «терморезистор» → `nope/heat`: no such chapter in the journey',
                          "PATH.md: `sensors/heat`: terms ['терморезистор'] ≠ PATH-ledger.md []"])
        self.assertEqual(K.rule3(V, PATH, LEDGER.replace('| 1 | терморезистор |', '| 1 | резистор |')),
                         ['PATH-ledger.md: «резистор» listed twice',
                          "PATH.md: `sensors/heat`: terms ['терморезистор'] ≠ PATH-ledger.md ['резистор']"])
        self.assertEqual(K.rule3(V, PATH.replace('**Терміни:** закон Ома', '**Терміни:** —'), LEDGER),
                         ["PATH.md: `resistor/law`: terms [] ≠ PATH-ledger.md ['закон Ома']"])
        self.assertEqual(K.rule3(V, PATH.replace('  **Терміни:** закон Ома\n', ''), LEDGER),
                         ['PATH.md: `resistor/law`: no «Терміни»'])

    def test_formulas(self):
        self.assertEqual(K.rule3(V, PATH.replace('`I = U / R` — «Висновок»', '`I = U / R`, `U = I × R`'), LEDGER),
                         ['PATH.md: `resistor/law`: 2 new formulas (at most one)',
                          "PATH.md: `resistor/law`: formula ['I = U / R', 'U = I × R'] ≠ PATH-ledger.md ['I = U / R']"])
        self.assertEqual(K.rule3(V, PATH.replace('`I = U / R` — «Висновок»', '—'), LEDGER),
                         ["PATH.md: `resistor/law`: formula [] ≠ PATH-ledger.md ['I = U / R']"])
        self.assertEqual(K.rule3(V, PATH.replace('  **Формула:** `I = U / R` — «Висновок»\n', ''), LEDGER),
                         ['PATH.md: `resistor/law`: no «Формула»'])
        self.assertEqual(K.rule3(V, PATH, LEDGER.replace('| `build/play` |', '| `build/burn` |')),
                         ['PATH-ledger.md:21: `build/burn` is not a step of PATH.md'])

    def test_terms_document(self):  # chapters/_terms.md, once it exists, agrees with the ledger
        self.assertEqual(K.rule3(V, PATH, LEDGER, None), K.rule3(V, PATH, LEDGER, TERMS))
        self.assertEqual(K.rule3(V, PATH, LEDGER, TERMS.replace('`resistor/limit`', '`resistor/law`')),
                         ['_terms.md: «резистор» → `resistor/law`, PATH-ledger.md → `resistor/limit`'])
        self.assertEqual(K.rule3(V, PATH, LEDGER, TERMS + CARD.replace('резистор', 'ом')),
                         ['_terms.md: «ом» is not in PATH-ledger.md'])
        law = CARD.replace('| резистор |', '| закон Ома |').replace('resistor/limit', 'resistor/law')
        full = TERMS + CARD.replace('| резистор |', '| світлодіод |') + law
        self.assertEqual(K.rule3(V, PATH, LEDGER, full), [])
        self.assertEqual(K.missing_terms(LEDGER, TERMS),
                         ['_terms.md: «світлодіод» is missing', '_terms.md: «закон Ома» is missing'])
        self.assertEqual(K.missing_terms(LEDGER, None), [])
        self.assertEqual(K.missing_terms(LEDGER, full), [])

    def test_characters(self):
        text = '470 \N{MICRO SIGN}F\nп\N{APOSTROPHE}ять\n`п[’\N{APOSTROPHE}]ять`\nп’ять\n'
        self.assertEqual(K.rule4({'docs/volumes/electronics/PATH.md': text}), [
            'docs/volumes/electronics/PATH.md:1: micro sign U+00B5 (write U+03BC)',
            'docs/volumes/electronics/PATH.md:2: straight apostrophe in «п\N{APOSTROPHE}ять» (write U+2019)'])

    def test_files(self):  # rule 4 reads the volume's documents, its code and its sandboxes, nothing else
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            for rel in ('docs/volumes/electronics/PATH.md', 'docs/volumes/electronics/chapters/meter.md',
                        'app/src/volumes/electronics/volume.json', 'app/src/volumes/electronics/sim/core/dc.ts',
                        'app/src/volumes/_dev/chapters/_sandbox-electronics-bench/index.ts',
                        'app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts',
                        'app/src/volumes/radio/volume.json', 'docs/volumes/radio/PATH.md',
                        'app/src/volumes/electronics/shared/picture.png'):
                (root / rel).parent.mkdir(parents=True, exist_ok=True)
                (root / rel).write_text('x', encoding='utf-8')
            self.assertEqual(sorted(K.checked_files(root)), [
                'app/src/volumes/_dev/chapters/_sandbox-electronics-bench/index.ts',
                'app/src/volumes/electronics/sim/core/dc.ts', 'app/src/volumes/electronics/volume.json',
                'docs/volumes/electronics/PATH.md', 'docs/volumes/electronics/chapters/meter.md'])

    def test_nowhere(self):
        for s in HIT:
            self.assertEqual(len(K.rule5('', {'chapters/x.md': s + '\n'}, None)), 1, s)
        for s in FREE:
            self.assertEqual(K.rule5('', {'chapters/x.md': s + '\n'}, None), [], s)
        self.assertEqual(K.rule5('', {'chapters/meter.md': 'Рядок.\nУвімкніть у розетку.\n'}, None),
                         ['chapters/meter.md:2: «розетку» is a topic the course never touches'])
        # the steps of PATH.md are read, the rest of it is not (the safety rules name the topics they forbid)
        self.assertEqual(K.rule5(PATH.replace('ледь шепоче.', 'ледь шепоче, як із розетки.'), {}, None),
                         ['PATH.md:15: `prologue/quiet`: «розетки» is a topic the course never touches'])
        self.assertEqual(K.rule5('**Безпека.** Курс ніде не працює з мережею 230 V.\n' + PATH, {}, None), [])
        self.assertEqual(len(K.rule5('', {}, TERMS.replace('Деталь, що', 'Деталь, що вибухає й'))), 1)

    def test_documents(self):  # a document that is not there is a problem, not a skipped rule
        texts = dict.fromkeys(K.DOCUMENTS, '')
        self.assertEqual(K.DOCUMENTS, ('VOLUME.md', 'PATH.md', 'PATH-ledger.md', 'PATH-NOTES.md', 'REUSE.md'))
        self.assertEqual(K.missing(texts), [])
        self.assertEqual(K.missing(dict(texts, **{'PATH-NOTES.md': None, 'REUSE.md': None})),
                         ['PATH-NOTES.md is missing', 'REUSE.md is missing'])


if __name__ == '__main__':
    unittest.main()
