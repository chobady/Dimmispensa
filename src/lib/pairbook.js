// "Libro degli abbinamenti" personale: un file JSON che l'utente importa da sé.
// Resta SOLO su questo dispositivo (localStorage): non va su Firebase né nel codice dell'app.
// Formato: { fonte, tabelle: [ { ingrediente, ingrediente_it?, pagina?, abbinamenti: [ { nome, nome_it? } | "nome" ] } ] }
import { matchFood, norm } from '../catalog.js';

const LS = 'dm_pairbook';
let cache;

export function getBook() {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(LS) || 'null');
  } catch {
    cache = null;
  }
  return cache;
}

export async function importBook(file) {
  let d;
  try {
    d = JSON.parse(await file.text());
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  const tabs = Array.isArray(d?.tabelle) ? d.tabelle : Array.isArray(d) ? d : null;
  if (!tabs) throw new Error('Non trovo le tabelle degli abbinamenti nel file.');
  const tables = tabs
    .filter((t) => t && (t.ingrediente || t.ingrediente_it) && Array.isArray(t.abbinamenti))
    .map((t) => ({
      en: String(t.ingrediente || ''),
      it: String(t.ingrediente_it || t.ingrediente || ''),
      p: t.pagina ?? null,
      a: t.abbinamenti.map((x) => (typeof x === 'string' ? { en: x, it: x } : { en: String(x.nome || ''), it: String(x.nome_it || x.nome || '') })).filter((x) => x.it),
    }));
  if (!tables.length) throw new Error('Il file non contiene abbinamenti.');
  const book = { fonte: String(d.fonte || file.name).slice(0, 200), tables, at: Date.now() };
  try {
    localStorage.setItem(LS, JSON.stringify(book));
  } catch {
    throw new Error('Spazio finito su questo dispositivo: il file è troppo grande.');
  }
  cache = book;
  idx = null;
  return book;
}

export function removeBook() {
  localStorage.removeItem(LS);
  cache = null;
  idx = null;
}

// indice per parole, costruito una volta
let idx = null;
const words = (s) => norm(s).replace(/\([^)]*\)/g, ' ').replace(/[^a-z ]/g, ' ').split(' ').filter((w) => w.length > 2);
function index() {
  const b = getBook();
  if (!b) return null;
  if (idx) return idx;
  idx = b.tables.map((t, i) => ({ i, t, it: norm(t.it).replace(/\([^)]*\)/g, '').trim(), en: norm(t.en), w: new Set([...words(t.it), ...words(t.en)]), f: matchFood(norm(t.it).replace(/\([^)]*\)/g, ''))?.key || null }));
  return idx;
}

// Cerca nel libro (italiano o inglese): prima i nomi uguali, poi quelli che iniziano così, poi le parole
export function searchBook(q, max = 50) {
  const ix = index();
  if (!ix) return [];
  const n = norm(q).trim();
  if (!n) return ix.map((x) => x.t).slice(0, max);
  const qw = words(n);
  const scored = [];
  for (const x of ix) {
    let s = 0;
    if (x.it === n || x.en === n) s = 100;
    else if (x.it.startsWith(n) || x.en.startsWith(n)) s = 60;
    else if (qw.length && qw.every((w) => [...x.w].some((v) => v.startsWith(w)))) s = 30 - x.w.size;
    if (s > 0) scored.push([s, x.t]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, max).map((x) => x[1]);
}

// Le tabelle che parlano di questo cibo della dispensa
export function tablesFor(item, max = 2) {
  const ix = index();
  if (!ix) return [];
  const name = norm(item.name || '').replace(/\([^)]*\)/g, '').trim();
  const fOf = new Map(ix.map((x) => [x.t, x.f]));
  const out = searchBook(name, 5).filter((t) => !item.food || item.food === 'altro' || !fOf.get(t) || fOf.get(t) === item.food);
  if (!out.length && item.food && item.food !== 'altro') {
    for (const x of ix) {
      if (x.f === item.food && x.w.size <= 3) out.push(x.t);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max);
}
