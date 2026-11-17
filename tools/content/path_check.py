#!/usr/bin/env python3
"""doccheck group `path` — the standard of docs/VOLUME_STRUCTURE.md on the chapter documents of a path volume
(docs/PATH_FORMAT.md §4). Ported from docs/volumes/circuit/check.py (term order, budgets, bridge, register).

errors    structure (sections, fields incl. «Ціль», step numbering; > 2 hints); budgets (steps and terms per chapter, terms per step,
          idea one sentence ≤ 32 words, main text ≤ 90 words); a register term used in on-screen text before the
          step that introduces it, a step whose «Нові терміни» differ from the register, an introduced term the
          step does not use; a «Докладніше»-only or banned word in on-screen text; «Що ми тепер знаємо» not three
          lines; a bridge that does not end with the next chapter's question; «Згадати» to an unknown or later step;
          a formula sign in the main text, a `**…**` span that is not a new term of the step; Latin words outside the allowlists (§54)
warnings  idea > 25 or text > 80 words; a sentence that starts with the term it introduces; singular address
          («ти», «твій», «натисни» …) — the reader is addressed as «ви» (owner, 16.11.2026)

Usage: path_check.py [--volume <id> | --all] [--selftest]
"""
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import path_export as X  # noqa: E402
import path_format as P  # noqa: E402

BUDGETS = dict(chapterSteps=(4, 8), prologueSteps=(4, 5), chapterTerms=6, stepTerms=2, ideaWords=(25, 32),
               textWords=(80, 90), nowLines=3)
FORMULA = re.compile(r'[=≈×÷√^]|`')
SINGULAR = re.compile(
    r'\b(?:ти|тебе|тобі|тобою|твій|твоя|твоє|твої|твого|твоєї|твоїм|твоїй|твоїх|твою|подивись|подивися|'
    r'натисни|торкнись|торкнися|спробуй|потягни|збери|згадай|уяви|зроби|постав|зніми|приєднай|наведи|пересунь|'
    r'клацни|перетягни|покрути|порівняй|знайди|дивись|глянь|поклади|переверни|обмотай|запам’ятай)\b', re.I)


def norm(s):
    return re.sub(r'[^\w ]', '', re.sub(r'\s+', ' ', s.lower())).strip()


def words(s):
    return len(re.sub(r'[—–]', ' ', s).split())


def sentences(s):
    return len(re.findall(r'[.!?…](?=\s|$)', s.strip()))


def budgets():
    b = dict(BUDGETS)
    b.update({k: tuple(v) if isinstance(v, list) else v for k, v in C.META.get('path', {}).get('budgets', {}).items()})
    return b


def positions(docs, jn):
    """Reading position of every step: chapter index in the journey × 1000 + step number. A step of a chapter
    without a document sits at its chapter's first step (a term it introduces is «later» for every earlier chapter)."""
    pos = {}
    for ci, cid in enumerate(C.PLANNED):
        pos['%s/%s/' % (C.VOLUME, cid)] = ci * 1000 + 1
        for si, s in enumerate(docs[cid]['steps'] if cid in docs else []):
            pos['%s/%s/%s' % (C.VOLUME, cid, s['id'])] = ci * 1000 + si + 1
    return pos


def units(ch, ci):
    """On-screen texts of a chapter with their reading position («Докладніше» and guidance excluded)."""
    cid, first, last = ch['id'], ci * 1000 + 0.5, ci * 1000 + 999
    out = [('%s: title' % cid, ch['title'], first), ('%s: hook' % cid, ch['hook'], first),
           ('%s: know' % cid, ch['know'], first), ('%s: bridge' % cid, ch['bridge'], last)]
    out += [('%s: now %d' % (cid, i + 1), t, last) for i, t in enumerate(ch['now'])]
    for si, s in enumerate(ch['steps']):
        out += [('%s/%s: %s' % (cid, s['id'], k), flat(s.get(k)), ci * 1000 + si + 1)
                for k in ('title', 'idea', 'text', 'action', 'takeaway', 'hints', 'labels')]
    return out


def flat(v):
    return ' '.join(v) if isinstance(v, list) else (v or '')


def check_chapter(ch, ci, jn, docs, reg, b, err, warn):
    cid, j = ch['id'], jn[ch['id']]
    layer = j['layer']
    need = {'prologue': ['hook', 'steps', 'bridge'], 'practicum': ['steps']}.get(
        layer, ['hook', 'know', 'steps', 'thread', 'now', 'bridge'])
    err += ['%s: section «%s» missing' % (cid, k) for k in need if k not in ch['sections']]
    if layer == 'prologue':
        err += ['%s: a prologue has no «%s»' % (cid, k) for k in ('know', 'now') if k in ch['sections']]
    if not ch['title'].endswith('?') and layer != 'practicum':
        err.append('%s: the title is not a question' % cid)
    lo, hi = b['prologueSteps'] if layer == 'prologue' else b['chapterSteps']
    if layer != 'practicum' and not lo <= len(ch['steps']) <= hi:
        err.append('%s: %d steps (budget %d–%d)' % (cid, len(ch['steps']), lo, hi))
    kinds = {t['name']: t['kind'] for t in reg['terms']}
    n_terms = 0
    for s in ch['steps']:
        where = '%s/%s' % (cid, s['id'])
        err += ['%s: field «%s» missing' % (where, k) for k in s['missing']
                if not (k == 'more' and layer == 'prologue')]
        for k in ('idea', 'action', 'takeaway'):
            if isinstance(s.get(k), list):
                err.append('%s: «%s» is one paragraph' % (where, k))
        if isinstance(s.get('text'), list) and len(s['text']) > 2:
            err.append('%s: «Текст» has %d paragraphs (at most 2)' % (where, len(s['text'])))
        idea, text = flat(s.get('idea')), flat(s.get('text'))
        if sentences(idea) != 1 or words(idea) > b['ideaWords'][1]:
            err.append('%s: idea is %d sentence(s), %d words (one sentence ≤ %d)' % (where, sentences(idea), words(idea),
                                                                                  b['ideaWords'][1]))
        elif words(idea) > b['ideaWords'][0]:
            warn.append('%s: idea has %d words (≈ %d)' % (where, words(idea), b['ideaWords'][0]))
        if words(text) > b['textWords'][1]:
            err.append('%s: main text has %d words (≤ %d)' % (where, words(text), b['textWords'][1]))
        elif words(text) > b['textWords'][0]:
            warn.append('%s: main text has %d words (≈ %d)' % (where, words(text), b['textWords'][0]))
        if FORMULA.search(text):
            err.append('%s: main text has a code span or a formula sign' % where)
        rxs = [t['rx'] for t in reg['terms'] if t['name'] in s['terms']]
        for part in (text, flat(s.get('takeaway'))):
            err += ['%s: «**%s**» is not a new term of this step (only new terms are marked)' % (where, b)
                    for b in X.BOLD.findall(part) if not any(rx.search(b) for rx in rxs)]
        if len(s['hints']) > 2:
            err.append('%s: %d hints (at most 2: after 15 s and after 40 s)' % (where, len(s['hints'])))
        if len(s['terms']) > b['stepTerms']:
            err.append('%s: %d new terms (budget %d)' % (where, len(s['terms']), b['stepTerms']))
        for t in s['terms']:
            if t not in kinds:
                err.append('%s: term «%s» is not in _terms.md' % (where, t))
            elif (kinds[t] == 'практикум') != (layer == 'practicum'):
                err.append('%s: term «%s» of type «%s» in a %s chapter' % (where, t, kinds[t], layer))
            else:
                n_terms += kinds[t] == 'шлях'
    if layer == 'prologue' and n_terms:
        err.append('%s: the prologue introduces %d term(s)' % (cid, n_terms))
    if n_terms > b['chapterTerms']:
        err.append('%s: %d new terms (budget %d)' % (cid, n_terms, b['chapterTerms']))
    if layer in ('path', 'branch'):
        if len(ch['now']) != b['nowLines']:
            err.append('%s: «Що ми тепер знаємо» has %d lines (%d)' % (cid, len(ch['now']), b['nowLines']))
        err += ['%s: now %d is not one sentence' % (cid, i + 1) for i, t in enumerate(ch['now']) if sentences(t) != 1]
    nxt = X.next_chapter(cid, jn, docs)
    if nxt and layer != 'branch' and 'bridge' in need and not norm(ch['bridge']).endswith(norm(nxt['title'])):
        err.append('%s: the bridge does not end with the next question «%s»' % (cid, nxt['title']))


def check_terms(docs, jn, reg, pos, err, warn):
    """The register against the steps, the order of terms, banned words, «Згадати»."""
    full = lambda ref: P.full_step(ref, C.VOLUME, ref.split('/')[0])  # noqa: E731 — register refs are chapter/step
    intro = {}
    for t in reg['terms']:
        ref = full(t['step']) if t['step'].count('/') == 1 else t['step']
        cid = ref.split('/')[1]
        if cid not in C.PLANNED:
            err.append('_terms.md: «%s» is introduced in %s — no such chapter in the journey' % (t['name'], ref))
            continue
        if cid in docs and ref not in pos:
            err.append('_terms.md: «%s» is introduced in %s — no such step' % (t['name'], ref))
            continue
        intro[t['name']] = (ref, pos.get(ref, pos['%s/%s/' % (C.VOLUME, cid)]), t)
    for cid, ch in docs.items():
        for s in ch['steps']:
            ref = '%s/%s/%s' % (C.VOLUME, cid, s['id'])
            want = sorted(n for n, (r, _, _) in intro.items() if r == ref)
            if sorted(s['terms']) != want:
                err.append('%s/%s: new terms %s ≠ register %s' % (cid, s['id'], s['terms'], want))
            for name in s['terms']:
                rx = intro[name][2]['rx'] if name in intro else None
                body = flat(s.get('text')) + ' ' + flat(s.get('takeaway'))
                if rx and not rx.search(body):
                    err.append('%s/%s: introduces «%s» but neither «Текст» nor «Висновок» uses it' % (cid, s['id'], name))
                elif rx and any(rx.match(x.strip()) for x in re.split(r'(?<=[.!?…:])\s+', body)):
                    warn.append('%s/%s: a sentence starts with the new term «%s» (phenomenon first, name after)'
                                % (cid, s['id'], name))
            for r in s['recall']:
                target = P.full_step(r, C.VOLUME, cid)
                if target.split('/')[0] != C.VOLUME:
                    warn.append('%s/%s: «Згадати» into another volume (%s) is not checked' % (cid, s['id'], target))
                elif target not in pos or target.endswith('/'):
                    err.append('%s/%s: «Згадати» → unknown step %s' % (cid, s['id'], target))
                elif pos[target] >= pos[ref]:
                    err.append('%s/%s: «Згадати» → %s is not an earlier step' % (cid, s['id'], target))
    for ci, cid in enumerate(C.PLANNED):
        for label, text, p in units(docs[cid], ci) if cid in docs else []:
            for name, (ref, at, t) in intro.items():
                m = t['rx'].search(text)
                if m and at > p:
                    err.append('%s: «%s» used before %s — “%s”' % (label, name, ref, m.group(0)))
            for w in reg['more'] + reg['banned']:
                m = w['rx'].search(text)
                if m:
                    err.append('%s: «%s» is not allowed in on-screen text — “%s”' % (label, w['name'], m.group(0)))
            m = SINGULAR.search(text)
            if m:
                warn.append('%s: address the reader as «ви» — “%s”' % (label, m.group(0)))


def check_latin(docs, err):
    import terms_check as T
    allow, problems = T.load_allowlist()
    err += problems
    for ci, cid in enumerate(C.PLANNED):
        texts = units(docs[cid], ci) if cid in docs else []
        texts += [('%s/%s: more' % (cid, s['id']), flat(s.get('more')), 0) for s in docs.get(cid, {}).get('steps', [])]
        for label, text, _ in texts:
            err += ['%s: Latin word «%s» is not in the allowlist (§54)' % (label, w)
                    for w, _ in T.latin_words(text) if not T.allowed(w, allow)]


def check_volume(reg, docs):
    err, warn = [], []
    jn, b = X.journey(), budgets()
    pos = positions(docs, jn)
    for ci, cid in enumerate(C.PLANNED):
        if cid in docs:
            check_chapter(docs[cid], ci, jn, docs, reg, b, err, warn)
    check_terms(docs, jn, reg, pos, err, warn)
    check_latin(docs, err)
    return err, warn


def main():
    reg, docs, err = X.load_volume()
    if not err:
        e, warn = check_volume(reg, docs)
        err += e
        for w in warn:
            print('warning: ' + w)
    for e in err:
        print('error: ' + e)
    print('path[%s]: %d chapter document(s), %d step(s), %d register term(s) — %s'
          % (C.VOLUME, len(docs), sum(len(c['steps']) for c in docs.values()), len(reg['terms']),
             '%d error(s)' % len(err) if err else 'ok'))
    return 1 if err else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(lambda: print('not a path volume') or 0, default_all=False, path=main))
