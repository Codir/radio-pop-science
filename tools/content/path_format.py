#!/usr/bin/env python3
"""Parser of the «path» chapter documents and of the volume register (docs/PATH_FORMAT.md).

A path volume (`volume.json → "format": "path"`) keeps one document per chapter in docs/volumes/<v>/chapters/<id>.md
and its register of terms in chapters/_terms.md. This module only reads them (pure functions, no I/O except
`load_*`); the export lives in path_export.py, the checks in path_check.py. Structural problems are returned as
strings `"<where>: <what>"`, never raised, so doccheck can list all of them at once.
"""
import os
import re

H1 = re.compile(r'^# ([A-Za-z0-9_][A-Za-z0-9_-]*) — (.+?)\s*$')
H2 = re.compile(r'^## (.+?)\s*$')
STEP = re.compile(r'^### (\d+)\. `([^`]+)` — (.+?)\s*$')
FIELD = re.compile(r'^- \*\*([^*]+?):\*\*\s*(.*)$')
NUMBERED = re.compile(r'^(\d+)\. (.*)$')
STEP_ID = re.compile(r'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$')
REF = re.compile(r'^`([^`\s]+)`$')

SECTIONS = {'Питання з життя': 'hook', 'Що ми вже знаємо': 'know', 'Кроки': 'steps', 'Нитка глави': 'thread',
            'Що ми тепер знаємо': 'now', 'Місток': 'bridge'}
ORDER = list(SECTIONS.values())
# document field → export key; the practicum names two of them differently
FIELDS = {'Думка': 'idea', 'Завдання': 'idea', 'Текст': 'text', 'Дія': 'action', 'Висновок': 'takeaway',
          'Перевірка': 'takeaway', 'Нові терміни': 'terms', 'Докладніше': 'more', 'Згадати': 'recall',
          'Позначки': 'honesty', 'Бачимо': 'see', 'Ціль': 'goal', 'Підказки': 'hints', 'Підписи': 'labels',
          'Чесно': 'note'}
REQUIRED = ['idea', 'text', 'action', 'takeaway', 'goal', 'terms', 'more']
COMMENT = re.compile(r'<!--.*?-->', re.S)
CAPTION = re.compile(r'«([^«»]+)»')
# «Підписи» items: «A» (all the time) · «A» → «B» (A until the takeaway, B from it) · → «B» (appears at the takeaway)
CAPTION_ITEM = re.compile(r'^(?:«([^«»]+)»)?\s*(?:→\s*«([^«»]+)»)?$')
# the factor of a slowed / sped-up picture: 1000, 1 000, 2,5, 10¹⁴, 5·10¹⁴
FACTOR = r'×(?:\d+(?:[  ]\d{3})*(?:[,.]\d+)?(?:·10[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?|10[⁰¹²³⁴⁵⁶⁷⁸⁹]+)'
NONE = ('—', '-', '')
HONESTY = re.compile(r'^(?:спрощена модель|не в масштабі|сповільнено ' + FACTOR + '|прискорено ' + FACTOR + '|'
                     r'перебільшено|станом на \d{4}\s?р\.)$')


def cells(line):
    """Cells of a markdown table row; `\\|` is a literal pipe inside a cell."""
    parts = re.split(r'(?<!\\)\|', line.strip().strip('|'))
    return [p.strip().replace('\\|', '|') for p in parts]


def _flush(field, out, where, err):
    if field is None:
        return
    key, inline, items = field
    if key in out:
        err.append('%s: field «%s» repeated' % (where, key))
    if items and inline:
        err.append('%s: field «%s» has both inline text and paragraphs' % (where, key))
    out[key] = [' '.join(i) for i in items] if items else ' '.join(inline)


def parse_step_fields(lines, where, err):
    """`- **Поле:** text` lines with continuation lines indented by two spaces, or `  - paragraph` items."""
    out, field = {}, None
    for line in lines:
        if not line.strip():
            continue
        m = FIELD.match(line)
        if m:
            _flush(field, out, where, err)
            key = FIELDS.get(m.group(1).strip())
            if key is None:
                err.append('%s: unknown field «%s»' % (where, m.group(1)))
                field = None
                continue
            field = (key, [m.group(2).strip()] if m.group(2).strip() else [], [])
        elif field is not None and line.startswith('  - '):
            field[2].append([line[4:].strip()])
        elif field is not None and line.startswith('    ') and field[2]:
            field[2][-1].append(line.strip())
        elif field is not None and line.startswith('  ') and not field[2]:
            field[1].append(line.strip())
        else:
            err.append('%s: stray line «%s»' % (where, line.strip()[:50]))
    _flush(field, out, where, err)
    return out


def flat(value):
    return ' '.join(value) if isinstance(value, list) else (value or '')


def split_list(value):
    """«Нові терміни» / «Позначки»: comma or · separated; «—» is the empty list."""
    if isinstance(value, list):
        value = ' '.join(value)
    return [] if value.strip() in NONE else [t.strip() for t in re.split(r'[,·]', value) if t.strip()]


def parse_chapter(text, cid):
    """→ (chapter, problems). chapter = {id, title, hook, know, thread, now[], bridge, steps[], sections[]}."""
    err = []
    # HTML comments are notes for reviewers (fact sources, «перевірити»): never content
    lines = COMMENT.sub('', text).splitlines()
    ch = dict(id=cid, title='', hook='', know='', thread='', now=[], bridge='', steps=[], sections=[])
    first = next((ln for ln in lines if ln.strip()), '')
    m = H1.match(first)
    if not m or m.group(1) != cid:
        err.append('%s: H1 must be «# %s — <питання глави>»' % (cid, cid))
    else:
        ch['title'] = m.group(2)
    section, body, step = None, [], None

    def close():
        if section is None:
            return
        if section == 'steps':
            if step is not None:
                finish_step(step, body, cid, err, ch)
            return
        paras = [ln.strip() for ln in body if ln.strip()]
        if section == 'now':
            for ln in body:
                n = NUMBERED.match(ln)
                if n:
                    ch['now'].append(n.group(2).strip())
                elif ln.startswith('   ') and ch['now']:
                    ch['now'][-1] += ' ' + ln.strip()
                elif ln.strip():
                    err.append('%s: «Що ми тепер знаємо» expects numbered lines, got «%s»' % (cid, ln.strip()[:40]))
        else:
            ch[section] = ' '.join(paras)

    for ln in lines[1:]:
        h2 = H2.match(ln)
        if h2:
            close()
            name = h2.group(1)
            section, body, step = SECTIONS.get(name), [], None
            if section is None:
                err.append('%s: unknown section «%s»' % (cid, name))
            elif section in ch['sections']:
                err.append('%s: section «%s» repeated' % (cid, name))
            else:
                ch['sections'].append(section)
            continue
        if section == 'steps':
            s = STEP.match(ln)
            if s:
                if step is not None:
                    finish_step(step, body, cid, err, ch)
                step, body = dict(n=int(s.group(1)), id=s.group(2), title=s.group(3)), []
                continue
            if step is None:
                if ln.strip():
                    err.append('%s: text before the first step: «%s»' % (cid, ln.strip()[:40]))
                continue
        body.append(ln)
    close()
    known = [s for s in ORDER if s in ch['sections']]
    if ch['sections'] != known:
        err.append('%s: sections out of order (%s)' % (cid, ' → '.join(ch['sections'])))
    return ch, err


def finish_step(step, body, cid, err, ch):
    where = '%s/%s' % (cid, step['id'])
    if not STEP_ID.match(step['id']):
        err.append('%s: step id must be kebab-case Latin' % where)
    if step['n'] != len(ch['steps']) + 1:
        err.append('%s: step number %d, expected %d' % (where, step['n'], len(ch['steps']) + 1))
    if any(s['id'] == step['id'] for s in ch['steps']):
        err.append('%s: duplicate step id' % where)
    f = parse_step_fields(body, where, err)
    step.update(f)
    step['terms'] = split_list(f.get('terms', '—'))
    # «→ прискорено ×20»: the chip appears with the reader's action (`stepUi … acting`), not with the step
    chips = split_list(f.get('honesty', '—'))
    step['honesty'] = [c for c in chips if not c.startswith('→')]
    step['honestyOnAction'] = [c.lstrip('→').strip() for c in chips if c.startswith('→')]
    step['recall'] = split_list(f.get('recall', '—'))
    hints = f.get('hints', [])
    step['hints'] = hints if isinstance(hints, list) else ([] if hints.strip() in NONE else [hints])
    step['captions'] = []
    for item in [] if flat(f.get('labels', '')).strip() in NONE else flat(f.get('labels', '')).split('·'):
        m = CAPTION_ITEM.match(item.strip())
        if not m or not (m.group(1) or m.group(2)):
            err.append('%s: caption «%s» is not «A», «A» → «B» or → «B»' % (where, item.strip()[:40]))
            continue
        if m.group(1):
            step['captions'].append(dict(text=m.group(1), until='takeaway') if m.group(2) else dict(text=m.group(1)))
        if m.group(2):
            step['captions'].append(dict(text=m.group(2), at='takeaway'))
    step['labels'] = [c['text'] for c in step['captions']]
    if isinstance(f.get('note'), list):
        err.append('%s: «Чесно» is one paragraph' % where)
    step['missing'] = [k for k in REQUIRED if k not in f]
    ch['steps'].append(step)


def parse_register(text):
    """→ (register, problems). register = {terms: [...], more: [...], banned: [...]}, each with a compiled `rx`."""
    reg, err, table = dict(terms=[], more=[], banned=[]), [], None
    heads = {'Терміни шляху': ('terms', 5), 'Слова лише для «Докладніше»': ('more', 3),
             'Чого на шляху немає': ('banned', 2)}
    for ln in text.splitlines():
        h2 = H2.match(ln)
        if h2:
            table = heads.get(h2.group(1))
            continue
        if table is None or not ln.startswith('|') or '`' not in ln:
            continue
        key, width = table
        c = cells(ln)
        if len(c) != width:
            err.append('_terms.md: «%s» row has %d cells, expected %d' % (c[0], len(c), width))
            continue
        try:
            rx = re.compile(c[1].strip('`'), re.IGNORECASE | re.UNICODE)
        except re.error as e:
            err.append('_terms.md: «%s»: bad form regex (%s)' % (c[0], e))
            continue
        row = dict(name=c[0], forms=c[1].strip('`'), rx=rx)
        if key == 'terms':
            m = REF.match(c[2])
            row.update(step=m.group(1) if m else c[2], kind=c[3], card=c[4])
            if c[3] not in ('шлях', 'практикум'):
                err.append('_terms.md: «%s»: type must be «шлях» or «практикум»' % c[0])
        elif key == 'more':
            row['card'] = c[2]
        reg[key].append(row)
    names = [t['name'] for t in reg['terms'] + reg['more']]
    err += ['_terms.md: «%s» listed twice' % n for n in sorted(set(names)) if names.count(n) > 1]
    return reg, err


def full_step(ref, volume, chapter):
    """`step` | `chapter/step` | `volume/chapter/step` → `volume/chapter/step`."""
    parts = ref.strip('`').split('/')
    head = {1: [volume, chapter], 2: [volume]}.get(len(parts), [])
    return '/'.join(head + parts)


def load_chapter(path, cid):
    with open(path, encoding='utf-8') as f:
        return parse_chapter(f.read(), cid)


def load_register(chapter_dir):
    path = os.path.join(chapter_dir, '_terms.md')
    if not os.path.exists(path):
        return dict(terms=[], more=[], banned=[]), ['_terms.md: missing (%s)' % path]
    with open(path, encoding='utf-8') as f:
        return parse_register(f.read())
