#!/usr/bin/env python3
"""Unit tests of the path format: parser, export marks, and the checker catching planted faults on the sandbox
volume `_path` (docs/PATH_FORMAT.md). Run: python3 tools/content/test_path_format.py"""
import copy
import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import path_check as K  # noqa: E402
import path_export as X  # noqa: E402
import path_format as P  # noqa: E402

DOC = """# demo — Що це?

## Питання з життя
Рядок один.
Рядок два.

## Кроки

### 1. `one` — Перший
- **Думка:** Одне речення.
- **Текст:** Текст
  на два рядки.
- **Дія:** Зробіть.
- **Висновок:** Готово.
- **Ціль:** Зроблено. <!-- джерело: перевірити -->
- **Підказки:**
  - Перша.
  - Друга.
- **Підписи:** «лічильник» · «лупа»
- **Нові терміни:** —
- **Докладніше:**
  - Абзац один
    продовжується.
  - Абзац два.
- **Згадати:** `one`, `other/two`

## Місток
Далі питання: що далі?
"""


class Parser(unittest.TestCase):
    def test_chapter(self):
        ch, err = P.parse_chapter(DOC, 'demo')
        self.assertEqual(err, [])
        self.assertEqual(ch['title'], 'Що це?')
        self.assertEqual(ch['hook'], 'Рядок один. Рядок два.')
        s = ch['steps'][0]
        self.assertEqual(s['text'], 'Текст на два рядки.')
        self.assertEqual(s['more'], ['Абзац один продовжується.', 'Абзац два.'])
        self.assertEqual(s['recall'], ['`one`', '`other/two`'])
        self.assertEqual(s['missing'], [])
        self.assertEqual(s['goal'], 'Зроблено.')
        self.assertEqual(s['hints'], ['Перша.', 'Друга.'])
        self.assertEqual(s['labels'], ['лічильник', 'лупа'])

    def test_paragraphs_captions(self):
        doc = DOC.replace('- **Текст:** Текст\n  на два рядки.', '- **Текст:**\n  - Перший абзац.\n  - Другий абзац.')
        doc = doc.replace('«лічильник» · «лупа»', '«кульки» → «атоми» · → «ядро» · «лупа»')
        ch, err = P.parse_chapter(doc, 'demo')
        self.assertEqual(err, [])
        s = ch['steps'][0]
        self.assertEqual(s['text'], ['Перший абзац.', 'Другий абзац.'])
        self.assertEqual(s['captions'], [{'text': 'кульки', 'until': 'takeaway'}, {'text': 'атоми', 'at': 'takeaway'},
                                         {'text': 'ядро', 'at': 'takeaway'}, {'text': 'лупа'}])
        _, err = P.parse_chapter(doc.replace('→ «ядро»', '«ядро» →'), 'demo')
        self.assertTrue(any('caption' in e for e in err))
        # the honesty marks and «Чесно» note are not shown (DECISIONS §60 x): accepted, never required, dropped
        for field in ('Позначки', 'Чесно'):
            old = doc.replace('- **Нові терміни:** —', '- **%s:** спрощена модель\n- **Нові терміни:** —' % field)
            ch2, err2 = P.parse_chapter(old, 'demo')
            self.assertEqual(err2, [])
            self.assertFalse({'honesty', 'note', '-honesty', '-note'} & set(ch2['steps'][0]))

    def test_structure_errors(self):
        bad = DOC.replace('### 1. `one`', '### 2. `One`').replace('- **Дія:**', '- **Дії:**')
        _, err = P.parse_chapter(bad, 'demo')
        self.assertTrue(any('kebab-case' in e for e in err))
        self.assertTrue(any('step number 2' in e for e in err))
        self.assertTrue(any('unknown field «Дії»' in e for e in err))

    def test_full_step(self):
        self.assertEqual(P.full_step('`a`', 'v', 'ch'), 'v/ch/a')
        self.assertEqual(P.full_step('ch2/a', 'v', 'ch'), 'v/ch2/a')
        self.assertEqual(P.full_step('w/ch2/a', 'v', 'ch'), 'w/ch2/a')


class Sandbox(unittest.TestCase):
    """The checker on the real sandbox documents, clean and with planted faults."""

    @classmethod
    def setUpClass(cls):
        C.use_volume('_path')
        cls.reg, cls.docs, err = X.load_volume()
        assert not err, err

    def run_check(self, mutate=None):
        docs = copy.deepcopy(self.docs)
        if mutate:
            mutate(docs)
        return K.check_volume(self.reg, docs)

    def test_clean(self):
        self.assertEqual(self.run_check(), ([], []))

    def test_planted(self):
        def mutate(d):
            core, same = d['_sandbox-path']['steps'][0], d['_sandbox-flow']['steps'][1]
            core['idea'] = 'Струм іде, а ' + core['idea']               # term before its step
            core['terms'] = core['terms'] + ['ізолятор', 'зайвий']       # third term, register mismatch
            d['_sandbox-path']['bridge'] = 'Що далі?'                     # bridge without the next question
            same['action'] = 'Натисни рамку.'                             # singular address
            same['more'] = ['Срібло', 'тут можна']
            same['text'] = same['text'] + ' Срібло теж.'                  # «Докладніше»-only word in the text
            d['_sandbox-path']['steps'][1]['recall'] = ['`_sandbox-flow/same`']   # recall to a later step
        err, warn = self.run_check(mutate)
        for needle in ('used before', '3 new terms', '≠ register', 'bridge does not end', 'not allowed in on-screen',
                       'not an earlier step'):
            self.assertTrue(any(needle in e for e in err), needle + ' not caught: %s' % err)
        self.assertTrue(any('«ви»' in w for w in warn))

    def test_hand_marked_term(self):
        docs = copy.deepcopy(self.docs)
        core = docs['_sandbox-path']['steps'][0]
        core['text'] = core['text'].replace('мідь. Торкніться', '**мідь**. Торкніться')
        err, _ = K.check_volume(self.reg, docs)
        self.assertTrue(any('«**мідь**» is not a new term' in e for e in err))
        core['text'] = core['text'].replace('**мідь**', 'мідь').replace('провідником', '**провідником**')
        self.assertEqual(K.check_volume(self.reg, docs), ([], []))
        ex = X.export_chapter(docs['_sandbox-path'], self.reg, X.journey(), docs)
        step = X.runtime(ex, self.reg)[0]['steps'][0]
        self.assertEqual(step['panel'][0].count('**'), 2)
        self.assertEqual(step['path']['marks'], [{'text': 'провідником', 'term': 'провідник'}])

    def test_marks(self):
        ex = X.export_chapter(self.docs['_sandbox-flow'], self.reg, X.journey(), self.docs)
        content, manifest = X.runtime(ex, self.reg)
        step = content['steps'][0]
        self.assertIn('**електричним струмом**', step['panel'][0])
        self.assertEqual(step['path']['marks'], [{'text': 'електричним струмом', 'term': 'електричний струм'}])
        self.assertEqual(content['path']['next'], {'id': 'glow', 'title': 'Чому лампа світиться?'})
        self.assertEqual(manifest['axisLabel'], 'ряди атомів')
        self.assertEqual(content['steps'][1]['path']['recall'][0]['target'], '_path/_sandbox-path/core')


if __name__ == '__main__':
    unittest.main(verbosity=1)
