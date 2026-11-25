import { packKey } from '../lib/items.js';
import { useEffect, useMemo, useState } from 'react';
import DayAdvice from '../components/DayAdvice.jsx';
import { LOCATIONS, MACROS, isCasa, macroOf, norm } from '../catalog.js';
import { daysLeft, expiryStatus } from '../lib/dates.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, ItemCard, Talk, useApp } from '../components/ui.jsx';

export const byExpiry = (a, b) => {
  const da = daysLeft(a.expiry);
  const db = daysLeft(b.expiry);
  if (da === null && db === null) return a.name.localeCompare(b.name);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db || a.name.localeCompare(b.name);
};

// posti piccoli, sotto le schede principali

const WIDE = '(min-width: 900px)';
function useWide() {
  const [w, setW] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(WIDE).matches);
  useEffect(() => {
    const m = matchMedia(WIDE);
    const on = () => setW(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return w;
}

export default function Pantry() {
  const wide = useWide();
  const { state, warnDays, openItem, go, goneIds } = useApp();
  const [loc, setLoc] = useState('tutto');
  const [q, setQ] = useState('');
  const [macro, setMacro] = useState('tutti');
  const items = state.items;

  const counts = useMemo(() => {
    const c = {
      tutto: 0,
      frigo: 0,
      freezer: 0,
      dispensa: 0,
      spezie: 0,
      casa: 0,
    };
    items.forEach((i) => {
      const l = isCasa(i) ? 'casa' : i.loc;
      c[l] = (c[l] || 0) + 1;
      if (l !== 'casa') c.tutto++;
    });
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const nq = norm(q);
    return items
      .filter((i) => (loc === 'casa' ? isCasa(i) : !isCasa(i) && (loc === 'tutto' || i.loc === loc)))
      .filter((i) => {
        const t = norm(i.name + ' ' + (i.brand || ''));
        return nq
          .split(' ')
          .filter(Boolean)
          .every((w) => t.includes(w));
      })
      .filter((i) => macro === 'tutti' || macroOf(i) === macro)
      .sort(byExpiry);
  }, [items, loc, q, macro]);

  // confezioni uguali in una carta sola; si apre quella che scade prima (l'elenco è già in ordine di scadenza)
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of shown) {
      const k = packKey(it);
      if (m.has(k)) m.get(k).n++;
      else m.set(k, { item: it, n: 1 });
    }
    return [...m.values()];
  }, [shown]);

  const expired = items.filter((i) => expiryStatus(i.expiry, warnDays) === 'expired').length;
  const soon = items.filter((i) => ['today', 'soon'].includes(expiryStatus(i.expiry, warnDays))).length;
  const name = state.user?.name ? ' ' + state.user.name.split(' ')[0] : '';
  let text;
  let mood = 'idle';
  if (!items.length) {
    text = `Ciao${name}! Sono vuoto... Premi il tasto rosso + e dimmi cosa hai comprato.`;
  } else if (expired) {
    text = `Attenzione${name}! ${expired === 1 ? 'Un cibo è scaduto' : expired + ' cibi sono scaduti'}${soon ? ` e ${soon === 1 ? 'un altro sta' : 'altri ' + soon + ' stanno'} per scadere` : ''}.`;
    mood = 'worry';
  } else if (soon) {
    text = `Ehi${name}, ${soon === 1 ? 'un cibo sta' : soon + ' cibi stanno'} per scadere: usal${soon === 1 ? 'o' : 'i'} presto!`;
    mood = 'worry';
  } else {
    text = `Tutto a posto${name}! Hai ${items.length} ${items.length === 1 ? 'cibo' : 'cibi'} e niente in scadenza.`;
    mood = 'happy';
  }

  return (
    <>
      <div className="pantry-top">
        <div className="pantry-main">
          <Talk text={text} mood={mood} action={expired > 0 || soon > 0 ? { label: 'Guarda cosa scade', fn: () => go('scadenze') } : null} />

          <div className="filters">
            <div className="hscroll places" role="tablist" aria-label="Dove">
              {[{ id: 'tutto', name: 'Tutto', icon: '1f3e0' }, ...LOCATIONS].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={loc === l.id}
                  className={'chip place ' + (loc === l.id ? 'on' : '')}
                  onClick={() => {
                    play('tap');
                    setLoc(loc === l.id && l.id !== 'tutto' ? 'tutto' : l.id);
                  }}
                >
                  <Icon id={l.icon} size={18} />
                  {l.id === 'casa' ? 'Casa' : l.name} <span className="n">{counts[l.id] || 0}</span>
                </button>
              ))}
            </div>
            {items.length > 6 && <input className="input" type="search" placeholder="Cerca un cibo..." aria-label="Cerca un cibo" value={q} onChange={(e) => setQ(e.target.value)} />}
            {items.length > 0 && loc !== 'casa' && (
              <div className="hscroll macro-filter" role="group" aria-label="Macronutriente">
                {MACROS.map((m) => (
                  <button key={m.id} type="button" className={'chip ' + (macro === m.id ? 'on' : '')} aria-pressed={macro === m.id} onClick={() => setMacro(macro === m.id ? 'tutti' : m.id)}>
                    <span className={'macro m-' + m.id}>{m.short}</span> {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!wide && items.length > 0 && <DayAdvice compact />}

          <div className="list">
            {groups.map(({ item: it, n }) => (
              <ItemCard key={it.id} item={it} count={n} onOpen={openItem} gone={goneIds.has(it.id)} />
            ))}
          </div>

          {items.length > 0 && shown.length === 0 && (
            <div className="empty">
              <Icon id="1f50d" size={50} />
              <p>{q ? `Niente che si chiami "${q}" qui.` : `Qui non c'è niente.`}</p>
            </div>
          )}
          {items.length === 0 && (
            <div className="empty">
              <Icon id="1f6d2" size={60} />
              <p>La dispensa è vuota.</p>
              <Btn color="green" icon="2795" onClick={() => go('aggiungi')}>
                Aggiungi il primo cibo
              </Btn>
            </div>
          )}
        </div>
        {wide && <DayAdvice />}
      </div>
    </>
  );
}
