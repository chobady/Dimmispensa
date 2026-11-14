// Valori nutrizionali: PRIMA l'etichetta (Open Food Facts), e SOLO se manca Gemini.
import { classifyItems } from './gemini.js';
import { macroFromNutr } from './items.js';
import { labelByCode, labelByName } from './off.js';

// L'etichetta è "completa" se ha proteine, carboidrati e grassi
export const nutrComplete = (n) => !!n && n.p !== null && n.c !== null && n.f !== null;

// Applica dei valori a un cibo: il macronutriente viene ricalcolato dai valori
export function withNutr(x, nutr, src) {
  const m = macroFromNutr(nutr);
  return { ...x, nutr, nutrSrc: src, ...(m !== undefined ? { macro: m } : {}) };
}

// Unisce: i valori dell'etichetta restano, Gemini riempie solo i buchi
function merge(label, gem) {
  if (!label) return gem;
  const out = { ...label };
  for (const k of ['kcal', 'p', 'c', 'f']) if (out[k] === null && gem && gem[k] !== null) out[k] = gem[k];
  return out;
}

/**
 * Completa i valori nutrizionali di una lista di cibi (bozze o cibi in dispensa).
 * 1) etichetta dal codice a barre, 2) etichetta cercata per marca + nome, 3) Gemini per quello che resta.
 * Restituisce { lista aggiornata, conteggi }.
 */
export async function fillNutrition(list, geminiKey, { byCode = true, byName = true, maxName = 12, onStep } = {}) {
  const out = list.map((x) => ({ ...x }));
  const stats = { etichetta: 0, gemini: 0 };
  let nameSearches = 0; // Open Food Facts limita le ricerche per nome: ne faccio al massimo maxName
  for (let i = 0; i < out.length; i++) {
    const x = out[i];
    if (x.nutrSrc === 'etichetta' && nutrComplete(x.nutr)) continue;
    let label = x.nutrSrc === 'etichetta' ? x.nutr : null;
    try {
      if (!nutrComplete(label) && byCode && x.code) {
        onStep && onStep(`Leggo l'etichetta di ${x.name}...`);
        label = (await labelByCode(x.code)) || label;
      }
      if (!nutrComplete(label) && byName && x.brand && nameSearches < maxName) {
        nameSearches++;
        onStep && onStep(`Cerco l'etichetta di ${x.name}...`);
        label = (await labelByName(x.name, x.brand)) || label;
      }
    } catch {}
    if (nutrComplete(label)) {
      out[i] = withNutr(x, label, 'etichetta');
      stats.etichetta++;
    } else if (label) {
      out[i] = { ...x, _partial: label };
    }
  }
  // Gemini SOLO per chi non ha un'etichetta completa e non ha già una stima di Gemini
  const need = out.filter((x) => !(x.nutrSrc === 'etichetta' && nutrComplete(x.nutr)) && !(x.nutrSrc === 'gemini' && x.nutr));
  if (need.length && geminiKey) {
    onStep && onStep('Chiedo a Gemini i valori che mancano...');
    for (let k = 0; k < need.length; k += 40) {
      const part = need.slice(k, k + 40);
      let res = {};
      try {
        res = await classifyItems(geminiKey, part.map((x) => ({ id: x.id, name: x.name, brand: x.brand })));
      } catch (e) {
        if (!stats.gemini && !stats.etichetta) throw e;
      }
      for (const x of part) {
        const r = res[x.id];
        const idx = out.findIndex((y) => y.id === x.id);
        if (!r) continue;
        const merged = merge(x._partial, r.nutr);
        out[idx] = merged ? withNutr(out[idx], merged, x._partial ? 'misto' : 'gemini') : { ...out[idx], macro: r.macro ?? null };
        if (!merged && r.macro === null) out[idx].macro = null;
        stats.gemini++;
      }
    }
  }
  out.forEach((x) => delete x._partial);
  return { list: out, stats };
}
