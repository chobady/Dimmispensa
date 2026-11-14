import { useMemo, useState } from 'react';
import { BY_KEY, matchFood, norm } from '../catalog.js';
import { actions } from '../lib/store.js';
import { newId } from '../lib/items.js';
import { addDays, todayISO } from '../lib/dates.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, SectionTitle, useApp } from '../components/ui.jsx';

const euro = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + ' €';
const words = (s) => norm(s).split(' ').filter((w) => w.length > 3);
const keyOf = (x) => (x.food && x.food !== 'altro' ? x.food : norm(x.name));
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// supermercati scelti (su questo dispositivo): se ne scegli qualcuno, vedi solo quelli
const LS_MY = 'dm_my_stores';
export const getMyStores = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_MY) || '[]');
  } catch {
    return [];
  }
};
const saveMyStores = (list) => {
  try {
    localStorage.setItem(LS_MY, JSON.stringify(list));
  } catch {}
};
const storeOk = (o, mine) => !mine.length || mine.includes(o.store);

export const offerValid = (o) => !o.until || o.until >= todayISO();

// L'offerta più conveniente per una voce della lista (stesso cibo del catalogo o parole del nome in comune)
export function bestOfferFor(item, offers, mine = getMyStores()) {
  const iw = words(item.name);
  const hits = Object.values(offers || {}).filter((o) => {
    if (!o || !offerValid(o) || !storeOk(o, mine)) return false;
    if (item.food && item.food !== 'altro' && o.food === item.food) return true;
    const ow = words(`${o.name} ${o.brand || ''}`);
    return iw.length > 0 && iw.some((w) => ow.some((x) => x.startsWith(w.slice(0, -1)) || w.startsWith(x.slice(0, -1))));
  });
  hits.sort((a, b) => a.price - b.price);
  return hits[0] || null;
}

// Pagine di PromoQui da provare per una voce: nome intero, nome del catalogo, prima parola
function candidates(name, foodKey) {
  const out = [];
  const n = norm(name).replace(/\b\d+\s*(g|kg|ml|l|pz)\b/g, '').trim();
  const w = n.split(' ').filter(Boolean);
  if (w.length && w.length <= 4) out.push(slug(n));
  const f = foodKey && foodKey !== 'altro' ? BY_KEY[foodKey] : matchFood(name);
  if (f) out.push(slug(f.name));
  const first = w.find((x) => x.length > 2);
  if (first) out.push(slug(first));
  return [...new Set(out.filter(Boolean))].slice(0, 3);
}

async function fetchOffers(name, foodKey) {
  const c = candidates(name, foodKey);
  if (!c.length) return { offers: [] };
  const r = await fetch('/api/offerte?c=' + encodeURIComponent(c.join('|')));
  if (r.status === 404) throw new Error('La ricerca offerte funziona solo sull\'app pubblicata su Vercel.');
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'PromoQui non risponde.');
  if (data.blocked) throw new Error('PromoQui per ora non ci fa entrare. Riprova più tardi.');
  return data;
}

export default function Flyers({ shopList }) {
  const { state, toast } = useApp();
  const me = state.user?.name || '';
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [find, setFind] = useState('');
  const [onlyList, setOnlyList] = useState(false);
  const [mine, setMine] = useState(getMyStores);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const offers = useMemo(() => Object.values(state.offers || {}).filter((o) => o && offerValid(o)), [state.offers]);
  const allStores = [...new Set([...offers.map((o) => o.store).filter(Boolean), ...mine])].sort((a, b) => a.localeCompare(b));
  const links = Object.values(state.flyerLinks || {}).sort((a, b) => a.name.localeCompare(b.name));
  const todo = shopList.filter((s) => !s.done);
  const listKeys = new Set(todo.map(keyOf));
  const inList = (o) => todo.some((s) => bestOfferFor(s, { [o.id]: o }, []));

  const toggleStore = (name) => {
    const next = mine.includes(name) ? mine.filter((x) => x !== name) : [...mine, name];
    setMine(next);
    saveMyStores(next);
  };

  // cerca e salva: le offerte vecchie della stessa ricerca vengono sostituite
  const search = async (name, foodKey) => {
    const data = await fetchOffers(name, foodKey);
    const tag = data.slug || slug(name);
    const old = offers.filter((o) => o.tag === tag).map((o) => [o.id, null]);
    const until = addDays(4);
    const now = Date.now();
    const fresh = (data.offers || []).slice(0, 12).map((o, i) => {
      const food = matchFood(`${o.name}`) || (foodKey && BY_KEY[foodKey]) || null;
      const id = 'pq' + hash(`${o.storeSlug}|${o.brand}|${o.name}|${o.price}`);
      return [
        id,
        {
          id,
          name: String(o.name).slice(0, 60),
          brand: String(o.brand || '').slice(0, 40),
          price: o.price,
          oldPrice: o.oldPrice || null,
          size: o.discount ? `-${o.discount}%` : '',
          until,
          store: o.store,
          food: food ? food.key : 'altro',
          icon: food ? food.icon : '1f4e6',
          url: o.url || '',
          tag,
          src: 'PromoQui',
          by: me,
          addedAt: now + i,
        },
      ];
    });
    const freshIds = new Set(fresh.map(([id]) => id));
    actions.offerSetMany([...old.filter(([id]) => !freshIds.has(id)), ...fresh]);
    return fresh.length;
  };

  const searchList = async () => {
    const items = todo.slice(0, 20);
    if (!items.length) return toast('La lista della spesa è vuota.');
    let found = 0;
    let done = 0;
    let lastErr = null;
    setBusy(`Cerco le offerte... 0/${items.length}`);
    const queue = [...items];
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        try {
          const n = await search(it.name, it.food);
          if (n) found++;
        } catch (e) {
          lastErr = e;
        }
        done++;
        setBusy(`Cerco le offerte... ${done}/${items.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy('');
    if (!found && lastErr) {
      play('error');
      return toast(lastErr.message, { err: true });
    }
    play(found ? 'add' : 'error');
    toast(found ? `Offerte trovate per ${found} cose su ${items.length}.` : 'Nessuna offerta trovata per la tua lista.');
  };

  const searchOne = async (e) => {
    e.preventDefault();
    const name = find.trim();
    if (!name) return;
    setBusy(`Cerco ${name}...`);
    try {
      const n = await search(name, matchFood(name)?.key);
      play(n ? 'add' : 'error');
      toast(n ? `${n} offerte per ${name}.` : `Nessuna offerta per ${name} in questo momento.`);
      if (n) {
        setQ(name);
        setFind('');
      }
    } catch (err) {
      play('error');
      toast(err.message, { err: true });
    } finally {
      setBusy('');
    }
  };

  const addToList = (o) => {
    const key = keyOf(o);
    if (listKeys.has(key)) return toast('È già nella lista.');
    const id = newId();
    actions.shopSet(id, {
      id,
      name: o.name + (o.brand ? ' ' + o.brand : ''),
      qty: null,
      unit: null,
      food: o.food || 'altro',
      icon: o.icon || '1f4e6',
      cat: BY_KEY[o.food]?.cat || 'dispensa',
      done: false,
      by: me,
      addedAt: Date.now(),
    });
    play('add');
    toast(`${o.name}: aggiunto alla lista (${o.store}, ${euro(o.price)}).`);
  };
  const removeStore = (name) => {
    const old = offers.filter((o) => o.store === name);
    actions.offerSetMany(old.map((o) => [o.id, null]));
    toast(`Offerte di ${name} tolte.`, { action: { label: 'Annulla', fn: () => actions.offerSetMany(old.map((o) => [o.id, o])) } });
  };

  const addLink = (name, url) => {
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      new URL(u);
    } catch {
      return toast('Il link non è valido.', { err: true });
    }
    const id = newId();
    actions.linkSet(id, { id, name: (name || new URL(u).hostname.replace(/^www\./, '')).trim().slice(0, 30), url: u });
    setLinkName('');
    setLinkUrl('');
    play('add');
  };

  const nq = norm(q);
  const shown = offers
    .filter((o) => storeOk(o, mine))
    .filter((o) => !nq || norm(`${o.name} ${o.brand} ${o.store}`).includes(nq))
    .filter((o) => !onlyList || inList(o));
  const groups = [...new Set(shown.map((o) => o.store))]
    .sort((x, y) => x.localeCompare(y))
    .map((st) => ({ store: st, items: shown.filter((o) => o.store === st).sort((x, y) => x.price - y.price) }));

  return (
    <>
      <SectionTitle icon="1f525">Offerte dei volantini</SectionTitle>
      <div className="win stack">
        <p className="small">Cerco le offerte di questa settimana su PromoQui, per le cose della tua lista o per quello che scrivi qui sotto.</p>
        <Btn color="yellow" block icon="1f6d2" onClick={searchList} disabled={!!busy || !todo.length}>
          {todo.length ? `Cerca offerte per la mia lista (${Math.min(todo.length, 20)})` : 'La lista della spesa è vuota'}
        </Btn>
        <form className="row" onSubmit={searchOne}>
          <input className="input grow" value={find} onChange={(e) => setFind(e.target.value)} placeholder="es. mozzarella, caffè, tonno" aria-label="Prodotto da cercare" maxLength={40} disabled={!!busy} />
          <Btn type="submit" sm icon="1f50d" disabled={!!busy || !find.trim()}>Cerca</Btn>
        </form>
        {busy && <p className="small center blink">{busy}</p>}
      </div>

      {allStores.length > 0 && (
        <>
          <SectionTitle icon="1f6d2">Dove fai la spesa?</SectionTitle>
          <p className="small muted" style={{ margin: '0 0 6px' }}>{mine.length ? 'Vedi solo le offerte dei supermercati scelti.' : 'Tocca i supermercati dove vai per vedere solo le loro offerte.'}</p>
          <div className="chips">
            {allStores.map((st) => (
              <button key={st} type="button" className={'chip ' + (mine.includes(st) ? 'on' : '')} onClick={() => toggleStore(st)} aria-pressed={mine.includes(st)}>
                {st}
              </button>
            ))}
          </div>
        </>
      )}

      {offers.length > 0 && (
        <>
          <SectionTitle icon="2b50">Offerte ({shown.length})</SectionTitle>
          <input className="input" type="search" placeholder="Filtra: latte, Conad..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtra le offerte" />
          <div className="chips" style={{ margin: '8px 0 4px' }}>
            <button type="button" className={'chip ' + (!onlyList ? 'on' : '')} onClick={() => setOnlyList(false)}>Tutte</button>
            <button type="button" className={'chip ' + (onlyList ? 'on' : '')} onClick={() => setOnlyList(true)}>Solo cose della mia lista</button>
          </div>
          {groups.map((g) => (
            <section key={g.store} style={{ marginTop: 12 }}>
              <div className="offer-store">
                <h3>{g.store}</h3>
                <button type="button" className="shop-x" onClick={() => removeStore(g.store)} aria-label={`Togli le offerte di ${g.store}`}>✕</button>
              </div>
              <div className="shop-list">
                {g.items.map((o) => {
                  const match = inList(o);
                  return (
                    <div key={o.id} className={'win flat offer-row ' + (match ? 'match' : '')}>
                      <Icon id={o.icon} size={30} />
                      <span className="grow">
                        <span className="nm">
                          {o.name}
                          {o.brand ? <span className="muted"> {o.brand}</span> : null}
                        </span>
                        <span className="q">
                          {[o.size, match ? 'è nella tua lista' : ''].filter(Boolean).join(' · ')}
                          {o.url ? (
                            <>
                              {o.size || match ? ' · ' : ''}
                              <a href={o.url} target="_blank" rel="noreferrer">volantino</a>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className="price">
                        {o.oldPrice && <s>{euro(o.oldPrice)}</s>}
                        <b>{euro(o.price)}</b>
                      </span>
                      <button type="button" className="offer-add" onClick={() => addToList(o)} aria-label={`Aggiungi ${o.name} alla lista`} disabled={match}>
                        {match ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && <p className="muted center" style={{ marginTop: 12 }}>Nessuna offerta corrisponde.</p>}
          <p className="small muted center" style={{ marginTop: 10 }}>Offerte copiate da PromoQui: controlla sempre il volantino prima di andare. Spariscono da sole dopo qualche giorno.</p>
        </>
      )}

      <SectionTitle icon="1f517">I miei supermercati</SectionTitle>
      <div className="win stack">
        <p className="small">Salva i link ai volantini dei supermercati dove vai, per aprirli al volo.</p>
        {links.map((l) => (
          <div key={l.id} className="row">
            <a className="btn grow" href={l.url} target="_blank" rel="noreferrer" style={{ justifyContent: 'flex-start', textDecoration: 'none' }}>
              <Icon id="1f6d2" size={20} /> {l.name}
            </a>
            <button type="button" className="shop-x" onClick={() => actions.linkSet(l.id, null)} aria-label={`Togli ${l.name}`}>✕</button>
          </div>
        ))}
        <form className="stack" style={{ gap: 6 }} onSubmit={(e) => (e.preventDefault(), addLink(linkName, linkUrl))}>
          <div className="row">
            <input className="input" style={{ width: '38%' }} value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nome" aria-label="Nome del supermercato" maxLength={30} />
            <input className="input grow" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link al volantino" aria-label="Link al volantino" inputMode="url" />
          </div>
          <Btn type="submit" sm icon="2795" disabled={!linkUrl.trim()}>Salva link</Btn>
        </form>
        {!links.some((l) => /doveconviene|promoqui/.test(l.url)) && (
          <div className="chips">
            <button type="button" className="chip" onClick={() => addLink('DoveConviene', 'https://www.doveconviene.it')}>+ DoveConviene</button>
            <button type="button" className="chip" onClick={() => addLink('PromoQui', 'https://www.promoqui.it')}>+ PromoQui</button>
          </div>
        )}
      </div>
    </>
  );
}
