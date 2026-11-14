import { useEffect, useMemo, useRef, useState } from 'react';
import { BY_KEY, matchFood, norm } from '../catalog.js';
import { actions } from '../lib/store.js';
import { newId } from '../lib/items.js';
import { addDays, shortDate, todayISO } from '../lib/dates.js';
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

// catene più comuni, per aggiungerle con un tocco (slug = pagina PromoQui)
const CHAINS = [
  ['Eurospin', 'eurospin'], ['Lidl', 'lidl'], ['Conad', 'conad'], ['Coop', 'coop'], ['Esselunga', 'esselunga'], ['MD', 'md'],
  ['Penny', 'penny-market'], ['Aldi', 'aldi'], ['Carrefour', 'carrefour'], ['Carrefour Market', 'carrefour-market'], ['Pam', 'pam'],
  ['Despar', 'despar'], ['Famila', 'famila'], ['Bennet', 'bennet'], ['Il Gigante', 'il-gigante'], ['Todis', 'todis'], ['Crai', 'crai'],
  ['Deco', 'deco'], ['Sisa', 'sisa'], ['Tigre', 'tigre'], ['Iper', 'iper-la-grande-i'], ["In's", 'ins-mercato'], ['Dpiu', 'dpiu'],
];

// supermercati scelti = link salvati con uno slug PromoQui (condivisi con la famiglia)
export const myStoreSlugs = (links) => Object.values(links || {}).map((l) => l && l.slug).filter(Boolean);
const offerSlug = (o) => o.storeSlug || slug(o.store);
const storeOk = (o, mine) => !mine.length || mine.includes(offerSlug(o));

export const offerValid = (o) => !o.until || o.until >= todayISO();

// L'offerta più conveniente per una voce della lista (stesso cibo del catalogo o parole del nome in comune)
export function bestOfferFor(item, offers, mine = []) {
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

async function api(qs) {
  const r = await fetch('/api/offerte?' + qs);
  if (r.status === 404 && !(r.headers.get('content-type') || '').includes('json')) throw new Error("La ricerca offerte funziona solo sull'app pubblicata su Vercel.");
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'PromoQui non risponde.');
  if (data.blocked) throw new Error('PromoQui per ora non ci fa entrare. Riprova più tardi.');
  return data;
}

// "Eurospin" o "https://www.promoqui.it/volantino/eurospin/1736781" → { slug, flyer, name }
function parseStoreInput(txt) {
  const t = txt.trim();
  const m = t.match(/promoqui\.it\/(?:volantino\/)?([a-z0-9-]+)(?:\/(\d+))?/i);
  if (m && /promoqui/i.test(t)) {
    const s = m[1].toLowerCase();
    const known = CHAINS.find(([, x]) => x === s);
    return { slug: s, flyer: m[2] || '', name: known ? known[0] : s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') };
  }
  const known = CHAINS.find(([n, x]) => norm(n) === norm(t) || x === slug(t));
  if (known) return { slug: known[1], flyer: '', name: known[0] };
  return { slug: slug(t), flyer: '', name: t.replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default function Flyers({ shopList }) {
  const { state, toast } = useApp();
  const me = state.user?.name || '';
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [find, setFind] = useState('');
  const [addTxt, setAddTxt] = useState('');
  const [view, setView] = useState('tutte'); // tutte | lista
  const [only, setOnly] = useState(''); // slug di un supermercato
  const [showAllChains, setShowAllChains] = useState(false);
  const autoDone = useRef(false);

  const offers = useMemo(() => Object.values(state.offers || {}).filter((o) => o && offerValid(o)), [state.offers]);
  const links = Object.values(state.flyerLinks || {}).filter(Boolean);
  const stores = links.filter((l) => l.slug).sort((a, b) => a.name.localeCompare(b.name));
  const otherLinks = links.filter((l) => !l.slug && !/promoqui\.it\/?$|doveconviene\.it\/?$/.test(l.url || ''));
  const mine = stores.map((s) => s.slug);
  const todo = shopList.filter((s) => !s.done);
  const listKeys = new Set(todo.map(keyOf));
  const inList = (o) => todo.some((s) => bestOfferFor(s, { [o.id]: o }));

  const toOffer = (o, extra, i) => {
    const food = matchFood(o.name) || (extra.foodKey && BY_KEY[extra.foodKey]) || null;
    const id = 'pq' + hash(`${extra.storeSlug}|${o.brand}|${o.name}|${o.price}`);
    return [
      id,
      {
        id,
        name: String(o.name).slice(0, 60),
        brand: String(o.brand || '').slice(0, 40),
        price: o.price,
        oldPrice: o.oldPrice || null,
        size: o.discount ? `-${o.discount}%` : '',
        until: extra.until,
        store: extra.store,
        storeSlug: extra.storeSlug,
        food: food ? food.key : 'altro',
        icon: food ? food.icon : '1f4e6',
        url: o.url || '',
        tag: extra.tag,
        src: 'PromoQui',
        by: me,
        addedAt: Date.now() + i,
      },
    ];
  };
  // salva le offerte nuove e toglie quelle vecchie con la stessa etichetta
  const replaceTag = (tag, fresh) => {
    const ids = new Set(fresh.map(([id]) => id));
    const old = Object.values(state.offers || {}).filter((o) => o && o.tag === tag && !ids.has(o.id)).map((o) => [o.id, null]);
    actions.offerSetMany([...old, ...fresh]);
  };

  // volantino intero di un supermercato
  const loadStore = async (st, { quiet = false } = {}) => {
    const data = await api(`store=${encodeURIComponent(st.slug)}${st.flyer ? '&flyer=' + st.flyer : ''}`);
    const until = data.until && data.until >= todayISO() ? data.until : addDays(7);
    const fresh = (data.offers || []).slice(0, 250).map((o, i) => toOffer(o, { store: st.name, storeSlug: st.slug, until, tag: 'fl:' + st.slug }, i));
    replaceTag('fl:' + st.slug, fresh);
    actions.linkSet(st.id, { ...st, flyer: '', flyerId: data.flyer || '', title: data.title || '', from: data.from || '', until: data.until || '', url: data.url || st.url, fetchedAt: Date.now(), count: fresh.length });
    if (!quiet) {
      play(fresh.length ? 'add' : 'error');
      toast(fresh.length ? `${st.name}: ${fresh.length} offerte nel volantino.` : `${st.name}: non riesco a leggere le offerte di questo volantino.`, fresh.length ? {} : { err: true });
    }
    return fresh.length;
  };

  // aggiorna da solo i volantini scaduti o mai letti (una volta per apertura)
  useEffect(() => {
    if (autoDone.current || !stores.length) return;
    autoDone.current = true;
    const stale = stores.filter((s) => !s.fetchedAt || (s.until && s.until < todayISO()) || Date.now() - s.fetchedAt > 2 * 86400000);
    (async () => {
      for (const st of stale) {
        try {
          await loadStore(st, { quiet: true });
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores.length]);

  const addStore = async (raw) => {
    const txt = (raw ?? addTxt).trim();
    if (!txt) return;
    const p = parseStoreInput(txt);
    if (!p.slug) return;
    if (stores.some((s) => s.slug === p.slug)) {
      setAddTxt('');
      return toast(`${p.name} c'è già.`);
    }
    const st = { id: 'st_' + p.slug, name: p.name, slug: p.slug, flyer: p.flyer, url: `https://www.promoqui.it/volantino/${p.slug}${p.flyer ? '/' + p.flyer : ''}` };
    setBusy(`Apro il volantino ${p.name}...`);
    try {
      await loadStore(st);
      setAddTxt('');
      setOnly(p.slug);
    } catch (e) {
      play('error');
      toast(/non trovato/i.test(e.message) ? `Non trovo "${p.name}" su PromoQui. Prova a incollare il link del volantino.` : e.message, { err: true });
    } finally {
      setBusy('');
    }
  };
  const removeStore = (st) => {
    const old = Object.values(state.offers || {}).filter((o) => o && o.tag === 'fl:' + st.slug);
    actions.linkSet(st.id, null);
    actions.offerSetMany(old.map((o) => [o.id, null]));
    if (only === st.slug) setOnly('');
    toast(`${st.name} tolto.`, { action: { label: 'Annulla', fn: () => (actions.linkSet(st.id, st), actions.offerSetMany(old.map((o) => [o.id, o]))) } });
  };
  const refreshStore = async (st) => {
    setBusy(`Aggiorno ${st.name}...`);
    try {
      await loadStore(st);
    } catch (e) {
      play('error');
      toast(e.message, { err: true });
    } finally {
      setBusy('');
    }
  };

  // ricerca per prodotto (tutte le catene; poi si filtra sui tuoi supermercati)
  const search = async (name, foodKey) => {
    const c = candidates(name, foodKey);
    if (!c.length) return 0;
    const data = await api('c=' + encodeURIComponent(c.join('|')));
    const tag = data.slug || slug(name);
    const until = addDays(4);
    const fresh = (data.offers || []).slice(0, 12).map((o, i) => toOffer(o, { store: stores.find((s) => s.slug === o.storeSlug)?.name || o.store, storeSlug: o.storeSlug, until, tag, foodKey }, i));
    replaceTag(tag, fresh);
    return fresh.filter(([, o]) => storeOk(o, mine)).length;
  };

  const searchList = async () => {
    const items = todo.slice(0, 20);
    if (!items.length) return toast('La lista della spesa è vuota.');
    let lastErr = null;
    for (const st of stores) {
      setBusy(`Aggiorno ${st.name}...`);
      try {
        await loadStore(st, { quiet: true });
      } catch (e) {
        lastErr = e;
      }
    }
    let done = 0;
    let ok = 0;
    setBusy(`Cerco le offerte... 0/${items.length}`);
    const queue = [...items];
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        try {
          await search(it.name, it.food);
          ok++;
        } catch (e) {
          lastErr = e;
        }
        done++;
        setBusy(`Cerco le offerte... ${done}/${items.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy('');
    setView('lista');
    setOnly('');
    if (!ok && lastErr) {
      play('error');
      return toast(lastErr.message, { err: true });
    }
    play('add');
    toast('Fatto! Sotto vedi le offerte per le cose della tua lista.');
  };

  const searchOne = async (e) => {
    e.preventDefault();
    const name = find.trim();
    if (!name) return;
    setBusy(`Cerco ${name}...`);
    try {
      const n = await search(name, matchFood(name)?.key);
      play(n ? 'add' : 'error');
      toast(n ? `${n} offerte per ${name}${mine.length ? ' nei tuoi supermercati' : ''}.` : `Nessuna offerta per ${name}${mine.length ? ' nei tuoi supermercati' : ''} in questo momento.`);
      setQ(name);
      setView('tutte');
      setOnly('');
      setFind('');
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

  const nq = norm(q);
  const shown = offers
    .filter((o) => storeOk(o, mine))
    .filter((o) => !only || offerSlug(o) === only)
    .filter((o) => !nq || norm(`${o.name} ${o.brand} ${o.store}`).includes(nq))
    .filter((o) => view !== 'lista' || inList(o));
  const disc = (o) => (o.oldPrice ? 1 - o.price / o.oldPrice : 0);
  const groups = [...new Set(shown.map((o) => o.store))]
    .sort((x, y) => x.localeCompare(y))
    .map((st) => ({ store: st, items: shown.filter((o) => o.store === st).sort((x, y) => Number(inList(y)) - Number(inList(x)) || disc(y) - disc(x) || x.name.localeCompare(y.name)) }));
  const nList = offers.filter((o) => storeOk(o, mine) && inList(o)).length;
  const sugg = CHAINS.filter(([, s]) => !mine.includes(s)).slice(0, showAllChains ? 99 : 8);

  return (
    <>
      <SectionTitle icon="1f6d2">I miei supermercati</SectionTitle>
      <div className="win stack">
        {stores.length === 0 && <p className="small">Aggiungi i supermercati dove vai: ti mostro tutte le offerte del loro volantino e cerco le cose della tua lista solo lì.</p>}
        {stores.map((st) => {
          const n = offers.filter((o) => o.tag === 'fl:' + st.slug).length;
          return (
            <div key={st.id} className="store-row">
              <button type="button" className={'store-main ' + (only === st.slug ? 'on' : '')} onClick={() => (setOnly(only === st.slug ? '' : st.slug), setView('tutte'), setQ(''))} aria-pressed={only === st.slug}>
                <b>{st.name}</b>
                <span className="small muted">
                  {n ? `${n} offerte` : 'nessuna offerta letta'}
                  {st.until ? ` · fino al ${shortDate(st.until)}` : ''}
                </span>
              </button>
              {st.url && (
                <a className="store-ic" href={st.url} target="_blank" rel="noreferrer" aria-label={`Apri il volantino ${st.name}`} title="Apri il volantino">↗</a>
              )}
              <button type="button" className="store-ic" onClick={() => refreshStore(st)} disabled={!!busy} aria-label={`Aggiorna ${st.name}`} title="Aggiorna">⟳</button>
              <button type="button" className="store-ic" onClick={() => removeStore(st)} aria-label={`Togli ${st.name}`} title="Togli">✕</button>
            </div>
          );
        })}
        <form className="row" onSubmit={(e) => (e.preventDefault(), addStore())}>
          <input className="input grow" value={addTxt} onChange={(e) => setAddTxt(e.target.value)} placeholder="Nome o link PromoQui" aria-label="Supermercato da aggiungere" list="dm-chains" disabled={!!busy} />
          <datalist id="dm-chains">
            {CHAINS.map(([n]) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Btn type="submit" sm icon="2795" disabled={!!busy || !addTxt.trim()}>Aggiungi</Btn>
        </form>
        <div className="chips">
          {sugg.map(([n, s]) => (
            <button key={s} type="button" className="chip" onClick={() => addStore(n)} disabled={!!busy}>+ {n}</button>
          ))}
          {!showAllChains && <button type="button" className="chip" onClick={() => setShowAllChains(true)}>altri...</button>}
        </div>
        {otherLinks.map((l) => (
          <div key={l.id} className="row">
            <a className="btn grow" href={l.url} target="_blank" rel="noreferrer" style={{ justifyContent: 'flex-start', textDecoration: 'none' }}>
              <Icon id="1f6d2" size={20} /> {l.name}
            </a>
            <button type="button" className="shop-x" onClick={() => actions.linkSet(l.id, null)} aria-label={`Togli ${l.name}`}>✕</button>
          </div>
        ))}
      </div>

      <SectionTitle icon="1f50d">Cerca offerte</SectionTitle>
      <div className="win stack">
        <Btn color="yellow" block icon="1f4dd" onClick={searchList} disabled={!!busy || !todo.length}>
          {todo.length ? `Offerte per la mia lista (${Math.min(todo.length, 20)})` : 'La lista della spesa è vuota'}
        </Btn>
        <form className="row" onSubmit={searchOne}>
          <input className="input grow" value={find} onChange={(e) => setFind(e.target.value)} placeholder="es. mozzarella, caffè, tonno" aria-label="Prodotto da cercare" maxLength={40} disabled={!!busy} />
          <Btn type="submit" sm icon="1f50d" disabled={!!busy || !find.trim()}>Cerca</Btn>
        </form>
        {mine.length > 0 && <p className="small muted">Cerco solo nei tuoi supermercati.</p>}
        {busy && <p className="small center blink">{busy}</p>}
      </div>

      {offers.length > 0 && (
        <>
          <SectionTitle icon="2b50">Offerte ({shown.length})</SectionTitle>
          <div className="chips" style={{ margin: '0 0 8px' }}>
            <button type="button" className={'chip ' + (view === 'tutte' ? 'on' : '')} onClick={() => setView('tutte')}>Tutte</button>
            <button type="button" className={'chip ' + (view === 'lista' ? 'on' : '')} onClick={() => setView('lista')}>Per la mia lista {nList ? `(${nList})` : ''}</button>
          </div>
          {stores.length > 1 && (
            <div className="chips" style={{ margin: '0 0 8px' }}>
              <button type="button" className={'chip ' + (!only ? 'on' : '')} onClick={() => setOnly('')}>Tutti i negozi</button>
              {stores.map((st) => (
                <button key={st.slug} type="button" className={'chip ' + (only === st.slug ? 'on' : '')} onClick={() => setOnly(st.slug)}>{st.name}</button>
              ))}
            </div>
          )}
          <input className="input" type="search" placeholder="Filtra: latte, pasta, tonno..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtra le offerte" />
          {groups.map((g) => (
            <section key={g.store} style={{ marginTop: 12 }}>
              <div className="offer-store">
                <h3>{g.store}</h3>
                <span className="small muted">{g.items.length}</span>
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
          {!groups.length && <p className="muted center" style={{ marginTop: 12 }}>{view === 'lista' ? 'Nessuna offerta per le cose della tua lista.' : 'Nessuna offerta corrisponde.'}</p>}
          <p className="small muted center" style={{ marginTop: 10 }}>Offerte copiate da PromoQui: controlla sempre il volantino prima di andare. Spariscono da sole quando il volantino scade.</p>
        </>
      )}
    </>
  );
}
