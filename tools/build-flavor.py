#!/usr/bin/env python3
"""Abbinamenti per molecole aromatiche dal "Flavor Network" (Ahn, Ahnert, Bagrow, Barabási,
Sci. Rep. 1:196, 2011, dati supplementari). Per ogni coppia di ingredienti conto le molecole
aromatiche in comune, normalizzate (così gli ingredienti con tantissime molecole non vincono sempre),
e tengo solo gli ingredienti che esistono nel catalogo dell'app.
Uso: python3 tools/build-flavor.py <cartella con ingr_info.tsv e ingr_comp.tsv>"""
import sys, json, math, collections, os

D = sys.argv[1]
# chiave dell'app (catalogo, o catalogo:tipo per spezie/erbe) -> nomi nel Flavor Network
MAP = {
 'pomodoro': ['tomato'], 'insalata': ['lettuce'], 'spinaci': ['dried_spinach'], 'rucola': ['rocket'], 'carota': ['carrot'],
 'patata': ['potato'], 'patatadolce': ['sweet_potato'], 'cipolla': ['onion'], 'aglio': ['garlic'], 'zucchina': ['zucchini'],
 'melanzana': ['eggplant'], 'peperone': ['bell_pepper'], 'peperoncino': ['cayenne', 'thai_pepper'], 'cetriolo': ['cucumber'],
 'broccoli': ['broccoli'], 'cavolfiore': ['cauliflower'], 'finocchio': ['fennel'], 'funghi': ['mushroom'], 'mais': ['corn'],
 'avocado': ['avocado'], 'sedano': ['celery'], 'porro': ['leek'], 'asparagi': ['asparagus'], 'carciofo': ['artichoke'],
 'radicchio': ['chicory'], 'fagiolini': ['raw_bean'], 'piselli': ['pea'], 'zucca': ['pumpkin', 'squash'],
 'barbabietola': ['beet'], 'zenzero': ['ginger'], 'olive': ['olive'],
 'mela': ['apple'], 'pera': ['pear'], 'banana': ['banana'], 'arancia': ['orange'], 'mandarino': ['mandarin', 'tangerine'],
 'limone': ['lemon'], 'fragola': ['strawberry'], 'ciliegia': ['cherry'], 'uva': ['grape'], 'pesca': ['peach'],
 'prugna': ['plum'], 'fico': ['fig'], 'kiwi': ['kiwi'], 'melograno': ['pomegranate'], 'kaki': ['persimmon'],
 'ananas': ['pineapple'], 'mango': ['mango'], 'melone': ['melon', 'cantaloupe'], 'anguria': ['watermelon'],
 'mirtilli': ['blueberry'], 'cocco': ['coconut'], 'noci': ['walnut'], 'mandorle': ['almond'], 'arachidi': ['peanut'],
 'castagne': ['chestnut'],
 'petto': ['chicken'], 'pollointero': ['chicken'], 'bistecca': ['beef'], 'macinato': ['beef'], 'salsiccia': ['pork_sausage'],
 'pancetta': ['bacon'], 'prosciutto': ['ham'], 'maiale': ['pork'], 'tacchino': ['turkey'], 'agnello': ['lamb'],
 'coniglio': ['rabbit'], 'pesce': ['fish'], 'salmone': ['salmon'], 'tonno': ['tuna'], 'gamberi': ['shrimp'],
 'calamari': ['squid'], 'polpo': ['octopus'], 'cozze': ['mussel', 'clam'], 'granchio': ['crab'], 'aragosta': ['lobster'],
 'ostriche': ['oyster'],
 'latte': ['milk'], 'yogurt': ['yogurt'], 'uova': ['egg'], 'formaggio': ['cheese'], 'parmigiano': ['parmesan_cheese'],
 'mozzarella': ['mozzarella_cheese'], 'ricotta': ['cottage_cheese'], 'burro': ['butter'], 'panna': ['cream'], 'tofu': ['soybean'],
 'riso': ['rice'], 'pane': ['bread', 'wheat_bread'], 'farina': ['wheat'], 'ceci': ['chickpea'], 'legumi': ['kidney_bean', 'navy_bean', 'red_bean'],
 'aceto': ['vinegar'], 'miele': ['honey'], 'cioccolato': ['cocoa'], 'caffe': ['coffee'], 'te': ['black_tea', 'tea'],
 'vino': ['wine', 'white_wine', 'red_wine'], 'birra': ['beer'], 'soia': ['soy_sauce'], 'senape': ['mustard'],
 'spezie:cannella': ['cinnamon'], 'spezie:noce moscata': ['nutmeg'], 'spezie:chiodi di garofano': ['clove'],
 'spezie:vaniglia': ['vanilla'], 'spezie:zafferano': ['saffron'], 'spezie:cumino': ['cumin'], 'spezie:curcuma': ['turmeric'],
 'spezie:paprika': ['paprika'], 'spezie:cardamomo': ['cardamom'], 'spezie:anice': ['anise', 'star_anise'],
 'spezie:ginepro': ['juniper_berry'], 'spezie:curry': ['curry'], 'pepe': ['black_pepper'],
 'erbe:basilico': ['basil'], 'erbe:prezzemolo': ['parsley'], 'erbe:rosmarino': ['rosemary'], 'erbe:timo': ['thyme'],
 'erbe:salvia': ['sage'], 'erbe:origano': ['oregano'], 'erbe:menta': ['mint', 'peppermint'], 'erbe:alloro': ['bay'],
 'erbe:maggiorana': ['marjoram'], 'erbe:aneto': ['dill'], 'erbe:dragoncello': ['tarragon'], 'erbe:coriandolo': ['coriander', 'cilantro'],
 'erbe:erba cipollina': ['chive'],
}
names = {}
for line in open(os.path.join(D, 'ingr_info.tsv')):
    if line.startswith('#'): continue
    i, n, _ = line.rstrip('\n').split('\t')
    names[n] = int(i)
comp = collections.defaultdict(set)
for line in open(os.path.join(D, 'ingr_comp.tsv')):
    if line.startswith('#'): continue
    a, b = line.split()
    comp[int(a)].add(int(b))
keys = {}
missing = []
for k, lst in MAP.items():
    s = set()
    for n in lst:
        if n in names: s |= comp[names[n]]
        else: missing.append(n)
    if len(s) >= 5: keys[k] = s
print('non trovati:', missing, file=sys.stderr)
# nome del Flavor Network -> chiave dell'app (anche varianti: bartlett_pear -> pera, white_wine -> vino)
rev = {}
for k, lst in MAP.items():
    for n in lst: rev.setdefault(n, k)
def to_app(n):
    if n in rev: return rev[n]
    for base, k in rev.items():
        if n.endswith('_' + base) or n.startswith(base + '_'): return k
    return None
# 1) "spina dorsale" della rete: gli abbinamenti statisticamente significativi (backbone.csv)
back = collections.defaultdict(dict)
bpath = os.path.join(D, 'backbone.csv')
if os.path.exists(bpath):
    for line in open(bpath):
        parts = line.strip().split(',')
        if len(parts) < 3 or parts[0] == '0': continue
        a, b, n = to_app(parts[0]), to_app(parts[1]), int(parts[2])
        if not a or not b or a == b or a not in keys or b not in keys: continue
        for x, y in ((a, b), (b, a)):
            back[x][y] = max(back[x].get(y, 0), n)
out = {}
def same(a, b):
    ga, gb = a.split(':')[0], b.split(':')[0]
    if ga == gb and ':' not in a + b: return True
    if {ga, gb} <= {'petto', 'pollointero'} or {ga, gb} <= {'bistecca', 'macinato'}: return True
    return False
for a, sa in keys.items():
    picked = sorted(((n, b) for b, n in back[a].items() if not same(a, b)), reverse=True)
    res = [[b, n] for n, b in picked[:12]]
    # 2) se la spina dorsale ne dà pochi, completo con le molecole in comune normalizzate
    if len(res) < 8:
        have = {b for b, _ in res}
        sc = []
        for b, sb in keys.items():
            if b == a or b in have or same(a, b): continue
            sh = len(sa & sb)
            if sh < 3: continue
            sc.append((sh / math.sqrt(len(sa) * len(sb)), sh, b))
        sc.sort(reverse=True)
        res += [[b, n] for _, n, b in sc[: 8 - len(res)]]
    out[a] = res
src = os.path.join(os.path.dirname(__file__), '..', 'src', 'flavor-data.js')
with open(src, 'w') as f:
    f.write('// Generato da tools/build-flavor.py. Fonte: Ahn Y.-Y. et al., "Flavor network and the principles of food pairing",\n')
    f.write('// Scientific Reports 1:196 (2011), dati supplementari. Per ogni ingrediente: [abbinamento, molecole aromatiche in comune].\n')
    f.write('export const FLAVOR = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'ingredienti', os.path.getsize(src), 'byte', file=sys.stderr)
print('mela ->', out.get('mela'), file=sys.stderr)
print('pomodoro ->', out.get('pomodoro'), file=sys.stderr)
print('spezie:cannella ->', out.get('spezie:cannella'), file=sys.stderr)
print('salmone ->', out.get('salmone'), file=sys.stderr)
print('erbe:basilico ->', out.get('erbe:basilico'), file=sys.stderr)
