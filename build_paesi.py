# -*- coding: utf-8 -*-
"""Genera paesi.json dall'elenco ISTAT dei codici delle unita' territoriali estere.

Fonte: https://github.com/pmontrasio/codici-stati (nomi italiani e codici ISTAT,
Agenzia delle Entrate, Ministero dell'Interno, ISO 3166).

L'elenco ISTAT e' pensato per la burocrazia, non per un menu a tendina: contiene
denominazioni come "GR. BRET. - IRLANDA DEL NORD (REGNO UNITO)" e qualifiche fra
parentesi. Questo script lo rende leggibile e ne corregge le lacune.

Uso:
    curl -o countries.json https://raw.githubusercontent.com/pmontrasio/codici-stati/master/dist/countries.json
    python build_paesi.py countries.json
"""
import io, json, re, sys

# Denominazioni burocratiche riscritte in forma corrente
RISCRITTURE = {
    'GR. BRET. - IRLANDA DEL NORD (REGNO UNITO)': 'Regno Unito',
    'CONGO REPUBBLICA DEMOCRATICA': 'Repubblica Democratica del Congo',
    'CONGO REPUBBLICA POPOLARE': 'Repubblica del Congo',
    'GUINEA REPUBBLICA POPOLARE': 'Guinea',
    'MICRONESIA STATI FEDERATI': 'Micronesia',
    'PUERTO RICO (STATO LIBERO ASSOCIATO)': 'Porto Rico',
    'TIMOR (ISOLA) - ORIENTALE': 'Timor Est',
    'TERRITORIO BRIT. DELL\'OCEANO INDIANO': "Territorio Britannico dell'Oceano Indiano",
    'TERRITORIO D. ISOLE HEARD E MAC DONALD': 'Isole Heard e McDonald',
    'GEORGIA DEL SUD E SANDWICH AUSTRALI': 'Georgia del Sud e Sandwich Australi',
    'STATI UNITI - ISOLE MINORI LONTANE': 'Isole Minori Esterne degli Stati Uniti',
    'MARIANNE (ISOLE) (SETTENTRIONALI?)': 'Isole Marianne Settentrionali',
    'NUOVA CALEDONIA (ISOLE E DIPENDENZE)': 'Nuova Caledonia',
    'PITCAIRN (E DIPENDENZE)': 'Pitcairn',
    'SAMOA SWAIN (AMERICANE)': 'Samoa Americane',
    'TERRITORI AUSTRALI E ANTARTICI FRANCESI': 'Terre Australi e Antartiche Francesi',
    "SAO TOME' E PRINCIPE (ISOLE)": 'Sao Tome e Principe',
    'SEICELLE (ISOLE)': 'Seychelles',
    'MAURIZIO (ISOLE)': 'Mauritius',
    'FIGI=VITI (ISOLE)': 'Figi',
    'RIUNIONE (ISOLA)': 'Riunione',
    'SUDAFRICANA REPUBBLICA': 'Sudafrica',
    'CENTRAFRICANA REPUBBLICA': 'Repubblica Centrafricana',
    'ANTARCTICA': 'Antartide',
    'SAINT KITTS E NEVIS=S. CHRISTOPHER E NEVIS': 'Saint Kitts e Nevis',
}

# Stati esistenti che l'elenco non riporta con un nome italiano
AGGIUNTE = ['Serbia', 'Montenegro', 'Kosovo', 'Sud Sudan', 'Palestina',
            'Curacao', 'Sint Maarten', 'Bonaire, Sint Eustatius e Saba',
            'Guernsey', 'Isola di Man', 'Jersey', 'Isole Aland',
            'Saint Barthelemy', 'Saint Martin']

# Fuori elenco: chi risiede all'estero non risiede in Italia, e le Antille
# Olandesi si sono sciolte nel 2010 (i successori sono fra le aggiunte).
ESCLUSI = {'ITALIA', 'ANTILLE OLANDESI (SUDAMERICANE)',
           'FRANCIA, METROPOLITAN'}   # doppione tecnico della Francia

MINUSCOLE = {'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'e',
             'ed', 'il', 'lo', 'la', 'i', 'gli', 'le', 'in', 'su', 'per', 'con'}


def leggibile(nome):
    """Da MAIUSCOLO burocratico a forma leggibile."""
    if nome in RISCRITTURE:
        return RISCRITTURE[nome]
    n = nome.split('=')[0].strip()                    # "FIGI=VITI" -> "FIGI"
    n = re.sub(r'\s*\((ISOLA|ISOLE|ATOLLO)\)\s*', ' ', n).strip()
    parole = []
    for i, p in enumerate(n.split()):
        b = p.lower()
        if i > 0 and b in MINUSCOLE:
            parole.append(b)
        elif "'" in b:                                # D'AMERICA -> d'America
            a, _, c = b.partition("'")
            parole.append((a if i > 0 and a in ('d', 'l', 'dell') else a.capitalize())
                          + "'" + c.capitalize())
        else:
            parole.append(b.capitalize())
    return ' '.join(parole)


def main(sorgente):
    dati = json.load(io.open(sorgente, encoding='utf-8'))
    nomi = set()
    for v in dati.values():
        grezzo = v.get('italian_country_name_1')
        if grezzo and grezzo.strip() and grezzo.strip() not in ESCLUSI:
            nomi.add(leggibile(grezzo.strip()))
    nomi.update(AGGIUNTE)
    elenco = sorted(nomi, key=lambda s: s.lower())
    io.open('paesi.json', 'w', encoding='utf-8', newline='\n').write(
        json.dumps(elenco, ensure_ascii=False, indent=0) + '\n')
    print('paesi.json: %d paesi' % len(elenco))
    return elenco


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'countries.json')
