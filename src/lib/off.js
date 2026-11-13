// Ricerca di un prodotto dal codice a barre su Open Food Facts (gratis, senza chiave).
import { matchFood } from '../catalog.js';
import { makeDraft } from './items.js';

export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_it,generic_name_it,brands,quantity,product_quantity,product_quantity_unit,categories_tags`;
  const r = await fetch(url);
  if (!r.ok && r.status !== 404) throw new Error('Open Food Facts non risponde. Riprova.');
  const data = await r.json().catch(() => ({}));
  const p = data.product;
  if (!p || data.status === 0) return null;
  const name = (p.product_name_it || p.product_name || p.generic_name_it || '').trim();
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
  return makeDraft({ name, brand, qty, unit, foodKey: food?.key });
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
