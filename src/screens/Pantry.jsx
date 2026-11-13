import { useMemo, useState } from 'react';
import { LOCATIONS, norm } from '../catalog.js';
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

export default function Pantry() {
  const { state, warnDays, openItem, go, goneIds } = useApp();
  const [loc, setLoc] = useState('tutto');
  const [q, setQ] = useState('');
  const items = state.items;

  const counts = useMemo(() => {
    const c = { tutto: items.length, frigo: 0, freezer: 0, dispensa: 0 };
    items.forEach((i) => (c[i.loc] = (c[i.loc] || 0) + 1));
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const nq = norm(q);
    return items
      .filter((i) => loc === 'tutto' || i.loc === loc)
      .filter((i) => !nq || norm(i.name + ' ' + (i.brand || '')).includes(nq))
      .sort(byExpiry);
  }, [items, loc, q]);

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
      <Talk text={text} mood={mood} />
      {(expired > 0 || soon > 0) && (
        <Btn color="yellow" block icon="23f0" onClick={() => go('scadenze')}>Guarda cosa scade</Btn>
      )}

      <div className="seg tall" style={{ marginTop: 14 }} role="tablist" aria-label="Dove">
        {[{ id: 'tutto', name: 'Tutto', icon: '1f3e0' }, ...LOCATIONS].map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={loc === l.id}
            className={loc === l.id ? 'on' : ''}
            onClick={() => {
              play('tap');
              setLoc(l.id);
            }}
          >
            <span className="lbl">{l.name}</span>
            <span className="n">{counts[l.id] || 0}</span>
          </button>
        ))}
      </div>

      {items.length > 6 && (
        <input className="input" style={{ marginTop: 10 }} type="search" placeholder="Cerca un cibo..." aria-label="Cerca un cibo" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      <div className="list" style={{ marginTop: 14 }}>
        {shown.map((it) => (
          <ItemCard key={it.id} item={it} onOpen={openItem} gone={goneIds.has(it.id)} />
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
          <p style={{ marginBottom: 12 }}>La dispensa è vuota.</p>
          <Btn color="green" icon="2795" onClick={() => go('aggiungi')}>Aggiungi il primo cibo</Btn>
        </div>
      )}
    </>
  );
}
