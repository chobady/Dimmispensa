import { useMemo } from 'react';
import { FLAVOR } from '../flavor-data.js';
import { itemPairKeys, pairIcon, pairLabel, pairsFor } from '../lib/mela.js';
import { Icon, useApp } from './ui.jsx';

// cibi del catalogo che nel Flavor Network hanno lo stesso "sapore" di un altro
const ALIAS = { melaverde: 'mela', cosce: 'petto', alette: 'petto', pollointero: 'petto', cotoletta: 'petto', costata: 'bistecca', hamburger: 'macinato', spaghetti: 'farina', pasta: 'farina', baguette: 'pane', bastoncini: 'pesce', lattevegetale: 'latte', passata: 'pomodoro', pelati: 'pomodoro' };
function flavorKeys(item) {
  const out = [];
  for (const k of itemPairKeys(item)) {
    out.push(k);
    const [base, kw] = k.split(':');
    if (ALIAS[base]) out.push(ALIAS[base]);
    // "origano secco" → origano
    if (base === 'erbesecche' && kw) out.push('erbe:' + kw.replace(/\s+secc[oa]$/, ''));
  }
  return out.filter((k) => FLAVOR[k]);
}

function useHave(items, selfId) {
  return useMemo(() => {
    const s = new Set();
    for (const it of items) if (it.id !== selfId) [...itemPairKeys(it), ...flavorKeys(it)].forEach((k) => s.add(k));
    return s;
  }, [items, selfId]);
}

function Chips({ list, has }) {
  return (
    <div className="pair-chips">
      {list.map((p) => (
        <span key={p.key} className={'pair ' + (has(p.key) ? 'have' : '')} title={p.title}>
          <Icon id={pairIcon(p.key)} size={18} className="inline" /> {pairLabel(p.key)}
          {has(p.key) && <span className="ok" aria-label="ce l'hai"> ✓</span>}
        </span>
      ))}
    </div>
  );
}

// "Sta bene con": dalle ricette importate da Mela e dalla chimica degli aromi (Flavor Network)
export default function Pairings({ item }) {
  const { state } = useApp();
  const recipes = state.recipes || [];
  const fromRecipes = useMemo(() => pairsFor(item, recipes, 10).map((p) => ({ ...p, title: `insieme in ${p.n} ricette` })), [item.food, item.name, recipes]);
  const fromAroma = useMemo(() => {
    const seen = new Set([...itemPairKeys(item), ...fromRecipes.map((p) => p.key)]);
    const out = [];
    for (const k of flavorKeys(item))
      for (const [b, n] of FLAVOR[k] || []) {
        if (seen.has(b)) continue;
        seen.add(b);
        out.push({ key: b, title: `${n} molecole aromatiche in comune` });
      }
    return out.slice(0, 10);
  }, [item.food, item.name, fromRecipes]);
  const have = useHave(state.items, item.id);
  if (!fromRecipes.length && !fromAroma.length) return null;
  const has = (key) => have.has(key) || (!key.includes(':') && [...have].some((h) => h.startsWith(key + ':')));
  const mine = [...fromRecipes, ...fromAroma].filter((p) => has(p.key)).length;
  return (
    <div className="pairings">
      <b>Sta bene con</b>
      {fromRecipes.length > 0 && (
        <>
          <span className="small muted">Nelle tue {recipes.length} ricette di Mela</span>
          <Chips list={fromRecipes} has={has} />
        </>
      )}
      {fromAroma.length > 0 && (
        <>
          <span className="small muted">Per aromi in comune (abbinamenti a volte sorprendenti)</span>
          <Chips list={fromAroma} has={has} />
        </>
      )}
      <p className="small muted">
        {mine ? `✓ = ce l'hai già in casa (${mine}). ` : ''}
        Aromi: Flavor Network, Ahn et al., Scientific Reports 2011.
      </p>
    </div>
  );
}
