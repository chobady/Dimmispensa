// Ricerca di un prodotto dal codice a barre su Open Food Facts (gratis, senza chiave).
import { matchFood } from '../catalog.js';
import { makeDraft } from './items.js';
import { codeVariants } from './barcode.js';

const FIELDS = 'product_name,product_name_it,product_name_en,generic_name_it,generic_name,brands,quantity,product_quantity,product_quantity_unit,categories_tags,nutriments';

async function fetchProduct(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;
  const r = await fetch(url);
  if (!r.ok && r.status !== 404) throw new Error('Open Food Facts non risponde. Riprova tra poco.');
  const data = await r.json().catch(() => ({}));
  const p = data.product;
  if (!p || data.status === 0) return null;
  return p;
}

export async function lookupBarcode(code) {
  // provo tutte le forme del codice (i prodotti USA sono spesso salvati con uno 0 davanti)
  let p = null;
  for (const c of codeVariants(code)) {
    p = await fetchProduct(c);
    if (p) break;
  }
  if (!p) return null;
  const name = (p.product_name_it || p.product_name || p.product_name_en || p.generic_name_it || p.generic_name || '').trim();
  if (!name) return null;
  const brand = String(p.brands || '').split(',')[0].trim();
  const cats = (p.categories_tags || []).map((c) => c.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).join(' ');
  const food = matchFood(name) || matchFood(p.generic_name_it || '') || matchFood(cats) || matchFoodEnglish(cats);
  let qty = 1;
  let unit;
  const q = Number(p.product_quantity);
  const u = String(p.product_quantity_unit || '').toLowerCase();
  if (q > 0 && ['g', 'kg', 'ml', 'l'].includes(u)) {
    qty = q;
    unit = u;
    if (unit === 'g' && qty >= 1000) [qty, unit] = [qty / 1000, 'kg'];
    if (unit === 'ml' && qty >= 1000) [qty, unit] = [qty / 1000, 'l'];
  }
  const n = p.nutriments || {};
  const nutr = { kcal: n['energy-kcal_100g'], p: n.proteins_100g, c: n.carbohydrates_100g, f: n.fat_100g };
  return makeDraft({ name, brand, qty, unit, foodKey: food?.key, nutr });
}

// Le categorie di Open Food Facts sono spesso in inglese: piccola tabella di traduzione
const EN = [
  ['pasta', 'pasta'], ['rice', 'riso'], ['milk', 'latte'], ['yogurt', 'yogurt'], ['cheese', 'formaggio'], ['biscuit', 'biscotti'],
  ['cookie', 'biscotti'], ['chocolate', 'cioccolato'], ['cereal', 'cereali'], ['bread', 'pane'], ['tuna', 'tonno'], ['fish', 'pesce'],
  ['meat', 'bistecca'], ['ham', 'prosciutto'], ['sausage', 'salsiccia'], ['chicken', 'petto'], ['juice', 'succo'], ['water', 'acqua'],
  ['beer', 'birra'], ['wine', 'vino'], ['soda', 'bibita'], ['beverage', 'bibita'], ['tomato', 'passata'], ['sauce', 'sugo'], ['oil', 'olio'],
  ['legume', 'legumi'], ['bean', 'legumi'], ['crisps', 'patatine'], ['chips', 'patatine'], ['snack', 'merendine'], ['jam', 'marmellata'],
  ['spread', 'cremanocciola'], ['coffee', 'caffe'], ['tea', 'te'], ['frozen', 'verduresurgelate'], ['ice cream', 'gelato'], ['egg', 'uova'],
  ['butter', 'burro'], ['cream', 'panna'], ['flour', 'farina'], ['sugar', 'zucchero'], ['honey', 'miele'], ['cracker', 'cracker'],
  ['vegetable', 'verduresurgelate'], ['fruit', 'mela'], ['canned', 'pelati'], ['meal', 'piattopronto'], ['pizza', 'pizza'],
];
function matchFoodEnglish(cats) {
  const hit = EN.find(([en]) => cats.includes(en));
  return hit ? { key: hit[1] } : null;
}
