import { BY_KEY, OTHER, matchFood, UNITS } from '../catalog.js';
import { addDays, isISO } from './dates.js';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Crea una "bozza" di cibo completa partendo da pochi dati (anche solo il nome).
export function makeDraft({ name, brand = '', qty = 1, unit, foodKey, loc, expiry, est }) {
  const food = BY_KEY[foodKey] || matchFood(name) || matchFood(brand) || OTHER;
  const hasDate = isISO(expiry);
  return {
    id: newId(),
    name: cap(String(name || food.name).trim()).slice(0, 60),
    brand: String(brand || '').trim().slice(0, 40),
    qty: Number(qty) > 0 ? Math.round(Number(qty) * 100) / 100 : 1,
    unit: UNITS.includes(unit) ? unit : food.unit,
    food: food.key,
    icon: food.icon,
    cat: food.cat,
    loc: ['frigo', 'freezer', 'dispensa'].includes(loc) ? loc : food.loc,
    // senza data: stima dalla durata tipica (nel freezer dura di più)
    expiry: hasDate ? expiry : food.days ? addDays(loc === 'freezer' && food.loc !== 'freezer' ? Math.max(food.days, 90) : food.days) : null,
    est: hasDate ? !!est : !!food.days,
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
