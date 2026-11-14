#!/usr/bin/env python3
"""Rigenera src/ciqual-data.js dalla tabella Ciqual (ANSES, open data, Licence Ouverte).

Uso: python3 tools/build-ciqual.py percorso/CIQUAL2025_FR_2025_11_03.csv
Il CSV si scarica da https://ciqual.anses.fr/ (o dal repository di Open Food Facts: external-data/ciqual/ciqual/).
MAP collega ogni cibo del catalogo (src/catalog.js) al codice Ciqual più adatto, scelto a mano (di solito il prodotto crudo).
"""
import csv, json, os, sys

MAP = dict(
    pomodoro=20276, insalata=20031, spinaci=20059, rucola=20217, carota=20009, patata=4008, patatadolce=4101, cipolla=20034, aglio=11000, zucchina=20020,
    melanzana=20053, peperone=20041, peperoncino=20151, cetriolo=20019, broccoli=20057, cavolfiore=20016, finocchio=20028, funghi=20056, mais=20066,
    avocado=13004, sedano=20023, porro=20039, asparagi=20279, carciofo=20052, radicchio=20162, fagiolini=20061, piselli=20084, zucca=20044, barbabietola=20091,
    zenzero=11074, erbe=11033, olive=13033, verduresurgelate=20101, mela=13039, melaverde=13122, pera=13037, banana=13005, arancia=13034, limone=13009,
    fragola=13014, ciliegia=13008, uva=13395, pesca=13043, prugna=13100, fico=13012, kiwi=13021, ananas=13002, mango=13025, melone=13026, anguria=13036,
    mirtilli=13028, cocco=15006, noci=15005, mandorle=15000, arachidi=15002, castagne=15024, petto=36017, cosce=36002, alette=36023, pollointero=36016,
    bistecca=6201, macinato=6254, hamburger=6254, salsiccia=30110, wurstel=30134, pancetta=28502, prosciutto=28900, salame=30300, maiale=28100, tacchino=36304,
    cotoletta=36036, costata=6103, agnello=21502, coniglio=34001, spiedini=25506, kebab=25428, pesce=26043, salmone=26036, tonno=26039, gamberi=10021, calamari=10001,
    polpo=10018, cozze=10014, granchio=26046, bastoncini=26029, sushi=25456, pescefritto=10002, aragosta=10010, ostriche=10035, latte=19041, lattevegetale=18900,
    yogurt=19593, uova=22000, formaggio=12115, parmigiano=12120, mozzarella=19590, ricotta=19585, burro=16400, panna=19410, tofu=20904, budino=39230,
    pasta=9810, spaghetti=9810, riso=9100, pane=7001, baguette=7001, piadina=7815, gnocchi=26264, ravioli=25149, pizza=25516, cracker=7300, grissini=7525,
    gallette=7352, farina=9436, cereali=32014, noodles=9863, croissant=7619, sandwich=25521, pancake=23799, passata=20260, pelati=20137, legumi=20524, ceci=20532,
    olio=17270, aceto=11091, sale=11017, pepe=11015, zucchero=31016, spezie=11035, dado=11041, brodo=25948, pesto=11179, sugo=11114, maionese=11054, ketchup=11008,
    senape=11013, soia=11104, miele=31008, marmellata=31024, cremanocciola=31032, te=18020, biscotti=24015, cioccolato=31005, merendine=23935, patatine=4004,
    patatinefritte=4030, popcorn=9230, gelato=39515, ghiaccioli=31013, torta=23585, crostata=23495, ciambella=23880, muffin=23952, caramelle=31060, acqua=18044,
    succo=2070, bibita=18018, birra=5001, vino=5214, spumante=5201, liquore=1005, zuppa=25903, insalatapronta=25670, piattopronto=25081, asporto=25088,
    hummus=25621, falafel=25590, pizzasurgelata=25404,
)


def num(s):
    s = s.strip().replace(',', '.')
    if s in ('', '-'):
        return None
    if s.startswith('<') or s.lower().startswith('traces'):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def main(path):
    rows = list(csv.reader(open(path, encoding='utf-8'), delimiter='\t'))
    h = [c.replace('\n', ' ').lower() for c in rows[0]]
    col = {}
    for i, c in enumerate(h):
        if c.startswith('alim_code'): col['code'] = i
        elif c.startswith('alim_nom_fr'): col['nom'] = i
        elif 'energie, règlement' in c and 'kcal' in c: col['kcal'] = i
        elif c.startswith('protéines, n x facteur'): col['p'] = i
        elif c.startswith('glucides'): col['c'] = i
        elif c.startswith('lipides'): col['f'] = i
    data = {r[col['code']]: r for r in rows[1:] if len(r) > max(col.values())}
    out = {}
    for key, code in MAP.items():
        r = data[str(code)]
        out[key] = {k: (None if num(r[col[k]]) is None else round(num(r[col[k]]), 1)) for k in ('kcal', 'p', 'c', 'f')}
        out[key].update(n=r[col['nom']], id=code)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, 'src', 'ciqual-data.js'), 'w', encoding='utf-8') as f:
        f.write('// Valori medi per 100 g dalla tabella ufficiale Ciqual 2025 (ANSES, Francia), open data - Licence Ouverte Etalab.\n')
        f.write('// "Anses. 2025. Ciqual French food composition table." https://ciqual.anses.fr/\n')
        f.write('// Usati per i cibi senza etichetta (frutta, verdura, carne e pesce sfusi). File generato da tools/build-ciqual.py.\n')
        f.write('export const CIQUAL = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n')
    print(len(out), 'cibi')


if __name__ == '__main__':
    main(sys.argv[1])
