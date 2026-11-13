// Lettore "di riserva" per le frasi scritte a mano: funziona anche senza Gemini.
// Capisce cose tipo: "2 latte, pasta barilla 500g, yogurt scade il 20, 3 mele in frigo"
import { norm } from '../catalog.js';
import { addDays, toISO } from './dates.js';
import { makeDraft } from './items.js';

const NUM_WORDS = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, mezzo: 0.5 };
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const UNIT_MAP = {
  kg: 'kg', chili: 'kg', chilo: 'kg', g: 'g', gr: 'g', grammi: 'g', l: 'l', lt: 'l', litri: 'l', litro: 'l',
  ml: 'ml', pz: 'pz', pezzi: 'pz', pezzo: 'pz', conf: 'conf', confezioni: 'conf', confezione: 'conf',
  pacchi: 'conf', pacco: 'conf', scatole: 'conf', scatola: 'conf', bottiglie: 'pz', bottiglia: 'pz', vasetti: 'pz', vasetto: 'pz',
};

function nextDay(day, month, year) {
  const now = new Date();
  let y = year ? (year < 100 ? 2000 + year : year) : now.getFullYear();
  let m = month ? month - 1 : now.getMonth();
  let d = new Date(y, m, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!year && d < today) d = month ? new Date(y + 1, m, day) : new Date(y, m + 1, day);
  return toISO(d);
}

function takeExpiry(s) {
  let expiry = null;
  const cut = (re, fn) => {
    if (expiry) return;
    const m = s.match(re);
    if (m) {
      expiry = fn(m);
      s = s.replace(m[0], ' ');
    }
  };
  const pre = '(?:(?:con )?(?:scad\\w*|entro|fino a)\\.?\\s*(?:il|al|l)?\\s*)';
  cut(new RegExp(pre + '(\\d{1,2})[/.\\-](\\d{1,2})(?:[/.\\-](\\d{2,4}))?'), (m) => nextDay(+m[1], +m[2], m[3] ? +m[3] : 0));
  cut(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, (m) => nextDay(+m[1], +m[2], m[3] ? +m[3] : 0));
  cut(new RegExp(pre + '?(\\d{1,2})\\s+(' + MESI.join('|') + ')(?:\\s+(\\d{4}))?'), (m) => nextDay(+m[1], MESI.indexOf(m[2]) + 1, m[3] ? +m[3] : 0));
  cut(new RegExp(pre + '(\\d{1,2})(?!\\d)'), (m) => nextDay(+m[1], 0, 0));
  cut(new RegExp(pre + '?(?:tra|fra)\\s+(\\d+|una|un|due|tre)\\s+(giorn\\w*|settiman\\w*|mes\\w*)'), (m) => {
    const n = NUM_WORDS[m[1]] || +m[1];
    return addDays(n * (m[2].startsWith('sett') ? 7 : m[2].startsWith('mes') ? 30 : 1));
  });
  cut(new RegExp(pre + '?dopodomani'), () => addDays(2));
  cut(new RegExp(pre + 'domani'), () => addDays(1));
  cut(new RegExp(pre + 'oggi'), () => addDays(0));
  return [s, expiry];
}

function parseChunk(chunk) {
  let s = ' ' + chunk.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/.,\- ]+/g, ' ') + ' ';
  let loc;
  const locRe = [
    [/\s(?:in|nel|dentro il)\s+(?:freezer|congelatore|surgelatore)\s/, 'freezer'],
    [/\s(?:in|nel)\s+frigo(?:rifero)?\s/, 'frigo'],
    [/\s(?:in|nella)\s+(?:dispensa|credenza)\s/, 'dispensa'],
  ];
  for (const [re, l] of locRe) {
    if (re.test(s)) {
      loc = l;
      s = s.replace(re, ' ');
    }
  }
  let expiry;
  [s, expiry] = takeExpiry(s);

  let qty;
  let unit;
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|chili|chilo|grammi|gr|g|litri|litro|lt|l|ml|pz|pezzi|pezzo|confezioni|confezione|conf|pacchi|pacco|scatole|scatola|bottiglie|bottiglia|vasetti|vasetto)\b/);
  if (m) {
    qty = parseFloat(m[1].replace(',', '.'));
    unit = UNIT_MAP[m[2]];
    s = s.replace(m[0], ' ');
    // "2 pasta da 500 g": il numero di pezzi resta nel nome? No: teniamo il peso, più utile.
    const n2 = s.match(/\s(\d+)\s*x?\s/);
    if (n2 && (unit === 'g' || unit === 'ml') && +n2[1] > 1 && +n2[1] < 30) {
      qty = +n2[1];
      unit = 'conf';
      s = s.replace(n2[0], ' ');
    }
  } else if ((m = s.match(/\s(\d+(?:[.,]\d+)?)\s*x?\s/)) || (m = s.match(/\sx\s*(\d+)\s/))) {
    qty = parseFloat(m[1].replace(',', '.'));
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/^\s(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|mezzo)\s/))) {
    qty = NUM_WORDS[m[1]];
    s = s.replace(m[0], ' ');
  }
  const name = s.replace(/[.,\-/]+/g, ' ').replace(/\s(di|del|della|dei|delle|da)\s*$/g, ' ').replace(/^\s*(di|del|della|dei|delle)\s/, ' ').replace(/\s+/g, ' ').trim();
  if (!norm(name)) return null;
  return makeDraft({ name, qty, unit, loc, expiry, est: false });
}

export function parseLocal(text) {
  return String(text || '')
    .split(/[\n;]+|,(?!\d)|\s+e\s+(?=\d|un[oa]?\s|due\s|tre\s)|\s+poi\s+/i)
    .map((c) => c.trim())
    .filter(Boolean)
    .map(parseChunk)
    .filter(Boolean);
}
