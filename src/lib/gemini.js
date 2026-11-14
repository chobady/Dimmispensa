// Chiamate a Google Gemini (testo e foto dello scontrino) direttamente dal browser.
// La chiave la inserisci tu nelle Opzioni dell'app: non è mai scritta nel codice.
import { CATALOG } from '../catalog.js';
import { todayISO } from './dates.js';
import { cleanNutr, makeDraft } from './items.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const MODEL_KEY = 'dm_gemini_model';

export class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const savedModel = () => {
  try {
    return localStorage.getItem(MODEL_KEY) || '';
  } catch {
    return '';
  }
};
const saveModel = (m) => {
  try {
    localStorage.setItem(MODEL_KEY, m);
  } catch {}
};

// Se i nomi "latest" non esistono più, chiede a Google l'elenco e sceglie un modello Flash adatto.
async function discoverModel(key) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) throw await toError(r);
  const data = await r.json();
  const ok = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini') && !/(image|tts|audio|live|embedding|robotics|computer)/.test(n));
  const score = (n) => (n.includes('flash') ? 10 : 0) + (n.includes('lite') ? -2 : 0) + (n.includes('preview') || n.includes('exp') ? -3 : 0) + (n.includes('latest') ? 1 : 0);
  ok.sort((a, b) => score(b) - score(a) || b.localeCompare(a, undefined, { numeric: true }));
  if (!ok.length) throw new GeminiError('La tua chiave non ha modelli Gemini disponibili.', 'nomodel');
  return ok[0];
}

async function toError(r) {
  let msg = '';
  try {
    msg = (await r.json())?.error?.message || '';
  } catch {}
  if (r.status === 429) return new GeminiError('Gemini ha finito le richieste gratuite per ora. Riprova tra un minuto.', 'quota');
  if (r.status === 400 && /api key/i.test(msg)) return new GeminiError('La chiave Gemini non è valida. Controllala nelle Opzioni.', 'key');
  if (r.status === 401 || r.status === 403) return new GeminiError('La chiave Gemini non è valida o non è attiva. Controllala nelle Opzioni.', 'key');
  if (r.status === 404) return new GeminiError('Modello Gemini non trovato.', 'notfound');
  if (r.status >= 500) return new GeminiError('Gemini è momentaneamente sovraccarico. Riprova tra poco.', 'server');
  return new GeminiError(msg || `Errore Gemini (${r.status})`, 'http' + r.status);
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING' },
          marca: { type: 'STRING' },
          quantita: { type: 'NUMBER' },
          unita: { type: 'STRING', enum: ['pz', 'conf', 'g', 'kg', 'ml', 'l'] },
          tipo: { type: 'STRING' },
          posto: { type: 'STRING', enum: ['frigo', 'freezer', 'dispensa'] },
          scadenza: { type: 'STRING' },
          scadenza_stimata: { type: 'BOOLEAN' },
          macro: { type: 'STRING', enum: ['proteine', 'carboidrati', 'grassi', 'fibre', 'nessuno'] },
          kcal_100: { type: 'NUMBER' },
          proteine_100: { type: 'NUMBER' },
          carboidrati_100: { type: 'NUMBER' },
          grassi_100: { type: 'NUMBER' },
        },
        required: ['nome', 'quantita', 'unita', 'tipo', 'posto', 'scadenza', 'scadenza_stimata'],
      },
    },
  },
  required: ['items'],
};

async function callOnce(key, model, parts, withSchema, schema = SCHEMA, search = false) {
  // con la ricerca Google attiva, Gemini non accetta il formato JSON obbligato: lo chiedo nel testo
  const generationConfig = search ? {} : { responseMimeType: 'application/json' };
  if (withSchema && !search) generationConfig.responseSchema = schema;
  const extra = search ? { tools: [{ google_search: {} }] } : {};
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig, ...extra }),
  });
  if (!r.ok) throw await toError(r);
  const data = await r.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new GeminiError('Gemini non ha risposto nulla. Riprova.', 'empty');
  return text;
}

async function generate(key, parts, schema = SCHEMA, search = false) {
  if (!key) throw new GeminiError('Manca la chiave Gemini: aggiungila nelle Opzioni.', 'nokey');
  const tried = new Set();
  const candidates = [savedModel(), ...DEFAULT_MODELS].filter(Boolean);
  let lastErr;
  for (let i = 0; i <= candidates.length; i++) {
    let model = candidates[i];
    if (i === candidates.length) {
      model = await discoverModel(key); // ultima spiaggia
    }
    if (!model || tried.has(model)) continue;
    tried.add(model);
    try {
      let text;
      try {
        text = await callOnce(key, model, parts, true, schema, search);
      } catch (e) {
        // alcuni modelli rifiutano lo schema: riprova chiedendo solo JSON
        if (e.code === 'http400' && !search) text = await callOnce(key, model, parts, false, schema);
        else throw e;
      }
      saveModel(model);
      return text;
    } catch (e) {
      lastErr = e;
      if (e.code !== 'notfound' && e.code !== 'http400') throw e;
    }
  }
  throw lastErr || new GeminiError('Gemini non disponibile.', 'unknown');
}

function parseJSON(text) {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new GeminiError('Non ho capito la risposta di Gemini. Riprova.', 'parse');
  }
}

const TIPI = CATALOG.map((f) => `${f.key} (${f.name})`).join(', ');

const RULES = `Rispondi SOLO con JSON nella forma {"items":[{"nome","marca","quantita","unita","tipo","posto","scadenza","scadenza_stimata"}]}.
Regole per ogni alimento:
- "nome": nome breve e chiaro in italiano, con l'iniziale maiuscola, senza marca e senza quantità (es. "Latte parzialmente scremato").
- "marca": la marca se la conosci, altrimenti "".
- "quantita" e "unita": unita è una tra pz, conf, g, kg, ml, l. Se non è detto, usa quantita 1 e l'unità più naturale.
- "tipo": la chiave più adatta presa ESATTAMENTE da questo elenco (la parte prima della parentesi), oppure "altro": ${TIPI}.
- "posto": dove si conserva di solito: frigo, freezer o dispensa.
- "scadenza": data AAAA-MM-GG. Se l'utente la dice o è leggibile, usa quella e metti "scadenza_stimata": false. Se non c'è, stima una data realistica partendo da oggi per quel prodotto conservato in quel posto e metti "scadenza_stimata": true. Se il prodotto non scade in pratica (sale, zucchero), usa "".
- Ignora tutto ciò che non si mangia o non si beve (detersivi, sacchetti, sconti, totali, punti fedeltà).
- Se lo stesso prodotto compare più volte, unisci le righe sommando la quantità.
- "macro": il macronutriente principale (proteine, carboidrati, grassi, fibre per verdure e simili poco caloriche; nessuno per acqua, sale, spezie, caffè, alcolici).
- "kcal_100", "proteine_100", "carboidrati_100", "grassi_100": valori tipici per 100 g (o 100 ml) di quel prodotto, arrotondati.`;

function toDrafts(json) {
  const list = Array.isArray(json) ? json : json.items || [];
  return list
    .filter((x) => x && x.nome)
    .map((x) =>
      makeDraft({
        name: x.nome,
        brand: x.marca,
        qty: x.quantita,
        unit: x.unita,
        foodKey: x.tipo,
        loc: x.posto,
        expiry: x.scadenza,
        est: x.scadenza_stimata,
        macro: x.macro,
        nutr: { kcal: x.kcal_100, p: x.proteine_100, c: x.carboidrati_100, f: x.grassi_100 },
      })
    );
}

export async function itemsFromText(key, text) {
  const prompt = `Sei l'assistente di un'app per la dispensa di casa. Oggi è ${todayISO()}.
L'utente ha scritto o dettato velocemente cosa ha appena messo in frigo, freezer o dispensa. Estrai l'elenco degli alimenti.
Se dice un giorno senza mese ("scade il 20"), intendi la prossima data con quel giorno.
${RULES}

Testo dell'utente:
"""${text}"""`;
  return toDrafts(parseJSON(await generate(key, [{ text: prompt }])));
}

export async function itemsFromReceipt(key, base64, mime) {
  const prompt = `Sei l'assistente di un'app per la dispensa di casa. Oggi è ${todayISO()}.
Questa è la foto di uno scontrino del supermercato italiano (oppure della spesa appena fatta). Estrai gli alimenti e le bevande comprati.
Sugli scontrini i nomi sono abbreviati: scrivili per esteso (es. "MOZZ S.LUCIA 125G" diventa nome "Mozzarella", marca "Santa Lucia", quantita 125, unita "g").
Se una riga indica più pezzi (es. "2 x 1,29"), usa quel numero come quantità in pz o conf.
Le scadenze di solito non ci sono: stimale considerando la spesa fatta oggi.
${RULES}`;
  return toDrafts(parseJSON(await generate(key, [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }])));
}

// Usato dal tasto "Prova la chiave" nelle Opzioni
export async function testKey(key) {
  const text = await generate(key, [{ text: `Oggi è ${todayISO()}. Testo dell'utente: "una mela".\n${RULES}` }]);
  parseJSON(text);
  return savedModel();
}

export const forgetModel = () => saveModel('');

// Rimpicciolisce la foto prima di spedirla (più veloce e consuma meno)
export function fileToJpegBase64(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Non riesco a leggere questa foto.'));
    };
    img.src = url;
  });
}

// Ultima spiaggia per i codici a barre: Gemini legge le cifre stampate sotto le barre
export async function readBarcodeDigits(key, base64, mime) {
  const schema = { type: 'OBJECT', properties: { codice: { type: 'STRING' } }, required: ['codice'] };
  const prompt = `Nella foto c'è il codice a barre di un prodotto alimentare. Leggi le cifre stampate sotto le barre (EAN-13, EAN-8 o UPC) e rispondi SOLO con JSON {"codice":"..."} con le sole cifre, senza spazi. Se non riesci a leggerle tutte con sicurezza, rispondi {"codice":""}.`;
  const json = parseJSON(await generate(key, [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }], schema));
  return String(json.codice || '').replace(/\D/g, '');
}

// Prodotto non presente in Open Food Facts: Gemini cerca il codice su Google
export async function lookupBarcodeOnline(key, code) {
  const prompt = `Cerca su internet il prodotto con codice a barre ${code} (EAN/UPC; può essere un prodotto italiano, europeo o statunitense).
Rispondi SOLO con JSON, senza altro testo: {"trovato": true/false, "nome": "...", "marca": "...", "quantita": numero, "unita": "pz|conf|g|kg|ml|l", "tipo": "...", "macro": "proteine|carboidrati|grassi|fibre|nessuno", "kcal_100": n, "proteine_100": n, "carboidrati_100": n, "grassi_100": n}
- Metti "trovato": true SOLO se le fonti indicano proprio questo codice. Non indovinare: se non sei sicuro, "trovato": false.
- "nome": nome breve in italiano del prodotto (traducilo se è in inglese, es. "Peanut Butter" diventa "Burro di arachidi"), senza marca e senza quantità.
- Converti once e libbre: "quantita" in g (1 oz = 28 g, 1 lb = 454 g) o in ml (1 fl oz = 30 ml).
- "tipo": la chiave più adatta presa ESATTAMENTE da questo elenco, oppure "altro": ${TIPI}.`;
  const json = parseJSON(await generate(key, [{ text: prompt }], SCHEMA, true));
  if (!json || !json.trovato || !json.nome) return null;
  return makeDraft({ name: json.nome, brand: json.marca, qty: json.quantita, unit: json.unita, foodKey: json.tipo, macro: json.macro, nutr: { kcal: json.kcal_100, p: json.proteine_100, c: json.carboidrati_100, f: json.grassi_100 } });
}

// Classifica in un colpo solo i cibi già in dispensa: macronutriente e valori per 100 g
export async function classifyItems(key, items) {
  const schema = {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            macro: { type: 'STRING', enum: ['proteine', 'carboidrati', 'grassi', 'fibre', 'nessuno'] },
            kcal_100: { type: 'NUMBER' },
            proteine_100: { type: 'NUMBER' },
            carboidrati_100: { type: 'NUMBER' },
            grassi_100: { type: 'NUMBER' },
          },
          required: ['id', 'macro'],
        },
      },
    },
    required: ['items'],
  };
  const list = items.map((i) => `${i.id} | ${i.name}${i.brand ? ' (' + i.brand + ')' : ''}`).join('\n');
  const prompt = `Per ogni alimento dell'elenco (formato "id | nome"), indica il macronutriente principale e i valori nutrizionali tipici per 100 g (o 100 ml).
"macro": proteine, carboidrati, grassi, fibre (verdure e simili poco caloriche) oppure nessuno (acqua, sale, spezie, caffè, tè, alcolici).
Rispondi SOLO con JSON {"items":[{"id","macro","kcal_100","proteine_100","carboidrati_100","grassi_100"}]} usando gli stessi id.

${list}`;
  const json = parseJSON(await generate(key, [{ text: prompt }], schema));
  const out = {};
  for (const x of json.items || []) {
    if (!x || !x.id) continue;
    out[x.id] = { macro: x.macro === 'nessuno' ? null : x.macro, nutr: cleanNutr({ kcal: x.kcal_100, p: x.proteine_100, c: x.carboidrati_100, f: x.grassi_100 }) };
  }
  return out;
}

// Offerte lette da un volantino (foto, screenshot o PDF)
export async function offersFromFlyer(key, files, { store = '', until = '' } = {}) {
  const schema = {
    type: 'OBJECT',
    properties: {
      negozio: { type: 'STRING' },
      valido_fino: { type: 'STRING' },
      offerte: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            nome: { type: 'STRING' },
            marca: { type: 'STRING' },
            prezzo: { type: 'NUMBER' },
            prezzo_prima: { type: 'NUMBER' },
            formato: { type: 'STRING' },
            tipo: { type: 'STRING' },
          },
          required: ['nome', 'prezzo'],
        },
      },
    },
    required: ['offerte'],
  };
  const prompt = `Sei l'assistente di un'app per la spesa. Oggi è ${todayISO()}.
Ecco ${files.length > 1 ? 'alcune pagine di un volantino' : 'un volantino'} di un supermercato italiano. Estrai SOLO le offerte di cibo e bevande (ignora detersivi, casa, elettronica, abbigliamento).
Rispondi SOLO con JSON {"negozio": "...", "valido_fino": "AAAA-MM-GG", "offerte": [{"nome","marca","prezzo","prezzo_prima","formato","tipo"}]}.
- "negozio": la catena (es. Conad, Esselunga, Lidl)${store ? `; l'utente dice che è "${store}"` : ''}.
- "valido_fino": l'ultimo giorno di validità del volantino se è scritto${until ? ` (l'utente dice ${until})` : ''}, altrimenti "".
- "nome": nome breve in italiano senza marca (es. "Mozzarella"); "marca": la marca o "".
- "prezzo": prezzo in offerta in euro (numero); "prezzo_prima": prezzo pieno se indicato, altrimenti 0.
- "formato": quantità della confezione come scritta (es. "125 g", "6 x 1,5 l"), altrimenti "".
- "tipo": la chiave più adatta presa ESATTAMENTE da questo elenco, oppure "altro": ${TIPI}.`;
  const parts = [{ text: prompt }, ...files.map((f) => ({ inline_data: { mime_type: f.mime, data: f.base64 } }))];
  const json = parseJSON(await generate(key, parts, schema));
  return {
    store: String(json.negozio || store || '').trim(),
    until: /^\d{4}-\d{2}-\d{2}$/.test(json.valido_fino || '') ? json.valido_fino : until || '',
    offers: (json.offerte || []).filter((o) => o && o.nome && Number(o.prezzo) > 0),
  };
}

// Legge un PDF come base64 (per i volantini scaricati dal sito del supermercato)
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ base64: String(r.result).split(',')[1], mime: file.type || 'application/pdf' });
    r.onerror = () => reject(new Error('Non riesco a leggere il file.'));
    r.readAsDataURL(file);
  });
}
