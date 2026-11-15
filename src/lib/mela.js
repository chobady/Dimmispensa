// Ricette da Mela: lettura dei file esportati (.melarecipe = JSON, .melarecipes = zip di JSON)
// e confronto degli ingredienti con la dispensa.
import { matchFood, norm } from '../catalog.js';

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

async function normalize(raw, by) {
  if (!raw || typeof raw !== 'object' || !raw.title) return null;
  const melaId = String(raw.id || '');
  const id = UUID.test(melaId) ? melaId : 'r' + hash(melaId || raw.title);
  const images = Array.isArray(raw.images) ? raw.images : [];
  return {
    id,
    melaId,
    title: String(raw.title).trim().slice(0, 150),
    text: String(raw.text || '').trim().slice(0, 2000),
    ingredients: lines(raw.ingredients).slice(0, 80).map((l) => l.slice(0, 200)),
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

// Legge uno o più file scelti dall'utente e restituisce le ricette pronte da salvare
export async function readMelaFiles(files, by) {
  const raws = [];
  const dec = new TextDecoder();
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (isZip(bytes)) {
      const { unzipSync } = await import('fflate');
      const entries = unzipSync(bytes);
      for (const [name, data] of Object.entries(entries)) {
        if (name.startsWith('__MACOSX') || !/\.(melarecipe|json)$/i.test(name)) continue;
        try {
          raws.push(JSON.parse(dec.decode(data)));
        } catch {}
      }
    } else {
      try {
        const j = JSON.parse(dec.decode(bytes));
        if (Array.isArray(j)) raws.push(...j);
        else raws.push(j);
      } catch {}
    }
  }
  const out = [];
  for (const r of raws) {
    const n = await normalize(r, by);
    if (n) out.push(n);
  }
  return out;
}

// Un ingrediente di Mela ("# Per il sugo" è un titoletto) → cibo del catalogo
export function parseIngredient(line) {
  if (/^#/.test(line)) return { line: line.replace(/^#+\s*/, ''), header: true };
  const clean = line.replace(/^[-•*]\s*/, '');
  const food = matchFood(clean);
  return { line: clean, food: food || null, basic: !!(food && BASICS.has(food.key)) };
}

// Confronto con la dispensa: cosa hai, cosa manca, quali cibi in scadenza usa
export function checkRecipe(recipe, items, soonIds = new Set()) {
  const byFood = new Map();
  for (const it of items) {
    if (!it.food || it.food === 'altro') continue;
    if (!byFood.has(it.food)) byFood.set(it.food, []);
    byFood.get(it.food).push(it);
  }
  const names = items.map((it) => ({ it, n: norm(it.name) }));
  const rows = (recipe.ingredients || []).map(parseIngredient);
  let have = 0;
  let need = 0;
  const missing = [];
  const usesSoon = [];
  for (const r of rows) {
    if (r.header || !r.food) continue;
    let found = byFood.get(r.food.key) || [];
    if (!found.length) {
      // per i cibi fuori catalogo: nome uguale
      const w = norm(r.food.name).split(' ')[0];
      found = names.filter((x) => w.length > 3 && x.n.includes(w)).map((x) => x.it);
    }
    r.have = found.length > 0;
    r.items = found;
    if (r.basic) continue;
    need++;
    if (r.have) {
      have++;
      const soon = found.filter((it) => soonIds.has(it.id));
      if (soon.length) usesSoon.push(soon[0]);
    } else missing.push(r);
  }
  return { rows, have, need, missing, usesSoon, ratio: need ? have / need : 0 };
}
