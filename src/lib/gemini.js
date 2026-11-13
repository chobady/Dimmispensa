// Chiamate a Google Gemini (testo e foto dello scontrino) direttamente dal browser.
// La chiave la inserisci tu nelle Opzioni dell'app: non è mai scritta nel codice.
import { CATALOG } from '../catalog.js';
import { todayISO } from './dates.js';
import { makeDraft } from './items.js';

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
        },
        required: ['nome', 'quantita', 'unita', 'tipo', 'posto', 'scadenza', 'scadenza_stimata'],
      },
    },
  },
  required: ['items'],
};

async function callOnce(key, model, parts, withSchema) {
  const generationConfig = { responseMimeType: 'application/json' };
  if (withSchema) generationConfig.responseSchema = SCHEMA;
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
  });
  if (!r.ok) throw await toError(r);
  const data = await r.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new GeminiError('Gemini non ha risposto nulla. Riprova.', 'empty');
  return text;
}

async function generate(key, parts) {
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
        text = await callOnce(key, model, parts, true);
      } catch (e) {
        // alcuni modelli rifiutano lo schema: riprova chiedendo solo JSON
        if (e.code === 'http400') text = await callOnce(key, model, parts, false);
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
- Se lo stesso prodotto compare più volte, unisci le righe sommando la quantità.`;

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
