# -*- coding: utf-8 -*-
"""Genera data.json e POSIZIONI_E_FONTI.md da fonti_quiz.json.

fonti_quiz.json e' l'unica fonte di verita': domande, punteggi, livelli di
evidenza e fonti stanno li'. Fino alla v2.9 data.json veniva modificato a mano
e aveva finito per divergere dalla documentazione in 135 celle su 275; da qui
in avanti non si tocca piu' a mano, si rigenera.

Uso:
    python build_data.py            rigenera i due file
    python build_data.py --check    fallisce se i file versionati non coincidono
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'fonti_quiz.json'
OUT_DATA = ROOT / 'data.json'
OUT_MD = ROOT / 'POSIZIONI_E_FONTI.md'


def quiz_score(pos, invertita):
    """Punteggio mostrato nel quiz: specchiato se la domanda e' invertita."""
    s = pos['punteggio']
    if s is None:
        return None
    return 8 - s if invertita else s


def build_data(src):
    meta, domande = src['_meta'], src['domande']
    livelli = Counter(p['livello'] or 'null' for d in domande for p in d['posizioni'].values())
    categories = [dict(c, questions=[]) for c in meta['categorie']]
    by_name = {c['name']: c for c in categories}

    n = 0
    for d in domande:
        n += 1
        q = {
            'id': f'q{n}',
            'key': d['id'],
            'theme': d['tema'],
            'text': d.get('testo_quiz', d['testo']),
            'scores': {p: quiz_score(v, d['invertita']) for p, v in d['posizioni'].items()},
        }
        if d['invertita']:
            q['invertita'] = True
        by_name[d['categoria']]['questions'].append(q)

    return {
        '_meta': {
            'versione': meta['versione'],
            'aggiornato': meta['data_codifica'],
            'generato_da': 'build_data.py a partire da fonti_quiz.json: non modificare a mano',
            'nota': 'I punteggi null indicano una posizione non documentata e sono esclusi dal calcolo. '
                    'Nelle domande invertite il punteggio e\' specchiato (8 meno il valore documentato).',
            'domande_invertite': [d['tema'] for d in domande if d['invertita']],
            'celle_per_livello': dict(sorted(livelli.items())),
        },
        'parties': meta['partiti'],
        'categories': categories,
    }


def cell(v):
    return '—' if v is None else str(v)


def build_md(src):
    meta, fonti, domande = src['_meta'], src['fonti'], src['domande']
    livelli = Counter(p['livello'] or 'null' for d in domande for p in d['posizioni'].values())
    L = []
    L.append('# Posizioni dei partiti e fonti\n')
    L.append(f"Codifica {meta['versione']} del {meta['data_codifica']}. File generato da `build_data.py` "
             'a partire da `fonti_quiz.json`: le modifiche vanno fatte li\'.\n')
    L.append(f"> {meta['nota']}\n")
    L.append('## Come leggere questo documento\n')
    L.append('**Scala.** ' + '; '.join(f'**{k}** {v}' for k, v in meta['scala'].items()) + '.\n')
    L.append('**Livelli di evidenza.** ' + '; '.join(f'**{k}** {v}' for k, v in meta['livelli'].items()) + '.\n')
    L.append('**Convenzioni.**\n')
    for c in meta['convenzioni']:
        L.append(f'- {c}')
    L.append('')
    L.append('**Fonti.** ' + meta['verificata'] + '\n')
    L.append('| Livello | Celle |\n|:---:|---:|')
    for k in ('A', 'B', 'C', 'E', 'null'):
        L.append(f'| {k} | {livelli.get(k, 0)} |')
    L.append('\n---\n')

    for i, d in enumerate(domande, 1):
        L.append(f"## {i}. {d['tema']}\n")
        L.append(f"*Categoria:* {d['categoria']}\n")
        L.append(f"**Affermazione:** {d['testo']}\n")
        if d['invertita']:
            L.append(f"**Nel quiz, invertita:** {d['testo_quiz']} — i punteggi usati dal quiz sono 8 meno quelli qui sotto.\n")
        L.append(f"*Direzione:* {d['direzione_accordo']}. *Formulazione:* {d['nota_formulazione']}\n")
        L.append('| Partito | Punteggio | Liv. | Posizione documentata |\n|---|:---:|:---:|---|')
        usate = []
        for p, v in d['posizioni'].items():
            L.append(f"| **{p}** | **{cell(v['punteggio'])}** | {v['livello'] or '—'} | {v['evidenza']} |")
            for fid in [v['fonte'], *v.get('altre_fonti', [])]:
                if fid and fid not in usate:
                    usate.append(fid)
        L.append('\n**Fonti:**\n')
        for fid in usate:
            f = fonti[fid]
            L.append(f"- *(liv. {f['livello']}, verificata il {f['verificata']})* {f['descrizione']}  \n  <{f['url']}>")
        L.append('\n---\n')
    return '\n'.join(L)


def dump_json(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


def main():
    src = json.loads(SRC.read_text(encoding='utf-8'))
    outputs = {OUT_DATA: dump_json(build_data(src)), OUT_MD: build_md(src)}
    if '--check' in sys.argv:
        # Git su Windows puo' riscrivere i fine riga: il confronto li ignora
        stale = [p.name for p, text in outputs.items()
                 if p.read_text(encoding='utf-8').replace('\r\n', '\n') != text]
        if stale:
            sys.exit('Da rigenerare con python build_data.py: ' + ', '.join(stale))
        print('data.json e POSIZIONI_E_FONTI.md coincidono con fonti_quiz.json')
        return
    for path, text in outputs.items():
        path.write_text(text, encoding='utf-8', newline='\n')
    print('Rigenerati data.json e POSIZIONI_E_FONTI.md')


if __name__ == '__main__':
    main()
