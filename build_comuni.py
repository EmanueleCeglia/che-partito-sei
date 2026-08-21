"""
Script to download and process Italian comuni data from matteocontrini/comuni-json
into a compact format: { "Regione": { "Provincia": ["Comune1", "Comune2", ...] } }
"""
import json
import urllib.request

URL = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json"

print("Downloading comuni data...")
with urllib.request.urlopen(URL) as response:
    raw = json.loads(response.read().decode('utf-8'))

print(f"Downloaded {len(raw)} comuni")

# Build compact structure: regione -> provincia -> [comuni]
data = {}
for comune in raw:
    regione = comune['regione']['nome']
    provincia = comune['provincia']['nome']
    nome = comune['nome']
    
    if regione not in data:
        data[regione] = {}
    if provincia not in data[regione]:
        data[regione][provincia] = []
    data[regione][provincia].append(nome)

# Sort everything alphabetically
sorted_data = {}
for regione in sorted(data.keys()):
    sorted_data[regione] = {}
    for provincia in sorted(data[regione].keys()):
        sorted_data[regione][provincia] = sorted(data[regione][provincia])

# Count stats
n_regioni = len(sorted_data)
n_province = sum(len(p) for p in sorted_data.values())
n_comuni = sum(len(c) for p in sorted_data.values() for c in p.values())
print(f"Regioni: {n_regioni}, Province: {n_province}, Comuni: {n_comuni}")

# Write compact JSON
output_path = "comuni.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(sorted_data, f, ensure_ascii=False, separators=(',', ':'))

import os
size = os.path.getsize(output_path)
print(f"Written to {output_path} ({size:,} bytes / {size/1024:.1f} KB)")
