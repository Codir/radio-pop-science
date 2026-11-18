#!/usr/bin/env python3
"""Tests for docs/volumes/radio/check.py: one test per rule on small hand-written documents.

The micro sign and the straight apostrophe appear here only as escapes: rule 4 reads this file too.
Usage: python3 docs/volumes/radio/test_check.py
"""
import pathlib
import re
import sys
import unittest

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check as K  # noqa: E402

V = {'groups': [{'id': 'picture', 'layer': 'path'}, {'id': 'practicum-analog', 'layer': 'practicum'}, {'id': 'branches', 'layer': 'branch'}], 'journey': [
     {'id': 'lines', 'group': 'picture', 'title': 'Як передати цілу картинку одним числом?', 'minutes': 10},
     {'id': 'tv', 'group': 'branches', 'parent': 'lines', 'title': 'Як працював звичайний телевізор?', 'minutes': 13},
     {'id': 'build-analog', 'group': 'practicum-analog', 'title': 'Проведіть картинку крізь подвір’я самі', 'minutes': 12}]}
LINES = '| 4 | `lines` | Як передати цілу картинку одним числом? | 10 | третину відповіді |\n'; TV = '### `tv` — Як працював звичайний телевізор?\n'
PATH = ('## Основний шлях\n| № | id | Назва-питання | ≈ хв | Без цієї глави не пояснити |\n|---|---|---|---|---|\n' + LINES
        + '| — | `build-analog` | Практикум. Проведіть картинку крізь подвір’я самі | 12 | — |\n## Кроки шляху\n'
        + '### 4. `lines` — Як передати цілу картинку одним числом?\n- `lines/row` — Комірки одного ряду дають сигнал.\n' + TV
        + '### `build-analog` — Практикум. Проведіть картинку крізь подвір’я самі\n## Посилання на курс про електрику\n| Крок тому | Сторінка |\n'
        + '|---|---|\n| `lines/row` | `#/circuit/charge` — що тримає електрон біля ядра |\n| `tv/beam` | `#/electricity/magnetism/lorentz` |\n')
LEDGER = '## Терміни шляху\n| № | Термін | Крок |\n|---|---|---|\n| 1 | рядок | `lines/row` |\n'; ROW = '| рядок | `\\bрядо?к\\w*` | `lines/row` | шлях | Ряд комірок, прочитаних по черзі. |\n'
TERMS = ('## Терміни шляху\n| Термін | Форми | Крок | Тип | Картка |\n|---|---|---|---|---|\n' + ROW
         + '## Чого на шляху немає\n| Тема | Форми |\n|---|---|\n| безпілотники | `безпілотн\\w*` |\n')
HIT = ('Сусід глушив картинку.', 'Вони глушать канал.', 'Я глушу його.', 'Сусід заглушує канал.', 'Заглушення каналу.', 'Радари стоять там.',
       'Радіолокатор крутиться.', 'Квадрокоптер висить.', 'FPV-камера.', 'Радіоелектронна боротьба.', 'Армія пішла.', 'Армійська рація.')
FREE = ('Глушник гуде.', 'Заглушка на гнізді.', 'Грім оглушив кота.', 'Хата в глуші.', 'Звук приглушений.', 'Арматура в стіні.',
        'Армірований бетон.', 'Копір гуде.')

class CheckTest(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(K.rule1(V, PATH) + K.rule2(V, PATH) + K.rule3(V, LEDGER, TERMS) + K.rule5({}, TERMS) + K.rule7(PATH, {'circuit/charge', 'electricity/magnetism/lorentz'}), [])
    def test_main_path(self):
        title = '| Як передати цілу картинку одним числом? |'
        self.assertEqual(K.rule1(V, PATH.replace('| 10 | третину', '| 9 | третину')), ['PATH.md: `lines`: 9 хв ≠ volume.json 10'])
        self.assertEqual(K.rule1(V, PATH.replace(title, '| як передати цілу картинку — одним числом |')), [])
        self.assertEqual(K.rule1(V, PATH.replace(title, '| Як передати картинку? |')), ['PATH.md: `lines`: title differs from volume.json'])
        self.assertEqual(K.rule1(V, PATH.replace(LINES, '')), ['PATH.md: no main-path row for `lines`'])
    def test_headings(self):
        self.assertEqual(K.rule2(V, PATH.replace(TV, '')), ['PATH.md: no heading for `tv`'])
        self.assertEqual(K.rule2(V, PATH + TV), ['PATH.md: 2 headings for `tv`'])
        self.assertEqual(K.rule2(V, PATH + '### `ghost` — Що це?\n'), ['PATH.md: heading for `ghost` is not in the journey'])
    def test_register(self):
        self.assertEqual(K.rule3(V, LEDGER, TERMS.replace('`lines/row`', '`lines/frame`')), ['PATH-ledger.md: «рядок» → `lines/row`, _terms.md → `lines/frame`'])
        self.assertEqual(K.rule3(V, LEDGER.replace('`lines/row`', '`nope/row`'), None), ['PATH-ledger.md: «рядок» → `nope/row`: no such chapter in the journey'])
        self.assertEqual(K.rule3(V, LEDGER, TERMS.replace(ROW, '')), ['_terms.md: «рядок» is missing'])
    def test_characters(self):
        self.assertEqual(K.rule4({'docs/volumes/radio/PATH.md': '64 \u00b5s\nподвір\'я\n`сузір[’\'\u02bc]`\n'}), [
            'docs/volumes/radio/PATH.md:1: micro sign U+00B5 (write U+03BC)', 'docs/volumes/radio/PATH.md:2: straight apostrophe in «подвір\u0027я» (write U+2019)'])
    def test_nowhere(self):
        got = K.rule5({'chapters/air.md': '- **Докладніше:** безпілотники тут ні до чого.\n'}, TERMS); self.assertEqual(len(got), 1); self.assertIn('chapters/air.md:1', got[0])
        self.assertIn('_terms.md: «рядок»', K.rule5({}, TERMS.replace('Ряд комірок', 'Як у радіолокації: ряд комірок'))[0])
        self.assertEqual(len(K.rule5({'chapters/x.md': 'Сусід заглушить картинку.\n'}, TERMS)), 1); self.assertEqual(K.rule5({'chapters/x.md': 'Ліхтар приглушили.\n'}, TERMS), [])
        for s in HIT:
            self.assertEqual(len(K.rule5({'chapters/x.md': s + '\n'}, TERMS)), 1, s)
        for s in FREE:
            self.assertEqual(K.rule5({'chapters/x.md': s + '\n'}, TERMS), [], s)
    def test_nowhere_in_step(self):  # the forms of «Чого на шляху немає» in the real _terms.md hit what NOWHERE hits
        md = (pathlib.Path(__file__).resolve().parent / 'chapters/_terms.md').read_text(encoding='utf-8')
        forms = [re.compile(r['Форми'].strip('`'), re.IGNORECASE) for r in K.table(md, 'Чого на шляху немає')]; self.assertEqual(len(forms), 4)
        for s in HIT + FREE + ('Сусід заглушить картинку.', 'Ліхтар приглушили.'):
            self.assertEqual(any(f.search(s) for f in forms), bool(K.NOWHERE.search(s)), s)
    def test_visual(self):
        names = ['Принципи', 'Подвір’я', 'Де ми', 'Кольори зі змістом', 'Екран монітора', 'Щуп і стрічка', 'Ракурси', 'Телефон', 'Чек-лист аудитора кадру']
        full = ''.join('## %d. %s\n' % (i + 1, h) for i, h in enumerate(names)); self.assertEqual(K.VISUAL_SECTIONS, names)
        self.assertEqual(K.rule6(full), []); self.assertEqual(K.rule6(full.replace('## 8. Телефон\n', '')), ['VISUAL.md: section «Телефон» missing'])
    def test_links(self):
        self.assertEqual(K.rule7(PATH, {'circuit/charge'}), ['PATH.md: link `tv/beam` → #/electricity/magnetism/lorentz: no such page in this tree'])


if __name__ == '__main__':
    unittest.main()
