#!/usr/bin/env python3
"""The radio volume's own check: its documents against volume.json, against each other and against this tree.

Rules: 1 — rows of «Основний шлях» in PATH.md are the non-branch journey entries of volume.json, in order, once each,
with the same titles and minutes; 2 — every journey id has exactly one H3 heading in PATH.md with the volume.json
title, and no heading names an id outside the journey; 3 — «Терміни шляху» in PATH-ledger.md and chapters/_terms.md
list the same terms with the same steps, the ledger lists each term once, and every step's chapter is in the journey
and the step itself is listed in PATH.md; 4 — no micro sign U+00B5 and no straight apostrophe between two Cyrillic
letters in docs/volumes/radio/ (except plan48/) or app/src/volumes/radio/; 5 — no topic the volume never touches in
chapters/*.md or in the cards of _terms.md; 6 — VISUAL.md has all its sections; 7 — every link of «Посилання на курс
про електрику» starts at a step listed in PATH.md and leads to a page that exists in this tree. PATH.md lists a step
as an item «- `chapter/step` — …».
Prints one `radio check: <problem>` line per problem (a missing document is one: its rules cannot run), a line of
counts, then `radio check: OK` (exit 0) or `radio check: N problem(s)` (exit 1).
The forbidden characters are written as escapes here: rule 4 reads this file too.
Usage: python3 docs/volumes/radio/check.py
"""
import json
import pathlib
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)

ROOT = pathlib.Path(__file__).resolve().parents[3]  # docs/volumes/radio/check.py → repository root
DOCS = 'docs/volumes/radio'
APP = 'app/src/volumes/radio'
SUFFIXES = {'.md', '.tsv', '.json', '.ts', '.mjs', '.py'}
MICRO = '\u00b5'
CYRILLIC = '\u0400-\u04ff'
STRAIGHT = re.compile(r'\w*[%s]\u0027[%s]\w*' % (CYRILLIC, CYRILLIC))
# The same topics as «Чого на шляху немає» in chapters/_terms.md; test_check.py keeps the two in step.
NOWHERE = re.compile(r'\bглушінн|\b(?:за)?глуш(?:ил|ит|ив|ат|им|иш|и\b|іть|у\b|ує|ую|ува|ен)|джамер'
                     r'|\bдрон|безпілотн|БПЛА|коптер|\bFPV\b'
                     r'|військ|\bармі(?:я|ї|ю|єю|й|ям|ями|ях)\b|\bармійськ|\bРЕБ\b|радіоелектронн\w+ боротьб'
                     r'|радіолока[цт]|\bрадар|\bлокатор|\bРЛС\b', re.IGNORECASE)
H3 = re.compile(r'^### (?:\d+\. )?`([^`]+)`(?: — (.+?))?\s*$')
STEP_ITEM = re.compile(r'^[-*] `([a-z0-9-]+/[a-z0-9-]+)`', re.MULTILINE)
ADDRESS = re.compile(r'^`#/([^`\s]+)`')
SEPARATOR = re.compile(r'^:?-+:?$')
VISUAL_SECTIONS = ['Принципи', 'Подвір’я', 'Де ми', 'Кольори зі змістом', 'Екран монітора', 'Щуп і стрічка',
                   'Ракурси', 'Телефон', 'Чек-лист аудитора кадру']
DOCUMENTS = ('PATH.md', 'PATH-ledger.md', 'chapters/_terms.md', 'VISUAL.md')  # under docs/volumes/radio/
# A chapter's own `steps: [ … ]` literal in index.ts; step lists built by code (`Object.entries(…)`) are not read.
TS_STEPS = re.compile(r'^([ \t]*)steps:\s*\[[ \t]*$(.*?)^\1\]', re.MULTILINE | re.DOTALL)
TS_STEP_ID = re.compile(r"^\s*(?:\{\s*)?id:\s*'([^']+)'", re.MULTILINE)


def cells(line):
    """Split a markdown table row on unescaped pipes; unescape `\\|` inside cells."""
    parts = re.split(r'(?<!\\)\|', line.strip().strip('|'))
    return [p.strip().replace('\\|', '|') for p in parts]


def norm(s):
    """Title for comparison: lower case, letters and digits only, a leading «практикум» dropped."""
    s = ''.join(c for c in s.lower() if c.isalnum())
    return s[len('практикум'):] if s.startswith('практикум') else s


def h2(line):
    """Name of an H2 heading, without a leading number (`## 8. Телефон` → `Телефон`)."""
    return re.sub(r'^## (?:\d+\. )?', '', line).strip()


def table(md, title):
    """Rows of the first table under the H2 heading `title`, as dicts keyed by the header cells.

    The heading is matched through h2(), so a leading number is allowed here as in rule 6: `## 1. <title>`
    matches `title`. This only widens which headings match; a table found either way is checked in full.
    """
    rows, head, inside = [], None, False
    for line in md.split('\n'):
        if line.startswith('## '):
            if inside:
                break
            inside = h2(line) == title
            continue
        if not inside:
            continue
        if line.startswith('|'):
            c = cells(line)
            if head is None:
                head = c
            elif not all(SEPARATOR.match(x) for x in c):
                rows.append(dict(zip(head, c + [''] * (len(head) - len(c)))))
        elif head is not None:
            break
    return rows


def word_at(line, m):
    """The whole word around a regex match."""
    a, b = m.start(), m.end()
    while a > 0 and line[a - 1].isalnum():
        a -= 1
    while b < len(line) and line[b].isalnum():
        b += 1
    return line[a:b]


def rule1(volume, path_md):
    layer = {g['id']: g['layer'] for g in volume['groups']}
    want = [e for e in volume['journey'] if layer[e['group']] != 'branch']
    by_id = {e['id']: e for e in want}
    rows = [(r.get('id', '').strip('`'), r) for r in table(path_md, 'Основний шлях')]
    seen = {i for i, _ in rows}
    out = ['PATH.md: no main-path row for `%s`' % e['id'] for e in want if e['id'] not in seen]
    for i, r in rows:
        e = by_id.get(i)
        if e is None:
            out.append('PATH.md: main-path row `%s` is not in the journey' % i)
            continue
        if norm(r.get('Назва-питання', '')) != norm(e['title']):
            out.append('PATH.md: `%s`: title differs from volume.json' % i)
        minutes = r.get('≈ хв', '')
        if minutes != str(e.get('minutes')):
            out.append('PATH.md: `%s`: %s хв ≠ volume.json %s' % (i, minutes, e.get('minutes')))
    ids = [i for i, _ in rows]
    out += ['PATH.md: main-path row `%s` appears %d times' % (i, ids.count(i))
            for i in sorted(set(ids)) if ids.count(i) > 1]
    if list(dict.fromkeys(i for i in ids if i in by_id)) != [e['id'] for e in want if e['id'] in seen]:
        out.append('PATH.md: main-path rows are out of order')
    return out


def rule2(volume, path_md):
    heads = {}
    for line in path_md.split('\n'):
        m = H3.match(line)
        if m:
            heads.setdefault(m.group(1), []).append(m.group(2) or '')
    titles = {e['id']: e['title'] for e in volume['journey']}
    out = []
    for i, title in titles.items():
        found = heads.get(i, [])
        if not found:
            out.append('PATH.md: no heading for `%s`' % i)
        elif len(found) > 1:
            out.append('PATH.md: %d headings for `%s`' % (len(found), i))
        if any(norm(t) != norm(title) for t in found):
            out.append('PATH.md: heading `%s`: title differs from volume.json' % i)
    out += ['PATH.md: heading for `%s` is not in the journey' % i for i in heads if i not in titles]
    return out


def listed_steps(path_md):
    """Steps PATH.md lists: `chapter/step` of every item «- `chapter/step` — …»."""
    return set(STEP_ITEM.findall(path_md))


def rule3(volume, ledger_md, terms_md, listed=None):
    """`listed`: listed_steps(PATH.md); None only when there is no PATH.md (then steps are not looked up there)."""
    ids = {e['id'] for e in volume['journey']}
    ledger = [(r.get('Термін', ''), r.get('Крок', '').strip('`')) for r in table(ledger_md, 'Терміни шляху')]
    out = []
    for t, s in ledger:
        if s.split('/')[0] not in ids:
            out.append('PATH-ledger.md: «%s» → `%s`: no such chapter in the journey' % (t, s))
        elif listed is not None and s not in listed:
            out.append('PATH-ledger.md: «%s» → `%s`: no such step in PATH.md' % (t, s))
    names = [t for t, _ in ledger]
    out += ['PATH-ledger.md: «%s» listed twice' % t for t in sorted(set(names)) if names.count(t) > 1]
    if terms_md is None:
        return out
    terms = [(r.get('Термін', ''), r.get('Крок', '').strip('`')) for r in table(terms_md, 'Терміни шляху')]
    in_ledger, in_terms = dict(ledger), dict(terms)
    for t, s in ledger:
        if t not in in_terms:
            out.append('_terms.md: «%s» is missing' % t)
        elif in_terms[t] != s:
            out.append('PATH-ledger.md: «%s» → `%s`, _terms.md → `%s`' % (t, s, in_terms[t]))
    out += ['PATH-ledger.md: «%s» is missing' % t for t, _ in terms if t not in in_ledger]
    return out


def rule4(files):
    out = []
    for name, text in files.items():
        for n, line in enumerate(text.split('\n'), 1):
            if MICRO in line:
                out.append('%s:%d: micro sign U+00B5 (write U+03BC)' % (name, n))
            out += ['%s:%d: straight apostrophe in «%s» (write U+2019)' % (name, n, m.group(0))
                    for m in STRAIGHT.finditer(line)]
    return out


def rule5(chapters, terms_md):
    out = []
    for name, text in chapters.items():
        for n, line in enumerate(text.split('\n'), 1):
            out += ['%s:%d: «%s» is a topic the volume never touches' % (name, n, word_at(line, m))
                    for m in NOWHERE.finditer(line)]
    if terms_md is not None:
        for title in ('Терміни шляху', 'Слова лише для «Докладніше»'):
            for r in table(terms_md, title):
                values = list(r.values())  # by position, as tools/content/path_format.py reads it: the card is last
                name, card = (values[0], values[-1]) if values else ('', '')
                out += ['_terms.md: «%s»: card: «%s» is a topic the volume never touches' % (name, word_at(card, m))
                        for m in NOWHERE.finditer(card)]
    return out


def rule6(visual_md):
    have = {h2(line) for line in visual_md.split('\n') if line.startswith('## ')}
    return ['VISUAL.md: section «%s» missing' % s for s in VISUAL_SECTIONS if s not in have]


def rule7(path_md, pages):
    listed, out = listed_steps(path_md), []
    for r in table(path_md, 'Посилання на курс про електрику'):
        c = list(r.values())
        step = c[0].strip('`') if c else ''
        if step not in listed:
            out.append('PATH.md: link `%s`: no such step in PATH.md' % step)
        m = ADDRESS.match(c[1]) if len(c) > 1 else None
        if m is None:
            out.append('PATH.md: link `%s`: the second cell does not start with an address' % step)
        elif m.group(1) not in pages:
            out.append('PATH.md: link `%s` → #/%s: no such page in this tree' % (step, m.group(1)))
    return out


def read(path):
    return path.read_text(encoding='utf-8') if path.is_file() else None


def checked_files():
    """Files rule 4 reads, keyed by their path from the repository root."""
    out = {}
    for base in (DOCS, APP):
        for p in sorted((ROOT / base).rglob('*')):
            rel = p.relative_to(ROOT).as_posix()
            if p.is_file() and p.suffix in SUFFIXES and not rel.startswith(DOCS + '/plan48/'):
                out[rel] = p.read_text(encoding='utf-8')
    return out


def pages():
    """`volume/chapter` and `volume/chapter/step` for every chapter page in app/src/volumes/*/."""
    out = set()
    for vol in sorted((ROOT / 'app/src/volumes').iterdir()):
        if not vol.is_dir():
            continue
        for index in sorted(vol.glob('chapters/*/index.ts')):
            chapter = '%s/%s' % (vol.name, index.parent.name)
            out.add(chapter)
            for m in TS_STEPS.finditer(index.read_text(encoding='utf-8')):
                out.update('%s/%s' % (chapter, s) for s in TS_STEP_ID.findall(m.group(2)))
        for manifest in sorted(vol.glob('content/generated/*.manifest.json')):
            chapter = '%s/%s' % (vol.name, manifest.name[:-len('.manifest.json')])
            out.add(chapter)
            steps = json.loads(manifest.read_text(encoding='utf-8')).get('steps') or []
            out.update('%s/%s' % (chapter, s['id']) for s in steps)
    return out


def missing(texts):
    """`texts`: each of DOCUMENTS → its text or None. A document that is not there is a problem: its rules cannot run."""
    return ['%s is missing' % name for name in DOCUMENTS if texts.get(name) is None]


def main():
    volume = json.loads((ROOT / APP / 'volume.json').read_text(encoding='utf-8'))
    docs = ROOT / DOCS
    texts = {name: read(docs / name) for name in DOCUMENTS}
    path_md, ledger_md, terms_md, visual_md = (texts[name] for name in DOCUMENTS)
    chapters = {'chapters/' + p.name: p.read_text(encoding='utf-8')
                for p in sorted(docs.glob('chapters/*.md')) if p.name != '_terms.md'}
    problems = missing(texts)
    if path_md is not None:
        problems += rule1(volume, path_md) + rule2(volume, path_md)
    if ledger_md is not None:
        problems += rule3(volume, ledger_md, terms_md, listed_steps(path_md) if path_md is not None else None)
    problems += rule4(checked_files())
    problems += rule5(chapters, terms_md)
    if visual_md is not None:
        problems += rule6(visual_md)
    if path_md is not None:
        problems += rule7(path_md, pages())
    for p in problems:
        print('radio check: %s' % p)

    def count(md, title):
        return len(table(md, title)) if md is not None else 0

    print('radio check: journey %d · path %d · ledger terms %d · links %d · chapter documents %d · cards %d' % (
        len(volume['journey']), count(path_md, 'Основний шлях'), count(ledger_md, 'Терміни шляху'),
        count(path_md, 'Посилання на курс про електрику'), len(chapters),
        count(terms_md, 'Терміни шляху') + count(terms_md, 'Слова лише для «Докладніше»')))
    print('radio check: %d problem(s)' % len(problems) if problems else 'radio check: OK')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
