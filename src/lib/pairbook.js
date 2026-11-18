// "Libro degli abbinamenti" personale: un file JSON che l'utente importa da sé.
// Resta SOLO su questo dispositivo (localStorage): non va su Firebase né nel codice dell'app.
// Formato: { fonte, tabelle: [ { ingrediente, ingrediente_it?, pagina?, abbinamenti: [ { nome, nome_it? } | "nome" ] } ] }
import { matchFood, norm } from '../catalog.js';

const LS = 'dm_pairbook';
let cache;
const clean = (x) => norm(x).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

// Formati accettati:
//  A) { fonte, tabelle: [ { ingrediente, ingrediente_it?, pagina?, abbinamenti: [ { nome, nome_it? } | "nome" ] } ] }
//  B) { libri: [ { titolo, ingredienti: [ { ingrediente | ingrediente_it + ingrediente_en, abbinamenti: [ { con | con_it + con_en } ] } ] } ] }
function toSources(d, fileName) {
  const out = [];
  const pair = (x) => (typeof x === 'string' ? { en: x, it: x } : { en: String(x.nome || x.con_en || x.con || ''), it: String(x.nome_it || x.con_it || x.nome || x.con || x.con_en || '') });
  if (Array.isArray(d?.tabelle) || Array.isArray(d)) {
    const tabs = Array.isArray(d) ? d : d.tabelle;
    out.push({
      name: String(d.fonte || fileName).slice(0, 200),
      tables: tabs
        .filter((t) => t && (t.ingrediente || t.ingrediente_it) && Array.isArray(t.abbinamenti))
        .map((t) => ({ en: String(t.ingrediente || t.ingrediente_en || ''), it: String(t.ingrediente_it || t.ingrediente || ''), p: t.pagina ?? null, a: t.abbinamenti.map(pair).filter((x) => x.it) })),
    });
  }
  if (Array.isArray(d?.libri)) {
    for (const l of d.libri) {
      const ing = Array.isArray(l?.ingredienti) ? l.ingredienti : [];
      out.push({
        name: String(l.titolo || fileName).slice(0, 200),
        tables: ing
          .filter((t) => t && (t.ingrediente || t.ingrediente_it) && Array.isArray(t.abbinamenti))
          .map((t) => ({ en: String(t.ingrediente_en || t.ingrediente || ''), it: String(t.ingrediente_it || t.ingrediente || ''), p: t.pagina ?? null, a: t.abbinamenti.map(pair).filter((x) => x.it) })),
      });
    }
  }
  return out.filter((s) => s.tables.length);
}

// Unisce le fonti: stesso ingrediente = una sola scheda; abbinamenti doppi contati una volta (e messi prima)
function merge(sources) {
  const byIng = new Map();
  sources.forEach((src, si) => {
    for (const t of src.tables) {
      const k = clean(t.it) || clean(t.en);
      if (!k) continue;
      let m = byIng.get(k);
      if (!m) {
        m = { it: t.it, en: t.en, p: null, pages: [], src: [], a: new Map() };
        byIng.set(k, m);
      }
      if (!m.src.includes(si)) m.src.push(si);
      if (t.p != null) m.pages.push({ si, p: t.p });
      if (m.en === m.it && t.en && t.en !== t.it) m.en = t.en;
      t.a.forEach((x, pos) => {
        const ak = clean(x.it);
        if (!ak) return;
        const e = m.a.get(ak);
        if (e) {
          if (!e.src.includes(si)) e.src.push(si);
          e.pos = Math.min(e.pos, pos);
        } else m.a.set(ak, { it: x.it, en: x.en, src: [si], pos });
      });
    }
  });
  return [...byIng.values()].map((m) => ({
    it: m.it,
    en: m.en,
    p: m.pages[0]?.p ?? null,
    pages: m.pages,
    src: m.src,
    a: [...m.a.values()].sort((x, y) => y.src.length - x.src.length || x.pos - y.pos),
  }));
}

export function getBook() {
  if (cache !== undefined) return cache;
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(LS) || 'null');
  } catch {}
  // formato vecchio (un solo libro)
  if (raw && !raw.sources && Array.isArray(raw.tables)) raw = { sources: [{ name: raw.fonte, tables: raw.tables }] };
  cache = raw && raw.sources?.length ? { sources: raw.sources, tables: merge(raw.sources) } : null;
  return cache;
}

function save(sources) {
  try {
    localStorage.setItem(LS, JSON.stringify({ sources }));
  } catch {
    throw new Error('Spazio finito su questo dispositivo: i file sono troppo grandi.');
  }
  cache = sources.length ? { sources, tables: merge(sources) } : null;
  idx = null;
  return cache;
}

// Aggiunge un file (le fonti con lo stesso nome vengono sostituite)
export async function importBook(file) {
  let d;
  try {
    d = JSON.parse(await file.text());
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  const add = toSources(d, file.name);
  if (!add.length) throw new Error('Non trovo abbinamenti in questo file.');
  const names = new Set(add.map((s) => s.name));
  const old = (getBook()?.sources || []).filter((s) => !names.has(s.name));
  const book = save([...old, ...add]);
  return { book, added: add };
}

export function removeSource(name) {
  return save((getBook()?.sources || []).filter((s) => s.name !== name));
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
