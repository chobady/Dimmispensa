// USDA FoodData Central: banca dati ufficiale americana, gratuita.
// Ha le etichette di centinaia di migliaia di prodotti di marca con codice a barre (soprattutto USA).
// Chiave gratuita su https://fdc.nal.usda.gov/api-key-signup ; senza chiave usa DEMO_KEY (poche richieste l'ora).
import { cleanNutr } from './items.js';
import { codeVariants } from './barcode.js';
import { norm } from '../catalog.js';

const BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Valori per 100 g dai nutrienti della ricerca (Branded: già per 100 g)
function nutrOf(food) {
  const get = (...ids) => {
    for (const id of ids) {
      const n = (food.foodNutrients || []).find((x) => x.nutrientId === id || String(x.nutrientNumber) === String(id));
      if (n && n.value !== undefined && n.value !== null) return n.value;
    }
    return null;
  };
  let kcal = get(1008, 208, 2047, 2048);
  if (kcal === null) {
    const kj = get(1062, 268);
    if (kj !== null) kcal = kj / 4.184;
  }
  return cleanNutr({ kcal, p: get(1003, 203), c: get(1005, 205), f: get(1004, 204) });
}

let viaProxy = false; // se il browser blocca la chiamata diretta, passo dal ponte /api/usda di Vercel

async function search(key, query, pageSize = 10) {
  const direct = `${BASE}?api_key=${encodeURIComponent(key || 'DEMO_KEY')}&dataType=Branded&pageSize=${pageSize}&query=${encodeURIComponent(query)}`;
  const proxy = `/api/usda?key=${encodeURIComponent(key || '')}&pageSize=${pageSize}&query=${encodeURIComponent(query)}`;
  let r;
  if (!viaProxy) {
    try {
      r = await fetch(direct);
    } catch {
      viaProxy = true;
    }
  }
  if (viaProxy) r = await fetch(proxy);
  if (r.status === 403 || r.status === 401) throw new Error('La chiave USDA non è valida.');
  if (r.status === 429) throw new Error('USDA: troppe richieste per ora. Con una chiave gratuita il limite è molto più alto.');
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  return data.foods || [];
}

const complete = (n) => !!n && n.p !== null && n.c !== null && n.f !== null;
const stripZeros = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');

// Etichetta da codice a barre
export async function usdaByCode(key, code) {
  const wanted = new Set(codeVariants(code).map(stripZeros));
  const foods = await search(key, stripZeros(code), 5);
  for (const f of foods) {
    if (wanted.has(stripZeros(f.gtinUpc))) {
      const n = nutrOf(f);
      if (complete(n)) return n;
    }
  }
  return null;
}

// Etichetta da marca + nome (stesse regole prudenti di Open Food Facts: marca uguale e una parola in comune)
export async function usdaByName(key, name, brand) {
  const b = norm(brand);
  if (!b) return null;
  const foods = await search(key, `${brand} ${name}`, 8);
  const words = norm(name).split(' ').filter((w) => w.length > 3);
  for (const f of foods) {
    const fb = norm(`${f.brandName || ''} ${f.brandOwner || ''}`);
    const fn = norm(f.description);
    const brandOk = fb.includes(b) || b.includes(fb.split(' ')[0] || '#');
    const nameOk = !words.length || words.some((w) => fn.includes(w.slice(0, -1)));
    const n = nutrOf(f);
    if (brandOk && nameOk && complete(n)) return n;
  }
  return null;
}

// Prodotto intero dal codice a barre (nome, marca, peso della confezione, valori): usato se Open Food Facts non lo conosce
export async function usdaProductByCode(key, code) {
  const wanted = new Set(codeVariants(code).map(stripZeros));
  const foods = await search(key, stripZeros(code), 5);
  const f = foods.find((x) => wanted.has(stripZeros(x.gtinUpc)));
  if (!f) return null;
  const title = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  let qty;
  let unit;
  const pw = String(f.packageWeight || '');
  const g = pw.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/i);
  const oz = pw.match(/(\d+(?:\.\d+)?)\s*oz/i);
  if (g) {
    qty = Number(g[1]);
    unit = g[2].toLowerCase();
  } else if (oz) {
    qty = Math.round(Number(oz[1]) * 28.35);
    unit = 'g';
  }
  return { name: title(f.description), brand: title(f.brandName || f.brandOwner), qty, unit, nutr: nutrOf(f) };
}
