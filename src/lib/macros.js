// Conti dei macronutrienti: per un cibo (per 100 g) e per un pasto o una giornata (porzioni pesate).
import { PIECE_G } from '../catalog.js';

export const MACRO_COLORS = { p: '#ff8a7a', c: '#f7d038', f: '#6fb7e8' };
export const MACRO_NAMES = { p: 'Proteine', c: 'Carboidrati', f: 'Grassi' };

// Peso in grammi (o ml) di una porzione; null se non si può sapere
export function portionGrams(qty, unit, food, pieceG) {
  const q = Number(qty) || 0;
  if (!q) return null;
  if (unit === 'g' || unit === 'ml') return q;
  if (unit === 'kg' || unit === 'l') return q * 1000;
  const per = pieceG || PIECE_G[food];
  return per ? q * per : null;
}

// Somma delle porzioni: righe { name, nutr, grams } -> grammi di proteine/carboidrati/grassi e kcal
export function sumMacros(rows) {
  const t = { p: 0, c: 0, f: 0, kcal: 0, counted: 0, missing: [] };
  for (const r of rows) {
    if (!r.nutr || r.grams === null || r.grams === undefined || r.nutr.p === null || r.nutr.c === null || r.nutr.f === null) {
      t.missing.push(r.name);
      continue;
    }
    const k = r.grams / 100;
    t.p += r.nutr.p * k;
    t.c += r.nutr.c * k;
    t.f += r.nutr.f * k;
    t.kcal += (r.nutr.kcal ?? r.nutr.p * 4 + r.nutr.c * 4 + r.nutr.f * 9) * k;
    t.counted++;
  }
  return t;
}

// Fette della torta: per grammi oppure per calorie (proteine e carboidrati 4 kcal/g, grassi 9)
export function slices(t, mode = 'g') {
  const w = mode === 'kcal' ? { p: 4, c: 4, f: 9 } : { p: 1, c: 1, f: 1 };
  const vals = ['p', 'c', 'f'].map((k) => ({ key: k, value: Math.max(0, (t[k] || 0) * w[k]), grams: t[k] || 0 }));
  const tot = vals.reduce((a, b) => a + b.value, 0);
  return vals.map((v) => ({ ...v, pct: tot ? Math.round((v.value / tot) * 100) : 0, color: MACRO_COLORS[v.key] }));
}
