import { BY_KEY, OTHER, matchFood, UNITS } from '../catalog.js';
import { addDays, isISO } from './dates.js';
import { CIQUAL } from '../ciqual-data.js';

// Valori dalla tabella ufficiale per un cibo del catalogo (o null)
export const tableNutr = (foodKey) => {
  const t = CIQUAL[foodKey];
  return t ? { kcal: t.kcal, p: t.p, c: t.c, f: t.f } : null;
};

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Crea una "bozza" di cibo completa partendo da pochi dati (anche solo il nome).
const MACRO_IDS = ['proteine', 'carboidrati', 'grassi', 'fibre'];
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v) * 10) / 10));
// valori nutrizionali per 100 g/ml: { kcal, p, c, f } oppure null
export function cleanNutr(n) {
  if (!n) return null;
  const out = { kcal: num(n.kcal), p: num(n.p), c: num(n.c), f: num(n.f) };
  return Object.values(out).some((v) => v !== null) ? out : null;
}
// macronutriente dominante dai valori (calorie da proteine 4, carboidrati 4, grassi 9)
export function macroFromNutr(n) {
  if (!n || n.p === null || n.c === null || n.f === null) return undefined;
  const e = { proteine: n.p * 4, carboidrati: n.c * 4, grassi: n.f * 9 };
  const tot = e.proteine + e.carboidrati + e.grassi;
  if (tot < 5) return null;
  if ((n.kcal ?? tot) < 45 && n.c >= n.p && n.c >= n.f) return 'fibre';
  return Object.entries(e).sort((a, b) => b[1] - a[1])[0][0];
}

export function makeDraft({ name, brand = '', qty, unit, foodKey, loc, expiry, est, macro, nutr, nutrSrc, code }) {
  const food = BY_KEY[foodKey] || matchFood(name) || matchFood(brand) || OTHER;
  const hasDate = isISO(expiry);
  // ordine dei valori: etichetta > tabella ufficiale (Ciqual) > stima di Gemini
  if (!(nutrSrc === 'etichetta' && cleanNutr(nutr)) && tableNutr(food.key)) {
    nutr = tableNutr(food.key);
    nutrSrc = 'tabella';
    macro = undefined;
  }
  return {
    id: newId(),
    name: cap(String(name || food.name).trim()).slice(0, 60),
    brand: String(brand || '').trim().slice(0, 40),
    unit: UNITS.includes(unit) ? unit : food.unit,
    qty: Number(qty) > 0 ? Math.round(Number(qty) * 100) / 100 : defaultQty(UNITS.includes(unit) ? unit : food.unit),
    food: food.key,
    icon: food.icon,
    cat: food.cat,
    loc: ['frigo', 'freezer', 'dispensa'].includes(loc) ? loc : food.loc,
    // senza data: stima dalla durata tipica (nel freezer dura di più)
    expiry: hasDate ? expiry : food.days ? addDays(loc === 'freezer' && food.loc !== 'freezer' ? Math.max(food.days, 90) : food.days) : null,
    est: hasDate ? !!est : !!food.days,
    ...(cleanNutr(nutr) ? { nutr: cleanNutr(nutr), nutrSrc: nutrSrc || 'gemini' } : {}),
    ...(code ? { code: String(code) } : {}),
    // macronutriente: detto da Gemini/etichetta, altrimenti calcolato dai valori, altrimenti quello del catalogo
    ...(MACRO_IDS.includes(macro) ? { macro } : macro === 'nessuno' ? { macro: null } : macroFromNutr(cleanNutr(nutr)) !== undefined ? { macro: macroFromNutr(cleanNutr(nutr)) } : {}),
  };
}

// Aggiunta con un tocco dal catalogo
export const draftFromFood = (food) => makeDraft({ name: food.name, foodKey: food.key });

export const qtyLabel = (item) => {
  const q = Number(item.qty) || 0;
  const n = Number.isInteger(q) ? q : q.toFixed(q < 10 ? 1 : 0).replace('.', ',');
  return item.unit === 'pz' ? `×${n}` : `${n} ${item.unit}`;
};

// Di quanto scende la quantità con il tasto "−"
export const stepOf = (unit) => (unit === 'g' || unit === 'ml' ? 50 : unit === 'kg' || unit === 'l' ? 0.5 : 1);

// Quantità di partenza quando non è detta
export const defaultQty = (unit) => (unit === 'g' || unit === 'ml' ? 500 : 1);

const round = (n) => Math.round(n * 1000) / 1000;
// Porzione proposta per un pasto, nell'unità del cibo
export function defaultPortion(item, role) {
  const q = Number(item.qty) || 0;
  const want = { g: role === 'carb' ? 80 : 150, ml: 200, kg: 0.15, l: 0.2, pz: 1, conf: 1 }[item.unit] || 1;
  return round(Math.min(q || want, want));
}

// Testo della porzione: "tutto", "150 g", "2 pz"
export const portionLabel = (e) => {
  if (!e || (!e.qty && !e.all)) return '';
  if (e.all) return 'tutto';
  const n = String(e.qty).replace('.', ',');
  return e.unit === 'pz' ? `×${n}` : `${n} ${e.unit}`;
};
