// Ricette da Mela: lettura dei file esportati (.melarecipe = JSON, .melarecipes = zip di JSON)
// e confronto degli ingredienti con la dispensa.
import { BY_KEY, matchFood, norm, FARINA_HEAD } from '../catalog.js';
import { itName } from './en2it.js';

// cose che quasi sempre hai in casa: non contano come "mancanti"
export const BASICS = new Set(['sale', 'pepe', 'olio', 'acqua', 'aceto', 'spezie']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// link per aprire la ricetta nell'app Mela (solo per le ricette con un id interno di Mela)
export const melaLink = (r) => (r.melaId && UUID.test(r.melaId) ? `mela://recipe/${r.melaId}` : '');

const lines = (v) =>
  String(Array.isArray(v) ? v.join('\n') : v || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

// foto ridotta a miniatura (le originali sono troppo grandi per il database)
function thumb(b64) {
  return new Promise((resolve) => {
    if (!b64 || typeof b64 !== 'string') return resolve('');
    const src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    const img = new Image();
    img.onload = () => {
      const max = 240;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

const idOf = (raw) => {
  const melaId = String(raw.id || '');
  return UUID.test(melaId) ? melaId : 'r' + hash(melaId || String(raw.title || ''));
};

async function normalize(raw, by) {
  if (!raw || typeof raw !== 'object' || !raw.title) return null;
  const melaId = String(raw.id || '');
  const id = idOf(raw);
  const ingredients = lines(raw.ingredients).slice(0, 80).map((l) => l.slice(0, 200));
  const images = Array.isArray(raw.images) ? raw.images : [];
  return {
    id,
    melaId,
    title: String(raw.title).trim().slice(0, 150),
    text: String(raw.text || '').trim().slice(0, 2000),
    ingredients,
    // cibo riconosciuto per ogni riga ('#' = titoletto, '' = non riconosciuto): calcolato una volta sola qui
    foods: ingredients.map((l) => (/^#/.test(l) ? '#' : matchFood(l.replace(/^[-•*]\s*/, ''))?.key || '')),
    instructions: String(raw.instructions || '').trim().slice(0, 15000),
    notes: String(raw.notes || '').trim().slice(0, 4000),
    yield: String(raw.yield || '').trim().slice(0, 60),
    prepTime: String(raw.prepTime || '').trim().slice(0, 40),
    cookTime: String(raw.cookTime || '').trim().slice(0, 40),
    totalTime: String(raw.totalTime || '').trim().slice(0, 40),
    categories: (Array.isArray(raw.categories) ? raw.categories : []).map((c) => String(c).trim()).filter(Boolean).slice(0, 10),
    link: /^https?:\/\//i.test(raw.link || '') ? String(raw.link).slice(0, 500) : '',
    img: await thumb(images[0]),
    by: by || '',
    importedAt: Date.now(),
  };
}

// Ricetta letta da un sito (api/ricetta o Gemini) → stesso formato delle ricette di Mela.
// Il libro è il nome del sito, così si ritrovano tutte insieme.
export async function fromWeb(d, by) {
  return normalize(
    {
      id: d.link,
      title: d.title,
      text: d.text,
      ingredients: d.ingredients,
      instructions: d.instructions,
      yield: d.yield,
      prepTime: d.prepTime,
      cookTime: d.cookTime,
      totalTime: d.totalTime,
      categories: [d.site].filter(Boolean),
      link: d.link,
      images: d.imageData ? [d.imageData] : [],
    },
    by
  );
}
export const webId = (link) => idOf({ id: link });

const isZip = (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const CHUNK = 4 * 1024 * 1024; // leggo il file a pezzi da 4 MB: un export con tante foto può pesare giga
const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const ioError = (e) =>
  Object.assign(new Error("Il telefono non riesce a leggere il file. Se è su iCloud, aprilo prima in File per scaricarlo sul telefono (o salvalo in \"Sul mio iPhone\"), poi riprova. Se è enorme, esporta da Mela un libro alla volta."), { cause: e });
const readSlice = async (f, from, to) => {
  try {
    return new Uint8Array(await f.slice(from, to).arrayBuffer());
  } catch (e) {
    throw ioError(e);
  }
};

// Legge i file scelti a pezzi, una ricetta alla volta, senza mai tenere in memoria l'export intero.
// onBatch(ricette) viene chiamata ogni ~50 ricette (per salvarle man mano); onStep(n) per il contatore.
export async function readMelaFiles(files, by, { onBatch, onStep, photos = true, skip = null } = {}) {
  const dec = new TextDecoder();
  let batch = [];
  let total = 0;
  let bad = 0;
  let skipped = 0;
  let seen = 0;
  const handle = async (bytes) => {
    let raw;
    try {
      raw = JSON.parse(dec.decode(bytes));
    } catch {
      bad++;
      return;
    }
    for (const r of Array.isArray(raw) ? raw : [raw]) {
      if (!r || typeof r !== 'object' || !r.title) continue;
      seen++;
      if (skip && skip.has(idOf(r))) {
        skipped++;
        if (seen % 25 === 0) onStep?.(seen, skipped);
        continue;
      }
      if (!photos) r.images = [];
      const n = await normalize(r, by);
      if (!n) continue;
      batch.push(n);
      total++;
      onStep?.(seen, skipped);
      if (batch.length >= 50) {
        const b = batch;
        batch = [];
        await onBatch?.(b);
      }
    }
  };

  for (const f of files) {
    const head = await readSlice(f, 0, 4);
    if (!isZip(head)) {
      // un solo .melarecipe (JSON)
      await handle(await readSlice(f, 0, f.size));
      continue;
    }
    const { Unzip, UnzipInflate } = await import('fflate');
    const ready = [];
    let zipErr = null;
    const uz = new Unzip();
    uz.register(UnzipInflate);
    uz.onfile = (entry) => {
      if (entry.name.startsWith('__MACOSX') || !/\.(melarecipe|json)$/i.test(entry.name)) return; // non letto: saltato
      const parts = [];
      entry.ondata = (err, dat, final) => {
        if (err) {
          zipErr = err;
          return;
        }
        if (dat && dat.length) parts.push(dat);
        if (final) ready.push(concat(parts));
      };
      entry.start();
    };
    for (let o = 0; o < f.size; o += CHUNK) {
      const piece = await readSlice(f, o, Math.min(f.size, o + CHUNK));
      uz.push(piece, o + CHUNK >= f.size);
      if (zipErr) throw new Error('Il file di Mela sembra rovinato: prova a esportarlo di nuovo.');
      while (ready.length) await handle(ready.shift());
    }
  }
  if (batch.length) await onBatch?.(batch);
  return { total, bad, skipped, seen };
}

// Tipi diversi dello stesso cibo: "farina di segale" non è la farina normale che hai in casa.
// Se la riga nomina un tipo, serve un cibo in dispensa con quel tipo nel nome; se non lo nomina,
// non vale un cibo di un tipo speciale (la farina di riso non sostituisce la farina 00).
const VARIANTS = {
  farina: ['segale', 'orzo', 'avena', 'riso', 'mais', 'farro', 'ceci', 'castagn', 'mandorl', 'cocco', 'saraceno', 'integral', 'manitoba', 'semol', 'kamut', 'tapioca', 'patat', 'lenticch', 'nocciol', 'quinoa', 'amaranto', 'miglio', 'fecola', 'maizena', 'amido', 'duro', 'piselli', 'pistacch', 'carrub', 'canapa', 'teff', 'sorgo'],
  latte: ['soia', 'avena', 'riso', 'mandorl', 'cocco', 'condensat', 'polvere', 'capra', 'pecora', 'nocciol'],
  zucchero: ['canna', 'velo', 'muscovado', 'grezzo', 'cocco'],
  spezie: ['anice', 'cannella', 'curcuma', 'moscata', 'paprika', 'cumino', 'curry', 'zafferano', 'garofano', 'vaniglia', 'cardamomo', 'ginepro', 'macis', 'pimento', 'sumac', 'masala', 'hanout', 'fieno greco', 'coriandolo', 'carvi', 'senape', 'liquirizia', 'tonka', 'affumicat'],
  erbe: ['basilic', 'prezzemol', 'timo', 'rosmarin', 'salvia', 'origano', 'menta', 'mentuccia', 'maggiorana', 'alloro', 'cipollina', 'aneto', 'dragoncello', 'coriandol', 'finocchiett', 'cerfoglio', 'nepitella', 'santoreggia', 'melissa', 'citronella', 'lemongrass', 'shiso'],
  dado: ['birra', 'dolci', 'madre', 'alimentare', 'bicarbonato'],
  riso: ['venere', 'nero', 'rosso', 'basmati', 'jasmine', 'integral', 'selvaggio', 'glutinoso', 'sushi'],
};
const variantsIn = (key, text) => (VARIANTS[key] || []).filter((v) => text.includes(v));
// per questi, una riga generica ("erbe aromatiche") va bene con qualunque tipo
const GENERIC_ANY = new Set(['erbe', 'spezie', 'dado']);

// Ingredienti che non sono nel catalogo (anguilla, tahina...): li cerco per nome nella dispensa
const STOP = new Set('circa pronta pronto cottura fresco fresca freschi fresche grande grandi piccolo piccola piccoli medio media medie tritato tritata tritati grattugiato grattugiata pulito pulita puliti tagliato tagliata foglie foglia rametti rametto spicchi spicchio cucchiai cucchiaio cucchiaini cucchiaino bicchiere bicchieri tazza tazze pizzico pizzichi mazzetto mazzetti qualche alcune alcuni litro litri grammi quanto basta della delle dello degli dalla nella sulla oppure altro altra intero intera interi tipo pezzo pezzi fetta fette scatola barattolo confezione vasetto ciuffo manciata busta'.split(' '));
// stessa parola, anche al plurale (mela/mele, uovo/uova)
const stem = (w) => w.replace(/[aeiou]$/, '');
const sameWord = (a, b) => a === b || (stem(a).length >= 4 && stem(a) === stem(b));
export const ingredientWords = (line) => norm(line).replace(/[^a-z ]/g, ' ').split(' ').filter((w) => w.length > 3 && !STOP.has(w));
// "1 anguilla di 1 kg pronta per la cottura" → "anguilla"
export const cleanIngredient = (line) =>
  line
    .replace(/^[\d\s.,/½¼¾-]+(kg|g|gr|ml|cl|dl|l|lt|cucchia\w*|bicchier\w*|tazz\w*|pizzic\w*|spicch\w*|ramett\w*|foglie|fette|pezz\w*|confezion\w*|scatol\w*|vasett\w*|mazzett\w*|bustin\w*|manciat\w*)?\.?\s+(di\s+|d['’]\s*)?/i, '')
    .replace(/\s+(di|da)\s+\d.*$/i, '')
    .replace(/\s+q\.?\s*b\.?.*$/i, '')
    .replace(/,.*$/, '')
    .trim()
    .slice(0, 50);

// ---- tipo preciso dentro un gruppo del catalogo ----
// Il catalogo raggruppa (Pesce = nasello, orata, merluzzo...; Formaggio = pecorino, brie...).
// Se la ricetta chiede un tipo preciso (nasello), serve in dispensa un cibo con quel nome;
// se chiede il gruppo in generale ("pesce", "formaggio"), va bene qualunque cibo del gruppo.
const kstem = (w) => (w.length > 4 ? w.replace(/[aeio]$/, '') : w);
const hasKw = (t, kw) => t.includes(' ' + kw + ' ') || (kw.length >= 4 && t.includes(' ' + kstem(kw)));
const genericCache = new Map();
function genericKws(food) {
  let g = genericCache.get(food.key);
  if (!g) {
    const base = [food.kws[0], food.kws[1]].filter(Boolean);
    const stems = new Set(base.flatMap((b) => [kstem(b), ...b.split(' ').filter((w) => w.length > 2 && !['di', 'del', 'della', 'con'].includes(w)).map(kstem)]));
    g = new Set([...base, ...food.kws.filter((k) => stems.has(kstem(k)))]);
    genericCache.set(food.key, g);
  }
  return g;
}
// parole che descrivono la forma, non il tipo: "filetti di pesce" resta pesce in generale
const FORM = new Set('filetti filetto tranci trancio fette fetta fettine polpa pezzi pezzo cubetti dadini bocconcini cuori di del della dello dei degli delle d grattugiato grattugiata grattugiati fresco fresca freschi fresche secco secca secchi intero intera interi macinato macinata tritato tritata a'.split(' '));
function isGeneric(food, kw) {
  if (!kw) return true;
  const g = genericKws(food);
  if (g.has(kw)) return true;
  const gs = new Set([...g].map(kstem));
  return kw.split(' ').every((w) => FORM.has(w) || gs.has(kstem(w)));
}

// il cibo della dispensa è di quel tipo? ("latte di cocco" = "coconut milk cocco latte")
function kindIn(name, kw) {
  const t = ' ' + name + ' ';
  const ws = kw.split(' ').filter((w) => w.length > 2 && !FORM.has(w));
  return ws.length ? ws.every((w) => hasKw(t, w)) : hasKw(t, kw);
}

// la parola del gruppo che compare nella riga (la più lunga/specifica)
function kwIn(food, text) {
  const t = ' ' + norm(text) + ' ';
  let best = '';
  for (const kw of food.kws) if (kw.length > best.length && hasKw(t, kw)) best = kw;
  return best;
}

// Un ingrediente di Mela ("# Per il sugo" è un titoletto) → cibo del catalogo
export function parseIngredient(line, key) {
  if (key === '#' || /^#/.test(line)) return { line: line.replace(/^#+\s*/, ''), header: true };
  const clean = line.replace(/^[-•*]\s*/, '');
  // chiave salvata all'import; se allora non era riconosciuto riprovo (il catalogo nel frattempo può essere cresciuto)
  let food = (key ? BY_KEY[key] : null) || matchFood(clean) || null;
  // "aceto di vino" è aceto, non vino
  if (/\baceto\b/i.test(clean) && BY_KEY.aceto) food = BY_KEY.aceto;
  // anche per le ricette importate prima: "farina di mandorle" è farina, "latte di cocco" è latte vegetale
  const cn = ' ' + norm(clean);
  if (FARINA_HEAD.test(norm(clean)) && BY_KEY.farina) food = BY_KEY.farina;
  else if (/\blatte (di|d) (cocco|soia|avena|mandorl\w*|riso|nocciol\w*)/.test(cn) && BY_KEY.lattevegetale) food = BY_KEY.lattevegetale;
  // carta forno, pellicola, stuzzicadenti...: attrezzi, non ingredienti da comprare
  if (food && food.cat === 'casa') return { line: clean, food: null, basic: false, variant: [], junk: true, kw: '', generic: true };
  const junk = (clean.match(/[a-zà-ú]/gi) || []).length < 3; // righe tipo "1" rimaste dall'export
  const variant = food ? variantsIn(food.key, norm(clean)) : [];
  const kw = food ? kwIn(food, clean) : '';
  // le spezie in generale le hai, ma l'anice o lo zafferano vanno comprati apposta
  const basic = !!(food && BASICS.has(food.key) && !(food.key === 'spezie' && variant.length));
  let generic = !food || isGeneric(food, kw);
  // dado, lievito e bicarbonato stanno nello stesso gruppo ma non si sostituiscono
  if (food && food.key === 'dado' && kw) generic = false;
  let cuts = null;
  let animals = null;
  if (food && MEATY.has(food.cat)) {
    // per carne e pesce decidono il taglio e l'animale, non la parola del catalogo
    cuts = cutsIn(clean);
    animals = animalsIn(clean);
    if (cutsIn(kw).length || animalsIn(kw).length) generic = true;
  }
  return { line: clean, food: food || null, basic, variant, junk, kw, generic, cuts, animals };
}

// righe già analizzate, per non rifare il riconoscimento a ogni aggiornamento (con migliaia di ricette conta)
const rowsCache = new Map();
function rowsOf(recipe) {
  const k = `${recipe.id}|${recipe.importedAt || 0}`;
  let rows = rowsCache.get(k);
  if (!rows) {
    const ing = recipe.ingredients || [];
    const f = Array.isArray(recipe.foods) && recipe.foods.length === ing.length ? recipe.foods : null;
    rows = ing.map((l, i) => parseIngredient(l, f ? f[i] : undefined));
    rowsCache.set(k, rows);
  }
  return rows;
}

// Prodotti "al gusto di": una salsa ai granchi non è granchio, le patatine al formaggio non sono formaggio.
// Valgono solo se anche la riga della ricetta nomina lo stesso tipo di prodotto.
const DERIVED = ['salsa', 'salse', 'sugo', 'sughi', 'sughetto', 'condimento', 'dado', 'brodo', 'aroma', 'aromi', 'gusto', 'sapore', 'insaporitore', 'patatine', 'snack', 'cracker', 'tisana', 'infuso', 'caramelle', 'budino', 'merendina', 'barretta', 'bevanda', 'liquore', 'sciroppo', 'crema'];
const derivedOf = (text) => DERIVED.filter((d) => new RegExp(`\\b${d}\\b`).test(text));
function fits(it, lineNorm) {
  const d = derivedOf(itName(it.name));
  return !d.length || d.some((x) => lineNorm.includes(x));
}

// ---- tagli e parti (carne e pesce) ----
// "Fegato di maiale" non si fa con la rosticciana: se la riga nomina un taglio, serve quel taglio.
// Le frattaglie e le parti particolari (fegato, piedini, trippa...) non valgono mai per una ricetta
// che chiede l'animale in generale; un pezzo qualunque (bistecca, lonza) sì.
const CUTS = [
  // [nome, speciale, parole (inizio parola)]
  ['fegato', 1, 'fegat|fegatin|fegatell'],
  ['piedini', 1, 'piedin|piedi|zampett|zampin|peduccio|peducci'],
  ['trippa', 1, 'trippa|trippe|centopelle|lampredott|abomaso'],
  ['lingua', 1, 'lingua|lingue'],
  ['cuore', 1, 'cuore'],
  ['rognone', 1, 'rognon|reni\\b|rene\\b'],
  ['cervello', 1, 'cervell'],
  ['animelle', 1, 'animell'],
  ['coda', 1, 'coda\\b|code\\b'],
  ['orecchie', 1, 'orecchi'],
  ['testina', 1, 'testina|testa\\b|teste\\b|muso\\b'],
  ['cotenna', 1, 'cotenn|cotich'],
  ['polmone', 1, 'polmon|coratella|corata'],
  ['milza', 1, 'milza'],
  ['frattaglie', 1, 'frattagli|interiora|ventrigl|durell|rigaglie'],
  ['midollo', 1, 'midollo|ossa|osso buco'],
  ['sangue', 1, 'sangue'],
  ['costine', 0, 'rosticcian|costin|costolett|costole|puntine|puntina|spuntatur|ribs|spare ribs'],
  ['lonza', 0, 'lonza|lonzino|arista|lombo|lombat|carre|carree|schiena'],
  ['braciola', 0, 'braciol|nodin'],
  ['filetto', 0, 'filett|medaglion|tenderloin'],
  ['spalla', 0, 'spalla|spalle|capocollo'],
  ['pancia', 0, 'pancia|ventresca|panciot'],
  ['coscia', 0, 'coscia|cosce|cosciott|fusi\\b|fuselli|sovracosc'],
  ['stinco', 0, 'stinc|ossobuc|garretto|muscolo'],
  ['guancia', 0, 'guancia(?!l)|guance|guancett'],
  ['petto', 0, 'petto|petti'],
  ['ali', 0, 'ali\\b|alette|aletta'],
  ['bistecca', 0, 'bistecc|tagliata|costata|fiorentina|entrecote|controfilett|scamone'],
  ['fettine', 0, 'fettin|scaloppin|sottofesa|fesa|magatello|noce\\b|carpaccio|paillard'],
  ['spezzatino', 0, 'spezzatin|gulasch|goulash'],
  ['arrosto', 0, 'arrost|roast|girello|cappello del prete'],
  ['bollito', 0, 'bollit|lesso|brasat|biancostato|reale\\b|punta di petto'],
].map(([k, sp, w]) => ({ k, sp: !!sp, re: new RegExp(`(^| )(${w})`) }));
const MEATY = new Set(['carne', 'pesce']);
// l'animale: "fegato di vitello" non è "fegato di maiale"
const ANIMALS = [
  ['manzo', 'manzo|bovin|beef|scottona|vitellone|bue\\b|manzett'],
  ['vitello', 'vitell|veal'],
  ['maiale', 'maial|suin|porc|pork|maialin'],
  ['pollo', 'poll|gallin|gallett|chicken'],
  ['tacchino', 'tacchin|turkey'],
  ['agnello', 'agnell|abbacchio|capretto|montone|pecora'],
  ['coniglio', 'conigli'],
  ['anatra', 'anatra|anatre|anitra|germano'],
  ['oca', 'oca\\b|oche\\b'],
  ['cinghiale', 'cinghial'],
  ['cervo', 'cervo|capriolo|daino'],
  ['cavallo', 'cavall|equin|puledro'],
].map(([k, w]) => ({ k, re: new RegExp(`(^| )(${w})`) }));
const animalsIn = (text) => {
  const t = norm(text).replace(/[^a-z ]/g, ' ');
  return ANIMALS.filter((a) => a.re.test(t));
};
// i tagli nominati in un testo
export function cutsIn(text) {
  const t = norm(text).replace(/[^a-z ]/g, ' ');
  return CUTS.filter((c) => c.re.test(t));
}
// un cibo della dispensa va bene per una riga che chiede questi tagli?
function cutFits(lineCuts, it, lineAnimals = []) {
  const an = animalsIn(itName(it.name));
  if (lineAnimals.length && an.length && !an.some((a) => lineAnimals.includes(a))) return false;
  const mine = cutsIn(itName(it.name));
  if (!lineCuts.length) return !mine.some((c) => c.sp); // "maiale": tutto tranne frattaglie e parti particolari
  if (mine.some((c) => lineCuts.includes(c))) return true; // stesso taglio
  // il cibo non dice il taglio ("Maiale"): va bene solo per i tagli normali
  return !mine.length && !lineCuts.some((c) => c.sp);
}

// La dispensa indicizzata una volta per tutte le ricette
export function pantryIndex(items, soonIds = new Set()) {
  const byFood = new Map();
  for (const it of items) {
    let key = it.food;
    // salvato senza cibo del catalogo (magari in inglese): provo a riconoscerlo dal nome
    if (!key || key === 'altro') {
      const f = matchFood(it.name || '') || matchFood(itName(it.name));
      if (!f || f.cat === 'casa') continue;
      key = f.key;
    }
    if (!byFood.has(key)) byFood.set(key, []);
    byFood.get(key).push(it);
  }
  // per nome cerco solo tra i cibi fuori catalogo: "Tisana zenzero" (che è un tè) non è zenzero
  const names = items.filter((it) => !it.food || it.food === 'altro').map((it) => ({ it, n: itName(it.name), w: itName(it.name).replace(/[^a-z ]/g, ' ').split(' ').filter((x) => x.length > 3) }));
  return { byFood, names, soonIds, byName: new Map(), byVariant: new Map(), byKind: new Map(), byCut: new Map() };
}

// Confronto con la dispensa: cosa hai, cosa manca, quali cibi in scadenza usa
export function checkRecipe(recipe, idx) {
  const rows = rowsOf(recipe).map((r) => ({ ...r }));
  let have = 0;
  let need = 0;
  const missing = [];
  const usesSoon = [];
  for (const r of rows) {
    if (r.header || r.junk) continue;
    if (!r.food) {
      // non nel catalogo: ce l'hai se un cibo della dispensa ha una parola importante in comune
      const words = ingredientWords(r.line);
      const ln = norm(r.line);
      r.items = words.length ? idx.names.filter((x) => words.some((w) => x.w.some((n) => sameWord(n, w)))).map((x) => x.it).filter((it) => fits(it, ln)) : [];
      r.have = r.items.length > 0;
      r.unknown = true;
      if (!words.length) {
        r.skip = true;
        continue;
      }
      need++;
      if (r.have) have++;
      else missing.push(r);
      continue;
    }
    const ln = norm(r.line);
    let found = idx.byFood.get(r.food.key) || [];
    if (VARIANTS[r.food.key] && found.length) {
      const k = `${r.food.key}|${r.variant.join(',')}`;
      if (!idx.byVariant.has(k)) {
        idx.byVariant.set(
          k,
          found.filter((it) => {
            const has = variantsIn(r.food.key, itName(it.name));
            return r.variant.length ? r.variant.some((v) => has.includes(v)) : GENERIC_ANY.has(r.food.key) || !has.length;
          })
        );
      }
      found = idx.byVariant.get(k);
    }
    if (!r.generic && found.length) {
      // tipo preciso: il nome del cibo in dispensa deve contenerlo (nasello ≠ orata)
      const k = `${r.food.key}#${r.kw}`;
      if (!idx.byKind.has(k)) idx.byKind.set(k, found.filter((it) => kindIn(itName(it.name), r.kw)));
      found = idx.byKind.get(k);
    }
    if (r.cuts && found.length) {
      // taglio preciso: fegato ≠ rosticciana, spezzatino ≠ bistecca
      const k = `${r.food.key}@${r.cuts.map((c) => c.k).join(',')}@${r.animals.map((a) => a.k).join(',')}`;
      if (!idx.byCut.has(k)) idx.byCut.set(k, found.filter((it) => cutFits(r.cuts, it, r.animals)));
      found = idx.byCut.get(k);
    }
    found = found.filter((it) => fits(it, ln));
    if (!found.length && !VARIANTS[r.food.key]) {
      // per i cibi fuori catalogo: nome uguale
      const w = norm(r.food.name).split(' ')[0];
      if (!idx.byName.has(w)) idx.byName.set(w, idx.names.filter((x) => w.length > 3 && x.w.some((n) => sameWord(n, w))).map((x) => x.it));
      found = idx.byName.get(w).filter((it) => fits(it, ln) && (!r.cuts || cutFits(r.cuts, it, r.animals)));
    }
    r.have = found.length > 0;
    r.items = found;
    if (r.basic) continue;
    need++;
    if (r.have) {
      have++;
      const soon = found.find((it) => idx.soonIds.has(it.id));
      if (soon && !usesSoon.includes(soon)) usesSoon.push(soon);
    } else missing.push(r);
  }
  return { rows, have, need, missing, usesSoon, ratio: need ? have / need : 0 };
}

// ---- porzioni: "4 persone" → 4, e ingredienti moltiplicati ----
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
export function servingsOf(y) {
  const m = String(y || '').match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return n > 0 && n <= 50 ? n : 0;
}
const toN = (s) => {
  s = s.trim();
  if (FRAC[s]) return FRAC[s];
  const f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const mixed = s.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (mixed) return Number(mixed[1]) + FRAC[mixed[2]];
  return parseFloat(s.replace(',', '.'));
};
function fmtQty(n, unit) {
  const u = (unit || '').toLowerCase();
  let v;
  if (/^(g|gr|ml)$/.test(u)) v = n >= 50 ? Math.round(n / 5) * 5 : Math.round(n);
  else if (n >= 10) v = Math.round(n);
  else v = Math.round(n * 4) / 4; // quarti: 0,25 0,5 0,75
  if (v === 0) v = Math.round(n * 100) / 100 || n;
  return String(Math.round(v * 100) / 100).replace('.', ',');
}
const NUM = '(\\d+\\s*[½¼¾⅓⅔]|\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔])';
const UNIT = '(kg|g|gr|ml|cl|dl|l|lt)\\b';
// moltiplica la quantità della riga (quella in testa, oppure la prima con un'unità di misura)
export function scaleLine(line, k) {
  if (!k || Math.abs(k - 1) < 1e-9) return { text: line, changed: false };
  const head = line.match(new RegExp(`^(\\s*[-•*]?\\s*)${NUM}(\\s*[-–]\\s*${NUM})?(\\s*${UNIT})?`, 'i'));
  if (head) {
    const unit = head[6] || '';
    const a = fmtQty(toN(head[2]) * k, unit);
    const b = head[4] ? '-' + fmtQty(toN(head[4]) * k, unit) : '';
    return { text: head[1] + a + b + (head[5] || '') + line.slice(head[0].length), changed: true };
  }
  const re = new RegExp(`(^|[^\\d,.])${NUM}(\\s*)${UNIT}`, 'i');
  const m = line.match(re);
  if (m) {
    const val = fmtQty(toN(m[2]) * k, m[4]);
    return { text: line.slice(0, m.index) + m[1] + val + m[3] + m[4] + line.slice(m.index + m[0].length), changed: true };
  }
  return { text: line, changed: false };
}

// ---- abbinamenti: cosa compare spesso insieme nelle TUE ricette ----
// Chiave di un ingrediente: il cibo del catalogo, più preciso se la riga nomina un tipo (spezie → cannella).
const pairKey = (food, kw, generic) => (generic || !kw ? food.key : `${food.key}:${kw}`);
export const pairLabel = (key) => {
  const [k, kw] = key.split(':');
  const f = BY_KEY[k];
  const name = kw || f?.name || k;
  return name.charAt(0).toUpperCase() + name.slice(1);
};
export const pairIcon = (key) => BY_KEY[key.split(':')[0]]?.icon || '1f4e6';
// sale, olio, acqua... stanno con tutto: non dicono niente
const NOPAIR = new Set(['sale', 'pepe', 'olio', 'acqua', 'aceto', 'brodo', 'dado', 'zucchero', 'farina', 'burro', 'uova', 'aglio', 'cipolla']);

let pairCache = { sig: '', data: null };
export function buildPairs(recipes) {
  const sig = `${recipes.length}|${recipes[0]?.id || ''}|${recipes[recipes.length - 1]?.id || ''}`;
  if (pairCache.sig === sig) return pairCache.data;
  const count = new Map();
  const co = new Map();
  for (const r of recipes) {
    const keys = new Set();
    for (const row of rowsOf(r)) {
      if (row.header || row.junk || !row.food) continue;
      keys.add(pairKey(row.food, row.kw, row.generic));
    }
    const list = [...keys];
    for (const a of list) count.set(a, (count.get(a) || 0) + 1);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = list[i] < list[j] ? [list[i], list[j]] : [list[j], list[i]];
        const k = a + '|' + b;
        co.set(k, (co.get(k) || 0) + 1);
      }
  }
  const partners = new Map();
  for (const [k, n] of co) {
    if (n < 3) continue;
    const [a, b] = k.split('|');
    // quanto stanno insieme rispetto a quanto compaiono da soli (così il prezzemolo non vince sempre)
    const score = n / Math.sqrt(count.get(a) * count.get(b));
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!partners.has(x)) partners.set(x, []);
      partners.get(x).push({ key: y, n, score });
    }
  }
  for (const l of partners.values()) l.sort((p, q) => q.score - p.score);
  pairCache = { sig, data: { partners, count, total: recipes.length } };
  return pairCache.data;
}

// Chiavi possibili per un cibo della dispensa (la più precisa prima)
export function itemPairKeys(item) {
  const f = BY_KEY[item.food];
  if (!f) return [];
  const kw = kwIn(f, item.name || '');
  const out = [];
  if (kw && !isGeneric(f, kw)) out.push(`${f.key}:${kw}`);
  out.push(f.key);
  return out;
}

// Gli abbinamenti per un cibo: i più forti, senza gli ingredienti "di base"
export function pairsFor(item, recipes, max = 10) {
  if (!recipes?.length) return [];
  const { partners } = buildPairs(recipes);
  const seen = new Set(itemPairKeys(item));
  const out = [];
  for (const key of itemPairKeys(item)) {
    for (const p of partners.get(key) || []) {
      const base = p.key.split(':')[0];
      if (seen.has(p.key) || NOPAIR.has(base)) continue;
      seen.add(p.key);
      out.push(p);
    }
    if (out.length >= max) break;
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
