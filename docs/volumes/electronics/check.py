#!/usr/bin/env python3
"""The electronics volume's own check: its documents against volume.json, against each other and against this tree.

Rules (after docs/volumes/radio/check.py):
1 — the rows of «Основний шлях» in PATH.md are the non-branch journey entries of volume.json, in order, once each, with
    the same titles and minutes;
2 — every journey id has exactly one H3 chapter heading in PATH.md, with the volume.json title, and no heading names an
    id outside the journey; every step item «- `chapter/step` — …» stands under the heading of its own chapter, once;
3 — the register: every `chapter/step` of a journey chapter that PATH-ledger.md names is a step of PATH.md; «Терміни
    шляху» and «Терміни гілок» list each term once, at a step of a journey chapter; the «Терміни» of every step of
    PATH.md are the ledger's terms of that step, and its «Формула» — at most one — the ledger's formula of that step;
    once chapters/_terms.md exists, its «Терміни шляху» are terms of the ledger at the same steps, and every term of
    the ledger's «Терміни шляху» is there;
4 — no micro sign U+00B5 and no straight apostrophe between two Cyrillic letters in docs/volumes/electronics/,
    app/src/volumes/electronics/ or the volume's sandboxes (app/src/volumes/_dev/chapters/_sandbox-electronics-*);
5 — no topic the course never touches (the mains, recipes of fire, smoke or explosion: the design §3.4) in the steps of
    PATH.md, in chapters/*.md or in the cards of chapters/_terms.md; the rest of PATH.md may name what it forbids;
6 — VISUAL.md has all its ten sections (H2 headings, a leading number allowed), as rule 6 of the radio volume's check.
A step item is «- `chapter/step` — <idea>» with continuation lines indented by two spaces and fields «**Дія:**»,
«**Висновок:**», «**Терміни:**» (a comma list or «—»), «**Формула:**» (the formula in backticks or «—»), «**Д:**».
The H2 «Де сценарії свідомо відступили від цього шляху» (a date may follow) holds one line per deviation, as circuit's
does («- `chapter/step` — what changed → `chapters/<id>.md`»): those lines are notes, not steps, and no rule reads them.
Prints one `electronics check: <problem>` line per problem (a missing document is one), a line of counts, then
`electronics check: OK` (exit 0) or `electronics check: N problem(s)` (exit 1).
The forbidden characters are built from their code points here: rule 4 reads this file too.
Usage: python3 docs/volumes/electronics/check.py
"""
import json
import pathlib
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)

ROOT = pathlib.Path(__file__).resolve().parents[3]  # docs/volumes/electronics/check.py → repository root
DOCS = 'docs/volumes/electronics'
APP = 'app/src/volumes/electronics'
SANDBOXES = ('app/src/volumes/_dev/chapters', '_sandbox-electronics-*')
SUFFIXES = {'.md', '.tsv', '.json', '.ts', '.mjs', '.py'}
DOCUMENTS = ('VOLUME.md', 'PATH.md', 'PATH-ledger.md', 'PATH-NOTES.md', 'REUSE.md',
             'VISUAL.md')  # under docs/volumes/electronics/
VISUAL_SECTIONS = ['Принципи', 'Кімната й стенд', 'Плата', 'Деталі', 'Прилади', 'Рука', 'Поверхи й лупа', 'Ракурси',
                   'Телефон', 'Чек-лист аудитора']
TERMS = 'chapters/_terms.md'  # written by batch E3 (task E3-0); rule 3 reads it once it exists
DEVIATIONS = 'Де сценарії свідомо відступили від цього шляху'  # the H2 of PATH.md whose list items are not steps
MICRO = chr(0xB5)
CYRILLIC = '%s-%s' % (chr(0x400), chr(0x4FF))
STRAIGHT = re.compile(r'\w*[%s]%s[%s]\w*' % (CYRILLIC, chr(0x27), CYRILLIC))
# Topics the course never touches. Mains: its voltage, the socket, the grid in any form («мережа» on this volume's
# screens is only ever the mains). Fire, explosion and smoke made on purpose: «вогонь» without «вогні» (lights) and
# «вогник»; burning out («згоряє») and a wisp («димок») are honest consequences and stay allowed.
NOWHERE = re.compile(r'\b2[23]0\s*(?:V|В)\b|\b2[23]0\s+вольт|\bрозетк|\bелектромереж'
                     r'|\bмереж(?:а|і|у|ею|ах|ам|ами|ев\w*)?\b'
                     r'|\bвибух|\bпідірв|\bпідрив|\bпідпал|\bпожеж|\bзадим|\bвог(?:онь|ню|нем)\b|\bполум.я',
                     re.IGNORECASE)
H3 = re.compile(r'^### (?:\d+\. )?`([^`]+)`(?: — (.+?))?\s*$')
STEP_ITEM = re.compile(r'^[-*] `([a-z0-9-]+)/([a-z0-9-]+)`')
FIELD = re.compile(r'\*\*(Дія|Висновок|Терміни|Формула|Д):\*\*')
REF = re.compile(r'`([a-z0-9-]+)/([a-z0-9-]+)`')
CODE = re.compile(r'`([^`]+)`')
SEPARATOR = re.compile(r'^:?-+:?$')


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
    """Rows of the first table under the H2 heading `title`, as dicts keyed by the header cells (with line numbers
    under the key `#`)."""
    rows, head, inside = [], None, False
    for n, line in enumerate(md.split('\n'), 1):
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
                rows.append(dict(zip(head, c + [''] * (len(head) - len(c))), **{'#': n}))
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


def fields(text):
    """The fields of a step item: `idea` (before the first label) and each «**Label:**» → its text."""
    parts = FIELD.split(text)
    out = {'idea': parts[0].strip()}
    for label, value in zip(parts[1::2], parts[2::2]):
        out[label] = value.strip()
    return out


def terms_of(value):
    """Terms of a «Терміни» field: a comma list, or none for «—»."""
    value = value.strip().rstrip('.;').strip()
    return [] if value in ('', '—', '-') else [t.strip() for t in value.split(',') if t.strip()]


def formulas_of(value):
    """Formulas of a «Формула» field: every span in backticks."""
    return CODE.findall(value)


def parse_path(md):
    """Chapter headings and step items of PATH.md.

    Returns `heads` {id: [title, …]} and `steps`, in order: {'id', 'chapter', 'under' (the id of the H3 heading the
    item stands under, None outside one), 'line', 'lines' [(n, text)], 'fields'}. Any other heading ends a chapter.
    The section DEVIATIONS, up to the next H1 or H2, is skipped whole: its items are notes on steps, not steps.
    """
    heads, steps, under, item, aside = {}, [], None, None, False
    for n, line in enumerate(md.split('\n'), 1):
        if line.startswith(('# ', '## ')):
            aside = line.startswith('## ') and h2(line).startswith(DEVIATIONS)
        if aside:
            under, item = None, None
            continue
        if line.startswith('#'):
            item = None
            m = H3.match(line)
            under = m.group(1) if m else None
            if m:
                heads.setdefault(m.group(1), []).append(m.group(2) or '')
            continue
        m = STEP_ITEM.match(line)
        if m:
            item = {'id': '%s/%s' % m.groups(), 'chapter': m.group(1), 'under': under, 'line': n, 'lines': [(n, line)]}
            steps.append(item)
        elif item is not None and line.startswith('  ') and line.strip():
            item['lines'].append((n, line))
        else:
            item = None
    for s in steps:
        text = ' '.join(t.strip() for _, t in s['lines'])
        s['fields'] = fields(re.sub(r'^[-*] `[^`]+`\s*(?:—\s*)?', '', text))
    return heads, steps


def rule1(volume, path_md):
    layer = {g['id']: g['layer'] for g in volume['groups']}
    branches = {e['id'] for e in volume['journey'] if layer[e['group']] == 'branch'}
    want = [e for e in volume['journey'] if layer[e['group']] != 'branch']
    by_id = {e['id']: e for e in want}
    rows = [(r.get('id', '').strip('`'), r) for r in table(path_md, 'Основний шлях')]
    seen = {i for i, _ in rows}
    out = ['PATH.md: no main-path row for `%s`' % e['id'] for e in want if e['id'] not in seen]
    for i, r in rows:
        e = by_id.get(i)
        if e is None:
            why = 'is a branch' if i in branches else 'is not in the journey'
            out.append('PATH.md: main-path row `%s` %s' % (i, why))
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
    heads, steps = parse_path(path_md)
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
    for s in steps:
        if s['under'] is None:
            out.append('PATH.md:%d: step `%s` stands outside a chapter heading' % (s['line'], s['id']))
        elif s['under'] != s['chapter']:
            out.append('PATH.md:%d: step `%s` stands under `%s`' % (s['line'], s['id'], s['under']))
    ids = [s['id'] for s in steps]
    out += ['PATH.md: step `%s` appears %d times' % (i, ids.count(i)) for i in sorted(set(ids)) if ids.count(i) > 1]
    return out


def ledger_terms(ledger_md):
    """(term, step, line) of «Терміни шляху» and then «Терміни гілок»."""
    return [(r.get('Термін', ''), r.get('Крок', '').strip('`'), r['#'])
            for title in ('Терміни шляху', 'Терміни гілок') for r in table(ledger_md, title)]


def rule3(volume, path_md, ledger_md, terms_md=None):
    """`terms_md`: the text of chapters/_terms.md, or None while it does not exist."""
    ids = {e['id'] for e in volume['journey']}
    _, steps = parse_path(path_md)
    listed = {s['id'] for s in steps}
    out = []
    for n, line in enumerate(ledger_md.split('\n'), 1):
        out += ['PATH-ledger.md:%d: `%s/%s` is not a step of PATH.md' % ((n,) + m.groups())
                for m in REF.finditer(line) if m.group(1) in ids and '%s/%s' % m.groups() not in listed]
    terms = ledger_terms(ledger_md)
    out += ['PATH-ledger.md: «%s» → `%s`: no such chapter in the journey' % (t, s)
            for t, s, _ in terms if s.split('/')[0] not in ids]
    names = [t for t, _, _ in terms]
    out += ['PATH-ledger.md: «%s» listed twice' % t for t in dict.fromkeys(names) if names.count(t) > 1]
    formulas = [(CODE.sub(r'\1', r.get('Формула', '')), r.get('Крок', '').strip('`'))
                for r in table(ledger_md, 'Формули')]
    for s in steps:
        f = s['fields']
        if 'Терміни' not in f:
            out.append('PATH.md: `%s`: no «Терміни»' % s['id'])
        else:
            have, want = sorted(terms_of(f['Терміни'])), sorted(t for t, step, _ in terms if step == s['id'])
            if have != want:
                out.append('PATH.md: `%s`: terms %s ≠ PATH-ledger.md %s' % (s['id'], have, want))
        if 'Формула' not in f:
            out.append('PATH.md: `%s`: no «Формула»' % s['id'])
            continue
        have = sorted(formulas_of(f['Формула']))
        if len(have) > 1:
            out.append('PATH.md: `%s`: %d new formulas (at most one)' % (s['id'], len(have)))
        want = sorted(x for x, step in formulas if step == s['id'])
        if have != want:
            out.append('PATH.md: `%s`: formula %s ≠ PATH-ledger.md %s' % (s['id'], have, want))
    names = [x for x, _ in formulas]
    out += ['PATH-ledger.md: formula `%s` listed twice' % x for x in dict.fromkeys(names) if names.count(x) > 1]
    if terms_md is not None:
        at = {t: s for t, s, _ in terms}
        for r in table(terms_md, 'Терміни шляху'):
            t, s = r.get('Термін', ''), r.get('Крок', '').strip('`')
            if t not in at:
                out.append('_terms.md: «%s» is not in PATH-ledger.md' % t)
            elif at[t] != s:
                out.append('_terms.md: «%s» → `%s`, PATH-ledger.md → `%s`' % (t, s, at[t]))
    return out


def missing_terms(ledger_md, terms_md):
    """The terms of the ledger's «Терміни шляху» that chapters/_terms.md does not list (nothing while it is absent)."""
    if terms_md is None:
        return []
    have = {r.get('Термін', '') for r in table(terms_md, 'Терміни шляху')}
    return ['_terms.md: «%s» is missing' % r.get('Термін', '') for r in table(ledger_md, 'Терміни шляху')
            if r.get('Термін', '') not in have]


def rule4(files):
    out = []
    for name, text in files.items():
        for n, line in enumerate(text.split('\n'), 1):
            if MICRO in line:
                out.append('%s:%d: micro sign U+00B5 (write U+03BC)' % (name, n))
            out += ['%s:%d: straight apostrophe in «%s» (write U+2019)' % (name, n, m.group(0))
                    for m in STRAIGHT.finditer(line)]
    return out


def rule5(path_md, chapters, terms_md):
    out = []
    for s in parse_path(path_md)[1]:
        for n, line in s['lines']:
            out += ['PATH.md:%d: `%s`: «%s» is a topic the course never touches' % (n, s['id'], word_at(line, m))
                    for m in NOWHERE.finditer(line)]
    for name, text in chapters.items():
        for n, line in enumerate(text.split('\n'), 1):
            out += ['%s:%d: «%s» is a topic the course never touches' % (name, n, word_at(line, m))
                    for m in NOWHERE.finditer(line)]
    if terms_md is not None:
        for title in ('Терміни шляху', 'Слова лише для «Докладніше»'):
            for r in table(terms_md, title):
                values = [v for k, v in r.items() if k != '#']  # by position, as path_format.py reads it
                name, card = (values[0], values[-1]) if values else ('', '')
                out += ['_terms.md: «%s»: card: «%s» is a topic the course never touches' % (name, word_at(card, m))
                        for m in NOWHERE.finditer(card)]
    return out


def rule6(visual_md):
    have = {h2(line) for line in visual_md.split('\n') if line.startswith('## ')}
    return ['VISUAL.md: section «%s» missing' % s for s in VISUAL_SECTIONS if s not in have]


def read(path):
    return path.read_text(encoding='utf-8') if path.is_file() else None


def checked_files(root=ROOT):
    """Files rule 4 reads, keyed by their path from `root` (the repository root)."""
    bases = [root / DOCS, root / APP] + sorted((root / SANDBOXES[0]).glob(SANDBOXES[1]))
    out = {}
    for base in bases:
        if base.is_dir():
            for p in sorted(base.rglob('*')):
                if p.is_file() and p.suffix in SUFFIXES:
                    out[p.relative_to(root).as_posix()] = p.read_text(encoding='utf-8')
    return out


def missing(texts):
    """`texts`: each of DOCUMENTS → its text or None. A document that is not there is a problem: its rules cannot
    run."""
    return ['%s is missing' % name for name in DOCUMENTS if texts.get(name) is None]


def main():
    volume = json.loads((ROOT / APP / 'volume.json').read_text(encoding='utf-8'))
    docs = ROOT / DOCS
    texts = {name: read(docs / name) for name in DOCUMENTS}
    path_md, ledger_md, terms_md = texts['PATH.md'], texts['PATH-ledger.md'], read(docs / TERMS)
    chapters = {'chapters/' + p.name: p.read_text(encoding='utf-8')
                for p in sorted(docs.glob('chapters/*.md')) if p.name != '_terms.md'}
    problems = missing(texts)
    if path_md is not None:
        problems += rule1(volume, path_md) + rule2(volume, path_md)
        if ledger_md is not None:
            problems += rule3(volume, path_md, ledger_md, terms_md) + missing_terms(ledger_md, terms_md)
    problems += rule4(checked_files())
    problems += rule5(path_md or '', chapters, terms_md)
    if texts['VISUAL.md'] is not None:
        problems += rule6(texts['VISUAL.md'])
    for p in problems:
        print('electronics check: %s' % p)

    path_md, ledger_md = path_md or '', ledger_md or ''
    print('electronics check: journey %d · main path %d · steps %d · ledger terms %d · formulas %d'
          ' · chapter documents %d' % (len(volume['journey']), len(table(path_md, 'Основний шлях')),
                                       len(parse_path(path_md)[1]), len(ledger_terms(ledger_md)),
                                       len(table(ledger_md, 'Формули')), len(chapters)))
    print('electronics check: %d problem(s)' % len(problems) if problems else 'electronics check: OK')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
