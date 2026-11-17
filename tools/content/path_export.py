#!/usr/bin/env python3
"""Export of a «path» volume (docs/PATH_FORMAT.md): documents → `_export/<id>.json` → runtime content, INDEX.md,
GLOSSARY.md. Called by the usual tools (export_content.py, export_runtime.py, build_index.py, build_glossary.py)
through `chapters.run_volumes(…, path=…)`; each entry point takes `--check` (exit 1 when a file would change).

The export keeps everything of the document (guidance too: «Нитка глави», «Бачимо»); the runtime file keeps the
on-screen part in the shape `defineContent()` reads (`app/src/content/types.ts`, `StepContent.path`,
`ChapterContent.path`). Terms introduced by a step are marked `**…**` at their first use in «Текст» (else in
«Висновок») — the panel links each mark to the term's card.
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import path_format as P  # noqa: E402

SCHEMA = 1
PARA = '\n\n'
BOLD = re.compile(r'\*\*([^*]+)\*\*')
LAYERS = ('prologue', 'path', 'branch', 'practicum')


def journey():
    """volume.json journey entries by id, each with its layer (from its group), floor and minutes."""
    layers = {g['id']: g.get('layer', 'path') for g in C.META['groups']}
    floors = {f['id']: f for f in C.META['axis'].get('floors', [])}
    out = {}
    for i, c in enumerate(C.META['journey']):
        floor = floors.get(c.get('floor'))
        out[c['id']] = dict(order=i + 1, group=c['group'], layer=layers.get(c['group'], 'path'),
                            title=c.get('title', ''), minutes=c.get('minutes'), parent=c.get('parent'),
                            floor=floor['label'] if floor else '', axisValue=floor['value'] if floor else None)
    return out


def load_volume():
    """→ (register, {id: chapter}, problems) for the current volume (chapters with a document only)."""
    reg, err = P.load_register(C.CHAPTER_DIR)
    docs = {}
    for cid in C.CHAPTER_IDS:
        ch, e = P.load_chapter(C.chapter_path(cid), cid)
        docs[cid] = ch
        err += e
    return reg, docs, err


def next_chapter(cid, jn, docs):
    """The chapter the bridge leads to: the next prologue / path / practicum entry of the journey (branches skipped)."""
    ids = [c for c in C.PLANNED if jn[c]['layer'] != 'branch']
    if cid not in ids or ids.index(cid) + 1 >= len(ids):
        return None
    nid = ids[ids.index(cid) + 1]
    return dict(id=nid, title=docs[nid]['title'] if nid in docs else jn[nid]['title'])


def step_titles(docs):
    return {'%s/%s/%s' % (C.VOLUME, cid, s['id']): s['title'] for cid, ch in docs.items() for s in ch['steps']}


def mark_terms(text, terms, reg, marks):
    """Wrap the first use of each new term in `**…**` and append `{text, term}` to `marks` (the panel links a
    bold span to its card through it: the span is a case form, «електричним струмом», not the card name).
    Returns (text, names that were not found)."""
    missing = []
    for name in terms:
        row = next((t for t in reg['terms'] if t['name'] == name), None)
        # a span the writer marked by hand (`**провідником**`) wins over the first match
        bold = next((b for b in BOLD.finditer(text) if row and row['rx'].search(b.group(1))), None)
        if bold:
            marks.append(dict(text=bold.group(1), term=name))
            continue
        m = row and row['rx'].search(BOLD.sub(lambda b: ' ' * len(b.group(0)), text))
        if not m:
            missing.append(name)
            continue
        text = text[:m.start()] + '**' + m.group(0) + '**' + text[m.end():]
        marks.append(dict(text=m.group(0), term=name))
    return text, missing


def cards(names, reg):
    by = {t['name']: t for t in reg['terms']}
    return [dict(name=n, card=by[n]['card']) for n in names if n in by]


def more_words(ch, reg):
    """Words of «лише для Докладніше» that this chapter's «Докладніше» blocks use."""
    blob = ' '.join(' '.join(s['more']) if isinstance(s.get('more'), list) else s.get('more', '') for s in ch['steps'])
    return [w for w in reg['more'] if w['rx'].search(blob)]


def paragraphs(value):
    if isinstance(value, list):
        return value
    return [] if value.strip() in P.NONE else [value]


def export_chapter(ch, reg, jn, docs):
    cid, j = ch['id'], jn[ch['id']]
    titles = step_titles(docs)
    steps = []
    for s in ch['steps']:
        recall = [P.full_step(r, C.VOLUME, cid) for r in s['recall']]
        steps.append(dict(
            id=s['id'], title=s['title'], idea=s.get('idea', ''), text=paragraphs(s.get('text', '')), action=s.get('action', ''),
            takeaway=s.get('takeaway', ''), terms=cards(s['terms'], reg), more=paragraphs(s.get('more', '')),
            recall=[dict(target=r, title=titles.get(r, '')) for r in recall],
            hints=s['hints'], captions=s['captions'], goal=s.get('goal', ''),
            see=s.get('see', '')))
    intro = {t['name']: '%s/%s/%s' % (C.VOLUME, cid, s['id']) for s in ch['steps'] for t in cards(s['terms'], reg)}
    kinds = {t['name']: t['kind'] for t in reg['terms']}
    glossary = [dict(name=n, card=c['card'], kind='practicum' if kinds[n] == 'практикум' else 'path', step=intro[n])
                for n, c in ((c['name'], c) for s in ch['steps'] for c in cards(s['terms'], reg))]
    glossary += [dict(name=w['name'], card=w['card'], kind='more', step=None) for w in more_words(ch, reg)]
    return dict(schemaVersion=SCHEMA, format='path', volume=C.VOLUME, id=cid, title=ch['title'], layer=j['layer'],
                group=j['group'], order=j['order'], parent=j['parent'], floor=j['floor'], axisValue=j['axisValue'],
                minutes=j['minutes'], hook=ch['hook'], know=ch['know'], thread=ch['thread'], now=ch['now'],
                bridge=ch['bridge'], next=next_chapter(cid, jn, docs), steps=steps, glossary=glossary)


def runtime(ex, reg):
    """The on-screen subset for `defineContent()` and the eager manifest for `index.ts`."""
    def term(name, card):
        return dict(international=name, ukrainian=name, name=name, definition=card)
    steps = []
    for s in ex['steps']:
        names = [t['name'] for t in s['terms']]
        marks = []
        # the paragraphs of the main text are marked as one text (a term is marked once, at its first use)
        text, missing = mark_terms(PARA.join(s['text']), names, reg, marks)
        takeaway, _ = mark_terms(s['takeaway'], missing, reg, marks)
        path = dict(idea=s['idea'], action=s['action'], takeaway=takeaway, more=s['more'], marks=marks)
        if s['recall']:
            path['recall'] = s['recall']
        if s['hints']:
            path['hints'] = s['hints']
        step = dict(id=s['id'], title=s['title'], panel=text.split(PARA), terms=[term(t['name'], t['card']) for t in s['terms']],
                    path=path)
        if any(len(c) > 1 for c in s['captions']):
            path['captions'] = s['captions']
        if s['captions']:
            step['labels'] = [c['text'] for c in s['captions']]
        steps.append(step)
    chapter = dict(layer=ex['layer'], hook=ex['hook'], know=ex['know'], now=ex['now'], bridge=ex['bridge'],
                   next=ex['next'], minutes=ex['minutes'])
    content = dict(volume=ex['volume'], id=ex['id'], title=ex['title'], group=ex['group'], path=chapter,
                   steps=steps, glossary=[term(g['name'], g['card']) for g in ex['glossary']])
    manifest = dict(volume=ex['volume'], id=ex['id'], title=ex['title'], subtitle=ex['steps'][0]['title'] if ex['steps'] else '',
                    axisLabel=ex['floor'], axisValue=ex['axisValue'], group=ex['group'], parent=ex['parent'],
                    order=ex['order'], format='path', layer=ex['layer'], minutes=ex['minutes'],
                    steps=[dict(id=s['id'], title=s['title'], blurb=s['idea']) for s in ex['steps']])
    return content, manifest


HEAD = '<!-- Generated by tools/content/path_export.py from docs/volumes/%s/chapters — do not edit. -->\n\n'
LAYER_UK = dict(prologue='пролог', path='шлях', branch='гілка', practicum='практикум')


def render_index(built):
    jn, have = journey(), {ex['id']: ex for ex, _ in built}
    out = [HEAD % C.VOLUME, '# %s — покажчик кроків\n' % C.META['title']]
    for cid in C.PLANNED:
        j, ex = jn[cid], have.get(cid)
        title = ex['title'] if ex else j['title']
        out.append('## %d. `%s` — %s\n' % (j['order'], cid, title))
        out.append('%s · %s · ≈ %s хв%s\n' % (LAYER_UK[j['layer']], j['floor'] or '—', j['minutes'] or '?',
                                               '' if ex else ' · документа ще немає'))
        if ex:
            out.append('| Крок | Назва | Думка |\n|---|---|---|')
            out += ['| `%s/%s` | %s | %s |' % (cid, s['id'], s['title'], s['idea'].replace('|', '\\|'))
                    for s in ex['steps']]
            out.append('')
    return '\n'.join(out).rstrip() + '\n'


def render_glossary(built):
    terms, more = [], {}
    for ex, _ in built:
        for g in ex['glossary']:
            if g['kind'] == 'more':
                more.setdefault(g['name'], (g['card'], []))[1].append(ex['id'])
            else:
                terms.append((g['name'], g['card'], g['step'].split('/', 1)[1], g['kind']))
    out = [HEAD % C.VOLUME, '# %s — довідник\n' % C.META['title'], '## Терміни шляху\n',
           '| Термін | Картка | Вводить крок |', '|---|---|---|']
    out += ['| %s%s | %s | `%s` |' % (n, ' (практикум)' if k == 'practicum' else '', c, s) for n, c, s, k in terms]
    out += ['', '## Слова з «Докладніше»\n', '| Слово | Картка | Глави |', '|---|---|---|']
    out += ['| %s | %s | %s |' % (n, c, ', '.join('`%s`' % i for i in ids)) for n, (c, ids) in more.items()]
    return '\n'.join(out) + '\n'


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


def sync(files, directory, check, pattern):
    """Write {name: text} into `directory`; drop stale files matching `pattern`. → number of files that differ."""
    os.makedirs(directory, exist_ok=True)
    stale = [f for f in os.listdir(directory) if re.match(pattern, f) and f not in files]
    diff = len(stale)
    for name, text in files.items():
        path = os.path.join(directory, name)
        old = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if old != text:
            diff += 1
            if not check:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(text)
    if not check:
        for f in stale:
            os.remove(os.path.join(directory, f))
    return diff


def build():
    reg, docs, err = load_volume()
    if err:
        return None, err
    jn = journey()
    return [(export_chapter(docs[c], reg, jn, docs), reg) for c in C.CHAPTER_IDS], []


def _main(kind):
    check = '--check' in sys.argv
    built, err = build()
    if err:
        print('\n'.join('path: ' + e for e in err) + '\npath export: %d structural problem(s)' % len(err))
        return 1
    if kind == 'export':
        files = {ex['id'] + '.json': dump(ex) for ex, _ in built}
        diff = sync(files, C.EXPORT_DIR, check, r'^[^_].*\.json$')
    elif kind == 'runtime':
        files = {}
        for ex, reg in built:
            content, manifest = runtime(ex, reg)
            files[ex['id'] + '.json'], files[ex['id'] + '.manifest.json'] = dump(content), dump(manifest)
        diff = sync(files, C.GENERATED_DIR, check, r'^.*\.json$')
    else:
        text = render_index(built) if kind == 'index' else render_glossary(built)
        target = C.INDEX_PATH if kind == 'index' else C.GLOSSARY_PATH
        diff = sync({os.path.basename(target): text}, os.path.dirname(target), check, r'^$')
    print('path %s[%s]: %d chapter(s), %s' % (kind, C.VOLUME, len(built),
          ('%d file(s) out of date' % diff if diff else 'up to date') if check else '%d file(s) written' % diff))
    return 1 if check and diff else 0


def export_main():
    return _main('export')


def runtime_main():
    return _main('runtime')


def index_main():
    return _main('index')


def glossary_main():
    return _main('glossary')
