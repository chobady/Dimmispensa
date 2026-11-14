import { useMemo, useRef, useState } from 'react';
import { BY_KEY, matchFood, norm } from '../catalog.js';
import { actions } from '../lib/store.js';
import { fileToBase64, fileToJpegBase64, offersFromFlyer } from '../lib/gemini.js';
import { newId } from '../lib/items.js';
import { shortDate, todayISO } from '../lib/dates.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, Loading, SectionTitle, useApp } from '../components/ui.jsx';

const euro = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + ' €';
const words = (s) => norm(s).split(' ').filter((w) => w.length > 3);
const keyOf = (x) => (x.food && x.food !== 'altro' ? x.food : norm(x.name));

export const offerValid = (o) => !o.until || o.until >= todayISO();

// L'offerta più conveniente per una voce della lista (stesso cibo del catalogo o parole del nome in comune)
export function bestOfferFor(item, offers) {
  const iw = words(item.name);
  const hits = Object.values(offers || {}).filter((o) => {
    if (!offerValid(o)) return false;
    if (item.food && item.food !== 'altro' && o.food === item.food) return true;
    const ow = words(`${o.name} ${o.brand || ''}`);
    return iw.length > 0 && iw.some((w) => ow.some((x) => x.startsWith(w.slice(0, -1)) || w.startsWith(x.slice(0, -1))));
  });
  hits.sort((a, b) => a.price - b.price);
  return hits[0] || null;
}

export default function Flyers({ shopList }) {
  const { state, toast, go } = useApp();
  const geminiKey = state.pantry?.geminiKey || '';
  const me = state.user?.name || '';
  const [store, setStore] = useState('');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [onlyList, setOnlyList] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const camRef = useRef(null);
  const galRef = useRef(null);
  const pdfRef = useRef(null);

  const offers = useMemo(() => Object.values(state.offers || {}).filter(offerValid), [state.offers]);
  const stores = [...new Set(offers.map((o) => o.store).filter(Boolean))];
  const links = Object.values(state.flyerLinks || {}).sort((a, b) => a.name.localeCompare(b.name));
  const listKeys = new Set(shopList.filter((s) => !s.done).map(keyOf));
  const inList = (o) => shopList.some((s) => !s.done && bestOfferFor(s, { [o.id]: o }));

  const read = async (files) => {
    if (!files.length) return;
    setBusy(files.length > 1 ? `Leggo ${files.length} pagine del volantino...` : 'Leggo il volantino...');
    try {
      const prepared = [];
      for (const f of files.slice(0, 8)) {
        if (f.type === 'application/pdf') {
          if (f.size > 15 * 1024 * 1024) throw new Error('Il PDF è troppo grande (massimo 15 MB). Prova con le foto delle pagine.');
          prepared.push(await fileToBase64(f));
        } else {
          const img = await fileToJpegBase64(f, 2000);
          prepared.push({ base64: img.base64, mime: img.mime });
        }
      }
      const res = await offersFromFlyer(geminiKey, prepared, { store: store.trim() });
      if (!res.offers.length) {
        play('error');
        toast('Non ho trovato offerte di cibo in questo volantino.', { err: true });
        return;
      }
      const now = Date.now();
      const pairs = res.offers.map((o, i) => {
        const food = (o.tipo && BY_KEY[o.tipo]) || matchFood(o.nome) || null;
        const id = newId();
        return [
          id,
          {
            id,
            name: String(o.nome).trim().slice(0, 60),
            brand: String(o.marca || '').trim().slice(0, 40),
            price: Math.round(Number(o.prezzo) * 100) / 100,
            oldPrice: Number(o.prezzo_prima) > Number(o.prezzo) ? Math.round(Number(o.prezzo_prima) * 100) / 100 : null,
            size: String(o.formato || '').slice(0, 30),
            until: res.until || '',
            store: (res.store || store || 'Volantino').slice(0, 30),
            food: food ? food.key : 'altro',
            icon: food ? food.icon : '1f4e6',
            by: me,
            addedAt: now + i,
          },
        ];
      });
      actions.offerSetMany(pairs);
      play('add');
      const matches = pairs.filter(([, o]) => inList(o)).length;
      toast(`${pairs.length} offerte di ${pairs[0][1].store} salvate${matches ? `, ${matches} su cose della tua lista!` : '.'}`);
      setStore('');
    } catch (e) {
      play('error');
      toast(e.message || 'Non sono riuscito a leggere il volantino.', { err: true });
    } finally {
      setBusy('');
    }
  };
  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    read(files);
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
    .filter((o) => !nq || norm(`${o.name} ${o.brand} ${o.store}`).includes(nq))
    .filter((o) => !onlyList || inList(o));
  const groups = [...new Set(shown.map((o) => o.store))].map((s) => ({ store: s, items: shown.filter((o) => o.store === s).sort((a, b) => a.name.localeCompare(b.name)) }));

  if (busy) return <Loading text={busy} />;

  return (
    <>
      <SectionTitle icon="1f4f7">Leggi un volantino</SectionTitle>
      {geminiKey ? (
        <div className="win stack">
          <p className="small">
            Fai una foto al volantino di carta, uno screenshot dall'app del supermercato (o da DoveConviene, PromoQui…) oppure carica il PDF dal sito. Gemini legge le offerte di cibo e le confronta con la tua lista.
          </p>
          <label className="field">
            <span>Supermercato (facoltativo, lo capisco anche da solo)</span>
            <input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder="es. Conad" list="dm-stores" maxLength={30} />
            <datalist id="dm-stores">
              {[...new Set([...stores, ...links.map((l) => l.name)])].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <input ref={camRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={onFiles} />
          <input ref={galRef} className="hidden" type="file" accept="image/*" multiple onChange={onFiles} />
          <input ref={pdfRef} className="hidden" type="file" accept="application/pdf" onChange={onFiles} />
          <div className="two">
            <Btn color="green" icon="1f4f7" onClick={() => camRef.current.click()}>Foto</Btn>
            <Btn icon="1f4be" onClick={() => galRef.current.click()}>Screenshot</Btn>
          </div>
          <Btn block icon="1f4dd" onClick={() => pdfRef.current.click()}>Carica PDF</Btn>
          <p className="small muted">Puoi scegliere più screenshot insieme (fino a 8 pagine). Le immagini non vengono salvate: restano solo le offerte, che spariscono da sole quando il volantino scade.</p>
        </div>
      ) : (
        <div className="win stack">
          <p>Per leggere i volantini mi serve la chiave gratuita di Gemini.</p>
          <Btn color="yellow" block icon="1f511" onClick={() => go('opzioni')}>Aggiungila nelle Opzioni</Btn>
        </div>
      )}

      {offers.length > 0 && (
        <>
          <SectionTitle icon="1f525">Offerte ({offers.length})</SectionTitle>
          <input className="input" type="search" placeholder="Cerca: latte, mozzarella, Conad..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nelle offerte" />
          <div className="chips" style={{ margin: '8px 0 4px' }}>
            <button type="button" className={'chip ' + (!onlyList ? 'on' : '')} onClick={() => setOnlyList(false)}>Tutte</button>
            <button type="button" className={'chip ' + (onlyList ? 'on' : '')} onClick={() => setOnlyList(true)}>Solo cose della mia lista</button>
          </div>
          {groups.map((g) => {
            const until = g.items.find((o) => o.until)?.until;
            return (
              <section key={g.store} style={{ marginTop: 12 }}>
                <div className="offer-store">
                  <h3>{g.store}</h3>
                  {until && <span className="small muted">fino al {shortDate(until)}</span>}
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
                            {o.size}
                            {match ? (o.size ? ' · ' : '') + 'è nella tua lista' : ''}
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
            );
          })}
          {!groups.length && <p className="muted center" style={{ marginTop: 12 }}>Nessuna offerta corrisponde.</p>}
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
