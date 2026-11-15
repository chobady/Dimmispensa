// Ricette da Mela: lettura dei file esportati (.melarecipe = JSON, .melarecipes = zip di JSON)
// e confronto degli ingredienti con la dispensa.
import { BY_KEY, matchFood, norm } from '../catalog.js';

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
  riso: ['venere', 'nero', 'rosso', 'basmati', 'jasmine', 'integral', 'selvaggio', 'glutinoso', 'sushi'],
};
const variantsIn = (key, text) => (VARIANTS[key] || []).filter((v) => text.includes(v));
// per questi, una riga generica ("erbe aromatiche") va bene con qualunque tipo
const GENERIC_ANY = new Set(['erbe', 'spezie']);

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

// Un ingrediente di Mela ("# Per il sugo" è un titoletto) → cibo del catalogo
export function parseIngredient(line, key) {
  if (key === '#' || /^#/.test(line)) return { line: line.replace(/^#+\s*/, ''), header: true };
  const clean = line.replace(/^[-•*]\s*/, '');
  // chiave salvata all'import; se allora non era riconosciuto riprovo (il catalogo nel frattempo può essere cresciuto)
  let food = (key ? BY_KEY[key] : null) || matchFood(clean) || null;
  // "aceto di vino" è aceto, non vino
  if (/\baceto\b/i.test(clean) && BY_KEY.aceto) food = BY_KEY.aceto;
  const junk = (clean.match(/[a-zà-ú]/gi) || []).length < 3; // righe tipo "1" rimaste dall'export
  const variant = food ? variantsIn(food.key, norm(clean)) : [];
  // le spezie in generale le hai, ma l'anice o lo zafferano vanno comprati apposta
  const basic = !!(food && BASICS.has(food.key) && !(food.key === 'spezie' && variant.length));
  return { line: clean, food: food || null, basic, variant, junk };
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
const DERIVED = ['salsa', 'salse', 'sugo', 'sughi', 'sughetto', 'condimento', 'dado', 'brodo', 'aroma', 'aromi', 'gusto', 'sapore', 'insaporitore', 'patatine', 'chips', 'snack', 'cracker', 'tisana', 'infuso', 'caramelle', 'budino', 'merendina', 'barretta', 'bevanda', 'liquore', 'sciroppo', 'crema'];
const derivedOf = (text) => DERIVED.filter((d) => new RegExp(`\\b${d}\\b`).test(text));
function fits(it, lineNorm) {
  const d = derivedOf(norm(it.name));
  return !d.length || d.some((x) => lineNorm.includes(x));
}

// La dispensa indicizzata una volta per tutte le ricette
export function pantryIndex(items, soonIds = new Set()) {
  const byFood = new Map();
  for (const it of items) {
    if (!it.food || it.food === 'altro') continue;
    if (!byFood.has(it.food)) byFood.set(it.food, []);
    byFood.get(it.food).push(it);
  }
  // per nome cerco solo tra i cibi fuori catalogo: "Tisana zenzero" (che è un tè) non è zenzero
  const names = items.filter((it) => !it.food || it.food === 'altro').map((it) => ({ it, n: norm(it.name), w: norm(it.name).replace(/[^a-z ]/g, ' ').split(' ').filter((x) => x.length > 3) }));
  return { byFood, names, soonIds, byName: new Map(), byVariant: new Map() };
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
            const has = variantsIn(r.food.key, norm(it.name));
            return r.variant.length ? r.variant.some((v) => has.includes(v)) : GENERIC_ANY.has(r.food.key) || !has.length;
          })
        );
      }
      found = idx.byVariant.get(k);
    }
    found = found.filter((it) => fits(it, ln));
    if (!found.length && !VARIANTS[r.food.key]) {
      // per i cibi fuori catalogo: nome uguale
      const w = norm(r.food.name).split(' ')[0];
      if (!idx.byName.has(w)) idx.byName.set(w, idx.names.filter((x) => w.length > 3 && x.w.some((n) => sameWord(n, w))).map((x) => x.it));
      found = idx.byName.get(w).filter((it) => fits(it, ln));
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
