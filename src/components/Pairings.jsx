import { useMemo } from 'react';
import { itemPairKeys, pairIcon, pairLabel, pairsFor } from '../lib/mela.js';
import { Icon, useApp } from './ui.jsx';

// "Sta bene con": ingredienti che compaiono spesso insieme a questo nelle ricette importate da Mela
export default function Pairings({ item }) {
  const { state } = useApp();
  const recipes = state.recipes || [];
  const pairs = useMemo(() => pairsFor(item, recipes, 10), [item.food, item.name, recipes]);
  const have = useMemo(() => {
    const s = new Set();
    for (const it of state.items) if (it.id !== item.id) itemPairKeys(it).forEach((k) => s.add(k));
    return s;
  }, [state.items, item.id]);
  if (!recipes.length) return null;
  if (!pairs.length) return null;
  const has = (key) => have.has(key) || (!key.includes(':') && [...have].some((h) => h.startsWith(key + ':')));
  const mine = pairs.filter((p) => has(p.key));
  return (
    <div className="pairings">
      <b>Sta bene con</b>
      <div className="pair-chips">
        {pairs.map((p) => (
          <span key={p.key} className={'pair ' + (has(p.key) ? 'have' : '')} title={`insieme in ${p.n} ricette`}>
            <Icon id={pairIcon(p.key)} size={18} className="inline" /> {pairLabel(p.key)}
            {has(p.key) && <span className="ok" aria-label="ce l'hai"> ✓</span>}
          </span>
        ))}
      </div>
      <p className="small muted">
        {mine.length ? `In casa hai già ${mine.length === 1 ? pairLabel(mine[0].key).toLowerCase() : mine.length + ' di questi'} (✓). ` : ''}
        Abbinamenti presi dalle tue {recipes.length} ricette di Mela.
      </p>
    </div>
  );
}
