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

// ---- stato delle richieste gratuite (per mostrarlo nelle Opzioni) ----
const LS_STATUS = 'dm_gemini_status';
export function geminiStatus() {
  try {
    return JSON.parse(localStorage.getItem(LS_STATUS) || 'null');
  } catch {
    return null;
  }
}
const setStatus = (kind, extra = {}) => {
  try {
    localStorage.setItem(LS_STATUS, JSON.stringify({ kind, at: Date.now(), ...extra }));
  } catch {}
};
// le richieste gratuite di Gemini si ricaricano a mezzanotte in California
export function quotaResetAt(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
  const mins = 24 * 60 - (Number(p.hour) * 60 + Number(p.minute));
  return new Date(now.getTime() + mins * 60000);
}
const hhmm = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

async function toError(r) {
  let msg = '';
  let body = null;
  try {
    body = await r.json();
    msg = body?.error?.message || '';
  } catch {}
  if (r.status === 429) {
    const details = body?.error?.details || [];
    const ids = details.flatMap((d) => (d.violations || []).map((v) => String(v.quotaId || v.quotaMetric || ''))).join(' ');
    const retry = details.map((d) => d.retryDelay).find(Boolean);
    const secs = retry ? Math.ceil(parseFloat(retry)) : 0;
    if (/per ?day/i.test(ids) || /per day|daily/i.test(msg)) {
      const at = quotaResetAt();
      setStatus('day', { reset: at.getTime() });
      return new GeminiError(`Gemini ha finito le richieste gratuite di oggi. Si ricaricano verso le ${hhmm(at)}.`, 'quota-day');
    }
    setStatus('minute');
    return new GeminiError(`Troppe richieste a Gemini in poco tempo: riprova tra ${secs > 0 && secs < 600 ? secs + ' secondi' : 'un minuto'}.`, 'quota');
  }
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
          posto: { type: 'STRING', enum: ['frigo', 'freezer', 'dispensa', 'spezie', 'casa'] },
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
      setStatus('ok', { model });
      return text;
    } catch (e) {
      lastErr = e;
      // finite le richieste di oggi su questo modello: provo il successivo (ognuno ha le sue)
      if (e.code !== 'notfound' && e.code !== 'http400' && e.code !== 'quota-day') throw e;
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
- "posto": dove si conserva di solito: frigo, freezer, dispensa, spezie (spezie ed erbe secche, pepe) o casa (prodotti per la casa).
- "scadenza": data AAAA-MM-GG. Se l'utente la dice o è leggibile, usa quella e metti "scadenza_stimata": false. Se non c'è, stima una data realistica partendo da oggi per quel prodotto conservato in quel posto e metti "scadenza_stimata": true. Se il prodotto non scade in pratica (sale, zucchero), usa "".
- I prodotti per la casa (detersivi, ammorbidente, pastiglie e sale per lavastoviglie, spugne, carta forno, alluminio, carta igienica, carta cucina, sacchetti, prodotti per pulire, sapone) vanno inclusi con "posto": "casa", il "tipo" adatto dall'elenco, "scadenza": "" e "macro": "nessuno". Ignora le buste della spesa, sconti, totali, punti fedeltà.
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
  const prompt = `Cerca su internet il prodotto con codice a barre ${code} (EAN/UPC; può essere un prodotto italiano, europeo o statunitense; può essere un cibo oppure un prodotto per la casa o per l'igiene: detersivo, ammorbidente, pastiglie lavastoviglie, carta, sapone, shampoo...).
Cerca il codice anche su siti di supermercati e cataloghi di prodotti (es. "${code}" + ean).
Rispondi SOLO con JSON, senza altro testo: {"trovato": true/false, "nome": "...", "marca": "...", "quantita": numero, "unita": "pz|conf|g|kg|ml|l", "tipo": "...", "macro": "proteine|carboidrati|grassi|fibre|nessuno", "kcal_100": n, "proteine_100": n, "carboidrati_100": n, "grassi_100": n}
- Metti "trovato": true SOLO se le fonti indicano proprio questo codice. Non indovinare: se non sei sicuro, "trovato": false.
- "nome": nome breve in italiano del prodotto (traducilo se è in inglese, es. "Peanut Butter" diventa "Burro di arachidi"), senza marca e senza quantità.
- Converti once e libbre: "quantita" in g (1 oz = 28 g, 1 lb = 454 g) o in ml (1 fl oz = 30 ml).
- "tipo": la chiave più adatta presa ESATTAMENTE da questo elenco, oppure "altro": ${TIPI}.
- Per i prodotti per la casa e l'igiene: "macro": "nessuno" e niente valori nutrizionali.`;
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

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ base64: String(r.result).split(',')[1], mime: file.type || 'application/pdf' });
    r.onerror = () => reject(new Error('Non riesco a leggere il file.'));
    r.readAsDataURL(file);
  });
}

// Ricetta da una pagina web che non pubblica i dati della ricetta: Gemini legge il testo della pagina
export async function recipeFromPage(key, pageText, url) {
  const prompt = `Questo è il testo di una pagina web (${url}). Se contiene una ricetta di cucina, estraila.
Rispondi SOLO con JSON: {"ricetta": true/false, "titolo": "...", "descrizione": "...", "ingredienti": ["..."], "procedimento": ["passo 1", "passo 2"], "porzioni": "...", "preparazione": "...", "cottura": "..."}
- "ingredienti": una riga per ingrediente con quantità, come scritto nella pagina (per i gruppi usa una riga "# Per l'impasto"). Lascia la lingua originale.
- "procedimento": i passi nell'ordine, testo come nella pagina, senza numeri davanti.
- "porzioni": es. "4 persone"; tempi come "20 minuti"; "" se non ci sono.
- Non inventare niente: se la pagina non ha una ricetta, "ricetta": false.

Testo della pagina:
"""${String(pageText).slice(0, 18000)}"""`;
  const j = parseJSON(await generate(key, [{ text: prompt }]));
  if (!j || !j.ricetta || !Array.isArray(j.ingredienti) || !j.ingredienti.length) return null;
  const arr = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
  return {
    title: String(j.titolo || '').trim(),
    text: String(j.descrizione || '').trim(),
    ingredients: arr(j.ingredienti),
    instructions: arr(j.procedimento).join('\n'),
    yield: String(j.porzioni || '').trim(),
    prepTime: String(j.preparazione || '').trim(),
    cookTime: String(j.cottura || '').trim(),
  };
}

// ---- Consiglio del giorno: cosa mangiare oggi con quello che c'è in casa ----
const DAY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pasti: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pasto: { type: 'STRING', enum: ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena'] },
          piatto: { type: 'STRING' },
          ingredienti: { type: 'ARRAY', items: { type: 'STRING' } },
          proteine_g: { type: 'NUMBER' },
          verdure_g: { type: 'NUMBER' },
        },
        required: ['pasto', 'piatto', 'ingredienti', 'proteine_g', 'verdure_g'],
      },
    },
    proteine_tot: { type: 'NUMBER' },
    verdure_tot: { type: 'NUMBER' },
    kcal_tot: { type: 'NUMBER' },
    regole: { type: 'ARRAY', items: { type: 'STRING' } },
    fabbisogno: { type: 'STRING' },
    consiglio: { type: 'STRING' },
    da_comprare: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['pasti', 'proteine_tot', 'verdure_tot', 'consiglio', 'da_comprare'],
};
// pantry: righe di testo già pronte
// diet: testo del file di una dieta (da un libro), tenuto solo sul dispositivo; può mancare
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ACT = {
  sedentario: 'sedentario (lavoro seduto, si sposta in auto, niente sport)',
  poco: 'poco attivo (lavoro in movimento o qualche camminata)',
  attivo: 'attivo (in movimento tutto il giorno o sport quasi ogni giorno)',
  molto: 'molto attivo (lavoro pesante o sport intenso tutti i giorni)',
};
const GOAL = { dimagrire: 'perdere grasso', mantenere: 'mantenere il peso', massa: 'aumentare la massa muscolare', salute: 'stare in salute' };
// dati della persona (solo sul dispositivo): servono alle formule dei libri
const personBlock = (p) => {
  if (!p || !(p.peso || p.altezza || p.eta || p.oggi)) return '';
  const r = [];
  if (p.sesso) r.push(`sesso: ${p.sesso === 'f' ? 'donna' : 'uomo'}`);
  if (p.eta) r.push(`età: ${p.eta} anni`);
  if (p.peso) r.push(`peso: ${p.peso} kg`);
  if (p.altezza) r.push(`altezza: ${p.altezza} cm`);
  if (p.grasso) r.push(`massa grassa: ${p.grasso}%`);
  if (p.attivita) r.push(`attività quotidiana: ${ACT[p.attivita] || p.attivita}`);
  if (p.passi) r.push(`passi al giorno: circa ${p.passi}`);
  if (p.allenamenti) r.push(`allenamenti a settimana: ${p.allenamenti}${p.sport ? ` (${p.sport})` : ''}`);
  if (p.obiettivo) r.push(`obiettivo: ${GOAL[p.obiettivo] || p.obiettivo}`);
  if (p.note) r.push(`note dell'utente: ${p.note}`);
  const o = p.oggi;
  if (o) {
    // risposte di oggi: contano più della routine abituale
    const MOV = { poco: 'poco (quasi sempre seduto)', normale: 'normale', tanto: 'tanto (in piedi o a piedi gran parte del giorno)' };
    r.push(
      o.allena
        ? `OGGI SI ALLENA: ${o.sport || 'allenamento'}${o.durata ? `, circa ${o.durata} minuti` : ''}${o.intensita ? `, intensità ${o.intensita}` : ''}${o.quando ? `, ${o.quando}` : ''}`
        : 'OGGI NON SI ALLENA (giorno di riposo)'
    );
    if (o.movimento) r.push(`movimento di oggi oltre all'allenamento: ${MOV[o.movimento] || o.movimento}`);
  }
  return `

DATI DELL'UTENTE (usali con le formule e le tabelle dei libri, o con quelle standard se non ci sono libri, per calcolare calorie e grammi di oggi):
${r.map((x) => '- ' + x).join('\n')}
Le informazioni su OGGI (allenamento sì o no, tipo, durata, intensità, momento, movimento) le ha date l'utente adesso: valgono più della routine abituale. Adatta calorie e carboidrati come dicono i libri per i giorni di allenamento o di riposo e, se si allena, metti più carboidrati nel pasto dopo l'allenamento.
In "fabbisogno" scrivi in una riga come hai calcolato le calorie di oggi (formula usata e risultato); "kcal_tot" sono le calorie del menu.`;
};
const dietBlock = (diet) => {
  if (!diet) return '';
  let out = personBlock(diet.person);
  if (diet.text)
    out += `

DIETA DA SEGUIRE (dal libro dell'utente, in JSON o testo: interpretala tu). Rispetta cibi permessi e vietati, porzioni, abbinamenti e fasi. Se è divisa in giorni o settimane, oggi è ${WEEKDAYS[new Date().getDay()]}${diet.day ? ` e l'utente è al giorno ${diet.day} della dieta` : ''}: usa il giorno corrispondente.
"""
${String(diet.text).slice(0, 60000)}
"""`;
  // libri di principi (linee guida generali, non un menu giorno per giorno): orientano scelte, quantità e spesa
  (diet.guides || []).forEach((g) => {
    out += `

LIBRO "${g.name}" (scelto dall'utente; vanno seguiti TUTTI i libri insieme, non uno solo): usalo per scegliere cibi, quantità, condimenti, cotture, abbinamenti e cosa comprare. Se contiene una dieta divisa in giorni o settimane, oggi è ${WEEKDAYS[new Date().getDay()]}. Se due libri si contraddicono, scegli l'indicazione più prudente e dillo in breve nel consiglio. Le parti su malattie valgono solo se l'utente ne soffre.
"""
${String(g.text).slice(0, 70000)}
"""`;
  });
  return out;
};
export async function dayPlan(key, pantry, diet = null) {
  const books = diet && (diet.text || diet.guides?.length);
  const prompt = `Sei un nutrizionista pratico. Proponi cosa mangiare OGGI usando soprattutto quello che c'è in casa.
${
  books
    ? `Segui TUTTI i libri dell'utente qui sotto, insieme: da lì prendi calorie, quantità di proteine, carboidrati, grassi, verdure e frutta, porzioni, cibi da preferire e da limitare, condimenti e cotture. Non inventare obiettivi diversi da quelli dei libri.
Prima di rispondere ricontrolla ogni ingrediente con i libri: se un libro lo sconsiglia o dice di limitarlo (per esempio un olio o un taglio di carne che i libri sconsigliano), NON usarlo anche se è in casa: metti l'alternativa indicata dai libri e segnala "(da comprare)". In "regole" elenca le regole dei libri che hai applicato, ognuna con il nome del libro tra parentesi.`
    : `Segui una dieta mediterranea equilibrata secondo le linee guida italiane: verdura e frutta abbondanti, cereali integrali, legumi, pesce, olio extravergine misurato, pochi zuccheri, sale e grassi saturi.`
}
Regole:
- Usa prima i cibi che scadono presto. Porzioni realistiche per una persona, in grammi.
- 3 pasti principali più gli spuntini che servono.
- "ingredienti": righe brevi con quantità, es. "Petto di pollo 150 g". Indica con "(da comprare)" quello che non c'è in casa.
- "proteine_g" e "verdure_g": stime per quel pasto (grammi di proteine come nutriente, grammi di verdura come peso); "proteine_tot" e "verdure_tot": somme della giornata.
- "kcal_tot": calorie stimate di tutto il menu.
- "consiglio": una o due frasi pratiche (es. cosa preparare in anticipo, o quale principio dei libri hai seguito).
- "da_comprare": solo le cose che mancano per questo menu, nomi brevi in italiano.
Rispondi in italiano, solo JSON.${dietBlock(diet)}

In casa c'è:
${pantry || '(niente)'}`;
  const j = parseJSON(await generate(key, [{ text: prompt }], DAY_SCHEMA));
  if (!j || !Array.isArray(j.pasti) || !j.pasti.length) throw new GeminiError('Gemini non ha proposto un menu. Riprova.', 'parse');
  return j;
}

// ---- Spesa secondo la dieta: cosa comprare per i prossimi giorni ----
const SHOP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    spesa: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING' },
          quantita: { type: 'NUMBER' },
          unita: { type: 'STRING', enum: ['pz', 'conf', 'g', 'kg', 'ml', 'l'] },
          perche: { type: 'STRING' },
        },
        required: ['nome', 'quantita', 'unita'],
      },
    },
    nota: { type: 'STRING' },
  },
  required: ['spesa'],
};
export async function dietShopping(key, pantry, diet, days = 7) {
  // la spesa non ha bisogno della riga sul fabbisogno: basta che le quantità tengano conto dei dati
  const prompt = `Prepara la lista della spesa per i prossimi ${days} giorni seguendo la dieta e/o i principi qui sotto, per una persona.
- Togli quello che c'è già in casa in quantità sufficiente (sotto c'è la dispensa).
- Quantità realistiche da supermercato italiano (es. 500 g, 1 kg, 6 pz, 1 conf). Raggruppa (un solo "Petto di pollo 1 kg", non sette righe).
- "nome": breve, in italiano, senza marca. "perche": a cosa serve, in poche parole (es. "pranzi di lun-mer").
- "nota": una frase su come organizzarsi (facoltativa).
Rispondi solo JSON.${dietBlock(diet)}

In casa c'è:
${pantry || '(niente)'}`;
  const j = parseJSON(await generate(key, [{ text: prompt }], SHOP_SCHEMA));
  if (!j || !Array.isArray(j.spesa)) throw new GeminiError('Gemini non ha preparato la lista. Riprova.', 'parse');
  return j;
}
